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
    /// A one-shot diagnostic item created for a blind-spot probe. Probes are kept for
    /// concept evidence but are NOT learner-visible gaps: views must use
    /// `AppStore.visibleGaps` (not `activeGaps`) for lists and counts.
    var isProbe: Bool = false
    /// Content v2: the exact surface form of `frenchWord` inside `exampleSentence`
    /// (must occur verbatim). Nil → never offered as fill-blank.
    var blankForm: String? = nil
    /// Content v2: alternative typed answers accepted as correct.
    var acceptedAnswers: [String]? = nil
    /// Content v2: false for rule-label items (skill cards / MC only, never typed or arranged).
    var isTestable: Bool = true
    /// Confidence (0…1) of the heuristic concept tagger for a learner-captured gap;
    /// nil when the concept came from content or a placement.
    var tagConfidence: Double? = nil
    /// Captured offline without a real gloss; the translation still has to be resolved.
    var needsTranslation: Bool = false
    /// Content v2 probe (B13): the multiple-choice DISTRACTORS for an `isProbe` item.
    /// The correct answer is `englishTranslation`; the prompt is `frenchWord`.
    var probeOptions: [String]? = nil

    /// Explicit keys so the tolerant decoder below and the synthesized encoder agree.
    enum CodingKeys: String, CodingKey {
        case id, frenchWord, englishTranslation, explanation, exampleSentence, exampleTranslation
        case pronunciation, sourceType, category, difficulty, reviewCount, consecutiveCorrect
        case lastReviewedAt, nextReviewAt, masteredAt, createdAt, cefrLevel, easeFactor
        case currentInterval, irtDifficulty, fsrs, originalContext, confusionLinks
        case partOfSpeech, gender, article, baseForm, register, relatedWords, conceptId
        case isProbe, blankForm, acceptedAnswers, isTestable, tagConfidence, needsTranslation
        case probeOptions
    }

    /// The mastery badge (`Tuning.gapMasteryStreak` consecutive correct). A badge,
    /// not retirement: the gap stays on its FSRS schedule and a lapse clears it.
    var isMastered: Bool { masteredAt != nil }

    /// Mastered AND the schedule wants it back: FSRS says it is due, or recall has
    /// dropped below `Tuning.masteredRecallFloor`.
    func isDueForMasteryCheck(at now: Date) -> Bool {
        guard isMastered else { return false }
        return nextReviewAt <= now || retrievability(at: now) < Tuning.masteredRecallFloor
    }

    /// Item-level practice eligibility: every unmastered gap, plus mastered gaps due
    /// for a check. `ConceptSelector.isPracticable` layers concept eligibility on top.
    func isPracticable(at now: Date) -> Bool {
        !isMastered || isDueForMasteryCheck(at: now)
    }

    /// Never answered: no recall evidence yet. Retention analytics list it as "new"
    /// rather than guessing a bucket for it.
    var isNew: Bool { reviewCount == 0 }

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

