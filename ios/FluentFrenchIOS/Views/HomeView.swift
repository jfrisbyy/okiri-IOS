//
//  HomeView.swift
//  FluentFrenchIOS
//
//  Signature landing screen — faithfully mirrors the Expo home:
//  an orange gradient header with the flag, CEFR badge and Kiri mascot,
//  an overlapping stat-chip card, "Recommended for you" cards, and the
//  signature horizontal sliding carousel of scaling feature cards.
//
//  Every entry point on this screen goes through the readiness gate
//  (`store.canOpen` / `store.unlockCondition`, D1): a locked activity is a
//  disabled card that states its unlock condition; Reading in the bridge state
//  opens (the surface caps itself to short pieces, D5). The daily plan is the
//  store's plan of record (D14); activity time is credited only while the app is
//  in the foreground and capped per session (D9). Copy comes from `HomeCopy` and
//  `ReadinessCopy`, decided from real data (D12/D19).
//

import SwiftUI
import Combine

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
    /// The activity this surface practises — nil for surfaces with no gate (Learn, Deck).
    let modality: LearningModality?
    let action: () -> Void
}

/// A transient Home toast: a capture summary, or the selector's own headline
/// when an entry point has nothing to practise (C23).
private struct HomeToast: Equatable {
    let text: String
    let icon: String
    let tint: Color
}

/// Full-screen sections reachable from the carousel cards.
enum HomeSection: Int, Identifiable {
    case read = 1, speak = 2, watch = 3, deck = 4, listen = 5, converse = 6
    var id: Int { rawValue }

    /// The activity the section credits and is gated on; nil for the deck.
    var modality: LearningModality? {
        switch self {
        case .read: return .reading
        case .watch: return .watching
        case .speak, .converse: return .speaking
        case .listen: return .listening
        case .deck: return nil
        }
    }
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

    /// The activity a resource is gated on; nil for reference tools that are
    /// always open (the translator, the accent guide, the learner's own gap map).
    var modality: LearningModality? {
        switch self {
        case .scenarios: return .speaking
        case .tenses, .idioms: return .reading
        case .translator, .accent, .gaps: return nil
        }
    }
}

