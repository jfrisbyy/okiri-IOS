//
//  RetentionView.swift
//  FluentFrenchIOS
//
//  Full retention breakdown with tabs for At risk / Fading / Fresh / Mastered.
//

import SwiftUI

struct RetentionView: View {
    @Environment(AppStore.self) private var store
    @State private var tab: Tab = .atRisk
    @State private var scopedLesson: AssembledLesson? = nil

    enum Tab: String, CaseIterable, Identifiable {
        case atRisk = "At risk", fading = "Fading", fresh = "Fresh", mastered = "Mastered"
        var id: String { rawValue }
    }

    private var items: [GapItem] {
        let b = store.retention
        switch tab {
        case .atRisk: return b.atRisk
        case .fading: return b.fading
        case .fresh: return b.fresh
        case .mastered: return b.mastered
        }
    }

    private var tint: Color {
        switch tab {
        case .atRisk: return Theme.error
        case .fading: return Theme.warning
        case .fresh: return Theme.success
        case .mastered: return Theme.secondary
        }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Tab.allCases) { t in
                            let count = countFor(t)
                            Button { withAnimation { tab = t } } label: {
                                Text("\(t.rawValue) \(count)")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(tab == t ? .white : Theme.textSecondary)
                                    .padding(.horizontal, 14).padding(.vertical, 9)
                                    .background(tab == t ? Theme.primary : Theme.card)
                                    .clipShape(.capsule)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 20)
                }

                if items.isEmpty {
                    Text("Nothing here right now.").font(.system(size: 14)).foregroundStyle(Theme.textMuted)
                        .padding(.vertical, 40)
                } else {
                    VStack(spacing: 10) {
                        ForEach(items) { gap in
                            retentionRow(gap)
                        }
                    }
                    .padding(.horizontal, 20)
                    if tab == .atRisk || tab == .fading {
                        Button {
                            scopedLesson = LessonAssembler(store: store).assembleScoped(candidates: items, scopeName: tab.rawValue)
                        } label: {
                            Text("Review these now").font(.system(size: 16, weight: .bold)).foregroundStyle(.white)
                                .frame(maxWidth: .infinity).padding(.vertical, 15)
                                .background(tint).clipShape(.rect(cornerRadius: 14))
                        }
                        .buttonStyle(.plain)
                        .padding(.horizontal, 20)
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
    }

    private func countFor(_ t: Tab) -> Int {
        let b = store.retention
        switch t {
        case .atRisk: return b.atRisk.count
        case .fading: return b.fading.count
        case .fresh: return b.fresh.count
        case .mastered: return b.mastered.count
        }
    }

    private func retentionRow(_ gap: GapItem) -> some View {
        let r = Int((gap.retrievability * 100).rounded())
        return HStack(spacing: 12) {
            Circle().fill(gap.category.color).frame(width: 8, height: 8)
            VStack(alignment: .leading, spacing: 2) {
                Text(gap.frenchWord).font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.text)
                Text(gap.englishTranslation).font(.system(size: 13)).foregroundStyle(Theme.textMuted)
            }
            Spacer()
            Text("\(r)%").font(.system(size: 15, weight: .bold)).foregroundStyle(tint)
        }
        .cardStyle(padding: 14)
    }
}

// MARK: - Error patterns list

struct ErrorPatternsView: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if store.errorPatterns.isEmpty {
                    Text("No mistake patterns yet.").font(.system(size: 14)).foregroundStyle(Theme.textMuted).padding(.vertical, 40)
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
                    Text(pattern.headline).font(.system(size: 22, weight: .bold)).foregroundStyle(Theme.text)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("HERE'S WHY").font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.textMuted).tracking(0.4)
                    Text(explanation).font(.system(size: 15)).foregroundStyle(Theme.textSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .cardStyle(padding: 16)

                VStack(alignment: .leading, spacing: 10) {
                    Text("YOUR MISTAKES").font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.textMuted).tracking(0.4)
                    ForEach(pattern.records) { record in
                        HStack(spacing: 10) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(record.userAnswer).font(.system(size: 14)).strikethrough().foregroundStyle(Theme.error)
                                Text(record.correctAnswer).font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.success)
                            }
                            Spacer()
                            Text(relativeDate(record.occurredAt)).font(.system(size: 11)).foregroundStyle(Theme.textMuted)
                        }
                        .cardStyle(padding: 12)
                    }
                }
            }
            .padding(20)
        }
        .background(Theme.background)
        .navigationTitle("Pattern").navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            Button {
                let ids = Set(pattern.records.map { $0.gapId })
                let gaps = store.gaps.filter { ids.contains($0.id) }
                if !gaps.isEmpty {
                    scopedLesson = LessonAssembler(store: store).assembleScoped(candidates: gaps, scopeName: pattern.conceptLabel)
                }
            } label: {
                Text("Practice this pattern").font(.system(size: 17, weight: .bold)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 16)
                    .background(Theme.primary).clipShape(.rect(cornerRadius: 14))
            }
            .buttonStyle(.plain)
            .padding(20)
            .background(.ultraThinMaterial)
        }
        .fullScreenCover(item: $scopedLesson) { lesson in
            LessonView(gaps: lesson.gaps, assembled: lesson)
        }
    }

    private func relativeDate(_ date: Date) -> String {
        let days = Int(-date.timeIntervalSinceNow / 86_400)
        if days <= 0 { return "today" }
        if days == 1 { return "yesterday" }
        return "\(days)d ago"
    }
}
