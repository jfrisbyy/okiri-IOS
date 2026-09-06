//
//  NewsService.swift
//  FluentFrenchIOS
//
//  Live French headlines via NewsAPI.org (public client key from Config). Every
//  call answers with a typed result so the feed can tell "live", "curated because
//  there is no key / no network / the service failed" and "search found nothing"
//  apart and render each honestly (E22, E26). Live articles get an ESTIMATED
//  level (`ReadingLevelEstimator`) — never a hard-coded one (E20).
//

import Foundation

nonisolated struct NewsArticle: Identifiable, Hashable {
    let id: String
    let title: String
    let summary: String
    let source: String
    let category: NewsCategory
    let region: ReadRegionGroup
    let imageUrl: String?
    let publishedAt: Date
    let body: String
    /// The article's web address (also the basis of `id`); nil for curated pieces.
    var url: String? = nil
    /// Curated fallback pieces carry an authored level; live articles an estimate.
    var level: CEFRLevel = .B1
    /// True when `level` was estimated from the text rather than authored.
    var isLevelEstimated: Bool = false
    /// True when `body` is the opening excerpt the news service hands out
    /// rather than the whole piece — live articles always are, curated ones
    /// never are. The reader says so and offers the source (E26).
    var isExcerpt: Bool = false

    /// The summary to show as a context box, or nil when it would only repeat
    /// the body's opening.
    var contextSummary: String? { ArticleText.contextSummary(summary: summary, body: body) }

    var timeAgo: String {
        let diff = Date().timeIntervalSince(publishedAt)
        let hours = Int(diff / 3600)
        let days = Int(diff / 86_400)
        if hours < 1 { return "Just now" }
        if hours < 24 { return "\(hours)h ago" }
        if days == 1 { return "Yesterday" }
        return "\(days)d ago"
    }

    /// "B1" for an authored level, "≈ B1" for an estimate.
    var levelLabel: String { isLevelEstimated ? "≈ \(level.rawValue)" : level.rawValue }

    /// A stable id from the article's URL (E23); falls back to source + title
    /// when the API sent no URL.
    static func id(url: String?, title: String, source: String?) -> String {
        if let url, !url.trimmingCharacters(in: .whitespaces).isEmpty {
            return url.trimmingCharacters(in: .whitespaces)
        }
        return "\(source ?? "")|\(title)"
    }
}

nonisolated enum NewsCategory: String, CaseIterable, Identifiable {
    case all, politics, culture, sports, science, economy, society, environment, technology
    var id: String { rawValue }
    var label: String {
        switch self {
        case .all: return "All"
        case .technology: return "Tech"
        case .environment: return "Environ."
        default: return rawValue.capitalized
        }
    }
    var hex: String {
        switch self {
        case .all: return "6B7280"
        case .politics: return "DC2626"
        case .culture: return "8B5CF6"
        case .sports: return "059669"
        case .science: return "2563EB"
        case .economy: return "D97706"
        case .society: return "EC4899"
        case .environment: return "10B981"
        case .technology: return "6366F1"
        }
    }
    /// NewsAPI query terms biased toward French-speaking coverage.
    var query: String {
        switch self {
        case .all: return "france"
        case .politics: return "politique France"
        case .culture: return "culture française"
        case .sports: return "sport France"
        case .science: return "science"
        case .economy: return "économie France"
        case .society: return "société France"
        case .environment: return "environnement"
        case .technology: return "technologie"
        }
    }
}

// MARK: - Typed results

/// Why live headlines could not be fetched. The feed still shows the curated
/// set, with a banner naming the reason and (when it can help) a retry.
nonisolated enum NewsFailure: Hashable {
    case notConfigured
    case offline
    case serviceError

    var isRetryable: Bool { self != .notConfigured }

    /// The feed banner.
    var message: String {
        switch self {
        case .notConfigured: return "Live headlines aren't available in this build — here are curated stories instead."
        case .offline: return "You're offline — showing curated stories. Live headlines return when you reconnect."
        case .serviceError: return "Couldn't load live headlines right now — showing curated stories instead."
        }
    }

    /// The search state.
    var searchTitle: String {
        switch self {
        case .notConfigured: return "Search isn't available in this build"
        case .offline: return "You're offline"
        case .serviceError: return "Search didn't go through"
        }
    }

    var searchMessage: String {
        switch self {
        case .notConfigured: return "Live search needs a news connection this copy of the app doesn't have. The curated library still works."
        case .offline: return "Check your connection and try again."
        case .serviceError: return "The news service didn't answer. Try again in a moment."
        }
    }
}

