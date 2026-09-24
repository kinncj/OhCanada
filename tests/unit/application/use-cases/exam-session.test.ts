/**
 * `docs/stories/TN-EXAM-02` — what the exam draws, and what it refuses to look
 * at.
 *
 * Two halves, and they are proved differently on purpose. The **allocation** is
 * arithmetic and is exercised over invented capacities, because the cases worth
 * pinning — a subject with two questions beside three with plenty — do not exist
 * in `content/questions/` and never will on demand. The **session** is exercised
 * over the real bundled bank, because "twenty questions, spread across the
 * subjects that are ready, from the files this repository ships" is a claim
 * about the build and not about a fixture.
 */

import { describe, expect, it } from 'vitest';

import { bundledQuestionBank } from '@adapters/content';
import { createSeededRandom } from '@adapters/random';
import type { ExamRules, QuestionBank, RandomSource, ShippableQuestion } from '@application/ports';
import type { QuestionId, SubjectId } from '@domain/ids';
import { ok } from '@common/result';

import {
  allocateQuotas,
  createExamSession,
  drawExam,
  type SubjectBank,
} from '@application/use-cases/exam-session';

const RULES: ExamRules = {
  questionCount: 20,
  passMark: 15,
  timeLimitSeconds: 1800,
  timerOptional: true,
};

/**
 * A question the draw can move around.
 *
 * Cast rather than minted: `Shippable` carries a symbol only
 * `shippableQuestions` can attach, and building four verified documents with
 * sources and evidence would be testing the content gate rather than the draw.
 * Nothing here reads a field the brand protects.
 */
const fakeQuestion = (subject: string, index: number): ShippableQuestion =>
  ({
    id: `${subject}-${String(index)}` as QuestionId,
    subject: subject as SubjectId,
    correctIndex: 0,
  }) as unknown as ShippableQuestion;

const bankOf = (sizes: Readonly<Record<string, number>>): readonly SubjectBank[] =>
  Object.entries(sizes).map(([subject, size]) => ({
    subject: subject as SubjectId,
    questions: Array.from({ length: size }, (_unused, index) => fakeQuestion(subject, index)),
  }));

const fakeBank = (sizes: Readonly<Record<string, number>>): QuestionBank => {
  const banks = bankOf(sizes);
  return {
    subjects: () => Promise.resolve(ok(banks.map((bank) => bank.subject))),
    questions: (subject) =>
      Promise.resolve(
        ok(banks.find((bank) => bank.subject === subject)?.questions ?? []),
      ),
  };
};

const countBySubject = (
  questions: readonly ShippableQuestion[],
): Readonly<Record<string, number>> => {
  const counted: Record<string, number> = {};
  for (const question of questions) {
    const subject = String(question.subject);
    counted[subject] = (counted[subject] ?? 0) + 1;
  }
  return counted;
};

