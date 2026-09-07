// Report helper: screenshot of the hub from the Peace Tower. node scripts/dev/peace-tower-shot.mjs <out.png> [preset]
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
const [out, preset = 'low'] = process.argv.slice(2);
const server = spawn('npx', ['vite', 'preview', '--port', '4177', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(`http://localhost:4177/OhCanada/?e2e=1&preset=${preset}`, { waitUntil: 'load' });
await page.getByTestId('menu-new').waitFor({ timeout: 300000 });
await page.getByTestId('menu-new').click();
await page.getByTestId('creator-confirm').click();
await page.waitForFunction(() => !!document.querySelector('[data-screen="hud"]') && !document.querySelector('[data-screen="loading"]') && !!window.__truenorth?.camera, null, { timeout: 600000 });
await page.evaluate(() => window.__truenorth.camera(0, 95, -22, 0, 0, 120)); // eye on the tower, looking south over the plaza
await page.waitForTimeout(8000);
await page.screenshot({ path: out, timeout: 600000 });
await browser.close(); server.kill(); process.exit(0);
