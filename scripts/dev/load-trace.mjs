// Dev helper: trace boot + district load with timestamps. node scripts/dev/load-trace.mjs [preset] [url]
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
const preset = process.argv[2] ?? 'minimal';
const base = process.argv[3] ?? 'http://localhost:4175/OhCanada/';
const server = base.includes('localhost') ? spawn('npx', ['vite', 'preview', '--port', '4175', '--strictPort'], { stdio: 'ignore' }) : null;
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const t0 = Date.now();
const log = (s) => console.log(`${String(Date.now() - t0).padStart(6)}ms ${s}`);
page.on('console', (m) => { const t = m.text(); if (!t.includes('GL Driver')) log(`${m.type()}: ${t.slice(0, 220)}`); });
page.on('pageerror', (e) => log(`PAGEERROR ${e.message}`));
page.on('requestfailed', (r) => log(`REQFAIL ${r.url()}`));
await page.goto(`${base}?e2e=1&preset=${preset}`, { waitUntil: 'load' });
await page.getByTestId('menu-new').waitFor({ timeout: 120000 });
log('menu');
await page.getByTestId('menu-new').click();
await page.getByTestId('creator-confirm').click();
log('confirm clicked');
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(5000);
  const st = await page.evaluate(() => ({ loading: !!document.querySelector('[data-screen="loading"]'), text: document.querySelector('[data-screen="loading"]')?.textContent?.slice(0, 80), bar: document.querySelector('.loading .bar > div')?.getAttribute('style'), hud: !!document.querySelector('[data-screen="hud"]') })).catch(() => null);
  log(JSON.stringify(st));
  if (st && !st.loading && st.hud) break;
}
await browser.close(); server?.kill(); process.exit(0);
