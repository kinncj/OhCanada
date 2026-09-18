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
 *     in `vw`; a word moves to the next line whole, and breaks only when that
 *     one word is wider than its line (`overflow-wrap: break-word`, and
 *     `anywhere` in the few boxes that must shrink below a word), which is what
 *     "the page does not scroll sideways" comes down to at 390 px. **No
 *     automatic hyphenation** (ADR-0045): "citoyen-neté" is two words to a
 *     reader who is learning the language. Rows that hold a label and a badge
 *     wrap rather than clip.
 *     **Chrome that holds still (ADR-0039).** Text scales; the space around it
 *     does not have to. On a 390 px phone at 200 % text, padding, card edges and
 *     the HUD's gaps that doubled with the text took the width and the height
 *     the words needed — map cards drew one word per line and the HUD pushed its
 *     action off screen. Where space is the constraint, a length is written
 *     `calc(Nrem / var(--tn-text-scale, 1))`: still rem, the same CSS px at every
 *     scale, and a minimum written that way is held to the same 2.75rem (44 px)
 *     floor by the unit suite. The text inside keeps growing, so a control still
 *     grows with its label; only the empty space around it stops doubling.
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
  /* The side gutters hold still at large text (see the note at the top): 18 px
     at every scale, which gave every screen 36 px of line back at 200 %. */
  padding:
    1.5rem
    max(calc(1.125rem / var(--tn-text-scale, 1)), env(safe-area-inset-right, 0px))
    max(1.5rem, env(safe-area-inset-bottom, 0px))
    max(calc(1.125rem / var(--tn-text-scale, 1)), env(safe-area-inset-left, 0px));
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

/*
  No automatic hyphenation, anywhere (ADR-0045).

  Automatic hyphenation split words a grade-6 or dyslexic reader has to put back together
  -- "cov-ering", "citoyen-neté", "govern-ment" -- on lines that had room for
  the whole word. A word now moves to the next line whole. break-word breaks
  inside a word only when that one word is wider than its whole line, and it
  does not shrink a box to force a break, so a word is split only where nothing
  else would fit. The few narrow boxes that must shrink below a word -- a map
  card's name and pills, a state word -- say overflow-wrap: anywhere on their
  own rule, and still draw no hyphen.
*/
.tn-screen,
.tn-hud {
  hyphens: manual;
}

.tn-screen p,
.tn-screen li,
.tn-screen label,
.tn-screen h1,
.tn-screen h2,
.tn-screen h3,
.tn-screen button,
.tn-screen span {
  overflow-wrap: break-word;
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
  /* The side padding holds still at large text (ADR-0039, ADR-0045): at 200 % it
     took 64 px of a 274 px option, and "Masculin" split inside the word. */
  padding: 0.75rem calc(1rem / var(--tn-text-scale, 1));
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

/*
  "Delete my progress": the one control in this game that destroys something.

  A shape and a word, never a colour (CLAUDE.md: colour is never the only
  signal). It keeps the paper fill and takes the heavier double edge the focus
  ring also uses, so it reads as different in greyscale, under a colour-vision
  difference and in forced colours. Deliberately NOT red: red is the primary
  action, the one that carries a player forward, and a destructive control
  dressed as the primary one is the control somebody presses out of habit.
*/
.tn-screen button[data-tn-action="destructive"] {
  background: var(--tn-paper);
  color: var(--tn-ink);
  border-color: var(--tn-ink);
  border-style: double;
  border-width: 0.25rem;
  box-shadow: 0 var(--tn-lift) 0 var(--tn-edge-soft);
}
.tn-screen button[data-tn-action="destructive"]:active { box-shadow: 0 0 0 var(--tn-edge-soft); }

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

/*
  A confirmation's question is a stop in the switch ring (app/ui/confirm.ts),
  so the rule above lands on a heading that has no border of its own: it would
  gain a quarter-rem double edge on four sides the instant the highlight
  arrived, growing the card and shifting the two answers under the player's
  thumb. The edge is therefore always drawn and only ever changes colour, and it
  is drawn outside the line the words already sat on, so marking the question a
  stop moves nothing on a screen nobody is scanning.
*/
.tn-screen__question {
  border: 0.25rem double transparent;
  border-radius: var(--tn-radius);
  margin-inline: -0.25rem;
  /* A switch user cannot scroll: leave room above when the highlight lands. */
  scroll-margin-block: 1rem;
}
.tn-screen__question[data-switch-highlight="true"] { border-color: var(--tn-focus); }

.tn-screen__group {
  background: var(--tn-paper-2);
  border: var(--tn-edge-width) solid var(--tn-edge-soft);
  border-radius: var(--tn-radius);
  /* Holds still at large text, so the options inside keep the line their words
     need (ADR-0045). */
  padding: calc(0.875rem / var(--tn-text-scale, 1));
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

/*
  High contrast: on is filled, off is an outline (ADR-0045).

  The theme made every control a black slab and the chosen one white, so a
  switch read backwards: Off solid, On an empty outline. A switch and a radio
  that are not chosen are paper with an ink edge; a chosen one is solid ink with
  paper words. The word and the switch track below still say it without colour.
*/
[data-tn-contrast="high"] .tn-screen [role="switch"],
[data-tn-contrast="high"] .tn-screen [role="radio"] {
  background: var(--tn-paper);
  color: var(--tn-ink);
  border-color: var(--tn-ink);
  box-shadow: 0 var(--tn-lift) 0 var(--tn-ink);
}
[data-tn-contrast="high"] .tn-screen [aria-checked="true"],
[data-tn-contrast="high"] .tn-screen [aria-pressed="true"] {
  background: var(--tn-ink);
  color: var(--tn-paper);
  border-color: var(--tn-ink);
  box-shadow: 0 var(--tn-lift) 0 var(--tn-ink);
}
[data-tn-contrast="high"] .tn-screen [aria-checked="true"] .tn-creator__swatch {
  border-color: var(--tn-paper);
}

/*
  The focus ring on a chosen control.

  The rules above come after the focus rule and replace its halo and its double
  edge, so a focused chosen option drew a brass-light ring straight onto a brass
  fill and the ring disappeared. This puts the dark halo back between the two.
*/
.tn-screen [role="switch"]:focus-visible,
.tn-screen [role="radio"]:focus-visible,
.tn-screen [aria-pressed]:focus-visible,
.tn-screen [role="switch"][data-switch-highlight="true"],
.tn-screen [role="radio"][data-switch-highlight="true"],
.tn-screen [aria-pressed][data-switch-highlight="true"] {
  box-shadow: 0 0 0 0.5rem var(--tn-focus-halo);
  border-style: double;
  border-width: 0.25rem;
}

/*
  A switch's track: the knob at the start and an outline when off, at the end on
  a filled track when on. A shape beside the word On or Off, so the state does
  not rest on colour. Drawn with borders, which forced colours keep, and sized to
  hold still at large text like every other picture.
*/
.tn-switch {
  box-sizing: border-box;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  inline-size: calc(3rem / var(--tn-text-scale, 1));
  block-size: calc(1.75rem / var(--tn-text-scale, 1));
  padding: calc(0.1875rem / var(--tn-text-scale, 1));
  border: calc(0.1875rem / var(--tn-text-scale, 1)) solid currentColor;
  border-radius: var(--tn-radius-pill);
}
.tn-switch__knob {
  box-sizing: border-box;
  display: block;
  inline-size: calc(1rem / var(--tn-text-scale, 1));
  block-size: calc(1rem / var(--tn-text-scale, 1));
  border: calc(0.5rem / var(--tn-text-scale, 1)) solid currentColor;
  border-radius: var(--tn-radius-pill);
}
[aria-checked="true"] > .tn-switch {
  justify-content: flex-end;
  background: currentColor;
}
[aria-checked="true"] > .tn-switch > .tn-switch__knob { border-color: var(--tn-accent); }
[data-tn-contrast="high"] [aria-checked="true"] > .tn-switch > .tn-switch__knob {
  border-color: var(--tn-ink);
}

@media (forced-colors: active) {
  .tn-switch,
  .tn-switch__knob {
    forced-color-adjust: none;
    border-color: ButtonText;
  }
  [aria-checked="true"] > .tn-switch { background: ButtonText; }
  [aria-checked="true"] > .tn-switch > .tn-switch__knob { border-color: ButtonFace; }
  .tn-screen [aria-pressed="true"] { border-width: 0.25rem; }
}

/*
  A switch reads label, track, state: "Less movement", the track, "Off".

  The label's basis is 10em, so it grows with the text. At 100 % the three share
  one line. At large text the label takes a line of its own, where its longest
  word fits whole, and the track and its word sit together at the end of the
  line below. A basis that held still squeezed the label beside the track until
  "mouvement" and "Déplacement" split inside the word.
*/
/*
  A plain label -- Settings' switches -- and NOT the two-line column below.

  :not(.tn-switch__words) is the difference between a rule and a dead letter:
  this selector carries four classes and that one carries one, so it won the
  cascade over .tn-switch__words wherever both matched, and the smaller basis
  written there did nothing at all.
*/
.tn-screen [role="switch"] > span:not(.tn-switch):not(.tn-screen__state):not(.tn-switch__words) {
  flex: 1 1 10em;
  min-inline-size: 0;
}
.tn-screen [role="switch"] > .tn-switch { margin-inline-start: auto; }
.tn-screen [role="switch"] > .tn-switch + .tn-screen__state { margin-inline-start: 0; }

/*
  A switch's words: its label, and under it the value it would apply.

  Its basis is SMALLER than a plain switch label's 10em, and that is the third
  live-site audit's French exam intro. « Utiliser le chronomètre » with
  « 30 minutes » under it asked for 10em of a 286 px row, which left no room for
  the track and « Désactivé » beside it, so the state word dropped to a third
  line under the switch while English kept "Off" on the row. At 6em the label
  wraps inside its own column -- where a long word has a whole line to itself --
  and the track and the state word stay together at the end of the first line in
  both languages. It still grows into whatever the row does not need, so English
  is drawn exactly as it was.
*/
.tn-switch__words {
  display: flex;
  flex-direction: column;
  flex: 1 1 6em;
  min-inline-size: 0;
}
.tn-switch__value { font-weight: 600; }

/* ------------------------------------------------------------------ *
 * The question card (ADR-0045).
 *
 * The place the question belongs to, then the counter and the tag on one line
 * when they fit, then the question. The sheet hugs these, so nothing is left
 * blank under the options before the player answers.
 * ------------------------------------------------------------------ */
.tn-question .tn-screen__card { gap: 0.75rem; }
.tn-question__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 0.75rem;
  row-gap: 0.125rem;
}
.tn-question__head > h1 { font-size: 1.375rem; }
.tn-question__place {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--tn-ink-muted);
}
.tn-question__place-gap { padding-inline: 0.375rem; }

