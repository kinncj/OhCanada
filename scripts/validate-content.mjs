#!/usr/bin/env node
/**
 * validate-content — the content gate (slice 0, task 0.9).
 *
 * 1. Loads every JSON Schema under content/schemas/.
 * 2. Validates every .json under content/, plus the documents in
 *    EXTERNAL_DATA_FILES, against the schema its own `$schema` names. A file
 *    without `$schema` is a failure. Schemas use `additionalProperties: false`,
 *    so unknown properties fail.
 * 3. Checks EN/FR key parity for content/locales/<locale>/*.json.
 * 4. Checks that every asset file under assets/ is credited in
 *    assets/credits.json, and that every credit entry points at a file that
 *    exists (ADR-0004). Both directions; see the section for what counts as an
 *    asset and why the exclusions are the shape they are.
 * 5. Cross-checks assets/style/palette.json's own referential integrity: every
 *    ramp tone and ink names a colour that exists. A JSON Schema can say "these
 *    are ids"; it cannot say "this id is in that table", and 97 colours in 31
 *    ramps is exactly the file where that distinction bites.
 *
 * Exits non-zero and lists every failure. Prints a one-line summary.
 *
 * `--root <dir>` runs the whole gate over another tree. It exists so the tests
 * in tests/unit/infra/credit-gate.test.ts can drive the real CLI over scratch
 * copies -- an uncredited file, a dangling credit, an empty assets/ -- rather
 * than re-implementing the rules and proving only that the copy agrees with
 * itself. Nothing in CI passes it.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const argv = process.argv.slice(2);
const rootFlag = argv.indexOf('--root');
if (rootFlag !== -1 && argv[rootFlag + 1] === undefined) {
  console.error('validate-content: --root needs a directory');
  process.exit(2);
}

const ROOT =
  rootFlag === -1 ? fileURLToPath(new URL('..', import.meta.url)) : resolve(argv[rootFlag + 1]);

/**
 * ADR-0024: zero is legal only when a caller declares it legal. The
 * content-document floor below is the repository's floor, and the fixtures in
 * `tests/unit/infra/**` deliberately build minimal trees to exercise ONE
 * section of this gate -- the palette rules, the credit rules -- over a tree
 * that legitimately has no questions or levels in it. They pass this flag, at
 * the call site, where a reader sees the waiver. Nothing else may.
 */
const ALLOW_EMPTY_CONTENT = argv.includes('--allow-empty-content');
const CONTENT_DIR = join(ROOT, 'content');
const SCHEMA_DIR = join(CONTENT_DIR, 'schemas');
const CREDITS_FILE = join(ROOT, 'assets', 'credits.json');
const PALETTE_FILE = join(ROOT, 'assets', 'style', 'palette.json');

/**
 * Documents that are schema-checked but do not live under content/.
 *
 * Listed one by one, deliberately, and each one is REQUIRED to exist. The
 * alternative -- widening the walk to all of assets/ -- would drag every atlas,
 * every Rive export and every reference photograph through schema resolution to
 * find two files, and would make "is this validated?" depend on a file
 * extension rather than on a decision somebody made.
 *
 * `assets/style/palette.json` was added on 2026-09-08, when the architect found
 * that content/schemas/palette.schema.json validated NOTHING: the palette is not
 * under content/, so the schema walk never reached it, and it is (correctly) in
 * NON_ASSET_PATHS below, so the credit walk skipped it too. A schema and a
 * document, named after each other, with nothing checking one against the other
 * -- ADR-0007's problem inverted, and it reads as enforced precisely because
 * both halves exist. The file is 97 colours in 31 ramps generated from a
 * published formula; the art agent's own checker caught six contradicting ramps
 * on its first pass. That is a file a schema should be holding.
 *
 * The palette stays at assets/style/palette.json. CLAUDE.md never named a
 * canonical palette path, so the earlier "it belongs under content/style/"
 * premise was wrong and content/style/ has been deleted.
 */
const EXTERNAL_DATA_FILES = [
  { file: CREDITS_FILE, why: 'the ADR-0004 credit register' },
  { file: PALETTE_FILE, why: 'the colour allow-list every SVG is linted against' },
];

