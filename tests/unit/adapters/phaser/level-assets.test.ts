/**
 * What a level loads, and why every branch here matters.
 *
 * The rules in `level-assets.ts` exist because the deployed Ottawa level drew no
 * art at all — nothing queued a texture, every parallax band took the
 * placeholder, and the scene reported itself ready. Each case below is a way for
 * that to happen again more quietly: one key resolving to nothing, an atlas
 * loaded without its frame data, a manifest version nobody reads. The failure
 * mode is always the same and always silent, so the tests are about *refusing*
 * rather than about producing.
 *
 * The real `assets/dist/manifest.json` is read at the bottom, because a
 * hand-written fixture proves the parser and not the pipeline, and it was the
 * gap between the two that shipped.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  SUPPORTED_MANIFEST_VERSION,
  atlasKeyOf,
  parseAssetManifest,
  preferredAssetScale,
  selectLevelAssets,
  type AssetManifest,
} from '@adapters/phaser/level-assets';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

const manifest = (files: unknown[]): unknown => ({
  version: SUPPORTED_MANIFEST_VERSION,
  files,
});

const parsed = (files: unknown[]): AssetManifest => {
  const result = parseAssetManifest(manifest(files));
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
};

const BASE = '/OhCanada/';

describe('parseAssetManifest', () => {
  it('reads the pipeline manifest', () => {
    const result = parseAssetManifest(
      manifest([
        { path: 'img/a@1x.hash.webp', kind: 'image', scale: 1, keys: ['a'], levels: ['ottawa'] },
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.files).toHaveLength(1);
    expect(result.value.files[0]?.keys).toEqual(['a']);
  });

  it('refuses a version it does not read, rather than loading nothing quietly', () => {
    const result = parseAssetManifest({ version: 99, files: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('unsupported');
    expect(result.error.code).toBe('assets.manifest.version');
  });

  it.each([
    ['not an object', 'nope', 'assets.manifest.notAnObject'],
    ['no version', { files: [] }, 'assets.manifest.noVersion'],
    ['no files', { version: SUPPORTED_MANIFEST_VERSION }, 'assets.manifest.noFiles'],
  ])('refuses a manifest with %s', (_what, source, code) => {
    const result = parseAssetManifest(source);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(code);
  });

  it('drops an entry it cannot read instead of inventing a path', () => {
    const result = parseAssetManifest(manifest([{ kind: 'image' }, 42, null]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.files).toEqual([]);
  });
});

describe('preferredAssetScale', () => {
  it('asks for 2x on a dense display and 1x otherwise', () => {
    expect(preferredAssetScale(3)).toBe(2);
    expect(preferredAssetScale(2)).toBe(2);
    expect(preferredAssetScale(1.5)).toBe(2);
    expect(preferredAssetScale(1)).toBe(1);
    expect(preferredAssetScale(Number.NaN)).toBe(1);
  });
});

describe('atlasKeyOf', () => {
  it('strips the scale and the content hash, so a rebuild does not rename a texture', () => {
    expect(atlasKeyOf('atlas/ottawa@2x.fa99afcd.webp')).toBe('ottawa');
    expect(atlasKeyOf('atlas/shared@1x.fb11801a.webp')).toBe('shared');
    expect(atlasKeyOf('')).toBeNull();
  });
});

describe('selectLevelAssets', () => {
  const files = [
    { path: 'img/sky@1x.a.webp', kind: 'image', scale: 1, keys: ['sky'], levels: ['ottawa'] },
    { path: 'img/sky@2x.b.webp', kind: 'image', scale: 2, keys: ['sky'], levels: ['ottawa'] },
    /* Pinned to 1x, like the Parliament Hill landmark that recovered 12.85 MiB. */
    { path: 'img/hill@1x.c.webp', kind: 'image', scale: 1, keys: ['hill'], levels: ['ottawa'] },
    { path: 'img/other@1x.d.webp', kind: 'image', scale: 1, keys: ['other'], levels: ['quebec'] },
    { path: 'atlas/ottawa@1x.e.webp', kind: 'atlas', scale: 1, keys: ['snow'], levels: ['ottawa'] },
    {
      path: 'atlas/ottawa@1x.f.json',
      kind: 'atlas-data',
      scale: 1,
      keys: [],
      levels: ['ottawa'],
      atlas: 'atlas/ottawa@1x.e.webp',
    },
  ];

  it('loads only what this level names', () => {
    const requests = selectLevelAssets(parsed(files), 'ottawa', { scale: 1, baseUrl: BASE });
    expect(requests.map((request) => request.key).sort()).toEqual(['hill', 'ottawa', 'sky']);
  });

  it('resolves scale per key, so a pinned asset is honoured and no key is dropped', () => {
    const at2x = selectLevelAssets(parsed(files), 'ottawa', { scale: 2, baseUrl: BASE });
    const urls = new Map(
      at2x.map((request) => [
        request.key,
        request.kind === 'image' ? request.url : request.textureUrl,
      ]),
    );

    expect(urls.get('sky'), 'a 2x device took the 1x sky').toBe(`${BASE}img/sky@2x.b.webp`);
    /* The pin is the pipeline's decision and this honours it rather than knowing
       about it — and, crucially, does not drop the key for want of a 2x file. */
    expect(urls.get('hill')).toBe(`${BASE}img/hill@1x.c.webp`);
  });

  it('loads a 2x-only key on a 1x device rather than loading nothing', () => {
    const only2x = [
      { path: 'img/late@2x.g.webp', kind: 'image', scale: 2, keys: ['late'], levels: ['ottawa'] },
    ];
    const requests = selectLevelAssets(parsed(only2x), 'ottawa', { scale: 1, baseUrl: BASE });
    /* Too many texels beats a coloured band: the band is the defect this module
       exists to stop, and it is silent. */
    expect(requests).toEqual([{ kind: 'image', key: 'late', url: `${BASE}img/late@2x.g.webp` }]);
  });

  it('pairs an atlas with its frame data', () => {
    const requests = selectLevelAssets(parsed(files), 'ottawa', { scale: 1, baseUrl: BASE });
    expect(requests.find((request) => request.key === 'ottawa')).toEqual({
      kind: 'atlas',
      key: 'ottawa',
      textureUrl: `${BASE}atlas/ottawa@1x.e.webp`,
      dataUrl: `${BASE}atlas/ottawa@1x.f.json`,
    });
  });

  it('refuses an atlas with no frame data, which would load and index into nothing', () => {
    const orphan = files.filter((file) => file.kind !== 'atlas-data');
    const requests = selectLevelAssets(parsed(orphan), 'ottawa', { scale: 1, baseUrl: BASE });
    expect(requests.some((request) => request.kind === 'atlas')).toBe(false);
  });

  it('prefixes every URL with the deploy base path (ADR-0006)', () => {
    const requests = selectLevelAssets(parsed(files), 'ottawa', { scale: 1, baseUrl: BASE });
    for (const request of requests) {
      const url = request.kind === 'image' ? request.url : request.textureUrl;
      expect(url.startsWith(BASE)).toBe(true);
    }
  });
});

