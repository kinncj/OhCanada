/**
 * The per-level payload gate.
 *
 * `budgets.levelPayloadBytes` (8 MiB) has sat in content/game.config.json since
 * slice 0, is *required* by game.config.schema.json, and until this file existed
 * no code anywhere read it. The only other mention was a comment in
 * deploy-check.mjs calling it "a different gate" — a gate that did not exist. It
 * read as enforced because it appeared in the config and in the schema, which is
 * the slice-0 vacuum one turn worse: the vacuous coverage gate at least printed a
 * misleading number, and this one printed nothing at all.
 *
 * It could not be closed before the asset pipeline landed, because "which bytes
 * belong to which level" is a question only `assets/dist/manifest.json` can
 * answer. So it is written *with* scripts/assets.mjs (slice 1, task 1.10), not
 * after it, and `make assets` runs it on every build.
 *
 * WHAT IT CHECKS, and why each one is here rather than assumed:
 *
 *  1. The budget itself is a positive number in the config. A gate that reads a
 *     missing budget as "unlimited" is the vacuum with extra steps.
 *  2. The manifest parses, is the version this gate understands, and declares at
 *     least one level. ANTI-VACUUM FLOOR: zero levels is a failure, not a pass.
 *     "Found nothing" is exactly the state that let the credit gate pass for a
 *     whole slice.
 *  3. Every file the manifest lists exists on disk and its recorded size equals
 *     its real size. A manifest is a claim about bytes; unchecked, a level can
 *     go over budget by editing a number.
 *  4. Every file inside the manifest's own output directories is claimed by at
 *     least one level. Set equality in both directions, the same discipline the
 *     credit gate uses: an unclaimed file is payload nobody is measuring.
 *  5. The manifest's own arithmetic agrees with the gate's recomputation from
 *     disk. The gate never trusts a total it did not add up itself.
 *  6. Per level, payload <= budgets.levelPayloadBytes.
 *  7. Every level document under content/levels/ appears in the manifest, and
 *     every art key it references (layer keys, POI artKeys) is provided by a
 *     file charged to that level. This is what stops "zero levels" from being
 *     satisfiable by deleting sources: a level that ships no art fails by name.
 *  8. When a level document declares `assets[]`, every url resolves to a
 *     manifest file and every `bytes` matches.
 *
 * HOW A LEVEL'S PAYLOAD IS ADDED UP
 *
 * A device downloads ONE variant of each texture, so charging both scales would
 * double-count and make the 8 MiB budget mean 4. It used to be enough to say
 * "the worst single scale, plus the scale-independent files", and that stopped
 * being true when full-screen parallax layers were pinned to 1x: a phone at 2x
 * downloads the 2x props AND the 1x layers, because there is no 2x layer to
 * download, and a per-scale bucket loses the layers entirely — on Ottawa, most
 * of the level. The sum is now one variant per `group` per device scale, worst
 * device wins, via ./variant-scales.mjs, which is the same resolution
 * ./texture-memory.mjs applies to decoded bytes. Every device scale is printed,
 * so the number is arguable rather than magic. A file owned by `shared/` is
 * charged to EVERY level, because every level downloads it.
 *
 * `decodedBytes` is recorded per file and is NOT enforced here. It has landed:
 * scripts/lib/texture-memory.mjs is the decoded-texture gate (CLAUDE.md, 64 MB
 * per level; `textureBudgetBytes` per level document), it runs beside this one
 * in `make assets`, and it adds bytes up differently on purpose — a device
 * downloads one scale but HOLDS a mixture of them, because full-screen parallax
 * layers ship at 1x while props ship at 2x. Two budgets, two sums, two files.
 * Neither is a substitute for the other: a level can fit 8 MiB over the wire and
 * still cost 130 MB of VRAM, which is how this project's predecessor lost a
 * WebGL context.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { resolveByDeviceScale, worstDeviceScale } from './variant-scales.mjs';

export const MANIFEST_NAME = 'manifest.json';
/**
 * Bumped to 2 when `role` and `group` joined every file entry: the
 * decoded-texture gate cannot work without them, and a version-1 manifest is
 * exactly the manifest that would pass it by omitting `decodedBytes`. Both gates
 * hard-stop on a version they do not recognise rather than degrading.
 */
export const MANIFEST_VERSION = 2;

/** Files allowed to sit at the root of assets/dist without being payload. */
const ROOT_EXEMPT = new Set([MANIFEST_NAME, '.gitkeep', '.gitignore', '.DS_Store']);

export const mib = (b) => `${(b / 1024 / 1024).toFixed(2)} MiB`;

