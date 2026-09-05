//
//  TranscriptService.swift
//  FluentFrenchIOS
//
//  Fetches time-coded French transcripts for YouTube videos. Mirrors the Expo
//  Watch waterfall but with TWO independent transport paths for resilience:
//   1. Direct Supadata (same provider the Expo backend uses) — fast path.
//   2. Rork backend endpoints — backup path.
//
//  Each stage of the waterfall tries the direct path first, then the backend,
//  and the whole waterfall is retried once if the first pass comes back empty
//  (covers transient rate-limits / timeouts that used to surface as a false
//  "no transcript available"). The smart chain is:
//   • native French captions
//   • Supadata auto-translated French captions
//   • English captions → AI translation to French (OpenRouter)
//

import Foundation

nonisolated struct TranscriptSegment: Identifiable, Hashable {
    let id: String
    let text: String
    let start: Double
    let duration: Double
}

nonisolated enum TranscriptService {
    private static var base: String {
        let raw = Config.EXPO_PUBLIC_RORK_API_BASE_URL.trimmingCharacters(in: .whitespaces)
        guard !raw.isEmpty else { return "" }
        let trimmed = raw.hasSuffix("/") ? String(raw.dropLast()) : raw
        return "\(trimmed)/api"
    }

    private static var supadataKey: String {
        Config.EXPO_PUBLIC_SUPADATA_API_KEY.trimmingCharacters(in: .whitespaces)
    }

    private static var hasBackend: Bool { !base.isEmpty }
    private static var hasSupadata: Bool { !supadataKey.isEmpty }

    /// True when at least one transport path is configured.
    static var isConfigured: Bool { hasBackend || hasSupadata }

    /// Fetch a French transcript for a video. `nativeFrench` only nudges the
    /// ordering — the full waterfall runs either way so a mistagged video still
    /// resolves. Retries the whole chain once on an empty first pass.
    static func fetch(videoId: String, nativeFrench: Bool) async -> [TranscriptSegment] {
        guard isConfigured else { return [] }

        let first = await runWaterfall(videoId: videoId)
        if !first.isEmpty { return first }

        // One graceful retry — transient provider hiccups are the usual cause
        // of a false "no transcript", so don't give up on the first miss.
        try? await Task.sleep(nanoseconds: 800_000_000)
        return await runWaterfall(videoId: videoId)
    }

    // MARK: - Waterfall

    private static func runWaterfall(videoId: String) async -> [TranscriptSegment] {
        // 1) Native French captions.
        let native = await nativeFrench(videoId: videoId)
        if !native.isEmpty { return native }

        // 2) Supadata auto-translated French captions.
        let translated = await autoTranslatedFrench(videoId: videoId)
        if !translated.isEmpty { return translated }

        // 3) English captions → AI translation to French.
        let english = await englishCaptions(videoId: videoId)
        if english.isEmpty { return [] }
        return await translateToFrench(english)
    }

    private static func nativeFrench(videoId: String) async -> [TranscriptSegment] {
        // Direct Supadata first.
        if hasSupadata, let direct = await supadataTranscript(videoId: videoId, lang: "fr") {
            if !direct.segments.isEmpty { return direct.segments }
            // Requested French was empty but a French variant may exist.
            if let frVariant = direct.availableLangs.first(where: { $0.lowercased().hasPrefix("fr") }),
               frVariant.lowercased() != "fr",
               let retry = await supadataTranscript(videoId: videoId, lang: frVariant),
               !retry.segments.isEmpty {
                return retry.segments
            }
        }
        // Backend backup (it does its own availableLangs fallback internally).
        return await backendTranscript(videoId: videoId, lang: "fr")
    }

    private static func autoTranslatedFrench(videoId: String) async -> [TranscriptSegment] {
        if hasSupadata {
            let direct = await supadataTranslate(videoId: videoId, lang: "fr")
            if !direct.isEmpty { return direct }
        }
        return await backendTranslate(videoId: videoId)
    }

    private static func englishCaptions(videoId: String) async -> [TranscriptSegment] {
        if hasSupadata, let direct = await supadataTranscript(videoId: videoId, lang: "en"),
           !direct.segments.isEmpty {
            return direct.segments
        }
        return await backendTranscript(videoId: videoId, lang: "en")
    }

    // MARK: - Direct Supadata transport

    private static func supadataTranscript(videoId: String, lang: String) async -> (segments: [TranscriptSegment], availableLangs: [String])? {
        let langParam = lang.split(separator: "-").first.map(String.init) ?? lang
        guard let encodedId = videoId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://api.supadata.ai/v1/youtube/transcript?videoId=\(encodedId)&lang=\(langParam)")
        else { return nil }

        guard let data = await supadataGET(url) else { return nil }
        guard let decoded = try? JSONDecoder().decode(SupadataResponse.self, from: data) else { return nil }
        let segments = mapSupadata(decoded.content ?? [], videoId: videoId)
        return (segments, decoded.availableLangs ?? [])
    }

    private static func supadataTranslate(videoId: String, lang: String) async -> [TranscriptSegment] {
        guard let encodedId = videoId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://api.supadata.ai/v1/youtube/transcript/translate?videoId=\(encodedId)&lang=\(lang)&text=false")
        else { return [] }
        guard let data = await supadataGET(url),
              let decoded = try? JSONDecoder().decode(SupadataResponse.self, from: data) else { return [] }
        return mapSupadata(decoded.content ?? [], videoId: videoId)
    }

    private static func supadataGET(_ url: URL) async -> Data? {
        var request = URLRequest(url: url)
        request.timeoutInterval = 25
        request.setValue(supadataKey, forHTTPHeaderField: "x-api-key")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }
            return data
        } catch {
            return nil
        }
    }

    private static func mapSupadata(_ items: [SupadataResponse.Item], videoId: String) -> [TranscriptSegment] {
        items.enumerated().compactMap { idx, item in
            let text = cleanHTML(item.text)
            guard !text.isEmpty else { return nil }
            return TranscriptSegment(
                id: "supadata-\(videoId)-\(idx)",
                text: text,
                start: (item.offset ?? 0) / 1000.0,
                duration: (item.duration ?? 0) / 1000.0
            )
        }
    }

    // MARK: - Backend transport (backup)

    private static func backendTranscript(videoId: String, lang: String) async -> [TranscriptSegment] {
        guard hasBackend,
              let encoded = videoId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "\(base)/youtube-transcript?videoId=\(encoded)&lang=\(lang)")
        else { return [] }
        return await decodeBackend(url)
    }

    private static func backendTranslate(videoId: String) async -> [TranscriptSegment] {
        guard hasBackend,
              let encoded = videoId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "\(base)/youtube-transcript-translate?videoId=\(encoded)&lang=fr")
        else { return [] }
        return await decodeBackend(url)
    }

    private static func decodeBackend(_ url: URL) async -> [TranscriptSegment] {
        var request = URLRequest(url: url)
        request.timeoutInterval = 30
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return [] }
            let decoded = try JSONDecoder().decode(TranscriptResponse.self, from: data)
            return decoded.segments.compactMap { seg in
                let text = cleanHTML(seg.text)
                guard !text.isEmpty else { return nil }
                return TranscriptSegment(id: seg.id, text: text, start: seg.start, duration: seg.duration)
            }
        } catch {
            return []
        }
    }

    // MARK: - HTML cleanup

    private static func cleanHTML(_ raw: String) -> String {
        var text = raw.replacingOccurrences(of: "<[^>]*>", with: "", options: .regularExpression)
        let entities: [String: String] = [
            "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"",
            "&#39;": "'", "&#x27;": "'", "&#x2F;": "/", "&apos;": "'", "&nbsp;": " ",
        ]
        for (entity, replacement) in entities {
            text = text.replacingOccurrences(of: entity, with: replacement)
        }
        text = text.replacingOccurrences(of: "\n", with: " ")
        return text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    // MARK: - AI translation fallback (OpenRouter)

    private static func translateToFrench(_ segments: [TranscriptSegment]) async -> [TranscriptSegment] {
        guard !Config.EXPO_PUBLIC_OPENROUTER_API_KEY.isEmpty else { return segments }
        var result = segments
        let batchSize = 10
        var i = 0
        while i < segments.count {
            let end = min(i + batchSize, segments.count)
            let batch = Array(segments[i..<end])
            let numbered = batch.enumerated()
                .map { "[\(i + $0.offset)] \($0.element.text)" }
                .joined(separator: "\n")
            if let translated = await translateBatch(numbered) {
                for line in translated.split(separator: "\n") {
                    guard let match = parseNumberedLine(String(line)),
                          match.index >= 0, match.index < result.count else { continue }
                    let old = result[match.index]
                    result[match.index] = TranscriptSegment(id: old.id, text: match.text, start: old.start, duration: old.duration)
                }
            }
            i = end
        }
        return result
    }

    private static func parseNumberedLine(_ line: String) -> (index: Int, text: String)? {
        guard let open = line.firstIndex(of: "["), let close = line.firstIndex(of: "]"), open < close else { return nil }
        let numStr = line[line.index(after: open)..<close]
        guard let idx = Int(numStr) else { return nil }
        let text = line[line.index(after: close)...].trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return nil }
        return (idx, text)
    }

    private static func translateBatch(_ numbered: String) async -> String? {
        guard let url = URL(string: "https://openrouter.ai/api/v1/chat/completions") else { return nil }
        let prompt = "Translate each numbered subtitle line below into French. Return ONLY the translated lines in the exact same [number] format. Keep translations natural and conversational. Do not add any extra text.\n\n\(numbered)"
        let payload: [String: Any] = [
            "model": "openai/gpt-4o-mini",
            "messages": [["role": "user", "content": prompt]],
            "temperature": 0.3,
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(Config.EXPO_PUBLIC_OPENROUTER_API_KEY)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        request.timeoutInterval = 30
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }
            let decoded = try JSONDecoder().decode(OpenRouterResponse.self, from: data)
            return decoded.choices.first?.message.content
        } catch {
            return nil
        }
    }
}

private nonisolated struct SupadataResponse: Decodable {
    struct Item: Decodable {
        let text: String
        let offset: Double?
        let duration: Double?
    }
    let content: [Item]?
    let lang: String?
    let availableLangs: [String]?
}

private nonisolated struct TranscriptResponse: Decodable {
    struct Segment: Decodable {
        let id: String
        let text: String
        let start: Double
        let duration: Double
    }
    let segments: [Segment]
    let source: String?
}
