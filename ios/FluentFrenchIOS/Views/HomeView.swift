//
//  HomeView.swift
//  FluentFrenchIOS
//
//  Signature landing screen — faithfully mirrors the Expo home:
//  an orange gradient header with the flag, CEFR badge and Kiri mascot,
//  an overlapping stat-chip card, "Recommended for you" cards, and the
//  signature horizontal sliding carousel of scaling feature cards.
//

import SwiftUI

// MARK: - Feature card model

private struct FeatureCard: Identifiable {
    let id: String
    let title: String
    let subtitle: String
    let description: String
    let icon: String
    let iconColor: Color
    let iconBg: Color
    let stats: String
    let action: () -> Void
}

/// Full-screen sections reachable from the carousel cards.
enum HomeSection: Int, Identifiable {
    case read = 1, speak = 2, watch = 3, deck = 4, listen = 5, converse = 6
    var id: Int { rawValue }
}

/// Dedicated resource pages reachable from the Home "Resources" row.
enum HomeResource: Int, Identifiable {
    case translator = 1, tenses, accent, idioms, gaps, scenarios
    var id: Int { rawValue }

    var label: String {
        switch self {
        case .translator: return "Translator"
        case .tenses: return "Tenses"
        case .accent: return "Accent"
        case .idioms: return "Idioms"
        case .gaps: return "Gaps"
        case .scenarios: return "Scenarios"
        }
    }

    var icon: String {
        switch self {
        case .translator: return "arrow.left.arrow.right"
        case .tenses: return "text.book.closed.fill"
        case .accent: return "waveform"
        case .idioms: return "quote.bubble.fill"
        case .gaps: return "map.fill"
        case .scenarios: return "bag.fill"
        }
    }
}

struct HomeView: View {
    @Environment(AppStore.self) private var store
    @State private var showProfile = false
    @State private var showCEFR = false
    @State private var lessonGaps: [GapItem]? = nil
    @State private var smartLesson: AssembledLesson? = nil
    @State private var capstoneGaps: [GapItem]? = nil
    @State private var statsExpanded = false
    @State private var currentCardId: String? = "learn"
    @State private var activeSection: HomeSection? = nil
    @State private var activeResource: HomeResource? = nil
    @State private var exploreExpanded = false

    // Activity time + capture tracking (for the daily plan + lesson trigger)
    @State private var sectionOpenedAt: Date? = nil
    @State private var sectionBaselineGaps: Int = 0
    @State private var sectionModality: LearningModality? = nil
    @State private var captureToast: String? = nil

    private var dailyPlan: DailyPlan { DailyPlanEngine(store: store).makePlan() }
    private var lessonReady: Bool { store.shouldOfferConsolidatedLesson(threshold: Tuning.consolidatedLessonThreshold) }
    private var capstoneReady: Bool { store.lessonsSinceCapstone >= Tuning.capstoneEveryNLessons }

