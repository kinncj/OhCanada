import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { text } from '@ui/copy';

import { HARNESS_URL } from './playwright.config';

/**
 * "This game works best on a phone held upright" (ADR-0060,
 * `app/ui/portrait-notice.ts`).
 *
 * Two halves, and they prove different things.
 *
 * The **harness** half draws the notice where the composition root draws it —
 * first in the page's one `<main>` — over the two pages it can follow: the title
 * screen and a level's HUD. Both are whole pages, so nothing is disabled in the
 * ruleset: `region` and `landmark-one-main` run, and the notice has to sit
 * inside the landmark rather than beside it. What this proves and the unit suite
 * cannot: the control is 44 px or more, nothing clips at 200 % text in French,
 * contrast is computable and passes, the edges survive high contrast and forced
 * colours, a keyboard reaches the control, and one switch reaches it.
 *
 * The **`dist/`** half is the one that would have caught the wrong design. It
 * loads the artefact a visitor loads, at four viewports, and asserts who gets
 * what: a phone upright gets nothing new, a phone sideways gets the rotate
 * overlay *and no notice*, a tablet and a desktop get the notice and are never
 * blocked, and a dismissal survives a reload.
 */

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const RULESET = [...WCAG, 'best-practice'];

/** Whole-page scan. Nothing disabled. */
const scan = (page: Page) => new AxeBuilder({ page }).withTags([...RULESET]).exclude('canvas');

const violationsOf = (results: { violations: unknown[] }) =>
  JSON.stringify(results.violations, null, 2);

const NOTICE = '[data-testid="portrait-notice"]';
const DISMISS = '[data-testid="portrait-notice-dismiss"]';
const OVERLAY = '#tn-rotate-overlay';
const VISIBLE_OVERLAY = `${OVERLAY}:not([hidden])`;

/** The four viewports the decision is about. */
const PHONE_PORTRAIT = { width: 390, height: 844 } as const;
const PHONE_LANDSCAPE = { width: 844, height: 390 } as const;
const TABLET_PORTRAIT = { width: 768, height: 1024 } as const;
const DESKTOP = { width: 1440, height: 900 } as const;

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
  const params = new URLSearchParams({ screen: 'portrait-notice' });
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
  await page.waitForSelector('html[data-tn-harness-ready="portrait-notice"]', { timeout: 15_000 });

  const notice = page.locator(NOTICE);
  await expect(notice, 'the notice never appeared').toBeVisible();
  return notice;
}

/** No violation on the page, and contrast inside the notice proven rather than "incomplete". */
async function expectClean(page: Page, label: string): Promise<void> {
  const results = await scan(page).analyze();
  expect(results.violations, `${label}: ${violationsOf(results)}`).toEqual([]);

  const contrast = await new AxeBuilder({ page })
    .include(NOTICE)
    .withRules(['color-contrast'])
    .analyze();
  expect(contrast.violations, `${label}: ${violationsOf(contrast)}`).toEqual([]);
  expect(
    contrast.incomplete,
    `${label}: the notice's contrast is unknown, not proven: ${JSON.stringify(contrast.incomplete, null, 2)}`,
  ).toEqual([]);
}

const WHERE: readonly Where[] = ['shell', 'level'];

