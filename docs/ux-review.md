# Okiri iOS: UX review before the closed beta

Reviewed 2026-11-21 from the SwiftUI source in `ios/FluentFrenchIOS/` only. Nothing was run on a device or in a simulator, so every screen below is rebuilt from code. Where a judgement depends on rendering, it says so, and the last section lists what to check by hand. No Swift file was changed.

## Verdict

**Not beta-ready as it stands, but it is close.** Three cheap fixes would make it ready. The engine, the honesty of the copy and the accessibility groundwork (Dynamic Type scaling, VoiceOver labels, Reduce Motion, a recovery path on every error) are better than most shipping apps. Too many rough edges sit on the main path, though:

- the app breaks in Dark Mode;
- the app is called "FluentFrenchIOS" on the home screen and "FluentFrench" in the microphone prompt, while every screen says "Okiri";
- the floating back button on Home's sections stacks on top of the reader's own back button.

**The single biggest UX risk is the first 10 minutes for a beginner:**

- They sign in to a screen that never says "French".
- They place in.
- They are asked to pick activities and a time budget, none of which applies to them yet.
- They land on a Home where nearly everything carries a padlock, and they are told "20 due now" for words they have never seen.
- They finish a lesson that flashes "Mastered!" several times, tap "Done", and return to a Home that says "0 mastered this week". Nothing marks the streak they just started.

Each step is defensible on its own. Together they make the product feel locked, confusing about progress, and unrewarding on day one, and day one is when a beta cohort decides whether to come back.

Separately, apps that let people create an account must also let them delete it in-app before App Store submission (guideline 5.1.1(v)). That is not needed for a closed TestFlight beta, but it should be on the plan.

## Counts

| Severity | Count | Beta blockers |
|---|---|---|
| Blocker | 3 | 3 |
| High | 10 | 0 |
| Medium | 18 | 0 |
| Low | 9 | 0 |
| **Total** | **40** | **3** |

---

## Flow-by-flow walkthrough

### 1. First launch → sign-in → placement → preferences → first Home → first lesson

**Reconstructed path (beginner).**

1. The `LaunchLoadingView` spinner, then `WelcomeView`: the "Okiri" wordmark, the line "Your progress, saved and synced everywhere.", and the Apple and Google buttons.
2. After sign-in, a spinner while the account is reconciled (`ContentView.swift:76`).
3. `RootView` renders `HomeView`, then raises the placement as a full-screen cover on `onAppear` (`RootView.swift:23-35`, `48-56`).
4. Placement intro → "I'm a complete beginner", or 6–12 questions at three taps each (select, Check, Continue) → results ("A1 placed at", the Vocabulary and Grammar bars, "Starting with Foundation") → "Start building the basics".
5. The cover dismisses to Home, then a second cover rises: `PreferencesView(isOnboarding: true)`.
6. "Start learning" → Home.
7. Home: the Foundation card "Continue: \<concept\>" → lesson intro "Ready to practice?" → Start → the "Learn before you practice" card carousel → "Start practice" → (sometimes "Crafting your lesson…", up to `Tuning.lessonGenerationTimeout` = 10 s, skippable) → the first question.

**Time to first value.** A beginner who takes the shortcut needs about 8 deliberate taps and two system sheets to reach the first question, roughly 60–90 seconds. A learner who takes the placement adds 18–36 taps, about 2–4 minutes. That is acceptable. The friction lies in what is asked along the way, not in the count.

**What works**

- The placement is short and honest. The engine sets its length (6–12 items) and the copy states it ("up to 12 questions, fewer if we can tell sooner", `AssessmentView.swift:91`). "I'm a complete beginner" is a respectful exit (`AssessmentView.swift:106-113`). A missed item teaches its example (`AssessmentView.swift:301-311`).
- The first-run placement cannot be swiped away by accident (`interactiveDismissDisabled`). It is never re-asked of a learner who already placed on another device, because the reconcile gates it (`RootView.swift:48-56`).
- The microphone permission is requested only when the learner first taps record, never at launch. A denial gets an "Open Settings" deep link and a typed alternative (`SpeakView.swift:97-107`, `TalkSupport.swift:105`).
- Every recovery screen states what happened and offers a way out (`ContentView.swift:198-322`, `394-436`).

**What does not work**

