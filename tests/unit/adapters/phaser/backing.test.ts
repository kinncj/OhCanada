/**
 * A ride that does not turn round backs up held, slowly, and waits. ADR-0043.
 *
 * The defect was on the shipped Prairies build: steering back out of a stop
 * turned the passenger round in the seat, then the automatic drive carried the
 * car backwards at cruise speed to the start of the world and held it against
 * the edge, rider half off the glass. The rule is `backing.ts`'s. It is proved
 * here against the real level documents, with the real strategy, the real stop
 * and the same strategy selection the scene makes, for the reason
 * `auto-stop.test.ts` gives: a rule left in `level-scene.ts` is proved only by a
 * browser.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { brakingIntent, brakingTuning, createAutoStop } from '@adapters/phaser/auto-stop';
import {
  backingBounds,
  backingTuning,
  backsUp,
  createBacking,
  facingForward,
  FORWARD,
  type BackingDrive,
} from '@adapters/phaser/backing';
import { groundYAt, levelBounds, slopeAt } from '@adapters/phaser/ground-profile';
import { parseLevelDocument, type SceneLevel } from '@adapters/phaser/level-document';
import { applyBounds, createLocomotion } from '@adapters/phaser/locomotion';
import { rideFor } from '@adapters/phaser/ride';
import { stopSubjectsFor } from '@adapters/phaser/stand-off';

import type { LocomotionIntent, LocomotionState, LocomotionTuning, Ride, RigDocument } from '@application/ports';

import rigJson from '@content/characters/rig.json';
import gameConfigJson from '@content/game.config.json';

const CONFIG = gameConfigJson as { readonly locomotionModes: readonly string[] };
const RIG = rigJson as unknown as RigDocument;
const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

const LEVELS: readonly SceneLevel[] = readdirSync(`${REPO_ROOT}content/levels`)
  .filter((name) => name.endsWith('.json'))
  .map((name) => {
    const parsed = parseLevelDocument(
      JSON.parse(readFileSync(`${REPO_ROOT}content/levels/${name}`, 'utf8')),
      CONFIG.locomotionModes,
    );
    if (!parsed.ok) throw new Error(`${name}: ${parsed.error.message}`);
    return parsed.value;
  });

interface Rider {
  readonly level: SceneLevel;
  readonly tuning: LocomotionTuning;
  readonly ride: Ride;
}

/** Every shipped level whose spawn mode rides something with a front. */
const RIDERS: readonly Rider[] = LEVELS.flatMap((level) => {
  const tuning = level.locomotion[0];
  if (tuning === undefined) return [];
  const ride = rideFor(level.rides, tuning.mode);
  return backsUp(ride) ? [{ level, tuning, ride }] : [];
});

/** Every shipped ride, with the mode it carries. */
const EVERY_RIDE = LEVELS.flatMap((level) =>
  level.rides.map((ride) => ({ level, ride, tuning: level.locomotion.find((mode) => mode.mode === ride.mode) })),
);

const nameOf = (rider: Rider): string => `${String(rider.level.id)}/${rider.tuning.mode}`;

/* ------------------------------------------------------------- a real run --- */

interface RunFrame {
  readonly x: number;
  readonly velocityX: number;
  readonly move: number;
  readonly drive: BackingDrive;
  readonly facing: LocomotionState['facing'];
}

type Hold = (state: LocomotionState, frame: number) => number;

/**
 * Run the level at 60 fps exactly as `LevelScene.update` does: sample, feed the
 * stop, feed the backing watch, choose the strategy, clamp to the bounds.
 *
 * `engage(state, frame)` is the player choosing what is on offer, which the
 * scene tells both watches about.
 */
