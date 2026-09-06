//
//  ElevenLabsTTS.swift
//  FluentFrenchIOS
//
//  Natural, human-sounding French text-to-speech via ElevenLabs (public client
//  key from Config). Audio is fetched as MP3, cached in memory per (text, voice)
//  and on disk, and played with AVAudioPlayer. Every fetch answers with a typed
//  result — audio, or an explicit `MediaServiceFailure` (no key, offline,
//  service error) — and is bounded by `Tuning.ttsFetchTimeout`, so a caller
//  can fall back to the built-in voice and SAY so (E26).
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
    private var inFlight: [String: Task<NaturalVoiceFetch, Never>] = [:]

    private let cacheDir: URL = {
        let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("tts", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    nonisolated static var apiKey: String { Config.EXPO_PUBLIC_ELEVENLABS_API_KEY }
    nonisolated static var hasKey: Bool { !apiKey.isEmpty }

    /// Natural audio for the text, or the reason there is none. A cached clip is
    /// returned even without a key or a connection.
    func fetch(_ text: String, voice: NaturalVoiceID) async -> NaturalVoiceFetch {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return .unavailable(.serviceError) }
        let key = "\(voice.rawValue)|\(clean)"

        if let cached = cache[key] { return .audio(cached) }
        if let disk = readDisk(key) {
            cache[key] = disk
            return .audio(disk)
        }
        guard Self.hasKey else { return .unavailable(.noKey) }
        if let existing = inFlight[key] { return await existing.value }

        let task = Task<NaturalVoiceFetch, Never> { await Self.download(text: clean, voice: voice) }
        inFlight[key] = task
        let result = await task.value
        inFlight[key] = nil
        if case .audio(let data) = result {
            cache[key] = data
            writeDisk(key, data)
        }
        return result
    }

    /// Legacy convenience: the audio, or nil when unavailable for any reason.
    func audio(for text: String, voice: NaturalVoiceID) async -> Data? {
        if case .audio(let data) = await fetch(text, voice: voice) { return data }
        return nil
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
        let limit = Tuning.ttsDiskCacheFiles
        guard let files = try? FileManager.default.contentsOfDirectory(
            at: cacheDir, includingPropertiesForKeys: keys
        ), files.count > limit else { return }
        let sorted = files.sorted { a, b in
            let da = (try? a.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
            let db = (try? b.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
            return da < db
        }
        for url in sorted.prefix(files.count - limit) {
            try? FileManager.default.removeItem(at: url)
        }
    }

    // MARK: - Network

    private static func download(text: String, voice: NaturalVoiceID) async -> NaturalVoiceFetch {
        guard let url = URL(string: "https://api.elevenlabs.io/v1/text-to-speech/\(voice.rawValue)") else {
            return .unavailable(.serviceError)
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = Tuning.ttsFetchTimeout
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
            guard let http = response as? HTTPURLResponse else { return .unavailable(.serviceError) }
            if let failure = MediaServiceFailure.classify(statusCode: http.statusCode) { return .unavailable(failure) }
            guard !data.isEmpty else { return .unavailable(.serviceError) }
            return .audio(data)
        } catch {
            return .unavailable(MediaServiceFailure.classify(error))
        }
    }
}

/// Simple one-shot speaker for single utterances, used across every tap-to-hear
/// surface. Plays a natural ElevenLabs clip when possible, otherwise the system
/// voice in the requested language — and records WHICH voice spoke last in
/// `source`, so a surface can label the fallback. Supports a slow replay rate.
@MainActor
@Observable
final class NaturalVoice: NSObject {
    static let shared = NaturalVoice()

    /// Key ("voice|text") currently being fetched, so UI can show a spinner.
    /// Cleared within `Tuning.ttsFetchTimeout` no matter what.
    private(set) var loadingKey: String? = nil

    /// The voice that spoke (or is speaking) the last utterance.
    private(set) var source: VoiceSource = ElevenLabsTTS.hasKey ? .natural : .system(.noKey)

    /// True while an utterance is actually producing sound (natural clip or the
    /// built-in fallback voice). Cleared when it finishes, so a surface can drop
    /// its "playing" highlight instead of leaving it lit forever.
    private(set) var isSpeaking = false

    /// Who asked for the utterance that is loading or sounding now, so a surface
    /// with several speak controls can light up exactly the one that started it.
    /// Observable, so those controls re-render when the owner changes.
    private(set) var owner: UUID? = nil

    private var player: AVAudioPlayer?
    private var token = 0

    var isLoading: Bool { loadingKey != nil }

    /// True from the moment `speak` is called until the sound has stopped —
    /// fetching included, so a caller can set a highlight synchronously.
    var isBusy: Bool { isLoading || isSpeaking }

    /// Speaks `text` with a natural voice.
    /// - Parameters:
    ///   - voice: which natural voice to use.
    ///   - rate: playback speed (1.0 normal, 0.6 slow for pronunciation drills).
    ///   - fallbackLanguage: BCP-47 language for the system-voice fallback.
    ///   - owner: identifies the control that started this utterance.
    func speak(_ text: String, voice: NaturalVoiceID = .female, rate: Float = 1.0, fallbackLanguage: String = "fr-FR", owner: UUID? = nil) {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        stop()
        self.owner = owner
        token += 1
        let current = token
        let key = "\(voice.rawValue)|\(clean)"
        loadingKey = key
        Task {
            let fetched = await Deadline.run(seconds: Tuning.ttsFetchTimeout) {
                await ElevenLabsTTS.shared.fetch(clean, voice: voice)
            }
            guard current == token else { return }
            loadingKey = nil
            switch fetched {
            case .audio(let data)?:
                if play(data, rate: rate) {
                    source = .natural
                    isSpeaking = true
                    watchPlayback(for: current)
                    return
                }
                source = .system(.serviceError)
            case .unavailable(let failure)?:
                source = .system(SystemVoiceReason(failure))
            case nil:
                source = .system(.serviceError)
            }
            FrenchSpeech.shared.speakAny(clean, language: fallbackLanguage, rate: synthRate(for: rate))
            isSpeaking = true
            watchPlayback(for: current)
        }
    }

    /// Polls until the utterance `watched` started has stopped making sound, then
    /// clears `isSpeaking`. A newer utterance (or `stop()`) bumps the token and
    /// this watcher retires without touching the flag it no longer owns.
    private func watchPlayback(for watched: Int) {
        Task {
            while token == watched {
                try? await Task.sleep(nanoseconds: UInt64(Tuning.voicePlaybackPollInterval * 1_000_000_000))
                guard token == watched else { return }
                if player?.isPlaying == true { continue }
                if FrenchSpeech.shared.isSpeaking { continue }
                isSpeaking = false
                owner = nil
                return
            }
        }
    }

    /// Silence whichever voice is speaking and drop any clip still loading.
    func stop() {
        token += 1
        player?.stop()
        player = nil
        loadingKey = nil
        isSpeaking = false
        owner = nil
        FrenchSpeech.shared.stop()
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
