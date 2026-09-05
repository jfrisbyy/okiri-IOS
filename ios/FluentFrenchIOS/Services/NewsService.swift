//
//  NewsService.swift
//  FluentFrenchIOS
//
//  Live French headlines via NewsAPI.org (public client key from Config).
//  Falls back to a curated set of French headlines when no key/network.
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

    var timeAgo: String {
        let diff = Date().timeIntervalSince(publishedAt)
        let hours = Int(diff / 3600)
        let days = Int(diff / 86_400)
        if hours < 1 { return "Just now" }
        if hours < 24 { return "\(hours)h ago" }
        if days == 1 { return "Yesterday" }
        return "\(days)d ago"
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

nonisolated enum NewsService {
    private static var apiKey: String { Config.EXPO_PUBLIC_NEWSAPI_KEY }
    static var hasKey: Bool { !apiKey.isEmpty }

    static func fetch(category: NewsCategory) async -> [NewsArticle] {
        guard hasKey,
              let encoded = category.query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://newsapi.org/v2/everything?q=\(encoded)&language=fr&sortBy=publishedAt&pageSize=20&apiKey=\(apiKey)")
        else { return curated(for: category) }
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                return curated(for: category)
            }
            let decoded = try JSONDecoder().decode(NewsAPIResponse.self, from: data)
            let articles = decoded.articles.compactMap { $0.toArticle(category: category) }
            return articles.isEmpty ? curated(for: category) : articles
        } catch {
            return curated(for: category)
        }
    }

    static func search(_ query: String) async -> [NewsArticle] {
        guard hasKey,
              let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://newsapi.org/v2/everything?q=\(encoded)&language=fr&sortBy=relevancy&pageSize=20&apiKey=\(apiKey)")
        else { return curated(for: .all).filter { $0.title.localizedCaseInsensitiveContains(query) || $0.summary.localizedCaseInsensitiveContains(query) } }
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return [] }
            let decoded = try JSONDecoder().decode(NewsAPIResponse.self, from: data)
            return decoded.articles.compactMap { $0.toArticle(category: .all) }
        } catch {
            return []
        }
    }

    // MARK: - Curated fallback headlines

    static func curated(for category: NewsCategory) -> [NewsArticle] {
        let now = Date()
        let base: [NewsArticle] = [
            NewsArticle(id: "n1", title: "La France investit massivement dans l'énergie renouvelable", summary: "Un nouveau plan vise à doubler la capacité solaire et éolienne du pays d'ici 2030.", source: "Le Monde", category: .environment, region: .europe, imageUrl: nil, publishedAt: now.addingTimeInterval(-3600), body: "Le gouvernement français a annoncé un investissement record dans les énergies renouvelables. Ce plan ambitieux prévoit la construction de nouveaux parcs solaires et éoliens partout dans le pays. Les experts estiment que cela pourrait créer des milliers d'emplois tout en réduisant les émissions de carbone."),
            NewsArticle(id: "n2", title: "Une nouvelle exposition au Louvre attire les foules", summary: "Le musée présente des œuvres jamais montrées au public.", source: "France Culture", category: .culture, region: .europe, imageUrl: nil, publishedAt: now.addingTimeInterval(-7200), body: "Le musée du Louvre inaugure une exposition exceptionnelle cet été. Les visiteurs peuvent y découvrir des chefs-d'œuvre rarement exposés. La file d'attente s'étend déjà sur plusieurs centaines de mètres dès l'ouverture."),
            NewsArticle(id: "n3", title: "La technologie transforme notre quotidien", summary: "Les nouvelles intelligences artificielles changent la façon dont nous travaillons.", source: "Les Échos", category: .technology, region: .europe, imageUrl: nil, publishedAt: now.addingTimeInterval(-10800), body: "Les avancées technologiques récentes bouleversent de nombreux secteurs. Des entreprises françaises développent des outils innovants qui simplifient le travail quotidien. Cependant, certains s'inquiètent de l'impact sur l'emploi."),
            NewsArticle(id: "n4", title: "L'équipe de France se qualifie pour la finale", summary: "Une victoire spectaculaire en demi-finale.", source: "L'Équipe", category: .sports, region: .europe, imageUrl: nil, publishedAt: now.addingTimeInterval(-14400), body: "Les Bleus ont décroché leur place en finale après un match palpitant. Les supporters ont envahi les rues pour célébrer cette victoire historique. Le sélectionneur a salué l'esprit d'équipe de ses joueurs."),
            NewsArticle(id: "n5", title: "Le Sénégal accueille un sommet sur l'éducation", summary: "Des dirigeants africains se réunissent à Dakar.", source: "RFI Afrique", category: .society, region: .africa, imageUrl: nil, publishedAt: now.addingTimeInterval(-18000), body: "Dakar accueille cette semaine un sommet majeur sur l'avenir de l'éducation en Afrique francophone. Les participants discutent des moyens d'améliorer l'accès à l'école pour tous les enfants du continent."),
            NewsArticle(id: "n6", title: "Le Québec lance un programme d'immersion française", summary: "Une initiative pour attirer les nouveaux arrivants.", source: "Radio-Canada", category: .society, region: .canada, imageUrl: nil, publishedAt: now.addingTimeInterval(-21600), body: "Le gouvernement québécois met en place un nouveau programme pour faciliter l'apprentissage du français. Les nouveaux arrivants pourront suivre des cours gratuits afin de mieux s'intégrer dans la société québécoise."),
            NewsArticle(id: "n7", title: "L'économie française montre des signes de reprise", summary: "La croissance dépasse les prévisions ce trimestre.", source: "Le Figaro", category: .economy, region: .europe, imageUrl: nil, publishedAt: now.addingTimeInterval(-25200), body: "Les derniers chiffres économiques sont encourageants. La consommation des ménages repart à la hausse et le chômage recule légèrement. Les analystes restent toutefois prudents face aux incertitudes mondiales."),
            NewsArticle(id: "n8", title: "Découverte scientifique majeure à Paris", summary: "Des chercheurs annoncent une avancée prometteuse.", source: "Sciences et Avenir", category: .science, region: .europe, imageUrl: nil, publishedAt: now.addingTimeInterval(-28800), body: "Une équipe de chercheurs parisiens a réalisé une découverte qui pourrait révolutionner la médecine. Leurs travaux, publiés dans une revue internationale, ouvrent de nouvelles perspectives thérapeutiques."),
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
    let urlToImage: String?
    let publishedAt: String?
    struct Src: Decodable { let name: String? }
    let source: Src?

    func toArticle(category: NewsCategory) -> NewsArticle? {
        guard let title, !title.isEmpty, title != "[Removed]" else { return nil }
        let formatter = ISO8601DateFormatter()
        let date = formatter.date(from: publishedAt ?? "") ?? Date()
        let summary = description ?? ""
        let body = content?.replacingOccurrences(of: #"\[\+\d+ chars\]"#, with: "", options: .regularExpression) ?? summary
        return NewsArticle(
            id: title,
            title: title,
            summary: summary,
            source: source?.name ?? "Actualités",
            category: category == .all ? .society : category,
            region: .europe,
            imageUrl: urlToImage,
            publishedAt: date,
            body: body.isEmpty ? summary : body
        )
    }
}
