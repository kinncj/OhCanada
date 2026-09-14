/**
 * Every drive stops for the things a player can choose. ADR-0032.
 *
 * Auto-move moved and never stopped: a player who cannot hold a control walked
 * past every landmark and every character in the level. The same hole is written
 * into `content/levels/prairie-rail.json`, which declares `drive: "auto"` with
 * `interaction.requiresStop: true` — a mode that must come to rest before it can
 * engage, and nothing that would ever bring it to rest. And a player holding to
 * move came to rest wherever their thumb lifted, which on Ottawa's ice is up to
 * two thousand pixels past the officer. The product owner asked for one rule:
 * the character stops on each point of interest, held or automatic.
 *
 * The rule is proved here, against the real level documents and the real
 * locomotion strategy, for the reason `level-exit.test.ts` gives: `level-scene.ts`
 * imports Phaser at module scope and cannot be loaded under `environment: 'node'`,
 * so a rule left in the scene is a rule proved once, in one browser, on one
 * machine. What the browser suites add (`tests/e2e/auto-move-stops.spec.ts`,
 * `tests/e2e/held-move-stops.spec.ts`) is that the inputs a player can actually
 * press are joined to this arithmetic.
 *
 * The property that matters is **not** "it stops". It is "it comes to rest close
 * enough to engage, in every mode the game ships, from that mode's own cruise
 * speed, and the player can always go on": a halt 400 px short of a landmark is
 * the same defect wearing a coat, and a halt nobody can leave is a worse one.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  brakeDistancePx,
  brakingIntent,
  brakingTuning,
  createAutoStop,
  stopLinePx,
  type AutoStopFrame,
} from '@adapters/phaser/auto-stop';
import { groundYAt, levelBounds, slopeAt } from '@adapters/phaser/ground-profile';
import { parseLevelDocument, type SceneLevel } from '@adapters/phaser/level-document';
import {
  MAX_STEP_SECONDS,
  MOVE_DEADZONE,
  applyBounds,
  createLocomotion,
} from '@adapters/phaser/locomotion';

import type { LocomotionIntent, LocomotionState, LocomotionTuning } from '@application/ports';

import gameConfigJson from '@content/game.config.json';

const CONFIG = gameConfigJson as { readonly locomotionModes: readonly string[] };

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/**
 * Every level that ships, not one that was convenient.
 *
 * The braking distances differ by a factor of eight between Halifax's walk and
 * Québec City's toboggan, and the whole question is whether one rule lands
 * inside every one of them. Reading the directory means the next level is
 * checked the day it is authored, and nobody has to remember.
 */
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

/** Every (level, mode) pair, because a level's second mode is a mode too. */
const EVERY_MODE: readonly { readonly level: SceneLevel; readonly tuning: LocomotionTuning }[] =
  LEVELS.flatMap((level) => level.locomotion.map((tuning) => ({ level, tuning })));

const ANY_TUNING: LocomotionTuning = ((): LocomotionTuning => {
  const first = EVERY_MODE[0];
  if (first === undefined) throw new Error('content/levels ships no locomotion tuning at all');
  return first.tuning;
})();

/**
 * The first level whose spawn mode can engage anything **and is held**, so the
 * held rules are exercised on a drive the player really has to hold.
 */
const ENGAGEABLE: { readonly level: SceneLevel; readonly tuning: LocomotionTuning } =
  ((): { readonly level: SceneLevel; readonly tuning: LocomotionTuning } => {
    const found = LEVELS.map((level) => ({ level, tuning: level.locomotion[0] })).find(
      (entry): entry is { level: SceneLevel; tuning: LocomotionTuning } =>
        (entry.tuning?.interaction?.reachPx ?? 0) > 0 && entry.tuning?.drive === 'held',
    );
    if (found === undefined) {
      throw new Error('no shipped level spawns in a held mode that can engage');
    }
    return found;
  })();

/** The pair `(level, mode)` as it reads in a failure message. */
const nameOf = (level: SceneLevel, tuning: LocomotionTuning): string =>
  `${String(level.id)}/${tuning.mode}`;

