# Adaptive Gap Intelligence: FSRS, IRT, confusion pairs & context re-exposure

A deep upgrade to how the app understands each learner and decides what to teach next. The goal: every lesson feels tuned to *this* person's brain, today.

## What the learner will feel

- **Lessons that actually get harder (or easier) for you.** A strong learner starts seeing 5–6 tighter options and trickier phrasings; a struggling learner gets 3 clearer options and more scaffolding — automatically, without settings.
- **Reviews that arrive at the perfect moment.** Words resurface right before you'd forget them, not on a fixed schedule, so you spend less time and remember more.
- **Lessons that target your real confusions.** Instead of drilling "passé composé" generally, the app notices you mix up *être vs avoir* in passé composé and builds side-by-side questions on that exact pair.
- **Your own sentences come back.** A word you tapped in a news article three weeks ago reappears inside that same sentence later — a huge memory boost.
- **Questions in your best format.** If you retain words better from listening exercises than multiple choice, the app quietly starts giving you more listening — learned from your own history.
- **A smarter streak.** Your streak reflects mastery milestones, not minute counting (carried over from earlier work, now fed by the new model).

## New intelligence under the hood

1. **Confusion model** — Detects when wrong answers cluster around a specific *other* gap (e.g. picking "avoir" when "être" is right). Merges symptomatic gaps into a single confusion pair with its own practice exercises.
2. **FSRS scheduling** — Replaces the current review-count heuristic with the modern FSRS algorithm (difficulty, stability, retrievability per card). Each gap gets its own forgetting curve and an optimal next-review date.
3. **Full IRT difficulty calibration** — Every learner carries an ability score (θ). Every question carries a difficulty score (b). After each answer, both update. Lessons target questions at ~70–80% predicted success (the proven learning sweet spot). Option count (3/4/5/6) and distractor tightness flex off θ.
4. **Epsilon-greedy exercise-type bandit** — Tracks retention-by-type per learner (how often you *still remember* a word 7 days later, grouped by which exercise type taught it). 85% of the time it picks your best-performing types; 15% explores others so the model keeps learning.
5. **Cross-gap confusion-pair questions** — A new exercise builder that takes two related gaps (same category, or flagged by the confusion model) and builds contrast questions: "Which one means ___?", "Fill in: je ___ arrivé (être/avoir)".
6. **Context re-exposure** — When a gap was captured from a real sentence (news article, video, chat), that original sentence is stored. The lesson engine schedules periodic "you saw this in the wild" questions that re-present the exact sentence.
7. **Unified adaptive selector** — A single decision layer that, for each slot in a lesson, asks: *which gap is most due (FSRS) × which exercise type works best for this learner (bandit) × what difficulty matches θ × is there a confusion partner × is there original context to re-expose?* Then builds the question.

## Screens & UI touches

- **Gap detail view gets a "Memory" card**: shows stability, retrievability %, next review date, and a tiny forgetting-curve chart.
- **Insights screen gets a "Confusion pairs" section**: lists the top 3 pairs the learner mixes up, each with a one-tap "Drill this pair" button.
- **Lesson intro gets a subtle badge**: "Tuned to your level" or "Targeting your top confusion" so the learner *feels* the personalization.
- **Post-lesson summary** adds: items advanced on the forgetting curve, ability-score movement, and new best exercise type (if changed).

## Scope & sequencing

All seven upgrades land together as one coherent system because they share state (gap records gain new fields: stability, difficulty, θ contributions, type-retention history, original context, confusion partners). The AI generation path stays as-is — every lesson still calls the AI — but the AI now receives a much richer, smarter brief from the new selector.

No user-facing settings or toggles are added. Everything adapts silently. The existing validator, templates, fallback chain, distractor bank, and AI repair layers from earlier phases continue to operate as the safety net.