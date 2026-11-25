//
//  DeckView.swift
//  FluentFrenchIOS
//
//  "My words" (UX-12) — categories, SRS review entry, word cards, mastered list.
//  Mirrors the Expo deck screen's structure and teal-gradient header.
//
//  Every list and count reads `store.visibleGaps` (probes never show, A13); the
//  only "due" numbers are `store.dueNow` ("Due now") and `store.upcoming`
//  ("Coming up") (D13); an entry point with nothing to practice shows the
//  selector's own headline instead of silently doing nothing (C23).
//

import SwiftUI

struct DeckView: View {
    /// Closes the deck back to Home (UX-03), from the deck's own header.
    let onClose: () -> Void
    @Environment(AppStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// 1 at the default text size; the square icon badges grow with it so the
    /// glyph inside keeps its padding.
    @ScaledMetric private var typeScale: CGFloat = 1
    @State private var selectedCategory: GapCategory? = nil
    @State private var showMastered = false
    /// The deck list shows `Tuning.deckPreviewCount` cards until the learner asks
    /// for the rest; the full list expands here rather than on a pushed screen.
    @State private var showAllGaps = false
    @State private var scopedLesson: AssembledLesson? = nil
    /// The selector's headline when a tapped entry point had nothing to offer.
    @State private var emptyHeadline: String? = nil

    /// Declare intent only: the store resolves the scope to candidates and the
    /// selector decides what, in what order, and why.
    private func startScoped(_ scope: SelectionScope) {
        Haptics.select()
        switch LessonPipeline(store: store).outcome(for: scope) {
        case .lesson(let lesson): scopedLesson = lesson
        case .empty(let headline): emptyHeadline = headline
        }
    }

    private var displayedGaps: [GapItem] {
        if let selectedCategory { return store.gaps(in: selectedCategory) }
        return store.visibleGaps
    }

    private var dueNowCount: Int { store.dueNowCount() }
    private var upcomingCount: Int { store.upcoming.count }
    /// The one rule Home's chip, the Learn card and the My words card follow
    /// (UX-15): before any card is reviewed the queue is the freshly seeded batch,
    /// and nothing here calls it "due".
    private var showsDueCount: Bool { store.showsDueCount }

    var body: some View {
        NavigationStack {
            // The header is pinned ABOVE the scroll view, as in Read, Speak and
            // Listen: My words is a full-screen cover with no swipe-back, so its one
            // way out must never scroll off screen (UX-03 re-review).
            VStack(spacing: 0) {
                header
                ScrollView {
                    VStack(spacing: 20) {
                        if dueNowCount > 0 || upcomingCount > 0 { srsCard }
                        if !store.visibleGaps.isEmpty { practiceSection }
                        categoriesSection
                        gapsSection
                        if !store.masteredGaps.isEmpty { masteredSection }
                    }
                    .padding(20)
                }
            }
            .background(Theme.background)
            .ignoresSafeArea(edges: .top)
            .navigationBarHidden(true)
            // A new filter starts from the preview again, so switching category
            // never drops the learner into the middle of a several-hundred-card list.
            .onChange(of: selectedCategory) { _, _ in showAllGaps = false }
            .fullScreenCover(item: $scopedLesson) { lesson in
                LessonView(gaps: lesson.gaps, assembled: lesson)
            }
            .alert("Nothing to practice", isPresented: Binding(
                get: { emptyHeadline != nil },
                set: { if !$0 { emptyHeadline = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(emptyHeadline ?? "")
            }
        }
    }

    private var header: some View {
        // The stat pill is the header's own bottom content, not an overlay on its
        // frame: overlaid, it was drawn on top of the bottom-anchored title and
        // subtitle. The close button is the header's own trailing control, laid
        // out beside the title, never over it (UX-03).
        GradientHeader(
            gradient: Theme.tealGradient,
            title: HomeCopy.myWordsTitle,
            subtitle: "Practice your weak spots until mastery",
            trailing: { SectionCloseButton(action: onClose) },
            bottom: {
                HStack(spacing: 20) {
                    HeaderStat(systemImage: showsDueCount ? "clock.badge.exclamationmark" : "square.stack.3d.up",
                               value: "\(dueNowCount)", label: HomeCopy.deckQueueLabel(showsDueCount: showsDueCount))
                    Rectangle().fill(Color.white.opacity(0.25)).frame(width: 1, height: 28)
                    HeaderStat(systemImage: "calendar", value: "\(upcomingCount)", label: HomeCopy.upcomingLabel)
                    Rectangle().fill(Color.white.opacity(0.25)).frame(width: 1, height: 28)
                    HeaderStat(systemImage: "rosette", value: "\(store.masteredGaps.count)", label: "Mastered")
                }
                .accessibilityElement(children: .combine)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(Color.white.opacity(0.15))
                .clipShape(.rect(cornerRadius: 12))
            }
        )
        .frame(minHeight: 190)
    }

    private var srsCard: some View {
        let due = dueNowCount
        let soon = upcomingCount
        let showsDue = showsDueCount
        let summary = HomeCopy.deckReviewSummary(due: due, upcoming: soon, showsDueCount: showsDue)
        return VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                Image(systemName: "brain.head.profile")
                    .scaledFont(22).foregroundStyle(Color(hex: "C7D2FE"))
                    .frame(width: Theme.minimumHitTarget * typeScale, height: Theme.minimumHitTarget * typeScale)
                    .background(Color.white.opacity(0.12)).clipShape(.rect(cornerRadius: 14))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Spaced Repetition").scaledFont(17, weight: .bold).foregroundStyle(Color(hex: "E0E7FF"))
                    Text(summary).font(.footnote).foregroundStyle(Color(hex: "E0E7FF").opacity(0.9))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .accessibilityElement(children: .combine)
                Spacer()
                Text("\(due)")
                    .scaledFont(13, weight: .heavy).foregroundStyle(.white)
                    .padding(.horizontal, 9).padding(.vertical, 5)
                    // Red only for a real backlog; the seeded batch is not one.
                    .background(due > 0 && showsDue ? Theme.error : Color.white.opacity(0.2)).clipShape(.capsule)
                    .accessibilityHidden(true)   // the summary beside it already says the number
            }
            Button {
                startScoped(due > 0 ? .dueNow : .reviewQueue)
            } label: {
                HStack {
                    Spacer()
                    Text(HomeCopy.deckReviewButton(due: due, showsDueCount: showsDue)).scaledFont(16, weight: .bold).foregroundStyle(Color(hex: "312E81"))
                        .multilineTextAlignment(.center)
                    Image(systemName: "chevron.right").scaledFont(14, weight: .bold).foregroundStyle(Color(hex: "312E81"))
                        .accessibilityHidden(true)
                    Spacer()
                }
                .padding(.vertical, 14)
                .frame(minHeight: Theme.minimumHitTarget)
                .background(Color(hex: "E0E7FF"))
                .clipShape(.rect(cornerRadius: Radius.card))
            }
            .buttonStyle(.plain)
            .pressable()
            .accessibilityHint(HomeCopy.deckReviewHint(due: due, showsDueCount: showsDue))
        }
        .padding(Space.xl)
        .background(Theme.indigoGradient)
        .clipShape(.rect(cornerRadius: Radius.card))
        .softLift(radius: 18, y: 8)
    }

    /// The health chip's dot, text and background for a tone.
    private func healthChipColors(_ tone: GapHealthTone) -> (dot: Color, text: Color, fill: Color) {
        switch tone {
        case .neutral: return (Theme.primary, Theme.primaryText, Theme.primaryLight)
        case .healthy: return (Theme.success, Color(hex: "065F46"), Color(hex: "D1FAE5"))
        case .attention: return (Theme.warning, Color(hex: "92400E"), Color(hex: "FEF3C7"))
        case .atRisk: return (Theme.error, Color(hex: "991B1B"), Color(hex: "FEE2E2"))
        }
    }

    private var practiceSection: some View {
        let due = dueNowCount
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                let h = store.gapHealth
                // No recall evidence → no health colour (firstrun-11-7, D19).
                let tone = GapHealthTone.tone(score: h.score, hasRetentionEvidence: store.hasRetentionEvidence)
                let colors = healthChipColors(tone)
                HStack(spacing: 6) {
                    Circle().fill(colors.dot).frame(width: 6, height: 6)
                        .accessibilityHidden(true)
                    Text(h.label).font(.caption.weight(.semibold))
                        .foregroundStyle(colors.text)
                }
                .padding(.horizontal, 10).padding(.vertical, 5)
                .background(colors.fill)
                .clipShape(.rect(cornerRadius: 8))
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Health: \(h.label)")
                if due > 0 && showsDueCount {
                    Text("\(due) due now").font(.caption2.weight(.semibold)).foregroundStyle(Color(hex: "DC2626"))
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(Color(hex: "FEE2E2")).clipShape(.rect(cornerRadius: 6))
                }
                Spacer()
            }

            // The due-now review lives on the SRS card above; this CTA is always the
            // mixed one, so the two adjacent buttons never carry the same label and
            // the same action.
            Button {
                startScoped(.mixed)
            } label: {
                HStack(spacing: 14) {
                    Image(systemName: "bolt.fill").scaledFont(18).foregroundStyle(.white)
                        .frame(width: 40 * Theme.chromeScale(typeScale), height: 40 * Theme.chromeScale(typeScale))
                        .background(Color.white.opacity(0.2)).clipShape(.rect(cornerRadius: 12))
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Mixed practice")
                            .scaledFont(16, weight: .semibold).foregroundStyle(.white)
                        Text("A mix across all categories")
                            .font(.footnote).foregroundStyle(.white.opacity(0.9))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer()
                    Image(systemName: "chevron.right").foregroundStyle(.white)
                        .accessibilityHidden(true)
                }
                .padding(Space.lg)
                .background(Theme.primary)
                .clipShape(.rect(cornerRadius: Radius.card))
                .softLift(radius: 14, y: 6, strength: 0.8)
            }
            .buttonStyle(.plain)
            .pressable()
            .accessibilityHint("Starts a mixed practice session across all categories")
        }
    }

