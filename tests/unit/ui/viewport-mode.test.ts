import { describe, expect, it } from 'vitest';

import {
  PHONE_SHORT_SIDE_PX,
  classifyViewport,
  shouldShowRotateOverlay,
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
