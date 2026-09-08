import { expect, test, type Page } from '@playwright/test';

import { CHARACTER_HARNESS_URL } from './playwright.config';

/**
 * Task 1.12's acceptance, as a measurement: **≤ 1.5 ms per character, ≤ 6 on
 * screen.**
 *
 * The number is unproven and `docs/plan/slice-1.md` says so — *"If ≤ 1.5 ms per
 * character does not hold on an iPhone, the sprite-sheet fallback ships and Rive
 * waits. Decide with a measurement."* This file is that decision procedure. It
 * does not assert a preference between the backends; it measures each one and
 * fails only when a backend that is a candidate to ship misses the budget.
 *
 * ## What is sampled, and the trap it avoids
 *
 * Engine work, not frame interval: `POST_RENDER now - PRE_STEP now`, through the
 * same `frame-cost.ts` the visual tier is chosen from. ADR-0011 records why the
 * obvious alternative cannot work — a rAF delta is vsync-locked, so on a healthy
 * 60 Hz display it reads ~16.7 ms whether the GPU is idle or saturated, and a
 * per-character cost derived from it would be 0 ms right up until it was 16 ms.
 * That is a threshold detector, not a measurement, and the same mistake was
 * already removed from `budgets.spec.ts` once.
 *
 * Per-character cost is a subtraction against a zero-character baseline taken in
 * the same browser on the same page, because this suite runs on SwiftShader
 * where an empty scene already costs a real slice of a frame. ADR-0011's
 * consequence is honoured: the renderer that produced the number is reported
 * with it, because a budget met on SwiftShader and one met on a GPU are
 * different claims.
 *
 * ## Two things this file will not do
 *
 * **It will not call the Rive number a per-character cost.** There is no
 * drawable `.riv`: `assets/style/rig-contract.riv` is a valid rig with all nine
 * inputs and *no drawable content*, kept that way deliberately so that nobody
 * adopts Rive on a measurement of an empty file. So the Rive figure here is the
 * runtime's fixed **floor** — instantiate, `advanceAndApply`, the canvas
 * surface, the per-frame upload — and the vector rasterisation of real art is on
 * top of it. A floor under budget proves nothing; a floor *over* budget would
 * settle the question against Rive, which is the only verdict it can carry, and
 * it is asserted in that direction only.
 *
 * **It will not report milliseconds without VRAM.** A Rive surface is sized by
 * the display rather than by a file, so `scripts/assets.mjs` records
 * `decodedBytes: 0` for a `.riv` and the texture-memory gate cannot see it at
 * all: six characters at 480x840 is ≈ 9.2 MiB that no dashboard counts. The
 * sprite backend adds zero, because its parts are inside an atlas that is
 * already weighed. That difference is printed beside every timing, because a
 * verdict of "Rive fits the 1.5 ms budget" that omitted it would be true and
 * misleading — and uncounted memory is the exact shape of the failure that
 * killed this project's predecessor.
 */

/** CLAUDE.md's per-character budget for task 1.12. */
const PER_CHARACTER_BUDGET_MS = 1.5;
/** The task's ceiling: six on screen. */
const MANY = 6;

/** Character space, from `assets/style/rig-contract.json`. */
const CHARACTER_WIDTH = 240;
const CHARACTER_HEIGHT = 470;
/** The pixel ratio the art pipeline emits characters at. */
const CHARACTER_SCALE = 2;

/**
 * Windows to let close before reading. The harness discards 30 warm-up frames
 * and then closes a window every 60, so two windows is ~150 frames — long
 * enough for shader compilation, the first uploads and the first GC to be
 * behind the numbers being read.
 */
const WINDOWS_TO_COLLECT = 2;

interface FrameCostSummary {
  readonly samples: number;
  readonly costP50: number;
  readonly costP95: number;
  readonly intervalP50: number;
  readonly worstCostMs: number;
}

interface CostReport {
  readonly backend: string;
  readonly characters: number;
  readonly renderer: string;
  readonly windows: readonly FrameCostSummary[];
  readonly layersPerCharacter: number;
}

async function measure(page: Page, backend: string, characters: number): Promise<CostReport> {
  await page.goto(`${CHARACTER_HARNESS_URL}?backend=${backend}&n=${String(characters)}`);
  await page.waitForFunction(
    (needed: number) => {
      const read = (window as unknown as Record<string, undefined | (() => CostReport)>)[
        '__tnCharacterCost'
      ];
      return read !== undefined && read().windows.length >= needed;
    },
    WINDOWS_TO_COLLECT,
    { timeout: 30_000 },
  );

  return page.evaluate(() => {
    const read = (window as unknown as Record<string, undefined | (() => CostReport)>)[
      '__tnCharacterCost'
    ];
    if (read === undefined) throw new Error('the harness installed no probe');
    return read();
  });
}

/** The last closed window is the settled one; the first still carries warm-up. */
function settled(report: CostReport): FrameCostSummary {
  const last = report.windows.at(-1);
  if (last === undefined) throw new Error(`${report.backend}: no measurement window closed`);
  return last;
}

