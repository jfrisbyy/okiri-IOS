//
//  HomeCopy.swift
//  FluentFrenchIOS
//
//  Home-screen wording and Kiri's mood, decided from REAL learner data (D12/D19):
//  a zero streak is never celebrated, "Not placed" shows before placement, and
//  the Foundation pace line reads "Lesson 2 of 3 today". Kept out of the view so
//  the rules are testable and the view stays presentation-only.
//

import Foundation

/// Kiri's pose. Presentation (the sprite cell) is mapped in `KiriView`.
nonisolated enum KiriMood: Hashable {
    case idle, happy, encouraging, celebrating
}

nonisolated enum HomeCopy {
    /// Fixed labels for the two due numbers (D13) — every screen uses these and nothing else.
    static let dueNowLabel = "Due now"
    static let upcomingLabel = "Coming up"

    /// Time-of-day greeting (French, as the Expo original).
    static func greeting(hour: Int) -> String {
        switch hour {
        case 0..<6: return "Bonne nuit"
        case 6..<12: return "Bonjour"
        case 12..<18: return "Bon après-midi"
        default: return "Bonsoir"
        }
    }

    /// The line under the greeting. Reads the streak honestly: nothing is
    /// "amazing" at zero, and a real streak is named by its length.
    static func subtitle(streak: Int, dueNow: Int, lessonsToday: Int, placed: Bool) -> String {
        guard placed else { return "Take the short placement to start your plan." }
        if streak >= Tuning.streakStrongDays {
            return "\(streak)-day streak — keep it going!"
        }
        if streak >= Tuning.streakMomentumDays {
            return "\(streak) days in a row — nice momentum."
        }
        if streak >= 1 {
            if lessonsToday > 0 { return "Day \(streak) done — see you tomorrow." }
            return "Day \(streak) — a lesson today keeps it going."
        }
        if lessonsToday > 0 { return "Good start today — tomorrow makes it a streak." }
        if dueNow > 0 {
            // One lesson is `Tuning.lessonSize` items, so it only clears a queue
            // that small. On day one the staggered Foundation seed leaves far more
            // than that due and the card below reads "Lesson 1 of 3 today" — the
            // greeting points at the day's lessons, not at one of them.
            return dueNow <= Tuning.lessonSize
                ? "\(dueNow) due now — a short lesson clears them."
                : "\(dueNow) due now — today's lessons work through them."
        }
        return "No streak yet — one lesson starts it."
    }

    /// Kiri's pose from real data: celebrating only on a long streak, happy on
    /// momentum, encouraging once anything happened today, idle otherwise.
    static func kiriMood(streak: Int, lessonsToday: Int) -> KiriMood {
        if streak >= Tuning.kiriCelebrationStreak { return .celebrating }
        if streak >= Tuning.kiriHappyStreak { return .happy }
        if streak >= 1 || lessonsToday > 0 { return .encouraging }
        return .idle
    }

    /// The header badge: the ONE displayed level, or "Not placed" before placement (D12).
    static func levelBadge(placed: Bool, level: CEFRLevel) -> String {
        placed ? "\(level.rawValue) · Studying" : "Not placed"
    }

    /// "Placed at A2" for the CEFR sheet's secondary line; nil before placement.
    static func placedLine(placed: Bool, assessedLevel: CEFRLevel) -> String? {
        placed ? "Placed at \(assessedLevel.rawValue)" : nil
    }

    /// Foundation pace (B10): "Lesson 2 of 3 today", or the done state.
    static func lessonPace(done: Int, target: Int) -> String {
        let target = max(1, target)
        if done >= target {
            return target == 1 ? "Today's lesson is done — extra practice is welcome."
                               : "All \(target) lessons done today — extra practice is welcome."
        }
        return "Lesson \(done + 1) of \(target) today"
    }

    /// "3 gaps to review" / "1 gap to review".
    static func gapsToReview(_ count: Int) -> String {
        "\(count) gap\(count == 1 ? "" : "s") to review"
    }

    /// The capture toast after an activity: "Saved 3 things you didn't know".
    static func captured(_ count: Int) -> String {
        "Saved \(count) thing\(count == 1 ? "" : "s") you didn't know"
    }
}
