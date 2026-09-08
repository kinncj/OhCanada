/**
 * What a level has to load before it can draw itself.
 *
 * ## The defect this closes
 *
 * The shipped Ottawa level **never once drew its art**. `data-tn-level` reached
 * `ready`, `[data-testid="playable"]` appeared, no console error was raised —
 * and the network log for the deployed page contained **zero image requests**.
 * Every parallax band was the flat theme-coloured placeholder `level-scene.ts`
 * draws when `this.textures.exists(key)` is false, and it was false because
 * nothing had ever asked Phaser to load a texture. `make assets` built the
 * atlases, `scripts/check-texture-memory.mjs` weighed them, the manifest listed
 * them with exactly the keys the level document names, and no line of code
 * connected the two.
 *
 * That is worse than a missing asset: a missing asset 404s and somebody sees it.
 * This failed *successfully*, in production, for as long as anyone cared to
 * look. And forty e2e tests passed over it, because every one of them asked
 * whether the scene reached `ready` and none asked whether a layer was drawn
 * from a texture rather than from a coloured band.
 *
 * So there are two halves to the fix and the second one is the important one:
 *
 *  1. this module, which turns `assets/dist/manifest.json` into the list of
 *     things to load;
 *  2. `SceneSnapshot.layersTextured` — a count the scene publishes of layers
 *     that resolved to a real texture — so that "drew its art" and "drew a
 *     coloured band" stop being indistinguishable to a test. The fallback is
 *     still the right behaviour while art is in flight; what was wrong was that
 *     nothing could see it.
 *
 * ## Scale, and why it is per key rather than per level
 *
 * The pipeline emits `@1x` and `@2x`, and a file may be **pinned** to one scale:
 * the Parliament Hill landmark ships `@1x` only, which is what recovered 12.85
 * MiB of the level's texture budget. So a level cannot ask for "the 2x set" —
 * there is no such complete set. {@link selectLevelAssets} therefore resolves
 * scale **per texture key**: the largest available scale not above the one
 * asked for, and failing that the smallest available. A pinned asset is then a
 * pipeline decision this module honours rather than a special case it knows
 * about, and a key that only exists at 2x still loads on a 1x device instead of
 * silently becoming a coloured band — which is the bug above, one key at a time.
 *
 * Pure: no Phaser, no `fetch`, no `import.meta`. The manifest arrives parsed and
 * the base URL arrives as a string, which is what lets every rule here be tested
 * without a browser.
 */

import { appErr, ok, type Result } from '@common/result';

/** The `kind` values the asset pipeline emits that a scene can load. */
export type AssetKind = 'atlas' | 'atlas-data' | 'image' | 'rive';

export interface AssetManifestFile {
  readonly path: string;
  readonly kind: string;
  readonly scale: number;
  /** Texture keys this file provides. An image has one; an atlas has its frames. */
  readonly keys: readonly string[];
  /** For `atlas-data`, the `path` of the atlas image it describes. */
  readonly atlas?: string;
  /** Which levels want this file. A shared atlas names several. */
  readonly levels: readonly string[];
}

export interface AssetManifest {
  readonly version: number;
  readonly files: readonly AssetManifestFile[];
}

/** One thing to hand to Phaser's loader. */
export type LoadRequest =
  | { readonly kind: 'image'; readonly key: string; readonly url: string }
  | {
      readonly kind: 'atlas';
      readonly key: string;
      readonly textureUrl: string;
      readonly dataUrl: string;
    };

/**
 * The manifest version this reader understands.
 *
 * Checked rather than assumed: the pipeline has already bumped it once, and a
 * reader that shrugs at an unknown version is a reader that silently loads
 * nothing — which is the defect in this file's header, returning by a different
 * door.
 */
export const SUPPORTED_MANIFEST_VERSION = 2;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringsOf = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/**
 * Read `assets/dist/manifest.json`.
 *
 * Refuses rather than coerces. A manifest that cannot be read is reported as an
 * error the caller logs; the level still opens on placeholder bands, because a
 * level a player can walk is better than a blank page — but the probe then
 * reports `layersTextured` as 0 and the e2e suite fails, which is the whole
 * point of counting it.
 */
export function parseAssetManifest(source: unknown): Result<AssetManifest> {
  if (!isRecord(source)) {
    return appErr('invalid', 'assets.manifest.notAnObject', 'the asset manifest is not an object.');
  }
  const version = source['version'];
  if (typeof version !== 'number') {
    return appErr('invalid', 'assets.manifest.noVersion', 'the asset manifest declares no version.');
  }
  if (version !== SUPPORTED_MANIFEST_VERSION) {
    return appErr(
      'unsupported',
      'assets.manifest.version',
      `the asset manifest is version ${String(version)}; this build reads version ` +
        `${String(SUPPORTED_MANIFEST_VERSION)}.`,
      { found: version, supported: SUPPORTED_MANIFEST_VERSION },
    );
  }
  const files = source['files'];
  if (!Array.isArray(files)) {
    return appErr('invalid', 'assets.manifest.noFiles', 'the asset manifest lists no files.');
  }

  const parsed: AssetManifestFile[] = [];
  for (const entry of files) {
    if (!isRecord(entry)) continue;
    const path = entry['path'];
    const kind = entry['kind'];
    if (typeof path !== 'string' || typeof kind !== 'string') continue;
    const atlas = entry['atlas'];
    parsed.push({
      path,
      kind,
      scale: typeof entry['scale'] === 'number' ? entry['scale'] : 1,
      keys: stringsOf(entry['keys']),
      levels: stringsOf(entry['levels']),
      ...(typeof atlas === 'string' ? { atlas } : {}),
    });
  }

  return ok({ version, files: parsed });
}

