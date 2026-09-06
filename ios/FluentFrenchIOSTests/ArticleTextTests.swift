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
        let body = ArticleText.body(content: "Le gouvernement a annoncé un plan… [+2145 chars]", description: "Un plan.")
        #expect(body == "Le gouvernement a annoncé un plan…")
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
