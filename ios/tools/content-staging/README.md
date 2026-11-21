# Staged A1/A2 content (not yet in the app)

These eight files hold lessons for the 33 A1/A2 concepts that had none. Each group was
written by a French specialist agent, then worked through by a simulated English-speaking
learner. A second specialist then reviewed it, acting on or rejecting each learner finding.
Every group passed `validate_foundation_content.py`, and the full merge validated as
`OK: 82 skills, 998 items`.

They are **not merged** into `ios/FluentFrenchIOS/Resources/FoundationContent.json` yet.
Merging them breaks two existing engine simulations:

- **Placement:** `PlacementFlowTests` fails because placement only seeds A1 concepts, so
  an A2 learner gets no credit for A2 vocabulary.
- **Mastery:** `HeadlessDriverTests.expectMasteredCountTracksTruth` fails because, as the
  curriculum grows, the engine credits more concepts as mastered than the simulated
  learner's ground truth supports, and some items are never asked.

Both problems are in the engine, not in the content. Merge with `merge_staged.py` once
they are fixed.

`flagged-for-human.json` lists the items the reviewers want a native speaker to check.
