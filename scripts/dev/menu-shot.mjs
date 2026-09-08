// Fast visual check: screenshot the menu with the hub rendering behind it.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
const [out, preset = 'minimal', waitMs = '25000'] = process.argv.slice(2);
const server = spawn('npx', ['vite', 'preview', '--port', '4178', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !t.includes('GL Driver')) console.log('CONSOLE_ERR', t.slice(0, 200)); });
await page.goto(`http://localhost:4178/OhCanada/?e2e=1&preset=${preset}`, { waitUntil: 'load' });
await page.getByTestId('menu-new').waitFor({ timeout: 120000 });
await page.waitForTimeout(Number(waitMs));
await page.screenshot({ path: out, timeout: 180000 });
await browser.close(); server.kill(); process.exit(0);
