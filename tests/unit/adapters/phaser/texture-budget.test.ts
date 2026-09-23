/**
 * TN-LEVEL-02's texture refusal, weighed from the manifest (ADR-0020 §4).
 *
 * The refusal used to sum `assets[].decodedBytes` out of the level document,
 * every shipped level declares `"assets": []`, and so it summed zero and could
 * not fire — while looking exactly like a check that passes. ADR-0020's
 * obligation asks for the refusal to be computed from the manifest entries for
 * what the level loads, and for **a test that shows it firing**. That is the
 * first `describe` below, and it runs over every level actually authored, each
 * with its `assets[]` exactly as shipped.
 *
 * The fixture manifests are shaped like `make assets` output (see the verbatim
 * excerpt in `level-assets.test.ts`) and not read from `assets/dist`, which is
 * build output and absent on a clean checkout. The real manifest is weighed on
 * the running page by `tests/e2e/level-landmarks.spec.ts`.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  SUPPORTED_MANIFEST_VERSION,
  parseAssetManifest,
  selectLevelAssets,
  type AssetManifest,
} from '@adapters/phaser/level-assets';
import { parseLevelDocument, type SceneLevel } from '@adapters/phaser/level-document';
import { decodedBytesOf, refuseOverManifestBudget } from '@adapters/phaser/texture-budget';

import gameConfigJson from '@content/game.config.json';

const MODES: readonly string[] = (
  gameConfigJson as { locomotionModes: readonly string[] }
).locomotionModes;

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const LEVELS_DIR = `${REPO_ROOT}content/levels`;
const levelFiles = readdirSync(LEVELS_DIR)
  .filter((name) => name.endsWith('.json'))
  .sort();

const BASE = '/OhCanada/';

const levelFrom = (file: string): SceneLevel => {
  const parsed = parseLevelDocument(
    JSON.parse(readFileSync(`${LEVELS_DIR}/${file}`, 'utf8')) as unknown,
    MODES,
  );
  if (!parsed.ok) throw new Error(`${file}: ${parsed.error.message}`);
  return parsed.value;
};

const manifestOf = (files: readonly unknown[]): AssetManifest => {
  const result = parseAssetManifest({ version: SUPPORTED_MANIFEST_VERSION, files });
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
};

/** A level's art as the pipeline writes it: an atlas at two scales, a pinned image, a layer. */
const pipelineFiles = (level: string, skyBytes: number): readonly unknown[] => [
  {
    path: `atlas/${level}@1x.16829e2f.webp`,
    kind: 'atlas',
    group: `atlas:${level}:0`,
    scale: 1,
    decodedBytes: 178_416,
    levels: [level],
    keys: [`${level}-poi-marker-idle`],
  },
  {
    path: `atlas/${level}@1x.79bdd8a5.json`,
    kind: 'atlas-data',
    group: `atlas-data:${level}:0`,
    scale: 1,
    decodedBytes: 0,
    levels: [level],
    keys: [],
    atlas: `atlas/${level}@1x.16829e2f.webp`,
  },
  {
    path: `atlas/${level}@2x.fa99afcd.webp`,
    kind: 'atlas',
    group: `atlas:${level}:0`,
    scale: 2,
    decodedBytes: 678_960,
    levels: [level],
    keys: [`${level}-poi-marker-idle`],
  },
  {
    path: `atlas/${level}@2x.c4df6086.json`,
    kind: 'atlas-data',
    group: `atlas-data:${level}:0`,
    scale: 2,
    decodedBytes: 0,
    levels: [level],
    keys: [],
    atlas: `atlas/${level}@2x.fa99afcd.webp`,
  },
  {
    path: `img/${level}-landmark@1x.6749121e.webp`,
    kind: 'image',
    group: `img:${level}-landmark`,
    scale: 1,
    decodedBytes: 4_492_800,
    levels: [level],
    keys: [`${level}-landmark`],
  },
  {
    path: `img/${level}-layer-10-sky@1x.1513d0ff.webp`,
    kind: 'image',
    group: `img:${level}-layer-10-sky`,
    scale: 1,
    decodedBytes: skyBytes,
    levels: [level],
    keys: [`${level}-layer-10-sky`],
  },
];

/** What the 2x device holds besides the sky: the 2x atlas and the 1x-pinned landmark. */
const BESIDES_SKY_AT_2X = 678_960 + 4_492_800;

