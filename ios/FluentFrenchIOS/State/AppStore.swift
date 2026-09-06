//
//  AppStore.swift
//  FluentFrenchIOS
//
//  Central observable state: gaps, errors, learner ability (IRT), persistence,
//  and the computed analytics the UI reads (schedule, retention, streak).
//

import SwiftUI

/// Why a persisted blob could not be read at launch. The raw blob is always kept
/// under "<key>.corrupt" so nothing is lost. A BLOCKING error (learner progress:
/// gaps, skills, mistakes) also stops every write and push and puts the UI in a
/// recovery state until `AppStore.acknowledgeLoadError(discard:)` is called. A
/// non-blocking one (preferences, practice history) only starts that blob over
/// from defaults and surfaces a dismissible notice — a lost plan preference must
/// never force a cloud restore that discards real learning (store-1-5).
nonisolated enum StoreLoadError: Error, Equatable {
    case corruptGaps
    case corruptConcepts
    case corruptErrors
    case corruptPreferences
    case corruptActivityProgress

    /// User-facing description of what could not be read.
    var message: String {
        switch self {
        case .corruptGaps: return "Your saved words couldn't be read from this device."
        case .corruptConcepts: return "Your skill progress couldn't be read from this device."
        case .corruptErrors: return "Your mistake history couldn't be read from this device."
        case .corruptPreferences: return "Your plan preferences couldn't be read from this device."
        case .corruptActivityProgress: return "Your practice history couldn't be read from this device."
        }
    }

    /// True when the unreadable blob holds the learner's actual record, so the app
    /// must not continue on a gutted copy. Preferences and practice history are
    /// low-stakes: they start over from defaults behind a notice.
    var isBlocking: Bool {
        switch self {
        case .corruptGaps, .corruptConcepts, .corruptErrors: return true
        case .corruptPreferences, .corruptActivityProgress: return false
        }
    }
}

/// Calendar-correct "yyyy-MM-dd" day keys (no 86 400-second arithmetic, so streaks and
/// day buckets survive DST transitions). Locale-independent by construction.
nonisolated enum DayKey {
    static func key(for date: Date, calendar: Calendar) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// Start of the day a key names, in the calendar's time zone.
    static func date(from key: String, calendar: Calendar) -> Date? {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }
}

@MainActor
@Observable
final class AppStore {
    var gaps: [GapItem] = []
    var concepts: [Concept] = []
    var errors: [ErrorRecord] = []
    var abilityTheta: Double = Tuning.defaultAbilityTheta
    /// ISO "yyyy-MM-dd" days the learner answered at least one item correctly — a
    /// PRACTICE record, not a mastery one (a gap is mastered by `Tuning.gapMasteryStreak`
    /// correct answers in a row, which this never checks). The streak surfaces say so.
    /// The stored key and the cloud field keep the historical `masteryDays` name.
    var masteryDays: Set<String> = []
    var hasCompletedAssessment: Bool = false
    var assessedLevel: CEFRLevel = .A1
    /// Monotonic counter incremented per lesson; used to damp recently-taught concepts.
    var sessionIndex: Int = 0
    /// The learner's plan constraints (the "floor"). Nil until onboarding sets it.
    var preferences: UserPreferences? = nil
    var hasSetPreferences: Bool { preferences != nil }

    /// Minutes practiced per activity, keyed "yyyy-MM-dd|modality" (today's plan progress).
    /// Pruned beyond `Tuning.activityHistoryDays`; lifetime totals live in `lifetimeMinutes`.
    var activityProgress: [String: Int] = [:]
    /// Cumulative minutes ever practiced per modality (never pruned; feeds readiness).
    var lifetimeMinutes: [String: Int] = [:]
    /// Lesson minutes per day, keyed "yyyy-MM-dd" (lessons are not a `LearningModality`).
    var lessonMinutes: [String: Int] = [:]
    /// Cumulative lesson minutes ever credited (never pruned).
    var totalLessonMinutes: Int = 0
    /// Lessons completed (not abandoned) per day, keyed "yyyy-MM-dd".
    var lessonsCompletedByDay: [String: Int] = [:]
    /// Count of gaps captured since the last consolidated lesson was offered (trigger).
    var gapsSinceLastLesson: Int = 0
    /// Lessons completed since the last capstone quiz (capstone cadence).
    var lessonsSinceCapstone: Int = 0

    /// Experience points. Real and persisted: awarded per correct answer
    /// (`Tuning.xpPerCorrect`, the lesson calls `awardXP`) and per completed lesson.
    var xp: Int = 0
    /// Personal bests keyed by lesson kind (`LessonBestKind.rawValue`).
    var personalBests: [String: LessonBest] = [:]

    /// Today's plan of record (D14): computed once per day and cached so Home never
    /// re-rolls the plan mid-day. `dailyPlanDayKey` says which day it belongs to.
    var dailyPlanOfRecord: DailyPlan? = nil
    var dailyPlanDayKey: String? = nil

    /// Set when a persisted blob holding the learner's record could not be read at
    /// launch (see `StoreLoadError.isBlocking`). While non-nil, `save()`/`flush()`
    /// refuse to write and nothing is pushed to the cloud.
    var loadError: StoreLoadError? = nil
    /// Low-stakes blobs that could not be read at launch (preferences, practice
    /// history). They start over from defaults, the app keeps working, and the UI
    /// shows a dismissible notice; the unreadable copy is preserved either way.
    private(set) var loadNotices: [StoreLoadError] = []
    /// One learner-facing sentence for `loadNotices`, or nil when there is nothing to say.
    var loadNoticeMessage: String? {
        guard !loadNotices.isEmpty else { return nil }
        return loadNotices.map { $0.message }.joined(separator: " ")
            + " Your words, skills and mistake history are unaffected."
    }
    /// True when the store may be serialized and pushed (no unresolved load error).
    var canPushToCloud: Bool { loadError == nil }

    /// True while the learner is inside a lesson. The foreground reconcile checks
    /// this: replacing `gaps`/`concepts` mid-lesson would silently discard every
    /// answer already recorded and make the rest of the lesson no-op (store-1-3).
    private(set) var isLessonInProgress = false

    /// The account whose record is on this device, remembered across launches.
    /// A wipe only happens when a DIFFERENT learner signs in — an involuntary
    /// sign-out (expired/revoked refresh token) must never destroy unsynced
    /// progress (store-1-2).
    private(set) var lastSignedInUserId: String? = nil

    /// Timestamp of the last real, user-driven mutation. Drives newest-wins cloud
    /// reconciliation. Nil until the learner has actually changed something.
    var localUpdatedAt: Date? = nil

    /// Trace of every selection that became a lesson (mode, target, item roles).
    /// In-memory instrumentation; not part of the persisted snapshot.
    var selectionLog = SelectionLog()

    /// Rolling outcomes of the last `Tuning.governorWindow` check-ins (true = pass).
    /// The retention governor reads this (Pass 3 F6). Persisted locally.
    var checkInHistory: [Bool] = []
    /// Modalities that have EVER read as unlocked. The governor holds the gate on
    /// anything not in here; it never re-locks what was already opened.
    var unlockedModalities: Set<String> = []
    /// Per-lesson engine metric snapshots (Package B14), capped. Persisted locally.
    var metricsLog = MetricsLog()
    /// When the learner's record started (first placement or first lesson).
    var journeyStartedAt: Date? = nil
    /// Where probe content comes from (B13): the bundled content by default;
    /// tests inject synthetic probes here. Not observable state.
    @ObservationIgnored var probeContent: (String) -> [FoundationProbeContent] = { FoundationContentLoader.probes(for: $0) }

    /// Cloud backup coordinator. Set once the learner is signed in; nil otherwise.
    /// Mutations notify it (debounced) so the cloud always holds the latest.
    weak var cloud: CloudSync?

    // MARK: - Package C stored state (edit only inside this block)
    // (lesson-loop stored properties go here)

    // MARK: - Package D-home stored state (edit only inside this block)
    // (Home screen / daily plan / gate stored properties go here)

    // MARK: - Package D-flow stored state (edit only inside this block)
    /// Where the Foundation curriculum comes from (D3): the bundled content by
    /// default; tests inject a file loaded from an explicit URL. Not observable state.
    @ObservationIgnored var foundationContent: (Date) -> [GapItem] = { FoundationContentLoader.gaps(now: $0) }

    // MARK: - Package E-read stored state (edit only inside this block)
    /// The tail of the tagging queue (E3): every `tagConcept(for:)` request awaits
    /// the previous one, so each sees the concepts the last may have created.
    @ObservationIgnored private var tagChain: Task<Void, Never>? = nil
    /// The matcher `tagConcept(for:)` runs. Defaults to `ConceptTagger` (AI when a
    /// key is present, on-device heuristic otherwise); tests inject a fake.
    @ObservationIgnored var conceptTagger: @MainActor (GapItem, [Concept], [String: String]) async -> ConceptTagResult? = { gap, concepts, lexicon in
        await ConceptTagger.tag(gap: gap, concepts: concepts, lexicon: lexicon)
    }
    /// Headword → concept map built from the bundled content the first time the
    /// tagger needs it (`HeuristicTagger.lexicon(from:)`); tests inject their own.
    @ObservationIgnored var tagLexiconProvider: () -> [String: String] = { HeuristicTagger.lexicon(from: FoundationContentLoader.file) }
    @ObservationIgnored private var cachedTagLexicon: [String: String]? = nil
    /// True while `resolvePendingTranslations(using:)` is running (re-entrancy guard).
    @ObservationIgnored private(set) var isResolvingTranslations = false

    /// How many times each pending gap's translation has been asked for and come
    /// back unusable. Transient (this session only): it exists so a term the
    /// service reliably chokes on sinks to the back of the retry queue instead of
    /// sitting at its head forever.
    @ObservationIgnored private(set) var translationAttempts: [String: Int] = [:]

    // MARK: - Package E-talk stored state (edit only inside this block)
    // (converse / speaking stored properties go here)

    // MARK: - Package E-media stored state (edit only inside this block)
    // (listening / watching stored properties go here)

    /// Calendar used for every day key (streaks, activity buckets). Injectable so
    /// tests can pin a time zone and walk a DST transition.
    var calendar: Calendar = .current

    private let gapsKey = "ff.gaps.v1"
    private let conceptsKey = "ff.concepts.v1"
    private let errorsKey = "ff.errors.v1"
    private let thetaKey = "ff.theta.v1"
    private let masteryKey = "ff.masteryDays.v1"
    private let assessmentKey = "ff.assessmentDone.v1"
    private let levelKey = "ff.assessedLevel.v1"
    private let sessionKey = "ff.sessionIndex.v1"
    private let preferencesKey = "ff.preferences.v1"
    private let activityProgressKey = "ff.activityProgress.v1"
    private let lifetimeMinutesKey = "ff.lifetimeMinutes.v1"
    private let lessonMinutesKey = "ff.lessonMinutes.v1"
    private let totalLessonMinutesKey = "ff.totalLessonMinutes.v1"
    private let lessonsCompletedKey = "ff.lessonsCompleted.v1"
    private let gapsSinceLessonKey = "ff.gapsSinceLesson.v1"
    private let lessonsSinceCapstoneKey = "ff.lessonsSinceCapstone.v1"
    private let localUpdatedAtKey = "ff.localUpdatedAt.v1"
    private let xpKey = "ff.xp.v1"
    private let personalBestsKey = "ff.personalBests.v1"
    /// v2: the plan of record is stored as `DailyPlan` itself (Codable); the v1
    /// key held a private mirror and is left to expire — a stale cache only.
    private let dailyPlanKey = "ff.dailyPlan.v2"
    private let dailyPlanDayKey_ = "ff.dailyPlanDay.v1"
    private let checkInHistoryKey = "ff.checkInHistory.v1"
    private let unlockedModalitiesKey = "ff.unlockedModalities.v1"
    private let metricsLogKey = "ff.metricsLog.v1"
    private let journeyStartedAtKey = "ff.journeyStartedAt.v1"
    private let lastSignedInUserKey = "ff.lastSignedInUserId.v1"
    /// Suffix under which an unreadable blob is preserved (never overwritten).
    private let corruptSuffix = ".corrupt"

    /// Where state persists. `nil` means in-memory only: nothing is read from or
    /// written to UserDefaults. The headless driver and tests use that so the
    /// REAL engine runs on synthetic gaps/concepts without touching a device.
    private let persistence: UserDefaults?

    // Coalesced persistence (A9): `save()` only marks the store dirty and schedules a
    // write; `flush()` performs it. The cloud push rides on the flush.
    @ObservationIgnored private var isDirty = false
    @ObservationIgnored private var pendingCloudPush = false
    @ObservationIgnored private var saveTask: Task<Void, Never>? = nil

    init(persistence: UserDefaults? = .standard) {
        self.persistence = persistence
        load()
    }

    // MARK: - Derived collections

    /// Learner-facing gaps: unmastered and not a probe (A13). Every list, count,
    /// deck and retention surface reads this one, so probes never show up as
    /// cards or inflate an "active gaps" number.
    var activeGaps: [GapItem] {
        gaps.filter { !$0.isMastered && !$0.isProbe }
    }

    /// Alias of `activeGaps` kept for call sites written against the earlier name.
    var visibleGaps: [GapItem] { activeGaps }

    /// Active gaps the learner has actually been asked at least once. Day one seeds
    /// the whole Foundation slice, so `activeGaps` is hundreds of items the learner
    /// has never met — counts that claim to describe the LEARNER (weak spots,
    /// practice history) read this, and counts that describe the CURRICULUM AHEAD
    /// read `newGaps`. Same split GapsView and Retention already draw.
    var practisedGaps: [GapItem] { activeGaps.filter { !$0.isNew } }

    /// Active gaps never yet answered — seeded curriculum, not diagnosed weaknesses.
    var newGaps: [GapItem] { activeGaps.filter { $0.isNew } }

    /// Every unmastered gap INCLUDING probe items — the opt-in evidence view the
    /// selector and concept bookkeeping use. Views must not list or count this.
    var evidenceGaps: [GapItem] {
        gaps.filter { !$0.isMastered }
    }

    var masteredGaps: [GapItem] {
        gaps.filter { $0.isMastered && !$0.isProbe }
    }

    /// Mastered gaps whose FSRS schedule wants a check now (due, or recall below
    /// `Tuning.masteredRecallFloor`). Mastery is a badge, not retirement (B3).
    func dueMasteredGaps(at now: Date) -> [GapItem] {
        masteredGaps.filter { $0.isDueForMasteryCheck(at: now) }
    }

    /// Everything the schedule can offer right now — the evidence view (probes
    /// included, see `evidenceGaps`) of every unmastered gap plus the mastered
    /// gaps due for a check. The selector's pools read this, never `activeGaps`,
    /// so mastered material comes back when FSRS says it should.
    func schedulableGaps(at now: Date) -> [GapItem] {
        gaps.filter { $0.isPracticable(at: now) }
    }

    func gaps(in category: GapCategory) -> [GapItem] {
        visibleGaps.filter { $0.category == category }
    }

    // MARK: - Concept helpers

    func concept(_ id: String?) -> Concept? {
        guard let id else { return nil }
        return concepts.first { $0.id == id }
    }

    func gaps(forConcept id: String) -> [GapItem] {
        gaps.filter { $0.conceptId == id }
    }

    /// Concepts that list `id` as a prerequisite (its direct dependents).
    func dependents(of id: String) -> [Concept] {
        concepts.filter { $0.prerequisites.contains(id) }
    }

