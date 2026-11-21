# Audit findings ledger

Every finding the beta-readiness audit loop confirmed. In each round, seven auditors read their
area of the app; each finding is put to three independent refuters, survives only if fewer than
two refute it, and is fixed in its area. A refuter that fails to run is recorded as **unverified**,
never as a refutation.

| Round | Confirmed | High severity | Commit |
|---|---|---|---|
| 1 | 32 | — (two were compile errors) | `17dc6e3` |
| 2 | 29 | 2 (stated in commit) | `5528c39` |
| 3 | 28 | — | `59bec1f` |
| 4 | 25 | 5 (stated in commit) | `8a73474` |
| 5 | 22 | 6 | `fff0817` |
| 6 | 19 | 5 | `ecf9c0e` |
| 7 | 19 | 2 | `c204b8d` |
| 8 | 16 | 2 | `53c9393` |
| 9 | 18 | 0 | `4bd041a` |

**Total confirmed and fixed: 208.**

> **Rounds 1–4:** the per-finding entries were in the ledger file that was lost with the session
> scratch directory (November 2026). Each round's commit message describes its findings in full;
> the lead paragraph of each is quoted below. Run `git show <commit>` for the rest.

## Round 1 — 32 confirmed (`17dc6e3`)

Seven auditors read the app fresh, each finding was put to three independent refuters, and the 32 that survived were fixed by area.

## Round 2 — 29 confirmed (`5528c39`)

Two high-severity learning bugs led the round. A missed placement probe was turned into a deck card whose French side was the blank itself and whose "meaning" was a French word, so the learner was drilled on nonsense. And the displayed level climbed to B1 or B2 off answer accuracy while the learner was still locked inside A1 Foundation, so the app congratulated them on a level it would not let them practice.

## Round 3 — 28 confirmed (`59bec1f`)

The round's worst defect was found independently by two auditors: a missed check-in was re-asked as a remedial that showed the answer, and the store booked that as a passed check-in. Verification therefore recorded the opposite of what happened, and the same gap could be answered twice in one lesson because the match round also drew from check-in items. Check-ins are now excluded from remedials and from the match round, so a check-in is asked once and scored once.

## Round 4 — 25 confirmed (`8a73474`)

Five high. A whole feature was dead: the scenario guide could never be built, because the types it decodes the tutor's reply into did not match the reply's shape, so every attempt failed silently.

## Round 5

