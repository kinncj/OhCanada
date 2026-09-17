/**
 * The order a question's four options are *shown* in.
 *
 * `content/schemas/question.schema.json` has said since the schema was written
 * that "answer order is fixed by the author; shuffling is a presentation
 * decision the domain makes from a seed", and
 * `docs/guidelines/anatomy-of-a-question.md` tells every author "do not shuffle
 * the options to hide the answer; the game shuffles them at play time from a
 * seed". Both were true statements about a decision and false statements about
 * the program: nothing in `app/` ever shuffled anything, and `OQ-CARD-2` had
 * parked the question with "keep the authored order in slice 1". This module is
 * the missing half, and ADR-0059 is why it exists.
 *
 * ## What went wrong without it
 *
 * Authors believed the guideline — which is the correct thing to do with a
 * guideline — and wrote the true option first. Five of the ten subjects ended up
 * with the key on index 0 for effectively every question (`history` 96 of 97,
 * `justice` 40 of 40, `modern-canada` 40 of 40, `rights` 38 of 39, `who-we-are`
 * 46 of 48), so a learner could clear Halifax, Peggy's Cove, Winnipeg and Québec
 * City by tapping the top choice and reading nothing. Thirty-one questions in a
 * row, in both languages.
 *
 * ## Why this is presentation and not content
 *
 * Re-keying the bank would work exactly once. The next author to write a
 * question with the right answer first would put the defect back, and no gate
 * over authored content can stop that without also telling authors to obfuscate
 * their own files — which is what the guideline already forbids, for the good
 * reason that a reviewer reading a question should see the answer immediately.
 * A shuffle at presentation cannot be undone by an author, so it is the fix that
 * stays fixed. The authored `correctIndex` remains the one true key, and
 * everything that is *written down* — a review record, an exam attempt — stays
 * in authored index space (see {@link authoredAt}).
 *
 * ## Purity
 *
 * No clock, no framework, no `Math.random()`. {@link shuffledOptionOrder} takes
 * the same structural `Randomness` the scheduler takes, so a composition root
 * hands it a seeded stream and a repetitive or suspicious order replays from its
 * seed. `app/domain` imports nothing outside `domain` and `common` (ADR-0005).
 */

import type { OptionIndex } from '@domain/entities/question';
import type { Randomness } from '@domain/scheduling/question-scheduler';

/**
 * Presented position -> authored index.
 *
 * `order[2] === 0` reads "the third option on screen is the one the author wrote
 * first". The direction is worth stating because both directions are needed and
 * they are each other's inverse: {@link authoredAt} reads it forwards, to turn a
 * tap into the index that gets written down, and {@link shownAt} reads it
 * backwards, to find where an already-recorded answer is sitting on screen.
 */
export type OptionOrder = readonly [OptionIndex, OptionIndex, OptionIndex, OptionIndex];

/**
 * The options exactly as authored.
 *
 * Not a fallback and not a default. It is what a test injects when it wants to
 * name an option by the index the fixture wrote, and what a caller uses when it
 * genuinely has no business reordering anything. No production draw uses it —
 * a default that quietly reproduced the shipped defect is the one shape this
 * module must not have, which is why nothing here takes `order` optionally.
 */
export const AUTHORED_ORDER: OptionOrder = [0, 1, 2, 3];

/**
 * A fresh order, from one seeded stream.
 *
 * Fisher-Yates over the four positions, drawing `random.next()` three times —
 * a fixed, known cost per presented question, so a caller can reason about how
 * far it advances a shared stream. Every caller in the program forks a stream of
 * its own (`random.fork('options')`) for exactly that reason: shuffling a card's
 * options must never shift which questions come up.
 *
 * All 24 permutations are reachable and equally likely, which is the property
 * the aggregate assertion in
 * `tests/unit/contracts/an-answer-is-not-always-in-the-same-place.test.ts`
 * measures. That gate is not decoration: this generator has shipped a
 * cold-start bug before — every seed from 1 to 40 once produced the same first
 * shuffle — and the aggregate check is what would catch its return.
 */
export const shuffledOptionOrder = (random: Randomness): OptionOrder => {
  const order: OptionIndex[] = [0, 1, 2, 3];
  for (let index = 3; index > 0; index -= 1) {
    const swap = Math.floor(random.next() * (index + 1));
    const held = order[index] as OptionIndex;
    order[index] = order[swap] as OptionIndex;
    order[swap] = held;
  }
  return order as unknown as OptionOrder;
};

/** Is this a real position in a four-option question? */
const isPosition = (value: number): value is OptionIndex =>
  Number.isInteger(value) && value >= 0 && value <= 3;

/**
 * Which authored option sits at presented position `shown`.
 *
 * **This is the one that must be called before anything is written down.** A tap
 * on the second button is a tap on a presented position; `ExamAnswer`,
 * `ReviewRecord` and every save in the wild store authored indices, and
 * correctness is `chosenIndex === correctIndex` with no `correct` flag anywhere
 * (ADR-0027). Recording a presented index would silently re-grade every save
 * ever written, so the conversion happens at the edge and the rest of the
 * program never learns that a shuffle occurred.
 *
 * `null` for anything that is not one of the four, which no card can produce and
 * a bad caller can.
 */
export const authoredAt = (order: OptionOrder, shown: number): OptionIndex | null =>
  isPosition(shown) ? order[shown] : null;

/**
 * Where the authored option `authored` is on screen.
 *
 * The inverse of {@link authoredAt}, and needed wherever something already
 * recorded has to be pointed at: the exam re-drawing which option the player
 * pressed, and the card marking which one was right.
 */
export const shownAt = (order: OptionOrder, authored: number): OptionIndex | null => {
  if (!isPosition(authored)) return null;
  const at = order.indexOf(authored);
  return isPosition(at) ? at : null;
};

/**
 * Four of anything, rearranged into presented order.
 *
 * Generic over the item because two callers need it at different stages: the
 * drill reorders `LocalizedText` before localising, the exam reorders the
 * localised strings. Returns a new array — the content document is shared across
 * every drill that draws the same question, so an in-place sort would reorder
 * the bank itself.
 */
export const inOptionOrder = <T>(items: readonly T[], order: OptionOrder): readonly T[] =>
  order.map((authored) => items[authored] as T);
