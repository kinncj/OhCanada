/**
 * ScheduleReview — which questions to ask next, from the player's own history.
 *
 * The scheduler is pure domain and cannot import a port (`domain-is-pure`), so
 * it takes `now` as a parameter and a structural `Randomness` — one method,
 * `next()`. `RandomSource` satisfies that interface exactly, so this use case
 * holds both ports and passes them straight through: no adapter, no wrapper, and
 * a seeded stream from the composition root reaches the draw unchanged, which is
 * what makes a bad drill replayable from its seed.
 *
 * The third and fourth call sites for `Clock` and `RandomSource` (slice 1 task
 * 1.5). What this use case adds on top of the domain draw is the content
 * filter — verified, bilingual, and inside the quest step's pool — because that
 * is knowledge about *documents*, which the scheduler deliberately does not have
 * (it takes ids and nothing else).
 *
 * Stories: TN-STUDY-02 (the drill), TN-CARD-02 (wrong questions come back
 * first), TN-QUEST-05 (an empty or short bank is a message, not a crash).
 */

import { appErr, map } from '@common/result';
import type { Result } from '@common/result';
import type { QuestionId, SubjectId } from '@domain/ids';
import type { QuestionDocument, SchedulerTuning } from '@application/ports/content-repository';
import type { Clock } from '@application/ports/clock';
import type { RandomSource } from '@application/ports/random-source';

import { shippableQuestions } from '@domain/entities/question';
import type { Progress } from '@domain/entities/progress';
import { rememberAsked, selectQuestions } from '@domain/scheduling/question-scheduler';
import type { ScheduledQuestion } from '@domain/scheduling/question-scheduler';
import { hasBeenSeen } from '@domain/scheduling/review-record';
import type { MemoryTuning } from '@domain/scheduling/review-record';

export interface ScheduleReviewDeps {
  readonly clock: Clock;
  readonly random: RandomSource;
}

export interface ScheduleReviewInput {
  /** The subject's bank, as loaded. Unverified and half-translated entries are dropped here. */
  readonly questions: readonly QuestionDocument[];
  /** How many to ask: `study.drillSize`, or a quest step's `count`. */
  readonly count: number;
  readonly progress: Progress;
  /** `game.config.json#/scheduler`. */
  readonly tuning: SchedulerTuning;
  /** Most recently asked first, carried across drills by the caller. Not persisted. */
  readonly recentlyAsked?: readonly QuestionId[] | undefined;
  /** A quest step's `questionPool`, which narrows the bank without choosing from it. */
  readonly pool?: readonly QuestionId[] | undefined;
  /** Restricts the bank to one subject when the caller passed a wider one. */
  readonly subject?: SubjectId | undefined;
  /**
   * Questions the caller has a reason to ask **first**: the ones resting on the
   * sentence a landmark has just told the player (ADR-0036).
   *
   * Each is asked ahead of the scheduler's draw when it is askable — verified,
   * bilingual, inside `subject` and `pool` — and was not asked in this sitting
   * (the exclusion window over `recentlyAsked`), so a place never repeats what
   * the player was just asked somewhere else. The rest of the count is the
   * scheduler's, over what is left. A preference narrows nothing: an id outside
   * the bank, the subject or the pool is ignored rather than asked.
   */
  readonly prefer?: readonly QuestionId[] | undefined;
  readonly memory?: MemoryTuning | undefined;
}

export interface ScheduleReviewResult {
  /** In the order they should be asked; "Question 1 of 3" counts through it. */
  readonly questions: readonly ScheduledQuestion[];
  /** The recently-asked list with this draw folded in, for the next call. */
  readonly recentlyAsked: readonly QuestionId[];
  /**
   * How many fewer questions than asked for. TN-QUEST-05: two verified questions
   * means two are asked, none is repeated to make up the number, and the caller
   * says that more are coming.
   */
  readonly shortfall: number;
}

export const scheduleReview = (
  deps: ScheduleReviewDeps,
  input: ScheduleReviewInput,
): Result<ScheduleReviewResult> => {
  const { questions, count, progress, tuning, memory } = input;
  const recentlyAsked = input.recentlyAsked ?? [];
  const allowed = input.pool === undefined ? undefined : new Set(input.pool);

  const askable = shippableQuestions(questions).filter(
    (question) =>
      (input.subject === undefined || question.subject === input.subject) &&
      (allowed === undefined || allowed.has(question.id)),
  );

  if (askable.length === 0) {
    // TN-QUEST-05: "The questions are not ready right now. Try again later." The
    // copy is the caller's; this only says which of the failures it was.
    return appErr('not-found', 'scheduler.bank.empty', 'No question in this bank can be asked.', {
      offered: questions.length,
      subject: input.subject,
    });
  }

  const preferred = preferredFirst(input.prefer, askable, recentlyAsked, count, tuning);
  const pool = askable
    .map((question) => question.id)
    .filter((id) => !preferred.some((chosen) => chosen === id));
  const rest = count - preferred.length;

  const drawOf = (selected: readonly ScheduledQuestion[]): ScheduleReviewResult => ({
    questions: selected,
    recentlyAsked: rememberAsked(
      recentlyAsked,
      selected.map((question) => question.questionId),
      tuning,
    ),
    shortfall: Math.max(0, count - selected.length),
  });

  /*
   * With nothing preferred this is exactly the draw it always was, and a bad
   * count is still the scheduler's to refuse. With a preference the count is
   * already known to be a positive whole number, and the scheduler is asked only
   * for what is left — or not at all, when the preference filled the drill or
   * nothing else may be asked.
   */
  if (preferred.length === 0 || (rest > 0 && pool.length > 0)) {
    const drawn = selectQuestions({
      pool,
      reviews: progress.reviews,
      recentlyAsked,
      // Never ask for more than exist: the scheduler would relax its exclusion
      // window to fill the gap, and TN-STUDY-02 says a short drill stays short.
      count: Math.min(rest, pool.length),
      now: deps.clock.now(),
      settings: tuning,
      random: deps.random,
      ...(memory === undefined ? {} : { memory }),
    });
    return map(drawn, (selected) => drawOf([...familiar(preferred, progress), ...selected]));
  }
  return { ok: true, value: drawOf(familiar(preferred, progress)) };
};

/**
 * The preferred ids that may be asked now, in the order given, at most `count`.
 *
 * Empty for a count the scheduler would refuse, so a bad count is refused by the
 * one function that owns that rule rather than slipping through here.
 */
function preferredFirst(
  prefer: readonly QuestionId[] | undefined,
  askable: readonly QuestionDocument[],
  recentlyAsked: readonly QuestionId[],
  count: number,
  tuning: SchedulerTuning,
): readonly QuestionId[] {
  if (prefer === undefined || !Number.isInteger(count) || count <= 0) return [];
  const inBank = new Set(askable.map((question) => question.id));
  const window = new Set(recentlyAsked.slice(0, Math.max(0, tuning.exclusionWindow)));
  const chosen: QuestionId[] = [];
  for (const id of prefer) {
    if (chosen.length >= count) break;
    if (!inBank.has(id) || window.has(id) || chosen.includes(id)) continue;
    chosen.push(id);
  }
  return chosen;
}

/** A preferred id as the card sees it: `seen` once the player has answered it. */
function familiar(ids: readonly QuestionId[], progress: Progress): readonly ScheduledQuestion[] {
  return ids.map((questionId) => {
    const record = progress.reviews.find((review) => review.questionId === questionId);
    return {
      questionId,
      familiarity: record !== undefined && hasBeenSeen(record) ? 'seen' : 'new',
    };
  });
}
