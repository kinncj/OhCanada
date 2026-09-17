# Blind art verification: the method

How `verify-art`'s blind identification step is meant to be run, what it can establish, and what it
cannot. Written after the first real pass over the Ottawa level on 2026-09-08. Results of that pass
are in `docs/art-verification.json`; this file is the method only.

## What the step is for

`assets/refs/references.json` claims a render "is" the Peace Tower. A verifier who is told that will
agree. The blind step exists to make the claim falsifiable: the identifier is shown a render with no
name and must produce the subject unprompted. If it cannot, the render is not recognisable, however
carefully it was drawn.

## Protocol

1. **Hand-off.** A step the identifier does not run copies each render to a working directory under a
   content-addressed name (`sha256(bytes)[0:12].png`) and writes the name-to-asset keymap somewhere
   the identifier will not read until step 4.
2. **Compose.** Renders are handed over as the player will see them. For a level that means a
   composite built from `content/levels/ottawa.json` layer offsets at design resolution, not a
   directory of parallax layers. Subjects in `references.json` are composites; assets are layers.
3. **Identify.** For each render the identifier writes, before anything else: what it is, as
   specifically as it honestly can; if a real place, which one and what in the image said so; a
   confidence; and what would have made it more certain. This is written to a file and that file is
   not edited afterwards.
4. **Compare.** Only now does the identifier open `references.json`, the keymap and the reference
   photographs, and record which `mustBeRight` entries are present, which are missing, and whether
   anything on `neverAdd` appears.
5. **Verdict.** Pass requires the unprompted identification to match `expectedBlindAnswer` *and*
   every `mustBeRight` entry to be present. "Recognisable once you know what it is" is a fail.

## Where the answers live, and how they are compared

Decided 2026-09-17, after a run whose verifier had read four accepted answers out of the harness's own
comments before it saw a pixel.

**The answers live in exactly one place: `expectedBlindAnswer` in `assets/refs/references.json`.** They are
compared to the verdict only by `scripts/lib/art-score.mjs`, and only *after* `verify-art commit` has frozen
the answers and `verify-art reveal` has opened the keymap. Nothing compares them earlier and nothing needs to.

**What the identifier is allowed to see while running.** One command and one directory. That is the whole
procedure, and the briefing inside the directory says so:

- the hand-off directory — renders, `READ-ME-FIRST.txt`, `answers.json`;
- whatever the command prints, *including every refusal*;
- `--help`, `Makefile`, and `scripts/verify-art.mjs`.

Those are asserted clean, mechanically, against every subject id, accepted answer and render filename in the
contract (`tests/unit/infra/art-handoff-gate.test.ts`). The refusal paths are asserted too, which is the
repair: a refusal used to quote the token it had matched, so the one message a verifier reads most carefully —
the one explaining why its run will not start — was the one that named an answer.

**What it may not open, and why that is a rule rather than a guarantee.** `scripts/lib/art-handoff.mjs` and
`scripts/lib/art-score.mjs` are off limits exactly as the contract is. They cannot be scrubbed: the recipe
table is *keyed* by subject id and the comments record per-subject measurements. Measured on 2026-09-17, the
build library's comments alone carry 64 leaking tokens. The four verbatim answers and the two quoted
identifications that had no business being there are gone, but the honest statement is not "the library is
clean" — it is **"the identifier never opens the library"**, and the blind path is built so it never needs to.
The previous wording claimed the prose named nothing, which was false, and rested a real rule on it.

**Recording a verdict.** The verifier never types a hash. `verify-art answer --handoff DIR --render NAME
--answer TEXT` writes one verdict against the artefact it is about and refuses a name that is not in the
directory; `verify-art record` copies the scored keymap, answers and audit into the verdict record verbatim.
On the last hand-written run two subjects were filed against each other's hashes, which voided a verdict that
had been reached correctly — a transposition scores exactly like a failure to identify.

## Blindness is fragile, and it broke on the first run

The 2026-09-08 pass could not be run blind. The identifier had to locate the renders before it could
rasterise them, and listing `assets/src/svg/ottawa/` shows `landmark-parliament-hill.svg`. The
subject was named by the filename before the image was seen.

The identification that followed was **closed-set**: the candidate answers were visible, so the
result is far weaker evidence than an open-set answer, and it was recorded as untrusted.

This is not a mistake to be more careful about next time. It is structural: *any* identifier that
locates its own inputs sees their names. Step 1 must be performed by something else, and the
identifier must be handed a directory of hashes and nothing else.

## Probes that partly recover a contaminated run

None of these substitute for a clean run. They bound the damage.

- **Specificity beyond the filename.** The filename said "parliament-hill". The identifier said
  "Peace Tower" and "Centre Block", which it did not. Naming a feature the label did not supply is
  weak positive evidence of real recognition.
- **Feature masking.** Remove the single strongest cue and re-identify. Masking the Canadian flag on
  the Ottawa landmark dropped confidence from about 90 to about 65 percent, and masking it on a
  tower-only crop made identification fail outright. This is the most informative probe available
  and it should be a standing part of the method, contaminated run or not: it separates "the
  architecture is right" from "there is a flag on it".
- **Size ladder.** Render at the size the level actually draws the asset and at least two sizes
  below it. Features that vanish first are the ones the art must exaggerate or thicken.

## What a blind pass can establish

- That a render is or is not recognisable to someone not told what it is.
- Which cues carry the recognition, and in what order, via masking.
- At what size recognition fails.
- Whether a deliberate exaggeration reads as accurate or as an error.
- Whether required features are present, and whether anything forbidden is.
- Whether a composite misleads in a way no single layer does.

## What it cannot establish

- **That a render is accurate.** Recognisable and accurate are different properties. A render can be
  instantly identifiable and still teach something false.
- **That an unfamiliar viewer would not be misled.** The identifier knows what Parliament Hill looks
  like. It can flag a suspected misleading detail; it cannot confirm the misreading empirically.
  Only a person who has not seen the place can do that.
- **That an omission is safe.** `simplifyAway` entries are judgements about what a learner does not
  need. Nothing in this method tests them.
- **Anything about an asset that does not exist.** Subjects with no render are recorded as
  unrendered. They are never recorded as passing and never as failing.

## Rules for the automated harness, when it is written

`scripts/verify-art.mjs` is infra's file and is deliberately still a stub. When it is implemented:

- It must not conflate "the model was shown a label" with "the model identified the subject". If the
  harness cannot guarantee anonymised hand-off, it must report `blindnessHeld: false` and mark every
  identification untrusted rather than emitting a pass.
- It needs an asset-to-subject mapping. There is none today, and without one the same render passes
  one subject and fails another (see AV-01 in `docs/art-verification.json`).
- It must resolve `neverAdd` against `mustBeRight` across subjects first. They currently contradict
  each other on the Library of Parliament's roof (AV-02).
- It must verify composites, not files (AV-04).
- Numeric ratios in `references.json` should be asserted against the SVG geometry, which is cheap and
  exact, and is what caught the arithmetic error in AV-03.

## Standing risk

The plan records: *"verify-art has never run. If blind identification proves unreliable, that is an
ADR, not a quiet downgrade of the bar."* After one pass the method looks sound in substance and
fragile in operation. The failure mode is not that identification does not work. It is that
blindness leaks, silently, and a leaked run looks exactly like a clean one in the output. That is
what the harness has to be built to prevent.
