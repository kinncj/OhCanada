import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import {
  levelTextureLimit,
  manifestPrices,
  overdrawByTier,
  OVERDRAW_BUDGET,
  PARTICLE_BUDGET,
  particleVerdict,
  textureVerdict,
  type TierChange,
} from './budget-rules';
import { CENSUS_GLOBAL, installGlCensus, type CensusSnapshot } from './gl-census';
import { atMost, notMeasured, settle } from './verdict';

/**
 * The CI performance lane: budgets a GPU-less runner can measure exactly.
 *
 * ## What this file does not claim, said first
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
 * ## What it measures, and why those numbers are real on a runner
 *
 * SwiftShader changes how fast work is done, not what work is asked for. The
 * same build hands SwiftShader and an iPhone the same draw calls over the same
 * pixels and the same textures. `gl-census.ts` counts that at the WebGL API,
 * and `calibration.spec.ts` proves the counting against scenes with known
 * answers on the same runner, in the same run. From it:
 *
 *   - overdraw <= 4x screen area per frame, per visual tier the host visited,
 *     and at `low` and `medium` pinned;
 *   - decoded texture memory the GPU actually holds <= the level's budget
 *     (48 MiB declared for Ottawa, 64 MiB ceiling), reconciled to the byte with
 *     what the build gate priced;
 *
 * from the scene probe, the particles the level EMITS <= 400 on a phone,
 * pinned to the tier whose preset allows the most; and, from outside the
 * canvas, the initial payload a browser transfers <= 8 MiB, and time to playable
 * on this runner <= 6 s as a tripwire - which is explicitly NOT the
 * phone-over-25-Mbps budget.
 *
 * ## Particles: emitted, not allowed
 *
 * `data-particles` used to have two writers - the renderer published the tier's
 * ALLOWANCE into it and the level scene the snow it EMITS - and read 0 at a tier
 * allowing 150. The allowance now has its own attribute,
 * `data-particle-allowance`, and `data-particles` is the emitted count alone.
 * The allowance is clamped to the device ceiling by construction, so it is
 * reported beside the verdict and never judged.
 *
 * The count does not depend on the runner's speed: the level seeds its snow when
 * the tier is applied, so it is the same number at 12 fps as at 60. What does
 * depend on the runner is which tier it would measure, and on SwiftShader that is
 * never one that snows much. So this test pins `high` with the probe-only
 * override, where the preset asks for 1500 and the phone ceiling is what binds.
 *
 * ## The tier: attributed per frame, and pinned where that is safe
 *
 * Overdraw depends on the visual tier, and the host picks the tier. On this
 * runner it used to cycle `low` 71 frames, `medium` 41, indefinitely; the tier
 * tracker now closes a tier after two failed attempts, so the host visits
 * `medium` twice and holds `low` - and how much of that falls inside the
 * observation depends on how long boot took. So each census frame is attributed
 * to the tier in effect when it began, from a log of the probe's `data-tier`
 * changes, and every tier the host visited is judged.
 *
 * `?e2e=1&tier=` makes the tier deterministic instead: `low` and `medium` are
 * pinned below, so each is measured on every run however the host behaves.
 * `high` is NOT pinned here yet, on purpose: this job blocks every deploy, and
 * overdraw at `high` (six layers) has never been measured on any runner. It
 * becomes a line in `PINNED_OVERDRAW_TIERS` once one run has reported the
 * number - adding a blocking budget that nobody has seen a reading of is how a
 * deploy gate goes red for a reason nobody predicted. Until then the verdicts
 * print it as NOT EXERCISED.
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
/** The probe-only override. Inert without `?e2e=1`, which `PLAYABLE_URL` carries. */
const pinnedUrl = (tier: string): string => `${PLAYABLE_URL}&tier=${tier}`;

/**
 * Tiers whose overdraw is measured pinned, on every run.
 *
 * Both already held on this runner through the attributed test (2.21x at `low`,
 * 2.66x at `medium`); pinning makes them measured every time rather than when
 * the host happens to pass through. `high` joins once it has one reading - see
 * the header.
 */
const PINNED_OVERDRAW_TIERS = ['low', 'medium'] as const;

/** The tier whose preset allows the most particles, so the device ceiling is what binds. */
const PARTICLE_TIER = 'high';
/** Long enough for a tier republish to land; the count is set when the tier is applied, not per frame. */
const PARTICLE_OBSERVE_MS = 3_000;

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
/** How long to watch. Long enough for several tier changes on a 12 fps runner. */
const OBSERVE_MS = 25_000;
const OBSERVE_FRAMES = 600;
/** A pinned `medium` or `high` draws the full buffer on SwiftShader, so boot can take longer than usual. */
const PLAYABLE_TIMEOUT_MS = 60_000;

const TIER_LOG_GLOBAL = '__tnTierLog';
const PARTICLE_LOG_GLOBAL = '__tnParticleLog';

