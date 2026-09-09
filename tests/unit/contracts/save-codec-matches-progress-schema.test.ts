/**
 * `SaveCodec.decode` validates against `content/schemas/progress.schema.json`.
 *
 * That is what the port promises and what slice 1 task 1.6's acceptance says.
 * The codec cannot *run* the schema — `application-no-frameworks` keeps ajv and
 * the `content/` tree out of the application layer, and dragging a JSON Schema
 * compiler into the initial payload to read one document a session would be a
 * poor trade against the 8 MB budget — so the validator is written out in
 * `app/application/persistence/progress-schema.ts` and this test is what makes
 * "validates against the schema" a fact rather than a claim.
 *
 * The method is the one ADR-0012 used for the memory model: run the real
 * authority (ajv, over the real schema file) and the shipped code against the
 * same inputs, and fail unless they agree on *every* one. The inputs are a valid
 * save and several hundred single-property mutations of it — a deleted required
 * property, a wrong type, an out-of-range number, an unknown property, a broken
 * id, a date that does not exist — because a validator that only ever sees valid
 * documents proves nothing.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

import { validateProgressDocument } from '@application/persistence/progress-schema';
import { toProgressSnapshot } from '@application/persistence/progress-document';
import type { ProgressSnapshot } from '@application/ports/progress-repository';
import { recordAnswer } from '@domain/scheduling/review-record';
import {
  withCharacter,
  withQuestState,
  withReview,
  withStamp,
  withSubjectStarted,
} from '@domain/entities/progress';

import {
  DAY,
  ORIGIN,
  at,
  characterId,
  emptyProgress,
  levelId,
  questId,
  questionId,
  subjectId,
} from '../support/fixtures';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/* -------------------------------------------------------------------------- */
/* the authority                                                              */
/* -------------------------------------------------------------------------- */

// Configured exactly as scripts/validate-content.mjs configures it, or this
// test would be checking against a different validator from the content gate.
const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv);

const schemaFile = (name: string): object =>
  JSON.parse(readFileSync(`${REPO_ROOT}content/schemas/${name}`, 'utf8')) as object;

ajv.addSchema(schemaFile('common.schema.json'));
const validateWithAjv = ajv.compile(schemaFile('progress.schema.json'));

const ajvAccepts = (document: unknown): boolean => validateWithAjv(document) === true;
const codecAccepts = (document: unknown): boolean => validateProgressDocument(document).ok;

/* -------------------------------------------------------------------------- */
/* a real save, built the way the game builds one                             */
/* -------------------------------------------------------------------------- */

const validSave = (): ProgressSnapshot => {
  const answered = recordAnswer(null, questionId('gov-01'), false, ORIGIN);
  const settled = recordAnswer(
    recordAnswer(null, questionId('gov-02'), true, ORIGIN).record,
    questionId('gov-02'),
    true,
    at(ORIGIN + DAY),
  );

  const progress = withStamp(
    withSubjectStarted(
      withReview(
        withReview(
          withQuestState(
            withCharacter(emptyProgress(), {
              characterId: characterId('skater'),
              skins: { skin: 'skin-2', coat: 'coat-blue' },
            }),
            levelId(),
            {
              questId: questId(),
              status: 'active',
              stepIndex: 2,
              stepProgress: 2,
              updatedAt: ORIGIN,
            },
          ),
          answered.record,
        ),
        settled.record,
      ),
      subjectId(),
    ),
    levelId(),
    at(ORIGIN + DAY),
  );

  const snapshot = toProgressSnapshot(
    {
      ...progress,
      exams: [
        {
          startedAt: ORIGIN,
          finishedAt: at(ORIGIN + 1_800_000),
          answers: [
            {
              questionId: questionId('gov-01'),
              subjectId: subjectId(),
              chosenIndex: 3,
              correctIndex: 3,
            },
            // Unanswered, so every mutation of a null `chosenIndex` is exercised
            // against both validators rather than only the answered case.
            {
              questionId: questionId('gov-02'),
              subjectId: subjectId(),
              chosenIndex: null,
              correctIndex: 0,
            },
          ],
          passed: true,
          timed: true,
        },
      ],
      examInProgress: {
        startedAt: at(ORIGIN + DAY),
        answers: [
          {
            questionId: questionId('gov-03'),
            subjectId: subjectId(),
            chosenIndex: 1,
            correctIndex: 2,
          },
        ],
        remainingMs: 840_000,
      },
    },
    { version: 1, updatedAt: at(ORIGIN + DAY) },
  );
  if (!snapshot.ok) throw new Error('the fixture must produce a valid snapshot');
  return snapshot.value;
};

/* -------------------------------------------------------------------------- */
/* mutations                                                                  */
/* -------------------------------------------------------------------------- */

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

interface Mutation {
  readonly what: string;
  readonly document: Json;
}

const clone = (value: Json): Json => JSON.parse(JSON.stringify(value)) as Json;

/** Replace whatever sits at `path` (an array of keys/indices) with `replacement`. */
const replaceAt = (document: Json, path: readonly (string | number)[], replacement: Json): Json => {
  const copy = clone(document);
  let node = copy as Record<string | number, Json>;
  for (const step of path.slice(0, -1)) node = node[step] as Record<string | number, Json>;
  const last = path[path.length - 1];
  if (last !== undefined) node[last] = replacement;
  return copy;
};

