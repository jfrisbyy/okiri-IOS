//
//  DialoguePlayer.swift
//  FluentFrenchIOS
//
//  Plays a French listening scenario turn-by-turn with natural, human-sounding
//  ElevenLabs voices (distinct voice per speaker), falling back to the system
//  AVSpeechSynthesizer when the voice service is unavailable. Tracks the current
//  line for subtitles and supports play/pause, skip, and playback speed.
//

import AVFoundation
import SwiftUI

@MainActor
@Observable
final class DialoguePlayer: NSObject {
    private(set) var turns: [ListeningTurn] = []
    private(set) var currentIndex = 0
    private(set) var isPlaying = false
    private(set) var didFinish = false
    private(set) var isBuffering = false

    /// Plain playback-speed multiplier (1.0 = normal).
    var rate: Float = 1.0

    private let synthesizer = AVSpeechSynthesizer()
    private var audioPlayer: AVAudioPlayer?
    private var voiceA: AVSpeechSynthesisVoice?
    private var voiceB: AVSpeechSynthesisVoice?
    /// Monotonic token to ignore stale async audio fetches after skip/stop.
    private var playToken = 0

    var progress: Double {
        guard !turns.isEmpty else { return 0 }
        return Double(currentIndex) / Double(turns.count)
    }

    var currentTurn: ListeningTurn? {
        guard turns.indices.contains(currentIndex) else { return nil }
        return turns[currentIndex]
    }

    override init() {
        super.init()
        synthesizer.delegate = self
        try? AVAudioSession.sharedInstance().setCategory(.playback, options: [.mixWithOthers])
        let french = AVSpeechSynthesisVoice.speechVoices().filter { $0.language.hasPrefix("fr") }
        voiceA = french.first(where: { $0.gender == .female }) ?? AVSpeechSynthesisVoice(language: "fr-FR")
        voiceB = french.first(where: { $0.gender == .male }) ?? french.dropFirst().first ?? AVSpeechSynthesisVoice(language: "fr-FR")
    }

    func load(_ item: ListeningItem) {
        stop()
        turns = item.turns
        currentIndex = 0
        didFinish = false
    }

    func togglePlay() {
        if isPlaying { pause() } else { play() }
    }

    func play() {
        guard !turns.isEmpty else { return }
        didFinish = false
        // Resume a paused MP3 clip if we have one.
        if let audioPlayer, !audioPlayer.isPlaying, audioPlayer.currentTime > 0 {
            audioPlayer.play()
            isPlaying = true
            return
        }
        if synthesizer.isPaused {
            synthesizer.continueSpeaking()
            isPlaying = true
            return
        }
        isPlaying = true
        speakCurrent()
    }

    func pause() {
        isPlaying = false
        audioPlayer?.pause()
        if synthesizer.isSpeaking {
            synthesizer.pauseSpeaking(at: .word)
        }
    }

    func stop() {
        isPlaying = false
        playToken += 1
        isBuffering = false
        audioPlayer?.stop()
        audioPlayer = nil
        if synthesizer.isSpeaking || synthesizer.isPaused {
            synthesizer.stopSpeaking(at: .immediate)
        }
    }

    func skipForward() {
        guard currentIndex < turns.count - 1 else { return }
        jump(to: currentIndex + 1)
    }

    func skipBackward() {
        jump(to: max(0, currentIndex - 1))
    }

    func jump(to index: Int) {
        let wasPlaying = isPlaying
        playToken += 1
        audioPlayer?.stop()
        audioPlayer = nil
        synthesizer.stopSpeaking(at: .immediate)
        currentIndex = min(max(0, index), turns.count - 1)
        didFinish = false
        if wasPlaying {
            isPlaying = true
            speakCurrent()
        }
    }

    func replayCurrent() {
        playToken += 1
        audioPlayer?.stop()
        audioPlayer = nil
        synthesizer.stopSpeaking(at: .immediate)
        isPlaying = true
        speakCurrent()
    }

    private func speakCurrent() {
        guard turns.indices.contains(currentIndex) else { return }
        let turn = turns[currentIndex]
        playToken += 1
        let token = playToken

        // Try natural ElevenLabs audio first; fall back to the system voice.
        if ElevenLabsTTS.hasKey {
            isBuffering = true
            Task {
                let data = await ElevenLabsTTS.shared.audio(for: turn.french, voice: NaturalVoiceID.forSpeaker(turn.speaker))
                guard token == playToken, isPlaying else { return }
                isBuffering = false
                if let data, playNatural(data) {
                    return
                }
                speakSynth(turn)
            }
        } else {
            speakSynth(turn)
        }
    }

    private func playNatural(_ data: Data) -> Bool {
        try? AVAudioSession.sharedInstance().setActive(true)
        do {
            let p = try AVAudioPlayer(data: data)
            p.delegate = self
            p.enableRate = true
            p.rate = max(0.5, min(2.0, rate))
            p.prepareToPlay()
            p.play()
            audioPlayer = p
            return true
        } catch {
            return false
        }
    }

    private func speakSynth(_ turn: ListeningTurn) {
        try? AVAudioSession.sharedInstance().setActive(true)
        let utterance = AVSpeechUtterance(string: turn.french)
        utterance.voice = turn.speaker == "B" ? voiceB : voiceA
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate * rate
        utterance.postUtteranceDelay = 0.35
        synthesizer.speak(utterance)
    }

    private func advanceAfterTurn() {
        guard isPlaying else { return }
        if currentIndex < turns.count - 1 {
            currentIndex += 1
            speakCurrent()
        } else {
            isPlaying = false
            didFinish = true
        }
    }
}

extension DialoguePlayer: AVSpeechSynthesizerDelegate {
    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in advanceAfterTurn() }
    }
}

extension DialoguePlayer: AVAudioPlayerDelegate {
    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in
            audioPlayer = nil
            advanceAfterTurn()
        }
    }
}
