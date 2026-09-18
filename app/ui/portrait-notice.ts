/**
 * "This game works best on a phone held upright" — what a desktop, a laptop or
 * a tablet is told once, on the load it opens the game on (ADR-0060).
 *
 * **It is not the rotate overlay, and the difference is the whole point.**
 * `app/ui/rotate-overlay.ts` is a modal with a focus trap that pauses the game
 * and covers the screen, and it fires for one device in one position: a phone
 * turned sideways, which has no layout in this game and never will (ADR-0002).
 * A desktop window and a tablet are **supported platforms** — the same portrait
 * canvas, centred, with the level's own sky and ground in the side panels
 * (CLAUDE.md, Orientation; ADR-0055) — so what they get is a sentence they can
 * send away, and five things about it are the acceptance criteria rather than
 * decoration:
 *
 *  - **Nothing is blocked.** No `role="dialog"`, no `aria-modal`, no focus trap,
 *    no `inert` anywhere, and no pause. It is a line of text and one button in
 *    the page's own `<main>`, and every control behind it stays reachable while
 *    it is up. A player who ignores it plays the game.
 *  - **It takes no focus.** It is drawn where every player can already reach it
 *    — first in the one `<main>`, so it is in the Tab order and inside the front
 *    door's switch ring — which is `app/ui/hud.ts`'s rule and
 *    `app/ui/update-notice.ts`'s. The one time focus moves is when the control
 *    that had it is removed, so it does not fall to the body.
 *  - **Announced once, through the one live region.** The sentence carries
 *    `role="status"` so it is exposed as advisory status text, and
 *    `aria-live="off"` so that role does not make it a *second* announcer: the
 *    words go to `app/ui/live-region.ts` exactly once, when the notice first
 *    appears, and never again — not when it follows the page into a level, not
 *    when the language changes. Two polite live regions is a well-known way to
 *    make a screen reader go quiet.
 *  - **Nothing here is on a timer.** It does not expire and it does not fade. It
 *    goes away when the player puts it away (CLAUDE.md: no timers outside Exam
 *    mode), and *whether it comes back on the next load* is the composition
 *    root's business, not this file's — see {@link PortraitNoticeOptions.onDismiss}.
 *  - **Colour is never the only signal.** The notice is a bordered block with a
 *    heavier start edge, the way the storage warning is, and it says what it
 *    means in words. There is no icon carrying the message and no tint carrying
 *    it either.
 *
 * Two sentences and not one: `portrait.notice` is the recommendation and
 * `portrait.notice.help` is the part that keeps it from reading as a refusal.
 * A player on a laptop who is told only the first has been told their platform
 * is wrong; the second says, in the same breath, that it is not.
 *
 * Copy: `portrait.notice` and `portrait.notice.help`, both listed in
 * `COPY_GAPS`, and `common.close`. DOM only (ADR-0005): whether this audience is
 * the current one is `app/ui/viewport-mode.ts`'s pure decision, and *when* to ask
 * it is `app/bootstrap/portrait-notice.ts`'s.
 */

import { text, type UiLocale } from './copy';
import { button, element } from './dom';
import { injectScreenStyles } from './screen-styles';
import { SWITCH_LABEL_ATTRIBUTE } from './single-switch';

export interface PortraitNoticeOptions {
  readonly locale: UiLocale;
  /** The one live region (`app/ui/live-region.ts`). */
  readonly announce?: (message: string, lang?: string) => void;
  /**
   * The player put the notice away.
   *
   * Terminal for this page's life, and the composition root writes it down so it
   * is terminal for this device too (ADR-0060). This file deliberately does not
   * know where that is written: `app/ui` never touches storage.
   */
  readonly onDismiss?: () => void;
}

