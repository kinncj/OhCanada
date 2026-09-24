import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { text } from '@ui/copy';

import { focusedTestId } from './focus';
import { HARNESS_URL } from './playwright.config';

/**
 * "Read about this" in a real browser — `docs/stories/TN-TEACHBACK-read-about-this.md`,
 * ADR-0070.
 *
 * The card and the exam review, each with a reading handed to it, in both
 * languages, at 100 % and 200 % text: axe finds nothing, nothing is clipped or
 * scrolls sideways, every target is at least 44 CSS px, the control is a named
 * button that appears only after the answer, and closing the reader puts focus
 * back on it. Every test waits for its own marker first, so a missing screen
 * fails on the wait rather than passing against an empty page.
 *
 * The prose is the harness's fixture, never content: what reaches the card in
 * the game is resolved in `app/application` and localised in `app/bootstrap`,
 * and `tests/e2e/read-about-this.spec.ts` walks that route in the built game.
 */

const RULESET = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];
/* One modal alone over an `aria-hidden` canvas has no page landmarks; see `slice1-screens.spec.ts`. */
const DISABLED = ['region', 'landmark-one-main'];

const scan = (page: Page) =>
  new AxeBuilder({ page }).withTags(RULESET).disableRules(DISABLED).exclude('canvas');
const violationsOf = (results: { violations: unknown[] }) => JSON.stringify(results.violations, null, 2);

interface Options {
  readonly screen: 'card' | 'exam-result';
  readonly locale?: 'en' | 'fr';
  readonly textScale?: 100 | 200;
  readonly answered?: number;
  readonly read?: '1' | 'open';
  readonly over?: 'review';
  readonly switchOn?: boolean;
  readonly contrast?: 'high';
}

async function open(page: Page, options: Options): Promise<void> {
  const params = new URLSearchParams({ screen: options.screen });
  if (options.locale !== undefined) params.set('locale', options.locale);
  if (options.textScale !== undefined) params.set('textScale', String(options.textScale));
  if (options.answered !== undefined) params.set('answered', String(options.answered));
  if (options.read !== undefined) params.set('read', options.read);
  if (options.over !== undefined) params.set('over', options.over);
  if (options.switchOn === true) params.set('switch', '1');
  if (options.contrast !== undefined) params.set('contrast', options.contrast);
  const response = await page.goto(`${HARNESS_URL}?${params.toString()}`);
  expect(response?.status()).toBeLessThan(400);
  await page.waitForSelector(`html[data-tn-harness-ready="${options.screen}"]`, { timeout: 15_000 });
}

async function undersizedTargets(page: Page): Promise<string[]> {
  const targets = page.locator('button, a[href], [role="button"]');
  const count = await targets.count();
  expect(count, 'no interactive targets found — this must not pass vacuously').toBeGreaterThan(0);
  const tooSmall: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const target = targets.nth(index);
    if (!(await target.isVisible())) continue;
    const box = await target.boundingBox();
    if (box === null) continue;
    if (box.width < 44 || box.height < 44) {
      const name = await target.getAttribute('data-testid');
      tooSmall.push(`${String(name)} ${String(Math.round(box.width))}x${String(Math.round(box.height))}`);
    }
  }
  return tooSmall;
}

const scrollsSideways = (page: Page): Promise<boolean> =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

const clippedLabels = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const bad: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>(
      '.tn-screen:not([hidden]) h1, .tn-screen:not([hidden]) p, .tn-screen:not([hidden]) button',
    )) {
      if (element.scrollWidth > element.clientWidth + 1) {
        bad.push(`${element.tagName}: ${(element.textContent ?? '').slice(0, 40)}`);
      }
    }
    return bad;
  });

const READ = '[data-testid="question-read-about"]';
const READER = '[data-testid="lesson-reader"]';

