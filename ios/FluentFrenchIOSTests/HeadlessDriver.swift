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

    func answer(gapId: String, correct: Bool, conceptWeight: Double = 1) {
        store.recordReview(gapId: gapId, correct: correct, conceptWeight: conceptWeight, now: now)
    }

    @discardableResult
    func complete(_ lesson: AssembledLesson) -> [String] {
        store.completeLesson(targetConceptId: lesson.targetConcept?.id, isCapstone: lesson.isCapstone)
    }

    func advance(days: Double) {
        now = now.addingTimeInterval(days * 86_400)
    }

    // MARK: One full cycle

    /// select → assemble → answer every item with `oracle` → complete.
    /// Returns the lesson that ran, or nil when the selector chose nothing.
    @discardableResult
    func runLesson(_ request: SelectionRequest, answering oracle: (GapItem) -> Bool) -> AssembledLesson? {
        guard let lesson = pipeline.lesson(for: request) else { return nil }
        let weight = lesson.isCapstone ? Tuning.capstoneWeight : 1
        for gap in lesson.gaps {
            answer(gapId: gap.id, correct: oracle(gap), conceptWeight: weight)
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
        let targetConceptId: String?
        let lessonSize: Int
        /// Mean |engine mastery − true mastery| over observed concepts.
        let calibrationError: Double
        let trueMastered: Int
        let estimatedMastered: Int
        /// Engine says mastered, truth says forgotten (< 0.6).
        let ghosts: Int
        let violations: [String]
    }

    let driver: EngineDriver
    let learner: SyntheticLearner
    private(set) var reports: [DayReport] = []

    init(store: AppStore, learner: SyntheticLearner, now: Date) {
        self.driver = EngineDriver(store: store, now: now)
        self.learner = learner
    }

    /// One lesson per day for `days` days. The learner is taught the target
    /// (concept-card exposure), answers every item from its true mastery, and
    /// forgets overnight. Evidence flows through the real `recordReview`.
    mutating func run(days: Int, lessonsPerDay: Int = 1) {
        let store = driver.store
        for day in 1...days {
            var practiced = Set<String>()
            var lastTarget: String? = nil
            var lastSize = 0
            var violations: [String] = []
            for _ in 0..<lessonsPerDay {
                let selector = driver.pipeline.selector
                let output = driver.select(.smart)
                // Invariant: nothing prerequisite-blocked may be selected.
                for item in output.items {
                    if let cid = item.conceptId, let concept = store.concept(cid), selector.isPrerequisiteBlocked(concept) {
                        violations.append("day \(day): \(item.gapId) belongs to blocked concept \(cid)")
                    }
                }
                if let target = output.targetConceptId { learner.teach(target) }
                let lesson = driver.runLesson(.smart(now: driver.now)) { gap in
                    guard let cid = gap.conceptId else { return false }
                    practiced.insert(cid)
                    return learner.answer(cid)
                }
                lastTarget = lesson?.targetConcept?.id
                lastSize = lesson?.gaps.count ?? 0
            }
            learner.dayPasses(practiced: practiced)
            reports.append(report(day: day, target: lastTarget, size: lastSize, violations: violations))
            driver.advance(days: 1)
        }
    }

    private func report(day: Int, target: String?, size: Int, violations: [String]) -> DayReport {
        let store = driver.store
        let observed = store.concepts.filter { $0.state != .neverObserved }
        let calibration = observed.isEmpty ? 0 :
            observed.map { abs($0.mastery - learner.truth($0.id)) }.reduce(0, +) / Double(observed.count)
        let trueMastered = store.concepts.filter { learner.truth($0.id) >= 0.85 }.count
        let estMastered = store.concepts.filter { $0.state == .mastered }.count
        let ghosts = store.concepts.filter { $0.state == .mastered && learner.truth($0.id) < 0.6 }.count
        return DayReport(day: day, targetConceptId: target, lessonSize: size,
                         calibrationError: calibration, trueMastered: trueMastered,
                         estimatedMastered: estMastered, ghosts: ghosts, violations: violations)
    }

    /// A compact, human-readable trace for the test log.
    var summary: String {
        func pad(_ s: String, _ width: Int) -> String {
            s.count >= width ? s : s + String(repeating: " ", count: width - s.count)
        }
        return reports.map { r in
            "day \(pad(String(r.day), 3)) target \(pad(r.targetConceptId ?? "—", 28)) "
                + "size \(pad(String(r.lessonSize), 3)) "
                + "calib \(String(format: "%.2f", r.calibrationError))  "
                + "trueM \(pad(String(r.trueMastered), 3)) estM \(pad(String(r.estimatedMastered), 3)) "
                + "ghosts \(r.ghosts)"
        }.joined(separator: "\n")
    }
}
