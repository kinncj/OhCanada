/**
 * `LessonLibrary`, over the bundled `content/lessons/` tree — the catalogue
 * ADR-0063 §6 assigned to "the implementer in the change that first calls them".
 *
 * Until this file there were 48 lesson documents holding 302 verified passages
 * and **no code path that turned any of them into something a player could
 * read**. `app/ui/lesson-reader.ts` existed; nothing could fill it.
 *
 * ## One catalogue, two readers
 *
 * §6 turns on this being *the* catalogue: a `read` step on the quest path reads
 * a handful of passages from it, and ADR-0061's Learn surface will read a whole
 * chapter from it, and because there is one of it a passage ADR-0016's clock
 * quarantines leaves the level and leaves Learn in one edit. That is also why
 * `lessons()` answers `LessonDocument`s rather than anything narrower: the
 * shippable-passage filter is `app/application/content/lesson-passages.ts`'s,
 * and an adapter that filtered here would be the second place deciding what is
 * readable.
 *
 * ## What this refuses, and why none of it is a filter
 *
 *  1. **An empty catalogue is an error, not an empty list.** A glob that matched
 *     nothing leaves every per-chapter check unreachable and every aggregate
 *     vacuously true, and downstream it reads as "every reference in the game
 *     names nothing" (ADR-0024). `chapters()` refuses zero.
 *  2. **A chapter this build does not ship is `not-found`, never `[]`.** An
 *     empty chapter and a missing one are different mistakes and only one of
 *     them is worth retrying.
 *  3. **A malformed document fails its whole chapter.** One bad file is not a
 *     shorter lesson; `make validate-content` passes all 48 in CI, so a parse
 *     failure at run time means the deploy shipped something the build never
 *     saw. Skipping it silently would shrink a chapter by an amount nobody can
 *     observe.
 *
 * ## Locale
 *
 * No `LocaleCode` anywhere. A chapter carries EN and FR inline (ADR-0010), so
 * changing language re-renders the reader rather than evicting a cache and
 * re-downloading a chunk while the player is mid-paragraph.
 *
 * ## Caching
 *
 * A chapter's parsed documents are memoised, and so is the in-flight promise, so
 * two surfaces opening at once share one download. Only successes are memoised:
 * `io` is the flaky-connection case and "Try again" has to be able to succeed.
 * There is no `unload` — the whole corpus is a few hundred KB of JSON, three
 * orders of magnitude below the 64 MB texture budget that makes level unloading
 * necessary, and a chapter already read is the one a player is most likely to
 * come back to.
 */

import { all, appErr, ok } from '@common/result';
import type { Result } from '@common/result';
import type { LessonChapter, LessonDocument, LessonLibrary } from '@application/ports';

import {
  BUNDLED_LESSON_MODULES,
  fetchChapterModules,
  indexLessonModules,
  type ChapterEntry,
  type LessonModuleMap,
} from './lesson-catalog';
import { parseLessonDocument } from './lesson-document';

export interface LessonLibraryOptions {
  /**
   * The module map to read. Defaults to the bundled glob.
   *
   * Injectable so a test can run this exact code over the *real* corpus minus a
   * chapter — proving the empty and missing paths by taking content away rather
   * than by asserting against a hand-built fixture, which is the one thing an
   * empty-catalogue test must not do.
   */
  readonly modules?: LessonModuleMap;
}

/** Parse one chapter's fetched modules, refusing the chapter on the first bad one. */
const parseChapter = (
  entry: ChapterEntry,
  loaded: readonly unknown[],
): Result<readonly LessonDocument[]> =>
  all(
    loaded.map((raw, index) =>
      parseLessonDocument(raw, {
        chapter: entry.chapter,
        id: entry.entries[index]?.id ?? '',
      }),
    ),
  );

/**
 * Reading order inside a chapter: `order`, then `id` to break a tie.
 *
 * `(chapter, order)` is unique across the corpus and a cross-document check owes
 * it (ADR-0061 §9.5), which is exactly why the tiebreak is here: a schema sees
 * one file, so two lessons sharing an `order` is a state this layer can meet,
 * and falling back to the address keeps the answer the same on every machine
 * instead of leaving it to the sort's stability over glob order.
 */
const inReadingOrder = (
  lessons: readonly LessonDocument[],
): readonly LessonDocument[] =>
  [...lessons].sort((a, b) => (a.order === b.order ? (a.id < b.id ? -1 : 1) : a.order - b.order));

export const createLessonLibrary = (options: LessonLibraryOptions = {}): LessonLibrary => {
  const index = indexLessonModules(options.modules ?? BUNDLED_LESSON_MODULES);
  const byChapter = new Map(index.map((entry) => [entry.chapter, entry]));
  const parsed = new Map<string, readonly LessonDocument[]>();
  const inFlight = new Map<string, Promise<Result<readonly LessonDocument[]>>>();

  const loadChapter = async (entry: ChapterEntry): Promise<Result<readonly LessonDocument[]>> => {
    const fetched = await fetchChapterModules(entry);
    if (!fetched.ok) return fetched;
    const documents = parseChapter(entry, fetched.value);
    if (!documents.ok) return documents;
    if (documents.value.length === 0) {
      return appErr(
        'invalid',
        'content.lessons.chapter.empty',
        `chapter "${entry.chapter}" holds no lesson documents, so every reference into it ` +
          'dangles. An empty collection must not reduce to a pass (ADR-0024).',
        { chapter: entry.chapter },
      );
    }
    return ok(inReadingOrder(documents.value));
  };

  return {
    async chapters(): Promise<Result<readonly LessonChapter[]>> {
      if (index.length === 0) {
        return appErr(
          'invalid',
          'content.lessons.catalogue.empty',
          'this build ships no lesson chapters, so every read step names nothing. A glob that ' +
            'matched nothing and a corpus that was never authored look the same to every check ' +
            'downstream, so it is refused here rather than answered as an empty list (ADR-0024).',
        );
      }
      return ok(
        index.map((entry) => ({
          chapter: entry.chapter,
          lessons: entry.entries.map((lesson) => lesson.id),
        })),
      );
    },

    async lessons(chapter: string): Promise<Result<readonly LessonDocument[]>> {
      const cached = parsed.get(chapter);
      if (cached !== undefined) return ok(cached);

      const entry = byChapter.get(chapter);
      if (entry === undefined) {
        /* Kept apart from `chapter.empty`: a directory nobody authored will
           never appear on a retry, where an empty one is a build defect. */
        return appErr(
          'not-found',
          'content.lessons.chapter.unknown',
          `this build ships no lesson chapter "${chapter}".`,
          { chapter, shipped: index.map((candidate) => candidate.chapter) },
        );
      }

      const running = inFlight.get(chapter);
      if (running !== undefined) return running;

      const pending = loadChapter(entry).then((result) => {
        inFlight.delete(chapter);
        if (result.ok) parsed.set(chapter, result.value);
        return result;
      });
      inFlight.set(chapter, pending);
      return pending;
    },
  };
};

/** The library this build ships, over the bundled glob. */
export const bundledLessonLibrary = (): LessonLibrary => createLessonLibrary();
