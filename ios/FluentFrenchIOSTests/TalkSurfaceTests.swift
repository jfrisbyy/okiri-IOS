//
//  TalkSurfaceTests.swift
//  FluentFrenchIOSTests
//
//  Package E-talk — Converse and Speak: the correction recap builder (what a
//  recap line may save, never the learner's slip), the scenario lock rule,
//  feedback → gaps + evidence, the microphone availability states, the failure
//  vocabulary and the recording caps.
//

import Foundation
import Testing
@testable import FluentFrenchIOS
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

@MainActor
struct TalkSurfaceTests {
    private let now = EngineFixtures.now

    private func tutor(_ french: String, english: String = "en", correction: String? = nil,
                       corrected: String? = nil, correctedEnglish: String? = nil, conceptId: String? = nil) -> ChatTurn {
        ChatTurn(role: .tutor, french: french, english: english, correction: correction,
                 correctedFrench: corrected, correctedEnglish: correctedEnglish, conceptId: conceptId)
    }

    private func learner(_ french: String) -> ChatTurn {
        ChatTurn(role: .user, french: french, english: "", correction: nil)
    }

    // MARK: E10 — corrections recap

    @Test func correctionsPairEachTutorFixWithThePrecedingLearnerLine() {
        let transcript = [
            tutor("t-greeting"),
            learner("slip-1"),
            tutor("t-reply-1", correction: "note-1", corrected: "fixed-1", conceptId: "c1"),
            learner("fine-2"),
            tutor("t-reply-2", correction: nil, corrected: "fine-2"),          // unchanged → not a correction
            learner("slip-3"),
            tutor("t-reply-3", correction: "note-3", corrected: "  Fixed-3.  "), // whitespace / case / punctuation only differ
        ]
        let corrections = ConverseRecap.corrections(in: transcript)
        #expect(corrections.map(\.originalFrench) == ["slip-1", "slip-3"])
        #expect(corrections.map(\.correctedFrench) == ["fixed-1", "Fixed-3."])
        #expect(corrections[0].explanation == "note-1")
        #expect(corrections[0].conceptId == "c1")
        #expect(corrections[0].id == transcript[2].id, "keyed by the tutor turn so recap renders are stable")
    }

    @Test func aCorrectionThatOnlyRestatesTheLearnerIsDropped() {
        let transcript = [learner("Bonjour"), tutor("t", corrected: "bonjour !")]
        #expect(ConverseRecap.corrections(in: transcript).isEmpty)
    }

    // MARK: E9 — what a recap line may save

