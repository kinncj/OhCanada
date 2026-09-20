/**
 * A landmark asks however long the day has been, and the day's new-question
 * budget binds Study and nothing else (ADR-0062, amending ADR-0054).
 *
 * The product owner's ruling: a player who walks up to a landmark should always
 * be asked something, no matter how much they have already played today. A quest
 * `answer` step was exempted from `scheduler.dailyNewLimit` by ADR-0054 because
 * the tracker had already promised a count; ADR-0062 widens that to every draw a
 * level makes, landmark stops included.
 *
 * ## Three claims, and which of them was seen to fail
 *
 *  1. **The rule is stated where the draw is built.** Every scope `landmarkDraw`
 *     returns — with a task step being played and without one — carries
 *     `dailyNewLimitApplies: false`. **Seen to fail on `origin/main` (44936d5):
 *     35 of the 70 landmark draws the shipped levels produce came back
 *     `undefined`**, which is "paced like a Study drill". That is this gate's
 *     failing case, measured before the change rather than imagined.
 *
 *  2. **A stop keeps asking past the budget.** A whole journey walked with every
 *     task declined — so every draw is a landmark's own — introduces more new
 *     questions than the day's limit, and the stops reached after the limit is
 *     spent still ask. Lifting the budget to a number that can bind nothing
 *     changes not one draw.
 *
 *     This claim is green on `origin/main` too, and the comment says so rather
 *     than letting a reader assume otherwise: a stop outside a task sets
 *     `onlyWhatItTells`, and `scheduleReview` answers that branch from what the
 *     stop told and returns **before** `selectQuestions`, so the budget is never
 *     consulted. The ruling held by accident of routing. Claim 1 is what turns
 *     it into a rule — measured: with `onlyWhatItTells` dropped, which is what a
 *     stop allowed to ask wider than its own sentence looks like, `origin/main`
 *     asks 18 questions in a whole journey and **falls silent at 17 stops** past
 *     the budget, first at `quebec-city/terrace-kiosk`; this branch asks 35 and
 *     falls silent at none.
 *
 *  3. **Study still obeys.** After that same sitting a Study drill introduces no
 *     new question, and the same drill with the budget lifted introduces five.
 *     TN-STUDY-02's "new questions, but not all at once" is Study's pacing rule
 *     and the owner did not touch it, so the cap must still bind here — and
 *     nowhere else. Without this case, ADR-0062 reads as "the cap is gone".
 *
 * Content is read off the disk, by a route the bundle never takes, so the
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

import { landmarkDraw, rememberAnswered, teachingQuotes } from '../../../app/bootstrap/landmark-questions';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

interface PoiFile {
  readonly id: string;
  readonly position: { readonly x: number };
  readonly fact?: { readonly source?: { readonly quote?: string } | null } | null;
}
interface LevelFile {
  readonly id: string;
  readonly subject: string;
  readonly pois?: readonly PoiFile[];
}
interface ConfigFile {
  readonly scheduler: SchedulerTuning;
  readonly study: { readonly drillSize: number };
  readonly journey: readonly string[];
}

const json = <T>(path: string): T => JSON.parse(readFileSync(`${REPO_ROOT}${path}`, 'utf8')) as T;

const config = json<ConfigFile>('content/game.config.json');

const levels = new Map(
  readdirSync(`${REPO_ROOT}content/levels`)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => json<LevelFile>(`content/levels/${name}`))
    .map((level) => [level.id, level] as const),
);

/** The levels in the order a player walks them. */
const inJourneyOrder = config.journey.flatMap((levelId) => {
  const level = levels.get(levelId);
  return level === undefined ? [] : [level];
});

/** Every landmark, in the order a player going right meets it. */
const stopsOf = (level: LevelFile): readonly PoiFile[] =>
  [...(level.pois ?? [])].sort((a, b) => a.position.x - b.position.x);

/** 2026-01-05T09:00:00Z. Fixed, and one UTC day for the whole walk: one sitting. */
const MORNING = 1_767_603_600_000 as EpochMillis;
const clock = { now: (): EpochMillis => MORNING, elapsed: (): number => 0 };

const onSameUtcDay = (a: number, b: number): boolean =>
  Math.floor(a / 86_400_000) === Math.floor(b / 86_400_000);

