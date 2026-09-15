# ADR-0041: A screen draws the art it names, and the words stay the screen

- Status: Accepted (2026-09-14)
- Slice: A3 (screens with art), from the live-site audit of 2026-09-14.
- Builds on: ADR-0005 (layers), ADR-0013 (decoded texture memory is the binding budget), ADR-0034 (the worker
  precaches the shell), ADR-0040 (the creator draws with the level's puppet through a DOM seam).
- Amends: ADR-0040 §3, "fetched when the creator mounts, never on the title screen". See §4 below.

## Context

A live-site audit on a 390 × 844 phone found two P2s in the DOM screens:

1. **The landmark card, the dialogue, the completion card and the Study home are huge, text-only white
   screens**, about 70 % blank. They show no landmark, no speaker and no stamp, and they hide the level
   completely: a player who walked up to the Halifax Town Clock reads about it on a white sheet with the clock
   gone.
2. **The title screen is empty.** About 40 % of it, between the tagline and the controls, holds nothing.

Four facts shaped the answer.

1. **The art already exists.** Every landmark on a card is a level's own drawing, loaded by the level for its
   `artKey` as a 1x WebP. Every speaker is either a character the level's puppet already draws, or a landmark.
   ADR-0040 already paints that puppet outside Phaser.
2. **Every one of these screens already says in words what a picture would show.** The card's heading names
   the landmark; the dialog is named by its speaker; the stamp sentence names the place.
3. **The screens are tested for accessibility, and the stylesheet is tested for flat, opaque colour** (no
   `rgba(`, no `gradient(`, no `backdrop-filter`), because axe cannot compute contrast over a wash and an
   unknown is a failure.
4. **The budgets.** Initial payload ≤ 8 MB with the worker's precache inside it (ADR-0034); decoded texture
   memory per level is the binding budget (ADR-0013); several browser specs count the page's `<canvas>`
   elements.

## Decision

### 1. A picture on a DOM screen is decoration, and the words stay the screen

`app/ui/screen-art.ts` draws every picture: an `aria-hidden` frame holding an `<img alt="">`, or a stamp built
the same way. A picture holds no control, is outside the element that names the dialog and the one that
describes it, and publishes `data-state` (`empty`, `loading`, `ready`, `failed`) and `data-src` for tests.
**A picture that cannot load hides itself**, as the creator's picture does (ADR-0040): the screen is then
exactly the screen it was before pictures existed. Pictures are sized in rem divided by the text scale, the
same CSS px at every scale, so text scaling grows the words and not the decoration.

A screen is handed a URL, or nothing. `app/ui` never resolves art.

### 2. What each screen draws

| screen | picture | where it comes from |
|---|---|---|
| Landmark card | the landmark, heading the sheet | the level's own image for the POI's `artKey` |
| Dialogue | a round portrait beside the speaker's name | a character: the level's puppet painted at a head crop. A landmark speaker (Peggy's Cove, the North): the landmark's own image, never a face |
| Completion card | a passport stamp beside the heading | a double ring and the silhouette of the level's hero landmark: its image used as a CSS mask over one flat ink. Inked when earned, a dashed outline on the card that says what is left |
| Title screen | the player's character in front of a landscape | the landscape is screen art (`assets/src/svg/screens/title-landscape.svg`); the character is the level's puppet, painted whole |
| Study home | the same landscape | the same file |

**The stamp's landmark** is the first point of interest whose art the pipeline names a landmark
(`<level>-landmark-<name>`), else the first point of interest. One per level, from the level's own art, with
nothing drawn per level. `tests/unit/bootstrap/screen-art.test.ts` holds every shipped level to having one.

**The landscape lifts, it does not redraw.** Peggy's Point Lighthouse and the CN Tower are the levels' own
drawings copied shape for shape (`assets/style/title-landscape.md`); the mountains, hills, lake, canoe and
spruce are generic landforms. No lettering, no emblem, no person.

### 3. A card over a level is a sheet, and the level is dimmed by darkening the picture

The landmark card, the dialogue and the completion card carry `tn-screen--sheet`. The modal root keeps its
role, its focus trap, its switch ring and its full-viewport box, so a tap above the sheet lands on the dialog
and not on the game; it paints nothing. The sheet hugs its content at the foot of the screen and is still
opaque paper. The level is dimmed with `filter: brightness()` on `#game` while a sheet is open: a change to the
canvas's own pixels, on an element that is `aria-hidden` and carries no text, never a translucent layer over
words. The Study home and the question card stay full screens.

### 4. Portraits and the figure are painted once, as images, and the page is let go

`app/adapters/phaser/character-still.ts` is ADR-0040's seam used a second way. The creator keeps its canvas
because its picture breathes and follows every choice. A portrait and the title's figure hold still, so they
are painted once into a canvas that is **never put on the page**, handed back as a `toBlob` object URL, and the
canvas, the decoded atlas page and the puppet are released before the call returns. The page's `<canvas>`
count is unchanged.

`app/bootstrap/screen-art.ts` is the one place that decides: it reads `manifest.json` once, resolves an
`artKey` to the level's image at the scale the level would choose, picks the stamp's landmark, paints each
placed character's face once when the level becomes playable, and paints the player's figure for the title in
the saved appearance. It imports the two adapter files directly, not the `@adapters/phaser` barrel. With no
page `fetch`, every answer is `null` and no screen draws a picture.

**ADR-0040 §3 is amended for the title screen only.** The creator still fetches its atlas when it mounts. The
title screen now asks for the character atlas page after it is built, to paint one still. It is not part of
the precache or the first paint, it is the page the creator and every level load next (a cache hit then), and
the decoded page is released as soon as the still exists.

## Budget impact

| cost | size | against |
|---|---|---|
| `title-landscape.svg`, precached with the shell | about 11 KB raw, 3 KB gzip | initial payload, 8 MiB |
| CSS and code | a few kB gzip in the main chunk | initial payload |
| Landmark card and stamp pictures | 0 new bytes: the level's own images, already fetched for the level | per-level payload, unchanged |
| Decoded landmark image while a card is open | at most 1080 × 1040 × 4 ≈ 4.3 MiB of DOM image, released when the card changes | not a WebGL texture; no level's texture budget moves |
| Portraits | one decode of the shared character page at level ready (9.82 MiB at 2x), released at once; kept: one PNG of at most 240 × 240 px per placed character | transient memory; the page is a cache hit |
| Title figure | after the title is built: `manifest.json`, the page's frame data (37 KB) and the page (290 KB at 2x, 147 KB at 1x); kept: one PNG of at most 523 × 1024 px | not in the precache; measured transfer on the title grows by that much, far inside 8 MiB |

`make assets` is unchanged: screen art is charged to no level, and no level's decoded texture total moved.

## Alternatives considered

- **An SVG thumbnail per landmark in the screen-art home.** Rejected: 35 copies of level art to keep in step
  with 35 sources, 266 KB of SVG on the precache, and a thumbnail that could drift from the landmark it depicts.
  The level's own WebP is the landmark, is already fetched, and costs nothing.
- **Hand-drawn stamp art per level.** Rejected: ten more drawings to verify as reference-accurate. A mask of the
  level's own landmark is accurate by construction and adds no file.
- **A translucent wash over the level.** Rejected by the stylesheet's own gate and for the reason behind it: a
  wash makes contrast uncomputable wherever text meets it.
- **Keeping a portrait canvas on the page, as the creator does.** Rejected: a still picture needs no backing
  store, and browser specs count canvases.
- **A second Phaser game or the level's canvas for portraits.** Rejected for ADR-0040's reasons.
- **The title figure as screen art.** Rejected: a hand-drawn player would not be the player, and the creator
  exists precisely so the player is theirs.

## Consequences

- The landmark card, the dialogue and the completion card show the level behind them, dimmed. A test that
  sampled the night colour behind those three screens would now sample the level.
- New test ids: `poi-card-art`, `dialogue-portrait`, `quest-complete-stamp-art`, `title-art`,
  `title-landscape`, `title-figure`, `study-art` (`docs/stories/README.md`).
- `QuestWiring.portraitOf` is optional, `DialogueContent.portrait`, `PoiContent.art` and
  `LevelCompleteContent.stampArt` are optional, and `ShellOptions.titleFigure` is optional: a caller that
  passes none draws every screen exactly as before.
- `tests/a11y/harness.ts` takes `?art=fixture` (inline drawings) and `?art=real` (the game's resolver), and
  `tests/a11y/screens-with-art.spec.ts` scans every changed screen with its picture loaded.
- The question card is not yet a sheet. If it becomes one, it is a class on its root and this ADR's §3.
