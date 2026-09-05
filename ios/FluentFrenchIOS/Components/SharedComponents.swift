//
//  SharedComponents.swift
//  FluentFrenchIOS
//
//  Reusable building blocks: gradient header, stat pills, section header,
//  category chips, and the audio "speak" button.
//

import SwiftUI

// MARK: - Gradient header

struct GradientHeader<Trailing: View>: View {
    let gradient: LinearGradient
    let title: String
    let subtitle: String
    var trailing: Trailing

    init(gradient: LinearGradient, title: String, subtitle: String, @ViewBuilder trailing: () -> Trailing = { EmptyView() }) {
        self.gradient = gradient
        self.title = title
        self.subtitle = subtitle
        self.trailing = trailing()
    }

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            gradient
            Circle()
                .fill(Color.white.opacity(0.08))
                .frame(width: 120, height: 120)
                .offset(x: -36, y: 40)
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(title)
                            .font(.serifDisplay(32, weight: .bold))
                            .foregroundStyle(.white)
                        Text(subtitle)
                            .font(.system(size: 15))
                            .foregroundStyle(.white.opacity(0.88))
                    }
                    Spacer()
                    trailing
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 8)
            .padding(.bottom, 22)
        }
        .clipped()
    }
}

// MARK: - Resource page header

/// A slimmer, more premium header used across the resource pages. Replaces the
/// bright floating circle with a soft radial corner glow and adds a subtle
/// bottom scrim so titles stay crisp over any gradient. Includes a refined
/// back button and an optional trailing control.
struct ResourceHeader<Trailing: View>: View {
    let gradient: LinearGradient
    let title: String
    let subtitle: String
    var onBack: () -> Void
    var trailing: Trailing

    init(
        gradient: LinearGradient,
        title: String,
        subtitle: String,
        onBack: @escaping () -> Void,
        @ViewBuilder trailing: () -> Trailing = { EmptyView() }
    ) {
        self.gradient = gradient
        self.title = title
        self.subtitle = subtitle
        self.onBack = onBack
        self.trailing = trailing()
    }

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            gradient
            RadialGradient(
                colors: [Color.white.opacity(0.22), .clear],
                center: .topTrailing, startRadius: 6, endRadius: 240
            )
            LinearGradient(
                colors: [.clear, Color.black.opacity(0.12)],
                startPoint: .center, endPoint: .bottom
            )
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Button { Haptics.tap(); onBack() } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                            .frame(width: 36, height: 36)
                            .background(.white.opacity(0.16), in: Circle())
                            .overlay(Circle().stroke(.white.opacity(0.22), lineWidth: 0.5))
                    }
                    .buttonStyle(.plain)
                    Spacer()
                    trailing
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(.serifDisplay(28, weight: .bold)).foregroundStyle(.white)
                    Text(subtitle).font(.system(size: 14)).foregroundStyle(.white.opacity(0.82))
                }
            }
            .padding(.horizontal, 22).padding(.top, 54).padding(.bottom, 18)
        }
        .clipped()
    }
}

// MARK: - Stat pill row

struct HeaderStat: View {
    let systemImage: String
    let value: String
    let label: String
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: systemImage)
                .font(.system(size: 15))
                .foregroundStyle(.white)
            VStack(alignment: .leading, spacing: -2) {
                Text(value).font(.system(size: 18, weight: .bold)).foregroundStyle(.white)
                Text(label).font(.system(size: 11)).foregroundStyle(.white.opacity(0.75))
            }
        }
    }
}

// MARK: - Section header

struct SectionHeader: View {
    let title: String
    var trailing: String? = nil
    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(.serifDisplay(20, weight: .semibold))
                .foregroundStyle(Theme.text)
            Spacer()
            if let trailing {
                Text(trailing)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Theme.textMuted)
            }
        }
    }
}

// MARK: - Pill / badge

struct Pill: View {
    let text: String
    var color: Color = Theme.primary
    var filled: Bool = false
    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(filled ? .white : color)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(filled ? color : color.opacity(0.12))
            .clipShape(.capsule)
    }
}

