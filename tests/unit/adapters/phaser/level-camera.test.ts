/**
 * TN-LEVEL-04, the portrait camera, asserted against the function rather than
 * through a browser.
 *
 * The story's framing rules are quantitative — "between 25 and 70 percent of the
 * canvas width", "`data-camera-x` never decreases while the skater is moving
 * right", "more of the canal ahead is visible than behind", "no empty space is
 * shown past the end of the painted level" — and every one of them is a property
 * of `followCamera` over a run of frames. Checking them here means they hold at
 * every frame rate and on every device, not just on the one Playwright happened
 * to be driving.
 *
 * The numbers come from `content/levels/ottawa.json`, so a level that re-frames
 * itself is still checked against the same rules.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { CameraTuning, Vec2 } from '@application/ports';
import {
  cameraView,
  desiredScroll,
  followCamera,
  followLerpFor,
  intersectsView,
  scaledViewport,
  screenFraction,
  scrollBounds,
} from '@adapters/phaser/level-camera';
import { createLocomotion } from '@adapters/phaser/locomotion';
import { groundYAt, levelBounds, slopeAt } from '@adapters/phaser/ground-profile';
import { parseLevelDocument } from '@adapters/phaser/level-document';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

const ottawa = (() => {
  const parsed = parseLevelDocument(
    JSON.parse(readFileSync(`${REPO_ROOT}content/levels/ottawa.json`, 'utf8')),
  );
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.value;
})();

const VIEWPORT = { width: 1080, height: 1920 };

/** Cruise speed, read off the level rather than guessed. */
const CRUISE = ottawa.locomotion[0]?.maxSpeed ?? 0;
const DT = 1 / 60;

const follow = (
  camera: Vec2,
  target: Vec2,
  velocityX: number,
  overrides: Partial<{ tuning: CameraTuning; reducedMotion: boolean }> = {},
): Vec2 =>
  followCamera({
    camera,
    target,
    velocityX,
    facing: velocityX < 0 ? 'left' : 'right',
    tuning: overrides.tuning ?? ottawa.camera,
    viewport: VIEWPORT,
    world: ottawa.size,
    dtSeconds: DT,
    reducedMotion: overrides.reducedMotion ?? false,
  });

describe('followLerpFor', () => {
  it('is the authored value at exactly 60 fps', () => {
    expect(followLerpFor(ottawa.camera, 1 / 60, false)).toBeCloseTo(ottawa.camera.followLerp, 6);
  });

  it('follows at the same rate on a 30 fps device, not at half the speed', () => {
    const sixty = followLerpFor(ottawa.camera, 1 / 60, false);
    const thirty = followLerpFor(ottawa.camera, 1 / 30, false);
    /* Two 60 Hz steps must land where one 30 Hz step does. */
    expect(1 - (1 - sixty) ** 2).toBeCloseTo(thirty, 6);
  });

  it('never exceeds 1, so a long frame cannot make the camera overshoot', () => {
    for (const dt of [1 / 60, 1 / 30, 0.1, 1, 30]) {
      expect(followLerpFor(ottawa.camera, dt, false)).toBeLessThanOrEqual(1);
    }
  });

  it('is rigid under reduced motion, whatever the level authored', () => {
    expect(followLerpFor(ottawa.camera, 1 / 60, true)).toBe(1);
  });

  it('is rigid when a level authors a lerp of 1', () => {
    expect(followLerpFor({ ...ottawa.camera, followLerp: 1 }, 1 / 60, false)).toBe(1);
  });
});

