//
//  YouTubeService.swift
//  FluentFrenchIOS
//
//  Live French YouTube data via the YouTube Data API v3 (public client key from
//  Config). Every call answers with a typed result the Watch screen renders
//  honestly: live videos, or — for the trending feed only — the curated
//  catalogue together with the reason live results are missing (no key,
//  offline, service error). A search never substitutes curated content, and
//  every request is bounded by `Tuning.videoFeedTimeout` (E19 / E26).
//

import Foundation

nonisolated enum YouTubeService {
    static var categories: [YTCategory] { WatchCatalog.categories }
    static var suggestedSearches: [(query: String, label: String)] { WatchCatalog.suggestedSearches }

    private static let base = "https://www.googleapis.com/youtube/v3"
    private static var apiKey: String { Config.EXPO_PUBLIC_YOUTUBE_API_KEY }

    static var hasKey: Bool { !apiKey.isEmpty }

    /// Trending videos in France for a category. Falls back to the curated list
    /// (possibly empty) with the reason, never silently. A successful answer
    /// with no videos is `.live([])` — the service worked, the category is
    /// empty — not an error to retry (EM-6).
    static func trending(categoryId: String) async -> VideoFeedResult {
        guard hasKey else { return .curated(WatchCatalog.curated(for: categoryId), reason: .noKey) }
        let urlStr = "\(base)/videos?part=snippet,contentDetails,statistics&chart=mostPopular&regionCode=FR&maxResults=15&videoCategoryId=\(categoryId)&key=\(apiKey)"
        guard let url = URL(string: urlStr) else {
            return .curated(WatchCatalog.curated(for: categoryId), reason: .serviceError)
        }
        switch await list(url) {
        case .success(let videos):
            return .live(videos)
        case .failure(let failure):
            return .curated(WatchCatalog.curated(for: categoryId), reason: failure)
        }
    }

    /// Search French-language videos. An empty result list is a real answer.
    static func search(_ query: String) async -> VideoSearchResult {
        guard hasKey else { return .unavailable(.noKey) }
        guard let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "\(base)/search?part=snippet&q=\(encoded)&type=video&maxResults=20&relevanceLanguage=fr&regionCode=FR&key=\(apiKey)")
        else { return .unavailable(.serviceError) }
        let request = makeRequest(url)
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            if let failure = statusFailure(response) { return .unavailable(failure) }
            let decoded = try JSONDecoder().decode(YTSearchResponse.self, from: data)
            let ids = decoded.items.compactMap { $0.id.videoId }
            guard !ids.isEmpty else { return .results([]) }
            switch await details(for: ids) {
            case .success(let videos): return .results(videos)
            case .failure(let failure): return .unavailable(failure)
            }
        } catch {
            return .unavailable(MediaServiceFailure.classify(error))
        }
    }

    // MARK: - Transport

    private static func details(for ids: [String]) async -> Result<[YTVideo], MediaServiceFailure> {
        guard !ids.isEmpty else { return .success([]) }
        let idStr = ids.joined(separator: ",")
        guard let url = URL(string: "\(base)/videos?part=snippet,contentDetails,statistics&id=\(idStr)&key=\(apiKey)") else {
            return .failure(.serviceError)
        }
        return await list(url)
    }

    private static func list(_ url: URL) async -> Result<[YTVideo], MediaServiceFailure> {
        let request = makeRequest(url)
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            if let failure = statusFailure(response) { return .failure(failure) }
            let decoded = try JSONDecoder().decode(YTListResponse.self, from: data)
            return .success(decoded.items.compactMap { $0.toVideo() })
        } catch {
            return .failure(MediaServiceFailure.classify(error))
        }
    }

    private static func makeRequest(_ url: URL) -> URLRequest {
        var request = URLRequest(url: url)
        request.timeoutInterval = Tuning.videoFeedTimeout
        return request
    }

    private static func statusFailure(_ response: URLResponse) -> MediaServiceFailure? {
        guard let http = response as? HTTPURLResponse else { return .serviceError }
        return MediaServiceFailure.classify(statusCode: http.statusCode)
    }

    static func thumb(_ id: String) -> String { YouTubeVideoID.thumbnail(id) }

    static func watchURL(_ id: String) -> URL? { YouTubeVideoID.watchURL(id) }
}

// MARK: - Decoding

nonisolated struct YTListResponse: Decodable {
    let items: [YTItem]
}
nonisolated struct YTSearchResponse: Decodable {
    let items: [YTSearchItem]
}
nonisolated struct YTSearchItem: Decodable {
    struct ID: Decodable { let videoId: String? }
    let id: ID
}
nonisolated struct YTItem: Decodable {
    struct Snippet: Decodable {
        let title: String?
        let channelTitle: String?
        struct Thumb: Decodable { let url: String? }
        struct Thumbs: Decodable { let medium: Thumb?; let `default`: Thumb? }
        let thumbnails: Thumbs?
    }
    struct Content: Decodable { let duration: String? }
    struct Stats: Decodable { let viewCount: String? }
    let id: String?
    let snippet: Snippet?
    let contentDetails: Content?
    let statistics: Stats?

    /// A live item becomes a video only when its id is well formed.
    func toVideo() -> YTVideo? {
        guard let id, YouTubeVideoID.isValid(id), let snippet else { return nil }
        let thumb = snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ?? YouTubeVideoID.thumbnail(id)
        return YTVideo(
            videoId: id,
            title: snippet.title ?? "Untitled",
            channel: snippet.channelTitle ?? "Unknown channel",
            thumbnailUrl: thumb,
            durationSeconds: YouTubeDuration.seconds(fromISO: contentDetails?.duration),
            views: Int(statistics?.viewCount ?? "0") ?? 0
        )
    }
}