describe('how the twenty are shared out', () => {
  it('splits evenly when every subject has plenty', () => {
    /* `TN-EXAM-02`: "each of those four subjects contributes 5 questions". No
       randomness is consulted at all here, and the assertion is exact. */
    const quotas = allocateQuotas(20, [40, 40, 40, 40], createSeededRandom(1));
    expect([...quotas]).toEqual([5, 5, 5, 5]);
  });

  it('spreads a remainder rather than dropping it', () => {
    const quotas = allocateQuotas(20, [40, 40, 40], createSeededRandom(1));
    expect(quotas.reduce((total, value) => total + value, 0)).toBe(20);
    expect([...quotas].sort()).toEqual([6, 7, 7]);
  });

  it('lets any subject be the short one, depending on the seed', () => {
    /*
     * `TN-EXAM-02`: "across exams started from different seeds, each of the
     * three subjects can be the one that contributes 6". Taking the remainder in
     * list order would make the same subject short in every exam of every save
     * — a bias nobody would ever see and everybody would inherit.
     *
     * Asserted on `allocateQuotas`, which is where the property lives: it is the
     * *first* thing the stream is asked for, and one shuffle of three decides
     * it. This case used to be driven through `drawExam` instead, because
     * `SeededRandomSource` was sfc32 with no warm-up rounds and its first
     * shuffle of three was identical for every seed from 1 to 40 — `drawExam`
     * shuffled the decks first, which spent a few hundred numbers and left the
     * stream warm before the remainder was handed round. That made the exam
     * correct by an ordering nobody could touch. The generator is fixed
     * (splitmix32 seeding plus the specified warm-up), the ordering in
     * `drawExam` is back to the one that reads, and the claim is made here
     * against a cold stream, which is the harder version of it.
     */
    const seeds = Array.from({ length: 40 }, (_unused, index) => index + 1);
    /* ADR-0024: over no seeds, "each subject can be short" is vacuously true. */
    expect(seeds).toHaveLength(40);

    const shortOnes = new Set<number>();
    for (const seed of seeds) {
      const quotas = allocateQuotas(20, [40, 40, 40], createSeededRandom(seed));
      expect([...quotas].sort()).toEqual([6, 7, 7]);
      shortOnes.add(quotas.indexOf(6));
    }
    expect([...shortOnes].sort()).toEqual([0, 1, 2]);
  });

  it('carries that through the whole draw, not only through the allocation', () => {
    /* The same claim one level up, so the two cannot drift: whatever `drawExam`
       does between the quotas and the cards, each of the three subjects still
       has to be able to be the one that contributes six. */
    const seeds = Array.from({ length: 40 }, (_unused, index) => index + 1);
    expect(seeds).toHaveLength(40);

    const shortOnes = new Set<string>();
    for (const seed of seeds) {
      const counted = countBySubject(
        drawExam(bankOf({ a: 40, b: 40, c: 40 }), 20, createSeededRandom(seed)),
      );
      const short = Object.entries(counted).sort(([, left], [, right]) => left - right)[0];
      if (short !== undefined) shortOnes.add(short[0]);
    }
    expect([...shortOnes].sort()).toEqual(['a', 'b', 'c']);
  });

  it('does not shrink the exam when one subject is nearly empty', () => {
    /* `TN-EXAM-02`: "that subject contributes its 2 questions and the remaining
       18 are spread across the other subjects … the exam still asks 20". */
    const quotas = allocateQuotas(20, [2, 40, 40, 40], createSeededRandom(7));
    expect(quotas[0]).toBe(2);
    expect(quotas.reduce((total, value) => total + value, 0)).toBe(20);
  });

  it('takes everything from one subject when that is all there is', () => {
    expect([...allocateQuotas(20, [40], createSeededRandom(3))]).toEqual([20]);
  });

  it('asks for no more than exists', () => {
    const quotas = allocateQuotas(20, [3, 4], createSeededRandom(3));
    expect([...quotas]).toEqual([3, 4]);
  });

  it('asks for nothing when nothing was asked for', () => {
    expect([...allocateQuotas(0, [10, 10], createSeededRandom(3))]).toEqual([0, 0]);
  });
});

