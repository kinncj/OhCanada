/**
 * A LESSON PASSAGE'S GRANT BINDS TO THE PASSAGE, NOT TO ITS POSITION.
 * ADR-0061 §2, ADR-0024, ADR-0007.
 *
 * `content/schemas/lesson.schema.json` was written before any lesson exists, and
 * this file is why that order matters. `scripts/lib/claims.mjs` keys every array
 * step on the path to a claim **by the item's `id` when the item's schema
 * requires one, and by position otherwise** — a rule read from the schema at the
 * revision being read, never from a list of arrays. Gate A4 in
 * `scripts/verify-content.mjs` then decides whether a grant still sits on the
 * claim it was granted over.
 *
 * So `required: ["id", …]` on a passage is not tidiness, and the cost of getting
 * it wrong is not hypothetical: keyed by position, inserting one passage at the
 * top of a lesson re-points every pointer beneath it — every grant below the
 * insertion voided, the commit reading as though it rewrote grants it never
 * touched — and a passage that MOVED keeps a grant now describing different
 * words. That is the defect a landmark's grant already hit once at `/pois/2`. A
 * lesson is the longest array of claims this project will have, and two authors
 * will work one chapter, so the same defect would void their work on every
 * commit.
 *
 * `a-claim-is-known-by-its-id.test.ts` holds the real corpus to this rule. It
 * cannot hold a lesson, because `content/lessons/` is deliberately empty until
 * infra's gate lands (ADR-0061 §9), and a check over an empty directory is the
 * pass over nothing ADR-0024 names. This file is the check that needs no corpus:
 * a fixture lesson, the real schema, the real claim machinery.
 *
 * THE COUNTERFACTUAL IS THE POINT. A gate nobody has seen fail is not a gate, so
 * the last case takes the shipped schema, removes `id` from the passage's
 * `required` list, and asserts that the SAME lesson then keys its claims by
 * position and reports drift. Without it, every assertion here would pass
 * against a schema whose `id` requirement had quietly gone away.
 *
 * The ajv half is configured exactly as `scripts/validate-content.mjs`
 * configures it; a looser validator would prove something about a validator this
 * project does not run.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

import { claimKeys, claimsIn, schemaRegistry } from '../../../scripts/lib/claims.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const LESSON_SCHEMA = 'content/schemas/lesson.schema.json';
const COMMON_SCHEMA = 'content/schemas/common.schema.json';

const readSchema = (where: string): Record<string, unknown> =>
  JSON.parse(readFileSync(`${REPO_ROOT}${where}`, 'utf8')) as Record<string, unknown>;

/* -------------------------------------------------------------------------- */
/* a fixture lesson — not content, and deliberately not authorable as content  */
/* -------------------------------------------------------------------------- */

/**
 * Where the fixture pretends to live. The path matters: `claims.mjs` resolves a
 * document's `$schema` relative to the document, so a lesson two directories
 * under `content/` is what makes `../../schemas/lesson.schema.json` land on the
 * real file.
 */
const WHERE = 'content/lessons/example-chapter/example-lesson.json';

/**
 * The author's null verification form — the only shape an author may write
 * (ADR-0003). Used here so the fixture cannot be mistaken for authored content
 * and cannot be lifted into `content/`: it carries no grant, and its prose is
 * obviously not a claim about Canada. Writing lesson content is a content
 * agent's job and this file does not do it.
 */
const unverifiedFact = (): Record<string, unknown> => ({
  factual: false,
  source: null,
  verification: null,
});

const passage = (id: string): Record<string, unknown> => ({
  id,
  text: { en: `Fixture passage ${id}.`, fr: `Passage de test ${id}.` },
  fact: unverifiedFact(),
});

const lesson = (...ids: readonly string[]): Record<string, unknown> => ({
  $schema: '../../schemas/lesson.schema.json',
  id: 'example-lesson',
  chapter: "Canada's History",
  order: 1,
  title: { en: 'Fixture lesson', fr: 'Leçon de test' },
  passages: ids.map(passage),
});

