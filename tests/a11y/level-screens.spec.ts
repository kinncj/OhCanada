import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { HARNESS_URL } from './playwright.config';

/**
 * The level's UI, scanned in a real browser: the HUD, the menu, the interact
 * prompt, the POI card, and the two screens a player sees instead of a level.
 *
 * **This file is where the two disabled rules come back on.**
 *
 * `region` and `landmark-one-main` are disabled in `slice1-screens.spec.ts`,
 * with the reason written beside them: a single modal over an `aria-hidden`
 * canvas has no document landmarks, and inventing a `<main>` to satisfy a
 * scanner is not accessibility. `TN-HUD` builds the page those rules describe —
 * one `<main>`, a named `hud` region, real content outside the modals — and
 * `TN-HUD-07` requires both rules enabled for a whole-page scan. A rule disabled
 * because a page did not exist yet has to be re-enabled when the page exists, or
 * the reason has quietly become a habit. {@link FULL_PAGE} is that ruleset:
 * nothing is disabled in it at all.
 *
 * **What this still does not prove.** The page below is the harness's page, not
 * `dist/`. `app/bootstrap` does not yet mount these screens, so a scan of the
 * production artefact would be a scan of the foundation shell. `OQ-TEST-2` stays
 * open until the composition root routes them, and no report may describe this
 * suite as proving the shipped page. What it does prove is that the landmark
 * structure `TN-HUD-07` specifies exists, is scanned with the rules that judge
 * it, and passes — including with a modal open over it.
 */

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const RULESET = [...WCAG, 'best-practice'];

/** Component scans: the same two page-level rules are off, for the same reason. */
const COMPONENT_DISABLED = ['region', 'landmark-one-main'];

const componentScan = (page: Page) =>
  new AxeBuilder({ page }).withTags([...RULESET]).disableRules(COMPONENT_DISABLED).exclude('canvas');

/** Whole-page scan. Nothing disabled — that is the point of this constant. */
const FULL_PAGE = RULESET;
const pageScan = (page: Page) => new AxeBuilder({ page }).withTags([...FULL_PAGE]);

const violationsOf = (results: { violations: unknown[] }) =>
  JSON.stringify(results.violations, null, 2);

interface HarnessOptions {
  readonly locale?: 'en' | 'fr';
  readonly textScale?: number;
  readonly singleSwitch?: boolean;
  readonly contrast?: 'high';
  readonly font?: 'dyslexia';
  readonly motion?: 'reduced';
  /** `level` only: the state of the strip. */
  readonly task?: boolean;
  readonly prompt?: boolean;
  readonly warning?: boolean;
  readonly stalled?: boolean;
  /** A modal open over the running level. */
  readonly over?: 'menu' | 'settings' | 'card' | 'poi';
}

type ScreenName = 'level' | 'level-loading' | 'level-error' | 'poi';

const ROOT_TEST_ID: Readonly<Record<ScreenName, string>> = {
  level: 'hud',
  'level-loading': 'level-loading',
  'level-error': 'level-error',
  poi: 'poi-card',
};

/** Open one screen and wait for the marker that says it is really there. */
async function open(
  page: Page,
  screen: ScreenName,
  options: HarnessOptions = {},
): Promise<Locator> {
  const params = new URLSearchParams({ screen });
  if (options.locale !== undefined) params.set('locale', options.locale);
  if (options.textScale !== undefined) params.set('textScale', String(options.textScale));
  if (options.singleSwitch === true) params.set('switch', '1');
  if (options.contrast !== undefined) params.set('contrast', options.contrast);
  if (options.font !== undefined) params.set('font', options.font);
  if (options.motion !== undefined) params.set('motion', options.motion);
  if (options.task === true) params.set('task', '1');
  if (options.prompt === true) params.set('prompt', '1');
  if (options.warning === true) params.set('warning', '1');
  if (options.stalled === true) params.set('stalled', '1');
  if (options.over !== undefined) params.set('over', options.over);

  const response = await page.goto(`${HARNESS_URL}?${params.toString()}`);
  expect(response, 'no response from the harness server').not.toBeNull();
  expect(response?.status()).toBeLessThan(400);

  await page.waitForSelector(`html[data-tn-harness-ready="${screen}"]`, { timeout: 15_000 });

  const root = page.locator(`[data-testid="${ROOT_TEST_ID[screen]}"]`);
  await expect(root, `${screen} never appeared`).toBeVisible();
  return root;
}

