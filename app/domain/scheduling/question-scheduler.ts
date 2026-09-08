/**
 * QuestionScheduler — which questions to ask next, and in what order.
 *
 * The player never learns any of this exists. TN-CARD-02 forbids the words
 * *spaced repetition*, *FSRS*, *algorithm*, *interval*, *card state* and *due*
 * from appearing on screen in either language, so the only thing this module
 * hands the UI is a question id and a two-valued tag: `'new'` or `'seen'`, which
 * the localiser renders as "New" / "Seen before" (`card.kind.new`,
 * `card.kind.seen`). Nothing else about a question's schedule is exposed, so
 * there is nothing for a card to leak.
 *
 * What the stories ask of it, and where each is answered below:
 *
 *   - TN-CARD-02 / TN-STUDY-02, "questions I got wrong come first": due
 *     questions are a hard tier above questions that are not due, and inside it
 *     missed questions are a hard tier above the rest. So the ordering is a
 *     guarantee, not a probability. `wrongWeight` biases the tier below — how
 *     much a question the player has missed before is worth *before* it comes
 *     due — because that is the only tier where the stories leave a choice.
 *   - TN-CARD-02, "the missed question appears in the next drill": the same tier,
 *     plus a window that only holds back a question whose moment has not come.
 *   - TN-CARD-02 / TN-STUDY-02, "a question answered *rightly* is not asked
 *     again in the same session": the exclusion window, carried by the caller
 *     across drills.
 *   - TN-STUDY-02, "a drill can be shorter than the drill size": a short
 *     selection is returned as-is. Nothing is repeated to pad it.
 *   - TN-STUDY-02, "new questions, but not all at once": `dailyNewLimit`.
 *
 * Purity. There is no clock and no `Math.random()` here: `now` and a
 * `Randomness` arrive as parameters. `Randomness` is declared in this file
 * rather than imported from `app/application/ports/random-source.ts` because
 * `domain-is-pure` forbids `app/domain` from importing the application layer —
 * checked against `depcruise`, not assumed. `RandomSource` satisfies this
 * interface structurally, so the composition root passes the port straight in
 * with no adapter in between.
 */

import { appErr, ok } from '@common/result';
import type { Result } from '@common/result';
import type { EpochMillis, QuestionId } from '@domain/ids';

import {
  DEFAULT_MEMORY_TUNING,
  hasBeenSeen,
  isDue,
  onSameUtcDay,
  recallProbabilityNow,
  wasLastAnswerWrong,
} from '@domain/scheduling/review-record';
import type { MemoryTuning, ReviewRecord } from '@domain/scheduling/review-record';

/**
 * The narrowest possible view of randomness: one uniform draw in [0, 1).
 *
 * `RandomSource` (and `SeededRandomSource`) are assignable to this, so a seeded
 * stream from the composition root reaches the domain unchanged and a failing
 * draw replays from its seed.
 */
export interface Randomness {
  /** Uniform in [0, 1). */
  next(): number;
}

/**
 * Tuning, matching `content/game.config.json#/scheduler`. Structurally identical
 * to the `SchedulerTuning` port type, which the domain may not import.
 */
export interface SchedulerSettings {
  /** How many recently asked questions may not come round again. */
  readonly exclusionWindow: number;
  /** How much more a previously missed question is worth drawing. At least 1. */
  readonly wrongWeight: number;
  /** Most never-seen questions to introduce in one UTC day. */
  readonly dailyNewLimit: number;
}

/** What the card shows as its tag, and nothing more (TN-CARD-01, TN-CARD-08). */
export type QuestionFamiliarity = 'new' | 'seen';

/**
 * One question, chosen.
 *
 * Deliberately two fields. Anything else on this object — a due date, a
 * stability, a step counter — is something a card could render, and
 * `tests/unit/domain/scheduling/question-scheduler.test.ts` asserts that this
 * shape stays free of scheduling vocabulary.
 */
export interface ScheduledQuestion {
  readonly questionId: QuestionId;
  readonly familiarity: QuestionFamiliarity;
}

export interface SelectionRequest {
  /**
   * The questions this activity may draw from — a subject's bank, or a quest
   * step's `questionPool`.
   *
   * Ids only. The scheduler has no use for wording, options or verification, and
   * taking `QuestionDocument` here would tie the domain to a content shape it
   * does not read. Filtering the bank to verified, bilingual questions happens
   * before this call (CLAUDE.md, Content rules).
   */
  readonly pool: readonly QuestionId[];
  /** What is known about the player's history. Entries outside `pool` are ignored. */
  readonly reviews: readonly ReviewRecord[];
  /** Most recently asked first. Longer than the window is fine; the tail is unused. */
  readonly recentlyAsked: readonly QuestionId[];
  /** How many to ask: `study.drillSize`, or a quest step's `count`. */
  readonly count: number;
  readonly now: EpochMillis;
  readonly settings: SchedulerSettings;
  readonly random: Randomness;
  readonly memory?: MemoryTuning;
}

