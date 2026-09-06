//
//  PlacementFlowTests.swift
//  FluentFrenchIOSTests
//
//  Package D-flow: the placement bank built from content probes (D6/B9), the
//  per-category staircase bottom-out that keeps a false beginner from reading as
//  a true beginner, D7's counter reset, seeded reproducibility, Foundation
//  seeding (D3: base concepts only, staggered; D4: the A2 bridge on unlock),
//  "Due now" / "Coming up" (D13), the New retention scope (B4), the weekly goal
//  (D11) and the Foundation progress counts (D10).
//

import Foundation
import Testing
@testable import FluentFrenchIOS

@MainActor
struct PlacementFlowTests {
    private let now = EngineFixtures.now
    private let day = EngineFixtures.day

    // MARK: Fixtures

    /// The shipped FoundationContent.json: next to the test sources (Xcode) or in the
    /// harness's `Resources/` copy (Linux); nil when neither is present.
    private func shippedContentURL() -> URL? {
        let here = URL(fileURLWithPath: #filePath)
        let candidates = [
            here.deletingLastPathComponent().deletingLastPathComponent()
                .appendingPathComponent("FluentFrenchIOS/Resources/FoundationContent.json"),
            URL(fileURLWithPath: FileManager.default.currentDirectoryPath).appendingPathComponent("Resources/FoundationContent.json"),
            URL(fileURLWithPath: "/home/user/okiri-IOS/ios/FluentFrenchIOS/Resources/FoundationContent.json"),
        ]
        return candidates.first { FileManager.default.fileExists(atPath: $0.path) }
    }

    /// Synthetic content-v2 file: `perConcept` token items and three probes for every
    /// taxonomy concept (no French invented — the engine never reads the text).
    private func syntheticContent(perConcept: Int = 12) -> FoundationContentFile {
        let skills = ConceptTaxonomy.seed().map { concept -> FoundationSkillContent in
            let items = (0..<perConcept).map { i in
                FoundationItemContent(fr: "\(concept.id)-w\(i)", en: "\(concept.id)-e\(i)", note: "n",
                                      ex: "x \(concept.id)-w\(i) y", exEn: "t", blank: "\(concept.id)-w\(i)")
            }
            return FoundationSkillContent(id: concept.id, category: concept.category.rawValue,
                                          teaching: FoundationTeachingContent(rule: "r"),
                                          probes: EngineFixtures.syntheticProbes(for: concept.id), items: items)
        }
        return FoundationContentFile(version: 2, skills: skills)
    }

    /// A store whose Foundation curriculum is the synthetic content file.
    private func contentStore(perConcept: Int = 12) -> AppStore {
        let s = EngineFixtures.store()
        let file = syntheticContent(perConcept: perConcept)
        s.foundationContent = { when in FoundationContentLoader.gaps(from: file, now: when) }
        return s
    }

    private func question(_ band: Int, _ category: GapCategory, _ concept: String, _ n: Int) -> AssessmentQuestion {
        AssessmentQuestion(band: band, category: category, prompt: "\(concept)-p\(n)", french: "\(concept)-fr\(n)",
                           english: "\(concept)-en\(n)", options: ["\(concept)-en\(n)", "x", "y"], correctAnswer: "\(concept)-en\(n)",
                           explanation: "", exampleSentence: "", exampleTranslation: "", conceptId: concept)
    }

    /// A band-1/2 bank with three items per concept: two band-1 and one band-2
    /// concept per category — the shape the content bank has for the base set.
    private func smallBank() -> [AssessmentQuestion] {
        var bank: [AssessmentQuestion] = []
        for n in 0..<3 {
            bank.append(question(1, .vocabulary, "everyday-vocab", n))
            bank.append(question(1, .vocabulary, "colors-vocab", n))
            bank.append(question(1, .grammar, "definite-articles", n))
            bank.append(question(1, .grammar, "plurals", n))
            bank.append(question(2, .vocabulary, "family-vocab", n))
            bank.append(question(2, .grammar, "negation", n))
        }
        return bank
    }

    /// Drive an engine with a per-category oracle.
    private func run(_ engine: inout PlacementEngine, knows: (AssessmentQuestion) -> Bool) -> [AssessmentQuestion] {
        var asked: [AssessmentQuestion] = []
        while let q = engine.next() {
            asked.append(q)
            engine.record(q, correct: knows(q))
        }
        return asked
    }

    // MARK: D6 / B9 — the placement bank is built from content probes

    @Test func placementBankComesFromShippedContentProbesWithHandItemsOnlyAsFallback() throws {
        guard let url = shippedContentURL() else {
            print("[PlacementFlowTests] FoundationContent.json not reachable from this host — skipping the shipped-bank check")
            return
        }
        let file = try FoundationContentLoader.load(from: url)
        #expect(file.version == 2)
        let s = EngineFixtures.store()
        let bank = AssessmentService.placementBank(concepts: s.concepts, probes: { FoundationContentLoader.probes(for: $0, in: file) })

        // Three real items for every base grammar / vocabulary concept, each with the
        // answer plus the content's three distractors.
        let base = s.concepts.filter { ConceptTaxonomy.baseConceptIds.contains($0.id) && ($0.category == .grammar || $0.category == .vocabulary) }
        #expect(!base.isEmpty)
        for concept in base {
            let items = bank.filter { $0.conceptId == concept.id }
            #expect(items.count == Tuning.placementProbesPerConcept, "\(concept.id): \(items.count) items")
            for item in items {
                #expect(item.options.count == 4 && item.options.contains(item.correctAnswer), "\(concept.id): options")
                #expect(Set(item.options).count == 4, "\(concept.id): distinct options")
                #expect(item.band == AssessmentService.bandForLevel(concept.cefrLevel))
                #expect(item.category == concept.category)
                #expect(!item.french.isEmpty && !item.english.isEmpty)
            }
        }
        // Hand-written items survive only where content is missing: a band no content
        // probe reaches (band 4 has no taxonomy concept). None of the hand items for a
        // covered concept at a covered band remain.
        let hand = Set(AssessmentService.bank.map { $0.id })
        let survivors = bank.filter { hand.contains($0.id) }
        #expect(!survivors.isEmpty, "band-4 items have no content counterpart")
        let coveredBands = Set(bank.filter { !hand.contains($0.id) }.map { $0.band })
        for q in survivors {
            let coveredConcept = q.conceptId.map { cid in bank.contains { $0.conceptId == cid && !hand.contains($0.id) } } ?? false
            #expect(!coveredConcept || !coveredBands.contains(q.band), "\(q.french): a covered item leaked into the bank")
        }
        // The staircase finds material: a learner who knows everything climbs to the
        // top bands on three-probe reads and every base concept is at least inferred.
        var engine = PlacementEngine(bank: bank, seed: 1)
        _ = run(&engine) { _ in true }
        let result = engine.result()
        #expect(!result.isTrueBeginner)
        #expect(result.estimatedLevel == .B1 || result.estimatedLevel == .B2)
        #expect(!result.fullyProbedConceptIds.isEmpty)
        #expect(result.masteredConceptIds.allSatisfy { result.askedCount(for: $0) >= Tuning.placementProbesPerConcept })
        let baseGV = Set(base.map { $0.id })
        #expect(baseGV.isSubset(of: Set(result.masteredConceptIds).union(result.inferredConceptIds)))

        // And a learner who knows only the band-1 material is read at A1 with base seeds.
        var a1 = PlacementEngine(bank: bank, seed: 2)
        _ = run(&a1) { $0.band <= 1 }
        let a1Result = a1.result()
        #expect(!a1Result.isTrueBeginner && a1Result.estimatedLevel == .A1)
        #expect(!a1Result.masteredConceptIds.isEmpty && !a1Result.inferredConceptIds.isEmpty)
    }

    @Test func placementBankFallsBackToHandItemsWhenContentIsMissing() {
        let s = EngineFixtures.store()
        let empty = AssessmentService.placementBank(concepts: s.concepts, probes: { _ in [] })
        #expect(empty.count == AssessmentService.bank.count, "no content → the hand-written bank as it was")
        let partial = AssessmentService.placementBank(concepts: s.concepts, probes: { cid in
            cid == "everyday-vocab" ? EngineFixtures.syntheticProbes(for: cid) : []
        })
        let everyday = partial.filter { $0.conceptId == "everyday-vocab" }
        #expect(everyday.filter { $0.band == 1 }.count == Tuning.placementProbesPerConcept,
                "the three content probes replace the band-1 hand items of a covered concept")
        #expect(!everyday.contains { $0.band == 1 && $0.french == "eau" })
        #expect(everyday.contains { $0.band == 2 }, "a hand item at a band no content probe reaches is kept")
        #expect(partial.contains { $0.conceptId == "definite-articles" }, "uncovered concepts keep their hand items")
    }

