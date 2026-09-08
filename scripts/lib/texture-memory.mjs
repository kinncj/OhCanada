/**
 * The per-level DECODED TEXTURE MEMORY gate.
 *
 * This is the constraint that killed this project's predecessor: roughly 190
 * textures, WebGL context lost around 538 MB, on an iPhone that had reported
 * every capability as available. Transfer payload was never the problem there —
 * a level can be 3 MB over the wire and 130 MB in VRAM, because what a GPU holds
 * is width x height x 4, not what libwebp compressed it to. It was found by a
 * user rather than by us. That is the failure this file exists to make
 * impossible to repeat.
 *
 * `textureBudgetBytes` has been *required* by level.schema.json since slice 0,
 * ottawa.json declares it, app/adapters/phaser/level-document.ts refuses a level
 * that exceeds it — and until this file existed, every one of those checks was
 * measuring a number the level document declares about ITSELF. ottawa.json's
 * `assets[]` is `[]`, so the runtime's sum is 0 and its refusal cannot fire. The
 * only place the real figure exists is assets/dist/manifest.json, where
 * scripts/assets.mjs records `decodedBytes` per file and, until now,
 * deliberately did not enforce it. It is enforced here, over the files on disk.
 *
 * THE DECISION THIS GATE ENFORCES (owner's call, slice 1)
 *
 *   Full-screen parallax layers ship at 1x only. 2x is for characters, props and
 *   things the player looks at closely.
 *
 * Measured on Ottawa before the change: `layer-10-sky@2x` alone was 2160x3840 =
 * 31.6 MiB decoded — the entire declared budget in one sky the player moves
 * past. Spending that to sharpen a background is the trade that ends in a lost
 * context.
 *
 * WHAT "FULL-SCREEN" MEANS, MECHANICALLY
 *
 * A texture is a full-screen layer when its key appears in some level document's
 * `layers[]`. That is the exact set the parallax system draws across the whole
 * viewport, it is a fact already written down in content/levels/*.json, and it
 * takes no judgement to evaluate. scripts/assets.mjs reads the same set and
 * records the answer as `role` on every manifest entry, so the manifest is
 * self-describing; this gate re-derives it from the level documents and fails if
 * the two disagree, because a `role` nobody cross-checks is a label, not a fact.
 *
 * A size threshold ("anything over N megapixels is full-screen") was the
 * alternative and is rejected: it is a magic number, and it gets the answer
 * wrong in both directions — Ottawa's sky layer is 1080x1160 and its
 * skyline layer is 1800x300, neither of which fills 1080x1920, and both of
 * which are drawn across the entire screen every frame.
 *
 * WHAT IT CHECKS, and why each one is here rather than assumed:
 *
 *  1. Every level document declares a positive integer `textureBudgetBytes`, and
 *     it is not larger than the 64 MiB per-level ceiling in CLAUDE.md. A level
 *     may declare itself STRICTER than the global cap; it may not declare itself
 *     looser. The budget enforced is the lower of the two, and it is printed.
 *  2. The manifest parses, is the version this gate understands, and declares at
 *     least one level. ANTI-VACUUM FLOOR, the same as the payload gate: zero
 *     levels is a failure, not a pass.
 *  3. Every manifest entry carries a numeric `decodedBytes`. A manifest without
 *     the field fails rather than summing to 0 and reporting success — that is
 *     the second half of the anti-vacuum floor, and it is what stops an older
 *     or hand-written manifest from passing this gate by omission.
 *  4. Every texture's recorded pixel dimensions are read back OUT OF THE FILE
 *     HEADER on disk, by this gate's own reader, and `decodedBytes` must equal
 *     width x height x 4. The gate does not ask sharp, because sharp produced
 *     the number: that would only prove a library agrees with itself. A recorded
 *     `decodedBytes` that nobody re-derives is a number a level goes under
 *     budget by editing.
 *  5. No file providing a full-screen layer key ships above 1x.
 *  6. Per level, decoded texture memory <= min(textureBudgetBytes, 64 MiB).
 *  7. The manifest's own arithmetic (`levels[].decodedTextureBytes`) agrees with
 *     the gate's recomputation from disk. The gate never trusts a total it did
 *     not add up itself.
 *  8. When a level document declares `assets[]`, every entry's `decodedBytes`
 *     matches the manifest, and their sum is inside the budget — so the number
 *     the RUNTIME refuses on (level-document.ts `refuseOverBudget`) and the
 *     number CI refuses on cannot drift apart.
 *
 * HOW A LEVEL'S DECODED FOOTPRINT IS ADDED UP
 *
 * Not "the worst scale", which is how the payload gate adds up bytes. Once
 * layers are 1x-only, a phone at 2x holds the 2x props AND the 1x layers at the
 * same time, so bucketing by scale would simply lose the layers. Instead every
 * output belongs to a VARIANT GROUP (`group` in the manifest) — the set of files
 * that are the same texture at different scales — and for each device scale the
 * gate resolves one variant per group, exactly as a loader would:
 *
 *     the variant at the device's scale, else the largest below it,
 *     else the smallest above it; scale-independent groups always load.
 *
 * The level's footprint is the WORST device scale, and every device scale is
 * printed, so the number is arguable rather than magic.
 *
 * FOUR PIXELS PER BYTE-QUAD, AND WHAT IS NOT COUNTED
 *
 * 4 bytes per pixel is RGBA8888, which is what Phaser uploads: the pipeline
 * emits no compressed-texture format, and WebP's compression is a transfer
 * property that ends at decode. Mipmaps (+33%) are not counted because the
 * pipeline does not generate them; render targets and Rive's canvas surfaces are
 * not counted because their size is a property of the display, not of a file,
 * and this gate only measures files. It is therefore a FLOOR on what a level
 * costs in VRAM, never a ceiling — which is the safe direction for it to be
 * wrong in, and it is why the budget is 64 MiB and not the device's limit.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { MANIFEST_NAME, MANIFEST_VERSION, mib, readLevelDocuments } from './level-payload.mjs';
import { resolveByDeviceScale, worstDeviceScale } from './variant-scales.mjs';

/**
 * CLAUDE.md, Budgets: "Decoded texture memory <= 64 MB per level on iPhone."
 * level.schema.json caps `textureBudgetBytes` at the same number, and
 * app/adapters/phaser/level-document.ts holds its own copy as
 * MAX_DECODED_TEXTURE_BYTES. Three copies of one number is two too many, but the
 * schema cannot import and neither can a build script import from `app/`, so
 * they are kept identical and each names the other two.
 */
