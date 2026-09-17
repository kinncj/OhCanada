/**
 * The gate for ADR-0057: **no subject's correct answers may cluster on one
 * position the player can see.**
 *
 * ## The defect this exists to have caught
 *
 * A live-site audit tapped the first option on every question and scored Halifax
 * 9/9, Peggy's Cove 6/6, Winnipeg 7/7 and Québec City 9/9 — thirty-one in a row,
 * in both languages, across independent sessions. The cause was not a bad
 * shuffle. It was no shuffle at all, over a bank whose authors had been told by
 * `docs/guidelines/anatomy-of-a-question.md` that "the game shuffles them at play
 * time from a seed" and had therefore, correctly, written the true option first.
 *
 * ## Why this gate measures the *presentation* and not the bank on disk
 *
 * The obvious gate — "no subject may have too many questions with
 * `correctIndex: 0`" — is the wrong one, twice over.
 *
 * It fails on content that is fine. The authoring guideline tells an author to
 * put the answer wherever it reads most clearly and let the game hide it, so a
 * subject sitting at 100% index 0 is an author following instructions, not an
 * author making a mistake. Gating the file would mean telling authors to
 * obfuscate their own documents, and a reviewer who cannot see the answer at a
 * glance reviews worse.
 *
 * And it measures the wrong thing. What harmed the learner was the position of
 * the key **on screen**. That is a property of the draw path, and it is the
 * property that regressed: the bank never changed, the presentation never
 * existed. So this file runs the real generator over the real bank through the
 * real ordering function, and asserts about what a player would actually see.
 * Delete the shuffle and this goes red; re-key the whole bank and it stays green,
 * which is the correct response to both.
 *
 * ## It has been seen to fail
 *
 * `docs/plan/slices.md` Rules: "A gate is not trusted until it has been seen to
 * fail on a real violation." Two assertions here are that proof, and they are
 * ordinary assertions rather than a comment claiming it was checked once:
 * {@link clusteredSubjects} is run against a synthetic answer-first bank and
 * against the shipped presentation, and only the second is allowed to be empty.
 *
 * ## Thresholds, and where the numbers came from
 *
 * Measured over the 498 questions in the tree, with the shipped generator, the
 * worst single-position share any subject reaches is **43.8%** across the eight
 * pinned sittings below, and **53.8%** across seeds 1–400. `MAX_SHARE` is 0.60:
 * comfortably above the noise a real shuffle produces on a 30-question subject,
 * and far below the 95.8%–100% the four broken levels shipped. The aggregate
 * band is tighter because it has 3 984 draws under it rather than 30: measured
 * shares are 24.95 / 23.77 / 25.70 / 25.58, so ±4 points is a wide margin that
 * still rejects the shipped 63.9 / 15.9 / 13.1 / 7.2.
 *
 * Nothing here is random. The seeds are pinned, so this file either passes for
 * everyone for ever or fails for everyone for ever; it cannot flake.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createSeededRandom } from '@adapters/random';
import {
  AUTHORED_ORDER,
  shownAt,
  shuffledOptionOrder,
  type OptionOrder,
} from '@domain/entities/asked-question';

const BANK_DIR = fileURLToPath(new URL('../../../content/questions/', import.meta.url));

/**
 * The sittings this gate replays.
 *
 * Eight rather than one, because a single seed proves a single permutation
 * sequence and the property is about the generator, not about one draw. Pinned
 * rather than sampled, because a gate that picks its own seeds reports a
 * different verdict on different days and stops being evidence.
 */
const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34] as const;

/** No position may hold more than this share of one subject's keys. */
const MAX_SHARE = 0.6;

/** How far the whole bank's four positions may sit from an even 25%. */
const AGGREGATE_TOLERANCE = 0.04;

/** The one thing this gate reads out of a question document. */
const keysIn = (subject: string): readonly number[] =>
  readdirSync(`${BANK_DIR}${subject}`)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((file) => {
      const document = JSON.parse(readFileSync(`${BANK_DIR}${subject}/${file}`, 'utf8')) as {
        readonly correctIndex: number;
      };
      return document.correctIndex;
    });

const subjectDirs = (): readonly string[] =>
  readdirSync(BANK_DIR)
    .filter((name) => statSync(`${BANK_DIR}${name}`).isDirectory())
    .sort();

/** subject -> the authored key of every question in it, in a stable order. */
const bank = (): ReadonlyMap<string, readonly number[]> =>
  new Map(subjectDirs().map((subject) => [subject, keysIn(subject)]));

/**
 * How a sitting presents a question.
 *
 * `null` is the shipped presentation: one seeded stream per sitting, a fresh
 * order per question, exactly as `createDrillRunner` and the exam controller
 * draw it. An explicit order is how the known-bad input below is expressed.
 */
type Presentation = OptionOrder | null;

/** Where the key lands on screen, per position, for one subject in one sitting. */
const positionsIn = (
  keys: readonly number[],
  seed: number,
  fixed: Presentation,
): readonly number[] => {
  /* `fork('options')` because that is what the composition root hands the card:
     measuring the parent stream would measure a generator no player ever meets. */
  const random = createSeededRandom(seed).fork('options');
  const histogram = [0, 0, 0, 0];
  for (const key of keys) {
    const order = fixed ?? shuffledOptionOrder(random);
    const at = shownAt(order, key);
    expect(at, `a key of ${String(key)} landed nowhere on screen`).not.toBeNull();
    const position = at as number;
    histogram[position] = (histogram[position] ?? 0) + 1;
  }
  return histogram;
};

