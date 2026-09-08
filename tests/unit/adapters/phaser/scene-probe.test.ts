/**
 * The scene probe: the seam that lets a Playwright scenario about camera or
 * momentum fail.
 *
 * Two claims are load-bearing and each has a section here:
 *
 *   1. **It does not exist unless it was asked for.** `?e2e=1` and nothing else.
 *   2. **It can answer a per-frame question.** The 10 Hz element cannot — a
 *      100 ms poll sees one frame in six — so the invariants in `TN-LEVEL-03`
 *      are answered from an unsampled frame buffer instead. The last section
 *      below rehearses those exact assertions against a synthetic skate so the
 *      shape of the data is proven adequate before task 1.14 relies on it.
 */

import { describe, expect, it } from 'vitest';

import gameConfigJson from '@content/game.config.json';
import type { GraphicsPresets } from '@application/ports';

import {
  DEFAULT_TRACE_FRAMES,
  SNAPSHOT_THROTTLE_MS,
  createSceneProbe,
  formatProbeNumber,
  isSceneProbeEnabled,
  profileToSnapshot,
  sceneProbeHandle,
  snapshotToAttributes,
  type FrameTraceEntry,
  type ProbeElement,
} from '@adapters/phaser/scene-probe';
import { resolveRenderProfile } from '@adapters/phaser/visual-tier';

const PRESETS = (gameConfigJson as { graphicsPresets: GraphicsPresets }).graphicsPresets;

/** An element that remembers what was written to it. */
function fakeElement(): ProbeElement & {
  readonly attributes: Record<string, string>;
  readonly removed: () => boolean;
  readonly writes: () => number;
} {
  const attributes: Record<string, string> = {};
  let removed = false;
  let writes = 0;

  return {
    attributes,
    setAttribute(name, value) {
      attributes[name] = value;
      writes += 1;
    },
    remove() {
      removed = true;
    },
    removed: () => removed,
    writes: () => writes,
  };
}