/* ------------------------------------------------------------------ *
 * The exam's two steps side by side, and a control that cannot be taken.
 *
 * Previous and Next share a row while both words fit, and stack at large text.
 * A disabled action (Previous on question 1, Next on the last) is a dashed paper
 * outline with no lift, so it does not look like the slab beside it; its words
 * stay ink, and aria-disabled says the same thing to a screen reader.
 * ------------------------------------------------------------------ */
.tn-exam__step {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.tn-exam__step > button {
  flex: 1 1 8rem;
  inline-size: auto;
}
.tn-screen__actions button[aria-disabled="true"] {
  background: var(--tn-paper-3);
  color: var(--tn-ink);
  border-color: var(--tn-edge-soft);
  border-style: dashed;
  box-shadow: none;
  cursor: default;
}
@media (forced-colors: active) {
  .tn-screen__actions button[aria-disabled="true"] { border: 0.125rem dashed ButtonText; }
}

/* ------------------------------------------------------------------ *
 * The text size: its name and its value on one line, over a slider whose thumb
 * is big enough to see and to take hold of.
 * ------------------------------------------------------------------ */
.tn-settings__size-head {
  display: flex;
  align-items: baseline;
  column-gap: 0.75rem;
}
/* The name wraps inside its own box at large text, so the value keeps its place
   on the name's first line instead of dropping under it. */
.tn-settings__size-head > label {
  flex: 1 1 0%;
  min-inline-size: 0;
  font-weight: 800;
}
.tn-settings__size-head > .tn-screen__state { flex: 0 0 auto; }

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

/*
  The indent, taken back. .tn-screen ul (one class, one element) outranks
  .tn-screen__options (one class), so every option list -- exam answers,
  question cards, the map, the passport -- kept the 1.25rem list indent and sat
  further in than its own heading: 20 px at 100 % and 40 px at 200 %, taken from
  cards that had none to spare. Only the indent: the gap is left as it was drawn.
*/
.tn-screen ul.tn-screen__options { padding-inline-start: 0; }

/*
  An option's words share the first line with its mark, and wrap beside it.

  With a basis of auto the words were one flex item as wide as their whole
  sentence, so any answer longer than the line left the radio dot or the tick
  alone on a line above its own words. A basis of 0 keeps them beside the mark
  and lets them grow into the rest of the line. The state word -- "Your answer",
  "Correct answer" -- takes a line of its own under them, at the end, so it never
  squeezes the answer it describes.

  The cost, taken knowingly: choosing an exam answer adds that line, so the
  options below it move down by one line. It did before for any answer longer
  than half a line, which is most of them; a word sharing the answer's line
  instead would squeeze a 200 % answer to a word per line, which is the defect
  this rule removes. Keyboard and switch players move by focus, not position.
*/
.tn-screen__options > li > button > span:not(.tn-screen__mark):not(.tn-screen__state) {
  flex: 1 1 0%;
  min-inline-size: 0;
}
.tn-screen__options > li > button > .tn-screen__state {
  flex: 1 0 100%;
  margin-inline-start: 0;
  text-align: end;
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
  margin: 0;
  accent-color: var(--tn-action);
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
}
.tn-screen input[type="range"]::-webkit-slider-runnable-track {
  box-sizing: border-box;
  block-size: 0.75rem;
  border: var(--tn-edge-width) solid var(--tn-ink);
  border-radius: var(--tn-radius-pill);
  background: var(--tn-paper-3);
}
.tn-screen input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  box-sizing: border-box;
  inline-size: 2rem;
  block-size: 2rem;
  margin-block-start: calc((0.75rem - 2 * var(--tn-edge-width) - 2rem) / 2);
  border: 0.25rem solid var(--tn-paper);
  border-radius: var(--tn-radius-pill);
  background: var(--tn-action);
  box-shadow: 0 0 0 var(--tn-edge-width) var(--tn-ink);
}
.tn-screen input[type="range"]::-moz-range-track {
  box-sizing: border-box;
  block-size: 0.75rem;
  border: var(--tn-edge-width) solid var(--tn-ink);
  border-radius: var(--tn-radius-pill);
  background: var(--tn-paper-3);
}
.tn-screen input[type="range"]::-moz-range-thumb {
  box-sizing: border-box;
  inline-size: 2rem;
  block-size: 2rem;
  border: 0.25rem solid var(--tn-paper);
  border-radius: var(--tn-radius-pill);
  background: var(--tn-action);
  box-shadow: 0 0 0 var(--tn-edge-width) var(--tn-ink);
}
@media (forced-colors: active) {
  .tn-screen input[type="range"] { forced-color-adjust: none; }
  .tn-screen input[type="range"]::-webkit-slider-runnable-track {
    border-color: CanvasText;
    background: Canvas;
  }
  .tn-screen input[type="range"]::-webkit-slider-thumb {
    border-color: Canvas;
    background: CanvasText;
    box-shadow: 0 0 0 var(--tn-edge-width) CanvasText;
  }
}

.tn-screen__preview {
  border: var(--tn-edge-width) solid var(--tn-edge-soft);
  border-radius: var(--tn-radius);
  padding: 0.875rem;
  background: var(--tn-paper-2);
  color: var(--tn-ink);
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

/* ------------------------------------------------------------------ *
 * The character creator's picture (ADR-0040).
 *
 * A panel holding a picture has three parts: the heading, the picture and the
 * sentence. Where the sheet is wide enough for the words to sit beside the
 * picture -- 17.5em of the sheet's own font, which is 100 % text at phone width
 * and not 125 % -- the picture takes the start edge and the heading and the
 * sentence stack beside it. Narrower, or at larger text, the three stack, so
 * the words never wrap a letter at a time to make room for decoration.
 *
 * The picture is sized in px on purpose. Text scaling makes words larger; a
 * picture that grew with them would push every option further from the thumb
 * and show nothing more.
 *
 * At 100 % text the panel is sticky, so a player choosing a hair colour at the
 * bottom of the list still sees the face it goes on. Only at 100 %: at larger
 * text the sentence alone is a third of the screen, and a sticky panel that tall
 * would cover the options it exists to show. scroll-padding keeps a focused or
 * highlighted control out from under it.
 *
 * A picture that failed is hidden and data-art says so, and the panel is the
 * plain preview again: not sticky, not a grid, no empty box.
 * ------------------------------------------------------------------ */
.tn-creator .tn-screen__card { container: tn-creator / inline-size; }

.tn-creator__preview[data-art="loading"],
.tn-creator__preview[data-art="ready"] {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas: "heading" "art" "text";
  row-gap: 0.5rem;
}
.tn-creator__preview[data-art] > h2 { grid-area: heading; }
.tn-creator__preview[data-art] > p { grid-area: text; }

/*
  The whole figure, crown to boots (ADR-0040, amended twice): tall and narrow
  like the figure, so the head is drawn at about the size the old thigh crop drew
  it and the words beside it keep their width.

  IT GROWS WITH THE TEXT, unlike every other picture in this sheet. The third
  live-site audit found the creator at 200 % text with every word twice its size
  and this picture still 100 x 240 px — a thumbnail for the player who asked for
  large type, which is the player least able to read it. The rest of the game's
  pictures are decoration beside words that say the same thing; this one is the
  *answer* to "what will I look like", and nothing else on the screen shows it.
  So it is 6.25rem — 100 px at 100 %, 200 px at 200 % — capped at two fifths of
  the window so it can never take the screen from the options, with one length
  and a ratio rather than two lengths, so the figure cannot be stretched.
*/
.tn-creator__art {
  grid-area: art;
  box-sizing: border-box;
  inline-size: min(6.25rem, 40vw);
  aspect-ratio: 5 / 12;
  block-size: auto;
  border: var(--tn-edge-width) solid var(--tn-edge-soft);
  border-radius: 0.75rem;
  background: var(--tn-paper);
  overflow: hidden;
  /* The figure's ground stays light in a forced-colours theme; the words beside
     it are what carry the choice, and they do follow the theme. */
  forced-color-adjust: none;
}
.tn-creator__art canvas { display: block; inline-size: 100%; block-size: 100%; }

@container tn-creator (min-width: 17.5em) {
  .tn-creator__preview[data-art="loading"],
  .tn-creator__preview[data-art="ready"] {
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: auto 1fr;
    grid-template-areas: "art heading" "art text";
    column-gap: 0.875rem;
    align-items: start;
  }
}

:root[data-tn-text-scale="100"] .tn-creator__preview[data-art="loading"],
:root[data-tn-text-scale="100"] .tn-creator__preview[data-art="ready"] {
  position: sticky;
  /* Measured inside the screen's 1.25rem top padding, so this puts the panel
     0.5rem from the top edge, and the paper ring below covers that 0.5rem. */
  top: -0.75rem;
  z-index: 2;
  /* Paper round the panel, so an option scrolling under it never shows at its
     rounded corners. */
  box-shadow: 0 0 0 0.5rem var(--tn-paper);
}
:root[data-tn-text-scale="100"] .tn-creator:has(.tn-creator__preview[data-art="loading"]),
:root[data-tn-text-scale="100"] .tn-creator:has(.tn-creator__preview[data-art="ready"]) {
  /* Below the stuck panel: 0.5rem from the top, the 240 px picture, the panel's
     own padding and edge, and the paper ring round it. */
  scroll-padding-block-start: 19.5rem;
}

@media (forced-colors: active) {
  .tn-creator__art { border-color: CanvasText; }
}

/* ------------------------------------------------------------------ *
 * The character creator's skin tones: a swatch above each name.
 *
 * The colour arrives on the element as --tn-swatch, set by
 * app/ui/character-creator.ts from assets/style/palette.json through the
 * composition root, so no colour is written here. The swatch is decoration
 * beside the name ("1, light"): the name is what a screen reader reads and what
 * tells six tones apart when the colour is gone.
 *
 * The grid fills a row at a time, left to right, so the reading order is the
 * ramp's order, lightest first, at every width; at 200 % text min() drops it to
 * one column instead of pushing a name past the edge.
 * ------------------------------------------------------------------ */
.tn-creator__help { display: block; }

.tn-creator__swatches {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 6.5rem), 1fr));
  gap: 0.625rem;
}

