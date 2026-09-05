//
//  AppStore.swift
//  FluentFrenchIOS
//
//  Central observable state: gaps, errors, learner ability (IRT), persistence,
//  and the computed analytics the UI reads (schedule, retention, streak).
//

import SwiftUI

@MainActor
@Observable
final class AppStore {
    var gaps: [GapItem] = []
    var concepts: [Concept] = []
    var errors: [ErrorRecord] = []
    var abilityTheta: Double = 0.0
    var masteryDays: Set<String> = []   // ISO "yyyy-MM-dd" days a word was mastered/reviewed correctly
    var hasCompletedAssessment: Bool = false
    var assessedLevel: CEFRLevel = .A1
    /// Monotonic counter incremented per lesson; used to damp recently-taught concepts.
    var sessionIndex: Int = 0
    /// The learner's plan constraints (the "floor"). Nil until onboarding sets it.
    var preferences: UserPreferences? = nil
    var hasSetPreferences: Bool { preferences != nil }

    /// Minutes practiced per activity, keyed "yyyy-MM-dd|modality" (today's plan progress).
    var activityProgress: [String: Int] = [:]
    /// Count of gaps captured since the last consolidated lesson was offered (trigger).
    var gapsSinceLastLesson: Int = 0
    /// Lessons completed since the last capstone quiz (capstone cadence).
    var lessonsSinceCapstone: Int = 0

    /// Timestamp of the last real, user-driven mutation. Drives newest-wins cloud
    /// reconciliation. Nil until the learner has actually changed something.
    var localUpdatedAt: Date? = nil

    /// Trace of every selection that became a lesson (mode, target, item roles).
    /// In-memory instrumentation; not part of the persisted snapshot.
    var selectionLog = SelectionLog()

    /// Cloud backup coordinator. Set once the learner is signed in; nil otherwise.
    /// Mutations notify it (debounced) so the cloud always holds the latest.
    weak var cloud: CloudSync?

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
    private let gapsSinceLessonKey = "ff.gapsSinceLesson.v1"
    private let lessonsSinceCapstoneKey = "ff.lessonsSinceCapstone.v1"
    private let localUpdatedAtKey = "ff.localUpdatedAt.v1"

    /// Where state persists. `nil` means in-memory only: nothing is read from or
    /// written to UserDefaults. The headless driver and tests use that so the
    /// REAL engine runs on synthetic gaps/concepts without touching a device.
    private let persistence: UserDefaults?

    init(persistence: UserDefaults? = .standard) {
        self.persistence = persistence
        load()
    }

    // MARK: - Derived collections

    var activeGaps: [GapItem] {
        gaps.filter { !$0.isMastered }
    }

    var masteredGaps: [GapItem] {
        gaps.filter { $0.isMastered }
    }

