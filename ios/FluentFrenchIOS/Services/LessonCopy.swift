//
//  LessonCopy.swift
//  FluentFrenchIOS
//
//  Lesson wording decided in one place, next to `HomeCopy`, so the lesson views
//  only render. Three rules live here:
//
//  - "Mastered" belongs to the engine's real mastery (a run of
//    `Tuning.gapMasteryStreak` across sessions). Two right answers inside one
//    lesson are "solid" for this lesson, never "mastered" (UX-04) — otherwise
//    the lesson flashes "Mastered!" and Home then says "0 mastered this week".
//  - A question carries at most ONE learner-facing status pill, worded for the
//    learner, not the engine: "Try again" or "Quick check" (UX-13).
//  - The completion screen continues the day with numbers read off the same data
//    Home's daily target and streak use (UX-05; see `AppStore.nextLessonOffer`).
//  - The flame belongs to the DAY streak alone. The in-lesson run of right answers
//    (the combo) is a "run … in a row" with its own symbol, so the completion
//    screen never shows two flames that mean two different things.
//

import Foundation

/// The one status pill a question may show (UX-13). The view maps each case to a
/// colour; the wording is `text`.
nonisolated enum LessonPill: Hashable {
    /// A remedial: the second look at something just missed.
    case tryAgain
    /// A probe or a check-in: a single question to see where the learner is.
    case quickCheck
    /// A milestone quiz item.
    case capstone

    var text: String {
        switch self {
        case .tryAgain: return "Try again"
        case .quickCheck: return "Quick check"
        case .capstone: return "Capstone"
        }
    }
}

