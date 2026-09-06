//
//  LessonQuestionParserTests.swift
//  FluentFrenchIOSTests
//
//  Package C part 1 — parsing the AI question writer's reply (C7 / C8) with
//  fixture strings: fences and chatter, "vrai", a missing wordIndex, mixed-case
//  options, trimming that keeps the correct option, and per-gap coverage.
//

import Foundation
import Testing
@testable import FluentFrenchIOS

@MainActor
struct LessonQuestionParserTests {

    private func gap(_ id: String, reviewCount: Int = 0, consecutiveCorrect: Int = 0) -> GapItem {
        EngineFixtures.gap(id, concept: "c", category: .vocabulary, consecutiveCorrect: consecutiveCorrect, reviewCount: reviewCount)
    }

    private let chattyReply = """
    Sure! Here are your questions:
    ```json
    {"questions":[
      {"wordIndex":0,"kind":"multipleChoice","prompt":"What does “x-fr” mean?","answer":"X-EN","options":["x-en","y-en","z-en","w-en","v-en"],"explanation":"note"},
      {"wordIndex":"0","kind":"trueFalse","statement":"“x-fr” means “x-en”.","answer":"vrai"},
      {"kind":"multipleChoice","answer":"y-en","options":["y-en","x-en","z-en"]},
      {"wordIndex":1,"kind":"trueFalse","statement":"“y-fr” means “x-en”.","answer":"maybe"},
      {"wordIndex":1,"kind":"fillBlank","prompt":"Je _____ ici.","answer":"y-fr"},
      {"wordIndex":1,"kind":"translation","statement":"I am here","answer":"y-fr"},
      {"wordIndex":9,"kind":"multipleChoice","answer":"a","options":["a","b","c"]},
      {"wordIndex":0,"kind":"arrange","answer":"x-fr ici"}
    ]}
    ```
    Let me know if you want more!
    """

    @Test func chattyReplyIsParsedAndValidated() throws {
        let gaps = [gap("x"), gap("y")]
        let batch = LessonQuestionParser.parse(chattyReply, gaps: gaps, optionCount: 4, seed: 1)

        #expect(batch.rejected == 4, "missing wordIndex, 'maybe', out-of-range index, arrange")
        #expect(batch.countsByGap == ["x": 2, "y": 2])
        #expect(batch.covers(gaps, target: Tuning.masteryTarget))
        #expect(batch.questions.allSatisfy { $0.source == .ai })

        let mc = try #require(batch.questions.first { $0.gap.id == "x" && $0.kind == .multipleChoice })
        #expect(mc.correctAnswer == "x-en", "the option's own spelling wins over the answer's case")
        #expect(mc.options.count == 4 && mc.options.contains("x-en"), "trimmed to optionCount, correct kept")
        #expect(Set(mc.options).isSubset(of: ["x-en", "y-en", "z-en", "w-en", "v-en"]))
        #expect(mc.explanation == "note" && mc.prompt == "What does “x-fr” mean?")

        let tf = try #require(batch.questions.first { $0.gap.id == "x" && $0.kind == .trueFalse })
        #expect(tf.correctAnswer == "True" && tf.statement == "“x-fr” means “x-en”.")
        #expect(tf.explanation == "“x-fr” means “x-en”.")

        let fill = try #require(batch.questions.first { $0.gap.id == "y" && $0.kind == .fillBlank })
        #expect(fill.prompt == "Je _____ ici." && fill.correctAnswer == "y-fr")
        #expect(fill.explanation == "Je y-fr ici.")

        let tr = try #require(batch.questions.first { $0.gap.id == "y" && $0.kind == .translation })
        #expect(tr.statement == "I am here" && tr.correctAnswer == "y-fr" && tr.hint == nil)
    }

