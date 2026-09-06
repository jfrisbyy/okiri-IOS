//
//  ListenView.swift
//  FluentFrenchIOS
//
//  Audio comprehension practice. Browse French dialogues & stories ordered for
//  the learner's level, then play them with natural voices (or the built-in
//  voice, labelled as such), subtitles, speed control, and a hold-to-capture
//  tool that saves each selected line to the deck as its own card (E8).
//

import AVFoundation
import Foundation
import SwiftUI

struct ListenView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// The header holds the largest text on the screen, so its height grows with
    /// the learner's text size instead of clipping the title.
    @ScaledMetric(relativeTo: .largeTitle) private var headerHeight: CGFloat = 175

    @State private var typeFilter: TypeFilter = .all
    @State private var levelFilter: LevelFilter = .forYou
    @State private var selected: ListeningItem? = nil

    private enum TypeFilter: String, CaseIterable { case all = "All", dialogues = "Dialogues", stories = "Stories" }
    private enum LevelFilter: String, CaseIterable {
        case forYou = "For you", beginner = "Beginner", intermediate = "Intermediate", advanced = "Advanced"

        var difficulty: ListeningDifficulty? {
            switch self {
            case .forYou: return nil
            case .beginner: return .beginner
            case .intermediate: return .intermediate
            case .advanced: return .advanced
            }
        }
    }

    private static let violetGradient = LinearGradient(
        colors: [Color(hex: "8B5CF6"), Color(hex: "6D28D9")],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )
    private static let violet = Color(hex: "7C3AED")

    /// The engine's one notion of level, not a local rule.
    private var learnerLevel: CEFRLevel { store.learnerLevel }

    /// Type filter, then level filter; "For you" keeps every band but orders the
    /// learner's own band first (E20-style honesty: the shelf really is level-aware).
    private var shelf: [ListeningItem] {
        let byType = ListeningData.items.filter { item in
            switch typeFilter {
            case .all: return true
            case .dialogues: return item.type == .dialogue
            case .stories: return item.type == .story
            }
        }
        if let difficulty = levelFilter.difficulty {
            return byType.filter { $0.difficulty == difficulty }
        }
        return ListeningShelf.ordered(byType, learnerLevel: learnerLevel)
    }

    private var levelCopy: String {
        store.hasCompletedAssessment
            ? "Ordered for your level (\(learnerLevel.rawValue))"
            : "Easiest first until you're placed"
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(spacing: 16) {
                    filterBar
                    if levelFilter == .forYou {
                        HStack(spacing: 6) {
                            Image(systemName: "line.3.horizontal.decrease.circle").font(.caption).accessibilityHidden(true)
                            Text(levelCopy).font(.caption)
                        }
                        .foregroundStyle(Theme.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    if shelf.isEmpty {
                        emptyShelf
                    } else {
                        LazyVStack(spacing: 12) {
                            ForEach(shelf) { item in
                                scenarioCard(item)
                            }
                        }
                    }
                }
                .padding(.horizontal, 18).padding(.top, 16).padding(.bottom, 48)
            }
            .scrollIndicators(.hidden)
        }
        .background(Theme.background)
        .ignoresSafeArea(edges: .top)
        .fullScreenCover(item: $selected) { item in
            ListenPlayerView(item: item, accent: Self.violet, gradient: Self.violetGradient)
                .environment(store)
        }
    }

    private var header: some View {
        ZStack(alignment: .bottomLeading) {
            Self.violetGradient
            Circle()
                .fill(RadialGradient(colors: [.white.opacity(0.18), .clear], center: .center, startRadius: 0, endRadius: 150))
                .frame(width: 240, height: 240).offset(x: 130, y: -30)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text("Listen").scaledSerifDisplay(34, weight: .bold).foregroundStyle(.white)
                Text("Train your ear with French dialogues and stories").font(.subheadline).foregroundStyle(.white.opacity(0.85))
            }
            .padding(.horizontal, 20).padding(.bottom, 18)
        }
        .frame(height: headerHeight)
        .clipped()
    }

    private var filterBar: some View {
        VStack(spacing: 10) {
            segmented(TypeFilter.allCases, selection: typeFilter) { typeFilter = $0 } label: { $0.rawValue }
            segmented(LevelFilter.allCases, selection: levelFilter) { levelFilter = $0 } label: { $0.rawValue }
        }
    }

    private func segmented<T: Hashable>(_ options: [T], selection: T, onSelect: @escaping (T) -> Void, label: @escaping (T) -> String) -> some View {
        HStack(spacing: 4) {
            ForEach(options, id: \.self) { option in
                let active = option == selection
                Button {
                    Haptics.tap()
                    withAnimation(Theme.motion(.spring(response: 0.3, dampingFraction: 0.85), reduceMotion: reduceMotion)) { onSelect(option) }
                } label: {
                    Text(label(option)).font(.footnote.weight(.semibold))
                        .foregroundStyle(active ? .white : Theme.textSecondary)
                        .frame(maxWidth: .infinity).frame(minHeight: Theme.minimumHitTarget)
                        .background(active ? Self.violet : .clear)
                        .clipShape(.rect(cornerRadius: 9))
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(active ? [.isSelected] : [])
            }
        }
        .padding(4)
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: Radius.chip))
        .overlay(RoundedRectangle(cornerRadius: Radius.chip).stroke(Theme.border, lineWidth: 0.5))
    }

    private var emptyShelf: some View {
        VStack(spacing: 8) {
            Image(systemName: "waveform.slash").font(.title2).foregroundStyle(Theme.textMuted).accessibilityHidden(true)
            Text("Nothing here yet").font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
            Text("No \(levelFilter.rawValue.lowercased()) \(typeFilter == .stories ? "stories" : "dialogues") in this set — try another filter.")
                .font(.footnote).foregroundStyle(Theme.textSecondary).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 32)
    }

    private func scenarioCard(_ item: ListeningItem) -> some View {
        let fit = ListeningShelf.fit(item.difficulty, learnerLevel: learnerLevel)
        return Button {
            Haptics.select()
            selected = item
        } label: {
            HStack(spacing: 14) {
                Text(item.emoji).scaledFont(30).minimumScaleFactor(0.6)
                    .frame(width: 54, height: 54)
                    .background(Self.violet.opacity(0.1)).clipShape(.rect(cornerRadius: 14))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.title).font(.callout.weight(.semibold)).foregroundStyle(Theme.text)
                        .multilineTextAlignment(.leading)
                    Text(item.titleEnglish).font(.footnote).foregroundStyle(Theme.textSecondary)
                        .multilineTextAlignment(.leading)
                    HStack(spacing: 6) {
                        Pill(text: item.difficulty.label, color: difficultyColor(item.difficulty))
                        if levelFilter == .forYou {
                            Pill(text: fit.rawValue, color: fitColor(fit), filled: fit == .atLevel)
                        }
                        Pill(text: item.type.label, color: Self.violet)
                        Label("\(item.durationSeconds)s", systemImage: "clock")
                            .font(.caption2.weight(.medium)).foregroundStyle(Theme.textSecondary)
                    }
                    .padding(.top, 2)
                }
                Spacer(minLength: 0)
                Image(systemName: "play.circle.fill").font(.title2).foregroundStyle(Self.violet)
                    .accessibilityHidden(true)
            }
            .padding(14)
            .background(Theme.card)
            .clipShape(.rect(cornerRadius: Radius.card))
            .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.border.opacity(0.6), lineWidth: 0.5))
            .softLift()
        }
        .buttonStyle(.plain)
        .pressable()
        .accessibilityLabel("\(item.title), \(item.titleEnglish). \(item.difficulty.label) \(item.type.label.lowercased()), \(fit.rawValue), \(item.durationSeconds) seconds")
        .accessibilityHint("Opens the player")
    }

    private func difficultyColor(_ d: ListeningDifficulty) -> Color {
        switch d {
        case .beginner: return Theme.success
        case .intermediate: return Theme.warning
        case .advanced: return Theme.error
        }
    }

    private func fitColor(_ fit: ListeningFit) -> Color {
        switch fit {
        case .atLevel: return Self.violet
        case .easy: return Theme.secondary
        case .stretch: return Theme.warning
        }
    }
}