/** `(cost with N - cost with 0) / N`, floored at 0: a negative cost is noise. */
function perCharacterMs(baseline: FrameCostSummary, loaded: FrameCostSummary, n: number): number {
  return Math.max(0, (loaded.costP50 - baseline.costP50) / n);
}

function describeReport(
  what: string,
  baseline: CostReport,
  one: CostReport,
  many: CostReport,
): string {
  const base = settled(baseline);
  return (
    `${what} on "${many.renderer}": ` +
    `baseline costP50 ${base.costP50.toFixed(3)} ms (p95 ${base.costP95.toFixed(3)}); ` +
    `1 character ${settled(one).costP50.toFixed(3)} ms ` +
    `-> ${perCharacterMs(base, settled(one), 1).toFixed(3)} ms each; ` +
    `${String(MANY)} characters ${settled(many).costP50.toFixed(3)} ms ` +
    `-> ${perCharacterMs(base, settled(many), MANY).toFixed(3)} ms each; ` +
    `${String(many.layersPerCharacter)} draw(s) per character`
  );
}

test.describe('character renderer cost', () => {
  test('the sprite fallback stays inside 1.5 ms a character, at 1 and at 6', async ({ page }) => {
    const baseline = await measure(page, 'sprite', 0);
    const one = await measure(page, 'sprite', 1);
    const many = await measure(page, 'sprite', MANY);

    const where = describeReport('sprite', baseline, one, many);
    const base = settled(baseline);

    for (const [count, report] of [
      [0, baseline],
      [1, one],
      [MANY, many],
    ] as const) {
      expect(
        settled(report).samples,
        `only ${String(settled(report).samples)} frames measured at ${String(count)} ` +
          'characters — the page is not animating, so nothing was measured',
      ).toBeGreaterThanOrEqual(30);
    }

    expect(
      perCharacterMs(base, settled(one), 1),
      `one sprite character costs more than the ${String(PER_CHARACTER_BUDGET_MS)} ms ` +
        `budget — ${where}`,
    ).toBeLessThanOrEqual(PER_CHARACTER_BUDGET_MS);

    expect(
      perCharacterMs(base, settled(many), MANY),
      `six sprite characters cost more than ${String(PER_CHARACTER_BUDGET_MS)} ms each — ` +
        `${where}`,
    ).toBeLessThanOrEqual(PER_CHARACTER_BUDGET_MS);

    /* The whole-frame consequence, which the per-character number hides: six
       characters must still leave the level a frame to be drawn in. */
    expect(
      settled(many).costP50 - base.costP50,
      `six sprite characters add more than the whole ${String(PER_CHARACTER_BUDGET_MS * MANY)} ` +
        `ms they are allowed together — ${where}`,
    ).toBeLessThanOrEqual(PER_CHARACTER_BUDGET_MS * MANY);

    /* eslint-disable-next-line no-console -- the measurement IS the deliverable */
    console.log(`[1.12] ${where}; VRAM added by the sprite backend: 0 bytes (its parts are ` +
      `inside the counted atlas).`);
  });

  /**
   * The Rive **floor**, asserted in the only direction it can carry.
   *
   * Under budget proves nothing — the artboard is empty. Over budget would mean
   * the runtime's fixed overhead alone exceeds the whole per-character budget
   * before a single path has been rasterised, which decides the question against
   * Rive without needing art. So the assertion is one-sided by design, and the
   * number is printed either way for the report.
   */
  test('the Rive runtime floor is measured, and can only fail against Rive', async ({ page }) => {
    const baseline = await measure(page, 'rive-floor', 0);
    const one = await measure(page, 'rive-floor', 1);
    const many = await measure(page, 'rive-floor', MANY);

    const base = settled(baseline);
    const where = describeReport('rive floor (empty artboard)', baseline, one, many);

    const surfaceBytes =
      CHARACTER_WIDTH * CHARACTER_SCALE * CHARACTER_HEIGHT * CHARACTER_SCALE * 4;
    const vram =
      `VRAM no gate counts: ${(surfaceBytes / 1_048_576).toFixed(2)} MiB per character at ` +
      `${String(CHARACTER_SCALE)}x, ` +
      `${((surfaceBytes * MANY) / 1_048_576).toFixed(2)} MiB at ${String(MANY)} — ` +
      `assets.mjs records decodedBytes: 0 for a .riv, so the texture gate does not move`;

    /* eslint-disable-next-line no-console -- the measurement IS the deliverable */
    console.log(`[1.12] ${where}. FLOOR ONLY: no drawable .riv exists. ${vram}.`);

    expect(
      perCharacterMs(base, settled(many), MANY),
      `the Rive runtime's fixed overhead alone exceeds the whole ` +
        `${String(PER_CHARACTER_BUDGET_MS)} ms per-character budget with an EMPTY artboard, ` +
        `before any art is rasterised. That decides the backend against Rive — ${where}. ${vram}`,
    ).toBeLessThanOrEqual(PER_CHARACTER_BUDGET_MS);
  });
});