describe('the refusal fires on the manifest, whatever assets[] says', () => {
  it.each(levelFiles)('%s is refused when its manifest weighs one byte over its budget', (file) => {
    const level = levelFrom(file);
    /* The precondition that made the old refusal dead: the document itself
       names no weighed asset, so a sum over it is zero. */
    expect(level.assets.reduce((total, asset) => total + asset.decodedBytes, 0)).toBe(0);

    const sky = level.textureBudgetBytes - BESIDES_SKY_AT_2X + 1;
    const manifest = manifestOf(pipelineFiles(level.id, sky));
    const requests = selectLevelAssets(manifest, level.id, { scale: 2, baseUrl: BASE });

    const refusal = refuseOverManifestBudget(level, manifest, requests);

    expect(refusal).not.toBeNull();
    expect(refusal?.ok).toBe(false);
    if (refusal === null || refusal.ok) return;
    expect(refusal.error.code).toBe('content.level.textureBudget');
    expect(refusal.error.details).toEqual({
      level: level.id,
      declared: level.textureBudgetBytes,
      manifest: level.textureBudgetBytes + 1,
    });
  });

  it.each(levelFiles)('%s opens when its manifest weighs exactly its budget', (file) => {
    const level = levelFrom(file);
    const sky = level.textureBudgetBytes - BESIDES_SKY_AT_2X;
    const manifest = manifestOf(pipelineFiles(level.id, sky));
    const requests = selectLevelAssets(manifest, level.id, { scale: 2, baseUrl: BASE });

    expect(refuseOverManifestBudget(level, manifest, requests)).toBeNull();
  });
});

describe('decodedBytesOf', () => {
  const manifest = manifestOf(pipelineFiles('ottawa', 5_011_200));

  it.each([
    /* 1x: the 1x atlas sheet, the landmark, the sky. */
    [1, 178_416 + 4_492_800 + 5_011_200],
    /* 2x: the 2x sheet instead, and the 1x-pinned landmark and sky, because
       that is what a 2x device actually holds. */
    [2, 678_960 + 4_492_800 + 5_011_200],
  ])('weighs what a %ix device will decode, and never the other scale', (scale, expected) => {
    const requests = selectLevelAssets(manifest, 'ottawa', { scale, baseUrl: BASE });
    expect(decodedBytesOf(manifest, requests)).toEqual({ ok: true, value: expected });
  });

  it('charges nothing for an atlas frame-data file, which is JSON and not a texture', () => {
    const requests = selectLevelAssets(manifest, 'ottawa', { scale: 1, baseUrl: BASE }).filter(
      (request) => request.kind === 'atlas',
    );
    expect(decodedBytesOf(manifest, requests)).toEqual({ ok: true, value: 178_416 });
  });

  it('weighs nothing when nothing will be fetched', () => {
    expect(decodedBytesOf(manifest, [])).toEqual({ ok: true, value: 0 });
  });

  it('refuses rather than counts zero for a texture whose weight the manifest omits', () => {
    const unweighed = manifestOf(
      pipelineFiles('ottawa', 5_011_200).map((file) => {
        const entry = file as Record<string, unknown>;
        if (entry['kind'] !== 'image') return entry;
        const { decodedBytes: _omitted, ...rest } = entry;
        return rest;
      }),
    );
    const requests = selectLevelAssets(unweighed, 'ottawa', { scale: 1, baseUrl: BASE });
    const weight = decodedBytesOf(unweighed, requests);
    expect(weight.ok).toBe(false);
    if (weight.ok) return;
    expect(weight.error.code).toBe('assets.manifest.unweighed');
  });

  it('refuses a request the manifest does not list, rather than weighing it as nothing', () => {
    const weight = decodedBytesOf(manifest, [
      { kind: 'image', key: 'stray', url: `${BASE}img/stray@1x.00000000.webp` },
    ]);
    expect(weight.ok).toBe(false);
    if (weight.ok) return;
    expect(weight.error.code).toBe('assets.manifest.unweighed');
  });

  it('refuses the level when the manifest cannot weigh what it would load', () => {
    const level = levelFrom('ottawa.json');
    const refusal = refuseOverManifestBudget(level, manifest, [
      { kind: 'image', key: 'stray', url: `${BASE}img/stray@1x.00000000.webp` },
    ]);
    expect(refusal?.ok).toBe(false);
  });
});
