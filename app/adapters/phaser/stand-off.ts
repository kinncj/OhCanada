/**
 * Where a drive comes to rest beside a character, rather than inside one.
 * ADR-0037.
 *
 * ## The defect
 *
 * ADR-0032 brought every drive to rest **level with** each thing it can engage:
 * the stop line is the distance at which the mode's own brake lands the player
 * on the subject's `x`. For a landmark that is right — a skater standing in front
 * of the locks is standing at the locks. For a character it put two figures on
 * one spot. Holding right from the front door, the player stopped inside the
 * beaver guide on Halifax and the two faces merged; the bike rode through the
 * guide on Toronto; the toboggan sat under him on Québec City; and on the
 * Prairies the train stopped with its glass dome exactly where he stands, so he
 * was drawn inside it with his head through the roof.
 *
 * ## What this decides
 *
 * For each character a level places, the world x a drive travelling right, and
 * one travelling left, should come to rest at: clear of the character's body by
 * {@link STAND_OFF_GAP_PX}, and still inside the mode's reach. `auto-stop.ts`
 * aims at that point instead of the character's `x`. Landmarks keep resting
 * level with their `x`, because nothing is standing there to collide with.
 *
 * ### Bodies are measured from the rig, not typed in
 *
 * A figure's extent is the union of the frame windows (`rig.frames`) of every
 * part it can draw, in character space, about `characterSpace.centreX` — the
 * same windows, reflection and template resolution `sprite-character-renderer.ts`
 * draws with, at rest. For the player it is the envelope over every option of
 * every slot the creator offers, so what the player chose can never put them
 * inside somebody; and it includes the mode's equipment (`{mode}` parts), so a
 * bike is as wide as its wheels. Rotations are not applied: the posed extent of
 * a talking or gesturing arm reaches further, and two figures whose hands meet
 * in a conversation are not the defect. Faces and bodies merging are.
 *
 * ### A ride adds its footprint
 *
 * A ride (ADR-0031) is level art registered to the rider, and a figure standing
 * beyond it reads as *inside* it only where it can be seen through, or where the
 * rider sits: the Prairies car's glazed dome, not its steel flank. `ride.footprint`
 * says which span of the art that is, and it is added to the rider's own body.
 *
 * ### Which side
 *
 * The approach side — short of the character — when that point plus one capped
 * frame of landing slack is still inside reach. Otherwise the far side, when that
 * fits: the train's dome is too wide to stop short of the guide inside a 320 px
 * reach, and stopping with the guide behind the car's observation end, clear of
 * the dome, does fit. If neither fits, level with `x`, which is the old stop and
 * which `tests/unit/contracts/a-stop-rests-beside-a-character.test.ts` refuses
 * for every shipped level.
 *
 * Pure: no Phaser, no DOM, no clock.
 */

import type { LocomotionTuning, Ride, RigDocument, RigSlot } from '@application/ports';

import { artboardFor, playerArtboard } from './character-cast';
import type { AutoStopSubject, RestPoints } from './auto-stop';
import type { SceneLevel } from './level-document';
import { MAX_STEP_SECONDS } from './locomotion';
import { braceNames, MODE_TEMPLATE_KEY } from './locomotion-pose';

/** A horizontal extent about a figure's centre line, design px. Left is negative. */
export interface HorizontalSpan {
  readonly left: number;
  readonly right: number;
}

/**
 * Clear air between two figures at a stop, design px.
 *
 * A visual separation, not physics. Its only obligation is to be small against
 * every reach the game ships, which the contract test holds; at phone width it
 * is a few CSS pixels of daylight between a rider and the person they stopped
 * to talk to.
 */
export const STAND_OFF_GAP_PX = 16;

/** The brace the renderer resolves from the rig's expression list. */
const EXPRESSION_BRACE = 'expression';

