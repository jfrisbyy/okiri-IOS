//
//  PreferencesView.swift
//  FluentFrenchIOS
//
//  A short, ~3-tap setup that sets the FLOOR for the daily plan: which activities
//  the learner is up for and how much time they have. Reused for first-run
//  onboarding and for later editing from the Profile. It never asks the learner to
//  choose topics or content — only the shape constraints. A picked activity that
//  the readiness gate has not opened yet says so (D2); the days-per-week goal
//  drives the weekly goal on Home and Profile (D11).
//

import SwiftUI

struct PreferencesView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    /// True during first-run onboarding (hides the close button, different copy).
    let isOnboarding: Bool

    @State private var modalities: Set<LearningModality> = []
    @State private var budget: TimeBudget = .standard
    @State private var daysGoal: Int? = nil
    /// Icon tiles and the header medallion grow with the learner's text size so
    /// the glyphs inside them never outgrow their backgrounds.
    @ScaledMetric(relativeTo: .largeTitle) private var markScale: CGFloat = 1
    @ScaledMetric(relativeTo: .body) private var tileScale: CGFloat = 1
    /// Clamped multipliers: past `Theme.maxChromeScale` a tile would take the whole
    /// row it shares with text, so the containers stop growing there.
    private var mark: CGFloat { Theme.chromeScale(markScale) }
    private var tile: CGFloat { Theme.chromeScale(tileScale) }

    private static let accent = Color(hex: "4F46E5")

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: Space.xl) {
                    headerBlock
                    activitiesSection
                    budgetSection
                    daysSection
                    Spacer(minLength: 8)
                }
                .padding(Space.xl)
            }
            .safeAreaInset(edge: .bottom) { saveBar }
        }
        .onAppear(perform: hydrate)
    }

    private var headerBlock: some View {
        VStack(alignment: .leading, spacing: 10) {
            if !isOnboarding {
                HStack {
                    Spacer()
                    Button { dismiss() } label: {
                        Image(systemName: "xmark").scaledFont(16, weight: .semibold).foregroundStyle(Theme.textSecondary)
                            .frame(width: 32 * tile, height: 32 * tile)
                            .background(Theme.card).clipShape(.circle).softLift(strength: 0.5)
                            .minimumHitTarget()
                    }
                    .accessibilityLabel("Close")
                    .accessibilityHint("Closes preferences without saving")
                }
            }
            ZStack {
                Circle().fill(Self.accent)
                    .frame(width: 72 * mark, height: 72 * mark)
                    .softLift(radius: 16, y: 8, strength: 2)
                Image(systemName: "slider.horizontal.3").scaledFont(30).foregroundStyle(.white)
            }
            .padding(.top, isOnboarding ? 16 : 0)
            .accessibilityHidden(true)
            Text(isOnboarding ? "Shape your daily practice" : "Daily practice preferences")
                .scaledSerifDisplay(28, weight: .bold).foregroundStyle(Theme.text)
            Text("Pick what you're up for and how much time you have. We'll prescribe the shape of each day — you always pick what to read, watch, or say.")
                .font(.callout).foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Activities

    private var activitiesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionLabel("WHICH ACTIVITIES?", required: true)
            VStack(spacing: 10) {
                ForEach(LearningModality.allCases) { m in
                    activityRow(m)
                }
            }
        }
    }

    /// What the gate says about a picked activity that is not open yet (D2). The
    /// plan skips a locked activity until it unlocks; the learner should know why
    /// their pick is not showing up. Nil when the activity is open.
    private func lockNote(_ m: LearningModality) -> String? {
        switch store.readiness(for: m) {
        case .unlocked: return nil
        case .foundation: return "Opening up — short pieces at your level for now."
        case .locked: return "Not open yet — your plan skips it until it unlocks."
        }
    }

    private func activityRow(_ m: LearningModality) -> some View {
        let selected = modalities.contains(m)
        let note = lockNote(m)
        return Button {
            Haptics.tap()
            if selected { modalities.remove(m) } else { modalities.insert(m) }
        } label: {
            HStack(spacing: 14) {
                Image(systemName: m.icon).scaledFont(18).foregroundStyle(selected ? .white : Theme.primary)
                    .frame(width: 44 * tile, height: 44 * tile)
                    .background(selected ? Theme.primary : Theme.primaryLight).clipShape(.rect(cornerRadius: 12))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(m.label).scaledFont(16, weight: .semibold).foregroundStyle(Theme.text)
                        if note != nil {
                            Image(systemName: "lock.fill").font(.caption2).foregroundStyle(Theme.textMuted)
                                .accessibilityHidden(true)
                        }
                    }
                    Text(m.subtitle).font(.footnote).foregroundStyle(Theme.textSecondary)
                    if selected, let note {
                        Text(note).font(.caption).foregroundStyle(Theme.warning)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer()
                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                    .scaledFont(22).foregroundStyle(selected ? Theme.primary : Theme.border)
                    .accessibilityHidden(true)
            }
            .padding(Space.lg)
            .background(Theme.card).clipShape(.rect(cornerRadius: Radius.card))
            .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(selected ? Theme.primary : Theme.border.opacity(0.5), lineWidth: selected ? 1.5 : 0.5))
        }
        .buttonStyle(.plain)
        .pressable()
        .accessibilityLabel("\(m.label), \(m.subtitle)\(note.map { ". " + $0 } ?? "")")
        .accessibilityValue(selected ? "Selected" : "Not selected")
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    // MARK: - Time budget

    private var budgetSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionLabel("DAILY TIME BUDGET", required: false)
            HStack(spacing: 10) {
                ForEach(TimeBudget.allCases) { b in
                    budgetCard(b)
                }
            }
        }
    }

    private func budgetCard(_ b: TimeBudget) -> some View {
        let selected = budget == b
        return Button {
            Haptics.tap(); budget = b
        } label: {
            VStack(spacing: 6) {
                Text(b.label).scaledFont(16, weight: .bold).foregroundStyle(selected ? .white : Theme.text)
                Text(b.subtitle).font(.caption2).foregroundStyle(selected ? .white.opacity(0.9) : Theme.textSecondary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity).padding(.vertical, 16).padding(.horizontal, 6)
            .background(selected ? Theme.primary : Theme.card).clipShape(.rect(cornerRadius: Radius.card))
            .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(selected ? .clear : Theme.border.opacity(0.5), lineWidth: 0.5))
        }
        .buttonStyle(.plain)
        .pressable()
        .accessibilityLabel("\(b.label), \(b.subtitle)")
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    // MARK: - Days per week (optional)

    private var daysSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionLabel("DAYS PER WEEK (OPTIONAL)", required: false)
            HStack(spacing: 8) {
                ForEach(Tuning.weeklyGoalChoices, id: \.self) { d in
                    let selected = daysGoal == d
                    Button {
                        Haptics.tap()
                        daysGoal = selected ? nil : d
                    } label: {
                        Text("\(d)")
                            .scaledFont(16, weight: .bold).foregroundStyle(selected ? .white : Theme.text)
                            .frame(maxWidth: .infinity).frame(minHeight: Theme.minimumHitTarget).padding(.vertical, 2)
                            .background(selected ? Theme.secondary : Theme.card).clipShape(.rect(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(selected ? .clear : Theme.border.opacity(0.5), lineWidth: 0.5))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(d) days a week")
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
            Text(daysGoal.map { "A \($0)-day goal shows on Home and your profile as days with a lesson this week." }
                 ?? "Set a goal and Home tracks the days you complete a lesson each week.")
                .font(.caption).foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Save

    private var saveBar: some View {
        let enabled = !modalities.isEmpty
        return Button {
            guard enabled else { return }
            Haptics.success()
            store.setPreferences(UserPreferences(modalities: modalities, timeBudget: budget, daysPerWeekGoal: daysGoal))
            dismiss()
        } label: {
            Text(enabled ? (isOnboarding ? "Start learning" : "Save") : "Pick at least one activity")
                .scaledFont(17, weight: .bold).foregroundStyle(.white)
                .frame(maxWidth: .infinity).padding(.vertical, 16)
                // The disabled fill still has to carry readable white instruction copy.
                .background(enabled ? Theme.primary : Theme.textSecondary)
                .clipShape(.rect(cornerRadius: 14))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .padding(Space.xl)
        .background(.ultraThinMaterial)
    }

    private func sectionLabel(_ text: String, required: Bool) -> some View {
        HStack(spacing: 6) {
            Text(text).font(.caption.weight(.bold)).foregroundStyle(Theme.textSecondary).tracking(0.5)
            if required {
                Text("required").font(.caption2.weight(.semibold)).foregroundStyle(Theme.primary)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Theme.primaryLight).clipShape(.capsule)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }

    private func hydrate() {
        if let p = store.preferences {
            modalities = p.modalities
            budget = p.timeBudget
            daysGoal = p.daysPerWeekGoal
        } else {
            let d = UserPreferences.default
            modalities = d.modalities
            budget = d.timeBudget
            daysGoal = d.daysPerWeekGoal
        }
    }
}
