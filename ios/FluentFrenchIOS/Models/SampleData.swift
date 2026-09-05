//
//  SampleData.swift
//  FluentFrenchIOS
//
//  Sample gaps/errors for SwiftUI previews and DEBUG tooling ONLY. Never loaded
//  into a real learner's store: a fresh install starts empty (see AppStore.load()),
//  and `AppStore.preview` is the sole consumer. Compiled out of release builds.
//

#if DEBUG
import Foundation

nonisolated enum SampleData {
    static func makeGaps() -> [GapItem] {
        let now = Date()
        func date(_ daysAgo: Double) -> Date { now.addingTimeInterval(-daysAgo * 86_400) }
        func due(_ days: Double) -> Date { now.addingTimeInterval(days * 86_400) }

        let seeds: [GapItem] = [
            gap(
                "g1", "découvert", "discovered / overdraft",
                explanation: "Past participle of 'découvrir'. Also a banking term for an overdraft.",
                example: "J'ai découvert un nouveau café près de chez moi.",
                exampleTr: "I discovered a new café near my place.",
                category: .vocabulary, difficulty: .hard, cefr: .B1,
                streak: 1, nextReview: due(-0.5), created: date(18),
                concept: "passe-compose-avoir",
                context: OriginalContext(sentence: "Les scientifiques ont découvert une nouvelle espèce.", translation: "Scientists discovered a new species.", sourceTab: "read", capturedAt: date(18), reExposureCount: 0)
            ),
            gap(
                "g2", "le bras", "the arm",
                explanation: "Masculine noun. A common body-part word.",
                example: "Il s'est cassé le bras en tombant.",
                exampleTr: "He broke his arm falling.",
                category: .vocabulary, difficulty: .okay, cefr: .A1,
                streak: 3, nextReview: due(1), created: date(6),
                concept: "everyday-vocab"
            ),
            gap(
                "g3", "être vs avoir", "auxiliary verbs in passé composé",
                explanation: "Movement & state verbs use 'être'; most others use 'avoir'.",
                example: "Je suis arrivé. / J'ai mangé.",
                exampleTr: "I arrived. / I ate.",
                category: .grammar, difficulty: .hard, cefr: .A2,
                streak: 0, nextReview: due(-1), created: date(9),
                concept: "passe-compose-etre"
            ),
            gap(
                "g4", "savoir vs connaître", "to know (fact vs familiarity)",
                explanation: "'Savoir' = know a fact / how to. 'Connaître' = be familiar with.",
                example: "Je sais nager. / Je connais Paris.",
                exampleTr: "I know how to swim. / I know Paris.",
                category: .grammar, difficulty: .hard, cefr: .B1,
                streak: 2, nextReview: due(0.2), created: date(12),
                concept: "savoir-vs-connaitre"
            ),
            gap(
                "g5", "le 'r' français", "the French guttural R",
                explanation: "Produced at the back of the throat, not rolled.",
                example: "Paris, rouge, rue.",
                exampleTr: "Paris, red, street.",
                category: .pronunciation, difficulty: .hard, cefr: .A1,
                streak: 1, nextReview: due(-0.3), created: date(4),
                concept: "guttural-r"
            ),
            gap(
                "g6", "du coup", "so / as a result (filler)",
                explanation: "Very common spoken connector. Slightly informal.",
                example: "Du coup, on y va ensemble ?",
                exampleTr: "So, shall we go together?",
                category: .phrasing, difficulty: .okay, cefr: .B1,
                streak: 4, nextReview: due(3), created: date(20),
                concept: "spoken-fillers"
            ),
            gap(
                "g7", "vous vs tu", "formal vs informal 'you'",
                explanation: "Use 'vous' for politeness/strangers, 'tu' for friends/family.",
                example: "Vous désirez ? / Tu viens ?",
                exampleTr: "What would you like? / Are you coming?",
                category: .register, difficulty: .okay, cefr: .A1,
                streak: 5, nextReview: due(8), created: date(25),
                concept: "tu-vs-vous"
            ),
            gap(
                "g8", "la pomme de terre", "the potato",
                explanation: "Literally 'apple of the earth'.",
                example: "Je voudrais des pommes de terre.",
                exampleTr: "I would like some potatoes.",
                category: .vocabulary, difficulty: .easy, cefr: .A1,
                streak: 5, nextReview: due(10), created: date(30), mastered: date(2),
                concept: "everyday-vocab"
            ),
            gap(
                "g9", "il faut que", "it is necessary that (+ subjunctive)",
                explanation: "Triggers the subjunctive mood in the following clause.",
                example: "Il faut que tu partes maintenant.",
                exampleTr: "You need to leave now.",
                category: .grammar, difficulty: .hard, cefr: .B2,
                streak: 0, nextReview: due(-2), created: date(3),
                concept: "subjunctive-intro"
            ),
            gap(
                "g10", "avoir le cafard", "to feel down / blue",
                explanation: "Idiom — literally 'to have the cockroach'.",
                example: "Depuis lundi, j'ai le cafard.",
                exampleTr: "Since Monday, I've felt down.",
                category: .phrasing, difficulty: .okay, cefr: .B1,
                streak: 2, nextReview: due(0.5), created: date(7),
                concept: "idioms"
            ),
        ]
        return seeds.map { applyFsrs(to: $0) }
    }

    private static func applyFsrs(to gap: GapItem) -> GapItem {
        var g = gap
        let grade: ReviewGrade = gap.consecutiveCorrect >= 3 ? .good : (gap.consecutiveCorrect >= 1 ? .hard : .again)
        var state = FSRS.makeInitialState(grade: grade, now: gap.lastReviewedAt ?? gap.createdAt)
        state.reps = gap.reviewCount
        state.dueAt = gap.nextReviewAt
        g.fsrs = state
        return g
    }

    private static func gap(
        _ id: String, _ french: String, _ english: String,
        explanation: String, example: String, exampleTr: String,
        category: GapCategory, difficulty: GapDifficulty, cefr: CEFRLevel,
        streak: Int, nextReview: Date, created: Date,
        mastered: Date? = nil, concept: String? = nil, context: OriginalContext? = nil
    ) -> GapItem {
        GapItem(
            id: id,
            frenchWord: french,
            englishTranslation: english,
            explanation: explanation,
            exampleSentence: example,
            exampleTranslation: exampleTr,
            pronunciation: nil,
            sourceType: context?.sourceTab == "read" ? .reading : .speech,
            category: category,
            difficulty: difficulty,
            reviewCount: max(streak, 1),
            consecutiveCorrect: streak,
            lastReviewedAt: created.addingTimeInterval(86_400),
            nextReviewAt: nextReview,
            masteredAt: mastered,
            createdAt: created,
            cefrLevel: cefr,
            easeFactor: 2.5,
            currentInterval: Double(max(1, streak)),
            irtDifficulty: difficulty == .hard ? 0.8 : (difficulty == .okay ? 0.0 : -0.8),
            fsrs: nil,
            originalContext: context,
            confusionLinks: [],
            conceptId: concept
        )
    }

    static func makeErrors() -> [ErrorRecord] {
        let now = Date()
        func date(_ daysAgo: Double) -> Date { now.addingTimeInterval(-daysAgo * 86_400) }
        return [
            ErrorRecord(id: "e1", gapId: "g3", category: .grammar, frenchWord: "être vs avoir", userAnswer: "j'ai arrivé", correctAnswer: "je suis arrivé", conceptLabel: "Auxiliary choice in passé composé", occurredAt: date(1)),
            ErrorRecord(id: "e2", gapId: "g3", category: .grammar, frenchWord: "être vs avoir", userAnswer: "j'ai tombé", correctAnswer: "je suis tombé", conceptLabel: "Auxiliary choice in passé composé", occurredAt: date(3)),
            ErrorRecord(id: "e3", gapId: "g3", category: .grammar, frenchWord: "être vs avoir", userAnswer: "il a parti", correctAnswer: "il est parti", conceptLabel: "Auxiliary choice in passé composé", occurredAt: date(5)),
            ErrorRecord(id: "e4", gapId: "g4", category: .grammar, frenchWord: "savoir vs connaître", userAnswer: "je connais nager", correctAnswer: "je sais nager", conceptLabel: "Fact vs familiarity", occurredAt: date(2)),
            ErrorRecord(id: "e5", gapId: "g4", category: .grammar, frenchWord: "savoir vs connaître", userAnswer: "je sais Paris", correctAnswer: "je connais Paris", conceptLabel: "Fact vs familiarity", occurredAt: date(4)),
            ErrorRecord(id: "e6", gapId: "g5", category: .pronunciation, frenchWord: "le 'r' français", userAnswer: "rolled r", correctAnswer: "guttural r", conceptLabel: "Guttural R placement", occurredAt: date(2)),
            ErrorRecord(id: "e7", gapId: "g1", category: .vocabulary, frenchWord: "découvert", userAnswer: "covered", correctAnswer: "discovered", conceptLabel: "Past participle meaning", occurredAt: date(6)),
        ]
    }
}
#endif
