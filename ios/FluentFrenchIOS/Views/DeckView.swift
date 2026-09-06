//
//  DeckView.swift
//  FluentFrenchIOS
//
//  "My Gaps" — categories, SRS review entry, gap cards, mastered list.
//  Mirrors the Expo deck screen's structure and teal-gradient header.
//
//  Every list and count reads `store.visibleGaps` (probes never show, A13); the
//  only "due" numbers are `store.dueNow` ("Due now") and `store.upcoming`
//  ("Coming up") (D13); an entry point with nothing to practice shows the
//  selector's own headline instead of silently doing nothing (C23).
//

import SwiftUI

struct DeckView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// 1 at the default text size; the square icon badges grow with it so the
    /// glyph inside keeps its padding.
    @ScaledMetric private var typeScale: CGFloat = 1
    @State private var selectedCategory: GapCategory? = nil
    @State private var showMastered = false
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

    private var dueNowCount: Int { store.dueNow.count }
    private var upcomingCount: Int { store.upcoming.count }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    header
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
        GradientHeader(gradient: Theme.tealGradient, title: "My Gaps", subtitle: "Practice your weak spots until mastery") {
            EmptyView()
        }
        .frame(minHeight: 190)
        .overlay(alignment: .bottomLeading) {
            HStack(spacing: 20) {
                HeaderStat(systemImage: "clock.badge.exclamationmark", value: "\(dueNowCount)", label: "Due now")
                Rectangle().fill(Color.white.opacity(0.25)).frame(width: 1, height: 28)
                HeaderStat(systemImage: "calendar", value: "\(upcomingCount)", label: "Coming up")
                Rectangle().fill(Color.white.opacity(0.25)).frame(width: 1, height: 28)
                HeaderStat(systemImage: "rosette", value: "\(store.masteredGaps.count)", label: "Mastered")
            }
            .accessibilityElement(children: .combine)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color.white.opacity(0.15))
            .clipShape(.rect(cornerRadius: 12))
            .padding(.leading, 24)
            .padding(.bottom, 18)
        }
    }

    private var srsCard: some View {
        let due = dueNowCount
        let soon = upcomingCount
        return VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                Image(systemName: "brain.head.profile")
                    .scaledFont(22).foregroundStyle(Color(hex: "C7D2FE"))
                    .frame(width: Theme.minimumHitTarget * typeScale, height: Theme.minimumHitTarget * typeScale)
                    .background(Color.white.opacity(0.12)).clipShape(.rect(cornerRadius: 14))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Spaced Repetition").scaledFont(17, weight: .bold).foregroundStyle(Color(hex: "E0E7FF"))
                    Text("\(due) due now · \(soon) coming up").font(.footnote).foregroundStyle(Color(hex: "E0E7FF").opacity(0.9))
                }
                .accessibilityElement(children: .combine)
                Spacer()
                Text("\(due)")
                    .scaledFont(13, weight: .heavy).foregroundStyle(.white)
                    .padding(.horizontal, 9).padding(.vertical, 5)
                    .background(due > 0 ? Theme.error : Color.white.opacity(0.2)).clipShape(.capsule)
                    .accessibilityLabel("\(due) due now")
            }
            Button {
                startScoped(due > 0 ? .dueNow : .reviewQueue)
            } label: {
                HStack {
                    Spacer()
                    Text(due > 0 ? "Review due now" : "Review what's coming up").scaledFont(16, weight: .bold).foregroundStyle(Color(hex: "312E81"))
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
            .accessibilityHint(due > 0 ? "Starts a review of the cards due today"
                                       : "Starts an early review of what is coming up")
        }
        .padding(Space.xl)
        .background(Theme.indigoGradient)
        .clipShape(.rect(cornerRadius: Radius.card))
        .softLift(radius: 18, y: 8)
    }

    private var practiceSection: some View {
        let due = dueNowCount
        let healthy = Tuning.gapHealthHealthyFloor
        let attention = Tuning.gapHealthAttentionFloor
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                let h = store.gapHealth
                HStack(spacing: 6) {
                    Circle().fill(h.score >= healthy ? Theme.success : h.score >= attention ? Theme.warning : Theme.error).frame(width: 6, height: 6)
                        .accessibilityHidden(true)
                    Text(h.label).font(.caption.weight(.semibold))
                        .foregroundStyle(h.score >= healthy ? Color(hex: "065F46") : h.score >= attention ? Color(hex: "92400E") : Color(hex: "991B1B"))
                }
                .padding(.horizontal, 10).padding(.vertical, 5)
                .background(h.score >= healthy ? Color(hex: "D1FAE5") : h.score >= attention ? Color(hex: "FEF3C7") : Color(hex: "FEE2E2"))
                .clipShape(.rect(cornerRadius: 8))
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Gap health: \(h.label)")
                if due > 0 {
                    Text("\(due) due now").font(.caption2.weight(.semibold)).foregroundStyle(Color(hex: "DC2626"))
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(Color(hex: "FEE2E2")).clipShape(.rect(cornerRadius: 6))
                }
                Spacer()
            }

            Button {
                startScoped(due > 0 ? .dueNow : .mixed)
            } label: {
                HStack(spacing: 14) {
                    Image(systemName: "bolt.fill").scaledFont(18).foregroundStyle(.white)
                        .frame(width: 40 * Theme.chromeScale(typeScale), height: 40 * Theme.chromeScale(typeScale))
                        .background(Color.white.opacity(0.2)).clipShape(.rect(cornerRadius: 12))
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(due > 0 ? "Review due now" : "Start Practice")
                            .scaledFont(16, weight: .semibold).foregroundStyle(.white)
                        Text(due > 0 ? "\(due) card\(due == 1 ? "" : "s") due now" : "Mixed review of all categories")
                            .font(.footnote).foregroundStyle(.white.opacity(0.9))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer()
                    Image(systemName: "chevron.right").foregroundStyle(.white)
                        .accessibilityHidden(true)
                }
                .padding(Space.lg)
                .background(due > 0 ? Theme.error : Theme.primary)
                .clipShape(.rect(cornerRadius: Radius.card))
                .softLift(radius: 14, y: 6, strength: 0.8)
            }
            .buttonStyle(.plain)
            .pressable()
            .accessibilityHint("Starts a practice session")
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
                                Text("\(s.active) active · \(s.mastered) mastered").scaledFont(12).foregroundStyle(Theme.textSecondary)
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
                    .accessibilityHint("Filters the gaps below by this category")
                }
            }
        }
    }

    private var gapsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: selectedCategory?.label ?? "All Gaps", trailing: "\(displayedGaps.count) gaps")
            if displayedGaps.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "square.stack.3d.up").scaledFont(32).foregroundStyle(Theme.textSecondary)
                        .frame(width: 64 * Theme.chromeScale(typeScale), height: 64 * Theme.chromeScale(typeScale))
                        .background(Theme.backgroundSecondary).clipShape(.circle)
                        .accessibilityHidden(true)
                    Text("No gaps yet").font(.headline).foregroundStyle(Theme.text)
                    Text(selectedCategory == nil
                         ? "Your lessons and captures fill this deck as you go."
                         : "Nothing in \(selectedCategory?.label ?? "this category") yet — capture words while reading or speaking.")
                        .font(.subheadline).foregroundStyle(Theme.textSecondary).multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity).padding(.vertical, 40)
                .accessibilityElement(children: .combine)
            } else {
                LazyVStack(spacing: 10) {
                    ForEach(displayedGaps.prefix(Tuning.deckPreviewCount)) { gap in
                        GapCardView(gap: gap)
                    }
                }
                // The header counts the whole filter, so the rest of the deck has
                // to be reachable — the preview is never the only way in.
                if displayedGaps.count > Tuning.deckPreviewCount {
                    NavigationLink {
                        AllGapsView(category: selectedCategory)
                    } label: {
                        HStack {
                            Text("See all \(displayedGaps.count)")
                                .scaledFont(14, weight: .semibold).foregroundStyle(Theme.primary)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .scaledFont(13).foregroundStyle(Theme.primary)
                                .accessibilityHidden(true)
                        }
                        .padding(.horizontal, 14)
                        .frame(minHeight: Theme.minimumHitTarget)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("See all \(displayedGaps.count) gaps")
                    .accessibilityHint("Opens the full list")
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

// MARK: - Full gap list

/// The whole deck behind the "See all" row: every gap in the current filter,
/// built lazily so a Foundation learner's several-hundred-card deck scrolls
/// instead of being constructed up front. Reads the store live so a card that is
/// answered or mastered elsewhere disappears from here too.
struct AllGapsView: View {
    @Environment(AppStore.self) private var store
    /// nil = the unfiltered deck.
    let category: GapCategory?

    private var gaps: [GapItem] {
        if let category { return store.gaps(in: category) }
        return store.visibleGaps
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 10) {
                ForEach(gaps) { gap in
                    GapCardView(gap: gap)
                }
            }
            .padding(20)
        }
        .background(Theme.background)
        .navigationTitle(category?.label ?? "All Gaps")
        .navigationBarTitleDisplayMode(.inline)
    }
}
