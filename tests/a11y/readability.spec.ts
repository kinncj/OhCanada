import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { hasCopyRow, labelled, text } from '../../app/ui/copy';
import { HIGHLIGHT_ATTRIBUTE } from '../../app/ui/single-switch';

import { HARNESS_URL } from './playwright.config';

/**
 * ADR-0045, the readability pass, measured in a real browser.
 *
 * The second live-site audit found, on a 390 x 844 phone:
 *
 *  - at 200 % text in French on Halifax the task line ended 63 px below the
 *    screen, inside the HUD's own scroll box;
 *  - words split by automatic hyphenation on every screen;
 *  - "Next" below the fold after answering, and a question card 40 % blank
 *    before answering;
 *  - high contrast drawing Off as a solid slab and On as an empty outline;
 *  - the level menu and the exam menu as white pages with their buttons at the
 *    bottom;
 *  - an earned passport slot with no stamp.
 *
 * Every test here would have failed on that build. Each screen it changes is
 * also scanned by axe in English and French, at 200 % text, in high contrast
 * and under forced colours.
 */

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const RULESET = [...WCAG, 'best-practice'];

/** One dialog over the harness page has no landmarks of its own; see `level-screens.spec.ts`. */
const componentScan = (page: Page) =>
  new AxeBuilder({ page })
    .withTags([...RULESET])
    .disableRules(['region', 'landmark-one-main'])
    .exclude('canvas');
/** The level page is the page's one `<main>`: nothing is disabled for it. */
const pageScan = (page: Page) => new AxeBuilder({ page }).withTags([...RULESET]).exclude('canvas');

const violationsOf = (results: { violations: unknown[] }) =>
  JSON.stringify(results.violations, null, 2);

type Params = Readonly<Record<string, string>>;

async function open(page: Page, params: Params): Promise<void> {
  const query = new URLSearchParams(params);
  const response = await page.goto(`${HARNESS_URL}?${query.toString()}`);
  expect(response, 'no response from the harness server').not.toBeNull();
  expect(response?.status()).toBeLessThan(400);
  await page.waitForSelector(`html[data-tn-harness-ready="${params['screen'] ?? ''}"]`, {
    timeout: 15_000,
  });
}

const scrollsSideways = (page: Page): Promise<boolean> =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

const VARIANTS: readonly (readonly [string, Params])[] = [
  ['in English', {}],
  ['in French', { locale: 'fr' }],
  ['at 200 % text', { textScale: '200' }],
  ['in French at 200 % text', { locale: 'fr', textScale: '200' }],
  ['in high contrast', { contrast: 'high' }],
];

/** The screens this pass changed, as the harness draws them. */
const SCREENS: readonly {
  readonly name: string;
  readonly params: Params;
  readonly whole?: boolean;
}[] = [
  { name: 'the HUD with its task, offer and hint', params: { screen: 'level', task: '1', prompt: '1', hint: '1' }, whole: true },
  { name: 'the question card over a level, answered', params: { screen: 'level', task: '1', prompt: '1', over: 'card', answered: '1' }, whole: true },
  { name: 'the question card in Study, answered', params: { screen: 'card', answered: '1' } },
  { name: 'the level menu', params: { screen: 'level', task: '1', prompt: '1', over: 'menu' }, whole: true },
  { name: 'the exam menu', params: { screen: 'exam', over: 'menu', timer: 'running' } },
  { name: 'the exam question', params: { screen: 'exam', timer: 'running' } },
  { name: 'the exam start', params: { screen: 'exam-start' } },
  { name: 'Settings', params: { screen: 'settings' } },
  { name: 'the passport with a stamp', params: { screen: 'passport', art: 'fixture' } },
];

for (const subject of SCREENS) {
  test.describe(`${subject.name}, after the readability pass`, () => {
    for (const [label, variant] of VARIANTS) {
      test(`is clean ${label}`, async ({ page }) => {
        await open(page, { ...subject.params, ...variant });
        const results = await (subject.whole === true ? pageScan(page) : componentScan(page)).analyze();
        expect(results.violations, violationsOf(results)).toEqual([]);
        expect(await scrollsSideways(page), 'the page scrolls sideways').toBe(false);
      });
    }
  });
}

test.describe('under forced colours', () => {
  test.use({ forcedColors: 'active' });

  for (const subject of SCREENS) {
    test(`${subject.name} is clean`, async ({ page }) => {
      await open(page, subject.params);
      const results = await (subject.whole === true ? pageScan(page) : componentScan(page)).analyze();
      expect(results.violations, violationsOf(results)).toEqual([]);
    });
  }

  test('a switch that is on still looks on: its knob sits at the end of its track', async ({ page }) => {
    await open(page, { screen: 'settings', motion: 'reduced' });
    const placed = await knobPlacement(page, 'setting-reduced-motion');
    expect(placed, 'the knob of an on switch is not at the end of its track').toBe('end');
    /* A switch that is *off*, and no longer auto-move: that one ships on
       (ADR-0058), so it would prove the same thing twice and nothing about the
       off state. "Easier-to-read font" is off in every scan on this page. */
    expect(await knobPlacement(page, 'setting-dyslexia-font')).toBe('start');
  });
});

