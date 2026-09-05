//
//  ScenariosService.swift
//  FluentFrenchIOS
//
//  Generates a real-life "survival guide" for a situation in France via
//  OpenRouter (public client key from Config), and persists saved guides to
//  UserDefaults. Mirrors the Expo Scenarios feature.
//

import Foundation

// MARK: - Models

nonisolated struct ScenarioPhrase: Codable, Hashable, Identifiable {
    var id = UUID()
    var french: String
    var english: String
    var context: String

    private enum CodingKeys: String, CodingKey { case id, french, english, context }
}

nonisolated struct ScenarioQA: Codable, Hashable, Identifiable {
    var id = UUID()
    var question: String
    var questionEnglish: String
    var answer: String
    var answerEnglish: String

    private enum CodingKeys: String, CodingKey { case id, question, questionEnglish, answer, answerEnglish }
}

nonisolated struct ScenarioTip: Codable, Hashable, Identifiable {
    var id = UUID()
    var tip: String
    var category: String   // "native" | "cultural" | "practical"

    private enum CodingKeys: String, CodingKey { case id, tip, category }
}

nonisolated struct ScenarioGuide: Codable, Hashable {
    var title: String
    var titleFrench: String
    var summary: String
    var keyPhrases: [ScenarioPhrase]
    var questionsAndAnswers: [ScenarioQA]
    var tips: [ScenarioTip]
    var nativeExpressions: [ScenarioPhrase]
}

nonisolated struct SavedScenario: Codable, Hashable, Identifiable {
    var id: String
    var query: String
    var guide: ScenarioGuide
    var savedAt: Date
}

// MARK: - Generation

nonisolated enum ScenariosService {
    private static var apiKey: String { Config.EXPO_PUBLIC_OPENROUTER_API_KEY }
    static var hasKey: Bool { !apiKey.isEmpty }

    /// Build a quick-reference survival guide for the given situation.
    static func generate(for query: String) async -> ScenarioGuide? {
        let clean = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard hasKey, !clean.isEmpty,
              let url = URL(string: "https://openrouter.ai/api/v1/chat/completions")
        else { return nil }

        let system = "You are a French language survival guide. Reply ONLY with minified JSON matching this exact shape, no markdown, no extra keys: {\"title\":\"\",\"titleFrench\":\"\",\"summary\":\"\",\"keyPhrases\":[{\"french\":\"\",\"english\":\"\",\"context\":\"\"}],\"questionsAndAnswers\":[{\"question\":\"\",\"questionEnglish\":\"\",\"answer\":\"\",\"answerEnglish\":\"\"}],\"tips\":[{\"tip\":\"\",\"category\":\"native\"}],\"nativeExpressions\":[{\"french\":\"\",\"english\":\"\",\"context\":\"\"}]}"

        let user = """
        A user is in France and needs quick help with this real-life situation: "\(clean)".
        Produce:
        - title: clear English title; titleFrench: French equivalent.
        - summary: 1-2 sentences on what to expect.
        - keyPhrases: 8-10 essential phrases (greetings, requests, polite, closing). Each with french, english, and context (when/how to use).
        - questionsAndAnswers: 5-6 questions a French speaker may ask, with a suggested response. Both in french + english.
        - tips: 4-5 practical/cultural tips. category is one of: native, cultural, practical.
        - nativeExpressions: 3-4 colloquial expressions that impress locals, with french, english, context.
        Prioritize by usefulness. Keep phrases natural and immediately usable.
        """

        let payload: [String: Any] = [
            "model": "openai/gpt-4o-mini",
            "messages": [
                ["role": "system", "content": system],
                ["role": "user", "content": user],
            ],
            "temperature": 0.4,
        ]

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 45
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }
            let decoded = try JSONDecoder().decode(OpenRouterResponse.self, from: data)
            guard let content = decoded.choices.first?.message.content else { return nil }
            return parseGuide(content)
        } catch {
            return nil
        }
    }

    private static func parseGuide(_ raw: String) -> ScenarioGuide? {
        guard let start = raw.firstIndex(of: "{"),
              let end = raw.lastIndex(of: "}") else { return nil }
        let json = String(raw[start...end])
        guard let data = json.data(using: .utf8),
              let guide = try? JSONDecoder().decode(ScenarioGuide.self, from: data),
              !guide.keyPhrases.isEmpty else { return nil }
        return guide
    }
}

// MARK: - Persistence

nonisolated enum ScenarioStore {
    private static let key = "ff.savedScenarios.v1"

    static func load() -> [SavedScenario] {
        guard let data = UserDefaults.standard.data(forKey: key) else { return [] }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return (try? decoder.decode([SavedScenario].self, from: data)) ?? []
    }

    static func save(_ scenarios: [SavedScenario]) {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        if let data = try? encoder.encode(scenarios) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}
