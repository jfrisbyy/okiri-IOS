//
//  LessonService.swift
//  FluentFrenchIOS
//
//  Fetches AI-written practice questions for a lesson via OpenRouter (public
//  client key from Config) and merges them into the local schedule (C7 / C8 / C9).
//  Networking only: the reply is parsed by `LessonQuestionParser` and merged by
//  `LessonScheduler`, both view-free and harness-tested. Every failure — no key,
//  offline, timeout, cancellation, an unusable reply — falls back to the local
//  schedule, so a lesson can always start.
//
//  Cache: parsed AI batches are kept in memory keyed by the lesson's format
//  signature (sorted gap ids + the level each is asked at + option count + CEFR
//  level), so re-opening the same lesson never re-fetches. `prefetch` returns the
//  Task so the view can start it during the skill cards and await or cancel it.
//

import Foundation

@MainActor
enum LessonService {
    nonisolated static var apiKey: String { Config.EXPO_PUBLIC_OPENROUTER_API_KEY }
    nonisolated static var hasKey: Bool { !apiKey.isEmpty }

    /// Parsed AI batches by lesson signature. Only complete-enough batches are kept
    /// (the scheduler still merges per gap, so a partial gap keeps its local questions).
    private static var cache: [String: [LessonQuestion]] = [:]
    /// Fetches in flight by signature, so a prefetch and a later `schedule` share one request.
    private static var inflight: [String: Task<[LessonQuestion]?, Never>] = [:]

