import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { HARNESS_URL } from './playwright.config';

/**
 * The character creator's picture (ADR-0040, `TN-CREATOR-12`), in a real
 * browser, through the shell — so the whole-page rules run, as they do in
 * `shell.spec.ts`.
 *
 * What a picture can break on an accessible screen, and what each test here is
 * for:
 *
 *  - **what is read.** The picture is decoration beside the words. It must add
 *    no image, no name and no live region, and axe must stay clean in both
 *    languages;
 *  - **what is reached.** The keyboard order must be exactly the order with no
 *    picture, and no focused control may sit hidden under the sticky panel;
 *  - **what it does to layout.** At 200 % text the panel stacks and is not
 *    sticky, nothing scrolls sideways, and the picture never covers the words;
 *  - **what it does when it moves, and when it cannot.** Reduced motion is a
 *    picture that does not change between two reads; a picture whose atlas
 *    never arrives is gone, not an empty box.
 *
 * The harness draws with the renderer the game wires, from `assets/dist`.
 */

const RULESET = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];
const scan = (page: Page) => new AxeBuilder({ page }).withTags([...RULESET]).exclude('canvas');
const violationsOf = (results: { violations: unknown[] }) => JSON.stringify(results.violations, null, 2);

interface Open {
  readonly art?: 'real' | 'none';
  readonly locale?: 'en' | 'fr';
  readonly textScale?: number;
  readonly contrast?: 'high';
  readonly motion?: 'reduced';
  readonly font?: 'dyslexia';
  /** What the picture should have reached before the test looks. */
  readonly settle?: 'ready' | 'failed';
}

async function open(page: Page, options: Open = {}): Promise<Locator> {
  const params = new URLSearchParams({ screen: 'shell', view: 'creator' });
  if ((options.art ?? 'real') === 'real') params.set('art', 'real');
  if (options.locale !== undefined) params.set('locale', options.locale);
  if (options.textScale !== undefined) params.set('textScale', String(options.textScale));
  if (options.contrast !== undefined) params.set('contrast', options.contrast);
  if (options.motion !== undefined) params.set('motion', options.motion);
  if (options.font !== undefined) params.set('font', options.font);

  const response = await page.goto(`${HARNESS_URL}?${params.toString()}`);
  expect(response?.status()).toBeLessThan(400);
  await page.waitForSelector('html[data-tn-harness-ready="shell"]', { timeout: 15_000 });
  const creator = page.getByTestId('character-creator');
  await expect(creator).toBeVisible();

  if (options.settle !== undefined) {
    await expect(page.getByTestId('character-preview-art')).toHaveAttribute(
      'data-state',
      options.settle,
      { timeout: 20_000 },
    );
  }
  return creator;
}

/** The testid (or tag) of every element Tab lands on, for `count` presses. */
async function tabOrder(page: Page, count: number): Promise<string[]> {
  const order: string[] = [];
  for (let index = 0; index < count; index += 1) {
    await page.keyboard.press('Tab');
    order.push(
      await page.evaluate(() => {
        const active = document.activeElement;
        return active?.getAttribute('data-testid') ?? active?.tagName ?? 'none';
      }),
    );
  }
  return order;
}

const canvasPixels = (page: Page): Promise<string> =>
  page.evaluate(
    () =>
      document
        .querySelector<HTMLCanvasElement>('[data-testid="character-preview-art"] canvas')
        ?.toDataURL() ?? '',
  );

const boxOf = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('an element that should be drawn has no box');
  return box;
};

const overlaps = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean =>
  a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;

