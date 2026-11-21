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

    /// The answers a card saved from one table row accepts: each pronoun phrase
    /// that shares the form ("j'étais", "tu étais"), and — for a form written in
    /// agreement notation ("suis allé(e)", "êtes allé(e)(s)") — every spelled-out
    /// agreement, bare and with its pronoun (read-10-2). The grader strips "(e)"
    /// as a tag, so without them "suis allée", which the passé-composé-with-être
    /// skill this card is filed under teaches, was graded a miss on that skill.
    static func acceptedAnswers(form: String, phrases: [String]) -> [String] {
        var answers: [String] = []
        for phrase in phrases where !answers.contains(phrase) { answers.append(phrase) }
        let agreed = agreementVariants(of: form)
        guard agreed.count > 1 else { return answers }
        for variant in phrases.flatMap({ agreementVariants(of: $0) }) + agreed where !answers.contains(variant) {
            answers.append(variant)
        }
        return answers
    }

    /// Every spelled-out form of a table entry written in agreement notation
    /// (read-10-2): "allé(e)" → allé, allée; "allé(e)s" → allés, allées;
    /// "allé(e)(s)" → allé, allée, allés, allées. A "(…)" group counts as an
    /// optional ending only when it is glued to the word before it and holds
    /// letters alone; a spaced tag ("vais (informal)") is not expanded. A form with
    /// no such group comes back unchanged, as the only element.
    ///
    /// The grader strips every "(…)" as a tag, so a card saved from the row
    /// "je suis allé(e)" accepted only "suis allé": the feminine "suis allée" —
    /// which the passé-composé-with-être skill itself teaches — was booked as a
    /// miss on that skill.
    static func agreementVariants(of form: String) -> [String] {
        var variants = [""]
        var rest = Substring(form)
        // "(s)" straight after "(e)" is glued to the same word.
        var followsEnding = false
        while let open = rest.firstIndex(of: "(") {
            guard let close = rest[open...].firstIndex(of: ")") else { break }
            let ending = rest[rest.index(after: open)..<close]
            let glued = open > rest.startIndex ? rest[rest.index(before: open)].isLetter : followsEnding
            let head = String(rest[..<open])
            if glued, !ending.isEmpty, ending.allSatisfy({ $0.isLetter }) {
                variants = variants.flatMap { [$0 + head, $0 + head + ending] }
                followsEnding = true
            } else {
                followsEnding = false
                // Not an ending: kept verbatim, text and group alike.
                let verbatim = String(rest[...close])
                variants = variants.map { $0 + verbatim }
            }
            rest = rest[rest.index(after: close)...]
        }
        var out: [String] = []
        for v in variants.map({ $0 + rest }) where !out.contains(v) { out.append(v) }
        return out
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