- **The welcome screen never says what the app does.** "Your progress, saved and synced everywhere." (`WelcomeView.swift:84`) is a backup promise. The only other copy is a consent line about backups (`WelcomeView.swift:170`). A tester sees no "French", no "learn" and no reason to trust the app with an Apple ID. Guest mode is excluded by owner decision, so the wall stays, and the value has to be on the wall.
- **Onboarding is three stacked modal presentations over a Home the learner has not earned yet.** Home renders with "Not placed" and "Take the short placement…" first. The placement cover slides up, slides down to reveal Home again, and then Preferences slides up (`RootView.swift:23-35`). Expect a visible flash and a choppy "up, down, up, down" sequence.
- **Preferences ask a beginner for choices that have no effect yet.** All four activities are locked for a Foundation learner, so picking them yields lock notes in warning orange right inside onboarding (`PreferencesView.swift:126-135`). The time budget is ignored too: Foundation is paced at a fixed `Tuning.foundationLessonsPerDay = 3` lessons whatever the budget (`DailyPlanEngine.swift:151-154`). The days-per-week goal is optional and abstract on day one.
- **The first lesson has an extra stop.** The intro screen repeats what the Home button already said, then adds a dense rules paragraph: "5 hearts — a miss costs one, and the second look at something you missed is free. At zero the lesson stops and shows what slipped." (`LessonIntroStage.swift:149-151`).
- **The Home button says "Continue: \<concept\>" for a lesson the learner has never started** (`HomeView.swift:784`).

### 2. Home and the daily loop

**Reconstructed Home, top to bottom** (`HomeView.swift:184-216`):

- an orange gradient header with the flag, a profile button, the level badge ("A1 · Foundation"), a French greeting, a subtitle and the Kiri mascot;
- an overlapping stats card: flame streak, mastered this week, due now, a retention ring and an expand chevron;
- the Foundation card, or "Today's Plan" for a placed learner;
- "Explore", a collapsed drawer that hides the six-card carousel;
- "Today's Reading" or "Today's Headlines";
- a row of six "Resources".

There is no tab bar. Every surface is a full-screen cover.

**What works**

- The copy is honest and decided from real data (`HomeCopy.swift`). It never praises a zero streak (`HomeCopy.swift:62-93`). The greeting and the Foundation card read the same lesson target, so they cannot contradict each other (`HomeView.swift:158-164`). Locked entry points explain themselves instead of failing silently (`HomeView.swift:306-326`).
- The daily plan is a real plan of record. Activity time counts only in the foreground (`HomeView.swift:1123-1150`). Leaving a surface where words were saved raises a toast: "Saved 3 things you didn't know".

**What does not work**

- **The first Home is a wall of padlocks.** A beginner sees:
  - four locked activity chips under "UNLOCKS AS YOU BUILD THE BASICS" (`HomeView.swift:819-850`);
  - a dimmed, disabled "Today's Reading" card (`HomeView.swift:1452-1520`);
  - three padlocked Resources: Scenarios, Tenses and Idioms (`HomeView.swift:1534`, gated at `HomeView.swift:94-100`);
  - if they open Explore, five of six carousel cards disabled at 72% opacity (`HomeView.swift:1347-1411`).

  The message received is "most of this app is not for you", which is the opposite of what a beta should communicate.
- **"Due now" on day one.** The Foundation seed makes about 20 never-seen cards due, so the greeting reads "20 due now — today's lessons work through them." (`HomeCopy.swift:83-91`). The chip row reads "0 streak · 0 week · 20 due now", with a retention ring showing "—" (`HomeView.swift:495-518`). "Due" implies an overdue debt the learner never took on. "week" is not a unit a learner can parse; it means "mastered this week".
- **Five entry points start what is effectively the same lesson:** the Foundation CTA, the plan's "Lessons" row, "Lesson ready", the Learn carousel card, and the "Recommended for You" rows hidden inside the expanded stats card (`HomeView.swift:775-801`, `926-981`, `1053-1081`, `1227-1232`, `659-709`). It is unclear which one is "the" button.
- **The returning user pays extra taps every day.** Explore starts collapsed and is not remembered (`HomeView.swift:125`, `1189-1221`). Once Read, Listen and Speak unlock, reaching them takes Explore, then a swipe through the carousel, then a tap, unless the plan row happens to link there.
- **Nothing rewards the daily habit.** No moment celebrates a streak day or a day completed. Home does not react when a lesson closes, beyond the capture toast, which only fires for sections. No reminder can be set, because there are no notifications anywhere in the app. Kiri's mood changes only at streaks of 3 and 14 (`HomeCopy.swift:112-117`). The roadmap admits as much ("no celebrations", `docs/roadmap.md`). For a daily loop this is the biggest retention gap.
- **One idea has four names.** The Home card is "Deck" (`HomeView.swift:1254`), but the screen it opens is titled "My Gaps" (`DeckView.swift:90`). The resource is "Gaps" (`HomeView.swift:76`) and opens the "Gap Map" (`GapsView.swift:105`). Counts are labelled "To learn" (`HomeCopy.swift:27`). Learners are told to "save it as a gap" (`HomeView.swift:1458`).
- **The "governor" leaks into copy as "Consolidating your base…"** (`Readiness.swift:105`, `113`, `123`, `128`, `152`) with no explanation of what is being consolidated or what the learner should do.

### 3. A full lesson

**Reconstructed.** Intro → teaching carousel (skill cards with rule, examples, contrast and common mistake, then word cards) → practice → completion.