    func arePrerequisitesMet(_ concept: Concept) -> Bool {
        concept.prerequisites.allSatisfy { pid in
            self.concept(pid)?.isMastered ?? false
        }
    }

    /// Capture a freshly built gap and kick off background concept tagging.
    func addGap(_ gap: GapItem) {
        gaps.insert(gap, at: 0)
        gapsSinceLastLesson += 1
        save()
        tagConcept(for: gap.id)
    }

    /// True when the content has at least one usable diagnostic probe for a concept.
    func hasProbeContent(for conceptId: String) -> Bool {
        !probeContent(conceptId).isEmpty
    }

    /// Give a blind-spot probe (or a gap-less check-in) a gap record to be scored
    /// against. The selector decides THAT a concept is probed; this only creates (or
    /// reuses) the one-item diagnostic so its answer lands on the concept like any
    /// other evidence. The item is a REAL French multiple-choice probe from the
    /// content's `probes` (B13): `frenchWord` is the prompt, `englishTranslation`
    /// the answer and `probeOptions` the distractors. Returns nil — and creates
    /// nothing — when the concept has no probe content.
    @discardableResult
    func materializeProbeGap(id: String, for concept: Concept, now: Date = Date()) -> GapItem? {
        if let existing = gaps.first(where: { $0.id == id }) { return existing }
        let probes = probeContent(concept.id)
        guard !probes.isEmpty else { return nil }
        // Rotate through the concept's probes across sessions so a re-probe is not
        // the same item again.
        let content = probes[((sessionIndex % probes.count) + probes.count) % probes.count]
        var probe = GapItem(
            id: id,
            frenchWord: content.fr,
            englishTranslation: content.en,
            explanation: concept.description,
            exampleSentence: content.ex,
            exampleTranslation: content.exEn,
            pronunciation: nil,
            sourceType: .foundation,
            category: concept.category,
            difficulty: .okay,
            reviewCount: 0,
            consecutiveCorrect: 0,
            lastReviewedAt: nil,
            nextReviewAt: now,
            masteredAt: nil,
            createdAt: now,
            cefrLevel: concept.cefrLevel,
            easeFactor: 2.5,
            currentInterval: 0,
            irtDifficulty: Tuning.irtDifficulty(for: concept.cefrLevel),
            fsrs: nil,
            originalContext: nil,
            confusionLinks: [],
            conceptId: concept.id
        )
        probe.isProbe = true
        probe.probeOptions = content.options
        // Like every gap the store creates, a probe starts with a schedule (B4).
        probe.fsrs = FSRS.makeInitialState(grade: .again, now: now)
        probe.fsrs?.dueAt = now
        gaps.insert(probe, at: 0)
        return probe
    }

    // MARK: - Selection (one request in, one output out)

    /// The learner's level as the ONE ranker sees it (IRT ability → CEFR band).
    /// Surfaces that gate by level read this; none derive their own.
    var learnerLevel: CEFRLevel {
        ConceptSelector(store: self).learnerLevel()
    }

    /// Resolve a declared intent into the candidate gap ids of a scoped request.
    /// This is the only place candidate sets are built — never in a View. The
    /// selector still applies eligibility, ordering, reasons and the size cap.
    func candidateGapIds(for scope: SelectionScope, now: Date = Date()) -> [String] {
        let pool: [GapItem]
        switch scope {
        case .category(let category):
            pool = gaps(in: category)
        case .dueInCategory(let category):
            // The same pool Home's category cards count ("Due now", D13): unmastered
            // gaps at or past their review plus mastered gaps due for a check.
            pool = dueNow(at: now).filter { $0.category == category }
        case .reviewQueue:
            pool = reviewQueue(at: now)
        case .critical:
            pool = criticalGaps(at: now)
        case .dueNow:
            pool = dueNow(at: now)
        case .mixed:
            pool = visibleGaps
        case .retention(let bucket):
            let buckets = retention(at: now)
            switch bucket {
            case .atRisk: pool = buckets.atRisk
            case .fading: pool = buckets.fading
            case .fresh: pool = buckets.fresh
            // "Review these now" on the Mastered tab checks only what the schedule
            // wants back; mastered gaps at high recall are not re-drilled (B3).
            case .mastered: pool = dueMasteredGaps(at: now)
            // Never-reviewed gaps: practicable as a scope (a learner may tap into the
            // list), taught in due order — the stagger's first batch leads (D3/B4).
            case .new: pool = buckets.new.sorted { $0.nextReviewAt < $1.nextReviewAt }
            }
        case .errorPattern(let id):
            let records = errorPatterns.first(where: { $0.id == id })?.records ?? []
            let ids = Set(records.map { $0.gapId })
            pool = gaps.filter { ids.contains($0.id) }
        case .gapIds(let ids, _):
            return ids
        }
        return pool.map { $0.id }
    }

    /// The scoped request for a declared intent (label included).
    func selectionRequest(for scope: SelectionScope, now: Date = Date()) -> SelectionRequest {
        var name = scope.name
        if case .errorPattern(let id) = scope, let pattern = errorPatterns.first(where: { $0.id == id }) {
            name = pattern.conceptLabel
        }
        return SelectionRequest(mode: .scoped(candidateGapIds: candidateGapIds(for: scope, now: now)),
                                now: now, scopeName: name)
    }

    /// Post-lesson bookkeeping for the Update/Expand stage: advance the session
    /// counter, damp the concept just taught, keep the capstone cadence, then
    /// recompute frontier unlocks. Returns the names of newly selectable concepts
    /// so the UI can celebrate "New: ready for X". Lives here — not in a View — so
    /// the headless driver runs the same loop the app does.
    ///
    /// `abandoned` with `answered > 0` runs the same bookkeeping (evidence was
    /// gathered) but awards no completion XP and does not count as a lesson done
    /// today; abandoned with nothing answered is a no-op. The lesson trigger
    /// (`markLessonOffered`) is reset here, and the write is flushed immediately.
    @discardableResult
    func completeLesson(targetConceptId: String?, isCapstone: Bool, abandoned: Bool = false,
                        answered: Int = 0, now: Date = Date()) -> [String] {
        if abandoned && answered <= 0 { return [] }
        sessionIndex += 1
        if journeyStartedAt == nil { journeyStartedAt = now }
        if let targetConceptId,
           let idx = concepts.firstIndex(where: { $0.id == targetConceptId }) {
            concepts[idx].lastTaughtSession = sessionIndex
            // Stall bookkeeping (B14/B15): a target lesson that left the concept in
            // the state it was selected in counts as an attempt; a state change resets.
            let stateNow = concepts[idx].state
            if let before = concepts[idx].lastTaughtState, before == stateNow {
                concepts[idx].stallAttempts += 1
            } else {
                concepts[idx].stallAttempts = 0
            }
            concepts[idx].lastTaughtState = stateNow
        }
        // Capstone resets the cadence counter; normal lessons advance it.
        if isCapstone {
            lessonsSinceCapstone = 0
        } else {
            lessonsSinceCapstone += 1
        }
        if !abandoned {
            let key = dayKey(now)
            lessonsCompletedByDay[key] = (lessonsCompletedByDay[key] ?? 0) + 1
            xp += Tuning.xpPerLessonComplete + (isCapstone ? Tuning.xpCapstoneBonus : 0)
        }
        markLessonOffered()
        clearUnlockFlags()
        let unlocked = expandFrontier()
        refreshUnlocks(now: now)
        pruneHistory(now: now)
        metricsLog.record(metricsSnapshot(now: now))
        save()
        flushToCloud()
        return unlocked
    }

    /// The pipeline calls this when a selection becomes a lesson: remember the
    /// target's state so `completeLesson` can tell whether the lesson moved it (B15).
    func noteLessonSelected(_ output: SelectionOutput) {
        guard let targetId = output.targetConceptId,
              let idx = concepts.firstIndex(where: { $0.id == targetId }) else { return }
        concepts[idx].lastTaughtState = concepts[idx].state
    }

    /// Stalled concepts: the target of `Tuning.stallAttempts` lessons with no state change.
    var stalledConcepts: [Concept] {
        concepts.filter { $0.isStalled }
    }

    /// Lessons completed (not abandoned) on the given day (Foundation pacing, B10).
    func lessonsCompleted(on date: Date) -> Int {
        lessonsCompletedByDay[dayKey(date)] ?? 0
    }

    var lessonsCompletedToday: Int { lessonsCompleted(on: Date()) }

    // MARK: - Daily plan progress (Today screen)

    private func progressKey(_ modality: LearningModality, _ date: Date = Date()) -> String {
        "\(dayKey(date))|\(modality.rawValue)"
    }

    /// Minutes practiced for an activity today.
    func minutesToday(_ modality: LearningModality) -> Int {
        activityProgress[progressKey(modality)] ?? 0
    }

    /// Progress toward a plan item today: minutes for a `.minutes` item, lessons
    /// completed for the Foundation `.lessons` item (B10). Views read this; they
    /// never compute it.
    func planProgress(for item: DailyPlanItem, now: Date = Date()) -> Int {
        switch item.kind {
        case .minutes:
            guard let modality = item.modality else { return 0 }
            return activityProgress[progressKey(modality, now)] ?? 0
        case .lessons:
            return lessonsCompleted(on: now)
        case .unlock:
            // Progress toward an unlock item is the lifetime minutes in its modality.
            guard let modality = item.modality else { return 0 }
            return totalMinutes(modality)
        }
    }

    /// Credit time spent in an activity surface to today's plan progress.
    func recordActivityMinutes(_ modality: LearningModality, minutes: Int, now: Date = Date()) {
        guard minutes > 0 else { return }
        let key = progressKey(modality, now)
        activityProgress[key] = (activityProgress[key] ?? 0) + minutes
        lifetimeMinutes[modality.rawValue] = (lifetimeMinutes[modality.rawValue] ?? 0) + minutes
        pruneHistory(now: now)
        save()
    }

    /// Credit lesson time. Lessons are not a `LearningModality`, so they keep their
    /// own day-keyed bucket (`lessonMinutes`) and lifetime total.
    func recordLessonMinutes(_ minutes: Int, now: Date = Date()) {
        guard minutes > 0 else { return }
        let key = dayKey(now)
        lessonMinutes[key] = (lessonMinutes[key] ?? 0) + minutes
        totalLessonMinutes += minutes
        pruneHistory(now: now)
        save()
    }

    /// Lesson minutes credited today.
    var lessonMinutesToday: Int { lessonMinutes[dayKey(Date())] ?? 0 }

    /// Drop per-day history older than `Tuning.activityHistoryDays`. Lifetime totals
    /// are kept separately, so pruning never changes readiness or profile totals.
    func pruneHistory(now: Date = Date()) {
        guard let cutoffDate = calendar.date(byAdding: .day, value: -Tuning.activityHistoryDays, to: now) else { return }
        let cutoff = dayKey(cutoffDate)
        // Keys are "yyyy-MM-dd" (optionally "|modality"), so a string compare on the
        // first 10 characters is a date compare.
        func isStale(_ key: String) -> Bool { String(key.prefix(10)) < cutoff }
        activityProgress = activityProgress.filter { !isStale($0.key) }
        lessonMinutes = lessonMinutes.filter { !isStale($0.key) }
        lessonsCompletedByDay = lessonsCompletedByDay.filter { !isStale($0.key) }
    }

    // MARK: - Lesson trigger accounting (Prompt F)

    /// New + due material that could feed a consolidated lesson right now.
    var pendingLessonMaterial: Int {
        gapsSinceLastLesson + reviewQueue.count
    }

    func shouldOfferConsolidatedLesson(threshold: Int) -> Bool {
        pendingLessonMaterial >= threshold
    }

    /// Called once a consolidated lesson has been offered/started.
    func markLessonOffered() {
        gapsSinceLastLesson = 0
        save()
    }

    /// Asynchronously map a gap to its best-matching concept (creating a new one
    /// only when nothing fits). Non-blocking — capture stays instant. Requests are
    /// serialised (E3): each one waits for the previous tag to land and then reads
    /// the CURRENT gap and concept list, so two captures that both propose "past
    /// tense" produce one concept, not two. A gap that already carries a concept,
    /// or a probe, is never re-tagged.
    func tagConcept(for gapId: String) {
        guard let gap = gaps.first(where: { $0.id == gapId }), gap.conceptId == nil, !gap.isProbe else { return }
        let previous = tagChain
        tagChain = Task { [weak self] in
            await previous?.value
            guard let self,
                  let current = self.gaps.first(where: { $0.id == gapId }),
                  current.conceptId == nil else { return }
            let result = await self.conceptTagger(current, self.concepts, self.tagLexicon)
            guard let result else { return }
            self.applyConceptTag(result, to: gapId)
        }
    }

    /// Land a tag on a gap. `.existing` links it (recording the matcher's
    /// confidence); `.untagged` leaves `conceptId` nil but records how close the
    /// best candidate came (E1); `.new` is folded into an existing concept whose
    /// name means the same thing before anything is created (E3).
    private func applyConceptTag(_ result: ConceptTagResult, to gapId: String) {
        guard let idx = gaps.firstIndex(where: { $0.id == gapId }) else { return }
        switch result {
        case .existing(let cid, let confidence):
            guard concepts.contains(where: { $0.id == cid }) else { return }
            gaps[idx].conceptId = cid
            gaps[idx].tagConfidence = confidence
        case .untagged(let confidence):
            gaps[idx].tagConfidence = confidence
        case .new(let concept):
            if let existing = HeuristicTagger.nearDuplicate(named: concept.name, id: concept.id, among: concepts) {
                gaps[idx].conceptId = existing.id
            } else {
                concepts.append(concept)
                gaps[idx].conceptId = concept.id
            }
            gaps[idx].tagConfidence = Tuning.tagNewConceptConfidence
        }
        save()
    }

    // MARK: - Per-concept mastery

    /// Update a concept's Beta evidence when a lesson item tied to it is answered.
    ///
    /// Pass 3 F3: before the observation lands, the evidence decays toward the
    /// prior by `Tuning.evidenceRecency` (alpha = 1 + (alpha − 1)·λ, same for beta)
    /// so recent answers dominate; the raw `observationCount` is never decayed.
    /// Pass 3 F6: a miss on a check-in (`isCheckIn`) weighs `Tuning.checkInMissWeight`×.
    /// A concept that crosses into `.mastered` here gets its first check-in scheduled
    /// `Tuning.checkInInitialDays` out.
    func recordConceptAnswer(conceptId: String?, correct: Bool, weight: Double = 1,
                             isCheckIn: Bool = false, now: Date = Date()) {
        guard let conceptId, weight > 0,
              let idx = concepts.firstIndex(where: { $0.id == conceptId }) else { return }
        var concept = concepts[idx]
        let wasMastered = concept.state == .mastered
        let lambda = Tuning.evidenceRecency
        concept.alpha = 1 + (concept.alpha - 1) * lambda
        concept.beta = 1 + (concept.beta - 1) * lambda
        let applied = (isCheckIn && !correct) ? weight * Tuning.checkInMissWeight : weight
        if correct { concept.alpha += applied } else { concept.beta += applied }
        concept.observationCount += weight
        concept.lastTestedAt = now
        if !wasMastered && concept.state == .mastered {
            // Newly mastered through practice: verify it in a week.
            concept.isProvisional = false
            concept.provisionalPasses = 0
            concept.checkInIntervalDays = Tuning.checkInInitialDays
            concept.nextCheckInAt = now.addingTimeInterval(Tuning.checkInInitialDays * 86_400)
            concept.stallAttempts = 0
        } else if wasMastered && concept.state != .mastered {
            // Lost mastery: it is real evidence now, not a seed, and the schedule
            // restarts when it is earned again.
            concept.isProvisional = false
            concept.provisionalPasses = 0
            concept.nextCheckInAt = nil
            concept.checkInIntervalDays = nil
        }
        concepts[idx] = concept
    }