nonisolated enum LessonCopy {

    // MARK: In-session progress (UX-04)

    /// The flash when an item reaches `Tuning.masteryTarget` unaided right answers
    /// in this lesson. Not "Mastered!": that word is kept for real mastery.
    static let solidFlashTitle = "Got it!"

    /// The completion row counting the items that went solid this lesson. Worded
    /// with the practice bar's own "solid", not a boast: "Nailed" read as praise
    /// under a low-accuracy "Keep going" title (UX re-review 3).
    static let solidSummaryLabel = "Solid this lesson"

    /// The practice bar's counter: "3/7 solid", or "3 solid" when the schedule has
    /// nothing left that could still go solid.
    static func solidProgress(solid: Int, of total: Int) -> String {
        total > 0 ? "\(solid)/\(total) solid" : "\(solid) solid"
    }

    /// The same counter for VoiceOver, which would read "3/7" as "three slash seven".
    static func solidProgressSpoken(solid: Int, of total: Int) -> String {
        total > 0 ? "\(solid) of \(total) solid" : "\(solid) solid"
    }

    /// The intro's one-line summary under the title.
    static func introSubtitle(itemCount n: Int, isCapstone: Bool) -> String {
        let items = "\(n) item\(n == 1 ? "" : "s")"
        if isCapstone {
            return "\(items) · one question each — your first answer is what counts."
        }
        // Not "each": check-ins are asked once, and a skill you show you already
        // have is released early — so promising every item twice is a promise the
        // lesson does not keep.
        return "\(items) · answer an item right \(Tuning.masteryTarget)× to make it solid."
    }

    /// The intro's hearts note, in two short sentences (UX-20). True to
    /// `LessonSession`: a miss costs a heart, a missed retry (the remedial) does
    /// not, and at zero the lesson ends on the recap of what slipped.
    static func heartsNote(hearts: Int) -> String {
        "\(hearts) hearts: a miss costs one, a retry is free. At zero, you'll see what slipped."
    }

    /// The capstone's note in the hearts note's place: it runs without hearts.
    static let capstoneHeartsNote = "No hearts and no retries: a capstone is a check, not a drill."

    // MARK: Status pill (UX-13)

    /// At most one pill per question. A remedial leads (the learner just missed
    /// it, so "Try again" is the most useful thing to say); a probe or a check-in —
    /// or a check-in riding a probe item — is a "Quick check"; a capstone item says
    /// so. Anything else (including the old "Tuned to your level") shows nothing.
    static func statusPill(isRemedial: Bool, isProbe: Bool, isCheckIn: Bool, isCapstone: Bool) -> LessonPill? {
        if isRemedial { return .tryAgain }
        if isProbe || isCheckIn { return .quickCheck }
        if isCapstone { return .capstone }
        return nil
    }

    static func statusPill(for question: LessonQuestion) -> LessonPill? {
        statusPill(isRemedial: question.isRemedial, isProbe: question.isProbe,
                   isCheckIn: question.isCheckIn, isCapstone: question.isCapstone)
    }

    // MARK: Quick checks (UX-13)

    /// The selector's check-in items, in the pill's words: the engine calls them
    /// check-ins, the learner only ever reads "quick check".
    static let quickCheckHeadline = "Today: quick checks — making sure what you've learned still holds."

    /// How a check-in's reason opens. The practice header drops a reason that
    /// opens this way: its "Quick check" pill already says it (UX re-review 3).
    static let quickCheckReasonLead = "Quick check: does "

    /// The reason a quick-check item carries onto the intro and the teaching card.
    static func quickCheckReason(conceptName: String) -> String {
        "\(quickCheckReasonLead)\(conceptName) still hold?"
    }

    /// The reason a check-in on a placement-seeded (provisional) skill carries:
    /// learner words for "placement said you know this, and we are confirming it".
    /// Was "Verifying what placement said you know: X." (UX re-review 3).
    static func placementCheckReason(conceptName: String) -> String {
        "Checking what your level check found: \(conceptName)."
    }

    /// The reason line under a question's header, or nil when the status pill
    /// already says it: a "Quick check" pill over "Quick check: does X still
    /// hold?" said the same thing twice. A reason that adds something (a
    /// placement check, a skill not met yet) stays.
    static func questionReasonLine(_ reason: String?, pill: LessonPill?) -> String? {
        guard let reason else { return nil }
        if pill == .quickCheck && reason.hasPrefix(quickCheckReasonLead) { return nil }
        return reason
    }

    // MARK: The answer run (combo)

    /// The run's symbol, shared by the practice chip, the intro's best card and the
    /// completion row. Never the flame: that is the day streak's.
    static let runSymbol = "bolt.fill"

    /// The practice bar's chip label next to the live run: "4 in a row".
    static let runChipLabel = "in a row"

    /// The completion row's label and value: "Best run" · "4 in a row".
    static let bestRunLabel = "Best run"

    static func bestRunValue(_ n: Int) -> String { "\(n) in a row" }

    /// The intro's personal-best line: "85% first-try accuracy · best run 6 in a row".
    static func personalBestLine(accuracyPercent: Int, bestRun: Int) -> String {
        "\(accuracyPercent)% first-try accuracy · best run \(bestRun) in a row"
    }

    // MARK: Completion: continue the day (UX-05)

    static let nextLessonButton = "Next lesson"
    static let doneButton = "Done"
    static let practiceMissedButton = "Practice these now"

    /// Shown in place of "Next lesson" once it came back `.empty`: the Smart selector
    /// found nothing practicable right now (everything is resting until its next
    /// review is due), so a second tap would do nothing — the button goes away.
    static let nextLessonExhausted = "That's everything for now — come back later for more."

    /// Where the day stands. "Lesson 1 of 3 done" when this lesson counted and the
    /// day still has lessons to go; "Today's 3 lessons done" once the target is met.
    /// A lesson that did not count never claims a number of its own.
    static func dayLine(_ offer: NextLessonOffer) -> String {
        let target = max(1, offer.target)
        let done = offer.lessonsToday
        if done >= target {
            if done > target { return "\(done) lessons today — \(target) was the goal" }
            return target == 1 ? "Today's lesson done" : "Today's \(target) lessons done"
        }
        if offer.counted && done > 0 { return "Lesson \(done) of \(target) done" }
        return "\(done) of \(target) lessons done today"
    }

    /// The streak, named by its length — only once today actually counts toward it
    /// (a correct answer today). "Day 1 streak started" when this lesson started
    /// it; nil when nothing today has extended it, so zero is never celebrated.
    static func streakLine(_ offer: NextLessonOffer) -> String? {
        guard offer.practisedToday, offer.streak >= 1 else { return nil }
        if offer.streak == 1 && offer.streakTickedThisLesson { return "Day 1 streak started" }
        return "Day \(offer.streak) streak"
    }

    /// VoiceOver reads both lines as one sentence.
    static func spokenSummary(_ offer: NextLessonOffer) -> String {
        [dayLine(offer), streakLine(offer)].compactMap { $0 }.joined(separator: ", ")
    }
}


