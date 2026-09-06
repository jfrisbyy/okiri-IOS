//
//  ConceptSelectorTests.swift
//  FluentFrenchIOSTests
//
//  Pass 2 acceptance: ONE ranker, three modes. Smart mode builds the spine and an
//  eligibility-checked review pool; scoped mode keeps declared intent as a
//  constraint; capstone mode ranks broadly across recent material.
//

import Foundation
import Testing
@testable import FluentFrenchIOS

@MainActor
struct ConceptSelectorTests {

    // MARK: Ranking

    @Test func rankedConceptsExcludeMasteredAndPrerequisiteBlocked() {
        let g = EngineFixtures.smallGraph()
        let selector = ConceptSelector(store: g.store)
        let ranked = selector.rankedEligible(now: EngineFixtures.now).map { $0.concept.id }

        #expect(ranked.first == g.root, "the learning concept with overdue, high-leverage gaps ranks first")
        #expect(ranked.contains(g.frontier))
        #expect(ranked.contains(g.probeMe))
        #expect(!ranked.contains(g.blocked), "never-observed with unmet prerequisites is never eligible")
        #expect(!ranked.contains(g.done), "mastered concepts are not taught")
    }

    @Test func rankingIsDeterministicAcrossTies() {
        let g = EngineFixtures.smallGraph()
        let selector = ConceptSelector(store: g.store)
        let a = selector.rankedEligible(now: EngineFixtures.now).map { $0.concept.id }
        let b = selector.rankedEligible(now: EngineFixtures.now).map { $0.concept.id }
        #expect(a == b)
        // frontier and probe-me tie on score; ids break the tie.
        let fi = a.firstIndex(of: g.frontier), pi = a.firstIndex(of: g.probeMe)
        #expect(fi != nil && pi != nil && fi! < pi!)
    }

    @Test func learnerLevelFollowsAbility() {
        let store = EngineFixtures.store()
        let selector = ConceptSelector(store: store)
        let bands: [(Double, CEFRLevel)] = [(-1.0, .A1), (0.2, .A2), (1.0, .B1), (1.5, .B2), (2.2, .C1), (3.0, .C2)]
        for (theta, level) in bands {
            store.abilityTheta = theta
            #expect(selector.learnerLevel() == level, "theta \(theta) → \(level)")
            #expect(store.learnerLevel == level, "the store facade reports the same band")
        }
    }

    // MARK: Smart mode

    @Test func smartPicksTheTopRankedTargetAndItsWeakestGapsAsSpine() {
        let g = EngineFixtures.smallGraph()
        let output = ConceptSelector(store: g.store).select(.smart(now: EngineFixtures.now))

        #expect(output.mode == .smart)
        #expect(output.targetConceptId == g.root)
        let spine = output.items.filter { $0.role == .target }.map { $0.gapId }
        // targetRatio would take 5 of 7, but check-in and review slots are reserved
        // first, so the spine is capped at 7 − 2 − 2 = 3.
        let spineCount = Tuning.lessonSize - Tuning.checkInsPerLesson - Tuning.reviewSlotsPerLesson
        #expect(spineCount < Int((Double(Tuning.lessonSize) * Tuning.targetRatio).rounded()))
        #expect(spine.count == spineCount)
        #expect(spine == Array(g.rootGapIds.prefix(spineCount)), "weakest first: root-0 (r=0.40) … root-2 (r=0.64)")
        #expect(output.items.count >= Tuning.lessonSize)
        #expect(output.headline.hasPrefix("Today: Concept root"))
        #expect(output.rankedConcepts.first?.concept.id == g.root)
        #expect(output.learnerLevel == .A2)
    }

