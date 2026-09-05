//
//  SpeechToText.swift
//  FluentFrenchIOS
//
//  Speech-to-text via ElevenLabs Scribe. Records a short clip with the device
//  microphone and transcribes it to text. The cloud preview has no microphone,
//  so callers should check `VoiceRecorder.micAvailable` and keep showing the
//  on-device notice when it's false.
//

import AVFoundation
import Foundation

/// Transcribes recorded audio using the ElevenLabs Scribe endpoint.
enum SpeechToText {
    nonisolated static var apiKey: String { Config.EXPO_PUBLIC_ELEVENLABS_API_KEY }
    nonisolated static var hasKey: Bool { !apiKey.isEmpty }

    /// Transcribes the audio file at `fileURL`. `language` is an optional ISO-639
    /// code (e.g. "fra", "eng"); leave nil to let Scribe auto-detect.
    static func transcribe(fileURL: URL, language: String? = nil) async -> String? {
        guard hasKey, let data = try? Data(contentsOf: fileURL), !data.isEmpty else { return nil }
        guard let url = URL(string: "https://api.elevenlabs.io/v1/speech-to-text") else { return nil }

        let boundary = "Boundary-\(UUID().uuidString)"
        var body = Data()
        func field(_ name: String, _ value: String) {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(value)\r\n".data(using: .utf8)!)
        }
        field("model_id", "scribe_v1")
        if let language, !language.isEmpty { field("language_code", language) }
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"speech.m4a\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: audio/mp4\r\n\r\n".data(using: .utf8)!)
        body.append(data)
        body.append("\r\n".data(using: .utf8)!)
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 60
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "xi-api-key")
        request.httpBody = body

        do {
            let (respData, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }
            guard let json = try JSONSerialization.jsonObject(with: respData) as? [String: Any],
                  let text = json["text"] as? String else { return nil }
            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? nil : trimmed
        } catch {
            return nil
        }
    }
}