export interface PortraitNotice {
  /** The drawn element, or `null` when it is not on the page. Never hidden: absent. */
  readonly element: HTMLElement | null;
  /** On the page now. */
  readonly raised: boolean;
  /** Put away by the player. Terminal. */
  readonly dismissed: boolean;
  /**
   * Draw it first in `host` — the page's one `<main>` — and announce it, once.
   * Idempotent, and a no-op after {@link PortraitNotice.dismissed}.
   *
   * Answers whether it was drawn, so a caller that needs to know can tell "shown"
   * from "declined" rather than inferring it from the DOM.
   */
  raise(host: HTMLElement): boolean;
  /** The page changed hands (front door ↔ level): follow it, silently. */
  moveTo(host: HTMLElement): void;
  /** Redraw the words in place, silently, keeping focus and the switch highlight. */
  setLocale(locale: UiLocale): void;
  destroy(): void;
}

/** The sentence the Close button is described by. One notice per page, so one id. */
export const PORTRAIT_NOTICE_MESSAGE_ID = 'tn-portrait-notice-message';

/** What focus may land on when the control that had it goes. */
const TABBABLE =
  'button:not([disabled]),a[href],input:not([disabled]):not([type="hidden"]),[tabindex="0"]';

interface Parts {
  readonly root: HTMLElement;
  readonly message: HTMLElement;
  readonly help: HTMLElement;
  readonly close: HTMLButtonElement;
}

