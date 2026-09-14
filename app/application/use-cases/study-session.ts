/**
 * StudySession — the seam Study mounts against.
 *
 * `app/ui/study-screen.ts` has been finished for a while and has never been
 * mounted, because there was nothing to hand it: the bank was on disk, the
 * scheduler was in the domain, and no wire ran between them. This is that wire.
 *
 * A use case and not a bootstrap helper, and the distinction is load-bearing:
 * everything below is stated in ports — a `QuestionBank`, a `Clock`, a
 * `RandomSource` — so it names no concrete, runs under `environment: 'node'`,
 * and falls inside the >= 90% coverage gate. `app/bootstrap` chooses *which*
 * bank, *which* clock and *which* stream; it does not decide what a drill is.
 *
 * ## What the screen gets, and what it does not
 *
 * It gets a count and a list of questions. It does not get a `SubjectId`, a
 * `ReviewRecord`, a due date or the word "scheduler" — TN-CARD-02 bans the
 * vocabulary from the UI, so the vocabulary stops here. `familiarity` is the
 * only thing that crosses, and it is two-valued (`new` / `seen`), which is
 * exactly what `card.kind.new` and `card.kind.seen` render.
 *
 * ## What it keeps
 *
 * `recentlyAsked`, across drills. `scheduleReview` documents that as the
 * caller's job and it is genuinely the caller's: it is what makes TN-STUDY-02's
 * "two drills in a row do not repeat the same questions" true, and TN-STUDY-05
 * says it must NOT survive a closed tab, so it is held in memory here and never
 * persisted.
 *
 * ## What it does not do
 *
 * Record an answer. That is `answerQuestion` plus the save, both of which the
 * screen's owner already holds — folding them in here would give this object two
 * reasons to exist and would make a drill untestable without a `ProgressRepository`.
 * `progress` is read through a getter so a drill drawn after an answer sees the
 * review that answer wrote.
 */

import { map } from '@common/result';
import type { Result } from '@common/result';
import type {
  Clock,
  QuestionBank,
  RandomSource,
  SchedulerTuning,
  ShippableQuestion,
} from '@application/ports';
import { questionsTelling } from '@application/content/proposition';
import { loadEveryBank } from '@application/content/question-bank';
import { scheduleReview } from '@application/use-cases/schedule-review';
import type { Progress } from '@domain/entities/progress';
import type { QuestionId, SubjectId } from '@domain/ids';

/** One question of a drill: the document to render, and the tag the card shows. */
export interface StudyQuestion {
  readonly question: ShippableQuestion;
  /** `new` or `seen`. The only thing about the schedule a player ever learns. */
  readonly familiarity: 'new' | 'seen';
}

/**
 * Where a drill may draw from, when it is not the whole bank (ADR-0036).
 *
 * Study passes nothing and draws from every subject. A level passes its own
 * subject — ADR-0030 §2: "a level's `subject` is the remit of its quest's
 * `answer` steps and of the bank the scheduler draws for it" — and, at a
 * landmark, what that landmark told the player.
 */
export interface DrillScope {
  /** Only this subject's questions. */
  readonly subject?: SubjectId | undefined;
  /** A quest step's `questionPool`: only these ids, still chosen by the scheduler. */
  readonly pool?: readonly QuestionId[] | undefined;
  /**
   * The `source.quote` of every claim the place just told the player. A question
   * resting on one of those sentences is asked first, when it is inside the
   * scope and was not asked in this sitting.
   */
  readonly teaches?: readonly string[] | undefined;
}

export interface StudyDrill {
  /** In the order they should be asked; "Question 1 of 5" counts through it. */
  readonly questions: readonly StudyQuestion[];
  /** How many fewer than asked for. `TN-STUDY-02`: a short drill is stated, not padded. */
  readonly shortfall: number;
}

/**
 * What the Study screen is handed.
 *
 * Two methods on purpose. `available()` answers the `ready` state's "N
 * questions" and, when it is zero, the `empty` state — and it answers it from
 * the same bank the drill will draw from, so the number on the button and the
 * number of cards cannot disagree. Every failure is a `Result`, which is
 * `StudyState.error` (`TN-STUDY-03`) with a Try again button that can actually
 * succeed for the `io` case.
 */
export interface StudySession {
  /** How many questions this build can ask at all. */
  available(): Promise<Result<number>>;
  /**
   * Draw the next drill, at most `count` questions — from the whole bank, or
   * from `scope` when a level narrows it (ADR-0036).
   */
  drill(count: number, scope?: DrillScope): Promise<Result<StudyDrill>>;
  /** How many one drill asks by default, from `game.config.json#/study`. */
  readonly drillSize: number;
}

export interface StudySessionDeps {
  readonly bank: QuestionBank;
  readonly clock: Clock;
  readonly random: RandomSource;
  /** Read, not captured: a drill after an answer must see that answer's review. */
  readonly progress: () => Progress;
  readonly tuning: SchedulerTuning;
  readonly drillSize: number;
}

export const createStudySession = (deps: StudySessionDeps): StudySession => {
  /* Not persisted (`TN-STUDY-05`), and deliberately not reset between drills. */
  let recentlyAsked: readonly QuestionId[] = [];

  return {
    drillSize: deps.drillSize,

    async available(): Promise<Result<number>> {
      return map(await loadEveryBank(deps.bank), (questions) => questions.length);
    },

    async drill(count: number, scope?: DrillScope): Promise<Result<StudyDrill>> {
      const bank = await loadEveryBank(deps.bank);
      if (!bank.ok) return bank;

      const byId = new Map(bank.value.map((question) => [question.id, question]));
      /*
       * What the place told the player, as question ids. Resolved over the whole
       * bank and handed to the scheduler as a preference only: `scheduleReview`
       * drops any that fall outside the subject or the pool, so a landmark
       * whose sentence another subject grades asks nothing out of its level's
       * remit (ADR-0030 §2).
       */
      const prefer =
        scope?.teaches === undefined ? [] : questionsTelling(bank.value, scope.teaches);
      const drawn = scheduleReview(
        { clock: deps.clock, random: deps.random },
        {
          questions: bank.value,
          count,
          progress: deps.progress(),
          tuning: deps.tuning,
          recentlyAsked,
          subject: scope?.subject,
          pool: scope?.pool,
          prefer,
        },
      );
      if (!drawn.ok) return drawn;

      recentlyAsked = drawn.value.recentlyAsked;

      /*
       * `flatMap` over a lookup rather than `map` plus a `!`: the scheduler
       * returns ids and this is the only place they become documents again. An
       * id with no document cannot happen — the pool was built from this map one
       * statement earlier — but the shortfall is measured against what was
       * actually resolved rather than against the draw, so a drill that lost a
       * question here would still be *stated* as short instead of quietly
       * counting "1 of 5" up to 4.
       */
      const questions: readonly StudyQuestion[] = drawn.value.questions.flatMap((selected) => {
        const question = byId.get(selected.questionId);
        return question === undefined ? [] : [{ question, familiarity: selected.familiarity }];
      });

      return { ok: true, value: { questions, shortfall: Math.max(0, count - questions.length) } };
    },
  };
};
