//
//  ContentScreens.swift
//  FluentFrenchIOS
//
//  Editorial reading surfaces: a hero-image article reader with structured
//  body parsing, reliable tap-to-translate AND press-and-hold phrase selection,
//  a live-translation gloss popover, and a key-vocabulary section. Shared by
//  both curated library pieces and live news articles.
//

import SwiftUI

// MARK: - Library reader

struct ReaderView: View {
    let piece: ReadingPiece
    var body: some View {
        WordReader(
            title: piece.title,
            subtitle: "\(piece.region.label) · \(piece.minutes) min read",
            level: piece.level,
            tint: piece.tint,
            categoryLabel: piece.category.label,
            text: piece.body,
            sourceTab: "read"
        )
    }
}

// MARK: - News article reader

struct ArticleReaderView: View {
    let article: NewsArticle
    var body: some View {
        WordReader(
            title: article.title,
            subtitle: "\(article.source) · \(article.timeAgo)",
            level: article.level,
            levelLabel: article.levelLabel,
            tint: Color(hex: article.category.hex),
            categoryLabel: article.category.label,
            regionLabel: article.region?.label,
            regionEmoji: article.region?.emoji,
            imageUrl: article.imageUrl,
            summary: article.contextSummary,
            text: article.body,
            sourceTab: "read",
            sourceUrl: article.url,
            sourceName: article.source,
            isExcerpt: article.isExcerpt
        )
    }
}

// MARK: - Content block model

private enum BlockKind { case heading, paragraph, bullet, numbered }

private struct Token: Identifiable, Hashable {
    let id: Int
    let text: String
}

private struct ContentBlock: Identifiable {
    let id: Int
    let kind: BlockKind
    let number: Int?
    let tokens: [Token]
}

/// What the gloss popover should look up.
private struct GlossTarget: Identifiable {
    let id = UUID()
    let term: String
    let context: String
}

// MARK: - Word-tappable reader core

