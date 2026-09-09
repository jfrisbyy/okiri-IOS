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

    /// The ONE label for a count of unmastered learner-facing gaps. Placement seeds
    /// the whole Foundation slice, so on day one that number is hundreds of items the
    /// learner has never been asked about: it describes the curriculum still ahead,
    /// not weak spots the app diagnosed, and "Active gaps" claimed the latter.
    static let toLearnLabel = "To learn"

    /// A category row's two counts, for the Gap Map cards and the deck's category
    /// list. The unmastered half is the SAME quantity the overviews label with
    /// `toLearnLabel`, so it carries the same name: "active" named it twice over
    /// ("343 To learn" above "180 active") and claimed a diagnosis the app has not
    /// made on day one. `separator` is " · " on screen and ", " for VoiceOver,
    /// which does not speak the middle dot.
    static func categoryCounts(toLearn: Int, mastered: Int, separator: String = " · ") -> String {
        "\(toLearn) \(toLearnLabel.lowercased())\(separator)\(mastered) mastered"
    }

    /// The Learn card's stat line — what is queued, and how much of it the learner
    /// has actually met. Before the first answer there is nothing to claim.
    static func learnCardStat(toLearn: Int, practised: Int) -> String {
        guard practised > 0 else { return "\(toLearn) to learn" }
        return "\(toLearn) to learn · \(practised) practised"
    }

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
    /// "amazing" at zero, and a real streak is named by its length. `lessonTarget`
    /// is the day's prescribed number of lessons (the plan's `lessonItem`): the day
    /// is only "done" once that many are finished, otherwise the greeting would
    /// wave the learner off after the first of three while the card right below it
    /// still reads "Lesson 2 of 3 today".
    static func subtitle(streak: Int, dueNow: Int, lessonsToday: Int,
                         lessonTarget: Int, placed: Bool) -> String {
        guard placed else { return "Take the short placement to start your plan." }
        let target = max(1, lessonTarget)
        let dayComplete = lessonsToday >= target
        if streak >= Tuning.streakStrongDays {
            return "\(streak)-day streak — keep it going!"
        }
        if streak >= Tuning.streakMomentumDays {
            return "\(streak) days in a row — nice momentum."
        }
        if streak >= 1 {
            if dayComplete { return "Day \(streak) done\(stillDue(dueNow))" }
            if lessonsToday > 0 { return "Day \(streak) — \(lessonsLeft(target - lessonsToday)) to go today." }
            return "Day \(streak) — a lesson today keeps it going."
        }
        if lessonsToday > 0 {
            return dayComplete
                ? "Today's lessons are done\(stillDue(dueNow, otherwise: "tomorrow makes it a streak."))"
                : "Good start today — tomorrow makes it a streak."
        }
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

    /// The tail of a "day done" line. The day's lessons being finished is not the
    /// same as the queue being empty: the staggered Foundation seed and every
    /// rescheduled miss leave cards due on the same screen that shows this
    /// greeting, so "see you tomorrow" contradicted the "N due now" chip right
    /// under it (firstrun-8-3). With nothing due the day really is done.
    static func stillDue(_ dueNow: Int, otherwise: String = "see you tomorrow.") -> String {
        dueNow > 0 ? " — \(dueNow) still due if you want more." : " — \(otherwise)"
    }

    /// "1 more lesson" / "2 more lessons" — the remainder of the day's plan.
    static func lessonsLeft(_ count: Int) -> String {
        let count = max(1, count)
        return "\(count) more lesson\(count == 1 ? "" : "s")"
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

    /// The Foundation bar's caption: the track ends where reading opens, so the
    /// number the learner is counting to is the gate's, not every base skill. A full
    /// bar is only ever on screen while the retention governor is holding the gate
    /// (otherwise the card has already been replaced by the open plan), so it says so.
    static func foundationProgress(done: Int, target: Int, governorHeld: Bool = false) -> String {
        let target = max(1, target)
        let done = min(max(0, done), target)
        guard done >= target else { return "\(done) of \(target) skills — reading opens here" }
        return governorHeld ? "\(done) of \(target) skills — consolidating before reading opens"
                            : "\(done) of \(target) skills — reading opens now"
    }

    /// The weekly-goal row's title. The goal counts DAYS WITH A COMPLETED LESSON,
    /// which is not what the seven-day streak grid next to it counts (any day with a
    /// correct answer), so the row states its own rule instead of leaving the two
    /// numbers to contradict each other.
    static func weeklyGoalTitle(met: Bool) -> String {
        met ? "Weekly goal met · days with a lesson" : "Weekly goal · days with a lesson"
    }

    /// "3 of 5 days this week" — the goal's progress, days with a completed lesson.
    static func weeklyGoalValue(done: Int, goal: Int) -> String {
        "\(done) of \(max(0, goal)) days this week"
    }

    /// The due-row stat. "Review" is a claim about evidence: on day one the whole
    /// row is the freshly seeded Foundation batch, cards the learner has never been
    /// asked about, which is exactly the claim `toLearnLabel` exists to stop making.
    /// So the wording follows the evidence — never practised → "to learn", all
    /// practised → "gaps to review", mixed → both halves named.
    static func gapsToReview(_ count: Int, practised: Int) -> String {
        let practised = min(max(0, practised), max(0, count))
        if practised == 0 { return "\(count) to learn" }
        if practised >= count { return "\(count) gap\(count == 1 ? "" : "s") to review" }
        return "\(count - practised) to learn · \(practised) to review"
    }

    /// The capture toast after an activity: "Saved 3 things you didn't know".
    static func captured(_ count: Int) -> String {
        "Saved \(count) thing\(count == 1 ? "" : "s") you didn't know"
    }
}
