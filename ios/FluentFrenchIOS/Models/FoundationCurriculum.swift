//
//  FoundationCurriculum.swift
//  FluentFrenchIOS
//
//  The seeded starter content for Foundation mode. Foundation is NOT a separate
//  teaching system — it's the existing lesson engine run in DELIVERY mode over these
//  seeded gaps instead of DISCOVERY mode over captured gaps. The concepts live in
//  ConceptTaxonomy (the A1 + early-A2 skill graph); this file's job is to supply the
//  teachable evidence (gaps) tied to those concepts so a true beginner has a full
//  starter course before they've captured anything.
//
//  The real curriculum now lives in the bundled data file FoundationContent.json and
//  is read by FoundationContentLoader, so the word/skill banks can grow to full A1+
//  breadth as a content edit rather than a code change. `fallbackGaps()` below is a
//  compact safety net used only if that resource can't be read at runtime.
//

import Foundation

nonisolated enum FoundationCurriculum {
    /// Seeded teachable gaps for the curriculum, loaded from the bundled content file.
    static func gaps() -> [GapItem] {
        FoundationContentLoader.gaps()
    }

    /// Compact emergency fallback covering the core base concepts, used only if the
    /// bundled FoundationContent.json fails to load. The real, deep banks live in JSON.
    static func fallbackGaps() -> [GapItem] {
        let now = Date()
        let seeds: [(String, String, String, String, String, GapCategory, String)] = [
            ("bonjour", "hello / good day", "The default daytime greeting.", "Bonjour, comment ça va ?", "Hello, how are you?", .register, "greetings-politeness"),
            ("merci", "thank you", "Core politeness word.", "Merci beaucoup !", "Thank you very much!", .register, "greetings-politeness"),
            ("le pain", "the bread", "Masculine everyday food noun.", "Je mange du pain.", "I eat bread.", .vocabulary, "everyday-vocab"),
            ("l'eau", "the water", "Feminine noun (une eau).", "Je bois de l'eau.", "I drink water.", .vocabulary, "everyday-vocab"),
            ("la maison", "the house", "Feminine everyday noun.", "Je rentre à la maison.", "I'm going home.", .vocabulary, "everyday-vocab"),
            ("aujourd'hui", "today", "Core time word.", "Aujourd'hui, il fait beau.", "Today the weather is nice.", .vocabulary, "numbers-time"),
            ("un, deux, trois", "one, two, three", "The first counting numbers.", "Un, deux, trois — partez !", "One, two, three — go!", .vocabulary, "numbers-time"),
            ("le / la / les", "the (masc / fem / plural)", "Definite articles match gender and number.", "le chat, la table, les amis", "the cat, the table, the friends", .grammar, "definite-articles"),
            ("un / une / des", "a / an / some", "Indefinite articles for unspecified nouns.", "un livre, une pomme, des fleurs", "a book, an apple, some flowers", .grammar, "indefinite-articles"),
            ("masculin / féminin", "masculine / feminine", "Every French noun has a gender.", "le soleil (m), la lune (f)", "the sun (m), the moon (f)", .grammar, "noun-gender"),
            ("je / tu / il / elle", "I / you / he / she", "The core subject pronouns.", "Je parle, tu écoutes.", "I speak, you listen.", .grammar, "subject-pronouns"),
            ("parler (je parle)", "to speak (I speak)", "Regular -er verb in the present.", "Je parle français.", "I speak French.", .grammar, "present-er-verbs"),
            ("être (je suis)", "to be (I am)", "The most important irregular verb.", "Je suis étudiant.", "I am a student.", .grammar, "present-irregular"),
            ("avoir (j'ai)", "to have (I have)", "Second key irregular verb.", "J'ai un chien.", "I have a dog.", .grammar, "present-irregular"),
        ]

        return seeds.enumerated().map { idx, s in
            var g = GapItem(
                id: "foundation-fallback-\(s.6)-\(idx)",
                frenchWord: s.0,
                englishTranslation: s.1,
                explanation: s.2,
                exampleSentence: s.3,
                exampleTranslation: s.4,
                pronunciation: nil,
                sourceType: .foundation,
                category: s.5,
                difficulty: .okay,
                reviewCount: 0,
                consecutiveCorrect: 0,
                lastReviewedAt: nil,
                nextReviewAt: now,
                masteredAt: nil,
                createdAt: now,
                cefrLevel: .A1,
                easeFactor: 2.5,
                currentInterval: 0,
                irtDifficulty: -0.9,
                fsrs: nil,
                originalContext: nil,
                confusionLinks: [],
                conceptId: s.6
            )
            g.fsrs = FSRS.makeUnseenState(now: now)
            return g
        }
    }
}
