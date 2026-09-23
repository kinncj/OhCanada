import { describe, expect, it, vi } from 'vitest';

import type { AdjudicateClaim } from '@application/content/lesson-passages';
import type { FactClaim, LessonDocument, LessonLibrary } from '@application/ports';
import { appErr, ok, type Result } from '@common/result';
import { text } from '@ui/copy';
import { createSettingsStore, DEFAULT_SETTINGS } from '@ui/settings';

/* Relative, not aliased: there is no `@bootstrap` alias. */
import { chapterTitle, createLearnController } from '../../../app/bootstrap/learn';

import { buildPage, press, type FakeElement } from '../ui/support/fake-dom';

/**
 * Learn, mounted (`docs/stories/TN-LEARN-reading-the-guide-by-chapter.md`).
 *
 * The controller's own decisions, over a fixture library: that opening Learn
 * fetches no chapter, that a chapter is fetched when opened and not before,
 * that a failed download offers a retry that can work, that Back goes one step
 * up at every level, that the reader's close returns to the lesson just read,
 * and that a change of language re-renders without fetching again. The screens
 * are real. The real corpus is walked by
 * `tests/unit/contracts/every-passage-is-reachable-from-learn.test.ts`.
 */

const GUIDE = [
  { title: 'Rights and Responsibilities of Citizenship', page: 11 },
  { title: "Canada's History", page: 23 },
];

const fact = (status: string): FactClaim =>
  ({ factual: true, verification: { status } }) as unknown as FactClaim;

const LESSONS: readonly LessonDocument[] = [
  {
    id: 'history-01',
    chapter: "Canada's History",
    order: 1,
    title: { en: 'First peoples', fr: 'Les premiers peuples' },
    passages: [
      { id: 'p1', text: { en: 'One.', fr: 'Un.' }, fact: fact('verified') },
      { id: 'p2', text: { en: 'Two.', fr: 'Deux.' }, fact: fact('quarantined') },
      { id: 'p3', text: { en: 'Three.', fr: 'Trois.' }, fact: fact('verified') },
    ],
  },
  {
    id: 'history-02',
    chapter: "Canada's History",
    order: 2,
    title: { en: 'A colony', fr: 'Une colonie' },
    passages: [{ id: 'p1', text: { en: 'Four.', fr: 'Quatre.' }, fact: fact('verified') }],
  },
] as unknown as readonly LessonDocument[];

const grant: AdjudicateClaim = (claim) => {
  const status = (claim as unknown as { verification: { status: string } }).verification.status;
  return status === 'verified'
    ? { granted: true, why: null, status }
    : { granted: false, why: 'not-verified', status };
};

function mount(options: { lessons?: () => Promise<Result<readonly LessonDocument[]>> } = {}) {
  const page = buildPage();
  const store = createSettingsStore(DEFAULT_SETTINGS);
  const fetched: string[] = [];
  const library: LessonLibrary = {
    /* Answered in file-system order, which is not the guide's. */
    chapters: async () =>
      Promise.resolve(
        ok([
          { chapter: 'canadas-history', lessons: ['history-01', 'history-02'] },
          { chapter: 'rights-and-responsibilities-of-citizenship', lessons: ['rights-01'] },
        ]),
      ),
    lessons: async (chapter) => {
      fetched.push(chapter);
      return options.lessons?.() ?? Promise.resolve(ok(LESSONS));
    },
  };
  const onOpen = vi.fn();
  const onClose = vi.fn();
  const report = vi.fn();
  const announce = vi.fn();
  const controller = createLearnController({
    host: page.host,
    library,
    grant,
    guide: GUIDE,
    store,
    announce,
    onOpen,
    onClose,
    report,
  });
  const at = (testId: string): FakeElement | null => page.ui.byTestId(testId);
  const settle = async (testId: string): Promise<void> => {
    await vi.waitFor(() => {
      expect(at(testId)).not.toBeNull();
    });
  };
  return { page, store, controller, fetched, onOpen, onClose, report, announce, at, settle };
}