nonisolated extension GapItem {
    /// Back-compat decoding: every field added after the first release is optional
    /// in the stored JSON and falls back to its default, so a gap persisted by an
    /// older build (no `isProbe`, `isTestable`, …) still decodes. Lives in an
    /// extension so the memberwise initializer stays available.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        frenchWord = try c.decode(String.self, forKey: .frenchWord)
        englishTranslation = try c.decode(String.self, forKey: .englishTranslation)
        explanation = try c.decodeIfPresent(String.self, forKey: .explanation) ?? ""
        exampleSentence = try c.decodeIfPresent(String.self, forKey: .exampleSentence) ?? ""
        exampleTranslation = try c.decodeIfPresent(String.self, forKey: .exampleTranslation) ?? ""
        pronunciation = try c.decodeIfPresent(String.self, forKey: .pronunciation)
        sourceType = try c.decode(SourceType.self, forKey: .sourceType)
        category = try c.decode(GapCategory.self, forKey: .category)
        difficulty = try c.decodeIfPresent(GapDifficulty.self, forKey: .difficulty) ?? .okay
        reviewCount = try c.decodeIfPresent(Int.self, forKey: .reviewCount) ?? 0
        consecutiveCorrect = try c.decodeIfPresent(Int.self, forKey: .consecutiveCorrect) ?? 0
        lastReviewedAt = try c.decodeIfPresent(Date.self, forKey: .lastReviewedAt)
        let created = try c.decodeIfPresent(Date.self, forKey: .createdAt)
        nextReviewAt = try c.decodeIfPresent(Date.self, forKey: .nextReviewAt) ?? created ?? Date()
        masteredAt = try c.decodeIfPresent(Date.self, forKey: .masteredAt)
        createdAt = created ?? Date()
        cefrLevel = try c.decodeIfPresent(CEFRLevel.self, forKey: .cefrLevel)
        easeFactor = try c.decodeIfPresent(Double.self, forKey: .easeFactor) ?? 2.5
        currentInterval = try c.decodeIfPresent(Double.self, forKey: .currentInterval) ?? 0
        irtDifficulty = try c.decodeIfPresent(Double.self, forKey: .irtDifficulty) ?? 0
        fsrs = try c.decodeIfPresent(FsrsState.self, forKey: .fsrs)
        originalContext = try c.decodeIfPresent(OriginalContext.self, forKey: .originalContext)
        confusionLinks = try c.decodeIfPresent([ConfusionLink].self, forKey: .confusionLinks) ?? []
        partOfSpeech = try c.decodeIfPresent(String.self, forKey: .partOfSpeech)
        gender = try c.decodeIfPresent(String.self, forKey: .gender)
        article = try c.decodeIfPresent(String.self, forKey: .article)
        baseForm = try c.decodeIfPresent(String.self, forKey: .baseForm)
        register = try c.decodeIfPresent(String.self, forKey: .register)
        relatedWords = try c.decodeIfPresent([String].self, forKey: .relatedWords)
        conceptId = try c.decodeIfPresent(String.self, forKey: .conceptId)
        isProbe = try c.decodeIfPresent(Bool.self, forKey: .isProbe) ?? false
        blankForm = try c.decodeIfPresent(String.self, forKey: .blankForm)
        acceptedAnswers = try c.decodeIfPresent([String].self, forKey: .acceptedAnswers)
        isTestable = try c.decodeIfPresent(Bool.self, forKey: .isTestable) ?? true
        tagConfidence = try c.decodeIfPresent(Double.self, forKey: .tagConfidence)
        needsTranslation = try c.decodeIfPresent(Bool.self, forKey: .needsTranslation) ?? false
        probeOptions = try c.decodeIfPresent([String].self, forKey: .probeOptions)
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
    /// The concept the gap belonged to when the mistake was made. Optional for
    /// back-compat; error patterns group by it (falling back to the word).
    var conceptId: String? = nil
}

// MARK: - Personal bests (per lesson kind)

/// Lesson kinds a personal best is tracked for. Bests are keyed by `rawValue`.
nonisolated enum LessonBestKind: String, Codable, CaseIterable {
    case smart, scoped, capstone
}

/// The best result the learner has posted for one lesson kind.
nonisolated struct LessonBest: Codable, Hashable {
    /// Best first-attempt accuracy (0…1).
    var accuracy: Double
    /// Longest in-lesson correct streak.
    var streak: Int
    var achievedAt: Date? = nil
}

// MARK: - Tolerant decoding

/// Wraps an element so a persisted array decodes element-by-element: one
/// unreadable element becomes `nil` (and is dropped by the caller) instead of
/// failing the whole array.
nonisolated struct FailableDecodable<Element: Decodable>: Decodable {
    let value: Element?

    init(from decoder: Decoder) {
        value = try? Element(from: decoder)
    }
}

// MARK: - CEFR ordering

/// Rank of a CEFR level (A1 = 0 … C2 = 5) so levels can be compared. Pure model
/// logic (nonisolated): the selector, tagger, lesson and scenario gate all read it.
nonisolated extension CEFRLevel {
    var order: Int { Self.allCases.firstIndex(of: self) ?? 0 }
}

// MARK: - Scenario guide storage

/// Where learner-saved scenario guides live on the device. The key is declared
/// here, next to the models, rather than inside `ScenarioStore`, so `AppStore`
/// can clear it when a different learner signs in and carry it in the cloud
/// snapshot without depending on the scenario service (store-1-4).
nonisolated enum ScenarioStorage {
    static let defaultsKey = "ff.savedScenarios.v1"
}
