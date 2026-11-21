//
//  HomeSurfacesTests.swift
//  FluentFrenchIOSTests
//
//  The pre-beta UX decisions Home and onboarding render (docs/ux-review.md):
//  a Foundation learner's Home has no padlocks, only one "Next unlock" line
//  (UX-07); no "due now" before any card is reviewed and a first-lesson header
//  line (UX-15); preferences asked once, when Reading opens (UX-06); the
//  placement as the root screen, decided only after the reconcile (UX-14); and
//  the governor lines say what to do without promising more than the gate
//  holds (UX-25).
//

import Foundation
import Testing
@testable import FluentFrenchIOS

@MainActor
struct HomeSurfacesTests {
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

    // MARK: UX-07 — one "Next unlock" line instead of a wall of padlocks

    @Test func aFoundationLearnerSeesNoLockedEntryPoints() {
        let s = EngineFixtures.store()
        #expect(s.readiness(for: .reading) == .locked)
        let surfaces = s.homeSurfaces
        for m in LearningModality.allCases {
            #expect(!surfaces.shows(m), "\(m) is closed, so it is not on Home")
        }
        #expect(surfaces.shows(nil), "ungated entries (Learn, My words, the translator) always show")
        let (done, target) = s.foundationProgress()
        #expect(surfaces.nextUnlock == "Next unlock: Reading — \(done) of \(target) skills")
    }

    @Test func theBridgeShowsReadingAndNamesTheRestOfReadingAsNext() {
        let s = store(coverage: config.readingBridge)
        #expect(s.readiness(for: .reading) == .foundation && s.isInFoundation)
        let surfaces = s.homeSurfaces
        #expect(surfaces.shows(.reading), "the bridge is open: short pieces")
        #expect(!surfaces.shows(.listening) && !surfaces.shows(.speaking) && !surfaces.shows(.watching))
        let (done, target) = s.foundationProgress()
        #expect(surfaces.nextUnlock == "Next unlock: the rest of Reading — \(done) of \(target) skills")
    }

    /// Reading opening must not bring back a row of padlocks (four locked carousel
    /// cards and a locked Scenarios at once): what is still locked stays off Home,
    /// and ONE line names it, as in Foundation.
    @Test func afterFoundationLockedEntriesStayHiddenBehindOneLine() {
        let s = EngineFixtures.store()
        s.unlockedModalities = [LearningModality.reading.rawValue]
        #expect(!s.isInFoundation)
        #expect(s.preferences == nil, "the default preferences choose Reading, so the plan has open work")
        let surfaces = s.homeSurfaces
        #expect(surfaces.shows(.reading))
        for m in [LearningModality.listening, .speaking, .watching] {
            #expect(!s.canOpen(m))
            #expect(!surfaces.shows(m), "\(m) is still locked, so it stays off Home")
        }
        #expect(surfaces.nextUnlock
                == "Next unlock: Watching, Speaking & Listening — 0 of \(config.higherDemonstratedMinutes) min of Reading")
        #expect(surfaces.foundationFocusNote == nil, "the governor note belongs to the Foundation card")

