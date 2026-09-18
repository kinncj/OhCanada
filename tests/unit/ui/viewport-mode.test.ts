import { describe, expect, it } from 'vitest';

import {
  PHONE_SHORT_SIDE_PX,
  classifyAudience,
  classifyViewport,
  shouldShowPortraitNotice,
  shouldShowRotateOverlay,
  type ViewportAudience,
  type ViewportMode,
} from '@ui/viewport-mode';

/**
 * The orientation decision is pure on purpose: it is the one rule in the boot
 * path that has to be right on every device, and it must be provable without a
 * browser (ADR-0002, ADR-0005).
 */
describe('classifyViewport', () => {
  const cases: ReadonlyArray<readonly [string, number, number, ViewportMode]> = [
    ['iPhone 13 portrait', 390, 844, 'portrait'],
    ['iPhone 15 Pro Max portrait', 430, 932, 'portrait'],
    ['small Android portrait', 320, 568, 'portrait'],
    ['iPad portrait', 768, 1024, 'portrait'],
    ['desktop window taller than wide', 900, 1400, 'portrait'],
    ['iPhone 13 landscape', 844, 390, 'landscape-phone'],
    ['small Android landscape', 568, 320, 'landscape-phone'],
    ['iPad landscape', 1024, 768, 'wide'],
    ['iPad Pro landscape', 1366, 1024, 'wide'],
    ['desktop', 1440, 900, 'wide'],
    ['ultrawide desktop', 3440, 1440, 'wide'],
  ];

  for (const [name, width, height, expected] of cases) {
    it(`classifies ${name} (${width}x${height}) as ${expected}`, () => {
      expect(classifyViewport(width, height)).toBe(expected);
    });
  }

  it('treats a square viewport as portrait, because portrait is the only layout', () => {
    expect(classifyViewport(800, 800)).toBe('portrait');
  });

  it('uses the short side, not the height, so the breakpoint is orientation-free', () => {
    // Exactly on the breakpoint is still a phone: the overlay is the safe default.
    expect(classifyViewport(1000, PHONE_SHORT_SIDE_PX)).toBe('landscape-phone');
    expect(classifyViewport(1000, PHONE_SHORT_SIDE_PX + 1)).toBe('wide');
  });

  it('honours a caller-supplied breakpoint', () => {
    expect(classifyViewport(1024, 768, 800)).toBe('landscape-phone');
    expect(classifyViewport(1024, 768, 700)).toBe('wide');
  });

  it('falls back to portrait for degenerate viewports rather than pausing the game', () => {
    expect(classifyViewport(0, 0)).toBe('portrait');
    expect(classifyViewport(Number.NaN, 844)).toBe('portrait');
    expect(classifyViewport(844, Number.POSITIVE_INFINITY)).toBe('portrait');
    expect(classifyViewport(-100, -200)).toBe('portrait');
  });

  it('ignores a nonsensical breakpoint instead of throwing', () => {
    expect(classifyViewport(844, 390, Number.NaN)).toBe('landscape-phone');
    expect(classifyViewport(844, 390, -1)).toBe('landscape-phone');
  });
});

describe('shouldShowRotateOverlay', () => {
  it('is true only for a phone held in landscape', () => {
    expect(shouldShowRotateOverlay('landscape-phone')).toBe(true);
    expect(shouldShowRotateOverlay('portrait')).toBe(false);
    expect(shouldShowRotateOverlay('wide')).toBe(false);
  });
});

/**
 * Who is playing, as opposed to how the game is laid out (ADR-0060).
 *
 * The cases below are the ones the decision is *about*: a tablet held upright is
 * the interesting one, because `classifyViewport` calls it `portrait` — rightly,
 * it gets the design layout — and it is still not a phone.
 */
