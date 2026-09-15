/**
 * Every shipped level brings the player to rest beside each character, not
 * inside them, and inside reach. ADR-0037.
 *
 * The audit's pictures: on Halifax the player stopped inside the beaver guide
 * and the two faces merged; the bike rode through the guide on Toronto; the
 * toboggan sat under him on Québec City; on the Prairies he stood inside the
 * train's glass dome with his head through the roof. ADR-0032 aimed every stop
 * at the subject's `x`, which is right for a building and wrong for a body.
 *
 * What is held here, for every level, every mode it declares and every
 * character it places, with the real level documents, the real rig, the real
 * strategy and the real stop:
 *
 *  1. a drive from the spawn comes to rest held at the character, inside the
 *     mode's reach — so a quest that sends the player to them can still be done;
 *  2. at rest, what travels with the player (their body, their equipment, and a
 *     ride's footprint) does not overlap the character's body;
 *  3. in particular no character stands inside a ride's footprint at its stop,
 *     or at the spawn;
 *  4. the same, arithmetically, for a drive arriving from either side, anywhere
 *     inside the landing slack the stop line leaves;
 *  5. a ride's footprint lies inside its own art;
 *  6. no character's feet are drawn inside a ride's art at rest (ADR-0049): the
 *     Alberta guide stood on the horse's head, because the head crossed his feet.
 *
 * Clear means clear by a margin, not by a pixel: the arithmetic keeps
 * `STAND_OFF_GAP_PX`, and a real drive, which lands anywhere in its slack, keeps
 * at least half of it.
 *
 * And the gates are shown to fail: a stop level with each character — the old
 * one — overlaps them on every level that places one, and somewhere in reach a
 * ride draws over a character's feet.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  brakingIntent,
  brakingTuning,
  createAutoStop,
  restXFor,
} from '@adapters/phaser/auto-stop';
import { SILHOUETTE_ALPHA_MIN, silhouetteFromRgba, type ArtSilhouette } from '@adapters/phaser/art-silhouette';
import { artboardFor, playerArtboard } from '@adapters/phaser/character-cast';
import { FOOT_PARTS, figureBoxes, mirrorBox } from '@adapters/phaser/figure-extent';
import { groundYAt, levelBounds, slopeAt } from '@adapters/phaser/ground-profile';
import { parseLevelDocument, type SceneLevel } from '@adapters/phaser/level-document';
import { applyBounds, createLocomotion } from '@adapters/phaser/locomotion';
import { rideFor, ridePlacement } from '@adapters/phaser/ride';
import {
  STAND_OFF_GAP_PX,
  figureSpan,
  landingSlackPx,
  mirrorSpan,
  rideFootprintSpan,
  riderSpan,
  stopSubjectsFor,
  type HorizontalSpan,
} from '@adapters/phaser/stand-off';

import type {
  LevelCharacter,
  LocomotionIntent,
  LocomotionTuning,
  Ride,
  RideArt,
  RigDocument,
} from '@application/ports';

import rigJson from '@content/characters/rig.json';
import gameConfigJson from '@content/game.config.json';

const RIG = rigJson as unknown as RigDocument;
const CONFIG = gameConfigJson as { readonly locomotionModes: readonly string[] };
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DT = 1 / 60;

/**
 * The least clear air a real drive leaves beside a character. Half the stand-off
 * gap: a stop lands anywhere in one frame's slack, and on the Prairies that has
 * measured 14 px of the 16 aimed for.
 */
const CLEARANCE_PX = STAND_OFF_GAP_PX / 2;

interface Raster {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;
}

/** Every ride texture a level can show at rest, rasterised once at 1x as `make assets` does. */
const rasters = new Map<string, Raster>();

/** The textures a ride shows while it stands: its rest frame, and the still reduced motion holds (ADR-0035). */
const atRest = (layer: RideArt): readonly string[] => [
  ...new Set([layer.key, ...(layer.cycle === undefined ? [] : [layer.cycle.rest])]),
];

const rideSource = (levelId: string, key: string): string =>
  `${REPO_ROOT}assets/src/svg/${levelId}/${key.slice(levelId.length + 1)}@1x.svg`;

function rasterOf(level: SceneLevel, key: string): Raster {
  const raster = rasters.get(rideSource(String(level.id), key));
  if (raster === undefined) throw new Error(`${String(level.id)}: "${key}" was not rasterised`);
  return raster;
}

