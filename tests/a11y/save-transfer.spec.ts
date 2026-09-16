import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { text } from '@ui/copy';

import { HARNESS_URL } from './playwright.config';

/**
 * Settings' "Your progress" section, the confirmation before a file replaces the
 * save, a refused file, and the dialog after (`TN-SAVE-06`, ADR-0046), in a real
 * browser.
 *
 * The harness mounts Settings with `?save=1` and answers from the file chosen:
 * a file containing `"version"` is a save, one containing `"newer"` is from a
 * newer build, anything else is unreadable; `?saved=0` makes the replacement
 * fail. Every state is reached through the real file input, so nothing here is
 * drawn by a test hook.
 *
 * `region` and `landmark-one-main` are off for the reason
 * `slice1-screens.spec.ts` gives: the harness mounts Settings alone, a modal
 * with no page behind it. Everything else in WCAG 2.1 AA and best practice runs.
 *
 * What this proves that the unit suite cannot: 44 px controls, nothing clipped at
 * 200 % in either language, computed contrast, focus that really lands in each
 * dialog and really comes back, and a keyboard and one switch reaching the
 * controls.
 */

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const RULESET = [...WCAG, 'best-practice'];
const DISABLED = ['region', 'landmark-one-main'];

const scan = (page: Page) =>
  new AxeBuilder({ page }).withTags([...RULESET]).disableRules(DISABLED).exclude('canvas');

const violationsOf = (results: { violations: unknown[] }) =>
  JSON.stringify(results.violations, null, 2);

type Locale = 'en' | 'fr';

interface Options {
  readonly locale?: Locale;
  readonly textScale?: number;
  readonly singleSwitch?: boolean;
  /** `false` makes the replacement fail, as a store that refuses the write would. */
  readonly saved?: boolean;
  /** `false` makes the delete fail, as a store that refuses to clear would. */
  readonly deleted?: boolean;
}

const A_SAVE = JSON.stringify({ version: 4, note: 'a save, as far as the harness is concerned' });
const A_NEWER_SAVE = JSON.stringify({ version: 99, note: 'newer' });
const NOT_A_SAVE = 'my shopping list';

async function open(page: Page, options: Options = {}): Promise<Locator> {
  const params = new URLSearchParams({ screen: 'settings', save: '1' });
  if (options.locale !== undefined) params.set('locale', options.locale);
  if (options.textScale !== undefined) params.set('textScale', String(options.textScale));
  if (options.singleSwitch === true) params.set('switch', '1');
  if (options.saved === false) params.set('saved', '0');
  if (options.deleted === false) params.set('deleted', '0');

  const response = await page.goto(`${HARNESS_URL}?${params.toString()}`);
  expect(response, 'no response from the harness server').not.toBeNull();
  expect(response?.status()).toBeLessThan(400);
  await page.waitForSelector('html[data-tn-harness-ready="settings"]', { timeout: 15_000 });

  const section = page.getByTestId('setting-save');
  await expect(section, 'the harness drew Settings without "Your progress"').toBeVisible();
  return section;
}

/** Choose a file through the section's own input, with focus where a player who pressed "Open a file" left it. */
async function choose(page: Page, contents: string): Promise<void> {
  await page.getByTestId('save-import').focus();
  await page.getByTestId('save-import-file').setInputFiles({
    name: 'progress.json',
    mimeType: 'application/json',
    buffer: Buffer.from(contents),
  });
}

const focusedTestId = (page: Page): Promise<string> =>
  page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? '');

const focusIsInside = (page: Page, testId: string): Promise<boolean> =>
  page.evaluate(
    (id) => document.activeElement?.closest(`[data-testid="${id}"]`) !== null,
    testId,
  );