- [high/learning] lesson-5-1 ios/FluentFrenchIOS/Services/LessonScheduler.swift:174 — A capstone strips the fill-blank hint, so a correct French answer is graded "slipped"
- [high/ux] lesson-5-2 ios/FluentFrenchIOS/Services/Tuning.swift:98 — Three hearts over a ~14-question lesson: most lessons end early, and a hearts-out lesson advances nothing
- [medium/learning] lesson-5-3 ios/FluentFrenchIOS/Services/LessonAssembler.swift:146 — A skill card's worked example can be a reviewed item the same lesson then fill-blanks, handing over the answer
- [low/learning] lesson-5-4 ios/FluentFrenchIOS/Services/AnswerGrader.swift:75 — Nine shipped headwords contain "...", and the typed answer a learner would write is graded wrong
- [low/ux] lesson-5-5 ios/FluentFrenchIOS/Services/LessonSession.swift:738 — An AI-written fill-blank's listen button reads a different sentence from the one on screen
- [medium/learning] firstrun-5-1 ios/FluentFrenchIOS/State/AppStore.swift:487 — An abandoned or hearts-out lesson still advances the capstone cadence
- [medium/learning] firstrun-5-2 ios/FluentFrenchIOS/State/AppStore.swift:2070 — A "Recalibrate" retake silently discards every miss on material the learner already has, while promising the opposite
- [low/ux] firstrun-5-3 ios/FluentFrenchIOS/State/AppStore.swift:2368 — "Due now" counts prerequisite-blocked Foundation gaps that no lesson can ever offer
- [medium/learning] read-5-1 ios/FluentFrenchIOS/Views/ContentScreens.swift:742 — Tapping a word in the article body saves the elided/capitalised surface form, so the same word becomes two different deck cards
- [medium/ux] read-5-2 ios/FluentFrenchIOS/Services/NewsService.swift:272 — Every live story in the default feed is badged "SOCIETY", whatever it is about
- [low/ux] read-5-3 ios/FluentFrenchIOS/Models/ResourcesData.swift:79 — Several shipped idioms are filed under a theme that has nothing to do with them, so the category filter hides them
- [high/learning] talkmedia-5-1 ios/FluentFrenchIOS/State/AppStore.swift:2922 — Listen's line capture is the one save path with no card-size rule, so a whole dialogue line becomes a deck card
- [low/ux] talkmedia-5-2 ios/FluentFrenchIOS/Views/SpeakView.swift:86 — Speak keeps the previous round's feedback card after the Free/Guided/Write toggle
- [low/ux] talkmedia-5-3 ios/FluentFrenchIOS/Views/ScenariosView.swift:64 — Scenarios' bookmark is keyed by the search text, so a regenerated guide shows as already saved
- [low/ux] store-5-1 ios/FluentFrenchIOS/State/AppStore.swift:2151 — The whole record is JSON-encoded on the MainActor 250 ms after every answer
- [low/functionality] store-5-2 ios/FluentFrenchIOS/Services/CloudSync.swift:594 — A change made while an upload is in flight is marked as already backed up, so the background flush skips it
- [medium/learning] engine-5-1 ios/FluentFrenchIOS/State/AppStore.swift:1264 — A concept whose first evidence comes from Speak/Converse becomes .learning with no gaps — unteachable, yet ranks first in the plan
- [medium/ux] engine-5-2 ios/FluentFrenchIOS/State/AppStore.swift:495 — Every completed lesson re-announces the same "New skills unlocked" list
- [medium/ux] engine-5-3 ios/FluentFrenchIOS/Services/ConceptSelector.swift:720 — A lesson item's reason claims "This unlocks X" for a skill the learner already mastered
- [high/compile] compile-5-1 ios/FluentFrenchIOS/Services/ConverseService.swift:25 — ConverseService uses @Observable without importing Observation
- [high/compile] compile-5-2 ios/FluentFrenchIOS/Services/ElevenLabsTTS.swift:164 — ElevenLabsTTS's NaturalVoice uses @Observable without importing Observation
- [high/compile] compile-5-3 ios/FluentFrenchIOS/Services/VoiceRecorder.swift:16 — VoiceRecorder uses @Observable without importing Observation

### Refuted in round 5

- engine-5-4 — Answers on mastered concepts given through the deck, retention tabs or a capstone never count as check-ins (designed behaviour per workplan, negligible beta harm)

## Round 6 — 19 confirmed of 20 raw, 1 refuted

Fix phase was cut off by an account spend limit: the lesson, first-run and read
agents completed; talkmedia, store and engine never ran. Status is verified per
finding by whether the fix cites its id in the code.

FIXED
- [medium/learning] lesson-6-1 LessonScheduler.swift:383 — blind-spot probe on liaison/adjective placement asked "What does X mean?" over options that are not meanings
- [medium/learning] lesson-6-2 AnswerGrader.swift:39 — fill-blank advertised the article-carrying headword as "also accepted" though it cannot stand in the blank
- [medium/ux] lesson-6-3 LessonSession.swift:504 — every true/false miss logged as "True → False" with no word attached
- [medium/ux] firstrun-6-1 HomeView.swift:1435 — reading bridge offered "Today's Headlines" with no news feed behind it
- [medium/ux] firstrun-6-2 HomeCopy.swift:57 — "Day 1 done — see you tomorrow" above a card saying "Lesson 2 of 3 today"
- [low/ux] firstrun-6-4 AssessmentService.swift:207 — placement could stop at 5 questions while promising at least 6
- [low/ux] firstrun-6-5 HomeCopy.swift:129 — day-one seeded curriculum called "gaps to review"
- [high/learning] read-6-1 HeuristicTagger.swift:107 — every ordinary noun mis-filed onto a B1–C1 skill with no content
- [high/learning] read-6-2 TensesView.swift:90 — a saved conjugation became an unanswerable fill-blank ("j'_____")
- [low/ux] read-6-3 ContentScreens.swift:442 — reader marked words saved for the session only, re-offering deck words as new
- [high/functionality] store-6-1 SnapshotReconciler.swift:81 — unchanged server `updated_at` taken as proof the row had not moved, so a second device silently overwrote the first's progress
- [medium/ux] store-6-2 AppStore.swift:797 — "New skills unlocked" announced up to 20 skills with no content
- [medium/learning] engine-6-1 ConceptSelector.swift:739 — item reasons promised "This unlocks X" for skills with no content
- [medium/ux] engine-6-2 AppStore.swift:795 — same unlock announcement, second report

