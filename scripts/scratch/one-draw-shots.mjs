/**
 * Before/after proof for ADR-0053 rule 3: one draw, one holder, and the holder
 * is the screen.
 *
 * Not a test suite: a screenshot script, run by hand against `vite preview`,
 * kept under `scripts/scratch/` per ADR-0021. The unit and e2e suites are the
 * contract; this is the evidence that the contract describes the screen.
 *
 * The route is the one the audit walked and the one the ADR names in fact 4:
 *
 *   cold load ─► title ─► Play ─► "Surprise me" ─► Back ─► title ─► Play
 *
 * Before the fix, the first-run draw was made in `app/bootstrap/main.ts` and
 * kept there as well as in `app/ui/shell.ts`, so the title screen painted the
 * face from *before* the re-roll while the creator held the one after it. The
 * measurement is therefore two facts per run, both read off the page rather
 * than off a picture:
 *
 *   - `title-figure`'s `data-state` — `empty` is "no figure asked for or none
 *     to paint", `ready` is "a face is on the screen";
 *   - the creator preview's `data-*` slots before and after Back, which say
 *     which character the screen is holding.
 *
 * Usage:
 *   npm run build && npm run preview &
 *   node scripts/scratch/one-draw-shots.mjs <outDir>
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const { basePath } = JSON.parse(readFileSync(`${ROOT}content/game.config.json`, 'utf8'));
const ORIGIN = process.env.PREVIEW_ORIGIN ?? 'http://localhost:4173';
const BASE = `${ORIGIN}${basePath.endsWith('/') ? basePath : `${basePath}/`}`;

const outDir = process.argv[2] ?? '/tmp/one-draw';

/** The e2e suite's phone: portrait only (ADR-0002). */
const PHONE = { width: 390, height: 844 };

/** Long enough for a still to be painted and the frame to settle. */
const PAINT_MS = 2500;

const SLOTS = ['skin', 'hair-shape', 'hair-colour', 'head-covering', 'feature', 'presentation'];

const testId = (id) => `[data-testid="${id}"]`;

async function figureState(page) {
  return page.evaluate(() => {
    const frame = document.querySelector('[data-testid="title-figure"]');
    if (frame === null) return { present: false };
    return {
      present: true,
      state: frame.getAttribute('data-state'),
      hidden: frame.hidden,
      hasSrc: frame.querySelector('img')?.getAttribute('src') !== null,
    };
  });
}

/** The character the creator's picture is dressed in. */
async function appearance(page) {
  return page.evaluate((slots) => {
    const node = document.querySelector('[data-testid="character-preview"]');
    if (node === null) return null;
    const read = {};
    for (const slot of slots) read[slot] = node.getAttribute(`data-${slot}`);
    return read;
  }, SLOTS);
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function shot(page, name) {
  await page.screenshot({ path: `${outDir}/${name}.png` });
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: PHONE, deviceScaleFactor: 2 });
  const report = {};

  /* A browser that has never played: no save, so no character, so a first run. */
  await page.goto(BASE);
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.goto(BASE);
  await page.waitForFunction(
    () => document.documentElement.dataset.tnBoot === 'ready',
    undefined,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(PAINT_MS);

  report.titleOnColdLoad = await figureState(page);
  await shot(page, '1-title-first-run');

  await page.click(testId('title-play'));
  await page.waitForSelector(testId('character-creator'));
  await page.waitForTimeout(PAINT_MS);
  report.creatorOpenedOn = await appearance(page);
  await shot(page, '2-creator-opened');

  await page.click(testId('randomise-character'));
  await page.waitForTimeout(PAINT_MS);
  report.afterSurpriseMe = await appearance(page);
  await shot(page, '3-creator-after-surprise-me');

  await page.click(testId('creator-back'));
  await page.waitForSelector(testId('title-screen'));
  await page.waitForTimeout(PAINT_MS);
  report.titleAfterBack = await figureState(page);
  await shot(page, '4-title-after-back');

  await page.click(testId('title-play'));
  await page.waitForSelector(testId('character-creator'));
  await page.waitForTimeout(PAINT_MS);
  report.creatorReopenedOn = await appearance(page);
  await shot(page, '5-creator-reopened');

  /* Accept it: the save has a character now, so the screen before the creator
     has something of the player's to draw. */
  await page.click(testId('start-playing'));
  await page.waitForSelector(testId('level-select'));
  await page.click(testId('level-select-back'));
  await page.waitForSelector(testId('title-screen'));
  await page.waitForTimeout(PAINT_MS);
  report.titleAfterAccepting = await figureState(page);
  await shot(page, '6-title-after-accepting');

  report.verdict = {
    titleShowedAFaceBeforeAnyChoice: report.titleOnColdLoad.state === 'ready',
    titleShowedAFaceAfterBack: report.titleAfterBack.state === 'ready',
    creatorKeptTheReRoll: same(report.afterSurpriseMe, report.creatorReopenedOn),
    titleDrawsTheAcceptedCharacter: report.titleAfterAccepting.state === 'ready',
  };

  writeFileSync(`${outDir}/summary.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

await main();
