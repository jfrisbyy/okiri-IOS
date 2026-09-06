//
//  LessonIntroStage.swift
//  FluentFrenchIOS
//
//  The lesson's first screen (what you'll practice, why, your best so far, the
//  hearts rule) and the cancellable "crafting your lesson" wait (C9).
//

import SwiftUI

struct LessonIntroStage: View {
    let model: LessonViewModel
    let onClose: () -> Void
    @Environment(AppStore.self) private var store
    /// The small initial discs grow with the type ratio so the initials keep
    /// their proportions at large text sizes (G1).
    @ScaledMetric(relativeTo: .body) private var typeScale: CGFloat = 1
    /// The hero disc follows the large-title curve its glyph uses, clamped so it
    /// never outgrows the narrowest phone.
    @ScaledMetric(relativeTo: .largeTitle) private var heroDiscSize: CGFloat = 96
    private var heroDisc: CGFloat { min(heroDiscSize, 150) }

    private let previewCount = 4

    var body: some View {
        VStack(spacing: Space.lg) {
            HStack {
                Spacer()
                LessonCloseButton(action: onClose)
            }
            ScrollView {
                VStack(spacing: Space.lg) {
                    ZStack {
                        Circle().fill(Theme.primaryGradient)
                            .frame(width: heroDisc, height: heroDisc)
                            .softLift(radius: 18, y: 8, strength: 2)
                        Image(systemName: model.isCapstone ? "flag.checkered" : "graduationcap.fill")
                            .font(.largeTitle).foregroundStyle(.white)
                    }
                    .accessibilityHidden(true)

                    Text(model.isCapstone ? "Capstone check" : "Ready to practice?")
                        .font(LessonFont.hero).foregroundStyle(Theme.text)
                        .multilineTextAlignment(.center)
                    Text(subtitle)
                        .font(.subheadline).foregroundStyle(Theme.textSecondary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)

                    if !model.lesson.headline.isEmpty {
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "sparkles").font(.footnote.weight(.bold)).foregroundStyle(Theme.secondary)
                                .accessibilityHidden(true)
                            Text(model.lesson.headline).font(.footnote.weight(.semibold)).foregroundStyle(Theme.text)
                                .multilineTextAlignment(.leading)
                                .fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: 0)
                        }
                        .padding(Space.md)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.secondaryLight).clipShape(.rect(cornerRadius: Radius.card))
                    }