struct WordReader: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// Body text is sized per block, so the reader needs a `Font` value rather
    /// than the `.scaledFont` modifier (one environment read for every word).
    @Environment(\.sizeCategory) private var sizeCategory
    /// 1 at the default text size; the hero image and the round chrome grow
    /// with it so scaled text keeps its designed proportions.
    @ScaledMetric private var typeScale: CGFloat = 1

    /// The hero grows with the text size but stops before it swallows the screen.
    private var heroScale: CGFloat { min(max(typeScale, 1), 1.6) }

    let title: String
    var subtitle: String? = nil
    /// The level captures from this text are filed under (E7).
    let level: CEFRLevel
    /// What the level pill says — "≈ B1" when the level is an estimate.
    var levelLabel: String? = nil
    let tint: Color
    var categoryLabel: String? = nil
    var regionLabel: String? = nil
    var regionEmoji: String? = nil
    var imageUrl: String? = nil
    var summary: String? = nil
    let text: String
    let sourceTab: String
    /// The story's web address, when there is one to send the reader to.
    var sourceUrl: String? = nil
    /// Who published it — named in the excerpt note and the source link.
    var sourceName: String? = nil
    /// True when `text` is the opening excerpt a news service hands out rather
    /// than the whole piece; the reader says so instead of implying it is all.
    var isExcerpt: Bool = false

    // Selection state
    @State private var target: GlossTarget? = nil
    @State private var savedTerms: Set<String> = []
    @State private var selectionMode = false
    @State private var anchorId: Int? = nil
    @State private var focusId: Int? = nil
    /// The token-id range the current selection may cover: the sentence it
    /// started in (token ids run through the whole article, so without this a
    /// drag could sweep paragraphs into one "word").
    @State private var anchorSpan: ClosedRange<Int>? = nil
    @State private var clearTask: Task<Void, Never>? = nil
    @State private var tokenFrames: [Int: CGRect] = [:]

    private var blocks: [ContentBlock] { Self.parse(text) }
    private var keyVocab: [String] { Self.keyVocabulary(from: text) }

    var body: some View {
        ZStack(alignment: .top) {
            Theme.background.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: Space.lg) {
                    hero
                    VStack(alignment: .leading, spacing: Space.lg) {
                        meta
                        if let summary, !summary.isEmpty { contextBox(summary) }
                        if blocks.isEmpty {
                            emptyBody
                        } else {
                            hintRow
                            articleBody
                            if isExcerpt { excerptNote }
                            keyVocabSection
                        }
                        if !savedTerms.isEmpty { savedFooter }
                        Color.clear.frame(height: 24)
                    }
                    .padding(.horizontal, Space.xl)
                }
            }
            .scrollIndicators(.hidden)
            .ignoresSafeArea(edges: .top)

            if selectionMode { selectionHint }
            backButton
        }
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        // The story is read aloud from inside this screen; leaving it must not
        // leave a five-paragraph narration playing over the rest of the app.
        .onDisappear { NaturalVoice.shared.stop() }
        .sheet(item: $target) { t in
            GlossSheet(
                term: t.term,
                context: t.context,
                sourceTab: sourceTab,
                sourceLevel: level,
                alreadySaved: savedTerms.contains(t.term.lowercased()) || store.hasGap(forWord: t.term)
            ) {
                savedTerms.insert(t.term.lowercased())
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
            .presentationContentInteraction(.scrolls)
        }
    }

    // MARK: Hero

    private var hero: some View {
        Theme.backgroundTertiary
            .frame(height: 300 * heroScale)
            .overlay {
                if let imageUrl, let url = URL(string: imageUrl) {
                    AsyncImage(url: url) { img in
                        img.resizable().aspectRatio(contentMode: .fill)
                    } placeholder: {
                        LinearGradient(colors: [tint.opacity(0.85), tint], startPoint: .topLeading, endPoint: .bottomTrailing)
                            .overlay {
                                Image(systemName: "newspaper.fill").scaledFont(44).foregroundStyle(.white.opacity(0.5))
                                    .accessibilityHidden(true)
                            }
                    }
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
                } else {
                    LinearGradient(colors: [tint.opacity(0.9), tint], startPoint: .topLeading, endPoint: .bottomTrailing)
                        .overlay {
                            Image(systemName: "book.pages.fill").scaledFont(50).foregroundStyle(.white.opacity(0.4))
                                .accessibilityHidden(true)
                        }
                }
            }
            .overlay {
                LinearGradient(colors: [.black.opacity(0.35), .clear, .black.opacity(0.45), .black.opacity(0.82)],
                               startPoint: .top, endPoint: .bottom)
                .allowsHitTesting(false)
            }
            .overlay(alignment: .bottomLeading) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 6) {
                        if let categoryLabel {
                            Text(categoryLabel.uppercased())
                                .scaledFont(10, weight: .bold).foregroundStyle(.white)
                                .padding(.horizontal, 8).padding(.vertical, 4)
                                .background(tint).clipShape(.capsule)
                        }
                        Text(levelLabel ?? level.rawValue)
                            .scaledFont(10, weight: .bold).foregroundStyle(.white)
                            .padding(.horizontal, 8).padding(.vertical, 4)
                            .background(.white.opacity(0.22)).clipShape(.capsule)
                        if let regionLabel {
                            HStack(spacing: 3) {
                                if let regionEmoji { Text(regionEmoji).scaledFont(10) }
                                Text(regionLabel).scaledFont(10, weight: .semibold).foregroundStyle(.white)
                            }
                            .padding(.horizontal, 8).padding(.vertical, 4)
                            .background(.black.opacity(0.3)).clipShape(.capsule)
                        }
                    }
                    .accessibilityElement(children: .combine)
                    Text(title)
                        .scaledSerifDisplay(27, weight: .bold).foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                        .shadow(color: .black.opacity(0.4), radius: 8, y: 2)
                        .accessibilityAddTraits(.isHeader)
                    if let subtitle {
                        Text(subtitle).scaledFont(13, weight: .medium).foregroundStyle(.white.opacity(0.85))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(.horizontal, Space.xl).padding(.bottom, 20)
            }
            .clipped()
    }

    private var backButton: some View {
        HStack {
            Button {
                Haptics.tap()
                dismiss()
            } label: {
                Image(systemName: "chevron.left")
                    .scaledFont(17, weight: .bold).foregroundStyle(.white)
                    .frame(width: 38 * Theme.chromeScale(typeScale), height: 38 * Theme.chromeScale(typeScale))
                    .background(.black.opacity(0.32)).clipShape(.circle)
                    .overlay(Circle().stroke(.white.opacity(0.18), lineWidth: 0.5))
                    .minimumHitTarget()
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            .accessibilityHint("Returns to the previous screen")
            Spacer()
            // Nothing to read aloud when the story arrived without text.
            if !blocks.isEmpty {
                SpeakButton(text: text, size: 38)
                    .background(.black.opacity(0.32), in: .circle)
            }
        }
        .padding(.horizontal, Space.lg)
        .padding(.top, 8)
    }

    // MARK: Meta + hints

    private var meta: some View {
        HStack(spacing: 8) {
            Pill(text: levelLabel ?? level.rawValue, color: tint, filled: true)
            if let categoryLabel { Pill(text: categoryLabel, color: tint) }
            Spacer()
        }
    }

    private func contextBox(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("Context", systemImage: "text.alignleft")
                .scaledFont(12, weight: .bold).foregroundStyle(tint)
            Text(text).scaledFont(15, weight: .medium).foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Space.lg)
        .background(tint.opacity(0.07))
        .clipShape(.rect(cornerRadius: Radius.card))
        .overlay(alignment: .leading) {
            Rectangle().fill(tint).frame(width: 3).clipShape(.rect(cornerRadius: 2))
        }
    }

    private var hintRow: some View {
        HStack(spacing: 6) {
            Image(systemName: "hand.tap.fill").scaledFont(11).foregroundStyle(tint)
                .accessibilityHidden(true)
            Text("Tap any word to translate · Drag across up to \(Tuning.maxCaptureWords) words for a phrase")
                .scaledFont(12, weight: .medium).foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: Source

    /// A way out to the original story. Nothing at all when there is no URL —
    /// curated pieces are complete and have no "elsewhere" to point at.
    @ViewBuilder
    private var sourceLink: some View {
        if let sourceUrl, let url = URL(string: sourceUrl) {
            Link(destination: url) {
                HStack(spacing: 6) {
                    Text("Read the full story").scaledFont(14, weight: .semibold)
                    Image(systemName: "arrow.up.right").scaledFont(11, weight: .bold)
                        .accessibilityHidden(true)
                }
                .foregroundStyle(tint)
                .padding(.horizontal, Space.lg)
                .frame(minHeight: Theme.minimumHitTarget)
                .background(tint.opacity(0.1))
                .clipShape(.capsule)
            }
            .accessibilityLabel(sourceName.map { "Read the full story at \($0)" } ?? "Read the full story")
            .accessibilityHint("Opens the original article outside the app")
        }
    }

    /// Says plainly that the text above stops early, so a reader does not take
    /// a mid-sentence cut for the end of the piece.
    private var excerptNote: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            Label(
                "This is the opening excerpt \(sourceName ?? "the news service") shares — the story continues on their site.",
                systemImage: "text.append"
            )
            .scaledFont(13, weight: .medium).foregroundStyle(Theme.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
            sourceLink
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Space.lg)
        .background(Theme.backgroundSecondary)
        .clipShape(.rect(cornerRadius: Radius.card))
    }

    /// A story whose text never arrived. Rare — the feed drops textless
    /// headlines — but a reader must never meet a blank page with no reason.
    private var emptyBody: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            Label("No text available for this story", systemImage: "doc.text.magnifyingglass")
                .scaledFont(15, weight: .bold).foregroundStyle(Theme.text)
                .fixedSize(horizontal: false, vertical: true)
            Text("The news service didn't send anything to read here, so there are no words to tap.")
                .scaledFont(14).foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            sourceLink
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Space.lg)
        .background(Theme.backgroundSecondary)
        .clipShape(.rect(cornerRadius: Radius.card))
    }

    // MARK: Body

    private var articleBody: some View {
        VStack(alignment: .leading, spacing: Space.lg) {
            ForEach(blocks) { block in
                blockView(block)
            }
        }
        .coordinateSpace(.named("reader"))
        .onPreferenceChange(TokenFramesKey.self) { value in
            Task { @MainActor in tokenFrames = value }
        }
        .gesture(phraseDragGesture)
    }

    @ViewBuilder
    private func blockView(_ block: ContentBlock) -> some View {
        switch block.kind {
        case .heading:
            HStack(alignment: .top, spacing: 10) {
                RoundedRectangle(cornerRadius: 2).fill(tint).frame(width: 4)
                tokenFlow(block, size: 20, weight: .bold, color: Theme.text)
            }
            .padding(.top, 4)
        case .bullet:
            HStack(alignment: .top, spacing: 10) {
                Circle().fill(tint).frame(width: 6, height: 6).padding(.top, 9)
                tokenFlow(block, size: 17, weight: .regular, color: Theme.text)
            }
        case .numbered:
            HStack(alignment: .top, spacing: 10) {
                Text("\(block.number ?? 1)")
                    .scaledFont(13, weight: .bold).foregroundStyle(.white)
                    .frame(width: 22 * Theme.chromeScale(typeScale), height: 22 * Theme.chromeScale(typeScale)).background(tint).clipShape(.circle)
                tokenFlow(block, size: 17, weight: .regular, color: Theme.text)
            }
        case .paragraph:
            tokenFlow(block, size: 17, weight: .regular, color: Theme.text)
        }
    }

    private func tokenFlow(_ block: ContentBlock, size: CGFloat, weight: Font.Weight, color: Color) -> some View {
        FlowLayout(spacing: 5, lineSpacing: 7) {
            ForEach(block.tokens) { token in
                tokenView(token, blockId: block.id, size: size, weight: weight, color: color)
            }
        }
    }

    @ViewBuilder
    private func tokenView(_ token: Token, blockId: Int, size: CGFloat, weight: Font.Weight, color: Color) -> some View {
        let cleaned = Self.clean(token.text)
        // "2030" or "%" is text, not a word: it gets no tap, no button trait and
        // no "opens the translation" promise the reader cannot keep.
        let lookupable = Self.isLookupable(cleaned)
        let highlighted = isHighlighted(token.id)
        let saved = lookupable && savedTerms.contains(cleaned.lowercased())
        let bg: Color = highlighted ? tint.opacity(0.3) : (saved ? Theme.primaryLight : .clear)
        let wordView = Text(token.text)
            .font(Theme.scaledFontValue(size, weight: weight, for: sizeCategory))
            .foregroundStyle(highlighted ? Theme.text : color)
            .padding(.horizontal, 2.5).padding(.vertical, 1)
            .background(bg)
            .clipShape(.rect(cornerRadius: 5))
            .overlay(alignment: .bottom) {
                if saved && !highlighted {
                    Rectangle().fill(Theme.primary.opacity(0.5)).frame(height: 1.5)
                }
            }
            .contentShape(.rect)
            .background {
                GeometryReader { geo in
                    Color.clear.preference(
                        key: TokenFramesKey.self,
                        value: [token.id: geo.frame(in: .named("reader"))]
                    )
                }
            }
        // Each word is its own control: VoiceOver announces it as a button and
        // says what activating it does.
        let control = wordView
            .onTapGesture { handleTap(token: token, blockId: blockId) }
            .accessibilityAddTraits(.isButton)
            .accessibilityHint("Opens the translation")
        // The underline that marks a saved word gets said in words — but only
        // for saved words, so the reader is not read out as a wall of values.
        if !lookupable {
            wordView
        } else if saved {
            control.accessibilityValue("Saved to your deck")
        } else {
            control
        }
    }

    private func isHighlighted(_ id: Int) -> Bool {
        guard selectionMode, let a = anchorId, let f = focusId else { return false }
        return id >= min(a, f) && id <= max(a, f)
    }

    // MARK: Key vocabulary

    @ViewBuilder
    private var keyVocabSection: some View {
        if !keyVocab.isEmpty {
            VStack(alignment: .leading, spacing: Space.md) {
                SectionHeader(title: "Key Vocabulary", trailing: "\(keyVocab.count) words")
                FlowLayout(spacing: 8, lineSpacing: 8) {
                    ForEach(keyVocab, id: \.self) { word in
                        let saved = savedTerms.contains(word.lowercased())
                        Button {
                            Haptics.tap()
                            present(term: word)
                        } label: {
                            HStack(spacing: 5) {
                                Text(word).scaledFont(14, weight: .semibold)
                                Image(systemName: saved ? "checkmark.circle.fill" : "plus.circle")
                                    .scaledFont(12)
                                    .accessibilityHidden(true)
                            }
                            .foregroundStyle(saved ? Theme.success : tint)
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .background(saved ? Theme.successLight : tint.opacity(0.1))
                            .clipShape(.capsule)
                            .frame(minHeight: Theme.minimumHitTarget)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(word)
                        .accessibilityValue(saved ? "Saved to your deck" : "")
                        .accessibilityHint(saved ? "Opens the word again" : "Opens the translation and lets you save it")
                    }
                }
            }
            .padding(.top, 6)
        }
    }

    private var savedFooter: some View {
        Label("\(savedTerms.count) word\(savedTerms.count == 1 ? "" : "s") added to your deck",
              systemImage: "checkmark.seal.fill")
            .scaledFont(13, weight: .semibold).foregroundStyle(Theme.success)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(Theme.successLight).clipShape(.capsule)
    }

    // MARK: Selection hint

    private var selectionHint: some View {
        VStack {
            Spacer()
            HStack(spacing: 8) {
                Image(systemName: "text.cursor").scaledFont(13, weight: .bold)
                    .accessibilityHidden(true)
                Text("Drag across words to build a phrase")
                    .scaledFont(13, weight: .semibold)
                    .multilineTextAlignment(.center)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 16).padding(.vertical, 11)
            .background(Theme.text.opacity(0.92)).clipShape(.capsule)
            .softLift(radius: 12, y: 4, strength: 2)
            .padding(.bottom, 36)
            // Reduce Motion: the hint fades in instead of sliding up.
            .transition(reduceMotion ? AnyTransition.opacity : .move(edge: .bottom).combined(with: .opacity))
        }
        .allowsHitTesting(false)
    }

    // MARK: Gesture handlers

    private func handleTap(token: Token, blockId: Int) {
        present(term: Self.clean(token.text))
    }

    /// Long-press-then-drag: hold briefly, then sweep your finger across the
    /// text to highlight a continuous phrase. The short hold lets the article
    /// scroll normally without being mistaken for a selection.
    private var phraseDragGesture: some Gesture {
        LongPressGesture(minimumDuration: 0.16)
            .sequenced(before: DragGesture(minimumDistance: 0, coordinateSpace: .named("reader")))
            .onChanged { value in
                if case .second(true, let drag) = value, let drag {
                    updateSelection(at: drag.location)
                }
            }
            .onEnded { value in
                if case .second(true, _) = value {
                    finishSelection()
                } else {
                    endSelection()
                }
            }
    }

    /// Grow the highlighted range to include whichever word the finger is over —
    /// but only as far as a phrase a deck card can be made of: at most
    /// `Tuning.maxCaptureWords` words, and never past the end of the sentence the
    /// selection started in. A sweep down the article stops growing instead of
    /// building a paragraph-long "word".
    private func updateSelection(at point: CGPoint) {
        guard let id = tokenId(at: point) else { return }
        if !selectionMode {
            Haptics.select()
            clearTask?.cancel()
            let span = selectableSpan(containing: id)
            withAnimation(Theme.motion(.spring(response: 0.25, dampingFraction: 0.85), reduceMotion: reduceMotion)) {
                selectionMode = true
                anchorId = id
                focusId = id
                anchorSpan = span
            }
        } else if let anchor = anchorId {
            let clamped = clampedFocus(anchor: anchor, candidate: id)
            if focusId != clamped {
                Haptics.tap()
                withAnimation(Theme.motion(.easeOut(duration: 0.12), reduceMotion: reduceMotion)) { focusId = clamped }
            }
        }
    }

    /// How far the highlight may reach from `anchor` toward `candidate`: inside
    /// the anchor's own sentence and no wider than `Tuning.maxCaptureWords`.
    private func clampedFocus(anchor: Int, candidate: Int) -> Int {
        let span = anchorSpan ?? anchor...anchor
        let inParagraph = min(max(candidate, span.lowerBound), span.upperBound)
        let reach = max(0, Tuning.maxCaptureWords - 1)
        return inParagraph > anchor ? min(inParagraph, anchor + reach) : max(inParagraph, anchor - reach)
    }

    /// The token-id range a selection started at `id` may cover: the SENTENCE it
    /// sits in, inside its own paragraph. The highlight stops visibly at the full
    /// stop instead of sweeping into the next sentence and building a term the
    /// deck would then have to refuse.
    private func selectableSpan(containing id: Int) -> ClosedRange<Int>? {
        for block in blocks {
            guard let first = block.tokens.first?.id, let last = block.tokens.last?.id,
                  id >= first, id <= last else { continue }
            var lower = first
            var upper = last
            for token in block.tokens {
                guard CaptureBuilder.endsSentence(token.text) else { continue }
                if token.id < id { lower = token.id + 1 } else { upper = token.id; break }
            }
            return lower...upper
        }
        return nil
    }

    /// On lift, translate the highlighted phrase (or single word).
    private func finishSelection() {
        guard selectionMode, let a = anchorId, let f = focusId else {
            endSelection(); return
        }
        let lo = min(a, f), hi = max(a, f)
        let term = lo == hi ? tokenText(lo) : Self.phrase(in: blocks, from: lo, to: hi)
        endSelection()
        present(term: term)
    }

    /// Find the token under a point, falling back to the nearest word on the
    /// same line so fast sweeps never skip over words.
    private func tokenId(at point: CGPoint) -> Int? {
        for (id, rect) in tokenFrames where rect.contains(point) { return id }
        var best: Int? = nil
        var bestDist = CGFloat.greatestFiniteMagnitude
        for (id, rect) in tokenFrames where point.y >= rect.minY && point.y <= rect.maxY {
            let dx = abs(rect.midX - point.x)
            if dx < bestDist { bestDist = dx; best = id }
        }
        return best
    }

    private func tokenText(_ id: Int) -> String {
        for block in blocks {
            for t in block.tokens where t.id == id { return Self.clean(t.text) }
        }
        return ""
    }

    /// Open the gloss for a term with the sentence it was met in as context
    /// (E5) — never the whole article.
    private func present(term: String) {
        let clean = term.trimmingCharacters(in: .whitespacesAndNewlines)
        // A bare number ("2030") or a stray symbol ("%", "€") has no meaning to
        // look up and must never become a deck card, so it is not a term at all —
        // and neither is a run of text longer than a phrase (the drag is clamped,
        // this is the backstop).
        guard Self.isLookupable(clean), CaptureBuilder.isAcceptableHeadword(clean) else { return }
        target = GlossTarget(term: clean, context: SentenceExtractor.sentence(containing: clean, in: text))
    }

    private func endSelection() {
        clearTask?.cancel()
        withAnimation(Theme.motion(.easeOut(duration: 0.2), reduceMotion: reduceMotion)) {
            selectionMode = false
            anchorId = nil
            focusId = nil
            anchorSpan = nil
        }
    }

    private func scheduleAutoClear() {
        clearTask?.cancel()
        clearTask = Task {
            try? await Task.sleep(for: .seconds(4))
            if !Task.isCancelled { endSelection() }
        }
    }

    // MARK: - Parsing helpers

    /// Split a body into structured blocks, assigning a global running id to
    /// every word token so phrase selection can join a contiguous range.
    fileprivate static func parse(_ text: String) -> [ContentBlock] {
        let lines = text
            .components(separatedBy: "\n")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        var blocks: [ContentBlock] = []
        var tokenId = 0
        var blockId = 0
        for line in lines {
            var kind: BlockKind = .paragraph
            var number: Int? = nil
            var content = line

            if let r = line.range(of: #"^#{1,3}\s+"#, options: .regularExpression) {
                kind = .heading; content = String(line[r.upperBound...])
            } else if let r = line.range(of: #"^(\-|\•|\*)\s+"#, options: .regularExpression) {
                kind = .bullet; content = String(line[r.upperBound...])
            } else if let r = line.range(of: #"^\d+[\.\)]\s+"#, options: .regularExpression) {
                kind = .numbered
                number = Int(line.prefix { $0.isNumber }) ?? 1
                content = String(line[r.upperBound...])
            } else if line.count < 60 && line.hasSuffix(":") {
                kind = .heading
            }

            let words = content.split(separator: " ").map(String.init)
            guard !words.isEmpty else { continue }
            let tokens = words.map { w -> Token in
                let t = Token(id: tokenId, text: w); tokenId += 1; return t
            }
            blocks.append(ContentBlock(id: blockId, kind: kind, number: number, tokens: tokens))
            blockId += 1
        }
        return blocks
    }

    /// Join the raw token texts in a contiguous id range into a phrase.
    fileprivate static func phrase(in blocks: [ContentBlock], from lo: Int, to hi: Int) -> String {
        var parts: [String] = []
        for block in blocks {
            for token in block.tokens where token.id >= lo && token.id <= hi {
                parts.append(token.text)
            }
        }
        let joined = parts.joined(separator: " ")
        return joined.trimmingCharacters(in: CharacterSet(charactersIn: " .,!?;:«»\"'()—–…"))
    }

    static func clean(_ s: String) -> String {
        s.trimmingCharacters(in: CharacterSet(charactersIn: " .,!?;:«»\"'()—–…0123456789\n\t"))
    }

    /// True when a token is something the dictionary could answer for: it has at
    /// least one letter. Numbers, punctuation runs and lone symbols are text the
    /// reader shows but never offers to translate.
    static func isLookupable(_ s: String) -> Bool {
        s.contains { $0.isLetter }
    }

    private static let stopwords: Set<String> = [
        "dans", "pour", "avec", "cette", "leur", "leurs", "vous", "nous", "elles",
        "comme", "mais", "donc", "alors", "aussi", "plus", "très", "être", "avoir",
        "fait", "tout", "tous", "toute", "toutes", "sans", "sous", "entre", "depuis",
        "selon", "après", "avant", "pendant", "lorsque", "parce", "quand", "encore",
    ]

    /// A handful of notable words from the body for the key-vocabulary section.
    static func keyVocabulary(from text: String) -> [String] {
        var seen = Set<String>()
        var result: [String] = []
        for raw in text.split(whereSeparator: { $0 == " " || $0 == "\n" }) {
            let word = clean(String(raw))
            let lower = word.lowercased()
            guard word.count >= 6, !stopwords.contains(lower), seen.insert(lower).inserted else { continue }
            result.append(word)
            if result.count >= 12 { break }
        }
        return result
    }
}

