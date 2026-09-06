//
//  ReadingLevelEstimator.swift
//  FluentFrenchIOS
//
//  A rough CEFR band for an un-graded French text (live headlines), from mean
//  sentence length and the share of long words. It is an ESTIMATE and every
//  surface that shows it says so ("≈ B1"); curated pieces carry an authored
//  level and never go through here. Thresholds live in `Tuning`.
//

import Foundation

nonisolated enum ReadingLevelEstimator {
    /// Estimate the band of a body text. Empty or near-empty text reads as B1 —
    /// the typical register of a news paragraph — rather than pretending to know.
    static func estimate(_ text: String) -> CEFRLevel {
        let sentences = SentenceExtractor.sentences(in: text)
        let words = sentences.flatMap { SentenceExtractor.tokens(in: $0) }
        guard !sentences.isEmpty, words.count >= 6 else { return .B1 }

        let wordsPerSentence = Double(words.count) / Double(sentences.count)
        var band: CEFRLevel
        switch wordsPerSentence {
        case ..<Tuning.readabilityA2WordsPerSentence: band = .A1
        case ..<Tuning.readabilityB1WordsPerSentence: band = .A2
        case ..<Tuning.readabilityB2WordsPerSentence: band = .B1
        default: band = .B2
        }

        let longShare = Double(words.filter { $0.count >= Tuning.readabilityLongWordLength }.count) / Double(words.count)
        if longShare >= Tuning.readabilityLongWordShare, let up = next(after: band) {
            band = up
        }
        return band
    }

    private static func next(after level: CEFRLevel) -> CEFRLevel? {
        let all = CEFRLevel.allCases
        guard let i = all.firstIndex(of: level), i + 1 < all.count else { return nil }
        return all[i + 1]
    }
}
