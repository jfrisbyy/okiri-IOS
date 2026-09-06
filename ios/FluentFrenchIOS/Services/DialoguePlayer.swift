//
//  DialoguePlayer.swift
//  FluentFrenchIOS
//
//  Plays a French listening scenario turn-by-turn with natural, human-sounding
//  ElevenLabs voices (distinct voice per speaker), falling back to the built-in
//  AVSpeechSynthesizer — and saying so — when the voice service is unavailable.
//  All transport state lives in `PlaybackState` (testable, view-free): pausing
//  or jumping clears buffering and drops the clip in flight, every fetch is
//  bounded by `Tuning.ttsFetchTimeout`, and "Skip the wait" is always offered
//  while a clip buffers (E17).
//

import AVFoundation
import Foundation
import SwiftUI

@MainActor
@Observable
final class DialoguePlayer: NSObject {
    private(set) var turns: [ListeningTurn] = []
    private(set) var state = PlaybackState()
    /// Which voice is speaking this dialogue. Starts natural when a key exists and
    /// switches (with a reason) the first time a natural clip cannot be played.
    private(set) var voiceSource: VoiceSource = ElevenLabsTTS.hasKey ? .natural : .system(.noKey)

    /// Plain playback-speed multiplier (1.0 = normal).
    var rate: Float = 1.0

    private let synthesizer = AVSpeechSynthesizer()
    private var audioPlayer: AVAudioPlayer?
    private var voiceA: AVSpeechSynthesisVoice?
    private var voiceB: AVSpeechSynthesisVoice?
    /// Once the learner skips a wait (or the service is unavailable) the rest of
    /// the dialogue uses the built-in voice — no more spinners for this session.
    private var preferSystemVoice = !ElevenLabsTTS.hasKey

    var currentIndex: Int { state.currentIndex }
    var isPlaying: Bool { state.isPlaying }
    var didFinish: Bool { state.didFinish }
    var isBuffering: Bool { state.isBuffering }
    var progress: Double { state.progress }

    var currentTurn: ListeningTurn? {
        guard turns.indices.contains(state.currentIndex) else { return nil }
        return turns[state.currentIndex]
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
        stopAudio()
        turns = item.turns
        state.load(turnCount: item.turns.count)
        preferSystemVoice = !ElevenLabsTTS.hasKey
        voiceSource = ElevenLabsTTS.hasKey ? .natural : .system(.noKey)
    }

    func togglePlay() {
        if state.isPlaying { pause() } else { play() }
    }

    func play() {
        // Play after the end starts the dialogue over.
        if state.didFinish { _ = state.jump(to: 0) }
        guard state.play() else { return }
        // Resume a paused clip / utterance if we have one.
        if let audioPlayer, !audioPlayer.isPlaying, audioPlayer.currentTime > 0 {
            audioPlayer.play()
            return
        }
        if synthesizer.isPaused {
            synthesizer.continueSpeaking()
            return
        }
        speakCurrent()
    }

    func pause() {
        state.pause()
        audioPlayer?.pause()
        if synthesizer.isSpeaking {
            synthesizer.pauseSpeaking(at: .word)
        }
    }

    func stop() {
        state.stop()
        stopAudio()
    }

    func skipForward() {
        guard state.currentIndex < turns.count - 1 else { return }
        jump(to: state.currentIndex + 1)
    }

    func skipBackward() {
        jump(to: max(0, state.currentIndex - 1))
    }

    func jump(to index: Int) {
        stopAudio()
        if state.jump(to: index) {
            speakCurrent()
        }
    }

    func replayCurrent() {
        stopAudio()
        if state.replay() {
            speakCurrent()
        }
    }

    /// "Skip the wait": stop buffering the natural clip and speak this line —
    /// and the rest of the dialogue — with the built-in voice right now.
    func skipBuffering() {
        guard state.isBuffering else { return }
        preferSystemVoice = true
        voiceSource = .system(.skippedWait)
        if state.skipBuffering(), let turn = currentTurn {
            _ = state.beginTurn()
            speakSynth(turn)
        }
    }

    // MARK: - Speaking

    private func speakCurrent() {
        guard let turn = currentTurn else { return }
        guard !preferSystemVoice else {
            _ = state.beginTurn()
            speakSynth(turn)
            return
        }
        let token = state.beginFetch()
        let voice = NaturalVoiceID.forSpeaker(turn.speaker)
        let text = turn.french
        Task {
            let fetched = await Deadline.run(seconds: Tuning.ttsFetchTimeout) {
                await ElevenLabsTTS.shared.fetch(text, voice: voice)
            }
            // Clears buffering for this token whether or not we still play.
            guard state.finishFetch(token: token) else { return }
            switch fetched {
            case .audio(let data)?:
                if playNatural(data) {
                    voiceSource = .natural
                    return
                }
                fallBack(.serviceError, turn)
            case .unavailable(let failure)?:
                fallBack(SystemVoiceReason(failure), turn)
            case nil:
                fallBack(.serviceError, turn)
            }
        }
    }

    private func fallBack(_ reason: SystemVoiceReason, _ turn: ListeningTurn) {
        voiceSource = .system(reason)
        // A missing key or a dead connection will not fix itself mid-dialogue;
        // a single service hiccup may, so keep trying natural clips after one.
        if reason != .serviceError { preferSystemVoice = true }
        speakSynth(turn)
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

    private func stopAudio() {
        audioPlayer?.stop()
        audioPlayer = nil
        if synthesizer.isSpeaking || synthesizer.isPaused {
            synthesizer.stopSpeaking(at: .immediate)
        }
    }

    private func advanceAfterTurn() {
        switch state.turnFinished() {
        case .speakNext: speakCurrent()
        case .finished, .ignore: break
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
