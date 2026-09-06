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
    @State private var showForceSignOutConfirm = false
    @State private var showResetConfirm = false
    @Environment(CloudSync.self) private var cloud: CloudSync?

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
                statBlock("\(store.visibleGaps.count)", "Active gaps")
                statBlock("\(store.masteredGaps.count)", "Mastered")
                statBlock("\(store.xp)", "XP")
            }
        }
        .frame(maxWidth: .infinity)
        .cardStyle(padding: 20)
    }

    /// ONE displayed level (`store.learnerLevel`, the ranker's view — the same
    /// number Home shows), with the placement result as the secondary line (D12).
    /// Before placement: "Not placed". Retaking is "Recalibrate": it blends new
    /// evidence in and never lowers what was earned (D8).
    private var levelCard: some View {
        let placed = store.hasCompletedAssessment
        let level = store.learnerLevel.rawValue
        let placedAt = store.assessedLevel.rawValue
        return Button {
            Haptics.select(); showAssessment = true
        } label: {
            HStack(spacing: 14) {
                ZStack {
                    Circle().fill(Theme.primaryGradient).frame(width: 48, height: 48)
                    Text(placed ? level : "—").font(.system(size: 16, weight: .heavy)).foregroundStyle(.white)
                }
                .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(placed ? "Your level: \(level)" : "Not placed")
                        .font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.text)
                    Text(placed
                         ? "Placed at \(placedAt) · Recalibrate any time — a retake only adds evidence"
                         : "Take the placement check to set your starting point")
                        .font(.footnote).foregroundStyle(Theme.textMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer()
                Image(systemName: "arrow.clockwise").font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.primary)
                    .accessibilityHidden(true)
            }
            .cardStyle(padding: 16)
        }
        .buttonStyle(.plain)
        .pressable()
        .accessibilityLabel(placed ? "Your level \(level), placed at \(placedAt)" : "Not placed")
        .accessibilityHint(placed ? "Recalibrate your level. A retake blends in new evidence and never lowers what you've earned." : "Take the placement check.")
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
            syncCard

            Button {
                Haptics.select(); showSignOutConfirm = true
            } label: {
                HStack {
                    Image(systemName: "rectangle.portrait.and.arrow.right").font(.system(size: 15, weight: .semibold))
                    Text(auth.isSigningOut ? "Backing up and signing out…" : "Sign out").font(.system(size: 15, weight: .semibold))
                    Spacer()
                    if auth.isSigningOut { ProgressView().tint(Theme.primary) }
                }
                .foregroundStyle(Theme.text)
                .cardStyle(padding: 16)
            }
            .buttonStyle(.plain)
            .pressable()
            .disabled(auth.isSigningOut)
        }
        .confirmationDialog("Sign out of your account?", isPresented: $showSignOutConfirm, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) {
                Task { await signOut(force: false) }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Your progress will be backed up to your account first, and will be here when you sign back in.")
        }
        .confirmationDialog("Couldn't back up your progress. Sign out anyway?", isPresented: $showForceSignOutConfirm, titleVisibility: .visible) {
            Button("Sign out anyway", role: .destructive) {
                Task { await signOut(force: true) }
            }
            Button("Keep me signed in", role: .cancel) {}
        } message: {
            Text("Anything not yet backed up will be lost from this device. You can stay signed in and try again once you're back online.")
        }
    }

    /// Backup status card driven by `CloudSync.syncState`.
    private var syncCard: some View {
        HStack(spacing: 12) {
            Image(systemName: syncIcon).font(.system(size: 18)).foregroundStyle(syncTint)
                .frame(width: 44, height: 44).background(syncTint.opacity(0.12)).clipShape(.rect(cornerRadius: 12))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(syncTitle).font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.text)
                Text(syncSubtitle).font(.system(size: 12)).foregroundStyle(Theme.textMuted)
            }
            Spacer(minLength: 0)
            if case .syncing = syncState {
                ProgressView().tint(Theme.secondary)
            } else if case .failed = syncState, cloud != nil {
                Button("Retry") {
                    Haptics.select()
                    Task { await cloud?.flushPending(store: store) }
                }
                .font(.system(size: 13, weight: .semibold))
                .buttonStyle(.bordered)
                .tint(Theme.primary)
                .accessibilityLabel("Retry backup")
            }
        }
        .cardStyle(padding: 14)
    }

    private var syncState: SyncState { cloud?.syncState ?? .localOnly }

    private var syncTitle: String {
        switch syncState {
        case .synced(let date): return "Backed up · \(Self.relativeAge(of: date))"
        case .syncing: return "Backing up…"
        case .failed: return "Backup failed — retry"
        case .idle: return "Not backed up yet"
        case .localOnly: return "Not signed in"
        }
    }

    private var syncSubtitle: String {
        switch syncState {
        case .synced: return "Your progress syncs across devices."
        case .syncing: return "Sending your latest progress to your account."
        case .failed(let message): return message
        case .idle: return "Your next answer will be backed up automatically."
        case .localOnly: return "Progress is only on this device."
        }
    }

    private var syncIcon: String {
        switch syncState {
        case .synced: return "checkmark.icloud.fill"
        case .syncing: return "arrow.triangle.2.circlepath.icloud.fill"
        case .failed: return "exclamationmark.icloud.fill"
        case .idle: return "icloud.fill"
        case .localOnly: return "icloud.slash.fill"
        }
    }

    private var syncTint: Color {
        switch syncState {
        case .synced, .syncing, .idle: return Theme.secondary
        case .failed: return Theme.error
        case .localOnly: return Theme.textMuted
        }
    }

    /// "just now" / "2 min. ago" / "3 hr. ago".
    private static func relativeAge(of date: Date) -> String {
        if Date().timeIntervalSince(date) < 60 { return "just now" }
        return date.formatted(.relative(presentation: .numeric, unitsStyle: .abbreviated))
    }

    /// Back up, then sign out. A failed backup surfaces the "sign out anyway?"
    /// dialog instead of wiping local progress.
    private func signOut(force: Bool) async {
        do {
            try await auth.signOut(force: force)
        } catch is SignOutBlocked {
            Haptics.select()
            showForceSignOutConfirm = true
        } catch {
            showForceSignOutConfirm = true
        }
    }

    private func statBlock(_ value: String, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.system(size: 18, weight: .bold)).foregroundStyle(Theme.primary)
            Text(label).font(.caption2).foregroundStyle(Theme.textMuted)
        }
        .accessibilityElement(children: .combine)
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

    /// DEBUG-only developer tools: the engine diagnostics screen (B14) and a reset
    /// that wipes every field of the store after confirmation. Release builds
    /// render nothing here — a real learner never sees either.
    @ViewBuilder
    private var resetButton: some View {
#if DEBUG
        NavigationLink {
            DiagnosticsView().environment(store)
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "waveform.path.ecg").font(.system(size: 13, weight: .semibold))
                Text("Engine diagnostics (debug)").font(.system(size: 14, weight: .medium))
            }
            .foregroundStyle(Theme.textMuted)
        }
        .padding(.top, 8)
        .accessibilityHint("Shows the per-lesson engine metrics log.")
        Button(role: .destructive) {
            showResetConfirm = true
        } label: {
            Text("Reset progress (debug)").font(.system(size: 14, weight: .medium)).foregroundStyle(Theme.error)
        }
        .padding(.top, 8)
        .accessibilityHint("Deletes all progress on this device and in your account.")
        .confirmationDialog("Reset all progress?", isPresented: $showResetConfirm, titleVisibility: .visible) {
            Button("Reset everything", role: .destructive) {
                store.resetProgress()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This wipes words, skills, streak, XP and preferences on this device and in your account. It cannot be undone.")
        }
#else
        EmptyView()
#endif
    }
}

