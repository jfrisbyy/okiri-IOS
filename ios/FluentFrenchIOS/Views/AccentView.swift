//
//  AccentView.swift
//  FluentFrenchIOS
//
//  Pronunciation practice — browse sound categories, then step through word
//  cards with phonetics, hints, and a listen button. Recording-based scoring
//  requires a real device microphone, so it shows the standard install note.
//

import SwiftUI

struct AccentView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var selected: PronunciationCategory? = nil

    var body: some View {
        Group {
            if let selected {
                AccentPracticeView(category: selected, onBack: { withAnimation { self.selected = nil } })
            } else {
                catalog
            }
        }
        .background(Theme.background)
        .ignoresSafeArea(edges: .top)
    }

    private var catalog: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(spacing: 14) {
                    ForEach(PronunciationData.categories) { cat in
                        Button { Haptics.select(); withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { selected = cat } } label: {
                            categoryCard(cat)
                        }
                        .buttonStyle(.plain)
                        .pressable()
                    }
                }
                .padding(.horizontal, 18).padding(.top, 18).padding(.bottom, 44)
            }
            .scrollIndicators(.hidden)
        }
    }

    private var header: some View {
        ResourceHeader(
            gradient: LinearGradient(colors: [Color(hex: "EC4899"), Color(hex: "8B5CF6")],
                                     startPoint: .topLeading, endPoint: .bottomTrailing),
            title: "Accent",
            subtitle: "Master French sounds, one at a time",
            onBack: { dismiss() }
        )
    }

    private func categoryCard(_ cat: PronunciationCategory) -> some View {
        HStack(spacing: 14) {
            Text(cat.emoji).font(.system(size: 28))
                .frame(width: 56, height: 56)
                .background(cat.color.opacity(0.12)).clipShape(.rect(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(cat.color.opacity(0.18), lineWidth: 0.5))
            VStack(alignment: .leading, spacing: 4) {
                Text(cat.name).font(.system(size: 17, weight: .semibold)).foregroundStyle(Theme.text)
                Text(cat.detail).font(.system(size: 13)).foregroundStyle(Theme.textMuted)
                    .lineLimit(2).multilineTextAlignment(.leading)
                HStack(spacing: 8) {
                    Pill(text: cat.difficulty, color: cat.color)
                    Text("\(cat.words.count) words").font(.system(size: 12)).foregroundStyle(Theme.textMuted)
                }
                .padding(.top, 2)
            }
            Spacer(minLength: 4)
            Image(systemName: "chevron.right").font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.textMuted)
        }
        .padding(18)
        .frame(maxWidth: .infinity)
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.border.opacity(0.5), lineWidth: 0.5))
        .softLift(radius: 14, y: 5, strength: 0.85)
    }
}

// MARK: - Practice flow

private struct AccentPracticeView: View {
    let category: PronunciationCategory
    let onBack: () -> Void

    @State private var index: Int = 0
    @State private var mastered: Set<String> = []
    @State private var showTips = false