const META_SCHEMA_PREFIXES = ['https://json-schema.org/', 'http://json-schema.org/'];

const failures = [];
const fail = (where, message) => failures.push(`${where}: ${message}`);

const rel = (absolute) => relative(ROOT, absolute).split(sep).join('/');

function walk(dir, predicate) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, predicate));
    else if (entry.isFile() && predicate(full)) out.push(full);
  }
  return out.sort();
}

function readJson(file) {
  try {
    return { ok: true, value: JSON.parse(readFileSync(file, 'utf8')) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ---------------------------------------------------------------- schemas ---

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  allowUnionTypes: true,
});
addFormats(ajv);

const schemaFiles = walk(SCHEMA_DIR, (f) => extname(f) === '.json');
/** absolute schema path -> { id, schema } */
const schemasByPath = new Map();
/** $id -> absolute schema path */
const schemaPathById = new Map();

for (const file of schemaFiles) {
  const parsed = readJson(file);
  if (!parsed.ok) {
    fail(rel(file), `invalid JSON (${parsed.error})`);
    continue;
  }
  const schema = parsed.value;
  const id = typeof schema.$id === 'string' ? schema.$id : pathToFileURL(file).href;
  try {
    ajv.addSchema(schema, id);
  } catch (error) {
    fail(rel(file), `schema rejected by ajv (${error.message})`);
    continue;
  }
  schemasByPath.set(file, { id, schema });
  schemaPathById.set(id, file);
}

function validatorFor(schemaPath) {
  const entry = schemasByPath.get(schemaPath);
  if (!entry) return null;
  try {
    return ajv.getSchema(entry.id) ?? ajv.compile(entry.schema);
  } catch (error) {
    fail(rel(schemaPath), `schema failed to compile (${error.message})`);
    return null;
  }
}

// ------------------------------------------------------------- data files ---

/**
 * ANTI-VACUUM FLOOR for the external list. A document that is simply absent
 * would otherwise be validated by nobody and reported by nobody -- which is the
 * exact state the palette was in before it joined this list. "It was not there"
 * is a failure, not a skip.
 */
for (const { file, why } of EXTERNAL_DATA_FILES) {
  if (!existsSync(file)) {
    fail(
      rel(file),
      `is missing. It is ${why} and this gate validates it against content/schemas/; ` +
        'a document that is not there is not a document that passed.',
    );
  }
}

/**
 * Kept separate from the two external documents on purpose. The anti-vacuum
 * floor below is about `content/` being empty, and `assets/credits.json` plus
 * `assets/style/palette.json` are always on this list — a floor on the combined
 * length can never reach zero, which is a floor that cannot fire.
 */
const contentDocuments = walk(
  CONTENT_DIR,
  (f) => extname(f) === '.json' && !f.startsWith(SCHEMA_DIR + sep),
);

const dataFiles = [
  ...contentDocuments,
  ...EXTERNAL_DATA_FILES.map((e) => e.file).filter((f) => existsSync(f)),
];

let validated = 0;

for (const file of dataFiles) {
  const parsed = readJson(file);
  if (!parsed.ok) {
    fail(rel(file), `invalid JSON (${parsed.error})`);
    continue;
  }
  const data = parsed.value;

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    fail(rel(file), 'content files must be a JSON object declaring "$schema"');
    continue;
  }
  const declared = data.$schema;
  if (typeof declared !== 'string' || declared.length === 0) {
    fail(rel(file), 'missing "$schema" (every content file must declare its schema)');
    continue;
  }
  if (META_SCHEMA_PREFIXES.some((p) => declared.startsWith(p))) {
    fail(rel(file), 'declares a JSON Schema meta-schema; it must name a schema in content/schemas/');
    continue;
  }

  const schemaPath = schemaPathById.has(declared)
    ? schemaPathById.get(declared)
    : resolve(dirname(file), declared);

  if (!schemasByPath.has(schemaPath)) {
    fail(rel(file), `"$schema" points at "${declared}", which is not a schema under content/schemas/`);
    continue;
  }

  const validate = validatorFor(schemaPath);
  if (!validate) continue;

  if (!validate(data)) {
    for (const error of validate.errors ?? []) {
      const where = error.instancePath === '' ? '/' : error.instancePath;
      const extra = error.params?.additionalProperty
        ? ` ("${error.params.additionalProperty}")`
        : '';
      fail(rel(file), `${where} ${error.message}${extra}`);
    }
    continue;
  }
  validated += 1;
}

