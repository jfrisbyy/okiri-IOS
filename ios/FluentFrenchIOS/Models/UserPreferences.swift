//
//  UserPreferences.swift
//  FluentFrenchIOS
//
//  The "floor" for the daily plan: which activities the learner is up for and how
//  much time they have. The plan may only ever allocate to chosen modalities,
//  within the chosen time budget. Preferences set the shape constraints only —
//  the learner always picks the actual content (which article, video, topic).
//

import Foundation

/// A practice activity ("modality"). The daily plan distributes time across the
/// subset the learner has opted into.
nonisolated enum LearningModality: String, Codable, CaseIterable, Identifiable {
    case reading, watching, speaking, listening
    var id: String { rawValue }

    var label: String {
        switch self {
        case .reading: return "Reading"
        case .watching: return "Watching"
        case .speaking: return "Speaking"
        case .listening: return "Listening"
        }
    }

    var subtitle: String {
        switch self {
        case .reading: return "Articles & stories"
        case .watching: return "Video lessons"
        case .speaking: return "Speaking practice"
        case .listening: return "Dialogues & audio"
        }
    }

    var icon: String {
        switch self {
        case .reading: return "book.fill"
        case .watching: return "play.rectangle.fill"
        case .speaking: return "mic.fill"
        case .listening: return "headphones"
        }
    }
}

/// Daily time budget bands.
nonisolated enum TimeBudget: String, Codable, CaseIterable, Identifiable {
    case light, standard, intense
    var id: String { rawValue }

    /// Total minutes the plan is allowed to prescribe per day.
    var minutes: Int {
        switch self {
        case .light: return 10
        case .standard: return 20
        case .intense: return 35
        }
    }

    var label: String {
        switch self {
        case .light: return "~10 min"
        case .standard: return "~20 min"
        case .intense: return "30+ min"
        }
    }

    var subtitle: String {
        switch self {
        case .light: return "A quick daily touch"
        case .standard: return "A steady habit"
        case .intense: return "Serious progress"
        }
    }
}

/// The learner's plan constraints. Persisted in AppStore.
nonisolated struct UserPreferences: Codable, Hashable {
    /// Activities the learner will do. The plan only allocates to these.
    var modalities: Set<LearningModality>
    var timeBudget: TimeBudget
    /// Optional weekly cadence goal (days per week); nil = not set.
    var daysPerWeekGoal: Int?

    static let `default` = UserPreferences(
        modalities: [.reading, .listening, .speaking],
        timeBudget: .standard,
        daysPerWeekGoal: nil
    )
}
