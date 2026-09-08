import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { expect, test } from '@playwright/test';

/**
 * Slice 0's acceptance test: the empty portrait canvas, served from the
 * production build at the real base path.
 *
 * Everything here is a contract from ADR-0002 (portrait only, FIT, centred with
 * side panels on desktop) or from CLAUDE.md's accessibility rules (the canvas is
 * `aria-hidden`, game events reach a screen reader through a live region).
 */

/** 1080x1920. The canvas is FIT-scaled, so the ratio is invariant, not the size. */
const DESIGN_RATIO = 1080 / 1920;

type Rgb = readonly [number, number, number];

/**
 * The colours are read from the shipped config, not re-typed here, because that
 * is the claim under test: `content/game.config.json` is what the player sees.
 * Perturb the theme and this suite must fail; hard-coding the values would only
 * prove the renderer draws *some* blue.
 */
const THEME = (
  JSON.parse(
    readFileSync(fileURLToPath(new URL('../../content/game.config.json', import.meta.url)), 'utf8'),
  ) as { theme: Record<string, string> }
).theme;

const toRgb = (hex: string): Rgb => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
];

const SKY: Rgb = toRgb(THEME['sky'] ?? '#000000');
const GROUND: Rgb = toRgb(THEME['ground'] ?? '#000000');

/**
 * Where the land meets the sky, as a fraction of the canvas height. Wide enough
 * to hold the whole ridge - it rises about 87 and dips about 57 design pixels
 * around the two-thirds line - and no wider, so the search cannot wander onto
 * the title or the skirt. See `app/adapters/phaser/horizon-profile.ts`.
 */
const HORIZON_BAND = { top: 0.61, bottom: 0.71 } as const;

/** Columns the crest is measured at. Spread across the width, edges included. */
const CREST_COLUMNS = [0.02, 0.06, 0.18, 0.3, 0.42, 0.54, 0.66, 0.78, 0.9, 0.98] as const;

/** Antialiasing and colour management move a channel by a few counts. */
const CHANNEL_TOLERANCE = 12;

function expectNear(actual: Rgb, expected: Rgb, label: string): void {
  for (let channel = 0; channel < 3; channel += 1) {
    expect(
      Math.abs((actual[channel] ?? 0) - (expected[channel] ?? 0)),
      `${label} channel ${channel}: got ${actual.join(',')}, expected ~${expected.join(',')}`,
    ).toBeLessThanOrEqual(CHANNEL_TOLERANCE);
  }
}

