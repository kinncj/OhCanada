import { describe, expect, it } from 'vitest';

import gameConfigJson from '@content/game.config.json';
import type { ThemeColours } from '@application/ports';
import {
  DEFAULT_PALETTE,
  blendColors,
  mixColor,
  parseBootConfig,
  toCssColor,
  toPhaserColor,
} from '@adapters/phaser/boot-config';

/**
 * The boot path reads `content/game.config.json` and nothing else. If that file
 * is wrong the game must fail loudly at boot, not draw a black rectangle, so the
 * parser is a `Result` and it is tested against the real shipped document.
 */
const valid = (): Record<string, unknown> =>
  JSON.parse(JSON.stringify(gameConfigJson)) as Record<string, unknown>;

/** The `theme` block as it ships. Read from the document, never re-typed here. */
const shippedTheme = (): ThemeColours => {
  const theme = valid()['theme'];
  expect(theme, 'content/game.config.json lost its theme block').toBeDefined();
  return theme as ThemeColours;
};

/** A copy of the shipped config with one theme colour deliberately wrong. */
const withPerturbedTheme = (): { raw: Record<string, unknown>; sky: string } => {
  const raw = valid();
  const sky = '#7a1020';
  raw['theme'] = { ...shippedTheme(), sky };
  return { raw, sky };
};

describe('parseBootConfig', () => {
  it('accepts the shipped content/game.config.json', () => {
    const result = parseBootConfig(gameConfigJson);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toBe('TrueNorth');
    expect(result.value.version).toBe('0.1.0');
    expect(result.value.designWidth).toBe(1080);
    expect(result.value.designHeight).toBe(1920);
    expect(result.value.debugOverlay).toBe(false);
    expect(result.value.defaultLocale).toBe('en');
  });

  it('keeps the design resolution portrait, because there is no landscape layout', () => {
    const result = parseBootConfig(gameConfigJson);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.designHeight).toBeGreaterThan(result.value.designWidth);
  });

  it('falls back to the built-in palette when a document carries no theme', () => {
    const raw = valid();
    delete raw['theme'];
    // Guard the premise: this test is meaningless against a document that still
    // has a theme, which is exactly how its predecessor rotted.
    expect(raw['theme']).toBeUndefined();

    const result = parseBootConfig(raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.palette).toEqual(DEFAULT_PALETTE);
    expect(result.value.backgroundColor).toBe(DEFAULT_PALETTE.sky);
  });

  it('lets the shipped theme, not the built-in default, reach the palette', () => {
    const result = parseBootConfig(gameConfigJson);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.palette).toEqual(shippedTheme());
    expect(result.value.backgroundColor).toBe(shippedTheme().sky);

    /*
      The assertion above still holds if the parser ignored `theme` and returned
      DEFAULT_PALETTE, as long as the two happen to carry the same colours. So
      perturb the shipped document and require the perturbation to win: the pair
      can no longer pass by coincidence whatever content chooses.
    */
    const { raw, sky } = withPerturbedTheme();
    const perturbed = parseBootConfig(raw);

    expect(perturbed.ok).toBe(true);
    if (!perturbed.ok) return;
    expect(perturbed.value.palette.sky).toBe(sky);
    expect(perturbed.value.backgroundColor).toBe(sky);
    expect(perturbed.value.palette.sky).not.toBe(DEFAULT_PALETTE.sky);
  });

  it('reads a theme from the config when one is present, so colours stay data', () => {
    const result = parseBootConfig({
      ...valid(),
      theme: { sky: '#112233', ground: '#445566', horizon: '#778899' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.palette.sky).toBe('#112233');
    expect(result.value.palette.ground).toBe('#445566');
    expect(result.value.palette.horizon).toBe('#778899');
    expect(result.value.palette.ink).toBe(DEFAULT_PALETTE.ink);
    expect(result.value.backgroundColor).toBe('#112233');
  });

  it('rejects a colour that is not a #rrggbb literal', () => {
    const result = parseBootConfig({ ...valid(), theme: { sky: 'rebeccapurple' } });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('invalid');
    expect(result.error.code).toBe('config.boot.theme.sky');
  });

  it.each([
    ['title', 'config.boot.title'],
    ['version', 'config.boot.version'],
    ['designWidth', 'config.boot.designWidth'],
    ['designHeight', 'config.boot.designHeight'],
    ['defaultLocale', 'config.boot.defaultLocale'],
    ['featureFlags', 'config.boot.featureFlags'],
  ])('rejects a config missing %s', (field, code) => {
    const raw = valid();
    delete raw[field];

    const result = parseBootConfig(raw);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(code);
  });

  it('rejects a non-integer or non-positive design resolution', () => {
    expect(parseBootConfig({ ...valid(), designWidth: 0 }).ok).toBe(false);
    expect(parseBootConfig({ ...valid(), designHeight: 19.5 }).ok).toBe(false);
    expect(parseBootConfig({ ...valid(), designWidth: '1080' }).ok).toBe(false);
  });

  it('rejects anything that is not an object', () => {
    for (const raw of [null, undefined, 42, 'config', []]) {
      const result = parseBootConfig(raw);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.code).toBe('config.boot.document');
    }
  });

  it('rejects a non-boolean debugOverlay flag', () => {
    const raw = valid();
    raw['featureFlags'] = { debugOverlay: 'yes' };

    const result = parseBootConfig(raw);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('config.boot.featureFlags.debugOverlay');
  });
});

