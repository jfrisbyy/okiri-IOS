//
//  ListenView.swift
//  FluentFrenchIOS
//
//  Audio comprehension practice. Browse French dialogues & stories filtered by
//  type and level, then play them with natural voices, subtitles, speed control,
//  and a hold-to-capture tool that saves a segment to the deck.
//

import SwiftUI
import AVFoundation

struct ListenView: View {
    @Environment(AppStore.self) private var store

    @State private var typeFilter: TypeFilter = .all
    @State private var levelFilter: LevelFilter = .all
    @State private var selected: ListeningItem? = nil

    private enum TypeFilter: String, CaseIterable { case all = "All", dialogues = "Dialogues", stories = "Stories" }
    private enum LevelFilter: String, CaseIterable { case all = "All", beginner = "Beginner", intermediate = "Intermediate", advanced = "Advanced" }

    private static let violetGradient = LinearGradient(
        colors: [Color(hex: "8B5CF6"), Color(hex: "6D28D9")],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )
    private static let violet = Color(hex: "7C3AED")

    private var filtered: [ListeningItem] {
        ListeningData.items.filter { item in
            let typeOK: Bool
            switch typeFilter {
            case .all: typeOK = true
            case .dialogues: typeOK = item.type == .dialogue
            case .stories: typeOK = item.type == .story
            }
            let levelOK: Bool
            switch levelFilter {
            case .all: levelOK = true
            case .beginner: levelOK = item.difficulty == .beginner
            case .intermediate: levelOK = item.difficulty == .intermediate
            case .advanced: levelOK = item.difficulty == .advanced
            }
            return typeOK && levelOK
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(spacing: 16) {
                    filterBar
                    LazyVStack(spacing: 12) {
                        ForEach(filtered) { item in
                            scenarioCard(item)
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
            VStack(alignment: .leading, spacing: 4) {
                Text("Listen").font(.serifDisplay(34, weight: .bold)).foregroundStyle(.white)
                Text("Train your ear with real French audio").font(.system(size: 15)).foregroundStyle(.white.opacity(0.85))
            }
            .padding(.horizontal, 20).padding(.bottom, 18)
        }
        .frame(height: 175)
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
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { onSelect(option) }
                } label: {
                    Text(label(option)).font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(active ? .white : Theme.textSecondary)
                        .frame(maxWidth: .infinity).padding(.vertical, 9)
                        .background(active ? Self.violet : .clear)
                        .clipShape(.rect(cornerRadius: 9))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: Radius.chip))
        .overlay(RoundedRectangle(cornerRadius: Radius.chip).stroke(Theme.border, lineWidth: 0.5))
    }

    private func scenarioCard(_ item: ListeningItem) -> some View {
        Button {
            Haptics.select()
            selected = item
        } label: {
            HStack(spacing: 14) {
                Text(item.emoji).font(.system(size: 30))
                    .frame(width: 54, height: 54)
                    .background(Self.violet.opacity(0.1)).clipShape(.rect(cornerRadius: 14))
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.title).font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.text).lineLimit(1)
                    Text(item.titleEnglish).font(.system(size: 13)).foregroundStyle(Theme.textMuted).lineLimit(1)
                    HStack(spacing: 6) {
                        Pill(text: item.difficulty.label, color: difficultyColor(item.difficulty))
                        Pill(text: item.type.label, color: Self.violet)
                        Label("\(item.durationSeconds)s", systemImage: "clock")
                            .font(.system(size: 11, weight: .medium)).foregroundStyle(Theme.textMuted)
                    }
                    .padding(.top, 2)
                }
                Spacer(minLength: 0)
                Image(systemName: "play.circle.fill").font(.system(size: 26)).foregroundStyle(Self.violet)
            }
            .padding(14)
            .background(Theme.card)
            .clipShape(.rect(cornerRadius: Radius.card))
            .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.border.opacity(0.6), lineWidth: 0.5))
            .softLift()
        }
        .buttonStyle(.plain)
        .pressable()
    }

    private func difficultyColor(_ d: ListeningDifficulty) -> Color {
        switch d {
        case .beginner: return Theme.success
        case .intermediate: return Theme.warning
        case .advanced: return Theme.error
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
    @State private var player = DialoguePlayer()
    @State private var showSubtitles = true
    @State private var speedIndex = 2
    @State private var capturing = false
    @State private var captureStart = 0
    @State private var captured: CapturedSegment? = nil
    @State private var savedCapture = false

    private let speeds: [(label: String, rate: Float)] = [
        ("0.7x", 0.7),
        ("0.85x", 0.85),
        ("1x", 1.0),
        ("1.15x", 1.15),
        ("1.3x", 1.3),
    ]

    private struct CapturedSegment: Identifiable {
        let id = UUID()
        let french: String
        let english: String
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
        .sheet(item: $captured) { segment in
            captureSheet(segment)
                .presentationDetents([.medium])
        }
    }

    private var header: some View {
        ZStack(alignment: .bottomLeading) {
            gradient
            VStack(alignment: .leading, spacing: 12) {
                Button { Haptics.tap(); dismiss() } label: {
                    Image(systemName: "chevron.down").font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                        .frame(width: 36, height: 36).background(.white.opacity(0.16), in: Circle())
                }
                .buttonStyle(.plain)
                VStack(alignment: .leading, spacing: 3) {
                    Text(item.title).font(.serifDisplay(24, weight: .bold)).foregroundStyle(.white)
                    Text(item.titleEnglish).font(.system(size: 14)).foregroundStyle(.white.opacity(0.85))
                }
            }
            .padding(.horizontal, 22).padding(.top, 54).padding(.bottom, 18)
        }
        .clipped()
    }

    private var artwork: some View {
        VStack(spacing: 14) {
            Text(item.emoji).font(.system(size: 72))
                .frame(width: 140, height: 140)
                .background(accent.opacity(0.1)).clipShape(.rect(cornerRadius: 30))
                .overlay(RoundedRectangle(cornerRadius: 30).stroke(accent.opacity(0.2), lineWidth: 1))
                .scaleEffect(player.isPlaying ? 1.04 : 1)
                .animation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true), value: player.isPlaying)
            Text(item.description).font(.system(size: 14)).foregroundStyle(Theme.textSecondary)
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
                            .font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
                            .frame(width: 24, height: 24)
                            .background(turn.speaker == "B" ? Theme.secondary : accent).clipShape(.circle)
                    } else {
                        Image(systemName: "text.quote").font(.system(size: 12)).foregroundStyle(accent)
                            .frame(width: 24, height: 24).background(accent.opacity(0.12)).clipShape(.circle)
                    }
                    VStack(alignment: .leading, spacing: 3) {
                        Text(turn.french).font(.system(size: 15, weight: isCurrent ? .semibold : .regular))
                            .foregroundStyle(isCurrent ? Theme.text : Theme.textSecondary)
                        Text(turn.english).font(.system(size: 12)).foregroundStyle(Theme.textMuted)
                    }
                    Spacer(minLength: 0)
                }
                .padding(12)
                .background(isCurrent ? accent.opacity(0.08) : Color.clear)
                .clipShape(.rect(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(isCurrent ? accent.opacity(0.3) : .clear, lineWidth: 1))
                .onTapGesture { player.jump(to: idx) }
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
                            .animation(.linear(duration: 0.2), value: player.progress)
                    }
                }
                .frame(height: 5)
                HStack {
                    Text("Line \(min(player.currentIndex + 1, item.turns.count)) of \(item.turns.count)")
                        .font(.system(size: 11)).foregroundStyle(Theme.textMuted)
                    Spacer()
                    if player.didFinish {
                        Text("Finished").font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.success)
                    }
                }
            }

            // Transport
            HStack(spacing: 28) {
                Button { Haptics.tap(); player.skipBackward() } label: {
                    Image(systemName: "backward.fill").font(.system(size: 20)).foregroundStyle(Theme.text)
                }
                .buttonStyle(.plain)
                Button {
                    Haptics.select(); player.togglePlay()
                } label: {
                    ZStack {
                        Circle().fill(accent).frame(width: 64, height: 64)
                        if player.isBuffering {
                            ProgressView().tint(.white)
                        } else {
                            Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                                .font(.system(size: 26)).foregroundStyle(.white)
                        }
                    }
                    .softLift(radius: 12, y: 5, strength: 0.8)
                }
                .buttonStyle(.plain)
                Button { Haptics.tap(); player.skipForward() } label: {
                    Image(systemName: "forward.fill").font(.system(size: 20)).foregroundStyle(Theme.text)
                }
                .buttonStyle(.plain)
            }

            // Options
            HStack(spacing: 10) {
                Button {
                    Haptics.tap()
                    speedIndex = (speedIndex + 1) % speeds.count
                    player.rate = speeds[speedIndex].rate
                    if player.isPlaying { player.replayCurrent() }
                } label: {
                    Label(speeds[speedIndex].label, systemImage: "speedometer")
                        .font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.text)
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(Theme.backgroundSecondary).clipShape(.capsule)
                }
                .buttonStyle(.plain)
                Button {
                    Haptics.tap()
                    withAnimation { showSubtitles.toggle() }
                } label: {
                    Label("Subtitles", systemImage: showSubtitles ? "captions.bubble.fill" : "captions.bubble")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(showSubtitles ? accent : Theme.textSecondary)
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(showSubtitles ? accent.opacity(0.12) : Theme.backgroundSecondary).clipShape(.capsule)
                }
                .buttonStyle(.plain)
            }

            captureButton
        }
        .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 24)
        .background(Theme.card)
        .overlay(alignment: .top) { Rectangle().fill(Theme.border).frame(height: 0.5) }
    }

    private var captureButton: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radius.chip)
                .fill(capturing ? accent : accent.opacity(0.12))
            HStack(spacing: 8) {
                Image(systemName: capturing ? "waveform" : "hand.tap.fill").font(.system(size: 15))
                Text(capturing ? "Release to capture…" : "Hold to Capture")
                    .font(.system(size: 14, weight: .semibold))
            }
            .foregroundStyle(capturing ? .white : accent)
        }
        .frame(maxWidth: .infinity).frame(height: 48)
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
    }

    private func finishCapture() {
        let lo = min(captureStart, player.currentIndex)
        let hi = max(captureStart, player.currentIndex)
        let slice = item.turns[lo...hi]
        let french = slice.map { $0.french }.joined(separator: " ")
        let english = slice.map { $0.english }.joined(separator: " ")
        savedCapture = false
        Haptics.success()
        captured = CapturedSegment(french: french, english: english)
    }

    private func captureSheet(_ segment: CapturedSegment) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Label("Captured Segment", systemImage: "scissors").font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.text)
                Spacer()
            }
            .padding(.top, 8)
            VStack(alignment: .leading, spacing: 10) {
                Text(segment.french).font(.system(size: 17, weight: .semibold)).foregroundStyle(Theme.text)
                Text(segment.english).font(.system(size: 14)).foregroundStyle(Theme.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(accent.opacity(0.08)).clipShape(.rect(cornerRadius: Radius.card))
            .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(accent.opacity(0.2), lineWidth: 1))

            HStack(spacing: 12) {
                Button {
                    NaturalVoice.shared.speak(segment.french)
                } label: {
                    Label("Replay", systemImage: "speaker.wave.2.fill").font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(accent).frame(maxWidth: .infinity).padding(.vertical, 14)
                        .background(accent.opacity(0.12)).clipShape(.rect(cornerRadius: Radius.chip))
                }
                .buttonStyle(.plain)
                Button {
                    saveCapture(segment)
                } label: {
                    Label(savedCapture ? "Saved" : "Save to Deck", systemImage: savedCapture ? "checkmark.circle.fill" : "plus.circle.fill")
                        .font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                        .background(savedCapture ? Theme.success : accent).clipShape(.rect(cornerRadius: Radius.chip))
                }
                .buttonStyle(.plain)
                .disabled(savedCapture)
            }
            Spacer()
        }
        .padding(.horizontal, 20)
    }

    private func saveCapture(_ segment: CapturedSegment) {
        guard !savedCapture else { return }
        Haptics.success()
        let now = Date()
        let gap = GapItem(
            id: UUID().uuidString,
            frenchWord: segment.french,
            englishTranslation: segment.english,
            explanation: "Captured while listening to “\(item.title)”.",
            exampleSentence: segment.french,
            exampleTranslation: segment.english,
            pronunciation: nil,
            sourceType: .listening,
            category: .phrasing,
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
            originalContext: OriginalContext(sentence: segment.french, translation: segment.english, sourceTab: "listen", capturedAt: now, reExposureCount: 0),
            confusionLinks: []
        )
        store.addGap(gap)
        savedCapture = true
    }
}