function run(
  rider: Rider,
  options: { readonly frames: number; readonly hold: Hold; readonly engage?: (state: LocomotionState, frame: number) => boolean },
) {
  const { level, tuning, ride } = rider;
  const automatic = tuning.drive === 'auto';
  const driving = createLocomotion(tuning);
  const braking = createLocomotion(brakingTuning(tuning));
  const backing = createLocomotion(backingTuning(tuning, ride));
  const stop = createAutoStop(tuning);
  const watch = createBacking(ride);
  const bounds = backingBounds(levelBounds(level.ground, level.size), ride);
  const subjects = stopSubjectsFor({ level, rig: RIG, tuning, ride });

  let state = driving.spawn(level.spawn.x, groundYAt(level.ground, level.spawn.x), 'right');
  const frames: RunFrame[] = [];
  const dt = 1 / 60;

  for (let index = 0; index < options.frames; index += 1) {
    const move = options.hold(state, index);
    if (options.engage?.(state, index) === true) {
      stop.release(stop.holding ?? undefined);
      watch.release();
    }
    const halted = stop.update({ automatic, playerX: state.x, velocityX: state.velocityX, playerMove: move, subjects });
    const drive = watch.update({ velocityX: state.velocityX, playerMove: move });
    const intent: LocomotionIntent = {
      move,
      jumpPressed: false,
      jumpHeld: false,
      interactPressed: false,
      slope: slopeAt(level.ground, state.x),
      groundY: groundYAt(level.ground, state.x),
    };
    const step =
      halted || drive === 'parked'
        ? braking.step(state, brakingIntent(intent), dt)
        : drive === 'backing'
          ? backing.step(state, intent, dt)
          : driving.step(facingForward(state, ride), intent, dt);
    state = applyBounds(step.state, bounds, tuning, dt);
    frames.push({ x: state.x, velocityX: state.velocityX, move, drive, facing: state.facing });
  }
  return { frames, state, watch, stop, bounds };
}

/** At rest somewhere past the spawn: the drive has stopped for something. */
const stoppedAhead = (rider: Rider, state: LocomotionState): boolean =>
  state.velocityX === 0 && state.x > rider.level.spawn.x + 1;

/* ------------------------------------------------------------- the premise --- */

describe('the premise', () => {
  it('a shipped level rides something with a front, and its mode drives itself', () => {
    /* If this ever empties, every run below is over nothing. */
    expect(RIDERS.length).toBeGreaterThan(0);
    expect(RIDERS.some((rider) => rider.tuning.drive === 'auto')).toBe(true);
  });

  it('every ride that does not turn declares how fast it backs up, slower than it runs, and one that turns declares none', () => {
    for (const { level, ride, tuning } of EVERY_RIDE) {
      const where = `${String(level.id)}/${ride.mode}`;
      if (ride.turnsWithRider) {
        expect(ride.backingMaxSpeed, `${where} turns, and never backs up`).toBeUndefined();
        continue;
      }
      expect(ride.backingMaxSpeed, `${where} backs up at an unstated speed`).toBeGreaterThan(0);
      expect(ride.backingMaxSpeed ?? Infinity, where).toBeLessThan((tuning?.maxSpeed ?? 0) / 2);
    }
  });

  it('spawns every ride with a front inside the bounds that keep its tail in the world', () => {
    for (const rider of RIDERS) {
      const bounds = backingBounds(levelBounds(rider.level.ground, rider.level.size), rider.ride);
      expect(bounds.left, nameOf(rider)).toBe(levelBounds(rider.level.ground, rider.level.size).left + rider.ride.riderAnchor.x);
      expect(rider.level.spawn.x, nameOf(rider)).toBeGreaterThanOrEqual(bounds.left);
    }
  });
});

/* ------------------------------------------------------- backing, for real --- */

