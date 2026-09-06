//
//  MediaSupport.swift
//  FluentFrenchIOS
//
//  Pure helpers shared by the media surfaces (Listen, Watch): the learner-facing
//  failure vocabulary every media service resolves to (natural voice, video
//  feed, transcripts), the voice-source label the player shows, the per-turn
//  listening capture split (E8), the level-aware listening shelf, transcript
//  text cleanup, and a bounded-wait helper so no spinner runs unbounded (E26).
//  Foundation only — no views, no networking — so the Linux harness compiles
//  and tests it.
//

import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

// MARK: - Why a media service could not answer

/// The three reasons a media service (natural voice, video feed, transcript)
/// gives nothing back. Every network-backed call on the media surfaces resolves
/// to one of these; every surface renders its own copy for each. Nothing here
/// names a vendor or an internal tool.
nonisolated enum MediaServiceFailure: Error, Equatable, Sendable {
    /// The build has no key for the service: unavailable, not broken.
    case noKey
    /// No network path (or the request never reached the service).
    case offline
    /// The service answered with an error, timed out, or sent something unreadable.
    case serviceError

    /// Whether a retry can plausibly succeed (a missing key never resolves at runtime).
    var isRetryable: Bool { self != .noKey }

    /// The failure a thrown transport error stands for: connectivity errors are
    /// `.offline`, everything else (timeouts included) is the service's fault.
    static func classify(_ error: Error) -> MediaServiceFailure {
        if let urlError = error as? URLError {
            switch urlError.code {
            case .notConnectedToInternet, .networkConnectionLost, .cannotFindHost, .cannotConnectToHost,
                 .dnsLookupFailed, .internationalRoamingOff, .dataNotAllowed, .callIsActive:
                return .offline
            default:
                return .serviceError
            }
        }
        return .serviceError
    }

    /// The failure an HTTP status stands for (nil for a success status).
    static func classify(statusCode: Int) -> MediaServiceFailure? {
        (200..<300).contains(statusCode) ? nil : .serviceError
    }
}

// MARK: - Natural voice → built-in voice

/// Why the player is speaking with the device's built-in voice instead of a
/// natural one. Shown as a label so the fallback is never mistaken for the
/// natural voice (E26).
nonisolated enum SystemVoiceReason: Equatable, Sendable {
    case noKey
    case offline
    case serviceError
    /// The learner tapped "Skip the wait" while a clip was buffering.
    case skippedWait

    init(_ failure: MediaServiceFailure) {
        switch failure {
        case .noKey: self = .noKey
        case .offline: self = .offline
        case .serviceError: self = .serviceError
        }
    }

    /// One-line notice under the player.
    var notice: String {
        switch self {
        case .noKey: return "Natural voices aren't included in this build — using the built-in voice."
        case .offline: return "You're offline — using the built-in voice."
        case .serviceError: return "The voice service didn't answer — using the built-in voice."
        case .skippedWait: return "Using the built-in voice for this dialogue."
        }
    }
}

/// Which voice the player is currently using.
nonisolated enum VoiceSource: Equatable, Sendable {
    case natural
    case system(SystemVoiceReason)

    var isNatural: Bool { self == .natural }

    /// Short label for a pill next to the transport.
    var label: String {
        switch self {
        case .natural: return "Natural voice"
        case .system: return "Built-in voice"
        }
    }

    var notice: String? {
        if case .system(let reason) = self { return reason.notice }
        return nil
    }
}

// MARK: - Video feed and transcript copy

/// Learner-facing copy for the Watch feed when live videos cannot load.
nonisolated enum VideoFeedCopy {
    static func title(_ failure: MediaServiceFailure) -> String {
        switch failure {
        case .noKey: return "Live videos aren't available in this build"
        case .offline: return "You're offline"
        case .serviceError: return "Couldn't load videos"
        }
    }

    static func message(_ failure: MediaServiceFailure) -> String {
        switch failure {
        case .noKey: return "The video service isn't included here, so trending and search are off."
        case .offline: return "Reconnect to load trending French videos."
        case .serviceError: return "The video service didn't answer. Try again in a moment."
        }
    }

    /// Copy for a search that cannot run at all.
    static func searchTitle(_ failure: MediaServiceFailure) -> String {
        switch failure {
        case .noKey: return "Search isn't available in this build"
        case .offline: return "You're offline"
        case .serviceError: return "Search didn't work"
        }
    }

    static func searchMessage(_ failure: MediaServiceFailure) -> String {
        switch failure {
        case .noKey: return "Searching needs the video service, which isn't included here."
        case .offline: return "Reconnect and try your search again."
        case .serviceError: return "The video service didn't answer. Try again in a moment."
        }
    }

    /// Section subtitle when a category shows suggested (curated) videos.
    static let curatedLabel = "Suggested lessons — live trending isn't available"
    /// Section subtitle when live trending is unavailable and there is nothing curated to show either.
    static let unavailableLabel = "Live trending isn't available"
    /// Section body when a category has nothing at all to show.
    static let emptyCategory = "Nothing to show here right now."
}

