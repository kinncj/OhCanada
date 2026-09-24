import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { text } from '@ui/copy';

import { seed, settingsSave, type ReadingSettings } from '../e2e/saves';

import { focusedTestId } from './focus';

/**
 * Learn, scanned in Chromium over the **built** game (`dist/`) — the real
 * catalogue, the real chunks, the real reader
 * (`docs/stories/TN-LEARN-reading-the-guide-by-chapter.md`, `TN-LEARN-03` to
 * `TN-LEARN-07`).
 *
 * Not through `harness.html`: the harness mounts a screen with fixture prose,
 * and what this surface must prove is that the *authored* chapter names,
 * lesson titles and passages fit, in both languages, at 200 %. A fixture that
 * fits proves nothing about "Les droits et responsabilités liés à la
 * citoyenneté" on a 390 px phone.
 *
 * Every scan is WCAG 2.1 A/AA plus axe's best practices, with the canvas
 * excluded as everywhere else (it is `aria-hidden` and carries no text).
 *
 * Screenshots: set `TN_LEARN_SHOTS=<dir>` and the 200 %/100 %, EN/FR scans
 * write the chapter list, a lesson list and a passage there.
 */

const RULESET = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];
const scan = (page: Page) => new AxeBuilder({ page }).withTags(RULESET).exclude('canvas');
const violationsOf = (results: { violations: unknown[] }) => JSON.stringify(results.violations, null, 2);

const SHOTS = process.env.TN_LEARN_SHOTS;

/** The chapter and lesson every scan opens: the longest chapter, its first lesson. */
const CHAPTER = 'canadas-history';

async function openLearn(page: Page, settings: ReadingSettings = {}): Promise<void> {
  await seed(page, settingsSave(settings));
  await page.goto('./');
  const door = page.locator('[data-testid="title-learn"]');
  await expect(door).toBeVisible();
  await door.click();
  await expect(page.locator('[data-testid="learn-chapters"]')).toBeVisible();
}

async function openChapter(page: Page, chapter = CHAPTER): Promise<void> {
  await page.locator(`[data-testid="learn-chapter-${chapter}"]`).click();
  await expect(page.locator('[data-testid="learn-lessons"]')).toBeVisible();
}

async function openFirstLesson(page: Page): Promise<void> {
  await page.locator('[data-testid="learn-lessons"] button').first().click();
  await expect(page.locator('[data-testid="lesson-reader"]')).toBeVisible();
}

async function undersized(page: Page, root: string): Promise<string[]> {
  const targets = page.locator(`[data-testid="${root}"] button`);
  const count = await targets.count();
  expect(count, 'no controls found — this check must not pass vacuously').toBeGreaterThan(0);
  const small: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const box = await targets.nth(index).boundingBox();
    if (box === null) continue;
    if (box.width < 44 || box.height < 44) {
      small.push(`${(await targets.nth(index).getAttribute('data-testid')) ?? '?'} ${String(Math.round(box.width))}x${String(Math.round(box.height))}`);
    }
  }
  return small;
}

/** A control whose words are cut: an ellipsis, or content wider than the box. */
const clipped = (page: Page, root: string): Promise<string[]> =>
  page.evaluate((id) => {
    const out: string[] = [];
    for (const node of Array.from(document.querySelectorAll(`[data-testid="${id}"] button`))) {
      const style = getComputedStyle(node);
      const element = node as HTMLElement;
      if (style.textOverflow === 'ellipsis' || element.scrollWidth > element.clientWidth + 1) {
        out.push(element.getAttribute('data-testid') ?? '?');
      }
    }
    return out;
  }, root);

const scrollsSideways = (page: Page): Promise<boolean> =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS === undefined || SHOTS === '') return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `${name}.png`), animations: 'disabled', timeout: 60_000 });
}

