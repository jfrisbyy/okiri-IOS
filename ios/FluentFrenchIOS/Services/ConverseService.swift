//
//  ConverseService.swift
//  FluentFrenchIOS
//
//  Drives a real, in-character French conversation with an AI tutor (public
//  client key from Config). The tutor stays in role for the chosen scenario,
//  replies naturally in French at the learner's level, and returns an English
//  translation plus — when the learner's last message had a mistake — the
//  corrected line, a kind note and the taxonomy concept it belongs to.
//
//  Every call resolves to a `TalkServiceFailure` on the way out (no key, offline,
//  service, bad reply) so the surfaces can show a learner-facing state instead
//  of a silent nil. The transcript model and the reply parser live in
//  `ConverseRecap.swift` (harness-compiled).
//

import Foundation
import Network

// MARK: - Reachability (E11)

/// A tiny network-path observer so the talk surfaces can refuse to open a call
/// they cannot hold. `isReachable` is optimistic until the first path update.
@MainActor
@Observable
final class NetworkReachability {
    static let shared = NetworkReachability()

    private(set) var isReachable = true
    private let monitor = NWPathMonitor()
    private var started = false

    private init() {}

    /// Start observing (idempotent).
    func start() {
        guard !started else { return }
        started = true
        monitor.pathUpdateHandler = { path in
            let reachable = path.status == .satisfied
            Task { @MainActor in NetworkReachability.shared.isReachable = reachable }
        }
        monitor.start(queue: DispatchQueue(label: "ff.reachability"))
    }

    /// Re-read the current path (used by "Try again" buttons).
    func refresh() {
        start()
        isReachable = monitor.currentPath.status == .satisfied
    }
}

// MARK: - Shared chat-completion client

/// One place the talk surfaces call the chat model. Returns the raw assistant
/// text or the learner-facing failure it maps to; never throws, never nil.
nonisolated enum TalkModelClient {
    private static var apiKey: String { Config.EXPO_PUBLIC_OPENROUTER_API_KEY }
    static var hasKey: Bool { !apiKey.isEmpty }
    private static let model = "openai/gpt-4o-mini"

    static func complete(messages: [[String: String]], temperature: Double, timeout: TimeInterval) async -> Result<String, TalkServiceFailure> {
        guard hasKey else { return .failure(.noKey) }
        guard let url = URL(string: "https://openrouter.ai/api/v1/chat/completions") else { return .failure(.serviceUnavailable) }
        let payload: [String: Any] = ["model": model, "messages": messages, "temperature": temperature]
        guard let body = try? JSONSerialization.data(withJSONObject: payload) else { return .failure(.badResponse) }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = timeout
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            return .failure(TalkServiceFailure.classify(error))
        }
        if let http = response as? HTTPURLResponse, let failure = TalkServiceFailure.classify(statusCode: http.statusCode) {
            return .failure(failure)
        }
        guard let decoded = try? JSONDecoder().decode(ChatCompletionResponse.self, from: data),
              let content = decoded.choices.first?.message.content,
              !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return .failure(.badResponse)
        }
        return .success(content)
    }

    private struct ChatCompletionResponse: Decodable {
        struct Choice: Decodable { let message: Message }
        struct Message: Decodable { let content: String? }
        let choices: [Choice]
    }
}

// MARK: - Converse

nonisolated enum ConverseService {
    static var hasKey: Bool { TalkModelClient.hasKey }

    /// The tutor's next reply given the conversation so far. `concepts` is the
    /// taxonomy the tutor may name a correction's concept from; any id outside it
    /// is dropped by the parser.
    static func reply(
        scenario: ConverseScenario,
        level: CEFRLevel,
        history: [ChatTurn],
        concepts: [Concept]
    ) async -> Result<ConverseReply, TalkServiceFailure> {
        let system = """
        You are a friendly French conversation tutor role-playing a scenario with an English-speaking learner.
        Scenario: "\(scenario.title)" (\(scenario.titleFrench)). \(scenario.description)
        Stay fully in character for this scenario. The learner's level is \(level.rawValue) (CEFR), so keep your French natural but level-appropriate — simpler at A1/A2, richer at B1+.
        Reply ONLY with minified JSON, no markdown, in this exact shape:
        {"french":"your spoken reply in French (1-2 sentences, conversational)","english":"its English translation","correction":"a SHORT, kind English note on the mistake in the learner's last message, else empty string","correctedFrench":"the learner's last message rewritten correctly and naturally, else empty string","correctedEnglish":"English translation of correctedFrench, else empty string","conceptId":"the id from the list below that best names the mistake, else empty string"}
        Only fill correction/correctedFrench when the learner's last message actually had a grammar, vocabulary or usage mistake; if it was fine, leave all three empty.
        Concept ids you may use for conceptId (use the id exactly, or empty string):
        \(ConceptIdFilter.promptList(concepts))
        Keep replies concise so the conversation flows. Always move the scene forward and, when natural, ask the learner a question.
        """

        var messages: [[String: String]] = [["role": "system", "content": system]]
        // Seed with the greeting so the model has the opening context.
        messages.append(["role": "assistant", "content": scenario.greetingFrench])
        for (index, turn) in history.enumerated() where !turn.french.isEmpty {
            // The opening greeting is already seeded above.
            if index == 0, turn.role == .tutor, turn.french == scenario.greetingFrench { continue }
            messages.append(["role": turn.role == .tutor ? "assistant" : "user", "content": turn.french])
        }

        let result = await TalkModelClient.complete(messages: messages, temperature: 0.7, timeout: Tuning.converseReplyTimeout)
        switch result {
        case .failure(let failure):
            return .failure(failure)
        case .success(let content):
            guard let reply = ConverseReplyParser.parse(content, concepts: concepts) else { return .failure(.badResponse) }
            return .success(reply)
        }
    }

    /// A natural French phrase the learner could say next.
    static func hint(scenario: ConverseScenario, level: CEFRLevel, history: [ChatTurn]) async -> Result<ConverseReply, TalkServiceFailure> {
        let last = history.last(where: { $0.role == .tutor })?.french ?? scenario.greetingFrench
        let system = """
        You are helping an English speaker (level \(level.rawValue)) reply during a French conversation about "\(scenario.title)".
        The other person just said: "\(last)".
        Suggest ONE natural thing the learner could say back, at their level.
        Reply ONLY with minified JSON: {"french":"the suggested reply","english":"its translation","correction":""}
        """
        let result = await TalkModelClient.complete(messages: [["role": "system", "content": system]],
                                                    temperature: 0.6, timeout: Tuning.converseHintTimeout)
        switch result {
        case .failure(let failure):
            return .failure(failure)
        case .success(let content):
            guard let reply = ConverseReplyParser.parse(content) else { return .failure(.badResponse) }
            return .success(reply)
        }
    }
}
