/**
 * Before/after proof for the desktop side panels, and a ruler for the seam.
 *
 * Not a test suite: a screenshot script, run by hand against `vite preview`, kept
 * under `scripts/scratch/` per ADR-0021. The unit tests are the contract; this is
 * the evidence that the contract describes the screen.
 *
 * CLAUDE.md: "Desktop centres the portrait canvas; side panels extend the level's
 * sky/ground" (ADR-0002). A fourth-round live audit said the panels were two flat
 * bands whose blue did not match the canvas, leaving a visible vertical seam down
 * both edges of the playfield. This measures that seam the way ADR-0044 measured
 * the horizontal one: the per-channel difference between the page just outside
 * the canvas and the canvas just inside it, at the same row.
 *
 * The measurement is self-contained in one screenshot, so it does not depend on
 * the time of day the run happened at — which matters, because the sky is tinted
 * from the device clock and a before run and an after run are minutes apart.
 *
 * Usage:
 *   node scripts/scratch/desktop-panel-shots.mjs <outDir> [levels...]
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const { basePath } = JSON.parse(readFileSync(`${ROOT}content/game.config.json`, 'utf8'));
const ORIGIN = process.env.PREVIEW_ORIGIN ?? 'http://localhost:4173';
const BASE = `${ORIGIN}${basePath.endsWith('/') ? basePath : `${basePath}/`}`;

const outDir = process.argv[2] ?? '/tmp/panels';
const args = process.argv.slice(3);
const LEVELS = args.length > 0 ? args : ['halifax', 'the-north'];

/** The audit's desktop viewport: wider than 9:16, so `Scale.FIT` leaves panels. */
const DESKTOP = { width: 1440, height: 900 };
/** A phone at the width the brief names, to show it did not move. */
const PHONE = { width: 400, height: 860 };

/** How far in from the canvas edge each sample sits, in CSS px. */
const INSET = 6;

const PROPS = [
  '--tn-sky',
  '--tn-sky-top',
  '--tn-ground',
  '--tn-land',
  '--tn-land-crest',
  '--tn-land-skirt',
  '--tn-land-end',
  '--tn-sky-stops',
];

const hex = (r, g, b) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

async function openLevel(page, level) {
  await page.goto(`${BASE}?e2e=1&level=${level}`);
  await page.waitForSelector('[data-testid="playable"]', { timeout: 60_000 });
  /* Two rendered frames after the level says it is playable, so every band,
     every layer and the page variables have certainly been painted once. */
  await page.waitForTimeout(1500);
}

const readProps = (page) =>
  page.evaluate((names) => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name).trim()]));
  }, PROPS);

const canvasBox = (page) =>
  page.evaluate(() => {
    const box = document.querySelector('#game canvas')?.getBoundingClientRect();
    return box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null;
  });

/** Raw RGB of a screenshot, with a pixel reader. `deviceScaleFactor` is 1. */
async function pixels(buffer) {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  const at = (x, y) => {
    const px = Math.min(info.width - 1, Math.max(0, Math.round(x)));
    const py = Math.min(info.height - 1, Math.max(0, Math.round(y)));
    const offset = (py * info.width + px) * info.channels;
    return [data[offset], data[offset + 1], data[offset + 2]];
  };
  return { at, width: info.width, height: info.height };
}

