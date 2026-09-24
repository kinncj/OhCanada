import { describe, expect, it } from 'vitest';

import { whenFacesReady, type FontLoader } from '@adapters/phaser/font-ready';

/**
 * The canvas waits for the UI face before it creates text, and never waits
 * forever (ADR-0066 §1). A Phaser Text is rasterised once, so text created
 * before the face arrives stays in the fallback for good.
 */

const loader = (faces: Record<string, number>, delay = 0): FontLoader & { readonly asked: string[] } => {
  const asked: string[] = [];
  return {
    asked,
    load: (font) => {
      asked.push(font);
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(Array.from({ length: faces[font] ?? 0 }, () => ({})));
        }, delay);
      });
    },
  };
};

describe('whenFacesReady', () => {
  it('resolves true once every face asked for has loaded, having asked for exactly those', async () => {
    const fonts = loader({ '700 104px "Atkinson Hyperlegible"': 1, '400 44px "Atkinson Hyperlegible"': 1 });
    const ready = await whenFacesReady(
      fonts,
      ['700 104px "Atkinson Hyperlegible"', '400 44px "Atkinson Hyperlegible"'],
      1000,
    );
    expect(ready).toBe(true);
    expect(fonts.asked).toEqual(['700 104px "Atkinson Hyperlegible"', '400 44px "Atkinson Hyperlegible"']);
  });

  it('resolves false when a face has no declared match, so the caller draws in the fallback', async () => {
    const fonts = loader({ '700 104px "Atkinson Hyperlegible"': 1 });
    expect(
      await whenFacesReady(fonts, ['700 104px "Atkinson Hyperlegible"', '400 44px "Atkinson Hyperlegible"'], 1000),
    ).toBe(false);
  });

  it('resolves false when loading fails outright', async () => {
    const failing: FontLoader = { load: () => Promise.reject(new Error('blocked')) };
    expect(await whenFacesReady(failing, ['400 44px "Atkinson Hyperlegible"'], 1000)).toBe(false);
  });

  it('resolves false at the timeout rather than holding the title back forever', async () => {
    const slow = loader({ '400 44px "Atkinson Hyperlegible"': 1 }, 200);
    const started = Date.now();
    expect(await whenFacesReady(slow, ['400 44px "Atkinson Hyperlegible"'], 20)).toBe(false);
    expect(Date.now() - started).toBeLessThan(180);
  });

  it('resolves false with no font set at all, and with nothing to wait for', async () => {
    expect(await whenFacesReady(undefined, ['400 44px "Atkinson Hyperlegible"'], 1000)).toBe(false);
    expect(await whenFacesReady(loader({}), [], 1000)).toBe(false);
  });

  it('clears its timer once the faces arrive, so a finished wait leaves nothing scheduled', async () => {
    const scheduled = new Set<number>();
    let next = 0;
    const timers = {
      set: (): number => {
        next += 1;
        scheduled.add(next);
        return next;
      },
      clear: (handle: unknown): void => {
        scheduled.delete(handle as number);
      },
    };
    expect(await whenFacesReady(loader({ a: 1 }), ['a'], 1000, timers)).toBe(true);
    expect(scheduled.size).toBe(0);
  });
});
