//
//  LessonService.swift
//  FluentFrenchIOS
//
//  Generates fresh practice questions tailored to the specific gaps being
//  practiced and the learner's level, via OpenRouter (public client key from
//  Config). Returns ready-to-use LessonQuestion values; the caller falls back
//  to the built-in LessonGenerator when this returns nil (offline / no key).
//

import Foundation

@MainActor
enum LessonService {
    nonisolated static var apiKey: String { Config.EXPO_PUBLIC_OPENROUTER_API_KEY }
    nonisolated static var hasKey: Bool { !apiKey.isEmpty }

    /// Generate AI questions for the given gaps. Returns nil on any failure so
    /// the caller can fall back to the local generator.
    static func generate(gaps: [GapItem], level: CEFRLevel, optionCount: Int) async -> [LessonQuestion]? {
        guard hasKey, !gaps.isEmpty,
              let url = URL(string: "https://openrouter.ai/api/v1/chat/completions") else { return nil }

        let wordList = gaps.enumerated().map { idx, gap in
            "\(idx): \"\(gap.frenchWord)\" = \"\(gap.englishTranslation)\" [\(gap.category.label)]"
        }.joined(separator: "\n")

        let system = """
        You are a French practice-question writer for an English speaker at CEFR level \(level.rawValue).
        Create engaging questions that test the given words. Vary the formats.
        Reply ONLY with minified JSON, no markdown:
        {"questions":[{"wordIndex":0,"kind":"multipleChoice","prompt":"","answer":"","options":["",""],"statement":"","explanation":""}]}
        Rules:
        - kind is one of: "multipleChoice","fillBlank","trueFalse","translation".
        - multipleChoice: prompt asks the meaning/usage; answer is the correct English meaning; options has \(optionCount) plausible English choices INCLUDING the answer.
        - fillBlank: prompt is a natural French sentence with the target word replaced by "_____"; answer is the missing French word.
        - trueFalse: statement is a claim about the word; answer is exactly "True" or "False".
        - translation: statement is the English to translate; answer is the correct French.
        - explanation: one short, helpful teaching note (English).
        Make 2 questions per word, mixing formats. Keep everything level-appropriate.
        """

        let payload: [String: Any] = [
            "model": "openai/gpt-4o-mini",
            "messages": [
                ["role": "system", "content": system],
                ["role": "user", "content": "Words:\n\(wordList)"],
            ],
            "temperature": 0.6,
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
            return build(from: content, gaps: gaps, optionCount: optionCount)
        } catch {
            return nil
        }
    }

    /// A short, plain-language teaching summary for a concept (skill card). Used
    /// only when the seeded description is thin. Returns nil on any failure so the
    /// caller can fall back to the stored description.
    static func explainConcept(name: String, category: String, level: CEFRLevel) async -> String? {
        guard hasKey,
              let url = URL(string: "https://openrouter.ai/api/v1/chat/completions") else { return nil }

        let system = """
        You teach French to an English speaker at CEFR level \(level.rawValue).
        Explain the given French skill in ONE or TWO short, plain-English sentences a learner
        can read in ten seconds. No preamble, no markdown, no examples — just the explanation.
        """
        let payload: [String: Any] = [
            "model": "openai/gpt-4o-mini",
            "messages": [
                ["role": "system", "content": system],
                ["role": "user", "content": "Skill: \(name) (\(category))"],
            ],
            "temperature": 0.5,
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
            let text = decoded.choices.first?.message.content.trimmingCharacters(in: .whitespacesAndNewlines)
            return (text?.isEmpty == false) ? text : nil
        } catch {
            return nil
        }
    }

    private static func build(from raw: String, gaps: [GapItem], optionCount: Int) -> [LessonQuestion]? {
        guard let start = raw.firstIndex(of: "{"), let end = raw.lastIndex(of: "}") else { return nil }
        let json = String(raw[start...end])
        guard let data = json.data(using: .utf8),
              let dto = try? JSONDecoder().decode(QuestionsDTO.self, from: data) else { return nil }

        var questions: [LessonQuestion] = []
        for q in dto.questions {
            guard gaps.indices.contains(q.wordIndex) else { continue }
            let gap = gaps[q.wordIndex]
            let answer = q.answer?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            switch q.kind {
            case "multipleChoice":
                var options = (q.options ?? []).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
                let correct = answer.isEmpty ? gap.englishTranslation : answer
                if !options.contains(where: { $0.caseInsensitiveCompare(correct) == .orderedSame }) {
                    options.append(correct)
                }
                // Pad / trim to a sensible count using other gaps as distractors.
                if options.count < 3 {
                    let extra = gaps.map { $0.englishTranslation }.filter { $0.caseInsensitiveCompare(correct) != .orderedSame }
                    options.append(contentsOf: extra.prefix(3 - options.count))
                }
                options = Array(NSOrderedSet(array: options).array as? [String] ?? options).prefix(max(3, optionCount)).map { $0 }
                options.shuffle()
                guard options.contains(correct) else { continue }
                questions.append(LessonQuestion(
                    gap: gap, kind: .multipleChoice,
                    prompt: q.prompt?.isEmpty == false ? q.prompt! : "What does “\(gap.frenchWord)” mean?",
                    correctAnswer: correct, options: options,
                    hint: q.explanation, isRemedial: false))
            case "fillBlank":
                let prompt = (q.prompt?.contains("_____") == true) ? q.prompt! : blankOut(gap.frenchWord, in: gap.exampleSentence)
                questions.append(LessonQuestion(
                    gap: gap, kind: .fillBlank,
                    prompt: prompt,
                    correctAnswer: answer.isEmpty ? gap.frenchWord : answer,
                    hint: q.explanation ?? gap.exampleTranslation, isRemedial: false))
            case "trueFalse":
                let isTrue = answer.lowercased().hasPrefix("t")
                questions.append(LessonQuestion(
                    gap: gap, kind: .trueFalse,
                    prompt: "True or false?",
                    correctAnswer: isTrue ? "True" : "False",
                    statement: q.statement?.isEmpty == false ? q.statement! : "“\(gap.frenchWord)” means “\(gap.englishTranslation)”.",
                    hint: q.explanation, isRemedial: false))
            case "translation":
                questions.append(LessonQuestion(
                    gap: gap, kind: .translation,
                    prompt: "Translate to French:",
                    correctAnswer: answer.isEmpty ? gap.frenchWord : answer,
                    statement: q.statement?.isEmpty == false ? q.statement! : gap.englishTranslation,
                    hint: q.explanation ?? "Mind the accents.", isRemedial: false))
            default:
                continue
            }
        }
        // Require at least one question per gap on average, else treat as failure.
        return questions.count >= gaps.count ? questions : nil
    }

    private static func blankOut(_ word: String, in sentence: String) -> String {
        if !sentence.isEmpty, sentence.range(of: word, options: .caseInsensitive) != nil {
            return sentence.replacingOccurrences(of: word, with: "_____", options: .caseInsensitive)
        }
        return "_____ — fill in the missing word"
    }

    private struct QuestionsDTO: Decodable {
        struct Q: Decodable {
            let wordIndex: Int
            let kind: String
            let prompt: String?
            let answer: String?
            let options: [String]?
            let statement: String?
            let explanation: String?
        }
        let questions: [Q]
    }
}
