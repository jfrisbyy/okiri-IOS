//
//  ReadView.swift
//  FluentFrenchIOS
//
//  Live French news feed + curated library, mirroring the Expo Read screen:
//  warm header, Feed/Library toggle, category + region strips, image-backed
//  cards, search, and a word-tappable reader.
//

import SwiftUI

@MainActor
@Observable
final class ReadModel {
    var articles: [NewsArticle] = []
    var isLoading = false
    var category: NewsCategory = .all
    var regionGroup: ReadRegionGroup = .all
    var displayLimit = 8

    var filtered: [NewsArticle] {
        regionGroup == .all ? articles : articles.filter { $0.region == regionGroup }
    }
    var displayed: [NewsArticle] { Array(filtered.prefix(displayLimit)) }

    func load(reset: Bool = true) async {
        if reset { displayLimit = 8 }
        isLoading = true
        articles = await NewsService.fetch(category: category)
        isLoading = false
    }
}

struct ReadView: View {
    @State private var model = ReadModel()
    @State private var activeView: ReadTab = .feed
    @State private var searching = false
    @State private var searchText = ""
    @State private var searchResults: [NewsArticle] = []
    @State private var isSearchLoading = false

    enum ReadTab { case feed, library }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                header
                if searching {
                    searchBar
                }
                segmented
                content
            }
            .background(Theme.background)
            .ignoresSafeArea(edges: .top)
            .navigationBarHidden(true)
            .navigationDestination(for: NewsArticle.self) { ArticleReaderView(article: $0) }
            .navigationDestination(for: ReadingPiece.self) { ReaderView(piece: $0) }
        }
        .task { if model.articles.isEmpty { await model.load() } }
    }

    // MARK: - Header

    private var header: some View {
        ZStack(alignment: .bottomLeading) {
            Theme.primaryGradient
            Circle().fill(Color.white.opacity(0.1)).frame(width: 150, height: 150).offset(x: -40, y: 50)
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Read").font(.serifDisplay(34, weight: .bold)).foregroundStyle(.white)
                        Text(NewsService.hasKey ? "Fresh French stories, tap any word" : "Tap any word you don't know")
                            .font(.system(size: 15)).foregroundStyle(.white.opacity(0.85))
                    }
                    Spacer()
                    Button {
                        Haptics.tap()
                        withAnimation { searching.toggle() }
                    } label: {
                        Image(systemName: searching ? "xmark" : "magnifyingglass")
                            .font(.system(size: 17, weight: .semibold)).foregroundStyle(.white)
                            .frame(width: 40, height: 40).background(Color.white.opacity(0.2)).clipShape(.circle)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 20).padding(.bottom, 18)
        }
        .frame(height: 150)
        .clipped()
    }

    private var searchBar: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass").foregroundStyle(Theme.textMuted)
            TextField("Search any topic…", text: $searchText)
                .font(.system(size: 15)).autocorrectionDisabled()
                .onSubmit { Task { await runSearch() } }
            if !searchText.isEmpty {
                Button { searchText = ""; searchResults = [] } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(Theme.textMuted)
                }.buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 11)
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
        .padding(.horizontal, 16).padding(.top, 12)
    }

    private func runSearch() async {
        let q = searchText.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return }
        isSearchLoading = true
        searchResults = await NewsService.search(q)
        isSearchLoading = false
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
                Text(title).font(.system(size: 14, weight: .semibold))
            }
            .foregroundStyle(active ? .white : Theme.textSecondary)
            .frame(maxWidth: .infinity).padding(.vertical, 10)
            .background(active ? Theme.primary : .clear)
            .clipShape(.rect(cornerRadius: 9))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var content: some View {
        if searching {
            searchContent
        } else if activeView == .feed {
            feedContent
        } else {
            LibraryView()
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
                } else if model.filtered.isEmpty {
                    emptyCard
                } else {
                    levelBanner
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
                                .font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                                .frame(maxWidth: .infinity).padding(.vertical, 14)
                                .background(Theme.primary).clipShape(.rect(cornerRadius: 12))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 40)
        }
        .scrollIndicators(.hidden)
        .refreshable { await model.load() }
    }

    private var feedSkeleton: some View {
        VStack(spacing: 14) {
            SkeletonBlock(height: 230, cornerRadius: 16)
            ForEach(0..<3, id: \.self) { _ in
                SkeletonBlock(height: 150, cornerRadius: 16)
            }
        }
        .padding(.top, 4)
    }

    private var levelBanner: some View {
        HStack(spacing: 6) {
            Image(systemName: "bolt.fill").font(.system(size: 12)).foregroundStyle(Theme.primary)
            Text(NewsService.hasKey ? "Live headlines · adapts to your level" : "Curated headlines · adapts to your level")
                .font(.system(size: 12)).foregroundStyle(Theme.textSecondary)
            Spacer()
            Text("\(model.displayed.count) of \(model.filtered.count)").font(.system(size: 11)).foregroundStyle(Theme.textMuted)
        }
        .padding(.vertical, 2)
    }

    private var categoryStrip: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(NewsCategory.allCases) { cat in
                    let active = model.category == cat
                    Button {
                        Haptics.tap()
                        model.category = cat
                        Task { await model.load() }
                    } label: {
                        Text(cat.label)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(active ? .white : Theme.textSecondary)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(active ? Color(hex: cat.hex) : Theme.card)
                            .clipShape(.capsule)
                            .overlay(Capsule().stroke(active ? .clear : Theme.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
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
                            Text(group.label).font(.system(size: 12, weight: .medium))
                        }
                        .foregroundStyle(active ? Theme.primaryDark : Theme.textSecondary)
                        .padding(.horizontal, 12).padding(.vertical, 7)
                        .background(active ? Theme.primaryLight : Theme.backgroundSecondary)
                        .clipShape(.capsule)
                    }
                    .buttonStyle(.plain)
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
                        Text(article.summary).font(.system(size: 13)).foregroundStyle(.white.opacity(0.85)).lineLimit(2)
                    }
                    HStack(spacing: 6) {
                        Text(article.source).font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.9))
                        Circle().fill(.white.opacity(0.5)).frame(width: 3, height: 3)
                        Text(article.timeAgo).font(.system(size: 12)).foregroundStyle(.white.opacity(0.75))
                    }
                }
                .padding(14)
            }
            .clipShape(.rect(cornerRadius: 16))
    }

    private func loadingCard(title: String, sub: String) -> some View {
        VStack(spacing: 12) {
            ProgressView().tint(Theme.primary)
            Text(title).font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.text)
            Text(sub).font(.system(size: 13)).foregroundStyle(Theme.textMuted)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 50)
        .background(Theme.card).clipShape(.rect(cornerRadius: 16)).padding(.top, 20)
    }

    private var emptyCard: some View {
        VStack(spacing: 12) {
            Image(systemName: "newspaper").font(.system(size: 30)).foregroundStyle(Theme.textMuted)
            Text("No stories here yet").font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.text)
            Button { Task { await model.load() } } label: {
                Label("Refresh", systemImage: "arrow.clockwise").font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white).padding(.horizontal, 16).padding(.vertical, 10)
                    .background(Theme.primary).clipShape(.capsule)
            }.buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 50)
        .background(Theme.card).clipShape(.rect(cornerRadius: 16)).padding(.top, 20)
    }

    // MARK: - Search

    private var searchContent: some View {
        ScrollView {
            VStack(spacing: 14) {
                if isSearchLoading {
                    feedSkeleton
                } else if searchResults.isEmpty {
                    VStack(spacing: 10) {
                        Image(systemName: "magnifyingglass").font(.system(size: 32)).foregroundStyle(Theme.textMuted)
                        Text("Search for any topic").font(.system(size: 17, weight: .semibold)).foregroundStyle(Theme.text)
                        Text("Recipes, sports, tech, travel — results in French").font(.system(size: 13)).foregroundStyle(Theme.textMuted).multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity).padding(.vertical, 60)
                } else {
                    ForEach(Array(searchResults.enumerated()), id: \.element.id) { idx, article in
                        NavigationLink(value: article) { feedCard(article, hero: idx == 0) }
                            .buttonStyle(.plain).pressable()
                    }
                }
            }
            .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 40)
        }
        .scrollIndicators(.hidden)
    }
}