// MARK: - Player

private struct ListenPlayerView: View {
    let item: ListeningItem
    let accent: Color
    let gradient: LinearGradient

    @Environment(\.dismiss) private var dismiss
    @Environment(AppStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// The hold-to-capture bar wraps its own label, so it grows with the text size.
    @ScaledMetric(relativeTo: .subheadline) private var captureBarHeight: CGFloat = 48
    @State private var player = DialoguePlayer()
    @State private var showSubtitles = true
    @State private var speedIndex = 2
    @State private var capturing = false
    @State private var captureStart = 0
    @State private var captured: CapturedSelection? = nil
    /// The dialogue was playing when the capture sheet opened: resume it on dismiss (EM-5).
    @State private var resumeAfterCapture = false

    private let speeds: [(label: String, rate: Float)] = [
        ("0.7x", 0.7),
        ("0.85x", 0.85),
        ("1x", 1.0),
        ("1.15x", 1.15),
        ("1.3x", 1.3),
    ]

    /// The lines a hold-to-capture gesture selected, one per turn (E8).
    private struct CapturedSelection: Identifiable {
        let id = UUID()
        let specs: [ListeningCaptureSpec]
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(spacing: 20) {
                    artwork
                    if showSubtitles { transcript }
                    Spacer(minLength: 8)
                }
                .padding(.horizontal, 20).padding(.top, 18).padding(.bottom, 24)
            }
            .scrollIndicators(.hidden)
            controls
        }
        .background(Theme.background)
        .ignoresSafeArea(edges: .top)
        .onAppear { player.load(item) }
        .onDisappear { player.stop() }
        .sheet(item: $captured, onDismiss: {
            if resumeAfterCapture {
                resumeAfterCapture = false
                player.play()
            }
        }) { selection in
            ListeningCaptureSheet(item: item, specs: selection.specs, accent: accent)
                .environment(store)
                .presentationDetents([.medium, .large])
        }
    }

    private var header: some View {
        ZStack(alignment: .bottomLeading) {
            gradient
            VStack(alignment: .leading, spacing: 12) {
                Button { Haptics.tap(); dismiss() } label: {
                    Image(systemName: "chevron.down").font(.callout.weight(.semibold)).foregroundStyle(.white)
                        .frame(width: 44, height: 44).background(.white.opacity(0.16), in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close player")
                VStack(alignment: .leading, spacing: 3) {
                    Text(item.title).scaledSerifDisplay(24, weight: .bold).foregroundStyle(.white)
                    Text(item.titleEnglish).font(.subheadline).foregroundStyle(.white.opacity(0.85))
                }
            }
            .padding(.horizontal, 22).padding(.top, 54).padding(.bottom, 18)
        }
        .clipped()
    }

    private var artwork: some View {
        VStack(spacing: 14) {
            Text(item.emoji).scaledFont(72).minimumScaleFactor(0.5)
                .frame(width: 140, height: 140)
                .background(accent.opacity(0.1)).clipShape(.rect(cornerRadius: 30))
                .overlay(RoundedRectangle(cornerRadius: 30).stroke(accent.opacity(0.2), lineWidth: 1))
                .scaleEffect(player.isPlaying ? 1.04 : 1)
                .reducedMotionAnimation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true), value: player.isPlaying)
                .accessibilityHidden(true)
            Text(item.description).font(.subheadline).foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(.top, 6)
    }

    private var transcript: some View {
        VStack(spacing: 8) {
            ForEach(Array(item.turns.enumerated()), id: \.element.id) { idx, turn in
                let isCurrent = idx == player.currentIndex
                HStack(alignment: .top, spacing: 10) {
                    if turn.speaker != "narrator" {
                        Text(turn.speaker)
                            .font(.caption.weight(.bold)).foregroundStyle(.white)
                            .minimumScaleFactor(0.6)
                            .frame(width: 24, height: 24)
                            .background(turn.speaker == "B" ? Theme.secondary : accent).clipShape(.circle)
                    } else {
                        Image(systemName: "text.quote").font(.caption).foregroundStyle(accent)
                            .frame(width: 24, height: 24).background(accent.opacity(0.12)).clipShape(.circle)
                    }
                    VStack(alignment: .leading, spacing: 3) {
                        Text(turn.french).font(.subheadline.weight(isCurrent ? .semibold : .regular))
                            .foregroundStyle(isCurrent ? Theme.text : Theme.textSecondary)
                        Text(turn.english).font(.caption).foregroundStyle(Theme.textSecondary)
                    }
                    Spacer(minLength: 0)
                }
                .padding(12)
                .background(isCurrent ? accent.opacity(0.08) : Color.clear)
                .clipShape(.rect(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(isCurrent ? accent.opacity(0.3) : .clear, lineWidth: 1))
                .contentShape(Rectangle())
                .onTapGesture { player.jump(to: idx) }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Line \(idx + 1)\(turn.speaker == "narrator" ? "" : ", speaker \(turn.speaker)"): \(turn.french). \(turn.english)")
                .accessibilityAddTraits(isCurrent ? [.isButton, .isSelected] : [.isButton])
                .accessibilityHint("Plays from this line")
            }
        }
    }

    private var controls: some View {
        VStack(spacing: 14) {
            // Progress
            VStack(spacing: 6) {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Theme.border).frame(height: 5)
                        Capsule().fill(accent).frame(width: geo.size.width * player.progress, height: 5)
                            .reducedMotionAnimation(.linear(duration: 0.2), value: player.progress)
                    }
                }
                .frame(height: 5)
                .accessibilityElement()
                .accessibilityLabel("Progress")
                .accessibilityValue("Line \(min(player.currentIndex + 1, item.turns.count)) of \(item.turns.count)")
                HStack {
                    Text("Line \(min(player.currentIndex + 1, item.turns.count)) of \(item.turns.count)")
                        .font(.caption2).foregroundStyle(Theme.textSecondary)
                    Spacer()
                    if player.didFinish {
                        Text("Finished").font(.caption2.weight(.semibold)).foregroundStyle(Theme.success)
                    }
                }
            }

            // Transport
            HStack(spacing: 28) {
                Button { Haptics.tap(); player.skipBackward() } label: {
                    Image(systemName: "backward.fill").font(.title3).foregroundStyle(Theme.text)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Previous line")
                Button {
                    Haptics.select(); player.togglePlay()
                } label: {
                    ZStack {
                        Circle().fill(accent).frame(width: 64, height: 64)
                        if player.isBuffering {
                            ProgressView().tint(.white).accessibilityHidden(true)
                        } else {
                            Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                                .font(.title).foregroundStyle(.white)
                        }
                    }
                    .softLift(radius: 12, y: 5, strength: 0.8)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(player.isBuffering ? "Loading voice, tap to pause" : (player.isPlaying ? "Pause" : "Play"))
                Button { Haptics.tap(); player.skipForward() } label: {
                    Image(systemName: "forward.fill").font(.title3).foregroundStyle(Theme.text)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Next line")
            }

            voiceStatus

            // Options
            HStack(spacing: 10) {
                Button {
                    Haptics.tap()
                    speedIndex = (speedIndex + 1) % speeds.count
                    player.rate = speeds[speedIndex].rate
                    if player.isPlaying { player.replayCurrent() }
                } label: {
                    Label(speeds[speedIndex].label, systemImage: "speedometer")
                        .font(.footnote.weight(.semibold)).foregroundStyle(Theme.text)
                        .padding(.horizontal, 12).frame(minHeight: 44)
                        .background(Theme.backgroundSecondary).clipShape(.capsule)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Playback speed \(speeds[speedIndex].label)")
                .accessibilityHint("Cycles to the next speed")
                Button {
                    Haptics.tap()
                    withAnimation(Theme.motion(.default, reduceMotion: reduceMotion)) { showSubtitles.toggle() }
                } label: {
                    Label("Subtitles", systemImage: showSubtitles ? "captions.bubble.fill" : "captions.bubble")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(showSubtitles ? accent : Theme.textSecondary)
                        .padding(.horizontal, 12).frame(minHeight: 44)
                        .background(showSubtitles ? accent.opacity(0.12) : Theme.backgroundSecondary).clipShape(.capsule)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(showSubtitles ? "Hide subtitles" : "Show subtitles")
            }

            captureButton
        }
        .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 24)
        .background(Theme.card)
        .overlay(alignment: .top) { Rectangle().fill(Theme.border).frame(height: 0.5) }
    }

    /// Which voice is speaking, and — while a natural clip buffers — a way out
    /// of the wait (E17 / E26). The wait itself is bounded by `Tuning.ttsFetchTimeout`.
    @ViewBuilder
    private var voiceStatus: some View {
        if player.isBuffering {
            HStack(spacing: 10) {
                Text("Loading the natural voice…").font(.footnote).foregroundStyle(Theme.textSecondary)
                Spacer(minLength: 0)
                Button { Haptics.tap(); player.skipBuffering() } label: {
                    Text("Skip the wait").font(.footnote.weight(.semibold)).foregroundStyle(accent)
                        .padding(.horizontal, 12).frame(minHeight: 44)
                        .background(accent.opacity(0.12)).clipShape(.capsule)
                }
                .buttonStyle(.plain)
                .accessibilityHint("Plays this dialogue with the built-in voice instead")
            }
        } else if let notice = player.voiceSource.notice {
            HStack(spacing: 8) {
                Image(systemName: "speaker.wave.1").font(.caption).foregroundStyle(Theme.textMuted).accessibilityHidden(true)
                Text(notice).font(.caption).foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
            .accessibilityElement(children: .combine)
        } else {
            HStack(spacing: 6) {
                Image(systemName: "waveform").font(.caption).foregroundStyle(Theme.textMuted).accessibilityHidden(true)
                Text(player.voiceSource.label).font(.caption).foregroundStyle(Theme.textSecondary)
                Spacer(minLength: 0)
            }
            .accessibilityElement(children: .combine)
        }
    }

    private var captureButton: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radius.chip)
                .fill(capturing ? accent : accent.opacity(0.12))
            HStack(spacing: 8) {
                Image(systemName: capturing ? "waveform" : "hand.tap.fill").font(.subheadline)
                Text(capturing ? "Release to capture…" : "Hold to capture lines")
                    .font(.subheadline.weight(.semibold))
            }
            .foregroundStyle(capturing ? .white : accent)
        }
        .frame(maxWidth: .infinity).frame(height: captureBarHeight)
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in
                    if !capturing {
                        capturing = true
                        captureStart = player.currentIndex
                        Haptics.select()
                    }
                }
                .onEnded { _ in
                    capturing = false
                    finishCapture()
                }
        )
        .accessibilityElement()
        .accessibilityLabel("Capture the current line")
        .accessibilityHint("Hold while lines play to select several; each line is saved as its own card")
        .accessibilityAddTraits(.isButton)
        .accessibilityAction {
            captureStart = player.currentIndex
            finishCapture()
        }
    }

    /// One card per selected turn — never a joined passage (E8). The dialogue
    /// pauses first so the sheet's own replay never speaks over it, and resumes
    /// when the sheet closes if it was playing (EM-5).
    private func finishCapture() {
        let specs = ListeningCapture.specs(for: item, from: captureStart, to: player.currentIndex)
        guard !specs.isEmpty else { return }
        resumeAfterCapture = player.isPlaying
        if resumeAfterCapture { player.pause() }
        Haptics.success()
        captured = CapturedSelection(specs: specs)
    }
}

