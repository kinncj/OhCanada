/**
 * Study mode: the screen before a drill, the empty state, the load failure and
 * the summary after it.
 *
 * `docs/stories/TN-STUDY-study-mode.md` is the acceptance criteria. The drill
 * itself is `app/ui/question-card.ts`, reused exactly — "Answering behaves
 * exactly as it does in a level" is a statement about *one* component, not two
 * that agree today.
 *
 * Four rules from the story that live in the code:
 *
 *  - **No timer, no score that follows the player.** The summary says how many
 *    were right in this drill and nothing else: no percentage, grade, streak or
 *    star rating exists in this file to be rendered.
 *  - **The player is never told how the questions were chosen.** Same word ban
 *    as the card; the unit suite reads every string this screen can draw.
 *  - **A short drill is stated, not padded** (`study.short`).
 *  - **Leaving keeps the answers**, and says so (`study.leaveKept`).
 *
 * Which questions a drill contains is the scheduler's decision (task 1.4). This
 * screen is handed a count and, at the end, the questions that came back; it
 * chooses nothing.
 *
 * DOM only (ADR-0005).
 */

import { count, text, type UiLocale } from './copy';
import { button, element, replaceChildren } from './dom';
import { createScreen, type Screen } from './screen';

/** What the screen is showing. The drill itself is not one of these: the card is. */
export type StudyState =
  | { readonly kind: 'ready'; readonly available: number; readonly drillSize: number }
  | { readonly kind: 'empty' }
  /** `TN-STUDY-03`: the bank could not be loaded. The message is content. */
  | { readonly kind: 'error'; readonly message: string }
  | {
      readonly kind: 'summary';
      readonly correct: number;
      readonly total: number;
      /** Wording, never an id (`TN-STUDY-04`). */
      readonly returning: readonly string[];
    };

export interface StudyScreenOptions {
  readonly locale: UiLocale;
  readonly announce?: (message: string) => void;
  readonly onStart?: () => void;
  /** `TN-STUDY-03`: practise anyway, from the empty state. */
  readonly onPractiseNew?: () => void;
  readonly onRetry?: () => void;
  readonly onAgain?: () => void;
  /** "Back to the game", and Escape. */
  readonly onExit?: () => void;
  readonly singleSwitch?: boolean;
  readonly holdMs?: number;
  readonly now?: () => number;
}

export interface StudyScreen {
  readonly element: HTMLElement;
  readonly visible: boolean;
  readonly state: StudyState;
  show(state: StudyState): void;
  setState(state: StudyState): void;
  hide(): void;
  setLocale(locale: UiLocale): void;
  setSingleSwitch(enabled: boolean, holdMs?: number): void;
  /** `TN-STUDY-05`: the player left part-way and the answers were kept. */
  showLeftNotice(): void;
  destroy(): void;
}