/** Shortest gap the lateness measure will divide by, so a 1-minute step is meaningful. */
const MIN_INTERVAL_MS = 60_000;

const isValidCount = (count: number): boolean => Number.isInteger(count) && count > 0;

const areValidSettings = (settings: SchedulerSettings): boolean =>
  Number.isInteger(settings.exclusionWindow) &&
  settings.exclusionWindow >= 0 &&
  Number.isFinite(settings.wrongWeight) &&
  settings.wrongWeight >= 1 &&
  Number.isInteger(settings.dailyNewLimit) &&
  settings.dailyNewLimit >= 0;

/**
 * How many never-seen questions the player has already met today.
 *
 * Counted from `firstReviewedAt`, so drilling a question a second time does not
 * quietly give the day's budget back. That field is not in
 * `ReviewStateDocument` yet — see the report for slice 1 task 1.4. Falling back
 * to `reps === 1` would make `dailyNewLimit` bypassable by tapping "Study
 * again", which is exactly the scenario TN-STUDY-02 writes the limit for.
 */
const introducedToday = (reviews: readonly ReviewRecord[], now: EpochMillis): number =>
  reviews.filter(
    (record) => record.firstReviewedAt !== null && onSameUtcDay(record.firstReviewedAt, now),
  ).length;

const weightOf = (record: ReviewRecord, settings: SchedulerSettings): number =>
  wasLastAnswerWrong(record) ? settings.wrongWeight : 1;

/**
 * How far past its moment a question is, in multiples of the gap it was given.
 *
 * Unit-free on purpose: a question given ten minutes and left an hour scores the
 * same as one given ten days and left sixty. Measured in milliseconds instead,
 * every short-term question would rank below every long one and the question the
 * player just missed would come last.
 */
const lateness = (record: ReviewRecord, now: EpochMillis): number => {
  const granted = Math.max(record.dueAt - (record.lastReviewedAt ?? record.dueAt), MIN_INTERVAL_MS);
  return (now - record.dueAt) / granted;
};

interface Ranked {
  readonly questionId: QuestionId;
  readonly familiarity: QuestionFamiliarity;
  /** Ready to be offered: the moment the scheduler set for it has arrived. */
  readonly due: boolean;
  /** The last answer was wrong. Ranks above everything else that is due. */
  readonly missed: boolean;
  readonly key: number;
  readonly jitter: number;
  readonly order: number;
}

/**
 * Missed questions first, then the latest, then the seeded draw, then pool order.
 *
 * The first term is a hard tier rather than a heavier weight, because the
 * stories state it without qualification: "question A is offered before question
 * B" (TN-CARD-02) and "question A is asked before question B and before question
 * C" (TN-STUDY-02). A weight cannot promise that — a bank left alone for a day
 * puts twenty-nine badly overdue questions in front of the one the player
 * actually got wrong, which is what a weighted key did here before this comment
 * existed.
 */
const byMissedThenKey = (a: Ranked, b: Ranked): number =>
  Number(b.missed) - Number(a.missed) ||
  b.key - a.key ||
  b.jitter - a.jitter ||
  a.order - b.order;

/** Highest key first; equal keys settled by the seeded draw, then by pool order. */
const byKeyThenJitter = (a: Ranked, b: Ranked): number =>
  b.key - a.key || b.jitter - a.jitter || a.order - b.order;

/**
 * Choose the next `count` questions.
 *
 * The result is ordered: the caller asks them in the order returned, and
 * "Question 1 of 3" counts through it (OQ-CARD-3).
 */
