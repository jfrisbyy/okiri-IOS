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

/// How an answer was produced. The store derives the FSRS grade and the concept
/// evidence weight from this (`Tuning.gradeMapping`, `Tuning.formatEvidenceWeight`)
/// so recognition and production are never scored alike.
nonisolated enum AnswerFormat: String, Codable, CaseIterable {
    case multipleChoice, fillBlank, trueFalse, translation, arrange, match, probe, speaking, converse
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

    /// The schedule a gap the learner has NEVER been asked starts from: the `.again`
    /// stability and difficulty (a new item is fragile and due immediately), but with
    /// ZERO reps and ZERO lapses — nobody has answered it, so nobody has missed it.
    /// `lapses` is what the copy layer reads for "you've missed this N×" and for the
    /// lesson headline's "you've slipped on it N times"; seeding it at 1 told a
    /// brand-new learner they had already slipped on every item of their first lesson.
    static func makeUnseenState(now: Date = Date()) -> FsrsState {
        var state = makeInitialState(grade: .again, now: now)
        state.reps = 0
        state.lapses = 0
        state.dueAt = now
        return state
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
        let step = Double(grade.rawValue) - Double(ReviewGrade.good.rawValue)
        let d = Tuning.fsrsNeutralDifficulty - step * Tuning.fsrsInitialDifficultyStep
        return min(10, max(1, d))
    }

    private static func initialStability(grade: ReviewGrade) -> Double {
        Tuning.fsrsInitialStability(for: grade)
    }

    /// Difficulty steps away from `.good` by grade; a `.good` answer also drifts
    /// toward `Tuning.fsrsDifficultyMeanReversion`, so a card that keeps being
    /// answered well eases instead of ratcheting up forever on its past lapses.
    private static func nextDifficulty(current: Double, grade: ReviewGrade) -> Double {
        let step = Double(grade.rawValue) - Double(ReviewGrade.good.rawValue)
        var d = current - Tuning.fsrsDifficultyStep * step
        if grade == .good {
            d += (Tuning.fsrsDifficultyMeanReversion - d) * Tuning.fsrsDifficultyReversionRate
        }
        return d
    }

    /// Success growth: stability grows by a term that is larger for easier cards
    /// (headroom below `Tuning.fsrsGrowthDifficultyCeiling`) and for recalls that
    /// were hard-won (low retrievability), scaled by `Tuning.fsrsGrowthRate` and
    /// shaped by the grade (`fsrsHardPenalty` / `fsrsEasyBonus`).
    private static func successStability(difficulty: Double, stability: Double, retrievability: Double, grade: ReviewGrade) -> Double {
        let hardPenalty = grade == .hard ? Tuning.fsrsHardPenalty : 1.0
        let easyBonus = grade == .easy ? Tuning.fsrsEasyBonus : 1.0
        let headroom = exp(Tuning.fsrsGrowthScale * (Tuning.fsrsGrowthDifficultyCeiling - difficulty))
        let recallBoost = 1 + (1 - retrievability) * Tuning.fsrsGrowthRetrievabilityWeight
        let growth = headroom * recallBoost
        return stability * (1 + growth * Tuning.fsrsGrowthRate * hardPenalty * easyBonus)
    }

    /// Multiplicative, monotone lapse: the new stability is a fraction (< 1) of the
    /// old one, so a miss ALWAYS comes back sooner than a hit. Harder cards lose
    /// more; a lapse when recall was already unlikely (low retrievability) is the
    /// expected outcome and keeps more. The ratio is capped below 1 and the result
    /// floored at `Tuning.fsrsMinStability`.
    static func lapseStability(difficulty: Double, stability: Double, retrievability: Double) -> Double {
        let difficultyShape = pow(1 - Tuning.fsrsLapseDifficultyShape, difficulty - Tuning.fsrsNeutralDifficulty)
        let retrievabilityShape = 1 + Tuning.fsrsLapseRetrievabilityShape * (1 - min(1, max(0, retrievability)))
        let ratio = min(Tuning.fsrsLapseMaxRatio, Tuning.fsrsLapseFactorBase * difficultyShape * retrievabilityShape)
        return max(Tuning.fsrsMinStability, stability * ratio)
    }

    private static func nextInterval(stability: Double) -> Double {
        let interval = (stability / factor) * (pow(requestRetention, 1 / decay) - 1)
        return max(0.4, interval)
    }
}
