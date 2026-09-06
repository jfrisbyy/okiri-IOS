//
//  HomeGateTests.swift
//  FluentFrenchIOSTests
//
//  Package D-home: the readiness gate as Home consumes it (D1/D5 — locked,
//  bridge, unlocked, single-source unlock copy), foreground-only activity credit
//  with the per-session cap (D9), and the Home copy rules (D12/D19: "Not placed"
//  before placement, a zero streak is never celebrated, "Lesson 2 of 3 today").
//

import Foundation
import Testing
@testable import FluentFrenchIOS

@MainActor
struct HomeGateTests {
    private let now = EngineFixtures.now
    private let config = ReadinessConfig.tuning

    /// Real taxonomy with `fraction` of the base concepts VERIFIED mastered.
    private func store(coverage fraction: Double) -> AppStore {
        let s = EngineFixtures.store()
        let base = Array(ConceptTaxonomy.baseConceptIds).sorted()
        let count = Int((Double(base.count) * fraction).rounded(.up))
        for cid in base.prefix(count) {
            let idx = s.concepts.firstIndex { $0.id == cid }!
            s.concepts[idx] = EngineFixtures.mastered(cid, category: s.concepts[idx].category,
                                                      level: s.concepts[idx].cefrLevel,
                                                      prerequisites: s.concepts[idx].prerequisites)
        }
        return s
    }

    // MARK: D1 — locked entry points carry the ONE unlock condition

    @Test func lockedReadingClosesEveryEntryPointWithTheFoundationCopy() {
        let s = EngineFixtures.store()   // nothing mastered → coverage 0
        #expect(s.readiness(for: .reading) == .locked)
        for m in LearningModality.allCases {
            #expect(!s.canOpen(m), "\(m) is closed while reading is locked")
            #expect(s.unlockCondition(for: m) != nil)
        }
        #expect(s.unlockCondition(for: .reading) == "Unlocks as you build the basics — keep going with your Foundation lessons.")
        #expect(s.unlockCondition(for: .listening) == "Unlocks after Reading — build the basics first.")
        #expect(s.lockedChosenModalities == [.reading, .speaking, .listening], "default preferences, allCases order")
    }

    // MARK: D5 — the bridge opens Reading only

