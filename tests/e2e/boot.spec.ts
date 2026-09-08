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

  test('draws the sky-to-ground gradient and the horizon at two thirds', async ({ page }) => {
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

    // The horizon rule sits at two-thirds height and is far brighter than the
    // gradient around it, which is how the composition rule is verified.
    let brightestHorizon = 0;
    for (let y = 0.655; y <= 0.675; y += 0.001) {
      brightestHorizon = Math.max(brightestHorizon, luminance(pixel(0.5, y)));
    }
    expect(brightestHorizon).toBeGreaterThan(luminance(pixel(0.5, 0.5)) + 40);
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
      return {
        sky: style.getPropertyValue('--tn-sky').trim(),
        ground: style.getPropertyValue('--tn-ground').trim(),
      };
    });
    expect(panel.sky).toBe(THEME['sky']);
    expect(panel.ground).toBe(THEME['ground']);

    const themeColor = await page
      .locator('meta[name="theme-color"]')
      .getAttribute('content');
    expect(themeColor).toBe(THEME['sky']);
  });
});
