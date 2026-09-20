/**
 * Every `answer` step of every quest can actually be answered, in one sitting,
 * by a player who started this morning (ADR-0054).
 *
 * The fourth live-site audit found Peggy's Cove unfinishable, which left Québec
 * City and every level after it Locked for every new player. The lighthouse
 * promised three questions and asked one; the tracker read "Answer 3 questions"
 * for ever.
 *
 * Nothing about the documents was wrong, which is why
 * `an-answer-steps-pool-can-fill-its-count.test.ts` was green: that gate measures
 * a pool against a count, and this defect lived in the *sitting*. Unlocking
 * Peggy's Cove means finishing Halifax's task — nine questions, all new — and
 * `scheduler.dailyNewLimit` is ten, so the next step's draw came back with the
 * one that was left and then with none. A never-seen question the budget cut is
 * `due`, so the scheduler's relaxation pass could never bring it back.
 *
 * So this gate plays the game rather than reading it: every level in `journey`
 * order, on one UTC day, from one fresh save, through the real bank, the real
 * draw rule and the real session, answering everything it is asked. A step's
 * first draw must hand back its whole `count` — a short one is a step that can
 * only be finished by walking back to a landmark, and in this case not at all.
 *
 * The content is read off the disk, by a route the bundle never takes, so the
 * expectation comes from `content/` and not from the code under test.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createQuestionBank } from '@adapters/content';
import { createSeededRandom } from '@adapters/random';
import type { SchedulerTuning } from '@application/ports';
import { answerQuestion } from '@application/use-cases/answer-question';
import { createStudySession } from '@application/use-cases/study-session';
import { defaultSettings } from '@domain/entities/player';
import { newProgress } from '@domain/entities/progress';
import type { Progress } from '@domain/entities/progress';
import type { EpochMillis, LocaleCode, QuestionId, SubjectId } from '@domain/ids';

import { landmarkDraw, rememberAnswered } from '../../../app/bootstrap/landmark-questions';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

interface StepFile {
  readonly id: string;
  readonly kind: string;
  readonly targetId?: string;
  readonly count?: number;
  readonly questionPool?: readonly string[];
}
interface QuestFile {
  readonly id: string;
  readonly levelId: string;
  readonly steps: readonly StepFile[];
}
/** As much of a placed landmark as a walk needs: where it is, and what it tells. */
interface PoiFile {
  readonly id: string;
  readonly position: { readonly x: number };
  readonly fact?: { readonly source?: { readonly quote?: string } | null } | null;
}
interface LevelFile {
  readonly id: string;
  readonly subject: string;
  readonly pois?: readonly PoiFile[];
  readonly characters?: readonly {
    readonly characterId: string;
    readonly position: { readonly x: number };
  }[];
}

/** One thing the player comes to, in the order they come to it. */
interface Stop {
  readonly id: string;
  readonly x: number;
  /** The `source.quote` this stop teaches, when it teaches one. */
  readonly quote: string | undefined;
}

/**
 * Every engageable the level places, in the order a player walking right meets
 * it: its landmarks and the characters standing among them.
 *
 * Characters are in here because three of the ten quests are given by one, and a
 * walk that skipped them would never complete a `talk` step — so the quest would
 * never leave step 0 and every `answer` step after it would go unmeasured. That
 * is not a hypothetical: it is what the first draft of this walk did, and it
 * reported eight levels "stuck on meet-the-guide" while the game was fine.
 */
const stopsOf = (level: LevelFile): readonly Stop[] =>
  [
    ...(level.pois ?? []).map((poi) => ({
      id: poi.id,
      x: poi.position.x,
      quote: poi.fact?.source?.quote,
    })),
    ...(level.characters ?? []).map((character) => ({
      id: character.characterId,
      x: character.position.x,
      quote: undefined,
    })),
  ].sort((a, b) => a.x - b.x);
interface ConfigFile {
  readonly scheduler: SchedulerTuning;
  readonly study: { readonly drillSize: number };
  readonly journey: readonly string[];
}

const json = <T>(path: string): T => JSON.parse(readFileSync(`${REPO_ROOT}${path}`, 'utf8')) as T;

const jsonIn = (dir: string): readonly string[] =>
  readdirSync(`${REPO_ROOT}${dir}`)
    .filter((name) => name.endsWith('.json'))
    .sort();

const config = json<ConfigFile>('content/game.config.json');

const quests = jsonIn('content/quests').map((name) => json<QuestFile>(`content/quests/${name}`));

const levels = new Map(
  jsonIn('content/levels')
    .map((name) => json<LevelFile>(`content/levels/${name}`))
    .map((level) => [level.id, level] as const),
);

