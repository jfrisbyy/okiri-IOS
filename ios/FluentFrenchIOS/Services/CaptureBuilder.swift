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

    /// A headword the deck can ask a question about: it has at least one letter
    /// (never "2030" or "%"), it is at most `Tuning.maxCaptureWords` words long,
    /// and it stays inside one sentence. A paragraph swept up by a long drag in
    /// the reader is text, not a card.
    static func isAcceptableHeadword(_ word: String) -> Bool {
        let trimmed = word.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.contains(where: { $0.isLetter }) else { return false }
        guard wordCount(trimmed) <= Tuning.maxCaptureWords else { return false }
        return !spansSentences(trimmed)
    }

    static func rank(_ level: CEFRLevel) -> Int {
        CEFRLevel.allCases.firstIndex(of: level) ?? 0
    }

    private static func normalize(_ value: String?) -> String {
        (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}
