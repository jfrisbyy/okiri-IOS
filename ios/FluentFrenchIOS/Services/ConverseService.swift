//
//  ConverseService.swift
//  FluentFrenchIOS
//
//  Drives a real, in-character French conversation with an AI tutor via
//  OpenRouter (public client key from Config). The tutor stays in role for the
//  chosen scenario, replies naturally in French at the learner's level, and
//  returns an English translation plus an optional gentle correction of the
//  learner's last message.
//

import Foundation

nonisolated struct ChatTurn: Identifiable, Hashable {
    enum Role { case tutor, user }
    let id = UUID()
    var role: Role
    var french: String
    var english: String
    /// A short, gentle correction of the learner's message (tutor turns only).
    var correction: String?
}

nonisolated struct ConverseReply {
    var french: String
    var english: String
    var correction: String?
}

nonisolated enum ConverseService {
    private static var apiKey: String { Config.EXPO_PUBLIC_OPENROUTER_API_KEY }
    static var hasKey: Bool { !apiKey.isEmpty }

    /// Generate the tutor's next reply given the conversation so far.
    static func reply(
        scenario: ConverseScenario,
        level: CEFRLevel,
        history: [ChatTurn]
    ) async -> ConverseReply? {
        guard hasKey, let url = URL(string: "https://openrouter.ai/api/v1/chat/completions") else { return nil }

        let system = """
        You are a friendly French conversation tutor role-playing a scenario with an English-speaking learner.
        Scenario: "\(scenario.title)" (\(scenario.titleFrench)). \(scenario.description)
        Stay fully in character for this scenario. The learner's level is \(level.rawValue) (CEFR), so keep your French natural but level-appropriate — simpler at A1/A2, richer at B1+.
        Reply ONLY with minified JSON, no markdown, in this exact shape:
        {"french":"your spoken reply in French (1-2 sentences, conversational)","english":"its English translation","correction":"a SHORT, kind correction of the learner's last message if it had a mistake, else empty string"}
        Keep replies concise so the conversation flows. Always move the scene forward and, when natural, ask the learner a question.
        """

        var messages: [[String: String]] = [["role": "system", "content": system]]
        // Seed with the greeting so the model has the opening context.
        messages.append(["role": "assistant", "content": scenario.greetingFrench])
        for turn in history {
            messages.append([
                "role": turn.role == .tutor ? "assistant" : "user",
                "content": turn.french,
            ])
        }

        let payload: [String: Any] = [
            "model": "openai/gpt-4o-mini",
            "messages": messages,
            "temperature": 0.7,
        ]

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 40
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }
            let decoded = try JSONDecoder().decode(OpenRouterResponse.self, from: data)
            guard let content = decoded.choices.first?.message.content else { return nil }
            return parse(content)
        } catch {
            return nil
        }
    }

    /// Suggest a natural French phrase the learner could say next.
    static func hint(scenario: ConverseScenario, level: CEFRLevel, history: [ChatTurn]) async -> ConverseReply? {
        guard hasKey, let url = URL(string: "https://openrouter.ai/api/v1/chat/completions") else { return nil }
        let last = history.last(where: { $0.role == .tutor })?.french ?? scenario.greetingFrench
        let system = """
        You are helping an English speaker (level \(level.rawValue)) reply during a French conversation about "\(scenario.title)".
        The other person just said: "\(last)".
        Suggest ONE natural thing the learner could say back, at their level.
        Reply ONLY with minified JSON: {"french":"the suggested reply","english":"its translation","correction":""}
        """
        let payload: [String: Any] = [
            "model": "openai/gpt-4o-mini",
            "messages": [["role": "system", "content": system]],
            "temperature": 0.6,
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
            return parse(content)
        } catch {
            return nil
        }
    }

    private static func parse(_ raw: String) -> ConverseReply? {
        guard let start = raw.firstIndex(of: "{"), let end = raw.lastIndex(of: "}") else { return nil }
        let json = String(raw[start...end])
        guard let data = json.data(using: .utf8),
              let dto = try? JSONDecoder().decode(ReplyDTO.self, from: data) else { return nil }
        let french = dto.french.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !french.isEmpty else { return nil }
        let correction = dto.correction?.trimmingCharacters(in: .whitespacesAndNewlines)
        return ConverseReply(
            french: french,
            english: dto.english.trimmingCharacters(in: .whitespacesAndNewlines),
            correction: (correction?.isEmpty ?? true) ? nil : correction
        )
    }

    private struct ReplyDTO: Decodable {
        let french: String
        let english: String
        let correction: String?
    }
}
