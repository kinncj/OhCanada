/**
 * The menu the HUD's Menu button opens: the task in full, then Settings, Study,
 * the passport, "About this place", leaving, and Close.
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

import { labelled, text, type CopyKey, type UiLocale } from './copy';
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
   * `flow.leaveLevel` — the way out of a level, to the level select
   * (`TN-FLOW-03`). Absent draws no item, which is `TN-HUD-02`'s "leaving is not
   * offered where there is nothing to leave": the same rule every other item
   * here follows, and the reason a menu opened anywhere but over a level cannot
   * offer it.
   */
  readonly onLeaveLevel?: () => void;
  /**
   * `about.open` — the "About this place" panel (`docs/content-review.md`
   * §10.2), which states whose land this level stands on.
   *
   * §10.2 fixes the panel as reachable "from the pause menu and from the credits
   * screen", and the pause menu is this. Absent draws no item, on the same rule
   * as {@link MenuOptions.onLeaveLevel}: a menu opened anywhere but over a level
   * has no place to be about, and an item that opened an empty panel would be
   * worse than no item.
   *
   * It sits **after** the passport and **before** leaving, because it is about
   * the place the player is standing in and the way out belongs last.
   */
  readonly onOpenAbout?: () => void;
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
  /**
   * `menu-task`: the task sentence in full, or `null` for none (ADR-0066 §2).
   *
   * The strip draws the task as a count while an offer is up, and this is where
   * the sentence always is — a sheet that scrolls, one press away and already in
   * the single-switch ring. A paragraph, never an item: it is read, not chosen.
   */
  setTask(step: string | null): void;
  setSingleSwitch(enabled: boolean, holdMs?: number): void;
  destroy(): void;
}

interface Item {
  readonly key: CopyKey;
  readonly testId: string;
  readonly handler: (() => void) | undefined;
  /**
   * Drawn only when the caller wired it.
   *
   * Settings, Study and the passport are true wherever the menu is opened, so
   * they are drawn whatever the caller passed. "Leave the level" and "About this
   * place" are only true over a level — `TN-HUD-02`'s "leaving is not offered
   * where there is nothing to leave", and §10.2's panel is per level.
   */
  readonly onlyWithHandler?: true;
}

export function createMenu(host: HTMLElement, options: MenuOptions): Menu {
  const doc = host.ownerDocument;
  let locale = options.locale;
  let task: string | null = null;

  const screen: Screen = createScreen(host, {
    id: 'tn-menu',
    testId: 'menu',
    locale,
    /* A sheet over the paused level, hugging its title and its items (ADR-0045),
       not a full white page with the items at the bottom of a blank column. The
       level stays in view above it, dimmed, as it does behind the landmark card
       (ADR-0041). */
    className: 'tn-screen--sheet',
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
  /* The task's permanent home (ADR-0066 §2), between the title and the items so
     it is read before the ways out. Hidden, not merely empty, while there is no
     task: an empty paragraph is a box with nothing in it. */
  const taskLine = element(doc, 'p', {
    testId: 'menu-task',
    className: 'tn-screen__menu-task',
  });
  taskLine.hidden = true;
  screen.card.append(title, taskLine, actions);

  const items = (): readonly Item[] =>
    (
      [
        { key: 'common.settings', testId: 'menu-settings', handler: options.onOpenSettings },
        { key: 'study.open', testId: 'menu-study', handler: options.onOpenStudy },
        { key: 'passport.open', testId: 'menu-passport', handler: options.onOpenPassport },
        /* `about-this-place-open`, not `menu-about`: `docs/stories/README.md`
           names this control in the shared vocabulary, and the id is the
           contract a scenario references. */
        {
          key: 'about.open',
          testId: 'about-this-place-open',
          handler: options.onOpenAbout,
          onlyWithHandler: true,
        },
        {
          key: 'flow.leaveLevel',
          testId: 'menu-leave',
          handler: options.onLeaveLevel,
          onlyWithHandler: true,
        },
      ] as Item[]
      /* Three of the five are always wired by the HUD's caller; two are only
         true over a level, and an unwired one of those is not drawn. */
    ).filter((item) => item.onlyWithHandler !== true || item.handler !== undefined);

  const renderTask = (): void => {
    taskLine.hidden = task === null;
    taskLine.textContent = task === null ? '' : labelled(locale, text(locale, 'hud.menu.task'), task);
  };

  const render = (): void => {
    title.textContent = text(locale, 'hud.menu.title');
    renderTask();
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
        /* Quiet, as the exam menu's Close is: the way back, not a place to go. */
        attrs: { 'data-tn-action': 'quiet' },
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
    setTask(step): void {
      if (step === task) return;
      task = step;
      renderTask();
    },
    setSingleSwitch(enabled, holdMs): void {
      screen.setSwitchEnabled(enabled, holdMs);
    },
    destroy(): void {
      screen.destroy();
    },
  };
}
