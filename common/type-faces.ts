/**
 * The faces the game brings with it (ADR-0066 §1, ADR-0071), by name.
 *
 * Names and stacks only. The files and their `@font-face` rules belong to
 * `app/ui/type-faces.ts`, because a URL into `assets/` is the UI build's business.
 * These strings live here because two layers that may not import each other
 * need them: the DOM stylesheet (`app/ui`) and the Phaser canvas
 * (`app/adapters/phaser`). A single definition is what keeps "the canvas draws
 * in the face the HUD draws in" true.
 *
 * **No stack here names a device family.** Every stack is a bundled face, then
 * the game's own metric-adjusted fallback face, then the generic `sans-serif`
 * that CSS requires at the end. `tests/unit/ui/type-stacks.test.ts` reads every
 * `font-family` the game declares and holds it to exactly these names.
 */

/** The UI text face: `.tn-screen`, `.tn-hud` and the canvas. Atkinson Hyperlegible, 400 and 700. */
export const UI_FACE = 'Atkinson Hyperlegible';

/** The face the dyslexia-friendly toggle selects. OpenDyslexic, 400 and 700. */
export const DYSLEXIA_FACE = 'OpenDyslexic';

/**
 * The game's own fallback face, drawn while the UI face has not arrived or if
 * it never does. An `@font-face` whose `src` is a set of faces that share
 * one set of advance widths, adjusted toward the UI face's metrics (ADR-0071 §6).
 * It is not a stack entry that may or may not be installed. If none of its
 * sources is installed, the face does not exist and the stack falls through.
 */
export const UI_FALLBACK_FACE = 'TrueNorth Text Fallback';

/** The weights each bundled family ships. The sheet asks for 400, 600 and 800; matching picks 700 for both. */
export const BUNDLED_WEIGHTS = [400, 700] as const;

const quoted = (family: string): string => `"${family}"`;

/** `font-family` for everything the UI face draws. */
export const UI_STACK = [quoted(UI_FACE), quoted(UI_FALLBACK_FACE), 'sans-serif'].join(', ');

/**
 * `font-family` with the dyslexia toggle on. It falls back to the UI face and not
 * to an adjusted fallback of its own: matching OpenDyslexic's width with a sans
 * face would mean drawing it at about 170 % of its size (ADR-0071 §6).
 */
export const DYSLEXIA_STACK = [quoted(DYSLEXIA_FACE), UI_STACK].join(', ');

/** A `FontFaceSet.load` / `check` shorthand for the UI face at a weight and pixel size. */
export const uiFontShorthand = (weight: number, sizePx: number): string =>
  `${String(weight)} ${String(sizePx)}px ${quoted(UI_FACE)}`;
