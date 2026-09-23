/**
 * Learn, mounted: the guide's chapters, a chapter's lessons, and the reader
 * (ADR-0061 §1 and §8; ADR-0065 §3.1).
 *
 * `docs/stories/TN-LEARN-reading-the-guide-by-chapter.md` is the acceptance
 * criteria. This is the composition root's half of the surface, and it is a
 * file of its own for `./study.ts`'s reason: it holds the catalogue, the grant
 * and the settings, none of which `app/ui` may hold (ADR-0005), and inlined in
 * `main.ts` it would be a hundred lines in the middle of routing.
 *
 * ## One catalogue, one filter, one reader
 *
 * ADR-0063 §6: the level's `read` step and Learn "share one catalogue and one
 * filter". So this file is handed the **same** `LessonLibrary` object
 * `openLevel` reads from — a chapter fetched at a stop is not fetched again
 * here — and the same {@link AdjudicateClaim} (`./verified-passages.ts`), and it
 * opens the same `app/ui/lesson-reader.ts` through the same
 * {@link lessonReaderView}. What is readable, and how it reads, cannot differ
 * between the two doors because there is one of each.
 *
 * ## Lazy
 *
 * `chapters()` answers from module paths and fetches nothing; `lessons(chapter)`
 * fetches one chunk (`vite.config.ts` groups a chapter into `lessons-<chapter>`).
 * Opening Learn therefore downloads no lesson, and opening a chapter downloads
 * that chapter (ADR-0061 §7). The chapter order comes from the register's page
 * ranges, handed in as {@link LearnControllerDeps.guide} — its `chapters` array
 * alone, which the bundler tree-shakes out of the 47 KB manifest.
 *
 * ## What is said to the console and not to a player
 *
 * Every passage or lesson the filter leaves out, named, exactly as `openLevel`
 * does for a `read` step. A player sees a shorter lesson, never a verdict about
 * a JSON path.
 */

import {
  chapterAddress,
  inGuideOrder,
  readableChapter,
  type GuideChapter,
  type LearnLesson,
} from '@application/content/learn';
import type { AdjudicateClaim } from '@application/content/lesson-passages';
import type { LessonChapter, LessonLibrary } from '@application/ports';
import type { LocalizedText } from '@domain/entities/values';
import { hasCopyRow, text, type UiLocale } from '@ui/copy';
import {
  createLearnScreen,
  type LearnItem,
  type LearnScreen,
  type LearnState,
} from '@ui/learn-screen';
import { createLessonReader, type LessonReader, type LessonReaderView } from '@ui/lesson-reader';
import type { SettingsStore } from '@ui/settings';

import { lessonReaderView } from './lesson-reading';

export interface LearnControllerDeps {
  /** The page's one `<main>` (`shell.main`): a dialog is not a landmark. */
  readonly host: HTMLElement;
  /** The one lesson catalogue, shared with the level's `read` step. */
  readonly library: LessonLibrary;
  /** ADR-0003's rule, from `./verified-passages.ts`. Required: no default. */
  readonly grant: AdjudicateClaim;
  /** The source register's chapters, for the guide's order. */
  readonly guide: readonly GuideChapter[];
  /** Followed for the language, single-switch and the hold threshold. */
  readonly store: SettingsStore;
  readonly announce: (message: string, lang?: string) => void;
  /** Learn owns the page: the surface underneath stands its switch ring down. */
  readonly onOpen?: () => void;
  readonly onClose?: () => void;
  /** Where refusals are reported. Defaults to `console.error`. */
  readonly report?: (message: string) => void;
}

export interface LearnController {
  open(): void;
  readonly isOpen: boolean;
  destroy(): void;
}

/** What the controller is showing, in ids — relocalised on every render. */
type View =
  | { readonly kind: 'chapters' }
  | { readonly kind: 'loading'; readonly chapter: string }
  | { readonly kind: 'lessons'; readonly chapter: string; readonly lessons: readonly LearnLesson[] }
  | { readonly kind: 'error'; readonly chapter: string }
  | { readonly kind: 'empty'; readonly chapter: string };

const localised = (value: LocalizedText, locale: UiLocale): string =>
  locale === 'fr' ? value.fr : value.en;

/**
 * A chapter's name in the player's language.
 *
 * The copy row first (`learn.chapter.<directory>`); failing that, the title the
 * register prints, and failing that the directory. A chapter is never dropped
 * for want of a name — its passages would become unreachable, which is the one
 * thing Learn may not do — and
 * `tests/unit/contracts/every-passage-is-reachable-from-learn.test.ts` fails the
 * build for the missing row before a player could see the fallback.
 */
export function chapterTitle(
  chapter: string,
  locale: UiLocale,
  registerTitles: ReadonlyMap<string, string>,
): string {
  const key = `learn.chapter.${chapter}`;
  if (hasCopyRow(key)) return text(locale, key);
  return registerTitles.get(chapter) ?? chapter;
}