export function createStudyScreen(
  host: HTMLElement,
  options: StudyScreenOptions,
): StudyScreen {
  const doc = host.ownerDocument;
  let locale = options.locale;
  let state: StudyState = { kind: 'empty' };

  const screen: Screen = createScreen(host, {
    id: 'tn-study',
    testId: 'study-screen',
    locale,
    ...(options.onExit === undefined ? {} : { onEscape: options.onExit }),
    ...(options.announce === undefined ? {} : { announce: options.announce }),
    switch: {
      enabled: options.singleSwitch === true,
      holdMs: options.holdMs ?? 600,
      ...(options.now === undefined ? {} : { now: options.now }),
    },
  });

  const title = element(doc, 'h1', { id: 'tn-study-title', text: text(locale, 'study.title') });
  screen.labelledBy(title);

  const panel = element(doc, 'div', { className: 'tn-screen__row' });
  const actions = element(doc, 'div', { className: 'tn-screen__actions' });
  screen.card.append(title, panel, actions);

  return {
    element: screen.element,
    get visible(): boolean {
      return screen.visible;
    },
    get state(): StudyState {
      return state;
    },

    show(next): void {
      /* Open first, then render: the summary moves focus to itself, and it can
         only do that once the screen is on the page (`TN-STUDY-08`). */
      screen.show();
      state = next;
      render();
      screen.refreshSwitch();
    },

    setState(next): void {
      state = next;
      render();
      screen.refreshSwitch();
    },

    hide(): void {
      screen.hide();
    },

    setLocale(next): void {
      locale = next;
      screen.setLocale(next);
      title.textContent = text(next, 'study.title');
      render();
    },

    setSingleSwitch(enabled, holdMs): void {
      screen.setSwitchEnabled(enabled, holdMs);
    },

    showLeftNotice(): void {
      const message = text(locale, 'study.leaveKept');
      /* Said once, however many times the player leaves: a second copy of the
         same sentence stacked under the first reads as a second event. */
      const existing = panel.querySelector<HTMLElement>('[data-testid="study-left-notice"]');
      if (existing !== null) existing.textContent = message;
      else panel.append(element(doc, 'p', { testId: 'study-left-notice', text: message }));
      options.announce?.(message);
    },

    destroy(): void {
      screen.destroy();
    },
  };

  function render(): void {
    switch (state.kind) {
      case 'ready':
        return renderReady(state.available, state.drillSize);
      case 'empty':
        return renderEmpty();
      case 'error':
        return renderError(state.message);
      case 'summary':
        return renderSummary(state.correct, state.total, state.returning);
    }
  }

  function renderReady(available: number, drillSize: number): void {
    title.textContent = text(locale, 'study.title');
    const intro = element(doc, 'p', { text: text(locale, 'study.intro') });
    screen.describedBy(intro);

    /*
     * "A drill can be shorter than the drill size": the player is told, in
     * words, rather than the drill being padded with repeats (`TN-STUDY-02`).
     */
    /*
     * `count(...)` and not `text(...)`: `study.count` and `study.short` are two
     * rows each, and the form is chosen by `Intl.PluralRules` for the active
     * locale. English and French disagree at zero and again below two, so the
     * `n === 1` this screen used to be one refactor away from would draw
     * "1 questions" in English and « 0 questions » in French. The type makes the
     * mistake unavailable: `text` cannot name a plural row.
     */
    const size = Math.min(available, drillSize);
    const summary =
      available < drillSize
        ? element(doc, 'p', {
            testId: 'study-count',
            text: count(locale, 'study.short', available),
          })
        : element(doc, 'p', {
            testId: 'study-count',
            text: count(locale, 'study.count', size),
          });

    replaceChildren(panel, [intro, summary]);
    replaceChildren(actions, [
      button(doc, {
        testId: 'study-start',
        text: text(locale, 'study.start'),
        ...(options.onStart === undefined ? {} : { onClick: options.onStart }),
      }),
      exitButton(),
    ]);
  }

  function renderEmpty(): void {
    const heading = element(doc, 'h2', {
      testId: 'study-empty-title',
      text: text(locale, 'study.empty.title'),
    });
    const body = element(doc, 'p', { text: text(locale, 'study.empty.body') });
    screen.describedBy(body);

    const empty = element(doc, 'div', {
      testId: 'study-empty',
      className: 'tn-screen__row',
      children: [heading, body],
    });

    replaceChildren(panel, [empty]);
    replaceChildren(actions, [
      button(doc, {
        testId: 'study-practise-new',
        text: text(locale, 'study.empty.practise'),
        ...(options.onPractiseNew === undefined ? {} : { onClick: options.onPractiseNew }),
      }),
      exitButton(),
    ]);
  }

  /** The message is content: this screen shows what it is given and writes none. */
  function renderError(message: string): void {
    const body = element(doc, 'p', { testId: 'study-error', text: message });
    screen.describedBy(body);
    replaceChildren(panel, [body]);
    replaceChildren(actions, [
      button(doc, {
        testId: 'study-retry',
        /* `study.error.retry` is the same two words as `level.error.retry` and a
           separate key on purpose, so the two screens can be reworded apart. */
        text: text(locale, 'study.error.retry'),
        ...(options.onRetry === undefined ? {} : { onClick: options.onRetry }),
      }),
      exitButton(),
    ]);
    options.announce?.(message);
  }

  function renderSummary(
    correct: number,
    total: number,
    returning: readonly string[],
  ): void {
    const heading = element(doc, 'h2', {
      id: 'tn-study-summary-title',
      text: text(locale, 'study.summary.title'),
    });

    /* The first line the player hears when focus lands here (`TN-STUDY-08`). */
    const score = element(doc, 'p', {
      testId: 'study-summary-score',
      text: text(locale, 'study.summary.score', { correct, total }),
    });
    screen.describedBy(score);

    const children: HTMLElement[] = [heading, score];

    if (returning.length === 0) {
      children.push(element(doc, 'p', { text: text(locale, 'study.summary.allRight') }));
    } else {
      children.push(element(doc, 'p', { text: text(locale, 'study.summary.comeBack') }));
      children.push(
        element(doc, 'ul', {
          testId: 'study-summary-returning',
          children: returning.map((wording) => element(doc, 'li', { text: wording })),
        }),
      );
    }

    const summary = element(doc, 'div', {
      testId: 'study-summary',
      className: 'tn-screen__row',
      children,
    });
    summary.tabIndex = -1;

    replaceChildren(panel, [summary]);
    replaceChildren(actions, [
      button(doc, {
        testId: 'study-again',
        text: text(locale, 'study.again'),
        ...(options.onAgain === undefined ? {} : { onClick: options.onAgain }),
      }),
      exitButton(),
    ]);

    if (screen.visible) summary.focus();
  }

  function exitButton(): HTMLElement {
    return button(doc, {
      testId: 'study-exit',
      text: text(locale, 'study.exit'),
      ...(options.onExit === undefined ? {} : { onClick: options.onExit }),
    });
  }
}
