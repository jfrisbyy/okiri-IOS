//
//  KeyVocabulary.swift
//  FluentFrenchIOS
//
//  Which words of a piece the reader offers as "Key Vocabulary" (read-4-1).
//  Every chip is one tap from a gloss and a deck card, so the list has to hold
//  words a learner can actually look up and keep: an elided chunk
//  ("d'améliorer", "j'adore") is not a headword, and a name (Carthage,
//  Montmartre) is not vocabulary. Pure string logic, view-free and testable —
//  the reader only renders what this returns.
//

import Foundation

nonisolated enum KeyVocabulary {
    /// Elided words that are a separate word from what follows them, so
    /// "l'issue" offers "issue". A word that merely contains an apostrophe
    /// ("aujourd'hui") is one word and stays whole.
    private static let elisions: Set<String> = [
        "l", "d", "j", "n", "s", "c", "t", "m", "qu",
        "jusqu", "lorsqu", "puisqu", "quoiqu", "presqu", "quelqu",
    ]

    /// Words that carry a sentence rather than teach anything — never a chip.
    private static let stopwords: Set<String> = [
        "dans", "pour", "avec", "cette", "leur", "leurs", "vous", "nous", "elles",
        "comme", "mais", "donc", "alors", "aussi", "plus", "très", "être", "avoir",
        "fait", "tout", "tous", "toute", "toutes", "sans", "sous", "entre", "depuis",
        "selon", "après", "avant", "pendant", "lorsque", "parce", "quand", "encore",
    ]

    /// The stopwords in the same folded form tokens are compared in.
    private static let stopwordKeys: Set<String> = Set(stopwords.map(SentenceExtractor.fold))

    /// Characters trimmed from both ends of a word before it becomes a chip.
    private static let edgePunctuation = CharacterSet(charactersIn: " .,!?;:«»\"'()[]—–…-\n\t")

    /// The words a piece offers, in the order they are met, each offered once:
    /// content words of at least `minimumLength` letters, with elisions split
    /// off and names dropped. A capitalised word inside a sentence is a name
    /// (Carthage, la Méditerranée); a capitalised word that merely opens a
    /// sentence is offered in its dictionary spelling ("Fondée" → "fondée").
    static func words(in text: String,
                      minimumLength: Int = Tuning.keyVocabularyMinLength,
                      limit: Int = Tuning.keyVocabularyCount) -> [String] {
        var names: Set<String> = []
        var candidates: [(display: String, key: String)] = []
        for sentence in SentenceExtractor.sentences(in: text) {
            for (position, token) in surfaceTokens(in: sentence).enumerated() {
                let key = SentenceExtractor.fold(token)
                guard !key.isEmpty else { continue }
                let capitalised = token.first?.isUppercase == true
                if capitalised && position > 0 {
                    names.insert(key)
                    continue
                }
                candidates.append((capitalised ? lowercasingFirst(token) : token, key))
            }
        }

        var seen: Set<String> = []
        var result: [String] = []
        for candidate in candidates {
            guard candidate.display.count >= minimumLength,
                  isWordLike(candidate.display),
                  !names.contains(candidate.key),
                  !stopwordKeys.contains(candidate.key),
                  seen.insert(candidate.key).inserted else { continue }
            result.append(candidate.display)
            if result.count >= limit { break }
        }
        return result
    }

    /// The headword form of ONE word as the reader met it, so tapping
    /// "l'énergie" in the body and tapping the "énergie" chip save the SAME deck
    /// card (read-5-1): edge punctuation and a leading elision come off
    /// ("d'experts" → "experts", "J'ai" → "ai"), and a capital that merely opens
    /// a sentence is un-capitalised ("Fondée" → "fondée"). A capital that
    /// survives an elision ("L'Europe" → "Europe") or sits inside a sentence is
    /// a name and is kept. Phrases are not headwords — pass a single word.
    static func headword(for word: String, opensSentence: Bool = false) -> String {
        let normalised = word
            .replacingOccurrences(of: "’", with: "'")
            .trimmingCharacters(in: edgePunctuation)
        let stripped = stripElision(normalised)
        guard opensSentence, !stripped.isEmpty, stripped.count == normalised.count else { return stripped }
        return lowercasingFirst(stripped)
    }

    /// Whether the deck holds this reader headword under its OWN key — the test a
    /// surface makes before it knows what the word means (the body underline, the
    /// Key Vocabulary checkmark). `savedKeys` is `AppStore.savedHeadwordKeys()`.
    ///
    /// Read-10-5 also counted the deck's article forms here ("matin" saved because
    /// the deck holds "le matin"), but a spelling with an article is not the same
    /// word: "été" in "a été" ("been") was marked saved because Foundation seeds
    /// "l'été" ("summer"), "lit" ("reads") because of "le lit", "porte"
    /// ("carries") because of "la porte" — and the word sheet then refused to save
    /// it (read-11-5). An article form counts only once the meanings are known to
    /// agree: `isSaved(_:meaning:in:)`.
    static func isSaved(_ headword: String, in savedKeys: Set<String>) -> Bool {
        guard let own = deckKeys(for: headword).first else { return false }
        return savedKeys.contains(own)
    }

    /// Whether the deck already holds this headword, with or without an article,
    /// AS THIS MEANING (read-10-5, read-11-5). `savedMeanings` is
    /// `AppStore.savedHeadwordMeanings()`; `meaning` is the gloss the word sheet
    /// looked up. The deck keys cards by headword with its article kept ("le
    /// matin" — Foundation seeds every item that way) while the reader looks a
    /// tapped word up bare, so "matin" ("morning") is the deck's "le matin" ("the
    /// morning") and must not become a second card — but "été" ("been") is not
    /// the deck's "l'été" ("summer").
    static func isSaved(_ headword: String, meaning: String, in savedMeanings: [String: String]) -> Bool {
        let keys = deckKeys(for: headword)
        guard let own = keys.first else { return false }
        if savedMeanings[own] != nil { return true }
        let sides = HeuristicTagger.lexiconSides(of: meaning)
        guard !sides.isEmpty else { return false }
        for key in keys.dropFirst() {
            guard let saved = savedMeanings[key] else { continue }
            if !sides.isDisjoint(with: HeuristicTagger.lexiconSides(of: saved)) { return true }
        }
        return false
    }

    /// The `AppStore.captureKey` spellings a headword may be saved under, its own
    /// key first (read-10-5).
    static func deckKeys(for headword: String) -> [String] {
        let key = AppStore.captureKey(headword)
        guard !key.isEmpty else { return [] }
        var bare = key
        for article in deckArticles where key.hasPrefix(article) && key.count > article.count {
            bare = String(key.dropFirst(article.count))
            break
        }
        var keys = [key]
        if bare != key { keys.append(bare) }
        for article in deckArticles {
            let prefixed = article + bare
            if !keys.contains(prefixed) { keys.append(prefixed) }
        }
        return keys
    }

    /// The articles a deck headword may open with (read-10-5).
    private static let deckArticles = ["le ", "la ", "les ", "l'", "un ", "une "]

    /// The reader's tappable tokens for one line of a body, each with whether it
    /// opens a sentence. Split on EVERY kind of whitespace (read-11-3): French
    /// typography puts a no-break space (U+00A0, U+202F) before : ; ? ! and inside
    /// « », and splitting on U+0020 alone made "« Nous", "dit :" and "pourquoi ?"
    /// single tokens — a "phrase" that skipped the headword rule and was saved as a
    /// dirty duplicate of "nous". A lone mark ("?", "«") is then its own token:
    /// it has no letter, so the reader never offers it, and it hands the
    /// sentence-opening state on to the word after it ("? Nous", "« Nous").
    static func readerTokens(inLine line: String) -> [(text: String, opensSentence: Bool)] {
        var out: [(text: String, opensSentence: Bool)] = []
        var opensSentence = true
        for word in line.split(whereSeparator: { $0.isWhitespace }).map(String.init) {
            out.append((word, opensSentence))
            let isWord = word.contains(where: { $0.isLetter || $0.isNumber })
            opensSentence = CaptureBuilder.endsSentence(word) || (opensSentence && !isWord)
        }
        return out
    }

    /// The words of a sentence as the learner reads them: original spelling and
    /// accents kept (a chip becomes a headword, so "découvert" must not fold to
    /// "decouvert"), edge punctuation dropped, elided articles split off.
    static func surfaceTokens(in sentence: String) -> [String] {
        sentence
            .replacingOccurrences(of: "’", with: "'")
            .split(whereSeparator: { $0.isWhitespace })
            .map { stripElision(String($0).trimmingCharacters(in: edgePunctuation)) }
            .filter { !$0.isEmpty }
    }

    /// Drop leading elided words: "d'améliorer" → "améliorer", "qu'il" → "il",
    /// "aujourd'hui" → "aujourd'hui" (not an elision).
    private static func stripElision(_ token: String) -> String {
        var current = token
        while let apostrophe = current.firstIndex(of: "'") {
            let prefix = SentenceExtractor.fold(String(current[current.startIndex..<apostrophe]))
            guard elisions.contains(prefix) else { break }
            current = String(current[current.index(after: apostrophe)...])
        }
        return current.trimmingCharacters(in: edgePunctuation)
    }

    /// A chip is a word: letters, possibly hyphenated or holding an apostrophe —
    /// never a number ("2030"), a date or a symbol run.
    private static func isWordLike(_ word: String) -> Bool {
        guard word.contains(where: { $0.isLetter }) else { return false }
        return word.allSatisfy { $0.isLetter || $0 == "-" || $0 == "'" }
    }

    /// "Fondée" → "fondée": a sentence-opening capital is punctuation, not spelling.
    private static func lowercasingFirst(_ word: String) -> String {
        guard let first = word.first else { return word }
        return first.lowercased() + word.dropFirst()
    }
}
