/**
 * The first save-format migration, tested the way the tripwire it replaces
 * demanded (ADR-0015, amended).
 *
 * `save-format-version-is-still-one.test.ts` existed to fail exactly once, on
 * the day a second version was written, and its failure message listed what had
 * to land beside it. This file is item (2) of that list, kept in its own file
 * rather than folded into the codec's suite because it is a *contract* — it
 * says what an existing player's save is owed when the format moves — and
 * because it is what the next migration copies.
 *
 * The version-1 document is derived from this build's own `encode`, not written
 * by hand: a hand-written fixture drifts from what the previous build actually
 * wrote, and a migration tested against a fixture nobody ever stored proves
 * nothing about the save on a real device. Since this build can no longer *write*
 * version 1, the fixture is made by applying the exact inverse of every migration
 * to a real current document. That inverse is visible below and is the only
 * honest way to hold a document a build can no longer produce.
 *
 * **The file is still named for the first migration and now covers two**, which
 * is right: what it protects is the *version-1 document*, not any one step. The
 * second step (2 -> 3, ADR-0027) is the first that cannot carry everything
 * forward — a version-2 exam attempt recorded a total where version 3 records
 * twenty outcomes — so this file now also states, in a case of its own, exactly
 * what a version-1 save loses and that it loses nothing else.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createJsonSaveCodec } from '@application/persistence/json-save-codec';
import { SAVE_MIGRATIONS } from '@application/persistence/save-migrations';
import { toProgressSnapshot } from '@application/persistence/progress-document';
import type { ProgressSnapshot } from '@application/ports/progress-repository';
import { DEFAULT_HOLD_TO_CHOOSE_MS } from '@domain/entities/player';
import {
  withBestScore,
  withCharacter,
  withExamAttempt,
  withQuestState,
  withReview,
  withStamp,
  withSubjectStarted,
  withSettings,
} from '@domain/entities/progress';
import type { Progress } from '@domain/entities/progress';

import {
  DAY,
  HOUR,
  ORIGIN,
  at,
  characterId,
  emptyProgress,
  levelId,
  locale,
  questId,
  questionId,
  subjectId,
} from '../support/fixtures';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const config = JSON.parse(readFileSync(`${REPO_ROOT}content/game.config.json`, 'utf8')) as {
  readonly save: { readonly maxImportBytes: number };
};

/** The codec the composition root builds: this build's version, with its steps. */
const codec = createJsonSaveCodec({
  maxImportBytes: config.save.maxImportBytes,
  migrations: SAVE_MIGRATIONS,
});

/** A build with no migrations wired in, to show the step is what does the work. */
const bareCodec = createJsonSaveCodec({ maxImportBytes: config.save.maxImportBytes });

/**
 * A save worth losing: a character, French, three review states in three
 * different phases, two quests in two different states, a stamp, a best score,
 * a subject started and a finished exam.
 */
const playedGame = (): Progress => {
  let progress = withCharacter(emptyProgress(), {
    characterId: characterId('newcomer'),
    skins: { skin: 'skin-2', coat: 'coat-blue' },
  });
  progress = withSettings(progress, {
    locale: locale('fr'),
    reducedMotion: true,
    textScale: 1.5,
    singleSwitch: true,
    holdToChooseMs: 2_000,
  });
  progress = withQuestState(progress, levelId(), {
    questId: questId(),
    status: 'active',
    stepIndex: 2,
    stepProgress: 1,
    updatedAt: at(ORIGIN - HOUR),
  });
  progress = withQuestState(progress, levelId(), {
    questId: questId('ottawa-peace-tower'),
    status: 'declined',
    stepIndex: 0,
    stepProgress: 0,
    updatedAt: at(ORIGIN - 2 * HOUR),
  });
  progress = withStamp(progress, levelId(), at(ORIGIN - DAY));
  progress = withBestScore(progress, levelId(), 18);
  progress = withSubjectStarted(progress, subjectId());
  for (const [index, phase] of (['learning', 'review', 'relearning'] as const).entries()) {
    progress = withReview(progress, {
      questionId: questionId(`government-${index + 1}`),
      dueAt: at(ORIGIN + (index + 1) * DAY),
      stability: 3.5 + index,
      difficulty: 5.25 + index,
      reps: index + 2,
      lapses: index,
      lastReviewedAt: at(ORIGIN - (index + 1) * HOUR),
      firstReviewedAt: at(ORIGIN - 10 * DAY),
      phase,
      learningSteps: index,
    });
  }
  return withExamAttempt(progress, {
    startedAt: at(ORIGIN - 3 * DAY),
    finishedAt: at(ORIGIN - 3 * DAY + 20 * 60_000),
    answers: [
      {
        questionId: questionId('government-1'),
        subjectId: subjectId(),
        chosenIndex: 2,
        correctIndex: 2,
      },
      {
        questionId: questionId('government-2'),
        subjectId: subjectId(),
        chosenIndex: null,
        correctIndex: 1,
      },
    ],
    passed: true,
    timed: true,
  });
};

const current = (): ProgressSnapshot => {
  const written = toProgressSnapshot(playedGame(), { version: codec.version, updatedAt: ORIGIN });
  if (!written.ok) throw new Error('the fixture must be encodable by this build');
  return written.value;
};

/** What this build's document looks like once the exams are gone. */
const currentWithoutExams = (): ProgressSnapshot => ({ ...current(), exams: [] });