/** The levels in the order a player walks them, each with the quest it ships. */
const inJourneyOrder = config.journey.flatMap((levelId) => {
  const quest = quests.find((candidate) => candidate.levelId === levelId);
  const level = levels.get(levelId);
  return quest === undefined || level === undefined ? [] : [{ level, quest }];
});

/** 2026-01-05T09:00:00Z. Fixed, and one UTC day for the whole walk: one sitting. */
const MORNING = 1_767_603_600_000 as EpochMillis;

const clock = { now: (): EpochMillis => MORNING, elapsed: (): number => 0 };

describe('every answer step fills its count in one sitting (ADR-0054)', () => {
  it('has levels, quests and answer steps to walk, so this is about something (ADR-0024)', () => {
    expect(inJourneyOrder.length).toBeGreaterThan(0);
    expect(
      inJourneyOrder.flatMap(({ quest }) => quest.steps.filter((step) => step.kind === 'answer'))
        .length,
    ).toBeGreaterThan(0);
  });

  it('asks a first-day player every question its quests promise', async () => {
    let progress: Progress = newProgress(defaultSettings('en' as LocaleCode));

    const session = createStudySession({
      bank: createQuestionBank({}),
      clock,
      random: createSeededRandom(2026),
      progress: () => progress,
      tuning: config.scheduler,
      drillSize: config.study.drillSize,
    });

    for (const { level, quest } of inJourneyOrder) {
      /* One opening of the level: what it has answered is its own (ADR-0048). */
      let answeredHere: readonly QuestionId[] = [];

      for (const step of quest.steps) {
        if (step.kind !== 'answer') continue;
        const required = step.count ?? 1;
        const where = `content/quests/${quest.id}.json step "${step.id}"`;

        const draw = landmarkDraw({
          levelSubject: level.subject as SubjectId,
          answering: {
            step: {
              subject: level.subject as SubjectId,
              ...(step.questionPool === undefined
                ? {}
                : { questionPool: step.questionPool as unknown as readonly QuestionId[] }),
            },
            done: 0,
            required,
          },
          teaches: [],
          answeredHere,
        });

        const drill = await session.drill(draw.count, draw.scope);
        expect(drill.ok, `${where}: the bank refused the draw`).toBe(true);
        if (!drill.ok) return;

        expect(
          drill.value.questions.length,
          `${where} asks ${String(required)} question(s) and the game handed back ` +
            `${String(drill.value.questions.length)}. A player who has answered ` +
            `everything before this point today cannot finish this step, so the quest ` +
            `never completes, no stamp is earned, and every level after this one stays ` +
            `locked (ADR-0054).`,
        ).toBe(required);

        /* Nothing is repeated to make the number up: these are questions the
           player has not met, not the same one asked twice (ADR-0048). */
        expect(drill.value.repeated ?? 0, `${where} repeated a question to fill its count`).toBe(0);

        /* Answer them, so the next step and the next level meet the player this
           one has made: the day's new questions are spent exactly as they would be. */
        for (const asked of drill.value.questions) {
          const answered = answerQuestion(
            { clock },
            { question: asked.question, chosenIndex: 0, progress },
          );
          expect(answered.ok, `${where}: ${String(asked.question.id)} could not be answered`).toBe(
            true,
          );
          if (!answered.ok) return;
          progress = answered.value.progress;
          answeredHere = rememberAnswered(answeredHere, asked.question.id);
        }
      }
    }
  });

  /**
   * The same day, walked rather than summarised.
   *
   * The test above asks each `answer` step in isolation: it visits no landmark
   * that has no task, it never lets a stop teach the draw what it just told, and
   * it takes the steps in document order rather than in the order the player
   * meets their targets. All three are simplifications, and each one hides a way
   * a promised count could come back short:
   *
   *  - **a stop with no task still draws** (ADR-0048 rule 5), and that draw is
   *    still paced by `dailyNewLimit` (ADR-0054 exempts only a promised count).
   *    So the stops between the task's steps spend the day's budget, and the
   *    budget they leave is what the next promised count meets;
   *  - **what a landmark just told is asked first** (ADR-0036 rule 4). A
   *    preference is resolved over the whole bank and then narrowed to the
   *    step's pool, so a pool with no slack — seven steps ship one — is drawn
   *    through a different branch of `scheduleReview` than a pool with room;
   *  - **the giver is a stop too.** Three quests are given by a character and
   *    seven by a landmark, and accepting one finishes its opening `talk` step,
   *    which is what puts the player on the `answer` step that is then asked
   *    *at the giver* (`onAccepted`, ADR-0036). A walk that skipped characters
   *    would leave those quests on step 0 for ever and measure nothing.
   *
   * So this walks every level in `journey` order and every engageable it places
   * in the order a player going right comes to them, advances the quest through
   * the same rules the domain uses, and requires two things: every promised
   * count is handed back whole, and **the quest finishes**. The second is the
   * one the player cares about — an unfinished quest is no stamp, and no stamp
   * is every later level locked.
   *
   * Seen to fail: with `dailyNewLimitApplies: false` taken out of
   * `landmark-questions.ts` — that is, with ADR-0054 reverted — this reports
   * Peggy's Cove asking 1 of 3 at the lighthouse and 0 of 2 at both stops after
   * it, its quest stuck on `answer-at-the-light`, and the same shape in six more
   * levels. That is the audit ADR-0054 was written for, and it is what this gate
   * is here to keep from coming back.
   */
  it('finishes every level’s task, walking its stops in the order a player meets them', async () => {
    let progress: Progress = newProgress(defaultSettings('en' as LocaleCode));

    const session = createStudySession({
      bank: createQuestionBank({}),
      clock,
      random: createSeededRandom(2026),
      progress: () => progress,
      tuning: config.scheduler,
      drillSize: config.study.drillSize,
    });

    for (const { level, quest } of inJourneyOrder) {
      /* One opening of the level: what it has answered is its own (ADR-0048). */
      let answeredHere: readonly QuestionId[] = [];
      /* The quest as the domain holds it: which step, and how far into it. */
      let stepIndex = 0;
      let stepProgress = 0;

      for (const stop of stopsOf(level)) {
        /* A `talk`, `visit` or `collect` step whose target this is completes on
           arrival, before anything is asked — `quests.visited()` runs before the
           card, and accepting an offer completes the opening `talk` step in the
           same move (`acceptQuest`). */
        const arrivedAt = quest.steps[stepIndex];
        if (
          arrivedAt !== undefined &&
          arrivedAt.kind !== 'answer' &&
          arrivedAt.targetId === stop.id
        ) {
          stepIndex += 1;
          stepProgress = 0;
        }

        const step = quest.steps[stepIndex];
        const playing = step !== undefined && step.kind === 'answer' ? step : undefined;
        const required = playing === undefined ? 0 : Math.max(1, playing.count ?? 1);

        const draw = landmarkDraw({
          levelSubject: level.subject as SubjectId,
          answering:
            playing === undefined
              ? undefined
              : {
                  step: {
                    subject: level.subject as SubjectId,
                    ...(playing.questionPool === undefined
                      ? {}
                      : {
                          questionPool: playing.questionPool as unknown as readonly QuestionId[],
                        }),
                  },
                  done: stepProgress,
                  required,
                },
          /* What this stop tells the player, which is asked first when a
             question in scope rests on it (ADR-0036 rule 4). */
          teaches: stop.quote === undefined ? [] : [stop.quote],
          answeredHere,
        });

        const drill = await session.drill(draw.count, draw.scope);
        if (!drill.ok) {
          /* A stop with nothing left to ask is the level quietly carrying on
             (ADR-0048). A task step the bank refuses is the blocker itself. */
          expect(
            playing,
            `${level.id}/${stop.id}: the bank refused a task draw. ${drill.error.message}`,
          ).toBeUndefined();
          continue;
        }

        if (playing !== undefined) {
          const where = `content/quests/${quest.id}.json step "${playing.id}", asked at ${stop.id}`;
          expect(
            drill.value.questions.length,
            `${where}: the tracker promised ${String(draw.count)} question(s) and the game ` +
              `handed back ${String(drill.value.questions.length)}. A player who has walked ` +
              `every stop before this one today cannot finish this step, so the quest never ` +
              `completes, no stamp is earned, and every level after this one stays locked ` +
              `(ADR-0054).`,
          ).toBe(draw.count);
          /* Nothing repeated to make the number up: these are questions the
             player has not met here, not one asked twice (ADR-0048). */
          expect(drill.value.repeated ?? 0, `${where}: a question was repeated to fill it`).toBe(0);
        }

        for (const asked of drill.value.questions) {
          const answered = answerQuestion(
            { clock },
            { question: asked.question, chosenIndex: 0, progress },
          );
          expect(
            answered.ok,
            `${level.id}/${stop.id}: ${String(asked.question.id)} could not be answered`,
          ).toBe(true);
          if (!answered.ok) return;
          progress = answered.value.progress;
          answeredHere = rememberAnswered(answeredHere, asked.question.id);
          if (playing === undefined) continue;
          stepProgress += 1;
          if (stepProgress >= required) {
            stepIndex += 1;
            stepProgress = 0;
          }
        }
      }

      expect(
        stepIndex,
        `${level.id}: walking every stop left the quest "${quest.id}" on step ` +
          `"${quest.steps[stepIndex]?.id ?? '?'}" with ` +
          `${String(quest.steps.length - stepIndex)} step(s) unfinished, so its stamp is never ` +
          `earned and every level after it stays locked (ADR-0036, ADR-0054).`,
      ).toBe(quest.steps.length);
    }
  });
});
