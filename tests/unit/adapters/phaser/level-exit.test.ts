/**
 * Where a level ends, and the promise that arriving there is said exactly once.
 *
 * The scene cannot be loaded under `environment: 'node'` — it imports Phaser at
 * module scope — so the rule lives in a pure module beside it and is proved
 * here, against the real level documents, the real locomotion strategy and the
 * real camera. That is deliberate: "the player reached the end" is arithmetic
 * over a run of frames, and proving it by driving a browser would prove it once,
 * on one machine, for one level.
 *
 * Three things are asserted, and the second is the one the feature exists for:
 *
 *  1. the line sits inside the level — ahead of the spawn, short of the wall —
 *     for every level in `content/levels`, at whatever size and spawn they are
 *     authored with;
 *  2. **it fires once.** Walked past, walked back, walked past again: one
 *     arrival. A completion card per frame is what the alternative looks like;
 *  3. when it fires the player is still walking freely and the camera has
 *     already reached its right-hand clamp, so the moment is not "you are stuck
 *     against an invisible wall while the world is still sliding".
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { Vec2 } from '@application/ports';
import { EXIT_VIEW_FRACTION, exitLineX, watchExit } from '@adapters/phaser/level-exit';
import { followCamera, scrollBounds } from '@adapters/phaser/level-camera';
import { groundYAt, levelBounds, slopeAt } from '@adapters/phaser/ground-profile';
import { applyBounds, createLocomotion } from '@adapters/phaser/locomotion';
import { parseLevelDocument, type SceneLevel } from '@adapters/phaser/level-document';

import gameConfigJson from '@content/game.config.json';

const CONFIG = gameConfigJson as {
  readonly locomotionModes: readonly string[];
  readonly designWidth: number;
  readonly designHeight: number;
};

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/**
 * Every level that ships, not one that was convenient.
 *
 * A threshold expressed as a fraction of the camera's view is only sound if it
 * lands inside every authored level, and the four documents differ by a factor
 * of nearly two in length and by 300 px in spawn. Reading the directory means
 * the fifth level is checked the day it is added and nobody has to remember.
 */
const LEVELS: readonly SceneLevel[] = readdirSync(`${REPO_ROOT}content/levels`)
  .filter((name) => name.endsWith('.json'))
  .map((name) => {
    const parsed = parseLevelDocument(
      JSON.parse(readFileSync(`${REPO_ROOT}content/levels/${name}`, 'utf8')),
      CONFIG.locomotionModes,
    );
    if (!parsed.ok) throw new Error(`${name}: ${parsed.error.message}`);
    return parsed.value;
  });

/** What the scene computes: design pixels the camera can see, in world units. */
const viewWidthOf = (level: SceneLevel): number => CONFIG.designWidth / level.camera.zoom;

const lineOf = (level: SceneLevel): number =>
  exitLineX({
    bounds: levelBounds(level.ground, level.size),
    spawnX: level.spawn.x,
    viewWidth: viewWidthOf(level),
  });

interface WalkFrame {
  readonly x: number;
  readonly camera: Vec2;
  readonly arrived: boolean;
}

/**
 * Run the level for real, at 60 fps, holding one direction.
 *
 * The same strategy, the same bounds clamp and the same camera the scene uses,
 * so an assertion here is about the game rather than about a model of it.
 */
function walk(
  level: SceneLevel,
  plan: readonly { readonly move: -1 | 0 | 1; readonly frames: number }[],
): { readonly frames: readonly WalkFrame[]; readonly arrivals: number } {
  const tuning = level.locomotion[0];
  if (tuning === undefined) throw new Error(`${level.id} declares no locomotion`);

  const bounds = levelBounds(level.ground, level.size);
  const locomotion = createLocomotion(tuning);
  const watch = watchExit({ bounds, spawnX: level.spawn.x, viewWidth: viewWidthOf(level) });

  let state = locomotion.spawn(level.spawn.x, groundYAt(level.ground, level.spawn.x), 'right');
  let camera: Vec2 = { x: 0, y: 0 };
  const dt = 1 / 60;
  const frames: WalkFrame[] = [];
  let arrivals = 0;

  for (const leg of plan) {
    for (let frame = 0; frame < leg.frames; frame += 1) {
      const step = locomotion.step(
        state,
        {
          move: leg.move,
          jumpPressed: false,
          jumpHeld: false,
          interactPressed: false,
          slope: slopeAt(level.ground, state.x),
          groundY: groundYAt(level.ground, state.x),
        },
        dt,
      );
      state = applyBounds(step.state, bounds, tuning, dt);
      camera = followCamera({
        camera,
        target: { x: state.x, y: state.y },
        velocityX: state.velocityX,
        facing: state.facing,
        tuning: level.camera,
        viewport: { width: CONFIG.designWidth, height: CONFIG.designHeight },
        world: level.size,
        dtSeconds: dt,
        reducedMotion: false,
      });

      const arrived = watch.arrived(state.x);
      if (arrived) arrivals += 1;
      frames.push({ x: state.x, camera, arrived });
    }
  }

  return { frames, arrivals };
}

/** Long enough to cross any of the four levels end to end at their own speed. */
const TO_THE_END = 60 * 60;