/** Every visible interactive target smaller than 44 CSS px, named. */
async function undersizedTargets(page: Page): Promise<string[]> {
  const targets = page.locator(
    'button, a[href], input:not([type="hidden"]), select, textarea, ' +
      '[role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="slider"]',
  );
  const count = await targets.count();
  expect(count, 'no interactive targets found — this test must not pass vacuously').toBeGreaterThan(
    0,
  );

  const tooSmall: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const target = targets.nth(index);
    if (!(await target.isVisible())) continue;
    const box = await target.boundingBox();
    if (box === null) continue;
    if (box.width < 44 || box.height < 44) {
      const name = await target.evaluate(
        (element) =>
          `${element.tagName.toLowerCase()}[${element.getAttribute('data-testid') ?? '?'}]`,
      );
      tooSmall.push(`${name} ${Math.round(box.width)}x${Math.round(box.height)}`);
    }
  }
  return tooSmall;
}

const scrollsSideways = (page: Page): Promise<boolean> =>
  page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );

const focusedTestId = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const element = document.activeElement;
    if (element === null) return 'none';
    return (
      element.getAttribute('data-testid') ??
      (element.id !== '' ? `#${element.id}` : element.tagName.toLowerCase())
    );
  });

test.describe('the page the HUD builds', () => {
  test('has one main, a named hud region, and passes with region and landmark-one-main on', async ({
    page,
  }) => {
    await open(page, 'level', { task: true, prompt: true, warning: true });

    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('[data-testid="hud"]')).toHaveAccessibleName(/\S/);
    await expect(page.locator('canvas')).toHaveAttribute('aria-hidden', 'true');
    /* The canvas is inside the one main, so main is real content and not a
       wrapper invented for a scanner. */
    await expect(page.locator('main canvas')).toHaveCount(1);

    const results = await pageScan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
  });

  test('really runs region and landmark-one-main, rather than passing without them', async ({
    page,
  }) => {
    /*
     * "No violations" is also what a scan says about a rule it never ran. Both
     * rules have to appear somewhere in the result — as a pass, an incomplete or
     * an inapplicable — for the green tick above to mean what it claims.
     */
    await open(page, 'level', { task: true, prompt: true, warning: true });
    const results = await pageScan(page).analyze();
    const seen = new Set(
      [
        ...results.passes,
        ...results.violations,
        ...results.incomplete,
        ...results.inapplicable,
      ].map((entry) => entry.id),
    );

    expect([...seen], 'the region rule did not run').toContain('region');
    expect([...seen], 'the landmark-one-main rule did not run').toContain('landmark-one-main');
  });

  test('the whole-page rules can fail — the negative control', async ({ page }) => {
    /*
     * A scan that cannot go red proves nothing, and these two rules in
     * particular were switched off for a whole slice of this project's life.
     *
     * Take away both landmarks — unwrap the `<main>` and strip the `hud`
     * region's accessible name, which is what makes a `<section>` a landmark at
     * all — and the strip's text is content outside every landmark, which is
     * exactly what `region` exists to report.
     */
    await open(page, 'level', { task: true, warning: true });
    await page.evaluate(() => {
      const main = document.querySelector('main');
      if (main === null) throw new Error('the page has no main to unwrap');
      const replacement = document.createElement('div');
      replacement.append(...main.childNodes);
      main.replaceWith(replacement);

      const hud = document.querySelector('[data-testid="hud"]');
      if (hud === null) throw new Error('the page has no hud region');
      hud.removeAttribute('aria-label');
    });

    const results = await pageScan(page).analyze();
    const ids = results.violations.map((violation) => violation.id);
    expect(
      ids,
      `removing the landmarks produced no violation: ${violationsOf(results)}`,
    ).toContain('region');
  });

  test('removing the main wrapper alone does not make landmark-one-main fire', async ({
    page,
  }) => {
    /*
     * `TN-HUD-10`, third scenario, and the reason the negative control above
     * strips *both* landmarks rather than just the `<main>`.
     *
     * Take away the `<main>` and leave the region named, and axe still reports
     * no `landmark-one-main` violation: the rule passes for a page whose content
     * is inside another landmark (`passForModal`). A negative control that only
     * unwrapped the `<main>` would therefore be green, and would have proved
     * nothing at all.
     *
     * `OQ-HUD-7` records the trade: this asserts what axe does *today*. If a
     * future axe tightens the rule, this test goes red — which is the point. It
     * is not flaky; it is the notice that the tool changed and the control above
     * can be simplified. Read the open question before deleting it.
     */
    await open(page, 'level', { task: true, warning: true });
    await page.evaluate(() => {
      const main = document.querySelector('main');
      if (main === null) throw new Error('the page has no main to unwrap');
      const replacement = document.createElement('div');
      replacement.append(...main.childNodes);
      main.replaceWith(replacement);
    });

    await expect(page.locator('main')).toHaveCount(0);
    await expect(page.locator('[data-testid="hud"]')).toHaveAccessibleName(/\S/);

    const results = await pageScan(page).analyze();
    const ids = results.violations.map((violation) => violation.id);
    expect(
      ids,
      'axe now fails landmark-one-main on a page with no main: simplify the negative control',
    ).not.toContain('landmark-one-main');
  });

  for (const over of ['menu', 'settings', 'card', 'poi'] as const) {
    test(`stays clean with ${over} open over the level`, async ({ page }) => {
      await open(page, 'level', { task: true, prompt: true, warning: true, over });

      /* One screen at a time: exactly one dialog, and the page behind it inert. */
      await expect(page.locator('[aria-modal="true"]:not([hidden])')).toHaveCount(1);
      const results = await pageScan(page).analyze();
      expect(results.violations, violationsOf(results)).toEqual([]);
    });
  }

  test('keeps exactly one live region, whatever is on the page', async ({ page }) => {
    for (const over of [undefined, 'menu', 'card'] as const) {
      await open(page, 'level', {
        warning: true,
        prompt: true,
        ...(over === undefined ? {} : { over }),
      });
      expect(await page.locator('[aria-live]').count(), `with ${String(over)} open`).toBe(1);
    }
  });

  test('is clean in French, in high contrast, and with the dyslexia font', async ({ page }) => {
    for (const options of [
      { locale: 'fr' as const },
      { contrast: 'high' as const },
      { font: 'dyslexia' as const },
    ]) {
      await open(page, 'level', { task: true, prompt: true, warning: true, ...options });
      const results = await pageScan(page).analyze();
      expect(results.violations, `${JSON.stringify(options)}: ${violationsOf(results)}`).toEqual([]);
    }
  });
});