    /// The model writes questions, never the truth: an answer that is not the
    /// gap's own meaning (or one of its own French forms) is rejected, and the
    /// gap keeps its validated local question.
    @Test func answersThatDoNotMatchTheGapAreRejected() throws {
        let raw = """
        {"questions":[
          {"wordIndex":0,"kind":"multipleChoice","answer":"a completely different meaning","options":["a completely different meaning","x-en","a","b"]},
          {"wordIndex":0,"kind":"translation","statement":"x-en","answer":"invente"},
          {"wordIndex":0,"kind":"fillBlank","prompt":"Je _____ ici.","answer":"invente"},
          {"wordIndex":0,"kind":"fillBlank","prompt":"Je _____ ici.","answer":"x-fr"},
          {"wordIndex":0,"kind":"multipleChoice","answer":"x-en","options":["x-en","a","b"]}
        ]}
        """
        let batch = LessonQuestionParser.parse(raw, gaps: [gap("x")], optionCount: 4, seed: 5)
        #expect(batch.rejected == 3, "the invented gloss, the invented French, the invented blank answer")
        #expect(batch.countsByGap == ["x": 2])
        #expect(batch.questions.allSatisfy { $0.correctAnswer == "x-en" || $0.correctAnswer == "x-fr" })

        #expect(LessonQuestionParser.matchesGloss("X-EN", of: gap("x")))
        #expect(!LessonQuestionParser.matchesGloss("something else", of: gap("x")))
        #expect(!LessonQuestionParser.matchesGloss("", of: gap("x")))
        #expect(LessonQuestionParser.isContentForm("x-fr", of: gap("x"), kind: .translation))
        #expect(!LessonQuestionParser.isContentForm("x-fr ici", of: gap("x"), kind: .translation))
    }

    /// A tagged gloss is only the answer with its tag: the model cannot turn
    /// "the (masculine singular)" into a question whose answer is any "the".
    @Test func taggedGlossesMustMatchWithTheirTag() throws {
        var article = gap("le")
        article.frenchWord = "le"
        article.englishTranslation = "the (masculine singular)"
        let raw = """
        {"questions":[
          {"wordIndex":0,"kind":"multipleChoice","answer":"the","options":["the","a","b"]},
          {"wordIndex":0,"kind":"multipleChoice","answer":"the (masculine singular)","options":["the (masculine singular)","the (feminine singular)","the (plural)"]}
        ]}
        """
        let batch = LessonQuestionParser.parse(raw, gaps: [article], optionCount: 4, seed: 6)
        #expect(batch.rejected == 1 && batch.questions.count == 1)
        let q = try #require(batch.questions.first)
        #expect(q.correctAnswer == "the (masculine singular)")
        #expect(q.options.contains("the (feminine singular)"), "a tagged sibling stays a distractor")
        #expect(q.options.filter { LessonSession.grade(.option($0), for: q).correct }.count == 1)
    }

    @Test func trueFalseWhitelist() {
        #expect(LessonQuestionParser.trueFalseValue("True") == true)
        #expect(LessonQuestionParser.trueFalseValue(" FALSE ") == false)
        #expect(LessonQuestionParser.trueFalseValue("Vrai") == true)
        #expect(LessonQuestionParser.trueFalseValue("faux.") == false)
        #expect(LessonQuestionParser.trueFalseValue("yes") == nil)
        #expect(LessonQuestionParser.trueFalseValue("t") == nil)
        #expect(LessonQuestionParser.trueFalseValue("") == nil)
        #expect(LessonQuestionParser.trueFalseValue("true or false") == nil)
    }

    @Test func trimmingAlwaysKeepsTheCorrectOption() throws {
        let raw = """
        {"questions":[{"wordIndex":0,"kind":"multipleChoice","answer":"x-en",
          "options":["a","b","c","d","e","X-en"]}]}
        """
        let batch = LessonQuestionParser.parse(raw, gaps: [gap("x")], optionCount: 3, seed: 2)
        let q = try #require(batch.questions.first)
        #expect(q.options.count == 3 && q.options.contains("X-en") && q.correctAnswer == "X-en")
        #expect(Set(q.options).isSubset(of: ["a", "b", "X-en"]), "the first distractors survive, the answer always does")
    }

