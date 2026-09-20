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
 *     plus a window that only holds back a question whose moment has not come —
 *     and, for a draw that says it is a new drill, `askMissedAgain`, which lets
 *     what the player has just missed come round ahead of new material instead
 *     of waiting out the one to ten minutes its short-term step bought it.
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
  /**
   * Does `dailyNewLimit` cap this draw? Default `true` (ADR-0054).
   *
   * `false` for a draw whose count was **promised to the player**: a quest
   * `answer` step says "Answer 3 questions" on the tracker before a single one is
   * asked. The limit is Study's pacing rule — TN-STUDY-02's "new questions, but
   * not all at once" — and pacing a drill the player chose to take is not the same
   * act as refusing to ask a question the game has already committed to.
   *
   * It has to be a bypass here rather than a bigger number in
   * `game.config.json`, because a fresh question the budget cut is not held back:
   * it is `due`, so `heldBack` is false for it and the relaxation pass below can
   * never bring it round again. The draw is simply short, silently, and a step
   * that comes back short can never be finished — which is how Peggy's Cove
   * locked levels 3–10 for every new player.
   */
  readonly dailyNewLimitApplies?: boolean;
  /**
   * Is this draw a **new drill**, which may ask again what the player has just
   * missed? Default `false`.
   *
   * A wrong answer buys a question one to ten minutes (the learning and
   * relearning steps), so for that long it is not due, the exclusion window
   * holds it back, and the day's new material outranks it. Between one card and
   * the next that is exactly right: it is what stops the same question being put
   * straight back on screen, and it is the property the 30-question draw in
   * `tests/unit/domain/scheduling/question-scheduler.test.ts` pins.
   *
   * Between one *drill* and the next it is wrong, and it is what made Study's
   * summary lie: "We will ask these again:" over a list, with a "Study again"
   * button under it that drew five questions the player had never seen. A drill
   * boundary is the one thing this module cannot see — `recentlyAsked` is a flat
   * list with no seam in it — so the caller says, the same way a promised count
   * says `dailyNewLimitApplies` (ADR-0054).
   *
   * Nothing about FSRS moves either way: no `dueAt`, `stability` or `difficulty`
   * is written here, and `recordAnswer` measures elapsed time in whole UTC days,
   * so a question re-asked thirty seconds after the miss is graded exactly as one
   * re-asked ten minutes after it. What this changes is the order of the asking,
   * never the memory the answer writes.
   */
  readonly askMissedAgain?: boolean;
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
 * How many never-seen questions the player has already met today — **from
 * anywhere**, including the draws the cap does not apply to (ADR-0062 §2).
 *
 * Counted from `firstReviewedAt`, so drilling a question a second time does not
 * quietly give the day's budget back. Falling back to `reps === 1` would make
 * `dailyNewLimit` bypassable by tapping "Study again", which is exactly the
 * scenario TN-STUDY-02 writes the limit for.
 *
 * Why exempt draws still count, now that Study is the only thing capped. What a
 * new question costs is not the minute it takes to answer, it is the reviews it
 * owes for the rest of the month — and a question first met at a landmark owes
 * exactly what one first met in Study owes. So this measures the day's *load*,
 * which is source-independent, and the cap then decides the one question it can
 * still honestly decide: whether Study piles more on top. Counting only Study's
 * own introductions would have Study add ten to a day that had already
 * delivered seventy-six (measured, `journey` order, one sitting), which is the
 * opposite of what the limit is for.
 *
 * The cost, stated because it is real: after a long sitting the budget is spent
 * before Study is opened, so Study introduces nothing new for the rest of that
 * UTC day. It is never *starved* by this — a spent budget means ten questions
 * were introduced today, and those ten are themselves reviewable, so the `due`
 * and not-yet-due tiers fill the drill (measured: five of five, none of them
 * new). What a heavy day changes is what Study is *for*: consolidating what the
 * levels taught, instead of opening more.
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
  /** The moment the schedule set for this question. Orders the tier below. */
  readonly moment: EpochMillis;
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
 * Soonest moment first: "due soonest" for questions that are not due yet.
 *
 * The one ordering a missed question's own schedule states. A player who missed
 * a question a minute ago and one ten minutes ago meets them in that order.
 */
const bySoonestMoment = (a: Ranked, b: Ranked): number =>
  a.moment - b.moment || b.jitter - a.jitter || a.order - b.order;

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
  /** Missed, and its moment has not arrived. Empty unless the caller asked. */
  const missedSoon: Ranked[] = [];
  const askMissedAgain = request.askMissedAgain === true;

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
        moment: now,
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
        moment: record.dueAt,
        key: lateness(record, now),
        jitter,
        order,
      });
    } else if (missed && askMissedAgain) {
      // Missed, and its moment is minutes away rather than here. A new drill may
      // ask it now: the player was told it was coming back, and the order below
      // is the one its own schedule states.
      missedSoon.push({
        questionId,
        familiarity: 'seen',
        due: false,
        missed,
        moment: record.dueAt,
        key: 0,
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
        moment: record.dueAt,
        key: weightOf(record, settings) * (1 - recallProbabilityNow(record, now, memory)),
        jitter,
        order,
      });
    }
  });

  /*
   * ADR-0054. A promised count introduces whatever it needs; every other draw is
   * paced by the day's budget. `fresh.length` rather than `Infinity` so the slice
   * below stays a slice of a known length.
   */
  const newBudget =
    request.dailyNewLimitApplies === false
      ? fresh.length
      : Math.max(0, settings.dailyNewLimit - introducedToday(reviews, now));

  const ranked: readonly Ranked[] = [
    // Everything whose moment has come, missed questions at the front of it.
    ...[...due].sort(byMissedThenKey),
    // Then, for a new drill, what the player has just missed, soonest first:
    // "We will ask these again" is a promise this tier keeps (TN-STUDY-04).
    // Empty for every other draw, which leaves the three tiers below unchanged.
    ...[...missedSoon].sort(bySoonestMoment),
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
    /* A new drill is the break TN-CARD-04's "again soon" was measured against,
       so the window no longer holds a question the player got wrong. It still
       holds every question they got right, which is the other half of the same
       rule and the half a study tool must not break. */
    if (item.missed && askMissedAgain) return false;
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
