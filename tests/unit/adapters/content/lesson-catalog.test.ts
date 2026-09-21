/**
 * Addressing and indexing lesson documents, over a map the test controls.
 *
 * The real-corpus cases live in `bundled-lesson-library.test.ts`; this file is
 * the vocabulary underneath them — what counts as an address, what order a
 * chapter comes back in, and what happens to a path that is not a lesson.
 *
 * `question-catalog.test.ts` for prose, deliberately: the two catalogues are the
 * same mechanism and a second shape for one idea is one more than this project
 * has decided on.
 */

import { describe, expect, it } from 'vitest';

import {
  fetchChapterModules,
  indexLessonModules,
  lessonAddress,
  type LessonModuleMap,
} from '@adapters/content';

const stub = (paths: readonly string[]): LessonModuleMap =>
  Object.fromEntries(paths.map((path) => [path, async () => ({ default: { path } })]));

describe('lessonAddress', () => {
  it('reads the chapter and the id out of a module path', () => {
    expect(
      lessonAddress('../../../content/lessons/canadas-history/history-01-first-peoples.json'),
    ).toEqual({ chapter: 'canadas-history', id: 'history-01-first-peoples' });
  });

  it.each([
    ['a README', '../../../content/lessons/canadas-history/README.md'],
    ['a file at the root of the corpus', 'lessons.json'],
    ['an empty file name', '../../../content/lessons/canadas-history/.json'],
  ])('ignores %s rather than calling it a broken lesson', (_name, path) => {
    expect(lessonAddress(path)).toBeNull();
  });
});

describe('indexLessonModules', () => {
  it('groups by directory, sorts the chapters and sorts the ids inside them', () => {
    const index = indexLessonModules(
      stub([
        'c/lessons/who-we-are/w-02.json',
        'c/lessons/canadas-history/h-09.json',
        'c/lessons/who-we-are/w-01.json',
        'c/lessons/canadas-history/h-01.json',
      ]),
    );
    expect(index.map((entry) => entry.chapter)).toEqual(['canadas-history', 'who-we-are']);
    expect(index[0]?.entries.map((entry) => entry.id)).toEqual(['h-01', 'h-09']);
    expect(index[1]?.entries.map((entry) => entry.id)).toEqual(['w-01', 'w-02']);
  });

  it('keeps two chapters that hold a lesson of the same id, rather than merging them', () => {
    /*
     * The whole reason the index is a list. A map keyed by lesson id would keep
     * one of these — last writer wins — and the ambiguity the resolver exists to
     * catch would be gone before anything looked for it (ADR-0063 §4, ADR-0024).
     */
    const index = indexLessonModules(
      stub(['c/lessons/one/shared-id.json', 'c/lessons/two/shared-id.json']),
    );
    expect(index.map((entry) => entry.chapter)).toEqual(['one', 'two']);
    expect(index.flatMap((entry) => entry.entries.map((lesson) => lesson.id))).toEqual([
      'shared-id',
      'shared-id',
    ]);
  });

  it('drops non-lesson paths without dropping the chapter they sit beside', () => {
    const index = indexLessonModules(
      stub(['c/lessons/canadas-history/h-01.json', 'c/lessons/canadas-history/README.md']),
    );
    expect(index).toHaveLength(1);
    expect(index[0]?.entries).toHaveLength(1);
  });

  it('returns an empty index for an empty map rather than refusing here', () => {
    /* The refusal belongs to the library, where it is stated once. */
    expect(indexLessonModules({})).toEqual([]);
  });
});

describe('fetchChapterModules', () => {
  it('returns the documents in index order', async () => {
    const index = indexLessonModules(
      stub(['c/lessons/canadas-history/h-02.json', 'c/lessons/canadas-history/h-01.json']),
    );
    const entry = index[0];
    expect(entry).toBeDefined();
    if (entry === undefined) return;

    const fetched = await fetchChapterModules(entry);
    expect(fetched.ok).toBe(true);
    if (!fetched.ok) return;
    expect(fetched.value).toEqual([
      { default: { path: 'c/lessons/canadas-history/h-01.json' } },
      { default: { path: 'c/lessons/canadas-history/h-02.json' } },
    ]);
  });

  it('is io and names the path when a chunk will not download', async () => {
    /*
     * `io` rather than `invalid`, because it is the one failure a player can act
     * on by trying again — the distinction `fetchSubjectModules` draws for the
     * same reason.
     */
    const modules: LessonModuleMap = {
      'c/lessons/canadas-history/h-01.json': async () => {
        throw new Error('offline');
      },
    };
    const entry = indexLessonModules(modules)[0];
    expect(entry).toBeDefined();
    if (entry === undefined) return;

    const fetched = await fetchChapterModules(entry);
    expect(fetched.ok).toBe(false);
    if (fetched.ok) return;
    expect(fetched.error.kind).toBe('io');
    expect(fetched.error.code).toBe('content.lessons.fetchFailed');
    expect(fetched.error.details?.['path']).toBe('c/lessons/canadas-history/h-01.json');
  });
});
