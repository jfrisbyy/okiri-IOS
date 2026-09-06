//
//  TalkSupport.swift
//  FluentFrenchIOS
//
//  Pure helpers shared by the talk surfaces (Converse, Speak, Scenarios): the
//  learner-facing failure vocabulary every AI-backed call resolves to, the
//  microphone availability states, JSON extraction from a model reply, and
//  taxonomy-id validation for the concepts a reply names. Foundation only — no
//  views — so the Linux harness compiles and tests it.
//

import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// Why a talk surface could not do its job. Every network-backed call on these
/// surfaces resolves to exactly one of these, and every case has copy a learner
/// can act on. Nothing here names a vendor or an internal tool.
nonisolated enum TalkServiceFailure: Error, Equatable {
    /// The build has no AI key: the feature is unavailable, not broken.
    case noKey
    /// No network path (or the request never reached the service).
    case offline
    /// The service answered with an error or timed out.
    case serviceUnavailable
    /// The service answered, but not in a shape we could use.
    case badResponse

    /// Short learner-facing explanation.
    var message: String {
        switch self {
        case .noKey: return "Live AI features aren't available in this build."
        case .offline: return "You're offline. Check your connection and try again."
        case .serviceUnavailable: return "The tutor service isn't responding right now. Please try again in a moment."
        case .badResponse: return "The tutor's reply couldn't be read. Please try again."
        }
    }

    /// One-line title for a banner or alert.
    var title: String {
        switch self {
        case .noKey: return "Not available"
        case .offline: return "No connection"
        case .serviceUnavailable: return "Service unavailable"
        case .badResponse: return "Something went wrong"
        }
    }

    /// Whether a retry can plausibly succeed (a missing key never resolves at runtime).
    var isRetryable: Bool { self != .noKey }

    /// The failure a thrown transport error stands for: connectivity errors are
    /// `.offline`, everything else (timeouts included) is the service's fault.
    static func classify(_ error: Error) -> TalkServiceFailure {
        if let urlError = error as? URLError {
            switch urlError.code {
            case .notConnectedToInternet, .networkConnectionLost, .cannotFindHost, .cannotConnectToHost,
                 .dnsLookupFailed, .internationalRoamingOff, .dataNotAllowed, .callIsActive:
                return .offline
            default:
                return .serviceUnavailable
            }
        }
        return .serviceUnavailable
    }

    /// The failure an HTTP status stands for (nil for a success status).
    static func classify(statusCode: Int) -> TalkServiceFailure? {
        (200..<300).contains(statusCode) ? nil : .serviceUnavailable
    }
}

/// Whether the microphone path can be used right now, and what to tell the
/// learner when it cannot. The three closed states are deliberately distinct
/// (E14): a denied permission is fixed in Settings, a missing key is a property
/// of the build, and a missing input device is the hardware.
nonisolated enum MicAvailability: Equatable {
    case ready
    /// The learner declined microphone access; only Settings can reopen it.
    case permissionDenied
    /// The build has no speech-to-text key: voice input is unavailable, not broken.
    case transcriptionUnavailable
    /// The device reports no audio input.
    case noInputDevice

    var isReady: Bool { self == .ready }

    /// Short headline for a notice or alert.
    var title: String {
        switch self {
        case .ready: return "Microphone ready"
        case .permissionDenied: return "Microphone access is off"
        case .transcriptionUnavailable: return "Voice input isn't available"
        case .noInputDevice: return "No microphone detected"
        }
    }

    /// What the learner can do about it. `typedAlternative` names the fallback
    /// ("type your reply", "use Write") the surface offers.
    func message(typedAlternative: String) -> String {
        switch self {
        case .ready: return ""
        case .permissionDenied:
            return "Allow microphone access in Settings to speak, or \(typedAlternative)."
        case .transcriptionUnavailable:
            return "Speech recognition isn't included in this build, so you can \(typedAlternative)."
        case .noInputDevice:
            return "This device has no audio input, so you can \(typedAlternative)."
        }
    }

    /// Only a denied permission has a fix the app can open (the Settings deep link).
    var canOpenSettings: Bool { self == .permissionDenied }

    /// Resolve the state from the three facts the recorder can observe. The key
    /// is checked first — without it, a working microphone changes nothing.
    static func resolve(hasTranscriptionKey: Bool, inputAvailable: Bool, permissionDenied: Bool) -> MicAvailability {
        guard hasTranscriptionKey else { return .transcriptionUnavailable }
        guard inputAvailable else { return .noInputDevice }
        guard !permissionDenied else { return .permissionDenied }
        return .ready
    }
}

/// What one recording turned into once transcribed.
nonisolated enum TranscriptionOutcome: Equatable {
    case text(String)
    /// The service answered but heard no words.
    case nothingHeard
    case failed(TalkServiceFailure)

    var text: String? {
        if case .text(let t) = self { return t }
        return nil
    }

    /// Learner-facing copy for the two non-text outcomes (nil for text).
    var message: String? {
        switch self {
        case .text: return nil
        case .nothingHeard: return "We didn't catch any words. Try again a little closer to the microphone."
        case .failed(let failure): return failure.message
        }
    }
}

/// Pulls the first JSON object out of a model reply that may be wrapped in prose
/// or a markdown fence.
nonisolated enum ModelJSON {
    static func objectData(in raw: String) -> Data? {
        guard let start = raw.firstIndex(of: "{"), let end = raw.lastIndex(of: "}"), start <= end else { return nil }
        return String(raw[start...end]).data(using: .utf8)
    }
}

/// Concept ids a model names are only evidence if they exist in the taxonomy.
nonisolated enum ConceptIdFilter {
    /// Keep the ids that name a known concept, in order, without duplicates,
    /// capped at `limit` (0 or less means no cap).
    static func valid(_ ids: [String], in concepts: [Concept], limit: Int) -> [String] {
        let known = Set(concepts.map(\.id))
        var seen: Set<String> = []
        var result: [String] = []
        for raw in ids {
            let id = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            guard known.contains(id), !seen.contains(id) else { continue }
            seen.insert(id)
            result.append(id)
            if limit > 0, result.count >= limit { break }
        }
        return result
    }

    /// The "id — name" lines a prompt lists so the model can only pick from the taxonomy.
    static func promptList(_ concepts: [Concept]) -> String {
        concepts.map { "\($0.id) — \($0.name)" }.joined(separator: "\n")
    }
}

/// Text normalisation shared by the capture builders: two French strings are the
/// same phrase when they match ignoring case, surrounding whitespace and trailing
/// punctuation.
nonisolated enum PhraseKey {
    static func normalized(_ text: String) -> String {
        var s = text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        while let last = s.last, last.isPunctuation || last.isWhitespace { s.removeLast() }
        return s
    }

    static func same(_ a: String, _ b: String) -> Bool {
        normalized(a) == normalized(b)
    }
}

/// Recording caps: the duration selector is a hard limit, not decoration (E16).
nonisolated enum SpeakRecordingCap {
    /// Seconds a free-speech recording may run for the selected minutes. Unknown
    /// choices fall back to the default duration so the cap is never unbounded.
    static func seconds(forMinutes minutes: Int) -> Int {
        let allowed = Tuning.speakDurationChoicesMinutes
        let chosen = allowed.contains(minutes) ? minutes : Tuning.speakDefaultDurationMinutes
        return max(1, chosen) * 60
    }

    /// "1:30" style countdown text for the seconds left.
    static func countdown(secondsLeft: Int) -> String {
        let s = max(0, secondsLeft)
        return String(format: "%d:%02d", s / 60, s % 60)
    }
}
