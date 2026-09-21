/**
 * Which lesson chapters exist, and how one chapter is fetched.
 *
 * `app/adapters/content/question-catalog.ts` for prose, deliberately: one
 * `import.meta.glob` resolved by the bundler over
 * `content/lessons/<chapter>/*.json`, so dropping a document into
 * `content/lessons/canadas-history/` adds a lesson with no edit here, and
 * creating `content/lessons/the-oath/` adds a whole chapter with no edit
 * anywhere. Two ways to address authored content would be one more than this
 * project has decided on.
 *
 * ## Lazy, and this is the budget line ADR-0063 §6 draws
 *
 * The glob is **lazy**. §6: the catalogue is "one `import.meta.glob` per
 * chapter, lazily imported, so the ≤ 8 MB initial payload does not move and a
 * chapter is a chunk fetched on first open". The corpus is 48 documents holding
 * 302 passages in two languages, with a source block and a verifier's grant on
 * every one of them; an eager glob would put all of it on the title screen, for
 * a game that on most runs reads three paragraphs of it. `vite.config.ts` groups
 * a chapter's documents into one chunk, so opening a reader costs one request
 * rather than one per lesson.
 *
 * §6 says "per chapter" and this is one pattern, which is the same arrangement
 * the question bank has for the same reason: a per-chapter *pattern* would have
 * to name the chapters, and the whole point is that a chapter is a directory.
 * What "per chapter" means mechanically is the chunking and the index below —
 * one fetch per chapter, and nothing fetched to *build* the index.
 *
 * ## The address is the id
 *
 * `content/lessons/<chapter>/<id>.json` states the document's own `id` twice:
 * once in the path and once inside. Both are checked (`parseLessonDocument`),
 * because a document reachable under one name and self-described under another
 * is reachable by the `read` step that names it and invisible to the index that
 * addresses it.
 *
 * ## Why the index is a list and not a map
 *
 * Nothing here de-duplicates, and nothing keys by lesson id. A map would keep
 * one of two documents sharing an `id` — last writer wins — and the ambiguity
 * `app/application/content/lesson-passages.ts` exists to refuse would be gone
 * before anything looked for it (ADR-0063 §4, ADR-0024).
 * `scripts/lib/lesson-passages.mjs` reads the corpus the same way and says so at
 * greater length.
 *
 * Pure apart from the glob: everything below takes the module map as a
 * parameter, so the empty-catalogue and missing-chapter paths are provable by
 * *removing content* rather than by asserting against a fixture.
 */

import { appErr, ok } from '@common/result';
import type { Result } from '@common/result';

/**
 * What the bundler hands back for a lazy glob: module path -> dynamic import.
 *
 * Declared as a type rather than used inline so a test can build one over a
 * subset of the real map — the real modules, with a chapter taken away — and
 * exercise the same code the deploy runs.
 */
export type LessonModuleMap = Readonly<Record<string, () => Promise<unknown>>>;

/** Every `content/lessons/<chapter>/<id>.json`, lazily. */
export const BUNDLED_LESSON_MODULES: LessonModuleMap = import.meta.glob(
  '../../../content/lessons/*/*.json',
);

/** `…/content/lessons/canadas-history/history-01-x.json` -> `{ chapter, id }`. */
export interface LessonAddress {
  /** The directory, which is the chapter's address and not its printed title. */
  readonly chapter: string;
  readonly id: string;
}

/**
 * Read the chapter and the id out of a module path.
 *
 * `null` rather than a `Result` for a path this catalogue does not recognise: a
 * glob pattern is not a promise about what matched it, and a `README.md` under
 * `content/lessons/` is not a broken lesson — it is not a lesson at all. What
 * *is* a failure is the whole map yielding no address, and that is the
 * library's to refuse.
 */
export const lessonAddress = (path: string): LessonAddress | null => {
  if (!path.endsWith('.json')) return null;
  const parts = path.split('/');
  const file = parts[parts.length - 1];
  const chapter = parts[parts.length - 2];
  if (file === undefined || chapter === undefined) return null;
  const id = file.slice(0, -'.json'.length);
  if (id.length === 0 || chapter.length === 0) return null;
  return { chapter, id };
};

/** One document, addressed and not yet fetched. */
export interface LessonEntry extends LessonAddress {
  readonly path: string;
  readonly load: () => Promise<unknown>;
}

/** One chapter's documents, in a stable order. */
export interface ChapterEntry {
  readonly chapter: string;
  readonly entries: readonly LessonEntry[];
}

/**
 * Index a module map by chapter, sorted, ids sorted inside each chapter.
 *
 * Sorted rather than in glob order so that what a reader is handed does not
 * depend on the file system it was built on: `import.meta.glob`'s key order is
 * the bundler's, and a chapter list that reordered itself between machines would
 * make a screenshot digest and a live page disagree for no reason anyone could
 * find.
 *
 * Answers the index even when it is empty. Refusing an empty one belongs to the
 * caller, where the rule can be stated once rather than once per adapter.
 */
export const indexLessonModules = (modules: LessonModuleMap): readonly ChapterEntry[] => {
  const byChapter = new Map<string, LessonEntry[]>();
  for (const path of Object.keys(modules)) {
    const address = lessonAddress(path);
    const load = modules[path];
    if (address === null || load === undefined) continue;
    const bucket = byChapter.get(address.chapter) ?? [];
    bucket.push({ ...address, path, load });
    byChapter.set(address.chapter, bucket);
  }
  return [...byChapter.keys()].sort().map((chapter) => ({
    chapter,
    entries: (byChapter.get(chapter) ?? []).slice().sort((a, b) => (a.id < b.id ? -1 : 1)),
  }));
};

/**
 * Fetch every document of one chapter, in index order.
 *
 * A chunk that will not download is `io` and retryable; a chapter this build
 * does not ship is `not-found` and never will be. They are kept apart for
 * `fetchSubjectModules`'s reason: a surface that showed one card for both would
 * tell a player to retry something that can never succeed.
 */
export const fetchChapterModules = async (
  entry: ChapterEntry,
): Promise<Result<readonly unknown[]>> => {
  const settled = await Promise.allSettled(entry.entries.map((lesson) => lesson.load()));
  const loaded: unknown[] = [];
  for (let index = 0; index < settled.length; index += 1) {
    const outcome = settled[index];
    if (outcome === undefined || outcome.status === 'rejected') {
      return appErr(
        'io',
        'content.lessons.fetchFailed',
        `a lesson document in chapter "${entry.chapter}" could not be loaded.`,
        { chapter: entry.chapter, path: entry.entries[index]?.path ?? null },
        outcome?.status === 'rejected' ? outcome.reason : undefined,
      );
    }
    loaded.push(outcome.value);
  }
  return ok(loaded);
};