/** Every button and paragraph under `root`: at least 44 px for a button, and nothing clipped. */
async function expectReadableControls(root: Locator, label: string): Promise<void> {
  await root.scrollIntoViewIfNeeded();
  const parts = await root.evaluate((element) =>
    Array.from(element.querySelectorAll('p, button, h2, span'))
      .filter((part) => !(part as HTMLElement).hidden && part.getClientRects().length > 0)
      .map((part) => {
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
    `${label}: ${JSON.stringify(parts, null, 2)}`,
  ).toEqual([]);
  const buttons = parts.filter((part) => part.tag === 'BUTTON');
  expect(buttons.length, `${label}: no controls were measured`).toBeGreaterThan(0);
  for (const control of buttons) {
    expect(control.width, `${label}: ${control.name} is narrower than 44 px`).toBeGreaterThanOrEqual(44);
    expect(control.height, `${label}: ${control.name} is shorter than 44 px`).toBeGreaterThanOrEqual(44);
  }
}

async function expectNoSidewaysScroll(page: Page, label: string): Promise<void> {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    `${label}: the page scrolls sideways`,
  ).toBe(true);
}

async function expectClean(page: Page, label: string): Promise<void> {
  const results = await scan(page).analyze();
  expect(results.violations, `${label}: ${violationsOf(results)}`).toEqual([]);
}

test.describe('"Your progress" in Settings', () => {
  for (const locale of ['en', 'fr'] as const) {
    for (const textScale of [100, 200]) {
      test(`in ${locale} at ${String(textScale)} %: a named group, 44 px controls, nothing clipped, clean`, async ({
        page,
      }) => {
        const section = await open(page, { locale, textScale });
        const label = `section, ${locale}, ${String(textScale)} %`;

        await expect(section).toHaveAttribute('role', 'group');
        await expect(section).toHaveAccessibleName(text(locale, 'save.section'));
        await expect(section).toHaveAccessibleDescription(text(locale, 'save.section.help'));
        await expect(section.getByTestId('save-export')).toHaveText(text(locale, 'save.export'));
        await expect(section.getByTestId('save-import')).toHaveText(text(locale, 'save.import'));
        /* The native input draws words in the browser's language; it is never shown. */
        await expect(section.getByTestId('save-import-file')).toBeHidden();

        await expectReadableControls(section, label);
        await expectNoSidewaysScroll(page, label);
        await expectClean(page, label);
      });
    }

    test(`in ${locale} at 200 %: the confirmation is named, described, focused and clean, and Escape keeps my progress`, async ({
      page,
    }) => {
      await open(page, { locale, textScale: 200 });
      await choose(page, A_SAVE);
      const label = `confirmation, ${locale}, 200 %`;

      const dialog = page.getByTestId('save-import-confirm');
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAttribute('role', 'alertdialog');
      await expect(dialog).toHaveAttribute('lang', locale);
      await expect(dialog).toHaveAccessibleName(text(locale, 'save.import.confirm'));
      await expect(dialog).toHaveAccessibleDescription(text(locale, 'save.import.confirm.body'));
      await expect.poll(() => focusIsInside(page, 'save-import-confirm')).toBe(true);
      await expect(dialog.getByTestId('save-import-replace')).toHaveText(
        text(locale, 'save.import.replace'),
      );
      await expect(dialog.getByTestId('save-import-keep')).toHaveText(text(locale, 'save.import.keep'));

      await expectReadableControls(dialog, label);
      await expectNoSidewaysScroll(page, label);
      await expectClean(page, label);

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(page.getByTestId('settings-screen'), 'Escape closed Settings too').toBeVisible();
      await expect.poll(() => focusedTestId(page)).toBe('save-import');
      await expect(page.getByTestId('save-import-done')).toHaveCount(0);
    });

    test(`in ${locale}: a refused file is a sentence under the controls, said once, with no dialog`, async ({
      page,
    }) => {
      await open(page, { locale });
      const message = page.getByTestId('save-import-error');

      await choose(page, NOT_A_SAVE);
      const unreadable = `${text(locale, 'save.import.error')} ${text(locale, 'save.import.error.help')}`;
      await expect(message).toHaveText(unreadable);
      await expect(page.getByTestId('save-import')).toHaveAccessibleDescription(unreadable);
      await expect(page.locator('#tn-live-region')).toContainText(text(locale, 'save.import.error'));
      await expect(page.getByTestId('save-import-confirm')).toHaveCount(0);
      /* A status sentence, never a second announcer. */
      await expect(message).not.toHaveAttribute('aria-live', /.+/);
      await expectClean(page, `refused, ${locale}`);

      await choose(page, A_NEWER_SAVE);
      await expect(message).toHaveText(
        `${text(locale, 'save.newer.title')} ${text(locale, 'save.import.newer.help')}`,
      );
      await expect(page.getByTestId('save-import-confirm')).toHaveCount(0);
    });

    test(`in ${locale} at 200 %: after "Replace", the game is back, with one control, and it cannot be escaped`, async ({
      page,
    }) => {
      await open(page, { locale, textScale: 200 });
      await choose(page, A_SAVE);
      await expect(page.getByTestId('save-import-confirm')).toBeVisible();
      await page.getByTestId('save-import-replace').focus();
      await page.keyboard.press('Enter');
      const label = `done, ${locale}, 200 %`;

      const done = page.getByTestId('save-import-done');
      await expect(done).toBeVisible();
      await expect(done).toHaveAttribute('role', 'alertdialog');
      await expect(done).toHaveAccessibleName(text(locale, 'save.import.done'));
      await expect(done).toHaveAccessibleDescription(text(locale, 'save.import.done.help'));
      await expect.poll(() => focusIsInside(page, 'save-import-done')).toBe(true);
      await expect(done.locator('button')).toHaveCount(1);

      await expectReadableControls(done, label);
      await expectNoSidewaysScroll(page, label);
      await expectClean(page, label);

      await page.keyboard.press('Escape');
      await expect(done, 'the dialog after a replacement was escaped into the old game').toBeVisible();

      await done.getByTestId('save-import-continue').click();
      await expect(page.locator('html')).toHaveAttribute('data-tn-harness-restarted', 'true');
    });
  }

  test('a replacement the store refused says so under the controls, and leaves no dialog open', async ({
    page,
  }) => {
    await open(page, { saved: false });
    await choose(page, A_SAVE);
    await page.getByTestId('save-import-replace').click();

    await expect(page.getByTestId('save-import-error')).toHaveText(
      `${text('en', 'storage.warning')} ${text('en', 'save.import.notSaved.help')}`,
    );
    await expect(page.getByTestId('save-import-confirm')).toBeHidden();
    await expect(page.getByTestId('save-import-done')).toHaveCount(0);
    await expect.poll(() => focusedTestId(page)).toBe('save-import');
    await expectClean(page, 'not saved');
  });

  test('a keyboard reaches both controls with Tab', async ({ page }) => {
    await open(page);
    const reached = new Set<string>();
    for (let press = 0; press < 60 && reached.size < 2; press += 1) {
      await page.keyboard.press('Tab');
      const id = await focusedTestId(page);
      if (id === 'save-export' || id === 'save-import') reached.add(id);
    }
    expect([...reached].sort()).toEqual(['save-export', 'save-import']);
    /* The hidden input is never a stop. */
    expect(await focusedTestId(page)).not.toBe('save-import-file');
  });

  test('one switch reaches "Open a file", and inside the confirmation only its two answers', async ({
    page,
  }) => {
    await open(page, { singleSwitch: true });
    const importButton = page.getByTestId('save-import');
    for (let press = 0; press < 60; press += 1) {
      if ((await importButton.getAttribute('data-switch-highlight')) === 'true') break;
      await page.keyboard.press('Space');
    }
    await expect(importButton).toHaveAttribute('data-switch-highlight', 'true');

    await choose(page, A_SAVE);
    const dialog = page.getByTestId('save-import-confirm');
    await expect(dialog).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document
              .querySelector('[data-switch-highlight="true"]')
              ?.closest('[data-testid="save-import-confirm"]') !== null,
        ),
      )
      .toBe(true);
    for (let press = 0; press < 4; press += 1) {
      await page.keyboard.press('Space');
      const inside = await page.evaluate(
        () =>
          document
            .querySelector('[data-switch-highlight="true"]')
            ?.closest('[data-testid="save-import-confirm"]') !== null,
      );
      expect(inside, 'the switch highlight left the confirmation for Settings behind it').toBe(true);
    }
  });
});

