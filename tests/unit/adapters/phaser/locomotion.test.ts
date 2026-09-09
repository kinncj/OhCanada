/**
 * TN-LEVEL-03, as arithmetic.
 *
 * The story states skating as *relationships* — "at least 70 percent of
 * maxSpeed after 1 second", "at least five times as far as the walker", "takes
 * longer than reaching cruise speed from standing still" — precisely so the
 * numbers can be retuned without rewriting the tests. Every assertion below
 * therefore reads its numbers out of `content/levels/ottawa.json` and asserts a
 * relationship between them. Change `maxSpeed` in that file and this suite still
 * says the same thing; change the *feel* and it fails.
 *
 * The simulation runs at a fixed 60 Hz. That is not a claim about the device: it
 * is the frame rate at which a relationship stated in seconds is checkable, and
 * `dt` is the strategy's only time input, so a result at 60 Hz is a result about
 * the physics rather than about a browser.
 *
 * `walk` in the same file is the control. The two tunings go through the same
 * `createLocomotion` call and differ only in the numbers the level author wrote,
 * which is the whole of task 1.14's acceptance — and the source gate at the
 * bottom is what stops that from decaying into `if (mode === 'skate')`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type {
  LocomotionIntent,
  LocomotionState,
  LocomotionTuning,
} from '@application/ports';
import {
  GRAVITY_PX_S2,
  MAX_STEP_SECONDS,
  MOVE_DEADZONE,
  applyBounds,
  createLocomotion,
  createLocomotionFactory,
} from '@adapters/phaser/locomotion';
import { parseLevelDocument } from '@adapters/phaser/level-document';

import gameConfigJson from '@content/game.config.json';
/**
 * The locomotion vocabulary, from the config the game actually reads.
 *
 * Not a literal: `level-document.ts` held one, and Québec City declaring
 * `toboggan` passed `make validate-content` and then failed at load. A test
 * restating the list would let that come back one copy at a time (ADR-0023).
 */
const MODES: readonly string[] = (
  gameConfigJson as { locomotionModes: readonly string[] }
).locomotionModes;


const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

const ottawa = (() => {
  const raw: unknown = JSON.parse(
    readFileSync(`${REPO_ROOT}content/levels/ottawa.json`, 'utf8'),
  );
  const parsed = parseLevelDocument(raw, MODES);
  if (!parsed.ok) throw new Error(`content/levels/ottawa.json did not parse: ${parsed.error.message}`);
  return parsed.value;
})();

const tuningFor = (mode: LocomotionTuning['mode']): LocomotionTuning => {
  const found = ottawa.locomotion.find((entry) => entry.mode === mode);
  if (found === undefined) {
    throw new Error(
      `content/levels/ottawa.json declares no "${mode}" tuning. TN-LEVEL-03 compares skating ` +
        'against a walk tuning, so the level carries both and this suite reads them rather than ' +
        'inventing a control that no level ever validated.',
    );
  }
  return found;
};

const SKATE = tuningFor('skate');
const WALK = tuningFor('walk');

const HZ = 60;
const DT = 1 / HZ;

const flat = (overrides: Partial<LocomotionIntent> = {}): LocomotionIntent => ({
  move: 0,
  jumpPressed: false,
  jumpHeld: false,
  interactPressed: false,
  slope: 0,
  groundY: 0,
  ...overrides,
});

interface Sample {
  readonly frame: number;
  readonly ms: number;
  readonly state: LocomotionState;
  readonly intentMove: number;
  readonly events: readonly string[];
}

/**
 * Run a script of (intent, duration) phases and return every frame.
 *
 * Returning *every* frame rather than the final state is deliberate and mirrors
 * the scene probe's ring buffer: three of TN-LEVEL-03's assertions are about
 * what happened between two frames, and a simulation that only reports its
 * endpoint cannot answer them any more than a 10 Hz poll can.
 */
function run(
  tuning: LocomotionTuning,
  script: readonly (readonly [Partial<LocomotionIntent>, number])[],
): readonly Sample[] {
  const locomotion = createLocomotion(tuning);
  let state = locomotion.spawn(0, 0, 'right');
  const samples: Sample[] = [];
  let frame = 0;

  for (const [intentPatch, seconds] of script) {
    const frames = Math.round(seconds * HZ);
    for (let index = 0; index < frames; index += 1) {
      const intent = flat(intentPatch);
      const step = locomotion.step(state, intent, DT);
      state = step.state;
      frame += 1;
      samples.push({
        frame,
        ms: (frame * 1000) / HZ,
        state,
        intentMove: intent.move,
        events: step.events.map((event) => event.kind),
      });
    }
  }
  return samples;
}

