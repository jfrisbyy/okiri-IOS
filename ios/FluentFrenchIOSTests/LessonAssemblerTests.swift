//
//  LessonAssemblerTests.swift
//  FluentFrenchIOSTests
//
//  The assembler picks nothing: it resolves, orders by role, pairs confusions
//  and decorates exactly the items the selector chose.
//

import Foundation
import Testing
@testable import FluentFrenchIOS

@MainActor
struct LessonAssemblerTests {

    @Test func assemblerAddsNothingBeyondTheSelection() throws {
        let g = EngineFixtures.smallGraph()
        let output = ConceptSelector(store: g.store).select(.smart(now: EngineFixtures.now))
        let lesson = try #require(LessonAssembler(store: g.store).assemble(output))

        #expect(Set(lesson.gaps.map { $0.id }) == Set(output.gapIds), "same items in, same items out")
        #expect(lesson.gaps.count == output.items.count)
        #expect(lesson.targetConcept?.id == g.root)
        #expect(lesson.headline == output.headline)
        #expect(lesson.reasons == output.reasonsByGapId)
        #expect(!lesson.isCapstone && !lesson.isScoped)
    }

    @Test func assemblerOrdersTargetThenReviewThenProbe() throws {
        let g = EngineFixtures.smallGraph()
        let output = ConceptSelector(store: g.store).select(.smart(now: EngineFixtures.now))
        let lesson = try #require(LessonAssembler(store: g.store).assemble(output))

        let spineCount = Int((Double(Tuning.lessonSize) * Tuning.targetRatio).rounded())
        let ids = lesson.gaps.map { $0.id }
        #expect(Array(ids.prefix(spineCount)) == Array(g.rootGapIds.prefix(spineCount)), "target spine leads, in the selector's weakest-first order")
        #expect(Array(ids.dropFirst(spineCount).prefix(2)) == ["done-0", "frontier-0"], "then the check-in, then review")
        #expect(ids.last == lesson.probeGapId, "probe last")
    }

    @Test func probeIsMaterializedInTheStoreOnAssembly() throws {
        let g = EngineFixtures.smallGraph()
        let output = ConceptSelector(store: g.store).select(.smart(now: EngineFixtures.now))
        let probeId = try #require(output.probeItem?.gapId)
        #expect(!g.store.gaps.contains { $0.id == probeId }, "selection is side-effect free")

        let lesson = try #require(LessonAssembler(store: g.store).assemble(output))
        #expect(lesson.probeGapId == probeId)
        let probe = try #require(g.store.gaps.first { $0.id == probeId })
        #expect(probe.conceptId == g.probeMe)
        #expect(probe.sourceType == .foundation)
        // B13: a real content probe — prompt, answer and distractors from `probes`.
        let content = EngineFixtures.syntheticProbes(for: g.probeMe)[g.store.sessionIndex % 3]
        #expect(probe.isProbe)
        #expect(probe.frenchWord == content.fr)
        #expect(probe.englishTranslation == content.en)
        #expect(probe.probeOptions == content.options)
        #expect(probe.exampleSentence == content.ex)

        // Assembling the same output twice reuses the record instead of duplicating it.
        _ = LessonAssembler(store: g.store).assemble(output)
        #expect(g.store.gaps.filter { $0.id == probeId }.count == 1)
    }

    @Test func probeWithNoContentIsDroppedNotSubstituted() throws {
        let g = EngineFixtures.smallGraph()
        let output = ConceptSelector(store: g.store).select(.smart(now: EngineFixtures.now))
        let probeId = try #require(output.probeItem?.gapId)
        // Content vanished between selection and assembly: the item is dropped.
        g.store.probeContent = { _ in [] }
        let lesson = try #require(LessonAssembler(store: g.store).assemble(output))
        #expect(lesson.probeGapId == nil)
        #expect(!lesson.gaps.contains { $0.id == probeId })
        #expect(lesson.gaps.count == output.items.count - 1)
        #expect(!g.store.gaps.contains { $0.id == probeId }, "nothing was materialised")
    }

