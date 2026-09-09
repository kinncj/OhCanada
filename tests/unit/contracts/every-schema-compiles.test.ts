/**
 * Every schema in `content/schemas/` compiles, whether or not a document uses it.
 *
 * ADR-0007 makes `content/schemas/*.schema.json` the single authority on the
 * shape of authored content, and `make validate-content` is what enforces it —
 * over the documents that exist. That gate calls `ajv.addSchema()` for every
 * file and ajv compiles **lazily**, so a schema is compiled the first time a
 * document points at it and never otherwise. Two consequences, and the second
 * one shipped:
 *
 *  1. A schema with no documents validates nothing. ADR-0024 records that as the
 *     sharpest instance of a gate reporting success about an empty corpus.
 *  2. **A schema with no documents is not even checked for being a legal
 *     schema.** `quest.schema.json` named five properties in `required` and
 *     declared none of them in the same subschema, which ajv's `strictRequired`
 *     rejects at compile time. From the day it was written until the day the
 *     first quest document existed, the project's authority on quest shape was
 *     not a lax validator — it was not a validator at all, and every run printed
 *     a count of schemas as evidence that it was fine.
 *
 * `progress.schema.json` is the case that cannot be fixed by authoring a
 * document: it describes the save file, so nothing under `content/` will ever
 * point at it. This file is the check that does not need a corpus — a schema
 * compiling is a claim about the schema, compared against ajv rather than
 * against data (ADR-0024, "check a claim against another claim").
 *
 * ajv is configured exactly as `scripts/validate-content.mjs` configures it. A
 * looser validator here would prove something about a validator this project
 * does not run.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

const SCHEMA_DIR = fileURLToPath(new URL('../../../content/schemas', import.meta.url));

const schemaFiles = readdirSync(SCHEMA_DIR)
  .filter((name) => name.endsWith('.schema.json'))
  .sort();

const read = (file: string): Record<string, unknown> =>
  JSON.parse(readFileSync(`${SCHEMA_DIR}/${file}`, 'utf8')) as Record<string, unknown>;

/** The same options `scripts/validate-content.mjs` builds ajv with. */
const newAjv = (): Ajv2020 => {
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  return ajv;
};

const idOf = (schema: Record<string, unknown>, file: string): string =>
  typeof schema.$id === 'string' ? schema.$id : file;

/** Compile every schema in one registry, returning the failures by file. */
const compileAll = (
  files: readonly string[],
  patch: (file: string, schema: Record<string, unknown>) => Record<string, unknown> = (
    _file,
    schema,
  ) => schema,
): { readonly compiled: number; readonly failures: readonly string[] } => {
  const ajv = newAjv();
  const ids = new Map<string, string>();
  const failures: string[] = [];

  for (const file of files) {
    const schema = patch(file, read(file));
    const id = idOf(schema, file);
    try {
      ajv.addSchema(schema, id);
      ids.set(file, id);
    } catch (error) {
      failures.push(`${file}: rejected by ajv.addSchema (${(error as Error).message})`);
    }
  }

  let compiled = 0;
  for (const [file, id] of ids) {
    try {
      // `getSchema` is what forces the compile that `addSchema` defers. This
      // line is the whole point of the file.
      const validate = ajv.getSchema(id);
      if (typeof validate !== 'function') {
        failures.push(`${file}: ajv produced no validator for "${id}"`);
        continue;
      }
      compiled += 1;
    } catch (error) {
      failures.push(`${file}: failed to compile (${(error as Error).message})`);
    }
  }

  return { compiled, failures };
};

describe('every schema in content/schemas compiles', () => {
  it('compiles all of them, with ajv configured as the content gate configures it', () => {
    const { compiled, failures } = compileAll(schemaFiles);
    expect(
      failures,
      `${failures.join('\n')}\n\nA schema that does not compile validates nothing, and a schema ` +
        'with no documents is never compiled by make validate-content (ADR-0024 §4).',
    ).toEqual([]);
    expect(compiled).toBe(schemaFiles.length);
  });

  it('is compiling schemas at all, rather than reporting a pass over none', () => {
    // ADR-0024's mechanical form, applied to this gate's own count: zero
    // compiled schemas would print as a clean bill and mean the walk is broken.
    expect(schemaFiles.length).toBeGreaterThan(0);
    // Two of these have no documents under content/ and one of them never will.
    expect(schemaFiles).toContain('progress.schema.json');
    expect(schemaFiles).toContain('quest.schema.json');
  });

  it('fails on the defect that actually shipped, so the gate is not decoration', () => {
    /*
     * The real one, reproduced rather than imagined: a conditional branch that
     * `require`s a property no subschema in the same object declares. ajv's
     * `strictRequired` refuses to compile it. Injected into a copy of a real
     * schema — nothing broken is left on disk, and the copy carries every $ref
     * the original does, so the failure is the compile and not a missing import.
     */
    const broken = (file: string, schema: Record<string, unknown>): Record<string, unknown> =>
      file === 'quest.schema.json'
        ? { ...schema, required: [...(schema.required as string[]), 'noSuchProperty'] }
        : schema;

    const { failures } = compileAll(schemaFiles, broken);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('quest.schema.json');
    expect(failures[0]).toContain('noSuchProperty');
  });

  it('fails on a schema that is not a schema, whatever the reason', () => {
    const broken = (file: string, schema: Record<string, unknown>): Record<string, unknown> =>
      file === 'progress.schema.json' ? { ...schema, type: 'obejct' } : schema;

    const { failures } = compileAll(schemaFiles, broken);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('progress.schema.json');
  });
});
