//
//  VoiceRecorder.swift
//  FluentFrenchIOS
//
//  Records short microphone clips for speech-to-text. Detects whether a real
//  microphone is available (the cloud preview has none) so callers can keep
//  showing the on-device notice. Recorded audio is transcribed with
//  `SpeechToText` (ElevenLabs Scribe).
//

import AVFoundation
import Foundation

@MainActor
@Observable
final class VoiceRecorder: NSObject {
    private(set) var isRecording = false
    private(set) var isTranscribing = false

    private var recorder: AVAudioRecorder?
    private var fileURL: URL?

    /// Whether a usable microphone input exists. False in the cloud simulator.
    var micAvailable: Bool {
        AVAudioSession.sharedInstance().isInputAvailable && SpeechToText.hasKey
    }

    /// Requests microphone permission, returning whether it was granted.
    func requestPermission() async -> Bool {
        await withCheckedContinuation { continuation in
            AVAudioApplication.requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }

    /// Begins recording to a temporary file. Returns whether recording started.
    @discardableResult
    func start() async -> Bool {
        guard !isRecording else { return false }
        guard await requestPermission() else { return false }

        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
            try session.setActive(true)
        } catch {
            return false
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
            guard rec.record() else { return false }
            recorder = rec
            fileURL = url
            isRecording = true
            return true
        } catch {
            return false
        }
    }

    /// Stops recording and transcribes the clip. Returns the recognized text.
    func stopAndTranscribe(language: String? = nil) async -> String? {
        guard isRecording, let recorder, let url = fileURL else {
            isRecording = false
            return nil
        }
        recorder.stop()
        self.recorder = nil
        isRecording = false
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])

        isTranscribing = true
        let text = await SpeechToText.transcribe(fileURL: url, language: language)
        isTranscribing = false
        try? FileManager.default.removeItem(at: url)
        fileURL = nil
        return text
    }

    /// Cancels recording without transcribing.
    func cancel() {
        recorder?.stop()
        recorder = nil
        isRecording = false
        if let url = fileURL { try? FileManager.default.removeItem(at: url) }
        fileURL = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    }
}
