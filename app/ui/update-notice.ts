/**
 * "A new version is ready": what the page says when the game it is running is
 * older than the service worker now serving it (ADR-0034, "Update flow").
 *
 * **When** is not this file's decision. `app/bootstrap/update-notice.ts` owns
 * the trigger — a page that was already controlled when it loaded, a new worker
 * taking control, and no question card or exam open — and calls
 * {@link UpdateNotice.raise} once that is true. This file owns what the player
 * perceives, and five things about it are the acceptance criteria rather than
 * decoration:
 *
 *  - **Announced once, through the one live region.** The message carries
 *    `role="status"` so it is exposed as advisory status text, and it carries
 *    `aria-live="off"` so that role does not make it a *second* announcer: the
 *    words are handed to `app/ui/live-region.ts` exactly once, when the notice
 *    first appears, and never again — not when it follows the page from the
 *    front door into a level, not when the language changes. Two polite live
 *    regions is a well-known way to make a screen reader go quiet
 *    (`app/ui/storage-warning.ts` says the same about its own warning).
 *  - **Never modal and never on a timer.** It is a line of text and two
 *    buttons in the page's own `<main>`. Nothing is blocked, nothing expires,
 *    and nothing here schedules a callback (CLAUDE.md: no timers outside Exam
 *    mode). It goes away when the player puts it away, or when they reload.
 *  - **It takes no focus.** It is drawn where every player can already reach
 *    it: first in the page's one `<main>`, so it is in the Tab order, and inside
 *    the front door's switch ring, which walks that `<main>`. The HUD's rule —
 *    the prompt, the hint and the notice are drawn silently and focus stays
 *    where it is (`app/ui/hud.ts`) — is the rule here too. The one time focus is
 *    moved is when the control that had it is removed, so it does not fall to
 *    the body.
 *  - **It does not appear under a dialog.** A modal makes everything outside it
 *    inert when it opens, and an element added afterwards is not covered — which
 *    is how the title screen once ended up reachable behind the rotate overlay
 *    (`app/bootstrap/main.ts`). So a notice asked for while a dialog holds its
 *    `<main>` waits, and appears on the next focus change after the dialog lets
 *    go, which is when a dialog's trap hands focus back.
 *  - **The wrapper carries no role.** `app/ui/focus-trap.ts` never makes a
 *    `[role="status"]` element inert, because a live region must stay audible
 *    behind a modal. Putting the role on the wrapper would exempt the two buttons
 *    too, and they would stay clickable behind every dialog opened after the
 *    notice. The role is on the sentence; the wrapper goes inert with the page.
 *
 * Copy: `update.ready` and `update.reload`, both listed in `COPY_GAPS`, and
 * `common.close`. DOM only (ADR-0005).
 */

import { text, type UiLocale } from './copy';
import { button, element } from './dom';
import { injectScreenStyles } from './screen-styles';

export interface UpdateNoticeOptions {
  readonly locale: UiLocale;
  /** The one live region (`app/ui/live-region.ts`). */
  readonly announce?: (message: string, lang?: string) => void;
  /** "Reload": the composition root owns what reloading means. */
  readonly onReload: () => void;
  /** The player put the notice away. It does not come back in this page's life. */
  readonly onDismiss?: () => void;
}

export interface UpdateNotice {
  /** The drawn element, or `null` when it is not on the page. Never hidden: absent. */
  readonly element: HTMLElement | null;
  /** On the page now. */
  readonly raised: boolean;
  /** Asked for, and held back because a dialog holds the page. */
  readonly waiting: boolean;
  /** Put away by the player. Terminal. */
  readonly dismissed: boolean;
  /**
   * Draw it first in `host` — the page's one `<main>` — and announce it, once.
   * Idempotent, and a no-op after {@link UpdateNotice.dismissed}.
   */
  raise(host: HTMLElement): void;
  /** The page changed hands (front door ↔ level): follow it, silently. */
  moveTo(host: HTMLElement): void;
  /** Redraw the words in place, silently, keeping focus and the switch highlight. */
  setLocale(locale: UiLocale): void;
  destroy(): void;
}

/** The sentence both buttons are described by. One notice per page, so one id. */
export const UPDATE_NOTICE_MESSAGE_ID = 'tn-update-notice-message';