// MARK: - Speak button

struct SpeakButton: View {
    let text: String
    var size: CGFloat = 28
    var body: some View {
        Button {
            NaturalVoice.shared.speak(text)
        } label: {
            Image(systemName: "speaker.wave.2.fill")
                .font(.system(size: size * 0.5))
                .foregroundStyle(Theme.primary)
                .frame(width: size, height: size)
                .background(Theme.primaryLight)
                .clipShape(.circle)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Rich gloss detail

/// A compact grammar/tag chip in the surface's accent color.
struct GrammarChip: View {
    let text: String
    var accent: Color = Theme.primary
    var body: some View {
        Text(text)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(accent)
            .padding(.horizontal, 9).padding(.vertical, 4)
            .background(accent.opacity(0.12), in: Capsule())
            .overlay(Capsule().stroke(accent.opacity(0.22), lineWidth: 0.5))
    }
}

/// A light, sound-it-out phonetic line shown directly under the main word at
/// the top of a translation card (e.g. "re-nou-VELLE-ah-bel").
struct PhoneticLine: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.system(size: 14, weight: .regular))
            .foregroundStyle(Theme.textMuted)
            .tracking(0.3)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// The shared body of a translation card: plain-English explanation, grammar
/// facts, other meanings, and tappable related words / similar phrases. Each
/// section only renders when it has content, so the card stays clean for simple
/// words. The phonetic now lives under the word header, not here.
struct GlossRichDetail: View {
    let gloss: WordGloss
    var accent: Color = Theme.primary
    /// When provided, related words / similar phrases become tappable and call
    /// this with the tapped term so the host can open a fresh card for it.
    var onTermTap: ((String) -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if !gloss.explanation.isEmpty {
                Text(gloss.explanation)
                    .font(.system(size: 14)).foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if gloss.hasGrammar { grammarSection }
            if !gloss.otherMeanings.isEmpty {
                section("OTHER MEANINGS") {
                    VStack(alignment: .leading, spacing: 5) {
                        ForEach(gloss.otherMeanings, id: \.self) { meaning in
                            HStack(alignment: .firstTextBaseline, spacing: 7) {
                                Circle().fill(accent.opacity(0.6)).frame(width: 4, height: 4)
                                Text(meaning).font(.system(size: 14)).foregroundStyle(Theme.textSecondary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                }
            }
            if !gloss.similarPhrases.isEmpty {
                section("PHRASES WITH SIMILAR MEANING") {
                    termChips(gloss.similarPhrases)
                }
            } else if !gloss.relatedWords.isEmpty {
                section("RELATED WORDS") {
                    termChips(gloss.relatedWords)
                }
            }
        }
    }

    @ViewBuilder
    private func termChips(_ terms: [String]) -> some View {
        FlowLayout(spacing: 6, lineSpacing: 6) {
            ForEach(terms, id: \.self) { term in
                if let onTermTap {
                    Button { Haptics.tap(); onTermTap(term) } label: {
                        chipLabel(term, tappable: true)
                    }
                    .buttonStyle(.plain)
                } else {
                    chipLabel(term, tappable: false)
                }
            }
        }
    }

    private func chipLabel(_ term: String, tappable: Bool) -> some View {
        HStack(spacing: 4) {
            Text(term)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(accent)
            if tappable {
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(accent.opacity(0.7))
            }
        }
        .padding(.horizontal, 10).padding(.vertical, 5)
        .background(accent.opacity(tappable ? 0.12 : 0.10), in: Capsule())
        .overlay(Capsule().stroke(accent.opacity(tappable ? 0.22 : 0), lineWidth: 0.5))
    }

    private var grammarSection: some View {
        section("GRAMMAR") {
            VStack(alignment: .leading, spacing: 8) {
                FlowLayout(spacing: 6, lineSpacing: 6) {
                    if !gloss.partOfSpeech.isEmpty { GrammarChip(text: gloss.partOfSpeech, accent: accent) }
                    if !gloss.gender.isEmpty { GrammarChip(text: gloss.gender, accent: accent) }
                    if !gloss.article.isEmpty { GrammarChip(text: gloss.article, accent: accent) }
                    if !gloss.register.isEmpty { GrammarChip(text: gloss.register, accent: accent) }
                }
                if !gloss.baseForm.isEmpty {
                    HStack(spacing: 5) {
                        Text("Base form:").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.textMuted)
                        Text(gloss.baseForm).font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.text)
                        if !gloss.baseFormNote.isEmpty {
                            Text("· \(gloss.baseFormNote)").font(.system(size: 13)).foregroundStyle(Theme.textMuted)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }
        }
    }

    private func section<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.textMuted)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Tappable translation card navigation

/// A destination for navigating between translation cards (related word or
/// similar-phrase taps). `context` is the surrounding sentence when known.
struct WordRoute: Hashable {
    let term: String
    let context: String
}

/// A fully self-contained translation card used when the user taps a related
/// word or similar phrase. It loads its own gloss, shows the phonetic under the
/// word, renders the rich detail (with its own tappable chips so you can keep
/// drilling in), an example, and a Save-to-deck button. Pushed inside a
/// NavigationStack so the system back button steps through the card history.
struct TranslationCardView: View {
    let route: WordRoute
    var accent: Color = Theme.primary
    let sourceType: SourceType
    let sourceTab: String
    /// Push a deeper card onto the host navigation stack.
    let onPush: (WordRoute) -> Void

    @Environment(AppStore.self) private var store
    @State private var gloss: WordGloss? = nil
    @State private var isLoading = true
    @State private var saved = false

    private var alreadySaved: Bool {
        let key = route.term.lowercased()
        return saved || store.gaps.contains { $0.frenchWord.lowercased() == key }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                if isLoading {
                    loadingState
                } else if let g = gloss {
                    GlossRichDetail(gloss: g, accent: accent, onTermTap: { onPush(WordRoute(term: $0, context: "")) })
                    if !g.example.isEmpty { exampleBlock(g) }
                }
                saveButton
            }
            .padding(.horizontal, 22).padding(.top, 18).padding(.bottom, 28)
        }
        .background(Theme.background)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            gloss = await TranslationService.gloss(for: route.term, context: route.context)
            isLoading = false
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(route.term).font(.serifDisplay(26, weight: .bold)).foregroundStyle(Theme.text)
                if let g = gloss, !g.pronunciation.isEmpty {
                    PhoneticLine(text: g.pronunciation)
                }
                if let g = gloss, !g.translation.isEmpty {
                    Text(g.translation).font(.system(size: 15, weight: .medium)).foregroundStyle(accent)
                }
            }
            Spacer()
            HStack(spacing: 8) {
                Button { Haptics.tap(); NaturalVoice.shared.speak(route.term, rate: 0.6) } label: {
                    Image(systemName: "tortoise.fill").font(.system(size: 14)).foregroundStyle(accent)
                        .frame(width: 38, height: 38).background(accent.opacity(0.10)).clipShape(.circle)
                }
                .buttonStyle(.plain)
                Button { Haptics.tap(); NaturalVoice.shared.speak(route.term) } label: {
                    Image(systemName: "speaker.wave.2.fill").font(.system(size: 18)).foregroundStyle(accent)
                        .frame(width: 46, height: 46).background(accent.opacity(0.12)).clipShape(.circle)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var loadingState: some View {
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
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func exampleBlock(_ g: WordGloss) -> some View {
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

    private var saveButton: some View {
        Button {
            guard let g = gloss, !alreadySaved else { return }
            save(g)
        } label: {
            Label(alreadySaved ? "Saved to Deck" : "Save to Deck",
                  systemImage: alreadySaved ? "checkmark.circle.fill" : "plus.circle.fill")
                .font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                .frame(maxWidth: .infinity).padding(.vertical, 15)
                .background(alreadySaved ? Theme.success : accent).clipShape(.rect(cornerRadius: Radius.chip))
        }
        .buttonStyle(.plain)
        .disabled(isLoading || alreadySaved)
        .opacity(isLoading ? 0.6 : 1)
    }

    private func save(_ g: WordGloss) {
        let now = Date()
        let gap = GapItem(
            id: UUID().uuidString,
            frenchWord: g.term,
            englishTranslation: g.translation,
            explanation: g.explanation,
            exampleSentence: g.example.isEmpty ? route.context : g.example,
            exampleTranslation: g.exampleTranslation,
            pronunciation: g.pronunciation.isEmpty ? nil : g.pronunciation,
            sourceType: sourceType,
            category: g.isPhrase ? .phrasing : .vocabulary,
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
            originalContext: OriginalContext(sentence: route.context, translation: nil, sourceTab: sourceTab, capturedAt: now, reExposureCount: 0),
            confusionLinks: [],
            partOfSpeech: g.partOfSpeech.isEmpty ? nil : g.partOfSpeech,
            gender: g.gender.isEmpty ? nil : g.gender,
            article: g.article.isEmpty ? nil : g.article,
            baseForm: g.baseForm.isEmpty ? nil : g.baseForm,
            register: g.register.isEmpty ? nil : g.register,
            relatedWords: g.relatedWords.isEmpty ? nil : g.relatedWords
        )
        store.addGap(gap)
        saved = true
        Haptics.success()
    }
}

// MARK: - Progress bar

struct ThinProgressBar: View {
    let progress: Double
    var tint: Color = Theme.primary
    var width: CGFloat = 40
    var body: some View {
        ZStack(alignment: .leading) {
            Capsule().fill(Theme.border).frame(width: width, height: 4)
            Capsule().fill(tint).frame(width: width * min(1, max(0, progress)), height: 4)
        }
    }
}

// MARK: - Press scale feedback

struct PressableCard: ViewModifier {
    var scale: CGFloat = 0.97
    @State private var pressed = false
    func body(content: Content) -> some View {
        content
            .scaleEffect(pressed ? scale : 1)
            .opacity(pressed ? 0.96 : 1)
            .animation(.spring(response: 0.32, dampingFraction: 0.65), value: pressed)
            .simultaneousGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in pressed = true }
                    .onEnded { _ in pressed = false }
            )
    }
}

extension View {
    func pressable(scale: CGFloat = 0.97) -> some View { modifier(PressableCard(scale: scale)) }
}

// MARK: - Skeleton / shimmer loaders

/// A soft sweeping shimmer used on placeholder surfaces while content loads.
struct Shimmer: ViewModifier {
    @State private var phase: CGFloat = -1
    var tint: Color = .white
    func body(content: Content) -> some View {
        content
            .overlay {
                GeometryReader { geo in
                    LinearGradient(
                        colors: [.clear, tint.opacity(0.55), .clear],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    )
                    .frame(width: geo.size.width * 1.4)
                    .offset(x: phase * geo.size.width * 1.6)
                    .allowsHitTesting(false)
                }
            }
            .onAppear {
                withAnimation(.linear(duration: 1.25).repeatForever(autoreverses: false)) {
                    phase = 1
                }
            }
    }
}

extension View {
    func shimmer(tint: Color = .white) -> some View { modifier(Shimmer(tint: tint)) }
}

/// A single rounded placeholder block. Use `dark` on dark backgrounds (Watch).
struct SkeletonBlock: View {
    var width: CGFloat? = nil
    var height: CGFloat = 14
    var cornerRadius: CGFloat = 8
    var dark: Bool = false
    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius)
            .fill(dark ? Color.white.opacity(0.08) : Theme.backgroundTertiary.opacity(0.7))
            .frame(width: width, height: height)
            .frame(maxWidth: width == nil ? .infinity : nil)
            .shimmer(tint: dark ? .white.opacity(0.12) : .white)
    }
}

// MARK: - Haptics

enum Haptics {
    /// Light tactile tap for navigation / selection feedback.
    static func tap() {
        let generator = UIImpactFeedbackGenerator(style: .soft)
        generator.impactOccurred()
    }

    /// Slightly firmer tap for committing to an action (start lesson, etc.).
    static func select() {
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()
    }

    /// Success notification for completed/refresh moments.
    static func success() {
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
    }
}
