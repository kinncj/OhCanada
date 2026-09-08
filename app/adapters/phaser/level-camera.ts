/**
 * The portrait camera (TN-LEVEL-04), as arithmetic.
 *
 * Pure on purpose: "the skater's position on screen stays between 25 and 70
 * percent of the canvas width for the whole time" and "`data-camera-x` never
 * decreases while the skater is moving right" are properties of a function, and
 * proving them by driving a browser would be proving them once on one machine.
 * `level-scene.ts` does nothing but hand `Phaser.Cameras.Scene2D.Camera` the
 * numbers this returns.
 *
 * Every knob comes from `level.schema.json#/$defs/cameraTuning`, so re-framing a
 * level is a content edit:
 *
 *   - `offset` is the look-ahead. It is applied *in the direction of travel*,
 *     which is the whole of "more of the canal ahead is visible than behind" and
 *     what makes it flip when the skater turns. A negative `offset.y` lifts the
 *     player above centre so the lower third stays free for the question card
 *     (ADR-0002).
 *   - `deadZone` is how far the player may drift before the camera answers.
 *     Bigger means calmer; too big and the player leaves the 25–70 % band, which
 *     is why the band is asserted against this function and not eyeballed.
 *   - `followLerp` is per-frame at 60 fps and is re-based onto the real frame
 *     time below, so a 30 fps device follows at the same *rate* rather than at
 *     half the speed.
 *   - `zoom` divides the viewport: at zoom 2 the camera sees half as much world,
 *     so the clamp has to use the scaled view and not the canvas size.
 *
 * Reduced motion is not a tuning value and is not read from the level. It is
 * passed in, and all it does is make the follow rigid — see `followLerpFor`.
 */

import type { CameraTuning, Vec2 } from '@application/ports';

/** The view the camera clamps inside, in world units. */
export interface CameraViewport {
  readonly width: number;
  readonly height: number;
}

export interface CameraFollowInput {
  readonly camera: Vec2;
  readonly target: Vec2;
  /** Signed horizontal velocity. Its sign is the look-ahead direction. */
  readonly velocityX: number;
  /** Used when the player is at rest, so a stopped skater still looks forward. */
  readonly facing: 'left' | 'right';
  readonly tuning: CameraTuning;
  /** Canvas size in design pixels, before `zoom`. */
  readonly viewport: CameraViewport;
  readonly world: Vec2;
  readonly dtSeconds: number;
  /** Reduced motion pins the camera to its target instead of easing to it. */
  readonly reducedMotion: boolean;
}

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, value));

/**
 * `followLerp` is authored per frame at 60 fps. Re-based so the same number
 * means the same *rate* at any frame time.
 *
 * `1 - (1 - lerp)^(dt * 60)` rather than `lerp * dt * 60`, because the linear
 * form overshoots — and passes 1 — as soon as the frame is longer than
 * `1 / (60 * lerp)`, which on a 30 fps Android is a camera that shoots past the
 * player and comes back. TN-LEVEL-09 asks for exactly that not to happen, and it
 * asks for it under reduced motion; this makes it true at every setting.
 */
export function followLerpFor(tuning: CameraTuning, dtSeconds: number, reducedMotion: boolean): number {
  if (reducedMotion) return 1;
  const lerp = clamp(tuning.followLerp, 0, 1);
  if (lerp >= 1) return 1;
  const frames = Math.max(0, dtSeconds) * 60;
  return 1 - (1 - lerp) ** frames;
}

/** How much world the camera can see, after `zoom`. */
export function scaledViewport(viewport: CameraViewport, tuning: CameraTuning): CameraViewport {
  const zoom = tuning.zoom > 0 ? tuning.zoom : 1;
  return { width: viewport.width / zoom, height: viewport.height / zoom };
}

/**
 * The scroll position the camera wants, before the dead zone and before easing.
 *
 * `offset` is added on the far side of the player: skating right puts the player
 * left of centre and shows more canal ahead.
 */
export function desiredScroll(input: CameraFollowInput): Vec2 {
  const view = scaledViewport(input.viewport, input.tuning);
  const heading = input.velocityX === 0 ? (input.facing === 'left' ? -1 : 1) : Math.sign(input.velocityX);
  return {
    x: input.target.x - view.width / 2 + input.tuning.offset.x * heading,
    y: input.target.y - view.height / 2 + input.tuning.offset.y,
  };
}

/** The camera's scroll bounds: the level, minus what the camera can see of it. */
export function scrollBounds(
  world: Vec2,
  viewport: CameraViewport,
  tuning: CameraTuning,
): { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number } {
  const view = scaledViewport(viewport, tuning);
  return {
    minX: 0,
    maxX: Math.max(0, world.x - view.width),
    minY: 0,
    maxY: Math.max(0, world.y - view.height),
  };
}

/**
 * One frame of camera follow: dead zone, then ease, then clamp.
 *
 * That order is the contract. Clamping last is what makes "the camera stops at
 * the ends of the level" true without a special case — the ease never gets to
 * pull the view past the painted world, so there is never a frame of empty space
 * to correct.
 */
export function followCamera(input: CameraFollowInput): Vec2 {
  const desired = desiredScroll(input);
  const lerp = followLerpFor(input.tuning, input.dtSeconds, input.reducedMotion);
  const bounds = scrollBounds(input.world, input.viewport, input.tuning);

  const axis = (current: number, want: number, deadZone: number, low: number, high: number): number => {
    const gap = want - current;
    const slack = Math.max(0, deadZone);
    /* Inside the dead zone the camera holds still; outside it, it chases only
       the part of the gap that is outside, so leaving the zone is smooth rather
       than a jump of `deadZone` pixels. */
    const pull = Math.abs(gap) <= slack ? 0 : gap - Math.sign(gap) * slack;
    return clamp(current + pull * lerp, low, high);
  };

  return {
    x: axis(input.camera.x, desired.x, input.tuning.deadZone.x, bounds.minX, bounds.maxX),
    y: axis(input.camera.y, desired.y, input.tuning.deadZone.y, bounds.minY, bounds.maxY),
  };
}

/**
 * Where the player is drawn, as a fraction of the canvas.
 *
 * The framing rules in TN-LEVEL-04 are written about the screen, not the world,
 * so this is what the tests assert against and what the scene probe could report
 * if a scenario ever needed it. 0 is the left/top edge, 1 the right/bottom.
 */
export function screenFraction(
  camera: Vec2,
  target: Vec2,
  viewport: CameraViewport,
  tuning: CameraTuning,
): Vec2 {
  const view = scaledViewport(viewport, tuning);
  return {
    x: view.width === 0 ? 0 : (target.x - camera.x) / view.width,
    y: view.height === 0 ? 0 : (target.y - camera.y) / view.height,
  };
}
