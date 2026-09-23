/**
 * TN-LEVEL-02's texture refusal, weighed from the manifest (ADR-0020 §4).
 *
 * ## Why this is not the parser's sum
 *
 * `parseLevelDocument` sums `assets[].decodedBytes` and hands the total to
 * `refuseOverBudget`. Every shipped level declares `"assets": []`, because a
 * level names its art by key and the manifest resolves it (ADR-0020), so that
 * sum is zero and the refusal could not fire — while reading exactly like a
 * check that passes. The weight of a level's art is a build fact, and it lives
 * in `assets/dist/manifest.json`.
 *
 * ## What is weighed
 *
 * The files the loader is about to queue: {@link selectLevelAssets}'s requests,
 * at this device's scale, each priced at the manifest's `decodedBytes`. Those
 * requests are how every key the level names — its layers, landmarks,
 * characters, dressing — becomes a texture, and they are what the GPU will
 * actually hold: a whole atlas page, not the frames the level uses from it, and
 * a 1x-pinned file on a 2x device at its 1x price. Weighing the level's *keys*
 * instead would price a frame as if it were free of its sheet.
 *
 * The number is this device's, not the worst device's. CI already holds every
 * device scale to the budget (`scripts/lib/texture-memory.mjs`); the runtime
 * refusal is for the document CI did not see (ADR-0013), and on that the
 * question is whether *this* device should decode it.
 *
 * ## Absent is not zero
 *
 * A request the manifest cannot price — no entry for its file, or an entry with
 * no `decodedBytes` — refuses the level. Counting it as nothing is precisely how
 * the refusal died the first time.
 *
 * Pure: no Phaser, no DOM, no fetch.
 */

import { appErr, ok, type Result } from '@common/result';

import type { AssetManifest, AssetManifestFile, LoadRequest } from './level-assets';
import { refuseOverBudget, type SceneLevel } from './level-document';

/** The file a fetched URL names: its manifest path, after the base URL. */
const fileFor = (manifest: AssetManifest, url: string): AssetManifestFile | undefined =>
  manifest.files.find((file) => url === file.path || url.endsWith(`/${file.path}`));

/**
 * The decoded texture bytes `requests` will put on the GPU, or why that cannot
 * be known. Only textures are priced: an atlas's frame data is JSON.
 */
export function decodedBytesOf(
  manifest: AssetManifest,
  requests: readonly LoadRequest[],
): Result<number> {
  let total = 0;
  for (const request of requests) {
    const url = request.kind === 'image' ? request.url : request.textureUrl;
    const file = fileFor(manifest, url);
    if (file?.decodedBytes === undefined) {
      return appErr(
        'invalid',
        'assets.manifest.unweighed',
        `the asset manifest does not say what "${request.key}" costs once decoded ` +
          `(${url}), so the level's texture budget cannot be checked (TN-LEVEL-02).`,
        { key: request.key, url, listed: file !== undefined },
      );
    }
    total += file.decodedBytes;
  }
  return ok(total);
}

/**
 * Refuse `level` when what the loader is about to fetch for it will not fit its
 * texture budget, or cannot be weighed. `null` when it fits.
 *
 * Called by the renderer after the load list is resolved and before a single
 * texture is requested, which is TN-LEVEL-02's "refused before any asset is
 * fetched".
 */
export function refuseOverManifestBudget(
  level: SceneLevel,
  manifest: AssetManifest,
  requests: readonly LoadRequest[],
): Result<never> | null {
  const weight = decodedBytesOf(manifest, requests);
  if (!weight.ok) return weight;
  return refuseOverBudget({ ...level, decodedTextureBytes: weight.value });
}
