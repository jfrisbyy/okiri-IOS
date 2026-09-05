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
    // MARK: Tunables (candidates for Tuning.swift — see needsOtherPackage)

    /// Skip a foreground reconcile when the last one finished more recently than this.
    static let foregroundReconcileMinInterval: TimeInterval = 60
    /// Quiet period after the last local mutation before the snapshot is uploaded.
    static let pushDebounce: Duration = .milliseconds(1_500)
    /// Total attempts for one reconcile read before it is reported as failed.
    static let fetchAttempts = 3
    /// Delay before the second read attempt; doubles on each further attempt.
    static let fetchRetryBaseDelay: Duration = .milliseconds(500)

    // MARK: Observable state

    /// Backup status for the profile card.
    private(set) var syncState: SyncState = .localOnly
    /// True only during the sign-in / launch reconcile — the UI shows a loading
    /// state and RootView must not decide onboarding until this is false.
    private(set) var isReconciling = false
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
    @ObservationIgnored private var pushRequestedWhileInFlight = false
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

    // Sync markers: what this device last agreed with the cloud row on. They
    // are what makes the server-timestamp rule in SnapshotReconciler possible.
    private let markerUserKey = "ff.cloud.lastSyncedUserId.v1"
    private let markerLocalKey = "ff.cloud.lastSyncedLocalUpdatedAt.v1"
    private let markerServerKey = "ff.cloud.lastSyncedServerUpdatedAt.v1"

    private static let isoEncoder: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }()
    private static let isoDecoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    // MARK: - User lifecycle

    /// Enable (or disable) uploads for a user. Call with the id only after the
    /// sign-in reconcile has completed; call with nil on sign-out. Signing out
    /// also cancels any reconcile still in flight for the previous user and
    /// bumps the user generation so a late-finishing pass can never enable
    /// pushes (or apply a row) for an account that is no longer signed in.
    func setUser(_ id: String?) {
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
            clearMarkers()
            syncState = .localOnly
        }
    }

    /// True when a foreground reconcile is due for `userId`.
    func shouldReconcileOnForeground(userId uid: String, now: Date = Date()) -> Bool {
        guard reconciledUserId == uid, !reconcileInFlight else { return false }
        guard let last = lastReconcileAt else { return true }
        return now.timeIntervalSince(last) >= Self.foregroundReconcileMinInterval
    }

    // MARK: - Reconcile

    /// How a reconcile pass treats the cloud row once it has been read.
    private enum ReconcileMode {
        /// Ordinary pass: `SnapshotReconciler.decide` picks a side.
        case compare
        /// Recovery pass: the cloud row is applied unconditionally because the
        /// device copy is unreadable. `discardUnreadableCopy` says whether the
        /// preserved `.corrupt` blobs are deleted or kept for support.
        case takeRemote(discardUnreadableCopy: Bool)
    }

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
    /// blobs; `false` keeps them on the device for support. When the account
    /// has no row yet, the device state is uploaded as on any first sign-in.
    /// Returns true when the store left its recovery state (row applied, or no
    /// row to restore); on a failed read `store.loadError` is left set so the
    /// recovery screen stays up and the learner can try again.
    @discardableResult
    func restoreFromAccount(store: AppStore, userId uid: String, discardUnreadableCopy: Bool) async -> Bool {
        await run(store: store, userId: uid, initial: true, mode: .takeRemote(discardUnreadableCopy: discardUnreadableCopy))
        return store.loadError == nil
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

    private func perform(store: AppStore, userId uid: String, initial: Bool, mode: ReconcileMode) async {
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
        guard client != nil else {
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
        if initial { isReconciling = true }
        syncState = .syncing
        debounceTask?.cancel()
        debounceTask = nil
        let generation = userGeneration

        /// False once the signed-in user changed underneath this pass: nothing
        /// after an await may then touch markers, `userId` or `reconciledUserId`.
        func stillCurrent() -> Bool {
            if !Task.isCancelled && generation == userGeneration { return true }
            if case .syncing = syncState { syncState = .idle }
            return false
        }

        let fetch = await fetchRemoteWithRetry(userId: uid)
        guard stillCurrent() else { return }

        switch fetch {
        case .failed(let error):
            syncState = .failed(Self.message(for: error))
            if initial {
                // Do NOT enable pushes: local state must not overwrite an
                // account we could not read. With nothing local there is
                // nothing safe to show either.
                needsAccountBeforeContinuing = (store.localUpdatedAt == nil)
                reconciledUserId = uid
            }
            lastReconcileAt = Date()
            return

        case .none:
            if case .takeRemote(let discard) = mode {
                store.acknowledgeLoadError(discard: discard)
            }
            let ok = await pushNow(store: store, userId: uid)
            guard stillCurrent() else { return }
            lastReconcileAt = Date()
            // The account is empty, so later uploads cannot clobber anything.
            markReconciled(userId: uid, pushSucceeded: ok)

        case .snapshot(let remote, let serverUpdatedAt):
            let decision: SnapshotReconciler.Decision
            switch mode {
            case .takeRemote(let discard):
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
            await reconcile(store: store, userId: uid, initial: false)
            return userId != nil
        }
        guard let uid = userId else { return false }
        guard hasPendingChange else { return true }
        debounceTask?.cancel()
        debounceTask = nil
        return await pushNow(store: store, userId: uid)
    }

    /// Unconditional upload used right before sign-out. Returns false when the
    /// account could not be written (or uploads were never enabled), so the
    /// caller can refuse to wipe local state.
    func pushForSignOut(store: AppStore) async -> Bool {
        guard let uid = userId else { return false }
        debounceTask?.cancel()
        debounceTask = nil
        return await pushNow(store: store, userId: uid)
    }

    /// Upload the current snapshot. Serialised: a second call while one is in
    /// flight waits for it and then uploads once more.
    @discardableResult
    func pushNow(store: AppStore, userId uid: String) async -> Bool {
        guard let client else {
            syncState = .failed(SupabaseManager.configurationMessage)
            return false
        }
        // Never upload a store that could not be read: it is not the learner's state.
        guard store.loadError == nil else {
            syncState = .failed("Local progress needs attention before it can sync.")
            return false
        }
        if pushInFlight {
            pushRequestedWhileInFlight = true
            while pushInFlight {
                if Task.isCancelled { return false }
                try? await Task.sleep(for: .milliseconds(50))
            }
            return await pushNow(store: store, userId: uid)
        }
        pushInFlight = true
        defer { pushInFlight = false }

        let snapshot = store.makeSnapshot()
        let previous = syncState
        syncState = .syncing
        do {
            let data = try Self.isoEncoder.encode(snapshot)
            let snapshotJSON = try JSONDecoder().decode(AnyJSON.self, from: data)
            let isoTimestamp = ISO8601DateFormatter().string(from: snapshot.clientUpdatedAt)
            let row = SnapshotRow(user_id: uid, snapshot: snapshotJSON, client_updated_at: isoTimestamp)
            let written: UpdatedAtRow = try await client
                .from(table)
                .upsert(row, onConflict: "user_id")
                .select("updated_at")
                .single()
                .execute()
                .value
            hasPendingChange = false
            saveMarkers(
                userId: uid,
                localUpdatedAt: snapshot.clientUpdatedAt,
                serverUpdatedAt: PostgresTimestamp.parse(written.updated_at)
            )
            syncState = .synced(Date())
            if pushRequestedWhileInFlight {
                pushRequestedWhileInFlight = false
                hasPendingChange = true
            }
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
        guard let client else { return .failed(SupabaseManager.ConfigurationError()) }
        do {
            let rows: [RemoteRow] = try await client
                .from(table)
                .select("snapshot, client_updated_at, updated_at")
                .eq("user_id", value: uid)
                .limit(1)
                .execute()
                .value
            guard let row = rows.first else { return .none }
            let data = try JSONEncoder().encode(row.snapshot)

            let probe = try? JSONDecoder().decode(SchemaProbe.self, from: data)
            let version = probe?.schemaVersion ?? 1
            if version > ProgressSnapshot.currentSchemaVersion {
                return .failed(SchemaTooNew(remoteVersion: version, supportedVersion: ProgressSnapshot.currentSchemaVersion))
            }
            do {
                let snapshot = try Self.isoDecoder.decode(ProgressSnapshot.self, from: data)
                return .snapshot(snapshot, serverUpdatedAt: PostgresTimestamp.parse(row.updated_at))
            } catch {
                return .failed(SnapshotUndecodable(underlying: String(describing: error)))
            }
        } catch {
            return .failed(error)
        }
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
        let ns = error as NSError
        if ns.domain == NSURLErrorDomain {
            return "You're offline. Progress stays on this device until you reconnect."
        }
        return "Couldn't reach your account."
    }
}

// MARK: - Row DTOs

private nonisolated struct SnapshotRow: Encodable, Sendable {
    let user_id: String
    let snapshot: AnyJSON
    let client_updated_at: String
}

private nonisolated struct RemoteRow: Decodable, Sendable {
    let snapshot: AnyJSON
    let client_updated_at: String?
    let updated_at: String?
}

private nonisolated struct UpdatedAtRow: Decodable, Sendable {
    let updated_at: String?
}

private nonisolated struct SchemaProbe: Decodable, Sendable {
    let schemaVersion: Int?
}
