/**
 * When the game says "this works best on a phone held upright" (ADR-0060), and
 * the wire from the load-time viewport to the words.
 *
 * `app/ui/portrait-notice.ts` owns what the player perceives. This owns the
 * three decisions around it, and each is a decision rather than a detail:
 *
 * ## 1. It is measured once, at load, and never re-asked
 *
 * `main.ts` re-classifies the viewport on every `resize`, `orientationchange`
 * and visual-viewport change, because the rotate overlay has to appear the
 * instant a phone turns. This does not follow it. The audience is taken once,
 * from the viewport the page loaded at, and the notice is offered or not offered
 * on that answer alone.
 *
 * The reason is what re-asking would do. A player who drags a window wider
 * halfway through a level would be interrupted by a notice about their device;
 * a tablet player rotating theirs would be told twice. Neither is news, and
 * neither is something a player did to ask a question. "Shown once on load" is
 * the request, and it is also the only version of this that cannot become a
 * nag.
 *
 * ## 2. Dismissal is per device, and is not in the save
 *
 * The flag lives under one `localStorage` key on the device it was dismissed on.
 * It is deliberately **not** a field in the save, and ADR-0026 is the reason
 * rather than convenience:
 *
 *  - A save is portable. ADR-0046 replaces progress *and settings* whole from a
 *    file, so a save exported from a laptop and opened on another one would
 *    carry a laptop's dismissal onto it — and a phone's non-dismissal back the
 *    other way. What has been read on *this* screen is a property of the screen,
 *    not of the player's progress.
 *  - It has to be readable before the save is. The save is an IndexedDB round
 *    trip (ADR-0026); `localStorage` answers synchronously, so the notice is
 *    decided before the front door is drawn rather than appearing a beat after
 *    the player is already reading the title screen.
 *  - Deleting progress (`save.clear`) empties the save, and must not un-dismiss
 *    a sentence the player has already read and put away. A separate key is the
 *    simplest way for that to be true rather than remembered.
 *
 * A browser that refuses storage — Safari in private mode, an origin with site
 * data blocked — gets the notice on every load, which is the honest failure
 * direction: the same browser is already being told, by the storage warning,
 * that it is keeping nothing.
 *
 * ## 3. It never coexists with the rotate overlay
 *
 * Not by ordering, and not by a check in this file: `classifyAudience` returns
 * `phone-landscape` on exactly the branch where `classifyViewport` returns
 * `landscape-phone`, and {@link shouldShowPortraitNotice} is false for it. The
 * two cases are one enumeration, so "both at once" is not a state this wire can
 * reach.
 */

import type { WebStorage } from '@adapters/persistence';
import type { SettingsStore } from '@ui/settings';
import { createPortraitNotice, type PortraitNotice } from '@ui/portrait-notice';
import {
  classifyAudience,
  shouldShowPortraitNotice,
  type ViewportAudience,
} from '@ui/viewport-mode';

/**
 * Where a dismissal is remembered, on this device.
 *
 * Namespaced away from `PROGRESS_STORAGE_KEY` on purpose: `clearBoth` (ADR-0026)
 * clears the save's key, and this one is not the save.
 */
export const PORTRAIT_NOTICE_STORAGE_KEY = 'truenorth.portrait-notice.dismissed';

/** The value written. Read as "anything but this is not a dismissal". */
const DISMISSED = '1';

/**
 * Is the notice owed to this player, on this load?
 *
 * Pure, and the whole rule: the audience is one this notice is for, and it has
 * not already been put away on this device. Everything else in this file is
 * plumbing around this line.
 */
export function portraitNoticeIsOwed(
  audience: ViewportAudience,
  dismissedBefore: boolean,
): boolean {
  return !dismissedBefore && shouldShowPortraitNotice(audience);
}

/**
 * Read the flag, treating every failure as "not dismissed".
 *
 * A blocked store can throw on `getItem` itself, after `browserLocalStorage()`
 * has already probed it successfully — the permission can change between the two
 * calls. Showing the notice again is the wrong-but-harmless answer; a boot that
 * throws is not.
 */
export function portraitNoticeWasDismissed(storage: WebStorage | null): boolean {
  if (storage === null) return false;
  try {
    return storage.getItem(PORTRAIT_NOTICE_STORAGE_KEY) === DISMISSED;
  } catch {
    return false;
  }
}

/** Write the flag, treating every failure as "we could not remember". */
export function rememberPortraitNoticeDismissed(storage: WebStorage | null): void {
  if (storage === null) return;
  try {
    storage.setItem(PORTRAIT_NOTICE_STORAGE_KEY, DISMISSED);
  } catch {
    /* The player dismissed it and this browser will not keep that. The notice is
       gone for this sitting and comes back on the next load; nothing else in the
       game depends on the flag, so there is nothing to report and nothing to
       retry. */
  }
}

/** What drawing the notice needs, which only exists once the front door is up. */
export interface PortraitNoticeWiring {
  readonly store: SettingsStore;
  readonly announce: (message: string, lang?: string) => void;
  /** The page's one `<main>` right now: the front door's, or the level's. */
  readonly host: () => HTMLElement;
}

export interface PortraitWatchOptions {
  /** The viewport the page loaded at. Measured once by `main.ts`. */
  readonly width: number;
  readonly height: number;
  /** This device's memory of the notice. `null` where storage is refused. */
  readonly storage: WebStorage | null;
  /** The notice to draw. The real one unless a test supplies another. */
  readonly createNotice?: typeof createPortraitNotice;
}

export interface PortraitWatch {
  /** Who the page loaded for. Exposed so `main.ts` can publish it for a test. */
  readonly audience: ViewportAudience;
  /** True while the notice is owed and has not yet been put away. */
  readonly owed: boolean;
  /** The screens exist. Draws the notice if it is owed. */
  attach(wiring: PortraitNoticeWiring): void;
  /** The page's `<main>` changed: move the notice into the new one. */
  rehome(): void;
}

export function watchPortraitFit(options: PortraitWatchOptions): PortraitWatch {
  const audience = classifyAudience(options.width, options.height);
  let owed = portraitNoticeIsOwed(audience, portraitNoticeWasDismissed(options.storage));
  let wiring: PortraitNoticeWiring | null = null;
  let notice: PortraitNotice | null = null;

  return {
    audience,
    get owed(): boolean {
      return owed;
    },

    attach(next): void {
      if (!owed || wiring !== null) return;
      wiring = next;
      const host = next.host();
      notice = (options.createNotice ?? createPortraitNotice)(host.ownerDocument, {
        locale: next.store.current.locale,
        announce: next.announce,
        onDismiss: () => {
          owed = false;
          rememberPortraitNoticeDismissed(options.storage);
        },
      });
      /* The language can change under it — Settings is one control away on the
         screen it is drawn over — and the notice redraws its words in place
         rather than being rebuilt, so focus and the switch highlight stay put. */
      next.store.subscribe((settings, changed) => {
        if (changed === 'locale') notice?.setLocale(settings.locale);
      });
      notice.raise(host);
    },

    rehome(): void {
      if (wiring !== null) notice?.moveTo(wiring.host());
    },
  };
}