const speedAt = (samples: readonly Sample[], ms: number): number => {
  const found = samples.find((sample) => sample.ms >= ms);
  return Math.abs(found?.state.velocityX ?? 0);
};

const distance = (samples: readonly Sample[]): number => {
  const first = samples[0];
  const last = samples[samples.length - 1];
  return Math.abs((last?.state.x ?? 0) - (first?.state.x ?? 0));
};

describe('the tuning the level authored is inside the band the story needs', () => {
  it.each([
    ['skate', SKATE],
    ['walk', WALK],
  ])('%s: deceleration < turnAcceleration < acceleration', (_mode, tuning) => {
    /* Restated here as a precondition, not as the check: the corpus gate is
       tests/unit/contracts/locomotion-tuning-is-coherent.test.ts. If this fails,
       every relationship below is being asserted against a tuning the project
       has already declared incoherent, and the failures would be misleading. */
    expect(tuning.deceleration).toBeLessThan(tuning.turnAcceleration);
    expect(tuning.turnAcceleration).toBeLessThan(tuning.acceleration);
  });
});

describe('speed builds up instead of starting at full pace', () => {
  const held = run(SKATE, [[{ move: 1 }, 1.2]]);

  it('is moving within 100 ms', () => {
    expect(speedAt(held, 100)).toBeGreaterThan(0);
  });

  it('is under half of maxSpeed after 200 ms', () => {
    expect(speedAt(held, 200)).toBeLessThan(SKATE.maxSpeed / 2);
  });

  it('is at least 70 percent of maxSpeed after 1 second', () => {
    expect(speedAt(held, 1_000)).toBeGreaterThanOrEqual(SKATE.maxSpeed * 0.7);
  });

  it('reports a "started-moving" fact exactly once, not once a frame', () => {
    const starts = held.filter((sample) => sample.events.includes('started-moving'));
    expect(starts).toHaveLength(1);
  });

  it('never exceeds maxSpeed on the flat', () => {
    for (const sample of held) {
      expect(Math.abs(sample.state.velocityX)).toBeLessThanOrEqual(SKATE.maxSpeed + 1e-9);
    }
  });
});

describe('releasing does not stop the skater', () => {
  const script = [
    [{ move: 1 }, 1.5],
    [{}, 3],
  ] as const;
  const samples = run(SKATE, script);
  const released = samples.filter((sample) => sample.intentMove === 0);

  it('is still at least half of maxSpeed one second after the release', () => {
    const start = released[0];
    expect(start).toBeDefined();
    const later = released.find((sample) => sample.ms >= (start?.ms ?? 0) + 1_000);
    expect(Math.abs(later?.state.velocityX ?? 0)).toBeGreaterThanOrEqual(SKATE.maxSpeed / 2);
  });

  it('keeps moving the same way for at least two seconds', () => {
    const start = released[0];
    const twoSecondsOn = released.filter((sample) => sample.ms <= (start?.ms ?? 0) + 2_000);
    for (const sample of twoSecondsOn) expect(sample.state.velocityX).toBeGreaterThan(0);
  });

  it('never speeds up while nothing is held', () => {
    for (let index = 1; index < released.length; index += 1) {
      const previous = Math.abs(released[index - 1]?.state.velocityX ?? 0);
      const current = Math.abs(released[index]?.state.velocityX ?? 0);
      expect(current).toBeLessThanOrEqual(previous);
    }
  });

  it('reports "stopped" only on the frame speed actually reaches zero', () => {
    const long = run(SKATE, [
      [{ move: 1 }, 1.5],
      [{}, 20],
    ]);
    const stops = long.filter((sample) => sample.events.includes('stopped'));
    expect(stops).toHaveLength(1);
    expect(stops[0]?.state.velocityX).toBe(0);
  });
});

