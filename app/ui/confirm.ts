/**
 * A confirmation: a question, two answers, and no third way out that does
 * something.
 *
 * Exam mode is the first part of this game that needs one at all, and it needs
 * exactly three — the unanswered questions before finishing (`TN-EXAM-04`), the
 * unfinished exam before starting a new one (`TN-ATTEMPT-04`, "the one
 * destructive choice in this game") and leaving an exam in a browser that cannot
 * keep it (`TN-ATTEMPT-05`). Written once, because three dialogs that all have
 * to move focus into themselves, name what they are asking, and let Escape mean
 * "no" is three chances to get one of them wrong.
 *
 * ## `alertdialog`, and what that buys
 *
 * `role="alertdialog"` with a name and a **description**: the name is the
 * question, the description is what taking the action costs. `TN-ATTEMPT-08`
 * asks for exactly that — "its description says the unfinished exam will be
 * gone" — and it is the difference between a screen reader announcing "dialog"
 * and announcing what is about to happen.
 *
 * ## Escape is always "no"
 *
 * Never "yes", and never "nothing". `TN-ATTEMPT-06`: "Escape cancels it, and
 * cancelling returns focus to 'Start a new exam'". The focus restore is the
 * trap's, so it happens whether the player pressed Escape, the cancel control,
 * or closed it some way nobody has thought of yet.
 *
 * ## Nothing here counts down
 *
 * `TN-ATTEMPT-07`: "when I do nothing for two minutes, nothing has been
 * confirmed or cancelled". True by construction — there is no scheduling
 * primitive in this file, and `tests/unit/ui/no-second-countdown.test.ts` reads
 * it to make sure one does not arrive.
 *
 * DOM only (ADR-0005).
 */

import { text, type CopyKey, type UiLocale } from './copy';
import { button, element, replaceChildren } from './dom';
import { createScreen, type Screen } from './screen';

/** The question and its consequence, in the player's language. */
export interface ConfirmText {
  /** The question. Becomes the dialog's accessible name. */
  readonly title: string;
  /** What it costs. Becomes the dialog's accessible description. */
  readonly body?: string;
}

export interface ConfirmOptions {
  /** DOM id, e.g. `tn-exam-unanswered`. */
  readonly id: string;
  /** `data-testid`, from the table in `docs/stories/README.md`. */
  readonly testId: string;
  readonly locale: UiLocale;
  /** Recomputed on every open and every language change, so a count stays true. */
  readonly describe: (locale: UiLocale) => ConfirmText;
  readonly confirmKey: CopyKey;
  readonly confirmTestId: string;
  readonly cancelKey: CopyKey;
  readonly cancelTestId: string;
  readonly announce?: (message: string, lang?: string) => void;
  readonly onConfirm: () => void;
  /** Escape, the cancel control, or anything else that closes it without a yes. */
  readonly onCancel: () => void;
  readonly singleSwitch?: boolean;
  readonly holdMs?: number;
  readonly now?: () => number;
}

export interface Confirm {
  readonly element: HTMLElement;
  readonly visible: boolean;
  open(): void;
  close(): void;
  setLocale(locale: UiLocale): void;
  setSingleSwitch(enabled: boolean, holdMs?: number): void;
  destroy(): void;
}