describe('a ride with a front backs up only while the player presses back (ADR-0043)', () => {
  it('backs up slowly, stops when let go, and waits: it never drives itself backwards', () => {
    for (const rider of RIDERS) {
      const where = nameOf(rider);
      const cap = rider.ride.backingMaxSpeed ?? rider.tuning.maxSpeed;
      /* The audit's walk: let the drive stop at the first thing, steer back for
         two seconds, then take the hands away for ten. */
      const phase = { stoppedAt: -1 };
      const BACK = 120;
      const result = run(rider, {
        frames: 60 * 40,
        hold: (state, frame) => {
          if (phase.stoppedAt < 0 && stoppedAhead(rider, state)) phase.stoppedAt = frame;
          if (phase.stoppedAt < 0) return 0;
          return frame < phase.stoppedAt + BACK ? -1 : 0;
        },
      });
      expect(phase.stoppedAt, `${where} never stopped for anything`).toBeGreaterThan(0);

      const backing = result.frames.slice(phase.stoppedAt, phase.stoppedAt + BACK);
      const after = result.frames.slice(phase.stoppedAt + BACK);
      expect(backing.some((frame) => frame.velocityX < 0), `${where} did not back up at all`).toBe(true);
      const fastest = Math.max(...backing.map((frame) => -frame.velocityX));
      expect(fastest, `${where} backed up at ${String(Math.round(fastest))} px/s, over its ${String(cap)}`).toBeLessThanOrEqual(cap + 1e-9);

      /* Let go: at rest within half a second, and then nothing moves at all. */
      const rest = after.findIndex((frame) => frame.velocityX === 0);
      expect(rest, `${where} kept backing after it was let go`).toBeGreaterThanOrEqual(0);
      expect(rest, `${where} took ${String(rest)} frames to stop backing`).toBeLessThanOrEqual(30);
      const waiting = after.slice(rest);
      expect(
        waiting.every((frame) => frame.velocityX === 0 && frame.x === waiting[0]?.x),
        `${where} drove itself on after backing up, with nothing pressed`,
      ).toBe(true);
      expect(result.watch.parked, where).toBe(true);
    }
  });

  it('a press forward, or engaging, sends the waiting ride on, faced forward', () => {
    for (const rider of RIDERS) {
      for (const how of ['press', 'engage'] as const) {
        const where = `${nameOf(rider)} (${how})`;
        const phase = { stoppedAt: -1 };
        const BACK = 60;
        const WAIT = 120;
        const result = run(rider, {
          frames: 60 * 30,
          hold: (state, frame) => {
            if (phase.stoppedAt < 0 && stoppedAhead(rider, state)) phase.stoppedAt = frame;
            if (phase.stoppedAt < 0) return 0;
            if (frame < phase.stoppedAt + BACK) return -1;
            return how === 'press' && frame === phase.stoppedAt + BACK + WAIT ? 1 : 0;
          },
          engage: (_state, frame) =>
            how === 'engage' && phase.stoppedAt >= 0 && frame === phase.stoppedAt + BACK + WAIT,
        });
        const waitedAt = result.frames[phase.stoppedAt + BACK + WAIT - 1];
        expect(waitedAt?.velocityX, `${where} was not waiting`).toBe(0);
        expect(waitedAt?.facing, `${where}: backing did not turn the passenger round, so facing is not exercised`).toBe('left');
        const later = result.frames.slice(phase.stoppedAt + BACK + WAIT);
        expect(
          later.some((frame) => frame.x > (waitedAt?.x ?? 0) + 100 && frame.move === 0),
          `${where}: the automatic drive did not carry the ride forward again`,
        ).toBe(true);
        expect(later.every((frame) => frame.velocityX >= 0), `${where} went on backwards`).toBe(true);
        expect(later.find((frame) => frame.velocityX > 0)?.facing, where).toBe('right');
      }
    }
  });

  it('backing to something it passed rests in reach of it, where a mode that engages only at rest can take the offer', () => {
    for (const rider of RIDERS) {
      const where = nameOf(rider);
      const reach = rider.tuning.interaction?.reachPx ?? 0;
      const first = stopSubjectsFor({ level: rider.level, rig: RIG, tuning: rider.tuning, ride: rider.ride })
        .filter((subject) => subject.x > rider.level.spawn.x)
        .sort((a, b) => a.x - b.x)[0];
      if (first === undefined || reach <= 0) continue;

      /* Stop at it; press on past it, which lets it go for this visit; steer back
         once well past; let go the moment it is in reach again. */
      const phase = { stoppedAt: -1, backFrom: -1, letGoAt: -1 };
      const result = run(rider, {
        frames: 60 * 60,
        hold: (state, frame) => {
          if (phase.stoppedAt < 0) {
            if (stoppedAhead(rider, state)) phase.stoppedAt = frame;
            return 0;
          }
          if (frame === phase.stoppedAt + 5) return 1;
          if (phase.backFrom < 0) {
            if (state.x > first.x + reach * 3) phase.backFrom = frame;
            return 0;
          }
          if (phase.letGoAt < 0) {
            if (state.velocityX <= 0 && Math.abs(state.x - first.x) <= reach) {
              phase.letGoAt = frame;
              return 0;
            }
            return -1;
          }
          return 0;
        },
      });

      expect(phase.backFrom, `${where} never got past "${first.id}" to steer back`).toBeGreaterThan(0);
      expect(phase.letGoAt, `${where} never backed into reach of "${first.id}"`).toBeGreaterThan(0);
      expect(result.state.velocityX, `${where} did not come to rest after backing to "${first.id}"`).toBe(0);
      expect(
        Math.abs(result.state.x - first.x),
        `${where} backed to "${first.id}" and came to rest out of its reach`,
      ).toBeLessThanOrEqual(reach);
      expect(result.watch.parked, `${where} is not waiting at "${first.id}"`).toBe(true);
    }
  });

  it('never backs its tail out of the world, however long the player presses back', () => {
    for (const rider of RIDERS) {
      const where = nameOf(rider);
      const result = run(rider, { frames: 60 * 14, hold: (_state, frame) => (frame < 60 * 12 ? -1 : 0) });
      const lowest = Math.min(...result.frames.map((frame) => frame.x));
      expect(lowest, `${where} backed to ${String(lowest)}, past ${String(result.bounds.left)}`).toBeGreaterThanOrEqual(
        result.bounds.left,
      );
      expect(result.state.x, where).toBeCloseTo(result.bounds.left, 6);
      expect(result.state.velocityX, `${where} is still moving against the edge after being let go`).toBe(0);
    }
  });
});