/* ------------------------------------------------------------------ the HUD */

test.describe('the task stays on screen at 200 % text', () => {
  /*
   * The audit's own case: Halifax, the task accepted, the landmark's offer in
   * reach. The words are the game's: the landmark's prompt row and the quest
   * step the tracker draws, read from the quest document.
   */
  const quest = JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../../content/quests/halifax-clock-and-pier.json', import.meta.url)),
      'utf8',
    ),
  ) as { readonly steps: readonly { readonly prompt: { readonly en: string; readonly fr: string } }[] };
  const step = quest.steps[1]?.prompt;

  for (const locale of ['en', 'fr'] as const) {
    test(`keeps the offer, Settings, Menu and the task inside the strip, in ${locale === 'fr' ? 'French' : 'English'}`, async ({
      page,
    }) => {
      expect(step, 'the Halifax quest has no second step to track').toBeDefined();
      await open(page, {
        screen: 'level',
        locale,
        textScale: '200',
        task: '1',
        prompt: '1',
        hint: '1',
        notice: '1',
        warning: '1',
      });
      /* The harness draws Ottawa's officer and task; the audit's words replace
         them in the same elements, so what is measured is the layout. */
      await page.evaluate(
        ({ prompt, task }) => {
          const set = (id: string, value: string): void => {
            const target = document.querySelector(`[data-testid="${id}"]`);
            if (target === null) throw new Error(`${id} is not drawn`);
            target.textContent = value;
          };
          set('interact-prompt', prompt);
          set('hud-quest-tracker', task);
          const hud = document.querySelector('[data-testid="hud"]');
          if (hud !== null) hud.scrollTop = 0;
        },
        {
          prompt: text(locale, 'hud.interact.town-clock'),
          task: labelled(locale, text(locale, 'hud.task'), step?.[locale] ?? ''),
        },
      );

      const strip = await page.getByTestId('hud').boundingBox();
      expect(strip).not.toBeNull();
      const bottom = (strip?.y ?? 0) + (strip?.height ?? 0);
      for (const testId of ['interact-prompt', 'hud-settings-button', 'menu-button', 'hud-quest-tracker']) {
        const box = await page.getByTestId(testId).boundingBox();
        expect(box, `${testId} is not drawn`).not.toBeNull();
        expect(
          (box?.y ?? 0) + (box?.height ?? Number.POSITIVE_INFINITY),
          `${testId} ends below the strip, where a player has to scroll to find it`,
        ).toBeLessThanOrEqual(bottom + 1);
      }
    });
  }

  /* -------------------------------------------- every task, not just one */

  /*
   * The strip above, swept across every task the game can put in it.
   *
   * The audit's case measures one line: Halifax's second step. The task row is
   * the only row in the strip whose words come from `content/` rather than from
   * `copy.ts`, so it is the one row a content change can lengthen without
   * anybody opening this file — and widening the question pools did exactly
   * that. Twenty-five step prompts grew past the strip at 200 % text and only
   * the one Halifax happens to hold was measured.
   *
   * The offer row is pinned to the longest one any level can show, read from
   * the level documents rather than typed here, so what is measured is the
   * worst strip the game can draw and not the strip Halifax happens to draw.
   */
  const STEP_PROMPTS = readdirSync(fileURLToPath(new URL('../../content/quests', import.meta.url)))
    .filter((name) => name.endsWith('.json'))
    .flatMap((name) => {
      const document = JSON.parse(
        readFileSync(fileURLToPath(new URL(`../../content/quests/${name}`, import.meta.url)), 'utf8'),
      ) as {
        readonly steps: readonly {
          readonly id: string;
          readonly prompt: { readonly en: string; readonly fr: string };
        }[];
      };
      return document.steps.map((step) => ({ where: `${name} ${step.id}`, prompt: step.prompt }));
    });

  /** The longest offer the HUD can print, asked of the same two sources the game asks. */
  function longestOffer(locale: 'en' | 'fr'): string {
    const offers = readdirSync(fileURLToPath(new URL('../../content/levels', import.meta.url)))
      .filter((name) => name.endsWith('.json'))
      .flatMap((name) => {
        const level = JSON.parse(
          readFileSync(fileURLToPath(new URL(`../../content/levels/${name}`, import.meta.url)), 'utf8'),
        ) as { readonly pois?: readonly { readonly id: string }[] };
        return (level.pois ?? []).map((poi) => `hud.interact.${poi.id}`);
      })
      .filter((key) => hasCopyRow(key))
      .map((key) => text(locale, key as Parameters<typeof text>[1]));
    return offers.reduce((longest, offer) => (offer.length > longest.length ? offer : longest), '');
  }

  for (const locale of ['en', 'fr'] as const) {
    test(`keeps every task a quest can show inside the strip, in ${locale === 'fr' ? 'French' : 'English'}`, async ({
      page,
    }) => {
      expect(STEP_PROMPTS.length, 'no quest step was read').toBeGreaterThan(0);
      await open(page, {
        screen: 'level',
        locale,
        textScale: '200',
        task: '1',
        prompt: '1',
        hint: '1',
        notice: '1',
        warning: '1',
      });
      const offer = longestOffer(locale);
      const overflowing: string[] = [];
      for (const step of STEP_PROMPTS) {
        const overflow = await page.evaluate(
          ({ prompt, task }) => {
            const set = (id: string, value: string): void => {
              const target = document.querySelector(`[data-testid="${id}"]`);
              if (target === null) throw new Error(`${id} is not drawn`);
              target.textContent = value;
            };
            set('interact-prompt', prompt);
            set('hud-quest-tracker', task);
            const hud = document.querySelector('[data-testid="hud"]');
            if (hud === null) throw new Error('the HUD is not drawn');
            hud.scrollTop = 0;
            const strip = hud.getBoundingClientRect();
            const row = document
              .querySelector('[data-testid="hud-quest-tracker"]')
              ?.getBoundingClientRect();
            if (row === undefined) throw new Error('the task is not drawn');
            return Math.round((row.y + row.height - (strip.y + strip.height)) * 10) / 10;
          },
          { prompt: offer, task: labelled(locale, text(locale, 'hud.task'), step.prompt[locale]) },
        );
        if (overflow > 1) overflowing.push(`${step.where}: ${String(overflow)} px below the strip`);
      }
      expect(
        overflowing,
        'a task ends below the strip at 200 % text, where a player has to scroll to find it',
      ).toEqual([]);
    });
  }

  test('draws the task straight after Settings and Menu, before every paragraph', async ({ page }) => {
    await open(page, { screen: 'level', task: '1', prompt: '1', hint: '1', notice: '1', warning: '1' });
    const order = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="hud"] [data-testid]')].map(
        (element) => element.getAttribute('data-testid') ?? '',
      ),
    );
    const at = (id: string): number => order.indexOf(id);
    expect(at('menu-button')).toBeLessThan(at('hud-quest-tracker'));
    for (const id of ['storage-warning', 'hud-notice', 'hud-mode-label', 'interact-hint']) {
      expect(at('hud-quest-tracker'), `${id} is drawn before the task`).toBeLessThan(at(id));
    }
  });
});

