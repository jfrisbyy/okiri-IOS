//
//  PreferencesView.swift
//  FluentFrenchIOS
//
//  A short, ~3-tap setup that sets the FLOOR for the daily plan: which activities
//  the learner is up for and how much time they have. Reused for first-run
//  onboarding and for later editing from the Profile. It never asks the learner to
//  choose topics or content — only the shape constraints.
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
                        Image(systemName: "xmark").font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.textMuted)
                            .frame(width: 32, height: 32).background(Theme.card).clipShape(.circle).softLift(strength: 0.5)
                    }
                }
            }
            ZStack {
                Circle().fill(Self.accent).frame(width: 72, height: 72).softLift(radius: 16, y: 8, strength: 2)
                Image(systemName: "slider.horizontal.3").font(.system(size: 30)).foregroundStyle(.white)
            }
            .padding(.top, isOnboarding ? 16 : 0)
            Text(isOnboarding ? "Shape your daily practice" : "Daily practice preferences")
                .font(.serifDisplay(28, weight: .bold)).foregroundStyle(Theme.text)
            Text("Pick what you're up for and how much time you have. We'll prescribe the shape of each day — you always pick what to read, watch, or say.")
                .font(.system(size: 15)).foregroundStyle(Theme.textSecondary)
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

    private func activityRow(_ m: LearningModality) -> some View {
        let selected = modalities.contains(m)
        return Button {
            Haptics.tap()
            if selected { modalities.remove(m) } else { modalities.insert(m) }
        } label: {
            HStack(spacing: 14) {
                Image(systemName: m.icon).font(.system(size: 18)).foregroundStyle(selected ? .white : Theme.primary)
                    .frame(width: 44, height: 44)
                    .background(selected ? Theme.primary : Theme.primaryLight).clipShape(.rect(cornerRadius: 12))
                VStack(alignment: .leading, spacing: 2) {
                    Text(m.label).font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.text)
                    Text(m.subtitle).font(.system(size: 13)).foregroundStyle(Theme.textMuted)
                }
                Spacer()
                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22)).foregroundStyle(selected ? Theme.primary : Theme.border)
            }
            .padding(Space.lg)
            .background(Theme.card).clipShape(.rect(cornerRadius: Radius.card))
            .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(selected ? Theme.primary : Theme.border.opacity(0.5), lineWidth: selected ? 1.5 : 0.5))
        }
        .buttonStyle(.plain)
        .pressable()
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
                Text(b.label).font(.system(size: 16, weight: .bold)).foregroundStyle(selected ? .white : Theme.text)
                Text(b.subtitle).font(.system(size: 11)).foregroundStyle(selected ? .white.opacity(0.85) : Theme.textMuted)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity).padding(.vertical, 16).padding(.horizontal, 6)
            .background(selected ? Theme.primary : Theme.card).clipShape(.rect(cornerRadius: Radius.card))
            .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(selected ? .clear : Theme.border.opacity(0.5), lineWidth: 0.5))
        }
        .buttonStyle(.plain)
        .pressable()
    }

    // MARK: - Days per week (optional)

    private var daysSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionLabel("DAYS PER WEEK (OPTIONAL)", required: false)
            HStack(spacing: 8) {
                ForEach([3, 4, 5, 6, 7], id: \.self) { d in
                    let selected = daysGoal == d
                    Button {
                        Haptics.tap()
                        daysGoal = selected ? nil : d
                    } label: {
                        Text("\(d)")
                            .font(.system(size: 16, weight: .bold)).foregroundStyle(selected ? .white : Theme.text)
                            .frame(maxWidth: .infinity).padding(.vertical, 14)
                            .background(selected ? Theme.secondary : Theme.card).clipShape(.rect(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(selected ? .clear : Theme.border.opacity(0.5), lineWidth: 0.5))
                    }
                    .buttonStyle(.plain)
                }
            }
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
                .font(.system(size: 17, weight: .bold)).foregroundStyle(.white)
                .frame(maxWidth: .infinity).padding(.vertical, 16)
                .background(enabled ? Theme.primary : Theme.textMuted)
                .clipShape(.rect(cornerRadius: 14))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .padding(Space.xl)
        .background(.ultraThinMaterial)
    }

    private func sectionLabel(_ text: String, required: Bool) -> some View {
        HStack(spacing: 6) {
            Text(text).font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.textMuted).tracking(0.5)
            if required {
                Text("required").font(.system(size: 10, weight: .semibold)).foregroundStyle(Theme.primary)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Theme.primaryLight).clipShape(.capsule)
            }
        }
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