describe('classifyAudience', () => {
  const cases: ReadonlyArray<readonly [string, number, number, ViewportAudience]> = [
    ['iPhone 13 portrait', 390, 844, 'phone-portrait'],
    ['iPhone 15 Pro Max portrait', 430, 932, 'phone-portrait'],
    ['small Android portrait', 320, 568, 'phone-portrait'],
    ['iPhone 13 landscape', 844, 390, 'phone-landscape'],
    ['small Android landscape', 568, 320, 'phone-landscape'],
    /* The four the notice exists for. Two of them are `portrait` above. */
    ['iPad portrait', 768, 1024, 'large'],
    ['desktop window taller than wide', 900, 1400, 'large'],
    ['iPad landscape', 1024, 768, 'large'],
    ['desktop', 1440, 900, 'large'],
    ['ultrawide desktop', 3440, 1440, 'large'],
  ];

  for (const [name, width, height, expected] of cases) {
    it(`classifies ${name} (${width}x${height}) as ${expected}`, () => {
      expect(classifyAudience(width, height)).toBe(expected);
    });
  }

  it('splits an upright device on the same short side the layout rule uses', () => {
    /* Exactly on the breakpoint is still a phone, matching `classifyViewport`. */
    expect(classifyAudience(PHONE_SHORT_SIDE_PX, 1200)).toBe('phone-portrait');
    expect(classifyAudience(PHONE_SHORT_SIDE_PX + 1, 1200)).toBe('large');
  });

  it('honours a caller-supplied breakpoint, as the layout rule does', () => {
    expect(classifyAudience(768, 1024, 800)).toBe('phone-portrait');
    expect(classifyAudience(768, 1024, 700)).toBe('large');
  });

  it('treats a square viewport as the phone it might be, and says nothing', () => {
    expect(classifyAudience(500, 500)).toBe('phone-portrait');
  });

  it('falls back to the phone for degenerate viewports rather than nagging', () => {
    expect(classifyAudience(0, 0)).toBe('phone-portrait');
    expect(classifyAudience(Number.NaN, 844)).toBe('phone-portrait');
    expect(classifyAudience(844, Number.POSITIVE_INFINITY)).toBe('phone-portrait');
    expect(classifyAudience(-100, -200)).toBe('phone-portrait');
  });

  it('ignores a nonsensical breakpoint instead of throwing', () => {
    expect(classifyAudience(844, 390, Number.NaN)).toBe('phone-landscape');
    expect(classifyAudience(1440, 900, -1)).toBe('large');
  });
});

describe('shouldShowPortraitNotice', () => {
  it('is true only for a desktop, a laptop or a tablet', () => {
    expect(shouldShowPortraitNotice('large')).toBe(true);
    expect(shouldShowPortraitNotice('phone-portrait')).toBe(false);
    expect(shouldShowPortraitNotice('phone-landscape')).toBe(false);
  });

  /**
   * The rule the whole design exists to keep: a player is never both paused by
   * the rotate overlay and nudged by the notice.
   *
   * Swept over a grid rather than asserted on three examples, because the way
   * this breaks is a breakpoint moving in one function and not the other — which
   * no hand-picked example would catch, and which shows up here at exactly the
   * viewport where the two disagree.
   */
  it('is never true at a viewport where the rotate overlay is, at any size', () => {
    const sizes = [0, 1, 200, 319, 320, 390, 430, 599, 600, 601, 768, 844, 1024, 1440, 3440];
    const both: string[] = [];
    for (const width of sizes) {
      for (const height of sizes) {
        const overlay = shouldShowRotateOverlay(classifyViewport(width, height));
        const notice = shouldShowPortraitNotice(classifyAudience(width, height));
        if (overlay && notice) both.push(`${width}x${height}`);
      }
    }
    expect(both, `both shown at: ${both.join(', ')}`).toEqual([]);
  });

  it('says nothing to the device the game is made for, at any phone size', () => {
    for (const [width, height] of [
      [320, 568],
      [360, 640],
      [390, 844],
      [430, 932],
      [414, 896],
    ] as const) {
      expect(shouldShowPortraitNotice(classifyAudience(width, height))).toBe(false);
    }
  });
});
