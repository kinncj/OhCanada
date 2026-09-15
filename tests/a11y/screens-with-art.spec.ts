import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { HARNESS_URL } from './playwright.config';

/**
 * ADR-0041: the landmark card, the dialogue, the completion card, the Study home
 * and the title screen draw a picture — and a picture is the easiest way to
 * break a screen that was accessible without one.
 *
 * What each test here is for:
 *
 *  - **what is read.** A picture is decoration beside words that already say
 *    what it shows. It adds no image role, no name, no description, and axe
 *    stays clean with it on the page, in English and French, at 200 % text and
 *    in high contrast — and its contrast stays *computable*, because an unknown
 *    is not a pass;
 *  - **what is reached.** A picture holds no control, and every control stays at
 *    44 CSS px at 200 % text without the page scrolling sideways;
 *  - **what it does to the level.** The cards a level opens are sheets over it:
 *    the level stays in view above the sheet, dimmed, and the dialog still
 *    covers the whole screen, so a tap above the sheet does not reach the game;
 *  - **what it does when it moves.** Under reduced motion nothing animates, the
 *    stamp being pressed included; under forced colours the screens stay clean.
 *
 * The harness hands every screen a small inline drawing (`?art=fixture`), so a
 * picture has really loaded when the scan runs, without depending on a build.
 */

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const RULESET = [...WCAG, 'best-practice'];

/** A single modal over the harness page has no landmarks; see `level-screens.spec.ts`. */
const componentScan = (page: Page) =>
  new AxeBuilder({ page })
    .withTags([...RULESET])
    .disableRules(['region', 'landmark-one-main'])
    .exclude('canvas');
/** The shell is the page's `<main>`: nothing is disabled for it. */
const pageScan = (page: Page) => new AxeBuilder({ page }).withTags([...RULESET]).exclude('canvas');

const violationsOf = (results: { violations: unknown[] }) =>
  JSON.stringify(results.violations, null, 2);

interface Options {
  readonly locale?: 'en' | 'fr';
  readonly textScale?: number;
  readonly contrast?: 'high';
  readonly motion?: 'reduced';
  readonly reason?: 'quest' | 'unfinished';
  readonly over?: 'poi';
}

interface Case {
  readonly name: string;
  readonly screen: 'poi' | 'dialogue' | 'complete' | 'study' | 'shell';
  readonly root: string;
  /** The picture frames this screen draws, each of which must have loaded. */
  readonly art: readonly string[];
  readonly extra?: Readonly<Record<string, string>>;
  readonly whole?: boolean;
}

const CASES: readonly Case[] = [
  { name: 'the landmark card', screen: 'poi', root: 'poi-card', art: ['poi-card-art'] },
  { name: 'the dialogue', screen: 'dialogue', root: 'dialogue', art: ['dialogue-portrait'] },
  {
    name: 'the completion card',
    screen: 'complete',
    root: 'quest-complete-card',
    art: ['quest-complete-stamp-art'],
    extra: { reason: 'quest', done: '1' },
  },
  { name: 'the Study home', screen: 'study', root: 'study-screen', art: ['study-art'] },
  {
    name: 'the title screen',
    screen: 'shell',
    root: 'title-screen',
    art: ['title-landscape', 'title-figure'],
    extra: { view: 'title', study: '1', exam: '1' },
    whole: true,
  },
];

async function open(page: Page, subject: Case, options: Options = {}): Promise<Locator> {
  const params = new URLSearchParams({ screen: subject.screen, art: 'fixture', ...subject.extra });
  if (options.locale !== undefined) params.set('locale', options.locale);
  if (options.textScale !== undefined) params.set('textScale', String(options.textScale));
  if (options.contrast !== undefined) params.set('contrast', options.contrast);
  if (options.motion !== undefined) params.set('motion', options.motion);
  if (options.reason !== undefined) params.set('reason', options.reason);

  const response = await page.goto(`${HARNESS_URL}?${params.toString()}`);
  expect(response, 'no response from the harness server').not.toBeNull();
  expect(response?.status()).toBeLessThan(400);
  await page.waitForSelector(`html[data-tn-harness-ready="${subject.screen}"]`, { timeout: 15_000 });

  const root = page.locator(`[data-testid="${subject.root}"]`);
  await expect(root, `${subject.name} never appeared`).toBeVisible();
  for (const art of subject.art) {
    await expect(
      page.getByTestId(art),
      `${art} did not load, so this scan would measure a screen with no picture`,
    ).toHaveAttribute('data-state', 'ready', { timeout: 10_000 });
  }
  return root;
}