/**
 * "Delete my progress" (ADR-0026), in a real browser.
 *
 * It is the only control in this game that destroys something a player cannot
 * get back, and a second live-site audit found it absent altogether: every save
 * is on the device and nothing offered to clear one.
 *
 * What only a browser proves: the control is 44 px and nothing clips at 200 %
 * in either language; the question and its cost are the dialog's real accessible
 * name and description; focus lands in the dialog and comes back to the control;
 * Escape keeps the game; and the dialog after it cannot be escaped into a game
 * that is gone. The destructive control is also checked to be distinguishable
 * without colour — a heavier double edge — which is what `data-tn-action` buys.
 */
test.describe('"Delete my progress" in Settings', () => {
  for (const locale of ['en', 'fr'] as const) {
    for (const textScale of [100, 200]) {
      test(`in ${locale} at ${String(textScale)} %: the control is named, 44 px, unclipped and clean`, async ({
        page,
      }) => {
        const section = await open(page, { locale, textScale });
        const control = section.getByTestId('save-delete');

        await expect(control).toHaveText(text(locale, 'save.delete'));
        await expect(control).toHaveAttribute('data-tn-action', 'destructive');
        /* Not colour alone: the destructive slab carries its own edge weight. */
        const edge = await control.evaluate((node) => {
          const style = getComputedStyle(node);
          return { style: style.borderTopStyle, width: style.borderTopWidth };
        });
        expect(edge.style, `${locale}: the destructive control has no edge of its own`).toBe(
          'double',
        );

        await expectReadableControls(section, `delete control, ${locale}, ${String(textScale)} %`);
        await expectNoSidewaysScroll(page, `delete control, ${locale}`);
        await expectClean(page, `delete control, ${locale}, ${String(textScale)} %`);
      });
    }

    test(`in ${locale} at 200 %: the question is named, described, focused and clean, and Escape keeps my progress`, async ({
      page,
    }) => {
      await open(page, { locale, textScale: 200 });
      await page.getByTestId('save-delete').click();
      const label = `delete confirmation, ${locale}, 200 %`;

      const dialog = page.getByTestId('save-delete-confirm');
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAttribute('role', 'alertdialog');
      await expect(dialog).toHaveAttribute('lang', locale);
      await expect(dialog).toHaveAccessibleName(text(locale, 'save.delete.confirm'));
      await expect(dialog).toHaveAccessibleDescription(text(locale, 'save.delete.confirm.body'));
      await expect.poll(() => focusIsInside(page, 'save-delete-confirm')).toBe(true);
      await expect(dialog.getByTestId('save-delete-yes')).toHaveText(text(locale, 'save.delete.yes'));
      await expect(dialog.getByTestId('save-delete-keep')).toHaveText(
        text(locale, 'save.delete.keep'),
      );

      await expectReadableControls(dialog, label);
      await expectNoSidewaysScroll(page, label);
      await expectClean(page, label);

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(page.getByTestId('settings-screen'), 'Escape closed Settings too').toBeVisible();
      await expect.poll(() => focusedTestId(page)).toBe('save-delete');
      await expect(page.getByTestId('save-delete-done')).toHaveCount(0);
    });

    test(`in ${locale}: after deleting, one control starts the game again and it cannot be escaped`, async ({
      page,
    }) => {
      await open(page, { locale });
      await page.getByTestId('save-delete').click();
      await page.getByTestId('save-delete-yes').click();
      const label = `delete done, ${locale}`;

      const done = page.getByTestId('save-delete-done');
      await expect(done).toBeVisible();
      await expect(done).toHaveAttribute('role', 'alertdialog');
      await expect(done).toHaveAccessibleName(text(locale, 'save.delete.done'));
      await expect(done).toHaveAccessibleDescription(text(locale, 'save.delete.done.help'));
      await expect.poll(() => focusIsInside(page, 'save-delete-done')).toBe(true);
      await expect(done.locator('button')).toHaveCount(1);
      await expect(page.locator('#tn-live-region')).toContainText(text(locale, 'save.delete.done'));

      await expectReadableControls(done, label);
      await expectClean(page, label);

      await page.keyboard.press('Escape');
      await expect(done, 'the dialog after a delete was escaped into a game that is gone').toBeVisible();

      await done.getByTestId('save-delete-continue').click();
      await expect(page.locator('html')).toHaveAttribute('data-tn-harness-restarted', 'true');
    });
  }

  test('a delete the store refused says so under the control, and leaves no dialog open', async ({
    page,
  }) => {
    await open(page, { deleted: false });
    await page.getByTestId('save-delete').click();
    await page.getByTestId('save-delete-yes').click();

    const sentence = `${text('en', 'save.delete.failed')} ${text('en', 'save.import.notSaved.help')}`;
    await expect(page.getByTestId('save-import-error')).toHaveText(sentence);
    await expect(page.getByTestId('save-delete')).toHaveAccessibleDescription(sentence);
    await expect(page.getByTestId('save-delete-confirm')).toBeHidden();
    await expect(page.getByTestId('save-delete-done')).toHaveCount(0);
    await expect.poll(() => focusedTestId(page)).toBe('save-delete');
    await expectClean(page, 'delete refused');
  });

  test('a keyboard reaches it with Tab', async ({ page }) => {
    await open(page);
    let reached = false;
    for (let press = 0; press < 60 && !reached; press += 1) {
      await page.keyboard.press('Tab');
      reached = (await focusedTestId(page)) === 'save-delete';
    }
    expect(reached, 'Tab never reached "Delete my progress"').toBe(true);
  });

  test('one switch reaches it, and inside the question only its two answers', async ({ page }) => {
    await open(page, { singleSwitch: true });
    const control = page.getByTestId('save-delete');
    for (let press = 0; press < 60; press += 1) {
      if ((await control.getAttribute('data-switch-highlight')) === 'true') break;
      await page.keyboard.press('Space');
    }
    await expect(control).toHaveAttribute('data-switch-highlight', 'true');

    await control.click();
    await expect(page.getByTestId('save-delete-confirm')).toBeVisible();
    for (let press = 0; press < 4; press += 1) {
      await page.keyboard.press('Space');
      const inside = await page.evaluate(
        () =>
          document
            .querySelector('[data-switch-highlight="true"]')
            ?.closest('[data-testid="save-delete-confirm"]') !== null,
      );
      expect(inside, 'the switch highlight left the question for Settings behind it').toBe(true);
    }
  });
});
