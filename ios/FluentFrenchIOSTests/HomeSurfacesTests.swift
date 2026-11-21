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
        #expect(surfaces.hidesLockedEntries)
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

    @Test func outOfFoundationLockedEntriesShowWithTheirConditionAgain() {
        let s = EngineFixtures.store()
        s.unlockedModalities = [LearningModality.reading.rawValue]
        #expect(!s.isInFoundation)
        let surfaces = s.homeSurfaces
        #expect(!surfaces.hidesLockedEntries)
        #expect(!s.canOpen(.listening))
        #expect(surfaces.shows(.listening), "a placed, reading learner sees what is next, with its condition")
        #expect(surfaces.nextUnlock == nil)
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
        #expect(HomeCopy.deckCardStat(due: 4, showsDueCount: true)
                == "4 \(HomeCopy.dueNowLabel.lowercased())")
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
}
