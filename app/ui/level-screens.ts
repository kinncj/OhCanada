/**
 * The two screens a player sees instead of a level: it is opening, or it did not
 * open.
 *
 * `TN-LEVEL-01` and `TN-LEVEL-02` are the acceptance criteria, and both were
 * written against a defect this project has shipped twice. The first was a boot
 * screen that read as a stalled progress bar and was reported from two devices;
 * the second was a caption saying there was no level to play, in a panel over a
 * running level. Both times a screen described a state it was not in. So:
 *
 *  - **The loading screen shows text, not only a spinner** (`TN-LEVEL-01`), and
 *    the sentence is supplied by the caller. `level.<id>.loading` is a row in
 *    `app/ui/copy.ts`, one per level, but it stays a *required option* rather
 *    than being read here: the sentence names the work *this* level is doing —
 *    the harbour, the slope, the canal, the streets — `OQ-LEVEL-9` keeps the
 *    wording with the level that waits, and under ADR-0010 a level file will
 *    carry its own text. Required, not defaulted: a waiting screen that does not
 *    say what it is waiting for is the defect `TN-LEVEL-01` was written against,
 *    and a required option cannot silently become a placeholder.
 *  - **A stalled load can always be left** (`TN-LEVEL-02`). The escape is a
 *    focusable "Go back" button, and it is the one timer this directory allows:
 *    a load timeout is not a player timer, nothing about it counts down on
 *    screen, and the player loses nothing by ignoring it.
 *  - **The error screen names the level that failed** (`TN-WAIT-02`) and offers
 *    both ways on, "Try again" and "Go back". The two buttons and the body are
 *    the same on every level and are read from `level.error.*`; the **title** is
 *    the caller's, for the same reason the waiting sentence is. It used to read
 *    one row called `level.error.title`, which said "We could not load Ottawa."
 *    on all four levels — a screen naming a place the player was not going to.
 *    `TN-WAIT` writes one title per level and this screen takes one as data, so
 *    the wrong level cannot be named by a screen that has never heard of it.
 *
 * Neither screen announces itself. Both are dialogs: they take focus, and a
 * screen reader reads a dialog on arrival. The live region speaks for what has
 * no focus to take — see `app/ui/level-events.ts`, which announces
 * `level/failed` once.
 *
 * DOM only (ADR-0005).
 */

import { text, type UiLocale } from './copy';
import { button, element, replaceChildren } from './dom';
import { createScreen, type Screen } from './screen';

/**
 * The two strings the waiting screen draws that belong to a level rather than to
 * this directory, in one shape so that a language change cannot bring half of
 * them across.
 */
export interface LevelLoadingText {
  /**
   * What the player reads while the level opens, already localised. Required:
   * see the note above. `TN-COPY-07`'s waiting rule binds whatever is passed —
   * it names the work and claims no progress the game cannot measure: no
   * percentage, no fraction, no "2 of 4", no ellipsis, no bar carrying a value.
   * It is drawn once and never rewritten while the load runs; the escape route
   * below appears *beside* it, never in place of it.
   */
  readonly message: string;
  /** Names the dialog: the level's title, already localised. */
  readonly title: string;
}

export interface LevelLoadingOptions extends LevelLoadingText {
  readonly locale: UiLocale;
  /**
   * `TN-LEVEL-02`: after twice the time-to-play budget with no level, a way out.
   * Without a handler no escape is offered, because a button that leads nowhere
   * is worse than no button.
   */
  readonly onBack?: () => void;
  /**
   * How long to wait before offering the escape. Omitted, the caller decides by
   * calling {@link LevelLoading.offerEscape} — the composition root already
   * watches the load, and two watchdogs disagreeing is worse than one.
   */
  readonly stallAfterMs?: number;
  readonly singleSwitch?: boolean;
  readonly holdMs?: number;
  readonly now?: () => number;
}

export interface LevelLoading {
  readonly element: HTMLElement;
  readonly visible: boolean;
  show(): void;
  hide(): void;
  /** Reveal the escape now, whatever the timer thinks. */
  offerEscape(): void;
  /**
   * The player changed language. The level's own two strings come back with it:
   * they are data this screen cannot re-resolve, and a required parameter is
   * what stops a French player being left with an English sentence in front of
   * a French button.
   */
  setLocale(locale: UiLocale, words: LevelLoadingText): void;
  destroy(): void;
}

