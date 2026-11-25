//
//  CloudSync.swift
//  FluentFrenchIOS
//
//  Continuous per-user progress backup. A single row per user in
//  `ios_progress_snapshots` holds the learner's full state as JSON. Writes are
//  debounced; reads reconcile on sign-in, on launch and when the app returns
//  to the foreground. The "which side is newer" rule lives in
//  SnapshotReconciler (pure, unit-tested); this class owns the network, the
//  retry policy and the observable sync state the profile card renders.
//

import Foundation
import Observation
import Supabase

/// The full persisted learner state, serialized to the cloud snapshot row.
nonisolated struct ProgressSnapshot: Codable, Sendable {
    /// Highest snapshot layout this build can read. A row carrying a larger
    /// `schemaVersion` was written by a newer app and is never applied.
    static let currentSchemaVersion = 1

    var schemaVersion: Int = ProgressSnapshot.currentSchemaVersion
    var clientUpdatedAt: Date

    var gaps: [GapItem]
    var concepts: [Concept]
    var errors: [ErrorRecord]
    var abilityTheta: Double
    var masteryDays: [String]
    var hasCompletedAssessment: Bool
    var assessedLevel: String
    var sessionIndex: Int
    var preferences: UserPreferences?
    var activityProgress: [String: Int]
    var gapsSinceLastLesson: Int
    var lessonsSinceCapstone: Int
    /// Persisted XP (A16). Optional so rows written before it existed still decode.
    var xp: Int? = nil

    // A6: everything `clearForSignOut()` wipes must travel in the row, or the
    // "backed up before sign-out" promise is hollow. All optional so rows written
    // by earlier builds still decode; `apply(snapshot:)` keeps the device value
    // when a field is absent.
    /// Personal bests keyed by `LessonBestKind.rawValue`.
    var personalBests: [String: LessonBest]? = nil
    /// Cumulative minutes per modality (feeds readiness).
    var lifetimeMinutes: [String: Int]? = nil
    /// Cumulative lesson minutes ever credited.
    var totalLessonMinutes: Int? = nil
    /// Lesson minutes per day ("yyyy-MM-dd").
    var lessonMinutes: [String: Int]? = nil
    /// Lessons completed per day ("yyyy-MM-dd") — Foundation pacing.
    var lessonsCompletedByDay: [String: Int]? = nil
    /// Rolling check-in outcomes the retention governor reads.
    var checkInHistory: [Bool]? = nil
    /// Modalities that have ever read as unlocked (sorted for a stable encoding).
    var unlockedModalities: [String]? = nil
    /// When the learner's record started.
    var journeyStartedAt: Date? = nil
    /// Saved scenario guides, as the JSON `ScenarioStore` writes on the device.
    /// Opaque here on purpose: the snapshot does not depend on the scenario models
    /// (store-1-4).
    var savedScenarios: Data? = nil
    /// The CEFR band the writing device last REPORTED for `abilityTheta`, latched
    /// with hysteresis (engine-10-2). Without it a restored device, a second device
    /// or a re-sign-in re-latched θ against its own default band, and a learner
    /// near an edge read B1 on one phone and A2 on the other for the same record
    /// (store-11-3). Optional: rows from earlier builds take the bare mapping.
    var latchedLevel: String? = nil
}

nonisolated extension ProgressSnapshot {
    /// True when the row holds nothing the learner did: never placed, no cards, no
    /// answer booked anywhere, no XP, no practice time. Every first sign-in uploads
    /// the device's empty record (sign-in comes before placement), so an account
    /// whose learner signed in and left before placing holds exactly this. A
    /// recovery pass (a deferred restore, "Continue offline") treats such a row as
    /// no row: applying it replaced the learner's offline placement and lessons
    /// with nothing, although the screen had promised the account copy wins only
    /// "if your account already has progress" (store-11-1). Deliberately strict:
    /// any trace of activity makes the row a real record.
    var holdsNoLearnerActivity: Bool {
        !hasCompletedAssessment
            && gaps.isEmpty
            && errors.isEmpty
            && sessionIndex == 0
            && (xp ?? 0) == 0
            && masteryDays.isEmpty
            && concepts.allSatisfy { $0.observationCount == 0 && $0.lastTestedAt == nil }
            && activityProgress.values.allSatisfy { $0 == 0 }
            && (lifetimeMinutes ?? [:]).values.allSatisfy { $0 == 0 }
            && (totalLessonMinutes ?? 0) == 0
            && (lessonsCompletedByDay ?? [:]).values.allSatisfy { $0 == 0 }
            && (personalBests ?? [:]).isEmpty
            && (checkInHistory ?? []).isEmpty
            && savedScenarios == nil
    }
}

/// Observable backup status, rendered on the profile "Backed up" card.
nonisolated enum SyncState: Equatable, Sendable {
    /// Signed in, nothing has happened yet.
    case idle
    /// A fetch or upload is in flight.
    case syncing
    /// The last sync succeeded at this time.
    case synced(Date)
    /// The last sync failed; the message is learner-facing.
    case failed(String)
    /// Nobody is signed in (or the build has no Supabase configuration).
    case localOnly
}

/// What the signed-in launch gate shows (UX-09). Decided by `CloudSync.launchGate`;
/// ContentView only renders it.
nonisolated enum LaunchGate: Equatable, Sendable {
    /// Logo and spinner: the sign-in reconcile is running inside its budget.
    case loading
    /// The wait passed `Tuning.launchOfflineOfferDelay` with nothing on the device
    /// to show: "Still syncing…" with "Continue offline".
    case stillSyncing
    /// The account could not be read and the device has nothing safe to show.
    case accountUnreachable
    /// The app.
    case ready
}

/// The pure timing rule behind the launch wait (UX-09). A cold launch never
/// blocks on the network for longer than the budget when the device can already
/// show the learner's record; with nothing on the device it keeps waiting, and
/// past the offer delay it offers to continue offline.
nonisolated enum LaunchBudget {
    enum Step: Equatable, Sendable {
        /// Keep the loading screen up.
        case keepWaiting
        /// Open the app on the local record; the reconcile finishes in the background.
        case enterWithLocalRecord
        /// Show "Still syncing…" with "Continue offline".
        case offerOfflineContinue
    }

    /// What the launch wait does `elapsed` seconds into the sign-in reconcile.
    /// `hasUsableLocalRecord` is `CloudSync.canContinueWithoutAccount`.
    static func step(
        elapsed: TimeInterval,
        hasUsableLocalRecord: Bool,
        budget: TimeInterval = Tuning.launchReconcileBudget,
        offerDelay: TimeInterval = Tuning.launchOfflineOfferDelay
    ) -> Step {
        if hasUsableLocalRecord {
            return elapsed >= budget ? .enterWithLocalRecord : .keepWaiting
        }
        return elapsed >= offerDelay ? .offerOfflineContinue : .keepWaiting
    }
}

