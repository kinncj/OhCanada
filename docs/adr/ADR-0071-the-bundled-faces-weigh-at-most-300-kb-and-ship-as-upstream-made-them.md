# ADR-0071: The bundled faces weigh at most 300 KB, and ship as upstream made them

- Status: Accepted (2026-09-23). **Decided by the product owner on 2026-09-23**; this record writes the
  decision down with the measurements it was made on.
- **Amends ADR-0066 §1** in one respect: the ceiling on the bundled faces. "The bundled faces together add
  **≤ 200 KB** to the initial payload" becomes **≤ 300 KB**. ADR-0066's Budget impact table and its §1
  obligation carry the old figure and are annotated in the same commit. Nothing else in ADR-0066 moves: one
  UI face and one dyslexia face, unmodified, OFL-1.1 admitted for fonts only, no synthetic emboldening, and
  the gate measuring lines against a pinned face and a named fallback all stand as written.
- **Amends `CLAUDE.md`**, the **Type** row, in the same commit: "≤ 200 KB together" becomes "≤ 300 KB
  together". The owner authorised that edit. Nothing else in the agreement moves.
- Slice: F2k (ADR-0066), §1.
- Numbering. `git log --all --name-only -- docs/adr` across every ref this repository can see, after
  fetching all five remote heads (`main`, `archive/v0.1`, `claude/fervent-dijkstra-vxyz3k`,
  `read-step-at-dows-lake`, `task-strip-gate`), puts the high-water mark at 0070. The remote heads stop at
  0066; 0067 and 0070 are on this branch and 0068 and 0069 are on local branches of other agents. No
  document on any head names 0071. **0071 is the first number above the mark.** Those two numbers are
  written bare on purpose: the contract gate resolves every prefixed token to a file in `docs/adr`, and
  they are not on this branch.

## Context

ADR-0066 §1 decided that the game ships one bundled UI face and one bundled dyslexia face, unmodified, and
capped them together at 200 KB. It named Atkinson Hyperlegible as the family the stylesheet already asked
for. It did not name a dyslexia face.

The implementer measured the obvious pair before writing any code (recorded in `docs/plan/slices.md`, row
F2k, 2026-09-23). The faces are fetched from their upstream repositories, and their bytes were checked
against upstream again for this record:

| face | role | upstream, path | bytes | sha256 |
|---|---|---|---|---|
| Atkinson Hyperlegible Regular | UI, 400 | `googlefonts/atkinson-hyperlegible` @ `1cb3116`, `fonts/webfonts/AtkinsonHyperlegible-Regular.woff2` | 23 196 | `2df4ba17…a1150` |
| Atkinson Hyperlegible Bold | UI, 700 | same commit, `fonts/webfonts/AtkinsonHyperlegible-Bold.woff2` | 23 776 | `da8fce41…3c075` |
| OpenDyslexic Regular | dyslexia, 400 | `antijingoist/opendyslexic` @ `1824da5`, `compiled/OpenDyslexic-Regular.woff2` | 103 336 | `0441bc21…e8695` |
| OpenDyslexic Bold | dyslexia, 700 | same commit, `compiled/OpenDyslexic-Bold.woff2` | 108 068 | `b534a0b8…94fbf` |
| **together** | | | **258 376** | |

Full digests are in `tests/unit/infra/bundled-faces.test.ts`, which holds the shipped files to them. Both
licences are OFL-1.1. Atkinson Hyperlegible's `OFL.txt` (Copyright 2020 Braille Institute of America, Inc.)
declares **no** Reserved Font Name. OpenDyslexic's `OFL.txt` (Copyright 2019 Abbie Gonzalez) declares the
**Reserved Font Name "OpenDyslexic"**. OpenDyslexic's upstream README says its sources have moved to
`forge.hackers.town/antijingoist/opendyslexic`. The GitHub repository still serves the compiled files, and
those are the bytes measured here.

**258 376 B is over the 200 KB ceiling.** OpenDyslexic alone at 400 and 700 is 211 404 B. The only
unmodified set under 200 KB was Atkinson at 400 and 700 with OpenDyslexic at 400 alone (150 308 B). That set
gives the dyslexia toggle one weight. The sheet asks for 600 and 800 in most of its headings, labels and
state words, so it would need `font-synthesis: none` to keep the browser from emboldening synthetically,
and every bold word in the dyslexia rendering would be drawn regular. ADR-0066 did not address a
single-weight dyslexia face. Choosing between that and a larger ceiling was the owner's call, not an
implementer's. Subsetting OpenDyslexic to fit is modification, which ADR-0066 §1 refuses. It would also
engage the Reserved Font Name clause, so the result could not be called OpenDyslexic.

