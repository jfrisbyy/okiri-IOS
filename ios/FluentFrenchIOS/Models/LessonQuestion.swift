//
//  LessonQuestion.swift
//  FluentFrenchIOS
//
//  The lesson's question model, view-free so the scheduler, grader and parser
//  can be exercised headlessly. `LessonView` only renders these.
//

import Foundation

// MARK: - Kinds and levels

/// The practice formats a lesson can present.
nonisolated enum QuestionKind: String, CaseIterable, Codable, Hashable {
    case multipleChoice, fillBlank, trueFalse, translation, arrange, match

    /// The evidence format the store records this kind as.
    var answerFormat: AnswerFormat {
        switch self {
        case .multipleChoice: return .multipleChoice
        case .fillBlank: return .fillBlank
        case .trueFalse: return .trueFalse
        case .translation: return .translation
        case .arrange: return .arrange
        case .match: return .match
        }
    }

    /// Typed formats go through `AnswerGrader`; the rest compare a selection.
    var isTyped: Bool { self == .fillBlank || self == .translation }

    /// The progression tier this format belongs to (C18).
    var level: QuestionLevel {
        switch self {
        case .multipleChoice, .match: return .recognition
        case .fillBlank, .trueFalse: return .recall
        case .translation, .arrange: return .production
        }
    }
}

/// Format progression by the gap's own evidence (C18): recognition for new
/// items, recall once there is some evidence, production once it is strong.
nonisolated enum QuestionLevel: Int, Comparable, Hashable, CaseIterable {
    case recognition = 0, recall = 1, production = 2

    nonisolated static func < (lhs: QuestionLevel, rhs: QuestionLevel) -> Bool { lhs.rawValue < rhs.rawValue }
}

/// Where a question came from — the local scheduler or the AI writer.
nonisolated enum QuestionSource: Hashable {
    case local, ai
}

// MARK: - Question

nonisolated struct LessonQuestion: Identifiable {
    /// Kept for source compatibility with the existing view (`LessonQuestion.Kind`).
    typealias Kind = QuestionKind

    let id = UUID()
    let gap: GapItem
    let kind: QuestionKind
    var prompt: String
    var correctAnswer: String
    var options: [String] = []
    var statement: String = ""
    /// A short pre-answer hint; nil when the content has nothing honest to say.
    var hint: String?
    var tokens: [String] = []          // arrange: shuffled word bank
    var correctOrder: [String] = []    // arrange: target order
    var matchGaps: [GapItem] = []      // match: the pairs to connect
    var isRemedial: Bool = false
    // --- Package C additions (all defaulted so existing call sites keep compiling) ---
    /// The selector's role for this gap (`.checkIn` → pass `isCheckIn: true` to the store).
    var role: SelectedItemRole = .review
    /// A blind-spot probe: one diagnostic MC item, never remediated (B13 / C19).
    var isProbe: Bool = false
    /// Part of a capstone: no remedials, no reveals, first attempt is the tally (C16).
    var isCapstone: Bool = false
    /// A stepped-down remedial that shows the correct answer before the learner picks (C6).
    var showsAnswer: Bool = false
    /// Multiple choice in the reverse direction: an English prompt with French
    /// options (the view speaks nothing for the prompt and French for the options).
    var isReversed: Bool = false
    /// What the learner sees after answering, right or wrong (C10): the real meaning
    /// for true/false, the target sentence for arrange, the completed sentence for
    /// fill-blank, the content note otherwise.
    var explanation: String? = nil
    var source: QuestionSource = .local

    var conceptId: String? { gap.conceptId }
    var level: QuestionLevel { kind.level }
    /// The evidence format to record: a probe records as `.probe` whatever it looks like.
    var answerFormat: AnswerFormat { isProbe ? .probe : kind.answerFormat }
    var isCheckIn: Bool { role == .checkIn }
    /// A match interstitial spans several gaps; `gap` is only its first pair.
    var isInterstitial: Bool { kind == .match }
}

// MARK: - Grading verdict

/// What `AnswerGrader` says about a typed answer.
nonisolated enum AnswerVerdict: Equatable, Hashable {
    case correct
    /// Right apart from diacritics: counts as correct, graded `.hard`, and the
    /// lesson shows "Almost — check the accents: <expected>".
    case closeAccents(expected: String)
    case incorrect

    /// Correct for scoring, hearts, XP and mastery (accent slips are not misses).
    var countsAsCorrect: Bool {
        if case .incorrect = self { return false }
        return true
    }

    var isExact: Bool {
        if case .correct = self { return true }
        return false
    }

    /// The honest feedback line for an accent slip; nil otherwise.
    var message: String? {
        if case .closeAccents(let expected) = self { return "Almost — check the accents: \(expected)" }
        return nil
    }

    /// The FSRS grade to record: an accent slip is a `.hard` success (C3), every
    /// other outcome follows `Tuning.gradeMapping`.
    func reviewGrade(format: AnswerFormat, firstTry: Bool) -> ReviewGrade {
        switch self {
        case .closeAccents: return .hard
        case .correct: return Tuning.gradeMapping(format: format, correct: true, firstTry: firstTry)
        case .incorrect: return .again
        }
    }
}
