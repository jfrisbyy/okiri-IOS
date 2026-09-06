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
        for concept in concepts {
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
        /// Lessons that ran this day (Foundation pacing: `Tuning.foundationLessonsPerDay` while reading is locked).
        let lessons: Int
        let targetConceptId: String?
        let lessonSize: Int
        /// Mean |engine mastery − true mastery| over observed concepts.
        let calibrationError: Double
        let trueMastered: Int
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

    let driver: EngineDriver
    let learner: SyntheticLearner
    private(set) var reports: [DayReport] = []
    /// First day reading read as unlocked, if it ever did.
    private(set) var unlockDay: Int? = nil
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
    /// Days on which the governor was active at the end of the day.
    private(set) var governorDays: Int = 0
    private(set) var placement: PlacementOutcome? = nil
    /// Check-in items answered per concept over the whole run (and how many missed).
    private(set) var checkInsByConcept: [String: (asked: Int, missed: Int)] = [:]

    init(store: AppStore, learner: SyntheticLearner, now: Date) {
        self.driver = EngineDriver(store: store, now: now)
        self.learner = learner
    }

    /// Run the adaptive placement against the learner's truth and apply it. A
    /// learner with a declared-beginner truth (nothing above the guess floor) is
    /// routed as a true beginner; anyone else answers the staircase. The store's
    /// gaps are then replaced with the synthetic Foundation seed so the run never
    /// depends on bundled content.
    /// `seed` fixes the staircase's own randomness (item choice among equals, option
    /// order) so a run replays exactly; the learner's answers are seeded separately.
    mutating func place(declaredBeginner: Bool, gapsPerConcept: Int = 6, bank: [AssessmentQuestion]? = nil,
                        seed: UInt64? = nil) {
        let store = driver.store
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
        store.gaps = EngineFixtures.foundationGaps(for: store.concepts, perConcept: gapsPerConcept, at: driver.now)
        placement = PlacementOutcome(result: result, seededConceptIds: result.masteredConceptIds,
                                     inferredConceptIds: result.inferredConceptIds)
    }

    /// `days` days of lessons. With `foundationPacing` the day holds
    /// `Tuning.foundationLessonsPerDay` lessons while reading is locked and
    /// `lessonsPerDay` once it unlocks. The learner is taught the target
    /// (concept-card exposure), answers every item from its true mastery, and
    /// forgets overnight. Evidence flows through the real `recordReview`, with the
    /// selected role passed through as the lesson passes it.
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
            let count = (foundationPacing && !unlockedAtStart) ? Tuning.foundationLessonsPerDay : lessonsPerDay
            for _ in 0..<count {
                let selector = driver.pipeline.selector
                let output = driver.select(.smart)
                // Invariant: nothing prerequisite-blocked may be selected.
                for item in output.items {
                    if let cid = item.conceptId, let concept = store.concept(cid), selector.isPrerequisiteBlocked(concept) {
                        violations.append("day \(day): \(item.gapId) belongs to blocked concept \(cid)")
                    }
                }
                if let target = output.targetConceptId { learner.teach(target) }
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
            learner.dayPasses(practiced: practiced)
            let unlocked = store.readiness(for: .reading) == .unlocked
            if unlocked && unlockDay == nil { unlockDay = day }
            if firstVerifiedDay == nil, store.foundationMastered > 0 { firstVerifiedDay = day }
            if store.isGovernorActive { governorDays += 1 }
            reports.append(report(day: day, lessons: count, target: lastTarget, size: lastSize,
                                  checkIns: checkIns, checkInMisses: checkInMisses,
                                  unlockedAtStart: unlockedAtStart, unlocked: unlocked, violations: violations))
            driver.advance(days: 1)
        }
    }

    private func report(day: Int, lessons: Int, target: String?, size: Int, checkIns: Int, checkInMisses: Int,
                        unlockedAtStart: Bool, unlocked: Bool, violations: [String]) -> DayReport {
        let store = driver.store
        let observed = store.concepts.filter { $0.state != .neverObserved }
        let calibration = observed.isEmpty ? 0 :
            observed.map { abs($0.mastery - learner.truth($0.id)) }.reduce(0, +) / Double(observed.count)
        let trueMastered = store.concepts.filter { learner.truth($0.id) >= 0.85 }.count
        let estMastered = store.concepts.filter { $0.state == .mastered }.count
        let verified = store.concepts.filter { $0.isVerifiedMastered }.count
        let ghostIds = store.concepts
            .filter { $0.state == .mastered && learner.truth($0.id) < 0.6 }
            .map { "\($0.id)(\(String(format: "%.2f", learner.truth($0.id))))" }
        return DayReport(day: day, lessons: lessons, targetConceptId: target, lessonSize: size,
                         calibrationError: calibration, trueMastered: trueMastered,
                         estimatedMastered: estMastered, verifiedMastered: verified, ghosts: ghostIds.count,
                         checkIns: checkIns, checkInMisses: checkInMisses,
                         governorActive: store.isGovernorActive,
                         readingUnlockedAtStart: unlockedAtStart, readingUnlocked: unlocked,
                         ghostConceptIds: ghostIds, violations: violations)
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
            parts.append("estM " + pad(String(r.estimatedMastered), 3))
            parts.append("verM " + pad(String(r.verifiedMastered), 3))
            parts.append("ghosts " + pad(String(r.ghosts), 2))
            parts.append("checkIns " + pad("\(r.checkIns)/\(r.checkInMisses)", 6))
            parts.append(r.governorActive ? "GOV " : "    ")
            parts.append(r.readingUnlocked ? "READ" : "    ")
            lines.append(parts.joined(separator: " "))
        }
        var footer = "unlock day: \(unlockDay.map(String.init) ?? "never")  first verified: \(firstVerifiedDay.map(String.init) ?? "never")  reading toggles: \(readingToggles)  governor days: \(governorDays)"
        if let placement {
            footer += "  placement: level \(placement.result.estimatedLevel.rawValue), seeds \(placement.seededConceptIds.count), inferred \(placement.inferredConceptIds.count), asked \(placement.result.askedCount)"
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
