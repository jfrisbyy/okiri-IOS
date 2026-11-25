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

        let spineCount = Tuning.lessonSize - Tuning.checkInsPerLesson - Tuning.reviewSlotsPerLesson
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

    /// The blind-spot probe deliberately picks a frontier concept with NO gaps, and
    /// above the seeded bands that is the only kind of concept left: its curriculum
    /// sits in the content file and no seeding path reaches it. Probing and stopping
    /// there diagnosed a skill the app could never teach — the answer moved the
    /// concept to `.learning` with an empty spine, so it could never be a target.
    /// Assembling the probe seeds that concept's own items too (engine-4-4).
    @Test func probingASkillWithNoContentSeedsItSoItCanBeTaught() throws {
        let now = EngineFixtures.now
        let g = EngineFixtures.smallGraph()
        let store = g.store
        store.foundationContent = { when in
            (0..<4).map { EngineFixtures.gap("\(g.probeMe)-item-\($0)", concept: g.probeMe, due: when) }
        }
        let output = ConceptSelector(store: store).select(.smart(now: now))
        let probeItem = try #require(output.probeItem)
        #expect(probeItem.conceptId == g.probeMe)
        #expect(store.gaps(forConcept: g.probeMe).isEmpty, "nothing behind the probed skill yet")

        _ = try #require(LessonAssembler(store: store).assemble(output))
        #expect(store.gaps(forConcept: g.probeMe).filter { !$0.isProbe }.count == 4,
                "the probed skill now has its curriculum")
        let concept = try #require(store.concept(g.probeMe))
        #expect(ConceptSelector(store: store).hasPracticableGap(concept, now: now),
                "so it can be TAUGHT, not only diagnosed")

        // Assembling again seeds nothing more, and a concept that already has items
        // is left alone.
        _ = LessonAssembler(store: store).assemble(output)
        #expect(store.gaps(forConcept: g.probeMe).filter { !$0.isProbe }.count == 4)
        #expect(store.seedConceptContentIfNeeded(g.root, now: now) == 0)
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

    /// lesson-5-3: a card's worked example prints the item's sentence with its blank
    /// form highlighted and its English underneath. Taking it from an item the same
    /// lesson goes on to fill-blank hands the answer over and grows an FSRS interval
    /// on the screen before — the rule `LessonSession.mayTeach` already enforces for
    /// word cards. The example is a NEW item of the concept, one the lesson does not
    /// ask at all, or none.
    @Test func aWorkedExampleIsNeverAnItemTheLessonIsAboutToTest() throws {
        let now = EngineFixtures.now
        let concept = EngineFixtures.learning("k", mastery: 0.5)
        let reviewed = EngineFixtures.gap("k-old", concept: "k", consecutiveCorrect: 2, reviewCount: 3,
                                          lastReviewed: now.addingTimeInterval(-EngineFixtures.day))
        let fresh = EngineFixtures.gap("k-new", concept: "k")
        let store = EngineFixtures.store(concepts: [concept], gaps: [reviewed, fresh])
        let output = ConceptSelector(store: store).select(.scoped(["k-old", "k-new"], name: "K", now: now))
        let lesson = try #require(LessonAssembler(store: store).assemble(output))
        #expect(Set(lesson.gaps.map { $0.id }) == ["k-old", "k-new"])
        let block = try #require(lesson.conceptBlocks.first { $0.concept.id == "k" })
        #expect(block.example?.id == "k-new", "the reviewed item is here to be tested, not taught")

        // Only reviewed items in the lesson and nothing else for the concept: the card
        // teaches the rule with no worked example rather than leaking one.
        let reviewedOnly = EngineFixtures.store(concepts: [concept], gaps: [reviewed])
        let scoped = ConceptSelector(store: reviewedOnly).select(.scoped(["k-old"], name: "K", now: now))
        let lesson2 = try #require(LessonAssembler(store: reviewedOnly).assemble(scoped))
        let block2 = try #require(lesson2.conceptBlocks.first { $0.concept.id == "k" })
        #expect(block2.example == nil)
        #expect(block2.reason != nil, "the card still says why the skill is here")
    }

    /// lesson-10-5: lesson-5-3 kept a reviewed item from being a card's worked
    /// example, but the content's own skill card printed it anyway — 57 shipped items
    /// have their exact example sentence or their headword among their concept's
    /// teaching examples ("Ma mère est gentille." on the family card, then "Ma _____
    /// est gentille."). The card withholds the sentence and headword of every item the
    /// lesson may not teach, and keeps the rule, the mistake and the other examples.
    @Test func aSkillCardNeverPrintsTheSentenceOfAnItemItMayNotTeach() throws {
        let data = try #require(bundledContentData(), "FoundationContent.json must be reachable from the test host")
        let file = try FoundationContentLoader.decode(data)
        let gaps = FoundationContentLoader.gaps(from: file, now: EngineFixtures.now)
        var overlapping = 0
        for gap in gaps {
            guard let conceptId = gap.conceptId,
                  let card = FoundationContentLoader.teaching(for: conceptId, in: file) else { continue }
            let own = Set([gap.exampleSentence, gap.frenchWord].map(AnswerGrader.normalize))
            let shown = (card.examples + card.contrast).map { AnswerGrader.normalize($0.fr) }
            let leaked = shown.filter { own.contains($0) }.count
            guard leaked > 0 else { continue }
            overlapping += 1
            let withheld = LessonAssembler.teaching(card, withholding: own)
            let left = (withheld.examples + withheld.contrast).map { AnswerGrader.normalize($0.fr) }
            #expect(!left.contains { own.contains($0) }, "\(gap.id): the card still prints the item it tests")
            #expect(left.count == shown.count - leaked, "\(gap.id): only the leaking examples go")
            #expect(withheld.rule == card.rule && withheld.commonMistake == card.commonMistake)
        }
        #expect(overlapping >= 50, "the shipped overlap this guards (\(overlapping))")

        let card = FoundationTeachingContent(rule: "r",
                                             examples: [FoundationExampleContent(fr: "Ma mère est gentille.", en: "e"),
                                                        FoundationExampleContent(fr: "Mon père", en: "e")],
                                             contrast: [FoundationExampleContent(fr: "ma mère", en: "e")],
                                             commonMistake: "m")
        #expect(LessonAssembler.teaching(card, withholding: []) == card, "nothing withheld, nothing dropped")
        let trimmed = LessonAssembler.teaching(card, withholding: [AnswerGrader.normalize("Ma mère est gentille"),
                                                                   AnswerGrader.normalize("ma mère")])
        #expect(trimmed.examples.map { $0.fr } == ["Mon père"] && trimmed.contrast.isEmpty)
    }

    private func bundledContentData() -> Data? {
        let here = URL(fileURLWithPath: #filePath)
        let candidates = [
            here.deletingLastPathComponent().deletingLastPathComponent()
                .appendingPathComponent("FluentFrenchIOS/Resources/FoundationContent.json"),
            URL(fileURLWithPath: FileManager.default.currentDirectoryPath).appendingPathComponent("Resources/FoundationContent.json"),
        ]
        for url in candidates {
            if let data = try? Data(contentsOf: url) { return data }
        }
        return nil
    }

    /// A blind-spot probe is a diagnosis, not teaching material: the skill it
    /// probes gets no card, and no card takes its worked example from a probe.
    /// Teaching a skill — with the probe's own sentence and its translation —
    /// right before probing it makes the answer a memory of the last screen.
    @Test func theProbedSkillIsNotTaughtBeforeItIsProbed() throws {
        let g = EngineFixtures.smallGraph()
        let output = ConceptSelector(store: g.store).select(.smart(now: EngineFixtures.now))
        let probeItem = try #require(output.probeItem)
        let lesson = try #require(LessonAssembler(store: g.store).assemble(output))

        #expect(lesson.gaps.contains { $0.id == probeItem.gapId }, "the probe is still asked")
        #expect(lesson.probeGapId == probeItem.gapId)
        #expect(!lesson.conceptBlocks.contains { $0.concept.id == probeItem.conceptId },
                "no skill card for a concept carried only by its probe")
        #expect(lesson.conceptBlocks.allSatisfy { $0.example?.isProbe != true },
                "no worked example is a probe item")
        #expect(!lesson.conceptBlocks.isEmpty, "the lesson still teaches its target")
    }

    /// A check-in tests what the learner is believed to already know: its miss weighs
    /// double and feeds the retention governor and the unlock gate. A skill card —
    /// the rule, the examples, and the check-in's own item worked through it — right
    /// before the question hands the answer over, exactly as it would for a probe.
    @Test func theCheckedSkillIsNotTaughtBeforeItIsChecked() throws {
        let g = EngineFixtures.smallGraph()
        let output = ConceptSelector(store: g.store).select(.smart(now: EngineFixtures.now))
        let checkIn = try #require(output.checkInItems.first)
        let lesson = try #require(LessonAssembler(store: g.store).assemble(output))

        #expect(lesson.gaps.contains { $0.id == checkIn.gapId }, "the check-in is still asked")
        #expect(!lesson.conceptBlocks.contains { $0.concept.id == checkIn.conceptId },
                "no skill card for the concept that is about to be checked")
        #expect(lesson.conceptBlocks.allSatisfy { $0.example?.id != checkIn.gapId },
                "and the check-in item is never a card's worked example")
        #expect(!lesson.conceptBlocks.isEmpty, "the lesson still teaches its target")
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