describe('the camera looks ahead in the direction of travel', () => {
  it('shows more canal ahead than behind when cruising right', () => {
    const target = { x: 4_000, y: 1_240 };
    const settled = settle(target, CRUISE);
    const ahead = settled.x + scaledViewport(VIEWPORT, ottawa.camera).width - target.x;
    const behind = target.x - settled.x;
    expect(ahead).toBeGreaterThan(behind);
  });

  it('flips when the skater turns and cruises the other way', () => {
    const target = { x: 4_000, y: 1_240 };
    const settled = settle(target, -CRUISE);
    const ahead = target.x - settled.x;
    const behind = settled.x + scaledViewport(VIEWPORT, ottawa.camera).width - target.x;
    expect(ahead).toBeGreaterThan(behind);
  });

  it('still looks forward when the skater is standing still', () => {
    const target = { x: 4_000, y: 1_240 };
    const right = desiredScroll({
      camera: { x: 0, y: 0 },
      target,
      velocityX: 0,
      facing: 'right',
      tuning: ottawa.camera,
      viewport: VIEWPORT,
      world: ottawa.size,
      dtSeconds: DT,
      reducedMotion: false,
    });
    const left = desiredScroll({
      camera: { x: 0, y: 0 },
      target,
      velocityX: 0,
      facing: 'left',
      tuning: ottawa.camera,
      viewport: VIEWPORT,
      world: ottawa.size,
      dtSeconds: DT,
      reducedMotion: false,
    });
    expect(right.x).toBeGreaterThan(left.x);
  });
});

describe('the camera stops at the ends of the level', () => {
  it('never scrolls left of zero', () => {
    let camera = { x: 0, y: 0 };
    for (let index = 0; index < 300; index += 1) camera = follow(camera, { x: 0, y: 1_240 }, -600);
    expect(camera.x).toBe(0);
  });

  it('never shows empty space past the painted right edge', () => {
    const bounds = scrollBounds(ottawa.size, VIEWPORT, ottawa.camera);
    let camera = { x: 0, y: 0 };
    for (let index = 0; index < 600; index += 1) {
      camera = follow(camera, { x: ottawa.size.x, y: 1_240 }, 600);
    }
    expect(camera.x).toBe(bounds.maxX);
    expect(camera.x + scaledViewport(VIEWPORT, ottawa.camera).width).toBeLessThanOrEqual(
      ottawa.size.x + 1e-9,
    );
  });

  it('clamps to zero when the level is not bigger than the view', () => {
    const bounds = scrollBounds({ x: 500, y: 500 }, VIEWPORT, ottawa.camera);
    expect(bounds.maxX).toBe(0);
    expect(bounds.maxY).toBe(0);
  });

  it('accounts for zoom, because a zoomed camera sees less world', () => {
    const zoomed = { ...ottawa.camera, zoom: 2 };
    expect(scaledViewport(VIEWPORT, zoomed).width).toBe(VIEWPORT.width / 2);
    expect(scrollBounds(ottawa.size, VIEWPORT, zoomed).maxX).toBeGreaterThan(
      scrollBounds(ottawa.size, VIEWPORT, ottawa.camera).maxX,
    );
  });

  it('treats a zoom of zero as 1 rather than dividing by it', () => {
    expect(scaledViewport(VIEWPORT, { ...ottawa.camera, zoom: 0 }).width).toBe(VIEWPORT.width);
  });
});

/**
 * The framing assertions, driven by the real locomotion over the real ground.
 *
 * A synthetic sweep would prove the camera follows a number. Driving it with
 * `createLocomotion` over Ottawa's polyline proves it follows the *skater*,
 * including through the acceleration ramp and the coast where the two are least
 * in step.
 */