/** Everything a level places that a player could choose, as the watch wants it. */
function subjectsOf(level: SceneLevel): readonly { readonly id: string; readonly x: number }[] {
  return [
    ...level.reachablePois.map((poi) => ({ id: String(poi.id), x: poi.position.x })),
    ...level.characters.map((character) => ({
      id: String(character.characterId),
      x: character.position.x,
    })),
  ];
}

/** The things a player leaving the spawn to the right comes to, nearest first. */
function aheadOf(level: SceneLevel): readonly { readonly id: string; readonly x: number }[] {
  return subjectsOf(level)
    .filter((subject) => subject.x > level.spawn.x)
    .sort((a, b) => a.x - b.x);
}

/** The first thing a player leaving the spawn to the right would come to. */
function firstAhead(level: SceneLevel): { readonly id: string; readonly x: number } {
  const first = aheadOf(level)[0];
  if (first === undefined) {
    throw new Error(
      `${String(level.id)} places nothing ahead of its spawn, so there is nothing a drive ` +
        'could stop for and this level cannot be asserted about.',
    );
  }
  return first;
}

/* ------------------------------------------------------------- a real run --- */

interface RunFrame {
  readonly x: number;
  readonly velocityX: number;
  readonly intentMove: number;
  readonly halted: boolean;
  /** What the watch was holding the drive at after this frame's update. */
  readonly holding: string | null;
}

/**
 * Run the level for real at 60 fps.
 *
 * The same two strategies the scene builds, the same bounds clamp and the same
 * ground samples, so what is asserted below is the game rather than a model of
 * it. `hold` is the player's own intent per frame — the only door the override
 * and the resume have. `autoMove` is the accessibility option; a level whose mode
 * declares `drive: "auto"` is automatic whatever it says, exactly as
 * `LevelScene.#automaticDrive` decides.
 */
function drive(
  level: SceneLevel,
  tuning: LocomotionTuning,
  options: {
    readonly frames: number;
    readonly hold?: (state: LocomotionState, frame: number) => number;
    readonly engageWhenStopped?: boolean;
    readonly autoMove?: boolean;
  },
): { readonly frames: readonly RunFrame[]; readonly state: LocomotionState } {
  const automatic = (options.autoMove ?? true) || tuning.drive === 'auto';
  const driving = createLocomotion(automatic ? { ...tuning, drive: 'auto' } : tuning);
  const braking = createLocomotion(brakingTuning(tuning));
  const watch = createAutoStop(tuning);
  const bounds = levelBounds(level.ground, level.size);
  const subjects = subjectsOf(level);

  let state = driving.spawn(level.spawn.x, groundYAt(level.ground, level.spawn.x), 'right');
  const frames: RunFrame[] = [];
  const dt = 1 / 60;

  for (let frame = 0; frame < options.frames; frame += 1) {
    const move = options.hold?.(state, frame) ?? 0;
    const halted = watch.update({
      automatic,
      playerX: state.x,
      velocityX: state.velocityX,
      playerMove: move,
      subjects,
    });
    /* Engaging is what releases the hold, and the scene releases it from
       `#engageNearest` with the subject it engaged — the same call, at the same
       moment, here. */
    if (halted && options.engageWhenStopped === true && state.velocityX === 0) {
      watch.release(watch.holding ?? undefined);
    }

    const intent: LocomotionIntent = {
      move,
      jumpPressed: false,
      jumpHeld: false,
      interactPressed: false,
      slope: slopeAt(level.ground, state.x),
      groundY: groundYAt(level.ground, state.x),
    };
    const step = halted
      ? braking.step(state, brakingIntent(intent), dt)
      : driving.step(state, intent, dt);
    state = applyBounds(step.state, bounds, tuning, dt);
    frames.push({
      x: state.x,
      velocityX: state.velocityX,
      intentMove: move,
      halted,
      holding: watch.holding,
    });
  }

  return { frames, state };
}

/**
 * A player who holds to move, lets go once they have come to rest, and presses
 * again after `liftFrames` — the "fresh press" a held stop waits for.
 *
 * `then` is what they press after that, so the same shape serves "carry on" and
 * "turn round".
 */