describe('glide is what makes skate different from walk', () => {
  it('the level authored the glide values the story compares', () => {
    expect(WALK.glide).toBeLessThanOrEqual(0.1);
    expect(SKATE.glide).toBeGreaterThanOrEqual(0.9);
  });

  it('the skater coasts at least five times as far as the walker', () => {
    /* Each accelerated to its OWN cruise speed and then released, which is what
       the story says — the comparison is between two modes at their own pace,
       not between two speeds. */
    const coastOf = (tuning: LocomotionTuning): number => {
      const samples = run(tuning, [
        [{ move: 1 }, 2],
        [{}, 30],
      ]);
      return distance(samples.filter((sample) => sample.intentMove === 0));
    };

    const skate = coastOf(SKATE);
    const walk = coastOf(WALK);
    expect(walk).toBeGreaterThan(0);
    expect(
      skate / walk,
      `skate coasts ${skate.toFixed(0)} px, walk ${walk.toFixed(0)} px — ratio ${(skate / walk).toFixed(1)}x`,
    ).toBeGreaterThanOrEqual(5);
  });
});

describe('turning around costs time', () => {
  const samples = run(SKATE, [
    [{ move: 1 }, 1.5],
    [{ move: -1 }, 2.5],
  ]);

  it('passes through zero before the player moves left', () => {
    const firstLeft = samples.findIndex((sample) => sample.state.velocityX < 0);
    expect(firstLeft).toBeGreaterThan(0);
    const before = samples.slice(0, firstLeft);
    expect(
      before.some((sample) => sample.state.velocityX === 0),
      'the skater reversed without passing through a stop',
    ).toBe(true);
  });

  it('faces left only once it is actually moving left', () => {
    for (const sample of samples) {
      if (sample.state.facing === 'left') expect(sample.state.velocityX).toBeLessThan(0);
    }
  });

  it('reaching cruise the other way takes longer than starting from rest', () => {
    const cruise = SKATE.maxSpeed * 0.95;
    const fromRest = run(SKATE, [[{ move: 1 }, 3]]).find(
      (sample) => Math.abs(sample.state.velocityX) >= cruise,
    );
    const reversal = samples.find((sample) => sample.state.velocityX <= -cruise);
    const turnStarted = samples.find((sample) => sample.intentMove === -1);

    expect(fromRest).toBeDefined();
    expect(reversal).toBeDefined();
    const restMs = fromRest?.ms ?? 0;
    const turnMs = (reversal?.ms ?? 0) - (turnStarted?.ms ?? 0);
    expect(turnMs).toBeGreaterThan(restMs);
  });
});

describe('holding the other way is the brake, and there is no instant stop', () => {
  const braked = run(SKATE, [
    [{ move: 1 }, 1.5],
    [{ move: -1 }, 2 ],
  ]);

  it('reports "braked" once per brake, not once per frame', () => {
    const events = braked.filter((sample) => sample.events.includes('braked'));
    expect(events).toHaveLength(1);
  });

  it('stops in a shorter distance than a free glide from the same speed', () => {
    const from = SKATE.maxSpeed;
    const brakeSamples = braked.filter((sample) => sample.intentMove === -1);
    const brakeStart = brakeSamples[0];
    const brakeStop = brakeSamples.find((sample) => sample.state.velocityX === 0);
    expect(brakeStart).toBeDefined();
    expect(brakeStop).toBeDefined();
    const brakeDistance = Math.abs((brakeStop?.state.x ?? 0) - (brakeStart?.state.x ?? 0));

    const glide = run(SKATE, [
      [{ move: 1 }, 1.5],
      [{}, 30],
    ]);
    const glideSamples = glide.filter((sample) => sample.intentMove === 0);
    const glideDistance = distance(glideSamples);

    /* The premise: the brake really did start from cruise. One frame of
       `turnAcceleration` has already been applied by the time the first braking
       sample is recorded, so this is "within a frame of maxSpeed", not equality. */
    expect(Math.abs(brakeStart?.state.velocityX ?? 0)).toBeGreaterThan(
      from - SKATE.turnAcceleration * DT - 1e-9,
    );
    expect(brakeDistance).toBeLessThan(glideDistance);
  });

  it('never falls from above half of maxSpeed to zero inside a single frame', () => {
    for (let index = 1; index < braked.length; index += 1) {
      const previous = Math.abs(braked[index - 1]?.state.velocityX ?? 0);
      const current = Math.abs(braked[index]?.state.velocityX ?? 0);
      if (previous > SKATE.maxSpeed / 2) expect(current).toBeGreaterThan(0);
    }
  });

  it('holds that invariant even for a frame time no browser should ever hand it', () => {
    /* The reason `step` clamps `dt` as well as the caller. A backgrounded tab
       produces a delta of seconds; without the clamp, one call would remove
       `turnAcceleration x dt` of speed and take a cruising skater to zero in a
       single recorded frame, which is the exact thing TN-LEVEL-03 forbids. */
    const locomotion = createLocomotion(SKATE);
    let state = locomotion.spawn(0, 0, 'right');
    for (let index = 0; index < 90; index += 1) {
      state = locomotion.step(state, flat({ move: 1 }), DT).state;
    }
    expect(Math.abs(state.velocityX)).toBeGreaterThan(SKATE.maxSpeed / 2);

    const after = locomotion.step(state, flat({ move: -1 }), 5).state;
    expect(after.velocityX).toBeGreaterThan(0);
    expect(Math.abs(state.velocityX) - Math.abs(after.velocityX)).toBeLessThanOrEqual(
      SKATE.turnAcceleration * MAX_STEP_SECONDS + 1e-9,
    );
  });
});

