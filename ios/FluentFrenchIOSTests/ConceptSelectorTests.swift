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

    /// engine-8-1: frontier fit is the axis that is supposed to order material by
    /// level, and it used to be one-sided — a flat 1.0 for EVERY never-observed
    /// concept, and a discount only for material BELOW the learner. An A1 and a C1
    /// frontier skill were indistinguishable on it, so a declared beginner was taught
    /// B1 grammar in week two while a third of the core A1 skills were never a lesson
    /// target in sixty days. A concept at the learner's own band must win.
    @Test func frontierFitPrefersTheLearnersOwnBandOverMaterialAboveIt() {
        // Four never-observed concepts, no prerequisites, two fresh cards each due at
        // exactly `now` and no dependents: urgency, leverage, confusion and the repeat
        // damper are all zero for every one of them, so the score IS the frontier term
        // and the only thing separating them is the CEFR band.
        let bands: [(String, CEFRLevel)] = [("at-a1", .A1), ("at-a2", .A2), ("at-b1", .B1), ("at-b2", .B2)]
        let concepts = bands.map { EngineFixtures.concept($0.0, level: $0.1) }
        let gaps = EngineFixtures.foundationGaps(for: concepts, perConcept: 2)
        let store = EngineFixtures.store(concepts: concepts, gaps: gaps, theta: -1.0)   // reads A1
        let selector = ConceptSelector(store: store)
        func score(_ id: String) -> Double { selector.score(store.concept(id)!, now: EngineFixtures.now) }
        #expect(selector.learnerLevel() == .A1)
        #expect(concepts.allSatisfy { selector.isFrontier($0) }, "all four are frontier concepts")

        #expect(selector.rankedEligible(now: EngineFixtures.now).first?.concept.id == "at-a1",
                "the beginner's own band leads")
        #expect(score("at-a1") > score("at-b1"), "an at-level skill outranks one two bands above it")
        #expect(score("at-a1") > score("at-a2"), "and one a single band above it")
        #expect(score("at-a2") == score("at-b1") && score("at-b1") == score("at-b2"),
                "above the learner the term is spent: B1 and C-level material are equally out of reach")

        // The term follows the learner: the same taxonomy re-ranks when ability moves,
        // and material the learner has passed is discounted gently rather than
        // preferred (it used to score a flat 1.0 whenever it was still unobserved).
        store.abilityTheta = 1.0                                   // reads B1
        #expect(selector.learnerLevel() == .B1)
        let later = selector.rankedEligible(now: EngineFixtures.now).map { $0.concept.id }
        #expect(later == ["at-b1", "at-a2", "at-a1", "at-b2"], "ranked: \(later)")
        #expect(score("at-b1") > score("at-b2"), "a band above the learner still earns nothing")
        #expect(score("at-a2") > score("at-a1"), "the taper below is ordered, not flat")
        #expect(score("at-a1") > 0, "and it does not write off everything the learner has passed")
    }

    /// engine-9-2: level fit only ordered material while urgency was EQUAL. The
    /// frontier term is additive and capped at `weights.frontier` (0.8) while urgency
    /// is capped at 1.0 and saturates a week after an item falls due, so a skill the
    /// learner is actually working through — its items rescheduled by FSRS, urgency
    /// decaying to nothing — was outranked by a skill two bands above them that
    /// nothing had ever touched. Urgency is now GATED by fit above the learner's
    /// band: rotting cannot promote material the learner is not ready for. At or
    /// below the band nothing changes — overdue at-level material is exactly what
    /// review is for.
    @Test func overduenessNeverPromotesMaterialAboveTheLearnersBand() {
        let now = EngineFixtures.now
        let day = EngineFixtures.day
        // The A1 skill the beginner is mid-way through, practised two days ago and
        // not due again for three, versus a B1 skill (seeded when a blind-spot probe
        // was answered) that has been overdue for ten days.
        let concepts = [EngineFixtures.learning("a1-skill", mastery: 0.5, level: .A1),
                        EngineFixtures.learning("b1-skill", mastery: 0.5, level: .B1)]
        let gaps = [EngineFixtures.gap("a1-0", concept: "a1-skill", due: now.addingTimeInterval(3 * day),
                                       reviewCount: 2, lastReviewed: now.addingTimeInterval(-2 * day)),
                    EngineFixtures.gap("b1-0", concept: "b1-skill", level: .B1,
                                       due: now.addingTimeInterval(-10 * day))]
        let store = EngineFixtures.store(concepts: concepts, gaps: gaps, theta: -0.8)   // reads A1
        let selector = ConceptSelector(store: store)
        func score(_ id: String) -> Double { selector.score(store.concept(id)!, now: now) }
        #expect(selector.learnerLevel() == .A1)

        #expect(score("a1-skill") > score("b1-skill"),
                "a1 \(score("a1-skill")) vs b1 \(score("b1-skill"))")
        let output = selector.select(.smart(now: now))
        #expect(output.targetConceptId == "a1-skill", "the beginner is taught their own band")
        #expect(output.rankedConcepts.first?.concept.id == "a1-skill")

        // Ten days overdue buys the out-of-band skill nothing at all…
        func setDue(_ gapId: String, _ due: Date) {
            let idx = store.gaps.firstIndex { $0.id == gapId }!
            store.gaps[idx].nextReviewAt = due
        }
        setDue("b1-0", now.addingTimeInterval(3 * day))
        let restedB1 = score("b1-skill")
        setDue("b1-0", now.addingTimeInterval(-10 * day))
        #expect(abs(score("b1-skill") - restedB1) < 1e-9, "urgency is spent two bands above the learner")

        // …while the same ten days count in FULL for material at or below the band.
        store.abilityTheta = 1.0                                                        // reads B1
        #expect(selector.learnerLevel() == .B1)
        let restedA1 = score("a1-skill")
        setDue("a1-0", now.addingTimeInterval(-10 * day))
        #expect(abs((score("a1-skill") - restedA1) - ConceptSelectionWeights.tuning.urgency) < 1e-9,
                "an overdue A1 item for a B1 learner still earns the whole urgency weight")
        let atLevel = score("b1-skill")
        setDue("b1-0", now.addingTimeInterval(3 * day))
        #expect(atLevel - score("b1-skill") > 0, "and so does material at the learner's own band")
    }

    @Test func learnerLevelFollowsAbility() {
        let store = EngineFixtures.store()
        let selector = ConceptSelector(store: store)
        let bands: [(Double, CEFRLevel)] = [(-1.0, .A1), (0.2, .A2), (1.0, .B1), (1.5, .B2), (2.2, .C1), (3.0, .C2)]
        for (theta, level) in bands {
            store.abilityTheta = theta
            #expect(selector.learnerLevel() == level, "theta \(theta) → \(level)")
            #expect(store.learnerLevel == level, "the store facade reports the same band")
            // store-8-4: the mapping reads θ and nothing else, so the store facade
            // does not have to build (and index) a selector to answer.
            #expect(ConceptSelector.level(forTheta: theta) == level,
                    "the band comes from θ alone, with no selector to build")
        }

        // The band must not move when the taxonomy does — only θ decides it.
        store.abilityTheta = 1.0
        let before = store.learnerLevel
        store.concepts.removeAll()
        #expect(store.learnerLevel == before, "concept evidence is not an input to the level")
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
        // one: its PRACTISED items come back as ONE check-in item (the weakest, most
        // overdue on ties), not as a pile of review.
        let concepts = [EngineFixtures.mastered("done", category: .vocabulary)]
        let gaps = (0..<3).map {
            EngineFixtures.gap("done-\($0)", concept: "done", category: .vocabulary,
                               due: EngineFixtures.now.addingTimeInterval(-Double($0) * EngineFixtures.day),
                               reviewCount: 3)
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

    /// engine-9-1: and it can never keep its concept URGENT either. `score` pooled a
    /// concept's gaps straight off the item schedule, without the `!isProbe` filter
    /// every selection path applies, so a probe answered once — rescheduled by FSRS
    /// and then never offered again — left its concept permanently overdue. Urgency
    /// saturates a week out and is the heaviest weight in the ranker, so from then on
    /// that concept carried a flat +1.0 for ever, earned on a question the app
    /// refuses to ask.
    @Test func anAnsweredProbeNeverDrivesItsConceptsUrgency() {
        let now = EngineFixtures.now
        let day = EngineFixtures.day
        let later = now.addingTimeInterval(40 * day)
        // Two concepts with identical, not-yet-due material. One of them was probed:
        // the probe was answered, rescheduled, and has been overdue ever since.
        let concepts = [EngineFixtures.concept("p"), EngineFixtures.concept("q")]
        var gaps = [EngineFixtures.gap("p-0", concept: "p", due: now.addingTimeInterval(60 * day)),
                    EngineFixtures.gap("q-0", concept: "q", due: now.addingTimeInterval(60 * day))]
        var probe = EngineFixtures.gap("probe-p-0", concept: "p", due: now,
                                       reviewCount: 1, lastReviewed: now)
        probe.isProbe = true
        probe.probeOptions = ["x", "y", "z"]
        gaps.append(probe)
        let store = EngineFixtures.store(concepts: concepts, gaps: gaps, theta: -1.0)
        store.sessionIndex = 1   // not a probe session: no fresh probe is injected
        let selector = ConceptSelector(store: store)
        func scores(_ when: Date) -> (Double, Double) {
            (selector.score(store.concept("p")!, now: when), selector.score(store.concept("q")!, now: when))
        }

        let atProbeTime = scores(now)
        #expect(abs(atProbeTime.0 - atProbeTime.1) < 1e-9, "\(atProbeTime)")
        let longAfter = scores(later)
        #expect(abs(longAfter.0 - longAfter.1) < 1e-9,
                "40 days on, the probed concept is still ranked like its twin: \(longAfter)")

        // And the probe is still not asked — the diagnostic drove nothing at all.
        let output = selector.select(.smart(now: later))
        #expect(!output.items.contains { $0.gapId == "probe-p-0" })
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

    // MARK: Mastered concepts — practised items vs. never-answered ones (engine-4-1)

    /// Mastery is a belief about a CONCEPT; a concept owns many ITEMS. A word the
    /// learner captured while reading lands on whatever concept the tagger names —
    /// often one they already know — and every review path dropped it, while "Due
    /// now" kept counting it. The check-in vehicle always prefers an already-reviewed
    /// gap, so a never-answered one had no path into a smart lesson at all.
    @Test func aNeverAnsweredGapOfAMasteredConceptIsStillTaught() {
        let now = EngineFixtures.now
        let day = EngineFixtures.day
        let known = EngineFixtures.mastered("known", category: .vocabulary)
        var gaps = (0..<2).map {
            EngineFixtures.gap("known-\($0)", concept: "known", category: .vocabulary,
                               due: now.addingTimeInterval(-Double($0 + 1) * day),
                               consecutiveCorrect: 2, reviewCount: 4)
        }
        // A word saved while reading, tagged to that same known skill, never asked.
        gaps.append(EngineFixtures.gap("captured", concept: "known", category: .vocabulary,
                                       due: now, sourceType: .reading))
        let store = EngineFixtures.store(concepts: [known], gaps: gaps)
        store.sessionIndex = 1   // not a probe session

        let output = ConceptSelector(store: store).select(.smart(now: now))
        #expect(store.dueNow(at: now).contains { $0.id == "captured" }, "the app counts it as due")
        #expect(output.gapIds.contains("captured"), "so the lesson has to be able to ask it")
        #expect(output.items.first { $0.gapId == "captured" }?.role == .review)
        #expect(output.checkInItems.map { $0.gapId } == ["known-1"], "practised material still returns as ONE check-in")
        #expect(!output.gapIds.contains("known-0"), "the other practised gap does not ride in as review")

        // A provisional placement seed is the exception: its Foundation items are the
        // vehicles that VERIFY the claim "I already know this", and teaching them would
        // re-teach exactly that. They open up when the seed fails its check-ins and the
        // concept drops out of mastery (B7/B9).
        var seed = EngineFixtures.mastered("seeded")
        seed.isProvisional = true
        let seedStore = EngineFixtures.store(concepts: [seed],
                                             gaps: (0..<3).map { EngineFixtures.gap("seeded-\($0)", concept: "seeded", due: now) })
        seedStore.sessionIndex = 1
        let provisional = ConceptSelector(store: seedStore).select(.smart(now: now))
        #expect(provisional.items.count == 1 && provisional.items.first?.role == .checkIn,
                "an unverified seed is checked, never re-taught")
    }

    /// A consolidation day (nothing left to teach) let check-ins take every slot, so
    /// the whole session was material the engine already believes the learner knows
    /// while genuinely due items kept rotting. `reviewSlotsPerLesson` is a floor on
    /// every day, not only on days with a target.
    @Test func consolidationCheckInsNeverTakeTheReservedReviewSlots() {
        let now = EngineFixtures.now
        let day = EngineFixtures.day
        var concepts: [Concept] = []
        var gaps: [GapItem] = []
        for i in 0..<8 {
            var m = EngineFixtures.mastered("m\(i)")
            m.nextCheckInAt = now.addingTimeInterval(-Double(i + 1) * day)
            concepts.append(m)
            gaps.append(EngineFixtures.gap("m\(i)-0", concept: "m\(i)", due: now.addingTimeInterval(-day),
                                           consecutiveCorrect: 2, reviewCount: 4))
        }
        // One due, practicable word the learner saved, on no concept at all.
        gaps.append(EngineFixtures.gap("saved", concept: nil, category: .vocabulary, due: now, sourceType: .reading))
        let store = EngineFixtures.store(concepts: concepts, gaps: gaps)
        store.sessionIndex = 1   // not a probe session

        let output = ConceptSelector(store: store).select(.smart(now: now))
        #expect(output.targetConceptId == nil, "nothing left to teach: a consolidation day")
        #expect(output.checkInItems.count == Tuning.lessonSize - Tuning.reviewSlotsPerLesson)
        #expect(output.gapIds.contains("saved"), "due review keeps its reserved slots")
        #expect(output.items.count == output.checkInItems.count + 1)

        // With nothing due to review, check-ins may still fill the whole lesson.
        store.gaps.removeAll { $0.id == "saved" }
        let full = ConceptSelector(store: store).select(.smart(now: now))
        #expect(full.checkInItems.count == Tuning.lessonSize)
    }

    /// The blind-spot probe is appended AFTER the lesson is built, so it must not be
    /// counted as one of the lesson's own items when the headline is chosen: every
    /// probe session turned a check-in lesson into "Today: review", and a lesson made
    /// only of the probe described a never-met skill as review.
    @Test func aProbeDoesNotMakeACheckInLessonReadAsReview() {
        let now = EngineFixtures.now
        var m = EngineFixtures.mastered("m")
        m.nextCheckInAt = now.addingTimeInterval(-EngineFixtures.day)
        let blind = EngineFixtures.concept("blind", category: .pronunciation)   // frontier, no gaps
        let gaps = [EngineFixtures.gap("m-0", concept: "m", due: now.addingTimeInterval(-EngineFixtures.day),
                                       consecutiveCorrect: 2, reviewCount: 4)]
        let store = EngineFixtures.store(concepts: [m, blind], gaps: gaps)
        store.sessionIndex = Tuning.probeEveryNSessions   // a probe session
        #expect(ConceptSelector(store: store).probeConcept()?.id == "blind")

        let output = ConceptSelector(store: store).select(.smart(now: now))
        #expect(output.items.filter { $0.role == .probe }.count == 1)
        #expect(output.checkInItems.count == 1)
        #expect(output.headline == "Today: check-ins — making sure what you've learned still holds.")

        // A lesson that is ONLY the probe says so, instead of calling a skill the
        // learner has never met "review".
        store.concepts = [blind]
        store.gaps = []
        let probeOnly = ConceptSelector(store: store).select(.smart(now: now))
        #expect(probeOnly.items.map { $0.role } == [.probe])
        #expect(probeOnly.headline == "Today: a quick check on Concept blind — a skill you haven't met yet.")
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

    /// Every gap-creation path stamps an initial `.again` FSRS state, and `.again`
    /// used to mean one lapse — so a gap nobody had ever been asked was born with a
    /// miss on its record and the first lesson of a brand-new learner read
    /// "you've slipped on it 12 times" for 12 seeded items.
    @Test func aNeverAnsweredGapCarriesNoMisses() {
        let now = EngineFixtures.now
        #expect(FSRS.makeUnseenState(now: now).lapses == 0, "nobody has missed an item nobody has been asked")
        let store = EngineFixtures.store(concepts: [EngineFixtures.learning("focus", mastery: 0.4)], gaps: [])
        store.gaps = (0..<3).map { i in
            store.makeCapturedGap(frenchWord: "focus-w\(i)", englishTranslation: "focus-w\(i)-en",
                                  sourceType: .foundation, conceptId: "focus", now: now)
        }
        store.sessionIndex = 1   // not a probe session

        let output = ConceptSelector(store: store).select(.smart(now: now))
        #expect(output.targetConceptId == "focus")
        #expect(output.headline == "Today: Concept focus.")
        #expect(output.items.allSatisfy { !$0.reason.contains("missed") })
    }

    /// engine-5-3: "This unlocks X" is a promise about what comes next, so it must
    /// name a skill the learner has NOT already finished. Late in a run almost every
    /// dependent is mastered, and the reason then reads as noise on nearly every item.
    @Test func unlockReasonNamesOnlyAnUnmasteredDependent() {
        let now = EngineFixtures.now
        let store = EngineFixtures.store(concepts: [
            EngineFixtures.learning("focus", mastery: 0.4),
            EngineFixtures.mastered("child-done", prerequisites: ["focus"]),
        ], gaps: [])
        store.gaps = (0..<3).map { i in
            store.makeCapturedGap(frenchWord: "focus-w\(i)", englishTranslation: "focus-w\(i)-en",
                                  sourceType: .foundation, conceptId: "focus", now: now)
        }
        store.sessionIndex = 1   // not a probe session

        let output = ConceptSelector(store: store).select(.smart(now: now))
        #expect(output.targetConceptId == "focus")
        #expect(output.items.allSatisfy { !$0.reason.contains("This unlocks") },
                "the only dependent is already mastered")
        #expect(output.items.contains { $0.reason == "Today's focus: Concept focus." })

        // An unmastered dependent is a real promise, so it is named — provided the
        // app can actually teach it (engine-6-1), which for a synthetic concept means
        // giving it content.
        store.concepts.append(EngineFixtures.concept("child-open", level: .A2, prerequisites: ["focus"]))
        store.foundationContent = EngineFixtures.syntheticContent(for: ["focus", "child-open"])
        let after = ConceptSelector(store: store).select(.smart(now: now))
        #expect(after.targetConceptId == "focus")
        #expect(after.items.contains { $0.reason == "This unlocks Concept child-open." })
    }

    /// engine-7-3: that same "This unlocks X" check asks the store whether the
    /// dependent is teachable once per SELECTED ITEM, and `isTeachable` used to
    /// rebuild the whole Foundation curriculum on every call — nine rebuilds and
    /// most of the cost of starting a lesson. The store memoises the answer now, so
    /// a whole selection reads the content file at most once.
    @Test func aWholeSelectionReadsTheFoundationContentAtMostOnce() {
        let now = EngineFixtures.now
        let store = EngineFixtures.store(concepts: [
            EngineFixtures.learning("focus", mastery: 0.4),
            EngineFixtures.concept("child-open", level: .A2, prerequisites: ["focus"]),
        ], gaps: [])
        store.gaps = (0..<6).map { i in
            store.makeCapturedGap(frenchWord: "focus-w\(i)", englishTranslation: "focus-w\(i)-en",
                                  sourceType: .foundation, conceptId: "focus", now: now)
        }
        store.sessionIndex = 1   // not a probe session
        let counter = ContentBuildCounter()
        let content = EngineFixtures.syntheticContent(for: ["focus", "child-open"])
        store.foundationContent = { when in counter.bump(); return content(when) }

        let output = ConceptSelector(store: store).select(.smart(now: now))
        let unlockItems = output.items.filter { $0.reason == "This unlocks Concept child-open." }
        #expect(unlockItems.count >= 2, "several items must ask the teachability question for this to bite")
        #expect(counter.count <= 1, "one selection rebuilt the curriculum \(counter.count)×")
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

    /// engine-9-4: the capstone queue was the ONE selection path that did not exclude
    /// probes, so a blind-spot probe could take a slot in the milestone quiz — where
    /// the scheduler then silently drops it. The quiz came up short of
    /// `Tuning.capstoneSize` and its headline counted a skill it never tested; with
    /// the probe as the only practicable item the learner landed straight on the
    /// completion screen.
    @Test func capstoneNeverPullsInABlindSpotProbe() {
        let now = EngineFixtures.now
        var probe = EngineFixtures.gap("probe-c-0", concept: "c", due: now,
                                       reviewCount: 1, lastReviewed: now.addingTimeInterval(-EngineFixtures.day))
        probe.isProbe = true
        probe.probeOptions = ["x", "y", "z"]
        let real = EngineFixtures.gap("c-0", concept: "c", reviewCount: 1,
                                      lastReviewed: now.addingTimeInterval(-EngineFixtures.day))
        let store = EngineFixtures.store(concepts: [EngineFixtures.learning("c", mastery: 0.7)],
                                         gaps: [real, probe])
        store.sessionIndex = 1   // not a probe session

        let output = ConceptSelector(store: store).select(.capstone(now: now))
        #expect(output.items.map { $0.gapId } == ["c-0"], "\(output.items.map { $0.gapId })")
        #expect(output.headline == "Capstone: a mixed check across 1 skill.")

        // With nothing but the probe there is honestly nothing to test — an empty
        // quiz with an honest headline, not a quiz whose only item gets dropped.
        store.gaps = [probe]
        #expect(ConceptSelector(store: store).select(.capstone(now: now)).isEmpty)
    }

    @Test func capstoneIsEmptyBeforeAnythingWasObserved() {
        let store = EngineFixtures.store(concepts: [EngineFixtures.concept("fresh")],
                                         gaps: [EngineFixtures.gap("fresh-0", concept: "fresh")])
        let output = ConceptSelector(store: store).select(.capstone(now: EngineFixtures.now))
        #expect(output.isEmpty)
    }
}