/** Every file under `dir`, as posix paths relative to `dir`, sorted. */
function walk(dir, base = dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else if (entry.isFile()) out.push(relative(base, full).split(sep).join('/'));
  }
  return out.sort();
}

function readJson(file) {
  try {
    return { ok: true, value: JSON.parse(readFileSync(file, 'utf8')) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * Level documents, as `{ id, file, keys, assets, textureBudgetBytes }`.
 *
 * Exported because scripts/lib/texture-memory.mjs needs the same three things
 * out of the same files — which keys are drawn as full-screen layers, what each
 * level declares as its texture budget, and what its preload manifest claims.
 * Two readers of content/levels/ would be two chances to disagree about what a
 * level says.
 */
export function readLevelDocuments(root, fail) {
  const dir = join(root, 'content', 'levels');
  if (!existsSync(dir)) return [];
  const docs = [];
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith('.json')) continue;
    const parsed = readJson(join(dir, name));
    if (!parsed.ok) {
      fail(`content/levels/${name} is not valid JSON (${parsed.error}); its assets cannot be checked.`);
      continue;
    }
    const doc = parsed.value;
    if (typeof doc?.id !== 'string' || doc.id.length === 0) {
      fail(`content/levels/${name} has no string "id"; its assets cannot be charged to a level.`);
      continue;
    }
    docs.push({
      id: doc.id,
      file: `content/levels/${name}`,
      keys: [
        ...(Array.isArray(doc.layers) ? doc.layers : []).map((l) => ({ key: l?.key, where: 'layers[].key' })),
        ...(Array.isArray(doc.pois) ? doc.pois : []).map((p) => ({ key: p?.artKey, where: 'pois[].artKey' })),
      ].filter((k) => typeof k.key === 'string' && k.key.length > 0),
      assets: Array.isArray(doc.assets) ? doc.assets : [],
      // Raw, not validated here: the texture gate owns the rules for it and
      // says so by name when it is missing or impossible.
      textureBudgetBytes: doc.textureBudgetBytes,
    });
  }
  return docs;
}

/** Strip a leading site base or slash from a level document's asset url. */
function normaliseUrl(url, basePath) {
  let u = String(url).split('#')[0].split('?')[0];
  if (basePath && basePath !== '/' && u.startsWith(basePath)) u = u.slice(basePath.length);
  return u.replace(/^\.?\//, '');
}

/**
 * Check the manifest in `dir` against the files on disk, the budget in
 * `root`'s game.config.json and the level documents under `root/content/levels`.
 *
 * `scanRoot` is true for assets/dist, where a stray file at the root is a file
 * the pipeline did not emit and nobody is measuring. It is false for dist/,
 * whose root is full of Vite's output and none of this gate's business — the
 * manifest's own output directories are still walked in both modes, so nothing
 * about the *payload* goes unchecked either way.
 */
export function checkLevelPayload({ root, dir, scanRoot = true, source = 'assets/dist' }) {
  const failures = [];
  const fail = (message) => failures.push(message);

  // ------------------------------------------------------------- budget ---
  const configFile = join(root, 'content', 'game.config.json');
  let budget = null;
  let basePath = '/';
  if (!existsSync(configFile)) {
    fail('content/game.config.json is missing; budgets.levelPayloadBytes cannot be read.');
  } else {
    const parsed = readJson(configFile);
    if (!parsed.ok) {
      fail(`content/game.config.json is not valid JSON (${parsed.error}).`);
    } else {
      const value = parsed.value?.budgets?.levelPayloadBytes;
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        fail(
          'content/game.config.json has no positive numeric "budgets.levelPayloadBytes"; ' +
            'the per-level payload budget cannot be enforced. It is required by ' +
            'game.config.schema.json, so this means the config was edited past its schema.',
        );
      } else {
        budget = value;
      }
      if (typeof parsed.value?.basePath === 'string') basePath = parsed.value.basePath;
    }
  }

  // ----------------------------------------------------------- manifest ---
  const manifestFile = join(dir, MANIFEST_NAME);
  if (!existsSync(manifestFile)) {
    fail(
      `${source}/${MANIFEST_NAME} is missing. \`make assets\` writes it; without it nothing ` +
        'maps files to levels and the per-level payload budget cannot be enforced.',
    );
    return { failures, summary: null, levels: [] };
  }
  const parsedManifest = readJson(manifestFile);
  if (!parsedManifest.ok) {
    fail(`${source}/${MANIFEST_NAME} is not valid JSON (${parsedManifest.error}).`);
    return { failures, summary: null, levels: [] };
  }
  const manifest = parsedManifest.value;

  if (manifest?.version !== MANIFEST_VERSION) {
    fail(
      `${source}/${MANIFEST_NAME} declares version ${JSON.stringify(manifest?.version)}; ` +
        `this gate understands version ${MANIFEST_VERSION} only. Rebuild with \`make assets\`.`,
    );
    return { failures, summary: null, levels: [] };
  }

  const files = Array.isArray(manifest.files) ? manifest.files : null;
  const levels = manifest.levels && typeof manifest.levels === 'object' ? manifest.levels : null;
  const outputDirs = Array.isArray(manifest.outputDirs) ? manifest.outputDirs : null;
  if (files === null) fail(`${source}/${MANIFEST_NAME} has no "files" array.`);
  if (levels === null) fail(`${source}/${MANIFEST_NAME} has no "levels" object.`);
  if (outputDirs === null) fail(`${source}/${MANIFEST_NAME} has no "outputDirs" array.`);
  if (files === null || levels === null || outputDirs === null) {
    return { failures, summary: null, levels: [] };
  }

  const levelIds = Object.keys(levels).sort();

  /**
   * ANTI-VACUUM FLOOR. Nothing below this line can fail when the manifest
   * describes no levels, so "described nothing" has to be the failure itself.
   * The credit gate reported success over an empty directory for a whole slice;
   * this gate does not get to repeat it.
   */
  if (levelIds.length === 0) {
    fail(
      `${source}/${MANIFEST_NAME} maps files to 0 level(s) — the per-level payload budget has ` +
        'nothing to measure. Either assets/src holds no sources, or the pipeline stopped ' +
        'assigning files to levels. Do not read this as "every level is under budget".',
    );
  }

  // ------------------------------------------------- files against disk ---
  const claimed = new Map(); // path -> { bytes, scale, levels[], keys[] }
  files.forEach((entry, index) => {
    const where = `${source}/${MANIFEST_NAME} files[${index}]`;
    const path = entry?.path;
    if (typeof path !== 'string' || path.length === 0) {
      fail(`${where} has no "path".`);
      return;
    }
    if (path.startsWith('/') || path.includes('..') || path.includes('\\')) {
      fail(`${where} "${path}" is not a relative posix path inside ${source}.`);
      return;
    }
    if (claimed.has(path)) {
      fail(`${where} "${path}" is listed twice.`);
      return;
    }
    const top = path.split('/')[0];
    if (!outputDirs.includes(top)) {
      fail(
        `${where} "${path}" is outside the manifest's own outputDirs ` +
          `(${outputDirs.join(', ')}), so the orphan walk would never see it.`,
      );
      return;
    }

    const full = join(dir, ...path.split('/'));
    if (!existsSync(full) || !statSync(full).isFile()) {
      fail(`${where} lists ${source}/${path}, which does not exist on disk.`);
      return;
    }
    const actual = statSync(full).size;
    if (typeof entry.bytes !== 'number' || entry.bytes !== actual) {
      fail(
        `${where} records ${JSON.stringify(entry.bytes)} bytes for ${source}/${path}, ` +
          `which is ${actual} B on disk.`,
      );
      return;
    }

    const owners = Array.isArray(entry.levels) ? entry.levels : [];
    if (owners.length === 0) {
      fail(
        `${where} ${source}/${path} is claimed by no level; it would ship without ever being ` +
          'charged to a payload budget.',
      );
      return;
    }
    for (const owner of owners) {
      if (!levelIds.includes(owner)) {
        fail(`${where} ${source}/${path} is charged to level "${owner}", which the manifest does not declare.`);
        return;
      }
    }

    claimed.set(path, {
      path,
      bytes: actual,
      scale: typeof entry.scale === 'number' ? entry.scale : null,
      // Falls back to the path, which makes an ungrouped file its own group and
      // therefore always downloaded. Over-counting is the safe direction for a
      // payload budget; ./texture-memory.mjs is where a missing `group` is a
      // hard failure.
      group: typeof entry.group === 'string' && entry.group.length > 0 ? entry.group : path,
      levels: owners,
      keys: Array.isArray(entry.keys) ? entry.keys : [],
    });
  });

  // ---------------------------------------------------- orphans on disk ---
  const onDisk = new Set();
  for (const outputDir of outputDirs) {
    for (const path of walk(join(dir, outputDir))) onDisk.add(`${outputDir}/${path}`);
  }
  if (scanRoot) {
    for (const entry of existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : []) {
      if (entry.isFile() && !ROOT_EXEMPT.has(entry.name)) onDisk.add(entry.name);
    }
  }
  for (const path of [...onDisk].sort()) {
    if (!claimed.has(path)) {
      fail(
        `${source}/${path} is on disk but no level claims it. Every shipped file is somebody's ` +
          "payload; a file nobody claims is weight the budget never sees. Rebuild with " +
          '`make assets`, or delete it.',
      );
    }
  }

  // --------------------------------------------------- per-level totals ---
  const scales = Array.isArray(manifest.scales)
    ? manifest.scales.filter((s) => typeof s === 'number' && s > 0)
    : [];
  if (scales.length === 0) {
    fail(
      `${source}/${MANIFEST_NAME} declares no "scales"; without the device scales the pipeline built ` +
        'for, there is no way to say which variant of each texture a device downloads.',
    );
  }

  const report = [];
  for (const id of levelIds) {
    const own = [...claimed.values()].filter((f) => f.levels.includes(id));
    const perScale = resolveByDeviceScale(own, scales, (f) => f.bytes);
    const payload = worstDeviceScale(perScale);
    const scaleless = own.filter((f) => f.scale === null).reduce((sum, f) => sum + f.bytes, 0);

    const declared = levels[id];
    if (declared === null || typeof declared !== 'object') {
      fail(`${source}/${MANIFEST_NAME} levels["${id}"] is not an object.`);
      continue;
    }
    if (declared.payloadBytes !== payload) {
      fail(
        `${source}/${MANIFEST_NAME} levels["${id}"] records payloadBytes ` +
          `${JSON.stringify(declared.payloadBytes)}, but the files on disk charged to "${id}" ` +
          `add up to ${payload} B. The manifest's own arithmetic does not hold.`,
      );
    }

    report.push({
      id,
      payload,
      scaleless,
      fileCount: own.length,
      perScale,
      largest: own
        .slice()
        .sort((a, b) => b.bytes - a.bytes)
        .slice(0, 3)
        .map((f) => ({ path: f.path, bytes: f.bytes })),
      keys: new Set(own.flatMap((f) => f.keys)),
    });

    if (budget !== null && payload > budget) {
      fail(
        `level "${id}" ships ${mib(payload)} (${payload} B); the budget is ${mib(budget)} ` +
          `(${budget} B), so it is ${payload - budget} B over. Largest: ` +
          report[report.length - 1].largest.map((f) => `${f.path} ${mib(f.bytes)}`).join(', ') +
          '. Cut the art, drop a layer, or change budgets.levelPayloadBytes in an ADR.',
      );
    }
  }

  // ----------------------------------------- level documents vs manifest ---
  const byId = new Map(report.map((r) => [r.id, r]));
  for (const doc of readLevelDocuments(root, fail)) {
    const entry = byId.get(doc.id);
    if (entry === undefined) {
      fail(
        `${doc.file} declares level "${doc.id}" but ${source}/${MANIFEST_NAME} charges no file to ` +
          'it: the level ships no art at all. Either assets/src holds no sources for it, or the ' +
          "pipeline could not work out which level they belong to.",
      );
      continue;
    }
    for (const { key, where } of doc.keys) {
      if (!entry.keys.has(key)) {
        fail(
          `${doc.file} ${where} "${key}" is not provided by any file charged to level "${doc.id}". ` +
            'A level must load from its JSON alone; a key with no texture is a level that cannot.',
        );
      }
    }
    doc.assets.forEach((asset, index) => {
      if (typeof asset?.url !== 'string') return;
      const path = normaliseUrl(asset.url, basePath);
      const file = claimed.get(path);
      if (file === undefined) {
        fail(`${doc.file} assets[${index}].url "${asset.url}" resolves to "${path}", which the manifest does not list.`);
        return;
      }
      if (typeof asset.bytes === 'number' && asset.bytes !== file.bytes) {
        fail(
          `${doc.file} assets[${index}] declares ${asset.bytes} B for "${asset.url}", ` +
            `which is ${file.bytes} B on disk.`,
        );
      }
    });
  }

  if (failures.length > 0) return { failures, summary: null, levels: report };

  const perLevel = report
    .map((r) => {
      const devices = r.perScale.map(([s, b]) => `${s}x device ${mib(b)}`).join(' / ');
      const extra = r.scaleless > 0 ? `, incl. ${mib(r.scaleless)} scale-independent` : '';
      return `${r.id} ${mib(r.payload)} over ${r.fileCount} file(s) [${devices}${extra}]`;
    })
    .join('; ');

  const summary =
    `${report.length} level(s) against ${mib(budget)} each — ${perLevel}. ` +
    `${claimed.size} file(s) in ${source}, all claimed.`;

  return { failures, summary, levels: report };
}
