//
//  FSRSTests.swift
//  FluentFrenchIOSTests
//
//  Package B1 / B2 — the memory model: a lapse always comes back sooner than a
//  hit (multiplicative, monotone), grades order the next interval, and difficulty
//  eases on repeated good answers instead of ratcheting up forever.
//

import Foundation
import Testing
@testable import FluentFrenchIOS

@MainActor
struct FSRSTests {
    private let now = EngineFixtures.now
    private let day = EngineFixtures.day

    /// Days until the next review as scheduled from the review that produced `state`.
    private func intervalDays(_ state: FsrsState) -> Double {
        state.dueAt.timeIntervalSince(state.lastReviewAt ?? now) / day
    }

    // MARK: B1 — lapse

    @Test func aMissOnAFreshGoodCardComesBackSoonerThanAHit() {
        let fresh = FSRS.makeInitialState(grade: .good, now: now)
        let later = now.addingTimeInterval(2 * day)
        let missed = FSRS.review(state: fresh, grade: .again, now: later)
        let hit = FSRS.review(state: fresh, grade: .good, now: later)

        #expect(missed.stability < fresh.stability, "a lapse strictly lowers stability")
        #expect(hit.stability > fresh.stability, "a success strictly raises it")
        #expect(intervalDays(missed) < intervalDays(hit))
        #expect(missed.dueAt < hit.dueAt)
        #expect(missed.lapses == 1 && hit.lapses == 0)
        #expect(missed.reps == 2 && hit.reps == 2)
        #expect(missed.difficulty > hit.difficulty)
    }

    @Test func gradesOrderTheNextInterval() {
        let fresh = FSRS.makeInitialState(grade: .good, now: now)
        let later = now.addingTimeInterval(3 * day)
        let grades: [ReviewGrade] = [.again, .hard, .good, .easy]
        let states = grades.map { FSRS.review(state: fresh, grade: $0, now: later) }
        let intervals = states.map { intervalDays($0) }
        let stabilities = states.map { $0.stability }
        for i in 1..<grades.count {
            #expect(intervals[i - 1] < intervals[i], "\(grades[i - 1]) must schedule sooner than \(grades[i])")
            #expect(stabilities[i - 1] < stabilities[i])
        }
        // The initial states keep the same order.
        let initial = grades.map { FSRS.makeInitialState(grade: $0, now: now) }
        for i in 1..<grades.count {
            #expect(intervalDays(initial[i - 1]) <= intervalDays(initial[i]))
        }
    }

    @Test func lapseIsMultiplicativeAndMonotoneAcrossTheWholeRange() {
        for stability in [0.5, 2.0, 7.0, 30.0, 120.0, 400.0] {
            for difficulty in [1.0, 3.0, 5.0, 8.0, 10.0] {
                for r in [0.2, 0.6, 0.9, 1.0] {
                    let s = FSRS.lapseStability(difficulty: difficulty, stability: stability, retrievability: r)
                    #expect(s < stability, "S=\(stability) D=\(difficulty) R=\(r): lapse must shorten")
                    #expect(s <= stability * Tuning.fsrsLapseMaxRatio + 1e-9, "capped below the previous stability")
                    #expect(s >= Tuning.fsrsMinStability)
                }
            }
        }
        // Harder cards lose more; a lapse at low recall (the expected outcome) keeps
        // more. Read below `Tuning.fsrsPostLapseMaxDays`, where the shaping is what
        // decides the interval rather than the absolute ceiling.
        let short = Tuning.fsrsPostLapseMaxDays / 2
        let easyCard = FSRS.lapseStability(difficulty: 2, stability: short, retrievability: 0.9)
        let hardCard = FSRS.lapseStability(difficulty: 9, stability: short, retrievability: 0.9)
        #expect(hardCard < easyCard)
        let expected = FSRS.lapseStability(difficulty: 5, stability: short, retrievability: 0.3)
        let surprising = FSRS.lapseStability(difficulty: 5, stability: short, retrievability: 0.99)
        #expect(surprising < expected)
        #expect(Tuning.fsrsLapseMaxRatio < 1 && Tuning.fsrsLapseFactorBase < Tuning.fsrsLapseMaxRatio)
    }

