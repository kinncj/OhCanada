import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Slice 0 accessibility gates.
 *
 * Every DOM screen (question card, dialogue, menu, settings) gets an axe-core
 * scan; the Phaser canvas is excluded because it is `aria-hidden` by design and
 * announces through a live region instead.
 *
 * Two rules for everything in this file:
 *
 *  1. A skipped test must not be able to pass by default. `test.fixme` is fine
 *     while a screen does not exist, but the body has to start with an assertion
 *     that the screen is really there — otherwise deleting `.fixme` turns green
 *     instantly and the green tick means nothing.
 *  2. A state is only gated if some test puts the page *into* that state. The
 *     rotate overlay is invisible at the portrait viewport this suite defaults
 *     to, so it gets its own landscape scan below.
 */

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * `best-practice` is included deliberately. The WCAG rulesets do not check that
 * a `dialog` / `alertdialog` has an accessible name — that is axe's
 * `aria-dialog-name` rule, and it is tagged best-practice only. Without it the
 * rotate overlay could lose its `aria-labelledby` and this suite would stay
 * green, which is exactly the regression the landscape scan exists to catch.
 */
const RULESET = [...WCAG, 'best-practice'];

/**
 * A phone turned sideways: 844x390 is an iPhone 13 in landscape, whose short
 * side (390) is under the 600 px breakpoint, so `classifyViewport` returns
 * `landscape-phone` and the overlay shows. See `app/ui/viewport-mode.ts`.
 */
const LANDSCAPE_PHONE = { width: 844, height: 390 } as const;
const PORTRAIT_PHONE = { width: 390, height: 844 } as const;

const OVERLAY = '#tn-rotate-overlay';
const VISIBLE_OVERLAY = `${OVERLAY}:not([hidden])`;

const scan = (page: Page, tags: readonly string[] = WCAG) =>
  new AxeBuilder({ page }).withTags([...tags]).exclude('canvas');

const violationsOf = (results: { violations: unknown[] }) =>
  JSON.stringify(results.violations, null, 2);

/** What the browser reports as focused, in a form a failure message can name. */
const focusedDescriptor = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (el === null) return 'none';
    return el.id !== '' ? `#${el.id}` : el.tagName;
  });

