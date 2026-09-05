//
//  DeckView.swift
//  FluentFrenchIOS
//
//  "My Gaps" — categories, SRS review entry, gap cards, mastered list.
//  Mirrors the Expo deck screen's structure and teal-gradient header.
//

import SwiftUI

struct DeckView: View {
    @Environment(AppStore.self) private var store
    @State private var selectedCategory: GapCategory? = nil
    @State private var showMastered = false
    @State private var scopedLesson: AssembledLesson? = nil

    /// Declare intent only: the store resolves the scope to candidates and the
    /// selector decides what, in what order, and why.
    private func startScoped(_ scope: SelectionScope) {
        Haptics.select()
        scopedLesson = LessonPipeline(store: store).lesson(for: scope)
    }

    private var displayedGaps: [GapItem] {
        if let selectedCategory { return store.gaps(in: selectedCategory) }
        return store.activeGaps
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    header
                    VStack(spacing: 20) {
                        if !store.reviewQueue.isEmpty { srsCard }
                        if !store.activeGaps.isEmpty { practiceSection }
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
        }
    }

    private var header: some View {
        GradientHeader(gradient: Theme.tealGradient, title: "My Gaps", subtitle: "Practice your weak spots until mastery") {
            EmptyView()
        }
        .frame(height: 190)
        .overlay(alignment: .bottomLeading) {
            HStack(spacing: 20) {
                HeaderStat(systemImage: "target", value: "\(store.activeGaps.count)", label: "Active")
                Rectangle().fill(Color.white.opacity(0.25)).frame(width: 1, height: 28)
                HeaderStat(systemImage: "rosette", value: "\(store.masteredGaps.count)", label: "Mastered")
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color.white.opacity(0.15))
            .clipShape(.rect(cornerRadius: 12))
            .padding(.leading, 24)
            .padding(.bottom, 18)
        }
    }

