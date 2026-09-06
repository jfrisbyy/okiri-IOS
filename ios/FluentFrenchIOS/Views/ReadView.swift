//
//  ReadView.swift
//  FluentFrenchIOS
//
//  Live French news feed + curated library. The screen honours the reading
//  gate (`store.readiness(for: .reading)`): locked → the unlock condition;
//  bridge (`.foundation`) → only short curated pieces at or below
//  `Tuning.readingBridgeMaxLevel`; unlocked → feed + library sorted by closeness
//  to `store.learnerLevel`. Every network outcome is an explicit state (live /
//  curated-with-reason / search failed) — nothing spins unbounded and no
//  failure looks like "no results" (E20, E22, E26).
//

import SwiftUI

@MainActor
@Observable
final class ReadModel {
    var result: NewsFeedResult? = nil
    var isLoading = false
    var category: NewsCategory = .all
    var regionGroup: ReadRegionGroup = .all
    var displayLimit = 8
    /// The level the feed is sorted around (the learner's level at load time).
    var sortLevel: CEFRLevel = .B1

    var articles: [NewsArticle] { result?.articles ?? [] }
    var failure: NewsFailure? { result?.failure }
    var isLive: Bool {
        if case .live = result { return true }
        return false
    }

    /// The region chips worth showing: only groups the loaded feed actually has,
    /// and nothing at all unless there are at least two to choose between. A live
    /// feed whose outlets name no region shows no strip rather than four chips
    /// that can only ever come back empty.
    var availableRegions: [ReadRegionGroup] {
        let present = ReadRegionGroup.allCases.filter { group in
            group != .all && articles.contains { $0.region == group }
        }
        return present.count > 1 ? [.all] + present : []
    }

    /// Region-filtered, closest-to-level first, newest first within a level.
    var filtered: [NewsArticle] {
        let base = regionGroup == .all ? articles : articles.filter { $0.region == regionGroup }
        return base.sorted { a, b in
            let da = abs(ReadingShelf.rank(a.level) - ReadingShelf.rank(sortLevel))
            let db = abs(ReadingShelf.rank(b.level) - ReadingShelf.rank(sortLevel))
            if da != db { return da < db }
            return a.publishedAt > b.publishedAt
        }
    }
    var displayed: [NewsArticle] { Array(filtered.prefix(displayLimit)) }

    /// Rises with every load started. Two loads can be in flight at once (tap
    /// one category chip, then another), and whichever answers last would
    /// otherwise win — so a fetch only publishes while it is still the
    /// current one, and a superseded fetch also leaves `isLoading` alone.
    @ObservationIgnored private var loadToken = 0

    func load(level: CEFRLevel, reset: Bool = true) async {
        loadToken &+= 1
        let token = loadToken
        if reset { displayLimit = 8 }
        sortLevel = level
        isLoading = true
        let fetched = await NewsService.fetch(category: category)
        guard token == loadToken else { return }
        result = fetched
        isLoading = false
        // A region that this feed has no stories for must not stay selected, or
        // the learner lands on an empty list they never asked for.
        if !availableRegions.contains(regionGroup) { regionGroup = .all }
    }
}

/// The search box's explicit states (E22).
enum ReadSearchState: Equatable {
    case idle
    case loading
    case results([NewsArticle])
    case noResults(query: String)
    case failed(NewsFailure)
}

