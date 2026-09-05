//
//  GapsView.swift
//  FluentFrenchIOS
//
//  Visual weakness map: learning gaps broken down by category with retention
//  health and counts. Tapping a category launches a focused lesson on it.
//

import SwiftUI

struct GapsView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppStore.self) private var store
    @State private var scopedLesson: AssembledLesson? = nil

    /// Display statistics only. Which gaps a tap practices is the selector's call
    /// (scoped request on the category) — no candidate set is built here.
    private struct CategoryStat: Identifiable {
        let category: GapCategory
        var id: String { category.rawValue }
        let active: Int
        let mastered: Int
        let due: Int
        let retention: Int
    }

    private var stats: [CategoryStat] {
        GapCategory.allCases.map { cat in
            let all = store.gaps.filter { $0.category == cat }
            let active = all.filter { !$0.isMastered }
            let mastered = all.filter { $0.isMastered }
            let due = (store.dueGaps + store.criticalGaps).filter { $0.category == cat }
            let retention: Int
            if active.isEmpty {
                retention = all.isEmpty ? 100 : 100
            } else {
                let avg = active.map { $0.retrievability }.reduce(0, +) / Double(active.count)
                retention = Int((avg * 100).rounded())
            }
            return CategoryStat(category: cat, active: active.count, mastered: mastered.count,
                                due: due.count, retention: retention)
        }
    }

    private var totalActive: Int { store.activeGaps.count }
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
            overviewStat(value: "\(totalActive)", label: "Active gaps", tint: Theme.primary, icon: "target")
            Rectangle().fill(Theme.border).frame(width: 1, height: 44)
            overviewStat(value: "\(totalMastered)", label: "Mastered", tint: Theme.success, icon: "checkmark.seal.fill")
            Rectangle().fill(Theme.border).frame(width: 1, height: 44)
            overviewStat(value: "\(store.overallRetention)%", label: "Retention", tint: Theme.secondary, icon: "brain.head.profile")
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
            Image(systemName: icon).font(.system(size: 15)).foregroundStyle(tint)
            Text(value).font(.system(size: 20, weight: .heavy)).foregroundStyle(Theme.text)
            Text(label).font(.system(size: 11)).foregroundStyle(Theme.textMuted)
        }
        .frame(maxWidth: .infinity)
    }

    private func categoryCard(_ stat: CategoryStat) -> some View {
        let total = max(stat.active + stat.mastered, 1)
        let masteryProgress = Double(stat.mastered) / Double(total)
        let healthLabel: String
        let healthColor: Color
        if stat.active == 0 { healthLabel = "All clear"; healthColor = Theme.success }
        else if stat.retention >= 70 { healthLabel = "Healthy"; healthColor = Theme.success }
        else if stat.retention >= 50 { healthLabel = "Needs attention"; healthColor = Theme.warning }
        else { healthLabel = "At risk"; healthColor = Theme.error }

        return Button {
            guard stat.active > 0 else { return }
            Haptics.select()
            scopedLesson = LessonPipeline(store: store).lesson(for: .category(stat.category))
        } label: {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 12) {
                    Image(systemName: icon(stat.category)).font(.system(size: 18)).foregroundStyle(stat.category.color)
                        .frame(width: 44, height: 44).background(stat.category.color.opacity(0.1)).clipShape(.rect(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(stat.category.color.opacity(0.16), lineWidth: 0.5))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(stat.category.label).font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.text)
                        Text("\(stat.active) active · \(stat.mastered) mastered").font(.system(size: 12)).foregroundStyle(Theme.textMuted)
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

                HStack {
                    if stat.due > 0 {
                        HStack(spacing: 4) {
                            Image(systemName: "clock.fill").font(.system(size: 10))
                            Text("\(stat.due) due to review").font(.system(size: 12, weight: .medium))
                        }
                        .foregroundStyle(Theme.warning)
                    } else {
                        Text("\(stat.retention)% retention").font(.system(size: 12)).foregroundStyle(Theme.textMuted)
                    }
                    Spacer()
                    if stat.active > 0 {
                        HStack(spacing: 4) {
                            Text("Practice").font(.system(size: 12, weight: .semibold))
                            Image(systemName: "arrow.right").font(.system(size: 10, weight: .bold))
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