    // MARK: - Check-ins and the retention governor (Pass 3 F4/F6)

    /// Record the outcome of a check-in on a mastered concept: the adaptive interval
    /// grows `Tuning.checkInGrowth`× on a pass and shrinks `Tuning.checkInMissDivisor`×
    /// on a miss (bounded by `checkInMinDays` … `checkInMaxDays`), the next check-in is
    /// scheduled from `now`, and the outcome enters the governor's rolling window
    /// (`Tuning.governorWindow`). A PROVISIONAL seed is re-checked every
    /// `Tuning.seedVerificationDays` until it has passed `Tuning.seedVerificationPasses`
    /// check-ins in a row; only then is it verified and put on the normal ladder.
    func recordCheckIn(conceptId: String, passed: Bool, now: Date = Date()) {
        // Record what was open BEFORE this outcome can flip the governor, so an
        // already-unlocked modality is never re-locked.
        refreshUnlocks(now: now)
        if let idx = concepts.firstIndex(where: { $0.id == conceptId }) {
            var concept = concepts[idx]
            let next: Double
            if concept.isProvisional && concept.state == .mastered {
                if passed {
                    concept.provisionalPasses += 1
                    if concept.provisionalPasses >= Tuning.seedVerificationPasses {
                        concept.isProvisional = false
                        concept.provisionalPasses = 0
                        next = Tuning.checkInInitialDays
                    } else {
                        next = Tuning.seedVerificationDays
                    }
                } else {
                    concept.provisionalPasses = 0
                    next = Tuning.seedVerificationDays
                }
            } else {
                let current = concept.checkInIntervalDays
                if passed {
                    next = min(Tuning.checkInMaxDays, current.map { $0 * Tuning.checkInGrowth } ?? Tuning.checkInInitialDays)
                } else {
                    next = max(Tuning.checkInMinDays, (current ?? Tuning.checkInInitialDays) / Tuning.checkInMissDivisor)
                }
            }
            concept.checkInIntervalDays = next
            concept.nextCheckInAt = now.addingTimeInterval(next * 86_400)
            concepts[idx] = concept
        }
        checkInHistory.append(passed)
        if checkInHistory.count > Tuning.governorWindow {
            checkInHistory.removeFirst(checkInHistory.count - Tuning.governorWindow)
        }
        save()
    }

    /// Pass rate over the rolling check-in window; nil before any check-in.
    var checkInPassRate: Double? {
        guard !checkInHistory.isEmpty else { return nil }
        return Double(checkInHistory.filter { $0 }.count) / Double(checkInHistory.count)
    }

    /// The retention governor (Pass 3 F6): active once the window holds at least
    /// `Tuning.governorMinSamples` check-ins and the pass rate is below
    /// `Tuning.governorPassFloor`. While active the selector stops expanding the
    /// frontier and the readiness gate holds anything not yet unlocked.
    var isGovernorActive: Bool {
        guard checkInHistory.count >= Tuning.governorMinSamples, let rate = checkInPassRate else { return false }
        return rate < Tuning.governorPassFloor
    }

    /// Recompute frontier unlocks after a lesson. Returns the names of concepts
    /// that became newly selectable so the UI can celebrate "New: ready for X".
    @discardableResult
    func expandFrontier() -> [String] {
        var unlocked: [String] = []
        for i in concepts.indices {
            let concept = concepts[i]
            guard concept.state == .neverObserved, !concept.prerequisites.isEmpty else { continue }
            let metNow = arePrerequisitesMet(concept)
            if metNow && !concept.newlyUnlocked {
                concepts[i].newlyUnlocked = true
                unlocked.append(concept.name)
            }
        }
        if !unlocked.isEmpty { save() }
        return unlocked
    }

    func clearUnlockFlags() {
        for i in concepts.indices where concepts[i].newlyUnlocked {
            concepts[i].newlyUnlocked = false
        }
        save()
    }

    // MARK: - Readiness gate (per modality)

    /// Base-concept coverage — the fraction of A1 root skills the learner has
    /// VERIFIED mastery of: earned through practice, or a placement seed that has
    /// passed its verification check-ins. A provisional seed never counts (B8), so
    /// reading opens on evidence, not on what placement guessed. Stands in for
    /// lexical coverage: the readiness gate keys off it.
    var baseCoverage: Double {
        let base = concepts.filter { ConceptTaxonomy.baseConceptIds.contains($0.id) }
        guard !base.isEmpty else { return 1 }
        return Double(base.filter { $0.isVerifiedMastered }.count) / Double(base.count)
    }

    /// Cumulative minutes ever practiced in a modality (proof of demonstrated
    /// performance, summed across days).
    func totalMinutes(_ modality: LearningModality) -> Int {
        lifetimeMinutes[modality.rawValue] ?? 0
    }

    /// Lifetime minutes derived from the per-day buckets (migration for stores that
    /// predate `lifetimeMinutes`, and a floor whenever the buckets say more).
    private func minutesFromBuckets(_ modality: LearningModality) -> Int {
        let suffix = "|\(modality.rawValue)"
        return activityProgress.filter { $0.key.hasSuffix(suffix) }.values.reduce(0, +)
    }

    /// Make sure lifetime totals are at least what the (unpruned) buckets hold.
    private func reconcileLifetimeMinutes() {
        for modality in LearningModality.allCases {
            let fromBuckets = minutesFromBuckets(modality)
            if fromBuckets > (lifetimeMinutes[modality.rawValue] ?? 0) {
                lifetimeMinutes[modality.rawValue] = fromBuckets
            }
        }
        let lessonFromBuckets = lessonMinutes.values.reduce(0, +)
        if lessonFromBuckets > totalLessonMinutes { totalLessonMinutes = lessonFromBuckets }
    }

    /// The readiness verdict for a modality. Reading gates on coverage (self-paced);
    /// higher modalities gate on Reading being open PLUS demonstrated performance.
    /// A modality recorded in `unlockedModalities` reads `.unlocked` no matter what
    /// coverage says right now — it is re-locked only at a bookkeeping point, and
    /// only once coverage has fallen below the bridge (`refreshUnlocks`, B8), so
    /// the gate never flip-flops day to day. While the retention governor is active
    /// (Pass 3 F6) a modality that has not yet been unlocked reads `.locked` —
    /// consolidate first.
    func readiness(for modality: LearningModality, config: ReadinessConfig = .tuning) -> ModalityReadiness {
        if unlockedModalities.contains(modality.rawValue) { return .unlocked }
        let verdict = baseReadiness(for: modality, config: config)
        guard verdict == .unlocked, isGovernorActive else { return verdict }
        return .locked
    }

    /// The gate with no governor and no recorded unlocks applied — what coverage
    /// and demonstrated minutes say on their own.
    private func baseReadiness(for modality: LearningModality, config: ReadinessConfig) -> ModalityReadiness {
        let cov = baseCoverage
        switch modality {
        case .reading:
            if cov >= config.readingUnlock { return .unlocked }
            if cov >= config.readingBridge { return .foundation }
            return .locked
        default:
            // Reading as the learner actually has it — recorded open counts (hysteresis,
            // B8): once Reading is open, its demonstrated minutes really do open the
            // higher modalities, exactly as the unlock item promises (D2). The
            // governor still holds a never-opened modality in `readiness(for:)`.
            guard readiness(for: .reading, config: config) == .unlocked else { return .locked }
            if cov >= config.higherUnlock || totalMinutes(.reading) >= config.higherDemonstratedMinutes {
                return .unlocked
            }
            return .locked
        }
    }

    /// The bookkeeping-point decision about the gate (lesson end, check-in, load,
    /// snapshot). Records every modality that currently reads as unlocked (governor
    /// applied) so the governor can hold the gate without re-locking an opened one;
    /// and applies the coverage gate's hysteresis (B8): an opened modality is
    /// re-locked only once verified coverage has fallen below `readingBridge` —
    /// not merely below `readingUnlock` — and only here, never live.
    func refreshUnlocks(config: ReadinessConfig = .tuning, now: Date = Date()) {
        if !unlockedModalities.isEmpty, baseCoverage < config.readingBridge {
            unlockedModalities.removeAll()   // reading closes, and everything gated behind it
        }
        let readingWasOpen = unlockedModalities.contains(LearningModality.reading.rawValue)
        for modality in LearningModality.allCases where readiness(for: modality, config: config) == .unlocked {
            unlockedModalities.insert(modality.rawValue)
        }
        // The unlock path (D3): the moment Reading is first recorded open, the A2
        // bridge slice joins the learner's gaps so the open surfaces have material.
        // Only on the transition — a load or a snapshot never re-seeds.
        if !readingWasOpen, unlockedModalities.contains(LearningModality.reading.rawValue) {
            seedBridgeContentIfNeeded(now: now)
        }
    }

    /// True while the learner hasn't yet cleared the Reading bar — Home shows the
    /// Foundation track instead of the open daily plan.
    var isInFoundation: Bool { readiness(for: .reading) != .unlocked }

    /// Predict whether placement results would land the learner in Foundation —
    /// used by the results screen BEFORE the results are applied to state. Seeds
    /// are provisional and never count toward coverage (B8), so a seed-only learner
    /// always starts in Foundation; only mastery already VERIFIED on this record
    /// (a retake by a learner whose reading is open) predicts otherwise.
    func willEnterFoundation(after result: PlacementResult, config: ReadinessConfig = .tuning) -> Bool {
        if result.isTrueBeginner { return true }
        if unlockedModalities.contains(LearningModality.reading.rawValue) { return false }
        return baseCoverage < config.readingUnlock
    }

    // The Foundation "next concept" is whatever the selector would teach next
    // (SelectionOutput.targetConceptId) — there is no separate CEFR-ordered spine.

    /// Base concepts with VERIFIED mastery — the same count coverage is built from.
    var foundationMastered: Int {
        concepts.filter { ConceptTaxonomy.baseConceptIds.contains($0.id) && $0.isVerifiedMastered }.count
    }

    var foundationTotal: Int { ConceptTaxonomy.baseConceptIds.count }

    // MARK: - Engine metrics (Package B14)

    /// The calibration proxies the app can measure about its own engine right now.
    /// `completeLesson` appends one of these to `metricsLog`.
    func metricsSnapshot(now: Date = Date()) -> EngineMetrics {
        let selector = ConceptSelector(store: self)
        var frontier = 0, learning = 0, mastered = 0, provisional = 0
        for concept in concepts {
            switch concept.state {
            case .neverObserved:
                if selector.isFrontier(concept) { frontier += 1 }
            case .learning:
                learning += 1
            case .mastered:
                mastered += 1
                if concept.isProvisional { provisional += 1 }
            }
        }
        let days: Int
        if let started = journeyStartedAt {
            days = max(0, calendar.dateComponents([.day], from: started, to: now).day ?? 0)
        } else {
            days = 0
        }
        return EngineMetrics(
            at: now,
            sessionIndex: sessionIndex,
            frontierSize: frontier,
            learningCount: learning,
            masteredCount: mastered,
            provisionalCount: provisional,
            checkInPassRate: checkInPassRate,
            checkInCount: checkInHistory.count,
            checkInMisses: checkInHistory.filter { !$0 }.count,
            governorActive: isGovernorActive,
            stalledConceptIds: stalledConcepts.map { $0.id },
            daysSinceStart: days,
            readingUnlocked: readiness(for: .reading) == .unlocked,
            lessonsToday: lessonsCompleted(on: now)
        )
    }

#if DEBUG
    /// The metric history for the DEBUG diagnostics screen, oldest first.
    var diagnosticsMetrics: [EngineMetrics] { metricsLog.entries }
#endif

    func stats(for category: GapCategory) -> (active: Int, mastered: Int) {
        let all = gaps.filter { $0.category == category && !$0.isProbe }
        return (all.filter { !$0.isMastered }.count, all.filter { $0.isMastered }.count)
    }

    // MARK: - Scheduling (FSRS-driven)

    /// Gaps that are overdue by more than a day — "critical".
    var criticalGaps: [GapItem] { criticalGaps(at: Date()) }

    /// Gaps due now (within tolerance).
    var dueGaps: [GapItem] { dueGaps(at: Date()) }

    var reviewQueue: [GapItem] { reviewQueue(at: Date()) }

    // The same schedule views evaluated against an explicit clock, so scope
    // resolution and the headless driver see one consistent "now".

    // Probe items are one-shot diagnostics, never "due" material — every schedule
    // view below reads `visibleGaps`.

    func criticalGaps(at now: Date) -> [GapItem] {
        visibleGaps.filter { $0.nextReviewAt < now.addingTimeInterval(-86_400) }
    }

    func dueGaps(at now: Date) -> [GapItem] {
        visibleGaps.filter { $0.nextReviewAt <= now && $0.nextReviewAt >= now.addingTimeInterval(-86_400) }
    }

    /// The spaced-repetition queue: everything due within the window, weakest first.
    /// Mastered gaps ride along when their schedule wants a check — that is what
    /// spaced repetition means (B3).
    func reviewQueue(at now: Date) -> [GapItem] {
        (visibleGaps + dueMasteredGaps(at: now))
            .filter { $0.nextReviewAt <= now.addingTimeInterval(Tuning.dueWindowDays * 86_400) }
            .sorted { $0.retrievability(at: now) < $1.retrievability(at: now) }
    }

    /// Gaps with recall evidence: reviewed at least once. Averages read this so a
    /// fresh seed of never-answered items cannot masquerade as "at risk" (B4).
    private var reviewedVisibleGaps: [GapItem] { practisedGaps }

    var gapHealth: (score: Int, label: String) {
        gapHealth(at: Date())
    }

    func gapHealth(at now: Date) -> (score: Int, label: String) {
        guard !visibleGaps.isEmpty else { return (100, "All clear") }
        let pool = reviewedVisibleGaps
        guard !pool.isEmpty else { return (100, "No reviews yet") }
        let avg = pool.map { $0.retrievability(at: now) }.reduce(0, +) / Double(pool.count)
        let score = Int((avg * 100).rounded())
        let label: String
        if score >= Tuning.gapHealthHealthyFloor { label = "Healthy" }
        else if score >= Tuning.gapHealthAttentionFloor { label = "Needs attention" }
        else { label = "At risk" }
        return (score, label)
    }

    // MARK: - Retention analytics

    struct RetentionBuckets {
        var fresh: [GapItem] = []     // reviewed, r >= Tuning.retentionFreshFloor
        var fading: [GapItem] = []    // reviewed, retentionFadingFloor <= r < retentionFreshFloor
        var atRisk: [GapItem] = []    // reviewed, r < Tuning.retentionFadingFloor
        var mastered: [GapItem] = []
        /// Never reviewed: no recall evidence, so no bucket is honest for it yet (B4).
        var new: [GapItem] = []
    }

    var retention: RetentionBuckets { retention(at: Date()) }

    /// Retention buckets over learner-visible gaps (probes excluded). Never-reviewed
    /// gaps go to `new`, never to `atRisk`: a bucket is a claim about recall, and a
    /// gap that was never answered has given no evidence either way.
    func retention(at now: Date) -> RetentionBuckets {
        var b = RetentionBuckets()
        for gap in gaps where !gap.isProbe {
            if gap.isMastered { b.mastered.append(gap); continue }
            if gap.isNew { b.new.append(gap); continue }
            let r = gap.retrievability(at: now)
            if r >= Tuning.retentionFreshFloor { b.fresh.append(gap) }
            else if r >= Tuning.retentionFadingFloor { b.fading.append(gap) }
            else { b.atRisk.append(gap) }
        }
        return b
    }

