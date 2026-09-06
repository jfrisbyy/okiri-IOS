//
//  GapsView.swift
//  FluentFrenchIOS
//
//  Visual weakness map: learning gaps broken down by category with retention
//  health and counts. Tapping a category launches a focused lesson on it.
//  Counts read learner-visible gaps only (probes excluded, A13); the due number
//  is `store.dueNow` (D13); an empty category explains itself (C23).
//

import SwiftUI

struct GapsView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppStore.self) private var store
    /// 1 at the default text size; the square category badge grows with it.
    @ScaledMetric private var typeScale: CGFloat = 1
    @State private var scopedLesson: AssembledLesson? = nil
    /// The selector's headline when a tapped category had nothing to offer.
    @State private var emptyHeadline: String? = nil

    /// Display statistics only. Which gaps a tap practices is the selector's call
    /// (scoped request on the category) — no candidate set is built here.
    private struct CategoryStat: Identifiable {
        let category: GapCategory
        var id: String { category.rawValue }
        let active: Int
        let mastered: Int
        let due: Int
        /// Active gaps with at least one review — the evidence behind `retention`.
        let reviewed: Int
        let retention: Int
    }

    private var stats: [CategoryStat] {
        let dueNow = store.dueNow
        return GapCategory.allCases.map { cat in
            let all = store.gaps.filter { $0.category == cat && !$0.isProbe }
            let active = all.filter { !$0.isMastered }
            let mastered = all.filter { $0.isMastered }
            let due = dueNow.filter { $0.category == cat }
            // Recall is averaged over reviewed gaps only: a never-answered seed has
            // given no evidence and must not read as "at risk" (B4).
            let reviewed = active.filter { !$0.isNew }
            let retention: Int
            if reviewed.isEmpty {
                retention = 100
            } else {
                let avg = reviewed.map { $0.retrievability }.reduce(0, +) / Double(reviewed.count)
                retention = Int((avg * 100).rounded())
            }
            return CategoryStat(category: cat, active: active.count, mastered: mastered.count,
                                due: due.count, reviewed: reviewed.count, retention: retention)
        }
    }

    private var totalActive: Int { store.visibleGaps.count }
    private var totalMastered: Int { store.masteredGaps.count }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(spacing: 16) {
                    overviewCard
                    ForEach(stats) { stat in
                        categoryCard(stat)
                    }
                }
                .padding(.horizontal, 18).padding(.top, 18).padding(.bottom, 44)
            }
            .scrollIndicators(.hidden)
        }
        .background(Theme.background)
        .ignoresSafeArea(edges: .top)
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

    /// Declare intent only; when the selector has nothing for this category the
    /// learner sees its headline instead of a dead tap (C23). `dueOnly` is the
    /// scope behind a card whose only remaining work is mastery checks: the same
    /// pool the "N due now" badge counts (`store.dueNow`, D13).
    private func practice(_ category: GapCategory, dueOnly: Bool = false) {
        Haptics.select()
        let scope: SelectionScope = dueOnly ? .dueInCategory(category) : .category(category)
        switch LessonPipeline(store: store).outcome(for: scope) {
        case .lesson(let lesson): scopedLesson = lesson
        case .empty(let headline): emptyHeadline = headline
        }
    }

    private var header: some View {
        ResourceHeader(
            gradient: Theme.primaryGradient,
            title: "Gap Map",
            subtitle: "Where you're strong, where to focus",
            onBack: { dismiss() }
        )
    }

    private var overviewCard: some View {
        HStack(spacing: 12) {
            overviewStat(value: "\(totalActive)", label: HomeCopy.toLearnLabel, tint: Theme.primary, icon: "target")
            Rectangle().fill(Theme.border).frame(width: 1, height: 44)
            overviewStat(value: "\(totalMastered)", label: "Mastered", tint: Theme.success, icon: "checkmark.seal.fill")
            Rectangle().fill(Theme.border).frame(width: 1, height: 44)
            overviewStat(value: store.hasRetentionEvidence ? "\(store.overallRetention)%" : "—", label: "Retention", tint: Theme.secondary, icon: "brain.head.profile")
        }
        .padding(18)
        .frame(maxWidth: .infinity)
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.border.opacity(0.5), lineWidth: 0.5))
        .softLift(radius: 14, y: 5, strength: 0.85)
    }

    private func overviewStat(value: String, label: String, tint: Color, icon: String) -> some View {
        VStack(spacing: 6) {
            Image(systemName: icon).scaledFont(15).foregroundStyle(tint).accessibilityHidden(true)
            Text(value).scaledFont(20, weight: .heavy).foregroundStyle(Theme.text)
                .minimumScaleFactor(0.6).lineLimit(1)
            Text(label).font(.caption2).foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }

    private func categoryCard(_ stat: CategoryStat) -> some View {
        let total = max(stat.active + stat.mastered, 1)
        let masteryProgress = Double(stat.mastered) / Double(total)
        let healthLabel: String
        let healthColor: Color
        // Nothing unmastered left, but the schedule still wants some checks back:
        // "All clear" would contradict the "N due now" line right below it.
        if stat.active == 0 && stat.due > 0 { healthLabel = "Due for a check"; healthColor = Theme.warning }
        else if stat.active == 0 { healthLabel = "All clear"; healthColor = Theme.success }
        // Never reviewed: no recall evidence yet, so no health claim either (D19).
        else if stat.reviewed == 0 { healthLabel = "New"; healthColor = Theme.primary }
        else if stat.retention >= Tuning.gapHealthHealthyFloor { healthLabel = "Healthy"; healthColor = Theme.success }
        else if stat.retention >= Tuning.gapHealthAttentionFloor { healthLabel = "Needs attention"; healthColor = Theme.warning }
        else { healthLabel = "At risk"; healthColor = Theme.error }

        return Button {
            // A card that says "N due now" has to be startable. When everything
            // unmastered is gone, those N are mastery checks the schedule wants
            // back (B3) — practise exactly that pool instead of claiming the
            // category is empty one line under the badge.
            if stat.active > 0 {
                practice(stat.category)
            } else if stat.due > 0 {
                practice(stat.category, dueOnly: true)
            } else {
                emptyHeadline = "No \(stat.category.label.lowercased()) gaps yet — capture words while reading or speaking, or keep going with your lessons."
            }
        } label: {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 12) {
                    Image(systemName: icon(stat.category)).scaledFont(18).foregroundStyle(stat.category.color)
                        .frame(width: Theme.minimumHitTarget * typeScale, height: Theme.minimumHitTarget * typeScale)
                        .background(stat.category.color.opacity(0.1)).clipShape(.rect(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(stat.category.color.opacity(0.16), lineWidth: 0.5))
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(stat.category.label).scaledFont(16, weight: .semibold).foregroundStyle(Theme.text)
                        Text("\(stat.active) active · \(stat.mastered) mastered").scaledFont(12).foregroundStyle(Theme.textSecondary)
                    }
                    Spacer()
                    Pill(text: healthLabel, color: healthColor)
                }

                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Theme.border.opacity(0.6)).frame(height: 5)
                        Capsule().fill(stat.category.color).frame(width: geo.size.width * masteryProgress, height: 5)
                    }
                }
                .frame(height: 5)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(stat.category.label) mastery")
                .accessibilityValue("\(stat.mastered) of \(stat.active + stat.mastered) mastered")

                HStack {
                    if stat.due > 0 {
                        HStack(spacing: 4) {
                            Image(systemName: "clock.fill").scaledFont(10).accessibilityHidden(true)
                            Text("\(stat.due) due now").font(.caption.weight(.medium))
                        }
                        .foregroundStyle(Theme.warning)
                    } else {
                        Text(stat.reviewed == 0 ? "No reviews yet" : "\(stat.retention)% retention")
                            .scaledFont(12).foregroundStyle(Theme.textSecondary)
                    }
                    Spacer()
                    if stat.active > 0 || stat.due > 0 {
                        HStack(spacing: 4) {
                            Text(stat.active > 0 ? "Practice" : "Review").scaledFont(12, weight: .semibold)
                            Image(systemName: "arrow.right").scaledFont(10, weight: .bold).accessibilityHidden(true)
                        }
                        .foregroundStyle(stat.category.color)
                    }
                }
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.card)
            .clipShape(.rect(cornerRadius: Radius.card))
            .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.border.opacity(0.5), lineWidth: 0.5))
            .softLift(radius: 14, y: 5, strength: 0.85)
        }
        .buttonStyle(.plain)
        .pressable()
        .accessibilityLabel("\(stat.category.label): \(stat.active) active, \(stat.mastered) mastered, \(healthLabel)")
        .accessibilityValue(stat.due > 0
                            ? "\(stat.due) due now"
                            : (stat.reviewed == 0 ? "No reviews yet" : "\(stat.retention) percent retention"))
        .accessibilityHint(stat.active > 0 ? "Starts a focused lesson."
                           : (stat.due > 0 ? "Starts the mastery checks that are due."
                              : "Nothing to practice here yet."))
    }

    private func icon(_ c: GapCategory) -> String {
        switch c {
        case .vocabulary: return "book.fill"
        case .grammar: return "curlybraces"
        case .pronunciation: return "mic.fill"
        case .phrasing: return "text.bubble.fill"
        case .register: return "shield.fill"
        }
    }
}