- **Formats:** multiple choice, true/false, fill-in-the-blank, translation, arrange the words, and match the pairs (`LessonQuestionViews.swift:17-37`).
- **Feedback:** Check → a coloured feedback box with a haptic and a speak button, scrolled into view, with VoiceOver focus moved to it (`LessonPracticeStage.swift:35-53`).
- **Help:** "Show me · N left" counts as a miss without costing a heart.
- **Hearts:** five per lesson; at zero the lesson goes to a recap.
- **Quitting:** guarded by a dialog that says exactly whether the lesson will count (`LessonViewModel.swift:424-430`).

**What works**

- "Learn before you practice" is a real teaching step, not a word list.
- The feedback is specific per format: an accent slip reads "Almost — check the accents" and still counts (`LessonSession.swift:535`, `774-777`). Alternative answers are shown.
- The match round explains a dead tap: "Pick a French word on the left first." (`LessonQuestionViews.swift:265-270`).
- The out-of-hearts recap says whether the lesson counts and offers "Practice these now" (`LessonCompleteStage.swift:43-58`, `198-214`).
- The AI wait can be skipped ("Start with the built-in questions", `LessonIntroStage.swift:217-220`).

**What does not work**

- **"Mastered!" over-claims.** The flash and the bar's "3/7 mastered" fire after two unaided correct answers in one session (`LessonSession.swift:567-571`, `Tuning.masteryTarget = 2`). The app's real mastery needs `Tuning.gapMasteryStreak = 5`. So the learner sees "Mastered!" four or five times, then "Mastered this session: 5" (`LessonCompleteStage.swift:166`), then Home's "0 mastered this week" (`HomeView.swift:498`). This breaks the project's own rule, "Never print a number the engine cannot defend".
- **"Streak" means three things, and two of them share a flame.** In-lesson combo is labelled "streak" with the flame (`LessonPracticeStage.swift:147`). The completion screen's "Best streak" with a flame is also the combo (`LessonCompleteStage.swift:170`). Home's flame "streak" counts days (`HomeView.swift:495`).
- **Internal pills leak engine concepts:** "Blind-spot check", "Check-in" and "Tuned to your level" (`LessonPracticeStage.swift:88-99`).
- **The practice bar is dense:** close, progress, hearts, combo, XP and "x/y mastered" across two rows (`LessonPracticeStage.swift:134-155`), on top of a category pill and up to three status pills per question.
- **Typed French has no accent help.** The `TextField` has no accent key row (`LessonQuestionViews.swift:150-163`). On an English keyboard, é, è, ç and à need long-presses, and every slip lands as "Almost".
- **The lesson end is a dead end for the daily plan.** The only button is "Done" (`LessonCompleteStage.swift:79`). A Foundation learner asked for 3 lessons a day goes Done → Home → Continue → Intro Start → teaching "Start practice" for each one: about 4 taps of overhead per lesson, and no "Lesson 2 of 3 — keep going?" prompt.
- **An interrupted lesson is lost.** The answers are recorded, but killing the app mid-lesson leaves no way to resume (`LessonView.swift:24-31`, view-model state only), and the day's lesson does not count.

### 4. Reading, talking, listening, capture, progress

**What works**

- Read has honest gate states: locked, bridge ("Curated pieces up to A2…"), and unlocked with feed, library and search (`ReadView.swift:152-172`).
- Read has a skeleton loader and a typed failure banner with Retry (`ReadView.swift:410-440`).
- Words saved offline get "Save now, translate later" (`SharedComponents.swift:657`).
- Speak and Converse handle microphone denial, missing service, offline and interrupted recording with specific copy (`TalkSupport.swift:33-46`, `92-109`, `340-342`).
- Listen falls back to the built-in voice and says why (`MediaSupport.swift:80-83`).
- The capture sheet ("Save to my deck", "Already in your deck") is clear.

**What does not work**

- **Two back buttons inside Read.** Home draws a floating "Back to Home" chevron over every section (`HomeView.swift:284-301`, fixed `.padding(.top, 56)`). Read pushes `ArticleReaderView` and `ReaderView` inside its own `NavigationStack` (`ReadView.swift:177-178`), and those draw their own white chevron in a dark circle (`ContentScreens.swift:260-285`). The pushed reader therefore shows two near-identical chevrons stacked at the top left: one goes back to the list, the other throws the learner out of Read. `DeckView.swift:299-305` documents this exact hazard and avoids pushing for that reason; Read and the bridge library do push. The fixed offset may also sit on the "Read", "Speak" and "Listen" titles, which start around y = 60 (`ReadView.swift:233`); a device check is needed.
- **There is no swipe-back.** Sections are full-screen covers, so the only exit is that small floating chevron.
- **Each section has its own palette,** and many are hard-coded hex values rather than Theme tokens:
  - Speak is slate (`SpeakView.swift:130`);
  - Watch is near-black (`WatchView.swift:116`);
  - Converse is rose (`HomeView.swift:1248`);
  - Assessment and Preferences are indigo (`AssessmentView.swift:53-57`, `PreferencesView.swift:34`);
  - the capstone is a violet gradient (`HomeView.swift:1102`).

  Variety between modalities can be intentional, but here it reads as several apps.
