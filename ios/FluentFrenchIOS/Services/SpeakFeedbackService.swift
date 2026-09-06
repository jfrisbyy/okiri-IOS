//
//  SpeakFeedbackService.swift
//  FluentFrenchIOS
//
//  Instant AI feedback on a learner's spoken or written French response
//  (public client key from Config): a corrected version, a short note, a more
//  natural phrasing, a fluency score, and the taxonomy concepts the response got
//  wrong or used well, plus the English meaning of the corrected and natural
//  lines (so the deck cards they become have an answer) — validated against the store's concepts by the parser
//  (`Models/SpeakFeedback.swift`, harness-compiled) so evidence can never land
//  on an invented concept. Resolves to a `TalkServiceFailure` instead of nil.
//

import Foundation

nonisolated enum SpeakFeedbackService {
    static var hasKey: Bool { TalkModelClient.hasKey }

    /// Evaluate a French response to a prompt. `concepts` is the taxonomy the
    /// model may name; ids outside it are dropped.
    static func evaluate(response: String, prompt: String, level: CEFRLevel,
                         concepts: [Concept]) async -> Result<SpeakFeedback, TalkServiceFailure> {
        let clean = response.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return .failure(.badResponse) }

        let system = """
        You are a supportive French tutor giving feedback to an English speaker at CEFR level \(level.rawValue).
        They answered a prompt in French (possibly transcribed from speech, so ignore punctuation and casing).
        Reply ONLY with minified JSON, no markdown:
        {"corrected":"their text with grammar/spelling fixed (their own words if already correct)","correctedEnglish":"plain English meaning of corrected","note":"one short, encouraging note in English about what to improve","natural":"a more natural / native way to express the same idea in French","naturalEnglish":"plain English meaning of natural","score":0,"mistakeConcepts":["ids of at most \(Tuning.speakFeedbackMaxConcepts) concepts they got wrong"],"strongConcepts":["ids of at most \(Tuning.speakFeedbackMaxConcepts) concepts they used well"]}
        score is a 0-100 fluency estimate. Be kind but honest. Keep "natural" at their level. Always fill correctedEnglish and naturalEnglish — they become the meaning on the learner's review cards.
        Concept ids you may use (use ids exactly; leave a list empty rather than inventing an id):
        \(ConceptIdFilter.promptList(concepts))
        """
        let user = prompt.isEmpty ? "Response: \(clean)" : "Prompt: \(prompt)\nResponse: \(clean)"

        let result = await TalkModelClient.complete(
            messages: [["role": "system", "content": system], ["role": "user", "content": user]],
            temperature: 0.4,
            timeout: Tuning.speakFeedbackTimeout
        )
        switch result {
        case .failure(let failure):
            return .failure(failure)
        case .success(let content):
            guard let feedback = SpeakFeedbackParser.parse(content, concepts: concepts) else { return .failure(.badResponse) }
            return .success(feedback)
        }
    }
}