/// Learner-facing copy for the transcript panel.
nonisolated enum TranscriptCopy {
    static func title(_ failure: MediaServiceFailure) -> String {
        switch failure {
        case .noKey: return "Transcripts aren't available in this build"
        case .offline: return "You're offline"
        case .serviceError: return "Transcript didn't load"
        }
    }

    static func message(_ failure: MediaServiceFailure) -> String {
        switch failure {
        case .noKey: return "Interactive subtitles need the transcript service, which isn't included here. You can still watch the video."
        case .offline: return "Reconnect to load the transcript. The video still plays."
        case .serviceError: return "The transcript service didn't answer. Give it another try — the video still plays."
        }
    }

    static let noCaptionsTitle = "No transcript for this video"
    static let noCaptionsMessage = "This video has no captions we can use. Try another one — most French videos work."

    /// Footnote under the transcript header for anything but a fully French
    /// transcript, so English captions are never mistaken for French (EM-2).
    /// nil when every line is French.
    static func coverageFootnote(_ coverage: TranscriptCoverage) -> String? {
        switch coverage {
        case .french:
            return nil
        case .translating(let done, let total):
            return "Translating into French… \(done) of \(total) lines so far."
        case .english(let stop):
            return "English captions — " + stopReason(stop)
        case .partlyEnglish(let englishLines, let stop):
            let lines = englishLines == 1 ? "1 line is" : "\(englishLines) lines are"
            return "\(lines) still in English — " + stopReason(stop)
        }
    }

    private static func stopReason(_ stop: TranscriptTranslationStop) -> String {
        switch stop {
        case .failed(.noKey): return "French translation isn't available in this build."
        case .failed(.offline): return "you're offline, so they couldn't be translated."
        case .failed(.serviceError): return "the translation service didn't answer."
        case .outOfTime: return "translation ran out of time."
        }
    }

    /// Header pill when every line can be looked up.
    static let tapHint = "Tap a word to save"
    /// Header pill while some lines are English: lookup is French-only.
    static let frenchOnlyTapHint = "Tap a word on French lines"
    /// Footnote action for a coverage that a retry could improve.
    static let retryTranslation = "Try again"
}

// MARK: - Results

/// The language a transcript line is in. English lines come from the last
/// stage of the waterfall (English captions) and are translated afterwards,
/// line by line; a line that could not be translated stays `.english` so the
/// panel can say so and word lookup can skip it (E26).
nonisolated enum TranscriptLanguage: Equatable, Sendable {
    case french
    case english
}

/// What a transcript fetch resolved to. `.noCaptions` is a real answer (the
/// service worked, the video has nothing), distinct from a failure. Lines come
/// back tagged with their language: `.english` means the captions still need
/// translating (see `TranscriptTranslation`), which happens OUTSIDE the fetch
/// budget so a long English transcript never turns into a false failure.
nonisolated enum TranscriptResult: Equatable, Sendable {
    case segments([TranscriptSegment], language: TranscriptLanguage)
    case noCaptions
    case unavailable(MediaServiceFailure)
}

/// One time-coded transcript line.
nonisolated struct TranscriptSegment: Identifiable, Hashable, Sendable {
    let id: String
    let text: String
    let start: Double
    let duration: Double
    var language: TranscriptLanguage = .french

    /// The same line with new French text.
    func translated(_ french: String) -> TranscriptSegment {
        TranscriptSegment(id: id, text: french, start: start, duration: duration, language: .french)
    }
}

/// Why an English → French translation pass stopped short of every line.
nonisolated enum TranscriptTranslationStop: Equatable, Sendable {
    /// The translation service could not be used (no key, offline, or it kept failing).
    case failed(MediaServiceFailure)
    /// The pass reached its time or batch budget.
    case outOfTime

    /// Whether trying again can plausibly translate more lines.
    var isRetryable: Bool {
        if case .failed(let f) = self { return f.isRetryable }
        return true
    }
}