/** A ride's silhouette in each texture it shows at rest, one band per column, as the scene reads it for a stop. */
function rideArtOf(level: SceneLevel, ride: Ride | null): readonly ArtSilhouette[] {
  if (ride === null) return [];
  return ride.art
    .flatMap((layer) => atRest(layer))
    .map((key) => {
      const raster = rasterOf(level, key);
      const art = silhouetteFromRgba(raster.pixels, raster.width, raster.height, { step: 1 });
      if (art === null) throw new Error(`${String(level.id)}: "${key}" draws nothing`);
      return art;
    });
}

beforeAll(async () => {
  for (const level of LEVELS) {
    for (const ride of level.rides) {
      for (const key of ride.art.flatMap((layer) => atRest(layer))) {
        const path = rideSource(String(level.id), key);
        if (rasters.has(path)) continue;
        const { data, info } = await sharp(readFileSync(path), { density: 72 })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        rasters.set(path, { width: info.width, height: info.height, pixels: data });
      }
    }
  }
}, 120_000);

const LEVELS: readonly SceneLevel[] = readdirSync(`${REPO_ROOT}content/levels`)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => {
    const parsed = parseLevelDocument(
      JSON.parse(readFileSync(`${REPO_ROOT}content/levels/${name}`, 'utf8')),
      CONFIG.locomotionModes,
    );
    if (!parsed.ok) throw new Error(`${name}: ${parsed.error.message}`);
    return parsed.value;
  });

const PLAYER = ((): string => {
  const found = playerArtboard(RIG);
  if (found === null) throw new Error('content/characters/rig.json has no player artboard');
  return found.artboard;
})();

/** Every (level, mode) that can engage and places somebody to engage. */
const CASES = LEVELS.flatMap((level) =>
  level.locomotion
    .filter((tuning) => (tuning.interaction?.reachPx ?? 0) > 0 && level.characters.length > 0)
    .map((tuning) => ({ level, tuning, ride: rideFor(level.rides, tuning.mode) })),
);

const nameOf = (level: SceneLevel, tuning: LocomotionTuning, character?: LevelCharacter): string =>
  `${String(level.id)}/${tuning.mode}${character === undefined ? '' : `/${String(character.characterId)}`}`;

type Interval = readonly [number, number];

const place = (x: number, span: HorizontalSpan): Interval => [x + span.left, x + span.right];

/** Positive when the two overlap by that much; negative is the clear air between them. */
const overlap = (a: Interval, b: Interval): number => Math.min(a[1], b[1]) - Math.max(a[0], b[0]);

/** The character's body as it stands, facing applied, about its x. */
function standing(character: LevelCharacter): HorizontalSpan {
  const board = artboardFor(RIG, String(character.characterId));
  const span = board === null ? null : figureSpan(RIG, board.artboard, null);
  if (span === null) {
    throw new Error(`the rig cannot measure "${String(character.characterId)}", so nothing can keep a rider clear of them`);
  }
  return character.facing === 'left' ? mirrorSpan(span) : span;
}

function rider(tuning: LocomotionTuning, ride: ReturnType<typeof rideFor>, heading: 1 | -1): HorizontalSpan {
  const span = riderSpan(figureSpan(RIG, PLAYER, tuning.mode), ride, heading);
  if (span === null) throw new Error(`the rig cannot measure the player in "${tuning.mode}"`);
  return span;
}

/**
 * Drive from the spawn until the stop holds the player at rest at `id`.
 *
 * A player who holds to move and, at every other stop, lets go and presses
 * again; or, for a drive that moves itself, a nudge at every other stop.
 */
