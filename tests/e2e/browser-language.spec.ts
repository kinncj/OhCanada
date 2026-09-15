import { expect, test, type Page } from '@playwright/test';

/**
 * `OQ-SET-2`, and `TN-TITLE`'s "The first run follows the browser, and the
 * player wins after that", on the artefact GitHub Pages serves.
 *
 * **The defect this exists for.** A brand-new save was written in
 * `game.config.json#/defaultLocale` whatever the browser asked for, so a
 * player whose phone is in French opened an English game and had to find
 * Settings in a language they may not read. `app/bootstrap/browser-locale.ts`
 * now picks the save's first locale from `navigator.languages`.
 *
 * Every other browser suite runs in Playwright's default `en-US`, which is why
 * this is the one file that sets `locale`, and why none of those needed to
 * change.
 */

test.use({ locale: 'fr-CA' });

async function boot(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');
}

test.describe('a French-language browser', () => {
  test('opens a new game in French', async ({ page }) => {
    await page.goto('./');
    await boot(page);

    /* The premise first: a context that ignored the locale would make every
       line below a statement about an English browser. */
    expect(await page.evaluate(() => navigator.languages[0])).toBe('fr-CA');

    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    const play = page.getByTestId('title-play');
    await expect(play).toBeVisible();
    await expect(play).toHaveText('Jouer');

    await play.click();
    const creator = page.getByTestId('character-creator');
    await expect(creator.locator('h1')).toHaveText('Créez votre personnage');
    await expect(creator).toHaveAttribute('lang', 'fr');
    await expect(page.getByTestId('start-playing')).toHaveText('Commencer à jouer');
  });

  test("keeps the player's own language over the browser's after a reload", async ({ page }) => {
    await page.goto('./');
    await boot(page);
    await expect(page.getByTestId('title-play')).toHaveText('Jouer');

    await page.getByTestId('title-settings').click();
    await page.getByTestId('setting-language-en').click();
    await page.getByTestId('settings-close').click();
    await expect(page.getByTestId('title-play')).toHaveText('Play');

    /* The save is written asynchronously, so the reload is repeated until the
       page reads it back rather than raced once, as `level-ottawa.spec.ts`
       does. A save whose locale the browser overrides fails at the timeout. */
    await expect
      .poll(
        async () => {
          await page.reload();
          await page.waitForSelector('html[data-tn-boot="ready"]', { timeout: 30_000 });
          return page.locator('html').getAttribute('lang');
        },
        { message: "the browser's language overrode the saved one", timeout: 60_000, intervals: [1_000] },
      )
      .toBe('en');
    await expect(page.getByTestId('title-play')).toHaveText('Play');
  });
});
