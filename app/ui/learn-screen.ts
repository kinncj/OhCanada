/**
 * Learn: the guide's chapters, then a chapter's lessons (ADR-0061 §1).
 *
 * `docs/stories/TN-LEARN-reading-the-guide-by-chapter.md` is the acceptance
 * criteria. The lesson itself is read on `app/ui/lesson-reader.ts`, reused
 * unchanged — `TN-READ` owns the route through prose, and ADR-0063 §3 and
 * ADR-0065 §3.4 require the level's reader and Learn's to be one design, which
 * is easiest to keep when they are one component.
 *
 * ## What this screen is handed, and what it may not do
 *
 * **Ids and titles, already localised, and nothing else** (ADR-0063 §6). A
 * chapter is its directory and its name; a lesson is its id and its title.
 * {@link LearnItem} has no field a `LessonDocument`, a `fact` block or a
 * `LocalizedText` fits into, so this screen cannot read a lesson, cannot decide
 * whether a passage may be read and cannot choose a language. The composition
 * root does all three (`app/bootstrap/learn.ts`), over the one lazy catalogue
 * and the one shippable-passage filter the level's reader uses.
 *
 * ## The states
 *
 * `chapters` → `loading` → `lessons` (or `error`, or `empty`). Back and Escape
 * go one step up and never further; which step is up is the caller's decision,
 * reported through {@link LearnScreenOptions.onBack}, because only the caller
 * knows whether a lesson is open over the list.
 *
 * - **`error`** is a chapter that would not download, and offers Try again.
 * - **`empty`** is a chapter with nothing a player may read, and does **not**
 *   offer Try again: trying again cannot change a verifier's verdict, and a
 *   control that can never work is a control that lies (`TN-LEARN-09`).
 *
 * ## One switch, one keyboard, one screen reader
 *
 * The lists are menus and use the one scanning ring every menu uses
 * (`app/ui/screen.ts` gives it; `app/ui/single-switch.ts` owns it). Each list
 * is an `<ol>` of real buttons, so a screen reader says how many chapters there
 * are. The dialog is named by its `<h1>` — "Learn", then the chapter's title —
 * and described by the sentence under it. A change of view moves focus to the
 * thing the player is most likely to want and says the new heading once through
 * the live region. Waiting is said, with `aria-busy` on the dialog, rather than
 * shown only as a spinner: there is no spinner.
 *
 * Nothing here animates, so reduced motion has nothing to remove, and nothing
 * scans by itself or expires.
 *
 * DOM only (ADR-0005). No adapters, no scenes, no content.
 */

import { text, type UiLocale } from './copy';
import { button, element, replaceChildren } from './dom';
import { createScreen, type Screen } from './screen';

/** A chapter or a lesson, as a player meets it: an address and a name. */
export interface LearnItem {
  /** A chapter's directory, or a lesson's own `id`. Never drawn. */
  readonly id: string;
  /** Already in the player's language. */
  readonly title: string;
}

export type LearnState =
  | {
      readonly kind: 'chapters';
      readonly chapters: readonly LearnItem[];
      /** The chapter to put focus on — the one the player just came back from. */
      readonly focus?: string;
    }
  | { readonly kind: 'loading'; readonly chapter: LearnItem }
  | {
      readonly kind: 'lessons';
      readonly chapter: LearnItem;
      /** Never empty: a chapter with nothing to read is `empty`. */
      readonly lessons: readonly LearnItem[];
      readonly focus?: string;
    }
  | { readonly kind: 'error'; readonly chapter: LearnItem }
  | { readonly kind: 'empty'; readonly chapter: LearnItem };

export interface LearnScreenOptions {
  readonly locale: UiLocale;
  /** The one live region. Screens never make a second. */
  readonly announce?: (message: string) => void;
  readonly onChapter?: (id: string) => void;
  readonly onLesson?: (id: string) => void;
  readonly onRetry?: () => void;
  /** Back, and Escape: one step up. The caller decides which step that is. */
  readonly onBack?: () => void;
  readonly singleSwitch?: boolean;
  readonly holdMs?: number;
  readonly now?: () => number;
}

export interface LearnScreen {
  readonly element: HTMLElement;
  readonly visible: boolean;
  readonly state: LearnState;
  show(state: LearnState): void;
  setState(state: LearnState): void;
  hide(): void;
  /**
   * The player changed language. The state comes back with it, because the
   * titles are content this screen cannot re-localise — the same required
   * parameter, for the same reason, as `LessonReader.setLocale`.
   */
  setLocale(locale: UiLocale, state: LearnState): void;
  setSingleSwitch(enabled: boolean, holdMs?: number): void;
  /** A reader is open over the list: stand the trap and the ring down. */
  setCovered(covered: boolean): void;
  /** Put focus (and the switch highlight) on a chapter or lesson by id. */
  focusItem(id: string): void;
  destroy(): void;
}

const ID = 'tn-learn';