describe('a slope adds speed, up to a stated limit', () => {
  const downhill = run(SKATE, [[{ move: 1, slope: -1 }, 4]]);

  it('may rise above maxSpeed', () => {
    const top = Math.max(...downhill.map((sample) => Math.abs(sample.state.velocityX)));
    expect(top).toBeGreaterThan(SKATE.maxSpeed);
  });

  it('never rises above maxSpeed multiplied by maxSpeedMultiplierDownhill', () => {
    const ceiling = SKATE.maxSpeed * SKATE.maxSpeedMultiplierDownhill;
    for (const sample of downhill) {
      expect(Math.abs(sample.state.velocityX)).toBeLessThanOrEqual(ceiling + 1e-9);
    }
  });

  it('is slower uphill than on the flat, from the same one number', () => {
    const uphill = run(SKATE, [[{ move: 1, slope: 1 }, 4]]);
    const flatRun = run(SKATE, [[{ move: 1 }, 4]]);
    expect(Math.abs(uphill.at(-1)?.state.velocityX ?? 0)).toBeLessThan(
      Math.abs(flatRun.at(-1)?.state.velocityX ?? 0),
    );
  });

  it('does not let a slope add speed to a player holding nothing', () => {
    const coasting = run(SKATE, [
      [{ move: 1 }, 1.5],
      [{ slope: -1 }, 3],
    ]).filter((sample) => sample.intentMove === 0);
    for (let index = 1; index < coasting.length; index += 1) {
      expect(Math.abs(coasting[index]?.state.velocityX ?? 0)).toBeLessThanOrEqual(
        Math.abs(coasting[index - 1]?.state.velocityX ?? 0),
      );
    }
  });
});

describe('tapping the ice is a hop that keeps the momentum', () => {
  const locomotion = createLocomotion(SKATE);

  it('leaves the ground, lands, and keeps at least 90 percent of the take-off speed', () => {
    let state = locomotion.spawn(0, 0, 'right');
    for (let index = 0; index < 90; index += 1) {
      state = locomotion.step(state, flat({ move: 1 }), DT).state;
    }
    const takeOffSpeed = Math.abs(state.velocityX);

    const jump = locomotion.step(state, flat({ move: 1, jumpPressed: true }), DT);
    state = jump.state;
    expect(jump.events.map((event) => event.kind)).toContain('took-off');
    expect(state.grounded).toBe(false);

    let landed = false;
    let landingSpeed = 0;
    for (let index = 0; index < 240 && !landed; index += 1) {
      const step = locomotion.step(state, flat({ move: 1 }), DT);
      state = step.state;
      if (step.events.some((event) => event.kind === 'landed')) {
        landed = true;
        landingSpeed = Math.abs(state.velocityX);
      }
    }

    expect(landed, 'the skater never came back down').toBe(true);
    expect(landingSpeed).toBeGreaterThanOrEqual(takeOffSpeed * 0.9);
  });

  it('has no second jump and no trick', () => {
    let state = locomotion.spawn(0, 0, 'right');
    state = locomotion.step(state, flat({ jumpPressed: true }), DT).state;
    expect(state.grounded).toBe(false);

    const second = locomotion.step(state, flat({ jumpPressed: true }), DT);
    expect(second.events.map((event) => event.kind)).not.toContain('took-off');
    expect(second.state.jumpsUsed).toBe(SKATE.jump?.maxJumps ?? 1);
  });

  it('gravity is the engine constant, not a per-level guess', () => {
    /* Recorded as an assertion because it is the one number in this system that
       a level CANNOT tune: `jumpAffordance` has no gravity field. See the note
       in locomotion.ts, and the report to the schema owner. */
    let state = createLocomotion({ ...SKATE, jump: null }).spawn(0, 0, 'right');
    state = { ...state, grounded: false, y: -1000 };
    const next = createLocomotion({ ...SKATE, jump: null }).step(state, flat(), DT).state;
    expect(next.velocityY).toBeCloseTo(GRAVITY_PX_S2 * DT, 6);
  });
});