/*
 * The third live-site audit, P1: the strip crowded the bottom edge.
 *
 * The mode label is the last line in the strip, and it ended 6 px from the
 * bottom of the window at every text size — "Walking" read as a word cut off by
 * the edge rather than as the foot of a panel, and on a phone with a home
 * indicator it sat under the hardware. The strip is still anchored to the bottom
 * of the window: what changed is that it has a foot.
 */
test.describe('the strip has a foot under its last line', () => {
  for (const [label, params] of [
    ['in English', {}],
    ['in French', { locale: 'fr' }],
    ['at 200 % text', { textScale: '200' }],
    ['in French at 200 % text', { locale: 'fr', textScale: '200' }],
  ] as const) {
    test(`leaves clear space under the mode label ${label}`, async ({ page }) => {
      await open(page, { screen: 'level', ...params });
      const strip = await page.getByTestId('hud').boundingBox();
      const mode = await page.getByTestId('hud-mode-label').boundingBox();
      expect(strip, 'the strip is not drawn').not.toBeNull();
      expect(mode, 'the mode label is not drawn').not.toBeNull();

      const stripBottom = (strip?.y ?? 0) + (strip?.height ?? 0);
      const modeBottom = (mode?.y ?? 0) + (mode?.height ?? 0);
      const viewport = page.viewportSize();
      expect(Math.abs(stripBottom - (viewport?.height ?? 0)), 'the strip left the bottom edge').toBeLessThan(2);
      expect(
        stripBottom - modeBottom,
        'the mode label ends against the bottom edge, where it reads as clipped',
      ).toBeGreaterThanOrEqual(8);
    });
  }
});

/*
 * The third live-site audit, P1: on a desktop the strip spanned the window.
 *
 * The playfield is a portrait column — 506 px at 1440 x 900 — and the strip was
 * 1440 px, so Settings and Menu sat 400 px from the game. The suite's own
 * viewport is a phone, where the answer is the whole width; this test resizes,
 * because the defect only exists on a window wider than 9:16.
 */
