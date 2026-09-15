/**
 * Where a drive comes to rest beside a character, rather than inside one.
 * ADR-0037, ADR-0049.
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
 * draws with, at rest (`figure-extent.ts`). For the player it is the envelope over
 * every option of every slot the creator offers, so what the player chose can
 * never put them inside somebody; and it includes the mode's equipment (`{mode}`
 * parts), so a bike is as wide as its wheels. Rotations are not applied: the posed
 * extent of a talking or gesturing arm reaches further, and two figures whose
 * hands meet in a conversation are not the defect. Faces and bodies merging are.
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
 * ### Never where a ride's art crosses their feet (ADR-0049)
 *
 * On the Alberta foothills the horse rested short of the guide with its head and
 * neck across his feet, and he read as standing on the horse's head. The saddle
 * footprint was honest — nobody was in the saddle — and the figure was still
 * wrong, because a contour crossing somebody's feet is what they stand on.
 *
 * So when the scene can say where a ride's art is (its silhouette at rest, read
 * from the textures it draws), a side is taken only if, over its whole landing,
 * each character's feet are **wholly clear** of that art, or **wholly hidden**
 * behind art that reaches the walking line across the whole width of them — a
 * flank, which is how the Prairies guide stands beyond the train. The horse then
 * rests past the guide, with him behind its rump. When no side in reach passes,
 * the first side in reach is taken, as before.
 *
 * Pure: no Phaser, no DOM, no clock.
 */

import type { LocomotionTuning, Ride, RigDocument } from '@application/ports';

import type { ArtSilhouette } from './art-silhouette';
import { artboardFor, playerArtboard } from './character-cast';
import type { AutoStopSubject, RestPoints } from './auto-stop';
import { FOOT_PARTS, figureBoxes, mirrorBox, unionBox } from './figure-extent';
import { groundYAt } from './ground-profile';
import type { SceneLevel } from './level-document';
import { MAX_STEP_SECONDS } from './locomotion';

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

/**
 * How wide an artboard draws, at rest, facing right.
 *
 * `mode` resolves `{mode}` equipment parts; `null` is a character with no
 * locomotion of its own, which draws none. `null` back when the rig names no such
 * artboard or it resolves no part at all. The windows, their reflection and the
 * choices resolved are `figure-extent.ts`'s, the same the marks read a crown from.
 */
export function figureSpan(
  rig: RigDocument,
  artboardName: string,
  mode: string | null,
): HorizontalSpan | null {
  const boxes = figureBoxes(rig, artboardName, mode);
  if (boxes === null || boxes.length === 0) return null;
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  for (const box of boxes) {
    left = Math.min(left, box.x);
    right = Math.max(right, box.x + box.width);
  }
  return { left, right };
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
  /**
   * Whether the rider may come to rest at `x` travelling `heading`. A side is
   * taken only where this holds at its aim and one landing slack short of it.
   * Absent allows everywhere.
   */
  readonly allows?: (x: number, heading: 1 | -1) => boolean;
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
  /* Past them. Landing short now moves the rider back toward the character, so
     the slack is added to the clearance, and the whole of it must fit in reach. */
  const beyond = far + trail + gap + input.slackPx;

  const inReach: number[] = [];
  if (short + input.slackPx <= input.reachPx) inReach.push(input.x - heading * short);
  if (beyond <= input.reachPx) inReach.push(input.x + heading * beyond);

  /* The first side in reach whose whole landing is allowed; with none allowed,
     the first side in reach, as before; with none in reach, level with them. */
  const allows = input.allows;
  const allowed =
    allows === undefined
      ? inReach[0]
      : inReach.find((aim) => allows(aim, heading) && allows(aim - heading * input.slackPx, heading));
  return allowed ?? inReach[0] ?? input.x;
}

/** Where a drive travelling right, and one travelling left, comes to rest beside a character. */
export function restPointsBeside(input: BesideInput): RestPoints {
  return { right: restFor(input, 1), left: restFor(input, -1) };
}

