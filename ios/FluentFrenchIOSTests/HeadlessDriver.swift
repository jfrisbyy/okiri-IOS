//
//  HeadlessDriver.swift
//  FluentFrenchIOSTests
//
//  Runs the REAL engine with no SwiftUI:
//
//      feed evidence (AppStore.recordReview) → ConceptSelector.select(request)
//          → LessonAssembler.assemble(output) → AppStore.completeLesson
//
//  plus a synthetic learner (ported from okiri_sim.py's `Learner`) whose true
//  per-concept mastery is KNOWN, so the engine's beliefs can be measured against
//  ground truth (calibration, ghost mastery, stalls) rather than eyeballed.
//

import Foundation
@testable import FluentFrenchIOS

// MARK: - Deterministic randomness

/// SplitMix64 — small, seedable, good enough for a simulation.
struct SeededGenerator: RandomNumberGenerator {
    private var state: UInt64

    init(seed: UInt64) { state = seed }

    mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }

    mutating func uniform() -> Double {
        Double(next() >> 11) / Double(1 << 53)
    }

    mutating func uniform(in range: ClosedRange<Double>) -> Double {
        range.lowerBound + (range.upperBound - range.lowerBound) * uniform()
    }
}

// MARK: - Synthetic learner (port of okiri_sim.py `Learner`)

/// Ground truth the engine never sees. Mirrors okiri_sim.py: a per-concept true
/// mastery in [0, 1], a learning rate applied on teaching and (half) on practice
/// with feedback, daily forgetting on unpracticed concepts, and a multiple-choice
/// guess floor on every answer.
final class SyntheticLearner {
    enum Archetype {
        case trueBeginner, falseBeginner, fast, forgetful
    }

    let archetype: Archetype
    private(set) var trueMastery: [String: Double] = [:]
    var learningRate: Double = 0.35
    var forgetRate: Double = 0.01
    /// MC-style guess floor (okiri_sim.py CFG GUESS_RATE).
    var guessRate: Double = 0.20
    private var rng: SeededGenerator

    init(archetype: Archetype, concepts: [Concept], seed: UInt64 = 7) {
        self.archetype = archetype
        self.rng = SeededGenerator(seed: seed)
        switch archetype {
        case .fast: learningRate = 0.60
        case .forgetful: forgetRate = 0.05
        default: break
        }
        // Ground truth only for the concepts the product has content for: one with
        // no items is never taught, never observed and never mastered, so it has no
        // truth to model — and drawing for it would shift every later draw in this
        // seeded stream, re-rolling the whole archetype whenever the map grows.
        for concept in EngineFixtures.authoredConcepts(concepts) {
            var base = 0.02
            if archetype == .falseBeginner {
                // Vocabulary and grammar DISSOCIATED, as in the sim.
                let isVocab = concept.category == .vocabulary
                if concept.cefrLevel == .A1 { base = isVocab ? 0.85 : 0.30 }
                else if concept.cefrLevel == .A2 { base = isVocab ? 0.45 : 0.10 }
            }
            let jitter = rng.uniform(in: -0.02...0.02)
            trueMastery[concept.id] = min(1, max(0, base + jitter))
        }
    }

    func truth(_ conceptId: String) -> Double {
        trueMastery[conceptId] ?? 0
    }

    func pCorrect(_ conceptId: String) -> Double {
        guessRate + (1 - guessRate) * truth(conceptId)
    }

    /// The ENGINE'S mastery standard in this learner's latent units: the true mastery
    /// at which `pCorrect` reaches `Tuning.masteryThreshold`. The engine's estimate is
    /// a Beta mean over right/wrong answers, i.e. an estimate of P(correct), and it
    /// certifies at P(correct) >= `Tuning.masteryThreshold`; inverting
    /// `pCorrect = guessRate + (1 − guessRate)·truth` gives this line (≈ 0.69 today).
    /// Derived, never a literal, so it moves with the threshold and the guess floor.
    var truthAtEngineMasteryStandard: Double {
        (Tuning.masteryThreshold - guessRate) / (1 - guessRate)
    }

