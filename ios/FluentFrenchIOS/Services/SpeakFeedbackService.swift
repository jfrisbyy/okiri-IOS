//
//  SpeakFeedbackService.swift
//  FluentFrenchIOS
//
//  Gives instant AI feedback on a learner's written French response via
//  OpenRouter (public client key from Config): a corrected version, a short
//  fluency note, and a more natural way to phrase it.
//

import Foundation

nonisolated struct SpeakFeedback {
    var corrected: String
    var note: String
    var natural: String
    var score: Int   // 0-100 fluency estimate
}

nonisolated enum SpeakFeedbackService {
    private static var apiKey: String { Config.EXPO_PUBLIC_OPENROUTER_API_KEY }
    static var hasKey: Bool { !apiKey.isEmpty }

    /// Evaluate a written French response to a prompt.
    static func evaluate(response: String, prompt: String, level: CEFRLevel) async -> SpeakFeedback? {
        let clean = response.trimmingCharacters(in: .whitespacesAndNewlines)
        guard hasKey, !clean.isEmpty,
              let url = URL(string: "https://openrouter.ai/api/v1/chat/completions") else { return nil }

        let system = """
        You are a supportive French tutor giving feedback to an English speaker at CEFR level \(level.rawValue).
        They wrote a French response to a prompt. Reply ONLY with minified JSON, no markdown:
        {"corrected":"their text with grammar/spelling fixed","note":"one short, encouraging note in English about what to improve","natural":"a more natural / native way to express the same idea in French","score":0}
        score is a 0-100 fluency estimate. Be kind but honest. Keep "natural" at their level.
        """
        let user = prompt.isEmpty ? "Response: \(clean)" : "Prompt: \(prompt)\nResponse: \(clean)"

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

    private static func parse(_ raw: String) -> SpeakFeedback? {
        guard let start = raw.firstIndex(of: "{"), let end = raw.lastIndex(of: "}") else { return nil }
        let json = String(raw[start...end])
        guard let data = json.data(using: .utf8),
              let dto = try? JSONDecoder().decode(DTO.self, from: data) else { return nil }
        let corrected = dto.corrected.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !corrected.isEmpty else { return nil }
        return SpeakFeedback(
            corrected: corrected,
            note: dto.note.trimmingCharacters(in: .whitespacesAndNewlines),
            natural: dto.natural.trimmingCharacters(in: .whitespacesAndNewlines),
            score: max(0, min(100, dto.score))
        )
    }

    private struct DTO: Decodable {
        let corrected: String
        let note: String
        let natural: String
        let score: Int
    }
}
