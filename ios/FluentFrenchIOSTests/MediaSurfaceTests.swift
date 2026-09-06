//
//  MediaSurfaceTests.swift
//  FluentFrenchIOSTests
//
//  Package E-media — Listen and Watch: the per-turn listening capture split and
//  its store path (E8 / E7), the dialogue player's state machine (E17), the
//  curated Watch catalogue validation (E19), the level-aware listening shelf,
//  the media failure vocabulary and the bounded wait (E26), and the transcript
//  text helpers.
//

import Foundation
import Testing
@testable import FluentFrenchIOS
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

@MainActor
struct MediaSurfaceTests {
    private let now = EngineFixtures.now

    private func dialogue(_ lines: [(String, String, String)], difficulty: ListeningDifficulty = .beginner) -> ListeningItem {
        ListeningItem(
            id: "t-dialogue", title: "t-title", titleEnglish: "t-title-en", description: "", emoji: "",
            difficulty: difficulty, type: .dialogue, durationSeconds: 30, category: "test",
            turns: lines.map { ListeningTurn(speaker: $0.0, french: $0.1, english: $0.2) }
        )
    }

    // MARK: - E8 capture split

    @Test func aMultiTurnSelectionYieldsOneSpecPerTurnWithItsOwnEnglish() {
        let item = dialogue([("A", "fr-0", "en-0"), ("B", "fr-1", "en-1"), ("A", "fr-2", "en-2"), ("B", "fr-3", "en-3")])
        let specs = ListeningCapture.specs(for: item, from: 1, to: 3)
        #expect(specs.map(\.turnIndex) == [1, 2, 3])
        #expect(specs.map(\.french) == ["fr-1", "fr-2", "fr-3"])
        #expect(specs.map(\.english) == ["en-1", "en-2", "en-3"], "each line keeps the English of ITS turn")
        #expect(specs.map(\.speaker) == ["B", "A", "B"])
        #expect(!specs.contains { $0.french.contains(" fr-") }, "never a joined passage")
    }

    @Test func selectionRangeIsNormalisedAndClamped() {
        let item = dialogue([("A", "fr-0", "en-0"), ("B", "fr-1", "en-1"), ("A", "fr-2", "en-2")])
        #expect(ListeningCapture.specs(for: item, from: 2, to: 0).map(\.turnIndex) == [0, 1, 2], "either end may come first")
        #expect(ListeningCapture.specs(for: item, from: 1, to: 9).map(\.turnIndex) == [1, 2], "clamped to the dialogue")
        #expect(ListeningCapture.specs(for: item, from: -3, to: -1).isEmpty, "a selection entirely outside the dialogue saves nothing")
        #expect(ListeningCapture.specs(for: item, from: -3, to: 0).map(\.turnIndex) == [0])
        #expect(ListeningCapture.specs(for: item, from: 1, to: 1).map(\.french) == ["fr-1"], "a single line is one spec")
        #expect(ListeningCapture.specs(for: dialogue([]), from: 0, to: 0).isEmpty)
    }

    @Test func emptyAndRepeatedLinesAreSkippedWithinASelection() {
        let item = dialogue([("A", "Bonjour", "hello"), ("B", "   ", ""), ("A", "bonjour", "hello again")])
        let specs = ListeningCapture.specs(for: item, from: 0, to: 2)
        #expect(specs.map(\.turnIndex) == [0], "blank French is skipped; a case-insensitive repeat appears once")
    }

    // MARK: - E8 / E7 store path