    /// Assessment-style answer: no learning.
    func probe(_ conceptId: String) -> Bool {
        rng.uniform() < pCorrect(conceptId)
    }

    /// Practice with feedback: answers, then learns a bit.
    @discardableResult
    func answer(_ conceptId: String) -> Bool {
        let ok = rng.uniform() < pCorrect(conceptId)
        let t = truth(conceptId)
        trueMastery[conceptId] = min(1, t + learningRate * 0.5 * (1 - t))
        return ok
    }

    /// Concept-card exposure.
    func teach(_ conceptId: String) {
        let t = truth(conceptId)
        trueMastery[conceptId] = min(1, t + learningRate * (1 - t))
    }

    /// A day passes: everything not practiced today decays.
    func dayPasses(practiced: Set<String>) {
        for (id, value) in trueMastery where !practiced.contains(id) {
            trueMastery[id] = max(0, value * (1 - forgetRate))
        }
    }
}

// MARK: - Headless driver

/// Drives the engine's Select → Assemble → Update loop from tests. Every call
/// goes through the same code the app uses: `LessonPipeline`, `ConceptSelector`,
/// `LessonAssembler`, `AppStore.recordReview` and `AppStore.completeLesson`.
@MainActor
final class EngineDriver {
    let store: AppStore
    /// The simulated clock. Selections and evidence are stamped with it.
    var now: Date
    var pipeline: LessonPipeline

    init(store: AppStore, now: Date, weights: ConceptSelectionWeights = .tuning, config: LessonAssemblyConfig = .tuning) {
        self.store = store
        self.now = now
        self.pipeline = LessonPipeline(store: store, weights: weights, config: config)
    }

    // MARK: Select / assemble

    func select(_ mode: SelectionMode, lessonSize: Int? = nil, scopeName: String? = nil) -> SelectionOutput {
        pipeline.preview(SelectionRequest(mode: mode, lessonSize: lessonSize, now: now, scopeName: scopeName))
    }

    func lesson(_ request: SelectionRequest) -> AssembledLesson? {
        pipeline.lesson(for: request)
    }

    func lesson(mode: SelectionMode, lessonSize: Int? = nil, scopeName: String? = nil) -> AssembledLesson? {
        pipeline.lesson(for: SelectionRequest(mode: mode, lessonSize: lessonSize, now: now, scopeName: scopeName))
    }

    func lesson(scope: SelectionScope) -> AssembledLesson? {
        pipeline.lesson(for: scope, now: now)
    }

    // MARK: Evidence

    /// `isCheckIn` is the selected item's role (`.checkIn`); nil lets the store
    /// derive it from the concept's state, exactly as an un-wired lesson would.
    func answer(gapId: String, correct: Bool, conceptWeight: Double = 1, isCheckIn: Bool? = nil) {
        store.recordReview(gapId: gapId, correct: correct, conceptWeight: conceptWeight, isCheckIn: isCheckIn, now: now)
    }

    @discardableResult
    func complete(_ lesson: AssembledLesson) -> [String] {
        store.completeLesson(targetConceptId: lesson.targetConcept?.id, isCapstone: lesson.isCapstone, now: now)
    }

    func advance(days: Double) {
        now = now.addingTimeInterval(days * 86_400)
    }

    // MARK: One full cycle

    /// select → assemble → answer every item with `oracle` → complete.
    /// Returns the lesson that ran, or nil when the selector chose nothing.
    @discardableResult
    func runLesson(_ request: SelectionRequest, answering oracle: (GapItem) -> Bool) -> AssembledLesson? {
        runLesson(request) { gap, _ in oracle(gap) }
    }