// ---------------------------------------------------------- locale parity ---

const LOCALES_DIR = join(CONTENT_DIR, 'locales');

function flattenKeys(value, prefix = '') {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [prefix];
  const keys = [];
  for (const [key, child] of Object.entries(value)) {
    if (key === '$schema' && prefix === '') continue;
    keys.push(...flattenKeys(child, prefix === '' ? key : `${prefix}.${key}`));
  }
  return keys;
}

let localeBundlesChecked = 0;

if (existsSync(LOCALES_DIR)) {
  const enDir = join(LOCALES_DIR, 'en');
  const frDir = join(LOCALES_DIR, 'fr');
  const enFiles = walk(enDir, (f) => extname(f) === '.json');
  const frFiles = walk(frDir, (f) => extname(f) === '.json');
  const enNames = new Set(enFiles.map((f) => relative(enDir, f)));
  const frNames = new Set(frFiles.map((f) => relative(frDir, f)));

  for (const name of enNames) {
    if (!frNames.has(name)) fail('locales', `content/locales/fr/${name} is missing (EN has it)`);
  }
  for (const name of frNames) {
    if (!enNames.has(name)) fail('locales', `content/locales/en/${name} is missing (FR has it)`);
  }

  for (const name of enNames) {
    if (!frNames.has(name)) continue;
    const en = readJson(join(enDir, name));
    const fr = readJson(join(frDir, name));
    if (!en.ok || !fr.ok) continue;
    const enKeys = new Set(flattenKeys(en.value));
    const frKeys = new Set(flattenKeys(fr.value));
    for (const key of enKeys) {
      if (!frKeys.has(key)) fail('locales', `${name}: "${key}" present in EN, missing in FR`);
    }
    for (const key of frKeys) {
      if (!enKeys.has(key)) fail('locales', `${name}: "${key}" present in FR, missing in EN`);
    }
    localeBundlesChecked += 1;
  }
}

// ------------------------------------------------------- asset attribution ---

/**
 * ADR-0004: every third-party asset carries author, licence and source URL in
 * `assets/credits.json`, and the gate — not a promise — is what keeps that true.
 *
 * This check walked `assets/dist/` only until 2026-09-08. `assets/dist/` is
 * build output and was empty, so the gate reported "0 shipped asset(s)
 * credited" while fourteen licensed reference photographs sat in
 * `assets/refs/`, visible to nobody. It passed by vacuum. ADR-0006's
 * credit-scope obligation (due 2026-09-15, owner=art) names that defect
 * exactly: "an asset committed elsewhere under `assets/` is credited by
 * nobody". The fix is to walk `assets/`.
 *
 * Two directions, because a credits file rots from either end:
 *   - an asset file with no entry is an uncredited asset (the licensing risk);
 *   - an entry with no file is a stale claim about a file that is gone.
 * The invariant is set equality, not containment.
 */

const ASSETS_DIR = join(ROOT, 'assets');

/**
 * Where credit paths used to be resolved from. Kept for one purpose only: a
 * `../`-prefixed entry is a hard failure now, and the message is more useful if
 * it can name the canonical path the author meant. Nothing resolves against it.
 */
const OLD_CREDIT_ROOT = join(ASSETS_DIR, 'dist');

/**
 * What is NOT an asset, and why each exclusion is narrow enough to stay honest.
 *
 * The rule is a denylist on purpose. An allowlist of known media extensions is
 * the more natural-looking design and the more dangerous one: the first `.riv`,
 * `.woff2`, `.webm` or `.ogg` to land would be silently uncredited and the gate
 * would stay green. Here an unrecognised file defaults to "must be credited",
 * so a new asset type fails loudly and someone decides on purpose.
 */

/** Generated output. Provenance is tracked at the source, never at the derivative. */
const NON_ASSET_DIRS = ['dist'];