test.describe('the strip keeps to the portrait canvas', () => {
  const column = (width: number, height: number): number => Math.min(width, (height * 9) / 16);

  for (const size of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    test(`is the playfield's width at ${size.width} x ${size.height}, and centred on it`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await open(page, { screen: 'level', task: '1', prompt: '1' });

      const strip = await page.getByTestId('hud').boundingBox();
      expect(strip, 'the strip is not drawn').not.toBeNull();
      const expected = column(size.width, size.height);
      expect(
        Math.abs((strip?.width ?? 0) - expected),
        `the strip is ${String(strip?.width)} px wide where the playfield is ${String(expected)}`,
      ).toBeLessThanOrEqual(2);
      /* Centred: the same column the canvas is centred in (ADR-0002). */
      const left = strip?.x ?? 0;
      const right = size.width - left - (strip?.width ?? 0);
      expect(Math.abs(left - right), 'the strip is not centred').toBeLessThanOrEqual(2);

      /* And the controls are inside it, where the game is. */
      for (const testId of ['hud-settings-button', 'menu-button', 'interact-prompt']) {
        const box = await page.getByTestId(testId).boundingBox();
        expect(box, `${testId} is not drawn`).not.toBeNull();
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(left + (strip?.width ?? 0) + 1);
        expect(box?.x ?? 0).toBeGreaterThanOrEqual(left - 1);
      }
    });
  }
});

/* ------------------------------------------------------------ the question */

test.describe('the question card', () => {
  test('names the level and the landmark it is asked at, and neither is its name', async ({ page }) => {
    await open(page, { screen: 'level', task: '1', prompt: '1', over: 'card' });
    const card = page.getByTestId('question-card');
    const place = card.getByTestId('question-place');
    await expect(place).toBeVisible();
    await expect(place).toContainText('Ottawa');
    await expect(place).toContainText('Parliament Hill');
    await expect(card).toHaveAccessibleName('Question 1 of 3');
  });

  test('draws no place in Study', async ({ page }) => {
    await open(page, { screen: 'card' });
    await expect(page.getByTestId('question-place')).toBeHidden();
  });

  test('hugs its content before answering: the actions sit under the options, not under a blank sheet', async ({
    page,
  }) => {
    for (const params of [
      { screen: 'card' },
      { screen: 'level', task: '1', prompt: '1', over: 'card' },
    ] as const) {
      await open(page, params);
      const gap = await page.evaluate(() => {
        const options = document.querySelector('[data-testid="question-card"] .tn-screen__options');
        const actions = document.querySelector('[data-testid="question-card"] .tn-screen__actions');
        if (options === null || actions === null) return Number.POSITIVE_INFINITY;
        return actions.getBoundingClientRect().top - options.getBoundingClientRect().bottom;
      });
      expect(gap, `${JSON.stringify(params)}: blank space between the options and Close`).toBeLessThan(64);
    }
  });

  test('is a sheet over the level, with the level still in view above it', async ({ page }) => {
    await open(page, { screen: 'level', task: '1', prompt: '1', over: 'card' });
    const viewport = page.viewportSize();
    const sheet = await page.locator('[data-testid="question-card"] .tn-screen__card').boundingBox();
    expect(sheet?.y ?? 0).toBeGreaterThan((viewport?.height ?? 0) * 0.2);
    const filter = await page.locator('#game').evaluate((game) => getComputedStyle(game).filter);
    expect(filter).toContain('brightness');
  });

  const ANSWERED: readonly (readonly [string, Params])[] = [
    ['in Study at 100 %', { screen: 'card', answered: '1' }],
    ['in Study at 200 %', { screen: 'card', answered: '1', textScale: '200' }],
    ['in Study in French at 200 %', { screen: 'card', answered: '1', textScale: '200', locale: 'fr' }],
    ['with a long question at 100 %', { screen: 'card', answered: '1', long: '1' }],
    ['over a level at 100 %', { screen: 'level', task: '1', prompt: '1', over: 'card', answered: '1' }],
    ['over a level at 200 % with less movement', { screen: 'level', task: '1', prompt: '1', over: 'card', answered: '1', textScale: '200', motion: 'reduced' }],
  ];

  for (const [label, params] of ANSWERED) {
    test(`brings "Next" into view with the result ${label}, and focus stays on the result`, async ({
      page,
    }) => {
      await open(page, params);
      await expect(page.getByTestId('question-feedback')).toBeVisible();
      await expect(page.getByTestId('question-next')).toBeInViewport();
      await expect(page.getByTestId('question-feedback')).toBeFocused();
    });
  }
});

/* ------------------------------------------------------------------- menus */