    /// Same cycle, with the oracle told each item's selected role so it can tell a
    /// check-in from spine and review. The role is passed through to the store as
    /// the lesson will (`recordAnswer(isCheckIn:)`).
    @discardableResult
    func runLesson(_ request: SelectionRequest, answering oracle: (GapItem, SelectedItemRole) -> Bool) -> AssembledLesson? {
        guard let lesson = pipeline.lesson(for: request) else { return nil }
        let weight = lesson.isCapstone ? Tuning.capstoneWeight : 1
        var roles: [String: SelectedItemRole] = [:]
        for item in lesson.selection.items { roles[item.gapId] = item.role }
        for gap in lesson.gaps {
            let role = roles[gap.id] ?? .review
            answer(gapId: gap.id, correct: oracle(gap, role), conceptWeight: weight, isCheckIn: role == .checkIn)
        }
        complete(lesson)
        return lesson
    }

    func runSmartLesson(answering oracle: (GapItem) -> Bool) -> AssembledLesson? {
        runLesson(.smart(now: now), answering: oracle)
    }
}

// MARK: - Simulated run (engine vs. ground truth)

@MainActor
struct SimulatedRun {
    struct DayReport {
        let day: Int
        /// Lessons that actually ran this day.
        let lessons: Int
        /// What the app's own day plan asked for at the start of the day: the
        /// `.lessons` spine of `DailyPlanEngine.makePlan`. While reading is locked
        /// this is the number the run obeys (Foundation pacing); after unlock the
        /// scenarios fix throughput themselves, so it is recorded, not obeyed.
        let plannedLessons: Int
        let targetConceptId: String?
        let lessonSize: Int
        /// Mean |engine mastery − true mastery| over observed concepts.
        let calibrationError: Double
        /// Concepts whose true mastery is at or above `SimulatedRun.trueMasteryLine`.
        let trueMastered: Int
        /// Concepts whose true mastery meets the ENGINE'S own mastery standard
        /// (`SyntheticLearner.truthAtEngineMasteryStandard`): the count the engine's
        /// mastered count is compared with.
        let trueMasteredAtEngineStandard: Int
        let estimatedMastered: Int
        /// Mastered concepts that are NOT provisional seeds (what coverage counts).
        let verifiedMastered: Int
        /// Engine says mastered, truth says forgotten (< 0.6).
        let ghosts: Int
        /// Check-in items answered this day, and how many were missed.
        let checkIns: Int
        let checkInMisses: Int
        let governorActive: Bool
        /// Reading read as unlocked when the day's pacing was decided (start of day).
        let readingUnlockedAtStart: Bool
        /// Reading read as unlocked at the end of the day.
        let readingUnlocked: Bool
        /// The ghosts by id, with the learner's true mastery, for diagnosis.
        let ghostConceptIds: [String]
        /// The level the app reported at the end of the day (`AppStore.learnerLevel`).
        let learnerBand: CEFRLevel
        let violations: [String]
    }

    /// Placement simulated with the REAL adaptive staircase and item bank: the
    /// learner answers each item from its true mastery (no learning), and the
    /// result is applied through `AppStore.applyPlacement` — provisional seeds and all.
    struct PlacementOutcome {
        let result: PlacementResult
        /// Concepts seeded as (provisional) mastery — the fully probed tier.
        let seededConceptIds: [String]
        /// Concepts seeded as a `.learning` head start — the band-inferred tier (B9).
        let inferredConceptIds: [String]
    }

    /// The placement bank the design assumes: the banked items PLUS three content
    /// probes per grammar / vocabulary concept, so every concept can reach the
    /// `Tuning.placementProbesPerConcept` read (synthetic probes: no bundle here).
    static func placementBank(for store: AppStore) -> [AssessmentQuestion] {
        AssessmentService.bank + AssessmentService.contentBank(concepts: store.concepts, probes: EngineFixtures.syntheticProbes)
    }

    /// The learner's true mastery at or above which a concept counts as truly mastered.
    static let trueMasteryLine = 0.85
    /// The true mastery below which an engine-mastered concept is a ghost (forgotten).
    static let ghostLine = 0.6

