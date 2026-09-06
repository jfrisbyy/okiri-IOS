//
//  PlaybackState.swift
//  FluentFrenchIOS
//
//  The dialogue player's state machine, separated from AVFoundation so it can
//  be tested on its own (E17). It owns the line index, the playing / buffering
//  / finished flags and a monotonic token that identifies the fetch in flight:
//  pausing, jumping, stopping or replaying bumps the token, so a clip that
//  arrives late is ignored and `isBuffering` can never be left on.
//

import Foundation

nonisolated struct PlaybackState: Equatable {
    private(set) var turnCount = 0
    private(set) var currentIndex = 0
    private(set) var isPlaying = false
    private(set) var isBuffering = false
    private(set) var didFinish = false
    /// Identifies the turn currently being started; anything fetched under an
    /// older token is stale.
    private(set) var token = 0

    /// What the player should do once a line has finished speaking.
    nonisolated enum TurnAdvance: Equatable {
        case speakNext
        case finished
        case ignore
    }

    var hasTurns: Bool { turnCount > 0 }

    var progress: Double {
        guard turnCount > 0 else { return 0 }
        return Double(currentIndex) / Double(turnCount)
    }

    /// A new dialogue: everything reset, nothing in flight.
    mutating func load(turnCount: Int) {
        stop()
        self.turnCount = max(0, turnCount)
        currentIndex = 0
        didFinish = false
    }

    /// Start (or resume). Returns true when a line should start speaking; the
    /// caller decides whether a paused clip can simply resume instead.
    mutating func play() -> Bool {
        guard hasTurns else { return false }
        didFinish = false
        isPlaying = true
        return true
    }

    /// Pause. Any clip still buffering is dropped (the spinner clears) and its
    /// result will be ignored when it lands.
    mutating func pause() {
        isPlaying = false
        if isBuffering {
            isBuffering = false
            token += 1
        }
    }

    mutating func stop() {
        isPlaying = false
        isBuffering = false
        token += 1
    }

    /// Move to a line. Returns true when the player was playing (so the new line
    /// should start speaking). Clears buffering either way.
    mutating func jump(to index: Int) -> Bool {
        let wasPlaying = isPlaying
        token += 1
        isBuffering = false
        currentIndex = turnCount == 0 ? 0 : min(max(0, index), turnCount - 1)
        didFinish = false
        return wasPlaying
    }

    /// Start the current line again from the top. Returns true when a line exists.
    mutating func replay() -> Bool {
        guard hasTurns else { return false }
        token += 1
        isBuffering = false
        didFinish = false
        isPlaying = true
        return true
    }

    /// A line is about to be spoken with the built-in voice (no fetch): bumps the
    /// token so any stale clip is ignored, and clears buffering.
    mutating func beginTurn() -> Int {
        token += 1
        isBuffering = false
        return token
    }

    /// A natural clip is being fetched for the current line. Returns the token the
    /// fetch must present when it lands.
    mutating func beginFetch() -> Int {
        token += 1
        isBuffering = true
        return token
    }

    /// A fetch landed. Returns true when it is still the current one AND the
    /// player is still playing — the only case in which its audio should play.
    /// Buffering clears whenever the token matches, even if playback stopped.
    mutating func finishFetch(token fetched: Int) -> Bool {
        guard fetched == token else { return false }
        isBuffering = false
        return isPlaying
    }

    /// "Skip the wait": drop the clip in flight. Returns true when the player is
    /// still playing (so the caller speaks the line with the built-in voice now).
    mutating func skipBuffering() -> Bool {
        guard isBuffering else { return false }
        token += 1
        isBuffering = false
        return isPlaying
    }

    /// The current line finished speaking.
    mutating func turnFinished() -> TurnAdvance {
        guard isPlaying else { return .ignore }
        if currentIndex < turnCount - 1 {
            currentIndex += 1
            return .speakNext
        }
        isPlaying = false
        isBuffering = false
        didFinish = true
        return .finished
    }
}
