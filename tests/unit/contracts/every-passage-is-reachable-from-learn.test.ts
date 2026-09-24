import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { bundledLessonLibrary } from '@adapters/content';
import { chapterAddress } from '@application/content/learn';
import type { LessonLibrary } from '@application/ports';
import guideRegister from '@content/sources/discover-canada.json';
import { hasCopyRow, text, type UiLocale } from '@ui/copy';
import { createSettingsStore, DEFAULT_SETTINGS } from '@ui/settings';

import { passageVerdict, readLessonCorpus } from '../../../scripts/lib/lesson-passages.mjs';

import { createLearnController } from '../../../app/bootstrap/learn';
import { grantsPassage } from '../../../app/bootstrap/verified-passages';

import { buildPage, type FakeElement, type FakePage } from '../ui/support/fake-dom';

/**
 * ADR-0065 §3.1's defining property of Learn, held as a gate:
 *
 * > **every passage that passes the shippable filter is reachable from Learn.**
 *
 * `docs/stories/TN-LEARN-reading-the-guide-by-chapter.md`, `TN-LEARN-02`.
 *
 * ## How "reachable" is measured, and why it is measured this way
 *
 * By **walking the screens**. The real controller (`app/bootstrap/learn.ts`),
 * over the real lazy catalogue, the real grant and the real register, mounts
 * the real Learn screen and the real reader on the shared fake DOM; this suite
 * then presses every chapter button, every lesson button in each, and reads
 * the passages off the reader card exactly as a player would meet them. A
 * passage is reachable when its words appeared on a `lesson-reader-passage`,
 * and only then. A check over the catalogue's data would prove the data is
 * there; it would not prove a button leads to it.
 *
 * ## The oracle is the other implementation
 *
 * What *should* be reachable is computed independently: the content gate's own
 * corpus reader and readable-passage rule (`scripts/lib/lesson-passages.mjs`),
 * over the files on disk. The runtime and the tooling are two implementations of
 * one rule, kept in step by `a-passage-is-readable-by-one-rule.test.ts`; this
 * suite asks the question from the other end — not "do they agree about a
 * passage" but "does a player reach every passage they agree on, and nothing
 * else". Both directions are asserted: nothing readable is missing, and nothing
 * unreadable is shown.
 *
 * ## Not vacuous
 *
 * The corpus must hold passages, the walk must reach at least as many as were
 * shipped when this gate was written ({@link SHIPPED_WHEN_WRITTEN}), and the
 * count is reported in the suite's name. A glob that matched nothing, a chapter list that rendered
 * no buttons, or a reader that never opened all fail here rather than passing
 * over an empty set (ADR-0024).
 */

/** 302 passages, 48 lessons, 10 chapters on 2026-09-23. A floor, not a pin. */
const SHIPPED_WHEN_WRITTEN = 302;

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CORPUS = readLessonCorpus(ROOT);

/** `lesson/passage` -> the words a player should read, per language. */
const SHOULD_READ = new Map<string, { readonly en: string; readonly fr: string }>();
const SHOULD_NOT_READ = new Set<string>();
for (const lesson of CORPUS.lessons) {
  for (const passage of lesson.passages) {
    const key = `${lesson.id}/${passage.id}`;
    const words = passage.text as { en?: unknown; fr?: unknown } | null;
    if (passageVerdict(passage).readable && typeof words?.en === 'string' && typeof words.fr === 'string') {
      SHOULD_READ.set(key, { en: words.en, fr: words.fr });
    } else {
      SHOULD_NOT_READ.add(key);
    }
  }
}

const REGISTER = (guideRegister as { chapters: readonly { title: string; page: number }[] })
  .chapters;

interface Walk {
  /** `lesson/passage` -> the words drawn for it. */
  readonly reached: Map<string, string>;
  /** Chapter directories in the order the list drew them. */
  readonly chapters: string[];
  /** How many chapter chunks were asked for before any chapter was opened. */
  readonly fetchedOnOpen: number;
}

const byTestId = (page: FakePage, testId: string): FakeElement | null => page.ui.byTestId(testId);

const testIdsIn = (list: FakeElement | null, prefix: string): string[] =>
  (list?.querySelectorAll('button') ?? []).map((control) =>
    (control.getAttribute('data-testid') ?? '').slice(prefix.length),
  );

