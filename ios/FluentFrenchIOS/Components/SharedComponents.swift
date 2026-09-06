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
                            .frame(minWidth: 44, minHeight: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Back")
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
                .frame(minWidth: 44, minHeight: 44)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Listen")
        .accessibilityHint("Reads the French aloud")
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
/// Every lookup outcome is explicit: loading (bounded), a gloss, or a named
/// failure with a retry — and a failed lookup can still be saved for later.
struct TranslationCardView: View {
    let route: WordRoute
    var accent: Color = Theme.primary
    let sourceType: SourceType
    let sourceTab: String
    /// Push a deeper card onto the host navigation stack.
    let onPush: (WordRoute) -> Void
    /// The level of the material the word came from (nil → the learner's level).
    var sourceLevel: CEFRLevel? = nil

    @Environment(AppStore.self) private var store
    @State private var lookup: LookupState = .loading
    @State private var attempt = 0

    private var alreadySaved: Bool {
        store.hasGap(forWord: route.term)
    }

    private var draft: CaptureDraft? {
        switch lookup {
        case .loading: return nil
        case .loaded(let g):
            return CaptureDraft(gloss: g, sourceType: sourceType, sourceTab: sourceTab,
                                contextSentence: route.context, sourceLevel: sourceLevel)
        case .failed:
            return CaptureDraft(untranslated: route.term, sourceType: sourceType, sourceTab: sourceTab,
                                contextSentence: route.context, sourceLevel: sourceLevel)
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                switch lookup {
                case .loading:
                    LookupLoadingView(accent: accent)
                case .loaded(let g):
                    GlossRichDetail(gloss: g, accent: accent, onTermTap: { onPush(WordRoute(term: $0, context: "")) })
                    if !g.example.isEmpty { exampleBlock(g) }
                case .failed(let failure):
                    LookupUnavailableView(failure: failure, accent: accent, onRetry: { attempt += 1 })
                }
                SaveToDeckButton(draft: draft, accent: accent, alreadySaved: alreadySaved, isBusy: lookup == .loading)
            }
            .padding(.horizontal, 22).padding(.top, 18).padding(.bottom, 28)
        }
        .background(Theme.background)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: attempt) {
            lookup = .loading
            let result = await TranslationService.lookup(term: route.term, context: route.context)
            lookup = LookupState(result)
            if case .gloss = result, !store.pendingTranslations.isEmpty {
                await store.resolvePendingTranslations(using: TranslationService.lookup(term:context:))
            }
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(route.term).font(.serifDisplay(26, weight: .bold)).foregroundStyle(Theme.text)
                if case .loaded(let g) = lookup {
                    if !g.pronunciation.isEmpty { PhoneticLine(text: g.pronunciation) }
                    Text(g.translation).font(.system(size: 15, weight: .medium)).foregroundStyle(accent)
                }
            }
            Spacer()
            HStack(spacing: 8) {
                Button { Haptics.tap(); NaturalVoice.shared.speak(route.term, rate: 0.6) } label: {
                    Image(systemName: "tortoise.fill").font(.system(size: 14)).foregroundStyle(accent)
                        .frame(width: 44, height: 44).background(accent.opacity(0.10)).clipShape(.circle)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Listen slowly")
                Button { Haptics.tap(); NaturalVoice.shared.speak(route.term) } label: {
                    Image(systemName: "speaker.wave.2.fill").font(.system(size: 18)).foregroundStyle(accent)
                        .frame(width: 46, height: 46).background(accent.opacity(0.12)).clipShape(.circle)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Listen")
            }
        }
    }

    private func exampleBlock(_ g: WordGloss) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Text("Example").font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.textMuted)
                Button { Haptics.tap(); NaturalVoice.shared.speak(g.example) } label: {
                    Image(systemName: "speaker.wave.2").font(.system(size: 13)).foregroundStyle(accent)
                        .frame(minWidth: 44, minHeight: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Listen to the example")
                Button { Haptics.tap(); NaturalVoice.shared.speak(g.example, rate: 0.6) } label: {
                    Image(systemName: "tortoise.fill").font(.system(size: 12)).foregroundStyle(accent.opacity(0.8))
                        .frame(minWidth: 44, minHeight: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Listen to the example slowly")
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

// MARK: - Lookup states (shared by every translation surface — E26)

/// The three explicit states of a word lookup. No surface shows a spinner
/// without a bound, and no failure is silent.
enum LookupState: Equatable {
    case loading
    case loaded(WordGloss)
    case failed(TranslationFailure)

    init(_ result: GlossLookup) {
        switch result {
        case .gloss(let g): self = .loaded(g)
        case .unavailable(let f): self = .failed(f)
        }
    }

    var gloss: WordGloss? {
        if case .loaded(let g) = self { return g }
        return nil
    }
}

/// Skeleton + "Looking it up…" shown while a lookup is in flight. The request
/// itself is bounded by `Tuning.glossTimeoutSeconds`, so this never runs forever.
struct LookupLoadingView: View {
    var accent: Color = Theme.primary
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SkeletonBlock(width: 180, height: 16)
            SkeletonBlock(height: 14)
            SkeletonBlock(width: 140, height: 14)
            HStack(spacing: 8) {
                ProgressView().tint(accent).scaleEffect(0.8)
                Text("Looking it up…").font(.footnote).foregroundStyle(Theme.textMuted)
            }
            .padding(.top, 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Looking it up")
    }
}

/// An explicit, learner-facing failure card: what went wrong, what to do, and a
/// retry when a retry could help (a missing key never gets one).
struct LookupUnavailableView: View {
    let failure: TranslationFailure
    var accent: Color = Theme.primary
    var onRetry: (() -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: icon).font(.subheadline.weight(.bold)).foregroundStyle(Theme.warning)
                Text(failure.title).font(.subheadline.weight(.bold)).foregroundStyle(Theme.text)
            }
            Text(failure.message).font(.footnote).foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            if failure.isRetryable, let onRetry {
                Button { Haptics.tap(); onRetry() } label: {
                    Label("Try again", systemImage: "arrow.clockwise")
                        .font(.subheadline.weight(.semibold)).foregroundStyle(accent)
                        .frame(minHeight: 44)
                }
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Theme.warningLight)
        .clipShape(.rect(cornerRadius: Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.warning.opacity(0.25), lineWidth: 1))
    }

    private var icon: String {
        switch failure {
        case .notConfigured: return "key.slash"
        case .offline: return "wifi.slash"
        case .serviceError: return "exclamationmark.triangle.fill"
        }
    }
}

// MARK: - Save to deck (the ONE capture affordance — E4 / E6 / E25)

/// The save button every capture surface uses. It is disabled until there is
/// something real to save (`draft == nil` while a lookup is in flight), offers
/// "Save now, translate later" when the draft has no meaning yet, and reports
/// "Saved" / "Already in your deck" from the store's own outcome — the store,
/// not the view, dedupes and builds the gap.
struct SaveToDeckButton: View {
    let draft: CaptureDraft?
    var accent: Color = Theme.primary
    var alreadySaved: Bool = false
    var isBusy: Bool = false
    var onSaved: ((CaptureOutcome) -> Void)? = nil

    @Environment(AppStore.self) private var store
    @State private var outcome: CaptureOutcome? = nil

    private var isDone: Bool {
        if alreadySaved { return true }
        switch outcome {
        case .saved?, .duplicate?: return true
        default: return false
        }
    }

    private var title: String {
        if case .duplicate? = outcome { return "Already in your deck" }
        if isDone { return "Saved to deck" }
        if isBusy || draft == nil { return "Save to my deck" }
        if draft?.needsTranslation == true { return "Save now, translate later" }
        return "Save to my deck"
    }

    private var symbol: String {
        if isDone { return "checkmark.circle.fill" }
        if draft?.needsTranslation == true { return "clock.badge.checkmark" }
        return "plus.circle.fill"
    }

    private var isDisabled: Bool { isDone || isBusy || draft == nil }

    var body: some View {
        Button {
            guard let draft, !isDisabled else { return }
            let result = store.capture(draft)
            outcome = result
            if case .saved = result { Haptics.success() } else { Haptics.tap() }
            onSaved?(result)
        } label: {
            Label(title, systemImage: symbol)
                .font(.body.weight(.bold)).foregroundStyle(.white)
                .frame(maxWidth: .infinity).frame(minHeight: 50)
                .background(isDone ? Theme.success : accent)
                .clipShape(.rect(cornerRadius: 14))
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .opacity(isDisabled && !isDone ? 0.55 : 1)
        .accessibilityHint(draft?.needsTranslation == true ? "Saves the word without a meaning; it is translated once translation is available" : "")
    }
}

/// A small capture card for reference content whose meaning is already known
/// (idioms, tenses, accent words — E25): shows the French, the meaning, the
/// example and a note field, then saves through `SaveToDeckButton`.
struct CaptureSheet: View {
    let draft: CaptureDraft
    var accent: Color = Theme.primary

    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var note = ""

    private var draftWithNote: CaptureDraft {
        var d = draft
        d.note = note
        return d
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                HStack(alignment: .top, spacing: 10) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(draft.frenchWord)
                            .font(.serifDisplay(draft.frenchWord.count > 22 ? 22 : 28, weight: .bold))
                            .foregroundStyle(accent)
                            .fixedSize(horizontal: false, vertical: true)
                        if let p = draft.pronunciation, !p.isEmpty { PhoneticLine(text: p) }
                    }
                    Spacer()
                    SpeakButton(text: draft.frenchWord, size: 38)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text("MEANING").font(.caption.weight(.bold)).foregroundStyle(Theme.textMuted)
                    Text(draft.englishTranslation).font(.headline).foregroundStyle(Theme.text)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if !draft.explanation.isEmpty {
                    Text(draft.explanation).font(.subheadline).foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if !draft.exampleSentence.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 8) {
                            Text("Example").font(.caption.weight(.bold)).foregroundStyle(accent)
                            SpeakButton(text: draft.exampleSentence, size: 28)
                        }
                        Text(draft.exampleSentence).font(.body.weight(.medium)).italic().foregroundStyle(Theme.text)
                            .fixedSize(horizontal: false, vertical: true)
                        if !draft.exampleTranslation.isEmpty {
                            Text(draft.exampleTranslation).font(.subheadline).foregroundStyle(Theme.textMuted)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(Space.lg)
                    .background(accent.opacity(0.07))
                    .clipShape(.rect(cornerRadius: Radius.card))
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text("PERSONAL NOTE").font(.caption.weight(.bold)).foregroundStyle(Theme.textMuted)
                    TextField("Add a memory hook (optional)", text: $note, axis: .vertical)
                        .font(.body)
                        .lineLimit(1...3)
                        .padding(12)
                        .background(Theme.card)
                        .clipShape(.rect(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
                }
                Color.clear.frame(height: 8)
            }
            .padding(Space.xl)
            .padding(.top, 8)
        }
        .background(Theme.background)
        .safeAreaInset(edge: .bottom) {
            SaveToDeckButton(draft: draftWithNote, accent: accent, alreadySaved: store.hasGap(forWord: draft.frenchWord)) { outcome in
                if case .saved = outcome {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { dismiss() }
                }
            }
            .padding(.horizontal, Space.xl)
            .padding(.vertical, 12)
            .background(.ultraThinMaterial)
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
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
