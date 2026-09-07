import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = join(__dirname, '..', '..');
const config = JSON.parse(readFileSync(join(root, 'content', 'game.config.json'), 'utf8')) as { budgets: { initialPayloadBytes: number; hubSceneBytes: number; districtSceneBytes: number; timeToInteractiveMs: number } };
const dist = join(root, 'dist');
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

test.describe('Payload budgets (static analysis of dist/)', () => {
  test('initial payload (menu) ≤ 25 MB and hub scene ≤ 60 MB', () => {
    const files = walk(dist);
    const size = (f: string) => statSync(f).size;
    const sum = (list: string[]) => [...new Set(list)].reduce((n, f) => n + size(f), 0);
    const assetsDir = join(dist, 'assets');
    const code = files.filter((f) => f.startsWith(assetsDir) && /\.(js|css)$/.test(f) && !/\/(q-|[a-z-]+-intro-|[a-z-]+-[A-Za-z0-9_-]{8}\.js$)/.test(f));
    const shared = files.filter((f) => f.startsWith(assetsDir) && /\/(three|rapier|yuka|ajv|index)-[\w-]+\.(js|css)$/.test(f));
    const sky = files.filter((f) => /\/sky\//.test(f));
    const initial = sum([...code, ...shared, ...sky, join(dist, 'index.html')]);
    // Hub scene = everything the hub streams: content chunks for hub + first district, characters, textures, env models, transcoders, audio.
    const hubChunks = files.filter((f) => /\/(hub|hub-welcome|rights-responsibilities)-[\w-]+\.js$/.test(f));
    const hubAssets = files.filter((f) => /\/(models|textures|basis|draco|audio)\//.test(f) && !/\/models\/(env\/(facade|fort|pier|barrier|utility|power|hydrant|iron))/.test(f));
    const hub = initial + sum([...hubChunks, ...hubAssets]);
    console.log(`initial payload: ${(initial / 1048576).toFixed(2)} MB (budget ${(config.budgets.initialPayloadBytes / 1048576).toFixed(0)} MB); hub scene: ${(hub / 1048576).toFixed(2)} MB (budget ${(config.budgets.hubSceneBytes / 1048576).toFixed(0)} MB)`);
    expect(initial).toBeLessThanOrEqual(config.budgets.initialPayloadBytes);
    expect(hub).toBeLessThanOrEqual(config.budgets.hubSceneBytes);
    const gz = sum([]) + [...new Set([...code, ...shared])].reduce((n, f) => n + gzipSync(readFileSync(f)).length, 0) + sum(sky);
    console.log(`initial transfer (gzip): ${(gz / 1048576).toFixed(2)} MB`);
    // 50 Mbps = 6.25 MB/s; TTI budget must leave headroom for parse + GPU init.
    expect(gz / 6_553_600).toBeLessThan(config.budgets.timeToInteractiveMs / 1000 / 2);
  });

  test('every district payload ≤ 80 MB', () => {
    const files = walk(dist);
    const size = (f: string) => statSync(f).size;
    const districtAssets = files.filter((f) => /\/(models|textures)\//.test(f)).reduce((n, f) => n + size(f), 0);
    expect(districtAssets).toBeLessThanOrEqual(config.budgets.districtSceneBytes);
  });

  test('every district chunk ≤ district budget', () => {
    for (const f of walk(join(dist, 'assets')).filter((f) => f.endsWith('.js'))) {
      expect(statSync(f).size, f).toBeLessThanOrEqual(config.budgets.districtSceneBytes);
    }
  });

  test('no third-party script or CDN references in index.html (STRIDE: bundle everything)', () => {
    const html = readFileSync(join(dist, 'index.html'), 'utf8');
    expect(html).not.toMatch(/https?:\/\/(?!github\.com)[^"' ]+\.(js|css)/);
  });
});

test.describe('Runtime (headless, software GL — informational unless PERF_MIN_FPS is set)', () => {
  test('time to interactive and frame loop', async ({ page }) => {
    const start = Date.now();
    await page.goto(process.env.CI ? '?e2e=1&preset=minimal' : '?e2e=1&preset=low');
    await page.getByTestId('menu-new').waitFor({ timeout: 120_000 });
    const tti = Date.now() - start;
    console.log(`TTI (menu interactive, headless swiftshader): ${tti} ms`);
    // SwiftShader compiles shaders on the CPU; the real budget is enforced on the reference GPU configs (docs/runbook.md).
    if (process.env.PERF_STRICT) expect(tti).toBeLessThanOrEqual(config.budgets.timeToInteractiveMs);
    await page.getByTestId('menu-new').click();
    await page.getByTestId('creator-confirm').click();
    await page.waitForFunction(() => !!document.querySelector('[data-screen="hud"]') && !document.querySelector('[data-screen="loading"]'), null, { timeout: 120_000 });
    await page.waitForTimeout(4000);
    const overlay = page.getByTestId('debug-overlay');
    const fps = Number(await overlay.getAttribute('data-fps'));
    const draws = Number(await overlay.getAttribute('data-draw-calls'));
    console.log(`fps: ${fps}, draw calls: ${draws}`);
    expect(draws).toBeGreaterThan(0);
    expect(draws).toBeLessThan(1500);
    const min = Number(process.env.PERF_MIN_FPS ?? 0);
    expect(fps).toBeGreaterThanOrEqual(min);
  });
});
