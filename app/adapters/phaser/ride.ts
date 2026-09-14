/**
 * A ride: the vehicle or animal a level draws around the player (ADR-0031).
 *
 * ## The defect
 *
 * A player on the Prairies reported that the character "walks by itself on a
 * track". The HUD said Train, the tuning drove like a train, and the only figure
 * on the rails was a person walking. The rig could not fix it alone:
 * `assets/style/rig-contract.md` §11.5 records that a car a passenger visibly
 * rides is wider than the screen, that as rig equipment it would be charged to
 * every level's atlas, and that a seated pose with no car under it is a figure
 * sitting in mid-air. What was missing was a thing in the level that travels
 * with the player.
 *
 * ## The shape
 *
 * `level.schema.json#/$defs/ride`. A ride is **level art registered to the
 * rider**, not a character and not equipment: the rig poses the rider with its
 * `<mode>/<state>` states, and the ride says two things about its own art —
 * where the rider's feet rest (`riderAnchor`) and which of its rows lies on the
 * level's ground (`groundLineY`). Everything this module computes follows from
 * those two numbers and the art's size, which the scene reads off the loaded
 * texture rather than restating.
 *
 * `groundLineY` above the art's bottom row is what lets a ride run on a nearer
 * line than the one the level's landmarks and people stand on. Prairie-rail's
 * train does, and it is not a stylistic choice: a passenger car standing on the
 * walking line is taller than the container car and the guide placed there, and
 * whichever was drawn in front would hide the other at the very moment the
 * player stops to engage it.
 *
 * Pure: no Phaser, no DOM, no clock. The scene hands Phaser the numbers.
 */

import type { Ride, RideArt, RideBob } from '@application/ports';

/** A loaded texture's size, in design pixels (ride art ships pinned to 1x). */
export interface RideArtSize {
  readonly width: number;
  readonly height: number;
}

/**
 * The ride for the mode the player is moving by, or `null` when that mode has
 * none — which is most modes on most levels, and is not a failure.
 *
 * Exactly one or none. `level-document.ts` refuses a level where two rides carry
 * one mode, so reaching the throw means a `SceneLevel` was built without the
 * parser; `find` would have quietly chosen one of them (ADR-0024).
 */
export function rideFor(rides: readonly Ride[], mode: string): Ride | null {
  const matching = rides.filter((ride) => ride.mode === mode);
  if (matching.length > 1) {
    throw new TypeError(
      `${String(matching.length)} rides carry the mode "${mode}". The parser refuses that; ` +
        'reaching here means the level was not parsed.',
    );
  }
  return matching[0] ?? null;
}

export interface RidePlacementInput {
  readonly ride: Ride;
  /** The art's size; every layer of one ride shares it. */
  readonly size: RideArtSize;
  /** The rider's world x — the physics position, which the camera also follows. */
  readonly riderX: number;
  /** The ground polyline's y under the rider. */
  readonly groundY: number;
  readonly facing: 'left' | 'right';
  /** This frame's vertical rock, from {@link rideBobPx}. Negative is up. */
  readonly bobPx: number;
}

export interface RidePlacement {
  /**
   * World x of the art's horizontal centre. The centre and not the left edge,
   * because the scene draws with origin (0.5, 0) so that mirroring a layer
   * leaves it where it was.
   */
  readonly centreX: number;
  /** World y of the art's top edge, rock included. */
  readonly top: number;
  /** Whether the art is mirrored this frame. */
  readonly flipX: boolean;
  /**
   * World y the rider's sole line is drawn at. The physics position is not
   * moved; only where the rig is drawn is. Rock included, so rider and ride
   * never separate by a pixel.
   */
  readonly riderY: number;
  /** World y of the track strip's top edge, or `null` for a ride with none. Never rocks. */
  readonly trackTop: number | null;
}

/**
 * Where a ride's art, its rider and its track go this frame.
 *
 * The art's `riderAnchor` lands on the rider's x, and its `groundLineY` row on
 * the ground under them. A ride that turns with its rider is mirrored about that
 * anchor, so the rider stays in the same seat when they face the other way; one
 * that does not turn keeps its art and lets the rider turn in place.
 */
export function ridePlacement(input: RidePlacementInput): RidePlacement {
  const { ride, size, riderX, groundY, facing, bobPx } = input;
  const flipX = ride.turnsWithRider && facing === 'left';
  const anchorX = flipX ? size.width - ride.riderAnchor.x : ride.riderAnchor.x;
  const restTop = groundY - ride.groundLineY;
  const top = restTop + bobPx;
  return {
    centreX: riderX - anchorX + size.width / 2,
    top,
    flipX,
    riderY: top + ride.riderAnchor.y,
    trackTop: ride.track === undefined ? null : restTop + ride.track.topY,
  };
}

export interface RideBobInput {
  readonly bob: RideBob | undefined;
  /** Distance travelled so far, design pixels. The rhythm follows the ground going by. */
  readonly distancePx: number;
  /** Speed as a fraction of the mode's `maxSpeed`; clamped to 0..1. */
  readonly speedFraction: number;
  readonly reducedMotion: boolean;
}

/**
 * The vertical rock a ride and its rider share this frame, in design pixels.
 * Negative is up.
 *
 * `|sin|` over distance, so the ride lifts between rail joints and settles on
 * each one, and scaled by speed, so a stopped train is still whatever phase it
 * stopped at. **Zero under reduced motion**, unconditionally: CLAUDE.md lists
 * "reduced motion disables parallax easing, particles and squash-and-stretch",
 * and a rocking vehicle is the same kind of movement nobody asked for. That is
 * the engine's rule and a level cannot opt out of it, which is why no field in
 * `rideBob` could express one.
 */
