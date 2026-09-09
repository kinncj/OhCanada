/**
 * An exam attempt with no answers is refused, and refused differently from one
 * with no `answers` at all (ADR-0024, ADR-0027).
 *
 * The reduction this guards is the one ADR-0024 names: for an empty list of
 * answers, *every* number the result screen draws is the number a perfect,
 * unremarkable attempt would produce. Nought wrong. Nought unanswered. No
 * by-subject row to contradict the `passed` flag sitting beside it. The identity
 * element coincides with the success value, and that is the property, not the
 * emptiness.
 *
 * Two states, two refusals, and they are not the same state:
 *
 *   - **absent** — `answers` is missing. The document is not an attempt; it is
 *     refused for a missing required property, at the property's own path.
 *   - **empty** — `answers: []`. The document says an exam was taken and names
 *     no question of it. Refused by the floor, at the array's own path.
 *
 * Every case below builds a **real save**, through `toProgressSnapshot`, and then
 * takes something out of it. Nothing here hand-writes a document to fit the
 * assertion: a fixture written to fail proves that the fixture is wrong, not
 * that the schema is right.
 *
 * Both validators are run on every case — ajv over the real
 * `content/schemas/progress.schema.json`, and the shipped
 * `validateProgressDocument` that `SaveCodec.decode` actually calls — because a
 * floor only one of them holds is a floor a player's save never meets.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

import { toProgressSnapshot } from '@application/persistence/progress-document';
import { validateProgressDocument } from '@application/persistence/progress-schema';
import type { ProgressSnapshot } from '@application/ports/progress-repository';
import {
  answeredCountOf,
  correctCountOf,
  withExamAttempt,
} from '@domain/entities/progress';
import type { ExamAnswer } from '@domain/entities/progress';

import { DAY, ORIGIN, at, emptyProgress, questionId, subjectId } from '../support/fixtures';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv);
const schemaFile = (name: string): object =>
  JSON.parse(readFileSync(`${REPO_ROOT}content/schemas/${name}`, 'utf8')) as object;
ajv.addSchema(schemaFile('common.schema.json'));
const validateWithAjv = ajv.compile(schemaFile('progress.schema.json'));

const ajvAccepts = (document: unknown): boolean => validateWithAjv(document) === true;
const codecAccepts = (document: unknown): boolean => validateProgressDocument(document).ok;

const violationsOf = (document: unknown): readonly string[] => {
  const checked = validateProgressDocument(document);
  if (checked.ok) return [];
  const details = checked.error.details as { readonly violations?: readonly string[] };
  return details.violations ?? [];
};

const answers: readonly ExamAnswer[] = [
  { questionId: questionId('gov-01'), subjectId: subjectId(), chosenIndex: 3, correctIndex: 3 },
  { questionId: questionId('gov-02'), subjectId: subjectId(), chosenIndex: null, correctIndex: 1 },
];

/** A save with one finished attempt and one exam still being taken. */
const saveWithAnExam = (): ProgressSnapshot => {
  const played = withExamAttempt(emptyProgress(), {
    startedAt: ORIGIN,
    finishedAt: at(ORIGIN + 1_800_000),
    answers,
    passed: true,
    timed: true,
  });
  const written = toProgressSnapshot(
    { ...played, examInProgress: { startedAt: at(ORIGIN + DAY), answers, remainingMs: 840_000 } },
    { version: 3, updatedAt: at(ORIGIN + DAY) },
  );
  if (!written.ok) throw new Error('the fixture must be a document this build can write');
  return written.value;
};

type Json = Record<string, unknown>;

const parsed = (): Json => JSON.parse(JSON.stringify(saveWithAnExam())) as Json;

/** The document with one path emptied, and the document with it removed. */
const without = (mutate: (document: Json) => void): Json => {
  const document = parsed();
  mutate(document);
  return document;
};

