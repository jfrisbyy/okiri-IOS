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
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(title)
                            .scaledSerifDisplay(32, weight: .bold)
                            .foregroundStyle(.white)
                            .accessibilityAddTraits(.isHeader)
                        Text(subtitle)
                            .scaledFont(15)
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

    /// The circular back-button chrome grows with the learner's text size so the
    /// chevron never spills out of it (1 pt scaled = the current type ratio).
    @ScaledMetric(relativeTo: .headline) private var typeScale: CGFloat = 1

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
                            .scaledFont(16, weight: .semibold, relativeTo: .headline).foregroundStyle(.white)
                            .frame(width: 36 * Theme.chromeScale(typeScale), height: 36 * Theme.chromeScale(typeScale))
                            .background(.white.opacity(0.16), in: Circle())
                            .overlay(Circle().stroke(.white.opacity(0.22), lineWidth: 0.5))
                            .minimumHitTarget()
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Back")
                    .accessibilityHint("Returns to the previous screen")
                    Spacer()
                    trailing
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).scaledSerifDisplay(28, weight: .bold).foregroundStyle(.white)
                        .accessibilityAddTraits(.isHeader)
                    Text(subtitle).scaledFont(14).foregroundStyle(.white.opacity(0.82))
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
                .scaledFont(15)
                .foregroundStyle(.white)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: -2) {
                Text(value).scaledFont(18, weight: .bold).foregroundStyle(.white)
                Text(label).scaledFont(11).foregroundStyle(.white.opacity(0.75))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label): \(value)")
    }
}

// MARK: - Section header

