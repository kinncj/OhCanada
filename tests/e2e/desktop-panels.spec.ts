import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { expect, test, type Page } from '@playwright/test';

/**
 * The desktop side panels extend the level's sky (ADR-0002, ADR-0044).
 *
 * CLAUDE.md: "Desktop centres the portrait canvas; side panels extend the
 * level's sky/ground". A fourth live-site audit found they did not: the panel
 * was exact on the canvas's first row and the page then ran a straight ramp from
 * there to the theme ground, through the hill line and the skyline, neither of
 * which is on that line. The result was a seam down both edges of the playfield
 * on every desktop session.
 *
 * Measured at 1440 x 900 against `vite preview`, as the largest per-channel
 * difference between the page 6 px outside the canvas and the canvas 6 px inside
 * it, at the same row, on both edges:
 *
 * | | Halifax | the North |
 * |---|---|---|
 * | before | worst 25, mean 12.8 | worst 33, mean 17.4 |
 * | after  | worst 0,  mean 0.0  | worst 17, mean 1.1  |
 *
 * The North's residual 17 is one row where the *canvas* column sampled is the
 * soft edge of a cirrus band; the panel there is the sky exactly.
 *
 * Only the sky is asserted, and that is a decision rather than an omission. One
 * flat colour per row is true of a sky and of a ground, and false of the rows
 * between them — a row with a skyline across it is not any one colour, and
 * profiling those too was built, measured and looked at: the panels became a
 * horizontal smear of the level, worse than the ramp they replaced. So the
 * profile stops where the level's own second layer starts, and the mid-ground
 * keeps the ramp it always had.
 */

const LEVELS = ['halifax', 'the-north'] as const;

/** Wider than 9:16, so `Scale.FIT` centres the canvas and leaves panels. */
const DESKTOP = { width: 1440, height: 900 } as const;

/** How far in from the canvas edge each sample sits, in CSS px. */
const INSET = 6;

/**
 * The largest per-channel step the sky may show at the canvas edge.
 *
 * The window this has to sit inside is narrow and both ends are measured, so it
 * is written out rather than rounded to something comfortable: 17 is the worst
 * reading after the fix, and 25 is the *best* of the two readings before it.
 * Anything above 25 would pass on the defect returning to Halifax; anything at
 * or below 17 would fail on the build that is here now.
 *
 * 20 splits that window. The 17 is one row of the North where the canvas column
 * sampled is the soft edge of a cirrus band rather than the sky, so it is the
 * measurement being awkward rather than the panel being wrong; 3 counts of
 * headroom covers that edge moving by a pixel under a different rasteriser.
 */
const MAX_SKY_STEP = 20;