    /// engine-8-2: the lapse is a FRACTION of the old stability, so without an
    /// absolute bound a card drilled past ~10 reviews came back months later — and
    /// nothing else recovers it: it is not due, `ConceptSelector.isReviewCandidate`
    /// wants `nextReviewAt` inside the due window, and `weakestFirst` ranks it last
    /// because its recall probability is still ~0.99 for weeks.
    @Test func aForgottenCardCanNeverHideBeyondThePostLapseCeiling() {
        // Drill the card the way a real learner would: answer it correctly every
        // time it falls due until its interval is measured in months.
        var state = FSRS.makeInitialState(grade: .good, now: now)
        var clock = now
        for _ in 0..<10 {
            clock = state.dueAt
            state = FSRS.review(state: state, grade: .good, now: clock)
        }
        #expect(intervalDays(state) > 60, "the card is over-learned (interval \(intervalDays(state)) d)")

        clock = state.dueAt
        let lapsed = FSRS.review(state: state, grade: .again, now: clock)
        #expect(lapsed.stability <= Tuning.fsrsPostLapseMaxDays + 1e-9,
                "post-lapse stability \(lapsed.stability) d escaped the ceiling")
        #expect(intervalDays(lapsed) <= Tuning.fsrsPostLapseMaxDays + 1e-9,
                "a forgotten card must come back inside \(Tuning.fsrsPostLapseMaxDays) days, not \(intervalDays(lapsed))")
        // The ceiling only ever shortens: the lapse is still strictly sooner than
        // the success it replaced, at every stability.
        for stability in [0.5, 2.0, 7.0, 30.0, 120.0, 400.0] {
            let s = FSRS.lapseStability(difficulty: 5, stability: stability, retrievability: 0.9)
            #expect(s < stability)
            #expect(s <= Tuning.fsrsPostLapseMaxDays + 1e-9)
        }
    }

    @Test func aMatureCardMissedAtItsDueDateIsRescheduledWellInsideItsOldInterval() {
        // Regression for B1: the old lapse formula clamped to ≈7 d and could not
        // bring a mature card back sooner than a success would have.
        var state = FSRS.makeInitialState(grade: .good, now: now)
        var clock = now
        for _ in 0..<4 {
            clock = state.dueAt
            state = FSRS.review(state: state, grade: .good, now: clock)
        }
        let mature = intervalDays(state)
        #expect(mature > 7, "the card is mature (interval \(mature) d)")

        clock = state.dueAt
        let lapsed = FSRS.review(state: state, grade: .again, now: clock)
        let succeeded = FSRS.review(state: state, grade: .good, now: clock)
        #expect(intervalDays(lapsed) < mature)
        #expect(intervalDays(lapsed) <= mature * Tuning.fsrsLapseMaxRatio + 1e-9)
        #expect(intervalDays(lapsed) < intervalDays(succeeded))
        #expect(FSRS.retrievability(state: lapsed, now: lapsed.dueAt) >= FSRS.retrievability(state: succeeded, now: succeeded.dueAt) - 1e-9,
                "both are scheduled at the same target recall; the lapsed card just gets there sooner")
    }

    // MARK: B2 — difficulty

    @Test func difficultyEasesOverRepeatedGoodAnswers() {
        // A card that started with a miss sits above neutral difficulty.
        var state = FSRS.makeInitialState(grade: .again, now: now)
        let start = state.difficulty
        #expect(start > Tuning.fsrsNeutralDifficulty)

        var previous = start
        var clock = now
        for _ in 0..<10 {
            clock = state.dueAt
            state = FSRS.review(state: state, grade: .good, now: clock)
            #expect(state.difficulty < previous, "each .good eases the card")
            previous = state.difficulty
        }
        #expect(state.difficulty < start)
        #expect(state.difficulty > Tuning.fsrsDifficultyMeanReversion, "it approaches the target without overshooting")
        #expect(state.lapses == 1)
    }

    @Test func difficultyStillStepsUpOnLapsesAndDownOnEasy() {
        let fresh = FSRS.makeInitialState(grade: .good, now: now)
        let later = now.addingTimeInterval(day)
        let again = FSRS.review(state: fresh, grade: .again, now: later)
        let hard = FSRS.review(state: fresh, grade: .hard, now: later)
        let easy = FSRS.review(state: fresh, grade: .easy, now: later)
        #expect(again.difficulty > hard.difficulty)
        #expect(hard.difficulty > fresh.difficulty)
        #expect(easy.difficulty < fresh.difficulty)
        // Clamped to the 1…10 scale however many lapses pile up.
        var piled = fresh
        for _ in 0..<60 { piled = FSRS.review(state: piled, grade: .again, now: later) }
        #expect(piled.difficulty <= 10)
        #expect(piled.stability >= Tuning.fsrsMinStability)
    }

    // MARK: Format-derived grades (B2)

    @Test func formatDerivedGradesScheduleRecognitionSoonerThanProduction() {
        let fresh = FSRS.makeInitialState(grade: .good, now: now)
        let later = now.addingTimeInterval(day)
        func next(_ format: AnswerFormat, firstTry: Bool = true) -> FsrsState {
            FSRS.review(state: fresh, grade: Tuning.gradeMapping(format: format, correct: true, firstTry: firstTry), now: later)
        }
        #expect(intervalDays(next(.trueFalse)) < intervalDays(next(.multipleChoice)))
        #expect(intervalDays(next(.multipleChoice)) < intervalDays(next(.fillBlank)))
        #expect(intervalDays(next(.fillBlank, firstTry: false)) < intervalDays(next(.fillBlank)))
        #expect(intervalDays(next(.match)) == intervalDays(next(.trueFalse)))
        let miss = FSRS.review(state: fresh, grade: Tuning.gradeMapping(format: .translation, correct: false, firstTry: true), now: later)
        #expect(intervalDays(miss) < intervalDays(next(.trueFalse)))
    }

    // MARK: engine-10-8 — the first answer on a real gap

    /// Every gap the app creates starts from `makeUnseenState`, so THIS is the state
    /// the grade ordering has to hold from — the tests above start from
    /// `makeInitialState`, which no shipped gap ever has. The first answer used to be
    /// scored as a second review of a failed card: a first-try production answer came
    /// back in 16 hours, a true/false in 13, and `Tuning.fsrsInitialStability` reached
    /// no gap at all.
    @Test func theFirstAnswerOnAnUnseenGapIsScheduledByGrade() {
        let unseen = FSRS.makeUnseenState(now: now)
        #expect(unseen.reps == 0)
        let later = now.addingTimeInterval(day)
        let grades: [ReviewGrade] = [.again, .hard, .good, .easy]
        let states = grades.map { FSRS.review(state: unseen, grade: $0, now: later) }
        for (grade, state) in zip(grades, states) {
            #expect(abs(state.stability - Tuning.fsrsInitialStability(for: grade)) < 1e-9,
                    "\(grade): first-answer stability \(state.stability)")
            #expect(state.reps == 1)
            #expect(state.lapses == (grade == .again ? 1 : 0))
        }
        for i in 1..<grades.count {
            #expect(intervalDays(states[i - 1]) < intervalDays(states[i]), "\(grades[i - 1]) before \(grades[i])")
        }
        // Production and recognition are not scheduled alike.
        func first(_ format: AnswerFormat) -> FsrsState {
            FSRS.review(state: unseen, grade: Tuning.gradeMapping(format: format, correct: true, firstTry: true), now: later)
        }
        #expect(intervalDays(first(.translation)) >= 3 * intervalDays(first(.trueFalse)),
                "translation \(intervalDays(first(.translation))) d vs true/false \(intervalDays(first(.trueFalse))) d")
        #expect(intervalDays(first(.trueFalse)) < intervalDays(first(.multipleChoice)))
        #expect(intervalDays(first(.multipleChoice)) < intervalDays(first(.fillBlank)))
    }

    /// The first interval is grade-ordered without compounding into years: an easy
    /// chain from the shipped starting state stays inside a sane range.
    @Test func anEasyChainFromAnUnseenGapDoesNotExplode() {
        var state = FSRS.makeUnseenState(now: now)
        var clock = now
        var intervals: [Double] = []
        for _ in 0..<5 {
            state = FSRS.review(state: state, grade: .easy, now: clock)
            intervals.append(intervalDays(state))
            clock = state.dueAt
        }
        for i in 1..<intervals.count { #expect(intervals[i] > intervals[i - 1]) }
        #expect(intervals.last! < 120, "five easy answers schedule \(intervals.last!) d out: \(intervals)")
    }

    /// The same, through the store: a first-try production answer on a fresh
    /// Foundation gap comes back well after a first true/false.
    @Test func theStoreSchedulesAFirstProductionAnswerLaterThanARecognitionOne() throws {
        var production = EngineFixtures.gap("p", concept: "c", fsrs: FSRS.makeUnseenState(now: now))
        production.nextReviewAt = now
        var recognition = EngineFixtures.gap("r", concept: "c", fsrs: FSRS.makeUnseenState(now: now))
        recognition.nextReviewAt = now
        let store = EngineFixtures.store(concepts: [EngineFixtures.concept("c")], gaps: [production, recognition])
        store.recordAnswer(gapId: "p", correct: true, format: .translation, firstTry: true, now: now)
        store.recordAnswer(gapId: "r", correct: true, format: .trueFalse, firstTry: true, now: now)
        let p = try #require(store.gaps.first { $0.id == "p" })
        let r = try #require(store.gaps.first { $0.id == "r" })
        #expect(p.nextReviewAt.timeIntervalSince(now) >= 3 * r.nextReviewAt.timeIntervalSince(now))
        #expect(r.nextReviewAt.timeIntervalSince(now) / day >= Tuning.fsrsInitialStability(for: .hard) - 1e-6)
    }

    /// engine-11-6: the scheduler's knobs live in Tuning, and the scheduler reads them.
    @Test func schedulerKnobsComeFromTuning() {
        #expect(FSRS.requestRetention == Tuning.fsrsRequestRetention)
        // No interval is ever shorter than the floor, however fragile the card.
        let tiny = FsrsState(stability: 0.01, difficulty: 5, reps: 3, lapses: 0, lastReviewAt: now, dueAt: now)
        let next = FSRS.review(state: tiny, grade: .again, now: now)
        #expect(next.dueAt.timeIntervalSince(now) / day >= Tuning.fsrsMinIntervalDays - 1e-9)
        // A stability below the curve's floor reads as the floor.
        let elapsed = now.addingTimeInterval(day)
        let floored = FsrsState(stability: Tuning.fsrsRetrievabilityStabilityFloor, difficulty: 5, reps: 3, lapses: 0,
                                lastReviewAt: now, dueAt: now)
        #expect(abs(FSRS.retrievability(state: tiny, now: elapsed) - FSRS.retrievability(state: floored, now: elapsed)) < 1e-12)
        // A gap with no FSRS state falls back to the legacy streak estimate.
        var legacy = EngineFixtures.gap("l", concept: "c")
        legacy.fsrs = nil
        legacy.consecutiveCorrect = 2
        #expect(abs(legacy.retrievability(at: now) - (Tuning.legacyRecallBase + 2 * Tuning.legacyRecallPerCorrect)) < 1e-12)
        legacy.consecutiveCorrect = 50
        #expect(legacy.retrievability(at: now) == Tuning.legacyRecallCeiling)
    }
}
