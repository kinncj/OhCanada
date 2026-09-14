import { test, type Page } from '@playwright/test';

import { inspectHost, softwareRefusal } from './device-host';
import { CHARACTER_HARNESS_URL } from './playwright.config';
import { atMost, notMeasured, settle } from './verdict';

/**
 * DEVICE LANE. Task 1.12's acceptance as a measurement: <= 1.5 ms per
 * character, <= 6 on screen.
 *
 * Moved from `character-cost.spec.ts` on 2026-09-13. It PASSED on CI, which is
 * the reason it moved rather than a reason to keep it: per-character cost is a
 * subtraction of engine time on the same page, and on SwiftShader the
 * rasterisation of those characters is inside the subtraction. A sprite
 * character cheap enough to pass under a CPU rasteriser passes, and one that is
 * too expensive on an iPhone's GPU could pass too; the green tick described the
 * runner. So this settles NOT MEASURED on a software rasteriser, like the frame
 * test beside it.
 *
 * What it measures, unchanged: engine work (`POST_RENDER - PRE_STEP`) through
 * `frame-cost.ts`, as a mean over a 60-frame window (Chromium clamps
 * `performance.now()` to 100 us, so a median can only read in 0.1 ms steps), at
 * 0, 1 and 6 characters, per backend.
 *
 * Two things it will not do, also unchanged:
 *
 *   - call the Rive number a per-character cost. There is no drawable `.riv`;
 *     `assets/style/rig-contract.riv` has every input and no drawable content,
 *     so the Rive figure is the runtime's fixed FLOOR. Under budget proves
 *     nothing; over budget decides against Rive. One-sided, deliberately.
 *   - report milliseconds without VRAM. A Rive surface is sized by the display,
 *     not by a file, so the build gate records `decodedBytes: 0` for it. Six at
 *     480x840 is about 9.2 MiB no manifest counts. On CI the GL census in
 *     `budgets.spec.ts` now counts whatever surfaces a level actually uploads.
 *
 * The old sprite test asserted three things; two were one inequality written
 * twice ((many - base) / 6 <= 1.5 is (many - base) <= 9), so one verdict carries
 * them now.
 */

const PER_CHARACTER_BUDGET_MS = 1.5;
const MANY = 6;
const MIN_SAMPLES = 30;
const WINDOWS_TO_COLLECT = 2;
const CHARACTER_WIDTH = 240;
const CHARACTER_HEIGHT = 470;
const CHARACTER_SCALE = 2;

interface CostWindow {
  readonly samples: number;
  readonly meanCostMs: number;
  readonly costP50: number;
  readonly costP95: number;
  readonly intervalP50: number;
  readonly worstCostMs: number;
}

interface CostReport {
  readonly backend: string;
  readonly characters: number;
  readonly renderer: string;
  readonly windows: readonly CostWindow[];
  readonly layersPerCharacter: number;
}

async function measure(page: Page, backend: string, characters: number): Promise<CostReport> {
  await page.goto(`${CHARACTER_HARNESS_URL}?backend=${backend}&n=${String(characters)}`);
  await page.waitForFunction(
    (needed: number) => {
      const read = (window as unknown as Record<string, undefined | (() => CostReport)>)['__tnCharacterCost'];
      return read !== undefined && read().windows.length >= needed;
    },
    WINDOWS_TO_COLLECT,
    { timeout: 30_000 },
  );
  return page.evaluate(() => {
    const read = (window as unknown as Record<string, undefined | (() => CostReport)>)['__tnCharacterCost'];
    if (read === undefined) throw new Error('the harness installed no probe');
    return read();
  });
}

/** The last closed window is the settled one; the first still carries warm-up. */
const settled = (report: CostReport): CostWindow | undefined => report.windows.at(-1);

/** `(cost with N - cost with 0) / N`, floored at 0: a negative cost is noise. */
const perCharacterMs = (base: CostWindow, loaded: CostWindow, n: number): number =>
  Math.max(0, (loaded.meanCostMs - base.meanCostMs) / n);

