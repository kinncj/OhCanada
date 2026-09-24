/**
 * The service worker's two budgets: the gate is itself checked (ADR-0075).
 *
 * Until ADR-0075 deploy-check added the precache and every level's art together
 * and held the sum to `budgets.initialPayloadBytes`. That number had two owners
 * and so none. The split gives each download its own key; this test proves each
 * clause fires on its own key, the retired sum stays retired, and the build
 * still calls the gate.
 *
 * Every case drives `checkWorkerBudgets`, the function deploy-check calls, over
 * real files of exact sizes written into a scratch dist/ - as
 * `level-payload-gate.test.ts` does - because the gate sizes files from disk and
 * a test that handed it numbers would prove nothing about that.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { checkWorkerBudgets } from '../../../scripts/lib/worker-budget.mjs';

const DEPLOY_CHECK = fileURLToPath(new URL('../../../scripts/deploy-check.mjs', import.meta.url));
const WORK = mkdtempSync(join(tmpdir(), 'worker-budget-'));

/** Small budgets keep the scratch trees small; the arithmetic does not care. */
const INITIAL = 40_000;
const BACKGROUND = 30_000;
const BUDGETS = { initialPayloadBytes: INITIAL, backgroundCacheBytes: BACKGROUND } as const;

const RETIRED_MESSAGE = 'Make the art smaller, or stop caching every level in the background';
const NO_KEY = 'content/game.config.json has no positive numeric "budgets.backgroundCacheBytes"';

afterAll(() => {
  rmSync(WORK, { recursive: true, force: true });
});

let counter = 0;