function holdLiftAndPress(
  level: SceneLevel,
  options: { readonly liftFrames: number; readonly then: (state: LocomotionState) => number },
): { readonly hold: (state: LocomotionState, frame: number) => number; readonly stoppedAt: () => number | null } {
  let stoppedAt: number | null = null;
  let liftedAt: number | null = null;
  return {
    stoppedAt: () => stoppedAt,
    hold: (state, frame) => {
      if (stoppedAt === null) {
        if (!(state.velocityX === 0 && state.x > level.spawn.x + 1)) return 1;
        stoppedAt = state.x;
        liftedAt = frame;
      }
      /* With `liftFrames: 0` the control goes from one press straight to the
         next on the frame the stop is seen, with no frame of nothing between. */
      if (liftedAt !== null && frame < liftedAt + options.liftFrames) return 0;
      return options.then(state);
    },
  };
}

/* -------------------------------------------------------------- the brake --- */

describe('the brake is the level’s own number, not a constant in the engine', () => {
  it('brakes at turnAcceleration with the glide taken away, and drives nothing itself', () => {
    for (const { level, tuning } of EVERY_MODE) {
      const braked = brakingTuning(tuning);
      const where = nameOf(level, tuning);
      /* `turnAcceleration` is what `level.schema.json` calls "the brake", and a
         contract test already pins it strictly above `deceleration`. Using it
         means the halt is as hard as the document says the mode can brake —
         never a number this directory invented. */
      expect(braked.deceleration, where).toBe(tuning.turnAcceleration);
      expect(braked.glide, where).toBe(0);
      expect(braked.drive, where).toBe('held');
      /* Everything else is the mode the document authored. A halt that changed
         the reach or the interaction rules would be a second rulebook. */
      expect(braked.interaction, where).toBe(tuning.interaction);
      expect(braked.jump, where).toBe(tuning.jump);
      expect(braked.maxSpeed, where).toBe(tuning.maxSpeed);
      expect(braked.acceleration, where).toBe(tuning.acceleration);
    }
  });

  it('is stepped with the move taken out, and everything else the player pressed kept', () => {
    /* A held drive is caught with the control still down, and `drive: 'held'`
       with `move: 1` accelerates — so the brake would be a throttle. Only the
       move goes; a jump or an interact on a stopped frame is still theirs. */
    const pressed: LocomotionIntent = {
      move: 1,
      jumpPressed: true,
      jumpHeld: true,
      interactPressed: true,
      slope: 0.25,
      groundY: 1240,
    };
    expect(brakingIntent(pressed)).toEqual({ ...pressed, move: 0 });
    expect(brakingIntent({ ...pressed, move: -0.6 }).move).toBe(0);
    /* Nothing to take out is nothing allocated. */
    const still = { ...pressed, move: 0 };
    expect(brakingIntent(still)).toBe(still);
  });

  it('is v squared over twice the brake, and zero at rest', () => {
    expect(brakeDistancePx(0, ANY_TUNING)).toBe(0);
    expect(brakeDistancePx(ANY_TUNING.maxSpeed, ANY_TUNING)).toBeCloseTo(
      (ANY_TUNING.maxSpeed * ANY_TUNING.maxSpeed) / (2 * ANY_TUNING.turnAcceleration),
      6,
    );
    /* A negative or non-finite speed is a caller bug, not a slower stop.
       Answering 0 makes it stop for nothing rather than stop everywhere. */
    expect(brakeDistancePx(Number.NaN, ANY_TUNING)).toBe(0);
    expect(brakeDistancePx(-400, ANY_TUNING)).toBe(0);
  });

  it('cannot stop a mode that declares no brake, and says so by stopping for nothing', () => {
    const brakeless: LocomotionTuning = { ...ANY_TUNING, turnAcceleration: 0 };
    expect(brakeDistancePx(600, brakeless)).toBe(0);
    expect(stopLinePx(600, brakeless)).toBe(0);
  });

  it('leaves one capped frame of slack so a slow frame cannot cross the line unseen', () => {
    for (const { level, tuning } of EVERY_MODE) {
      const speed = tuning.maxSpeed;
      expect(stopLinePx(speed, tuning), nameOf(level, tuning)).toBeCloseTo(
        brakeDistancePx(speed, tuning) + speed * MAX_STEP_SECONDS,
        6,
      );
    }
  });
});

/* ------------------------------------------------------- where the stop is --- */