    @Test func capturingASelectionSavesOneScheduledGapPerTurnAtTheDialogueLevel() {
        let store = EngineFixtures.store()
        let item = dialogue([("A", "fr-0", "en-0"), ("B", "fr-1", "en-1"), ("A", "fr-2", "en-2")], difficulty: .intermediate)
        let specs = ListeningCapture.specs(for: item, from: 0, to: 2)
        let outcome = store.captureListeningTurns(specs, from: item, now: now)
        #expect(outcome.savedCount == 3)
        #expect(outcome.duplicateCount == 0)
        let saved = store.visibleGaps.filter { $0.sourceType == .listening }
        #expect(saved.count == 3)
        for gap in saved {
            #expect(gap.category == .phrasing)
            #expect(gap.cefrLevel == ListeningDifficulty.intermediate.captureLevel, "level comes from the dialogue, not a hard-coded A2")
            #expect(gap.fsrs != nil, "built through the capture factory so it starts scheduled")
            #expect(gap.irtDifficulty == Tuning.irtDifficulty(for: .B1) + Tuning.irtHardBump,
                    "B1 material is a stretch for the default A2 learner")
            #expect(gap.needsTranslation == false)
            #expect(gap.originalContext?.sourceTab == "listen")
            #expect(gap.explanation.contains("t-title"))
        }
        let byWord = Dictionary(uniqueKeysWithValues: saved.map { ($0.frenchWord, $0.englishTranslation) })
        #expect(byWord == ["fr-0": "en-0", "fr-1": "en-1", "fr-2": "en-2"], "each gap's translation is its own turn's English")
    }

    @Test func recapturingTheSameLinesReportsDuplicatesAndAddsNothing() {
        let store = EngineFixtures.store()
        let item = dialogue([("A", "fr-0", "en-0"), ("B", "fr-1", "en-1")])
        let specs = ListeningCapture.specs(for: item, from: 0, to: 1)
        store.captureListeningTurns(specs, from: item, now: now)
        let again = store.captureListeningTurns(specs, from: item, now: now)
        #expect(again.savedCount == 0)
        #expect(again.duplicateCount == 2)
        #expect(store.visibleGaps.count == 2)
        if case .duplicate = store.captureListeningTurn(specs[0], from: item, now: now) {} else {
            Issue.record("a single re-capture reports the existing gap")
        }
    }

    @Test func aLineWithoutEnglishIsSavedAwaitingTranslationNeverWithAPlaceholder() {
        let store = EngineFixtures.store()
        let item = dialogue([("A", "fr-0", "")])
        let outcome = store.captureListeningTurn(ListeningCapture.specs(for: item, from: 0, to: 0)[0], from: item, now: now)
        guard case .saved(let gap) = outcome else { Issue.record("expected a save"); return }
        #expect(gap.needsTranslation)
        #expect(gap.englishTranslation.isEmpty)
        #expect(gap.originalContext?.translation == nil)
    }

    @Test func beginnerDialoguesAreEasyForAnAdvancedLearner() {
        let store = EngineFixtures.store()
        store.abilityTheta = 2.2   // C1
        let item = dialogue([("A", "fr-0", "en-0")], difficulty: .beginner)
        guard case .saved(let gap) = store.captureListeningTurn(ListeningCapture.specs(for: item, from: 0, to: 0)[0], from: item, now: now) else {
            Issue.record("expected a save"); return
        }
        #expect(gap.cefrLevel == .A1)
        #expect(gap.difficulty == .easy)
    }

    // MARK: - E17 playback state machine

    @Test func pauseWhileBufferingClearsTheSpinnerAndDropsTheClip() {
        var s = PlaybackState()
        s.load(turnCount: 3)
        let started = s.play()
        #expect(started)
        let token = s.beginFetch()
        #expect(s.isBuffering)
        s.pause()
        #expect(!s.isBuffering, "E17: pause clears buffering")
        #expect(!s.isPlaying)
        let stale = s.finishFetch(token: token)
        #expect(!stale, "the clip that arrives after pause is stale")
        #expect(!s.isBuffering)
    }

    @Test func jumpWhileBufferingClearsTheSpinnerAndInvalidatesTheFetch() {
        var s = PlaybackState()
        s.load(turnCount: 3)
        _ = s.play()
        let token = s.beginFetch()
        let wasPlaying = s.jump(to: 2)
        #expect(wasPlaying, "jump reports the player was playing so the new line starts")
        #expect(s.currentIndex == 2)
        #expect(!s.isBuffering)
        let stale = s.finishFetch(token: token)
        #expect(!stale)
        let clampedHigh = s.jump(to: 99)
        #expect(clampedHigh)
        #expect(s.currentIndex == 2, "clamped")
        _ = s.jump(to: -1)
        #expect(s.currentIndex == 0)
    }

    @Test func aFetchThatLandsInTimePlaysOnlyWhileStillPlaying() {
        var s = PlaybackState()
        s.load(turnCount: 2)
        _ = s.play()
        let token = s.beginFetch()
        let plays = s.finishFetch(token: token)
        #expect(plays)
        #expect(!s.isBuffering)
        // A second fetch, then stop before it lands: buffering clears, audio must not play.
        let second = s.beginFetch()
        s.stop()
        #expect(!s.isBuffering)
        let playsAfterStop = s.finishFetch(token: second)
        #expect(!playsAfterStop)
    }

    @Test func skippingTheWaitSpeaksNowWithTheBuiltInVoice() {
        var s = PlaybackState()
        s.load(turnCount: 2)
        _ = s.play()
        let token = s.beginFetch()
        let speakNow = s.skipBuffering()
        #expect(speakNow, "still playing → caller speaks with the built-in voice")
        #expect(!s.isBuffering)
        let stale = s.finishFetch(token: token)
        #expect(!stale, "the skipped clip is ignored when it lands")
        let nothingToSkip = s.skipBuffering()
        #expect(!nothingToSkip, "nothing to skip when not buffering")
    }

    @Test func turnsAdvanceThenFinishAndReplayRestartsTheLine() {
        var s = PlaybackState()
        s.load(turnCount: 2)
        let ignored = s.turnFinished()
        #expect(ignored == .ignore, "not playing → ignored")
        _ = s.play()
        let next = s.turnFinished()
        #expect(next == .speakNext)
        #expect(s.currentIndex == 1)
        #expect(s.progress == 0.5)
        let finished = s.turnFinished()
        #expect(finished == .finished)
        #expect(s.didFinish)
        #expect(!s.isPlaying)
        let replayed = s.replay()
        #expect(replayed)
        #expect(s.isPlaying)
        #expect(!s.didFinish)
        #expect(s.currentIndex == 1, "replay keeps the line")
        s.load(turnCount: 0)
        let playedEmpty = s.play()
        #expect(!playedEmpty, "no turns → nothing to play")
        let replayedEmpty = s.replay()
        #expect(!replayedEmpty)
        #expect(s.progress == 0)
    }

    @Test func everyTransitionThatStartsALineBumpsTheToken() {
        var s = PlaybackState()
        s.load(turnCount: 3)
        _ = s.play()
        let a = s.beginTurn()
        let b = s.beginFetch()
        #expect(b > a)
        _ = s.jump(to: 1)
        #expect(s.token > b)
        let c = s.token
        _ = s.replay()
        #expect(s.token > c)
        let stale = s.finishFetch(token: b)
        #expect(!stale)
    }

    // MARK: - E19 curated catalogue

    @Test func everyCuratedIdIsAWellFormedUniqueYouTubeId() {
        var seen: Set<String> = []
        for (category, entries) in WatchCatalog.curatedEntries {
            #expect(WatchCatalog.categories.contains { $0.id == category }, "curated category \(category) exists")
            for entry in entries {
                #expect(YouTubeVideoID.isValid(entry.videoId), "\(entry.videoId) is malformed")
                #expect(seen.insert(entry.videoId).inserted, "\(entry.videoId) listed twice")
                #expect(!entry.title.isEmpty && !entry.channel.isEmpty)
            }
        }
    }

    @Test func removedIdsNeverComeBackAndNothingIsSubstituted() {
        // The corrupted id, the placeholder it used to be swapped for, the ids
        // that were not French-learning content, and the Education ids that
        // could not be verified before beta (EM-3).
        let banned = ["kKL5t竹", "dQw4w9WgXcQ", "9bZkp7q19f0", "M7lc1UVf-VE", "e-ORhEE9VVg", "ScMzIvxBSi4",
                      "tQKkR-EBh3E", "0yzZGz5Vg7Y", "5MgBikgcWnY"]
        let all = WatchCatalog.curatedEntries.values.flatMap { $0 }.map(\.videoId)
        for id in banned { #expect(!all.contains(id), "\(id) must not be in the catalogue") }
        for category in WatchCatalog.categories {
            for video in WatchCatalog.curated(for: category.id) {
                #expect(video.thumbnailUrl.contains(video.videoId), "thumbnail is derived from the video's OWN id")
                #expect(!banned.contains(video.videoId))
                #expect(video.views == 0, "curated entries show no invented view counts")
            }
        }
    }

    @Test func categoriesWithoutJustifiedEntriesAreEmptyNotBorrowed() {
        #expect(WatchCatalog.curated(for: "27").isEmpty, "Education ships empty until its ids are verified (EM-3)")
        #expect(WatchCatalog.curated(for: "10").isEmpty, "Music lost every entry it could not justify")
        #expect(WatchCatalog.curated(for: "24").isEmpty)
        #expect(WatchCatalog.curated(for: "17").isEmpty)
        #expect(WatchCatalog.curated(for: "no-such-category").isEmpty, "never falls back to another category")
    }

    @Test func videoIdValidationIsStrict() {
        #expect(YouTubeVideoID.isValid("dQw4w9WgXcQ"))
        #expect(YouTubeVideoID.isValid("a-b_c1D2E3F"))
        #expect(!YouTubeVideoID.isValid("kKL5t竹"))
        #expect(!YouTubeVideoID.isValid("tooshort"))
        #expect(!YouTubeVideoID.isValid("waytoolongid1"))
        #expect(!YouTubeVideoID.isValid("has space 1"))
        #expect(!YouTubeVideoID.isValid(""))
    }

    @Test func isoDurationsParse() {
        #expect(YouTubeDuration.seconds(fromISO: "PT1H2M3S") == 3723)
        #expect(YouTubeDuration.seconds(fromISO: "PT15M") == 900)
        #expect(YouTubeDuration.seconds(fromISO: "PT45S") == 45)
        #expect(YouTubeDuration.seconds(fromISO: nil) == 0)
        #expect(YTVideo(videoId: "a-b_c1D2E3F", title: "", channel: "", thumbnailUrl: "", durationSeconds: 3723, views: 1_500).durationLabel == "1:02:03")
        #expect(YTVideo(videoId: "a-b_c1D2E3F", title: "", channel: "", thumbnailUrl: "", durationSeconds: 0, views: 0).viewsLabel == "")
    }

    // MARK: - Level-aware shelf

    @Test func shelfOrdersTheLearnersBandFirstThenEasierThenStretch() {
        let items = [
            dialogue([("A", "a", "a")], difficulty: .advanced),
            dialogue([("A", "b", "b")], difficulty: .beginner),
            dialogue([("A", "c", "c")], difficulty: .intermediate),
            dialogue([("A", "d", "d")], difficulty: .beginner),
        ]
        let ordered = ListeningShelf.ordered(items, learnerLevel: .B1)
        #expect(ordered.map(\.difficulty) == [.intermediate, .beginner, .beginner, .advanced])
        #expect(ordered[1].turns[0].french == "b" && ordered[2].turns[0].french == "d", "stable within a group")
        #expect(ListeningShelf.fit(.beginner, learnerLevel: .A1) == .atLevel)
        #expect(ListeningShelf.fit(.beginner, learnerLevel: .A2) == .atLevel)
        #expect(ListeningShelf.fit(.intermediate, learnerLevel: .A2) == .stretch)
        #expect(ListeningShelf.fit(.beginner, learnerLevel: .C2) == .easy)
        #expect(ListeningShelf.recommendedDifficulty(for: .C1) == .advanced)
        #expect(ListeningShelf.ordered(ListeningData.items, learnerLevel: .A1).first?.difficulty == .beginner)
    }

    @Test func difficultyBandsCoverEveryLevelExactlyOnce() {
        let covered = ListeningDifficulty.allCases.flatMap(\.cefrLevels)
        #expect(Set(covered) == Set(CEFRLevel.allCases))
        #expect(covered.count == CEFRLevel.allCases.count)
        #expect(ListeningDifficulty.beginner.captureLevel == .A1)
        #expect(ListeningDifficulty.advanced.captureLevel == .C1)
    }

    // MARK: - Bundled dialogues stay sound

    @Test func bundledDialoguesHaveUniqueIdsAndCompleteTurns() {
        var ids: Set<String> = []
        for item in ListeningData.items {
            #expect(ids.insert(item.id).inserted, "duplicate listening id \(item.id)")
            #expect(!item.turns.isEmpty)
            for turn in item.turns {
                #expect(!turn.french.trimmingCharacters(in: .whitespaces).isEmpty)
                #expect(!turn.english.trimmingCharacters(in: .whitespaces).isEmpty)
                #expect(["A", "B", "narrator"].contains(turn.speaker))
                #expect(!turn.french.contains("Je hésite"), "E24: elision fixed in content")
            }
        }
    }

    // MARK: - E26 failure vocabulary and bounded wait

    @Test func transportErrorsClassifyAsOfflineOrService() {
        #expect(MediaServiceFailure.classify(URLError(.notConnectedToInternet)) == .offline)
        #expect(MediaServiceFailure.classify(URLError(.cannotFindHost)) == .offline)
        #expect(MediaServiceFailure.classify(URLError(.timedOut)) == .serviceError)
        #expect(MediaServiceFailure.classify(NSError(domain: "x", code: 1)) == .serviceError)
        #expect(MediaServiceFailure.classify(statusCode: 200) == nil)
        #expect(MediaServiceFailure.classify(statusCode: 429) == .serviceError)
        #expect(!MediaServiceFailure.noKey.isRetryable)
        #expect(MediaServiceFailure.offline.isRetryable)
    }

    @Test func everyFailureHasLearnerFacingCopyWithNoToolNames() {
        for failure in [MediaServiceFailure.noKey, .offline, .serviceError] {
            let strings = [
                VideoFeedCopy.title(failure), VideoFeedCopy.message(failure),
                VideoFeedCopy.searchTitle(failure), VideoFeedCopy.searchMessage(failure),
                VideoFeedCopy.curatedLabel, VideoFeedCopy.unavailableLabel, VideoFeedCopy.emptyCategory,
                TranscriptCopy.title(failure), TranscriptCopy.message(failure),
                TranscriptCopy.coverageFootnote(.english(.failed(failure))) ?? "",
                TranscriptCopy.coverageFootnote(.partlyEnglish(englishLines: 3, stop: .failed(failure))) ?? "",
                TranscriptCopy.coverageFootnote(.partlyEnglish(englishLines: 1, stop: .outOfTime)) ?? "",
                TranscriptCopy.coverageFootnote(.translating(done: 2, total: 9)) ?? "",
                SystemVoiceReason(failure).notice,
            ]
            for s in strings {
                #expect(!s.isEmpty)
                for leak in ["Rork", "Supadata", "ElevenLabs", "OpenRouter", "YouTube API"] {
                    #expect(!s.contains(leak), "\(s) leaks \(leak)")
                }
            }
        }
        #expect(VoiceSource.natural.notice == nil)
        #expect(VoiceSource.system(.skippedWait).notice == SystemVoiceReason.skippedWait.notice)
        #expect(VoiceSource.system(.noKey).label != VoiceSource.natural.label)
    }

    @Test func deadlineReturnsTheValueInTimeAndNilWhenLate() async {
        let fast = await Deadline.run(seconds: 2) { 42 }
        #expect(fast == 42)
        let late = await Deadline.run(seconds: 0.05) { () -> Int in
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            return 1
        }
        #expect(late == nil)
    }

    // MARK: - Transcript text

    @Test func transcriptTextHelpers() {
        #expect(TranscriptText.cleanHTML("<i>Bonjour</i> &amp; bienvenue\n&#39;ok&#39;") == "Bonjour & bienvenue 'ok'")
        #expect(TranscriptText.parseNumberedLine("[3] Salut tout le monde")?.index == 3)
        #expect(TranscriptText.parseNumberedLine("[3] Salut tout le monde")?.text == "Salut tout le monde")
        #expect(TranscriptText.parseNumberedLine("[x] nope") == nil)
        #expect(TranscriptText.parseNumberedLine("[4]") == nil)
        let segments = [
            TranscriptSegment(id: "a", text: "a", start: 0, duration: 2),
            TranscriptSegment(id: "b", text: "b", start: 2, duration: 2),
            TranscriptSegment(id: "c", text: "c", start: 4, duration: 2),
        ]
        #expect(TranscriptText.activeIndex(in: segments, at: 0) == 0)
        #expect(TranscriptText.activeIndex(in: segments, at: 3.5) == 1)
        #expect(TranscriptText.activeIndex(in: segments, at: 99) == 2)
        #expect(TranscriptText.activeIndex(in: segments, at: -1) == -1)
        #expect(TranscriptText.activeIndex(in: [], at: 5) == -1)
    }

    // MARK: - EM-1 / EM-2 English captions → French, outside the fetch budget

    private func englishLines(_ count: Int) -> [TranscriptSegment] {
        (0..<count).map { TranscriptSegment(id: "e\($0)", text: "english \($0)", start: Double($0), duration: 1, language: .english) }
    }

    /// A translator that answers every batch correctly, advancing the fake
    /// clock by `delay` seconds per call (so timing is deterministic even when
    /// the suite runs under load).
    private func echoTranslator(delay: TimeInterval = 0, clock: FakeClock? = nil, calls: CallCounter) -> TranscriptTranslation.Translator {
        { numbered in
            await calls.bump()
            clock?.advance(by: delay)
            let reply = numbered.split(separator: "\n").compactMap { line -> String? in
                guard let match = TranscriptText.parseNumberedLine(String(line)) else { return nil }
                return "[\(match.index)] français \(match.index)"
            }.joined(separator: "\n")
            return .success(reply)
        }
    }

    @Test func theEnglishFallbackResultKeepsTheLinesTaggedEnglish() {
        let lines = englishLines(3)
        let result = TranscriptResult.segments(lines, language: .english)
        guard case .segments(let got, let language) = result else { Issue.record("expected segments"); return }
        #expect(language == .english)
        #expect(got.allSatisfy { $0.language == .english })
        #expect(TranscriptSegment(id: "x", text: "x", start: 0, duration: 1).language == .french, "lines default to French")
        #expect(got[0].translated("bonjour").language == .french)
        #expect(got[0].translated("bonjour").id == "e0" && got[0].translated("bonjour").start == 0)
        #expect(TranscriptCoverage.of(got, finished: true, stop: .failed(.noKey)) == .english(.failed(.noKey)))
        #expect(TranscriptCoverage.of(got, finished: false, stop: nil) == .translating(done: 0, total: 3))
        #expect(TranscriptCoverage.of([got[0].translated("a"), got[1], got[2]], finished: true, stop: nil)
                == .partlyEnglish(englishLines: 2, stop: .outOfTime), "stopping without a failure is out of time")
        #expect(TranscriptCoverage.of(got.map { $0.translated("fr") }, finished: true, stop: nil) == .french)
        #expect(TranscriptCoverage.of([], finished: false, stop: nil) == .french)
    }

    @Test func aLongEnglishTranscriptWithASlowTranslatorStillYieldsEveryLine() async {
        let lines = englishLines(100)
        let calls = CallCounter()
        let clock = FakeClock()
        var snapshots: [TranscriptTranslationProgress] = []
        // Each batch "takes" 15 s of a 45 s budget: exactly three land.
        for await progress in TranscriptTranslation.stream(
            lines, batchSize: 10, maxBatches: 100, budget: 45, maxConsecutiveFailures: 2,
            translator: echoTranslator(delay: 15, clock: clock, calls: calls),
            now: { clock.now }
        ) {
            snapshots.append(progress)
        }
        guard let final = snapshots.last else { Issue.record("no final snapshot"); return }
        #expect(final.segments.count == 100, "the lines are never dropped into a failure")
        #expect(final.segments.map(\.id) == lines.map(\.id))
        let translated = final.segments.filter { $0.language == .french }.count
        #expect(translated == 30, "the batches that landed before the budget ran out (\(translated))")
        if case .partlyEnglish(let englishLines, let stop) = final.coverage {
            #expect(englishLines == 100 - translated)
            #expect(stop == .outOfTime)
            #expect(final.coverage.isRetryable)
        } else {
            Issue.record("expected partlyEnglish, got \(final.coverage)")
        }
        #expect(snapshots.count == 4, "a snapshot per batch, then the final one")
        #expect(snapshots.dropLast().allSatisfy { $0.coverage.isTranslating })
        #expect(snapshots[0].coverage == .translating(done: 10, total: 100))
        let made = await calls.count
        #expect(made == 3, "the pass stopped at the budget instead of running every batch (\(made))")
    }

    @Test func noTranslationKeyIsReportedNotSkipped() async {
        let calls = CallCounter()
        let final = await TranscriptTranslation.run(
            englishLines(25), batchSize: 10, maxBatches: 10, budget: 600, maxConsecutiveFailures: 2,
            translator: { _ in await calls.bump(); return .failure(.noKey) }
        )
        #expect(final.coverage == .english(.failed(.noKey)))
        #expect(!final.coverage.isRetryable)
        #expect(final.segments.allSatisfy { $0.language == .english })
        #expect(final.segments.count == 25)
        let made = await calls.count
        #expect(made == 1, "a missing key stops the pass immediately")
        #expect(TranscriptCopy.coverageFootnote(.english(.failed(.noKey)))?.contains("isn't available in this build") == true)
    }

    @Test func unreadableRepliesAndServiceErrorsCountAsFailuresAndStopThePass() async {
        let calls = CallCounter()
        let garbage = await TranscriptTranslation.run(
            englishLines(50), batchSize: 10, maxBatches: 10, budget: 600, maxConsecutiveFailures: 2,
            translator: { _ in await calls.bump(); return .success("Sure! Here are the lines.") }
        )
        #expect(garbage.coverage == .english(.failed(.serviceError)), "an answer in the wrong shape is a failure, not silence")
        let garbageCalls = await calls.count
        #expect(garbageCalls == 2, "two unreadable batches in a row end the pass")

        let flaky = CallCounter()
        let mixed = await TranscriptTranslation.run(
            englishLines(30), batchSize: 10, maxBatches: 10, budget: 600, maxConsecutiveFailures: 2,
            translator: { numbered in
                let n = await flaky.bump()
                if n == 1 { return .failure(.serviceError) }
                let reply = numbered.split(separator: "\n").compactMap { line -> String? in
                    guard let m = TranscriptText.parseNumberedLine(String(line)) else { return nil }
                    return "[\(m.index)] fr \(m.index)"
                }.joined(separator: "\n")
                return .success(reply)
            }
        )
        #expect(mixed.coverage == .partlyEnglish(englishLines: 10, stop: .failed(.serviceError)),
                "one failed batch keeps its lines English while the rest translate, and the footnote names the service")
        #expect(mixed.segments.prefix(10).allSatisfy { $0.language == .english })
        #expect(mixed.segments.dropFirst(10).allSatisfy { $0.language == .french })

        let offline = await TranscriptTranslation.run(
            englishLines(30), batchSize: 10, maxBatches: 10, budget: 600, maxConsecutiveFailures: 5,
            translator: { _ in .failure(.offline) }
        )
        #expect(offline.coverage == .english(.failed(.offline)), "offline stops on the first failure")
    }

    @Test func theBatchCapLeavesTheRestEnglishAndSaysSo() async {
        let calls = CallCounter()
        let final = await TranscriptTranslation.run(
            englishLines(30), batchSize: 10, maxBatches: 1, budget: 600, maxConsecutiveFailures: 2,
            translator: echoTranslator(calls: calls)
        )
        #expect(final.coverage == .partlyEnglish(englishLines: 20, stop: .outOfTime))
        #expect(final.segments.prefix(10).allSatisfy { $0.language == .french && $0.text.hasPrefix("français") })
        #expect(final.segments.dropFirst(10).allSatisfy { $0.language == .english })
        let made = await calls.count
        #expect(made == 1)

        let complete = await TranscriptTranslation.run(
            englishLines(30), batchSize: 10, maxBatches: 3, budget: 600, maxConsecutiveFailures: 2,
            translator: echoTranslator(calls: calls)
        )
        #expect(complete.coverage == .french)
        #expect(TranscriptCopy.coverageFootnote(.french) == nil)
    }

    @Test func aReplyOnlyTouchesItsOwnBatch() {
        var lines = englishLines(6)
        let batches = TranscriptTranslation.batches(of: lines, size: 4)
        #expect(batches == [[0, 1, 2, 3], [4, 5]])
        #expect(TranscriptTranslation.numbered(lines, indices: [4, 5]) == "[4] english 4\n[5] english 5")
        let applied = TranscriptTranslation.apply(reply: "[4] quatre\n[0] zéro\n[9] neuf\n[5]\nnoise", to: &lines, indices: [4, 5])
        #expect(applied == 1, "only [4] is in the batch and well formed")
        #expect(lines[4].text == "quatre" && lines[4].language == .french)
        #expect(lines[0].text == "english 0" && lines[0].language == .english, "a line outside the batch is untouched")
        #expect(TranscriptTranslation.batches(of: lines, size: 4) == [[0, 1, 2, 3], [5]], "already-French lines are not re-sent")
        #expect(TranscriptTranslation.batches(of: [], size: 4).isEmpty)
    }
}

/// A clock the translator advances by hand, so the budget check is deterministic.
private nonisolated final class FakeClock: @unchecked Sendable {
    private let lock = NSLock()
    private var offset: TimeInterval = 0
    private let origin = Date(timeIntervalSince1970: 1_700_000_000)
    var now: Date { lock.lock(); defer { lock.unlock() }; return origin.addingTimeInterval(offset) }
    func advance(by seconds: TimeInterval) { lock.lock(); defer { lock.unlock() }; offset += seconds }
}

/// Counts translator calls from `@Sendable` closures.
private actor CallCounter {
    private(set) var count = 0
    @discardableResult
    func bump() -> Int { count += 1; return count }
}