/**
 * Every subject whose keys pile up on one visible position, with the evidence.
 *
 * The check itself, factored out so the same function judges the shipped
 * presentation and the known-bad one. A gate whose failing case runs different
 * code from its passing case has not been seen to fail.
 */
const clusteredSubjects = (
  questions: ReadonlyMap<string, readonly number[]>,
  fixed: Presentation,
): readonly string[] => {
  const breaches: string[] = [];
  for (const [subject, keys] of questions) {
    if (keys.length === 0) continue;
    for (const seed of SEEDS) {
      const histogram = positionsIn(keys, seed, fixed);
      const worst = Math.max(...histogram);
      if (worst / keys.length > MAX_SHARE) {
        breaches.push(
          `${subject}: ${String(worst)} of ${String(keys.length)} correct answers sit on ` +
            `option ${String(histogram.indexOf(worst) + 1)} of 4 (seed ${String(seed)}).`,
        );
        break;
      }
    }
  }
  return breaches;
};

describe('the answer is not always in the same place', () => {
  const questions = bank();
  const subjects = [...questions.keys()];

  it('has a bank to measure at all', () => {
    /* The floor under every assertion below. `every([])` is true and
       `Math.max()` of nothing is -Infinity, so a bank this file cannot find
       would otherwise report a confident green about nothing (ADR-0024). */
    expect(subjects.length).toBeGreaterThan(0);
    const total = [...questions.values()].reduce((sum, keys) => sum + keys.length, 0);
    expect(total).toBeGreaterThan(0);
    for (const [subject, keys] of questions) {
      expect(keys.length, `${subject} has no questions`).toBeGreaterThan(0);
      for (const key of keys) {
        expect(key, `${subject} has a key outside 0-3`).toBeGreaterThanOrEqual(0);
        expect(key, `${subject} has a key outside 0-3`).toBeLessThanOrEqual(3);
      }
    }
  });

  it('catches a bank whose answers are all in one place', () => {
    /*
     * The proof that the check can fail, run against the presentation that
     * actually shipped: options in authored order. Every subject that keys
     * answer-first must be named, and at least one must be — otherwise the
     * assertion below is measuring nothing and would pass with the shuffle
     * deleted.
     */
    const breaches = clusteredSubjects(questions, AUTHORED_ORDER);
    expect(
      breaches.length,
      'presenting options in authored order is what shipped the defect, and the check ' +
        'did not notice. It is measuring nothing.',
    ).toBeGreaterThan(0);

    /* And on an input whose verdict can never drift with the content tree: a
       synthetic subject that is answer-first by construction. */
    const synthetic = new Map([['synthetic', Array.from({ length: 40 }, () => 0)]]);
    expect(clusteredSubjects(synthetic, AUTHORED_ORDER)).toHaveLength(1);
    expect(clusteredSubjects(synthetic, null)).toHaveLength(0);
  });

  it('spreads every subject across the four positions as the player sees them', () => {
    /*
     * The gate. Halifax (`rights`), Peggy's Cove (`who-we-are`), Winnipeg
     * (`justice`) and Québec City (`history`) each failed this at 95.8%-100%
     * before ADR-0057, and `modern-canada` — the Prairies — failed it at 100%
     * without the audit ever reaching it.
     */
    expect(
      clusteredSubjects(questions, null),
      `A learner can clear these levels by tapping the same option every time. ` +
        `No more than ${String(Math.round(MAX_SHARE * 100))}% of a subject's correct answers ` +
        `may land on one of the four positions on screen. If the shuffle in ` +
        `app/domain/entities/asked-question.ts is still wired into the draw, this is a ` +
        `real clustering; it is never fixed by re-keying content (ADR-0057).`,
    ).toEqual([]);
  });

  it('puts a quarter of all correct answers on each position', () => {
    /*
     * The generator, not the content. A shuffle can be present, wired and still
     * biased — this one has shipped a cold-start bug that made the first shuffle
     * of every seed identical — and a per-subject bound is far too loose to see
     * that. Across every subject and every pinned sitting there are thousands of
     * draws under this, so an even split is a sharp claim.
     */
    const totals = [0, 0, 0, 0];
    for (const [, keys] of questions) {
      for (const seed of SEEDS) {
        const histogram = positionsIn(keys, seed, null);
        for (const [at, count] of histogram.entries()) totals[at] = (totals[at] ?? 0) + count;
      }
    }
    const drawn = totals.reduce((sum, count) => sum + count, 0);
    expect(drawn).toBeGreaterThan(1000);
    for (const [at, count] of totals.entries()) {
      /*
       * `AGGREGATE_TOLERANCE` and not `toBeCloseTo(0.25, 2)`. That matcher
       * allows 0.005, and the shipped generator's measured spread is
       * 24.95 / 23.77 / 25.70 / 25.58 — up to 1.23 points out, so the tighter
       * matcher would fail on a shuffle that is working correctly. The width
       * here is set from the measurement rather than from a round number, and
       * it still rejects the 63.9 / 15.9 / 13.1 / 7.2 that shipped.
       */
      expect(
        Math.abs(count / drawn - 0.25),
        `option ${String(at + 1)} of 4 holds ${((count / drawn) * 100).toFixed(2)}% of every ` +
          `correct answer drawn. The four positions should each hold about a quarter; a ` +
          `lopsided split means the order generator is biased, not that the bank is.`,
      ).toBeLessThan(AGGREGATE_TOLERANCE);
    }
  });
});
