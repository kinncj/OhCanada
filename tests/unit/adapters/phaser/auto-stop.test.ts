/**
 * An automatic drive stops for the things a player can choose.
 *
 * Auto-move moved and never stopped: a player who cannot hold a control walked
 * past every landmark and every character in the level, so the accessibility
 * option removed the interaction it exists to preserve. The same hole is already
 * written into `content/levels/prairie-rail.json`, which declares `drive: "auto"`
 * with `interaction.requiresStop: true` — a mode that must come to rest before it
 * can engage, and nothing anywhere that would ever bring it to rest.
 *
 * The rule is proved here, against the real level documents and the real
 * locomotion strategy, for the reason `level-exit.test.ts` gives: `level-scene.ts`
 * imports Phaser at module scope and cannot be loaded under `environment: 'node'`,
 * so a rule left in the scene is a rule proved once, in one browser, on one
 * machine. What the browser suite adds (`tests/e2e/auto-move-stops.spec.ts`) is
 * that the wire from the settings switch down to this arithmetic exists.
 *
 * The property that matters is **not** "it stops". It is "it comes to rest close
 * enough to engage, in every mode the game ships, from that mode's own cruise
 * speed": a halt 400 px short of a landmark is the same defect wearing a coat.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  brakeDistancePx,
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

import type { LocomotionState, LocomotionTuning } from '@application/ports';

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

/** The first level whose spawn mode can engage anything. */
const ENGAGEABLE: { readonly level: SceneLevel; readonly tuning: LocomotionTuning } =
  ((): { readonly level: SceneLevel; readonly tuning: LocomotionTuning } => {
    const found = LEVELS.map((level) => ({ level, tuning: level.locomotion[0] })).find(
      (entry): entry is { level: SceneLevel; tuning: LocomotionTuning } =>
        (entry.tuning?.interaction?.reachPx ?? 0) > 0,
    );
    if (found === undefined) throw new Error('no shipped level spawns in a mode that can engage');
    return found;
  })();

/** The pair `(level, mode)` as it reads in a failure message. */
const nameOf = (level: SceneLevel, tuning: LocomotionTuning): string =>
  `${String(level.id)}/${tuning.mode}`;

/** Everything a level places that a player could choose, as the watch wants it. */
function subjectsOf(level: SceneLevel): readonly { readonly id: string; readonly x: number }[] {
  return [
    ...level.pois.map((poi) => ({ id: String(poi.id), x: poi.position.x })),
    ...level.characters.map((character) => ({
      id: String(character.characterId),
      x: character.position.x,
    })),
  ];
}