    var overallRetention: Int { overallRetention(at: Date()) }

    /// Mean recall (0…100) over reviewed, unmastered gaps; 100 with no evidence.
    func overallRetention(at now: Date) -> Int {
        let pool = reviewedVisibleGaps
        guard !pool.isEmpty else { return 100 }
        let avg = pool.map { $0.retrievability(at: now) }.reduce(0, +) / Double(pool.count)
        return Int((avg * 100).rounded())
    }

    var masteredThisWeek: Int {
        let weekAgo = calendar.date(byAdding: .day, value: -7, to: Date()) ?? Date().addingTimeInterval(-7 * 86_400)
        return gaps.filter { !$0.isProbe && ($0.masteredAt ?? .distantPast) >= weekAgo }.count
    }

    // MARK: - Practice streak

    /// Day key in the current calendar (module-wide default; the store instance
    /// method below honours an injected calendar).
    static func dayKey(_ date: Date) -> String { DayKey.key(for: date, calendar: .current) }

    /// "yyyy-MM-dd" for a date in this store's calendar/time zone.
    func dayKey(_ date: Date) -> String { DayKey.key(for: date, calendar: calendar) }

    var currentStreak: Int { currentStreak(now: Date()) }

    /// Consecutive days with a correct review ending today or yesterday (today may
    /// still be empty). Walks calendar days, so DST changes never skip or double a day.
    func currentStreak(now: Date) -> Int {
        var streak = 0
        var cursor = now
        if !masteryDays.contains(dayKey(cursor)) {
            guard let yesterday = calendar.date(byAdding: .day, value: -1, to: cursor) else { return 0 }
            cursor = yesterday
        }
        while masteryDays.contains(dayKey(cursor)) {
            streak += 1
            guard let previous = calendar.date(byAdding: .day, value: -1, to: cursor) else { break }
            cursor = previous
        }
        return streak
    }

    var longestStreak: Int {
        let days = masteryDays.compactMap { DayKey.date(from: $0, calendar: calendar) }.sorted()
        guard !days.isEmpty else { return 0 }
        var longest = 1, run = 1
        for i in 1..<days.count {
            let apart = calendar.dateComponents([.day], from: days[i - 1], to: days[i]).day ?? 0
            if apart == 1 { run += 1 } else { run = 1 }
            longest = max(longest, run)
        }
        return longest
    }

    /// Did the learner answer anything correctly on the given day (the 7-day grid)?
    func practisedOn(_ date: Date) -> Bool {
        masteryDays.contains(dayKey(date))
    }

    // MARK: - Error patterns

    struct ErrorPattern: Identifiable {
        /// Stable: the concept id, or "word:<french>" for records without a concept.
        var id: String
        var category: GapCategory
        var conceptLabel: String
        var count: Int
        var share: Double          // fraction of all errors
        var records: [ErrorRecord]
        var headline: String
    }

    /// Grouping key for an error record: its concept (falling back to the gap's
    /// current concept, then to the word itself).
    private func errorGroupKey(_ record: ErrorRecord) -> String {
        if let cid = record.conceptId { return cid }
        if let cid = gaps.first(where: { $0.id == record.gapId })?.conceptId { return cid }
        return "word:\(record.frenchWord.lowercased())"
    }

    /// Mistakes grouped by the underlying skill (`conceptId`), labelled with the
    /// concept's name; records with no concept group by word. The headline states
    /// counts only — it never claims a shared rule the data doesn't show.
    var errorPatterns: [ErrorPattern] {
        guard !errors.isEmpty else { return [] }
        let total = Double(errors.count)
        let grouped = Dictionary(grouping: errors, by: { errorGroupKey($0) })
        return grouped.map { key, records in
            let share = Double(records.count) / total
            let pct = Int((share * 100).rounded())
            let label = concept(key)?.name
                ?? records.first?.frenchWord
                ?? key
            let noun = records.count == 1 ? "mistake" : "mistakes"
            return ErrorPattern(
                id: key,
                category: records.first?.category ?? .grammar,
                conceptLabel: label,
                count: records.count,
                share: share,
                records: records.sorted { $0.occurredAt > $1.occurredAt },
                headline: "\(label) — \(records.count) \(noun) (\(pct)% of all)"
            )
        }
        .sorted { $0.count != $1.count ? $0.count > $1.count : $0.id < $1.id }
    }

    // MARK: - Reviewing

    /// The evidence entry point for an answered item. `now` is injectable so the
    /// headless driver can run multi-day sessions against the real schedule.
    ///
    /// `grade` defaults to good/again from `correct`; the lesson passes a format-
    /// derived grade through `recordAnswer`. A `.again` is a lapse: it clears the
    /// mastery badge and the streak so the gap is back on the active schedule (B3).
    ///
    /// `isCheckIn` (Pass 3 F6): true when the item was selected as a check-in on a
    /// mastered concept (`SelectedItemRole.checkIn`) — a miss then weighs double and
    /// the outcome feeds the concept's check-in interval and the governor. Nil
    /// derives it from the concept's state right now (mastered → check-in).
    func recordReview(gapId: String, correct: Bool, grade: ReviewGrade? = nil, conceptWeight: Double = 1,
                      isCheckIn: Bool? = nil, now: Date = Date()) {
        guard let idx = gaps.firstIndex(where: { $0.id == gapId }) else { return }
        var gap = gaps[idx]
        let g = grade ?? (correct ? .good : .again)
        let checkIn = isCheckIn ?? (concept(gap.conceptId)?.state == .mastered)

        gap.fsrs = FSRS.review(state: gap.fsrs, grade: g, now: now)
        gap.lastReviewedAt = now
        gap.nextReviewAt = gap.fsrs?.dueAt ?? now.addingTimeInterval(86_400)
        gap.reviewCount += 1

        if correct {
            gap.consecutiveCorrect += 1
            masteryDays.insert(dayKey(now))
            // Update learner ability (IRT-style nudge), bounded by the EVIDENCE: an
            // item at difficulty b says nothing about ability far above b, so the
            // gain stops at `b + Tuning.thetaEvidenceCeiling`. Without this the
            // gain/loss ratchet has a fixed point well above the material — a
            // beginner drilling A1 Foundation items (b ≈ −1.4…−0.7) would read as B1
            // inside a week while still locked inside Foundation. Ability is never
            // LOWERED here: a learner placed high keeps their placement.
            let evidenceCeiling = gap.irtDifficulty + Tuning.thetaEvidenceCeiling
            if abilityTheta < evidenceCeiling {
                let gain = Tuning.thetaGainOnCorrect * (1 - successProbability(theta: abilityTheta, b: gap.irtDifficulty))
                abilityTheta = min(evidenceCeiling, min(3, abilityTheta + gain))
            }
            if gap.consecutiveCorrect >= Tuning.gapMasteryStreak && gap.masteredAt == nil {
                gap.masteredAt = now
            }
        } else {
            gap.consecutiveCorrect = 0
            abilityTheta = max(-3, abilityTheta - Tuning.thetaLossOnMiss * successProbability(theta: abilityTheta, b: gap.irtDifficulty))
        }
        if g == .again {
            // A lapse un-masters: the badge is earned again with a fresh streak.
            gap.consecutiveCorrect = 0
            gap.masteredAt = nil
        }
        gaps[idx] = gap
        // Concept mastery moves only when the concept is actually re-tested here
        // (no timer-based decay) — weight scales slightly with item difficulty.
        let weight: Double
        switch gap.difficulty {
        case .hard: weight = Tuning.hardItemEvidenceWeight
        case .easy: weight = Tuning.easyItemEvidenceWeight
        case .okay: weight = 1.0
        }
        recordConceptAnswer(conceptId: gap.conceptId, correct: correct, weight: weight * conceptWeight,
                            isCheckIn: checkIn, now: now)
        if checkIn, let cid = gap.conceptId {
            recordCheckIn(conceptId: cid, passed: correct, now: now)
        }
        save()
    }

    /// The lesson's evidence entry point: derives the FSRS grade from HOW the item
    /// was answered (`Tuning.gradeMapping`) and the concept weight from the format
    /// (`Tuning.formatEvidenceWeight`), then records the review. `conceptWeight`
    /// multiplies on top (the capstone passes `Tuning.capstoneWeight`); `isCheckIn`
    /// is the selected item's role (`.checkIn`), nil to derive it from the concept.
    func recordAnswer(gapId: String, correct: Bool, format: AnswerFormat, firstTry: Bool,
                      conceptWeight: Double = 1, isCheckIn: Bool? = nil, now: Date = Date()) {
        let grade = Tuning.gradeMapping(format: format, correct: correct, firstTry: firstTry)
        let weight = Tuning.formatEvidenceWeight(format) * conceptWeight
        recordReview(gapId: gapId, correct: correct, grade: grade, conceptWeight: weight, isCheckIn: isCheckIn, now: now)
    }

    // MARK: - Evidence from speaking and conversation (E13 / E10)

    /// Speaking feedback named a concept: count it as concept evidence at the
    /// speaking format's weight. No gap is involved, so no schedule moves.
    func recordSpeakingEvidence(conceptId: String?, correct: Bool, now: Date = Date()) {
        guard let conceptId, concept(conceptId) != nil else { return }
        recordConceptAnswer(conceptId: conceptId, correct: correct,
                            weight: Tuning.formatEvidenceWeight(.speaking), now: now)
        save()
    }

    /// A tutor correction in Converse: the corrected French becomes a gap (through
    /// the capture factory, deduped on the headword) and the slip is recorded as a
    /// `.again` on it at the converse format's weight. Returns the gap the evidence
    /// landed on, or nil when there was nothing to correct.
    @discardableResult
    func recordConverseCorrection(originalFrench: String, correctedFrench: String, explanation: String,
                                  conceptId: String?, englishTranslation: String? = nil,
                                  now: Date = Date()) -> GapItem? {
        let corrected = correctedFrench.trimmingCharacters(in: .whitespacesAndNewlines)
        let original = originalFrench.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !corrected.isEmpty, captureKey(corrected) != captureKey(original) else { return nil }

        let gapId: String
        if let existing = existingGap(forWord: corrected) {
            gapId = existing.id
        } else {
            let linked = concept(conceptId)
            var gap = makeCapturedGap(
                frenchWord: corrected,
                englishTranslation: englishTranslation ?? "",
                explanation: explanation,
                exampleSentence: corrected,
                exampleTranslation: englishTranslation ?? "",
                sourceType: .speech,
                category: linked?.category ?? .phrasing,
                cefrLevel: linked?.cefrLevel,
                originalContext: OriginalContext(sentence: original, translation: nil, sourceTab: "converse",
                                                 capturedAt: now, reExposureCount: 0),
                conceptId: linked?.id,
                now: now
            )
            gap.needsTranslation = englishTranslation == nil
            guard captureGap(gap) else { return nil }
            gapId = gap.id
        }
        recordAnswer(gapId: gapId, correct: false, format: .converse, firstTry: true, now: now)
        return gaps.first { $0.id == gapId }
    }

    /// Record a confusion miss between two gaps (places pressure on the concept).
    func recordConfusion(gapId: String, partnerGapId: String) {
        guard let idx = gaps.firstIndex(where: { $0.id == gapId }) else { return }
        var links = gaps[idx].confusionLinks
        if let lidx = links.firstIndex(where: { $0.partnerGapId == partnerGapId }) {
            links[lidx].wrongPicks += 1
            links[lidx].lastConfusedAt = Date()
            links[lidx].strength = min(1, links[lidx].strength + 0.2)
        } else {
            links.append(ConfusionLink(partnerGapId: partnerGapId, wrongPicks: 1, lastConfusedAt: Date(), strength: 0.4))
        }
        gaps[idx].confusionLinks = links
        save()
    }

    func recordError(gap: GapItem, userAnswer: String, correctAnswer: String, now: Date = Date()) {
        let record = ErrorRecord(
            id: UUID().uuidString,
            gapId: gap.id,
            category: gap.category,
            frenchWord: gap.frenchWord,
            userAnswer: userAnswer,
            correctAnswer: correctAnswer,
            conceptLabel: concept(gap.conceptId)?.name ?? gap.conceptLabelForError,
            occurredAt: now,
            conceptId: gap.conceptId
        )
        errors.insert(record, at: 0)
        if errors.count > Tuning.errorHistoryCap {
            errors.removeLast(errors.count - Tuning.errorHistoryCap)
        }
        save()
    }

    // MARK: - XP and personal bests (real, persisted)

    /// Add experience points (never negative). The lesson awards
    /// `Tuning.xpPerCorrect` per correct answer; completion XP is awarded by
    /// `completeLesson`.
    func awardXP(_ amount: Int) {
        guard amount > 0 else { return }
        xp += amount
        save()
    }

    /// Record a finished lesson's result against the best for its kind. Returns
    /// true when it is a new best (accuracy first, then streak).
    @discardableResult
    func recordLessonBest(kind: LessonBestKind, accuracy: Double, streak: Int, now: Date = Date()) -> Bool {
        let clamped = min(1, max(0, accuracy))
        let key = kind.rawValue
        if let existing = personalBests[key],
           existing.accuracy > clamped || (existing.accuracy == clamped && existing.streak >= streak) {
            return false
        }
        personalBests[key] = LessonBest(accuracy: clamped, streak: streak, achievedAt: now)
        save()
        return true
    }

    func personalBest(for kind: LessonBestKind) -> LessonBest? {
        personalBests[kind.rawValue]
    }

    // MARK: - Capture (learner-created gaps)

    /// Build a learner-captured gap the way the Foundation loader builds seeded ones:
    /// fresh id and timestamps, an initial FSRS state due now, and an IRT difficulty
    /// derived from the level (defaulting to the learner's own level) via `Tuning`.
    /// Every capture site (reading, listening, converse, speak) goes through here
    /// and then `captureGap(_:)` so gaps never start without a schedule.
    func makeCapturedGap(
        frenchWord: String,
        englishTranslation: String,
        explanation: String = "",
        exampleSentence: String = "",
        exampleTranslation: String = "",
        pronunciation: String? = nil,
        sourceType: SourceType,
        category: GapCategory = .vocabulary,
        cefrLevel: CEFRLevel? = nil,
        difficulty: GapDifficulty = .okay,
        partOfSpeech: String? = nil,
        gender: String? = nil,
        article: String? = nil,
        baseForm: String? = nil,
        register: String? = nil,
        relatedWords: [String]? = nil,
        originalContext: OriginalContext? = nil,
        conceptId: String? = nil,
        now: Date = Date()
    ) -> GapItem {
        let level = cefrLevel ?? learnerLevel
        let bump: Double
        switch difficulty {
        case .hard: bump = Tuning.irtHardBump
        case .easy: bump = Tuning.irtEasyBump
        case .okay: bump = 0
        }
        var gap = GapItem(
            id: UUID().uuidString,
            frenchWord: frenchWord.trimmingCharacters(in: .whitespacesAndNewlines),
            englishTranslation: englishTranslation,
            explanation: explanation,
            exampleSentence: exampleSentence,
            exampleTranslation: exampleTranslation,
            pronunciation: pronunciation,
            sourceType: sourceType,
            category: category,
            difficulty: difficulty,
            reviewCount: 0,
            consecutiveCorrect: 0,
            lastReviewedAt: nil,
            nextReviewAt: now,
            masteredAt: nil,
            createdAt: now,
            cefrLevel: level,
            easeFactor: 2.5,
            currentInterval: 0,
            irtDifficulty: Tuning.irtDifficulty(for: level) + bump,
            fsrs: nil,
            originalContext: originalContext,
            confusionLinks: [],
            partOfSpeech: partOfSpeech,
            gender: gender,
            article: article,
            baseForm: baseForm,
            register: register,
            relatedWords: relatedWords,
            conceptId: conceptId
        )
        gap.fsrs = FSRS.makeInitialState(grade: .again, now: now)
        gap.fsrs?.dueAt = now
        return gap
    }