test.describe("the creator's picture", () => {
  for (const locale of ['en', 'fr'] as const) {
    test(`is drawn and adds nothing a screen reader hears (${locale})`, async ({ page }) => {
      const creator = await open(page, { locale, settle: 'ready' });

      const results = await scan(page).analyze();
      expect(results.violations, violationsOf(results)).toEqual([]);

      const art = page.getByTestId('character-preview-art');
      await expect(art).toHaveAttribute('aria-hidden', 'true');
      await expect(art.locator('canvas')).toHaveAttribute('aria-hidden', 'true');
      await expect(art).not.toHaveAttribute('data-frames', '');
      await expect(creator.getByRole('img')).toHaveCount(0);
      await expect(page.locator('[aria-live]')).toHaveCount(1);

      /* The preview is still its heading and its words. */
      const preview = page.getByTestId('character-preview');
      await expect(preview).toHaveAttribute('role', 'group');
      const heading = locale === 'fr' ? 'Votre personnage' : 'Your character';
      await expect(preview.getByRole('heading', { name: heading })).toBeVisible();
      await expect(page.locator('#tn-creator-preview-text')).toContainText(
        locale === 'fr' ? 'Teint de peau' : 'Skin tone',
      );
    });
  }

  test('leaves the keyboard order exactly as it was without a picture', async ({ page }) => {
    await open(page, { art: 'none' });
    const without = await tabOrder(page, 30);

    await open(page, { settle: 'ready' });
    const withArt = await tabOrder(page, 30);

    expect(withArt).toEqual(without);
    expect(withArt).not.toContain('character-preview-art');
    expect(withArt).not.toContain('CANVAS');
  });

  test('stays in view at 100 % text, and no focused control hides under it', async ({ page }) => {
    await open(page, { settle: 'ready' });
    const preview = page.getByTestId('character-preview');
    await expect(preview).toHaveCSS('position', 'sticky');

    const hidden: string[] = [];
    for (let index = 0; index < 30; index += 1) {
      await page.keyboard.press('Tab');
      const finding = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        const panel = document.querySelector('[data-testid="character-preview"]');
        if (active === null || panel === null || panel.contains(active)) return null;
        const a = active.getBoundingClientRect();
        const p = panel.getBoundingClientRect();
        const stuck = p.top < 40;
        return stuck && a.top < p.bottom - 1 && a.bottom > p.top + 1
          ? `${active.getAttribute('data-testid') ?? active.tagName} at ${String(Math.round(a.top))} under ${String(Math.round(p.bottom))}`
          : null;
      });
      if (finding !== null) hidden.push(finding);
    }
    expect(hidden, hidden.join(' | ')).toEqual([]);

    await page.getByTestId('slot-presentation').scrollIntoViewIfNeeded();
    const box = await boxOf(preview);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeLessThan(40);
  });

  test('stacks at 200 % text: not sticky, nothing sideways, the picture never on the words', async ({
    page,
  }) => {
    await open(page, { textScale: 200, font: 'dyslexia', settle: 'ready' });
    const preview = page.getByTestId('character-preview');

    await expect(preview).toHaveCSS('position', 'static');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1),
    ).toBe(false);

    const art = await boxOf(page.getByTestId('character-preview-art'));
    const words = await boxOf(page.locator('#tn-creator-preview-text'));
    const heading = await boxOf(page.locator('#tn-creator-preview-heading'));
    expect(overlaps(art, words), 'the picture covers the description').toBe(false);
    expect(overlaps(art, heading), 'the picture covers the heading').toBe(false);

    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-testid="character-creator"] button, [role="radio"]')]
        .map((node) => node.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && (rect.width < 44 || rect.height < 44)).length,
    );
    expect(small).toBe(0);
  });

  test('is clean in high contrast, and holds perfectly still under reduced motion', async ({ page }) => {
    await open(page, { contrast: 'high', motion: 'reduced', settle: 'ready' });

    const results = await scan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
    await expect(page.getByTestId('character-preview')).toHaveAttribute('data-animated', 'false');

    const first = await canvasPixels(page);
    await page.waitForTimeout(1_000);
    const second = await canvasPixels(page);
    expect(first.length, 'the picture painted nothing').toBeGreaterThan(1_000);
    expect(second, 'the picture moved under reduced motion').toBe(first);
  });

  test('is words only when the art cannot load: no empty box, still clean, still the way on', async ({
    page,
  }) => {
    await page.route('**/atlas/shared@*.webp', (route) => route.abort());
    await open(page, { settle: 'failed' });

    await expect(page.getByTestId('character-preview-art')).toBeHidden();
    await expect(page.getByTestId('character-preview')).not.toHaveCSS('position', 'sticky');
    await expect(page.locator('#tn-creator-preview-text')).toContainText('Skin tone');
    await expect(page.getByTestId('start-playing')).toBeEnabled();

    const results = await scan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
  });
});
