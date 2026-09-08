/**
 * The level's events, from the engine's vocabulary to the screen reader's.
 *
 * Until task 1.12 the scene's facts went to exactly one place: the `?e2e=1`
 * probe's event trace. That made every scenario in
 * `docs/stories/TN-LEVEL-ottawa.md` assertable and left the live region — the
 * only channel a screen-reader user has over an `aria-hidden` canvas — hearing
 * nothing at all. This suite covers the wiring that closed that, and the two
 * properties that make it safe.
 *
 * **Property one: the two vocabularies cannot drift.** `app/adapters/phaser`
 * declares `SCENE_EVENT_NAMES` and `app/ui` declares `LevelEventName`, and
 * neither may import the other. `publishSceneEvent` fails to compile if the
 * engine emits a name the UI has not declared, which is the strongest half. The
 * half a compiler cannot state is the *other* direction — that every engine name
 * has an actual entry in `SPEAKS`, the table where somebody decided whether it
 * interrupts a screen reader — and that is asserted here, against the real
 * table, at runtime.
 *
 * **Property two: movement does not flood.** `TN-LEVEL-08` forbids it and
 * `SPEAKS` encodes it, but the guarantee only means anything once the bus is
 * actually connected to the announcer. Four hundred `player/moved` events
 * through the real bus and the real announcer must produce zero announcements;
 * before this wiring existed there was nothing that could have failed.
 */

import { describe, expect, it, vi } from 'vitest';

/* The module, not the barrel: `@adapters/phaser`'s index re-exports
   `game-renderer.ts`, which imports Phaser, which touches `window` at module
   scope and cannot load under `environment: 'node'`. `game-events.ts` reaches
   the barrel with an `import type`, which is erased, so production is unaffected. */
import { SCENE_EVENT_NAMES, isSceneEventName } from '@adapters/phaser/level-events';
import { SPEAKS, createLevelAnnouncer, type LevelEventName } from '@ui/level-events';

import {
  createGameEventBus,
  levelEventSource,
  publishLevelFailed,
  publishSceneEvent,
} from '../../../app/bootstrap/game-events';

describe('the engine and the UI name the same events', () => {
  it('gives every scene event a screen-reader decision, in the exhaustive table', () => {
    const undecided = SCENE_EVENT_NAMES.filter(
      (name) => !Object.prototype.hasOwnProperty.call(SPEAKS, name),
    );
    expect(
      undecided,
      'the engine can emit an event that `SPEAKS` has no row for, so nobody has decided ' +
        'whether it interrupts a screen reader. Add it to `LevelEventName` in ' +
        'app/ui/level-events.ts; the `Record` will not compile until the decision is made.',
    ).toEqual([]);
  });

  it('leaves exactly one UI event with no scene emitter, and it is level/failed', () => {
    const unemitted = (Object.keys(SPEAKS) as LevelEventName[]).filter(
      (name) => !(SCENE_EVENT_NAMES as readonly string[]).includes(name),
    );
    /* A scene that failed to load does not exist to emit anything, so bootstrap
       publishes this one. Any *other* name showing up here is a UI event with no
       emitter — a name a screen was written against that nothing can produce. */
    expect(unemitted).toEqual(['level/failed']);
  });

  it('recognises its own names and nothing else', () => {
    for (const name of SCENE_EVENT_NAMES) expect(isSceneEventName(name)).toBe(true);
    expect(isSceneEventName('level/failed')).toBe(false);
    expect(isSceneEventName('player/teleported')).toBe(false);
    expect(isSceneEventName('')).toBe(false);
  });

  it('says every player/* event is silent, which is what makes the bus safe to connect', () => {
    const noisy = (Object.keys(SPEAKS) as LevelEventName[]).filter(
      (name) => name.startsWith('player/') && SPEAKS[name],
    );
    expect(noisy, 'a continuous event was marked as speaking').toEqual([]);
  });
});

