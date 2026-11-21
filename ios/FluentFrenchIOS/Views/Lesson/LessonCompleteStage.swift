//
//  LessonCompleteStage.swift
//  FluentFrenchIOS
//
//  The completion screen and the out-of-hearts recap (C5 / C26): first-attempt
//  accuracy, the capstone held/slipped tally (C16), XP, best run, an honest
//  level line (no theta decimals), the missed items with their answers and
//  "Practice these now", and any skills unlocked. The day line ("Lesson 1 of 3
//  done", "Day 1 streak started") and the "Next lesson" button continue the day
//  (UX-05); the numbers come from `AppStore.nextLessonOffer`, the words from
//  `LessonCopy`.
//

import SwiftUI

struct LessonCompleteStage: View {
    let model: LessonViewModel
    let onDone: () -> Void
    @Environment(AppStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// Drives the streak flame's one bounce when the streak ticked (UX-05).
    @State private var streakBeat = false
    /// Icon gutters grow with the type ratio so nothing spills out of them at
    /// large text sizes (G1). Small chrome only — the body curve reaches ~3.1x
    /// at the largest accessibility sizes.
    @ScaledMetric(relativeTo: .body) private var typeScale: CGFloat = 1
    /// The score ring follows the large-title curve its number uses, clamped so
    /// the disc never outgrows the narrowest phone.
    @ScaledMetric(relativeTo: .largeTitle) private var ringSize: CGFloat = 130
    private var ring: CGFloat { min(ringSize, 200) }

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
                        VStack(spacing: 8) {
                            Text("The lesson stopped at zero hearts. Here's what slipped — and a quick way to go over it.")
                                .font(.subheadline).foregroundStyle(Theme.textSecondary)
                                .multilineTextAlignment(.center)
                                .fixedSize(horizontal: false, vertical: true)
                            // Never leave the learner to work out why Home still says
                            // zero lessons today: say which way it went (C5).
                            Text(summary.isCompleted
                                 ? "You answered most of it, so it still counts toward today. Your answers are saved."
                                 : "It stopped too early to count toward today's lessons — but every answer you gave was saved.")
                                .font(.footnote).foregroundStyle(Theme.textSecondary)
                                .multilineTextAlignment(.center)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    if model.isCapstone {
                        capstoneTally(summary)
                    }
                    if let offer = model.nextLessonOffer {
                        dayCard(offer)
                    }
                    if model.isNewBest {
                        Label("New personal best!", systemImage: "trophy.fill")
                            .font(.subheadline.weight(.bold)).foregroundStyle(Theme.warningText)
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
            buttons
                .padding(Space.xl)
        }
    }

    /// The buttons `LessonCompletionActions` decided on: after running out of hearts
    /// "Practice these now" leads; otherwise "Next lesson" leads while the day has
    /// lessons to go (UX-05). "Done" is the way out, drawn in the style
    /// `LessonCompletionActions.doneStyle` picked: plain text under the
    /// out-of-hearts lead, so it never reads as a second "Next lesson". A "Next
    /// lesson" that came back empty is replaced by a line saying so, and an empty
    /// out-of-hearts "Practice these now" leaves its notice here, where it was tapped.
    @ViewBuilder
    private var buttons: some View {
        let actions = model.completionActions
        VStack(spacing: 8) {
            if actions.practiceNoticeByButtons, let notice = model.followUpNotice {
                note(notice)
            }
            if let line = actions.nextLessonNote {
                note(line)
            }
            switch actions.lead {
            case .practiceMissed:
                LessonPrimaryButton(title: LessonCopy.practiceMissedButton, action: practiceMissed)
                if actions.offersNextLesson {
                    LessonSecondaryButton(title: LessonCopy.nextLessonButton, action: startNextLesson)
                }
            case .nextLesson:
                LessonPrimaryButton(title: LessonCopy.nextLessonButton, action: startNextLesson)
            case .done:
                EmptyView()
            }
            switch actions.doneStyle {
            case .primary: LessonPrimaryButton(title: LessonCopy.doneButton, action: onDone)
            case .secondary: LessonSecondaryButton(title: LessonCopy.doneButton, action: onDone)
            case .plain: LessonTertiaryButton(title: LessonCopy.doneButton, action: onDone)
            }
        }
    }

    private func note(_ text: String) -> some View {
        Text(text).font(.footnote).foregroundStyle(Theme.textSecondary)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func startNextLesson() {
        Haptics.select()
        model.startNextLesson(store: store)
    }

    private func practiceMissed() {
        Haptics.select()
        model.practiceMissed(store: store)
    }

    /// Where the day stands: "Lesson 1 of 3 done" and "Day 1 streak started".
    private func dayCard(_ offer: NextLessonOffer) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Image(systemName: "graduationcap.fill").foregroundStyle(Theme.secondary)
                    .frame(width: 28 * Theme.chromeScale(typeScale)).accessibilityHidden(true)
                Text(LessonCopy.dayLine(offer)).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
            if let streak = LessonCopy.streakLine(offer) {
                HStack(spacing: 10) {
                    Image(systemName: "flame.fill").foregroundStyle(Theme.primary)
                        .frame(width: 28 * Theme.chromeScale(typeScale)).accessibilityHidden(true)
                        .symbolEffect(.bounce, value: streakBeat)
                    Text(streak).font(.subheadline.weight(.bold))
                        .foregroundStyle(offer.celebrates ? Theme.primaryText : Theme.text)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                }
            }
        }
        .padding(Space.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card).clipShape(.rect(cornerRadius: Radius.card)).softLift(strength: 0.6)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(LessonCopy.spokenSummary(offer))
        .onAppear {
            // The haptic fired when the lesson was booked; the bounce is the visual
            // half of the same beat, and Reduce Motion skips it.
            if offer.celebrates && !reduceMotion { streakBeat.toggle() }
        }
    }

