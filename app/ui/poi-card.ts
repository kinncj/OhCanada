/**
 * The landmark card: a short, true thing about a place the player skated up to.
 *
 * `TN-LEVEL-05` is the acceptance criteria — "a landmark tells the player
 * something true and short" — and `TN-LEVEL-11` requires the same card in
 * French, close button included.
 *
 * **No copy is written here.** The heading and the body are content
 * (`poi.parliamentHill.title`, `poi.parliamentHill.body`), they travel with the
 * level under ADR-0010, and `poi.parliamentHill.body` states a fact about Canada
 * so it goes through the same verification as a question (`OQ-LEVEL-4`). The one
 * string this file draws from the shared table is `common.close`. The heading is
 * required rather than defaulted, for the same reason the dialogue's speaker is:
 * an unnamed dialog is a defect, and a default is how one gets shipped.
 *
 * The card is modal — `TN-LEVEL-05`, "the game does not move while a card is
 * open" — and closing it puts focus back on `interact-prompt`, which is where the
 * player was.
 *
 * DOM only (ADR-0005).
 */

import { text, type UiLocale } from './copy';
import { button, element, replaceChildren } from './dom';
import { createScreen, type Screen } from './screen';

export interface PoiContent {
  /** "Parliament Hill" / « La Colline du Parlement ». Names the dialog. */
  readonly title: string;
  /** One or more paragraphs, already localised. */
  readonly body: readonly string[];
}

export interface PoiCardOptions {
  readonly locale: UiLocale;
  readonly announce?: (message: string, lang?: string) => void;
  /** Close, and Escape. The caller resumes the level. */
  readonly onClose?: () => void;
  /**
   * Where focus goes when the card closes. `TN-LEVEL-05` requires
   * `interact-prompt`, and the prompt is rebuilt whenever the offer changes, so
   * this is a function rather than an element: a remembered node would be the
   * one that was removed.
   */
  readonly restoreFocusTo?: () => HTMLElement | null;
  readonly singleSwitch?: boolean;
  readonly holdMs?: number;
  readonly now?: () => number;
}

export interface PoiCard {
  readonly element: HTMLElement;
  readonly visible: boolean;
  show(content: PoiContent): void;
  hide(): void;
  setLocale(locale: UiLocale): void;
  setSingleSwitch(enabled: boolean, holdMs?: number): void;
  destroy(): void;
}

export function createPoiCard(host: HTMLElement, options: PoiCardOptions): PoiCard {
  const doc = host.ownerDocument;
  let locale = options.locale;

  const close = (): void => {
    hide();
    options.onClose?.();
  };

  const screen: Screen = createScreen(host, {
    id: 'tn-poi-card',
    testId: 'poi-card',
    locale,
    onEscape: close,
    ...(options.announce === undefined ? {} : { announce: options.announce }),
    switch: {
      enabled: options.singleSwitch === true,
      holdMs: options.holdMs ?? 600,
      ...(options.now === undefined ? {} : { now: options.now }),
    },
  });

  const title = element(doc, 'h1', { id: 'tn-poi-card-title' });
  screen.labelledBy(title);

  const body = element(doc, 'div', { id: 'tn-poi-card-body', className: 'tn-screen__row' });
  screen.describedBy(body);

  const closeButton = button(doc, {
    testId: 'poi-card-close',
    text: text(locale, 'common.close'),
    onClick: close,
  });

  screen.card.append(
    title,
    body,
    element(doc, 'div', { className: 'tn-screen__actions', children: [closeButton] }),
  );

  function hide(): void {
    if (!screen.visible) return;
    screen.hide();
    /*
     * The trap already restores focus to whatever opened the card, which is the
     * right answer when the prompt was pressed. It is the wrong answer when the
     * card was opened by tapping the landmark on the canvas — the canvas is
     * `aria-hidden` and takes no focus, so the trap would restore to the body.
     * Naming the destination is what makes "focus returns to interact-prompt"
     * true both ways.
     */
    const destination = options.restoreFocusTo?.() ?? null;
    if (destination !== null && destination.isConnected) {
      destination.focus({ preventScroll: true });
    }
  }

  return {
    element: screen.element,
    get visible(): boolean {
      return screen.visible;
    },

    show(content): void {
      title.textContent = content.title;
      replaceChildren(
        body,
        content.body.map((paragraph) => element(doc, 'p', { text: paragraph })),
      );
      screen.show();
      screen.refreshSwitch();
    },

    hide,

    setLocale(next): void {
      locale = next;
      screen.setLocale(next);
      closeButton.textContent = text(next, 'common.close');
    },

    setSingleSwitch(enabled, holdMs): void {
      screen.setSwitchEnabled(enabled, holdMs);
    },

    destroy(): void {
      screen.destroy();
    },
  };
}
