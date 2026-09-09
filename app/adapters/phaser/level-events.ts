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

/**
 * The moments a level *finishes* something, on a channel of their own.
 *
 * ## Why these are not in `SCENE_EVENT_NAMES`
 *
 * Because they would not compile there, and the reason they would not is the
 * reason the split is right. `app/bootstrap/game-events.ts` types
 * `publishSceneEvent` as `SceneEventName -> EventBus<Record<LevelEventName, …>>`,
 * so widening the scene's union with a name `app/ui` has never declared is a
 * type error in the composition root. That check exists to stop the two lists
 * drifting and it is doing its job: **`app/ui` has no copy for a completed
 * quest yet**, and inventing the wording here is not this directory's to do
 * (ADR-0010).
 *
 * So the engine publishes what it observes on a second, clearly separate
 * channel, and the UI binds it in the same one line `onLevelEvent` took once the
 * copy exists. The alternative — reusing `poi/engaged` to mean "and it is
 * finished now" — would give one name two meanings and make the announcer say
 * the wrong thing.
 *
 * ## What the scene actually knows
 *
 * Nothing about quests. A quest completing and a stamp being earned are domain
 * facts, so they arrive **inbound** (`LevelScene.markCompleted`,
 * `markLevelComplete`) and what the scene owns is the *world's* half of the
 * moment: the subject stops advertising itself as something to do, and the
 * milestone is published in the order it happened, after the engagement that
 * caused it. The screen that announces it belongs to `app/ui`.
 */
export const SCENE_MILESTONE_NAMES = ['quest/completed', 'level/completed'] as const;

export type SceneMilestoneName = (typeof SCENE_MILESTONE_NAMES)[number];

/**
 * `detail` is the subject the milestone is about — the point of interest or the
 * character whose quest finished, and the level id for a finished level. Never
 * an empty string: see {@link SceneEventListener}.
 */
export type SceneMilestoneListener = (name: SceneMilestoneName, detail?: string) => void;

/* No `isSceneMilestoneName` guard here, deliberately. `isSceneEventName` exists
   because a name arrives as a `string` at the probe's trace boundary; nothing
   reads a milestone name back out of a string, and ADR-0015 is explicit that a
   member with no caller is found by review rather than by CI. Add it when
   something needs it. */