/* -------------------------------------------------------------------------- */
/* the two authorities                                                        */
/* -------------------------------------------------------------------------- */

/** ajv, configured as the content gate configures it. */
const validator = (): ((document: unknown) => boolean) => {
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  ajv.addSchema(readSchema(COMMON_SCHEMA));
  const validate = ajv.compile(readSchema(LESSON_SCHEMA));
  return (document: unknown): boolean => validate(document) === true;
};

const accepts = validator();

/**
 * A schema registry of one revision. `patch` lets the last case ship a lesson
 * schema that does not require `id`, which is the only way to show what the
 * requirement is doing.
 */
const registryWith = (
  patch: (schema: Record<string, unknown>) => Record<string, unknown> = (schema) => schema,
): ReturnType<typeof schemaRegistry> =>
  schemaRegistry([
    { where: COMMON_SCHEMA, document: readSchema(COMMON_SCHEMA) },
    { where: LESSON_SCHEMA, document: patch(readSchema(LESSON_SCHEMA)) },
  ]);

/** Every claim's identity in one document, as gate A computes it. */
const identityOf = (
  document: Record<string, unknown>,
  registry: ReturnType<typeof schemaRegistry> = registryWith(),
): ReturnType<typeof claimKeys> =>
  claimKeys(
    document,
    WHERE,
    claimsIn(document, WHERE).map((claim) => claim.pointer),
    registry,
  );

/* -------------------------------------------------------------------------- */

describe('the lesson schema is a schema, and it holds §2\'s unit (ADR-0061)', () => {
  it('compiles under the content gate\'s own ajv and accepts a well-formed lesson', () => {
    expect(accepts(lesson('p-1', 'p-2'))).toBe(true);
  });

  it('refuses a passage with no id — the field gate A keys the grant by', () => {
    const document = lesson('p-1');
    const passages = document.passages as Record<string, unknown>[];
    const first = passages[0];
    expect(first).toBeDefined();
    if (first === undefined) return;
    delete first.id;
    expect(accepts(document)).toBe(false);
  });

  it('refuses a lesson with no passages (ADR-0024)', () => {
    expect(accepts({ ...lesson('p-1'), passages: [] })).toBe(false);
  });

  it('refuses a `subject`, so a told claim cannot enter a graded count (ADR-0061 §5)', () => {
    // The schema is closed, and this is what that closure is FOR: a lesson
    // carrying a subject would let reading material count toward the
    // thirty-per-subject floor and hand the scheduler a bank it cannot draw.
    expect(accepts({ ...lesson('p-1'), subject: 'history' })).toBe(false);
  });

  it('refuses a passage carrying anything else, and a lesson missing a required field', () => {
    const document = lesson('p-1');
    const passages = document.passages as Record<string, unknown>[];
    const first = passages[0];
    expect(first).toBeDefined();
    if (first === undefined) return;
    expect(accepts({ ...document, passages: [{ ...first, note: 'extra' }] })).toBe(false);

    const { chapter: _chapter, ...withoutChapter } = document;
    expect(accepts(withoutChapter)).toBe(false);
  });
});

