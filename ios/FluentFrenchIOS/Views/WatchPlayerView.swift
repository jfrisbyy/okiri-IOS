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

import SwiftUI
import UIKit

struct WatchPlayerView: View {
    let video: YTVideo
    /// false = "French Content" (native French), true = "Learn with Subtitles".
    let learnMode: Bool

    @Environment(\.dismiss) private var dismiss
    @Environment(AppStore.self) private var store

    @State private var controller: YouTubePlayerController
    @State private var segments: [TranscriptSegment] = []
    @State private var isLoadingTranscript = true
    @State private var loadFailed = false
    @State private var activeIndex = -1
    @State private var savedWords: Set<String> = []
    @State private var selectedWord: SelectedWord? = nil
    @State private var speedIndex = 1
    @State private var userScrolling = false
    @State private var showFollowPill = false
    @State private var scrollResumeWork: DispatchWorkItem? = nil
    @State private var isFullscreen = false

    private let speeds: [Double] = [0.75, 1.0, 1.25]

    init(video: YTVideo, learnMode: Bool) {
        self.video = video
        self.learnMode = learnMode
        _controller = State(initialValue: YouTubePlayerController(videoId: video.videoId))
    }

    struct SelectedWord: Identifiable {
        let id = UUID()
        let word: String
        let context: String
    }

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
        .task { await loadTranscript() }
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
                onSaveGap: { gloss, context in saveGap(gloss, context: context) },
                onExit: { exitFullscreen() }
            )
            .environment(store)
        }
        .sheet(item: $selectedWord) { sel in
            WordCaptureSheet(
                word: sel.word,
                context: sel.context,
                accent: Theme.primary,
                isSaved: savedWords.contains(sel.word.lowercased()),
                onSave: { gloss in saveGap(gloss, context: sel.context) }
            )
            .presentationDetents([.medium, .large])
        }
    }

    // MARK: - Top bar

    private var topBar: some View {
        HStack(spacing: 12) {
            Button { Haptics.tap(); dismiss() } label: {
                Image(systemName: "chevron.left").font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                    .frame(width: 38, height: 38).background(.white.opacity(0.12), in: Circle())
            }
            .buttonStyle(.plain)
            VStack(alignment: .leading, spacing: 1) {
                Text(video.title).font(.system(size: 14, weight: .semibold)).foregroundStyle(.white).lineLimit(1)
                Text(video.channel).font(.system(size: 11)).foregroundStyle(.white.opacity(0.55)).lineLimit(1)
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
                if let seg = activeSegment {
                    FloatingSubtitle(
                        text: seg.text,
                        savedWords: savedWords,
                        fontSize: 15,
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
                        .font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                        .frame(width: 34, height: 34).background(.black.opacity(0.45), in: Circle())
                }
                .buttonStyle(.plain)
                .padding(10)
            }
            .animation(.easeInOut(duration: 0.2), value: activeIndex)
            transportControls
        }
    }

    private var transportControls: some View {
        VStack(spacing: 12) {
            PlayerScrubber(controller: controller, tint: Theme.primary)
            HStack {
                Text(timeLabel(controller.currentTime)).font(.system(size: 11, weight: .semibold, design: .monospaced)).foregroundStyle(.white.opacity(0.55))
                Spacer()
                Text(timeLabel(controller.duration)).font(.system(size: 11, weight: .semibold, design: .monospaced)).foregroundStyle(.white.opacity(0.45))
            }
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
                if isLoadingTranscript {
                    transcriptLoading
                } else if segments.isEmpty {
                    transcriptEmpty
                } else {
                    transcriptList
                }
            }
            if showFollowPill {
                Button { followAlong() } label: {
                    Label("Follow along", systemImage: "arrow.down.to.line")
                        .font(.system(size: 13, weight: .semibold)).foregroundStyle(.white)
                        .padding(.horizontal, 16).padding(.vertical, 10)
                        .background(Theme.primary).clipShape(.capsule)
                        .shadow(color: .black.opacity(0.3), radius: 8, y: 3)
                }
                .buttonStyle(.plain)
                .padding(.bottom, 20)
                .transition(.move(edge: .bottom).combined(with: .opacity))
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
                withAnimation(.easeInOut(duration: 0.35)) {
                    proxy.scrollTo(newIndex, anchor: .center)
                }
            }
            .onChange(of: showFollowPill) { _, show in
                if !show, activeIndex >= 0 {
                    withAnimation(.easeInOut(duration: 0.35)) { proxy.scrollTo(activeIndex, anchor: .center) }
                }
            }
        }
    }

    private var transcriptHeader: some View {
        HStack(spacing: 9) {
            Image(systemName: "text.alignleft").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.primary)
            Text("Transcript").font(.serifDisplay(19, weight: .semibold)).foregroundStyle(.white)
            Spacer()
            HStack(spacing: 4) {
                Image(systemName: "hand.tap.fill").font(.system(size: 9))
                Text("Tap a word to save").font(.system(size: 11, weight: .medium))
            }
            .foregroundStyle(.white.opacity(0.38))
            .padding(.horizontal, 9).padding(.vertical, 5)
            .background(.white.opacity(0.05), in: .capsule)
        }
        .padding(.bottom, 6)
    }

    private func segmentRow(_ seg: TranscriptSegment, index: Int) -> some View {
        let isActive = index == activeIndex
        return HStack(alignment: .top, spacing: 10) {
            VStack(spacing: 4) {
                Text(timeLabel(seg.start))
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(isActive ? Theme.primary : .white.opacity(0.4))
                if isActive {
                    Image(systemName: "speaker.wave.2.fill").font(.system(size: 11)).foregroundStyle(Theme.primary)
                }
            }
            .frame(width: 42, alignment: .leading)
            .padding(.top, 1)

            FlowWords(
                text: seg.text,
                isActive: isActive,
                savedWords: savedWords,
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
        .animation(.easeInOut(duration: 0.25), value: isActive)
    }

    private var transcriptLoading: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "text.bubble.fill").font(.system(size: 13)).foregroundStyle(Theme.primary.opacity(0.7))
                Text(learnMode ? "Preparing French subtitles…" : "Fetching transcript…")
                    .font(.system(size: 13, weight: .medium)).foregroundStyle(.white.opacity(0.55))
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
            Spacer()
        }
        .padding(.horizontal, 18).padding(.top, 16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func lineWidth(for index: Int) -> CGFloat {
        let fractions: [CGFloat] = [0.62, 0.78, 0.5, 0.7, 0.45, 0.66, 0.55]
        return 240 * fractions[index % fractions.count]
    }

    private var transcriptEmpty: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle().fill(Theme.primary.opacity(0.12)).frame(width: 74, height: 74)
                Image(systemName: "captions.bubble").font(.system(size: 30, weight: .medium)).foregroundStyle(Theme.primary.opacity(0.8))
            }
            VStack(spacing: 6) {
                Text("Transcript didn't load").font(.serifDisplay(19, weight: .semibold)).foregroundStyle(.white)
                Text("This can happen if captions are slow to respond. Give it another try — most French videos work great.")
                    .font(.system(size: 13)).foregroundStyle(.white.opacity(0.5))
                    .multilineTextAlignment(.center).lineSpacing(2).padding(.horizontal, 44)
            }
            Button {
                Haptics.tap()
                Task { await loadTranscript() }
            } label: {
                Label("Try again", systemImage: "arrow.clockwise")
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                    .padding(.horizontal, 24).padding(.vertical, 12)
                    .background(Theme.primary, in: .capsule)
                    .shadow(color: Theme.primary.opacity(0.35), radius: 10, y: 4)
            }
            .buttonStyle(.plain)
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Fullscreen

    private func enterFullscreen() {
        Haptics.select()
        OrientationLock.lockLandscape()
        withAnimation { isFullscreen = true }
    }

    private func exitFullscreen() {
        Haptics.tap()
        OrientationLock.lockPortrait()
        withAnimation { isFullscreen = false }
    }

    // MARK: - Logic

    private func loadTranscript() async {
        isLoadingTranscript = true
        loadFailed = false
        let result = await TranscriptService.fetch(videoId: video.videoId, nativeFrench: !learnMode)
        segments = result
        isLoadingTranscript = false
        loadFailed = result.isEmpty
    }

    private func updateActiveIndex(for time: Double) {
        guard !segments.isEmpty else { return }
        var newIndex = -1
        for i in stride(from: segments.count - 1, through: 0, by: -1) {
            if time >= segments[i].start { newIndex = i; break }
        }
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

    private func saveGap(_ gloss: WordGloss, context: String) {
        let now = Date()
        let gap = GapItem(
            id: UUID().uuidString,
            frenchWord: gloss.term,
            englishTranslation: gloss.translation,
            explanation: gloss.explanation,
            exampleSentence: gloss.example.isEmpty ? context : gloss.example,
            exampleTranslation: gloss.exampleTranslation,
            pronunciation: nil,
            sourceType: .listening,
            category: .vocabulary,
            difficulty: .okay,
            reviewCount: 0,
            consecutiveCorrect: 0,
            lastReviewedAt: nil,
            nextReviewAt: now,
            masteredAt: nil,
            createdAt: now,
            cefrLevel: .A2,
            easeFactor: 2.5,
            currentInterval: 0,
            irtDifficulty: 0,
            fsrs: nil,
            originalContext: OriginalContext(sentence: context, translation: nil, sourceTab: "watch", capturedAt: now, reExposureCount: 0),
            confusionLinks: [],
            partOfSpeech: gloss.partOfSpeech.isEmpty ? nil : gloss.partOfSpeech,
            gender: gloss.gender.isEmpty ? nil : gloss.gender,
            article: gloss.article.isEmpty ? nil : gloss.article,
            baseForm: gloss.baseForm.isEmpty ? nil : gloss.baseForm,
            register: gloss.register.isEmpty ? nil : gloss.register,
            relatedWords: gloss.relatedWords.isEmpty ? nil : gloss.relatedWords
        )
        let pron = gloss.pronunciation.isEmpty ? nil : gloss.pronunciation
        var saved = gap
        saved.pronunciation = pron
        store.addGap(saved)
        savedWords.insert(gloss.term.lowercased())
        Haptics.success()
    }

    // MARK: - Follow-along

    private func beginUserScroll() {
        userScrolling = true
        if !showFollowPill { withAnimation { showFollowPill = true } }
        scrollResumeWork?.cancel()
        let work = DispatchWorkItem {
            userScrolling = false
            withAnimation { showFollowPill = false }
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
        withAnimation { showFollowPill = false }
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
    let onSaveGap: (WordGloss, String) -> Void
    let onExit: () -> Void

    @Environment(AppStore.self) private var store
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
        onSaveGap: @escaping (WordGloss, String) -> Void,
        onExit: @escaping () -> Void
    ) {
        self.controller = controller
        self.title = title
        self.activeSegmentValue = activeSegment
        self.savedWords = savedWords
        self._speedIndex = speedIndex
        self.speeds = speeds
        self.onSaveGap = onSaveGap
        self.onExit = onExit
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            YouTubeEmbedView(controller: controller, attachmentToken: "fullscreen")
                .aspectRatio(16.0 / 9.0, contentMode: .fit)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .ignoresSafeArea()

            // Tap layer to toggle controls — kept BELOW the subtitle so word
            // taps reach the subtitle; empty regions still toggle controls.
            Color.clear
                .contentShape(Rectangle())
                .onTapGesture { toggleControls() }

            // Subtitle sits above the tap layer so its words stay interactive.
            VStack {
                Spacer()
                if let seg = activeSegmentValue {
                    FloatingSubtitle(
                        text: seg.text,
                        savedWords: savedWords,
                        fontSize: 20,
                        onWordTap: { word in openWord(word, context: seg.text) }
                    )
                    .padding(.horizontal, 40)
                    .padding(.bottom, controlsVisible ? 86 : 28)
                    .animation(.easeInOut(duration: 0.25), value: controlsVisible)
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
                isSaved: savedWords.contains(sel.word.lowercased()),
                onSave: { gloss in onSaveGap(gloss, sel.context) }
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
                        .font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                        .frame(width: 40, height: 40).background(.black.opacity(0.45), in: Circle())
                }
                .buttonStyle(.plain)
                Text(title).font(.system(size: 15, weight: .semibold)).foregroundStyle(.white).lineLimit(1)
                Spacer()
            }
            .padding(.horizontal, 28).padding(.top, 14)

            Spacer()

            // Bottom controls
            VStack(spacing: 12) {
                PlayerScrubber(controller: controller, tint: Theme.primary)
                HStack {
                    Text(timeLabel(controller.currentTime)).font(.system(size: 12, weight: .medium)).foregroundStyle(.white.opacity(0.7))
                    Spacer()
                    Text(timeLabel(controller.duration)).font(.system(size: 12, weight: .medium)).foregroundStyle(.white.opacity(0.7))
                }
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
        withAnimation(.easeInOut(duration: 0.25)) { controlsVisible.toggle() }
        if controlsVisible { scheduleHide() }
    }

    private func scheduleHide() {
        hideWork?.cancel()
        let work = DispatchWorkItem {
            withAnimation(.easeInOut(duration: 0.3)) { controlsVisible = false }
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
    }
}

/// Skip-back / play-pause / skip-forward row with a playback-speed pill.
private struct PlayerButtons: View {
    let controller: YouTubePlayerController
    @Binding var speedIndex: Int
    let speeds: [Double]
    let tint: Color
    var playSize: CGFloat = 60

    var body: some View {
        HStack(spacing: 0) {
            Button { Haptics.tap(); controller.seek(to: max(0, controller.currentTime - 5)) } label: {
                Image(systemName: "gobackward.5").font(.system(size: 22)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.plain)
            Button { Haptics.select(); controller.togglePlay() } label: {
                Image(systemName: controller.isPlaying ? "pause.fill" : "play.fill")
                    .font(.system(size: playSize * 0.4)).foregroundStyle(.white)
                    .frame(width: playSize, height: playSize).background(tint).clipShape(.circle)
            }
            .buttonStyle(.plain)
            .frame(maxWidth: .infinity)
            Button { Haptics.tap(); controller.seek(to: controller.currentTime + 5) } label: {
                Image(systemName: "goforward.5").font(.system(size: 22)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.plain)
        }
        .overlay(alignment: .trailing) {
            Button { cycleSpeed() } label: {
                Text(speedLabel).font(.system(size: 13, weight: .bold)).foregroundStyle(.white)
                    .frame(width: 46, height: 30).background(.white.opacity(0.12)).clipShape(.capsule)
            }
            .buttonStyle(.plain)
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

/// A soft-scrim subtitle whose individual words remain tappable for lookup.
private struct FloatingSubtitle: View {
    let text: String
    let savedWords: Set<String>
    var fontSize: CGFloat = 18
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
private struct FlowWords: View {
    let text: String
    let isActive: Bool
    let savedWords: Set<String>
    var fontSize: CGFloat = 16
    var baseColor: Color = .white.opacity(0.72)
    var activeColor: Color = .white
    var alignment: HorizontalAlignment = .leading
    let onWordTap: (String) -> Void

    private var tokens: [String] {
        text.split(separator: " ").map(String.init)
    }

    var body: some View {
        FlowLayout(spacing: 4, lineSpacing: 6) {
            ForEach(Array(tokens.enumerated()), id: \.offset) { _, token in
                let bare = token.trimmingCharacters(in: CharacterSet(charactersIn: ".,;:!?\"'()«»…-")).lowercased()
                let saved = !bare.isEmpty && savedWords.contains(bare)
                Text(token)
                    .font(.system(size: fontSize, weight: isActive ? .semibold : .regular))
                    .foregroundStyle(saved ? Theme.primary : (isActive ? activeColor : baseColor))
                    .padding(.horizontal, saved ? 5 : 0).padding(.vertical, saved ? 1 : 0)
                    .background(saved ? Theme.primary.opacity(0.16) : Color.clear, in: RoundedRectangle(cornerRadius: 5))
                    .contentShape(Rectangle())
                    .onTapGesture { onWordTap(token) }
            }
        }
        .frame(maxWidth: .infinity, alignment: alignment == .center ? .center : .leading)
    }
}

// MARK: - Word capture sheet

private struct WordCaptureSheet: View {
    let word: String
    let context: String
    let accent: Color
    let isSaved: Bool
    let onSave: (WordGloss) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var gloss: WordGloss? = nil
    @State private var isLoading = true
    @State private var saved = false
    @State private var path: [WordRoute] = []

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
                        Text(word).font(.serifDisplay(26, weight: .bold)).foregroundStyle(Theme.text)
                        if let g = gloss, !g.pronunciation.isEmpty {
                            PhoneticLine(text: g.pronunciation)
                        }
                        if let g = gloss, !g.translation.isEmpty {
                            Text(g.translation).font(.system(size: 15, weight: .medium)).foregroundStyle(accent)
                        }
                    }
                    Spacer()
                    HStack(spacing: 8) {
                        Button { Haptics.tap(); NaturalVoice.shared.speak(word, rate: 0.6) } label: {
                            Image(systemName: "tortoise.fill").font(.system(size: 14)).foregroundStyle(accent)
                                .frame(width: 38, height: 38).background(accent.opacity(0.10)).clipShape(.circle)
                        }
                        .buttonStyle(.plain)
                        Button { Haptics.tap(); NaturalVoice.shared.speak(word) } label: {
                            Image(systemName: "speaker.wave.2.fill").font(.system(size: 18)).foregroundStyle(accent)
                                .frame(width: 46, height: 46).background(accent.opacity(0.12)).clipShape(.circle)
                        }
                        .buttonStyle(.plain)
                    }
                }

                if isLoading {
                    VStack(alignment: .leading, spacing: 12) {
                        SkeletonBlock(width: 180, height: 16)
                        SkeletonBlock(height: 14)
                        SkeletonBlock(width: 140, height: 14)
                        HStack(spacing: 8) {
                            ProgressView().tint(accent).scaleEffect(0.8)
                            Text("Looking it up…").font(.system(size: 13)).foregroundStyle(Theme.textMuted)
                        }
                        .padding(.top, 2)
                    }
                } else if let g = gloss {
                    GlossRichDetail(gloss: g, accent: accent, onTermTap: { path.append(WordRoute(term: $0, context: "")) })
                    if !g.example.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(spacing: 8) {
                                Text("Example").font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.textMuted)
                                Button { Haptics.tap(); NaturalVoice.shared.speak(g.example) } label: {
                                    Image(systemName: "speaker.wave.2").font(.system(size: 13)).foregroundStyle(accent)
                                }
                                .buttonStyle(.plain)
                                Button { Haptics.tap(); NaturalVoice.shared.speak(g.example, rate: 0.6) } label: {
                                    Image(systemName: "tortoise.fill").font(.system(size: 12)).foregroundStyle(accent.opacity(0.8))
                                }
                                .buttonStyle(.plain)
                            }
                            Text(g.example).font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.text)
                                .fixedSize(horizontal: false, vertical: true)
                            if !g.exampleTranslation.isEmpty {
                                Text(g.exampleTranslation).font(.system(size: 13)).foregroundStyle(Theme.textMuted)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(14)
                        .background(accent.opacity(0.07)).clipShape(.rect(cornerRadius: Radius.card))
                        .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(accent.opacity(0.18), lineWidth: 1))
                    }
                }

                Button {
                    guard let g = gloss, !saved, !isSaved else { return }
                    onSave(g)
                    saved = true
                } label: {
                    Label(saved || isSaved ? "Saved to Deck" : "Save to Deck",
                          systemImage: saved || isSaved ? "checkmark.circle.fill" : "plus.circle.fill")
                        .font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 15)
                        .background(saved || isSaved ? Theme.success : accent).clipShape(.rect(cornerRadius: Radius.chip))
                }
                .buttonStyle(.plain)
                .disabled(isLoading || saved || isSaved)
                .opacity(isLoading ? 0.6 : 1)
            }
            .padding(.horizontal, 22).padding(.top, 22)
        }
        .toolbar(.hidden, for: .navigationBar)
        .task {
            gloss = await TranslationService.gloss(for: word, context: context)
            isLoading = false
        }
    }
}
