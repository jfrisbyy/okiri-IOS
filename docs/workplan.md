# Okiri iOS — working rules

The binding rules for work on this app, and the owner decisions that settle scope.

> **Reconstructed.** The original `workplan.md` lived in a session scratch directory and
> was lost when the cloud container was rebuilt (November 2026). The rules below are the
> ones quoted verbatim in the original handoff and enforced throughout; the owner
> decisions are the answers recorded during the build; the content schema is read from
> `FoundationContentLoader.swift` and `ios/tools/validate_foundation_content.py`, which
> are authoritative where this page and the code disagree. The original's per-package
> file-ownership table and its store/engine API cheat sheet were not recoverable; read
> the code instead.

## Scope

- **`ios/FluentFrenchIOS/` is the product and the only app code to change.**
- **`expo/` is the legacy React Native version, kept as reference.** Read it when it
  clarifies intent. Never modify it, and never plan changes to it.
- `backend/` may be changed (owner decision), for example the schema comments in
  `backend/types.ts` that document the sync rule.
- Developer tooling lives in `ios/tools/`, and documents live in `docs/`.

## French content

- **Do not invent French.** Make only mechanically unambiguous content fixes, and flag
  everything else for human review. Never fabricate pedagogy.
- **New French goes through the authoring pipeline:** a specialist author writes it, a
  simulated beginner student tries it, a specialist re-reviews it, and only then is it
  final. Every band must pass `validate_foundation_content.py --full` before it lands.
- **B2 and C1 content ships labelled "preview"** until a human native speaker has
  reviewed it, because register, idiom and nuance are where an agent pipeline is least
  reliable.
- **Classifying an existing word into a concept is not inventing French.** It is
  allowed.

## Honesty in what the app shows

- **Never attribute generated text to a real outlet.** Eight fabricated mastheads
  (Le Monde, France Culture and others) were stripped from sample news for this reason.
- **Ship no in-copyright text.** *Le Petit Prince* was removed: Saint-Exupéry was
  *mort pour la France*, so the text stays in copyright in France until about 2045.
- **Copyrighted news is summarised, labelled and linked out.** It is never reproduced.
- **Never print a number the engine cannot defend.** No synthetic skill bars, and no
  lifetime totals labelled as weekly.

## Engineering

- **Every constant lives in `Services/Tuning.swift`.** Each one is named and carries a
  one-line comment. Logic contains no magic numbers.
- **The engine stays view-free.** No new logic goes in SwiftUI views, and no model or
  service type is defined in a view file (`ConverseScenario` was moved out of
  `ConverseView.swift` for this reason).
- **Existing concept ids are immutable.** Persisted learner state, `baseConceptIds` and
  the content's skill ids all reference them. Add concepts; never rename or remove one.
- **Cite the finding id in a comment** wherever a rule exists because of a specific
  defect, for example `(store-6-1)`. Later audits rely on these citations.
- **Shared files have per-package `MARK` blocks** (`Tuning.swift`, parts of
  `AppStore.swift`), so that concurrent work edits disjoint regions.

## Evidence integrity

These rules were each learned from a defect. Breaking any of them corrupts the mastery
estimator silently.

- **Trust is spent on certification, selection and counting, never on the Beta
  weight.** An unbroken streak at weight *w* converges to a mastery ceiling, and below
  `Tuning.masteryReachableWeightFloor` (0.30 today) a concept can never be mastered.
  `EvidenceWeightFloorTests` holds this line.
- **A remedial books no evidence.** It shows the answer before the learner picks.
- **Check-ins come only from graded formats.** A slip in Speak or Converse is not a
  failed check-in (`Tuning.isCheckInFormat`).
- **A placement seed is a guess until it is tested.** A band-inferred seed is weaker
  still, and must not become verified mastery on the same terms as earned practice.
- **A concept with no material is never ranked, targeted or announced.** Its evidence
  is kept for the day its content lands (`AppStore.isTeachable`, `hasTeachableMaterial`).
- **Level fit penalises distance in both directions, and harder upward.** Above-level
  material is material the learner cannot answer yet.
- **Warm-up items score at zero weight** (D4 design), so a confidence opener never
  becomes evidence.

## Verification before every commit

1. `ios/tools/linuxbuild/run.sh` passes with zero errors and zero warnings.
2. `swiftc -parse` passes on every changed SwiftUI view, since the harness cannot
   compile views.
3. `ios/tools/import_lint.py` and `ios/tools/foundation_lint.py` both report clean.
4. `ios/tools/validate_foundation_content.py ios/FluentFrenchIOS/Resources/FoundationContent.json --full`
   reports OK.
5. Commit and push at every verified checkpoint. Work that exists only in a container
   is not safe.

## Owner decisions

| Topic | Decision |
|---|---|
| French content | Specialist author → simulated student → specialist re-review → final |
| Hearts and XP | Make them real |
| Extra scope | Pass 3 engine amendments, accessibility on every view, backend changes allowed |
| Excluded | Guest mode |
| Reading sources | All four: openly licensed, page extraction, licensed API, full-text RSS |
| Copyrighted news | Summarise, label, link out |
| A1 reading shelf | Adapt Vikidia down |
| Reading content | Real text adapted to level, not created content |
| Social features | Deferred to v2 |
| Concept map scope | Full A1–C1 map, authored to real depth |
| Mastery and level | Mastery credit only inside the learner's band |
| Electing a lesson | Offer the prerequisite path, and allow an override |
| Progress display | Two dials per concept: mastery and freshness |
| CEFR framing | A certification frame over a category map |
| Teachability | 100% of the concepts must be genuinely teachable |

## Content schema v2

Each skill block in `FoundationContent.json` has these parts.

- **`id`**: a `ConceptTaxonomy` slug. A block naming no taxonomy concept is an error.
- **`category`**: it must match the taxonomy's category for the concept.
- **`teaching`**: the skill card.
  - `rule`: at least 60 characters.
  - `examples`: at least 2, each with `fr`, `en` and `note`.
  - `contrast`: at least 1 pair, each with `fr`, `en` and `note`.
  - `commonMistake`: required.
- **`probes`**: exactly 3.
  - Each has `fr`, `en`, `ex`, `exEn` and 3 distinct `options`, none equal to the
    answer.
  - It also takes an `ask` stem whenever the answer is a claim about `fr` rather than
    its meaning.
- **`items`**: at least 10.
  - Each has `fr`, `en`, `note`, `ex`, `exEn`, `diff` (`easy`, `okay` or `hard`),
    `blank`, `alts` and `testable`.
  - `blank` must occur in `ex` verbatim, as a whole word, and exactly once.

Two rules apply across skills:

- No `fr` may be duplicated across skills.
- No `en` may be duplicated within one concept, because duplicates collide as
  multiple-choice distractors.

**Proposed extension (not yet built).** This covers the 25 phrasing and register
concepts, which are situational rather than propositional; see the concept-map spec,
§9.2. All the new fields are optional:

- `teaching.whenToUse`.
- `situation` on examples, so that a contrast pair can contrast on context.
- `frame` on items, folded into multiple-choice and true/false prompts. Those formats
  currently have no context channel.
- `ask` and `options` on items.
