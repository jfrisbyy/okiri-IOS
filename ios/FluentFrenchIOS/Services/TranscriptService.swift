//
//  TranscriptService.swift
//  FluentFrenchIOS
//
//  Fetches time-coded French transcripts for YouTube videos through a waterfall
//  with TWO independent transport paths for resilience:
//   1. The caption provider directly (public client key from Config) — fast path.
//   2. The app backend's transcript endpoints — backup path.
//
//  Each stage tries the direct path first, then the backend, and the whole
//  waterfall is retried once if the first pass finds nothing (transient
//  rate-limits used to surface as a false "no transcript"). The chain is:
//   • native French captions
//   • provider auto-translated French captions
//   • English captions → AI translation to French
//
//  The answer is a typed `TranscriptResult`: segments tagged with their
//  language, an honest "no captions", or the reason nothing could be fetched
//  (no key, offline, service error). Each request is bounded by
//  `Tuning.transcriptRequestTimeout` and the caption waterfall by
//  `Tuning.transcriptTotalTimeout` (E26). The third stage returns the English
//  captions as they are; `translateToFrench` then translates them
//  progressively under its OWN budget, so a long English transcript is shown
//  and translated in place rather than timing out into a false failure (EM-1).
//

import Foundation

nonisolated enum TranscriptService {
    private static var base: String {
        let raw = Config.EXPO_PUBLIC_RORK_API_BASE_URL.trimmingCharacters(in: .whitespaces)
        guard !raw.isEmpty else { return "" }
        let trimmed = raw.hasSuffix("/") ? String(raw.dropLast()) : raw
        return "\(trimmed)/api"
    }

    private static var providerKey: String {
        Config.EXPO_PUBLIC_SUPADATA_API_KEY.trimmingCharacters(in: .whitespaces)
    }

    private static var hasBackend: Bool { !base.isEmpty }
    private static var hasProvider: Bool { !providerKey.isEmpty }

    /// True when at least one transport path is configured.
    static var isConfigured: Bool { hasBackend || hasProvider }

    /// Fetch a transcript for a video: French when any French captions exist,
    /// otherwise the English captions tagged `.english` for `translateToFrench`.
    /// The full waterfall runs for every video, so a mistagged one still
    /// resolves. Retries the whole chain once when the first pass found nothing.
    static func fetch(videoId: String) async -> TranscriptResult {
        guard isConfigured else { return .unavailable(.noKey) }
        let bounded = await Deadline.run(seconds: Tuning.transcriptTotalTimeout) {
            await runWithRetry(videoId: videoId)
        }
        return bounded ?? .unavailable(.serviceError)
    }

    private static func runWithRetry(videoId: String) async -> TranscriptResult {
        let first = await runWaterfall(videoId: videoId)
        if case .segments = first { return first }
        // One graceful retry — transient provider hiccups are the usual cause
        // of a false "no transcript", so don't give up on the first miss.
        try? await Task.sleep(nanoseconds: UInt64(max(0, Tuning.transcriptRetryDelay) * 1_000_000_000))
        let second = await runWaterfall(videoId: videoId)
        if case .segments = second { return second }
        // Prefer the more specific answer: a transport failure over "no captions".
        if case .unavailable = second { return second }
        return first
    }

    // MARK: - Waterfall

    /// Runs the chain. Tracks whether ANY transport actually answered: when every
    /// path failed to answer the result is a failure, not "no captions".
    private static func runWaterfall(videoId: String) async -> TranscriptResult {
        var tracker = Tracker()

        // 1) Native French captions.
        let native = await nativeFrench(videoId: videoId, tracker: &tracker)
        if !native.isEmpty { return .segments(native, language: .french) }

        // 2) Provider auto-translated French captions.
        let translated = await autoTranslatedFrench(videoId: videoId, tracker: &tracker)
        if !translated.isEmpty { return .segments(translated, language: .french) }

        // 3) English captions, returned as they are: translation runs after the
        //    fetch under its own budget (`translateToFrench`), never inside it.
        let english = await englishCaptions(videoId: videoId, tracker: &tracker)
        if !english.isEmpty {
            let tagged = english.map {
                TranscriptSegment(id: $0.id, text: $0.text, start: $0.start, duration: $0.duration, language: .english)
            }
            return .segments(tagged, language: .english)
        }

        if tracker.answered { return .noCaptions }
        return .unavailable(tracker.failure ?? .serviceError)
    }

    /// Remembers whether any transport answered, and the worst failure seen.
    private nonisolated struct Tracker {
        var answered = false
        var failure: MediaServiceFailure? = nil

        mutating func note(_ outcome: Result<[TranscriptSegment], MediaServiceFailure>) -> [TranscriptSegment] {
            switch outcome {
            case .success(let segments):
                answered = true
                return segments
            case .failure(let f):
                // Rank the reasons: offline is the most actionable, a service
                // error next; `.noKey` only means ONE of the two paths is not
                // configured (the caller already checked that at least one is).
                switch (failure, f) {
                case (nil, _), (.noKey?, _): failure = f
                case (.serviceError?, .offline): failure = .offline
                default: break
                }
                return []
            }
        }
    }

    private static func nativeFrench(videoId: String, tracker: inout Tracker) async -> [TranscriptSegment] {
        // Direct provider first.
        if hasProvider {
            switch await providerTranscript(videoId: videoId, lang: "fr") {
            case .success(let direct):
                tracker.answered = true
                if !direct.segments.isEmpty { return direct.segments }
                // Requested French was empty but a French variant may exist.
                if let frVariant = direct.availableLangs.first(where: { $0.lowercased().hasPrefix("fr") }),
                   frVariant.lowercased() != "fr",
                   case .success(let retry) = await providerTranscript(videoId: videoId, lang: frVariant),
                   !retry.segments.isEmpty {
                    return retry.segments
                }
            case .failure(let f):
                _ = tracker.note(.failure(f))
            }
        }
        // Backend backup (it does its own availableLangs fallback internally).
        return tracker.note(await backendTranscript(videoId: videoId, lang: "fr"))
    }

    private static func autoTranslatedFrench(videoId: String, tracker: inout Tracker) async -> [TranscriptSegment] {
        if hasProvider {
            let direct = tracker.note(await providerTranslate(videoId: videoId, lang: "fr"))
            if !direct.isEmpty { return direct }
        }
        return tracker.note(await backendTranslate(videoId: videoId))
    }

    private static func englishCaptions(videoId: String, tracker: inout Tracker) async -> [TranscriptSegment] {
        if hasProvider, case .success(let direct) = await providerTranscript(videoId: videoId, lang: "en") {
            tracker.answered = true
            if !direct.segments.isEmpty { return direct.segments }
        }
        return tracker.note(await backendTranscript(videoId: videoId, lang: "en"))
    }

    // MARK: - Direct provider transport

    private static func providerTranscript(videoId: String, lang: String) async
        -> Result<(segments: [TranscriptSegment], availableLangs: [String]), MediaServiceFailure> {
        let langParam = lang.split(separator: "-").first.map(String.init) ?? lang
        guard let encodedId = videoId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://api.supadata.ai/v1/youtube/transcript?videoId=\(encodedId)&lang=\(langParam)")
        else { return .failure(.serviceError) }

        switch await providerGET(url) {
        case .failure(let f): return .failure(f)
        case .success(let data):
            guard let decoded = try? JSONDecoder().decode(ProviderResponse.self, from: data) else { return .failure(.serviceError) }
            let segments = mapProvider(decoded.content ?? [], videoId: videoId)
            return .success((segments, decoded.availableLangs ?? []))
        }
    }

    private static func providerTranslate(videoId: String, lang: String) async -> Result<[TranscriptSegment], MediaServiceFailure> {
        guard let encodedId = videoId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://api.supadata.ai/v1/youtube/transcript/translate?videoId=\(encodedId)&lang=\(lang)&text=false")
        else { return .failure(.serviceError) }
        switch await providerGET(url) {
        case .failure(let f): return .failure(f)
        case .success(let data):
            guard let decoded = try? JSONDecoder().decode(ProviderResponse.self, from: data) else { return .failure(.serviceError) }
            return .success(mapProvider(decoded.content ?? [], videoId: videoId))
        }
    }

    private static func providerGET(_ url: URL) async -> Result<Data, MediaServiceFailure> {
        var request = URLRequest(url: url)
        request.timeoutInterval = Tuning.transcriptRequestTimeout
        request.setValue(providerKey, forHTTPHeaderField: "x-api-key")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else { return .failure(.serviceError) }
            // 404 = the provider answered: this video has no such captions.
            if http.statusCode == 404 { return .success(Data("{}".utf8)) }
            if let failure = MediaServiceFailure.classify(statusCode: http.statusCode) { return .failure(failure) }
            return .success(data)
        } catch {
            return .failure(MediaServiceFailure.classify(error))
        }
    }

    private static func mapProvider(_ items: [ProviderResponse.Item], videoId: String) -> [TranscriptSegment] {
        items.enumerated().compactMap { idx, item in
            let text = TranscriptText.cleanHTML(item.text)
            guard !text.isEmpty else { return nil }
            return TranscriptSegment(
                id: "provider-\(videoId)-\(idx)",
                text: text,
                start: (item.offset ?? 0) / 1000.0,
                duration: (item.duration ?? 0) / 1000.0
            )
        }
    }

    // MARK: - Backend transport (backup)

    private static func backendTranscript(videoId: String, lang: String) async -> Result<[TranscriptSegment], MediaServiceFailure> {
        guard hasBackend else { return .failure(.noKey) }
        guard let encoded = videoId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "\(base)/youtube-transcript?videoId=\(encoded)&lang=\(lang)")
        else { return .failure(.serviceError) }
        return await decodeBackend(url)
    }

    private static func backendTranslate(videoId: String) async -> Result<[TranscriptSegment], MediaServiceFailure> {
        guard hasBackend else { return .failure(.noKey) }
        guard let encoded = videoId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "\(base)/youtube-transcript-translate?videoId=\(encoded)&lang=fr")
        else { return .failure(.serviceError) }
        return await decodeBackend(url)
    }

    private static func decodeBackend(_ url: URL) async -> Result<[TranscriptSegment], MediaServiceFailure> {
        var request = URLRequest(url: url)
        request.timeoutInterval = Tuning.transcriptRequestTimeout
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else { return .failure(.serviceError) }
            if http.statusCode == 404 { return .success([]) }
            if let failure = MediaServiceFailure.classify(statusCode: http.statusCode) { return .failure(failure) }
            let decoded = try JSONDecoder().decode(BackendTranscriptResponse.self, from: data)
            return .success(decoded.segments.compactMap { seg in
                let text = TranscriptText.cleanHTML(seg.text)
                guard !text.isEmpty else { return nil }
                return TranscriptSegment(id: seg.id, text: text, start: seg.start, duration: seg.duration)
            })
        } catch {
            // A decoding error is not a URLError, so it classifies as the service's fault.
            return .failure(MediaServiceFailure.classify(error))
        }
    }

    // MARK: - AI translation fallback (OpenRouter)

    /// English caption lines rendered into French progressively, in numbered
    /// batches, each snapshot carrying the lines as they stand and the coverage
    /// (translating / partly English / English) so the panel can show lines
    /// straight away and say exactly what is still English. Bounded by
    /// `Tuning.transcriptTranslationTimeout` and `transcriptTranslationMaxBatches`;
    /// no key is reported, not skipped, and a batch the service could not answer
    /// counts as a failure (EM-1 / EM-2). Cancel the consumer to stop the pass.
    static func translateToFrench(_ segments: [TranscriptSegment]) -> AsyncStream<TranscriptTranslationProgress> {
        let key = Config.EXPO_PUBLIC_OPENROUTER_API_KEY.trimmingCharacters(in: .whitespaces)
        return TranscriptTranslation.stream(
            segments,
            batchSize: Tuning.transcriptTranslationBatch,
            maxBatches: Tuning.transcriptTranslationMaxBatches,
            budget: Tuning.transcriptTranslationTimeout,
            maxConsecutiveFailures: Tuning.transcriptTranslationMaxConsecutiveFailures
        ) { numbered in
            guard !key.isEmpty else { return .failure(.noKey) }
            return await translateBatch(numbered, key: key)
        }
    }

    private static func translateBatch(_ numbered: String, key: String) async -> Result<String, MediaServiceFailure> {
        guard let url = URL(string: "https://openrouter.ai/api/v1/chat/completions") else { return .failure(.serviceError) }
        let prompt = "Translate each numbered subtitle line below into French. Return ONLY the translated lines in the exact same [number] format. Keep translations natural and conversational. Do not add any extra text.\n\n\(numbered)"
        let payload: [String: Any] = [
            "model": "openai/gpt-4o-mini",
            "messages": [["role": "user", "content": prompt]],
            "temperature": 0.3,
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        request.timeoutInterval = Tuning.transcriptRequestTimeout
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else { return .failure(.serviceError) }
            if let failure = MediaServiceFailure.classify(statusCode: http.statusCode) { return .failure(failure) }
            let decoded = try JSONDecoder().decode(OpenRouterResponse.self, from: data)
            guard let content = decoded.choices.first?.message.content, !content.isEmpty else { return .failure(.serviceError) }
            return .success(content)
        } catch {
            return .failure(MediaServiceFailure.classify(error))
        }
    }
}

private nonisolated struct ProviderResponse: Decodable {
    struct Item: Decodable {
        let text: String
        let offset: Double?
        let duration: Double?
    }
    let content: [Item]?
    let lang: String?
    let availableLangs: [String]?
}

private nonisolated struct BackendTranscriptResponse: Decodable {
    struct Segment: Decodable {
        let id: String
        let text: String
        let start: Double
        let duration: Double
    }
    let segments: [Segment]
    let source: String?
}