struct ReadView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var model = ReadModel()
    @State private var activeView: ReadTab = .feed
    @State private var searching = false
    @State private var searchText = ""
    @State private var search: ReadSearchState = .idle
    /// 1 at the default text size, larger as the learner's text size grows.
    /// Chrome drawn around text (the header band, the image cards, the round
    /// search button) grows with it so scaled text still fits inside it.
    @ScaledMetric private var typeScale: CGFloat = 1

    /// Image cards keep their proportions but stop growing eventually — a card
    /// three times taller than designed would push everything else off-screen.
    private var cardScale: CGFloat { min(max(typeScale, 1), 1.8) }

    enum ReadTab { case feed, library }

    private var readiness: ModalityReadiness { store.readiness(for: .reading) }
    private var level: CEFRLevel { store.learnerLevel }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                header
                switch readiness {
                case .locked:
                    lockedContent
                case .foundation:
                    bridgeBanner
                    LibraryView(readiness: .foundation)
                case .unlocked:
                    // Search replaces the Feed/Library switch rather than sitting
                    // above it: while search is open the switch could only move its
                    // own highlight — `content` shows the results either way — so a
                    // control that cannot do anything is not offered.
                    if searching {
                        searchBar
                    } else {
                        segmented
                    }
                    content
                }
            }
            .background(Theme.background)
            .ignoresSafeArea(edges: .top)
            .navigationBarHidden(true)
            .navigationDestination(for: NewsArticle.self) { ArticleReaderView(article: $0) }
            .navigationDestination(for: ReadingPiece.self) { ReaderView(piece: $0) }
        }
        .task {
            if readiness == .unlocked, model.result == nil { await model.load(level: level) }
            // Words saved offline / without a key wait for a meaning (E4). Retry
            // whenever the tab opens, not only after the next word sheet — the
            // pass is bounded by `Tuning.pendingTranslationBatch` and stops at
            // the first failure, so it is a no-op while still offline.
            if TranslationService.hasKey, !store.pendingTranslations.isEmpty {
                await store.resolvePendingTranslations(using: TranslationService.lookup(term:context:))
            }
        }
    }

    // MARK: - Header

    private var headerSubtitle: String {
        switch readiness {
        case .locked: return "Opens as you build the basics"
        case .foundation: return ReadinessCopy.bridgeStat
        case .unlocked: return "Real French — tap any word you don't know"
        }
    }

    /// The gradient moved from a ZStack layer to a background so the band's
    /// height follows the (now scalable) title and subtitle instead of pinning
    /// them inside 150 pt. At the default text size the layout is unchanged.
    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Read").scaledSerifDisplay(34, weight: .bold).foregroundStyle(.white)
                    .accessibilityAddTraits(.isHeader)
                Text(headerSubtitle)
                    .font(.subheadline).foregroundStyle(.white.opacity(0.85))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer()
            if readiness == .unlocked {
                Button {
                    Haptics.tap()
                    withAnimation(Theme.motion(.default, reduceMotion: reduceMotion)) { searching.toggle() }
                    // Closing search clears the query too, so re-opening it starts
                    // empty instead of showing a stale term with no results.
                    if !searching { search = .idle; searchText = "" }
                } label: {
                    Image(systemName: searching ? "xmark" : "magnifyingglass")
                        .scaledFont(17, weight: .semibold).foregroundStyle(.white)
                        .frame(width: Theme.minimumHitTarget * typeScale,
                               height: Theme.minimumHitTarget * typeScale)
                        .background(Color.white.opacity(0.2)).clipShape(.circle)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(searching ? "Close search" : "Search stories")
                .accessibilityHint(searching ? "Returns to the feed" : "Finds French stories on any topic")
            }
        }
        .padding(.horizontal, 20).padding(.top, 60).padding(.bottom, 18)
        .frame(maxWidth: .infinity, minHeight: 150, alignment: .bottomLeading)
        .background {
            ZStack(alignment: .bottomLeading) {
                Theme.primaryGradient
                Circle().fill(Color.white.opacity(0.1)).frame(width: 150, height: 150).offset(x: -40, y: 50)
            }
        }
        .clipped()
    }

    // MARK: - Gate states

    private var lockedContent: some View {
        ScrollView {
            VStack(spacing: 12) {
                Image(systemName: "lock.fill").scaledFont(30).foregroundStyle(Theme.textMuted)
                    .accessibilityHidden(true)
                Text("Reading isn't open yet").font(.headline).foregroundStyle(Theme.text)
                Text(ReadinessCopy.unlockCondition(for: .reading, readiness: .locked, readingReadiness: .locked,
                                                   readingMinutes: store.totalMinutes(.reading),
                                                   governorActive: store.isGovernorActive) ?? "")
                    .font(.subheadline).foregroundStyle(Theme.textSecondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity).padding(.vertical, 50).padding(.horizontal, 24)
            .background(Theme.card).clipShape(.rect(cornerRadius: 16))
            .padding(16)
        }
    }

    /// The honest bridge banner (D5/E20): short curated pieces only, no live feed.
    private var bridgeBanner: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "figure.walk").font(.subheadline.weight(.bold)).foregroundStyle(Theme.primary)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text(ReadinessCopy.bridgeCondition).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
                Text("Curated pieces up to \(Tuning.readingBridgeMaxLevel.rawValue). Live headlines and search open with the rest of Reading.")
                    .font(.footnote).foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Theme.primaryLight)
        .clipShape(.rect(cornerRadius: 12))
        .padding(.horizontal, 16).padding(.top, 12)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Search

    private var searchBar: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass").foregroundStyle(Theme.textMuted).accessibilityHidden(true)
            TextField("Search any topic…", text: $searchText)
                .font(.body).autocorrectionDisabled()
                .onSubmit { Task { await runSearch() } }
                .accessibilityLabel("Search stories")
            if !searchText.isEmpty {
                Button { searchText = ""; search = .idle } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(Theme.textMuted)
                        .frame(minWidth: 44, minHeight: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 6)
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
        .padding(.horizontal, 16).padding(.top, 12)
    }

    private func runSearch() async {
        let q = searchText.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { search = .idle; return }
        search = .loading
        switch await NewsService.search(q) {
        case .results(let articles): search = .results(articles)
        case .noResults: search = .noResults(query: q)
        case .failed(let failure): search = .failed(failure)
        }
    }

    private var segmented: some View {
        HStack(spacing: 4) {
            segmentButton("Feed", .feed, "newspaper.fill")
            segmentButton("Library", .library, "books.vertical.fill")
        }
        .padding(4)
        .background(Theme.backgroundSecondary)
        .clipShape(.rect(cornerRadius: 12))
        .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 8)
    }

    private func segmentButton(_ title: String, _ tab: ReadTab, _ icon: String) -> some View {
        let active = activeView == tab
        return Button {
            Haptics.tap()
            withAnimation(Theme.motion(.spring(response: 0.3, dampingFraction: 0.8), reduceMotion: reduceMotion)) {
                activeView = tab
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: icon).scaledFont(13).accessibilityHidden(true)
                Text(title).font(.subheadline.weight(.semibold))
            }
            .foregroundStyle(active ? .white : Theme.textSecondary)
            .frame(maxWidth: .infinity).frame(minHeight: Theme.minimumHitTarget)
            .background(active ? Theme.primary : .clear)
            .clipShape(.rect(cornerRadius: 9))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(active ? .isSelected : [])
    }

    @ViewBuilder
    private var content: some View {
        if searching {
            searchContent
        } else if activeView == .feed {
            feedContent
        } else {
            LibraryView(readiness: .unlocked)
        }
    }

    // MARK: - Feed

    private var feedContent: some View {
        ScrollView {
            VStack(spacing: 14) {
                categoryStrip
                regionStrip

                if model.isLoading && model.articles.isEmpty {
                    feedSkeleton
                } else if model.result == nil {
                    emptyCard
                } else {
                    feedBanner
                    if model.filtered.isEmpty {
                        emptyCard
                    } else {
                        ForEach(Array(model.displayed.enumerated()), id: \.element.id) { idx, article in
                            NavigationLink(value: article) {
                                feedCard(article, hero: idx == 0)
                            }
                            .buttonStyle(.plain)
                            .pressable()
                        }
                        if model.filtered.count > model.displayLimit {
                            Button {
                                Haptics.tap()
                                model.displayLimit += 8
                            } label: {
                                Label("Load more", systemImage: "arrow.down.circle")
                                    .font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                                    .frame(maxWidth: .infinity).frame(minHeight: 48)
                                    .background(Theme.primary).clipShape(.rect(cornerRadius: 12))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 40)
        }
        .scrollIndicators(.hidden)
        .refreshable { await model.load(level: level) }
    }

    private var feedSkeleton: some View {
        VStack(spacing: 14) {
            SkeletonBlock(height: 230 * cardScale, cornerRadius: 16)
            ForEach(0..<3, id: \.self) { _ in
                SkeletonBlock(height: 150 * cardScale, cornerRadius: 16)
            }
        }
        .padding(.top, 4)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading stories")
    }

    /// Says exactly where the stories came from and how they are ordered.
    @ViewBuilder
    private var feedBanner: some View {
        if let failure = model.failure {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: failure == .offline ? "wifi.slash" : "info.circle.fill")
                    .font(.footnote.weight(.bold)).foregroundStyle(Theme.warning)
                    .accessibilityHidden(true)
                Text(failure.message).font(.footnote).foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                if failure.isRetryable {
                    Button { Haptics.tap(); Task { await model.load(level: level) } } label: {
                        Text("Retry").font(.footnote.weight(.semibold)).foregroundStyle(Theme.primary)
                            .frame(minWidth: Theme.minimumHitTarget, minHeight: Theme.minimumHitTarget)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Retry loading stories")
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 6)
            .background(Theme.warningLight)
            .clipShape(.rect(cornerRadius: 10))
        } else {
            HStack(spacing: 6) {
                Image(systemName: "bolt.fill").scaledFont(12).foregroundStyle(Theme.primary)
                    .accessibilityHidden(true)
                Text("Live headlines · closest to your level (\(level.rawValue)) first · levels are estimates")
                    .font(.footnote).foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer()
                Text("\(model.displayed.count) of \(model.filtered.count)").font(.caption).foregroundStyle(Theme.textSecondary)
                    .accessibilityLabel("Showing \(model.displayed.count) of \(model.filtered.count) stories")
            }
            .padding(.vertical, 2)
        }
    }

    private var categoryStrip: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(NewsCategory.allCases) { cat in
                    let active = model.category == cat
                    Button {
                        Haptics.tap()
                        model.category = cat
                        Task { await model.load(level: level) }
                    } label: {
                        Text(cat.label)
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(active ? .white : Theme.textSecondary)
                            .padding(.horizontal, 14).frame(minHeight: 44)
                            .background(active ? Color(hex: cat.hex) : Theme.card)
                            .clipShape(.capsule)
                            .overlay(Capsule().stroke(active ? .clear : Theme.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(active ? .isSelected : [])
                }
            }
        }
        .contentMargins(.horizontal, 0, for: .scrollContent)
        .scrollIndicators(.hidden)
    }

    @ViewBuilder
    private var regionStrip: some View {
        let groups = model.availableRegions
        if !groups.isEmpty {
            regionChips(groups)
        }
    }

    private func regionChips(_ groups: [ReadRegionGroup]) -> some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(groups) { group in
                    let active = model.regionGroup == group
                    Button {
                        Haptics.tap()
                        model.regionGroup = group
                    } label: {
                        HStack(spacing: 5) {
                            Text(group.emoji).scaledFont(12)
                            Text(group.label).font(.footnote.weight(.medium))
                        }
                        .foregroundStyle(active ? Theme.primaryDark : Theme.textSecondary)
                        .padding(.horizontal, 12).frame(minHeight: Theme.minimumHitTarget)
                        .background(active ? Theme.primaryLight : Theme.backgroundSecondary)
                        .clipShape(.capsule)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(group.label)
                    .accessibilityHint("Filters the feed by region")
                    .accessibilityAddTraits(active ? .isSelected : [])
                }
            }
        }
        .contentMargins(.horizontal, 0, for: .scrollContent)
        .scrollIndicators(.hidden)
    }

    private func feedCard(_ article: NewsArticle, hero: Bool) -> some View {
        let height: CGFloat = (hero ? 230 : 150) * cardScale
        return Theme.backgroundTertiary
            .frame(height: height)
            .overlay {
                if let urlStr = article.imageUrl, let url = URL(string: urlStr) {
                    AsyncImage(url: url) { img in
                        img.resizable().aspectRatio(contentMode: .fill)
                    } placeholder: {
                        LinearGradient(colors: [Color(hex: article.category.hex).opacity(0.7), Color(hex: article.category.hex)], startPoint: .topLeading, endPoint: .bottomTrailing)
                    }
                    .allowsHitTesting(false)
                } else {
                    LinearGradient(colors: [Color(hex: article.category.hex).opacity(0.85), Color(hex: article.category.hex)], startPoint: .topLeading, endPoint: .bottomTrailing)
                }
            }
            .overlay {
                LinearGradient(colors: [.black.opacity(0.15), .clear, .black.opacity(0.55), .black.opacity(0.85)],
                               startPoint: .top, endPoint: .bottom)
                .allowsHitTesting(false)
            }
            .overlay(alignment: .top) {
                HStack {
                    Text(article.category.label.uppercased())
                        .scaledFont(10, weight: .bold).foregroundStyle(.white)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(Color(hex: article.category.hex)).clipShape(.capsule)
                    Text(article.levelLabel)
                        .scaledFont(10, weight: .bold).foregroundStyle(.white)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(Color.white.opacity(0.22)).clipShape(.capsule)
                    Spacer()
                    // Only when the source actually says where the story is from.
                    if let region = article.region {
                        HStack(spacing: 4) {
                            Text(region.emoji).scaledFont(11)
                            Text(region.label).scaledFont(10, weight: .semibold).foregroundStyle(.white)
                        }
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(Color.black.opacity(0.3)).clipShape(.capsule)
                    }
                }
                .padding(12)
            }
            .overlay(alignment: .bottomLeading) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(article.title)
                        .scaledFont(hero ? 19 : 15, weight: .bold).foregroundStyle(.white)
                        .lineLimit(hero ? 3 : 2).multilineTextAlignment(.leading)
                    if hero && !article.summary.isEmpty {
                        Text(article.summary).font(.footnote).foregroundStyle(.white.opacity(0.85)).lineLimit(2)
                    }
                    HStack(spacing: 6) {
                        Text(article.source).font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.9))
                        Circle().fill(.white.opacity(0.5)).frame(width: 3, height: 3)
                        Text(article.timeAgo).font(.caption).foregroundStyle(.white.opacity(0.75))
                    }
                }
                .padding(14)
            }
            .clipShape(.rect(cornerRadius: 16))
            .accessibilityElement(children: .combine)
            .accessibilityLabel("\(article.title), \(article.source), level \(article.levelLabel)")
    }

    private var emptyCard: some View {
        VStack(spacing: 12) {
            Image(systemName: "newspaper").scaledFont(30).foregroundStyle(Theme.textMuted)
                .accessibilityHidden(true)
            Text("No stories here yet").font(.headline).foregroundStyle(Theme.text)
                .multilineTextAlignment(.center)
            Text("Try another category or region, or refresh.")
                .font(.footnote).foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            Button { Haptics.tap(); Task { await model.load(level: level) } } label: {
                Label("Refresh", systemImage: "arrow.clockwise").font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white).padding(.horizontal, 16).frame(minHeight: Theme.minimumHitTarget)
                    .background(Theme.primary).clipShape(.capsule)
            }.buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 50).padding(.horizontal, 24)
        .background(Theme.card).clipShape(.rect(cornerRadius: 16)).padding(.top, 20)
    }

    // MARK: - Search results

    private var searchContent: some View {
        ScrollView {
            VStack(spacing: 14) {
                switch search {
                case .idle:
                    searchMessage(icon: "magnifyingglass", title: "Search for any topic",
                                  message: "Recipes, sports, tech, travel — results in French")
                case .loading:
                    feedSkeleton
                case .noResults(let query):
                    searchMessage(icon: "text.magnifyingglass", title: "Nothing for “\(query)”",
                                  message: "Try a broader topic or a French keyword.")
                case .failed(let failure):
                    VStack(spacing: 10) {
                        searchMessage(icon: failure == .offline ? "wifi.slash" : "exclamationmark.triangle",
                                      title: failure.searchTitle, message: failure.searchMessage)
                        if failure.isRetryable {
                            Button { Haptics.tap(); Task { await runSearch() } } label: {
                                Label("Try again", systemImage: "arrow.clockwise").font(.subheadline.weight(.semibold))
                                    .foregroundStyle(.white).padding(.horizontal, 16).frame(minHeight: Theme.minimumHitTarget)
                                    .background(Theme.primary).clipShape(.capsule)
                            }.buttonStyle(.plain)
                        }
                    }
                case .results(let articles):
                    ForEach(Array(articles.enumerated()), id: \.element.id) { idx, article in
                        NavigationLink(value: article) { feedCard(article, hero: idx == 0) }
                            .buttonStyle(.plain).pressable()
                    }
                }
            }
            .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 40)
        }
        .scrollIndicators(.hidden)
    }

    private func searchMessage(icon: String, title: String, message: String) -> some View {
        VStack(spacing: 10) {
            Image(systemName: icon).scaledFont(32).foregroundStyle(Theme.textMuted)
                .accessibilityHidden(true)
            Text(title).font(.headline).foregroundStyle(Theme.text).multilineTextAlignment(.center)
            Text(message).font(.footnote).foregroundStyle(Theme.textSecondary).multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 60).padding(.horizontal, 24)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Library

private struct LibraryView: View {
    @Environment(AppStore.self) private var store
    let readiness: ModalityReadiness
    @State private var regionGroup: ReadRegionGroup = .all
    @State private var difficulty: ReadDifficulty? = nil
    @State private var category: ReadCategory? = nil

    private var level: CEFRLevel { store.learnerLevel }

    /// The shelf the gate allows, in level order — before the learner's own
    /// filters, so it is also what the filter menus may offer.
    private var shelf: [ReadingPiece] { ReadingShelf.pieces(for: level, readiness: readiness) }

    /// The shelf after the learner's own filters.
    private var pieces: [ReadingPiece] {
        shelf.filter {
            (activeRegionGroup == .all || $0.region.group == activeRegionGroup) &&
            (activeDifficulty == nil || $0.difficulty == activeDifficulty) &&
            (activeCategory == nil || $0.category == activeCategory)
        }
    }

    /// Filter options built from what the shelf actually holds, so no menu entry
    /// or pill can only ever produce "No pieces match your filters".
    private var levels: [ReadDifficulty] { ReadingShelf.availableDifficulties(in: shelf) }
    private var categories: [ReadCategory] { ReadingShelf.availableCategories(in: shelf) }
    private var regionGroups: [ReadRegionGroup] { ReadingShelf.availableRegionGroups(in: shelf) }

    /// A filter the shelf no longer offers (the gate opened, the level moved) is
    /// treated as "all" rather than silently emptying the library.
    private var activeDifficulty: ReadDifficulty? {
        guard let difficulty, levels.contains(difficulty) else { return nil }
        return difficulty
    }

    private var activeCategory: ReadCategory? {
        guard let category, categories.contains(category) else { return nil }
        return category
    }

    private var activeRegionGroup: ReadRegionGroup {
        regionGroups.contains(regionGroup) ? regionGroup : .all
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                if readiness == .unlocked { orderNote }
                regionPills
                filterChips
                ForEach(pieces) { piece in
                    NavigationLink(value: piece) { libraryCard(piece) }
                        .buttonStyle(.plain).pressable()
                }
                if pieces.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "line.3.horizontal.decrease.circle").scaledFont(30).foregroundStyle(Theme.textMuted)
                            .accessibilityHidden(true)
                        Text(readiness == .foundation ? "No short pieces match these filters yet" : "No pieces match your filters")
                            .font(.subheadline).foregroundStyle(Theme.textSecondary)
                            .multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                    }.frame(maxWidth: .infinity).padding(.vertical, 50)
                }
            }
            .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 40)
        }
        .scrollIndicators(.hidden)
    }

    private var orderNote: some View {
        HStack(spacing: 6) {
            Image(systemName: "arrow.up.arrow.down").scaledFont(11).foregroundStyle(Theme.primary)
                .accessibilityHidden(true)
            Text("Closest to your level (\(level.rawValue)) first")
                .font(.footnote).foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer()
        }
        .padding(.top, 8)
        .accessibilityElement(children: .combine)
    }

    /// Region pills, shown only when the shelf spans more than one region — with
    /// a single region, "All" and that region are the same list.
    @ViewBuilder
    private var regionPills: some View {
        if regionGroups.filter({ $0 != .all }).count > 1 {
            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    ForEach(regionGroups) { group in
                        let active = activeRegionGroup == group
                        Button { Haptics.tap(); regionGroup = group } label: {
                            HStack(spacing: 5) {
                                Text(group.emoji).scaledFont(12)
                                Text(group.label).font(.footnote.weight(.medium))
                            }
                            .foregroundStyle(active ? Theme.primaryDark : Theme.textSecondary)
                            .padding(.horizontal, 12).frame(minHeight: Theme.minimumHitTarget)
                            .background(active ? Theme.primaryLight : Theme.backgroundSecondary)
                            .clipShape(.capsule)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(group.label)
                        .accessibilityAddTraits(active ? .isSelected : [])
                    }
                }
            }
            .contentMargins(.horizontal, 0, for: .scrollContent)
            .scrollIndicators(.hidden)
        }
    }

    /// Level and Type menus, each offered only when the shelf holds more than one
    /// of that thing to choose between (a single-option menu is decoration).
    @ViewBuilder
    private var filterChips: some View {
        if levels.count > 1 || categories.count > 1 {
            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    if levels.count > 1 {
                        Menu {
                            Button("All levels") { difficulty = nil }
                            ForEach(levels) { d in Button(d.label) { difficulty = d } }
                        } label: { filterLabel(activeDifficulty?.label ?? "Level", active: activeDifficulty != nil) }
                            .accessibilityLabel("Filter by level")
                            .accessibilityValue(activeDifficulty?.label ?? "All levels")
                    }
                    if categories.count > 1 {
                        Menu {
                            Button("All types") { category = nil }
                            ForEach(categories) { c in Button(c.label) { category = c } }
                        } label: { filterLabel(activeCategory?.label ?? "Type", active: activeCategory != nil) }
                            .accessibilityLabel("Filter by type")
                            .accessibilityValue(activeCategory?.label ?? "All types")
                    }
                }
            }
            .contentMargins(.horizontal, 0, for: .scrollContent)
            .scrollIndicators(.hidden)
        }
    }

    private func filterLabel(_ text: String, active: Bool) -> some View {
        HStack(spacing: 5) {
            Text(text).font(.footnote.weight(.semibold))
            Image(systemName: "chevron.down").scaledFont(9, weight: .bold)
        }
        .foregroundStyle(active ? Theme.primary : Theme.textSecondary)
        .padding(.horizontal, 12).frame(minHeight: Theme.minimumHitTarget)
        .background(active ? Theme.primaryLight : Theme.card)
        .clipShape(.capsule)
        .overlay(Capsule().stroke(active ? .clear : Theme.border, lineWidth: 1))
    }

    private func fitLabel(_ piece: ReadingPiece) -> (String, Color) {
        switch ReadingShelf.fit(of: piece.level, for: level) {
        case .atLevel: return ("At your level", Theme.success)
        case .stretch: return ("Stretch", Theme.warning)
        case .easy: return ("Easy", Theme.textSecondary)
        }
    }

    private func libraryCard(_ piece: ReadingPiece) -> some View {
        let fit = fitLabel(piece)
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Pill(text: piece.level.rawValue, color: piece.tint, filled: true)
                Pill(text: piece.category.label, color: piece.tint)
                if readiness == .unlocked { Pill(text: fit.0, color: fit.1) }
                Spacer()
                Label("\(piece.minutes) min", systemImage: "clock").font(.caption).foregroundStyle(Theme.textSecondary)
            }
            Text(piece.title).font(.headline).foregroundStyle(Theme.text)
                .fixedSize(horizontal: false, vertical: true)
            Text(piece.subtitle).font(.subheadline).foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 5) {
                Text(piece.region.flag).scaledFont(12)
                Text(piece.region.label).font(.caption).foregroundStyle(Theme.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle(padding: 16)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(piece.title), \(piece.category.label), level \(piece.level.rawValue), \(readiness == .unlocked ? fit.0 + ", " : "")\(piece.minutes) minutes, \(piece.region.label)")
    }
}
