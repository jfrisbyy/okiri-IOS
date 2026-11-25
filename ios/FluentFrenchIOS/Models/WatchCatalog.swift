//
//  WatchCatalog.swift
//  FluentFrenchIOS
//
//  The Watch feature's value types and its bundled catalogue: the categories
//  the feed groups by, the suggested searches, and the curated videos shown
//  when live results are unavailable (E19). Pure data — no networking — so the
//  Linux harness can validate every curated id.
//
//  Curated entries are kept ONLY when their title and channel identify them as
//  French-learning content. An id is never substituted: an entry whose id does
//  not look like a YouTube id is dropped, and a category with no justified
//  entries is simply empty (the view shows an honest empty state).
//

import Foundation

nonisolated struct YTVideo: Identifiable, Hashable, Sendable {
    let videoId: String
    let title: String
    let channel: String
    let thumbnailUrl: String
    let durationSeconds: Int
    let views: Int
    var id: String { videoId }

    var durationLabel: String {
        guard durationSeconds > 0 else { return "" }
        let h = durationSeconds / 3600
        let m = (durationSeconds % 3600) / 60
        let s = durationSeconds % 60
        if h > 0 { return String(format: "%d:%02d:%02d", h, m, s) }
        return String(format: "%d:%02d", m, s)
    }

    var viewsLabel: String {
        if views >= 1_000_000 { return String(format: "%.1fM views", Double(views) / 1_000_000) }
        if views >= 1_000 { return "\(views / 1_000)K views" }
        if views > 0 { return "\(views) views" }
        return ""
    }
}

nonisolated struct YTCategory: Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let emoji: String
}

/// YouTube video ids: exactly eleven URL-safe base64 characters.
nonisolated enum YouTubeVideoID {
    static let length = 11

    static func isValid(_ id: String) -> Bool {
        guard id.count == length else { return false }
        return id.unicodeScalars.allSatisfy { scalar in
            ("A"..."Z").contains(scalar) || ("a"..."z").contains(scalar) || ("0"..."9").contains(scalar)
                || scalar == "_" || scalar == "-"
        }
    }

    static func thumbnail(_ id: String) -> String { "https://img.youtube.com/vi/\(id)/mqdefault.jpg" }

    static func watchURL(_ id: String) -> URL? { URL(string: "https://www.youtube.com/watch?v=\(id)") }
}

/// Parses YouTube's ISO-8601 duration ("PT1H2M3S") into seconds.
nonisolated enum YouTubeDuration {
    static func seconds(fromISO iso: String?) -> Int {
        guard let iso else { return 0 }
        var hours = 0, minutes = 0, seconds = 0
        let scanner = iso.replacingOccurrences(of: "PT", with: "")
        var number = ""
        for ch in scanner {
            if ch.isNumber { number.append(ch) }
            else {
                let n = Int(number) ?? 0
                if ch == "H" { hours = n } else if ch == "M" { minutes = n } else if ch == "S" { seconds = n }
                number = ""
            }
        }
        return hours * 3600 + minutes * 60 + seconds
    }
}

nonisolated enum WatchCatalog {
    /// YouTube Data API category ids the feed groups by.
    static let categories: [YTCategory] = [
        YTCategory(id: "27", name: "Education", emoji: "📚"),
        YTCategory(id: "10", name: "Music", emoji: "🎵"),
        YTCategory(id: "24", name: "Entertainment", emoji: "🎬"),
        YTCategory(id: "17", name: "Sports", emoji: "⚽"),
    ]

    static let suggestedSearches: [(query: String, label: String)] = [
        ("apprendre le français", "Learn French"),
        ("film français complet", "French Films"),
        ("podcast français facile", "Easy Podcasts"),
        ("actualités france", "French News"),
        ("cuisine française recette", "French Recipes"),
        ("musique française 2025", "French Music"),
    ]

    /// One curated entry as authored: the id is validated before it is offered.
    nonisolated struct CuratedEntry: Hashable {
        let videoId: String
        let title: String
        let channel: String
        let durationSeconds: Int
    }

    /// The curated list, by category id. An entry is listed ONLY once a person
    /// has confirmed the id resolves to French-learning content and copied its
    /// title and channel from YouTube's own answer:
    ///   https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>&format=json
    /// Nothing is re-pointed at another id, and view counts are never invented.
    ///
    /// The list is EMPTY for beta: the original three Education ids
    /// (tQKkR-EBh3E, 0yzZGz5Vg7Y, 5MgBikgcWnY) came from the same unverified
    /// source as the corrupted id this shelf used to ship, and could not be
    /// checked from the build environment (E19 — drop what can't be verified).
    /// The Watch feed renders an honest empty section until entries are
    /// verified and added back here.
    static let curatedEntries: [String: [CuratedEntry]] = [:]

    /// Curated videos for exactly this category (no substitution from another
    /// category), with every malformed id dropped. Empty when nothing is justified.
    static func curated(for categoryId: String) -> [YTVideo] {
        (curatedEntries[categoryId] ?? []).compactMap { entry in
            guard YouTubeVideoID.isValid(entry.videoId) else { return nil }
            return YTVideo(
                videoId: entry.videoId,
                title: entry.title,
                channel: entry.channel,
                thumbnailUrl: YouTubeVideoID.thumbnail(entry.videoId),
                durationSeconds: entry.durationSeconds,
                views: 0
            )
        }
    }
}