## Decision

### 1. The ceiling is 300 KB

**The bundled faces together add ≤ 300 KB to the initial payload.** The kilobyte is read as 1 000 bytes,
the stricter reading, so the ceiling is **300 000 B**. The four faces above weigh 258 376 B, leaving 41 624 B
of headroom. That is 3.2 % of the 8 MB initial-payload budget. `make build` weighs them inside the initial
payload, and `tests/unit/infra/bundled-faces.test.ts` holds their total to this ceiling.

### 2. All four faces ship, and each has one role

- **UI face: Atkinson Hyperlegible, 400 and 700.** `.tn-screen`, `.tn-hud` and the Phaser canvas' text.
- **Dyslexia face: OpenDyslexic, 400 and 700.** Selected by `[data-tn-font="dyslexia"]`.
- The sheet asks for 400, 600 and 800. Both families offer 400 and 700, so CSS font matching picks 700 for
  600 and 800 and does not synthesise (ADR-0066 §1). OpenDyslexic Bold's own `OS/2` weight class is 800.
  The `@font-face` rule declares it as `font-weight: 700`, and the descriptor is what matching reads, so
  600 and 800 both reach it. A browser test asserts that no weight the sheet asks for is emboldened
  synthetically. It checks both the advance width (synthetic bold keeps the regular advances) and the ink
  (synthetic bold adds ink to whatever face it thickens).

### 3. The files are the upstream bytes, and nothing else

- **No modification of any kind.** No subsetting, re-hinting, re-compressing, renaming inside the file, or
  table editing. The shipped `woff2` is byte-identical to the upstream file named above. A unit test compares
  each file's sha256 with the digest recorded there, so a modified file fails `make test` rather than a
  review.
- **Reserved Font Name.** OFL-1.1 §3 forbids a *Modified Version* from using the Reserved Font Name.
  OpenDyslexic reserves "OpenDyslexic". Because nothing is modified, the file keeps its name, and the
  `@font-face` family may be called `OpenDyslexic`. If a future change needs a modified OpenDyslexic, it
  must also rename the face, and it needs a new ADR, because this one forbids the modification in the first
  place. Atkinson Hyperlegible reserves no name. The no-modification rule still binds it, for ADR-0066 §1's
  reason: an unmodified file is the only one whose licence question is already answered.
- **Each licence text ships beside its files**, as `OFL.txt` in the face's directory under
  `assets/src/fonts/`, unmodified from upstream. The copyright notice travels with the font (OFL-1.1 §2).

### 4. The width rule binds the UI face. The dyslexia face gets its own line budget

