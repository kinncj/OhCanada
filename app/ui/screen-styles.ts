/**
 * One stylesheet for every DOM screen, and the visual identity of the game
 * outside the canvas.
 *
 * `app/ui` owns its presentation, and a `<style>` element keeps that true
 * without a CSS import only the bundler understands — the same choice
 * `rotate-overlay.ts` made and for the same reason.
 *
 * ## The look, and why it is this look
 *
 * CLAUDE.md fixes the art as "casual cartoon: bold rounded shapes, saturated
 * palette, 3-tone cel shading". The screens are the same product as the canvas,
 * so they are drawn to the same rules:
 *
 *  - **Flat fills only.** No gradient, no blur, no translucency, anywhere. The
 *    art bible forbids gradients in a material and the accessibility suite
 *    forbids them here for a second reason: axe cannot compute the contrast of
 *    text over a gradient or a wash, so it reports *incomplete* — an unknown,
 *    which `tests/a11y` treats as a failure. Depth comes from a hard offset
 *    shadow in a solid colour, which is how a cel-shaded drawing does it too.
 *  - **A paper sheet on a winter night.** The backdrop is `cobalt-shade`, the
 *    deep blue a level's zenith is painted in; the screen itself is a rounded
 *    sheet of `snow-light` that rises from the bottom edge, capped by a `brass`
 *    rule. Every control is a rounded slab with a drawn edge.
 *  - **Every colour is a palette id.** They come from `./palette.ts`, which
 *    transcribes `assets/style/palette.json` and is held against it by a test.
 *    Nothing here is a hex literal chosen for a button.
 *
 * ## Five things here are acceptance criteria, not decoration
 *
 *  1. **Touch targets.** `min-block-size: 3rem` is 48 px at 100 % and 96 px at
 *     200 %, because text scaling is applied as a root `font-size` percentage
 *     (`applySettings`). A pixel literal would shrink relative to the text it
 *     holds exactly when the player asked for bigger text. Every length in this
 *     sheet is in `rem` for that reason; `px` appears nowhere.
 *  2. **200 % text.** Every layout is single-column and wraps; nothing is sized
 *     in `vw`; long words break rather than push the page sideways
 *     (`overflow-wrap: anywhere`), which is what "the page does not scroll
 *     sideways" comes down to at 390 px. Rows that hold a label and a badge
 *     wrap rather than clip.
 *  3. **Reduced motion.** `[data-tn-motion="reduced"]` — set by `applySettings`
 *     from the setting *or* the media query — removes transitions and
 *     animations. The media query is honoured on its own as well, so stillness
 *     survives even if the attribute is never written. The one animation in the
 *     sheet is a screen's entrance, which carries no information: removing it
 *     removes movement and nothing else.
 *  4. **Colour is never the only signal.** Chosen, correct, wrong, locked and
 *     not-yet-built all carry a mark or a word *and* a change of border shape or
 *     weight; the high-contrast theme replaces every hue with black and white
 *     and the screens still read.
 *  5. **Focus is a ring and a halo.** `brass-light` inside `ink-cool`, so the
 *     indicator is visible on the paper sheet *and* on the night behind it,
 *     plus a change of border geometry so it survives greyscale, a colour-vision
 *     difference and forced-colours mode.
 */

import { PALETTE } from './palette';

const STYLE_ID = 'tn-screen-style';