test.describe('the menus hug what they offer', () => {
  for (const [label, params] of [
    ['the level menu', { screen: 'level', task: '1', prompt: '1', over: 'menu' }],
    ['the exam menu', { screen: 'exam', over: 'menu', timer: 'running' }],
  ] as const) {
    test(`${label} sits at the foot of the screen with its items under its words`, async ({ page }) => {
      await open(page, params);
      const layout = await page.evaluate((root) => {
        const dialog = document.querySelector(`[data-testid="${root}"]`);
        const card = dialog?.querySelector('.tn-screen__card');
        const heading = card?.querySelector('h1');
        const actions = card?.querySelector('.tn-screen__actions');
        if (!card || !heading || !actions) return null;
        const words = [...card.children].filter((child) => child !== actions).at(-1) ?? heading;
        return {
          top: card.getBoundingClientRect().top,
          bottom: card.getBoundingClientRect().bottom,
          gap: actions.getBoundingClientRect().top - words.getBoundingClientRect().bottom,
          height: innerHeight,
        };
      }, label === 'the level menu' ? 'menu' : 'exam-menu');
      expect(layout).not.toBeNull();
      expect(layout?.top ?? 0, 'the sheet still starts at the top of the screen').toBeGreaterThan((layout?.height ?? 0) * 0.2);
      expect(layout?.bottom ?? 0).toBeGreaterThanOrEqual((layout?.height ?? 0) - 1);
      expect(layout?.gap ?? Number.POSITIVE_INFINITY, 'blank space between the words and the items').toBeLessThan(48);
    });
  }
});

/* ----------------------------------------------------------------- passport */

test.describe('the passport', () => {
  test('presses the earned stamp beside "Earned", as decoration, and none on an unearned slot', async ({ page }) => {
    await open(page, { screen: 'passport', art: 'fixture' });
    const stamp = page.getByTestId('passport-stamp-art-ottawa');
    await expect(stamp).toHaveAttribute('data-state', 'ready', { timeout: 10_000 });
    await expect(stamp).toHaveAttribute('aria-hidden', 'true');
    await expect(stamp).toHaveAttribute('data-inked', 'true');
    await expect(page.getByTestId('stamp-ottawa')).toHaveAccessibleName(/Earned/);
    await expect(page.getByTestId('stamp-halifax').locator('.tn-stamp')).toHaveCount(0);
  });

  test('keeps its contrast known with the stamp on the page', async ({ page }) => {
    await open(page, { screen: 'passport', art: 'fixture', locale: 'fr', textScale: '200' });
    await expect(page.getByTestId('passport-stamp-art-ottawa')).toHaveAttribute('data-state', 'ready');
    const results = await componentScan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
    const contrast = results.incomplete.filter((issue) => issue.id === 'color-contrast');
    expect(contrast, JSON.stringify(contrast, null, 2)).toEqual([]);
  });
});

/* ----------------------------------------------------------------- settings */

async function knobPlacement(page: Page, testId: string): Promise<'start' | 'end' | 'none'> {
  return page.evaluate((id) => {
    const control = document.querySelector(`[data-testid="${id}"]`);
    const track = control?.querySelector('.tn-switch');
    const knob = track?.querySelector('.tn-switch__knob');
    if (!track || !knob) return 'none';
    const outer = track.getBoundingClientRect();
    const inner = knob.getBoundingClientRect();
    return inner.left - outer.left < outer.right - inner.right ? 'start' : 'end';
  }, testId);
}

test.describe('Settings', () => {
  test('in high contrast, a switch that is on is filled and one that is off is an outline', async ({ page }) => {
    await open(page, { screen: 'settings', contrast: 'high', motion: 'reduced' });
    const fills = await page.evaluate(() => {
      const fill = (id: string): string =>
        getComputedStyle(document.querySelector(`[data-testid="${id}"]`) as Element).backgroundColor;
      return { on: fill('setting-reduced-motion'), off: fill('setting-dyslexia-font'), onWords: getComputedStyle(document.querySelector('[data-testid="setting-reduced-motion"]') as Element).color };
    });
    expect(fills.on).toBe('rgb(0, 0, 0)');
    expect(fills.onWords).toBe('rgb(255, 255, 255)');
    expect(fills.off).toBe('rgb(255, 255, 255)');
    /* And never by colour alone: the word, and the knob's place on its track. */
    await expect(page.getByTestId('setting-reduced-motion')).toContainText('On');
    expect(await knobPlacement(page, 'setting-reduced-motion')).toBe('end');
    /* A switch that is *off*, and no longer auto-move: that one ships on
       (ADR-0058), so it would prove the same thing twice and nothing about the
       off state. "Easier-to-read font" is off in every scan on this page. */
    expect(await knobPlacement(page, 'setting-dyslexia-font')).toBe('start');
  });

  test('in high contrast and French at 200 %, is clean and its contrast is known', async ({ page }) => {
    await open(page, { screen: 'settings', contrast: 'high', motion: 'reduced', locale: 'fr', textScale: '200' });
    const results = await componentScan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
    const contrast = results.incomplete.filter((issue) => issue.id === 'color-contrast');
    expect(contrast, JSON.stringify(contrast, null, 2)).toEqual([]);
  });

  test('draws the text size and its value on one line, above the slider', async ({ page }) => {
    for (const params of [{ screen: 'settings' }, { screen: 'settings', locale: 'fr', textScale: '200' }] as const) {
      await open(page, params);
      const label = await page.locator('#tn-settings-text-size-label').boundingBox();
      const value = await page.getByTestId('setting-text-size-value').boundingBox();
      const slider = await page.getByTestId('setting-text-size').boundingBox();
      expect(Math.abs((label?.y ?? 0) - (value?.y ?? 1000)), 'the value sits apart from its label').toBeLessThan(24);
      expect(slider?.y ?? 0).toBeGreaterThan(label?.y ?? 0);
    }
  });
});

