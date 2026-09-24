/**
 * The bundled faces' `@font-face` rules (ADR-0066 §1, ADR-0071).
 *
 * Four files, each shipped exactly as upstream made them, under
 * `assets/src/fonts/`. They are resolved through Vite the way the screen art is
 * (`./screen-art.ts`): the build emits each file content-hashed into
 * `dist/assets/`, and the worker precaches everything there with the shell
 * (ADR-0034). `scripts/deploy-check.mjs` charges them to the initial payload.
 *
 * | family | weight | file |
 * |---|---|---|
 * | Atkinson Hyperlegible | 400, 700 | the UI text face |
 * | OpenDyslexic | 400, 700 | the dyslexia toggle's face |
 *
 * **Weights.** The sheet asks for 400, 600 and 800. Each family declares 400 and
 * 700 only, so CSS font matching resolves 600 and 800 to the real Bold, and the
 * browser never synthesises one. OpenDyslexic Bold's own weight class is 800.
 * The descriptor below says 700, and matching reads the descriptor, so 600 and
 * 800 both reach it. `tests/a11y/type-faces.spec.ts` asserts no synthesis by
 * width and by ink.
 *
 * **The fallback.** `TrueNorth Text Fallback` is drawn while Atkinson has not
 * arrived, or if it never does. Its sources are three faces made to share one
 * set of advance widths, so the one set of overrides below is right for
 * whichever resolves. `size-adjust` brings its average advance toward
 * Atkinson's, and **only toward it**: a `local()` face renders here with hinted,
 * whole-pixel advances, so the adjustment moves the width in steps. Measured on
 * 2026-09-23 over five strip strings at every size the game draws (15–38 px),
 * the adjusted fallback runs 0.96–1.05x Atkinson's width at 98 %. At the
 * 200 % sizes, where the line budget binds (30–38 px), it is 0.96–0.99x, never
 * wider. 99 %, the figure the unhinted widths suggest, drew up to 1.03x there.
 * The vertical overrides are
 * Atkinson's own metrics (ascender 950, descender 290, no line gap, on a
 * 1000-unit em), divided by that `size-adjust` because the browser scales the
 * overrides by it. The dyslexia stack does not get a fallback of its own; it
 * falls back to Atkinson (ADR-0071 §6).
 *
 * `font-display: swap` for all four. A face the worker holds costs nothing, and
 * the adjusted fallback keeps the swap on a cold first paint small.
 *
 * DOM only (ADR-0005). The family names come from `@common/type-faces`, which
 * the canvas reads as well.
 */

import { DYSLEXIA_FACE, UI_FACE, UI_FALLBACK_FACE } from '@common/type-faces';

const STYLE_ID = 'tn-type-faces';

/** Each bundled file, by URL: hashed and emitted by the UI build, never inlined. */
export const FACE_URLS = {
  uiRegular: new URL(
    '../../assets/src/fonts/atkinson-hyperlegible/AtkinsonHyperlegible-Regular.woff2',
    import.meta.url,
  ).href,
  uiBold: new URL(
    '../../assets/src/fonts/atkinson-hyperlegible/AtkinsonHyperlegible-Bold.woff2',
    import.meta.url,
  ).href,
  dyslexiaRegular: new URL(
    '../../assets/src/fonts/opendyslexic/OpenDyslexic-Regular.woff2',
    import.meta.url,
  ).href,
  dyslexiaBold: new URL(
    '../../assets/src/fonts/opendyslexic/OpenDyslexic-Bold.woff2',
    import.meta.url,
  ).href,
} as const;

/**
 * The fallback's `size-adjust`, as a fraction. The unhinted ratio of Atkinson's
 * average advance to the trio's is 0.989 at 400 and 0.996 at 700, but the face
 * renders with hinted advances. 0.98 is the largest step that never draws wider
 * than Atkinson at the 200 % sizes (see the header), and a fallback that errs
 * narrow can only loosen the sweep's line budget, never breach it.
 */
export const FALLBACK_SIZE_ADJUST = 0.98;

/** Atkinson Hyperlegible's vertical metrics, in em (unitsPerEm 1000; hhea and typo agree). */
const UI_ASCENT = 0.95;
const UI_DESCENT = 0.29;

const percent = (value: number): string => `${(value * 100).toFixed(2)}%`;

const face = (family: string, url: string, weight: number): string => `
@font-face {
  font-family: "${family}";
  src: url("${url}") format("woff2");
  font-weight: ${String(weight)};
  font-style: normal;
  font-display: swap;
}`;

/**
 * The fallback's sources, by the full and PostScript names `local()` matches.
 * Each of the three is built to Arial's advance widths, which is the only
 * reason they may share a rule.
 */
const FALLBACK_SOURCES: Readonly<Record<400 | 700, readonly string[]>> = {
  400: ['Arial', 'ArialMT', 'Liberation Sans', 'LiberationSans', 'Arimo', 'Arimo-Regular'],
  700: ['Arial Bold', 'Arial-BoldMT', 'Liberation Sans Bold', 'LiberationSans-Bold', 'Arimo Bold', 'Arimo-Bold'],
};

const fallbackFace = (weight: 400 | 700): string => `
@font-face {
  font-family: "${UI_FALLBACK_FACE}";
  src: ${FALLBACK_SOURCES[weight].map((name) => `local("${name}")`).join(', ')};
  font-weight: ${String(weight)};
  font-style: normal;
  size-adjust: ${percent(FALLBACK_SIZE_ADJUST)};
  ascent-override: ${percent(UI_ASCENT / FALLBACK_SIZE_ADJUST)};
  descent-override: ${percent(UI_DESCENT / FALLBACK_SIZE_ADJUST)};
  line-gap-override: 0%;
}`;

/** The whole rule set, as the stylesheet text. Exported for the stack test. */
export const TYPE_FACES_CSS = [
  face(UI_FACE, FACE_URLS.uiRegular, 400),
  face(UI_FACE, FACE_URLS.uiBold, 700),
  face(DYSLEXIA_FACE, FACE_URLS.dyslexiaRegular, 400),
  face(DYSLEXIA_FACE, FACE_URLS.dyslexiaBold, 700),
  fallbackFace(400),
  fallbackFace(700),
].join('\n');

/**
 * Put the faces on the page. Idempotent: every screen's stylesheet calls it, and
 * the composition root calls it first, before the canvas asks for a face.
 */
export function injectTypeFaces(doc: Document): HTMLStyleElement {
  const existing = doc.getElementById(STYLE_ID);
  if (existing !== null) return existing as HTMLStyleElement;

  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = TYPE_FACES_CSS;
  doc.head.append(style);
  return style;
}