/**
 * Documentation. Prose in `assets/` is written here (art-bible.md, officer.md,
 * refs/README.md, prompt text); it is never a licensed third-party media file.
 * A vendored third-party LICENSE/NOTICE is the licence text itself, not a work
 * needing its own credit.
 */
const NON_ASSET_EXTENSIONS = new Set(['.md', '.txt']);
const NON_ASSET_BASENAMES = new Set([
  '.gitkeep',
  '.gitignore',
  '.DS_Store',
  'Thumbs.db',
  'LICENSE',
  'LICENCE',
  'NOTICE',
]);

/**
 * Named metadata files, listed one by one rather than excluded as `*.json`.
 * JSON *can* be an asset — atlas data, Rive and animation exports — so a blanket
 * extension rule here would be the vacuum coming back. A new metadata file has
 * to be added to this list deliberately, and the gate shouts until it is.
 */
const NON_ASSET_PATHS = new Set([
  'credits.json', // the register itself
  'refs/references.json', // the reference index verify-art reads
  // The palette, authored in this repo. Not an asset -- and NOT unchecked
  // either: it is in EXTERNAL_DATA_FILES above, so it is schema-validated and
  // referentially cross-checked below. Excluding a file from the credit walk
  // used to mean excluding it from every walk there is.
  'style/palette.json',
]);

/** `p` is `assets`-relative, posix-separated. */
function isAssetPath(p) {
  if (NON_ASSET_PATHS.has(p)) return false;
  if (NON_ASSET_DIRS.some((d) => p === d || p.startsWith(`${d}/`))) return false;
  const name = basename(p);
  if (NON_ASSET_BASENAMES.has(name)) return false;
  if (NON_ASSET_EXTENSIONS.has(extname(name).toLowerCase())) return false;
  return true;
}

/**
 * `assets/refs/` is the drawing-reference tree: ADR-0004 and assets/refs/README
 * both say those files are never redistributed in the built game. Everything
 * else under `assets/` is shipped lineage.
 *
 * credits.schema.json requires `kind` and pins it to the enum, so a missing or
 * misspelt one fails validation before this runs. What no schema can see is that
 * `shipped` is a lie for a file under `refs/`: that needs the path and the claim
 * together, which only this gate has. The `typeof` guard therefore stays - the
 * gate does not assume validation ran first anywhere else either, and reading a
 * missing `kind` as agreement is the one wrong answer available here.
 */
const kindForPath = (p) => (p === 'refs' || p.startsWith('refs/') ? 'reference' : 'shipped');

const assetFiles = walk(ASSETS_DIR, () => true)
  .map((f) => relative(ASSETS_DIR, f).split(sep).join('/'))
  .filter(isAssetPath);

/**
 * Anti-vacuum floor. Nothing below this line can fail when the walk finds
 * nothing, so "found nothing" has to be the failure. This gate reported success
 * over an empty directory for a whole slice; it does not get to do that twice.
 */
if (assetFiles.length === 0) {
  fail(
    'assets',
    'found 0 asset file(s) under assets/ — the credit check has nothing to measure. ' +
      'Either the walk is broken, the checkout is incomplete, or every asset was removed; ' +
      'if the last of those is deliberate, lower this floor in scripts/validate-content.mjs on purpose.',
  );
}

/** Posix-separated `assets`-relative form of `absolute`, or null if it escapes. */
function insideAssets(absolute) {
  const inside = relative(ASSETS_DIR, absolute).split(sep).join('/');
  if (inside === '' || inside === '..' || inside.startsWith('../') || isAbsolute(inside)) return null;
  return inside;
}

/**
 * Resolve a credits entry `path` to an `assets`-relative path.
 *
 * The one accepted form is relative to `assets/`: `refs/ottawa/peace-tower.jpg`.
 *
 * A leading `../` is rejected, not resolved. Until 2026-09-08 this gate resolved
 * those against `assets/dist` and printed a warning, because credits.json was
 * written when `path` meant "relative to assets/dist". All fourteen entries have
 * since been rewritten to the canonical form, so that branch handled nothing
 * while still looking as though it handled something — the small version of the
 * vacuum this whole check exists to catch. The rejection carries the canonical
 * path when it can be worked out, because a failure nobody can act on is its own
 * dead end.
 */