/**
 * The same save as the version-1 build wrote it, by inverting every step.
 *
 *  - 2 -> 3 (`dropVersionTwoExams`): put the exams back in the shape version 2
 *    wrote — `askedQuestionIds` and a `correctCount`, no `answers` — and remove
 *    `examInProgress`, which version 2 had no field for.
 *  - 1 -> 2 (`addHoldToChooseMs`): drop the setting version 2 added.
 *
 * The inverse grew in the open, as the previous version of this comment said it
 * would. It is worth reading as a description of what version 2 could hold: one
 * total per attempt, and nowhere at all for an exam still being taken.
 */
const version1Bytes = (): string => {
  const { settings, exams, examInProgress: _noSuchField, ...rest } = current();
  const { holdToChooseMs: _dropped, ...settingsWithout } = settings;
  return JSON.stringify({
    ...rest,
    version: 1,
    settings: settingsWithout,
    exams: exams.map((attempt) => ({
      startedAt: attempt.startedAt,
      finishedAt: attempt.finishedAt,
      askedQuestionIds: attempt.answers.map((answer) => answer.questionId),
      correctCount: attempt.answers.filter(
        (answer) => answer.chosenIndex === answer.correctIndex,
      ).length,
      passed: attempt.passed,
      timed: attempt.timed,
    })),
  });
};

describe('a version-1 save is read by this build, whole', () => {
  it('is refused before the migration, so the step is what does the work', () => {
    const refused = bareCodec.decode(version1Bytes());
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.error.kind).toBe('unsupported');
      expect(refused.error.code).toBe('save.migration.missing');
    }
  });

  it('decodes into this build\'s document, with the new setting at its default', () => {
    const decoded = codec.decode(version1Bytes());
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.version).toBe(codec.version);
    expect(decoded.value.settings.holdToChooseMs).toBe(DEFAULT_HOLD_TO_CHOOSE_MS);
    // Everything the format did not change is byte-for-byte what it was, and
    // the two things it did change are the two named here and nothing else.
    expect(decoded.value).toEqual({
      ...currentWithoutExams(),
      settings: { ...current().settings, holdToChooseMs: DEFAULT_HOLD_TO_CHOOSE_MS },
    });
  });

  it('keeps every review state, in every phase, with its scheduling intact', () => {
    const decoded = codec.decode(version1Bytes());
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.reviews).toEqual(current().reviews);
    expect(decoded.value.reviews.map((review) => review.phase)).toEqual([
      'learning',
      'review',
      'relearning',
    ]);
    // The two fields a migration is most likely to drop, because nothing else
    // reads them: without either one a drill silently restarts (ADR-0012).
    for (const review of decoded.value.reviews) {
      expect(review.firstReviewedAt).not.toBeNull();
      expect(review.learningSteps).toBeTypeOf('number');
    }
  });

  it('keeps every quest state, including the declined one', () => {
    const decoded = codec.decode(version1Bytes());
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const quests = decoded.value.levels.flatMap((level) => level.quests);
    expect(quests).toEqual(current().levels.flatMap((level) => level.quests));
    expect(quests.map((quest) => quest.status).sort()).toEqual(['active', 'declined']);
  });

  it('keeps the stamp, the best score, the character and the subjects started', () => {
    const decoded = codec.decode(version1Bytes());
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.levels[0]?.stampEarnedAt).toBe(current().levels[0]?.stampEarnedAt);
    expect(decoded.value.levels[0]?.bestScore).toBe(18);
    expect(decoded.value.character).toEqual(current().character);
    expect(decoded.value.subjectsStarted).toEqual(current().subjectsStarted);
  });

  it('loses the exam it was carrying, and loses nothing else', () => {
    /*
     * The one thing this format change cannot carry, asserted rather than left
     * to a doc comment (ADR-0027). A version-2 attempt holds `correctCount: 1`
     * and a list of ids; a version-3 attempt holds, per question, the subject,
     * the option chosen and the option that was right. Those were never written,
     * so the alternatives were to drop the attempt or to invent them — and the
     * invention reads on a result screen as "answered nothing, got nothing
     * wrong" (ADR-0024).
     */
    const before = JSON.parse(version1Bytes()) as { readonly exams: readonly unknown[] };
    expect(before.exams).toHaveLength(1);

    const decoded = codec.decode(version1Bytes());
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.exams).toEqual([]);
    // Dropped, not half-converted: no attempt survives with its answers blanked.
    expect(JSON.stringify(decoded.value)).not.toContain('chosenIndex');
    // And no exam is offered for the player to "finish": absent, not empty.
    expect(decoded.value.examInProgress).toBeNull();
  });

  it('re-encodes what it migrated, so the next save is this build\'s version', () => {
    const decoded = codec.decode(version1Bytes());
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const written = codec.encode(decoded.value);
    expect(written.ok).toBe(true);
    if (!written.ok) return;
    const again = codec.decode(written.value);
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.value).toEqual(decoded.value);
  });

  it('still refuses a version-1 document that was never a save', () => {
    // Migrated first, validated after: the step must not make a broken document
    // look acceptable by giving it one more property.
    const broken = codec.decode('{"version":1,"settings":{},"levels":"all of them"}');
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.error.code).toBe('save.schema.invalid');
  });

  it('refuses a save from a build newer than this one, without migrating it', () => {
    const newer = JSON.stringify({ ...current(), version: codec.version + 1 });
    const decoded = codec.decode(newer);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.error.code).toBe('save.version.newer');
  });
});
