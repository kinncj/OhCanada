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
 * ## And wherever the player can walk
 *
 * A real build at 390 × 844 on Peggy's Cove showed that a stop was not the only
 * place that mattered. The granite erratic is lower than the player's chest, so
 * its mark stepped sideways along the art, off the resting head — to exactly the
 * column the player walks through on the way in, where it sat on their chest.
 * The fish store's sat on their hat. So a mark also keeps clear of the player's
 * whole standing figure, crown to soles, wherever the ground can carry them
 * ({@link walkingFigureBoxes}), and of every other character standing in the
 * level ({@link markClearance}). A mark on art taller than the player still
 * rests on it; a mark on art lower than the player rises to just above their
 * crown, which is the highest thing standing at that x.
 *
 * Pure: no Phaser, no DOM, no clock.
 */

import type { LocomotionTuning, Ride, RigDocument, Vec2 } from '@application/ports';

import { restXFor, type AutoStopSubject } from './auto-stop';
import { playerArtboard } from './character-cast';
import { figureBoxes, HEAD_PARTS, mirrorBox, unionBox, type FigureBox } from './figure-extent';
import { groundYAt } from './ground-profile';
import { MODE_STATE_SEPARATOR } from './locomotion-pose';
import { landingSlackPx } from './stand-off';
import type { TargetRect } from './touch-controls';

/** The pose a stop leaves the player in: the rig's resting state, through the mode. */
export const RESTING_POSE = 'idle';

/** The rig's airborne states begin with this: `jump-rise`, `jump-fall`. */
export const AIRBORNE_POSE_PREFIX = 'jump';

/**
 * Every pose the player is drawn in with their feet (or seat) on the ground: the
 * rig's own states, as the selector names them (each resolved through the mode
 * by `figure-extent.ts`), less the airborne ones.
 *
 * Read from the rig, not listed here: a state the rig adds is counted the day it
 * lands, and the list would otherwise have to name `walk` — which is a mode too.
 * Not the jump: a mark clears where the player stands, and one lifted over the
 * top of every jump would float in the sky over everything it points at.
 */
export function standingPoses(rig: RigDocument): readonly string[] {
  return Object.keys(rig.states)
    .filter((state) => !state.includes(MODE_STATE_SEPARATOR) && !state.startsWith(AIRBORNE_POSE_PREFIX))
    .sort();
}

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

/**
 * The player's whole figure about their feet, facing either way: from the crown
 * at its highest in any standing pose down to the soles, as wide as the widest
 * pose facing right or left. `null` when the rig cannot say.
 *
 * The crown is the head's, not an arm's: a hand raised to wave is not what a mark
 * over a person reads as sitting on.
 */
export function playerStandingFigure(rig: RigDocument | null | undefined, mode: string): FigureBox | null {
  if (rig === null || rig === undefined) return null;
  const player = playerArtboard(rig);
  if (player === null) return null;
  /* As authored, and through every keyframe of every standing pose. */
  const every = (parts?: readonly string[]): readonly FigureBox[] =>
    [{}, ...standingPoses(rig).map((pose) => ({ pose }))].flatMap(
      (posed) => figureBoxes(rig, player.artboard, mode, parts === undefined ? posed : { ...posed, parts }) ?? [],
    );
  const body = unionBox(every());
  const crown = unionBox(every(HEAD_PARTS));
  if (body === null || crown === null) return null;
  const facing = unionBox([body, mirrorBox(body)]);
  if (facing === null) return null;
  const bottom = Math.max(0, body.y + body.height);
  return { x: facing.x, y: crown.y, width: facing.width, height: bottom - crown.y };
}

export interface WalkingFigureInput {
  readonly ground: readonly Vec2[];
  readonly rig: RigDocument | null | undefined;
  readonly tuning: LocomotionTuning;
  /** The ride carrying the player in that mode, or `null`. */
  readonly ride: Ride | null;
}

/**
 * Where the player can stand anywhere the ground carries them: one box per
 * stretch of the ground polyline, from the crown over its higher end down to
 * the soles on its lower, over its whole length.
 *
 * Empty for a mode that engages nothing — it shows no marks — and for a rig that
 * cannot measure the player.
 */
export function walkingFigureBoxes(input: WalkingFigureInput): readonly TargetRect[] {
  const { ground, rig, tuning, ride } = input;
  if ((tuning.interaction?.reachPx ?? 0) <= 0) return [];
  const figure = playerStandingFigure(rig, tuning.mode);
  if (figure === null) return [];
  const seat = ride === null ? 0 : ride.riderAnchor.y - ride.groundLineY;

  const boxes: TargetRect[] = [];
  for (let index = 1; index < ground.length; index += 1) {
    const from = ground[index - 1];
    const to = ground[index];
    if (from === undefined || to === undefined) continue;
    const left = Math.min(from.x, to.x);
    const right = Math.max(from.x, to.x);
    const high = Math.min(from.y, to.y) + seat;
    const low = Math.max(from.y, to.y) + seat;
    boxes.push({
      x: left + figure.x,
      y: high + figure.y,
      width: right - left + figure.width,
      height: low - high + figure.height,
    });
  }
  return boxes;
}

/** The parts of what a mark keeps clear of, each measured once at level build. */
export interface MarkClearanceParts {
  /** The player's head wherever a stop holds them, by subject ({@link restingHeadBoxes}). */
  readonly resting: ReadonlyMap<string, readonly TargetRect[]>;
  /** The player wherever they can walk ({@link walkingFigureBoxes}). */
  readonly walking: readonly TargetRect[];
  /** Every character standing in the level, where its art was drawn. */
  readonly actors: readonly { readonly id: string; readonly rect: TargetRect }[];
}

/**
 * For each subject, every box its mark keeps clear of: its own resting heads,
 * the player wherever they walk, and every character but itself — a mark over a
 * person points at that person, and so sits on them.
 */
export function markClearance(
  ids: readonly string[],
  parts: MarkClearanceParts,
): ReadonlyMap<string, readonly TargetRect[]> {
  const clearance = new Map<string, readonly TargetRect[]>();
  for (const id of ids) {
    clearance.set(id, [
      ...(parts.resting.get(id) ?? []),
      ...parts.walking,
      ...parts.actors.filter((actor) => actor.id !== id).map((actor) => actor.rect),
    ]);
  }
  return clearance;
}
