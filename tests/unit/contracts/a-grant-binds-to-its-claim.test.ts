/**
 * THE FLOOR UNDER GATE A4's DOCUMENT-SCOPE BINDINGS. ADR-0024.
 *
 * A4 in `scripts/verify-content.mjs` voids a verification grant when the claim's
 * author fields move. Most of a claim's fields are found by SHAPE — its unit,
 * meaning the node the `factClaim` hangs off, which carries the prose and the
 * `source` and will carry any field added beside them tomorrow. That half needs
 * no floor: it cannot go dead without the recogniser going dead too, and
 * `claimCountFault` already watches that.
 *
 * `DOCUMENT_SCOPE_FIELDS` is the other half, and it is NAMED. It has to be: the
 * fields it lists sit at a document's root, beside a level's `ground` polygon
 * and its `textureBudgetBytes`, and no shape separates a teaching remit from a
 * texture budget. Only a reason does. Being named, each one can go dead in
 * silence — renamed in a schema, dropped from the documents, moved one level
 * down — and a dead name binds nothing, voids nothing, and produces output
 * identical to a name that is working perfectly. That is the vacuity shape a
 * NARROWING gate is most exposed to, and it fails in the direction of passing.
 *
 * So this file asserts, against the real corpus and not a fixture, that every
 * name on that list still has grants it applies to. It is the same argument
 * `CLAIM_COLLECTIONS` makes one level up: the list is a floor, not a scope.
 *
 * WHY THE FLOOR IS HERE AND NOT IN THE SCRIPT. `verify-content` runs over
 * fixture trees that are questions-only by design, and a questions-only tree
 * binds `levelId` zero times for a perfectly good reason. A floor stated inside
 * the script would fail those trees for something that has nothing to do with
 * them. The script COUNTS — it prints the per-field bind counts on every run, so
 * a number going to zero is visible — and this file is what makes zero a
 * failure over the corpus that ships.
 *
 * WHAT THIS DOES NOT PROVE, said plainly so its silence is not read as coverage:
 * it does not prove the gate binds these fields. That is proved by mutation in
 * `tests/unit/infra/verify-content-gate.test.ts`, which edits a level's
 * `subject` and asserts it voids nothing (ADR-0030), then edits a question's
 * `subject` and a quest's `levelId` and asserts the exact set of grants each
 * voids. This file proves only that the names are still live — that there
 * is something in `content/` for those bindings to bind.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  claimsIn,
  DOCUMENT_SCOPE_FIELDS,
  isSchemaDocument,
  type Claim,
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

interface Document {
  readonly where: string;
  readonly root: Record<string, unknown>;
  readonly claims: readonly Claim[];
}

/** Every claim-bearing document under `content/`, the schemas excepted. */
const CORPUS: readonly Document[] = jsonFilesUnder(CONTENT_DIR).flatMap((path) => {
  const where = path.slice(REPO_ROOT.length);
  if (isSchemaDocument(where)) return [];
  const root = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  const claims = claimsIn(root, where);
  return claims.length === 0 ? [] : [{ where, root, claims }];
});

/**
 * A claim a document-scope binding can APPLY to: one whose apparatus is enclosed
 * in a unit rather than sitting at the document root.
 *
 * A question's claim is the document, so `subject` is inside its unit already
 * and the scope binding is redundant for it — `claimAuthorFieldsAt` skips it
 * there deliberately, so that one edit is not reported as two. A claim with a
 * pointer of two segments or more (`/pois/3/fact`, `/steps/1/dialogue/0/fact`)
 * is the shape the binding exists for.
 */
const isEnclosed = (claim: Claim): boolean => claim.pointer.split('/').length - 1 >= 2;

/**
 * The node an enclosed claim hangs off — `/pois/3/fact` -> `/pois/3`. This is
 * the claim's UNIT, the half of its bound field set that `claimAuthorFieldsAt`
 * finds by shape.
 */
const unitOf = (root: Record<string, unknown>, pointer: string): Record<string, unknown> | null => {
  let node: unknown = root;
  for (const segment of pointer.slice(1).split('/').slice(0, -1)) {
    if (Array.isArray(node)) node = node[Number(segment)];
    else if (typeof node === 'object' && node !== null) node = (node as Record<string, unknown>)[segment];
    else return null;
  }
  return typeof node === 'object' && node !== null && !Array.isArray(node)
    ? (node as Record<string, unknown>)
    : null;
};

describe("gate A4's document-scope bindings are still live (ADR-0024)", () => {
  it('has a corpus to measure at all', () => {
    // The floor under the floor. Every assertion below is "some document does
    // X", and over an empty corpus every one of them would be vacuously
    // satisfiable by the absence of documents rather than by the presence of
    // bindings — which is precisely the failure this file exists to catch, one
    // level up from where it catches it.
    expect(CORPUS.length).toBeGreaterThan(0);
    expect(CORPUS.filter((document) => document.claims.some(isEnclosed)).length).toBeGreaterThan(0);
    expect(DOCUMENT_SCOPE_FIELDS.length).toBeGreaterThan(0);
  });

  for (const { key, why } of DOCUMENT_SCOPE_FIELDS) {
    it(`"${key}" binds at least one claim in the corpus`, () => {
      const binds = CORPUS.filter(
        (document) => key in document.root && document.claims.some(isEnclosed),
      );
      expect(
        binds.map((document) => document.where),
        `A4 binds every enclosed claim to the document-root field "${key}" — ${why} — and NOTHING ` +
          `in content/ carries it beside a claim. The binding is dead: it voids no grant, it will ` +
          `never void a grant, and verify-content will keep reporting green over claims it has ` +
          `silently stopped binding to that field. Either the field moved and ` +
          `DOCUMENT_SCOPE_FIELDS in scripts/lib/claims.mjs must follow it, or the reason above no ` +
          `longer holds and the entry should be removed deliberately rather than left to rot.`,
      ).not.toEqual([]);
    });
  }

  it('names no field the claim unit already carries, which would bind it twice', () => {
    // The opposite mistake, and much cheaper to catch here than to read out of
    // a failure message: a field that is ALSO inside the unit needs no
    // document-scope binding, and having both would report one edit as two
    // changed fields in every A4 failure it appeared in. `subject` on a QUESTION
    // is exactly that shape — the unit is the document — which is why
    // `claimAuthorFieldsAt` skips the scope bindings when the unit is the root.
    // This asserts the same thing holds for the enclosed claims, where the
    // binding is not skipped.
    for (const { key } of DOCUMENT_SCOPE_FIELDS) {
      const alsoInTheUnit = CORPUS.flatMap((document) =>
        document.claims.filter(isEnclosed).flatMap((claim) => {
          const unit = unitOf(document.root, claim.pointer);
          return unit !== null && key in unit ? [`${document.where} at ${claim.pointer}`] : [];
        }),
      );
      expect(
        alsoInTheUnit,
        `"${key}" is bound both as a document-scope field and as part of the claim's own unit, so ` +
          `one edit to it would be reported twice. Either the field has moved into the unit — in ` +
          `which case the entry in DOCUMENT_SCOPE_FIELDS is now redundant and should go — or the ` +
          `unit has grown a field of the same name meaning something else, which is worth knowing.`,
      ).toEqual([]);
    }
  });
});
