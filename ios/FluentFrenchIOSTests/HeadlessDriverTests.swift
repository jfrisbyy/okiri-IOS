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

        // Evidence landed on the concept model through the real recordReview path:
        // the raw observation count grew by one per root item, and the decayed
        // Beta evidence moved toward "knows it" (B5).
        let rootAfter = try #require(g.store.concept(g.root))
        let spineCount = lesson.gaps.filter { $0.conceptId == g.root }.count
        #expect(abs(rootAfter.observationCount - (rootBefore.observationCount + Double(spineCount))) < 1e-9)
        #expect(rootAfter.alpha > rootBefore.alpha && rootAfter.mastery > rootBefore.mastery)
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
        #expect(smart.count(of: .target) == Tuning.lessonSize - Tuning.checkInsPerLesson - Tuning.reviewSlotsPerLesson)
        #expect(smart.count(of: .checkIn) == 1, "the mastered concept comes back as ONE check-in (B7)")
        #expect(smart.count(of: .review) == 3, "the slots the spine no longer takes go to interleaved review")
        #expect(smart.count(of: .probe) == 1)
        #expect(smart.at == EngineFixtures.now)
        #expect(smart.governorActive == false)

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
        // So the next spine leads with the weakest root gap that was NOT answered
        // (root-3 …-5 sat out this lesson: the spine takes three of the six).
        let next = driver.select(.smart)
        #expect(next.items.first?.gapId == "root-3")

        // Ten days later every answered item has decayed on its FSRS curve — below
        // root-5's fallback estimate (0.95) — and is overdue again.
        driver.advance(days: 10)
        let laterNow = driver.now
        for id in answered {
            let gap = try #require(g.store.gaps.first { $0.id == id })
            #expect(gap.retrievability(at: laterNow) < 0.95)
            #expect(gap.nextReviewAt < laterNow)
        }

        // The ranking moved with the clock too. Root is still the target (its gaps
        // are the most overdue and it carries the leverage; frontier was observed
        // through frontier-0 in lesson 1, so it no longer earns the frontier bonus),
        // but its spine is now the DECAYED items answered ten days ago — weakest
        // first — rather than the never-answered root-3…5 (fallback 0.76 … 0.95).
        // The mastered concept returns as a check-in: its first check-in fell due a
        // week after lesson 1, carried by its weakest reviewed gap. Review fills its
        // reserved slots with the most overdue practicable gaps of unmastered
        // concepts — and nothing prerequisite-blocked rides in at either instant.
        let later = driver.select(.smart)
        #expect(later.targetConceptId == g.root)
        let laterSpine = later.items.filter { $0.role == .target }.map { $0.gapId }
        #expect(laterSpine == ["root-0", "root-1", "root-2"])
        #expect(Set(laterSpine).isSubset(of: answered), "the decayed items are due again and lead the spine")
        #expect(!later.gapIds.contains("root-5"), "the fresh gap now ranks behind the decayed ones")
        #expect(later.checkInItems.map { $0.gapId } == ["done-1"], "check-in on the mastered concept's weakest reviewed gap")
        let laterReview = later.items.filter { $0.role == .review }.map { $0.gapId }
        #expect(laterReview == g.frontierGapIds, "review: the most overdue practicable gaps of an unmastered concept")
        #expect(later.items.count == Tuning.lessonSize)
        #expect(!later.gapIds.contains { g.blockedGapIds.contains($0) })
    }

    // MARK: B3 — mastery is a badge, not retirement

    @Test func masteredConceptComesBackAsACheckInWhenRecallDropsAndALapseUnmastersItsGap() throws {
        let now = EngineFixtures.now
        // A mastered CONCEPT so it is never a lesson target. Its adaptive check-in
        // is scheduled far out, so only falling recall (Tuning.checkInRetrievability)
        // can pull it back into a smart lesson — and only as a check-in (B7).
        var concept = EngineFixtures.mastered("solo")
        // (A year: earning the badge at each due date now takes about a month, since
        // the first answer is scheduled by its grade — engine-10-8 — so a 30-day
        // ladder would fall due first and the premise would not hold.)
        concept.nextCheckInAt = now.addingTimeInterval(365 * EngineFixtures.day)
        concept.checkInIntervalDays = Tuning.checkInInitialDays
        var gap = EngineFixtures.gap("solo-0", concept: "solo")
        gap.fsrs = EngineFixtures.freshFsrs(at: now)
        let store = EngineFixtures.store(concepts: [concept], gaps: [gap])
        store.sessionIndex = 1   // no probe this session
        let driver = EngineDriver(store: store, now: now)
        let selector = driver.pipeline.selector
        func stored() throws -> GapItem { try #require(store.gaps.first { $0.id == "solo-0" }) }
        func solo() throws -> Concept { try #require(store.concept("solo")) }

        // Earn the badge: answer correctly each time the schedule asks (plain
        // evidence, not check-ins).
        for _ in 0..<Tuning.gapMasteryStreak {
            let due = try stored().nextReviewAt
            driver.now = max(driver.now, due)
            driver.answer(gapId: "solo-0", correct: true, isCheckIn: false)
        }
        let mastered = try stored()
        #expect(mastered.isMastered)
        #expect(mastered.masteredAt == driver.now)
        #expect(mastered.consecutiveCorrect == Tuning.gapMasteryStreak)
        #expect(store.masteredGaps.map { $0.id } == ["solo-0"] && store.activeGaps.isEmpty)
        #expect(store.checkInHistory.isEmpty, "plain evidence never enters the check-in window")

        // Just mastered: fresh on its curve and not due → resting, nothing to select.
        #expect(!mastered.isPracticable(at: driver.now))
        #expect(store.dueMasteredGaps(at: driver.now).isEmpty)
        #expect(store.schedulableGaps(at: driver.now).isEmpty)
        #expect(driver.select(.smart).isEmpty)
        #expect(store.candidateGapIds(for: .retention(.mastered), now: driver.now).isEmpty)
        #expect(store.reviewQueue(at: driver.now).isEmpty)

        // A day before FSRS wants the gap back, nothing is due anywhere.
        driver.now = mastered.nextReviewAt.addingTimeInterval(-EngineFixtures.day)
        #expect(!selector.isCheckInDue(try solo(), now: driver.now))
        #expect(driver.select(.smart).isEmpty)

        // When FSRS says the GAP is due it is back in every schedule view (B3) —
        // and, the concept being mastered, the smart lesson carries it as ONE
        // check-in on that reviewed gap (FSRS-driven check-ins, Pass 3 F4).
        driver.now = mastered.nextReviewAt
        #expect(mastered.isDueForMasteryCheck(at: driver.now))
        #expect(store.dueMasteredGaps(at: driver.now).map { $0.id } == ["solo-0"])
        #expect(store.candidateGapIds(for: .retention(.mastered), now: driver.now) == ["solo-0"])
        #expect(store.reviewQueue(at: driver.now).map { $0.id } == ["solo-0"])
        let scoped = try #require(driver.lesson(scope: .retention(.mastered)))
        #expect(scoped.gaps.map { $0.id } == ["solo-0"])
        #expect(selector.isCheckInDue(try solo(), now: driver.now))
        let check = driver.select(.smart)
        #expect(check.gapIds == ["solo-0"])
        #expect(check.items.first?.role == .checkIn)
        #expect(check.targetConceptId == nil)
        #expect(check.headline == "Today: quick checks — making sure what you've learned still holds.")
        #expect(selector.checkInOverdueDays(try solo(), now: driver.now) == 0)
        #expect(selector.checkInOverdueDays(try solo(), now: driver.now.addingTimeInterval(2 * EngineFixtures.day)) == 2)

        // A passed check-in keeps the badge, pushes the FSRS date further out,
        // grows the check-in interval and enters the governor window.
        driver.answer(gapId: "solo-0", correct: true, isCheckIn: true)
        let held = try stored()
        #expect(held.isMastered)
        #expect(held.consecutiveCorrect == Tuning.gapMasteryStreak + 1)
        #expect(held.nextReviewAt.timeIntervalSince(driver.now) > mastered.nextReviewAt.timeIntervalSince(mastered.lastReviewedAt ?? now))
        let heldInterval = held.nextReviewAt.timeIntervalSince(driver.now)
        #expect(try solo().checkInIntervalDays == Tuning.checkInInitialDays * Tuning.checkInGrowth)
        #expect(try solo().nextCheckInAt == driver.now.addingTimeInterval(Tuning.checkInInitialDays * Tuning.checkInGrowth * EngineFixtures.day))
        #expect(store.checkInHistory == [true])

        // A missed check-in clears the badge and the streak, reschedules the gap
        // sooner than the held interval, weighs double on the concept (B6) and
        // enters the window as a miss.
        driver.now = held.nextReviewAt
        let before = try solo()
        driver.answer(gapId: "solo-0", correct: false, isCheckIn: true)
        let lapsed = try stored()
        #expect(!lapsed.isMastered)
        #expect(lapsed.masteredAt == nil)
        #expect(lapsed.consecutiveCorrect == 0)
        #expect(lapsed.fsrs?.lapses == (held.fsrs?.lapses ?? 0) + 1)
        #expect(lapsed.nextReviewAt.timeIntervalSince(driver.now) < heldInterval)
        #expect(store.activeGaps.map { $0.id } == ["solo-0"] && store.masteredGaps.isEmpty)
        #expect(store.retention(at: driver.now).mastered.isEmpty)
        let after = try solo()
        #expect(abs(after.beta - (1 + (before.beta - 1) * Tuning.evidenceRecency + Tuning.checkInMissWeight)) < 1e-9)
        #expect(after.state == .learning, "one doubled miss on modest evidence drops the concept out of mastered")
        #expect(store.checkInHistory == [true, false])

        // Mastering the gap again needs a fresh streak.
        driver.now = lapsed.nextReviewAt
        driver.answer(gapId: "solo-0", correct: true)
        let restarted = try stored()
        #expect(restarted.consecutiveCorrect == 1)
        #expect(!restarted.isMastered)
    }

    @Test func masteredGapsAreCheckedThroughTheSmartLessonInAMultiDayRun() throws {
        // Two concepts: the target's gaps are learned; a sibling's gap was mastered
        // earlier and is due. The smart lesson must interleave the mastered gap as
        // review instead of retiring it.
        let now = EngineFixtures.now
        let concepts = [EngineFixtures.learning("root", mastery: 0.5), EngineFixtures.mastered("done", category: .vocabulary)]
        var gaps = (0..<3).map { EngineFixtures.gap("root-\($0)", concept: "root") }
        var doneGap = EngineFixtures.gap("done-0", concept: "done", category: .vocabulary,
                                         consecutiveCorrect: Tuning.gapMasteryStreak, reviewCount: Tuning.gapMasteryStreak,
                                         lastReviewed: now.addingTimeInterval(-20 * EngineFixtures.day),
                                         mastered: now.addingTimeInterval(-20 * EngineFixtures.day))
        var state = FSRS.makeInitialState(grade: .easy, now: now.addingTimeInterval(-20 * EngineFixtures.day))
        state.dueAt = now.addingTimeInterval(-EngineFixtures.day)
        doneGap.fsrs = state
        doneGap.nextReviewAt = state.dueAt
        gaps.append(doneGap)
        let store = EngineFixtures.store(concepts: concepts, gaps: gaps)
        store.sessionIndex = 1
        let driver = EngineDriver(store: store, now: now)

        let lesson = try #require(driver.runSmartLesson { _ in true })
        #expect(lesson.targetConcept?.id == "root")
        #expect(lesson.gaps.contains { $0.id == "done-0" }, "the mastered concept's decayed gap rides in as a check-in")
        #expect(lesson.selection.items.first { $0.gapId == "done-0" }?.role == .checkIn)
        #expect(lesson.gaps.map { $0.id }.firstIndex(of: "done-0") == 3, "after the spine, before review")
        let checked = try #require(store.gaps.first { $0.id == "done-0" })
        #expect(checked.isMastered, "a correct check keeps the badge")
        #expect(checked.nextReviewAt > driver.now)
        #expect(!checked.isPracticable(at: driver.now), "and it rests again until its next due date")
        #expect(store.checkInHistory == [true], "the check-in outcome entered the governor window")
        #expect(store.concept("done")?.nextCheckInAt == driver.now.addingTimeInterval(Tuning.checkInInitialDays * EngineFixtures.day))
    }

    // MARK: Synthetic learner against the real engine

    /// A new learner placed at A1, seeded the way the APP seeds one: the full taxonomy,
    /// content shaped like the shipped file, and a declared-beginner placement applied
    /// through the real `AppStore.applyPlacement` (the "I'm a beginner" button on the
    /// assessment screen). That lays down the base concepts' Foundation slice only,
    /// staggered `Tuning.foundationSeedBatch` items a day (`FoundationSeeder`, D3); A2
    /// arrives through the bridge at unlock and anything else through the probe path.
    ///
    /// This fixture used to give every AUTHORED concept six due-now cards on day 0
    /// (`EngineFixtures.foundationGaps(for: authoredConcepts)`), a seeding no app path
    /// performs (engine-10-4 fixed the same mismatch in the sixty-day runs). Once the
    /// A1/A2 merge grew the authored set to 82 concepts, that put all 54 non-base
    /// concepts (the A1 pronunciation and register skills, A2 and B1) in front of the
    /// estimator from day 0, and the
    /// day-3 to day-5 calibration error (0.35-0.39) measured the fixture's curriculum,
    /// not the product's.
    private func realTaxonomyStore() -> AppStore {
        let store = EngineFixtures.store()
        store.foundationContent = EngineFixtures.shippedShapeContent()
        var placement = PlacementEngine(bank: SimulatedRun.placementBank(for: store), seed: 7)
        placement.declareBeginner()
        store.applyPlacement(placement.result(), isFirstRun: true, now: EngineFixtures.now)
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
            #expect(report.calibrationError <= Self.dailyCalibrationCeiling,
                    "day \(report.day): calibration error \(report.calibrationError)")
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

    // MARK: B16 — sixty-day runs, all four archetypes (Pass 3 acceptance)

    // Acceptance bounds for the harness's headline number. `calibrationError` is the
    // mean |engine mastery − true mastery| over observed concepts, so it is in [0, 1]
    // by construction: asserting that range could never fail, and the estimator could
    // have drifted arbitrarily far from the truth with every run still green
    // (engine-8-3). These are the measured traces plus headroom instead.
    /// Ceiling on any single day's calibration error, including the early days when
    /// the estimator has seen almost nothing (measured peak ≈ 0.28).
    private static let dailyCalibrationCeiling = 0.35
    /// Ceiling on calibration error once a run has settled, at day 60 (measured ≈ 0.10).
    private nonisolated static let settledCalibrationCeiling = 0.15
    /// The same ceiling for the two STRESS scenarios — a learner who forgets 5 % a day,
    /// and the one-lesson-a-day capacity run — re-measured once the runs seeded the
    /// curriculum the app ships (engine-10-4): 0.18 and 0.15 at day 60. Under the old
    /// fixture every authored A2/B1 concept had cards from day 0, so the forgetful
    /// learner never left Foundation and its estimator was only ever judged on the
    /// 28 base skills. On the real curriculum it opens reading on day 18 and the
    /// estimator trails a learner whose truth decays daily on every skill a lesson
    /// does not reach; that lag is printed in the trace, and bounded here.
    private static let stressSettledCalibrationCeiling = 0.22
    /// How far the engine's mastered COUNT may sit from the truth, at the engine's own
    /// mastery standard, at day 60 for a learner who does every lesson the plan asks
    /// for. A coarse guard only (engine-12-1): the two failure modes the count stands
    /// for are bounded directly below. What is left in the total is LAG — skills the
    /// learner improved on in the last few days, which an estimator that needs
    /// evidence before it certifies trails by design. Swept over 11 learners on the
    /// 82-concept curriculum after engine-12-1: 3-7, every one of them under-credit.
    private static let masteredCountBand = 8
    /// Concepts the engine may read as mastered that the learner holds below the
    /// engine's own standard at day 60 (engine-12-1; swept: 0 in 9 of 9 non-forgetful
    /// learners, 1 before engine-12-1).
    private static let overCreditBand = 2
    /// Concepts the learner holds at the engine's standard that the engine reads as
    /// unmastered AND has asked nothing about for `abandonedAfterDays` — skills it
    /// dropped, not skills it is still checking (engine-12-1; swept: 2-4 per learner
    /// before the fix, 0-1 after, the oldest 9 days).
    private static let abandonedBand = 2
    /// Days without evidence after which an under-credited concept counts as abandoned.
    private static let abandonedAfterDays: Double = 7
    /// Days after the seed-resolution deadline on which the engine may transiently
    /// read a concept as mastered that the learner has not really learned (measured 2
    /// of the 49 days after the deadline). Each one must be gone the next day.
    private static let maxTransientGhostDays = 4

    /// Placement (real staircase + item bank against the learner's truth), then 60
    /// days at the design's throughput (Pass 3 F1, ≈20 items a day):
    /// `Tuning.foundationLessonsPerDay` short lessons a day while reading is locked
    /// and — unless `lessonsAfterUnlock` says otherwise — the same after it opens.
    /// Prints the per-day trace.
    private func sixtyDays(_ archetype: SyntheticLearner.Archetype, seed: UInt64, declaredBeginner: Bool,
                           label: String, lessonsAfterUnlock: Int = Tuning.foundationLessonsPerDay) -> SimulatedRun {
        let store = EngineFixtures.store()
        let learner = SyntheticLearner(archetype: archetype, concepts: store.concepts, seed: seed)
        var run = SimulatedRun(store: store, learner: learner, now: EngineFixtures.now)
        run.place(declaredBeginner: declaredBeginner, seed: seed)
        run.run(days: 60, lessonsPerDay: lessonsAfterUnlock, foundationPacing: true)
        // One write per line: a single multi-kilobyte write has been observed to
        // vanish from a captured log on Linux.
        print("=== \(label), 60 days, real taxonomy, \(lessonsAfterUnlock) lesson(s)/day after unlock ===")
        for line in run.summary.split(separator: "\n", omittingEmptySubsequences: false) {
            print(String(line))
        }
        fflush(stdout)
        return run
    }

    private func expectLoopInvariants(_ run: SimulatedRun, label: String,
                                      lessonsAfterUnlock: Int = Tuning.foundationLessonsPerDay,
                                      settledCeiling: Double = Self.settledCalibrationCeiling) {
        let store = run.driver.store
        #expect(run.reports.count == 60)
        for report in run.reports {
            #expect(report.violations.isEmpty, "\(label) day \(report.day): \(report.violations.joined(separator: "; "))")
            #expect(report.calibrationError <= Self.dailyCalibrationCeiling,
                    "\(label) day \(report.day): calibration error \(report.calibrationError)")
            // The frontier never empties: every day has a lesson until every concept
            // is mastered (only then may a day have nothing due).
            if report.estimatedMastered < store.concepts.count {
                #expect(report.lessonSize > 0, "\(label) day \(report.day): nothing to teach with unmastered concepts left")
            }
        }
        // Foundation pacing held (B10). `report.plannedLessons` is what the APP's
        // day plan asked for that morning — `DailyPlanEngine.makePlan` — and on a
        // locked day the run obeys it, so this checks the engine's pacing over 60
        // real days rather than restating a number the harness chose (engine-7-4).
        for report in run.reports {
            if report.readingUnlockedAtStart {
                #expect(report.lessons == lessonsAfterUnlock,
                        "\(label) day \(report.day): \(report.lessons) lessons")
                // Post-unlock the plan sizes itself to what is waiting, always
                // within the tuned band.
                #expect(report.plannedLessons >= Tuning.unlockedLessonsPerDayMin
                        && report.plannedLessons <= Tuning.foundationLessonsPerDay,
                        "\(label) day \(report.day): planned \(report.plannedLessons) lessons after unlock")
            } else {
                #expect(report.plannedLessons == Tuning.foundationLessonsPerDay,
                        "\(label) day \(report.day): the plan asked for \(report.plannedLessons) lessons with reading locked")
                #expect(report.lessons == report.plannedLessons,
                        "\(label) day \(report.day): ran \(report.lessons) of \(report.plannedLessons) planned lessons")
            }
        }
        #expect(store.selectionLog.count == run.reports.reduce(0) { $0 + $1.lessons })

        // engine-9-2: while reading is locked, every lesson target sits at or below
        // the band the learner reads as. Level fit is additive and capped at
        // `weights.frontier` (0.8) while urgency is capped at 1.0 and saturates a week
        // after an item falls due, so overdue-ness used to simply override level fit:
        // a skill above the learner that nothing had touched outranked the one they
        // were mid-way through. Urgency is now gated by fit above the learner's band.
        // NOTE: the band here is the engine's own (θ → CEFR), which rises with
        // practice — this pins the ranker, not the ability model.
        #expect(!run.lockedTargets.isEmpty, "\(label): the locked phase taught something")
        #expect(run.aboveBandLockedTargets.isEmpty,
                "\(label): targets above the learner's band while reading was locked: \(run.aboveBandLockedTargets.prefix(8).joined(separator: "; "))")

        // engine-10-4: the run now seeds through the real placement, first-run slice,
        // probe and bridge paths, so blind-spot probes really fire — the path that
        // used to seed B1 curricula inside Foundation (engine-10-1) is exercised.
        let probes = store.selectionLog.entries.reduce(0) { $0 + $1.count(of: .probe) }
        #expect(probes > 0, "\(label): no blind-spot probe fired in sixty days")

        // The estimator has to be RIGHT by the end, not merely inside [0, 1]: sixty
        // days of check-ins must have pulled the engine's belief close to the
        // learner's truth (engine-8-3).
        let last = run.reports.last
        #expect(last?.day == 60)
        #expect((last?.calibrationError ?? 1) <= settledCeiling,
                "\(label): calibration error \(last?.calibrationError ?? -1) at day 60")
    }

    /// The engine's mastered COUNT tracks the truth for a learner who does every
    /// lesson the plan asks for. Ghost-free only says no single concept is badly
    /// over-credited; this says the totals agree (engine-8-3).
    ///
    /// Both sides of the count use the SAME standard: the engine's own. The engine
    /// reads a concept as mastered when its estimate of P(correct) reaches
    /// `Tuning.masteryThreshold`, which in the synthetic learner's latent units is
    /// `SyntheticLearner.truthAtEngineMasteryStandard` (derived from the threshold
    /// and the learner's guess floor, ≈ 0.69 today). This used to count truth at
    /// `SimulatedRun.trueMasteryLine` (0.85), a stricter standard than the one the
    /// engine certifies against. On the 28-concept curriculum the two agreed by
    /// accident; on the 82-concept one a learner spread across the whole curriculum
    /// at the plan's fixed throughput settles near 0.82 per concept — above the
    /// engine's line, below the test's — and the count drifted by 11 to 35 while the
    /// engine's certifications averaged true mastery 0.94-0.99, none below the ghost
    /// line. The 0.85 line did not go away: "a certification sits on real knowledge"
    /// is held per certification by `expectCertificationsAreEarned` (mean at or above
    /// 0.85, at most `maxShareCertifiedBelowTruthLine` below it, none below the ghost
    /// line), which is where a stricter-than-the-threshold bar belongs.
    /// `masteredCountBand` was 6 until engine-12-1 split it (see its comment).
    ///
    /// At the matched standard the drift flipped sign and was still 10-12: now the
    /// engine UNDER-counted, leaving concepts the learner held below the line for
    /// weeks — mostly ones a single double-weight check-in miss had knocked out of
    /// mastery, which nothing ever asked about again. That was an engine defect, not
    /// a test artefact, and was fixed in the ranker (engine-8-3,
    /// `ConceptSelector.unfinishedConceptBonus`); the summary prints both sides
    /// ("under-credited" / "over-credited") so a future drift names its concepts.
    private func expectMasteredCountTracksTruth(_ run: SimulatedRun, label: String) {
        guard let last = run.reports.last else {
            #expect(Bool(false), "\(label): the run produced no reports to judge")
            return
        }
        let drift = abs(last.trueMasteredAtEngineStandard - last.estimatedMastered)
        #expect(drift <= Self.masteredCountBand,
                "\(label) day \(last.day): engine says \(last.estimatedMastered) mastered, truth at the engine's standard (\(run.learner.truthAtEngineMasteryStandard)) says \(last.trueMasteredAtEngineStandard)")

        // engine-12-1: the count mixed three things — over-credit, skills the engine
        // abandoned, and lag on skills it is still checking — and only the first two
        // are defects. Each is now held on its own.
        let store = run.driver.store
        let standard = run.learner.truthAtEngineMasteryStandard
        let now = run.driver.now
        let over = store.concepts.filter { $0.state == .mastered && run.learner.truth($0.id) < standard }
        #expect(over.count <= Self.overCreditBand,
                "\(label): mastered below the learner's truth: \(over.map { "\($0.id) truth \(String(format: "%.2f", run.learner.truth($0.id)))" })")
        let abandoned = store.concepts.filter { concept in
            guard concept.state != .mastered, run.learner.truth(concept.id) >= standard else { return false }
            guard let tested = concept.lastTestedAt else { return true }
            return now.timeIntervalSince(tested) >= Self.abandonedAfterDays * 86_400
        }
        #expect(abandoned.count <= Self.abandonedBand,
                "\(label): held but untouched for \(Int(Self.abandonedAfterDays))+ days: \(abandoned.map { "\($0.id) truth \(String(format: "%.2f", run.learner.truth($0.id))) est \(String(format: "%.2f", $0.mastery))" })")
    }

    /// Share of the engine's certifications that may land on a concept the learner
    /// truly holds below `SimulatedRun.trueMasteryLine` that evening (measured on the
    /// 82-concept curriculum: 5 of 73 for the true beginner, 0 of 71 for the false
    /// beginner, 0 of 78 for the fast learner — four answers in a row can be right by
    /// luck — with none below the ghost line).
    private static let maxShareCertifiedBelowTruthLine = 0.1

    /// The engine certifies a concept as mastered only when the learner really holds
    /// it. This is the over-credit question on its own: the mastered-COUNT drift
    /// below also includes certified skills the learner later FORGETS faster than the
    /// plan's fixed throughput can maintain them, which grows with the curriculum the
    /// learner is spread across and is not a claim the engine made without evidence.
    /// A certification must sit on real knowledge: on average at or above the truth
    /// line, rarely below it, and never on a concept already below the ghost line.
    private func expectCertificationsAreEarned(_ run: SimulatedRun, label: String) {
        let certified = run.certifications
        #expect(!certified.isEmpty, "\(label): the run certified nothing")
        guard !certified.isEmpty else { return }
        let mean = certified.map { $0.truth }.reduce(0, +) / Double(certified.count)
        #expect(mean >= SimulatedRun.trueMasteryLine,
                "\(label): certified concepts averaged true mastery \(mean) that evening")
        let below = certified.filter { $0.truth < SimulatedRun.trueMasteryLine }
        #expect(Double(below.count) <= Self.maxShareCertifiedBelowTruthLine * Double(certified.count),
                "\(label): \(below.count) of \(certified.count) certifications below the truth line: \(below.prefix(8).map { "day \($0.day) \($0.conceptId) \(String(format: "%.2f", $0.truth))" })")
        let ghosts = certified.filter { $0.truth < SimulatedRun.ghostLine }
        #expect(ghosts.isEmpty, "\(label): certified a concept the learner does not have: \(ghosts.map { "day \($0.day) \($0.conceptId)" })")
    }

    /// The capacity finding, kept visible: an unlocked learner who does ONE lesson
    /// a day gets `Tuning.checkInsPerLesson` check-ins a day, so 27 provisional
    /// seeds take weeks to verify and a lucky seed can outlive the run. The loop
    /// invariants and the pacing switch still hold; the ghost count is printed,
    /// not asserted — the fix is throughput (more lessons), not the estimator.
    @Test func falseBeginnerOneLessonADayAfterUnlockKeepsTheInvariants() {
        // Seed 14, as in `falseBeginnerSixtyDays`: seeded on the app's own bank (engine-11-5).
        let run = sixtyDays(.falseBeginner, seed: 14, declaredBeginner: false, label: "false beginner", lessonsAfterUnlock: 1)
        expectLoopInvariants(run, label: "false beginner ×1", lessonsAfterUnlock: 1,
                             settledCeiling: Self.stressSettledCalibrationCeiling)
        #expect(run.reports.contains { $0.readingUnlockedAtStart && $0.lessons == 1 })
        #expect(run.reports.reduce(0) { $0 + $1.checkIns } > 0)
        #expect(run.reports.first?.readingUnlocked == false, "day 1: provisional seeds open nothing")
        #expect(run.readingToggles <= 1, "the coverage gate has hysteresis: reading toggled \(run.readingToggles) times")
        print("false beginner ×1: ghosts at day 60 = \(run.reports.last?.ghosts ?? -1)")
    }

    /// Ghosts must be gone for the whole final week, not on one lucky sample (B16).
    private func expectNoGhostsInTheFinalWeek(_ run: SimulatedRun, label: String) {
        let finalWeek = run.reports.suffix(7)
        #expect(finalWeek.count == 7)
        for report in finalWeek {
            #expect(report.ghosts == 0, "\(label) day \(report.day): ghosts \(report.ghostConceptIds)")
        }
    }

    /// engine-10-1: for a declared beginner the locked phase is A1 in ABSOLUTE terms —
    /// the relative engine-9-2 check compares targets with a band the probe leak
    /// itself inflated. No target above A1, and the reported level never past A2.
    private func expectAnA1LockedPhase(_ run: SimulatedRun, label: String) {
        let foundation = run.lockedTargets.filter { $0.beforeFirstOpen }
        #expect(!foundation.isEmpty)
        let above = foundation.filter { $0.band.order > CEFRLevel.A1.order }
        #expect(above.isEmpty, "\(label): \(above.count) locked-phase targets above A1: \(above.prefix(8).map { "day \($0.day) \($0.conceptId) (\($0.band.rawValue))" })")
        let inflated = foundation.filter { $0.learnerBand.order > CEFRLevel.A2.order }
        #expect(inflated.isEmpty, "\(label): read as \(inflated.first?.learnerBand.rawValue ?? "") on day \(inflated.first?.day ?? 0) while locked in Foundation")
    }

    @Test func trueBeginnerSixtyDays() {
        let run = sixtyDays(.trueBeginner, seed: 11, declaredBeginner: true, label: "true beginner")
        expectLoopInvariants(run, label: "true beginner")
        expectAnA1LockedPhase(run, label: "true beginner")
        #expect(run.placement?.result.isTrueBeginner == true)
        #expect(run.placement?.seededConceptIds.isEmpty == true, "a declared beginner is seeded nothing")
        #expect(run.placement?.inferredConceptIds.isEmpty == true)
        expectNoGhostsInTheFinalWeek(run, label: "true beginner")
        expectMasteredCountTracksTruth(run, label: "true beginner")
        expectCertificationsAreEarned(run, label: "true beginner")

        // Interleaved review is a real share of the run, not a rounding error: with
        // check-in and review slots reserved (engine-1-2) a steady-state lesson is
        // no longer blocked practice on one concept, and overdue material from OTHER
        // concepts is touched on days that concept is not the target.
        let entries = run.driver.store.selectionLog.entries
        let items = entries.reduce(0) { $0 + $1.items.count }
        let reviewItems = entries.reduce(0) { $0 + $1.count(of: .review) }
        let reviewConcepts = Set(entries.flatMap { $0.items.filter { $0.role == .review }.compactMap { $0.conceptId } })
        #expect(items > 0)
        #expect(Double(reviewItems) / Double(items) > 0.15,
                "interleaved review was \(reviewItems)/\(items) items")
        #expect(reviewConcepts.count >= 20,
                "review spread across \(reviewConcepts.count) concepts, not a handful")

        // engine-4-1: no item may be stranded. A concept is judged mastered on a
        // handful of observations while it still owns items the learner has never
        // been asked; those used to be dropped by every review path and could only
        // come back as the concept's check-in vehicle, which prefers a practised gap.
        // Sixty days of the real loop must leave none of them due and unasked.
        let store60 = run.driver.store
        let selector60 = ConceptSelector(store: store60)
        let stranded = store60.gaps.filter {
            !$0.isProbe && $0.isNew && selector60.belongsToMasteredConcept($0)
                && selector60.isPracticable($0, at: run.driver.now) && $0.nextReviewAt <= run.driver.now
        }
        #expect(stranded.isEmpty, "never-asked items stranded on mastered concepts: \(stranded.map { $0.id })")

        let unlock = run.unlockDay ?? Int.max
        #expect(unlock <= 42, "reading unlocked on day \(run.unlockDay.map(String.init) ?? "never"); the target is 4–6 weeks (≤ 42)")
        #expect(run.readingToggles <= 1, "the gate never flip-flops")
    }

    @Test func fastLearnerSixtyDays() {
        let run = sixtyDays(.fast, seed: 7, declaredBeginner: true, label: "fast learner")
        expectLoopInvariants(run, label: "fast")
        expectAnA1LockedPhase(run, label: "fast")
        expectNoGhostsInTheFinalWeek(run, label: "fast")
        expectMasteredCountTracksTruth(run, label: "fast")
        expectCertificationsAreEarned(run, label: "fast")
        #expect(run.unlockDay != nil, "a fast learner unlocks reading inside 60 days")
        #expect(run.readingToggles <= 1, "the gate never flip-flops")
    }

    /// The latest day by which a false beginner's provisional seeds must all have
    /// been resolved (verified or un-mastered), derived from the tuning: every
    /// seed is re-checked every `seedVerificationDays` until it has passed
    /// `seedVerificationPasses` check-ins or missed one, and a day carries at most
    /// `checkInsPerLesson × foundationLessonsPerDay` check-ins while reading is
    /// locked. Rounds of seeds ÷ daily capacity, each `seedVerificationDays` apart,
    /// repeated `seedVerificationPasses` times — plus one round for the first
    /// check-in to fall due.
    private func seedResolutionDeadline(seeds: Int) -> Int {
        let dailyCapacity = Tuning.checkInsPerLesson * Tuning.foundationLessonsPerDay
        let rounds = Int((Double(max(seeds, 1)) / Double(dailyCapacity)).rounded(.up))
        return (rounds * Tuning.seedVerificationPasses + 1) * Int(Tuning.seedVerificationDays)
    }

    /// Seed 14: on the APP's placement bank (engine-11-5) this false beginner is
    /// placed at A1 with two provisional seeds, one vocabulary and one grammar
    /// (family-vocab, present-er-verbs), so the seed-verification, deadline and ghost
    /// checks below have seeds to check. Seed 3, used before, was seeded only on the
    /// simulation's old hand-plus-content bank; the app's bank places that learner at
    /// A2 with no seeds at all.
    @Test func falseBeginnerSixtyDays() {
        let run = sixtyDays(.falseBeginner, seed: 14, declaredBeginner: false, label: "false beginner")
        expectLoopInvariants(run, label: "false beginner")
        let placement = run.placement!
        #expect(!placement.result.isTrueBeginner, "the staircase sees the vocabulary")
        #expect(!placement.seededConceptIds.isEmpty, "placement seeds provisional mastery on what it fully probed")
        #expect(!placement.inferredConceptIds.isEmpty, "and a learning head start on what it only inferred")
        // B9, widened by firstrun-10-1: a concept asked \(Tuning.placementProbesPerConcept)
        // items clean, at or below its category's cleared band, is seeded as mastered —
        // not only an A1 base concept.
        #expect(Set(placement.seededConceptIds) == EngineFixtures.expectedPlacementSeeds(placement.result),
                "only a concept asked \(Tuning.placementProbesPerConcept) items clean, inside its placed band, is seeded as mastered (B9)")
        #expect(Set(placement.seededConceptIds).isDisjoint(with: placement.result.missedConceptIds),
                "a concept with a missed item is never seeded")
        #expect(Set(placement.seededConceptIds).isDisjoint(with: placement.inferredConceptIds))
        #expect(placement.seededConceptIds.allSatisfy { cid in
            run.driver.store.concept(cid).map { $0.cefrLevel.order <= placement.result.estimatedLevel.order } ?? false
        }, "no seed above the level the placement read")
        // Seeds were verified: none is still provisional after sixty days of check-ins.
        #expect(run.driver.store.concepts.allSatisfy { !$0.isProvisional }, "every seed was verified or un-mastered")
        #expect(run.reports.reduce(0) { $0 + $1.checkIns } > 0, "check-ins ran")

        // B8: reading is never open on the strength of unverified seeds — it stays
        // locked until the first verified mastery exists, and never flip-flops.
        #expect(run.reports.first?.readingUnlocked == false, "day 1: provisional seeds open nothing")
        if let unlock = run.unlockDay {
            let verified = run.firstVerifiedDay ?? Int.max
            #expect(unlock >= verified, "reading opened on day \(unlock) before any verified mastery (day \(verified))")
        }
        #expect(run.readingToggles <= 1, "reading toggled \(run.readingToggles) times")

        // Ghosts are gone for the whole final week, and every provisional seed was
        // resolved by the tuning-derived deadline.
        expectNoGhostsInTheFinalWeek(run, label: "false beginner")
        expectMasteredCountTracksTruth(run, label: "false beginner")
        expectCertificationsAreEarned(run, label: "false beginner")
        let deadline = seedResolutionDeadline(seeds: placement.seededConceptIds.count)
        #expect(deadline <= 60)
        #expect(run.reports.contains { $0.day == deadline }, "the deadline day is inside the run")

        // What the deadline is derived from: every PLACEMENT SEED is resolved by it.
        // A seed that is still mastery the learner does not have, after every
        // verification check-in it was owed, is the failure this bounds.
        let seeded = Set(placement.seededConceptIds)
        func conceptId(of ghost: String) -> String { String(ghost.prefix { $0 != "(" }) }
        for report in run.reports where report.day >= deadline {
            let seedGhosts = report.ghostConceptIds.filter { seeded.contains(conceptId(of: $0)) }
            #expect(seedGhosts.isEmpty,
                    "false beginner day \(report.day): unresolved seed \(seedGhosts) after the deadline (day \(deadline))")
        }

        // Mastery EARNED in practice is a separate matter: a learner who has not
        // really learned a skill can still answer `Tuning.minObservations` of its
        // items right by luck, and the engine will believe them for a moment. That
        // must be RARE and it must be TRANSIENT — the next day's check-ins take it
        // back — rather than a state the run can sit in.
        let ghostDays = run.reports.filter { $0.day >= deadline && $0.ghosts > 0 }
        #expect(ghostDays.count <= Self.maxTransientGhostDays,
                "false beginner: \(ghostDays.count) ghost days after day \(deadline): \(ghostDays.map { $0.day })")
        for report in ghostDays {
            let next = run.reports.first { $0.day == report.day + 1 }
            #expect(next == nil || next!.ghosts == 0,
                    "false beginner day \(report.day): ghosts \(report.ghostConceptIds) survived into day \(report.day + 1)")
        }
    }

    @Test func forgetfulLearnerSixtyDays() {
        let run = sixtyDays(.forgetful, seed: 5, declaredBeginner: true, label: "forgetful learner")
        expectLoopInvariants(run, label: "forgetful", settledCeiling: Self.stressSettledCalibrationCeiling)
        expectAnA1LockedPhase(run, label: "forgetful")
        #expect(run.governorDays >= 1, "the retention governor engages at least once for a forgetter")
        #expect(run.reports.contains { $0.checkInMisses > 0 }, "check-ins catch the forgetting")
    }

    /// engine-11-5: the simulations place learners on the bank the APP builds
    /// (`AssessmentService.placementBank`: content probes, hand items only where content
    /// does not cover their concept and band). They used to place on the hand bank
    /// plus the content bank, which the app never runs.
    @Test func simulationsPlaceOnTheAppsOwnBank() {
        let store = EngineFixtures.store()
        let app = AssessmentService.placementBank(concepts: store.concepts, probes: EngineFixtures.syntheticProbes)
        let sim = SimulatedRun.placementBank(for: store)
        func key(_ q: AssessmentQuestion) -> String { "\(q.band)|\(q.category.rawValue)|\(q.conceptId ?? "-")|\(q.french)" }
        #expect(sim.count == app.count, "simulation bank \(sim.count) items, the app's \(app.count)")
        #expect(sim.map(key) == app.map(key))
        #expect(sim.count < AssessmentService.bank.count
                    + AssessmentService.contentBank(concepts: store.concepts, probes: EngineFixtures.syntheticProbes).count,
                "hand items the content covers are dropped, as in the app")
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