    let driver: EngineDriver
    let learner: SyntheticLearner
    private(set) var reports: [DayReport] = []
    /// Every certification the engine made during `run`: a concept that read
    /// `.mastered` at the end of a day it did not start mastered, with the learner's
    /// true mastery that evening. Placement seeds are not in it (they are mastered
    /// before day 1 and have their own verification deadline). This separates the
    /// question "does the engine certify skills the learner does not have?" from
    /// "does the learner forget certified skills faster than the plan maintains
    /// them?" — the mastered-count drift mixes the two.
    private(set) var certifications: [(day: Int, conceptId: String, truth: Double)] = []
    /// First day reading read as unlocked, if it ever did.
    private(set) var unlockDay: Int? = nil
    /// Reading has read as unlocked at some point before the current lesson.
    private(set) var readingEverOpened = false
    /// First day any base concept held VERIFIED mastery (a seed that passed its
    /// verification check-ins, or mastery earned through practice) — the earliest
    /// day the coverage gate could possibly move (B8).
    private(set) var firstVerifiedDay: Int? = nil
    /// How many times reading flipped between locked and unlocked across the run.
    var readingToggles: Int {
        var toggles = 0
        var previous = false
        for r in reports where r.readingUnlocked != previous {
            toggles += 1
            previous = r.readingUnlocked
        }
        return toggles
    }
    /// How many times the reported level changed from one day's end to the next —
    /// a learner of steady ability should see it move rarely, and only upward or
    /// after a real slide (engine-10-2).
    var bandChanges: Int {
        zip(reports, reports.dropFirst()).filter { $0.learnerBand != $1.learnerBand }.count
    }
    /// The reported level, day by day, for the log.
    var bandTrace: String { reports.map { $0.learnerBand.rawValue }.joined(separator: " ") }
    /// Days on which the governor was active at the end of the day.
    private(set) var governorDays: Int = 0
    private(set) var placement: PlacementOutcome? = nil
    /// Check-in items answered per concept over the whole run (and how many missed).
    private(set) var checkInsByConcept: [String: (asked: Int, missed: Int)] = [:]
    /// Every lesson target chosen while reading was still LOCKED, with the day, the
    /// concept's band and the band the learner read as at the time (engine-9-2).
    /// `beforeFirstOpen` is true while reading has never yet opened: a later re-lock
    /// (coverage falling back below the bridge) keeps the bridge material the unlock
    /// seeded, so only the first locked phase is Foundation proper.
    private(set) var lockedTargets: [(day: Int, conceptId: String, band: CEFRLevel, learnerBand: CEFRLevel,
                                      beforeFirstOpen: Bool)] = []

    /// Locked-phase targets above the learner's own band, formatted for a failure
    /// message. A learner still working through Foundation must not be taught a
    /// skill a band or two above them just because its seeded items rotted
    /// (engine-9-2).
    var aboveBandLockedTargets: [String] {
        lockedTargets
            .filter { $0.band.order > $0.learnerBand.order }
            .map { "day \($0.day): \($0.conceptId) (\($0.band.rawValue)) taught to a \($0.learnerBand.rawValue) learner" }
    }

    init(store: AppStore, learner: SyntheticLearner, now: Date) {
        self.driver = EngineDriver(store: store, now: now)
        self.learner = learner
    }

    /// Run the adaptive placement against the learner's truth and apply it. A
    /// learner with a declared-beginner truth (nothing above the guess floor) is
    /// routed as a true beginner; anyone else answers the staircase.
    ///
    /// The store reads content shaped like the shipped file
    /// (`EngineFixtures.shippedShapeContent`), and the gaps the REAL `applyPlacement`
    /// seeds are kept: the staggered base slice, the provisional seeds' items and the
    /// placement misses — with everything above A1 left to the probe and bridge paths,
    /// exactly as in the app. The run used to overwrite them with six due-now cards for
    /// every authored concept, A2 and B1 included: no blind-spot probe could ever fire
    /// (a probe needs a concept with no cards), so the probe-seeding path that inflated
    /// a beginner's level to B1 inside Foundation had no coverage (engine-10-4).
    /// `seed` fixes the staircase's own randomness (item choice among equals, option
    /// order) so a run replays exactly; the learner's answers are seeded separately.
    mutating func place(declaredBeginner: Bool, bank: [AssessmentQuestion]? = nil, seed: UInt64? = nil) {
        let store = driver.store
        store.foundationContent = EngineFixtures.shippedShapeContent()
        var engine = PlacementEngine(bank: bank ?? Self.placementBank(for: store), seed: seed)
        if declaredBeginner {
            engine.declareBeginner()
        } else {
            while let q = engine.next() {
                let known = q.conceptId.map { learner.probe($0) } ?? false
                engine.record(q, correct: known)
            }
        }
        let result = engine.result()
        store.applyPlacement(result, isFirstRun: true, now: driver.now)
        placement = PlacementOutcome(result: result, seededConceptIds: result.masteredConceptIds,
                                     inferredConceptIds: result.inferredConceptIds)
    }

