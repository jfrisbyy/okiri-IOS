# Staged A1/A2 content (merged into the app)

These eight files hold lessons for the 33 A1/A2 concepts that had none. Each group was
written by a French specialist agent, then worked through by a simulated English-speaking
learner. A second specialist then reviewed it, acting on or rejecting each learner finding.
Every group passed `validate_foundation_content.py`, and the full merge validated as
`OK: 82 skills, 998 items`.

They are merged into `ios/FluentFrenchIOS/Resources/FoundationContent.json` by
`merge_staged.py` (re-running it on the pre-merge file reproduces the shipped file byte
for byte). The merge first broke two engine simulations, both fixed in the engine:

- **Placement:** placement seeded only A1 base concepts, so an A2 learner got no credit
  for A2 vocabulary. Seeds are now every concept verified clean at or below its
  category's cleared band (firstrun-10-1, `PlacementEngine.seededConceptIds`).
- **Mastery:** `HeadlessDriverTests.expectMasteredCountTracksTruth` counted truth at a
  stricter line than the engine's own mastery standard, and at the matched standard the
  engine left lapsed concepts untaught for weeks (engine-8-3,
  `ConceptSelector.unfinishedConceptBonus`); some items of mastered concepts were never
  asked (engine-4-1, reserved review slots).

`flagged-for-human.json` lists the items the reviewers want a native speaker to check.
