import { expect, test } from '@playwright/test';

/**
 * Budget suite. The numbers come from CLAUDE.md and content/game.config.json.
 *
 * House rule for this file: **a skipped test must not be able to pass by
 * default.** A `test.fixme` whose body asserts something trivially true is worse
 * than no test at all — the day someone deletes the `.fixme` it goes green in a
 * millisecond and the tick reads as "measured". Every body below is either a
 * real measurement of the real artefact, or it is gated on a marker that does
 * not exist yet and therefore fails loudly the moment it is enabled.
 */
const BUDGETS = {
  initialPayloadBytes: 8_388_608,
  timeToPlayMs: 6_000,
  frameTimeMs: 16.7,
} as const;

/**
 * How long the frame-time probe samples once the game says it is playable.
 * Long enough to cover a GC pause and a parallax cycle, short enough to keep
 * the suite inside the 60 s Playwright timeout.
 */
const FRAME_SAMPLE_MS = 2_000;
/** Below this, the sample is noise, not a measurement. */
const MIN_FRAME_SAMPLES = 30;

test.describe('performance budgets', () => {
  test('the production build responds at the base path', async ({ page }) => {
    const response = await page.goto('./');

    expect(response, 'no response from vite preview').not.toBeNull();
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('html')).toHaveCount(1);
  });

  /**
   * What a browser actually pulls to render the first screen.
   *
   * The authoritative payload gate is `scripts/deploy-check.mjs`, which weighs
   * the artefact on disk; this one weighs the *request graph*, so a file that
   * ships but is never fetched (or is fetched twice) shows up here and nowhere
   * else. Sizes are read from `request.sizes()` — encoded bytes on the wire, so
   * this number is compressed and reads smaller than the on-disk gate for the
   * same build; it is what the player's connection actually carries — and every
   * promise is awaited before the
   * assertion. The previous version fired `void response.body().then(...)` and
   * asserted against a counter that was still near zero: it could only pass.
   * The floor assertion below is what makes that failure mode impossible now.
   */
  test('initial payload stays under the budget', async ({ page }) => {
    const weighed: Promise<number>[] = [];
    page.on('response', (response) => {
      weighed.push(
        response
          .request()
          .sizes()
          .then((sizes) => sizes.responseBodySize + sizes.responseHeadersSize)
          /* A request cancelled by navigation has no sizes; it also has no weight. */
          .catch(() => 0),
      );
    });

    await page.goto('./', { waitUntil: 'networkidle' });
    const sizes = await Promise.all(weighed);
    const transferred = sizes.reduce((total, size) => total + size, 0);

    expect(sizes.length, 'no responses were observed, so nothing was weighed').toBeGreaterThan(0);
    expect(
      transferred,
      'the payload measured as zero bytes: the probe is broken, not the build',
    ).toBeGreaterThan(0);
    expect(
      transferred,
      `initial payload ${(transferred / 1_048_576).toFixed(2)} MB over the ` +
        `${(BUDGETS.initialPayloadBytes / 1_048_576).toFixed(0)} MB budget`,
    ).toBeLessThanOrEqual(BUDGETS.initialPayloadBytes);
  });

  /**
   * Enabled by slice 1, when the scene sets `data-testid="playable"` on the
   * first frame the player can act on. Until then `waitForSelector` times out
   * and the test fails — which is the point: it cannot report a budget it has
   * not measured.
   */
  test.fixme('time to play stays under the budget', async ({ page }) => {
    const started = Date.now();
    await page.goto('./');
    await page.waitForSelector('[data-testid="playable"]');
    expect(Date.now() - started).toBeLessThanOrEqual(BUDGETS.timeToPlayMs);
  });

  /**
   * Mean frame time at the medium preset, sampled from rAF once the game is
   * playable.
   *
   * TODO(slice-1): enable together with the `data-testid="playable"` marker and
   * the quality-preset switch. It is `fixme` because slice 0 has no gameplay to
   * measure, *not* because the body is a placeholder: the wait for `playable`
   * fails on today's build, and against an empty scene the sample-count floor
   * refuses to call an idle page 60 fps. Never replace this with a constant.
   */
  test.fixme('frame time stays under the budget at the medium preset', async ({ page }) => {
    await page.goto('./');
    await page.waitForSelector('[data-testid="playable"]');
    await expect(page.locator('canvas')).toHaveCount(1);

    const deltas = await page.evaluate(async (durationMs: number) => {
      const samples: number[] = [];
      await new Promise<void>((resolve) => {
        let previous = performance.now();
        const deadline = previous + durationMs;
        const step = (now: number): void => {
          samples.push(now - previous);
          previous = now;
          if (now < deadline) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
      /* Drop the first sample: it measures the gap since the last paint, not a frame. */
      return samples.slice(1);
    }, FRAME_SAMPLE_MS);

    expect(
      deltas.length,
      `only ${deltas.length} frames in ${FRAME_SAMPLE_MS} ms — the page is not animating`,
    ).toBeGreaterThanOrEqual(MIN_FRAME_SAMPLES);

    const meanFrameMs = deltas.reduce((total, delta) => total + delta, 0) / deltas.length;
    expect(
      meanFrameMs,
      `mean frame time ${meanFrameMs.toFixed(2)} ms over the ${BUDGETS.frameTimeMs} ms budget`,
    ).toBeLessThanOrEqual(BUDGETS.frameTimeMs);
  });
});
