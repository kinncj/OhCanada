#!/usr/bin/env node
/**
 * assets — SVG sources under assets/src to WebP atlases under assets/dist
 * (slice 1, task 1.10), then the per-level payload gate over what it produced.
 *
 * The gates are not an afterthought bolted on later: `budgets.levelPayloadBytes`
 * and `textureBudgetBytes` both sat in content for a whole slice with no code
 * reading them, and a per-level budget is unmeasurable without a manifest saying
 * which bytes belong to which level. So this script writes
 * assets/dist/manifest.json and ends by running BOTH gates over it — transfer
 * bytes (scripts/lib/level-payload.mjs) and decoded texture bytes
 * (scripts/lib/texture-memory.mjs). If either fails, `make assets` fails. There
 * is no way to build assets and skip them. They are separate because they are
 * different quantities: a level can fit 8 MiB over the wire and cost 130 MB of
 * VRAM.
 *
 * WHAT IT DOES
 *
 *   1. rasterises every assets/src/svg/**\/*.svg with sharp, at 1x and 2x
 *      (density 72 and 144, so librsvg re-renders the vector rather than
 *      upscaling a bitmap);
 *   2. packs everything that fits into per-level WebP atlases with
 *      free-tex-packer-core, page size capped at 2048 px (art-bible 9);
 *   3. ships anything too big for a page — parallax layers are 1920 tall and
 *      wide — as a standalone WebP, capped at 4096 px, the texture size a 2021
 *      mid-range Android can be relied on to accept;
 *   4. copies assets/src/rive/**\/*.riv verbatim;
 *   5. content-hashes every output filename;
 *   6. writes assets/dist/manifest.json;
 *   7. runs the payload gate AND the decoded-texture gate, and exits non-zero if
 *      either fails.
 *
 * vite.config.ts sets `publicDir: 'assets/dist'`, so everything here lands at
 * the root of dist/ and is weighed again by scripts/deploy-check.mjs.
 *
 * WHICH LEVEL DOES A FILE BELONG TO
 *
 * This is the question the budget needs answered and no file in assets/src can
 * be trusted to answer about itself, so it is a convention over the source path,
 * and an unresolvable path is a hard failure rather than a guess:
 *
 *   assets/src/svg/<levelId>/<name>.svg   -> level <levelId>, key <levelId>-<name>
 *   assets/src/svg/shared/<name>.svg      -> EVERY level, key <name>
 *   assets/src/svg/<levelId>-<name>.svg   -> level <levelId>, key <levelId>-<name>
 *
 * `<levelId>` is the `id` of a document in content/levels/. The key is what
 * level JSON refers to art by (`layers[].key`, `pois[].artKey`), and the gate
 * checks that every key a level document names is actually produced — a level
 * has to load from its JSON alone, so a key with no texture is a broken level,
 * not a warning. A `shared/` file is charged to every level, because every level
 * downloads it.
 *
 * FULL-SCREEN PARALLAX LAYERS SHIP AT 1x ONLY
 *
 * Owner's decision, slice 1: 2x is for characters, props and things the player
 * looks at closely. Ottawa's `layer-10-sky` at 2x was 2160x3840 = 31.6 MiB of
 * decoded texture memory on its own — the level's entire declared texture budget
 * in one sky the player moves past. Spending that to sharpen a background is the
 * trade that ends in a lost WebGL context, which is how this project's
 * predecessor died.
 *
 * "Full-screen" is mechanical and is not decided here: a source is a layer when
 * its key appears in some level document's `layers[]`. Such a source is emitted
 * at 1x only, is never packed into an atlas (an atlas page mixing a layer with
 * props would have no single role, and the rule is applied per file), and is
 * recorded with `role: "layer"`. scripts/lib/texture-memory.mjs re-derives the
 * same set from content/levels/ and fails the build if the labels have drifted,
 * so `role` is a checked fact rather than a note.
 *
 * AND ANY SOURCE MAY PIN ITSELF TO 1x: `<name>@1x.svg`
 *
 * "Full-screen parallax layer" and "large art that does not need 2x" turned out
 * not to be the same set, and the gap cost 12.85 MiB (OQ-LEVEL-ART-1, found by
 * art 2026-09-08). `ottawa-landmark-parliament-hill` is a POI's `artKey`, not a
 * layer: 1080x1040, drawn once, at a fixed place in the world. It has every
 * property that put layers on 1x except appearing in `layers[]`, and
 * assets/style/ottawa-level.md had said "the landmark at 1x" and "the landmark
 * is not a layer" from the start. There was no way to say it, so it shipped at
 * 2x and cost 17.14 MiB -- 37% of the level.
 *
 * The fix is not a wider rule. Making every `pois[].artKey` 1x would decide on
 * art's behalf that no POI is ever held close to the camera, and a
 * megapixel threshold would demote the character atlas, which is exactly what 2x
 * is FOR. So the author says, in the filename, in the tree the author owns:
 *
 *   assets/src/svg/ottawa/landmark-parliament-hill@1x.svg   -> 1x only
 *
 * The suffix is stripped before the key is formed, so the key is unchanged and
 * nothing in content/levels/ moves. It is one-directional on purpose: a source
 * can only pin itself DOWN. `@2x` is a hard error, because the only thing it
 * could mean is "ignore the layers[] rule", and that rule is the owner's
 * decision, not the author's. A pinned source is standalone for the same reason
 * a layer is: one atlas page cannot have two scale sets.
 *
 * This is still no-judgement-to-evaluate. Given the tree, the answer is
 * determined; the judgement is the author's, recorded in a filename, once.
 *
 * WHY LOSSLESS WEBP
 *
 * The house style is flat: three tones per material, no gradients, no noise, no
 * texture (art-bible 1-2). Lossless WebP compresses that to almost nothing and
 * cannot ring around the 6 px character outlines, where lossy WebP at any
 * sensible quality does visible damage on a phone. If a level goes over budget
 * the answer is fewer or smaller sources, decided by a person — not a quality
 * knob turned down quietly here until the number fits.
 *
 * Content hashes depend on libwebp's output for a given input, so they are
 * stable for a given sharp version and can move when it is upgraded. That is the
 * same property Vite's asset hashes have and it is fine: nothing outside this
 * manifest hard-codes a hashed name.
 */