    /// Normalised headword used for capture de-duplication: case-folded, with the
    /// typographic apostrophe mapped to the straight one and runs of whitespace
    /// collapsed, so "l’eau" tapped in a live headline is the same card as the
    /// deck's "l'eau". Diacritics are deliberately KEPT — "ou" and "où" are
    /// different words and must stay different cards.
    private func captureKey(_ word: String) -> String {
        let normalised = word
            .replacingOccurrences(of: "\u{2019}", with: "'")
            .replacingOccurrences(of: "\u{2018}", with: "'")
            .replacingOccurrences(of: "\u{02bc}", with: "'")
            .lowercased()
        return normalised.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
    }

    /// The (non-probe) gap with the same headword, if one is already saved.
    func existingGap(forWord word: String) -> GapItem? {
        let key = captureKey(word)
        return gaps.first { !$0.isProbe && captureKey($0.frenchWord) == key }
    }

    /// True when a (non-probe) gap with the same headword already exists.
    func hasGap(forWord word: String) -> Bool {
        existingGap(forWord: word) != nil
    }

    /// Store a captured gap unless the same headword is already saved (case-
    /// insensitive). Returns false when it was a duplicate and nothing changed.
    @discardableResult
    func captureGap(_ gap: GapItem) -> Bool {
        guard !hasGap(forWord: gap.frenchWord) else { return false }
        addGap(gap)
        return true
    }

    // MARK: - Daily plan of record (D14)

    /// Today's plan, computed at most once per calendar day. `compute` runs only when
    /// no plan is cached for today (first open, or day rollover); `refreshPlan()`
    /// forces a recompute on the next call.
    func planForToday(now: Date = Date(), compute: () -> DailyPlan) -> DailyPlan {
        let today = dayKey(now)
        if let plan = dailyPlanOfRecord, dailyPlanDayKey == today { return plan }
        let plan = compute()
        dailyPlanOfRecord = plan
        dailyPlanDayKey = today
        // A cache, not learner data: persist locally, do not bump the sync clock.
        save(pushToCloud: false)
        return plan
    }

    /// Drop the cached plan so the next `planForToday` recomputes it.
    func refreshPlan() {
        dailyPlanOfRecord = nil
        dailyPlanDayKey = nil
        save(pushToCloud: false)
    }

    /// Recompute today's plan right now and make it the plan of record.
    @discardableResult
    func refreshPlan(now: Date = Date(), compute: () -> DailyPlan) -> DailyPlan {
        refreshPlan()
        return planForToday(now: now, compute: compute)
    }

    /// IRT 1-PL success probability used to size the lesson's difficulty.
    func successProbability(theta: Double, b: Double) -> Double {
        1.0 / (1.0 + exp(-(theta - b)))
    }

    /// Number of multiple-choice options to present, flexed off ability.
    var optionCount: Int {
        switch abilityTheta {
        case ..<(-0.5): return 3
        case ..<0.8: return 4
        case ..<1.6: return 5
        default: return 6
        }
    }

    // MARK: - Persistence

