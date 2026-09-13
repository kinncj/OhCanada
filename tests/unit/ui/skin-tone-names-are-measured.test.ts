import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { text, type UiLocale } from '@ui/copy';

/**
 * `docs/stories/TN-SKIN-02` — **the band word is a measurement, not a taste.**
 *
 * Six swatches named "1, light" … "6, dark" are only honest while the palette
 * they name still runs light to dark in that order and still bands two, two,
 * two. `assets/style/palette.json` belongs to the art agent and a ramp can be
 * re-derived at any time; when one is, the copy table does not notice, because
 * a locale string has no way to know what colour it is describing.
 *
 * So the names are held against the palette here. This is the test `TN-SKIN`
 * asks for in as many words — "sort the six `skin-N-base` entries in
 * `assets/style/palette.json` by lightness: the order must be 1 to 6, and the
 * bands must fall two, two, two" — and it is what keeps the tone naming honest
 * rather than tasteful. Nothing below asserts that a name is *good*: an agent
 * wrote these words, `docs/content-review.md` §1 forbids an agent granting
 * cultural sign-off, and a passing run means only that nothing mechanically
 * wrong was found.
 *
 * The last scenario is the negative control, and it is why the rest is worth
 * running: it re-derives a ramp in a copy of the palette and asserts the check
 * goes red. Without it, a passing run could mean the palette was never read.
 */

const PALETTE = new URL('../../../assets/style/palette.json', import.meta.url);

interface Palette {
  readonly colours: Readonly<Record<string, string>>;
}

const palette = JSON.parse(readFileSync(PALETTE, 'utf8')) as Palette;

const RAMPS = ['skin-1', 'skin-2', 'skin-3', 'skin-4', 'skin-5', 'skin-6'] as const;

/** The band word each language uses, and the ramps it is claimed of. */
const BANDS: Readonly<Record<UiLocale, readonly string[]>> = {
  en: ['light', 'medium', 'dark'],
  fr: ['clair', 'moyen', 'foncé'],
};

/**
 * CIE L* from a hex colour: perceptual lightness, not `(r+g+b)/3`.
 *
 * The naive average would call `#7a4923` and `#556b2f` equally light, which is
 * the sort of near-miss that lets a re-derived ramp slip past a check written
 * to catch exactly that. sRGB is linearised first, because the stored bytes are
 * gamma-encoded and averaging them is averaging the wrong quantity.
 */
export function lightness(hex: string): number {
  const channel = (value: number): number => {
    const unit = value / 255;
    return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  };
  const int = Number.parseInt(hex.replace('#', ''), 16);
  const r = channel((int >> 16) & 0xff);
  const g = channel((int >> 8) & 0xff);
  const b = channel(int & 0xff);
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return y <= 216 / 24389 ? y * (24389 / 27) : Math.cbrt(y) * 116 - 16;
}

/** The band word a name carries, from the name alone. */
function bandOf(locale: UiLocale, name: string): string | null {
  return BANDS[locale].find((word) => name.includes(word)) ?? null;
}

/**
 * The whole rule, over any palette: the order is 1→6 by lightness and the bands
 * the names claim fall two, two, two in that order.
 *
 * Written as a function over a `colours` table rather than inline, so the
 * negative control can run the identical check against a broken palette. A
 * check that a fixture cannot reach is a check nobody can prove works.
 */
export function bandFailures(
  colours: Readonly<Record<string, string>>,
  locale: UiLocale,
): readonly string[] {
  const failures: string[] = [];
  const measured = RAMPS.map((ramp) => {
    const hex = colours[`${ramp}-base`];
    if (hex === undefined) {
      failures.push(`${ramp}-base is not in the palette, so "${ramp}" names no ramp`);
      return { ramp, l: Number.NaN };
    }
    return { ramp, l: lightness(hex) };
  });
  if (failures.length > 0) return failures;

  /* Ordering. Lightest first, so `skin-1` must be the lightest of the six. */
  for (let index = 1; index < measured.length; index += 1) {
    const previous = measured[index - 1];
    const current = measured[index];
    if (previous === undefined || current === undefined) continue;
    if (!(previous.l > current.l)) {
      failures.push(
        `${previous.ramp} (L* ${previous.l.toFixed(1)}) is not lighter than ${current.ramp} ` +
          `(L* ${current.l.toFixed(1)}), so the ordinal in their names is wrong`,
      );
    }
  }

  /* Banding. The word the name claims against the word the measurement earns. */
  const expected = [
    BANDS[locale][0],
    BANDS[locale][0],
    BANDS[locale][1],
    BANDS[locale][1],
    BANDS[locale][2],
    BANDS[locale][2],
  ];
  for (const [index, entry] of measured.entries()) {
    const name = text(locale, `creator.skin.${entry.ramp}` as Parameters<typeof text>[1]);
    const claimed = bandOf(locale, name);
    const earned = expected[index];
    if (claimed !== earned) {
      failures.push(
        `${entry.ramp} is named "${name}" (band "${claimed ?? 'none'}") but measures ` +
          `L* ${entry.l.toFixed(1)}, which is band "${earned ?? '?'}"`,
      );
    }
  }
  return failures;
}

