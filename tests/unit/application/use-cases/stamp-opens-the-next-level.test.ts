/**
 * One quest finished, one stamp earned, one level opened — end to end, through
 * the same functions the game calls, against the **shipped** unlock rules.
 *
 * The three pieces existed and were each tested alone: `answerQuestion` earns
 * the stamp (`tests/unit/application/use-cases/answer-question.test.ts`),
 * `stampedLevelIds` reads the passport, `unlockedLevelIds` opens the next level
 * (`tests/unit/domain/entities/level.test.ts`). Nothing joined them, and the
 * join is where the game was broken: with the config as shipped, every one of
 * those suites passed while finishing Ottawa opened nothing at all.
 *
 * `content/game.config.json` rather than a fixture, deliberately. A fixture
 * chain proves the rule; only the real one proves the game.
 *
 * TN-QUEST-04 (the stamp is earned once, and a wrong answer still finishes the
 * quest), TN-MAP-01, `OQ-MAP-4`.
 */

import { describe, expect, it } from 'vitest';

import gameConfigDocument from '@content/game.config.json';
/* Relative, not aliased: there is no `@bootstrap` alias and adding one means
   editing three configs that have to agree (tsconfig, vite, vitest). */
import { readGameRules } from '../../../../app/bootstrap/game-rules';
import { answerQuestion } from '@application/use-cases/answer-question';
import { offerQuest, startQuest } from '@application/use-cases/start-quest';
import type { QuestDocument } from '@application/ports/content-repository';
import { unlockedLevelIds, type UnlockRules } from '@domain/entities/level';
import { progressQuest } from '@domain/entities/quest';
import {
  hasStamp,
  questStateFor,
  stampedLevelIds,
  withQuestState,
  type Progress,
} from '@domain/entities/progress';

import {
  emptyProgress,
  levelId,
  makeQuest,
  makeQuestion,
  questId,
  testClock,
} from '../../support/fixtures';

const parsed = readGameRules(gameConfigDocument);
if (!parsed.ok) throw new Error(`content/game.config.json did not parse: ${parsed.error.message}`);

/** The rules the shipped game runs on. Not a fixture, and that is the point. */
const rules: UnlockRules = parsed.value.unlockRules;

const quest: QuestDocument = makeQuest();
const clock = testClock();

/**
 * Play Ottawa's quest the way the game plays it: talk to the officer (which
 * accepting the quest completes), find the Peace Tower, answer three questions.
 * The `visit` step goes through the domain rule directly because no use case
 * wraps it yet — the same seam `answer-question.test.ts` notes.
 */
const finishOttawa = (): Progress => {
  const offered = offerQuest({ clock }, { quest, progress: emptyProgress() });
  if (!offered.ok) throw new Error('the quest was not offered');

  const accepted = startQuest(
    { clock },
    { quest, progress: offered.value.progress, decision: 'accept' },
  );
  if (!accepted.ok) throw new Error('the quest was not accepted');

  const afterTalk = questStateFor(accepted.value.progress, levelId('ottawa'), questId());
  if (afterTalk === undefined) throw new Error('the quest has no state');

  const visited = progressQuest(quest, afterTalk, { kind: 'visit' }, clock.now());
  if (!visited.ok) throw new Error('the landmark was not engaged');

  let progress = withQuestState(accepted.value.progress, levelId('ottawa'), visited.value.state);

  for (const id of ['gov-01', 'gov-02', 'gov-03']) {
    const answered = answerQuestion(
      { clock },
      { question: makeQuestion(id), chosenIndex: 0, progress, quest },
    );
    if (!answered.ok) throw new Error(`the answer to ${id} was refused`);
    progress = answered.value.progress;
  }

  return progress;
};

describe('finishing Ottawa opens the next level', () => {
  it('is shut before the quest is finished', () => {
    const open = unlockedLevelIds(rules, stampedLevelIds(emptyProgress()));

    expect(open).toContain('ottawa');
    expect(
      open,
      'a level that is open before it is earned makes the stamp decorative',
    ).not.toContain('quebec-city');
  });

  it('puts the stamp in the passport when the last question is answered', () => {
    const progress = finishOttawa();

    expect(hasStamp(progress, levelId('ottawa'))).toBe(true);
    expect(stampedLevelIds(progress)).toEqual(['ottawa']);
  });

  it('opens Québec City, which is what the stamp is for', () => {
    const open = unlockedLevelIds(rules, stampedLevelIds(finishOttawa()));

    expect(
      open,
      'the Ottawa stamp is in the passport and the shipped unlock rules still ' +
        'open nothing — the dead chain, as a player would meet it',
    ).toContain('quebec-city');
  });

  it('opens exactly one level per stamp, and not the whole map', () => {
    const open = unlockedLevelIds(rules, stampedLevelIds(finishOttawa()));

    /* One stamp buys one level (`stampsToUnlockNext`), so a passport with one
       stamp opens the level it started on and the one after it. */
    expect(open).toHaveLength(2);
  });

  it('is idempotent: a quest finished twice is still one stamp and one unlock', () => {
    const once = finishOttawa();
    /* The quest is completed, so a further answer cannot advance it; the
       passport must not move either (TN-QUEST-04). */
    const again = answerQuestion(
      { clock },
      { question: makeQuestion('gov-04'), chosenIndex: 0, progress: once, quest },
    );
    expect(again.ok).toBe(true);
    if (!again.ok) return;

    expect(again.value.stampEarned).toBe(false);
    expect(stampedLevelIds(again.value.progress)).toEqual(['ottawa']);
    expect(unlockedLevelIds(rules, stampedLevelIds(again.value.progress))).toHaveLength(2);
  });
});