export const MAX_DECODED_TEXTURE_BYTES = 67_108_864;

/** RGBA8888. See "FOUR PIXELS PER BYTE-QUAD" above. */
export const BYTES_PER_PIXEL = 4;

/** Manifest kinds that occupy GPU memory and must therefore declare pixels. */
const TEXTURE_KINDS = new Set(['image', 'atlas']);

/** Manifest kinds that are not textures and must declare `decodedBytes: 0`. */
const NON_TEXTURE_KINDS = new Set(['atlas-data', 'rive']);

const ROLES = new Set(['layer', 'sprite']);

// ------------------------------------------------------------ dimensions ---

/**
 * Pixel dimensions of a WebP or PNG, read from the file's own header.
 *
 * Deliberately hand-rolled rather than delegated to sharp: sharp is what WROTE
 * these files and computed the `decodedBytes` this gate is checking, so asking
 * it would prove only that a library agrees with itself. Twenty lines of header
 * parsing is an independent measurement, and it keeps the gate runnable without
 * a native dependency — `make check-textures` works on a checkout that has never
 * built an asset.
 *
 * Returns `{ ok: true, width, height, format }` or `{ ok: false, error }`.
 */
export function imageSize(file) {
  let head;
  try {
    head = readFileSync(file);
  } catch (error) {
    return { ok: false, error: `cannot be read (${error.message})` };
  }
  if (head.length < 32) return { ok: false, error: `is ${head.length} B long, too short to be an image` };

  // PNG: 8-byte signature, then an IHDR whose first two big-endian uint32 are
  // width and height.
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ok: true, format: 'png', width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
  }

  if (head.subarray(0, 4).toString('ascii') !== 'RIFF' || head.subarray(8, 12).toString('ascii') !== 'WEBP') {
    return { ok: false, error: 'is neither a WebP nor a PNG; its decoded size cannot be derived' };
  }

  const chunk = head.subarray(12, 16).toString('ascii');

  // VP8X (extended: alpha, animation): 1 flag byte + 3 reserved, then canvas
  // width-1 and height-1 as 24-bit little-endian.
  if (chunk === 'VP8X') {
    const at = 20;
    const w = head[at + 4] | (head[at + 5] << 8) | (head[at + 6] << 16);
    const h = head[at + 7] | (head[at + 8] << 8) | (head[at + 9] << 16);
    return { ok: true, format: 'webp/vp8x', width: w + 1, height: h + 1 };
  }

  // VP8L (lossless, what this pipeline emits): 0x2f signature, then 14 bits of
  // width-1 and 14 bits of height-1 packed little-endian.
  if (chunk === 'VP8L') {
    const at = 21;
    if (head[20] !== 0x2f) return { ok: false, error: 'has a VP8L chunk with no 0x2f signature' };
    const bits = head.readUInt32LE(at);
    return { ok: true, format: 'webp/lossless', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }

  // VP8 (lossy): 3-byte frame tag, the 0x9d 0x01 0x2a start code, then two
  // 14-bit dimensions.
  if (chunk === 'VP8 ') {
    const at = 20 + 3;
    if (head[at] !== 0x9d || head[at + 1] !== 0x01 || head[at + 2] !== 0x2a) {
      return { ok: false, error: 'has a VP8 chunk with no 0x9d012a start code' };
    }
    return {
      ok: true,
      format: 'webp/lossy',
      width: head.readUInt16LE(at + 3) & 0x3fff,
      height: head.readUInt16LE(at + 5) & 0x3fff,
    };
  }

  return { ok: false, error: `is a WebP whose first chunk is "${chunk}", which this gate cannot measure` };
}

