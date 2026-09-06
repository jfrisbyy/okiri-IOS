//
//  Pass3EngineTests.swift
//  FluentFrenchIOSTests
//
//  Package B part 2 — the Pass 3 engine amendments at the unit level:
//  B5 decayed evidence + raw observations, B6 doubled check-in misses, B7 the
//  adaptive check-in schedule, B8 the retention governor, B9 placement probes and
//  provisional seeds, B10 lesson-paced Foundation days, B11 the release-streak
//  hint, B12 eligibility needs something to teach, B13 content probes, B14 engine
//  metrics, B15 stall remediation, and the content-v2 loader.
//

import Foundation
import Testing
@testable import FluentFrenchIOS

@MainActor
struct Pass3EngineTests {
    private let now = EngineFixtures.now
    private let day = EngineFixtures.day

    private func decayed(_ x: Double) -> Double { 1 + (x - 1) * Tuning.evidenceRecency }

    // MARK: B5 — threshold, raw observations, decay

    @Test func conceptStateUsesTheThresholdAndRawObservations() {
        var c = EngineFixtures.concept("c", alpha: 4, beta: 1)   // mastery 0.8, observations 3
        #expect(c.state == .learning, "under the observation floor")
        c.observationCount = Tuning.minObservations
        #expect(c.state == .mastered)
        c.alpha = 3   // exactly the threshold
        #expect(c.mastery == Tuning.masteryThreshold && c.state == .mastered)
        c.alpha = 2.9
        #expect(c.state == .learning)
        c.observationCount = 0
        c.alpha = 40
        #expect(c.state == .neverObserved, "no raw observations → untested, whatever alpha says")
        c.observationCount = 0.5
        #expect(c.state == .learning, "any evidence at all counts as observed")
    }

    @Test func conceptDecodeMigratesObservationCountAndDefaultsNewFields() throws {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let legacy = """
        {"id":"x","name":"X","category":"grammar","cefrLevel":"A1","prerequisites":[],"description":"d",
         "alpha":9,"beta":1,"lastTestedAt":null,"lastTaughtSession":null,"newlyUnlocked":false}
        """
        let migrated = try decoder.decode(Concept.self, from: Data(legacy.utf8))
        #expect(migrated.observationCount == 8, "max(0, alpha + beta − 2)")
        #expect(migrated.state == .mastered)
        #expect(!migrated.isProvisional && migrated.nextCheckInAt == nil && migrated.checkInIntervalDays == nil)
        #expect(migrated.stallAttempts == 0 && migrated.lastTaughtState == nil)

        var full = EngineFixtures.mastered("y")
        full.observationCount = 2
        full.isProvisional = true
        full.nextCheckInAt = now
        full.checkInIntervalDays = 3
        full.stallAttempts = 2
        full.lastTaughtState = .learning
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let round = try decoder.decode(Concept.self, from: encoder.encode(full))
        #expect(round == full)
        #expect(round.observationCount == 2, "an explicit count is authoritative, never re-derived")
    }

    @Test func evidenceDecaysBeforeEachObservationAndMasteryIsScheduledForACheckIn() {
        let s = EngineFixtures.store(concepts: [EngineFixtures.concept("c")], gaps: [])
        var expectedAlpha = 1.0
        for i in 1...Int(Tuning.minObservations) {
            s.recordConceptAnswer(conceptId: "c", correct: true, now: now.addingTimeInterval(Double(i)))
            expectedAlpha = decayed(expectedAlpha) + 1
            let c = s.concept("c")!
            #expect(abs(c.alpha - expectedAlpha) < 1e-9)
            #expect(c.beta == 1)
            #expect(c.observationCount == Double(i), "raw observations never decay")
        }
        let mastered = s.concept("c")!
        #expect(mastered.state == .mastered)
        #expect(mastered.checkInIntervalDays == Tuning.checkInInitialDays)
        #expect(mastered.nextCheckInAt == now.addingTimeInterval(Tuning.minObservations).addingTimeInterval(Tuning.checkInInitialDays * day),
                "newly mastered → first check-in a week out")
        #expect(!mastered.isProvisional)

