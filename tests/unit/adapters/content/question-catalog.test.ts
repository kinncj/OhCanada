/**
 * Addressing and indexing, over a map the test controls.
 *
 * The real-content cases live in `bundled-question-bank.test.ts`; this file is
 * the vocabulary underneath them — what counts as an address, what order a
 * subject comes back in, and what happens to a path that is not a question.
 */

import { describe, expect, it } from 'vitest';

import {
  fetchSubjectModules,
  indexQuestionModules,
  questionAddress,
  type QuestionModuleMap,
} from '@adapters/content';

const stub = (paths: readonly string[]): QuestionModuleMap =>
  Object.fromEntries(paths.map((path) => [path, async () => ({ default: { path } })]));

describe('questionAddress', () => {
  it('reads the subject and the id out of a module path', () => {
    expect(questionAddress('../../../content/questions/history/hist-01-why.json')).toEqual({
      subject: 'history',
      id: 'hist-01-why',
    });
  });

  it.each([
    ['a README', '../../../content/questions/history/README.md'],
    ['a file at the root of the bank', 'questions.json'],
    ['an empty file name', '../../../content/questions/history/.json'],
  ])('ignores %s rather than calling it a broken question', (_name, path) => {
    expect(questionAddress(path)).toBeNull();
  });
});

describe('indexQuestionModules', () => {
  it('groups by directory, sorts the subjects and sorts the ids inside them', () => {
    const index = indexQuestionModules(
      stub([
        'c/questions/rights/r-02.json',
        'c/questions/history/h-09.json',
        'c/questions/rights/r-01.json',
        'c/questions/history/h-01.json',
      ]),
    );
    expect(index.map((entry) => String(entry.subject))).toEqual(['history', 'rights']);
    expect(index[0]?.entries.map((entry) => entry.id)).toEqual(['h-01', 'h-09']);
    expect(index[1]?.entries.map((entry) => entry.id)).toEqual(['r-01', 'r-02']);
  });

  it('drops non-question paths without dropping the subject they sit beside', () => {
    const index = indexQuestionModules(
      stub(['c/questions/history/h-01.json', 'c/questions/history/README.md']),
    );
    expect(index).toHaveLength(1);
    expect(index[0]?.entries).toHaveLength(1);
  });

  it('returns an empty index for an empty map rather than refusing here', () => {
    /* The refusal belongs to the application layer, so it is stated once for
       every implementation of the port instead of once per adapter. */
    expect(indexQuestionModules({})).toEqual([]);
  });
});

describe('fetchSubjectModules', () => {
  it('returns the documents in index order', async () => {
    const index = indexQuestionModules(
      stub(['c/questions/history/h-02.json', 'c/questions/history/h-01.json']),
    );
    const fetched = await fetchSubjectModules(index[0]!);
    expect(fetched.ok).toBe(true);
    if (fetched.ok) {
      expect(fetched.value).toEqual([
        { default: { path: 'c/questions/history/h-01.json' } },
        { default: { path: 'c/questions/history/h-02.json' } },
      ]);
    }
  });

  it('names the path that would not download, and calls it io', async () => {
    const index = indexQuestionModules({
      'c/questions/history/h-01.json': async () => ({}),
      'c/questions/history/h-02.json': async () => {
        throw new Error('offline');
      },
    });
    const fetched = await fetchSubjectModules(index[0]!);
    expect(fetched.ok).toBe(false);
    if (fetched.ok) return;
    expect(fetched.error.kind).toBe('io');
    expect(fetched.error.details).toMatchObject({ path: 'c/questions/history/h-02.json' });
  });

  it('reports a subject with no entries as an empty fetch, not a failure', async () => {
    const fetched = await fetchSubjectModules({ subject: 'ghost' as never, entries: [] });
    expect(fetched.ok).toBe(true);
    if (fetched.ok) expect(fetched.value).toEqual([]);
  });
});