// MARK: - Token frame tracking

/// Collects each word's frame in the reader coordinate space so a drag can
/// hit-test which word the finger is currently over.
private struct TokenFramesKey: PreferenceKey {
    static let defaultValue: [Int: CGRect] = [:]
    static func reduce(value: inout [Int: CGRect], nextValue: () -> [Int: CGRect]) {
        value.merge(nextValue()) { _, new in new }
    }
}

// MARK: - Flow layout

/// A simple wrapping layout so each word/chip is an individually tappable view.
struct FlowLayout: Layout {
    var spacing: CGFloat = 6
    var lineSpacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0
        for sv in subviews {
            let size = sv.sizeThatFits(.unspecified)
            if x > 0 && x + size.width > maxWidth {
                x = 0; y += rowHeight + lineSpacing; rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: proposal.width ?? x, height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let maxWidth = bounds.width
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0
        for sv in subviews {
            let size = sv.sizeThatFits(.unspecified)
            if x > 0 && x + size.width > maxWidth {
                x = 0; y += rowHeight + lineSpacing; rowHeight = 0
            }
            sv.place(at: CGPoint(x: bounds.minX + x, y: bounds.minY + y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

// MARK: - Gloss popover (live translation + capture)

/// The reader's word sheet. Every lookup outcome is explicit — loading
/// (bounded by `Tuning.glossTimeoutSeconds`), a real gloss, or a named failure
/// with a retry — and Save is disabled until there is something real to save.
/// When the lookup fails the learner can still "Save now, translate later": the
/// gap is stored with the sentence and `needsTranslation`, never a placeholder,
/// and the store fills the meaning in the next time a lookup succeeds (E4).
struct GlossSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let term: String
    /// The sentence the word was met in (`SentenceExtractor`), used for the lookup and the capture context.
    let context: String
    let sourceTab: String
    /// The level of the text the word came from (nil → the learner's level).
    var sourceLevel: CEFRLevel? = nil
    let alreadySaved: Bool
    var onSave: () -> Void

    @State private var lookup: LookupState = .loading
    @State private var attempt = 0
    @State private var note = ""
    @State private var path: [WordRoute] = []

    var body: some View {
        NavigationStack(path: $path) {
            rootCard
                .navigationDestination(for: WordRoute.self) { route in
                    TranslationCardView(
                        route: route,
                        accent: Theme.primary,
                        sourceType: .reading,
                        sourceTab: sourceTab,
                        onPush: { path.append($0) },
                        sourceLevel: sourceLevel
                    )
                }
        }
    }

    /// What Save would store right now: the gloss (with the learner's note), or —
    /// after a failed lookup — the bare word with its sentence for later.
    private var draft: CaptureDraft? {
        switch lookup {
        case .loading:
            return nil
        case .loaded(let g):
            return CaptureDraft(gloss: g, sourceType: .reading, sourceTab: sourceTab,
                                contextSentence: context, sourceLevel: sourceLevel, note: note)
        case .failed:
            return CaptureDraft(untranslated: term, sourceType: .reading, sourceTab: sourceTab,
                                contextSentence: context, sourceLevel: sourceLevel, note: note)
        }
    }

    private var rootCard: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                header
                switch lookup {
                case .loading:
                    LookupLoadingView(accent: Theme.primary)
                case .loaded(let gloss):
                    glossContent(gloss)
                case .failed(let failure):
                    LookupUnavailableView(failure: failure, accent: Theme.primary, onRetry: { attempt += 1 })
                    if !context.isEmpty { contextBlock }
                }
                noteField
                Color.clear.frame(height: 8)
            }
            .padding(Space.xl)
            .padding(.top, 8)
        }
        .background(Theme.background)
        .toolbar(.hidden, for: .navigationBar)
        .safeAreaInset(edge: .bottom) { saveBar }
        .task(id: attempt) { await loadGloss() }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                Text(term)
                    .scaledSerifDisplay(term.count > 22 ? 22 : 28, weight: .bold)
                    .foregroundStyle(Theme.primary)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                if let g = lookup.gloss, !g.pronunciation.isEmpty {
                    PhoneticLine(text: g.pronunciation)
                }
            }
            SpeakButton(text: term, size: 38)
            Spacer()
        }
    }

