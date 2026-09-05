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
        // Harder cards lose more; a lapse at low recall (the expected outcome) keeps more.
        let easyCard = FSRS.lapseStability(difficulty: 2, stability: 10, retrievability: 0.9)
        let hardCard = FSRS.lapseStability(difficulty: 9, stability: 10, retrievability: 0.9)
        #expect(hardCard < easyCard)
        let expected = FSRS.lapseStability(difficulty: 5, stability: 10, retrievability: 0.3)
        let surprising = FSRS.lapseStability(difficulty: 5, stability: 10, retrievability: 0.99)
        #expect(surprising < expected)
        #expect(Tuning.fsrsLapseMaxRatio < 1 && Tuning.fsrsLapseFactorBase < Tuning.fsrsLapseMaxRatio)
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
}