describe('every passage claim is keyed by its own id (ADR-0061 §2)', () => {
  it('finds one claim per passage and resolves the schema that identifies it', () => {
    // Anti-vacuum: every assertion below is "the keys are these", which an empty
    // claim list would satisfy by having none.
    const found = claimsIn(lesson('p-1', 'p-2'), WHERE);
    expect(found.length).toBe(2);
    expect(found.map((claim) => claim.pointer)).toEqual(['/passages/0/fact', '/passages/1/fact']);
    expect(identityOf(lesson('p-1', 'p-2')).resolved).toBe(true);
  });

  it('keys each grant by `[id=…]`, never by position', () => {
    const identity = identityOf(lesson('p-1', 'p-2'));
    expect(identity.faults).toEqual([]);
    expect(identity.drift).toEqual([]);
    expect([...identity.positional.keys()]).toEqual([]);
    expect([...identity.keys.values()]).toEqual([
      '/passages[id=p-1]/fact',
      '/passages[id=p-2]/fact',
    ]);
  });

  it('leaves a granted passage\'s key untouched when another is inserted above it', () => {
    // The whole reason the id is required. `p-2` does not move, however many
    // passages arrive ahead of it, so a grant on it is neither voided nor
    // re-read as a fresh grant in an authoring commit.
    const before = identityOf(lesson('p-1', 'p-2')).keys.get('/passages/1/fact');
    const after = identityOf(lesson('inserted', 'p-1', 'p-2')).keys.get('/passages/2/fact');
    expect(before).toBe('/passages[id=p-2]/fact');
    expect(after).toBe(before);
  });

  it('fails on two passages sharing an id, which ajv cannot see', () => {
    // `uniqueItems` compares whole items, so two passages with one id and
    // different words satisfy every schema keyword there is. Uniqueness is held
    // where identity is computed, and ADR-0024 makes an ambiguous identity a
    // failure rather than a guess.
    const document = lesson('p-1', 'p-1');
    expect(accepts(document)).toBe(true);

    const identity = identityOf(document);
    expect(identity.faults.length).toBeGreaterThan(0);
    expect(identity.faults.join('\n')).toContain('p-1');
    expect([...identity.ambiguous.keys()].length).toBeGreaterThan(0);
  });

  it('fails on a passage with no id, rather than falling back to its position', () => {
    const document = lesson('p-1', 'p-2');
    const passages = document.passages as Record<string, unknown>[];
    const second = passages[1];
    expect(second).toBeDefined();
    if (second === undefined) return;
    delete second.id;

    const identity = identityOf(document);
    expect(identity.faults.length).toBeGreaterThan(0);
    expect(identity.faults.join('\n')).toContain('carries no string');
    // The key itself records the hole, so a reader of a gate A failure can see
    // which item had no identity rather than only that something did not.
    expect(identity.keys.get('/passages/1/fact')).toContain('no-id');
  });
});

describe('the id requirement is what does the work, not the ids themselves', () => {
  it('collapses to positional keys against a schema that does not require an id', () => {
    /*
     * The counterfactual, run against a patched COPY of the shipped schema —
     * nothing broken is left on disk. If this case ever passes with the
     * `[id=…]` keys, the schema has stopped requiring `id` and every assertion
     * above has become a statement about a rule that is no longer enforced.
     */
    const withoutRequiredId = (schema: Record<string, unknown>): Record<string, unknown> => {
      const defs = schema.$defs as Record<string, Record<string, unknown>>;
      const passageSchema = defs.passage;
      if (passageSchema === undefined) throw new Error('lesson.schema.json declares no passage $def');
      return {
        ...schema,
        $defs: {
          ...defs,
          passage: {
            ...passageSchema,
            required: (passageSchema.required as string[]).filter((name) => name !== 'id'),
          },
        },
      };
    };

    const identity = identityOf(lesson('p-1', 'p-2'), registryWith(withoutRequiredId));

    expect([...identity.keys.values()]).toEqual(['/passages/0/fact', '/passages/1/fact']);
    // And the drift report is what would say so on a real corpus: every item
    // carries a distinct id and the schema no longer asks for one.
    expect(identity.drift.length).toBeGreaterThan(0);
    expect(identity.drift.join('\n')).toContain('POSITION');
    // The harm, stated as an assertion: a passage inserted above `p-2` now moves
    // `p-2`'s grant onto a different claim.
    const moved = identityOf(lesson('inserted', 'p-1', 'p-2'), registryWith(withoutRequiredId));
    expect(moved.keys.get('/passages/1/fact')).toBe('/passages/1/fact');
    expect(identity.keys.get('/passages/1/fact')).toBe('/passages/1/fact');
  });
});