describe('the bus carries a scene event to an injected subscription', () => {
  it('delivers the name and the subject', () => {
    const bus = createGameEventBus();
    const seen: { name: string; detail?: string }[] = [];
    levelEventSource(bus)((event) => seen.push(event));

    publishSceneEvent(bus, 'poi/entered', 'parliament-hill');
    publishSceneEvent(bus, 'player/jumped');

    expect(seen).toEqual([{ name: 'poi/entered', detail: 'parliament-hill' }, { name: 'player/jumped' }]);
  });

  it('omits `detail` rather than carrying an empty one', () => {
    const bus = createGameEventBus();
    const seen: { name: string; detail?: string }[] = [];
    levelEventSource(bus)((event) => seen.push(event));

    publishSceneEvent(bus, 'player/stopped');

    /* `app/ui` reads a missing detail as "no offer", which is a real state. An
       `undefined` sitting in the key would make "nobody set it" and "there isn't
       one" the same value. */
    expect(Object.hasOwn(seen[0] ?? {}, 'detail')).toBe(false);
  });

  it('stops delivering once unsubscribed', () => {
    const bus = createGameEventBus();
    const listener = vi.fn();
    const off = levelEventSource(bus)(listener);

    publishSceneEvent(bus, 'player/moved');
    off();
    publishSceneEvent(bus, 'player/moved');

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('publishes the one event no scene can, naming the level', () => {
    const bus = createGameEventBus();
    const seen: { name: string; detail?: string }[] = [];
    levelEventSource(bus)((event) => seen.push(event));

    publishLevelFailed(bus, 'ottawa');

    expect(seen).toEqual([{ name: 'level/failed', detail: 'ottawa' }]);
  });
});

describe('the wiring end to end: bus -> announcer -> live region', () => {
  const announcerOver = (bus: ReturnType<typeof createGameEventBus>) => {
    const said: string[] = [];
    const announcer = createLevelAnnouncer(levelEventSource(bus), {
      locale: 'en',
      announce: (message) => said.push(message),
      arrival: 'You are in Ottawa.',
    });
    return { said, announcer };
  };

  it('speaks the arrival once the level is ready', () => {
    const bus = createGameEventBus();
    const { said } = announcerOver(bus);

    publishSceneEvent(bus, 'level/ready', 'ottawa');

    expect(said).toEqual(['You are in Ottawa.']);
  });

  it('speaks a level failure in the player language, not the engine code', () => {
    const bus = createGameEventBus();
    const { said } = announcerOver(bus);

    publishLevelFailed(bus, 'atlantis');

    expect(said).toHaveLength(1);
    expect(said[0]).toContain('could not load');
    expect(said[0], 'a level id reached a player').not.toContain('atlantis');
  });

  it('produces zero announcements from four hundred movement events', () => {
    const bus = createGameEventBus();
    const { said } = announcerOver(bus);

    for (let frame = 0; frame < 100; frame += 1) {
      publishSceneEvent(bus, 'player/moved');
      publishSceneEvent(bus, 'player/stopped');
      publishSceneEvent(bus, 'player/jumped');
      publishSceneEvent(bus, 'player/braked');
    }

    expect(
      said,
      'the live region was flooded by movement, which is the failure TN-LEVEL-08 names',
    ).toEqual([]);
  });

  it('says nothing for an engagement, because the modal that opens is read on arrival', () => {
    const bus = createGameEventBus();
    const { said } = announcerOver(bus);

    publishSceneEvent(bus, 'poi/engaged', 'parliament-hill');
    publishSceneEvent(bus, 'npc/engaged', 'officer');

    expect(said).toEqual([]);
  });

  it('stops listening when the announcer is destroyed, so a level unload goes quiet', () => {
    const bus = createGameEventBus();
    const { said, announcer } = announcerOver(bus);

    announcer.destroy();
    publishSceneEvent(bus, 'level/ready', 'ottawa');

    expect(said).toEqual([]);
  });
});
