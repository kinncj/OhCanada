import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { text } from '@ui/copy';

import { HARNESS_URL } from './playwright.config';

/**
 * "A new version is ready" (slice F3, ADR-0034, `app/ui/update-notice.ts`).
 *
 * The harness draws it where the composition root does — first in the page's one
 * `<main>` — over the two pages a player can be looking at when a new build takes
 * over: the title screen, and a level's HUD. Both are whole pages, so **nothing is
 * disabled in the ruleset**: `region` and `landmark-one-main` run, as they do in
 * `shell.spec.ts`, and the notice has to sit inside the landmark rather than
 * beside it.
 *
 * What this file proves that the unit suite cannot: that the controls are 44 px
 * or more, that nothing clips at 200 % text in French, that contrast is computable
 * and passes, that the edges survive high contrast and forced colours, that a
 * keyboard reaches both controls, and that one switch reaches Reload. The trigger —
 * a new worker taking over — is `tests/e2e/update-notice.spec.ts`.
 */

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const RULESET = [...WCAG, 'best-practice'];

/** Whole-page scan. Nothing disabled. */
const scan = (page: Page) => new AxeBuilder({ page }).withTags([...RULESET]).exclude('canvas');

const violationsOf = (results: { violations: unknown[] }) =>
  JSON.stringify(results.violations, null, 2);

type Where = 'shell' | 'level';

interface NoticeOptions {
  readonly where?: Where;
  readonly locale?: 'en' | 'fr';
  readonly textScale?: number;
  readonly contrast?: 'high';
  readonly font?: 'dyslexia';
  readonly motion?: 'reduced';
  readonly singleSwitch?: boolean;
}

/** Open the harness with the notice up, and wait until it is really there. */
async function open(page: Page, options: NoticeOptions = {}): Promise<Locator> {
  const params = new URLSearchParams({ screen: 'update-notice' });
  if (options.where === 'level') params.set('in', 'level');
  if (options.locale !== undefined) params.set('locale', options.locale);
  if (options.textScale !== undefined) params.set('textScale', String(options.textScale));
  if (options.contrast !== undefined) params.set('contrast', options.contrast);
  if (options.font !== undefined) params.set('font', options.font);
  if (options.motion !== undefined) params.set('motion', options.motion);
  if (options.singleSwitch === true) params.set('switch', '1');

  const response = await page.goto(`${HARNESS_URL}?${params.toString()}`);
  expect(response, 'no response from the harness server').not.toBeNull();
  expect(response?.status()).toBeLessThan(400);
  await page.waitForSelector('html[data-tn-harness-ready="update-notice"]', { timeout: 15_000 });

  const notice = page.locator('[data-testid="update-notice"]');
  await expect(notice, 'the notice never appeared').toBeVisible();
  return notice;
}

/** No violation on the page, and contrast inside the notice proven rather than "incomplete". */
async function expectClean(page: Page, label: string): Promise<void> {
  const results = await scan(page).analyze();
  expect(results.violations, `${label}: ${violationsOf(results)}`).toEqual([]);

  const contrast = await new AxeBuilder({ page })
    .include('[data-testid="update-notice"]')
    .withRules(['color-contrast'])
    .analyze();
  expect(contrast.violations, `${label}: ${violationsOf(contrast)}`).toEqual([]);
  expect(
    contrast.incomplete,
    `${label}: the notice's contrast is unknown, not proven: ${JSON.stringify(contrast.incomplete, null, 2)}`,
  ).toEqual([]);
}

const WHERE: readonly Where[] = ['shell', 'level'];