export function createConfirm(host: HTMLElement, options: ConfirmOptions): Confirm {
  const doc = host.ownerDocument;
  let locale = options.locale;
  /* Tracked here as well as in the screen, because the screen does not report
     it and the highlight below must not move when the switch is off. */
  let switchEnabled = options.singleSwitch === true;
  /** The safe answer, kept so the switch can open on it. Rebuilt by `render`. */
  let cancelControl: HTMLElement | null = null;

  const screen: Screen = createScreen(host, {
    id: options.id,
    testId: options.testId,
    locale,
    role: 'alertdialog',
    onEscape: () => {
      cancel();
    },
    ...(options.announce === undefined ? {} : { announce: (message: string) => { options.announce?.(message, locale); } }),
    switch: {
      enabled: options.singleSwitch === true,
      holdMs: options.holdMs ?? 600,
      ...(options.now === undefined ? {} : { now: options.now }),
    },
  });

  const title = element(doc, 'h2', { id: `${options.id}-title` });
  const body = element(doc, 'p', { id: `${options.id}-body`, className: 'tn-screen__help' });
  const actions = element(doc, 'div', { className: 'tn-screen__actions' });
  screen.card.append(title, body, actions);
  screen.labelledBy(title);

  render();

  function render(): void {
    const content = options.describe(locale);
    title.textContent = content.title;
    if (content.body === undefined || content.body === '') {
      body.hidden = true;
      body.textContent = '';
      screen.describedBy(null);
    } else {
      body.hidden = false;
      body.textContent = content.body;
      screen.describedBy(body);
    }

    /* Drawn in this order — the answer first, the safe one second — because
       `TN-SAVE-06` and `TN-EXAM-04` print the two answers in it. Which one the
       *switch* opens on is a separate question, answered by
       `highlightSafeAnswer` below. */
    const confirmControl = button(doc, {
      testId: options.confirmTestId,
      text: text(locale, options.confirmKey),
      attrs: { 'data-tn-action': 'primary' },
      onClick: () => {
        screen.hide();
        options.onConfirm();
      },
    });
    cancelControl = button(doc, {
      testId: options.cancelTestId,
      text: text(locale, options.cancelKey),
      attrs: { 'data-tn-action': 'quiet' },
      onClick: () => {
        cancel();
      },
    });
    replaceChildren(actions, [confirmControl, cancelControl]);
  }

  /**
   * Open the single-switch highlight on the **safe** answer.
   *
   * `createScreen` highlights the first item in the ring, which is the right
   * default everywhere else and is wrong here: the first item is the answer
   * that does the thing, so a switch user whose first press is a fraction too
   * long would confirm it. `TN-SAVE-08` requires it of the delete question in
   * so many words — "the highlight starts on 'Keep my progress'" — and every
   * confirmation in this game asks something whose yes costs a player
   * something they cannot get back, so it is the behaviour of the shared
   * dialog rather than a flag each caller has to remember. `single-switch.ts`
   * already treats a long press with nothing highlighted as an advance for the
   * same reason.
   *
   * `TN-SAVE`'s "the highlight position starts at the first item" is about what
   * a *reload* does not restore, and is not a claim about which control a
   * confirmation opens on.
   *
   * Re-applied after a re-render, because `refreshSwitch` cannot find the item
   * it was on once `render` has replaced both buttons and falls back to the
   * first.
   */
  function highlightSafeAnswer(): void {
    if (!switchEnabled || !screen.visible || cancelControl === null) return;
    const at = screen.ring.items.indexOf(cancelControl);
    if (at >= 0) screen.ring.highlight(at);
  }

  function cancel(): void {
    if (!screen.visible) return;
    screen.hide();
    options.onCancel();
  }

  return {
    element: screen.element,
    get visible(): boolean {
      return screen.visible;
    },

    open(): void {
      render();
      screen.show();
      screen.refreshSwitch();
      highlightSafeAnswer();
      /*
       * The question, once. It is the dialog's own name as well, so a screen
       * reader that reads the dialog on arrival hears it twice at worst and
       * never nothing — which is the failure that matters here.
       */
      const spoken = options.describe(locale);
      options.announce?.(
        spoken.body === undefined ? spoken.title : `${spoken.title} ${spoken.body}`,
        locale,
      );
    },

    close(): void {
      screen.hide();
    },

    setLocale(next): void {
      locale = next;
      screen.setLocale(next);
      render();
      screen.refreshSwitch();
      highlightSafeAnswer();
    },

    setSingleSwitch(enabled, holdMs): void {
      switchEnabled = enabled;
      screen.setSwitchEnabled(enabled, holdMs);
      highlightSafeAnswer();
    },

    destroy(): void {
      screen.destroy();
    },
  };
}
