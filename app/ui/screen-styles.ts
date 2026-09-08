/**
 * One stylesheet for every slice-1 DOM screen.
 *
 * `app/ui` owns its presentation, and a `<style>` element keeps that true
 * without a CSS import only the bundler understands — the same choice
 * `rotate-overlay.ts` made and for the same reason.
 *
 * Four things here are acceptance criteria, not decoration:
 *
 *  1. **Touch targets.** `min-block-size: 2.75rem` is 44 px at 100 % and 88 px
 *     at 200 %, because text scaling is applied as a root `font-size`
 *     percentage (`applySettings`). A pixel literal would shrink relative to the
 *     text it holds exactly when the player asked for bigger text.
 *  2. **200 % text.** Every layout is single-column and wraps; nothing is sized
 *     in `vw`; long words break rather than push the page sideways
 *     (`overflow-wrap: anywhere`), which is what "the page does not scroll
 *     sideways" comes down to at 390 px.
 *  3. **Reduced motion.** `[data-tn-motion="reduced"]` — set by `applySettings`
 *     from the setting *or* the media query — removes transitions and
 *     animations. The media query is honoured on its own as well, so stillness
 *     survives even if the attribute is never written.
 *  4. **Colour is never the only signal.** Chosen, correct and wrong states all
 *     carry a mark and a word; the CSS adds a border and a background *as well
 *     as* colour, and the high-contrast theme replaces hue with weight.
 */

const STYLE_ID = 'tn-screen-style';

const CSS = `
:root {
  --tn-screen-bg: #0b1622;
  --tn-screen-fg: #f3f8fc;
  --tn-screen-muted: #d3e0ec;
  --tn-screen-line: #6f8ba6;
  --tn-screen-control-bg: #16324d;
  --tn-screen-control-fg: #ffffff;
  --tn-screen-chosen-bg: #dceaf8;
  --tn-screen-chosen-fg: #06121f;
  --tn-screen-focus: #ffd24a;
}

[data-tn-contrast="high"] {
  --tn-screen-bg: #000000;
  --tn-screen-fg: #ffffff;
  --tn-screen-muted: #ffffff;
  --tn-screen-line: #ffffff;
  --tn-screen-control-bg: #000000;
  --tn-screen-control-fg: #ffffff;
  --tn-screen-chosen-bg: #ffffff;
  --tn-screen-chosen-fg: #000000;
  --tn-screen-focus: #ffffff;
}

[data-tn-font="dyslexia"] .tn-screen {
  font-family: "Atkinson Hyperlegible", "Comic Sans MS", Verdana, Tahoma, sans-serif;
  letter-spacing: 0.02em;
  word-spacing: 0.08em;
}

.tn-screen {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: stretch;
  justify-content: center;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--tn-screen-bg);
  color: var(--tn-screen-fg);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  font-size: 1rem;
  line-height: 1.5;
  overscroll-behavior: contain;
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

.tn-screen__card {
  box-sizing: border-box;
  width: 100%;
  max-width: 34rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding:
    max(1rem, env(safe-area-inset-top, 0px))
    max(1rem, env(safe-area-inset-right, 0px))
    max(1.5rem, env(safe-area-inset-bottom, 0px))
    max(1rem, env(safe-area-inset-left, 0px));
}

.tn-screen h1,
.tn-screen h2,
.tn-screen h3 {
  margin: 0;
  line-height: 1.25;
  font-size: 1.375rem;
}

.tn-screen h2 { font-size: 1.125rem; }
.tn-screen p { margin: 0; }

.tn-screen p,
.tn-screen li,
.tn-screen label,
.tn-screen h1,
.tn-screen h2,
.tn-screen h3,
.tn-screen button {
  overflow-wrap: anywhere;
  hyphens: auto;
}

.tn-screen__help {
  color: var(--tn-screen-muted);
  font-size: 0.9375rem;
}

/* Every control: at least 44 CSS px, and 88 at 200 % text. */
.tn-screen button,
.tn-screen [role="radio"],
.tn-screen [role="switch"],
.tn-screen input[type="range"] {
  box-sizing: border-box;
  min-block-size: 2.75rem;
  min-inline-size: 2.75rem;
  font: inherit;
  cursor: pointer;
}

.tn-screen button,
.tn-screen [role="radio"],
.tn-screen [role="switch"] {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  inline-size: 100%;
  padding: 0.625rem 0.875rem;
  border: 2px solid var(--tn-screen-line);
  border-radius: 0.5rem;
  background: var(--tn-screen-control-bg);
  color: var(--tn-screen-control-fg);
  text-align: start;
}

.tn-screen button:disabled { cursor: default; opacity: 1; }

/* Focus is a change of geometry as well as of colour, so it survives greyscale,
   a colour-vision difference and forced-colours mode. */
.tn-screen :focus-visible,
.tn-screen [data-switch-highlight="true"] {
  outline: 4px solid var(--tn-screen-focus);
  outline-offset: 3px;
  border-style: double;
  border-width: 4px;
}

.tn-screen__group {
  border: 2px solid var(--tn-screen-line);
  border-radius: 0.5rem;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tn-screen__legend {
  font-weight: 700;
  padding: 0;
}

/* Chosen / correct / wrong: a mark, a word and a border — never hue alone. */
.tn-screen [aria-checked="true"],
.tn-screen [aria-pressed="true"] {
  background: var(--tn-screen-chosen-bg);
  color: var(--tn-screen-chosen-fg);
  border-style: solid;
  border-width: 4px;
}

.tn-screen__mark {
  font-weight: 700;
  flex: 0 0 auto;
}

.tn-screen__state {
  margin-inline-start: auto;
  font-weight: 700;
  flex: 0 0 auto;
}

.tn-screen__row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tn-screen__actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-block-start: auto;
}

.tn-screen__actions button { justify-content: center; text-align: center; }

.tn-screen ul {
  margin: 0;
  padding-inline-start: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tn-screen__options {
  list-style: none;
  padding-inline-start: 0;
}

.tn-screen input[type="range"] {
  inline-size: 100%;
  accent-color: var(--tn-screen-focus);
}

.tn-screen__preview {
  border: 2px solid var(--tn-screen-line);
  border-radius: 0.5rem;
  padding: 0.75rem;
  background: var(--tn-screen-control-bg);
  color: var(--tn-screen-control-fg);
}

.tn-screen__notice {
  border: 4px solid var(--tn-screen-line);
  border-radius: 0.5rem;
  padding: 0.75rem;
  background: var(--tn-screen-control-bg);
  color: var(--tn-screen-control-fg);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* Motion is a separate axis from the visual tier: the attribute is written from
   the setting OR the media query, and the media query is also honoured alone. */
[data-tn-motion="reduced"] .tn-screen,
[data-tn-motion="reduced"] .tn-screen * {
  animation: none !important;
  transition: none !important;
  scroll-behavior: auto !important;
}

@media (prefers-reduced-motion: reduce) {
  .tn-screen,
  .tn-screen * {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}

@media (forced-colors: active) {
  .tn-screen button,
  .tn-screen [role="radio"],
  .tn-screen [role="switch"] { border: 2px solid ButtonText; }
  .tn-screen [aria-checked="true"] { border-width: 4px; }
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