// MARK: - Library

private struct LibraryView: View {
    @Environment(AppStore.self) private var store
    @State private var regionGroup: ReadRegionGroup = .all
    @State private var difficulty: ReadDifficulty? = nil
    @State private var category: ReadCategory? = nil

    private var pieces: [ReadingPiece] {
        ReadingLibrary.pieces.filter {
            (regionGroup == .all || $0.region.group == regionGroup) &&
            (difficulty == nil || $0.difficulty == difficulty) &&
            (category == nil || $0.category == category)
        }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                regionPills
                filterChips
                ForEach(pieces) { piece in
                    NavigationLink(value: piece) { libraryCard(piece) }
                        .buttonStyle(.plain).pressable()
                }
                if pieces.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "line.3.horizontal.decrease.circle").font(.system(size: 30)).foregroundStyle(Theme.textMuted)
                        Text("No pieces match your filters").font(.system(size: 14)).foregroundStyle(Theme.textMuted)
                    }.frame(maxWidth: .infinity).padding(.vertical, 50)
                }
            }
            .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 40)
        }
        .scrollIndicators(.hidden)
    }

    private var regionPills: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(ReadRegionGroup.allCases) { group in
                    let active = regionGroup == group
                    Button { Haptics.tap(); regionGroup = group } label: {
                        HStack(spacing: 5) {
                            Text(group.emoji).font(.system(size: 12))
                            Text(group.label).font(.system(size: 12, weight: .medium))
                        }
                        .foregroundStyle(active ? Theme.primaryDark : Theme.textSecondary)
                        .padding(.horizontal, 12).padding(.vertical, 7)
                        .background(active ? Theme.primaryLight : Theme.backgroundSecondary)
                        .clipShape(.capsule)
                    }.buttonStyle(.plain)
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
            Text(text).font(.system(size: 13, weight: .semibold))
            Image(systemName: "chevron.down").font(.system(size: 9, weight: .bold))
        }
        .foregroundStyle(active ? Theme.primary : Theme.textSecondary)
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(active ? Theme.primaryLight : Theme.card)
        .clipShape(.capsule)
        .overlay(Capsule().stroke(active ? .clear : Theme.border, lineWidth: 1))
    }

    private func libraryCard(_ piece: ReadingPiece) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Pill(text: piece.category.label, color: piece.tint)
                Pill(text: piece.difficulty.label, color: piece.difficulty.color)
                Spacer()
                Label("\(piece.minutes) min", systemImage: "clock").font(.system(size: 12)).foregroundStyle(Theme.textMuted)
            }
            Text(piece.title).font(.system(size: 18, weight: .bold)).foregroundStyle(Theme.text)
            Text(piece.subtitle).font(.system(size: 14)).foregroundStyle(Theme.textMuted)
            HStack(spacing: 5) {
                Text(piece.region.flag).font(.system(size: 12))
                Text(piece.region.label).font(.system(size: 12)).foregroundStyle(Theme.textMuted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle(padding: 16)
    }
}