test.describe('the character creator', () => {
  test('rings a focused chosen option with a dark halo, so the ring is not brass on brass', async ({ page }) => {
    await open(page, { screen: 'creator' });
    let halo = '';
    for (let step = 0; step < 40; step += 1) {
      await page.keyboard.press('Tab');
      halo = await page.evaluate(() => {
        const active = document.activeElement;
        if (active?.getAttribute('role') !== 'radio' || active.getAttribute('aria-checked') !== 'true') return '';
        return getComputedStyle(active).boxShadow;
      });
      if (halo !== '') break;
    }
    expect(halo, 'no chosen option ever took focus').not.toBe('');
    /* The halo (a spread ring), not the resting slab's offset shadow. */
    expect(halo).toMatch(/0px 0px 0px 8px/);
  });
});

/* ------------------------------------------------------------------ words */

test.describe('words are never split by the browser', () => {
  for (const params of [
    { screen: 'card', answered: '1', long: '1' },
    { screen: 'settings' },
    { screen: 'passport' },
    { screen: 'shell', view: 'map' },
    { screen: 'exam-start' },
    { screen: 'level', task: '1', prompt: '1', hint: '1' },
  ] as const) {
    test(`${params.screen} draws no automatic hyphen in French at 200 % text, and does not scroll sideways`, async ({
      page,
    }) => {
      await open(page, { ...params, locale: 'fr', textScale: '200' });
      const hyphenated = await page.evaluate(() =>
        [...document.querySelectorAll('.tn-screen *, .tn-hud *')]
          .filter((element) => getComputedStyle(element).hyphens === 'auto')
          .map((element) => element.getAttribute('data-testid') ?? element.className)
          .slice(0, 5),
      );
      expect(hyphenated, hyphenated.join(' | ')).toEqual([]);
      expect(await scrollsSideways(page)).toBe(false);
    });
  }
});

/* --------------------------------------------------------------------- exam */