- **When a service key is missing, the copy says "isn't available in this build"** (`TalkSupport.swift:33`, `MediaSupport.swift:115-166`). It is honest, but to a tester it reads as a broken build. Whether the beta build carries the keys cannot be told from source (`Config.swift` holds empty strings that are filled at build time).
- **The concept-map spec (D6) has no surface yet.** The "Gap Map" is per category only (`GapsView.swift:35-55`). This is not a defect, but testers asking "where am I?" get category bars, not the "Working at B1, A2 not complete" sentence the spec centres on.

### 5. Settings, account, offline, errors

**What works**

- Sign-out backs up first and offers a forced sign-out if that fails (`ProfileView.swift:197-213`, `296-305`).
- A sync status card with Retry (`ProfileView.swift:216-246`).
- Debug tools are compiled out of release builds (`ProfileView.swift:346-381`).
- A non-blocking banner for partially unreadable data (`ContentView.swift:355-389`).
- The offline sync message is specific: "You're offline. Progress stays on this device until you reconnect." (`CloudSync.swift:834-835`).

**What does not work**

- **Every cold launch waits on the network.** The saved session restores, then `cloud.reconcile(initial: true)` runs, and the app shows the bare spinner until it finishes (`ContentView.swift:40-42`, `76-77`, `112`). There is no timeout shorter than URLSession's default and no way out, even when the device holds a complete local record. Offline fails fast and continues, but a weak signal (lift, subway, captive portal) can mean many seconds of a logo and a spinner, every morning.
- **Profile lacks:** account deletion, privacy policy, terms, support or feedback, and the app version. There is no in-app haptics or sound setting (`ProfileView.swift:31-61`).
- **Sign-in errors show the raw `error.localizedDescription`** (`AuthManager.swift:129`, `146`) under an alert whose only button, "Try again", just dismisses it (`WelcomeView.swift:51-55`).
- **"Recalibrate", "a retake only adds evidence" and "Blends with your evidence"** (`ProfileView.swift:104`, `118`; `AssessmentView.swift:97`, `499`) are engine language.
- **The fallback display name is "Apprenant"** (`ProfileView.swift:154`). It is charming, but a learner with an Apple private relay address and no name sees a French word they may not know as their own name.

---

## Findings

`file:line` is relative to `ios/FluentFrenchIOS/` unless shown otherwise. **B?** marks the beta blockers.