    @Test func tutorLinesSaveAsSaidAndLearnerLinesSaveOnlyTheCorrection() {
        let transcript = [
            tutor("t-1", english: "e-1"),
            learner("slip"),
            tutor("t-2", correction: "note", corrected: "fixed"),
            learner("fine"),
            tutor("t-3"),
        ]
        #expect(ConverseRecap.saveCandidate(for: transcript[0], in: transcript) == .tutorPhrase(french: "t-1", english: "e-1"))
        if case .correction(let c)? = ConverseRecap.saveCandidate(for: transcript[1], in: transcript) {
            #expect(c.correctedFrench == "fixed")
            #expect(c.originalFrench == "slip")
        } else {
            Issue.record("a corrected learner line offers the correction")
        }
        #expect(ConverseRecap.saveCandidate(for: transcript[3], in: transcript) == nil,
                "an uncorrected learner line offers nothing — never the learner's own French")
    }

    @Test func notesWithoutARewriteAreShownButUnsavable() {
        let transcript = [learner("x"), tutor("t", correction: "older shape note")]
        #expect(ConverseRecap.corrections(in: transcript).isEmpty)
        #expect(ConverseRecap.unsavableNotes(in: transcript) == ["older shape note"])
    }

    // MARK: Reply parsing

    @Test func replyParserToleratesTheOlderShapeAndValidatesConceptIds() {
        let concepts = [EngineFixtures.concept("c1")]
        let old = ConverseReplyParser.parse(#"{"french":"Salut","english":"Hi","correction":"note"}"#, concepts: concepts)
        #expect(old?.french == "Salut")
        #expect(old?.correction == "note")
        #expect(old?.correctedFrench == nil)

        let new = ConverseReplyParser.parse(
            #"Sure! {"french":"F","english":"E","correction":"","correctedFrench":"CF","correctedEnglish":"CE","conceptId":"made-up"}"#,
            concepts: concepts)
        #expect(new?.correction == nil)
        #expect(new?.correctedFrench == "CF")
        #expect(new?.correctedEnglish == "CE")
        #expect(new?.conceptId == nil, "an invented concept id never survives parsing")

        let known = ConverseReplyParser.parse(#"{"french":"F","english":"E","conceptId":" c1 "}"#, concepts: concepts)
        #expect(known?.conceptId == "c1")
        #expect(ConverseReplyParser.parse("no json here", concepts: concepts) == nil)
        #expect(ConverseReplyParser.parse(#"{"french":"   ","english":"E"}"#, concepts: concepts) == nil)
    }

    // MARK: E12 — scenario lock rule

    @Test func scenarioLockUsesSpeakingReadinessAndLevel() {
        #expect(ConverseScenarioGate.lockReason(required: .A1, learner: .B2, readiness: .locked) == .speakingNotReady)
        #expect(ConverseScenarioGate.lockReason(required: .A1, learner: .B2, readiness: .foundation) == .speakingNotReady,
                "the bridge state is not open for live speaking")
        #expect(ConverseScenarioGate.lockReason(required: .B1, learner: .A2, readiness: .unlocked) == .aboveLevel(.B1))
        #expect(ConverseScenarioGate.lockReason(required: .A2, learner: .A2, readiness: .unlocked) == nil)
        #expect(ConverseScenarioGate.lockReason(required: .A1, learner: .C1, readiness: .unlocked) == nil)
        #expect(ConverseLockReason.aboveLevel(.B1).message.contains("B1"))
    }

    @Test func storeReadinessLocksScenariosForAFreshLearner() {
        let store = EngineFixtures.store()
        let readiness = store.readiness(for: .speaking)
        #expect(readiness == .locked)
        #expect(ConverseScenarioGate.lockReason(required: .A1, learner: store.learnerLevel, readiness: readiness) == .speakingNotReady)
    }

    // MARK: E13 — feedback → gaps

    @Test func feedbackParserKeepsOnlyTaxonomyConceptsAndCapsThem() {
        let concepts = ["c1", "c2", "c3", "c4"].map { EngineFixtures.concept($0) }
        let raw = """
        ```json
        {"corrected":"C","note":"N","natural":"Nat","score":142.4,
         "mistakeConcepts":["c1","ghost","c1","c2","c3","c4"],"strongConcepts":["c2","c4"]}
        ```
        """
        let f = SpeakFeedbackParser.parse(raw, concepts: concepts, maxConcepts: 3)
        #expect(f?.score == 100)
        #expect(f?.mistakeConceptIds == ["c1", "c2", "c3"])
        #expect(f?.strongConceptIds == ["c4"], "a concept is never both wrong and strong in one line")
        #expect(f?.correctedEnglish == "" && f?.naturalEnglish == "", "no English in the reply → none invented")
        #expect(SpeakFeedbackParser.parse(#"{"corrected":"","note":"n"}"#, concepts: concepts) == nil)
        #expect(SpeakFeedbackParser.parse(#"{"corrected":"C"}"#, concepts: concepts)?.score == 0)

        let withEnglish = SpeakFeedbackParser.parse(
            #"{"corrected":"C","correctedEnglish":" I am well. ","natural":"Nat","naturalEnglish":"Doing fine.","score":50}"#,
            concepts: concepts)
        #expect(withEnglish?.correctedEnglish == "I am well.")
        #expect(withEnglish?.naturalEnglish == "Doing fine.")
    }

    @Test func gapPlanCarriesTheFeedbacksEnglishOntoEachGap() {
        let full = SpeakFeedback(corrected: "fixed", note: "", natural: "smoother", score: 60,
                                 correctedEnglish: "fixed-en", naturalEnglish: "smoother-en")
        let specs = SpeakGapPlan.specs(original: "slip", feedback: full)
        #expect(specs.map(\.english) == ["fixed-en", "smoother-en"])

        let onlyCorrected = SpeakFeedback(corrected: "fixed", note: "", natural: "smoother", score: 60,
                                          correctedEnglish: "fixed-en")
        #expect(SpeakGapPlan.specs(original: "slip", feedback: onlyCorrected).map(\.english) == ["fixed-en", "fixed-en"],
                "the natural phrasing means the same thing, so the corrected line's English stands in")

        let none = SpeakFeedback(corrected: "fixed", note: "", natural: "smoother", score: 60)
        #expect(SpeakGapPlan.specs(original: "slip", feedback: none).map(\.english) == ["", ""])
    }

    @Test func gapPlanNeverSavesTheLearnersUnchangedLine() {
        let same = SpeakFeedback(corrected: "Je vais bien.", note: "", natural: "je vais bien", score: 90)
        #expect(SpeakGapPlan.specs(original: "Je vais bien", feedback: same).isEmpty)

        let fixed = SpeakFeedback(corrected: "fixed", note: "why", natural: "fixed!", score: 60, mistakeConceptIds: ["c1"])
        let specs = SpeakGapPlan.specs(original: "slip", feedback: fixed)
        #expect(specs.map(\.kind) == [.corrected], "a natural line equal to the correction is not a second gap")
        #expect(specs[0].french == "fixed")
        #expect(specs[0].originalFrench == "slip")
        #expect(specs[0].explanation == "why")
        #expect(specs[0].conceptId == "c1")

        let both = SpeakFeedback(corrected: "fixed", note: "", natural: "smoother", score: 60)
        #expect(SpeakGapPlan.specs(original: "slip", feedback: both).map(\.kind) == [.corrected, .natural])
    }

    @Test func storeRecordsFeedbackAsScheduledGapsAndConceptEvidence() throws {
        let store = EngineFixtures.store(concepts: [EngineFixtures.concept("c1"), EngineFixtures.concept("c2")], gaps: [])
        let alphaBefore = store.concept("c2")!.alpha
        let betaBefore = store.concept("c1")!.beta
        let feedback = SpeakFeedback(corrected: "fixed", note: "why", natural: "smoother", score: 55,
                                     mistakeConceptIds: ["c1", "ghost"], strongConceptIds: ["c2"])
        let outcome = store.recordSpeakFeedback(original: "slip", feedback: feedback, promptText: "prompt", now: now)

        #expect(outcome.savedCount == 2)
        #expect(outcome.duplicateCount == 0)
        #expect(outcome.missedConceptIds == ["c1"], "an unknown id records nothing")
        #expect(outcome.strongConceptIds == ["c2"])
        #expect(store.gaps.count == 2)
        #expect(!store.gaps.contains { $0.frenchWord == "slip" }, "the learner's slip is never a gap")

        let corrected = try #require(store.gaps.first { $0.frenchWord == "fixed" })
        #expect(corrected.fsrs != nil, "captured through the factory: scheduled from day one")
        #expect(corrected.needsTranslation, "no English from the model → the gap waits for a translation")
        #expect(corrected.englishTranslation.isEmpty)
        #expect(store.pendingTranslations.map(\.id).contains(corrected.id))
        #expect(corrected.sourceType == .speech)
        #expect(corrected.conceptId == "c1")
        #expect(corrected.reviewCount == 1, "the corrected line starts with the miss the learner just made")
        #expect(corrected.originalContext?.sentence == "slip")
        #expect(corrected.originalContext?.sourceTab == "speak")
        // talkmedia-3-1: "slip" is the learner's own transcribed line. Flagged so
        // the deck card shows it as what they said, never as French "seen in the
        // wild", and so the tagger is not told it is an example of "fixed".
        #expect(corrected.originalContext?.isLearnerAuthored == true)
        #expect(corrected.contextForTagging == corrected.exampleSentence)
        #expect(corrected.contextForTagging != "slip")
        #expect(corrected.explanation == "why · Prompt: prompt", "the prompt the learner answered stays on the card")

        let natural = try #require(store.gaps.first { $0.frenchWord == "smoother" })
        #expect(natural.reviewCount == 0, "the natural phrasing is new material, not a miss")
        #expect(natural.originalContext?.isLearnerAuthored == true, "its context is the learner's line too")
        #expect(natural.explanation.hasSuffix("Prompt: prompt"))

        #expect(store.concept("c1")!.beta > betaBefore, "a named mistake is a miss on the concept")
        #expect(store.concept("c2")!.alpha > alphaBefore, "a named strength is a hit on the concept")
    }

    @Test func storeKeepsTheMeaningTheFeedbackSuppliesSoCardsHaveAnAnswer() throws {
        let store = EngineFixtures.store(concepts: [EngineFixtures.concept("c1")], gaps: [])
        let feedback = SpeakFeedback(corrected: "fixed", note: "why", natural: "smoother", score: 55,
                                     correctedEnglish: "fixed-en", naturalEnglish: "smoother-en")
        let outcome = store.recordSpeakFeedback(original: "slip", feedback: feedback, promptText: "", now: now)
        #expect(outcome.savedCount == 2)

        let corrected = try #require(store.gaps.first { $0.frenchWord == "fixed" })
        #expect(corrected.englishTranslation == "fixed-en")
        #expect(corrected.exampleTranslation == "fixed-en")
        #expect(!corrected.needsTranslation)
        #expect(corrected.explanation == "why", "no prompt → nothing appended")

        let natural = try #require(store.gaps.first { $0.frenchWord == "smoother" })
        #expect(natural.englishTranslation == "smoother-en")
        #expect(!natural.needsTranslation)
        #expect(store.pendingTranslations.isEmpty, "nothing is left waiting for a translation")
        #expect(outcome.savedGaps.allSatisfy { !$0.englishTranslation.isEmpty })
    }

    @Test func speakGapExplanationAppendsThePromptOnlyWhenThereIsOne() {
        #expect(AppStore.speakGapExplanation("why", promptText: "  ") == "why")
        #expect(AppStore.speakGapExplanation("why", promptText: "Décrivez votre matin") == "why · Prompt: Décrivez votre matin")
        #expect(AppStore.speakGapExplanation("", promptText: "P") == "Prompt: P")
    }

    @Test func storeDoesNotDuplicateAGapTheFeedbackNamesTwice() {
        let store = EngineFixtures.store(concepts: [EngineFixtures.concept("c1")], gaps: [])
        let feedback = SpeakFeedback(corrected: "fixed", note: "", natural: "", score: 50)
        store.recordSpeakFeedback(original: "slip", feedback: feedback, promptText: "", now: now)
        let again = store.recordSpeakFeedback(original: "slip again", feedback: feedback, promptText: "", now: now)
        #expect(again.savedCount == 0)
        #expect(again.duplicateCount == 1)
        #expect(store.gaps.count == 1)
        #expect(store.gaps[0].reviewCount == 2, "a repeated slip is still a miss on the existing gap")
    }

    // MARK: E10 — converse corrections into the store

    @Test func storeSavesTheCorrectionNeverTheSlip() throws {
        let store = EngineFixtures.store(concepts: [EngineFixtures.concept("c1")], gaps: [])
        let transcript = [
            learner("slip-1"),
            tutor("t-1", correction: "note-1", corrected: "fixed-1", correctedEnglish: "en-1", conceptId: "c1"),
            learner("slip-2"),
            tutor("t-2", correction: "note-2", corrected: "fixed-2"),
        ]
        let corrections = ConverseRecap.corrections(in: transcript)
        let saved = store.recordConverseCorrections(corrections, now: now)
        #expect(saved.count == 2)
        #expect(Set(store.gaps.map(\.frenchWord)) == ["fixed-1", "fixed-2"])
        let first = try #require(store.gaps.first { $0.frenchWord == "fixed-1" })
        #expect(first.englishTranslation == "en-1")
        #expect(!first.needsTranslation)
        #expect(first.conceptId == "c1")
        #expect(first.reviewCount == 1)
        let second = try #require(store.gaps.first { $0.frenchWord == "fixed-2" })
        #expect(second.needsTranslation, "no English from the tutor → translation pending, no placeholder")
        #expect(second.englishTranslation.isEmpty)
        #expect(saved[transcript[1].id]?.id == first.id)
    }

    @Test func tutorPhraseCaptureDedupesAndFlagsMissingEnglish() throws {
        let store = EngineFixtures.store()
        #expect(store.captureConversePhrase(french: "t-line", english: "the line", scenarioTitle: "Café", now: now))
        #expect(!store.captureConversePhrase(french: "T-LINE", english: "", scenarioTitle: "Café", now: now), "same headword")
        #expect(!store.captureConversePhrase(french: "   ", english: "", scenarioTitle: "Café", now: now))
        #expect(store.captureConversePhrase(french: "t-other", english: "", scenarioTitle: "Café", now: now))
        let g = try #require(store.gaps.first { $0.frenchWord == "t-line" })
        #expect(!g.needsTranslation)
        #expect(g.fsrs != nil)
        #expect(g.explanation.contains("Café"))
        let other = try #require(store.gaps.first { $0.frenchWord == "t-other" })
        #expect(other.needsTranslation)
    }

    // MARK: E16 — header stats and recording caps

    @Test func minutesThisWeekCoversTheWindowOnly() {
        let store = EngineFixtures.store()
        let day = EngineFixtures.day
        store.recordActivityMinutes(.speaking, minutes: 3, now: now)
        store.recordActivityMinutes(.speaking, minutes: 4, now: now.addingTimeInterval(-day * Double(Tuning.speakStatsWindowDays - 1)))
        store.recordActivityMinutes(.speaking, minutes: 9, now: now.addingTimeInterval(-day * Double(Tuning.speakStatsWindowDays)))
        store.recordActivityMinutes(.reading, minutes: 20, now: now)
        #expect(store.minutesThisWeek(.speaking, now: now) == 7)
        #expect(store.totalMinutes(.speaking) == 16)
    }

    @Test func recordingCapFollowsTheSelectorAndNeverUnbounded() {
        #expect(SpeakRecordingCap.seconds(forMinutes: 3) == 180)
        #expect(SpeakRecordingCap.seconds(forMinutes: 999) == Tuning.speakDefaultDurationMinutes * 60)
        #expect(SpeakRecordingCap.seconds(forMinutes: 0) == Tuning.speakDefaultDurationMinutes * 60)
        #expect(SpeakRecordingCap.countdown(secondsLeft: 90) == "1:30")
        #expect(SpeakRecordingCap.countdown(secondsLeft: -5) == "0:00")
    }

    // MARK: E14 / E26 — mic states and failure vocabulary

    @Test func micAvailabilityIsThreeDistinctClosedStates() {
        #expect(MicAvailability.resolve(hasTranscriptionKey: false, inputAvailable: true, permissionDenied: false) == .transcriptionUnavailable)
        #expect(MicAvailability.resolve(hasTranscriptionKey: false, inputAvailable: false, permissionDenied: true) == .transcriptionUnavailable,
                "without a key the microphone changes nothing")
        #expect(MicAvailability.resolve(hasTranscriptionKey: true, inputAvailable: false, permissionDenied: true) == .noInputDevice)
        #expect(MicAvailability.resolve(hasTranscriptionKey: true, inputAvailable: true, permissionDenied: true) == .permissionDenied)
        #expect(MicAvailability.resolve(hasTranscriptionKey: true, inputAvailable: true, permissionDenied: false) == .ready)
        #expect(MicAvailability.permissionDenied.canOpenSettings)
        #expect(!MicAvailability.transcriptionUnavailable.canOpenSettings)
        for state in [MicAvailability.permissionDenied, .transcriptionUnavailable, .noInputDevice] {
            let copy = state.title + state.message(typedAlternative: "type instead")
            #expect(!copy.lowercased().contains("rork"), "no tool names reach the learner")
            #expect(copy.contains("type instead"))
        }
    }

    @Test func failureVocabularyClassifiesTransportErrors() {
        #expect(TalkServiceFailure.classify(URLError(.notConnectedToInternet)) == .offline)
        #expect(TalkServiceFailure.classify(URLError(.cannotFindHost)) == .offline)
        #expect(TalkServiceFailure.classify(URLError(.timedOut)) == .serviceUnavailable)
        #expect(TalkServiceFailure.classify(NSError(domain: "x", code: 1)) == .serviceUnavailable)
        #expect(TalkServiceFailure.classify(statusCode: 200) == nil)
        #expect(TalkServiceFailure.classify(statusCode: 429) == .serviceUnavailable)
        #expect(!TalkServiceFailure.noKey.isRetryable)
        #expect(TalkServiceFailure.offline.isRetryable)
        #expect(TranscriptionOutcome.nothingHeard.message != nil)
        #expect(TranscriptionOutcome.text("x").message == nil)
        #expect(TranscriptionOutcome.failed(.offline).message == TalkServiceFailure.offline.message)
    }

    // MARK: talkmedia-3-3 — dictation never destroys a typed reply

    @Test func dictationFillsAnEmptyBoxButAppendsToATypedReply() {
        // Empty box (whitespace counts as empty): the spoken line is the reply
        // and Converse sends it, exactly as before.
        #expect(DictationMerge.apply(heard: " Je voudrais un café ", toDraft: "") == .send("Je voudrais un café"))
        #expect(DictationMerge.apply(heard: "Bonjour", toDraft: "   \n ") == .send("Bonjour"))
        #expect(DictationMerge.send("Bonjour").notice == nil, "nothing to explain when the box was empty")

        // A reply already in the box: the words the learner typed survive, the
        // speech is added behind them, and nothing is sent for them.
        let merged = DictationMerge.apply(heard: " un café ", toDraft: "Je voudrais ")
        #expect(merged == .appended("Je voudrais un café"))
        #expect(merged.notice != nil, "the learner is told what happened to their reply")

        // Nothing usable heard: the typed reply is untouched.
        #expect(DictationMerge.apply(heard: "   ", toDraft: "Je voudrais") == .nothing)
        #expect(DictationMerge.apply(heard: "", toDraft: "") == .nothing)
        #expect(DictationMerge.nothing.notice == nil)
    }

    // MARK: talkmedia-4-1 — a correction only ever leaves a card-sized card

    @Test func aShortCorrectionIsKeptWholeAndALongOneIsCutToTheSentencesItChanged() {
        // Already a card: kept exactly, and not marked as shortened (so it keeps
        // the meaning the model wrote for it).
        let short = CorrectionCard.from(original: "Je vais bien", corrected: "Je vais très bien.")
        #expect(short.phrases == ["Je vais très bien."])
        #expect(!short.shortened)

        // Two sentences: only the ones the correction actually changed, each as
        // its own card, and every one of them is something the deck accepts.
        let long = CorrectionCard.from(
            original: "Hier je vais au marché. Je achète du pain. Il fait beau.",
            corrected: "Hier je suis allé au marché. J'ai acheté du pain. Il fait beau.")
        #expect(long.phrases == ["Hier je suis allé au marché.", "J'ai acheté du pain."])
        #expect(long.shortened, "shortened cards carry no meaning of their own — the model's English was for the whole line")
        #expect(!long.phrases.contains("Il fait beau."), "a sentence the learner had right is not a correction")
        #expect(long.phrases.allSatisfy { CaptureBuilder.isAcceptableHeadword($0) })
    }

    @Test func aCorrectionWithNothingCardSizedInItSavesNothing() {
        let words = (1...40).map { "mot\($0)" }.joined(separator: " ")
        let fixed = (1...40).map { "corrige\($0)" }.joined(separator: " ")
        let card = CorrectionCard.from(original: words, corrected: fixed)
        #expect(card.isEmpty, "one 40-word sentence is text, not a card the deck could ever ask about")

        // A sentence longer than a card still yields the words it changed.
        let long = "Le week-end dernier je vais au cinéma avec mes amis pour voir un film."
        let fixedLong = "Le week-end dernier je suis allé au cinéma avec mes amis pour voir un film."
        let trimmed = CorrectionCard.from(original: long, corrected: fixedLong)
        #expect(trimmed.phrases.count == 1)
        #expect(trimmed.phrases[0].contains("suis allé"))
        #expect(CaptureBuilder.isAcceptableHeadword(trimmed.phrases[0]))
        #expect(trimmed.shortened)

        #expect(CorrectionCard.from(original: "x", corrected: "   ").isEmpty)
    }

    @Test func aChangedPhraseKeepsContextAndIgnoresPureDeletions() {
        // A one-word fix is saved with the words around it, never on its own.
        let phrase = CorrectionCard.changedPhrase(from: "Je mange le pomme", to: "Je mange la pomme")
        #expect(phrase == "mange la pomme")
        // Only words removed: what is left is the learner's own French, so there
        // is nothing to save.
        #expect(CorrectionCard.changedPhrase(from: "Je ne sais pas pas", to: "Je ne sais pas") == nil)
        #expect(CorrectionCard.changedPhrase(from: "Bonjour", to: "") == nil)
    }

    @Test func speakPlanDropsACorrectionTooLongForACardAndSaysSo() {
        let monologue = (1...30).map { "mot\($0)" }.joined(separator: " ")
        let corrected = (1...30).map { "corrige\($0)" }.joined(separator: " ")
        let feedback = SpeakFeedback(corrected: corrected, note: "n", natural: corrected + " encore",
                                     score: 40, correctedEnglish: "the whole thing")
        let plan = SpeakGapPlan.plan(original: monologue, feedback: feedback)
        #expect(plan.specs.isEmpty)
        #expect(plan.tooLongToSave, "the learner is told the deck kept nothing")
        #expect(!plan.shortened)
    }

    @Test func aShortenedSpeakCardNeverCarriesTheWholeLinesMeaning() throws {
        let feedback = SpeakFeedback(
            corrected: "Hier je suis allé au marché. J'ai acheté du pain.",
            note: "n",
            natural: "Hier je suis allé au marché. J'ai acheté du pain.",
            score: 60,
            correctedEnglish: "Yesterday I went to the market. I bought bread.")
        let plan = SpeakGapPlan.plan(original: "Hier je vais au marché. Je achète du pain.", feedback: feedback)
        #expect(plan.shortened)
        #expect(plan.specs.count == Tuning.maxCorrectionCards)
        #expect(plan.specs.allSatisfy { $0.kind == .corrected })
        #expect(plan.specs.allSatisfy { $0.english.isEmpty },
                "the English described the whole answer, so a piece of it waits for its own lookup")
        #expect(plan.specs.allSatisfy { CaptureBuilder.isAcceptableHeadword($0.french) })
    }

    @Test func storeNeverSavesAMonologueAsOneCard() {
        let store = EngineFixtures.store(concepts: [EngineFixtures.concept("c1")], gaps: [])
        let monologue = (1...30).map { "mot\($0)" }.joined(separator: " ")
        let corrected = (1...30).map { "corrige\($0)" }.joined(separator: " ")
        let feedback = SpeakFeedback(corrected: corrected, note: "n", natural: "", score: 40,
                                     mistakeConceptIds: ["c1"])
        let outcome = store.recordSpeakFeedback(original: monologue, feedback: feedback, promptText: "", now: now)
        #expect(outcome.savedCount == 0)
        #expect(outcome.tooLongToSave)
        #expect(store.gaps.isEmpty, "a five-minute monologue is not a card")
        #expect(outcome.missedConceptIds == ["c1"], "the concepts the feedback named are still evidence")
        #expect(store.gaps.allSatisfy { CaptureBuilder.isAcceptableHeadword($0.frenchWord) })
    }

    @Test func storeSavesTheCorrectedSentencesOfALongAnswer() throws {
        let store = EngineFixtures.store(concepts: [], gaps: [])
        let feedback = SpeakFeedback(corrected: "Hier je suis allé au marché. J'ai acheté du pain.",
                                     note: "n", natural: "", score: 60,
                                     correctedEnglish: "Yesterday I went to the market. I bought bread.")
        let outcome = store.recordSpeakFeedback(original: "Hier je vais au marché. Je achète du pain.",
                                                feedback: feedback, promptText: "", now: now)
        #expect(outcome.savedCount == 2)
        #expect(outcome.shortened)
        #expect(store.gaps.allSatisfy { CaptureBuilder.isAcceptableHeadword($0.frenchWord) })
        #expect(store.gaps.allSatisfy { $0.needsTranslation && $0.englishTranslation.isEmpty },
                "no card claims the whole answer's meaning as its own")
        let first = try #require(store.gaps.first { $0.frenchWord == "Hier je suis allé au marché." })
        #expect(first.reviewCount == 1, "each correction the learner missed starts as a miss")
    }

    // MARK: talkmedia-4-4 — one attempt is one attempt

    @Test func resubmittingTheSameAnswerRecordsNothingASecondTime() throws {
        let store = EngineFixtures.store(concepts: [EngineFixtures.concept("c1")], gaps: [])
        let feedback = SpeakFeedback(corrected: "fixed", note: "", natural: "", score: 50,
                                     mistakeConceptIds: ["c1"])
        let first = store.recordSpeakFeedback(original: "slip", feedback: feedback, promptText: "", now: now)
        #expect(first.savedCount == 1)
        let beta = store.concept("c1")!.beta
        let gap = try #require(store.gaps.first)
        #expect(gap.reviewCount == 1)

        let again = store.recordSpeakFeedback(original: "slip", feedback: feedback, promptText: "", now: now.addingTimeInterval(20))
        #expect(again.repeatedSubmission)
        #expect(again.savedCount == 0 && again.duplicateCount == 0)
        #expect(store.gaps.first?.reviewCount == 1, "one attempt never becomes two lapses")
        #expect(store.concept("c1")!.beta == beta, "nor two misses on the concept")

        // A genuine second attempt (later, or different words) is recorded again.
        let later = store.recordSpeakFeedback(original: "slip", feedback: feedback, promptText: "",
                                              now: now.addingTimeInterval(Tuning.speakFeedbackRepeatWindow + 1))
        #expect(!later.repeatedSubmission)
        #expect(store.gaps.first?.reviewCount == 2)
    }

    // MARK: talkmedia-4-1 — Converse

    @Test func aTutorLineTooLongForACardIsNotOfferedForSaving() {
        let greeting = tutor("Bonjour ! Bienvenue au café. Que désirez-vous ?", english: "Hi there.")
        let transcript = [greeting]
        #expect(ConverseRecap.saveCandidate(for: greeting, in: transcript) == .tooLongForACard)
        let store = EngineFixtures.store(concepts: [], gaps: [])
        #expect(!store.captureConversePhrase(french: greeting.french, english: greeting.english,
                                             scenarioTitle: "Café", now: now))
        #expect(store.gaps.isEmpty)

        let short = tutor("Que désirez-vous ?", english: "What would you like?")
        #expect(ConverseRecap.saveCandidate(for: short, in: [short]) == .tutorPhrase(french: "Que désirez-vous ?",
                                                                                     english: "What would you like?"))
        #expect(store.captureConversePhrase(french: short.french, english: short.english, scenarioTitle: "Café", now: now))
    }

    @Test func aLongTutorCorrectionKeepsItsEvidenceEvenWhenNoCardFits() {
        let store = EngineFixtures.store(concepts: [EngineFixtures.concept("c1")], gaps: [])
        let betaBefore = store.concept("c1")!.beta
        let slip = (1...30).map { "mot\($0)" }.joined(separator: " ")
        let fixed = (1...30).map { "corrige\($0)" }.joined(separator: " ")
        #expect(store.recordConverseCorrection(originalFrench: slip, correctedFrench: fixed, explanation: "e",
                                               conceptId: "c1", englishTranslation: "the whole line", now: now) == nil)
        #expect(store.gaps.isEmpty, "no unanswerable card")
        #expect(store.concept("c1")!.beta > betaBefore, "the slip still counts against the concept")
    }

    @Test func aShortenedTutorCorrectionWaitsForItsOwnMeaning() throws {
        let store = EngineFixtures.store(concepts: [], gaps: [])
        let gap = try #require(store.recordConverseCorrection(
            originalFrench: "Hier je vais au marché avec mes amis pour acheter du pain.",
            correctedFrench: "Hier je suis allé au marché avec mes amis pour acheter du pain.",
            explanation: "e", conceptId: nil, englishTranslation: "Yesterday I went to the market with my friends to buy bread.",
            now: now))
        #expect(CaptureBuilder.isAcceptableHeadword(gap.frenchWord))
        #expect(gap.frenchWord.contains("suis allé"))
        #expect(gap.needsTranslation && gap.englishTranslation.isEmpty,
                "the tutor's English was for the whole line, not for the piece that was kept")
        #expect(gap.exampleSentence.hasPrefix("Hier je suis allé"), "the whole corrected line stays as the example")
    }

    // MARK: talkmedia-4-3 — an interrupted recording is announced, never silently graded

    @Test func anInterruptedRecordingSaysHowMuchWasCaptured() {
        #expect(!InterruptedRecording.isWorthTranscribing(secondsCaptured: 0))
        #expect(!InterruptedRecording.isWorthTranscribing(secondsCaptured: Tuning.minimumUsableRecordingSeconds - 1))
        #expect(InterruptedRecording.isWorthTranscribing(secondsCaptured: Tuning.minimumUsableRecordingSeconds))
        let notice = InterruptedRecording.notice(secondsCaptured: 95)
        #expect(notice.contains("1:35"), "the learner is told what was actually captured")
        #expect(notice.contains("interrupted"))
        #expect(InterruptedRecording.notice(secondsCaptured: 0).contains("record again"))
    }

    // MARK: compile-4-1 — a tutor reply with no local ids still becomes a guide

    @Test func aGuideParsesFromTheReplyShapeTheTutorIsAskedFor() throws {
        // Exactly the shape the system prompt demands: content only, no `id` anywhere.
        let raw = """
        {"title":"At the bakery","titleFrench":"À la boulangerie","summary":"What to expect.",
         "keyPhrases":[{"french":"Bonjour","english":"Hello","context":"Always greet first"}],
         "questionsAndAnswers":[{"question":"Et avec ceci ?","questionEnglish":"Anything else?",
                                 "answer":"Ce sera tout","answerEnglish":"That will be all"}],
         "tips":[{"tip":"Greet before ordering","category":"cultural"}],
         "nativeExpressions":[{"french":"Ça marche","english":"Works for me","context":"Casual agreement"}]}
        """
        let guide = try #require(ScenarioGuide.parse(raw), "the tutor never sends an id; the guide must decode without one")
        #expect(guide.title == "At the bakery")
        #expect(guide.titleFrench == "À la boulangerie")
        #expect(guide.keyPhrases.first?.french == "Bonjour")
        #expect(guide.questionsAndAnswers.first?.answer == "Ce sera tout")
        #expect(guide.tips.first?.category == "cultural")
        #expect(guide.nativeExpressions.first?.english == "Works for me")
        #expect(Set(guide.keyPhrases.map(\.id)).count == guide.keyPhrases.count, "each row gets its own identity")
    }

    @Test func aGuideMissingSectionsKeepsWhatTheTutorDidSend() throws {
        let raw = "```json\n{\"title\":\"Pharmacy\",\"keyPhrases\":[{\"french\":\"J'ai mal ici\",\"english\":\"It hurts here\"}]}\n```"
        let guide = try #require(ScenarioGuide.parse(raw), "a fenced, partial reply is still usable")
        #expect(guide.title == "Pharmacy")
        #expect(guide.keyPhrases.first?.context == "", "a dropped field is empty, not a failed guide")
        #expect(guide.questionsAndAnswers.isEmpty && guide.tips.isEmpty && guide.nativeExpressions.isEmpty)
    }

    @Test func aReplyWithNothingToTeachIsRefused() {
        #expect(ScenarioGuide.parse("sorry, I cannot help with that") == nil)
        #expect(ScenarioGuide.parse(#"{"title":"Empty","keyPhrases":[]}"#) == nil,
                "a guide with no phrases is a bad reply, not an empty screen")
    }

    @Test func aSavedGuideSurvivesTheRoundTripItIsStoredWith() throws {
        let guide = try #require(ScenarioGuide.parse(#"""
        {"title":"T","titleFrench":"TF","summary":"S",
         "keyPhrases":[{"french":"F","english":"E","context":"C"}],
         "questionsAndAnswers":[{"question":"Q","questionEnglish":"QE","answer":"A","answerEnglish":"AE"}],
         "tips":[{"tip":"P","category":"native"}],"nativeExpressions":[]}
        """#))
        let data = try JSONEncoder().encode(guide)
        let back = try JSONDecoder().decode(ScenarioGuide.self, from: data)
        #expect(back == guide, "a stored guide comes back with the same ids and text")
    }
}