import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { packAsync } from 'free-tex-packer-core';
import sharp from 'sharp';

import { MANIFEST_NAME, MANIFEST_VERSION, checkLevelPayload, mib } from './lib/level-payload.mjs';
import { lintPalette } from './lib/palette-lint.mjs';
import { BYTES_PER_PIXEL, checkTextureMemory, decodedByDeviceScale } from './lib/texture-memory.mjs';
import { resolveByDeviceScale, worstDeviceScale } from './lib/variant-scales.mjs';

const SCALES = [1, 2];
const ATLAS_MAX_PX = 2048;
const STANDALONE_MAX_PX = 4096;
const ATLAS_PADDING = 2;
const ATLAS_EXTRUDE = 1;
const OUTPUT_DIRS = ['atlas', 'img', 'rive'];
const SHARED_OWNER = 'shared';

const HELP = `assets — build assets/dist from assets/src

Usage: node scripts/assets.mjs [options]

  --root <dir>  repository root (default: the repository this script lives in)
  --help, -h    this text

Source layout (the level a file belongs to is read from its path):

  assets/src/svg/<levelId>/<name>.svg    level <levelId>, key <levelId>-<name>
  assets/src/svg/shared/<name>.svg       every level, key <name>
  assets/src/svg/<levelId>-<name>.svg    level <levelId>, key <levelId>-<name>
  assets/src/rive/<levelId|shared>/<name>.riv   same rule, copied verbatim

A source may pin itself to 1x by ending its name "@1x" (the suffix is stripped
from the key). Use it for large art that is drawn once at a fixed place and does
not need retina pixels. "@2x" is an error: a source may only pin itself down.

<levelId> is the "id" of a document in content/levels/. A source whose level
cannot be worked out is an error, never a guess.

Output: WebP atlases (<= ${ATLAS_MAX_PX} px) and standalone WebP (<= ${STANDALONE_MAX_PX} px) at 1x and 2x,
content-hashed, plus assets/dist/${MANIFEST_NAME}. A source whose key appears in a
level document's layers[] is a full-screen parallax layer: standalone, 1x only.
Ends by running the per-level payload gate and the decoded-texture gate; a
failure in either fails this build.
`;

const argv = process.argv.slice(2);
if (argv.some((a) => a === '--help' || a === '-h')) {
  console.log(HELP);
  process.exit(0);
}

