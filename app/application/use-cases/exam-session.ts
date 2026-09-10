/**
 * ExamSession — the seam Exam mode mounts against, and the draw that makes an
 * exam an exam rather than a long drill.
 *
 * `study-session.ts` is the shape this follows: everything below is stated in
 * ports — a `QuestionBank`, a `RandomSource` — so it names no concrete, runs
 * under `environment: 'node'`, and falls inside the >= 90% coverage gate.
 * `app/bootstrap` chooses *which* bank and *which* stream; it does not decide
 * what an exam is.
 *
 * ## What an exam draws, and what it refuses to look at
 *
 * `TN-EXAM-02` is written so that an exam drawn from the scheduler fails it, and
 * that is the whole reason this module exists beside `StudySession` instead of
 * being a longer `drill(20)`:
 *
 *  - **The draw is representative, not scheduled.** It spreads as evenly as it
 *    can across the subjects that have verified questions, and the remainder
 *    goes by the seeded random source rather than by subject order.
 *  - **`Progress` is not a dependency of this file.** Not "is not consulted" —
 *    is not *reachable*. There is no `progress` in {@link ExamSessionDeps}, so a
 *    draw that read a review record, a due date or the exclusion window could
 *    not be written here without adding a parameter somebody would have to
 *    justify. `TN-EXAM-02`'s "two saved games with the same seed and opposite
 *    answer histories draw the same twenty" is therefore true by construction.
 *  - **No `Clock` either**, for the same reason: a due date is a comparison
 *    against now, and there is no now here.
 *
 * ## What it does not do
 *
 * Record anything, hold an attempt, or run a clock. An attempt is a value in
 * `Progress` (`exam-attempt.ts` folds one), the clock is `app/ui/exam-clock.ts`,
 * and the screens are `app/bootstrap/exam.ts`'s to compose. This module answers
 * two questions and no others: *can the exam run*, and *which twenty questions*.
 */

import { appErr, ok } from '@common/result';
import type { Result } from '@common/result';
import type { ExamRules, QuestionBank, RandomSource, ShippableQuestion } from '@application/ports';
import type { QuestionId, SubjectId } from '@domain/ids';

/** One subject's shippable bank, as the draw sees it. */
export interface SubjectBank {
  readonly subject: SubjectId;
  readonly questions: readonly ShippableQuestion[];
}

/**
 * How much of the exam this build can actually run.
 *
 * `subjectsReady` is what `exam.subjectsReady` counts, and `total` is what
 * decides between the start screen and `TN-EXAM-05`'s not-ready screen. Both
 * come from the same load, so the number on the screen and the number of cards
 * cannot disagree — the discipline `StudySession.available()` set.
 */
export interface ExamReadiness {
  /** Every question this build can ask, across every subject. */
  readonly total: number;
  /** How many subjects have a bank at all. Never larger than the game's total. */
  readonly subjectsReady: number;
  /** `true` when at least `questionCount` questions exist to draw from. */
  readonly ready: boolean;
}

export interface ExamSession {
  /** Ask the bank. Called every time the exam opens, never cached at boot. */
  readiness(): Promise<Result<ExamReadiness>>;
  /**
   * Draw one exam: `questionCount` questions, spread across the subjects that
   * are ready, in the order they are to be asked.
   *
   * `avoid` is the previous exam's question ids (`TN-RESULT-06`: "no question
   * from the previous exam is drawn, unless fewer questions are ready than two
   * exams need"). It is honoured only while it can be honoured *and still fill
   * the exam*, because a short exam is not an exam.
   */
  draw(avoid?: ReadonlySet<QuestionId>): Promise<Result<readonly ShippableQuestion[]>>;
  /**
   * Every question this build can show, by id.
   *
   * What resuming an attempt and drawing its review both need: a saved answer
   * names a question and the wording is not in the save (`ADR-0027` copies the
   * subject and the right answer down, and deliberately not the words).
   */
  byId(): Promise<Result<ReadonlyMap<QuestionId, ShippableQuestion>>>;
  /** `exam.questionCount`, `exam.passMark`, `exam.timeLimitSeconds` — config, never a literal. */
  readonly rules: ExamRules;
}

