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
        let spineCount = Int((Double(Tuning.lessonSize) * Tuning.targetRatio).rounded())
        #expect(spine.count == spineCount)
        #expect(spine == Array(g.rootGapIds.prefix(spineCount)), "weakest first: root-0 (r=0.40) … root-4 (r=0.88)")
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
        let review = output.items.filter { $0.role == .review }.map { $0.gapId }
        #expect(review == g.doneGapIds, "the due gaps of a mastered concept are still reviewable (FSRS), most overdue first")
        for item in output.items where item.role == .review {
            #expect(!item.reason.isEmpty)
        }
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

    @Test func smartFallsBackToReviewOnlyWhenNothingIsEligible() {
        let concepts = [EngineFixtures.mastered("done", category: .vocabulary)]
        let gaps = (0..<3).map {
            EngineFixtures.gap("done-\($0)", concept: "done", category: .vocabulary,
                               due: EngineFixtures.now.addingTimeInterval(-Double($0) * EngineFixtures.day))
        }
        let store = EngineFixtures.store(concepts: concepts, gaps: gaps)
        let output = ConceptSelector(store: store).select(.smart(now: EngineFixtures.now))

        #expect(output.targetConceptId == nil)
        #expect(output.rankedConcepts.isEmpty)
        #expect(output.items.count == 3)
        #expect(output.items.allSatisfy { $0.role == .review })
        #expect(output.items.map { $0.gapId } == ["done-2", "done-1", "done-0"], "most overdue first")
        #expect(output.headline == "Today: review — keeping what you've learned fresh.")
    }

    @Test func smartIsHonestlyEmptyWithNothingToPractice() {
        let store = EngineFixtures.store(concepts: [EngineFixtures.mastered("done")], gaps: [])
        let output = ConceptSelector(store: store).select(.smart(now: EngineFixtures.now))
        #expect(output.isEmpty)
        #expect(output.headline == "Nothing to practice right now.")
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

    @Test func smartHonoursTheRequestedLessonSize() {
        let g = EngineFixtures.smallGraph()
        g.store.sessionIndex = 1
        let output = ConceptSelector(store: g.store).select(SelectionRequest(mode: .smart, lessonSize: 4, now: EngineFixtures.now))
        #expect(output.items.count == 4)
        #expect(output.items.filter { $0.role == .target }.count == Int((4 * Tuning.targetRatio).rounded()))
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
        g.store.gaps.append(EngineFixtures.gap("retired", concept: g.root, mastered: EngineFixtures.now))
        let ids = ["root-0", "root-0", "blocked-0", "done-0", "retired", "does-not-exist", "root-0"]
        let output = ConceptSelector(store: g.store).select(.scoped(ids, name: "Mixed", now: EngineFixtures.now))

        #expect(output.gapIds == ["root-0", "done-0"], "dedupe, drop blocked + mastered + unknown, weakest first")
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

        // Error patterns resolve to the gaps behind their records and use the pattern's label.
        s.errors = [
            ErrorRecord(id: "e1", gapId: "root-2", category: .grammar, frenchWord: "x", userAnswer: "a",
                        correctAnswer: "b", conceptLabel: "Pattern P", occurredAt: EngineFixtures.now),
            ErrorRecord(id: "e2", gapId: "root-4", category: .grammar, frenchWord: "x", userAnswer: "a",
                        correctAnswer: "b", conceptLabel: "Pattern P", occurredAt: EngineFixtures.now),
        ]
        let pattern = s.errorPatterns.first!
        let request = s.selectionRequest(for: .errorPattern(id: pattern.id), now: EngineFixtures.now)
        #expect(request.scopeName == "Pattern P")
        if case .scoped(let ids) = request.mode {
            #expect(Set(ids) == ["root-2", "root-4"])
        } else {
            Issue.record("error pattern must be a scoped request")
        }
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
        #expect(Tuning.capstoneLearningWeight > 3.1 && Tuning.capstoneTrendingWeight > 3.1,
                "tier weights must exceed the ranker's maximum (urgency 1 + leverage 0.6 + frontier 0.8 + confusion 0.7)")
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
