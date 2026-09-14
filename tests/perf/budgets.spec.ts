import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import {
  levelTextureLimit,
  manifestPrices,
  overdrawByTier,
  textureVerdict,
  type TierChange,
} from './budget-rules';
import { CENSUS_GLOBAL, installGlCensus, type CensusSnapshot } from './gl-census';
import { atMost, notMeasured, settle } from './verdict';

/**
 * The CI performance lane: budgets a GPU-less runner can measure exactly.
 *
 * ## What this file no longer claims, said first
 *
 * **Frame time is not measured here.** Until 2026-09-13 this file sampled rAF
 * intervals on a GitHub runner and either failed ("only 19 playing frames in
 * 2000 ms - the page is not animating, so nothing was measured"), failed on the
 * tier moving mid-sample, or detected SwiftShader and reported instead of
 * asserting. It never once described the build: a runner has no GPU, so its
 * frame time is a CPU emulating one. That measurement now lives in
 * `frame-time.device.ts` and runs on real hardware only (tests/perf/README.md),
 * with the per-character budget beside it. The reporter prints both under NOT
 * CHECKED HERE on every run, so a green job cannot be read as "frame time is
 * fine".
 *
 * **Particles are not measured here either, and were not really measured
 * before.** This file used to read `data-particles` off the scene probe and hold
 * it to 400. That attribute has two writers: `game-renderer.ts` publishes the
 * tier's ALLOWANCE (`profileToSnapshot`), `level-scene.ts` publishes the snow
 * the level actually EMITS, and the page shows whichever wrote last. It read 0
 * at a tier allowing 150 - a green tick for a number that could not tell
 * "allowed" from "emitted". The allowance is clamped to 400 on a phone by
 * construction, so a check of it is a tautology; emission is not observable
 * until the probe publishes it separately. So it is listed under NOT CHECKED
 * HERE, with that reason, rather than kept as a pass that measures nothing.
 *
 * ## What it measures instead, and why those numbers are real on a runner
 *
 * SwiftShader changes how fast work is done, not what work is asked for. The
 * same build hands SwiftShader and an iPhone the same draw calls over the same
 * pixels and the same textures. `gl-census.ts` counts that at the WebGL API,
 * and `calibration.spec.ts` proves the counting against scenes with known
 * answers on the same runner, in the same run. From it:
 *
 *   - overdraw <= 4x screen area per frame, per visual tier the host visited;
 *   - decoded texture memory the GPU actually holds <= the level's budget
 *     (48 MiB declared for Ottawa, 64 MiB ceiling), reconciled to the byte with
 *     what the build gate priced;
 *
 * and, from outside the canvas, the initial payload a browser transfers
 * <= 8 MiB, and time to playable on this runner <= 6 s as a tripwire - which is
 * explicitly NOT the phone-over-25-Mbps budget.
 *
 * ## The tier is attributed per frame, not waited for
 *
 * Overdraw depends on the visual tier, and on this runner the tier never
 * settles: the tracker cycles `low` 71 frames, `medium` 41, indefinitely (see
 * `overdrawByTier`). So each census frame is attributed to the tier in effect
 * when it began, from a log of the probe's `data-tier` changes, and every tier
 * the host visited is judged. What a runner never visits - `high` - is printed
 * as NOT EXERCISED in the verdict rather than implied.
 *
 * ## Outcomes
 *
 * Every budget test ends in `settle`: HELD passes, BREACHED fails as a breach,
 * NOT MEASURED fails as a broken instrument. `perf-reporter.ts` prints the three
 * as three sections.
 */

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const MIB = 1_048_576;

const config = JSON.parse(readFileSync(`${REPO_ROOT}content/game.config.json`, 'utf8')) as {
  readonly budgets: { readonly initialPayloadBytes: number; readonly timeToPlayMs: number };
};

/** The level the budgets are spent on: six parallax bands, a ground, snow, characters. */
const LEVEL_ID = 'ottawa';
const PLAYABLE_URL = `./?e2e=1&level=${LEVEL_ID}`;

/**
 * Frames a tier must contribute before its worst frame means anything.
 *
 * NOT the 30-frame floor the frame-time test uses; they are different kinds of
 * number. A rAF mean needs many samples because each is noisy. Covered area is
 * exact per frame (identical to 1e-6 across 74 frames of Ottawa) and needs
 * enough frames only to catch one that differs. Ten leaves room inside the
 * 41-frame runs of `medium` a runner produces.
 */
const MIN_TIER_FRAMES = 10;
/** Frames dropped from each end of a run of one tier: the switch frame may carry the old tier's geometry. */
const EDGE_FRAMES = 2;
/** How long to watch. Long enough for several full tier cycles on a 12 fps runner. */
const OBSERVE_MS = 25_000;
const OBSERVE_FRAMES = 600;

const TIER_LOG_GLOBAL = '__tnTierLog';

/** Log every `data-tier` change on the scene probe with its `performance.now()`. Runs in the page. */
function installTierLog(globalName: string): void {
  const log: { t: number; tier: string }[] = [];
  (globalThis as unknown as Record<string, unknown>)[globalName] = log;
  const watch = (element: Element): void => {
    const record = (): void => {
      const tier = element.getAttribute('data-tier');
      if (tier !== null && log.at(-1)?.tier !== tier) log.push({ t: performance.now(), tier });
    };
    record();
    new MutationObserver(record).observe(element, { attributes: true, attributeFilter: ['data-tier'] });
  };
  new MutationObserver((_records, observer) => {
    const element = document.querySelector('[data-testid="scene-state"]');
    if (element !== null) {
      observer.disconnect();
      watch(element);
    }
  }).observe(document, { childList: true, subtree: true });
}