    @Test func smartReviewNeverPullsInPrerequisiteBlockedMaterial() {
        // The blocked concept's gaps are the MOST overdue in the store: the old
        // review pool would have taken them first. Eligibility now applies.
        let g = EngineFixtures.smallGraph()
        let output = ConceptSelector(store: g.store).select(.smart(now: EngineFixtures.now))

        let ids = Set(output.gapIds)
        for blocked in g.blockedGapIds {
            #expect(!ids.contains(blocked), "\(blocked) is prerequisite-blocked and must not be selected")
        }
        // The mastered concept's due gaps come back ONLY as a check-in — one item,
        // its weakest reviewed gap (B7) — never through the review pool.
        #expect(output.checkInItems.map { $0.gapId } == ["done-0"])
        let review = output.items.filter { $0.role == .review }.map { $0.gapId }
        #expect(review == g.frontierGapIds,
                "review interleaves the most overdue practicable gaps of other unmastered concepts")
        #expect(review.count >= Tuning.reviewSlotsPerLesson, "the reserved review slots are actually filled")
        #expect(!ids.contains("done-1"), "the mastered concept's other gap does not ride in as review")
        for item in output.items where item.role == .review || item.role == .checkIn {
            #expect(!item.reason.isEmpty)
        }
        #expect(output.checkInItems.first?.reason == "Check-in: does Concept done still hold?")
    }

    @Test func smartFillerNeverPullsInPrerequisiteBlockedMaterial() {
        // Only a blocked concept's gaps and one tiny eligible concept: the lesson
        // must come up short rather than fill from blocked material.
        let concepts = [
            EngineFixtures.learning("tiny", mastery: 0.5),
            EngineFixtures.concept("blocked", level: .A2, prerequisites: ["tiny"]),
        ]
        var gaps = [EngineFixtures.gap("tiny-0", concept: "tiny", due: EngineFixtures.now.addingTimeInterval(30 * EngineFixtures.day))]
        for i in 0..<10 {
            gaps.append(EngineFixtures.gap("blocked-\(i)", concept: "blocked", level: .A2, due: EngineFixtures.now.addingTimeInterval(-3 * EngineFixtures.day)))
        }
        let store = EngineFixtures.store(concepts: concepts, gaps: gaps)
        store.sessionIndex = 1   // no probe this session

        let output = ConceptSelector(store: store).select(.smart(now: EngineFixtures.now))
        #expect(output.targetConceptId == "tiny")
        #expect(output.gapIds == ["tiny-0"], "short lesson, not padded with blocked gaps")
    }

    @Test func smartFallsBackToACheckInWhenNothingIsEligible() {
        // A mastered concept that was never scheduled for a check-in is overdue for
        // one: it comes back as ONE check-in item (its weakest gap, most overdue on
        // ties), not as a pile of review.
        let concepts = [EngineFixtures.mastered("done", category: .vocabulary)]
        let gaps = (0..<3).map {
            EngineFixtures.gap("done-\($0)", concept: "done", category: .vocabulary,
                               due: EngineFixtures.now.addingTimeInterval(-Double($0) * EngineFixtures.day))
        }
        let store = EngineFixtures.store(concepts: concepts, gaps: gaps)
        let output = ConceptSelector(store: store).select(.smart(now: EngineFixtures.now))

        #expect(output.targetConceptId == nil)
        #expect(output.rankedConcepts.isEmpty, "mastered concepts are never ranked as targets")
        #expect(output.items.count == 1)
        #expect(output.items.first?.role == .checkIn)
        #expect(output.items.first?.gapId == "done-2", "weakest first, most overdue on a tie")
        #expect(output.headline == "Today: check-ins — making sure what you've learned still holds.")
    }

    @Test func smartIsHonestlyEmptyWithNothingToPractice() {
        // Mastered, verified, and its next check-in weeks away: nothing to do.
        var resting = EngineFixtures.mastered("done")
        resting.nextCheckInAt = EngineFixtures.now.addingTimeInterval(30 * EngineFixtures.day)
        resting.checkInIntervalDays = Tuning.checkInInitialDays
        let store = EngineFixtures.store(concepts: [resting], gaps: [])
        let output = ConceptSelector(store: store).select(.smart(now: EngineFixtures.now))
        #expect(output.isEmpty)
        #expect(output.headline == "Nothing to practice right now.")

        // The same concept with no gaps but a check-in due is verified with a
        // content probe (B13): the item is materialised by the assembler.
        store.concepts[0].nextCheckInAt = EngineFixtures.now.addingTimeInterval(-EngineFixtures.day)
        let due = ConceptSelector(store: store).select(.smart(now: EngineFixtures.now))
        #expect(due.checkInItems.map { $0.gapId } == [ConceptSelector.probeGapId(for: resting, session: store.sessionIndex)])

        // Without probe content there is no vehicle, so the check-in is skipped.
        store.probeContent = { _ in [] }
        #expect(ConceptSelector(store: store).select(.smart(now: EngineFixtures.now)).isEmpty)
    }

    @Test func probeFollowsTheSessionCadence() {
        let g = EngineFixtures.smallGraph()
        let selector = ConceptSelector(store: g.store)

        g.store.sessionIndex = 0
        let withProbe = selector.select(.smart(now: EngineFixtures.now))
        let probe = withProbe.probeItem
        #expect(probe?.conceptId == g.probeMe, "the lowest-level frontier concept with no gaps yet")
        #expect(probe?.gapId == ConceptSelector.probeGapId(for: g.store.concept(g.probeMe)!, session: 0))
        #expect(withProbe.items.last?.role == .probe, "the probe is the last item")

        g.store.sessionIndex = 1
        #expect(selector.select(.smart(now: EngineFixtures.now)).probeItem == nil)

        g.store.sessionIndex = Tuning.probeEveryNSessions
        #expect(selector.select(.smart(now: EngineFixtures.now)).probeItem != nil)

        var quiet = LessonAssemblyConfig.tuning
        quiet.probeEveryNSessions = 0
        g.store.sessionIndex = 0
        #expect(ConceptSelector(store: g.store, config: quiet).select(.smart(now: EngineFixtures.now)).probeItem == nil)
    }

    // MARK: B12 — the target must have something to teach right now

    @Test func smartSkipsATopRankedLearningConceptWithNoPracticableSpine() {
        let now = EngineFixtures.now
        // "a-idle" is learning but its only gap is mastered and resting; "b-full"
        // ties on score and loses the id tie-break, but has a practicable gap.
        let concepts = [EngineFixtures.learning("a-idle", mastery: 0.5), EngineFixtures.learning("b-full", mastery: 0.5)]
        let resting = EngineFixtures.gap("a-idle-0", concept: "a-idle", due: now.addingTimeInterval(9 * EngineFixtures.day),
                                         consecutiveCorrect: Tuning.gapMasteryStreak, mastered: now)
        let store = EngineFixtures.store(concepts: concepts, gaps: [resting, EngineFixtures.gap("b-full-0", concept: "b-full")])
        store.sessionIndex = 1
        let output = ConceptSelector(store: store).select(.smart(now: now))
        #expect(output.rankedConcepts.first?.concept.id == "a-idle", "still ranked first: it is a learning concept")
        #expect(output.targetConceptId == "b-full", "the target is the first ranked concept with a non-empty spine")
        #expect(output.items.map { $0.gapId } == ["b-full-0"])
        #expect(output.headline.hasPrefix("Today: Concept b-full"))

        // With nothing practicable anywhere the lesson is honestly empty rather
        // than headlining a concept it cannot teach — and no stall is counted.
        store.gaps = [resting]
        let empty = ConceptSelector(store: store).select(.smart(now: now))
        #expect(empty.targetConceptId == nil && empty.isEmpty)
        #expect(empty.headline == "Nothing to practice right now.")
        store.noteLessonSelected(empty)
        store.completeLesson(targetConceptId: empty.targetConceptId, isCapstone: false, now: now)
        #expect(store.concept("a-idle")?.stallAttempts == 0)
    }

    // MARK: B13 — probes are one-shot diagnostics

    @Test func anAnsweredProbeIsNeverReselectedAsSpineReviewOrFiller() {
        let now = EngineFixtures.now
        let store = EngineFixtures.store(concepts: [EngineFixtures.learning("c", mastery: 0.5)], gaps: [])
        store.sessionIndex = 1   // not a probe session: no fresh probe is injected
        // An answered probe: due now, on the schedule, sitting in the gap list.
        var probe = EngineFixtures.gap("probe-c-0", concept: "c", due: now.addingTimeInterval(-EngineFixtures.day),
                                       reviewCount: 1, lastReviewed: now.addingTimeInterval(-3 * EngineFixtures.day))
        probe.isProbe = true
        probe.probeOptions = ["x", "y", "z"]
        store.gaps = [probe, EngineFixtures.gap("c-0", concept: "c")]
        #expect(store.schedulableGaps(at: now).contains { $0.id == "probe-c-0" }, "the schedule still lists it")

        let selector = ConceptSelector(store: store)
        let output = selector.select(.smart(now: now))
        #expect(output.targetConceptId == "c")
        #expect(output.items.map { $0.gapId } == ["c-0"], "the probe rides in neither spine, review nor top-up")
        #expect(selector.select(SelectionRequest(mode: .smart, lessonSize: 6, now: now)).gapIds == ["c-0"])

        // With only the probe left, the concept has nothing practicable to teach.
        store.gaps = [probe]
        #expect(!selector.hasPracticableGap(store.concept("c")!, now: now))
        #expect(selector.select(.smart(now: now)).isEmpty)
    }

    // MARK: E4 — a gap with no meaning yet can never carry a lesson

    /// A capture whose lookup failed (offline reading, a tutor correction with no
    /// English) is stored with an empty meaning and `needsTranslation`. Its answer
    /// is the empty string, so it must never become the spine, a review item or a
    /// check-in vehicle — the learner would be asked to pick a blank option.
    @Test func aGapWithNoMeaningYetNeverBecomesTheSpineReviewOrACheckIn() {
        let now = EngineFixtures.now
        func pending(_ id: String, concept: String) -> GapItem {
            var g = EngineFixtures.gap(id, concept: concept, sourceType: .reading)
            g.englishTranslation = ""
            g.needsTranslation = true
            return g
        }

        // 1. A blank capture does not make its never-observed concept eligible.
        let blankOnly = EngineFixtures.store(concepts: [EngineFixtures.concept("cap")],
                                             gaps: [pending("cap-0", concept: "cap")])
        blankOnly.sessionIndex = 1   // not a probe session
        let selector = ConceptSelector(store: blankOnly)
        let cap = blankOnly.concept("cap")!
        #expect(blankOnly.gaps[0].isPracticable(at: now), "the item's own schedule offers it…")
        #expect(!selector.isPracticable(blankOnly.gaps[0], at: now), "…but the selector's eligibility does not")
        #expect(!selector.hasPracticableGap(cap, now: now))
        let none = selector.select(.smart(now: now))
        #expect(none.targetConceptId == nil && none.isEmpty, "no lesson is built around a blank answer")

        // 2. A learning concept keeps its blank capture out of the spine and the
        //    top-up; its real gap carries the lesson instead.
        let mixed = EngineFixtures.store(concepts: [EngineFixtures.learning("c", mastery: 0.5)],
                                         gaps: [pending("c-blank", concept: "c"), EngineFixtures.gap("c-0", concept: "c")])
        mixed.sessionIndex = 1
        let lesson = ConceptSelector(store: mixed).select(.smart(now: now))
        #expect(lesson.targetConceptId == "c")
        #expect(lesson.gapIds == ["c-0"], "the blank capture rides in neither spine, review nor top-up")

        // 3. A mastered concept is never checked in on a blank capture either.
        let checkIn = EngineFixtures.store(concepts: [EngineFixtures.mastered("done")],
                                           gaps: [pending("done-blank", concept: "done")])
        checkIn.sessionIndex = 1
        checkIn.probeContent = { _ in [] }   // no probe to fall back on
        let checkInSelector = ConceptSelector(store: checkIn)
        #expect(checkInSelector.isCheckInDue(checkIn.concept("done")!, now: now))
        #expect(checkInSelector.checkInVehicle(for: checkIn.concept("done")!, now: now) == nil,
                "a blank capture cannot carry a check-in")
        #expect(checkInSelector.select(.smart(now: now)).isEmpty)
    }

    // MARK: Lesson shape — review is reserved, not whatever is left over

    /// `targetRatio` alone would take 5 of 7 slots and the two check-ins the other
    /// 2, so interleaved review never ran: a steady-state lesson was blocked
    /// practice on one concept while every other concept's overdue gaps waited for
    /// the day it became the target.
    @Test func aSmartLessonAlwaysLeavesRoomForInterleavedReview() {
        let now = EngineFixtures.now
        let day = EngineFixtures.day
        let concepts = [
            EngineFixtures.learning("target", mastery: 0.5),
            EngineFixtures.learning("other", mastery: 0.4, category: .vocabulary),
            EngineFixtures.mastered("m1", category: .register),
            EngineFixtures.mastered("m2", category: .phrasing),
        ]
        var gaps: [GapItem] = []
        for i in 0..<6 {
            gaps.append(EngineFixtures.gap("target-\(i)", concept: "target", due: now.addingTimeInterval(-Double(i) * day)))
            gaps.append(EngineFixtures.gap("other-\(i)", concept: "other", category: .vocabulary,
                                           due: now.addingTimeInterval(-3 * day)))
        }
        for id in ["m1", "m2"] {
            gaps.append(EngineFixtures.gap("\(id)-0", concept: id, category: id == "m1" ? .register : .phrasing,
                                           due: now.addingTimeInterval(-day), consecutiveCorrect: 2, reviewCount: 4))
        }
        let store = EngineFixtures.store(concepts: concepts, gaps: gaps)
        store.sessionIndex = 1   // not a probe session

        let output = ConceptSelector(store: store).select(.smart(now: now))
        let review = output.items.filter { $0.role == .review }

        #expect(output.targetConceptId == "target", "the most overdue learning concept leads")
        #expect(output.items.count == Tuning.lessonSize)
        #expect(output.items.filter { $0.role == .target }.count
                == Tuning.lessonSize - Tuning.checkInsPerLesson - Tuning.reviewSlotsPerLesson)
        #expect(output.checkInItems.count == Tuning.checkInsPerLesson)
        #expect(review.count == Tuning.reviewSlotsPerLesson, "the reserved review slots survive the spine and the check-ins")
        #expect(review.allSatisfy { $0.conceptId == "other" }, "review interleaves OTHER concepts' overdue gaps")

        // With nothing else due the spine still fills the lesson: the reservation is
        // a floor for review, not a cap on teaching.
        store.concepts = [concepts[0]]
        store.gaps = gaps.filter { $0.conceptId == "target" }
        let alone = ConceptSelector(store: store).select(.smart(now: now))
        #expect(alone.items.count == Tuning.lessonSize - 1, "all six of the target's gaps, nothing invented")
        #expect(alone.items.allSatisfy { $0.role == .target })
    }

    @Test func smartHonoursTheRequestedLessonSize() {
        let g = EngineFixtures.smallGraph()
        g.store.sessionIndex = 1
        let output = ConceptSelector(store: g.store).select(SelectionRequest(mode: .smart, lessonSize: 4, now: EngineFixtures.now))
        #expect(output.items.count == 4)
        // 4 slots cannot hold ratio-spine + check-ins + review: the spine keeps at
        // least one item and the rest of the lesson still interleaves.
        #expect(output.items.filter { $0.role == .target }.count == 1)
        #expect(output.items.contains { $0.role == .review })
    }

    // MARK: Scoped mode (entry points as constraints)

    @Test func tappingADeckYieldsOnlyThatDecksGapsOrderedWithReasons() {
        let g = EngineFixtures.smallGraph()
        let request = g.store.selectionRequest(for: .category(.vocabulary), now: EngineFixtures.now)
        let output = ConceptSelector(store: g.store).select(request)

        #expect(output.mode.isScoped)
        #expect(output.targetConceptId == nil, "scoped mode never re-selects a target")
        #expect(!output.isEmpty)
        for item in output.items {
            let gap = g.store.gaps.first { $0.id == item.gapId }
            #expect(gap?.category == .vocabulary, "\(item.gapId) is not in the Vocabulary deck")
            #expect(!item.reason.isEmpty, "\(item.gapId) carries a reason")
            #expect(item.role == .review)
        }
        // Weakest first: frontier-* (r=0.40, fresh) before done-* (r=0.64).
        #expect(output.gapIds == g.frontierGapIds + g.doneGapIds)
        #expect(output.headline == "Reviewing: Vocabulary")
        #expect(output.request.scopeName == "Vocabulary")
    }

    @Test func scopedStillAppliesEligibilityDedupesAndDropsUnknowns() {
        let g = EngineFixtures.smallGraph()
        let now = EngineFixtures.now
        // Mastered, not due, recall high (legacy fallback 0.95 ≥ masteredRecallFloor): not practicable.
        g.store.gaps.append(EngineFixtures.gap("retired", concept: g.root, due: now.addingTimeInterval(30 * EngineFixtures.day),
                                               consecutiveCorrect: Tuning.gapMasteryStreak, mastered: now))
        let ids = ["root-0", "root-0", "blocked-0", "done-0", "retired", "does-not-exist", "root-0"]
        let output = ConceptSelector(store: g.store).select(.scoped(ids, name: "Mixed", now: now))

        #expect(output.gapIds == ["root-0", "done-0"], "dedupe, drop blocked + resting mastered + unknown, weakest first")

        // A mastered gap whose schedule wants a check is practicable again (B3).
        g.store.gaps.append(EngineFixtures.gap("lapsing", concept: g.root, due: now.addingTimeInterval(-EngineFixtures.day),
                                               consecutiveCorrect: Tuning.gapMasteryStreak, mastered: now))
        let check = ConceptSelector(store: g.store).select(.scoped(["retired", "lapsing"], name: "Mastered", now: now))
        #expect(check.gapIds == ["lapsing"], "mastery is a badge, not retirement: due mastered gaps come back")
    }

    @Test func scopedCapsAtTheScopedLessonSize() {
        let concept = EngineFixtures.learning("many", mastery: 0.4)
        let gaps = (0..<20).map { EngineFixtures.gap("many-\($0)", concept: "many", consecutiveCorrect: $0 % 4) }
        let store = EngineFixtures.store(concepts: [concept], gaps: gaps)
        let request = store.selectionRequest(for: .category(.grammar), now: EngineFixtures.now)

        #expect(request.lessonSize == Tuning.scopedLessonSize)
        let output = ConceptSelector(store: store).select(request)
        #expect(output.items.count == Tuning.scopedLessonSize)
        // All chosen items are the weakest available (consecutiveCorrect 0 or 1).
        for item in output.items {
            let gap = store.gaps.first { $0.id == item.gapId }!
            #expect(gap.consecutiveCorrect <= 1)
        }
    }

    @Test func scopedInterleavesOnlyFromWithinTheScope() {
        let g = EngineFixtures.smallGraph()
        let output = ConceptSelector(store: g.store).select(.scoped(["root-3", "root-1"], name: "Two", now: EngineFixtures.now))
        #expect(output.gapIds == ["root-1", "root-3"], "nothing outside the declared set is dragged in")
    }

    @Test func everyEntryPointScopeResolvesInTheStoreNotTheView() {
        let g = EngineFixtures.smallGraph()
        let s = g.store
        let now = EngineFixtures.now
        #expect(Set(s.candidateGapIds(for: .category(.grammar), now: now)) == Set(g.rootGapIds + g.blockedGapIds))
        #expect(Set(s.candidateGapIds(for: .mixed, now: now)) == Set(s.activeGaps.map { $0.id }))
        // critical = overdue by more than a day: root-2…5 (−2…−5d), blocked-* (−5d), done-* (−2d)
        #expect(Set(s.candidateGapIds(for: .critical, now: now)) == Set(s.criticalGaps(at: now).map { $0.id }))
        #expect(Set(s.candidateGapIds(for: .critical, now: now)).isSuperset(of: ["root-2", "root-5", "blocked-0", "done-1"]))
        #expect(!s.candidateGapIds(for: .critical, now: now).contains("root-0"))
        #expect(s.candidateGapIds(for: .reviewQueue, now: now) == s.reviewQueue(at: now).map { $0.id })
        #expect(s.candidateGapIds(for: .dueInCategory(.grammar), now: now).allSatisfy { $0.hasPrefix("root") || $0.hasPrefix("blocked") })
        #expect(s.candidateGapIds(for: .gapIds(["x", "y"], name: "List")) == ["x", "y"])
        #expect(s.selectionRequest(for: .reviewQueue).scopeName == "Spaced Repetition")
        #expect(s.selectionRequest(for: .critical).scopeName == "Critical Gaps")
        #expect(s.selectionRequest(for: .retention(.atRisk)).scopeName == "At risk")

        // Error patterns resolve to the gaps behind their records and are labelled
        // with the concept the records group under (A12).
        s.errors = [
            ErrorRecord(id: "e1", gapId: "root-2", category: .grammar, frenchWord: "x", userAnswer: "a",
                        correctAnswer: "b", conceptLabel: "Pattern P", occurredAt: EngineFixtures.now, conceptId: "root"),
            ErrorRecord(id: "e2", gapId: "root-4", category: .grammar, frenchWord: "x", userAnswer: "a",
                        correctAnswer: "b", conceptLabel: "Pattern P", occurredAt: EngineFixtures.now, conceptId: "root"),
        ]
        let pattern = s.errorPatterns.first!
        let request = s.selectionRequest(for: .errorPattern(id: pattern.id), now: EngineFixtures.now)
        #expect(request.scopeName == "Concept root")
        if case .scoped(let ids) = request.mode {
            #expect(Set(ids) == ["root-2", "root-4"])
        } else {
            Issue.record("error pattern must be a scoped request")
        }
    }

    // MARK: Reason copy — "missed" counts misses, not reviews

    /// `GapItem.reviewCount` is bumped on every answer, right or wrong, so any copy
    /// that says "missed" / "slipped" must read the FSRS lapse count instead.
    private func fsrs(lapses: Int, reps: Int, now: Date) -> FsrsState {
        FsrsState(stability: 5, difficulty: 5, reps: reps, lapses: lapses,
                  lastReviewAt: now.addingTimeInterval(-EngineFixtures.day),
                  dueAt: now.addingTimeInterval(-2 * EngineFixtures.day))
    }

    @Test func missReasonCountsLapsesNotReviews() {
        let now = EngineFixtures.now
        let concept = EngineFixtures.learning("mixed", mastery: 0.5)
        // Answered 12 times, never wrong: not a single miss to report.
        var clean = EngineFixtures.gap("clean", concept: "mixed", due: now.addingTimeInterval(-2 * EngineFixtures.day),
                                       consecutiveCorrect: 9, reviewCount: 12,
                                       lastReviewed: now.addingTimeInterval(-EngineFixtures.day))
        clean.fsrs = fsrs(lapses: 0, reps: 12, now: now)
        // Answered 12 times, wrong 3 of them.
        var slipped = EngineFixtures.gap("slipped", concept: "mixed", due: now.addingTimeInterval(-2 * EngineFixtures.day),
                                         consecutiveCorrect: 1, reviewCount: 12,
                                         lastReviewed: now.addingTimeInterval(-EngineFixtures.day))
        slipped.fsrs = fsrs(lapses: 3, reps: 12, now: now)

        let store = EngineFixtures.store(concepts: [concept], gaps: [clean, slipped])
        let output = ConceptSelector(store: store).select(.scoped(["clean", "slipped"], name: "Mixed", now: now))
        let reasons = Dictionary(uniqueKeysWithValues: output.items.map { ($0.gapId, $0.reason) })

        #expect(reasons["clean"] == "Due for review.", "12 correct answers are not 12 misses")
        #expect(reasons["slipped"] == "You've missed this 3× — time to lock it in.")
        #expect(Tuning.repeatedMissReasonFloor == 2, "the floor gates on misses, not reviews")
    }

    @Test func smartHeadlineCountsLapsesNotReviews() {
        let now = EngineFixtures.now
        let concept = EngineFixtures.learning("focus", mastery: 0.4)
        var gaps: [GapItem] = (0..<3).map {
            var g = EngineFixtures.gap("focus-\($0)", concept: "focus", due: now.addingTimeInterval(-Double($0 + 1) * EngineFixtures.day),
                                       consecutiveCorrect: 4, reviewCount: 9,
                                       lastReviewed: now.addingTimeInterval(-EngineFixtures.day))
            g.fsrs = fsrs(lapses: 0, reps: 9, now: now)
            return g
        }
        let store = EngineFixtures.store(concepts: [concept], gaps: gaps)
        store.sessionIndex = 1   // no probe this session

        let clean = ConceptSelector(store: store).select(.smart(now: now))
        #expect(clean.targetConceptId == "focus")
        #expect(clean.headline == "Today: Concept focus.", "27 correct answers must not read as 27 slips")

        // Two real lapses across the spine now DO earn the line.
        gaps[0].fsrs = fsrs(lapses: 1, reps: 9, now: now)
        gaps[1].fsrs = fsrs(lapses: 1, reps: 9, now: now)
        store.gaps = gaps
        let slipped = ConceptSelector(store: store).select(.smart(now: now))
        #expect(slipped.headline == "Today: Concept focus — you've slipped on it 2 times.")
    }

    // MARK: Capstone mode

    private func capstoneStore() -> AppStore {
        let now = EngineFixtures.now
        let concepts = [
            EngineFixtures.learning("trend", mastery: 0.7),                  // learning, trending → first tier
            EngineFixtures.learning("shaky", mastery: 0.3, category: .vocabulary),
            EngineFixtures.mastered("solid", category: .register),
            EngineFixtures.concept("untested", category: .pronunciation),   // never observed → not testable
        ]
        var gaps: [GapItem] = []
        for i in 0..<4 {
            gaps.append(EngineFixtures.gap("trend-\(i)", concept: "trend", lastReviewed: now.addingTimeInterval(-Double(i + 1) * EngineFixtures.day)))
            // shaky was last touched a month ago: outside the window → falls back to any gap
            gaps.append(EngineFixtures.gap("shaky-\(i)", concept: "shaky", category: .vocabulary, lastReviewed: now.addingTimeInterval(-30 * EngineFixtures.day)))
            gaps.append(EngineFixtures.gap("solid-\(i)", concept: "solid", category: .register, lastReviewed: now.addingTimeInterval(-2 * EngineFixtures.day)))
            gaps.append(EngineFixtures.gap("untested-\(i)", concept: "untested", category: .pronunciation))
        }
        return EngineFixtures.store(concepts: concepts, gaps: gaps)
    }

    @Test func capstoneRanksTrendingLearningConceptsFirstAndSpansBroadly() {
        let store = capstoneStore()
        let output = ConceptSelector(store: store).select(.capstone(now: EngineFixtures.now))

        #expect(output.mode.isCapstone)
        #expect(output.targetConceptId == nil)
        #expect(output.items.count == min(Tuning.capstoneSize, 12))
        #expect(output.items.first?.conceptId == "trend", "learning-but-trending-mastered ranks first")
        #expect(output.items.prefix(3).map { $0.conceptId } == ["trend", "shaky", "solid"], "round-robin breadth across ranked concepts")
        #expect(Set(output.items.compactMap { $0.conceptId }).count == 3)
        #expect(!output.items.contains { $0.conceptId == "untested" }, "never-observed concepts have nothing to test")
        #expect(output.items.allSatisfy { $0.role == .review })
        #expect(output.headline == "Capstone: a mixed check across 3 skills.")
        // Most recently reviewed gap of the top concept comes first.
        #expect(output.items.first?.gapId == "trend-0")
    }

    @Test func capstoneTiersHoldRegardlessOfTheSharedScore() {
        let store = capstoneStore()
        let selector = ConceptSelector(store: store)
        let trend = store.concept("trend")!, shaky = store.concept("shaky")!, solid = store.concept("solid")!
        #expect(selector.capstoneScore(trend, now: EngineFixtures.now) > selector.capstoneScore(shaky, now: EngineFixtures.now))
        #expect(selector.capstoneScore(shaky, now: EngineFixtures.now) > selector.capstoneScore(solid, now: EngineFixtures.now))
        // The tiers must clear the shared score's FULL spread, not just its maximum:
        // the score runs from -0.5 (repeatDamp at full penalty) to 4.8 (governor
        // urgency 1.0x2 + leverage 0.6 + frontier 0 + confusion 0.7 + stall bonus 1.5).
        #expect(Tuning.capstoneLearningWeight > 5.3 && Tuning.capstoneTrendingWeight > 5.3,
                "tier weights must exceed the ranker's spread, stallPrerequisiteBonus and the governor multiplier included")
    }

    /// Regression: a non-trending learning concept can now reach the ranker's ceiling
    /// (overdue + leverage + frontier + confusion + `stallPrerequisiteBonus`) while a
    /// trending one sits at the floor (damped as just-taught). The trending tier must
    /// still win, or the milestone quiz stops testing what is nearly mastered.
    @Test func capstoneTrendingTierSurvivesTheStallBonusAtTheRankerCeiling() {
        let now = EngineFixtures.now
        let concepts = [
            // Trending, but taught this very session → full repeatDamp penalty.
            EngineFixtures.learning("trend", mastery: 0.7),
            // Non-trending, overdue, high leverage, at the frontier level, confused,
            // and the prerequisite of a stalled concept.
            EngineFixtures.learning("boost", mastery: 0.3, level: .A2),
            EngineFixtures.concept("stalled", level: .A2, prerequisites: ["boost"]),
        ]
        let link = ConfusionLink(partnerGapId: "trend-0", wrongPicks: 4, lastConfusedAt: now, strength: 1)
        var gaps: [GapItem] = []
        for i in 0..<3 {
            gaps.append(EngineFixtures.gap("trend-\(i)", concept: "trend", due: now.addingTimeInterval(30 * EngineFixtures.day),
                                           lastReviewed: now.addingTimeInterval(-EngineFixtures.day)))
            gaps.append(EngineFixtures.gap("boost-\(i)", concept: "boost", level: .A2,
                                           due: now.addingTimeInterval(-10 * EngineFixtures.day),
                                           lastReviewed: now.addingTimeInterval(-EngineFixtures.day),
                                           confusion: [link]))
        }
        let store = EngineFixtures.store(concepts: concepts, gaps: gaps)
        store.sessionIndex = 4
        store.concepts[0].lastTaughtSession = 4          // trend: taught this session
        store.concepts[2].stallAttempts = Tuning.stallAttempts

        let selector = ConceptSelector(store: store)
        let trend = store.concept("trend")!, boost = store.concept("boost")!
        #expect(selector.stallPrerequisiteBonus(boost) == Tuning.stallPrerequisiteBonus, "boost props up a stalled skill")
        #expect(selector.score(boost, now: now) > selector.score(trend, now: now), "the shared score prefers boost")
        #expect(selector.capstoneScore(trend, now: now) > selector.capstoneScore(boost, now: now),
                "the trending tier still outranks it")

        let output = selector.select(.capstone(now: now))
        #expect(output.items.first?.conceptId == "trend")
    }

    @Test func capstoneRespectsTheRequestedSize() {
        let store = capstoneStore()
        let output = ConceptSelector(store: store).select(SelectionRequest(mode: .capstone, lessonSize: 5, now: EngineFixtures.now))
        #expect(output.items.count == 5)
        #expect(Set(output.items.compactMap { $0.conceptId }).count == 3, "breadth before depth")
    }

    @Test func capstoneIsEmptyBeforeAnythingWasObserved() {
        let store = EngineFixtures.store(concepts: [EngineFixtures.concept("fresh")],
                                         gaps: [EngineFixtures.gap("fresh-0", concept: "fresh")])
        let output = ConceptSelector(store: store).select(.capstone(now: EngineFixtures.now))
        #expect(output.isEmpty)
    }
}
