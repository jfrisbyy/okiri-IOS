//
//  LessonCompleteStage.swift
//  FluentFrenchIOS
//
//  The completion screen and the out-of-hearts recap (C5 / C26): first-attempt
//  accuracy, the capstone held/slipped tally (C16), XP, best streak, an honest
//  level line (no theta decimals), the missed items with their answers and
//  "Practice these now", and any skills unlocked.
//

import SwiftUI

struct LessonCompleteStage: View {
    let model: LessonViewModel
    let onDone: () -> Void
    @Environment(AppStore.self) private var store

    var body: some View {
        if let summary = model.summary {
            content(summary)
        } else {
            ProgressView().tint(Theme.primary)
        }
    }

    private func content(_ summary: LessonSummary) -> some View {
        let outOfHearts = summary.end == .outOfHearts
        return VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: Space.xl) {
                    scoreRing(summary)
                    Text(title(for: summary))
                        .font(LessonFont.hero).foregroundStyle(Theme.text)
                        .multilineTextAlignment(.center)
                    if outOfHearts {
                        Text("The lesson stopped at zero hearts. Here's what slipped — and a quick way to go over it.")
                            .font(.subheadline).foregroundStyle(Theme.textSecondary)
                            .multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    if model.isCapstone {
                        capstoneTally(summary)
                    }
                    if model.isNewBest {
                        Label("New personal best!", systemImage: "trophy.fill")
                            .font(.subheadline.weight(.bold)).foregroundStyle(Theme.warning)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(Theme.warningLight).clipShape(.capsule)
                    }
                    summaryRows(summary)
                    if !summary.missed.isEmpty {
                        missedCard(summary)
                    }
                    if !model.unlockedConcepts.isEmpty {
                        unlockedCard
                    }
                }
                .padding(Space.xl)
            }
            .scrollIndicators(.hidden)
            LessonPrimaryButton(title: "Done", action: onDone)
                .padding(Space.xl)
        }
    }

    // MARK: Pieces

    private func scoreRing(_ summary: LessonSummary) -> some View {
        ZStack {
            Circle().fill(Theme.primaryGradient).frame(width: 130, height: 130).softLift(radius: 20, y: 10, strength: 2)
            VStack(spacing: 0) {
                Text("\(summary.accuracyPercent)%").font(.system(.largeTitle, design: .rounded, weight: .heavy)).foregroundStyle(.white)
                Text("\(summary.scoredCorrect)/\(summary.scored)").font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.85))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("First-try accuracy")
        .accessibilityValue("\(summary.accuracyPercent) percent, \(summary.scoredCorrect) of \(summary.scored)")
    }

    private func title(for summary: LessonSummary) -> String {
        if summary.end == .outOfHearts { return "Out of hearts" }
        if model.isCapstone { return "Capstone complete" }
        if summary.scored == 0 { return "Nothing to practice" }
        if summary.accuracyPercent >= Tuning.lessonPraiseAccuracy { return "Excellent!" }
        if summary.accuracyPercent >= Tuning.lessonEncourageAccuracy { return "Solid work" }
        return "Keep going"
    }

    private func capstoneTally(_ summary: LessonSummary) -> some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                tallyChip("checkmark.circle.fill", Theme.success, "\(summary.held.count)", "held")
                tallyChip("xmark.circle.fill", Theme.error, "\(summary.slipped.count)", "slipped")
            }
            if !summary.slipped.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("SLIPPED").font(.caption.weight(.bold)).foregroundStyle(Theme.error).tracking(0.3)
                    ForEach(summary.slipped) { gap in
                        HStack(spacing: 8) {
                            Text(gap.frenchWord).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
                            Text("— \(gap.englishTranslation)").font(.footnote).foregroundStyle(Theme.textSecondary)
                            Spacer(minLength: 0)
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(Space.lg).background(Theme.card).clipShape(.rect(cornerRadius: Radius.card)).softLift(strength: 0.6)
            }
        }
    }

    private func tallyChip(_ icon: String, _ color: Color, _ value: String, _ label: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon).font(.title3).foregroundStyle(color).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 0) {
                Text(value).font(.title3.weight(.heavy)).foregroundStyle(Theme.text)
                Text(label).font(.caption2).foregroundStyle(Theme.textMuted)
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 10)
        .background(color.opacity(0.1)).clipShape(.rect(cornerRadius: 12))
        .accessibilityElement(children: .combine)
    }

    private func summaryRows(_ summary: LessonSummary) -> some View {
        // Completion XP is awarded by the store (`completeLesson`) only for a lesson
        // that counts as completed (`LessonSummary.isCompleted`); the lesson's own
        // tally covers the answers.
        let bonus = summary.answered > 0 && summary.isCompleted
            ? Tuning.xpPerLessonComplete + (model.isCapstone ? Tuning.xpCapstoneBonus : 0) : 0
        let level = store.hasCompletedAssessment ? store.learnerLevel.rawValue : "Not placed"
        return VStack(spacing: 10) {
            if !model.isCapstone {
                summaryRow("checkmark.seal.fill", Theme.success, "Mastered this session", "\(summary.masteredCount)")
            }
            summaryRow("star.fill", Theme.warning, "XP earned", "+\(summary.xp + bonus)",
                       detail: bonus > 0 ? "includes +\(bonus) for finishing" : nil)
            summaryRow("flame.fill", Theme.primary, "Best streak", "\(summary.bestCombo)")
            summaryRow("chart.line.uptrend.xyaxis", Theme.secondary, "Level", level)
            if !summary.releasedConceptIds.isEmpty {
                let names = summary.releasedConceptIds.compactMap { store.concept($0)?.name }
                if !names.isEmpty {
                    summaryRow("arrow.right.circle.fill", Theme.secondary, "Moved on early", names.joined(separator: ", "))
                }
            }
        }
    }

    private func summaryRow(_ icon: String, _ color: Color, _ label: String, _ value: String, detail: String? = nil) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon).foregroundStyle(color).frame(width: 28).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                Text(label).font(.subheadline).foregroundStyle(Theme.textSecondary)
                if let detail {
                    Text(detail).font(.caption2).foregroundStyle(Theme.textMuted)
                }
            }
            Spacer()
            Text(value).font(.body.weight(.bold)).foregroundStyle(Theme.text)
                .multilineTextAlignment(.trailing)
        }
        .padding(Space.lg).background(Theme.card).clipShape(.rect(cornerRadius: Radius.card)).softLift(strength: 0.6)
        .accessibilityElement(children: .combine)
    }

    private func missedCard(_ summary: LessonSummary) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(model.isCapstone ? "What slipped, with the answers" : "Missed items")
                .font(.headline).foregroundStyle(Theme.text)
            LessonMissedList(items: summary.missed)
            LessonSecondaryButton(title: "Practice these now", systemImage: "arrow.clockwise") {
                Haptics.select()
                model.practiceMissed(store: store)
            }
            if let notice = model.followUpNotice {
                Text(notice).font(.footnote).foregroundStyle(Theme.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Space.lg).background(Theme.card).clipShape(.rect(cornerRadius: Radius.card)).softLift(strength: 0.6)
    }

    private var unlockedCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("New skills unlocked", systemImage: "lock.open.fill")
                .font(.footnote.weight(.bold)).foregroundStyle(Theme.success)
            ForEach(model.unlockedConcepts, id: \.self) { name in
                Text("• \(name)").font(.footnote).foregroundStyle(Theme.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Space.lg).background(Theme.successLight).clipShape(.rect(cornerRadius: Radius.card))
        .accessibilityElement(children: .combine)
    }
}
