import { describe, expect, it } from 'vitest';

import {
  chapterAddress,
  inGuideOrder,
  readableChapter,
  type GuideChapter,
} from '@application/content/learn';
import type { AdjudicateClaim } from '@application/content/lesson-passages';
import type { FactClaim, LessonChapter, LessonDocument } from '@application/ports';

/**
 * What Learn may show (`docs/stories/TN-LEARN-reading-the-guide-by-chapter.md`,
 * ADR-0061 §8): the guide's order, and each lesson holding only what a player
 * may read. The grant is a fixture here on purpose — the real rule is
 * `app/bootstrap/verified-passages.ts`'s and is driven over the real corpus by
 * `tests/unit/contracts/every-passage-is-reachable-from-learn.test.ts`.
 */

const REGISTER: readonly GuideChapter[] = [
  { title: 'The Oath of Citizenship', page: 2 },
  { title: 'Rights and Responsibilities of Citizenship', page: 11 },
  { title: 'Who We Are', page: 16 },
  { title: "Canada's History", page: 23 },
  { title: "Canada's Regions", page: 93 },
];

const chapter = (name: string): LessonChapter => ({ chapter: name, lessons: [`${name}-01`] });

const fact = (status: string): FactClaim =>
  ({ factual: true, verification: { status } }) as unknown as FactClaim;

const lesson = (id: string, statuses: readonly string[]): LessonDocument =>
  ({
    id,
    chapter: "Canada's History",
    order: 1,
    title: { en: `Lesson ${id}`, fr: `Leçon ${id}` },
    passages: statuses.map((status, index) => ({
      id: `${id}-p${String(index)}`,
      text: { en: `Passage ${String(index)}`, fr: `Passage ${String(index)}` },
      fact: fact(status),
    })),
  }) as unknown as LessonDocument;

/** Granted exactly when the fixture status is `verified`. */
const grant: AdjudicateClaim = (claim) => {
  const status = (claim as unknown as { verification: { status: string } }).verification.status;
  return status === 'verified'
    ? { granted: true, why: null, status }
    : { granted: false, why: 'not-verified', status };
};

describe('a chapter address', () => {
  it('is the register title as the lessons directory names it', () => {
    expect(chapterAddress("Canada's History")).toBe('canadas-history');
    expect(chapterAddress('Canada’s Economy')).toBe('canadas-economy');
    expect(chapterAddress('Rights and Responsibilities of Citizenship')).toBe(
      'rights-and-responsibilities-of-citizenship',
    );
    expect(chapterAddress('How Canadians Govern Themselves')).toBe(
      'how-canadians-govern-themselves',
    );
    expect(chapterAddress('  The Justice System ')).toBe('the-justice-system');
  });
});

describe('the guide order', () => {
  it('orders chapters by the register, not by name', () => {
    const index = ['canadas-history', 'canadas-regions', 'rights-and-responsibilities-of-citizenship', 'who-we-are'].map(chapter);
    expect(inGuideOrder(index, REGISTER).map((entry) => entry.chapter)).toEqual([
      'rights-and-responsibilities-of-citizenship',
      'who-we-are',
      'canadas-history',
      'canadas-regions',
    ]);
  });

  it('keeps a chapter the register does not name, after the named ones, rather than dropping it', () => {
    const index = ['zeta', 'canadas-regions', 'alpha', 'who-we-are'].map(chapter);
    expect(inGuideOrder(index, REGISTER).map((entry) => entry.chapter)).toEqual([
      'who-we-are',
      'canadas-regions',
      'zeta',
      'alpha',
    ]);
  });

  it('answers the index unchanged when there is no register to order by', () => {
    const index = ['b', 'a'].map(chapter);
    expect(inGuideOrder(index, []).map((entry) => entry.chapter)).toEqual(['b', 'a']);
  });

  it('lists nothing the index did not hold: the Oath has no lessons and is not invented', () => {
    const ordered = inGuideOrder(['who-we-are'].map(chapter), REGISTER);
    expect(ordered.map((entry) => entry.chapter)).toEqual(['who-we-are']);
  });
});

describe('a readable chapter', () => {
  it('keeps every readable passage, in authored order, and lessons in the order given', () => {
    const readable = readableChapter(
      [lesson('a', ['verified', 'verified']), lesson('b', ['verified'])],
      grant,
    );
    expect(readable.lessons.map((entry) => entry.lesson.id)).toEqual(['a', 'b']);
    expect(readable.lessons[0]?.passages.map((passage) => passage.id)).toEqual(['a-p0', 'a-p1']);
    expect(readable.refused).toEqual([]);
  });

  it('drops a quarantined passage silently to the player and names it for the console', () => {
    const readable = readableChapter([lesson('a', ['verified', 'quarantined', 'verified'])], grant);
    expect(readable.lessons[0]?.passages.map((passage) => passage.id)).toEqual(['a-p0', 'a-p2']);
    expect(readable.refused).toHaveLength(1);
    expect(readable.refused[0]).toContain('"a/a-p1"');
  });

  it('does not offer a lesson with nothing left to read', () => {
    const readable = readableChapter(
      [lesson('a', ['rejected', 'quarantined']), lesson('b', ['verified'])],
      grant,
    );
    expect(readable.lessons.map((entry) => entry.lesson.id)).toEqual(['b']);
    expect(readable.refused.some((line) => line.includes('"a" has no passage'))).toBe(true);
  });

  it('answers an empty chapter as empty, for the caller to show as its own state', () => {
    const readable = readableChapter([lesson('a', ['rejected'])], grant);
    expect(readable.lessons).toEqual([]);
  });

  it('refuses a passage that asserts nothing before asking the grant', () => {
    const asserting = lesson('a', ['verified', 'verified']);
    const silent = {
      ...asserting,
      passages: [
        asserting.passages[0],
        { ...asserting.passages[1], fact: { factual: false } as unknown as FactClaim },
      ],
    } as unknown as LessonDocument;
    const readable = readableChapter([silent], grant);
    expect(readable.lessons[0]?.passages.map((passage) => passage.id)).toEqual(['a-p0']);
  });
});
