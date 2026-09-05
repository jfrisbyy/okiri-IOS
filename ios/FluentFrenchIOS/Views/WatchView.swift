//
//  WatchView.swift
//  FluentFrenchIOS
//
//  Live French YouTube browser, mirroring the Expo Watch screen: a dark
//  cinematic header with a content/subtitles toggle and a search bar, trending
//  videos grouped into themed horizontal carousels, and a suggested-searches
//  grid. Tapping a video opens it; search opens a results list.
//

import SwiftUI

@MainActor
@Observable
final class WatchModel {
    var sections: [(category: YTCategory, videos: [YTVideo])] = []
    var isLoading = false

    func load() async {
        isLoading = true
        var result: [(YTCategory, [YTVideo])] = []
        for cat in YouTubeService.categories {
            let videos = await YouTubeService.trending(categoryId: cat.id)
            result.append((cat, videos))
        }
        sections = result
        isLoading = false
    }
}

struct WatchView: View {
    @Environment(AppStore.self) private var store
    @State private var model = WatchModel()
    @State private var nativeMode = false
    @State private var searching = false
    @State private var searchText = ""
    @State private var searchResults: [YTVideo] = []
    @State private var isSearchLoading = false
    @State private var playingVideo: YTVideo? = nil

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    header
                    if searching {
                        searchResultsView
                    } else {
                        feed
                    }
                }
            }
            .background(Color(hex: "120A07"))
            .ignoresSafeArea(edges: .top)
            .scrollIndicators(.hidden)
            .navigationBarHidden(true)
            .refreshable { await model.load() }
        }
        .fullScreenCover(item: $playingVideo) { video in
            WatchPlayerView(video: video, learnMode: nativeMode)
                .environment(store)
        }
        .task { if model.sections.isEmpty { await model.load() } }
    }

    // MARK: - Header

    private var header: some View {
        LinearGradient(colors: [Color(hex: "1A0F0A"), Color(hex: "2D1810"), Color(hex: "1A0F0A")], startPoint: .top, endPoint: .bottom)
            .frame(height: searching ? 220 : 210)
            .overlay(alignment: .bottom) {
                VStack(spacing: 14) {
                    HStack(alignment: .center, spacing: 12) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Watch & Learn").font(.serifDisplay(28, weight: .bold)).foregroundStyle(.white)
                            Text("Immerse yourself in French video").font(.system(size: 13)).foregroundStyle(.white.opacity(0.6))
                        }
                        Spacer()
                        Image(systemName: "play.tv.fill").font(.system(size: 24)).foregroundStyle(Theme.primary)
                            .frame(width: 50, height: 50).background(Theme.primary.opacity(0.15)).clipShape(.rect(cornerRadius: 16))
                    }

                    HStack(spacing: 10) {
                        chip("French Content", active: !nativeMode, icon: nil, emoji: "🇫🇷") { nativeMode = false }
                        chip("Learn with Subtitles", active: nativeMode, icon: "captions.bubble.fill", emoji: nil) { nativeMode = true }
                        Spacer()
                    }

                    Button {
                        Haptics.tap()
                        withAnimation { searching.toggle() }
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "magnifyingglass").font(.system(size: 16)).foregroundStyle(.white.opacity(0.4))
                            Text(searching ? "Close search" : "Search YouTube in French…")
                                .font(.system(size: 14)).foregroundStyle(.white.opacity(0.4))
                            Spacer()
                            Image(systemName: searching ? "xmark" : "chevron.right").font(.system(size: 13)).foregroundStyle(.white.opacity(0.3))
                        }
                        .padding(.horizontal, 16).padding(.vertical, 13)
                        .background(Color.white.opacity(0.1)).clipShape(.rect(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.white.opacity(0.08), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 20).padding(.bottom, 16)
            }
    }

    private func chip(_ title: String, active: Bool, icon: String?, emoji: String?, action: @escaping () -> Void) -> some View {
        Button {
            Haptics.tap(); action()
        } label: {
            HStack(spacing: 6) {
                if let emoji { Text(emoji).font(.system(size: 13)) }
                if let icon { Image(systemName: icon).font(.system(size: 12)).foregroundStyle(active ? .white : .white.opacity(0.5)) }
                Text(title).font(.system(size: 13, weight: .semibold)).foregroundStyle(active ? .white : .white.opacity(0.5))
            }
            .padding(.horizontal, 14).frame(height: 40)
            .background(active ? Theme.primary : .clear)
            .clipShape(.capsule)
            .overlay(Capsule().stroke(active ? .clear : Color.white.opacity(0.25), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Search

    private var searchBarInline: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass").foregroundStyle(.white.opacity(0.5))
            TextField("", text: $searchText, prompt: Text("Search in French…").foregroundColor(.white.opacity(0.4)))
                .foregroundStyle(.white).font(.system(size: 15)).autocorrectionDisabled()
                .onSubmit { Task { await runSearch() } }
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
        .background(Color.white.opacity(0.1)).clipShape(.rect(cornerRadius: 12))
        .padding(.horizontal, 20).padding(.top, 16)
    }

    private func runSearch() async {
        let q = searchText.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return }
        isSearchLoading = true
        searchResults = await YouTubeService.search(q)
        isSearchLoading = false
    }

    private var searchResultsView: some View {
        VStack(spacing: 16) {
            searchBarInline
            if isSearchLoading {
                ProgressView().tint(.white).padding(.vertical, 40)
            } else if searchResults.isEmpty {
                VStack(spacing: 16) {
                    suggestedGrid
                }
                .padding(.top, 8)
            } else {
                VStack(spacing: 14) {
                    ForEach(searchResults) { video in listRow(video) }
                }
                .padding(.horizontal, 20)
            }
        }
        .padding(.bottom, 40)
    }

    private func listRow(_ video: YTVideo) -> some View {
        Button { open(video) } label: {
            HStack(spacing: 12) {
                thumbnail(video, width: 130, height: 74)
                VStack(alignment: .leading, spacing: 4) {
                    Text(video.title).font(.system(size: 14, weight: .semibold)).foregroundStyle(.white).lineLimit(2).multilineTextAlignment(.leading)
                    Text(video.channel).font(.system(size: 12)).foregroundStyle(.white.opacity(0.5))
                    if !video.viewsLabel.isEmpty {
                        Text(video.viewsLabel).font(.system(size: 11)).foregroundStyle(.white.opacity(0.4))
                    }
                }
                Spacer()
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Feed

    private var feed: some View {
        VStack(alignment: .leading, spacing: 24) {
            if model.isLoading && model.sections.isEmpty {
                feedSkeleton
            } else {
                ForEach(model.sections, id: \.category.id) { section in
                    sectionView(section.category, section.videos)
                }
            }
            suggestedSection
        }
        .padding(.top, 20).padding(.bottom, 40)
    }

    private var feedSkeleton: some View {
        VStack(alignment: .leading, spacing: 24) {
            ForEach(0..<2, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 10) {
                        SkeletonBlock(width: 36, height: 36, cornerRadius: 10, dark: true)
                        VStack(alignment: .leading, spacing: 6) {
                            SkeletonBlock(width: 150, height: 14, dark: true)
                            SkeletonBlock(width: 90, height: 10, dark: true)
                        }
                        Spacer()
                    }
                    .padding(.horizontal, 20)
                    ScrollView(.horizontal) {
                        HStack(spacing: 12) {
                            ForEach(0..<3, id: \.self) { _ in
                                VStack(alignment: .leading, spacing: 8) {
                                    SkeletonBlock(width: 250, height: 140, cornerRadius: 12, dark: true)
                                    SkeletonBlock(width: 200, height: 12, dark: true)
                                    SkeletonBlock(width: 120, height: 10, dark: true)
                                }
                            }
                        }
                    }
                    .contentMargins(.horizontal, 20, for: .scrollContent)
                    .scrollIndicators(.hidden)
                    .disabled(true)
                }
            }
        }
    }

    private func sectionView(_ category: YTCategory, _ videos: [YTVideo]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Text(category.emoji).font(.system(size: 18))
                    .frame(width: 36, height: 36).background(Color.white.opacity(0.08)).clipShape(.rect(cornerRadius: 10))
                VStack(alignment: .leading, spacing: 1) {
                    Text("Trending \(category.name)").font(.serifDisplay(20, weight: .semibold)).foregroundStyle(.white)
                    Text("Popular in France").font(.system(size: 12)).foregroundStyle(.white.opacity(0.5))
                }
                Spacer()
                if !videos.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "flame.fill").font(.system(size: 10)).foregroundStyle(Theme.primary)
                        Text("\(videos.count)").font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.primary)
                    }
                    .padding(.horizontal, 8).padding(.vertical, 4).background(Theme.primary.opacity(0.15)).clipShape(.capsule)
                }
            }
            .padding(.horizontal, 20)

            if videos.isEmpty {
                Text("No trending videos available").font(.system(size: 13)).foregroundStyle(.white.opacity(0.4))
                    .padding(.horizontal, 20).padding(.vertical, 20)
            } else {
                ScrollView(.horizontal) {
                    HStack(spacing: 12) {
                        ForEach(videos) { video in carouselCard(video) }
                    }
                }
                .contentMargins(.horizontal, 20, for: .scrollContent)
                .scrollIndicators(.hidden)
            }
        }
    }

    private func carouselCard(_ video: YTVideo) -> some View {
        Button { open(video) } label: {
            VStack(alignment: .leading, spacing: 8) {
                thumbnail(video, width: 250, height: 140)
                Text(video.title).font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                    .lineLimit(2).multilineTextAlignment(.leading).frame(width: 250, alignment: .leading)
                HStack(spacing: 6) {
                    Text(video.channel).font(.system(size: 12)).foregroundStyle(.white.opacity(0.55)).lineLimit(1)
                    if !video.viewsLabel.isEmpty {
                        Circle().fill(.white.opacity(0.4)).frame(width: 3, height: 3)
                        Text(video.viewsLabel).font(.system(size: 11)).foregroundStyle(.white.opacity(0.45))
                    }
                }
                .frame(width: 250, alignment: .leading)
            }
        }
        .buttonStyle(.plain)
    }

    private func thumbnail(_ video: YTVideo, width: CGFloat, height: CGFloat) -> some View {
        Color.white.opacity(0.08)
            .frame(width: width, height: height)
            .overlay {
                AsyncImage(url: URL(string: video.thumbnailUrl)) { img in
                    img.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    Image(systemName: "play.rectangle.fill").font(.system(size: 28)).foregroundStyle(.white.opacity(0.3))
                }
                .allowsHitTesting(false)
            }
            .overlay(alignment: .center) {
                Image(systemName: "play.fill").font(.system(size: 16)).foregroundStyle(.white)
                    .frame(width: 36, height: 36).background(Color.black.opacity(0.5)).clipShape(.circle)
            }
            .overlay(alignment: .bottomTrailing) {
                if !video.durationLabel.isEmpty {
                    Text(video.durationLabel).font(.system(size: 11, weight: .semibold)).foregroundStyle(.white)
                        .padding(.horizontal, 6).padding(.vertical, 2).background(Color.black.opacity(0.7)).clipShape(.rect(cornerRadius: 4))
                        .padding(6)
                }
            }
            .clipShape(.rect(cornerRadius: 12))
    }

    private var suggestedSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "chart.line.uptrend.xyaxis").font(.system(size: 15)).foregroundStyle(Theme.primary)
                Text("Suggested Searches").font(.serifDisplay(20, weight: .semibold)).foregroundStyle(.white)
            }
            .padding(.horizontal, 20)
            suggestedGrid
        }
    }

    private var suggestedGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
            ForEach(YouTubeService.suggestedSearches, id: \.query) { s in
                Button {
                    Haptics.tap()
                    searchText = s.query
                    if !searching { withAnimation { searching = true } }
                    Task { await runSearch() }
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass").font(.system(size: 12)).foregroundStyle(Theme.primary)
                        Text(s.label).font(.system(size: 13, weight: .medium)).foregroundStyle(.white)
                        Spacer()
                    }
                    .padding(.horizontal, 14).padding(.vertical, 12)
                    .background(Color.white.opacity(0.06)).clipShape(.rect(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.white.opacity(0.08), lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 20)
    }

    private func open(_ video: YTVideo) {
        Haptics.tap()
        playingVideo = video
    }
}