/** A character's feet about their x and their sole line, facing applied. Up is negative. */
export interface FeetExtent {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export interface FeetAgainstRide {
  readonly ride: Ride;
  /**
   * One silhouette for each texture the ride shows at rest, in the art's own
   * pixels from its top-left, placed at x 0 (`art-silhouette.ts`).
   */
  readonly art: readonly ArtSilhouette[];
  /** The rider's x at rest, and the ground under them. */
  readonly riderX: number;
  readonly riderGroundY: number;
  readonly heading: 1 | -1;
  /** The character's x, and the ground under them. */
  readonly characterX: number;
  readonly soleY: number;
  readonly feet: FeetExtent;
  /** The character's body about their x, facing applied. */
  readonly body: HorizontalSpan;
}

/**
 * Whether a ride at rest draws across a character's feet (ADR-0049).
 *
 * `false` when in every texture the ride shows at rest the feet are wholly clear
 * of its art, or wholly hidden behind art that reaches the walking line across
 * the character's whole body. A column is read from the top of its art down, so
 * a gap under a jaw counts as art; the contract test reads every pixel.
 */
export function rideCrossesFeet(input: FeetAgainstRide): boolean {
  return input.art.some((art) => crossesIn(input, art));
}

function crossesIn(input: FeetAgainstRide, art: ArtSilhouette): boolean {
  const width = art.x + art.tops.length * art.step;
  const flip = input.ride.turnsWithRider && input.heading < 0;
  const anchorX = flip ? width - input.ride.riderAnchor.x : input.ride.riderAnchor.x;
  const artLeft = input.riderX - anchorX;
  const artTop = input.riderGroundY - input.ride.groundLineY;

  /* The world y of the highest art in the world column `x`, or null for none. As
     `ride.ts#ridePlacement` draws it: the anchor on the rider, mirrored about the
     art's centre when the ride turns. */
  const topAt = (x: number): number | null => {
    const column = Math.floor(x - artLeft);
    const inArt = flip ? width - 1 - column : column;
    if (inArt < art.x || inArt >= width) return null;
    const top = art.tops[Math.floor((inArt - art.x) / art.step)];
    return top === null || top === undefined ? null : artTop + top;
  };
  const tops = (from: number, to: number): readonly (number | null)[] => {
    const found: (number | null)[] = [];
    for (let x = Math.floor(input.characterX + from); x < input.characterX + to; x += 1) found.push(topAt(x));
    return found;
  };

  const feet = tops(input.feet.left, input.feet.right);
  const lowestFoot = input.soleY + input.feet.bottom;
  if (feet.every((top) => top === null || top >= lowestFoot)) return false;

  const highestFoot = input.soleY + input.feet.top;
  const hidden = feet.every((top) => top !== null && top <= highestFoot);
  const flank = tops(input.body.left, input.body.right).every((top) => top !== null && top <= input.soleY);
  return !(hidden && flank);
}

/** A character's feet about their x, from the rig, facing applied, or `null` when it draws none. */
function feetOf(rig: RigDocument, artboardName: string, facing: 'left' | 'right'): FeetExtent | null {
  const boxes = (figureBoxes(rig, artboardName, null, { parts: FOOT_PARTS }) ?? []).map((box) =>
    facing === 'left' ? mirrorBox(box) : box,
  );
  const union = unionBox(boxes);
  return union === null
    ? null
    : { left: union.x, right: union.x + union.width, top: union.y, bottom: union.y + union.height };
}

export interface StopSubjectsInput {
  readonly level: Pick<SceneLevel, 'reachablePois' | 'characters' | 'ground'>;
  readonly rig: RigDocument | null | undefined;
  /** The mode the player moves in. */
  readonly tuning: LocomotionTuning;
  /** The ride carrying the player in that mode, or `null`. */
  readonly ride: Ride | null;
  /**
   * The ride's silhouette in each texture it shows at rest, when the scene could
   * read them. Absent or empty: the ride's art is not consulted, and the rest
   * points are ADR-0037's.
   */
  readonly rideArt?: readonly ArtSilhouette[];
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
  const art = input.rideArt ?? [];

  const characters = level.characters.map((character): AutoStopSubject => {
    const id = String(character.characterId);
    const plain: AutoStopSubject = { id, x: character.position.x };
    if (rig === null || rig === undefined || reachPx <= 0 || riderRight === null || riderLeft === null) {
      return plain;
    }
    const artboard = artboardFor(rig, id);
    const standing = artboard === null ? null : figureSpan(rig, artboard.artboard, null);
    if (artboard === null || standing === null) return plain;
    const subject = character.facing === 'left' ? mirrorSpan(standing) : standing;

    const feet = feetOf(rig, artboard.artboard, character.facing);
    const soleY = groundYAt(level.ground, character.position.x);
    const allows =
      ride === null || art.length === 0 || feet === null
        ? undefined
        : (riderX: number, heading: 1 | -1): boolean =>
            !rideCrossesFeet({
              ride,
              art,
              riderX,
              riderGroundY: groundYAt(level.ground, riderX),
              heading,
              characterX: character.position.x,
              soleY,
              feet,
              body: subject,
            });

    return {
      ...plain,
      rest: restPointsBeside({
        x: character.position.x,
        subject,
        riderRight,
        riderLeft,
        reachPx,
        slackPx,
        ...(allows === undefined ? {} : { allows }),
      }),
    };
  });

  return [...landmarks, ...characters];
}