        // Old evidence fades: a long run of misses after a long run of hits reads as not-known.
        for _ in 0..<6 { s.recordConceptAnswer(conceptId: "c", correct: false, now: now) }
        #expect(s.concept("c")!.state == .learning)
        #expect(s.concept("c")!.nextCheckInAt == nil, "losing mastery clears the check-in schedule")
        let snapshot = s.concept("c")!
        s.recordConceptAnswer(conceptId: "c", correct: true, weight: 0, now: now)
        #expect(s.concept("c")! == snapshot, "zero weight is a no-op")
        #expect(s.concept("c")!.observationCount == Tuning.minObservations + 6)
    }

    // MARK: B6 — a check-in miss weighs double

    @Test func checkInMissWeighsDoubleButCountsOnce() {
        let s = EngineFixtures.store(concepts: [EngineFixtures.mastered("m")], gaps: [])
        let before = s.concept("m")!
        s.recordConceptAnswer(conceptId: "m", correct: false, weight: 1.2, isCheckIn: true, now: now)
        let after = s.concept("m")!
        #expect(abs(after.beta - (decayed(before.beta) + 1.2 * Tuning.checkInMissWeight)) < 1e-9)
        #expect(abs(after.alpha - decayed(before.alpha)) < 1e-9)
        #expect(after.observationCount == before.observationCount + 1.2, "the raw count takes the undoubled weight")

        // A check-in PASS is plain evidence.
        let t = EngineFixtures.store(concepts: [EngineFixtures.mastered("m")], gaps: [])
        t.recordConceptAnswer(conceptId: "m", correct: true, weight: 1, isCheckIn: true, now: now)
        #expect(abs(t.concept("m")!.alpha - (decayed(before.alpha) + 1)) < 1e-9)
    }

    @Test func recordReviewDerivesTheCheckInFromTheConceptWhenNoRoleIsPassed() {
        let s = EngineFixtures.store(concepts: [EngineFixtures.mastered("m"), EngineFixtures.learning("l", mastery: 0.5)],
                                     gaps: [EngineFixtures.gap("m-0", concept: "m"), EngineFixtures.gap("l-0", concept: "l")])
        s.recordReview(gapId: "l-0", correct: false, now: now)
        #expect(s.checkInHistory.isEmpty, "a learning concept is never a check-in")
        let before = s.concept("m")!
        s.recordReview(gapId: "m-0", correct: false, now: now)
        #expect(s.checkInHistory == [false], "an answer on a mastered concept is a check-in by definition")
        #expect(abs(s.concept("m")!.beta - (decayed(before.beta) + Tuning.checkInMissWeight)) < 1e-9)
        // An explicit role wins over the derivation.
        let t = EngineFixtures.store(concepts: [EngineFixtures.mastered("m")], gaps: [EngineFixtures.gap("m-0", concept: "m")])
        t.recordReview(gapId: "m-0", correct: false, isCheckIn: false, now: now)
        #expect(t.checkInHistory.isEmpty)
        #expect(abs(t.concept("m")!.beta - (decayed(before.beta) + 1)) < 1e-9)
    }

    // MARK: B7 — the adaptive check-in interval

    @Test func provisionalSeedIsVerifiedOnlyByConsecutivePasses() {
        var seed = EngineFixtures.mastered("m")
        seed.isProvisional = true
        seed.nextCheckInAt = now
        let s = EngineFixtures.store(concepts: [seed], gaps: [])
        func c() -> Concept { s.concept("m")! }

        // Passes short of the bar keep it provisional, re-checked every `seedVerificationDays`.
        for pass in 1..<Tuning.seedVerificationPasses {
            s.recordCheckIn(conceptId: "m", passed: true, now: now)
            #expect(c().isProvisional && c().provisionalPasses == pass)
            #expect(c().checkInIntervalDays == Tuning.seedVerificationDays)
            #expect(c().nextCheckInAt == now.addingTimeInterval(Tuning.seedVerificationDays * day))
        }
        // A miss resets the count (the concept here stays mastered: recordCheckIn
        // moves the schedule only; the doubled evidence lands in recordReview).
        s.recordCheckIn(conceptId: "m", passed: false, now: now)
        #expect(c().isProvisional && c().provisionalPasses == 0)
        #expect(c().checkInIntervalDays == Tuning.seedVerificationDays)
        for _ in 0..<Tuning.seedVerificationPasses {
            s.recordCheckIn(conceptId: "m", passed: true, now: now)
        }
        #expect(!c().isProvisional && c().provisionalPasses == 0, "verified after \(Tuning.seedVerificationPasses) passes in a row")
        #expect(c().checkInIntervalDays == Tuning.checkInInitialDays, "…and on the normal ladder from its start")
        #expect(c().nextCheckInAt == now.addingTimeInterval(Tuning.checkInInitialDays * day))
        s.recordCheckIn(conceptId: "m", passed: true, now: now)
        #expect(c().checkInIntervalDays == Tuning.checkInInitialDays * Tuning.checkInGrowth)
        #expect(s.checkInHistory.count == 2 * Tuning.seedVerificationPasses + 1)
    }

    @Test func checkInIntervalGrowsOnPassShrinksOnMissAndIsBounded() {
        let s = EngineFixtures.store(concepts: [EngineFixtures.mastered("m")], gaps: [])
        func c() -> Concept { s.concept("m")! }

        s.recordCheckIn(conceptId: "m", passed: true, now: now)
        #expect(c().checkInIntervalDays == Tuning.checkInInitialDays, "first pass from no interval → the initial interval")
        #expect(c().nextCheckInAt == now.addingTimeInterval(Tuning.checkInInitialDays * day))
        #expect(!c().isProvisional)

        var expected = Tuning.checkInInitialDays
        for i in 1...12 {
            let at = now.addingTimeInterval(Double(i) * day)
            s.recordCheckIn(conceptId: "m", passed: true, now: at)
            expected = min(Tuning.checkInMaxDays, expected * Tuning.checkInGrowth)
            #expect(abs((c().checkInIntervalDays ?? 0) - expected) < 1e-9)
            #expect(c().nextCheckInAt == at.addingTimeInterval(expected * day))
        }
        #expect(c().checkInIntervalDays == Tuning.checkInMaxDays, "capped")

        for _ in 0..<10 {
            s.recordCheckIn(conceptId: "m", passed: false, now: now)
            expected = max(Tuning.checkInMinDays, expected / Tuning.checkInMissDivisor)
            #expect(abs((c().checkInIntervalDays ?? 0) - expected) < 1e-9)
        }
        #expect(c().checkInIntervalDays == Tuning.checkInMinDays, "floored")

        // The window keeps only the last `governorWindow` outcomes.
        #expect(s.checkInHistory.count == Tuning.governorWindow)
        #expect(s.checkInHistory.suffix(10).allSatisfy { !$0 })
        #expect(s.checkInHistory.prefix(Tuning.governorWindow - 10).allSatisfy { $0 })

        // A miss from no interval halves the initial one.
        let t = EngineFixtures.store(concepts: [EngineFixtures.mastered("m")], gaps: [])
        t.recordCheckIn(conceptId: "m", passed: false, now: now)
        #expect(t.concept("m")!.checkInIntervalDays == Tuning.checkInInitialDays / Tuning.checkInMissDivisor)
    }

    @Test func checkInsAreCappedPerLessonAndRankedMostOverdueFirst() {
        var a = EngineFixtures.mastered("a"), b = EngineFixtures.mastered("b"), c = EngineFixtures.mastered("c")
        a.nextCheckInAt = now.addingTimeInterval(-5 * day)
        b.nextCheckInAt = now.addingTimeInterval(-1 * day)
        c.nextCheckInAt = nil   // never scheduled: due, but 0 days overdue
        var d = EngineFixtures.mastered("d")
        d.nextCheckInAt = now.addingTimeInterval(20 * day)   // not due; its gap's recall is high
        let ids: [String] = ["a", "b", "c"]
        var gaps = ids.map { id in EngineFixtures.gap("\(id)-0", concept: id, reviewCount: 3) }
        // Reviewed, resting on its own schedule, recall 0.95 (fallback): nothing pulls d back.
        gaps.append(EngineFixtures.gap("d-0", concept: "d", due: now.addingTimeInterval(10 * day), consecutiveCorrect: 5, reviewCount: 5))
        // A learning target with due gaps, so the lesson has a spine.
        let t = EngineFixtures.learning("t", mastery: 0.5)
        gaps += (0..<6).map { EngineFixtures.gap("t-\($0)", concept: "t") }
        let s = EngineFixtures.store(concepts: [a, b, c, d, t], gaps: gaps)
        s.sessionIndex = 1
        let selector = ConceptSelector(store: s)
        #expect(selector.checkInCandidates(now: now).map { $0.concept.id } == ["a", "b", "c"])
        #expect(!selector.isCheckInDue(d, now: now))
        let output = selector.select(.smart(now: now))
        #expect(output.targetConceptId == "t")
        #expect(output.checkInItems.map { $0.gapId } == ["a-0", "b-0"], "at most \(Tuning.checkInsPerLesson) beside a spine, most overdue first")
        #expect(!output.gapIds.contains("c-0"))
        #expect(output.items.filter { $0.role == .review }.isEmpty, "mastered material never rides in as review")
        #expect(output.items.count == Tuning.lessonSize)

        // A provisional seed — never verified — outranks every verified concept.
        s.concepts[2].isProvisional = true
        #expect(ConceptSelector(store: s).checkInCandidates(now: now).map { $0.concept.id } == ["c", "a", "b"])
        #expect(ConceptSelector(store: s).select(.smart(now: now)).checkInItems.map { $0.conceptId } == ["c", "a"])

        // With nothing left to teach the lesson is a consolidation session: check-ins
        // fill it up to the requested size.
        s.concepts.removeAll { $0.id == "t" }
        s.gaps.removeAll { $0.conceptId == "t" }
        let consolidation = ConceptSelector(store: s).select(.smart(now: now))
        #expect(consolidation.targetConceptId == nil && consolidation.rankedConcepts.isEmpty)
        #expect(consolidation.checkInItems.map { $0.conceptId } == ["c", "a", "b"])
        #expect(consolidation.items.count == 3, "every due concept, still one item each")
        #expect(consolidation.headline == "Today: check-ins — making sure what you've learned still holds.")
    }

    @Test func recallBelowTheFloorMakesAMasteredConceptDueOnlyThroughReviewedGaps() {
        var m = EngineFixtures.mastered("m")
        m.nextCheckInAt = now.addingTimeInterval(30 * day)
        // A never-answered gap decays on its seed curve; that must NOT count.
        var fresh = EngineFixtures.gap("m-new", concept: "m")
        fresh.fsrs = EngineFixtures.freshFsrs(at: now.addingTimeInterval(-10 * day))
        let s = EngineFixtures.store(concepts: [m], gaps: [fresh])
        let selector = ConceptSelector(store: s)
        #expect(fresh.retrievability(at: now) < Tuning.checkInRetrievability)
        #expect(!selector.isCheckInDue(m, now: now), "unreviewed gaps carry no recall evidence")

        // A reviewed gap that has decayed does.
        var reviewed = EngineFixtures.gap("m-old", concept: "m", reviewCount: 4)
        reviewed.fsrs = FSRS.makeInitialState(grade: .good, now: now.addingTimeInterval(-30 * day))
        s.gaps.append(reviewed)
        #expect(reviewed.retrievability(at: now) < Tuning.checkInRetrievability)
        #expect(selector.isCheckInDue(m, now: now))
        #expect(selector.checkInVehicle(for: m, now: now)?.gapId == "m-old", "the reviewed gap carries the check-in")
    }

    // MARK: B8 — the retention governor

    @Test func governorEngagesOnALowPassRateWithEnoughSamples() {
        let s = EngineFixtures.store()
        #expect(!s.isGovernorActive && s.checkInPassRate == nil)
        s.checkInHistory = [false, false, false, false, false]
        #expect(!s.isGovernorActive, "fewer than \(Tuning.governorMinSamples) samples never engages it")
        s.checkInHistory = [true, true, true, false, false, false]
        #expect(s.checkInPassRate == 0.5 && s.isGovernorActive)
        s.checkInHistory = Array(repeating: true, count: 8) + Array(repeating: false, count: 4)
        #expect(!s.isGovernorActive, "2/3 is above the floor")

        // While active: frontier weight 0, urgency doubled; nothing else moves.
        s.checkInHistory = [false, false, false, false, true, true]
        let selector = ConceptSelector(store: s)
        let w = selector.effectiveWeights
        #expect(w.frontier == 0)
        #expect(w.urgency == ConceptSelectionWeights.tuning.urgency * Tuning.governorUrgencyMultiplier)
        #expect(w.leverage == ConceptSelectionWeights.tuning.leverage && w.repeatDamp == ConceptSelectionWeights.tuning.repeatDamp)
        #expect(selector.select(.smart(now: now)).governorActive)
        s.checkInHistory = []
        #expect(ConceptSelector(store: s).effectiveWeights.frontier == ConceptSelectionWeights.tuning.frontier)
    }

    @Test func governorHoldsTheGateButNeverRelocksAnOpenModality() {
        // Real taxonomy: master enough base concepts that reading unlocks by coverage.
        let s = EngineFixtures.store()
        let base = Array(ConceptTaxonomy.baseConceptIds).sorted()
        let needed = Int((Double(base.count) * ReadinessConfig.tuning.readingUnlock).rounded(.up))
        for cid in base.prefix(needed) {
            let idx = s.concepts.firstIndex { $0.id == cid }!
            s.concepts[idx] = EngineFixtures.mastered(cid, category: s.concepts[idx].category, level: s.concepts[idx].cefrLevel,
                                                      prerequisites: s.concepts[idx].prerequisites)
        }
        #expect(s.readiness(for: .reading) == .unlocked)

        // Governor engages before the unlock was ever recorded → held.
        s.checkInHistory = [false, false, false, false, true, true]
        #expect(s.isGovernorActive)
        #expect(s.readiness(for: .reading) == .foundation, "not yet opened → held in the bridge while consolidating")
        #expect(s.isInFoundation)
        let plan = DailyPlanEngine(store: s).makePlan(now: now)
        #expect(plan.rationale == "Consolidating your base before opening reading.")
        #expect(plan.isLessonPaced)

        // Governor releases, the unlock is recorded at a bookkeeping point, and a
        // later governor cannot take it back.
        s.checkInHistory = []
        s.completeLesson(targetConceptId: nil, isCapstone: false, now: now)
        #expect(s.readiness(for: .reading) == .unlocked)
        #expect(s.unlockedModalities.contains(LearningModality.reading.rawValue))
        s.checkInHistory = [false, false, false, false, true, true]
        #expect(s.isGovernorActive)
        #expect(s.readiness(for: .reading) == .unlocked, "never re-locked")
        #expect(s.readiness(for: .speaking) == .locked, "still gated: it was never open")

        // recordCheckIn records what is open BEFORE the outcome can flip the governor.
        let t = EngineFixtures.store()
        for cid in base.prefix(needed) {
            let idx = t.concepts.firstIndex { $0.id == cid }!
            t.concepts[idx] = EngineFixtures.mastered(cid, category: t.concepts[idx].category, level: t.concepts[idx].cefrLevel,
                                                      prerequisites: t.concepts[idx].prerequisites)
        }
        t.checkInHistory = [false, false, false, false, true]
        #expect(!t.isGovernorActive)
        t.recordCheckIn(conceptId: base[0], passed: false, now: now)
        #expect(t.isGovernorActive)
        #expect(t.readiness(for: .reading) == .unlocked, "it was open when the miss landed")
    }

    // MARK: B9 — placement probes and provisional seeds

    private func question(_ band: Int, _ category: GapCategory, _ concept: String, _ n: Int) -> AssessmentQuestion {
        AssessmentQuestion(band: band, category: category, prompt: "\(concept)-p\(n)", french: "\(concept)-fr\(n)",
                           english: "\(concept)-en\(n)", options: ["\(concept)-en\(n)", "x", "y"], correctAnswer: "\(concept)-en\(n)",
                           explanation: "", exampleSentence: "", exampleTranslation: "", conceptId: concept)
    }

    @Test func placementAsksUpToThreeItemsPerConceptAndNeverSeedsAMissedOne() {
        // A band-1/2 bank with three items per concept, two vocabulary and two grammar concepts.
        var bank: [AssessmentQuestion] = []
        for n in 0..<3 {
            bank.append(question(1, .vocabulary, "everyday-vocab", n))
            bank.append(question(1, .grammar, "definite-articles", n))
            bank.append(question(2, .vocabulary, "family-vocab", n))
            bank.append(question(2, .grammar, "negation", n))
        }
        var engine = PlacementEngine(bank: bank)
        #expect(engine.minItems == Tuning.placementMinItems && engine.maxItems == Tuning.placementMaxItems)
        #expect(engine.probesPerConcept == Tuning.placementProbesPerConcept)
        #expect(engine.currentBand == 2, "the staircase starts at band 2")

        // Knows the first concept: after a correct answer the staircase keeps probing
        // the same concept until three items were asked — and the band moves ONCE,
        // when the concept completes its third probe clean, not on every answer.
        let first = engine.next()!
        engine.record(first, correct: true)
        #expect(engine.currentBand == 2, "one correct answer is not a read: the band holds")
        let second = engine.next()!
        #expect(second.conceptId == first.conceptId)
        engine.record(second, correct: true)
        #expect(engine.currentBand == 2)
        let third = engine.next()!
        #expect(third.conceptId == first.conceptId)
        engine.record(third, correct: true)
        #expect(engine.askedCount(for: first.conceptId!) == Tuning.placementProbesPerConcept)
        #expect(engine.currentBand == 3, "the concept completed its probes clean → one step up")
        #expect(engine.fullyProbedConceptIds == [first.conceptId!])
        let fourth = engine.next()!
        #expect(fourth.conceptId != first.conceptId, "the probe budget is spent")

        // A miss ends probing on that concept, steps the band down once, and
        // excludes the concept from the seeds.
        engine.record(fourth, correct: false)
        #expect(engine.currentBand == 2, "first miss on a concept → one step down")
        var asked: [AssessmentQuestion] = []
        while let q = engine.next() {
            asked.append(q)
            engine.record(q, correct: true)
        }
        #expect(!asked.contains { $0.conceptId == fourth.conceptId }, "a missed concept is not asked again")
        #expect(engine.missedConceptIds == [fourth.conceptId!])
        // Stabilisation counts DISTINCT concepts: the run could only stop once four
        // different concepts had been asked, never on repeats of one.
        #expect(Set(engine.asked.compactMap { $0.conceptId }).count >= 4)

        let result = engine.result()
        #expect(!result.masteredConceptIds.contains(fourth.conceptId!))
        #expect(result.missedConceptIds == [fourth.conceptId!])
        #expect(result.seedsAreProvisional)
        #expect(result.askedCount(for: first.conceptId!) == Tuning.placementProbesPerConcept)
        // Two tiers: only a fully probed concept is seeded as mastered; every other
        // in-band concept is inferred, and the tiers never overlap.
        #expect(result.masteredConceptIds.contains(first.conceptId!))
        #expect(Set(result.masteredConceptIds) == result.fullyProbedConceptIds)
        for cid in result.masteredConceptIds {
            #expect(result.askedCount(for: cid) >= Tuning.placementProbesPerConcept)
        }
        #expect(!result.inferredConceptIds.isEmpty, "band-inferred concepts are reported separately")
        #expect(Set(result.inferredConceptIds).isDisjoint(with: result.masteredConceptIds))
        #expect(!result.inferredConceptIds.contains(fourth.conceptId!))
        for cid in result.inferredConceptIds {
            #expect(result.askedCount(for: cid) < Tuning.placementProbesPerConcept)
        }
        #expect(AssessmentService.masteredConcepts(vocabBand: 2, grammarBand: 2, excluding: ["negation"])
                    .contains("negation") == false)
        #expect(AssessmentService.masteredConcepts(vocabBand: 2, grammarBand: 2).contains("negation"))
    }

    @Test func aBandIsClearedOnlyWithEnoughItemsAndAnItemWithoutAConceptStepsAlone() {
        // One item at band 2 answered correctly, then a full band-1 concept: band 2
        // is too thin to count as cleared, so the vocab read stays at band 1.
        var bank: [AssessmentQuestion] = [question(2, .vocabulary, "family-vocab", 0)]
        for n in 0..<3 { bank.append(question(1, .vocabulary, "everyday-vocab", n)) }
        var engine = PlacementEngine(bank: bank)
        let thin = engine.next()!
        #expect(thin.conceptId == "family-vocab")
        engine.record(thin, correct: true)
        #expect(engine.currentBand == 3, "the bank has no more items for it → the concept completed clean")
        while let q = engine.next() { engine.record(q, correct: true) }
        let result = engine.result()
        #expect(result.vocabBand == 1, "a band with fewer than \(Tuning.placementProbesPerConcept) items never clears")
        #expect(result.masteredConceptIds == ["everyday-vocab"])
        #expect(result.inferredConceptIds.contains("family-vocab"), "one correct answer is only an inference")

        // An item with no concept behind it is its own one-item concept: it steps
        // the band at once, up or down.
        let loose = AssessmentQuestion(band: 2, category: .vocabulary, prompt: "p", french: "f", english: "e",
                                       options: ["e", "x"], correctAnswer: "e", explanation: "", exampleSentence: "",
                                       exampleTranslation: "", conceptId: nil)
        var solo = PlacementEngine(bank: [loose])
        solo.record(loose, correct: false)
        #expect(solo.currentBand == 1)
    }

    @Test func contentProbesBecomePlacementItemsForGrammarAndVocabularyOnly() {
        let s = EngineFixtures.store()
        let bank = AssessmentService.contentBank(concepts: s.concepts, probes: EngineFixtures.syntheticProbes)
        let eligible = s.concepts.filter { $0.category == .grammar || $0.category == .vocabulary }
        #expect(bank.count == eligible.count * 3, "three items per grammar / vocabulary concept, none for the rest")
        #expect(!bank.contains { $0.conceptId == "liaison" })
        let item = bank.first { $0.conceptId == "definite-articles" }!
        #expect(item.band == AssessmentService.bandForLevel(s.concept("definite-articles")!.cefrLevel))
        #expect(item.category == .grammar)
        #expect(item.options.count == 4 && item.options.contains(item.correctAnswer))
        #expect(item.correctAnswer == EngineFixtures.syntheticProbes(for: "definite-articles")[0].en)
        #expect(item.prompt.hasPrefix("What does"))
        let blank = AssessmentService.questions(fromProbes: [FoundationProbeContent(fr: "___ x", en: "a", options: ["b"])],
                                                for: s.concept("definite-articles")!)
        #expect(blank.first?.prompt.hasPrefix("Fill in the blank") == true)
        #expect(AssessmentService.questions(fromProbes: [FoundationProbeContent(fr: "", en: "a", options: ["b"])],
                                            for: s.concept("definite-articles")!).isEmpty)

        // With the content bank every concept can reach the three-probe read.
        var engine = PlacementEngine(bank: AssessmentService.bank + bank)
        while let q = engine.next() { engine.record(q, correct: true) }
        let result = engine.result()
        #expect(!result.masteredConceptIds.isEmpty)
        #expect(Set(result.masteredConceptIds) == result.fullyProbedConceptIds.filter { ConceptTaxonomy.baseConceptIds.contains($0) },
                "only BASE concepts are seeded; a fully probed higher concept is evidence, not a seed")
    }

    @Test func placementSeedsBlendAreProvisionalAndKeepTheirGaps() {
        let s = EngineFixtures.store()
        // One concept already carries counter-evidence; it must not be hard-set.
        let shaky = s.concepts.firstIndex { $0.id == "negation" }!
        s.concepts[shaky].beta = 3
        s.concepts[shaky].observationCount = 2
        // One concept's mastery was EARNED through practice and sits on the normal
        // check-in ladder; a placement must not demote it to a provisional seed.
        let earnedIdx = s.concepts.firstIndex { $0.id == "present-er-verbs" }!
        var earned = EngineFixtures.mastered("present-er-verbs", level: .A1)
        earned.checkInIntervalDays = Tuning.checkInInitialDays * Tuning.checkInGrowth
        earned.nextCheckInAt = now.addingTimeInterval(10 * day)
        s.concepts[earnedIdx] = earned
        let result = PlacementResult(vocabBand: 1, grammarBand: 1, estimatedLevel: .A1, isTrueBeginner: false,
                                     masteredConceptIds: ["everyday-vocab", "negation", "definite-articles", "present-er-verbs"],
                                     missedGaps: [], askedCount: 6, correctCount: 5,
                                     missedConceptIds: ["definite-articles"],
                                     inferredConceptIds: ["possessive-adjectives", "definite-articles"])
        s.applyPlacement(result, isFirstRun: true, now: now)

        let seeded = s.concept("everyday-vocab")!
        #expect(seeded.alpha == 1 + Tuning.placementSeedAlpha && seeded.beta == 1)
        #expect(seeded.observationCount == Tuning.placementSeedAlpha)
        #expect(seeded.state == .mastered && seeded.isProvisional)
        #expect(seeded.nextCheckInAt == now.addingTimeInterval(Tuning.seedVerificationDays * day))
        #expect(seeded.checkInIntervalDays == nil)

        let blended = s.concept("negation")!
        #expect(blended.alpha == 1 + Tuning.placementSeedAlpha && blended.beta == 3, "beta is never lowered")
        #expect(blended.state == .learning && !blended.isProvisional, "the blend did not reach mastered, so it is not a provisional mastery")

        let kept = s.concept("present-er-verbs")!
        #expect(kept.alpha == Tuning.placementSeedAlphaCap && kept.observationCount == earned.observationCount,
                "already at the cap: no alpha gained, so no observations invented")
        #expect(kept.state == .mastered && !kept.isProvisional, "earned mastery is never demoted to a provisional seed")
        #expect(kept.nextCheckInAt == earned.nextCheckInAt && kept.checkInIntervalDays == earned.checkInIntervalDays,
                "its check-in ladder is untouched")

        // The inferred tier: a learning head start, never mastery (B9).
        let inferred = s.concept("possessive-adjectives")!
        #expect(inferred.alpha == 1 + Tuning.placementInferredAlpha && inferred.beta == 1)
        #expect(inferred.observationCount == Tuning.placementInferredAlpha)
        #expect(inferred.state == .learning && !inferred.isProvisional, "a band-inferred concept is not mastered after placement")
        #expect(inferred.observationCount < Tuning.minObservations)

        #expect(s.concept("definite-articles")!.state == .neverObserved, "a concept with a missed item is seeded in neither tier")
        #expect(s.journeyStartedAt == now)
        #expect(s.isInFoundation)
        #expect(s.unlockedModalities.isEmpty, "placement records no unlock: seeds are provisional")
        #expect(s.gaps.contains { $0.conceptId == "everyday-vocab" }, "seeded concepts keep their Foundation gaps for check-ins and re-teaching")

        // Retake: blends up to the cap, never resets, and never stacks an inference.
        s.applyPlacement(result, isFirstRun: false, now: now.addingTimeInterval(day))
        #expect(s.concept("everyday-vocab")!.alpha == Tuning.placementSeedAlphaCap)
        #expect(s.concept("everyday-vocab")!.observationCount == Tuning.placementSeedAlphaCap - 1,
                "observations grow by the alpha actually gained")
        s.applyPlacement(result, isFirstRun: false, now: now.addingTimeInterval(2 * day))
        #expect(s.concept("everyday-vocab")!.alpha == Tuning.placementSeedAlphaCap, "capped")
        #expect(s.concept("everyday-vocab")!.observationCount == Tuning.placementSeedAlphaCap - 1, "no observations added at the cap")
        #expect(s.concept("negation")!.beta == 3)
        #expect(s.concept("possessive-adjectives")!.observationCount == Tuning.placementInferredAlpha,
                "an inferred seed is taken once, by a never-observed concept only")
        #expect(s.concept("possessive-adjectives")!.state == .learning)
        #expect(s.concept("present-er-verbs")!.nextCheckInAt == earned.nextCheckInAt)

        // The verification check-in rides on one of those gaps. The seed was
        // already (provisionally) mastered when the retakes landed, so its ladder
        // stayed as the first placement set it: `seedVerificationDays` from then.
        s.sessionIndex = 1
        let selector = ConceptSelector(store: s)
        #expect(s.concept("everyday-vocab")!.isProvisional)
        #expect(s.concept("everyday-vocab")!.nextCheckInAt == now.addingTimeInterval(Tuning.seedVerificationDays * day))
        let at = now.addingTimeInterval(Tuning.seedVerificationDays * day + 60)
        #expect(!selector.isCheckInDue(s.concept("everyday-vocab")!, now: at.addingTimeInterval(-120)))
        #expect(selector.isCheckInDue(s.concept("everyday-vocab")!, now: at))
        let output = selector.select(.smart(now: at))
        let verify = output.checkInItems.first { $0.conceptId == "everyday-vocab" }
        #expect(verify != nil)
        #expect(verify?.reason == "Verifying what placement said you know: Everyday vocabulary.")
        #expect(output.rankedConcepts.contains { $0.concept.id == "possessive-adjectives" },
                "the inferred concept is eligible as a learning target")
    }

    // MARK: B8 — coverage counts verified mastery only; the gate has hysteresis

    @Test func coverageIgnoresProvisionalSeedsAndPlacementRecordsNoUnlock() {
        let s = EngineFixtures.store()
        let base = Array(ConceptTaxonomy.baseConceptIds).sorted()
        let result = PlacementResult(vocabBand: 2, grammarBand: 2, estimatedLevel: .A2, isTrueBeginner: false,
                                     masteredConceptIds: base, missedGaps: [], askedCount: 12, correctCount: 12)
        #expect(s.willEnterFoundation(after: result), "seed-only results predict Foundation")
        s.applyPlacement(result, isFirstRun: true, now: now)
        #expect(s.concepts.filter { $0.isProvisional }.count == base.count)
        #expect(s.baseCoverage == 0 && s.foundationMastered == 0)
        #expect(s.readiness(for: .reading) == .locked && s.isInFoundation)
        #expect(s.unlockedModalities.isEmpty, "no bookkeeping point has recorded an unlock")
        s.refreshUnlocks()
        #expect(s.unlockedModalities.isEmpty, "provisional seeds cannot open anything")

        // Verifying seeds is what moves coverage: each needs `seedVerificationPasses`.
        let needed = Int((Double(base.count) * ReadinessConfig.tuning.readingUnlock).rounded(.up))
        for cid in base.prefix(needed) {
            for _ in 0..<Tuning.seedVerificationPasses { s.recordCheckIn(conceptId: cid, passed: true, now: now) }
            #expect(s.concept(cid)!.isVerifiedMastered)
        }
        #expect(s.foundationMastered == needed)
        #expect(s.readiness(for: .reading) == .unlocked)
        #expect(!s.willEnterFoundation(after: result), "a retake by a learner whose reading is open stays open")
        // `recordCheckIn` refreshes the record BEFORE its outcome lands, so the
        // unlock is written at the next bookkeeping point, not by the verifying answer.
        s.completeLesson(targetConceptId: nil, isCapstone: false, now: now)
        #expect(s.unlockedModalities.contains(LearningModality.reading.rawValue))
    }

    @Test func anOpenedModalityRelocksOnlyBelowTheBridgeAndOnlyAtABookkeepingPoint() {
        let s = EngineFixtures.store()
        let base = Array(ConceptTaxonomy.baseConceptIds).sorted()
        let config = ReadinessConfig.tuning
        let needed = Int((Double(base.count) * config.readingUnlock).rounded(.up))
        func master(_ cid: String) {
            let idx = s.concepts.firstIndex { $0.id == cid }!
            s.concepts[idx] = EngineFixtures.mastered(cid, category: s.concepts[idx].category, level: s.concepts[idx].cefrLevel,
                                                      prerequisites: s.concepts[idx].prerequisites)
        }
        func unmaster(_ cid: String) {
            let idx = s.concepts.firstIndex { $0.id == cid }!
            s.concepts[idx].alpha = 1
            s.concepts[idx].beta = 1
            s.concepts[idx].observationCount = 0
        }
        for cid in base.prefix(needed) { master(cid) }
        s.completeLesson(targetConceptId: nil, isCapstone: false, now: now)
        #expect(s.readiness(for: .reading) == .unlocked)
        #expect(s.unlockedModalities.contains(LearningModality.reading.rawValue))

        // Coverage slips below the unlock bar but stays above the bridge: reading
        // stays open, live and after bookkeeping — no day-to-day flip-flop.
        unmaster(base[0])
        #expect(s.baseCoverage < config.readingUnlock && s.baseCoverage >= config.readingBridge)
        #expect(s.readiness(for: .reading) == .unlocked, "hysteresis: still open")
        s.completeLesson(targetConceptId: nil, isCapstone: false, now: now)
        #expect(s.readiness(for: .reading) == .unlocked && s.unlockedModalities.contains(LearningModality.reading.rawValue))

        // Below the bridge: still open LIVE (a bookkeeping decision, not a render-time
        // one) and re-locked at the next bookkeeping point.
        let bridgeCount = Int((Double(base.count) * config.readingBridge).rounded(.up))
        for cid in base.prefix(needed).dropFirst().prefix(needed - bridgeCount) { unmaster(cid) }
        #expect(s.baseCoverage < config.readingBridge)
        #expect(s.readiness(for: .reading) == .unlocked, "not evaluated live")
        s.completeLesson(targetConceptId: nil, isCapstone: false, now: now)
        #expect(s.readiness(for: .reading) != .unlocked, "re-locked at the bookkeeping point")
        #expect(s.unlockedModalities.isEmpty, "everything gated behind reading closed with it")
    }

    @Test func placementFromTheEngineSeedsOnlyFullyProbedConceptsAsMastered() {
        // Real staircase on a small bank: two concepts fully probed, one asked once.
        var bank: [AssessmentQuestion] = []
        for n in 0..<3 {
            bank.append(question(1, .vocabulary, "everyday-vocab", n))
            bank.append(question(1, .grammar, "definite-articles", n))
        }
        bank.append(question(2, .vocabulary, "family-vocab", 0))
        var engine = PlacementEngine(bank: bank)
        while let q = engine.next() { engine.record(q, correct: true) }
        let result = engine.result()
        #expect(result.askedCount(for: "family-vocab") == 1)
        #expect(!result.masteredConceptIds.contains("family-vocab"))
        #expect(result.inferredConceptIds.contains("family-vocab"))

        let s = EngineFixtures.store()
        s.applyPlacement(result, isFirstRun: true, now: now)
        #expect(s.concept("family-vocab")!.state == .learning, "asked once → a head start, not mastery")
        #expect(!s.concept("family-vocab")!.isProvisional)
        for cid in result.masteredConceptIds {
            #expect(s.concept(cid)!.state == .mastered && s.concept(cid)!.isProvisional, "\(cid)")
        }
        for cid in result.inferredConceptIds {
            #expect(s.concept(cid)!.state != .mastered, "\(cid) was only inferred")
        }
        #expect(s.baseCoverage == 0, "provisional seeds never count toward coverage")
        #expect(s.foundationMastered == 0)
        #expect(s.readiness(for: .reading) != .unlocked && s.unlockedModalities.isEmpty)
    }

    // MARK: B10 — lesson-paced Foundation days

    @Test func lockedLearnersGetALessonPacedPlan() {
        let s = EngineFixtures.store()   // real taxonomy, nothing mastered → reading locked
        s.preferences = UserPreferences(modalities: [.reading], timeBudget: .standard, daysPerWeekGoal: nil)
        let plan = DailyPlanEngine(store: s).makePlan(now: now)
        #expect(plan.items.count == 1)
        let item = plan.items[0]
        #expect(item.kind == .lessons && item.target == Tuning.foundationLessonsPerDay && item.modality == nil)
        #expect(item.id == "lessons" && item.targetMinutes == 0)
        #expect(plan.totalMinutes == 0 && plan.isLessonPaced && plan.lessonItem == item)
        #expect(!plan.isColdStart)
        #expect(plan.rationale == "\(Tuning.foundationLessonsPerDay) short lessons today — each one builds toward unlocking reading.")
        #expect(s.planProgress(for: item, now: now) == 0)
        s.completeLesson(targetConceptId: nil, isCapstone: false, now: now)
        #expect(s.planProgress(for: item, now: now) == 1 && s.lessonsCompleted(on: now) == 1)
        #expect(s.planProgress(for: DailyPlanItem(modality: .reading, targetMinutes: 10), now: now) == s.minutesToday(.reading))

        // The plan of record round-trips a lessons item.
        let scratch = ScratchDefaults()
        let p = AppStore(persistence: scratch.defaults)
        _ = p.planForToday(now: now) { plan }
        p.flush()
        #expect(AppStore(persistence: scratch.defaults).dailyPlanOfRecord == plan)
    }

    // MARK: B11 — the release-streak hint

    @Test func selectionCarriesTheConceptReleaseStreak() {
        let g = EngineFixtures.smallGraph()
        let output = ConceptSelector(store: g.store).select(.smart(now: now))
        #expect(output.conceptReleaseStreak == Tuning.conceptReleaseStreak)
        #expect(Tuning.conceptReleaseStreak == 3)
    }

    // MARK: B12 — a never-observed concept needs something to teach

    @Test func neverObservedConceptIsEligibleOnlyWithAGapOrAsTheProbe() {
        let s = EngineFixtures.store(concepts: [EngineFixtures.concept("empty"), EngineFixtures.concept("full")],
                                     gaps: [EngineFixtures.gap("full-0", concept: "full")])
        s.sessionIndex = 1   // not a probe session
        var selector = ConceptSelector(store: s)
        #expect(selector.eligibleConcepts(now: now).map { $0.id } == ["full"], "nothing to teach → not ranked")
        #expect(selector.select(.smart(now: now)).targetConceptId == "full")

        // A probe session makes the gap-less concept eligible as the probe candidate.
        s.sessionIndex = 0
        #expect(selector.probeConcept()?.id == "empty")
        #expect(Set(selector.eligibleConcepts(now: now).map { $0.id }) == ["empty", "full"])

        // A learning concept is always eligible, gaps or not.
        s.concepts[0] = EngineFixtures.learning("empty", mastery: 0.5)
        s.sessionIndex = 1
        selector = ConceptSelector(store: s)
        #expect(Set(selector.eligibleConcepts(now: now).map { $0.id }) == ["empty", "full"])

        // A resting (not practicable) gap does not count as something to teach.
        let t = EngineFixtures.store(concepts: [EngineFixtures.concept("rest")],
                                     gaps: [EngineFixtures.gap("rest-0", concept: "rest", due: now.addingTimeInterval(9 * day),
                                                               consecutiveCorrect: Tuning.gapMasteryStreak, mastered: now)])
        t.sessionIndex = 1
        #expect(ConceptSelector(store: t).eligibleConcepts(now: now).isEmpty)
    }

    // MARK: B13 — probes come from content

    @Test func probeCandidateSkipsConceptsWithoutProbeContent() {
        let s = EngineFixtures.store(concepts: [EngineFixtures.concept("a", category: .pronunciation),
                                                EngineFixtures.concept("b", category: .pronunciation)], gaps: [])
        s.sessionIndex = 0
        s.probeContent = { id in id == "b" ? EngineFixtures.syntheticProbes(for: id) : [] }
        let selector = ConceptSelector(store: s)
        #expect(selector.probeConcept()?.id == "b", "a has no probes → skipped for the next candidate")
        #expect(s.materializeProbeGap(id: "probe-a-0", for: s.concept("a")!, now: now) == nil)
        #expect(!s.gaps.contains { $0.id == "probe-a-0" })
        let probe = s.materializeProbeGap(id: "probe-b-0", for: s.concept("b")!, now: now)
        #expect(probe?.isProbe == true && probe?.probeOptions?.count == 3)
        #expect(probe?.irtDifficulty == Tuning.irtDifficulty(for: .A1))

        // Probes rotate with the session so a re-probe is a different item.
        s.sessionIndex = 1
        let next = s.materializeProbeGap(id: "probe-b-1", for: s.concept("b")!, now: now)
        #expect(next?.frenchWord == EngineFixtures.syntheticProbes(for: "b")[1].fr)
        s.probeContent = { _ in [] }
        #expect(ConceptSelector(store: s).probeConcept() == nil)
    }

    @Test func gapProbeOptionsRoundTripAndDefaultNil() throws {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        var gap = EngineFixtures.gap("p", concept: "c")
        gap.isProbe = true
        gap.probeOptions = ["x", "y", "z"]
        let round = try decoder.decode(GapItem.self, from: encoder.encode(gap))
        #expect(round.probeOptions == ["x", "y", "z"])
        var object = try #require(JSONSerialization.jsonObject(with: encoder.encode(gap)) as? [String: Any])
        object.removeValue(forKey: "probeOptions")
        let legacy = try decoder.decode(GapItem.self, from: JSONSerialization.data(withJSONObject: object))
        #expect(legacy.probeOptions == nil)
    }

    // MARK: B14 — engine metrics

    @Test func metricsSnapshotCountsTheEngineAndTheLogIsCappedAndPersisted() {
        let scratch = ScratchDefaults()
        let s = AppStore(persistence: scratch.defaults)
        s.probeContent = EngineFixtures.syntheticProbes
        // Two mastered (one provisional), one learning, one stalled; base coverage stays low.
        let a = s.concepts.firstIndex { $0.id == "everyday-vocab" }!
        s.concepts[a] = EngineFixtures.mastered("everyday-vocab", category: .vocabulary)
        let b = s.concepts.firstIndex { $0.id == "family-vocab" }!
        s.concepts[b] = EngineFixtures.mastered("family-vocab", category: .vocabulary)
        s.concepts[b].isProvisional = true
        let c = s.concepts.firstIndex { $0.id == "negation" }!
        s.concepts[c] = EngineFixtures.learning("negation", mastery: 0.5, prerequisites: ["present-er-verbs"])
        s.concepts[c].stallAttempts = Tuning.stallAttempts
        s.checkInHistory = [true, false, true]
        s.journeyStartedAt = now.addingTimeInterval(-10 * day)

        let m = s.metricsSnapshot(now: now)
        let selector = ConceptSelector(store: s)
        #expect(m.frontierSize == s.concepts.filter { selector.isFrontier($0) }.count && m.frontierSize > 0)
        #expect(m.learningCount == 1 && m.masteredCount == 2 && m.provisionalCount == 1)
        #expect(m.observedCount == 3)
        #expect(m.checkInPassRate.map { abs($0 - 2.0 / 3.0) < 1e-9 } == true)
        #expect(m.checkInCount == 3 && m.checkInMisses == 1)
        #expect(!m.governorActive)
        #expect(m.stalledConceptIds == ["negation"] && m.stalls == 1)
        #expect(m.daysSinceStart == 10)
        #expect(!m.readingUnlocked)
        #expect(m.lessonsToday == 0)
        #expect(m.at == now && m.sessionIndex == 0)

        // completeLesson appends one snapshot; the log is capped and survives a relaunch.
        #expect(s.metricsLog.isEmpty)
        s.metricsLog.capacity = 3
        for i in 0..<5 {
            s.completeLesson(targetConceptId: nil, isCapstone: false, now: now.addingTimeInterval(Double(i)))
        }
        #expect(s.metricsLog.count == 3)
        #expect(s.metricsLog.last?.sessionIndex == 5)
        #expect(s.metricsLog.last?.lessonsToday == 5)
#if DEBUG
        #expect(s.diagnosticsMetrics.count == 3)
#endif
        s.flush()
        let reloaded = AppStore(persistence: scratch.defaults)
        #expect(reloaded.metricsLog.count == 3 && reloaded.metricsLog.capacity == 3)
        #expect(reloaded.checkInHistory == [true, false, true])
        #expect(reloaded.journeyStartedAt == s.journeyStartedAt)
        #expect(reloaded.metricsLog.last == s.metricsLog.last)

        // Reset clears the Pass 3 bookkeeping too.
        reloaded.resetProgress()
        #expect(reloaded.metricsLog.isEmpty && reloaded.checkInHistory.isEmpty && reloaded.journeyStartedAt == nil
                && reloaded.unlockedModalities.isEmpty)
    }

    @Test func journeyStartsAtTheFirstLesson() {
        let s = EngineFixtures.store()
        #expect(s.journeyStartedAt == nil && s.metricsSnapshot(now: now).daysSinceStart == 0)
        s.completeLesson(targetConceptId: nil, isCapstone: false, now: now)
        #expect(s.journeyStartedAt == now)
        #expect(s.metricsSnapshot(now: now.addingTimeInterval(3 * day)).daysSinceStart == 3)
    }

    // MARK: B15 — stalls prefer prerequisites and re-show the card

    @Test func stalledConceptBoostsItsUnmasteredPrerequisitesAndIsFlaggedInTheSelection() throws {
        let parent = EngineFixtures.learning("parent", mastery: 0.5)
        let child = EngineFixtures.learning("child", mastery: 0.5, prerequisites: ["parent"])
        var gaps = (0..<3).map { EngineFixtures.gap("parent-\($0)", concept: "parent") }
        gaps += (0..<3).map { EngineFixtures.gap("child-\($0)", concept: "child", due: now.addingTimeInterval(-5 * day)) }
        let s = EngineFixtures.store(concepts: [parent, child], gaps: gaps)
        s.sessionIndex = 1
        let pipeline = LessonPipeline(store: s)
        let selector = pipeline.selector
        #expect(selector.select(.smart(now: now)).targetConceptId == "child", "overdue gaps rank the child first")
        #expect(selector.stallPrerequisiteBonus(parent) == 0)

        // Three lessons as the target with no state change → stalled.
        for i in 0..<Tuning.stallAttempts {
            let output = SelectionOutput(request: .smart(now: now), targetConceptId: "child", items: [], headline: "",
                                         rankedConcepts: [], learnerLevel: .A1)
            s.noteLessonSelected(output)
            #expect(s.concept("child")?.lastTaughtState == .learning)
            s.completeLesson(targetConceptId: "child", isCapstone: false, now: now)
            #expect(s.concept("child")?.stallAttempts == i + 1)
        }
        #expect(s.concept("child")!.isStalled)
        #expect(s.stalledConcepts.map { $0.id } == ["child"])

        // The selector now prefers the unmastered prerequisite…
        #expect(selector.stallPrerequisiteBonus(parent) == Tuning.stallPrerequisiteBonus)
        #expect(selector.stallPrerequisiteBonus(child) == 0)
        let lesson = pipeline.lesson(for: .smart(now: now))
        let remediation = try #require(lesson?.selection)
        #expect(remediation.targetConceptId == "parent")
        #expect(remediation.stalledConceptIds == ["child"], "the stalled concept rides in as review and gets its card again")
        #expect(remediation.items.contains { $0.conceptId == "child" })
        #expect(lesson?.conceptBlocks.first { $0.concept.id == "child" }?.isStalled == true)
        #expect(lesson?.conceptBlocks.first { $0.concept.id == "parent" }?.isStalled == false)
        #expect(lesson?.conceptBlocks.first?.teaching == nil, "no bundled content on the test host → the description carries the card")

        // …but not a mastered one.
        s.concepts[0] = EngineFixtures.mastered("parent")
        #expect(ConceptSelector(store: s).stallPrerequisiteBonus(s.concepts[0]) == 0)

        // A state change resets the count.
        s.noteLessonSelected(SelectionOutput(request: .smart(now: now), targetConceptId: "child", items: [], headline: "",
                                             rankedConcepts: [], learnerLevel: .A1))
        for _ in 0..<6 { s.recordConceptAnswer(conceptId: "child", correct: true, now: now) }
        #expect(s.concept("child")?.state == .mastered)
        s.completeLesson(targetConceptId: "child", isCapstone: false, now: now)
        #expect(s.concept("child")?.stallAttempts == 0)
        #expect(s.selectionLog.last?.stalledConceptIds == ["child"], "the trace kept the remediation selection")
    }

    // MARK: Content v2 loader

    /// The bundled content file, located from the source tree (Xcode) or the
    /// harness's `Resources/` copy (Linux); nil when neither is present.
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

    @Test func shippedContentDecodesWithTeachingProbesAndVerifiedBlanksForEveryConcept() throws {
        guard let data = bundledContentData() else {
            print("[Pass3EngineTests] FoundationContent.json not reachable from this host — skipping the shipped-content check")
            return
        }
        let file = try FoundationContentLoader.decode(data)
        #expect(file.version == 2)
        let taxonomy = ConceptTaxonomy.seed()
        #expect(Set(file.skills.map { $0.id }).isSuperset(of: taxonomy.map { $0.id }), "every taxonomy concept has a skill block")
        for concept in taxonomy {
            let teaching = FoundationContentLoader.teaching(for: concept.id, in: file)
            #expect(teaching != nil && !(teaching?.rule.isEmpty ?? true), "\(concept.id): teaching present")
            let probes = FoundationContentLoader.probes(for: concept.id, in: file)
            #expect(probes.count == Tuning.placementProbesPerConcept, "\(concept.id): \(probes.count) usable probes")
            for probe in probes {
                #expect(probe.options.count == 3 && !probe.options.contains(probe.en), "\(concept.id): probe distractors")
            }
            let skill = try #require(FoundationContentLoader.skill(for: concept.id, in: file))
            #expect(GapCategory(rawValue: skill.category) == concept.category, "\(concept.id): category matches the taxonomy")
        }
        let gaps = FoundationContentLoader.gaps(from: file, now: now)
        #expect(gaps.count == file.skills.reduce(0) { $0 + $1.items.count })
        for gap in gaps where gap.isTestable {
            #expect(gap.blankForm != nil, "\(gap.id): a testable item carries a verified blank")
            #expect(gap.exampleSentence.contains(gap.blankForm ?? "§"), "\(gap.id): the blank occurs verbatim in its example")
        }
        #expect(gaps.allSatisfy { $0.fsrs != nil && $0.conceptId != nil })
        #expect(Set(gaps.map { $0.id }).count == gaps.count, "gap ids are unique")
    }

    @Test func loaderDecodesV1AndV2ContentTolerantly() throws {
        let v1 = """
        {"version":1,"skills":[{"id":"everyday-vocab","category":"vocabulary","items":[
          {"fr":"w1","en":"e1","note":"n1","ex":"x w1 y","exEn":"xe1"},
          {"fr":"w2","en":"e2","note":"n2","ex":"w2 here","exEn":"e2 here","diff":"hard"}]}]}
        """
        let old = try FoundationContentLoader.decode(Data(v1.utf8))
        #expect(old.version == 1 && old.skills.count == 1)
        #expect(old.skills[0].teaching == nil && old.skills[0].probes.isEmpty)
        #expect(FoundationContentLoader.probes(for: "everyday-vocab", in: old).isEmpty)
        #expect(FoundationContentLoader.teaching(for: "everyday-vocab", in: old) == nil)
        let oldGaps = FoundationContentLoader.gaps(from: old, now: now)
        #expect(oldGaps.count == 2)
        #expect(oldGaps.allSatisfy { $0.blankForm == nil && $0.acceptedAnswers == nil && $0.isTestable })
        #expect(oldGaps[1].difficulty == .hard && oldGaps[0].conceptId == "everyday-vocab")
        #expect(oldGaps[0].fsrs?.dueAt == now)

        let v2 = """
        {"version":2,"skills":[{"id":"definite-articles","category":"grammar",
          "teaching":{"rule":"r","examples":[{"fr":"a","en":"b","note":"c"}],"contrast":[{"fr":"d","en":"e"}],"commonMistake":"m"},
          "probes":[
            {"fr":"p1","en":"a1","ex":"x1","exEn":"y1","options":["o1","o2","o3"]},
            {"fr":"p2","en":"a2","options":["o1","a2","o3"]},
            {"fr":"p3","en":"a3","options":["o1","o1","o3"]}],
          "items":[
            {"fr":"w1","en":"e1","note":"n","ex":"the w1 form","exEn":"t","blank":"w1","alts":["w1b"],"testable":true},
            {"fr":"w2","en":"e2","note":"n","ex":"no match here","exEn":"t","blank":"w2"},
            {"fr":"-rule","en":"e3","note":"n","ex":"","exEn":"","testable":false}]}]}
        """
        let file = try FoundationContentLoader.decode(Data(v2.utf8))
        let teaching = try #require(FoundationContentLoader.teaching(for: "definite-articles", in: file))
        #expect(teaching.rule == "r" && teaching.examples.count == 1 && teaching.contrast.count == 1 && teaching.commonMistake == "m")
        #expect(teaching.contrast[0].note == nil)
        let probes = FoundationContentLoader.probes(for: "definite-articles", in: file)
        #expect(probes.map { $0.fr } == ["p1"], "a probe whose options repeat the answer, or each other, is unusable")
        #expect(probes[0].options == ["o1", "o2", "o3"] && probes[0].ex == "x1")
        #expect(FoundationContentLoader.items(for: "definite-articles", in: file).count == 3)
        let gaps = FoundationContentLoader.gaps(from: file, now: now)
        #expect(gaps[0].blankForm == "w1" && gaps[0].acceptedAnswers == ["w1b"] && gaps[0].isTestable)
        #expect(gaps[1].blankForm == nil, "a blank that does not occur verbatim in the example is never offered")
        #expect(gaps[2].isTestable == false && gaps[2].blankForm == nil)
        #expect(FoundationContentLoader.skill(for: "missing", in: file)?.id == nil)
    }
}