OPEN — no fix agent ran
- [high/functionality] talkmedia-6-1 MediaSupport.swift:531 — Listen's hold-to-capture refuses half the shipped dialogue, and every line of the first beginner one, as "Too long to save as a card"
- [high/learning] talkmedia-6-2 AppStore.swift:1346 — a Converse or Speak slip is booked as a failed retention check-in, so conversation alone can trip the governor and stop new material
- [medium/learning] store-6-3 AppStore.swift:2607 — `seedConceptContentIfNeeded` cannot seed 132 of 181 concepts, so the engine-5-1 fix no longer holds: a concept named by Speak feedback becomes permanently `.learning` with nothing to teach
- [low/ux] lesson-6-4 LessonCompleteStage.swift:120 — capstone completion screen lists slipped items twice (agent reported done; no citation in code, unverified)
- [low/ux] firstrun-6-3 HomeView.swift:1513 — locked Resources button disabled, so its unlock condition never reaches the screen (agent reported done; no citation in code, unverified)

### Refuted in round 6
- talkmedia-6-3 — a learner denying the microphone is told the device has no audio input (refuted on impact: .noInputDevice is not the denial path, and the real denial case does surface a Settings route)

## Round 7 — 19 confirmed of 24 raw, 5 refuted, 0 unverified (all fixed)

- [high/compile] compile-7-1 ios/FluentFrenchIOS/Views/ContentScreens.swift:76 — SwiftUI-only view files use Foundation members with MEMBER_IMPORT_VISIBILITY on and no `import Foundation`
- [high/functionality] store-7-1 ios/FluentFrenchIOS/Services/CloudSync.swift:437 — a cloud read issued while the lesson-end upload is still encoding can roll the device back to the pre-lesson snapshot
- [medium/functionality] store-7-2 ios/FluentFrenchIOS/Services/CloudSync.swift:603 — clientUpdatedAt truncated to whole seconds in the row but full precision in the marker, so every sync is followed by a needless full remote-apply that re-rolls the day's plan
- [low/functionality] store-7-3 ios/FluentFrenchIOS/State/AppStore.swift:364 — isTeachable rebuilds the whole 598-item curriculum on every call (regression from 0445cf2)
- [low/functionality] engine-7-3 ios/FluentFrenchIOS/Services/ConceptSelector.swift:749 — the item reason asks it once per item: 9 rebuilds, ~90% of a selection's cost (same regression)
- [medium/learning] read-7-1 ios/FluentFrenchIOS/Services/HeuristicTagger.swift:291 — theme-vocabulary triggers match the English gloss, filing a French word on a skill because its meaning contains a theme keyword
- [medium/learning] talkmedia-7-1 ios/FluentFrenchIOS/Views/WatchPlayerView.swift:1048 — a word saved from a machine-translated Watch transcript is filed as French "seen in the wild"
- [medium/ux] firstrun-7-1 ios/FluentFrenchIOS/Views/DeckView.swift:89 — deck header draws the stats pill on top of the title and subtitle
- [medium/ux] firstrun-7-2 ios/FluentFrenchIOS/Views/HomeView.swift:209 — the Kiri overlay covers and swallows taps on the top-right of Home's stats card
- [low/ux] firstrun-7-3 ios/FluentFrenchIOS/Views/GapsView.swift:183 — the same seed count is "To learn" in overviews and "active" in category rows
- [low/functionality] firstrun-7-4 ios/FluentFrenchIOS/Views/KiriView.swift:165 — Kiri's idle-hop timer reschedules itself forever, outliving the screen
- [low/learning] lesson-7-3 ios/FluentFrenchIOS/Services/AnswerGrader.swift:112 — "Also accepted" advertises spellings that are not French
- [low/ux] lesson-7-4 ios/FluentFrenchIOS/Views/Lesson/LessonViewModel.swift:412 — leaving a hearts-out lesson with the X books it abandoned though the app's own rule counts it
- [low/learning] lesson-7-5 ios/FluentFrenchIOS/Views/Lesson/LessonViewModel.swift:97 — a full-size first lesson always asks one new word that was never taught
- [low/ux] talkmedia-7-2 ios/FluentFrenchIOS/Views/ConverseView.swift:913 — recap reports a correction as newly saved when the card was already there
- [low/ux] talkmedia-7-3 ios/FluentFrenchIOS/Views/SpeakView.swift:140 — Speak's "saved" stat shrinks as the learner masters what they saved
- [low/learning] read-7-2 ios/FluentFrenchIOS/Services/NewsService.swift:290 — the live level estimate glues the punctuation-less headline onto the first sentence, biasing every estimate upward
- [low/functionality] read-7-3 ios/FluentFrenchIOS/Services/SentenceExtractor.swift:41 — a full stop followed by a closing quote duplicates punctuation in the saved context sentence
- [low/functionality] engine-7-4 ios/FluentFrenchIOSTests/HeadlessDriverTests.swift:403 — the 60-day Foundation-pacing assertion cannot fail: it re-derives the number the harness chose

