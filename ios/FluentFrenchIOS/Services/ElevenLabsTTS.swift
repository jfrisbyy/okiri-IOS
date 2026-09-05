//
//  ElevenLabsTTS.swift
//  FluentFrenchIOS
//
//  Natural, human-sounding French text-to-speech via ElevenLabs (public client
//  key from Config). Audio is fetched as MP3, cached in-memory per (text,voice),
//  and played with AVAudioPlayer. Every call gracefully falls back to the
//  built-in AVSpeechSynthesizer when no key/network is available, so playback
//  never breaks.
//

import AVFoundation
import CryptoKit
import Foundation

/// Distinct ElevenLabs voices used across the app. IDs are stable public voices
/// that support the `eleven_multilingual_v2` model (good French pronunciation).
nonisolated enum NaturalVoiceID: String {
    case female = "21m00Tcm4TlvDq8ikWAM"   // Rachel — warm female
    case male = "pNInz6obpgDQGcFmaJgB"      // Adam — male
    case narrator = "EXAVITQu4vr4xnSDxMaL"  // Sarah — calm narration

    /// Voice for a listening dialogue speaker tag.
    static func forSpeaker(_ speaker: String) -> NaturalVoiceID {
        switch speaker {
        case "B": return .male
        case "narrator": return .narrator
        default: return .female
        }
    }
}

/// Fetches + caches ElevenLabs audio. An actor so the cache is concurrency-safe.
/// Audio is cached in-memory for the session and persisted to disk so repeat
/// taps replay instantly with no network request, even across app launches.
actor ElevenLabsTTS {
    static let shared = ElevenLabsTTS()

    private var cache: [String: Data] = [:]
    private var inFlight: [String: Task<Data?, Never>] = [:]

    /// Max number of clips kept on disk before the oldest are trimmed.
    private let maxDiskFiles = 400

    private let cacheDir: URL = {
        let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("tts", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    nonisolated static var apiKey: String { Config.EXPO_PUBLIC_ELEVENLABS_API_KEY }
    nonisolated static var hasKey: Bool { !apiKey.isEmpty }

    /// Returns MP3 audio for the text, or nil when unavailable (caller should
    /// fall back to the system synthesizer).
    func audio(for text: String, voice: NaturalVoiceID) async -> Data? {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard Self.hasKey, !clean.isEmpty else { return nil }
        let key = "\(voice.rawValue)|\(clean)"

        if let cached = cache[key] { return cached }
        if let disk = readDisk(key) {
            cache[key] = disk
            return disk
        }
        if let existing = inFlight[key] { return await existing.value }

        let task = Task<Data?, Never> { await Self.fetch(text: clean, voice: voice) }
        inFlight[key] = task
        let data = await task.value
        inFlight[key] = nil
        if let data {
            cache[key] = data
            writeDisk(key, data)
        }
        return data
    }

    // MARK: - Disk cache

    private func fileURL(for key: String) -> URL {
        let digest = SHA256.hash(data: Data(key.utf8))
        let name = digest.map { String(format: "%02x", $0) }.joined()
        return cacheDir.appendingPathComponent(name).appendingPathExtension("mp3")
    }

    private func readDisk(_ key: String) -> Data? {
        let url = fileURL(for: key)
        guard let data = try? Data(contentsOf: url), !data.isEmpty else { return nil }
        // Touch modification date so recently used clips survive trimming.
        try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: url.path)
        return data
    }

    private func writeDisk(_ key: String, _ data: Data) {
        let url = fileURL(for: key)
        try? data.write(to: url, options: .atomic)
        trimDiskIfNeeded()
    }

    /// Keeps the on-disk cache bounded by removing the least-recently-used clips.
    private func trimDiskIfNeeded() {
        let keys: [URLResourceKey] = [.contentModificationDateKey]
        guard let files = try? FileManager.default.contentsOfDirectory(
            at: cacheDir, includingPropertiesForKeys: keys
        ), files.count > maxDiskFiles else { return }
        let sorted = files.sorted { a, b in
            let da = (try? a.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
            let db = (try? b.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
            return da < db
        }
        for url in sorted.prefix(files.count - maxDiskFiles) {
            try? FileManager.default.removeItem(at: url)
        }
    }

    private static func fetch(text: String, voice: NaturalVoiceID) async -> Data? {
        guard let url = URL(string: "https://api.elevenlabs.io/v1/text-to-speech/\(voice.rawValue)") else { return nil }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("audio/mpeg", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "xi-api-key")
        let payload: [String: Any] = [
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": [
                "stability": 0.5,
                "similarity_boost": 0.8,
                "style": 0.2,
                "use_speaker_boost": true,
            ],
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200, !data.isEmpty else { return nil }
            return data
        } catch {
            return nil
        }
    }
}

/// Simple one-shot speaker for single utterances, used across every tap-to-hear
/// surface. Plays a natural ElevenLabs clip when possible, otherwise the system
/// voice in the requested language. Supports a slow-speed replay rate.
@MainActor
@Observable
final class NaturalVoice: NSObject {
    static let shared = NaturalVoice()

    /// Key ("voice|text") currently being fetched, so UI can show a spinner.
    private(set) var loadingKey: String? = nil

    private var player: AVAudioPlayer?
    private var token = 0

    /// Speaks `text` with a natural voice.
    /// - Parameters:
    ///   - voice: which natural voice to use.
    ///   - rate: playback speed (1.0 normal, 0.6 slow for pronunciation drills).
    ///   - fallbackLanguage: BCP-47 language for the system-voice fallback.
    func speak(_ text: String, voice: NaturalVoiceID = .female, rate: Float = 1.0, fallbackLanguage: String = "fr-FR") {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        token += 1
        let current = token
        stop()
        let key = "\(voice.rawValue)|\(clean)"
        loadingKey = key
        Task {
            let data = await ElevenLabsTTS.shared.audio(for: clean, voice: voice)
            guard current == token else { return }
            loadingKey = nil
            if let data, play(data, rate: rate) {
                return
            }
            FrenchSpeech.shared.speakAny(clean, language: fallbackLanguage, rate: synthRate(for: rate))
        }
    }

    func stop() {
        player?.stop()
        player = nil
        loadingKey = nil
        FrenchSpeech.shared.speak("")
    }

    @discardableResult
    private func play(_ data: Data, rate: Float) -> Bool {
        try? AVAudioSession.sharedInstance().setCategory(.playback, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        do {
            let p = try AVAudioPlayer(data: data)
            p.enableRate = true
            p.rate = max(0.5, min(2.0, rate))
            p.prepareToPlay()
            p.play()
            player = p
            return true
        } catch {
            return false
        }
    }

    /// Maps a playback-speed multiplier to an AVSpeechUtterance rate.
    private func synthRate(for rate: Float) -> Float {
        rate < 1.0 ? AVSpeechUtteranceDefaultSpeechRate * 0.6 : AVSpeechUtteranceDefaultSpeechRate
    }
}
