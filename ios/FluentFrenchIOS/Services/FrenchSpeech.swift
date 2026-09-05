//
//  FrenchSpeech.swift
//  FluentFrenchIOS
//
//  Simple French text-to-speech using AVSpeechSynthesizer.
//

import AVFoundation

@MainActor
final class FrenchSpeech {
    static let shared = FrenchSpeech()
    private let synthesizer = AVSpeechSynthesizer()

    private init() {
        try? AVAudioSession.sharedInstance().setCategory(.playback, options: [.mixWithOthers])
    }

    func speak(_ text: String, rate: Float = AVSpeechUtteranceDefaultSpeechRate) {
        speakAny(text, language: "fr-FR", rate: rate)
    }

    /// Speak text in an arbitrary BCP-47 language (e.g. "en-US", "fr-FR").
    func speakAny(_ text: String, language: String, rate: Float = AVSpeechUtteranceDefaultSpeechRate) {
        guard !text.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        if synthesizer.isSpeaking {
            synthesizer.stopSpeaking(at: .immediate)
        }
        try? AVAudioSession.sharedInstance().setActive(true)
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: language)
        utterance.rate = rate
        utterance.pitchMultiplier = 1.0
        synthesizer.speak(utterance)
    }
}
