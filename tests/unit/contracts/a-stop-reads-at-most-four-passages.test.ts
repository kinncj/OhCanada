/**
 * A stop's reading budget (ADR-0065 §3.3, `TN-READ`): the `read` steps at one
 * stop — every `read` step sharing a `targetId` — together name at most four
 * passages and carry at most 120 words in either language.
 *
 * Counted **per stop and not per step**, "or two steps at one plaque dodge it".
 * That sentence became load-bearing with ADR-0067: one engagement now finishes
 * every `read` step in a row at a landmark and opens one reader over all of
 * their passages, so two steps at one stop are one sheet on the phone.
 *
 * Read off the disk, through the same resolver the build gate uses, so a
 * passage is measured as the reader would draw it.
 */

import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  readLessonCorpus,
  readQuestCorpus,
  resolvePassage,
} from '../../../scripts/lib/lesson-passages.mjs';

import { bareTargetId } from '@ui/interact';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** ADR-0065 §3.3. Raising either needs an ADR; lowering is ui-a11y's to do. */
const MAX_PASSAGES_PER_STOP = 4;
const MAX_WORDS_PER_STOP = 120;
const LOCALES = ['en', 'fr'] as const;

/** Words as a reader counts them: runs of non-space. */
const wordsIn = (prose: string): number =>
  prose.split(/\s+/u).filter((word) => word.length > 0).length;

interface StopReading {
  readonly where: string;
  readonly passages: number;
  readonly words: Record<(typeof LOCALES)[number], number>;
  readonly faults: readonly string[];
}

type Corpus = ReturnType<typeof readLessonCorpus>;

interface QuestLike {
  readonly steps?: readonly {
    readonly kind?: unknown;
    readonly targetId?: unknown;
    readonly passages?: readonly unknown[];
  }[];
}

/** Every stop a quest reads at, with what its `read` steps add up to. */
function readingPerStop(quest: QuestLike, where: string, corpus: Corpus): StopReading[] {
  const stops = new Map<string, { passages: number; en: number; fr: number; faults: string[] }>();
  for (const step of quest.steps ?? []) {
    if (step.kind !== 'read' || typeof step.targetId !== 'string') continue;
    const stop = bareTargetId(step.targetId);
    const tally = stops.get(stop) ?? { passages: 0, en: 0, fr: 0, faults: [] };
    for (const reference of step.passages ?? []) {
      tally.passages += 1;
      const resolution = resolvePassage(corpus, reference);
      if (!resolution.ok) {
        /* Resolution is `a-read-step-names-a-passage-that-exists`'s gate; an
           unresolved passage cannot be measured, so it is named here too. */
        tally.faults.push(resolution.message);
        continue;
      }
      for (const locale of LOCALES) {
        const prose = resolution.match.passage.text?.[locale];
        tally[locale] += typeof prose === 'string' ? wordsIn(prose) : 0;
      }
    }
    stops.set(stop, tally);
  }
  return [...stops].map(([stop, tally]) => ({
    where: `${where} at "${stop}"`,
    passages: tally.passages,
    words: { en: tally.en, fr: tally.fr },
    faults: tally.faults,
  }));
}

const corpus = readLessonCorpus(REPO_ROOT);
const quests = readQuestCorpus(REPO_ROOT);

describe('a stop reads at most four passages and 120 words (ADR-0065 §3.3)', () => {
  const readings = quests.flatMap(({ where, document }) =>
    readingPerStop(document as QuestLike, where, corpus),
  );

  it('measures something: at least one stop in the build reads (ADR-0024)', () => {
    expect(readings.length).toBeGreaterThan(0);
  });

  it('holds every stop in the build to the budget', () => {
    for (const reading of readings) {
      expect(reading.faults, `${reading.where}: a passage could not be measured`).toEqual([]);
      expect(
        reading.passages,
        `${reading.where} reads ${String(reading.passages)} passages; a stop reads at most ` +
          `${String(MAX_PASSAGES_PER_STOP)}, counted over every read step naming it (ADR-0065 §3.3).`,
      ).toBeLessThanOrEqual(MAX_PASSAGES_PER_STOP);
      for (const locale of LOCALES) {
        expect(
          reading.words[locale],
          `${reading.where} reads ${String(reading.words[locale])} words in ${locale}; a stop ` +
            `reads at most ${String(MAX_WORDS_PER_STOP)} in either language (ADR-0065 §3.3).`,
        ).toBeLessThanOrEqual(MAX_WORDS_PER_STOP);
      }
    }
  });
});

describe('the budget is counted per stop, not per step', () => {
  const passagePairs = corpus.lessons.flatMap((lesson) =>
    lesson.passages.map((passage) => ({ lesson: lesson.id, passage: passage.id })),
  );
  const [a, b, c, d, e] = passagePairs;

  it('adds two read steps at one stop together', () => {
    const [reading] = readingPerStop(
      {
        steps: [
          { kind: 'visit', targetId: 'locks' },
          { kind: 'read', targetId: 'locks', passages: [a, b, c] },
          { kind: 'read', targetId: 'poi.locks', passages: [d, e] },
        ],
      },
      'fixture',
      corpus,
    );
    expect(reading?.passages).toBe(5);
    expect(reading?.passages).toBeGreaterThan(MAX_PASSAGES_PER_STOP);
  });

  it('keeps two stops apart', () => {
    const readings = readingPerStop(
      {
        steps: [
          { kind: 'read', targetId: 'locks', passages: [a, b] },
          { kind: 'read', targetId: 'lake', passages: [c] },
        ],
      },
      'fixture',
      corpus,
    );
    expect(readings.map((reading) => reading.passages)).toEqual([2, 1]);
  });

  it('counts words as runs of non-space', () => {
    expect(wordsIn('  Canada is a constitutional   monarchy. ')).toBe(5);
    expect(wordsIn('')).toBe(0);
  });
});
