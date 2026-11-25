# D6 — The Concept Map

The whole of French, laid out; the learner's real position on it; and a way in at any point.

Decisions taken by the owner: full A1–C1 map, authored to real depth through the French
specialist pipeline; mastery credit only inside the learner's band; prerequisite path offered
with an override; two dials (mastery and freshness); certification frame over a category map.

---

## 0. The reconciliation that makes this feature interesting

The app already has two different notions of "what level are you", and until now only one of
them was visible. Keeping both, and showing the gap between them, is the spine of this feature.

- **Working level** (`store.learnerLevel`, derived from theta in `ConceptSelector.learnerLevel()`)
  is fast and adaptive. It answers *what should we teach you today.* It moves on aggregate
  ability and can run ahead of any particular concept.
- **Certified level** is new, strict and exhaustive. A level is certified only when **every**
  concept at that level and below is `isVerifiedMastered` — mastered, and not a provisional
  placement seed. It answers *what have you actually proven.*

These two will disagree, and the disagreement is the product:

> **Working at B1. A2 not yet complete — 7 concepts unproven.**

That sentence is worth more than any streak. It catches the learner who raced ahead on
confidence, it is true, it is derived entirely from state we already store, and no competitor
shows it because no competitor models concepts individually. It is also the honest answer to
"why does this app keep giving me A2 material when it says I'm B1."

Certified level never blocks anything. It is a mirror, not a gate.

---

## 1. Scope of the map

### 1.1 Taxonomy extension — A1 through C1

Today: 49 concepts (31 A1, 10 A2, 8 B1), categories grammar 24 / vocabulary 16 /
pronunciation 3 / register 3. `GapCategory` also has `phrasing`, which the taxonomy has never
used — an obvious hole once the map is visible, because phrasing is most of what separates B2
from B1.

Target shape, to be settled by the specialist agent rather than asserted here:

| Level | Concepts (est.) | Character of the band |
|---|---|---|
| A1 | 31 (existing) | articles, gender, present tense, core prepositions |
| A2 | ~30 | past tenses, pronouns, comparatives, everyday register |
| B1 | ~35 | subjunctive entry, relative clauses, hypotheticals, connectors |
| B2 | ~40 | full subjunctive, aspect, nuance, argument structure, phrasing |
| C1 | ~35 | literary tenses, idiom, irony, register control, discourse |
| **Total** | **~170** | |

Two invariants the extension must hold:

1. **Existing ids never change.** `Concept.id` slugs are referenced by `gaps.conceptId`,
   by `baseConceptIds`, by `FoundationContent.json` skill ids and by persisted user state.
   Renaming one silently orphans a learner's history. New concepts only.
2. **The DAG stays acyclic and every prerequisite resolves.** A new harness test walks the
   whole graph, fails on a cycle, on a dangling prerequisite id, and on any concept whose
   prerequisite sits at a *higher* CEFR level than itself — which is always an authoring bug.

### 1.2 Content authoring

Content schema v2 per concept: 1 teaching card + 3 probes + 10–12 items. Today's
`FoundationContent.json` is 49 skills / 598 items / 410 KB. At ~170 concepts that becomes
roughly **2,050 items and ~1.5 MB**.

**This has an engineering consequence that must be handled in the same package:** a 1.5 MB
JSON decoded synchronously at launch is a visible hitch on an older device. Split the resource
into one file per band (`FoundationContent-A1.json` … `-C1.json`), keep the v2 schema
unchanged, and have `FoundationContentLoader` load the learner's band and the one below eagerly
and the rest on demand. The loader's public API does not change, so nothing downstream moves.

Authoring runs band by band through the established pipeline — **specialist author → simulated
beginner student → specialist re-review → final** — with the existing
`ios/tools/validate_foundation_content.py --full` gate on every band before it lands
(blank-in-example, whole-word blanks, no duplicate `fr` across skills, no duplicate `en` within
a concept, exactly 3 probes, teaching present).

**One caveat I want on the record.** A1–B1 content has a natural safety net: errors are
mechanically detectable and the simulated-student pass catches what the validator doesn't.
B2 and C1 do not have that net — register, idiom and nuance are exactly where an agent pipeline
is least reliable and where a confident wrong answer does the most damage to an advanced
learner. My recommendation is that **B2 and C1 ship behind a "preview" label until a human
native speaker has reviewed them**, and that the map's band gating (§3) is what makes this
affordable: almost no beta learner will reach B2 anyway, so the review can happen after launch
without holding the beta. A1–B1 needs no such label.