    private var word: PronunciationWord { category.words[index] }
    private var progress: Double { Double(index + 1) / Double(category.words.count) }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(spacing: 18) {
                    wordCard
                    if showTips { tipsCard }
                    recordCard
                }
                .padding(.horizontal, 16).padding(.top, 18).padding(.bottom, 40)
            }
            .scrollIndicators(.hidden)
            navBar
        }
    }

    private var header: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(colors: [category.color, category.color.opacity(0.7)],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Button { Haptics.tap(); onBack() } label: {
                        Image(systemName: "chevron.left").font(.system(size: 17, weight: .bold)).foregroundStyle(.white)
                            .frame(width: 38, height: 38).background(Color.white.opacity(0.2), in: Circle())
                    }
                    .buttonStyle(.plain)
                    Spacer()
                    Button { Haptics.tap(); withAnimation { showTips.toggle() } } label: {
                        Image(systemName: "lightbulb.fill").font(.system(size: 15)).foregroundStyle(.white)
                            .frame(width: 38, height: 38).background(Color.white.opacity(0.2), in: Circle())
                    }
                    .buttonStyle(.plain)
                }
                Text(category.name).font(.serifDisplay(26, weight: .bold)).foregroundStyle(.white)
                HStack(spacing: 8) {
                    Text("\(index + 1) / \(category.words.count)").font(.system(size: 13, weight: .medium)).foregroundStyle(.white.opacity(0.9))
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Color.white.opacity(0.25)).frame(height: 5)
                            Capsule().fill(.white).frame(width: geo.size.width * progress, height: 5)
                        }
                    }
                    .frame(height: 5)
                    Text("\(mastered.count) ✓").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white)
                }
            }
            .padding(.horizontal, 24).padding(.top, 56).padding(.bottom, 18)
        }
        .clipped()
    }

    private var wordCard: some View {
        VStack(spacing: 10) {
            if mastered.contains(word.id) {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.seal.fill").font(.system(size: 13))
                    Text("Mastered").font(.system(size: 12, weight: .semibold))
                }
                .foregroundStyle(Theme.success)
            }
            Text(word.word).font(.serifDisplay(44, weight: .bold)).foregroundStyle(Theme.text)
            Text(word.ipa).font(.system(size: 20, weight: .medium, design: .monospaced)).foregroundStyle(category.color)
            Text(word.translation).font(.system(size: 16)).foregroundStyle(Theme.textSecondary)
            SpeakButton(text: word.word, size: 52).padding(.top, 6)
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "info.circle.fill").font(.system(size: 13)).foregroundStyle(category.color)
                Text(word.audioHint).font(.system(size: 14)).foregroundStyle(Theme.textSecondary)
                    .multilineTextAlignment(.leading)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(category.color.opacity(0.08))
            .clipShape(.rect(cornerRadius: Radius.chip))
            .padding(.top, 8)
        }
        .padding(20)
        .frame(maxWidth: .infinity)
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: Radius.hero))
        .overlay(RoundedRectangle(cornerRadius: Radius.hero).stroke(Theme.border.opacity(0.5), lineWidth: 0.5))
        .softLift(radius: 22, y: 10)
        .id(word.id)
        .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity),
                                removal: .move(edge: .leading).combined(with: .opacity)))
    }

    private var tipsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "lightbulb.fill").font(.system(size: 13)).foregroundStyle(category.color)
                Text("Tips").font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.text)
            }
            ForEach(Array(category.tips.enumerated()), id: \.offset) { _, tip in
                HStack(alignment: .top, spacing: 8) {
                    Circle().fill(category.color).frame(width: 5, height: 5).padding(.top, 7)
                    Text(tip).font(.system(size: 14)).foregroundStyle(Theme.textSecondary)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.border.opacity(0.5), lineWidth: 0.5))
        .softLift()
        .transition(.opacity.combined(with: .move(edge: .top)))
    }

    private var recordCard: some View {
        VStack(spacing: 12) {
            Image(systemName: "waveform").font(.system(size: 26)).foregroundStyle(category.color)
                .frame(width: 64, height: 64).background(category.color.opacity(0.12)).clipShape(.circle)
            Text("Score your pronunciation").font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.text)
            Text("Install this app on your device via the Rork App to record and score your accent.")
                .font(.system(size: 14)).foregroundStyle(Theme.textMuted)
                .multilineTextAlignment(.center)
            Button { Haptics.success(); markMastered() } label: {
                Text("Mark as practiced").font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 13)
                    .background(category.color).clipShape(.rect(cornerRadius: Radius.chip))
            }
            .buttonStyle(.plain)
            .padding(.top, 4)
        }
        .padding(20)
        .frame(maxWidth: .infinity)
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.border.opacity(0.5), lineWidth: 0.5))
        .softLift()
    }

    private var navBar: some View {
        HStack(spacing: 12) {
            navButton(icon: "chevron.left", label: "Previous", enabled: index > 0) {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { index -= 1 }
            }
            navButton(icon: "chevron.right", label: "Next", enabled: index < category.words.count - 1, trailing: true) {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { index += 1 }
            }
        }
        .padding(.horizontal, 16).padding(.top, 10).padding(.bottom, 24)
        .background(Theme.background)
    }

    private func navButton(icon: String, label: String, enabled: Bool, trailing: Bool = false, action: @escaping () -> Void) -> some View {
        Button { Haptics.tap(); action() } label: {
            HStack(spacing: 6) {
                if !trailing { Image(systemName: icon).font(.system(size: 13, weight: .bold)) }
                Text(label).font(.system(size: 15, weight: .semibold))
                if trailing { Image(systemName: icon).font(.system(size: 13, weight: .bold)) }
            }
            .foregroundStyle(enabled ? Theme.text : Theme.textMuted.opacity(0.5))
            .frame(maxWidth: .infinity).padding(.vertical, 13)
            .background(Theme.card)
            .clipShape(.rect(cornerRadius: Radius.chip))
            .overlay(RoundedRectangle(cornerRadius: Radius.chip).stroke(Theme.border, lineWidth: 0.5))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }

    private func markMastered() {
        mastered.insert(word.id)
        if index < category.words.count - 1 {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { index += 1 }
        }
    }
}
