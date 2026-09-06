//
//  FrenchSpeech.swift
//  FluentFrenchIOS
//
//  The device's built-in text-to-speech (AVSpeechSynthesizer). This is the
//  fallback every tap-to-hear surface uses when a natural voice is unavailable;
//  `stop()` is the ONE way to silence it (E18).
//

import AVFoundation
import Foundation

@MainActor
final class FrenchSpeech {
    static let shared = FrenchSpeech()
    private let synthesizer = AVSpeechSynthesizer()

    private init() {
        try? AVAudioSession.sharedInstance().setCategory(.playback, options: [.mixWithOthers])
    }

    /// True while the built-in voice is speaking (or paused mid-utterance).
    var isSpeaking: Bool { synthesizer.isSpeaking || synthesizer.isPaused }

    func speak(_ text: String, rate: Float = AVSpeechUtteranceDefaultSpeechRate) {
        speakAny(text, language: "fr-FR", rate: rate)
    }

    /// Speak text in an arbitrary BCP-47 language (e.g. "en-US", "fr-FR").
    func speakAny(_ text: String, language: String, rate: Float = AVSpeechUtteranceDefaultSpeechRate) {
        guard !text.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        stop()
        try? AVAudioSession.sharedInstance().setActive(true)
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: language)
        utterance.rate = rate
        utterance.pitchMultiplier = 1.0
        synthesizer.speak(utterance)
    }

    /// Stop the built-in voice immediately. Safe to call when nothing is speaking.
    func stop() {
        if synthesizer.isSpeaking || synthesizer.isPaused {
            synthesizer.stopSpeaking(at: .immediate)
        }
    }
}