test.describe('the portrait notice, as an element', () => {
  for (const where of WHERE) {
    for (const locale of ['en', 'fr'] as const) {
      test(`over the ${where}, in ${locale}: a status line, spoken once, taking no focus, and clean`, async ({
        page,
      }) => {
        const notice = await open(page, { where, locale });

        const message = notice.locator('[data-testid="portrait-notice-message"]');
        await expect(message).toHaveText(text(locale, 'portrait.notice'));
        await expect(message).toHaveAttribute('role', 'status');
        /* A status for what it is, and `aria-live="off"` so it is not a second announcer. */
        await expect(message).toHaveAttribute('aria-live', 'off');
        expect(await page.locator('[aria-live]:not([aria-live="off"])').count()).toBe(1);

        await expect(notice.locator('[data-testid="portrait-notice-help"]')).toHaveText(
          text(locale, 'portrait.notice.help'),
        );
        await expect(notice.locator(DISMISS)).toHaveText(text(locale, 'common.close'));
        await expect(notice).toHaveAttribute('lang', locale);

        /* Both sentences, once, through the one live region. */
        await expect(page.locator('#tn-live-region')).toHaveText(
          `${text(locale, 'portrait.notice')} ${text(locale, 'portrait.notice.help')}`,
        );

        /* Not a dialog, and nothing behind it made inert: this is the whole
           difference from the rotate overlay (ADR-0060). */
        await expect(notice).not.toHaveAttribute('role', /.+/);
        expect(await notice.locator('[role="dialog"], [aria-modal]').count()).toBe(0);
        expect(await page.locator('[inert]').count()).toBe(0);

        const focusInNotice = await page.evaluate(
          (selector) => (document.activeElement?.closest(selector) ?? null) !== null,
          NOTICE,
        );
        expect(focusInNotice, 'the notice took focus').toBe(false);

        await expectClean(page, `${where}, ${locale}`);
      });
    }

    test(`over the ${where}, at 200 % text in French: nothing clipped, the control at least 44 px`, async ({
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
      expect(controls).toHaveLength(1);
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

    test(`over the ${where}, in high contrast: clean, and the control keeps a drawn edge`, async ({
      page,
    }) => {
      const notice = await open(page, { where, contrast: 'high' });
      await expectClean(page, `${where}, high contrast`);

      const edges = await notice
        .locator('button')
        .evaluateAll((buttons) => buttons.map((button) => getComputedStyle(button).borderTopStyle));
      expect(edges).toEqual(['solid']);
    });

    test(`over the ${where}, in forced colours: the notice and its control keep their edges`, async ({
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
      expect(looks.controls).toHaveLength(1);
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

  test('a keyboard reaches Close, and closing it leaves focus on the page', async ({ page }) => {
    await open(page);

    let reached = false;
    for (let press = 0; press < 40 && !reached; press += 1) {
      await page.keyboard.press('Tab');
      const id = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? '');
      reached = id === 'portrait-notice-dismiss';
    }
    expect(reached, 'Tab never reached the control in the notice').toBe(true);

    await page.keyboard.press('Enter');
    await expect(page.locator(NOTICE)).toHaveCount(0);

    const landed = await page.evaluate(() => {
      const active = document.activeElement;
      return active === null || active === document.body ? 'body' : active.tagName;
    });
    expect(landed, 'focus fell to the body when the notice went').not.toBe('body');
  });

  test('one switch reaches Close, and is told what it closes', async ({ page }) => {
    await open(page, { singleSwitch: true });
    const close = page.locator(DISMISS);

    for (let press = 0; press < 40; press += 1) {
      if ((await close.getAttribute('data-switch-highlight')) === 'true') break;
      await page.keyboard.press('Space');
    }
    await expect(close).toHaveAttribute('data-switch-highlight', 'true');

    /* What the scan reads aloud names the notice, not a bare "Close". */
    const label = (await close.getAttribute('data-switch-label')) ?? '';
    expect(label).toContain(text('en', 'portrait.notice'));
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

/**
 * The half that is about **who gets it**, against the artefact a visitor loads.
 *
 * Each test owns its viewport and its storage, because Playwright gives every
 * test a fresh context — which is what makes "gone after a reload" a real claim
 * rather than an artefact of test order.
 */
test.describe('who the game says it to, on a cold load of dist/', () => {
  test('a phone held upright is told nothing new', async ({ page }) => {
    await page.setViewportSize(PHONE_PORTRAIT);
    await page.goto('./');
    await expect(page.locator('[data-testid="title-screen"]')).toBeVisible();

    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset['tnAudience']))
      .toBe('phone-portrait');
    await expect(page.locator(NOTICE)).toHaveCount(0);
    await expect(page.locator(OVERLAY)).toBeHidden();
  });

  test('a phone turned sideways gets the rotate overlay, and only that', async ({ page }) => {
    await page.setViewportSize(PHONE_LANDSCAPE);
    await page.goto('./');
    await page.locator(VISIBLE_OVERLAY).waitFor({ state: 'visible' });

    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset['tnAudience']))
      .toBe('phone-landscape');
    /* The two cases are mutually exclusive by construction (ADR-0060 §1); this
       is that promise kept in a browser. */
    await expect(page.locator(NOTICE)).toHaveCount(0);
  });

  for (const [name, size] of [
    ['a tablet held upright', TABLET_PORTRAIT],
    ['a desktop window', DESKTOP],
  ] as const) {
    test(`${name} is told once, is not blocked, and is clean`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto('./');

      const notice = page.locator(NOTICE);
      await expect(notice).toBeVisible();
      await expect(notice.locator('[data-testid="portrait-notice-message"]')).toHaveText(
        text('en', 'portrait.notice'),
      );

      /* Not blocked: no overlay, nothing inert, and the front door still works. */
      await expect(page.locator(OVERLAY)).toBeHidden();
      expect(await page.locator('[inert]').count()).toBe(0);
      await expect(page.locator('[data-testid="title-screen"]')).toBeVisible();
      expect(
        await page.evaluate(() => document.getElementById('tn-shell')?.inert ?? null),
        'the front door went inert behind a notice that blocks nothing',
      ).toBe(false);

      const results = await scan(page).analyze();
      expect(results.violations, violationsOf(results)).toEqual([]);
    });
  }

  test('a desktop player closes it once, and never sees it again on that device', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('./');
    await expect(page.locator(NOTICE)).toBeVisible();

    await page.locator(DISMISS).click();
    await expect(page.locator(NOTICE)).toHaveCount(0);

    /* The dismissal is written to this device, not to the save (ADR-0060 §5). */
    expect(
      await page.evaluate(() => window.localStorage.getItem('truenorth.portrait-notice.dismissed')),
    ).toBe('1');

    await page.reload();
    await expect(page.locator('[data-testid="title-screen"]')).toBeVisible();
    await expect(page.locator(NOTICE)).toHaveCount(0);
  });
});