struct SectionHeader: View {
    let title: String
    var trailing: String? = nil
    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .scaledSerifDisplay(20, weight: .semibold)
                .foregroundStyle(Theme.text)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            if let trailing {
                Text(trailing)
                    .scaledFont(13, weight: .medium)
                    .foregroundStyle(Theme.textSecondary)
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
            .scaledFont(11, weight: .semibold)
            // Unfilled, the label sits on a 12% wash of its own hue, where a
            // bright brand colour can fall to ~2:1. Darken it until it reads.
            .foregroundStyle(filled ? .white : Theme.readableOnTint(color))
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
    /// The circular chrome grows with the type ratio so the glyph keeps its
    /// proportions at large text sizes.
    @ScaledMetric(relativeTo: .body) private var typeScale: CGFloat = 1
    /// Identifies this button's own utterance among all the speak buttons on screen.
    @State private var identity = UUID()

    /// True while this button's own audio is loading or sounding, so a second tap
    /// silences it instead of restarting a long passage from the top. Both reads
    /// are on the observable `NaturalVoice`, so the glyph and the accessibility
    /// label follow the audio — including when another surface stops it.
    private var isPlaying: Bool { NaturalVoice.shared.owner == identity && NaturalVoice.shared.isBusy }

    var body: some View {
        Button {
            if isPlaying {
                NaturalVoice.shared.stop()
            } else {
                NaturalVoice.shared.speak(text, owner: identity)
            }
        } label: {
            Image(systemName: isPlaying ? "stop.fill" : "speaker.wave.2.fill")
                .scaledFont(size * 0.5, relativeTo: .body)
                .foregroundStyle(Theme.primary)
                .frame(width: size * Theme.chromeScale(typeScale), height: size * Theme.chromeScale(typeScale))
                .background(Theme.primaryLight)
                .clipShape(.circle)
                .minimumHitTarget()
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isPlaying ? "Stop" : "Listen")
        .accessibilityHint(isPlaying ? "Stops the audio" : "Reads the French aloud")
    }
}

// MARK: - Rich gloss detail

/// A compact grammar/tag chip in the surface's accent color.
struct GrammarChip: View {
    let text: String
    var accent: Color = Theme.primary
    var body: some View {
        Text(text)
            .scaledFont(12, weight: .semibold)
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
            .scaledFont(14, weight: .regular)
            .foregroundStyle(Theme.textSecondary)
            .tracking(0.3)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityLabel("Pronounced \(text)")
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
                    .scaledFont(14).foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if gloss.hasGrammar { grammarSection }
            if !gloss.otherMeanings.isEmpty {
                section("OTHER MEANINGS") {
                    VStack(alignment: .leading, spacing: 5) {
                        ForEach(gloss.otherMeanings, id: \.self) { meaning in
                            HStack(alignment: .firstTextBaseline, spacing: 7) {
                                Circle().fill(accent.opacity(0.6)).frame(width: 4, height: 4)
                                    .accessibilityHidden(true)
                                Text(meaning).scaledFont(14).foregroundStyle(Theme.textSecondary)
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
                            .minimumHitTarget()
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(term)
                    .accessibilityHint("Opens a card for this word")
                } else {
                    chipLabel(term, tappable: false)
                }
            }
        }
    }

    private func chipLabel(_ term: String, tappable: Bool) -> some View {
        HStack(spacing: 4) {
            Text(term)
                .scaledFont(13, weight: .medium)
                .foregroundStyle(accent)
            if tappable {
                Image(systemName: "arrow.up.right")
                    .scaledFont(9, weight: .bold)
                    .foregroundStyle(accent.opacity(0.7))
                    .accessibilityHidden(true)
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
                    HStack(alignment: .firstTextBaseline, spacing: 5) {
                        Text("Base form:").scaledFont(13, weight: .semibold).foregroundStyle(Theme.textSecondary)
                        Text(gloss.baseForm).scaledFont(13, weight: .bold).foregroundStyle(Theme.text)
                        if !gloss.baseFormNote.isEmpty {
                            Text("· \(gloss.baseFormNote)").scaledFont(13).foregroundStyle(Theme.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .accessibilityElement(children: .combine)
                }
            }
        }
    }

    private func section<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).scaledFont(11, weight: .bold).foregroundStyle(Theme.textSecondary)
                .accessibilityAddTraits(.isHeader)
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
    /// Circular listen buttons grow with the learner's text size.
    @ScaledMetric(relativeTo: .body) private var typeScale: CGFloat = 1

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
                Text(route.term).scaledSerifDisplay(26, weight: .bold).foregroundStyle(Theme.text)
                    .accessibilityAddTraits(.isHeader)
                if case .loaded(let g) = lookup {
                    if !g.pronunciation.isEmpty { PhoneticLine(text: g.pronunciation) }
                    Text(g.translation).scaledFont(15, weight: .medium).foregroundStyle(accent)
                }
            }
            Spacer()
            HStack(spacing: 8) {
                Button { Haptics.tap(); NaturalVoice.shared.speak(route.term, rate: 0.6) } label: {
                    Image(systemName: "tortoise.fill").scaledFont(14, relativeTo: .body).foregroundStyle(accent)
                        .frame(width: 44 * Theme.chromeScale(typeScale), height: 44 * Theme.chromeScale(typeScale))
                        .background(accent.opacity(0.10)).clipShape(.circle)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Listen slowly")
                .accessibilityHint("Reads the word aloud at a slower pace")
                Button { Haptics.tap(); NaturalVoice.shared.speak(route.term) } label: {
                    Image(systemName: "speaker.wave.2.fill").scaledFont(18, relativeTo: .body).foregroundStyle(accent)
                        .frame(width: 46 * Theme.chromeScale(typeScale), height: 46 * Theme.chromeScale(typeScale))
                        .background(accent.opacity(0.12)).clipShape(.circle)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Listen")
                .accessibilityHint("Reads the word aloud")
            }
        }
    }

    private func exampleBlock(_ g: WordGloss) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Text("Example").scaledFont(11, weight: .bold).foregroundStyle(Theme.textSecondary)
                    .accessibilityAddTraits(.isHeader)
                Button { Haptics.tap(); NaturalVoice.shared.speak(g.example) } label: {
                    Image(systemName: "speaker.wave.2").scaledFont(13).foregroundStyle(accent)
                        .minimumHitTarget()
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Listen to the example")
                Button { Haptics.tap(); NaturalVoice.shared.speak(g.example, rate: 0.6) } label: {
                    Image(systemName: "tortoise.fill").scaledFont(12).foregroundStyle(accent.opacity(0.8))
                        .minimumHitTarget()
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Listen to the example slowly")
            }
            Text(g.example).scaledFont(15, weight: .semibold).foregroundStyle(Theme.text)
                .fixedSize(horizontal: false, vertical: true)
            if !g.exampleTranslation.isEmpty {
                Text(g.exampleTranslation).scaledFont(13).foregroundStyle(Theme.textSecondary)
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
                    .accessibilityHidden(true)
                Text(failure.title).font(.subheadline.weight(.bold)).foregroundStyle(Theme.text)
            }
            Text(failure.message).font(.footnote).foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            if failure.isRetryable, let onRetry {
                Button { Haptics.tap(); onRetry() } label: {
                    Label("Try again", systemImage: "arrow.clockwise")
                        .font(.subheadline.weight(.semibold)).foregroundStyle(accent)
                        .minimumHitTarget()
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Try again")
                .accessibilityHint("Looks the word up again")
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

    /// A draft the store would refuse (no letters, longer than
    /// `Tuning.maxCaptureWords` words, or running across a sentence): the button
    /// says so and stays disabled rather than silently doing nothing.
    private var isTooLong: Bool {
        guard let draft, !isDone else { return false }
        return !draft.isCapturable
    }

    private var title: String {
        if case .duplicate? = outcome { return "Already in your deck" }
        if isDone { return "Saved to deck" }
        if isBusy || draft == nil { return "Save to my deck" }
        if isTooLong { return "Too long to save as a card" }
        if draft?.needsTranslation == true { return "Save now, translate later" }
        return "Save to my deck"
    }

    private var symbol: String {
        if isDone { return "checkmark.circle.fill" }
        if isTooLong { return "exclamationmark.circle.fill" }
        if draft?.needsTranslation == true { return "clock.badge.checkmark" }
        return "plus.circle.fill"
    }

    private var isDisabled: Bool { isDone || isBusy || draft == nil || isTooLong }

    /// Says what the button will do — or why it cannot yet be used.
    private var hint: String {
        if isDone { return "This word is already in your deck" }
        if isBusy || draft == nil { return "Available once the lookup finishes" }
        if isTooLong {
            return "A card holds a word or a short phrase — up to \(Tuning.maxCaptureWords) words from one sentence"
        }
        if draft?.needsTranslation == true {
            return "Saves the word without a meaning; it is translated once translation is available"
        }
        return "Adds this word to your review deck"
    }

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
        .accessibilityLabel(title)
        .accessibilityHint(hint)
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
    @Environment(\.sizeCategory) private var sizeCategory
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
                            .font(Theme.scaledFontValue(
                                draft.frenchWord.count > 22 ? 22 : 28,
                                weight: .bold, design: .serif, for: sizeCategory
                            ))
                            .foregroundStyle(accent)
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityAddTraits(.isHeader)
                        if let p = draft.pronunciation, !p.isEmpty { PhoneticLine(text: p) }
                    }
                    Spacer()
                    SpeakButton(text: draft.frenchWord, size: 38)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text("MEANING").font(.caption.weight(.bold)).foregroundStyle(Theme.textSecondary)
                    if draft.needsTranslation {
                        Pill(text: "Translation pending", color: Theme.warning)
                    } else {
                        Text(draft.englishTranslation).font(.headline).foregroundStyle(Theme.text)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .accessibilityElement(children: .combine)
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
    /// What the bar measures, for VoiceOver. Hosts that already describe the bar
    /// in a combined element can leave this alone.
    var label: String = "Progress"

    private var clamped: Double { min(1, max(0, progress.isFinite ? progress : 0)) }

    var body: some View {
        ZStack(alignment: .leading) {
            Capsule().fill(Theme.border).frame(width: width, height: 4)
            Capsule().fill(tint).frame(width: width * clamped, height: 4)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue("\(Int((clamped * 100).rounded())) percent")
    }
}

// MARK: - Press scale feedback

struct PressableCard: ViewModifier {
    var scale: CGFloat = 0.97
    @State private var pressed = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func body(content: Content) -> some View {
        content
            .scaleEffect(pressed && !reduceMotion ? scale : 1)
            .opacity(pressed ? 0.96 : 1)
            .reducedMotionAnimation(.spring(response: 0.32, dampingFraction: 0.65), value: pressed)
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
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
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
                // A forever-repeating sweep is exactly what Reduce Motion asks us
                // to drop: the placeholder simply sits still instead.
                guard !reduceMotion else { return }
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
            .accessibilityHidden(true)
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
