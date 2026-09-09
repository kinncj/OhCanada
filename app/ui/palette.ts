/**
 * The colours `app/ui` paints with, and the one place they are named.
 *
 * **Every value below is a colour from `assets/style/palette.json`, under the
 * id that file gives it.** That file is the allow-list for every fill and stroke
 * in the game's art, and its own note says why the UI's colours are not in it:
 *
 * > "UI, text and focus-ring colours are deliberately absent: ui-a11y owns those
 * > and they must pass WCAG AA."
 *
 * So the *choice* of which ramp tone a control is painted in belongs here, and
 * the *definition* of that tone belongs there. This module is the join, and it
 * is a transcription rather than an import for two reasons:
 *
 *  1. `assets/style/palette.json` is a build-time input for the art pipeline and
 *     `make verify-art`, and it carries 97 colours, 31 ramps, a derivation
 *     formula and a page of prose. Importing it would put all of that on the
 *     8 MB initial payload to read eighteen strings.
 *  2. `app/ui` is DOM only (ADR-0005) and reaches outside `app/` for nothing
 *     else.
 *
 * The transcription cannot drift: `tests/unit/ui/palette.test.ts` reads the real
 * `assets/style/palette.json` off disk and fails if any value here disagrees
 * with the id it claims, or if an id here is one that file does not define.
 *
 * ## Why these ramps
 *
 * The screens and the canvas have to look like one product, so the DOM is
 * painted out of the same winter set the levels are: a deep `cobalt` night, the
 * `ice` and `snow` a card is made of, `slate` for its edges, `brass` for the
 * thing worth pressing, and `flag-red` for the one action per screen that
 * carries the player forward. Nothing here is a hue invented for a button.
 *
 * ## Contrast
 *
 * Every pairing this module is used in is measured in `tests/unit/ui/palette.test.ts`
 * against the WCAG AA floor it has to clear — 4.5:1 for text, 3:1 for a border
 * or a state that is not text. A pairing that fails is a failing test, not a
 * review comment. Colour is never the only signal in any of them: every state
 * that uses one also draws a word and a shape (`app/ui/dom.ts`'s `mark`, the
 * `tn-screen__state` label, and the dashed/dotted card edges).
 */

/**
 * A colour, by the id `assets/style/palette.json#/colours` gives it.
 *
 * The key is the palette id and the value is its hex, so a reader can check any
 * line against that file without leaving this one.
 */
export const PALETTE = {
  /* Ink. Characters' outlines in the art; text and hard edges here. */
  'ink-cool': '#1a2036',
  'ink-warm': '#3a2018',

  /* Snow and ice: the paper a card is made of. */
  'snow-light': '#ffffff',
  'snow-base': '#e6eff7',
  'ice-light': '#e4f2f6',
  'ice-base': '#a9d0e5',

  /* Slate: lamp posts and bridge steel in the art; borders and quiet text here. */
  'slate-base': '#57647a',
  'slate-shade': '#30384f',

  /* Cobalt and navy: the night behind every screen, and the resting control. */
  'cobalt-shade': '#091740',
  'cobalt-base': '#153f86',
  'navy-shade': '#101629',

  /* Brass: buckles and hardware in the art; the passport stamp and the thing
     worth pressing here. */
  'brass-base': '#d6a727',
  'brass-light': '#e1c368',
  'brass-shade': '#935a18',

  /* The flag's red: exactly one action per screen carries the player forward. */
  'flag-red-base': '#d8262c',
  'flag-red-light': '#e27468',
  'flag-red-shade': '#941835',

  /* Oxidised copper: the Peace Tower's spire, and a right answer. */
  'copper-light': '#80caaa',
} as const;

export type PaletteId = keyof typeof PALETTE;

/** One colour, by palette id. Total over the ids above, so a typo does not compile. */
export function colour(id: PaletteId): string {
  return PALETTE[id];
}
