import { expect, test, type Page } from '@playwright/test';

import { HARNESS_URL } from './playwright.config';

/**
 * Tab lands where the player can see it, in a real Chromium.
 *
 * **The defect.** `app/ui/focus-trap.ts` owns Tab inside every modal screen and
 * moved focus with `focus({ preventScroll: true })`, so nothing scrolled. On the
 * character creator at this suite's 390 × 844 viewport every stop after the
 * first was measured between 1 106 px and 2 530 px down the page: the control
 * had focus, the focus ring was drawn, and neither was on screen. A keyboard
 * player pressing Tab saw a still page and no indication that anything had
 * happened, which is WCAG 2.4.7 (Focus Visible) failing in the only way that
 * matters — the indicator exists and cannot be seen.
 *
 * Only a real browser can prove this: it is layout, a scroll container and a
 * viewport. The unit suite proves the pairing — focus without the centring
 * jump, then `block: 'nearest'` — in `tests/unit/ui/focus-is-scrolled-into-view.test.ts`.
 *
 * Two screens, both languages: the creator, which is the longest screen in the
 * game, and Settings, which is the longest one with a save section on it. At
 * 200 % text as well, because that is where a screen that fitted stops fitting.
 * Reduced motion is scanned too — it removes the animation, never the scroll.
 */

type Locale = 'en' | 'fr';
type Harness = 'creator' | 'settings';

const ROOT: Readonly<Record<Harness, string>> = {
  creator: 'character-creator',
  settings: 'settings-screen',
};

interface Stop {
  /** `data-testid`, or the id or tag where a control carries none. */
  readonly id: string;
  readonly top: number;
  readonly bottom: number;
}

async function open(
  page: Page,
  screen: Harness,
  locale: Locale,
  extra: Readonly<Record<string, string>> = {},
): Promise<void> {
  const params = new URLSearchParams({ screen, locale, ...extra });
  const response = await page.goto(`${HARNESS_URL}?${params.toString()}`);
  expect(response, 'no response from the harness server').not.toBeNull();
  expect(response?.status()).toBeLessThan(400);
  await page.waitForSelector(`html[data-tn-harness-ready="${screen}"]`, { timeout: 15_000 });
  await expect(page.getByTestId(ROOT[screen])).toBeVisible();
}

/** Where the focused control sits, in the viewport's own coordinates. */
const focusedStop = (page: Page): Promise<Stop> =>
  page.evaluate(() => {
    const active = document.activeElement;
    if (active === null || active === document.body) {
      return { id: 'body', top: 0, bottom: 0 };
    }
    const box = active.getBoundingClientRect();
    return {
      id: active.getAttribute('data-testid') ?? (active.id !== '' ? active.id : active.tagName),
      top: box.top,
      bottom: box.bottom,
    };
  });

/**
 * Tab through a screen and report every stop.
 *
 * A generous number of presses: the creator has six groups, a randomiser, a
 * primary control and a back control, and the ring wraps, so twelve walks the
 * whole screen more than once — which is the case that used to leave the page
 * scrolled to the bottom with focus back at the top.
 */
async function walk(page: Page, presses: number): Promise<Stop[]> {
  const stops: Stop[] = [];
  for (let press = 0; press < presses; press += 1) {
    await page.keyboard.press('Tab');
    stops.push(await settled(page));
  }
  return stops;
}

/**
 * Where the focused control came to rest.
 *
 * **Polled, never waited out.** A smooth scroll of up to 2 500 px takes as long
 * as the engine decides to take, and a fixed wait is a test that passes on the
 * machine it was written on: too short and the rect is read mid-flight, too long
 * and every press pays for the slowest case. This reads the rect until two
 * consecutive samples agree, which is true immediately under reduced motion and
 * after the animation under full motion.
 */
async function settled(page: Page): Promise<Stop> {
  let last = await focusedStop(page);
  for (let sample = 0; sample < 40; sample += 1) {
    await page.waitForTimeout(50);
    const now = await focusedStop(page);
    if (now.id === last.id && now.top === last.top && now.bottom === last.bottom) return now;
    last = now;
  }
  return last;
}

/** Nothing focused may sit outside the viewport, in either direction. */
function expectEveryStopOnScreen(stops: readonly Stop[], height: number, label: string): void {
  const offScreen = stops.filter((stop) => stop.bottom <= 0 || stop.top >= height);
  expect(
    offScreen,
    `${label}: focus landed off screen (viewport 0..${String(height)}): ${JSON.stringify(offScreen, null, 2)}`,
  ).toEqual([]);
  expect(stops.filter((stop) => stop.id === 'body'), `${label}: focus fell to the body`).toEqual([]);
}

test.describe('Tab scrolls the focused control into view', () => {
  for (const locale of ['en', 'fr'] as const) {
    test(`the creator, ${locale}: every stop is on screen`, async ({ page }) => {
      await open(page, 'creator', locale);
      const height = page.viewportSize()?.height ?? 844;

      const stops = await walk(page, 12);

      expect(stops.length, 'no stop was measured').toBeGreaterThan(0);
      expectEveryStopOnScreen(stops, height, `creator, ${locale}`);
    });

    test(`the creator, ${locale}, at 200 %: every stop is on screen`, async ({ page }) => {
      await open(page, 'creator', locale, { textScale: '200' });
      const height = page.viewportSize()?.height ?? 844;

      const stops = await walk(page, 10);

      expectEveryStopOnScreen(stops, height, `creator, ${locale}, 200 %`);
    });

    test(`Settings with "Your progress", ${locale}: every stop is on screen`, async ({ page }) => {
      await open(page, 'settings', locale, { save: '1' });
      const height = page.viewportSize()?.height ?? 844;

      const stops = await walk(page, 14);

      expectEveryStopOnScreen(stops, height, `settings, ${locale}`);
    });
  }

  test('with less movement asked for, the scroll still happens — it only stops gliding', async ({
    page,
  }) => {
    await open(page, 'creator', 'en', { motion: 'reduced' });
    const height = page.viewportSize()?.height ?? 844;

    const stops = await walk(page, 10);

    expectEveryStopOnScreen(stops, height, 'creator, reduced motion');
  });

  test('a control already on screen is not jumped to the middle of it', async ({ page }) => {
    /* `block: 'nearest'` and not the browser's own centring: the first Tab on a
       screen that opens at the top must not move the page at all. */
    await open(page, 'settings', 'en');
    const before = await page.evaluate(
      () => document.querySelector('[data-testid="settings-screen"]')?.scrollTop ?? 0,
    );

    await page.keyboard.press('Tab');
    await settled(page);

    const after = await page.evaluate(
      () => document.querySelector('[data-testid="settings-screen"]')?.scrollTop ?? 0,
    );
    expect(after, 'the first Tab scrolled a screen that was already showing its first control').toBe(
      before,
    );
  });
});
