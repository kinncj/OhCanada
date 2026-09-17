/**
 * Before/after proof for the "Less movement" defect, and a ruler for the mark.
 *
 * Not a test suite: a screenshot script, run by hand against `vite preview`, kept
 * under `scripts/scratch/` per ADR-0021. The unit tests are the contract; this is
 * the evidence that the contract describes the screen.
 *
 * For each level it opens the level directly (`?e2e=1&level=<id>`), shoots it,
 * turns on "Less movement" through the Settings screen exactly as a player does,
 * and shoots it again — then prints the scene probe's own numbers, which is what
 * makes the pair a measurement rather than two pictures.
 *
 * It also prints the canvas rectangle, so a mark's page position can be converted
 * to design pixels without guessing how `Scale.FIT` laid the canvas out.
 *
 * Usage: node scripts/scratch/reduced-motion-shots.mjs <outDir> [levels...]
 */

import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const { basePath } = JSON.parse(readFileSync(`${ROOT}content/game.config.json`, 'utf8'));
const ORIGIN = process.env.PREVIEW_ORIGIN ?? 'http://localhost:4173';
const BASE = `${ORIGIN}${basePath.endsWith('/') ? basePath : `${basePath}/`}`;

const outDir = process.argv[2] ?? '/tmp/shots';
const levels = process.argv.slice(3);
const LEVELS = levels.length > 0 ? levels : ['halifax', 'toronto'];

/** The audit's phone viewport, so the pictures are comparable to it. */
const PHONE = { width: 430, height: 950 };

/**
 * The audit's desktop viewport, for the side panels.
 *
 * Wider than 9:16, so `Scale.FIT` centres the portrait canvas and leaves
 * letterbox space either side — the panels CLAUDE.md says must extend the
 * level's sky and ground.
 */
const DESKTOP = { width: 1440, height: 900 };

const PROBE_KEYS = [
  'data-motion',
  'data-parallax-easing',
  'data-layers',
  'data-layers-textured',
  'data-layers-visible',
  'data-particles',
  'data-tier',
  'data-affordances',
  'data-affordances-ready',
];

async function readProbe(page) {
  return page.evaluate((keys) => {
    const el = document.querySelector('[data-testid="scene-state"]');
    const canvas = document.querySelector('#game canvas');
    const box = canvas?.getBoundingClientRect();
    return {
      probe: Object.fromEntries(keys.map((key) => [key, el?.getAttribute(key) ?? '?'])),
      canvas: box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null,
    };
  }, PROBE_KEYS);
}

async function openLevel(page, level) {
  await page.goto(`${BASE}?e2e=1&level=${level}`);
  await page.waitForSelector('[data-testid="playable"]', { timeout: 30_000 });
  /* Two rendered frames after the level says it is playable, so the first paint
     of every band has certainly happened. */
  await page.waitForTimeout(1200);
}

async function setReducedMotion(page) {
  await page.locator('[data-testid="hud-settings-button"]').click();
  const toggle = page.locator('[data-testid="setting-reduced-motion"]');
  await toggle.waitFor();
  await toggle.click();
  await page.locator('[data-testid="settings-close"]').click();
  await page.waitForTimeout(1200);
}

const run = async () => {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();

  for (const level of LEVELS) {
    const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 1 });
    const page = await context.newPage();

    await openLevel(page, level);
    await page.screenshot({ path: `${outDir}/${level}-01-motion-full.png` });
    const full = await readProbe(page);

    await setReducedMotion(page);
    await page.screenshot({ path: `${outDir}/${level}-02-motion-reduced.png` });
    const reduced = await readProbe(page);

    console.log(`\n=== ${level} ===`);
    console.log('  canvas   ', JSON.stringify(full.canvas));
    console.log('  full     ', JSON.stringify(full.probe));
    console.log('  reduced  ', JSON.stringify(reduced.probe));

    await context.close();

    /* The same level on a wide window, for the letterbox panels. */
    const wide = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1 });
    const widePage = await wide.newPage();
    await openLevel(widePage, level);
    await widePage.screenshot({ path: `${outDir}/${level}-03-desktop.png` });
    const panel = await widePage.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const names = ['--tn-sky-top', '--tn-ground', '--tn-land', '--tn-land-crest', '--tn-land-skirt', '--tn-land-end'];
      return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name).trim()]));
    });
    console.log('  panels   ', JSON.stringify(panel));
    await wide.close();
  }

  await browser.close();
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
