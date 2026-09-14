import { expect, test, type Page } from '@playwright/test';

import { thresholdsFor } from '@adapters/phaser/visual-tier';

import { inspectHost, softwareRefusal } from './device-host';
import { atMost, notMeasured, settle } from './verdict';

/**
 * DEVICE LANE. Engine cost per frame, where it means something.
 *
 * ## What this measures, and the defect it replaces
 *
 * Moved from `budgets.spec.ts` on 2026-09-13, where it subtracted the mean rAF
 * INTERVAL of an empty page from the mean rAF interval of the level. The first
 * time that ran on a real GPU (AMD Radeon 8060S, tier "high") it read
 *
 *     idle 16.67 ms, playing 16.67 ms  ->  the level adds 0.00 ms   HELD
 *
 * which is not a cost: a rAF interval is vsync-locked, so on any device that
 * keeps up it reads 16.67 whether the engine spends 0.1 ms or 16 ms. ADR-0011
 * says exactly this about intervals, and the subtraction was a threshold
 * detector - 0 until the frame is missed. On SwiftShader it never got the
 * chance to read 0, which is the only reason nobody saw it.
 *
 * So this now measures what ADR-0011 says the 16.7 ms budget is - the engine's
 * work per frame - from outside the page: an init script wraps
 * `requestAnimationFrame` and times every callback, and callbacks that share a
 * frame timestamp are summed into one frame. Phaser's whole step (managers,
 * scene update, render submission) runs inside its rAF callback, so this is
 * the outside view of `frame-cost.ts`'s PRE_STEP-to-POST_RENDER, plus any other
 * rAF work the page does in that frame - which is also the player's cost.
 *
 * It is compared, as a p50, with the allowance `visual-tier.ts` gives the tier
 * the level settled at - the same statistic and the same threshold the tier
 * tracker uses, imported rather than restated.
 *
 * ## What it still does not see, named
 *
 * GPU time. Chromium submits GL commands to a GPU process asynchronously, so
 * fill cost shows up as missed vsyncs, not as callback time. The cadence - the
 * share of frame intervals over 1.5x the median - is reported beside every
 * verdict for that reason, and not asserted, because a vsync-locked number can
 * only say "missed" or "not missed". On CI the fill side is covered by
 * overdraw, counted exactly.
 *
 * And THIS machine. A pass on a laptop GPU is not a pass on an iPhone 13
 * (tests/perf/README.md). On a software rasteriser this settles NOT MEASURED.
 */

const BUDGET = "engine cost per frame (p50) <= the settled tier's allowance from the 16.7 ms budget";
const FRAME_TIME_MS = 16.7;
/**
 * Below this, a p50 is noise. `frame-cost.ts`'s window and
 * `tests/unit/adapters/phaser/frame-cost.test.ts` hold the tier probe to the
 * same floor.
 */
const MIN_FRAMES = 30;
const SAMPLE_MS = 3_000;
const LEVEL_ID = 'ottawa';
const PLAYABLE_URL = `./?e2e=1&level=${LEVEL_ID}`;
/** The tier must hold this long before the sample, so it is a measured tier and not the first guess. */
const TIER_STABLE_MS = 3_000;
const TIER_SETTLE_CAP_MS = 30_000;

