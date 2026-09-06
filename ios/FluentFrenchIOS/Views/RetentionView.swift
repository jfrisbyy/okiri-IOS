//
//  RetentionView.swift
//  FluentFrenchIOS
//
//  Full retention breakdown with tabs for At risk / Fading / Fresh / New /
//  Mastered. Buckets come from `store.retention` (probes excluded); "New" lists
//  never-reviewed gaps (B4) — nothing to review, they are taught in lessons;
//  "Mastered" keeps its due-check button (B3). An empty review shows the
//  selector's headline instead of a dead tap (C23).
//

import SwiftUI

struct RetentionView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var tab: Tab = .atRisk
    @State private var scopedLesson: AssembledLesson? = nil
    /// The selector's headline when "Review these now" had nothing to offer.
    @State private var emptyHeadline: String? = nil

    enum Tab: String, CaseIterable, Identifiable {
        case atRisk = "At risk", fading = "Fading", fresh = "Fresh", new = "New", mastered = "Mastered"
        var id: String { rawValue }

        /// The selection scope this tab declares when the learner taps "Review these now".
        var bucket: RetentionBucket {
            switch self {
            case .atRisk: return .atRisk
            case .fading: return .fading
            case .fresh: return .fresh
            case .new: return .new
            case .mastered: return .mastered
            }
        }
    }

    private func bucketItems(_ t: Tab, in b: AppStore.RetentionBuckets) -> [GapItem] {
        switch t {
        case .atRisk: return b.atRisk
        case .fading: return b.fading
        case .fresh: return b.fresh
        case .new: return b.new.sorted { $0.nextReviewAt < $1.nextReviewAt }
        case .mastered: return b.mastered
        }
    }

    private var tint: Color {
        switch tab {
        case .atRisk: return Theme.error
        case .fading: return Theme.warning
        case .fresh: return Theme.success
        case .new: return Theme.primary
        case .mastered: return Theme.secondary
        }
    }

    /// Why a tab is empty — honest, per bucket.
    private var emptyCopy: String {
        switch tab {
        case .atRisk: return "Nothing is slipping right now."
        case .fading: return "Nothing is fading right now."
        case .fresh: return "No fresh recalls yet — review something and it lands here."
        case .new: return "No new cards waiting. Lessons and captures add them."
        case .mastered: return "Nothing mastered yet — \(Tuning.gapMasteryStreak) correct in a row earns the badge."
        }
    }

    var body: some View {
        // `store.retention` walks every gap, so the whole screen — the five tab
        // counts and the visible list — is derived from ONE bucketing per render.
        let buckets = store.retention
        let items = bucketItems(tab, in: buckets)
        return ScrollView {
            VStack(spacing: 16) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Tab.allCases) { t in
                            let count = bucketItems(t, in: buckets).count
                            Button {
                                withAnimation(Theme.motion(.default, reduceMotion: reduceMotion)) { tab = t }
                            } label: {
                                Text("\(t.rawValue) \(count)")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(tab == t ? .white : Theme.textSecondary)
                                    .padding(.horizontal, 14).padding(.vertical, 9)
                                    .frame(minHeight: Theme.minimumHitTarget)
                                    .background(tab == t ? Theme.primary : Theme.card)
                                    .clipShape(.capsule)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("\(t.rawValue), \(count) word\(count == 1 ? "" : "s")")
                            .accessibilityHint("Shows the words in this group")
                            .accessibilityAddTraits(tab == t ? [.isSelected, .isButton] : .isButton)
                        }
                    }
                    .padding(.horizontal, 20)
                }

                if items.isEmpty {
                    Text(emptyCopy).font(.subheadline).foregroundStyle(Theme.textSecondary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 32).padding(.vertical, 40)
                } else {
                    // Lazy: on day one "New" is every seeded Foundation card, and a
                    // plain VStack would build all of them before the screen appears.
                    LazyVStack(spacing: 10) {
                        ForEach(items) { gap in
                            retentionRow(gap)
                        }
                    }
                    .padding(.horizontal, 20)
                    switch tab {
                    case .atRisk, .fading:
                        reviewNowButton
                    case .new:
                        // Never-reviewed cards are taught by lessons, not drilled here (B4).
                        Text("New cards are taught in your lessons — the first \(Tuning.foundationSeedBatch) or so come due each day.")
                            .font(.footnote).foregroundStyle(Theme.textSecondary)
                            .multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.horizontal, 20)
                    case .mastered:
                        // Mastery is a badge, not retirement (B3): the schedule can
                        // still want a check, and only those items are reviewed.
                        let dueCount = store.dueMasteredGaps(at: Date()).count
                        if dueCount > 0 {
                            Text("\(dueCount) due for a check — mastered words stay on the schedule.")
                                .font(.footnote).foregroundStyle(Theme.textSecondary)
                                .multilineTextAlignment(.center)
                                .fixedSize(horizontal: false, vertical: true)
                                .padding(.horizontal, 20)
                            reviewNowButton
                        } else {
                            Text("None due for a check right now — mastered words stay on the schedule.")
                                .font(.footnote).foregroundStyle(Theme.textSecondary)
                                .multilineTextAlignment(.center)
                                .fixedSize(horizontal: false, vertical: true)
                                .padding(.horizontal, 20)
                        }
                    case .fresh:
                        EmptyView()
                    }
                }
            }
            .padding(.vertical, 16)
        }
        .background(Theme.background)
        .navigationTitle("Retention").navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(item: $scopedLesson) { lesson in
            LessonView(gaps: lesson.gaps, assembled: lesson)
        }
        .alert("Nothing to review", isPresented: Binding(
            get: { emptyHeadline != nil },
            set: { if !$0 { emptyHeadline = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(emptyHeadline ?? "")
        }
    }

    private var reviewNowButton: some View {
        Button {
            Haptics.select()
            switch LessonPipeline(store: store).outcome(for: .retention(tab.bucket)) {
            case .lesson(let lesson): scopedLesson = lesson
            case .empty(let headline): emptyHeadline = headline
            }
        } label: {
            Text("Review these now").scaledFont(16, weight: .bold).foregroundStyle(.white)
                .frame(maxWidth: .infinity).padding(.vertical, 15)
                .frame(minHeight: Theme.minimumHitTarget)
                .background(tint).clipShape(.rect(cornerRadius: 14))
        }
        .buttonStyle(.plain)
        .accessibilityHint("Starts a review of the \(tab.rawValue.lowercased()) words")
        .padding(.horizontal, 20)
    }

    private func retentionRow(_ gap: GapItem) -> some View {
        let r = Int((gap.retrievability * 100).rounded())
        return HStack(spacing: 12) {
            Circle().fill(gap.category.color).frame(width: 8, height: 8)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(gap.frenchWord).scaledFont(15, weight: .semibold).foregroundStyle(Theme.text)
                // A capture whose meaning has not arrived yet shows the same
                // pending pill as the deck rather than an empty line.
                if gap.needsTranslation || gap.englishTranslation.isEmpty {
                    Pill(text: "Translation pending", color: Theme.warning)
                } else {
                    Text(gap.englishTranslation).scaledFont(13).foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer()
            if tab == .new {
                Text("new").font(.footnote.weight(.semibold)).foregroundStyle(tint)
            } else {
                Text("\(r)%").scaledFont(15, weight: .bold).foregroundStyle(tint)
                    .accessibilityHidden(true)
            }
        }
        .cardStyle(padding: 14)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(gap.needsTranslation || gap.englishTranslation.isEmpty
                            ? "\(gap.frenchWord), translation pending"
                            : "\(gap.frenchWord), \(gap.englishTranslation)")
        .accessibilityValue(tab == .new ? "Not reviewed yet" : "\(r) percent recall")
    }
}

// MARK: - Error patterns list

struct ErrorPatternsView: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if store.errorPatterns.isEmpty {
                    Text("No mistake patterns yet.").scaledFont(14).foregroundStyle(Theme.textSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.vertical, 40)
                } else {
                    ForEach(store.errorPatterns) { pattern in
                        NavigationLink { ErrorPatternDetailView(pattern: pattern) } label: {
                            ErrorPatternCard(pattern: pattern)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(20)
        }
        .background(Theme.background)
        .navigationTitle("Error patterns").navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Error pattern detail

struct ErrorPatternDetailView: View {
    @Environment(AppStore.self) private var store
    let pattern: AppStore.ErrorPattern
    @State private var scopedLesson: AssembledLesson? = nil
    @State private var emptyHeadline: String? = nil

    private var explanation: String {
        switch pattern.category {
        case .grammar:
            return "These mistakes share a grammar rule. When the rule's trigger appears, you tend to default to the more familiar form. Slow down at that trigger and recall the contrast."
        case .pronunciation:
            return "You're substituting a sound from English (or another habit) for the French target. Listen, then exaggerate the French articulation a few times."
        default:
            return "You confuse the meaning of this item with a similar word. Practicing them side-by-side fixes the interference."
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 8) {
                    Pill(text: pattern.category.label, color: pattern.category.color)
                    Text(pattern.headline).scaledFont(22, weight: .bold).foregroundStyle(Theme.text)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("HERE'S WHY").scaledFont(11, weight: .semibold).foregroundStyle(Theme.textSecondary).tracking(0.4)
                    Text(explanation).scaledFont(15).foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .cardStyle(padding: 16)
                .accessibilityElement(children: .combine)

                VStack(alignment: .leading, spacing: 10) {
                    Text("YOUR MISTAKES").scaledFont(11, weight: .semibold).foregroundStyle(Theme.textSecondary).tracking(0.4)
                    ForEach(pattern.records) { record in
                        HStack(spacing: 10) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(record.userAnswer).scaledFont(14).strikethrough().foregroundStyle(Theme.error)
                                    .fixedSize(horizontal: false, vertical: true)
                                Text(record.correctAnswer).scaledFont(14, weight: .semibold).foregroundStyle(Theme.success)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            Spacer()
                            Text(relativeDate(record.occurredAt)).scaledFont(11).foregroundStyle(Theme.textSecondary)
                        }
                        .cardStyle(padding: 12)
                        // Struck-through red vs green is the only visual cue for
                        // which answer was wrong, so VoiceOver gets it in words.
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("You wrote \(record.userAnswer). The answer is \(record.correctAnswer).")
                        .accessibilityValue(relativeDate(record.occurredAt))
                    }
                }
            }
            .padding(20)
        }
        .background(Theme.background)
        .navigationTitle("Pattern").navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            Button {
                Haptics.select()
                switch LessonPipeline(store: store).outcome(for: .errorPattern(id: pattern.id)) {
                case .lesson(let lesson): scopedLesson = lesson
                case .empty(let headline): emptyHeadline = headline
                }
            } label: {
                Text("Practice this pattern").scaledFont(17, weight: .bold).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 16)
                    .frame(minHeight: Theme.minimumHitTarget)
                    .background(Theme.primary).clipShape(.rect(cornerRadius: 14))
            }
            .buttonStyle(.plain)
            .padding(20)
            .background(.ultraThinMaterial)
        }
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

    private func relativeDate(_ date: Date) -> String {
        let days = store.calendar.dateComponents([.day], from: store.calendar.startOfDay(for: date),
                                                 to: store.calendar.startOfDay(for: Date())).day ?? 0
        if days <= 0 { return "today" }
        if days == 1 { return "yesterday" }
        return "\(days)d ago"
    }
}
