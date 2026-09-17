import { describe, expect, it } from 'vitest';

import { injectScreenStyles } from '@ui/screen-styles';

import { buildPage } from './support/fake-dom';

/**
 * The third live-site audit's two findings about the HUD, held in the sheet.
 *
 *  1. The mode label ("Walking", "Sledding") ended 6 px from the bottom of the
 *     window and read as a word clipped by the edge.
 *  2. On a 1440 px desktop the strip spanned the whole window while the
 *     playfield was 506 px, so Settings and Menu sat far from the game.
 *
 * What a unit test can prove is what the stylesheet *says*; the geometry — the
 * label inside the strip, the strip no wider than the canvas — is measured in a
 * real browser by `tests/a11y/readability.spec.ts`, where it can fail.
 */

const sheet = (): string => injectScreenStyles(buildPage().document).textContent ?? '';

/** The `.tn-hud` rule itself, and not the rules for what is inside it. */
const hudBlock = (): string => {
  const css = sheet();
  const start = css.indexOf('\n.tn-hud {');
  expect(start, 'the sheet has no .tn-hud block').toBeGreaterThan(-1);
  const end = css.indexOf('}', start);
  return css.slice(start, end);
};

const declaration = (block: string, property: string): string =>
  new RegExp(`(?:^|[;{\\s])${property}:([^;]*);`).exec(block)?.[1]?.replace(/\s+/g, ' ').trim() ?? '';

describe('the strip has a foot as deep as its sides', () => {
  it('pads the bottom by the gutter the left and the right already use', () => {
    const padding = declaration(hudBlock(), 'padding');
    const gutter = 'max(calc(0.875rem / var(--tn-text-scale, 1)), env(safe-area-inset';
    expect(padding.startsWith('calc(0.375rem / var(--tn-text-scale, 1))')).toBe(true);
    /* Right, bottom, left: one gutter all the way round, so the last line in
       the strip is not read as a word cut off by the edge of the window. */
    expect(padding.split(gutter)).toHaveLength(4);
    expect(padding).toContain('env(safe-area-inset-bottom, 0px)');
  });

  it('holds that gutter still at large text, so 200 % text loses no line to it', () => {
    /* ADR-0039: the space around the words holds still; the words grow. */
    const padding = declaration(hudBlock(), 'padding');
    expect(padding.match(/var\(--tn-text-scale, 1\)/g) ?? []).toHaveLength(4);
  });
});

describe('the strip is as wide as the playfield, not as wide as the window', () => {
  it('takes the canvas column: the measured canvas height at the design ratio', () => {
    const block = hudBlock();
    /* 9/16 is 1080 x 1920 (ADR-0002), and the fallback is the window's own
       height, so a page that publishes no measurement still gets a column. */
    expect(declaration(block, 'inline-size')).toBe(
      'min(100%, calc(var(--tn-canvas-height, 100dvh) * 9 / 16))',
    );
  });

  it('centres what is left over, so the strip sits under the canvas', () => {
    expect(declaration(hudBlock(), 'margin-inline')).toBe('auto');
    /* Both edges are still pinned: with `inline-size` and auto margins that is
       what centres an absolutely positioned box. */
    expect(declaration(hudBlock(), 'inset-inline')).toBe('0');
  });

  it('never shrinks a phone: the column is wider than a portrait window', () => {
    /* min(100%, …) is the whole claim — 100 % on a phone, the column on a
       desktop — so the rule is written with `min` and never with a breakpoint. */
    expect(declaration(hudBlock(), 'inline-size').startsWith('min(100%,')).toBe(true);
  });
});
