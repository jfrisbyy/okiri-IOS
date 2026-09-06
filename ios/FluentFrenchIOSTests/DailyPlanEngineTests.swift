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
        #expect(grammarLed.minuteItems.first?.modality == .reading, "grammar's prior is reading-heavy")
        #expect(pronunciationLed.minuteItems.first?.modality != .reading, "pronunciation's prior is speaking + listening")
        func minutes(_ plan: DailyPlan, _ m: LearningModality) -> Int {
            plan.minuteItems.first { $0.modality == m }?.targetMinutes ?? 0
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
        #expect(Set(empty.minuteItems.map { $0.targetMinutes }).count == 1, "even split")
        #expect(empty.minuteItems.count == 3)
        #expect(empty.isLessonPaced, "the post-unlock lessons spine rides along")

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

    @Test func nothingChosenMeansNoMinutesRegardlessOfRanking() throws {
        let store = planStore()
        // The plan only allocates to chosen + unlocked modalities: choose none.
        store.preferences = UserPreferences(modalities: [], timeBudget: .light, daysPerWeekGoal: nil)
        let gram = try #require(store.concept("gram"))
        let plan = DailyPlanEngine(store: store).makePlan(from: output(store, ranked: [ScoredConcept(concept: gram, score: 1, isFrontier: false)]))
        #expect(plan.minuteItems.isEmpty && plan.isColdStart)
        #expect(plan.unlockItem == nil, "nothing was chosen, so there is nothing to unlock toward")
        #expect(plan.isLessonPaced, "the lessons spine is the whole plan")
        #expect(plan.totalMinutes == 0)
    }

    // MARK: The plan never asks for more time than the learner chose

    @Test func planTotalNeverExceedsTheTimeBudget() throws {
        let store = planStore()
        let engine = DailyPlanEngine(store: store)
        let gram = try #require(store.concept("gram"))
        let choices: [Set<LearningModality>] = [[.reading], [.reading, .speaking],
                                                [.reading, .speaking, .listening],
                                                Set(LearningModality.allCases)]
        for budget in TimeBudget.allCases {
            for chosen in choices {
                store.preferences = UserPreferences(modalities: chosen, timeBudget: budget, daysPerWeekGoal: nil)
                let tilted = engine.makePlan(from: output(store, ranked: [ScoredConcept(concept: gram, score: 1, isFrontier: false)]))
                let cold = engine.makePlan(from: output(store, ranked: []))
                #expect(tilted.totalMinutes <= budget.minutes, "tilted plan fits \(budget.label)")
                #expect(cold.totalMinutes <= budget.minutes, "cold-start plan fits \(budget.label)")
                #expect(tilted.totalMinutes > 0 && cold.totalMinutes > 0, "a budget always buys at least one row")
                #expect(tilted.minuteItems.allSatisfy { $0.targetMinutes >= Tuning.planMinuteBlock })
                #expect(cold.minuteItems.allSatisfy { $0.targetMinutes >= Tuning.planMinuteBlock })
                #expect(Set(cold.minuteItems.map { $0.targetMinutes }).count <= 1, "the cold-start split stays even")
            }
        }
    }

    /// The regression: "~10 min" with all four activities chosen used to floor
    /// every row at five minutes and prescribe twenty — twice what Preferences and
    /// the Profile quote.
    @Test func lightBudgetWithEveryActivityStaysInsideTenMinutes() throws {
        let store = planStore()
        store.preferences = UserPreferences(modalities: Set(LearningModality.allCases), timeBudget: .light, daysPerWeekGoal: nil)
        let gram = try #require(store.concept("gram"))
        let engine = DailyPlanEngine(store: store)
        let plan = engine.makePlan(from: output(store, ranked: [ScoredConcept(concept: gram, score: 1, isFrontier: false)]))
        #expect(plan.totalMinutes == TimeBudget.light.minutes)
        #expect(plan.minuteItems.count == 2, "ten minutes seats two five-minute rows, not four")
        #expect(plan.minuteItems.first?.modality == .reading, "the highest-share activities are the ones kept")

        let cold = engine.makePlan(from: output(store, ranked: []))
        #expect(cold.totalMinutes == TimeBudget.light.minutes && cold.minuteItems.count == 2)
    }

    // MARK: D2 — every chosen activity locked → an explicit unlock item

    /// Real taxonomy with nothing mastered (coverage 0) but Reading recorded as
    /// open: the higher modalities stay locked until 15 demonstrated minutes.
    private func readingOpenStore(chosen: Set<LearningModality>) -> AppStore {
        let s = EngineFixtures.store()
        s.unlockedModalities.insert(LearningModality.reading.rawValue)
        s.preferences = UserPreferences(modalities: chosen, timeBudget: .standard, daysPerWeekGoal: nil)
        return s
    }

    @Test func allChosenLockedYieldsAnUnlockItemThatLeads() {
        let s = readingOpenStore(chosen: [.listening, .speaking])
        #expect(s.readiness(for: .reading) == .unlocked && s.readiness(for: .listening) == .locked)
        let plan = DailyPlanEngine(store: s).makePlan(from: output(s, ranked: []))

        let bar = ReadinessConfig.tuning.higherDemonstratedMinutes
        let unlock = DailyPlanItem.unlock(via: .reading, minutes: bar)
        #expect(plan.unlockItem == unlock)
        #expect(plan.items.first == unlock, "the unlock action leads")
        #expect(unlock.kind == .unlock && unlock.modality == .reading && unlock.target == bar)
        #expect(unlock.targetMinutes == 0 && unlock.id == "unlock-reading" && unlock.isUnlock)
        #expect(plan.minuteItems.isEmpty && !plan.isColdStart)
        #expect(plan.isLessonPaced, "the lessons spine stays")
        // Order follows LearningModality.allCases: speaking before listening.
        #expect(plan.rationale == ReadinessCopy.unlockHeadline(for: [.speaking, .listening]))
        #expect(plan.rationale == "\(bar) min of Reading unlocks Speaking & Listening")
        // Progress toward the unlock item is lifetime reading minutes.
        #expect(s.planProgress(for: unlock, now: EngineFixtures.now) == 0)
        s.recordActivityMinutes(.reading, minutes: 8, now: EngineFixtures.now)
        #expect(s.planProgress(for: unlock, now: EngineFixtures.now) == 8)
    }

    @Test func unlockItemDisappearsOnceTheMinutesOpenTheGate() {
        let s = readingOpenStore(chosen: [.listening])
        let bar = ReadinessConfig.tuning.higherDemonstratedMinutes
        s.recordActivityMinutes(.reading, minutes: bar - 1, now: EngineFixtures.now)
        #expect(s.readiness(for: .listening) == .locked)
        #expect(DailyPlanEngine(store: s).makePlan(from: output(s, ranked: [])).unlockItem != nil)

        // The promise holds: the demonstrated minutes open the higher modality even
        // while coverage is below the reading bar (Reading is recorded open, B8).
        s.recordActivityMinutes(.reading, minutes: 1, now: EngineFixtures.now)
        #expect(s.readiness(for: .listening) == .unlocked)
        let plan = DailyPlanEngine(store: s).makePlan(from: output(s, ranked: []))
        #expect(plan.unlockItem == nil)
        #expect(plan.minuteItems.map { $0.modality } == [.listening])
        #expect(plan.isLessonPaced)
    }

    @Test func governorWithMinutesInHoldsWithoutAnUnlockItem() {
        let s = readingOpenStore(chosen: [.listening])
        s.checkInHistory = [false, false, false, false, true, true]
        #expect(s.isGovernorActive)
        s.recordActivityMinutes(.reading, minutes: ReadinessConfig.tuning.higherDemonstratedMinutes, now: EngineFixtures.now)
        let plan = DailyPlanEngine(store: s).makePlan(from: output(s, ranked: []))
        #expect(plan.unlockItem == nil, "the minutes are in; only the governor holds the gate")
        #expect(plan.items.count == 1 && plan.isLessonPaced)
        #expect(plan.rationale == ReadinessCopy.governorHeadline(for: [.listening]))
    }

    @Test func governorBelowTheBarKeepsTheUnlockItemWithGovernorCopy() {
        let s = readingOpenStore(chosen: [.listening])
        s.checkInHistory = [false, false, false, false, true, true]
        let plan = DailyPlanEngine(store: s).makePlan(from: output(s, ranked: []))
        #expect(plan.unlockItem != nil)
        #expect(plan.rationale == ReadinessCopy.governorHeadline(for: [.listening]))
    }

    // MARK: Post-unlock pacing — the lessons spine sizes to what is waiting

    @Test func lessonsSpineSizesToDueAndCapturedMaterial() {
        let s = readingOpenStore(chosen: [.reading])
        let engine = DailyPlanEngine(store: s)
        let now = EngineFixtures.now

        #expect(engine.lessonTarget(now: now) == Tuning.unlockedLessonsPerDayMin, "nothing waiting → the floor")
        var plan = engine.makePlan(from: output(s, ranked: []))
        #expect(plan.lessonItem == .lessons(Tuning.unlockedLessonsPerDayMin))
        #expect(plan.items.first?.kind == .lessons, "the spine leads the minutes rows")
        #expect(plan.minuteItems.map { $0.modality } == [.reading])

        s.gapsSinceLastLesson = Tuning.lessonSize + 1
        #expect(engine.lessonTarget(now: now) == 2, "captures since the last lesson count")

        s.gapsSinceLastLesson = 0
        s.gaps = (0..<(2 * Tuning.lessonSize)).map { EngineFixtures.gap("due-\($0)", concept: nil, due: now) }
        #expect(engine.lessonTarget(now: now) == 2, "due-now gaps count")

        // A capture starts due now, so it is already in the due count: the two
        // never add up (a sum would ask for 4 → the cap here).
        s.gapsSinceLastLesson = Tuning.lessonSize + 1
        #expect(engine.lessonTarget(now: now) == 2, "captures already due are not counted twice")
        s.gapsSinceLastLesson = 0

        s.gaps = (0..<(10 * Tuning.lessonSize)).map { EngineFixtures.gap("due-\($0)", concept: nil, due: now) }
        #expect(engine.lessonTarget(now: now) == Tuning.foundationLessonsPerDay, "capped at the Foundation pace")
        plan = engine.makePlan(from: output(s, ranked: []))
        #expect(plan.lessonItem?.target == Tuning.foundationLessonsPerDay)

        // Not-yet-due gaps do not inflate the spine.
        s.gaps = (0..<(10 * Tuning.lessonSize)).map { EngineFixtures.gap("later-\($0)", concept: nil, due: now.addingTimeInterval(EngineFixtures.day)) }
        #expect(engine.lessonTarget(now: now) == Tuning.unlockedLessonsPerDayMin)
    }

    @Test func lockedReadingKeepsTheFoundationPaceUntouched() {
        let s = EngineFixtures.store()
        s.preferences = UserPreferences(modalities: [.reading], timeBudget: .standard, daysPerWeekGoal: nil)
        let plan = DailyPlanEngine(store: s).makePlan(from: output(s, ranked: []))
        #expect(plan.items == [.lessons(Tuning.foundationLessonsPerDay)])
        #expect(plan.unlockItem == nil && plan.minuteItems.isEmpty)
    }

    // MARK: Governor rationale (Pass 3 F6) once reading is open

    @Test func governorRationaleStaysAfterUnlock() {
        let s = readingOpenStore(chosen: [.reading])
        s.checkInHistory = [false, false, false, false, true, true]
        #expect(s.isGovernorActive)
        let plan = DailyPlanEngine(store: s).makePlan(from: output(s, ranked: []))
        #expect(plan.rationale == ReadinessCopy.governorConsolidating)
        #expect(plan.minuteItems.map { $0.modality } == [.reading], "reading stays open — never re-locked live")

        // A chosen-but-locked activity is named in the governor rationale.
        s.preferences = UserPreferences(modalities: [.reading, .listening], timeBudget: .standard, daysPerWeekGoal: nil)
        let mixed = DailyPlanEngine(store: s).makePlan(from: output(s, ranked: []))
        #expect(mixed.rationale == ReadinessCopy.governorHeadline(for: [.listening]))
    }

    // MARK: Codable (D14) — the plan of record survives a relaunch with every item kind

    @Test func planRoundTripsThroughCodable() throws {
        let plan = DailyPlan(items: [.unlock(via: .reading, minutes: 15), .lessons(2),
                                     DailyPlanItem(modality: .reading, targetMinutes: 10),
                                     DailyPlanItem(modality: .listening, targetMinutes: 5)],
                             rationale: "r", isColdStart: false)
        let data = try JSONEncoder().encode(plan)
        let decoded = try JSONDecoder().decode(DailyPlan.self, from: data)
        #expect(decoded == plan)
        #expect(decoded.unlockItem?.modality == .reading && decoded.lessonItem?.target == 2)
        #expect(decoded.minuteItems.map { $0.target } == [10, 5])

        // Tolerant: an item stored before `kind` existed is a minutes item.
        let legacy = Data(#"{"items":[{"modality":"reading","target":10}],"rationale":"r","isColdStart":true}"#.utf8)
        let old = try JSONDecoder().decode(DailyPlan.self, from: legacy)
        #expect(old.items == [DailyPlanItem(modality: .reading, targetMinutes: 10)])
    }

    @Test func storePersistsAnUnlockItemAcrossRelaunch() {
        let plan = DailyPlan(items: [.unlock(via: .reading, minutes: 15), .lessons(1)], rationale: "r", isColdStart: false)
        let scratch = ScratchDefaults()
        let s = AppStore(persistence: scratch.defaults)
        _ = s.planForToday(now: EngineFixtures.now) { plan }
        s.flush()
        #expect(AppStore(persistence: scratch.defaults).dailyPlanOfRecord == plan)
    }

    // MARK: D14 — the store's plan of record is the engine's plan, once a day

    @Test func todaysPlanIsComputedOnceAndRecomputedOnRequest() {
        let s = readingOpenStore(chosen: [.reading])
        let now = EngineFixtures.now
        let first = s.todaysPlan(now: now)
        #expect(first == s.dailyPlanOfRecord)
        #expect(first.minuteItems.map { $0.modality } == [.reading])

        // A preference change alone does not move the plan of record…
        s.setPreferences(UserPreferences(modalities: [.reading], timeBudget: .intense, daysPerWeekGoal: nil))
        #expect(s.todaysPlan(now: now.addingTimeInterval(3600)) == first)
        // …until Home asks for a recompute (a bigger budget → more reading minutes).
        let recomputed = s.recomputePlan(now: now.addingTimeInterval(3600))
        #expect(recomputed != first)
        #expect(recomputed.totalMinutes > first.totalMinutes)
        #expect(recomputed.minuteItems.map { $0.modality } == [.reading])
        #expect(s.dailyPlanOfRecord == recomputed)
        #expect(s.todaysPlan(now: now.addingTimeInterval(7200)) == recomputed, "cached for the rest of the day")
    }
}
