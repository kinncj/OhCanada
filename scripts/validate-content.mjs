#!/usr/bin/env node
/**
 * validate-content — the content gate (slice 0, task 0.9).
 *
 * 1. Loads every JSON Schema under content/schemas/.
 * 2. Validates every .json under content/ (plus assets/credits.json) against
 *    the schema its own `$schema` names. A file without `$schema` is a failure.
 *    Schemas use `additionalProperties: false`, so unknown properties fail.
 * 3. Checks EN/FR key parity for content/locales/<locale>/*.json.
 * 4. Checks that every shipped file under assets/dist/ is credited in
 *    assets/credits.json (ADR-0004).
 *
 * Exits non-zero and lists every failure. Prints a one-line summary.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CONTENT_DIR = join(ROOT, 'content');
const SCHEMA_DIR = join(CONTENT_DIR, 'schemas');
const ASSETS_DIST_DIR = join(ROOT, 'assets', 'dist');
const CREDITS_FILE = join(ROOT, 'assets', 'credits.json');

const META_SCHEMA_PREFIXES = ['https://json-schema.org/', 'http://json-schema.org/'];
const CREDITS_EXEMPT = new Set(['manifest.json', '.gitkeep', '.DS_Store']);

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

const dataFiles = [
  ...walk(CONTENT_DIR, (f) => extname(f) === '.json' && !f.startsWith(SCHEMA_DIR + sep)),
  ...(existsSync(CREDITS_FILE) ? [CREDITS_FILE] : []),
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

// -------------------------------------------------------- asset attribution ---

let creditedChecked = 0;

const shippedAssets = walk(
  ASSETS_DIST_DIR,
  (f) => !CREDITS_EXEMPT.has(basename(f)),
).map((f) => relative(ASSETS_DIST_DIR, f).split(sep).join('/'));

if (shippedAssets.length > 0) {
  const credits = readJson(CREDITS_FILE);
  if (!credits.ok) {
    fail('assets/credits.json', `unreadable (${credits.error ?? 'missing'})`);
  } else {
    const credited = new Set((credits.value.assets ?? []).map((a) => a.path));
    for (const asset of shippedAssets) {
      if (!credited.has(asset)) {
        fail('assets/credits.json', `assets/dist/${asset} is shipped but not credited`);
      }
    }
    creditedChecked = shippedAssets.length;
  }
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
    `${schemasByPath.size} schema(s), ${localeBundlesChecked} locale bundle(s) in EN/FR parity, ` +
    `${creditedChecked} shipped asset(s) credited.`,
);