    // MARK: Pieces

    private func scoreRing(_ summary: LessonSummary) -> some View {
        ZStack {
            Circle().fill(Theme.primaryGradient)
                .frame(width: ring, height: ring)
                .softLift(radius: 20, y: 10, strength: 2)
            VStack(spacing: 0) {
                Text("\(summary.accuracyPercent)%").font(.system(.largeTitle, design: .rounded, weight: .heavy)).foregroundStyle(.white)
                    .lineLimit(1).minimumScaleFactor(0.6)
                Text("\(summary.scoredCorrect)/\(summary.scored)").font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.85))
                    .lineLimit(1).minimumScaleFactor(0.6)
            }
            .padding(.horizontal, 12)
            .frame(maxWidth: ring)
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
        // The missed card below already lists every slipped item WITH its answer, so
        // naming them here too prints the same French words twice in one scroll. Only
        // a slip that card cannot show (one with no missed entry) is listed here.
        let listed = Set(summary.missed.map(\.gap.id))
        var seen = Set<String>()
        let unlisted = summary.slipped.filter { !listed.contains($0.id) && seen.insert($0.id).inserted }
        return VStack(spacing: 10) {
            HStack(spacing: 10) {
                tallyChip("checkmark.circle.fill", Theme.success, "\(summary.held.count)", "held")
                tallyChip("xmark.circle.fill", Theme.error, "\(summary.slipped.count)", "slipped")
            }
            if !unlisted.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("SLIPPED").font(.caption.weight(.bold)).foregroundStyle(Theme.errorText).tracking(0.3)
                    ForEach(unlisted) { gap in
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
                Text(label).font(.caption2).foregroundStyle(Theme.textSecondary)
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
                summaryRow("checkmark.seal.fill", Theme.success, LessonCopy.solidSummaryLabel, "\(summary.masteredCount)")
            }
            summaryRow("star.fill", Theme.warning, "XP earned", "+\(summary.xp + bonus)",
                       detail: bonus > 0 ? "includes +\(bonus) for finishing" : nil)
            summaryRow(LessonCopy.runSymbol, Theme.primary, LessonCopy.bestRunLabel, LessonCopy.bestRunValue(summary.bestCombo))
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
            Image(systemName: icon).foregroundStyle(color).frame(width: 28 * Theme.chromeScale(typeScale)).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                Text(label).font(.subheadline).foregroundStyle(Theme.textSecondary)
                if let detail {
                    Text(detail).font(.caption2).foregroundStyle(Theme.textSecondary)
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
            // After running out of hearts the same action leads the bottom bar, so
            // the card does not offer it a second time.
            if model.completionActions.practiceInMissedCard {
                LessonSecondaryButton(title: LessonCopy.practiceMissedButton, systemImage: "arrow.clockwise",
                                      action: practiceMissed)
            }
            // Once the out-of-hearts lead came back empty its notice sits by the
            // bottom buttons, where it was tapped; it is not printed twice.
            if !model.completionActions.practiceNoticeByButtons, let notice = model.followUpNotice {
                Text(notice).font(.footnote).foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Space.lg).background(Theme.card).clipShape(.rect(cornerRadius: Radius.card)).softLift(strength: 0.6)
    }

    private var unlockedCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("New skills unlocked", systemImage: "lock.open.fill")
                .font(.footnote.weight(.bold)).foregroundStyle(Theme.successText)
            ForEach(model.unlockedConcepts, id: \.self) { name in
                Text("• \(name)").font(.footnote).foregroundStyle(Theme.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Space.lg).background(Theme.successLight).clipShape(.rect(cornerRadius: Radius.card))
        .accessibilityElement(children: .combine)
    }
}
