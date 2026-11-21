//
//  LessonCopyTests.swift
//  FluentFrenchIOSTests
//
//  The lesson wording rules (UX-04 / UX-13 / UX-05), the completion screen's day
//  numbers read off the same data Home uses (`AppStore.nextLessonOffer`), and the
//  accent key row's insertion (UX-21).
//

import Foundation
import Testing
@testable import FluentFrenchIOS

@MainActor
struct LessonCopyTests {
    private let now = EngineFixtures.now
    private let day = EngineFixtures.day

    private func offer(done: Int, target: Int = 3, counted: Bool = true, streak: Int = 0,
                       practised: Bool = false, ticked: Bool = false, next: Bool = false) -> NextLessonOffer {
        NextLessonOffer(lessonsToday: done, target: target, counted: counted, streak: streak,
                        practisedToday: practised, streakTickedThisLesson: ticked, nextAvailable: next)
    }

    // MARK: UX-04 — "Mastered" is kept for real mastery

    @Test func inSessionProgressNeverSaysMastered() {
        #expect(LessonCopy.solidFlashTitle == "Got it!")
        #expect(LessonCopy.solidSummaryLabel == "Solid this lesson")
        #expect(LessonCopy.solidProgress(solid: 3, of: 7) == "3/7 solid")
        #expect(LessonCopy.solidProgress(solid: 2, of: 0) == "2 solid")
        #expect(LessonCopy.solidProgressSpoken(solid: 3, of: 7) == "3 of 7 solid")
        #expect(LessonCopy.solidProgressSpoken(solid: 0, of: 0) == "0 solid")
        let lines = [
            LessonCopy.solidFlashTitle, LessonCopy.solidSummaryLabel,
            LessonCopy.solidProgress(solid: 1, of: 4), LessonCopy.solidProgressSpoken(solid: 1, of: 4),
            LessonCopy.introSubtitle(itemCount: 5, isCapstone: false),
            LessonCopy.introSubtitle(itemCount: 1, isCapstone: true),
        ]
        for line in lines {
            #expect(!line.lowercased().contains("master"), "\(line)")
        }
        #expect(LessonCopy.introSubtitle(itemCount: 1, isCapstone: false)
                == "1 item · answer an item right \(Tuning.masteryTarget)× to make it solid.")
    }

    // MARK: UX-20 — a short hearts note that stays true to the session

    @Test func heartsNoteIsShortAndTrueToTheSession() {
        let note = LessonCopy.heartsNote(hearts: Tuning.lessonHearts)
        #expect(note == "\(Tuning.lessonHearts) hearts: a miss costs one, a retry is free. At zero, you'll see what slipped.")
        #expect(note.split(separator: ".").filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }.count <= 2,
                "one or two sentences")
        // The claims it makes are the engine's.
        #expect(Tuning.lessonHearts > 0)
        #expect(!Tuning.remedialMissCostsHeart, "a retry is free")
        #expect(!Tuning.capstoneHasHearts, "the capstone note says it runs without hearts")
        #expect(LessonCopy.capstoneHeartsNote.hasPrefix("No hearts"))
    }

    // MARK: UX-13 — at most one learner-facing pill

    @Test func oneStatusPillWordedForTheLearner() {
        func pill(_ remedial: Bool = false, _ probe: Bool = false, _ checkIn: Bool = false,
                  _ capstone: Bool = false) -> LessonPill? {
            LessonCopy.statusPill(isRemedial: remedial, isProbe: probe, isCheckIn: checkIn, isCapstone: capstone)
        }
        #expect(pill() == nil, "an ordinary question carries no status pill")
        #expect(pill(true) == .tryAgain)
        #expect(pill(false, true) == .quickCheck)
        #expect(pill(false, false, true) == .quickCheck)
        #expect(pill(false, true, true) == .quickCheck, "a check-in riding a probe is one pill")
        #expect(pill(true, true, true) == .tryAgain, "a remedial leads")
        #expect(pill(false, false, false, true) == .capstone)
        #expect(LessonPill.tryAgain.text == "Try again")
        #expect(LessonPill.quickCheck.text == "Quick check")
        let engineWords = ["blind-spot", "check-in", "tuned", "probe"]
        for p in [LessonPill.tryAgain, .quickCheck, .capstone] {
            for word in engineWords { #expect(!p.text.lowercased().contains(word)) }
        }
    }

    // MARK: UX-05 — the completion screen continues the day

    @Test func dayLineReadsWhereTheDayStands() {
        #expect(LessonCopy.dayLine(offer(done: 1)) == "Lesson 1 of 3 done")
        #expect(LessonCopy.dayLine(offer(done: 2)) == "Lesson 2 of 3 done")
        #expect(LessonCopy.dayLine(offer(done: 3)) == "Today's 3 lessons done")
        #expect(LessonCopy.dayLine(offer(done: 1, target: 1)) == "Today's lesson done")
        #expect(LessonCopy.dayLine(offer(done: 4)) == "4 lessons today — 3 was the goal")
        // A lesson that did not count never claims a number of its own.
        #expect(LessonCopy.dayLine(offer(done: 0, counted: false)) == "0 of 3 lessons done today")
        #expect(LessonCopy.dayLine(offer(done: 1, counted: false)) == "1 of 3 lessons done today")
    }

    @Test func streakLineNamesTheStreakOnlyWhenTodayCounts() {
        #expect(LessonCopy.streakLine(offer(done: 1)) == nil, "zero is never celebrated")
        #expect(LessonCopy.streakLine(offer(done: 1, streak: 4, practised: false)) == nil,
                "a streak today has not extended yet is not claimed")
        #expect(LessonCopy.streakLine(offer(done: 1, streak: 1, practised: true, ticked: true)) == "Day 1 streak started")
        #expect(LessonCopy.streakLine(offer(done: 2, streak: 1, practised: true, ticked: false)) == "Day 1 streak")
        #expect(LessonCopy.streakLine(offer(done: 1, streak: 5, practised: true, ticked: true)) == "Day 5 streak")
        #expect(offer(done: 1, streak: 5, practised: true, ticked: true).celebrates)
        #expect(!offer(done: 2, streak: 5, practised: true, ticked: false).celebrates)
        #expect(LessonCopy.spokenSummary(offer(done: 1, streak: 1, practised: true, ticked: true))
                == "Lesson 1 of 3 done, Day 1 streak started")
    }

    @Test func offerReadsTheSameNumbersHomeShows() {
        let s = EngineFixtures.smallGraph().store
        let practisedBefore = s.practisedOn(now)
        #expect(!practisedBefore)
        // A correct answer adds today to the streak, then the lesson is booked.
        s.recordReview(gapId: "frontier-0", correct: true, now: now)
        s.completeLesson(targetConceptId: nil, isCapstone: false, now: now)

        let o = s.nextLessonOffer(counted: true, practisedBeforeLesson: practisedBefore, now: now)
        // Home's greeting and Foundation card read the plan of record's lesson item.
        #expect(o.target == (s.todaysPlan(now: now).lessonItem?.target ?? Tuning.foundationLessonsPerDay))
        #expect(o.target == s.todaysLessonTarget(now: now))
        #expect(o.lessonsToday == s.lessonsCompleted(on: now))
        #expect(o.lessonsToday == 1)
        #expect(o.streak == s.currentStreak(now: now))
        #expect(o.streak == 1)
        #expect(o.streakTickedThisLesson && o.celebrates)
        #expect(o.nextAvailable, "the day has lessons to go and the selector has something to teach")
        #expect(LessonCopy.dayLine(o) == "Lesson 1 of \(o.target) done")
        #expect(LessonCopy.streakLine(o) == "Day 1 streak started")

        // A second lesson the same day: the streak did not tick again.
        let again = s.nextLessonOffer(counted: true, practisedBeforeLesson: s.practisedOn(now), now: now)
        #expect(!again.streakTickedThisLesson && !again.celebrates)
    }

    @Test func offerContinuesAnExistingStreakAndStopsAtTheTarget() {
        let s = EngineFixtures.smallGraph().store
        s.masteryDays = [s.dayKey(now.addingTimeInterval(-day)), s.dayKey(now.addingTimeInterval(-2 * day))]
        s.recordReview(gapId: "frontier-0", correct: true, now: now)
        let target = s.todaysLessonTarget(now: now)
        for _ in 0..<target {
            s.completeLesson(targetConceptId: nil, isCapstone: false, now: now)
        }
        let o = s.nextLessonOffer(counted: true, practisedBeforeLesson: false, now: now)
        #expect(o.streak == 3)
        #expect(LessonCopy.streakLine(o) == "Day 3 streak")
        #expect(o.lessonsToday == target)
        #expect(!o.nextAvailable, "the day's target is met: Done leads")
    }

    @Test func noNextLessonWhenTheSelectorHasNothing() {
        var resting = EngineFixtures.mastered("done")
        resting.nextCheckInAt = now.addingTimeInterval(30 * day)
        resting.checkInIntervalDays = Tuning.checkInInitialDays
        let s = EngineFixtures.store(concepts: [resting], gaps: [])
        let o = s.nextLessonOffer(counted: false, practisedBeforeLesson: false, now: now)
        #expect(o.lessonsToday == 0)
        #expect(!o.nextAvailable)
        #expect(LessonCopy.streakLine(o) == nil)
    }

    // MARK: Completion buttons — out of hearts, and a "Next lesson" that came back empty

    private func actions(outOfHearts: Bool = false, missed: Bool = true, practiceExhausted: Bool = false,
                         next: Bool = true, nextExhausted: Bool = false) -> LessonCompletionActions {
        LessonCompletionActions.resolve(outOfHearts: outOfHearts, hasMissed: missed,
                                        practiceExhausted: practiceExhausted,
                                        nextAvailable: next, nextExhausted: nextExhausted)
    }

    @Test func outOfHeartsLeadsWithPracticeTheseNow() {
        let a = actions(outOfHearts: true)
        #expect(a.lead == .practiceMissed)
        #expect(a.offersNextLesson, "Next lesson stays on offer, as a secondary button")
        #expect(!a.practiceInMissedCard, "the missed card does not offer the lead a second time")
        #expect(a.nextLessonNote == nil)

        // Nothing missed (or the follow-up already came back empty): nothing to practise.
        #expect(actions(outOfHearts: true, missed: false).lead == .nextLesson)
        #expect(actions(outOfHearts: true, practiceExhausted: true).lead == .nextLesson)
        #expect(!actions(outOfHearts: true, practiceExhausted: true).practiceInMissedCard)
        #expect(actions(outOfHearts: true, missed: false, next: false).lead == .done)
    }

    /// The out-of-hearts recap's way out is plain text, never a second tinted
    /// button identical to "Next lesson" (UX re-review 3).
    @Test func doneIsDrawnSoItNeverLooksLikeNextLesson() {
        let hearts = actions(outOfHearts: true)
        #expect(hearts.lead == .practiceMissed && hearts.offersNextLesson)
        #expect(hearts.doneStyle == .plain, "two filled buttons lead: Done is a plain text action")
        #expect(actions(outOfHearts: true, next: false).doneStyle == .plain)
        #expect(actions().doneStyle == .secondary, "under Next lesson, Done is the tinted secondary")
        #expect(actions(next: false).doneStyle == .primary, "nothing else leads: Done is the lead")
        #expect(actions(outOfHearts: true, missed: false, next: false).doneStyle == .primary)
    }

    /// An empty out-of-hearts "Practice these now" says why next to the bottom
    /// buttons, where the learner tapped; a finished lesson's card button keeps its
    /// notice in the card (UX re-review 3).
    @Test func anEmptyPracticeLeadLeavesItsNoticeByTheButtons() {
        #expect(!actions(outOfHearts: true).practiceNoticeByButtons, "nothing came back empty yet")
        let emptied = actions(outOfHearts: true, practiceExhausted: true)
        #expect(emptied.practiceNoticeByButtons)
        #expect(emptied.lead == .nextLesson, "the emptied lead hands over to Next lesson")
        #expect(emptied.doneStyle == .secondary)
        #expect(!actions(practiceExhausted: true).practiceNoticeByButtons,
                "a finished lesson's practice button lives in the missed card, and so does its notice")
        #expect(!actions(outOfHearts: true, missed: false, practiceExhausted: true).practiceNoticeByButtons)
    }

    @Test func aFinishedLessonKeepsNextLessonInFront() {
        let a = actions()
        #expect(a.lead == .nextLesson)
        #expect(a.practiceInMissedCard, "a finished lesson keeps Practice these now in the missed card")
        #expect(actions(next: false).lead == .done)
        #expect(!actions(next: false).offersNextLesson)
    }

    @Test func anEmptyNextLessonIsWithdrawnWithALine() {
        let a = actions(nextExhausted: true)
        #expect(a.lead == .done, "a tap that did nothing is not offered again")
        #expect(!a.offersNextLesson)
        #expect(a.nextLessonNote == LessonCopy.nextLessonExhausted)
        let hearts = actions(outOfHearts: true, nextExhausted: true)
        #expect(hearts.lead == .practiceMissed && !hearts.offersNextLesson)
        #expect(hearts.nextLessonNote == LessonCopy.nextLessonExhausted)
        #expect(LessonCopy.practiceMissedButton == "Practice these now")
    }

    /// The line's claim matches what `.empty` means for "Next lesson": the Smart
    /// selector has nothing practicable now, and what is resting comes due later.
    @Test func emptyNextLessonMeansNothingPracticableRightNow() {
        var resting = EngineFixtures.mastered("done")
        resting.nextCheckInAt = now.addingTimeInterval(30 * day)
        resting.checkInIntervalDays = Tuning.checkInInitialDays
        let s = EngineFixtures.store(concepts: [resting], gaps: [])
        let outcome = LessonPipeline(store: s).outcome(for: .smart(now: now))
        #expect(outcome.lesson == nil)
        #expect(outcome.emptyHeadline == "Nothing to practice right now.")
        #expect(LessonCopy.nextLessonExhausted == "That's everything for now — come back later for more.")
    }

    // MARK: One flame — the day streak; the answer run is "in a row"

    @Test func theAnswerRunIsNeverCalledAStreak() {
        #expect(LessonCopy.bestRunLabel == "Best run")
        #expect(LessonCopy.bestRunValue(4) == "4 in a row")
        #expect(LessonCopy.runChipLabel == "in a row")
        #expect(LessonCopy.personalBestLine(accuracyPercent: 85, bestRun: 6)
                == "85% first-try accuracy · best run 6 in a row")
        #expect(!LessonCopy.runSymbol.contains("flame"), "the flame is the day streak's")
        let lines = [LessonCopy.bestRunLabel, LessonCopy.bestRunValue(2), LessonCopy.runChipLabel,
                     LessonCopy.personalBestLine(accuracyPercent: 50, bestRun: 2)]
        for line in lines { #expect(!line.lowercased().contains("streak"), "\(line)") }
    }

    // MARK: UX-13 — "Quick check" everywhere the learner reads it

    @Test func checkInsReadAsQuickChecks() {
        #expect(LessonCopy.quickCheckHeadline == "Today: quick checks — making sure what you've learned still holds.")
        #expect(LessonCopy.quickCheckReason(conceptName: "Greetings") == "Quick check: does Greetings still hold?")
        for line in [LessonCopy.quickCheckHeadline, LessonCopy.quickCheckReason(conceptName: "X"),
                     LessonCopy.placementCheckReason(conceptName: "X")] {
            #expect(!line.lowercased().contains("check-in"))
            #expect(!line.lowercased().contains("verif"), "learner copy, not engine words")
            #expect(!line.lowercased().contains("placement"), "the learner knows it as the level check")
        }
        #expect(LessonCopy.placementCheckReason(conceptName: "Greetings")
                == "Checking what your level check found: Greetings.")
    }

    /// UX re-review 3: a "Quick check" pill over "Quick check: does X still hold?"
    /// said it twice, so the header drops the line; a reason that adds something
    /// stays, and a line with no pill above it is never dropped.
    @Test func theReasonLineIsDroppedWhenThePillAlreadySaysIt() {
        let checkIn = LessonCopy.quickCheckReason(conceptName: "Greetings")
        #expect(LessonCopy.questionReasonLine(checkIn, pill: .quickCheck) == nil)
        #expect(LessonCopy.questionReasonLine(checkIn, pill: nil) == checkIn, "no pill: the line is the only signal")
        let placement = LessonCopy.placementCheckReason(conceptName: "Greetings")
        #expect(LessonCopy.questionReasonLine(placement, pill: .quickCheck) == placement)
        let probe = "Quick check on a skill you haven't met yet: Greetings."
        #expect(LessonCopy.questionReasonLine(probe, pill: .quickCheck) == probe, "it adds 'not met yet'")
        #expect(LessonCopy.questionReasonLine(checkIn, pill: .tryAgain) == checkIn)
        #expect(LessonCopy.questionReasonLine(nil, pill: .quickCheck) == nil)
    }

    // MARK: UX-21 — accent keys

    @Test func accentKeysAreLowercaseFrenchLetters() {
        let keys = FrenchAccentKeys.characters
        #expect(keys == ["é", "è", "ê", "ë", "à", "â", "ç", "ù", "û", "ô", "î", "ï", "œ"])
        #expect(Set(keys).count == keys.count)
        for k in keys { #expect(k.count == 1 && k == k.lowercased()) }
    }

    @Test func accentInsertsAtTheCursorOrReplacesTheSelection() {
        let text = "cafe"
        // A cursor between "caf" and "e" types the key there.
        let mid = text.index(text.startIndex, offsetBy: 3)
        let atCursor = FrenchAccentKeys.insert("é", into: text, replacing: mid..<mid)
        #expect(atCursor.text == "cafée")
        #expect(atCursor.cursorOffset == 4)

        // Selecting the plain "e" and tapping "é" replaces it.
        let replaced = FrenchAccentKeys.insert("é", into: text, replacing: mid..<text.endIndex)
        #expect(replaced.text == "café")
        #expect(replaced.cursorOffset == 4)

        // At the start.
        let start = FrenchAccentKeys.insert("à", into: "la", replacing: "la".startIndex..<"la".startIndex)
        #expect(start.text == "àla" && start.cursorOffset == 1)

        // No selection known: append.
        let appended = FrenchAccentKeys.insert("ç", into: "gar", replacing: nil)
        #expect(appended.text == "garç" && appended.cursorOffset == 4)

        let empty = FrenchAccentKeys.insert("œ", into: "", replacing: nil)
        #expect(empty.text == "œ" && empty.cursorOffset == 1)
    }
}