const run = async () => {
  mkdirSync(outDir, { recursive: true });
  const tag = process.env.TAG ?? 'shot';
  const browser = await chromium.launch();
  const report = {};

  for (const level of LEVELS) {
    /* ---------------------------------------------------------- desktop */
    const context = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await openLevel(page, level);

    const shot = `${outDir}/${tag}-${level}-desktop-1440x900.png`;
    await page.screenshot({ path: shot });

    const box = await canvasBox(page);
    const props = await readProps(page);
    const { at } = await pixels(await page.screenshot());

    const crest = Number.parseFloat(props['--tn-land-crest']) / 100;

    /*
     * Where this level's sky ends, read from the level document exactly as the
     * scene reads it: the second layer in depth order is the first thing drawn
     * in front of the sky.
     *
     * The three zones are reported apart because they make three different
     * claims. The sky is profiled and must match. The mid-ground is deliberately
     * NOT profiled — one colour per row cannot describe a row with a skyline
     * across it — so the panel ramps through it, as it always did. The ground is
     * the flat land band. Lumping them together as "sky" is how a headline
     * number lies about which of the three moved.
     */
    const document = JSON.parse(readFileSync(`${ROOT}content/levels/${level}.json`, 'utf8'));
    const ordered = [...document.layers].sort((a, b) => a.depth - b.depth);
    const skyFloor = Math.min(...ordered.slice(1).map((layer) => layer.offset.y)) / 1920;

    /**
     * The canvas row's own dominant colour, as the scene reports it: the
     * per-channel median across the canvas width.
     *
     * Measured as well as the single column beside the edge, because the two
     * answer different questions. One flat colour cannot equal every pixel of a
     * row with clouds on it, so a single column at a cloud reports a step the
     * design never promised; the median is what the panel is actually claiming
     * to be. Both are printed so neither can flatter the result.
     */
    const rowMedian = (y) => {
      const channels = [[], [], []];
      for (let x = Math.ceil(box.x) + 2; x < box.x + box.width - 2; x += 2) {
        const pixel = at(x, y);
        for (let c = 0; c < 3; c += 1) channels[c].push(pixel[c]);
      }
      return channels.map((values) => {
        values.sort((one, other) => one - other);
        return values[Math.floor(values.length / 2)] ?? 0;
      });
    };

    const rows = [];
    /* Every row of the sky half, sampled evenly, plus a few below the crest so
       the ground half is reported rather than assumed. */
    for (let f = 0.01; f < 0.995; f += 0.02) {
      const y = f * DESKTOP.height;
      const left = at(box.x - INSET, y);
      const inLeft = at(box.x + INSET, y);
      const right = at(box.x + box.width + INSET, y);
      const inRight = at(box.x + box.width - INSET, y);
      const step = Math.max(
        ...[0, 1, 2].map((i) => Math.abs(left[i] - inLeft[i])),
        ...[0, 1, 2].map((i) => Math.abs(right[i] - inRight[i])),
      );
      const median = rowMedian(y);
      const medianStep = Math.max(...[0, 1, 2].map((i) => Math.abs(left[i] - median[i])));
      rows.push({
        f: Number(f.toFixed(3)),
        zone: f < skyFloor ? 'sky' : f < crest ? 'mid' : 'ground',
        step,
        medianStep,
        panel: hex(...left),
        canvas: hex(...inLeft),
        canvasRow: hex(...median),
      });
    }

    const sky = rows.filter((row) => row.zone === 'sky');
    const mid = rows.filter((row) => row.zone === 'mid');
    const ground = rows.filter((row) => row.zone === 'ground');
    const worst = (list) => list.reduce((a, b) => (b.step > a.step ? b : a), list[0]);
    const mean = (list) => list.reduce((total, row) => total + row.step, 0) / list.length;
    const worstMedian = (list) => list.reduce((a, b) => (b.medianStep > a.medianStep ? b : a), list[0]);
    const meanMedian = (list) =>
      list.reduce((total, row) => total + row.medianStep, 0) / list.length;

    const panelArea = (DESKTOP.width - box.width) * DESKTOP.height;
    report[level] = {
      desktop: {
        shot,
        canvas: box,
        props,
        panelAreaRatio: Number((panelArea / (box.width * box.height)).toFixed(3)),
        skySeam: { worst: worst(sky), mean: Number(mean(sky).toFixed(1)) },
        groundSeam: { worst: worst(ground), mean: Number(mean(ground).toFixed(1)) },
        rows,
      },
    };

    console.log(`\n=== ${level} @ 1440x900 (${tag}) ===`);
    console.log(`  canvas          ${JSON.stringify(box)}`);
    console.log(`  panels are      ${report[level].desktop.panelAreaRatio}x the canvas area`);
    console.log(`  sky floor       ${(skyFloor * 100).toFixed(1)}%   land crest ${(crest * 100).toFixed(1)}%`);
    const zone = (label, list) => {
      if (list.length === 0) return;
      console.log(
        `  ${label.padEnd(15)} column: worst ${String(worst(list).step).padStart(3)} at ${worst(list).f}, mean ${mean(list).toFixed(1)}` +
          `  |  row: worst ${String(worstMedian(list).medianStep).padStart(3)}, mean ${meanMedian(list).toFixed(1)}`,
      );
    };
    zone('SKY (profiled)', sky);
    zone('mid (ramped)', mid);
    zone('ground (band)', ground);
    for (const row of rows) {
      console.log(`    ${(row.f * 100).toFixed(1).padStart(5)}%  ${row.zone.padEnd(6)}  panel ${row.panel}  canvasCol ${row.canvas}  canvasRow ${row.canvasRow}  col ${String(row.step).padStart(3)}  row ${String(row.medianStep).padStart(3)}`);
    }
    console.log(`  props           ${JSON.stringify(props)}`);
    await context.close();

    /* ------------------------------------------------------------ phone */
    const narrow = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 1 });
    const phone = await narrow.newPage();
    await openLevel(phone, level);
    const phoneShot = `${outDir}/${tag}-${level}-phone-400x860.png`;
    await phone.screenshot({ path: phoneShot });
    const phoneBox = await canvasBox(phone);
    const phonePixels = await pixels(await phone.screenshot());
    /* The letterbox on a phone this shape is the band above and below the
       canvas, not side panels. Both are page, so both are what could move. */
    const above = phoneBox.y > 2 ? phonePixels.at(PHONE.width / 2, phoneBox.y / 2) : null;
    const below =
      phoneBox.y + phoneBox.height < PHONE.height - 2
        ? phonePixels.at(PHONE.width / 2, (phoneBox.y + phoneBox.height + PHONE.height) / 2)
        : null;
    report[level].phone = {
      shot: phoneShot,
      canvas: phoneBox,
      sidePanels: phoneBox.x > 0.5,
      bandAbove: above ? hex(...above) : 'none',
      bandBelow: below ? hex(...below) : 'none',
      props: await readProps(phone),
    };
    console.log(`  phone 400x860   canvas ${JSON.stringify(phoneBox)} sidePanels=${report[level].phone.sidePanels} above=${report[level].phone.bandAbove} below=${report[level].phone.bandBelow}`);
    await narrow.close();
  }

  writeFileSync(`${outDir}/${tag}-report.json`, `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