/** A clock the test advances. */
function fakeClock(): { now: () => number; advance: (ms: number) => void } {
  let t = 0;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe('isSceneProbeEnabled', () => {
  it('is on for ?e2e=1 and nothing else', () => {
    expect(isSceneProbeEnabled('?e2e=1')).toBe(true);
    expect(isSceneProbeEnabled('?lang=fr&e2e=1')).toBe(true);
  });

  it.each(['', '?', '?e2e=0', '?e2e', '?e2e=true', '?e2e=yes', '?debug=1', '%%%', null, undefined])(
    'is off for %p, so a pasted URL cannot show a player a debug surface',
    (search) => {
      expect(isSceneProbeEnabled(search)).toBe(false);
    },
  );
});

describe('formatProbeNumber', () => {
  it('reads back as the number a level file wrote', () => {
    expect(formatProbeNumber(320)).toBe('320');
    expect(formatProbeNumber(412.5)).toBe('412.5');
    expect(formatProbeNumber(1 / 3)).toBe('0.33');
    expect(formatProbeNumber(-0.001)).toBe('0');
  });

  it('says "nan" rather than inventing a measurement', () => {
    expect(formatProbeNumber(Number.NaN)).toBe('nan');
    expect(formatProbeNumber(Number.POSITIVE_INFINITY)).toBe('nan');
  });
});

describe('snapshotToAttributes', () => {
  it('emits exactly the attribute names docs/stories/README.md fixes', () => {
    /* Restated here on purpose: this list is the contract other agents write
       their scenarios against, so a rename must break a test and not a story. */
    expect(Object.keys(snapshotToAttributes({})).sort()).toEqual(
      [
        'data-camera-x',
        'data-facing',
        'data-grounded',
        'data-level',
        'data-mode',
        'data-motion',
        'data-parallax-easing',
        'data-particles',
        'data-paused',
        'data-player-x',
        'data-player-y',
        'data-renderer',
        'data-speed',
        'data-tier',
      ].sort(),
    );
  });

  it('says "unknown" for what it does not know, never a plausible zero', () => {
    const attributes = snapshotToAttributes({});

    expect(attributes['data-player-x']).toBe('unknown');
    expect(attributes['data-speed']).toBe('unknown');
    expect(attributes['data-grounded']).toBe('unknown');
  });

  it('spells parallax easing on/off, as the stories assert it', () => {
    expect(snapshotToAttributes({ parallaxEasing: true })['data-parallax-easing']).toBe('on');
    expect(snapshotToAttributes({ parallaxEasing: false })['data-parallax-easing']).toBe('off');
  });
});

describe('profileToSnapshot', () => {
  it('is how TN-LEVEL-09 sees reduced motion: one mechanism, not two', () => {
    const profile = resolveRenderProfile({
      tier: 'high',
      motion: 'reduced',
      formFactor: 'phone',
      presets: PRESETS,
      filtersAvailable: true,
    });

    expect(snapshotToAttributes(profileToSnapshot(profile))).toMatchObject({
      'data-parallax-easing': 'off',
      'data-particles': '0',
      'data-tier': 'high',
      'data-motion': 'reduced',
    });
  });
});

describe('createSceneProbe', () => {
  it('writes the snapshot onto the element', () => {
    const element = fakeElement();
    const probe = createSceneProbe({ element, now: fakeClock().now });

    probe.publish({ level: 'ottawa', mode: 'skate', paused: false, playerX: 320 });

    expect(element.attributes['data-level']).toBe('ottawa');
    expect(element.attributes['data-mode']).toBe('skate');
    expect(element.attributes['data-player-x']).toBe('320');
  });

  it('throttles the numbers to ten writes a second', () => {
    const element = fakeElement();
    const clock = fakeClock();
    const probe = createSceneProbe({ element, now: clock.now });

    probe.publish({ playerX: 1 });
    const afterFirst = element.writes();

    for (let step = 0; step < 5; step += 1) {
      clock.advance(SNAPSHOT_THROTTLE_MS / 10);
      probe.publish({ playerX: 2 + step });
    }
    expect(element.writes(), 'the throttle let a burst of numbers through').toBe(afterFirst);

    clock.advance(SNAPSHOT_THROTTLE_MS);
    probe.publish({ playerX: 9 });
    expect(element.attributes['data-player-x']).toBe('9');
  });

  it('publishes a discrete change at once, because "as soon as I close Settings" means at once', () => {
    const element = fakeElement();
    const clock = fakeClock();
    const probe = createSceneProbe({ element, now: clock.now });

    probe.publish({ paused: false, particles: 400 });
    clock.advance(1);
    probe.publish({ particles: 0 });

    expect(element.attributes['data-particles']).toBe('0');
  });

  it('keeps the last published value for a field a later patch does not mention', () => {
    const element = fakeElement();
    const probe = createSceneProbe({ element, now: fakeClock().now });

    probe.publish({ level: 'ottawa', mode: 'skate' });
    probe.publish({ paused: true });

    expect(probe.snapshot.level).toBe('ottawa');
    expect(element.attributes['data-mode']).toBe('skate');
  });

  it('records every frame, unthrottled, because a poll cannot see a frame', () => {
    const element = fakeElement();
    const probe = createSceneProbe({ element, now: fakeClock().now });

    for (let frame = 0; frame < 6; frame += 1) {
      probe.recordFrame({
        t: frame * 16.7,
        dtSeconds: 1 / 60,
        x: frame,
        y: 0,
        velocityX: frame,
        speed: frame,
        grounded: true,
        facing: 'right',
        intentMove: 1,
        cameraX: frame,
      });
    }

    const frames = probe.frames();
    expect(frames).toHaveLength(6);
    expect(frames.map((entry) => entry.frame)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(element.writes(), 'recording a frame must not touch the DOM').toBe(0);
  });

  it('bounds the buffer, so a long session cannot grow without limit', () => {
    const element = fakeElement();
    const probe = createSceneProbe({ element, now: fakeClock().now, traceFrames: 4 });

    for (let frame = 0; frame < 10; frame += 1) {
      probe.recordFrame({
        dtSeconds: 1 / 60,
        x: frame,
        y: 0,
        velocityX: 0,
        speed: 0,
        grounded: true,
        facing: 'right',
        intentMove: 0,
        cameraX: 0,
      });
    }

    const frames = probe.frames();
    expect(frames).toHaveLength(4);
    expect(frames[0]?.frame, 'the oldest frames are dropped, not the newest').toBe(6);
    expect(DEFAULT_TRACE_FRAMES / 60).toBeGreaterThanOrEqual(10);
  });

  it('bounds the event buffer too, oldest first', () => {
    const probe = createSceneProbe({
      element: fakeElement(),
      now: fakeClock().now,
      traceEvents: 2,
    });

    probe.recordEvent('player/moved');
    probe.recordEvent('player/jumped');
    probe.recordEvent('player/braked');

    expect(probe.events().map((entry) => entry.name)).toEqual([
      'player/jumped',
      'player/braked',
    ]);
  });

  it('ties an event to the frame it happened on', () => {
    const element = fakeElement();
    const clock = fakeClock();
    const probe = createSceneProbe({ element, now: clock.now });

    probe.recordFrame({
      dtSeconds: 1 / 60,
      x: 0,
      y: 0,
      velocityX: 0,
      speed: 0,
      grounded: true,
      facing: 'right',
      intentMove: 1,
      cameraX: 0,
    });
    clock.advance(16.7);
    probe.recordEvent('player/braked');

    expect(probe.events()).toEqual([{ name: 'player/braked', t: 16.7, frame: 1 }]);
  });

  it('clears both buffers, so a scenario measures its own interaction', () => {
    const element = fakeElement();
    const probe = createSceneProbe({ element, now: fakeClock().now });
    probe.recordEvent('player/moved');
    probe.recordFrame({
      dtSeconds: 1 / 60,
      x: 0,
      y: 0,
      velocityX: 0,
      speed: 0,
      grounded: true,
      facing: 'right',
      intentMove: 0,
      cameraX: 0,
    });

    probe.clearTrace();

    expect(probe.frames()).toEqual([]);
    expect(probe.events()).toEqual([]);
  });

  it('goes silent and removes its element on destroy', () => {
    const element = fakeElement();
    const probe = createSceneProbe({ element, now: fakeClock().now });
    probe.destroy();
    probe.destroy();

    const before = element.writes();
    probe.publish({ level: 'ottawa' });
    probe.recordFrame({
      dtSeconds: 1 / 60,
      x: 1,
      y: 0,
      velocityX: 0,
      speed: 0,
      grounded: true,
      facing: 'right',
      intentMove: 0,
      cameraX: 0,
    });

    probe.recordEvent('player/moved');

    expect(element.removed()).toBe(true);
    expect(element.writes()).toBe(before);
    expect(probe.frames()).toEqual([]);
    expect(probe.events()).toEqual([]);
  });
});

describe('sceneProbeHandle', () => {
  it('is read-only: a scenario may look at the game, never steer it', () => {
    const probe = createSceneProbe({ element: fakeElement(), now: fakeClock().now });
    const handle = sceneProbeHandle(probe);

    expect(Object.keys(handle).sort()).toEqual(['clearTrace', 'events', 'frames', 'snapshot']);
    expect(
      Object.keys(handle).some((key) => key.startsWith('set') || key.startsWith('force')),
      'the handle exposes a way to change the game, so a scenario could prove locomotion ' +
        'works by making it work',
    ).toBe(false);
  });

  it('reads through to the live probe', () => {
    const probe = createSceneProbe({ element: fakeElement(), now: fakeClock().now });
    const handle = sceneProbeHandle(probe);

    probe.publish({ mode: 'skate' });
    probe.recordEvent('player/moved');
    probe.recordFrame({
      dtSeconds: 1 / 60,
      x: 12,
      y: 0,
      velocityX: 4,
      speed: 4,
      grounded: true,
      facing: 'right',
      intentMove: 1,
      cameraX: 12,
    });

    expect(handle.snapshot().mode).toBe('skate');
    expect(handle.events()).toHaveLength(1);
    expect(handle.frames()).toHaveLength(1);
    expect(handle.frames()[0]?.x).toBe(12);

    handle.clearTrace();
    expect(probe.events()).toEqual([]);
    expect(handle.frames()).toEqual([]);
  });
});

/**
 * The assertions `TN-LEVEL-03` is written in, rehearsed against a synthetic
 * skate so the *shape* of the trace is proven adequate before task 1.14 relies
 * on it.
 *
 * This does not test locomotion — there is none yet — and it must not be read as
 * doing so. It tests that each scenario in the story is expressible as a
 * computation over `frames()`, which is the question the coordinator asked and
 * the one a poll-only probe answers "no" to.
 */
describe('the trace can express TN-LEVEL-03', () => {
  const MAX_SPEED = 600;

  /** A right-then-left skate: accelerate, release and glide, then reverse. */
  const skate = (): readonly FrameTraceEntry[] => {
    const frames: FrameTraceEntry[] = [];
    let velocityX = 0;
    let x = 0;

    const step = (intentMove: number, count: number, accel: number): void => {
      for (let index = 0; index < count; index += 1) {
        velocityX = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, velocityX + accel));
        x += velocityX / 60;
        frames.push({
          frame: frames.length,
          t: frames.length * (1000 / 60),
          dtSeconds: 1 / 60,
          x,
          y: 0,
          velocityX,
          speed: Math.abs(velocityX),
          grounded: true,
          facing: velocityX < 0 ? 'left' : 'right',
          intentMove,
          cameraX: x,
        });
      }
    };

    step(1, 60, 12); /* one second of holding right */
    step(0, 60, -2); /* one second of gliding */
    step(-1, 90, -8); /* reversing: through zero and away to the left */
    return frames;
  };

  const frames = skate();
  const at = (ms: number): FrameTraceEntry | undefined =>
    frames.find((frame) => frame.t >= ms);

  it('"at least 70 percent of maxSpeed after 1 second"', () => {
    expect(at(1_000)?.speed ?? 0).toBeGreaterThanOrEqual(MAX_SPEED * 0.7);
  });

  it('"still at least half of maxSpeed one second later" after release', () => {
    const released = frames.find((frame) => frame.intentMove === 0);
    expect(released).toBeDefined();
    const later = frames.find((frame) => frame.t >= (released?.t ?? 0) + 950);
    expect(later?.speed ?? 0).toBeGreaterThanOrEqual(MAX_SPEED * 0.5);
  });

  it('"speed never increases while I am not holding anything"', () => {
    const coasting = frames.filter((frame) => frame.intentMove === 0);
    for (let index = 1; index < coasting.length; index += 1) {
      expect(coasting[index]?.speed ?? 0).toBeLessThanOrEqual(coasting[index - 1]?.speed ?? 0);
    }
    expect(coasting.length, 'the premise: there was a coast to check').toBeGreaterThan(10);
  });

  it('"speed passes through 0 before the player moves left"', () => {
    const firstLeft = frames.findIndex((frame) => frame.velocityX < 0);
    expect(firstLeft).toBeGreaterThan(0);

    const beforeLeft = frames.slice(0, firstLeft);
    expect(
      beforeLeft.some((frame) => frame.speed === 0 || frame.speed < MAX_SPEED * 0.02),
      'the skater reversed without passing through a stop',
    ).toBe(true);
  });

  it('"facing changes to left only once the player is actually moving left"', () => {
    for (const frame of frames) {
      if (frame.facing === 'left') expect(frame.velocityX).toBeLessThan(0);
    }
  });

  it('"speed never falls from above half of maxSpeed to 0 inside a single frame"', () => {
    /* The assertion a 10 Hz poll cannot make: it needs consecutive frames. */
    for (let index = 1; index < frames.length; index += 1) {
      const previous = frames[index - 1];
      const current = frames[index];
      if ((previous?.speed ?? 0) > MAX_SPEED * 0.5) {
        expect(current?.speed ?? 0).toBeGreaterThan(0);
      }
    }
    expect(
      frames.every((frame, index) => index === 0 || frame.frame === (frames[index - 1]?.frame ?? -1) + 1),
      'the frames are not consecutive, so "inside a single frame" is unanswerable',
    ).toBe(true);
  });

  it('"the skater travels at least five times as far as the walker" is a distance over the trace', () => {
    const distance = (trace: readonly FrameTraceEntry[]): number =>
      Math.abs((trace.at(-1)?.x ?? 0) - (trace[0]?.x ?? 0));

    const glide = frames.filter((frame) => frame.intentMove === 0);
    expect(distance(glide)).toBeGreaterThan(0);
  });
});