/** What focus may land on when the control that had it goes. */
const TABBABLE =
  'button:not([disabled]),a[href],input:not([disabled]):not([type="hidden"]),[tabindex="0"]';

interface Parts {
  readonly root: HTMLElement;
  readonly message: HTMLElement;
  readonly reload: HTMLButtonElement;
  readonly close: HTMLButtonElement;
}

export function createUpdateNotice(doc: Document, options: UpdateNoticeOptions): UpdateNotice {
  injectScreenStyles(doc);

  let locale = options.locale;
  let parts: Parts | null = null;
  let waitingFor: HTMLElement | null = null;
  let announced = false;
  let dismissed = false;
  let destroyed = false;

  const build = (): Parts => {
    const message = element(doc, 'p', {
      id: UPDATE_NOTICE_MESSAGE_ID,
      testId: 'update-notice-message',
      className: 'tn-update-notice__message',
      text: text(locale, 'update.ready'),
      attrs: { role: 'status', 'aria-live': 'off' },
    });
    const reload = button(doc, {
      testId: 'update-notice-reload',
      className: 'tn-update-notice__reload',
      text: text(locale, 'update.reload'),
      attrs: { 'aria-describedby': UPDATE_NOTICE_MESSAGE_ID },
      onClick: () => {
        options.onReload();
      },
    });
    const close = button(doc, {
      testId: 'update-notice-dismiss',
      className: 'tn-update-notice__dismiss',
      text: text(locale, 'common.close'),
      attrs: { 'aria-describedby': UPDATE_NOTICE_MESSAGE_ID },
      onClick: () => {
        dismiss();
      },
    });
    const root = element(doc, 'div', {
      testId: 'update-notice',
      className: 'tn-update-notice',
      lang: locale,
      children: [
        message,
        element(doc, 'div', { className: 'tn-update-notice__actions', children: [reload, close] }),
      ],
    });
    return { root, message, reload, close };
  };

  /**
   * A dialog holds `host`: `host` is inside something made inert, or something
   * beside the notice's place in it has been. That is exactly what a focus trap
   * leaves behind while it is active (`app/ui/focus-trap.ts`).
   */
  const held = (host: HTMLElement): boolean => {
    if (host.closest('[inert]') !== null) return true;
    return Array.from(host.children).some(
      (child) => child !== parts?.root && (child as HTMLElement).inert,
    );
  };

  const onFocusIn = (): void => {
    if (waitingFor === null || held(waitingFor)) return;
    const host = waitingFor;
    stopWaiting();
    show(host);
  };

  const wait = (host: HTMLElement): void => {
    if (waitingFor === null) doc.addEventListener('focusin', onFocusIn, true);
    waitingFor = host;
  };

  const stopWaiting = (): void => {
    if (waitingFor === null) return;
    doc.removeEventListener('focusin', onFocusIn, true);
    waitingFor = null;
  };

  const show = (host: HTMLElement): void => {
    parts ??= build();
    host.prepend(parts.root);
    if (announced) return;
    announced = true;
    options.announce?.(text(locale, 'update.ready'), locale);
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
    get waiting(): boolean {
      return waitingFor !== null;
    },
    get dismissed(): boolean {
      return dismissed;
    },

    raise(host): void {
      if (dismissed || destroyed || parts !== null) return;
      if (held(host)) {
        wait(host);
        return;
      }
      stopWaiting();
      show(host);
    },

    moveTo(host): void {
      if (dismissed || destroyed) return;
      if (parts !== null) {
        if (parts.root.parentElement !== host || host.firstElementChild !== parts.root) {
          host.prepend(parts.root);
        }
        return;
      }
      if (waitingFor === null) return;
      waitingFor = host;
      onFocusIn();
    },

    setLocale(next): void {
      locale = next;
      if (parts === null) return;
      /* Patched rather than rebuilt: a rebuilt button would take the player's
         focus and the switch highlight with it. The sentence is `aria-live="off"`,
         so changing its words says nothing. */
      parts.root.setAttribute('lang', next);
      parts.message.textContent = text(next, 'update.ready');
      parts.reload.textContent = text(next, 'update.reload');
      parts.close.textContent = text(next, 'common.close');
    },

    destroy(): void {
      destroyed = true;
      stopWaiting();
      parts?.root.remove();
      parts = null;
    },
  };
}
