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
  /**
   * Ask nothing but `prefer` (ADR-0048).
   *
   * A landmark with no task step being played asks what it just told, or nothing:
   * the rest of the subject is not about the place. A scope left empty by this is
   * an empty draw rather than a refusal, because a place that told nothing a
   * question grades has nothing to ask, and that is not a bank that failed.
   * The scheduler is not asked to fill it, so a told question answered in this
   * sitting stays held back rather than coming round again.
   */
  readonly preferOnly?: boolean | undefined;
  /**
   * Questions already answered in this level visit, most recently answered first
   * (ADR-0048).
   *
   * Never drawn again, whatever the scheduler would say. A question answered
   * wrongly comes due within minutes, and the missed-first tier would otherwise
   * put it on the very next stop's card: the second live-site audit met the same
   * question at the grain bins and again at the combine harvester.
   */
  readonly answeredHere?: readonly QuestionId[] | undefined;
  /**
   * When the scope holds fewer unanswered questions than `count`, make up the
   * rest from `answeredHere`, least recently answered first, and count them in
   * `repeated` so the caller can say so. Without it a spent scope is a short draw.
   */
  readonly repeatWhenExhausted?: boolean | undefined;
  /**
   * Does the day's new-question budget cap this draw? Default `true` (ADR-0053).
   *
   * `false` only for a count the game has already promised the player: a quest
   * `answer` step's `count`, printed on the tracker as "Answer 3 questions" before
   * anything is asked. Study keeps the cap, which is whose rule it is
   * (TN-STUDY-02).
   */
  readonly dailyNewLimitApplies?: boolean | undefined;
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
  /**
   * How many of `questions` were already answered in this level visit, asked
   * again only because the scope had nothing else left (`repeatWhenExhausted`).
   * They come last. Zero whenever anything unanswered could fill the draw.
   */
  readonly repeated: number;
}

export const scheduleReview = (
  deps: ScheduleReviewDeps,
  input: ScheduleReviewInput,
): Result<ScheduleReviewResult> => {
  const { questions, count, progress, tuning, memory } = input;
  const recentlyAsked = input.recentlyAsked ?? [];
  const allowed = input.pool === undefined ? undefined : new Set(input.pool);

  const inScope = shippableQuestions(questions).filter(
    (question) =>
      (input.subject === undefined || question.subject === input.subject) &&
      (allowed === undefined || allowed.has(question.id)),
  );

  if (inScope.length === 0) {
    // TN-QUEST-05: "The questions are not ready right now. Try again later." The
    // copy is the caller's; this only says which of the failures it was.
    return appErr('not-found', 'scheduler.bank.empty', 'No question in this bank can be asked.', {
      offered: questions.length,
      subject: input.subject,
    });
  }

  /*
   * ADR-0048. What this draw may ask: only what the place told, when the caller
   * says so, and never what this level visit has already answered. Both narrow
   * after the bank has been found askable, so an empty result here is "nothing
   * to ask at this place now", not "the questions are not ready".
   */
  const told = input.preferOnly === true ? new Set(input.prefer ?? []) : undefined;
  const narrowed =
    told === undefined ? inScope : inScope.filter((question) => told.has(question.id));
  const answeredHere = input.answeredHere ?? [];
  const answered = new Set(answeredHere);
  const askable = narrowed.filter((question) => !answered.has(question.id));
  const madeUp = familiar(
    repeatsFor(input, narrowed, askable.length, answeredHere),
    progress,
  );

  const drawOf = (selected: readonly ScheduledQuestion[]): ScheduleReviewResult => ({
    questions: selected,
    recentlyAsked: rememberAsked(
      recentlyAsked,
      selected.map((question) => question.questionId),
      tuning,
    ),
    shortfall: Math.max(0, count - selected.length),
    repeated: madeUp.length,
  });

  /*
   * A place that may ask only what it told (ADR-0048) is answered here, in the
   * order it told, and never handed to the scheduler: the scheduler relaxes its
   * exclusion window rather than come back short, so a told question answered
   * earlier in this sitting would come straight back. One put on screen and
   * closed unanswered is still asked again (`TN-CARD-05`).
   */
  if (askable.length === 0 || told !== undefined) {
    if (!isWholeCount(count)) {
      return appErr(
        'invalid',
        'scheduler.count.invalid',
        'The number of questions to ask must be a positive whole number.',
        { count },
      );
    }
    const asked =
      told === undefined
        ? []
        : toldNow(input.prefer ?? [], askable, recentlyAsked, count, tuning, progress);
    return { ok: true, value: drawOf([...familiar(asked, progress), ...madeUp]) };
  }

  const preferred = preferredFirst(input.prefer, askable, recentlyAsked, count, tuning);
  const pool = askable
    .map((question) => question.id)
    .filter((id) => !preferred.some((chosen) => chosen === id));
  const rest = count - preferred.length;

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
      ...(input.dailyNewLimitApplies === undefined
        ? {}
        : { dailyNewLimitApplies: input.dailyNewLimitApplies }),
      ...(memory === undefined ? {} : { memory }),
    });
    return map(drawn, (selected) =>
      drawOf([...familiar(preferred, progress), ...selected, ...madeUp]),
    );
  }
  return { ok: true, value: drawOf([...familiar(preferred, progress), ...madeUp]) };
};