/** Log every change of one scene-probe attribute with its `performance.now()`. Runs in the page. */
function installAttributeLog(options: { readonly globalName: string; readonly attribute: string }): void {
  const log: { t: number; value: string }[] = [];
  (globalThis as unknown as Record<string, unknown>)[options.globalName] = log;
  const watch = (element: Element): void => {
    const record = (): void => {
      const value = element.getAttribute(options.attribute);
      if (value !== null && log.at(-1)?.value !== value) log.push({ t: performance.now(), value });
    };
    record();
    new MutationObserver(record).observe(element, { attributes: true, attributeFilter: [options.attribute] });
  };
  new MutationObserver((_records, observer) => {
    const element = document.querySelector('[data-testid="scene-state"]');
    if (element !== null) {
      observer.disconnect();
      watch(element);
    }
  }).observe(document, { childList: true, subtree: true });
}

async function openLevel(page: Page, url = PLAYABLE_URL): Promise<void> {
  await page.addInitScript(installGlCensus, CENSUS_GLOBAL);
  await page.addInitScript(installAttributeLog, { globalName: TIER_LOG_GLOBAL, attribute: 'data-tier' });
  await page.goto(url);
  await page.waitForSelector('[data-testid="playable"]', { timeout: PLAYABLE_TIMEOUT_MS });
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

async function readAttributeLog(page: Page, globalName: string): Promise<readonly { t: number; value: string }[]> {
  return page.evaluate(
    (name) => (window as unknown as Record<string, { t: number; value: string }[]>)[name] ?? [],
    globalName,
  );
}

async function readTierLog(page: Page): Promise<readonly TierChange[]> {
  return (await readAttributeLog(page, TIER_LOG_GLOBAL)).map(({ t, value }) => ({ t, tier: value }));
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

/**
 * Why a page asked to pin `tier` cannot be trusted to have done it, or `null`.
 *
 * A pinned measurement that silently ran at the measured tier would be reported
 * as the pinned tier's number - the one mistake a tier override makes possible.
 */
async function pinRefusal(page: Page, tier: string, changes: readonly TierChange[]): Promise<string | null> {
  const pinned = await probe(page).getAttribute('data-tier-pinned');
  const visited = [...new Set(changes.map((change) => change.tier))];
  if (pinned !== 'true' || visited.length !== 1 || visited[0] !== tier) {
    return (
      `asked to pin "${tier}", and the probe reported data-tier-pinned=${String(pinned)} with tiers ` +
      `${visited.join(', ') || 'none'}: the override did not hold, so no frame is attributable to "${tier}"`
    );
  }
  return null;
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

  for (const tier of PINNED_OVERDRAW_TIERS) {
    test(`overdraw stays under four screens with the tier pinned at "${tier}"`, async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      await openLevel(page, pinnedUrl(tier));
      await observe(page);
      const changes = await readTierLog(page);
      const refusal = await pinRefusal(page, tier, changes);
      if (refusal !== null) return settle(testInfo, notMeasured(OVERDRAW_BUDGET, refusal));

      const snapshot = await readCensus(page);
      const renderer = snapshot.contexts.find((c) => c.attached && c.framesSeen > 0)?.renderer ?? 'unknown';
      return settle(
        testInfo,
        overdrawByTier(snapshot, changes, {
          minFrames: MIN_TIER_FRAMES,
          edgeFrames: EDGE_FRAMES,
          context: `renderer ${renderer}; tier pinned with ?e2e=1&tier=${tier}`,
        }),
      );
    });
  }

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

  test('the particles a level emits stay under the budget, at the tier that allows the most', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.addInitScript(installAttributeLog, { globalName: PARTICLE_LOG_GLOBAL, attribute: 'data-particles' });
    await page.addInitScript(installAttributeLog, { globalName: TIER_LOG_GLOBAL, attribute: 'data-tier' });
    try {
      await page.goto(pinnedUrl(PARTICLE_TIER));
      await page.waitForSelector('[data-testid="playable"]', { timeout: PLAYABLE_TIMEOUT_MS });
    } catch (error) {
      return settle(
        testInfo,
        notMeasured(PARTICLE_BUDGET, `the level never became playable at the pinned tier: ${String(error).split('\n')[0] ?? ''}`),
      );
    }
    await page.waitForTimeout(PARTICLE_OBSERVE_MS);

    const refusal = await pinRefusal(page, PARTICLE_TIER, await readTierLog(page));
    if (refusal !== null) return settle(testInfo, notMeasured(PARTICLE_BUDGET, refusal));

    return settle(
      testInfo,
      particleVerdict({
        emitted: (await readAttributeLog(page, PARTICLE_LOG_GLOBAL)).map((entry) => entry.value),
        allowance: await probe(page).getAttribute('data-particle-allowance'),
        tier: await probe(page).getAttribute('data-tier'),
        tierPinned: await probe(page).getAttribute('data-tier-pinned'),
        formFactor: await page.locator('#game canvas').getAttribute('data-tn-form-factor'),
        motion: await probe(page).getAttribute('data-motion'),
      }),
    );
  });
});
