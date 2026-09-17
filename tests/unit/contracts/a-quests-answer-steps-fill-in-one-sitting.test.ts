/**
 * Every `answer` step of every quest can actually be answered, in one sitting,
 * by a player who started this morning (ADR-0053).
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
  readonly count?: number;
  readonly questionPool?: readonly string[];
}
interface QuestFile {
  readonly id: string;
  readonly levelId: string;
  readonly steps: readonly StepFile[];
}
interface LevelFile {
  readonly id: string;
  readonly subject: string;
}
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

describe('every answer step fills its count in one sitting (ADR-0053)', () => {
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
            `locked (ADR-0053).`,
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
});
