/**
 * The save migrations this build ships: 1 -> 2 and 2 -> 3.
 *
 * A migration runs on a document that has been parsed and version-gated and
 * nothing else — the schema check comes after it — so half of what is asserted
 * here is about input the step does not recognise. A migration that threw, or
 * that "repaired" something it had not understood, would turn a save the player
 * could still download into one nobody can read.
 */

import { describe, expect, it } from 'vitest';

import { CURRENT_SAVE_VERSION } from '@application/persistence/json-save-codec';
import {
  SAVE_MIGRATIONS,
  addHoldToChooseMs,
  dropVersionTwoExams,
} from '@application/persistence/save-migrations';
import { DEFAULT_HOLD_TO_CHOOSE_MS } from '@domain/entities/player';

const apply = (document: Record<string, unknown>): Record<string, unknown> => {
  const migrated = addHoldToChooseMs.apply(document);
  expect(migrated.ok).toBe(true);
  if (!migrated.ok) throw new Error('this step never fails');
  return migrated.value;
};

describe('1 -> 2: the switch hold time becomes a saved setting', () => {
  it('is the first of the two steps this build ships', () => {
    expect(SAVE_MIGRATIONS).toEqual([addHoldToChooseMs, dropVersionTwoExams]);
    expect(addHoldToChooseMs.from).toBe(1);
    expect(addHoldToChooseMs.to).toBe(2);
  });

  it('gives a version-1 save the hold time the game ships with', () => {
    const migrated = apply({ version: 1, settings: { autoMove: true, singleSwitch: true } });
    expect(migrated['version']).toBe(2);
    expect(migrated['settings']).toEqual({
      autoMove: true,
      singleSwitch: true,
      holdToChooseMs: DEFAULT_HOLD_TO_CHOOSE_MS,
    });
  });

  it('does not mutate the document it was given', () => {
    const before = { version: 1, settings: { autoMove: false } };
    apply(before);
    expect(before).toEqual({ version: 1, settings: { autoMove: false } });
  });

  it('keeps a hold time that is somehow already there', () => {
    const migrated = apply({ version: 1, settings: { holdToChooseMs: 1_200 } });
    expect(migrated['settings']).toEqual({ holdToChooseMs: 1_200 });
  });

  it('replaces a hold time that is not a usable number', () => {
    for (const broken of ['1200', null, Number.NaN, {}]) {
      const migrated = apply({ version: 1, settings: { holdToChooseMs: broken } });
      expect(migrated['settings']).toEqual({ holdToChooseMs: DEFAULT_HOLD_TO_CHOOSE_MS });
    }
  });

  it('leaves settings it does not recognise exactly as they were', () => {
    // Not repaired, not dropped: the schema check that runs next says what is
    // wrong with it, in the language of a JSON pointer.
    for (const settings of [undefined, null, 'off', [], 7]) {
      const migrated = apply({ version: 1, settings });
      expect(migrated['version']).toBe(2);
      expect(migrated['settings']).toBe(settings);
    }
  });

  it('carries every other property through untouched', () => {
    const migrated = apply({
      version: 1,
      settings: {},
      levels: [{ levelId: 'ottawa' }],
      reviews: [{ questionId: 'q-1' }],
    });
    expect(migrated['levels']).toEqual([{ levelId: 'ottawa' }]);
    expect(migrated['reviews']).toEqual([{ questionId: 'q-1' }]);
  });
});

/* -------------------------------------------------------------------------- */
/* 2 -> 3                                                                     */
/* -------------------------------------------------------------------------- */

const migrate = (document: Record<string, unknown>): Record<string, unknown> => {
  const migrated = dropVersionTwoExams.apply(document);
  expect(migrated.ok).toBe(true);
  if (!migrated.ok) throw new Error('this step never fails');
  return migrated.value;
};

/** A version-2 attempt, in the shape version 2 actually wrote. */
const version2Attempt = (): Record<string, unknown> => ({
  startedAt: '2026-09-01T10:00:00.000Z',
  finishedAt: '2026-09-01T10:20:00.000Z',
  askedQuestionIds: ['gov-01', 'gov-02'],
  correctCount: 16,
  passed: true,
  timed: true,
});

describe('2 -> 3: the exam record becomes the exam', () => {
  it('is the second step, and it moves the version', () => {
    expect(dropVersionTwoExams.from).toBe(2);
    expect(dropVersionTwoExams.to).toBe(3);
  });

  it('drops a version-2 attempt rather than inventing the answers it never held', () => {
    const migrated = migrate({ version: 2, exams: [version2Attempt()] });
    expect(migrated['version']).toBe(3);
    expect(migrated['exams']).toEqual([]);
    // The alternative was twenty answers with `chosenIndex: null`, which would
    // print a player's 16 out of 20 as "answered nothing, got nothing wrong"
    // (ADR-0024, ADR-0027). Nothing here fabricates a subject, a choice or a key.
    expect(JSON.stringify(migrated)).not.toContain('chosenIndex');
    expect(JSON.stringify(migrated)).not.toContain('correctCount');
  });

  it('opens the exam in progress as absent, not as an empty one', () => {
    // `null` is "no exam to finish". An empty object or an attempt with no
    // answers would both be an exam the resume screen would offer.
    expect(migrate({ version: 2, exams: [] })['examInProgress']).toBeNull();
  });

  it('leaves an `exams` it does not understand exactly as it found it', () => {
    for (const exams of [undefined, null, 'none', 7, {}]) {
      const migrated = migrate({ version: 2, exams });
      expect(migrated['version']).toBe(3);
      expect(migrated['exams']).toBe(exams);
    }
  });

  it('does not mutate the document it was given', () => {
    const before = { version: 2, exams: [version2Attempt()] };
    migrate(before);
    expect(before.version).toBe(2);
    expect(before.exams).toHaveLength(1);
  });

  it('carries every other property through untouched', () => {
    const migrated = migrate({
      version: 2,
      exams: [version2Attempt()],
      levels: [{ levelId: 'ottawa' }],
      reviews: [{ questionId: 'gov-01' }],
      subjectsStarted: ['government'],
    });
    expect(migrated['levels']).toEqual([{ levelId: 'ottawa' }]);
    expect(migrated['reviews']).toEqual([{ questionId: 'gov-01' }]);
    expect(migrated['subjectsStarted']).toEqual(['government']);
  });

  it('is dropping attempts no build that could write one ever wrote', () => {
    /*
     * The step's justification, pinned rather than asserted in prose.
     *
     * It used to be pinned the other way round: no file under `app/` called
     * `withExamAttempt`, so no build could produce a version-2 attempt for this
     * step to reach. **Exam mode has landed and that case has done its job** —
     * `app/bootstrap/exam.ts` files an attempt now, through
     * `app/application/use-cases/exam-attempt.ts` — and the case retired itself
     * exactly as its own comment instructed.
     *
     * What is left is the claim that survived: an attempt is only ever written
     * by a build that writes **version 3**, so the document this step drops
     * attempts from is still one no player can be holding. `CURRENT_SAVE_VERSION`
     * is what makes that true, so `CURRENT_SAVE_VERSION` is what is asserted.
     */
    expect(CURRENT_SAVE_VERSION).toBe(3);
    expect(dropVersionTwoExams.from).toBe(2);
    expect(dropVersionTwoExams.to).toBe(CURRENT_SAVE_VERSION);
  });
});