    private static func makeDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }

    private static func makeEncoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }

    /// Keep an unreadable blob next to its key so nothing is lost; the first
    /// preserved copy is never overwritten by a later one.
    private func preserveCorrupt(_ data: Data, key: String, in defaults: UserDefaults) {
        let corruptKey = key + corruptSuffix
        if defaults.data(forKey: corruptKey) == nil {
            defaults.set(data, forKey: corruptKey)
        }
    }

    /// Decode a persisted array element-by-element: a bad element is dropped, the
    /// rest survive. The blob is `.corrupt` only when it is unreadable as a whole
    /// (or every element failed, which is the same loss).
    private func decodeArray<T: Decodable>(_ type: T.Type, key: String,
                                           defaults: UserDefaults, decoder: JSONDecoder) -> BlobResult<[T]> {
        guard let data = defaults.data(forKey: key) else { return .absent }
        guard let wrapped = try? decoder.decode([FailableDecodable<T>].self, from: data) else {
            preserveCorrupt(data, key: key, in: defaults)
            return .corrupt
        }
        let values = wrapped.compactMap { $0.value }
        if !wrapped.isEmpty && values.isEmpty {
            preserveCorrupt(data, key: key, in: defaults)
            return .corrupt
        }
        return .decoded(values)
    }

    private func decodeValue<T: Decodable>(_ type: T.Type, key: String,
                                           defaults: UserDefaults, decoder: JSONDecoder) -> BlobResult<T> {
        guard let data = defaults.data(forKey: key) else { return .absent }
        guard let value = try? decoder.decode(T.self, from: data) else {
            preserveCorrupt(data, key: key, in: defaults)
            return .corrupt
        }
        return .decoded(value)
    }

    /// Read persisted state. A fresh install (no keys) is an honest empty state:
    /// no gaps, no errors, no streak — never sample data. Presence of a key is
    /// authoritative, so a legitimately empty list stays empty. Unreadable blobs set
    /// `loadError` and are preserved; nothing is written until it is acknowledged.
    private func load() {
        guard let defaults = persistence else {
            // In-memory: the seed taxonomy and nothing else, so fixtures are explicit.
            concepts = ConceptTaxonomy.seed()
            abilityTheta = Tuning.defaultAbilityTheta
            return
        }
        let decoder = Self.makeDecoder()
        var firstError: StoreLoadError? = nil
        var notices: [StoreLoadError] = []
        /// Blocking errors stop the app; low-stakes ones only raise a notice.
        func fail(_ error: StoreLoadError) {
            if error.isBlocking {
                if firstError == nil { firstError = error }
            } else if !notices.contains(error) {
                notices.append(error)
            }
        }

        switch decodeArray(GapItem.self, key: gapsKey, defaults: defaults, decoder: decoder) {
        case .absent: gaps = []
        case .decoded(let items): gaps = items
        case .corrupt: gaps = []; fail(.corruptGaps)
        }

        switch decodeArray(Concept.self, key: conceptsKey, defaults: defaults, decoder: decoder) {
        case .absent: concepts = ConceptTaxonomy.seed()
        case .decoded(let items): concepts = items
        case .corrupt: concepts = ConceptTaxonomy.seed(); fail(.corruptConcepts)
        }
        appendMissingSeedConcepts()
        sessionIndex = defaults.integer(forKey: sessionKey)

        switch decodeArray(ErrorRecord.self, key: errorsKey, defaults: defaults, decoder: decoder) {
        case .absent: errors = []
        case .decoded(let items): errors = items
        case .corrupt: errors = []; fail(.corruptErrors)
        }
        if errors.count > Tuning.errorHistoryCap {
            errors.removeLast(errors.count - Tuning.errorHistoryCap)
        }

        abilityTheta = defaults.object(forKey: thetaKey) as? Double ?? Tuning.defaultAbilityTheta
        masteryDays = Set((defaults.array(forKey: masteryKey) as? [String]) ?? [])
        hasCompletedAssessment = defaults.bool(forKey: assessmentKey)
        if let raw = defaults.string(forKey: levelKey), let level = CEFRLevel(rawValue: raw) {
            assessedLevel = level
        }

        switch decodeValue(UserPreferences.self, key: preferencesKey, defaults: defaults, decoder: decoder) {
        case .absent: preferences = nil
        case .decoded(let prefs): preferences = prefs
        case .corrupt: preferences = nil; fail(.corruptPreferences)
        }

        switch decodeValue([String: Int].self, key: activityProgressKey, defaults: defaults, decoder: decoder) {
        case .absent: activityProgress = [:]
        case .decoded(let progress): activityProgress = progress
        case .corrupt: activityProgress = [:]; fail(.corruptActivityProgress)
        }
        // Low-stakes counters: an unreadable blob just starts over (totals are re-derived).
        lifetimeMinutes = (try? decodeDict(lifetimeMinutesKey, defaults, decoder)) ?? [:]
        lessonMinutes = (try? decodeDict(lessonMinutesKey, defaults, decoder)) ?? [:]
        lessonsCompletedByDay = (try? decodeDict(lessonsCompletedKey, defaults, decoder)) ?? [:]
        totalLessonMinutes = defaults.integer(forKey: totalLessonMinutesKey)
        xp = defaults.integer(forKey: xpKey)
        if let data = defaults.data(forKey: personalBestsKey),
           let bests = try? decoder.decode([String: LessonBest].self, from: data) {
            personalBests = bests
        }
        if let data = defaults.data(forKey: dailyPlanKey),
           let stored = try? decoder.decode(DailyPlan.self, from: data) {
            dailyPlanOfRecord = stored
            dailyPlanDayKey = defaults.string(forKey: dailyPlanDayKey_)
        }

        gapsSinceLastLesson = defaults.integer(forKey: gapsSinceLessonKey)
        lessonsSinceCapstone = defaults.integer(forKey: lessonsSinceCapstoneKey)
        if let ts = defaults.object(forKey: localUpdatedAtKey) as? Double {
            localUpdatedAt = Date(timeIntervalSince1970: ts)
        }
        // Pass 3 bookkeeping (low stakes: an unreadable blob just starts over).
        checkInHistory = Array(((defaults.array(forKey: checkInHistoryKey) as? [Bool]) ?? []).suffix(Tuning.governorWindow))
        unlockedModalities = Set((defaults.array(forKey: unlockedModalitiesKey) as? [String]) ?? [])
        if let data = defaults.data(forKey: metricsLogKey),
           let log = try? decoder.decode(MetricsLog.self, from: data) {
            metricsLog = log
        }
        if let ts = defaults.object(forKey: journeyStartedAtKey) as? Double {
            journeyStartedAt = Date(timeIntervalSince1970: ts)
        }
        lastSignedInUserId = defaults.string(forKey: lastSignedInUserKey)

        reconcileLifetimeMinutes()
        pruneHistory()
        loadError = firstError
        loadNotices = notices
        refreshUnlocks()
    }

    private func decodeDict(_ key: String, _ defaults: UserDefaults, _ decoder: JSONDecoder) throws -> [String: Int] {
        guard let data = defaults.data(forKey: key) else { return [:] }
        return try decoder.decode([String: Int].self, from: data)
    }

    /// Ensure any seed concepts added in app updates are present.
    private func appendMissingSeedConcepts() {
        let existingIds = Set(concepts.map { $0.id })
        let missing = ConceptTaxonomy.seed().filter { !existingIds.contains($0.id) }
        if !missing.isEmpty { concepts.append(contentsOf: missing) }
    }

    /// Clear a launch-time load error so writes resume. `discard: true` deletes the
    /// preserved "<key>.corrupt" blobs; `false` keeps them on the device for later
    /// recovery/support while the app proceeds with the state it has now. Either way
    /// the learner has made the call — the store never overwrites silently.
    func acknowledgeLoadError(discard: Bool) {
        guard loadError != nil || !loadNotices.isEmpty else { return }
        if discard { removeCorruptBlobs() }
        loadError = nil
        loadNotices = []
        if isDirty { scheduleWrite() }
    }

    /// Dismiss the non-blocking load notice. The preserved ".corrupt" copies stay
    /// on the device for support; only the message goes away.
    func acknowledgeLoadNotices() {
        loadNotices = []
    }

    private func removeCorruptBlobs() {
        guard let defaults = persistence else { return }
        for key in [gapsKey, conceptsKey, errorsKey, preferencesKey, activityProgressKey] {
            defaults.removeObject(forKey: key + corruptSuffix)
        }
    }

    /// Raw preserved blob for a corrupt key, if any (recovery/support screens).
    func corruptBlob(for error: StoreLoadError) -> Data? {
        guard let defaults = persistence else { return nil }
        let key: String
        switch error {
        case .corruptGaps: key = gapsKey
        case .corruptConcepts: key = conceptsKey
        case .corruptErrors: key = errorsKey
        case .corruptPreferences: key = preferencesKey
        case .corruptActivityProgress: key = activityProgressKey
        }
        return defaults.data(forKey: key + corruptSuffix)
    }

    // MARK: - Cloud snapshot (account sync)

    /// Build a full snapshot of the persisted learner state for cloud backup.
    func makeSnapshot() -> ProgressSnapshot {
        ProgressSnapshot(
            clientUpdatedAt: localUpdatedAt ?? Date(),
            gaps: gaps,
            concepts: concepts,
            errors: errors,
            abilityTheta: abilityTheta,
            masteryDays: Array(masteryDays),
            hasCompletedAssessment: hasCompletedAssessment,
            assessedLevel: assessedLevel.rawValue,
            sessionIndex: sessionIndex,
            preferences: preferences,
            activityProgress: activityProgress,
            gapsSinceLastLesson: gapsSinceLastLesson,
            lessonsSinceCapstone: lessonsSinceCapstone,
            xp: xp,
            personalBests: personalBests,
            lifetimeMinutes: lifetimeMinutes,
            totalLessonMinutes: totalLessonMinutes,
            lessonMinutes: lessonMinutes,
            lessonsCompletedByDay: lessonsCompletedByDay,
            checkInHistory: checkInHistory,
            unlockedModalities: Array(unlockedModalities).sorted(),
            journeyStartedAt: journeyStartedAt,
            savedScenarios: savedScenariosData
        )
    }

    /// Learner-saved scenario guides, written by `ScenarioStore` under the shared
    /// key. The store carries them as an opaque blob so they survive a reinstall
    /// and reach a second device without the snapshot depending on the scenario
    /// models (store-1-4).
    private var savedScenariosData: Data? {
        get { persistence?.data(forKey: ScenarioStorage.defaultsKey) }
        set {
            guard let defaults = persistence else { return }
            if let newValue {
                defaults.set(newValue, forKey: ScenarioStorage.defaultsKey)
            } else {
                defaults.removeObject(forKey: ScenarioStorage.defaultsKey)
            }
        }
    }

    /// Persist the learner's saved scenario guides. Goes through the store — not
    /// straight to `UserDefaults` — so the write marks the record dirty, moves the
    /// sync clock and reaches the account; otherwise the device looks clean and the
    /// next reconcile applies the account's older blob over the guide just saved
    /// (store-2-3).
    func setSavedScenarios(_ data: Data?) {
        savedScenariosData = data
        save()
    }

    /// Apply a snapshot pulled from the cloud, replacing local state. Persists
    /// locally without re-pushing to the cloud (this state already lives there).
    /// A known-good cloud snapshot supersedes an unreadable local blob, so any
    /// launch-time load error is acknowledged here (the corrupt copy is kept).
    func apply(snapshot: ProgressSnapshot) {
        gaps = snapshot.gaps
        concepts = snapshot.concepts
        errors = snapshot.errors
        if errors.count > Tuning.errorHistoryCap {
            errors.removeLast(errors.count - Tuning.errorHistoryCap)
        }
        abilityTheta = snapshot.abilityTheta
        masteryDays = Set(snapshot.masteryDays)
        hasCompletedAssessment = snapshot.hasCompletedAssessment
        if let level = CEFRLevel(rawValue: snapshot.assessedLevel) { assessedLevel = level }
        sessionIndex = snapshot.sessionIndex
        preferences = snapshot.preferences
        activityProgress = snapshot.activityProgress
        gapsSinceLastLesson = snapshot.gapsSinceLastLesson
        lessonsSinceCapstone = snapshot.lessonsSinceCapstone
        // Rows written before XP existed carry nil; keep what the device has.
        if let cloudXP = snapshot.xp { xp = cloudXP }
        // A6: the fields sign-out wipes. Absent on rows from earlier builds → keep
        // the device value (never zero a learner's bests because a row is old).
        if let bests = snapshot.personalBests { personalBests = bests }
        if let minutes = snapshot.lifetimeMinutes { lifetimeMinutes = minutes }
        if let total = snapshot.totalLessonMinutes { totalLessonMinutes = total }
        if let minutes = snapshot.lessonMinutes { lessonMinutes = minutes }
        if let completed = snapshot.lessonsCompletedByDay { lessonsCompletedByDay = completed }
        if let history = snapshot.checkInHistory { checkInHistory = Array(history.suffix(Tuning.governorWindow)) }
        if let unlocked = snapshot.unlockedModalities { unlockedModalities = Set(unlocked) }
        if let started = snapshot.journeyStartedAt { journeyStartedAt = started }
        if let scenarios = snapshot.savedScenarios { savedScenariosData = scenarios }
        appendMissingSeedConcepts()
        reconcileLifetimeMinutes()
        pruneHistory()
        // The plan of record is device-local; a new snapshot invalidates it.
        dailyPlanOfRecord = nil
        dailyPlanDayKey = nil
        localUpdatedAt = snapshot.clientUpdatedAt
        refreshUnlocks()
        acknowledgeLoadError(discard: false)
        save(pushToCloud: false)
        flush()
    }

    /// Put EVERY field back to the honest empty state of a fresh install.
    private func resetAllState() {
        saveTask?.cancel()
        saveTask = nil
        pendingCloudPush = false
        gaps = []
        concepts = ConceptTaxonomy.seed()
        errors = []
        abilityTheta = Tuning.defaultAbilityTheta
        masteryDays = []
        hasCompletedAssessment = false
        assessedLevel = .A1
        sessionIndex = 0
        preferences = nil
        activityProgress = [:]
        lifetimeMinutes = [:]
        lessonMinutes = [:]
        totalLessonMinutes = 0
        lessonsCompletedByDay = [:]
        gapsSinceLastLesson = 0
        lessonsSinceCapstone = 0
        xp = 0
        personalBests = [:]
        dailyPlanOfRecord = nil
        dailyPlanDayKey = nil
        selectionLog = SelectionLog()
        checkInHistory = []
        unlockedModalities = []
        metricsLog = MetricsLog()
        journeyStartedAt = nil
        localUpdatedAt = nil
        isLessonInProgress = false
        // Saved scenario guides live outside the store's own blobs but are just as
        // personal (they include the learner's free-text queries), so they go too
        // (store-1-4).
        persistence?.removeObject(forKey: ScenarioStorage.defaultsKey)
        removeCorruptBlobs()
        loadError = nil
        loadNotices = []
    }

    /// Reset to a clean signed-out state so the next account starts fresh and no
    /// data bleeds between users on a shared device. Writes immediately and never
    /// pushes (the account that owned this state is gone). Only ever called for a
    /// sign-out the learner asked for — see `beginSession(userId:)` for the
    /// involuntary case.
    func clearForSignOut() {
        resetAllState()
        lastSignedInUserId = nil
        persistence?.removeObject(forKey: lastSignedInUserKey)
        save(pushToCloud: false)
        flush()
    }

    /// A session was established for `userId`. The device record is wiped ONLY when
    /// it belongs to a different learner; the same learner signing back in (after an
    /// expired token, say) keeps everything that had not been uploaded yet, and a
    /// first-ever sign-in keeps the pre-login record so it can be migrated up.
    /// Returns true when another learner's record was cleared.
    @discardableResult
    func beginSession(userId: String) -> Bool {
        defer {
            lastSignedInUserId = userId
            persistence?.set(userId, forKey: lastSignedInUserKey)
        }
        guard let previous = lastSignedInUserId, previous != userId else { return false }
        resetAllState()
        save(pushToCloud: false)
        flush()
        return true
    }

    // MARK: - Lesson lifecycle

    /// A lesson opened. While this holds, a foreground cloud reconcile is deferred
    /// so the lesson's evidence can never be replaced underneath it (store-1-3).
    func beginLesson() {
        isLessonInProgress = true
    }

    /// The lesson cover closed (finished, quit or dismissed). Idempotent.
    func endLesson() {
        isLessonInProgress = false
    }

    // MARK: - Placement assessment

    /// Map a CEFR level to a starting IRT ability estimate.
    private func theta(for level: CEFRLevel) -> Double {
        switch level {
        case .A1: return -0.8
        case .A2: return 0.0
        case .B1: return 0.8
        case .B2: return 1.5
        case .C1: return 2.2
        case .C2: return 2.8
        }
    }

    /// Mark a base concept as known from placement (Pass 3 F5 / B9): the learner
    /// answered every one of its `Tuning.placementProbesPerConcept` items. The seed
    /// BLENDS with whatever evidence the concept has: alpha gains
    /// `Tuning.placementSeedAlpha` (capped at `Tuning.placementSeedAlphaCap`), beta
    /// is never lowered, and the raw observation count grows by the alpha actually
    /// gained — a retake at the cap adds no observations. A fresh concept reads as
    /// mastered (5 / 1, four observations), PROVISIONALLY: its first check-in is
    /// scheduled `Tuning.seedVerificationDays` out. Mastery that was already held
    /// (earned through practice, or an earlier seed on its ladder) is left as it is —
    /// a retake never demotes verified mastery to a provisional one.
    private func seedMastered(_ conceptId: String, now: Date) {
        guard let idx = concepts.firstIndex(where: { $0.id == conceptId }) else { return }
        var concept = concepts[idx]
        let wasMastered = concept.state == .mastered
        let gain = min(Tuning.placementSeedAlpha, max(0, Tuning.placementSeedAlphaCap - concept.alpha))
        concept.alpha += gain
        concept.observationCount += gain
        concept.lastTestedAt = now
        if !wasMastered && concept.state == .mastered {
            concept.isProvisional = true
            concept.provisionalPasses = 0
            concept.checkInIntervalDays = nil
            concept.nextCheckInAt = now.addingTimeInterval(Tuning.seedVerificationDays * 86_400)
            concept.stallAttempts = 0
        }
        concepts[idx] = concept
    }

    /// Give a base concept the placement only INFERRED (at or below a cleared band,
    /// but not fully probed) a `.learning` head start (B9): alpha and the raw
    /// observation count gain `Tuning.placementInferredAlpha`, which sits below
    /// `Tuning.minObservations` so the concept can never read as mastered from this
    /// alone. Only a never-observed concept takes it — real evidence already speaks
    /// for itself, and a retake must not stack inferences into mastery.
    private func seedInferred(_ conceptId: String, now: Date) {
        guard let idx = concepts.firstIndex(where: { $0.id == conceptId }),
              concepts[idx].state == .neverObserved else { return }
        var concept = concepts[idx]
        concept.alpha += Tuning.placementInferredAlpha
        concept.observationCount += Tuning.placementInferredAlpha
        concept.lastTestedAt = now
        concepts[idx] = concept
    }

    /// Apply adaptive placement results: seed (provisional) mastery on demonstrated
    /// base concepts, route the learner, and lay down the right starting gaps. A
    /// knower lands on their shaky spots; a beginner gets the Foundation slice.
    /// Seeded concepts keep their Foundation gaps too: they are the items the
    /// verification check-ins ride on, and what gets taught if a seed fails.
    func applyPlacement(_ result: PlacementResult, isFirstRun: Bool, now: Date = Date()) {
        // A7: a "first run" is only a first run while nothing has placed this
        // learner yet. If a reconcile applied an account snapshot that already
        // completed placement (another device) while the first-run assessment was
        // on screen, the wipe below would destroy that record and push the empty
        // state over the account — so the result is applied as a retake instead.
        let isFirstRun = isFirstRun && !hasCompletedAssessment

        if isFirstRun {
            assessedLevel = result.estimatedLevel
            abilityTheta = theta(for: result.estimatedLevel)
        } else {
            // D8: a retake only ADDS evidence. The assessment intro and results
            // screens promise it "never lowers what you've earned", so ability
            // grown through practice and the level already displayed are only ever
            // raised — a bad day cannot demote a learner from B1 back to A1.
            abilityTheta = max(abilityTheta, theta(for: result.estimatedLevel))
            if result.estimatedLevel.order > assessedLevel.order {
                assessedLevel = result.estimatedLevel
            }
        }

        let missedConcepts = Set(result.missedConceptIds)
        // Two tiers (B9): fully probed → provisional mastery; band-inferred → learning.
        let mastered = Set(result.masteredConceptIds)
        for cid in result.masteredConceptIds where !missedConcepts.contains(cid) { seedMastered(cid, now: now) }
        for cid in result.inferredConceptIds where !missedConcepts.contains(cid) && !mastered.contains(cid) {
            seedInferred(cid, now: now)
        }

        if isFirstRun {
            var seeded = result.missedGaps
            // Below the reading bar → seed the Foundation slice (D3): the BASE
            // concepts only, plus the gaps of every concept placement seeded as
            // provisional mastery (the vehicles for its verification check-ins and
            // what gets taught if the seed fails — B7). Staggered in concept order so
            // day one shows `Tuning.foundationSeedBatch` items as due, not the whole
            // curriculum. An item the placement already captured as missed is not
            // seeded a second time.
            if isInFoundation {
                seeded.append(contentsOf: foundationSlice(
                    conceptIds: FoundationSeeder.firstRunConceptIds(seededMastered: result.masteredConceptIds),
                    excludedHeadwords: Set(seeded.map { FoundationSeeder.headwordKey($0.frenchWord) }),
                    existingIds: Set(seeded.map { $0.id }), now: now))
            }
            gaps = seeded
            journeyStartedAt = now
            checkInHistory = []
            unlockedModalities = []
            metricsLog = MetricsLog()
            errors = []
            // A first placement starts the learner's record from zero: no streak,
            // minutes, XP or lesson counters carried over from before placement.
            masteryDays = []
            activityProgress = [:]
            lifetimeMinutes = [:]
            lessonMinutes = [:]
            totalLessonMinutes = 0
            lessonsCompletedByDay = [:]
            xp = 0
            personalBests = [:]
            sessionIndex = 0
            lessonsSinceCapstone = 0
            gapsSinceLastLesson = 0
            dailyPlanOfRecord = nil
            dailyPlanDayKey = nil
        } else {
            // A retake only adds what the record does not already hold. A missed
            // probe now seeds a REAL Foundation item, which carries that item's own
            // stable id, so the id check matters as much as the headword one.
            let existingIds = Set(gaps.map { $0.id })
            let existing = Set(gaps.map { FoundationSeeder.headwordKey($0.frenchWord) })
            let fresh = result.missedGaps.filter {
                !existingIds.contains($0.id) && !existing.contains(FoundationSeeder.headwordKey($0.frenchWord))
            }
            gaps.insert(contentsOf: fresh, at: 0)
            if journeyStartedAt == nil { journeyStartedAt = now }
        }
        hasCompletedAssessment = true
        // A learner whose reading is open gets the A2 bridge slice (D4) — a
        // straight-to-reading placement never ends with zero gaps and no-op buttons.
        seedBridgeContentIfNeeded(now: now)
        // No `refreshUnlocks()` here (B8): placement seeds are provisional and never
        // count toward coverage, so the first check-in that verifies one is the first
        // bookkeeping point that can record an open modality.
        save()
        flush()
    }

    /// Persist the learner's plan preferences (the "floor").
    func setPreferences(_ prefs: UserPreferences) {
        preferences = prefs
        save()
    }

    // MARK: - Save / flush (coalesced)

    /// Mark the store dirty and schedule a write after `Tuning.saveCoalesceInterval`.
    /// `pushToCloud: true` (the default for learner-driven changes) also bumps the
    /// sync clock and queues a debounced cloud push that fires on the next `flush()`.
    /// Cheap enough to call on every answer: nothing is encoded here.
    func save(pushToCloud: Bool = true) {
        if pushToCloud {
            localUpdatedAt = Date()
            pendingCloudPush = true
        }
        isDirty = true
        scheduleWrite()
    }

    private func scheduleWrite() {
        guard saveTask == nil, loadError == nil else { return }
        saveTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(Tuning.saveCoalesceInterval))
            guard !Task.isCancelled, let self else { return }
            self.saveTask = nil
            self.flush()
        }
    }

    /// True while a coalesced write is still pending (tests and lifecycle hooks).
    var hasPendingWrite: Bool { isDirty }

    /// Write pending state now (lesson end, placement, app backgrounding). Refused —
    /// and left pending — while a load error is unresolved, so a bad read can never
    /// be persisted over the learner's real data. The cloud push rides on this.
    func flush() {
        saveTask?.cancel()
        saveTask = nil
        guard isDirty else { return }
        guard loadError == nil else { return }
        isDirty = false
        writeToPersistence()
        if pendingCloudPush {
            pendingCloudPush = false
            cloud?.progressDidChange(self)
        }
    }

    /// Write pending state AND upload it now, without waiting out the cloud
    /// debounce. Called at the boundaries that matter — a finished lesson — so the
    /// account is current within a second of the learner stopping, while ordinary
    /// answers ride the long debounce instead of uploading the whole record each
    /// time (store-2-2).
    func flushToCloud() {
        flush()
        guard let cloud else { return }
        Task { [weak self] in
            guard let self else { return }
            _ = await cloud.flushPending(store: self)
        }
    }

    private func writeToPersistence() {
        guard let defaults = persistence else { return }
        let encoder = Self.makeEncoder()
        if let ts = localUpdatedAt {
            defaults.set(ts.timeIntervalSince1970, forKey: localUpdatedAtKey)
        } else {
            defaults.removeObject(forKey: localUpdatedAtKey)
        }
        if let prefs = preferences {
            if let data = try? encoder.encode(prefs) { defaults.set(data, forKey: preferencesKey) }
        } else {
            defaults.removeObject(forKey: preferencesKey)
        }
        if let data = try? encoder.encode(gaps) { defaults.set(data, forKey: gapsKey) }
        if let data = try? encoder.encode(concepts) { defaults.set(data, forKey: conceptsKey) }
        if let data = try? encoder.encode(activityProgress) { defaults.set(data, forKey: activityProgressKey) }
        if let data = try? encoder.encode(lifetimeMinutes) { defaults.set(data, forKey: lifetimeMinutesKey) }
        if let data = try? encoder.encode(lessonMinutes) { defaults.set(data, forKey: lessonMinutesKey) }
        if let data = try? encoder.encode(lessonsCompletedByDay) { defaults.set(data, forKey: lessonsCompletedKey) }
        defaults.set(totalLessonMinutes, forKey: totalLessonMinutesKey)
        defaults.set(gapsSinceLastLesson, forKey: gapsSinceLessonKey)
        defaults.set(lessonsSinceCapstone, forKey: lessonsSinceCapstoneKey)
        if let data = try? encoder.encode(errors) { defaults.set(data, forKey: errorsKey) }
        defaults.set(sessionIndex, forKey: sessionKey)
        defaults.set(abilityTheta, forKey: thetaKey)
        defaults.set(Array(masteryDays), forKey: masteryKey)
        defaults.set(hasCompletedAssessment, forKey: assessmentKey)
        defaults.set(assessedLevel.rawValue, forKey: levelKey)
        defaults.set(xp, forKey: xpKey)
        if let data = try? encoder.encode(personalBests) { defaults.set(data, forKey: personalBestsKey) }
        if let plan = dailyPlanOfRecord, let day = dailyPlanDayKey,
           let data = try? encoder.encode(plan) {
            defaults.set(data, forKey: dailyPlanKey)
            defaults.set(day, forKey: dailyPlanDayKey_)
        } else {
            defaults.removeObject(forKey: dailyPlanKey)
            defaults.removeObject(forKey: dailyPlanDayKey_)
        }
        defaults.set(checkInHistory, forKey: checkInHistoryKey)
        defaults.set(Array(unlockedModalities).sorted(), forKey: unlockedModalitiesKey)
        if let data = try? encoder.encode(metricsLog) { defaults.set(data, forKey: metricsLogKey) }
        if let started = journeyStartedAt {
            defaults.set(started.timeIntervalSince1970, forKey: journeyStartedAtKey)
        } else {
            defaults.removeObject(forKey: journeyStartedAtKey)
        }
    }

    /// Wipe all progress back to a fresh install (DEBUG tooling only — the release
    /// UI never offers it). Persists and pushes so the account matches the device.
    func resetProgress() {
        resetAllState()
        save()
        flush()
    }

