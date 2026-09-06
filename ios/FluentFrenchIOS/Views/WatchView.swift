//
//  WatchView.swift
//  FluentFrenchIOS
//
//  French YouTube browser: a dark cinematic header with a search bar, trending
//  videos grouped into themed carousels, and a suggested-searches grid. Every
//  state is explicit (E26): live results, the curated shelf with the reason
//  live results are missing (no key, offline, service error), an honest empty
//  category, and a search that says when it cannot run. Loads are bounded by
//  `Tuning.videoFeedTimeout`.
//

import Foundation
import SwiftUI

@MainActor
@Observable
final class WatchModel {
    struct Section: Identifiable {
        let category: YTCategory
        let result: VideoFeedResult
        var id: String { category.id }
        var videos: [YTVideo] { result.videos }
        var isCurated: Bool { result.failure != nil }
    }

    private(set) var sections: [Section] = []
    private(set) var isLoading = false
    /// Why live results are missing (nil when every section is live).
    private(set) var feedFailure: MediaServiceFailure? = nil

    /// Loads every category at once, so the wait is bounded by ONE
    /// `Tuning.videoFeedTimeout` rather than one per category (EM-7). Sections
    /// come back in `YouTubeService.categories` order.
    func load() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        let categories = YouTubeService.categories
        let feeds: [String: VideoFeedResult] = await withTaskGroup(of: (String, VideoFeedResult).self) { group in
            for category in categories {
                let id = category.id
                group.addTask {
                    let feed = await YouTubeService.trending(categoryId: id)
                    return (id, feed)
                }
            }
            var byId: [String: VideoFeedResult] = [:]
            for await (id, feed) in group { byId[id] = feed }
            return byId
        }
        var result: [Section] = []
        var failure: MediaServiceFailure? = nil
        for category in categories {
            let feed = feeds[category.id] ?? .curated(WatchCatalog.curated(for: category.id), reason: .serviceError)
            if let f = feed.failure, failure == nil || f == .noKey { failure = f }
            result.append(Section(category: category, result: feed))
        }
        sections = result
        feedFailure = failure
    }
}