test.describe('boot', () => {
  test('the production build responds at the base path', async ({ page }) => {
    const response = await page.goto('./');

    expect(response, 'no response from vite preview').not.toBeNull();
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('html')).toHaveCount(1);
    expect(await page.title()).not.toBe('');
  });

  test('renders a portrait canvas at the 1080x1920 design resolution', async ({ page }) => {
    await page.goto('./');

    const canvas = page.locator('#game canvas');
    await expect(canvas).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');

    const box = await canvas.boundingBox();
    expect(box, 'the canvas has no layout box').not.toBeNull();
    if (box === null) return;

    expect(box.height).toBeGreaterThan(box.width);
    expect(box.width / box.height).toBeCloseTo(DESIGN_RATIO, 2);

    // FIT never crops: the canvas fits inside the 390x844 viewport.
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    expect(box.width).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);
    expect(box.height).toBeLessThanOrEqual((viewport?.height ?? 0) + 1);
  });

  test('draws the sky-to-ground gradient, and a land horizon that is not a bar', async ({
    page,
  }) => {
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');

    /*
      Screenshot rather than a canvas read-back: the WebGL context is created
      without `preserveDrawingBuffer`, so `drawImage(canvas)` after the frame has
      been composited returns transparent black. The screenshot is also the
      stronger assertion - it is what the player actually sees.
    */
    const shot = await page.locator('#game canvas').screenshot();
    const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });

    const pixel = (xFraction: number, yFraction: number): Rgb => {
      const x = Math.min(info.width - 1, Math.floor(info.width * xFraction));
      const y = Math.min(info.height - 1, Math.floor(info.height * yFraction));
      const offset = (y * info.width + x) * info.channels;
      return [data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0];
    };
    const luminance = ([r, g, b]: Rgb): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;

    const sky = pixel(0.5, 0.01);
    const ground = pixel(0.5, 0.99);

    expectNear(sky, SKY, 'sky');
    expectNear(ground, GROUND, 'ground');
    expect(luminance(sky)).not.toBeCloseTo(luminance(ground), 0);

    /*
      This assertion used to read "the brightest pixel in a thin band at two
      thirds is much brighter than the middle of the screen", and a straight
      bright bar across an empty screen passed it - which is exactly what
      shipped, and exactly what two players reported as "stuck at the loading
      screen". Same composition rule, stated so that only scenery can satisfy it:
      the lit crest has to be there at every column, it has to sit at different
      heights at different columns, and it still has to average out on the
      two-thirds line. A progress bar fails the second clause by definition.
    */
    const crestOf = (xFraction: number): { y: number; lum: number } => {
      let best = { y: 0, lum: -1 };
      for (let y = HORIZON_BAND.top; y <= HORIZON_BAND.bottom; y += 0.0005) {
        const lum = luminance(pixel(xFraction, y));
        if (lum > best.lum) best = { y, lum };
      }
      return best;
    };

    const crests = CREST_COLUMNS.map((column) => ({ column, ...crestOf(column) }));
    const backdrop = luminance(pixel(0.5, 0.45));

    for (const crest of crests) {
      expect(
        crest.lum,
        `no lit horizon at x=${crest.column}: the land must reach both frames`,
      ).toBeGreaterThan(backdrop + 40);
    }

    const heights = crests.map((crest) => crest.y);
    const spread = Math.max(...heights) - Math.min(...heights);
    expect(
      spread,
      `the horizon is flat to within ${(spread * 100).toFixed(2)}% of the canvas: ` +
        'a straight bright rule across an empty screen reads as a progress bar, ' +
        'which is the defect this profile exists to prevent (app/adapters/phaser/horizon-profile.ts)',
    ).toBeGreaterThan(0.02);

    const mean = heights.reduce((total, value) => total + value, 0) / heights.length;
    // ADR-0002: playfield above, HUD and question cards below. The line moves; the split does not.
    expect(mean).toBeGreaterThan(0.63);
    expect(mean).toBeLessThan(0.7);
  });

  test('tells the visitor what this build is, in the DOM rather than on the canvas', async ({
    page,
  }) => {
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');

    /*
      A working build that says nothing is indistinguishable from a broken one:
      slice 0 was reported as a hung loader twice, from two devices. The sentence
      has to be DOM, because the canvas is `aria-hidden` and a screen-reader user
      would otherwise get "TrueNorth ready" and nothing else.
    */
    const status = page.locator('#tn-build-status');
    await expect(status).toBeVisible();
    await expect(status).toHaveText(/\S/);
    await expect(status).toHaveAttribute('lang', /^(en|fr)$/);
    await expect(status).not.toHaveAttribute('aria-hidden', /.*/);

    // It is a caption, not the announcer: one live region, and this is not it.
    await expect(status).not.toHaveAttribute('aria-live', /.*/);
    await expect(page.locator('[aria-live]')).toHaveCount(1);

    // Nothing on the page may promise progress that is not happening.
    const wording = ((await status.textContent()) ?? '').toLowerCase();
    for (const forbidden of ['load', 'chargement', 'wait', 'veuillez', '%']) {
      expect(wording, `"${forbidden}" re-creates the impression this fixes`).not.toContain(
        forbidden,
      );
    }
  });

  test('hides the canvas from assistive technology and exposes a live region', async ({
    page,
  }) => {
    await page.goto('./');

    const canvas = page.locator('#game canvas');
    await expect(canvas).toHaveAttribute('aria-hidden', 'true');
    // An aria-hidden element must not be reachable by keyboard.
    await expect(canvas).not.toHaveAttribute('tabindex', /.*/);

    const live = page.locator('[aria-live]');
    await expect(live).toHaveCount(1);
    await expect(live).toHaveAttribute('role', 'status');
    await expect(live).toHaveAttribute('aria-live', 'polite');
    await expect(live).toHaveText(/TrueNorth ready/);
  });

  test('stays portrait: no landscape layout, and the game pauses behind the overlay', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('./');

    const overlay = page.getByRole('alertdialog');
    await expect(overlay).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'true');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(overlay).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-tn-paused', 'false');

    const box = await page.locator('#game canvas').boundingBox();
    expect(box).not.toBeNull();
    expect(box?.height ?? 0).toBeGreaterThan(box?.width ?? 0);
  });

  test('centres the portrait canvas on a wide viewport instead of stretching it', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');

    // A wide window is not a phone: no overlay, the game keeps playing.
    await expect(page.getByRole('alertdialog')).toBeHidden();

    const box = await page.locator('#game canvas').boundingBox();
    expect(box).not.toBeNull();
    if (box === null) return;

    expect(box.width / box.height).toBeCloseTo(DESIGN_RATIO, 2);
    // Side panels exist on both sides, and they are the same width.
    const left = box.x;
    const right = 1440 - (box.x + box.width);
    expect(left).toBeGreaterThan(100);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(2);

    // The panels are painted from the same sky/ground colours as the canvas,
    // and those colours came from the config rather than index.html's literals.
    const panel = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const read = (name: string): string => style.getPropertyValue(name).trim();
      return {
        sky: read('--tn-sky'),
        ground: read('--tn-ground'),
        land: read('--tn-land'),
        crest: read('--tn-land-crest'),
        skirt: read('--tn-land-skirt'),
        end: read('--tn-land-end'),
      };
    });
    expect(panel.sky).toBe(THEME['sky']);
    expect(panel.ground).toBe(THEME['ground']);

    /*
      The land continues past the canvas too, or a wide window shows the hills
      stopping dead at the letterbox edge and the scene reads as a framed
      picture. The renderer computes all four values; index.html only places
      them, so a stale literal in the page cannot survive here.
    */
    expect(panel.land, 'the page never learned the land colour').toMatch(/^#[0-9a-f]{6}$/);
    expect(panel.land).not.toBe(THEME['ground']);
    const asFraction = (value: string): number => Number.parseFloat(value) / 100;
    expect(asFraction(panel.crest)).toBeGreaterThan(0.6);
    expect(asFraction(panel.crest)).toBeLessThan(asFraction(panel.skirt));
    expect(asFraction(panel.skirt)).toBeLessThan(asFraction(panel.end));
    // The fade has to finish above the last row, or the panels stop matching the
    // canvas exactly where the two meet.
    expect(asFraction(panel.end)).toBeLessThan(1);

    // Measured, not assumed: the side panel really is land at that height.
    const panelPixel = await page.screenshot({
      clip: { x: 20, y: 900 * 0.8, width: 8, height: 8 },
    });
    const { data: panelData } = await sharp(panelPixel)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const panelGround = await page.screenshot({
      clip: { x: 20, y: 900 * 0.99 - 8, width: 8, height: 8 },
    });
    const { data: groundData } = await sharp(panelGround)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const lum = (buffer: Buffer): number =>
      0.2126 * (buffer[0] ?? 0) + 0.7152 * (buffer[1] ?? 0) + 0.0722 * (buffer[2] ?? 0);
    expect(
      lum(panelData),
      'the side panel is still bare gradient below the horizon: the land stops at the canvas edge',
    ).toBeLessThan(lum(groundData) - 5);

    const themeColor = await page
      .locator('meta[name="theme-color"]')
      .getAttribute('content');
    expect(themeColor).toBe(THEME['sky']);
  });
});
