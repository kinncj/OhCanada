/**
 * ADR-0066 §1: no stack names `system-ui` or any device font.
 *
 * Two halves. The ESLint rule in eslint.config.js refuses the seven family names
 * that ADR removed, in any string under app/ and common/. This file is the
 * positive half: every `font-family` the game declares, in the screen sheet, in
 * index.html and on the canvas, is exactly one of the two bundled stacks. A new
 * device name that is not on the ESLint list, "Helvetica Neue" or "Noto Sans",
 * fails here because it is not on the allowlist, not because someone thought
 * to deny it.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  DYSLEXIA_FACE,
  DYSLEXIA_STACK,
  UI_FACE,
  UI_FALLBACK_FACE,
  UI_STACK,
} from '@common/type-faces';
import { SCREEN_STYLES_CSS } from '@ui/screen-styles';
import { FACE_URLS, FALLBACK_SIZE_ADJUST, TYPE_FACES_CSS } from '@ui/type-faces';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(`../../../${relative}`, import.meta.url)), 'utf8');

/** The seven names ADR-0066 §1 removed, and the two the old canvas stack added. */
const DEVICE_FAMILIES = [
  'system-ui',
  '-apple-system',
  'Segoe UI',
  'Roboto',
  'Comic Sans MS',
  'Verdana',
  'Tahoma',
  'Helvetica Neue',
] as const;

/** Every `font-family:` value in a stylesheet, outside `@font-face` blocks. */
function declaredStacks(css: string): string[] {
  const withoutFaces = css.replace(/@font-face\s*\{[^}]*\}/gu, '');
  return [...withoutFaces.matchAll(/font-family:\s*([^;]+);/gu)].map((match) =>
    (match[1] ?? '').replace(/\s+/gu, ' ').trim(),
  );
}

describe('the bundled stacks', () => {
  it('are the bundled face, the game’s own fallback face, then the generic, and nothing else', () => {
    expect(UI_STACK).toBe('"Atkinson Hyperlegible", "TrueNorth Text Fallback", sans-serif');
    expect(DYSLEXIA_STACK).toBe(
      '"OpenDyslexic", "Atkinson Hyperlegible", "TrueNorth Text Fallback", sans-serif',
    );
  });
});

describe('every font-family the game declares is a bundled stack', () => {
  it('in the screen stylesheet: the UI stack for screens and the HUD, the dyslexia stack under the toggle', () => {
    const stacks = declaredStacks(SCREEN_STYLES_CSS);
    expect(stacks.length, 'the sheet declares no font-family at all').toBeGreaterThanOrEqual(2);
    for (const stack of stacks) expect([UI_STACK, DYSLEXIA_STACK]).toContain(stack);
    expect(stacks).toContain(UI_STACK);
    expect(stacks).toContain(DYSLEXIA_STACK);
  });

  it('under [data-tn-font="dyslexia"] only the dyslexia stack, and outside it only the UI stack', () => {
    const rules = [...SCREEN_STYLES_CSS.matchAll(/([^{}]+)\{([^{}]*font-family:[^{}]*)\}/gu)];
    expect(rules.length).toBeGreaterThan(0);
    for (const [, selector = '', body = ''] of rules) {
      const stack = declaredStacks(`${body};`)[0];
      const expected = selector.includes('data-tn-font="dyslexia"') ? DYSLEXIA_STACK : UI_STACK;
      expect(stack, selector.trim()).toBe(expected);
    }
  });

  it('in index.html, character for character the UI stack', () => {
    const stacks = declaredStacks(read('index.html'));
    expect(stacks).toEqual([UI_STACK]);
  });

  it('on the canvas: BootScene draws in the UI stack and names no family of its own', () => {
    const scene = read('app/adapters/phaser/boot-scene.ts');
    expect(scene).toContain('const FONT_STACK = UI_STACK;');
    const families = [...scene.matchAll(/fontFamily:\s*([^,\n]+)/gu)].map((match) => (match[1] ?? '').trim());
    expect(families.length).toBeGreaterThan(0);
    for (const family of families) expect(family).toBe('FONT_STACK');
  });

  for (const file of ['app/ui/screen-styles.ts', 'app/adapters/phaser/boot-scene.ts', 'index.html', 'common/type-faces.ts']) {
    it(`${file} names no device family anywhere, comments included`, () => {
      const source = read(file);
      for (const family of DEVICE_FAMILIES) expect(source, family).not.toContain(family);
    });
  }
});

describe('the @font-face rules', () => {
  const faces = [...TYPE_FACES_CSS.matchAll(/@font-face\s*\{([^}]*)\}/gu)].map((match) => match[1] ?? '');
  const descriptor = (body: string, name: string): string =>
    new RegExp(`${name}:\\s*([^;]+);`, 'u').exec(body)?.[1]?.trim() ?? '';

  it('declare each bundled family at 400 and 700 only, from its own file, with font-display: swap', () => {
    const bundled = faces.filter((body) => descriptor(body, 'src').startsWith('url('));
    const seen = bundled.map((body) => `${descriptor(body, 'font-family')} ${descriptor(body, 'font-weight')}`);
    expect(seen.sort()).toEqual(
      [`"${DYSLEXIA_FACE}" 400`, `"${DYSLEXIA_FACE}" 700`, `"${UI_FACE}" 400`, `"${UI_FACE}" 700`].sort(),
    );
    for (const body of bundled) {
      expect(descriptor(body, 'font-display')).toBe('swap');
      expect(descriptor(body, 'src')).toMatch(/format\("woff2"\)$/u);
    }
    for (const url of Object.values(FACE_URLS)) expect(TYPE_FACES_CSS).toContain(url);
  });

  it('give the fallback face its metric overrides, at both weights, from local faces only', () => {
    const fallbacks = faces.filter((body) => descriptor(body, 'font-family') === `"${UI_FALLBACK_FACE}"`);
    expect(fallbacks.map((body) => descriptor(body, 'font-weight')).sort()).toEqual(['400', '700']);
    for (const body of fallbacks) {
      expect(descriptor(body, 'src')).toMatch(/^local\(/u);
      expect(descriptor(body, 'src')).not.toContain('url(');
      expect(descriptor(body, 'size-adjust')).toBe(`${(FALLBACK_SIZE_ADJUST * 100).toFixed(2)}%`);
      /* Atkinson's 950/290 on a 1000 em, divided by size-adjust. */
      expect(descriptor(body, 'ascent-override')).toBe(`${((0.95 / FALLBACK_SIZE_ADJUST) * 100).toFixed(2)}%`);
      expect(descriptor(body, 'descent-override')).toBe(`${((0.29 / FALLBACK_SIZE_ADJUST) * 100).toFixed(2)}%`);
      expect(descriptor(body, 'line-gap-override')).toBe('0%');
    }
  });

  it('point at the four files under assets/src/fonts', () => {
    expect(Object.values(FACE_URLS).map((url) => url.replace(/^.*\/assets\/src\/fonts\//u, '')).sort()).toEqual([
      'atkinson-hyperlegible/AtkinsonHyperlegible-Bold.woff2',
      'atkinson-hyperlegible/AtkinsonHyperlegible-Regular.woff2',
      'opendyslexic/OpenDyslexic-Bold.woff2',
      'opendyslexic/OpenDyslexic-Regular.woff2',
    ]);
  });
});