                    categoryPills
                    wordPreview
                    heartsNote
                    bestCard
                }
                .padding(.bottom, Space.lg)
            }
            .scrollIndicators(.hidden)

            LessonPrimaryButton(title: startTitle) {
                guard !model.gaps.isEmpty else { onClose(); return }
                Haptics.select()
                model.begin(store: store)
            }
        }
        .padding(Space.xl)
    }

    private var subtitle: String {
        let n = model.gaps.filter { !$0.isProbe }.count
        let items = "\(n) item\(n == 1 ? "" : "s")"
        if model.isCapstone {
            return "\(items) · one question each — your first answer is what counts."
        }
        return "\(items) · answer each right \(Tuning.masteryTarget)× to master it this session."
    }

    private var startTitle: String {
        if model.gaps.isEmpty { return "Nothing to practice" }
        return model.isCapstone ? "Begin capstone" : "Start"
    }

    private var categoryPills: some View {
        let categories = Array(Set(model.gaps.map { $0.category })).sorted { $0.label < $1.label }
        return FlowLayout(spacing: 8, lineSpacing: 8) {
            ForEach(categories, id: \.self) { category in
                Pill(text: category.label, color: category.color, filled: true)
            }
        }
    }

    private var wordPreview: some View {
        let shown = model.gaps.filter { !$0.isProbe }
        return VStack(spacing: 8) {
            ForEach(shown.prefix(previewCount)) { gap in
                HStack(spacing: 10) {
                    Circle().fill(gap.category.color.opacity(0.15))
                        .frame(width: 34 * Theme.chromeScale(typeScale), height: 34 * Theme.chromeScale(typeScale))
                        .overlay {
                            Text(String(gap.frenchWord.prefix(1)).uppercased())
                                .font(.subheadline.weight(.bold)).foregroundStyle(gap.category.color)
                        }
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(gap.frenchWord).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
                        Text(gap.englishTranslation).font(.caption).foregroundStyle(Theme.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer()
                }
                .accessibilityElement(children: .combine)
            }
            if shown.count > previewCount {
                Text("+ \(shown.count - previewCount) more").font(.footnote.weight(.medium)).foregroundStyle(Theme.textSecondary)
            }
        }
        .padding(Space.lg)
        .frame(maxWidth: .infinity)
        .background(Theme.card).clipShape(.rect(cornerRadius: Radius.card)).softLift()
    }

    private var heartsNote: some View {
        HStack(spacing: 10) {
            Image(systemName: model.isCapstone ? "flag.checkered" : "heart.fill")
                .font(.body).foregroundStyle(model.isCapstone ? Theme.secondary : Theme.error)
                .accessibilityHidden(true)
            Text(model.isCapstone
                 ? "No hearts and no retries: a capstone is a check, not a drill."
                 : "\(Tuning.lessonHearts) hearts — a miss costs one. At zero the lesson stops and shows what slipped.")
                .font(.footnote).foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(Space.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.backgroundSecondary).clipShape(.rect(cornerRadius: Radius.card))
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var bestCard: some View {
        if let best = store.personalBest(for: model.bestKind) {
            HStack(spacing: 12) {
                Image(systemName: "trophy.fill").font(.title3).foregroundStyle(Theme.warning).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Beat your best").font(.subheadline.weight(.bold)).foregroundStyle(Theme.text)
                    Text("\(Int((best.accuracy * 100).rounded()))% first-try accuracy · \(best.streak) best streak")
                        .font(.caption).foregroundStyle(Theme.textSecondary)
                }
                Spacer()
            }
            .padding(Space.lg)
            .frame(maxWidth: .infinity)
            .background(Theme.warningLight).clipShape(.rect(cornerRadius: Radius.card))
            .accessibilityElement(children: .combine)
        }
    }
}

// MARK: - Generating (C9)

struct LessonGeneratingStage: View {
    let model: LessonViewModel
    let onClose: () -> Void
    @Environment(AppStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// The hero disc follows the large-title curve its glyph uses, clamped so it
    /// never outgrows the narrowest phone.
    @ScaledMetric(relativeTo: .largeTitle) private var heroDiscSize: CGFloat = 92
    private var heroDisc: CGFloat { min(heroDiscSize, 150) }

    var body: some View {
        VStack(spacing: Space.lg) {
            HStack {
                Spacer()
                LessonCloseButton(action: onClose)
            }
            Spacer()
            ZStack {
                Circle().fill(Theme.primaryGradient)
                    .frame(width: heroDisc, height: heroDisc)
                    .softLift(radius: 18, y: 8, strength: 2)
                Image(systemName: "sparkles").font(.largeTitle).foregroundStyle(.white)
                    .symbolEffect(.variableColor.iterative, options: .repeating, isActive: !reduceMotion)
            }
            .accessibilityHidden(true)
            Text("Crafting your lesson…").font(LessonFont.display).foregroundStyle(Theme.text)
            Text("Writing fresh questions for your \(model.gaps.count) item\(model.gaps.count == 1 ? "" : "s") at level \(store.learnerLevel.rawValue). This takes a few seconds at most.")
                .font(.subheadline).foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            ProgressView().tint(Theme.primary).padding(.top, 4)
                .accessibilityLabel("Generating questions")
            Spacer()
            LessonSecondaryButton(title: "Start with the built-in questions", systemImage: "forward.fill") {
                Haptics.select()
                model.skipGeneration(store: store)
            }
        }
        .padding(Space.xl)
    }
}