const deleteAt = (document: Json, path: readonly (string | number)[]): Json => {
  const copy = clone(document);
  let node = copy as Record<string | number, Json>;
  for (const step of path.slice(0, -1)) node = node[step] as Record<string | number, Json>;
  const last = path[path.length - 1];
  if (last === undefined) return copy;
  if (Array.isArray(node)) (node as unknown as Json[]).splice(Number(last), 1);
  else delete node[last];
  return copy;
};

/** Values chosen to sit on the edges of the schema's constraints. */
const REPLACEMENTS: readonly Json[] = [
  null,
  true,
  0,
  -1,
  1.5,
  3,
  '',
  'x',
  'NOT-an-id',
  'not an id',
  'a'.repeat(65),
  'never',
  '2024-02-30T00:00:00Z',
  '2024-03-01',
  [],
  {},
];

const mutationsOf = (document: Json, path: readonly (string | number)[] = []): Mutation[] => {
  const pointer = `/${path.join('/')}`;
  const node = path.reduce<Json>(
    (value, step) => (value as Record<string | number, Json>)[step] as Json,
    document,
  );
  const found: Mutation[] = [];

  if (path.length > 0) {
    found.push({ what: `${pointer} deleted`, document: deleteAt(document, path) });
    for (const replacement of REPLACEMENTS) {
      found.push({
        what: `${pointer} = ${JSON.stringify(replacement)}`,
        document: replaceAt(document, path, replacement),
      });
    }
  }

  if (Array.isArray(node)) {
    found.push({
      what: `${pointer} repeats its first entry`,
      document: replaceAt(document, path, [...node, node[0] ?? null] as Json),
    });
    node.forEach((_entry, index) => found.push(...mutationsOf(document, [...path, index])));
  } else if (typeof node === 'object' && node !== null) {
    found.push({
      what: `${pointer} gains an unknown property`,
      document: replaceAt(document, path, { ...node, unexpected: 'value' } as Json),
    });
    // A renamed key, which is `additionalProperties` for a fixed object and
    // `propertyNames` for a free map like `character.skins` — two different
    // schema keywords that a value-only mutation never reaches.
    const [firstKey] = Object.keys(node);
    if (firstKey !== undefined) {
      const { [firstKey]: moved, ...rest } = node;
      found.push({
        what: `${pointer}/${firstKey} renamed`,
        document: replaceAt(document, path, { ...rest, 'Renamed Key': moved } as Json),
      });
    }
    for (const key of Object.keys(node)) found.push(...mutationsOf(document, [...path, key]));
  }

  return found;
};

/* -------------------------------------------------------------------------- */
/* the gate                                                                   */
/* -------------------------------------------------------------------------- */

describe('the shipped save validator agrees with progress.schema.json', () => {
  const save = validSave() as unknown as Json;

  it('is judging a document both validators accept, or every mutation is meaningless', () => {
    expect(ajv.errors ?? []).toEqual([]);
    expect(ajvAccepts(save), JSON.stringify(validateWithAjv.errors)).toBe(true);
    expect(codecAccepts(save)).toBe(true);
    // The document must exercise every branch worth mutating: a character, a
    // level with a quest mid-step, two reviews, a subject, an exam.
    const document = save as Record<string, Json>;
    expect(document.character).not.toBeNull();
    expect((document.levels as Json[]).length).toBeGreaterThan(0);
    expect((document.reviews as Json[]).length).toBeGreaterThan(1);
    expect((document.subjectsStarted as Json[]).length).toBeGreaterThan(0);
    expect((document.exams as Json[]).length).toBeGreaterThan(0);
    expect(document.examInProgress).not.toBeNull();
  });

  it('agrees with ajv on every single-property mutation of it', () => {
    const mutations = mutationsOf(save);
    expect(mutations.length).toBeGreaterThan(300);
    // Most of these must actually be *rejected*, or "we agree" would only mean
    // "we both wave everything through" — the vacuum this project keeps finding.
    const refusedByAjv = mutations.filter((mutation) => !ajvAccepts(mutation.document));
    expect(refusedByAjv.length).toBeGreaterThan(mutations.length * 0.75);

    const disagreements = mutations
      .filter((mutation) => ajvAccepts(mutation.document) !== codecAccepts(mutation.document))
      .map(
        (mutation) =>
          `${mutation.what}: ajv ${ajvAccepts(mutation.document) ? 'accepts' : 'refuses'}, ` +
          `the codec ${codecAccepts(mutation.document) ? 'accepts' : 'refuses'}`,
      );

    expect(disagreements, disagreements.join('\n')).toEqual([]);
  });

  it('agrees with ajv about things that are not documents at all', () => {
    for (const value of [null, 7, 'save', [], [validSave()], true]) {
      expect(codecAccepts(value)).toBe(ajvAccepts(value));
    }
  });

  it('reports what was wrong, located, rather than only that something was', () => {
    const broken = replaceAt(save, ['levels', 0, 'quests', 0, 'status'], 'abandoned');
    const checked = validateProgressDocument(broken);
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.error.code).toBe('save.schema.invalid');
    expect(JSON.stringify(checked.error.details)).toContain('/levels/0/quests/0/status');
  });
});