async function undersizedTargets(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll(
        'button, a[href], input:not([type="hidden"]), [role="button"], [role="radio"], [role="switch"]',
      ),
    ]
      .filter((element) => (element as HTMLElement).checkVisibility())
      .map((element) => {
        const box = element.getBoundingClientRect();
        return { id: element.getAttribute('data-testid') ?? element.tagName, box };
      })
      .filter(({ box }) => box.width < 44 || box.height < 44)
      .map(({ id, box }) => `${id} ${Math.round(box.width)}x${Math.round(box.height)}`),
  );
}

const scrollsSideways = (page: Page): Promise<boolean> =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

const VARIANTS: readonly (readonly [string, Options])[] = [
  ['in English', {}],
  ['in French', { locale: 'fr' }],
  ['at 200 % text', { textScale: 200 }],
  ['in French at 200 % text', { locale: 'fr', textScale: 200 }],
  ['in high contrast', { contrast: 'high' }],
];

for (const subject of CASES) {
  test.describe(`${subject.name}, with its picture`, () => {
    for (const [label, options] of VARIANTS) {
      test(`is clean and its contrast is known ${label}`, async ({ page }) => {
        await open(page, subject, options);
        const results = await (subject.whole === true ? pageScan(page) : componentScan(page)).analyze();
        expect(results.violations, violationsOf(results)).toEqual([]);
        const contrast = results.incomplete.filter((issue) => issue.id === 'color-contrast');
        expect(contrast, `contrast is unknown, not proven: ${JSON.stringify(contrast, null, 2)}`).toEqual([]);
      });
    }

    test('adds no image, no name and nothing to reach', async ({ page }) => {
      const root = await open(page, subject);
      for (const art of subject.art) {
        const frame = page.getByTestId(art);
        await expect(frame).toHaveAttribute('aria-hidden', 'true');
        await expect(frame.locator('img').first()).toHaveAttribute('alt', '');
        await expect(frame.locator('button, a[href], [tabindex]')).toHaveCount(0);
      }
      await expect(root.getByRole('img')).toHaveCount(0);
    });

    test('keeps every control at 44 CSS px, and the page still, at 200 % text in French', async ({
      page,
    }) => {
      await open(page, subject, { locale: 'fr', textScale: 200 });
      expect(await undersizedTargets(page)).toEqual([]);
      expect(await scrollsSideways(page), 'the page scrolls sideways').toBe(false);
    });
  });
}

test.describe('the names the pictures sit beside', () => {
  test('the landmark card is still named by the landmark', async ({ page }) => {
    const root = await open(page, CASES[0] as Case);
    await expect(root).toHaveAccessibleName('Parliament Hill');
  });

  test('the dialogue is still named by the speaker', async ({ page }) => {
    const root = await open(page, CASES[1] as Case);
    await expect(root).toHaveAccessibleName('Officer');
    await expect(page.getByTestId('dialogue-speaker')).toHaveText('Officer');
  });

  test('the completion card still reads its heading, not its stamp', async ({ page }) => {
    const root = await open(page, CASES[2] as Case);
    await expect(root).toHaveAccessibleName('Task done!');
  });
});

