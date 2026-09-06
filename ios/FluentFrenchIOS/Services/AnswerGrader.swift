//
//  AnswerGrader.swift
//  FluentFrenchIOS
//
//  Grades typed answers (fill-blank / translation) and finds the blank in an
//  example sentence. Pure string logic, view-free and testable (C1 / C2 / C3).
//
//  Normalisation (both sides): NFC, trim, collapse whitespace, fold typographic
//  apostrophes and quotes to ASCII, drop French thin spaces before ! ? : ;,
//  strip trailing . ! ? …, strip parenthetical tags like "(m)" / "(formal)",
//  case-insensitive. A match that only differs in diacritics is `.closeAccents`.
//

import Foundation

nonisolated enum AnswerGrader {

    /// The placeholder a fill-blank prompt shows where the answer goes.
    static let blankToken = "_____"

    // MARK: - Grading

    /// Grade a typed answer against the question's expected answer, the gap's
    /// accepted alternatives, and (for vocabulary) the headword with or without
    /// its leading article.
    ///
    /// Article leniency (vocabulary only) is one-directional: "pain" is accepted
    /// for "le pain" and "le pain" for "pain", but "la pain" is NOT accepted for
    /// "le pain" — when the content carries an article, the article is part of
    /// the answer.
    static func grade(typed: String, against gap: GapItem, expected: String, kind: QuestionKind) -> AnswerVerdict {
        let typedNorm = normalize(typed)
        guard !typedNorm.isEmpty else { return .incorrect }

        let candidates = acceptedForms(for: gap, expected: expected, kind: kind)
        guard !candidates.isEmpty else { return .incorrect }
        let lenient = gap.category == .vocabulary

        // 1. Exact (case-insensitive, normalised) match.
        for candidate in candidates where matches(typedNorm, candidate.normalized, articleLenient: lenient, fold: { $0 }) {
            return .correct
        }
        // 2. Diacritic-insensitive match: right word, wrong accents.
        for candidate in candidates where matches(typedNorm, candidate.normalized, articleLenient: lenient, fold: fold) {
            return .closeAccents(expected: candidate.display)
        }
        return .incorrect
    }

    /// One comparison under a folding: equal, or the typed answer equals the
    /// candidate without its article, or (candidate has no article) the typed
    /// answer without its article equals the candidate.
    private static func matches(_ typed: String, _ candidate: String, articleLenient: Bool,
                                fold: (String) -> String) -> Bool {
        if fold(typed) == fold(candidate) { return true }
        guard articleLenient else { return false }
        let candidateBare = strippingArticle(candidate)
        if let candidateBare, fold(typed) == fold(candidateBare) { return true }
        if candidateBare == nil, let typedBare = strippingArticle(typed), fold(typedBare) == fold(candidate) { return true }
        return false
    }

    /// The forms accepted for a gap: the expected answer, content-v2 `acceptedAnswers`,
    /// either side of an "a / b" gloss, and for vocabulary the headword itself.
    /// Display forms keep their original spelling (minus tags) for feedback.
    static func acceptedForms(for gap: GapItem, expected: String, kind: QuestionKind) -> [(display: String, normalized: String)] {
        var raw: [String] = [expected]
        raw.append(contentsOf: gap.acceptedAnswers ?? [])
        if kind.isTyped, gap.category == .vocabulary {
            raw.append(gap.frenchWord)
        }
        // "a / b" glosses: either side is a valid answer.
        for form in raw where form.contains("/") {
            raw.append(contentsOf: form.split(separator: "/").map { String($0) })
        }
        var out: [(display: String, normalized: String)] = []
        var seen = Set<String>()
        for form in raw {
            let display = stripTags(foldQuotes(form.precomposedStringWithCanonicalMapping))
                .trimmingCharacters(in: .whitespacesAndNewlines)
            let norm = normalize(form)
            guard !norm.isEmpty, seen.insert(norm).inserted else { continue }
            out.append((display: display.isEmpty ? form : display, normalized: norm))
        }
        return out
    }

    // MARK: - Normalisation

    /// Leading articles a vocabulary answer may carry or omit.
    static let leadingArticles: [String] = ["le ", "la ", "les ", "l'", "un ", "une ", "des ", "du ", "de la ", "de l'"]

    /// Drop one leading article ("le pain" → "pain"); nil when there is none or
    /// nothing would be left. Input is expected to be normalised (lowercase, ASCII apostrophe).
    static func strippingArticle(_ s: String) -> String? {
        let lower = s.lowercased()
        // Longest article first so "de la" wins over "de".
        for article in leadingArticles.sorted(by: { $0.count > $1.count }) where lower.hasPrefix(article) {
            let rest = String(s.dropFirst(article.count)).trimmingCharacters(in: .whitespaces)
            return rest.isEmpty ? nil : rest
        }
        return nil
    }

    /// Canonical comparison form: NFC, ASCII apostrophes/quotes, no tags, no
    /// trailing punctuation, single spaces, lowercase.
    static func normalize(_ s: String) -> String {
        var t = s.precomposedStringWithCanonicalMapping
        t = foldQuotes(t)
        t = stripTags(t)
        // French thin / no-break spaces → plain spaces, then no space before high punctuation.
        t = t.replacingOccurrences(of: "\u{00A0}", with: " ")
             .replacingOccurrences(of: "\u{202F}", with: " ")
             .replacingOccurrences(of: "\u{2009}", with: " ")
        t = t.replacingOccurrences(of: #"\s+([!?:;])"#, with: "$1", options: .regularExpression)
        // A space after an elision apostrophe ("l' eau") is a typing slip.
        t = t.replacingOccurrences(of: #"'\s+"#, with: "'", options: .regularExpression)
        t = t.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        t = t.trimmingCharacters(in: .whitespacesAndNewlines)
        // Trailing sentence punctuation carries no meaning for grading.
        while let last = t.unicodeScalars.last, trailingPunctuation.contains(last) {
            t.unicodeScalars.removeLast()
            t = t.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return t.lowercased()
    }

    /// Diacritic-insensitive comparison form (also folds œ / æ ligatures).
    static func fold(_ s: String) -> String {
        s.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: nil)
            .replacingOccurrences(of: "œ", with: "oe")
            .replacingOccurrences(of: "æ", with: "ae")
    }

    private static let trailingPunctuation: Set<Unicode.Scalar> = [".", "!", "?", "…"]

    /// Typographic apostrophes and quotes → ASCII.
    static func foldQuotes(_ s: String) -> String {
        var out = ""
        out.reserveCapacity(s.count)
        for scalar in s.unicodeScalars {
            switch scalar {
            case "\u{2019}", "\u{2018}", "\u{0060}", "\u{02BC}", "\u{00B4}", "\u{201B}": out.unicodeScalars.append("'")
            case "\u{201C}", "\u{201D}", "\u{201E}", "\u{00AB}", "\u{00BB}": out.unicodeScalars.append("\"")
            default: out.unicodeScalars.append(scalar)
            }
        }
        return out
    }

    /// Remove parenthetical tags: "(m)", "(f)", "(formal)", "(pl.)" …
    static func stripTags(_ s: String) -> String {
        s.replacingOccurrences(of: #"\s*\([^)]*\)"#, with: "", options: .regularExpression)
    }

    // MARK: - Blanking (C1 / C2)

    /// The example sentence with the gap's blank form replaced by `blankToken`,
    /// or nil when the form does not occur exactly once as a whole word — the
    /// scheduler then never asks this gap as fill-blank.
    static func blankedPrompt(for gap: GapItem) -> String? {
        let sentence = gap.exampleSentence
        guard let range = highlightRange(in: sentence, for: gap) else { return nil }
        return sentence.replacingCharacters(in: range, with: blankToken)
    }

    /// The surface form to blank / highlight: content v2 `blankForm`, else the
    /// headword without its article.
    static func blankForm(for gap: GapItem) -> String {
        if let form = gap.blankForm?.trimmingCharacters(in: .whitespacesAndNewlines), !form.isEmpty {
            return form
        }
        let word = gap.frenchWord.trimmingCharacters(in: .whitespacesAndNewlines)
        return strippingArticle(word) ?? word
    }

    /// Where the gap's blank form sits in `sentence`: the single whole-word
    /// occurrence, case-sensitive first, then case-insensitive. Nil when it does
    /// not occur exactly once — highlighting and blanking share this rule.
    static func highlightRange(in sentence: String, for gap: GapItem) -> Range<String.Index>? {
        highlightRange(of: blankForm(for: gap), in: sentence)
    }

    static func highlightRange(of form: String, in sentence: String) -> Range<String.Index>? {
        guard !form.isEmpty, !sentence.isEmpty else { return nil }
        let exact = wholeWordRanges(of: form, in: sentence, caseInsensitive: false)
        if exact.count == 1 { return leavesContext(exact[0], in: sentence) ? exact[0] : nil }
        if exact.isEmpty {
            let loose = wholeWordRanges(of: form, in: sentence, caseInsensitive: true)
            if loose.count == 1 { return leavesContext(loose[0], in: sentence) ? loose[0] : nil }
        }
        return nil
    }

    /// A blank must leave some sentence around it: when the match covers every
    /// letter of the sentence (a captured phrase whose example IS the phrase),
    /// the prompt would be nothing but the blank token.
    static func leavesContext(_ range: Range<String.Index>, in sentence: String) -> Bool {
        sentence[..<range.lowerBound].contains(where: { $0.isLetter })
            || sentence[range.upperBound...].contains(where: { $0.isLetter })
    }

    /// Every whole-word occurrence of `form`. A boundary is a non-alphanumeric
    /// character (or the string edge); an elision form ending in an apostrophe
    /// ("l'", "j'") may be followed by a letter.
    static func wholeWordRanges(of form: String, in sentence: String, caseInsensitive: Bool) -> [Range<String.Index>] {
        var options: String.CompareOptions = []
        if caseInsensitive { options.insert(.caseInsensitive) }
        let allowsLetterAfter = form.hasSuffix("'") || form.hasSuffix("\u{2019}")
        var ranges: [Range<String.Index>] = []
        var searchFrom = sentence.startIndex
        while searchFrom < sentence.endIndex,
              let r = sentence.range(of: form, options: options, range: searchFrom..<sentence.endIndex) {
            let before = r.lowerBound > sentence.startIndex ? sentence[sentence.index(before: r.lowerBound)] : nil
            let after = r.upperBound < sentence.endIndex ? sentence[r.upperBound] : nil
            let startsClean = before.map { !isWordCharacter($0) } ?? true
            let endsClean = after.map { !isWordCharacter($0) || allowsLetterAfter } ?? true
            if startsClean && endsClean { ranges.append(r) }
            searchFrom = sentence.index(after: r.lowerBound)
        }
        return ranges
    }

    private static func isWordCharacter(_ c: Character) -> Bool {
        c.isLetter || c.isNumber
    }
}
