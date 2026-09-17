# ADR-0040: The character creator draws with the level's puppet, through a DOM seam

- Status: Accepted (2026-09-14)
- Criteria: `docs/stories/TN-CREATOR-character-creator.md` (`TN-CREATOR-01`, `-03`, `-06`, `-07`, `-08`),
  amended the same day.
- Builds on: ADR-0005 (layers), ADR-0017 and ADR-0022 (the rig is the vocabulary and arrives as content),
  ADR-0008 (a port exists when something calls it).

## Context

A play-through audit found a P1: **the character creator has no picture of the character.** The screen offers
six groups — skin, hair shape, hair colour, head covering, glasses, style — and 1 440 appearances, and "Your
character" was a sentence: "Skin tone: 2, light. Hair: Short. …". A player chose a face and met it for the first
time on the ice. `app/ui/character-creator.ts` carried a comment about "the renderer that will drive the
preview", and nothing drove it.

Four facts shaped the answer.

1. **The art and the rules for placing it already exist, and are pure.**
   `app/adapters/phaser/sprite-character-renderer.ts` is a cut-out puppet with no Phaser import. It resolves the
   rig's frame templates, selects a state, interpolates keyframes and places each part through a seven-method
   `SpritePartObject` that a *host* supplies. The level's host is `this.add.image`.
2. **`app/ui` may not import an adapter** (ADR-0005), and the creator is DOM.
3. **An application port may not name the DOM.** The seam's first argument is the element to draw into.
4. **The budgets are tight where the creator lives.** It is the second screen of a first run: initial payload
   ≤ 8 MB and time-to-play ≤ 6 s, on a phone already running one WebGL context for the game behind the shell.

## Decision

### 1. The seam is a DOM host and a callback, owned by the screen

`app/ui/character-creator.ts` declares `CreatorArtFactory = (host, { selection, motion, onStatus }) => CreatorArt`,
where `CreatorArt` is `draw(selection)`, `setMotion(motion)` and `destroy()`. The screen creates the host — a
`<div data-testid="character-preview-art" aria-hidden="true">` inside the named preview group — calls `draw` on
every change the words make, forwards reduced motion, and calls `destroy` when it closes.

It is **not an application port**, and so it has no row in `docs/architecture.md` §5. A port lives in
`app/application/ports` and may not mention `HTMLElement`; this seam cannot be stated without one. It is the
same kind of seam as `onPlayLevel` or `onOpenStudy`: a shape a DOM screen publishes and the composition root
fills. `app/bootstrap/creator-art.ts` is the only place a concrete is chosen, and it hands the renderer the rig
(ADR-0022).

### 2. The concrete is the sprite puppet with a Canvas2D host — not a second game

`app/adapters/phaser/character-preview.ts` builds the level's own puppet with a host that records what each
part is asked to be and paints it with `drawImage` into one small `<canvas>`. The picture is therefore the same
atlas frames, templates, pivots and idle keyframes the level draws, and none of that is reimplemented. What is
transcribed is Phaser 4's `TransformerImage` arithmetic — origin and scale against the untrimmed frame, the trim
offset, `flipX` mirroring inside the frame box, translate-rotate-scale — and it is unit tested against those
rules, because a part that lands a few units off is the detached-arm defect the puppet already records once.

It samples half a texel inside each cut rectangle, with bilinear smoothing and no mipmaps. On the shipped page
the packer's one-texel extrude ring is not a copy of the frame's edge, and a canvas scaling a sub-rectangle
drew it as a faint box round every part.

### 3. It loads when the creator opens and is released when it closes

The atlas is the page the level loads, found in `manifest.json` by the frames on it and resolved by the level's
own `preferredAssetScale` and `bestScale`. It is fetched when the creator mounts, never on the title screen. On
`destroy` the frame loop stops, the decoded image's source is dropped, the canvas is sized to zero and removed.
A page that arrives after the creator closed is released on arrival.

### 4. Accessibility

- The words remain the preview: a group named by its heading and described by its sentence, in every state.
  The host and the canvas are `aria-hidden` and hold no control, so focus order, the switch ring and what a
  screen reader hears are unchanged.
- **Reduced motion is stillness.** No animation frame is requested; the puppet is built at rest and painted
  once per change. The shell now resolves motion from the setting **and** the device's preference
  (`resolveMotion`), and forwards a change made in Settings over the creator at once.
- **A failure is words, not an empty box** (`TN-CREATOR-03`). Any load failure, a missing 2D context, or a
  renderer that throws marks the host `failed` and hides it; a throw inside `draw` never interrupts the radio
  that caused it.
- **Layout.** At 100 % text on a phone-width sheet the picture sits beside the words and the panel is sticky,
  with `scroll-padding` so a focused control is never under it. At larger text the three stack and nothing is
  sticky, because a sticky panel a third of the screen tall would cover the options it exists to show. The
  picture is sized in px; text scaling grows words, not decoration.

### 5. What is observable

The host publishes `data-state` (`loading`, `ready`, `failed`) and `data-frames`, the atlas frames on the
picture back to front. Pixels are not comparable on a software GPU; "choosing tight curls put
`character-hair-coil-black` on the picture" is a string an e2e test can read.