describe('the camera keeps the skater in frame while gliding', () => {
  const skate = ottawa.locomotion[0];
  if (skate === undefined) throw new Error('ottawa.json has no locomotion tuning');
  const bounds = levelBounds(ottawa.ground, ottawa.size);
  const locomotion = createLocomotion(skate);

  const drive = (holdSeconds: number, coastSeconds: number) => {
    let state = locomotion.spawn(
      ottawa.spawn.x,
      groundYAt(ottawa.ground, ottawa.spawn.x),
      'right',
    );
    let camera = follow({ x: 0, y: 0 }, { x: state.x, y: state.y }, 0);
    const trace: { camera: Vec2; player: Vec2; velocityX: number }[] = [];

    const phase = (move: number, seconds: number): void => {
      for (let index = 0; index < Math.round(seconds * 60); index += 1) {
        const step = locomotion.step(
          state,
          {
            move,
            jumpPressed: false,
            jumpHeld: false,
            interactPressed: false,
            slope: slopeAt(ottawa.ground, state.x),
            groundY: groundYAt(ottawa.ground, state.x),
          },
          DT,
        );
        state = step.state;
        state = { ...state, x: Math.min(bounds.right, Math.max(bounds.left, state.x)) };
        camera = follow(camera, { x: state.x, y: state.y }, state.velocityX);
        trace.push({ camera, player: { x: state.x, y: state.y }, velocityX: state.velocityX });
      }
    };

    phase(1, holdSeconds);
    phase(0, coastSeconds);
    return trace;
  };

  const trace = drive(3, 4);

  it('the premise: the skater actually moved a long way', () => {
    expect(trace.length).toBeGreaterThan(300);
    expect((trace.at(-1)?.player.x ?? 0) - ottawa.spawn.x).toBeGreaterThan(2_000);
  });

  it('keeps the skater between 25 and 70 percent of the canvas width', () => {
    for (const frame of trace) {
      const fraction = screenFraction(frame.camera, frame.player, VIEWPORT, ottawa.camera).x;
      expect(fraction, `player at ${(fraction * 100).toFixed(1)}% of the canvas`).toBeGreaterThan(
        0.25,
      );
      expect(fraction).toBeLessThan(0.7);
    }
  });

  it('never scrolls backwards while the skater is moving right', () => {
    for (let index = 1; index < trace.length; index += 1) {
      const previous = trace[index - 1];
      const current = trace[index];
      if ((current?.velocityX ?? 0) > 0) {
        expect(current?.camera.x ?? 0).toBeGreaterThanOrEqual((previous?.camera.x ?? 0) - 1e-9);
      }
    }
  });

  it('keeps the skater in the upper two thirds of the canvas (ADR-0002)', () => {
    for (const frame of trace) {
      const fraction = screenFraction(frame.camera, frame.player, VIEWPORT, ottawa.camera).y;
      expect(fraction, `player at ${(fraction * 100).toFixed(1)}% of the canvas height`)
        .toBeLessThan(2 / 3);
    }
  });

  it('never moves past the skater and back under reduced motion', () => {
    /* TN-LEVEL-09: "the camera follows without overshoot". Under reduced motion
       the follow is rigid, so the camera should sit at exactly its dead-zone
       distance and never cross the target. */
    let state = createLocomotion(skate).spawn(ottawa.spawn.x, 1_240, 'right');
    let camera = { x: 0, y: 0 };
    const locomotionRm = createLocomotion(skate);
    for (let index = 0; index < 240; index += 1) {
      state = locomotionRm.step(
        state,
        {
          move: index < 180 ? 1 : 0,
          jumpPressed: false,
          jumpHeld: false,
          interactPressed: false,
          slope: 0,
          groundY: 1_240,
        },
        DT,
      ).state;
      const next = follow(camera, { x: state.x, y: state.y }, state.velocityX, {
        reducedMotion: true,
      });
      expect(next.x).toBeGreaterThanOrEqual(camera.x - 1e-9);
      camera = next;
    }
  });
});

