/**
 * The lesson library, run over the REAL `content/lessons/` tree.
 *
 * `bundled-question-bank.test.ts`'s method, for its reasons: every assertion is
 * against the 48 documents the repository ships, and the negative cases are made
 * by **taking content away** from that same map rather than by hand-building a
 * fixture. A glob that matched nothing, a chapter directory that moved, a
 * chapter whose documents will not download — a fixture cannot be wrong in those
 * ways, so it cannot demonstrate that the refusals catch them.
 */

import { describe, expect, it } from 'vitest';

import {
  BUNDLED_LESSON_MODULES,
  createLessonLibrary,
  lessonAddress,
  type LessonModuleMap,
} from '@adapters/content';

/** The real map, with every document under `<chapter>/` removed. */
const without = (chapter: string): LessonModuleMap =>
  Object.fromEntries(
    Object.entries(BUNDLED_LESSON_MODULES).filter(
      ([path]) => lessonAddress(path)?.chapter !== chapter,
    ),
  );

describe('the bundled lesson library, over the content that ships', () => {
  it('lists every chapter, and every lesson in each, without fetching one', async () => {
    const library = createLessonLibrary();
    const chapters = await library.chapters();
    expect(chapters.ok, chapters.ok ? '' : chapters.error.message).toBe(true);
    if (!chapters.ok) return;

    const addressed = Object.keys(BUNDLED_LESSON_MODULES)
      .map((path) => lessonAddress(path))
      .filter((address): address is NonNullable<typeof address> => address !== null);

    /* The tree has to be interesting, or everything below is vacuous (ADR-0024). */
    expect(chapters.value.length).toBeGreaterThan(5);
    expect(addressed.length).toBeGreaterThan(40);

    expect(chapters.value.flatMap((chapter) => chapter.lessons)).toHaveLength(addressed.length);
    expect(chapters.value.map((chapter) => chapter.chapter)).toEqual(
      [...chapters.value].map((chapter) => chapter.chapter).sort(),
    );
    for (const chapter of chapters.value) {
      expect(chapter.lessons.length, `${chapter.chapter} holds no lessons`).toBeGreaterThan(0);
    }
  });

  it('loads one chapter, in reading order, with its passages intact', async () => {
    const library = createLessonLibrary();
    const lessons = await library.lessons('how-canadians-govern-themselves');
    expect(lessons.ok, lessons.ok ? '' : lessons.error.message).toBe(true);
    if (!lessons.ok) return;

    expect(lessons.value.length).toBeGreaterThan(0);
    expect(lessons.value.map((lesson) => lesson.order)).toEqual(
      [...lessons.value].map((lesson) => lesson.order).sort((a, b) => a - b),
    );
    for (const lesson of lessons.value) {
      expect(lesson.chapter.length).toBeGreaterThan(0);
      expect(lesson.passages.length).toBeGreaterThan(0);
      for (const passage of lesson.passages) {
        expect(passage.text.en.length).toBeGreaterThan(0);
        expect(passage.text.fr.length).toBeGreaterThan(0);
        expect(typeof passage.fact.factual).toBe('boolean');
      }
    }
  });

  it('answers the second ask from cache, having fetched once', async () => {
    let fetches = 0;
    const counted: LessonModuleMap = Object.fromEntries(
      Object.entries(BUNDLED_LESSON_MODULES).map(([path, load]) => [
        path,
        async () => {
          fetches += 1;
          return load();
        },
      ]),
    );
    const library = createLessonLibrary({ modules: counted });
    const first = await library.lessons('the-justice-system');
    const after = fetches;
    const second = await library.lessons('the-justice-system');
    expect(first.ok && second.ok).toBe(true);
    expect(after).toBeGreaterThan(0);
    expect(fetches, 'the chapter was downloaded twice').toBe(after);
  });

  it('shares one download between two asks that arrive together', async () => {
    let fetches = 0;
    const counted: LessonModuleMap = Object.fromEntries(
      Object.entries(BUNDLED_LESSON_MODULES).map(([path, load]) => [
        path,
        async () => {
          fetches += 1;
          return load();
        },
      ]),
    );
    const library = createLessonLibrary({ modules: counted });
    const [a, b] = await Promise.all([
      library.lessons('canadas-economy'),
      library.lessons('canadas-economy'),
    ]);
    expect(a.ok && b.ok).toBe(true);
    /* One document in that chapter today; the point is that it is not two. */
    expect(fetches).toBeLessThanOrEqual(
      Object.keys(BUNDLED_LESSON_MODULES).filter(
        (path) => lessonAddress(path)?.chapter === 'canadas-economy',
      ).length,
    );
  });

  it('is not-found for a chapter this build does not ship, and does not answer []', async () => {
    /*
     * An empty chapter and a missing one are different mistakes, and only one of
     * them is worth retrying. `[]` would read downstream as "every reference
     * into it dangles", which is a defect wearing a success's shape (ADR-0024).
     */
    const library = createLessonLibrary({ modules: without('canadas-economy') });
    const lessons = await library.lessons('canadas-economy');
    expect(lessons.ok).toBe(false);
    if (lessons.ok) return;
    expect(lessons.error.kind).toBe('not-found');
    expect(lessons.error.code).toBe('content.lessons.chapter.unknown');
    expect(lessons.error.details?.['shipped']).not.toContain('canadas-economy');
  });

  it('refuses an empty catalogue rather than answering an empty list', async () => {
    const library = createLessonLibrary({ modules: {} });
    const chapters = await library.chapters();
    expect(chapters.ok).toBe(false);
    if (chapters.ok) return;
    expect(chapters.error.code).toBe('content.lessons.catalogue.empty');
  });

  it('fails a whole chapter on one document it cannot read', async () => {
    /* One bad file is not a shorter chapter: `make validate-content` passes all
       48 in CI, so a parse failure at run time means the deploy shipped
       something the build never saw. */
    const broken: LessonModuleMap = Object.fromEntries(
      Object.entries(BUNDLED_LESSON_MODULES).map(([path, load]) => [
        path,
        lessonAddress(path)?.chapter === 'the-justice-system'
          ? async () => ({ default: { id: 'not-a-lesson' } })
          : load,
      ]),
    );
    const lessons = await createLessonLibrary({ modules: broken }).lessons('the-justice-system');
    expect(lessons.ok).toBe(false);
    if (lessons.ok) return;
    expect(lessons.error.kind).toBe('invalid');
  });

  it('is io, and retryable, when a chunk will not download', async () => {
    const offline: LessonModuleMap = Object.fromEntries(
      Object.entries(BUNDLED_LESSON_MODULES).map(([path, load]) => [
        path,
        lessonAddress(path)?.chapter === 'the-justice-system'
          ? async () => {
              throw new Error('offline');
            }
          : load,
      ]),
    );
    const lessons = await createLessonLibrary({ modules: offline }).lessons('the-justice-system');
    expect(lessons.ok).toBe(false);
    if (lessons.ok) return;
    expect(lessons.error.kind).toBe('io');
    expect(lessons.error.code).toBe('content.lessons.fetchFailed');
  });
});