struct WatchView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// The header carries the screen title and the search field, so it grows
    /// with the learner's text size instead of clipping them.
    @ScaledMetric(relativeTo: .largeTitle) private var headerHeight: CGFloat = 152
    @State private var model = WatchModel()
    @State private var reachability = NetworkReachability.shared
    @State private var searching = false
    @State private var searchText = ""
    @State private var search: SearchState = .idle
    @State private var playingVideo: YTVideo? = nil

    private enum SearchState: Equatable {
        case idle
        case loading
        case results([YTVideo])
        case unavailable(MediaServiceFailure)
    }

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
            WatchPlayerView(video: video)
                .environment(store)
        }
        .task {
            reachability.start()
            if model.sections.isEmpty { await model.load() }
        }
    }

    // MARK: - Header

    private var header: some View {
        LinearGradient(colors: [Color(hex: "1A0F0A"), Color(hex: "2D1810"), Color(hex: "1A0F0A")], startPoint: .top, endPoint: .bottom)
            .frame(height: searching ? headerHeight + 10 : headerHeight)
            .overlay(alignment: .bottom) {
                VStack(spacing: 14) {
                    HStack(alignment: .center, spacing: 12) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Watch & Learn").scaledSerifDisplay(28, weight: .bold).foregroundStyle(.white)
                            Text("Immerse yourself in French video").font(.footnote).foregroundStyle(.white.opacity(0.6))
                        }
                        Spacer()
                        Image(systemName: "play.tv.fill").font(.title2).foregroundStyle(Theme.primary)
                            .frame(width: 50, height: 50).background(Theme.primary.opacity(0.15)).clipShape(.rect(cornerRadius: 16))
                            .accessibilityHidden(true)
                    }

                    Button {
                        Haptics.tap()
                        withAnimation(Theme.motion(.default, reduceMotion: reduceMotion)) { searching.toggle() }
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "magnifyingglass").font(.callout).foregroundStyle(.white.opacity(0.55))
                                .accessibilityHidden(true)
                            Text(searching ? "Close search" : "Search YouTube in French…")
                                .font(.subheadline).foregroundStyle(.white.opacity(0.55))
                            Spacer()
                            Image(systemName: searching ? "xmark" : "chevron.right").font(.footnote).foregroundStyle(.white.opacity(0.45))
                                .accessibilityHidden(true)
                        }
                        .padding(.horizontal, 16).frame(minHeight: 46)
                        .background(Color.white.opacity(0.1)).clipShape(.rect(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.white.opacity(0.08), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(searching ? "Close search" : "Search YouTube in French")
                }
                .padding(.horizontal, 20).padding(.bottom, 16)
            }
    }

    // MARK: - Search

    private var searchBarInline: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass").foregroundStyle(.white.opacity(0.5)).accessibilityHidden(true)
            TextField("", text: $searchText, prompt: Text("Search in French…").foregroundColor(.white.opacity(0.7)))
                .foregroundStyle(.white).font(.subheadline).autocorrectionDisabled()
                .submitLabel(.search)
                .onSubmit { Task { await runSearch() } }
                .accessibilityLabel("Search YouTube in French")
        }
        .padding(.horizontal, 14).frame(minHeight: 46)
        .background(Color.white.opacity(0.1)).clipShape(.rect(cornerRadius: 12))
        .padding(.horizontal, 20).padding(.top, 16)
    }

    /// Search runs only when it can; otherwise the state says why (E26).
    private func runSearch() async {
        let q = searchText.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return }
        guard YouTubeService.hasKey else { search = .unavailable(.noKey); return }
        guard reachability.isReachable else { search = .unavailable(.offline); return }
        search = .loading
        switch await YouTubeService.search(q) {
        case .results(let videos): search = .results(videos)
        case .unavailable(let failure): search = .unavailable(failure)
        }
    }

    private func retrySearch() {
        Task {
            reachability.refresh()
            await runSearch()
        }
    }

    private func retryFeed() {
        Task {
            reachability.refresh()
            await model.load()
        }
    }

    private var searchResultsView: some View {
        VStack(spacing: 16) {
            searchBarInline
            switch search {
            case .idle:
                VStack(spacing: 16) { suggestedGrid }.padding(.top, 8)
            case .loading:
                HStack(spacing: 10) {
                    ProgressView().tint(.white).accessibilityHidden(true)
                    Text("Searching…").font(.footnote).foregroundStyle(.white.opacity(0.75))
                }
                .padding(.vertical, 40)
                .accessibilityElement(children: .combine)
            case .results(let videos):
                if videos.isEmpty {
                    notice(title: "No videos found", message: "Nothing matched “\(searchText)”. Try one of the suggested searches.", icon: "magnifyingglass", retry: nil)
                    suggestedGrid
                } else {
                    VStack(spacing: 14) {
                        ForEach(videos) { video in listRow(video) }
                    }
                    .padding(.horizontal, 20)
                }
            case .unavailable(let failure):
                notice(title: VideoFeedCopy.searchTitle(failure), message: VideoFeedCopy.searchMessage(failure),
                       icon: icon(for: failure), retry: failure.isRetryable ? retrySearch : nil)
                if failure == .noKey { suggestedGrid.opacity(0.5).disabled(true) }
            }
        }
        .padding(.bottom, 40)
    }

    private func listRow(_ video: YTVideo) -> some View {
        Button { open(video) } label: {
            HStack(spacing: 12) {
                thumbnail(video, width: 130, height: 74)
                VStack(alignment: .leading, spacing: 4) {
                    Text(video.title).font(.subheadline.weight(.semibold)).foregroundStyle(.white).lineLimit(2).multilineTextAlignment(.leading)
                    Text(video.channel).font(.caption).foregroundStyle(.white.opacity(0.5))
                    if !video.viewsLabel.isEmpty {
                        Text(video.viewsLabel).font(.caption2).foregroundStyle(.white.opacity(0.7))
                    }
                }
                Spacer()
            }
            .frame(minHeight: 74)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(video.title), \(video.channel)\(video.durationLabel.isEmpty ? "" : ", \(video.durationLabel)")")
        .accessibilityHint("Opens the video")
    }

    // MARK: - Feed

    private var feed: some View {
        VStack(alignment: .leading, spacing: 24) {
            if model.isLoading && model.sections.isEmpty {
                feedSkeleton
            } else {
                if let failure = model.feedFailure {
                    notice(title: VideoFeedCopy.title(failure), message: VideoFeedCopy.message(failure),
                           icon: icon(for: failure), retry: failure.isRetryable ? retryFeed : nil)
                }
                ForEach(model.sections) { section in
                    sectionView(section)
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
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading videos")
    }

    private func sectionView(_ section: WatchModel.Section) -> some View {
        let category = section.category
        let videos = section.videos
        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Text(category.emoji).font(.title3).minimumScaleFactor(0.6)
                    .frame(width: 36, height: 36).background(Color.white.opacity(0.08)).clipShape(.rect(cornerRadius: 10))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 1) {
                    Text(section.isCurated ? category.name : "Trending \(category.name)").scaledSerifDisplay(20, weight: .semibold).foregroundStyle(.white)
                    Text(section.isCurated ? (videos.isEmpty ? VideoFeedCopy.unavailableLabel : VideoFeedCopy.curatedLabel) : "Popular in France")
                        .font(.caption).foregroundStyle(.white.opacity(0.5))
                }
                Spacer()
                if !videos.isEmpty && !section.isCurated {
                    HStack(spacing: 4) {
                        Image(systemName: "flame.fill").font(.caption2).foregroundStyle(Theme.primary).accessibilityHidden(true)
                        Text("\(videos.count)").font(.caption2.weight(.bold)).foregroundStyle(Theme.primary)
                    }
                    .padding(.horizontal, 8).padding(.vertical, 4).background(Theme.primary.opacity(0.15)).clipShape(.capsule)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(videos.count) videos")
                }
            }
            .padding(.horizontal, 20)

            if videos.isEmpty {
                Text(VideoFeedCopy.emptyCategory).font(.footnote).foregroundStyle(.white.opacity(0.7))
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
                Text(video.title).font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                    .lineLimit(2).multilineTextAlignment(.leading).frame(width: 250, alignment: .leading)
                HStack(spacing: 6) {
                    Text(video.channel).font(.caption).foregroundStyle(.white.opacity(0.55)).lineLimit(1)
                    if !video.viewsLabel.isEmpty {
                        Circle().fill(.white.opacity(0.4)).frame(width: 3, height: 3)
                        Text(video.viewsLabel).font(.caption2).foregroundStyle(.white.opacity(0.7))
                    }
                }
                .frame(width: 250, alignment: .leading)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(video.title), \(video.channel)\(video.durationLabel.isEmpty ? "" : ", \(video.durationLabel)")")
        .accessibilityHint("Opens the video")
    }

    private func thumbnail(_ video: YTVideo, width: CGFloat, height: CGFloat) -> some View {
        Color.white.opacity(0.08)
            .frame(width: width, height: height)
            .overlay {
                AsyncImage(url: URL(string: video.thumbnailUrl)) { img in
                    img.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    Image(systemName: "play.rectangle.fill").font(.title).foregroundStyle(.white.opacity(0.3))
                }
                .allowsHitTesting(false)
            }
            .overlay(alignment: .center) {
                Image(systemName: "play.fill").font(.callout).foregroundStyle(.white)
                    .frame(width: 36, height: 36).background(Color.black.opacity(0.5)).clipShape(.circle)
            }
            .overlay(alignment: .bottomTrailing) {
                if !video.durationLabel.isEmpty {
                    Text(video.durationLabel).font(.caption2.weight(.semibold)).foregroundStyle(.white)
                        .padding(.horizontal, 6).padding(.vertical, 2).background(Color.black.opacity(0.7)).clipShape(.rect(cornerRadius: 4))
                        .padding(6)
                }
            }
            .clipShape(.rect(cornerRadius: 12))
            .accessibilityHidden(true)
    }

    private var suggestedSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "chart.line.uptrend.xyaxis").font(.subheadline).foregroundStyle(Theme.primary).accessibilityHidden(true)
                Text("Suggested Searches").scaledSerifDisplay(20, weight: .semibold).foregroundStyle(.white)
            }
            .padding(.horizontal, 20)
            if YouTubeService.hasKey {
                suggestedGrid
            } else {
                Text(VideoFeedCopy.searchMessage(.noKey)).font(.footnote).foregroundStyle(.white.opacity(0.75))
                    .padding(.horizontal, 20)
            }
        }
    }

    private var suggestedGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
            ForEach(YouTubeService.suggestedSearches, id: \.query) { s in
                Button {
                    Haptics.tap()
                    searchText = s.query
                    if !searching { withAnimation(Theme.motion(.default, reduceMotion: reduceMotion)) { searching = true } }
                    Task { await runSearch() }
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass").font(.caption).foregroundStyle(Theme.primary).accessibilityHidden(true)
                        Text(s.label).font(.footnote.weight(.medium)).foregroundStyle(.white)
                        Spacer()
                    }
                    .padding(.horizontal, 14).frame(minHeight: 44)
                    .background(Color.white.opacity(0.06)).clipShape(.rect(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.white.opacity(0.08), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Search \(s.label)")
            }
        }
        .padding(.horizontal, 20)
    }

    // MARK: - Explicit states (E26)

    private func notice(title: String, message: String, icon: String, retry: (() -> Void)?) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: icon).font(.footnote).foregroundStyle(Theme.warning).accessibilityHidden(true)
                Text(title).font(.subheadline.weight(.bold)).foregroundStyle(.white)
            }
            Text(message).font(.footnote).foregroundStyle(.white.opacity(0.8))
                .fixedSize(horizontal: false, vertical: true)
            if let retry {
                Button { Haptics.tap(); retry() } label: {
                    Label("Try again", systemImage: "arrow.clockwise")
                        .font(.footnote.weight(.semibold)).foregroundStyle(Theme.primary)
                        .frame(minHeight: 44)
                }
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color.white.opacity(0.06)).clipShape(.rect(cornerRadius: Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.warning.opacity(0.25), lineWidth: 1))
        .padding(.horizontal, 20)
    }

    private func icon(for failure: MediaServiceFailure) -> String {
        switch failure {
        case .noKey: return "key.slash"
        case .offline: return "wifi.slash"
        case .serviceError: return "exclamationmark.triangle.fill"
        }
    }

    private func open(_ video: YTVideo) {
        Haptics.tap()
        playingVideo = video
    }
}