// -------------------------------------------------------- variant groups ---

/**
 * Decoded bytes a device at each of `deviceScales` would hold for `files`.
 *
 * The resolution itself lives in ./variant-scales.mjs, because the payload gate
 * needs exactly the same answer about a different quantity and the two must not
 * be able to drift.
 */
export const decodedByDeviceScale = (files, deviceScales) =>
  resolveByDeviceScale(files, deviceScales, (f) => f.decodedBytes);

// -------------------------------------------------------------- the gate ---

/**
 * Check decoded texture memory per level in the manifest under `dir`, against
 * each level document's `textureBudgetBytes` and the global 64 MiB ceiling.
 *
 * Returns `{ failures, summary, levels }`. `summary` is null whenever there is a
 * failure, so a caller cannot print a reassuring line and a failure together.
 */
export function checkTextureMemory({ root, dir, source = 'assets/dist' }) {
  const failures = [];
  const fail = (message) => failures.push(message);

  // ----------------------------------------------------------- manifest ---
  const manifestFile = join(dir, MANIFEST_NAME);
  if (!existsSync(manifestFile)) {
    fail(
      `${source}/${MANIFEST_NAME} is missing. \`make assets\` writes it; without it nothing records ` +
        'the decoded size of a texture and the per-level texture budget cannot be enforced.',
    );
    return { failures, summary: null, levels: [] };
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  } catch (error) {
    fail(`${source}/${MANIFEST_NAME} is not valid JSON (${error.message}).`);
    return { failures, summary: null, levels: [] };
  }

  if (manifest?.version !== MANIFEST_VERSION) {
    fail(
      `${source}/${MANIFEST_NAME} declares version ${JSON.stringify(manifest?.version)}; this gate ` +
        `understands version ${MANIFEST_VERSION} only. Version ${MANIFEST_VERSION} is the one that ` +
        'carries `decodedBytes`, `group` and `role` on every file, which is everything this gate ' +
        'measures. Rebuild with `make assets`.',
    );
    return { failures, summary: null, levels: [] };
  }

  const files = Array.isArray(manifest.files) ? manifest.files : null;
  const levels = manifest.levels && typeof manifest.levels === 'object' ? manifest.levels : null;
  const scales = Array.isArray(manifest.scales) ? manifest.scales.filter((s) => typeof s === 'number' && s > 0) : [];
  if (files === null) fail(`${source}/${MANIFEST_NAME} has no "files" array.`);
  if (levels === null) fail(`${source}/${MANIFEST_NAME} has no "levels" object.`);
  if (scales.length === 0) {
    fail(
      `${source}/${MANIFEST_NAME} declares no "scales"; without the device scales the pipeline built ` +
        'for, there is no way to say which textures a device holds at once.',
    );
  }
  if (files === null || levels === null || scales.length === 0) return { failures, summary: null, levels: [] };

  const levelIds = Object.keys(levels).sort();

  /**
   * ANTI-VACUUM FLOOR, first half. Nothing below can fail when the manifest
   * describes no levels, so "described nothing" has to be the failure itself.
   */
  if (levelIds.length === 0) {
    fail(
      `${source}/${MANIFEST_NAME} maps files to 0 level(s) — the per-level texture budget has nothing ` +
        'to measure. Either assets/src holds no sources, or the pipeline stopped assigning files to ' +
        'levels. Do not read this as "every level fits in texture memory".',
    );
  }

  // ------------------------------------------- files, pixels, and roles ---
  const measured = [];
  files.forEach((entry, index) => {
    const where = `${source}/${MANIFEST_NAME} files[${index}]`;
    const path = typeof entry?.path === 'string' ? entry.path : null;
    if (path === null || path.length === 0) {
      fail(`${where} has no "path"; its decoded size cannot be charged to anything.`);
      return;
    }

    /**
     * ANTI-VACUUM FLOOR, second half. A manifest that simply omits
     * `decodedBytes` would sum to zero and pass every budget below. Version 1
     * manifests are exactly that manifest, which is why the version check above
     * is a hard stop and this is a per-file hard stop.
     */
    if (typeof entry.decodedBytes !== 'number' || !Number.isFinite(entry.decodedBytes) || entry.decodedBytes < 0) {
      fail(
        `${where} ${source}/${path} records ${JSON.stringify(entry.decodedBytes)} for "decodedBytes". ` +
          'Every file must declare its decoded size, including the ones that are 0: a missing number ' +
          'sums to nothing and passes every texture budget there is.',
      );
      return;
    }

    const kind = typeof entry.kind === 'string' ? entry.kind : '';
    if (!TEXTURE_KINDS.has(kind) && !NON_TEXTURE_KINDS.has(kind)) {
      fail(
        `${where} ${source}/${path} has kind ${JSON.stringify(entry.kind)}, which this gate does not ` +
          `know how to weigh. Textures: ${[...TEXTURE_KINDS].join(', ')}. Not textures: ` +
          `${[...NON_TEXTURE_KINDS].join(', ')}. A new kind must decide which it is here before it ships.`,
      );
      return;
    }

    const role = typeof entry.role === 'string' ? entry.role : null;
    if (role === null || !ROLES.has(role)) {
      fail(
        `${where} ${source}/${path} has role ${JSON.stringify(entry.role)}; it must be one of ` +
          `${[...ROLES].join(', ')}. "layer" is a full-screen parallax layer and ships at 1x only.`,
      );
      return;
    }

    const group = typeof entry.group === 'string' && entry.group.length > 0 ? entry.group : null;
    if (group === null) {
      fail(
        `${where} ${source}/${path} has no "group". The group is what says which files are the same ` +
          'texture at different scales; without it the gate cannot tell what a device loads at once.',
      );
      return;
    }

    const scale = typeof entry.scale === 'number' ? entry.scale : entry.scale === null ? null : undefined;
    if (scale === undefined || (scale !== null && !(scale > 0))) {
      fail(`${where} ${source}/${path} has scale ${JSON.stringify(entry.scale)}; expected a positive number or null.`);
      return;
    }

    const owners = Array.isArray(entry.levels) ? entry.levels.filter((l) => typeof l === 'string') : [];
    const keys = Array.isArray(entry.keys) ? entry.keys.filter((k) => typeof k === 'string') : [];

    if (NON_TEXTURE_KINDS.has(kind)) {
      if (entry.decodedBytes !== 0) {
        fail(
          `${where} ${source}/${path} is kind "${kind}", which holds no GPU texture, but records ` +
            `${entry.decodedBytes} decoded bytes. Charging it would inflate the budget with bytes no ` +
            'texture unit ever holds.',
        );
      }
      measured.push({ path, kind, role, group, scale, keys, levels: owners, decodedBytes: 0, width: null, height: null });
      return;
    }

    // A texture: its pixels are re-derived from the file, never taken on trust.
    const full = join(dir, ...path.split('/'));
    if (!existsSync(full) || !statSync(full).isFile()) {
      fail(
        `${where} lists ${source}/${path}, which does not exist on disk, so its decoded size cannot be ` +
          'checked. `make assets` writes the manifest and the files together; they have come apart.',
      );
      return;
    }
    const size = imageSize(full);
    if (!size.ok) {
      fail(`${where} ${source}/${path} ${size.error}.`);
      return;
    }
    if (entry.width !== size.width || entry.height !== size.height) {
      fail(
        `${where} records ${JSON.stringify(entry.width)}x${JSON.stringify(entry.height)} px for ` +
          `${source}/${path}, which is ${size.width}x${size.height} px in the file's own header ` +
          `(${size.format}). Decoded memory is width x height x ${BYTES_PER_PIXEL}, so a wrong size ` +
          'here is a wrong budget everywhere.',
      );
      return;
    }
    const decoded = size.width * size.height * BYTES_PER_PIXEL;
    if (entry.decodedBytes !== decoded) {
      fail(
        `${where} records ${entry.decodedBytes} decodedBytes for ${source}/${path}, but ` +
          `${size.width}x${size.height} px at ${BYTES_PER_PIXEL} B/px is ${decoded} B (${mib(decoded)}). ` +
          'A recorded number nobody re-derives is a number a level goes under budget by editing.',
      );
      return;
    }

    measured.push({
      path,
      kind,
      role,
      group,
      scale,
      keys,
      levels: owners,
      decodedBytes: decoded,
      width: size.width,
      height: size.height,
    });
  });

  // ---------------------------------------------------- group integrity ---
  const byGroup = new Map();
  for (const file of measured) {
    if (!byGroup.has(file.group)) byGroup.set(file.group, []);
    byGroup.get(file.group).push(file);
  }
  for (const [group, variants] of [...byGroup.entries()].sort()) {
    const scaleless = variants.filter((v) => v.scale === null);
    if (scaleless.length > 0 && scaleless.length !== variants.length) {
      fail(
        `group "${group}" mixes scale-independent files with scaled ones ` +
          `(${variants.map((v) => `${v.path} @${String(v.scale)}`).join(', ')}). A group is one texture ` +
          'at several scales; a mixed group makes "what does a device load" unanswerable.',
      );
    }
    const seen = new Map();
    for (const variant of variants) {
      if (variant.scale === null) continue;
      if (seen.has(variant.scale)) {
        fail(
          `group "${group}" has two files at ${variant.scale}x (${seen.get(variant.scale)} and ` +
            `${variant.path}). A device would load one of them and the gate cannot know which.`,
        );
      }
      seen.set(variant.scale, variant.path);
    }
  }

  // --------------------------------- level documents: budgets and layers ---
  const docs = readLevelDocuments(root, fail);
  const docById = new Map(docs.map((doc) => [doc.id, doc]));

  /** Every key any level document draws as a full-screen parallax layer. */
  const layerKeys = new Set();
  for (const doc of docs) {
    for (const { key, where } of doc.keys) if (where === 'layers[].key') layerKeys.add(key);
  }

  // ------------------------------------------- the full-screen 1x rule ---
  for (const file of measured) {
    const drawn = file.keys.filter((key) => layerKeys.has(key));
    const isLayerByContent = drawn.length > 0;

    if (isLayerByContent && file.role !== 'layer') {
      fail(
        `${source}/${file.path} provides ${drawn.map((k) => `"${k}"`).join(', ')}, which ` +
          `content/levels/ draws as a full-screen parallax layer, but the manifest records role ` +
          `"${file.role}". The role is what the 1x rule is applied to, so a mislabelled layer is a ` +
          'layer with no rule. Rebuild with `make assets`.',
      );
    }
    if (!isLayerByContent && file.role === 'layer') {
      fail(
        `${source}/${file.path} records role "layer" but none of its keys ` +
          `(${file.keys.map((k) => `"${k}"`).join(', ') || 'it has none'}) appears in any level ` +
          "document's layers[]. Full-screen is defined by content/levels/, not by the manifest; a " +
          'role that outlives the layer it described will pin a prop to 1x for no reason.',
      );
    }

    if (file.role === 'layer' && file.scale !== null && file.scale > 1) {
      fail(
        `${source}/${file.path} is a full-screen parallax layer shipped at ${file.scale}x ` +
          `(${file.width}x${file.height} px = ${mib(file.decodedBytes)} decoded). Full-screen layers ` +
          'ship at 1x only: 2x is for characters, props and things the player looks at closely. ' +
          `At 1x this texture costs ${mib(file.decodedBytes / (file.scale * file.scale))}. Spending ` +
          'the difference to sharpen a background the player moves past is the trade that ends in a ' +
          'lost WebGL context. Move the source out of layers[] if it is not a background, or let the ' +
          'pipeline emit it at 1x.',
      );
    }
  }

  // --------------------------------------------------- per-level totals ---
  const report = [];
  for (const id of levelIds) {
    const own = measured.filter((f) => f.levels.includes(id));
    const perScale = decodedByDeviceScale(own, scales);
    const worst = worstDeviceScale(perScale);

    const doc = docById.get(id);
    let declared = null;
    if (doc === undefined) {
      fail(
        `${source}/${MANIFEST_NAME} charges files to level "${id}", but there is no ` +
          `content/levels/${id}.json declaring a textureBudgetBytes to weigh them against. ` +
          'An unbudgeted level is an unmeasured level.',
      );
    } else if (
      typeof doc.textureBudgetBytes !== 'number' ||
      !Number.isInteger(doc.textureBudgetBytes) ||
      doc.textureBudgetBytes <= 0
    ) {
      fail(
        `${doc.file} declares textureBudgetBytes ${JSON.stringify(doc.textureBudgetBytes)}; it must be a ` +
          'positive integer. level.schema.json requires the field, so this means the document was ' +
          'edited past its schema, and a missing budget read as "unlimited" is the vacuum with extra steps.',
      );
    } else if (doc.textureBudgetBytes > MAX_DECODED_TEXTURE_BYTES) {
      fail(
        `${doc.file} declares textureBudgetBytes ${doc.textureBudgetBytes} (${mib(doc.textureBudgetBytes)}), ` +
          `over the ${MAX_DECODED_TEXTURE_BYTES} B (${mib(MAX_DECODED_TEXTURE_BYTES)}) per-level ceiling in ` +
          'CLAUDE.md. A level may declare ' +
          'itself STRICTER than the global cap; it may not declare itself looser. Lower the number, or ' +
          'change the ceiling in an ADR and in CLAUDE.md, level.schema.json and ' +
          'app/adapters/phaser/level-document.ts together.',
      );
    } else {
      declared = doc.textureBudgetBytes;
    }

    const budget = Math.min(declared ?? MAX_DECODED_TEXTURE_BYTES, MAX_DECODED_TEXTURE_BYTES);
    const source_ = declared !== null && declared < MAX_DECODED_TEXTURE_BYTES ? doc.file : 'CLAUDE.md';

    const entry = levels[id];
    if (entry === null || typeof entry !== 'object') {
      fail(`${source}/${MANIFEST_NAME} levels["${id}"] is not an object.`);
    } else if (entry.decodedTextureBytes !== worst) {
      fail(
        `${source}/${MANIFEST_NAME} levels["${id}"] records decodedTextureBytes ` +
          `${JSON.stringify(entry.decodedTextureBytes)}, but the textures on disk charged to "${id}" ` +
          `resolve to ${worst} B (${mib(worst)}) at the worst device scale. The manifest's own ` +
          'arithmetic does not hold.',
      );
    }

    /**
     * ANTI-VACUUM FLOOR, third half. A level that holds no texture at all fits
     * every budget ever written, and is the exact state a broken pipeline
     * produces. It fails by name rather than passing quietly.
     */
    if (worst === 0) {
      fail(
        `level "${id}" resolves to 0 B of decoded texture memory across ${own.length} file(s). A level ` +
          'that holds no texture is not a level that fits the budget, it is a level with no art. Do not ' +
          'read this as "under budget".',
      );
    } else if (worst > budget) {
      const heaviest = own
        .slice()
        .sort((a, b) => b.decodedBytes - a.decodedBytes)
        .slice(0, 3)
        .map((f) => `${f.path} ${f.width}x${f.height} ${mib(f.decodedBytes)}`);
      fail(
        `level "${id}" holds ${mib(worst)} (${worst} B) of decoded texture memory at the worst device ` +
          `scale; the budget is ${mib(budget)} (${budget} B, from ${source_}), so it is ${worst - budget} B ` +
          `over. Per device scale: ${perScale.map(([s, b]) => `${s}x ${mib(b)}`).join(', ')}. Heaviest: ` +
          `${heaviest.join(', ')}. This is VRAM, not download: a level that fits the 8 MiB payload budget ` +
          'can still lose the WebGL context. Shrink the source pixels, drop a layer, or split it into ' +
          'tiles that repeat — turning the compression up saves nothing here.',
      );
    }

    report.push({ id, worst, budget, budgetSource: source_, perScale, fileCount: own.length });
  }

  // ------------------------------- level documents' own preload manifest ---
  const byPath = new Map(measured.map((f) => [f.path, f]));
  const basePath = readBasePath(root);
  for (const doc of docs) {
    if (doc.assets.length === 0) continue;
    let sum = 0;
    doc.assets.forEach((asset, index) => {
      if (typeof asset?.decodedBytes === 'number') sum += asset.decodedBytes;
      if (typeof asset?.url !== 'string') return;
      let url = asset.url.split('#')[0].split('?')[0];
      if (basePath && basePath !== '/' && url.startsWith(basePath)) url = url.slice(basePath.length);
      const file = byPath.get(url.replace(/^\.?\//, ''));
      if (file === undefined) return; // the payload gate names this one.
      if (asset.decodedBytes !== file.decodedBytes) {
        fail(
          `${doc.file} assets[${index}] declares ${JSON.stringify(asset.decodedBytes)} decoded bytes for ` +
            `"${asset.url}", which is ${file.decodedBytes} B on disk. The loader refuses a level on the ` +
            "document's own sum (level-document.ts refuseOverBudget), so a document that understates a " +
            'texture is a runtime check that cannot fire.',
        );
      }
    });
    const budget = report.find((r) => r.id === doc.id)?.budget ?? MAX_DECODED_TEXTURE_BYTES;
    if (sum > budget) {
      fail(
        `${doc.file} assets[] sums to ${sum} B (${mib(sum)}) of decoded texture, over its ${mib(budget)} ` +
          'budget. This is the number the loader itself refuses on; it must not be reachable in a build.',
      );
    }
  }

  if (failures.length > 0) return { failures, summary: null, levels: report };

  const perLevel = report
    .map(
      (r) =>
        `${r.id} ${mib(r.worst)} of ${mib(r.budget)} (${((r.worst / r.budget) * 100).toFixed(0)}%, ` +
        `${r.budget - r.worst} B spare, budget from ${r.budgetSource}) over ${r.fileCount} file(s) ` +
        `[${r.perScale.map(([s, b]) => `${s}x device ${mib(b)}`).join(' / ')}]`,
    )
    .join('; ');

  const layerFiles = measured.filter((f) => f.role === 'layer');
  const summary =
    `${report.length} level(s) — ${perLevel}. ` +
    `${layerFiles.length} full-screen layer file(s), all at 1x. ` +
    `${measured.length} file(s) measured from their own headers at ${BYTES_PER_PIXEL} B/px.`;

  return { failures, summary, levels: report };
}

/** `basePath` from game.config.json, for resolving a level document's urls. */
function readBasePath(root) {
  try {
    const config = JSON.parse(readFileSync(join(root, 'content', 'game.config.json'), 'utf8'));
    return typeof config?.basePath === 'string' ? config.basePath : '/';
  } catch {
    return '/';
  }
}
