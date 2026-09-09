//
//  CaptureBuilder.swift
//  FluentFrenchIOS
//
//  The ONE rule set that turns what a capture surface knows about a word (its
//  gloss detail, the source's level, the learner's level) into a gap's category,
//  CEFR level and difficulty (E7). Pure and view-free: every capture site — the
//  reader, the resource pages, listening, watching, converse — feeds a
//  `CaptureDraft` to `AppStore.capture(_:now:)`, which calls this.
//

import Foundation

nonisolated enum CaptureBuilder {
    /// Registers that make a word a matter of tone rather than meaning.
    private static let registerMarkers: Set<String> = [
        "formal", "informal", "casual", "slang", "vulgar", "familiar", "familier",
        "colloquial", "literary", "soutenu", "argot", "very formal", "very informal",
    ]

    /// Parts of speech that are grammar words rather than content words.
    private static let grammarPOS: Set<String> = [
        "pronoun", "preposition", "conjunction", "article", "determiner", "auxiliary", "auxiliary verb",
    ]

    /// Parts of speech that name a fixed expression.
    private static let phrasePOS: Set<String> = [
        "phrase", "expression", "idiom", "idiomatic expression", "interjection", "set phrase", "fixed expression",
    ]

    /// The gap category for a capture. An explicit category (a resource page that
    /// knows) always wins; otherwise the gloss detail decides: a register marker →
    /// `.register`, a fixed expression or multi-word phrase → `.phrasing`, a grammar
    /// part of speech → `.grammar`, everything else → `.vocabulary`.
    static func category(explicit: GapCategory?, partOfSpeech: String?, register: String?,
                         frenchWord: String) -> GapCategory {
        if let explicit { return explicit }
        let pos = normalize(partOfSpeech)
        let reg = normalize(register)
        if !reg.isEmpty, reg != "neutral", reg != "standard",
           registerMarkers.contains(reg) || registerMarkers.contains(where: { reg.hasPrefix($0) }) {
            return .register
        }
        if phrasePOS.contains(pos) || pos.contains("phrase") || pos.contains("expression") || pos.contains("idiom") {
            return .phrasing
        }
        if isPhrase(frenchWord) { return .phrasing }
        if grammarPOS.contains(pos) || pos.hasPrefix("pronoun") || pos.hasPrefix("preposition")
            || pos.hasPrefix("conjunction") || pos.hasPrefix("article") || pos.hasPrefix("determiner") {
            return .grammar
        }
        return .vocabulary
    }

    /// The level a capture is filed under: the source's level when the surface
    /// knows it (a graded piece, a resource page), otherwise the learner's own.
    static func level(sourceLevel: CEFRLevel?, learnerLevel: CEFRLevel) -> CEFRLevel {
        sourceLevel ?? learnerLevel
    }

    /// Difficulty relative to the learner: material above their level is `.hard`,
    /// material more than one band below is `.easy`, the rest `.okay`. A marked
    /// register (slang, formal, literary) is never `.easy`.
    static func difficulty(explicit: GapDifficulty?, level: CEFRLevel, learnerLevel: CEFRLevel,
                           register: String?) -> GapDifficulty {
        if let explicit { return explicit }
        let delta = rank(level) - rank(learnerLevel)
        let marked = !normalize(register).isEmpty && normalize(register) != "neutral" && normalize(register) != "standard"
        if delta > 0 || (marked && delta == 0) { return .hard }
        if delta < -1 && !marked { return .easy }
        return .okay
    }

    /// A word is a phrase when it has whitespace between letters (apostrophes
    /// like "l'eau" do not make a phrase).
    static func isPhrase(_ word: String) -> Bool {
        word.trimmingCharacters(in: .whitespacesAndNewlines).contains(where: { $0 == " " })
    }

    // MARK: Headword shape

    /// Marks that end a sentence. A headword that carries one with more text
    /// after it was swept across a sentence boundary.
    private static let sentenceEnders: Set<Character> = [".", "!", "?", "…"]

    /// Words in a headword (whitespace-separated).
    static func wordCount(_ word: String) -> Int {
        word.split(whereSeparator: { $0.isWhitespace || $0.isNewline }).count
    }

    /// True when a whitespace-separated token closes a sentence ("Montmartre.",
    /// "!", "…"). The reader uses this to stop a phrase selection at the end of
    /// the sentence it started in.
    static func endsSentence<S: StringProtocol>(_ token: S) -> Bool {
        token.contains(where: { sentenceEnders.contains($0) })
    }

    /// True when the headword runs past the end of a sentence ("… à Montmartre.
    /// Le serveur m'a souri"): a sentence mark sits on any word but the last.
    static func spansSentences(_ word: String) -> Bool {
        let tokens = word.split(whereSeparator: { $0.isWhitespace || $0.isNewline })
        guard tokens.count > 1 else { return false }
        return tokens.dropLast().contains { endsSentence($0) }
    }

    /// True when the headword is a COMPLETE quotation rather than a slice cut out
    /// of the middle of one: it either stays inside a single sentence, or it runs
    /// all the way to the end of the last sentence it contains. A dialogue turn
    /// made of two short sentences ("Bonjour ! Je voudrais un café, s'il vous
    /// plaît.") is whole; a drag that ran past a full stop and stopped mid-sentence
    /// ("café. Le serveur") is not (talkmedia-6-1).
    static func isWholeUtterance(_ word: String) -> Bool {
        let tokens = word.split(whereSeparator: { $0.isWhitespace || $0.isNewline })
        guard let last = tokens.last else { return false }
        return !spansSentences(word) || endsSentence(last)
    }

    /// A headword the deck can HOLD: it has at least one letter (never "2030" or
    /// "%"), it is at most `Tuning.maxCardWords` words long, and it is a whole
    /// utterance. A paragraph swept up by a long drag in the reader is text, not a
    /// card — but a whole dialogue line is a card, because how long a card may be
    /// and how it may later be TESTED are two different questions
    /// (`isTypeableHeadword` answers the second) (talkmedia-6-1).
    static func isAcceptableHeadword(_ word: String) -> Bool {
        let trimmed = word.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.contains(where: { $0.isLetter }) else { return false }
        guard wordCount(trimmed) <= Tuning.maxCardWords else { return false }
        return isWholeUtterance(trimmed)
    }

    /// A headword a lesson may ask the learner to WRITE OUT or arrange: short
    /// enough to type. Sentence shape is deliberately not part of this — "ne...
    /// pas" is dictionary notation the grader already understands. A card that
    /// fails this is still a card; it is only ever asked in formats the learner
    /// taps (talkmedia-6-1).
    static func isTypeableHeadword(_ word: String) -> Bool {
        let trimmed = word.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.contains(where: { $0.isLetter }) else { return false }
        return wordCount(trimmed) <= Tuning.maxCaptureWords
    }

    /// One short phrase from ONE sentence: typeable and never spanning a sentence
    /// break. The production surfaces (Speak, Converse, correction cards) build
    /// cards the learner is meant to say back, so a run of sentences there is
    /// several expressions rather than one card (talkmedia-4-1).
    static func isShortPhrase(_ word: String) -> Bool {
        let trimmed = word.trimmingCharacters(in: .whitespacesAndNewlines)
        return isTypeableHeadword(trimmed) && !spansSentences(trimmed)
    }

    // MARK: Meaning shape

    /// Leading English articles a meaning may carry ("the restaurant").
    private static let englishArticles: [String] = ["the ", "a ", "an "]

    /// True when the meaning a headword would be saved with IS the headword: a
    /// French word spelled the same in English, glossed with itself ("restaurant"
    /// → "restaurant", "Paris" → "Paris", "important" → "important"). Every format
    /// a lesson can build for such a card hands the answer over — "What does
    /// “restaurant” mean?" answered by "restaurant", "“restaurant” means
    /// “restaurant”.", "Translate to French: restaurant" — so the card would book
    /// FSRS progress and concept evidence while testing nothing (read-8-2).
    /// An EMPTY meaning is not self-glossed: a word saved offline to be translated
    /// later is a legitimate card.
    static func isSelfGlossed(headword: String, meaning: String) -> Bool {
        let word = comparisonForm(headword, droppingEnglishArticle: false)
        let gloss = comparisonForm(meaning, droppingEnglishArticle: true)
        guard !word.isEmpty, !gloss.isEmpty else { return false }
        return word == gloss
    }

    /// Case-, accent- and tag-insensitive comparison form, so "Paris"/"paris" and
    /// "important"/"important (adj.)" read as the same word. The English article on
    /// the MEANING is dropped ("restaurant" → "the restaurant" gives itself away
    /// just the same); the French article on the headword is NOT — "le restaurant"
    /// → "the restaurant" teaches the gender, which is a card worth having.
    private static func comparisonForm(_ value: String, droppingEnglishArticle: Bool) -> String {
        let normalized = AnswerGrader.fold(AnswerGrader.normalize(value))
        guard droppingEnglishArticle else { return normalized }
        for article in englishArticles where normalized.hasPrefix(article) {
            let rest = String(normalized.dropFirst(article.count)).trimmingCharacters(in: .whitespaces)
            if !rest.isEmpty { return rest }
        }
        return normalized
    }

    static func rank(_ level: CEFRLevel) -> Int {
        CEFRLevel.allCases.firstIndex(of: level) ?? 0
    }

    private static func normalize(_ value: String?) -> String {
        (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}