export function createLevelLoading(
  host: HTMLElement,
  options: LevelLoadingOptions,
): LevelLoading {
  const doc = host.ownerDocument;
  let locale = options.locale;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const screen: Screen = createScreen(host, {
    id: 'tn-level-loading',
    testId: 'level-loading',
    locale,
    switch: {
      enabled: options.singleSwitch === true,
      holdMs: options.holdMs ?? 600,
      ...(options.now === undefined ? {} : { now: options.now }),
    },
  });

  const title = element(doc, 'h1', { id: 'tn-level-loading-title', text: options.title });
  screen.labelledBy(title);

  const message = element(doc, 'p', {
    id: 'tn-level-loading-message',
    text: options.message,
  });
  screen.describedBy(message);

  const actions = element(doc, 'div', { className: 'tn-screen__actions' });
  screen.card.append(title, message, actions);

  const clearTimer = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  const offerEscape = (): void => {
    if (options.onBack === undefined) return;
    if (actions.querySelector('[data-testid="level-loading-back"]') !== null) return;
    replaceChildren(actions, [
      button(doc, {
        testId: 'level-loading-back',
        text: text(locale, 'level.error.back'),
        onClick: options.onBack,
      }),
    ]);
    screen.refreshSwitch();
  };

  return {
    element: screen.element,
    get visible(): boolean {
      return screen.visible;
    },

    show(): void {
      screen.show();
      clearTimer();
      if (options.stallAfterMs !== undefined && options.onBack !== undefined) {
        timer = setTimeout(offerEscape, options.stallAfterMs);
      }
    },

    hide(): void {
      clearTimer();
      screen.hide();
    },

    offerEscape,

    setLocale(next, words): void {
      locale = next;
      screen.setLocale(next);
      title.textContent = words.title;
      message.textContent = words.message;
      const back = actions.querySelector<HTMLElement>('[data-testid="level-loading-back"]');
      if (back !== null) back.textContent = text(next, 'level.error.back');
    },

    destroy(): void {
      clearTimer();
      screen.destroy();
    },
  };
}

export interface LevelErrorOptions {
  readonly locale: UiLocale;
  /**
   * "We could not load Halifax." — `level.<id>.error.title` for the level that
   * failed, already localised, and the dialog's accessible name.
   *
   * Required and never defaulted (`TN-WAIT-02`, `TN-WAIT-03`): the name of this
   * card is the one thing on it that differs between levels, and the row it
   * comes from is written out per level rather than composed, because French
   * does not use one article for all ten places. A card that could be built
   * without a title is a card that names the last level somebody wrote a story
   * for, which is the defect (`TN-WAIT`'s opening paragraph).
   */
  readonly title: string;
  /** `TN-LEVEL-02`: try again once the network is back. */
  readonly onRetry?: () => void;
  /** Leave the level without reloading the page. */
  readonly onBack?: () => void;
  readonly singleSwitch?: boolean;
  readonly holdMs?: number;
  readonly now?: () => number;
}

export interface LevelError {
  readonly element: HTMLElement;
  readonly visible: boolean;
  show(): void;
  hide(): void;
  /**
   * The player changed language. The title comes back with it — required, for
   * the reason it is required at construction: this screen cannot look up a row
   * it was handed as data, and the card is usually built before it is shown, so
   * a title left in the old language would surface at the worst moment.
   */
  setLocale(locale: UiLocale, title: string): void;
  setSingleSwitch(enabled: boolean, holdMs?: number): void;
  destroy(): void;
}

export function createLevelError(host: HTMLElement, options: LevelErrorOptions): LevelError {
  const doc = host.ownerDocument;
  let locale = options.locale;

  const screen: Screen = createScreen(host, {
    id: 'tn-level-error',
    testId: 'level-error',
    locale,
    /*
     * `alertdialog`, not `dialog`: the level failed to open and this interrupted
     * the player rather than being asked for. Escape has nowhere useful to go —
     * dismissing it would leave a blank page with no level and no way back — so
     * it is deliberately not escapable and both routes onward are buttons.
     */
    role: 'alertdialog',
    switch: {
      enabled: options.singleSwitch === true,
      holdMs: options.holdMs ?? 600,
      ...(options.now === undefined ? {} : { now: options.now }),
    },
  });

  const title = element(doc, 'h1', {
    id: 'tn-level-error-title',
    text: options.title,
  });
  screen.labelledBy(title);

  const body = element(doc, 'p', {
    id: 'tn-level-error-body',
    text: text(locale, 'level.error.body'),
  });
  screen.describedBy(body);

  const retry = button(doc, {
    testId: 'level-retry',
    text: text(locale, 'level.error.retry'),
    ...(options.onRetry === undefined ? {} : { onClick: options.onRetry }),
  });
  const back = button(doc, {
    testId: 'level-back',
    text: text(locale, 'level.error.back'),
    ...(options.onBack === undefined ? {} : { onClick: options.onBack }),
  });

  screen.card.append(
    title,
    body,
    element(doc, 'div', { className: 'tn-screen__actions', children: [retry, back] }),
  );

  return {
    element: screen.element,
    get visible(): boolean {
      return screen.visible;
    },
    show(): void {
      screen.show();
      screen.refreshSwitch();
    },
    hide(): void {
      screen.hide();
    },
    setLocale(next, nextTitle): void {
      locale = next;
      screen.setLocale(next);
      title.textContent = nextTitle;
      body.textContent = text(next, 'level.error.body');
      retry.textContent = text(next, 'level.error.retry');
      back.textContent = text(next, 'level.error.back');
    },
    setSingleSwitch(enabled, holdMs): void {
      screen.setSwitchEnabled(enabled, holdMs);
    },
    destroy(): void {
      screen.destroy();
    },
  };
}
