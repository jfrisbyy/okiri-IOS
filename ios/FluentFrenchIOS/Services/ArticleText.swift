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
        let full = (content ?? "")
            .replacingOccurrences(of: truncationMarker, with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if !full.isEmpty { return full }
        let summary = (description ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return summary.isEmpty ? nil : summary
    }

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