#if DEBUG
    /// An in-memory store filled with sample content for SwiftUI previews. This is
    /// the ONLY place sample data enters a store; real users never see it.
    static var preview: AppStore {
        let store = AppStore(persistence: nil)
        store.gaps = SampleData.makeGaps()
        store.errors = SampleData.makeErrors()
        store.masteryDays = Set((1...4).compactMap { offset in
            store.calendar.date(byAdding: .day, value: -offset, to: Date()).map { store.dayKey($0) }
        })
        store.hasCompletedAssessment = true
        store.xp = 340
        return store
    }
#endif
}

// MARK: - Persistence helpers

/// Outcome of reading one persisted blob.
private nonisolated enum BlobResult<T> {
    case absent
    case decoded(T)
    case corrupt
}

nonisolated extension GapItem {
    var conceptLabelForError: String {
        switch category {
        case .grammar: return "\(frenchWord) usage"
        case .pronunciation: return "\(frenchWord) sound"
        default: return "\(frenchWord) meaning"
        }
    }
}

// MARK: - Per-package extension blocks (concurrent editing: each package edits ONLY its own block)

extension AppStore {
    // MARK: Package C — lesson-loop store methods

    /// Record an answer whose FSRS grade the lesson has already decided — the
    /// accent slip that counts as a `.hard` success (C3) — at the format's evidence
    /// weight, exactly as `recordAnswer` does for a format-derived grade. `.again`
    /// is a miss; every other grade is a correct answer.
    func recordGradedAnswer(gapId: String, grade: ReviewGrade, format: AnswerFormat,
                            conceptWeight: Double = 1, isCheckIn: Bool? = nil, now: Date = Date()) {
        let weight = Tuning.formatEvidenceWeight(format) * conceptWeight
        recordReview(gapId: gapId, correct: grade != .again, grade: grade, conceptWeight: weight,
                     isCheckIn: isCheckIn, now: now)
    }
}

extension AppStore {
    // MARK: Package D-home — Home screen / daily plan / gate store methods

    // MARK: Plan of record (D14)

    /// Today's plan of record: the plan engine runs at most once per calendar day
    /// (`planForToday`), so Home never re-rolls the plan mid-day. Progress toward
    /// each item is read live through `planProgress(for:)`.
    func todaysPlan(now: Date = Date()) -> DailyPlan {
        planForToday(now: now) { DailyPlanEngine(store: self).makePlan(now: now) }
    }

    /// Recompute today's plan right now — for a preference change or an unlock,
    /// the two events that change the plan's shape rather than its progress.
    @discardableResult
    func recomputePlan(now: Date = Date()) -> DailyPlan {
        refreshPlan(now: now) { DailyPlanEngine(store: self).makePlan(now: now) }
    }

    // MARK: Entry-point gate (D1 / D5)

    /// Whether Home may open a modality's surface. Reading opens in the bridge
    /// state too (`.foundation` — the surface caps itself to short, level-capped
    /// pieces); every other modality opens only when unlocked.
    func canOpen(_ modality: LearningModality) -> Bool {
        switch readiness(for: modality) {
        case .unlocked: return true
        case .foundation: return modality == .reading
        case .locked: return false
        }
    }

    /// The learner-facing unlock condition for a modality, worded in ONE place
    /// (`ReadinessCopy`) from this store's real readings; nil when unlocked. For
    /// Reading in the bridge state this is the bridge note, not a lock.
    func unlockCondition(for modality: LearningModality) -> String? {
        ReadinessCopy.unlockCondition(for: modality,
                                      readiness: readiness(for: modality),
                                      readingReadiness: readiness(for: .reading),
                                      readingMinutes: totalMinutes(.reading),
                                      governorActive: isGovernorActive)
    }

    /// Modalities the learner chose in Preferences that are still locked — Home
    /// lists them as disabled plan rows with their unlock condition (D1/D2).
    var lockedChosenModalities: [LearningModality] {
        let prefs = preferences ?? .default
        return LearningModality.allCases.filter { prefs.modalities.contains($0) && readiness(for: $0) != .unlocked }
    }

    // MARK: Activity credit (D9)

    /// The plan target one activity session is measured against: today's minutes
    /// row for the modality, the unlock item's bar when that is the day's action,
    /// otherwise the time budget (an activity outside the plan still counts, but
    /// no more than a day's worth).
    func planTargetMinutes(for modality: LearningModality, now: Date = Date()) -> Int {
        let plan = todaysPlan(now: now)
        if let row = plan.minuteItems.first(where: { $0.modality == modality }) { return row.target }
        if let unlock = plan.unlockItem, unlock.modality == modality { return unlock.target }
        return (preferences ?? .default).timeBudget.minutes
    }

    /// Credit one activity session's FOREGROUND seconds to the modality, capped at
    /// the plan target × `Tuning.activityCreditCapMultiplier` (a surface left open
    /// never pads the day). Returns the minutes credited.
    @discardableResult
    func creditActivity(_ modality: LearningModality, activeSeconds: TimeInterval, now: Date = Date()) -> Int {
        let cap = ActivityCredit.capMinutes(planTargetMinutes: planTargetMinutes(for: modality, now: now))
        let minutes = ActivityCredit.minutes(activeSeconds: activeSeconds, capMinutes: cap)
        guard minutes > 0 else { return 0 }
        recordActivityMinutes(modality, minutes: minutes, now: now)
        // The unlock item keeps its promise the moment it is met (D2): the gate reads
        // the new minutes live, so record the opened modalities and re-plan the day
        // now rather than leaving "Start with Reading" as the primary action until
        // the next lesson end. `refreshUnlocks` is what makes Home's
        // onChange(unlockedModalities) fire as well.
        if let unlock = dailyPlanOfRecord?.unlockItem, unlock.modality == modality,
           totalMinutes(modality) >= unlock.target {
            refreshUnlocks(now: now)
            recomputePlan(now: now)
        }
        return minutes
    }

    // MARK: Retention evidence (D19)

    /// True once at least one learner-visible gap has been reviewed. Before that
    /// `overallRetention` / `gapHealth` have nothing to average and return 100 as a
    /// neutral default — a value no screen should draw as a full ring or "Healthy".
    var hasRetentionEvidence: Bool {
        visibleGaps.contains { !$0.isNew }
    }
}

extension AppStore {
    // MARK: Package D-flow — placement / preferences / deck / retention store methods

    // MARK: Due now / coming up (D13) — the ONLY two "due" numbers any screen shows

    /// "Due now": every learner-visible gap whose schedule wants it at `now` — unmastered
    /// gaps at or past `nextReviewAt`, plus mastered gaps due for a check
    /// (`dueMasteredGaps`). Probes never count.
    func dueNow(at now: Date) -> [GapItem] {
        visibleGaps.filter { $0.nextReviewAt <= now } + dueMasteredGaps(at: now)
    }

    var dueNow: [GapItem] { dueNow(at: Date()) }

    /// "Coming up": gaps due within `Tuning.upcomingWindowDays` that are not due now —
    /// unmastered gaps scheduled inside the window, and mastered gaps whose next
    /// check falls inside it. Disjoint from `dueNow`.
    func upcoming(at now: Date) -> [GapItem] {
        let horizon = now.addingTimeInterval(Tuning.upcomingWindowDays * 86_400)
        let unmastered = visibleGaps.filter { $0.nextReviewAt > now && $0.nextReviewAt <= horizon }
        let mastered = masteredGaps.filter {
            !$0.isDueForMasteryCheck(at: now) && $0.nextReviewAt > now && $0.nextReviewAt <= horizon
        }
        return unmastered + mastered
    }

    var upcoming: [GapItem] { upcoming(at: Date()) }

    // MARK: Foundation seeding (D3 / D4 / D10)

    /// The Foundation gaps of `conceptIds` from the curriculum content, in concept
    /// order, staggered so about `Tuning.foundationSeedBatch` items come due per day
    /// from `now`. Skips items already present (`existingIds`) and headwords the
    /// placement captured as missed items (`excludedHeadwords`).
    func foundationSlice(conceptIds: [String], excludedHeadwords: Set<String> = [],
                         existingIds: Set<String> = [], now: Date = Date()) -> [GapItem] {
        let slice = FoundationSeeder.slice(from: foundationContent(now), conceptIds: conceptIds,
                                           excludedHeadwords: excludedHeadwords, existingIds: existingIds)
        return FoundationSeeder.staggered(slice, batch: Tuning.foundationSeedBatch, now: now, calendar: calendar)
    }

    /// True once the bridge slice (every non-base concept up to A2) has been seeded.
    var hasBridgeContent: Bool {
        let bridge = Set(FoundationSeeder.bridgeConceptIds)
        return gaps.contains { $0.sourceType == .foundation && !$0.isProbe && bridge.contains($0.conceptId ?? "") }
    }

    /// Seed the A2 bridge slice once reading is open (D3/D4): the Foundation gaps of
    /// every non-base concept up to A2, staggered like the first-run slice. A no-op
    /// while reading is locked or when the slice is already present, so it is safe
    /// to call from any bookkeeping point (placement, lesson end, unlock refresh).
    /// Returns how many gaps were added.
    @discardableResult
    func seedBridgeContentIfNeeded(now: Date = Date()) -> Int {
        guard readiness(for: .reading) == .unlocked, !hasBridgeContent else { return 0 }
        let existingHeadwords = Set(gaps.map { FoundationSeeder.headwordKey($0.frenchWord) })
        let slice = foundationSlice(conceptIds: FoundationSeeder.bridgeConceptIds,
                                    excludedHeadwords: existingHeadwords,
                                    existingIds: Set(gaps.map { $0.id }), now: now)
        guard !slice.isEmpty else { return 0 }
        gaps.append(contentsOf: slice)
        save()
        return slice.count
    }

    /// Base concepts the Foundation track has actually seeded content for — the
    /// denominator of the Foundation progress bar (D10). Every base concept when
    /// nothing has been seeded yet, so the bar never divides by zero.
    var foundationSeedConceptIds: [String] {
        let seeded = Set(gaps.compactMap { gap -> String? in
            guard gap.sourceType == .foundation, !gap.isProbe, let cid = gap.conceptId,
                  ConceptTaxonomy.baseConceptIds.contains(cid) else { return nil }
            return cid
        })
        let ordered = FoundationSeeder.baseConceptIds.filter { seeded.contains($0) }
        return ordered.isEmpty ? FoundationSeeder.baseConceptIds : ordered
    }

    /// Denominator of the Foundation progress bar: seeded base concepts (D10).
    var foundationSeedTotal: Int { foundationSeedConceptIds.count }

    /// Numerator of the Foundation progress bar: seeded base concepts with VERIFIED
    /// mastery — the same standard `foundationMastered` and coverage use.
    var foundationSeededMastered: Int {
        let ids = Set(foundationSeedConceptIds)
        return concepts.filter { ids.contains($0.id) && $0.isVerifiedMastered }.count
    }

    // MARK: Weekly goal (D11)

    /// Days this calendar week with a completed lesson against the learner's
    /// `daysPerWeekGoal`; nil when no goal is set.
    func weeklyGoalProgress(now: Date) -> (done: Int, goal: Int)? {
        guard let goal = preferences?.daysPerWeekGoal, goal > 0 else { return nil }
        guard let week = calendar.dateInterval(of: .weekOfYear, for: now) else { return (0, goal) }
        var done = 0
        var cursor = week.start
        while cursor < week.end {
            if lessonsCompleted(on: cursor) > 0 { done += 1 }
            guard let next = calendar.date(byAdding: .day, value: 1, to: cursor) else { break }
            cursor = next
        }
        return (min(done, goal), goal)
    }

    var weeklyGoalProgress: (done: Int, goal: Int)? { weeklyGoalProgress(now: Date()) }
}

extension AppStore {
    // MARK: Package E-read — reading / capture / tagger store methods

    /// The content lexicon the tagger reads (built once, on first use).
    var tagLexicon: [String: String] {
        if let cachedTagLexicon { return cachedTagLexicon }
        let built = tagLexiconProvider()
        cachedTagLexicon = built
        return built
    }

    /// Wait until every queued tag request has landed (tests and diagnostics).
    func awaitPendingTags() async {
        var pending = tagChain
        while let chain = pending {
            await chain.value
            pending = tagChain == chain ? nil : tagChain
        }
    }

    // MARK: Capture from a draft (E4 / E6 / E7)

    /// Turn a capture draft into a scheduled, deduped gap. Category, level and
    /// difficulty come from `CaptureBuilder` (gloss detail + source level + the
    /// learner's level); `irtDifficulty` and the FSRS state from the store
    /// factory. A draft with no meaning is saved with `needsTranslation = true`
    /// and an empty `englishTranslation` — never a placeholder string — and is
    /// resolved later by `resolvePendingTranslations(using:)`. A draft that names
    /// a concept the learner has is linked to it directly (content-known, no
    /// confidence); otherwise tagging is queued. Returns what happened so the
    /// surface can say "Saved" / "Already in your deck".
    @discardableResult
    func capture(_ draft: CaptureDraft, now: Date = Date()) -> CaptureOutcome {
        let word = draft.frenchWord.trimmingCharacters(in: .whitespacesAndNewlines)
        // A headword has to be a word: "2030" or "%" picked out of an article body
        // is text, not vocabulary, and must never become a card.
        guard word.contains(where: { $0.isLetter }) else { return .rejected }
        if let existing = existingGap(forWord: word) { return .duplicate(existing) }

        let level = CaptureBuilder.level(sourceLevel: draft.sourceLevel, learnerLevel: learnerLevel)
        let category = CaptureBuilder.category(explicit: draft.category, partOfSpeech: draft.partOfSpeech,
                                               register: draft.register, frenchWord: word)
        let difficulty = CaptureBuilder.difficulty(explicit: draft.difficulty, level: level,
                                                   learnerLevel: learnerLevel, register: draft.register)
        let note = draft.note.trimmingCharacters(in: .whitespacesAndNewlines)
        let explanation = [draft.explanation.trimmingCharacters(in: .whitespacesAndNewlines),
                           note.isEmpty ? "" : "Note: \(note)"]
            .filter { !$0.isEmpty }.joined(separator: " · ")
        let context = draft.contextSentence.trimmingCharacters(in: .whitespacesAndNewlines)
        // The example is the gloss's own sentence, else the sentence the word was
        // met in — never the bare term.
        let example = draft.exampleSentence.trimmingCharacters(in: .whitespacesAndNewlines)
        let exampleSentence = example.isEmpty ? context : example
        let exampleTranslation = example.isEmpty ? "" : draft.exampleTranslation
        let translation = draft.needsTranslation ? "" : draft.englishTranslation.trimmingCharacters(in: .whitespacesAndNewlines)
        let linked = concept(draft.conceptId)

        var gap = makeCapturedGap(
            frenchWord: word,
            englishTranslation: translation,
            explanation: explanation,
            exampleSentence: exampleSentence,
            exampleTranslation: exampleTranslation,
            pronunciation: draft.pronunciation,
            sourceType: draft.sourceType,
            category: category,
            cefrLevel: level,
            difficulty: difficulty,
            partOfSpeech: draft.partOfSpeech,
            gender: draft.gender,
            article: draft.article,
            baseForm: draft.baseForm,
            register: draft.register,
            relatedWords: draft.relatedWords,
            originalContext: context.isEmpty ? nil : OriginalContext(sentence: context, translation: nil,
                                                                      sourceTab: draft.sourceTab, capturedAt: now,
                                                                      reExposureCount: 0),
            conceptId: linked?.id,
            now: now
        )
        gap.needsTranslation = translation.isEmpty
        gap.isTestable = draft.isTestable
        guard captureGap(gap) else {
            return existingGap(forWord: word).map { .duplicate($0) } ?? .rejected
        }
        return .saved(gaps.first { $0.id == gap.id } ?? gap)
    }

