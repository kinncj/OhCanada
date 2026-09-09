/**
 * One quest finished, one stamp earned, one level opened — end to end, through
 * the same functions the game calls, against the **shipped** unlock rules.
 *
 * The three pieces existed and were each tested alone: `answerQuestion` earns
 * the stamp (`tests/unit/application/use-cases/answer-question.test.ts`),
 * `stampedLevelIds` reads the passport, `unlockedLevelIds` opens the next level
 * (`tests/unit/domain/entities/level.test.ts`). Nothing joined them, and the
 * join is where the game was broken: with the config as it shipped then, every
 * one of those suites passed while finishing the first level opened nothing at
 * all.
 *
 * `content/game.config.json` rather than a fixture, deliberately. A fixture
 * chain proves the rule; only the real one proves the game.
 *
 * ## Which level, and why it is not typed here
 *
 * Nothing below names a place. Which level the player starts on is
 * configuration — it was Ottawa, it is Halifax, and it moves again every time a
 * level ships — so the two levels this suite needs are read out of the rules it
 * is testing: {@link START_LEVEL} is whatever an empty passport opens, and
 * {@link NEXT_LEVEL} is the first level `order` charges a stamp for. The quest
 * played below is a fixture quest attached to `START_LEVEL`, so the walk is the
 * shipped chain's first step whatever that step is today. Both names are
 * interpolated into the test titles and the failure messages, so a failure still
 * reads as a sentence about a place.
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
import type { LevelId } from '@domain/ids';
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
  makeQuest,
  makeQuestion,
  questId,
  testClock,
} from '../../support/fixtures';

const parsed = readGameRules(gameConfigDocument);
if (!parsed.ok) throw new Error(`content/game.config.json did not parse: ${parsed.error.message}`);

/** The rules the shipped game runs on. Not a fixture, and that is the point. */
const rules: UnlockRules = parsed.value.unlockRules;

/** What the rules open for a passport with no stamps in it — where a player lands. */
const openAtBoot = unlockedLevelIds(rules, []);

/** Fail with the config change that caused it, rather than at `undefined` later. */
const levelOrThrow = (id: LevelId | undefined, why: string): LevelId => {
  if (id === undefined) throw new Error(why);
  return id;
};

/** The level a cold load opens. `unlockRules.initialLevels`' answer, not a name. */
const START_LEVEL = levelOrThrow(
  openAtBoot[0],
  'content/game.config.json opens no level with an empty passport, so there is no ' +
    'first quest to finish and the chain never takes a step.',
);

/**
 * The first level the chain makes a player *earn*.
 *
 * This is the guard, not a convenience: if every level in `order` were already
 * in `initialLevels` there would be nothing here, every assertion below would be
 * about a level that was handed out at boot, and the suite would pass over a
 * chain that unlocked nothing — which is exactly how the dead chain hid.
 */
const NEXT_LEVEL = levelOrThrow(
  rules.order.find((id) => !openAtBoot.includes(id)),
  'every level in unlockRules.order is already open at boot, so no stamp opens ' +
    'anything and there is no unlock left to test by playing.',
);

/** `unlockRules.stampsToUnlockNext`, floored the way the domain floors it. */
const STAMPS_PER_LEVEL = Math.max(1, Math.floor(rules.stampsToUnlockNext));

/*
 * A fixture quest, attached to whichever level the config starts on. The quest
 * documents in `content/` are another agent's to write and this suite is about
 * the join, so the shape is the fixture's — talk, visit, answer three — and only
 * the level it belongs to comes from the config.
 */
const quest: QuestDocument = makeQuest({ levelId: START_LEVEL });
const clock = testClock();

/**
 * Play the first level's quest the way the game plays it: talk to the officer
 * (which accepting the quest completes), reach the landmark, answer three
 * questions. The `visit` step goes through the domain rule directly because no
 * use case wraps it yet — the same seam `answer-question.test.ts` notes.
 */