    private var srsCard: some View {
        let total = store.reviewQueue.count
        return VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                Image(systemName: "brain.head.profile")
                    .font(.system(size: 22)).foregroundStyle(Color(hex: "C7D2FE"))
                    .frame(width: 44, height: 44)
                    .background(Color.white.opacity(0.12)).clipShape(.rect(cornerRadius: 14))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Spaced Repetition").font(.system(size: 17, weight: .bold)).foregroundStyle(Color(hex: "E0E7FF"))
                    Text("\(total) card\(total == 1 ? "" : "s") ready to review").font(.system(size: 13)).foregroundStyle(Color(hex: "A5B4FC"))
                }
                Spacer()
                Text("\(total)")
                    .font(.system(size: 13, weight: .heavy)).foregroundStyle(.white)
                    .padding(.horizontal, 9).padding(.vertical, 5)
                    .background(Theme.error).clipShape(.capsule)
            }
            Button {
                startScoped(.reviewQueue)
            } label: {
                HStack {
                    Spacer()
                    Text("Start Review").font(.system(size: 16, weight: .bold)).foregroundStyle(Color(hex: "312E81"))
                    Image(systemName: "chevron.right").font(.system(size: 14, weight: .bold)).foregroundStyle(Color(hex: "312E81"))
                    Spacer()
                }
                .padding(.vertical, 14)
                .background(Color(hex: "E0E7FF"))
                .clipShape(.rect(cornerRadius: Radius.card))
            }
            .buttonStyle(.plain)
            .pressable()
        }
        .padding(Space.xl)
        .background(Theme.indigoGradient)
        .clipShape(.rect(cornerRadius: Radius.card))
        .softLift(radius: 18, y: 8)
    }

    private var practiceSection: some View {
        let critical = store.criticalGaps.count
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                let h = store.gapHealth
                HStack(spacing: 6) {
                    Circle().fill(h.score >= 70 ? Theme.success : h.score >= 50 ? Theme.warning : Theme.error).frame(width: 6, height: 6)
                    Text(h.label).font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(h.score >= 70 ? Color(hex: "065F46") : h.score >= 50 ? Color(hex: "92400E") : Color(hex: "991B1B"))
                }
                .padding(.horizontal, 10).padding(.vertical, 5)
                .background(h.score >= 70 ? Color(hex: "D1FAE5") : h.score >= 50 ? Color(hex: "FEF3C7") : Color(hex: "FEE2E2"))
                .clipShape(.rect(cornerRadius: 8))
                if critical > 0 {
                    Text("\(critical) critical").font(.system(size: 11, weight: .semibold)).foregroundStyle(Color(hex: "DC2626"))
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(Color(hex: "FEE2E2")).clipShape(.rect(cornerRadius: 6))
                }
                Spacer()
            }

            Button {
                startScoped(critical > 0 ? .critical : .mixed)
            } label: {
                HStack(spacing: 14) {
                    Image(systemName: "bolt.fill").font(.system(size: 18)).foregroundStyle(.white)
                        .frame(width: 40, height: 40).background(Color.white.opacity(0.2)).clipShape(.rect(cornerRadius: 12))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(critical > 0 ? "Review Critical Gaps" : "Start Practice")
                            .font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                        Text(critical > 0 ? "\(critical) gap\(critical == 1 ? "" : "s") falling behind" : "Mixed review of all categories")
                            .font(.system(size: 13)).foregroundStyle(.white.opacity(0.8))
                    }
                    Spacer()
                    Image(systemName: "chevron.right").foregroundStyle(.white)
                }
                .padding(Space.lg)
                .background(critical > 0 ? Theme.error : Theme.primary)
                .clipShape(.rect(cornerRadius: Radius.card))
                .softLift(radius: 14, y: 6, strength: 0.8)
            }
            .buttonStyle(.plain)
            .pressable()
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
                            VStack(alignment: .leading, spacing: 2) {
                                Text(category.label).font(.system(size: 15, weight: .semibold))
                                    .foregroundStyle(active ? Theme.primaryDark : (s.active == 0 ? Theme.textMuted : Theme.text))
                                Text("\(s.active) active · \(s.mastered) mastered").font(.system(size: 12)).foregroundStyle(Theme.textMuted)
                            }
                            Spacer()
                            if s.active > 0 {
                                Button {
                                    startScoped(.category(category))
                                } label: {
                                    Image(systemName: "play.fill").font(.system(size: 11)).foregroundStyle(category.color)
                                        .frame(width: 28, height: 28).background(category.color.opacity(0.12)).clipShape(.rect(cornerRadius: 8))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(Space.lg)
                        .background(active ? Theme.primaryLight : Theme.card)
                        .clipShape(.rect(cornerRadius: Radius.card))
                        .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(active ? Theme.primary : Theme.border.opacity(0.5), lineWidth: active ? 1.5 : 0.5))
                        .softLift(radius: 10, y: 3, strength: 0.6)
                        .opacity(s.active == 0 && s.mastered == 0 ? 0.5 : 1)
                    }
                    .buttonStyle(.plain)
                    .pressable()
                }
            }
        }
    }

    private var gapsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: selectedCategory?.label ?? "All Gaps", trailing: "\(displayedGaps.count) gaps")
            if displayedGaps.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "square.stack.3d.up").font(.system(size: 32)).foregroundStyle(Theme.textMuted)
                        .frame(width: 64, height: 64).background(Theme.backgroundSecondary).clipShape(.circle)
                    Text("No gaps yet").font(.system(size: 17, weight: .semibold)).foregroundStyle(Theme.text)
                    Text("Add gaps while reading or speaking").font(.system(size: 14)).foregroundStyle(Theme.textMuted)
                }
                .frame(maxWidth: .infinity).padding(.vertical, 40)
            } else {
                VStack(spacing: 10) {
                    ForEach(displayedGaps.prefix(12)) { gap in
                        GapCardView(gap: gap)
                    }
                }
            }
        }
    }

    private var masteredSection: some View {
        VStack(spacing: 0) {
            Button { withAnimation(.easeInOut) { showMastered.toggle() } } label: {
                HStack {
                    Image(systemName: "rosette").font(.system(size: 15)).foregroundStyle(Theme.success)
                    Text("Mastered (\(store.masteredGaps.count))").font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.text)
                    Spacer()
                    Image(systemName: showMastered ? "chevron.up" : "chevron.down").foregroundStyle(Theme.textMuted)
                }
                .padding(14)
            }
            .buttonStyle(.plain)
            if showMastered {
                VStack(spacing: 0) {
                    ForEach(store.masteredGaps) { gap in
                        HStack {
                            Text(gap.frenchWord).font(.system(size: 14, weight: .medium)).foregroundStyle(Theme.success)
                            Spacer()
                            Text(gap.englishTranslation).font(.system(size: 13)).foregroundStyle(Theme.textMuted)
                        }
                        .padding(.vertical, 8)
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