test.describe('"Read about this" on the question card', () => {
  test('is not offered before the answer, even with a reading in hand', async ({ page }) => {
    await open(page, { screen: 'card', read: '1' });
    await expect(page.locator('[data-testid="question-card"]')).toBeVisible();
    await expect(page.locator(READ)).toBeHidden();
  });

  for (const locale of ['en', 'fr'] as const) {
    for (const textScale of [100, 200] as const) {
      test(`${locale} ${String(textScale)} %: offered after the answer, and axe finds nothing`, async ({
        page,
      }) => {
        await open(page, { screen: 'card', locale, textScale, answered: 1, read: '1' });
        const control = page.locator(READ);
        await expect(control).toBeVisible();
        await expect(control).toHaveRole('button');
        await expect(control).toHaveAccessibleName(text(locale, 'card.readAbout'));
        const results = await scan(page).analyze();
        expect(results.violations, violationsOf(results)).toEqual([]);
        expect(await scrollsSideways(page)).toBe(false);
        expect(await clippedLabels(page)).toEqual([]);
        expect(await undersizedTargets(page)).toEqual([]);
      });

      test(`${locale} ${String(textScale)} %: the reader it opens passes, and fits`, async ({ page }) => {
        await open(page, { screen: 'card', locale, textScale, answered: 1, read: 'open' });
        await expect(page.locator(READER)).toBeVisible();
        await expect(page.locator(READER)).toHaveAttribute('lang', locale);
        const results = await scan(page).analyze();
        expect(results.violations, violationsOf(results)).toEqual([]);
        expect(await scrollsSideways(page)).toBe(false);
        expect(await clippedLabels(page)).toEqual([]);
        expect(await undersizedTargets(page)).toEqual([]);
      });
    }
  }

  test('offers no control when there is nothing to read — not a disabled one', async ({ page }) => {
    await open(page, { screen: 'card', answered: 1 });
    await expect(page.locator('[data-testid="question-next"]')).toBeVisible();
    await expect(page.locator(READ)).toBeHidden();
    await expect(page.locator(`${READ}[aria-disabled]`)).toHaveCount(0);
  });

  test('works by keyboard alone, and Escape returns focus to the control', async ({ page }) => {
    await open(page, { screen: 'card', answered: 1, read: '1' });
    await page.locator(READ).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator(READER)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator(READER)).toBeHidden();
    await expect(page.locator('[data-testid="question-card"]')).toBeVisible();
    expect(await focusedTestId(page)).toBe('question-read-about');
  });

  test('works on one switch: tap to move, hold to choose, and the highlight comes back', async ({
    page,
  }) => {
    await open(page, { screen: 'card', answered: 1, read: '1', switchOn: true });
    const tap = async (heldMs: number): Promise<void> => {
      await page.mouse.move(195, 100);
      await page.mouse.down();
      await page.waitForTimeout(heldMs);
      await page.mouse.up();
    };
    for (let step = 0; step < 6 && (await focusedTestId(page)) !== 'question-read-about'; step += 1) {
      await tap(20);
    }
    expect(await focusedTestId(page)).toBe('question-read-about');
    await tap(900);
    await expect(page.locator(READER)).toBeVisible();
    for (let step = 0; step < 6 && (await focusedTestId(page)) !== 'lesson-reader-close'; step += 1) {
      await tap(20);
    }
    await tap(900);
    await expect(page.locator(READER)).toBeHidden();
    expect(await focusedTestId(page)).toBe('question-read-about');
  });
});

test.describe('"Read about this" in the exam review', () => {
  for (const locale of ['en', 'fr'] as const) {
    test(`${locale}: offered on items with a reading, Back first, and axe finds nothing`, async ({
      page,
    }) => {
      await open(page, { screen: 'exam-result', locale, over: 'review', read: '1', contrast: 'high' });
      const review = page.locator('[data-testid="exam-review"]');
      await expect(review).toBeVisible();
      await expect(page.locator('[data-testid="exam-review-read-about-0"]')).toBeVisible();
      await expect(page.locator('[data-testid="exam-review-read-about-1"]')).toHaveCount(0);
      /* TN-RESULT-09: the way out is the first control, so a switch never walks every item first. */
      await expect(review.locator('button').first()).toHaveAttribute('data-testid', 'exam-review-back');
      const results = await scan(page).analyze();
      expect(results.violations, violationsOf(results)).toEqual([]);
      expect(await undersizedTargets(page)).toEqual([]);
    });
  }

  test('fr 200 %: the reader over the review passes and fits', async ({ page }) => {
    await open(page, {
      screen: 'exam-result',
      locale: 'fr',
      textScale: 200,
      over: 'review',
      read: 'open',
    });
    await expect(page.locator(READER)).toBeVisible();
    const results = await scan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
    expect(await scrollsSideways(page)).toBe(false);
    expect(await clippedLabels(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.locator(READER)).toBeHidden();
    await expect(page.locator('[data-testid="exam-review"]')).toBeVisible();
    expect(await focusedTestId(page)).toBe('exam-review-read-about-0');
  });
});