describe('the draw itself', () => {
  it('asks each ready subject for its share, and never one question twice', () => {
    const drawn = drawExam(bankOf({ a: 40, b: 40, c: 40, d: 40 }), 20, createSeededRandom(11));
    expect(drawn).toHaveLength(20);
    expect(new Set(drawn.map((question) => String(question.id))).size).toBe(20);
    expect(countBySubject(drawn)).toEqual({ a: 5, b: 5, c: 5, d: 5 });
  });

  it('mixes the subjects rather than asking them one block at a time', () => {
    const drawn = drawExam(bankOf({ a: 40, b: 40, c: 40, d: 40 }), 20, createSeededRandom(11));
    const blocks = drawn.filter(
      (question, index) => index > 0 && question.subject !== drawn[index - 1]?.subject,
    ).length;
    /* A real test would be an exam whose first five questions are all about one
       chapter; anything above a handful of changes is a mixed paper. */
    expect(blocks).toBeGreaterThan(5);
  });

  it('replays exactly from its seed', () => {
    const banks = bankOf({ a: 40, b: 40, c: 40 });
    const first = drawExam(banks, 20, createSeededRandom(2026));
    const second = drawExam(banks, 20, createSeededRandom(2026));
    expect(first.map((question) => String(question.id))).toEqual(
      second.map((question) => String(question.id)),
    );
  });

  it('avoids the previous exam while it can, and fills the exam when it cannot', () => {
    const banks = bankOf({ a: 40, b: 40 });
    const first = drawExam(banks, 20, createSeededRandom(5));
    const avoid = new Set(first.map((question) => question.id));
    const second = drawExam(banks, 20, createSeededRandom(6), avoid);
    expect(second).toHaveLength(20);
    for (const question of second) expect(avoid.has(question.id)).toBe(false);

    /* Sixty questions cannot fill two exams of forty. `TN-RESULT-06`: "unless
       fewer questions are ready than two exams need" — the exam stays twenty. */
    const tight = bankOf({ a: 15, b: 15 });
    const one = drawExam(tight, 20, createSeededRandom(5));
    const two = drawExam(tight, 20, createSeededRandom(6), new Set(one.map((q) => q.id)));
    expect(two).toHaveLength(20);
  });
});

describe('the exam session, over the shipped bank', () => {
  const sessionOver = (bank = bundledQuestionBank, seed = 2026): ReturnType<typeof createExamSession> =>
    createExamSession({ bank, random: createSeededRandom(seed), rules: RULES });

  it('carries the configured numbers, so no screen writes one down', () => {
    expect(sessionOver().rules).toEqual(RULES);
  });

  it('reports what the build can ask, and that it is enough', async () => {
    const readiness = await sessionOver().readiness();
    expect(readiness.ok).toBe(true);
    if (!readiness.ok) return;
    expect(readiness.value.total).toBeGreaterThanOrEqual(RULES.questionCount);
    expect(readiness.value.ready).toBe(true);
    expect(readiness.value.subjectsReady).toBeGreaterThan(0);
  });

  it('draws twenty verified questions with both languages, never one twice', async () => {
    const drawn = await sessionOver().draw();
    expect(drawn.ok).toBe(true);
    if (!drawn.ok) return;
    expect(drawn.value).toHaveLength(20);
    expect(new Set(drawn.value.map((question) => String(question.id))).size).toBe(20);
    for (const question of drawn.value) {
      expect(question.verification.status).toBe('verified');
      expect(question.prompt.en.length).toBeGreaterThan(0);
      expect(question.prompt.fr.length).toBeGreaterThan(0);
      expect(question.options).toHaveLength(4);
    }
  });

  it('draws the same twenty in the same order from the same seed', async () => {
    const first = await sessionOver().draw();
    const second = await sessionOver().draw();
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.map((question) => String(question.id))).toEqual(
      second.value.map((question) => String(question.id)),
    );
  });

  it('spreads across the subjects that are ready', async () => {
    const drawn = await sessionOver().draw();
    expect(drawn.ok).toBe(true);
    if (!drawn.ok) return;
    const counted = countBySubject([...drawn.value]);
    const readiness = await sessionOver().readiness();
    if (!readiness.ok) return;
    /*
     * With nine subjects and twenty questions the even share is two, and the
     * remainder is two more. What must never happen is one subject carrying the
     * paper, so the assertion is on the spread rather than on a literal.
     */
    expect(Object.keys(counted).length).toBeGreaterThan(1);
    expect(Math.max(...Object.values(counted))).toBeLessThanOrEqual(
      Math.ceil(20 / readiness.value.subjectsReady) + 1,
    );
  });

  it('refuses rather than shortening when the bank is too small', async () => {
    const session = sessionOver(fakeBank({ a: 12 }));
    const readiness = await session.readiness();
    expect(readiness.ok && readiness.value.ready).toBe(false);

    const drawn = await session.draw();
    expect(drawn.ok).toBe(false);
    if (drawn.ok) return;
    /* `TN-EXAM-05`: "no exam is started with fewer than 20 questions". */
    expect(drawn.error.code).toBe('exam.bank.tooSmall');
  });

  it('indexes every question by id, for a resumed exam and for a review', async () => {
    const index = await sessionOver().byId();
    expect(index.ok).toBe(true);
    if (!index.ok) return;
    const drawn = await sessionOver().draw();
    if (!drawn.ok) return;
    for (const question of drawn.value) expect(index.value.has(question.id)).toBe(true);
  });

  it('cannot read the player, because it is not given one', () => {
    /*
     * `TN-EXAM-02`: "two saved games with the same seed and opposite answer
     * histories draw the same twenty". Asserted structurally rather than by
     * building two saves: `createExamSession` takes a bank, a stream and the
     * config, and there is no `progress`, no `clock` and no `tuning` to pass —
     * so a draw that consulted a review record could not be written without
     * changing this signature, which is a thing a reviewer sees.
     */
    const deps = { bank: bundledQuestionBank, random: createSeededRandom(1), rules: RULES };
    expect(Object.keys(deps).sort()).toEqual(['bank', 'random', 'rules']);
  });
});

