/**
 * The scaffolding every slice-1 DOM screen shares: a named, focus-contained,
 * escapable surface with a single-switch ring over it.
 *
 * Written once because the five screens make the same five promises, and a
 * promise kept in four places out of five is the one a player finds. In
 * particular `aria-modal="true"` is set *here*, next to the call that activates
 * `app/ui/focus-trap` — the attribute and its containment are never separable,
 * which is the same discipline `rotate-overlay.ts` applies.
 *
 * DOM only (ADR-0005).
 */

import { createFocusTrap, type FocusTrap } from './focus-trap';
import { type UiLocale } from './copy';
import { createSwitchRing, type SwitchRing } from './single-switch';
import { injectScreenStyles } from './screen-styles';

export interface ScreenSwitchOptions {
  readonly enabled: boolean;
  readonly holdMs: number;
  readonly now?: () => number;
}

export interface ScreenOptions {
  /** DOM id, e.g. `tn-settings`. */
  readonly id: string;
  /** `data-testid`, from the table in `docs/stories/README.md`. */
  readonly testId: string;
  readonly locale: UiLocale;
  /** `dialog` unless the surface interrupts with a message, then `alertdialog`. */
  readonly role?: 'dialog' | 'alertdialog';
  /** Escape and the Close control both route here. */
  readonly onEscape?: () => void;
  /** The one live region (`app/ui/live-region.ts`). Screens never make a second. */
  readonly announce?: (message: string) => void;
  readonly switch?: ScreenSwitchOptions;
  /** Extra class on the root, for the screen's own layout. */
  readonly className?: string;
}

export interface Screen {
  readonly element: HTMLElement;
  /** Where a screen puts its content; the root only carries the dialog semantics. */
  readonly card: HTMLElement;
  readonly visible: boolean;
  readonly ring: SwitchRing;
  show(): void;
  hide(): void;
  /** Point the accessible name at an element inside the card. */
  labelledBy(element: HTMLElement): void;
  /** Point the accessible description at an element inside the card. */
  describedBy(element: HTMLElement | null): void;
  setLocale(locale: UiLocale): void;
  /** Re-read the switch ring after the card's contents changed. */
  refreshSwitch(): void;
  setSwitchEnabled(enabled: boolean, holdMs?: number): void;
  destroy(): void;
}

let sequence = 0;

export function createScreen(host: HTMLElement, options: ScreenOptions): Screen {
  const doc = host.ownerDocument;
  injectScreenStyles(doc);

  sequence += 1;
  const element = doc.createElement('div');
  element.id = options.id;
  element.className = `tn-screen${options.className === undefined ? '' : ` ${options.className}`}`;
  element.setAttribute('data-testid', options.testId);
  element.setAttribute('role', options.role ?? 'dialog');
  /* Backed by the trap below, and only meaningful because of it. */
  element.setAttribute('aria-modal', 'true');
  element.setAttribute('lang', options.locale);
  element.tabIndex = -1;
  element.hidden = true;

  const card = doc.createElement('div');
  card.className = 'tn-screen__card';
  element.append(card);
  host.append(element);

  const trap: FocusTrap = createFocusTrap(element);
  let switchOptions: ScreenSwitchOptions = options.switch ?? { enabled: false, holdMs: 600 };
  const ring = createSwitchRing(element, {
    /* Read at each press, so `setSwitchEnabled` can change the threshold under a live ring. */
    holdMs: () => switchOptions.holdMs,
    ...(switchOptions.now === undefined ? {} : { now: switchOptions.now }),
    ...(options.announce === undefined ? {} : { announce: options.announce }),
  });

  let visible = false;

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    if (!visible || options.onEscape === undefined) return;
    event.preventDefault();
    options.onEscape();
  };

  element.addEventListener('keydown', onKeyDown);

  const applySwitch = (): void => {
    if (visible && switchOptions.enabled) {
      ring.enable();
      ring.highlight(0);
    } else {
      ring.disable();
    }
  };

  return {
    element,
    card,
    ring,
    get visible(): boolean {
      return visible;
    },

    show(): void {
      if (visible) return;
      visible = true;
      /* `hidden` off first: focus cannot land on a hidden element. */
      element.hidden = false;
      trap.activate();
      applySwitch();
    },

    hide(): void {
      if (!visible) return;
      visible = false;
      ring.disable();
      /*
       * Release before hiding. The trap restores focus to whatever opened the
       * screen, and `hidden` on an ancestor of the focused element would drop
       * focus on `<body>` first, which is the "focus never falls to the body"
       * failure `TN-STUDY-06` names.
       */
      trap.release();
      element.hidden = true;
    },

    labelledBy(target: HTMLElement): void {
      if (target.id === '') target.id = `${options.id}-label-${String(sequence)}`;
      element.setAttribute('aria-labelledby', target.id);
    },

    describedBy(target: HTMLElement | null): void {
      if (target === null) {
        element.removeAttribute('aria-describedby');
        return;
      }
      if (target.id === '') target.id = `${options.id}-description-${String(sequence)}`;
      element.setAttribute('aria-describedby', target.id);
    },

    setLocale(locale: UiLocale): void {
      element.setAttribute('lang', locale);
    },

    refreshSwitch(): void {
      if (!visible || !switchOptions.enabled) return;
      ring.refresh();
      /* A re-render can take the highlighted item off the page. Landing on the
         first item is better than leaving a switch user with no highlight and
         no way to tell that their press did anything. */
      if (ring.index === -1) ring.highlight(0);
    },

    setSwitchEnabled(enabled: boolean, holdMs?: number): void {
      switchOptions = {
        enabled,
        holdMs: holdMs ?? switchOptions.holdMs,
        ...(switchOptions.now === undefined ? {} : { now: switchOptions.now }),
      };
      applySwitch();
    },

    destroy(): void {
      element.removeEventListener('keydown', onKeyDown);
      ring.destroy();
      trap.release();
      visible = false;
      element.remove();
    },
  };
}
