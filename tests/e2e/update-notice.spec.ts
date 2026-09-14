import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { text } from '@ui/copy';

/**
 * "A new version is ready" on the production build, with a real second worker
 * (slice F3, ADR-0034, "Update flow").
 *
 * The second spec in this suite that lets the service worker run; every other
 * spec but `offline.spec.ts` runs with `serviceWorkers: 'block'`
 * (`playwright.config.ts` says why), so this file opts back in.
 *
 * **The second deploy is real bytes, not a dispatched event.** `vite preview`
 * serves `dist/` through sirv with `dev: true`, which reads a file and its ETag
 * on every request, so appending a comment to `dist/sw.js` is exactly what a new
 * deploy looks like to the browser's update check: a byte-different worker at the
 * same URL. The page asks for that check with `registration.update()`, the new
 * worker installs, skips waiting and claims the page, and `controllerchange`
 * arrives on a page that was already controlled when it loaded — the trigger
 * `app/bootstrap/update-notice.ts` listens for, with nothing in between faked.
 *
 * The file is put back after the test, whatever happened in it. The CI browser
 * jobs check `dist/`'s digest before any test runs and the deploy downloads the
 * artefact again, so the rewrite never reaches anything that ships. It is put
 * back **after** the test rather than before the reload at its end: restoring it
 * first would make the page's own registration on `load` find the original bytes,
 * install them as a third build, and raise the notice again on the page this test
 * asserts has none.
 *
 * A first visit is observed rather than assumed: `html[data-tn-update="idle"]`
 * is written when the watch hears the first worker take control and decides it is
 * not an update, so "no notice" is asserted after the event it is about.
 */
test.use({ serviceWorkers: 'allow' });

const WORKER = fileURLToPath(new URL('../../dist/sw.js', import.meta.url));

/** The deployed worker's bytes while this test has replaced them, else `null`. */
let deployed: string | null = null;

test.afterEach(() => {
  if (deployed === null) return;
  writeFileSync(WORKER, deployed);
  deployed = null;
});

test.describe('the update notice', () => {
  test('never on a first visit, and once when a new build takes over a page that was already controlled', async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const title = page.locator('[data-testid="title-screen"]');
    const notice = page.locator('[data-testid="update-notice"]');
    const html = page.locator('html');
    const focusIsInNotice = (): Promise<boolean> =>
      page.evaluate(
        () =>
          (document.activeElement?.closest('[data-testid="update-notice"]') ?? null) !== null,
      );

    /* First visit: the worker installs and claims a page that had no controller. */
    await page.goto('./');
    await expect(title).toBeVisible();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
      timeout: 60_000,
    });
    await expect(html, 'the first worker took control and the page never heard it').toHaveAttribute(
      'data-tn-update',
      'idle',
      { timeout: 30_000 },
    );
    await expect(notice, 'a first visit was told a new version is ready').toHaveCount(0);

    /* Second visit: controlled from its first request. Nothing has changed yet. */
    await page.reload();
    await expect(title).toBeVisible();
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    expect(await html.getAttribute('data-tn-update')).toBeNull();
    await expect(notice).toHaveCount(0);

    /* A second deploy: the same worker, one comment longer. */
    deployed = readFileSync(WORKER, 'utf8');
    writeFileSync(
      WORKER,
      `${deployed}\n/* tests/e2e/update-notice.spec.ts: a second deploy, ${String(Date.now())} */\n`,
    );
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
    });

    await expect(notice, 'a new worker took over this page and nothing said so').toBeVisible({
      timeout: 60_000,
    });
    await expect(html).toHaveAttribute('data-tn-update', 'shown');
    await expect(notice).toHaveCount(1);
    await expect(page.locator('[data-testid="update-notice-message"]')).toHaveAttribute(
      'role',
      'status',
    );
    await expect(page.locator('[data-testid="update-notice-message"]')).toHaveText(
      text('en', 'update.ready'),
    );
    /* Spoken through the one live region, and that region is still the only one. */
    await expect(page.locator('#tn-live-region')).toHaveText(text('en', 'update.ready'));
    await expect(page.locator('[aria-live]:not([aria-live="off"])')).toHaveCount(1);
    expect(await focusIsInNotice(), 'the notice took focus').toBe(false);

    /* Reload: the page comes back on the new build, and has nothing to say. */
    const navigated = page.waitForEvent('framenavigated');
    await page.locator('[data-testid="update-notice-reload"]').click();
    await navigated;
    await expect(title).toBeVisible();
    await expect(notice).toHaveCount(0);
    expect(await html.getAttribute('data-tn-update')).toBeNull();
  });
});