describe('the dead zone', () => {
  it('holds the camera still for a small drift', () => {
    const camera = { x: 1_000, y: 0 };
    const desired = desiredScroll({
      camera,
      target: { x: 1_600, y: 1_240 },
      velocityX: 1,
      facing: 'right',
      tuning: ottawa.camera,
      viewport: VIEWPORT,
      world: ottawa.size,
      dtSeconds: DT,
      reducedMotion: false,
    });
    /* Put the player exactly on the camera's wish, then nudge them inside the
       dead zone: the camera must not answer. */
    const parked = { x: desired.x, y: 0 };
    const nudged = follow(parked, { x: 1_600 + ottawa.camera.deadZone.x / 2, y: 1_240 }, 1);
    expect(nudged.x).toBeCloseTo(parked.x, 6);
  });

  it('chases only the part of the gap outside the zone, so leaving it is smooth', () => {
    const rigid = { ...ottawa.camera, followLerp: 1 };
    const target = { x: 4_000, y: 1_240 };
    const want = desiredScroll({
      camera: { x: 0, y: 0 },
      target,
      velocityX: 500,
      facing: 'right',
      tuning: rigid,
      viewport: VIEWPORT,
      world: ottawa.size,
      dtSeconds: DT,
      reducedMotion: false,
    });
    const settled = follow({ x: 0, y: 0 }, target, 500, { tuning: rigid });
    /* Rigid follow stops exactly `deadZone.x` short of the wish, not on it. */
    expect(settled.x).toBeCloseTo(want.x - rigid.deadZone.x, 6);
  });
});

/** Run the camera until it settles, so a look-ahead assertion is about the rest state. */
function settle(target: Vec2, velocityX: number): Vec2 {
  let camera = { x: target.x, y: 0 };
  for (let index = 0; index < 600; index += 1) camera = follow(camera, target, velocityX);
  return camera;
}

describe('what the camera can actually see', () => {
  /*
   * `data-layers-textured: 6` and `data-actors-drawn: 2` were both true of a
   * build whose screen was a gradient, an ice band, snow and one rounded
   * rectangle: the officer and the landmark were drawn correctly, 1 760 and
   * 4 760 design pixels off to the right. A count whose passing value does not
   * require the outcome is not a check (ADR-0024). This is the geometry that
   * replaced it.
   */
  const view = { x: 1000, y: 0, width: 1080, height: 1920 };

  it('sees something inside it', () => {
    expect(intersectsView({ x: 1200, y: 800, width: 240, height: 470 }, view)).toBe(true);
  });

  it('sees something that overlaps an edge', () => {
    expect(intersectsView({ x: 900, y: 0, width: 240, height: 470 }, view)).toBe(true);
    expect(intersectsView({ x: 2000, y: 0, width: 240, height: 470 }, view)).toBe(true);
  });

  it('does not see what is beyond it — which is the whole point', () => {
    /* Ottawa's officer, from the spawn: drawn, textured, faithfully composed,
       and 1 760 pixels away. */
    expect(intersectsView({ x: 2280, y: 800, width: 240, height: 470 }, view)).toBe(false);
    expect(intersectsView({ x: 100, y: 0, width: 240, height: 470 }, view)).toBe(false);
  });

  it('does not see something with no area, rather than counting it as touching', () => {
    /* A zero-sized frame is a packing failure, and "it is at a point inside the
       view" is the kind of true statement that would let one through. */
    expect(intersectsView({ x: 1200, y: 800, width: 0, height: 470 }, view)).toBe(false);
    expect(intersectsView({ x: 1200, y: 800, width: 240, height: 0 }, view)).toBe(false);
  });

  it('reports the world the camera sees, scaled by its zoom', () => {
    const viewport = VIEWPORT;
    expect(cameraView({ x: 300, y: 40 }, viewport, { ...ottawa.camera, zoom: 1 })).toEqual({
      x: 300,
      y: 40,
      width: 1080,
      height: 1920,
    });
    /* At zoom 2 the camera sees half as much world, so half as much art is on
       screen — the counter has to move with the zoom or it is describing a
       different camera. */
    expect(cameraView({ x: 0, y: 0 }, viewport, { ...ottawa.camera, zoom: 2 })).toEqual({
      x: 0,
      y: 0,
      width: 540,
      height: 960,
    });
  });
});
