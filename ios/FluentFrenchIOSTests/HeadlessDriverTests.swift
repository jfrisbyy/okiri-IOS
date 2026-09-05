//
//  HeadlessDriverTests.swift
//  FluentFrenchIOSTests
//
//  The testability seam: feed events → select → assemble → complete with NO
//  SwiftUI, a SelectionLog trace of every decision, and a synthetic learner
//  (ported from okiri_sim.py) run against the REAL engine on the real taxonomy.
//

import Foundation
import Testing
@testable import FluentFrenchIOS

@MainActor
struct HeadlessDriverTests {

    // MARK: The cycle

    @Test func feedSelectAssembleCycleRunsWithoutAnyUI() throws {
        let g = EngineFixtures.smallGraph()
        let driver = EngineDriver(store: g.store, now: EngineFixtures.now)
        let rootBefore = try #require(g.store.concept(g.root))

        let lesson = try #require(driver.runSmartLesson { _ in true })

        #expect(lesson.targetConcept?.id == g.root)
        #expect(g.store.sessionIndex == 1)
        #expect(g.store.lessonsSinceCapstone == 1)

        // Evidence landed on the concept model through the real recordReview path.
        let rootAfter = try #require(g.store.concept(g.root))
        let spineCount = lesson.gaps.filter { $0.conceptId == g.root }.count
        #expect(rootAfter.alpha == rootBefore.alpha + Double(spineCount))
        #expect(rootAfter.lastTaughtSession == 1)

        // Every answered gap moved on its FSRS schedule.
        for gap in lesson.gaps {
            let stored = try #require(g.store.gaps.first { $0.id == gap.id })
            #expect(stored.reviewCount == gap.reviewCount + 1)
            #expect(stored.lastReviewedAt == EngineFixtures.now)
            #expect(stored.nextReviewAt > EngineFixtures.now)
        }

        // The probe's answer counted as evidence for its never-observed concept.
        let probed = try #require(g.store.concept(g.probeMe))
        #expect(probed.state == .learning)
    }

    @Test func selectionLogRecordsEveryLessonWithModeTargetAndRoles() throws {
        let g = EngineFixtures.smallGraph()
        let driver = EngineDriver(store: g.store, now: EngineFixtures.now)
        #expect(g.store.selectionLog.count == 0)

        _ = driver.runSmartLesson { _ in true }
        _ = driver.lesson(scope: .category(.vocabulary))
        _ = driver.lesson(mode: .capstone)
        _ = driver.select(.smart)   // a preview is not a lesson: not logged

        let log = g.store.selectionLog
        #expect(log.count == 3)

        let smart = try #require(log.entries(in: .smart).first)
        #expect(smart.targetConceptId == g.root)
        #expect(smart.count(of: .target) == Int((Double(Tuning.lessonSize) * Tuning.targetRatio).rounded()))
        #expect(smart.count(of: .review) == 2)
        #expect(smart.count(of: .probe) == 1)
        #expect(smart.at == EngineFixtures.now)

        let scoped = try #require(log.entries(with: "scoped").first)
        #expect(scoped.scopeName == "Vocabulary")
        #expect(scoped.targetConceptId == nil)
        #expect(scoped.items.allSatisfy { $0.role == .review })

        let capstone = try #require(log.entries(in: .capstone).first)
        #expect(capstone.mode.isCapstone)
        #expect(log.last?.mode == .capstone)
    }

    @Test func selectionLogIsCapped() {
        var log = SelectionLog()
        log.capacity = 3
        let store = EngineFixtures.smallGraph().store
        for _ in 0..<5 {
            log.record(ConceptSelector(store: store).select(.smart(now: EngineFixtures.now)))
        }
        #expect(log.count == 3)
    }

    @Test func capstoneLessonsComeFromCapstoneMode() throws {
        let g = EngineFixtures.smallGraph()
        let driver = EngineDriver(store: g.store, now: EngineFixtures.now)
        // Touch the root concept so there is recent material to test.
        _ = driver.runSmartLesson { _ in true }

        let capstone = try #require(driver.lesson(mode: .capstone))
        #expect(capstone.isCapstone)
        #expect(capstone.conceptBlocks.isEmpty)
        #expect(capstone.selection.mode == .capstone)
        #expect(capstone.gaps.allSatisfy { $0.conceptId != g.blocked })
        #expect(g.store.selectionLog.last?.mode == .capstone)

        // Completing it resets the cadence counter through the same store path the screen uses.
        #expect(g.store.lessonsSinceCapstone == 1)
        driver.complete(capstone)
        #expect(g.store.lessonsSinceCapstone == 0)
    }