/**
 * The scale to ask for on this device.
 *
 * `devicePixelRatio` and nothing else: the visual tier is about *how much* is
 * drawn (ADR-0011) and this is about how many texels a drawn thing has. Tying
 * them together would mean a device demoted for a slow frame also loses its
 * crisp art, which is two decisions taken by one measurement.
 */
export function preferredAssetScale(devicePixelRatio: number): number {
  return Number.isFinite(devicePixelRatio) && devicePixelRatio >= 1.5 ? 2 : 1;
}

/** Everything a level needs, at the best scale each key actually has. */
export function selectLevelAssets(
  manifest: AssetManifest,
  levelId: string,
  options: { readonly scale: number; readonly baseUrl: string },
): readonly LoadRequest[] {
  const mine = manifest.files.filter((file) => file.levels.includes(levelId));
  const url = (path: string): string => `${options.baseUrl}${path}`;

  const requests: LoadRequest[] = [];

  /* Images: one texture key each, resolved independently so a pinned file is
     picked up at the scale it was pinned to. */
  const imagesByKey = new Map<string, AssetManifestFile[]>();
  for (const file of mine) {
    if (file.kind !== 'image') continue;
    const key = file.keys[0];
    if (key === undefined) continue;
    imagesByKey.set(key, [...(imagesByKey.get(key) ?? []), file]);
  }
  for (const [key, candidates] of imagesByKey) {
    const chosen = bestScale(candidates, options.scale);
    if (chosen !== undefined) requests.push({ kind: 'image', key, url: url(chosen.path) });
  }

  /*
   * Atlases: an image plus the JSON that describes its frames, paired by the
   * `atlas` back-reference the data file carries. The texture key is the
   * atlas's own name — `ottawa`, `shared` — derived from the path, because that
   * is what a frame lookup needs and the manifest gives the pair no shared id.
   */
  const dataByAtlasPath = new Map<string, AssetManifestFile>();
  for (const file of mine) {
    if (file.kind !== 'atlas-data' || file.atlas === undefined) continue;
    dataByAtlasPath.set(file.atlas, file);
  }

  const atlasesByKey = new Map<string, AssetManifestFile[]>();
  for (const file of mine) {
    if (file.kind !== 'atlas') continue;
    const key = atlasKeyOf(file.path);
    if (key === null) continue;
    atlasesByKey.set(key, [...(atlasesByKey.get(key) ?? []), file]);
  }
  for (const [key, candidates] of atlasesByKey) {
    const chosen = bestScale(candidates, options.scale);
    if (chosen === undefined) continue;
    const data = dataByAtlasPath.get(chosen.path);
    /* No frame data means no frames; loading the sheet alone would put a texture
       in the manager under a key nothing can index into, which reads as success
       and draws nothing — the same failure shape this file exists to remove. */
    if (data === undefined) continue;
    requests.push({
      kind: 'atlas',
      key,
      textureUrl: url(chosen.path),
      dataUrl: url(data.path),
    });
  }

  /* Stable order so a load is reproducible and a diff of the request log is
     readable. Images first: they are what the first frame draws. */
  return requests.sort((a, b) => a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key));
}

/** Every texture key the requests will put in the texture manager. */
export function keysIn(
  manifest: AssetManifest,
  levelId: string,
  requests: readonly LoadRequest[],
): readonly string[] {
  const paths = new Set(
    requests.map((request) => (request.kind === 'image' ? request.url : request.textureUrl)),
  );
  return manifest.files
    .filter((file) => file.levels.includes(levelId))
    .filter((file) => [...paths].some((path) => path.endsWith(file.path)))
    .flatMap((file) => file.keys);
}

/**
 * `atlas/ottawa@2x.fa99afcd.webp` -> `ottawa`.
 *
 * The scale and the content hash are stripped, which is what makes the key
 * stable across a rebuild: a hash in a texture key would mean every asset change
 * renamed a texture the scene asks for by name.
 */
export function atlasKeyOf(path: string): string | null {
  const file = path.split('/').at(-1);
  if (file === undefined) return null;
  const name = file.split('@')[0];
  return name === undefined || name.length === 0 ? null : name;
}

/**
 * The largest scale at or below `wanted`, or — when a key exists only above it —
 * the smallest there is.
 *
 * The fallback direction matters. A 1x device meeting a 2x-only key gets a
 * texture that is twice the resolution it wanted, which costs memory and looks
 * fine. The alternative is loading nothing, and loading nothing is exactly how a
 * level ends up drawing coloured bands and calling itself ready.
 */
function bestScale(
  candidates: readonly AssetManifestFile[],
  wanted: number,
): AssetManifestFile | undefined {
  const atOrBelow = candidates
    .filter((file) => file.scale <= wanted)
    .sort((a, b) => b.scale - a.scale);
  if (atOrBelow[0] !== undefined) return atOrBelow[0];
  return [...candidates].sort((a, b) => a.scale - b.scale)[0];
}