/// How much of the transcript on screen is French. The panel renders a footnote
/// for every case but `.french`, so English captions are never passed off as a
/// French transcript (E26).
nonisolated enum TranscriptCoverage: Equatable, Sendable {
    /// Every line is French (native, provider-translated, or fully AI-translated).
    case french
    /// English captions are being translated; lines flip to French as batches land.
    case translating(done: Int, total: Int)
    /// Some lines are still English after the pass stopped.
    case partlyEnglish(englishLines: Int, stop: TranscriptTranslationStop)
    /// Nothing was translated: the transcript is English captions.
    case english(TranscriptTranslationStop)

    var isFrench: Bool { self == .french }

    var isTranslating: Bool {
        if case .translating = self { return true }
        return false
    }

    /// Whether a "try again" can plausibly translate more lines.
    var isRetryable: Bool {
        switch self {
        case .french, .translating: return false
        case .partlyEnglish(_, let stop), .english(let stop): return stop.isRetryable
        }
    }

    /// The coverage of `segments` at a moment: finished or not, and why it stopped.
    static func of(_ segments: [TranscriptSegment], finished: Bool, stop: TranscriptTranslationStop?) -> TranscriptCoverage {
        let english = segments.filter { $0.language == .english }.count
        if english == 0 { return .french }
        if !finished { return .translating(done: segments.count - english, total: segments.count) }
        let reason = stop ?? .outOfTime
        return english == segments.count ? .english(reason) : .partlyEnglish(englishLines: english, stop: reason)
    }
}

/// One snapshot of a translation pass: the lines as they stand and how far
/// along the pass is. The last snapshot of a pass is its final answer.
nonisolated struct TranscriptTranslationProgress: Equatable, Sendable {
    let segments: [TranscriptSegment]
    let coverage: TranscriptCoverage
}

// MARK: - English → French translation pass (EM-1 / EM-2)