export function rideBobPx(input: RideBobInput): number {
  const { bob } = input;
  if (bob === undefined || input.reducedMotion) return 0;
  const raw = Number.isFinite(input.speedFraction) ? input.speedFraction : 0;
  const speed = Math.min(1, Math.max(0, raw));
  if (speed === 0 || bob.amplitudePx === 0) return 0;
  /* The phase is taken from the position inside one period, so a joint lands on
     sin(0) exactly; sin(π · n) in floating point is a few 1e-16 off zero, which
     would leave the car "settled" a hair above the rail on every joint but the first. */
  const within = ((input.distancePx % bob.periodPx) + bob.periodPx) % bob.periodPx;
  const phase = Math.sin((Math.PI * within) / bob.periodPx);
  const lift = bob.amplitudePx * speed * phase;
  return lift === 0 ? 0 : -lift;
}

/**
 * Every texture one layer can draw: its still, and its cycle's rest frame and
 * gait, each once. A cycle may name the layer's own `key` among its frames, and
 * that is one texture, not two.
 */
export function rideLayerKeys(layer: RideArt): readonly string[] {
  if (layer.cycle === undefined) return [layer.key];
  return [...new Set([layer.key, layer.cycle.rest, ...layer.cycle.frames])];
}

export interface RideFrameInput {
  readonly layer: RideArt;
  /** Distance travelled so far, design pixels — the same count the rock reads. */
  readonly distancePx: number;
  /** Horizontal speed this frame, px/s; the sign is ignored. Zero, or not a number, is at rest. */
  readonly speed: number;
  readonly reducedMotion: boolean;
}

/**
 * The texture a ride layer draws this frame (ADR-0035).
 *
 * **By distance, not by time.** One frame per `framePx` travelled, counted from
 * the same distance as the rock, so a horse's legs keep pace with the trail going
 * by at a walk and at cruise alike, slow as the drive brakes, and never run on
 * the spot. **At rest, `rest`**, whatever frame the ride stopped on. **Under
 * reduced motion, the layer's `key` and nothing else**, at every speed and every
 * distance: CLAUDE.md lists "reduced motion disables parallax easing, particles
 * and squash-and-stretch", and legs flicking through a cycle are the same kind of
 * movement. One frame held is the whole of the rule — a switch from a standing
 * frame to a stride as the player sets off would itself be the motion asked
 * away. A layer with no cycle is its `key`, which is every ride before this.
 */
export function rideFrameKey(input: RideFrameInput): string {
  const { layer } = input;
  const cycle = layer.cycle;
  if (cycle === undefined || input.reducedMotion) return layer.key;
  const moving = Number.isFinite(input.speed) && input.speed !== 0;
  if (!moving) return cycle.rest;
  const count = cycle.frames.length;
  const period = cycle.framePx * count;
  if (!Number.isFinite(input.distancePx) || !(period > 0)) return cycle.frames[0] ?? layer.key;
  /* Inside one period first, so a long ride does not lose the frame to floating
     point, and a negative count (nothing produces one) still lands on a frame. */
  const within = ((input.distancePx % period) + period) % period;
  const index = Math.min(count - 1, Math.floor(within / cycle.framePx));
  return cycle.frames[index] ?? layer.key;
}

/**
 * Everything wrong with a ride's art as loaded, as sentences, or `[]`.
 *
 * `sizeOf` answers `null` for a key the texture manager does not have. Every
 * problem is reported rather than the first, because an art pass that fixes one
 * and meets the next on the following build is a slow way to learn three things.
 */
export function rideArtProblems(
  ride: Ride,
  sizeOf: (key: string) => RideArtSize | null,
): readonly string[] {
  const problems: string[] = [];
  /* Every frame of every layer, because a frame that did not load is a layer that
     vanishes mid-stride, and a frame of another size moves the rider's seat. */
  const artKeys = [...new Set(ride.art.flatMap((layer) => rideLayerKeys(layer)))];
  const keys = [...artKeys, ...(ride.track ? [ride.track.artKey] : [])];
  for (const key of keys) {
    if (sizeOf(key) === null) {
      problems.push(
        `the ride for "${ride.mode}" names the texture "${key}", which did not load. The rider ` +
          'is posed for a ride that is not on screen.',
      );
    }
  }

  const sizes = artKeys
    .map((key) => ({ key, size: sizeOf(key) }))
    .filter((entry): entry is { key: string; size: RideArtSize } => entry.size !== null);
  const first = sizes[0];
  if (first === undefined) return problems;

  for (const other of sizes.slice(1)) {
    if (other.size.width !== first.size.width || other.size.height !== first.size.height) {
      problems.push(
        `the ride for "${ride.mode}" has art of two sizes: "${first.key}" is ` +
          `${String(first.size.width)}x${String(first.size.height)} and "${other.key}" is ` +
          `${String(other.size.width)}x${String(other.size.height)}. One anchor cannot register both.`,
      );
    }
  }

  const { x, y } = ride.riderAnchor;
  if (x < 0 || y < 0 || x > first.size.width || y > first.size.height) {
    problems.push(
      `the ride for "${ride.mode}" anchors its rider at (${String(x)}, ${String(y)}), outside its ` +
        `${String(first.size.width)}x${String(first.size.height)} art.`,
    );
  }
  if (ride.groundLineY > first.size.height) {
    problems.push(
      `the ride for "${ride.mode}" puts the ground on row ${String(ride.groundLineY)} of art ` +
        `${String(first.size.height)} rows tall, so the whole ride would hang below the ground.`,
    );
  }
  return problems;
}