    private var categoriesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Categories")
            VStack(spacing: 8) {
                ForEach(GapCategory.allCases) { category in
                    let s = store.stats(for: category)
                    let active = selectedCategory == category
                    Button {
                        selectedCategory = active ? nil : category
                    } label: {
                        HStack(spacing: 12) {
                            Capsule().fill(category.color).frame(width: 4, height: 28)
                                .accessibilityHidden(true)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(category.label).scaledFont(15, weight: .semibold)
                                    .foregroundStyle(active ? Theme.primaryDark : (s.active == 0 ? Theme.textSecondary : Theme.text))
                                Text(HomeCopy.categoryCounts(toLearn: s.active, mastered: s.mastered))
                                    .scaledFont(12).foregroundStyle(Theme.textSecondary)
                            }
                            Spacer()
                            if s.active > 0 {
                                // Nested inside the outer filter Button, so this is not a
                                // separate VoiceOver element: the equivalent action lives on
                                // the outer button as a custom accessibility action below.
                                Button {
                                    startScoped(.category(category))
                                } label: {
                                    Image(systemName: "play.fill").scaledFont(11).foregroundStyle(category.color)
                                        .frame(width: 28 * Theme.chromeScale(typeScale), height: 28 * Theme.chromeScale(typeScale))
                                        .background(category.color.opacity(0.12)).clipShape(.rect(cornerRadius: 8))
                                        .minimumHitTarget()
                                }
                                .buttonStyle(.plain)
                                .accessibilityHidden(true)
                            }
                        }
                        .padding(Space.lg)
                        .background(active ? Theme.primaryLight : Theme.card)
                        .clipShape(.rect(cornerRadius: Radius.card))
                        .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(active ? Theme.primary : Theme.border.opacity(0.5), lineWidth: active ? 1.5 : 0.5))
                        .softLift(radius: 10, y: 3, strength: 0.6)
                    }
                    .buttonStyle(.plain)
                    .pressable()
                    .accessibilityActions {
                        if s.active > 0 {
                            Button("Practice \(category.label)") { startScoped(.category(category)) }
                        }
                    }
                    .accessibilityAddTraits(active ? .isSelected : [])
                    .accessibilityHint("Filters the words below by this category")
                }
            }
        }
    }

    private var gapsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: selectedCategory?.label ?? "All words", trailing: "\(displayedGaps.count) word\(displayedGaps.count == 1 ? "" : "s")")
            if displayedGaps.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "square.stack.3d.up").scaledFont(32).foregroundStyle(Theme.textSecondary)
                        .frame(width: 64 * Theme.chromeScale(typeScale), height: 64 * Theme.chromeScale(typeScale))
                        .background(Theme.backgroundSecondary).clipShape(.circle)
                        .accessibilityHidden(true)
                    Text("No words yet").font(.headline).foregroundStyle(Theme.text)
                    Text(selectedCategory == nil
                         ? "Your lessons and captures fill \(HomeCopy.myWordsTitle) as you go."
                         : "Nothing in \(selectedCategory?.label ?? "this category") yet — capture words while reading or speaking.")
                        .font(.subheadline).foregroundStyle(Theme.textSecondary).multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity).padding(.vertical, 40)
                .accessibilityElement(children: .combine)
            } else {
                LazyVStack(spacing: 10) {
                    ForEach(showAllGaps ? displayedGaps : Array(displayedGaps.prefix(Tuning.deckPreviewCount))) { gap in
                        GapCardView(gap: gap)
                    }
                }
                // The header counts the whole filter, so the rest of the deck has to
                // be reachable — the preview is never the only way in. It expands in
                // place rather than pushing a screen: Home presents this view as a
                // full-screen cover that the header's close button leaves, so a
                // pushed list would need a back button of its own and the screen
                // would show two ways out — one back to the deck, one out of it
                // entirely — one back affordance per screen (UX-03).
                if displayedGaps.count > Tuning.deckPreviewCount {
                    Button {
                        Haptics.tap()
                        withAnimation(Theme.motion(.easeInOut, reduceMotion: reduceMotion)) { showAllGaps.toggle() }
                    } label: {
                        HStack {
                            Text(showAllGaps ? "Show fewer" : "See all \(displayedGaps.count)")
                                .scaledFont(14, weight: .semibold).foregroundStyle(Theme.primary)
                            Spacer()
                            Image(systemName: showAllGaps ? "chevron.up" : "chevron.down")
                                .scaledFont(13).foregroundStyle(Theme.primary)
                                .accessibilityHidden(true)
                        }
                        .padding(.horizontal, 14)
                        .frame(minHeight: Theme.minimumHitTarget)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(showAllGaps ? "Show fewer words" : "See all \(displayedGaps.count) words")
                    .accessibilityHint(showAllGaps
                                       ? "Collapses the list back to the first \(Tuning.deckPreviewCount)"
                                       : "Shows every word in this filter")
                }
            }
        }
    }

    private var masteredSection: some View {
        VStack(spacing: 0) {
            Button {
                withAnimation(Theme.motion(.easeInOut, reduceMotion: reduceMotion)) { showMastered.toggle() }
            } label: {
                HStack {
                    Image(systemName: "rosette").scaledFont(15).foregroundStyle(Theme.success)
                        .accessibilityHidden(true)
                    Text("Mastered (\(store.masteredGaps.count))").scaledFont(15, weight: .semibold).foregroundStyle(Theme.text)
                    Spacer()
                    Image(systemName: showMastered ? "chevron.up" : "chevron.down").foregroundStyle(Theme.textSecondary)
                        .accessibilityHidden(true)
                }
                .padding(14)
                .frame(minHeight: Theme.minimumHitTarget)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Mastered, \(store.masteredGaps.count)")
            .accessibilityValue(showMastered ? "Expanded" : "Collapsed")
            .accessibilityHint(showMastered ? "Hides the list" : "Shows the words you have mastered")
            if showMastered {
                VStack(spacing: 0) {
                    ForEach(store.masteredGaps) { gap in
                        HStack {
                            Text(gap.frenchWord).scaledFont(14, weight: .medium).foregroundStyle(Theme.success)
                            Spacer()
                            // Same "waiting for its meaning" state as the deck
                            // cards, so a pending capture never shows a blank.
                            if gap.needsTranslation || gap.englishTranslation.isEmpty {
                                Pill(text: "Translation pending", color: Theme.warning)
                            } else {
                                Text(gap.englishTranslation).scaledFont(13).foregroundStyle(Theme.textSecondary)
                                    .multilineTextAlignment(.trailing)
                            }
                        }
                        .padding(.vertical, 8)
                        .accessibilityElement(children: .combine)
                        Divider()
                    }
                }
                .padding(.horizontal, 14).padding(.bottom, 8)
            }
        }
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.border.opacity(0.5), lineWidth: 0.5))
        .softLift(radius: 10, y: 3, strength: 0.6)
    }
}