describe('toPhaserColor', () => {
  it('converts a #rrggbb literal to the integer Phaser wants', () => {
    expect(toPhaserColor('#000000')).toBe(0x000000);
    expect(toPhaserColor('#ffffff')).toBe(0xffffff);
    expect(toPhaserColor('#0f3057')).toBe(0x0f3057);
    expect(toPhaserColor('#0F3057')).toBe(0x0f3057);
  });
});

describe('toCssColor', () => {
  it('is the inverse of toPhaserColor, padding included', () => {
    for (const hex of ['#000000', '#ffffff', '#0f3057', '#010203']) {
      expect(toCssColor(toPhaserColor(hex))).toBe(hex);
    }
  });

  it('masks rather than throws, because a colour is not worth a failed boot', () => {
    expect(toCssColor(0x1ffffff)).toBe('#ffffff');
    expect(toCssColor(-1)).toBe('#ffffff');
    expect(toCssColor(12.6)).toBe('#00000d');
  });
});

describe('blendColors', () => {
  it('is what mixColor is made of, so the page and the scene cannot round apart', () => {
    /*
      The land under the horizon is a shade of `theme.ground` computed as an
      integer for the canvas and handed to CSS as a string. One implementation
      means the hills in the side panels are the same colour as the hills on the
      canvas, to the byte.
    */
    for (const position of [0, 0.25, 0.55, 1]) {
      expect(blendColors(0x0f3057, 0x12352a, position)).toBe(
        mixColor('#0f3057', '#12352a', position),
      );
    }
  });

  it('darkens towards black without wrapping a channel', () => {
    expect(blendColors(0x12352a, 0x000000, 0)).toBe(0x12352a);
    expect(blendColors(0x12352a, 0x000000, 1)).toBe(0x000000);
    expect(blendColors(0xffffff, 0x000000, 0.5)).toBe(0x808080);
  });
});

describe('mixColor', () => {
  it('returns the endpoints exactly, so the gradient starts and ends on the palette', () => {
    expect(mixColor('#0f3057', '#12352a', 0)).toBe(0x0f3057);
    expect(mixColor('#0f3057', '#12352a', 1)).toBe(0x12352a);
  });

  it('interpolates each channel independently', () => {
    expect(mixColor('#000000', '#ffffff', 0.5)).toBe(0x808080);
    expect(mixColor('#ff0000', '#0000ff', 0.5)).toBe(0x800080);
  });

  it('clamps out-of-range positions instead of wrapping the channels', () => {
    expect(mixColor('#000000', '#ffffff', -1)).toBe(0x000000);
    expect(mixColor('#000000', '#ffffff', 2)).toBe(0xffffff);
    expect(mixColor('#000000', '#ffffff', Number.NaN)).toBe(0x000000);
  });

  it('never leaves the 24-bit range', () => {
    for (let step = 0; step <= 20; step += 1) {
      const value = mixColor('#0f3057', '#e8eef4', step / 20);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(0xffffff);
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});

/**
 * Contrast is a requirement, not a feature (CLAUDE.md, Accessibility).
 *
 * `ink` and `inkMuted` are painted over the sky -> ground gradient, so the only
 * honest measurement is the worst ratio across every stop of it, not the ratio
 * against one endpoint. The version label uses `inkMuted` at 44 px of *design*
 * space, which on a 390 px-wide phone lands near 16 CSS px — normal text, so the
 * AAA floor is 7:1 and not the 4.5:1 large-text one.
 */
const relativeLuminance = (hex: string): number => {
  const value = toPhaserColor(hex);
  const channel = (shift: number): number => {
    const srgb = ((value >> shift) & 0xff) / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
};

const contrastRatio = (a: string, b: string): number => {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
};

/** Worst ratio of `ink` against the gradient, sampled at the band count the scene draws. */
const worstOverGradient = (ink: string, palette: ThemeColours): number => {
  let worst = Number.POSITIVE_INFINITY;
  for (let step = 0; step <= 96; step += 1) {
    const band = mixColor(palette.sky, palette.ground, step / 96)
      .toString(16)
      .padStart(6, '0');
    worst = Math.min(worst, contrastRatio(ink, `#${band}`));
  }
  return worst;
};

describe('palette contrast', () => {
  it('keeps the built-in palette at AAA across the whole gradient', () => {
    expect(worstOverGradient(DEFAULT_PALETTE.ink, DEFAULT_PALETTE)).toBeGreaterThanOrEqual(7);
    expect(
      worstOverGradient(DEFAULT_PALETTE.inkMuted, DEFAULT_PALETTE),
    ).toBeGreaterThanOrEqual(7);
  });

  /*
    The shipped theme is content's to choose, so this holds it to the AA floor
    the schema documents rather than to the built-in constant's AAA. When content
    adopts the AAA `inkMuted` this test keeps passing; if content ever drops below
    AA the boot screen fails here instead of in a manual audit.
  */
  it('keeps the shipped theme at least at AA across the whole gradient', () => {
    const theme = shippedTheme();
    expect(worstOverGradient(theme.ink, theme)).toBeGreaterThanOrEqual(4.5);
    expect(worstOverGradient(theme.inkMuted, theme)).toBeGreaterThanOrEqual(4.5);
  });
});