export function createPortraitNotice(
  doc: Document,
  options: PortraitNoticeOptions,
): PortraitNotice {
  injectScreenStyles(doc);

  let locale = options.locale;
  let parts: Parts | null = null;
  let announced = false;
  let dismissed = false;
  let destroyed = false;

  /** Both sentences, in the order they are read. What is announced, and nothing else. */
  const spoken = (forLocale: UiLocale): string =>
    `${text(forLocale, 'portrait.notice')} ${text(forLocale, 'portrait.notice.help')}`;

  const build = (): Parts => {
    const message = element(doc, 'p', {
      id: PORTRAIT_NOTICE_MESSAGE_ID,
      testId: 'portrait-notice-message',
      className: 'tn-portrait-notice__message',
      text: text(locale, 'portrait.notice'),
      /* A status for what it is, and `aria-live="off"` so it is not a second
         announcer: `live-region.ts` speaks it once, below. */
      attrs: { role: 'status', 'aria-live': 'off' },
    });
    const help = element(doc, 'p', {
      testId: 'portrait-notice-help',
      className: 'tn-portrait-notice__help',
      text: text(locale, 'portrait.notice.help'),
    });
    const close = button(doc, {
      testId: 'portrait-notice-dismiss',
      className: 'tn-portrait-notice__dismiss',
      text: text(locale, 'common.close'),
      attrs: {
        /* A keyboard or screen-reader user reaching the button hears what it
           closes, rather than a bare "Close" among the title screen's controls. */
        'aria-describedby': PORTRAIT_NOTICE_MESSAGE_ID,
        /*
         * And so does a switch user, who gets neither.
         *
         * `app/ui/single-switch.ts` announces an item's `data-switch-label`, its
         * `aria-label` or its text — never its description — so the scan would
         * otherwise say "Close" and leave the one player who cannot look around
         * the screen to guess what was being closed. Composed from the two rows
         * already drawn rather than invented as a third string, which is the same
         * answer `app/ui/title-screen.ts` gives for its arrival message.
         *
         * The alternative was to mark the sentence a scan stop the way
         * `app/ui/confirm.ts` marks a confirmation's question. It is refused
         * here: a stop "carries no role" by that module's own contract, and this
         * sentence carries `role="status"` for the reason above. A notice with
         * one harmless control does not need the extra stop a destructive pair
         * does.
         */
        [SWITCH_LABEL_ATTRIBUTE]: `${spoken(locale)} ${text(locale, 'common.close')}`,
      },
      onClick: () => {
        dismiss();
      },
    });
    /*
     * No role on the wrapper, and no `aria-live` anywhere on it. The role is on
     * the sentence: `app/ui/focus-trap.ts` never makes a `[role="status"]`
     * element inert, so a role here would exempt the button too and leave it
     * clickable behind every dialog opened afterwards (`app/ui/update-notice.ts`
     * says the same about its own wrapper).
     */
    const root = element(doc, 'div', {
      testId: 'portrait-notice',
      className: 'tn-portrait-notice',
      lang: locale,
      children: [
        element(doc, 'div', {
          className: 'tn-portrait-notice__words',
          children: [message, help],
        }),
        close,
      ],
    });
    return { root, message, help, close };
  };

  /**
   * A dialog holds `host`: `host` is inside something made inert, or something
   * beside the notice's place in it has been. That is what a focus trap leaves
   * behind while it is active (`app/ui/focus-trap.ts`).
   *
   * Unlike the update notice, this one does not wait for the dialog to close and
   * try again. It is raised once, on the load, at a moment when the front door
   * has just been drawn and nothing is open over it — and the one modal that
   * could be up, the rotate overlay, belongs to an audience this notice is never
   * shown to (`app/ui/viewport-mode.ts` makes the two mutually exclusive). So
   * "held" here is a guard against drawing a control behind a dialog that claims
   * nothing behind it is reachable, not a queue.
   */
  const held = (host: HTMLElement): boolean => {
    if (host.closest('[inert]') !== null) return true;
    return Array.from(host.children).some(
      (child) => child !== parts?.root && (child as HTMLElement).inert,
    );
  };

  /** Focus left inside a removed element falls to the body; put it somewhere real. */
  const landFocus = (host: HTMLElement): void => {
    /* A `<main>` made focusable on purpose — the level's (`Hud.focus`) — is where
       the HUD itself puts a player, so it is where this puts them too. */
    if (host.hasAttribute('tabindex')) {
      host.focus({ preventScroll: true });
      return;
    }
    const next = Array.from(host.querySelectorAll<HTMLElement>(TABBABLE)).find(
      (candidate) => candidate.closest('[inert],[hidden]') === null,
    );
    (next ?? host).focus({ preventScroll: true });
  };

  function dismiss(): void {
    if (parts === null) return;
    const { root } = parts;
    const host = root.parentElement;
    const active = doc.activeElement;
    const hadFocus = active !== null && root.contains(active);
    root.remove();
    parts = null;
    dismissed = true;
    if (hadFocus && host !== null) landFocus(host);
    options.onDismiss?.();
  }

  return {
    get element(): HTMLElement | null {
      return parts?.root ?? null;
    },
    get raised(): boolean {
      return parts !== null;
    },
    get dismissed(): boolean {
      return dismissed;
    },

    raise(host): boolean {
      if (dismissed || destroyed || parts !== null) return false;
      if (held(host)) return false;
      parts = build();
      host.prepend(parts.root);
      if (!announced) {
        announced = true;
        options.announce?.(spoken(locale), locale);
      }
      return true;
    },

    moveTo(host): void {
      if (dismissed || destroyed || parts === null) return;
      if (parts.root.parentElement !== host || host.firstElementChild !== parts.root) {
        host.prepend(parts.root);
      }
    },

    setLocale(next): void {
      locale = next;
      if (parts === null) return;
      /* Patched rather than rebuilt: a rebuilt button would take the player's
         focus and the switch highlight with it. The sentence is `aria-live="off"`,
         so changing its words says nothing. */
      parts.root.setAttribute('lang', next);
      parts.message.textContent = text(next, 'portrait.notice');
      parts.help.textContent = text(next, 'portrait.notice.help');
      parts.close.textContent = text(next, 'common.close');
      parts.close.setAttribute(
        SWITCH_LABEL_ATTRIBUTE,
        `${spoken(next)} ${text(next, 'common.close')}`,
      );
    },

    destroy(): void {
      destroyed = true;
      parts?.root.remove();
      parts = null;
    },
  };
}