test.describe('accessibility', () => {
  test('the served document is scannable and free of axe violations', async ({ page }) => {
    const response = await page.goto('./');

    expect(response, 'no response from vite preview').not.toBeNull();
    expect(response?.status()).toBeLessThan(400);

    const results = await scan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
  });

  /**
   * The only DOM screen slice 0 ships. It is `hidden` at the suite's portrait
   * viewport, so without this block axe never sees it and slice 1 could restyle
   * it into an unnamed dialog with CI still green.
   */
  test.describe('the rotate overlay, at a landscape phone viewport', () => {
    test.use({ viewport: LANDSCAPE_PHONE });

    test('is shown and has no axe violations', async ({ page }) => {
      await page.goto('./');

      /* Fails honestly if the overlay never appears, rather than scanning nothing. */
      const overlay = page.locator(VISIBLE_OVERLAY);
      await overlay.waitFor({ state: 'visible' });
      await expect
        .poll(() => page.evaluate(() => document.documentElement.dataset['tnMode']))
        .toBe('landscape-phone');

      const results = await scan(page, RULESET).analyze();
      expect(results.violations, violationsOf(results)).toEqual([]);

      /*
       * Asserted directly as well as through axe: axe cannot see a missing
       * `aria-describedby`, and the whole point of an alertdialog is that a
       * screen reader reads both the title and the instruction.
       */
      await expect(overlay).toHaveAccessibleName(/\S/);
      await expect(overlay).toHaveAccessibleDescription(/\S/);
    });

    test('contains focus: Tab and Shift+Tab cannot leave it', async ({ page }) => {
      await page.goto('./');
      const overlay = page.locator(VISIBLE_OVERLAY);
      await overlay.waitFor({ state: 'visible' });

      /* The overlay takes focus itself when it opens. */
      await expect
        .poll(() => focusedDescriptor(page))
        .toBe(OVERLAY);

      for (const key of ['Tab', 'Tab', 'Shift+Tab', 'Tab']) {
        await page.keyboard.press(key);
        expect(
          await focusedDescriptor(page),
          `focus escaped the modal after ${key}; aria-modal="true" without containment ` +
            'sends a keyboard user into controls behind a paused, covered screen',
        ).toBe(OVERLAY);
      }
    });

    test('makes the canvas host inert while it is up', async ({ page }) => {
      await page.goto('./');
      await page.locator(VISIBLE_OVERLAY).waitFor({ state: 'visible' });

      await expect
        .poll(() => page.evaluate(() => document.getElementById('game')?.inert ?? null))
        .toBe(true);

      /* The announcer stays perceivable: `inert` would strip it from the a11y tree. */
      expect(
        await page.evaluate(
          () => document.getElementById('tn-live-region')?.inert ?? null,
        ),
        'the live region must not be inert, or the game goes silent when it pauses',
      ).toBe(false);
    });
  });

  /**
   * The scenario the trap actually exists for: slice 1 adds a focusable control
   * over the canvas. Injected here rather than waited for, so the guarantee is
   * proved now instead of the first time someone ships a HUD button.
   */
  test('a focusable control behind the overlay is unreachable, and regains focus on dismiss', async ({
    page,
  }) => {
    await page.setViewportSize(PORTRAIT_PHONE);
    await page.goto('./');

    const hud = await addBackgroundButton(page);
    await hud.focus();
    expect(await focusedDescriptor(page)).toBe('#tn-test-hud');

    await page.setViewportSize(LANDSCAPE_PHONE);
    await page.locator(VISIBLE_OVERLAY).waitFor({ state: 'visible' });

    expect(
      await page.evaluate(() => document.getElementById('tn-test-hud')?.inert ?? null),
      'background controls must be inert while a modal is open',
    ).toBe(true);

    await page.keyboard.press('Tab');
    expect(
      await focusedDescriptor(page),
      'Tab reached a control behind the modal',
    ).toBe(OVERLAY);

    await page.setViewportSize(PORTRAIT_PHONE);
    await page.locator(OVERLAY).waitFor({ state: 'hidden' });

    expect(
      await page.evaluate(() => document.getElementById('tn-test-hud')?.inert ?? null),
      'inert must be lifted when the modal closes',
    ).toBe(false);
    expect(
      await focusedDescriptor(page),
      'a dismissed dialog returns focus to whatever had it before',
    ).toBe('#tn-test-hud');
  });

  /*
   * The screens below do not exist yet (slice 1). Each body starts by waiting
   * for the screen's own marker, so removing `test.fixme` before the screen is
   * built fails on that wait instead of passing against an empty shell. The
   * short timeout is so that mistake costs seconds, not a minute per test.
   */
  const NOT_BUILT_YET_MS = 5_000;

  test.fixme('the question card has no violations', async ({ page }) => {
    await page.goto('./#/question');
    await page.waitForSelector('[data-testid="question-card"]', { timeout: NOT_BUILT_YET_MS });
    const results = await scan(page, RULESET).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
  });

  test.fixme('the settings screen has no violations', async ({ page }) => {
    await page.goto('./#/settings');
    await page.waitForSelector('[data-testid="settings-screen"]', {
      timeout: NOT_BUILT_YET_MS,
    });
    const results = await scan(page, RULESET).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
  });

  /**
   * Touch targets are >= 44 CSS px (CLAUDE.md, Accessibility). Slice 0 ships no
   * interactive target, so this is `fixme` — but it measures for real and it
   * fails on an empty page, which is the point: `expect(0).toBe(0)` against a
   * page with nothing on it is a green tick that certifies nothing.
   */
  test.fixme('every interactive target is at least 44 CSS px', async ({ page }) => {
    await page.goto('./');
    /* Same marker `tests/perf` uses for "the game is playable". */
    await page.waitForSelector('[data-testid="playable"]', { timeout: NOT_BUILT_YET_MS });

    const targets = page.locator(
      'button, a[href], input:not([type="hidden"]), select, textarea, ' +
        '[role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="tab"]',
    );
    const count = await targets.count();
    expect(count, 'no interactive targets found — this test must not pass vacuously').toBeGreaterThan(0);

    const tooSmall: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const target = targets.nth(index);
      if (!(await target.isVisible())) continue;
      const box = await target.boundingBox();
      if (box === null) continue;
      if (box.width < 44 || box.height < 44) {
        const name = await target.evaluate(
          (el) => `${el.tagName.toLowerCase()}${el.id === '' ? '' : `#${el.id}`}`,
        );
        tooSmall.push(`${name} ${Math.round(box.width)}x${Math.round(box.height)}`);
      }
    }

    expect(tooSmall, tooSmall.join(', ')).toEqual([]);
  });
});

/**
 * Stands in for the HUD button slice 1 will add over the canvas. It goes inside
 * `#ui`, which is where every DOM screen lives, so it is a sibling of the
 * overlay and therefore exactly what the trap has to neutralise.
 */
async function addBackgroundButton(page: Page): Promise<Locator> {
  await page.evaluate(() => {
    const host = document.getElementById('ui');
    if (host === null) throw new Error('index.html is missing #ui');
    const button = document.createElement('button');
    button.id = 'tn-test-hud';
    button.type = 'button';
    button.textContent = 'Menu';
    button.setAttribute('style', 'position:fixed;top:0;left:0;width:44px;height:44px;');
    host.append(button);
  });
  return page.locator('#tn-test-hud');
}
