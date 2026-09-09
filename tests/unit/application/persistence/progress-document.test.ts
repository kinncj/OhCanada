/**
 * The one crossing between the domain's `EpochMillis` and the document's
 * `IsoInstant` (ADR-0012), tested by round-tripping rather than by reading
 * fields back one at a time.
 */

import { describe, expect, it } from 'vitest';

import {
  PROGRESS_SCHEMA_ID,
  fromProgressSnapshot,
  toProgressSnapshot,
} from '@application/persistence/progress-document';
import {
  withCharacter,
  withExamAttempt,
  withQuestState,
  withReview,
  withSettings,
  withStamp,
  withSubjectStarted,
} from '@domain/entities/progress';
import type { Progress } from '@domain/entities/progress';
import { recordAnswer } from '@domain/scheduling/review-record';

import {
  DAY,
  ORIGIN,
  at,
  characterId,
  emptyProgress,
  levelId,
  locale,
  questId,
  questionId,
  subjectId,
} from '../../support/fixtures';

const playedProgress = (): Progress => {
  const wrong = recordAnswer(null, questionId('gov-01'), false, ORIGIN);
  const right = recordAnswer(null, questionId('gov-02'), true, at(ORIGIN + 60_000));
  return withExamAttempt(
    withStamp(
      withSubjectStarted(
        withReview(
          withReview(
            withQuestState(
              withSettings(
                withCharacter(emptyProgress(), {
                  characterId: characterId('skater'),
                  skins: { skin: 'skin-2', coat: 'coat-blue' },
                }),
                { locale: locale('fr'), reducedMotion: true, textScale: 1.5 },
              ),
              levelId(),
              { questId: questId(), status: 'active', stepIndex: 2, stepProgress: 2, updatedAt: ORIGIN },
            ),
            wrong.record,
          ),
          right.record,
        ),
        subjectId(),
      ),
      levelId(),
      at(ORIGIN + DAY),
    ),
    {
      startedAt: ORIGIN,
      finishedAt: at(ORIGIN + 20 * 60_000),
      answers: [
        // One right, one wrong, one never answered: the three states a result
        // has to tell apart, so the round trip is exercised on all three.
        { questionId: questionId('gov-01'), subjectId: subjectId(), chosenIndex: 2, correctIndex: 2 },
        { questionId: questionId('gov-02'), subjectId: subjectId(), chosenIndex: 0, correctIndex: 3 },
        { questionId: questionId('gov-03'), subjectId: subjectId(), chosenIndex: null, correctIndex: 1 },
      ],
      passed: false,
      timed: false,
    },
  );
};

/** The same game, still taking an exam: the other half of the format. */
const midExamProgress = (): Progress => ({
  ...playedProgress(),
  examInProgress: {
    startedAt: at(ORIGIN + 2 * DAY),
    answers: [
      { questionId: questionId('gov-04'), subjectId: subjectId(), chosenIndex: 1, correctIndex: 1 },
      { questionId: questionId('gov-05'), subjectId: subjectId(), chosenIndex: null, correctIndex: 0 },
    ],
    remainingMs: 14 * 60_000,
  },
});

const header = { version: 1, updatedAt: at(ORIGIN + DAY) };

describe('writing the document', () => {
  it('names the schema it validates against', () => {
    const written = toProgressSnapshot(emptyProgress(), header);
    expect(written.ok).toBe(true);
    if (written.ok) {
      expect(written.value.$schema).toBe(PROGRESS_SCHEMA_ID);
      expect(written.value.updatedAt).toBe(new Date(ORIGIN + DAY).toISOString());
    }
  });

  it('refuses a version that is not a whole number from 1', () => {
    for (const version of [0, -1, 1.5]) {
      const written = toProgressSnapshot(emptyProgress(), { ...header, version });
      expect(written.ok).toBe(false);
      if (!written.ok) expect(written.error.code).toBe('save.version.invalid');
    }
  });

  it('refuses an instant it cannot express, wherever it sits', () => {
    const broken = withStamp(emptyProgress(), levelId(), at(Number.NaN));
    expect(toProgressSnapshot(broken, header).ok).toBe(false);

    const brokenReview = withReview(emptyProgress(), {
      ...recordAnswer(null, questionId('gov-01'), true, ORIGIN).record,
      dueAt: at(Number.POSITIVE_INFINITY),
    });
    expect(toProgressSnapshot(brokenReview, header).ok).toBe(false);

    const brokenQuest = withQuestState(emptyProgress(), levelId(), {
      questId: questId(),
      status: 'active',
      stepIndex: 0,
      stepProgress: 0,
      updatedAt: at(1.5),
    });
    expect(toProgressSnapshot(brokenQuest, header).ok).toBe(false);

    const brokenExam = withExamAttempt(emptyProgress(), {
      startedAt: at(Number.NaN),
      finishedAt: at(ORIGIN),
      answers: [
        { questionId: questionId('gov-01'), subjectId: subjectId(), chosenIndex: null, correctIndex: 0 },
      ],
      passed: false,
      timed: false,
    });
    expect(toProgressSnapshot(brokenExam, header).ok).toBe(false);

    const brokenInProgress: Progress = {
      ...emptyProgress(),
      examInProgress: {
        startedAt: at(Number.NaN),
        answers: [
          { questionId: questionId('gov-01'), subjectId: subjectId(), chosenIndex: null, correctIndex: 0 },
        ],
        remainingMs: null,
      },
    };
    expect(toProgressSnapshot(brokenInProgress, header).ok).toBe(false);

    expect(toProgressSnapshot(emptyProgress(), { ...header, updatedAt: at(Number.NaN) }).ok).toBe(
      false,
    );
  });
});

