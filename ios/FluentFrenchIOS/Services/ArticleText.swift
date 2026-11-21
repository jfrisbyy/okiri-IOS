//
//  ArticleText.swift
//  FluentFrenchIOS
//
//  Pure text decisions for live news articles, shared by the decoder and the
//  reader so both agree: what counts as readable body text (an article with
//  none is dropped rather than opened as a blank page), and whether the
//  service's summary is worth a context box or is merely the body repeated.
//  View-free and network-free — the only thing here is the text.
//

import Foundation

nonisolated enum ArticleText {
    /// NewsAPI truncates `content` and marks the cut with "[+1234 chars]".
    private static let truncationMarker = #"\[\+\d+ chars\]"#

    /// The readable body for a live article, or nil when the service sent
    /// nothing to read. Prefers the (truncated) full text, falls back to the
    /// description, and returns nil when both are empty — a story with no
    /// words is a dead end for a reader, not a story.
    static func body(content: String?, description: String?) -> String? {
        let raw = content ?? ""
        let wasCut = raw.range(of: truncationMarker, options: .regularExpression) != nil
        var full = raw
            .replacingOccurrences(of: truncationMarker, with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if wasCut { full = droppingCutWord(full) }
        if !full.isEmpty { return full }
        let summary = (description ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return summary.isEmpty ? nil : summary
    }

    /// The excerpt without the word the service's cut went through (read-10-4).
    ///
    /// NewsAPI cuts `content` at a fixed character count, usually mid-word, and
    /// puts "…" straight after the cut: "dans les infrastructures ferroviai…". Left
    /// in, the fragment ended the excerpt, became a Key Vocabulary chip and could be
    /// saved as a card for a word that does not exist. Whether the last word before
    /// the "…" is whole cannot be told from the text, so it is always dropped,
    /// together with any punctuation the cut leaves dangling, and the "…" put back.
    /// A cut that falls after the end of a sentence (the excerpt ends "prêt. …")
    /// cut no word, and only the ellipsis is normalised.
    private static func droppingCutWord(_ text: String) -> String {
        var core = text
        while let last = core.last, ellipsis.contains(last) { core.removeLast() }
        guard core.count < text.count || !core.isEmpty else { return text }
        if let last = core.last, last.isWhitespace || sentenceEnds.contains(last) {
            core = core.trimmingCharacters(in: .whitespacesAndNewlines)
            return core.isEmpty ? "" : core + " …"
        }
        guard let space = core.lastIndex(where: { $0.isWhitespace }) else { return "" }
        core = String(core[..<space]).trimmingCharacters(in: danglingPunctuation)
        guard !core.isEmpty else { return "" }
        if let last = core.last, sentenceEnds.contains(last) { return core + " …" }
        return core + "…"
    }

    /// The characters a service writes for "the text goes on".
    private static let ellipsis: Set<Character> = ["…", "."]
    /// Characters that close a sentence, so the word before them is whole.
    private static let sentenceEnds: Set<Character> = [".", "!", "?", "»", "\"", ")"]
    /// What a dropped word can leave hanging at the end of the excerpt.
    private static let danglingPunctuation = CharacterSet(charactersIn: " ,;:-–—«(\n\t'’")

    /// The summary to show above the body, or nil when showing it would just
    /// print the body's opening a second time (the service commonly sends the
    /// description as the whole of `content`).
    static func contextSummary(summary: String, body: String) -> String? {
        let s = summary.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !s.isEmpty else { return nil }
        let b = body.trimmingCharacters(in: .whitespacesAndNewlines)
        return b.hasPrefix(s) ? nil : s
    }
}
