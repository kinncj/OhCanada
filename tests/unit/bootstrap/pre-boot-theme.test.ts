import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import gameConfigJson from '@content/game.config.json';
import type { ThemeColours } from '@application/ports';
import { DEFAULT_PALETTE } from '@adapters/phaser/boot-config';

/**
 * The pre-boot paint contract.
 *
 * `index.html` is painted by the browser before a single byte of the bundle has
 * run, so it cannot read `content/game.config.json`; the sky/ground/horizon
 * literals in its `:root` block and the `theme-color` meta are a deliberate copy
 * of the config's `theme`. `app/bootstrap` overwrites the custom properties and
 * the meta the moment the parsed config exists, so the copy is only ever the
 * *first frame* — but a first frame in the wrong colour is a visible flash and a
 * wrong browser-chrome tint on mobile.
 *
 * Duplication that is checked is not drift. This test is the check: edit the
 * theme in the config without editing `index.html` and it fails here, in the
 * unit suite, rather than silently on a device.
 *
 * Why not generate the literals at build time: that means an HTML transform in
 * `vite.config.ts`, which this adapter does not own, and it would still leave a
 * copy — one nobody can read in the source. See the note in `index.html`.
 */

const INDEX_HTML = readFileSync(
  fileURLToPath(new URL('../../../index.html', import.meta.url)),
  'utf8',
);

const theme = (gameConfigJson as { theme?: ThemeColours }).theme;

/** Colours the page paints before boot. The rest of the palette is canvas-only. */
const PRE_BOOT_KEYS = ['sky', 'ground', 'horizon'] as const;
/** Colours that must never be copied into the page, so no third copy can appear. */
const CANVAS_ONLY_KEYS = ['ink', 'inkMuted'] as const;

/** `inkMuted` -> `ink-muted`. The palette keys are camelCase; CSS names are not. */
const kebabCase = (name: string): string =>
  name.replace(/([a-z0-9])([A-Z])/gu, '$1-$2').toLowerCase();

/**
 * The declared value of `--tn-<key>` in `index.html`, or `null`.
 *
 * Both spellings of a multi-word key are accepted — `--tn-inkMuted` and
 * `--tn-ink-muted` — because the palette key is camelCase and every custom
 * property already in the page is kebab-case (`--tn-safe-top`), so the name
 * anyone would actually write is the kebab one. Matching only the camelCase
 * spelling made the CANVAS_ONLY_KEYS assertions below unfailable: a copied
 * `--tn-ink-muted` matched neither `--tn-inkMuted` nor `--tn-ink` (that one
 * requires the colon immediately after `ink`), so the third copy this file
 * exists to forbid would have slipped through while the test still read as
 * coverage. An assertion that cannot fail is worse than none.
 */
const readCustomProperty = (name: string): string | null => {
  const spellings = [...new Set([name, kebabCase(name)])].join('|');
  const match = new RegExp(
    `--tn-(?:${spellings})\\s*:\\s*(#[0-9a-fA-F]{3,8})\\s*;`,
    'u',
  ).exec(INDEX_HTML);
  return match?.[1]?.toLowerCase() ?? null;
};

const readThemeColorMeta = (): string | null => {
  const match = /<meta\s+name="theme-color"\s+content="(#[0-9a-fA-F]{3,8})"/.exec(INDEX_HTML);
  return match?.[1]?.toLowerCase() ?? null;
};

describe('index.html pre-boot theme', () => {
  it('is checked against a config that actually carries a theme', () => {
    // Guard the premise, the way the boot-config fallback test learned to.
    expect(theme, 'content/game.config.json has no theme block').toBeDefined();
  });

  it.each(PRE_BOOT_KEYS)(
    'paints --tn-%s with the colour content/game.config.json ships',
    (key) => {
      const declared = readCustomProperty(key);

      expect(declared, `index.html declares no --tn-${key}`).not.toBeNull();
      expect(
        declared,
        `index.html --tn-${key} is ${String(declared)} but the config theme says ` +
          `${theme?.[key] ?? '(absent)'}. Update index.html, or drop the literal.`,
      ).toBe(theme?.[key]?.toLowerCase());
    },
  );

  it('tints the browser chrome with the config sky, not a stale literal', () => {
    expect(readThemeColorMeta()).toBe(theme?.sky.toLowerCase());
  });

  it.each(CANVAS_ONLY_KEYS)('does not copy %s into the page', (key) => {
    expect(readCustomProperty(key)).toBeNull();
  });

  it('keeps the built-in fallback usable as a page colour too', () => {
    // Every pre-boot key exists on the renderer's fallback, so a config without
    // a theme still leaves index.html and the canvas describing the same scene.
    for (const key of PRE_BOOT_KEYS) {
      expect(DEFAULT_PALETTE[key]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