// MARK: - Capture sheet (one card per line)

private struct ListeningCaptureSheet: View {
    let item: ListeningItem
    let specs: [ListeningCaptureSpec]
    let accent: Color

    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    /// Lines saved from this sheet (the store's own outcome, keyed by turn index).
    @State private var outcomes: [Int: CaptureOutcome] = [:]

    private func isDone(_ spec: ListeningCaptureSpec) -> Bool {
        if outcomes[spec.turnIndex] != nil { return true }
        return store.hasGap(forWord: spec.french)
    }

    private func status(_ spec: ListeningCaptureSpec) -> String {
        switch outcomes[spec.turnIndex] {
        case .saved?: return "Saved"
        case .duplicate?: return "Already in your deck"
        case .rejected?: return "Couldn't save"
        case nil: return store.hasGap(forWord: spec.french) ? "Already in your deck" : "Save"
        }
    }

    private var pending: [ListeningCaptureSpec] { specs.filter { !isDone($0) } }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Label(specs.count == 1 ? "Captured line" : "Captured \(specs.count) lines", systemImage: "scissors")
                    .font(.callout.weight(.bold)).foregroundStyle(Theme.text)
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark").font(.footnote.weight(.semibold)).foregroundStyle(Theme.textSecondary)
                        .frame(width: 44, height: 44).background(Theme.backgroundSecondary, in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close")
            }
            .padding(.top, 8)
            Text("Each line becomes its own card, with its own translation.")
                .font(.footnote).foregroundStyle(Theme.textSecondary)

