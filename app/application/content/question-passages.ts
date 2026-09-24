/**
 * Which lesson passages tell what a question asks — the passage a card's
 * "Read about this" opens (ADR-0070).
 *
 * A proposition's identity is its `source.quote` (ADR-0028 §4), and the one rule
 * that decides whether two claims rest on the same sentence is
 * {@link sharesProposition} (`./proposition.ts`) — the rule ADR-0036 §2.4,
 * ADR-0048 and ADR-0057 §6 already use. A question and a passage that share a
 * proposition are about the same thing, so the passage is what the player should
 * read after being asked. Nothing here invents a second notion of "related":
 * no shared keyword, no same chapter, no same subject.
 *
 * ## The filter is ADR-0063 §6's, and it is not restated here
 *
 * Only a passage the shippable-passage rule lets a player read is offered, and
 * that rule is `./lesson-passages.ts`'s {@link passageVerdict} with ADR-0003's
 * grant injected by the composition root. A quarantined passage leaves the card
 * the way it leaves the level and Learn — by not being in the list.
 *
 * ## One lesson per reading
 *
 * `app/ui/lesson-reader.ts` draws one lesson's title over its passages, because
 * two lessons in one sheet would put one author's paragraphs under another's
 * heading. When a question's proposition is told in more than one lesson (none
 * is, measured on 2026-09-23 over 493 verified questions and 302 passages), the
 * reading is the lesson that tells it in the **most** passages, and the first
 * in catalogue order on a tie. That choice is stated rather than left to
 * whichever `find` ran first (ADR-0024), and
 * {@link passagesSharingProposition} still answers every lesson for a caller —
 * the contract gate — that needs to count them all.
 *
 * Pure: values in, values out. No port is called here; the lazy catalogue is
 * `../use-cases/read-about-question.ts`'s business.
 */

import type { LessonDocument, LessonPassage } from '@application/ports/content-repository';

import { passageVerdict, type AdjudicateClaim } from './lesson-passages';
import { normaliseQuote, sharesProposition } from './proposition';

/** One lesson, and the readable passages of it that tell a question's proposition. */
export interface QuestionReading {
  readonly lesson: LessonDocument;
  /** At least one, in the lesson's own order. */
  readonly passages: readonly LessonPassage[];
}

/**
 * Every lesson holding a readable passage that shares this quote's proposition,
 * in catalogue order, each with its matching passages in the lesson's order.
 *
 * An empty or punctuation-only quote matches nothing: `sharesProposition`
 * already refuses it, and the check here says so before walking the corpus.
 */
export function passagesSharingProposition(
  lessons: readonly LessonDocument[],
  quote: string,
  grant: AdjudicateClaim,
): readonly QuestionReading[] {
  if (normaliseQuote(quote) === '') return [];
  const readings: QuestionReading[] = [];
  for (const lesson of lessons) {
    const passages = lesson.passages.filter(
      (passage) =>
        sharesProposition(passage.fact.source?.quote ?? '', quote) &&
        passageVerdict(passage, grant).readable,
    );
    if (passages.length > 0) readings.push({ lesson, passages });
  }
  return readings;
}

/**
 * The one reading a card opens for a question, or `null` when no readable
 * passage tells its proposition — in which case the card offers no control at
 * all (ADR-0070 §2).
 */
export function readingForQuestion(
  lessons: readonly LessonDocument[],
  quote: string,
  grant: AdjudicateClaim,
): QuestionReading | null {
  let best: QuestionReading | null = null;
  for (const reading of passagesSharingProposition(lessons, quote, grant)) {
    if (best === null || reading.passages.length > best.passages.length) best = reading;
  }
  return best;
}
