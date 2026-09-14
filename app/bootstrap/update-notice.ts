/**
 * When the page says "A new version is ready" — slice F3, ADR-0034's "Update
 * flow" — and the wire from the service worker to the words.
 *
 * ## The trigger, and why it needs no message from the worker
 *
 * A new build takes over the moment it installs (`skipWaiting`, `clientsClaim`
 * in `infra/pages/service-worker.js`). A page that was **already controlled when
 * it loaded** and then hears `controllerchange` is running older code than the
 * worker now in charge, so it is the page that should offer a reload. A page that
 * was **not** controlled when it loaded is a first visit: its `controllerchange`
 * is the worker arriving, not an update, and it never shows the notice — not at
 * that first takeover and not at a later one in the same page's life, because
 * "never on the first visit" is the rule and the next navigation, which the worker
 * answers from the network first, fetches the new build anyway.
 *
 * ## It waits for a card or an exam to close
 *
 * The notice never appears over an open question card or the exam, and it never
 * interrupts a dialogue that leads to one. On the front door the two surfaces are
 * bracketed with {@link UpdateWatch.block} and {@link UpdateWatch.unblock}; in a
 * level they are the pause reasons the level already takes for them — `poi` (the
 * landmark card and the question after it), `study` and `quest` — so
 * {@link UpdateWatch.deferDuring} wraps the one pause control rather than adding
 * a second set of brackets beside every place a card opens.
 *
 * All of that is {@link nextUpdateState}: a pure function over "controlled at
 * load" and the events since, so every rule above is a unit test and not a
 * browser session.
 *
 * ## Registration is not here
 *
 * `scripts/lib/pwa.mjs` still writes the registration into `dist/index.html`, and
 * `scripts/deploy-check.mjs` still holds it against `featureFlags.serviceWorker`.
 * ADR-0034 ("Registration lives in the artefact") keeps it there: turning the flag
 * off must stop registering in the same artefact that starts serving the
 * tombstone. This file only listens, and only while the flag is on — with the flag
 * off the worker being replaced is the tombstone, which reloads the page itself,
 * and a notice over that would ask for something already happening.
 *
 * `html[data-tn-update]` carries the phase after every worker change, the way
 * `data-tn-level` carries a level's: it is what `tests/e2e/update-notice.spec.ts`
 * waits on to know a first visit's takeover was heard and ignored.
 */

import type { SettingsStore } from '@ui/settings';
import { createUpdateNotice, type UpdateNotice } from '@ui/update-notice';

/* ------------------------------------------------------------ the trigger */

/**
 * - `idle`: no newer worker has taken over this page, or this is a first visit;
 * - `deferred`: one has, and a card or an exam is open;
 * - `shown`: the notice is owed to the player;
 * - `dismissed`: they put it away. Terminal.
 */
export type UpdatePhase = 'idle' | 'deferred' | 'shown' | 'dismissed';

export interface UpdateState {
  /** Read once, when the page's code first ran. It is never re-read. */
  readonly controlledAtLoad: boolean;
  readonly phase: UpdatePhase;
  /** What is open that the notice must not interrupt, each named once. */
  readonly blockers: readonly string[];
}

export type UpdateEvent =
  /** `controllerchange`, with whether the page has a controller now. */
  | { readonly kind: 'controller-changed'; readonly controlled: boolean }
  | { readonly kind: 'blocker-opened'; readonly blocker: string }
  | { readonly kind: 'blocker-closed'; readonly blocker: string }
  | { readonly kind: 'dismissed' };

export function initialUpdateState(controlledAtLoad: boolean): UpdateState {
  return { controlledAtLoad, phase: 'idle', blockers: [] };
}

/** One event. Pure: the state passed in is never changed, and an event that changes nothing returns it. */
export function nextUpdateState(state: UpdateState, event: UpdateEvent): UpdateState {
  switch (event.kind) {
    case 'controller-changed': {
      /* A first visit's takeover, or a controller that went away: not an update. */
      if (!state.controlledAtLoad || !event.controlled) return state;
      /* Already owed, already shown, or put away: a third build says nothing new. */
      if (state.phase !== 'idle') return state;
      return { ...state, phase: state.blockers.length > 0 ? 'deferred' : 'shown' };
    }
    case 'blocker-opened': {
      if (state.blockers.includes(event.blocker)) return state;
      /* A card opened over a notice already on screen does not take it away: the
         card's own trap makes it inert, and closing the card gives it back. */
      return { ...state, blockers: [...state.blockers, event.blocker] };
    }
    case 'blocker-closed': {
      if (!state.blockers.includes(event.blocker)) return state;
      const blockers = state.blockers.filter((blocker) => blocker !== event.blocker);
      const phase = state.phase === 'deferred' && blockers.length === 0 ? 'shown' : state.phase;
      return { ...state, blockers, phase };
    }
    case 'dismissed':
      return state.phase === 'shown' ? { ...state, phase: 'dismissed' } : state;
  }
}

/** The state after a whole history of events, from a page's load. */
export function updateStateAfter(
  controlledAtLoad: boolean,
  events: readonly UpdateEvent[],
): UpdateState {
  return events.reduce(nextUpdateState, initialUpdateState(controlledAtLoad));
}

