/**
 * ADR-0036: what reaching the end of a level is worth.
 *
 * The passport promises "You earn a stamp when you finish a level's task". Until
 * this rule existed the composition root wrote the stamp on every arrival, so a
 * player who walked past every landmark was told "You earned the Ottawa stamp.
 * You did not answer any questions here." — the first case below is that
 * sentence, refused.
 */

import { describe, expect, it } from 'vitest';

import { reachLevelEnd } from '@domain/entities/level-end';
import { hasStamp, newProgress, withQuestState, withStamp } from '@domain/entities/progress';
import type { Progress } from '@domain/entities/progress';
import type { QuestStatus } from '@domain/entities/quest';

import { ORIGIN, at, levelId, questId, settings } from '../../support/fixtures';

const LEVEL = levelId('ottawa');
const QUEST = questId('ottawa-parliament-hill');
const LATER = at(ORIGIN + 60_000);

const base = (): Progress => newProgress(settings(), [LEVEL]);

const withQuest = (progress: Progress, status: QuestStatus): Progress =>
  withQuestState(progress, LEVEL, {
    questId: QUEST,
    status,
    stepIndex: 1,
    stepProgress: 0,
    updatedAt: ORIGIN,
  });

describe('reaching the end of a level', () => {
  it('earns no stamp when the task was never started', () => {
    const outcome = reachLevelEnd(base(), { levelId: LEVEL, questIds: [QUEST], now: LATER });

    expect(outcome.kind).toBe('unfinished');
    expect(hasStamp(outcome.progress, LEVEL)).toBe(false);
  });

  it('earns no stamp while the task is being played', () => {
    const outcome = reachLevelEnd(withQuest(base(), 'active'), {
      levelId: LEVEL,
      questIds: [QUEST],
      now: LATER,
    });

    expect(outcome.kind).toBe('unfinished');
    expect(hasStamp(outcome.progress, LEVEL)).toBe(false);
  });

  it('earns no stamp for a task that was offered or declined', () => {
    for (const status of ['offered', 'declined'] as const) {
      const outcome = reachLevelEnd(withQuest(base(), status), {
        levelId: LEVEL,
        questIds: [QUEST],
        now: LATER,
      });
      expect(outcome.kind, status).toBe('unfinished');
    }
  });

  it('hands back the save untouched when nothing was earned', () => {
    const progress = withQuest(base(), 'active');
    const outcome = reachLevelEnd(progress, { levelId: LEVEL, questIds: [QUEST], now: LATER });
    expect(outcome.progress).toBe(progress);
  });

  it('earns the stamp for a level whose task is complete and whose stamp is missing', () => {
    const outcome = reachLevelEnd(withQuest(base(), 'completed'), {
      levelId: LEVEL,
      questIds: [QUEST],
      now: LATER,
    });

    expect(outcome).toMatchObject({ kind: 'finished', stampEarned: true });
    expect(hasStamp(outcome.progress, LEVEL)).toBe(true);
  });

  it('earns the stamp for a level that sets no task at all', () => {
    const outcome = reachLevelEnd(base(), { levelId: LEVEL, questIds: [], now: LATER });

    expect(outcome).toMatchObject({ kind: 'finished', stampEarned: true });
    expect(hasStamp(outcome.progress, LEVEL)).toBe(true);
  });

  it('is finished, and earns nothing twice, when the stamp is already in the passport', () => {
    const stamped = withStamp(base(), LEVEL, ORIGIN);
    const outcome = reachLevelEnd(stamped, { levelId: LEVEL, questIds: [QUEST], now: LATER });

    expect(outcome).toMatchObject({ kind: 'finished', stampEarned: false });
    /* The first moment is kept, never moved. */
    expect(outcome.progress).toBe(stamped);
  });

  it('never takes a stamp away, even from a level whose task is unfinished', () => {
    /* A save written by a build that stamped on arrival keeps what it earned. */
    const stamped = withStamp(withQuest(base(), 'active'), LEVEL, ORIGIN);
    const outcome = reachLevelEnd(stamped, { levelId: LEVEL, questIds: [QUEST], now: LATER });

    expect(outcome.kind).toBe('finished');
    expect(hasStamp(outcome.progress, LEVEL)).toBe(true);
  });

  it('reads only this level: a task finished elsewhere finishes nothing here', () => {
    const elsewhere = withQuestState(base(), levelId('halifax'), {
      questId: QUEST,
      status: 'completed',
      stepIndex: 1,
      stepProgress: 0,
      updatedAt: ORIGIN,
    });
    const outcome = reachLevelEnd(elsewhere, { levelId: LEVEL, questIds: [QUEST], now: LATER });
    expect(outcome.kind).toBe('unfinished');
  });
});