export function createLearnController(deps: LearnControllerDeps): LearnController {
  const { store } = deps;
  const report = deps.report ?? ((message: string) => {
    console.error(`[bootstrap] ${message}`);
  });

  let screen: LearnScreen | null = null;
  let reader: LessonReader | null = null;
  let reading: LearnLesson | null = null;
  let showing = false;
  let generation = 0;
  let view: View = { kind: 'chapters' };
  let chapters: readonly LessonChapter[] = [];
  const registerTitles = new Map<string, string>();

  const locale = (): UiLocale => store.current.locale;

  /* The empty id is the catalogue that could not be read, which has no chapter
     to name; it is headed "Learn" rather than by an empty heading. */
  const item = (chapter: string): LearnItem => ({
    id: chapter,
    title:
      chapter === ''
        ? text(locale(), 'learn.title')
        : chapterTitle(chapter, locale(), registerTitles),
  });

  function stateOf(current: View, focus?: string): LearnState {
    switch (current.kind) {
      case 'chapters':
        return {
          kind: 'chapters',
          chapters: chapters.map((chapter) => item(chapter.chapter)),
          ...(focus === undefined ? {} : { focus }),
        };
      case 'lessons':
        return {
          kind: 'lessons',
          chapter: item(current.chapter),
          lessons: current.lessons.map((entry) => ({
            id: entry.lesson.id,
            title: localised(entry.lesson.title, locale()),
          })),
          ...(focus === undefined ? {} : { focus }),
        };
      default:
        return { kind: current.kind, chapter: item(current.chapter) };
    }
  }

  function readerView(): LessonReaderView | null {
    return reading === null
      ? null
      : lessonReaderView({ ...reading, refused: [] }, locale(), localised);
  }

  const unsubscribe = store.subscribe((next, changed) => {
    if (changed === 'locale') {
      screen?.setLocale(next.locale, stateOf(view));
      const current = readerView();
      if (current !== null) reader?.setLocale(next.locale, current);
    }
    if (changed === 'singleSwitch' || changed === 'holdToChooseMs') {
      screen?.setSingleSwitch(next.singleSwitch, next.holdToChooseMs);
      reader?.setSingleSwitch(next.singleSwitch, next.holdToChooseMs);
    }
  });

  function build(): LearnScreen {
    screen ??= createLearnScreen(deps.host, {
      locale: locale(),
      announce: (message) => {
        deps.announce(message, locale());
      },
      singleSwitch: store.current.singleSwitch,
      holdMs: store.current.holdToChooseMs,
      onChapter: (id) => {
        void openChapter(id);
      },
      onLesson: openLesson,
      onRetry: () => {
        if (view.kind === 'error') void openChapter(view.chapter);
      },
      onBack: back,
    });
    return screen;
  }

  function show(next: View, focus?: string): void {
    view = next;
    const learn = build();
    if (learn.visible) learn.setState(stateOf(next, focus));
    else learn.show(stateOf(next, focus));
  }

  async function openChapter(chapter: string): Promise<void> {
    const mine = (generation += 1);
    show({ kind: 'loading', chapter });
    const loaded = await deps.library.lessons(chapter);
    if (mine !== generation || !showing) return;

    if (!loaded.ok) {
      report(
        `the lesson chapter "${chapter}" could not be loaded. ` +
          `${loaded.error.code}: ${loaded.error.message}`,
      );
      show({ kind: 'error', chapter });
      return;
    }

    const readable = readableChapter(loaded.value, deps.grant);
    for (const refusal of readable.refused) report(`a lesson passage is left unread. ${refusal}`);
    show(
      readable.lessons.length === 0
        ? { kind: 'empty', chapter }
        : { kind: 'lessons', chapter, lessons: readable.lessons },
    );
  }

  function openLesson(id: string): void {
    if (view.kind !== 'lessons') return;
    const chosen = view.lessons.find((entry) => entry.lesson.id === id);
    if (chosen === undefined) return;
    reading = chosen;
    const current = readerView();
    if (current === null) {
      reading = null;
      return;
    }

    reader ??= createLessonReader(deps.host, {
      locale: locale(),
      announce: deps.announce,
      singleSwitch: store.current.singleSwitch,
      holdMs: store.current.holdToChooseMs,
      onClose: () => {
        const read = reading;
        reading = null;
        screen?.setCovered(false);
        if (read !== null) screen?.focusItem(read.lesson.id);
      },
    });
    screen?.setCovered(true);
    reader.show(current);
  }

  function back(): void {
    if (view.kind === 'chapters') {
      close();
      return;
    }
    const from = view.chapter;
    generation += 1;
    show({ kind: 'chapters' }, from);
  }

  function close(): void {
    if (!showing) return;
    showing = false;
    generation += 1;
    reading = null;
    reader?.hide();
    screen?.setCovered(false);
    screen?.hide();
    deps.onClose?.();
  }

  return {
    get isOpen(): boolean {
      return showing;
    },

    open(): void {
      if (showing) return;
      showing = true;
      const mine = (generation += 1);
      deps.onOpen?.();

      for (const chapter of deps.guide) {
        registerTitles.set(chapterAddress(chapter.title), chapter.title);
      }

      void deps.library.chapters().then((index) => {
        if (mine !== generation || !showing) return;
        if (!index.ok) {
          /* An empty catalogue is a build that shipped no lessons (ADR-0024);
             `make build` refuses it first. Say so, and show a chapter-less
             Learn rather than a list with nothing in it. */
          report(`the lesson catalogue could not be read. ${index.error.code}: ${index.error.message}`);
          chapters = [];
          show({ kind: 'empty', chapter: '' });
          return;
        }
        chapters = inGuideOrder(index.value, deps.guide);
        show({ kind: 'chapters' });
      });
    },

    destroy(): void {
      unsubscribe();
      reader?.destroy();
      reader = null;
      screen?.destroy();
      screen = null;
      showing = false;
    },
  };
}