    /// `days` days of lessons. With `foundationPacing` the day runs as many lessons
    /// as the APP's own day plan asks for while reading is locked — the sim reads
    /// `DailyPlanEngine.makePlan(now:)` and takes its lessons spine, exactly as Home
    /// does — and `lessonsPerDay` once reading unlocks, because the capacity
    /// scenarios deliberately vary post-unlock throughput. Driving the locked day
    /// from the engine is what makes the pacing assertion a test of B10 rather than
    /// a restatement of a number the harness picked itself (engine-7-4).
    /// The learner is taught the target (concept-card exposure), answers every item
    /// from its true mastery, and forgets overnight. Evidence flows through the real
    /// `recordReview`, with the selected role passed through as the lesson passes it.
    mutating func run(days: Int, lessonsPerDay: Int = 1, foundationPacing: Bool = false) {
        guard days > 0 else { return }
        let store = driver.store
        for day in 1...days {
            var practiced = Set<String>()
            var lastTarget: String? = nil
            var lastSize = 0
            var violations: [String] = []
            var checkIns = 0, checkInMisses = 0
            let unlockedAtStart = store.readiness(for: .reading) == .unlocked
            let masteredAtStart = Set(store.concepts.filter { $0.state == .mastered }.map { $0.id })
            // The lessons spine the app would show on this day's card. `makePlan`
            // previews the selection, so asking for it neither logs a selection nor
            // moves any scheduling state.
            let planned = DailyPlanEngine(store: store).makePlan(now: driver.now).lessonItem?.target ?? 0
            let count = (foundationPacing && !unlockedAtStart) ? planned : lessonsPerDay
            for _ in 0..<count {
                if store.readiness(for: .reading) == .unlocked { readingEverOpened = true }
                let selector = driver.pipeline.selector
                let output = driver.select(.smart)
                // Invariant: nothing prerequisite-blocked may be selected.
                for item in output.items {
                    if let cid = item.conceptId, let concept = store.concept(cid), selector.isPrerequisiteBlocked(concept) {
                        violations.append("day \(day): \(item.gapId) belongs to blocked concept \(cid)")
                    }
                }
                if let target = output.targetConceptId {
                    learner.teach(target)
                    if !unlockedAtStart, let concept = store.concept(target) {
                        lockedTargets.append((day: day, conceptId: target, band: concept.cefrLevel,
                                              learnerBand: output.learnerLevel, beforeFirstOpen: !readingEverOpened))
                    }
                }
                var lessonCheckIns: [(String, Bool)] = []
                let lesson = driver.runLesson(.smart(now: driver.now)) { (gap: GapItem, role: SelectedItemRole) -> Bool in
                    guard let cid = gap.conceptId else { return false }
                    practiced.insert(cid)
                    let ok = learner.answer(cid)
                    if role == .checkIn {
                        checkIns += 1
                        if !ok { checkInMisses += 1 }
                        lessonCheckIns.append((cid, ok))
                    }
                    return ok
                }
                for (cid, ok) in lessonCheckIns {
                    let tally = checkInsByConcept[cid] ?? (0, 0)
                    checkInsByConcept[cid] = (tally.asked + 1, tally.missed + (ok ? 0 : 1))
                }
                lastTarget = lesson?.targetConcept?.id
                lastSize = lesson?.gaps.count ?? 0
            }
            for concept in store.concepts where concept.state == .mastered && !masteredAtStart.contains(concept.id) {
                certifications.append((day: day, conceptId: concept.id, truth: learner.truth(concept.id)))
            }
            learner.dayPasses(practiced: practiced)
            let unlocked = store.readiness(for: .reading) == .unlocked
            if unlocked && unlockDay == nil { unlockDay = day }
            if firstVerifiedDay == nil, store.foundationMastered > 0 { firstVerifiedDay = day }
            if store.isGovernorActive { governorDays += 1 }
            reports.append(report(day: day, lessons: count, planned: planned, target: lastTarget, size: lastSize,
                                  checkIns: checkIns, checkInMisses: checkInMisses,
                                  unlockedAtStart: unlockedAtStart, unlocked: unlocked, violations: violations))
            driver.advance(days: 1)
        }
    }