describe('Learn, mounted', () => {
  it('opens on the chapters in the guide order, having fetched no chapter', async () => {
    const { controller, fetched, onOpen, at, settle } = mount();
    controller.open();
    expect(onOpen).toHaveBeenCalledTimes(1);
    await settle('learn-chapters');

    const titles = (at('learn-chapters')?.querySelectorAll('button') ?? []).map(
      (control) => control.textContent,
    );
    expect(titles).toEqual([
      text('en', 'learn.chapter.rights-and-responsibilities-of-citizenship'),
      text('en', 'learn.chapter.canadas-history'),
    ]);
    expect(fetched).toEqual([]);
  });

  it('fetches a chapter when it is opened, and lists only lessons with something to read', async () => {
    const { controller, fetched, at, settle, report } = mount();
    controller.open();
    await settle('learn-chapters');
    at('learn-chapter-canadas-history')?.click();
    await settle('learn-lessons');

    expect(fetched).toEqual(['canadas-history']);
    expect(at('learn-title')?.textContent).toBe(text('en', 'learn.chapter.canadas-history'));
    expect(
      (at('learn-lessons')?.querySelectorAll('button') ?? []).map((control) => control.textContent),
    ).toEqual(['First peoples', 'A colony']);
    /* The quarantined passage is named for a developer, never shown. */
    expect(report).toHaveBeenCalledWith(expect.stringContaining('"history-01/p2"'));
  });

  it('opens the reader on the readable passages, and Close returns focus to that lesson', async () => {
    const { controller, page, at, settle } = mount();
    controller.open();
    await settle('learn-chapters');
    at('learn-chapter-canadas-history')?.click();
    await settle('learn-lessons');
    at('learn-lesson-history-01')?.click();

    expect(at('lesson-reader')?.hidden).toBe(false);
    expect(at('lesson-reader-title')?.textContent).toBe('First peoples');
    expect(page.ui.allByTestId('lesson-reader-passage').map((node) => node.textContent)).toEqual([
      'One.',
      'Three.',
    ]);

    at('lesson-reader-close')?.click();
    expect(at('lesson-reader')?.hidden).toBe(true);
    expect(at('learn')?.hidden).toBe(false);
    expect(page.doc.activeElement?.getAttribute('data-testid')).toBe('learn-lesson-history-01');
  });

  it('goes one step up on Back and on Escape, and closes only from the chapter list', async () => {
    const { controller, page, at, settle, onClose } = mount();
    controller.open();
    await settle('learn-chapters');
    at('learn-chapter-canadas-history')?.click();
    await settle('learn-lessons');

    press(at('learn') as FakeElement, 'Escape');
    await settle('learn-chapters');
    expect(page.doc.activeElement?.getAttribute('data-testid')).toBe('learn-chapter-canadas-history');
    expect(onClose).not.toHaveBeenCalled();

    at('learn-back')?.click();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(at('learn')?.hidden).toBe(true);
    expect(controller.isOpen).toBe(false);
  });

  it('offers a retry that can work when a chapter will not download', async () => {
    let fail = true;
    const { controller, at, settle, fetched } = mount({
      lessons: async () =>
        Promise.resolve(fail ? appErr('io', 'content.lessons.fetchFailed', 'offline') : ok(LESSONS)),
    });
    controller.open();
    await settle('learn-chapters');
    at('learn-chapter-canadas-history')?.click();
    await settle('learn-error');

    fail = false;
    at('learn-retry')?.click();
    await settle('learn-lessons');
    expect(fetched).toEqual(['canadas-history', 'canadas-history']);
  });

  it('shows a chapter with nothing readable as its own state, with no retry', async () => {
    const { controller, at, settle } = mount({
      lessons: async () =>
        Promise.resolve(
          ok(
            LESSONS.map((lesson) => ({
              ...lesson,
              passages: lesson.passages.map((passage) => ({ ...passage, fact: fact('rejected') })),
            })),
          ),
        ),
    });
    controller.open();
    await settle('learn-chapters');
    at('learn-chapter-canadas-history')?.click();
    await settle('learn-empty');
    expect(at('learn-retry')).toBeNull();
    expect(at('learn-lessons')).toBeNull();
  });

  it('ignores a chapter that arrives after the player went back', async () => {
    let release: (value: Result<readonly LessonDocument[]>) => void = () => undefined;
    const { controller, at, settle } = mount({
      lessons: async () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    });
    controller.open();
    await settle('learn-chapters');
    at('learn-chapter-canadas-history')?.click();
    await settle('learn-intro');
    at('learn-back')?.click();
    release(ok(LESSONS));
    await Promise.resolve();
    await Promise.resolve();
    expect(at('learn-lessons')).toBeNull();
    expect(at('learn-chapters')).not.toBeNull();
  });

  it('changes language without fetching again, in the list and in the reader', async () => {
    const { controller, store, at, settle, fetched } = mount();
    controller.open();
    await settle('learn-chapters');
    at('learn-chapter-canadas-history')?.click();
    await settle('learn-lessons');
    at('learn-lesson-history-02')?.click();

    store.set('locale', 'fr');
    expect(at('lesson-reader-title')?.textContent).toBe('Une colonie');
    at('lesson-reader-close')?.click();
    expect(at('learn-title')?.textContent).toBe(text('fr', 'learn.chapter.canadas-history'));
    expect(
      (at('learn-lessons')?.querySelectorAll('button') ?? []).map((control) => control.textContent),
    ).toEqual(['Les premiers peuples', 'Une colonie']);
    expect(fetched).toEqual(['canadas-history']);
  });
});

describe('a chapter name', () => {
  it('is the copy row, then the register title, then the directory — never nothing', () => {
    expect(chapterTitle('canadas-history', 'fr', new Map())).toBe(
      text('fr', 'learn.chapter.canadas-history'),
    );
    expect(chapterTitle('the-oath', 'fr', new Map([['the-oath', 'The Oath']]))).toBe('The Oath');
    expect(chapterTitle('the-oath', 'en', new Map())).toBe('the-oath');
  });
});