### Refuted in round 7

- lesson-7-1 — accent-folded grading on minimal pairs (deliberate, documented: .closeAccents grades .hard and shows the right form; only 3 of 598 testable blanks fold to a genuinely distinct word)
- lesson-7-2 — remedial evidence (real, but already fixed in d3dc992 in response to this same finding arriving unverified)
- engine-7-1 — Foundation seed released faster than lessons consume it ("due now" climbing to ~500): the cited numbers cannot occur on the real first-run path
- engine-7-2 — capstone cadence counted in lessons: the mechanics are as described but it is the designed behaviour, and the row is additive rather than blocking
- compile-7-2 — AppStore and three model files importing SwiftUI while using Foundation members: refuters split; resolved anyway in 91ee880 by naming the dependency

## Round 8 — 16 confirmed of 23 raw, 7 refuted, 0 unverified (all fixed)

- [high/learning] lesson-8-1 AnswerGrader.swift:83 — blank-form alternatives graded correct AND advertised in the translation format, teaching the wrong form
- [high/compile] read-8-1 Models/ResourcesData.swift:60 — Foundation members used without importing Foundation
- [medium/learning] engine-8-1 ConceptSelector.swift:341 — the ranker never penalises a concept ABOVE the learner's level: a declared beginner was taught B1 grammar in week 2 while 13 of 28 core A1 skills were never a lesson target in 60 days
- [medium/functionality] store-8-1 CloudSync.swift:792 — sync markers round-trip Dates lossily, so "is this device backed up?" is wrong about half the time
- [medium/ux] store-8-2 CloudSync.swift:749 — reading the cloud snapshot re-encodes and parses the whole record three times on the MainActor
- [low/ux] store-8-4 AppStore.swift:465 — `learnerLevel` builds a full concept index on every read, including per row in list bodies
- [medium/learning] firstrun-8-1 AssessmentService.swift:466 — every placement question reveals the answer with no reason; the content's example is loaded and never shown
- [medium/ux] firstrun-8-2 GapCardView.swift:36 — deck cards flag prerequisite-blocked gaps "Due now" while every count and lesson excludes them
- [medium/ux] firstrun-8-3 HomeCopy.swift:74 — Home says the day is done with cards due on the same screen
- [medium/ux] firstrun-8-4 AppStore.swift:2584 — crossing the demonstrated-minutes bar opens an activity silently
- [medium/learning] read-8-2 AppStore.swift:2812 — a word spelled the same in French and English becomes a card whose question contains its answer
- [medium/ux] lesson-8-3 LessonQuestionParser.swift:240 — an AI fill-blank with more than one blank leaves two holes and one field
- [medium/learning] lesson-8-4 LessonScheduler.swift:375 — "Practice these now" over one or two items asks the identical question twice and still books a completed lesson
- [medium/functionality] talkmedia-8-2 SpeakView.swift:83 — a Control Centre swipe ends the recording and the learner is told it was interrupted
- [low/learning] engine-8-2 FSRS.swift:137 — a lapse is purely multiplicative with no ceiling, so a card just proved forgotten is rescheduled weeks out
- [low/functionality] engine-8-3 HeadlessDriverTests.swift:393 — the only calibration assertion in the 60-day runs cannot fail

