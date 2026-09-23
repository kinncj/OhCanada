/**
 * "Read about this": the lesson passage a question card offers once an answer
 * is judged (ADR-0070).
 *
 * The rule is `../content/question-passages.ts`'s — the proposition rule and the
 * shippable-passage filter, both already in this layer. What this module adds is
 * the one thing that rule cannot do on its own: **reach the lazy catalogue**.
 *
 * ## Why every chapter, and why that is still lazy
 *
 * A `read` step names a lesson, so `app/bootstrap/lesson-reading.ts` fetches the
 * one chapter chunk that holds it. A question names no lesson — it names a
 * *sentence*, and a proposition's identity is corpus-wide (ADR-0028 §4): on
 * 2026-09-23 one of the 25 questions with a passage is told by a lesson filed
 * under a different chapter than the one the question cites. Restricting the
 * search to the question's own chapter would hide that passage, and the card
 * would offer nothing where there is something to read.
 *
 * So the first ask fetches the chapter index (free — it is read off module
 * paths), then every chapter chunk, in parallel, **once for the sitting**. None
 * of it is in the initial payload: nothing is fetched until a question card
 * first asks, which is after the level is already playing, and the chunks are
 * the same ones the level reader and Learn read (ADR-0063 §6: one catalogue).
 *
 * ## Failure is survivable and never memoised
 *
 * A chapter that will not download is left out of this answer and asked for
 * again next time; an index that will not load answers `null`. Either way the
 * card offers no control for what could not be read, which is the rule for a
 * question with no passage at all (ADR-0070 §2): a control that opens an empty
 * sheet, or an error, is worse than no control. Nothing here throws.
 */

import type { LessonDocument, LessonLibrary } from '@application/ports';
import type { AdjudicateClaim } from '@application/content/lesson-passages';
import { readingForQuestion, type QuestionReading } from '@application/content/question-passages';

export type { QuestionReading };

/** The shape this needs of a question: the sentence it rests on. */
export interface QuotedSource {
  readonly source: { readonly quote: string };
}

export interface QuestionReadings {
  /**
   * The reading a card opens for this question, or `null` when no passage a
   * player may read tells its proposition.
   */
  about(question: QuotedSource): Promise<QuestionReading | null>;
}

export function createQuestionReadings(
  library: LessonLibrary,
  grant: AdjudicateClaim,
): QuestionReadings {
  /** Loaded chapters, by address. Only successes are kept. */
  const loaded = new Map<string, readonly LessonDocument[]>();
  /** Every chapter the index names, in index order, once it has been read. */
  let order: readonly string[] | null = null;
  /** One load in flight at a time, so two cards asking at once fetch once. */
  let inFlight: Promise<readonly LessonDocument[] | null> | null = null;

  const assembled = (): readonly LessonDocument[] =>
    (order ?? []).flatMap((chapter) => loaded.get(chapter) ?? []);

  async function load(): Promise<readonly LessonDocument[] | null> {
    if (order === null) {
      const index = await library.chapters();
      if (!index.ok) return null;
      order = index.value.map((chapter) => chapter.chapter);
    }
    const missing = order.filter((chapter) => !loaded.has(chapter));
    const fetched = await Promise.all(
      missing.map(async (chapter) => ({ chapter, lessons: await library.lessons(chapter) })),
    );
    for (const { chapter, lessons } of fetched) {
      if (lessons.ok) loaded.set(chapter, lessons.value);
    }
    return assembled();
  }

  function catalogue(): Promise<readonly LessonDocument[] | null> {
    if (order !== null && order.every((chapter) => loaded.has(chapter))) {
      return Promise.resolve(assembled());
    }
    inFlight ??= load()
      .catch(() => null)
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  }

  return {
    async about(question): Promise<QuestionReading | null> {
      const lessons = await catalogue();
      if (lessons === null) return null;
      return readingForQuestion(lessons, question.source.quote, grant);
    },
  };
}
