/**
 * "Read about this" reaches the lazy catalogue (ADR-0070): the index first, then
 * every chapter once for the sitting, failures survivable and never memoised.
 */

import { describe, expect, it } from 'vitest';

import type { AdjudicateClaim } from '@application/content/lesson-passages';
import type {
  FactClaim,
  LessonChapter,
  LessonDocument,
  LessonLibrary,
} from '@application/ports';
import { createQuestionReadings } from '@application/use-cases/read-about-question';
import { appErr, ok, type Result } from '@common/result';

const granted: AdjudicateClaim = () => ({ granted: true, why: null, status: 'verified' });

const lesson = (id: string, quote: string): LessonDocument => ({
  $schema: '../../schemas/lesson.schema.json',
  id,
  chapter: 'Canada’s Regions',
  order: 1,
  title: { en: `${id} title`, fr: `${id} titre` },
  passages: [
    {
      id: `${id}-p`,
      text: { en: 'English prose', fr: 'Prose française' },
      fact: { factual: true, source: { quote }, verification: null } as unknown as FactClaim,
    },
  ],
});

const NB = 'New Brunswick is the only officially bilingual province.';
const OTTAWA = 'Ottawa was chosen as the capital in 1857.';

interface FakeLibrary extends LessonLibrary {
  readonly chapterCalls: () => number;
  readonly lessonCalls: (chapter: string) => number;
}

function library(
  chapters: Readonly<Record<string, readonly LessonDocument[]>>,
  failing: { index?: boolean; chapters?: Set<string>; throws?: boolean } = {},
): FakeLibrary {
  let indexCalls = 0;
  const calls = new Map<string, number>();
  return {
    chapterCalls: () => indexCalls,
    lessonCalls: (chapter) => calls.get(chapter) ?? 0,
    async chapters(): Promise<Result<readonly LessonChapter[]>> {
      indexCalls += 1;
      if (failing.throws === true) throw new Error('offline');
      if (failing.index === true) return appErr('io', 'content.lesson.index', 'no index');
      return ok(
        Object.entries(chapters).map(([chapter, lessons]) => ({
          chapter,
          lessons: lessons.map((item) => item.id),
        })),
      );
    },
    async lessons(chapter: string): Promise<Result<readonly LessonDocument[]>> {
      calls.set(chapter, (calls.get(chapter) ?? 0) + 1);
      if (failing.chapters?.has(chapter) === true) {
        return appErr('io', 'content.lesson.chunk', `${chapter} did not download`);
      }
      return ok(chapters[chapter] ?? []);
    },
  };
}

const CATALOGUE = {
  'canadas-regions': [lesson('regions-04', NB), lesson('regions-01', OTTAWA)],
  'who-we-are': [lesson('who-01', 'Canada has two official languages.')],
};

describe('createQuestionReadings', () => {
  it('finds the passage a question rests on, in whichever chapter tells it', async () => {
    /* The question cites "Who We Are"; the passage is filed under the regions. */
    const readings = createQuestionReadings(library(CATALOGUE), granted);
    const found = await readings.about({ source: { quote: NB } });
    expect(found?.lesson.id).toBe('regions-04');
    expect(found?.passages.map((p) => p.id)).toEqual(['regions-04-p']);
  });

  it('answers null for a question nothing tells', async () => {
    const readings = createQuestionReadings(library(CATALOGUE), granted);
    expect(await readings.about({ source: { quote: 'The Senate has 105 seats.' } })).toBeNull();
  });

  it('fetches the index and every chapter once for the sitting, even when asked twice at once', async () => {
    const lib = library(CATALOGUE);
    const readings = createQuestionReadings(lib, granted);
    await Promise.all([
      readings.about({ source: { quote: NB } }),
      readings.about({ source: { quote: OTTAWA } }),
    ]);
    await readings.about({ source: { quote: NB } });
    expect(lib.chapterCalls()).toBe(1);
    expect(lib.lessonCalls('canadas-regions')).toBe(1);
    expect(lib.lessonCalls('who-we-are')).toBe(1);
  });

  it('answers from what loaded when a chapter will not, and asks for that chapter again', async () => {
    const failing = new Set(['canadas-regions']);
    const lib = library(CATALOGUE, { chapters: failing });
    const readings = createQuestionReadings(lib, granted);
    expect(await readings.about({ source: { quote: NB } })).toBeNull();
    failing.clear();
    expect((await readings.about({ source: { quote: NB } }))?.lesson.id).toBe('regions-04');
    expect(lib.lessonCalls('canadas-regions')).toBe(2);
    expect(lib.lessonCalls('who-we-are')).toBe(1);
  });

  it('answers null when the index will not load, and tries the index again next time', async () => {
    const lib = library(CATALOGUE, { index: true });
    const readings = createQuestionReadings(lib, granted);
    expect(await readings.about({ source: { quote: NB } })).toBeNull();
    expect(await readings.about({ source: { quote: NB } })).toBeNull();
    expect(lib.chapterCalls()).toBe(2);
  });

  it('never throws: a library that throws is nothing to read', async () => {
    const readings = createQuestionReadings(library(CATALOGUE, { throws: true }), granted);
    await expect(readings.about({ source: { quote: NB } })).resolves.toBeNull();
  });
});