    private let screenW = UIScreen.main.bounds.width
    // Card spans ~84% of the screen (capped) so a slice of the neighbouring
    // cards peeks on BOTH sides; the peek is exactly half the leftover space,
    // which — with viewAligned snapping — keeps the active card centred on
    // every device width.
    private var cardWidth: CGFloat { min(screenW * 0.84, 380) }
    private var cardPeek: CGFloat { max((screenW - cardWidth) / 2, 18) }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 0..<6: return "Bonne nuit"
        case 6..<12: return "Bonjour"
        case 12..<18: return "Bon après-midi"
        default: return "Bonsoir"
        }
    }

    private var greetingSubtitle: String {
        let s = store.currentStreak
        if s >= 14 { return "\(s)-day streak! You're unstoppable!" }
        if s >= 7 { return "Amazing \(s)-day streak! Keep going!" }
        if s >= 3 { return "\(s) days strong — nice momentum!" }
        if s >= 1 { return "Welcome back! Ready to learn?" }
        return "Start your streak today!"
    }

    private var kiriMood: KiriView.Mood {
        let s = store.currentStreak
        if s >= 14 { return .celebrating }
        if s >= 3 { return .happy }
        if s >= 1 { return .encouraging }
        return .idle
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    header
                    statsCard
                        .padding(.horizontal, 16)
                        .offset(y: -60)
                        .padding(.bottom, -44)

                    if store.isInFoundation {
                        foundationSection
                            .padding(.horizontal, 20)
                            .padding(.top, 18)
                    } else {
                        todayPlanSection
                            .padding(.horizontal, 20)
                            .padding(.top, 18)
                    }

                    exploreSection
                        .padding(.top, 24)

                    headlinesSection
                        .padding(.horizontal, 20)
                        .padding(.top, 20)

                    resourcesSection
                        .padding(.horizontal, 20)
                        .padding(.top, 20)

                    Spacer(minLength: 30)
                }
                // Kiri sits in front of everything (including the stats card)
                // so its full body — feet and tail — always reads cleanly.
                .overlay(alignment: .topTrailing) {
                    KiriView(mood: kiriMood, size: 116, festive: store.currentStreak >= 14)
                        .padding(.trailing, 12)
                        .padding(.top, 138)
                }
            }
            .background(Theme.background)
            .ignoresSafeArea(edges: .top)
            .scrollIndicators(.hidden)
            .navigationBarHidden(true)
            .sheet(isPresented: $showProfile) { ProfileView() }
            .sheet(isPresented: $showCEFR) { CEFRSheet() }
            .fullScreenCover(item: Binding(
                get: { lessonGaps.map { LessonPayload(gaps: $0) } },
                set: { lessonGaps = $0?.gaps }
            )) { payload in
                LessonView(gaps: payload.gaps)
            }
            .fullScreenCover(item: $smartLesson) { lesson in
                LessonView(gaps: lesson.gaps, assembled: lesson)
            }
            .fullScreenCover(item: Binding(
                get: { capstoneGaps.map { LessonPayload(gaps: $0) } },
                set: { capstoneGaps = $0?.gaps }
            )) { payload in
                LessonView(gaps: payload.gaps, isCapstone: true)
            }
            .fullScreenCover(item: $activeSection) { section in
                sectionView(section)
            }
            .onChange(of: activeSection) { _, newValue in
                if newValue != nil { beginActivityTracking(newValue!) }
                else { finalizeActivity() }
            }
            .overlay(alignment: .bottom) { captureToastView }
            .fullScreenCover(item: $activeResource) { resource in
                resourceView(resource)
            }
        }
    }

    @ViewBuilder
    private func resourceView(_ resource: HomeResource) -> some View {
        switch resource {
        case .translator: TranslatorView()
        case .tenses: TensesView()
        case .accent: AccentView()
        case .idioms: IdiomsView()
        case .gaps: GapsView()
        case .scenarios: ScenariosView()
        }
    }

    // MARK: - Full-screen section presentation

    @ViewBuilder
    private func sectionView(_ section: HomeSection) -> some View {
        Group {
            switch section {
            case .read: ReadView()
            case .speak: SpeakView()
            case .watch: WatchView()
            case .deck: DeckView()
            case .listen: ListenView()
            case .converse: ConverseView()
            }
        }
        .overlay(alignment: .topLeading) {
            Button {
                Haptics.tap()
                activeSection = nil
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 40, height: 40)
                    .background(Color.black.opacity(0.22), in: Circle())
                    .overlay(Circle().stroke(Color.white.opacity(0.25), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .padding(.top, 56)
            .padding(.leading, 16)
        }
    }

    // MARK: - Header

    private var header: some View {
        ZStack(alignment: .bottom) {
            Theme.primaryGradient
                .overlay(alignment: .topTrailing) {
                    // Soft light bloom for premium depth.
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [Color.white.opacity(0.35), Color.white.opacity(0.0)],
                                center: .center, startRadius: 0, endRadius: 200
                            )
                        )
                        .frame(width: 360, height: 360)
                        .offset(x: 60, y: -40)
                        .clipped()
                }
                .overlay(alignment: .topLeading) {
                    decorativeDots
                }

            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    HStack(spacing: 10) {
                        Text("🇫🇷")
                            .font(.system(size: 24))
                            .frame(width: 56, height: 38)
                            .background(Color.white.opacity(0.2))
                            .clipShape(.rect(cornerRadius: 8))
                        Button { showProfile = true } label: {
                            Image(systemName: "person.crop.circle")
                                .font(.system(size: 22))
                                .foregroundStyle(.white.opacity(0.9))
                                .frame(width: 38, height: 38)
                                .background(Color.white.opacity(0.2))
                                .clipShape(.circle)
                        }
                        .buttonStyle(.plain)
                    }
                    Spacer()
                    Button { showCEFR = true } label: {
                        HStack(spacing: 6) {
                            Text(levelLabel)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(.white)
                            Image(systemName: "chevron.right")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(.white.opacity(0.7))
                        }
                        .padding(.horizontal, 14).padding(.vertical, 7)
                        .background(Color.white.opacity(0.25))
                        .clipShape(.capsule)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.bottom, 26)

                Text(greeting)
                    .font(.serifDisplay(40, weight: .bold))
                    .foregroundStyle(.white)
                Text(greetingSubtitle)
                    .font(.system(size: 16))
                    .foregroundStyle(.white.opacity(0.88))
                    .padding(.top, 6)
            }
            .padding(.horizontal, 24)
            .padding(.top, 60)
            .padding(.bottom, 70)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var decorativeDots: some View {
        ZStack {
            Circle().fill(Color.white.opacity(0.3)).frame(width: 12, height: 12).offset(x: 110, y: 80)
            Circle().fill(Color.white.opacity(0.4)).frame(width: 6, height: 6).offset(x: -120, y: 150)
            Circle().fill(Color.white.opacity(0.35)).frame(width: 8, height: 8).offset(x: 70, y: 60)
            RoundedRectangle(cornerRadius: 2).fill(Color.white.opacity(0.2)).frame(width: 20, height: 8)
                .rotationEffect(.degrees(-15)).offset(x: 130, y: 170)
        }
        .frame(maxWidth: .infinity, alignment: .center)
        .padding(.top, 100)
    }

    private var levelLabel: String {
        let mastered = store.masteredGaps.count
        if mastered >= 40 { return "B1 · Studying" }
        if mastered >= 15 { return "A2 · Studying" }
        return "A1 · Studying"
    }

    // MARK: - Stats chip card (overlapping)

    private var statsCard: some View {
        VStack(spacing: 0) {
            Button {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { statsExpanded.toggle() }
            } label: {
                HStack(spacing: 12) {
                    chip(icon: "flame.fill", value: "\(store.currentStreak)", unit: nil, tint: Theme.primary)
                    chipDivider
                    chip(icon: "checkmark.seal.fill", value: "\(store.masteredThisWeek)", unit: "week", tint: Theme.success)
                    chipDivider
                    chip(icon: "brain.head.profile", value: "\(store.dueGaps.count + store.criticalGaps.count)", unit: "due", tint: Theme.secondary)
                    Spacer()
                    ZStack {
                        Circle().stroke(Theme.primaryLight, lineWidth: 3).frame(width: 30, height: 30)
                        Circle().trim(from: 0, to: CGFloat(store.overallRetention) / 100)
                            .stroke(Theme.primary, style: .init(lineWidth: 3, lineCap: .round))
                            .rotationEffect(.degrees(-90)).frame(width: 30, height: 30)
                        Text("\(store.overallRetention)")
                            .font(.system(size: 9, weight: .heavy)).foregroundStyle(Theme.primary)
                    }
                    Image(systemName: "chevron.down")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.textMuted)
                        .rotationEffect(.degrees(statsExpanded ? 180 : 0))
                }
                .padding(.horizontal, 16).padding(.vertical, 14)
            }
            .buttonStyle(.plain)

            if statsExpanded {
                VStack(spacing: 14) {
                    Divider().background(Theme.borderLight)
                    HStack(spacing: 8) {
                        miniStat(icon: "target", value: "\(store.activeGaps.count)", label: "Active gaps", tint: Theme.primary, bg: Theme.primaryLight)
                        miniStat(icon: "rosette", value: "\(store.masteredGaps.count)", label: "Mastered", tint: Theme.success, bg: Theme.successLight)
                        miniStat(icon: "calendar", value: "\(store.longestStreak)", label: "Best streak", tint: Theme.warning, bg: Theme.warningLight)
                    }

                    if !recommendations.isEmpty {
                        recommendationsSection
                    }
                }
                .padding(.horizontal, 16).padding(.bottom, 16).padding(.top, 2)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: Radius.hero))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.hero)
                .stroke(Theme.border.opacity(0.5), lineWidth: 0.5)
        )
        .softLift(radius: 22, y: 10)
    }

    private func chip(icon: String, value: String, unit: String?, tint: Color) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon).font(.system(size: 14)).foregroundStyle(tint)
            Text(value).font(.system(size: 15, weight: .heavy)).foregroundStyle(Theme.text)
            if let unit { Text(unit).font(.system(size: 11)).foregroundStyle(Theme.textMuted) }
        }
    }

    private var chipDivider: some View {
        Rectangle().fill(Theme.borderLight).frame(width: 1, height: 16)
    }

    private func miniStat(icon: String, value: String, label: String, tint: Color, bg: Color) -> some View {
        VStack(spacing: 6) {
            Image(systemName: icon).font(.system(size: 14)).foregroundStyle(tint)
                .frame(width: 30, height: 30).background(bg).clipShape(.rect(cornerRadius: 9))
            Text(value).font(.system(size: 18, weight: .heavy)).foregroundStyle(Theme.text)
            Text(label).font(.system(size: 10)).foregroundStyle(Theme.textMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(Theme.backgroundSecondary)
        .clipShape(.rect(cornerRadius: 12))
    }

    // MARK: - Recommendations

    private struct Recommendation: Identifiable {
        let id: String
        let category: GapCategory
        let count: Int
        let urgency: String
        let urgencyColor: Color
        let icon: String
        let gaps: [GapItem]
    }

    private var recommendations: [Recommendation] {
        var result: [Recommendation] = []
        for category in GapCategory.allCases {
            let critical = store.criticalGaps.filter { $0.category == category }
            let due = store.dueGaps.filter { $0.category == category }
            let total = critical.count + due.count
            if total > 0 {
                let overdue = !critical.isEmpty
                result.append(Recommendation(
                    id: "rec-\(category.rawValue)",
                    category: category,
                    count: total,
                    urgency: overdue ? "Overdue" : "Due today",
                    urgencyColor: overdue ? Theme.error : Theme.warning,
                    icon: overdue ? "exclamationmark.circle.fill" : "clock.fill",
                    gaps: Array((critical + due).prefix(10))
                ))
            }
        }
        return Array(result.sorted { $0.count > $1.count }.prefix(3))
    }

    private var recommendationsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "sparkles").font(.system(size: 12)).foregroundStyle(Theme.primary)
                    .frame(width: 24, height: 24).background(Theme.primaryLight).clipShape(.rect(cornerRadius: 7))
                Text("Recommended For You").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.text)
            }
            ForEach(recommendations) { rec in
                Button { Haptics.select(); lessonGaps = rec.gaps } label: {
                    HStack(spacing: 12) {
                        Image(systemName: categoryIcon(rec.category))
                            .font(.system(size: 18)).foregroundStyle(rec.category.color)
                            .frame(width: 38, height: 38)
                            .background(rec.category.color.opacity(0.12)).clipShape(.rect(cornerRadius: 11))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(rec.category.label).font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.text)
                            Text("\(rec.count) gap\(rec.count == 1 ? "" : "s") to review").font(.system(size: 11)).foregroundStyle(Theme.textMuted)
                        }
                        Spacer()
                        HStack(spacing: 4) {
                            Image(systemName: rec.icon).font(.system(size: 10))
                            Text(rec.urgency).font(.system(size: 10, weight: .semibold))
                        }
                        .foregroundStyle(rec.urgencyColor)
                        .padding(.horizontal, 9).padding(.vertical, 4)
                        .background(rec.urgencyColor.opacity(0.12)).clipShape(.capsule)
                    }
                    .padding(Space.md)
                    .background(Theme.backgroundSecondary)
                    .clipShape(.rect(cornerRadius: Radius.card))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.card)
                            .stroke(Theme.border.opacity(0.4), lineWidth: 0.5)
                    )
                }
                .buttonStyle(.plain)
                .pressable()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Build an adaptive lesson via the concept-selection engine, falling back to
    /// the overdue/active pool when no concept is eligible yet.
    private func startSmartLesson() {
        Haptics.select()
        let assembler = LessonAssembler(store: store)
        if let lesson = assembler.assemble(), !lesson.gaps.isEmpty {
            smartLesson = lesson
            return
        }
        let pool = store.criticalGaps.isEmpty ? store.activeGaps : store.criticalGaps
        if !pool.isEmpty { lessonGaps = Array(pool.prefix(8)) }
    }

    private func categoryIcon(_ c: GapCategory) -> String {
        switch c {
        case .vocabulary: return "book.fill"
        case .grammar: return "curlybraces"
        case .pronunciation: return "mic.fill"
        case .phrasing: return "text.bubble.fill"
        case .register: return "shield.fill"
        }
    }

    // MARK: - Foundation track (the beginner front door)

    private var foundationSection: some View {
        let mastered = store.foundationMastered
        let total = max(store.foundationTotal, 1)
        let progress = min(1, Double(mastered) / Double(total))
        let next = store.foundationConcepts.first
        return VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "building.columns.fill").font(.system(size: 14)).foregroundStyle(Theme.secondary)
                    .frame(width: 28, height: 28).background(Theme.secondaryLight).clipShape(.rect(cornerRadius: 8))
                Text("Build Your Foundation").font(.serifDisplay(22, weight: .bold)).foregroundStyle(Theme.text)
                Spacer()
                Text("\(mastered)/\(total)").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.textMuted)
            }

            Text("Let's lock in the core basics first. Each lesson builds on the last — reading unlocks once you've got the essentials.")
                .font(.system(size: 14)).foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.border).frame(height: 8)
                    Capsule().fill(Theme.secondary)
                        .frame(width: geo.size.width * CGFloat(progress), height: 8)
                        .animation(.spring(response: 0.5, dampingFraction: 0.8), value: progress)
                }
            }
            .frame(height: 8)

            Button {
                Haptics.select()
                startSmartLesson()
            } label: {
                HStack(spacing: 14) {
                    Image(systemName: "graduationcap.fill").font(.system(size: 18)).foregroundStyle(.white)
                        .frame(width: 40, height: 40).background(Color.white.opacity(0.2)).clipShape(.rect(cornerRadius: 12))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(next == nil ? "Review the basics" : "Continue: \(next!.name)")
                            .font(.system(size: 15, weight: .bold)).foregroundStyle(.white).lineLimit(1)
                        Text("Tap to start your next basics lesson").font(.system(size: 12)).foregroundStyle(.white.opacity(0.85))
                    }
                    Spacer()
                    Image(systemName: "arrow.right").font(.system(size: 14, weight: .bold)).foregroundStyle(.white)
                }
                .padding(Space.md)
                .background(Theme.secondary)
                .clipShape(.rect(cornerRadius: Radius.card))
                .softLift(radius: 12, y: 5, strength: 0.8)
            }
            .buttonStyle(.plain)
            .pressable()

            lockedActivitiesRow
        }
        .padding(Space.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: Radius.hero))
        .overlay(RoundedRectangle(cornerRadius: Radius.hero).stroke(Theme.border.opacity(0.5), lineWidth: 0.5))
        .softLift(radius: 22, y: 10)
    }

    /// The activities still locked behind Foundation — shown so the path ahead is
    /// visible without letting the beginner wander into overwhelming content.
    private var lockedActivitiesRow: some View {
        let locked = LearningModality.allCases.filter { store.readiness(for: $0) != .unlocked }
        return VStack(alignment: .leading, spacing: 8) {
            if !locked.isEmpty {
                Text("UNLOCKS AS YOU BUILD THE BASICS")
                    .font(.system(size: 10, weight: .bold)).foregroundStyle(Theme.textMuted).tracking(0.5)
                HStack(spacing: 8) {
                    ForEach(locked) { m in
                        HStack(spacing: 6) {
                            Image(systemName: "lock.fill").font(.system(size: 9)).foregroundStyle(Theme.textMuted)
                            Image(systemName: m.icon).font(.system(size: 11)).foregroundStyle(Theme.textSecondary)
                            Text(m.label).font(.system(size: 11, weight: .medium)).foregroundStyle(Theme.textSecondary)
                        }
                        .padding(.horizontal, 9).padding(.vertical, 6)
                        .background(Theme.backgroundSecondary).clipShape(.capsule)
                        .overlay(Capsule().stroke(Theme.border.opacity(0.5), lineWidth: 0.5))
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Today plan (the front door)

    private var todayPlanSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "sun.max.fill").font(.system(size: 14)).foregroundStyle(Theme.primary)
                    .frame(width: 28, height: 28).background(Theme.primaryLight).clipShape(.rect(cornerRadius: 8))
                Text("Today's Plan").font(.serifDisplay(22, weight: .bold)).foregroundStyle(Theme.text)
                Spacer()
                Text("\(planMinutesDone)/\(dailyPlan.totalMinutes) min")
                    .font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.textMuted)
            }

            Text(dailyPlan.rationale)
                .font(.system(size: 14)).foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)

            VStack(spacing: 10) {
                ForEach(dailyPlan.items) { item in planRow(item) }
            }

            if capstoneReady { capstoneRow }
            else if lessonReady { lessonReadyRow }
        }
        .padding(Space.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: Radius.hero))
        .overlay(RoundedRectangle(cornerRadius: Radius.hero).stroke(Theme.border.opacity(0.5), lineWidth: 0.5))
        .softLift(radius: 22, y: 10)
    }

    private var planMinutesDone: Int {
        dailyPlan.items.reduce(0) { $0 + min(store.minutesToday($1.modality), $1.targetMinutes) }
    }

    private func planRow(_ item: DailyPlanItem) -> some View {
        let done = store.minutesToday(item.modality)
        let progress = min(1, Double(done) / Double(max(1, item.targetMinutes)))
        let complete = done >= item.targetMinutes
        return Button {
            Haptics.select()
            if let section = section(for: item.modality) { activeSection = section }
        } label: {
            HStack(spacing: 14) {
                ZStack {
                    Circle().stroke(Theme.primaryLight, lineWidth: 4).frame(width: 40, height: 40)
                    Circle().trim(from: 0, to: CGFloat(progress))
                        .stroke(complete ? Theme.success : Theme.primary, style: .init(lineWidth: 4, lineCap: .round))
                        .rotationEffect(.degrees(-90)).frame(width: 40, height: 40)
                        .animation(.spring(response: 0.5, dampingFraction: 0.8), value: progress)
                    Image(systemName: complete ? "checkmark" : item.modality.icon)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(complete ? Theme.success : Theme.primary)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.modality.label).font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.text)
                    Text("\(done)/\(item.targetMinutes) min · \(item.modality.subtitle)")
                        .font(.system(size: 12)).foregroundStyle(Theme.textMuted)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.textMuted)
            }
            .padding(Space.md)
            .background(Theme.backgroundSecondary)
            .clipShape(.rect(cornerRadius: Radius.card))
            .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.border.opacity(0.4), lineWidth: 0.5))
        }
        .buttonStyle(.plain)
        .pressable()
    }

    private var lessonReadyRow: some View {
        Button {
            store.markLessonOffered()
            startSmartLesson()
        } label: {
            HStack(spacing: 14) {
                Image(systemName: "graduationcap.fill").font(.system(size: 18)).foregroundStyle(.white)
                    .frame(width: 40, height: 40).background(Color.white.opacity(0.2)).clipShape(.rect(cornerRadius: 12))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Lesson ready").font(.system(size: 15, weight: .bold)).foregroundStyle(.white)
                    Text("You've gathered enough to learn from").font(.system(size: 12)).foregroundStyle(.white.opacity(0.85))
                }
                Spacer()
                Image(systemName: "arrow.right").font(.system(size: 14, weight: .bold)).foregroundStyle(.white)
            }
            .padding(Space.md)
            .background(Theme.secondary)
            .clipShape(.rect(cornerRadius: Radius.card))
            .softLift(radius: 12, y: 5, strength: 0.8)
        }
        .buttonStyle(.plain)
        .pressable()
    }

    private var capstoneRow: some View {
        Button {
            Haptics.select()
            let gaps = LessonAssembler(store: store).capstoneGaps()
            if !gaps.isEmpty { capstoneGaps = gaps }
        } label: {
            HStack(spacing: 14) {
                Image(systemName: "flag.checkered").font(.system(size: 18)).foregroundStyle(.white)
                    .frame(width: 40, height: 40).background(Color.white.opacity(0.2)).clipShape(.rect(cornerRadius: 12))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Capstone challenge").font(.system(size: 15, weight: .bold)).foregroundStyle(.white)
                    Text("A mixed quiz to test what's stuck").font(.system(size: 12)).foregroundStyle(.white.opacity(0.85))
                }
                Spacer()
                Image(systemName: "arrow.right").font(.system(size: 14, weight: .bold)).foregroundStyle(.white)
            }
            .padding(Space.md)
            .background(LinearGradient(colors: [Color(hex: "7C3AED"), Color(hex: "4338CA")], startPoint: .leading, endPoint: .trailing))
            .clipShape(.rect(cornerRadius: Radius.card))
            .softLift(radius: 12, y: 5, strength: 0.8)
        }
        .buttonStyle(.plain)
        .pressable()
    }

    // MARK: - Activity tracking + lesson trigger

    private func section(for modality: LearningModality) -> HomeSection? {
        switch modality {
        case .reading: return .read
        case .watching: return .watch
        case .speaking: return .speak
        case .listening: return .listen
        }
    }

    private func modality(for section: HomeSection) -> LearningModality? {
        switch section {
        case .read: return .reading
        case .watch: return .watching
        case .speak, .converse: return .speaking
        case .listen: return .listening
        case .deck: return nil
        }
    }

    private func beginActivityTracking(_ section: HomeSection) {
        sectionOpenedAt = Date()
        sectionBaselineGaps = store.gaps.count
        sectionModality = modality(for: section)
    }

    private func finalizeActivity() {
        defer { sectionOpenedAt = nil; sectionModality = nil }
        guard let opened = sectionOpenedAt else { return }
        let elapsed = Date().timeIntervalSince(opened)
        if let m = sectionModality, elapsed >= Tuning.minActivitySeconds {
            let minutes = max(1, Int((elapsed / 60).rounded()))
            store.recordActivityMinutes(m, minutes: minutes)
        }
        let newGaps = store.gaps.count - sectionBaselineGaps
        if newGaps > 0 {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                captureToast = "Saved \(newGaps) thing\(newGaps == 1 ? "" : "s") you didn't know"
            }
            Haptics.success()
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.6) {
                withAnimation { captureToast = nil }
            }
        }
    }

    @ViewBuilder private var captureToastView: some View {
        if let toast = captureToast {
            HStack(spacing: 10) {
                Image(systemName: "checkmark.seal.fill").font(.system(size: 16)).foregroundStyle(Theme.success)
                Text(toast).font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.text)
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
            .background(.ultraThinMaterial, in: Capsule())
            .overlay(Capsule().stroke(Theme.border.opacity(0.5), lineWidth: 0.5))
            .softLift(radius: 14, y: 6)
            .padding(.bottom, 28)
            .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }

    // MARK: - Explore (secondary tool drawer)

    private var exploreSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Button {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { exploreExpanded.toggle() }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "square.grid.2x2.fill").font(.system(size: 13)).foregroundStyle(Theme.secondary)
                        .frame(width: 28, height: 28).background(Theme.secondaryLight).clipShape(.rect(cornerRadius: 8))
                    Text("Explore").font(.serifDisplay(20, weight: .semibold)).foregroundStyle(Theme.text)
                    Spacer()
                    Image(systemName: exploreExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.textMuted)
                }
                .padding(.horizontal, 20)
            }
            .buttonStyle(.plain)

            if exploreExpanded {
                carousel.transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }

    // MARK: - Signature sliding carousel

    private var featureCards: [FeatureCard] {
        [
            FeatureCard(id: "learn", title: "Learn", subtitle: "Practice your gaps",
                        description: "Master vocabulary, grammar & more with adaptive lessons",
                        icon: "graduationcap.fill", iconColor: Theme.secondary, iconBg: Theme.secondaryLight,
                        stats: "\(store.activeGaps.count) gaps to practice") {
                startSmartLesson()
            },
            FeatureCard(id: "read", title: "Read", subtitle: "Articles & stories",
                        description: "Immerse yourself in French content, tap any word",
                        icon: "book.fill", iconColor: Theme.success, iconBg: Theme.successLight,
                        stats: "Tap to read") { activeSection = .read },
            FeatureCard(id: "listen", title: "Listen", subtitle: "Dialogues & stories",
                        description: "Train your ear with real French audio & subtitles",
                        icon: "headphones", iconColor: Theme.purple, iconBg: Color(hex: "EDE9FE"),
                        stats: "\(ListeningData.items.count) scenarios") { activeSection = .listen },
            FeatureCard(id: "speak", title: "Speak", subtitle: "Practice sessions",
                        description: "Build fluency with speech practice & feedback",
                        icon: "mic.fill", iconColor: Theme.warning, iconBg: Theme.warningLight,
                        stats: "Talk freely") { activeSection = .speak },
            FeatureCard(id: "converse", title: "Converse", subtitle: "Live AI tutor",
                        description: "Hold a spoken conversation with your French tutor",
                        icon: "phone.bubble.fill", iconColor: Color(hex: "E11D48"), iconBg: Color(hex: "FFE4E6"),
                        stats: "\(ConverseScenario.all.count) scenarios") { activeSection = .converse },
            FeatureCard(id: "watch", title: "Watch", subtitle: "Video lessons",
                        description: "Learn French with immersive video transcripts",
                        icon: "play.rectangle.fill", iconColor: Theme.indigo, iconBg: Color(hex: "E0E7FF"),
                        stats: "Interactive transcripts") { activeSection = .watch },
            FeatureCard(id: "deck", title: "Deck", subtitle: "Spaced repetition",
                        description: "Drill your gaps until mastery with smart review",
                        icon: "square.stack.3d.up.fill", iconColor: Theme.primary, iconBg: Theme.primaryLight,
                        stats: "\(store.reviewQueue.count) cards ready") { activeSection = .deck },
        ]
    }

    private var carousel: some View {
        VStack(spacing: 18) {
            ScrollView(.horizontal) {
                HStack(spacing: 14) {
                    ForEach(featureCards) { card in
                        featureCardView(card)
                            .frame(width: cardWidth)
                            .scrollTransition(.interactive, axis: .horizontal) { content, phase in
                                content
                                    .scaleEffect(phase.isIdentity ? 1 : 0.91, anchor: .center)
                                    .opacity(phase.isIdentity ? 1 : 0.82)
                            }
                            .id(card.id)
                    }
                }
                .scrollTargetLayout()
            }
            .contentMargins(.horizontal, cardPeek, for: .scrollContent)
            .scrollTargetBehavior(.viewAligned)
            .scrollPosition(id: $currentCardId)
            .scrollIndicators(.hidden)

            miniNavBar
        }
    }

    // MARK: - Floating frosted nav bar (icons only)

    private var activeIndex: Int {
        featureCards.firstIndex { $0.id == currentCardId } ?? 0
    }
    /// Compact capsule that floats over the background — not a solid full-width bar.
    private var navBarWidth: CGFloat { min(screenW - 140, 230) }
    private var navItemWidth: CGFloat { navBarWidth / CGFloat(featureCards.count) }

    private var miniNavBar: some View {
        HStack(spacing: 0) {
            ForEach(featureCards) { card in
                let active = currentCardId == card.id
                Button {
                    Haptics.tap()
                    withAnimation(.spring(response: 0.45, dampingFraction: 0.82)) {
                        currentCardId = card.id
                    }
                } label: {
                    Image(systemName: card.icon)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(active ? Theme.primary : Theme.textMuted.opacity(0.65))
                        .frame(width: navItemWidth, height: 32)
                        .scaleEffect(active ? 1.12 : 1)
                        .animation(.spring(response: 0.35, dampingFraction: 0.7), value: active)
                }
                .buttonStyle(.plain)
            }
        }
        .background(alignment: .leading) {
            Capsule()
                .fill(Theme.primary.opacity(0.14))
                .frame(width: navItemWidth, height: 32)
                .offset(x: CGFloat(activeIndex) * navItemWidth)
                .animation(.spring(response: 0.42, dampingFraction: 0.78), value: activeIndex)
        }
        .padding(5)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay(Capsule().stroke(Color.white.opacity(0.65), lineWidth: 0.5))
        .softLift(radius: 14, y: 5, strength: 0.9)
        .frame(width: navBarWidth + 10)
    }

    private func featureCardView(_ card: FeatureCard) -> some View {
        Button(action: card.action) {
            VStack(alignment: .leading, spacing: 0) {
                Image(systemName: card.icon)
                    .font(.system(size: 30))
                    .foregroundStyle(card.iconColor)
                    .frame(width: 60, height: 60)
                    .background(card.iconBg)
                    .clipShape(.rect(cornerRadius: 18))
                    .padding(.bottom, 18)

                Text(card.title).font(.serifDisplay(28, weight: .bold)).foregroundStyle(Theme.text)
                Text(card.subtitle).font(.system(size: 14)).foregroundStyle(Theme.textSecondary).padding(.top, 4)
                Text(card.description).font(.system(size: 14)).foregroundStyle(Theme.textMuted)
                    .lineSpacing(3).fixedSize(horizontal: false, vertical: true).padding(.top, 12)

                Spacer(minLength: 18)

                if card.id == "learn" {
                    learnStatRow
                        .padding(.top, 16)
                        .overlay(alignment: .top) {
                            Rectangle().fill(Theme.borderLight).frame(height: 1)
                        }
                } else {
                    VStack(alignment: .leading, spacing: 0) {
                        Divider().background(Theme.borderLight).padding(.bottom, 12)
                        Text(card.stats).font(.system(size: 13, weight: .medium)).foregroundStyle(Theme.primary)
                    }
                }
            }
            .padding(Space.section)
            .frame(maxWidth: .infinity, minHeight: 340, alignment: .leading)
            .background(Theme.card)
            .clipShape(.rect(cornerRadius: Radius.hero))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.hero)
                    .stroke(Theme.border.opacity(0.5), lineWidth: 0.5)
            )
            .softLift(radius: 26, y: 12)
        }
        .buttonStyle(.plain)
    }

    private var learnStatRow: some View {
        let active = store.activeGaps.count
        let mastered = store.masteredGaps.count
        let due = store.dueGaps.count + store.criticalGaps.count
        let total = max(active + mastered, 1)
        return VStack(spacing: 12) {
            HStack(spacing: 0) {
                learnStat(value: "\(active)", label: "Gaps")
                Rectangle().fill(Theme.border).frame(width: 1, height: 26)
                learnStat(value: "\(mastered)", label: "Mastered")
                Rectangle().fill(Theme.border).frame(width: 1, height: 26)
                learnStat(value: "\(due)", label: "Due")
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.border).frame(height: 6)
                    Capsule().fill(Theme.secondary)
                        .frame(width: geo.size.width * CGFloat(mastered) / CGFloat(total), height: 6)
                }
            }
            .frame(height: 6)
        }
    }

    private func learnStat(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.text)
            Text(label).font(.system(size: 11)).foregroundStyle(Theme.textMuted)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Headlines

    private struct Headline: Identifiable { let id = UUID(); let text: String; let source: String; let tint: Color }
    private let headlines: [Headline] = [
        Headline(text: "La France investit dans l'énergie renouvelable", source: "Le Monde 🇫🇷", tint: Theme.success),
        Headline(text: "Nouvelle exposition au Louvre cet été", source: "France Culture 🇫🇷", tint: Theme.purple),
        Headline(text: "La technologie change notre quotidien", source: "Les Échos 🇫🇷", tint: Theme.primary),
    ]

    private var headlinesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                HStack(spacing: 8) {
                    Image(systemName: "newspaper.fill").font(.system(size: 13)).foregroundStyle(Theme.secondary)
                        .frame(width: 28, height: 28).background(Theme.secondaryLight).clipShape(.rect(cornerRadius: 8))
                    Text("Today's Headlines").font(.serifDisplay(20, weight: .semibold)).foregroundStyle(Theme.text)
                }
                Spacer()
                Button { activeSection = .read } label: {
                    Text("See All").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.primary)
                }
                .buttonStyle(.plain)
            }
            ForEach(headlines) { h in
                Button { activeSection = .read } label: {
                    HStack(spacing: 12) {
                        Circle().fill(h.tint).frame(width: 8, height: 8)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(h.text).font(.system(size: 14, weight: .medium)).foregroundStyle(Theme.text)
                                .lineLimit(2).multilineTextAlignment(.leading)
                            Text(h.source).font(.system(size: 12)).foregroundStyle(Theme.textMuted)
                        }
                        Spacer()
                        Image(systemName: "chevron.right").font(.system(size: 13)).foregroundStyle(Theme.textMuted)
                    }
                    .padding(Space.lg)
                    .background(Theme.card)
                    .clipShape(.rect(cornerRadius: Radius.card))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.card)
                            .stroke(Theme.border.opacity(0.5), lineWidth: 0.5)
                    )
                    .softLift()
                }
                .buttonStyle(.plain)
                .pressable()
            }
        }
    }

    // MARK: - Resources

    private var resourcesSection: some View {
        VStack(alignment: .leading, spacing: Space.lg) {
            Text("Resources").font(.serifDisplay(20, weight: .semibold)).foregroundStyle(Theme.text)
            ScrollView(.horizontal) {
                HStack(spacing: 14) {
                    ForEach([HomeResource.scenarios, .translator, .tenses, .accent, .idioms, .gaps]) { r in
                        Button { Haptics.select(); activeResource = r } label: {
                            VStack(spacing: 8) {
                                Image(systemName: r.icon).font(.system(size: 21)).foregroundStyle(Theme.primary)
                                    .frame(width: 56, height: 56)
                                    .background(Theme.primaryLight).clipShape(.circle)
                                Text(r.label).font(.system(size: 12, weight: .medium)).foregroundStyle(Theme.textSecondary)
                            }
                            .frame(width: 64)
                        }
                        .buttonStyle(.plain)
                        .pressable()
                    }
                }
            }
            .scrollIndicators(.hidden)
        }
    }
}