test.describe('a card over the level', () => {
  const OVER_LEVEL: Case = {
    name: 'the landmark card over the level',
    screen: 'poi',
    root: 'poi-card',
    art: ['poi-card-art'],
  };

  async function openOverLevel(page: Page, options: Options = {}): Promise<Locator> {
    const params = new URLSearchParams({ screen: 'level', prompt: '1', over: 'poi', art: 'fixture' });
    if (options.textScale !== undefined) params.set('textScale', String(options.textScale));
    if (options.contrast !== undefined) params.set('contrast', options.contrast);
    await page.goto(`${HARNESS_URL}?${params.toString()}`);
    await page.waitForSelector('html[data-tn-harness-ready="level"]', { timeout: 15_000 });
    const root = page.getByTestId(OVER_LEVEL.root);
    await expect(root).toBeVisible();
    await expect(page.getByTestId('poi-card-art')).toHaveAttribute('data-state', 'ready');
    return root;
  }

  test('is a sheet at the foot of the screen, and the level stays in view above it', async ({ page }) => {
    const root = await openOverLevel(page);
    const viewport = page.viewportSize();
    const sheet = await root.locator('.tn-screen__card').boundingBox();
    expect(sheet).not.toBeNull();
    expect(sheet?.y ?? 0, 'the sheet covers the level it is about').toBeGreaterThan((viewport?.height ?? 0) * 0.2);
    expect((sheet?.y ?? 0) + (sheet?.height ?? 0)).toBeGreaterThanOrEqual((viewport?.height ?? 0) - 1);

    /* The dialog still covers the screen, so a tap above the sheet lands on it. */
    const dialog = await root.boundingBox();
    expect(dialog?.height ?? 0).toBeGreaterThanOrEqual((viewport?.height ?? 0) - 1);
    await expect(page.locator('[aria-modal="true"]:not([hidden])')).toHaveCount(1);
  });

  test('dims the level with the picture itself, never with a wash over the words', async ({ page }) => {
    await openOverLevel(page);
    const filter = await page.locator('#game').evaluate((game) => getComputedStyle(game).filter);
    expect(filter).toContain('brightness');
    const background = await page
      .getByTestId('poi-card')
      .evaluate((root) => getComputedStyle(root).backgroundColor);
    expect(background).toBe('rgba(0, 0, 0, 0)');
  });

  test('puts the level back to full brightness when the card closes', async ({ page }) => {
    await openOverLevel(page);
    await page.getByTestId('poi-card-close').click();
    await expect(page.getByTestId('poi-card')).toBeHidden();
    const filter = await page.locator('#game').evaluate((game) => getComputedStyle(game).filter);
    expect(filter).toBe('none');
  });

  test('is clean over the whole page, in high contrast and at 200 % text', async ({ page }) => {
    for (const options of [{}, { contrast: 'high' as const }, { textScale: 200 }]) {
      await openOverLevel(page, options);
      const results = await pageScan(page).analyze();
      expect(results.violations, `${JSON.stringify(options)}: ${violationsOf(results)}`).toEqual([]);
    }
  });
});

test.describe('the stamp', () => {
  const COMPLETE = CASES[2] as Case;

  test('is an outline, not ink, on the card that says what is left', async ({ page }) => {
    await open(page, COMPLETE, { reason: 'unfinished' });
    await expect(page.getByTestId('quest-complete-stamp-art')).toHaveAttribute('data-inked', 'false');
    const results = await componentScan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
  });

  test('is inked on the card that says the task is done', async ({ page }) => {
    await open(page, COMPLETE);
    await expect(page.getByTestId('quest-complete-stamp-art')).toHaveAttribute('data-inked', 'true');
  });
});

test.describe('under reduced motion', () => {
  test('nothing on the completion card animates, the stamp included', async ({ page }) => {
    await open(page, CASES[2] as Case, { motion: 'reduced' });
    const animation = await page
      .getByTestId('quest-complete-stamp-art')
      .evaluate((stamp) => getComputedStyle(stamp).animationName);
    expect(animation).toBe('none');
  });

  test('the title screen’s picture is still', async ({ page }) => {
    await open(page, CASES[4] as Case, { motion: 'reduced' });
    const moving = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="title-art"], [data-testid="title-art"] *')].filter(
        (element) => getComputedStyle(element).animationName !== 'none',
      ).length,
    );
    expect(moving).toBe(0);
  });
});

test.describe('under forced colours', () => {
  test.use({ forcedColors: 'active' });

  for (const subject of CASES) {
    test(`${subject.name} is clean`, async ({ page }) => {
      await open(page, subject);
      const results = await (subject.whole === true ? pageScan(page) : componentScan(page)).analyze();
      expect(results.violations, violationsOf(results)).toEqual([]);
    });
  }
});
