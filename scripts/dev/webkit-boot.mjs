// Dev helper: boot the live (or given) URL in WebKit with an iPhone profile and report console errors.
import { webkit, devices } from '@playwright/test';
const url = process.argv[2] ?? 'https://kinncj.github.io/OhCanada/?debug=1';
const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices['iPhone 14'] });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning' || m.text().includes('[truenorth]')) logs.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
page.on('pageerror', (e) => logs.push(`PAGEERROR: ${e.message}\n${(e.stack ?? '').slice(0, 600)}`));
page.on('requestfailed', (r) => logs.push(`REQFAIL: ${r.url()} ${r.failure()?.errorText}`));
const t0 = Date.now();
await page.goto(url, { waitUntil: 'load' });
try { await page.getByTestId('menu-new').or(page.getByTestId('menu-continue')).first().waitFor({ timeout: 90000 }); logs.push(`MENU OK after ${Date.now() - t0} ms`); } catch { logs.push('MENU NOT SHOWN'); }
await page.waitForTimeout(5000);
await page.screenshot({ path: process.argv[3] ?? 'webkit.png' });
console.log(logs.join('\n'));
await browser.close();