function restAt(
  level: SceneLevel,
  tuning: LocomotionTuning,
  ride: ReturnType<typeof rideFor>,
  id: string,
): { readonly x: number; readonly velocityX: number; readonly holding: string | null } {
  const automatic = tuning.drive === 'auto';
  const driving = createLocomotion(tuning);
  const braking = createLocomotion(brakingTuning(tuning));
  const watch = createAutoStop(tuning);
  const bounds = levelBounds(level.ground, level.size);
  const subjects = stopSubjectsFor({ level, rig: RIG, tuning, ride, rideArt: rideArtOf(level, ride) });

  let state = driving.spawn(level.spawn.x, groundYAt(level.ground, level.spawn.x), 'right');
  let pressUntil = -1;
  let liftUntil = -1;
  let settled = 0;

  for (let frame = 0; frame < 60 * 180; frame += 1) {
    const elsewhere = watch.holding !== null && watch.holding !== id && state.velocityX === 0;
    let move: number;
    if (automatic) {
      if (elsewhere && pressUntil < frame) pressUntil = frame + 3;
      move = frame <= pressUntil ? 1 : 0;
    } else {
      if (elsewhere && liftUntil < frame) liftUntil = frame + 6;
      move = frame < liftUntil ? 0 : 1;
    }

    const halted = watch.update({
      automatic,
      playerX: state.x,
      velocityX: state.velocityX,
      playerMove: move,
      subjects,
    });
    const intent: LocomotionIntent = {
      move,
      jumpPressed: false,
      jumpHeld: false,
      interactPressed: false,
      slope: slopeAt(level.ground, state.x),
      groundY: groundYAt(level.ground, state.x),
    };
    const step = halted ? braking.step(state, brakingIntent(intent), DT) : driving.step(state, intent, DT);
    state = applyBounds(step.state, bounds, tuning, DT);

    settled = watch.holding === id && state.velocityX === 0 ? settled + 1 : 0;
    if (settled >= 3) return { x: state.x, velocityX: 0, holding: id };
  }
  return { x: state.x, velocityX: state.velocityX, holding: watch.holding };
}

/** The width of an art source under `assets/src/svg/<level>/`, from its root element. */
function artWidth(levelId: string, key: string): number | null {
  const prefix = `${levelId}-`;
  if (!key.startsWith(prefix)) return null;
  const path = `${REPO_ROOT}assets/src/svg/${levelId}/${key.slice(prefix.length)}@1x.svg`;
  let source: string;
  try {
    source = readFileSync(path, 'utf8');
  } catch {
    return null;
  }
  const match = /<svg[^>]*\swidth="(\d+(?:\.\d+)?)"/u.exec(source);
  return match?.[1] === undefined ? null : Number(match[1]);
}