describe('the round trip', () => {
  it('gives back exactly the game that was written', () => {
    const progress = playedProgress();
    const written = toProgressSnapshot(progress, header);
    expect(written.ok).toBe(true);
    if (!written.ok) return;

    const read = fromProgressSnapshot(written.value, locale());
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value).toEqual(progress);
  });

  it('gives back an exam still in progress, with its answers and its clock', () => {
    const progress = midExamProgress();
    const written = toProgressSnapshot(progress, header);
    expect(written.ok).toBe(true);
    if (!written.ok) return;
    // The document says the same thing the domain does: a duration stays a
    // number on both sides, because it is a length of time and not a point in
    // one, and an unanswered question is null on both sides.
    expect(written.value.examInProgress?.remainingMs).toBe(14 * 60_000);
    expect(written.value.examInProgress?.answers[1]?.chosenIndex).toBeNull();

    const read = fromProgressSnapshot(written.value, locale());
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.value).toEqual(progress);
  });

  it('survives being written as JSON and parsed back', () => {
    const progress = playedProgress();
    const written = toProgressSnapshot(progress, header);
    expect(written.ok).toBe(true);
    if (!written.ok) return;

    const reparsed = JSON.parse(JSON.stringify(written.value)) as typeof written.value;
    const read = fromProgressSnapshot(reparsed, locale());
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.value).toEqual(progress);
  });

  it('renames only where the schema and the domain disagree, and nowhere else', () => {
    const progress = playedProgress();
    const written = toProgressSnapshot(progress, header);
    expect(written.ok).toBe(true);
    if (!written.ok) return;
    const review = written.value.reviews[0];
    const record = progress.reviews[0];
    expect(review).toBeDefined();
    expect(record).toBeDefined();
    // due <-> dueAt and lastReview <-> lastReviewedAt are the only two.
    expect(review?.due).toBe(new Date(record?.dueAt ?? 0).toISOString());
    expect(review?.lastReview).toBe(new Date(record?.lastReviewedAt ?? 0).toISOString());
    expect(Object.keys(review ?? {}).sort()).toEqual([
      'difficulty',
      'due',
      'firstReviewedAt',
      'lapses',
      'lastReview',
      'learningSteps',
      'phase',
      'questionId',
      'reps',
      'stability',
    ]);
  });

  it('clamps settings on the way in, so a hand-edited file cannot break the first screen', () => {
    const written = toProgressSnapshot(playedProgress(), header);
    expect(written.ok).toBe(true);
    if (!written.ok) return;
    const tampered = {
      ...written.value,
      settings: { ...written.value.settings, textScale: 40, locale: locale('de') },
    };
    const read = fromProgressSnapshot(tampered, locale('en'));
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.value.settings.textScale).toBe(2);
      expect(read.value.settings.locale).toBe('en');
    }
  });

  it('refuses a timestamp that is not an instant, wherever it sits', () => {
    const written = toProgressSnapshot(playedProgress(), header);
    expect(written.ok).toBe(true);
    if (!written.ok) return;
    const snapshot = written.value;

    const brokenLevel = {
      ...snapshot,
      levels: snapshot.levels.map((level) => ({ ...level, stampEarnedAt: 'yesterday' as never })),
    };
    expect(fromProgressSnapshot(brokenLevel, locale()).ok).toBe(false);

    const brokenQuest = {
      ...snapshot,
      levels: snapshot.levels.map((level) => ({
        ...level,
        quests: level.quests.map((quest) => ({ ...quest, updatedAt: '2024-02-30T00:00:00Z' as never })),
      })),
    };
    expect(fromProgressSnapshot(brokenQuest, locale()).ok).toBe(false);

    const brokenReview = {
      ...snapshot,
      reviews: snapshot.reviews.map((review) => ({ ...review, due: 'soon' as never })),
    };
    expect(fromProgressSnapshot(brokenReview, locale()).ok).toBe(false);

    const brokenLastReview = {
      ...snapshot,
      reviews: snapshot.reviews.map((review) => ({ ...review, lastReview: 'soon' as never })),
    };
    expect(fromProgressSnapshot(brokenLastReview, locale()).ok).toBe(false);

    const brokenFirstReview = {
      ...snapshot,
      reviews: snapshot.reviews.map((review) => ({ ...review, firstReviewedAt: 'soon' as never })),
    };
    expect(fromProgressSnapshot(brokenFirstReview, locale()).ok).toBe(false);

    const brokenExam = {
      ...snapshot,
      exams: snapshot.exams.map((exam) => ({ ...exam, startedAt: 'soon' as never })),
    };
    expect(fromProgressSnapshot(brokenExam, locale()).ok).toBe(false);

    const brokenExamEnd = {
      ...snapshot,
      exams: snapshot.exams.map((exam) => ({ ...exam, finishedAt: 'soon' as never })),
    };
    expect(fromProgressSnapshot(brokenExamEnd, locale()).ok).toBe(false);
  });
});
