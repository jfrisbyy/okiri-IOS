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

    // MARK: One vocabulary (UX-12)
    //
    // The learner's own deck and the category map each have ONE learner-facing
    // name. "Gap" is engine vocabulary; types and persisted keys keep it, the
    // screens never say it.

    /// The learner's deck: the Home card, the deck screen's title, capture copy.
    static let myWordsTitle = "My words"
    /// The per-category map (the Resources entry and its screen's title).
    static let progressTitle = "Progress"

    /// The stats chip unit for `masteredThisWeek` (UX-15): "week" alone read as a
    /// unit of time, not as "mastered this week".
    static let masteredThisWeekUnit = "mastered this wk"

    /// The intro line on the Preferences screen when it is asked (UX-06). It is
    /// only ever asked once Reading is open (`AppStore.shouldAskPreferences`), so
    /// the line is always true when it shows.
    static let preferencesAskIntro = "You've unlocked Reading — how do you want to spend your time?"
    /// The same screen for a learner whose Reading was open before any lesson was
    /// played (`AppStore.preferencesAskIntro`): nothing was unlocked in front of
    /// them, their level opens it.
    static let preferencesPlacedIntro = "Your level opens Reading now — how do you want to spend your time?"

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

    /// The My words card's stat line. Before any card has been reviewed the due
    /// number is the freshly seeded batch, not a backlog (UX-15,
    /// `AppStore.showsDueCount`), so it is not called "due": it is what the first
    /// lessons start on — the same words the deck itself then offers.
    static func deckCardStat(due: Int, showsDueCount: Bool) -> String {
        showsDueCount ? "\(due) \(dueNowLabel.lowercased())" : firstWordsReady(due)
    }

    // MARK: My words before the first review (UX-15)
    //
    // The deck, the Home "My words" card and the Learn card follow ONE rule
    // (`AppStore.showsDueCount`): until a card has been reviewed, the queued batch
    // is the freshly seeded Foundation set, so no surface calls it "due".

    /// "20 words ready for your first lessons"; "Nothing to review yet" when the
    /// seeded batch is not due yet either.
    static func firstWordsReady(_ count: Int) -> String {
        guard count > 0 else { return "Nothing to review yet" }
        return "\(count) word\(count == 1 ? "" : "s") ready for your first lessons"
    }

    /// The label under the deck header's first number: "Due now", or "Ready" for
    /// the seeded batch before any review.
    static func deckQueueLabel(showsDueCount: Bool) -> String {
        showsDueCount ? dueNowLabel : "Ready"
    }

    /// The deck's spaced-repetition summary: "4 due now · 12 coming up", or the
    /// first-lessons line before any review.
    static func deckReviewSummary(due: Int, upcoming: Int, showsDueCount: Bool) -> String {
        showsDueCount ? "\(due) \(dueNowLabel.lowercased()) · \(upcoming) \(upcomingLabel.lowercased())"
                      : firstWordsReady(due)
    }

    /// The deck's review button. Before any review it starts on the ready batch
    /// without calling it a review of what is due.
    static func deckReviewButton(due: Int, showsDueCount: Bool) -> String {
        guard due > 0 else { return "Review what's coming up" }
        return showsDueCount ? "Review due now" : "Start on these words"
    }

    /// The VoiceOver hint of `deckReviewButton`.
    static func deckReviewHint(due: Int, showsDueCount: Bool) -> String {
        guard due > 0 else { return "Starts an early review of what is coming up" }
        return showsDueCount ? "Starts a review of the cards due today" : "Starts a lesson on the words ready for you"
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
    ///
    /// `firstLessonPending` (no lesson ever played, UX-15): the day-one queue is the
    /// freshly seeded Foundation batch, so "20 due now" named a backlog the learner
    /// never took on. The line names the one thing to do instead.
    static func subtitle(streak: Int, dueNow: Int, lessonsToday: Int,
                         lessonTarget: Int, placed: Bool, firstLessonPending: Bool = false) -> String {
        guard placed else { return "Take the short placement to start your plan." }
        if firstLessonPending {
            return "Your first lesson is ready — about \(Tuning.lessonEstimateMinutes) minutes."
        }
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
    /// While reading is still locked the learner is drilling the A1 Foundation,
    /// whatever level placement measured, so the badge says "Foundation", never
    /// "Studying" — a learner placed at B2 is not studying B2 yet (firstrun-10-3;
    /// round 2 fixed the same claim only for ability drifting up from answers).
    static func levelBadge(placed: Bool, level: CEFRLevel, inFoundation: Bool) -> String {
        guard placed else { return "Not placed" }
        return inFoundation ? "\(level.rawValue) · Foundation" : "\(level.rawValue) · Studying"
    }

    /// "Placed at A2" for the CEFR sheet's secondary line; nil before placement.
    static func placedLine(placed: Bool, assessedLevel: CEFRLevel) -> String? {
        placed ? "Placed at \(assessedLevel.rawValue)" : nil
    }

    /// The CEFR sheet's line under its title: "Placed at B2 · building the Foundation
    /// first" while reading is locked, "Placed at A2 · now studying at B1" once it is
    /// open (firstrun-10-3); nil before placement.
    static func cefrSheetLine(placed: Bool, assessedLevel: CEFRLevel, learnerLevel: CEFRLevel,
                              inFoundation: Bool) -> String? {
        guard let line = placedLine(placed: placed, assessedLevel: assessedLevel) else { return nil }
        return inFoundation ? "\(line) · building the Foundation first"
                            : "\(line) · now studying at \(learnerLevel.rawValue)"
    }

    /// The CEFR sheet row marked "In Progress": the displayed level once reading is
    /// open; none before placement or while the learner is still in Foundation
    /// (firstrun-10-3).
    static func cefrLevelInProgress(placed: Bool, level: CEFRLevel, inFoundation: Bool) -> CEFRLevel? {
        placed && !inFoundation ? level : nil
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

    /// The Foundation card's call to action (UX-15): "Start: Greetings" for a
    /// concept no lesson has taught yet — on day one, every one — and
    /// "Continue: Greetings" only once a lesson has; "Review the basics" when the
    /// selector has no concept to teach.
    static func foundationLessonTitle(conceptName: String?, started: Bool) -> String {
        guard let conceptName else { return "Review the basics" }
        return started ? "Continue: \(conceptName)" : "Start: \(conceptName)"
    }

    /// The line under `foundationLessonTitle`.
    static func foundationLessonDetail(firstLessonPending: Bool) -> String {
        firstLessonPending ? "Tap to start your first lesson" : "Tap to start your next basics lesson"
    }

    /// The Foundation bar's caption: the track ends where reading opens, so the
    /// number the learner is counting to is the gate's, not every base skill. A full
    /// bar is only ever on screen while the retention governor is holding the gate
    /// (otherwise the card has already been replaced by the open plan), so it says so
    /// — and says what to do (UX-25): coverage is met, so releasing the governor
    /// opens reading live (`AppStore.readiness`).
    static func foundationProgress(done: Int, target: Int, governorHeld: Bool = false) -> String {
        let target = max(1, target)
        let done = min(max(0, done), target)
        guard done >= target else { return "\(done) of \(target) skills — reading opens here" }
        return governorHeld ? "\(done) of \(target) skills — review what you've learned to open reading"
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
    /// practised → "to review", mixed → both halves named.
    static func gapsToReview(_ count: Int, practised: Int) -> String {
        let practised = min(max(0, practised), max(0, count))
        if practised == 0 { return "\(count) to learn" }
        if practised >= count { return "\(count) to review" }
        return "\(count - practised) to learn · \(practised) to review"
    }

    // MARK: Error-pattern detail (firstrun-10-4)
    //
    // The detail screen used to explain every pattern with a fixed sentence picked by
    // category ("You confuse the meaning of this item with a similar word…") — a
    // diagnosis nothing in the error record measures, shown even for one mistake and
    // for word groups with no concept. Like the headline (`AppStore.errorPatterns`),
    // it now states only what the data shows, plus the concept's AUTHORED common
    // mistake when the group has a concept whose content carries one.

    /// "3 mistakes on Definite articles so far — your answers are below." A word
    /// group (`word:<french>`) quotes the word.
    static func errorPatternSummary(patternId: String, label: String, count: Int) -> String {
        let count = max(1, count)
        let mistakes = count == 1 ? "1 mistake" : "\(count) mistakes"
        let subject = patternId.hasPrefix("word:") ? "“\(label)”" : label
        return "\(mistakes) on \(subject) so far — your answers are below."
    }

    /// The concept's authored `teaching.commonMistake`, or nil — always nil for a
    /// word group, which has no concept to speak for.
    static func errorPatternCommonMistake(patternId: String,
                                          teaching: (String) -> FoundationTeachingContent?) -> String? {
        guard !patternId.hasPrefix("word:"),
              let text = teaching(patternId)?.commonMistake?.trimmingCharacters(in: .whitespacesAndNewlines),
              !text.isEmpty else { return nil }
        return text
    }

    /// The capture toast after an activity: "Saved 3 things you didn't know".
    static func captured(_ count: Int) -> String {
        "Saved \(count) thing\(count == 1 ? "" : "s") you didn't know"
    }

    // MARK: Capture wording (UX-12)
    //
    // Every save affordance names the learner's deck by its ONE learner-facing
    // name, `myWordsTitle`: the screen the saved card lands on is called "My
    // words", so the button that puts it there says so too. "Deck" stays in type
    // names and persisted keys only.

    /// The save button's call to action.
    static let saveToMyWords = "Save to \(myWordsTitle)"
    /// The state after a save went through.
    static let savedToMyWords = "Saved to \(myWordsTitle)"
    /// The state when the item was already saved earlier.
    static let alreadyInMyWords = "Already in \(myWordsTitle)"
    /// The short saved-state label on compact rows ("In My words").
    static let inMyWords = "In \(myWordsTitle)"

    /// "Save tu es to My words" — the VoiceOver label for a save button that names its item.
    static func saveItemToMyWords(_ item: String) -> String {
        "Save \(item) to \(myWordsTitle)"
    }

    /// "tu es is already in My words" — the VoiceOver label once that item is saved.
    static func itemAlreadyInMyWords(_ item: String) -> String {
        "\(item) is already in \(myWordsTitle)"
    }

    /// "Adds this word to My words" — the VoiceOver hint of a save button; `kind`
    /// is what is being saved ("word", "idiom", "form").
    static func addsToMyWords(_ kind: String) -> String {
        "Adds this \(kind) to \(myWordsTitle)"
    }
}