test.describe('Learn', () => {
  /* Three axe scans and three screenshots of a WebGL page on SwiftShader. */
  test.setTimeout(240_000);

  for (const locale of ['en', 'fr'] as const) {
    for (const scale of [1, 2] as const) {
      const label = `${locale}-${String(scale * 100)}`;

      test(`${label}: the chapters, a lesson list and a passage have no axe violations, fit, and keep 44 px targets`, async ({
        page,
      }) => {
        await openLearn(page, { locale, textScale: scale });
        await expect(page.locator('[data-testid="learn-title"]')).toHaveText(text(locale, 'learn.title'));

        let results = await scan(page).analyze();
        expect(results.violations, `chapters: ${violationsOf(results)}`).toEqual([]);
        expect(await undersized(page, 'learn')).toEqual([]);
        expect(await clipped(page, 'learn')).toEqual([]);
        expect(await scrollsSideways(page)).toBe(false);
        await shot(page, `learn-${label}-1-chapters`);

        await openChapter(page);
        await expect(page.locator('[data-testid="learn-title"]')).toHaveText(
          text(locale, `learn.chapter.${CHAPTER}` as Parameters<typeof text>[1]),
        );
        results = await scan(page).analyze();
        expect(results.violations, `lessons: ${violationsOf(results)}`).toEqual([]);
        expect(await undersized(page, 'learn')).toEqual([]);
        expect(await clipped(page, 'learn')).toEqual([]);
        expect(await scrollsSideways(page)).toBe(false);
        await shot(page, `learn-${label}-2-lessons`);

        await openFirstLesson(page);
        await expect(page.locator('[data-testid="lesson-reader"]')).toHaveAttribute('lang', locale);
        results = await scan(page).analyze();
        expect(results.violations, `reader: ${violationsOf(results)}`).toEqual([]);
        expect(await undersized(page, 'lesson-reader')).toEqual([]);
        expect(await scrollsSideways(page)).toBe(false);
        await shot(page, `learn-${label}-3-passage`);
      });
    }
  }

  test('high contrast and the easier-to-read font reach Learn, and axe still finds nothing', async ({
    page,
  }) => {
    await openLearn(page, { highContrast: true, dyslexiaFont: true, textScale: 2, locale: 'fr' });
    await expect(page.locator('html')).toHaveAttribute('data-tn-font', 'dyslexia');
    /* The family a chapter button draws in, with the toggle on and then off:
       the toggle is worthless if Learn's buttons do not change with it. */
    const families = await page
      .locator('[data-testid="learn-chapters"] button')
      .first()
      .evaluate((node) => {
        const root = document.documentElement;
        const easier = getComputedStyle(node).fontFamily;
        root.setAttribute('data-tn-font', 'default');
        const plain = getComputedStyle(node).fontFamily;
        root.setAttribute('data-tn-font', 'dyslexia');
        return { easier, plain };
      });
    expect(families.easier, 'the easier-to-read font did not reach Learn').not.toBe(families.plain);

    let results = await scan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
    await openChapter(page);
    await openFirstLesson(page);
    results = await scan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
  });

  test('is operated by keyboard alone, and Escape goes one step up at a time', async ({ page }) => {
    await seed(page, settingsSave());
    await page.goto('./');
    await page.locator('[data-testid="title-learn"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="learn-chapters"]')).toBeVisible();

    /* Tab stays inside the dialog and reaches a chapter. */
    const seen = new Set<string>();
    for (let index = 0; index < 14; index += 1) {
      await page.keyboard.press('Tab');
      const focused = await focusedTestId(page);
      seen.add(focused);
      expect(
        await page.evaluate(() => document.activeElement?.closest('[data-testid="learn"]') !== null),
        `Tab left Learn, to ${focused}`,
      ).toBe(true);
    }
    expect(seen.has('learn-back')).toBe(true);

    await page.locator(`[data-testid="learn-chapter-${CHAPTER}"]`).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="learn-lessons"]')).toBeVisible();
    expect(await focusedTestId(page)).toMatch(/^learn-lesson-/);
    const lesson = await focusedTestId(page);

    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="lesson-reader"]')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="lesson-reader"]')).toBeHidden();
    expect(await focusedTestId(page)).toBe(lesson);

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="learn-chapters"]')).toBeVisible();
    expect(await focusedTestId(page)).toBe(`learn-chapter-${CHAPTER}`);

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="learn"]')).toBeHidden();
    expect(await focusedTestId(page)).toBe('title-learn');
  });

  test('is operated by one switch: short presses move, a long press opens', async ({ page }) => {
    await seed(page, settingsSave({ singleSwitch: true }));
    await page.goto('./');
    await page.locator('[data-testid="title-learn"]').click();
    await expect(page.locator('[data-testid="learn-chapters"]')).toBeVisible();

    const highlighted = (): Promise<string> =>
      page.evaluate(
        () => document.querySelector('[data-switch-highlight="true"]')?.getAttribute('data-testid') ?? 'none',
      );
    const press = async (heldMs: number): Promise<void> => {
      await page.mouse.move(200, 120);
      await page.mouse.down();
      await page.waitForTimeout(heldMs);
      await page.mouse.up();
    };

    expect(await highlighted()).toMatch(/^learn-chapter-/);
    const first = await highlighted();
    await press(40);
    expect(await highlighted()).not.toBe(first);
    expect(await highlighted()).toMatch(/^learn-chapter-/);

    await press(1200);
    await expect(page.locator('[data-testid="learn-lessons"]')).toBeVisible();
    expect(await highlighted()).toMatch(/^learn-lesson-/);

    await press(1200);
    await expect(page.locator('[data-testid="lesson-reader"]')).toBeVisible();
    expect(await highlighted()).toBe('lesson-reader-passage');
  });

  test('keeps the canvas out of the way and uses the one live region', async ({ page }) => {
    await openLearn(page);
    await openChapter(page);
    expect(await page.locator('[aria-live]').count()).toBe(1);
    const canvases = page.locator('canvas');
    for (let index = 0; index < (await canvases.count()); index += 1) {
      const hidden = await canvases
        .nth(index)
        .evaluate((node) => node.closest('[aria-hidden="true"]') !== null);
      expect(hidden).toBe(true);
    }
  });
});