async function walk(locale: UiLocale): Promise<Walk> {
  const page = buildPage();
  const store = createSettingsStore({ ...DEFAULT_SETTINGS, locale });
  const real = bundledLessonLibrary();
  let fetched = 0;
  const library: LessonLibrary = {
    chapters: async () => real.chapters(),
    lessons: async (chapter) => {
      fetched += 1;
      return real.lessons(chapter);
    },
  };
  const controller = createLearnController({
    host: page.host,
    library,
    grant: grantsPassage,
    guide: REGISTER,
    store,
    announce: () => undefined,
    report: () => undefined,
  });

  controller.open();
  await vi.waitFor(() => {
    expect(byTestId(page, 'learn-chapters')).not.toBeNull();
  });
  const fetchedOnOpen = fetched;

  const reached = new Map<string, string>();
  const chapters = testIdsIn(byTestId(page, 'learn-chapters'), 'learn-chapter-');

  for (const chapter of chapters) {
    byTestId(page, `learn-chapter-${chapter}`)?.click();
    await vi.waitFor(() => {
      expect(
        byTestId(page, 'learn-lessons') ?? byTestId(page, 'learn-empty') ?? byTestId(page, 'learn-error'),
      ).not.toBeNull();
    });
    expect(byTestId(page, 'learn-error'), `chapter "${chapter}" would not load`).toBeNull();

    for (const lesson of testIdsIn(byTestId(page, 'learn-lessons'), 'learn-lesson-')) {
      byTestId(page, `learn-lesson-${lesson}`)?.click();
      const reader = byTestId(page, 'lesson-reader');
      expect(reader?.hidden, `lesson "${lesson}" opened no reader`).toBe(false);
      for (const paragraph of page.ui.allByTestId('lesson-reader-passage')) {
        reached.set(`${lesson}/${paragraph.getAttribute('data-tn-passage') ?? ''}`, paragraph.textContent);
      }
      byTestId(page, 'lesson-reader-close')?.click();
      expect(reader?.hidden).toBe(true);
    }

    byTestId(page, 'learn-back')?.click();
    await vi.waitFor(() => {
      expect(byTestId(page, 'learn-chapters')).not.toBeNull();
    });
  }

  controller.destroy();
  return { reached, chapters, fetchedOnOpen };
}

/*
 * The count is reported in the suite's own name, which every run prints: the
 * walk below must reach exactly this set, so it is also the number reached.
 */
describe(`Learn reaches all ${String(SHOULD_READ.size)} shippable passages (${String(
  CORPUS.passageCount,
)} authored, ${String(CORPUS.lessonCount)} lessons)`, () => {
  it('has a corpus to measure, so nothing below passes over an empty set', () => {
    expect(CORPUS.faults).toEqual([]);
    expect(CORPUS.passageCount).toBeGreaterThanOrEqual(SHIPPED_WHEN_WRITTEN);
    expect(SHOULD_READ.size).toBeGreaterThanOrEqual(SHIPPED_WHEN_WRITTEN);
  });

  it('reaches every readable passage, and nothing else, with its English words', async () => {
    const { reached, fetchedOnOpen } = await walk('en');

    const missing = [...SHOULD_READ.keys()].filter((key) => !reached.has(key));
    expect(missing, `readable but unreachable from Learn: ${missing.join(', ')}`).toEqual([]);
    const shown = [...reached.keys()].filter((key) => SHOULD_NOT_READ.has(key) || !SHOULD_READ.has(key));
    expect(shown, `shown by Learn but not readable: ${shown.join(', ')}`).toEqual([]);
    for (const [key, words] of reached) {
      expect(words, key).toBe(SHOULD_READ.get(key)?.en);
    }
    expect(reached.size).toBeGreaterThanOrEqual(SHIPPED_WHEN_WRITTEN);

    /* Lazy: opening Learn fetched no chapter (ADR-0061 §7). */
    expect(fetchedOnOpen).toBe(0);
  });

  it('reaches the same passages in French, with their French words', async () => {
    const { reached } = await walk('fr');
    expect(reached.size).toBe(SHOULD_READ.size);
    for (const [key, words] of reached) {
      expect(words, key).toBe(SHOULD_READ.get(key)?.fr);
    }
  });

  it('lists every chapter directory once, in the guide order, under a name in both languages', async () => {
    const { chapters } = await walk('en');
    const shipped = [...CORPUS.chapters].sort();
    expect([...chapters].sort()).toEqual(shipped);

    const addresses = REGISTER.map((chapter) => chapterAddress(chapter.title));
    for (const directory of shipped) {
      /* Exactly one register chapter per directory, or the order is a guess. */
      expect(addresses.filter((address) => address === directory), directory).toHaveLength(1);
      for (const locale of ['en', 'fr'] as const) {
        const key = `learn.chapter.${directory}`;
        expect(hasCopyRow(key), `no ${key} row`).toBe(true);
        if (hasCopyRow(key)) expect(text(locale, key).trim(), `${key} (${locale})`).not.toBe('');
      }
    }
    const rank = (directory: string): number => addresses.indexOf(directory);
    expect(chapters.map(rank)).toEqual([...chapters.map(rank)].sort((a, b) => a - b));
  });
});
