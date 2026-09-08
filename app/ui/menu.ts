/**
 * The menu the HUD's Menu button opens: Settings, Study, the passport, Close.
 *
 * `TN-HUD-02` is the acceptance criteria. Two of its scenarios decide the shape
 * of this file:
 *
 *  - **"One screen at a time."** Choosing an item closes the menu *before* the
 *    screen it asked for opens, so the page never holds two dialogs. Doing it in
 *    that order is also what makes the next scenario work by construction rather
 *    than by a stored reference: the menu's focus trap restores focus to
 *    `menu-button` as it closes, so the screen that opens next remembers
 *    `menu-button` as *its* return point — and "closing Settings returns focus to
 *    menu-button, and the menu is not shown again" needs no code at all.
 *  - **"The game does not resume behind an open screen."** Dismissing the menu
 *    resumes; choosing an item does not. They are two different callbacks
 *    ({@link MenuOptions.onDismiss} and the item's own), because one callback
 *    with a boolean is one call site away from resuming the level under an open
 *    settings screen.
 *
 * Nothing here counts down and nothing scans: `TN-HUD-02`, "the menu is
 * unchanged after two minutes and nothing has been chosen for me".
 *
 * DOM only (ADR-0005).
 */

import { text, type CopyKey, type UiLocale } from './copy';
import { button, element, replaceChildren } from './dom';
import { createScreen, type Screen } from './screen';

export interface MenuOptions {
  readonly locale: UiLocale;
  readonly announce?: (message: string, lang?: string) => void;
  /** `common.settings` — the control that opens the settings screen. */
  readonly onOpenSettings?: () => void;
  /** `study.open`. */
  readonly onOpenStudy?: () => void;
  /** `passport.open`. `OQ-HUD-2` keeps this item in slice 1. */
  readonly onOpenPassport?: () => void;
  /**
   * Close, or Escape: the player asked for nothing and the level resumes.
   * Never called when an item was chosen — the screen that opened owns the
   * resume from then on.
   */
  readonly onDismiss?: () => void;
  readonly singleSwitch?: boolean;
  readonly holdMs?: number;
  readonly now?: () => number;
}

export interface Menu {
  readonly element: HTMLElement;
  readonly visible: boolean;
  open(): void;
  close(): void;
  setLocale(locale: UiLocale): void;
  setSingleSwitch(enabled: boolean, holdMs?: number): void;
  destroy(): void;
}

interface Item {
  readonly key: CopyKey;
  readonly testId: string;
  readonly handler: (() => void) | undefined;
}

export function createMenu(host: HTMLElement, options: MenuOptions): Menu {
  const doc = host.ownerDocument;
  let locale = options.locale;

  const screen: Screen = createScreen(host, {
    id: 'tn-menu',
    testId: 'menu',
    locale,
    onEscape: () => dismiss(),
    ...(options.announce === undefined ? {} : { announce: options.announce }),
    switch: {
      enabled: options.singleSwitch === true,
      holdMs: options.holdMs ?? 600,
      ...(options.now === undefined ? {} : { now: options.now }),
    },
  });

  /* `hud.menu.title` — the dialog's accessible name is the word the player
     pressed, so what they see and what they hear are the same thing. */
  const title = element(doc, 'h1', {
    id: 'tn-menu-title',
    text: text(locale, 'hud.menu.title'),
  });
  screen.labelledBy(title);

  const actions = element(doc, 'div', { className: 'tn-screen__actions' });
  screen.card.append(title, actions);

  const items = (): readonly Item[] => [
    { key: 'common.settings', testId: 'menu-settings', handler: options.onOpenSettings },
    { key: 'study.open', testId: 'menu-study', handler: options.onOpenStudy },
    { key: 'passport.open', testId: 'menu-passport', handler: options.onOpenPassport },
  ];

  const render = (): void => {
    title.textContent = text(locale, 'hud.menu.title');
    replaceChildren(actions, [
      ...items().map((item) =>
        button(doc, {
          testId: item.testId,
          /* Every item has a visible label, not an icon alone (TN-HUD-02). */
          text: text(locale, item.key),
          onClick: () => choose(item.handler),
        }),
      ),
      button(doc, {
        testId: 'menu-close',
        text: text(locale, 'common.close'),
        onClick: () => dismiss(),
      }),
    ]);
  };

  render();

  /** One screen at a time: the menu is gone before the next one arrives. */
  function choose(handler: (() => void) | undefined): void {
    screen.hide();
    handler?.();
  }

  function dismiss(): void {
    screen.hide();
    options.onDismiss?.();
  }

  return {
    element: screen.element,
    get visible(): boolean {
      return screen.visible;
    },
    open(): void {
      screen.show();
      screen.refreshSwitch();
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
