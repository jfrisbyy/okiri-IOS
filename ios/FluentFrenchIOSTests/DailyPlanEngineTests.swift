//
//  DailyPlanEngineTests.swift
//  FluentFrenchIOSTests
//
//  The daily plan is a VIEW on the selector: its tilt comes from
//  SelectionOutput.rankedConcepts and from nothing else.
//

import Foundation
import Testing
@testable import FluentFrenchIOS

@MainActor
struct DailyPlanEngineTests {

    private func planStore() -> AppStore {
        // A taxonomy with no base-concept ids → coverage reads as 1 → every modality unlocked.
        let concepts = [
            EngineFixtures.learning("gram", mastery: 0.5, category: .grammar),
            EngineFixtures.learning("pron", mastery: 0.5, category: .pronunciation),
        ]
        let gaps = [
            EngineFixtures.gap("gram-0", concept: "gram", category: .grammar),
            EngineFixtures.gap("pron-0", concept: "pron", category: .pronunciation),
        ]
        let store = EngineFixtures.store(concepts: concepts, gaps: gaps)
        store.preferences = UserPreferences(modalities: [.reading, .speaking, .listening], timeBudget: .standard, daysPerWeekGoal: nil)
        return store
    }

    private func output(_ store: AppStore, ranked: [ScoredConcept], target: String? = nil,
                        items: [SelectedItem] = [], headline: String = "h", mode: SelectionMode = .smart) -> SelectionOutput {
        SelectionOutput(request: SelectionRequest(mode: mode, now: EngineFixtures.now), targetConceptId: target,
                        items: items, headline: headline, rankedConcepts: ranked, learnerLevel: .A2)
    }

    @Test func tiltChangesWhenRankedConceptsChange() throws {
        let store = planStore()
        let engine = DailyPlanEngine(store: store)
        let gram = try #require(store.concept("gram")), pron = try #require(store.concept("pron"))

        let grammarLed = engine.makePlan(from: output(store, ranked: [ScoredConcept(concept: gram, score: 1, isFrontier: false)]))
        let pronunciationLed = engine.makePlan(from: output(store, ranked: [ScoredConcept(concept: pron, score: 1, isFrontier: false)]))

        #expect(!grammarLed.isColdStart && !pronunciationLed.isColdStart)
        #expect(grammarLed != pronunciationLed)
        #expect(grammarLed.items.first?.modality == .reading, "grammar's prior is reading-heavy")
        #expect(pronunciationLed.items.first?.modality != .reading, "pronunciation's prior is speaking + listening")
        func minutes(_ plan: DailyPlan, _ m: LearningModality) -> Int {
            plan.items.first { $0.modality == m }?.targetMinutes ?? 0
        }
        #expect(minutes(grammarLed, .reading) > minutes(pronunciationLed, .reading))
        #expect(minutes(pronunciationLed, .speaking) > minutes(grammarLed, .speaking))
    }

    @Test func tiltIgnoresEverythingButRankedConcepts() throws {
        let store = planStore()
        let engine = DailyPlanEngine(store: store)
        let gram = try #require(store.concept("gram"))
        let ranked = [ScoredConcept(concept: gram, score: 1.2, isFrontier: false)]

        let a = engine.makePlan(from: output(store, ranked: ranked))
        let b = engine.makePlan(from: output(store, ranked: ranked, target: "gram",
                                             items: [SelectedItem(gapId: "gram-0", conceptId: "gram", role: .target, reason: "r")],
                                             headline: "Today: grammar", mode: .capstone))
        #expect(a == b, "target, items, headline and mode do not move the plan")
    }

    @Test func coldStartIsAnHonestEvenSplit() {
        let store = planStore()
        let engine = DailyPlanEngine(store: store)

        let empty = engine.makePlan(from: output(store, ranked: []))
        #expect(empty.isColdStart)
        #expect(Set(empty.items.map { $0.targetMinutes }).count == 1, "even split")
        #expect(empty.items.count == 3)

        let gram = store.concept("gram")!
        let zeroScored = engine.makePlan(from: output(store, ranked: [ScoredConcept(concept: gram, score: 0, isFrontier: false)]))
        #expect(zeroScored.isColdStart)
    }

    @Test func makePlanConsumesTheSelectorsOwnOutput() {
        let store = planStore()
        let engine = DailyPlanEngine(store: store)
        let selection = ConceptSelector(store: store).select(.smart(now: EngineFixtures.now))
        #expect(engine.makePlan(now: EngineFixtures.now) == engine.makePlan(from: selection))
        #expect(!selection.rankedConcepts.isEmpty)
    }

    @Test func nothingUnlockedMeansNoPlanRegardlessOfRanking() throws {
        let store = planStore()
        // The plan only allocates to chosen + unlocked modalities: choose none.
        store.preferences = UserPreferences(modalities: [], timeBudget: .light, daysPerWeekGoal: nil)
        let gram = try #require(store.concept("gram"))
        let plan = DailyPlanEngine(store: store).makePlan(from: output(store, ranked: [ScoredConcept(concept: gram, score: 1, isFrontier: false)]))
        #expect(plan.items.isEmpty && plan.isColdStart)
    }
}