/** Every frame key a part template can resolve to, over every choice offered. */
function resolutions(template: string, choices: ReadonlyMap<string, readonly string[]>): readonly string[] {
  let resolved: readonly string[] = [template];
  for (const name of new Set(braceNames(template))) {
    const options = choices.get(name) ?? [];
    resolved = resolved.flatMap((partial) =>
      options.map((option) => partial.replaceAll(`{${name}}`, option)),
    );
  }
  return resolved;
}

/**
 * How wide an artboard draws, at rest, facing right.
 *
 * `mode` resolves `{mode}` equipment parts; `null` is a character with no
 * locomotion of its own, which draws none. `null` back when the rig names no such
 * artboard or it resolves no part at all.
 */
export function figureSpan(
  rig: RigDocument,
  artboardName: string,
  mode: string | null,
): HorizontalSpan | null {
  const artboard = rig.artboards.find((candidate) => candidate.artboard === artboardName);
  if (artboard === undefined) return null;

  const choices = new Map<string, readonly string[]>();
  for (const [name, slot] of Object.entries(rig.slots) as [string, RigSlot][]) {
    if (slot.status === 'reserved') continue;
    if (artboard.playerSelectableSlots.includes(name)) {
      choices.set(name, slot.options);
      continue;
    }
    const chosen = artboard.skins[name] ?? slot.fallback;
    if (chosen !== null && chosen !== undefined && chosen.length > 0) choices.set(name, [chosen]);
  }
  choices.set(EXPRESSION_BRACE, rig.expressions.names);
  if (mode !== null && mode.length > 0) choices.set(MODE_TEMPLATE_KEY, [mode]);

  const centre = rig.characterSpace.centreX;
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  for (const part of rig.parts) {
    for (const resolved of resolutions(part.frame, choices)) {
      const window = rig.frames[`${rig.atlas.framePrefix}${resolved}`];
      if (window === undefined) continue;
      /* Reflected about the centre when the part is, exactly as the renderer
         places a mirrored twin. */
      const from = part.mirrorX ? 2 * centre - (window.x + window.w) : window.x;
      left = Math.min(left, from - centre);
      right = Math.max(right, from + window.w - centre);
    }
  }
  return Number.isFinite(left) && Number.isFinite(right) ? { left, right } : null;
}

/** The same extent, facing the other way. */
export function mirrorSpan(span: HorizontalSpan): HorizontalSpan {
  return { left: -span.right, right: -span.left };
}

function unionSpan(a: HorizontalSpan, b: HorizontalSpan): HorizontalSpan {
  return { left: Math.min(a.left, b.left), right: Math.max(a.right, b.right) };
}

/** A ride's footprint about its rider's centre line, as the art is drawn unmirrored. */
export function rideFootprintSpan(ride: Ride): HorizontalSpan {
  return {
    left: ride.footprint.x - ride.riderAnchor.x,
    right: ride.footprint.x + ride.footprint.width - ride.riderAnchor.x,
  };
}

/**
 * Everything that travels with the player, about their centre line, while they
 * travel `heading`.
 *
 * The body turns with the player. A ride's footprint turns only when the ride
 * does (`turnsWithRider`): a train backs up without turning round.
 */
export function riderSpan(
  body: HorizontalSpan | null,
  ride: Ride | null,
  heading: 1 | -1,
): HorizontalSpan | null {
  const turned = body === null ? null : heading > 0 ? body : mirrorSpan(body);
  if (ride === null) return turned;
  const art = rideFootprintSpan(ride);
  const placed = heading < 0 && ride.turnsWithRider ? mirrorSpan(art) : art;
  return turned === null ? placed : unionSpan(turned, placed);
}

/**
 * How far short of its aim a stop can land: one capped frame at the fastest the
 * mode can go, a descent included. `auto-stop.ts#stopLinePx` leaves exactly that
 * much slack, so a stop comes to rest between this far short and level.
 */
export function landingSlackPx(tuning: LocomotionTuning): number {
  return tuning.maxSpeed * Math.max(1, tuning.maxSpeedMultiplierDownhill) * MAX_STEP_SECONDS;
}