/// The feed for a category.
nonisolated enum NewsFeedResult: Hashable {
    /// Fresh headlines from the live service.
    case live([NewsArticle])
    /// The curated set, because live headlines were unavailable for `reason`.
    case curated([NewsArticle], reason: NewsFailure)

    var articles: [NewsArticle] {
        switch self {
        case .live(let a), .curated(let a, _): return a
        }
    }

    var failure: NewsFailure? {
        if case .curated(_, let reason) = self { return reason }
        return nil
    }
}

/// A search outcome — "no results" and "the search failed" are different states.
nonisolated enum NewsSearchResult: Hashable {
    case results([NewsArticle])
    case noResults
    case failed(NewsFailure)
}

// MARK: - Service

nonisolated enum NewsService {
    private static var apiKey: String { Config.EXPO_PUBLIC_NEWSAPI_KEY }
    static var hasKey: Bool { !apiKey.isEmpty }

    static func fetch(category: NewsCategory) async -> NewsFeedResult {
        guard hasKey else { return .curated(curated(for: category), reason: .notConfigured) }
        guard let encoded = category.query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://newsapi.org/v2/everything?q=\(encoded)&language=fr&sortBy=publishedAt&pageSize=20&apiKey=\(apiKey)")
        else { return .curated(curated(for: category), reason: .serviceError) }
        do {
            let (data, response) = try await URLSession.shared.data(for: request(url))
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                return .curated(curated(for: category), reason: .serviceError)
            }
            let decoded = try JSONDecoder().decode(NewsAPIResponse.self, from: data)
            let articles = decoded.articles.compactMap { $0.toArticle(category: category) }
            // An empty live answer is a service gap, not "no news in France today".
            return articles.isEmpty ? .curated(curated(for: category), reason: .serviceError) : .live(articles)
        } catch {
            let reason: NewsFailure = NetworkErrors.isOffline(error) ? .offline : .serviceError
            return .curated(curated(for: category), reason: reason)
        }
    }

    static func search(_ query: String) async -> NewsSearchResult {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return .noResults }
        guard hasKey else {
            // No live search: match against the curated set so the box still does something honest.
            let local = curated(for: .all).filter { $0.title.localizedCaseInsensitiveContains(q) || $0.summary.localizedCaseInsensitiveContains(q) }
            return local.isEmpty ? .failed(.notConfigured) : .results(local)
        }
        guard let encoded = q.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://newsapi.org/v2/everything?q=\(encoded)&language=fr&sortBy=relevancy&pageSize=20&apiKey=\(apiKey)")
        else { return .failed(.serviceError) }
        do {
            let (data, response) = try await URLSession.shared.data(for: request(url))
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return .failed(.serviceError) }
            let decoded = try JSONDecoder().decode(NewsAPIResponse.self, from: data)
            let results = decoded.articles.compactMap { $0.toArticle(category: .all) }
            return results.isEmpty ? .noResults : .results(results)
        } catch {
            return .failed(NetworkErrors.isOffline(error) ? .offline : .serviceError)
        }
    }

    private static func request(_ url: URL) -> URLRequest {
        var request = URLRequest(url: url)
        request.timeoutInterval = Tuning.newsTimeoutSeconds
        return request
    }

    // MARK: - Curated fallback headlines

    static func curated(for category: NewsCategory) -> [NewsArticle] {
        let now = Date()
        let base: [NewsArticle] = [
            NewsArticle(id: "n1", title: "La France investit massivement dans l'énergie renouvelable", summary: "Un nouveau plan vise à doubler la capacité solaire et éolienne du pays d'ici 2030.", source: "Le Monde", category: .environment, region: .europe, imageUrl: nil, publishedAt: now.addingTimeInterval(-3600), body: "Le gouvernement français a annoncé un investissement record dans les énergies renouvelables. Ce plan ambitieux prévoit la construction de nouveaux parcs solaires et éoliens partout dans le pays. Les experts estiment que cela pourrait créer des milliers d'emplois tout en réduisant les émissions de carbone.", level: .B1),
            NewsArticle(id: "n2", title: "Une nouvelle exposition au Louvre attire les foules", summary: "Le musée présente des œuvres jamais montrées au public.", source: "France Culture", category: .culture, region: .europe, imageUrl: nil, publishedAt: now.addingTimeInterval(-7200), body: "Le musée du Louvre inaugure une exposition exceptionnelle cet été. Les visiteurs peuvent y découvrir des chefs-d'œuvre rarement exposés. La file d'attente s'étend déjà sur plusieurs centaines de mètres dès l'ouverture.", level: .B1),
            NewsArticle(id: "n3", title: "La technologie transforme notre quotidien", summary: "Les nouvelles intelligences artificielles changent la façon dont nous travaillons.", source: "Les Échos", category: .technology, region: .europe, imageUrl: nil, publishedAt: now.addingTimeInterval(-10800), body: "Les avancées technologiques récentes bouleversent de nombreux secteurs. Des entreprises françaises développent des outils innovants qui simplifient le travail quotidien. Cependant, certains s'inquiètent de l'impact sur l'emploi.", level: .B1),
            NewsArticle(id: "n4", title: "L'équipe de France se qualifie pour la finale", summary: "Une victoire spectaculaire en demi-finale.", source: "L'Équipe", category: .sports, region: .europe, imageUrl: nil, publishedAt: now.addingTimeInterval(-14400), body: "Les Bleus ont décroché leur place en finale après un match palpitant. Les supporters ont envahi les rues pour célébrer cette victoire historique. Le sélectionneur a salué l'esprit d'équipe de ses joueurs.", level: .A2),
            NewsArticle(id: "n5", title: "Le Sénégal accueille un sommet sur l'éducation", summary: "Des dirigeants africains se réunissent à Dakar.", source: "RFI Afrique", category: .society, region: .africa, imageUrl: nil, publishedAt: now.addingTimeInterval(-18000), body: "Dakar accueille cette semaine un sommet majeur sur l'avenir de l'éducation en Afrique francophone. Les participants discutent des moyens d'améliorer l'accès à l'école pour tous les enfants du continent.", level: .B1),
            NewsArticle(id: "n6", title: "Le Québec lance un programme d'immersion française", summary: "Une initiative pour attirer les nouveaux arrivants.", source: "Radio-Canada", category: .society, region: .canada, imageUrl: nil, publishedAt: now.addingTimeInterval(-21600), body: "Le gouvernement québécois met en place un nouveau programme pour faciliter l'apprentissage du français. Les nouveaux arrivants pourront suivre des cours gratuits afin de mieux s'intégrer dans la société québécoise.", level: .A2),
            NewsArticle(id: "n7", title: "L'économie française montre des signes de reprise", summary: "La croissance dépasse les prévisions ce trimestre.", source: "Le Figaro", category: .economy, region: .europe, imageUrl: nil, publishedAt: now.addingTimeInterval(-25200), body: "Les derniers chiffres économiques sont encourageants. La consommation des ménages repart à la hausse et le chômage recule légèrement. Les analystes restent toutefois prudents face aux incertitudes mondiales.", level: .B2),
            NewsArticle(id: "n8", title: "Découverte scientifique majeure à Paris", summary: "Des chercheurs annoncent une avancée prometteuse.", source: "Sciences et Avenir", category: .science, region: .europe, imageUrl: nil, publishedAt: now.addingTimeInterval(-28800), body: "Une équipe de chercheurs parisiens a réalisé une découverte qui pourrait révolutionner la médecine. Leurs travaux, publiés dans une revue internationale, ouvrent de nouvelles perspectives thérapeutiques.", level: .B2),
        ]
        if category == .all { return base }
        let filtered = base.filter { $0.category == category }
        return filtered.isEmpty ? base : filtered
    }
}