| ID | Sev | B? | Flow | file:line | Problem as the learner experiences it | Proposed fix |
|---|---|---|---|---|---|---|
| UX-01 | Blocker | **Yes** | All | `Theme/Theme.swift:20-62`; `Views/Lesson/LessonQuestionViews.swift:150-163`; `Views/WelcomeView.swift:139`; `Views/ProfileView.swift:53` | Theme colours are fixed light hex values, and nothing forces light appearance (no `preferredColorScheme`, no `UIUserInterfaceStyle` in `project.pbxproj`). In Dark Mode, system-coloured text turns white on the app's white and cream surfaces. The typed answer in a lesson becomes invisible (white on white `Theme.card`). Navigation titles such as "Profile" and "CEFR Proficiency" disappear. The Apple button switches to its white style on a cream background. | For the beta, add `INFOPLIST_KEY_UIUserInterfaceStyle = Light` (or `.preferredColorScheme(.light)` at the `WindowGroup` in `FluentFrenchIOSApp.swift`) and drop the `colorScheme` switch on the Apple button. Plan a dark palette in `Theme` later. |
| UX-02 | Blocker | **Yes** | Onboarding | `ios/FluentFrenchIOS.xcodeproj/project.pbxproj:414`, `:426` | The home-screen icon reads "FluentFrenchIOS" (`PRODUCT_NAME = $(TARGET_NAME)`, so it truncates to "FluentFren…"). The microphone prompt says "FluentFrench uses the microphone…". Every screen says "Okiri". A permission prompt naming a different app undermines trust. | Set `INFOPLIST_KEY_CFBundleDisplayName = Okiri`. Reword the mic string: "Okiri listens when you tap record, so you can practise speaking French and get feedback." |
| UX-03 | Blocker | **Yes** | Read / sections | `Views/HomeView.swift:284-301`; `Views/ReadView.swift:177-178`; `Views/ContentScreens.swift:260-285` | Inside a story (Read, and the bridge library), two identical chevrons sit at the top left. One returns to the list; the other exits Read entirely and loses the place. The floating chevron at a fixed `top: 56` may also overlap each section's title. There is no swipe-back. | Remove the Home overlay. Give each section a close button in its own header (an `onClose` closure, as the Resources already have via `ResourceHeader(onBack:)`). Until then, at least hide the overlay while the section's navigation path is not empty. |
| UX-04 | High | | Lesson | `Services/LessonSession.swift:567-571`; `Views/Lesson/LessonView.swift:50-52`; `Views/Lesson/LessonPracticeStage.swift:163-170`; `Views/Lesson/LessonCompleteStage.swift:166` | "Mastered!" flashes after two correct answers in one lesson. Home then says "0 mastered this week", because real mastery needs a run of 5. The learner concludes progress is not being saved. | Rename the in-session state ("Got it!" for the flash, "x/y solid" on the bar, "Nailed this lesson" on completion). Keep "Mastered" for `gapMasteryStreak` only. The copy belongs in a `LessonCopy` service, next to `HomeCopy`. |
| UX-05 | High | | Lesson end / daily loop | `Views/Lesson/LessonCompleteStage.swift:79`; `Views/HomeView.swift:1137-1150` | A lesson ends with a lone "Done". Nothing marks that the streak advanced or that 1 of 3 lessons is done, and nothing offers the next one. Home looks unchanged on return. | Add a store-computed `nextLessonOffer` (in `AppStore` or `DailyPlanEngine`). The completion screen then shows "Day 1 streak started" or "Lesson 1 of 3 done" and a primary "Next lesson" button, with "Done" secondary. Give the streak tick one celebratory beat (Kiri pose plus a haptic) that respects Reduce Motion. |
| UX-06 | High | | Onboarding | `Views/RootView.swift:52-63`; `Views/PreferencesView.swift:87-151`; `Services/DailyPlanEngine.swift:151-154` | Right after placement, a beginner is asked to pick activities that are all locked, in warning orange, and a time budget that Foundation ignores. It is a screen of choices with no consequence. | Add `AppStore.shouldAskPreferences`: skip Preferences while `isInFoundation`, keep the defaults, and ask once Reading unlocks ("You've unlocked Reading — how do you want to spend your time?"). |
| UX-07 | High | | Home (first run) | `Views/HomeView.swift:819-850`, `1347-1411`, `1452-1520`, `1534-1577` | The first Home shows about 4 locked chips, a locked reading card, 3 locked resources and 5 locked carousel cards. It feels like a paywall, not a path. | For Foundation learners, collapse everything locked into one "Next unlock" line with progress, from `ReadinessCopy`. Hide the locked Resources and the locked headline card until the bridge opens, and show only what can be done today. The decision goes in the store (`homeSurfaces`), so the view stays dumb. |
| UX-08 | High | | All (a11y) | `Views/HomeView.swift:441-450`; `Views/Lesson/LessonPracticeStage.swift:189-219`; `Theme/Theme.swift:28`, `52-57` | White text on the orange gradient measures 1.9–2.8:1, and that is where the greeting subtitle sits. Feedback titles in status colour on their light tints: success 2.4:1, warning 2.1:1, error 3.4:1. `Theme.primary` as text on white ("See All", stat lines) is 2.8:1. All fail WCAG AA. | Add text-safe tokens: `primaryText #C2410C` (5.2:1), `successText #047857` (5.5:1), `warningText #B45309` (5.0:1), `errorText #B91C1C` (6.5:1). Use them for text and keep the bright tokens for fills. Darken the header gradient's text area, or give the subtitle a scrim. |
| UX-09 | High | | Launch | `ContentView.swift:40-42`, `76-77`, `112` | Every cold launch shows a logo and a spinner until the account reconcile returns. On a weak connection that can take a long time, and there is no way out, even with full local progress. | In `CloudSync`, add a short `Tuning.launchReconcileBudget` (about 2–3 s) after which a learner with a readable local record enters the app while the reconcile finishes in the background. Lessons already defer reconcile (`store.isLessonInProgress`). After about 5 s, show "Still syncing…" with a "Continue offline" option. |
| UX-10 | High | | Onboarding | `Views/WelcomeView.swift:84`, `170` | The first screen never says the app teaches French, and its only promise is backups. | Lead with the value: "Learn the French you're missing" and a one-line method ("Short lessons that adapt to you — read, listen and speak as you unlock them"). Move the sync line into the footnote, with links to privacy and terms. |
| UX-11 | High | | Settings | `Views/ProfileView.swift:174-213` | There is no way to delete the account or data. It is required for App Store submission (5.1.1(v)) and is the first thing a privacy-minded tester looks for. | Add "Delete account" with a confirmation, backed by a backend endpoint (a `backend/` change is allowed). Not needed for a closed TestFlight beta; required before release. |
| UX-12 | High | | Home / Read / Deck | `Views/HomeView.swift:76`, `1227`, `1254-1255`, `1458`; `Views/DeckView.swift:90`, `277-327`; `Views/GapsView.swift:105` | One idea carries four names: "Deck", "My Gaps", "Gap Map", "Gaps", alongside "To learn". "Gap" is internal vocabulary that the copy elsewhere has already moved away from (`HomeCopy.swift:23-27`). | Pick learner words, for example "My words" (the deck) and "Progress" (the category map), and apply them on the Home card, the screen title, the resource label and the capture copy ("Save it to My words"). |
| UX-13 | High | | Lesson | `Views/Lesson/LessonPracticeStage.swift:88-99` | Pills such as "Blind-spot check", "Check-in" and "Tuned to your level" expose engine internals mid-question and add noise. | Keep at most one learner-facing pill: "Quick check" (a probe or check-in) or "Try again" (a remedial). Drop "Tuned to your level". Word them in a `LessonCopy` service. |
| UX-14 | Medium | | Onboarding | `Views/RootView.swift:23-35`, `48-56` | Home flashes with "Not placed", then the placement cover rises, dismisses back to Home, and the Preferences cover rises: three slide animations. | When `!hasCompletedAssessment`, render the onboarding as the root content instead of covers over Home. The decision already lives in `RootView` and the store; switch the root view rather than presenting over it. |
| UX-15 | Medium | | Home | `Services/HomeCopy.swift:83-91`; `Views/HomeView.swift:495-518` | On day one: "20 due now — today's lessons work through them." and chips reading "0 streak · 0 week · 20 due now · —". "Due" implies a backlog the learner never created, and "week" is not a readable unit. | In `HomeCopy`: before the first completed lesson, the subtitle reads "Your first lesson is ready — about 5 minutes." Hide the due chip until any card has been reviewed (`practised > 0`), and relabel "week" to "mastered this wk" or drop the chip. |
| UX-16 | Medium | | Home | `Views/HomeView.swift:775-801`, `926-981`, `1053-1081`, `1227-1232`, `659-709` | Five different controls start a lesson, so it is unclear which one is the day's action. | Keep one primary lesson CTA (the plan's lesson row, or the Foundation CTA). Make the Learn card open the deck or progress instead. Move "Recommended" into the deck. |
| UX-17 | Medium | | Home | `Views/HomeView.swift:125`, `1189-1221` | Explore starts collapsed on every visit, so a daily user re-expands it to reach Read, Listen or Speak. | Persist the expanded state (a per-device UI preference), or expand it automatically once any modality is unlocked. |
| UX-18 | Medium | | Daily loop | (absent; no `UNUserNotificationCenter` anywhere) | A streak-based app with no reminder. Learners who forget on day 2 lose the streak silently. | Add an opt-in reminder after the first completed lesson ("Want a nudge at this time tomorrow?"), never at launch. Store the time in preferences. |
| UX-19 | Medium | | Lesson | `Views/Lesson/LessonPracticeStage.swift:147`; `Views/Lesson/LessonCompleteStage.swift:170`; `Views/HomeView.swift:495` | The in-lesson combo is called "streak" with the same flame as the daily streak, and the completion "Best streak" is the combo. | Rename to "in a row" or "combo" with a bolt or sparkle icon. Reserve the flame and the word "streak" for days. |
| UX-20 | Medium | | Lesson | `Views/Lesson/LessonIntroStage.swift:82-92`, `144-160` | The intro is an extra tap with a dense hearts and mastery rule paragraph: "answer an item right 2× to master it this session", "the second look … is free". | Shorten to "7 words · about 5 min · 5 hearts". Skip the intro when the lesson comes from the Foundation CTA, which already named the skill. Show the full hearts rule only on the first lesson ever (a flag in the store). |
| UX-21 | Medium | | Lesson | `Views/Lesson/LessonQuestionViews.swift:150-163` | Typing é, è, ê, ç, à or ù on an English keyboard needs long-presses, so accent slips are frequent and get "Almost". | Add an accent key row (a `ToolbarItemGroup(placement: .keyboard)`) that inserts at the cursor. The characters list belongs in a model constant. |
| UX-22 | Medium | | Lesson | `Views/Lesson/LessonPracticeStage.swift:134-155` | The practice bar has six elements in two rows, and each question can show up to four pills above the prompt. | One row: close, progress, hearts. Show XP and combo only as a transient pop on change, and put "x/y" in the progress bar's VoiceOver value. |
| UX-23 | Medium | | Lesson | `Views/Lesson/LessonView.swift:24-31` | Killing the app or a crash mid-lesson loses the lesson. The answers are kept, but the day's lesson does not count and cannot be resumed. | Persist an in-progress `LessonSession` snapshot in the store. On the next Home, offer "Finish your lesson (4 of 7 left)". |
| UX-24 | Medium | | Read / sections | `Views/HomeView.swift:226-228`, `272-302` | Sections are full-screen covers, so there is no swipe-back gesture. The small floating chevron is the only exit. | Present sections as `.sheet` with large detents, or push them in Home's `NavigationStack` to get the native edge swipe. Otherwise keep the cover but add a swipe-down dismissal. |
| UX-25 | Medium | | Home | `Models/Readiness.swift:105`, `113`, `123`, `128`, `152`; `Services/HomeCopy.swift:169` | "Consolidating your base…" appears with no explanation. Learners cannot tell what to do. | Say the action: "Review what you've learned to open Listening — today's lessons focus on that." |
| UX-26 | Medium | | Profile | `Views/ProfileView.swift:31-61` | No privacy policy, terms, "Send feedback" or app version. Beta testers have no in-app way to report a problem beyond TestFlight screenshots. | Add an "About" section with policy and terms links, a feedback `mailto:` that includes the version and build (as text, no personal data), and the version string. |
| UX-27 | Medium | | Onboarding / Profile | `Views/AssessmentView.swift:87`, `97-98`, `499`; `Views/ProfileView.swift:104`, `118` | "Recalibrate", "Blends with your evidence" and "joins your gaps" are engine words. | "Retake the level check — it can only raise your level." and "Anything you miss gets added to your lessons." |
| UX-28 | Medium | | Visual consistency | `Views/AssessmentView.swift:53-57`; `Views/PreferencesView.swift:34`; `Views/HomeView.swift:1102`, `1240`, `1248`, `1252`; `Views/SpeakView.swift:130`; `Views/WatchView.swift:116` | Each section uses its own hard-coded hex palette, which bypasses `Theme`. Onboarding is indigo while Home is orange, so the first two screens after sign-in look like different apps. | Move the section accents into `Theme` (for example `Theme.Section.speak`). Onboarding (Assessment, Preferences) uses the primary orange family to match Welcome and Home. |
| UX-29 | Medium | | Talk / media | `Services/TalkSupport.swift:33`; `Services/MediaSupport.swift:115-166`; `Views/SpeakView.swift:366-372` | If any service key is missing in the beta build, learners read "isn't available in this build", which sounds broken. | Confirm every key is present in the beta build. If a feature is intentionally off, hide its entry point instead of showing a dead card, and word any remaining notice as "Coming soon". |
| UX-30 | Medium | | Fluidity | `Components/SharedComponents.swift:842-857` | `.pressable()` attaches `DragGesture(minimumDistance: 0)` as a simultaneous gesture to rows inside vertical `ScrollView`s. On iOS 18 this pattern is known to interfere with scroll starts and can leave cards stuck "pressed". | Replace it with a `ButtonStyle` that reads `configuration.isPressed`, which needs no gesture. Device check required. |
| UX-31 | Medium | | Layout | `project.pbxproj:419`, `433`; `Views/HomeView.swift:146` | iPhone landscape and iPad are enabled, but the layouts are portrait-phone only. The carousel width reads `UIScreen.main.bounds`. | For the beta, iPhone portrait only (`UISupportedInterfaceOrientations_iPhone = Portrait`, `TARGETED_DEVICE_FAMILY = 1`), or test iPad deliberately. |
| UX-32 | Low | | Home | `Views/HomeView.swift:784`, `800` | "Continue: Definite articles" on a skill never started. | In `HomeCopy`, say "Start:" when the concept has no practice yet, otherwise "Continue:". |
| UX-33 | Low | | Onboarding | `Services/AuthManager.swift:129`, `146`; `Views/WelcomeView.swift:51-55` | Sign-in errors show the raw system or SDK message, and "Try again" only closes the alert. Non-cancel Apple errors are silently dropped (`WelcomeView.swift:182-184`). | Map errors to learner copy in `AuthManager` (offline / service down / unknown, plus the next step). Label the button "OK", or make it actually retry. |
| UX-34 | Low | | Onboarding | `Views/AssessmentView.swift:143-146` | Each placement question shows a difficulty pill ("Intermediate", "Advanced"), which raises the stakes mid-test. | Drop the band pill during the quiz and keep the category pill. |
| UX-35 | Low | | Onboarding | `Views/AssessmentView.swift:540-547` | Each wrong placement answer buzzes with an error haptic. A beginner who tries the test is buzzed repeatedly. | Use a neutral `Haptics.tap()` in placement, and keep error haptics for lessons. |
| UX-36 | Low | | Lesson | `Tuning.swift:124`; `Views/Lesson/LessonCompleteStage.swift:105-111` | A true beginner can run out of hearts in their first Foundation lesson, and the title then reads "Out of hearts". | Waive hearts for the learner's first N Foundation lessons (a `Tuning` constant, decided in `LessonSession`). |
| UX-37 | Low | | a11y | `Components/SharedComponents.swift:240-241` | Every speak button is announced as "Listen", so a VoiceOver user on a teaching card hears "Listen, button" five times with no context. | `accessibilityLabel("Listen: \(text.prefix(40))")`. |
| UX-38 | Low | | Profile | `Views/ProfileView.swift:154` | Learners with no name (Apple private relay) are called "Apprenant". | Fall back to "Learner", or ask for a first name once. |
| UX-39 | Low | | Speak | `Views/SpeakView.swift:141-147` | The header greets a new learner with "0 total min · 0 this week · 0 saved". | Hide the zero stats until there is any speaking time, and show a one-line "Try a 30-second warm-up" instead. |
| UX-40 | Low | | Talk | `Views/ConverseView.swift:305-325` | "Call" chrome (a red hang-up button, a chevron-down "Leave", "Your tutor · 0:42") over what is mostly a text chat. Hanging up means "see recap", which the icon does not convey. | Label the end control "End & review", or use a checkmark rather than a phone glyph. |

