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
 * ## Why the real manifest is not read here
 *
 * It was, and it could only ever be green on a machine that had run
 * `make assets`. `assets/dist/` is **gitignored** — it is build output, hashed
 * and rebuilt — and CI's unit job runs `make lint typecheck test` *before* the
 * job that runs `make assets`, so a clean checkout has no `manifest.json` and
 * the read threw `ENOENT`. It passed locally because this tree carries build
 * state CI does not, which is the same class of mistake as the defect this
 * module fixes: the deployed level looked right locally too.
 *
 * So the split is: **the parser is proven here, against a verbatim excerpt of
 * real pipeline output**, and **the actual Ottawa manifest is asserted in
 * `tests/e2e/level-art.spec.ts`**, which runs in the job that has just built it.
 * The fixture is not a skip and not a mock — every field below is copied
 * unaltered from a real `make assets` run, including the `scalePin` on the
 * landmark and the `atlas` back-reference on the frame data, so a change to the
 * pipeline's shape breaks the e2e assertion and a change to the parser breaks
 * this one.
 *
 * There is deliberately **no conditional skip**. A test that reports success
 * when it checked nothing is the failure mode this project keeps removing, and
 * "the file is not there" would be true on every CI run.
 */

import { describe, expect, it } from 'vitest';

import {
  SUPPORTED_MANIFEST_VERSION,
  atlasKeyOf,
  parseAssetManifest,
  preferredAssetScale,
  selectLevelAssets,
  type AssetManifest,
} from '@adapters/phaser/level-assets';

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

/**
 * A verbatim excerpt of `assets/dist/manifest.json` from a real `make assets`.
 *
 * Six entries, chosen to carry every shape the parser has to survive: an image
 * at one scale only (the landmark, `scalePin: 1` — the pin that recovered 12.85
 * MiB), a layer image, an atlas at two scales, and the `atlas-data` files whose
 * `atlas` back-reference is what pairs a sheet with its frames. Fields the
 * parser ignores (`role`, `group`, `bytes`, `decodedBytes`) are kept exactly as
 * the pipeline writes them, so this reads as the thing it stands in for rather
 * than as a minimal shape someone hand-tuned until the test passed.
 */
const PIPELINE_EXCERPT = {
  version: 2,
  files: [
    {
      path: 'atlas/ottawa@1x.16829e2f.webp',
      bytes: 5734,
      kind: 'atlas',
      role: 'sprite',
      scalePin: null,
      group: 'atlas:ottawa:0',
      scale: 1,
      decodedBytes: 178416,
      levels: ['ottawa'],
      keys: ['ottawa-particle-snow', 'ottawa-poi-marker-active', 'ottawa-poi-marker-idle'],
    },
    {
      path: 'atlas/ottawa@1x.79bdd8a5.json',
      bytes: 1659,
      kind: 'atlas-data',
      role: 'sprite',
      scalePin: null,
      group: 'atlas-data:ottawa:0',
      scale: 1,
      decodedBytes: 0,
      levels: ['ottawa'],
      keys: [],
      atlas: 'atlas/ottawa@1x.16829e2f.webp',
    },
    {
      path: 'atlas/ottawa@2x.fa99afcd.webp',
      bytes: 11450,
      kind: 'atlas',
      role: 'sprite',
      scalePin: null,
      group: 'atlas:ottawa:0',
      scale: 2,
      decodedBytes: 678960,
      levels: ['ottawa'],
      keys: ['ottawa-particle-snow', 'ottawa-poi-marker-active', 'ottawa-poi-marker-idle'],
    },
    {
      path: 'atlas/ottawa@2x.c4df6086.json',
      bytes: 1664,
      kind: 'atlas-data',
      role: 'sprite',
      scalePin: null,
      group: 'atlas-data:ottawa:0',
      scale: 2,
      decodedBytes: 0,
      levels: ['ottawa'],
      keys: [],
      atlas: 'atlas/ottawa@2x.fa99afcd.webp',
    },
    {
      path: 'img/ottawa-landmark-parliament-hill@1x.6749121e.webp',
      bytes: 34354,
      kind: 'image',
      role: 'sprite',
      scalePin: 1,
      group: 'img:ottawa-landmark-parliament-hill',
      scale: 1,
      decodedBytes: 4492800,
      levels: ['ottawa'],
      keys: ['ottawa-landmark-parliament-hill'],
    },
    {
      path: 'img/ottawa-layer-10-sky@1x.1513d0ff.webp',
      bytes: 17380,
      kind: 'image',
      role: 'layer',
      scalePin: null,
      group: 'img:ottawa-layer-10-sky',
      scale: 1,
      decodedBytes: 5011200,
      levels: ['ottawa'],
      keys: ['ottawa-layer-10-sky'],
    },
  ],
};

describe('against real pipeline output', () => {
  const real = parseAssetManifest(PIPELINE_EXCERPT);

  it('reads what make assets writes, extra fields and all', () => {
    expect(real.ok, real.ok ? '' : real.error.message).toBe(true);
    if (!real.ok) return;
    expect(real.value.files).toHaveLength(PIPELINE_EXCERPT.files.length);
  });

  it.each([1, 2])('resolves every key the excerpt provides, at scale %i', (scale) => {
    if (!real.ok) return;
    const requests = selectLevelAssets(real.value, 'ottawa', { scale, baseUrl: BASE });
    expect(requests.map((request) => request.key).sort()).toEqual([
      'ottawa',
      'ottawa-landmark-parliament-hill',
      'ottawa-layer-10-sky',
    ]);
  });

  it('honours the landmark pin at 2x rather than dropping the key', () => {
    if (!real.ok) return;
    const requests = selectLevelAssets(real.value, 'ottawa', { scale: 2, baseUrl: BASE });
    const landmark = requests.find(
      (request) => request.key === 'ottawa-landmark-parliament-hill',
    );
    /* `scalePin: 1` means there is no 2x file. Dropping the key would draw
       nothing where Parliament Hill is, silently — the failure this whole
       module exists to stop, one asset at a time. */
    expect(landmark).toEqual({
      kind: 'image',
      key: 'ottawa-landmark-parliament-hill',
      url: `${BASE}img/ottawa-landmark-parliament-hill@1x.6749121e.webp`,
    });
  });

  it('takes the 2x atlas on a dense display and the 1x on a plain one', () => {
    if (!real.ok) return;
    const at = (scale: number): string | undefined => {
      const request = selectLevelAssets(real.value, 'ottawa', { scale, baseUrl: BASE }).find(
        (candidate) => candidate.key === 'ottawa',
      );
      return request?.kind === 'atlas' ? request.textureUrl : undefined;
    };
    expect(at(2)).toBe(`${BASE}atlas/ottawa@2x.fa99afcd.webp`);
    expect(at(1)).toBe(`${BASE}atlas/ottawa@1x.16829e2f.webp`);
  });
});