.tn-creator__swatch {
  /* A line of its own inside the option, with the mark and the name under it. */
  flex: 1 0 100%;
  box-sizing: border-box;
  min-block-size: 2.75rem;
  border: var(--tn-edge-width) solid var(--tn-ink);
  border-radius: 0.5rem;
  background: var(--tn-swatch);
  /* The one fill a forced-colours theme must not flatten: it is the colour the
     player is choosing. The ink edge keeps the chip visible on paper and on the
     chosen brass alike, and the focus ring sits outside the option, so it never
     depends on contrast against the swatch (TN-SKIN-06). */
  forced-color-adjust: none;
}

/* A basis of 0, for the reason option words have one above: "3, medium" wrapped
   under its radio dot instead of beside it. */
.tn-creator__name { flex: 1 1 0%; min-inline-size: 0; }

/* A swatch option is a narrow grid cell, half a phone wide: a slimmer gap after
   the dot and side padding that holds still at large text leave "3, medium" /
   « 3, moyen » the one line the other four names already get. */
.tn-creator__swatches [role="radio"] {
  column-gap: 0.5rem;
  padding-inline: calc(0.75rem / var(--tn-text-scale, 1));
}

@media (forced-colors: active) {
  .tn-creator__swatch { border-color: CanvasText; }
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
 * "About this place": the territorial statement panel.
 *
 * docs/content-review.md 10.2. Two things here are acceptance criteria.
 *
 *  1. The statement is the first line and reads as the first line. It is set
 *     one step up from body text, with a leading brass rule, so that a sighted
 *     reader's eye lands where a screen-reader user's ear does -- the heading,
 *     then the fact. The rule is a border on the paragraph's own box, never a
 *     pseudo-element, for the contrast reason the sheet's brass rule records.
 *  2. The source is a link, and a link is a touch target. 3rem min-block-size
 *     is 48 px at 100 % and 96 at 200 %, the same arithmetic every control in
 *     this sheet uses, and the underline stays: removing it would leave colour
 *     as the only thing saying this is a link, which CLAUDE.md forbids and
 *     which forced-colours mode would take away anyway.
 * ------------------------------------------------------------------ */

.tn-about__body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tn-about__statement {
  font-size: 1.1875rem;
  line-height: 1.55;
  border-inline-start: 0.375rem solid var(--tn-accent);
  padding-inline-start: 0.875rem;
}

.tn-about__source { margin: 0; }

.tn-about a {
  display: inline-flex;
  align-items: center;
  min-block-size: 3rem;
  padding-block: 0.5rem;
  color: var(--tn-ink);
  /* Never colour alone. */
  text-decoration: underline;
  text-decoration-thickness: 0.125rem;
  text-underline-offset: 0.25rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

@media (forced-colors: active) {
  .tn-about__statement { border-inline-start-color: CanvasText; }
  .tn-about a { color: LinkText; }
}

/* ------------------------------------------------------------------ *
 * Screens with art (ADR-0041).
 *
 * The live-site audit found the landmark card, the dialogue, the completion
 * card, the Study home and the title screen to be huge text-only sheets, most of
 * them blank. Two changes answer it, and neither weakens a rule above.
 *
 *  1. A SHEET OVER THE LEVEL. The three cards a level opens are sheets that
 *     hug their content at the foot of the screen, and the level stays in view
 *     above them. The modal root keeps its role, its trap and its size -- a tap
 *     above the sheet still lands on the dialog, not on the game -- and only
 *     its fill goes: it paints nothing, so the sheet is the only surface, and
 *     the sheet is still opaque paper, so every word on it has a background axe
 *     can compute. The level is dimmed by darkening the canvas itself with a
 *     brightness filter -- a change to the picture, not a translucent wash laid
 *     over it -- and the canvas carries no text and is aria-hidden.
 *  2. PICTURES THAT ARE DECORATION. Every picture is an aria-hidden frame
 *     holding an image with an empty alt (app/ui/screen-art.ts). Pictures are
 *     sized in rem divided by the text scale: the same CSS px at every scale,
 *     so text scaling grows the words and not the decoration (ADR-0040 made the
 *     same choice for the creator's picture). Nothing here animates except the
 *     stamp being pressed, and reduced motion removes that with every other
 *     animation below.
 * ------------------------------------------------------------------ */

.tn-screen--sheet { background: transparent; }
/*
  A sheet, and a screen that hugs its content (ADR-0045).

  tn-screen--hug is the same sheet at the foot of the screen with the night kept
  behind it, for a surface over something that is not the level: the exam's menu
  over the exam, a Study question over the Study home. Either way the actions sit
  directly under the words, so no screen draws a column of white between its
  heading and its buttons.
*/
.tn-screen--sheet > .tn-screen__card,
.tn-screen--hug > .tn-screen__card {
  flex: 0 0 auto;
  margin-block-start: auto;
}
.tn-screen--sheet .tn-screen__actions,
.tn-screen--hug .tn-screen__actions { margin-block-start: 0; }

body:has(.tn-screen--sheet:not([hidden])) #game { filter: brightness(0.55); }

/* The landmark's own picture, heading the landmark card. */
.tn-card-art {
  box-sizing: border-box;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  block-size: calc(10.5rem / var(--tn-text-scale, 1));
  padding: calc(0.625rem / var(--tn-text-scale, 1));
  border: var(--tn-edge-width) solid var(--tn-ink);
  border-radius: var(--tn-radius);
  background: var(--tn-paper-2);
  overflow: hidden;
}
.tn-card-art-image {
  display: block;
  max-inline-size: 100%;
  max-block-size: 100%;
  object-fit: contain;
  object-position: center bottom;
}

/* Who is speaking: a round portrait beside the speaker's name. */
.tn-dialogue__head {
  display: flex;
  align-items: center;
  gap: calc(0.875rem / var(--tn-text-scale, 1));
}
.tn-dialogue__head > h1 { flex: 1 1 0%; min-inline-size: 0; }
.tn-dialogue__portrait {
  box-sizing: border-box;
  flex: 0 0 auto;
  inline-size: calc(5rem / var(--tn-text-scale, 1));
  block-size: calc(5rem / var(--tn-text-scale, 1));
  padding: calc(0.25rem / var(--tn-text-scale, 1));
  border: var(--tn-edge-width) solid var(--tn-ink);
  border-radius: var(--tn-radius-pill);
  background: var(--tn-paper-2);
  overflow: hidden;
}
.tn-dialogue__portrait-image {
  display: block;
  inline-size: 100%;
  block-size: 100%;
  object-fit: contain;
}

/*
  The level's stamp, pressed beside the completion card's heading: a double ring
  and the landmark's silhouette in stamp ink. The silhouette is the landmark's
  own picture used as a mask over one flat fill. Earned is solid ink; not yet
  earned is a dashed outline in a quieter ink, so the two differ in shape and
  not only in colour.
*/
.tn-complete__head {
  display: flex;
  align-items: center;
  gap: calc(0.75rem / var(--tn-text-scale, 1));
}
.tn-complete__head > h1 { flex: 1 1 0%; min-inline-size: 0; }
.tn-stamp {
  flex: 0 0 auto;
  inline-size: calc(6rem / var(--tn-text-scale, 1));
  block-size: calc(6rem / var(--tn-text-scale, 1));
  transform: rotate(-8deg);
  animation: tn-stamp-press 240ms ease-out;
}
@keyframes tn-stamp-press {
  from { transform: rotate(-8deg) scale(1.35); }
  to { transform: rotate(-8deg) scale(1); }
}
.tn-stamp__ring {
  box-sizing: border-box;
  display: flex;
  inline-size: 100%;
  block-size: 100%;
  padding: calc(0.625rem / var(--tn-text-scale, 1));
  border: calc(0.375rem / var(--tn-text-scale, 1)) double var(--tn-primary);
  border-radius: var(--tn-radius-pill);
  background: var(--tn-paper);
}
.tn-stamp__mark {
  display: block;
  flex: 1 1 auto;
  background: var(--tn-primary);
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
}
.tn-stamp:not([data-state="ready"]) .tn-stamp__mark { background: transparent; }
.tn-stamp[data-inked="false"] { animation: none; }
.tn-stamp[data-inked="false"] .tn-stamp__ring {
  border: calc(0.1875rem / var(--tn-text-scale, 1)) dashed var(--tn-edge-soft);
}
.tn-stamp[data-inked="false"][data-state="ready"] .tn-stamp__mark { background: var(--tn-edge-soft); }

@media (forced-colors: active) {
  .tn-card-art,
  .tn-dialogue__portrait { border-color: CanvasText; }
  .tn-stamp__ring { border-color: CanvasText; }
  .tn-stamp[data-state="ready"] .tn-stamp__mark {
    forced-color-adjust: none;
    background: CanvasText;
  }
}

/*
  The landscape the title screen and the Study home stand on. It takes the
  space the words do not need, and never less than enough to read as a picture.
*/
.tn-title__art,
.tn-study__art {
  position: relative;
  box-sizing: border-box;
  flex: 1 1 auto;
  border: var(--tn-edge-width) solid var(--tn-ink);
  border-radius: var(--tn-radius);
  background: var(--tn-paper-2);
  overflow: hidden;
}
/* Small enough that a returning player's five ways in and the disclaimer still
   fit a 390 x 844 phone at 100 % text with the picture on it; it grows into
   whatever else is free. */
.tn-title__art { min-block-size: calc(8rem / var(--tn-text-scale, 1)); }
.tn-study__art {
  min-block-size: calc(9rem / var(--tn-text-scale, 1));
  max-block-size: calc(28rem / var(--tn-text-scale, 1));
}
.tn-title__landscape,
.tn-title__figure {
  position: absolute;
  inset: 0;
}
.tn-title__landscape-image,
.tn-study__art-image {
  position: absolute;
  inset: 0;
  display: block;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
  object-position: center 80%;
}
.tn-title__figure {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-block-end: calc(0.5rem / var(--tn-text-scale, 1));
}
.tn-title__figure-image {
  display: block;
  block-size: 80%;
  max-inline-size: 70%;
  object-fit: contain;
  object-position: center bottom;
}

@media (forced-colors: active) {
  .tn-title__art,
  .tn-study__art { border-color: CanvasText; }
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
  /* The sheet's own gutter, so the warning and the sheet under it line up. */
  padding-inline: calc(1.125rem / var(--tn-text-scale, 1));
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
 * The journey: one route, ten stops, drawn down the left of a list.
 *
 * The level select and the passport share this block. It is the difference
 * between ten options in a column and ten places on one road, and it is the
 * answer OQ-MAP-2 gave -- "a vertical list of cards on a painted backdrop that
 * suggests the journey" -- minus the painting, which is art and not CSS.
 *
 * THREE THINGS HERE ARE ACCEPTANCE CRITERIA, NOT DECORATION:
 *
 *  1. NOTHING ON THE RAIL IS INFORMATION. Every leg, pin and ring is a function
 *     of two words the card beside it already prints -- its state and whether
 *     its stamp is earned. app/ui/journey.ts computes them and hides the whole
 *     rail from assistive technology, which is only honest because a player who
 *     cannot see it loses nothing. Add a fact here and that stops being true.
 *  2. EVERY LENGTH IS IN rem, so the rail and its pins grow with the text. The
 *     gutter and its gap come to 1.25rem: 20 px at 100 % and 40 px at 200 %,
 *     out of 390, and the card beside it keeps min-inline-size: 0 so it wraps
 *     rather than pushing the page sideways. That width is the whole budget the
 *     route is allowed, and it was measured down to it rather than guessed: at
 *     200 % text the Ottawa card is 226 px wide with the rail and 266 px without.
 *     At 1.625rem it was 214 px, and four place names wrapped one line more
 *     than they do with no rail at all; at 1.25rem only Winnipeg, The North and
 *     the Alberta foothills do, and every one is still wholly visible. Widen the
 *     gutter and that is the cost to re-measure.
 *  3. TRAVELLED AND AHEAD DIFFER BY BORDER STYLE, not by colour -- solid for a
 *     leg the player has walked, dotted for one they have not -- which is the
 *     same vocabulary the cards themselves use for their three states, and it
 *     survives greyscale and forced colours.
 *
 * There is no animation in this block at all, so reduced motion has nothing to
 * remove here. The rail is read beside the words, and it stays still. The map
 * above the list is where the route draws itself in, and that block says how
 * reduced motion takes it away.
 * ------------------------------------------------------------------ */

.tn-journey {
  flex: 0 0 auto;
  box-sizing: border-box;
  inline-size: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* The rail is as tall as the row beside it, so the leg below one stop ends
     exactly where the leg above the next one begins. */
  align-self: stretch;
}

/*
  A leg of the route. A border rather than a background, because a border can be
  dotted and a background cannot, and the difference between travelled and ahead
  has to be a shape.
*/
.tn-journey__leg {
  inline-size: 0;
  flex: 0 0 auto;
  border-inline-start: 0.1875rem solid var(--tn-ink);
}

/*
  The leg below a stop grows to fill the row and never shrinks below its basis,
  so a short card still shows a length of road under it. flex-basis rather
  than min-block-size: every minimum size in this sheet is a touch target, a
  test asserts none of them is under 2.75rem, and a decorative 12 px line would
  have had to either break that rule or weaken it.
*/
.tn-journey__leg--before { block-size: 0.9rem; }
.tn-journey__leg--after { flex: 1 0 0.75rem; }

.tn-journey[data-journey-before="ahead"] .tn-journey__leg--before,
.tn-journey[data-journey-after="ahead"] .tn-journey__leg--after {
  border-inline-start-style: dotted;
}

/* The ends of the line: the first stop has nothing above it and the last has
   nothing below it. Hidden rather than removed, so no row changes height. */
.tn-journey[data-journey-before="none"] .tn-journey__leg--before,
.tn-journey[data-journey-after="none"] .tn-journey__leg--after {
  visibility: hidden;
}

/*
  The stop. Round on the map -- a place on a route -- and the three card states
  are the three border styles the cards themselves use, so the rail repeats the
  card's own shape vocabulary rather than introducing a second one.
*/
.tn-journey__pin {
  box-sizing: border-box;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  inline-size: 0.875rem;
  block-size: 0.875rem;
  font-size: 0.625rem;
  font-weight: 800;
  line-height: 1;
  border: 0.1563rem solid var(--tn-ink);
  border-radius: var(--tn-radius-pill);
  background: var(--tn-paper);
}

/* .tn-map__stop is a pin on the map above the list. It is matched by these same
   rules rather than given its own, so the map cannot drift into a second shape
   language: see the map block below. */
.tn-journey[data-journey-state="locked"] .tn-journey__pin,
.tn-map__stop[data-journey-state="locked"] .tn-journey__pin { border-style: dashed; }
.tn-journey[data-journey-state="not-earned"] .tn-journey__pin { border-style: dashed; }
.tn-journey[data-journey-state="not-built"] .tn-journey__pin,
.tn-map__stop[data-journey-state="not-built"] .tn-journey__pin { border-style: dotted; }

/* A place the player has been: the stamp is earned, and the card says so in the
   word "Earned" right beside this. */
.tn-journey[data-journey-reached="true"] .tn-journey__pin,
.tn-map__stop[data-journey-reached="true"] .tn-journey__pin {
  background: var(--tn-accent);
  border-color: var(--tn-accent-edge);
  border-style: solid;
  color: var(--tn-accent-ink);
}

/*
  Where the player is: bigger, with a ring round it. It still states nothing
  new -- it sits beside the one card that says "You are here". The ring is a
  box-shadow, which forced colours drops; the size difference is not, so the
  mark survives with no colour at all.
*/
.tn-journey[data-journey-current="true"] .tn-journey__pin,
.tn-map__stop[data-journey-current="true"] .tn-journey__pin {
  inline-size: 1rem;
  block-size: 1rem;
  box-shadow: 0 0 0 0.125rem var(--tn-paper), 0 0 0 0.1875rem var(--tn-ink);
}

/* A heavier edge on the road, and not on the stamp: at this size a 0.25rem
   border on a 1rem square closes the gaps in a dashed one, and "not earned yet"
   would stop being told apart by its shape. A pin on the map is a stop on the
   road, so it takes the road's edge. */
.tn-journey[data-journey="stop"][data-journey-current="true"] .tn-journey__pin,
.tn-map__stop[data-journey-current="true"] .tn-journey__pin {
  border-width: 0.25rem;
}

/*
  The passport's mark is a stamp pressed into a page, not a place on a road: a
  rounded square, set a few degrees off square the way a hand-held stamp lands.
  A static rotation and not an animation -- there is nothing here for reduced
  motion to take away.
*/
.tn-journey[data-journey="stamp"] .tn-journey__pin {
  inline-size: 0.9375rem;
  block-size: 0.9375rem;
  border-radius: 0.25rem;
  transform: rotate(-6deg);
}

.tn-journey[data-journey="stamp"][data-journey-current="true"] .tn-journey__pin {
  inline-size: 1rem;
  block-size: 1rem;
}

/* OQ-PASSPORT-4: no square at all where nobody has built the level. An empty
   outline reads as a slot the player could fill, which is true of an unearned
   slot and false of a place that is not in this game. The space stays so the
   route runs straight past it. */
.tn-journey[data-journey="stamp"][data-journey-state="not-built"] .tn-journey__pin {
  visibility: hidden;
}

@media (forced-colors: active) {
  .tn-journey__leg { border-inline-start-color: CanvasText; }
  .tn-journey__pin { border-color: CanvasText; }
  .tn-journey[data-journey-reached="true"] .tn-journey__pin,
  .tn-map__stop[data-journey-reached="true"] .tn-journey__pin { background: Highlight; }
}

/* ------------------------------------------------------------------ *
 * The map above the route: the country, and where the journey is on it.
 *
 * app/ui/level-map.ts draws it: the drawing from assets/src/svg/screens/, a pin
 * at each stop's anchor, and a line through the stops the player has travelled.
 * Its pins are the rail's pins -- every shape and fill above matches
 * .tn-map__stop as well as .tn-journey -- so this block says where a pin goes,
 * how big it is, how the line is drawn and how both move.
 *
 * FOUR THINGS HERE ARE ACCEPTANCE CRITERIA, NOT DECORATION:
 *
 *  1. IT TAKES NO INPUT. pointer-events: none on the whole map, so a tap or a
 *     held switch contact over the drawing lands on the sheet behind it like
 *     anywhere else on the screen, and a long press cannot open an image menu or
 *     start a drag. It is aria-hidden and holds nothing focusable: the list is
 *     the control.
 *  2. IT SITS ABOVE THE LIST, NEVER BESIDE IT, so it costs a card no width at any
 *     text size. Its height follows the column's width rather than the text, and
 *     it is capped at 54vh wide -- 30 % of the viewport's height, at the
 *     drawing's 1080:600 -- so on a wide window at 200 % text it cannot push the
 *     whole route below the fold. A phone's column is narrower than the cap.
 *  3. A PIN IS SIZED TO THE DRAWING, NOT TO THE TEXT. Every other length in this
 *     sheet is rem, so that it grows with the text. The drawing does not grow,
 *     and a pin that doubled at 200 % would cover Halifax and Peggy's Cove, which
 *     are 5 % of the drawing's width apart in the inset. So a pin is sized in cqi,
 *     a share of the map's own width, after a rem fallback for a browser without
 *     container units.
 *  4. MOTION IS AN ENTRANCE, AND IT ENDS. The line draws itself in along its
 *     own order in 1.2 s and the "you are here" pin then swells three times,
 *     1.2 s each: everything is still before five seconds have passed, which is
 *     WCAG 2.2.2's bound for motion that needs no pause control. Nothing counts,
 *     nothing changes colour or opacity (nothing flashes), and nothing loops.
 *  5. REDUCED MOTION REMOVES THE MOVEMENT AND KEEPS THE DRAWING. A leg's dash is
 *     set only inside its keyframes, and the pulse is a transform, so with the
 *     animations removed the line is simply drawn and the pin is simply bigger.
 *     The rules below take the animations away for the attribute and for the
 *     media query on their own, whether or not the map sits inside .tn-screen.
 * ------------------------------------------------------------------ */

.tn-map {
  position: relative;
  box-sizing: border-box;
  inline-size: 100%;
  max-inline-size: 54vh;
  max-inline-size: 54dvh;
  margin-inline: auto;
  container-type: inline-size;
  border: var(--tn-edge-width) solid var(--tn-ink);
  border-radius: var(--tn-radius);
  background: var(--tn-paper-2);
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.tn-map__art {
  display: block;
  inline-size: 100%;
  block-size: auto;
  border-radius: calc(var(--tn-radius) - var(--tn-edge-width));
}

/* Exactly the drawing's box, so a pin's percentages are the sidecar's. */
.tn-map__pins {
  position: absolute;
  inset: 0;
}

/* Geography does not mirror with the writing direction, so left and top, not
   the logical properties used everywhere else. */
.tn-map__stop {
  position: absolute;
  left: var(--tn-map-x);
  top: var(--tn-map-y);
  display: flex;
  transform: translate(-50%, -50%);
}

/*
  A pin carries its stop's number, the numeral on that stop's card ("Level 4"),
  so a sighted player can tell which dot is which place without the map saying
  a word (second live-site audit, st-L01-quest-map). The numeral is the same in
  both languages. It is sized to the drawing like the pin: 4.2 % of the map's
  width is as big as a pin gets before Toronto's and Ottawa's touch, 14.4 CSS px
  apart at 347 px. Ink on paper, or the badge's ink on brass for an earned stop.
*/
.tn-map .tn-map__stop .tn-journey__pin {
  inline-size: 0.875rem;
  block-size: 0.875rem;
  border-width: 0.125rem;
  font-size: 0.5625rem;
  inline-size: 4.2cqi;
  block-size: 4.2cqi;
  border-width: 0.5cqi;
  font-size: 2.5cqi;
  letter-spacing: -0.04em;
  color: var(--tn-ink);
}
/* The numeral is drawn from the pin's own data, never written into the map's
   markup: TN-MAP fixes that the map carries no words, and generated content is
   not in the document's text. The cards say "Level N" where a reader hears it. */
.tn-map .tn-map__stop .tn-journey__pin[data-map-number]::before {
  content: attr(data-map-number);
}
.tn-map .tn-map__stop[data-journey-reached="true"] .tn-journey__pin { color: var(--tn-accent-ink); }

/* Where the route has got to: bigger and ringed, as on the rail, in the same
   proportions, and drawn over a neighbour it touches. The size difference
   survives forced colours; the ring does not. */
.tn-map .tn-map__stop[data-journey-current="true"] { z-index: 1; }
.tn-map .tn-map__stop[data-journey-current="true"] .tn-journey__pin {
  inline-size: 1rem;
  block-size: 1rem;
  border-width: 0.1875rem;
  font-size: 0.625rem;
  box-shadow: 0 0 0 0.125rem var(--tn-paper), 0 0 0 0.1875rem var(--tn-ink);
  inline-size: 4.9cqi;
  block-size: 4.9cqi;
  border-width: 0.7cqi;
  font-size: 2.8cqi;
  box-shadow: 0 0 0 0.5cqi var(--tn-paper), 0 0 0 0.9cqi var(--tn-ink);
}

@media (forced-colors: active) {
  .tn-map .tn-map__stop .tn-journey__pin { color: CanvasText; }
  .tn-map .tn-map__stop[data-journey-reached="true"] .tn-journey__pin { color: HighlightText; }
}

/*
  The way the player came. One line per leg, over the drawing and under the
  pins, in the drawing's own viewBox units, so it keeps the drawing's
  proportions at any text size exactly as a pin does. Ink on a paper casing, so
  it reads over sea, land and the inset's frame alike. Every leg on it is
  travelled -- nothing ahead of the player is drawn -- so it has one style.
*/
.tn-map {
  --tn-route-draw: 1200ms;
}

.tn-map__route {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  overflow: visible;
}

.tn-map__route line {
  fill: none;
  stroke-linecap: round;
}

.tn-map__casing {
  stroke: var(--tn-paper);
  stroke-width: 13;
}

.tn-map__leg {
  stroke: var(--tn-ink);
  stroke-width: 6;
}

@keyframes tn-map-route-draw {
  from {
    stroke-dasharray: var(--tn-leg-length);
    stroke-dashoffset: var(--tn-leg-length);
  }
  to {
    stroke-dasharray: var(--tn-leg-length);
    stroke-dashoffset: 0;
  }
}

/* A transform only: the pin grows and settles, and its colour, border and fill
   never change, so nothing about it flashes. */
@keyframes tn-map-here-pulse {
  0%,
  100% { transform: scale(1); }
  50% { transform: scale(1.35); }
}

/* Each leg starts where the one before it ends and lasts its share of the line,
   so the line grows at one speed. backwards, not both: before its turn a leg is
   hidden, and after it the dash rule is gone and the leg is plainly drawn. */
.tn-map__route line {
  animation: tn-map-route-draw calc(var(--tn-route-draw) * var(--tn-leg-share)) linear
    calc(var(--tn-route-draw) * var(--tn-leg-start)) 1 backwards;
}

.tn-map .tn-map__stop[data-journey-current="true"] .tn-journey__pin {
  animation: tn-map-here-pulse 1200ms ease-in-out var(--tn-route-draw) 3;
}

[data-tn-motion="reduced"] .tn-map,
[data-tn-motion="reduced"] .tn-map * {
  animation: none !important;
  transition: none !important;
}

@media (prefers-reduced-motion: reduce) {
  .tn-map,
  .tn-map * {
    animation: none !important;
    transition: none !important;
  }
}

@media (forced-colors: active) {
  .tn-map { border-color: CanvasText; }
  .tn-map__leg { stroke: CanvasText; }
  .tn-map__casing { stroke: Canvas; }
}

/* ------------------------------------------------------------------ *
 * The level select: ten places, three states, and a stamp.
 * ------------------------------------------------------------------ */

.tn-levels {
  gap: 0.875rem;
}

/* A row is the route plus one stop on it, side by side. */
.tn-levels__item {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 0.25rem;
}

.tn-levels__stop {
  flex: 1 1 auto;
  min-inline-size: 0;
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
  /* The side padding holds still at large text (ADR-0039): at 200 % a card had
     about 170 px of line and drew "respon- / sabili- / tés". */
  padding: 1rem calc(1rem / var(--tn-text-scale, 1));
  background: var(--tn-paper-2);
  color: var(--tn-ink);
  border-color: var(--tn-ink);
  box-shadow: 0 var(--tn-lift) 0 var(--tn-edge-soft);
}
.tn-levels button:active { box-shadow: 0 0 0 var(--tn-edge-soft); }

/*
  The pills on a card -- the number, "Earned", "You are here" and the state word.

  Each keeps its own width and wraps only when it is wider than the whole line.
  They used to shrink to fit beside their neighbours (flex: 0 1 auto with no
  minimum), and with overflow-wrap: anywhere a pill has no minimum width at all,
  so at 200 % text "Vous êtes ici" and "Ouvert" wrapped a word or a syllable per
  line inside a pill radius, and read as round blobs. The radius is in em, so a
  pill that does wrap is a rounded label rather than a circle.
*/
.tn-levels__number,
.tn-levels__badge,
.tn-levels__here,
.tn-levels .tn-screen__state,
.tn-passport__number,
.tn-passport .tn-screen__state {
  box-sizing: border-box;
  flex: 0 0 auto;
  max-inline-size: 100%;
  overflow-wrap: anywhere;
}

/* The level's number, as a disc: the journey has an order and the card says so. */
.tn-levels__number {
  font-weight: 800;
  font-size: 0.875rem;
  padding: 0.25rem 0.625rem;
  border-radius: 1em;
  background: var(--tn-night);
  color: var(--tn-on-night);
}

.tn-levels__name {
  flex: 1 1 auto;
  min-inline-size: 0;
  font-size: 1.1875rem;
  font-weight: 800;
  overflow-wrap: anywhere;
}

/* The subject line takes a line of its own, so a card reads number and place,
   then what it teaches, and neither is squeezed at 200 % text. */
.tn-levels__subject {
  flex: 1 1 100%;
  min-inline-size: 0;
  color: var(--tn-ink-muted);
  font-size: 0.9375rem;
  font-weight: 600;
  overflow-wrap: break-word;
}

/* The stamp in the passport, said as a word on a brass badge. */
.tn-levels__badge {
  font-weight: 800;
  font-size: 0.8125rem;
  padding: 0.1875rem 0.625rem;
  border-radius: 1em;
  border: 0.125rem solid var(--tn-accent-edge);
  background: var(--tn-accent);
  color: var(--tn-accent-ink);
}

/*
  Where the player is, said as a word. The map's ringed pin and the rail's are
  both hidden from assistive technology, so this is the fact they draw, on the
  card a screen reader reads. Paper lettering on ink, the reverse of the state
  word beside it, but it is told apart by being a word and not by colour. In
  forced colours both pills lose their fills, so this one takes a double edge.
*/
.tn-levels__here {
  font-weight: 800;
  font-size: 0.8125rem;
  padding: 0.1875rem 0.625rem;
  border-radius: 1em;
  border: 0.125rem solid var(--tn-ink);
  background: var(--tn-ink);
  color: var(--tn-paper);
}

@media (forced-colors: active) {
  .tn-levels__here { border: 0.25rem double CanvasText; }
}

/*
  The state word is a status, not a control (second live-site audit,
  st-L01-quest-map). It was a paper pill with an ink edge, which is the shape of
  every quiet button in the game, so "Open" read as a second button inside the
  card. It is plain bold words now, after a small mark in the card's own shape
  vocabulary: a filled disc for open, a dashed ring for locked, a dotted ring for
  not made yet. The mark is borders round no text, so a screen reader hears the
  word alone and forced colours keep the shape.
*/
.tn-levels .tn-screen__state {
  display: inline-flex;
  align-items: center;
  gap: 0.375em;
  font-size: 0.875rem;
  padding-block: 0.1875rem;
  color: var(--tn-ink);
}
.tn-levels .tn-screen__state::before {
  content: "";
  box-sizing: border-box;
  flex: 0 0 auto;
  inline-size: 0.75em;
  block-size: 0.75em;
  border: 0.125rem solid currentColor;
  border-radius: 50%;
}
.tn-levels [data-state="open"] .tn-screen__state::before { background: currentColor; }
.tn-levels [data-state="locked"] .tn-screen__state::before { border-style: dashed; }
.tn-levels [data-state="not-built"] .tn-screen__state::before { border-style: dotted; }

@media (forced-colors: active) {
  .tn-levels .tn-screen__state { color: CanvasText; }
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
  /* 10 px at every scale: a signal, not a share of the line. */
  border-inline-start-width: calc(0.625rem / var(--tn-text-scale, 1));
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

/*
  A slot is the route plus the page the stamp is pressed into. The <li> is still
  the focusable, labelled, data-state element -- what a keyboard reaches and what
  a screen reader names did not move -- and the bordered box is now the child
  beside the rail, because a route that runs between the slots cannot be drawn
  inside one of them.
*/
.tn-passport__slot {
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 0.25rem;
}

.tn-passport__page {
  flex: 1 1 auto;
  min-inline-size: 0;
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
  padding: 0.875rem calc(1rem / var(--tn-text-scale, 1));
  border: var(--tn-edge-width) solid var(--tn-ink);
  border-radius: var(--tn-radius);
  background: var(--tn-paper-2);
}

/*
  The focus ring lands on the page rather than on the row, so it looks exactly
  as it did before the rail arrived: a ring round the slot, not round the slot
  and a length of road. The <li> keeps the focus -- only the drawing moved -- and
  the indicator is still an outline, a halo and a change of border geometry.
*/
.tn-passport__slot:focus-visible,
.tn-passport__slot[data-switch-highlight="true"] {
  outline: none;
  box-shadow: none;
  border-style: none;
}

.tn-passport__slot:focus-visible .tn-passport__page,
.tn-passport__slot[data-switch-highlight="true"] .tn-passport__page {
  outline: 0.25rem solid var(--tn-focus);
  outline-offset: 0.1875rem;
  box-shadow: 0 0 0 0.5rem var(--tn-focus-halo);
  border-style: double;
  border-width: 0.25rem;
}

.tn-passport__number {
  font-weight: 800;
  font-size: 0.875rem;
  padding: 0.25rem 0.625rem;
  border-radius: 1em;
  background: var(--tn-night);
  color: var(--tn-on-night);
}

/*
  The name shares the number's line while an 8rem column is left for it, and
  takes a line of its own when it is not -- 128 px at 100 % text, which every
  place name fits beside its number, and 256 px at 200 %, where none does. A
  basis of auto let short names share the line with the state word and long ones
  push it down, so rows were one line or two by the length of a place name.
*/
.tn-passport__name {
  flex: 1 1 8rem;
  min-inline-size: 0;
  font-size: 1.1875rem;
  font-weight: 800;
  overflow-wrap: anywhere;
}

/*
  The state word always starts a line of its own, so every slot is the same
  shape: number and place, then "Not earned yet" or "Earned". The break is an
  empty flex item a full line wide, ordered between the name and the state word;
  it has no background and no content, so axe's contrast check has nothing to
  give up on, and the order values keep the DOM order -- number, name, state,
  sentence -- which is also the order a screen reader reads.
*/
.tn-passport__page::before {
  content: "";
  flex: 0 0 100%;
  order: 1;
  block-size: 0;
}

.tn-passport .tn-screen__state {
  order: 2;
  margin-inline-start: 0;
  font-size: 0.875rem;
  padding: 0.1875rem 0.625rem;
  border-radius: 1em;
  border: 0.125rem solid var(--tn-ink);
  background: var(--tn-paper);
}

/* The sentence under a slot takes a line of its own, so the row above it is not
   squeezed at 200 % text. */
.tn-passport .tn-screen__help {
  order: 3;
  flex: 1 1 100%;
  min-inline-size: 0;
  overflow-wrap: anywhere;
}

/* The three states are on the <li>; the box they paint is its page. Same three
   shapes as before the rail arrived -- a solid edge, a dashed one, a dotted one
   -- one element further in. */
.tn-passport [data-state="earned"] .tn-passport__page {
  background: var(--tn-paper);
  border-inline-start-width: 0.625rem;
  border-inline-start-color: var(--tn-accent-edge);
}

.tn-passport [data-state="earned"] .tn-screen__state {
  border-color: var(--tn-accent-edge);
  background: var(--tn-accent);
  color: var(--tn-accent-ink);
}

.tn-passport [data-state="not-earned"] .tn-passport__page {
  border-style: dashed;
  background: var(--tn-paper-3);
}
.tn-passport [data-state="not-built"] .tn-passport__page {
  border-style: dotted;
  background: var(--tn-paper-3);
}

.tn-passport__empty-slot:empty { display: none; }

/*
  The stamp itself, on an earned page (ADR-0045): the completion card's stamp,
  smaller, pressed beside the word Earned. aria-hidden, like the card's, because
  the word says it. It is pressed once, on the completion card; here it is
  already on the page, so it does not animate.
*/
.tn-passport__stamp {
  order: 2;
  margin-inline-start: auto;
  inline-size: calc(3.5rem / var(--tn-text-scale, 1));
  block-size: calc(3.5rem / var(--tn-text-scale, 1));
  animation: none;
}
.tn-passport__stamp .tn-stamp__ring {
  padding: calc(0.375rem / var(--tn-text-scale, 1));
  border-width: calc(0.25rem / var(--tn-text-scale, 1));
}

@media (forced-colors: active) {
  .tn-passport__page { border: 0.125rem solid CanvasText; }
  .tn-passport [data-state="not-earned"] .tn-passport__page {
    border: 0.125rem dashed CanvasText;
  }
  .tn-passport [data-state="not-built"] .tn-passport__page {
    border: 0.125rem dotted CanvasText;
  }
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
 *  3. THE ACTION IS ALWAYS ON SCREEN (ADR-0039). The strip draws the prompt and
 *     Settings and Menu first, so they are the part of the scroll box that is
 *     visible; the mode, the task, the notice and the hint follow and scroll.
 *     At 200 % text a third of an 844 px viewport is 278 px, and the prompt
 *     plus one row of controls fit in it only because the space AROUND the text
 *     holds still: padding, gaps and the controls' minimum size are divided by
 *     the text scale, and Settings and Menu share one row rather than taking
 *     two. The words themselves still grow to 200 %.
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
  /*
    The strip is as wide as the playfield, never as wide as the window
    (ADR-0002, third live-site audit).

    On a 1440 px desktop the portrait canvas is a 506 px column in the middle of
    the page, and the strip spanned the whole window: Settings and Menu sat
    400 px from the game they belong to, and the mode label ran the width of the
    screen. The canvas is FIT at the design resolution, 1080 x 1920, so its
    width is its height times 9/16. The custom property --tn-canvas-height is
    the height the page measured for it (index.html); without one -- a test
    harness, a page that does not say -- the window's own height is the same
    arithmetic. On a portrait phone that is wider than the window, so min()
    gives the whole width back and nothing about a phone changes.

    (No backticks in this file's comments: the whole sheet is a template
    literal, and two of them here ended it in the middle of a rule.)

    The side panels beside it are the level's own sky and ground, which the
    engine paints (CLAUDE.md); this half is only about where the chrome stops.
  */
  inline-size: min(100%, calc(var(--tn-canvas-height, 100dvh) * 9 / 16));
  margin-inline: auto;
  max-block-size: 33vh;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  display: flex;
  flex-direction: column;
  /* Tighter than the sheets (ADR-0045): at 200 % text a third of a phone holds
     the offer, Settings and Menu and the task only if the space between them
     holds still and stays small. The words keep growing to 200 %. */
  gap: calc(0.25rem / var(--tn-text-scale, 1));
  /*
    The foot of the strip is as deep as its sides (third live-site audit).

    It was 6 px at every text size, and the mode label is the last line in the
    strip: "Walking" ended 6 px from the bottom of the window, which reads as a
    word cut off by the edge rather than as the foot of a panel — and on a phone
    with a home indicator the line sat under the hardware. 14 px is the gutter
    the sides already use, so the strip has one margin all the way round. It
    holds still at large text like the rest of the chrome (ADR-0039), so the
    words still grow to 200 % and the eight pixels are not taken from them.
  */
  padding:
    calc(0.375rem / var(--tn-text-scale, 1))
    max(calc(0.875rem / var(--tn-text-scale, 1)), env(safe-area-inset-right, 0px))
    max(calc(0.875rem / var(--tn-text-scale, 1)), env(safe-area-inset-bottom, 0px))
    max(calc(0.875rem / var(--tn-text-scale, 1)), env(safe-area-inset-left, 0px));
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  font-size: 1rem;
  line-height: 1.2;
  color: var(--tn-on-night);
  /* Opaque, not a wash over the canvas: text on a translucent panel over a
     gradient has no computable contrast, and axe reports "incomplete" rather
     than a pass. */
  background: var(--tn-night);
  border-block-start: calc(0.25rem / var(--tn-text-scale, 1)) solid var(--tn-accent);
  border-start-start-radius: calc(1.25rem / var(--tn-text-scale, 1));
  border-start-end-radius: calc(1.25rem / var(--tn-text-scale, 1));
  pointer-events: none;
}

.tn-hud p {
  margin: 0;
  overflow-wrap: break-word;
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

/*
  The task, directly under Settings and Menu (ADR-0045).

  Third in the strip and never behind a paragraph, so at 200 % text it is inside
  the part of the strip that is on screen. Semi-bold so it reads as the line to
  act on, not as the explanation under it; the words still scale to 200 %.
*/
.tn-hud__task {
  color: var(--tn-on-night);
  font-weight: 600;
}

/*
  "Behind you", after the task (second live-site audit, ck51-gate-after-attempts).
  A skipped stop is still the task, and nothing said it was behind the player.
  After the task line and never before it, so the task stays where ADR-0045
  measured it at 200 %. The arrow points the way the player came and is drawn
  with borders, not a glyph: a screen reader hears the words alone, and
  forced-color-adjust keeps the transparent edges from becoming a box.
*/
.tn-hud__cue {
  display: flex;
  align-items: center;
  gap: 0.4em;
  color: var(--tn-on-night);
  font-size: 0.9375rem;
  font-weight: 800;
}
.tn-hud__cue::before {
  content: "";
  flex: 0 0 auto;
  inline-size: 0;
  block-size: 0;
  border-block: 0.4em solid transparent;
  border-inline-end: 0.6em solid currentColor;
  forced-color-adjust: none;
}

.tn-hud__slot {
  display: flex;
  flex-direction: column;
  gap: calc(0.5rem / var(--tn-text-scale, 1));
}

.tn-hud__slot:empty { display: none; }

/*
  The two controls a player needs while a level is running, on one row: the way
  to Settings and the way to everything else. Each is as wide as its word and the
  row's spare width is shared between them, so at 200 % text "Settings" and
  "Menu" -- and « Réglages » and « Menu » in the dyslexia font -- still share a
  390 px line. They wrap to two rows only if a label ever cannot, rather than
  shrinking a word into pieces.
*/
.tn-hud__controls {
  display: flex;
  flex-wrap: wrap;
  gap: calc(0.5rem / var(--tn-text-scale, 1));
}

.tn-hud .tn-hud__controls button {
  flex: 1 1 auto;
  inline-size: auto;
}

.tn-hud button {
  box-sizing: border-box;
  /* 48 px at every text size: the label grows the button past it, the padding
     around the label does not (see the note at the top of this block). */
  min-block-size: calc(3rem / var(--tn-text-scale, 1));
  min-inline-size: calc(3rem / var(--tn-text-scale, 1));
  inline-size: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: calc(0.5rem / var(--tn-text-scale, 1));
  padding: calc(0.125rem / var(--tn-text-scale, 1)) calc(0.75rem / var(--tn-text-scale, 1));
  border: calc(var(--tn-edge-width) / var(--tn-text-scale, 1)) solid var(--tn-ink);
  border-radius: calc(var(--tn-radius) / var(--tn-text-scale, 1));
  background: var(--tn-paper-2);
  color: var(--tn-ink);
  font: inherit;
  font-weight: 700;
  line-height: 1.15;
  text-align: center;
  overflow-wrap: anywhere;
  cursor: pointer;
  box-shadow: 0 calc(var(--tn-lift) / var(--tn-text-scale, 1)) 0 var(--tn-night-2);
  /* The controls, and only the controls, take input. */
  pointer-events: auto;
}

.tn-hud button:active { box-shadow: 0 0 0 var(--tn-night-2); }

/* What is in reach right now. Brass, so the thing to tap is the thing that
   looks tappable — and it says what pressing does in words, so it is not colour
   doing the work. */
.tn-hud button.tn-hud__prompt {
  background: var(--tn-accent);
  color: var(--tn-accent-ink);
  border-color: var(--tn-accent-edge);
  box-shadow: 0 calc(var(--tn-lift) / var(--tn-text-scale, 1)) 0 var(--tn-accent-edge);
  font-size: 1rem;
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
  border: calc(var(--tn-edge-width) / var(--tn-text-scale, 1)) solid var(--tn-on-night);
  border-inline-start-width: calc(0.625rem / var(--tn-text-scale, 1));
  border-radius: calc(var(--tn-radius) / var(--tn-text-scale, 1));
  padding: calc(0.375rem / var(--tn-text-scale, 1)) calc(0.625rem / var(--tn-text-scale, 1));
  color: var(--tn-on-night);
  font-weight: 700;
}

.tn-hud__hint {
  border: calc(var(--tn-edge-width) / var(--tn-text-scale, 1)) solid var(--tn-on-night);
  border-radius: calc(var(--tn-radius) / var(--tn-text-scale, 1));
  padding: calc(0.375rem / var(--tn-text-scale, 1)) calc(0.625rem / var(--tn-text-scale, 1));
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

/* ------------------------------------------------------------------ *
 * Exam mode.
 *
 * Almost nothing, on purpose. The exam reuses the sheet, the option buttons
 * and the state words every other screen uses; what it adds is a clock that is
 * TEXT (TN-TIMER rule 5: no draining ring, no filling bar, no colour-only
 * warning, and therefore nothing for reduced motion to remove) and a card that
 * is a named region rather than a second dialog.
 * ------------------------------------------------------------------ */

.tn-exam__clock {
  font-weight: 800;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  border: var(--tn-edge-width) solid var(--tn-edge-soft);
  border-radius: var(--tn-radius);
  padding: 0.625rem 0.875rem;
  background: var(--tn-paper-2);
  color: var(--tn-ink);
}

/* "Timer paused" reads as a state word, in the same place every other state
   word on this screen sits -- and the time left stays beside it, because a
   player who opened a menu still wants to know what they are coming back to. */
.tn-exam__clock [data-testid="exam-clock-paused"]:not([hidden]) {
  text-transform: none;
  border-inline-end: var(--tn-edge-width) solid var(--tn-edge-soft);
  padding-inline-end: 0.5rem;
}

.tn-exam__card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/*
  The chosen option in an exam.

  The background FILL is the third signal. The first is the choice indicator --
  a circle, filled when the option is chosen and empty when it is not -- and the
  second is the words "Your answer" inside the button; app/ui/exam-screen.ts
  draws both in the same breath. The .tn-screen [aria-pressed="true"] rule above
  already supplies the brass fill and the heavier border; this rule only adds the
  border STYLE, so the chosen option is still distinguishable in greyscale and
  under forced colours (TN-EXAM-09, "the chosen option is distinguishable without
  colour").

  It used to be a TICK, and that was the defect TN-EXAMMENU-06 names: a tick
  beside an answer mid-exam is feedback exam.noFeedback promised not to give. The
  two glyphs are one shape with two fills for that reason -- never a tick, never
  a cross -- so nothing in a running exam carries a verdict. Both are text, so
  forced colours and greyscale keep them and reduced motion has nothing to
  remove.
*/
.tn-screen__options button[aria-pressed="true"] {
  border-style: double;
}

.tn-screen__mark--choice {
  /* Sized and spaced identically whichever fill it carries, so the two states
     differ by fill alone and the option's text never shifts when it is taken. */
  inline-size: 1.25rem;
  text-align: center;
  line-height: 1;
}

/* The review's marked options: a list item, not a control, so the option rules
   above do not reach it and it needs its own. Same three signals. */
[data-testid="exam-review"] li[data-tn-answer] {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem;
  border: var(--tn-edge-width) solid var(--tn-ink);
  border-radius: var(--tn-radius);
  padding: 0.5rem 0.75rem;
}
[data-testid="exam-review"] li[data-tn-answer="correct"] {
  background: var(--tn-right);
  border-width: 0.25rem;
}
[data-testid="exam-review"] li[data-tn-answer="wrong"] {
  background: var(--tn-wrong);
  border-width: 0.25rem;
  border-style: dashed;
}

@media (forced-colors: active) {
  .tn-exam__clock { border: 0.125rem solid CanvasText; }
  [data-testid="exam-review"] li[data-tn-answer] { border: 0.125rem solid CanvasText; }
  [data-testid="exam-review"] li[data-tn-answer="wrong"] { border-style: dashed; }
}

/* ------------------------------------------------------------------ *
 * "A new version is ready" (ADR-0034, app/ui/update-notice.ts).
 *
 * A line in the page's own <main>, first in it: above the front door's view,
 * the way the storage warning is, and at the top of a level while the HUD sits
 * at the bottom. It is in the flow rather than floating over the page, so at
 * 200 % text it grows downwards and covers no control. Positioned only so it
 * paints above the canvas host, which is fixed; every dialog is z-index 40 and
 * still covers it.
 *
 * A border of weight and a heavier start edge, like the storage warning, so it
 * reads as a notice without colour. No transition and no animation anywhere in
 * this block, so reduced motion has nothing to take away from it.
 * The font is inherited, so the dyslexia-friendly face reaches it on the front
 * door through .tn-screen and in a level through the rule below.
 * ------------------------------------------------------------------ */

.tn-update-notice {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  inline-size: calc(100% - 2.25rem);
  max-inline-size: 34rem;
  margin: 0.75rem auto 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  padding: 0.75rem;
  border: var(--tn-edge-width) solid var(--tn-ink);
  border-inline-start-width: 0.625rem;
  border-radius: var(--tn-radius);
  background: var(--tn-paper);
  color: var(--tn-ink);
  line-height: 1.4;
  pointer-events: auto;
}

[data-tn-font="dyslexia"] .tn-update-notice {
  font-family: "Atkinson Hyperlegible", "Comic Sans MS", Verdana, Tahoma, sans-serif;
  letter-spacing: 0.02em;
  word-spacing: 0.08em;
}

.tn-update-notice__message {
  flex: 1 1 12rem;
  margin: 0;
  color: var(--tn-ink);
  font-weight: 800;
  overflow-wrap: break-word;
}

.tn-update-notice__actions {
  flex: 1 1 12rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tn-update-notice button {
  box-sizing: border-box;
  flex: 1 1 7rem;
  min-block-size: 3rem;
  min-inline-size: 3rem;
  inline-size: auto;
  display: flex;
  align-items: center;
  justify-content: center;
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
  box-shadow: 0 var(--tn-lift) 0 var(--tn-edge-soft);
  pointer-events: auto;
}

.tn-update-notice button.tn-update-notice__reload {
  background: var(--tn-action);
  color: var(--tn-action-ink);
  border-color: var(--tn-action-edge);
  box-shadow: 0 var(--tn-lift) 0 var(--tn-action-edge);
}

.tn-update-notice button:active { box-shadow: none; }

.tn-update-notice :focus-visible,
.tn-update-notice [data-switch-highlight="true"] {
  outline: 0.25rem solid var(--tn-focus);
  outline-offset: 0.1875rem;
  box-shadow: 0 0 0 0.5rem var(--tn-focus-halo);
  border-style: double;
  border-width: 0.25rem;
}

@media (forced-colors: active) {
  .tn-update-notice { border: 0.25rem solid CanvasText; }
  .tn-update-notice button { border: 0.125rem solid ButtonText; }
}

/* ------------------------------------------------------------------ *
 * "This game works best on a phone held upright" (ADR-0060,
 * app/ui/portrait-notice.ts).
 *
 * The update notice's block above, with one button instead of two and a second
 * sentence under the first. Same placement and the same reasons: a line first in
 * the page's own <main>, in the flow rather than floating, so at 200 % text it
 * grows downwards and covers no control.
 *
 * A border of weight and a heavier start edge, so it reads as a notice without
 * colour, and the words say what they mean on their own - there is no icon and
 * no tint carrying any part of the message. No transition and no animation
 * anywhere in this block, so reduced motion has nothing to take away from it.
 * The font is inherited, so the dyslexia-friendly face reaches it.
 * ------------------------------------------------------------------ */

.tn-portrait-notice {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  inline-size: calc(100% - 2.25rem);
  max-inline-size: 34rem;
  margin: 0.75rem auto 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  padding: 0.75rem;
  border: var(--tn-edge-width) solid var(--tn-ink);
  border-inline-start-width: 0.625rem;
  border-radius: var(--tn-radius);
  background: var(--tn-paper);
  color: var(--tn-ink);
  line-height: 1.4;
  pointer-events: auto;
}

[data-tn-font="dyslexia"] .tn-portrait-notice {
  font-family: "Atkinson Hyperlegible", "Comic Sans MS", Verdana, Tahoma, sans-serif;
  letter-spacing: 0.02em;
  word-spacing: 0.08em;
}

.tn-portrait-notice__words {
  flex: 1 1 14rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tn-portrait-notice__message {
  margin: 0;
  color: var(--tn-ink);
  font-weight: 800;
  overflow-wrap: break-word;
}

.tn-portrait-notice__help {
  margin: 0;
  color: var(--tn-ink);
  overflow-wrap: break-word;
}

.tn-portrait-notice button {
  box-sizing: border-box;
  flex: 0 1 7rem;
  min-block-size: 3rem;
  min-inline-size: 3rem;
  inline-size: auto;
  display: flex;
  align-items: center;
  justify-content: center;
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
  box-shadow: 0 var(--tn-lift) 0 var(--tn-edge-soft);
  pointer-events: auto;
}

.tn-portrait-notice button:active { box-shadow: none; }

.tn-portrait-notice :focus-visible,
.tn-portrait-notice [data-switch-highlight="true"] {
  outline: 0.25rem solid var(--tn-focus);
  outline-offset: 0.1875rem;
  box-shadow: 0 0 0 0.5rem var(--tn-focus-halo);
  border-style: double;
  border-width: 0.25rem;
}

@media (forced-colors: active) {
  .tn-portrait-notice { border: 0.25rem solid CanvasText; }
  .tn-portrait-notice button { border: 0.125rem solid ButtonText; }
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
