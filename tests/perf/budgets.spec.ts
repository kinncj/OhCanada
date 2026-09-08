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
    const shared = files.filter((f) => f.startsWith(assetsDir) && /\.(js|css)$/.test(f));
    const sky = files.filter((f) => /\/sky\//.test(f));
    const initial = sum([...shared, ...sky, join(dist, 'index.html')]);

    // The hub streams only what it references: the app shell, transcoders, audio, characters, terrain
    // textures and the models its POIs and vegetation actually use — not every district's hero assets.
    const manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8')) as {
      models: Record<string, { path: string }>;
      textures: Record<string, { diff: string; nor?: string; arm?: string }>;
      characters: Record<string, { path: string; skin: Record<string, string> }>;
    };
    const hub = JSON.parse(readFileSync(join(root, 'content', 'districts', 'hub.json'), 'utf8')) as {
      pois: { landmark?: string }[];
      scene: { vegetation: { kinds: string[] } };
    };
    const KIND_MODELS: Record<string, string[]> = {
      pine: ['tree-pine', 'sapling-pine'], spruce: ['tree-fir', 'sapling-fir'],
      maple: ['tree-broadleaf-1', 'tree-broadleaf-2'], birch: ['tree-broadleaf-2', 'tree-broadleaf-1'],
      shrub: ['fern', 'grass-clump'], rock: ['rock-boulder', 'rock-2', 'rock-3'],
      iceberg: ['rock-coast', 'rock-boulder'], 'tundra-grass': ['grass-clump', 'fern'], wheat: ['grass-clump'],
    };
    const hubKeys = new Set<string>();
    for (const p of hub.pois) if (p.landmark) hubKeys.add(p.landmark);
    for (const k of hub.scene.vegetation.kinds) for (const m of KIND_MODELS[k] ?? []) hubKeys.add(m);
    const rel = (p: string) => join(dist, p);
    const hubModels = [...hubKeys].map((k) => manifest.models[k]?.path).filter((p): p is string => !!p).map(rel).filter((f) => files.includes(f));
    const charFiles = Object.values(manifest.characters).flatMap((c) => [c.path, ...Object.values(c.skin)]).map(rel).filter((f) => files.includes(f));
    const textureFiles = Object.values(manifest.textures).flatMap((t) => [t.diff, t.nor, t.arm].filter((x): x is string => !!x)).map(rel).filter((f) => files.includes(f));
    const support = files.filter((f) => /\/(basis|draco|audio)\//.test(f));
    const hubTotal = initial + sum([...hubModels, ...charFiles, ...textureFiles, ...support, join(dist, 'manifest.json')]);
    console.log(`initial payload: ${(initial / 1048576).toFixed(2)} MB (budget ${(config.budgets.initialPayloadBytes / 1048576).toFixed(0)} MB); hub scene: ${(hubTotal / 1048576).toFixed(2)} MB (budget ${(config.budgets.hubSceneBytes / 1048576).toFixed(0)} MB)`);
    expect(initial).toBeLessThanOrEqual(config.budgets.initialPayloadBytes);
    expect(hubTotal).toBeLessThanOrEqual(config.budgets.hubSceneBytes);

    const gz = [...new Set(shared)].reduce((n, f) => n + gzipSync(readFileSync(f)).length, 0) + sum(sky);
    console.log(`initial transfer (gzip): ${(gz / 1048576).toFixed(2)} MB`);
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
    await page.getByTestId('menu-new').waitFor({ timeout: 400_000 });
    const tti = Date.now() - start;
    console.log(`TTI (menu interactive, headless swiftshader): ${tti} ms`);
    // SwiftShader compiles shaders on the CPU; the real budget is enforced on the reference GPU configs (docs/runbook.md).
    if (process.env.PERF_STRICT) expect(tti).toBeLessThanOrEqual(config.budgets.timeToInteractiveMs);
    await page.getByTestId('menu-new').click();
    await page.getByTestId('creator-confirm').click();
    await page.waitForFunction(() => !!document.querySelector('[data-screen="hud"]') && !document.querySelector('[data-screen="loading"]'), null, { timeout: 400_000 });
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