/** The first thing a player leaving the spawn to the right would come to. */
function firstAhead(level: SceneLevel): { readonly id: string; readonly x: number } {
  const ahead = subjectsOf(level)
    .filter((subject) => subject.x > level.spawn.x)
    .sort((a, b) => a.x - b.x);
  const first = ahead[0];
  if (first === undefined) {
    throw new Error(
      `${String(level.id)} places nothing ahead of its spawn, so there is nothing an ` +
        'automatic drive could stop for and this level cannot be asserted about.',
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
}

/**
 * Run the level for real at 60 fps with the drive automatic and nobody touching
 * anything.
 *
 * The same two strategies the scene builds, the same bounds clamp and the same
 * ground samples, so what is asserted below is the game rather than a model of
 * it. `hold` is the player's own intent per frame — the only door the override
 * and the resume have.
 */
function drive(
  level: SceneLevel,
  tuning: LocomotionTuning,
  options: {
    readonly frames: number;
    readonly completed?: ReadonlySet<string>;
    readonly hold?: (state: LocomotionState) => number;
    readonly engageWhenStopped?: boolean;
    readonly automatic?: boolean;
  },
): { readonly frames: readonly RunFrame[]; readonly state: LocomotionState } {
  const auto = createLocomotion({ ...tuning, drive: 'auto' });
  const braking = createLocomotion(brakingTuning(tuning));
  const watch = createAutoStop(tuning);
  const bounds = levelBounds(level.ground, level.size);
  const subjects = subjectsOf(level);
  const completed = options.completed ?? new Set<string>();

  let state = auto.spawn(level.spawn.x, groundYAt(level.ground, level.spawn.x), 'right');
  const frames: RunFrame[] = [];
  const dt = 1 / 60;

  for (let frame = 0; frame < options.frames; frame += 1) {
    const move = options.hold?.(state) ?? 0;
    const halted = watch.update({
      automatic: options.automatic ?? true,
      playerX: state.x,
      velocityX: state.velocityX,
      playerMove: move,
      subjects,
      completed,
    });
    /* Engaging is what releases the hold, and the scene releases it from
       `#engageNearest` — the same call, at the same moment, here. */
    if (halted && options.engageWhenStopped === true && state.velocityX === 0) watch.release();

    const step = (halted ? braking : auto).step(
      state,
      {
        move,
        jumpPressed: false,
        jumpHeld: false,
        interactPressed: false,
        slope: slopeAt(level.ground, state.x),
        groundY: groundYAt(level.ground, state.x),
      },
      dt,
    );
    state = applyBounds(step.state, bounds, tuning, dt);
    frames.push({ x: state.x, velocityX: state.velocityX, intentMove: move, halted });
  }

  return { frames, state };
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

  it('brings every shipped mode to rest inside its own reach of what it stopped for', () => {
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

/* ------------------------------------------------------------ the latching --- */

describe('it does not stop twice for the same thing', () => {
  it('engaging releases the hold, and the drive carries the player past it', () => {
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
    expect(leaving.every((frame) => !frame.halted || frame.x > subject.x + reach * 2)).toBe(true);
  });

  it('never stops for something the domain has already reported finished', () => {
    const { level, tuning } = ENGAGEABLE;
    /*
     * What `markLevelComplete` does to the world: everything is `done`. It is
     * also why the end of a level needs nothing of its own here — the completion
     * card pauses the scene, and by the time anything could resume it there is
     * nothing left in the level asking to be done.
     */
    const everything = new Set(subjectsOf(level).map((subject) => subject.id));
    const run = drive(level, tuning, { frames: 60 * 30, completed: everything });

    expect(run.frames.some((frame) => frame.halted)).toBe(false);
    expect(run.state.x).toBeGreaterThan(firstAhead(level).x);
  });
});

/* --------------------------------------------- the player is never trapped --- */

describe('a player can always overrule it (TN-SET-05: no setting traps the player)', () => {
  it('a nudge forward releases the hold and the drive carries them on', () => {
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

  it('does nothing at all while the drive is not automatic', () => {
    const { level, tuning } = ENGAGEABLE;
    const run = drive(level, tuning, { frames: 60 * 30, automatic: false, hold: () => 1 });
    expect(run.frames.some((frame) => frame.halted)).toBe(false);
    expect(run.state.x).toBeGreaterThan(firstAhead(level).x);
  });

  it('stops for nothing in a mode that can engage nothing', () => {
    const watch = createAutoStop({ ...ANY_TUNING, interaction: null });
    expect(
      watch.update({
        automatic: true,
        playerX: 0,
        velocityX: ANY_TUNING.maxSpeed,
        playerMove: 0,
        subjects: [{ id: 'anything', x: 10 }],
        completed: new Set(),
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
    completed: new Set<string>(),
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

  it('a player’s own direction releases the hold on the frame they ask for it', () => {
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
  });

  it('drops the hold when the drive stops being automatic', () => {
    const watch = createAutoStop(ANY_TUNING);
    expect(watch.update(frame({}))).toBe(true);
    expect(watch.update(frame({ automatic: false }))).toBe(false);
    expect(watch.holding).toBeNull();
  });

  it('releasing when nothing is held is not an event', () => {
    const watch = createAutoStop(ANY_TUNING);
    watch.release();
    expect(watch.holding).toBeNull();
    expect(watch.update(frame({}))).toBe(true);
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