    private func report(day: Int, lessons: Int, planned: Int, target: String?, size: Int,
                        checkIns: Int, checkInMisses: Int,
                        unlockedAtStart: Bool, unlocked: Bool, violations: [String]) -> DayReport {
        let store = driver.store
        let observed = store.concepts.filter { $0.state != .neverObserved }
        let calibration = observed.isEmpty ? 0 :
            observed.map { abs($0.mastery - learner.truth($0.id)) }.reduce(0, +) / Double(observed.count)
        let trueMastered = store.concepts.filter { learner.truth($0.id) >= Self.trueMasteryLine }.count
        let standard = learner.truthAtEngineMasteryStandard
        let trueAtStandard = store.concepts.filter { learner.truth($0.id) >= standard }.count
        let estMastered = store.concepts.filter { $0.state == .mastered }.count
        let verified = store.concepts.filter { $0.isVerifiedMastered }.count
        let ghostIds = store.concepts
            .filter { $0.state == .mastered && learner.truth($0.id) < Self.ghostLine }
            .map { "\($0.id)(\(String(format: "%.2f", learner.truth($0.id))))" }
        return DayReport(day: day, lessons: lessons, plannedLessons: planned, targetConceptId: target, lessonSize: size,
                         calibrationError: calibration, trueMastered: trueMastered,
                         trueMasteredAtEngineStandard: trueAtStandard,
                         estimatedMastered: estMastered, verifiedMastered: verified, ghosts: ghostIds.count,
                         checkIns: checkIns, checkInMisses: checkInMisses,
                         governorActive: store.isGovernorActive,
                         readingUnlockedAtStart: unlockedAtStart, readingUnlocked: unlocked,
                         ghostConceptIds: ghostIds, learnerBand: store.learnerLevel, violations: violations)
    }