    func gaps(in category: GapCategory) -> [GapItem] {
        activeGaps.filter { $0.category == category }
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

    /// Give a blind-spot probe a gap record to be scored against. The selector
    /// decides THAT a never-observed frontier concept is probed; this only creates
    /// (or reuses) the one-item diagnostic so its answer lands on the concept like
    /// any other evidence. Persisted with the rest of the lesson's bookkeeping.
    @discardableResult
    func materializeProbeGap(id: String, for concept: Concept, now: Date = Date()) -> GapItem {
        if let existing = gaps.first(where: { $0.id == id }) { return existing }
        let probe = GapItem(
            id: id,
            frenchWord: concept.name,
            englishTranslation: concept.description,
            explanation: "Quick check: \(concept.description)",
            exampleSentence: "",
            exampleTranslation: "",
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
            irtDifficulty: 0,
            fsrs: nil,
            originalContext: nil,
            confusionLinks: [],
            conceptId: concept.id
        )
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
            pool = (criticalGaps(at: now) + dueGaps(at: now)).filter { $0.category == category }
        case .reviewQueue:
            pool = reviewQueue(at: now)
        case .critical:
            pool = criticalGaps(at: now)
        case .mixed:
            pool = activeGaps
        case .retention(let bucket):
            let buckets = retention(at: now)
            switch bucket {
            case .atRisk: pool = buckets.atRisk
            case .fading: pool = buckets.fading
            case .fresh: pool = buckets.fresh
            case .mastered: pool = buckets.mastered
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
    @discardableResult
    func completeLesson(targetConceptId: String?, isCapstone: Bool) -> [String] {
        sessionIndex += 1
        if let targetConceptId,
           let idx = concepts.firstIndex(where: { $0.id == targetConceptId }) {
            concepts[idx].lastTaughtSession = sessionIndex
        }
        // Capstone resets the cadence counter; normal lessons advance it.
        if isCapstone {
            lessonsSinceCapstone = 0
        } else {
            lessonsSinceCapstone += 1
        }
        clearUnlockFlags()
        let unlocked = expandFrontier()
        save()
        return unlocked
    }

    // MARK: - Daily plan progress (Today screen)

    private func progressKey(_ modality: LearningModality, _ date: Date = Date()) -> String {
        "\(Self.dayKey(date))|\(modality.rawValue)"
    }

    /// Minutes practiced for an activity today.
    func minutesToday(_ modality: LearningModality) -> Int {
        activityProgress[progressKey(modality)] ?? 0
    }

    /// Credit time spent in an activity surface to today's plan progress.
    func recordActivityMinutes(_ modality: LearningModality, minutes: Int) {
        guard minutes > 0 else { return }
        let key = progressKey(modality)
        activityProgress[key] = (activityProgress[key] ?? 0) + minutes
        save()
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
    /// only when nothing fits). Non-blocking — capture stays instant.
    func tagConcept(for gapId: String) {
        guard let gap = gaps.first(where: { $0.id == gapId }), gap.conceptId == nil else { return }
        let snapshot = concepts
        Task { [weak self] in
            guard let result = await ConceptTagger.tag(gap: gap, concepts: snapshot) else { return }
            self?.applyConceptTag(result, to: gapId)
        }
    }

    private func applyConceptTag(_ result: ConceptTagResult, to gapId: String) {
        guard let idx = gaps.firstIndex(where: { $0.id == gapId }) else { return }
        switch result {
        case .existing(let cid):
            guard concepts.contains(where: { $0.id == cid }) else { return }
            gaps[idx].conceptId = cid
        case .new(let concept):
            if !concepts.contains(where: { $0.id == concept.id }) {
                concepts.append(concept)
            }
            gaps[idx].conceptId = concept.id
        }
        save()
    }

    // MARK: - Per-concept mastery

    /// Update a concept's Beta evidence when a lesson item tied to it is answered.
    func recordConceptAnswer(conceptId: String?, correct: Bool, weight: Double = 1, now: Date = Date()) {
        guard let conceptId, let idx = concepts.firstIndex(where: { $0.id == conceptId }) else { return }
        if correct { concepts[idx].alpha += weight } else { concepts[idx].beta += weight }
        concepts[idx].lastTestedAt = now
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
    /// mastered. Stands in for lexical coverage: the readiness gate keys off it.
    var baseCoverage: Double {
        let base = concepts.filter { ConceptTaxonomy.baseConceptIds.contains($0.id) }
        guard !base.isEmpty else { return 1 }
        let mastered = base.filter { $0.isMastered }.count
        return Double(mastered) / Double(base.count)
    }

    /// Cumulative minutes ever practiced in a modality (proof of demonstrated
    /// performance, summed across days).
    func totalMinutes(_ modality: LearningModality) -> Int {
        let suffix = "|\(modality.rawValue)"
        return activityProgress.filter { $0.key.hasSuffix(suffix) }.values.reduce(0, +)
    }

    /// The readiness verdict for a modality. Reading gates on coverage (self-paced);
    /// higher modalities gate on Reading being open PLUS demonstrated performance.
    func readiness(for modality: LearningModality, config: ReadinessConfig = .tuning) -> ModalityReadiness {
        let cov = baseCoverage
        switch modality {
        case .reading:
            if cov >= config.readingUnlock { return .unlocked }
            if cov >= config.readingBridge { return .foundation }
            return .locked
        default:
            guard readiness(for: .reading, config: config) == .unlocked else { return .locked }
            if cov >= config.higherUnlock || totalMinutes(.reading) >= config.higherDemonstratedMinutes {
                return .unlocked
            }
            return .locked
        }
    }

    /// True while the learner hasn't yet cleared the Reading bar — Home shows the
    /// Foundation track instead of the open daily plan.
    var isInFoundation: Bool { readiness(for: .reading) != .unlocked }

    /// Predict whether placement results would land the learner in Foundation —
    /// used by the results screen BEFORE the results are applied to state.
    func willEnterFoundation(after result: PlacementResult, config: ReadinessConfig = .tuning) -> Bool {
        if result.isTrueBeginner { return true }
        let base = ConceptTaxonomy.baseConceptIds
        guard !base.isEmpty else { return false }
        let mastered = result.masteredConceptIds.filter { base.contains($0) }.count
        let coverage = Double(mastered) / Double(base.count)
        return coverage < config.readingUnlock
    }

    // The Foundation "next concept" is whatever the selector would teach next
    // (SelectionOutput.targetConceptId) — there is no separate CEFR-ordered spine.

    var foundationMastered: Int {
        concepts.filter { ConceptTaxonomy.baseConceptIds.contains($0.id) && $0.isMastered }.count
    }

    var foundationTotal: Int { ConceptTaxonomy.baseConceptIds.count }

    func stats(for category: GapCategory) -> (active: Int, mastered: Int) {
        let all = gaps.filter { $0.category == category }
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

    func criticalGaps(at now: Date) -> [GapItem] {
        activeGaps.filter { $0.nextReviewAt < now.addingTimeInterval(-86_400) }
    }

    func dueGaps(at now: Date) -> [GapItem] {
        activeGaps.filter { $0.nextReviewAt <= now && $0.nextReviewAt >= now.addingTimeInterval(-86_400) }
    }

    func reviewQueue(at now: Date) -> [GapItem] {
        activeGaps
            .filter { $0.nextReviewAt <= now.addingTimeInterval(3 * 86_400) }
            .sorted { $0.retrievability(at: now) < $1.retrievability(at: now) }
    }

    var gapHealth: (score: Int, label: String) {
        guard !activeGaps.isEmpty else { return (100, "All clear") }
        let avg = activeGaps.map { $0.retrievability }.reduce(0, +) / Double(activeGaps.count)
        let score = Int((avg * 100).rounded())
        let label: String
        if score >= 70 { label = "Healthy" }
        else if score >= 50 { label = "Needs attention" }
        else { label = "At risk" }
        return (score, label)
    }

    // MARK: - Retention analytics

    struct RetentionBuckets {
        var fresh: [GapItem] = []     // r >= 0.8
        var fading: [GapItem] = []    // 0.5 <= r < 0.8
        var atRisk: [GapItem] = []    // r < 0.5
        var mastered: [GapItem] = []
    }

    var retention: RetentionBuckets { retention(at: Date()) }

    func retention(at now: Date) -> RetentionBuckets {
        var b = RetentionBuckets()
        for gap in gaps {
            if gap.isMastered { b.mastered.append(gap); continue }
            let r = gap.retrievability(at: now)
            if r >= 0.8 { b.fresh.append(gap) }
            else if r >= 0.5 { b.fading.append(gap) }
            else { b.atRisk.append(gap) }
        }
        return b
    }

    var overallRetention: Int {
        guard !activeGaps.isEmpty else { return 100 }
        let avg = activeGaps.map { $0.retrievability }.reduce(0, +) / Double(activeGaps.count)
        return Int((avg * 100).rounded())
    }

    var masteredThisWeek: Int {
        let weekAgo = Date().addingTimeInterval(-7 * 86_400)
        return gaps.filter { ($0.masteredAt ?? .distantPast) >= weekAgo }.count
    }

    // MARK: - Mastery streak

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func dayKey(_ date: Date) -> String { dayFormatter.string(from: date) }

    var currentStreak: Int {
        var streak = 0
        var cursor = Date()
        // Allow today to be empty without breaking the streak.
        if !masteryDays.contains(Self.dayKey(cursor)) {
            cursor = cursor.addingTimeInterval(-86_400)
        }
        while masteryDays.contains(Self.dayKey(cursor)) {
            streak += 1
            cursor = cursor.addingTimeInterval(-86_400)
        }
        return streak
    }

    var longestStreak: Int {
        let keys = masteryDays.sorted()
        guard !keys.isEmpty else { return 0 }
        var longest = 1, run = 1
        for i in 1..<max(1, keys.count) {
            guard let prev = Self.dayFormatter.date(from: keys[i - 1]),
                  let cur = Self.dayFormatter.date(from: keys[i]) else { continue }
            if Int(cur.timeIntervalSince(prev) / 86_400) == 1 { run += 1 } else { run = 1 }
            longest = max(longest, run)
        }
        return longest
    }

    /// Did the learner master a word on the given day (for the 7-day grid)?
    func masteredOn(_ date: Date) -> Bool {
        masteryDays.contains(Self.dayKey(date))
    }

    // MARK: - Error patterns

    struct ErrorPattern: Identifiable {
        var id: String
        var category: GapCategory
        var conceptLabel: String
        var count: Int
        var share: Double          // fraction of all errors
        var records: [ErrorRecord]
        var headline: String
    }

    var errorPatterns: [ErrorPattern] {
        guard !errors.isEmpty else { return [] }
        let total = Double(errors.count)
        let grouped = Dictionary(grouping: errors, by: { $0.conceptLabel })
        return grouped.map { label, records in
            let share = Double(records.count) / total
            let pct = Int((share * 100).rounded())
            return ErrorPattern(
                id: label,
                category: records.first?.category ?? .grammar,
                conceptLabel: label,
                count: records.count,
                share: share,
                records: records.sorted { $0.occurredAt > $1.occurredAt },
                headline: "\(label) — \(pct)% of your mistakes"
            )
        }
        .sorted { $0.count > $1.count }
    }

    // MARK: - Reviewing

    /// The evidence entry point for an answered item. `now` is injectable so the
    /// headless driver can run multi-day sessions against the real schedule.
    func recordReview(gapId: String, correct: Bool, grade: ReviewGrade? = nil, conceptWeight: Double = 1, now: Date = Date()) {
        guard let idx = gaps.firstIndex(where: { $0.id == gapId }) else { return }
        var gap = gaps[idx]
        let g = grade ?? (correct ? .good : .again)

        gap.fsrs = FSRS.review(state: gap.fsrs, grade: g, now: now)
        gap.lastReviewedAt = now
        gap.nextReviewAt = gap.fsrs?.dueAt ?? now.addingTimeInterval(86_400)
        gap.reviewCount += 1

        if correct {
            gap.consecutiveCorrect += 1
            masteryDays.insert(Self.dayKey(now))
            // Update learner ability (IRT-style nudge).
            abilityTheta = min(3, abilityTheta + 0.06 * (1 - successProbability(theta: abilityTheta, b: gap.irtDifficulty)))
            if gap.consecutiveCorrect >= 5 && gap.masteredAt == nil {
                gap.masteredAt = now
            }
        } else {
            gap.consecutiveCorrect = 0
            abilityTheta = max(-3, abilityTheta - 0.05 * successProbability(theta: abilityTheta, b: gap.irtDifficulty))
        }
        gaps[idx] = gap
        // Concept mastery moves only when the concept is actually re-tested here
        // (no timer-based decay) — weight scales slightly with item difficulty.
        let weight: Double = gap.difficulty == .hard ? 1.3 : (gap.difficulty == .easy ? 0.8 : 1.0)
        recordConceptAnswer(conceptId: gap.conceptId, correct: correct, weight: weight * conceptWeight, now: now)
        save()
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

    func recordError(gap: GapItem, userAnswer: String, correctAnswer: String) {
        let record = ErrorRecord(
            id: UUID().uuidString,
            gapId: gap.id,
            category: gap.category,
            frenchWord: gap.frenchWord,
            userAnswer: userAnswer,
            correctAnswer: correctAnswer,
            conceptLabel: gap.conceptLabelForError,
            occurredAt: Date()
        )
        errors.insert(record, at: 0)
        save()
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

    private func load() {
        guard let defaults = persistence else {
            // In-memory: the seed taxonomy and nothing else, so fixtures are explicit.
            concepts = ConceptTaxonomy.seed()
            abilityTheta = 0.2
            return
        }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        if let data = defaults.data(forKey: gapsKey),
           let decoded = try? decoder.decode([GapItem].self, from: data), !decoded.isEmpty {
            gaps = decoded
        } else {
            gaps = SampleData.makeGaps()
        }

        if let data = defaults.data(forKey: conceptsKey),
           let decoded = try? decoder.decode([Concept].self, from: data), !decoded.isEmpty {
            concepts = decoded
        } else {
            concepts = ConceptTaxonomy.seed()
        }
        // Ensure any new seed concepts added in updates are present.
        let existingIds = Set(concepts.map { $0.id })
        let missing = ConceptTaxonomy.seed().filter { !existingIds.contains($0.id) }
        if !missing.isEmpty { concepts.append(contentsOf: missing) }
        sessionIndex = defaults.integer(forKey: sessionKey)

        if let data = defaults.data(forKey: errorsKey),
           let decoded = try? decoder.decode([ErrorRecord].self, from: data) {
            errors = decoded
        } else {
            errors = SampleData.makeErrors()
        }

        abilityTheta = defaults.object(forKey: thetaKey) as? Double ?? 0.2
        if let days = defaults.array(forKey: masteryKey) as? [String] {
            masteryDays = Set(days)
        } else {
            masteryDays = seedStreakDays()
        }
        hasCompletedAssessment = defaults.bool(forKey: assessmentKey)
        if let raw = defaults.string(forKey: levelKey), let level = CEFRLevel(rawValue: raw) {
            assessedLevel = level
        }
        if let data = defaults.data(forKey: preferencesKey),
           let decoded = try? decoder.decode(UserPreferences.self, from: data) {
            preferences = decoded
        }
        if let data = defaults.data(forKey: activityProgressKey),
           let decoded = try? decoder.decode([String: Int].self, from: data) {
            activityProgress = decoded
        }
        gapsSinceLastLesson = defaults.integer(forKey: gapsSinceLessonKey)
        lessonsSinceCapstone = defaults.integer(forKey: lessonsSinceCapstoneKey)
        if let ts = defaults.object(forKey: localUpdatedAtKey) as? Double {
            localUpdatedAt = Date(timeIntervalSince1970: ts)
        }
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
            lessonsSinceCapstone: lessonsSinceCapstone
        )
    }

    /// Apply a snapshot pulled from the cloud, replacing local state. Persists
    /// locally without re-pushing to the cloud (this state already lives there).
    func apply(snapshot: ProgressSnapshot) {
        gaps = snapshot.gaps
        concepts = snapshot.concepts
        errors = snapshot.errors
        abilityTheta = snapshot.abilityTheta
        masteryDays = Set(snapshot.masteryDays)
        hasCompletedAssessment = snapshot.hasCompletedAssessment
        if let level = CEFRLevel(rawValue: snapshot.assessedLevel) { assessedLevel = level }
        sessionIndex = snapshot.sessionIndex
        preferences = snapshot.preferences
        activityProgress = snapshot.activityProgress
        gapsSinceLastLesson = snapshot.gapsSinceLastLesson
        lessonsSinceCapstone = snapshot.lessonsSinceCapstone
        // Ensure any seed concepts added in app updates are still present.
        let existingIds = Set(concepts.map { $0.id })
        let missing = ConceptTaxonomy.seed().filter { !existingIds.contains($0.id) }
        if !missing.isEmpty { concepts.append(contentsOf: missing) }
        localUpdatedAt = snapshot.clientUpdatedAt
        save(pushToCloud: false)
    }

    /// Reset to a clean signed-out state so the next account starts fresh and no
    /// data bleeds between users on a shared device.
    func clearForSignOut() {
        gaps = SampleData.makeGaps()
        concepts = ConceptTaxonomy.seed()
        errors = SampleData.makeErrors()
        abilityTheta = 0.2
        sessionIndex = 0
        masteryDays = seedStreakDays()
        hasCompletedAssessment = false
        assessedLevel = .A1
        preferences = nil
        activityProgress = [:]
        gapsSinceLastLesson = 0
        lessonsSinceCapstone = 0
        localUpdatedAt = nil
        save(pushToCloud: false)
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

    /// Mark a base concept as known from placement — strong evidence so it reads as
    /// mastered (mastery 0.9, observations ≥ 4) and Foundation skips it.
    private func seedMastered(_ conceptId: String) {
        guard let idx = concepts.firstIndex(where: { $0.id == conceptId }) else { return }
        concepts[idx].alpha = 9
        concepts[idx].beta = 1
        concepts[idx].lastTestedAt = Date()
    }

    /// Apply adaptive placement results: seed mastery on demonstrated base concepts,
    /// route the learner, and lay down the right starting gaps. A knower lands on
    /// their shaky spots; a beginner gets the Foundation slice for what they don't
    /// yet know.
    func applyPlacement(_ result: PlacementResult, isFirstRun: Bool) {
        assessedLevel = result.estimatedLevel
        abilityTheta = theta(for: result.estimatedLevel)

        for cid in result.masteredConceptIds { seedMastered(cid) }
        let masteredSet = Set(result.masteredConceptIds)

        if isFirstRun {
            var seeded = result.missedGaps
            // Below the reading bar → seed the Foundation slice for base concepts the
            // learner hasn't demonstrably mastered (delivery-mode content to teach).
            if isInFoundation {
                let missedConcepts = Set(seeded.compactMap { $0.conceptId })
                let foundation = FoundationCurriculum.gaps().filter { gap in
                    guard let cid = gap.conceptId else { return true }
                    return !masteredSet.contains(cid) && !missedConcepts.contains(cid)
                }
                seeded.append(contentsOf: foundation)
            }
            gaps = seeded
            errors = []
        } else {
            let existing = Set(gaps.map { $0.frenchWord.lowercased() })
            let fresh = result.missedGaps.filter { !existing.contains($0.frenchWord.lowercased()) }
            gaps.insert(contentsOf: fresh, at: 0)
        }
        hasCompletedAssessment = true
        save()
    }

    /// Persist the learner's plan preferences (the "floor").
    func setPreferences(_ prefs: UserPreferences) {
        preferences = prefs
        save()
    }

    func save(pushToCloud: Bool = true) {
        if pushToCloud { localUpdatedAt = Date() }
        guard let defaults = persistence else { return }
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        if let ts = localUpdatedAt {
            defaults.set(ts.timeIntervalSince1970, forKey: localUpdatedAtKey)
        } else {
            defaults.removeObject(forKey: localUpdatedAtKey)
        }
        if let prefs = preferences, let data = try? encoder.encode(prefs) {
            defaults.set(data, forKey: preferencesKey)
        }
        if let data = try? encoder.encode(gaps) { defaults.set(data, forKey: gapsKey) }
        if let data = try? encoder.encode(concepts) { defaults.set(data, forKey: conceptsKey) }
        if let data = try? encoder.encode(activityProgress) { defaults.set(data, forKey: activityProgressKey) }
        defaults.set(gapsSinceLastLesson, forKey: gapsSinceLessonKey)
        defaults.set(lessonsSinceCapstone, forKey: lessonsSinceCapstoneKey)
        if let data = try? encoder.encode(errors) { defaults.set(data, forKey: errorsKey) }
        defaults.set(sessionIndex, forKey: sessionKey)
        defaults.set(abilityTheta, forKey: thetaKey)
        defaults.set(Array(masteryDays), forKey: masteryKey)
        defaults.set(hasCompletedAssessment, forKey: assessmentKey)
        defaults.set(assessedLevel.rawValue, forKey: levelKey)
        if pushToCloud { cloud?.progressDidChange(self) }
    }

    private func seedStreakDays() -> Set<String> {
        var set = Set<String>()
        // seed a 4-day current streak ending yesterday
        for i in 1...4 {
            set.insert(Self.dayKey(Date().addingTimeInterval(-Double(i) * 86_400)))
        }
        return set
    }

    func resetProgress() {
        gaps = SampleData.makeGaps()
        concepts = ConceptTaxonomy.seed()
        errors = SampleData.makeErrors()
        abilityTheta = 0.2
        sessionIndex = 0
        masteryDays = seedStreakDays()
        save()
    }
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
