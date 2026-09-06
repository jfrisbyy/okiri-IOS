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

    func load(level: CEFRLevel, reset: Bool = true) async {
        if reset { displayLimit = 8 }
        sortLevel = level
        isLoading = true
        result = await NewsService.fetch(category: category)
        isLoading = false
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
    @State private var model = ReadModel()
    @State private var activeView: ReadTab = .feed
    @State private var searching = false
    @State private var searchText = ""
    @State private var search: ReadSearchState = .idle

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
                    if searching { searchBar }
                    segmented
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

    private var header: some View {
        ZStack(alignment: .bottomLeading) {
            Theme.primaryGradient
            Circle().fill(Color.white.opacity(0.1)).frame(width: 150, height: 150).offset(x: -40, y: 50)
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Read").font(.serifDisplay(34, weight: .bold)).foregroundStyle(.white)
                        Text(headerSubtitle)
                            .font(.subheadline).foregroundStyle(.white.opacity(0.85))
                    }
                    Spacer()
                    if readiness == .unlocked {
                        Button {
                            Haptics.tap()
                            withAnimation { searching.toggle() }
                            if !searching { search = .idle }
                        } label: {
                            Image(systemName: searching ? "xmark" : "magnifyingglass")
                                .font(.system(size: 17, weight: .semibold)).foregroundStyle(.white)
                                .frame(width: 44, height: 44).background(Color.white.opacity(0.2)).clipShape(.circle)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(searching ? "Close search" : "Search stories")
                    }
                }
            }
            .padding(.horizontal, 20).padding(.bottom, 18)
        }
        .frame(height: 150)
        .clipped()
    }

    // MARK: - Gate states

    private var lockedContent: some View {
        ScrollView {
            VStack(spacing: 12) {
                Image(systemName: "lock.fill").font(.system(size: 30)).foregroundStyle(Theme.textMuted)
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
            Image(systemName: "magnifyingglass").foregroundStyle(Theme.textMuted)
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
            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) { activeView = tab }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.system(size: 13))
                Text(title).font(.subheadline.weight(.semibold))
            }
            .foregroundStyle(active ? .white : Theme.textSecondary)
            .frame(maxWidth: .infinity).frame(minHeight: 44)
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
            SkeletonBlock(height: 230, cornerRadius: 16)
            ForEach(0..<3, id: \.self) { _ in
                SkeletonBlock(height: 150, cornerRadius: 16)
            }
        }
        .padding(.top, 4)
        .accessibilityLabel("Loading stories")
    }

    /// Says exactly where the stories came from and how they are ordered.
    @ViewBuilder
    private var feedBanner: some View {
        if let failure = model.failure {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: failure == .offline ? "wifi.slash" : "info.circle.fill")
                    .font(.footnote.weight(.bold)).foregroundStyle(Theme.warning)
                Text(failure.message).font(.footnote).foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                if failure.isRetryable {
                    Button { Haptics.tap(); Task { await model.load(level: level) } } label: {
                        Text("Retry").font(.footnote.weight(.semibold)).foregroundStyle(Theme.primary)
                            .frame(minWidth: 44, minHeight: 44)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 6)
            .background(Theme.warningLight)
            .clipShape(.rect(cornerRadius: 10))
            .accessibilityElement(children: .combine)
        } else {
            HStack(spacing: 6) {
                Image(systemName: "bolt.fill").font(.system(size: 12)).foregroundStyle(Theme.primary)
                Text("Live headlines · closest to your level (\(level.rawValue)) first · levels are estimates")
                    .font(.footnote).foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer()
                Text("\(model.displayed.count) of \(model.filtered.count)").font(.caption).foregroundStyle(Theme.textMuted)
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

    private var regionStrip: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(ReadRegionGroup.allCases) { group in
                    let active = model.regionGroup == group
                    Button {
                        Haptics.tap()
                        model.regionGroup = group
                    } label: {
                        HStack(spacing: 5) {
                            Text(group.emoji).font(.system(size: 12))
                            Text(group.label).font(.footnote.weight(.medium))
                        }
                        .foregroundStyle(active ? Theme.primaryDark : Theme.textSecondary)
                        .padding(.horizontal, 12).frame(minHeight: 44)
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

    private func feedCard(_ article: NewsArticle, hero: Bool) -> some View {
        let height: CGFloat = hero ? 230 : 150
        return Color(Theme.backgroundTertiary)
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
                        .font(.system(size: 10, weight: .bold)).foregroundStyle(.white)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(Color(hex: article.category.hex)).clipShape(.capsule)
                    Text(article.levelLabel)
                        .font(.system(size: 10, weight: .bold)).foregroundStyle(.white)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(Color.white.opacity(0.22)).clipShape(.capsule)
                    Spacer()
                    HStack(spacing: 4) {
                        Text(article.region.emoji).font(.system(size: 11))
                        Text(article.region.label).font(.system(size: 10, weight: .semibold)).foregroundStyle(.white)
                    }
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Color.black.opacity(0.3)).clipShape(.capsule)
                }
                .padding(12)
            }
            .overlay(alignment: .bottomLeading) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(article.title)
                        .font(.system(size: hero ? 19 : 15, weight: .bold)).foregroundStyle(.white)
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
            Image(systemName: "newspaper").font(.system(size: 30)).foregroundStyle(Theme.textMuted)
            Text("No stories here yet").font(.headline).foregroundStyle(Theme.text)
            Text("Try another category or region, or refresh.")
                .font(.footnote).foregroundStyle(Theme.textMuted)
            Button { Haptics.tap(); Task { await model.load(level: level) } } label: {
                Label("Refresh", systemImage: "arrow.clockwise").font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white).padding(.horizontal, 16).frame(minHeight: 44)
                    .background(Theme.primary).clipShape(.capsule)
            }.buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 50)
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
                                    .foregroundStyle(.white).padding(.horizontal, 16).frame(minHeight: 44)
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
            Image(systemName: icon).font(.system(size: 32)).foregroundStyle(Theme.textMuted)
            Text(title).font(.headline).foregroundStyle(Theme.text).multilineTextAlignment(.center)
            Text(message).font(.footnote).foregroundStyle(Theme.textMuted).multilineTextAlignment(.center)
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

    /// The shelf the gate allows, in level order, then the learner's own filters.
    private var pieces: [ReadingPiece] {
        ReadingShelf.pieces(for: level, readiness: readiness).filter {
            (regionGroup == .all || $0.region.group == regionGroup) &&
            (difficulty == nil || $0.difficulty == difficulty) &&
            (category == nil || $0.category == category)
        }
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
                        Image(systemName: "line.3.horizontal.decrease.circle").font(.system(size: 30)).foregroundStyle(Theme.textMuted)
                        Text(readiness == .foundation ? "No short pieces match these filters yet" : "No pieces match your filters")
                            .font(.subheadline).foregroundStyle(Theme.textMuted)
                    }.frame(maxWidth: .infinity).padding(.vertical, 50)
                }
            }
            .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 40)
        }
        .scrollIndicators(.hidden)
    }

    private var orderNote: some View {
        HStack(spacing: 6) {
            Image(systemName: "arrow.up.arrow.down").font(.system(size: 11)).foregroundStyle(Theme.primary)
            Text("Closest to your level (\(level.rawValue)) first")
                .font(.footnote).foregroundStyle(Theme.textSecondary)
            Spacer()
        }
        .padding(.top, 8)
        .accessibilityElement(children: .combine)
    }

    private var regionPills: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(ReadRegionGroup.allCases) { group in
                    let active = regionGroup == group
                    Button { Haptics.tap(); regionGroup = group } label: {
                        HStack(spacing: 5) {
                            Text(group.emoji).font(.system(size: 12))
                            Text(group.label).font(.footnote.weight(.medium))
                        }
                        .foregroundStyle(active ? Theme.primaryDark : Theme.textSecondary)
                        .padding(.horizontal, 12).frame(minHeight: 44)
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

    private var filterChips: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                Menu {
                    Button("All levels") { difficulty = nil }
                    ForEach(ReadDifficulty.allCases) { d in Button(d.label) { difficulty = d } }
                } label: { filterLabel(difficulty?.label ?? "Level", active: difficulty != nil) }
                Menu {
                    Button("All types") { category = nil }
                    ForEach(ReadCategory.allCases) { c in Button(c.label) { category = c } }
                } label: { filterLabel(category?.label ?? "Type", active: category != nil) }
            }
        }
        .contentMargins(.horizontal, 0, for: .scrollContent)
        .scrollIndicators(.hidden)
    }

    private func filterLabel(_ text: String, active: Bool) -> some View {
        HStack(spacing: 5) {
            Text(text).font(.footnote.weight(.semibold))
            Image(systemName: "chevron.down").font(.system(size: 9, weight: .bold))
        }
        .foregroundStyle(active ? Theme.primary : Theme.textSecondary)
        .padding(.horizontal, 12).frame(minHeight: 44)
        .background(active ? Theme.primaryLight : Theme.card)
        .clipShape(.capsule)
        .overlay(Capsule().stroke(active ? .clear : Theme.border, lineWidth: 1))
    }

    private func fitLabel(_ piece: ReadingPiece) -> (String, Color) {
        switch ReadingShelf.fit(of: piece.level, for: level) {
        case .atLevel: return ("At your level", Theme.success)
        case .stretch: return ("Stretch", Theme.warning)
        case .easy: return ("Easy", Theme.textMuted)
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
                Label("\(piece.minutes) min", systemImage: "clock").font(.caption).foregroundStyle(Theme.textMuted)
            }
            Text(piece.title).font(.headline).foregroundStyle(Theme.text)
            Text(piece.subtitle).font(.subheadline).foregroundStyle(Theme.textMuted)
            HStack(spacing: 5) {
                Text(piece.region.flag).font(.system(size: 12))
                Text(piece.region.label).font(.caption).foregroundStyle(Theme.textMuted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle(padding: 16)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(piece.title), level \(piece.level.rawValue), \(piece.minutes) minutes")
    }
}
