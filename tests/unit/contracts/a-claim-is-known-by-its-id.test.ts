/**
 * EVERY CLAIM IN THE CORPUS HAS ONE IDENTITY, AND IT IS THE ONE ITS SCHEMA
 * REQUIRES. ADR-0024.
 *
 * Gate A in `scripts/verify-content.mjs` matches a claim across two revisions by
 * the key `claimKeys` in `scripts/lib/claims.mjs` gives it: the `id` a list
 * item's schema requires, or its position where the schema requires none. That
 * key used to be the JSON pointer, and an array index is a position — inserting
 * landmarks ahead of granted ones made a commit read as rewriting their grants,
 * and a moved landmark's grant followed its old slot without A4 noticing.
 *
 * The key is READ FROM THE SCHEMAS, which is the point and also the risk: a
 * schema that stops resolving, or stops requiring an id its documents still
 * carry, turns identity back into position without any rule failing. The gate
 * catches that per run; this file holds the real corpus to it, and does so with
 * an oracle that does not share the gate's reading of the schemas — the
 * documents' own bytes. Where every item of a list carries a distinct string
 * `id`, a claim inside it must be keyed by that id.
 *
 * WHAT THIS DOES NOT PROVE: that gate A USES these keys. That is proved by
 * mutation in tests/unit/infra/verify-content-gate.test.ts, which inserts,
 * reorders, deletes, moves and duplicates claims across commits and asserts the
 * exact verdicts.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  claimKeys,
  claimsIn,
  isSchemaDocument,
  schemaRegistry,
  type ClaimKeys,
} from '../../../scripts/lib/claims.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CONTENT_DIR = `${REPO_ROOT}content`;

const jsonFilesUnder = (dir: string): readonly string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) return jsonFilesUnder(path);
        return entry.isFile() && path.endsWith('.json') ? [path] : [];
      })
    : [];

const SCHEMAS = schemaRegistry(
  jsonFilesUnder(`${CONTENT_DIR}/schemas`).map((path) => ({
    where: path.slice(REPO_ROOT.length),
    document: JSON.parse(readFileSync(path, 'utf8')) as unknown,
  })),
);

interface Keyed {
  readonly where: string;
  readonly root: unknown;
  readonly pointers: readonly string[];
  readonly identity: ClaimKeys;
}

/** Every claim-bearing document, with every claim's identity as gate A computes it. */
const CORPUS: readonly Keyed[] = jsonFilesUnder(CONTENT_DIR).flatMap((path) => {
  const where = path.slice(REPO_ROOT.length);
  if (isSchemaDocument(where)) return [];
  const root = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  const pointers = claimsIn(root, where).map((claim) => claim.pointer);
  return pointers.length === 0 ? [] : [{ where, root, pointers, identity: claimKeys(root, where, pointers, SCHEMAS) }];
});

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const segmentsOf = (pointer: string): readonly string[] =>
  pointer === '' ? [] : pointer.slice(1).split('/').map((segment) => segment.replace(/~1/gu, '/').replace(/~0/gu, '~'));

/**
 * The ids a claim's pointer passes through, read from the document alone: for
 * each list on the way down whose items ALL carry a distinct string `id`, the id
 * of the item the pointer enters. No schema is consulted.
 */
const idsOnThePath = (root: unknown, pointer: string): readonly string[] => {
  const found: string[] = [];
  let node: unknown = root;
  for (const segment of segmentsOf(pointer)) {
    if (Array.isArray(node)) {
      const list = node as readonly unknown[];
      const ids = list.map((item) => (isRecord(item) && typeof item['id'] === 'string' ? item['id'] : null));
      const item = list[Number(segment)];
      if (ids.every((id) => id !== null) && new Set(ids).size === ids.length && isRecord(item)) {
        found.push(item['id'] as string);
      }
      node = item;
    } else {
      node = isRecord(node) ? node[segment] : undefined;
    }
  }
  return found;
};

describe('every claim is known by the id its schema requires (ADR-0024)', () => {
  it('has a corpus, and some of its claims sit inside a list of identified items', () => {
    // The floor under every assertion below, each of which is "no claim does X"
    // and would be satisfied by an empty corpus or by a corpus with no lists.
    expect(CORPUS.length).toBeGreaterThan(0);
    const insideIdentifiedLists = CORPUS.flatMap((document) =>
      document.pointers.filter((pointer) => idsOnThePath(document.root, pointer).length > 0),
    );
    expect(insideIdentifiedLists.length).toBeGreaterThan(0);
  });

  it("resolves every claim-bearing document's $schema, so no claim is keyed by position for want of one", () => {
    expect(CORPUS.filter((document) => !document.identity.resolved).map((document) => document.where)).toEqual([]);
  });

  it('gives every claim an unambiguous identity: no duplicate or missing id, and no two claims one key', () => {
    expect(CORPUS.flatMap((document) => document.identity.faults)).toEqual([]);
    for (const document of CORPUS) {
      const keys = [...document.identity.keys.values()];
      expect(new Set(keys).size, document.where).toBe(keys.length);
    }
  });

  it('keys every claim inside a list of identified items by that id — the bytes are the oracle', () => {
    const positional = CORPUS.flatMap((document) =>
      document.pointers.flatMap((pointer) => {
        const key = document.identity.keys.get(pointer) ?? '';
        const missing = idsOnThePath(document.root, pointer).filter(
          (id) => !key.includes(`[id=${id}]`) && !key.includes(`[id=${JSON.stringify(id)}]`),
        );
        return missing.length === 0 ? [] : [`${document.where} at ${pointer} is keyed ${key}, not by ${missing.join(', ')}`];
      }),
    );
    expect(
      positional,
      'A claim sits inside a list whose items all carry a distinct id, and gate A keys it by position. ' +
        "Claim identity is read from what the item's schema REQUIRES, so either that schema stopped " +
        'requiring `id` - put it back - or it stopped resolving. Keyed by position, an insertion ahead of ' +
        "the claim reads as rewriting its grant, and a moved claim's grant follows its old slot.",
    ).toEqual([]);
  });

  it('reports no list whose items carry ids its schema does not require', () => {
    expect(CORPUS.flatMap((document) => document.identity.drift)).toEqual([]);
  });

  it('keys by position only inside lists whose items carry no id, and names their schema', () => {
    // The dialogue line is the known case, decided rather than defaulted: see
    // "Which claim is which" in scripts/lib/claims.mjs. This asserts only that
    // every positional key is one the documents cannot contradict.
    for (const document of CORPUS) {
      for (const [pointer, through] of document.identity.positional) {
        expect(through.every((label) => label.includes('.schema.json#')), `${document.where} at ${pointer}`).toBe(true);
      }
    }
  });
});