test.describe('the update notice', () => {
  for (const where of WHERE) {
    for (const locale of ['en', 'fr'] as const) {
      test(`over the ${where}, in ${locale}: a status line, spoken once, taking no focus, and clean`, async ({
        page,
      }) => {
        const notice = await open(page, { where, locale });

        const message = notice.locator('[data-testid="update-notice-message"]');
        await expect(message).toHaveText(text(locale, 'update.ready'));
        await expect(message).toHaveAttribute('role', 'status');
        /* A status for what it is, and `aria-live="off"` so it is not a second announcer. */
        await expect(message).toHaveAttribute('aria-live', 'off');
        expect(await page.locator('[aria-live]:not([aria-live="off"])').count()).toBe(1);
        await expect(page.locator('#tn-live-region')).toHaveText(text(locale, 'update.ready'));

        await expect(notice).toHaveAttribute('lang', locale);
        await expect(notice).not.toHaveAttribute('role', /.+/);
        expect(await notice.locator('[role="dialog"], [aria-modal]').count()).toBe(0);
        await expect(notice.locator('[data-testid="update-notice-reload"]')).toHaveText(
          text(locale, 'update.reload'),
        );
        await expect(notice.locator('[data-testid="update-notice-dismiss"]')).toHaveText(
          text(locale, 'common.close'),
        );

        const focusInNotice = await page.evaluate(
          () =>
            (document.activeElement?.closest('[data-testid="update-notice"]') ?? null) !== null,
        );
        expect(focusInNotice, 'the notice took focus').toBe(false);

        await expectClean(page, `${where}, ${locale}`);
      });
    }

    test(`over the ${where}, at 200 % text in French: nothing clipped, every control at least 44 px`, async ({
      page,
    }) => {
      const notice = await open(page, { where, locale: 'fr', textScale: 200 });

      const parts = await notice.evaluate((root) =>
        [root, ...Array.from(root.querySelectorAll('p, button'))].map((part) => {
          const box = part.getBoundingClientRect();
          return {
            name: part.getAttribute('data-testid') ?? part.tagName,
            tag: part.tagName,
            clipped: part.scrollWidth > part.clientWidth + 1,
            width: box.width,
            height: box.height,
          };
        }),
      );
      expect(
        parts.filter((part) => part.clipped),
        JSON.stringify(parts, null, 2),
      ).toEqual([]);

      const controls = parts.filter((part) => part.tag === 'BUTTON');
      expect(controls).toHaveLength(2);
      for (const control of controls) {
        expect(control.width, `${control.name} is narrower than 44 px`).toBeGreaterThanOrEqual(44);
        expect(control.height, `${control.name} is shorter than 44 px`).toBeGreaterThanOrEqual(44);
      }

      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        'the page scrolls sideways',
      ).toBe(true);
      await expectClean(page, `${where}, French, 200 %`);
    });

    test(`over the ${where}, in high contrast: clean, and both controls keep a drawn edge`, async ({
      page,
    }) => {
      const notice = await open(page, { where, contrast: 'high' });
      await expectClean(page, `${where}, high contrast`);

      const edges = await notice
        .locator('button')
        .evaluateAll((buttons) => buttons.map((button) => getComputedStyle(button).borderTopStyle));
      expect(edges).toEqual(['solid', 'solid']);
    });

    test(`over the ${where}, in forced colours: the notice and its controls keep their edges`, async ({
      page,
    }) => {
      await page.emulateMedia({ forcedColors: 'active' });
      const notice = await open(page, { where });

      const looks = await notice.evaluate((root) => {
        const edge = (element: Element) => {
          const style = getComputedStyle(element);
          return { style: style.borderTopStyle, width: Number.parseFloat(style.borderTopWidth) };
        };
        return { root: edge(root), controls: Array.from(root.querySelectorAll('button')).map(edge) };
      });
      expect(looks.root.style).toBe('solid');
      expect(looks.root.width).toBeGreaterThan(0);
      expect(looks.controls).toHaveLength(2);
      for (const control of looks.controls) {
        expect(control.style).not.toBe('none');
        expect(control.width).toBeGreaterThan(0);
      }

      /* `color-contrast` off for this scan only, as in `shell.spec.ts`: Chromium's
         emulation leaves authored text colours in the computed style. */
      const forced = await scan(page).disableRules(['color-contrast']).analyze();
      expect(forced.violations, violationsOf(forced)).toEqual([]);
      await page.emulateMedia({ forcedColors: null });
    });
  }

  test('a keyboard reaches both controls with Tab, and closing it leaves focus on the page', async ({
    page,
  }) => {
    await open(page);

    const reached = new Set<string>();
    for (let press = 0; press < 40 && reached.size < 2; press += 1) {
      await page.keyboard.press('Tab');
      const id = await page.evaluate(
        () => document.activeElement?.getAttribute('data-testid') ?? '',
      );
      if (id.startsWith('update-notice-')) reached.add(id);
    }
    expect([...reached].sort()).toEqual(['update-notice-dismiss', 'update-notice-reload']);

    await page.locator('[data-testid="update-notice-dismiss"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="update-notice"]')).toHaveCount(0);

    const landed = await page.evaluate(() => {
      const active = document.activeElement;
      return active === null || active === document.body ? 'body' : active.tagName;
    });
    expect(landed, 'focus fell to the body when the notice went').not.toBe('body');
  });

  test('one switch reaches Reload on the title screen, because the notice is inside the ring', async ({
    page,
  }) => {
    await open(page, { singleSwitch: true });
    const reload = page.locator('[data-testid="update-notice-reload"]');

    for (let press = 0; press < 40; press += 1) {
      if ((await reload.getAttribute('data-switch-highlight')) === 'true') break;
      await page.keyboard.press('Space');
    }
    await expect(reload).toHaveAttribute('data-switch-highlight', 'true');
  });

  test('in a level, with less movement and the easier font: nothing moves, and the font reaches it', async ({
    page,
  }) => {
    const notice = await open(page, { where: 'level', motion: 'reduced', font: 'dyslexia' });

    const looks = await notice.evaluate((root) => {
      const all = [root, ...Array.from(root.querySelectorAll('*'))];
      return {
        moving: all.filter((element) => {
          const style = getComputedStyle(element);
          return style.animationName !== 'none' || Number.parseFloat(style.transitionDuration) > 0;
        }).length,
        font: getComputedStyle(root).fontFamily,
      };
    });
    expect(looks.moving).toBe(0);
    expect(looks.font).toContain('Atkinson Hyperlegible');
    await expectClean(page, 'level, reduced motion, dyslexia font');
  });
});