const isWholeCount = (count: number): boolean => Number.isInteger(count) && count > 0;

/** Has the player ever given an answer to this question? */
const answeredBefore = (id: QuestionId, progress: Progress): boolean =>
  progress.reviews.some((review) => review.questionId === id && hasBeenSeen(review));

/**
 * What a place that asks only what it told asks now, in the order it told, at
 * most `count` (ADR-0048, ADR-0036 §2.4).
 *
 * A told question inside the exclusion window is held back once it has been
 * answered — in a Study drill over the level, or on an earlier visit this
 * sitting. One inside the window that was never answered was put on screen and
 * closed, and `TN-CARD-05` asks it again.
 */
function toldNow(
  prefer: readonly QuestionId[],
  askable: readonly QuestionDocument[],
  recentlyAsked: readonly QuestionId[],
  count: number,
  tuning: SchedulerTuning,
  progress: Progress,
): readonly QuestionId[] {
  const inScope = new Set(askable.map((question) => question.id));
  const window = new Set(recentlyAsked.slice(0, Math.max(0, tuning.exclusionWindow)));
  const chosen: QuestionId[] = [];
  for (const id of prefer) {
    if (chosen.length >= count) break;
    if (!inScope.has(id) || chosen.includes(id)) continue;
    if (window.has(id) && answeredBefore(id, progress)) continue;
    chosen.push(id);
  }
  return chosen;
}

/**
 * What a spent scope asks again, least recently answered first (ADR-0048).
 *
 * Only as many as the unanswered questions cannot cover, so a scope that still
 * holds something new never repeats; and only when the caller allows it. A draw
 * that is short for another reason — the day's new questions used up — stays
 * short, as `TN-STUDY-02` says.
 */
function repeatsFor(
  input: ScheduleReviewInput,
  narrowed: readonly QuestionDocument[],
  unanswered: number,
  answeredHere: readonly QuestionId[],
): readonly QuestionId[] {
  if (input.repeatWhenExhausted !== true || !isWholeCount(input.count)) return [];
  const missing = input.count - unanswered;
  if (missing <= 0) return [];
  const inScope = new Set(narrowed.map((question) => question.id));
  const newestFirst: QuestionId[] = [];
  for (const id of answeredHere) {
    if (inScope.has(id) && !newestFirst.includes(id)) newestFirst.push(id);
  }
  return newestFirst.reverse().slice(0, missing);
}

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
  if (prefer === undefined || !isWholeCount(count)) return [];
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
