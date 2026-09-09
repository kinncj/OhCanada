/**
 * The DOM and the canvas are painted out of one palette, and this is the check.
 *
 * `app/ui/palette.ts` transcribes colours from `assets/style/palette.json`
 * rather than importing it — the reasons are written there — so the two can
 * drift, and a transcription nobody checks is a second palette with extra steps.
 * This suite reads the real file off disk and fails on any disagreement.
 *
 * It also measures every pairing the stylesheet actually uses against the WCAG
 * AA floor. `CLAUDE.md` says contrast meets AA and colour is never the only
 * signal; the second half is proved by `tests/a11y` reading the screens, and the
 * first half is arithmetic, so it is done here where a failure names the pair.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { colour, PALETTE, type PaletteId } from '@ui/palette';

const PALETTE_PATH = fileURLToPath(
  new URL('../../../assets/style/palette.json', import.meta.url),
);

interface PaletteDocument {
  readonly colours: Readonly<Record<string, string>>;
}

const authored = (JSON.parse(readFileSync(PALETTE_PATH, 'utf8')) as PaletteDocument).colours;

/** Relative luminance, WCAG 2.x §relative-luminance. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

function contrast(front: PaletteId, back: PaletteId): number {
  const a = luminance(colour(front));
  const b = luminance(colour(back));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('the UI palette is the art palette', () => {
  it('names only colours assets/style/palette.json defines, with the values it defines', () => {
    for (const [id, value] of Object.entries(PALETTE)) {
      expect(authored[id], `"${id}" is not a colour in assets/style/palette.json`).toBeDefined();
      expect(
        authored[id],
        `"${id}" is ${String(authored[id])} in the art palette and ${value} here`,
      ).toBe(value);
    }
  });

  it('reads a colour by id', () => {
    expect(colour('flag-red-base')).toBe(authored['flag-red-base']);
  });

  it('invents no hue: the art palette is bigger than this one', () => {
    expect(Object.keys(authored).length).toBeGreaterThan(Object.keys(PALETTE).length);
  });
});

/**
 * Every pairing `app/ui/screen-styles.ts` puts on screen, and the floor it has
 * to clear: 4.5:1 where the front colour is text, 3:1 where it is a border, a
 * focus ring or a state fill that is not text.
 *
 * Adding a colour pair to the stylesheet without adding it here is the gap this
 * table is written to close, so the list is deliberately long and dull.
 */
const PAIRS: readonly (readonly [string, PaletteId, PaletteId, number])[] = [
  ['body text on the sheet', 'ink-cool', 'snow-light', 4.5],
  ['help text on the sheet', 'slate-shade', 'snow-light', 4.5],
  ['text on an inset panel', 'ink-cool', 'ice-light', 4.5],
  ['text on a locked card', 'ink-cool', 'snow-base', 4.5],
  ['help text on a locked card', 'slate-shade', 'snow-base', 4.5],
  ['help text on an inset panel', 'slate-shade', 'ice-light', 4.5],
  ['a resting control', 'snow-light', 'cobalt-base', 4.5],
  ['the one action that carries the player forward', 'snow-light', 'flag-red-base', 4.5],
  ['a chosen option', 'ink-warm', 'brass-base', 4.5],
  ['a right answer', 'ink-cool', 'copper-light', 4.5],
  ['a wrong answer', 'ink-cool', 'flag-red-light', 4.5],
  ['the level number disc', 'snow-light', 'cobalt-shade', 4.5],
  ['text on the HUD strip', 'snow-light', 'cobalt-shade', 4.5],
  ['a HUD control', 'ink-cool', 'ice-light', 4.5],
  ['the interact prompt', 'ink-warm', 'brass-base', 4.5],
  ['the sheet edge on the sheet', 'ink-cool', 'snow-light', 3],
  ['a group edge on the sheet', 'slate-base', 'snow-light', 3],
  ['a control edge on the sheet', 'cobalt-shade', 'snow-light', 3],
  ['the brass rule on the night', 'brass-base', 'cobalt-shade', 3],
  ['the sheet against the night', 'snow-light', 'cobalt-shade', 3],
  ['the focus ring against its halo', 'brass-light', 'ink-cool', 3],
  ['the focus halo on the sheet', 'ink-cool', 'snow-light', 3],
  ['the focus ring on the night', 'brass-light', 'cobalt-shade', 3],
];

describe('every pairing on screen meets WCAG AA', () => {
  for (const [what, front, back, floor] of PAIRS) {
    it(`${what}: ${front} on ${back} clears ${String(floor)}:1`, () => {
      expect(contrast(front, back)).toBeGreaterThanOrEqual(floor);
    });
  }
});