describe('the exam mix for eleven ready subjects (ADR-0068 §8)', () => {
  /*
   * `docs/plan/kingston.md` K-0.4. The journey after Kingston lands, in journey
   * order, with each subject's verified count: `history` 32 and
   * `building-canada` 65 after the split (ADR-0068 §6), the other nine as
   * `content/questions/*` holds them today. The fixture is fixed rather than
   * read from the bank, because the claim is ADR-0068 §8's table and the table
   * was written against these numbers. Total 493, the ADR's denominator.
   */
  const ELEVEN: readonly (readonly [string, number])[] = [
    ['rights', 38],
    ['who-we-are', 48],
    ['history', 32],
    ['government', 41],
    ['building-canada', 65],
    ['elections', 37],
    ['justice', 39],
    ['modern-canada', 40],
    ['economy', 51],
    ['symbols', 43],
    ['regions', 59],
  ];
  const SUBJECTS = ELEVEN.map(([subject]) => subject);
  const CAPACITIES = ELEVEN.map(([, capacity]) => capacity);
  const HISTORY = SUBJECTS.indexOf('history');
  const BUILDING = SUBJECTS.indexOf('building-canada');

  const sum = (values: readonly number[]): number =>
    values.reduce((total, value) => total + value, 0);

  it('is the fixture ADR-0068 §8 was written against', () => {
    expect(ELEVEN).toHaveLength(11);
    expect(new Set(SUBJECTS).size).toBe(11);
    expect(sum(CAPACITIES)).toBe(493);
    expect((CAPACITIES[HISTORY] ?? 0) + (CAPACITIES[BUILDING] ?? 0)).toBe(97);
    /* §8: "every capacity here is at least 2, so no subject fills up early". */
    for (const capacity of CAPACITIES) expect(capacity).toBeGreaterThanOrEqual(2);
  });

  it('pins the exact quotas for a fixed seed', () => {
    const quotas = allocateQuotas(20, CAPACITIES, createSeededRandom(2026));
    const bySubject = Object.fromEntries(
      SUBJECTS.map((subject, index) => [subject, quotas[index]]),
    );
    /* Seed 2026: symbols and who-we-are are the two dealt no extra question. */
    expect(bySubject).toEqual({
      rights: 2,
      'who-we-are': 1,
      history: 2,
      government: 2,
      'building-canada': 2,
      elections: 2,
      justice: 2,
      'modern-canada': 2,
      economy: 2,
      symbols: 1,
      regions: 2,
    });
    expect(sum(quotas)).toBe(20);
    for (const quota of quotas) {
      expect(quota).toBeGreaterThanOrEqual(1);
      expect(quota).toBeLessThanOrEqual(2);
    }
    /* Replays from its seed: the pin is the stream, not a lucky draw. */
    expect([...allocateQuotas(20, CAPACITIES, createSeededRandom(2026))]).toEqual([...quotas]);
  });

  it('asks twenty, one or two from every subject, nine of them two, for any seed', () => {
    const seeds = Array.from({ length: 200 }, (_unused, index) => index + 1);
    expect(seeds).toHaveLength(200);
    for (const seed of seeds) {
      const quotas = allocateQuotas(20, CAPACITIES, createSeededRandom(seed));
      expect(quotas).toHaveLength(11);
      expect(sum(quotas)).toBe(20);
      for (const quota of quotas) {
        expect(quota).toBeGreaterThanOrEqual(1);
        expect(quota).toBeLessThanOrEqual(2);
      }
      expect(quotas.filter((quota) => quota === 2)).toHaveLength(9);
    }
  });

  it("matches §8's table exactly, over every way the remainder can fall", () => {
    /*
     * 20 = 11 × 1 + 9, and floor(9 / 11) = 0, so the second round is one
     * shuffle of all eleven and the first nine in it get the extra question.
     * Which nine depends only on which two come last, and a uniform shuffle
     * makes each of the C(11, 2) = 55 pairs equally likely (each is 2! × 9!
     * orderings). So enumerating the 55 pairs through a stub whose `shuffle`
     * puts that pair last is the exact distribution, not an estimate of it.
     */
    const stubPuttingLast = (left: number, right: number): RandomSource => ({
      next: () => 0,
      int: (minInclusive) => minInclusive,
      pick: (items) => items[0],
      shuffle: <T>(items: readonly T[]): readonly T[] => [
        ...items.filter((item) => item !== left && item !== right),
        ...items.filter((item) => item === left || item === right),
      ],
    });

    const perSubjectTwos = SUBJECTS.map(() => 0);
    const pairTotals = new Map<number, number>();
    let pairs = 0;
    for (let left = 0; left < 11; left += 1) {
      for (let right = left + 1; right < 11; right += 1) {
        const quotas = allocateQuotas(20, CAPACITIES, stubPuttingLast(left, right));
        expect(sum(quotas)).toBe(20);
        quotas.forEach((quota, index) => {
          if (quota === 2) perSubjectTwos[index] = (perSubjectTwos[index] ?? 0) + 1;
        });
        const pair = (quotas[HISTORY] ?? 0) + (quotas[BUILDING] ?? 0);
        pairTotals.set(pair, (pairTotals.get(pair) ?? 0) + 1);
        pairs += 1;
      }
    }
    expect(pairs).toBe(55);

    /* "Each subject: 2 with p = 9/11, 1 with p = 2/11; mean 1.82". 9/11 of 55 is 45. */
    for (const twos of perSubjectTwos) expect(twos).toBe(45);
    expect(((45 * 2 + 10 * 1) / 55).toFixed(2)).toBe('1.82');

    /* "history + building-canada: 4 with p = 72/110, 3 with p = 36/110,
       2 with p = 2/110; mean 3.64 (18.2%)". Over 55 pairs: 36, 18 and 1. */
    expect(Object.fromEntries(pairTotals)).toEqual({ 4: 36, 3: 18, 2: 1 });
    const meanPair = (4 * 36 + 3 * 18 + 2 * 1) / 55;
    expect(meanPair.toFixed(2)).toBe('3.64');
    expect(((meanPair / 20) * 100).toFixed(1)).toBe('18.2');
    /* "Any other subject: 1 in about 18% of exams": 10 of 55. */
    expect(((10 / 55) * 100).toFixed(0)).toBe('18');
  });
});