export interface BesideInput {
  /** The character's x. */
  readonly x: number;
  /** The character as it stands — its facing already applied — about `x`. */
  readonly subject: HorizontalSpan;
  /** The rider while travelling right, and while travelling left. */
  readonly riderRight: HorizontalSpan;
  readonly riderLeft: HorizontalSpan;
  readonly reachPx: number;
  readonly slackPx: number;
  readonly gapPx?: number;
}

function restFor(input: BesideInput, heading: 1 | -1): number {
  const gap = input.gapPx ?? STAND_OFF_GAP_PX;
  const rider = heading > 0 ? input.riderRight : input.riderLeft;
  /* Measured along the heading: how far the rider reaches forward and back, and
     how far the character reaches toward and away from somebody arriving. */
  const lead = heading > 0 ? rider.right : -rider.left;
  const trail = heading > 0 ? -rider.left : rider.right;
  const near = heading > 0 ? -input.subject.left : input.subject.right;
  const far = heading > 0 ? input.subject.right : -input.subject.left;

  /* Short of them. A stop lands up to one slack short of its aim, which only
     moves it further away, so the slack is charged to reach and not to the gap. */
  const short = Math.max(0, lead + near + gap);
  if (short + input.slackPx <= input.reachPx) return input.x - heading * short;

  /* Past them. Landing short now moves the rider back toward the character, so
     the slack is added to the clearance, and the whole of it must fit in reach. */
  const beyond = far + trail + gap + input.slackPx;
  if (beyond <= input.reachPx) return input.x + heading * beyond;

  return input.x;
}

/** Where a drive travelling right, and one travelling left, comes to rest beside a character. */
export function restPointsBeside(input: BesideInput): RestPoints {
  return { right: restFor(input, 1), left: restFor(input, -1) };
}

export interface StopSubjectsInput {
  readonly level: Pick<SceneLevel, 'reachablePois' | 'characters'>;
  readonly rig: RigDocument | null | undefined;
  /** The mode the player moves in. */
  readonly tuning: LocomotionTuning;
  /** The ride carrying the player in that mode, or `null`. */
  readonly ride: Ride | null;
}

/**
 * The subjects a drive stops for, in the order the scene lists its reach
 * targets — reachable landmarks, then characters — with a rest point beside every
 * character this rig can measure.
 *
 * A character the rig cannot measure, a level with no rig, or a mode that can
 * engage nothing gets no rest point, and is stopped level with, as before.
 */
export function stopSubjectsFor(input: StopSubjectsInput): readonly AutoStopSubject[] {
  const { level, rig, tuning, ride } = input;
  const landmarks: AutoStopSubject[] = level.reachablePois.map((poi) => ({
    id: String(poi.id),
    x: poi.position.x,
  }));

  const reachPx = tuning.interaction?.reachPx ?? 0;
  const player = rig === null || rig === undefined ? null : playerArtboard(rig);
  const body =
    rig === null || rig === undefined || player === null ? null : figureSpan(rig, player.artboard, tuning.mode);
  const riderRight = riderSpan(body, ride, 1);
  const riderLeft = riderSpan(body, ride, -1);
  const slackPx = landingSlackPx(tuning);

  const characters = level.characters.map((character): AutoStopSubject => {
    const id = String(character.characterId);
    const plain: AutoStopSubject = { id, x: character.position.x };
    if (rig === null || rig === undefined || reachPx <= 0 || riderRight === null || riderLeft === null) {
      return plain;
    }
    const artboard = artboardFor(rig, id);
    const standing = artboard === null ? null : figureSpan(rig, artboard.artboard, null);
    if (standing === null) return plain;
    return {
      ...plain,
      rest: restPointsBeside({
        x: character.position.x,
        subject: character.facing === 'left' ? mirrorSpan(standing) : standing,
        riderRight,
        riderLeft,
        reachPx,
        slackPx,
      }),
    };
  });

  return [...landmarks, ...characters];
}
