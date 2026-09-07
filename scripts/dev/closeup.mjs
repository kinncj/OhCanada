// Dev helper: teleport near vegetation and screenshot at a given preset. node scripts/dev/closeup.mjs <out.png> [preset] [x] [z]
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
const [out, preset = 'low', x = '-40', z = '-70'] = process.argv.slice(2);
const server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(`http://localhost:4174/OhCanada/?e2e=1&preset=${preset}`, { waitUntil: 'load' });
await page.getByTestId('menu-new').waitFor({ timeout: 120000 });
await page.getByTestId('menu-new').click();
await page.getByTestId('creator-confirm').click();
await page.waitForFunction(() => !!document.querySelector('[data-screen="hud"]') && !document.querySelector('[data-screen="loading"]') && !!window.__truenorth, null, { timeout: 120000 });
await page.evaluate(([px, pz]) => window.__truenorth.teleport(Number(px), Number(pz)), [x, z]);
await page.waitForTimeout(6000);
await page.screenshot({ path: out, timeout: 120000 });
await browser.close(); server.kill(); process.exit(0);
