/**
 * The route from a `read` step's references to the words on the phone —
 * ADR-0063 §6's last leg, and the reason the reader was unreachable until now.
 *
 * `app/ui/lesson-reader.ts` takes prose: a title and a list of `{ id, text }`,
 * **already resolved, already filtered, already in one language**. Four things
 * happen before the screen and none of them may happen in it
 * (`docs/stories/TN-READ-reading-a-passage-at-a-stop.md`):
 *
 *  1. `app/bootstrap/quests.ts` reads the step and hands back `passages[]` —
 *     pairs, never words.
 *  2. The pair is resolved across documents to exactly one passage or a named
 *     failure (`app/application/content/lesson-passages.ts`).
 *  3. The shippable-passage filter runs, in `app/application` and never in a
 *     screen, with ADR-0003's rule injected from `./verified-passages.ts`.
 *  4. A language is chosen, once, here.
 *
 * This file is steps 2 to 4's caller and step 4 itself. It is in the composition
 * root because it is the only layer that may hold both an adapter and a screen's
 * view type (ADR-0005), and it is the same shape as `./about-this-place.ts`: a
 * mapping with a test against it, rather than an expression inlined into
 * `openLevel` where nobody would see the two facts it depends on.
 *
 * ## Lazy, by chapter, and that is the whole reason this is not one glob
 *
 * A reference names a *lesson*; a chunk is a *chapter*. {@link resolveReading}
 * asks the library for the index — which costs nothing, because an adapter reads
 * it off module paths without fetching a byte — works out which single chapter
 * holds the lesson, and fetches that one. Loading the corpus to find out would
 * be the eager glob of 48 documents ADR-0063 §6 refuses and the ≤ 8 MB initial
 * payload cannot pay for.
 *
 * A step naming passages from more than one lesson is refused by the application
 * layer rather than fetched from two chapters, and the reason is the reader's
 * rather than the budget's: a sheet is named by one lesson's title.
 *
 * ## What the caller gets when a passage may not be read
 *
 * A {@link Reading} with fewer passages, and a sentence per refusal for the
 * console. The step still advances and the level is still finishable — exactly
 * as a refused blurb costs a landmark its card and not its art. What is lost is
 * the teaching, and it is lost loudly enough for a developer to see and quietly
 * enough that a player is not shown a verdict about a JSON path. A step whose
 * passages are *all* refused opens no reader at all
 * ({@link lessonReaderView} answers `null`), because a sheet with a heading and
 * no words is a screen the player dismisses having been told nothing (ADR-0024).
 */

import type { LessonLibrary, LessonPassageReference } from '@application/ports';
import {
  chapterOfLesson,
  lessonsNamedBy,
  readingFor,
  type Reading,
} from '@application/content/lesson-passages';
import { appErr, type Result } from '@common/result';
import type { LocalizedText } from '@domain/entities/values';
import type { UiLocale } from '@ui/copy';
import type { LessonReaderView } from '@ui/lesson-reader';

export type { Reading };

/**
 * One `read` step's references, resolved against the one lesson catalogue.
 *
 * Asks `chapters()` first and `lessons(chapter)` second, which is the whole of
 * the laziness: the first answers from an index built out of module paths, the
 * second fetches one chunk. Both failures are carried through as they arrive —
 * `io` for a chunk that will not download and `not-found` for a chapter this
 * build does not ship — because a caller that collapsed them would offer "Try
 * again" for something that can never succeed.
 */
export async function resolveReading(
  library: LessonLibrary,
  references: readonly LessonPassageReference[],
  grant: Parameters<typeof readingFor>[2],
): Promise<Result<Reading>> {
  const named = lessonsNamedBy(references);
  const only = named[0];
  if (named.length !== 1 || only === undefined) {
    /* The application layer states this rule and the message; asking it with an
       empty or many-lesson list is how this file gets that message rather than
       writing a second one. */
    return readingFor([], references, grant);
  }

  const catalogue = await library.chapters();
  if (!catalogue.ok) return catalogue;

  const chapter = chapterOfLesson(catalogue.value, only);
  if (!chapter.ok) {
    return appErr(
      chapter.why === 'dangling' ? 'not-found' : 'invalid',
      `content.lesson.chapter.${chapter.why}`,
      chapter.why === 'dangling'
        ? `no chapter of content/lessons/ holds a lesson document "${only}" (searched ` +
            `${String(catalogue.value.length)} chapter(s)). A reference names a document's own ` +
            '"id", which is also its file name; renaming it is a new identity (ADR-0063 §4).'
        : `${String(chapter.count)} chapters hold a lesson document "${only}", so there is no ` +
            'one chunk to fetch. It is refused rather than resolved to the first, because ' +
            'picking one would put a paragraph nobody chose in front of a player (ADR-0024).',
      { lesson: only, count: chapter.count },
    );
  }

  const lessons = await library.lessons(chapter.chapter);
  if (!lessons.ok) return lessons;

  return readingFor(lessons.value, references, grant);
}

/**
 * The reading as the screen's view, in one language.
 *
 * `localise` is the caller's — `openLevel` already holds the one function that
 * turns a `LocalizedText` into a string for the language in force, and a second
 * copy of that decision here is how a level ends up half-translated. It is the
 * same argument `./about-this-place.ts` makes for the same parameter.
 *
 * `null` for a reading with no readable passages, which is what makes "a reader
 * with nothing in it does not open" true at this end as well as at the screen's.
 */
export function lessonReaderView(
  reading: Reading,
  locale: UiLocale,
  localise: (value: LocalizedText, locale: UiLocale) => string,
): LessonReaderView | null {
  if (reading.passages.length === 0) return null;
  return {
    title: localise(reading.lesson.title, locale),
    passages: reading.passages.map((passage) => ({
      id: passage.id,
      text: localise(passage.text, locale),
    })),
  };
}