// MARK: - CEFR sheet

private struct CEFRSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppStore.self) private var store

    private let levels: [(level: CEFRLevel, name: String, desc: String)] = [
        (.A1, "Beginner", "Introduce yourself, handle simple everyday interactions."),
        (.A2, "Elementary", "Describe routines, family, and make simple plans."),
        (.B1, "Intermediate", "Handle travel, describe experiences and opinions."),
        (.B2, "Upper Intermediate", "Interact fluently on complex subjects."),
        (.C1, "Advanced", "Express ideas fluently for any purpose."),
        (.C2, "Mastery", "Understand virtually everything with precision."),
    ]

    private var currentLevel: CEFRLevel {
        let mastered = store.masteredGaps.count
        if mastered >= 40 { return .B1 }
        if mastered >= 15 { return .A2 }
        return .A1
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    ForEach(levels, id: \.level) { item in
                        let isCurrent = item.level == currentLevel
                        VStack(alignment: .leading, spacing: 8) {
                            HStack(spacing: 12) {
                                Text(item.level.rawValue)
                                    .font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.primary)
                                    .padding(.horizontal, 10).padding(.vertical, 5)
                                    .background(Theme.primaryLight).clipShape(.rect(cornerRadius: 8))
                                Text(item.name).font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.text)
                                Spacer()
                                if isCurrent {
                                    HStack(spacing: 4) {
                                        Image(systemName: "arrow.up.right").font(.system(size: 11))
                                        Text("In Progress").font(.system(size: 11, weight: .semibold))
                                    }
                                    .foregroundStyle(Theme.primary)
                                    .padding(.horizontal, 8).padding(.vertical, 3)
                                    .background(Theme.primaryLight).clipShape(.capsule)
                                }
                            }
                            Text(item.desc).font(.system(size: 13)).foregroundStyle(Theme.textSecondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(16)
                        .background(Theme.card)
                        .clipShape(.rect(cornerRadius: 16))
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(isCurrent ? Theme.primary : .clear, lineWidth: 1.5))
                    }
                }
                .padding(20)
            }
            .background(Theme.background)
            .navigationTitle("CEFR Proficiency")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { dismiss() } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(Theme.textMuted) }
                }
            }
        }
    }
}

struct LessonPayload: Identifiable {
    let id = UUID()
    let gaps: [GapItem]
}