    @Test func assemblerPlacesConfusionPairsAdjacent() throws {
        let now = EngineFixtures.now
        let link = ConfusionLink(partnerGapId: "c", wrongPicks: 2, lastConfusedAt: now, strength: 0.6)
        let concept = EngineFixtures.learning("k", mastery: 0.5)
        let gaps = [
            EngineFixtures.gap("a", concept: "k", consecutiveCorrect: 0, confusion: [link]),
            EngineFixtures.gap("b", concept: "k", consecutiveCorrect: 1),
            EngineFixtures.gap("c", concept: "k", consecutiveCorrect: 2),
        ]
        let store = EngineFixtures.store(concepts: [concept], gaps: gaps)
        let output = ConceptSelector(store: store).select(.scoped(["a", "b", "c"], name: "Trio", now: now))
        #expect(output.gapIds == ["a", "b", "c"], "weakest first before pairing")

        let lesson = try #require(LessonAssembler(store: store).assemble(output))
        #expect(lesson.gaps.map { $0.id } == ["a", "c", "b"], "the confusion partner is pulled next to its pair")
        #expect(lesson.reasons["a"] == "You keep confusing this with “c-fr”.")
    }

    @Test func skillCardsLeadWithTheTargetAndAreCapped() throws {
        let g = EngineFixtures.smallGraph()
        let output = ConceptSelector(store: g.store).select(.smart(now: EngineFixtures.now))
        let lesson = try #require(LessonAssembler(store: g.store).assemble(output))

        #expect(lesson.conceptBlocks.first?.concept.id == g.root)
        #expect(lesson.conceptBlocks.count <= Tuning.maxConceptCards)
        #expect(lesson.conceptBlocks.first?.example?.conceptId == g.root)
    }

    @Test func capstoneIsAPureTestWithNoSkillCards() throws {
        let concept = EngineFixtures.learning("k", mastery: 0.7)
        let gaps = (0..<4).map {
            EngineFixtures.gap("k-\($0)", concept: "k", lastReviewed: EngineFixtures.now.addingTimeInterval(-EngineFixtures.day))
        }
        let store = EngineFixtures.store(concepts: [concept], gaps: gaps)
        let output = ConceptSelector(store: store).select(.capstone(now: EngineFixtures.now))
        let lesson = try #require(LessonAssembler(store: store).assemble(output))

        #expect(lesson.isCapstone)
        #expect(lesson.conceptBlocks.isEmpty)
        #expect(lesson.targetConcept == nil)
        #expect(lesson.gaps.count == 4)
    }

    @Test func emptySelectionAssemblesToNoLesson() {
        var resting = EngineFixtures.mastered("done")
        resting.nextCheckInAt = EngineFixtures.now.addingTimeInterval(30 * EngineFixtures.day)
        let store = EngineFixtures.store(concepts: [resting], gaps: [])
        let output = ConceptSelector(store: store).select(.smart(now: EngineFixtures.now))
        #expect(output.isEmpty)
        #expect(LessonAssembler(store: store).assemble(output) == nil)
        #expect(LessonAssembler(store: store).assemble(.empty(for: .smart(now: EngineFixtures.now))) == nil)
    }

    @Test func itemsWhoseGapVanishedAreDroppedNotSubstituted() throws {
        let g = EngineFixtures.smallGraph()
        g.store.sessionIndex = 1
        let output = ConceptSelector(store: g.store).select(.smart(now: EngineFixtures.now))
        g.store.gaps.removeAll { $0.id == "root-0" }
        let lesson = try #require(LessonAssembler(store: g.store).assemble(output))
        #expect(lesson.gaps.count == output.items.count - 1)
        #expect(!lesson.gaps.contains { $0.id == "root-0" })
        #expect(Set(lesson.gaps.map { $0.id }).isSubset(of: Set(output.gapIds)))
    }

    @Test func pipelineOutcomeExplainsAnEmptySelection() {
        // Mastered, verified, next check-in weeks away, no gaps: nothing to build.
        var resting = EngineFixtures.mastered("done")
        resting.nextCheckInAt = EngineFixtures.now.addingTimeInterval(30 * EngineFixtures.day)
        resting.checkInIntervalDays = Tuning.checkInInitialDays
        let store = EngineFixtures.store(concepts: [resting], gaps: [])
        let outcome = LessonPipeline(store: store).outcome(for: .smart(now: EngineFixtures.now))
        #expect(outcome.lesson == nil)
        #expect(outcome.emptyHeadline == "Nothing to practice right now.")
    }

    @Test func pipelineOutcomeCarriesTheLesson() throws {
        let g = EngineFixtures.smallGraph()
        let outcome = LessonPipeline(store: g.store).outcome(for: .smart(now: EngineFixtures.now))
        let lesson = try #require(outcome.lesson)
        #expect(lesson.targetConcept?.id == g.root)
        #expect(outcome.emptyHeadline == nil)
    }
}