/* --------------------------------------------------------------- the wire */

/** The two members of `navigator.serviceWorker` this file reads. */
export interface WorkerContainer {
  readonly controller: unknown;
  addEventListener(type: 'controllerchange', listener: () => void): void;
}

/**
 * `navigator.serviceWorker` off a window, or `null` where there is none — a
 * browser without workers, an insecure origin, or the `window` double the
 * bootstrap suites run against, which has no `navigator` at all.
 *
 * Playwright's `serviceWorkers: 'block'` leaves the container in place and
 * replaces only `register`, so under every browser suite but the worker's own
 * this returns a real container whose controller is `null` and never changes.
 */
export function workerContainerOf(view: unknown): WorkerContainer | null {
  const container = (
    view as { readonly navigator?: { readonly serviceWorker?: unknown } } | null | undefined
  )?.navigator?.serviceWorker;
  if (container === null || typeof container !== 'object') return null;
  const candidate = container as { readonly addEventListener?: unknown };
  if (typeof candidate.addEventListener !== 'function' || !('controller' in container)) return null;
  return container as WorkerContainer;
}

/** The shape of `PauseControl` in `main.ts`, named here without importing it. */
export interface Holds<R extends string> {
  hold(reason: R): void;
  release(reason: R): void;
}

/** What drawing the notice needs, which only exists once the front door is up. */
export interface UpdateNoticeWiring {
  readonly store: SettingsStore;
  readonly announce: (message: string, lang?: string) => void;
  /** The page's one `<main>` right now: the front door's, or the level's. */
  readonly host: () => HTMLElement;
  readonly reload: () => void;
}

export interface UpdateWatchOptions {
  /** `featureFlags.serviceWorker`. Off, nothing listens. */
  readonly enabled: boolean;
  readonly container: WorkerContainer | null;
  /** `<html>`, for `data-tn-update`. */
  readonly root: HTMLElement;
  /** The notice to draw. The real one unless a test supplies another. */
  readonly createNotice?: typeof createUpdateNotice;
}

export interface UpdateWatch {
  readonly state: UpdateState;
  /**
   * The same pause control, which also tells the watch when one of `reasons` is
   * held. Handed back unchanged when nothing is listening.
   */
  deferDuring<R extends string>(pause: Holds<R>, reasons: readonly R[]): Holds<R>;
  /** A question card or the exam opened outside a level. */
  block(blocker: string): void;
  unblock(blocker: string): void;
  /** The screens exist. Draws the notice at once if it is already owed. */
  attach(wiring: UpdateNoticeWiring): void;
  /** The page's `<main>` changed: move the notice into the new one. */
  rehome(): void;
}

export function watchForUpdates(options: UpdateWatchOptions): UpdateWatch {
  const container = options.enabled ? options.container : null;
  let state = initialUpdateState(container !== null && isControlled(container));
  let wiring: UpdateNoticeWiring | null = null;
  let notice: UpdateNotice | null = null;

  const draw = (): void => {
    if (wiring === null || state.phase !== 'shown') return;
    const { host, store, announce, reload } = wiring;
    notice ??= (options.createNotice ?? createUpdateNotice)(host().ownerDocument, {
      locale: store.current.locale,
      announce,
      onReload: reload,
      onDismiss: () => {
        apply({ kind: 'dismissed' });
      },
    });
    notice.raise(host());
  };

  function apply(event: UpdateEvent): void {
    const before = state.phase;
    state = nextUpdateState(state, event);
    if (event.kind === 'controller-changed' || state.phase !== before) {
      options.root.dataset['tnUpdate'] = state.phase;
    }
    if (state.phase === 'shown' && before !== 'shown') draw();
  }

  if (container !== null) {
    const watched = container;
    watched.addEventListener('controllerchange', () => {
      apply({ kind: 'controller-changed', controlled: isControlled(watched) });
    });
  }

  return {
    get state(): UpdateState {
      return state;
    },

    deferDuring<R extends string>(pause: Holds<R>, reasons: readonly R[]): Holds<R> {
      if (container === null) return pause;
      return {
        hold(reason): void {
          pause.hold(reason);
          if (reasons.includes(reason)) apply({ kind: 'blocker-opened', blocker: reason });
        },
        release(reason): void {
          pause.release(reason);
          if (reasons.includes(reason)) apply({ kind: 'blocker-closed', blocker: reason });
        },
      };
    },

    block(blocker): void {
      if (container !== null) apply({ kind: 'blocker-opened', blocker });
    },

    unblock(blocker): void {
      if (container !== null) apply({ kind: 'blocker-closed', blocker });
    },

    attach(next): void {
      if (container === null || wiring !== null) return;
      wiring = next;
      next.store.subscribe((settings, changed) => {
        if (changed === 'locale') notice?.setLocale(settings.locale);
      });
      draw();
    },

    rehome(): void {
      if (wiring !== null) notice?.moveTo(wiring.host());
    },
  };
}

function isControlled(container: WorkerContainer): boolean {
  return container.controller !== null && container.controller !== undefined;
}
