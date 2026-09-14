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
 *  5. a ride's footprint lies inside its own art.
 *
 * And the gate is shown to fail: a stop level with each character — the old
 * one — overlaps them on every level that places one.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  brakingIntent,
  brakingTuning,
  createAutoStop,
  restXFor,
} from '@adapters/phaser/auto-stop';
import { artboardFor, playerArtboard } from '@adapters/phaser/character-cast';
import { groundYAt, levelBounds, slopeAt } from '@adapters/phaser/ground-profile';
import { parseLevelDocument, type SceneLevel } from '@adapters/phaser/level-document';
import { applyBounds, createLocomotion } from '@adapters/phaser/locomotion';
import { rideFor } from '@adapters/phaser/ride';
import {
  figureSpan,
  landingSlackPx,
  mirrorSpan,
  rideFootprintSpan,
  riderSpan,
  stopSubjectsFor,
  type HorizontalSpan,
} from '@adapters/phaser/stand-off';

import type { LevelCharacter, LocomotionIntent, LocomotionTuning, RigDocument } from '@application/ports';

import rigJson from '@content/characters/rig.json';
import gameConfigJson from '@content/game.config.json';

const RIG = rigJson as unknown as RigDocument;
const CONFIG = gameConfigJson as { readonly locomotionModes: readonly string[] };
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DT = 1 / 60;

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
  const subjects = stopSubjectsFor({ level, rig: RIG, tuning, ride });

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
        expect(clear, `${where}: the rider at ${String(Math.round(rest.x))} overlaps them by ${String(Math.round(clear))} px`).toBeLessThan(0);

        if (ride !== null) {
          const footprint = overlap(place(rest.x, rideFootprintSpan(ride)), body);
          expect(
            footprint,
            `${where}: they stand inside the ride's footprint at its stop — seen through its glass, inside the car`,
          ).toBeLessThan(0);
        }
      });
    }
  }

  for (const { level, tuning, ride } of CASES) {
    it(`${nameOf(level, tuning)}: from either side, anywhere the stop can land, clear and in reach`, () => {
      const reach = tuning.interaction?.reachPx ?? 0;
      const slack = landingSlackPx(tuning);
      const subjects = stopSubjectsFor({ level, rig: RIG, tuning, ride });
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
            expect(overlap(place(landed, rider(tuning, ride, heading)), body), where).toBeLessThan(0);
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
