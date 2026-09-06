//
//  SpeechToText.swift
//  FluentFrenchIOS
//
//  Speech-to-text for short recorded clips (public client key from Config).
//  Every call resolves to a `TranscriptionOutcome`: the text, "nothing heard",
//  or a learner-facing `TalkServiceFailure` — never a silent nil. Callers check
//  `VoiceRecorder.availability` before recording so the no-key case is shown as
//  an explicit state rather than discovered after the learner has spoken.
//

import Foundation

enum SpeechToText {
    nonisolated static var apiKey: String { Config.EXPO_PUBLIC_ELEVENLABS_API_KEY }
    nonisolated static var hasKey: Bool { !apiKey.isEmpty }

    /// Transcribes the audio file at `fileURL`. `language` is an optional ISO-639
    /// code (e.g. "fra", "eng"); leave nil to auto-detect.
    static func transcribe(fileURL: URL, language: String? = nil) async -> TranscriptionOutcome {
        guard hasKey else { return .failed(.noKey) }
        guard let data = try? Data(contentsOf: fileURL), !data.isEmpty else { return .nothingHeard }
        guard let url = URL(string: "https://api.elevenlabs.io/v1/speech-to-text") else { return .failed(.serviceUnavailable) }

        let boundary = "Boundary-\(UUID().uuidString)"
        var body = Data()
        func field(_ name: String, _ value: String) {
            body.append(Data("--\(boundary)\r\n".utf8))
            body.append(Data("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".utf8))
            body.append(Data("\(value)\r\n".utf8))
        }
        field("model_id", "scribe_v1")
        if let language, !language.isEmpty { field("language_code", language) }
        body.append(Data("--\(boundary)\r\n".utf8))
        body.append(Data("Content-Disposition: form-data; name=\"file\"; filename=\"speech.m4a\"\r\n".utf8))
        body.append(Data("Content-Type: audio/mp4\r\n\r\n".utf8))
        body.append(data)
        body.append(Data("\r\n".utf8))
        body.append(Data("--\(boundary)--\r\n".utf8))

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = Tuning.speechToTextTimeout
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "xi-api-key")
        request.httpBody = body

        let respData: Data
        let response: URLResponse
        do {
            (respData, response) = try await URLSession.shared.data(for: request)
        } catch {
            return .failed(TalkServiceFailure.classify(error))
        }
        if let http = response as? HTTPURLResponse, let failure = TalkServiceFailure.classify(statusCode: http.statusCode) {
            return .failed(failure)
        }
        guard let json = (try? JSONSerialization.jsonObject(with: respData)) as? [String: Any],
              let text = json["text"] as? String else {
            return .failed(.badResponse)
        }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? .nothingHeard : .text(trimmed)
    }
}