test.describe('frame time on a real GPU', () => {
  test('engine cost per frame stays under the settled tier\'s allowance', async ({ page }, testInfo) => {
    const host = await inspectHost(page);
    if (host.software) return settle(testInfo, notMeasured(BUDGET, softwareRefusal(host)));

    await page.addInitScript(() => {
      const raw = window.requestAnimationFrame.bind(window);
      const frames = new Map<number, number>();
      const intervals: number[] = [];
      let last = -1;
      (window as unknown as Record<string, unknown>)['__tnFrameWork'] = {
        reset: () => {
          frames.clear();
          intervals.length = 0;
          last = -1;
        },
        read: () => ({ work: [...frames.values()], intervals: [...intervals] }),
      };
      window.requestAnimationFrame = (callback: FrameRequestCallback): number =>
        raw((timestamp) => {
          if (!frames.has(timestamp)) {
            if (last >= 0) intervals.push(timestamp - last);
            last = timestamp;
          }
          const started = performance.now();
          try {
            callback(timestamp);
          } finally {
            frames.set(timestamp, (frames.get(timestamp) ?? 0) + (performance.now() - started));
          }
        });
    });

    await page.goto(PLAYABLE_URL);
    await page.waitForSelector('[data-testid="playable"]');
    const probe = page.locator('[data-testid="scene-state"]');
    await expect(probe).toHaveAttribute('data-level', LEVEL_ID);

    const tier = await settledTier(page);
    if (tier === null) {
      return settle(testInfo, notMeasured(BUDGET, `the visual tier did not hold still for ${String(TIER_STABLE_MS)} ms within ${String(TIER_SETTLE_CAP_MS)} ms`));
    }

    await page.evaluate(() => (window as unknown as Record<string, { reset: () => void }>)['__tnFrameWork']?.reset());
    await page.waitForTimeout(SAMPLE_MS);
    const sample = await page.evaluate(
      () => (window as unknown as Record<string, { read: () => { work: number[]; intervals: number[] } }>)['__tnFrameWork']?.read() ?? { work: [], intervals: [] },
    );
    const tierAfter = await probe.getAttribute('data-tier');

    if (tierAfter !== tier) {
      return settle(testInfo, notMeasured(BUDGET, `the tier moved from "${tier}" to "${String(tierAfter)}" during the sample`));
    }
    if (sample.work.length < MIN_FRAMES) {
      return settle(testInfo, notMeasured(BUDGET, `only ${String(sample.work.length)} frames in ${String(SAMPLE_MS)} ms, below the ${String(MIN_FRAMES)}-frame floor`));
    }

    const p = (values: readonly number[], q: number): number => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? Number.NaN;
    };
    const p50 = p(sample.work, 0.5);
    const mean = sample.work.reduce((a, b) => a + b, 0) / sample.work.length;
    if (mean === 0) {
      return settle(
        testInfo,
        notMeasured(BUDGET, `${String(sample.work.length)} frames of rAF work all timed at 0 ms: the wrapper is not seeing the engine's callbacks`),
      );
    }
    const medianInterval = p(sample.intervals, 0.5);
    const missed = sample.intervals.filter((i) => i > medianInterval * 1.5).length;

    const thresholds = thresholdsFor(FRAME_TIME_MS);
    const allowance = tier === 'high' ? thresholds.highCostP50Ms : thresholds.mediumCostP50Ms;
    return settle(
      testInfo,
      atMost(
        BUDGET,
        p50,
        allowance,
        'ms',
        `tier "${tier}" on ${host.renderer}; ${String(sample.work.length)} frames, mean ${mean.toFixed(3)} ms, ` +
          `p95 ${p(sample.work, 0.95).toFixed(2)} ms, worst ${Math.max(...sample.work).toFixed(2)} ms; cadence (reported, not asserted): ` +
          `median interval ${medianInterval.toFixed(2)} ms, ${String(missed)} of ${String(sample.intervals.length)} intervals over 1.5x it. ` +
          "THIS machine's GPU: a laptop pass is not an iPhone 13 pass (tests/perf/README.md)",
      ),
    );
  });
});

/** The tier once it has held for `TIER_STABLE_MS`, or null if it never does. */
async function settledTier(page: Page): Promise<string | null> {
  const probe = page.locator('[data-testid="scene-state"]');
  const deadline = Date.now() + TIER_SETTLE_CAP_MS;
  let current = await probe.getAttribute('data-tier');
  let since = Date.now();
  while (Date.now() < deadline) {
    await page.waitForTimeout(250);
    const now = await probe.getAttribute('data-tier');
    if (now !== current) {
      current = now;
      since = Date.now();
    } else if (current !== null && /^(low|medium|high)$/.test(current) && Date.now() - since >= TIER_STABLE_MS) {
      return current;
    }
  }
  return null;
}