// MARK: - Mastery streak card

/// Streak + weekly goal. Never celebrates a streak of 0 (D19): a fresh record
/// reads "Start your streak today", and the flame only lights once there is one.
/// The weekly goal (D11) counts days with a completed lesson this week against
/// `preferences.daysPerWeekGoal`.
struct MasteryStreakCard: View {
    @Environment(AppStore.self) private var store

    private var last7: [(date: Date, active: Bool)] {
        let today = Date()
        return (0..<7).reversed().map { offset in
            let d = store.calendar.date(byAdding: .day, value: -offset, to: today) ?? today
            return (d, store.masteredOn(d))
        }
    }

    var body: some View {
        let streak = store.currentStreak
        let best = store.longestStreak
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Image(systemName: streak > 0 ? "flame.fill" : "flame")
                    .foregroundStyle(streak > 0 ? Theme.primary : Theme.textMuted)
                    .accessibilityHidden(true)
                Text("Mastery streak").font(.serifDisplay(19, weight: .semibold)).foregroundStyle(Theme.text)
                Spacer()
                if best > 0 {
                    Text("Best: \(best)d")
                        .font(.caption.weight(.semibold)).foregroundStyle(Theme.primaryDark)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(Theme.primaryLight).clipShape(.capsule)
                }
            }
            if streak > 0 {
                HStack(alignment: .bottom, spacing: 8) {
                    Text("\(streak)").font(.system(size: 40, weight: .heavy)).foregroundStyle(Theme.primary)
                    Text(streak == 1 ? "day — keep it going" : "days in a row")
                        .font(.subheadline).foregroundStyle(Theme.textMuted).padding(.bottom, 8)
                }
                .accessibilityElement(children: .combine)
            } else {
                Text("Start your streak today")
                    .font(.system(size: 22, weight: .bold)).foregroundStyle(Theme.text)
                Text("Master a word in a lesson and day one is yours.")
                    .font(.subheadline).foregroundStyle(Theme.textMuted)
            }
            if let goal = store.weeklyGoalProgress {
                weeklyGoalRow(done: goal.done, goal: goal.goal)
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
                .font(.caption).foregroundStyle(Theme.textMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle(padding: 18)
    }

    /// "3 of 5 days this week" with a bar; met goals read as done, never inflated.
    private func weeklyGoalRow(done: Int, goal: Int) -> some View {
        let fraction = goal > 0 ? min(1, Double(done) / Double(goal)) : 0
        let met = done >= goal
        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(met ? "Weekly goal met" : "Weekly goal")
                    .font(.footnote.weight(.semibold)).foregroundStyle(Theme.text)
                Spacer()
                Text("\(done) of \(goal) days this week")
                    .font(.footnote).foregroundStyle(met ? Theme.success : Theme.textMuted)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.border.opacity(0.6)).frame(height: 6)
                    Capsule().fill(met ? Theme.success : Theme.secondary).frame(width: geo.size.width * fraction, height: 6)
                }
            }
            .frame(height: 6)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Weekly goal")
        .accessibilityValue("\(done) of \(goal) days this week")
    }

    private func weekday(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = store.calendar
        f.dateFormat = "EEEEE"
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
            // The only two "due" numbers the app shows (D13).
            HStack {
                retentionStat("\(store.masteredThisWeek)", "mastered this week")
                Spacer()
                retentionStat("\(store.dueNow.count)", "Due now")
                Spacer()
                retentionStat("\(store.upcoming.count)", "Coming up")
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
            Text(label).font(.caption2).foregroundStyle(Theme.textMuted)
        }
        .accessibilityElement(children: .combine)
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