describe('the stop line is derived from the mode, which is why it is not “ready”', () => {
  /**
   * Why the affordance's `ready` boundary is not the trigger.
   *
   * `reachPx` is a fixed distance and stopping is a speed-dependent one, so one
   * line is wrong in both directions at once across the modes that ship: too
   * late for the fast ones, which is a player sailing past a landmark, and far
   * too early for the walk, which is a player halted a fifth of a screen short
   * of one for no reason they can see.
   */
  it('would be too late for some modes and too early for others', () => {
    const reaches = EVERY_MODE.filter(({ tuning }) => tuning.interaction !== null).map(
      ({ level, tuning }) => ({
        name: nameOf(level, tuning),
        reach: tuning.interaction?.reachPx ?? 0,
        line: Math.round(stopLinePx(tuning.maxSpeed, tuning)),
      }),
    );
    expect(reaches.length).toBeGreaterThan(1);
    expect(
      reaches.some((entry) => entry.line > entry.reach),
      `no shipped mode brakes further than its own reach, so this reasoning is stale: ${JSON.stringify(reaches)}`,
    ).toBe(true);
    expect(
      reaches.some((entry) => entry.line < entry.reach),
      `no shipped mode brakes inside its own reach, so this reasoning is stale: ${JSON.stringify(reaches)}`,
    ).toBe(true);
  });

  it('brings every shipped mode, driven automatically, to rest inside its own reach', () => {
    for (const { level, tuning } of EVERY_MODE) {
      const reach = tuning.interaction?.reachPx ?? 0;
      if (reach <= 0) continue;
      const subject = firstAhead(level);
      const run = drive(level, tuning, { frames: 60 * 60 });
      const missedBy = Math.abs(run.state.x - subject.x);

      expect(
        run.state.velocityX,
        `${nameOf(level, tuning)} never came to rest at "${subject.id}"`,
      ).toBe(0);
      expect(
        missedBy,
        `${nameOf(level, tuning)} stopped ${Math.round(missedBy)} px from "${subject.id}", ` +
          `which its ${reach} px reach cannot cover`,
      ).toBeLessThanOrEqual(reach);
    }
  });

  it('does it without ever synthesising a direction: the intent stays zero', () => {
    for (const { level, tuning } of EVERY_MODE) {
      if ((tuning.interaction?.reachPx ?? 0) <= 0) continue;
      const run = drive(level, tuning, { frames: 60 * 60 });
      expect(
        run.frames.every((frame) => frame.intentMove === 0),
        `${nameOf(level, tuning)} was handed an intent no player asked for`,
      ).toBe(true);
      expect(run.frames.some((frame) => frame.velocityX !== 0)).toBe(true);
      expect(run.frames.some((frame) => frame.halted)).toBe(true);
    }
  });
});

/* --------------------------------------------------- a held drive stops too --- */

