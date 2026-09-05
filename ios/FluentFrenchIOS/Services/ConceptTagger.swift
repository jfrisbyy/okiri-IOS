//
//  ConceptTagger.swift
//  FluentFrenchIOS
//
//  Maps a freshly captured gap to the BEST-MATCHING existing concept, creating a
//  new concept only when nothing genuinely fits. Runs in the background so capture
//  stays instant. Uses OpenRouter when a key is present (Config), and falls back to
//  a lightweight on-device heuristic so tagging still works offline.
//

import Foundation

nonisolated enum ConceptTagResult {
    case existing(String)   // concept id
    case new(Concept)
}

@MainActor
enum ConceptTagger {
    nonisolated static var apiKey: String { Config.EXPO_PUBLIC_OPENROUTER_API_KEY }
    nonisolated static var hasKey: Bool { !apiKey.isEmpty }

    static func tag(gap: GapItem, concepts: [Concept]) async -> ConceptTagResult? {
        if hasKey, let ai = await tagWithAI(gap: gap, concepts: concepts) {
            return ai
        }
        return heuristicTag(gap: gap, concepts: concepts)
    }

    // MARK: - AI matcher

    private static func tagWithAI(gap: GapItem, concepts: [Concept]) async -> ConceptTagResult? {
        guard let url = URL(string: "https://openrouter.ai/api/v1/chat/completions") else { return nil }

        let conceptList = concepts.map { "\($0.id) | \($0.name) [\($0.category.rawValue)]" }.joined(separator: "\n")
        let existingIds = concepts.map { $0.id }

        let system = """
        You map a captured French learning gap to the SINGLE best-matching skill (concept) from a fixed list.
        Strongly prefer matching an EXISTING concept. Only invent a new one if nothing genuinely fits.
        Treat near-synonyms as the SAME concept: e.g. "past tense", "passé composé" and "compound past" are ONE concept, NOT three. Never create near-duplicates.
        Reply ONLY with minified JSON, no markdown, one of:
        {"match":"<existing-concept-id>"}
        OR (only if truly nothing fits):
        {"new":{"id":"kebab-case-id","name":"","category":"vocabulary|grammar|pronunciation|phrasing|register","cefrLevel":"A1|A2|B1|B2|C1|C2","description":"one sentence","prerequisites":["existing-id"]}}
        prerequisites must be chosen ONLY from existing concept ids.
        """

        let user = """
        Gap:
        - french: "\(gap.frenchWord)"
        - english: "\(gap.englishTranslation)"
        - category: \(gap.category.rawValue)
        - context: "\(gap.originalContext?.sentence ?? gap.exampleSentence)"

        Existing concepts (id | name [category]):
        \(conceptList)
        """

        let payload: [String: Any] = [
            "model": "openai/gpt-4o-mini",
            "messages": [
                ["role": "system", "content": system],
                ["role": "user", "content": user],
            ],
            "temperature": 0.1,
        ]

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }
            let decoded = try JSONDecoder().decode(OpenRouterResponse.self, from: data)
            guard let content = decoded.choices.first?.message.content else { return nil }
            return parse(content, existingIds: existingIds, gap: gap)
        } catch {
            return nil
        }
    }

    private static func parse(_ raw: String, existingIds: [String], gap: GapItem) -> ConceptTagResult? {
        guard let start = raw.firstIndex(of: "{"), let end = raw.lastIndex(of: "}") else { return nil }
        let json = String(raw[start...end])
        guard let data = json.data(using: .utf8) else { return nil }

        struct Reply: Decodable {
            struct New: Decodable {
                let id: String
                let name: String
                let category: String
                let cefrLevel: String
                let description: String
                let prerequisites: [String]?
            }
            let match: String?
            let new: New?
        }
        guard let reply = try? JSONDecoder().decode(Reply.self, from: data) else { return nil }

        if let match = reply.match, existingIds.contains(match) {
            return .existing(match)
        }
        if let n = reply.new {
            let cat = GapCategory(rawValue: n.category) ?? gap.category
            let lvl = CEFRLevel(rawValue: n.cefrLevel) ?? (gap.cefrLevel ?? .A2)
            let prereqs = (n.prerequisites ?? []).filter { existingIds.contains($0) }
            let id = n.id.isEmpty ? "concept-\(UUID().uuidString.prefix(8))" : n.id
            // Guard against accidental duplicate id of an existing concept.
            if existingIds.contains(id) { return .existing(id) }
            return .new(Concept(id: id, name: n.name, category: cat, cefrLevel: lvl,
                                prerequisites: prereqs, description: n.description))
        }
        return nil
    }

    // MARK: - Offline heuristic

    /// Best-effort keyword/category match used when AI is unavailable. Never
    /// invents concepts — it picks the closest existing one in the same category.
    private static func heuristicTag(gap: GapItem, concepts: [Concept]) -> ConceptTagResult? {
        let haystack = "\(gap.frenchWord) \(gap.englishTranslation) \(gap.explanation)".lowercased()

        let keywordMap: [(String, [String])] = [
            ("savoir-vs-connaitre", ["savoir", "connaître", "connaitre"]),
            ("passe-compose-etre", ["être vs avoir", "passé composé", "passe compose", "auxiliary"]),
            ("subjunctive-intro", ["il faut que", "subjunctive", "subjonctif"]),
            ("guttural-r", ["guttural", "french r", "'r'"]),
            ("nasal-vowels", ["nasal"]),
            ("tu-vs-vous", ["vous", "tu vs"]),
            ("spoken-fillers", ["du coup", "filler"]),
            ("idioms", ["idiom", "cafard", "expression"]),
            ("adjective-agreement", ["agreement", "adjective"]),
            ("object-pronouns", ["pronoun"]),
            ("imparfait", ["imparfait", "imperfect"]),
            ("near-future", ["aller +", "near future"]),
            ("partitive-articles", ["partitive", "de la"]),
            ("numbers-time", ["number", "time", "date"]),
        ]
        for (cid, keys) in keywordMap where concepts.contains(where: { $0.id == cid }) {
            if keys.contains(where: { !$0.isEmpty && haystack.contains($0) }) {
                return .existing(cid)
            }
        }

        // Fall back to the easiest concept in the same category.
        let sameCategory = concepts
            .filter { $0.category == gap.category }
            .sorted { $0.cefrLevel.order < $1.cefrLevel.order }
        if let pick = sameCategory.first {
            return .existing(pick.id)
        }
        return concepts.first.map { .existing($0.id) }
    }
}
