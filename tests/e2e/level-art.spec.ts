import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

/*
  Imported, not restated: the same selection the game runs at boot. This suite is
  where the *real* `assets/dist/manifest.json` may be read at all — `assets/dist`
  is gitignored build output, and CI's unit job runs before `make assets`, so a
  unit test that opened this file could only ever be green on a machine that had
  already built. `make assets build test-e2e` is one command in one job, so by
  the time this runs the manifest is the one the browser two lines below fetches.
*/
import { parseAssetManifest, selectLevelAssets } from '@adapters/phaser/level-assets';

/**
 * **The assertion that was missing.**
 *
 * The Ottawa level was deployed and every gate was green: forty e2e tests, five
 * perf tests, a hundred and twenty-three a11y tests, the texture-memory gate,
 * the payload gate. And the live page drew **no art whatsoever** — zero image
 * requests in the network log, every parallax band a flat theme-coloured
 * placeholder, `data-tn-level="ready"`, `[data-testid="playable"]` present, no
 * console error.
 *
 * Nothing was broken in a way anything could see. `level-scene.ts` draws a
 * coloured band when `textures.exists(key)` is false, which is correct while art
 * is in flight, and no test asked the one question that separates the two cases:
 * **did a layer draw from a texture, or from a band?** Every test asked whether
 * the scene reached `ready`, and it did.
 *
 * So this file asks it three ways, each of which would have failed on the
 * deployed build:
 *
 *  1. **The network.** A level with art fetches images. Zero image requests is
 *     the raw symptom and the one that is impossible to argue with.
 *  2. **The manifest.** Every texture key `content/levels/ottawa.json` names is
 *     one `assets/dist/manifest.json` provides — read from disk, both sides, so
 *     a rename on either side fails here rather than becoming a coloured band.
 *  3. **The selection.** `selectLevelAssets` — the real function, against the
 *     real manifest — resolves every layer key at both scales. This is the half
 *     that used to live in the unit suite and could not: it needs build output.
 *  4. **The scene's own count.** `data-layers-textured` equals `data-layers`.
 *     This is the durable one: it is a fact the game publishes about itself, so
 *     it keeps working when the assets change, and it distinguishes "drew its
 *     art" from "drew a band" without anybody counting requests.
 *
 * The third is deliberately not phrased as "> 0". A level that drew five of six
 * layers from textures and one from a band would pass that, and one silently
 * missing layer is exactly how this failure would come back at a smaller scale.
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const LEVEL_ID = 'ottawa';

interface LevelFile {
  readonly layers: readonly { readonly key: string }[];
  readonly pois: readonly { readonly artKey?: string }[];
}

interface Manifest {
  readonly files: readonly {
    readonly keys?: readonly string[];
    readonly levels?: readonly string[];
  }[];
}

const level = JSON.parse(
  readFileSync(`${REPO_ROOT}content/levels/${LEVEL_ID}.json`, 'utf8'),
) as LevelFile;

const manifestSource: unknown = JSON.parse(
  readFileSync(`${REPO_ROOT}assets/dist/manifest.json`, 'utf8'),
);
const manifest = manifestSource as Manifest;

test.describe('the level draws its art', () => {
  test('the manifest provides every texture key the level names', () => {
    const provided = new Set(
      manifest.files
        .filter((file) => file.levels?.includes(LEVEL_ID) === true)
        .flatMap((file) => file.keys ?? []),
    );
    const wanted = [
      ...level.layers.map((layer) => layer.key),
      ...level.pois.map((poi) => poi.artKey).filter((key): key is string => key !== undefined),
    ];

    expect(wanted.length, 'the level names no art, so this assertion checks nothing').toBeGreaterThan(
      0,
    );
    expect(
      wanted.filter((key) => !provided.has(key)),
      'the level names a texture key the asset pipeline does not build. It will not 404 — ' +
        'nothing will request it — it will silently draw a placeholder band.',
    ).toEqual([]);
  });

  /* Playwright's `test` has no `.each`; both scales in one body, and the scale
     that failed is named in the message. */
  test('resolves every layer key at both scales, through the real selector', () => {
    const parsed = parseAssetManifest(manifestSource);
    expect(parsed.ok, parsed.ok ? '' : parsed.error.message).toBe(true);
    if (!parsed.ok) return;

    for (const scale of [1, 2]) {
      const keys = new Set(
        selectLevelAssets(parsed.value, LEVEL_ID, { scale, baseUrl: '/' }).map(
          (request) => request.key,
        ),
      );
      expect(
        level.layers.map((layer) => layer.key).filter((key) => !keys.has(key)),
        `at scale ${String(scale)}, a layer the level draws resolves to no load request, so ` +
          'it will silently draw a flat theme-coloured band. At scale 2 this is also the ' +
          'pinned-asset case: a key with no 2x file must fall back to its 1x, not disappear.',
      ).toEqual([]);
    }
  });

  test('fetches its images, which the deployed build did not do at all', async ({ page }) => {
    const images: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (/\.(webp|png|avif)(\?|$)/u.test(url)) images.push(url);
    });

    await page.goto(`./?level=${LEVEL_ID}`);
    await page.waitForSelector('[data-testid="playable"]');

    expect(
      images.length,
      'the page requested no image at all, so every layer is drawing a coloured band. ' +
        'This is the exact symptom of the deployed build: the assets are on the server ' +
        'and nothing asks for them.',
    ).toBeGreaterThan(0);
  });

  test('draws every authored layer from a texture, not from a placeholder band', async ({
    page,
  }) => {
    await page.goto(`./?e2e=1&level=${LEVEL_ID}`);
    await page.waitForSelector('[data-testid="playable"]');

    const probe = page.locator('[data-testid="scene-state"]');
    await expect(probe).toHaveAttribute('data-level', LEVEL_ID);

    const total = Number(await probe.getAttribute('data-layers'));
    const textured = Number(await probe.getAttribute('data-layers-textured'));

    expect(total, 'the level authored no layers, so this assertion checks nothing').toBe(
      level.layers.length,
    );
    expect(
      textured,
      `${String(total - textured)} of ${String(total)} parallax layers fell back to a flat ` +
        'theme-coloured band. That fallback is correct while the art is in flight and ' +
        'indistinguishable from success at the level of "the scene reached ready" — which is ' +
        'how a level with no art in it shipped, passed every gate, and was found by loading ' +
        'the live site.',
    ).toBe(total);
  });
});