/// Result of reading the account's snapshot row.
nonisolated enum RemoteFetch: Sendable {
    /// The account has no snapshot row yet (first sign-in).
    case none
    /// The row, decoded, with the server's own `updated_at` when present.
    case snapshot(ProgressSnapshot, serverUpdatedAt: Date?)
    /// The read did not succeed — network, auth, or an unreadable/too-new row.
    /// Never treated as "no data".
    case failed(Error)
}

/// The cloud row was written by a newer app version than this one.
nonisolated struct SchemaTooNew: Error, Sendable {
    let remoteVersion: Int
    let supportedVersion: Int
}

/// The cloud row exists but cannot be decoded by this build (corrupt JSON).
nonisolated struct SnapshotUndecodable: Error, Sendable {
    let underlying: String
}

@MainActor
@Observable
final class CloudSync {
    // MARK: Tunables (values live in Tuning.swift — store-10-4)

    /// Skip a foreground reconcile when the last one finished more recently than this.
    static let foregroundReconcileMinInterval: TimeInterval = Tuning.cloudForegroundReconcileMinInterval
    /// Quiet period after the last local mutation before the snapshot is uploaded.
    /// Deliberately longer than the gap between two answers: a lesson uploads once
    /// when it ends (`AppStore.flushToCloud`) or when the app backgrounds, not once
    /// per answer (store-2-2).
    static let pushDebounce: Duration = .seconds(Tuning.cloudPushDebounce)
    /// Total attempts for one reconcile read before it is reported as failed.
    static let fetchAttempts = Tuning.cloudFetchAttempts
    /// How long a reconcile waits for an upload that is already in flight before
    /// reading the row anyway (store-7-1).
    static let pushSettleTimeout: Duration = .seconds(Tuning.cloudPushSettleTimeout)
    /// Poll interval while one cloud operation waits for another to finish.
    static let pushSettlePoll: Duration = .seconds(Tuning.cloudPushSettlePoll)
    /// Delay before the second read attempt; doubles on each further attempt.
    static let fetchRetryBaseDelay: Duration = .seconds(Tuning.cloudFetchRetryBaseDelay)

    // MARK: Observable state

    /// Backup status for the profile card.
    private(set) var syncState: SyncState = .localOnly
    /// True only while the sign-in / launch reconcile blocks the UI — the UI shows
    /// a loading state and RootView must not decide onboarding until this is
    /// false. Cleared early when the launch budget lets the learner in on their
    /// local record (UX-09); the pass then finishes in the background.
    private(set) var isReconciling = false
    /// The launch wait passed `launchOfflineOfferDelay` with nothing on the
    /// device: the loading screen offers "Continue offline" (UX-09).
    private(set) var offersOfflineContinue = false
    /// The user whose sign-in reconcile has completed (success or failure).
    /// ContentView gates RootView on this matching the signed-in user so the
    /// onboarding decision is never made on pre-reconcile local state.
    private(set) var reconciledUserId: String?
    /// True when the sign-in reconcile could not read the account and the
    /// device holds no local activity — the app has nothing safe to show.
    private(set) var needsAccountBeforeContinuing = false

    /// The user id pushes are allowed for. Set only AFTER the sign-in reconcile
    /// completes so no debounced upload can race the snapshot being applied.
    private(set) var userId: String?

    // MARK: Private

    private var client: SupabaseClient? { SupabaseManager.client }
    private let table = "ios_progress_snapshots"
    private let defaults: UserDefaults
    @ObservationIgnored private var debounceTask: Task<Void, Never>?
    @ObservationIgnored private var hasPendingChange = false
    @ObservationIgnored private var pushInFlight = false
    /// Callers parked inside `pushNow` waiting for the current upload so they can
    /// upload once more if anything is still owed (store-10-3). Non-zero from the moment a caller queues until its own
    /// upload has finished, so it spans the handoff window where `pushInFlight`
    /// is momentarily false but a second upload is about to start — the window
    /// `awaitPushInFlight` must not let a reconcile's read slip through
    /// (store-7-1).
    @ObservationIgnored private var pushWaiters = 0
    /// Bumped every time an upload finishes, successfully or not. A reconcile
    /// records it before its read and abandons the pass when it has moved by the
    /// time the read returns: the row it holds is then older than the markers the
    /// upload has already saved, and that pairing reads as `.applyRemote`
    /// (store-7-1). See `SnapshotReconciler.readRacedAnUpload`.
    @ObservationIgnored private var pushCompletions = 0
    @ObservationIgnored private var reconcileInFlight = false
    @ObservationIgnored private var changeDuringReconcile = false
    @ObservationIgnored private var lastReconcileAt: Date?
    /// The reconcile pass currently running, and the user it runs for. A new
    /// pass awaits it (same user) or cancels it (different user / sign-out).
    @ObservationIgnored private var reconcileTask: Task<Void, Never>?
    @ObservationIgnored private var reconcileTaskUserId: String?
    /// Bumped on every sign-out so a pass that started under a previous user
    /// can recognise it is stale after its network read returns.
    @ObservationIgnored private var userGeneration = 0
    /// Set when the learner left the local-data recovery screen without a restore
    /// (the account was unreachable). The device record is knowingly incomplete,
    /// so every later pass runs as a recovery pass — the account copy wins — until
    /// one actually reads the row (store-1-6). Persisted next to the sync markers,
    /// because the incomplete record outlives the process too (store-4-1).
    private let deferredRestore: DeferredRestoreMarker

    /// UX-09 launch wait. Timings are instance values so tests can shorten them;
    /// the app uses the Tuning values.
    @ObservationIgnored var launchReconcileBudget: TimeInterval = Tuning.launchReconcileBudget
    @ObservationIgnored var launchOfflineOfferDelay: TimeInterval = Tuning.launchOfflineOfferDelay
    /// Test seam: false leaves the wait to be stepped through `launchCheckpoint`
    /// alone, so a test never depends on wall-clock timing. True in the app.
    @ObservationIgnored var runsLaunchTimer = true
    /// The user whose launch wait is running, and the timer that drives it.
    @ObservationIgnored private var launchWaitUserId: String?
    @ObservationIgnored private var launchTimer: Task<Void, Never>?
    /// Set once the learner entered the app while their sign-in pass was still
    /// reading the row. That pass no longer runs behind a blocking screen, so it
    /// loses the exemptions only a blocked pass may have (lesson in progress,
    /// a raced upload).
    @ObservationIgnored private var launchPassInBackgroundFor: String?
    /// Set by an `initial` pass whose read failed for want of a network on a
    /// device with nothing to show; `reconcileAtLaunch` turns it into the
    /// "Continue offline" offer on the unreachable screen (store-11-5).
    @ObservationIgnored private var failedReadOffersOffline = false

