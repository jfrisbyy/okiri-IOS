//
//  ConjugationCard.swift
//  FluentFrenchIOS
//
//  What a card saved from the conjugation tables says, and whether the card the
//  deck already holds for a form covers the tense on screen (read-4-2).
//
//  French paradigms spell one form in several tenses — parler's "parlions" is
//  both the imparfait and the subjonctif, "parle" is both the présent and the
//  subjonctif — while the deck keys cards by headword. So a saved form has to
//  name every tense it stands for, and a tense page must not call a form "in
//  your deck" because another tense saved the same spelling. View-free so both
//  rules are testable.
//

import Foundation

nonisolated enum ConjugationCard {
    /// The meaning line for one form: "to speak — nous / vous, imparfait".
    static func meaning(verbMeaning: String, pronouns: [String], tense: String) -> String {
        "\(verbMeaning)\(separator)\(reading(pronouns: pronouns, tense: tense))"
    }

    /// The half of the meaning that names who says the form, and in which tense.
    static func reading(pronouns: [String], tense: String) -> String {
        "\(pronouns.joined(separator: " / ")), \(tense.lowercased())"
    }

    /// Between the verb's meaning and the reading of it.
    private static let separator = " — "

    /// True when a card already stands for this tense — the check a tense page
    /// makes before showing a form as saved.
    static func covers(tense: String, meaning: String) -> Bool {
        SentenceExtractor.contains(meaning, term: tense)
    }

    /// The meaning line after folding in another tense's reading of the same
    /// form, or nil when the card already says it. Two readings of one verb
    /// share the "to speak — " opening, so only the new reading is appended
    /// ("to speak — nous, imparfait / nous, subjonctif"); anything else joins whole.
    static func joinedMeaning(_ existing: String, adding addition: String) -> String? {
        let old = existing.trimmingCharacters(in: .whitespacesAndNewlines)
        let new = addition.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !new.isEmpty else { return nil }
        guard !old.isEmpty else { return new }
        guard !contains(old, new) else { return nil }
        if let range = new.range(of: separator), old.hasPrefix(String(new[..<range.upperBound])) {
            let addedReading = String(new[range.upperBound...])
            return contains(old, addedReading) ? nil : "\(old) / \(addedReading)"
        }
        return "\(old) / \(new)"
    }

    /// The explanation after adding the other tense's rule, or nil when the card
    /// already explains it.
    static func joinedExplanation(_ existing: String, adding addition: String) -> String? {
        let old = existing.trimmingCharacters(in: .whitespacesAndNewlines)
        let new = addition.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !new.isEmpty, !contains(old, new) else { return nil }
        return old.isEmpty ? new : "\(old) \(new)"
    }

    /// Accent- and case-insensitive containment, so "Imparfait of parler" is not
    /// added twice because one copy was capitalised differently.
    private static func contains(_ haystack: String, _ needle: String) -> Bool {
        let hay = SentenceExtractor.fold(haystack)
        let straw = SentenceExtractor.fold(needle)
        guard !straw.isEmpty else { return true }
        return hay.contains(straw)
    }
}