---

## 2. The two dials

Both already exist in state; neither has ever been rendered.

**Mastery** — `concept.mastery` (`alpha / (alpha + beta)`), the Beta posterior with recency
decay λ=0.85. Read alongside `observationCount`, which is deliberately kept undecayed so that
*how little we have seen* cannot be hidden by *how long ago we saw it*. Below the evidence
floor the dial renders as an explicit unknown, never as a low score — "not tested yet" and
"tested and failed" are different facts and must never look the same.

**Freshness** — FSRS retrievability, aggregated across the concept's items at read time. Answers
*would you still get this right today.*

The cross product gives five honest states:

| State | Condition | Copy |
|---|---|---|
| Untested | `observationCount` below floor, not provisional | Not tested yet |
| Asserted | `isProvisional` | You told us you know this — we haven't tested it |
| Learning | mastery below threshold, real evidence | Getting there |
| Solid | `isVerifiedMastered`, freshness high | Solid |
| Faded | `isVerifiedMastered`, freshness low | Solid, but due for review |

**Asserted** is the one that pays off a piece of honesty the engine already practises and the
UI has never admitted: placement seeds are guesses. Showing them as guesses, and watching them
convert to Solid the first time they are actually tested, is a small thing that makes the whole
model feel trustworthy.

All five derive in a `nonisolated` function on the store, testable in the Linux harness with no
view involved. Thresholds go to `Tuning.swift` under a Package D6 extension block.

---

## 3. Band gating and electing a lesson

Gating operates in two independent layers that were separate answers to separate questions:

**Layer 1 — band reach.** Derived from `store.learnerLevel` (working level, not certified).

| Concept level vs. working level | Visible | Electable | Earns mastery |
|---|---|---|---|
| At or below | yes | yes | yes |
| One band above | yes | no — "Opens at B1" | no |
| Two or more above | yes, dimmed | no | no |

Everything is visible at all times. That is the point of the feature — the learner sees the
whole language, including the parts they cannot touch yet. Mastery credit accruing only inside
reach is what stops an ambitious learner from feeding the estimator evidence from material they
were never taught.

**Layer 2 — prerequisites**, inside what is electable. On tapping a concept whose prerequisites
are not yet mastered:

> **Object pronouns** builds on *noun gender* and *present tense: -er verbs*.
> [ Start with the groundwork — 3 lessons ] [ Go straight to object pronouns ]

The groundwork path is a scoped selection over the unmet prerequisites, in topological order.
The override runs a scoped selection on the concept itself.

**The override must not corrupt the model.** Three rules:

1. The attempt records normally as evidence for **the elected concept**.
2. Failures on it do **not** propagate as evidence against the prerequisites — the learner was
   warned that the groundwork was missing; a failure there is expected and carries no
   information about the prerequisite itself.
3. The attempt is flagged out-of-order, so D3's diagnosis layer can say something true and
   useful rather than something vague: *"you tried this before the groundwork — that is why it
   felt hard."*

Elect-a-lesson is `ConceptSelector.scoped(candidateGapIds:)`, which already exists and is
already harness-tested. No new selection machinery.

---

## 4. Structure of the surface