describe('the player cannot leave the level', () => {
  const bounds = { left: 0, right: 4_000 };

  it('is clamped at the bound', () => {
    const locomotion = createLocomotion(SKATE);
    let state = locomotion.spawn(50, 0, 'left');
    for (let index = 0; index < 600; index += 1) {
      state = applyBounds(locomotion.step(state, flat({ move: -1 }), DT).state, bounds, SKATE, DT);
      expect(state.x).toBeGreaterThanOrEqual(bounds.left);
    }
  });

  it('brakes into the wall rather than zeroing the speed in one frame', () => {
    const locomotion = createLocomotion(SKATE);
    const fast = { ...locomotion.spawn(bounds.left - 10, 0, 'left'), velocityX: -SKATE.maxSpeed };
    const after = applyBounds(fast, bounds, SKATE, DT);
    expect(after.x).toBe(bounds.left);
    expect(Math.abs(after.velocityX)).toBeGreaterThan(0);
    expect(Math.abs(fast.velocityX) - Math.abs(after.velocityX)).toBeCloseTo(
      SKATE.turnAcceleration * DT,
      6,
    );
  });

  it('leaves a player inside the level exactly as it found them', () => {
    const state = createLocomotion(SKATE).spawn(2_000, 0, 'right');
    expect(applyBounds(state, bounds, SKATE, DT)).toBe(state);
  });
});

describe('the ground is where the level says it is', () => {
  it('a grounded skater rides the polyline rather than falling down it', () => {
    const locomotion = createLocomotion(SKATE);
    let state = locomotion.spawn(0, 100, 'right');
    /* The ground drops away under the player every frame. A naive contact test
       would go airborne here and the skater would chatter down the bank. */
    for (let index = 0; index < 60; index += 1) {
      const groundY = 100 + index * 4;
      state = locomotion.step(state, flat({ move: 1, groundY }), DT).state;
      expect(state.grounded).toBe(true);
      expect(state.y).toBe(groundY);
    }
  });

  it('an analogue stick inside the deadzone is at rest', () => {
    const locomotion = createLocomotion(SKATE);
    const state = locomotion.step(
      locomotion.spawn(0, 0, 'right'),
      flat({ move: MOVE_DEADZONE / 2 }),
      DT,
    ).state;
    expect(state.velocityX).toBe(0);
  });
});

describe('drive: auto is a number in the level file, not a second code path', () => {
  it('moves with no input at all, in the direction it faces', () => {
    const auto: LocomotionTuning = { ...SKATE, drive: 'auto' };
    const samples = run(auto, [[{}, 1]]);
    expect(samples.at(-1)?.state.velocityX ?? 0).toBeGreaterThan(0);
  });

  it('still obeys a held direction, so a switch user can turn around', () => {
    const auto: LocomotionTuning = { ...SKATE, drive: 'auto' };
    const samples = run(auto, [
      [{}, 1],
      [{ move: -1 }, 3],
    ]);
    expect(samples.at(-1)?.state.velocityX ?? 0).toBeLessThan(0);
  });
});

