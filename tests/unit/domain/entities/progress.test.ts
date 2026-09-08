/**
 * The save aggregate: every update is a new value, and nothing that is not in
 * TN-SAVE's survives table is in it.
 */

import { describe, expect, it } from 'vitest';

import {
  emptyLevelProgress,
  hasStamp,
  isLevelUnlocked,
  levelProgressFor,
  newProgress,
  questStateFor,
  reviewFor,
  stampedLevelIds,
  withBestScore,
  withCharacter,
  withExamAttempt,
  withLevelUnlocked,
  withQuestState,
  withReview,
  withSettings,
  withStamp,
  withSubjectStarted,
  withUnlockedLevels,
} from '@domain/entities/progress';
import type { Progress } from '@domain/entities/progress';
import type { QuestState } from '@domain/entities/quest';
import { unseenRecord, recordAnswer } from '@domain/scheduling/review-record';

import {
  DAY,
  ORIGIN,
  at,
  characterId,
  levelId,
  questId,
  questionId,
  settings,
  subjectId,
} from '../../support/fixtures';

const base = (): Progress => newProgress(settings(), [levelId()]);

const questState = (overrides: Partial<QuestState> = {}): QuestState => ({
  questId: questId(),
  status: 'active',
  stepIndex: 1,
  stepProgress: 0,
  updatedAt: ORIGIN,
  ...overrides,
});

describe('a new game', () => {
  it('opens the levels the config opens and nothing else', () => {
    const progress = base();
    expect(progress.levels).toEqual([emptyLevelProgress(levelId(), true)]);
    expect(isLevelUnlocked(progress, levelId())).toBe(true);
    expect(isLevelUnlocked(progress, levelId('halifax'))).toBe(false);
  });

  it('holds nothing the story does not promise', () => {
    expect(Object.keys(base()).sort()).toEqual([
      'character',
      'exams',
      // The level last played, so the title screen can offer Continue. It is in
      // TN-SAVE's *survives* table; "which screen the player was on" is
      // explicitly in the does-not table (ADR-0023).
      'lastPlayedLevelId',
      'levels',
      'reviews',
      'settings',
      'subjectsStarted',
    ]);
  });
});

describe('quest state', () => {
  it('records a quest, then replaces it in place', () => {
    const offered = withQuestState(base(), levelId(), questState({ status: 'offered', stepIndex: 0 }));
    expect(questStateFor(offered, levelId(), questId())?.status).toBe('offered');

    const active = withQuestState(offered, levelId(), questState());
    expect(active.levels[0]?.quests).toHaveLength(1);
    expect(questStateFor(active, levelId(), questId())?.stepIndex).toBe(1);
    // The earlier value is untouched: every update is a new document.
    expect(questStateFor(offered, levelId(), questId())?.status).toBe('offered');
  });

  it('creates a level row for a level the save has never seen', () => {
    const elsewhere = withQuestState(base(), levelId('halifax'), questState());
    expect(levelProgressFor(elsewhere, levelId('halifax'))?.unlocked).toBe(true);
    expect(elsewhere.levels).toHaveLength(2);
  });

  it('has nothing to say about a quest nobody met', () => {
    expect(questStateFor(base(), levelId(), questId())).toBeUndefined();
    expect(questStateFor(base(), levelId('halifax'), questId())).toBeUndefined();
  });
});

describe('stamps', () => {
  it('records the moment the stamp was earned', () => {
    const stamped = withStamp(base(), levelId(), ORIGIN);
    expect(hasStamp(stamped, levelId())).toBe(true);
    expect(stampedLevelIds(stamped)).toEqual([levelId()]);
  });

  it('keeps the first moment however many times the quest finishes (TN-QUEST-04)', () => {
    const twice = withStamp(withStamp(base(), levelId(), ORIGIN), levelId(), at(ORIGIN + DAY));
    expect(levelProgressFor(twice, levelId())?.stampEarnedAt).toBe(ORIGIN);
    expect(stampedLevelIds(twice)).toHaveLength(1);
  });

  it('says no for a level with no row and for one with no stamp', () => {
    expect(hasStamp(base(), levelId())).toBe(false);
    expect(hasStamp(base(), levelId('halifax'))).toBe(false);
  });
});

describe('unlocking, scores and exams', () => {
  it('opens a level once and does not re-lock it', () => {
    const opened = withLevelUnlocked(withLevelUnlocked(base(), levelId('halifax')), levelId('halifax'));
    expect(opened.levels.filter((level) => level.levelId === levelId('halifax'))).toHaveLength(1);
    expect(isLevelUnlocked(opened, levelId('halifax'))).toBe(true);
  });

  it('opens a list of levels at once', () => {
    const opened = withUnlockedLevels(base(), [levelId('halifax'), levelId('victoria')]);
    expect(opened.levels.map((level) => level.levelId)).toEqual(['ottawa', 'halifax', 'victoria']);
  });

  it('keeps the better score', () => {
    const scored = withBestScore(withBestScore(base(), levelId(), 8), levelId(), 3);
    expect(levelProgressFor(scored, levelId())?.bestScore).toBe(8);
  });

  it('appends an exam attempt', () => {
    const attempted = withExamAttempt(base(), {
      startedAt: ORIGIN,
      finishedAt: at(ORIGIN + 1000),
      askedQuestionIds: [questionId('q-01')],
      correctCount: 1,
      passed: false,
      timed: true,
    });
    expect(attempted.exams).toHaveLength(1);
    expect(base().exams).toHaveLength(0);
  });
});

describe('reviews and subjects', () => {
  it('adds a review, then replaces the same question in place', () => {
    const first = withReview(base(), unseenRecord(questionId('q-01'), ORIGIN));
    const answered = recordAnswer(null, questionId('q-01'), false, ORIGIN);
    const second = withReview(first, answered.record);
    expect(second.reviews).toHaveLength(1);
    expect(reviewFor(second, questionId('q-01'))?.reps).toBe(1);
    expect(reviewFor(first, questionId('q-01'))?.reps).toBe(0);
    expect(reviewFor(second, questionId('q-02'))).toBeUndefined();
  });

  it('remembers a subject once', () => {
    const started = withSubjectStarted(base(), subjectId());
    expect(withSubjectStarted(started, subjectId())).toBe(started);
    expect(started.subjectsStarted).toEqual([subjectId()]);
  });
});

describe('the player half', () => {
  it('changes settings and records the character without touching progress', () => {
    const played = withStamp(base(), levelId(), ORIGIN);
    const french = withSettings(played, { locale: settings({}).locale, reducedMotion: true });
    expect(french.settings.reducedMotion).toBe(true);
    expect(stampedLevelIds(french)).toEqual([levelId()]);

    const dressed = withCharacter(french, { characterId: characterId('skater'), skins: { skin: 'skin-2' } });
    expect(dressed.character?.skins).toEqual({ skin: 'skin-2' });
    expect(french.character).toBeNull();
  });
});
