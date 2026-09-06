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

/// What a finished dictation should do to the reply box. Speaking must never
/// destroy words the learner already typed (talkmedia-3-3): an empty box takes
/// the transcription and sends it, a box with a reply in it gets the
/// transcription appended and waits for the learner to press send.
nonisolated enum DictationMerge: Equatable {
    /// The box was empty: this text is the reply, send it.
    case send(String)
    /// The box already had a reply: this is the merged text, left on screen.
    case appended(String)
    /// Nothing usable was heard — the box is untouched.
    case nothing

    /// Learner-facing note for the merged case (nil for the others).
    var notice: String? {
        if case .appended = self {
            return "Added what you said to the end of your reply. Check it, then send."
        }
        return nil
    }

    static func apply(heard: String, toDraft draft: String) -> DictationMerge {
        let spoken = heard.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !spoken.isEmpty else { return .nothing }
        let typed = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !typed.isEmpty else { return .send(spoken) }
        return .appended(typed + " " + spoken)
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

/// What a correction (spoken, written or from a tutor turn) may leave on a deck
/// card. A card is a word or a short phrase — `CaptureBuilder.isAcceptableHeadword`,
/// the same rule the reader enforces and the save button explains — so a
/// correction of a whole spoken answer is reduced to the part it actually
/// changed, and nothing is saved when even that will not fit. Without this a
/// five-minute monologue became one card no lesson could ever ask about
/// (talkmedia-4-1).
nonisolated enum CorrectionCard {
    /// What one correction leaves behind.
    struct Result: Equatable {
        /// The phrases worth saving, in the order they appear in the correction.
        var phrases: [String] = []
        /// True when `phrases` are pieces of the correction rather than the whole
        /// corrected line. The meaning the model wrote describes the WHOLE line,
        /// so a shortened card must never carry it — it waits for its own lookup.
        var shortened = false

        var isEmpty: Bool { phrases.isEmpty }
    }

    /// Characters trimmed from the ends of a phrase cut out of a sentence.
    private static let edgeMarks = CharacterSet(charactersIn: " \t\n.,;:!?…\"'“”‘’«»()")

    /// The card-sized phrases of `corrected`. The whole line when it is already a
    /// card; otherwise each sentence the correction rewrote — or, when a rewritten
    /// sentence is itself longer than a card, just the words it changed — capped
    /// at `limit`.
    static func from(original: String, corrected: String,
                     limit: Int = Tuning.maxCorrectionCards) -> Result {
        let fixed = corrected.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !fixed.isEmpty else { return Result() }
        if CaptureBuilder.isAcceptableHeadword(fixed) { return Result(phrases: [fixed]) }

        let learnerSentences = SentenceExtractor.sentences(in: original)
        var phrases: [String] = []
        var seen: Set<String> = []
        for sentence in SentenceExtractor.sentences(in: fixed) {
            guard phrases.count < max(0, limit) else { break }
            let source = nearest(sentence, in: learnerSentences)
            guard !PhraseKey.same(sentence, source) else { continue }   // the learner had this one right
            let candidate = CaptureBuilder.isAcceptableHeadword(sentence)
                ? sentence
                : changedPhrase(from: source, to: sentence)
            guard let phrase = candidate, CaptureBuilder.isAcceptableHeadword(phrase) else { continue }
            let key = PhraseKey.normalized(phrase)
            guard !key.isEmpty, !seen.contains(key) else { continue }
            seen.insert(key)
            phrases.append(phrase)
        }
        return Result(phrases: phrases, shortened: !phrases.isEmpty)
    }

    /// The learner sentence a corrected sentence rewrites: the one sharing the
    /// most words with it ("" when the learner said nothing comparable).
    private static func nearest(_ sentence: String, in candidates: [String]) -> String {
        let target = Set(SentenceExtractor.tokens(in: sentence))
        guard !target.isEmpty else { return "" }
        var best = ""
        var bestScore = 0
        for candidate in candidates {
            let score = Set(SentenceExtractor.tokens(in: candidate)).intersection(target).count
            if score > bestScore { bestScore = score; best = candidate }
        }
        return best
    }

    /// The words `corrected` added or changed, widened to
    /// `Tuning.correctionCardContextWords` words of context so a one-word fix is
    /// still a phrase. nil when the correction only deleted words (the remaining
    /// text is the learner's own) or when the change is itself too long for a card.
    static func changedPhrase(from original: String, to corrected: String) -> String? {
        let old = words(original), new = words(corrected)
        guard !new.isEmpty else { return nil }
        var lower = 0
        while lower < min(old.count, new.count),
              SentenceExtractor.fold(old[lower]) == SentenceExtractor.fold(new[lower]) { lower += 1 }
        var suffix = 0
        while suffix < min(old.count, new.count) - lower,
              SentenceExtractor.fold(old[old.count - 1 - suffix]) == SentenceExtractor.fold(new[new.count - 1 - suffix]) {
            suffix += 1
        }
        var upper = new.count - suffix
        guard lower < upper else { return nil }   // nothing added: only words removed
        guard upper - lower <= Tuning.maxCaptureWords else { return nil }
        // Widen alternately for context, never past the sentence or the card cap.
        let target = min(Tuning.correctionCardContextWords, Tuning.maxCaptureWords)
        while upper - lower < target, lower > 0 || upper < new.count {
            if lower > 0 { lower -= 1 }
            if upper - lower >= target { break }
            if upper < new.count { upper += 1 }
        }
        let phrase = new[lower..<upper].joined(separator: " ")
            .trimmingCharacters(in: edgeMarks)
        return phrase.isEmpty ? nil : phrase
    }

    private static func words(_ text: String) -> [String] {
        text.split(whereSeparator: { $0.isWhitespace || $0.isNewline }).map(String.init)
    }
}

/// A recording something else took the microphone from (a call, Siri, the app
/// leaving the foreground). The learner is always told, so feedback on the
/// fragment that was captured is never presented as feedback on their whole
/// answer (talkmedia-4-3).
nonisolated enum InterruptedRecording {
    /// Whether what was captured before the interruption is worth transcribing.
    static func isWorthTranscribing(secondsCaptured: Int) -> Bool {
        secondsCaptured >= Tuning.minimumUsableRecordingSeconds
    }

    /// What the learner is told, naming how much was actually captured.
    static func notice(secondsCaptured: Int) -> String {
        let captured = SpeakRecordingCap.countdown(secondsLeft: max(0, secondsCaptured))
        guard isWorthTranscribing(secondsCaptured: secondsCaptured) else {
            return "Something interrupted the recording before anything was captured. Tap to record again."
        }
        return "Something interrupted the recording, so only the first \(captured) was captured — the feedback covers that much. Tap to record again."
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