ADR-0066 §1 requires that "the pinned face's advance width for the sweep's reference strings … must be no
greater than the current CI runner's". Measured at 32 px in this container's Chromium over eight reference
strings (the sweep's widest task, its stem, two offers and two indicators, in both languages):

| face | 400 | 600 / 700 / 800 |
|---|---|---|
| `system-ui` here, which is DejaVu Sans (fontconfig; identical widths at every weight) | 4 603 px | 5 217 px |
| Liberation Sans | 4 106 px | 4 406 px |
| **Atkinson Hyperlegible** | **4 061 px** (0.88×) | **4 389 px** (0.84×) |
| **OpenDyslexic** | **7 030 px** (1.53×) | **7 420 px** (1.42×) |

Ratios are against DejaVu Sans. **The CI runner's `system-ui` face is still unidentified.** ADR-0066 keeps
that as an open obligation, and this record does not claim to discharge it. What can be said is that
Atkinson is narrower than both sans faces this container has. So it cannot be wider than the runner's face
unless the runner renders something narrower than Liberation Sans. The runner rendered **50** overflows where
a Liberation Sans machine rendered 0, so that is not the case.

**OpenDyslexic is about 1.53× wider than DejaVu Sans at 400.** It cannot meet the UI face's rule, and it is
not asked to. It is chosen for its letterforms, by a player who asked for it, and the width is the cost of
what it is for. It is held instead to **its own line budget**, measured by the §4 sweep on the same strips
in the same two languages. The numbers are recorded below, in §5, by the commit that lands that sweep.

### 5. The dyslexia face's line budget

Measured on 2026-09-23 by the ADR-0066 §4 sweep in `tests/a11y/readability.spec.ts`: 390 × 844, every level's
tallest offer and all 72 task steps, English and French. Lines are distinct line boxes. "Below" counts rows
that end under the strip, where the player has to scroll.

| face | text | tallest offer | longest task | offer + indicator | below the strip |
|---|---|---|---|---|---|
| Atkinson Hyperlegible (pinned) | 200 % | 2 | 4 | 3 | 0 |
| DejaVu Sans, web font disabled (fallback tier) | 200 % | 3 (FR), 2 (EN) | 5 (FR), 4 (EN) | — | 0 |
| **OpenDyslexic** | 100 % | 2 | 4 (FR), 3 (EN) | 3 | **0** |
| **OpenDyslexic** | 200 % | 4 | 6 | 5 | **EN: 2 offers, 30 tasks. FR: 3 offers, 45 tasks** |

**The dyslexia face's budget is: offer ≤ 4 lines, task ≤ 6 lines, offer + indicator ≤ 5 lines**, at every
text size. These are the measured maxima, with no headroom, so a longer task or offer fails the sweep. At
100 % the rows also end inside the strip, and the sweep asserts that too.

**At 200 % they do not, and no line budget can make them.** A six-line task is taller than the strip, which
ADR-0066 §3 caps at a third of the screen. In OpenDyslexic, "Réglages" and "Menu" also no longer share a row
at 200 %, which costs the strip one more line. The face's tall ascender (1.3 em against a fixed 1.2 line
height) also draws some accents and the "/" of "3/7" into the line above. So ADR-0066's original defect,
the task below the fold at 200 % text, is back for the one group of players who turned on the dyslexia
toggle. No copy edit reaches it: the face is 1.5× wider than the widest face the copy was fitted to. The
sweep holds the counts above as a **ratchet**: they may fall and may not rise. The obligation below carries
the decision that brings them to zero. Choosing among the ways out (a dyslexia-specific strip layout, letting
the dyslexia strip grow past a third, a narrower dyslexia face, or taking back the 0.02 em letter- and
0.08 em word-spacing the sheet adds on top of a face that already spaces generously) is a product decision,
not the implementer's.

### 6. The fallback while a face is not yet drawn

- The UI stack is `"Atkinson Hyperlegible", "TrueNorth Text Fallback", sans-serif`. The dyslexia stack is
  `"OpenDyslexic", "Atkinson Hyperlegible", "TrueNorth Text Fallback", sans-serif`. No stack names
  `system-ui` or a device family.
- **"TrueNorth Text Fallback"** is an `@font-face` the game defines. Its `src` is `local()` over three faces
  built to share Arial's advance widths, so one set of overrides is correct for whichever of them resolves.
  Its `ascent-override`, `descent-override` and `line-gap-override` are Atkinson Hyperlegible's vertical
  metrics. Its `size-adjust` brings its average advance **toward** Atkinson's, as ADR-0066 §1 asked, but not
  onto it. A `local()` face renders with hinted, whole-pixel advances, so the adjustment moves the width in
  steps. It is **98 %**, the largest step that never draws wider than Atkinson at the 200 % sizes where the
  line budget binds. Measured over five strip strings at 15–38 px, the fallback runs 0.96–1.05× Atkinson's
  width, and 0.96–0.99× at 30–38 px. With the web font blocked, the sweep's reference string is 875 px in
  the fallback against 887 px in Atkinson. It is a defined face with
  declared metrics, not a stack entry that "may or may not be installed, in versions nobody chose": if none
  of the three is installed, the face does not exist and the stack falls through to `sans-serif`.
- The dyslexia stack falls back to the **UI face**, not to a metric-adjusted fallback of its own. To match
  OpenDyslexic's average advance, a sans face would have to be drawn at about 170 % of its size, which
  changes its height as well as its width. It would read as a different, larger text size, not as a stand-in.
  Falling back to Atkinson keeps the size the player chose. The fallback is also narrower, so it can only
  loosen the dyslexia budget, never breach it.
- `font-display: swap` for all four. The worker has them after the first visit (ADR-0034), and the
  metric-adjusted fallback is what makes the swap on a cold first paint cost little.

## Alternatives considered

- **Keep 200 KB and ship OpenDyslexic at 400 only, with `font-synthesis: none`.** Rejected by the owner.
  Every bold word in the dyslexia rendering would be drawn regular. Most headings, labels, state words and
  the task indicator are 600 or 800 in the sheet, so a player who asked for an easier font would lose the
  weight contrast everyone else gets.