// MARK: - Completion buttons (UX-05)

/// Which buttons the completion screen shows and which one leads, decided here so
/// the view only renders them.
///
/// - A lesson that ran out of hearts leads with "Practice these now": the recap is
///   about what slipped, so going over it outranks starting something new.
/// - Otherwise "Next lesson" leads while the day has lessons to go.
/// - An action that already came back empty is not offered again (a tap that does
///   nothing must not stay on screen); "Next lesson" leaves a line saying why.
/// - "Done" never looks like a second "Next lesson": under the out-of-hearts lead
///   it is a plain text action, so the recap's two ways forward and its way out
///   read as three different things (UX re-review 3).
/// - When the out-of-hearts lead "Practice these now" comes back empty, its notice
///   shows by the bottom buttons where the learner tapped, instead of in the card.
nonisolated struct LessonCompletionActions: Hashable {
    enum Lead: Hashable { case practiceMissed, nextLesson, done }

    /// How "Done" is drawn: the filled lead, the tinted secondary button, or a
    /// plain text action below the others.
    enum DoneStyle: Hashable { case primary, secondary, plain }

    /// The primary button.
    var lead: Lead
    /// "Next lesson" is on screen, as the lead or as a secondary button.
    var offersNextLesson: Bool
    /// "Practice these now" sits inside the missed card (it is not the lead).
    var practiceInMissedCard: Bool
    /// The line shown where "Next lesson" was, once it came back empty.
    var nextLessonNote: String?
    /// How "Done" is drawn.
    var doneStyle: DoneStyle
    /// "Practice these now" led the recap and came back empty: its notice goes
    /// next to the bottom buttons instead of the missed card (never printed twice).
    var practiceNoticeByButtons: Bool

    /// - Parameters:
    ///   - outOfHearts: the lesson ended at zero hearts.
    ///   - hasMissed: the recap lists missed items.
    ///   - practiceExhausted: "Practice these now" already came back empty.
    ///   - nextAvailable: `NextLessonOffer.nextAvailable`.
    ///   - nextExhausted: "Next lesson" already came back empty.
    static func resolve(outOfHearts: Bool, hasMissed: Bool, practiceExhausted: Bool,
                        nextAvailable: Bool, nextExhausted: Bool) -> LessonCompletionActions {
        let canPractice = hasMissed && !practiceExhausted
        let offersNext = nextAvailable && !nextExhausted
        let lead: Lead
        if outOfHearts && canPractice {
            lead = .practiceMissed
        } else if offersNext {
            lead = .nextLesson
        } else {
            lead = .done
        }
        let doneStyle: DoneStyle
        switch lead {
        case .done: doneStyle = .primary
        case .nextLesson: doneStyle = .secondary
        case .practiceMissed: doneStyle = .plain
        }
        return LessonCompletionActions(lead: lead, offersNextLesson: offersNext,
                                       practiceInMissedCard: canPractice && lead != .practiceMissed,
                                       nextLessonNote: nextExhausted ? LessonCopy.nextLessonExhausted : nil,
                                       doneStyle: doneStyle,
                                       practiceNoticeByButtons: outOfHearts && hasMissed && practiceExhausted)
    }
}
