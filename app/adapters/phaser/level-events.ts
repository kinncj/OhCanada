/**
 * The names a level scene emits, as one list.
 *
 * They were string literals scattered through `level-scene.ts`, published only
 * into the `?e2e=1` probe's event trace. That was enough for a Playwright
 * assertion and not enough for anything else: `app/ui` takes level events as an
 * injected subscription and needs the *same* names, and nothing connected the
 * two but two agents reading the same story file.
 *
 * So the union is written down here, in the adapter, and `app/bootstrap` — the
 * only place allowed to know about both sides (ADR-0005) — asserts at compile
 * time that every name the engine can emit is a name the UI declares. The
 * adapter still does not import `app/ui`, and the UI still does not import an
 * adapter; the composition root holds them against each other.
 *
 * ## Why the two lists are not identical, and why that is the right way round
 *
 * `app/ui` also declares `level/failed`. **No scene emits it** — a scene that
 * failed to load does not exist to emit anything, so it is published by
 * bootstrap when `loadLevel` returns an error. The engine's union is therefore a
 * strict subset, and the assertion runs in that direction only. The reverse
 * would be wrong: it would force this adapter to declare an event it cannot
 * produce, which is how a name ends up with no emitter and a test that passes.
 *
 * ## Adding one
 *
 * Add it here, then add it to `LevelEventName` in `app/ui/level-events.ts`, and
 * `SPEAKS` — a `Record` over that union — will not compile until somebody
 * decides whether the new event interrupts a screen reader. That decision is
 * deliberately not defaultable: every `player/*` is `false` because they fire
 * continuously, and an announcer that spoke for them would talk over everything
 * else in the level.
 */

/** Every event a level scene can publish. */
export const SCENE_EVENT_NAMES = [
  'level/ready',
  'player/moved',
  'player/stopped',
  'player/jumped',
  'player/braked',
  'poi/entered',
  'poi/left',
  'poi/engaged',
  'npc/engaged',
] as const;

export type SceneEventName = (typeof SCENE_EVENT_NAMES)[number];

/**
 * What a scene event is about, when the name alone does not say.
 *
 * `npc.officer`, `poi.parliament-hill`. Optional, because an event with no
 * subject must not carry an empty string pretending to be one — `app/ui` reads
 * a missing detail as "no offer", which is a real state.
 */
export type SceneEventListener = (name: SceneEventName, detail?: string) => void;

/**
 * Is this one of ours?
 *
 * Exists for the boundary where a name arrives as a `string` — the probe's event
 * trace, and any future replay of it. Inside the scene the union does the work
 * and this is never needed.
 */
export function isSceneEventName(value: string): value is SceneEventName {
  return (SCENE_EVENT_NAMES as readonly string[]).includes(value);
}