---

## Top 10 before beta

Ordered by UX return per unit of effort.

1. **Force light appearance (UX-01).** One build setting, plus removing the `colorScheme` switch on the Apple button. This removes the invisible typed answers and titles for every Dark Mode tester.
2. **Fix the display name and the microphone string (UX-02).** Two build settings, so the home screen and the permission prompt both say "Okiri".
3. **One back button per screen (UX-03).** Move "Back to Home" into each section's own header and stop overlaying pushed readers. Read is unusable without this.
4. **Stop calling two correct answers "Mastered" (UX-04).** A copy-only change. It removes the most visible contradiction between a lesson and Home.
5. **A completion screen that continues the day (UX-05).** "Lesson 1 of 3 done · Day 1 streak" plus a "Next lesson" button. This one screen is the daily-loop payoff and the cheapest moment of delight.
6. **Skip Preferences for Foundation learners (UX-06).** One store flag. Onboarding loses a screen of choices that change nothing.
7. **Collapse the padlocks on a beginner's Home (UX-07, UX-15).** One "Next unlock" line, no locked resources or cards, no "due now" before the first lesson.
8. **Text-safe colour tokens (UX-08).** Four new Theme tokens, applied to text (header subtitle, feedback titles, orange links). This lifts the core feedback moment to AA.
9. **Don't block launch on the network (UX-09).** A short reconcile budget, then enter with the local record. Every returning user benefits every day.
10. **One vocabulary (UX-12, UX-13, UX-25, UX-27).** Rename Deck / My Gaps / Gap Map / Gaps, and replace "Blind-spot check", "Check-in", "Consolidating" and "Recalibrate/evidence". Copy only, mostly in `HomeCopy`, `ReadinessCopy` and the new `LessonCopy`.

