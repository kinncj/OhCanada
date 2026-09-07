// Dev helper: drive slice 1 headlessly and screenshot each stage. Usage: node scripts/dev/walkthrough.mjs <outdir>
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
const out = process.argv[2] ?? '.';
const port = 4173;
const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (!m.text().includes('GL Driver')) logs.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`PAGEERROR: ${e.message}\n${e.stack}`));
try {
  await page.goto(`http://localhost:${port}/OhCanada/?e2e=1&preset=high`, { waitUntil: 'load' });
  await page.getByTestId('menu-new').waitFor({ timeout: 30000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${out}/w1-menu.png` });
  await page.getByTestId('menu-new').click();
  await page.getByTestId('creator-name').fill('Sam');
  await page.getByTestId('opt-outfit-hockey').click();
  await page.getByTestId('opt-accessory-toque').click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/w2-creator.png` });
  await page.getByTestId('creator-confirm').click();
  await page.waitForFunction(() => document.querySelector('[data-screen="hud"]') && !document.querySelector('[data-screen="loading"]'), null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/w3-world.png` });
  // Walk to Amélie via hook and interact
  await page.evaluate(() => window.__truenorth.teleport(4, 12.5));
  await page.waitForTimeout(800);
  const near = await page.evaluate(() => window.__truenorth.nearby());
  logs.push(`nearby=${near}`);
  await page.evaluate(() => window.__truenorth.interact());
  await page.getByTestId('dialogue-line').waitFor({ timeout: 10000 });
  await page.screenshot({ path: `${out}/w4-dialogue.png` });
  for (let i = 0; i < 6; i++) {
    if (await page.getByTestId('dialogue-accept').isVisible().catch(() => false)) { await page.getByTestId('dialogue-accept').click(); break; }
    await page.getByTestId('dialogue-next').click();
  }
  // step dialogue: click next until close
  for (let i = 0; i < 6; i++) {
    if (await page.getByTestId('dialogue-close').isVisible().catch(() => false)) { await page.getByTestId('dialogue-close').click(); break; }
    await page.getByTestId('dialogue-next').click();
  }
  await page.waitForTimeout(500);
  logs.push(`objective=${await page.getByTestId('objective').textContent()}`);
  await page.evaluate(() => window.__truenorth.teleport(16, 12));
  await page.getByTestId('question-text').waitFor({ timeout: 10000 });
  await page.screenshot({ path: `${out}/w5-question.png` });
  for (let i = 0; i < 3; i++) {
    await page.getByTestId('question-text').waitFor({ timeout: 10000 });
    await page.locator('[data-testid^="choice-"][data-correct="true"]').click();
    await page.getByTestId('question-submit').click();
    await page.getByTestId('feedback').waitFor();
    if (i === 0) await page.screenshot({ path: `${out}/w6-feedback.png` });
    await page.getByTestId('question-continue').click();
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/w7-complete.png` });
  logs.push(`stamps=${await page.getByTestId('stamps').textContent()}`);
  const state = await page.evaluate(() => JSON.stringify(window.__truenorth.state().unlockedDistricts));
  logs.push(`unlocked=${state}`);
  await page.reload({ waitUntil: 'load' });
  await page.getByTestId('menu-continue').waitFor({ timeout: 30000 });
  logs.push('reload: continue button present');
} catch (e) {
  logs.push(`FAIL: ${e.message}`);
  await page.screenshot({ path: `${out}/w-fail.png` }).catch(() => undefined);
}
console.log(logs.join('\n'));
await browser.close();
server.kill();
process.exit(0);