/** How many never-seen questions this save has met today, counted as the scheduler counts them. */
const introducedToday = (progress: Progress): number =>
  progress.reviews.filter(
    (review) => review.firstReviewedAt !== null && onSameUtcDay(review.firstReviewedAt, MORNING),
  ).length;

interface StopDraw {
  readonly level: string;
  readonly stop: string;
  readonly asked: number;
  readonly introducedBefore: number;
}

interface Sitting {
  readonly draws: readonly StopDraw[];
  readonly introduced: number;
  /** What Study drew at the end of the sitting, and how much of it was new. */
  readonly studyTotal: number;
  readonly studyNew: number;
}

/**
 * A whole journey with every task declined, engaging each stop until it has
 * nothing left — then opening Study.
 *
 * Every task declined on purpose: with no `answer` step being played, every draw
 * is the landmark's own, so what the budget does to a landmark is not hidden
 * behind ADR-0054's already-exempt promised count.
 */
async function declinedSitting(tuning: SchedulerTuning): Promise<Sitting> {
  let progress: Progress = newProgress(defaultSettings('en' as LocaleCode));
  const session = createStudySession({
    bank: createQuestionBank({}),
    clock,
    random: createSeededRandom(2026),
    progress: () => progress,
    tuning,
    drillSize: config.study.drillSize,
  });

  const draws: StopDraw[] = [];

  for (const level of inJourneyOrder) {
    /* One opening of the level: what it has answered is its own (ADR-0048). */
    let answeredHere: readonly QuestionId[] = [];

    for (const poi of stopsOf(level)) {
      /* Pressed again until the stop has nothing left, as a player does. The
         bound is a guard against a stop that never empties, not a rule. */
      for (let engagement = 0; engagement < 8; engagement += 1) {
        const introducedBefore = introducedToday(progress);
        const draw = landmarkDraw({
          levelSubject: level.subject as SubjectId,
          answering: undefined,
          teaches: teachingQuotes(level.pois, poi.id),
          answeredHere,
        });

        const drill = await session.drill(draw.count, draw.scope);
        const asked = drill.ok ? drill.value.questions.length : 0;
        draws.push({ level: level.id, stop: poi.id, asked, introducedBefore });
        if (!drill.ok || asked === 0) break;

        for (const one of drill.value.questions) {
          const answered = answerQuestion(
            { clock },
            { question: one.question, chosenIndex: 0, progress },
          );
          expect(answered.ok, `${level.id}/${poi.id}: ${String(one.question.id)} could not be answered`).toBe(true);
          if (!answered.ok) return { draws, introduced: 0, studyTotal: 0, studyNew: 0 };
          progress = answered.value.progress;
          answeredHere = rememberAnswered(answeredHere, one.question.id);
        }
      }
    }
  }

  /* The player opens Study at the end of the same sitting. No scope: Study
     passes none, which is what keeps it capped. */
  const study = await session.drill(config.study.drillSize);

  return {
    draws,
    introduced: introducedToday(progress),
    studyTotal: study.ok ? study.value.questions.length : -1,
    studyNew: study.ok ? study.value.questions.filter((one) => one.familiarity === 'new').length : -1,
  };
}

/** A budget so large it cannot bind anything: the control for every comparison. */
const NO_BUDGET: SchedulerTuning = { ...config.scheduler, dailyNewLimit: 100_000 };

