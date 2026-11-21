//
//  SentenceExtractor.swift
//  FluentFrenchIOS
//
//  Finds the sentence a word was met in, so a capture stores (and a lookup is
//  keyed by) the containing sentence rather than the whole article (E5). Pure
//  string logic — no Foundation linguistics — so it runs identically on the
//  Linux harness.
//

import Foundation

nonisolated enum SentenceExtractor {
    /// Characters that end a sentence. The French ellipsis and the dialogue dash
    /// ("— Allô …") count so dialogue lines split into turns.
    private static let terminators: Set<Character> = [".", "!", "?", "…"]
    /// Abbreviations whose trailing period does not end a sentence.
    private static let abbreviations: Set<String> = ["m", "mme", "mlle", "dr", "st", "ste", "etc", "ex", "p", "pp", "cf", "vs", "no"]
    /// Characters stripped from both ends of a token before comparing it to the term.
    private static let edgePunctuation = CharacterSet(charactersIn: " .,!?;:«»\"'’()[]—–…-\n\t")

    /// Split a body into sentences. Newlines always break; ".", "!", "?" and "…"
    /// break when followed by whitespace/end (so "3.5" and "M. Dupont" survive).
    static func sentences(in text: String) -> [String] {
        var result: [String] = []
        for line in text.components(separatedBy: .newlines) {
            var current = ""
            let chars = Array(line)
            var i = 0
            while i < chars.count {
                let ch = chars[i]
                current.append(ch)
                if terminators.contains(ch) {
                    // Absorb a run of terminators and closing quotes ("?!", "…»").
                    var j = i + 1
                    while j < chars.count, terminators.contains(chars[j]) || chars[j] == "»" || chars[j] == "\"" || chars[j] == "'" || chars[j] == "’" {
                        current.append(chars[j]); j += 1
                    }
                    let atEnd = j >= chars.count
                    let followedBySpace = !atEnd && chars[j].isWhitespace
                    if ch == "." && !atEnd && !followedBySpace {
                        // "3.5", "www.example.fr". Resume AFTER the run the absorb
                        // loop already appended (i = j, not i + 1): stepping back
                        // into it would append «/"/… a second time and the saved
                        // context sentence would carry doubled punctuation.
                        i = j; continue
                    }
                    if ch == "." && isAbbreviation(before: current) {
                        i = j; continue
                    }
                    if atEnd || followedBySpace {
                        appendTrimmed(current, to: &result)
                        current = ""
                    }
                    i = j
                    continue
                }
                i += 1
            }
            appendTrimmed(current, to: &result)
        }
        return result
    }

    /// The sentence containing `term` (a word or a phrase), matched on word
    /// boundaries and case-insensitively. When the term occurs several times the
    /// first sentence wins; when it occurs nowhere the result is "" — a capture
    /// then has no context rather than a wrong one.
    static func sentence(containing term: String, in text: String) -> String {
        let needle = normalizeTerm(term)
        guard !needle.isEmpty else { return "" }
        for sentence in sentences(in: text) where contains(sentence, term: needle) {
            return sentence
        }
        return ""
    }

    /// The sentence holding the `occurrence`-th match of `term` (0 = the first) —
    /// the sentence the learner actually met it in, when the reader knows which
    /// copy was tapped (read-10-7). Falls back to the first sentence when there
    /// are fewer matches than that.
    ///
    /// The first-match rule alone glossed the second "café" of a story against
    /// the first sentence that has one: the sheet's "Where you met it", the
    /// translator's disambiguation context and the saved card all named a
    /// sentence the learner had not tapped in.
    static func sentence(containing term: String, in text: String, occurrence: Int) -> String {
        let needle = normalizeTerm(term)
        guard !needle.isEmpty else { return "" }
        var seen = 0
        for sentence in sentences(in: text) {
            let count = matchCount(of: needle, in: sentence)
            if count > 0, occurrence < seen + count { return sentence }
            seen += count
        }
        return sentence(containing: term, in: text)
    }

    /// How many times `term` occurs, as whole words, in `text` — sentence by
    /// sentence, so it counts exactly what `sentence(containing:in:occurrence:)`
    /// indexes. Given the text BEFORE a tapped word, it is that word's occurrence.
    static func occurrences(of term: String, in text: String) -> Int {
        let needle = normalizeTerm(term)
        guard !needle.isEmpty else { return 0 }
        return sentences(in: text).reduce(0) { $0 + matchCount(of: needle, in: $1) }
    }

    /// Whether `sentence` contains `term` as whole words (accent- and case-insensitive).
    static func contains(_ sentence: String, term: String) -> Bool {
        let needle = normalizeTerm(term)
        guard !needle.isEmpty else { return false }
        return matchCount(of: needle, in: sentence, stopAtFirst: true) > 0
    }

    /// Whole-word matches of an already-normalised needle in one sentence.
    private static func matchCount(of needle: String, in sentence: String, stopAtFirst: Bool = false) -> Int {
        let words = tokens(in: sentence)
        let needleWords = needle.split(separator: " ").map(String.init)
        guard !needleWords.isEmpty, words.count >= needleWords.count else { return 0 }
        var count = 0
        for start in 0...(words.count - needleWords.count) {
            var matched = true
            for (offset, w) in needleWords.enumerated() where words[start + offset] != w {
                matched = false; break
            }
            if matched {
                count += 1
                if stopAtFirst { return count }
            }
        }
        return count
    }

    /// Lower-cased, accent-folded, punctuation-stripped words of a sentence.
    /// Elided articles ("l'eau", "j'ai") split at the apostrophe so "eau" matches
    /// inside "l'eau".
    static func tokens(in sentence: String) -> [String] {
        sentence
            .replacingOccurrences(of: "’", with: "'")
            .split(whereSeparator: { $0.isWhitespace || $0 == "'" })
            .map { fold(String($0).trimmingCharacters(in: edgePunctuation)) }
            .filter { !$0.isEmpty }
    }

    /// Case- and diacritic-insensitive form ("Élève" → "eleve").
    static func fold(_ s: String) -> String {
        s.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: nil).lowercased()
    }

    private static func normalizeTerm(_ term: String) -> String {
        tokens(in: term).joined(separator: " ")
    }

    private static func isAbbreviation(before fragment: String) -> Bool {
        // `fragment` ends with the period; look at the word before it.
        let body = fragment.dropLast()
        let lastWord = body.split(whereSeparator: { $0.isWhitespace }).last.map(String.init) ?? ""
        let cleaned = lastWord.trimmingCharacters(in: edgePunctuation).lowercased()
        if abbreviations.contains(cleaned) { return true }
        // Single capital initial ("J. Dupont").
        return cleaned.count == 1 && lastWord.first?.isUppercase == true
    }

    private static func appendTrimmed(_ fragment: String, to result: inout [String]) {
        let trimmed = fragment.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        // A bare dialogue dash or stray punctuation is not a sentence.
        guard trimmed.contains(where: { $0.isLetter || $0.isNumber }) else { return }
        result.append(trimmed)
    }
}
