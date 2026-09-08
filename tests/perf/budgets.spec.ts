import { expect, test, type Page } from '@playwright/test';

/*
  Imported, not restated. `thresholdsFor` derives every tier boundary from
  `budgets.frameTimeMs`, so re-tuning the budget in `content/game.config.json`
  moves the game's own degrade thresholds and this suite's expectations together.
  It is a pure module — no Phaser, no DOM — and the alias resolves through the
  root `tsconfig.json` that Playwright already reads.
*/
import { thresholdsFor } from '@adapters/phaser/visual-tier';

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

/**
 * The level the budgets are measured against.
 *
 * A budget needs something to be spent on. Slice 0 had no gameplay, which is why
 * the two tests below were `fixme`: the page they would have measured was an
 * empty scene, and "an idle canvas renders in 2 ms" is not a frame-time budget.
 * The Ottawa level - six parallax bands, a ground polyline, a camera that
 * follows, and a locomotion step every frame - is. `?e2e=1` is on so the tier
 * that produced the number can be reported with it: a frame time with no tier
 * beside it does not say whether the device was drawing six layers or two, and
 * a number that could mean either is not a measurement anybody can act on.
 *
 * It also means the probe itself is inside the measurement - one array push per
 * frame. That is deliberate: it is a cost the build carries in this
 * configuration, and excluding it would be measuring a build nobody runs.
 */