            ScrollView {
                VStack(spacing: 10) {
                    ForEach(specs) { spec in lineCard(spec) }
                }
            }
            .scrollIndicators(.hidden)

            if pending.count > 1 {
                Button {
                    let outcome = store.captureListeningTurns(pending, from: item)
                    for gap in outcome.savedGaps {
                        if let spec = specs.first(where: { $0.french.caseInsensitiveCompare(gap.frenchWord) == .orderedSame }) {
                            outcomes[spec.turnIndex] = .saved(gap)
                        }
                    }
                    for spec in pending where outcomes[spec.turnIndex] == nil {
                        if let existing = store.existingGap(forWord: spec.french) {
                            outcomes[spec.turnIndex] = .duplicate(existing)
                        }
                    }
                    if outcome.savedCount > 0 { Haptics.success() } else { Haptics.tap() }
                } label: {
                    Label("Save all \(pending.count) lines", systemImage: "plus.circle.fill")
                        .font(.body.weight(.bold)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).frame(minHeight: 50)
                        .background(accent).clipShape(.rect(cornerRadius: 14))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 20).padding(.bottom, 16)
        .background(Theme.background)
    }

    private func lineCard(_ spec: ListeningCaptureSpec) -> some View {
        let done = isDone(spec)
        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                if spec.speaker != "narrator" {
                    Text(spec.speaker).font(.caption.weight(.bold)).foregroundStyle(.white)
                        .minimumScaleFactor(0.6)
                        .frame(width: 24, height: 24)
                        .background(spec.speaker == "B" ? Theme.secondary : accent).clipShape(.circle)
                        .accessibilityHidden(true)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(spec.french).font(.callout.weight(.semibold)).foregroundStyle(Theme.text)
                        .fixedSize(horizontal: false, vertical: true)
                    if !spec.english.isEmpty {
                        Text(spec.english).font(.footnote).foregroundStyle(Theme.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: 0)
            }
            HStack(spacing: 10) {
                Button { Haptics.tap(); NaturalVoice.shared.speak(spec.french, voice: NaturalVoiceID.forSpeaker(spec.speaker)) } label: {
                    Label("Replay", systemImage: "speaker.wave.2.fill").font(.footnote.weight(.semibold))
                        .foregroundStyle(accent).padding(.horizontal, 12).frame(minHeight: 44)
                        .background(accent.opacity(0.12)).clipShape(.capsule)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Replay this line")
                Spacer(minLength: 0)
                Button {
                    let result = store.captureListeningTurn(spec, from: item)
                    outcomes[spec.turnIndex] = result
                    if case .saved = result { Haptics.success() } else { Haptics.tap() }
                } label: {
                    Label(status(spec), systemImage: done ? "checkmark.circle.fill" : "plus.circle.fill")
                        .font(.footnote.weight(.semibold)).foregroundStyle(.white)
                        .padding(.horizontal, 14).frame(minHeight: 44)
                        .background(done ? Theme.success : accent).clipShape(.capsule)
                }
                .buttonStyle(.plain)
                .disabled(done)
                .accessibilityLabel(done ? status(spec) : "Save this line to my deck")
            }
        }
        .padding(14)
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(accent.opacity(0.2), lineWidth: 1))
    }
}