const optionAt = argv.indexOf('--root');
const ROOT = optionAt !== -1 && optionAt + 1 < argv.length
  ? argv[optionAt + 1]
  : fileURLToPath(new URL('..', import.meta.url));

const SRC_DIR = join(ROOT, 'assets', 'src');
const DIST_DIR = join(ROOT, 'assets', 'dist');
const LEVELS_DIR = join(ROOT, 'content', 'levels');

const errors = [];
const fatal = (message) => errors.push(message);

const rel = (absolute) => relative(ROOT, absolute).split(sep).join('/');
const hash8 = (buffer) => createHash('sha256').update(buffer).digest('hex').slice(0, 8);

/** Every file under `dir` with one of `extensions`, as absolute paths, sorted. */
function walk(dir, extensions) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, extensions));
    else if (entry.isFile() && extensions.includes(extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

// ------------------------------------------------------------------ levels ---

/**
 * The level ids art can be charged to. Read from content/levels/ rather than
 * from game.config.json's `levels` array, because the documents are what
 * declares the art keys the gate cross-checks, and game.config's array is empty
 * until unlock rules are written.
 */
function readLevels() {
  const ids = [];
  const layerKeys = new Set();
  if (!existsSync(LEVELS_DIR)) return { ids, layerKeys };
  for (const name of readdirSync(LEVELS_DIR).sort()) {
    if (!name.endsWith('.json')) continue;
    try {
      const doc = JSON.parse(readFileSync(join(LEVELS_DIR, name), 'utf8'));
      if (typeof doc?.id === 'string' && doc.id.length > 0) ids.push(doc.id);
      else fatal(`content/levels/${name} has no string "id"; art cannot be charged to it.`);
      // The full-screen set. It is read from the level documents rather than
      // guessed from a filename or a pixel count, so "is this a background?" is
      // answered by the file that decides how the thing is drawn.
      for (const layer of Array.isArray(doc?.layers) ? doc.layers : []) {
        if (typeof layer?.key === 'string' && layer.key.length > 0) layerKeys.add(layer.key);
      }
    } catch (error) {
      fatal(`content/levels/${name} is not valid JSON (${error.message}).`);
    }
  }
  return { ids: [...new Set(ids)].sort(), layerKeys };
}

const { ids: LEVELS, layerKeys: LAYER_KEYS } = readLevels();

/**
 * A full-screen parallax layer ships at 1x only; everything else ships at both.
 *
 * This is the whole of the owner's slice-1 decision in one function. It is
 * enforced again, independently, by scripts/lib/texture-memory.mjs reading
 * content/levels/ for itself — a rule applied only where it is convenient to
 * apply it is a rule that stops being true the first time someone hand-edits a
 * manifest.
 */
const isFullScreenLayer = (key) => LAYER_KEYS.has(key);
const roleOf = (key) => (isFullScreenLayer(key) ? 'layer' : 'sprite');

/**
 * The scales to emit: the source's own pin if it set one, else 1x for a
 * full-screen layer, else every scale.
 *
 * The pin can only narrow this. `assign` has already refused anything but
 * `@1x`, so there is no path here by which a filename widens what a level
 * document decided.
 */
const scalesFor = (key, pin) => (pin !== null ? [pin] : isFullScreenLayer(key) ? [1] : SCALES);

/**
 * Layers and pinned sources are standalone, never atlas frames.
 *
 * An atlas page is one texture with one scale for every frame on it. A page
 * holding a 1x-only source next to a 1x/2x source would have to be built twice
 * with different contents, and `role`/`scalePin` would describe some of its
 * frames and not others. One extra texture unit for a small pinned source is
 * cheaper than a rule that cannot be stated per file.
 */
const mustStandAlone = (key, pin) => pin !== null || isFullScreenLayer(key);

/**
 * Work out the owning level and the texture key for a source file.
 *
 * Returns `{ owner, key }` where `owner` is a level id or `shared`, or `null`
 * after recording why it could not be decided. Guessing here would be the whole
 * defect this task exists to close: a file whose level nobody can name is a file
 * charged to no budget.
 */
function assign(file, base) {
  const parts = relative(base, file).split(sep);
  const raw = basename(parts[parts.length - 1], extname(parts[parts.length - 1]));
  const inner = parts.slice(0, -1);

  /**
   * A trailing `@1x` pins the source to 1x and is stripped from the key, so the
   * pin never reaches content/levels/ and renaming a source to pin it does not
   * rename the key anything refers to.
   */
  const pinMatch = /^(.*)@(\d+)x$/.exec(raw);
  let pin = null;
  let name = raw;
  if (pinMatch !== null) {
    name = pinMatch[1];
    const asked = Number(pinMatch[2]);
    if (asked !== 1) {
      fatal(
        `${rel(file)} asks for "@${asked}x". A source may only pin itself DOWN, to "@1x". ` +
          `${SCALES.map((s) => `${s}x`).join(' and ')} are emitted by default for anything that is ` +
          'not a full-screen parallax layer, so "@2x" asks for nothing new -- and for a layer it ' +
          "would be asking to overrule the owner's decision that full-screen layers ship at 1x, " +
          'which a filename does not get to do. Drop the suffix, or use "@1x".',
      );
      return null;
    }
    if (name.length === 0) {
      fatal(`${rel(file)} is named only "@1x"; the pin is a suffix on a name, not a name.`);
      return null;
    }
    pin = 1;
  }

  if (inner.length > 0) {
    const owner = inner[0];
    const tail = [...inner.slice(1), name].join('-');
    if (owner === SHARED_OWNER) return { owner, key: tail, pin };
    if (LEVELS.includes(owner)) {
      return { owner, key: tail.startsWith(`${owner}-`) ? tail : `${owner}-${tail}`, pin };
    }
    fatal(
      `${rel(file)} sits under "${owner}/", which is neither "${SHARED_OWNER}" nor a level id in ` +
        `content/levels/ (${LEVELS.length > 0 ? LEVELS.join(', ') : 'there are none'}). ` +
        'Rename the directory or add the level document; this file is charged to no payload budget.',
    );
    return null;
  }

  const owner = LEVELS.find((id) => name.startsWith(`${id}-`));
  if (owner !== undefined) return { owner, key: name, pin };

  fatal(
    `${rel(file)} is at the top of its source tree and its name does not start with a level id ` +
      `(${LEVELS.length > 0 ? LEVELS.map((id) => `${id}-`).join(', ') : 'there are no level documents'}). ` +
      `Move it to assets/src/.../<levelId>/ or .../${SHARED_OWNER}/, or prefix the filename. ` +
      'A source whose level cannot be worked out is charged to no payload budget.',
  );
  return null;
}

/** Level ids a file is charged to. `shared` means every level downloads it. */
const chargedTo = (owner) => (owner === SHARED_OWNER ? [...LEVELS] : [owner]);

// ------------------------------------------------------------------ output ---

const files = [];

/**
 * STAGE FIRST, PROMOTE LAST. Nothing under `assets/dist/` is destroyed until a
 * complete, budget-checked set of outputs exists somewhere else.
 *
 * The previous shape wiped `assets/dist/` and then built into it, and it wiped
 * it again on any failure. The wipe itself was right and its reason still holds:
 * `emit` writes as it goes, so an error found halfway through used to exit 1
 * over a directory holding most of an atlas set and no manifest, and
 * `publicDir: 'assets/dist'` let the very next `make build` copy that half-built
 * tree into `dist/` and ship it with no manifest to weigh it against.
 *
 * THE BUG WAS THE ORDERING, NOT THE WIPE. An INPUT error - a source under a
 * directory that is not a level id, which is what happens whenever art lands a
 * level's sources before its level document exists - is found before a single
 * byte has been written, and the wipe had already run. One untracked directory
 * emptied `assets/dist/`, left no manifest, no atlas and no layer images, and
 * took a playable build down over a condition that should have failed the build
 * and left the last good output alone.
 *
 * Both properties are achievable together and this is how:
 *
 *   - inputs are validated before anything is staged, and an input error
 *     touches `assets/dist/` not at all;
 *   - the build writes to a temp directory OUTSIDE the repository, so a run
 *     that is killed leaves nothing behind for `publicDir` to find - staging
 *     inside `assets/dist/` would be invisible to the payload gate, whose
 *     stray-file scan reads files at that root and not directories;
 *   - the budget gates run against the staged tree, so output that fails a
 *     budget is discarded before it can replace anything;
 *   - promotion writes the MANIFEST LAST. If promotion is interrupted, what is
 *     left is a tree with no manifest, which `make check-assets` fails on
 *     loudly. That is the same protection the wipe was giving, without spending
 *     the previous good build to get it.
 */
const STAGE_DIR = mkdtempSync(join(tmpdir(), 'truenorth-assets-'));

function emit(path, buffer, entry) {
  const full = join(STAGE_DIR, ...path.split('/'));
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, buffer);
  files.push({ path, bytes: buffer.length, ...entry });
}

/** Throw the staged build away. `assets/dist/` is not touched. */
function discard() {
  rmSync(STAGE_DIR, { recursive: true, force: true });
}

// Any exit path at all, including a throw or a signal-free crash, takes the
// temp directory with it. A staging directory that outlives its run is the one
// way this design could leak, so it is closed here rather than at each site.
process.on('exit', discard);

/** Replace assets/dist's outputs with the staged ones. Manifest last. */
function promote() {
  for (const dir of OUTPUT_DIRS) rmSync(join(DIST_DIR, dir), { recursive: true, force: true });
  rmSync(join(DIST_DIR, MANIFEST_NAME), { force: true });
  mkdirSync(DIST_DIR, { recursive: true });
  for (const dir of OUTPUT_DIRS) {
    const from = join(STAGE_DIR, dir);
    if (existsSync(from)) cpSync(from, join(DIST_DIR, dir), { recursive: true });
  }
  cpSync(join(STAGE_DIR, MANIFEST_NAME), join(DIST_DIR, MANIFEST_NAME));
  discard();
}

// -------------------------------------------------------------------- main ---

const sources = walk(join(SRC_DIR, 'svg'), ['.svg'])
  .map((file) => ({ file, ...(assign(file, join(SRC_DIR, 'svg')) ?? {}) }))
  .filter((s) => s.owner !== undefined);

const riveSources = walk(join(SRC_DIR, 'rive'), ['.riv'])
  .map((file) => ({ file, ...(assign(file, join(SRC_DIR, 'rive')) ?? {}) }))
  .filter((s) => s.owner !== undefined);

const seen = new Map();
for (const source of [...sources, ...riveSources]) {
  const previous = seen.get(source.key);
  if (previous !== undefined) {
    fatal(`${rel(source.file)} and ${rel(previous)} both produce the texture key "${source.key}".`);
  }
  seen.set(source.key, source.file);
}

/**
 * THE PALETTE LINT, over the SOURCE TREE and not over the sources this build
 * could charge to a level.
 *
 * `assets/style/palette.json` is the allow-list for every fill and stroke, said
 * so in the art bible and in CLAUDE.md, and had no gate: this script rasterised
 * all 80 sources without ever opening the palette (OQ-ART-11). It runs here,
 * with the other input validation, because an off-palette fill is a defect in
 * the SOURCE and nothing downstream of rasterising can see it.
 *
 * It walks `assets/src/svg` itself rather than iterating `sources`, and the
 * difference is the point: `sources` has already dropped every file whose
 * owning level could not be worked out. Linting that list would leave art
 * staged ahead of its level document -- the exact state this repository is in
 * whenever a level lands -- unlinted, while printing the same summary.
 */
const palette = lintPalette({ root: ROOT });
for (const failure of palette.failures) fatal(failure);
// Reported BEFORE the input-validation exit below, because the palette verdict
// does not depend on whether every source could be charged to a level. Art
// staged ahead of its level document fails that check and is still linted, and
// saying so is the difference between "the palette held" and "the palette was
// not reached". `report()` on the next lines would otherwise swallow it.
if (palette.failures.length === 0) console.log(`palette: OK - ${palette.summary}.`);

// Input validation, before anything is staged and long before anything in
// assets/dist is touched. This is the line the ordering defect was on.
if (errors.length > 0) report();

let atlasPages = 0;
let standalone = 0;

/**
 * owner -> scale -> [{ key, png, width, height }]
 *
 * Rasterise every scale of a source before deciding where it goes, because a
 * key must not be an atlas frame at 1x and a standalone image at 2x: the loader
 * would need a different code path per scale for the same texture key. A source
 * that will not fit a page at ANY scale is standalone at every scale.
 */
const packable = new Map();

for (const { file, owner, key, pin } of sources) {
  const svg = readFileSync(file);
  const wanted = scalesFor(key, pin);
  const rasters = [];
  for (const scale of wanted) {
    try {
      // density scales the vector render itself; resizing a 1x bitmap to 2x
      // would ship a blurred upscale and call it a retina asset.
      const png = await sharp(svg, { density: 72 * scale }).png({ compressionLevel: 6 }).toBuffer();
      const meta = await sharp(png).metadata();
      rasters.push({ scale, png, width: meta.width, height: meta.height });
    } catch (error) {
      fatal(`${rel(file)} could not be rasterised at ${scale}x (${error.message}).`);
    }
  }
  if (rasters.length !== wanted.length) continue;

  const room = ATLAS_MAX_PX - 2 * (ATLAS_PADDING + ATLAS_EXTRUDE);
  // A layer is never atlased even when it would fit: an atlas page mixing a
  // full-screen layer with props would have no single role, and the 1x rule is
  // applied per file. The cost is one extra texture unit for a small layer,
  // which is nothing next to a rule that cannot be evaluated.
  const fitsEveryScale = rasters.every((r) => r.width <= room && r.height <= room);

  if (fitsEveryScale && !mustStandAlone(key, pin)) {
    if (!packable.has(owner)) packable.set(owner, new Map());
    for (const r of rasters) {
      const bucket = packable.get(owner);
      if (!bucket.has(r.scale)) bucket.set(r.scale, []);
      bucket.get(r.scale).push({ key, png: r.png, width: r.width, height: r.height });
    }
    continue;
  }

  for (const r of rasters) {
    if (r.width > STANDALONE_MAX_PX || r.height > STANDALONE_MAX_PX) {
      const authorable = STANDALONE_MAX_PX / Math.max(...wanted);
      fatal(
        `${rel(file)} rasterises to ${r.width}x${r.height} at ${r.scale}x, over the ` +
          `${STANDALONE_MAX_PX} px texture cap, and would cost ${mib(r.width * r.height * 4)} of ` +
          'decoded texture memory on its own. Author it at most ' +
          `${authorable} px on its longest side (${r.width / r.scale}x${r.height / r.scale} now), ` +
          'or split it into tiles that repeat — a parallax layer tiles at the seam anyway ' +
          '(art-bible 6), so a wide layer does not need to be one texture.',
      );
      continue;
    }
    const webp = await sharp(r.png).webp({ lossless: true, effort: 6 }).toBuffer();
    standalone += 1;
    emit(`img/${key}@${r.scale}x.${hash8(webp)}.webp`, webp, {
      kind: 'image',
      role: roleOf(key),
      // The variant group: the files that are the same texture at different
      // scales. A device loads one variant per group, which is how
      // texture-memory.mjs works out what it holds at once now that layers and
      // props no longer ship at the same scale.
      group: `img:${key}`,
      // What the source asked for, or null. Recorded so a reader of the
      // manifest can tell "1x because it is a layer" from "1x because the
      // author said so", and so the gate can check the pin was honoured.
      scalePin: pin,
      scale: r.scale,
      width: r.width,
      height: r.height,
      decodedBytes: r.width * r.height * BYTES_PER_PIXEL,
      levels: chargedTo(owner),
      keys: [key],
    });
  }
}

for (const [owner, byScale] of [...packable.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  for (const [scale, sprites] of [...byScale.entries()].sort((a, b) => a[0] - b[0])) {
    const textureName = `${owner}@${scale}x`;
    const packed = await packAsync(
      sprites.map((s) => ({ path: `${s.key}.png`, contents: s.png })),
      {
        textureName,
        width: ATLAS_MAX_PX,
        height: ATLAS_MAX_PX,
        fixedSize: false,
        powerOfTwo: false,
        padding: ATLAS_PADDING,
        extrude: ATLAS_EXTRUDE,
        allowRotation: false,
        allowTrim: true,
        trimMode: 'trim',
        detectIdentical: true,
        removeFileExtension: true,
        prependFolderName: false,
        textureFormat: 'png',
        exporter: 'Phaser3',
      },
    );

    /** page name (no extension) -> { image, data } */
    const pages = new Map();
    for (const out of packed) {
      const page = basename(out.name, extname(out.name));
      if (!pages.has(page)) pages.set(page, {});
      pages.get(page)[out.name.endsWith('.json') ? 'data' : 'image'] = out.buffer;
    }

    // The page ordinal makes the variant group: page 0 of ottawa's atlas at 1x
    // and page 0 at 2x are the same texture at two scales. If a scale needs more
    // pages than another, the extra page has no counterpart and the decoded gate
    // charges the only variant there is — an over-count, which is the safe
    // direction for a memory budget to be wrong in.
    for (const [ordinal, [page, { image, data }]] of [...pages.entries()].sort().entries()) {
      if (image === undefined || data === undefined) {
        fatal(`the packer returned an incomplete atlas page "${page}" for ${owner} at ${scale}x.`);
        continue;
      }

      const webp = await sharp(image).webp({ lossless: true, effort: 6 }).toBuffer();
      const meta = await sharp(webp).metadata();
      if (meta.width > ATLAS_MAX_PX || meta.height > ATLAS_MAX_PX) {
        fatal(
          `atlas page ${page} is ${meta.width}x${meta.height}, over the ${ATLAS_MAX_PX} px cap ` +
            '(art-bible 9). The packer was asked for a smaller page and did not deliver one.',
        );
        continue;
      }

      const imagePath = `atlas/${page}.${hash8(webp)}.webp`;
      // The atlas data names its own texture, and the texture's name is not
      // known until it is hashed, so the reference is rewritten rather than
      // templated.
      const json = JSON.parse(data.toString('utf8'));
      json.textures[0].image = basename(imagePath);
      const dataBuffer = Buffer.from(`${JSON.stringify(json, null, 2)}\n`, 'utf8');
      const frameKeys = json.textures[0].frames.map((f) => f.filename).sort();

      atlasPages += 1;
      emit(imagePath, webp, {
        kind: 'atlas',
        // Layers never reach an atlas (see isFullScreenLayer), so a page is
        // always props; texture-memory.mjs checks that claim against
        // content/levels/ rather than taking it.
        role: 'sprite',
        // Always null: a pinned source never reaches an atlas (mustStandAlone).
        scalePin: null,
        group: `atlas:${owner}:${ordinal}`,
        scale,
        width: meta.width,
        height: meta.height,
        decodedBytes: meta.width * meta.height * BYTES_PER_PIXEL,
        levels: chargedTo(owner),
        keys: frameKeys,
      });
      emit(`atlas/${page}.${hash8(dataBuffer)}.json`, dataBuffer, {
        kind: 'atlas-data',
        role: 'sprite',
        scalePin: null,
        group: `atlas-data:${owner}:${ordinal}`,
        scale,
        // Frame coordinates, not pixels: this file costs bytes over the wire and
        // nothing on the GPU.
        decodedBytes: 0,
        levels: chargedTo(owner),
        keys: [],
        atlas: imagePath,
      });
    }
  }
}

for (const { file, owner, key, pin } of riveSources) {
  if (pin !== null) {
    // Not a harmless no-op to ignore: a Rive artboard is vector and renders to a
    // surface sized by the display, so "@1x" on one is an instruction that
    // cannot be carried out, and silently dropping it would leave the author
    // believing something was pinned.
    fatal(`${rel(file)} is a Rive file pinned "@1x". A Rive artboard is resolution-independent; it has no raster scale to pin.`);
    continue;
  }
  const buffer = readFileSync(file);
  emit(`rive/${key}.${hash8(buffer)}.riv`, buffer, {
    kind: 'rive',
    role: roleOf(key),
    scalePin: null,
    group: `rive:${key}`,
    // Rive artboards are vector and resolution-independent: one file serves
    // both scales, so it is charged once rather than to a scale bucket.
    scale: null,
    // Not 0 because it is free — a Rive artboard renders to a canvas surface at
    // runtime — but because that surface is sized by the display, not by this
    // file, so no number derived from the file would be true. texture-memory.mjs
    // says the same thing about what its budget does and does not cover.
    decodedBytes: 0,
    levels: chargedTo(owner),
    keys: [key],
  });
}

// ---------------------------------------------------------------- manifest ---

files.sort((a, b) => a.path.localeCompare(b.path));

const levels = {};
for (const id of LEVELS) {
  const own = files.filter((f) => f.levels.includes(id));

  // One device downloads one variant of each texture. Charging 1x and 2x
  // together would halve the budget without saying so, and bucketing by scale
  // would lose the 1x-only layers out of the 2x bucket, so it is one variant per
  // group per device scale, worst device wins.
  const worst = worstDeviceScale(resolveByDeviceScale(own, SCALES, (f) => f.bytes));

  // Decoded memory is a different sum over the same files, and it has to be:
  // full-screen layers ship at 1x while props ship at 2x, so a 2x device HOLDS a
  // mixture of scales and no per-scale bucket describes it. One variant per
  // group, per device scale — the same function the gate re-runs.
  const decodedByScale = decodedByDeviceScale(own, SCALES);
  const decodedTextureBytes = worstDeviceScale(decodedByScale);

  if (own.length > 0) {
    levels[id] = {
      payloadBytes: worst,
      decodedTextureBytes,
      decodedByScale: Object.fromEntries(decodedByScale.map(([scale, bytes]) => [String(scale), bytes])),
    };
  }
}

if (errors.length > 0) report();

writeFileSync(
  join(STAGE_DIR, MANIFEST_NAME),
  `${JSON.stringify(
    { version: MANIFEST_VERSION, generator: 'scripts/assets.mjs', atlasMaxPx: ATLAS_MAX_PX, scales: SCALES, outputDirs: OUTPUT_DIRS, levels, files },
    null,
    2,
  )}\n`,
  'utf8',
);

const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0);
const layerFiles = files.filter((f) => f.role === 'layer').length;
const pinnedFiles = files.filter((f) => f.scalePin !== null && f.scalePin !== undefined).length;
console.log(
  `assets: ${sources.length} SVG + ${riveSources.length} Rive source(s) -> ${files.length} file(s) ` +
    `in assets/dist (${atlasPages} atlas page(s) <= ${ATLAS_MAX_PX} px, ${standalone} standalone image(s), ` +
    `${layerFiles} full-screen layer file(s) at 1x only, ` +
    `${pinnedFiles} source-pinned file(s)), ` +
    `${SCALES.map((s) => `${s}x`).join(' + ')}, ${mib(totalBytes)} on disk across ` +
    `${Object.keys(levels).length} level(s).`,
);

// ------------------------------------------------------------------- gate ---

/**
 * The build is not finished until BOTH budgets have been checked. Running them
 * in process rather than shelling out keeps one exit code and one report, and
 * the same functions are what scripts/check-level-payload.mjs,
 * scripts/check-texture-memory.mjs and deploy-check.mjs call, so there is one
 * implementation of each rule and not three.
 *
 * Both run before either can reject the build, so a tree that breaks both is
 * reported once with both reasons rather than twice with one each.
 */
// Weighed in the staging tree, and NAMED as assets/dist because that is where it
// is going and where a reader will look for it. Nothing has been promoted yet,
// so a build that fails a budget is discarded rather than shipped - and, unlike
// before, the previous good output is still there.
const payload = checkLevelPayload({ root: ROOT, dir: STAGE_DIR, scanRoot: true, source: 'assets/dist' });
const textures = checkTextureMemory({ root: ROOT, dir: STAGE_DIR, source: 'assets/dist' });

if (payload.failures.length > 0 || textures.failures.length > 0) {
  discard();
  for (const [name, result] of [['level-payload', payload], ['texture-memory', textures]]) {
    if (result.failures.length === 0) {
      // Say so explicitly. "It printed nothing" must not be readable as "it did
      // not run", which is the state both of these gates were in for a slice.
      console.error(`${name}: passed`);
      continue;
    }
    console.error(`${name}: FAILED`);
    for (const failure of result.failures) console.error(`  - ${failure}`);
    console.error(`${name}: ${result.failures.length} failure(s).`);
  }
  console.error('assets: build rejected.');
  process.exit(1);
}

// The only place assets/dist is written. Everything above this line is either
// validation or a staged build in a temp directory.
promote();

console.log(`level-payload: OK - ${payload.summary}`);
console.log(`texture-memory: OK - ${textures.summary}`);

/**
 * Print the errors and stop, discarding the staged build and leaving
 * `assets/dist/` exactly as it was.
 *
 * A failed build must leave nothing HALF-BUILT behind; it must not also destroy
 * a complete build that was there before it. Those were conflated, and the cost
 * was that an input error - reached before a single byte is written - emptied
 * `assets/dist/` and took the playable build with it. What ships is either the
 * previous complete set with its manifest, or nothing at all in a fresh
 * checkout. Neither is a half-built tree, which is what the rule was for.
 */
function report() {
  discard();
  console.error('assets: FAILED');
  for (const error of errors) console.error(`  - ${error}`);
  console.error(`assets: ${errors.length} error(s).`);
  process.exit(1);
}