export interface ExamSessionDeps {
  readonly bank: QuestionBank;
  /** Fork it (`random.fork('exam')`): a draw must not shift under a shuffled card. */
  readonly random: RandomSource;
  readonly rules: ExamRules;
}

/**
 * How many questions each subject contributes.
 *
 * The rule, in one sentence: **share what is left equally among the subjects
 * that can still take more, until nothing is left or nobody can.** Everything
 * interesting is in the second half of that sentence.
 *
 *  - Four subjects with plenty and twenty questions: five each, no remainder,
 *    no randomness involved at all (`TN-EXAM-02`).
 *  - Three subjects with plenty and twenty: six each, then a remainder of two,
 *    handed out one at a time in a **shuffled** order — so 7/7/6 with a
 *    different subject short each time the seed changes, rather than the last
 *    subject in some list always losing.
 *  - A subject with two questions and three with plenty: it contributes its two
 *    and the other eighteen are shared among the rest. The exam still asks
 *    twenty. This is the case a single `floor(count / subjects)` gets wrong, and
 *    it gets it wrong quietly — by asking eighteen questions.
 *
 * Exported for its own test: the allocation is the part of the draw with
 * arithmetic in it, and it is worth being able to fail on `[2, 40, 40, 40]`
 * without a bank, a random source or a promise.
 */
export function allocateQuotas(
  count: number,
  capacities: readonly number[],
  random: RandomSource,
): readonly number[] {
  const quotas = capacities.map(() => 0);
  let remaining = Math.max(0, count);

  /* Indices that could still take one more question. Recomputed each round,
     because a subject fills up mid-round and must not be counted in the next
     division — which is exactly how eighteen questions get drawn for twenty. */
  const roomLeft = (): readonly number[] =>
    capacities.flatMap((capacity, index) => ((quotas[index] ?? 0) < capacity ? [index] : []));

  let pool = roomLeft();
  while (remaining > 0 && pool.length > 0) {
    const share = Math.floor(remaining / pool.length);
    if (share === 0) {
      /*
       * Fewer left than there are subjects: one each, in a shuffled order.
       *
       * `TN-EXAM-02`: "a remainder is spread by chance, not by subject order …
       * each of the three subjects can be the one that contributes 6". Taking
       * them in list order would make the same subject short in every exam of
       * every save, which is a bias nobody would ever see and everybody would
       * inherit.
       */
      for (const index of random.shuffle(pool)) {
        if (remaining === 0) break;
        quotas[index] = (quotas[index] ?? 0) + 1;
        remaining -= 1;
      }
    } else {
      for (const index of pool) {
        const capacity = capacities[index] ?? 0;
        const room = capacity - (quotas[index] ?? 0);
        const take = Math.min(share, room);
        quotas[index] = (quotas[index] ?? 0) + take;
        remaining -= take;
      }
    }
    pool = roomLeft();
  }

  return quotas;
}

/**
 * The draw itself: quotas, then that many at random from each subject, then one
 * shuffle over the lot.
 *
 * The final shuffle is what makes it an exam rather than nine short quizzes end
 * to end — the real test mixes its subjects — and it is done with the same
 * seeded stream, so "the same seed draws the same twenty **in the same order**"
 * (`TN-EXAM-02`) survives it.
 *
 * `avoid` is dropped wholesale rather than partially when honouring it would
 * shorten the exam. Partially honouring it would bias the second exam towards
 * whichever subjects happened to have spare questions, which is a worse failure
 * than repeating a question in a game whose whole bank is 389 questions.
 */