/* ------------------------------------------------------------ the small print --- */

const CAR: Ride = {
  mode: 'rail',
  art: [{ key: 'car-front', side: 'front' }],
  riderAnchor: { x: 380, y: 422 },
  groundLineY: 330,
  turnsWithRider: false,
  footprint: { x: 220, width: 400 },
  backingMaxSpeed: 200,
};

const ANIMAL: Ride = { ...CAR, mode: 'gallop', turnsWithRider: true, backingMaxSpeed: undefined as unknown as number };
const { backingMaxSpeed: _unused, ...TURNING } = ANIMAL;

const TUNING: LocomotionTuning = ((): LocomotionTuning => {
  const rider = RIDERS[0];
  if (rider === undefined) throw new Error('no shipped ride with a front');
  return rider.tuning;
})();

describe('the small print', () => {
  it('a ride that turns, or none, changes nothing', () => {
    for (const ride of [null, TURNING]) {
      const watch = createBacking(ride);
      expect(watch.applies).toBe(false);
      for (const velocityX of [-300, 0, 300]) {
        for (const playerMove of [-1, 0, 1]) {
          expect(watch.update({ velocityX, playerMove })).toBe('forward');
        }
      }
      const bounds = { left: 0, right: 9000 };
      expect(backingBounds(bounds, ride)).toBe(bounds);
      const state = createLocomotion(TUNING).spawn(10, 0, 'left');
      expect(facingForward(state, ride)).toBe(state);
    }
  });

  it('backs up held, braked when let go, and capped at the ride’s own number — never above the mode’s', () => {
    const backed = backingTuning(TUNING, CAR);
    expect(backed.drive).toBe('held');
    expect(backed.glide).toBe(0);
    expect(backed.deceleration).toBe(TUNING.turnAcceleration);
    expect(backed.maxSpeed).toBe(Math.min(200, TUNING.maxSpeed));
    expect(backed.maxSpeedMultiplierDownhill).toBe(1);
    /* Everything else is the mode as authored: reach, interaction, jump. */
    expect(backed.interaction).toBe(TUNING.interaction);
    expect(backed.acceleration).toBe(TUNING.acceleration);

    expect(backingTuning(TUNING, { ...CAR, backingMaxSpeed: TUNING.maxSpeed * 4 }).maxSpeed).toBe(TUNING.maxSpeed);
    const { backingMaxSpeed: _none, ...undeclared } = CAR;
    expect(backingTuning(TUNING, undeclared).maxSpeed).toBe(TUNING.maxSpeed);
  });

  it('keeps the tail in the world on the left, and never moves the end of the level', () => {
    expect(FORWARD).toBe(1);
    expect(backingBounds({ left: 0, right: 9600 }, CAR)).toEqual({ left: 380, right: 9600 });
    expect(backingBounds({ left: 40, right: 9600 }, CAR)).toEqual({ left: 420, right: 9600 });
    /* A world narrower than the tail is a broken document, not a negative span. */
    expect(backingBounds({ left: 0, right: 200 }, CAR)).toEqual({ left: 200, right: 200 });
  });

  it('faces a ride with a front forward only at rest', () => {
    const spawn = createLocomotion(TUNING).spawn(500, 0, 'left');
    expect(facingForward(spawn, CAR).facing).toBe('right');
    const moving = { ...spawn, velocityX: -120 };
    expect(facingForward(moving, CAR)).toBe(moving);
    const forward = { ...spawn, facing: 'right' as const };
    expect(facingForward(forward, CAR)).toBe(forward);
  });

  it('waits only after backing, and a press forward or an engagement ends the wait', () => {
    const watch = createBacking(CAR);
    expect(watch.applies).toBe(true);
    /* At rest with nothing pressed, and never backed: the drive is the mode's own. */
    expect(watch.update({ velocityX: 0, playerMove: 0 })).toBe('forward');
    expect(watch.update({ velocityX: 0, playerMove: -1 })).toBe('backing');
    expect(watch.update({ velocityX: -150, playerMove: -1 })).toBe('backing');
    /* Let go: still backing until it has come to rest, on the backing brake. */
    expect(watch.update({ velocityX: -40, playerMove: 0 })).toBe('backing');
    expect(watch.update({ velocityX: 0, playerMove: 0 })).toBe('parked');
    expect(watch.parked).toBe(true);
    expect(watch.update({ velocityX: 0, playerMove: 0 })).toBe('parked');
    /* An input the strategy would ignore is nothing pressed. */
    expect(watch.update({ velocityX: 0, playerMove: 0.05 })).toBe('parked');
    /* Forward, at once, without a lift. */
    expect(watch.update({ velocityX: 0, playerMove: 1 })).toBe('forward');
    expect(watch.parked).toBe(false);
    expect(watch.update({ velocityX: 0, playerMove: 0 })).toBe('forward');

    expect(watch.update({ velocityX: -100, playerMove: 0 })).toBe('backing');
    expect(watch.update({ velocityX: 0, playerMove: 0 })).toBe('parked');
    watch.release();
    expect(watch.parked).toBe(false);
    expect(watch.update({ velocityX: 0, playerMove: 0 })).toBe('forward');

    /* A stop that brought a backing ride to rest, released by engaging: the
       release comes before the frame that would otherwise have parked it. */
    expect(watch.update({ velocityX: -100, playerMove: 0 })).toBe('backing');
    watch.release();
    expect(watch.update({ velocityX: 0, playerMove: 0 })).toBe('forward');
  });

  it('travelling forward is never backing, whatever is pressed', () => {
    const watch = createBacking(CAR);
    expect(watch.update({ velocityX: 400, playerMove: -1 })).toBe('forward');
    expect(watch.update({ velocityX: 400, playerMove: 0 })).toBe('forward');
    expect(watch.parked).toBe(false);
  });
});
