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
//  Multiple-choice options are compared with `optionMatches`, which keeps the
//  tag: "the (masculine singular)" is not "the (feminine singular)".
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
    /// Article leniency (TRANSLATIONS only, on the items `isArticleLenient` allows) is
    /// one-directional: "pain" is accepted for "le pain" and "le pain" for "pain", but
    /// "la pain" is NOT accepted for "le pain" — when the content carries an article,
    /// the article is part of the answer.
    ///
    /// A FILL-BLANK gets no article leniency at all: the sentence around the blank
    /// already supplies (or withholds) the determiner, so an added or dropped article
    /// does not fit the hole. "Ma _____ est gentille." wants "mère" — "la mère" would
    /// read "Ma la mère est gentille."; "Je bois de _____." wants "l'eau" — "eau"
    /// would read "Je bois de eau."
    static func grade(typed: String, against gap: GapItem, expected: String, kind: QuestionKind) -> AnswerVerdict {
        let typedNorm = normalize(typed)
        guard !typedNorm.isEmpty else { return .incorrect }

        let candidates = acceptedForms(for: gap, expected: expected, kind: kind)
        guard !candidates.isEmpty else { return .incorrect }
        let lenient = isArticleLenient(gap) && kind != .fillBlank

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
    /// either side of an "a / b" gloss, and for vocabulary the headword itself —
    /// but only when the headword IS the expected answer (see `acceptsHeadword`).
    /// Display forms keep their original spelling (minus tags) for feedback.
    ///
    /// Three alternatives are never accepted, because accepting them would teach the
    /// wrong thing and the "Also accepted" line would advertise it:
    ///   • one that differs from the expected answer only in diacritics ("ou" for
    ///     "où") — that is an accent slip, and `.closeAccents` says so;
    ///   • in a fill-blank, one that cannot stand in the blank (see `fitsBlank`);
    ///   • outside a fill-blank, the item's own BLANK form (see `isBlankOnlyForm`) —
    ///     it was authored to fill a hole, not to translate the headword.
    static func acceptedForms(for gap: GapItem, expected: String, kind: QuestionKind) -> [(display: String, normalized: String)] {
        var raw: [String] = [expected]
        raw.append(contentsOf: (gap.acceptedAnswers ?? []).filter {
            kind == .fillBlank ? fitsBlank($0, gap: gap, expected: expected)
                               : !isBlankOnlyForm($0, gap: gap)
        })
        // The headword is an article-leniency alternative ("le pain" for "pain"), so
        // like every other alternative it has to fit the blank: in a fill-blank the
        // sentence already carries the determiner, and "Also accepted: la mère" under
        // "Ma _____ est gentille." advertises "Ma la mère est gentille."
        if kind.isTyped, isArticleLenient(gap), acceptsHeadword(gap, expected: expected),
           kind != .fillBlank || fitsBlank(gap.frenchWord, gap: gap, expected: expected) {
            raw.append(gap.frenchWord)
        }
        // "a / b" glosses: either side is a valid answer.
        for form in raw where form.contains("/") {
            raw.append(contentsOf: form.split(separator: "/").map { String($0) })
        }
        // Dictionary ellipsis notation ("ne... pas", "..., quoi") — the dots stand for
        // the verb the learner is not typing, and no screen asks for them.
        for form in raw {
            raw.append(contentsOf: ellipsisForms(of: form))
        }
        let expectedNorm = normalize(expected)
        var out: [(display: String, normalized: String)] = []
        var seen = Set<String>()
        for form in raw {
            let display = stripTags(foldQuotes(form.precomposedStringWithCanonicalMapping))
                .trimmingCharacters(in: .whitespacesAndNewlines)
            let norm = normalize(form)
            guard !norm.isEmpty, seen.insert(norm).inserted else { continue }
            // An accent-stripped spelling is not a second correct spelling.
            guard norm == expectedNorm || fold(norm) != fold(expectedNorm) else { continue }
            out.append((display: display.isEmpty ? form : display, normalized: norm))
        }
        return out
    }

    /// The accepted forms worth SHOWING after a typed answer ("Also accepted: …").
    ///
    /// Not every form the grader tolerates is a second way to write the answer.
    /// Content alternatives exist so a learner typing on a phone keyboard is not
    /// failed for a separator — "c est" for "c'est", "aujourd hui" for "aujourd'hui",
    /// "là bas" for "là-bas", "du coup," for "du coup" — and printing those back as
    /// "Also accepted" teaches a beginner a spelling that is not French. A form that
    /// is the expected answer once apostrophes, hyphens, spacing, punctuation and
    /// accents are ignored is typing tolerance: still accepted, never advertised —
    /// the same treatment an accent-stripped alternative gets in `acceptedForms`.
    static func displayAlternatives(for gap: GapItem, expected: String, kind: QuestionKind) -> [String] {
        guard kind.isTyped else { return [] }
        let expectedNorm = normalize(expected)
        let expectedKey = spellingKey(expectedNorm)
        return acceptedForms(for: gap, expected: expected, kind: kind)
            .filter { $0.normalized != expectedNorm && spellingKey($0.normalized) != expectedKey }
            .map { $0.display }
    }

    /// A form's letters and digits alone, accents folded: what is left of a spelling
    /// once every separator a typing learner may miss (apostrophe, hyphen, space,
    /// comma) is gone. Two forms with the same key are the same spelling typed
    /// differently, not two spellings.
    static func spellingKey(_ s: String) -> String {
        fold(s).filter { $0.isLetter || $0.isNumber }
    }

    /// Ellipsis in a headword ("ne... pas", "n'... pas", "..., quoi") is dictionary
    /// notation for a frame that wraps around a word, not a spelling: the dots are
    /// never shown as required anywhere, and a learner asked to translate "not" types
    /// "ne pas". This returns the spellings that are the SAME answer with the dots
    /// gone — the collapsed frame, trimmed of the punctuation the dots left behind
    /// ("..., quoi" → "quoi"). Empty for a form with no ellipsis.
    static func ellipsisForms(of form: String) -> [String] {
        guard form.range(of: ellipsisPattern, options: .regularExpression) != nil else { return [] }
        let collapsed = trimmingEdgePunctuation(
            form.replacingOccurrences(of: ellipsisPattern, with: " ", options: .regularExpression))
        guard !collapsed.isEmpty, normalize(collapsed) != normalize(form) else { return [] }
        return [collapsed]
    }

    /// An ellipsis (".." or more, or "…") with the spaces around it.
    private static let ellipsisPattern = #"\s*(?:\.{2,}|…)\s*"#

    /// Drop the whitespace and the sentence punctuation an ellipsis leaves at either
    /// end of a form (", quoi" → "quoi").
    private static func trimmingEdgePunctuation(_ s: String) -> String {
        s.trimmingCharacters(in: CharacterSet(charactersIn: " ,;:.…\u{00A0}\u{202F}\u{2009}\n\t"))
    }

    /// Whether a content alternative can stand in a fill-blank's blank.
    ///
    /// `alts` are authored for the translation format — "parle" for "je parle",
    /// "les chats" for "chats", "se laver" for "me lave" — so dropping or adding a
    /// word the sentence around the blank already supplies ("Au travail, _____
    /// anglais." → "Au travail, parle anglais.") is ungrammatical, and marking it
    /// correct grades away the very pairing the item teaches. An alternative fills
    /// the blank only when it has the same shape as the expected form — the same
    /// number of words, an elision counting as two — and is not the dictionary
    /// headword standing in for the form the item exists to teach.
    static func fitsBlank(_ alternative: String, gap: GapItem, expected: String) -> Bool {
        let alt = words(normalize(alternative)).map(fold)
        let target = words(normalize(expected))
        guard !alt.isEmpty, !target.isEmpty, alt.count == target.count else { return false }
        // The dictionary headword — whole, or its opening words ("se brosser" for
        // "se brosser les dents") — is not the form the item teaches.
        let headword = words(normalize(gap.frenchWord)).map(fold)
        if !headword.isEmpty, alt.count <= headword.count, Array(headword.prefix(alt.count)) == alt,
           !acceptsHeadword(gap, expected: expected) { return false }
        return true
    }

    /// Whether a form is the item's BLANK surface form and nothing else: the spelling
    /// the content authored to fill the hole in its example sentence, DIFFERENT from
    /// the dictionary headword every other format asks for.
    ///
    /// Over a hundred shipped items carry an `alts` entry that is exactly their `blank` —
    /// "mains" under the headword "la main", "verte" under "vert", "vais manger"
    /// under the near-future frame. Those exist so the fill-blank grades its hole;
    /// accepting one for "Translate to French: hand" marks the plural as the
    /// translation of the singular, and `displayAlternatives` then prints
    /// "Also accepted: mains" — teaching the wrong form twice (lesson-8-1).
    ///
    /// False when the blank form is only another SPELLING of the headword — the
    /// headword itself, without its article ("pain" for "le pain"), one side of an
    /// "a / b" gloss, or the dictionary ellipsis collapsed ("quoi" for "..., quoi").
    /// That is the same word, not another form of it.
    static func isBlankOnlyForm(_ form: String, gap: GapItem) -> Bool {
        let blank = normalize(blankForm(for: gap))
        guard !blank.isEmpty, !isHeadwordSpelling(blank, of: gap) else { return false }
        let candidate = normalize(form)
        guard !candidate.isEmpty else { return false }
        return fold(candidate) == fold(blank)
    }

    /// Whether a form is one of the dictionary headword's own spellings: the headword
    /// with or without its article, either side of an "a / b" gloss, or the headword
    /// with the dictionary's ellipsis collapsed ("..., quoi" → "quoi", "ne... pas" →
    /// "ne pas"). Those all answer "what is the French for …?"; a different surface
    /// form of the word does not.
    static func isHeadwordSpelling(_ form: String, of gap: GapItem) -> Bool {
        if acceptsHeadword(gap, expected: form) { return true }
        var spellings: [String] = [gap.frenchWord]
        if gap.frenchWord.contains("/") {
            spellings.append(contentsOf: gap.frenchWord.split(separator: "/").map(String.init))
        }
        let collapsed = spellings.flatMap { ellipsisForms(of: $0) }
        spellings.append(contentsOf: collapsed)
        let key = fold(normalize(form))
        guard !key.isEmpty else { return false }
        return spellings.contains { fold(normalize($0)) == key }
    }

    /// The words of a French form, an elision ("j'ai", "l'eau") counting as two.
    static func words(_ s: String) -> [String] {
        s.split(whereSeparator: { $0 == " " || $0 == "\n" || $0 == "'" || $0 == "\u{2019}" })
            .map(String.init)
            .filter { $0.contains(where: { $0.isLetter || $0.isNumber }) }
    }

    static func wordCount(_ s: String) -> Int { words(s).count }

    /// Whether a string is a cloze: it carries a blank the learner has to fill,
    /// so it has no meaning to ask for and nothing to read aloud.
    static func isCloze(_ s: String) -> Bool {
        s.range(of: #"_{2,}"#, options: .regularExpression) != nil
    }

    /// The runs of underscores in a string — the holes a cloze prompt shows. A
    /// fill-blank has exactly one, spelled `blankToken`: the screen offers a single
    /// text field, so two holes leave the learner unable to say which one they are
    /// filling, and filling both with the one answer prints and speaks a sentence
    /// that is not French (lesson-8-3).
    static func blankRuns(in s: String) -> [String] {
        var out: [String] = []
        var run = 0
        for character in s {
            if character == "_" {
                run += 1
            } else {
                if run >= 2 { out.append(String(repeating: "_", count: run)) }
                run = 0
            }
        }
        if run >= 2 { out.append(String(repeating: "_", count: run)) }
        return out
    }

    /// Whether a prompt shows exactly one hole, spelled the way the app spells it.
    static func hasSingleBlank(_ s: String) -> Bool {
        blankRuns(in: s) == [blankToken]
    }

    /// Whether the dictionary headword is itself an accepted typed answer.
    ///
    /// Article leniency only: "le pain" is accepted when the blank expects "pain".
    /// When the item's blank is a DIFFERENT surface form — "mange" for the headword
    /// "manger", "verte" for "vert" — the headword is wrong, and accepting it would
    /// mark the very conjugation or agreement the item teaches as correct.
    static func acceptsHeadword(_ gap: GapItem, expected: String) -> Bool {
        let expectedNorm = normalize(expected)
        guard !expectedNorm.isEmpty else { return false }
        let headword = normalize(gap.frenchWord)
        if headword.isEmpty { return false }
        if headword == expectedNorm { return true }
        if let bare = strippingArticle(headword), bare == expectedNorm { return true }
        if let expectedBare = strippingArticle(expectedNorm), expectedBare == headword { return true }
        return false
    }

    /// Whether this ITEM's leading article is optional in a typed translation
    /// (lesson-9-3).
    ///
    /// The category comes from the SKILL, not the word, so keying leniency to it alone
    /// makes the rule read as arbitrary: "le riz" glossed "rice" sits in the guttural-r
    /// PRONUNCIATION skill, and a learner typing "riz" for "Translate to French: rice"
    /// was graded wrong while the same noun inside a vocabulary skill was accepted.
    ///
    /// So the decision is made from the item:
    ///   • a vocabulary item stays lenient as before — the skill is about the word;
    ///   • a GRAMMAR item never is: there the determiner is routinely the very thing
    ///     taught ("du pain" vs "pain", "le lundi" = "on Mondays", "des chats");
    ///   • any other skill is lenient only for an ordinary articled noun whose ENGLISH
    ///     gloss carries no determiner of its own ("rice", "France", "work") — when the
    ///     gloss says "the sea" or "a friend", the prompt already names the determiner
    ///     and the answer is expected to carry it (pronunciation "les amis" — the
    ///     liaison item — keeps its article).
    static func isArticleLenient(_ gap: GapItem) -> Bool {
        if gap.category == .vocabulary { return true }
        guard gap.category != .grammar else { return false }
        guard strippingArticle(normalize(gap.frenchWord)) != nil else { return false }
        return !glossCarriesDeterminer(gap.englishTranslation)
    }

    /// Whether an English gloss names a determiner of its own, on either side of an
    /// "a / b" gloss. Parenthetical tags are dropped first ("cats (in general)").
    static func glossCarriesDeterminer(_ gloss: String) -> Bool {
        let words = fold(normalize(gloss)).split(whereSeparator: { !$0.isLetter }).map(String.init)
        return words.contains { englishDeterminers.contains($0) }
    }

    /// English determiners: a gloss carrying one of these is asking for the French
    /// determiner too.
    static let englishDeterminers: Set<String> = ["the", "a", "an", "some", "any", "one", "no",
                                                  "my", "your", "his", "her", "its", "our", "their",
                                                  "this", "that", "these", "those", "each", "every"]

    /// Whether a fill-blank's hint would hand the learner the answer (lesson-9-1).
    ///
    /// A fill-blank's hint is the example's English, and nine shipped items keep the
    /// French form inside it — "Le _____ est en retard." captioned "The train is late."
    /// The learner reads the answer off the caption, and a first-try fill-blank grades
    /// `.easy`, so the free pass pushes the FSRS interval out on a word they may not
    /// know. True when the expected form occurs as a whole word in the hint, with
    /// accents folded so "thé" is caught inside "the tea".
    static func hintRevealsAnswer(_ hint: String, answer: String) -> Bool {
        let form = answer.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !form.isEmpty, !hint.isEmpty else { return false }
        if !wholeWordRanges(of: form, in: hint, caseInsensitive: true).isEmpty { return true }
        return !wholeWordRanges(of: fold(form), in: fold(hint), caseInsensitive: true).isEmpty
    }

    /// A fill-blank hint, or nil when it would reveal the answer.
    static func safeHint(_ hint: String, answer: String) -> String? {
        let trimmed = hint.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !hintRevealsAnswer(trimmed, answer: answer) else { return nil }
        return trimmed
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
        normalize(s, keepingTags: false)
    }

    /// Whether two multiple-choice options are the same answer. Unlike `normalize`,
    /// the parenthetical tag is KEPT: "the (masculine singular)" and
    /// "the (feminine singular)" are the distinction the question is asking about,
    /// so they must never both grade as correct.
    static func optionMatches(_ option: String, _ correctAnswer: String) -> Bool {
        let a = normalize(option, keepingTags: true)
        guard !a.isEmpty else { return false }
        return a == normalize(correctAnswer, keepingTags: true)
    }

    /// Canonical comparison form; `keepingTags` retains parenthetical tags for
    /// option comparison, where the tag is part of the answer.
    static func normalize(_ s: String, keepingTags: Bool) -> String {
        var t = s.precomposedStringWithCanonicalMapping
        t = foldQuotes(t)
        if !keepingTags { t = stripTags(t) }
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
