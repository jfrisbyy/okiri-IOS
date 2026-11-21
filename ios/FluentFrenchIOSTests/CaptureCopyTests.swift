//
//  CaptureCopyTests.swift
//  FluentFrenchIOSTests
//
//  UX-12: every save affordance names the learner's deck by its one
//  learner-facing name, `HomeCopy.myWordsTitle` — never "deck".
//

import Foundation
import Testing
@testable import FluentFrenchIOS

@MainActor
struct CaptureCopyTests {
    private var all: [String] {
        [HomeCopy.saveToMyWords, HomeCopy.savedToMyWords, HomeCopy.alreadyInMyWords, HomeCopy.inMyWords,
         HomeCopy.saveItemToMyWords("this line"), HomeCopy.itemAlreadyInMyWords("tu es"),
         HomeCopy.addsToMyWords("word")]
    }

    @Test func captureCopyNamesMyWordsAndNeverDeck() {
        for line in all {
            #expect(line.contains(HomeCopy.myWordsTitle), "\(line)")
            #expect(!line.lowercased().contains("deck"), "\(line)")
        }
    }

    @Test func captureCopyReadsAsSentences() {
        #expect(HomeCopy.saveToMyWords == "Save to My words")
        #expect(HomeCopy.savedToMyWords == "Saved to My words")
        #expect(HomeCopy.alreadyInMyWords == "Already in My words")
        #expect(HomeCopy.inMyWords == "In My words")
        #expect(HomeCopy.saveItemToMyWords("this phrase") == "Save this phrase to My words")
        #expect(HomeCopy.itemAlreadyInMyWords("This word") == "This word is already in My words")
        #expect(HomeCopy.addsToMyWords("idiom") == "Adds this idiom to My words")
    }
}
