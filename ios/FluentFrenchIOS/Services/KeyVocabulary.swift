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