    /// A session whose total resource time is capped at `Tuning.lessonGenerationTimeout`.
    private static let session: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = Tuning.lessonGenerationTimeout
        configuration.timeoutIntervalForResource = Tuning.lessonGenerationTimeout
        return URLSession(configuration: configuration)
    }()

    // MARK: - Lesson-level API

    /// The cache key for a lesson as it would be asked right now.
    static func cacheKey(for lesson: AssembledLesson, level: CEFRLevel, optionCount: Int,
                         scheduler: LessonScheduler = LessonScheduler()) -> String {
        scheduler.formatSignature(for: lesson, abilityOptionCount: optionCount) + "|lvl=\(level.rawValue)"
    }

    /// Parsed AI questions already fetched for this lesson, if any.
    static func cachedQuestions(for lesson: AssembledLesson, level: CEFRLevel, optionCount: Int) -> [LessonQuestion]? {
        cache[cacheKey(for: lesson, level: level, optionCount: optionCount)]
    }

    /// Start (or join) the fetch for a lesson. Returns immediately with a task the
    /// view can await or cancel; a successful result is cached. Capstones, lessons
    /// with nothing the AI may write for, and no-key builds resolve to nil at once.
    @discardableResult
    static func prefetch(lesson: AssembledLesson, level: CEFRLevel, optionCount: Int) -> Task<[LessonQuestion]?, Never> {
        let key = cacheKey(for: lesson, level: level, optionCount: optionCount)
        if let cached = cache[key] {
            return Task<[LessonQuestion]?, Never> { cached }
        }
        if let running = inflight[key], !running.isCancelled {
            return running
        }
        let scheduler = LessonScheduler()
        let targets = aiGaps(in: lesson, scheduler: scheduler)
        guard hasKey, !lesson.isCapstone, !targets.isEmpty else {
            return Task<[LessonQuestion]?, Never> { nil }
        }
        let task = Task<[LessonQuestion]?, Never> {
            defer { inflight[key] = nil }
            let result = await generate(gaps: targets, level: level, optionCount: optionCount)
            if let result, !Task.isCancelled {
                cache[key] = result
            }
            return result
        }
        inflight[key] = task
        return task
    }

    /// Forget a prefetch that is no longer wanted (the view left the lesson).
    static func cancelPrefetch(lesson: AssembledLesson, level: CEFRLevel, optionCount: Int) {
        let key = cacheKey(for: lesson, level: level, optionCount: optionCount)
        inflight[key]?.cancel()
        inflight[key] = nil
    }

    /// The full schedule for a lesson: the local schedule with cached / fetched AI
    /// questions merged in. Awaits at most `Tuning.lessonGenerationTimeout`; on
    /// any failure the local schedule alone is returned.
    static func schedule(for lesson: AssembledLesson, level: CEFRLevel, optionCount: Int,
                         scheduler: LessonScheduler = LessonScheduler()) async -> [LessonQuestion] {
        let ai = await prefetch(lesson: lesson, level: level, optionCount: optionCount).value ?? []
        return scheduler.schedule(for: lesson, abilityOptionCount: optionCount, ai: ai)
    }

    /// The gaps the AI may write for: ordinary items only (no probes, no check-ins,
    /// nothing whose allowed kinds are empty).
    nonisolated static func aiGaps(in lesson: AssembledLesson, scheduler: LessonScheduler) -> [GapItem] {
        let roles = LessonScheduler.roles(in: lesson)
        return lesson.gaps.filter { gap in
            let role = roles[gap.id] ?? .review
            return !gap.isProbe && role != .probe && role != .checkIn && !scheduler.allowedAIKinds(for: gap).isEmpty
        }
    }

    #if DEBUG
    /// Tests and previews: drop every cached batch.
    static func clearCache() {
        cache.removeAll()
        for task in inflight.values { task.cancel() }
        inflight.removeAll()
    }
    #endif

    // MARK: - Fetch

    /// Fetch AI questions for the given gaps (indexed as sent). Returns nil on any
    /// failure — including a reply that leaves every gap short — so the caller
    /// falls back to the local scheduler.
    static func generate(gaps: [GapItem], level: CEFRLevel, optionCount: Int) async -> [LessonQuestion]? {
        guard hasKey, !gaps.isEmpty,
              let url = URL(string: "https://openrouter.ai/api/v1/chat/completions") else { return nil }

        var lines: [String] = []
        for (idx, gap) in gaps.enumerated() {
            var line = "\(idx): \"\(gap.frenchWord)\" = \"\(gap.englishTranslation)\" [\(gap.category.label)]"
            // The headword is often not the surface form a blank needs ("ne... pas"
            // → "ne parle pas", "je suis" → "suis"). A fill-blank whose answer is
            // not the blank form is rejected by the parser (it cannot stand in its
            // own sentence), so the writer is told the form up front instead of
            // losing the question.
            let blank = AnswerGrader.blankForm(for: gap)
            if AnswerGrader.normalize(blank) != AnswerGrader.normalize(gap.frenchWord) {
                line += " (blank form: \"\(blank)\")"
            }
            lines.append(line)
        }
        let wordList = lines.joined(separator: "\n")

        let system = """
        You are a French practice-question writer for an English speaker at CEFR level \(level.rawValue).
        Create engaging questions that test the given words. Vary the formats.
        Reply ONLY with minified JSON, no markdown:
        {"questions":[{"wordIndex":0,"kind":"multipleChoice","prompt":"","answer":"","options":["",""],"statement":"","explanation":""}]}
        Rules:
        - wordIndex is the number in front of the word in the list. Every question needs one.
        - kind is one of: "multipleChoice","fillBlank","trueFalse","translation".
        - multipleChoice: prompt asks the meaning/usage; answer is the correct English meaning; options has \(optionCount) plausible English choices INCLUDING the answer.
        - fillBlank: prompt is a natural French sentence with the target word replaced by "_____"; answer is the missing French word — exactly the listed "blank form" when the word has one, never the dictionary headword.
        - trueFalse: statement is a MEANING claim in exactly this shape — "<the French word>" means "<an English meaning>" — using the word from the list; answer is exactly "True" or "False". For a false one, use a clearly different meaning, not a near synonym. Claims about gender, conjugation or usage are not accepted.
        - translation: statement is the English to translate; answer is the correct French.
        - explanation: one short, helpful teaching note (English).
        Make \(Tuning.masteryTarget) questions per word, mixing formats. Keep everything level-appropriate.
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
        request.timeoutInterval = Tuning.lessonGenerationTimeout
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)

        do {
            let (data, response) = try await session.data(for: request)
            guard !Task.isCancelled,
                  let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }
            let decoded = try JSONDecoder().decode(OpenRouterResponse.self, from: data)
            guard let content = decoded.choices.first?.message.content else { return nil }
            let batch = LessonQuestionParser.parse(content, gaps: gaps, optionCount: optionCount)
            // A reply that fully covers no gap at all is a failure, not a lesson.
            let covered = gaps.filter { (batch.countsByGap[$0.id] ?? 0) >= Tuning.masteryTarget }
            guard !covered.isEmpty else { return nil }
            return batch.questions
        } catch {
            return nil
        }
    }

    /// A short, plain-language teaching summary for a concept (skill card). Used
    /// only when the content has no `teaching` block (C17 fallback). Returns nil
    /// on any failure so the caller can fall back to the stored description.
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
        request.timeoutInterval = Tuning.lessonGenerationTimeout
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }
            let decoded = try JSONDecoder().decode(OpenRouterResponse.self, from: data)
            let text = decoded.choices.first?.message.content.trimmingCharacters(in: .whitespacesAndNewlines)
            return (text?.isEmpty == false) ? text : nil
        } catch {
            return nil
        }
    }
}
