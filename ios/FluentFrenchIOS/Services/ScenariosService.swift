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
    static var hasKey: Bool { TalkModelClient.hasKey }

    /// Build a quick-reference survival guide for the given situation. Resolves
    /// to a learner-facing `TalkServiceFailure` (no key / offline / service / bad
    /// reply) instead of nil so the surface can show the right state (E26).
    static func generate(for query: String) async -> Result<ScenarioGuide, TalkServiceFailure> {
        let clean = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return .failure(.badResponse) }

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

        let result = await TalkModelClient.complete(
            messages: [["role": "system", "content": system], ["role": "user", "content": user]],
            temperature: 0.4,
            timeout: Tuning.scenarioGuideTimeout
        )
        switch result {
        case .failure(let failure):
            return .failure(failure)
        case .success(let content):
            guard let guide = parseGuide(content) else { return .failure(.badResponse) }
            return .success(guide)
        }
    }

    static func parseGuide(_ raw: String) -> ScenarioGuide? {
        guard let data = ModelJSON.objectData(in: raw),
              let guide = try? JSONDecoder().decode(ScenarioGuide.self, from: data),
              !guide.keyPhrases.isEmpty else { return nil }
        return guide
    }
}

// MARK: - Persistence

/// Device-side storage for saved guides. The key itself is `ScenarioStorage`
/// (Models) so `AppStore` can clear it between learners and back it up with the
/// rest of the record; this type owns only the encoding.
nonisolated enum ScenarioStore {
    private static let key = ScenarioStorage.defaultsKey

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