function resolveCreditPath(p) {
  if (p.startsWith('../')) {
    // Only claim "old convention" when reading it that way lands inside assets/.
    // Anything else is just a path escaping the tree, and says so below.
    const canonical = insideAssets(resolve(OLD_CREDIT_ROOT, p));
    if (canonical !== null) return { ok: false, oldConvention: canonical };
  }
  const absolute = resolve(ASSETS_DIR, p);
  const inside = insideAssets(absolute);
  if (inside === null) return { ok: false, absolute };
  return { ok: true, path: inside, absolute };
}

let creditedAssets = 0;
let referenceEntries = 0;
let shippedEntries = 0;

const credits = readJson(CREDITS_FILE);

if (!existsSync(CREDITS_FILE)) {
  fail('assets/credits.json', 'missing — every asset under assets/ needs a credit entry (ADR-0004)');
} else if (!credits.ok) {
  fail('assets/credits.json', `invalid JSON (${credits.error})`);
} else {
  const entries = Array.isArray(credits.value.assets) ? credits.value.assets : [];
  const credited = new Set();

  entries.forEach((entry, index) => {
    const where = `assets/credits.json[${index}]`;
    const raw = entry?.path;
    if (typeof raw !== 'string' || raw.length === 0) {
      // The schema catches this too; the gate does not assume it ran first.
      fail(where, 'entry has no "path"');
      return;
    }

    const resolved = resolveCreditPath(raw);
    if (!resolved.ok) {
      if (resolved.oldConvention !== undefined) {
        fail(
          where,
          `"${raw}" starts with "../". Credit paths are relative to assets/, not to ` +
            `assets/dist — write "${resolved.oldConvention}" instead.`,
        );
      } else {
        fail(where, `"${raw}" resolves outside assets/ (${rel(resolved.absolute)})`);
      }
      return;
    }

    if (credited.has(resolved.path)) {
      fail(where, `"${raw}" duplicates an earlier entry for ${resolved.path}`);
      return;
    }
    credited.add(resolved.path);

    if (!existsSync(resolved.absolute)) {
      fail(where, `"${raw}" credits assets/${resolved.path}, which does not exist`);
      return;
    }
    if (!isAssetPath(resolved.path)) {
      fail(
        where,
        `"${raw}" credits assets/${resolved.path}, which this gate does not count as an asset ` +
          '(build output under assets/dist/, documentation, or a named metadata file). Remove the entry.',
      );
      return;
    }

    const expectedKind = kindForPath(resolved.path);
    if (typeof entry.kind === 'string' && entry.kind !== expectedKind) {
      fail(
        where,
        `"${raw}" is marked kind="${entry.kind}" but lives under assets/${resolved.path}, ` +
          `which is ${expectedKind === 'reference' ? 'the never-redistributed reference tree' : 'shipped lineage'} ` +
          `(expected kind="${expectedKind}")`,
      );
      return;
    }
    if (expectedKind === 'reference') referenceEntries += 1;
    else shippedEntries += 1;
  });

  for (const asset of assetFiles) {
    if (!credited.has(asset)) {
      fail('assets/credits.json', `assets/${asset} is committed but not credited (ADR-0004)`);
    }
  }

  creditedAssets = assetFiles.filter((a) => credited.has(a)).length;
}

// ----------------------------------------------------------------- palette ---

/**
 * The palette's referential integrity, which its schema cannot express.
 *
 * palette.schema.json pins every ramp tone and every ink key to the `id` type.
 * It cannot say that the id is a key of `colours` in the same document -- JSON
 * Schema has no way to reach across a document like that -- and its own
 * description says so: "Every tone names a key in `colours`; validate-content
 * cross-checks that once this file is in its input set." This is that
 * cross-check. Without it a ramp can name `snow-basee` and pass every gate in
 * the repository until an SVG renders with a missing fill.
 *
 * `levelTheme` is only checked at the three keys the schema's description names
 * (`sky`, `ground`, `horizon`) and only when they are strings, because the rest
 * of that block is deliberately unconstrained prose and guessing at its shape
 * would be inventing a rule nobody wrote.
 */