    @Test func missingAnswerOptionIsAddedAndShortListsArePadded() throws {
        let raw = """
        {"questions":[
          {"wordIndex":0,"kind":"multipleChoice","answer":"x-en","options":["b","c","d"]},
          {"wordIndex":0,"kind":"multipleChoice","answer":"x-en","options":["x-en"]},
          {"wordIndex":0,"kind":"multipleChoice","answer":"x-en","options":["x-en","X-EN","x-en "]}
        ]}
        """
        let gaps = [gap("x"), gap("y"), gap("z")]
        let batch = LessonQuestionParser.parse(raw, gaps: gaps, optionCount: 4, seed: 3)
        #expect(batch.questions.count == 3 && batch.rejected == 0)
        let added = batch.questions[0]
        #expect(added.options.count == 4 && added.options.contains("x-en"), "the answer is appended when missing")
        let padded = batch.questions[1]
        #expect(padded.options.count == Tuning.minMultipleChoiceOptions && padded.options.contains("x-en"))
        #expect(padded.options.contains("y-en") && padded.options.contains("z-en"), "padded from the lesson's own gaps")
        let deduped = batch.questions[2]
        #expect(deduped.options.count == Tuning.minMultipleChoiceOptions && deduped.options.filter { $0.lowercased().trimmingCharacters(in: .whitespaces) == "x-en" }.count == 1,
                "case duplicates collapse, then the list is padded")
    }

    @Test func fillBlankWithoutAMarkerFallsBackToTheContentBlankOrIsRejected() throws {
        let raw = """
        {"questions":[
          {"wordIndex":0,"kind":"fillBlank","prompt":"No marker here.","answer":"x-fr"},
          {"wordIndex":1,"kind":"fillBlank","prompt":"No marker here.","answer":"y-fr"},
          {"wordIndex":2,"kind":"translation","statement":"Rule label","answer":"z-fr"}
        ]}
        """
        var ambiguous = gap("y")
        ambiguous.exampleSentence = "y-fr y-fr"
        var label = gap("z")
        label.isTestable = false
        let batch = LessonQuestionParser.parse(raw, gaps: [gap("x"), ambiguous, label], optionCount: 4, seed: 4)
        #expect(batch.questions.count == 1 && batch.rejected == 2)
        let q = try #require(batch.questions.first)
        #expect(q.gap.id == "x" && q.prompt == "_____ example" && q.correctAnswer == "x-fr")
        #expect(batch.gapsShort(of: 1, in: [gap("x"), ambiguous, label]).map { $0.id } == ["y", "z"])
    }

    @Test func probesAndGarbageAreRejected() {
        var probe = gap("p")
        probe.isProbe = true
        let raw = """
        {"questions":[{"wordIndex":0,"kind":"multipleChoice","answer":"p-en","options":["p-en","a","b"]}]}
        """
        let batch = LessonQuestionParser.parse(raw, gaps: [probe], optionCount: 4)
        #expect(batch.questions.isEmpty && batch.rejected == 1, "probes are always local")

        #expect(LessonQuestionParser.parse("I cannot help with that.", gaps: [gap("x")], optionCount: 4).questions.isEmpty)
        #expect(LessonQuestionParser.parse("{\"questions\": \"nope\"}", gaps: [gap("x")], optionCount: 4).questions.isEmpty)
        #expect(LessonQuestionParser.parse("{\"questions\":[{\"wordIndex\":0,\"kind\":\"multipleChoice\"}, 42]}", gaps: [gap("x")], optionCount: 4).questions.count == 1,
                "a malformed element is dropped, the rest survives")
    }

    @Test func extractJSONPrefersTheFencedBlock() {
        let raw = "Notes {not json}\n```json\n{\"questions\":[]}\n```\ntrailing {x}"
        #expect(LessonQuestionParser.extractJSON(from: raw) == "{\"questions\":[]}")
        #expect(LessonQuestionParser.extractJSON(from: "abc {\"a\":1} def") == "{\"a\":1}")
        #expect(LessonQuestionParser.extractJSON(from: "no braces") == nil)
    }

    @Test func coverageIsPerGap() {
        let raw = """
        {"questions":[
          {"wordIndex":0,"kind":"multipleChoice","answer":"x-en","options":["x-en","a","b"]},
          {"wordIndex":0,"kind":"multipleChoice","answer":"x-en","options":["x-en","c","d"]},
          {"wordIndex":1,"kind":"multipleChoice","answer":"y-en","options":["y-en","a","b"]}
        ]}
        """
        let gaps = [gap("x"), gap("y")]
        let batch = LessonQuestionParser.parse(raw, gaps: gaps, optionCount: 4)
        #expect(!batch.covers(gaps, target: 2))
        #expect(batch.gapsShort(of: 2, in: gaps).map { $0.id } == ["y"])
        #expect(batch.covers([gaps[0]], target: 2))
    }

    // MARK: The hint under a typed field (lesson-3-4)

    /// `exampleTranslation` is the English of the CONTENT's example sentence. When
    /// the model writes its OWN sentence, that translation belongs to a different
    /// sentence, and printing it under the field captions the prompt with the
    /// translation of something else. Only the local fallback — where the prompt IS
    /// the content example — may show it.
    @Test func anAIWrittenFillBlankCarriesNoHint() throws {
        let raw = """
        {"questions":[
          {"wordIndex":0,"kind":"fillBlank","prompt":"Il y a beaucoup d'_____ ici.","answer":"x-fr"},
          {"wordIndex":0,"kind":"fillBlank","prompt":"no blank in this one","answer":"x-fr"}
        ]}
        """
        let g = gap("x")
        #expect(g.exampleTranslation == "x-en example")
        let batch = LessonQuestionParser.parse(raw, gaps: [g], optionCount: 4, seed: 3)
        let ai = try #require(batch.questions.first { $0.prompt.contains("beaucoup") })
        #expect(ai.hint == nil, "the model's sentence is not the content example")
        let local = try #require(batch.questions.first { $0.prompt == "_____ example" })
        #expect(local.hint == "x-en example", "here the prompt IS the content example")
    }

    // MARK: True/false is content-verified too (lesson-3-5)

    /// The model never writes the truth — true/false included. Only a MEANING claim
    /// the content can settle is accepted, the verdict is computed here, and the
    /// model's own answer has to agree with it.
    @Test func trueFalseIsAcceptedOnlyAsAContentVerifiedMeaningClaim() throws {
        var pain = gap("x")
        pain.frenchWord = "le pain"
        pain.englishTranslation = "bread"
        var eau = gap("y")
        eau.frenchWord = "l'eau"
        eau.englishTranslation = "water"
        let raw = """
        {"questions":[
          {"wordIndex":0,"kind":"trueFalse","statement":"“le pain” means “water”.","answer":"False"},
          {"wordIndex":0,"kind":"trueFalse","statement":"“le pain” means “bread”.","answer":"False"},
          {"wordIndex":1,"kind":"trueFalse","statement":"“l'eau” is a feminine noun.","answer":"True"},
          {"wordIndex":1,"kind":"trueFalse","statement":"“le pain” means “bread”.","answer":"True"},
          {"wordIndex":1,"kind":"trueFalse","statement":"“l'eau” is the opposite of “water”.","answer":"True"}
        ]}
        """
        let batch = LessonQuestionParser.parse(raw, gaps: [pain, eau], optionCount: 4, seed: 2)
        #expect(batch.countsByGap == ["x": 1], "only the verifiable false claim survives")
        #expect(batch.rejected == 4, "mislabelled, a gender claim, another word's claim, a non-meaning connector")

        let tf = try #require(batch.questions.first)
        #expect(tf.correctAnswer == "False" && tf.statement == "“le pain” means “water”.")
        #expect(tf.explanation == "“le pain” means “bread”. It does not mean “water”.",
                "the feedback answers the statement that was asked")
    }

    /// A claim that restates the gap's own meaning in other words is not something
    /// the content can call false: "the bread" against the gloss "bread" is rejected
    /// rather than taught as wrong.
    @Test func aRestatedMeaningIsNeverGradedFalse() {
        var g = gap("m")
        g.frenchWord = "le pain"
        g.englishTranslation = "bread"
        let raw = """
        {"questions":[{"wordIndex":0,"kind":"trueFalse","statement":"“le pain” means “the bread”.","answer":"False"}]}
        """
        let batch = LessonQuestionParser.parse(raw, gaps: [g], optionCount: 4)
        #expect(batch.questions.isEmpty && batch.rejected == 1)
        #expect(!LessonQuestionParser.isClearlyDifferentMeaning("the bread", from: "bread"))
        #expect(!LessonQuestionParser.isClearlyDifferentMeaning("bread roll", from: "bread"))
        #expect(LessonQuestionParser.isClearlyDifferentMeaning("water", from: "bread"))
    }

    @Test func meaningClaimParsesOnlyMeaningClaims() {
        #expect(LessonQuestionParser.meaningClaim(in: "“le pain” means “bread”.")?.french == "le pain")
        #expect(LessonQuestionParser.meaningClaim(in: "« l'eau » veut dire « water »")?.english == "water")
        #expect(LessonQuestionParser.meaningClaim(in: "\"le pain\" = \"bread\"")?.english == "bread")
        #expect(LessonQuestionParser.meaningClaim(in: "l'eau is feminine") == nil,
                "an elision apostrophe is not a quote")
        #expect(LessonQuestionParser.meaningClaim(in: "“le pain” is the opposite of “bread”") == nil)
        #expect(LessonQuestionParser.meaningClaim(in: "“le pain” has the opposite meaning of “bread”") == nil,
                "a connector that merely contains \"mean\" is not a meaning claim")
        #expect(LessonQuestionParser.meaningClaim(in: "“le pain” is “masculine”") == nil,
                "a gender claim is not a meaning claim")
        #expect(LessonQuestionParser.meaningClaim(in: "“le pain” means bread") == nil)
    }
}
