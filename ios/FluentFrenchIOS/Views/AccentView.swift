//
//  AccentView.swift
//  FluentFrenchIOS
//
//  Pronunciation practice — browse sound categories, then step through word
//  cards with phonetics, hints, and a listen button. Scored recording lives in
//  Speak; this page says so honestly and lets the learner save a word to the
//  deck under its pronunciation concept (E25).
//

import SwiftUI

struct AccentView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// 1 at the default text size; the emoji tile grows with the emoji inside it.
    @ScaledMetric private var typeScale: CGFloat = 1
    @State private var selected: PronunciationCategory? = nil

    var body: some View {
        Group {
            if let selected {
                AccentPracticeView(
                    category: selected,
                    onBack: {
                        withAnimation(Theme.motion(.default, reduceMotion: reduceMotion)) { self.selected = nil }
                    }
                )
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
                        Button {
                            Haptics.select()
                            withAnimation(Theme.motion(.spring(response: 0.4, dampingFraction: 0.85), reduceMotion: reduceMotion)) {
                                selected = cat
                            }
                        } label: {
                            categoryCard(cat)
                        }
                        .buttonStyle(.plain)
                        .pressable()
                        .accessibilityLabel("\(cat.name), \(cat.detail)")
                        .accessibilityValue("\(cat.difficulty), \(cat.words.count) words")
                        .accessibilityHint("Opens practice for this sound")
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
            Text(cat.emoji).scaledFont(28)
                .frame(width: 56 * Theme.chromeScale(typeScale), height: 56 * Theme.chromeScale(typeScale))
                .background(cat.color.opacity(0.12)).clipShape(.rect(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(cat.color.opacity(0.18), lineWidth: 0.5))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(cat.name).scaledFont(17, weight: .semibold).foregroundStyle(Theme.text)
                Text(cat.detail).scaledFont(13).foregroundStyle(Theme.textSecondary)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 8) {
                    Pill(text: cat.difficulty, color: cat.color)
                    Text("\(cat.words.count) words").scaledFont(12).foregroundStyle(Theme.textSecondary)
                }
                .padding(.top, 2)
            }
            Spacer(minLength: 4)
            Image(systemName: "chevron.right").scaledFont(14, weight: .semibold).foregroundStyle(Theme.textSecondary)
                .accessibilityHidden(true)
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

    @Environment(AppStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// 1 at the default text size; the round header buttons and the waveform
    /// badge grow with it so their glyphs stay centred.
    @ScaledMetric private var typeScale: CGFloat = 1
    @State private var index: Int = 0
    @State private var mastered: Set<String> = []
    @State private var showTips = false
    /// The word being saved to the deck (E25).
    @State private var captureDraft: CaptureDraft? = nil

    private var word: PronunciationWord { category.words[index] }
    private var progress: Double { Double(index + 1) / Double(category.words.count) }

    /// The taxonomy concept this sound category is evidence of (nil when none fits).
    private var conceptId: String? {
        switch category.id {
        case "nasal-vowels": return "nasal-vowels"
        case "french-r": return "guttural-r"
        default: return nil
        }
    }

    /// What saving a practice word stores: the word, its meaning, the IPA and
    /// the hint as the explanation — a pronunciation gap at A1.
    private func draft(for w: PronunciationWord) -> CaptureDraft {
        CaptureDraft(
            frenchWord: w.word,
            englishTranslation: w.translation,
            explanation: "\(w.ipa) — \(w.audioHint)",
            pronunciation: w.ipa,
            sourceType: .reading,
            sourceTab: "accent",
            sourceLevel: .A1,
            category: .pronunciation,
            conceptId: conceptId
        )
    }

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
        .sheet(item: $captureDraft) { draft in
            CaptureSheet(draft: draft, accent: category.color)
        }
    }

    private var header: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(colors: [category.color, category.color.opacity(0.7)],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Button { Haptics.tap(); onBack() } label: {
                        Image(systemName: "chevron.left").scaledFont(17, weight: .bold).foregroundStyle(.white)
                            .frame(width: 38 * Theme.chromeScale(typeScale), height: 38 * Theme.chromeScale(typeScale))
                            .background(Color.white.opacity(0.2), in: Circle())
                            .minimumHitTarget()
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Back to sound categories")
                    Spacer()
                    Button {
                        Haptics.tap()
                        withAnimation(Theme.motion(.default, reduceMotion: reduceMotion)) { showTips.toggle() }
                    } label: {
                        Image(systemName: "lightbulb.fill").scaledFont(15).foregroundStyle(.white)
                            .frame(width: 38 * Theme.chromeScale(typeScale), height: 38 * Theme.chromeScale(typeScale))
                            .background(Color.white.opacity(0.2), in: Circle())
                            .minimumHitTarget()
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(showTips ? "Hide tips" : "Show tips")
                    .accessibilityHint("Tips for making this sound")
                }
                Text(category.name).scaledSerifDisplay(26, weight: .bold).foregroundStyle(.white)
                    .accessibilityAddTraits(.isHeader)
                HStack(spacing: 8) {
                    Text("\(index + 1) / \(category.words.count)").scaledFont(13, weight: .medium).foregroundStyle(.white.opacity(0.9))
                        .accessibilityLabel("Word \(index + 1) of \(category.words.count)")
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Color.white.opacity(0.25)).frame(height: 5)
                            Capsule().fill(.white).frame(width: geo.size.width * progress, height: 5)
                        }
                    }
                    .frame(height: 5)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Progress through this sound")
                    .accessibilityValue("\(Int((progress * 100).rounded())) percent")
                    Text("\(mastered.count) ✓").scaledFont(13, weight: .semibold).foregroundStyle(.white)
                        .accessibilityLabel("\(mastered.count) practiced")
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
                    Image(systemName: "checkmark.seal.fill").scaledFont(13).accessibilityHidden(true)
                    Text("Practiced").scaledFont(12, weight: .semibold)
                }
                .foregroundStyle(Theme.success)
                .accessibilityElement(children: .combine)
            }
            Text(word.word).scaledSerifDisplay(44, weight: .bold).foregroundStyle(Theme.text)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            Text(word.ipa).scaledFont(20, weight: .medium, design: .monospaced).foregroundStyle(category.color)
                .accessibilityLabel("Phonetic spelling")
                .accessibilityValue(word.ipa)
            Text(word.translation).scaledFont(16).foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            SpeakButton(text: word.word, size: 52).padding(.top, 6)
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "info.circle.fill").scaledFont(13).foregroundStyle(category.color)
                    .accessibilityHidden(true)
                Text(word.audioHint).scaledFont(14).foregroundStyle(Theme.textSecondary)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .accessibilityElement(children: .combine)
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
        // Reduce Motion: cards cross-fade instead of sliding in from the side.
        .transition(reduceMotion
                    ? AnyTransition.opacity
                    : .asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity),
                                  removal: .move(edge: .leading).combined(with: .opacity)))
    }

    private var tipsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "lightbulb.fill").scaledFont(13).foregroundStyle(category.color)
                    .accessibilityHidden(true)
                Text("Tips").scaledFont(15, weight: .bold).foregroundStyle(Theme.text)
                    .accessibilityAddTraits(.isHeader)
            }
            ForEach(Array(category.tips.enumerated()), id: \.offset) { _, tip in
                HStack(alignment: .top, spacing: 8) {
                    Circle().fill(category.color).frame(width: 5, height: 5).padding(.top, 7)
                        .accessibilityHidden(true)
                    Text(tip).scaledFont(14).foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.border.opacity(0.5), lineWidth: 0.5))
        .softLift()
        .transition(reduceMotion ? AnyTransition.opacity : .opacity.combined(with: .move(edge: .top)))
    }

    private var recordCard: some View {
        let saved = store.hasGap(forWord: word.word)
        return VStack(spacing: 12) {
            Image(systemName: "waveform").scaledFont(26).foregroundStyle(category.color)
                .frame(width: 64 * Theme.chromeScale(typeScale), height: 64 * Theme.chromeScale(typeScale))
                .background(category.color.opacity(0.12)).clipShape(.circle)
                .accessibilityHidden(true)
            Text("Say it out loud").font(.headline).foregroundStyle(Theme.text)
                .multilineTextAlignment(.center)
            Text("Listen, repeat, and mark it when it feels right. Scored pronunciation practice lives in Speak.")
                .font(.subheadline).foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            Button { Haptics.success(); markMastered() } label: {
                Text("Mark as practiced").font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).frame(minHeight: 46)
                    .background(category.color).clipShape(.rect(cornerRadius: Radius.chip))
            }
            .buttonStyle(.plain)
            .accessibilityHint("Marks this word as practiced and moves to the next one")
            .padding(.top, 4)
            Button {
                guard !saved else { return }
                Haptics.tap()
                captureDraft = draft(for: word)
            } label: {
                Label(saved ? "In your deck" : "Save to my deck",
                      systemImage: saved ? "checkmark.circle.fill" : "plus.circle.fill")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(saved ? Theme.success : category.color)
                    .frame(maxWidth: .infinity).frame(minHeight: Theme.minimumHitTarget)
                    .background(saved ? Theme.successLight : category.color.opacity(0.1))
                    .clipShape(.rect(cornerRadius: Radius.chip))
            }
            .buttonStyle(.plain)
            .disabled(saved)
            .accessibilityLabel(saved ? "\(word.word) is already in your deck" : "Save \(word.word) to my deck")
            .accessibilityHint(saved ? "" : "Adds this word to your practice deck")
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
                withAnimation(Theme.motion(.spring(response: 0.4, dampingFraction: 0.85), reduceMotion: reduceMotion)) { index -= 1 }
            }
            navButton(icon: "chevron.right", label: "Next", enabled: index < category.words.count - 1, trailing: true) {
                withAnimation(Theme.motion(.spring(response: 0.4, dampingFraction: 0.85), reduceMotion: reduceMotion)) { index += 1 }
            }
        }
        .padding(.horizontal, 16).padding(.top, 10).padding(.bottom, 24)
        .background(Theme.background)
    }

    private func navButton(icon: String, label: String, enabled: Bool, trailing: Bool = false, action: @escaping () -> Void) -> some View {
        Button { Haptics.tap(); action() } label: {
            HStack(spacing: 6) {
                if !trailing { Image(systemName: icon).scaledFont(13, weight: .bold).accessibilityHidden(true) }
                Text(label).scaledFont(15, weight: .semibold)
                if trailing { Image(systemName: icon).scaledFont(13, weight: .bold).accessibilityHidden(true) }
            }
            .foregroundStyle(enabled ? Theme.text : Theme.textMuted.opacity(0.5))
            .frame(maxWidth: .infinity).padding(.vertical, 13).frame(minHeight: Theme.minimumHitTarget)
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
            withAnimation(Theme.motion(.spring(response: 0.4, dampingFraction: 0.85), reduceMotion: reduceMotion)) { index += 1 }
        }
    }
}
