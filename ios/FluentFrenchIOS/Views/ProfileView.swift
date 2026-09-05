//
//  ProfileView.swift
//  FluentFrenchIOS
//
//  Profile + analytics: mastery streak grid, retention curve, and error-pattern
//  insights — mirroring the Expo app's profile additions.
//

import SwiftUI

struct ProfileView: View {
    @Environment(AppStore.self) private var store
    @Environment(AuthManager.self) private var auth
    @Environment(\.dismiss) private var dismiss
    @State private var showAssessment = false
    @State private var showPreferences = false
    @State private var showSignOutConfirm = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    profileHeader
                    levelCard
                    preferencesCard
                    MasteryStreakCard()
                    RetentionCard()
                    errorPatternsSection
                    accountSection
                    resetButton
                }
                .padding(20)
            }
            .fullScreenCover(isPresented: $showAssessment) {
                AssessmentView(isFirstRun: false).environment(store)
            }
            .sheet(isPresented: $showPreferences) {
                PreferencesView(isOnboarding: false).environment(store)
            }
            .background(Theme.background)
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.tint(Theme.primary)
                }
            }
        }
    }

    private var profileHeader: some View {
        VStack(spacing: 10) {
            avatar
            VStack(spacing: 2) {
                Text(displayName).font(.serifDisplay(24, weight: .bold)).foregroundStyle(Theme.text)
                if let email = auth.user?.email, !email.isEmpty {
                    Text(email).font(.system(size: 13)).foregroundStyle(Theme.textMuted)
                }
            }
            HStack(spacing: 20) {
                statBlock("\(store.activeGaps.count)", "Active gaps")
                statBlock("\(store.masteredGaps.count)", "Mastered")
                statBlock("θ \(String(format: "%.1f", store.abilityTheta))", "Ability")
            }
        }
        .frame(maxWidth: .infinity)
        .cardStyle(padding: 20)
    }

    private var levelCard: some View {
        Button {
            Haptics.select(); showAssessment = true
        } label: {
            HStack(spacing: 14) {
                ZStack {
                    Circle().fill(Theme.primaryGradient).frame(width: 48, height: 48)
                    Text(store.assessedLevel.rawValue).font(.system(size: 16, weight: .heavy)).foregroundStyle(.white)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text("Your level: \(store.assessedLevel.rawValue)").font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.text)
                    Text("Re-take the placement check to recalibrate").font(.system(size: 13)).foregroundStyle(Theme.textMuted)
                }
                Spacer()
                Image(systemName: "arrow.clockwise").font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.primary)
            }
            .cardStyle(padding: 16)
        }
        .buttonStyle(.plain)
        .pressable()
    }

    private var preferencesCard: some View {
        let prefs = store.preferences ?? .default
        let activities = LearningModality.allCases.filter { prefs.modalities.contains($0) }.map { $0.label }.joined(separator: ", ")
        return Button {
            Haptics.select(); showPreferences = true
        } label: {
            HStack(spacing: 14) {
                Image(systemName: "slider.horizontal.3").font(.system(size: 18)).foregroundStyle(Theme.secondary)
                    .frame(width: 48, height: 48).background(Theme.secondaryLight).clipShape(.rect(cornerRadius: 14))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Daily plan: \(prefs.timeBudget.label)").font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.text)
                    Text(activities.isEmpty ? "Set your activities" : activities).font(.system(size: 13)).foregroundStyle(Theme.textMuted).lineLimit(1)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.secondary)
            }
            .cardStyle(padding: 16)
        }
        .buttonStyle(.plain)
        .pressable()
    }

    private var displayName: String {
        if let name = auth.user?.name, !name.isEmpty { return name }
        if let email = auth.user?.email, let handle = email.split(separator: "@").first {
            return String(handle)
        }
        return "Apprenant"
    }

    @ViewBuilder private var avatar: some View {
        if let urlString = auth.user?.avatarURL, let url = URL(string: urlString) {
            AsyncImage(url: url) { image in
                image.resizable().aspectRatio(contentMode: .fill)
            } placeholder: {
                Circle().fill(Theme.primaryLight)
            }
            .frame(width: 72, height: 72)
            .clipShape(.circle)
        } else {
            Image(systemName: "person.crop.circle.fill")
                .font(.system(size: 64)).foregroundStyle(Theme.primary)
        }
    }

    private var accountSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Account")
            HStack(spacing: 12) {
                Image(systemName: "icloud.fill").font(.system(size: 18)).foregroundStyle(Theme.secondary)
                    .frame(width: 44, height: 44).background(Theme.secondaryLight).clipShape(.rect(cornerRadius: 12))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Backed up to your account").font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.text)
                    Text("Your progress syncs across devices automatically.").font(.system(size: 12)).foregroundStyle(Theme.textMuted)
                }
                Spacer(minLength: 0)
            }
            .cardStyle(padding: 14)

            Button {
                Haptics.select(); showSignOutConfirm = true
            } label: {
                HStack {
                    Image(systemName: "rectangle.portrait.and.arrow.right").font(.system(size: 15, weight: .semibold))
                    Text("Sign out").font(.system(size: 15, weight: .semibold))
                    Spacer()
                }
                .foregroundStyle(Theme.text)
                .cardStyle(padding: 16)
            }
            .buttonStyle(.plain)
            .pressable()
        }
        .confirmationDialog("Sign out of your account?", isPresented: $showSignOutConfirm, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) {
                dismiss()
                Task { await auth.signOut() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Your progress is saved to your account and will be here when you sign back in.")
        }
    }

    private func statBlock(_ value: String, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.system(size: 18, weight: .bold)).foregroundStyle(Theme.primary)
            Text(label).font(.system(size: 11)).foregroundStyle(Theme.textMuted)
        }
    }

    private var errorPatternsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SectionHeader(title: "Your patterns")
                Spacer()
                NavigationLink { ErrorPatternsView() } label: {
                    Text("See all").font(.system(size: 13, weight: .medium)).foregroundStyle(Theme.primary)
                }
            }
            if store.errorPatterns.isEmpty {
                Text("No mistake patterns yet — keep practicing!")
                    .font(.system(size: 14)).foregroundStyle(Theme.textMuted)
                    .frame(maxWidth: .infinity).padding(.vertical, 20)
                    .cardStyle()
            } else {
                ForEach(store.errorPatterns.prefix(3)) { pattern in
                    NavigationLink { ErrorPatternDetailView(pattern: pattern) } label: {
                        ErrorPatternCard(pattern: pattern)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var resetButton: some View {
        Button(role: .destructive) {
            store.resetProgress()
        } label: {
            Text("Reset demo progress").font(.system(size: 14, weight: .medium)).foregroundStyle(Theme.error)
        }
        .padding(.top, 8)
    }
}

// MARK: - Mastery streak card

struct MasteryStreakCard: View {
    @Environment(AppStore.self) private var store

    private var last7: [(date: Date, active: Bool)] {
        (0..<7).reversed().map { offset in
            let d = Date().addingTimeInterval(-Double(offset) * 86_400)
            return (d, store.masteredOn(d))
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Image(systemName: "flame.fill").foregroundStyle(Theme.primary)
                Text("Mastery streak").font(.serifDisplay(19, weight: .semibold)).foregroundStyle(Theme.text)
                Spacer()
                Text("Best: \(store.longestStreak)d")
                    .font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.primaryDark)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Theme.primaryLight).clipShape(.capsule)
            }
            HStack(alignment: .bottom, spacing: 8) {
                Text("\(store.currentStreak)").font(.system(size: 40, weight: .heavy)).foregroundStyle(Theme.primary)
                Text("days in a row")
                    .font(.system(size: 14)).foregroundStyle(Theme.textMuted).padding(.bottom, 8)
            }
            HStack(spacing: 8) {
                ForEach(Array(last7.enumerated()), id: \.offset) { _, day in
                    VStack(spacing: 4) {
                        RoundedRectangle(cornerRadius: 8)
                            .fill(day.active ? Theme.primaryGradient : LinearGradient(colors: [Theme.border], startPoint: .top, endPoint: .bottom))
                            .frame(height: 36)
                            .overlay {
                                if day.active { Image(systemName: "checkmark").font(.system(size: 12, weight: .bold)).foregroundStyle(.white) }
                            }
                        Text(weekday(day.date)).font(.system(size: 10)).foregroundStyle(Theme.textMuted)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            Text("Counts only days you mastered a word — not minutes spent.")
                .font(.system(size: 12)).foregroundStyle(Theme.textMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle(padding: 18)
    }

    private func weekday(_ date: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "EEEEE"
        return f.string(from: date)
    }
}

// MARK: - Retention card

struct RetentionCard: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        let buckets = store.retention
        return VStack(alignment: .leading, spacing: 14) {
            HStack {
                Image(systemName: "waveform.path.ecg").foregroundStyle(Theme.secondary)
                Text("Retention").font(.serifDisplay(19, weight: .semibold)).foregroundStyle(Theme.text)
                Spacer()
                Text("\(store.overallRetention)%")
                    .font(.system(size: 20, weight: .heavy)).foregroundStyle(Theme.secondary)
            }
            // Curve bar
            GeometryReader { geo in
                let total = max(1, buckets.fresh.count + buckets.fading.count + buckets.atRisk.count)
                HStack(spacing: 2) {
                    segment(width: geo.size.width, fraction: Double(buckets.fresh.count) / Double(total), color: Theme.success)
                    segment(width: geo.size.width, fraction: Double(buckets.fading.count) / Double(total), color: Theme.warning)
                    segment(width: geo.size.width, fraction: Double(buckets.atRisk.count) / Double(total), color: Theme.error)
                }
            }
            .frame(height: 10)
            .clipShape(.capsule)

            HStack(spacing: 16) {
                legend(Theme.success, "Fresh", buckets.fresh.count)
                legend(Theme.warning, "Fading", buckets.fading.count)
                legend(Theme.error, "At risk", buckets.atRisk.count)
            }

            Divider()
            HStack {
                retentionStat("\(store.masteredThisWeek)", "mastered this week")
                Spacer()
                retentionStat("\(store.dueGaps.count + store.criticalGaps.count)", "due now")
                Spacer()
                retentionStat("\(buckets.atRisk.count)", "slipping back")
            }
            NavigationLink { RetentionView() } label: {
                HStack {
                    Text("See full breakdown").font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.secondary)
                    Spacer()
                    Image(systemName: "chevron.right").font(.system(size: 13)).foregroundStyle(Theme.secondary)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle(padding: 18)
    }

    private func segment(width: CGFloat, fraction: Double, color: Color) -> some View {
        Rectangle().fill(color).frame(width: max(0, width * fraction))
    }

    private func legend(_ color: Color, _ label: String, _ count: Int) -> some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 7, height: 7)
            Text("\(label) \(count)").font(.system(size: 12)).foregroundStyle(Theme.textSecondary)
        }
    }

    private func retentionStat(_ value: String, _ label: String) -> some View {
        VStack(spacing: 1) {
            Text(value).font(.system(size: 17, weight: .bold)).foregroundStyle(Theme.text)
            Text(label).font(.system(size: 10)).foregroundStyle(Theme.textMuted)
        }
    }
}

// MARK: - Error pattern card

struct ErrorPatternCard: View {
    let pattern: AppStore.ErrorPattern
    var body: some View {
        HStack(spacing: 12) {
            Capsule().fill(pattern.category.color).frame(width: 4, height: 40)
            VStack(alignment: .leading, spacing: 3) {
                Text(pattern.headline).font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.text).lineLimit(2)
                Text("\(pattern.count) mistake\(pattern.count == 1 ? "" : "s") · \(pattern.category.label)")
                    .font(.system(size: 12)).foregroundStyle(Theme.textMuted)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.system(size: 13)).foregroundStyle(Theme.textMuted)
        }
        .cardStyle(padding: 14)
    }
}