let paletteColours = 0;
let paletteRamps = 0;

if (existsSync(PALETTE_FILE)) {
  const parsed = readJson(PALETTE_FILE);
  const where = rel(PALETTE_FILE);
  if (!parsed.ok) {
    // Already reported by the schema pass; not repeated here.
  } else {
    const palette = parsed.value;
    const colours = palette?.colours;
    const known = colours && typeof colours === 'object' && !Array.isArray(colours) ? Object.keys(colours) : [];
    const has = (id) => known.includes(id);

    /**
     * ANTI-VACUUM FLOOR. A palette with no colours satisfies every "names a
     * colour that exists" check below by having nothing to check, and an empty
     * one is what a broken generator writes. minProperties in the schema says
     * the same thing; it is repeated here because this section must not be
     * satisfiable by an empty document even if the schema pass was skipped.
     */
    if (known.length === 0) {
      fail(where, 'declares no colours; the allow-list every SVG is linted against cannot be empty');
    }

    const ramps = palette?.ramps;
    const rampEntries =
      ramps && typeof ramps === 'object' && !Array.isArray(ramps) ? Object.entries(ramps) : [];
    if (rampEntries.length === 0) {
      fail(where, 'declares no ramps; three-tone shading has nothing to derive from');
    }

    for (const [name, ramp] of rampEntries) {
      if (ramp === null || typeof ramp !== 'object') continue; // the schema names this one.
      for (const tone of ['light', 'base', 'shade']) {
        const id = ramp[tone];
        if (typeof id !== 'string') continue; // the schema names this one too.
        if (!has(id)) {
          fail(
            where,
            `ramps.${name}.${tone} is "${id}", which is not a key of "colours". Every tone must name ` +
              'a colour in the allow-list; a ramp pointing at a colour that does not exist renders as ' +
              'a missing fill and no other gate would see it.',
          );
        }
      }
    }

    const inks = palette?.inks;
    if (inks && typeof inks === 'object' && !Array.isArray(inks)) {
      for (const id of Object.keys(inks)) {
        if (!has(id)) {
          fail(where, `inks."${id}" is not a key of "colours"; an outline colour must be in the allow-list`);
        }
      }
    }

    const levelTheme = palette?.levelTheme;
    if (levelTheme && typeof levelTheme === 'object' && !Array.isArray(levelTheme)) {
      for (const [level, theme] of Object.entries(levelTheme)) {
        if (theme === null || typeof theme !== 'object' || Array.isArray(theme)) continue;
        for (const slot of ['sky', 'ground', 'horizon']) {
          const id = theme[slot];
          if (typeof id === 'string' && !has(id)) {
            fail(where, `levelTheme.${level}.${slot} is "${id}", which is not a key of "colours"`);
          }
        }
      }
    }

    paletteColours = known.length;
    paletteRamps = rampEntries.length;
  }
}

// -------------------------------------------- anti-vacuum, per printed count ---