/// Translates English caption lines into French in numbered batches through an
/// injected translator, streaming a snapshot after every batch so the panel can
/// show lines as they arrive. Pure orchestration: the caller supplies the
/// network call. The pass is bounded by a batch cap and a time budget, stops on
/// a failure that cannot resolve (no key, offline) or after repeated service
/// failures, and ALWAYS leaves untranslated lines in place tagged `.english` —
/// it never turns fetched captions into a failure.
nonisolated enum TranscriptTranslation {
    /// One numbered batch in → the service's numbered reply, or why it gave none.
    typealias Translator = @Sendable (String) async -> Result<String, MediaServiceFailure>

    /// Index ranges of the lines still in English, in order, `size` at a time.
    static func batches(of segments: [TranscriptSegment], size: Int) -> [[Int]] {
        let pending = segments.indices.filter { segments[$0].language == .english }
        let step = max(1, size)
        return stride(from: 0, to: pending.count, by: step).map { Array(pending[$0..<min($0 + step, pending.count)]) }
    }

    /// The prompt body for a batch: "[index] text" per line, indexes into `segments`.
    static func numbered(_ segments: [TranscriptSegment], indices: [Int]) -> String {
        indices.map { "[\($0)] \(segments[$0].text)" }.joined(separator: "\n")
    }

    /// Applies a numbered reply to the batch's lines only. Returns how many lines
    /// were translated; a reply in the wrong shape translates nothing.
    static func apply(reply: String, to segments: inout [TranscriptSegment], indices: [Int]) -> Int {
        let allowed = Set(indices)
        var count = 0
        for line in reply.split(separator: "\n") {
            guard let match = TranscriptText.parseNumberedLine(String(line)),
                  allowed.contains(match.index), match.index >= 0, match.index < segments.count,
                  segments[match.index].language == .english
            else { continue }
            segments[match.index] = segments[match.index].translated(match.text)
            count += 1
        }
        return count
    }

    /// Runs the pass as a stream. Snapshots arrive after every batch; the stream
    /// finishes with the final snapshot. Cancelling the consumer stops the pass.
    static func stream(
        _ segments: [TranscriptSegment],
        batchSize: Int,
        maxBatches: Int,
        budget: TimeInterval,
        maxConsecutiveFailures: Int,
        translator: @escaping Translator,
        now: @escaping @Sendable () -> Date = { Date() }
    ) -> AsyncStream<TranscriptTranslationProgress> {
        AsyncStream { continuation in
            let task = Task {
                let final = await run(
                    segments, batchSize: batchSize, maxBatches: maxBatches, budget: budget,
                    maxConsecutiveFailures: maxConsecutiveFailures, translator: translator, now: now
                ) { continuation.yield($0) }
                continuation.yield(final)
                continuation.finish()
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    /// The pass as a plain async function: `progress` is called after every
    /// batch that changed something; the return value is the final snapshot.
    /// `now` is the clock the budget is measured with (injectable for tests).
    static func run(
        _ segments: [TranscriptSegment],
        batchSize: Int,
        maxBatches: Int,
        budget: TimeInterval,
        maxConsecutiveFailures: Int,
        translator: Translator,
        now: @Sendable () -> Date = { Date() },
        progress: @Sendable (TranscriptTranslationProgress) -> Void = { _ in }
    ) async -> TranscriptTranslationProgress {
        var lines = segments
        let started = now()
        var consecutiveFailures = 0
        var lastFailure: MediaServiceFailure? = nil
        var stop: TranscriptTranslationStop? = nil
        let all = self.batches(of: lines, size: batchSize)
        let batches = Array(all.prefix(max(0, maxBatches)))
        let capped = batches.count < all.count
        let failureCap = max(1, maxConsecutiveFailures)

        for indices in batches {
            if Task.isCancelled || now().timeIntervalSince(started) >= budget { stop = .outOfTime; break }
            switch await translator(numbered(lines, indices: indices)) {
            case .success(let reply):
                let translated = apply(reply: reply, to: &lines, indices: indices)
                if translated > 0 {
                    consecutiveFailures = 0
                    progress(TranscriptTranslationProgress(segments: lines, coverage: .of(lines, finished: false, stop: nil)))
                } else {
                    // An answer in the wrong shape is a service failure, not silence.
                    consecutiveFailures += 1
                    lastFailure = .serviceError
                    if consecutiveFailures >= failureCap { stop = .failed(.serviceError) }
                }
            case .failure(let failure):
                consecutiveFailures += 1
                lastFailure = failure
                // A missing key never resolves and offline will not within the pass;
                // a service error gets a second chance before the pass gives up.
                if !failure.isRetryable || failure == .offline || consecutiveFailures >= failureCap {
                    stop = .failed(failure)
                }
            }
            if stop != nil { break }
        }
        if stop == nil {
            // Every batch was attempted: lines still English are down to the cap
            // or to a batch the service failed on.
            if capped { stop = .outOfTime } else if let lastFailure { stop = .failed(lastFailure) }
        }
        return TranscriptTranslationProgress(segments: lines, coverage: .of(lines, finished: true, stop: stop))
    }
}

/// What a trending-feed request resolved to: live videos, or the curated list
/// with the reason live results are missing (so the section can say so).
nonisolated enum VideoFeedResult: Equatable, Sendable {
    case live([YTVideo])
    case curated([YTVideo], reason: MediaServiceFailure)

    var videos: [YTVideo] {
        switch self {
        case .live(let v): return v
        case .curated(let v, _): return v
        }
    }

    var failure: MediaServiceFailure? {
        if case .curated(_, let reason) = self { return reason }
        return nil
    }
}

/// What a search resolved to. There is no curated substitute for a search: an
/// empty list means the service answered with nothing.
nonisolated enum VideoSearchResult: Equatable, Sendable {
    case results([YTVideo])
    case unavailable(MediaServiceFailure)
}

/// What a natural-voice fetch resolved to.
nonisolated enum NaturalVoiceFetch: Equatable, Sendable {
    case audio(Data)
    case unavailable(MediaServiceFailure)
}

// MARK: - Bounded wait

/// Runs an async operation with a deadline: the operation's value, or nil when
/// the deadline passed first (the operation is cancelled). Every media spinner
/// waits through this so none runs unbounded (E26).
nonisolated enum Deadline {
    static func run<T: Sendable>(seconds: TimeInterval, operation: @escaping @Sendable () async -> T) async -> T? {
        let clamped = max(0.05, seconds)
        return await withTaskGroup(of: T?.self) { group in
            group.addTask { await operation() }
            group.addTask {
                try? await Task.sleep(nanoseconds: UInt64(clamped * 1_000_000_000))
                return nil
            }
            let first = await group.next() ?? nil
            group.cancelAll()
            return first
        }
    }
}

// MARK: - Listening capture (E8)

/// One dialogue line the learner is about to save: the turn's own French and
/// its own English, never a joined passage.
nonisolated struct ListeningCaptureSpec: Hashable, Identifiable {
    let turnIndex: Int
    let speaker: String
    let french: String
    let english: String
    var id: Int { turnIndex }
}

nonisolated enum ListeningCapture {
    /// The lines a hold-to-capture gesture selected, one per turn, in dialogue
    /// order. The range is normalised (either end may come first) and clamped to
    /// the dialogue; turns with no French are skipped, and a line repeated inside
    /// the selection appears once.
    static func specs(for item: ListeningItem, from start: Int, to end: Int) -> [ListeningCaptureSpec] {
        guard !item.turns.isEmpty else { return [] }
        let lo = max(0, min(start, end))
        let hi = min(item.turns.count - 1, max(start, end))
        guard lo <= hi else { return [] }
        var seen: Set<String> = []
        var result: [ListeningCaptureSpec] = []
        for index in lo...hi {
            let turn = item.turns[index]
            let french = turn.french.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !french.isEmpty else { continue }
            let key = french.lowercased()
            guard seen.insert(key).inserted else { continue }
            result.append(ListeningCaptureSpec(
                turnIndex: index,
                speaker: turn.speaker,
                french: french,
                english: turn.english.trimmingCharacters(in: .whitespacesAndNewlines)
            ))
        }
        return result
    }

    /// The explanation stored on a captured line, naming the dialogue it came from.
    static func explanation(for item: ListeningItem) -> String {
        "Line from “\(item.title)” (\(item.titleEnglish))."
    }
}

// MARK: - Level-aware listening shelf

/// How a dialogue's band sits against the learner's level.
nonisolated enum ListeningFit: String, CaseIterable {
    case atLevel = "Your level"
    case easy = "Easy"
    case stretch = "Stretch"
}

nonisolated enum ListeningShelf {
    /// The band a learner at `level` is best served by.
    static func recommendedDifficulty(for level: CEFRLevel) -> ListeningDifficulty {
        ListeningDifficulty.allCases.first { $0.cefrLevels.contains(level) } ?? .beginner
    }

    static func fit(_ difficulty: ListeningDifficulty, learnerLevel: CEFRLevel) -> ListeningFit {
        let recommended = recommendedDifficulty(for: learnerLevel)
        if difficulty == recommended { return .atLevel }
        let bands = ListeningDifficulty.allCases
        let mine = bands.firstIndex(of: recommended) ?? 0
        let theirs = bands.firstIndex(of: difficulty) ?? 0
        return theirs < mine ? .easy : .stretch
    }

    /// Dialogues ordered for the learner: their band first, then easier ones to
    /// consolidate, then stretch material. Order within a group is preserved.
    static func ordered(_ items: [ListeningItem], learnerLevel: CEFRLevel) -> [ListeningItem] {
        let rank: [ListeningFit: Int] = [.atLevel: 0, .easy: 1, .stretch: 2]
        return items.enumerated().sorted { a, b in
            let ra = rank[fit(a.element.difficulty, learnerLevel: learnerLevel)] ?? 0
            let rb = rank[fit(b.element.difficulty, learnerLevel: learnerLevel)] ?? 0
            if ra != rb { return ra < rb }
            return a.offset < b.offset
        }.map(\.element)
    }
}

// MARK: - Transcript text helpers

nonisolated enum TranscriptText {
    /// Strips tags and the common HTML entities caption feeds carry.
    static func cleanHTML(_ raw: String) -> String {
        var text = raw.replacingOccurrences(of: "<[^>]*>", with: "", options: .regularExpression)
        let entities: [(String, String)] = [
            ("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", "\""),
            ("&#39;", "'"), ("&#x27;", "'"), ("&#x2F;", "/"), ("&apos;", "'"), ("&nbsp;", " "),
        ]
        for (entity, replacement) in entities {
            text = text.replacingOccurrences(of: entity, with: replacement)
        }
        text = text.replacingOccurrences(of: "\n", with: " ")
        return text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Parses "[12] Some text" → (12, "Some text"); nil for anything else.
    static func parseNumberedLine(_ line: String) -> (index: Int, text: String)? {
        guard let open = line.firstIndex(of: "["), let close = line.firstIndex(of: "]"), open < close else { return nil }
        let numStr = line[line.index(after: open)..<close]
        guard let idx = Int(numStr) else { return nil }
        let text = line[line.index(after: close)...].trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return nil }
        return (idx, text)
    }

    /// The transcript line playing at `time`: the last segment that has started.
    static func activeIndex(in segments: [TranscriptSegment], at time: Double) -> Int {
        var newIndex = -1
        for i in stride(from: segments.count - 1, through: 0, by: -1) where time >= segments[i].start {
            newIndex = i
            break
        }
        return newIndex
    }
}