describe('a drive comes to rest beside each character, not inside them (ADR-0037)', () => {
  it('has characters to check, so this is not a pass over nothing (ADR-0024)', () => {
    expect(CASES.length).toBeGreaterThan(0);
    expect(LEVELS.some((level) => level.rides.length > 0), 'no level declares a ride').toBe(true);
  });

  for (const { level, tuning, ride } of CASES) {
    const reach = tuning.interaction?.reachPx ?? 0;
    for (const character of level.characters) {
      if (character.position.x <= level.spawn.x) continue;

      it(`${nameOf(level, tuning, character)}: rests held, inside reach, clear of their body`, () => {
        const id = String(character.characterId);
        const rest = restAt(level, tuning, ride, id);
        const where = nameOf(level, tuning, character);

        expect(rest.holding, `${where}: the drive was never held at them`).toBe(id);
        expect(rest.velocityX, `${where}: never came to rest`).toBe(0);
        expect(
          Math.abs(rest.x - character.position.x),
          `${where}: came to rest ${String(Math.round(Math.abs(rest.x - character.position.x)))} px ` +
            `from them, which a ${String(reach)} px reach cannot cover`,
        ).toBeLessThanOrEqual(reach);

        const body = place(character.position.x, standing(character));
        const clear = overlap(place(rest.x, rider(tuning, ride, 1)), body);
        expect(
          clear,
          `${where}: the rider at ${String(Math.round(rest.x))} is ${String(Math.round(-clear))} px clear of them, ` +
            `less than ${String(CLEARANCE_PX)} px`,
        ).toBeLessThanOrEqual(-CLEARANCE_PX);

        if (ride !== null) {
          const footprint = overlap(place(rest.x, rideFootprintSpan(ride)), body);
          expect(
            footprint,
            `${where}: they stand inside the ride's footprint at its stop — seen through its glass, inside the car`,
          ).toBeLessThanOrEqual(-CLEARANCE_PX);
        }
      });
    }
  }

  for (const { level, tuning, ride } of CASES) {
    it(`${nameOf(level, tuning)}: from either side, anywhere the stop can land, clear and in reach`, () => {
      const reach = tuning.interaction?.reachPx ?? 0;
      const slack = landingSlackPx(tuning);
      const subjects = stopSubjectsFor({ level, rig: RIG, tuning, ride, rideArt: rideArtOf(level, ride) });
      for (const character of level.characters) {
        const id = String(character.characterId);
        const subject = subjects.find((candidate) => candidate.id === id);
        expect(subject?.rest, `${nameOf(level, tuning, character)} has no rest point`).toBeDefined();
        if (subject === undefined) continue;
        const body = place(character.position.x, standing(character));
        for (const heading of [1, -1] as const) {
          const aim = restXFor(subject, heading);
          for (const landed of [aim, aim - heading * slack]) {
            const where = `${nameOf(level, tuning, character)} heading ${heading > 0 ? 'right' : 'left'} at ${String(Math.round(landed))}`;
            expect(Math.abs(landed - character.position.x), where).toBeLessThanOrEqual(reach);
            expect(
              overlap(place(landed, rider(tuning, ride, heading)), body),
              `${where}: closer than the ${String(STAND_OFF_GAP_PX)} px the stand-off keeps`,
            ).toBeLessThanOrEqual(-STAND_OFF_GAP_PX + 1e-6);
          }
        }
      }
    });
  }

  it('no character stands inside a ride, or inside the player, at the spawn', () => {
    const problems: string[] = [];
    for (const level of LEVELS) {
      const tuning = level.locomotion[0];
      if (tuning === undefined) continue;
      const ride = rideFor(level.rides, tuning.mode);
      const player = place(level.spawn.x, rider(tuning, ride, 1));
      for (const character of level.characters) {
        const clear = overlap(player, place(character.position.x, standing(character)));
        if (clear >= 0) {
          problems.push(`${String(level.id)}: "${String(character.characterId)}" overlaps the player at the spawn by ${String(Math.round(clear))} px`);
        }
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('every ride footprint lies inside its own art', () => {
    const rides = LEVELS.flatMap((level) => level.rides.map((ride) => ({ level, ride })));
    expect(rides.length).toBeGreaterThan(0);
    for (const { level, ride } of rides) {
      for (const layer of ride.art) {
        const width = artWidth(String(level.id), layer.key);
        expect(width, `${String(level.id)}: no 1x source for "${layer.key}"`).not.toBeNull();
        expect(ride.footprint.x + ride.footprint.width, `${String(level.id)}: the footprint runs off "${layer.key}"`).toBeLessThanOrEqual(width ?? 0);
      }
    }
  });

  it('the gate can fail: a stop level with each character overlaps them on every level', () => {
    let checked = 0;
    for (const { level, tuning, ride } of CASES) {
      for (const character of level.characters) {
        const body = place(character.position.x, standing(character));
        expect(
          overlap(place(character.position.x, rider(tuning, ride, 1)), body),
          `${nameOf(level, tuning, character)}: a rider level with them does not overlap them, so the checks above prove nothing`,
        ).toBeGreaterThan(0);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------- feet and ride art (ADR-0049) --- */

/** Every (level, mode) that rides, and places somebody to ride up to. */
const RIDDEN = CASES.flatMap(({ level, tuning, ride }) => (ride === null ? [] : [{ level, tuning, ride }]));

interface Feet {
  /** Pixels of the character's foot windows that the ride's art is drawn over. */
  readonly covered: number;
  readonly total: number;
  /** Whether the ride's art reaches the walking line in every column of the character's body. */
  readonly flank: () => boolean;
}

/** A character's feet against one texture of a ride, with the rider at rest at `landed`. */
function feetAgainst(
  level: SceneLevel,
  ride: Ride,
  character: LevelCharacter,
  landed: number,
  heading: 1 | -1,
  raster: Raster,
): Feet {
  const placement = ridePlacement({
    ride,
    size: { width: raster.width, height: raster.height },
    riderX: landed,
    groundY: groundYAt(level.ground, landed),
    facing: heading > 0 ? 'right' : 'left',
    bobPx: 0,
  });
  const artLeft = placement.centreX - raster.width / 2;
  const drawn = (x: number, y: number): boolean => {
    const column = Math.floor(x - artLeft);
    const inArt = placement.flipX ? raster.width - 1 - column : column;
    const row = Math.floor(y - placement.top);
    if (inArt < 0 || row < 0 || inArt >= raster.width || row >= raster.height) return false;
    return (raster.pixels[(row * raster.width + inArt) * 4 + 3] ?? 0) >= SILHOUETTE_ALPHA_MIN;
  };

  const board = artboardFor(RIG, String(character.characterId));
  const feet = (board === null ? null : figureBoxes(RIG, board.artboard, null, { parts: FOOT_PARTS })) ?? [];
  if (feet.length === 0) throw new Error(`the rig draws no feet for "${String(character.characterId)}"`);
  const sole = groundYAt(level.ground, character.position.x);

  let covered = 0;
  let total = 0;
  for (const foot of feet.map((box) => (character.facing === 'left' ? mirrorBox(box) : box))) {
    const left = character.position.x + foot.x;
    const top = sole + foot.y;
    for (let y = Math.floor(top); y < top + foot.height; y += 1) {
      for (let x = Math.floor(left); x < left + foot.width; x += 1) {
        total += 1;
        if (drawn(x, y)) covered += 1;
      }
    }
  }

  const flank = (): boolean => {
    const [from, to] = place(character.position.x, standing(character));
    for (let x = Math.floor(from); x < to; x += 1) {
      let reaches = false;
      for (let y = Math.floor(placement.top); y <= sole && !reaches; y += 1) reaches = drawn(x, y);
      if (!reaches) return false;
    }
    return true;
  };
  return { covered, total, flank };
}

/** `null` when the feet are wholly clear of the ride, or wholly behind a flank of it; what is wrong otherwise. */
function feetProblem(feet: Feet): string | null {
  if (feet.covered === 0) return null;
  if (feet.covered < feet.total) {
    return (
      `${String(feet.covered)} of their ${String(feet.total)} foot pixels are under the ride's art and the rest ` +
      'are not, so they read as standing on it'
    );
  }
  return feet.flank() ? null : 'their feet are hidden by ride art that does not run the width of them';
}

describe("no character's feet are drawn inside a ride's art at rest (ADR-0049)", () => {
  it('has a ridden mode and a character to check, so this is not a pass over nothing (ADR-0024)', () => {
    expect(RIDDEN.length).toBeGreaterThan(0);
  });

  for (const { level, tuning, ride } of RIDDEN) {
    it(`${nameOf(level, tuning)}: every character's feet are wholly clear of the ride, or wholly behind a flank of it, wherever the stop lands`, () => {
      const slack = landingSlackPx(tuning);
      const subjects = stopSubjectsFor({ level, rig: RIG, tuning, ride, rideArt: rideArtOf(level, ride) });
      const problems: string[] = [];
      for (const character of level.characters) {
        const subject = subjects.find((candidate) => candidate.id === String(character.characterId));
        expect(subject?.rest, `${nameOf(level, tuning, character)} has no rest point`).toBeDefined();
        if (subject === undefined) continue;
        for (const heading of [1, -1] as const) {
          const aim = restXFor(subject, heading);
          for (const landed of [aim, aim - heading * slack]) {
            for (const key of ride.art.flatMap((layer) => atRest(layer))) {
              const problem = feetProblem(feetAgainst(level, ride, character, landed, heading, rasterOf(level, key)));
              if (problem !== null) {
                problems.push(
                  `${nameOf(level, tuning, character)} heading ${heading > 0 ? 'right' : 'left'} at ` +
                    `${String(Math.round(landed))} over "${key}": ${problem}`,
                );
              }
            }
          }
        }
      }
      expect(problems, problems.join('\n')).toEqual([]);
    });
  }

  it("the gate can fail: somewhere in reach of a character, a ride's art crosses their feet", () => {
    let found = 0;
    for (const { level, tuning, ride } of RIDDEN) {
      const reach = tuning.interaction?.reachPx ?? 0;
      for (const key of ride.art.flatMap((layer) => atRest(layer))) {
        const raster = rasterOf(level, key);
        for (const character of level.characters) {
          for (const heading of [1, -1] as const) {
            for (let landed = character.position.x - reach; landed <= character.position.x + reach; landed += 8) {
              if (feetProblem(feetAgainst(level, ride, character, landed, heading, raster)) !== null) found += 1;
            }
          }
        }
      }
    }
    expect(found, "no place in reach puts a ride's art over a character's feet, so the check above proves nothing").toBeGreaterThan(0);
  });

  it("the gate can fail: a stop that does not read the ride's art rests it across somebody's feet", () => {
    let crossed = 0;
    for (const { level, tuning, ride } of RIDDEN) {
      const slack = landingSlackPx(tuning);
      const blind = stopSubjectsFor({ level, rig: RIG, tuning, ride });
      for (const character of level.characters) {
        const subject = blind.find((candidate) => candidate.id === String(character.characterId));
        if (subject === undefined) continue;
        for (const heading of [1, -1] as const) {
          const aim = restXFor(subject, heading);
          for (const landed of [aim, aim - heading * slack]) {
            for (const key of ride.art.flatMap((layer) => atRest(layer))) {
              if (feetProblem(feetAgainst(level, ride, character, landed, heading, rasterOf(level, key))) !== null) {
                crossed += 1;
              }
            }
          }
        }
      }
    }
    expect(crossed, "the stop ADR-0037 aimed for already kept every foot clear, so reading the art proves nothing").toBeGreaterThan(0);
  });
});