describe('a landmark asks however long the day has been (ADR-0062)', () => {
  it('has levels and landmarks to walk, so this is about something (ADR-0024)', () => {
    expect(inJourneyOrder.length).toBeGreaterThan(0);
    expect(inJourneyOrder.flatMap((level) => stopsOf(level)).length).toBeGreaterThan(0);
  });

  /*
   * Claim 1. The failing case: on `origin/main` this reported 35 landmark draws
   * still paced by the day's budget — every stop standing outside a task.
   */
  it('states the exemption on every draw it builds, with a task and without', () => {
    const paced: string[] = [];

    for (const level of inJourneyOrder) {
      for (const poi of stopsOf(level)) {
        const teaches = teachingQuotes(level.pois, poi.id);
        const subject = level.subject as SubjectId;

        const outsideATask = landmarkDraw({ levelSubject: subject, answering: undefined, teaches });
        const duringATask = landmarkDraw({
          levelSubject: subject,
          answering: { step: { subject }, done: 0, required: 2 },
          teaches,
        });

        if (outsideATask.scope.dailyNewLimitApplies !== false) {
          paced.push(`${level.id}/${poi.id} with no task: ${String(outsideATask.scope.dailyNewLimitApplies)}`);
        }
        if (duringATask.scope.dailyNewLimitApplies !== false) {
          paced.push(`${level.id}/${poi.id} during a task: ${String(duringATask.scope.dailyNewLimitApplies)}`);
        }
      }
    }

    expect(
      paced,
      'A landmark stop is not paced by the day’s new-question budget (ADR-0062): a player who walks ' +
        'up to a place is asked about it however much they have already played today. These draws ' +
        'still leave the cap to decide:\n' +
        paced.join('\n'),
    ).toEqual([]);
  });

  /*
   * Claim 2. Green on `origin/main` as well, because ADR-0048's routing answers
   * a stop's draw before the scheduler sees it. It is here to keep the ruling
   * true when that routing changes, not to have caught it.
   */
  it('keeps asking at stops reached after the day’s budget is spent', async () => {
    const sitting = await declinedSitting(config.scheduler);
    const limit = config.scheduler.dailyNewLimit;

    expect(
      sitting.introduced,
      `a sitting of nothing but landmark stops introduced ${String(sitting.introduced)} new questions, ` +
        `which is not past the limit of ${String(limit)}. This case cannot show a landmark asking past ` +
        'a budget it never reaches — walk more of the journey, or the content has shrunk.',
    ).toBeGreaterThan(limit);

    const pastBudget = sitting.draws.filter((draw) => draw.introducedBefore >= limit);
    expect(
      pastBudget.length,
      'no stop in the whole journey was reached after the day’s budget was spent, so this case ' +
        'proves nothing (ADR-0024)',
    ).toBeGreaterThan(0);

    const asking = pastBudget.filter((draw) => draw.asked > 0);
    expect(
      asking.length,
      `${String(pastBudget.length)} stops were reached after the day’s ${String(limit)} new questions ` +
        'were spent and not one of them asked anything. A landmark that has something to tell asks ' +
        'about it however long the day has been (ADR-0062).',
    ).toBeGreaterThan(0);
  });

  it('draws exactly the same questions when the budget is lifted, which is what "not paced" means', async () => {
    const [paced, unpaced] = await Promise.all([
      declinedSitting(config.scheduler),
      declinedSitting(NO_BUDGET),
    ]);

    const differences = paced.draws.flatMap((draw, index) => {
      const other = unpaced.draws[index];
      return other === undefined || other.asked === draw.asked
        ? []
        : [`${draw.level}/${draw.stop}: asked ${String(draw.asked)}, and ${String(other.asked)} with no budget`];
    });

    expect(
      differences,
      'Lifting the day’s new-question budget changed what a landmark asked, so landmarks are still ' +
        `paced by it (ADR-0062):\n${differences.join('\n')}`,
    ).toEqual([]);
    expect(paced.introduced).toBe(unpaced.introduced);
  });

  /*
   * Claim 3. The other side of the ruling: the cap did not go away, it narrowed
   * to the one activity whose rule it is.
   */
  it('still paces Study after that sitting, which is whose rule the cap is (TN-STUDY-02)', async () => {
    const [paced, unpaced] = await Promise.all([
      declinedSitting(config.scheduler),
      declinedSitting(NO_BUDGET),
    ]);

    expect(
      paced.studyNew,
      `Study introduced ${String(paced.studyNew)} new question(s) after a sitting that had already met ` +
        `${String(paced.introduced)} of them, past a limit of ${String(config.scheduler.dailyNewLimit)}. ` +
        'ADR-0062 exempts what a LEVEL asks; TN-STUDY-02’s "new questions, but not all at once" is ' +
        'Study’s own pacing rule and still binds here.',
    ).toBe(0);

    /* And the cap is what did it: with the budget lifted the same drill is all
       new, so the zero above is pacing rather than an empty bank. */
    expect(unpaced.studyNew).toBeGreaterThan(0);

    /* A paced Study drill is never a starved one: a spent budget means the day
       already introduced at least `dailyNewLimit` questions, and those are
       themselves reviewable. */
    expect(
      paced.studyTotal,
      'a Study drill went short because the day’s budget was spent; the questions the day introduced ' +
        'should have filled it',
    ).toBe(unpaced.studyTotal);
  });
});