describe('the end of a level is a place inside it', () => {
  it.each(LEVELS.map((level) => [level.id, level] as const))(
    '%s puts the line ahead of the spawn and short of the wall',
    (_id, level) => {
      const bounds = levelBounds(level.ground, level.size);
      const line = lineOf(level);

      expect(
        line,
        'the arrival line is at or behind the spawn, so the level would announce its own end ' +
          'on the first frame, before the player has moved.',
      ).toBeGreaterThan(level.spawn.x);
      expect(
        line,
        'the arrival line is at the wall. `applyBounds` clamps the player there and bleeds ' +
          'their speed, so the moment would open on a player who is already stuck.',
      ).toBeLessThan(bounds.right);
      expect(bounds.right - line).toBeLessThanOrEqual(
        viewWidthOf(level) * EXIT_VIEW_FRACTION + 1e-6,
      );
    },
  );

  it('never fires on the frame the level opens', () => {
    for (const level of LEVELS) {
      const { frames } = walk(level, [{ move: 0, frames: 1 }]);
      expect(frames[0]?.arrived, `${level.id} announced its end at the spawn`).toBe(false);
    }
  });

  it('is reached by walking, in every level, without touching the wall', () => {
    for (const level of LEVELS) {
      const bounds = levelBounds(level.ground, level.size);
      const { frames, arrivals } = walk(level, [{ move: 1, frames: TO_THE_END }]);
      const at = frames.find((frame) => frame.arrived);

      expect(arrivals, `${level.id} never announced its end`).toBe(1);
      expect(
        at?.x ?? Number.NaN,
        `${level.id} announced its end only once the player was clamped at the wall`,
      ).toBeLessThan(bounds.right);
    }
  });
});

describe('it fires once', () => {
  it.each(LEVELS.map((level) => [level.id, level] as const))(
    '%s says it once across the line, back over it, and across again',
    (_id, level) => {
      /* Out to the end, three seconds back the way they came — far enough to
         leave the zone at every one of the four speeds — and out again. This is
         the jostling that would otherwise produce a completion card a frame. */
      const { arrivals } = walk(level, [
        { move: 1, frames: TO_THE_END },
        { move: -1, frames: 180 },
        { move: 1, frames: 300 },
        { move: -1, frames: 60 },
        { move: 1, frames: 120 },
      ]);

      expect(arrivals).toBe(1);
    },
  );

  it('keeps its answer after the arrival, without re-deciding it', () => {
    const level = LEVELS[0];
    if (level === undefined) throw new Error('content/levels is empty');
    const watch = watchExit({
      bounds: levelBounds(level.ground, level.size),
      spawnX: level.spawn.x,
      viewWidth: viewWidthOf(level),
    });

    expect(watch.reached).toBe(false);
    expect(watch.arrived(watch.x - 1)).toBe(false);
    expect(watch.arrived(watch.x)).toBe(true);
    expect(watch.reached).toBe(true);
    expect(watch.arrived(watch.x)).toBe(false);
    expect(watch.arrived(watch.x + 1000)).toBe(false);
  });
});

describe('the world has stopped moving when it fires', () => {
  it.each(LEVELS.map((level) => [level.id, level] as const))(
    '%s has the camera already at its right-hand clamp',
    (_id, level) => {
      const { frames } = walk(level, [{ move: 1, frames: TO_THE_END }]);
      const at = frames.find((frame) => frame.arrived);
      const max = scrollBounds(
        level.size,
        { width: CONFIG.designWidth, height: CONFIG.designHeight },
        level.camera,
      ).maxX;

      expect(
        at?.camera.x ?? Number.NaN,
        'the camera was still travelling when the level said the player had arrived, so the ' +
          'completion card would open over a sliding world.',
      ).toBeCloseTo(max, 6);
    },
  );
});

describe('a level too short to hold the zone', () => {
  it('still asks the player to walk, and still ends before the wall', () => {
    /* A world narrower than one camera view: `right - view/2` lands behind the
       spawn, and a line behind the spawn fires on frame one. */
    const line = exitLineX({ bounds: { left: 0, right: 800 }, spawnX: 640, viewWidth: 1080 });

    expect(line).toBeGreaterThan(640);
    expect(line).toBeLessThan(800);
  });

  it('refuses to place the line outside the level when the document is broken', () => {
    /* A spawn at or past the end is a broken document. The line is the end
       itself — the arrival is immediate and honest — rather than a number
       outside the world that could never be reached. */
    expect(exitLineX({ bounds: { left: 0, right: 500 }, spawnX: 900, viewWidth: 1080 })).toBe(500);
  });

  it('falls back to the wall, not to the middle, when the view is nonsense', () => {
    /* `viewWidth` is `designWidth / camera.zoom` and the schema guarantees both,
       so this is a programming error rather than a document. The arrival still
       happens — at the latest place it can, which is late but true. Ending the
       level halfway through would be a worse answer than a late one. */
    expect(
      exitLineX({ bounds: { left: 0, right: 9000 }, spawnX: 640, viewWidth: Number.NaN }),
    ).toBe(9000);
    expect(exitLineX({ bounds: { left: 0, right: 9000 }, spawnX: 640, viewWidth: 0 })).toBe(9000);
  });
});