describe('the six skin tone names against the palette that draws them', () => {
  it('sorts 1 to 6 by lightness, and fails on any adjacent pair out of order', () => {
    const measured = RAMPS.map((ramp) => ({
      ramp,
      l: lightness(palette.colours[`${ramp}-base`] ?? '#000000'),
    }));
    const sorted = [...measured].sort((a, b) => b.l - a.l).map((entry) => entry.ramp);

    expect(sorted).toEqual([...RAMPS]);
    for (let index = 1; index < measured.length; index += 1) {
      expect(
        measured[index - 1]!.l,
        `${measured[index - 1]!.ramp} must be lighter than ${measured[index]!.ramp}`,
      ).toBeGreaterThan(measured[index]!.l);
    }
  });

  it('bands two, two, two, in both languages independently', () => {
    expect(bandFailures(palette.colours, 'en')).toEqual([]);
    expect(bandFailures(palette.colours, 'fr')).toEqual([]);
  });

  it('uses every band word exactly twice, and gives no tone a word of its own', () => {
    for (const locale of ['en', 'fr'] as const) {
      const used = RAMPS.map((ramp) =>
        bandOf(locale, text(locale, `creator.skin.${ramp}` as Parameters<typeof text>[1])),
      );
      expect(used, `${locale}: a tone carries no band word`).not.toContain(null);
      for (const word of BANDS[locale]) {
        expect(
          used.filter((band) => band === word).length,
          `${locale}: "${word}" is not used exactly twice`,
        ).toBe(2);
      }
      /* Six ramps have no middle, which is the point: no option is the one the
         others are measured against. Three words over six tones is that fact. */
      expect(new Set(used).size).toBe(3);
    }
  });

  it('names the ordinal the palette, the atlas and the save all use', () => {
    for (const [index, ramp] of RAMPS.entries()) {
      for (const locale of ['en', 'fr'] as const) {
        const name = text(locale, `creator.skin.${ramp}` as Parameters<typeof text>[1]);
        expect(name.startsWith(String(index + 1))).toBe(true);
      }
    }
  });

  it('says nothing docs/content-review.md 8.1 bans, in either language', () => {
    const banned = [
      'tan',
      'olive',
      'caramel',
      'chocolate',
      'chocolat',
      'honey',
      'miel',
      'peach',
      'pêche',
      'nude',
      'flesh',
      'café',
      'coffee',
      'ivory',
      'ivoire',
      'porcelain',
      'ebony',
      'ébène',
    ];
    for (const ramp of RAMPS) {
      for (const locale of ['en', 'fr'] as const) {
        const name = text(locale, `creator.skin.${ramp}` as Parameters<typeof text>[1])
          .toLowerCase();
        for (const word of banned) {
          expect(name.includes(word), `${ramp} (${locale}) says "${word}"`).toBe(false);
        }
      }
    }
  });

  it('goes red when a ramp is re-derived out of its band (the negative control)', () => {
    /*
     * `TN-SKIN-02`: "given `skin-2` is re-derived to a lightness deeper than
     * `skin-4` … it fails, naming the ramp, its measured lightness and the band
     * word that is now wrong." Without this, a passing suite would be
     * indistinguishable from a suite that never opened the palette.
     */
    const broken = { ...palette.colours, 'skin-2-base': '#3a2011' };
    const failures = bandFailures(broken, 'en');

    expect(failures.length).toBeGreaterThan(0);
    expect(failures.join('\n')).toContain('skin-2');
    expect(failures.join('\n')).toMatch(/L\* \d+\.\d/);
    expect(failures.join('\n')).toContain('light');
  });

  it('goes red for a fixture in which skin-6 is the lightest (the other control)', () => {
    const inverted = {
      ...palette.colours,
      'skin-6-base': palette.colours['skin-1-base'] ?? '#efbe99',
      'skin-1-base': palette.colours['skin-6-base'] ?? '#553018',
    };
    expect(bandFailures(inverted, 'fr').length).toBeGreaterThan(0);
    expect(bandFailures(inverted, 'en').join('\n')).toContain('skin-1');
  });

  it('goes red for a name that claims a ramp the palette does not have', () => {
    const { 'skin-4-base': _gone, ...withoutFour } = palette.colours;
    const failures = bandFailures(withoutFour, 'en');

    expect(failures.join('\n')).toContain('skin-4-base is not in the palette');
  });
});