function shortfall(reports: readonly CostReport[]): string | null {
  for (const report of reports) {
    const window = settled(report);
    if (window === undefined) return `${report.backend} at ${String(report.characters)}: no measurement window closed`;
    if (window.samples < MIN_SAMPLES) {
      return `${report.backend} at ${String(report.characters)}: only ${String(window.samples)} frames, below the ${String(MIN_SAMPLES)}-frame floor`;
    }
  }
  return null;
}

function describe(what: string, baseline: CostReport, one: CostReport, many: CostReport, renderer: string): string {
  const [b, o, m] = [settled(baseline), settled(one), settled(many)] as [CostWindow, CostWindow, CostWindow];
  return (
    `${what} on ${renderer} (Phaser ${many.renderer}): baseline mean ${b.meanCostMs.toFixed(3)} ms ` +
    `(p50 ${b.costP50.toFixed(1)}, p95 ${b.costP95.toFixed(1)}); 1 character -> ${perCharacterMs(b, o, 1).toFixed(3)} ms; ` +
    `${String(MANY)} characters mean ${m.meanCostMs.toFixed(3)} ms (p95 ${m.costP95.toFixed(1)}, worst ` +
    `${m.worstCostMs.toFixed(1)}) -> ${perCharacterMs(b, m, MANY).toFixed(3)} ms each; ` +
    `${String(many.layersPerCharacter)} draw(s) per character`
  );
}

test.describe('character renderer cost on a real GPU', () => {
  test('the sprite fallback stays inside 1.5 ms a character, at 1 and at 6', async ({ page }, testInfo) => {
    const budget = 'sprite character cost <= 1.5 ms each, at 1 and at 6 on screen';
    const host = await inspectHost(page);
    if (host.software) return settle(testInfo, notMeasured(budget, softwareRefusal(host)));

    const baseline = await measure(page, 'sprite', 0);
    const one = await measure(page, 'sprite', 1);
    const many = await measure(page, 'sprite', MANY);
    const missing = shortfall([baseline, one, many]);
    if (missing !== null) return settle(testInfo, notMeasured(budget, missing));

    const base = settled(baseline) as CostWindow;
    const worst = Math.max(
      perCharacterMs(base, settled(one) as CostWindow, 1),
      perCharacterMs(base, settled(many) as CostWindow, MANY),
    );
    return settle(
      testInfo,
      atMost(
        budget,
        worst,
        PER_CHARACTER_BUDGET_MS,
        'ms',
        `${describe('sprite', baseline, one, many, host.renderer)}; VRAM added: 0 bytes (parts are inside the counted atlas)`,
      ),
    );
  });

  test('the Rive runtime floor is measured, and can only fail against Rive', async ({ page }, testInfo) => {
    const budget = 'Rive runtime FLOOR (empty artboard) <= 1.5 ms per character - one-sided';
    const host = await inspectHost(page);
    if (host.software) return settle(testInfo, notMeasured(budget, softwareRefusal(host)));

    const baseline = await measure(page, 'rive-floor', 0);
    const one = await measure(page, 'rive-floor', 1);
    const many = await measure(page, 'rive-floor', MANY);
    const missing = shortfall([baseline, one, many]);
    if (missing !== null) return settle(testInfo, notMeasured(budget, missing));

    const surfaceBytes = CHARACTER_WIDTH * CHARACTER_SCALE * CHARACTER_HEIGHT * CHARACTER_SCALE * 4;
    return settle(
      testInfo,
      atMost(
        budget,
        perCharacterMs(settled(baseline) as CostWindow, settled(many) as CostWindow, MANY),
        PER_CHARACTER_BUDGET_MS,
        'ms',
        `${describe('rive floor', baseline, one, many, host.renderer)}. FLOOR ONLY: under budget proves nothing, ` +
          `over budget decides against Rive. VRAM no build gate counts: ${((surfaceBytes * MANY) / 1_048_576).toFixed(2)} MiB at ${String(MANY)}`,
      ),
    );
  });
});