Just outside the ten: a value line on Welcome (UX-10, copy only, very cheap, so worth doing alongside); the accent key row (UX-21); and account deletion (UX-11), required before App Store release.

---

## Needs checking on a device

These depend on rendering, timing or system behaviour that source alone cannot show.

1. **Dark Mode, end to end,** if UX-01 is not applied: the lesson typed field, the Profile title, the CEFR sheet, the Apple button on Welcome, every `TextField` (`ReadView.swift:301`, `ConverseView.swift:421`, `ScenariosView.swift:136`, `509`, `IdiomsView.swift:77`).
2. **Where the floating "Back to Home" chevron lands** on Read, Speak, Listen, Converse, Watch and Deck, on a Dynamic Island phone and on an SE-sized phone. Does it overlap each header title, and in a pushed story the reader's own back button (`HomeView.swift:298-300`)?
3. **The onboarding sequence:** whether Home visibly flashes before the placement cover, and how the dismiss → Preferences cover hand-off looks (`RootView.swift:23-35`).
4. **Cold launch on a throttled connection** (Network Link Conditioner, "Very Bad Network"): how long the logo and spinner stay up with an existing account (`ContentView.swift:76-77`).
5. **Scrolling Home and Preferences** starting a drag on a `.pressable()` row: does the scroll start reliably, and do rows stay "pressed" (`SharedComponents.swift:842-857`)?
6. **The carousel** (`HomeView.swift:1261-1290`): snapping, peek width on small phones, and the mini nav pill tracking during fast swipes. At accessibility text sizes, whether the 340 pt minimum card height clips the description.
7. **Largest accessibility text size** on the Home header (the greeting with Kiri), the stats chip row (five items in one `HStack`, `HomeView.swift:494-525`), the practice bar, the match columns and the Preferences budget cards (three across).
8. **VoiceOver order** on Home: does the overlapping stats card (`offset(y: -60)`) read after the header? And on the lesson feedback, is focus moved before or after the scroll animation?
9. **Lesson keyboard:** whether the keyboard covers the Check button on small phones, and whether auto-focus on each typed question feels abrupt (`LessonQuestionViews.swift:170`).
10. **The "Crafting your lesson…" wait:** how often it appears in practice, and how long it lasts (prefetch at `LessonViewModel.swift:149-155`, 10 s timeout).
11. **Haptics density:** a correct-answer `success` plus a combo pop plus the "Mastered!" flash in quick succession may feel noisy.
12. **Audio:** whether natural-voice TTS starts fast enough on speak buttons, and whether speak buttons interrupt each other cleanly across the teaching cards.
13. **Microphone flows:** first-time prompt timing, a denial → "Open Settings" → return trip, and an interruption by a phone call mid-recording in Speak and Converse.
14. **Service keys present in the beta build:** Read feed, Watch, Converse, Speak feedback, natural voice, AI lesson questions. Each degrades to an "isn't available in this build" card if its key is empty (`Config.swift`).
15. **Landscape and iPad,** if left enabled: the Home carousel, the lesson layout and the full-screen covers.
16. **Kiri:** sprite crispness at 72 and 104 pt, and whether the idle breathing or sway animation distracts beside the greeting.
