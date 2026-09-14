import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { START_LEVEL } from './start-level';

/**
 * Slice F3, "offline after first load" (ADR-0034), on the production build.
 *
 * The only spec in this suite that lets the service worker run. Every other
 * spec runs with `serviceWorkers: 'block'` - `playwright.config.ts` says why -
 * so this file opts back in, and it is the one place a regression in the
 * worker, the precache or the per-level art cache turns a check red.
 *
 * `vite preview` serves http://127.0.0.1, which a browser treats as a secure
 * context, so the worker registers here exactly as it does on
 * https://kinncj.github.io.
 *
 * "Offline" is proved rather than assumed. `context.setOffline(true)` reaches a
 * service worker only while workers are allowed, which they are in this file;
 * even so, before asserting anything about the game, the spec shows that a
 * request nothing has cached cannot be fetched and that the reload was answered
 * by the worker. Without those two lines a pass could mean the network was
 * still there.
 */
test.use({ serviceWorkers: 'allow' });

/**
 * Every file `dist/manifest.json` says the level draws - both scales and the
 * shared atlas - scope-relative. The worker caches exactly this set when a
 * level is first played, so it is what must be in Cache Storage before the
 * network goes away. Read from the build under test, never listed here.
 */
function levelArt(level: string): readonly string[] {
  const manifest = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../dist/manifest.json', import.meta.url)), 'utf8'),
  ) as { readonly files: readonly { readonly path: string; readonly levels: readonly string[] }[] };
  return manifest.files.filter((file) => file.levels.includes(level)).map((file) => file.path);
}

/** The subset of `paths` Cache Storage cannot answer for this page's scope. */
async function missingFromCacheStorage(page: Page, paths: readonly string[]): Promise<readonly string[]> {
  return page.evaluate(async (wanted) => {
    const scope = new URL('./', window.location.href);
    const missing: string[] = [];
    for (const path of wanted) {
      if ((await caches.match(new URL(path, scope).href)) === undefined) missing.push(path);
    }
    return missing;
  }, paths);
}

test.describe('offline after first load', () => {
  test('a level played online opens again offline, and so does the title', async ({ page, context }) => {
    test.setTimeout(180_000);

    const art = levelArt(START_LEVEL);
    expect(
      art.length,
      `dist/manifest.json names no files for ${START_LEVEL}, so there is nothing for the worker to cache ` +
        'and nothing this spec could prove',
    ).toBeGreaterThan(0);

    /* First visit: the worker installs, precaches the shell and takes control. */
    await page.goto('./');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
      timeout: 60_000,
    });

    /* Play into the level while the network is there. */
    await page.goto(`./?level=${START_LEVEL}`);
    await page.waitForSelector('html[data-tn-level="ready"]', { timeout: 60_000 });

    /* The worker fills in the rest of the level in the background. */
    await expect
      .poll(() => missingFromCacheStorage(page, art), {
        timeout: 60_000,
        message: `the service worker never cached every file ${START_LEVEL} draws`,
      })
      .toEqual([]);

    await context.setOffline(true);
    expect(await page.evaluate(() => navigator.onLine), 'the page still reports itself online').toBe(false);
    const escaped = await page.evaluate(async () => {
      try {
        await fetch(`./nothing-caches-this-${String(Date.now())}`, { cache: 'no-store' });
        return true;
      } catch {
        return false;
      }
    });
    expect(escaped, 'a request nothing had cached reached the server, so the browser is not offline').toBe(false);

    /* The level, again, with no network. */
    const reloaded = await page.reload();
    expect(reloaded?.fromServiceWorker(), 'the offline reload was not answered by the service worker').toBe(
      true,
    );
    await page.waitForSelector('html[data-tn-level="ready"]', { timeout: 60_000 });
    await expect(page.locator('html[data-tn-level="failed"]')).toHaveCount(0);

    /* And the front door. */
    await page.goto('./');
    await expect(
      page.locator('[data-testid="title-play"], [data-testid="title-choose-level"]').first(),
    ).toBeVisible();
  });
});