    @Test func inMemoryStoreNeverTouchesUserDefaults() {
        let marker = "ff.gaps.v1"
        let before = UserDefaults.standard.data(forKey: marker)
        let store = AppStore(persistence: nil)
        store.gaps = [EngineFixtures.gap("x", concept: nil)]
        store.save()
        store.recordReview(gapId: "x", correct: true, now: EngineFixtures.now)
        #expect(UserDefaults.standard.data(forKey: marker) == before)
        #expect(store.concepts.count == ConceptTaxonomy.seed().count)
    }

    // MARK: Multi-day: the same schedule the app runs, on a fake clock

    @Test func dueDatesAdvanceWithTheDriversClock() throws {
        let g = EngineFixtures.smallGraph()
        let driver = EngineDriver(store: g.store, now: EngineFixtures.now)
        g.store.sessionIndex = 1   // no probe: keep the item set to the graph's own gaps
        _ = try #require(driver.runSmartLesson { _ in true })

        let now = EngineFixtures.now
        let answered = Set(g.store.gaps.filter { $0.lastReviewedAt == now }.map { $0.id })
        #expect(answered.count == Tuning.lessonSize)

        // Same instant: everything answered is fresh on its FSRS curve and not due.
        for id in answered {
            let gap = try #require(g.store.gaps.first { $0.id == id })
            #expect(gap.retrievability(at: now) == 1.0)
            #expect(gap.nextReviewAt > now)
        }
        // So the next spine leads with the one root gap that was NOT answered.
        let next = driver.select(.smart)
        #expect(next.items.first?.gapId == "root-5")

        // Ten days later the answered items have decayed below root-5's fallback
        // estimate and lead the spine again; review comes from the still-due
        // frontier gaps, never from anything blocked.
        driver.advance(days: 10)
        let later = driver.select(.smart)
        #expect(later.items.first.map { answered.contains($0.gapId) } == true)
        let laterReview = later.items.filter { $0.role == .review }.map { $0.gapId }
        #expect(!laterReview.isEmpty)
        #expect(laterReview.allSatisfy { g.frontierGapIds.contains($0) })
    }

    // MARK: Synthetic learner against the real engine

    private func realTaxonomyStore() -> AppStore {
        let concepts = ConceptTaxonomy.seed()
        let gaps = EngineFixtures.foundationGaps(for: concepts, perConcept: 6, at: EngineFixtures.now)
        let store = EngineFixtures.store(concepts: concepts, gaps: gaps, theta: -0.8)   // placed A1
        return store
    }

    @Test func fourteenDaySimulationHoldsTheLoopInvariants() {
        let store = realTaxonomyStore()
        let learner = SyntheticLearner(archetype: .fast, concepts: store.concepts, seed: 7)
        var run = SimulatedRun(store: store, learner: learner, now: EngineFixtures.now)
        run.run(days: 14)

        print("=== fast learner, 14 days, real taxonomy ===\n\(run.summary)")

        #expect(run.reports.count == 14)
        for report in run.reports {
            #expect(report.lessonSize > 0, "day \(report.day): the frontier never empties")
            #expect(report.violations.isEmpty, "day \(report.day): \(report.violations.joined(separator: "; "))")
            #expect(report.calibrationError >= 0 && report.calibrationError <= 1)
        }
        #expect(store.selectionLog.count == 14)
        #expect(store.sessionIndex == 14)
        #expect(store.selectionLog.entries.allSatisfy { $0.mode == .smart && $0.targetConceptId != nil })

        // Evidence moved the concept model through the real path: several
        // concepts are observed by day 14. Whether the estimator KEEPS UP with a
        // fast learner (calibration, ghosts, time-to-mastery) is exactly what the
        // printed summary measures for Pass 3 — it is reported, not asserted here.
        let observed = store.concepts.filter { $0.state != .neverObserved }
        #expect(observed.count >= 5)
        #expect(run.reports.last.map { $0.trueMastered >= 1 } == true, "the fast learner truly knows something by day 14")
    }

    @Test func simulationIsReproducibleForAGivenSeed() {
        func trace() -> [String?] {
            let store = realTaxonomyStore()
            let learner = SyntheticLearner(archetype: .trueBeginner, concepts: store.concepts, seed: 11)
            var run = SimulatedRun(store: store, learner: learner, now: EngineFixtures.now)
            run.run(days: 5)
            return run.reports.map { $0.targetConceptId }
        }
        #expect(trace() == trace())
    }

    @Test func falseBeginnerStartsWithDissociatedTruth() {
        let store = realTaxonomyStore()
        let learner = SyntheticLearner(archetype: .falseBeginner, concepts: store.concepts, seed: 3)
        let vocabA1 = store.concepts.filter { $0.cefrLevel == .A1 && $0.category == .vocabulary }
        let grammarA1 = store.concepts.filter { $0.cefrLevel == .A1 && $0.category == .grammar }
        #expect(!vocabA1.isEmpty && !grammarA1.isEmpty)
        for c in vocabA1 { #expect(learner.truth(c.id) > 0.8) }
        for c in grammarA1 { #expect(learner.truth(c.id) < 0.35) }
    }
}
