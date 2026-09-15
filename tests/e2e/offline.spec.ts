import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { text } from '@ui/copy';

import { START_LEVEL } from './start-level';

/**
 * Slice F3, "offline after first load" (ADR-0034), on the production build.
 *
 * One of the two specs in this suite that let the service worker run. Every
 * other spec but `update-notice.spec.ts` runs with `serviceWorkers: 'block'` -
 * `playwright.config.ts` says why - so this file opts back in, and it is the one
 * place a regression in the worker, the precache or the level art cache turns a
 * check red.
 *
 * `vite preview` serves http://127.0.0.1, which a browser treats as a secure
 * context, so the worker registers here exactly as it does on
 * https://kinncj.github.io.
 *
 * "Offline" is proved rather than assumed. `context.setOffline(true)` reaches a
 * service worker only while workers are allowed, which they are in this file;
 * even so, before asserting anything about the game, the spec shows that a
 * request nothing has cached cannot be fetched and that the navigation was
 * answered by the worker. Without those lines a pass could mean the network was
 * still there.
 *
 * Since ADR-0034's amendment of 2026-09-15 the worker caches every level's art
 * in the background once it controls a page, and a level whose art is not all
 * cached does not open offline: it shows a card saying it needs a connection.
 * The last two tests are those two halves.
 */
test.use({ serviceWorkers: 'allow' });

interface AssetManifestFile {
  readonly path: string;
  readonly levels: readonly string[];
}

/** `dist/manifest.json`'s files, read from the build under test and never listed here. */
function manifestFiles(): readonly AssetManifestFile[] {
  const manifest = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../dist/manifest.json', import.meta.url)), 'utf8'),
  ) as { readonly files: readonly AssetManifestFile[] };
  return manifest.files;
}

/**
 * Every file `dist/manifest.json` says the level draws - both scales and the
 * shared atlas - scope-relative. The worker caches exactly this set for a level,
 * so it is what must be in Cache Storage before the network goes away.
 */
function levelArt(level: string): readonly string[] {
  return manifestFiles()
    .filter((file) => file.levels.includes(level))
    .map((file) => file.path);
}

/** Every level art file the build ships, which the worker caches in the background. */
function everyLevelArt(): readonly string[] {
  return manifestFiles().map((file) => file.path);
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

/** The first visit: the worker installs, precaches the shell and takes control. */
async function firstVisit(page: Page): Promise<void> {
  await page.goto('./');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
    timeout: 60_000,
  });
}

/** Take the network away, and prove it is gone. */
async function goOffline(page: Page, context: BrowserContext): Promise<void> {
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

    await firstVisit(page);

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

    await goOffline(page, context);

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

  test('a level never played online opens offline, drawn from its art, because every level was cached', async ({
    page,
    context,
  }) => {
    test.setTimeout(240_000);

    const everything = everyLevelArt();
    expect(everything.length, 'dist/manifest.json names no level art, so this proves nothing').toBeGreaterThan(0);

    /* The title only: no level is opened while the network is there. */
    await firstVisit(page);
    await expect
      .poll(() => missingFromCacheStorage(page, everything), {
        timeout: 120_000,
        message: "the service worker never cached every level's art in the background",
      })
      .toEqual([]);

    await goOffline(page, context);

    const opened = await page.goto(`./?e2e=1&level=${START_LEVEL}`);
    expect(opened?.fromServiceWorker(), 'the offline navigation was not answered by the service worker').toBe(
      true,
    );
    await page.waitForSelector('html[data-tn-level="ready"]', { timeout: 60_000 });
    await expect(page.locator('[data-testid="level-needs-connection"]')).toHaveCount(0);

    /* Drawn from textures, not from the placeholder bands a level with no art falls back to. */
    const probe = page.locator('[data-testid="scene-state"]');
    await expect(probe).toHaveAttribute('data-level', START_LEVEL);
    const layers = Number(await probe.getAttribute('data-layers'));
    expect(layers, `${START_LEVEL} reports no layers, so "drawn from textures" would be vacuous`).toBeGreaterThan(0);
    await expect(probe).toHaveAttribute('data-layers-textured', String(layers));
  });

  test('a level whose art is not cached says it needs a connection, and does not open', async ({
    page,
    context,
  }) => {
    test.setTimeout(240_000);

    const everything = everyLevelArt();
    await firstVisit(page);
    /* Everything cached first, so nothing the worker does in the background can put the art back. */
    await expect
      .poll(() => missingFromCacheStorage(page, everything), {
        timeout: 120_000,
        message: "the service worker never cached every level's art in the background",
      })
      .toEqual([]);

    await goOffline(page, context);
    const removed = await page.evaluate(
      (level) => caches.delete(`truenorth-level-${level}`),
      START_LEVEL,
    );
    expect(removed, `Cache Storage held no truenorth-level-${START_LEVEL}, so nothing was taken away`).toBe(true);
    expect(
      (await missingFromCacheStorage(page, levelArt(START_LEVEL))).length,
      `every file ${START_LEVEL} draws is still cached, so the premise does not hold`,
    ).toBeGreaterThan(0);

    await page.goto(`./?level=${START_LEVEL}`);

    const card = page.locator('[data-testid="level-needs-connection"]');
    await expect(card).toBeVisible({ timeout: 60_000 });
    await expect(card).toHaveAttribute('role', 'alertdialog');
    await expect(card).toContainText(
      text('en', `level.${START_LEVEL}.error.title` as Parameters<typeof text>[1]),
    );
    await expect(card).toContainText(text('en', 'level.needsConnection.body'));
    await expect(page.locator('html')).toHaveAttribute('data-tn-level', 'failed');
    await expect(page.locator('[data-testid="level-error"]')).toBeHidden();

    /* Trying again with no network asks again, and still does not open a level with no art. */
    await card.locator('[data-testid="level-offline-retry"]').click();
    await expect(card).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-tn-level', 'failed');
    await expect(page.locator('html[data-tn-level="ready"]')).toHaveCount(0);
  });
});