    /// A compact, human-readable trace for the test log.
    var summary: String {
        func pad(_ s: String, _ width: Int) -> String {
            s.count >= width ? s : s + String(repeating: " ", count: width - s.count)
        }
        var lines: [String] = []
        for r in reports {
            var parts: [String] = []
            parts.append("day " + pad(String(r.day), 3))
            parts.append("x" + pad(String(r.lessons), 2))
            parts.append("target " + pad(r.targetConceptId ?? "—", 26))
            parts.append("size " + pad(String(r.lessonSize), 3))
            parts.append("calib " + String(format: "%.2f", r.calibrationError))
            parts.append("trueM " + pad(String(r.trueMastered), 3))
            parts.append("trueStd " + pad(String(r.trueMasteredAtEngineStandard), 3))
            parts.append("estM " + pad(String(r.estimatedMastered), 3))
            parts.append("verM " + pad(String(r.verifiedMastered), 3))
            parts.append("ghosts " + pad(String(r.ghosts), 2))
            parts.append("checkIns " + pad("\(r.checkIns)/\(r.checkInMisses)", 6))
            parts.append(r.governorActive ? "GOV " : "    ")
            parts.append(r.readingUnlocked ? "READ" : "    ")
            lines.append(parts.joined(separator: " "))
        }
        var footer = "unlock day: \(unlockDay.map(String.init) ?? "never")  first verified: \(firstVerifiedDay.map(String.init) ?? "never")  reading toggles: \(readingToggles)  governor days: \(governorDays)"
        // Role mix over the whole run: how much of the learner's practice was the
        // day's target concept, and how much was interleaved review of everything
        // else (the shape `Tuning.reviewSlotsPerLesson` reserves).
        let entries = driver.store.selectionLog.entries
        let itemCount = entries.reduce(0) { $0 + $1.items.count }
        if itemCount > 0 {
            func tally(_ role: SelectedItemRole) -> Int { entries.reduce(0) { $0 + $1.count(of: role) } }
            let reviewConcepts = Set(entries.flatMap { $0.items.filter { $0.role == .review }.compactMap { $0.conceptId } })
            footer += "\nrole mix over \(entries.count) lessons / \(itemCount) items: target \(tally(.target)), check-in \(tally(.checkIn)), review \(tally(.review)), probe \(tally(.probe)) — review spanned \(reviewConcepts.count) concepts"
        }
        footer += "\nlevel changes: \(bandChanges) — \(bandTrace)"
        if let placement {
            footer += "  placement: level \(placement.result.estimatedLevel.rawValue), seeds \(placement.seededConceptIds.count), inferred \(placement.inferredConceptIds.count), asked \(placement.result.askedCount)"
        }
        footer += "\nmastery lines: trueStd counts truth >= \(String(format: "%.4f", learner.truthAtEngineMasteryStandard)) (the engine's P(correct) >= \(Tuning.masteryThreshold) at guess rate \(learner.guessRate)), trueM counts truth >= \(Self.trueMasteryLine)"
        // The two sides of the mastered-count comparison, concept by concept, so a
        // drift names its concepts: truth at the engine's standard but not mastered
        // (under-credit), and mastered with truth below it (over-credit).
        do {
            let store = driver.store
            let standard = learner.truthAtEngineMasteryStandard
            func describe(_ c: Concept) -> String {
                let since = c.lastTestedAt.map { String(format: "%.0f", driver.now.timeIntervalSince($0) / 86_400) } ?? "-"
                return "\(c.id)(truth \(String(format: "%.2f", learner.truth(c.id))), est \(String(format: "%.2f", c.mastery)), obs \(String(format: "%.0f", c.observationCount)), \(since)d)"
            }
            let under = store.concepts.filter { learner.truth($0.id) >= standard && $0.state != .mastered }
            let over = store.concepts.filter { learner.truth($0.id) < standard && $0.state == .mastered }
            footer += "\nunder-credited at the engine's standard: \(under.count) " + under.map(describe).joined(separator: ", ")
            footer += "\nover-credited at the engine's standard: \(over.count) " + over.map(describe).joined(separator: ", ")
        }
        if !certifications.isEmpty {
            let mean = certifications.map { $0.truth }.reduce(0, +) / Double(certifications.count)
            let below = certifications.filter { $0.truth < Self.trueMasteryLine }.count
            footer += "\ncertifications: \(certifications.count), true mastery that evening \(String(format: "%.2f", mean)) on average, \(below) below \(Self.trueMasteryLine)"
        }
        if let last = reports.last, !last.ghostConceptIds.isEmpty {
            footer += "\nghosts at day \(last.day): " + last.ghostConceptIds.joined(separator: ", ")
            let store = driver.store
            for id in last.ghostConceptIds.map({ String($0.prefix { $0 != "(" }) }) {
                let tally = checkInsByConcept[id] ?? (0, 0)
                let concept = store.concept(id)
                let mastery = concept.map { String(format: "%.2f", $0.mastery) } ?? "?"
                let interval = concept?.checkInIntervalDays.map { String(format: "%.1f", $0) } ?? "nil"
                let reviewed = store.gaps(forConcept: id).filter { !$0.isProbe && !$0.isNew }.count
                footer += "\n  \(id): check-ins \(tally.asked) (missed \(tally.missed)), mastery \(mastery), interval \(interval)d, reviewed gaps \(reviewed)"
            }
        }
        lines.append(footer)
        return lines.joined(separator: "\n")
    }
}