const finishFirstLevel = (): Progress => {
  const offered = offerQuest({ clock }, { quest, progress: emptyProgress() });
  if (!offered.ok) throw new Error('the quest was not offered');

  const accepted = startQuest(
    { clock },
    { quest, progress: offered.value.progress, decision: 'accept' },
  );
  if (!accepted.ok) throw new Error('the quest was not accepted');

  const afterTalk = questStateFor(accepted.value.progress, START_LEVEL, questId());
  if (afterTalk === undefined) throw new Error('the quest has no state');

  const visited = progressQuest(quest, afterTalk, { kind: 'visit' }, clock.now());
  if (!visited.ok) throw new Error('the landmark was not engaged');

  let progress = withQuestState(accepted.value.progress, START_LEVEL, visited.value.state);

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

describe(`finishing the first level (${START_LEVEL}) opens the next one (${NEXT_LEVEL})`, () => {
  it('charges one stamp for the next level, which is what one quest pays', () => {
    /*
     * The premise every assertion below rests on, stated rather than assumed.
     * This suite finishes **one** quest, which earns **one** stamp; if the
     * config ever charges more, one quest stops opening anything and the
     * failures below would be about a chain that is working as configured. The
     * fix then is to walk further, not to weaken what follows.
     */
    expect(
      STAMPS_PER_LEVEL,
      `unlockRules.stampsToUnlockNext is ${STAMPS_PER_LEVEL}, so one finished quest no ` +
        'longer opens the next level and this suite has to play more of the chain',
    ).toBe(1);
  });

  it('is shut before the quest is finished', () => {
    const open = unlockedLevelIds(rules, stampedLevelIds(emptyProgress()));

    expect(
      open,
      `unlockRules.initialLevels opens ${START_LEVEL}, so a player with an empty ` +
        'passport has somewhere to start',
    ).toContain(`${START_LEVEL}`);
    expect(
      open,
      `${NEXT_LEVEL} is open before it is earned, which makes the stamp decorative`,
    ).not.toContain(`${NEXT_LEVEL}`);
  });

  it('puts the stamp in the passport when the last question is answered', () => {
    const progress = finishFirstLevel();

    expect(hasStamp(progress, START_LEVEL)).toBe(true);
    expect(stampedLevelIds(progress)).toEqual([`${START_LEVEL}`]);
  });

  it('opens the next level in the chain, which is what the stamp is for', () => {
    const open = unlockedLevelIds(rules, stampedLevelIds(finishFirstLevel()));

    expect(
      open,
      `the ${START_LEVEL} stamp is in the passport and the shipped unlock rules still ` +
        `do not open ${NEXT_LEVEL} — the dead chain, as a player would meet it`,
    ).toContain(`${NEXT_LEVEL}`);
  });

  it('opens exactly one level per stamp, and not the whole map', () => {
    const open = unlockedLevelIds(rules, stampedLevelIds(finishFirstLevel()));

    /* One stamp buys one level (`stampsToUnlockNext`), so a passport with one
       stamp opens what it started with and the one level after it — by name, so
       a chain that opened the whole map fails here and says what it opened. */
    expect(open).toEqual([...openAtBoot, `${NEXT_LEVEL}`]);
  });

  it('is idempotent: a quest finished twice is still one stamp and one unlock', () => {
    const once = finishFirstLevel();
    /* The quest is completed, so a further answer cannot advance it; the
       passport must not move either (TN-QUEST-04). */
    const again = answerQuestion(
      { clock },
      { question: makeQuestion('gov-04'), chosenIndex: 0, progress: once, quest },
    );
    expect(again.ok).toBe(true);
    if (!again.ok) return;

    expect(again.value.stampEarned).toBe(false);
    expect(stampedLevelIds(again.value.progress)).toEqual([`${START_LEVEL}`]);
    expect(unlockedLevelIds(rules, stampedLevelIds(again.value.progress))).toEqual([
      ...openAtBoot,
      `${NEXT_LEVEL}`,
    ]);
  });
});