/** A fresh dist/ holding each path at exactly the given byte count. */
function dist(files: Readonly<Record<string, number>>): string {
  counter += 1;
  const dir = join(WORK, `dist-${counter}`);
  for (const [path, bytes] of Object.entries(files)) {
    const file = join(dir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.alloc(bytes, 0x61));
  }
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('the background clause, budgets.backgroundCacheBytes', () => {
  it('passes art that is exactly the budget', () => {
    const distDir = dist({ 'index.html': 1_000, 'levels/a/sky.webp': 20_000, 'levels/b/sky.webp': 10_000 });
    const result = checkWorkerBudgets({
      distDir,
      precacheUrls: ['index.html'],
      levelArt: { 'levels/a/sky.webp': ['a'], 'levels/b/sky.webp': ['b'] },
      budgets: BUDGETS,
    });
    expect(result.artBytes).toBe(BACKGROUND);
    expect(result.precacheBytes).toBe(1_000);
    expect(result.failures).toEqual([]);
  });

  it('fails art one byte over, naming backgroundCacheBytes and not initialPayloadBytes', () => {
    const distDir = dist({ 'index.html': 1_000, 'levels/a/sky.webp': 20_001, 'levels/b/sky.webp': 10_000 });
    const result = checkWorkerBudgets({
      distDir,
      precacheUrls: ['index.html'],
      levelArt: { 'levels/a/sky.webp': ['a'], 'levels/b/sky.webp': ['b'] },
      budgets: BUDGETS,
    });
    expect(result.artBytes).toBe(BACKGROUND + 1);
    expect(result.failures).toHaveLength(1);
    const [message] = result.failures;
    expect(message).toContain('budgets.backgroundCacheBytes');
    expect(message).not.toContain('initialPayloadBytes');
    expect(message).toContain("dist/sw.js caches every level's art in the background, 2 file(s) over 2 level(s)");
    expect(message).toContain(`(${BACKGROUND} B)`);
    expect(message).toContain('change the budget in an ADR (ADR-0075)');
  });

  it('names the three heaviest levels by their own art, and the shared files total', () => {
    const distDir = dist({
      'levels/a/x.webp': 9_000,
      'levels/b/x.webp': 7_000,
      'levels/c/x.webp': 5_000,
      'levels/d/x.webp': 3_000,
      'levels/shared/atlas.webp': 6_500,
    });
    const result = checkWorkerBudgets({
      distDir,
      precacheUrls: [],
      levelArt: {
        'levels/a/x.webp': ['a'],
        'levels/b/x.webp': ['b'],
        'levels/c/x.webp': ['c'],
        'levels/d/x.webp': ['d'],
        'levels/shared/atlas.webp': ['a', 'b', 'c', 'd'],
      },
      budgets: BUDGETS,
    });
    expect(result.failures).toHaveLength(1);
    const [message] = result.failures;
    expect(message).toContain('a 9.0 kB, b 7.0 kB, c 5.0 kB');
    expect(message).not.toMatch(/\bd 3\.0 kB/);
    expect(message).toContain('1 file(s) shared by more than one level come to 6.5 kB');
  });
});

describe('the precache clause, budgets.initialPayloadBytes', () => {
  it('fails a precache one byte over, with small art, naming initialPayloadBytes and not backgroundCacheBytes', () => {
    const distDir = dist({ 'index.html': 1_000, 'assets/app.js': INITIAL - 999, 'levels/a/sky.webp': 100 });
    const result = checkWorkerBudgets({
      distDir,
      precacheUrls: ['index.html', 'assets/app.js'],
      levelArt: { 'levels/a/sky.webp': ['a'] },
      budgets: BUDGETS,
    });
    expect(result.precacheBytes).toBe(INITIAL + 1);
    expect(result.failures).toHaveLength(1);
    const [message] = result.failures;
    expect(message).toContain('budgets.initialPayloadBytes');
    expect(message).not.toContain('backgroundCacheBytes');
    expect(message).toContain('dist/sw.js precaches');
  });
});

describe('the retired rule stays retired', () => {
  it('passes a precache and art each under their own key but together over initialPayloadBytes', () => {
    const distDir = dist({ 'assets/app.js': INITIAL - 1, 'levels/a/sky.webp': BACKGROUND - 1 });
    const result = checkWorkerBudgets({
      distDir,
      precacheUrls: ['assets/app.js'],
      levelArt: { 'levels/a/sky.webp': ['a'] },
      budgets: BUDGETS,
    });
    expect(result.precacheBytes + result.artBytes).toBeGreaterThan(INITIAL);
    expect(result.failures).toEqual([]);
  });
});

describe('each file once', () => {
  it('counts a shared file named by two levels once, where counting it twice would breach', () => {
    const distDir = dist({ 'levels/shared/atlas.webp': 20_000, 'levels/a/sky.webp': 5_000 });
    const result = checkWorkerBudgets({
      distDir,
      precacheUrls: [],
      levelArt: { 'levels/shared/atlas.webp': ['a', 'b'], 'levels/a/sky.webp': ['a'] },
      budgets: BUDGETS,
    });
    // Counted per level: 20,000 x 2 + 5,000 = 45,000 > 30,000.
    expect(result.artBytes).toBe(25_000);
    expect(result.failures).toEqual([]);
  });

  it('counts a precache URL listed twice once', () => {
    const distDir = dist({ 'assets/app.js': 30_000 });
    const result = checkWorkerBudgets({
      distDir,
      precacheUrls: ['assets/app.js', 'assets/app.js'],
      levelArt: {},
      budgets: BUDGETS,
    });
    expect(result.precacheBytes).toBe(30_000);
    expect(result.failures).toEqual([]);
  });
});

describe('the sizes on disk are what count', () => {
  it('is not satisfied by a manifest or sw.js that claims smaller sizes', () => {
    const distDir = dist({
      'index.html': 1_000,
      'levels/a/sky.webp': BACKGROUND + 1,
      'assets/app.js': INITIAL + 1,
    });
    // Both claim one byte per file. The gate must read neither.
    writeFileSync(
      join(distDir, 'manifest.json'),
      JSON.stringify({ files: [{ path: 'levels/a/sky.webp', bytes: 1, levels: ['a'] }] }),
    );
    writeFileSync(
      join(distDir, 'sw.js'),
      `self.__precache = ${JSON.stringify([{ url: 'assets/app.js', revision: null, size: 1 }])};`,
    );
    const result = checkWorkerBudgets({
      distDir,
      precacheUrls: ['assets/app.js'],
      levelArt: { 'levels/a/sky.webp': ['a'] },
      budgets: BUDGETS,
    });
    expect(result.artBytes).toBe(BACKGROUND + 1);
    expect(result.precacheBytes).toBe(INITIAL + 1);
    expect(result.failures).toHaveLength(2);
    expect(result.failures.some((m) => m.includes('budgets.backgroundCacheBytes'))).toBe(true);
    expect(result.failures.some((m) => m.includes('budgets.initialPayloadBytes'))).toBe(true);
  });
});

describe('a missing or invalid budgets.backgroundCacheBytes fails, and does not skip', () => {
  const cases: readonly (readonly [string, Record<string, unknown>])[] = [
    ['absent', { initialPayloadBytes: INITIAL }],
    ['0', { initialPayloadBytes: INITIAL, backgroundCacheBytes: 0 }],
    ['"5242880"', { initialPayloadBytes: INITIAL, backgroundCacheBytes: '5242880' }],
    ['non-integer', { initialPayloadBytes: INITIAL, backgroundCacheBytes: 30_000.5 }],
    ['negative', { initialPayloadBytes: INITIAL, backgroundCacheBytes: -1 }],
  ];
  for (const [label, budgets] of cases) {
    it(`fails with the key ${label}, even with tiny art`, () => {
      const distDir = dist({ 'levels/a/sky.webp': 10 });
      const result = checkWorkerBudgets({
        distDir,
        precacheUrls: [],
        levelArt: { 'levels/a/sky.webp': ['a'] },
        budgets,
      });
      expect(result.failures).toEqual([
        `${NO_KEY}; the background level cache cannot be checked.`,
      ]);
    });
  }
});

describe('wiring: the build calls this gate', () => {
  const source = readFileSync(DEPLOY_CHECK, 'utf8');

  it('deploy-check imports checkWorkerBudgets from ./lib/worker-budget.mjs and calls it', () => {
    expect(source).toMatch(
      /import\s*\{[^}]*\bcheckWorkerBudgets\b[^}]*\}\s*from\s*'\.\/lib\/worker-budget\.mjs'/,
    );
    expect(source).toMatch(/\bcheckWorkerBudgets\s*\(\s*\{/);
  });

  it('deploy-check no longer contains the retired combined message', () => {
    expect(source).not.toContain(RETIRED_MESSAGE);
  });
});
