/**
 * The level's event map, and the one place the engine's names and the UI's names
 * are held against each other.
 *
 * `common/event-bus.ts` supplies the mechanism and says the map itself "is
 * declared per bounded area (game events, UI events) and wired in
 * `app/bootstrap`". This is that declaration for the level.
 *
 * ## Why it is here and not in either directory
 *
 * `app/adapters/phaser` may not import `app/ui`, and `app/ui` may not import an
 * adapter (ADR-0005, and dependency-cruiser enforces both). So each side
 * declares its own list of names — `SCENE_EVENT_NAMES` in the adapter,
 * `LevelEventName` in `app/ui` — and *nothing* in either directory can notice
 * when they drift. The composition root is the only file allowed to see both,
 * so the check belongs here, and it is a **compile-time** check rather than a
 * test: {@link ASSIGNABLE} below does not typecheck if the engine can emit a
 * name the UI has never heard of.
 *
 * The relationship is deliberately one-way. `app/ui` declares `level/failed` and
 * **no scene emits it** — a level that failed to load does not exist to emit
 * anything, so {@link publishLevelFailed} publishes it from here, where the
 * failure is actually known. Requiring the adapter to declare an event it cannot
 * produce would give that name an emitter that never fires, which is worse than
 * the asymmetry.
 *
 * ## What the UI does with them
 *
 * `SPEAKS` in `app/ui/level-events.ts` is a `Record` over `LevelEventName`, so
 * it is exhaustive by type: a new event does not compile until somebody decides
 * whether it interrupts a screen reader. Every `player/*` is `false` — they fire
 * continuously, and four hundred movement events must produce zero
 * announcements — which is why binding the bus to the announcer is safe to do
 * for *all* events rather than a curated few. The filtering is the UI's, stated
 * once, in a type.
 */

import type { SceneEventName } from '@adapters/phaser';
import { createEventBus, type EventBus } from '@common/event-bus';
import type { LevelEvent, LevelEventName, LevelEventSource } from '@ui/level-events';

/**
 * The payload. One optional field, because that is all the engine has to say.
 *
 * `detail` names the subject — `parliament-hill`, `officer` — and is absent when
 * there is none. `app/ui` reads a missing detail as "no offer", which is a real
 * state (something came into reach that this build has no copy for) and must not
 * be confused with an empty string somebody forgot to fill in.
 */
export interface LevelEventPayload {
  readonly detail?: string;
}

/** The level's bounded area of the bus. */
export type GameEventMap = { readonly [K in LevelEventName]: LevelEventPayload };

export type GameEventBus = EventBus<GameEventMap>;

export function createGameEventBus(): GameEventBus {
  return createEventBus<GameEventMap>();
}

/**
 * Publish one scene event on the bus.
 *
 * **This function is the drift check.** `name` is a `SceneEventName` and
 * `bus.emit` is keyed by `LevelEventName`; if the adapter ever emits a name the
 * UI does not declare, this line stops compiling and says which literal.
 *
 * The spread is not decoration: `exactOptionalPropertyTypes` makes
 * `{ detail: undefined }` a different type from `{}`, and a subscriber that
 * received the first could not tell "no subject" from "a subject nobody set".
 */
export function publishSceneEvent(
  bus: GameEventBus,
  name: SceneEventName,
  detail?: string,
): void {
  bus.emit(name, detail === undefined ? {} : { detail });
}

/**
 * Publish the one event no scene can publish.
 *
 * Separate from {@link publishSceneEvent} and typed to the single name on
 * purpose: it is the only level event whose emitter is the composition root, and
 * a generic "emit anything" helper here would quietly let bootstrap invent
 * gameplay facts the engine never observed.
 */
export function publishLevelFailed(bus: GameEventBus, levelId: string): void {
  bus.emit('level/failed', { detail: levelId });
}

/**
 * The bus, as the injected subscription `app/ui` asks for.
 *
 * `app/ui/level-events.ts` takes "a function that registers a listener and
 * returns an unsubscribe" precisely so it never learns that a bus exists. This
 * is the adapter between the two shapes, and it is four lines because that is
 * how much of a seam it should be.
 *
 * `onAny` rather than nine `on` calls: the UI's `SPEAKS` table already decides
 * which events matter, and a subscription list here would be a second, silent
 * copy of that decision — the kind that goes stale when an event is added.
 */
export function levelEventSource(bus: GameEventBus): LevelEventSource {
  return (listener: (event: LevelEvent) => void) =>
    bus.onAny((event) => {
      const { detail } = event.payload;
      listener(detail === undefined ? { name: event.type } : { name: event.type, detail });
    });
}
