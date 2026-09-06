//
//  VoiceRecorder.swift
//  FluentFrenchIOS
//
//  Records short microphone clips for speech-to-text with a hard cap on their
//  length (E16), and tells the surfaces exactly why the microphone cannot be
//  used when it cannot (E14): permission denied, no transcription key, or no
//  input device — three distinct `MicAvailability` states, never a generic
//  "install elsewhere" notice. Recorded audio is transcribed with `SpeechToText`.
//

import AVFoundation
import Foundation

@MainActor
@Observable
final class VoiceRecorder {
    private(set) var isRecording = false
    private(set) var isTranscribing = false
    /// Seconds left before the cap stops the recording (0 when idle).
    private(set) var secondsLeft = 0
    /// The cap the current / last recording ran under, in seconds.
    private(set) var capSeconds = 0
    /// Flips to true when the recorder stopped itself at the cap; the view then
    /// transcribes what was recorded. Cleared by the next start / cancel.
    private(set) var stoppedAtCap = false
    /// Seconds captured before something else took the microphone (a call, Siri,
    /// the app leaving the foreground). nil while nothing has interrupted the
    /// current recording. The surfaces watch this so a dead microphone never goes
    /// on counting down, and feedback on the fragment is announced as such
    /// (talkmedia-4-3). Cleared by the next start / cancel.
    private(set) var interruptedSeconds: Int?

    private var recorder: AVAudioRecorder?
    private var fileURL: URL?
    private var countdown: Task<Void, Never>?
    private var interruptionObserver: NSObjectProtocol?

    /// Why `start` would fail.
    enum StartFailure: Error, Equatable {
        case unavailable(MicAvailability)
        case audioSessionFailed
        case alreadyRecording
    }

    /// The microphone path's state right now (re-read on every access so a
    /// Settings change is picked up when the learner comes back).
    var availability: MicAvailability {
        MicAvailability.resolve(
            hasTranscriptionKey: SpeechToText.hasKey,
            inputAvailable: AVAudioSession.sharedInstance().isInputAvailable,
            permissionDenied: AVAudioApplication.shared.recordPermission == .denied
        )
    }

    /// Requests microphone permission (prompting when undetermined), returning
    /// whether it is granted.
    func requestPermission() async -> Bool {
        switch AVAudioApplication.shared.recordPermission {
        case .granted: return true
        case .denied: return false
        default: break
        }
        return await AVAudioApplication.requestRecordPermission()
    }

    /// Begins recording to a temporary file, stopping itself after `maxSeconds`.
    func start(maxSeconds: Int) async -> Result<Void, StartFailure> {
        guard !isRecording else { return .failure(.alreadyRecording) }
        let state = availability
        guard state.isReady || state == .permissionDenied else { return .failure(.unavailable(state)) }
        guard await requestPermission() else { return .failure(.unavailable(.permissionDenied)) }

        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
            try session.setActive(true)
        } catch {
            return .failure(.audioSessionFailed)
        }

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("speech-\(UUID().uuidString)")
            .appendingPathExtension("m4a")
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
        ]
        do {
            let rec = try AVAudioRecorder(url: url, settings: settings)
            rec.prepareToRecord()
            guard rec.record() else { return .failure(.audioSessionFailed) }
            recorder = rec
            fileURL = url
            isRecording = true
            stoppedAtCap = false
            interruptedSeconds = nil
            capSeconds = max(1, maxSeconds)
            secondsLeft = capSeconds
            observeInterruptions()
            startCountdown()
            return .success(())
        } catch {
            return .failure(.audioSessionFailed)
        }
    }

    /// Ticks `secondsLeft` once a second and stops the recorder at the cap.
    private func startCountdown() {
        countdown?.cancel()
        countdown = Task { [weak self] in
            while let self, self.isRecording, self.secondsLeft > 0 {
                try? await Task.sleep(for: .seconds(1))
                guard !Task.isCancelled, self.isRecording else { return }
                self.secondsLeft = max(0, self.secondsLeft - 1)
            }
            guard let self, !Task.isCancelled, self.isRecording else { return }
            self.stopRecorder()
            self.stoppedAtCap = true
        }
    }

    /// Watch for the system taking the microphone away mid-recording. Without
    /// this the capture stops but `isRecording` stays true, so the countdown goes
    /// on promising "Listening…" over a dead microphone (talkmedia-4-3).
    private func observeInterruptions() {
        guard interruptionObserver == nil else { return }
        interruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance(),
            queue: .main
        ) { [weak self] note in
            guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                  AVAudioSession.InterruptionType(rawValue: raw) == .began else { return }
            Task { @MainActor in self?.noteInterrupted() }
        }
    }

    private func stopObservingInterruptions() {
        if let interruptionObserver { NotificationCenter.default.removeObserver(interruptionObserver) }
        interruptionObserver = nil
    }

    /// Something else took the microphone (an interruption, or the app leaving the
    /// foreground — the target has no background audio mode, so capture stops
    /// either way). Stop for real and publish how much was actually captured.
    func noteInterrupted() {
        guard isRecording else { return }
        let captured = max(0, capSeconds - secondsLeft)
        stopRecorder()
        stoppedAtCap = false
        interruptedSeconds = captured
    }

    /// Stops the audio recorder, keeping the file for transcription.
    private func stopRecorder() {
        countdown?.cancel()
        countdown = nil
        stopObservingInterruptions()
        recorder?.stop()
        recorder = nil
        isRecording = false
        secondsLeft = 0
        let session = AVAudioSession.sharedInstance()
        try? session.setActive(false, options: [.notifyOthersOnDeactivation])
        // Leave the process-wide session as we found it: recording swapped it to
        // `.playAndRecord`/`.measurement`, which would otherwise stay in force for
        // every later playback (tutor replies, "Hear the corrected line", Listen).
        try? session.setCategory(.playback, options: [.mixWithOthers])
    }

    /// Stops recording (if still running) and transcribes the clip.
    func stopAndTranscribe(language: String? = nil) async -> TranscriptionOutcome {
        if isRecording { stopRecorder() }
        stoppedAtCap = false
        guard let url = fileURL else { return .nothingHeard }
        fileURL = nil
        isTranscribing = true
        let outcome = await SpeechToText.transcribe(fileURL: url, language: language)
        isTranscribing = false
        try? FileManager.default.removeItem(at: url)
        return outcome
    }

    /// Cancels recording without transcribing.
    func cancel() {
        stopRecorder()
        stoppedAtCap = false
        interruptedSeconds = nil
        if let url = fileURL { try? FileManager.default.removeItem(at: url) }
        fileURL = nil
    }
}