struct HomeView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// Icon tiles, rings and medallions grow with the learner's text size so the
    /// scaled glyphs inside them keep their proportions instead of overflowing.
    @ScaledMetric(relativeTo: .body) private var tileScale: CGFloat = 1
    @ScaledMetric(relativeTo: .largeTitle) private var markScale: CGFloat = 1
    /// Clamped multipliers: past `Theme.maxChromeScale` a tile would take the whole
    /// row it shares with text, so the containers stop growing there.
    private var tile: CGFloat { Theme.chromeScale(tileScale) }
    private var mark: CGFloat { min(markScale, Theme.maxChromeScale) }
    @State private var showProfile = false
    @State private var showCEFR = false
    /// The lesson being shown (smart, scoped or capstone) — always assembled from
    /// one SelectionOutput by the LessonPipeline; Home never picks items itself.
    @State private var activeLesson: AssembledLesson? = nil
    @State private var statsExpanded = false
    @State private var currentCardId: String? = "learn"
    @State private var activeSection: HomeSection? = nil
    @State private var activeResource: HomeResource? = nil
    @State private var exploreExpanded = false

    // Activity time + capture tracking (for the daily plan + lesson trigger).
    // The session clock runs only while the scene is active (D9).
    @State private var activitySession: ActivitySession? = nil
    @State private var sectionBaselineGaps: Int = 0
    @State private var toast: HomeToast? = nil
    @State private var toastTask: Task<Void, Never>? = nil

    /// Today's plan of record (D14): cached in the store per calendar day and
    /// recomputed only on day change, a preference change or an unlock. Until the
    /// store has computed it (first appearance) an empty placeholder renders.
    private var dailyPlan: DailyPlan {
        if let plan = store.dailyPlanOfRecord, store.dailyPlanDayKey == store.dayKey(Date()) { return plan }
        return DailyPlan(items: [], rationale: "Planning your day…", isColdStart: true)
    }
    private var lessonReady: Bool { store.shouldOfferConsolidatedLesson(threshold: Tuning.consolidatedLessonThreshold) }
    private var capstoneReady: Bool { store.lessonsSinceCapstone >= Tuning.capstoneEveryNLessons }
    private var placed: Bool { store.hasCompletedAssessment }
    private var festiveStreak: Bool { store.currentStreak >= Tuning.kiriCelebrationStreak }

    private let screenW = UIScreen.main.bounds.width
    // Card spans ~84% of the screen (capped) so a slice of the neighbouring
    // cards peeks on BOTH sides; the peek is exactly half the leftover space,
    // which — with viewAligned snapping — keeps the active card centred on
    // every device width.
    private var cardWidth: CGFloat { min(screenW * 0.84, 380) }
    private var cardPeek: CGFloat { max((screenW - cardWidth) / 2, 18) }

    private var greeting: String {
        HomeCopy.greeting(hour: Calendar.current.component(.hour, from: Date()))
    }

    private var greetingSubtitle: String {
        HomeCopy.subtitle(streak: store.currentStreak, dueNow: store.dueNow.count,
                          lessonsToday: store.lessonsCompletedToday, placed: placed)
    }

    private var kiriMood: KiriMood {
        HomeCopy.kiriMood(streak: store.currentStreak, lessonsToday: store.lessonsCompletedToday)
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
                    KiriView(mood: kiriMood, size: 116, festive: festiveStreak)
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
            .fullScreenCover(item: $activeLesson) { lesson in
                LessonView(gaps: lesson.gaps, assembled: lesson, isCapstone: lesson.isCapstone)
            }
            .fullScreenCover(item: $activeSection) { section in
                sectionView(section)
            }
            .onChange(of: activeSection) { _, newValue in
                if let section = newValue { beginActivityTracking(section) } else { finalizeActivity() }
            }
            .onChange(of: scenePhase) { _, phase in
                let now = Date()
                if phase == .active {
                    activitySession?.resume(at: now)
                    _ = store.todaysPlan(now: now)   // a new day may have started while away
                } else {
                    activitySession?.pause(at: now)  // never credit backgrounded time (D9)
                }
            }
            .onAppear { _ = store.todaysPlan() }
            .onReceive(NotificationCenter.default.publisher(for: .NSCalendarDayChanged)) { _ in
                _ = store.todaysPlan()
            }
            .onChange(of: store.dailyPlanDayKey) { _, key in
                // Placement / reset / sign-in cleared the cache: plan the day again.
                if key == nil { _ = store.todaysPlan() }
            }
            .onChange(of: store.preferences) { _, _ in _ = store.recomputePlan() }
            .onChange(of: store.unlockedModalities) { _, _ in _ = store.recomputePlan() }
            .overlay(alignment: .bottom) { toastView }
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
                    .font(.headline.weight(.bold))
                    .foregroundStyle(.white)
                    .frame(width: max(Theme.minimumHitTarget, 44 * tile),
                           height: max(Theme.minimumHitTarget, 44 * tile))
                    .background(Color.black.opacity(0.22), in: Circle())
                    .overlay(Circle().stroke(Color.white.opacity(0.25), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back to Home")
            .padding(.top, 56)
            .padding(.leading, 16)
        }
    }

    // MARK: - Gate + lesson entry (every entry point goes through these)

    /// Open a section only when its activity is open (D1/D5); a locked one
    /// explains itself instead of silently doing nothing.
    private func open(_ section: HomeSection) {
        if let modality = section.modality, !store.canOpen(modality) {
            showToast(store.unlockCondition(for: modality) ?? ReadinessCopy.lockedLabel,
                      icon: "lock.fill", tint: Theme.textMuted)
            return
        }
        Haptics.select()
        activeSection = section
    }

    private func open(_ resource: HomeResource) {
        if let modality = resource.modality, !store.canOpen(modality) {
            showToast(store.unlockCondition(for: modality) ?? ReadinessCopy.lockedLabel,
                      icon: "lock.fill", tint: Theme.textMuted)
            return
        }
        Haptics.select()
        activeResource = resource
    }

    /// Present what the pipeline decided: a lesson, or its own empty headline (C23).
    private func present(_ outcome: LessonOutcome) {
        switch outcome {
        case .lesson(let lesson):
            activeLesson = lesson
        case .empty(let headline):
            showToast(headline, icon: "checkmark.circle", tint: Theme.success)
        }
    }

    /// Ask the one selector for today's lesson. When no concept is eligible the
    /// selector itself answers with a review-only lesson — Home has no fallback
    /// pool of its own.
    private func startSmartLesson() {
        Haptics.select()
        present(LessonPipeline(store: store).outcome(for: .smart()))
    }

    private func startCapstone() {
        Haptics.select()
        present(LessonPipeline(store: store).outcome(for: .capstone()))
    }

    private func startScopedLesson(_ scope: SelectionScope) {
        Haptics.select()
        present(LessonPipeline(store: store).outcome(for: scope))
    }

    /// The concept the selector would teach next — the same answer `startSmartLesson`
    /// acts on, so the Foundation card never promises one skill and teaches another.
    private var nextTargetConcept: Concept? {
        store.concept(LessonPipeline(store: store).preview(.smart()).targetConceptId)
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
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    HStack(spacing: 10) {
                        Text("🇫🇷")
                            .font(.title)
                            .frame(width: 56 * tile, height: 44 * tile)
                            .background(Color.white.opacity(0.2))
                            .clipShape(.rect(cornerRadius: 8))
                            .accessibilityHidden(true)
                        Button { showProfile = true } label: {
                            Image(systemName: "person.crop.circle")
                                .font(.title2)
                                .foregroundStyle(.white.opacity(0.9))
                                .frame(width: max(Theme.minimumHitTarget, 44 * tile),
                                       height: max(Theme.minimumHitTarget, 44 * tile))
                                .background(Color.white.opacity(0.2))
                                .clipShape(.circle)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Profile")
                        .accessibilityHint("Opens your profile, progress and settings")
                    }
                    Spacer()
                    Button { showCEFR = true } label: {
                        HStack(spacing: 6) {
                            Text(levelLabel)
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(.white)
                            Image(systemName: "chevron.right")
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(.white.opacity(0.7))
                        }
                        .padding(.horizontal, 14)
                        .frame(minHeight: 44)
                        .background(Color.white.opacity(0.25))
                        .clipShape(.capsule)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(placed ? "Level \(store.learnerLevel.rawValue)" : "Not placed")
                    .accessibilityHint("Shows the CEFR levels")
                }
                .padding(.bottom, 20)

                Text(greeting)
                    .scaledSerifDisplay(40, weight: .bold)
                    .foregroundStyle(.white)
                Text(greetingSubtitle)
                    .font(.callout)
                    .foregroundStyle(.white.opacity(0.88))
                    .padding(.top, 6)
                    .fixedSize(horizontal: false, vertical: true)
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

    /// The ONE displayed level (D12): "Not placed" until the placement has run.
    private var levelLabel: String { HomeCopy.levelBadge(placed: placed, level: store.learnerLevel) }

    // MARK: - Stats chip card (overlapping)

    private var statsCard: some View {
        VStack(spacing: 0) {
            Button {
                withAnimation(Theme.motion(.spring(response: 0.4, dampingFraction: 0.85), reduceMotion: reduceMotion)) {
                    statsExpanded.toggle()
                }
            } label: {
                HStack(spacing: 12) {
                    chip(icon: "flame.fill", value: "\(store.currentStreak)", unit: "streak", tint: Theme.primary,
                         label: "\(store.currentStreak) day streak")
                    chipDivider
                    chip(icon: "checkmark.seal.fill", value: "\(store.masteredThisWeek)", unit: "week", tint: Theme.success,
                         label: "\(store.masteredThisWeek) mastered this week")
                    chipDivider
                    chip(icon: "brain.head.profile", value: "\(store.dueNow.count)", unit: HomeCopy.dueNowLabel.lowercased(), tint: Theme.secondary,
                         label: "\(store.dueNow.count) \(HomeCopy.dueNowLabel.lowercased())")
                    Spacer()
                    // No reviews yet → an empty ring and "—", never a full ring reading
                    // 100 over data that does not exist (D19).
                    let hasEvidence = store.hasRetentionEvidence
                    let ring = 30 * tile
                    ZStack {
                        Circle().stroke(Theme.primaryLight, lineWidth: 3).frame(width: ring, height: ring)
                        Circle().trim(from: 0, to: hasEvidence ? CGFloat(store.overallRetention) / 100 : 0)
                            .stroke(Theme.primary, style: .init(lineWidth: 3, lineCap: .round))
                            .rotationEffect(.degrees(-90)).frame(width: ring, height: ring)
                        Text(hasEvidence ? "\(store.overallRetention)" : "—")
                            .font(.caption2.weight(.heavy)).foregroundStyle(Theme.primary)
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Retention")
                    .accessibilityValue(hasEvidence ? "\(store.overallRetention) percent" : "No reviews yet")
                    Image(systemName: "chevron.down")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.textSecondary)
                        .rotationEffect(.degrees(statsExpanded ? 180 : 0))
                        .accessibilityHidden(true)
                }
                .padding(.horizontal, 16).padding(.vertical, 14)
            }
            .buttonStyle(.plain)
            .accessibilityValue(statsExpanded ? "Expanded" : "Collapsed")
            .accessibilityHint(statsExpanded ? "Collapses your stats" : "Expands your stats")

            if statsExpanded {
                VStack(spacing: 14) {
                    Divider().background(Theme.borderLight)
                    HStack(spacing: 8) {
                        miniStat(icon: "target", value: "\(store.visibleGaps.count)", label: HomeCopy.toLearnLabel, tint: Theme.primary, bg: Theme.primaryLight)
                        miniStat(icon: "rosette", value: "\(store.masteredGaps.count)", label: "Mastered", tint: Theme.success, bg: Theme.successLight)
                        miniStat(icon: "clock", value: "\(store.upcoming.count)", label: HomeCopy.upcomingLabel, tint: Theme.secondary, bg: Theme.secondaryLight)
                        miniStat(icon: "calendar", value: "\(store.longestStreak)", label: "Best streak", tint: Theme.warning, bg: Theme.warningLight)
                    }

                    if let goal = store.weeklyGoalProgress {
                        weeklyGoalRow(done: goal.done, goal: goal.goal)
                    }

                    if !recommendations.isEmpty {
                        recommendationsSection
                    }
                }
                .padding(.horizontal, 16).padding(.bottom, 16).padding(.top, 2)
                .transition(reduceMotion ? AnyTransition.opacity
                                         : AnyTransition.opacity.combined(with: .move(edge: .top)))
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

    private func chip(icon: String, value: String, unit: String?, tint: Color, label: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon).font(.subheadline).foregroundStyle(tint)
            Text(value).font(.subheadline.weight(.heavy)).foregroundStyle(Theme.text)
            if let unit { Text(unit).font(.caption2).foregroundStyle(Theme.textSecondary) }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
    }

    private var chipDivider: some View {
        Rectangle().fill(Theme.borderLight).frame(width: 1, height: 16)
    }

    private func miniStat(icon: String, value: String, label: String, tint: Color, bg: Color) -> some View {
        VStack(spacing: 6) {
            Image(systemName: icon).font(.subheadline).foregroundStyle(tint)
                .frame(width: 30 * tile, height: 30 * tile).background(bg).clipShape(.rect(cornerRadius: 9))
            Text(value).font(.headline.weight(.heavy)).foregroundStyle(Theme.text)
            Text(label).font(.caption2).foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(Theme.backgroundSecondary)
        .clipShape(.rect(cornerRadius: 12))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label): \(value)")
    }

    /// The weekly goal from Preferences (D11): days with a lesson this week.
    private func weeklyGoalRow(done: Int, goal: Int) -> some View {
        let progress = min(1, Double(done) / Double(max(1, goal)))
        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Weekly goal").font(.footnote.weight(.semibold)).foregroundStyle(Theme.text)
                Spacer()
                Text("\(done) of \(goal) days").font(.caption).foregroundStyle(Theme.textSecondary)
            }
            progressBar(progress, tint: Theme.primary, height: 6)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Weekly goal")
        .accessibilityValue("\(done) of \(goal) days")
    }

    private func progressBar(_ progress: Double, tint: Color, height: CGFloat) -> some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.border).frame(height: height)
                Capsule().fill(tint)
                    .frame(width: geo.size.width * CGFloat(min(1, max(0, progress))), height: height)
                    .reducedMotionAnimation(.spring(response: 0.5, dampingFraction: 0.8), value: progress)
            }
        }
        .frame(height: height)
    }

    // MARK: - Recommendations

    /// A card is a label for a declared intent ("practice what's due in Grammar").
    /// It carries counts for display only — the lesson itself is a scoped
    /// selection (`.dueInCategory`) decided by the selector on tap. Counts read
    /// `store.dueNow`, the one "due" number (D13).
    private struct Recommendation: Identifiable {
        let id: String
        let category: GapCategory
        let count: Int
    }

    private var recommendations: [Recommendation] {
        let due = store.dueNow
        var result: [Recommendation] = []
        for category in GapCategory.allCases {
            let count = due.filter { $0.category == category }.count
            if count > 0 {
                result.append(Recommendation(id: "rec-\(category.rawValue)", category: category, count: count))
            }
        }
        return Array(result.sorted { $0.count > $1.count }.prefix(3))
    }

    private var recommendationsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "sparkles").font(.caption).foregroundStyle(Theme.primary)
                    .frame(width: 24 * tile, height: 24 * tile)
                    .background(Theme.primaryLight).clipShape(.rect(cornerRadius: 7))
                    .accessibilityHidden(true)
                Text("Recommended for You").font(.subheadline.weight(.bold)).foregroundStyle(Theme.text)
                    .accessibilityAddTraits(.isHeader)
            }
            ForEach(recommendations) { rec in
                Button {
                    startScopedLesson(.dueInCategory(rec.category))
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: categoryIcon(rec.category))
                            .font(.headline).foregroundStyle(rec.category.color)
                            .frame(width: 38 * tile, height: 38 * tile)
                            .background(rec.category.color.opacity(0.12)).clipShape(.rect(cornerRadius: 11))
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(rec.category.label).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
                            Text(HomeCopy.gapsToReview(rec.count)).font(.caption2).foregroundStyle(Theme.textSecondary)
                        }
                        Spacer()
                        HStack(spacing: 4) {
                            Image(systemName: "clock.fill").font(.caption2)
                            Text(HomeCopy.dueNowLabel).font(.caption2.weight(.semibold))
                        }
                        .foregroundStyle(Theme.warning)
                        .padding(.horizontal, 9).padding(.vertical, 4)
                        .background(Theme.warning.opacity(0.12)).clipShape(.capsule)
                    }
                    .padding(Space.md)
                    .frame(minHeight: 44)
                    .background(Theme.backgroundSecondary)
                    .clipShape(.rect(cornerRadius: Radius.card))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.card)
                            .stroke(Theme.border.opacity(0.4), lineWidth: 0.5)
                    )
                }
                .buttonStyle(.plain)
                .pressable()
                .accessibilityLabel("\(rec.category.label), \(HomeCopy.gapsToReview(rec.count)), \(HomeCopy.dueNowLabel)")
                .accessibilityHint("Starts a lesson on what is due in \(rec.category.label)")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
        // The bar counts to the gate's own finish line, not to every base skill:
        // the Foundation card disappears the moment reading opens, so a bar that
        // counted all 28 skills could only ever fill halfway (D10, round 3).
        let (mastered, total) = store.foundationProgress()
        let progress = min(1, Double(mastered) / Double(max(1, total)))
        let progressCaption = HomeCopy.foundationProgress(done: mastered, target: total,
                                                          governorHeld: store.isGovernorActive)
        let next = nextTargetConcept
        let lessonTarget = dailyPlan.lessonItem?.target ?? Tuning.foundationLessonsPerDay
        let lessonsDone = store.lessonsCompletedToday
        return VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "building.columns.fill").font(.subheadline).foregroundStyle(Theme.secondary)
                    .frame(width: 28 * tile, height: 28 * tile)
                    .background(Theme.secondaryLight).clipShape(.rect(cornerRadius: 8))
                    .accessibilityHidden(true)
                Text("Build Your Foundation").scaledSerifDisplay(22, weight: .bold).foregroundStyle(Theme.text)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                Text("\(mastered)/\(total)").font(.caption.weight(.semibold)).foregroundStyle(Theme.textSecondary)
                    .accessibilityHidden(true)
            }

            Text("Let's lock in the core basics first. Each lesson builds on the last.")
                .font(.subheadline).foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)

            VStack(alignment: .leading, spacing: 6) {
                progressBar(progress, tint: Theme.secondary, height: 8)
                Text(progressCaption)
                    .font(.caption).foregroundStyle(Theme.textSecondary)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Foundation progress")
            .accessibilityValue(progressCaption)

            // Pace (B10): "Lesson 2 of 3 today", straight from the store's count.
            HStack(spacing: 8) {
                Image(systemName: lessonsDone >= lessonTarget ? "checkmark.circle.fill" : "graduationcap.fill")
                    .font(.footnote)
                    .foregroundStyle(lessonsDone >= lessonTarget ? Theme.success : Theme.secondary)
                    .accessibilityHidden(true)
                Text(HomeCopy.lessonPace(done: lessonsDone, target: lessonTarget))
                    .font(.footnote.weight(.semibold)).foregroundStyle(Theme.textSecondary)
                Spacer()
                if store.isGovernorActive {
                    Text(dailyPlan.rationale).font(.caption2).foregroundStyle(Theme.textSecondary)
                        .lineLimit(2).multilineTextAlignment(.trailing)
                }
            }
            .accessibilityElement(children: .combine)

            Button {
                startSmartLesson()
            } label: {
                HStack(spacing: 14) {
                    Image(systemName: "graduationcap.fill").font(.headline).foregroundStyle(.white)
                        .frame(width: 40 * tile, height: 40 * tile)
                        .background(Color.white.opacity(0.2)).clipShape(.rect(cornerRadius: 12))
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(next.map { "Continue: \($0.name)" } ?? "Review the basics")
                            .font(.subheadline.weight(.bold)).foregroundStyle(.white)
                        Text("Tap to start your next basics lesson").font(.caption).foregroundStyle(.white.opacity(0.85))
                    }
                    Spacer()
                    Image(systemName: "arrow.right").font(.subheadline.weight(.bold)).foregroundStyle(.white)
                        .accessibilityHidden(true)
                }
                .padding(Space.md)
                .frame(minHeight: Theme.minimumHitTarget)
                .background(Theme.secondary)
                .clipShape(.rect(cornerRadius: Radius.card))
                .softLift(radius: 12, y: 5, strength: 0.8)
            }
            .buttonStyle(.plain)
            .pressable()
            .accessibilityLabel(next.map { "Continue: \($0.name)" } ?? "Review the basics")
            .accessibilityHint("Starts your next basics lesson")

            // The capstone cadence applies to Foundation learners too (C15).
            if capstoneReady { capstoneRow }

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
    /// Reading in the bridge state (D5) is offered here: short pieces only.
    private var lockedActivitiesRow: some View {
        let locked = LearningModality.allCases.filter { !store.canOpen($0) }
        let bridgeOpen = store.readiness(for: .reading) == .foundation
        return VStack(alignment: .leading, spacing: 8) {
            if !locked.isEmpty {
                Text("UNLOCKS AS YOU BUILD THE BASICS")
                    .font(.caption2.weight(.bold)).foregroundStyle(Theme.textSecondary).tracking(0.5)
                    .accessibilityAddTraits(.isHeader)
                HStack(spacing: 8) {
                    ForEach(locked) { m in
                        HStack(spacing: 6) {
                            Image(systemName: "lock.fill").font(.caption2).foregroundStyle(Theme.textSecondary)
                            Image(systemName: m.icon).font(.caption2).foregroundStyle(Theme.textSecondary)
                            Text(m.label).font(.caption2.weight(.medium)).foregroundStyle(Theme.textSecondary)
                        }
                        .padding(.horizontal, 9).padding(.vertical, 6)
                        .background(Theme.backgroundSecondary).clipShape(.capsule)
                        .overlay(Capsule().stroke(Theme.border.opacity(0.5), lineWidth: 0.5))
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(m.label), locked")
                    }
                }
                // The condition has to describe the chips above it. Reading's own
                // note ("Almost there — short pieces at your level for now.") only
                // belongs here while Reading is one of the locked chips; once the
                // bridge opens Reading, the row shows the higher modalities' real
                // condition instead.
                if let next = locked.first, let condition = store.unlockCondition(for: next) {
                    Text(condition)
                        .font(.caption).foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            if bridgeOpen {
                Button { open(.read) } label: {
                    HStack(spacing: 8) {
                        Image(systemName: LearningModality.reading.icon).font(.footnote).foregroundStyle(Theme.success)
                            .accessibilityHidden(true)
                        Text("Read short pieces at your level").font(.footnote.weight(.semibold)).foregroundStyle(Theme.text)
                        Spacer()
                        Image(systemName: "chevron.right").font(.caption).foregroundStyle(Theme.textSecondary)
                            .accessibilityHidden(true)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .frame(minHeight: Theme.minimumHitTarget)
                    .background(Theme.successLight).clipShape(.rect(cornerRadius: Radius.card))
                }
                .buttonStyle(.plain)
                .pressable()
                .accessibilityHint("Opens Reading with short, level-capped pieces")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Today plan (the front door)

    private var todayPlanSection: some View {
        let plan = dailyPlan
        return VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "sun.max.fill").font(.subheadline).foregroundStyle(Theme.primary)
                    .frame(width: 28 * tile, height: 28 * tile)
                    .background(Theme.primaryLight).clipShape(.rect(cornerRadius: 8))
                    .accessibilityHidden(true)
                Text("Today's Plan").scaledSerifDisplay(22, weight: .bold).foregroundStyle(Theme.text)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                if plan.totalMinutes > 0 {
                    Text("\(planMinutesDone(plan))/\(plan.totalMinutes) min")
                        .font(.caption.weight(.semibold)).foregroundStyle(Theme.textSecondary)
                        .accessibilityLabel("\(planMinutesDone(plan)) of \(plan.totalMinutes) minutes done")
                }
            }

            Text(plan.rationale)
                .font(.subheadline).foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)

            VStack(spacing: 10) {
                // The unlock action leads and is the primary action (D2).
                if let unlock = plan.unlockItem { unlockRow(unlock) }
                ForEach(plan.items.filter { $0.kind != .unlock }) { item in planRow(item) }
                // Chosen activities that are still locked: disabled, with the condition (D1).
                ForEach(store.lockedChosenModalities) { m in lockedPlanRow(m) }
            }

            // The plan already carries a lessons row that starts the same lesson,
            // so the "Lesson ready" card only shows for a plan with no lessons spine.
            if capstoneReady { capstoneRow }
            else if lessonReady && !plan.isLessonPaced { lessonReadyRow }
        }
        .padding(Space.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: Radius.hero))
        .overlay(RoundedRectangle(cornerRadius: Radius.hero).stroke(Theme.border.opacity(0.5), lineWidth: 0.5))
        .softLift(radius: 22, y: 10)
    }

    private func planMinutesDone(_ plan: DailyPlan) -> Int {
        plan.minuteItems.reduce(0) { $0 + min(store.planProgress(for: $1), $1.targetMinutes) }
    }

    /// A minutes row or the post-unlock lessons spine. Progress is the store's
    /// (`planProgress(for:)`), never computed here.
    private func planRow(_ item: DailyPlanItem) -> some View {
        let done = store.planProgress(for: item)
        let target = max(1, item.target)
        let progress = min(1, Double(done) / Double(target))
        let complete = done >= item.target
        let title: String
        let subtitle: String
        let icon: String
        switch item.kind {
        case .lessons:
            title = "Lessons"
            subtitle = HomeCopy.lessonPace(done: done, target: item.target)
            icon = "graduationcap.fill"
        case .minutes, .unlock:
            title = item.modality?.label ?? "Practice"
            subtitle = "\(done)/\(item.targetMinutes) min · \(item.modality?.subtitle ?? "")"
            icon = item.modality?.icon ?? "clock"
        }
        return Button {
            switch item.kind {
            case .lessons: startSmartLesson()
            case .minutes, .unlock: if let m = item.modality, let target = section(for: m) { open(target) }
            }
        } label: {
            HStack(spacing: 14) {
                ZStack {
                    Circle().stroke(Theme.primaryLight, lineWidth: 4)
                        .frame(width: 40 * tile, height: 40 * tile)
                    Circle().trim(from: 0, to: CGFloat(progress))
                        .stroke(complete ? Theme.success : Theme.primary, style: .init(lineWidth: 4, lineCap: .round))
                        .rotationEffect(.degrees(-90)).frame(width: 40 * tile, height: 40 * tile)
                        .reducedMotionAnimation(.spring(response: 0.5, dampingFraction: 0.8), value: progress)
                    Image(systemName: complete ? "checkmark" : icon)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(complete ? Theme.success : Theme.primary)
                }
                .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
                    Text(subtitle).font(.caption).foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(Theme.textSecondary)
                    .accessibilityHidden(true)
            }
            .padding(Space.md)
            .frame(minHeight: Theme.minimumHitTarget)
            .background(Theme.backgroundSecondary)
            .clipShape(.rect(cornerRadius: Radius.card))
            .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.border.opacity(0.4), lineWidth: 0.5))
        }
        .buttonStyle(.plain)
        .pressable()
        .accessibilityLabel("\(title), \(subtitle)")
        .accessibilityValue(complete ? "Done" : "\(done) of \(item.target)")
    }

    /// The day's primary action when every chosen activity is locked (D2):
    /// "15 min of Reading unlocks Listening & Speaking", deep-linked to Read.
    private func unlockRow(_ item: DailyPlanItem) -> some View {
        let done = store.planProgress(for: item)
        let bar = max(1, item.target)
        let progress = min(1, Double(done) / Double(bar))
        let modality = item.modality ?? .reading
        let opens = ReadinessCopy.names(of: store.lockedChosenModalities)
        return Button {
            if let target = section(for: modality) { open(target) }
        } label: {
            HStack(spacing: 14) {
                ZStack {
                    Circle().stroke(Color.white.opacity(0.3), lineWidth: 4)
                        .frame(width: 40 * tile, height: 40 * tile)
                    Circle().trim(from: 0, to: CGFloat(progress))
                        .stroke(.white, style: .init(lineWidth: 4, lineCap: .round))
                        .rotationEffect(.degrees(-90)).frame(width: 40 * tile, height: 40 * tile)
                        .reducedMotionAnimation(.spring(response: 0.5, dampingFraction: 0.8), value: progress)
                    Image(systemName: modality.icon).font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                }
                .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Start with \(modality.label)").font(.subheadline.weight(.bold)).foregroundStyle(.white)
                    Text("\(ReadinessCopy.minutesProgress(done: done, bar: item.target)) · opens \(opens)")
                        .font(.caption).foregroundStyle(.white.opacity(0.85))
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer()
                Image(systemName: "arrow.right").font(.subheadline.weight(.bold)).foregroundStyle(.white)
                    .accessibilityHidden(true)
            }
            .padding(Space.md)
            .frame(minHeight: Theme.minimumHitTarget)
            .background(Theme.secondary)
            .clipShape(.rect(cornerRadius: Radius.card))
            .softLift(radius: 12, y: 5, strength: 0.8)
        }
        .buttonStyle(.plain)
        .pressable()
        .accessibilityLabel("Start with \(modality.label)")
        .accessibilityValue("\(ReadinessCopy.minutesProgress(done: done, bar: item.target)); opens \(opens)")
    }

    /// A chosen activity that is still locked: disabled, stating its condition (D1).
    private func lockedPlanRow(_ modality: LearningModality) -> some View {
        let condition = store.unlockCondition(for: modality) ?? ReadinessCopy.lockedLabel
        return HStack(spacing: 14) {
            ZStack {
                Circle().stroke(Theme.border, lineWidth: 4)
                    .frame(width: 40 * tile, height: 40 * tile)
                Image(systemName: "lock.fill").font(.subheadline.weight(.semibold)).foregroundStyle(Theme.textSecondary)
            }
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(modality.label).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.textSecondary)
                Text(condition).font(.caption).foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer()
        }
        .padding(Space.md)
        .frame(minHeight: Theme.minimumHitTarget)
        .background(Theme.backgroundSecondary.opacity(0.6))
        .clipShape(.rect(cornerRadius: Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.border.opacity(0.4), lineWidth: 0.5))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(modality.label), locked. \(condition)")
    }

    private var lessonReadyRow: some View {
        Button {
            // The trigger is reset by `completeLesson`, not here (C14).
            startSmartLesson()
        } label: {
            HStack(spacing: 14) {
                Image(systemName: "graduationcap.fill").font(.headline).foregroundStyle(.white)
                    .frame(width: 40 * tile, height: 40 * tile)
                    .background(Color.white.opacity(0.2)).clipShape(.rect(cornerRadius: 12))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Lesson ready").font(.subheadline.weight(.bold)).foregroundStyle(.white)
                    Text("You've gathered enough to learn from").font(.caption).foregroundStyle(.white.opacity(0.85))
                }
                Spacer()
                Image(systemName: "arrow.right").font(.subheadline.weight(.bold)).foregroundStyle(.white)
                    .accessibilityHidden(true)
            }
            .padding(Space.md)
            .frame(minHeight: Theme.minimumHitTarget)
            .background(Theme.secondary)
            .clipShape(.rect(cornerRadius: Radius.card))
            .softLift(radius: 12, y: 5, strength: 0.8)
        }
        .buttonStyle(.plain)
        .pressable()
        .accessibilityLabel("Lesson ready")
        .accessibilityHint("Starts a lesson from what you've gathered")
    }

    private var capstoneRow: some View {
        Button {
            startCapstone()
        } label: {
            HStack(spacing: 14) {
                Image(systemName: "flag.checkered").font(.headline).foregroundStyle(.white)
                    .frame(width: 40 * tile, height: 40 * tile)
                    .background(Color.white.opacity(0.2)).clipShape(.rect(cornerRadius: 12))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Capstone challenge").font(.subheadline.weight(.bold)).foregroundStyle(.white)
                    Text("A mixed quiz to test what's stuck").font(.caption).foregroundStyle(.white.opacity(0.85))
                }
                Spacer()
                Image(systemName: "arrow.right").font(.subheadline.weight(.bold)).foregroundStyle(.white)
                    .accessibilityHidden(true)
            }
            .padding(Space.md)
            .frame(minHeight: Theme.minimumHitTarget)
            .background(LinearGradient(colors: [Color(hex: "7C3AED"), Color(hex: "4338CA")], startPoint: .leading, endPoint: .trailing))
            .clipShape(.rect(cornerRadius: Radius.card))
            .softLift(radius: 12, y: 5, strength: 0.8)
        }
        .buttonStyle(.plain)
        .pressable()
        .accessibilityLabel("Capstone challenge")
        .accessibilityHint("Starts a mixed quiz that tests what has stuck")
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

    /// Start the session clock for an opened surface. It runs only while the
    /// scene is active; `scenePhase` pauses/resumes it (D9).
    private func beginActivityTracking(_ section: HomeSection) {
        activitySession = ActivitySession(modality: section.modality, startedAt: Date(),
                                          inForeground: scenePhase == .active)
        sectionBaselineGaps = store.gaps.count
    }

    /// Credit the session's foreground time (capped by the store, D9) and
    /// summarise what was captured.
    private func finalizeActivity() {
        guard var session = activitySession else { return }
        activitySession = nil
        let now = Date()
        session.pause(at: now)
        if let modality = session.modality {
            store.creditActivity(modality, activeSeconds: session.activeSeconds(at: now), now: now)
        }
        let newGaps = store.gaps.count - sectionBaselineGaps
        if newGaps > 0 {
            Haptics.success()
            showToast(HomeCopy.captured(newGaps), icon: "checkmark.seal.fill", tint: Theme.success)
        }
    }

    // MARK: - Toast

    private func showToast(_ text: String, icon: String, tint: Color) {
        toastTask?.cancel()
        withAnimation(Theme.motion(.spring(response: 0.4, dampingFraction: 0.8), reduceMotion: reduceMotion)) {
            toast = HomeToast(text: text, icon: icon, tint: tint)
        }
        toastTask = Task {
            try? await Task.sleep(for: .seconds(Tuning.homeToastSeconds))
            guard !Task.isCancelled else { return }
            withAnimation(Theme.motion(.default, reduceMotion: reduceMotion)) { toast = nil }
        }
    }

    @ViewBuilder private var toastView: some View {
        if let toast {
            HStack(spacing: 10) {
                Image(systemName: toast.icon).font(.callout).foregroundStyle(toast.tint)
                    .accessibilityHidden(true)
                Text(toast.text).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
            .background(.ultraThinMaterial, in: Capsule())
            .overlay(Capsule().stroke(Theme.border.opacity(0.5), lineWidth: 0.5))
            .softLift(radius: 14, y: 6)
            .padding(.horizontal, 24)
            .padding(.bottom, 28)
            .transition(reduceMotion ? AnyTransition.opacity
                                     : AnyTransition.move(edge: .bottom).combined(with: .opacity))
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.updatesFrequently)
        }
    }

    // MARK: - Explore (secondary tool drawer)

    private var exploreSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Button {
                withAnimation(Theme.motion(.spring(response: 0.4, dampingFraction: 0.85), reduceMotion: reduceMotion)) {
                    exploreExpanded.toggle()
                }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "square.grid.2x2.fill").font(.footnote).foregroundStyle(Theme.secondary)
                        .frame(width: 28 * tile, height: 28 * tile)
                        .background(Theme.secondaryLight).clipShape(.rect(cornerRadius: 8))
                        .accessibilityHidden(true)
                    Text("Explore").scaledSerifDisplay(20, weight: .semibold).foregroundStyle(Theme.text)
                    Spacer()
                    Image(systemName: exploreExpanded ? "chevron.up" : "chevron.down")
                        .font(.footnote.weight(.semibold)).foregroundStyle(Theme.textSecondary)
                        .accessibilityHidden(true)
                }
                .padding(.horizontal, 20)
                .frame(minHeight: Theme.minimumHitTarget)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Explore")
            .accessibilityValue(exploreExpanded ? "Expanded" : "Collapsed")
            .accessibilityHint(exploreExpanded ? "Collapses the activity cards" : "Expands the activity cards")

            if exploreExpanded {
                carousel.transition(reduceMotion ? AnyTransition.opacity
                                                 : AnyTransition.opacity.combined(with: .move(edge: .top)))
            }
        }
    }

    // MARK: - Signature sliding carousel

    private var featureCards: [FeatureCard] {
        [
            FeatureCard(id: "learn", title: "Learn", subtitle: "Practice your gaps",
                        description: "Master vocabulary, grammar & more with adaptive lessons",
                        icon: "graduationcap.fill", iconColor: Theme.secondary, iconBg: Theme.secondaryLight,
                        stats: HomeCopy.learnCardStat(toLearn: store.visibleGaps.count, practised: store.practisedGaps.count), modality: nil) {
                startSmartLesson()
            },
            FeatureCard(id: "read", title: "Read", subtitle: "Articles & stories",
                        description: "Immerse yourself in French content, tap any word",
                        icon: "book.fill", iconColor: Theme.success, iconBg: Theme.successLight,
                        stats: store.readiness(for: .reading) == .foundation ? ReadinessCopy.bridgeStat : "Tap to read",
                        modality: .reading) { open(.read) },
            FeatureCard(id: "listen", title: "Listen", subtitle: "Dialogues & stories",
                        description: "Train your ear with real French audio & subtitles",
                        icon: "headphones", iconColor: Theme.purple, iconBg: Color(hex: "EDE9FE"),
                        stats: "\(ListeningData.items.count) scenarios", modality: .listening) { open(.listen) },
            FeatureCard(id: "speak", title: "Speak", subtitle: "Practice sessions",
                        description: "Build fluency with speech practice & feedback",
                        icon: "mic.fill", iconColor: Theme.warning, iconBg: Theme.warningLight,
                        stats: "Talk freely", modality: .speaking) { open(.speak) },
            FeatureCard(id: "converse", title: "Converse", subtitle: "Live AI tutor",
                        description: "Hold a spoken conversation with your French tutor",
                        icon: "phone.bubble.fill", iconColor: Color(hex: "E11D48"), iconBg: Color(hex: "FFE4E6"),
                        stats: "\(ConverseScenario.all.count) scenarios", modality: .speaking) { open(.converse) },
            FeatureCard(id: "watch", title: "Watch", subtitle: "Video lessons",
                        description: "Learn French with immersive video transcripts",
                        icon: "play.rectangle.fill", iconColor: Theme.indigo, iconBg: Color(hex: "E0E7FF"),
                        stats: "Interactive transcripts", modality: .watching) { open(.watch) },
            FeatureCard(id: "deck", title: "Deck", subtitle: "Spaced repetition",
                        description: "Drill your gaps until mastery with smart review",
                        icon: "square.stack.3d.up.fill", iconColor: Theme.primary, iconBg: Theme.primaryLight,
                        stats: "\(store.dueNow.count) \(HomeCopy.dueNowLabel.lowercased())", modality: nil) { open(.deck) },
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
                                    // Reduce Motion: the neighbouring cards dim
                                    // instead of shrinking as they scroll past.
                                    .scaleEffect(phase.isIdentity || reduceMotion ? 1 : 0.91, anchor: .center)
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
    /// Sized from the item COUNT, not from a fixed 230 pt: seven indicators inside
    /// 230 pt are ~33 pt wide each, well under the 44 pt touch target, and adjacent
    /// targets that small get mis-tapped. It shrinks only if the screen genuinely
    /// cannot fit `count × 44` plus a margin.
    private var navBarWidth: CGFloat {
        min(screenW - 40, CGFloat(featureCards.count) * Theme.minimumHitTarget)
    }
    private var navItemWidth: CGFloat { navBarWidth / CGFloat(max(1, featureCards.count)) }

    private var miniNavBar: some View {
        HStack(spacing: 0) {
            ForEach(featureCards) { card in
                let active = currentCardId == card.id
                Button {
                    Haptics.tap()
                    withAnimation(Theme.motion(.spring(response: 0.45, dampingFraction: 0.82), reduceMotion: reduceMotion)) {
                        currentCardId = card.id
                    }
                } label: {
                    Image(systemName: card.icon)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(active ? Theme.primary : Theme.textSecondary.opacity(0.75))
                        .scaleEffect(active && !reduceMotion ? 1.12 : 1)
                        .reducedMotionAnimation(.spring(response: 0.35, dampingFraction: 0.7), value: active)
                        // The pill stays 34 pt tall (drawn behind); the tappable
                        // area is a full 44 pt square (the bar is sized from the
                        // item count so the width clears the target too), which
                        // leaves the bar's visible height unchanged.
                        .frame(width: navItemWidth, height: Theme.minimumHitTarget)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(card.title)
                .accessibilityAddTraits(active ? [.isButton, .isSelected] : [.isButton])
            }
        }
        .background(alignment: .leading) {
            Capsule()
                .fill(Theme.primary.opacity(0.14))
                .frame(width: navItemWidth, height: 34)
                .offset(x: CGFloat(activeIndex) * navItemWidth)
                .reducedMotionAnimation(.spring(response: 0.42, dampingFraction: 0.78), value: activeIndex)
        }
        // Horizontal only: each item is already 44 pt tall (the minimum touch
        // target), which is exactly the height the 34 pt pill plus 5 pt of
        // vertical padding used to make.
        .padding(.horizontal, 5)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay(Capsule().stroke(Color.white.opacity(0.65), lineWidth: 0.5))
        .softLift(radius: 14, y: 5, strength: 0.9)
        .frame(width: navBarWidth + 10)
    }

    private func featureCardView(_ card: FeatureCard) -> some View {
        let locked = card.modality.map { !store.canOpen($0) } ?? false
        let condition = card.modality.flatMap { store.unlockCondition(for: $0) }
        return Button(action: card.action) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    Image(systemName: card.icon)
                        .font(.largeTitle)
                        .foregroundStyle(locked ? Theme.textSecondary : card.iconColor)
                        .frame(width: 60 * mark, height: 60 * mark)
                        .background(locked ? Theme.backgroundSecondary : card.iconBg)
                        .clipShape(.rect(cornerRadius: 18))
                        .accessibilityHidden(true)
                    Spacer()
                    if locked {
                        HStack(spacing: 4) {
                            Image(systemName: "lock.fill").font(.caption2)
                            Text(ReadinessCopy.lockedLabel).font(.caption2.weight(.semibold))
                        }
                        .foregroundStyle(Theme.textSecondary)
                        .padding(.horizontal, 9).padding(.vertical, 5)
                        .background(Theme.backgroundSecondary).clipShape(.capsule)
                    }
                }
                .padding(.bottom, 18)

                Text(card.title).scaledSerifDisplay(28, weight: .bold).foregroundStyle(Theme.text)
                Text(card.subtitle).font(.subheadline).foregroundStyle(Theme.textSecondary).padding(.top, 4)
                Text(card.description).font(.subheadline).foregroundStyle(Theme.textSecondary)
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
                        // A locked card states its unlock condition where the stat line would be.
                        Text(locked ? (condition ?? ReadinessCopy.lockedLabel) : card.stats)
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(locked ? Theme.textSecondary : Theme.primary)
                            .fixedSize(horizontal: false, vertical: true)
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
            .opacity(locked ? 0.72 : 1)
        }
        .buttonStyle(.plain)
        .disabled(locked)
        .accessibilityLabel(locked ? "\(card.title), locked. \(condition ?? "")" : "\(card.title), \(card.subtitle)")
        .accessibilityHint(locked ? "" : card.description)
    }

    private var learnStatRow: some View {
        let active = store.visibleGaps.count
        let mastered = store.masteredGaps.count
        let due = store.dueNow.count
        let total = max(active + mastered, 1)
        return VStack(spacing: 12) {
            HStack(spacing: 0) {
                learnStat(value: "\(active)", label: HomeCopy.toLearnLabel)
                Rectangle().fill(Theme.border).frame(width: 1, height: 26)
                learnStat(value: "\(mastered)", label: "Mastered")
                Rectangle().fill(Theme.border).frame(width: 1, height: 26)
                learnStat(value: "\(due)", label: HomeCopy.dueNowLabel)
            }
            progressBar(Double(mastered) / Double(total), tint: Theme.secondary, height: 6)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Mastered share")
                .accessibilityValue("\(mastered) of \(total)")
        }
    }

    private func learnStat(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.callout.weight(.bold)).foregroundStyle(Theme.text)
            Text(label).font(.caption2).foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label): \(value)")
    }

    // MARK: - Headlines (an entry into Read — never sample headlines)

    private var headlinesSection: some View {
        let locked = !store.canOpen(.reading)
        let condition = store.unlockCondition(for: .reading)
        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                HStack(spacing: 8) {
                    Image(systemName: "newspaper.fill").font(.footnote).foregroundStyle(Theme.secondary)
                        .frame(width: 28 * tile, height: 28 * tile)
                        .background(Theme.secondaryLight).clipShape(.rect(cornerRadius: 8))
                        .accessibilityHidden(true)
                    Text("Today's Headlines").scaledSerifDisplay(20, weight: .semibold).foregroundStyle(Theme.text)
                        .accessibilityAddTraits(.isHeader)
                }
                Spacer()
                Button { open(.read) } label: {
                    Text("See All").font(.footnote.weight(.semibold))
                        .foregroundStyle(locked ? Theme.textSecondary : Theme.primary)
                        .frame(minWidth: Theme.minimumHitTarget, minHeight: Theme.minimumHitTarget)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(locked)
                .accessibilityLabel(locked ? "See all headlines, locked" : "See all headlines")
            }
            Button { open(.read) } label: {
                HStack(spacing: 12) {
                    Image(systemName: locked ? "lock.fill" : "newspaper")
                        .font(.headline)
                        .foregroundStyle(locked ? Theme.textSecondary : Theme.success)
                        .frame(width: 38 * tile, height: 38 * tile)
                        .background(locked ? Theme.backgroundSecondary : Theme.successLight)
                        .clipShape(.rect(cornerRadius: 11))
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(locked ? "French news unlocks with Reading" : "Fresh French news at your level")
                            .font(.subheadline.weight(.medium)).foregroundStyle(locked ? Theme.textSecondary : Theme.text)
                            .fixedSize(horizontal: false, vertical: true)
                            .multilineTextAlignment(.leading)
                        Text(locked ? (condition ?? ReadinessCopy.lockedLabel)
                                    : (condition ?? "Tap any word to save it as a gap"))
                            .font(.caption).foregroundStyle(Theme.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                            .multilineTextAlignment(.leading)
                    }
                    Spacer()
                    if !locked {
                        Image(systemName: "chevron.right").font(.footnote).foregroundStyle(Theme.textSecondary)
                            .accessibilityHidden(true)
                    }
                }
                .padding(Space.lg)
                .frame(minHeight: Theme.minimumHitTarget)
                .background(Theme.card)
                .clipShape(.rect(cornerRadius: Radius.card))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.card)
                        .stroke(Theme.border.opacity(0.5), lineWidth: 0.5)
                )
                .softLift()
                .opacity(locked ? 0.72 : 1)
            }
            .buttonStyle(.plain)
            .pressable()
            .disabled(locked)
            .accessibilityLabel(locked ? "Headlines, locked. \(condition ?? "")" : "Read today's French news")
        }
    }

    // MARK: - Resources

    private var resourcesSection: some View {
        VStack(alignment: .leading, spacing: Space.lg) {
            Text("Resources").scaledSerifDisplay(20, weight: .semibold).foregroundStyle(Theme.text)
                .accessibilityAddTraits(.isHeader)
            ScrollView(.horizontal) {
                HStack(spacing: 14) {
                    ForEach([HomeResource.scenarios, .translator, .tenses, .accent, .idioms, .gaps]) { r in
                        resourceButton(r)
                    }
                }
            }
            .scrollIndicators(.hidden)
        }
    }

    private func resourceButton(_ r: HomeResource) -> some View {
        let locked = r.modality.map { !store.canOpen($0) } ?? false
        let condition = r.modality.flatMap { store.unlockCondition(for: $0) }
        return Button { open(r) } label: {
            VStack(spacing: 8) {
                Image(systemName: r.icon).font(.title2)
                    .foregroundStyle(locked ? Theme.textSecondary : Theme.primary)
                    .frame(width: 56 * tile, height: 56 * tile)
                    .background(locked ? Theme.backgroundSecondary : Theme.primaryLight).clipShape(.circle)
                    .overlay(alignment: .bottomTrailing) {
                        if locked {
                            Image(systemName: "lock.fill").font(.caption2.weight(.bold))
                                .foregroundStyle(.white)
                                .frame(width: 20 * tile, height: 20 * tile)
                                .background(Theme.textSecondary, in: Circle())
                        }
                    }
                    .accessibilityHidden(true)
                Text(r.label).font(.caption.weight(.medium))
                    // Both states read at the same contrast; the lock badge carries the state.
                    .foregroundStyle(Theme.textSecondary)
                    .multilineTextAlignment(.center)
            }
            .frame(minWidth: 64)
        }
        .buttonStyle(.plain)
        .pressable()
        .disabled(locked)
        .accessibilityLabel(locked ? "\(r.label), locked. \(condition ?? "")" : r.label)
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

    /// The ONE displayed level (D12); nil before placement.
    private var currentLevel: CEFRLevel? { store.hasCompletedAssessment ? store.learnerLevel : nil }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    if let placedLine = HomeCopy.placedLine(placed: store.hasCompletedAssessment, assessedLevel: store.assessedLevel) {
                        Text("\(placedLine) · now studying at \(store.learnerLevel.rawValue)")
                            .font(.footnote).foregroundStyle(Theme.textSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    } else {
                        Text("Not placed yet — the short placement in your profile finds your level.")
                            .font(.footnote).foregroundStyle(Theme.textSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    ForEach(levels, id: \.level) { item in
                        let isCurrent = item.level == currentLevel
                        VStack(alignment: .leading, spacing: 8) {
                            HStack(spacing: 12) {
                                Text(item.level.rawValue)
                                    .font(.subheadline.weight(.bold)).foregroundStyle(Theme.primary)
                                    .padding(.horizontal, 10).padding(.vertical, 5)
                                    .background(Theme.primaryLight).clipShape(.rect(cornerRadius: 8))
                                Text(item.name).font(.callout.weight(.semibold)).foregroundStyle(Theme.text)
                                Spacer()
                                if isCurrent {
                                    HStack(spacing: 4) {
                                        Image(systemName: "arrow.up.right").font(.caption2)
                                        Text("In Progress").font(.caption2.weight(.semibold))
                                    }
                                    .foregroundStyle(Theme.primary)
                                    .padding(.horizontal, 8).padding(.vertical, 3)
                                    .background(Theme.primaryLight).clipShape(.capsule)
                                }
                            }
                            Text(item.desc).font(.footnote).foregroundStyle(Theme.textSecondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(16)
                        .background(Theme.card)
                        .clipShape(.rect(cornerRadius: 16))
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(isCurrent ? Theme.primary : .clear, lineWidth: 1.5))
                        .accessibilityElement(children: .combine)
                        .accessibilityValue(isCurrent ? "Current level" : "")
                    }
                }
                .padding(20)
            }
            .background(Theme.background)
            .navigationTitle("CEFR Proficiency")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { dismiss() } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(Theme.textSecondary) }
                        .accessibilityLabel("Close")
                }
            }
        }
    }
}
