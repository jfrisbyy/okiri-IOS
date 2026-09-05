//
//  Models.swift
//  FluentFrenchIOS
//
//  Core domain models mirroring the Expo app's type system.
//

import SwiftUI

// MARK: - Enums

nonisolated enum GapCategory: String, Codable, CaseIterable, Identifiable {
    case vocabulary, grammar, pronunciation, phrasing, register
    var id: String { rawValue }

    var label: String {
        switch self {
        case .vocabulary: return "Vocabulary"
        case .grammar: return "Grammar"
        case .pronunciation: return "Pronunciation"
        case .phrasing: return "Phrasing"
        case .register: return "Register"
        }
    }

    var color: Color {
        switch self {
        case .vocabulary: return Theme.primary
        case .grammar: return Theme.secondary
        case .pronunciation: return Theme.purple
        case .phrasing: return Theme.warning
        case .register: return Theme.success
        }
    }
}

nonisolated enum SourceType: String, Codable {
    case reading, speech, foundation, listening

    var label: String { rawValue.capitalized }
    var systemImage: String {
        switch self {
        case .reading: return "book"
        case .speech: return "mic"
        case .foundation: return "square.stack.3d.up"
        case .listening: return "headphones"
        }
    }
}

nonisolated enum GapDifficulty: String, Codable {
    case hard, okay, easy
}

nonisolated enum CEFRLevel: String, Codable, CaseIterable {
    case A1, A2, B1, B2, C1, C2
}

nonisolated enum QuestionType: String, Codable {
    case multipleChoice
    case fillBlank
    case trueFalse
    case translation
}

// MARK: - FSRS state

nonisolated struct FsrsState: Codable, Hashable {
    var stability: Double
    var difficulty: Double
    var reps: Int
    var lapses: Int
    var lastReviewAt: Date?
    var dueAt: Date
}

// MARK: - Original context (for re-exposure)

nonisolated struct OriginalContext: Codable, Hashable {
    var sentence: String
    var translation: String?
    var sourceTab: String
    var capturedAt: Date
    var reExposureCount: Int
}

// MARK: - Confusion link

nonisolated struct ConfusionLink: Codable, Hashable, Identifiable {
    var id: String { partnerGapId }
    var partnerGapId: String
    var wrongPicks: Int
    var lastConfusedAt: Date
    var strength: Double
}

// MARK: - Gap item

nonisolated struct GapItem: Codable, Identifiable, Hashable {
    var id: String
    var frenchWord: String
    var englishTranslation: String
    var explanation: String
    var exampleSentence: String
    var exampleTranslation: String
    var pronunciation: String?
    var sourceType: SourceType
    var category: GapCategory
    var difficulty: GapDifficulty
    var reviewCount: Int
    var consecutiveCorrect: Int
    var lastReviewedAt: Date?
    var nextReviewAt: Date
    var masteredAt: Date?
    var createdAt: Date
    var cefrLevel: CEFRLevel?
    var easeFactor: Double
    var currentInterval: Double
    var irtDifficulty: Double
    var fsrs: FsrsState?
    var originalContext: OriginalContext?
    var confusionLinks: [ConfusionLink]
    // Richer dictionary detail captured at save time (all optional for back-compat).
    var partOfSpeech: String? = nil
    var gender: String? = nil
    var article: String? = nil
    var baseForm: String? = nil
    var register: String? = nil
    var relatedWords: [String]? = nil
    /// Link to the underlying skill (Concept) this gap is evidence of. Defaults to
    /// nil and is filled in asynchronously by the concept tagger after capture.
    var conceptId: String? = nil

    var isMastered: Bool { masteredAt != nil }

    /// Probability the learner can recall this right now (FSRS retrievability).
    var retrievability: Double { retrievability(at: Date()) }

    /// Retrievability evaluated against an explicit clock — the selector threads
    /// `SelectionRequest.now` through so selections are reproducible headlessly.
    func retrievability(at now: Date) -> Double {
        guard let fsrs else {
            // fall back to a coarse estimate from consecutive correct
            return min(0.95, 0.4 + Double(consecutiveCorrect) * 0.12)
        }
        return FSRS.retrievability(state: fsrs, now: now)
    }
}

// MARK: - Error history (for error patterns / confusion insights)

nonisolated struct ErrorRecord: Codable, Identifiable, Hashable {
    var id: String
    var gapId: String
    var category: GapCategory
    var frenchWord: String
    var userAnswer: String
    var correctAnswer: String
    var conceptLabel: String
    var occurredAt: Date
}