    @Test func bridgeStateOpensReadingAndNothingElse() {
        let s = store(coverage: config.readingBridge)
        #expect(s.baseCoverage >= config.readingBridge && s.baseCoverage < config.readingUnlock,
                "precondition: coverage sits inside the bridge band")
        #expect(s.readiness(for: .reading) == .foundation)
        #expect(s.isInFoundation, "Home still shows the Foundation track")
        #expect(s.canOpen(.reading), "Read opens in the bridge state (level-capped pieces)")
        #expect(s.unlockCondition(for: .reading) == ReadinessCopy.bridgeCondition)
        for m in [LearningModality.listening, .speaking, .watching] {
            #expect(!s.canOpen(m))
            #expect(s.unlockCondition(for: m) == "Unlocks after Reading — build the basics first.")
        }
    }

    @Test func unlockedReadingOpensAndTheHigherBarShowsProgress() {
        let s = store(coverage: config.readingUnlock)
        #expect(s.readiness(for: .reading) == .unlocked)
        #expect(s.canOpen(.reading) && s.unlockCondition(for: .reading) == nil)

        let bar = config.higherDemonstratedMinutes
        #expect(s.unlockCondition(for: .listening) == "\(bar) min of Reading unlocks Listening.")
        s.recordActivityMinutes(.reading, minutes: 8, now: now)
        #expect(s.unlockCondition(for: .listening) == "8 of \(bar) min of Reading so far — \(bar - 8) more unlocks Listening.")
        #expect(!s.canOpen(.listening))

        s.recordActivityMinutes(.reading, minutes: bar - 8, now: now)
        #expect(s.canOpen(.listening) && s.unlockCondition(for: .listening) == nil)
        #expect(s.lockedChosenModalities.isEmpty, "reading, listening, speaking all open")
    }

    @Test func governorHoldsTheGateWithItsOwnCopy() {
        let s = store(coverage: config.readingUnlock)
        s.recordActivityMinutes(.reading, minutes: config.higherDemonstratedMinutes, now: now)
        s.checkInHistory = [false, false, false, false, true, true]
        #expect(s.isGovernorActive)
        // Held one step below unlocked, never below what coverage already earned:
        // reading falls back to the bridge, so the surface stays open.
        #expect(s.readiness(for: .reading) == .foundation, "never recorded open → held in the bridge")
        #expect(s.canOpen(.reading))
        #expect(s.unlockCondition(for: .reading) == ReadinessCopy.governorBridgeCondition)
        #expect(s.isInFoundation, "Home still paces the day in lessons")

        // Reading recorded open before the governor engaged stays open; listening
        // (never opened) is held with the governor line, not the minutes line.
        s.unlockedModalities = [LearningModality.reading.rawValue]
        #expect(s.canOpen(.reading))
        #expect(s.unlockCondition(for: .reading) == nil)
        #expect(!s.canOpen(.listening))
        #expect(s.unlockCondition(for: .listening) == "Consolidating your base before opening listening.")
    }

    /// A `.locked` Reading verdict can only ever come from coverage below the
    /// bridge — the governor holds Reading at `.foundation`, never lower — so the
    /// unlock note must not blame the governor and imply the basics are already
    /// built (firstrun-4-4).
    @Test func lockedReadingKeepsTheCoverageSentenceEvenUnderTheGovernor() {
        let s = store(coverage: 0)
        s.checkInHistory = Array(repeating: false, count: Tuning.governorMinSamples)
        #expect(s.isGovernorActive)
        #expect(s.readiness(for: .reading) == .locked, "the governor never locks reading; coverage did")
        #expect(s.unlockCondition(for: .reading) == "Unlocks as you build the basics — keep going with your Foundation lessons.")
        #expect(s.unlockCondition(for: .reading) != ReadinessCopy.governorCondition(for: .reading))
        // The governor line is still the right one for a modality it really holds.
        #expect(s.unlockCondition(for: .listening) == "Unlocks after Reading — build the basics first.")
    }

    /// A governed learner who is ALREADY reading in the bridge must not lose that
    /// surface by verifying one more base concept: crossing `readingUnlock` while
    /// the governor holds keeps the bridge open instead of dropping to locked.
    @Test func governorNeverClosesABridgeTheLearnerAlreadyHad() {
        let s = store(coverage: config.readingBridge)
        s.checkInHistory = [false, false, false, false, true, true]
        #expect(s.isGovernorActive)
        #expect(s.readiness(for: .reading) == .foundation && s.canOpen(.reading))

        // Master the rest of the base — coverage now clears the unlock bar.
        let base = Array(ConceptTaxonomy.baseConceptIds).sorted()
        for cid in base {
            let idx = s.concepts.firstIndex { $0.id == cid }!
            s.concepts[idx] = EngineFixtures.mastered(cid, category: s.concepts[idx].category,
                                                      level: s.concepts[idx].cefrLevel,
                                                      prerequisites: s.concepts[idx].prerequisites)
        }
        #expect(s.baseCoverage >= config.readingUnlock)
        #expect(s.readiness(for: .reading) == .foundation, "getting better never closes the bridge")
        #expect(s.canOpen(.reading), "the Read surface the learner had stays open")
        #expect(!s.canOpen(.listening), "higher modalities have no bridge — still held")

        // Once the governor releases, the bridge becomes a real unlock.
        s.checkInHistory = []
        #expect(s.readiness(for: .reading) == .unlocked)
    }

    @Test func readinessCopyNamesModalitiesNaturally() {
        #expect(ReadinessCopy.names(of: []) == "more activities")
        #expect(ReadinessCopy.names(of: [.listening]) == "Listening")
        #expect(ReadinessCopy.names(of: [.listening, .speaking]) == "Listening & Speaking")
        #expect(ReadinessCopy.names(of: [.listening, .speaking, .watching]) == "Listening, Speaking & Watching")
        #expect(ReadinessCopy.unlockHeadline(for: [.listening, .speaking]) == "\(config.higherDemonstratedMinutes) min of Reading unlocks Listening & Speaking")
        #expect(ReadinessCopy.minutesProgress(done: 8, bar: 15) == "8 of 15 min of Reading")
        #expect(ReadinessCopy.minutesProgress(done: 40, bar: 15) == "15 of 15 min of Reading", "clamped")
    }

    // MARK: The unlock path seeds the bridge slice once (D3, via refreshUnlocks)

    @Test func firstRecordedReadingUnlockSeedsTheBridgeOnce() {
        let s = store(coverage: config.readingUnlock)
        // Synthetic curriculum: one item per bridge concept, plus one base item.
        let bridge = FoundationSeeder.bridgeConceptIds
        let baseId = FoundationSeeder.baseConceptIds[0]
        s.foundationContent = { when in
            (bridge + [baseId]).map { EngineFixtures.gap("\($0)-item", concept: $0, due: when) }
        }
        #expect(s.unlockedModalities.isEmpty && !s.hasBridgeContent)

        s.refreshUnlocks(now: now)
        #expect(s.unlockedModalities.contains(LearningModality.reading.rawValue))
        #expect(s.hasBridgeContent, "the transition seeds the A2 bridge")
        let seeded = s.gaps.count
        #expect(seeded == bridge.count, "bridge concepts only — the base item is not part of the slice")

        // Not a transition any more: a later refresh (load, snapshot, lesson end) never re-seeds.
        s.refreshUnlocks(now: now)
        #expect(s.gaps.count == seeded)
    }

    // MARK: D9 — activity credit: foreground seconds only, capped per session

    @Test func activitySessionCountsForegroundTimeOnly() {
        var session = ActivitySession(modality: .reading, startedAt: now)
        #expect(session.isRunning)
        #expect(session.activeSeconds(at: now.addingTimeInterval(60)) == 60)

        session.pause(at: now.addingTimeInterval(60))        // went to background
        #expect(!session.isRunning)
        #expect(session.activeSeconds(at: now.addingTimeInterval(600)) == 60, "background time never accumulates")
        session.pause(at: now.addingTimeInterval(700))       // idempotent
        #expect(session.activeSeconds(at: now.addingTimeInterval(700)) == 60)

        session.resume(at: now.addingTimeInterval(900))      // back in the foreground
        session.resume(at: now.addingTimeInterval(950))      // idempotent
        #expect(session.activeSeconds(at: now.addingTimeInterval(960)) == 120)

        // A surface opened while not active starts paused.
        let paused = ActivitySession(modality: .listening, startedAt: now, inForeground: false)
        #expect(!paused.isRunning && paused.activeSeconds(at: now.addingTimeInterval(3600)) == 0)
        #expect(paused.modality == .listening)
    }

    @Test func creditRoundsCapsAndIgnoresGlances() {
        #expect(ActivityCredit.minutes(activeSeconds: Tuning.minActivitySeconds - 1, capMinutes: 10) == 0, "a glance credits nothing")
        #expect(ActivityCredit.minutes(activeSeconds: Tuning.minActivitySeconds, capMinutes: 10) == 1, "at least one minute once past the floor")
        #expect(ActivityCredit.minutes(activeSeconds: 150, capMinutes: 10) == 3, "rounded")
        #expect(ActivityCredit.minutes(activeSeconds: 3600, capMinutes: 10) == 10, "capped")
        #expect(ActivityCredit.minutes(activeSeconds: 3600, capMinutes: 0) == 0, "no target → no credit")

        #expect(ActivityCredit.capMinutes(planTargetMinutes: 10) == Int((10 * Tuning.activityCreditCapMultiplier).rounded(.up)))
        #expect(ActivityCredit.capMinutes(planTargetMinutes: 0) == 0)
        #expect(ActivityCredit.capMinutes(planTargetMinutes: 1) >= 1)
    }

    @Test func storeCapsOneSessionAtThePlanTargetTimesTheMultiplier() {
        let s = store(coverage: config.readingUnlock)
        s.preferences = UserPreferences(modalities: [.reading], timeBudget: .standard, daysPerWeekGoal: nil)
        let plan = s.todaysPlan(now: now)
        let target = plan.minuteItems.first { $0.modality == .reading }!.target
        #expect(s.planTargetMinutes(for: .reading, now: now) == target)
        let cap = ActivityCredit.capMinutes(planTargetMinutes: target)
        #expect(cap == Int((Double(target) * Tuning.activityCreditCapMultiplier).rounded(.up)))

        // An hour in the reading surface credits only the cap…
        #expect(s.creditActivity(.reading, activeSeconds: 3600, now: now) == cap)
        #expect(s.planProgress(for: DailyPlanItem(modality: .reading, targetMinutes: target), now: now) == cap)
        // …per session: a second session can add again (the cap is per session, not per day).
        #expect(s.creditActivity(.reading, activeSeconds: 3600, now: now) == cap)
        #expect(s.totalMinutes(.reading) == 2 * cap)
        // A glance credits nothing and records nothing.
        #expect(s.creditActivity(.reading, activeSeconds: 5, now: now) == 0)
        #expect(s.totalMinutes(.reading) == 2 * cap)
    }

    @Test func activityOutsideThePlanIsCappedByTheTimeBudget() {
        let s = store(coverage: config.readingUnlock)
        s.preferences = UserPreferences(modalities: [.reading], timeBudget: .light, daysPerWeekGoal: nil)
        s.recordActivityMinutes(.reading, minutes: config.higherDemonstratedMinutes, now: now)
        #expect(s.canOpen(.watching), "minutes opened the higher modalities")
        // Watching is open but not in the plan: the budget is its target.
        #expect(s.planTargetMinutes(for: .watching, now: now) == TimeBudget.light.minutes)
        let cap = ActivityCredit.capMinutes(planTargetMinutes: TimeBudget.light.minutes)
        #expect(s.creditActivity(.watching, activeSeconds: 7200, now: now) == cap)
    }

    @Test func unlockItemIsTheTargetForTheReadingSession() {
        let s = store(coverage: config.readingUnlock)
        s.preferences = UserPreferences(modalities: [.listening], timeBudget: .standard, daysPerWeekGoal: nil)
        let plan = s.todaysPlan(now: now)
        #expect(plan.unlockItem?.modality == .reading)
        #expect(s.planTargetMinutes(for: .reading, now: now) == config.higherDemonstratedMinutes)
    }

    @Test func meetingTheUnlockItemReplansTheDayAtOnce() {
        let s = store(coverage: config.readingUnlock)
        s.preferences = UserPreferences(modalities: [.listening], timeBudget: .standard, daysPerWeekGoal: nil)
        let bar = config.higherDemonstratedMinutes
        #expect(s.todaysPlan(now: now).unlockItem == .unlock(via: .reading, minutes: bar))

        // Short of the bar the plan of record keeps its unlock item.
        #expect(s.creditActivity(.reading, activeSeconds: TimeInterval((bar - 1) * 60), now: now) == bar - 1)
        #expect(s.dailyPlanOfRecord?.unlockItem != nil)
        #expect(!s.unlockedModalities.contains(LearningModality.listening.rawValue))

        // The session that crosses it re-plans the day: the unlock row is gone, the
        // chosen activity has its minutes row, and the open modality is recorded.
        #expect(s.creditActivity(.reading, activeSeconds: 60, now: now) == 1)
        #expect(s.totalMinutes(.reading) == bar)
        #expect(s.dailyPlanOfRecord?.unlockItem == nil)
        #expect(s.dailyPlanOfRecord?.minuteItems.map { $0.modality } == [.listening])
        #expect(s.unlockedModalities.contains(LearningModality.listening.rawValue))
        #expect(s.lockedChosenModalities.isEmpty)
    }

    // MARK: D19 — retention is never celebrated before any review

    @Test func retentionEvidenceNeedsAtLeastOneReviewedVisibleGap() {
        let s = EngineFixtures.store()
        #expect(!s.hasRetentionEvidence, "no gaps")
        s.gaps = [EngineFixtures.gap("seed", concept: "negation", due: now)]
        #expect(!s.hasRetentionEvidence, "a never-reviewed seed is not evidence")
        #expect(s.overallRetention(at: now) == 100 && s.gapHealth(at: now).label == "No reviews yet")
        var probe = EngineFixtures.gap("probe", concept: "negation", due: now, reviewCount: 1, lastReviewed: now)
        probe.isProbe = true
        s.gaps.append(probe)
        #expect(!s.hasRetentionEvidence, "probes never count")
        s.gaps.append(EngineFixtures.gap("reviewed", concept: "negation", due: now, reviewCount: 1, lastReviewed: now))
        #expect(s.hasRetentionEvidence)
    }

    // MARK: D12 / D19 — Home copy from real data

    @Test func levelBadgeReadsNotPlacedBeforePlacement() {
        #expect(HomeCopy.levelBadge(placed: false, level: .A2) == "Not placed")
        #expect(HomeCopy.levelBadge(placed: true, level: .B1) == "B1 · Studying")
        #expect(HomeCopy.placedLine(placed: false, assessedLevel: .A1) == nil)
        #expect(HomeCopy.placedLine(placed: true, assessedLevel: .A2) == "Placed at A2")

        let fresh = EngineFixtures.store()
        #expect(!fresh.hasCompletedAssessment, "a fresh store is not placed")
        #expect(HomeCopy.levelBadge(placed: fresh.hasCompletedAssessment, level: fresh.learnerLevel) == "Not placed")
    }

    @Test func subtitleNeverCelebratesAZeroStreak() {
        let zero = HomeCopy.subtitle(streak: 0, dueNow: 0, lessonsToday: 0, placed: true)
        #expect(zero == "No streak yet — one lesson starts it.")
        #expect(!zero.contains("0-day") && !zero.lowercased().contains("amazing"))
        #expect(HomeCopy.subtitle(streak: 0, dueNow: 4, lessonsToday: 0, placed: true) == "4 due now — a short lesson clears them.")
        // More due than one lesson holds → the day's lessons, not "a short lesson"
        // (the Foundation card right below reads "Lesson 1 of 3 today").
        #expect(HomeCopy.subtitle(streak: 0, dueNow: Tuning.lessonSize, lessonsToday: 0, placed: true)
                == "\(Tuning.lessonSize) due now — a short lesson clears them.")
        #expect(HomeCopy.subtitle(streak: 0, dueNow: Tuning.lessonSize + 1, lessonsToday: 0, placed: true)
                == "\(Tuning.lessonSize + 1) due now — today's lessons work through them.")
        #expect(!HomeCopy.subtitle(streak: 0, dueNow: 24, lessonsToday: 0, placed: true).contains("a short lesson clears"))
        #expect(HomeCopy.subtitle(streak: 0, dueNow: 4, lessonsToday: 1, placed: true) == "Good start today — tomorrow makes it a streak.")
        #expect(HomeCopy.subtitle(streak: 0, dueNow: 9, lessonsToday: 0, placed: false) == "Take the short placement to start your plan.")
        #expect(HomeCopy.subtitle(streak: 1, dueNow: 0, lessonsToday: 0, placed: true) == "Day 1 — a lesson today keeps it going.")
        #expect(HomeCopy.subtitle(streak: 2, dueNow: 0, lessonsToday: 2, placed: true) == "Day 2 done — see you tomorrow.")
        #expect(HomeCopy.subtitle(streak: Tuning.streakMomentumDays, dueNow: 0, lessonsToday: 0, placed: true)
                == "\(Tuning.streakMomentumDays) days in a row — nice momentum.")
        #expect(HomeCopy.subtitle(streak: Tuning.streakStrongDays, dueNow: 0, lessonsToday: 0, placed: true)
                == "\(Tuning.streakStrongDays)-day streak — keep it going!")
    }

    @Test func kiriMoodComesFromRealData() {
        #expect(HomeCopy.kiriMood(streak: 0, lessonsToday: 0) == .idle)
        #expect(HomeCopy.kiriMood(streak: 0, lessonsToday: 1) == .encouraging)
        #expect(HomeCopy.kiriMood(streak: 1, lessonsToday: 0) == .encouraging)
        #expect(HomeCopy.kiriMood(streak: Tuning.kiriHappyStreak, lessonsToday: 0) == .happy)
        #expect(HomeCopy.kiriMood(streak: Tuning.kiriCelebrationStreak, lessonsToday: 0) == .celebrating)
        #expect(Tuning.kiriCelebrationStreak >= 1 && Tuning.kiriHappyStreak >= 1, "never celebrate a zero streak")
    }

    @Test func lessonPaceReadsLessonNOfM() {
        #expect(HomeCopy.lessonPace(done: 0, target: 3) == "Lesson 1 of 3 today")
        #expect(HomeCopy.lessonPace(done: 1, target: 3) == "Lesson 2 of 3 today")
        #expect(HomeCopy.lessonPace(done: 3, target: 3) == "All 3 lessons done today — extra practice is welcome.")
        #expect(HomeCopy.lessonPace(done: 2, target: 1) == "Today's lesson is done — extra practice is welcome.")
        #expect(HomeCopy.gapsToReview(1) == "1 gap to review" && HomeCopy.gapsToReview(3) == "3 gaps to review")
        #expect(HomeCopy.captured(1) == "Saved 1 thing you didn't know")
        #expect(HomeCopy.dueNowLabel == "Due now" && HomeCopy.upcomingLabel == "Coming up")
    }

    // MARK: D10 (round 3) — the Foundation bar counts to the gate's finish line

    @Test func foundationProgressCountsToTheUnlockBarAndFillsExactlyWhenReadingOpens() {
        let s = EngineFixtures.store()
        let target = s.foundationUnlockTarget()
        #expect(target == Int((Double(s.foundationTotal) * config.readingUnlock).rounded(.up)))
        #expect(target < s.foundationTotal, "the track ends before every base concept is mastered")
        #expect(s.foundationProgress().done == 0 && s.foundationProgress().target == target)
        #expect(HomeCopy.foundationProgress(done: 0, target: target) == "0 of \(target) skills — reading opens here")
        // A full bar is only ever on screen while the governor holds the gate.
        #expect(HomeCopy.foundationProgress(done: target, target: target, governorHeld: true)
                == "\(target) of \(target) skills — consolidating before reading opens")
        #expect(HomeCopy.foundationProgress(done: target + 5, target: target) == "\(target) of \(target) skills — reading opens now")

        let base = Array(ConceptTaxonomy.baseConceptIds).sorted()
        func master(_ ids: ArraySlice<String>) {
            for cid in ids {
                let idx = s.concepts.firstIndex { $0.id == cid }!
                s.concepts[idx] = EngineFixtures.mastered(cid, category: s.concepts[idx].category,
                                                          level: s.concepts[idx].cefrLevel,
                                                          prerequisites: s.concepts[idx].prerequisites)
            }
        }
        master(base.prefix(target - 1))
        #expect(s.foundationProgress().done == target - 1)
        #expect(s.isInFoundation, "one short of the bar → the card is still on screen")

        // The last one fills the bar and opens reading in the same step: the goal
        // the learner was shown is a goal they actually reach.
        master(base[(target - 1)..<target])
        #expect(s.foundationProgress().done == target && s.foundationProgress().target == target)
        #expect(s.readiness(for: .reading) == .unlocked && !s.isInFoundation)
    }

    @Test func greetingFollowsTheClock() {
        #expect(HomeCopy.greeting(hour: 3) == "Bonne nuit")
        #expect(HomeCopy.greeting(hour: 9) == "Bonjour")
        #expect(HomeCopy.greeting(hour: 14) == "Bon après-midi")
        #expect(HomeCopy.greeting(hour: 21) == "Bonsoir")
    }
}