test.describe('the exam', () => {
  test('puts Previous and Next on one row, and draws Previous on question 1 as not available', async ({ page }) => {
    await open(page, { screen: 'exam', timer: 'running' });
    const previous = await page.getByTestId('exam-previous').boundingBox();
    const next = await page.getByTestId('exam-next').boundingBox();
    expect(Math.abs((previous?.y ?? 0) - (next?.y ?? 1000))).toBeLessThan(2);
    await expect(page.getByTestId('exam-previous')).toHaveAttribute('aria-disabled', 'true');
    const styles = await page.evaluate(() => {
      const style = (id: string): string =>
        getComputedStyle(document.querySelector(`[data-testid="${id}"]`) as Element).borderTopStyle;
      return { previous: style('exam-previous'), next: style('exam-next') };
    });
    expect(styles.previous).toBe('dashed');
    expect(styles.next).toBe('solid');
  });

  /*
   * The third live-site audit, P2: 232 px of blank paper between the timer and
   * the buttons on a 400 x 900 phone. The sheet filled the window and the
   * actions are pinned to its foot, so the words ended halfway up the screen.
   */
  test.describe('the intro hugs what it says', () => {
    /**
     * The blank sheet between the LAST THING THIS SCREEN SAYS and its first
     * button — which is not the same as the space under the timer.
     *
     * This test used to measure `exam-begin` against `exam-timer` and failed on
     * CI at 139 px, with nothing wrong: the harness opens the ready state with
     * one subject of ten, so the screen legitimately draws three more lines
     * after the timer — "Subjects ready: 1 of 10", "More are coming." and "This
     * exam only asks about the subjects that are ready." Measured locally in
     * that state: 141 px from the timer and 24 px from the last of those lines.
     * The pair that answers "is there a column of white above the buttons" is
     * the last drawn words and the actions, whichever optional lines a state
     * draws, so that is the pair measured here.
     */
    const gapAboveTheButtons = async (
      page: Page,
    ): Promise<{ readonly gap: number; readonly last: string } | null> =>
      page.evaluate(() => {
        const card = document.querySelector<HTMLElement>('[data-testid="exam-start"] .tn-screen__card');
        const actions = card?.querySelector<HTMLElement>('.tn-screen__actions') ?? null;
        if (card === null || actions === null) return null;

        const said = [...card.children]
          .filter((child) => child !== actions)
          .flatMap((child) => [child, ...child.querySelectorAll('p, h1, h2, li, [role="switch"]')])
          .map((node) => ({
            box: node.getBoundingClientRect(),
            text: (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
          }))
          .filter((entry) => entry.box.height > 0);

        let last = said[0];
        if (last === undefined) return null;
        for (const entry of said) if (entry.box.bottom > last.box.bottom) last = entry;
        return { gap: actions.getBoundingClientRect().top - last.box.bottom, last: last.text.slice(0, 60) };
      });

    for (const [label, params] of [
      ['in English', {}],
      ['in French', { locale: 'fr' }],
      ['at 200 % text', { textScale: '200' }],
      ['in French at 200 % text', { locale: 'fr', textScale: '200' }],
    ] as const) {
      test(`puts the buttons under the words ${label}`, async ({ page }) => {
        await open(page, { screen: 'exam-start', ...params });
        const measured = await gapAboveTheButtons(page);
        expect(measured, 'the exam intro drew no words, or no actions').not.toBeNull();
        expect(
          measured?.gap ?? 0,
          `${String(Math.round(measured?.gap ?? 0))} px of blank sheet under "${measured?.last ?? ''}"`,
        ).toBeLessThanOrEqual(64);
        expect(measured?.gap ?? -1, 'the buttons are drawn over the words').toBeGreaterThanOrEqual(0);
      });
    }

    test('follows the timer directly where the timer is the last thing said', async ({ page }) => {
      /* `?subjects=0` is the build that draws no subjects line at all, so the
         timer group is the foot of the screen's words: 24 px, measured, where
         the audit found 232. */
      await open(page, { screen: 'exam-start', subjects: '0' });
      const timer = await page.getByTestId('exam-timer').boundingBox();
      const begin = await page.getByTestId('exam-begin').boundingBox();
      expect(timer, 'the timer group is not drawn').not.toBeNull();
      expect(begin, 'the primary action is not drawn').not.toBeNull();
      const gap = (begin?.y ?? 0) - ((timer?.y ?? 0) + (timer?.height ?? 0));
      expect(gap, `${String(Math.round(gap))} px of blank sheet above the buttons`).toBeLessThanOrEqual(64);
      expect(gap, 'the buttons are drawn over the words').toBeGreaterThanOrEqual(0);
    });

    test('rises from the bottom edge and never floats above it', async ({ page }) => {
      /*
       * A floor, not an equality. A hugging sheet that says more than a window
       * holds — French, and either language at 200 % text — is taller than the
       * window and scrolls, exactly as a question card does; measured here at
       * 888 px in French and 2 217 px at 200 % against an 844 px window. What
       * must never happen is the other way round: a short sheet floating with
       * white beneath it, which is where the actions leave a thumb's reach.
       */
      await open(page, { screen: 'exam-start' });
      const card = await page.locator('[data-testid="exam-start"] .tn-screen__card').boundingBox();
      const viewport = page.viewportSize();
      expect(card, 'the sheet is not drawn').not.toBeNull();
      expect(
        (card?.y ?? 0) + (card?.height ?? 0),
        'the sheet ends above the bottom of the window',
      ).toBeGreaterThanOrEqual((viewport?.height ?? 0) - 2);
    });
  });

  /*
   * The third live-site audit, P2: in French « Désactivé » fell to a third line
   * under the switch, where English kept "Off" beside the track. The state word
   * and the track are one signal read together — the word, the knob's place and
   * the fill — so the word belongs on the track's line while there is room.
   */
  for (const locale of ['en', 'fr'] as const) {
    test(`keeps the timer's state word beside its track in ${locale === 'fr' ? 'French' : 'English'}`, async ({
      page,
    }) => {
      await open(page, { screen: 'exam-start', locale });
      const placed = await page.evaluate(() => {
        const toggle = document.querySelector('[data-testid="exam-timer-toggle"]');
        const word = toggle?.querySelector('.tn-screen__state');
        const track = toggle?.querySelector('.tn-switch');
        if (word === undefined || word === null || track === undefined || track === null) return null;
        const a = word.getBoundingClientRect();
        const b = track.getBoundingClientRect();
        return { word: a.top, track: b.top, height: a.height, text: word.textContent ?? '' };
      });
      expect(placed, 'the timer switch has no state word or no track').not.toBeNull();
      expect(placed?.text.length ?? 0, 'the state is not said in a word').toBeGreaterThan(0);
      expect(
        Math.abs((placed?.word ?? 0) - (placed?.track ?? 0)),
        `"${placed?.text ?? ''}" is drawn on a line of its own, under the switch`,
      ).toBeLessThan(placed?.height ?? 0);
    });
  }

  test('draws the time limit inside the timer switch, under its label', async ({ page }) => {
    await open(page, { screen: 'exam-start' });
    const toggle = await page.getByTestId('exam-timer-toggle').boundingBox();
    const limit = await page.getByTestId('exam-timer-limit').boundingBox();
    expect(limit?.y ?? 0).toBeGreaterThanOrEqual(toggle?.y ?? 0);
    expect((limit?.y ?? 0) + (limit?.height ?? 0)).toBeLessThanOrEqual((toggle?.y ?? 0) + (toggle?.height ?? 0) + 1);
    await expect(page.getByTestId('exam-timer-toggle')).toContainText('30 minutes');
  });
});

/* ------------------------------------------------- the fourth live audit */

const LARGE_AND_SMALL: readonly (readonly [string, Params])[] = [
  ['in English', {}],
  ['in French', { locale: 'fr' }],
  ['at 200 % text', { textScale: '200' }],
  ['in French at 200 % text', { locale: 'fr', textScale: '200' }],
];

/*
 * P1: "Delete my progress" asked its question at the very top of the screen and
 * drew its two answers at the very bottom, with 646 px of blank paper between
 * them on a 400 x 900 phone — a page that had failed to load. The confirmation
 * now hugs what it asks (`tn-screen--hug`, ADR-0045 §3 and §5).
 *
 * Measured as the pair that answers the question: the **last thing drawn**
 * before the answers, against the answers. Not the heading, because the import
 * confirmation draws a second sentence under its question and a gap measured
 * from the heading there would be the cost of a real line of text.
 */
test.describe('the delete question hugs its answers', () => {
  for (const [label, params] of LARGE_AND_SMALL) {
    test(`draws "Delete everything" under the question ${label}`, async ({ page }) => {
      await open(page, { screen: 'settings', save: '1', ...params });
      await page.getByTestId('save-clear').click();
      await expect(page.getByTestId('save-clear-confirm')).toBeVisible();

      const layout = await page.evaluate(() => {
        const dialog = document.querySelector('[data-testid="save-clear-confirm"]');
        const card = dialog?.querySelector('.tn-screen__card');
        const actions = card?.querySelector('.tn-screen__actions');
        if (!card || !actions) return null;
        const said = [...card.children]
          .filter((child) => child !== actions && !(child as HTMLElement).hidden)
          .at(-1);
        if (said === undefined) return null;
        return {
          gap: actions.getBoundingClientRect().top - said.getBoundingClientRect().bottom,
          bottom: card.getBoundingClientRect().bottom,
          height: innerHeight,
        };
      });

      expect(layout, 'the confirmation drew no question or no answers').not.toBeNull();
      expect(
        layout?.gap ?? Number.POSITIVE_INFINITY,
        'blank paper between the question and the answer to it',
      ).toBeLessThan(48);
      /* Still at the foot of the screen, where a thumb is. */
      expect(layout?.bottom ?? 0).toBeGreaterThanOrEqual((layout?.height ?? 0) - 1);
    });
  }

  test('keeps the safe answer highlighted for a switch player', async ({ page }) => {
    /* The layout moved; `TN-SAVE-08` did not. A switch's first press must not
       be able to delete everything. */
    await open(page, { screen: 'settings', save: '1', switch: '1' });
    await page.getByTestId('save-clear').click();
    await expect(page.getByTestId('save-clear-keep')).toHaveAttribute(HIGHLIGHT_ATTRIBUTE, 'true');
    await expect(page.getByTestId('save-clear-yes')).not.toHaveAttribute(HIGHLIGHT_ATTRIBUTE, 'true');
  });
});

/*
 * P1: at 200 % text the dialogue's top was cut off. The surface is one scroll
 * box reused line after line, and a line opened after the player had scrolled
 * down to reach the way on opened at the *last* line's offset: at Halifax's
 * town clock the second line opened at `scrollTop` 31 — 235 in French — with
 * the portrait and "The guide" above the top of the screen and nothing saying
 * the card continued upward.
 *
 * `?relines=1` hides the surface between the two lines, because that is the
 * route and because it is what makes the defect reproducible: a scroll set on a
 * hidden box is discarded, and the browser puts the old offset back when the
 * box is displayed again.
 */
test.describe('a second line of dialogue', () => {
  for (const [label, params] of LARGE_AND_SMALL) {
    test(`opens at its own top, with the speaker on screen, ${label}`, async ({ page }) => {
      await open(page, { screen: 'dialogue', relines: '1', ...params });

      const seen = await page.evaluate(() => {
        const dialog = document.querySelector('[data-testid="dialogue"]');
        const speaker = document.querySelector('[data-testid="dialogue-speaker"]');
        const portrait = document.querySelector('[data-testid="dialogue-portrait"]');
        if (dialog === null || speaker === null) return null;
        return {
          scrollTop: dialog.scrollTop,
          speakerTop: speaker.getBoundingClientRect().top,
          portraitTop: portrait?.getBoundingClientRect().top ?? null,
        };
      });

      expect(seen, 'the dialogue drew no speaker').not.toBeNull();
      expect(seen?.scrollTop ?? -1, 'the line opened where the last one was left').toBe(0);
      expect(
        seen?.speakerTop ?? -1,
        'who is speaking is above the top of the screen',
      ).toBeGreaterThanOrEqual(0);
      if (seen?.portraitTop !== null && seen?.portraitTop !== undefined) {
        expect(seen.portraitTop, 'the portrait is above the top of the screen').toBeGreaterThanOrEqual(0);
      }
    });
  }
});