## Alternatives considered

- **A second `Phaser.Game` on a small canvas.** Draws the same art with no transcription. Rejected: a second
  WebGL context alive beside the game's on a phone, a second boot and a second texture manager, for a picture
  118 CSS px wide. Disposing it cleanly on every close is also more than a 2D context needs.
- **Draw into the game's own canvas behind the DOM panel.** No second context. Rejected: the preview scrolls
  with the sheet, and registering a canvas region to a scrolling DOM box every frame is fragile at 200 % text,
  in the Settings editor, and under the rotate overlay.
- **Rive.** `app/adapters/rive` exists behind the same port, but the level ships the sprite puppet, and a
  preview drawn by a different backend from the level breaks "what you see is what the level draws".
- **An application port with an opaque host.** Would put an untyped `unknown` in `app/application/ports` to
  avoid naming the DOM, and gain nothing: the only implementer and the only caller are both outside the
  application layer.
- **Pre-rendered thumbnails per appearance.** 1 440 appearances, and a baked set encodes whichever couplings
  the exporter chose, which `docs/content-review.md` §8.2 forbids.

## Consequences

- The creator costs the shared character atlas page on open — 290 KB transferred at 2x (147 KB at 1x) plus a
  37 KB frame file — and the same bytes are a cache hit when the level opens. Nothing is added to the initial
  payload. While open, the decoded page (10.27 MiB at 2x) and a backing store of about 1 MB at device pixel
  ratio 3 are held; both are released on close, before any level loads.
- A second `<canvas>` is on the page while the creator is open. A test that located "the canvas" now names
  which one (`tests/e2e/first-run.spec.ts`).
- The picture shows the figure from above the crown to mid-thigh, because every choice is on the head; the
  crop is `PREVIEW_WINDOW`, and a unit test fails if a frame any choice changes falls outside it.
- If the Rive path ships for levels, the creator's backend is changed in `app/bootstrap/creator-art.ts` and
  nowhere else.

## Amendment, 2026-09-15: the whole figure, in the jacket

A second live-site audit found the picture cut off at the thighs and always in the winter parka
(`fr03-creator-random-1`), while eight levels of ten now dress the player in a jacket (`playerCostume`).

- **The whole figure.** `PREVIEW_WINDOW` is `{ x: 48, y: -6, w: 144, h: 476 }`, the toque's bobble to the soles,
  replacing the mid-thigh crop in the consequence above. The box is 100 × 240 CSS px instead of 118 × 188, so the
  head is drawn at about the size it was (scale 0.504 against 0.534) and the words beside it gain 18 px. The
  sticky panel is 52 px taller at 100 % text, and `scroll-padding-block-start` grows from 16rem to 19.5rem so a
  focused control still lands below it. At larger text the panel stacks, as before.
- **The jacket.** `costume` is not player-selectable, so the creator offers no choice of it. The composition root
  hands the adapter `CREATOR_COSTUME` (`jacket`), laid over the selection: it is what most levels, and Halifax
  where the journey starts, put on the player, and it shows the hands in the chosen skin tone. A preview-only
  toggle was rejected as a control for a choice the rig says nobody makes, and a labelled parka as a new sentence
  for the costume of two levels in ten. Without a costume the adapter still draws the artboard's own parka.

## Amendment, 2026-09-17: the picture grows with the text

A third live-site audit opened the creator at 200 % text: every word was twice its size and the picture was
still 100 × 240 CSS px. The consequence above — "the picture is sized in px; text scaling grows words, not
decoration" — is right for the rest of the game's art and wrong for this one, and the difference is what the
picture *is*. A landmark's drawing and the title's landscape illustrate words that already say the same
thing; this picture is the answer to "what will I look like", and no words on the screen carry it. Text
scaling is the setting a player with low vision reaches for, so the one thing they could not read any other
way was the one thing that did not grow.

- **`inline-size: min(6.25rem, 40vw)`, with `aspect-ratio: 5 / 12`.** 6.25rem is the 100 px the box already
  was, so nothing at 100 % text changes anywhere; 200 % text asks for 200 px and gets whatever the window
  allows. The cap is two fifths of the window — 156 px on a 390 px phone, 160 px at 400 px — so the picture
  can never take the screen from the options it exists to illustrate, and the page still does not scroll
  sideways. One length and a ratio rather than two lengths, so the figure cannot be stretched by a cap that
  bites on one axis only.
- **Nothing else moves.** The sticky panel and `scroll-padding-block-start: 19.5rem` are scoped to 100 % text,
  where the box is the size they were measured against. At larger text the panel already stacks and is not
  sticky, which is what leaves room for a bigger picture.
- **The drawing is drawn at the new size, not upscaled.** `app/adapters/phaser/character-preview.ts` sizes its
  backing store from `host.clientWidth`/`clientHeight` and observes the host with a `ResizeObserver`, so a
  larger box is re-rendered at device resolution and a text size changed in Settings while the creator is open
  is picked up live. No adapter was changed for this.