        // Everything open: nothing to name.
        s.unlockedModalities = Set(LearningModality.allCases.map { $0.rawValue })
        #expect(s.homeSurfaces.nextUnlock == nil)
        #expect(LearningModality.allCases.allSatisfy { s.homeSurfaces.shows($0) })
    }

    /// The plan already names the way in when every chosen activity is locked (its
    /// "Start with Reading … opens X" row) or when the governor holds a chosen one
    /// (its rationale): a second line would say it twice.
    @Test func theNextUnlockLineStandsDownWhenThePlanAlreadyNamesIt() {
        let s = EngineFixtures.store()
        s.unlockedModalities = [LearningModality.reading.rawValue]
        s.setPreferences(UserPreferences(modalities: [.listening], timeBudget: .standard, daysPerWeekGoal: nil))
        #expect(DailyPlanEngine(store: s).makePlan(now: now).unlockItem != nil)
        #expect(s.homeSurfaces.nextUnlock == nil, "the plan's unlock row names it")

        s.setPreferences(UserPreferences(modalities: [.reading, .listening], timeBudget: .standard, daysPerWeekGoal: nil))
        #expect(s.homeSurfaces.nextUnlock != nil)
        s.checkInHistory = [false, false, false, false, true, true]
        #expect(s.isGovernorActive)
        #expect(DailyPlanEngine(store: s).makePlan(now: now).rationale
                == ReadinessCopy.governorHeadline(for: [.listening]))
        #expect(s.homeSurfaces.nextUnlock == nil, "the plan's governor headline names it")

        // Nothing locked was chosen: the plan names nothing, so the line does.
        s.setPreferences(UserPreferences(modalities: [.reading], timeBudget: .standard, daysPerWeekGoal: nil))
        let line = s.homeSurfaces.nextUnlock ?? ""
        #expect(line.hasPrefix("Next unlock: "))
        #expect(line.hasSuffix("review what you've learned before they open."))
        #expect(!line.contains("to open"), "review is required, not always enough")
    }

    @Test func theAfterReadingLineCountsMinutesAndAgreesInNumber() {
        let bar = config.higherDemonstratedMinutes
        #expect(ReadinessCopy.nextUnlockLine(lockedAfterReading: [], readingMinutes: 3, governorActive: false) == nil)
        #expect(ReadinessCopy.nextUnlockLine(lockedAfterReading: [.reading], readingMinutes: 3, governorActive: false) == nil,
                "Reading itself is never the next unlock once it is open")
        #expect(ReadinessCopy.nextUnlockLine(lockedAfterReading: [.listening, .speaking], readingMinutes: 8,
                                             governorActive: false)
                == "Next unlock: Listening & Speaking — 8 of \(bar) min of Reading")
        #expect(ReadinessCopy.nextUnlockLine(lockedAfterReading: [.watching], readingMinutes: bar + 40,
                                             governorActive: false)
                == "Next unlock: Watching — \(bar) of \(bar) min of Reading")
        #expect(ReadinessCopy.nextUnlockLine(lockedAfterReading: [.watching], readingMinutes: 0, governorActive: true)
                == "Next unlock: Watching — review what you've learned before it opens.")
    }

    // MARK: UX-25 — the Foundation card's governor line

    @Test func theFoundationFocusNoteShowsOnlyWhileTheGovernorIsActiveInFoundation() {
        let s = EngineFixtures.store()
        #expect(s.isInFoundation)
        #expect(s.homeSurfaces.foundationFocusNote == nil)
        s.checkInHistory = [false, false, false, false, true, true]
        #expect(s.isGovernorActive)
        #expect(s.homeSurfaces.foundationFocusNote == ReadinessCopy.governorConsolidating)
        // True in every governor state: the selector leans on review whenever the
        // governor is active; it promises nothing about what opens.
        #expect(!ReadinessCopy.governorConsolidating.contains("open"))
        #expect(ReadinessCopy.governorConsolidating.count < ReadinessCopy.governorHeadline(for: [.reading]).count)
    }

    @Test func theNextUnlockLineClampsAndIsNilOnceReadingIsOpen() {
        #expect(ReadinessCopy.nextUnlockLine(readingReadiness: .unlocked, done: 3, target: 12,
                                             readingHeldByGovernor: false) == nil)
        #expect(ReadinessCopy.nextUnlockLine(readingReadiness: .locked, done: 20, target: 12,
                                             readingHeldByGovernor: false)
                == "Next unlock: Reading — 12 of 12 skills")
        #expect(ReadinessCopy.nextUnlockLine(readingReadiness: .locked, done: -2, target: 0,
                                             readingHeldByGovernor: false)
                == "Next unlock: Reading — 0 of 1 skill")
    }

    // MARK: UX-15 — no "due now" on day one; the header names the first lesson

    @Test func theDueChipWaitsForAReviewedCard() {
        let fresh = EngineFixtures.gap("fresh", concept: nil)
        let s = EngineFixtures.store(concepts: [], gaps: [fresh])
        #expect(fresh.isNew)
        #expect(!s.homeSurfaces.showsDueCount, "a seeded, never-answered batch is not a backlog")

        var probe = EngineFixtures.gap("probe", concept: nil, reviewCount: 3)
        probe.isProbe = true
        s.gaps = [fresh, probe]
        #expect(!s.homeSurfaces.showsDueCount, "probes never count")

        let mastered = EngineFixtures.gap("done", concept: nil, reviewCount: 5, mastered: now)
        s.gaps = [fresh, mastered]
        #expect(s.homeSurfaces.showsDueCount, "a reviewed card counts even once mastered")

        s.gaps = [fresh, EngineFixtures.gap("seen", concept: nil, reviewCount: 1)]
        #expect(s.homeSurfaces.showsDueCount)
    }

    @Test func theFirstLessonIsPendingUntilALessonIsPlayed() {
        let s = EngineFixtures.store()
        #expect(s.homeSurfaces.firstLessonPending)
        s.completeLesson(targetConceptId: nil, isCapstone: false, now: now)
        #expect(!s.homeSurfaces.firstLessonPending)
    }

    @Test func theHeaderNamesTheFirstLessonInsteadOfADueBacklog() {
        let target = Tuning.foundationLessonsPerDay
        let first = HomeCopy.subtitle(streak: 0, dueNow: 20, lessonsToday: 0, lessonTarget: target,
                                      placed: true, firstLessonPending: true)
        #expect(first == "Your first lesson is ready — about \(Tuning.lessonEstimateMinutes) minutes.")
        #expect(!first.contains("due"))
        // Placement still comes first, and after the first lesson the old lines return.
        #expect(HomeCopy.subtitle(streak: 0, dueNow: 20, lessonsToday: 0, lessonTarget: target,
                                  placed: false, firstLessonPending: true)
                == "Take the short placement to start your plan.")
        #expect(HomeCopy.subtitle(streak: 0, dueNow: 4, lessonsToday: 0, lessonTarget: target,
                                  placed: true, firstLessonPending: false)
                == "4 due now — a short lesson clears them.")
        #expect(HomeCopy.masteredThisWeekUnit.contains("mastered"), "the chip names what it counts")
    }

    @Test func theDeckCardNamesNoDueBacklogBeforeAnyReview() {
        #expect(!HomeCopy.deckCardStat(due: 20, showsDueCount: false).contains("due"))
        #expect(HomeCopy.deckCardStat(due: 20, showsDueCount: false) == "20 words ready for your first lessons")
        #expect(HomeCopy.deckCardStat(due: 4, showsDueCount: true)
                == "4 \(HomeCopy.dueNowLabel.lowercased())")
    }

    /// Home's My words card, the deck it opens and the Learn card follow ONE rule:
    /// the deck says the same thing the card did, and nothing says "due".
    @Test func theDeckAgreesWithTheHomeCardBeforeAnyReview() {
        let s = EngineFixtures.store(concepts: [], gaps: [EngineFixtures.gap("fresh", concept: nil)])
        #expect(!s.showsDueCount)
        #expect(s.homeSurfaces.showsDueCount == s.showsDueCount)
        let due = 20
        let summary = HomeCopy.deckReviewSummary(due: due, upcoming: 3, showsDueCount: false)
        #expect(summary == HomeCopy.deckCardStat(due: due, showsDueCount: false))
        for line in [summary,
                     HomeCopy.deckQueueLabel(showsDueCount: false),
                     HomeCopy.deckReviewButton(due: due, showsDueCount: false),
                     HomeCopy.deckReviewHint(due: due, showsDueCount: false)] {
            #expect(!line.lowercased().contains("due"), "\(line)")
        }
        #expect(HomeCopy.firstWordsReady(1) == "1 word ready for your first lessons")
        #expect(HomeCopy.firstWordsReady(0) == "Nothing to review yet")

        // After a review the backlog wording returns everywhere.
        #expect(HomeCopy.deckQueueLabel(showsDueCount: true) == HomeCopy.dueNowLabel)
        #expect(HomeCopy.deckReviewSummary(due: 4, upcoming: 3, showsDueCount: true) == "4 due now · 3 coming up")
        #expect(HomeCopy.deckReviewButton(due: 4, showsDueCount: true) == "Review due now")
        #expect(HomeCopy.deckReviewButton(due: 0, showsDueCount: true) == "Review what's coming up")
    }

    // MARK: UX-15 — the Foundation call to action names a lesson never started as one

    @Test func theFoundationCallToActionSaysStartUntilALessonHasTaughtTheConcept() {
        #expect(HomeCopy.foundationLessonTitle(conceptName: "Greetings", started: false) == "Start: Greetings")
        #expect(HomeCopy.foundationLessonTitle(conceptName: "Greetings", started: true) == "Continue: Greetings")
        #expect(HomeCopy.foundationLessonTitle(conceptName: nil, started: true) == "Review the basics")
        #expect(HomeCopy.foundationLessonDetail(firstLessonPending: true) == "Tap to start your first lesson")

        let s = EngineFixtures.store()
        let concept = s.concepts[0]
        #expect(!s.hasStartedLesson(on: concept), "day one: no lesson has started")
        s.completeLesson(targetConceptId: concept.id, isCapstone: false, now: now)
        let taught = s.concepts.first { $0.id == concept.id }!
        #expect(s.hasStartedLesson(on: taught))
        let other = s.concepts.first { $0.id != concept.id && $0.lastTaughtSession == nil }!
        #expect(!s.hasStartedLesson(on: other), "a concept no lesson has taught is started, not continued")
    }

    // MARK: UX-06 — preferences asked once, when Reading opens

    @Test func preferencesAreAskedOnlyOnceReadingOpens() {
        let s = EngineFixtures.store()
        #expect(!s.shouldAskPreferences, "not placed yet")
        s.hasCompletedAssessment = true
        #expect(s.isInFoundation)
        #expect(!s.shouldAskPreferences, "Foundation keeps the defaults: the choices change nothing yet")
        #expect(DailyPlanEngine(store: s).makePlan(now: now).isLessonPaced, "the Foundation day runs on defaults")

        s.unlockedModalities = [LearningModality.reading.rawValue]
        #expect(s.shouldAskPreferences, "Reading opened: ask now")
        #expect(HomeCopy.preferencesAskIntro == "You've unlocked Reading — how do you want to spend your time?")

        s.beginLesson()
        #expect(!s.shouldAskPreferences, "held while the lesson that opened Reading is still on screen")
        s.endLesson()
        #expect(s.shouldAskPreferences)

        s.setPreferences(UserPreferences(modalities: [.reading], timeBudget: .standard, daysPerWeekGoal: nil))
        #expect(!s.shouldAskPreferences, "asked once: the saved answer is the persisted record")
    }

    /// The cover never rises over a sheet or cover Home already has up: the ask
    /// waits for it to close.
    @Test func preferencesWaitForHomesOwnPresentationToClose() {
        let s = EngineFixtures.store()
        s.hasCompletedAssessment = true
        s.unlockedModalities = [LearningModality.reading.rawValue]
        #expect(s.shouldAskPreferences)
        s.setHomePresenting(true)
        #expect(!s.shouldAskPreferences, "a profile sheet, section or resource is on screen")
        s.setHomePresenting(false)
        #expect(s.shouldAskPreferences)
    }

    /// "You've unlocked Reading" is only true for a learner who got there through
    /// lessons; one whose Reading is open before any lesson hears that their level
    /// opens it.
    @Test func thePreferencesIntroMatchesHowReadingOpened() {
        let s = EngineFixtures.store()
        s.hasCompletedAssessment = true
        s.unlockedModalities = [LearningModality.reading.rawValue]
        #expect(s.isFirstLessonPending)
        #expect(s.preferencesAskIntro == HomeCopy.preferencesPlacedIntro)
        #expect(!s.preferencesAskIntro.contains("unlocked"))
        #expect(s.preferencesAskIntro.contains("Reading"))

        s.completeLesson(targetConceptId: nil, isCapstone: false, now: now)
        #expect(s.preferencesAskIntro == HomeCopy.preferencesAskIntro)
    }

    // MARK: UX-14 — the placement is the root screen, decided after the reconcile

    @Test func thePlacementWaitsForTheReconcileAndThenStaysUp() {
        let s = EngineFixtures.store()
        #expect(s.showsFirstRunPlacement(reconciling: false, alreadyShowing: false))
        #expect(!s.showsFirstRunPlacement(reconciling: true, alreadyShowing: false),
                "never decided while the account may say the learner already placed")
        #expect(s.showsFirstRunPlacement(reconciling: true, alreadyShowing: true),
                "a reconcile starting mid-placement does not pull Home in under the learner")

        s.hasCompletedAssessment = true
        #expect(!s.showsFirstRunPlacement(reconciling: false, alreadyShowing: true),
                "a placed record (this device or a reconciled one) ends it")
    }

    // MARK: UX-25 — the governor lines say what to do, and never over-promise

    @Test func theGovernorLinesNameTheActionWithoutClaimingItIsEnough() {
        let listening = ReadinessCopy.governorCondition(for: .listening)
        #expect(listening == "Review what you've learned before Listening opens — today's lessons focus on that.")
        #expect(!listening.contains("Consolidating"))
        // "before X opens", never "to open X": the Reading minutes can still be due.
        #expect(!listening.contains("to open"))

        #expect(ReadinessCopy.governorHeadline(for: [.reading])
                == "Review what you've learned before Reading opens — today's lessons focus on that.")
        #expect(ReadinessCopy.governorHeadline(for: [.listening, .speaking])
                == "Review what you've learned before Listening & Speaking open — today's lessons focus on that.")
        #expect(!ReadinessCopy.governorConsolidating.contains("Consolidating"))
        #expect(!ReadinessCopy.governorBridgeCondition.contains("Consolidating"))
    }

    /// The governor holds Listening even while the Reading minutes are not in: the
    /// line must not read as if reviewing alone opened it.
    @Test func theGovernorLineStaysTrueWhenTheMinutesAlsoHoldTheGate() {
        let s = EngineFixtures.store()
        s.unlockedModalities = [LearningModality.reading.rawValue]
        s.checkInHistory = [false, false, false, false, true, true]
        #expect(s.isGovernorActive)
        #expect(s.totalMinutes(.reading) < config.higherDemonstratedMinutes)
        let line = s.unlockCondition(for: .listening) ?? ""
        #expect(line.contains("before Listening opens"))
        #expect(!line.contains("to open"))
    }

    /// UX-26: Profile's foot names the version and build from the bundle, and
    /// never prints a placeholder when the bundle has none.
    @Test func theVersionLineComesFromTheBundle() {
        #expect(AppVersion.line(info: ["CFBundleShortVersionString": "1.2", "CFBundleVersion": "34"])
                == "Version 1.2 (34)")
        #expect(AppVersion.line(info: ["CFBundleShortVersionString": "1.2"]) == "Version 1.2")
        #expect(AppVersion.line(info: ["CFBundleShortVersionString": " 1.2 ", "CFBundleVersion": "  "])
                == "Version 1.2", "blank build is left out")
        #expect(AppVersion.line(info: ["CFBundleVersion": "34"]) == nil, "no version: no line")
        #expect(AppVersion.line(info: ["CFBundleShortVersionString": ""]) == nil)
        #expect(AppVersion.line(info: nil) == nil)
    }
}
