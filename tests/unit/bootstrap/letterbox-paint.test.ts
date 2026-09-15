import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Where the page paints the letterbox, and with what (ADR-0044).
 *
 * On a phone taller than 9:16 the canvas is letterboxed, and the band above it
 * is page, not canvas. A live-site audit found that band a different colour from
 * the sky under it on every level, and still bright while a card had dimmed the
 * level. Two facts about `index.html` fix both, and a restyle could quietly undo
 * either one, so both are read here:
 *
 *  - the band is painted with `--tn-sky-top`, the colour the scene reports for
 *    the canvas's first row, not the tinted `--tn-sky`;
 *  - it is painted inside `#game`, the element ADR-0041 dims, not on `body`.
 */

const read = (path: string): string =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

const INDEX_HTML = read('../../../index.html');
const SCREEN_STYLES = read('../../../app/ui/screen-styles.ts');

/** The page's own stylesheet, with comments removed so a rule is read and not a sentence about it. */
const CSS = (/<style>([\s\S]*?)<\/style>/u.exec(INDEX_HTML)?.[1] ?? '').replace(
  /\/\*[\s\S]*?\*\//gu,
  '',
);

/** The declarations of the first rule whose whole selector is `selector`, or `null`. */
const ruleBody = (selector: string): string | null => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`(?:^|[}\\s])${escaped}\\s*\\{([^}]*)\\}`, 'u').exec(CSS)?.[1] ?? null;
};

describe('index.html letterbox', () => {
  it('reads a stylesheet at all', () => {
    expect(CSS.length, 'index.html has no <style> block to read').toBeGreaterThan(0);
  });

  it('paints the sky and ground ramp inside #game, where the dim reaches it', () => {
    const paint = ruleBody('#game::before');
    expect(paint, 'index.html has no #game::before rule').not.toBeNull();
    expect(paint).toContain('linear-gradient');
    /* Under the canvas, and never in the way of a tap. */
    expect(paint).toMatch(/z-index:\s*-1\s*;/u);
    expect(paint).toMatch(/pointer-events:\s*none\s*;/u);
  });

  it('paints nothing but a flat page colour on body', () => {
    const body = ruleBody('body');
    expect(body, 'index.html has no body rule').not.toBeNull();
    expect(body, 'a gradient on body is outside #game, so a card cannot dim it').not.toContain(
      'linear-gradient',
    );
    expect(body).toContain('background-color');
  });

  it('starts the ramp with the colour of the canvas\'s first row, not the tinted sky', () => {
    const paint = ruleBody('#game::before') ?? '';
    expect(paint).toMatch(/var\(--tn-sky-top\)\s+0\s*,\s*var\(--tn-sky-top\)\s+var\(--tn-canvas-top\)/u);
    expect(paint).not.toMatch(/var\(--tn-sky\)/u);
  });

  it('reaches under the notch and the home indicator, not only across #game', () => {
    const paint = ruleBody('#game::before') ?? '';
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(paint, `#game::before stops at the ${side} safe-area inset`).toMatch(
        new RegExp(`${side}:\\s*calc\\(-1 \\* var\\(--tn-safe-${side}\\)\\)\\s*;`, 'u'),
      );
    }
  });

  it('before boot, takes the first row to be the boot scene\'s sky', () => {
    expect(CSS).toMatch(/--tn-sky-top:\s*var\(--tn-sky\)\s*;/u);
  });

  it('is dimmed by a rule on #game itself, which is what makes painting inside it enough', () => {
    /* If the dim moves to the canvas alone, the band above it stays bright again. */
    expect(SCREEN_STYLES).toMatch(/#game \{ filter: brightness\(/u);
  });
});