### Refuted in round 8
- lesson-8-2, lesson-8-5, firstrun-8-5, talkmedia-8-1, talkmedia-8-3, store-8-3, engine-8-4

## Round 9 — 18 confirmed of 20 raw, 2 refuted, 0 unverified (all fixed). FIRST ROUND WITH NO HIGH.

- [medium/learning] lesson-9-1 LessonScheduler.swift:365 — the fill-blank hint prints the French answer for nine shipped items
- [medium/learning] lesson-9-2 LessonQuestionParser.swift:226 — an AI multiple choice can offer a second correct meaning and grade it wrong
- [low/learning] lesson-9-3 AnswerGrader.swift:45 — article leniency keyed to GapCategory, so "riz" is wrong for "rice" in a pronunciation concept
- [medium/learning] engine-9-1 ConceptSelector.swift:292 — a one-shot probe gap permanently pins its concept's urgency at maximum
- [medium/learning] engine-9-2 ConceptSelector.swift:296 — overdue-ness overrides level fit, so an untouched B1 skill outranks the A1 skill a beginner is mid-way through (follow-on to engine-8-1)
- [medium/learning] engine-9-3 AppStore.swift:2130 — a band-INFERRED placement seed becomes VERIFIED mastery, and coverage toward the reading unlock, after two correct answers
- [low/functionality] engine-9-4 ConceptSelector.swift:661 — the capstone pulls blind-spot probe items in and the scheduler silently drops them
- [medium/learning] read-9-1 AppStore.swift:2938 — a word saved offline becomes a card whose meaning is the word itself once it resolves
- [medium/ux] read-9-2 GapCardView.swift:51 — a capture still waiting for its meaning is stamped "Due now"
- [low/functionality] read-9-3 ReadView.swift:282 — two searches in flight race; an older query's results can land under a newer one
- [low/ux] read-9-4 TensesView.swift:114 — the Tenses page re-scans the whole deck ~110 times per render
- [low/functionality] read-9-5 DailyPlanEngine.swift:260 — words saved with no meaning inflate the day's lesson target
- [medium/ux] firstrun-9-1 HomeView.swift:1130 — Home's capture toast counts curriculum the store seeded, not what the learner saved
- [medium/ux] firstrun-9-2 Readiness.swift:79 — with the governor holding reading, Home tells a learner at 14/14 skills to "build the basics first"
- [low/functionality] firstrun-9-3 HomeView.swift:352 — Home reruns the whole concept selection and three due-now scans per body evaluation
- [low/ux] talkmedia-9-1 ConverseRecap.swift:154 — a tutor note whose rewrite matches the learner's line vanishes, and the recap then says nothing was corrected
- [medium/functionality] store-9-1 ContentView.swift:272 — "Sign out" on the recovery screen is one unconfirmed tap that deletes the preserved unreadable copy
- [medium/compile] compile-9-1 WelcomeView.swift:185 — Foundation members with no import, via initialiser and format-style spellings

### Refuted in round 9
- store-9-2 (dueNow rescan cost — mechanism real, magnitude off by an order of magnitude)
- store-9-3 (ProgressSnapshot tolerant decoder — the triggering input cannot exist)