const levelDocument = (id: string): { readonly layers: readonly { readonly depth: number; readonly offset: { readonly y: number } }[] } =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../../content/levels/${id}.json`, import.meta.url)), 'utf8'),
  ) as never;

/**
 * Where a level's sky ends, as a fraction of the design height: the top of the
 * second layer in depth order.
 *
 * Read from the level document, exactly as `LevelScene` reads it, so a level
 * that re-offsets its layers moves this suite's answer with it and nobody has to
 * edit a number here.
 */
function skyFloorOf(id: string): number {
  const ordered = [...levelDocument(id).layers].sort((one, other) => one.depth - other.depth);
  const mid = ordered.slice(1).map((layer) => layer.offset.y);
  expect(mid.length, `content/levels/${id}.json has only one layer, so it has no sky floor`).toBeGreaterThan(0);
  return Math.min(...mid) / 1920;
}

async function openLevel(page: Page, id: string): Promise<void> {
  await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
  await page.goto(`./?e2e=1&level=${id}`);
  await page.waitForSelector('[data-testid="playable"]', { timeout: 60_000 });
  /* Frames after the level says it is playable, so every band has been painted
     and the page variables have been applied at least once. */
  await page.waitForTimeout(1200);
}

test.describe('the desktop side panels extend the level sky', () => {
  for (const id of LEVELS) {
    test(`${id}: no seam down either edge of the playfield`, async ({ page }) => {
      await openLevel(page, id);

      const box = await page.locator('#game canvas').boundingBox();
      expect(box, 'the level drew no canvas').not.toBeNull();
      if (box === null) return;

      /* The canvas really is letterboxed here, or there is no panel to test. */
      expect(box.x, 'the canvas is not centred with panels either side').toBeGreaterThan(100);

      const shot = await page.screenshot();
      const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
      const at = (x: number, y: number): readonly [number, number, number] => {
        const px = Math.min(info.width - 1, Math.max(0, Math.round(x)));
        const py = Math.min(info.height - 1, Math.max(0, Math.round(y)));
        const offset = (py * info.width + px) * info.channels;
        return [data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0];
      };

      const skyFloor = skyFloorOf(id);
      let worst = 0;
      let worstAt = 0;
      for (let f = 0.01; f < skyFloor; f += 0.02) {
        const y = f * DESKTOP.height;
        const step = Math.max(
          ...[0, 1, 2].map((c) => Math.abs((at(box.x - INSET, y)[c] ?? 0) - (at(box.x + INSET, y)[c] ?? 0))),
          ...[0, 1, 2].map((c) =>
            Math.abs((at(box.x + box.width + INSET, y)[c] ?? 0) - (at(box.x + box.width - INSET, y)[c] ?? 0)),
          ),
        );
        if (step > worst) {
          worst = step;
          worstAt = f;
        }
      }

      expect(
        worst,
        `the side panel is ${worst} per channel away from the canvas beside it at ${(worstAt * 100).toFixed(0)}% ` +
          'down the sky, so a seam runs down the edge of the playfield',
      ).toBeLessThanOrEqual(MAX_SKY_STEP);
    });
  }

  test('the page is handed the level\'s own sky, not a straight ramp', async ({ page }) => {
    await openLevel(page, 'halifax');

    const variables = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        stops: style.getPropertyValue('--tn-sky-stops').trim(),
        top: style.getPropertyValue('--tn-sky-top').trim(),
      };
    });

    expect(
      variables.stops.length,
      'the page got no sky stops, so the panel is the two-stop ramp again',
    ).toBeGreaterThan(0);
    /* The band above a letterboxed canvas and the panels share the first row,
       and they take it from the same list, so they cannot drift (ADR-0044). */
    expect(variables.stops.startsWith(variables.top)).toBe(true);
    /*
     * Positioned against the canvas box, or a phone's flat bands would move.
     *
     * Read as the resolved expression, not as the `var()`s that built it:
     * `--tn-canvas-top` and `--tn-canvas-height` are declared on `:root`, and a
     * custom property's own `var()`s are substituted on the element that
     * declares it - so by the time this reads `--tn-sky-stops`, the names are
     * gone and the arithmetic is there instead. Asserting the names passed only
     * while they were declared somewhere else, which is the bug that moving them
     * to `:root` fixed.
     *
     * The canvas aspect is what makes this a real guard: `16 / 9` enters only
     * through the canvas-box formula, so a stop list positioned against the
     * viewport alone cannot satisfy it.
     */
    expect(variables.stops).toContain('16 / 9');
    expect(variables.stops).toContain('100dvh');
  });

  test('a portrait phone has no side panels to extend, and is unchanged', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 860 });
    await page.goto('./?e2e=1&level=halifax');
    await page.waitForSelector('[data-testid="playable"]', { timeout: 60_000 });

    const box = await page.locator('#game canvas').boundingBox();
    expect(box).not.toBeNull();
    if (box === null) return;

    /* Full width: the letterbox here is the band above and below, which ADR-0044
       owns and this change does not touch. */
    expect(box.x).toBeLessThanOrEqual(0.5);
    expect(box.width).toBeCloseTo(400, 0);
  });
});