describe('interaction is an affordance, not a verb the scene owns', () => {
  it('asks to engage when the mode allows it while moving', () => {
    const locomotion = createLocomotion(SKATE);
    const state = { ...locomotion.spawn(0, 0, 'right'), velocityX: SKATE.maxSpeed };
    const step = locomotion.step(state, flat({ interactPressed: true }), DT);
    expect(step.events.map((event) => event.kind)).toContain('interaction-requested');
  });

  it('refuses while moving when the mode requires a stop', () => {
    const canoe: LocomotionTuning = {
      ...SKATE,
      interaction: { reachPx: 200, requiresStop: true, whileMoving: false, approachSpeed: 0 },
    };
    const locomotion = createLocomotion(canoe);
    const moving = { ...locomotion.spawn(0, 0, 'right'), velocityX: 400 };
    expect(
      locomotion.step(moving, flat({ interactPressed: true }), DT).events.map((e) => e.kind),
    ).not.toContain('interaction-requested');
  });

  it('says nothing at all when the mode cannot engage', () => {
    const locomotion = createLocomotion({ ...SKATE, interaction: null });
    expect(
      locomotion
        .step(locomotion.spawn(0, 0, 'right'), flat({ interactPressed: true }), DT)
        .events.map((event) => event.kind),
    ).not.toContain('interaction-requested');
  });

  it('a mode that cannot jump does not jump', () => {
    const locomotion = createLocomotion({ ...SKATE, jump: null });
    const step = locomotion.step(locomotion.spawn(0, 0, 'right'), flat({ jumpPressed: true }), DT);
    expect(step.events.map((event) => event.kind)).not.toContain('took-off');
    expect(step.state.grounded).toBe(true);
  });
});

describe('animationSpeed is the normalised speed the rig is fed', () => {
  it('is 0 at rest and 1 at cruise', () => {
    const locomotion = createLocomotion(SKATE);
    expect(locomotion.step(locomotion.spawn(0, 0, 'right'), flat(), DT).animationSpeed).toBe(0);
    const cruising = { ...locomotion.spawn(0, 0, 'right'), velocityX: SKATE.maxSpeed };
    expect(locomotion.step(cruising, flat({ move: 1 }), DT).animationSpeed).toBeCloseTo(1, 3);
  });
});

describe('the factory is a registry, not a list of things somebody remembered', () => {
  const factory = createLocomotionFactory(MODES);

  it('offers every mode the config declares, and nothing it does not', () => {
    /*
     * Read from `content/game.config.json`, not restated (ADR-0023). This test
     * used to list eight names, and the ninth — `toboggan`, for Québec City —
     * arrived in content and broke the engine at load: the parser held its own
     * copy of the vocabulary and refused a mode the schema had already accepted.
     * A test with a tenth copy would have hidden the fix as readily as it hid
     * the bug.
     */
    expect([...factory.modes].sort()).toEqual([...MODES].sort());
    expect(MODES.length, 'the config declares no modes, so this asserts nothing').toBeGreaterThan(1);
  });

  it.each(factory.modes)('builds %s from the same strategy', (mode) => {
    const built = factory.create({ ...SKATE, mode });
    expect(built.ok).toBe(true);
  });

  it('fails as unsupported for a mode no schema declares', () => {
    const built = factory.create({ ...SKATE, mode: 'hovercraft' as LocomotionTuning['mode'] });
    expect(built.ok).toBe(false);
    if (!built.ok) expect(built.error.kind).toBe('unsupported');
  });
});

describe('walk and skate differ by data only', () => {
  it('is the same function, given two records', () => {
    const skate = createLocomotion(SKATE);
    const walk = createLocomotion(WALK);
    /* Same shape, same methods, different tuning. If a mode ever needed its own
       strategy, this is the assertion that would have to be deleted first. */
    expect(Object.keys(skate).sort()).toEqual(Object.keys(walk).sort());
    expect(skate.tuning).not.toBe(walk.tuning);
  });

  it('no locomotion mode name appears in the strategy source', () => {
    /* The structural half of the claim, and the one that survives a future
       author. Comments are stripped first, because the header explains the modes
       and must be allowed to: what must not exist is a mode name the *code* can
       branch on. `LOCOMOTION_MODES` lives in `level-document.ts`, where naming
       the schema's enum is the job. */
    const source = readFileSync(`${REPO_ROOT}app/adapters/phaser/locomotion.ts`, 'utf8');
    const code = source
      .replace(/\/\*[\s\S]*?\*\//gu, '')
      .replace(/^\s*\/\/.*$/gmu, '');

    const offenders = ['walk', 'canoe', 'skate', 'bike', 'train', 'horse', 'skateboard', 'dogsled']
      .filter((mode) => new RegExp(`['"\`]${mode}['"\`]`, 'u').test(code));

    expect(
      offenders,
      `app/adapters/phaser/locomotion.ts branches on ${offenders.join(', ')}. Task 1.14's ` +
        'acceptance is that walk and skate differ by DATA only; a mode name in the strategy is ' +
        'the first step back to a mode-shaped if.',
    ).toEqual([]);
  });
});
