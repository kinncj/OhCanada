/**
 * What the Learn surface may show: the guide's chapters in the guide's order,
 * and each chapter's lessons holding only the passages a player may read
 * (ADR-0061 §8, ADR-0065 §3.1).
 *
 * `docs/stories/TN-LEARN-reading-the-guide-by-chapter.md` is the acceptance
 * criteria. Two decisions live here and not in a screen:
 *
 *  1. **The shippable-passage filter**, which ADR-0063 §6 puts in
 *     `app/application` "so the level reader and the Learn reader cannot
 *     disagree about what is readable". It is not restated: every passage goes
 *     through {@link passageVerdict}, the one the level's `read` step uses, with
 *     ADR-0003's rule injected by the composition root.
 *  2. **The reading order of the chapters**, which is the guide's own — the
 *     register's page ranges — and not the file system's. A chapter is a
 *     directory of `content/lessons/`, and its address is its register title
 *     made into a path segment ({@link chapterAddress}); the join is by that
 *     address because a `LessonChapter` from the index carries no title until a
 *     chunk is fetched, and fetching every chunk to sort a menu is the eager
 *     load ADR-0061 §7 refuses.
 *
 * ## What is dropped, and how loudly
 *
 * A passage that may not be read leaves its lesson — silently to a player,
 * with a sentence for the console — exactly as it leaves a level (ADR-0063 §2).
 * **A lesson left with no readable passage leaves the list**: a reader with a
 * title and no words is a screen a player dismisses having been told nothing
 * (ADR-0024). A chapter left with no readable lesson is an empty
 * {@link LearnChapter.lessons}, which the caller must show as its own state and
 * never as an empty list.
 *
 * Pure: nothing is fetched, no clock is read, no port is called.
 */

import type {
  LessonChapter,
  LessonDocument,
  LessonPassage,
} from '@application/ports/content-repository';

import { passageVerdict, whyUnreadable, type AdjudicateClaim } from './lesson-passages';

/** One chapter of the source register, as much of it as ordering needs. */
export interface GuideChapter {
  readonly title: string;
  readonly page: number;
}

/**
 * A register chapter title as the directory `content/lessons/` files it under.
 *
 * "Canada's History" -> `canadas-history`; "Rights and Responsibilities of
 * Citizenship" -> `rights-and-responsibilities-of-citizenship`. Apostrophes are
 * dropped rather than turned into a hyphen, because that is how every existing
 * directory was named, and `every-passage-is-reachable-from-learn.test.ts`
 * holds each shipped directory to exactly one register title under this rule.
 */
export function chapterAddress(title: string): string {
  return title
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The index, in the guide's order.
 *
 * Each chapter takes the position of the register chapter whose address it is,
 * ordered by that chapter's first page. A chapter the register does not name
 * is kept — dropping it would make its passages unreachable, which is the one
 * thing this surface may never do — and goes after every named one, in the
 * order it arrived. The gate fails the build for it first.
 */
export function inGuideOrder(
  chapters: readonly LessonChapter[],
  guide: readonly GuideChapter[],
): readonly LessonChapter[] {
  const pageOf = new Map<string, number>();
  for (const chapter of guide) {
    const address = chapterAddress(chapter.title);
    const known = pageOf.get(address);
    if (known === undefined || chapter.page < known) pageOf.set(address, chapter.page);
  }
  const rank = (chapter: LessonChapter): number =>
    pageOf.get(chapter.chapter) ?? Number.POSITIVE_INFINITY;
  return chapters
    .map((chapter, index) => ({ chapter, index }))
    .sort((a, b) => {
      const first = rank(a.chapter);
      const second = rank(b.chapter);
      if (first !== second) return first < second ? -1 : 1;
      return a.index - b.index;
    })
    .map((entry) => entry.chapter);
}

/** One lesson as Learn offers it: the document, and only what may be read of it. */
export interface LearnLesson {
  readonly lesson: LessonDocument;
  /** Readable, in authored order. Never empty: an empty lesson is not offered. */
  readonly passages: readonly LessonPassage[];
}

/** One chapter as Learn offers it. */
export interface LearnChapter {
  /** In the order the library answered them, which is reading order. */
  readonly lessons: readonly LearnLesson[];
  /** One sentence per passage or lesson left out. Empty is the normal case. */
  readonly refused: readonly string[];
}

/**
 * A chapter's lessons, filtered to what a player may read.
 *
 * `lessons` is `LessonLibrary.lessons(chapter)`'s answer, already in reading
 * order; this keeps that order and keeps each lesson's authored passage order.
 */
export function readableChapter(
  lessons: readonly LessonDocument[],
  grant: AdjudicateClaim,
): LearnChapter {
  const offered: LearnLesson[] = [];
  const refused: string[] = [];

  for (const lesson of lessons) {
    const passages: LessonPassage[] = [];
    for (const passage of lesson.passages) {
      const verdict = passageVerdict(passage, grant);
      if (verdict.readable) passages.push(passage);
      else refused.push(whyUnreadable(lesson, passage, verdict));
    }
    if (passages.length === 0) {
      refused.push(
        `"${lesson.id}" has no passage a player may read, so it is not offered. A lesson with ` +
          'a title and no words is a screen a player dismisses having been told nothing (ADR-0024).',
      );
      continue;
    }
    offered.push({ lesson, passages });
  }

  return { lessons: offered, refused };
}