describe('a player holding to move stops at each thing too', () => {
  it('brings every shipped mode to rest inside its reach, with the control still held', () => {
    for (const { level, tuning } of EVERY_MODE) {
      const reach = tuning.interaction?.reachPx ?? 0;
      if (reach <= 0) continue;
      const subject = firstAhead(level);
      /* Nothing but "hold right", for a whole minute: if holding overruled the
         stop, the stop would never happen, because a held control is intent ≥
         the deadzone on every frame. */
      const run = drive(level, tuning, { frames: 60 * 60, autoMove: false, hold: () => 1 });
      const missedBy = Math.abs(run.state.x - subject.x);

      expect(
        run.state.velocityX,
        `${nameOf(level, tuning)} held to move and walked on past "${subject.id}"`,
      ).toBe(0);
      expect(
        missedBy,
        `${nameOf(level, tuning)} held to move and stopped ${Math.round(missedBy)} px from ` +
          `"${subject.id}", which its ${reach} px reach cannot cover`,
      ).toBeLessThanOrEqual(reach);
      expect(run.frames.at(-1)?.holding, nameOf(level, tuning)).toBe(subject.id);
      /* The brake took the move out of what it stepped, never out of what the
         player pressed: the trace still says the control was held throughout. */
      expect(run.frames.every((frame) => frame.intentMove === 1)).toBe(true);
    }
  });

  it('letting go and pressing again carries them on, to the next thing and no further', () => {
    const { level, tuning } = ENGAGEABLE;
    const [first, second] = aheadOf(level);
    if (first === undefined || second === undefined) {
      throw new Error(`${String(level.id)} places fewer than two things ahead of its spawn`);
    }
    const reach = tuning.interaction?.reachPx ?? 0;

    const player = holdLiftAndPress(level, { liftFrames: 6, then: () => 1 });
    const run = drive(level, tuning, { frames: 60 * 90, autoMove: false, hold: player.hold });

    expect(player.stoppedAt(), 'the held drive never stopped at all').not.toBeNull();
    expect(Math.abs((player.stoppedAt() ?? 0) - first.x)).toBeLessThanOrEqual(reach);
    expect(
      run.frames.some((frame) => frame.x > first.x + reach),
      `pressing again at "${first.id}" did not carry the player on`,
    ).toBe(true);
    /* And the thing they left did not catch them again on the way out. */
    const pastFirst = run.frames.findIndex((frame) => frame.x > first.x + reach);
    expect(
      run.frames.slice(pastFirst).some((frame) => frame.holding === first.id),
      `"${first.id}" caught the player a second time`,
    ).toBe(false);
    /* "Each": the next thing along stops them too, with the control held. */
    expect(run.state.velocityX).toBe(0);
    expect(run.frames.at(-1)?.holding).toBe(second.id);
    expect(Math.abs(run.state.x - second.x)).toBeLessThanOrEqual(reach);
  });

  it('steering the other way lets go at once, without letting go of anything first', () => {
    /* TN-SET-05. No lift frames: the control goes straight from right to left,
       which a finger dragged across the player does. */
    const { level, tuning } = ENGAGEABLE;
    const player = holdLiftAndPress(level, { liftFrames: 0, then: () => -1 });
    const run = drive(level, tuning, { frames: 60 * 20, autoMove: false, hold: player.hold });

    const stoppedAt = player.stoppedAt();
    expect(stoppedAt, 'the held drive never stopped, so there was nothing to steer out of').not.toBeNull();
    const firstBack = run.frames.findIndex((frame) => frame.intentMove === -1);
    expect(firstBack).toBeGreaterThan(0);
    expect(run.frames[firstBack]?.halted, 'the player steered back and was still held').toBe(false);
    expect(run.frames[firstBack]?.holding).toBeNull();
    expect(run.state.x).toBeLessThan(stoppedAt ?? 0);
  });

  it('engaging lets go of a held drive, with the control still held', () => {
    const { level, tuning } = ENGAGEABLE;
    const subject = firstAhead(level);
    const reach = tuning.interaction?.reachPx ?? 0;

    const run = drive(level, tuning, {
      frames: 60 * 60,
      autoMove: false,
      hold: () => 1,
      engageWhenStopped: true,
    });

    expect(run.frames.some((frame) => frame.halted)).toBe(true);
    expect(
      run.frames.some((frame) => frame.x > subject.x + reach),
      'the player engaged what stopped them and was still held there',
    ).toBe(true);
  });
});

/* ------------------------------------------------------------ the latching --- */

