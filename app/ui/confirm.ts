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

    replaceChildren(actions, [
      button(doc, {
        testId: options.confirmTestId,
        text: text(locale, options.confirmKey),
        attrs: { 'data-tn-action': 'primary' },
        onClick: () => {
          screen.hide();
          options.onConfirm();
        },
      }),
      button(doc, {
        testId: options.cancelTestId,
        text: text(locale, options.cancelKey),
        attrs: { 'data-tn-action': 'quiet' },
        onClick: () => {
          cancel();
        },
      }),
    ]);
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
    },

    setSingleSwitch(enabled, holdMs): void {
      screen.setSwitchEnabled(enabled, holdMs);
    },

    destroy(): void {
      screen.destroy();
    },
  };
}