// MARK: - Decoding

nonisolated struct NewsAPIResponse: Decodable {
    let articles: [NewsAPIArticle]
}

nonisolated struct NewsAPIArticle: Decodable {
    let title: String?
    let description: String?
    let content: String?
    let url: String?
    let urlToImage: String?
    let publishedAt: String?
    struct Src: Decodable { let name: String? }
    let source: Src?

    func toArticle(category: NewsCategory) -> NewsArticle? {
        guard let title, !title.isEmpty, title != "[Removed]" else { return nil }
        let formatter = ISO8601DateFormatter()
        let date = formatter.date(from: publishedAt ?? "") ?? Date()
        let summary = (description ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        // No readable text means a blank reader — drop the headline instead (E22).
        guard let text = ArticleText.body(content: content, description: description) else { return nil }
        return NewsArticle(
            id: NewsArticle.id(url: url, title: title, source: source?.name),
            title: title,
            summary: summary,
            source: source?.name ?? "Actualités",
            category: category == .all ? .society : category,
            region: .europe,
            imageUrl: urlToImage,
            publishedAt: date,
            body: text,
            url: url,
            level: ReadingLevelEstimator.estimate([title, summary, text].joined(separator: " ")),
            isLevelEstimated: true,
            isExcerpt: true
        )
    }
}