describe('against the manifest the pipeline actually built', () => {
  /*
   * The gap this closes is not in the parser, it is between the parser and the
   * pipeline: `make assets` built six layer images with exactly the keys
   * `content/levels/ottawa.json` names, the texture gate weighed them, and the
   * game requested none of them. A fixture cannot see that.
   */
  const real = parseAssetManifest(
    JSON.parse(readFileSync(`${REPO_ROOT}assets/dist/manifest.json`, 'utf8')),
  );
  const level = JSON.parse(
    readFileSync(`${REPO_ROOT}content/levels/ottawa.json`, 'utf8'),
  ) as { readonly layers: readonly { readonly key: string }[] };

  it('reads it', () => {
    expect(real.ok, real.ok ? '' : real.error.message).toBe(true);
  });

  it.each([1, 2])('resolves every layer key the level names, at scale %i', (scale) => {
    if (!real.ok) return;
    const requests = selectLevelAssets(real.value, 'ottawa', { scale, baseUrl: BASE });
    const keys = new Set(requests.map((request) => request.key));
    const missing = level.layers.map((layer) => layer.key).filter((key) => !keys.has(key));

    expect(
      missing,
      'a layer the level draws resolves to no load request, so it will silently draw a ' +
        'flat theme-coloured band — which is exactly what the deployed build did for all six.',
    ).toEqual([]);
  });
});
