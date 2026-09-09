/**
 * What the level tells the player, out loud.
 *
 * The Phaser canvas is `aria-hidden` by contract (CLAUDE.md, Accessibility), so
 * nothing that happens in the level exists for a screen-reader user unless it is
 * said in the one live region. This module is that translation: an injected
 * subscription of engine events in, announcements and an interact prompt out.
 *
 * **It is a subscription, not a bus.** `app/ui` never imports an adapter or the
 * event bus (ADR-0005); the composition root hands this module a function that
 * registers a listener and returns an unsubscribe, exactly the way every screen
 * in this directory takes its callbacks. Binding the engine's names to the typed
 * bus is task 1.5's work and none of it happens here.
 *
 * Two rules that are structure rather than good intentions:
 *
 *  1. **{@link SPEAKS} is exhaustive.** It is a `Record` over every event name,
 *     so a new event does not compile until somebody decides whether it is worth
 *     interrupting a screen reader for. `player/moved` fires continuously and is
 *     `false` — an announcer that spoke for it would talk over everything else
 *     in the level, which is the flooding `TN-LEVEL-08` forbids.
 *  2. **A modal speaks for itself; the live region speaks for everything else.**
 *     A dialog that opens takes focus and is read by the screen reader on
 *     arrival, so announcing its contents as well would say everything twice.
 *     `poi/engaged` and `npc/engaged` are therefore silent here: the POI card and
 *     the dialogue are what the player hears.
 *
 * DOM only (ADR-0005).
 */

import { text, type UiLocale } from './copy';

/**
 * The events the engine's scene probe already emits, as
 * `docs/stories/README.md` names them.
 *
 * `OQ-EVENT-1` is still open — these are the PO's proposed names and task 1.5
 * fixes them. When it picks other names, this union changes and every caller
 * fails to compile, which is the point of writing it down as a type.
 */
export type LevelEventName =
  | 'level/ready'
  | 'level/failed'
  | 'player/moved'
  | 'player/stopped'
  | 'player/jumped'
  | 'player/braked'
  | 'poi/entered'
  | 'poi/left'
  | 'poi/engaged'
  | 'npc/engaged';

export interface LevelEvent {
  readonly name: LevelEventName;
  /**
   * Which thing the event is about: `npc.officer`, `poi.parliament-hill`.
   * Optional, because the engine's trace carries it optionally — and because a
   * `poi/entered` with no detail is a real state (something came into reach that
   * this UI has no copy for) that must not throw. It is treated as "no offer".
   */
  readonly detail?: string;
}

/** Register a listener; the returned function removes it. */
export type LevelEventSource = (listener: (event: LevelEvent) => void) => () => void;

/**
 * Does this event interrupt a screen reader?
 *
 * Exhaustive over {@link LevelEventName} by type. Adding an event name to the
 * union without adding a row here is a compile error, so "does this one speak?"
 * is a decision somebody makes rather than a default somebody inherits.
 */
export const SPEAKS: Readonly<Record<LevelEventName, boolean>> = {
  /* "You are on the Rideau Canal in Ottawa. Skating." (TN-LEVEL-08) */
  'level/ready': true,
  /* "We could not load Ottawa." (TN-LEVEL-02) */
  'level/failed': true,
  /* Continuous. Speaking for these is the flooding TN-LEVEL-08 forbids. */
  'player/moved': false,
  'player/stopped': false,
  'player/jumped': false,
  'player/braked': false,
  /* "a message naming the officer and what to do" (TN-LEVEL-08). */
  'poi/entered': true,
  /* Withdrawing an offer is not news; the prompt disappearing is the signal. */
  'poi/left': false,
  /* The card and the dialogue take focus and are read on arrival. */
  'poi/engaged': false,
  'npc/engaged': false,
};