test.describe('the HUD', () => {
  test('says what the player is doing, in text', async ({ page }) => {
    await open(page, 'level');
    await expect(page.locator('[data-testid="hud-mode-label"]')).toHaveText('Skating');
    await expect(page.locator('[data-testid="menu-button"]')).toHaveText('Menu');
  });

  test('shows the tracker only when there is a task', async ({ page }) => {
    await open(page, 'level');
    await expect(page.locator('[data-testid="hud-quest-tracker"]')).toHaveCount(0);

    await open(page, 'level', { task: true });
    await expect(page.locator('[data-testid="hud-quest-tracker"]')).toHaveText(
      'Task: Answer 3 questions (0 of 3)',
    );
  });

  test('keeps every control at 44 CSS px, at 100 % and at 200 % text', async ({ page }) => {
    await open(page, 'level', { task: true, prompt: true, warning: true });
    expect(await undersizedTargets(page)).toEqual([]);

    await open(page, 'level', { task: true, prompt: true, warning: true, textScale: 200 });
    expect(await undersizedTargets(page), 'at 200 % text').toEqual([]);
  });

  test('does not scroll the page sideways at 200 %, in French, with the dyslexia font', async ({
    page,
  }) => {
    /* TN-LEVEL-10: the prompt has to fit the whole of « Parler à l'agent ». */
    await open(page, 'level', {
      locale: 'fr',
      textScale: 200,
      font: 'dyslexia',
      task: true,
      prompt: true,
      warning: true,
    });
    expect(await scrollsSideways(page)).toBe(false);
    await expect(page.locator('[data-testid="interact-prompt"]')).toHaveText("Parler à l'agent");
  });

  test('stays in the lower third, so the playfield is not covered', async ({ page }) => {
    /* TN-HUD-01 and TN-LEVEL-04: the skater is drawn in the upper two thirds. */
    await open(page, 'level', { task: true, prompt: true, warning: true, textScale: 200 });
    const box = await page.locator('[data-testid="hud"]').boundingBox();
    expect(box).not.toBeNull();
    const height = page.viewportSize()?.height ?? 844;
    expect(box?.y ?? 0, 'the HUD reaches above the lower third').toBeGreaterThanOrEqual(
      height * (2 / 3) - 1,
    );
  });

  test('lets a tap through to the play area behind it', async ({ page }) => {
    /* TN-HUD-01: the HUD does not take the input the level needs. The strip is
       pointer-events: none and only its controls opt back in. */
    await open(page, 'level');
    const passes = await page.evaluate(() => {
      const hud = document.querySelector<HTMLElement>('[data-testid="hud"]');
      if (hud === null) return 'no hud';
      const box = hud.getBoundingClientRect();
      /* A point inside the strip but not on a control. */
      const target = document.elementFromPoint(box.left + 4, box.top + 4);
      return target === null ? 'nothing' : (target.tagName.toLowerCase());
    });
    expect(passes).not.toBe('button');
  });

  test('is operable from the keyboard, and gives focus back', async ({ page }) => {
    /* TN-HUD-05. */
    await open(page, 'level');
    await page.locator('[data-testid="menu-button"]').focus();
    await page.keyboard.press('Enter');

    const menu = page.locator('[data-testid="menu"]');
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAccessibleName('Menu');
    expect(await menu.evaluate((element) => element.contains(document.activeElement))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    expect(await focusedTestId(page)).toBe('menu-button');
  });

  test('cannot be reached behind an open modal', async ({ page }) => {
    /* TN-HUD-04. The trap inerts the page, which removes menu-button from the
       Tab order and from hit-testing in one mechanism. */
    await open(page, 'level', { over: 'card' });
    const inert = await page.evaluate(
      () => document.querySelector('[data-testid="menu-button"]')?.closest('[inert]') !== null,
    );
    expect(inert).toBe(true);
  });

  test('removes animation under reduced motion and keeps the words', async ({ page }) => {
    await open(page, 'level', { motion: 'reduced', task: true, warning: true });
    await expect(page.locator('html')).toHaveAttribute('data-tn-motion', 'reduced');

    const moving = await page.evaluate(() => {
      const bad: string[] = [];
      for (const element of document.querySelectorAll<HTMLElement>('.tn-hud, .tn-hud *')) {
        const style = getComputedStyle(element);
        if (style.animationName !== 'none' && style.animationDuration !== '0s') {
          bad.push(`${element.tagName} animates`);
        }
        if (style.transitionDuration !== '0s') bad.push(`${element.tagName} transitions`);
      }
      return bad;
    });
    expect(moving, moving.join(' | ')).toEqual([]);
    await expect(page.locator('[data-testid="hud-quest-tracker"]')).toBeVisible();
    await expect(page.locator('[data-testid="storage-warning"]')).toBeVisible();
  });
});

test.describe('the storage warning', () => {
  test('is absent from the accessibility tree when nothing is wrong', async ({ page }) => {
    /*
     * TN-HUD-03, and the defect axe found in this directory before: a CSS rule
     * overriding `[hidden]`. Absent means absent — not `display: none`, not a
     * `[hidden]` attribute something else can style away.
     */
    await open(page, 'level');
    await expect(page.locator('[data-testid="storage-warning"]')).toHaveCount(0);
  });

  test('says both sentences, is not a second announcer, and offers the way out', async ({
    page,
  }) => {
    await open(page, 'level', { warning: true });
    const warning = page.locator('[data-testid="storage-warning"]');

    await expect(warning).toContainText('This browser is not saving your progress.');
    await expect(warning).toContainText(
      'You can keep playing, but everything will be gone when you close the tab.',
    );
    await expect(warning).not.toHaveAttribute('aria-live', /.*/);
    await expect(page.locator('[data-testid="save-export"]')).toBeVisible();
    expect(await page.locator('[aria-live]').count()).toBe(1);
  });

  test('does not stop the tracker or the menu being used', async ({ page }) => {
    await open(page, 'level', { warning: true, task: true });
    await expect(page.locator('[data-testid="hud-quest-tracker"]')).toBeVisible();
    await page.locator('[data-testid="menu-button"]').click();
    await expect(page.locator('[data-testid="menu"]')).toBeVisible();
  });

  test('is French when the game is', async ({ page }) => {
    await open(page, 'level', { warning: true, locale: 'fr' });
    await expect(page.locator('[data-testid="storage-warning"]')).toContainText(
      "Ce navigateur n'enregistre pas votre progression.",
    );
  });
});

test.describe('the menu', () => {
  test('is a named modal dialog with three items and a way out', async ({ page }) => {
    await open(page, 'level', { over: 'menu' });
    const menu = page.locator('[data-testid="menu"]');

    await expect(menu).toHaveAttribute('role', 'dialog');
    await expect(menu).toHaveAttribute('aria-modal', 'true');
    await expect(menu).toHaveAccessibleName('Menu');
    await expect(page.locator('[data-testid="menu-settings"]')).toHaveText('Settings');
    await expect(page.locator('[data-testid="menu-study"]')).toHaveText('Study');
    await expect(page.locator('[data-testid="menu-passport"]')).toHaveText('See my passport');
    await expect(page.locator('[data-testid="menu-close"]')).toHaveText('Close');
  });

  test('is French', async ({ page }) => {
    await open(page, 'level', { over: 'menu', locale: 'fr' });
    await expect(page.locator('[data-testid="menu-settings"]')).toHaveText('Réglages');
    await expect(page.locator('[data-testid="menu-study"]')).toHaveText('Réviser');
    await expect(page.locator('[data-testid="menu-passport"]')).toHaveText('Voir mon passeport');
    await expect(page.locator('[data-testid="menu-close"]')).toHaveText('Fermer');
    const wording = (await page.locator('[data-testid="menu"]').textContent()) ?? '';
    expect(/\s[?!]/.test(wording), 'Canadian French puts no space before ? or !').toBe(false);
  });

  test('every item is reachable at 200 % text, and none is truncated', async ({ page }) => {
    await open(page, 'level', { over: 'menu', locale: 'fr', textScale: 200 });
    expect(await scrollsSideways(page)).toBe(false);
    for (const testId of ['menu-settings', 'menu-study', 'menu-passport', 'menu-close']) {
      const item = page.locator(`[data-testid="${testId}"]`);
      await item.scrollIntoViewIfNeeded();
      await expect(item).toBeVisible();
      const clipped = await item.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
      expect(clipped, `${testId} is truncated`).toBe(false);
    }
  });
});

test.describe('the interact prompt and the landmark card', () => {
  test('the prompt is a button carrying the whole offer', async ({ page }) => {
    await open(page, 'level', { prompt: true });
    const prompt = page.locator('[data-testid="interact-prompt"]');
    await expect(prompt).toHaveRole('button');
    await expect(prompt).toHaveText('Talk to the officer');
    const box = await prompt.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  });

  test('the card is a named dialog with the heading and the sentence', async ({ page }) => {
    const card = await open(page, 'poi');
    await expect(card).toHaveAttribute('role', 'dialog');
    await expect(card).toHaveAccessibleName('Parliament Hill');
    await expect(card).toContainText(
      'The Parliament buildings are in Ottawa. The tall clock tower is called the Peace Tower.',
    );
    await expect(page.locator('[data-testid="poi-card-close"]')).toHaveText('Close');

    const results = await componentScan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
  });

  test('closing the card puts focus back on the prompt', async ({ page }) => {
    /* TN-LEVEL-05, with the card opened over a real HUD. */
    await open(page, 'level', { prompt: true, over: 'poi' });
    await page.locator('[data-testid="poi-card-close"]').click();
    await expect(page.locator('[data-testid="poi-card"]')).toBeHidden();
    expect(await focusedTestId(page)).toBe('interact-prompt');
  });

  test('the card is French', async ({ page }) => {
    const card = await open(page, 'poi', { locale: 'fr' });
    await expect(card).toHaveAccessibleName('La Colline du Parlement');
    await expect(card).toContainText("s'appelle la tour de la Paix.");
    await expect(page.locator('[data-testid="poi-card-close"]')).toHaveText('Fermer');
  });
});

test.describe('the level is loading, or did not load', () => {
  test('the loading screen shows text and never claims progress', async ({ page }) => {
    const root = await open(page, 'level-loading');
    await expect(root).toHaveAccessibleName('Ottawa');
    await expect(root).toContainText('Getting the canal ready.');

    const wording = ((await root.textContent()) ?? '').toLowerCase();
    for (const forbidden of ['%', '…', 'please wait']) {
      expect(wording, `"${forbidden}" reads as a progress bar`).not.toContain(forbidden);
    }

    const results = await componentScan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
  });

  test('a stalled load offers a focusable way out', async ({ page }) => {
    await open(page, 'level-loading', { stalled: true });
    const back = page.locator('[data-testid="level-loading-back"]');
    await expect(back).toBeVisible();
    await back.focus();
    expect(await focusedTestId(page)).toBe('level-loading-back');
  });

  test('the error screen is an alertdialog with both ways on', async ({ page }) => {
    const root = await open(page, 'level-error');
    await expect(root).toHaveAttribute('role', 'alertdialog');
    await expect(root).toHaveAccessibleName('We could not load Ottawa.');
    await expect(root).toHaveAccessibleDescription('Check your connection and try again.');
    await expect(page.locator('[data-testid="level-retry"]')).toHaveText('Try again');
    await expect(page.locator('[data-testid="level-back"]')).toHaveText('Go back');

    const results = await componentScan(page).analyze();
    expect(results.violations, violationsOf(results)).toEqual([]);
  });

  test('the error screen is French, and readable at 200 %', async ({ page }) => {
    const root = await open(page, 'level-error', { locale: 'fr', textScale: 200 });
    await expect(root).toContainText("Nous n'avons pas pu charger Ottawa.");
    await expect(root).toContainText('Vérifiez votre connexion et réessayez.');
    await expect(page.locator('[data-testid="level-retry"]')).toHaveText('Réessayer');
    await expect(page.locator('[data-testid="level-back"]')).toHaveText('Retour');
    expect(await scrollsSideways(page)).toBe(false);
    expect(await undersizedTargets(page)).toEqual([]);
  });

  test('neither screen says there is no level to play', async ({ page }) => {
    /*
     * The caption that was found over the running Ottawa level said exactly
     * that. It is not true of a level that is opening, and it is not true of one
     * that failed to arrive either.
     */
    for (const screen of ['level-loading', 'level-error'] as const) {
      await open(page, screen);
      const wording = ((await page.locator('body').textContent()) ?? '').toLowerCase();
      expect(wording, screen).not.toContain('no level to play');
      expect(wording, screen).not.toContain('foundation build');
    }
  });
});

test.describe('one switch', () => {
  test('reaches and chooses a menu item with short and long presses', async ({ page }) => {
    /* TN-HUD-06. Nothing scans on its own: the highlight only moves when the
       player presses. */
    await open(page, 'level', { over: 'menu', singleSwitch: true });

    await page.mouse.move(195, 400);
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.locator('[data-testid="menu-study"]')).toHaveAttribute(
      'data-switch-highlight',
      'true',
    );

    await page.waitForTimeout(1_000);
    await expect(page.locator('[data-testid="menu-study"]')).toHaveAttribute(
      'data-switch-highlight',
      'true',
    );

    await page.mouse.down();
    await page.waitForTimeout(800);
    await page.mouse.up();
    await expect(page.locator('[data-testid="menu"]')).toBeHidden();
  });
});
