//
//  ConceptTagger.swift
//  FluentFrenchIOS
//
//  Maps a freshly captured gap to the BEST-MATCHING existing concept, creating a
//  new concept only when nothing genuinely fits. Runs in the background so capture
//  stays instant. Uses OpenRouter when a key is present (Config); otherwise — and
//  whenever the network path fails — the on-device `HeuristicTagger` decides,
//  leaving the gap untagged when its confidence is below the floor (E1).
//
//  The store serialises calls to `tag` (E3) so each request sees the concepts the
//  previous one may have created.
//

import Foundation

@MainActor
enum ConceptTagger {
    nonisolated static var apiKey: String { Config.EXPO_PUBLIC_OPENROUTER_API_KEY }
    nonisolated static var hasKey: Bool { !apiKey.isEmpty }

    /// Seconds the AI matcher may take before the heuristic decides instead.
    nonisolated static let requestTimeout: TimeInterval = 20

    static func tag(gap: GapItem, concepts: [Concept], lexicon: [String: String] = [:]) async -> ConceptTagResult? {
        // A content-named headword is authoritative: no network round-trip needed.
        if let known = HeuristicTagger.lexiconConcept(for: gap, lexicon: lexicon),
           concepts.contains(where: { $0.id == known }) {
            return .existing(id: known, confidence: Tuning.tagLexiconWeight)
        }
        if hasKey, let ai = await tagWithAI(gap: gap, concepts: concepts) {
            return ai
        }
        return HeuristicTagger.tag(gap: gap, concepts: concepts, lexicon: lexicon)
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
        If the gap is plain vocabulary that belongs to no listed skill, reply {"match":null}.
        Reply ONLY with minified JSON, no markdown, one of:
        {"match":"<existing-concept-id>"}
        OR {"match":null}
        OR (only if truly nothing fits and a real skill is involved):
        {"new":{"id":"kebab-case-id","name":"","category":"vocabulary|grammar|pronunciation|phrasing|register","cefrLevel":"A1|A2|B1|B2|C1|C2","description":"one sentence","prerequisites":["existing-id"]}}
        prerequisites must be chosen ONLY from existing concept ids.
        """

        let user = """
        Gap:
        - french: "\(gap.frenchWord)"
        - english: "\(gap.englishTranslation)"
        - category: \(gap.category.rawValue)
        - part of speech: "\(gap.partOfSpeech ?? "")"
        - context: "\(gap.contextForTagging)"

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
        request.timeoutInterval = requestTimeout
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
            // Network/decoding trouble: the heuristic decides (never silent — the
            // store records the heuristic's confidence on the gap).
            return nil
        }
    }

    /// Parse the matcher's reply. Exposed (nonisolated) so it can be unit-tested
    /// without a network.
    nonisolated static func parse(_ raw: String, existingIds: [String], gap: GapItem) -> ConceptTagResult? {
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
            return .existing(id: match, confidence: Tuning.tagAIConfidence)
        }
        if let n = reply.new, !n.name.trimmingCharacters(in: .whitespaces).isEmpty {
            let cat = GapCategory(rawValue: n.category) ?? gap.category
            let lvl = CEFRLevel(rawValue: n.cefrLevel) ?? (gap.cefrLevel ?? .A2)
            let prereqs = (n.prerequisites ?? []).filter { existingIds.contains($0) }
            let id = n.id.isEmpty ? "concept-\(UUID().uuidString.prefix(8))" : n.id
            // Guard against accidental duplicate id of an existing concept.
            if existingIds.contains(id) { return .existing(id: id, confidence: Tuning.tagAIConfidence) }
            return .new(Concept(id: id, name: n.name, category: cat, cefrLevel: lvl,
                                prerequisites: prereqs, description: n.description))
        }
        // {"match":null}: the model says plain vocabulary — leave it untagged.
        if reply.match == nil, reply.new == nil, json.contains("null") {
            return .untagged(confidence: 0)
        }
        return nil
    }
}