describe('it stops once per visit for each thing, and never twice', () => {
  it('engaging releases an automatic hold, and the drive carries the player past it', () => {
    const { level, tuning } = ENGAGEABLE;
    const subject = firstAhead(level);
    const reach = tuning.interaction?.reachPx ?? 0;

    const run = drive(level, tuning, { frames: 60 * 60, engageWhenStopped: true });

    expect(run.frames.some((frame) => frame.halted)).toBe(true);
    expect(
      run.frames.some((frame) => frame.x > subject.x + reach),
      'the player never got going again after engaging what stopped them',
    ).toBe(true);
    /* And they were not caught by it a second time on the way out. */
    const leaving = run.frames.filter((frame) => frame.x > subject.x + reach);
    expect(leaving.every((frame) => frame.holding !== subject.id)).toBe(true);
  });

  it('walking back past a thing it let the player go from does not stop them', () => {
    const { level, tuning } = ENGAGEABLE;
    const subject = firstAhead(level);
    const reach = tuning.interaction?.reachPx ?? 0;

    /* Stop, lift, press on until well past it, then turn and walk all the way
       back. The second leg passes the same landmark at speed. */
    let turned = false;
    const player = holdLiftAndPress(level, {
      liftFrames: 6,
      then: (state) => {
        if (state.x > subject.x + reach * 2) turned = true;
        return turned ? -1 : 1;
      },
    });
    const run = drive(level, tuning, { frames: 60 * 40, autoMove: false, hold: player.hold });

    expect(turned, 'the player never got far enough past to turn back').toBe(true);
    expect(run.state.x, 'the player never walked back past it').toBeLessThan(subject.x - reach);
    const walkingBack = run.frames.filter((frame) => frame.intentMove === -1);
    expect(walkingBack.length).toBeGreaterThan(0);
    expect(walkingBack.some((frame) => frame.halted)).toBe(false);
  });

  it('a new visit stops for it again, however it was finished before', () => {
    /*
     * Finished subjects are not exempt. `TN-REACH-03` offers a done target as
     * "Done. See this one again", and a train that must stop to engage, or a
     * player on auto-move, can only take that offer up if the drive stops. The
     * latch lives in the watch and the scene builds one per level visit, so a
     * replay stops once at each thing and never twice.
     */
    const speed = ANY_TUNING.maxSpeed / 2;
    const line = stopLinePx(speed, ANY_TUNING);
    const frame: AutoStopFrame = {
      automatic: true,
      playerX: 0,
      velocityX: speed,
      playerMove: 0,
      subjects: [{ id: 'finished-last-time', x: line * 0.5 }],
    };

    const firstVisit = createAutoStop(ANY_TUNING);
    expect(firstVisit.update(frame)).toBe(true);
    firstVisit.release('finished-last-time');
    expect(firstVisit.update(frame)).toBe(false);

    const nextVisit = createAutoStop(ANY_TUNING);
    expect(nextVisit.update(frame)).toBe(true);
    expect(nextVisit.holding).toBe('finished-last-time');
  });
});

/* --------------------------------------------- the player is never trapped --- */

describe('a player can always overrule it (TN-SET-05: no setting traps the player)', () => {
  it('a nudge forward releases an automatic hold and the drive carries them on', () => {
    const { level, tuning } = ENGAGEABLE;
    const subject = firstAhead(level);

    /*
     * The resume a player who *can* hold something gets: a touch, and letting go
     * carries them on. It is a nudge and not a trip to the settings screen,
     * which is the difference between an option and a chore.
     */
    let stoppedAt: number | null = null;
    const run = drive(level, tuning, {
      frames: 60 * 40,
      hold: (state) => {
        if (stoppedAt === null && state.velocityX === 0 && state.x > level.spawn.x + 50) {
          stoppedAt = state.x;
        }
        return stoppedAt !== null && state.x < stoppedAt + 60 ? 1 : 0;
      },
    });

    expect(
      stoppedAt,
      'the automatic drive never stopped, so there was nothing to overrule',
    ).not.toBeNull();
    expect(run.frames.some((frame) => frame.intentMove === 1 && !frame.halted)).toBe(true);
    expect(
      run.frames.some((frame) => frame.x > subject.x && frame.intentMove === 0),
      'the nudge released the hold and the automatic drive did not carry them on',
    ).toBe(true);
  });

  it('stops for nothing in a mode that can engage nothing', () => {
    const watch = createAutoStop({ ...ANY_TUNING, interaction: null });
    expect(
      watch.update({
        automatic: true,
        playerX: 0,
        velocityX: ANY_TUNING.maxSpeed,
        playerMove: 1,
        subjects: [{ id: 'anything', x: 10 }],
      }),
    ).toBe(false);
    expect(watch.holding).toBeNull();
  });
});

/* ------------------------------------------------------------- the details --- */