/**
 * ADR-0024's mechanical form, applied to this gate's own summary line: a gate
 * that reports a count fails when the count is zero, unless zero is explicitly
 * declared legal in the gate, with a reason.
 *
 * ZERO IS DECLARED LEGAL HERE, and this is the declaration. `content/locales/en`
 * and `content/locales/fr` are empty, so this gate has been printing
 * "0 locale bundle(s) in EN/FR parity" as a pass on every run since it was
 * written — the project's hardest content guarantee, CLAUDE.md's "EN and FR from
 * the first commit", reporting success about nothing.
 *
 * The reason zero is legal rather than a failure, stated so it can be argued
 * with: THE GUARANTEE IS HELD, JUST NOT HERE. Every player-facing string the DOM
 * screens draw is in `app/ui/copy.ts`, whose `FR` table is typed
 * `Readonly<Record<keyof typeof EN, string>>`. A French string that is missing
 * or misspelt is a COMPILE ERROR, caught by `make typecheck` on every run and in
 * CI. That is a stronger check than this one — it is exhaustive over the keys by
 * construction, where this gate compares two files that both have to exist — and
 * it covers the strings that actually ship today. Failing here would turn the
 * build red over a guarantee that is already enforced, one directory over.
 *
 * THE TASK THAT ENDS IT: ADR-0010 puts UI vocabulary in
 * `content/locales/<locale>/<bundle>.json` and `app/ui/copy.ts` carries
 * `TODO(slice-1): move to content/locales and read through the LocalizerPort`.
 * When that move lands, the bundles exist, this gate counts them, and the
 * declaration below stops applying on its own. Tracked as ADR-0024's obligation
 * (owner=infra, due=2026-10-08); the DEADLINE lives in the ADR and is enforced
 * by `make lint`, not duplicated here, because two places holding one date is
 * two places to keep in step.
 *
 * THE DECLARATION IS SELF-LIMITING, which is what keeps it from becoming
 * permanent by inattention. It is conditional on both halves of its premise
 * still being true, and each half failing is a different failure with a
 * different fix:
 *
 *   1. BOTH locale directories are still empty. The moment either holds a
 *      bundle, zero stops being legal: a count of zero then means the walk is
 *      broken or the bundles were deleted, not that the migration has not
 *      started. (Parity itself is already checked above, in both directions.)
 *   2. `app/ui/copy.ts` still holds EN/FR parity by TYPE. If that mechanism is
 *      removed or renamed, the reason this declaration gives is no longer true,
 *      and a declaration whose premise has gone is worth less than no
 *      declaration at all. This is a deliberately narrow textual check on
 *      another agent's file: it can only fail loudly, it names exactly what to
 *      do, and the alternative — trusting a comment — is what produced the
 *      defect being fixed. It is not a substitute for `make typecheck`, which
 *      is what actually proves the parity; it checks that the mechanism is
 *      still the one this gate is relying on.
 */
const UI_COPY_FILE = join(ROOT, 'app', 'ui', 'copy.ts');
/**
 * BOTH halves, because either alone is satisfiable by the wrong thing. The
 * first draft looked for `Readonly<Record<CopyRow, string>>` and a scratch copy
 * with `const FR` de-typed still passed it — the string was matched by the
 * unrelated `TABLES` declaration further down the file. What must be true is
 * that a row type is DERIVED FROM EN and that a table is typed BY IT; a match
 * for the second without the first proves nothing about French.
 *
 * Both patterns are DECLARATION-shaped, not prose-shaped. A first attempt
 * matched a bare `keyof typeof EN`, which the file's own header comment
 * contains, so retyping `CopyRow` to `string` still passed. A gate that reads a
 * comment as evidence of the code is the failure this gate is about.
 */
const UI_COPY_ROW_TYPE = /type\s+CopyRow\s*=\s*keyof\s+typeof\s+EN\b/;
const UI_COPY_TABLE_TYPE = /Record<\s*CopyRow\s*,/;

if (localeBundlesChecked === 0) {
  const enEmpty = walk(join(LOCALES_DIR, 'en'), (f) => extname(f) === '.json').length === 0;
  const frEmpty = walk(join(LOCALES_DIR, 'fr'), (f) => extname(f) === '.json').length === 0;
  // The premise check is about THIS repository's UI strings, so it only applies
  // to a tree that has a UI. A --root with no `app/ui/` has no player-facing UI
  // strings at all, so there is nothing for EN/FR parity to be about and zero
  // bundles is trivially right; the fixtures other gates build are exactly that
  // shape, and a first draft failed all of them. `app/ui/` present with copy.ts
  // gone is the case that matters and it still fails below.
  const hasUi = existsSync(join(ROOT, 'app', 'ui'));
  const copy = existsSync(UI_COPY_FILE) ? readFileSync(UI_COPY_FILE, 'utf8') : null;

  if (!enEmpty || !frEmpty) {
    fail(
      'locales',
      'checked 0 locale bundle(s) for EN/FR parity, and the locale directories are NOT empty. ' +
        'Zero is declared legal in this gate only while the migration to content/locales has not ' +
        'started; with bundles on disk it means the walk is broken or a bundle was deleted, and ' +
        'reporting it as a pass is the defect ADR-0024 names.',
    );
  } else if (hasUi && (copy === null || !UI_COPY_ROW_TYPE.test(copy) || !UI_COPY_TABLE_TYPE.test(copy))) {
    fail(
      'locales',
      'checked 0 locale bundle(s) for EN/FR parity. Zero is declared legal in this gate ONLY ' +
        "because app/ui/copy.ts holds every shipped string's French by type — a missing FR row is " +
        'a compile error — and that mechanism is no longer there (' +
        `${copy === null ? 'the file is missing' : !UI_COPY_ROW_TYPE.test(copy) ? 'no row type is derived from EN' : 'no table is typed by the row type'}). ` +
        "CLAUDE.md requires EN and FR from the first commit; with neither the bundles nor the type " +
        'binding, nothing is enforcing it. Restore the binding, or land ADR-0010\'s move to ' +
        'content/locales so this gate has bundles to count.',
    );
  }
}