    // Sync markers: what this device last agreed with the cloud row on. They
    // are what makes the server-timestamp rule in SnapshotReconciler possible.
    private let markerUserKey = "ff.cloud.lastSyncedUserId.v1"
    private let markerLocalKey = "ff.cloud.lastSyncedLocalUpdatedAt.v1"
    private let markerServerKey = "ff.cloud.lastSyncedServerUpdatedAt.v1"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.deferredRestore = DeferredRestoreMarker(defaults: defaults)
    }

    // MARK: - User lifecycle

    /// Enable (or disable) uploads for a user. Call with the id only after the
    /// sign-in reconcile has completed; call with nil on sign-out. Signing out
    /// also cancels any reconcile still in flight for the previous user and
    /// bumps the user generation so a late-finishing pass can never enable
    /// pushes (or apply a row) for an account that is no longer signed in.
    /// `keepMarkers: true` disables uploads WITHOUT forgetting what this device
    /// last agreed with the cloud row on. Used when the session ended on its own
    /// and the local record is kept: the markers are what makes the server
    /// timestamp the primary tiebreak when the learner signs back in (store-1-1).
    /// A learner-initiated sign-out clears them, because the record they describe
    /// is wiped with it.
    func setUser(_ id: String?, keepMarkers: Bool = false) {
        userId = id
        if id == nil {
            userGeneration += 1
            reconcileTask?.cancel()
            debounceTask?.cancel()
            debounceTask = nil
            hasPendingChange = false
            changeDuringReconcile = false
            reconciledUserId = nil
            needsAccountBeforeContinuing = false
            lastReconcileAt = nil
            endLaunchWait()
            // The record the markers (and a deferred restore) describe survives
            // only when the local record does.
            if !keepMarkers {
                deferredRestore.clear()
                clearMarkers()
            }
            syncState = .localOnly
        }
    }

    /// True when a foreground reconcile is due for `userId`.
    func shouldReconcileOnForeground(userId uid: String, now: Date = Date()) -> Bool {
        guard reconciledUserId == uid, !reconcileInFlight else { return false }
        guard let last = lastReconcileAt else { return true }
        return now.timeIntervalSince(last) >= Self.foregroundReconcileMinInterval
    }

    // MARK: - Launch wait (UX-09)

    /// What the signed-in gate shows for `uid`: loading (or, past the offer delay,
    /// "Still syncing…") until the sign-in reconcile has finished or the launch
    /// budget let the learner in; then the retry screen when the account could not
    /// be read and there is nothing to show, otherwise the app.
    func launchGate(for uid: String) -> LaunchGate {
        if isReconciling || reconciledUserId != uid {
            return offersOfflineContinue && launchWaitUserId == uid ? .stillSyncing : .loading
        }
        return needsAccountBeforeContinuing ? .accountUnreachable : .ready
    }

    /// True when the device holds something the learner can use without the
    /// account: a readable record with activity, or a restore they already
    /// deferred to carry on here (store-1-6). This is exactly the case in which a
    /// FAILED sign-in read lets them in anyway (`needsAccountBeforeContinuing`
    /// stays false), so entering on it before the read returns shows nothing a
    /// slow network would not have shown a minute later — and uploads stay off
    /// until the read succeeds, as they would then.
    func canContinueWithoutAccount(store: AppStore, userId uid: String) -> Bool {
        store.loadError == nil && (store.localUpdatedAt != nil || deferredRestore.isPending(for: uid))
    }

    /// The sign-in / cold-launch reconcile with a budget (UX-09). The pass itself
    /// is the ordinary `initial` pass; alongside it a timer lets a learner who can
    /// continue without the account (`canContinueWithoutAccount`) into the app once
    /// `launchReconcileBudget` has passed, while the read finishes in the
    /// background. A learner with nothing on the device keeps waiting; past
    /// `launchOfflineOfferDelay` the gate offers "Continue offline"
    /// (`continueOfflineAtLaunch`). Returns when the pass has finished.
    func reconcileAtLaunch(store: AppStore, userId uid: String) async {
        endLaunchWait()
        launchWaitUserId = uid
        if runsLaunchTimer {
            let checkpoints = [launchReconcileBudget, launchOfflineOfferDelay].sorted()
            launchTimer = Task { [weak self, weak store] in
                let start = ContinuousClock.now
                for checkpoint in checkpoints {
                    try? await Task.sleep(until: start.advanced(by: .seconds(checkpoint)), clock: .continuous)
                    guard !Task.isCancelled, let self, let store else { return }
                    self.launchCheckpoint(store: store, userId: uid, elapsed: checkpoint)
                }
            }
        }
        failedReadOffersOffline = false
        await reconcile(store: store, userId: uid, initial: true)
        if launchWaitUserId == uid {
            endLaunchWait()
            // store-11-5: a read that failed for want of a network, on a device with
            // nothing to show, keeps "Continue offline" on the unreachable screen.
            offersOfflineContinue = failedReadOffersOffline && needsAccountBeforeContinuing
                && reconciledUserId == uid
        }
        failedReadOffersOffline = false
    }

    /// "Continue offline" on the still-syncing screen. The device holds nothing of
    /// this learner's, so whatever they do before the account is read must never
    /// be compared with — let alone pushed over — the account's real record: a
    /// fresh record is newer than any row and would win the client-clock rule.
    /// The deferred-restore marker (store-1-6 / store-4-1) gives exactly the safe
    /// behaviour: the pass still in flight, and every later one until a read
    /// succeeds, applies the account copy when there is one and uploads the device
    /// copy only into an account that has none (a brand-new learner). A failed read
    /// no longer blocks them either, as for any deferred restore.
    ///
    /// The same choice is offered after the launch read FAILED offline with
    /// nothing on the device (store-11-5): the gate is then the unreachable screen,
    /// and continuing opens the app with uploads still off and the marker set, as
    /// after a failed read behind "Continue offline".
    func continueOfflineAtLaunch(store: AppStore, userId uid: String) {
        guard offersOfflineContinue, store.loadError == nil else { return }
        if launchWaitUserId == uid, isReconciling || reconciledUserId != uid {
            deferredRestore.set(userId: uid)
            enterBeforeReconcileFinishes(userId: uid)
            return
        }
        // store-11-5: the read already failed and the gate shows the unreachable
        // screen. Nothing is in flight; the marker makes the next pass that reads
        // the row a recovery pass, and lets the learner in now.
        guard launchWaitUserId == nil, !isReconciling, reconciledUserId == uid,
              needsAccountBeforeContinuing else { return }
        deferredRestore.set(userId: uid)
        offersOfflineContinue = false
        needsAccountBeforeContinuing = false
        // Once they start, the device does hold their work until they reconnect.
        syncState = .failed(Self.offlineMessage)
    }

    /// One timer checkpoint of the launch wait, `elapsed` seconds in. Acts only
    /// while the gate is still waiting on this user's sign-in pass. Internal so
    /// tests can step the wait without depending on the main actor's timing.
    func launchCheckpoint(store: AppStore, userId uid: String, elapsed: TimeInterval) {
        guard launchWaitUserId == uid, store.loadError == nil,
              isReconciling || reconciledUserId != uid else { return }
        let step = LaunchBudget.step(
            elapsed: elapsed,
            hasUsableLocalRecord: canContinueWithoutAccount(store: store, userId: uid),
            budget: launchReconcileBudget,
            offerDelay: launchOfflineOfferDelay
        )
        switch step {
        case .keepWaiting:
            break
        case .enterWithLocalRecord:
            enterBeforeReconcileFinishes(userId: uid)
        case .offerOfflineContinue:
            offersOfflineContinue = true
        }
    }

    /// Open the gate while the sign-in pass is still reading. Uploads stay
    /// disabled (`userId` is only set once a pass has read the row), and the pass
    /// now applies its result under the same guards as a foreground pass.
    private func enterBeforeReconcileFinishes(userId uid: String) {
        launchPassInBackgroundFor = uid
        offersOfflineContinue = false
        isReconciling = false
        reconciledUserId = uid
    }

    private func endLaunchWait() {
        launchTimer?.cancel()
        launchTimer = nil
        launchWaitUserId = nil
        launchPassInBackgroundFor = nil
        offersOfflineContinue = false
    }

    // MARK: - Reconcile

    /// How a reconcile pass treats the cloud row once it has been read.
    private enum ReconcileMode {
        /// Ordinary pass: `SnapshotReconciler.decide` picks a side.
        case compare
        /// Recovery pass: the cloud row is applied unconditionally because the
        /// device copy is unreadable. `discardUnreadableCopy` says whether the
        /// preserved `.corrupt` blobs are deleted or kept for support.
        /// `requireRemoteRow` marks the pass the learner asked for by tapping
        /// "Restore from my account": an account with no row is then a FAILED
        /// restore, not a first sign-in — nothing is discarded and nothing is
        /// uploaded (store-2-1).
        case takeRemote(discardUnreadableCopy: Bool, requireRemoteRow: Bool)
    }

    /// Shown on the recovery screen when the learner asked to restore and the
    /// account has never been written to.
    static let noAccountBackupMessage =
        "There's no backup in your account yet, so there's nothing to restore. The unreadable copy is still on this device."

    /// Pull the cloud snapshot and reconcile against local state using
    /// `SnapshotReconciler.decide`. `initial` is the sign-in / launch pass: it
    /// blocks the UI (`isReconciling`) and only enables uploads once it has
    /// completed. A foreground pass never blocks and never disables uploads
    /// that were already enabled. A pass already in flight for the same user is
    /// awaited first (never silently dropped); one for a different user is
    /// cancelled.
    func reconcile(store: AppStore, userId uid: String, initial: Bool) async {
        await run(store: store, userId: uid, initial: initial, mode: .compare)
    }

    /// Recovery path for an unreadable device copy (`store.loadError`): read the
    /// account row and apply it unconditionally, bypassing the newer-side rule —
    /// the gutted local state must never be compared with, or pushed over, the
    /// good cloud copy. `discardUnreadableCopy` deletes the preserved corrupt
    /// blobs; `false` keeps them on the device for support. An account with no
    /// row is a failed restore, not a first sign-in: nothing is discarded and
    /// nothing is uploaded, so the only surviving copy of the learner's progress
    /// stays where it is (store-2-1).
    /// Returns true when the store left its recovery state (the row was applied);
    /// on a failed read — or an account with no backup — `store.loadError` is left
    /// set so the recovery screen stays up with the reason and the learner can try
    /// again or continue on the device.
    @discardableResult
    func restoreFromAccount(store: AppStore, userId uid: String, discardUnreadableCopy: Bool) async -> Bool {
        await run(
            store: store,
            userId: uid,
            initial: true,
            mode: .takeRemote(discardUnreadableCopy: discardUnreadableCopy, requireRemoteRow: true)
        )
        return store.loadError == nil
    }

    /// Escape from the recovery screen when the account cannot be reached at all
    /// (offline): the learner keeps using the device with whatever was readable.
    /// The unreadable copy is preserved, uploads stay disabled until a pass
    /// succeeds, and that pass is a recovery pass — the account copy replaces this
    /// device's, so the incomplete record can never be pushed over it (store-1-6).
    func continueWithLocalCopy(store: AppStore, userId uid: String) async {
        // Written to disk BEFORE anything else: the next save rewrites the
        // unreadable blob with what is in memory, so from here on nothing but
        // this marker can tell a relaunch that the device copy is incomplete
        // (store-4-1).
        deferredRestore.set(userId: uid)
        store.acknowledgeLoadError(discard: false)
        await run(
            store: store,
            userId: uid,
            initial: true,
            mode: .takeRemote(discardUnreadableCopy: false, requireRemoteRow: false)
        )
    }

    /// Serialises reconcile passes: waits for the in-flight pass (cancelling it
    /// first when it belongs to another user), then runs this one as a tracked
    /// task so `setUser(nil)` can cancel it.
    private func run(store: AppStore, userId uid: String, initial: Bool, mode: ReconcileMode) async {
        while let inFlight = reconcileTask {
            if reconcileTaskUserId != uid {
                userGeneration += 1
                inFlight.cancel()
            }
            await inFlight.value
        }
        let task = Task { [self] in
            await perform(store: store, userId: uid, initial: initial, mode: mode)
        }
        reconcileTask = task
        reconcileTaskUserId = uid
        await task.value
    }

    private func perform(store: AppStore, userId uid: String, initial: Bool, mode requestedMode: ReconcileMode) async {
        // A deferred restore (store-1-6) turns every ordinary pass into a recovery
        // pass until the account row has actually been read.
        var mode = requestedMode
        let restoreIsOwed = deferredRestore.isPending(for: uid)
        if restoreIsOwed, case .compare = mode {
            mode = .takeRemote(discardUnreadableCopy: false, requireRemoteRow: false)
        }
        defer {
            reconcileInFlight = false
            if initial { isReconciling = false }
            reconcileTask = nil
            reconcileTaskUserId = nil
            // Re-queue a local change that arrived mid-pass. This must run
            // AFTER `reconcileInFlight` is cleared or progressDidChange would
            // just park it again.
            if changeDuringReconcile {
                changeDuringReconcile = false
                progressDidChange(store)
            }
        }
        guard client != nil || fetchOverride != nil else {
            syncState = .failed(SupabaseManager.configurationMessage)
            if initial { reconciledUserId = uid }
            return
        }
        // Corrupt local data: never compare or push until the learner decides
        // (the recovery screen's `restoreFromAccount` is the only way through).
        if case .compare = mode {
            guard store.loadError == nil else {
                syncState = .failed("Local progress needs attention before it can sync.")
                return
            }
        }

        reconcileInFlight = true
        // A launch pass the learner was already let past (UX-09) never puts the
        // loading screen back up.
        if initial, launchPassInBackgroundFor != uid { isReconciling = true }
        let generation = userGeneration

        /// False once the signed-in user changed underneath this pass: nothing
        /// after an await may then touch markers, `userId` or `reconciledUserId`.
        func stillCurrent() -> Bool {
            if !Task.isCancelled && generation == userGeneration { return true }
            if case .syncing = syncState { syncState = .idle }
            return false
        }

        // store-7-1: an upload that started before this pass — a finished lesson
        // calls `AppStore.flushToCloud` — suspends inside `encodeForUpload` BEFORE
        // its UPSERT is issued. Reading now would put this pass's SELECT on the
        // wire ahead of that UPSERT, so it would come back with the PRE-lesson row
        // while the upload's markers (saved before the read returns) already
        // describe the row it wrote. That pairing looks like a clean device
        // holding someone else's row, decides `.applyRemote`, and rolls the
        // lesson the learner just finished off the device. Let the upload land
        // first; the row then agrees with the markers. The debounce is cancelled
        // before the wait so a queued upload cannot slip in behind it.
        debounceTask?.cancel()
        debounceTask = nil
        await awaitPushInFlight()
        guard stillCurrent() else { return }

        // Restored when the pass is abandoned before it changes anything, so the
        // profile card falls back to what it honestly knew rather than sticking
        // on "Backing up…". A pass only runs for a signed-in learner, so the
        // launch's initial "not signed in" reads as "nothing has happened yet"
        // (an abandoned launch pass the learner entered past, UX-09).
        let stateBeforePass: SyncState = syncState == .localOnly ? .idle : syncState
        syncState = .syncing
        let uploadsBeforeRead = pushCompletions

        var fetch = await fetchRemoteWithRetry(userId: uid)
        guard stillCurrent() else { return }
        // UX-09: the exemptions below are for a pass that runs behind the
        // blocking launch screen. Once the launch budget let the learner in, the
        // pass is guarded exactly like a foreground one; an abandoned launch pass
        // has already set `reconciledUserId`, so the foreground / lesson-closed
        // triggers run it again (no `lastReconcileAt` is recorded).
        let blocksTheUI = initial && launchPassInBackgroundFor != uid
        // store-7-1, second half: an upload can still START during the read (a
        // background flush, or a debounced push already past its sleep). If one
        // finished while the read was in flight, the row and the markers describe
        // different moments and nothing this pass could conclude from them is
        // trustworthy. Abandon it WITHOUT recording `lastReconcileAt` so the next
        // trigger runs it again against a row and markers that agree. Sign-in and
        // recovery passes (`initial`) are exempt: uploads are not enabled until
        // they finish, so nothing can push underneath them, and returning here
        // would strand the app on its loading screen.
        if !blocksTheUI,
           SnapshotReconciler.readRacedAnUpload(uploadsBeforeRead: uploadsBeforeRead,
                                                uploadsAfterRead: pushCompletions) {
            // The upload that raced this pass reported its own outcome; only put
            // the card back if it is still showing this pass's "syncing".
            if case .syncing = syncState { syncState = stateBeforePass }
            return
        }
        // store-3-1: callers check `isLessonInProgress` BEFORE this pass starts,
        // but the read above is a full network round trip (up to `fetchAttempts`
        // with backoff) and the learner can tap into a lesson while it is in
        // flight. Applying the row now would swap `gaps`/`concepts` out from under
        // the open lesson: answers already recorded are rolled back and every
        // later one no-ops against an id the remote snapshot does not carry
        // (store-1-3). Abandon the pass WITHOUT recording `lastReconcileAt`, so
        // ContentView's `onChange(of: store.isLessonInProgress)` runs it again the
        // moment the lesson closes. Sign-in / recovery passes (`initial`) are
        // exempt: they run behind a blocking screen, where no lesson can be open.
        if !blocksTheUI, store.isLessonInProgress {
            syncState = stateBeforePass
            return
        }
        // UX-09: "Continue offline" records a deferred restore while this pass's
        // read is in flight. The device copy it guards is a fresh record, newer
        // than any row, so the pass must honour the marker now — comparing would
        // push it over the account's real progress.
        let restoreOwedNow = deferredRestore.isPending(for: uid)
        if restoreOwedNow, case .compare = mode {
            mode = .takeRemote(discardUnreadableCopy: false, requireRemoteRow: false)
        }
        // store-11-1: a recovery pass applies the account copy unconditionally, so a
        // row that holds no learner activity — the empty record every first sign-in
        // uploads — must not count as one. It is handled exactly like an account
        // with no row: a deferred restore pushes the device copy and settles the
        // debt; a restore the learner asked for fails without discarding anything
        // (store-2-1), since there is nothing in the account to restore.
        if case .takeRemote = mode, case .snapshot(let remote, _) = fetch, remote.holdsNoLearnerActivity {
            fetch = .none
        }

        switch fetch {
        case .failed(let error):
            syncState = .failed(Self.message(for: error))
            if initial {
                // Do NOT enable pushes: local state must not overwrite an
                // account we could not read. With nothing local there is
                // nothing safe to show either.
                // ...unless the learner explicitly chose to carry on locally
                // from the recovery screen: re-blocking them there is exactly
                // what that choice opts out of. The deferred-restore marker keeps
                // the recovery pending, so uploads stay disabled and the next
                // successful pass still applies the account copy.
                needsAccountBeforeContinuing = !restoreOwedNow && (store.localUpdatedAt == nil)
                reconciledUserId = uid
                // store-11-5: offline, every attempt fails at once, so the read gives
                // up long before `launchOfflineOfferDelay` and the "Continue offline"
                // offer never appeared: a signed-in learner opening an empty device
                // with no network (a reinstall keeps the session) had only "Try
                // again", under a message claiming progress was on the device. The
                // same choice is offered here, made safe by the same deferred-restore
                // marker (`continueOfflineAtLaunch`), with honest wording.
                failedReadOffersOffline = needsAccountBeforeContinuing && store.loadError == nil
                    && Self.isConnectivityFailure(error)
                if failedReadOffersOffline {
                    syncState = .failed(Self.offlineWithNothingOnDeviceMessage)
                }
            }
            lastReconcileAt = Date()
            return

        case .none:
            if case .takeRemote(let discard, let requireRemoteRow) = mode {
                if requireRemoteRow {
                    // store-2-1: the learner asked to restore from the account and
                    // the account has no row. Discarding the preserved copy and
                    // uploading the gutted record here would destroy the only
                    // remaining evidence of their progress, so the restore simply
                    // fails: the recovery screen stays up and says why.
                    syncState = .failed(Self.noAccountBackupMessage)
                    lastReconcileAt = Date()
                    return
                }
                store.acknowledgeLoadError(discard: discard)
            }
            let ok = await pushNow(store: store, userId: uid)
            guard stillCurrent() else { return }
            lastReconcileAt = Date()
            // The account is empty, so later uploads cannot clobber anything.
            deferredRestore.clear()
            markReconciled(userId: uid, pushSucceeded: ok)

        case .snapshot(let remote, let serverUpdatedAt):
            let decision: SnapshotReconciler.Decision
            switch mode {
            case .takeRemote(let discard, _):
                // Recovery: the account copy is the learner's state, full stop.
                clearMarkers()
                store.acknowledgeLoadError(discard: discard)
                decision = .applyRemote
            case .compare:
                let local = localState(store: store, userId: uid)
                let remoteState = SnapshotReconciler.RemoteState(
                    clientUpdatedAt: remote.clientUpdatedAt,
                    serverUpdatedAt: serverUpdatedAt
                )
                decision = SnapshotReconciler.decide(local: local, remote: remoteState)
            }
            switch decision {
            case .applyRemote:
                // The row was read and is about to replace the device copy: the
                // debt the marker records is settled.
                deferredRestore.clear()
                store.apply(snapshot: remote)
                saveMarkers(userId: uid, localUpdatedAt: store.localUpdatedAt, serverUpdatedAt: serverUpdatedAt)
                hasPendingChange = changeDuringReconcile
                syncState = .synced(Date())
                lastReconcileAt = Date()
                markReconciled(userId: uid)
            case .pushLocal:
                let ok = await pushNow(store: store, userId: uid)
                guard stillCurrent() else { return }
                lastReconcileAt = Date()
                markReconciled(userId: uid, pushSucceeded: ok)
            case .alreadyInSync:
                hasPendingChange = changeDuringReconcile
                syncState = .synced(Date())
                lastReconcileAt = Date()
                markReconciled(userId: uid)
            }
        }
    }

    /// A reconcile pass read the account successfully: uploads are now safe.
    private func markReconciled(userId uid: String, pushSucceeded: Bool = true) {
        needsAccountBeforeContinuing = false
        offersOfflineContinue = false
        reconciledUserId = uid
        userId = uid
        if !pushSucceeded { hasPendingChange = true }
    }

    // MARK: - Writes

    /// Debounced background upload triggered by local mutations.
    func progressDidChange(_ store: AppStore) {
        hasPendingChange = true
        if reconcileInFlight {
            changeDuringReconcile = true
            return
        }
        guard let uid = userId else { return }
        debounceTask?.cancel()
        debounceTask = Task { [weak self, weak store] in
            try? await Task.sleep(for: Self.pushDebounce)
            guard !Task.isCancelled, let self, let store else { return }
            _ = await self.pushNow(store: store, userId: uid)
        }
    }

    /// Upload now if a debounced change is still pending (used on background
    /// and by the profile's retry button). Returns true when nothing was
    /// pending or the upload succeeded. If the sign-in reconcile failed, this
    /// retries the reconcile instead, since pushes are not enabled yet.
    @discardableResult
    func flushPending(store: AppStore) async -> Bool {
        if userId == nil, let uid = reconciledUserId {
            // Never reconcile under an open lesson: `apply(snapshot:)` would swap
            // `gaps`/`concepts` out from under it, losing the answers already
            // recorded and no-oping every later one (store-1-3 / store-2-4). The
            // foreground path guards the same way; this one is reached from the
            // background hook, where a lesson can still be open.
            guard !store.isLessonInProgress else { return false }
            await reconcile(store: store, userId: uid, initial: false)
            return userId != nil
        }
        guard let uid = userId else { return false }
        guard hasPendingChange else {
            // store-3-4: nothing to upload — but the card can still be showing a
            // failure from a READ that failed after the last successful upload.
            // Returning here left "Backup failed — retry" on screen with a Retry
            // button that did nothing at all. Re-establish contact instead; the
            // reconcile is what actually clears (or confirms) the failure.
            guard case .failed = syncState else { return true }
            // A reconcile replaces `gaps`/`concepts`, so never under an open
            // lesson (store-1-3); it runs when the lesson closes.
            guard !store.isLessonInProgress else { return false }
            await reconcile(store: store, userId: uid, initial: false)
            if case .failed = syncState { return false }
            return true
        }
        debounceTask?.cancel()
        debounceTask = nil
        return await pushNow(store: store, userId: uid)
    }

    /// True when signing `uid` in would make `AppStore.beginSession` clear a record
    /// that belongs to ANOTHER account and has not all reached that account
    /// (store-10-2). After a session ends on its own the device keeps the record
    /// and promises it is still there; signing back in with a different account
    /// (Google instead of an Apple "Hide My Email" ID, say) then wiped every answer
    /// that never got uploaded, without a word. The test is the one `pushForSignOut`
    /// uses, read against the sync markers kept for the previous account; a record
    /// the store could not read is never treated as backed up.
    func switchingAccountWouldDiscardUnsyncedProgress(to uid: String, store: AppStore) -> Bool {
        guard let previous = store.lastSignedInUserId, previous != uid else { return false }
        if store.loadError != nil { return true }
        return !SnapshotReconciler.isFullyBackedUp(
            hasPendingChange: hasPendingChange,
            local: localState(store: store, userId: previous)
        )
    }

    /// Unconditional upload used right before sign-out. Returns false when the
    /// account could not be written (or uploads were never enabled), so the
    /// caller can refuse to wipe local state.
    func pushForSignOut(store: AppStore) async -> Bool {
        // store-11-2 (store-3-2 was incomplete): uploads are enabled only once a
        // pass has read the row, so after a launch whose read failed `userId` was
        // nil and a fully backed-up learner was refused here, and one back online
        // with new answers could retry forever without an upload being tried.
        // The backed-up test needs only the markers, as in
        // `switchingAccountWouldDiscardUnsyncedProgress`; anything else first
        // re-establishes contact, as `flushPending` does.
        if userId == nil, let uid = reconciledUserId {
            if store.loadError == nil, !deferredRestore.isPending(for: uid),
               SnapshotReconciler.isFullyBackedUp(
                   hasPendingChange: hasPendingChange,
                   local: localState(store: store, userId: uid)
               ) {
                return true
            }
            // Never reconcile under an open lesson (store-1-3).
            guard !store.isLessonInProgress else { return false }
            await reconcile(store: store, userId: uid, initial: false)
        }
        guard let uid = userId else { return false }
        debounceTask?.cancel()
        debounceTask = nil
        // store-3-2: an offline sign-out was refused — with a warning that unsynced
        // progress would be lost — even when the device was already fully backed
        // up. If nothing is pending AND the record has not moved since the last
        // successful sync with THIS account's row, there is nothing to upload, so
        // the sign-out is safe and must not be blocked by the network.
        if store.loadError == nil,
           SnapshotReconciler.isFullyBackedUp(
               hasPendingChange: hasPendingChange,
               local: localState(store: store, userId: uid)
           ) {
            return true
        }
        return await pushNow(store: store, userId: uid)
    }

    /// Test seam: when set, an upload hands its snapshot here instead of writing
    /// the row through the Supabase client, and the returned string stands in for
    /// the row's `updated_at`. Nil in the app.
    @ObservationIgnored var uploadOverride: (@MainActor (ProgressSnapshot) async throws -> String?)?

    /// Test seam: when set, a reconcile reads the row through this instead of the
    /// Supabase client. Nil in the app.
    @ObservationIgnored var fetchOverride: (@MainActor (String) async -> RemoteFetch)?

    /// Upload the current snapshot. Serialised: a second call while one is in
    /// flight waits for it, then uploads only if the record is still not fully
    /// in the row (store-10-3).
    @discardableResult
    func pushNow(store: AppStore, userId uid: String) async -> Bool {
        guard client != nil || uploadOverride != nil else {
            syncState = .failed(SupabaseManager.configurationMessage)
            return false
        }
        // Never upload a store that could not be read: it is not the learner's state.
        guard store.loadError == nil else {
            syncState = .failed("Local progress needs attention before it can sync.")
            return false
        }
        if pushInFlight {
            // Held across the wait AND the upload this caller goes on to make,
            // so `awaitPushInFlight` keeps waiting through the handoff instead
            // of reading between the two uploads. The `defer` releases it on
            // every exit, cancellation included, so a give-up cannot strand a
            // reconcile on the timeout.
            pushWaiters += 1
            defer { pushWaiters -= 1 }
            while pushInFlight {
                if Task.isCancelled { return false }
                try? await Task.sleep(for: Self.pushSettlePoll)
            }
            // store-10-3: the upload just waited for may already have written
            // everything this caller wanted written. Backgrounding the app sends
            // both `.inactive` and `.background`, so two flushes always overlap;
            // re-uploading the same record unconditionally cost two or three
            // uploads per backgrounding, and a failure of the redundant one left
            // "Backup failed" and a pending change on a device whose row already
            // held everything. Upload again only when something is still owed —
            // the same test `pushForSignOut` uses, so a FAILED upload (markers not
            // moved, record dirty) is still retried here.
            if SnapshotReconciler.isFullyBackedUp(
                hasPendingChange: hasPendingChange,
                local: localState(store: store, userId: uid)
            ) {
                return true
            }
            return await pushNow(store: store, userId: uid)
        }
        pushInFlight = true
        defer {
            pushInFlight = false
            // Counted even when the upload failed: a write can still have reached
            // the row before the response was lost, so a reconcile that read past
            // it must not trust the pairing either (store-7-1).
            pushCompletions &+= 1
        }

        let snapshot = store.makeSnapshot()
        let previous = syncState
        syncState = .syncing
        do {
            // Off the MainActor: the record is a few hundred KB from day one and
            // this runs at the end of every lesson — encoding it on the answer
            // frame is a visible hitch (store-2-2).
            let snapshotJSON = try await Self.encodeForUpload(snapshot)
            let isoTimestamp = ISO8601DateFormatter().string(from: snapshot.clientUpdatedAt)
            let row = SnapshotRow(user_id: uid, snapshot: snapshotJSON, client_updated_at: isoTimestamp)
            let written: UpdatedAtRow
            if let uploadOverride {
                written = UpdatedAtRow(updated_at: try await uploadOverride(snapshot))
            } else if let client {
                written = try await client
                    .from(table)
                    .upsert(row, onConflict: "user_id")
                    .select("updated_at")
                    .single()
                    .execute()
                    .value
            } else {
                throw SupabaseManager.ConfigurationError()
            }
            // store-5-2: `snapshot` was taken BEFORE the round trip, so an answer
            // saved while it was in flight is not in the row that was just
            // written. Clearing the flag unconditionally marked that answer as
            // backed up, and the background flush then skipped it. Only what was
            // actually uploaded counts as synced.
            hasPendingChange = SnapshotReconciler.recordMovedDuringUpload(
                uploaded: snapshot.clientUpdatedAt,
                current: store.localUpdatedAt
            )
            saveMarkers(
                userId: uid,
                localUpdatedAt: snapshot.clientUpdatedAt,
                serverUpdatedAt: PostgresTimestamp.parse(written.updated_at)
            )
            // No unconditional "a caller queued, so something is pending" here:
            // that overrode the store-5-2 answer above and forced a redundant
            // upload of an unchanged record (store-10-3). A queued caller now
            // decides for itself, from the markers just saved.
            syncState = .synced(Date())
            return true
        } catch {
            if error is CancellationError {
                syncState = previous
            } else {
                syncState = .failed(Self.message(for: error))
            }
            return false
        }
    }

    /// Encode the snapshot into the JSON value the row carries, off the main
    /// actor. The encoder is built inside the task so nothing MainActor-isolated
    /// (or non-Sendable) crosses the boundary.
    private nonisolated static func encodeForUpload(_ snapshot: ProgressSnapshot) async throws -> AnyJSON {
        try await Task.detached(priority: .utility) {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(snapshot)
            return try JSONDecoder().decode(AnyJSON.self, from: data)
        }.value
    }

    /// Wait for an upload that is already in flight, so a reconcile never reads
    /// the row while the answers it is about to compare against are still being
    /// encoded (store-7-1). Bounded by `pushSettleTimeout`: if the upload is stuck
    /// on a slow network the read goes ahead and the post-read guard catches it.
    /// `pushWaiters` is part of the condition: a queued caller re-enters
    /// `pushNow` the moment the current upload's `defer` clears `pushInFlight`,
    /// so waiting on `pushInFlight` alone would let this pass leave the wait in
    /// that gap and put its SELECT on the wire while upload #2 runs — exactly
    /// the pairing this wait exists to avoid.
    private func awaitPushInFlight() async {
        guard pushInFlight || pushWaiters > 0 else { return }
        let deadline = ContinuousClock.now.advanced(by: Self.pushSettleTimeout)
        while pushInFlight || pushWaiters > 0, ContinuousClock.now < deadline {
            if Task.isCancelled { return }
            try? await Task.sleep(for: Self.pushSettlePoll)
        }
    }

    // MARK: - Reads

    /// Read the account row. Transient failures are retried with backoff;
    /// an unreadable or newer-schema row is reported immediately.
    private func fetchRemoteWithRetry(userId uid: String) async -> RemoteFetch {
        var delay = Self.fetchRetryBaseDelay
        var attempt = 1
        while true {
            let result = await fetchRemote(userId: uid)
            guard case .failed(let error) = result else { return result }
            let retryable = !(error is SchemaTooNew || error is SnapshotUndecodable || error is CancellationError)
            guard retryable, attempt < Self.fetchAttempts else { return result }
            try? await Task.sleep(for: delay)
            if Task.isCancelled { return .failed(CancellationError()) }
            delay *= 2
            attempt += 1
        }
    }

    /// One read of the account row. `.none` is returned ONLY when the query
    /// succeeded and found no row; every error is `.failed`.
    func fetchRemote(userId uid: String) async -> RemoteFetch {
        if let fetchOverride { return await fetchOverride(uid) }
        guard let client else { return .failed(SupabaseManager.ConfigurationError()) }
        do {
            let rows: [RemoteRow] = try await client
                .from(table)
                // `client_updated_at` is not read: the reconcile compares the
                // snapshot JSON's own `clientUpdatedAt` (store-10-5).
                .select("snapshot, updated_at")
                .eq("user_id", value: uid)
                .limit(1)
                .execute()
                .value
            guard let row = rows.first else { return .none }
            let version = Self.schemaVersion(of: row.snapshot)
            if version > ProgressSnapshot.currentSchemaVersion {
                return .failed(SchemaTooNew(remoteVersion: version, supportedVersion: ProgressSnapshot.currentSchemaVersion))
            }
            do {
                let snapshot = try await Self.decodeDownloaded(row.snapshot)
                return .snapshot(snapshot, serverUpdatedAt: PostgresTimestamp.parse(row.updated_at))
            } catch {
                return .failed(SnapshotUndecodable(underlying: String(describing: error)))
            }
        } catch {
            return .failed(error)
        }
    }

    /// The row's `schemaVersion`, read straight off the JSON value. Parsing the
    /// whole payload again just to reach one Int cost a second full decode of a
    /// few hundred KB on the main actor (store-8-2). A row written before the
    /// field existed reads as version 1.
    private nonisolated static func schemaVersion(of snapshot: AnyJSON) -> Int {
        guard let value = snapshot.objectValue?["schemaVersion"] else { return 1 }
        if let int = value.intValue { return int }
        if let double = value.doubleValue { return Int(double) }
        return 1
    }

    /// Re-encode the row's JSON and decode the snapshot off the main actor. The
    /// record is a few hundred KB carrying thousands of ISO-8601 dates, so doing
    /// this inline stalled Home on every launch and foreground reconcile
    /// (store-8-2). Mirrors `encodeForUpload`: the coders are built inside the
    /// task, since JSONDecoder is not Sendable.
    private nonisolated static func decodeDownloaded(_ snapshot: AnyJSON) async throws -> ProgressSnapshot {
        try await Task.detached(priority: .utility) {
            let data = try JSONEncoder().encode(snapshot)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode(ProgressSnapshot.self, from: data)
        }.value
    }

    // MARK: - Sync markers

    private func localState(store: AppStore, userId uid: String) -> SnapshotReconciler.LocalState {
        guard defaults.string(forKey: markerUserKey) == uid else {
            return SnapshotReconciler.LocalState(updatedAt: store.localUpdatedAt)
        }
        return SnapshotReconciler.LocalState(
            updatedAt: store.localUpdatedAt,
            lastSyncedUpdatedAt: date(forKey: markerLocalKey),
            lastSyncedServerUpdatedAt: date(forKey: markerServerKey)
        )
    }

    private func saveMarkers(userId uid: String, localUpdatedAt: Date?, serverUpdatedAt: Date?) {
        defaults.set(uid, forKey: markerUserKey)
        setDate(localUpdatedAt, forKey: markerLocalKey)
        setDate(serverUpdatedAt, forKey: markerServerKey)
    }

    private func clearMarkers() {
        defaults.removeObject(forKey: markerUserKey)
        defaults.removeObject(forKey: markerLocalKey)
        defaults.removeObject(forKey: markerServerKey)
    }

    private func date(forKey key: String) -> Date? {
        guard let ts = defaults.object(forKey: key) as? Double else { return nil }
        return Date(timeIntervalSince1970: ts)
    }

    private func setDate(_ date: Date?, forKey key: String) {
        if let date {
            defaults.set(date.timeIntervalSince1970, forKey: key)
        } else {
            defaults.removeObject(forKey: key)
        }
    }

    // MARK: - Messages

    /// Learner-facing text for a sync failure.
    static func message(for error: Error) -> String {
        if error is SchemaTooNew {
            return "Your progress was saved by a newer version of Okiri. Update the app to sync."
        }
        if error is SnapshotUndecodable {
            return "Your account backup couldn't be read."
        }
        if error is SupabaseManager.ConfigurationError {
            return SupabaseManager.configurationMessage
        }
        if isConnectivityFailure(error) {
            return offlineMessage
        }
        return "Couldn't reach your account."
    }

    /// A failure to reach the server at all (no network, DNS, timeout), as
    /// opposed to an account that answered with something unusable.
    static func isConnectivityFailure(_ error: Error) -> Bool {
        if error is URLError { return true }
        return (error as NSError).domain == NSURLErrorDomain
    }

    /// The offline failure once the device holds the learner's work.
    static let offlineMessage = "You're offline. Progress stays on this device until you reconnect."

    /// The offline failure on a device that holds nothing yet: "progress stays on
    /// this device" would be false there (store-11-5).
    static let offlineWithNothingOnDeviceMessage =
        "You're offline, so your account can't load yet. You can start on this device now; if your account already has progress, it replaces what you do here once you reconnect."
}

// MARK: - Row DTOs

private nonisolated struct SnapshotRow: Encodable, Sendable {
    let user_id: String
    let snapshot: AnyJSON
    /// Informational column only; nothing reads it back (store-10-5).
    let client_updated_at: String
}

private nonisolated struct RemoteRow: Decodable, Sendable {
    let snapshot: AnyJSON
    let updated_at: String?
}

private nonisolated struct UpdatedAtRow: Decodable, Sendable {
    let updated_at: String?
}