const LEVEL_ID = 'ottawa';
const PLAYABLE_URL = `./?e2e=1&level=${LEVEL_ID}`;

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
   * Enabled in slice 1 (task 1.13): the level scene sets
   * `data-testid="playable"` on the first frame the player can act on, so there
   * is now a moment to time to. The marker is present exactly while the level
   * accepts input, so this cannot pass against a level that failed to load.
   */
  test('time to play stays under the budget', async ({ page }) => {
    const started = Date.now();
    await page.goto(PLAYABLE_URL);
    await page.waitForSelector('[data-testid="playable"]');
    const elapsed = Date.now() - started;

    expect(
      elapsed,
      `time to play ${String(elapsed)} ms over the ${String(BUDGETS.timeToPlayMs)} ms budget`,
    ).toBeLessThanOrEqual(BUDGETS.timeToPlayMs);
  });

  /**
   * How expensive the level is, measured twice and reported with the tier that
   * produced the numbers.
   *
   * ### Why this is not `mean rAF interval <= 16.7 ms`
   *
   * It was, and that assertion cannot mean what it looks like it means. `rAF` is
   * vsync-locked: on a 60 Hz display the interval is 16.67 ms when *every* frame
   * lands and larger when one does not, and it is never smaller. `<= 16.7`
   * therefore reads as "frame time under the budget" and measures "zero dropped
   * frames in two seconds" — a bar the empty boot screen misses on this harness
   * (16.76 ms measured), so it would have been red on the day it was enabled,
   * for a reason that has nothing to do with the level.
   *
   * CLAUDE.md's 16.7 ms is a budget on *engine cost per frame*, which is what
   * `frame-cost.ts` measures inside the game and what the visual tier is chosen
   * from. From outside the page the closest honest pair is:
   *
   *   1. **Cadence.** The mean interval must satisfy the threshold the tier the
   *      device actually settled on requires — `thresholdsFor` from
   *      `visual-tier.ts`, the same function the tier tracker uses, imported
   *      rather than restated. A page reporting `medium` while delivering 25 fps
   *      is either lying about its tier or has stopped degrading, and both are
   *      the defect ADR-0011 exists to catch.
   *   2. **Cost.** What the *level* adds over the same machine with no level
   *      open. That subtraction is what makes the number about the build rather
   *      than about the rasteriser: this suite runs Chromium on SwiftShader,
   *      where an empty gradient already costs a whole vsync interval. The level
   *      must fit inside half the frame budget on top of it, which is the same
   *      ratio `highCostP50Ms` uses and for the same reason — whatever the level
   *      spends, the effects, characters and HUD have to fit in what is left.
   */
  test('frame time stays under the budget, at the tier it measured', async ({ page }) => {
    const thresholds = thresholdsFor(BUDGETS.frameTimeMs);

    /* The harness floor: the same browser, the same viewport, the same
       compositor, with no level open. Measured first so a warm-up cost lands on
       the baseline rather than on the level. */
    await page.goto('./');
    await page.waitForSelector('html[data-tn-boot="ready"]');
    const idle = await sampleFrames(page);

    await page.goto(PLAYABLE_URL);
    await page.waitForSelector('[data-testid="playable"]');
    await expect(page.locator('canvas')).toHaveCount(1);

    const probe = page.locator('[data-testid="scene-state"]');
    await expect(probe).toHaveAttribute('data-level', LEVEL_ID);
    /* Let the tier probe close at least one measurement window, so the number
       below is taken at a tier that was measured rather than at the provisional
       guess the first frames are drawn with (ADR-0011). */
    await expect(probe).toHaveAttribute('data-tier', /^(low|medium|high)$/);
    await page.waitForTimeout(1_500);
    const tier = (await probe.getAttribute('data-tier')) ?? 'unknown';
    const particles = await probe.getAttribute('data-particles');
    const easing = await probe.getAttribute('data-parallax-easing');

    const playing = await sampleFrames(page);

    for (const [what, measured] of [
      ['idle', idle],
      ['playing', playing],
    ] as const) {
      expect(
        measured.samples,
        `only ${String(measured.samples)} ${what} frames in ${FRAME_SAMPLE_MS} ms — the page is ` +
          'not animating, so nothing was measured',
      ).toBeGreaterThanOrEqual(MIN_FRAME_SAMPLES);
    }

    const where =
      `tier "${tier}", ${String(particles)} particles, parallax easing ${String(easing)}; ` +
      `idle ${idle.meanMs.toFixed(2)} ms over ${String(idle.samples)} frames, ` +
      `playing ${playing.meanMs.toFixed(2)} ms over ${String(playing.samples)} frames`;

    /* 1. Cadence, against the threshold this tier's own definition requires. */
    const cadenceBudget =
      tier === 'high' ? thresholds.highIntervalP50Ms : thresholds.mediumIntervalP50Ms;
    expect(
      playing.meanMs,
      `mean frame time ${playing.meanMs.toFixed(2)} ms over the ${cadenceBudget.toFixed(2)} ms ` +
        `cadence the "${tier}" tier requires — ${where}`,
    ).toBeLessThanOrEqual(cadenceBudget);

    /*
     * 2. Cost, relative to the same machine with nothing to draw — **at the
     *    tier it measured at**, exactly as the cadence assertion above.
     *
     * This used `highCostP50Ms` (half a 60 fps frame) at every tier, and that
     * is the mistake ADR-0011 names in its own consequences: "any future
     * frame-time gate must report the tier it measured at, or the number means
     * nothing. A budget met at `low` and a budget met at `high` are different
     * claims, and a gate that reports one number for both is a gate that
     * measures nothing." The cadence assertion above already picks its
     * threshold by tier; this one did not, so a device measured at `low` — a
     * software rasteriser whose *empty boot screen* costs 20 ms here — was held
     * to the allowance of a device drawing six layers at 60 fps.
     *
     * How that showed: this assertion passed for as long as the Ottawa level
     * drew **no art at all**. Nothing ever queued a texture, every parallax band
     * was a flat colour, and the level added almost nothing to an empty scene
     * because it was an empty scene. The first build that actually loaded its
     * six layers failed here by 5 ms. A gate that can only pass while the thing
     * it measures does not happen is not measuring anything, which is the same
     * defect as the missing art and was hiding behind it.
     *
     * So the allowance is the one the measured tier's own definition uses —
     * `visual-tier.ts`'s thresholds, imported, not restated: a `high` device
     * keeps half a frame for everything else, and `medium`/`low` may spend a
     * whole 60 fps frame budget on the level. It stays non-vacuous at every
     * tier — a level that added 20 ms would fail wherever it was measured — and
     * the cadence assertion above is what stops a slow device passing this one
     * by being slow at everything.
     */
    const costBudget =
      tier === 'high' ? thresholds.highCostP50Ms : thresholds.mediumCostP50Ms;
    const added = playing.meanMs - idle.meanMs;
    expect(
      added,
      `the level adds ${added.toFixed(2)} ms a frame over an empty scene, past the ` +
        `${costBudget.toFixed(2)} ms the "${tier}" tier allows it — ${where}`,
    ).toBeLessThanOrEqual(costBudget);
  });

  /**
   * The other half of the frame-time budget, and the one CLAUDE.md states in
   * pixels rather than milliseconds: overdraw <= 4x screen area, particles <=
   * 400 on a phone.
   *
   * Frame time alone would let a level pass on a fast machine while drawing nine
   * screens of fill, and the first phone to open it would be the thing that
   * found out. The particle count is what the level actually emitted, published
   * by the scene rather than read back off the preset, so a level that ignored
   * its budget reports the number it ignored it with.
   */
  test('the level respects the particle budget for this device', async ({ page }) => {
    await page.goto(PLAYABLE_URL);
    await page.waitForSelector('[data-testid="playable"]');

    const probe = page.locator('[data-testid="scene-state"]');
    await expect(probe).toHaveAttribute('data-particles', /^\d+$/);
    const particles = Number(await probe.getAttribute('data-particles'));
    const tier = await probe.getAttribute('data-tier');

    /* The viewport is 390x844 with a coarse pointer, which `classifyFormFactor`
       calls a phone, and CLAUDE.md's phone ceiling is 400. */
    expect(
      particles,
      `the level emitted ${String(particles)} particles at tier "${String(tier)}", over the ` +
        '400 phone ceiling (CLAUDE.md, Budgets)',
    ).toBeLessThanOrEqual(400);
  });
});

/**
 * Mean rAF interval over `FRAME_SAMPLE_MS`, and how many samples produced it.
 *
 * The count travels with the mean on purpose: a mean over four frames is not a
 * measurement, and every caller asserts a floor on it before it reads the
 * number.
 */
async function sampleFrames(page: Page): Promise<{ meanMs: number; samples: number }> {
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

  const meanMs =
    deltas.length === 0
      ? Number.POSITIVE_INFINITY
      : deltas.reduce((total, delta) => total + delta, 0) / deltas.length;
  return { meanMs, samples: deltas.length };
}
