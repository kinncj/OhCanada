/**
 * The engagement gesture a paused level has to hold, rather than freeze before.
 *
 * ## The defect
 *
 * Engaging a landmark or a character fires the rig's `interact` trigger, and the
 * engagement it announces opens a card or a dialogue that pauses the level — in
 * the same frame, synchronously, from inside `LevelScene.update`. The puppet still
 * updates once after that, so the pose *is* applied before the pause takes hold.
 * It is applied at elapsed 0, though, and every `interact` the rig ships begins on
 * its rest key and reaches only at t = 0.4 to 0.75. A paused scene never advances,
 * so the frame left on screen for as long as the card is open is the rest pose:
 * `train/interact`'s arm up to the dome glass was drawn by nothing a player could
 * see, and the gesture played out behind their back after the card closed.
 *
 * ## The answer, in the rig's own data
 *
 * When an engagement pauses the level, the scene advances the engaged puppet to
 * the key of its gesture that is furthest from rest, once, after the frame's own
 * update. That key is read off the timeline rather than chosen: the sum of every
 * part's displacement from the first key, largest wins, earliest on a tie. It is
 * strictly inside the state, so the trigger is still held and the level resuming
 * plays the remainder back to rest. An engagement that does not pause is untouched.
 *
 * Pure: rig in, milliseconds out. No Phaser, and no mode's name.
 */

import type { RigDocument, RigKeyframe } from '@application/ports';

import { poseFor } from './locomotion-pose';

/**
 * How far into `state`, as posed for `mode`, its gesture is most fully made, in
 * milliseconds; 0 when there is nothing to hold.
 *
 * 0 for no rig, a state the rig does not declare, a state that is not `once` (a
 * loop has no end to hold before, a hold already stops on its last key), and a
 * `once` state whose inner keys never leave its first.
 */
export function gestureHoldMs(
  rig: RigDocument | null | undefined,
  mode: string | null | undefined,
  state: string,
): number {
  if (rig === null || rig === undefined) return 0;
  const animation = rig.states[poseFor(rig, mode, state)];
  if (animation === undefined || animation.loop !== 'once' || !(animation.durationMs > 0)) return 0;
  const first = animation.keys[0];
  if (first === undefined) return 0;

  let furthest = 0;
  let at = 0;
  for (const key of animation.keys) {
    /* Inner keys only: t = 1 ends the state and releases the trigger. */
    if (!(key.t > 0 && key.t < 1)) continue;
    const distance = displacement(first, key);
    if (distance > furthest) {
      furthest = distance;
      at = key.t;
    }
  }
  return furthest > 0 ? at * animation.durationMs : 0;
}

/** Every part's `[dx, dy, rotation]` distance between two keys, summed. */
function displacement(from: RigKeyframe, to: RigKeyframe): number {
  let total = 0;
  for (const part of new Set([...Object.keys(from.parts), ...Object.keys(to.parts)])) {
    const a = from.parts[part] ?? REST;
    const b = to.parts[part] ?? REST;
    total += Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]) + Math.abs(b[2] - a[2]);
  }
  return total;
}

const REST: readonly [number, number, number] = [0, 0, 0];