async function openLevel(page: Page): Promise<void> {
  await page.addInitScript(installGlCensus, CENSUS_GLOBAL);
  await page.addInitScript(installTierLog, TIER_LOG_GLOBAL);
  await page.goto(PLAYABLE_URL);
  await page.waitForSelector('[data-testid="playable"]', { timeout: 30_000 });
}

const probe = (page: Page) => page.locator('[data-testid="scene-state"]');

async function readCensus(page: Page): Promise<CensusSnapshot> {
  return page.evaluate(
    (name) =>
      (window as unknown as Record<string, { snapshot: () => CensusSnapshot }>)[name]?.snapshot() ??
      { contexts: [], frames: [] },
    CENSUS_GLOBAL,
  );
}

async function readTierLog(page: Page): Promise<readonly TierChange[]> {
  return page.evaluate((name) => (window as unknown as Record<string, TierChange[]>)[name] ?? [], TIER_LOG_GLOBAL);
}

/** Watch the level for `OBSERVE_FRAMES` frames or `OBSERVE_MS`, whichever comes first. */
async function observe(page: Page): Promise<void> {
  await page.evaluate(
    (name) => (window as unknown as Record<string, { clearFrames: () => void }>)[name]?.clearFrames(),
    CENSUS_GLOBAL,
  );
  const deadline = Date.now() + OBSERVE_MS;
  while (Date.now() < deadline) {
    await page.waitForTimeout(500);
    if ((await readCensus(page)).frames.length >= OBSERVE_FRAMES) return;
  }
}

test.describe('performance budgets', () => {
  test('the production build responds at the base path', async ({ page }) => {
    const response = await page.goto('./');

    expect(response, 'no response from vite preview').not.toBeNull();
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('html')).toHaveCount(1);
  });

  /**
   * What a browser actually pulls to render the first screen: encoded bytes on
   * the wire, every promise awaited before the sum. The on-disk gate is
   * scripts/deploy-check.mjs; this one sees a file that ships but is never
   * fetched, or is fetched twice.
   */
  test('initial payload stays under the budget', async ({ page }, testInfo) => {
    const budget = 'initial payload a browser transfers <= 8 MiB';
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

    if (sizes.length === 0) return settle(testInfo, notMeasured(budget, 'no responses were observed'));
    if (transferred === 0) {
      return settle(
        testInfo,
        notMeasured(budget, `${String(sizes.length)} responses weighed zero bytes: the probe is broken, not the build`),
      );
    }
    return settle(
      testInfo,
      atMost(
        budget,
        transferred / MIB,
        config.budgets.initialPayloadBytes / MIB,
        'MiB',
        `${String(sizes.length)} responses, encoded bytes on the wire (compressed, so smaller than deploy-check's on-disk figure)`,
      ),
    );
  });

  test('time to playable on this runner stays under the tripwire', async ({ page }, testInfo) => {
    const budget = 'time to playable on this runner <= 6 s (a tripwire, not the phone budget)';
    const started = Date.now();
    try {
      await page.goto(PLAYABLE_URL);
      await page.waitForSelector('[data-testid="playable"]', { timeout: 30_000 });
    } catch (error) {
      return settle(
        testInfo,
        notMeasured(budget, `the level never became playable: ${String(error).split('\n')[0] ?? ''}`),
      );
    }
    const elapsed = Date.now() - started;
    return settle(
      testInfo,
      atMost(
        budget,
        elapsed,
        config.budgets.timeToPlayMs,
        'ms',
        'served from localhost to a server CPU: catches a boot that regressed badly; says nothing about a phone on 25 Mbps',
      ),
    );
  });

  test('overdraw stays under four screens, at every tier the host visited', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await openLevel(page);
    await observe(page);
    const snapshot = await readCensus(page);
    const renderer = snapshot.contexts.find((c) => c.attached && c.framesSeen > 0)?.renderer ?? 'unknown';
    return settle(
      testInfo,
      overdrawByTier(snapshot, await readTierLog(page), {
        minFrames: MIN_TIER_FRAMES,
        edgeFrames: EDGE_FRAMES,
        context: `renderer ${renderer}`,
      }),
    );
  });

  test('the GPU holds no more texture memory than the level is budgeted', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await openLevel(page);
    await expect(probe(page)).toHaveAttribute('data-layers-textured', /^\d+$/);
    /* The PEAK across the whole observation is what is compared, so every tier
       the host visits - and the texture scale each one loads - is covered
       without needing the tier to hold still. */
    await observe(page);
    const visited = [...new Set((await readTierLog(page)).map((change) => change.tier))];
    const verdict = textureVerdict(
      await readCensus(page),
      levelTextureLimit(LEVEL_ID),
      manifestPrices(LEVEL_ID, `${REPO_ROOT}dist/manifest.json`),
    );
    return settle(testInfo, {
      ...verdict,
      detail: `${verdict.detail}; peak over tiers visited: ${visited.join(', ') || 'none published'}`,
    });
  });
});
