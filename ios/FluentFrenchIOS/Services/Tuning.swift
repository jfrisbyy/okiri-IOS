//
//  Tuning.swift
//  FluentFrenchIOS
//
//  Live-tuning knobs gathered in ONE place. These are deliberately NOT final —
//  the right values only reveal themselves once the loop runs on a real learner,
//  so they live here, clearly labeled, rather than scattered through the engines.
//

import Foundation

nonisolated enum Tuning {
    // MARK: Lesson trigger (Prompt F)
    /// New + due material that must accumulate before a consolidated lesson is
    /// offered in the daily plan.
    static let consolidatedLessonThreshold: Int = 6

    // MARK: Capstone cadence (Prompt G)
    /// Lessons completed before a capstone milestone quiz appears.
    static let capstoneEveryNLessons: Int = 4
    /// How many items the capstone pulls from recent material.
    static let capstoneSize: Int = 12
    /// Extra mastery weight applied to capstone answers (delayed mixed test = strong signal).
    static let capstoneWeight: Double = 1.6

    // MARK: Activity time crediting (Prompt E)
    /// Minimum seconds in an activity surface before any minute is credited.
    static let minActivitySeconds: Double = 20
}
