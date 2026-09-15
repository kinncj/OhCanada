/**
 * Where the player's head is while a stop holds them at each subject. ADR-0049.
 *
 * At the North's sternwheeler the mark sat on the player's face: the drive rests
 * the player level with a landmark (ADR-0032), the landmark was lower than the
 * player, and the mark went a fixed height above its art. Nothing asked where the
 * player would be standing when the mark mattered most.
 *
 * This answers that, for `interaction-affordance.ts` to keep clear of: for every
 * subject a drive stops at, one box covering the player's head over every place
 * the stop can bring them to rest — travelling right and travelling left, from
 * the aim to one landing slack short of it (`stand-off.ts#landingSlackPx`).
 *
 * The head is the rig's own (`figure-extent.ts`): every option the creator offers,
 * in the mode's equipment, both as authored and through every keyframe of the
 * mode's idle pose — a seated rider's head is lower than a walker's and a leaning
 * one further forward — lifted or lowered by the ride's seat when there is one.
 *
 * Pure: no Phaser, no DOM, no clock.
 */

import type { LocomotionTuning, Ride, RigDocument, Vec2 } from '@application/ports';

import { restXFor, type AutoStopSubject } from './auto-stop';
import { playerArtboard } from './character-cast';
import { figureBoxes, HEAD_PARTS, mirrorBox, unionBox, type FigureBox } from './figure-extent';
import { groundYAt } from './ground-profile';
import { landingSlackPx } from './stand-off';
import type { TargetRect } from './touch-controls';

/** The pose a stop leaves the player in: the rig's resting state, through the mode. */
export const RESTING_POSE = 'idle';

/** The player's head facing right and facing left, about their feet, or `null` when the rig cannot say. */
export function playerHeadBoxes(
  rig: RigDocument | null | undefined,
  mode: string,
): { readonly right: FigureBox; readonly left: FigureBox } | null {
  if (rig === null || rig === undefined) return null;
  const player = playerArtboard(rig);
  if (player === null) return null;
  const authored = figureBoxes(rig, player.artboard, mode, { parts: HEAD_PARTS }) ?? [];
  const posed = figureBoxes(rig, player.artboard, mode, { parts: HEAD_PARTS, pose: RESTING_POSE }) ?? [];
  const right = unionBox([...authored, ...posed]);
  return right === null ? null : { right, left: mirrorBox(right) };
}

export interface RestingHeadsInput {
  readonly ground: readonly Vec2[];
  /** The subjects as the stop holds them: an x, and a rest point beside any character. */
  readonly subjects: readonly AutoStopSubject[];
  readonly rig: RigDocument | null | undefined;
  readonly tuning: LocomotionTuning;
  /** The ride carrying the player in that mode, or `null`. */
  readonly ride: Ride | null;
}

/**
 * For each subject, the boxes the player's head fills while a stop holds them there.
 *
 * Empty for a mode that engages nothing — it stops for nothing — and for a rig
 * that cannot measure a head.
 */
export function restingHeadBoxes(input: RestingHeadsInput): ReadonlyMap<string, readonly TargetRect[]> {
  const heads = new Map<string, readonly TargetRect[]>();
  const { ground, subjects, rig, tuning, ride } = input;
  if ((tuning.interaction?.reachPx ?? 0) <= 0) return heads;
  const head = playerHeadBoxes(rig, tuning.mode);
  if (head === null) return heads;

  const slack = landingSlackPx(tuning);
  /* A ride seats its rider's soles below or above the ground line (ADR-0031). */
  const seat = ride === null ? 0 : ride.riderAnchor.y - ride.groundLineY;

  for (const subject of subjects) {
    const boxes: TargetRect[] = [];
    for (const heading of [1, -1] as const) {
      const aim = restXFor(subject, heading);
      const short = aim - heading * slack;
      const box = heading > 0 ? head.right : head.left;
      const from = Math.min(aim, short);
      const to = Math.max(aim, short);
      const top = Math.min(groundYAt(ground, aim), groundYAt(ground, short)) + seat;
      const bottom = Math.max(groundYAt(ground, aim), groundYAt(ground, short)) + seat;
      boxes.push({
        x: from + box.x,
        y: top + box.y,
        width: to - from + box.width,
        height: bottom - top + box.height,
      });
    }
    heads.set(subject.id, boxes);
  }
  return heads;
}
