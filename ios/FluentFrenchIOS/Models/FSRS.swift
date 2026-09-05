//
//  FSRS.swift
//  FluentFrenchIOS
//
//  Lightweight FSRS-style spaced-repetition scheduler.
//  Mirrors the Expo app's fsrs.ts: each card carries stability, difficulty,
//  and a retrievability curve that drives the optimal next-review date.
//

import Foundation

nonisolated enum ReviewGrade: Int {
    case again = 1
    case hard = 2
    case good = 3
    case easy = 4
}

nonisolated enum FSRS {
    /// Target recall probability when scheduling the next review.
    static let requestRetention: Double = 0.9
    /// Decay constant for the power forgetting curve.
    static let decay: Double = -0.5
    static let factor: Double = 19.0 / 81.0

    static func makeInitialState(grade: ReviewGrade, now: Date = Date()) -> FsrsState {
        let difficulty = initialDifficulty(grade: grade)
        let stability = initialStability(grade: grade)
        let interval = nextInterval(stability: stability)
        return FsrsState(
            stability: stability,
            difficulty: difficulty,
            reps: 1,
            lapses: grade == .again ? 1 : 0,
            lastReviewAt: now,
            dueAt: now.addingTimeInterval(interval * 86_400)
        )
    }

    /// Probability of recall right now given elapsed days since last review.
    static func retrievability(state: FsrsState, now: Date = Date()) -> Double {
        guard let last = state.lastReviewAt else { return 1.0 }
        let elapsedDays = max(0, now.timeIntervalSince(last) / 86_400)
        let base = 1 + factor * (elapsedDays / max(0.1, state.stability))
        return pow(base, decay)
    }

    /// Advance a card's memory state after a review.
    static func review(state: FsrsState?, grade: ReviewGrade, now: Date = Date()) -> FsrsState {
        guard let state else { return makeInitialState(grade: grade, now: now) }

        let r = retrievability(state: state, now: now)
        var difficulty = nextDifficulty(current: state.difficulty, grade: grade)
        difficulty = min(10, max(1, difficulty))

        let newStability: Double
        if grade == .again {
            newStability = lapseStability(difficulty: difficulty, stability: state.stability, retrievability: r)
        } else {
            newStability = successStability(difficulty: difficulty, stability: state.stability, retrievability: r, grade: grade)
        }

        let interval = nextInterval(stability: newStability)
        return FsrsState(
            stability: newStability,
            difficulty: difficulty,
            reps: state.reps + 1,
            lapses: state.lapses + (grade == .again ? 1 : 0),
            lastReviewAt: now,
            dueAt: now.addingTimeInterval(interval * 86_400)
        )
    }

    // MARK: - Internal curve math

    private static func initialDifficulty(grade: ReviewGrade) -> Double {
        let d = 5.0 - (Double(grade.rawValue) - 3.0) * 1.0
        return min(10, max(1, d))
    }

    private static func initialStability(grade: ReviewGrade) -> Double {
        switch grade {
        case .again: return 0.4
        case .hard: return 1.2
        case .good: return 2.6
        case .easy: return 5.8
        }
    }

    private static func nextDifficulty(current: Double, grade: ReviewGrade) -> Double {
        current - 0.1 * (Double(grade.rawValue) - 3.0)
    }

    private static func successStability(difficulty: Double, stability: Double, retrievability: Double, grade: ReviewGrade) -> Double {
        let hardPenalty = grade == .hard ? 0.8 : 1.0
        let easyBonus = grade == .easy ? 1.3 : 1.0
        let growth = exp(0.4 * (11 - difficulty)) * (1 + (1 - retrievability) * 2)
        return stability * (1 + growth * 0.1 * hardPenalty * easyBonus)
    }

    private static func lapseStability(difficulty: Double, stability: Double, retrievability: Double) -> Double {
        let s = 1.5 * pow(stability, 0.2) * exp(0.2 * (11 - difficulty))
        return max(0.2, min(s, stability))
    }

    private static func nextInterval(stability: Double) -> Double {
        let interval = (stability / factor) * (pow(requestRetention, 1 / decay) - 1)
        return max(0.4, interval)
    }
}