    private func glossContent(_ g: WordGloss) -> some View {
        VStack(alignment: .leading, spacing: Space.lg) {
            VStack(alignment: .leading, spacing: 4) {
                Text("MEANING").font(.caption.weight(.bold)).foregroundStyle(Theme.textSecondary)
                Text(g.translation).font(.headline).foregroundStyle(Theme.text)
                    .fixedSize(horizontal: false, vertical: true)
            }
            GlossRichDetail(gloss: g, accent: Theme.primary, onTermTap: { path.append(WordRoute(term: $0, context: "")) })
            if !g.example.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 8) {
                        Text("Example").font(.caption.weight(.bold)).foregroundStyle(Theme.secondary)
                        SpeakButton(text: g.example, size: 28)
                    }
                    Text(g.example).font(.body.weight(.medium)).italic().foregroundStyle(Theme.text)
                        .fixedSize(horizontal: false, vertical: true)
                    if !g.exampleTranslation.isEmpty {
                        Text(g.exampleTranslation).font(.subheadline).foregroundStyle(Theme.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(Space.lg)
                .background(Theme.secondaryLight)
                .clipShape(.rect(cornerRadius: Radius.card))
            }
            if !context.isEmpty, g.example != context { contextBlock }
        }
    }

    /// The sentence the word was met in — what gets saved as context.
    private var contextBlock: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("WHERE YOU MET IT").font(.caption.weight(.bold)).foregroundStyle(Theme.textSecondary)
            Text(context).font(.subheadline).foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var noteField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("PERSONAL NOTE").font(.caption.weight(.bold)).foregroundStyle(Theme.textSecondary)
            TextField("Add a memory hook (optional)", text: $note, axis: .vertical)
                .font(.body)
                .lineLimit(1...3)
                .padding(12)
                .background(Theme.card)
                .clipShape(.rect(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
        }
    }

    private var saveBar: some View {
        SaveToDeckButton(draft: draft, accent: Theme.primary, alreadySaved: alreadySaved, isBusy: lookup == .loading) { outcome in
            if case .saved = outcome {
                onSave()
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { dismiss() }
            }
        }
        .padding(.horizontal, Space.xl)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
    }

    private func loadGloss() async {
        lookup = .loading
        let result = await TranslationService.lookup(term: term, context: context)
        lookup = LookupState(result)
        // A successful lookup proves the service is reachable: fill in any
        // captures that were saved offline (E4).
        if case .gloss = result, !store.pendingTranslations.isEmpty {
            await store.resolvePendingTranslations(using: TranslationService.lookup(term:context:))
        }
    }
}

// MARK: - On-device notice

struct CameraNotice: View {
    let text: String
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "info.circle.fill").foregroundStyle(Theme.textSecondary)
                .accessibilityHidden(true)
            Text(text).scaledFont(12).foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.backgroundSecondary)
        .clipShape(.rect(cornerRadius: 12))
        .accessibilityElement(children: .combine)
    }
}