export function createLearnScreen(host: HTMLElement, options: LearnScreenOptions): LearnScreen {
  const doc = host.ownerDocument;
  let locale = options.locale;
  let state: LearnState = { kind: 'chapters', chapters: [] };
  const items = new Map<string, HTMLElement>();

  const screen: Screen = createScreen(host, {
    id: ID,
    testId: 'learn',
    locale,
    ...(options.onBack === undefined ? {} : { onEscape: options.onBack }),
    ...(options.announce === undefined ? {} : { announce: options.announce }),
    switch: {
      enabled: options.singleSwitch === true,
      holdMs: options.holdMs ?? 600,
      ...(options.now === undefined ? {} : { now: options.now }),
    },
  });

  const title = element(doc, 'h1', { id: `${ID}-title`, testId: 'learn-title' });
  screen.labelledBy(title);
  const intro = element(doc, 'p', { id: `${ID}-intro`, testId: 'learn-intro' });
  screen.describedBy(intro);

  const panel = element(doc, 'div', { className: 'tn-screen__row' });
  const backButton = button(doc, {
    testId: 'learn-back',
    text: text(locale, 'common.back'),
    onClick: () => options.onBack?.(),
  });
  const actions = element(doc, 'div', { className: 'tn-screen__actions' });
  screen.card.append(title, intro, panel, actions);

  function list(
    testId: string,
    entries: readonly LearnItem[],
    prefix: string,
    choose: ((id: string) => void) | undefined,
  ): HTMLElement {
    return element(doc, 'ol', {
      testId,
      className: 'tn-screen__options',
      children: entries.map((entry) => {
        const control = button(doc, {
          testId: `${prefix}-${entry.id}`,
          text: entry.title,
          onClick: () => choose?.(entry.id),
        });
        items.set(entry.id, control);
        return element(doc, 'li', { children: [control] });
      }),
    });
  }

  /** A sentence that takes focus, so arriving on it reads it. */
  function statement(testId: string, key: Parameters<typeof text>[1]): HTMLElement {
    const node = element(doc, 'p', { testId, text: text(locale, key) });
    node.tabIndex = -1;
    return node;
  }

  function render(): { focus: HTMLElement | null; say: string | null } {
    items.clear();
    screen.element.removeAttribute('aria-busy');
    intro.hidden = false;
    screen.describedBy(intro);
    backButton.textContent = text(locale, 'common.back');

    switch (state.kind) {
      case 'chapters': {
        title.textContent = text(locale, 'learn.title');
        intro.textContent = text(locale, 'learn.intro');
        replaceChildren(panel, [
          list('learn-chapters', state.chapters, 'learn-chapter', options.onChapter),
        ]);
        replaceChildren(actions, [backButton]);
        const wanted = state.focus === undefined ? undefined : items.get(state.focus);
        return { focus: wanted ?? null, say: null };
      }
      case 'loading': {
        title.textContent = state.chapter.title;
        intro.textContent = text(locale, 'learn.loading');
        screen.element.setAttribute('aria-busy', 'true');
        replaceChildren(panel, []);
        replaceChildren(actions, [backButton]);
        return {
          focus: screen.element,
          say: `${state.chapter.title}. ${text(locale, 'learn.loading')}`,
        };
      }
      case 'lessons': {
        title.textContent = state.chapter.title;
        intro.textContent = text(locale, 'learn.lessons.intro');
        replaceChildren(panel, [
          list('learn-lessons', state.lessons, 'learn-lesson', options.onLesson),
        ]);
        replaceChildren(actions, [backButton]);
        const wanted = state.focus === undefined ? undefined : items.get(state.focus);
        const first = state.lessons[0] === undefined ? undefined : items.get(state.lessons[0].id);
        return { focus: wanted ?? first ?? null, say: state.chapter.title };
      }
      case 'error': {
        title.textContent = state.chapter.title;
        const message = statement('learn-error', 'learn.error');
        intro.hidden = true;
        screen.describedBy(message);
        replaceChildren(panel, [message]);
        replaceChildren(actions, [
          button(doc, {
            testId: 'learn-retry',
            text: text(locale, 'learn.error.retry'),
            onClick: () => options.onRetry?.(),
          }),
          backButton,
        ]);
        return { focus: message, say: text(locale, 'learn.error') };
      }
      case 'empty': {
        title.textContent = state.chapter.title;
        const message = statement('learn-empty', 'learn.chapter.empty');
        intro.hidden = true;
        screen.describedBy(message);
        replaceChildren(panel, [message]);
        replaceChildren(actions, [backButton]);
        return { focus: message, say: text(locale, 'learn.chapter.empty') };
      }
    }
  }

  /** Highlight what has focus, so the switch and the keyboard agree. */
  function syncRing(target: HTMLElement | null): void {
    screen.refreshSwitch();
    if (target === null || !screen.ring.enabled) return;
    const index = screen.ring.items.indexOf(target);
    if (index !== -1) screen.ring.highlight(index);
  }

  function apply(next: LearnState, arriving: boolean): void {
    state = next;
    const { focus, say } = render();
    if (!screen.visible) return;
    /* On arrival the trap has focused the dialog itself, which reads its name
       and description; moving focus again would talk over it. */
    if (!arriving && focus !== null) focus.focus();
    if (!arriving && say !== null) options.announce?.(say);
    syncRing(arriving ? null : focus);
  }

  return {
    element: screen.element,
    get visible(): boolean {
      return screen.visible;
    },
    get state(): LearnState {
      return state;
    },

    show(next): void {
      /* Open first, then render, as Study does: focus can only move to
         something that is on the page. */
      const arriving = !screen.visible;
      screen.show();
      apply(next, arriving);
    },

    setState(next): void {
      apply(next, false);
    },

    hide(): void {
      screen.hide();
    },

    setLocale(next, current): void {
      locale = next;
      screen.setLocale(next);
      state = current;
      render();
      screen.refreshSwitch();
    },

    setSingleSwitch(enabled, holdMs): void {
      screen.setSwitchEnabled(enabled, holdMs);
    },

    setCovered(covered): void {
      screen.setCovered(covered);
    },

    focusItem(id): void {
      const target = items.get(id);
      if (target === undefined || !screen.visible) return;
      target.focus();
      syncRing(target);
    },

    destroy(): void {
      items.clear();
      screen.destroy();
    },
  };
}
