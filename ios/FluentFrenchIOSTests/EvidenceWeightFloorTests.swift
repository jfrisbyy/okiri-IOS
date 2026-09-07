//
//  EvidenceWeightFloorTests.swift
//  FluentFrenchIOSTests
//
//  One invariant: every evidence weight the app can actually produce must be able
//  to reach mastery. `recordConceptAnswer` decays the Beta evidence before adding
//  to it, so a streak of correct answers at weight w converges to a ceiling rather
//  than to 1 — and under `Tuning.masteryReachableWeightFloor` that ceiling sits
//  below `masteryThreshold`, so the concept is unmasterable no matter how well the
//  learner does. Nothing at the call site makes that visible, which is why it is
//  tested here rather than left to review.
//

import Testing
import Foundation
@testable import FluentFrenchIOS

@MainActor
struct EvidenceWeightFloorTests {

    /// The mastery a concept converges to on an unbroken correct streak at `weight`,
    /// simulated through the real update rather than the closed form, so the test
    /// fails if `recordConceptAnswer`'s arithmetic changes.
    private func ceiling(forWeight weight: Double, steps: Int = 4_000) -> Double {
        var alpha = 1.0, beta = 1.0
        for _ in 0..<steps {
            alpha = 1 + (alpha - 1) * Tuning.evidenceRecency
            beta = 1 + (beta - 1) * Tuning.evidenceRecency
            alpha += weight
        }
        return alpha / (alpha + beta)
    }

    @Test func theFloorIsWhereTheMasteryCeilingMeetsTheThreshold() {
        let floor = Tuning.masteryReachableWeightFloor
        #expect(abs(ceiling(forWeight: floor) - Tuning.masteryThreshold) < 0.0005,
                "the derived floor must be exactly where the ceiling meets the threshold")
        #expect(ceiling(forWeight: floor * 0.9) < Tuning.masteryThreshold,
                "below the floor, mastery is unreachable however long the streak")
        #expect(ceiling(forWeight: floor * 1.2) > Tuning.masteryThreshold)
    }

    @Test func everyShippedWeightProductCanReachMastery() {
        // Every multiplier the pipeline can apply: the format, the item's difficulty
        // tag, and whether the answer came in a capstone.
        let difficulties: [(String, Double)] = [
            ("hard", Tuning.hardItemEvidenceWeight),
            ("okay", 1.0),
            ("easy", Tuning.easyItemEvidenceWeight),
        ]
        let conceptWeights: [(String, Double)] = [("lesson", 1.0), ("capstone", Tuning.capstoneWeight)]
        let floor = Tuning.masteryReachableWeightFloor

        for format in AnswerFormat.allCases {
            for (dName, d) in difficulties {
                for (cName, c) in conceptWeights {
                    let weight = Tuning.formatEvidenceWeight(format) * d * c
                    #expect(weight > floor,
                            "\(format)/\(dName)/\(cName) weighs \(weight), at or under the floor \(floor): a concept answered only this way could never be mastered")
                    #expect(ceiling(forWeight: weight) >= Tuning.masteryThreshold,
                            "\(format)/\(dName)/\(cName) tops out at \(ceiling(forWeight: weight))")
                }
            }
        }
    }
}
