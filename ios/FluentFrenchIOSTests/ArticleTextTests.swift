//
//  ArticleTextTests.swift
//  FluentFrenchIOSTests
//
//  The text decisions behind the news reader: a headline with nothing to read
//  is dropped rather than opened as a blank page (read-1-1), the API's
//  truncation marker never reaches the reader (read-1-2), and a summary that
//  merely repeats the body's opening is not printed twice (read-1-3).
//

import Foundation
import Testing
@testable import FluentFrenchIOS

@MainActor
struct ArticleTextTests {

    // MARK: - Body

    @Test func stripsTheTruncationMarkerFromTheBody() {
        // Rewritten for read-10-4: this used to expect "… un plan…", keeping the word
        // the cut went through. Whether "plan" is whole cannot be told from the text
        // (the next one cut is "ferroviai…"), so the last word before the cut goes.
        let body = ArticleText.body(content: "Le gouvernement a annoncé un plan… [+2145 chars]", description: "Un plan.")
        #expect(body == "Le gouvernement a annoncé un…")
        #expect(body?.contains("[+") == false)
    }

    // MARK: - read-10-4 The half-word at the service's cut never reaches the reader

    @Test func dropsTheHalfWordTheServiceCutThrough() {
        let rail = ArticleText.body(content: "Des retards sont prévus dans les infrastructures ferroviai… [+2100 chars]",
                                    description: nil)
        #expect(rail == "Des retards sont prévus dans les infrastructures…")
        let urgent = ArticleText.body(content: "Le gouvernement prépare des mesures d'urgen… [+1800 chars]", description: nil)
        #expect(urgent == "Le gouvernement prépare des mesures…", "the elided fragment goes with its article")
        let comma = ArticleText.body(content: "Il a parlé du budget, de l'éduc… [+900 chars]", description: nil)
        #expect(comma == "Il a parlé du budget, de…")
        let dangling = ArticleText.body(content: "Il a parlé du budget, l'éduc… [+900 chars]", description: nil)
        #expect(dangling == "Il a parlé du budget…", "no comma left hanging before the ellipsis")
        // Neither Key Vocabulary nor a tap can reach the fragment any more.
        let words = KeyVocabulary.words(in: rail ?? "")
        #expect(!words.contains("ferroviai"))
        #expect(words.contains("infrastructures"))
    }

    @Test func aCutBetweenSentencesKeepsEveryWord() {
        #expect(ArticleText.body(content: "Le plan est prêt. … [+300 chars]", description: nil) == "Le plan est prêt. …")
        #expect(ArticleText.body(content: "Le plan est prêt. [+300 chars]", description: nil) == "Le plan est prêt. …")
        #expect(ArticleText.body(content: "« Nous avons un plan », a-t-il dit. … [+300 chars]", description: nil)
                == "« Nous avons un plan », a-t-il dit. …", "an opening guillemet is never trimmed")
    }

    @Test func anExcerptThatIsOnlyAFragmentFallsBackToTheDescription() {
        #expect(ArticleText.body(content: "ferroviai… [+2100 chars]", description: "Un plan.") == "Un plan.")
    }

    @Test func aBodyWithoutTheMarkerIsLeftWhole() {
        #expect(ArticleText.body(content: "Le texte entier se termine ici", description: nil) == "Le texte entier se termine ici",
                "only a body the service marked as cut loses its last word")
    }

    @Test func fallsBackToTheDescriptionWhenThereIsNoContent() {
        #expect(ArticleText.body(content: nil, description: "Un plan pour l'énergie.") == "Un plan pour l'énergie.")
        #expect(ArticleText.body(content: "", description: "Un plan pour l'énergie.") == "Un plan pour l'énergie.")
        #expect(ArticleText.body(content: "   \n ", description: "Un plan pour l'énergie.") == "Un plan pour l'énergie.")
    }

    @Test func contentThatIsOnlyATruncationMarkerIsNotText() {
        #expect(ArticleText.body(content: "[+118 chars]", description: "Un plan.") == "Un plan.",
                "a marker with nothing before it leaves no words to read")
    }

    @Test func noContentAndNoDescriptionMeansNoArticle() {
        #expect(ArticleText.body(content: nil, description: nil) == nil)
        #expect(ArticleText.body(content: "", description: "") == nil)
        #expect(ArticleText.body(content: "  ", description: "\n\t") == nil)
        #expect(ArticleText.body(content: "[+42 chars]", description: nil) == nil)
    }

    // MARK: - Context summary

    @Test func showsTheSummaryWhenItAddsSomethingToTheBody() {
        let summary = "Un nouveau plan vise à doubler la capacité solaire."
        let body = "Le gouvernement français a annoncé un investissement record."
        #expect(ArticleText.contextSummary(summary: summary, body: body) == summary)
    }

    @Test func dropsTheSummaryWhenItIsTheBody() {
        let same = "Un nouveau plan vise à doubler la capacité solaire."
        #expect(ArticleText.contextSummary(summary: same, body: same) == nil,
                "the context box would print the article a second time")
        #expect(ArticleText.contextSummary(summary: "  \(same) ", body: same) == nil,
                "whitespace does not make it a different sentence")
    }

    @Test func dropsTheSummaryWhenTheBodyOpensWithIt() {
        let summary = "Un nouveau plan vise à doubler la capacité solaire."
        let body = "\(summary) Les experts estiment que cela pourrait créer des emplois."
        #expect(ArticleText.contextSummary(summary: summary, body: body) == nil)
    }

    @Test func anEmptySummaryIsNeverAContextBox() {
        #expect(ArticleText.contextSummary(summary: "", body: "Le texte.") == nil)
        #expect(ArticleText.contextSummary(summary: "   \n", body: "Le texte.") == nil)
    }
}
