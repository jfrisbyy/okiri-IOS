//
//  Gloss.swift
//  FluentFrenchIOS
//
//  Value types shared by the translation surfaces and the store: a dictionary
//  gloss, the explicit ways a lookup can fail, the outcome of a sentence
//  translation, and the draft a capture card hands to the store. Pure data —
//  no networking — so the store and the Linux harness can consume them.
//

import Foundation

// MARK: - Word gloss

nonisolated struct WordGloss: Hashable {
    var term: String
    var translation: String
    var explanation: String
    var example: String
    var exampleTranslation: String
    // Richer dictionary detail (any may be empty).
    var partOfSpeech: String = ""
    var gender: String = ""
    var article: String = ""
    var baseForm: String = ""
    var baseFormNote: String = ""
    var pronunciation: String = ""
    var register: String = ""
    var otherMeanings: [String] = []
    var relatedWords: [String] = []
    var similarPhrases: [String] = []

    /// True when the looked-up term is a multi-word phrase.
    var isPhrase: Bool {
        term.trimmingCharacters(in: .whitespaces).contains(" ")
    }

    var hasGrammar: Bool {
        !partOfSpeech.isEmpty || !gender.isEmpty || !article.isEmpty || !baseForm.isEmpty || !register.isEmpty
    }

    /// A gloss is real only when it carries an actual meaning. The store re-checks
    /// this before it persists a translation, so a placeholder can never become a
    /// gap's `englishTranslation`.
    var isUsable: Bool {
        !translation.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// The gloss a legacy `TranslationService.gloss(for:)` caller receives when the
    /// lookup failed: NO meaning (so it is never usable as a translation) and the
    /// learner-facing failure message as the explanation. New code should call
    /// `TranslationService.lookup(term:context:)` and switch on the result instead.
    static func unavailable(for term: String, failure: TranslationFailure) -> WordGloss {
        WordGloss(term: term, translation: "", explanation: failure.message, example: "", exampleTranslation: "")
    }
}

// MARK: - Why a translation could not be produced

/// The learner-facing reasons a lookup or translation is unavailable. Every
/// surface renders one of these explicitly — there is no silent fallback.
nonisolated enum TranslationFailure: Hashable {
    /// The build has no translation key configured.
    case notConfigured
    /// The device has no usable network connection.
    case offline
    /// The service answered with an error, timed out, or sent something unreadable.
    case serviceError

    var title: String {
        switch self {
        case .notConfigured: return "Translation isn't available"
        case .offline: return "You're offline"
        case .serviceError: return "Couldn't reach the translation service"
        }
    }

    var message: String {
        switch self {
        case .notConfigured:
            return "This copy of the app can't look words up yet. You can still save the word with its sentence — the meaning will be filled in once translation is available."
        case .offline:
            return "Check your connection and try again. You can still save the word now; we'll translate it once you're back online."
        case .serviceError:
            return "Something went wrong on our side. Try again in a moment, or save the word now and we'll translate it later."
        }
    }

    /// Whether a retry could plausibly succeed right now (a missing key won't fix itself).
    var isRetryable: Bool { self != .notConfigured }
}

/// The result of looking up one word or phrase.
nonisolated enum GlossLookup: Hashable {
    case gloss(WordGloss)
    case unavailable(TranslationFailure)

    var gloss: WordGloss? {
        if case .gloss(let g) = self { return g }
        return nil
    }

    var failure: TranslationFailure? {
        if case .unavailable(let f) = self { return f }
        return nil
    }
}

/// The result of translating a sentence between English and French.
nonisolated enum TranslationOutcome: Hashable {
    case translated(String)
    case unavailable(TranslationFailure)

    var text: String? {
        if case .translated(let t) = self { return t }
        return nil
    }
}

// MARK: - Capture draft

/// Everything a capture card knows about a word before it becomes a gap. The
/// store (`AppStore.capture(_:now:)`) derives category, level and difficulty
/// from what is filled in (`CaptureBuilder`), so every capture site shares one
/// rule set and none hard-codes a level or a category.
nonisolated struct CaptureDraft: Hashable, Identifiable {
    var frenchWord: String
    /// Empty when the capture happened without a real gloss: the gap is saved with
    /// `needsTranslation = true` and resolved later. Never a placeholder string.
    var englishTranslation: String
    var explanation: String = ""
    var exampleSentence: String = ""
    var exampleTranslation: String = ""
    var pronunciation: String? = nil
    var sourceType: SourceType
    /// Which surface captured it (stored in `OriginalContext.sourceTab`).
    var sourceTab: String
    /// The sentence the word was met in (context for re-exposure; also the example
    /// when the gloss had none). Empty when there was no surrounding sentence.
    var contextSentence: String = ""
    /// The level of the source material (article, piece, resource page). Nil →
    /// the learner's own level.
    var sourceLevel: CEFRLevel? = nil
    /// Explicit overrides; nil → derived from the gloss detail.
    var category: GapCategory? = nil
    var difficulty: GapDifficulty? = nil
    var partOfSpeech: String? = nil
    var gender: String? = nil
    var article: String? = nil
    var baseForm: String? = nil
    var register: String? = nil
    var relatedWords: [String]? = nil
    /// A concept the source page knows this belongs to (resource pages). Ignored
    /// when the concept does not exist in the learner's taxonomy.
    var conceptId: String? = nil
    /// Other typed answers that are right for this card ("nous étions" when the
    /// headword is the bare form "étions"). Copied onto `GapItem.acceptedAnswers`.
    var acceptedAnswers: [String]? = nil
    /// The learner's own memory hook, appended to the explanation.
    var note: String = ""
    /// False for recognition-only cards (a conjugation paradigm, a rule label):
    /// the lesson shows them as multiple choice and never asks for the headword
    /// to be typed, blanked or arranged. Copied onto `GapItem.isTestable`.
    var isTestable: Bool = true

    var id: String { "\(sourceTab)|\(frenchWord.lowercased())" }

    var needsTranslation: Bool {
        englishTranslation.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// Whether the store can turn this draft into a card at all: the headword has
    /// a letter, is at most `Tuning.maxCaptureWords` words and stays inside one
    /// sentence. Capture surfaces disable the save button when this is false
    /// instead of letting it no-op.
    var isCapturable: Bool { CaptureBuilder.isAcceptableHeadword(frenchWord) }

    /// A draft built from a real gloss: every dictionary field carried across, the
    /// sentence the word was met in as context, and the source's level.
    init(gloss: WordGloss, sourceType: SourceType, sourceTab: String,
         contextSentence: String = "", sourceLevel: CEFRLevel? = nil, note: String = "") {
        frenchWord = gloss.term
        englishTranslation = gloss.isUsable ? gloss.translation : ""
        explanation = gloss.explanation
        exampleSentence = gloss.example
        exampleTranslation = gloss.exampleTranslation
        pronunciation = gloss.pronunciation.isEmpty ? nil : gloss.pronunciation
        self.sourceType = sourceType
        self.sourceTab = sourceTab
        self.contextSentence = contextSentence
        self.sourceLevel = sourceLevel
        partOfSpeech = gloss.partOfSpeech.isEmpty ? nil : gloss.partOfSpeech
        gender = gloss.gender.isEmpty ? nil : gloss.gender
        article = gloss.article.isEmpty ? nil : gloss.article
        baseForm = gloss.baseForm.isEmpty ? nil : gloss.baseForm
        register = gloss.register.isEmpty ? nil : gloss.register
        relatedWords = gloss.relatedWords.isEmpty ? nil : gloss.relatedWords
        self.note = note
    }

    /// A draft for a word met WITHOUT a gloss (offline, no key, service down): no
    /// meaning yet, just the word and its sentence. Saved with `needsTranslation`.
    init(untranslated term: String, sourceType: SourceType, sourceTab: String,
         contextSentence: String = "", sourceLevel: CEFRLevel? = nil, note: String = "") {
        frenchWord = term
        englishTranslation = ""
        self.sourceType = sourceType
        self.sourceTab = sourceTab
        self.contextSentence = contextSentence
        self.sourceLevel = sourceLevel
        self.note = note
    }

    /// A draft for bundled reference content (idioms, tenses, accent pages) whose
    /// meaning is already known.
    init(frenchWord: String, englishTranslation: String, explanation: String = "",
         exampleSentence: String = "", exampleTranslation: String = "", pronunciation: String? = nil,
         sourceType: SourceType, sourceTab: String, contextSentence: String = "",
         sourceLevel: CEFRLevel? = nil, category: GapCategory? = nil, difficulty: GapDifficulty? = nil,
         partOfSpeech: String? = nil, register: String? = nil, conceptId: String? = nil,
         acceptedAnswers: [String]? = nil, note: String = "",
         isTestable: Bool = true) {
        self.frenchWord = frenchWord
        self.englishTranslation = englishTranslation
        self.explanation = explanation
        self.exampleSentence = exampleSentence
        self.exampleTranslation = exampleTranslation
        self.pronunciation = pronunciation
        self.sourceType = sourceType
        self.sourceTab = sourceTab
        self.contextSentence = contextSentence
        self.sourceLevel = sourceLevel
        self.category = category
        self.difficulty = difficulty
        self.partOfSpeech = partOfSpeech
        self.register = register
        self.conceptId = conceptId
        self.acceptedAnswers = acceptedAnswers
        self.note = note
        self.isTestable = isTestable
    }
}

/// What happened when a draft was handed to the store.
nonisolated enum CaptureOutcome: Equatable {
    /// A new gap was created (scheduled, deduped, tagging queued).
    case saved(GapItem)
    /// The headword was already in the deck; nothing changed.
    case duplicate(GapItem)
    /// The draft had no French headword.
    case rejected
}
