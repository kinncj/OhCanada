import { describe, expect, it } from 'vitest';

import { injectScreenStyles } from '@ui/screen-styles';

import { buildPage } from './support/fake-dom';

/**
 * ADR-0040, amended after the third live-site audit.
 *
 * The creator's picture was 100 x 240 CSS px at every text size: a player who
 * asked for 200 % text got every word twice the size and a thumbnail that had
 * not moved. It grows with the text now, and is capped against the window so it
 * can never take the screen from the options it exists to illustrate.
 *
 * The size on screen is measured in `tests/a11y/creator-preview.spec.ts`; what
 * a unit test can hold is the rule in the sheet.
 */

const sheet = (): string => injectScreenStyles(buildPage().document).textContent ?? '';

const rule = (selector: string): string => {
  const css = sheet();
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `the sheet has no ${selector} rule`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('}', start)).replace(/\s+/g, ' ');
};

describe("the creator's picture", () => {
  it('is sized in rem, so it grows with the text like the words beside it', () => {
    const art = rule('.tn-creator__art');
    expect(art).toContain('inline-size: min(6.25rem, 40vw)');
    /* 6.25rem is the 100 px the audit measured at 100 % text: nothing about a
       phone at 100 % changes, and 200 % text asks for twice as much. */
    expect(art, 'the picture is pinned to a pixel size again').not.toMatch(/inline-size:\s*\d+px/);
  });

  it('is capped by the window, so it never crowds out the options', () => {
    /* 40vw is the cap the growth runs into on a phone: the picture may take
       two fifths of the width and no more, whatever the text scale is. */
    expect(rule('.tn-creator__art')).toContain('40vw');
  });

  it('keeps the figure\'s proportions, crown to soles, at every size', () => {
    const art = rule('.tn-creator__art');
    /* 5/12 is 100 x 240, the window ADR-0040 chose; one length and a ratio
       cannot drift apart the way two lengths can. */
    expect(art).toContain('aspect-ratio: 5 / 12');
    expect(art).toContain('block-size: auto');
  });
});