describe('an exam attempt that names no question is not an attempt', () => {
  it('starts from a document both validators accept, or nothing below means anything', () => {
    const save = parsed();
    expect(ajvAccepts(save), JSON.stringify(validateWithAjv.errors)).toBe(true);
    expect(codecAccepts(save)).toBe(true);
  });

  it('is the reduction being guarded against: empty answers count as nothing wrong', () => {
    // Not a claim about the schema — a demonstration of why the floor exists.
    // These are the three numbers the result screen draws, over no answers.
    expect(correctCountOf([])).toBe(0);
    expect(answeredCountOf([])).toBe(0);
    expect([].length - answeredCountOf([])).toBe(0);
  });

  it('refuses a finished attempt whose answers were taken away', () => {
    const emptied = without((document) => {
      const exams = document.exams as Json[];
      (exams[0] as Json).answers = [];
    });
    expect(ajvAccepts(emptied)).toBe(false);
    expect(codecAccepts(emptied)).toBe(false);
    expect(violationsOf(emptied).join('\n')).toContain('/exams/0/answers');
  });

  it('refuses a finished attempt with no answers property at all', () => {
    const removed = without((document) => {
      const exams = document.exams as Json[];
      delete (exams[0] as Json).answers;
    });
    expect(ajvAccepts(removed)).toBe(false);
    expect(codecAccepts(removed)).toBe(false);
    expect(violationsOf(removed).join('\n')).toContain('/exams/0/answers is required');
  });

  it('tells the two apart, because they are two different states', () => {
    const emptied = without((document) => {
      ((document.exams as Json[])[0] as Json).answers = [];
    });
    const removed = without((document) => {
      delete ((document.exams as Json[])[0] as Json).answers;
    });
    // Same path, different sentence: "there is no such property" and "there are
    // no answers in it" are not the same defect and must not read as one.
    expect(violationsOf(emptied)).not.toEqual(violationsOf(removed));
    expect(violationsOf(emptied).join('\n')).toContain('at least 1');
    expect(violationsOf(removed).join('\n')).toContain('is required');
  });

  it('refuses an exam in progress that has been emptied the same way', () => {
    const emptied = without((document) => {
      (document.examInProgress as Json).answers = [];
    });
    const removed = without((document) => {
      delete (document.examInProgress as Json).answers;
    });
    for (const broken of [emptied, removed]) {
      expect(ajvAccepts(broken)).toBe(false);
      expect(codecAccepts(broken)).toBe(false);
    }
    // An exam with no questions would be offered by the resume screen as an exam
    // to finish, and would open on nothing.
    expect(violationsOf(emptied).join('\n')).toContain('/examInProgress/answers');
  });

  it('distinguishes no exam in progress from no record of one', () => {
    const none = without((document) => {
      document.examInProgress = null;
    });
    const missing = without((document) => {
      delete document.examInProgress;
    });
    // `null` is a state the game writes: nothing to finish. An absent field is a
    // document this build did not write, and it is refused rather than read as
    // "no exam" — the same reason `lastPlayedLevelId` is required and nullable.
    expect(ajvAccepts(none)).toBe(true);
    expect(codecAccepts(none)).toBe(true);
    expect(ajvAccepts(missing)).toBe(false);
    expect(codecAccepts(missing)).toBe(false);
    expect(violationsOf(missing).join('\n')).toContain('/examInProgress is required');
  });

  it('still accepts a game where no exam has ever been taken', () => {
    // `exams: []` carries no floor and must not acquire one: no exam taken is
    // the normal state of a new game, and nothing folds it into a verdict.
    const fresh = without((document) => {
      document.exams = [];
      document.examInProgress = null;
    });
    expect(ajvAccepts(fresh)).toBe(true);
    expect(codecAccepts(fresh)).toBe(true);
  });

  it('refuses an answer that was answered and is missing what it was graded against', () => {
    // The floor is on the list; this is the floor on the item. An answer with no
    // `correctIndex` cannot be scored at all, so the attempt containing it would
    // score zero and read as twenty wrong answers.
    const removed = without((document) => {
      delete (((document.exams as Json[])[0] as Json).answers as Json[])[0]!.correctIndex;
    });
    expect(ajvAccepts(removed)).toBe(false);
    expect(codecAccepts(removed)).toBe(false);
  });
});
