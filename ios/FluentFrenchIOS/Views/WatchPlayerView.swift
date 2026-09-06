//
//  WatchPlayerView.swift
//  FluentFrenchIOS
//
//  Custom in-app YouTube viewer with a live, interactive French transcript.
//  In portrait the video plays at the top with native transport controls and a
//  scrolling transcript below. A fullscreen button rotates into a cinematic
//  landscape canvas where the current transcript line floats as a subtitle over
//  the footage and the app's own auto-hiding controls drive playback. Both modes
//  share one underlying player, so position, speed, and saved words carry over.
//
//  The transcript panel has four explicit states (E26): loading (bounded by
//  `Tuning.transcriptTotalTimeout`), lines, "no captions", or the reason it
//  could not load (no key / offline / service error) with a retry when one
//  could help. Lines carry their coverage: English captions are shown at once
//  and translated in place, with a footnote for anything not fully French and
//  word lookup limited to French lines (EM-1 / EM-2). Word captures go through
//  the store's capture factory (E7).
//

import Foundation
import SwiftUI
import UIKit

struct WatchPlayerView: View {
    let video: YTVideo

    @Environment(\.dismiss) private var dismiss
    @Environment(AppStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// The timestamp column holds text, so it widens with the learner's text size.
    @ScaledMetric(relativeTo: .caption) private var timeColumnWidth: CGFloat = 42

    @State private var controller: YouTubePlayerController
    @State private var transcript: TranscriptState = .loading
    @State private var activeIndex = -1
    @State private var savedWords: Set<String> = []
    @State private var selectedWord: SelectedWord? = nil
    @State private var speedIndex = 1
    @State private var userScrolling = false
    @State private var showFollowPill = false
    @State private var scrollResumeWork: DispatchWorkItem? = nil
    @State private var isFullscreen = false
    @State private var attempt = 0
    /// Bumped by the coverage footnote's "Try again": translates the lines still
    /// in English without refetching the transcript (talkmedia-2-3).
    @State private var translationAttempt = 0
    /// The `translationAttempt` a pass has already run for. `.task(id:)` re-runs
    /// on every re-appearance, not just on id changes, so without this marker
    /// leaving the player and coming back would re-translate settled lines.
    @State private var translationRunFor = 0

    private let speeds: [Double] = [0.75, 1.0, 1.25]

    init(video: YTVideo) {
        self.video = video
        _controller = State(initialValue: YouTubePlayerController(videoId: video.videoId))
    }

    struct SelectedWord: Identifiable {
        let id = UUID()
        let word: String
        let context: String
    }

    /// The transcript panel's explicit states.
    enum TranscriptState: Equatable {
        case loading
        case loaded([TranscriptSegment], coverage: TranscriptCoverage, origin: TranscriptOrigin)
        case noCaptions
        case unavailable(MediaServiceFailure)

        var segments: [TranscriptSegment] {
            if case .loaded(let s, _, _) = self { return s }
            return []
        }

        var coverage: TranscriptCoverage {
            if case .loaded(_, let c, _) = self { return c }
            return .french
        }

        /// Where the French on screen came from — kept on the state so the
        /// provenance note stays after the translation pass finishes.
        var origin: TranscriptOrigin {
            if case .loaded(_, _, let o) = self { return o }
            return .nativeFrench
        }
    }

    private var segments: [TranscriptSegment] { transcript.segments }

    private var activeSegment: TranscriptSegment? {
        guard activeIndex >= 0, activeIndex < segments.count else { return nil }
        return segments[activeIndex]
    }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            videoArea
            transcriptArea
        }
        .background(Color(hex: "0E0805"))
        .ignoresSafeArea(edges: .bottom)
        .task(id: attempt) { await loadTranscript() }
        .task(id: translationAttempt) { await translateRemainingLines() }
        // A word or example spoken from the capture sheet lives on the shared
        // natural voice, not on the video player, so leaving Watch has to
        // silence it explicitly (talkmedia-3-4).
        .onDisappear { NaturalVoice.shared.stop() }
        .onChange(of: controller.currentTime) { _, newValue in
            updateActiveIndex(for: newValue)
        }
        .fullScreenCover(isPresented: $isFullscreen) {
            FullscreenPlayerView(
                controller: controller,
                title: video.title,
                activeSegment: activeSegment,
                savedWords: savedWords,
                speedIndex: $speedIndex,
                speeds: speeds,
                onSaved: { outcome in noteSaved(outcome) },
                onExit: { exitFullscreen() }
            )
            .environment(store)
        }
        .sheet(item: $selectedWord) { sel in
            WordCaptureSheet(
                word: sel.word,
                context: sel.context,
                accent: Theme.primary,
                onSaved: { outcome in noteSaved(outcome) }
            )
            .environment(store)
            .presentationDetents([.medium, .large])
        }
    }

    // MARK: - Top bar

    private var topBar: some View {
        HStack(spacing: 12) {
            Button { Haptics.tap(); dismiss() } label: {
                Image(systemName: "chevron.left").font(.callout.weight(.semibold)).foregroundStyle(.white)
                    .frame(width: 44, height: 44).background(.white.opacity(0.12), in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            VStack(alignment: .leading, spacing: 1) {
                Text(video.title).font(.subheadline.weight(.semibold)).foregroundStyle(.white).lineLimit(2)
                Text(video.channel).font(.caption2).foregroundStyle(.white.opacity(0.7)).lineLimit(1)
            }
            Spacer()
        }
        .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 10)
    }

    // MARK: - Video + controls

    private var videoArea: some View {
        VStack(spacing: 0) {
            ZStack(alignment: .bottom) {
                YouTubeEmbedView(controller: controller, attachmentToken: isFullscreen)
                    .aspectRatio(16.0 / 9.0, contentMode: .fit)
                    .frame(maxWidth: .infinity)
                    .background(Color.black)
                    .accessibilityElement()
                    .accessibilityLabel("Video: \(video.title)")
                if let seg = activeSegment {
                    FloatingSubtitle(
                        text: seg.text,
                        savedWords: savedWords,
                        fontSize: 15,
                        lookupEnabled: seg.allowsWordLookup,
                        onWordTap: { word in openWord(word, context: seg.text) }
                    )
                    .padding(.horizontal, 12)
                    .padding(.bottom, 10)
                    .transition(.opacity)
                }
            }
            .overlay(alignment: .topTrailing) {
                Button { enterFullscreen() } label: {
                    Image(systemName: "arrow.up.left.and.arrow.down.right")
                        .font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                        .frame(width: 44, height: 44).background(.black.opacity(0.45), in: Circle())
                }
                .buttonStyle(.plain)
                .padding(6)
                .accessibilityLabel("Enter fullscreen")
            }
            .reducedMotionAnimation(.easeInOut(duration: 0.2), value: activeIndex)
            transportControls
        }
    }

    private var transportControls: some View {
        VStack(spacing: 12) {
            PlayerScrubber(controller: controller, tint: Theme.primary)
            HStack {
                Text(timeLabel(controller.currentTime)).font(.caption2.weight(.semibold).monospacedDigit()).foregroundStyle(.white.opacity(0.55))
                Spacer()
                Text(timeLabel(controller.duration)).font(.caption2.weight(.semibold).monospacedDigit()).foregroundStyle(.white.opacity(0.7))
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("\(timeLabel(controller.currentTime)) of \(timeLabel(controller.duration))")
            PlayerButtons(controller: controller, speedIndex: $speedIndex, speeds: speeds, tint: Theme.primary, playSize: 58)
                .padding(.top, 2)
        }
        .padding(.horizontal, 18).padding(.top, 14).padding(.bottom, 16)
        .background(
            LinearGradient(colors: [Color(hex: "160C07"), Color(hex: "0E0805")], startPoint: .top, endPoint: .bottom)
        )
        .overlay(alignment: .top) {
            Rectangle().fill(.white.opacity(0.05)).frame(height: 0.5)
        }
    }

    // MARK: - Transcript

    private var transcriptArea: some View {
        ZStack(alignment: .bottom) {
            Group {
                switch transcript {
                case .loading:
                    transcriptLoading
                case .loaded(let lines, _, _):
                    if lines.isEmpty {
                        transcriptNotice(title: TranscriptCopy.noCaptionsTitle, message: TranscriptCopy.noCaptionsMessage,
                                         icon: "captions.bubble", retry: nil)
                    } else {
                        transcriptList
                    }
                case .noCaptions:
                    transcriptNotice(title: TranscriptCopy.noCaptionsTitle, message: TranscriptCopy.noCaptionsMessage,
                                     icon: "captions.bubble", retry: nil)
                case .unavailable(let failure):
                    transcriptNotice(title: TranscriptCopy.title(failure), message: TranscriptCopy.message(failure),
                                     icon: icon(for: failure), retry: failure.isRetryable ? retryTranscript : nil)
                }
            }
            if showFollowPill {
                Button { followAlong() } label: {
                    Label("Follow along", systemImage: "arrow.down.to.line")
                        .font(.footnote.weight(.semibold)).foregroundStyle(.white)
                        .padding(.horizontal, 16).frame(minHeight: 44)
                        .background(Theme.primary).clipShape(.capsule)
                        .shadow(color: .black.opacity(0.3), radius: 8, y: 3)
                }
                .buttonStyle(.plain)
                .padding(.bottom, 20)
                .transition(reduceMotion
                            ? AnyTransition.opacity
                            : AnyTransition.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var transcriptList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 6) {
                    transcriptHeader
                    ForEach(Array(segments.enumerated()), id: \.element.id) { idx, seg in
                        segmentRow(seg, index: idx)
                            .id(idx)
                    }
                }
                .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 60)
            }
            .scrollIndicators(.hidden)
            .simultaneousGesture(
                DragGesture().onChanged { _ in beginUserScroll() }
            )
            .onChange(of: activeIndex) { _, newIndex in
                guard !userScrolling, newIndex >= 0 else { return }
                withAnimation(Theme.motion(.easeInOut(duration: 0.35), reduceMotion: reduceMotion)) {
                    proxy.scrollTo(newIndex, anchor: .center)
                }
            }
            .onChange(of: showFollowPill) { _, show in
                if !show, activeIndex >= 0 {
                    withAnimation(Theme.motion(.easeInOut(duration: 0.35), reduceMotion: reduceMotion)) { proxy.scrollTo(activeIndex, anchor: .center) }
                }
            }
        }
    }

    private var transcriptHeader: some View {
        let coverage = transcript.coverage
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 9) {
                Image(systemName: "text.alignleft").font(.footnote.weight(.semibold)).foregroundStyle(Theme.primary).accessibilityHidden(true)
                Text("Transcript").scaledSerifDisplay(19, weight: .semibold).foregroundStyle(.white)
                Spacer()
                HStack(spacing: 4) {
                    Image(systemName: "hand.tap.fill").font(.caption2).accessibilityHidden(true)
                    Text(coverage.isFrench ? TranscriptCopy.tapHint : TranscriptCopy.frenchOnlyTapHint).font(.caption2.weight(.medium))
                }
                .foregroundStyle(.white.opacity(0.7))
                .padding(.horizontal, 9).padding(.vertical, 5)
                .background(.white.opacity(0.05), in: .capsule)
            }
            if let footnote = TranscriptCopy.coverageFootnote(coverage) {
                coverageFootnote(footnote, coverage: coverage)
            }
            if let provenance = TranscriptCopy.originFootnote(transcript.origin) {
                originFootnote(provenance)
            }
        }
        .padding(.bottom, 6)
    }

    /// The transcript is not (yet) fully French: say so, and offer a retry only
    /// when one could translate more lines (EM-2).
    private func coverageFootnote(_ text: String, coverage: TranscriptCoverage) -> some View {
        HStack(alignment: .top, spacing: 8) {
            if coverage.isTranslating {
                ProgressView().controlSize(.small).tint(Theme.primary).accessibilityHidden(true)
            } else {
                Image(systemName: "character.bubble").font(.caption).foregroundStyle(Theme.primary).accessibilityHidden(true)
            }
            Text(text).font(.caption).foregroundStyle(.white.opacity(0.7))
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            if coverage.isRetryable {
                Button { retryTranslation() } label: {
                    Text(TranscriptCopy.retryTranslation).font(.caption.weight(.semibold)).foregroundStyle(Theme.primary)
                        .padding(.horizontal, 8).frame(minWidth: 44, minHeight: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Try translating again")
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(.white.opacity(0.05), in: .rect(cornerRadius: 10))
    }

    /// Where the French came from, for anything but the video's own French
    /// captions. Stays on screen for the whole session — a machine translation
    /// of English speech must never read as the French spoken in the video
    /// (talkmedia-3-2).
    private func originFootnote(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "info.circle").font(.caption).foregroundStyle(.white.opacity(0.6)).accessibilityHidden(true)
            Text(text).font(.caption).foregroundStyle(.white.opacity(0.7))
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(.white.opacity(0.05), in: .rect(cornerRadius: 10))
        .accessibilityElement(children: .combine)
    }

    private func segmentRow(_ seg: TranscriptSegment, index: Int) -> some View {
        let isActive = index == activeIndex
        return HStack(alignment: .top, spacing: 10) {
            VStack(spacing: 4) {
                Text(timeLabel(seg.start))
                    .font(.caption2.weight(.semibold).monospacedDigit())
                    .foregroundStyle(isActive ? Theme.primary : .white.opacity(0.7))
                if isActive {
                    Image(systemName: "speaker.wave.2.fill").font(.caption2).foregroundStyle(Theme.primary)
                        .accessibilityHidden(true)
                }
            }
            .frame(width: timeColumnWidth, alignment: .leading)
            .padding(.top, 1)

            FlowWords(
                text: seg.text,
                isActive: isActive,
                savedWords: savedWords,
                lookupEnabled: seg.allowsWordLookup,
                onWordTap: { word in openWord(word, context: seg.text) }
            )
        }
        .padding(.vertical, 10).padding(.horizontal, 12)
        .background(isActive ? Theme.primary.opacity(0.12) : Color.clear)
        .overlay(alignment: .leading) {
            if isActive {
                Capsule().fill(Theme.primary).frame(width: 3).padding(.vertical, 6)
            }
        }
        .clipShape(.rect(cornerRadius: 12))
        .contentShape(Rectangle())
        .onTapGesture { jumpTo(seg, index: index) }
        .reducedMotionAnimation(.easeInOut(duration: 0.25), value: isActive)
        .accessibilityHint("Plays from \(timeLabel(seg.start))")
        .accessibilityAction(named: Text("Play from here")) { jumpTo(seg, index: index) }
    }

    private var transcriptLoading: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "text.bubble.fill").font(.footnote).foregroundStyle(Theme.primary.opacity(0.7)).accessibilityHidden(true)
                Text("Loading the transcript…")
                    .font(.footnote.weight(.medium)).foregroundStyle(.white.opacity(0.55))
                Spacer()
            }
            .padding(.bottom, 2)
            ForEach(0..<7, id: \.self) { i in
                HStack(alignment: .top, spacing: 12) {
                    SkeletonBlock(width: 34, height: 11, cornerRadius: 4, dark: true)
                        .padding(.top, 3)
                    VStack(alignment: .leading, spacing: 7) {
                        SkeletonBlock(height: 12, cornerRadius: 6, dark: true)
                        SkeletonBlock(width: lineWidth(for: i), height: 12, cornerRadius: 6, dark: true)
                    }
                }
            }
            .accessibilityHidden(true)
            Spacer()
        }
        .padding(.horizontal, 18).padding(.top, 16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func lineWidth(for index: Int) -> CGFloat {
        let fractions: [CGFloat] = [0.62, 0.78, 0.5, 0.7, 0.45, 0.66, 0.55]
        return 240 * fractions[index % fractions.count]
    }

    /// One explicit, learner-facing transcript state: what happened, what to do,
    /// and a retry only when a retry could help.
    private func transcriptNotice(title: String, message: String, icon: String, retry: (() -> Void)?) -> some View {
        VStack(spacing: 16) {
            ZStack {
                Circle().fill(Theme.primary.opacity(0.12)).frame(width: 74, height: 74)
                Image(systemName: icon).font(.title.weight(.medium)).foregroundStyle(Theme.primary.opacity(0.8))
            }
            .accessibilityHidden(true)
            VStack(spacing: 6) {
                Text(title).scaledSerifDisplay(19, weight: .semibold).foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                Text(message)
                    .font(.footnote).foregroundStyle(.white.opacity(0.75))
                    .multilineTextAlignment(.center).lineSpacing(2).padding(.horizontal, 44)
            }
            if let retry {
                Button {
                    Haptics.tap()
                    retry()
                } label: {
                    Label("Try again", systemImage: "arrow.clockwise")
                        .font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                        .padding(.horizontal, 24).frame(minHeight: 44)
                        .background(Theme.primary, in: .capsule)
                        .shadow(color: Theme.primary.opacity(0.35), radius: 10, y: 4)
                }
                .buttonStyle(.plain)
                .padding(.top, 4)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func icon(for failure: MediaServiceFailure) -> String {
        switch failure {
        case .noKey: return "key.slash"
        case .offline: return "wifi.slash"
        case .serviceError: return "exclamationmark.triangle"
        }
    }

    // MARK: - Fullscreen

    private func enterFullscreen() {
        Haptics.select()
        OrientationLock.lockLandscape()
        withAnimation(Theme.motion(.default, reduceMotion: reduceMotion)) { isFullscreen = true }
    }

    private func exitFullscreen() {
        Haptics.tap()
        OrientationLock.lockPortrait()
        withAnimation(Theme.motion(.default, reduceMotion: reduceMotion)) { isFullscreen = false }
    }

    // MARK: - Logic

    /// The caption fetch is bounded by `Tuning.transcriptTotalTimeout` inside the
    /// service. English captions are shown as soon as they arrive and translated
    /// in place under their own budget (`Tuning.transcriptTranslationTimeout`);
    /// leaving the screen cancels the `.task`, which stops the pass. A retry is
    /// a new `attempt`, which re-runs the `.task`.
    private func loadTranscript() async {
        transcript = .loading
        activeIndex = -1
        let result = await TranscriptService.fetch(videoId: video.videoId)
        switch result {
        case .segments(let lines, let language, let origin):
            guard !lines.isEmpty else { transcript = .noCaptions; return }
            switch language {
            case .french:
                transcript = .loaded(lines, coverage: .french, origin: origin)
            case .english:
                transcript = .loaded(lines, coverage: .translating(done: 0, total: lines.count), origin: origin)
                updateActiveIndex(for: controller.currentTime)
                for await progress in TranscriptService.translateToFrench(lines) {
                    guard !Task.isCancelled else { return }
                    transcript = .loaded(progress.segments, coverage: progress.coverage, origin: origin)
                }
            }
        case .noCaptions: transcript = .noCaptions
        case .unavailable(let failure): transcript = .unavailable(failure)
        }
        updateActiveIndex(for: controller.currentTime)
    }

    /// The "couldn't load" notice: nothing was fetched, so fetch it all again.
    private func retryTranscript() {
        attempt += 1
    }

    /// The coverage footnote's "Try again": the captions are already here and
    /// some lines are already French, so only the lines still in English are
    /// translated. Refetching would throw the transcript (and the learner's
    /// place in it) away to redo work that succeeded (talkmedia-2-3).
    private func retryTranslation() {
        translationAttempt += 1
    }

    private func translateRemainingLines() async {
        guard translationAttempt > 0, translationAttempt != translationRunFor else { return }
        translationRunFor = translationAttempt
        let lines = segments
        guard lines.contains(where: { $0.language == .english }) else { return }
        let origin = transcript.origin
        transcript = .loaded(lines, coverage: .of(lines, finished: false, stop: nil), origin: origin)
        for await progress in TranscriptService.translateToFrench(lines) {
            guard !Task.isCancelled else { return }
            transcript = .loaded(progress.segments, coverage: progress.coverage, origin: origin)
        }
    }

    private func updateActiveIndex(for time: Double) {
        guard !segments.isEmpty else { return }
        let newIndex = TranscriptText.activeIndex(in: segments, at: time)
        if newIndex != activeIndex { activeIndex = newIndex }
    }

    private func jumpTo(_ seg: TranscriptSegment, index: Int) {
        Haptics.tap()
        controller.seek(to: seg.start)
        if !controller.isPlaying { controller.play() }
        activeIndex = index
        cancelFollowPill()
    }

    private func openWord(_ raw: String, context: String) {
        let clean = raw.trimmingCharacters(in: CharacterSet(charactersIn: ".,;:!?\"'()«»…-"))
            .trimmingCharacters(in: .whitespaces)
        guard clean.count >= 2 else { return }
        if controller.isPlaying { controller.pause() }
        Haptics.select()
        selectedWord = SelectedWord(word: clean, context: context)
    }

    /// The store did the saving (factory + dedupe); the view only remembers the
    /// headword so the transcript can highlight it.
    private func noteSaved(_ outcome: CaptureOutcome) {
        switch outcome {
        case .saved(let gap), .duplicate(let gap):
            savedWords.insert(gap.frenchWord.lowercased())
        case .rejected:
            break
        }
    }

    // MARK: - Follow-along

    private func beginUserScroll() {
        userScrolling = true
        if !showFollowPill { withAnimation(Theme.motion(.default, reduceMotion: reduceMotion)) { showFollowPill = true } }
        scrollResumeWork?.cancel()
        let reduce = reduceMotion
        let work = DispatchWorkItem {
            userScrolling = false
            withAnimation(Theme.motion(.default, reduceMotion: reduce)) { showFollowPill = false }
        }
        scrollResumeWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 5, execute: work)
    }

    private func followAlong() {
        Haptics.tap()
        cancelFollowPill()
    }

    private func cancelFollowPill() {
        scrollResumeWork?.cancel()
        userScrolling = false
        withAnimation(Theme.motion(.default, reduceMotion: reduceMotion)) { showFollowPill = false }
    }

    // MARK: - Helpers

    private func timeLabel(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds >= 0 else { return "0:00" }
        let total = Int(seconds)
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}

// MARK: - Fullscreen cinema view

/// Edge-to-edge landscape canvas. The same player fills the frame; the current
/// transcript line floats as a subtitle; the app's own controls auto-hide.
private struct FullscreenPlayerView: View {
    let controller: YouTubePlayerController
    let title: String
    let activeSegmentValue: TranscriptSegment?
    let savedWords: Set<String>
    @Binding var speedIndex: Int
    let speeds: [Double]
    let onSaved: (CaptureOutcome) -> Void
    let onExit: () -> Void

    @Environment(AppStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var controlsVisible = true
    @State private var hideWork: DispatchWorkItem? = nil
    @State private var selectedWord: WatchPlayerView.SelectedWord? = nil

    init(
        controller: YouTubePlayerController,
        title: String,
        activeSegment: TranscriptSegment?,
        savedWords: Set<String>,
        speedIndex: Binding<Int>,
        speeds: [Double],
        onSaved: @escaping (CaptureOutcome) -> Void,
        onExit: @escaping () -> Void
    ) {
        self.controller = controller
        self.title = title
        self.activeSegmentValue = activeSegment
        self.savedWords = savedWords
        self._speedIndex = speedIndex
        self.speeds = speeds
        self.onSaved = onSaved
        self.onExit = onExit
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            YouTubeEmbedView(controller: controller, attachmentToken: "fullscreen")
                .aspectRatio(16.0 / 9.0, contentMode: .fit)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .ignoresSafeArea()
                .accessibilityElement()
                .accessibilityLabel("Video: \(title)")

            // Tap layer to toggle controls — kept BELOW the subtitle so word
            // taps reach the subtitle; empty regions still toggle controls.
            Color.clear
                .contentShape(Rectangle())
                .onTapGesture { toggleControls() }
                .accessibilityLabel(controlsVisible ? "Hide controls" : "Show controls")
                .accessibilityAddTraits(.isButton)

            // Subtitle sits above the tap layer so its words stay interactive.
            VStack {
                Spacer()
                if let seg = activeSegmentValue {
                    FloatingSubtitle(
                        text: seg.text,
                        savedWords: savedWords,
                        fontSize: 20,
                        lookupEnabled: seg.allowsWordLookup,
                        onWordTap: { word in openWord(word, context: seg.text) }
                    )
                    .padding(.horizontal, 40)
                    .padding(.bottom, controlsVisible ? 86 : 28)
                    .reducedMotionAnimation(.easeInOut(duration: 0.25), value: controlsVisible)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            if controlsVisible {
                controlsOverlay
                    .transition(.opacity)
            } else {
                // Slim progress line pinned to the bottom when controls hidden
                VStack {
                    Spacer()
                    GeometryReader { geo in
                        let ratio = controller.duration > 0 ? controller.currentTime / controller.duration : 0
                        ZStack(alignment: .leading) {
                            Rectangle().fill(Color.white.opacity(0.18)).frame(height: 3)
                            Rectangle().fill(Theme.primary).frame(width: geo.size.width * min(1, max(0, ratio)), height: 3)
                        }
                    }
                    .frame(height: 3)
                }
                .ignoresSafeArea()
                .allowsHitTesting(false)
                .accessibilityHidden(true)
                .transition(.opacity)
            }
        }
        .statusBarHidden(true)
        .onAppear { scheduleHide() }
        .onDisappear { hideWork?.cancel() }
        .sheet(item: $selectedWord) { sel in
            WordCaptureSheet(
                word: sel.word,
                context: sel.context,
                accent: Theme.primary,
                onSaved: onSaved
            )
            .presentationDetents([.medium, .large])
            .environment(store)
        }
    }

    private func openWord(_ raw: String, context: String) {
        let clean = raw.trimmingCharacters(in: CharacterSet(charactersIn: ".,;:!?\"'()«»…-"))
            .trimmingCharacters(in: .whitespaces)
        guard clean.count >= 2 else { return }
        if controller.isPlaying { controller.pause() }
        Haptics.select()
        selectedWord = WatchPlayerView.SelectedWord(word: clean, context: context)
    }

    private var controlsOverlay: some View {
        VStack(spacing: 0) {
            // Top bar
            HStack(spacing: 12) {
                Button { onExit() } label: {
                    Image(systemName: "arrow.down.right.and.arrow.up.left")
                        .font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                        .frame(width: 44, height: 44).background(.black.opacity(0.45), in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Exit fullscreen")
                Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(.white).lineLimit(1)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
            }
            .padding(.horizontal, 28).padding(.top, 14)

            Spacer()

            // Bottom controls
            VStack(spacing: 12) {
                PlayerScrubber(controller: controller, tint: Theme.primary)
                HStack {
                    Text(timeLabel(controller.currentTime)).font(.caption.weight(.medium).monospacedDigit()).foregroundStyle(.white.opacity(0.7))
                    Spacer()
                    Text(timeLabel(controller.duration)).font(.caption.weight(.medium).monospacedDigit()).foregroundStyle(.white.opacity(0.7))
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("\(timeLabel(controller.currentTime)) of \(timeLabel(controller.duration))")
                PlayerButtons(controller: controller, speedIndex: $speedIndex, speeds: speeds, tint: Theme.primary, playSize: 56)
            }
            .padding(.horizontal, 40).padding(.bottom, 18)
            .background(
                LinearGradient(colors: [.clear, .black.opacity(0.65)], startPoint: .top, endPoint: .bottom)
                    .allowsHitTesting(false)
            )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onTapGesture { scheduleHide() }
    }

    private func toggleControls() {
        withAnimation(Theme.motion(.easeInOut(duration: 0.25), reduceMotion: reduceMotion)) { controlsVisible.toggle() }
        if controlsVisible { scheduleHide() }
    }

    private func scheduleHide() {
        hideWork?.cancel()
        let reduce = reduceMotion
        let work = DispatchWorkItem {
            withAnimation(Theme.motion(.easeInOut(duration: 0.3), reduceMotion: reduce)) { controlsVisible = false }
        }
        hideWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.5, execute: work)
    }

    private func timeLabel(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds >= 0 else { return "0:00" }
        let total = Int(seconds)
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}

// MARK: - Orientation control

enum OrientationLock {
    static func lockLandscape() { request(.landscapeRight) }
    static func lockPortrait() { request(.portrait) }

    private static func request(_ orientation: UIInterfaceOrientationMask) {
        guard let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }) else { return }
        let prefs = UIWindowScene.GeometryPreferences.iOS(interfaceOrientations: orientation)
        scene.requestGeometryUpdate(prefs) { _ in }
        scene.keyWindow?.rootViewController?.setNeedsUpdateOfSupportedInterfaceOrientations()
    }
}

// MARK: - Shared native controls

/// Draggable progress bar that scrubs the shared player.
private struct PlayerScrubber: View {
    let controller: YouTubePlayerController
    let tint: Color

    var body: some View {
        GeometryReader { geo in
            let ratio = controller.duration > 0 ? controller.currentTime / controller.duration : 0
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.16)).frame(height: 4)
                Capsule().fill(tint).frame(width: geo.size.width * min(1, max(0, ratio)), height: 4)
                Circle().fill(.white).frame(width: 11, height: 11)
                    .overlay(Circle().stroke(tint.opacity(0.5), lineWidth: 1))
                    .offset(x: geo.size.width * min(1, max(0, ratio)) - 5.5)
                    .shadow(color: .black.opacity(0.35), radius: 2.5, y: 1)
            }
            .frame(height: 14)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        guard controller.duration > 0 else { return }
                        let r = max(0, min(1, value.location.x / geo.size.width))
                        controller.currentTime = r * controller.duration
                    }
                    .onEnded { value in
                        guard controller.duration > 0 else { return }
                        let r = max(0, min(1, value.location.x / geo.size.width))
                        controller.seek(to: r * controller.duration)
                        Haptics.tap()
                    }
            )
        }
        .frame(height: 14)
        .accessibilityElement()
        .accessibilityLabel("Playback position")
        .accessibilityValue("\(Int(controller.duration > 0 ? controller.currentTime / controller.duration * 100 : 0)) percent")
        .accessibilityAdjustableAction { direction in
            let step = Tuning.watchSeekStepSeconds
            switch direction {
            case .increment: controller.seek(to: controller.currentTime + step)
            case .decrement: controller.seek(to: max(0, controller.currentTime - step))
            @unknown default: break
            }
        }
    }
}

/// Skip-back / play-pause / skip-forward row with a playback-speed pill.
private struct PlayerButtons: View {
    let controller: YouTubePlayerController
    @Binding var speedIndex: Int
    let speeds: [Double]
    let tint: Color
    var playSize: CGFloat = 60
    /// The play circle is chrome around a glyph that scales with Dynamic Type,
    /// so the circle grows with it and the glyph never spills out.
    @ScaledMetric(relativeTo: .title2) private var controlScale: CGFloat = 1

    private var scaledPlaySize: CGFloat { playSize * controlScale }
    private var step: Double { Tuning.watchSeekStepSeconds }
    private var stepLabel: String { "\(Int(step)) seconds" }

    var body: some View {
        HStack(spacing: 0) {
            Button { Haptics.tap(); controller.seek(to: max(0, controller.currentTime - step)) } label: {
                Image(systemName: "gobackward.\(Int(step))").font(.title2).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).frame(minHeight: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back \(stepLabel)")
            Button { Haptics.select(); controller.togglePlay() } label: {
                Image(systemName: controller.isPlaying ? "pause.fill" : "play.fill")
                    .scaledFont(playSize * 0.4).foregroundStyle(.white)
                    .frame(width: scaledPlaySize, height: scaledPlaySize).background(tint).clipShape(.circle)
            }
            .buttonStyle(.plain)
            .frame(maxWidth: .infinity)
            .accessibilityLabel(controller.isPlaying ? "Pause" : "Play")
            Button { Haptics.tap(); controller.seek(to: controller.currentTime + step) } label: {
                Image(systemName: "goforward.\(Int(step))").font(.title2).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).frame(minHeight: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Forward \(stepLabel)")
        }
        .overlay(alignment: .trailing) {
            Button { cycleSpeed() } label: {
                Text(speedLabel).font(.footnote.weight(.bold)).foregroundStyle(.white)
                    .minimumScaleFactor(0.7)
                    .frame(width: 46, height: 30).background(.white.opacity(0.12)).clipShape(.capsule)
                    .frame(minWidth: 44, minHeight: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Playback speed \(speedLabel)")
            .accessibilityHint("Cycles to the next speed")
        }
    }

    private func cycleSpeed() {
        Haptics.tap()
        speedIndex = (speedIndex + 1) % speeds.count
        controller.setRate(speeds[speedIndex])
    }

    private var speedLabel: String {
        let s = speeds[speedIndex]
        return s == 1.0 ? "1x" : (s == 0.75 ? "¾x" : "1¼x")
    }
}

// MARK: - Floating subtitle

/// A soft-scrim subtitle whose individual words remain tappable for lookup
/// (French lines only — an English line is shown but not looked up).
private struct FloatingSubtitle: View {
    let text: String
    let savedWords: Set<String>
    var fontSize: CGFloat = 18
    var lookupEnabled: Bool = true
    let onWordTap: (String) -> Void

    var body: some View {
        FlowWords(
            text: text,
            isActive: true,
            savedWords: savedWords,
            fontSize: fontSize,
            baseColor: .white.opacity(0.95),
            activeColor: .white,
            alignment: .center,
            lookupEnabled: lookupEnabled,
            onWordTap: onWordTap
        )
        .shadow(color: .black.opacity(0.85), radius: 6, y: 1)
        .padding(.horizontal, 18).padding(.vertical, 11)
        .background(
            Capsule(style: .continuous)
                .fill(.ultraThinMaterial)
                .environment(\.colorScheme, .dark)
                .opacity(0.92)
        )
        .overlay(Capsule(style: .continuous).stroke(.white.opacity(0.1), lineWidth: 0.5))
        .frame(maxWidth: 660)
    }
}

// MARK: - Flowing tappable words

/// Lays out a transcript line as individually tappable words that wrap onto
/// multiple lines. Active line is brighter; saved words get an accent pill.
/// With `lookupEnabled` false (an English line) the words are plain text: no
/// tap, no button trait, so an English word never opens a French lookup.
private struct FlowWords: View {
    let text: String
    let isActive: Bool
    let savedWords: Set<String>
    var fontSize: CGFloat = 16
    var baseColor: Color = .white.opacity(0.72)
    var activeColor: Color = .white
    var alignment: HorizontalAlignment = .leading
    var lookupEnabled: Bool = true
    let onWordTap: (String) -> Void

    private var tokens: [String] {
        text.split(separator: " ").map(String.init)
    }

    var body: some View {
        FlowLayout(spacing: 4, lineSpacing: 6) {
            ForEach(Array(tokens.enumerated()), id: \.offset) { _, token in
                let bare = token.trimmingCharacters(in: CharacterSet(charactersIn: ".,;:!?\"'()«»…-")).lowercased()
                let saved = lookupEnabled && !bare.isEmpty && savedWords.contains(bare)
                Text(token)
                    .scaledFont(fontSize, weight: isActive ? .semibold : .regular)
                    .foregroundStyle(saved ? Theme.primary : (isActive ? activeColor : baseColor))
                    .padding(.horizontal, saved ? 5 : 0).padding(.vertical, saved ? 1 : 0)
                    .background(saved ? Theme.primary.opacity(0.16) : Color.clear, in: RoundedRectangle(cornerRadius: 5))
                    .contentShape(Rectangle())
                    .onTapGesture { if lookupEnabled { onWordTap(token) } }
                    .accessibilityAddTraits(lookupEnabled ? .isButton : [])
                    .accessibilityHint(lookupEnabled ? (saved ? "Saved to your deck" : "Look up this word") : "")
            }
        }
        .frame(maxWidth: .infinity, alignment: alignment == .center ? .center : .leading)
    }
}

// MARK: - Word capture sheet

/// A word tapped in the transcript: its gloss (loading is bounded, failures are
/// explicit) and the shared Save-to-deck button, which asks the store to build
/// and dedupe the gap (E7 / E26). Related words push further cards.
private struct WordCaptureSheet: View {
    let word: String
    let context: String
    let accent: Color
    let onSaved: (CaptureOutcome) -> Void

    @Environment(AppStore.self) private var store
    @State private var lookup: LookupState = .loading
    @State private var attempt = 0
    @State private var path: [WordRoute] = []

    private var alreadySaved: Bool { store.hasGap(forWord: word) }

    private var draft: CaptureDraft? {
        switch lookup {
        case .loading:
            return nil
        case .loaded(let g):
            return CaptureDraft(gloss: g, sourceType: .listening, sourceTab: "watch", contextSentence: context)
        case .failed:
            return CaptureDraft(untranslated: word, sourceType: .listening, sourceTab: "watch", contextSentence: context)
        }
    }

    var body: some View {
        NavigationStack(path: $path) {
            rootCard
                .navigationDestination(for: WordRoute.self) { route in
                    TranslationCardView(
                        route: route,
                        accent: accent,
                        sourceType: .listening,
                        sourceTab: "watch",
                        onPush: { path.append($0) }
                    )
                }
        }
    }

    private var rootCard: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack(alignment: .center, spacing: 12) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(word).scaledSerifDisplay(26, weight: .bold).foregroundStyle(Theme.text)
                        if case .loaded(let g) = lookup {
                            if !g.pronunciation.isEmpty { PhoneticLine(text: g.pronunciation) }
                            Text(g.translation).font(.subheadline.weight(.medium)).foregroundStyle(accent)
                        }
                    }
                    Spacer()
                    HStack(spacing: 8) {
                        Button { Haptics.tap(); NaturalVoice.shared.speak(word, rate: 0.6) } label: {
                            Image(systemName: "tortoise.fill").font(.subheadline).foregroundStyle(accent)
                                .frame(width: 44, height: 44).background(accent.opacity(0.10)).clipShape(.circle)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Listen slowly")
                        Button { Haptics.tap(); NaturalVoice.shared.speak(word) } label: {
                            Image(systemName: "speaker.wave.2.fill").font(.title3).foregroundStyle(accent)
                                .frame(width: 46, height: 46).background(accent.opacity(0.12)).clipShape(.circle)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Listen")
                    }
                }

                if !context.isEmpty {
                    Text(context).font(.footnote).foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityLabel("In the transcript: \(context)")
                }

                switch lookup {
                case .loading:
                    LookupLoadingView(accent: accent)
                case .loaded(let g):
                    GlossRichDetail(gloss: g, accent: accent, onTermTap: { path.append(WordRoute(term: $0, context: "")) })
                    if !g.example.isEmpty { exampleBlock(g) }
                case .failed(let failure):
                    LookupUnavailableView(failure: failure, accent: accent, onRetry: { attempt += 1 })
                }

                SaveToDeckButton(draft: draft, accent: accent, alreadySaved: alreadySaved, isBusy: lookup == .loading,
                                 onSaved: onSaved)
            }
            .padding(.horizontal, 22).padding(.top, 22).padding(.bottom, 28)
        }
        .background(Theme.background)
        .toolbar(.hidden, for: .navigationBar)
        // Closing the sheet silences whatever it was speaking (talkmedia-3-4).
        .onDisappear { NaturalVoice.shared.stop() }
        .task(id: attempt) {
            lookup = .loading
            let result = await TranslationService.lookup(term: word, context: context)
            lookup = LookupState(result)
            // The service is reachable: resolve captures saved offline while here (EM-4).
            if result.gloss != nil {
                await store.resolvePendingTranslations(using: TranslationService.lookup(term:context:))
            }
        }
    }

    private func exampleBlock(_ g: WordGloss) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Text("Example").font(.caption2.weight(.bold)).foregroundStyle(Theme.textSecondary)
                Button { Haptics.tap(); NaturalVoice.shared.speak(g.example) } label: {
                    Image(systemName: "speaker.wave.2").font(.footnote).foregroundStyle(accent)
                        .frame(minWidth: 44, minHeight: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Listen to the example")
                Button { Haptics.tap(); NaturalVoice.shared.speak(g.example, rate: 0.6) } label: {
                    Image(systemName: "tortoise.fill").font(.caption).foregroundStyle(accent.opacity(0.8))
                        .frame(minWidth: 44, minHeight: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Listen to the example slowly")
            }
            Text(g.example).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
                .fixedSize(horizontal: false, vertical: true)
            if !g.exampleTranslation.isEmpty {
                Text(g.exampleTranslation).font(.footnote).foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(accent.opacity(0.07)).clipShape(.rect(cornerRadius: Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(accent.opacity(0.18), lineWidth: 1))
    }
}