    @Test func optionsAreShuffledPerPresentationAndASeedReplaysTheStaircase() {
        let bank = smallBank()
        var a = PlacementEngine(bank: bank, seed: 42)
        var b = PlacementEngine(bank: bank, seed: 42)
        let askedA = run(&a) { $0.category == .vocabulary }
        let askedB = run(&b) { $0.category == .vocabulary }
        #expect(askedA.map { $0.id } == askedB.map { $0.id }, "same seed, same items in the same order")
        #expect(askedA.map { $0.options } == askedB.map { $0.options }, "same seed, same option order")
        for q in askedA {
            #expect(Set(q.options) == Set(bank.first { $0.id == q.id }!.options), "a presentation only reorders options")
        }
        // Presentation order varies across presentations of the SAME item.
        var orders = Set<[String]>()
        var rng = PlacementRandom(seed: 7)
        for _ in 0..<40 { orders.insert(bank[0].presented(using: &rng).options) }
        #expect(orders.count > 1)
    }

    // MARK: B9 / D6 — per-category bottom-out; D7 — a correct answer resets the counter

    @Test func aStrongVocabularyIsNeverHiddenByAWeakGrammar() {
        // A false beginner: every vocabulary item right, every grammar item wrong.
        var engine = PlacementEngine(bank: smallBank(), seed: 3)
        let asked = run(&engine) { $0.category == .vocabulary }
        #expect(engine.bottomedOutCategories == [.grammar], "grammar bottoms out on its own")
        let grammarAsked = asked.filter { $0.category == .grammar }
        #expect(grammarAsked.count <= Tuning.placementBottomOutMisses + 1,
                "grammar stops after \(Tuning.placementBottomOutMisses) lowest-band misses in a row")
        let result = engine.result()
        #expect(!result.isTrueBeginner, "the staircase sees the vocabulary")
        #expect(result.vocabBand >= 1 && result.grammarBand == 0)
        #expect(result.masteredConceptIds.contains("everyday-vocab") || result.masteredConceptIds.contains("family-vocab"))
        #expect(result.masteredConceptIds.allSatisfy { $0.hasSuffix("vocab") })
        #expect(!result.inferredConceptIds.isEmpty, "in-band vocabulary concepts are inferred")
        #expect(Set(result.missedConceptIds).isSubset(of: ["definite-articles", "plurals", "negation"]))
    }

    @Test func aTrueBeginnerBottomsOutInEveryCategory() {
        var engine = PlacementEngine(bank: smallBank(), seed: 5)
        let asked = run(&engine) { _ in false }
        #expect(engine.bottomedOutCategories == [.vocabulary, .grammar])
        #expect(asked.count <= 2 * (Tuning.placementBottomOutMisses + 1), "a beginner is not dragged through the whole bank")
        let result = engine.result()
        #expect(result.isTrueBeginner && result.estimatedLevel == .A1)
        #expect(result.masteredConceptIds.isEmpty && result.inferredConceptIds.isEmpty)
    }

    @Test func aCorrectAnswerResetsTheBottomOutCounter() {
        // Three band-1 vocabulary concepts, one item each: miss, hit, miss must NOT
        // read as two lowest-band misses in a row (D7).
        let bank = [question(1, .vocabulary, "everyday-vocab", 0),
                    question(1, .vocabulary, "family-vocab", 0),
                    question(1, .vocabulary, "colors-vocab", 0),
                    question(1, .vocabulary, "food-drink-vocab", 0)]
        var engine = PlacementEngine(bank: bank, seed: 9)
        engine.record(bank[0], correct: false)
        engine.record(bank[1], correct: true)
        engine.record(bank[2], correct: false)
        #expect(engine.bottomedOutCategories.isEmpty)
        #expect(engine.next() != nil, "the counter was reset by the hit")
        engine.record(bank[3], correct: false)
        #expect(engine.bottomedOutCategories == [.vocabulary], "two lowest-band misses in a row bottom the category out")
        #expect(engine.next() == nil)
    }

    /// The design bank (hand items + three content probes per concept) against the
    /// simulated false beginner across many staircase seeds: the archetype is
    /// placed as a knower with seeds and inferences essentially always — the
    /// failure the per-category bottom-out fixes was a 3-in-5 misclassification.
    @Test func simulatedFalseBeginnerIsPlacedAsAKnowerAcrossSeeds() {
        let store = EngineFixtures.store()
        let bank = AssessmentService.bank + AssessmentService.contentBank(concepts: store.concepts, probes: EngineFixtures.syntheticProbes)
        var beginners = 0, seededRuns = 0, vocabReads = 0
        let seeds: [UInt64] = Array(1...24)
        for seed in seeds {
            let learner = SyntheticLearner(archetype: .falseBeginner, concepts: store.concepts, seed: seed)
            var engine = PlacementEngine(bank: bank, seed: seed)
            _ = run(&engine) { q in q.conceptId.map { learner.probe($0) } ?? false }
            let result = engine.result()
            if result.isTrueBeginner {
                beginners += 1
                #expect(result.masteredConceptIds.isEmpty, "seed \(seed): a fully probed concept never reads as a true beginner")
                continue
            }
            #expect(result.vocabBand >= 1 || result.grammarBand >= 1)
            #expect(!result.inferredConceptIds.isEmpty, "seed \(seed): in-band concepts are inferred")
            #expect(result.masteredConceptIds.allSatisfy { ConceptTaxonomy.baseConceptIds.contains($0) && result.askedCount(for: $0) >= Tuning.placementProbesPerConcept })
            #expect(Set(result.masteredConceptIds).isDisjoint(with: result.missedConceptIds))
            if result.vocabBand >= 1 { vocabReads += 1 }
            if !result.masteredConceptIds.isEmpty { seededRuns += 1 }
        }
        #expect(beginners <= 1, "\(beginners) of \(seeds.count) false-beginner runs read as true beginners")
        #expect(vocabReads >= seeds.count / 2, "the vocabulary band is read in most runs (\(vocabReads))")
        #expect(seededRuns >= seeds.count / 2, "most runs seed provisional mastery on what they fully probed (\(seededRuns))")
    }

    // MARK: D3 — first-run seeding: base concepts only, staggered

    @Test func seederOrdersBaseThenProvisionalAndKeepsTheBridgeForLater() {
        let base = FoundationSeeder.baseConceptIds
        #expect(Set(base) == ConceptTaxonomy.baseConceptIds)
        #expect(base == FoundationSeeder.taxonomyOrder.filter { ConceptTaxonomy.baseConceptIds.contains($0) }, "taxonomy order")
        let bridge = FoundationSeeder.bridgeConceptIds
        #expect(!bridge.isEmpty)
        #expect(Set(bridge).isDisjoint(with: ConceptTaxonomy.baseConceptIds))
        let levels = Dictionary(ConceptTaxonomy.seed().map { ($0.id, $0.cefrLevel) }, uniquingKeysWith: { a, _ in a })
        #expect(bridge.allSatisfy { levels[$0] == .A1 || levels[$0] == .A2 })
        #expect(bridge.contains("adjective-agreement") && bridge.contains("nasal-vowels"))
        #expect(!bridge.contains("imparfait"), "B1 is not bridge material")

        let ids = FoundationSeeder.firstRunConceptIds(seededMastered: ["negation", "not-a-concept"])
        #expect(Set(ids) == ConceptTaxonomy.baseConceptIds.union(["not-a-concept"]))
        #expect(ids.last == "not-a-concept")
        #expect(ids.dropLast() == ArraySlice(base), "base concepts in taxonomy order; a provisional seed is already one of them")
    }

    @Test func staggerReleasesWholeConceptsAboutABatchADay() {
        let s = contentStore(perConcept: 12)
        let content = s.foundationContent(now)
        let slice = FoundationSeeder.slice(from: content, conceptIds: FoundationSeeder.baseConceptIds)
        #expect(slice.count == 12 * ConceptTaxonomy.baseConceptIds.count)
        let staggered = FoundationSeeder.staggered(slice, batch: 20, now: now, calendar: s.calendar)
        // 12 + 12 = 24 items before the third concept starts → day 1; the first two
        // concepts are due at once.
        let dueDay0 = staggered.filter { $0.nextReviewAt <= now }
        #expect(dueDay0.count == 24)
        #expect(Set(dueDay0.compactMap { $0.conceptId }).count == 2, "whole concepts, never half of one")
        #expect(staggered.allSatisfy { $0.fsrs?.dueAt == $0.nextReviewAt }, "FSRS and nextReviewAt agree")
        let lastDay = staggered.map { $0.nextReviewAt }.max()!
        let days = s.calendar.dateComponents([.day], from: now, to: lastDay).day ?? -1
        #expect(days == (slice.count - 12) / 20, "the last concept lands \((slice.count - 12) / 20) days out")
        // Items keep everything else.
        #expect(staggered.map { $0.id } == slice.map { $0.id })
        #expect(FoundationSeeder.staggered(slice, batch: 0, now: now).map { $0.nextReviewAt } == slice.map { $0.nextReviewAt })
    }

    @Test func declaredBeginnerIsSeededBaseConceptsOnlyWithABatchDueOnDayOne() {
        let s = contentStore()
        var engine = PlacementEngine(bank: [])
        engine.declareBeginner()
        s.applyPlacement(engine.result(), isFirstRun: true, now: now)

        let seededConcepts = Set(s.gaps.compactMap { $0.conceptId })
        #expect(seededConcepts == ConceptTaxonomy.baseConceptIds, "base concepts only — no A2 bridge on day one")
        #expect(s.gaps.count == 12 * ConceptTaxonomy.baseConceptIds.count)
        #expect(s.dueNow(at: now).count == 24, "≈ two concepts' worth is due, not the whole curriculum")
        #expect(s.dueNow(at: now).count <= Tuning.foundationSeedBatch + 12)
        #expect(s.upcoming(at: now).count > 0 && s.upcoming(at: now).count < s.gaps.count)
        #expect(!s.hasBridgeContent)
        #expect(s.foundationSeedTotal == ConceptTaxonomy.baseConceptIds.count)
        #expect(s.foundationSeededMastered == 0)
        // Every seeded gap stays practicable for the selector — the stagger shapes
        // urgency, not eligibility.
        #expect(s.gaps.allSatisfy { $0.isPracticable(at: now) })
        #expect(s.selectionRequest(for: .mixed, now: now).mode.isScoped)
    }

    @Test func placementSeedsKeepTheirGapsAndMissedHeadwordsAreNotSeededTwice() {
        let s = contentStore()
        // The missed item shares a headword with a Foundation item of a base concept.
        var missed = EngineFixtures.gap("missed", concept: "everyday-vocab", category: .vocabulary)
        missed.frenchWord = "Everyday-Vocab-W3 "
        let result = PlacementResult(vocabBand: 1, grammarBand: 0, estimatedLevel: .A1, isTrueBeginner: false,
                                     masteredConceptIds: ["family-vocab"], missedGaps: [missed],
                                     askedCount: 6, correctCount: 4, missedConceptIds: ["everyday-vocab"],
                                     inferredConceptIds: ["colors-vocab"])
        s.applyPlacement(result, isFirstRun: true, now: now)
        #expect(s.concept("family-vocab")!.isProvisional)
        #expect(s.gaps.first?.id == "missed", "the missed item leads")
        #expect(s.gaps.filter { $0.conceptId == "family-vocab" && $0.sourceType == .foundation }.count == 12,
                "a provisional seed keeps its Foundation gaps — the check-in vehicles (B7)")
        #expect(!s.gaps.contains { $0.frenchWord == "everyday-vocab-w3" }, "the headword the placement captured is not seeded again")
        #expect(s.gaps.filter { $0.conceptId == "everyday-vocab" }.count == 12, "the rest of the concept is still taught")
        #expect(Set(s.gaps.compactMap { $0.conceptId }) == ConceptTaxonomy.baseConceptIds)
    }

    // MARK: D4 — the bridge slice once reading is open

    @Test func bridgeIsSeededOnceWhenReadingOpensAndNeverWhileLocked() {
        let s = contentStore()
        var engine = PlacementEngine(bank: [])
        engine.declareBeginner()
        s.applyPlacement(engine.result(), isFirstRun: true, now: now)
        let baseCount = s.gaps.count
        #expect(s.seedBridgeContentIfNeeded(now: now) == 0, "reading locked → nothing seeded")
        #expect(s.gaps.count == baseCount)

        s.unlockedModalities.insert(LearningModality.reading.rawValue)
        let later = now.addingTimeInterval(20 * day)
        let added = s.seedBridgeContentIfNeeded(now: later)
        #expect(added == 12 * FoundationSeeder.bridgeConceptIds.count)
        #expect(s.hasBridgeContent)
        #expect(Set(s.gaps.compactMap { $0.conceptId }) == ConceptTaxonomy.baseConceptIds.union(FoundationSeeder.bridgeConceptIds))
        let bridgeGaps = s.gaps.filter { FoundationSeeder.bridgeConceptIds.contains($0.conceptId ?? "") }
        #expect(bridgeGaps.filter { $0.nextReviewAt <= later }.count == 24, "the bridge is staggered from the unlock, like the first slice")
        #expect(s.seedBridgeContentIfNeeded(now: later) == 0, "idempotent")
        #expect(s.gaps.count == baseCount + added)
    }

    @Test func straightToReadingRetakeNeverEndsWithZeroGaps() {
        let s = contentStore()
        s.hasCompletedAssessment = true
        s.unlockedModalities.insert(LearningModality.reading.rawValue)
        #expect(s.gaps.isEmpty)
        let result = PlacementResult(vocabBand: 3, grammarBand: 3, estimatedLevel: .B1, isTrueBeginner: false,
                                     masteredConceptIds: [], missedGaps: [], askedCount: 8, correctCount: 8)
        #expect(!s.willEnterFoundation(after: result))
        s.applyPlacement(result, isFirstRun: false, now: now)
        #expect(!s.gaps.isEmpty, "the bridge slice was seeded (D4)")
        #expect(s.hasBridgeContent)
        #expect(!s.gaps.contains { ConceptTaxonomy.baseConceptIds.contains($0.conceptId ?? "") }, "no base slice for an unlocked learner")
        #expect(!s.candidateGapIds(for: .mixed, now: now).isEmpty, "Deck entry points have candidates")
    }

    /// D8 — the assessment screens promise a retake "never lowers what you've
    /// earned": ability and the displayed level are only ever raised by one.
    @Test func retakeOnlyEverRaisesAbilityAndLevel() {
        let s = EngineFixtures.store()
        let strong = PlacementResult(vocabBand: 3, grammarBand: 3, estimatedLevel: .B1, isTrueBeginner: false,
                                     masteredConceptIds: [], missedGaps: [], askedCount: 8, correctCount: 8)
        s.applyPlacement(strong, isFirstRun: true, now: now)
        #expect(s.assessedLevel == .B1)
        #expect(s.abilityTheta > 0)

        // Practice grows ability past the placement estimate…
        s.abilityTheta += 0.5
        let earned = s.abilityTheta

        // …and a bad-day retake that places A1 takes none of it away.
        let weak = PlacementResult(vocabBand: 0, grammarBand: 0, estimatedLevel: .A1, isTrueBeginner: false,
                                   masteredConceptIds: [], missedGaps: [], askedCount: 8, correctCount: 2)
        s.applyPlacement(weak, isFirstRun: false, now: now.addingTimeInterval(day))
        #expect(s.abilityTheta == earned, "practice-grown ability survives a weaker retake")
        #expect(s.assessedLevel == .B1, "the displayed level is never demoted by a retake")

        // A stronger retake still raises both.
        let stronger = PlacementResult(vocabBand: 4, grammarBand: 4, estimatedLevel: .B2, isTrueBeginner: false,
                                       masteredConceptIds: [], missedGaps: [], askedCount: 8, correctCount: 8)
        s.applyPlacement(stronger, isFirstRun: false, now: now.addingTimeInterval(2 * day))
        #expect(s.assessedLevel == .B2)
        #expect(s.abilityTheta > earned)
    }

    /// A first run is still authoritative in both directions — it is the only
    /// estimate there is.
    @Test func firstPlacementSetsTheLevelItMeasured() {
        let s = EngineFixtures.store()
        s.abilityTheta = 2.0
        let weak = PlacementResult(vocabBand: 0, grammarBand: 0, estimatedLevel: .A1, isTrueBeginner: true,
                                   masteredConceptIds: [], missedGaps: [], askedCount: 0, correctCount: 0)
        s.applyPlacement(weak, isFirstRun: true, now: now)
        #expect(s.assessedLevel == .A1 && s.abilityTheta < 0)
    }

    // MARK: D13 — due now / coming up

    @Test func dueNowAndUpcomingAreDisjointAndExcludeProbes() {
        let s = EngineFixtures.store()
        var probe = EngineFixtures.gap("probe", concept: "negation", due: now.addingTimeInterval(-day))
        probe.isProbe = true
        var masteredDue = EngineFixtures.gap("mastered-due", concept: "negation", due: now.addingTimeInterval(-day),
                                             consecutiveCorrect: 5, reviewCount: 5, mastered: now.addingTimeInterval(-10 * day))
        masteredDue.fsrs = EngineFixtures.freshFsrs(at: now.addingTimeInterval(-day))
        var masteredSoon = EngineFixtures.gap("mastered-soon", concept: "negation", due: now.addingTimeInterval(2 * day),
                                              consecutiveCorrect: 5, reviewCount: 5, mastered: now.addingTimeInterval(-10 * day))
        masteredSoon.fsrs = EngineFixtures.freshFsrs(at: now.addingTimeInterval(2 * day))
        masteredSoon.fsrs?.stability = 365   // recall stays high: not due for a check yet
        s.gaps = [
            EngineFixtures.gap("overdue", concept: "negation", due: now.addingTimeInterval(-3 * day)),
            EngineFixtures.gap("today", concept: "negation", due: now),
            EngineFixtures.gap("soon", concept: "negation", due: now.addingTimeInterval(2 * day)),
            EngineFixtures.gap("edge", concept: "negation", due: now.addingTimeInterval(Tuning.upcomingWindowDays * day)),
            EngineFixtures.gap("later", concept: "negation", due: now.addingTimeInterval(5 * day)),
            probe, masteredDue, masteredSoon,
        ]
        let due = Set(s.dueNow(at: now).map { $0.id })
        let up = Set(s.upcoming(at: now).map { $0.id })
        #expect(due == ["overdue", "today", "mastered-due"])
        #expect(up == ["soon", "edge", "mastered-soon"])
        #expect(due.isDisjoint(with: up))
        #expect(!due.contains("probe") && !up.contains("probe") && !up.contains("later"))
        // The two numbers agree with the older schedule views they replace.
        #expect(due.count == s.dueGaps(at: now).count + s.criticalGaps(at: now).count + s.dueMasteredGaps(at: now).count)
        // What a category card counts is what its tap practises: the `.dueInCategory`
        // scope pools exactly the category's "Due now" gaps, mastered checks included.
        #expect(Set(s.candidateGapIds(for: .dueInCategory(.grammar), now: now)) == due)
        #expect(s.candidateGapIds(for: .dueInCategory(.grammar), now: now).contains("mastered-due"))
        #expect(s.candidateGapIds(for: .dueInCategory(.vocabulary), now: now).isEmpty)
    }

    // MARK: B4 — the New retention scope

    @Test func newRetentionScopeListsNeverReviewedGapsInDueOrder() {
        let s = EngineFixtures.store()
        s.gaps = [
            EngineFixtures.gap("second", concept: "negation", due: now.addingTimeInterval(day)),
            EngineFixtures.gap("reviewed", concept: "negation", due: now, reviewCount: 2, lastReviewed: now.addingTimeInterval(-day)),
            EngineFixtures.gap("first", concept: "negation", due: now),
        ]
        var probe = EngineFixtures.gap("probe", concept: "negation", due: now)
        probe.isProbe = true
        s.gaps.append(probe)
        #expect(RetentionBucket.allCases.contains(.new) && RetentionBucket.new.label == "New")
        #expect(s.retention(at: now).new.map { $0.id }.sorted() == ["first", "second"])
        #expect(s.candidateGapIds(for: .retention(.new), now: now) == ["first", "second"])
        #expect(s.selectionRequest(for: .retention(.new), now: now).scopeName == "New")
    }

    // MARK: firstrun-2-1 — a missed probe never becomes a cloze-stem card

    @Test func aMissedContentProbeSeedsARealHeadwordNeverTheClozeStem() throws {
        let store = EngineFixtures.store()
        let concept = try #require(store.concepts.first { $0.id == "definite-articles" })
        // The shape the shipped content really has: the prompt is a stem and the
        // answer is the token that fills it.
        let probe = FoundationProbeContent(fr: "___ gare", en: "la", ex: "La gare est fermée.",
                                           exEn: "The station is closed.", options: ["le", "les", "un"])
        let asked = try #require(AssessmentService.questions(fromProbes: [probe], for: concept).first)
        #expect(asked.isProbe, "a content probe is marked as one")
        #expect(asked.french == "___ gare" && asked.english == "la")

        let item = FoundationItemContent(fr: "la gare", en: "the station", note: "feminine noun",
                                         ex: "Je vais à la gare.", exEn: "I am going to the station.",
                                         blank: "la gare")
        let seeded = AssessmentService.gaps(forMissed: [asked], now: now,
                                            items: { $0 == concept.id ? [item] : [] })
        #expect(seeded.count == Tuning.placementMissSeedItems)
        let gap = try #require(seeded.first)
        #expect(gap.frenchWord == "la gare" && gap.englishTranslation == "the station",
                "a card is a headword and its meaning, never the stem and its missing token")
        #expect(!gap.frenchWord.contains("___"))
        #expect(gap.conceptId == concept.id && gap.difficulty == .hard)
        #expect(gap.nextReviewAt == now && gap.fsrs?.dueAt == now, "a missed item is due from day one")
        #expect(gap.blankForm == "la gare" && gap.isTestable)
        #expect(gap.id == "foundation-\(concept.id)-0", "the id the Foundation slice would give the same item")

        // No content for the concept → nothing is seeded; a stem card is never the
        // fallback. The concept is still in `missedConceptIds`, so Foundation teaches it.
        #expect(AssessmentService.gaps(forMissed: [asked], now: now, items: { _ in [] }).isEmpty)
        // Two missed probes on one concept seed it once, not twice.
        #expect(AssessmentService.gaps(forMissed: [asked, asked], now: now,
                                       items: { $0 == concept.id ? [item] : [] }).count == Tuning.placementMissSeedItems)

        // A hand-bank item IS a headword pair and is still seeded as itself.
        let hand = question(1, .vocabulary, "everyday-vocab", 0)
        #expect(!hand.isProbe)
        let handGaps = AssessmentService.gaps(forMissed: [hand], now: now, items: { _ in [] })
        #expect(handGaps.count == 1 && handGaps[0].frenchWord == "everyday-vocab-fr0")
    }

    @Test func firstRunFromTheShippedBankSeedsOnlyRealHeadwords() throws {
        guard let url = shippedContentURL() else {
            print("[PlacementFlowTests] FoundationContent.json not reachable from this host — skipping the shipped-seed check")
            return
        }
        let file = try FoundationContentLoader.load(from: url)
        let s = EngineFixtures.store()
        s.foundationContent = { when in FoundationContentLoader.gaps(from: file, now: when) }
        let bank = AssessmentService.placementBank(concepts: s.concepts,
                                                   probes: { FoundationContentLoader.probes(for: $0, in: file) })
        // A beginner who only holds the easiest material: they miss real probes.
        var engine = PlacementEngine(bank: bank, seed: 7)
        _ = run(&engine) { $0.band <= 1 }
        #expect(engine.missed.contains { $0.isProbe }, "the staircase did miss at least one probe")
        let result = engine.result(items: { FoundationContentLoader.items(for: $0, in: file) })
        s.applyPlacement(result, isFirstRun: true, now: now)

        let headwords = Set(file.skills.flatMap { $0.items.map { $0.fr } })
        for gap in s.gaps {
            #expect(!gap.frenchWord.contains("___"), "\(gap.frenchWord): a cloze stem reached the deck")
            #expect(!gap.englishTranslation.contains("___"))
            if gap.id.hasPrefix("foundation-") {
                #expect(headwords.contains(gap.frenchWord), "\(gap.frenchWord) is not a content headword")
            }
        }
        #expect(Set(s.gaps.map { $0.id }).count == s.gaps.count, "no item is seeded twice")
        #expect(Set(s.gaps.map { FoundationSeeder.headwordKey($0.frenchWord) }).count == s.gaps.count)
    }

    // MARK: D11 — weekly goal

    @Test func weeklyGoalCountsDaysWithACompletedLessonThisWeek() {
        let s = EngineFixtures.store()
        #expect(s.weeklyGoalProgress(now: now) == nil, "no goal → nothing to render")
        s.setPreferences(UserPreferences(modalities: [.reading], timeBudget: .standard, daysPerWeekGoal: 5))
        #expect(s.weeklyGoalProgress(now: now)! == (done: 0, goal: 5))
        let week = s.calendar.dateInterval(of: .weekOfYear, for: now)!
        let dayOne = week.start.addingTimeInterval(6 * 3600)
        let dayTwo = s.calendar.date(byAdding: .day, value: 1, to: dayOne)!
        let lastWeek = s.calendar.date(byAdding: .day, value: -1, to: week.start)!
        for when in [dayOne, dayOne, dayTwo, lastWeek] {
            s.completeLesson(targetConceptId: nil, isCapstone: false, now: when)
        }
        let progress = s.weeklyGoalProgress(now: now)!
        #expect(progress.done == 2 && progress.goal == 5, "two days this week; two lessons on one day are one day; last week does not count")
        #expect(Tuning.weeklyGoalChoices.contains(5))
    }

    // MARK: D10 — Foundation progress counts seeded concepts

    @Test func foundationProgressCountsSeededBaseConceptsWithVerifiedMastery() {
        let s = EngineFixtures.store()
        #expect(s.foundationSeedTotal == ConceptTaxonomy.baseConceptIds.count, "nothing seeded yet → every base concept")
        s.gaps = EngineFixtures.foundationGaps(for: s.concepts.filter { ["negation", "questions", "imparfait"].contains($0.id) }, perConcept: 2)
        #expect(s.foundationSeedConceptIds == ["negation", "questions"], "only seeded BASE concepts, in taxonomy order")
        #expect(s.foundationSeedTotal == 2 && s.foundationSeededMastered == 0)
        let idx = s.concepts.firstIndex { $0.id == "negation" }!
        s.concepts[idx] = EngineFixtures.mastered("negation", level: .A1)
        #expect(s.foundationSeededMastered == 1)
        s.concepts[idx].isProvisional = true
        #expect(s.foundationSeededMastered == 0, "a provisional seed is not progress")
        #expect(s.foundationSeededMastered <= s.foundationMastered || s.foundationMastered == 0)
    }
}
