# Okiri iOS — build roadmap

The plan for taking the iOS app from beta-ready to the product the Expo original pointed
at, written after reading both codebases side by side.

> **Reconstructed.** The working roadmap (587 lines, a change list per package) was lost
> with the session scratch directory in November 2026. This page is rebuilt from the
> [published roadmap](https://claude.ai/code/artifact/b043fb0c-c41f-4799-a529-0741062506b3),
> which kept each package's goal, effort and dependencies, plus the full D6 section,
> which survived verbatim. The six surface-comparison reports and the P1 implementation
> spec it cites were also lost. **Status** reflects the repository on 2026-11-21.

## The verdict

iOS is not a diminished Expo. It is a better product with most of its inputs
disconnected.

It won everything that is hard to fake:

- a prerequisite concept graph;
- real FSRS with recency-decayed evidence;
- check-ins under a retention governor;
- blind-spot probes and an adaptive placement staircase;
- teaching content with rules and contrast pairs;
- accent-aware grading;
- a calibration harness that measures the engine against a synthetic learner whose
  true knowledge is known.

Expo has essentially none of that; its foundation lessons produce no durable evidence.

What iOS lost to Expo is volume and ceremony:

- ten reading pieces of 40–60 words, labelled "4–8 min read";
- thirteen dialogues against Expo's 125 across eight regions;
- an empty video shelf;
- every moment that made a month feel like progress.

**The measurement is one-eyed.** `AnswerFormat` has nine cases, and none is listening.
`QuestionKind` has six kinds, all read or typed. The three pronunciation concepts that
existed then could never be observed. A learner can be marked as mastering a word they
cannot hear and cannot say, and the check-ins, the governor and the readiness gate all
rest on that evidence.

## Two corrections made before porting anything

- **Expo's speaking mode does not hear the learner either.** It is transcript-only,
  like iOS. The real capability was a separate pronunciation product that the port
  dropped: Azure per-phoneme assessment on raw audio.
- **Expo's article adaptation fabricates under a real masthead.**
  `adaptArticleForLevel` never sees the article body. It generates paragraphs from a
  headline and prints them under the publisher's name. P1 builds a retelling anchored
  in the real source text and labelled as what it is.

## Where each surface stands

| Surface | State | Note |
|---|---|---|
| Lessons | Ahead | Ahead of Expo and the market, but blind and mute; the gaps are on the surface, not in the brain |
| Read | Starved | A 200-character wire excerpt, one news query, ten short pieces; supply is the larger problem |
| Speak | Half | One issue returned where Expo returns many; no acoustic scoring in either speak tab |
| Converse | Back half | Corrections become well-sized cards with real evidence; no register by band, personas or openers |
| Watch & Listen | Passive | Playback and capture; listening has never been evidence in either app |
| Progress | True but quiet | The only honest numbers of the two apps, and no celebrations |

## Lanes 1–3 — content, engine, surfaces

Effort: S, M or L. Numbering is the build order.

| # | Package | Lane | Effort | Needs | Status |
|---|---|---|---|---|---|
| P1 | **Gap-aware adaptive reading.** A retelling anchored in the real article, seeded with the next concept to teach and the deck's own words, which makes re-exposure countable | Surface | L | — | Approved; not built (spec lost) |
| P2 | **Give the harness an ear and a mouth.** Listening and pronunciation dimensions in the synthetic learner, so every new evidence format must prove it improves calibration | Engine | S | — | Not built |
| P3 | **Listening becomes evidence.** Dictation on the line just heard, with engine-chosen blanks and an audio-first reveal ladder | Engine | M | P2 | Not built |
| P4 | **Real text to read and hear.** 400–900-word bodies per band, the 125-item eight-region listening corpus, several examples per item | Content | L | — | Partly authored, never merged; **lost** |
| P5 | **Lexical coverage as the selection primitive.** What fraction of a text the learner already knows, used to sort the feed and choose dialogues | Engine | M | P4 | Not built |
| P6 | **Pronunciation becomes observable.** Minimal-pair perception probes scheduled by the selector, with no scoring API | Engine | M | P2, P4 | Not built |
| P7 | **Two formats and a visible schedule.** Spot-the-error from contrast pairs, sentence building, and the next interval shown after each answer | Surface | S | P4 | Not built |
| P8 | **Multi-issue, span-located Speak feedback** | Surface | M | — | Not built |
| P9 | **Error insight restored.** Twelve type-specific explanations and a deterministic classifier (absorbed by D3) | Surface | M | — | Not built |
| P10 | **Reading session and comprehension.** Meaning-level questions graded as reading evidence, and words per minute | Surface | M | P1, P5 | Not built |
| P11 | **Converse as the production arm.** Register by band, level-scaled decoding, target concepts carried into the conversation | Surface | M | P5 | Not built |
| P12 | **Encoding variability and the wild callback.** Rotating examples; re-asking a captured word in its original sentence | Engine | M | P1, P4 | Not built |
| P13 | **Promotion and a can-do ledger.** A certified level that only ratchets up on held evidence (absorbed by D6) | Surface | M | — | See D6 |
| P14 | **News supply plumbing.** Offline persistence, broader sourcing, paging | Content | M | — | Not built |
| P15 | **Watch: the cheap interactions.** Transcript cache, resume position, cross-line phrase capture | Surface | S | P4 | Not built |
| P16 | **The 30-day arc.** A journey view built from the metrics log, plus an honest weekly recap | Surface | M | P13, P9 | Not built |
| P17 | **Spoken production inside the lesson**, graded per word | Engine | M | P2, P6, P4 | Not built |
| P18 | **Discovery before measurement.** A real passage before the placement test | Surface | M | P4, P5 | Not built |
| P19 | **The multipliers.** Rotating-voice narrow listening, read-while-listen, prediction pauses | Surface | M | P3, P4, P10 | Not built |
| P20 | **Acoustic scoring.** Per-phoneme assessment through the backend | Engine | L | P6, P17 | Not built |
| P21 | **Live duplex call** with barge-in and a parallel text pass | Surface | L | P11 | Not built |

**Sequencing.**

- Start three at once: P1, which is approved and blocks nothing; P2, which is small and
  gates every later evidence change; and P4, which is authoring and can run in parallel.
- The spine is **P2 → P3 → P17 → P20**, each step gated by the harness proving that
  calibration improved.
- Six packages need a real learner first. Build the instrumentation, not the tuning.

## Lane 4 — Depth

Four of these packages are presentation over data the app already computes. The fifth
lays out the whole language and carries the plan's largest content job. Build order for
felt impact: **D4 → D6 → D5 → D3**, with D6's content authoring running underneath.

| # | Package | Effort | Status |
|---|---|---|---|
| D4 | **A session with a shape.** A warm-up you will get right (scored at zero weight), the work, then a close that says what moved and when it returns | S | Not built |
| D6 | **The concept map**, which absorbs D1 (the inspectable model) and D2 (reference grammar). See below | L + XL content | Taxonomy and graph tests done; the rest not built |
| D5 | **Your own French notebook.** Every saved word, in the sentence it was met in, searchable | M | Not built |
| D3 | **Error patterns as diagnosis.** A named weakness, why it catches English speakers, your own instances, and a drill (absorbs P9) | M | Not built |

**D6 sub-package status:**

| Part | Status |
|---|---|
| D6.1 Taxonomy, 49 → 181 concepts (A1–C1) | Done |
| D6.2 Graph-integrity tests | Done |
| D6.3 Certified level and the five states | Not built |
| D6.4 Band gating | Partly: the ranker's two-sided level taper landed in audit rounds 8 and 9; the reach rule and the electable set did not |
| D6.5 Content for the 132 unauthored concepts | Not started; 25 situational concepts wait on the schema extension |
| D6.6 Per-band content split | Not built |
| D6.7 Map, level sheet, concept page | Not built |
| D6.8 Captured words joined to concepts | Designed (spec §9); not built |

Full spec: [`spec-concept-map.md`](spec-concept-map.md).


### D6 — The Concept Map (absorbs D1 and D2)
**Goal.** The whole of French laid out A1–C1, the learner's real position on it, and a way in at
any point. Full spec: [`spec-concept-map.md`](spec-concept-map.md).
**The spine.** The app already holds two notions of level and has only ever shown one. *Working
level* (`store.learnerLevel`, from theta) answers what to teach today; *certified level* — new,
strict — is the highest band where every concept at or below it is `isVerifiedMastered`, excluding
provisional seeds. They disagree, and the disagreement is the product: **"Working at B1. A2 not yet
complete — 7 concepts unproven."** True, derived entirely from stored state, and impossible for an
app that does not model concepts individually. It is a mirror, never a gate.
**Changes.** Taxonomy grows from 49 (A1–B1) to ~170 (A1–C1), filling the `phrasing` category the
taxonomy has never used despite it being most of what separates B2 from B1; existing ids are
immutable because persisted learner state references them, so new concepts only, guarded by a graph
test (acyclic, prerequisites resolve, no prerequisite above its dependent's level). Two dials per
concept — mastery (`alpha/(alpha+beta)`, read with the deliberately-undecayed `observationCount` so
thin evidence cannot hide behind decay) and freshness (FSRS retrievability) — giving five states of
which **Asserted** is the notable one: it renders `isProvisional` placement seeds as the guesses
they are, and watching one convert to Solid the first time it is actually tested is what makes the
model feel trustworthy. Band gating in two layers: everything A1–C1 is always *visible*, but only
concepts at or below working level are electable or earn mastery credit, which is what stops an
ambitious learner feeding the estimator evidence from material they were never taught. Inside that,
unmet prerequisites offer a groundwork path with an override; the override records evidence for the
elected concept, does **not** propagate failure back onto the prerequisites, and is flagged
out-of-order so D3 can say *"you tried this before the groundwork"*. Elect-a-lesson is the existing
`ConceptSelector.scoped(candidateGapIds:)`, not new machinery. Three screens: map, level sheet, and
a concept page carrying state (D1), the reference article (D2), errors (D3's output), the walkable
DAG and the elect action.
**Absorbs D1 and D2.** Both were specified before this feature existed and both are now precisely
the concept page. Building them apart yields three surfaces each showing part of one concept. D3
stays separate — it owns the classifier — and D6 renders it. Roadmap goes 26 → 25 packages while
shipping more.
**Content.** A2 → B1 → B2 → C1 through the specialist author → simulated student → specialist
re-review pipeline, `validate_foundation_content.py --full` gating each band. ~1,450 new items on
top of today's 598. **This is the largest single item in the roadmap.** It parallelises by band, and
the map degrades honestly while it runs — an unauthored concept shows real state with an inactive
elect action, so the surface ships on the existing 49 and deepens band by band.
**Two things that must land inside this package, not after it.** (1) The bundled content resource
goes from 410 KB to ~1.5 MB, which is a visible launch hitch on older hardware — split per band and
lazy-load in `FoundationContentLoader`, public API unchanged. (2) B2/C1 register, idiom and nuance
are exactly where an agent pipeline is least reliable and where a confident wrong answer costs an
advanced learner most; those two bands ship **preview-labelled until a human native speaker reviews
them**. Band gating makes that affordable — almost no beta learner reaches B2, so the review happens
after launch without holding the beta. A1–B1 needs no label.
**Effort.** L for the engineering, XL for the content. **Depends on.** Nothing to start.

## Revised sequencing with D6

D6.1–D6.4 (taxonomy, graph tests, certified level, band gating) are pure engine work, read only
committed state, and start immediately. D6.5 (content) starts the moment the taxonomy lands and
runs in the background across the rest of the plan. D6.7 (the surfaces) replaces D1 and D2 in the
Lane 4 order, giving **D4 → D6 → D5 → D3**, with D6.5 running underneath all of it.

## What not to build

- **Every fabricated metric.** Expo's skill radar computes listening as
  `readingSessions * 10 + 20`, and its recaps label lifetime XP as weekly. iOS refuses to
  print a number it cannot defend, and that is worth more than the ceremony it lost.
- **Adaptation as the silent default.** It ships as an explicit, labelled, opt-in
  scaffold, or not at all.
- **Expo's five-stage parse ladder**, whose last fallback assembles an article from any
  lines carrying accents. Use one strict call and one retry instead.
- **Restoring Converse's voice call first.** Expo's version has no learning loop.