Category map with a certification frame over it (owner's choice), three screens.

**4.1 Map.** Persistent header carrying working level, certified level and the gap between them
(§0). Below it, sections by `GapCategory` — Grammar, Vocabulary, Pronunciation, Phrasing,
Register — each concept a row with its CEFR badge and its state (§2). Filters for band, for
category, and for "needs review" (the Faded set, which is a genuinely useful daily entry point).
Reachability is expressed by weight and a lock affordance, never by hiding.

**4.2 Level sheet.** Tapping the header opens the certification detail: for each band, the
concepts still standing between the learner and completing it, each electable inline. This is
the screen that turns "A2 not complete" from an accusation into a to-do list, and it is the
one most likely to drive a session.

**4.3 Concept page.** One concept, and the natural home for three things currently planned
apart:

- the learner's own state — both dials, evidence count, when it was last tested, when it comes
  back (`fsrs.dueAt` is already computed, so "Thursday" is a fact) — **this is D1**;
- the reference article — `teaching.rule`, annotated examples, contrast pairs, common mistake,
  all authored and shipping and currently visible for about ten seconds mid-lesson — **this is
  D2**;
- the learner's own errors on this concept, from `AppStore.errorPatterns` — **this is D3's
  surface**;
- prerequisites and dependents, each tappable — the DAG, walkable;
- and the elect-a-lesson action from §3.

### Recommendation: D6 absorbs D1 and D2

D1 (inspectable model) and D2 (reference grammar bound to mastery) were specified as separate
packages before this feature existed. Both are now, precisely, the concept page. Building them
separately means three surfaces that each show part of one concept and a learner who has to
learn which one to open.

**Fold D1 and D2 into D6 as the concept page.** D3 stays its own package — it owns the
classifier and the diagnosis logic — and D6 renders its output. This drops the roadmap from 26
packages to 25 while increasing what ships, and it is a smaller total build than D1 + D2 + a
separate map would have been.

---

## 5. Work breakdown

| # | Work | Effort | Depends on |
|---|---|---|---|
| D6.1 | Taxonomy extension to A1–C1 (~170 concepts): ids, names, categories, levels, prerequisites, descriptions. Fills the `phrasing` hole. | M | — |
| D6.2 | Graph integrity tests: acyclic, prerequisites resolve, no prerequisite above its dependent's level, existing ids unchanged | S | D6.1 |
| D6.3 | Certified level + the five states, `nonisolated` on the store, harness-tested | S | D6.1 |
| D6.4 | Band reach + prerequisite path/override, including the three evidence rules | M | D6.3 |
| D6.5 | Content authoring A2 → B1 → B2 → C1 through the specialist pipeline, validator-gated per band | **XL** | D6.1 |
| D6.6 | Per-band resource split + lazy loading in `FoundationContentLoader` | S | D6.5 |
| D6.7 | Map, level sheet, concept page (absorbing D1 and D2) | L | D6.3, D6.4 |

D6.1–D6.4, D6.6 and D6.7 are ordinary engineering and land together. **D6.5 is the long pole
and is the largest single item in the entire roadmap** — roughly 1,450 new authored items
across four bands. It parallelises by band and by concept, and the map degrades honestly while
it runs: a concept with no content yet shows on the map with its real state and an inactive
elect action rather than a broken one. So the surface can ship on the existing 49 and deepen
band by band as authoring completes.

---

## 6. What could go wrong

- **Certified level reads as failure.** "A2 not complete" next to "working at B1" can land as
  a rebuke. Copy must frame it as remaining work with a route, which is what the level sheet
  (§4.2) is for. Worth watching in beta feedback specifically.
- **170 rows is a lot of surface.** The filters carry the weight; the "needs review" filter is
  the one that makes it a daily object rather than a monthly one.
- **B2/C1 content quality.** Covered in §1.2 — preview label, human review before it is load-
  bearing for anyone.
- **Bundle size.** Covered in §1.2 — per-band split, which must land with the content, not after.

---

## 7. Sequencing correction found while building D6.1

Extending the taxonomy surfaced two things that were not visible when this spec was
written, and they reorder the package. **D6.4 (band gating) is now a prerequisite of
D6.5 (content authoring), not a parallel track.** Authoring B2/C1 content before the
reach rule exists actively breaks the app for a beginner.

Both were found by running the headless simulations against the full 181-concept map with
content faked in for every concept — which is precisely the state D6.5 creates as it lands.

**7.1 Placement rides to the top of the map and seeds nothing.** The placement bank is built
from `store.probeContent`, i.e. only the 49 authored concepts today, so the shipped app is
unaffected. Once probes exist for the whole map, the adaptive staircase climbs to band 4 and
never fully probes a *base* concept, so `AssessmentResult.masteredConceptIds` comes back empty
— placement seeds nothing, and reading never unlocks because its gate reads that set. The fix
is a band cap on the bank (never offer more than one band above the running estimate) or
extending the seeding tiers beyond `baseConceptIds`. Either way it must land in the same
package as the first non-B1 content, and the sim that caught it is the regression test.

**7.2 Selection has no band reach, so the frontier fills with C1 leaves.** With gaps present
for every concept, an A1 learner's ranked frontier populates with C1 concepts — they are
leaves in the DAG with no unmet prerequisites recorded, so nothing currently stops them. This
is exactly the failure §3's reach rule prevents, which makes D6.4 load-bearing rather than a
UI affordance: it is the guard that keeps the estimator clean once the map is bigger than the
content.

**7.3 Fixed while here.** `ConceptSelector.leverageScore` recomputed the dependent-count
maximum over every concept, for every concept, with an O(n) `dependents(of:)` filter
underneath — O(n³) per ranking, about 6 million operations per selection at 181 concepts.
Counted once per selector instance. Harness suite time fell from 316s to 47s.

**Revised order inside D6:** D6.1 → D6.2 → D6.3 → **D6.4** → D6.5 (band by band, each band
gated by the validator and by 7.1's placement cap) → D6.6 → D6.7.

---

## 8. Owner requirement, set after D6.1 landed

> "We need 100% of the concepts to genuinely be teachable in the app."

This supersedes §1.2's "ships on the existing 49 and deepens band by band" as an *acceptance
bar*. Band-by-band remains the delivery order; it is no longer an acceptable end state. **All
181 concepts must reach full schema v2 — teaching card, 3 probes, 10–12 items — before the map
is considered done.** The B2/C1 preview label from §1.2 still stands as a quality gate, but it
now labels content that exists and awaits human review, never content that is absent.

### 8.1 Teachable means three layers, not one

A concept is teachable only with all three:

| Layer | Artefact | Consumed by |
|---|---|---|
| Explanation | `teaching`: `rule` (≥60 chars), ≥2 `examples` with notes, ≥1 `contrast` pair, `commonMistake` | the skill card, and D6's concept page |
| Assessment | 3 MC `probes` | placement, blind-spot probes, the Bayesian estimator |
| Practice | 10–12 `items` (`fr`/`en`/`note`/`ex`/`exEn`/`blank`/`alts`/`testable`) | `GapItem`s, and every question type |

Counting "authored" by any one layer overstates readiness. The validator gates all three.

### 8.2 D6.8 — Captured gaps must join the concept map

**The defect.** `CaptureDraft.conceptId` (`Models/Gloss.swift:155`) defaults to `nil`, and six
of the nine capture sites never set it:

| Site | conceptId |
|---|---|
| `ContentScreens.swift:869`, `:872` — reading | **nil** |
| `WatchPlayerView.swift:1048`, `:1050` — watch | **nil** |
| `SharedComponents.swift:414`, `:417` — shared (listen / speak / generic) | **nil** |
| `IdiomsView`, `AccentView`, `TensesView`, `ConverseView` | set |

`AppStore` then does `let linked = concept(draft.conceptId)`, so a word saved while reading is
an orphan card. It advances no concept's mastery, appears nowhere on the map, and tells the
model nothing. The product's most differentiating loop — read real French, hit what you don't
know, save it — feeds nothing back into what the app decides to teach.

**The requirement it breaks.** The owner's third condition: *users must be able to learn
through the gaps they identify by interacting with the app.* Today they can practise those
gaps as isolated flashcards; they cannot learn a concept through them.

**Shape of the fix** (architecture under design; four candidates being scored on pedagogy,
engineering and estimator integrity):

1. **Classify** every capture into one of the 181 concepts. Classification of an existing word
   is not authoring French, so it does not touch the no-invented-French rule.
2. **Count** a correct answer on a captured item as Beta evidence for its concept, with a guard
   against inflating mastery by saving and drilling easy self-chosen words — the highest-risk
   part, and the reason the estimator-integrity lens is scored separately.
3. **Surface** both sources on the concept page: authored items, and *your own* words for it.
4. **Select on it** — accumulated captures for one concept should pull that concept forward in
   `ConceptSelector`, so three saved partitive constructions surface the partitive lesson. This
   is the app teaching what the learner's own reading revealed, and is the sharpest expression
   of the product thesis.

**Partial teachability** is then an honest intermediate state: a concept with captures but no
authored content can be practised from the learner's own words while the map says plainly that
no lesson exists yet. That is a legitimate way station to 100%, not a substitute for it.

### 8.3 Open question being sized: does schema v2 survive B2/C1?

`definite-articles` decomposes cleanly into 10–12 single-token-blank items. `hedging-and-nuance`
and `irony-and-understatement` may not. If the item shape must extend for discourse-level
concepts (sentence-level items, multi-blank, judgement items), that change has to stay backward
compatible with the 49 authored concepts and with `AnswerGrader` and `LessonAssembler` — and it
must be settled **before** authoring 132 concepts against a shape that cannot carry them.

---

## 9. D6.8 architecture, and the answer to §8.3

Four architectures were designed independently and scored on pedagogy, engineering and
estimator integrity. **deterministic-first and learner-in-loop tied at 21**, llm-first 20,
multi-label 14. The synthesis takes deterministic-first as the spine and grafts the
learner-in-loop confirmation step, which costs nothing when ignored.

### 9.1 The constraint that decides the evidence design — LANDED

`recordConceptAnswer` decays before it adds, so a perfect streak converges to a **ceiling**,
not to 1. Solving ceiling = `masteryThreshold` gives a hard floor:

> **w_min = (1 − λ)(2t − 1)/(1 − t) = 0.30** at today's constants.

Below it a concept can **never** be mastered, however many correct answers it receives. Every
shipped product clears it — the lowest, true/false on an easy item, is 0.40 with a ceiling of
0.786 — and `conceptWeight` is only ever 1 or 1.6, so there is no live defect. The margin is
0.036 and invisible at the call site.

It becomes a defect the moment provenance scales the weight, which is the obvious way to build
D6.8: discounting a captured item by 0.6 puts true/false-on-easy at 0.24, ceiling 0.722,
permanently unmasterable — worst for exactly the self-saved recognition-drilled items such a
rule targets.

**Rule: trust is spent on certification, selection and counting. Never on the Beta weight.**

Landed in commit `cfaf681`: `Tuning.masteryReachableWeightFloor` (derived, not a literal) and
`EvidenceWeightFloorTests`, which simulates the real update rather than the closed form and
asserts every `AnswerFormat` × difficulty × lesson/capstone product clears the floor.

### 9.2 Answer to §8.3 — schema v2 mostly survives B2/C1

**Right for 107 of the 132 missing concepts. Structurally insufficient for 25** (16 phrasing,
9 register). All four teaching fields are *propositional* — what a thing means, how it is
formed. Phrasing and register are *situational*: the skill is knowing who you are talking to
and what it costs you to get it wrong. Nothing in the current shape can hold that.

Three additive optional fields, backward compatible by construction (both structs already have
tolerant decoders), so the 49 authored concepts are untouched:

| Field | On | Carries |
|---|---|---|
| `whenToUse` | `FoundationTeachingContent` | the situational half of the rule |
| `situation` | `FoundationExampleContent` | lets a **contrast pair** contrast on *context*, not only form — the only way to teach register |
| `frame` | `FoundationItemContent` | folded into the MC prompt and TF statement by the scheduler |

`frame` is not cosmetic, and the reason is a real pedagogical finding: the recognition tier is
multiple-choice-only, and MC/TF have **no context channel at all** — the prompt is literally
`What does "<word>" mean?`. So the first three or four exposures of every item are context-free.
Correct for A1 vocabulary; useless for situational meaning, where true/false renders
*"ce n'est pas mal" means "it seems to me that" → False* — trivially answerable, teaches nothing.

A fourth, engine-side: allow `ask` + `options` on items, not just probes. `FoundationProbeContent`
is already a fully general judgement item, but there are only 3 per concept and the scheduler
returns none for practice, so it can never be drilled. `GapItem` already carries
`probePrompt`/`probeOptions` with tolerant decode, so this is a handful of scheduler lines and
no new model fields.

**Consequence for D6.5: authoring is unblocked for 107 concepts today.** The 25 situational ones
wait on this schema extension — which is small, and should land before their band is authored.

### 9.3 Classification: the chokepoint is `AppStore.addGap`

Every capture path reaches it — all 9 `CaptureDraft` sites plus the five that bypass
`CaptureDraft` (`captureListeningTurn`, `recordSpeakFeedback`, `recordConverseCorrection`,
`captureConversePhrase`, `extendCard`). Classifying there needs **zero SwiftUI edits**, which is
what keeps the engine view-free.

New `Services/ConceptClassifier.swift`, nonisolated and pure so the harness can compile it.
Stage 0 is a lexicon built from authored content — which grows from 598 keys to roughly 2,182 as
D6.5 lands. **Authoring content and improving offline classification are the same act**, and that
is the strongest argument for doing D6.5 and D6.8 in that order.