/**
 * The other four numbers on that line, audited for the same property. Three
 * were already floored and one was not.
 *
 *   - `creditedAssets` / `shippedEntries` / `referenceEntries` — floored above:
 *     zero asset files fails, and an asset that exists without a credit entry
 *     fails per file, so a zero here cannot be reached quietly.
 *   - `paletteColours` / `paletteRamps` — floored in the palette section: a
 *     palette declaring no colours or no ramps fails there.
 *   - `localeBundlesChecked` — the declaration above.
 *   - `validated` / `dataFiles.length` — NOT floored until now. An empty
 *     `content/` prints "0/0 content file(s) valid against 12 schema(s)" and
 *     exits 0: `every([])` is vacuously true and reads exactly like a clean
 *     bill. It is the same shape as `progress.schema.json` being validated by
 *     nothing, which ADR-0024 records as the sharpest instance of the class.
 *     A broken walk, an incomplete checkout or a bad `--root` all land here.
 */
if (contentDocuments.length === 0 && ALLOW_EMPTY_CONTENT) {
  // The waiver is never silent. A fixture that deliberately builds a tree with
  // no content documents says so at its call site and the run says so in its
  // output, which is the difference between a declared exemption and a hole.
  console.log(
    'validate-content: --allow-empty-content: content/ holds no document and that was DECLARED ' +
      'legal by the caller. The schema half of this gate validated nothing under content/. Never ' +
      'pass this from the Makefile or from CI.',
  );
} else if (contentDocuments.length === 0) {
  fail(
    'content',
    'found 0 document(s) under content/ to validate. Every schema in content/schemas/ was then ' +
      'checked against nothing, and "all valid" over an empty set is vacuously true — it reads ' +
      'exactly like a clean bill. Either the walk is broken, --root points somewhere unexpected, ' +
      'or the checkout is incomplete. Counted over content/ alone and not over dataFiles, which ' +
      'always carries assets/credits.json and assets/style/palette.json and so can never be ' +
      'empty: a floor that cannot fire is decoration (ADR-0014).',
  );
} else if (validated === 0) {
  fail(
    'content',
    `found ${String(dataFiles.length)} content document(s) and validated none of them. A document ` +
      'that was skipped is not a document that passed.',
  );
}

// ------------------------------------------------------------------ report ---

if (failures.length > 0) {
  console.error('validate-content: FAILED');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(
    `validate-content: ${failures.length} failure(s) across ${dataFiles.length} content file(s).`,
  );
  process.exit(1);
}

console.log(
  `validate-content: OK - ${validated}/${dataFiles.length} content file(s) valid against ` +
    `${schemasByPath.size} schema(s), ` +
    `${localeBundlesChecked === 0
      ? 'NO locale bundles exist yet, so EN/FR parity is held by app/ui/copy.ts and make typecheck, not here (ADR-0010, ADR-0024)'
      : `${localeBundlesChecked} locale bundle(s) in EN/FR parity`}, ` +
    `${creditedAssets} asset file(s) under assets/ credited ` +
    `(${shippedEntries} shipped, ${referenceEntries} reference), ` +
    `palette ${paletteColours} colour(s) in ${paletteRamps} ramp(s), every tone and ink resolved.`,
);