- **Keep 200 KB and choose a lighter dyslexia face.** Not taken. No other dyslexia-oriented face the
  implementer could find ships under OFL-1.1 or more permissive, with the French accents, at two weights
  under the remaining 153 KB. A generic legibility face would make the toggle change only letter-spacing,
  which is the defect ADR-0066 set out to remove.
- **Subset OpenDyslexic to Latin-1.** Rejected by ADR-0066 §1 and again here. It is modification, the result
  could not be called OpenDyslexic, and it buys tens of kilobytes against an 8 MB budget.
- **Load the dyslexia face lazily, outside the precache.** Rejected. The toggle would fall back to the UI
  face offline until the face had been fetched once online, so a setting would silently do nothing on the
  device where the player turned it on.

## Budget impact

| cost | size |
|---|---|
| Atkinson Hyperlegible, 400 + 700 | 46 972 B |
| OpenDyslexic, 400 + 700 | 211 404 B |
| **Bundled faces together** | **258 376 B, against a 300 000 B ceiling** |
| Initial payload | 8 MB budget; the faces are 3.2 % of it |
| Level payloads, decoded texture memory | unchanged |

Time-to-play: the UI face is 47 KB and is on the first paint's path through `document.fonts.load`. The
dyslexia face is fetched only when the toggle is on, or by the worker after `load`. The 6 s budget on
25 Mbps is not at risk from 258 KB. `make build` confirms it on every run, and does not rely on this
estimate.

## Consequences

- The dyslexia toggle changes the rendered face on every device that runs the game. A browser test can
  assert that it does, and one does.
- A dyslexia strip holds roughly two thirds of the characters per line that a UI strip holds. The HUD layout
  was sized for the UI face, so the §4 sweep measures the dyslexia rendering separately against the budget
  in §5, rather than letting it inherit a number it was never measured against.
- The answer marks ✓ and ✗ on a judged question card are not in Atkinson Hyperlegible, and ✗ is not in
  OpenDyslexic. Those two glyphs are therefore drawn from whatever face the device has that holds them. They
  sit in a fixed, non-wrapping box beside the answer and never decide where a line breaks, but a glyph from
  a face nobody chose is still ADR-0066's defect in miniature. The obligation below carries it.

## Obligations

Written in ADR-0009's format.

- ~~**OBLIGATION due=2026-11-09 owner=ui-a11y** — record in §5 the dyslexia face's line budget, measured by
  the ADR-0066 §4 sweep on the same strips, languages and text scale as the UI face, and make the sweep
  assert it.~~
  **DISCHARGED 2026-09-23**, in the commit that lands the sweep. §5 records the budget (offer ≤ 4, task ≤ 6,
  offer + indicator ≤ 5) and the measurement it comes from, at 100 % and 200 %, in both languages. The
  sweep asserts the budget, asserts every row inside the strip at 100 %, and holds the 200 % overflow
  counts as a ratchet.

- **OBLIGATION due=2026-10-21 owner=architect** — the dyslexia strip at 200 % text. With the dyslexia toggle
  on, 30 English and 45 French task steps, and the task's count under 2 and 3 levels' tallest offers, end
  below the HUD strip (§5). That is ADR-0066's defect again, for the players who asked for an easier font.
  Decide the way out (§5 lists the candidates), land it, and set `DYSLEXIA_200_BELOW_THE_STRIP` in
  `tests/a11y/readability.spec.ts` to zero, so that tier asserts the backstop like the others.

- **OBLIGATION due=2026-12-07 owner=ui-a11y** — the answer marks. Draw ✓ and ✗ from a bundled face or as a
  drawn mark, so that no text the game prints falls back per glyph to a device face. Alternatively, record
  here why a device glyph in that fixed box cannot move a line. The coverage was measured on 2026-09-23 over
  every string in `content/` and `app/`: all Latin and French letters and punctuation are in both faces, and
  the only on-screen gaps are these two marks.

## References

- ADR-0004: third-party asset licences, amended by ADR-0066 for fonts only.
- ADR-0009: the obligation markers above.
- ADR-0034: the worker precaches the shell, and the faces ride with it.
- ADR-0066: the decision this one amends in one number.
- `assets/src/fonts/`: the four files and their licence texts.
- `tests/unit/infra/bundled-faces.test.ts`: the digests and the ceiling.