describe('the small print', () => {
  const SPEED = ANY_TUNING.maxSpeed / 2;
  const LINE = stopLinePx(SPEED, ANY_TUNING);

  const frame = (over: Partial<AutoStopFrame>): AutoStopFrame => ({
    automatic: true,
    playerX: 0,
    velocityX: SPEED,
    playerMove: 0,
    subjects: [{ id: 'ahead', x: LINE * 0.5 }],
    ...over,
  });

  it('never stops for something behind, or level with, the player', () => {
    const watch = createAutoStop(ANY_TUNING);
    expect(watch.update(frame({ subjects: [{ id: 'behind', x: -LINE * 0.5 }] }))).toBe(false);
    expect(watch.update(frame({ subjects: [{ id: 'here', x: 0 }] }))).toBe(false);
    expect(watch.update(frame({ subjects: [{ id: 'far', x: LINE * 2 }] }))).toBe(false);
  });

  it('reads “ahead” from the way the player is travelling, not from the level', () => {
    const watch = createAutoStop(ANY_TUNING);
    expect(
      watch.update(frame({ velocityX: -SPEED, subjects: [{ id: 'l', x: -LINE * 0.5 }] })),
    ).toBe(true);
    expect(watch.holding).toBe('l');
  });

  it('cannot pin a player on the spawn, because at rest the line is zero', () => {
    const watch = createAutoStop(ANY_TUNING);
    expect(watch.update(frame({ velocityX: 0, subjects: [{ id: 'ahead', x: 1 }] }))).toBe(false);
    expect(watch.update(frame({ velocityX: 0, playerMove: 1, subjects: [{ id: 'ahead', x: 1 }] }))).toBe(false);
    expect(watch.holding).toBeNull();
  });

  it('holds the same subject until something releases it, and does not re-take it', () => {
    const watch = createAutoStop(ANY_TUNING);
    expect(watch.update(frame({}))).toBe(true);
    expect(watch.holding).toBe('ahead');
    /* Come to rest, and stay held: the drive does not restart itself. */
    expect(watch.update(frame({ velocityX: 0 }))).toBe(true);
    expect(watch.update(frame({ velocityX: 0 }))).toBe(true);

    watch.release();
    expect(watch.holding).toBeNull();
    /* Back at cruise speed, the same subject the same distance ahead: the latch
       is what stops a player who has finished with a landmark being halted by it
       again on the way back. */
    expect(watch.update(frame({}))).toBe(false);
    expect(watch.update(frame({ subjects: [{ id: 'another', x: LINE * 0.5 }] }))).toBe(true);
  });

  it('a press that begins while an automatic drive is held releases it on that frame', () => {
    const watch = createAutoStop(ANY_TUNING);
    expect(watch.update(frame({}))).toBe(true);
    expect(watch.update(frame({ playerMove: 1 }))).toBe(false);
    expect(watch.holding).toBeNull();
    /* And the subject they steered past does not catch them again. */
    expect(watch.update(frame({}))).toBe(false);
  });

  it('ignores an input the strategy would ignore, so the two agree on “no input”', () => {
    const watch = createAutoStop(ANY_TUNING);
    expect(watch.update(frame({ playerMove: MOVE_DEADZONE / 2 }))).toBe(true);
    expect(watch.holding).toBe('ahead');
    expect(watch.update(frame({ playerMove: -MOVE_DEADZONE / 2 }))).toBe(true);
    expect(watch.holding).toBe('ahead');
    /* A move that is not a number is a caller bug, and reads as nothing pressed
       rather than as a press that releases the player. */
    expect(watch.update(frame({ playerMove: Number.NaN }))).toBe(true);
    expect(watch.holding).toBe('ahead');
  });

  it('a control already down when the stop caught it does not release it; pressing again does', () => {
    const watch = createAutoStop(ANY_TUNING);
    const held = (over: Partial<AutoStopFrame>): AutoStopFrame =>
      frame({ automatic: false, playerMove: 1, ...over });

    expect(watch.update(held({}))).toBe(true);
    expect(watch.holding).toBe('ahead');
    /* Still held down, and now at rest: still stopped. */
    expect(watch.update(held({ velocityX: 0 }))).toBe(true);
    expect(watch.update(held({ velocityX: 0 }))).toBe(true);
    /* Let go: still stopped — there is no timer, and nothing restarts. */
    expect(watch.update(held({ velocityX: 0, playerMove: 0 }))).toBe(true);
    /* Press again: released, on that frame. */
    expect(watch.update(held({ velocityX: 0 }))).toBe(false);
    expect(watch.holding).toBeNull();
    /* And not caught by the same thing again while they carry on. */
    expect(watch.update(held({}))).toBe(false);
  });

  it('the other way releases at once, even from a control held down throughout', () => {
    const watch = createAutoStop(ANY_TUNING);
    expect(watch.update(frame({ automatic: false, playerMove: 1 }))).toBe(true);
    expect(watch.update(frame({ automatic: false, velocityX: 0, playerMove: -1 }))).toBe(false);
    expect(watch.holding).toBeNull();
  });

  it('pressing against the travel is braking or turning, and catches nothing', () => {
    for (const automatic of [false, true]) {
      const watch = createAutoStop(ANY_TUNING);
      expect(watch.update(frame({ automatic, playerMove: -1 })), `automatic: ${String(automatic)}`)
        .toBe(false);
      expect(watch.holding).toBeNull();
    }
  });

  it('a glide nobody is pressing is caught only when the drive is automatic', () => {
    /* `TN-LEVEL-06`: releasing a held control glides exactly as a released touch
       does. A skater who let go is not driving, and the glide is theirs. */
    expect(createAutoStop(ANY_TUNING).update(frame({ automatic: false, playerMove: 0 }))).toBe(false);
    expect(createAutoStop(ANY_TUNING).update(frame({ automatic: true, playerMove: 0 }))).toBe(true);
  });

  it('turning auto-move off while held keeps the stop, and a press still releases it', () => {
    const watch = createAutoStop(ANY_TUNING);
    expect(watch.update(frame({}))).toBe(true);
    /* The settings screen pauses the level, so this is a player at rest or
       braking with nothing pressed. Letting go of the hold would hand a braking
       skater back to a 0.9 glide past the thing they were stopping at. */
    expect(watch.update(frame({ automatic: false }))).toBe(true);
    expect(watch.holding).toBe('ahead');
    expect(watch.update(frame({ automatic: false, playerMove: 1 }))).toBe(false);
    expect(watch.holding).toBeNull();
  });

  it('a pause hides the hands: the first press seen after it is a new one', () => {
    const watch = createAutoStop(ANY_TUNING);
    expect(watch.update(frame({ automatic: false, playerMove: 1 }))).toBe(true);
    /* The menu opened and closed; the thumb lifted and went down again while no
       frame ran. Without `forgetInput` the watch would call this the same press. */
    watch.forgetInput();
    expect(watch.update(frame({ automatic: false, velocityX: 0, playerMove: 1 }))).toBe(false);
    expect(watch.holding).toBeNull();
  });

  it('engaging something it was not holding latches that too', () => {
    /* A walk reaches a landmark 200 px before it would stop for it, and the
       player may engage it from there. Closing the card must not then stop them
       at the thing they have just engaged. */
    const watch = createAutoStop(ANY_TUNING);
    watch.release('ahead');
    expect(watch.update(frame({}))).toBe(false);
    expect(watch.holding).toBeNull();
    expect(watch.update(frame({ subjects: [{ id: 'another', x: LINE * 0.5 }] }))).toBe(true);
  });

  it('releasing when nothing is held and nothing is named is not an event', () => {
    const watch = createAutoStop(ANY_TUNING);
    watch.release();
    watch.forgetInput();
    expect(watch.holding).toBeNull();
    expect(watch.update(frame({}))).toBe(true);
  });

  it('engaging releases the hold as well as naming what was engaged', () => {
    const watch = createAutoStop(ANY_TUNING);
    expect(
      watch.update(frame({ subjects: [{ id: 'held', x: LINE * 0.3 }, { id: 'tapped', x: LINE * 0.6 }] })),
    ).toBe(true);
    expect(watch.holding).toBe('held');
    watch.release('tapped');
    expect(watch.holding).toBeNull();
    expect(
      watch.update(frame({ subjects: [{ id: 'held', x: LINE * 0.3 }, { id: 'tapped', x: LINE * 0.6 }] })),
    ).toBe(false);
  });

  it('picks the nearest of several things ahead, whichever order they are in', () => {
    const nearest = (order: readonly { id: string; x: number }[]): string | null => {
      const watch = createAutoStop(ANY_TUNING);
      expect(watch.update(frame({ subjects: order }))).toBe(true);
      return watch.holding;
    };
    const far = { id: 'far', x: LINE * 0.9 };
    const near = { id: 'near', x: LINE * 0.4 };
    expect(nearest([far, near])).toBe('near');
    expect(nearest([near, far])).toBe('near');
  });
});
