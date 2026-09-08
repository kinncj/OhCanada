import { expect, test } from '@playwright/test';

/**
 * OQ-TEST-1: the scene probe exists, carries the contract, and is not there
 * unless it was asked for.
 *
 * Run against the production artefact `vite preview` serves, which is the point:
 * the probe is gated at runtime rather than compiled out, because a probe
 * stripped from the artefact under test could only ever be proven to work in a
 * build nobody deploys. So the gate itself is what has to be tested, and it is
 * tested here on the same bytes that go to Pages.
 *
 * What this suite covers is the probe *at boot*, with no level open. That is
 * still a real state — `./?e2e=1` opens the boot screen and nothing else — and
 * the assertion that matters there is that the probe says `unknown` rather than
 * reporting a plausible zero for a player who does not exist.
 *
 * The probe with a level behind it is `level-ottawa.spec.ts`, which is where
 * `data-player-x`, `data-speed` and the frame trace are asserted against real
 * movement (tasks 1.13 and 1.14).
 */

/** Fixed by `docs/stories/README.md`. Restated so a rename fails a test. */
const CONTRACT_ATTRIBUTES = [
  'data-level',
  'data-mode',
  'data-paused',
  'data-player-x',
  'data-player-y',
  'data-speed',
  'data-facing',
  'data-grounded',
  'data-camera-x',
  'data-parallax-easing',
  'data-particles',
] as const;

const SCENE_PROBE_GLOBAL = '__tnScene';

test.describe('the scene probe', () => {
  test('does not exist on a normal load', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');

    await expect(page.locator('[data-testid="scene-state"]')).toHaveCount(0);
    expect(
      await page.evaluate(
        (name) => typeof (window as unknown as Record<string, unknown>)[name],
        SCENE_PROBE_GLOBAL,
      ),
      'a normal production load installed a debug handle on window',
    ).toBe('undefined');
  });

  test('does not exist for a query flag that only looks like the gate', async ({ page }) => {
    await page.goto('./?e2e=0');
    await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');

    await expect(page.locator('[data-testid="scene-state"]')).toHaveCount(0);
  });

  test('exists with ?e2e=1 and carries every attribute the stories name', async ({ page }) => {
    await page.goto('./?e2e=1');
    await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');

    const probe = page.locator('[data-testid="scene-state"]');
    await expect(probe).toHaveCount(1);

    for (const attribute of CONTRACT_ATTRIBUTES) {
      await expect(probe, `the probe is missing ${attribute}`).toHaveAttribute(
        attribute,
        /.+/,
      );
    }
  });

  test('reports the renderer tier it measured, rather than a feature flag', async ({ page }) => {
    await page.goto('./?e2e=1');
    await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');

    const probe = page.locator('[data-testid="scene-state"]');
    /* One mechanism, not two: the tier the frame-cost probe chose is published
       through the same element a locomotion scenario reads. */
    await expect(probe).toHaveAttribute('data-tier', /^(low|medium|high)$/);
    await expect(probe).toHaveAttribute('data-motion', /^(full|reduced)$/);
    await expect(probe).toHaveAttribute('data-parallax-easing', /^(on|off)$/);
    await expect(probe).toHaveAttribute('data-particles', /^\d+$/);
    await expect(probe).toHaveAttribute('data-paused', 'false');

    /* This suite runs Chromium on SwiftShader (see playwright.config.ts), so the
       renderer is WebGL and the device names itself as a CPU rasteriser. If the
       probe ever reports `high` here it has stopped reading the device string. */
    const canvas = page.locator('#game canvas');
    await expect(canvas).toHaveAttribute('data-tn-renderer', 'webgl');
    await expect(canvas).toHaveAttribute('data-tn-rasterizer', 'software');
    await expect(
      canvas,
      'a named software rasteriser was promoted past its ceiling',
    ).toHaveAttribute('data-tn-tier', /^(low|medium)$/);
  });

  test('says "unknown" with no level open, rather than a plausible zero', async ({ page }) => {
    /* `./?e2e=1` with no `level` opens the boot screen. There is no player and
       no camera, and a probe that answered "0" would be reporting a measurement
       it never took — the defect this element exists to avoid. The same
       attributes carry real numbers in `level-ottawa.spec.ts`. */
    await page.goto('./?e2e=1');
    await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');

    const probe = page.locator('[data-testid="scene-state"]');
    for (const attribute of ['data-level', 'data-mode', 'data-player-x', 'data-speed']) {
      await expect(
        probe,
        `${attribute} reports a value, but no level is open and there is no player — ` +
          'a probe that invents an answer is worse than one that admits it has none',
      ).toHaveAttribute(attribute, 'unknown');
    }
    await expect(page.locator('[data-testid="playable"]')).toHaveCount(0);
  });

  test('exposes a read-only frame trace, which is what a poll cannot give', async ({ page }) => {
    await page.goto('./?e2e=1');
    await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');

    const handle = await page.evaluate((name) => {
      const scene = (window as unknown as Record<string, Record<string, unknown>>)[name];
      return {
        keys: Object.keys(scene ?? {}).sort(),
        framesIsArray: Array.isArray((scene?.['frames'] as () => unknown)?.()),
        eventsIsArray: Array.isArray((scene?.['events'] as () => unknown)?.()),
      };
    }, SCENE_PROBE_GLOBAL);

    expect(handle.keys).toEqual(['clearTrace', 'events', 'frames', 'snapshot']);
    expect(handle.framesIsArray).toBe(true);
    expect(handle.eventsIsArray).toBe(true);
  });

  test('is invisible to assistive technology and adds no second live region', async ({ page }) => {
    await page.goto('./?e2e=1');
    await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');

    const probe = page.locator('[data-testid="scene-state"]');
    await expect(probe).toHaveAttribute('aria-hidden', 'true');
    await expect(probe).toBeHidden();
    await expect(probe).toHaveText('');
    await expect(probe).not.toHaveAttribute('aria-live', /.*/);
    /* The one channel a screen-reader user has stays the one channel. */
    await expect(page.locator('[aria-live]')).toHaveCount(1);
  });

  test('follows the rotate overlay, so "data-paused" is a real fact', async ({ page }) => {
    await page.goto('./?e2e=1');
    await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');

    const probe = page.locator('[data-testid="scene-state"]');
    await expect(probe).toHaveAttribute('data-paused', 'false');

    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(probe).toHaveAttribute('data-paused', 'true');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(probe).toHaveAttribute('data-paused', 'false');
  });
});