/**
 * What one engageable thing in the level is called, in the player's language.
 *
 * Content, from the caller. `hud.interact.officer` — "Talk to the officer" /
 * « Parler à l'agent » — lives in `TN-LEVEL-ottawa.md`'s copy table with the rest
 * of that level, and under ADR-0010 a level's own strings travel with the level
 * document. This module never invents one: a target it has never heard of offers
 * nothing rather than offering "Interact".
 */
export interface LevelTarget {
  /** The prompt's label, already localised: "Talk to the officer". */
  readonly prompt: string;
}

export interface LevelAnnouncerOptions {
  readonly locale: UiLocale;
  /** The one live region (`app/ui/live-region.ts`). */
  readonly announce: (message: string, lang?: string) => void;
  /**
   * "You are on the Rideau Canal in Ottawa. Skating." — `announce.arrived.ottawa`,
   * already localised. Required: a level that arrives silently is `TN-LEVEL-08`'s
   * failure, and a default would be this module authoring copy.
   *
   * A function is read when the level arrives, not when the announcer is built,
   * and that difference is a bug this option was found causing. The composition
   * root has to subscribe *before* it asks the engine to load a level, or it
   * misses `level/ready`; but the sentence it wants to say is the level
   * document's own localised title, which does not exist until that load has
   * finished. Passed as a string it was therefore read while it was still empty,
   * and every level in the shipped build arrived in silence — `TN-LEVEL-08`'s
   * failure, produced by the one option written to prevent it. A thunk is
   * evaluated at `level/ready`, by which time the document is parsed.
   */
  readonly arrival: string | (() => string);
  /** Keyed by the `detail` the engine sends: `npc.officer`, `poi.parliament-hill`. */
  readonly targets?: Readonly<Record<string, LevelTarget>>;
  /**
   * Show or withdraw the interact prompt. `null` means "nothing is in reach".
   * The HUD owns the element; this module owns *when*.
   */
  readonly onPrompt?: (target: LevelTarget | null, detail: string | null) => void;
}

export interface LevelAnnouncer {
  /** What is in reach right now, or `null`. */
  readonly inReach: string | null;
  setLocale(locale: UiLocale): void;
  /** Stop listening. Safe to call twice. */
  destroy(): void;
}

/**
 * Wire a level's events to the live region and the interact prompt.
 *
 * @param source The injected subscription. Nothing in this module knows where
 *   the events come from.
 */
export function createLevelAnnouncer(
  source: LevelEventSource,
  options: LevelAnnouncerOptions,
): LevelAnnouncer {
  let locale = options.locale;
  let inReach: string | null = null;

  const targetFor = (detail: string | undefined): LevelTarget | null => {
    if (detail === undefined) return null;
    return options.targets?.[detail] ?? null;
  };

  const say = (message: string): void => {
    options.announce(message, locale);
  };

  const unsubscribe = source((event) => {
    if (!SPEAKS[event.name] && event.name !== 'poi/left') return;

    switch (event.name) {
      case 'level/ready':
        say(typeof options.arrival === 'function' ? options.arrival() : options.arrival);
        return;

      case 'level/failed':
        say(text(locale, 'level.error.title'));
        return;

      case 'poi/entered': {
        const target = targetFor(event.detail);
        if (target === null) return;
        inReach = event.detail ?? null;
        options.onPrompt?.(target, inReach);
        /* The offer is the announcement: "Talk to the officer" names the officer
           and says what to do, which is exactly what TN-LEVEL-08 asks for, and
           it is the same words the prompt draws. */
        say(target.prompt);
        return;
      }

      case 'poi/left': {
        /* Only withdraw the offer that is actually on screen. Two things in
           reach and one leaving must not take the other one's prompt away. */
        if (event.detail !== undefined && event.detail !== inReach) return;
        inReach = null;
        options.onPrompt?.(null, null);
        return;
      }

      default:
        return;
    }
  });

  let live = true;

  return {
    get inReach(): string | null {
      return inReach;
    },
    setLocale(next): void {
      locale = next;
    },
    destroy(): void {
      if (!live) return;
      live = false;
      unsubscribe();
    },
  };
}
