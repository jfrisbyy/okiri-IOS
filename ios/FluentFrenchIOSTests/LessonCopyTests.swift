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
        #expect(LessonCopy.solidSummaryLabel == "Nailed this lesson")
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