    // MARK: Pending translations (E4)

    /// Gaps captured without a meaning that still need one.
    var pendingTranslations: [GapItem] {
        gaps.filter { $0.needsTranslation && !$0.isProbe }
    }

    /// Fill a pending gap in from a real gloss: meaning, example (when it had
    /// none), pronunciation and dictionary detail. A gloss with no meaning is
    /// ignored. Once the gap has English the tagger has something to work with,
    /// so tagging is queued if it is still untagged.
    @discardableResult
    func applyResolvedTranslation(gapId: String, gloss: WordGloss) -> Bool {
        guard gloss.isUsable, let idx = gaps.firstIndex(where: { $0.id == gapId }) else { return false }
        gaps[idx].englishTranslation = gloss.translation.trimmingCharacters(in: .whitespacesAndNewlines)
        gaps[idx].needsTranslation = false
        if gaps[idx].explanation.isEmpty || gaps[idx].explanation.hasPrefix("Note:") {
            let note = gaps[idx].explanation
            gaps[idx].explanation = [gloss.explanation, note].filter { !$0.isEmpty }.joined(separator: " · ")
        }
        if !gloss.example.isEmpty, gaps[idx].exampleSentence.isEmpty || gaps[idx].exampleSentence == gaps[idx].originalContext?.sentence {
            gaps[idx].exampleSentence = gloss.example
            gaps[idx].exampleTranslation = gloss.exampleTranslation
        }
        if gaps[idx].pronunciation == nil, !gloss.pronunciation.isEmpty { gaps[idx].pronunciation = gloss.pronunciation }
        if gaps[idx].partOfSpeech == nil, !gloss.partOfSpeech.isEmpty { gaps[idx].partOfSpeech = gloss.partOfSpeech }
        if gaps[idx].gender == nil, !gloss.gender.isEmpty { gaps[idx].gender = gloss.gender }
        if gaps[idx].article == nil, !gloss.article.isEmpty { gaps[idx].article = gloss.article }
        if gaps[idx].baseForm == nil, !gloss.baseForm.isEmpty { gaps[idx].baseForm = gloss.baseForm }
        if gaps[idx].register == nil, !gloss.register.isEmpty { gaps[idx].register = gloss.register }
        if gaps[idx].relatedWords == nil, !gloss.relatedWords.isEmpty { gaps[idx].relatedWords = gloss.relatedWords }
        // The category may have been a guess without dictionary detail; re-derive
        // from what the gloss says (an explicit concept link keeps its category).
        if gaps[idx].conceptId == nil {
            gaps[idx].category = CaptureBuilder.category(explicit: nil, partOfSpeech: gaps[idx].partOfSpeech,
                                                         register: gaps[idx].register, frenchWord: gaps[idx].frenchWord)
        }
        save()
        tagConcept(for: gapId)
        return true
    }

    /// Retry the pending captures now that a lookup has just succeeded (so the
    /// network is evidently reachable). At most `limit` gaps per pass, least-tried
    /// first and oldest first within that. The pass stops early ONLY when the
    /// device is offline or the build has no key — nothing else could succeed
    /// either. A per-term `.serviceError` (or a gloss that came back without a
    /// meaning) is counted against that gap and skipped, so one word the service
    /// cannot parse never blocks every other word saved offline —
    /// `Tuning.pendingTranslationFailureStreak` failures in a row do end the pass,
    /// because that is the service being down rather than one odd word. Returns how
    /// many were resolved. `resolver` is `TranslationService.lookup` in the app and a
    /// fake in tests.
    @discardableResult
    func resolvePendingTranslations(using resolver: (String, String) async -> GlossLookup,
                                    limit: Int = Tuning.pendingTranslationBatch) async -> Int {
        guard !isResolvingTranslations else { return 0 }
        isResolvingTranslations = true
        defer { isResolvingTranslations = false }
        let batch = pendingTranslations
            .sorted { a, b in
                let ta = translationAttempts[a.id] ?? 0, tb = translationAttempts[b.id] ?? 0
                if ta != tb { return ta < tb }
                return a.createdAt < b.createdAt
            }
            .prefix(max(0, limit))
        var resolved = 0
        var failureStreak = 0
        for gap in batch {
            let context = gap.originalContext?.sentence ?? ""
            switch await resolver(gap.frenchWord, context) {
            case .gloss(let g):
                if applyResolvedTranslation(gapId: gap.id, gloss: g) {
                    resolved += 1
                    failureStreak = 0
                    translationAttempts[gap.id] = nil
                } else {
                    failureStreak += 1
                    translationAttempts[gap.id, default: 0] += 1
                }
            case .unavailable(let failure):
                // Offline / no key: the rest of the batch would fail the same way.
                guard failure == .serviceError else { return resolved }
                // This one term failed. Note it so it goes last next time, and
                // carry on with the words behind it.
                failureStreak += 1
                translationAttempts[gap.id, default: 0] += 1
            }
            // Several in a row is the service being down, not one odd word.
            if failureStreak >= Tuning.pendingTranslationFailureStreak { return resolved }
        }
        return resolved
    }
}

extension AppStore {
    // MARK: Package E-talk — converse / speaking store methods

    /// Minutes practiced in a modality over the last `Tuning.speakStatsWindowDays`
    /// days, today included (the Speak header's "this week").
    func minutesThisWeek(_ modality: LearningModality, now: Date = Date()) -> Int {
        let days = max(1, Tuning.speakStatsWindowDays)
        var total = 0
        for offset in 0..<days {
            guard let day = calendar.date(byAdding: .day, value: -offset, to: now) else { continue }
            total += activityProgress["\(dayKey(day))|\(modality.rawValue)"] ?? 0
        }
        return total
    }

    /// What one round of speaking feedback left behind (E13).
    nonisolated struct SpeakFeedbackOutcome: Equatable {
        /// Gaps newly saved to the deck (the corrected line and/or the natural phrasing).
        var savedGaps: [GapItem] = []
        /// Planned gaps that were already in the deck (nothing re-added).
        var duplicateCount: Int = 0
        /// Concepts that received a miss.
        var missedConceptIds: [String] = []
        /// Concepts that received a hit.
        var strongConceptIds: [String] = []

        var savedCount: Int { savedGaps.count }
        var recordedEvidence: Bool { !missedConceptIds.isEmpty || !strongConceptIds.isEmpty }
    }

    /// The note a speaking gap carries: the feedback's explanation plus the
    /// prompt the learner was answering, so the card keeps why the phrase exists.
    nonisolated static func speakGapExplanation(_ explanation: String, promptText: String) -> String {
        let prompt = promptText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !prompt.isEmpty else { return explanation }
        return explanation.isEmpty ? "Prompt: \(prompt)" : "\(explanation) · Prompt: \(prompt)"
    }

    /// Speaking feedback → deck and evidence (E13): the corrected and the natural
    /// phrasing become gaps through the capture factory (deduped on the headword),
    /// carrying the English the feedback supplied — or waiting for a translation
    /// when it gave none, never an empty answer that is treated as a meaning. The
    /// corrected gap starts with the miss the learner just made, the prompt they
    /// were answering is kept on the card, and every concept the feedback names —
    /// validated against the taxonomy by the parser — gets speaking evidence. The
    /// learner's own unchanged line is never saved.
    @discardableResult
    func recordSpeakFeedback(original: String, feedback: SpeakFeedback, promptText: String,
                             now: Date = Date()) -> SpeakFeedbackOutcome {
        var outcome = SpeakFeedbackOutcome()
        let specs = SpeakGapPlan.specs(original: original, feedback: feedback)
        for spec in specs {
            if let existing = existingGap(forWord: spec.french) {
                outcome.duplicateCount += 1
                if spec.kind == .corrected {
                    recordAnswer(gapId: existing.id, correct: false, format: .speaking, firstTry: true, now: now)
                }
                continue
            }
            let linked = concept(spec.conceptId)
            let english = spec.english.trimmingCharacters(in: .whitespacesAndNewlines)
            var gap = makeCapturedGap(
                frenchWord: spec.french,
                englishTranslation: english,
                explanation: Self.speakGapExplanation(spec.explanation, promptText: promptText),
                exampleSentence: spec.french,
                exampleTranslation: english,
                sourceType: .speech,
                category: linked?.category ?? .phrasing,
                cefrLevel: linked?.cefrLevel,
                originalContext: OriginalContext(sentence: spec.originalFrench, translation: nil, sourceTab: "speak",
                                                 capturedAt: now, reExposureCount: 0),
                conceptId: linked?.id,
                now: now
            )
            gap.needsTranslation = english.isEmpty
            guard captureGap(gap) else { outcome.duplicateCount += 1; continue }
            if spec.kind == .corrected {
                recordAnswer(gapId: gap.id, correct: false, format: .speaking, firstTry: true, now: now)
            }
            if let saved = gaps.first(where: { $0.id == gap.id }) { outcome.savedGaps.append(saved) }
        }
        for id in feedback.mistakeConceptIds where concept(id) != nil {
            recordSpeakingEvidence(conceptId: id, correct: false, now: now)
            outcome.missedConceptIds.append(id)
        }
        for id in feedback.strongConceptIds where concept(id) != nil && !outcome.missedConceptIds.contains(id) {
            recordSpeakingEvidence(conceptId: id, correct: true, now: now)
            outcome.strongConceptIds.append(id)
        }
        if !specs.isEmpty || outcome.recordedEvidence { save() }
        return outcome
    }

    /// Every tutor correction from a Converse call, saved as the CORRECTED line
    /// with the slip recorded against it (E10). Returns the gap each correction
    /// landed on, keyed by the correction id, so the recap can show what was kept.
    @discardableResult
    func recordConverseCorrections(_ corrections: [ConverseCorrection], now: Date = Date()) -> [UUID: GapItem] {
        var result: [UUID: GapItem] = [:]
        for correction in corrections {
            let gap = recordConverseCorrection(
                originalFrench: correction.originalFrench,
                correctedFrench: correction.correctedFrench,
                explanation: correction.explanation,
                conceptId: correction.conceptId,
                englishTranslation: correction.englishTranslation,
                now: now
            )
            if let gap { result[correction.id] = gap }
        }
        if !result.isEmpty { save() }
        return result
    }

    /// A tutor line from a Converse call saved as said (E9). English may be empty
    /// (older reply shape) — then the gap waits for a translation rather than
    /// carrying a placeholder. Returns false when the phrase was already in the deck.
    @discardableResult
    func captureConversePhrase(french: String, english: String, scenarioTitle: String, now: Date = Date()) -> Bool {
        let phrase = french.trimmingCharacters(in: .whitespacesAndNewlines)
        let translation = english.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !phrase.isEmpty else { return false }
        var gap = makeCapturedGap(
            frenchWord: phrase,
            englishTranslation: translation,
            explanation: "Phrase from your “\(scenarioTitle)” conversation.",
            exampleSentence: phrase,
            exampleTranslation: translation,
            sourceType: .speech,
            category: .phrasing,
            originalContext: OriginalContext(sentence: phrase, translation: translation.isEmpty ? nil : translation,
                                             sourceTab: "converse", capturedAt: now, reExposureCount: 0),
            now: now
        )
        gap.needsTranslation = translation.isEmpty
        guard captureGap(gap) else { return false }
        save()
        return true
    }
}

extension AppStore {
    // MARK: Package E-media — listening / watching store methods

    /// What a hold-to-capture on a dialogue left behind (E8).
    nonisolated struct ListeningCaptureOutcome: Equatable {
        /// Gaps newly saved, one per dialogue line.
        var savedGaps: [GapItem] = []
        /// Lines that were already in the deck (nothing re-added).
        var duplicateCount: Int = 0

        var savedCount: Int { savedGaps.count }
    }

    /// Save ONE dialogue line as a gap (E8 / E7): the turn's own French as the
    /// headword, the turn's own English as the translation, `.phrasing`, the
    /// dialogue's level as the gap's level and the difficulty relative to the
    /// learner from `CaptureBuilder`. Built through the capture factory so it
    /// starts scheduled, and deduped on the headword by `captureGap`.
    @discardableResult
    func captureListeningTurn(_ spec: ListeningCaptureSpec, from item: ListeningItem, now: Date = Date()) -> CaptureOutcome {
        let french = spec.french.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !french.isEmpty else { return .rejected }
        if let existing = existingGap(forWord: french) { return .duplicate(existing) }
        let english = spec.english.trimmingCharacters(in: .whitespacesAndNewlines)
        let level = item.difficulty.captureLevel
        let difficulty = CaptureBuilder.difficulty(explicit: nil, level: level, learnerLevel: learnerLevel, register: nil)
        var gap = makeCapturedGap(
            frenchWord: french,
            englishTranslation: english,
            explanation: ListeningCapture.explanation(for: item),
            exampleSentence: french,
            exampleTranslation: english,
            sourceType: .listening,
            category: .phrasing,
            cefrLevel: level,
            difficulty: difficulty,
            originalContext: OriginalContext(sentence: french, translation: english.isEmpty ? nil : english,
                                             sourceTab: "listen", capturedAt: now, reExposureCount: 0),
            now: now
        )
        gap.needsTranslation = english.isEmpty
        guard captureGap(gap) else {
            return existingGap(forWord: french).map { .duplicate($0) } ?? .rejected
        }
        return .saved(gaps.first { $0.id == gap.id } ?? gap)
    }

    /// Save every line of a hold-to-capture selection, one gap per turn — never a
    /// joined passage (E8). Persists once at the end.
    @discardableResult
    func captureListeningTurns(_ specs: [ListeningCaptureSpec], from item: ListeningItem, now: Date = Date()) -> ListeningCaptureOutcome {
        var outcome = ListeningCaptureOutcome()
        for spec in specs {
            switch captureListeningTurn(spec, from: item, now: now) {
            case .saved(let gap): outcome.savedGaps.append(gap)
            case .duplicate: outcome.duplicateCount += 1
            case .rejected: break
            }
        }
        if !outcome.savedGaps.isEmpty { save() }
        return outcome
    }
}
