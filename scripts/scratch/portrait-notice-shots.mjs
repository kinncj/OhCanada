/**
 * The viewport matrix for the portrait notice (ADR-0060), as pictures.
 *
 * Not a test suite: a screenshot script, run by hand against `vite preview`,
 * kept under `scripts/scratch/` per ADR-0021. The gates are
 * `tests/unit/ui/viewport-mode.test.ts`, `tests/unit/ui/portrait-notice.test.ts`,
 * `tests/unit/bootstrap/portrait-notice.test.ts` and
 * `tests/a11y/portrait-notice.spec.ts`; this is the evidence that what they
 * describe is what a player sees.
 *
 * It drives the artefact a visitor loads, at the four viewports the decision is
 * about, and reports for each one: which audience the page decided it had, which
 * of the two screens appeared, and whether anything was made inert. The last
 * column is the one that matters — a desktop player must never be blocked
 * (CLAUDE.md, Orientation; ADR-0002, ADR-0055).
 *
 * The desktop case is then run twice more: once to press Close, and once after a
 * reload in the same browser profile, which is what "dismissal persists" means.
 *
 * Usage:
 *   node scripts/scratch/portrait-notice-shots.mjs <outDir>
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const { basePath } = JSON.parse(readFileSync(`${ROOT}content/game.config.json`, 'utf8'));
const ORIGIN = process.env.PREVIEW_ORIGIN ?? 'http://localhost:4173';
const BASE = `${ORIGIN}${basePath.endsWith('/') ? basePath : `${basePath}/`}`;

const outDir = process.argv[2] ?? '/tmp/portrait-notice';

const NOTICE = '[data-testid="portrait-notice"]';
const OVERLAY = '#tn-rotate-overlay';

/** The four the decision is about, plus the one that proves the breakpoint. */
const VIEWPORTS = [
  { name: 'phone-portrait', width: 390, height: 844, expect: 'nothing new' },
  { name: 'phone-landscape', width: 844, height: 390, expect: 'rotate overlay only' },
  { name: 'tablet-portrait', width: 768, height: 1024, expect: 'notice' },
  { name: 'tablet-landscape', width: 1024, height: 768, expect: 'notice' },
  { name: 'desktop', width: 1440, height: 900, expect: 'notice' },
];

/** What the page is showing, read from the DOM rather than from the picture. */
async function readState(page) {
  return page.evaluate(
    ({ notice, overlay }) => {
      const overlayElement = document.querySelector(overlay);
      const shell = document.getElementById('tn-shell');
      return {
        audience: document.documentElement.dataset.tnAudience ?? '(none)',
        mode: document.documentElement.dataset.tnMode ?? '(none)',
        notice: document.querySelector(notice) !== null,
        noticeText: document.querySelector(`${notice} p`)?.textContent ?? '',
        overlay: overlayElement !== null && !overlayElement.hasAttribute('hidden'),
        inert: document.querySelectorAll('[inert]').length,
        shellInert: shell?.inert ?? null,
        titleVisible: document.querySelector('[data-testid="title-screen"]') !== null,
        dismissedFlag: window.localStorage.getItem('truenorth.portrait-notice.dismissed'),
      };
    },
    { notice: NOTICE, overlay: OVERLAY },
  );
}

async function settle(page) {
  await page
    .waitForSelector('[data-testid="title-screen"], #tn-rotate-overlay:not([hidden])', {
      timeout: 20_000,
    })
    .catch(() => undefined);
  await page.waitForTimeout(600);
}

const rows = [];

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();

for (const viewport of VIEWPORTS) {
  /* A fresh context per viewport: a dismissal written by one must not decide
     the next, which is exactly the bug a shared profile would hide. */
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await settle(page);

  const state = await readState(page);
  await page.screenshot({ path: `${outDir}/${viewport.name}.png` });
  rows.push({ viewport: viewport.name, expected: viewport.expect, ...state });

  await context.close();
}

/* The desktop journey: shown, closed, and still gone after a reload — in one
   context, because persistence is the claim being made. */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await settle(page);
  await page.screenshot({ path: `${outDir}/desktop-1-shown.png` });

  await page.click('[data-testid="portrait-notice-dismiss"]');
  await page.waitForTimeout(300);
  const afterClose = await readState(page);
  await page.screenshot({ path: `${outDir}/desktop-2-dismissed.png` });
  rows.push({ viewport: 'desktop (after Close)', expected: 'gone', ...afterClose });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page);
  const afterReload = await readState(page);
  await page.screenshot({ path: `${outDir}/desktop-3-after-reload.png` });
  rows.push({ viewport: 'desktop (after reload)', expected: 'still gone', ...afterReload });

  await context.close();
}

await browser.close();

const report = rows
  .map(
    (row) =>
      `${row.viewport.padEnd(24)} expect=${String(row.expected).padEnd(20)} ` +
      `audience=${String(row.audience).padEnd(16)} mode=${String(row.mode).padEnd(16)} ` +
      `notice=${String(row.notice).padEnd(5)} overlay=${String(row.overlay).padEnd(5)} ` +
      `inert=${row.inert} shellInert=${row.shellInert} title=${row.titleVisible} ` +
      `flag=${row.dismissedFlag ?? '-'}\n    said: ${row.noticeText}`,
  )
  .join('\n');

writeFileSync(`${outDir}/report.txt`, `${report}\n`);
console.log(report);
console.log(`\nshots and report in ${outDir}`);