const CSS = `
:root {
  /* Paper: the sheet a screen is printed on. */
  --tn-paper: ${PALETTE['snow-light']};
  --tn-paper-2: ${PALETTE['ice-light']};
  --tn-paper-3: ${PALETTE['snow-base']};
  --tn-ink: ${PALETTE['ink-cool']};
  --tn-ink-muted: ${PALETTE['slate-shade']};
  --tn-edge-soft: ${PALETTE['slate-base']};

  /* Night: the winter sky the sheet sits on, and the HUD strip. */
  --tn-night: ${PALETTE['cobalt-shade']};
  --tn-night-2: ${PALETTE['navy-shade']};
  --tn-on-night: ${PALETTE['snow-light']};

  /* Controls. One resting slab, one action that carries the player forward. */
  --tn-action: ${PALETTE['cobalt-base']};
  --tn-action-ink: ${PALETTE['snow-light']};
  --tn-action-edge: ${PALETTE['cobalt-shade']};
  --tn-primary: ${PALETTE['flag-red-base']};
  --tn-primary-ink: ${PALETTE['snow-light']};
  --tn-primary-edge: ${PALETTE['flag-red-shade']};

  /* Brass: a chosen option, a stamp, the thing in reach. */
  --tn-accent: ${PALETTE['brass-base']};
  --tn-accent-ink: ${PALETTE['ink-warm']};
  --tn-accent-edge: ${PALETTE['brass-shade']};

  /* An answer, judged. Always beside a mark and a word. */
  --tn-right: ${PALETTE['copper-light']};
  --tn-wrong: ${PALETTE['flag-red-light']};

  --tn-focus: ${PALETTE['brass-light']};
  --tn-focus-halo: ${PALETTE['ink-cool']};

  --tn-radius: 0.875rem;
  --tn-radius-sheet: 1.75rem;
  --tn-radius-pill: 62rem;
  --tn-edge-width: 0.1875rem;
  --tn-lift: 0.25rem;
}

/*
  High contrast replaces hue with black and white, and keeps every shape.

  Not a dimmer version of the theme above: the edges stay, the border-shape
  differences stay, and the marks and words stay, so a screen read in this mode
  carries exactly the same information as one read in colour.
*/
[data-tn-contrast="high"] {
  --tn-paper: #ffffff;
  --tn-paper-2: #ffffff;
  --tn-paper-3: #ffffff;
  --tn-ink: #000000;
  --tn-ink-muted: #000000;
  --tn-edge-soft: #000000;
  --tn-night: #000000;
  --tn-night-2: #000000;
  --tn-on-night: #ffffff;
  --tn-action: #000000;
  --tn-action-ink: #ffffff;
  --tn-action-edge: #ffffff;
  --tn-primary: #000000;
  --tn-primary-ink: #ffffff;
  --tn-primary-edge: #ffffff;
  --tn-accent: #ffffff;
  --tn-accent-ink: #000000;
  --tn-accent-edge: #000000;
  --tn-right: #ffffff;
  --tn-wrong: #ffffff;
  --tn-focus: #000000;
  --tn-focus-halo: #ffffff;
}

[data-tn-font="dyslexia"] .tn-screen,
[data-tn-font="dyslexia"] .tn-hud {
  font-family: "Atkinson Hyperlegible", "Comic Sans MS", Verdana, Tahoma, sans-serif;
  letter-spacing: 0.02em;
  word-spacing: 0.08em;
}

.tn-screen {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-y: auto;
  overflow-x: hidden;
  /* Flat, and opaque. See the note at the top about axe and gradients. */
  background: var(--tn-night);
  color: var(--tn-on-night);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  font-size: 1.0625rem;
  line-height: 1.5;
  overscroll-behavior: contain;
  padding-block-start: 1.25rem;
}

.tn-screen[hidden] { display: none; }

/*
  The hidden attribute beats every layout rule in this sheet.

  The UA sheet declares it at the lowest specificity, so a single class selector
  here -- .tn-screen button { display: flex } -- silently un-hides it. That is
  not a styling detail: it left an empty, unnamed "Next" button on the question
  card before the player had answered, which axe reports as a button-name
  violation and a screen-reader user hears as "button".

  (No backticks in this file's comments: the whole sheet is a template literal.)
*/
.tn-screen [hidden] { display: none !important; }
.tn-screen:focus { outline: none; }

/* ------------------------------------------------------------------ *
 * The sheet.
 *
 * It rises from the bottom edge and never leaves it, so the actions -- which
 * sit at its foot -- are always inside a thumb's reach, and the night above it
 * says there is a game behind this screen. On a wide window it is capped at
 * 34rem and centred, which is the portrait column ADR-0002 describes.
 * ------------------------------------------------------------------ */

.tn-screen__card {
  position: relative;
  box-sizing: border-box;
  inline-size: 100%;
  max-inline-size: 34rem;
  /* Grows with its content and fills the screen when there is less of it. */
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: var(--tn-paper);
  color: var(--tn-ink);
  border: var(--tn-edge-width) solid var(--tn-ink);
  border-block-end: 0;
  /*
   * The brass rule across the head of the sheet — a thick top *border*, not a
   * decorative pseudo-element, and the difference is an accessibility one.
   *
   * A ::before with a background makes axe give up on every descendant's
   * contrast: "Element's background color could not be determined due to a
   * pseudo element", reported as "incomplete", which tests/a11y treats as a
   * failure because an unknown is not a pass. It cost every screen in the game
   * its contrast proof for one coloured band. A border is painted by the same
   * box axe is already measuring, so it costs nothing.
   */
  border-block-start: 0.4375rem solid var(--tn-accent);
  border-start-start-radius: var(--tn-radius-sheet);
  border-start-end-radius: var(--tn-radius-sheet);
  padding:
    1.5rem
    max(1.125rem, env(safe-area-inset-right, 0px))
    max(1.5rem, env(safe-area-inset-bottom, 0px))
    max(1.125rem, env(safe-area-inset-left, 0px));
  animation: tn-sheet-rise 200ms ease-out;
}

@keyframes tn-sheet-rise {
  from { transform: translateY(1rem); }
  to { transform: none; }
}

.tn-screen h1,
.tn-screen h2,
.tn-screen h3 {
  margin: 0;
  line-height: 1.15;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--tn-ink);
}

.tn-screen h1 { font-size: 1.75rem; }
.tn-screen h2 { font-size: 1.25rem; }
.tn-screen h3 { font-size: 1.0625rem; }
.tn-screen p { margin: 0; color: var(--tn-ink); }

.tn-screen p,
.tn-screen li,
.tn-screen label,
.tn-screen h1,
.tn-screen h2,
.tn-screen h3,
.tn-screen button,
.tn-screen span {
  overflow-wrap: anywhere;
  hyphens: auto;
}

.tn-screen__help {
  color: var(--tn-ink-muted);
  font-size: 0.9375rem;
}

/* A small, bold line above a heading: what kind of screen this is. */
.tn-screen__eyebrow {
  font-size: 0.8125rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--tn-ink-muted);
}

/* ------------------------------------------------------------------ *
 * Controls: rounded slabs with a drawn edge and a hard offset shadow.
 *
 * Every one is at least 48 CSS px, and 96 at 200 % text.
 * ------------------------------------------------------------------ */

.tn-screen button,
.tn-screen [role="radio"],
.tn-screen [role="switch"],
.tn-screen input[type="range"] {
  box-sizing: border-box;
  min-block-size: 3rem;
  min-inline-size: 3rem;
  font: inherit;
  cursor: pointer;
}

.tn-screen button,
.tn-screen [role="radio"],
.tn-screen [role="switch"] {
  display: flex;
  align-items: center;
  /*
   * A control's contents wrap rather than clip.
   *
   * At 200 % text a label and its state word do not share a 390 px line, and a
   * flex row that cannot wrap grows past its own box: scrollWidth exceeds
   * clientWidth, which is exactly what tests/a11y's "no label is clipped"
   * check measures. Wrapping costs a row of height and loses nothing.
   */
  flex-wrap: wrap;
  gap: 0.75rem;
  row-gap: 0.25rem;
  inline-size: 100%;
  padding: 0.75rem 1rem;
  border: var(--tn-edge-width) solid var(--tn-action-edge);
  border-radius: var(--tn-radius);
  background: var(--tn-action);
  color: var(--tn-action-ink);
  font-weight: 700;
  text-align: start;
  box-shadow: 0 var(--tn-lift) 0 var(--tn-action-edge);
}

/* Pressed: the slab sinks onto the page. No transition, so it is instant and
   survives reduced motion unchanged. */
.tn-screen button:active { box-shadow: 0 0 0 var(--tn-action-edge); }

.tn-screen button:disabled { cursor: default; opacity: 1; }

/*
  The one action per screen that carries the player forward: Play, Continue,
  Start, Next. Red, larger type, and never more than one on a screen -- which is
  a rule about the markup, held by the screens that set the attribute.
*/
.tn-screen button[data-tn-action="primary"] {
  background: var(--tn-primary);
  color: var(--tn-primary-ink);
  border-color: var(--tn-primary-edge);
  box-shadow: 0 var(--tn-lift) 0 var(--tn-primary-edge);
  font-size: 1.125rem;
  justify-content: center;
  text-align: center;
}
.tn-screen button[data-tn-action="primary"]:active {
  box-shadow: 0 0 0 var(--tn-primary-edge);
}

/* Close, Back, Leave: present, reachable, and not competing for the eye. */
.tn-screen button[data-tn-action="quiet"] {
  background: var(--tn-paper);
  color: var(--tn-ink);
  border-color: var(--tn-ink);
  box-shadow: 0 var(--tn-lift) 0 var(--tn-edge-soft);
}
.tn-screen button[data-tn-action="quiet"]:active { box-shadow: 0 0 0 var(--tn-edge-soft); }

/*
  Focus: a bright ring inside a dark halo.

  Two colours because there are two surfaces -- the paper sheet and the night
  behind it -- and one ring cannot be visible on both. The border also changes
  shape and weight, so the indicator survives greyscale, a colour-vision
  difference and forced-colours mode, where an outline colour may be replaced.
*/
.tn-screen :focus-visible,
.tn-screen [data-switch-highlight="true"],
.tn-hud :focus-visible,
.tn-hud [data-switch-highlight="true"] {
  outline: 0.25rem solid var(--tn-focus);
  outline-offset: 0.1875rem;
  box-shadow: 0 0 0 0.5rem var(--tn-focus-halo);
  border-style: double;
  border-width: 0.25rem;
}

.tn-screen__group {
  background: var(--tn-paper-2);
  border: var(--tn-edge-width) solid var(--tn-edge-soft);
  border-radius: var(--tn-radius);
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.tn-screen__legend {
  font-weight: 800;
  padding: 0;
  color: var(--tn-ink);
}

/* Chosen: a mark, a word, a heavier border and a brass fill — never hue alone. */
.tn-screen [aria-checked="true"],
.tn-screen [aria-pressed="true"] {
  background: var(--tn-accent);
  color: var(--tn-accent-ink);
  border-color: var(--tn-accent-edge);
  border-style: solid;
  border-width: 0.25rem;
  box-shadow: 0 var(--tn-lift) 0 var(--tn-accent-edge);
}

.tn-screen__mark {
  font-weight: 800;
  font-size: 1.25rem;
  flex: 0 0 auto;
}

/*
 * A state word — "Off", "Open", "Correct answer".
 *
 * flex: 0 1 auto with min-inline-size: 0, not 0 0 auto: an item that may
 * not shrink keeps its max-content width whatever overflow-wrap says, and at
 * 200 % text that is how "Not made yet" pushed a card wider than the screen.
 */
.tn-screen__state {
  margin-inline-start: auto;
  font-weight: 800;
  flex: 0 1 auto;
  min-inline-size: 0;
  overflow-wrap: anywhere;
}

.tn-screen__row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/*
 * The actions sit at the foot of the sheet, where a thumb is.
 *
 * On a short screen that leaves white between the content and the controls, and
 * that was tried the other way round: giving the first child an auto margin too
 * splits the spare height and floats the heading into the middle of the sheet,
 * which reads as a layout that has lost its top rather than as a title screen.
 * Content at the top, the one red action at the bottom, whitespace in between.
 */
.tn-screen__actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-block-start: auto;
  padding-block-start: 0.5rem;
}

.tn-screen__actions button { justify-content: center; text-align: center; }

.tn-screen ul {
  margin: 0;
  padding-inline-start: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tn-screen li { color: var(--tn-ink); }

.tn-screen__options {
  list-style: none;
  padding-inline-start: 0;
  gap: 0.75rem;
}

/* An answer to pick: paper, not a slab, so the four of them read as a set. */
.tn-screen__options button {
  background: var(--tn-paper-2);
  color: var(--tn-ink);
  border-color: var(--tn-ink);
  box-shadow: 0 var(--tn-lift) 0 var(--tn-edge-soft);
}
.tn-screen__options button:active { box-shadow: 0 0 0 var(--tn-edge-soft); }

/*
  An answered option. The fill is the third signal, after the tick or cross and
  after the words "Correct answer" / "Your answer" that the card draws inside
  the button. Removing every colour from this rule loses nothing a player needs.
*/
.tn-screen__options button[data-tn-answer="correct"] {
  background: var(--tn-right);
  border-width: 0.25rem;
}
.tn-screen__options button[data-tn-answer="wrong"] {
  background: var(--tn-wrong);
  border-width: 0.25rem;
  border-style: dashed;
}

.tn-screen input[type="range"] {
  inline-size: 100%;
  accent-color: var(--tn-action);
}

.tn-screen__preview {
  border: var(--tn-edge-width) solid var(--tn-edge-soft);
  border-radius: var(--tn-radius);
  padding: 0.875rem;
  background: var(--tn-paper-2);
  color: var(--tn-ink);
}

/* A result, a warning, a dismissal: a callout with a thick leading edge. */
.tn-screen__notice {
  border: var(--tn-edge-width) solid var(--tn-ink);
  border-inline-start-width: 0.625rem;
  border-radius: var(--tn-radius);
  padding: 0.875rem;
  background: var(--tn-paper-2);
  color: var(--tn-ink);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* ------------------------------------------------------------------ *
 * The shell: the title screen and the level select.
 *
 * The shell's root is the page's <main>. It carries .tn-screen for the
 * presentation every surface here shares -- 48 pt controls, a focus ring that
 * is a change of geometry, reduced motion, high contrast -- and it is a
 * landmark, not a dialog, so it sits UNDER the dialogs it hosts.
 * ------------------------------------------------------------------ */

.tn-shell { z-index: 30; }

/*
  The storage warning sits above the view and must not sit BESIDE it. The shell
  is a column, so this is the row above the sheet, capped to the same column
  width, and it is empty and takes no space until there is a warning.
*/
.tn-shell__warning {
  inline-size: 100%;
  max-inline-size: 34rem;
  box-sizing: border-box;
  padding-inline: 1.125rem;
}
.tn-shell__warning:empty { display: none; }

/* ------------------------------------------------------------------ *
 * The title screen: the first thing anybody sees.
 * ------------------------------------------------------------------ */

.tn-title__hero {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-start;
}

.tn-title__brand {
  font-size: 2.75rem;
  line-height: 1.05;
  letter-spacing: -0.02em;
}

/*
  Three flat bands, in the flag's proportion. Decoration and nothing else: it
  carries no meaning, no text and no state, it is aria-hidden, and every screen
  reads identically with it removed.
*/
.tn-title__flag {
  display: flex;
  inline-size: 100%;
  max-inline-size: 11rem;
  block-size: 0.625rem;
  border-radius: var(--tn-radius-pill);
  overflow: hidden;
  border: 0.125rem solid var(--tn-ink);
}
.tn-title__flag span { display: block; block-size: 100%; background: var(--tn-primary); }
.tn-title__flag span:nth-child(2) { background: var(--tn-paper); flex: 0 0 40%; }
.tn-title__flag span:nth-child(1),
.tn-title__flag span:nth-child(3) { flex: 1 1 30%; }

.tn-title__tagline {
  font-size: 1.125rem;
  font-weight: 600;
}

/* ------------------------------------------------------------------ *
 * The level select: ten places, three states, and a stamp.
 * ------------------------------------------------------------------ */

.tn-levels {
  gap: 0.875rem;
}

.tn-levels__item {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

/*
  At 200 % text a place name and its badge do not fit on one 390 px line, so the
  row wraps rather than clipping the name. min-inline-size: 0 is what lets a
  flex item shrink below its content width at all -- without it the name keeps
  its intrinsic size and overflows the button instead of wrapping.
*/
.tn-levels button {
  flex-wrap: wrap;
  align-items: center;
  row-gap: 0.375rem;
  padding: 1rem;
  background: var(--tn-paper-2);
  color: var(--tn-ink);
  border-color: var(--tn-ink);
  box-shadow: 0 var(--tn-lift) 0 var(--tn-edge-soft);
}
.tn-levels button:active { box-shadow: 0 0 0 var(--tn-edge-soft); }

/* The level's number, as a disc: the journey has an order and the card says so. */
.tn-levels__number {
  flex: 0 1 auto;
  min-inline-size: 0;
  font-weight: 800;
  font-size: 0.875rem;
  padding: 0.25rem 0.625rem;
  border-radius: var(--tn-radius-pill);
  background: var(--tn-night);
  color: var(--tn-on-night);
}

.tn-levels__name {
  flex: 1 1 auto;
  min-inline-size: 0;
  font-size: 1.1875rem;
  font-weight: 800;
  overflow-wrap: anywhere;
  hyphens: auto;
}

/* The subject line takes a line of its own, so a card reads number and place,
   then what it teaches, and neither is squeezed at 200 % text. */
.tn-levels__subject {
  flex: 1 1 100%;
  min-inline-size: 0;
  color: var(--tn-ink-muted);
  font-weight: 600;
  overflow-wrap: anywhere;
  hyphens: auto;
}

/* The stamp in the passport, said as a word on a brass badge. */
.tn-levels__badge {
  flex: 0 1 auto;
  min-inline-size: 0;
  overflow-wrap: anywhere;
  font-weight: 800;
  font-size: 0.8125rem;
  padding: 0.1875rem 0.625rem;
  border-radius: var(--tn-radius-pill);
  border: 0.125rem solid var(--tn-accent-edge);
  background: var(--tn-accent);
  color: var(--tn-accent-ink);
}

.tn-levels .tn-screen__state {
  min-inline-size: 0;
  overflow-wrap: anywhere;
  font-size: 0.875rem;
  padding: 0.1875rem 0.625rem;
  border-radius: var(--tn-radius-pill);
  border: 0.125rem solid var(--tn-ink);
  background: var(--tn-paper);
}

/*
  Locked and not-yet-built are told apart by SHAPE and by a WORD, never by
  colour: a dashed edge for a place that can be earned, a dotted one for a place
  that is not in the game yet, and the badge beside the name says which. Nothing
  is dimmed with opacity -- that would trade one signal for a contrast failure.

  An open card carries a thick leading edge in the primary colour, which is the
  fourth signal on a card that already says "Open" and "You can play this now".
*/
.tn-levels [data-state="open"] {
  background: var(--tn-paper);
  border-inline-start-width: 0.625rem;
  border-inline-start-color: var(--tn-primary);
}
.tn-levels [data-state="locked"] { border-style: dashed; background: var(--tn-paper-3); }
.tn-levels [data-state="not-built"] { border-style: dotted; background: var(--tn-paper-3); }
.tn-levels [aria-disabled="true"] { cursor: default; box-shadow: none; }

@media (forced-colors: active) {
  .tn-levels [data-state="locked"] { border: 0.125rem dashed ButtonText; }
  .tn-levels [data-state="not-built"] { border: 0.125rem dotted ButtonText; }
}

/* ------------------------------------------------------------------ *
 * The passport: ten slots, three states, and a stamp that is a shape.
 *
 * The slots reuse the level select's geometry deliberately -- a player who has
 * read the map should recognise the row -- and differ in the two ways the story
 * asks for: a slot is not a control, and the three states are the passport's
 * three rather than the map's.
 *
 * COLOUR IS NEVER THE SIGNAL. Earned is a solid edge, a brass tick and the word
 * "Earned"; not earned yet is a dashed edge and its own word; not made yet is a
 * dotted edge, its word and a sentence. Nothing is dimmed with opacity, which
 * would trade one signal for a contrast failure, and a slot for a level nobody
 * has built draws no stamp shape at all -- an empty outline reads as a slot the
 * player could fill (OQ-PASSPORT-4).
 * ------------------------------------------------------------------ */

.tn-passport { gap: 0.625rem; }

.tn-passport__slot {
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  row-gap: 0.375rem;
  /* 44 pt is the floor for anything a player interacts with, and a slot is
     focusable even though it is not activatable: a switch and a keyboard both
     stop on it, so it is sized like a target rather than like a paragraph. */
  min-block-size: 3rem;
  padding: 0.875rem 1rem;
  border: var(--tn-edge-width) solid var(--tn-ink);
  border-radius: var(--tn-radius);
  background: var(--tn-paper-2);
}

.tn-passport__number {
  flex: 0 1 auto;
  min-inline-size: 0;
  font-weight: 800;
  font-size: 0.875rem;
  padding: 0.25rem 0.625rem;
  border-radius: var(--tn-radius-pill);
  background: var(--tn-night);
  color: var(--tn-on-night);
}

/* min-inline-size: 0 is what lets the name wrap instead of pushing the slot
   wider than the sheet at 200 % text. */
.tn-passport__name {
  flex: 1 1 auto;
  min-inline-size: 0;
  font-size: 1.1875rem;
  font-weight: 800;
  overflow-wrap: anywhere;
  hyphens: auto;
}

.tn-passport .tn-screen__state {
  min-inline-size: 0;
  overflow-wrap: anywhere;
  font-size: 0.875rem;
  padding: 0.1875rem 0.625rem;
  border-radius: var(--tn-radius-pill);
  border: 0.125rem solid var(--tn-ink);
  background: var(--tn-paper);
}

/* The sentence under a slot takes a line of its own, so the row above it is not
   squeezed at 200 % text. */
.tn-passport .tn-screen__help {
  flex: 1 1 100%;
  min-inline-size: 0;
  overflow-wrap: anywhere;
}

.tn-passport [data-state="earned"] {
  background: var(--tn-paper);
  border-inline-start-width: 0.625rem;
  border-inline-start-color: var(--tn-accent-edge);
}

.tn-passport [data-state="earned"] .tn-screen__state {
  border-color: var(--tn-accent-edge);
  background: var(--tn-accent);
  color: var(--tn-accent-ink);
}

.tn-passport [data-state="earned"] .tn-screen__mark { color: var(--tn-accent-ink); }

.tn-passport [data-state="not-earned"] { border-style: dashed; background: var(--tn-paper-3); }
.tn-passport [data-state="not-built"] { border-style: dotted; background: var(--tn-paper-3); }

.tn-passport__empty-slot:empty { display: none; }

@media (forced-colors: active) {
  .tn-passport__slot { border: 0.125rem solid CanvasText; }
  .tn-passport [data-state="not-earned"] { border: 0.125rem dashed CanvasText; }
  .tn-passport [data-state="not-built"] { border: 0.125rem dotted CanvasText; }
}

/* ------------------------------------------------------------------ *
 * The page under the screens: one <main>, one lower-third HUD.
 *
 * Two things here are acceptance criteria (TN-HUD-01, TN-HUD-08):
 *
 *  1. The HUD lives in the lower third and never covers the skater, so it is
 *     anchored to the bottom and capped at a third of the viewport. Growing
 *     text scrolls INSIDE the strip rather than pushing it up over the
 *     playfield.
 *  2. It is chrome, not a play control. pointer-events: none on the region and
 *     its rows, auto on the controls, so a hold on the play area behind the
 *     strip reaches the level and activates nothing here.
 * ------------------------------------------------------------------ */

.tn-main {
  position: fixed;
  inset: 0;
  pointer-events: none;
}

/*
  The <main> takes focus when a level opens (Hud.focus), so the screen reader
  reads the new page rather than the body. It is a landmark, not a control, and a
  ring drawn round the whole viewport would say "this is selected" about the
  page. The controls inside it keep their own focus ring, which is a change of
  geometry and not a colour (see :focus-visible above).
*/
.tn-main:focus { outline: none; }

.tn-hud {
  position: absolute;
  inset-inline: 0;
  inset-block-end: 0;
  box-sizing: border-box;
  max-block-size: 33vh;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding:
    0.875rem
    max(0.875rem, env(safe-area-inset-right, 0px))
    max(0.875rem, env(safe-area-inset-bottom, 0px))
    max(0.875rem, env(safe-area-inset-left, 0px));
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  font-size: 1rem;
  line-height: 1.4;
  color: var(--tn-on-night);
  /* Opaque, not a wash over the canvas: text on a translucent panel over a
     gradient has no computable contrast, and axe reports "incomplete" rather
     than a pass. */
  background: var(--tn-night);
  border-block-start: 0.25rem solid var(--tn-accent);
  border-start-start-radius: 1.25rem;
  border-start-end-radius: 1.25rem;
  pointer-events: none;
}

.tn-hud p {
  margin: 0;
  overflow-wrap: anywhere;
  hyphens: auto;
}

.tn-hud__status {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tn-hud__mode {
  font-weight: 800;
  font-size: 1.0625rem;
  letter-spacing: 0.01em;
}

.tn-hud__task { color: var(--tn-on-night); }

.tn-hud__slot {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tn-hud__slot:empty { display: none; }

/*
  The two controls a player needs while a level is running, on one row: the way
  to Settings and the way to everything else. They wrap to two rows rather than
  shrinking, because at 200 % text two words do not share a 390 px line.
*/
.tn-hud__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tn-hud__controls button { flex: 1 1 9rem; }

.tn-hud button {
  box-sizing: border-box;
  min-block-size: 3rem;
  min-inline-size: 3rem;
  inline-size: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  border: var(--tn-edge-width) solid var(--tn-ink);
  border-radius: var(--tn-radius);
  background: var(--tn-paper-2);
  color: var(--tn-ink);
  font: inherit;
  font-weight: 700;
  text-align: center;
  overflow-wrap: anywhere;
  cursor: pointer;
  box-shadow: 0 var(--tn-lift) 0 var(--tn-night-2);
  /* The controls, and only the controls, take input. */
  pointer-events: auto;
}

.tn-hud button:active { box-shadow: 0 0 0 var(--tn-night-2); }

/* What is in reach right now. Brass, so the thing to tap is the thing that
   looks tappable — and it carries the landmark's own name, so it is not colour
   doing the work. */
.tn-hud button.tn-hud__prompt {
  background: var(--tn-accent);
  color: var(--tn-accent-ink);
  border-color: var(--tn-accent-edge);
  box-shadow: 0 var(--tn-lift) 0 var(--tn-accent-edge);
  font-size: 1.0625rem;
}

/*
  The one-time explanation of the marks in the world (TN-REACH-04).

  A paragraph, never a control: it blocks nothing, takes no focus, is not in the
  Tab order and is not in the switch ring, which is a property of what it IS
  rather than a rule applied to it -- the ring walks controls, and this is a
  <p>. It sits beside the prompt rather than instead of it, so the offer is
  never replaced by an explanation of the offer.
*/
/*
  Something the game cannot do right now (TN-QUEST-05). A border and weight
  rather than a colour, like the storage warning above it: it reads as a notice
  in greyscale, in forced colours and to a player who cannot tell the hue from
  the rest of the strip. It is not an error and is not drawn as one.
*/
.tn-hud__notice {
  border: var(--tn-edge-width) solid var(--tn-on-night);
  border-inline-start-width: 0.625rem;
  border-radius: var(--tn-radius);
  padding: 0.5rem 0.75rem;
  color: var(--tn-on-night);
  font-weight: 700;
}

.tn-hud__hint {
  border: var(--tn-edge-width) solid var(--tn-on-night);
  border-radius: var(--tn-radius);
  padding: 0.5rem 0.75rem;
  color: var(--tn-on-night);
  font-weight: 600;
}

/*
  The storage warning. A border and a mark of weight rather than a colour, so it
  reads as a warning in greyscale, in forced colours, and to a player who cannot
  tell the hue from the rest of the strip.
*/
.tn-hud__warning {
  border: var(--tn-edge-width) solid var(--tn-ink);
  border-inline-start-width: 0.625rem;
  border-radius: var(--tn-radius);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--tn-paper-2);
  color: var(--tn-ink);
}

.tn-hud__warning-title { font-weight: 800; }

@media (forced-colors: active) {
  .tn-hud button { border: 0.125rem solid ButtonText; }
  .tn-hud__warning { border: 0.25rem solid CanvasText; }
}

/* Motion is a separate axis from the visual tier: the attribute is written from
   the setting OR the media query, and the media query is also honoured alone. */
[data-tn-motion="reduced"] .tn-screen,
[data-tn-motion="reduced"] .tn-screen *,
[data-tn-motion="reduced"] .tn-hud,
[data-tn-motion="reduced"] .tn-hud * {
  animation: none !important;
  transition: none !important;
  scroll-behavior: auto !important;
}

@media (prefers-reduced-motion: reduce) {
  .tn-screen,
  .tn-screen *,
  .tn-hud,
  .tn-hud * {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}

@media (forced-colors: active) {
  .tn-screen button,
  .tn-screen [role="radio"],
  .tn-screen [role="switch"] { border: 0.125rem solid ButtonText; }
  .tn-screen [aria-checked="true"] { border-width: 0.25rem; }
}
`;

/** Idempotent: a second screen on the page reuses the first one's stylesheet. */
export function injectScreenStyles(doc: Document): HTMLStyleElement {
  const existing = doc.getElementById(STYLE_ID);
  if (existing !== null) return existing as HTMLStyleElement;

  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.append(style);
  return style;
}