export function drawExam(
  banks: readonly SubjectBank[],
  count: number,
  random: RandomSource,
  avoid: ReadonlySet<QuestionId> = new Set(),
): readonly ShippableQuestion[] {
  const trimmed = banks.map((bank) => ({
    subject: bank.subject,
    questions: bank.questions.filter((question) => !avoid.has(question.id)),
  }));
  const spare = trimmed.reduce((total, bank) => total + bank.questions.length, 0);
  const pools = spare >= count ? trimmed : banks;

  /*
   * Each subject's deck is shuffled **before** the quotas are worked out, not
   * after, and the order matters for a measured reason.
   *
   * `SeededRandomSource` is sfc32 with no warm-up rounds, so the first few
   * outputs of two nearby seeds are nearly equal — measured: the first shuffle
   * of a three-element array is *identical* for every seed from 1 to 40. Working
   * the quotas out first would therefore hand the remainder round in the same
   * order every time, and `TN-EXAM-02`'s "each of the three subjects can be the
   * one that contributes 6" would be false in exactly the way nobody would ever
   * see. Shuffling the decks first spends a few hundred numbers and leaves the
   * stream warm. Reported upward as an adapter defect: the fix belongs in the
   * generator, and this ordering is correct on its own terms either way — a
   * subject's questions are drawn from a shuffled deck rather than sliced off
   * the front of the directory.
   */
  const decks = pools.map((bank) => ({
    subject: bank.subject,
    questions: random.shuffle(bank.questions),
  }));

  const quotas = allocateQuotas(count, decks.map((deck) => deck.questions.length), random);

  const picked = decks.flatMap((deck, index) => deck.questions.slice(0, quotas[index] ?? 0));

  return random.shuffle(picked);
}

/**
 * Load every subject's bank, tolerating a subject that admits nothing.
 *
 * The same tolerance `loadEveryBank` applies and for the same measured reason: a
 * directory of authored questions with no verifier run yet must not take the
 * exam offline over the 389 questions that *are* verified. A chunk that will not
 * download and a malformed document still fail the whole call, because those are
 * "this build is broken" rather than "this subject is not ready".
 */
async function loadBanks(bank: QuestionBank): Promise<Result<readonly SubjectBank[]>> {
  const subjects = await bank.subjects();
  if (!subjects.ok) return subjects;

  const loaded = await Promise.all(subjects.value.map((subject) => bank.questions(subject)));

  const banks: SubjectBank[] = [];
  for (const [index, result] of loaded.entries()) {
    const subject = subjects.value[index];
    if (subject === undefined) continue;
    if (result.ok) {
      banks.push({ subject, questions: result.value });
      continue;
    }
    if (result.error.code !== 'content.questions.bank.empty') return result;
  }

  /* Stable order regardless of what the catalogue happened to return, so two
     builds with the same seed allocate the same quotas to the same subjects. */
  return ok([...banks].sort((left, right) => String(left.subject).localeCompare(String(right.subject))));
}

export const createExamSession = (deps: ExamSessionDeps): ExamSession => ({
  rules: deps.rules,

  async readiness(): Promise<Result<ExamReadiness>> {
    const banks = await loadBanks(deps.bank);
    if (!banks.ok) return banks;
    const total = banks.value.reduce((sum, bank) => sum + bank.questions.length, 0);
    return ok({
      total,
      subjectsReady: banks.value.length,
      ready: total >= deps.rules.questionCount,
    });
  },

  async draw(avoid): Promise<Result<readonly ShippableQuestion[]>> {
    const banks = await loadBanks(deps.bank);
    if (!banks.ok) return banks;

    const total = banks.value.reduce((sum, bank) => sum + bank.questions.length, 0);
    if (total < deps.rules.questionCount) {
      /*
       * Refused rather than shortened. `TN-EXAM-05`: "no exam is started with
       * fewer than 20 questions" — a fifteen-question exam scored out of fifteen
       * against a pass mark of fifteen is not the thing the player asked for,
       * and it is the shape that reads as working.
       */
      return appErr(
        'not-found',
        'exam.bank.tooSmall',
        `an exam asks ${String(deps.rules.questionCount)} questions and this build can ask ` +
          `${String(total)}. The exam is not ready; Study still is.`,
        { asked: deps.rules.questionCount, available: total },
      );
    }

    return ok(drawExam(banks.value, deps.rules.questionCount, deps.random, avoid));
  },

  async byId(): Promise<Result<ReadonlyMap<QuestionId, ShippableQuestion>>> {
    const banks = await loadBanks(deps.bank);
    if (!banks.ok) return banks;
    const index = new Map<QuestionId, ShippableQuestion>();
    for (const bank of banks.value) {
      for (const question of bank.questions) index.set(question.id, question);
    }
    return ok(index);
  },
});