export const selectQuestions = (
  request: SelectionRequest,
): Result<readonly ScheduledQuestion[]> => {
  const { pool, reviews, recentlyAsked, count, now, settings, random } = request;
  const memory = request.memory ?? DEFAULT_MEMORY_TUNING;

  if (pool.length === 0) {
    return appErr(
      'invalid',
      'scheduler.pool.empty',
      'Cannot choose questions from an empty pool.',
    );
  }
  if (new Set(pool).size !== pool.length) {
    return appErr(
      'invalid',
      'scheduler.pool.duplicate',
      'The question pool lists the same question more than once.',
      { size: pool.length, distinct: new Set(pool).size },
    );
  }
  if (!isValidCount(count)) {
    return appErr(
      'invalid',
      'scheduler.count.invalid',
      'The number of questions to ask must be a positive whole number.',
      { count },
    );
  }
  if (!areValidSettings(settings)) {
    return appErr(
      'invalid',
      'scheduler.settings.invalid',
      'Scheduler tuning is out of range.',
      { ...settings },
    );
  }

  const inPool = new Set(pool);
  const recordFor = new Map<QuestionId, ReviewRecord>();
  for (const record of reviews) {
    if (inPool.has(record.questionId) && hasBeenSeen(record)) {
      recordFor.set(record.questionId, record);
    }
  }

  // One draw per pool entry, in pool order, before anything is partitioned: the
  // stream is then consumed identically whatever the player's history is, which
  // is what makes a seed replay the same session.
  const jitterFor = new Map<QuestionId, number>();
  for (const id of pool) jitterFor.set(id, random.next());

  const due: Ranked[] = [];
  const fresh: Ranked[] = [];
  const later: Ranked[] = [];

  pool.forEach((questionId, order) => {
    const jitter = jitterFor.get(questionId) ?? 0;
    const record = recordFor.get(questionId);
    if (record === undefined) {
      // A question nobody has met is always ready; there is nothing to wait
      // for, so the window never holds one back. That is also what makes
      // TN-CARD-05's dismissed-and-never-answered question come round again.
      fresh.push({
        questionId,
        familiarity: 'new',
        due: true,
        missed: false,
        key: 0,
        jitter,
        order,
      });
      return;
    }
    const missed = wasLastAnswerWrong(record);
    if (isDue(record, now)) {
      due.push({
        questionId,
        familiarity: 'seen',
        due: true,
        missed,
        key: lateness(record, now),
        jitter,
        order,
      });
    } else {
      // Not due yet, so nothing is owed — but the closer a question is to being
      // forgotten the more it is worth asking, and `wrongWeight` says how much
      // more a question the player has missed before is worth than one they
      // have not. This is the tier that fills "Study again" on a quiet day.
      later.push({
        questionId,
        familiarity: 'seen',
        due: false,
        missed,
        key: weightOf(record, settings) * (1 - recallProbabilityNow(record, now, memory)),
        jitter,
        order,
      });
    }
  });

  const newBudget = Math.max(0, settings.dailyNewLimit - introducedToday(reviews, now));

  const ranked: readonly Ranked[] = [
    // Everything whose moment has come, missed questions at the front of it.
    ...[...due].sort(byMissedThenKey),
    // Then new material, capped so a drill is never all-new (TN-STUDY-02).
    ...[...fresh].sort(byKeyThenJitter).slice(0, newBudget),
    // Then whatever is closest to being forgotten, so "Study again" always has
    // something to ask even when nothing has come due yet.
    ...[...later].sort(byKeyThenJitter),
  ];

  // How long ago each question was asked. 0 is "the one just asked".
  const askedAgo = new Map<QuestionId, number>();
  recentlyAsked.forEach((id, index) => {
    if (!askedAgo.has(id)) askedAgo.set(id, index);
  });

  /*
   * The window holds a question back only while its moment has not arrived.
   *
   * TN-CARD-02 asks for two things that sound contradictory and are not:
   * "a question answered rightly is not asked again in the same session", and
   * "a question answered wrongly is in the next drill". A right answer buys the
   * question ten minutes at the very least and days once it is settled, so it
   * cannot come round again inside a sitting. A wrong answer buys it one to ten
   * minutes, so it comes back as soon as there has been a break — which is what
   * "You will see this question again soon." promised. One rule, both scenarios.
   */
  const heldBack = (item: Ranked): boolean => {
    if (item.due) return false;
    const ago = askedAgo.get(item.questionId);
    return ago !== undefined && ago < settings.exclusionWindow;
  };

  const chosen = ranked.filter((item) => !heldBack(item)).slice(0, count);
  if (chosen.length >= count) return ok(chosen.map(offered));

  /*
   * Not enough to fill the drill. Relax the window — least recently asked first
   * — rather than hand back a short one.
   *
   * This is not a loophole, it is the only way a window of twenty can coexist
   * with the three questions slice 1 ships. TN-STUDY-02 already allows the
   * repeat ("unless fewer questions are ready than the drill size"), and the
   * alternative is an empty drill, which TN-STUDY-03 shows only to a player who
   * has never answered anything.
   */
  const relaxed = [...ranked]
    .filter(heldBack)
    .sort((a, b) => (askedAgo.get(b.questionId) ?? 0) - (askedAgo.get(a.questionId) ?? 0));

  return ok([...chosen, ...relaxed.slice(0, count - chosen.length)].map(offered));
};

const offered = (item: Ranked): ScheduledQuestion => ({
  questionId: item.questionId,
  familiarity: item.familiarity,
});

/**
 * Fold the questions just asked into the recently-asked list, most recent first.
 *
 * The caller keeps this across drills, which is what makes TN-STUDY-02's "two
 * drills in a row do not repeat the same questions" hold. It is not persisted:
 * TN-STUDY-05 and TN-SAVE both say a drill does not survive a closed tab.
 */
export const rememberAsked = (
  recentlyAsked: readonly QuestionId[],
  asked: readonly QuestionId[],
  settings: SchedulerSettings,
): readonly QuestionId[] => {
  const merged = [...asked].reverse().concat(recentlyAsked);
  const seenIds = new Set<QuestionId>();
  const deduped: QuestionId[] = [];
  for (const id of merged) {
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    deduped.push(id);
  }
  return deduped.slice(0, Math.max(0, settings.exclusionWindow));
};
