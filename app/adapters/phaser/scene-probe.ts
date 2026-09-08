/**
 * The scene probe: how a Playwright scenario about camera or momentum is allowed
 * to fail.
 *
 * The canvas is `aria-hidden` by contract and Playwright cannot read a pixel out
 * of it (the WebGL context has no `preserveDrawingBuffer`, so even a canvas
 * read-back is transparent black). Without a seam, every scenario in
 * `docs/stories/TN-LEVEL-ottawa.md` about where the skater is and how fast they
 * are going is either deleted or written so loosely it cannot fail — which is
 * the same defect slice 0 spent a session removing, written in Gherkin.
 *
 * So the game exposes exactly one element, `data-testid="scene-state"`, and it
 * exists **only** when the page was opened with `?e2e=1`.
 *
 * ## Why a snapshot is not enough, and what is here instead
 *
 * `docs/stories/README.md` specifies the element refreshed "at most ten times a
 * second". That is right for the assertions phrased as *states* — "`data-mode`
 * is skate", "`data-particles` is 0", "`data-speed` is at least 70% of maxSpeed
 * after one second". It cannot support the assertions in `TN-LEVEL-03` phrased
 * as *invariants over frames*:
 *
 *   - "`data-speed` never falls from above half of maxSpeed to 0 inside a single
 *     frame" — a 100 ms poll sees one sample in every six frames, so it can
 *     never observe a single frame at all;
 *   - "`data-speed` passes through 0 before the player moves left" — a zero
 *     crossing lasts one or two frames, and a 100 ms poll misses it roughly
 *     five times in six;
 *   - "`data-speed` never increases while I am not holding anything" — a spike
 *     between two polls is invisible.
 *
 * A poll-only probe would make those three scenarios flaky rather than false,
 * which is worse than deleting them: a test that fails one run in six teaches
 * people to re-run it. So this probe has two outputs, and the split is the whole
 * design:
 *
 *   1. **The element** — the 10 Hz snapshot the stories name, for state
 *      assertions. Attribute names exactly as `docs/stories/README.md` fixes
 *      them.
 *   2. **A per-frame ring buffer** — every frame, unsampled, read back in one
 *      `page.evaluate` at the end of an interaction. Invariants are then checked
 *      over *every* frame the browser drew, not over the ones a poll happened to
 *      catch. This is what makes "inside a single frame" a real assertion.
 *
 * The buffer also carries the input the frame was given and the events the frame
 * emitted, because "never increases while I am not holding anything" and "the
 * event `player/braked` is emitted" are statements about the relationship
 * between input, output and time — none of which survive being sampled.
 *
 * ## Cost when it is off
 *
 * One `URLSearchParams` read at boot, and nothing else: no element is created,
 * no global is installed, and `recordFrame` is never subscribed, so a normal
 * production load does zero work per frame. `probe-is-inert-without-the-flag`
 * in `tests/e2e/scene-probe.spec.ts` asserts that against the production build.
 *
 * The honest trade to record in the ADR: the code *ships* in the production
 * bundle rather than being stripped by the bundler, because `tests/e2e` runs
 * against the production artefact served by `vite preview` — a probe compiled
 * out of the artefact under test could only be proven to work in a build nobody
 * deploys. It is inert, it is ~2 kB, and it is gated on an explicit query flag.
 *
 * Pure and structural: the element arrives as an interface with two methods and
 * the clock arrives as a function, so every rule below is unit tested with no
 * browser. `game-renderer.ts` supplies the real `<div>`, `performance.now` and
 * `window.location.search`.
 */

import type { MotionLevel, RenderProfile, VisualTier } from './visual-tier';

/** The query flag, and the only value that turns the probe on. */
export const SCENE_PROBE_PARAM = 'e2e';
export const SCENE_PROBE_TEST_ID = 'scene-state';

/**
 * At most ten writes a second for the numbers (`docs/stories/README.md`).
 *
 * The discrete fields ignore this — see `publish`. A settings change that has to
 * read as "at once" (TN-SET-01: "`data-particles` equal to 0 as soon as I close
 * Settings") cannot be made to wait 100 ms for a throttle.
 */
export const SNAPSHOT_THROTTLE_MS = 100;

/**
 * Frames kept in the trace. 900 is fifteen seconds at 60 fps, which covers the
 * longest interaction any scenario describes ("hold for three seconds and
 * release", "keeps moving for at least two seconds") with room for a slow
 * device that is still drawing 900 frames, just over a longer wall clock.
 */
export const DEFAULT_TRACE_FRAMES = 900;

/** Events kept alongside the frames, so "was `player/braked` emitted" is answerable. */
export const DEFAULT_TRACE_EVENTS = 200;

/**
 * The state the element carries. One field per attribute in
 * `docs/stories/README.md`, plus the three the renderer probe already knows —
 * one mechanism, not two, so a scenario never has to ask two different elements
 * what the game is doing.
 *
 * Every field is optional because the probe outlives the thing it describes: at
 * boot there is no level and no player, and an attribute that reads `"unknown"`
 * is honest where one that reads `"0"` is a fabricated measurement.
 */
export interface SceneSnapshot {
  readonly level?: string;
  readonly mode?: string;
  readonly paused?: boolean;
  readonly playerX?: number;
  readonly playerY?: number;
  /** Unsigned, as the stories compare it to 0 and to `maxSpeed`. */
  readonly speed?: number;
  readonly facing?: 'left' | 'right';
  readonly grounded?: boolean;
  readonly cameraX?: number;
  readonly parallaxEasing?: boolean;
  readonly particles?: number;
  /**
   * Parallax layers the level authored, and how many of them drew from a real
   * texture rather than from the placeholder band.
   *
   * These exist because the shipped Ottawa level **never drew its art and
   * nothing noticed**. `level-scene.ts` falls back to a flat theme-coloured band
   * when `textures.exists(key)` is false, which is the right behaviour while the
   * atlas is in flight and is indistinguishable from success at the level of
   * "the scene reached ready" — so forty e2e tests passed over a level with no
   * art in it, in production, and the network log was the only evidence.
   *
   * A fallback that nothing can observe is a fallback that becomes permanent.
   * `layersTextured < layers` is now a fact a test can fail on.
   */
  readonly layers?: number;
  readonly layersTextured?: number;
  readonly tier?: VisualTier;
  readonly motion?: MotionLevel;
  readonly renderer?: string;
}

/**
 * One frame, recorded unsampled.
 *
 * `velocityX` is signed and `speed` is not: "passes through 0 before the player
 * moves left" is a statement about the sign, and "at least 70% of maxSpeed" is a
 * statement about the magnitude. Deriving one from the other in the test would
 * put arithmetic in the assertion; carrying both puts it here, once.
 */
export interface FrameTraceEntry {
  /** Frame index since the probe started. Consecutive indices are consecutive frames. */
  readonly frame: number;
  /** `performance.now()` at the start of the frame. */
  readonly t: number;
  /**
   * The simulated time this frame advanced, in seconds — the `dt` the locomotion
   * strategy was actually given, after the clamp.
   *
   * Wall time and game time are the same thing until the machine cannot keep up,
   * and then they are not: `locomotion.ts` bounds a step at `MAX_STEP_SECONDS`
   * so that one slow frame cannot brake a skater from cruise to zero, which
   * means a device below 30 fps runs the world slightly slow. TN-LEVEL-03's
   * "at least 70 percent of maxSpeed after 1 second" is a statement about the
   * physics, so the scenario integrates this rather than reading `t` — otherwise
   * a busy CI box makes a claim about the tuning fail for a reason that has
   * nothing to do with the tuning. Whether the machine keeps up at all is the
   * perf suite's question and it has its own budget.
   */
  readonly dtSeconds: number;
  readonly x: number;
  readonly y: number;
  readonly velocityX: number;
  readonly speed: number;
  readonly grounded: boolean;
  readonly facing: 'left' | 'right';
  /** The movement intent this frame was given, -1..1. Zero means "not holding anything". */
  readonly intentMove: number;
  readonly cameraX: number;
}

export interface EventTraceEntry {
  readonly name: string;
  readonly t: number;
  /** The frame index this event belongs to, so an event can be tied to a sample. */
  readonly frame: number;
  /**
   * What the event was about, when the name alone does not say.
   *
   * `TN-LEVEL-05` is written as 'the event "poi/entered" is emitted for
   * "npc.officer"', and a bare name cannot answer the second half — with two
   * things in reach on the same canal, "a poi/entered happened" is not the
   * assertion the story makes. Present only when there is a subject, so an event
   * that has none carries no empty string pretending to be one.
   */
  readonly detail?: string;
}

/** The slice of an element the probe writes. Structural, so tests need no DOM. */
export interface ProbeElement {
  setAttribute(name: string, value: string): void;
  remove(): void;
}

/**
 * Is the probe on?
 *
 * `?e2e=1` and nothing else. Not "the parameter is present", because `?e2e=0`
 * reading as on is the kind of surprise that puts a debug surface in front of a
 * player who pasted a URL.
 */
export function isSceneProbeEnabled(search: string | null | undefined): boolean {
  if (typeof search !== 'string' || search.length === 0) return false;
  /* No try/catch: `URLSearchParams` does not throw on a malformed query string,
     it parses what it can. A guard here would be an unreachable branch, which is
     a branch no test can ever justify. */
  return new URLSearchParams(search).get(SCENE_PROBE_PARAM) === '1';
}

/**
 * Numbers as attribute text: at most two decimals, trailing zeros trimmed.
 *
 * So a spawn x of 320 reads `"320"` and a speed of 412.5 reads `"412.5"`. The
 * stories compare `data-player-x` to a value in the level file, and `"320.00"`
 * would force every scenario to parse before it could compare.
 */
export function formatProbeNumber(value: number): string {
  if (!Number.isFinite(value)) return 'nan';
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

/** Fields whose change is published immediately rather than at the next tick. */
const DISCRETE_FIELDS: readonly (keyof SceneSnapshot)[] = [
  'level',
  'mode',
  'paused',
  'facing',
  'grounded',
  'parallaxEasing',
  'particles',
  'layers',
  'layersTextured',
  'tier',
  'motion',
  'renderer',
];

/**
 * The snapshot as the attribute set the stories name. Exported so a test can
 * assert the attribute *names*, which are the part of this contract other agents
 * write against.
 */
export function snapshotToAttributes(snapshot: SceneSnapshot): Readonly<Record<string, string>> {
  const text = (value: string | undefined): string => value ?? 'unknown';
  const bool = (value: boolean | undefined): string =>
    value === undefined ? 'unknown' : String(value);
  const num = (value: number | undefined): string =>
    value === undefined ? 'unknown' : formatProbeNumber(value);

  return {
    'data-level': text(snapshot.level),
    'data-mode': text(snapshot.mode),
    'data-paused': bool(snapshot.paused),
    'data-player-x': num(snapshot.playerX),
    'data-player-y': num(snapshot.playerY),
    'data-speed': num(snapshot.speed),
    'data-facing': text(snapshot.facing),
    'data-grounded': bool(snapshot.grounded),
    'data-camera-x': num(snapshot.cameraX),
    /* `on`/`off` rather than `true`/`false`: fixed by docs/stories/README.md. */
    'data-parallax-easing':
      snapshot.parallaxEasing === undefined ? 'unknown' : snapshot.parallaxEasing ? 'on' : 'off',
    'data-particles': num(snapshot.particles),
    'data-layers': num(snapshot.layers),
    'data-layers-textured': num(snapshot.layersTextured),
    'data-tier': text(snapshot.tier),
    'data-motion': text(snapshot.motion),
    'data-renderer': text(snapshot.renderer),
  };
}

/** The fields of a `RenderProfile` the probe reports. One mechanism, not two. */
export function profileToSnapshot(profile: RenderProfile): SceneSnapshot {
  return {
    parallaxEasing: profile.parallaxEasing,
    particles: profile.particles,
    tier: profile.tier,
    motion: profile.motion,
  };
}

export interface SceneProbeOptions {
  readonly element: ProbeElement;
  /** Usually `() => performance.now()`. */
  readonly now: () => number;
  readonly throttleMs?: number;
  readonly traceFrames?: number;
  readonly traceEvents?: number;
}

export interface SceneProbe {
  readonly snapshot: SceneSnapshot;
  /** Merge fields into the snapshot and write the element, subject to the throttle. */
  publish(patch: SceneSnapshot): void;
  /** Record one frame. Called every frame; never throttled. */
  recordFrame(entry: Omit<FrameTraceEntry, 'frame' | 't'> & { readonly t?: number }): void;
  /** Record one bus event, tied to the current frame. `detail` names its subject. */
  recordEvent(name: string, detail?: string): void;
  /** Every frame still in the buffer, oldest first. */
  frames(): readonly FrameTraceEntry[];
  events(): readonly EventTraceEntry[];
  /** Drop both buffers. A scenario calls this before the interaction it measures. */
  clearTrace(): void;
  /** Remove the element. Idempotent. */
  destroy(): void;
}

/**
 * Build a probe over an element and a clock.
 *
 * The throttle is deliberately one-sided: it bounds how often the *numbers* are
 * written, and never delays a change to one of `DISCRETE_FIELDS`. Ten writes a
 * second of eleven attributes is nothing next to a frame; the throttle exists so
 * that the probe cannot become the reason a frame is late, not because writing
 * is expensive.
 */
export function createSceneProbe(options: SceneProbeOptions): SceneProbe {
  const throttleMs = Math.max(0, options.throttleMs ?? SNAPSHOT_THROTTLE_MS);
  const frameCapacity = Math.max(1, Math.floor(options.traceFrames ?? DEFAULT_TRACE_FRAMES));
  const eventCapacity = Math.max(1, Math.floor(options.traceEvents ?? DEFAULT_TRACE_EVENTS));

  let snapshot: SceneSnapshot = {};
  let lastWrittenAt = Number.NEGATIVE_INFINITY;
  let frameTrace: FrameTraceEntry[] = [];
  let eventTrace: EventTraceEntry[] = [];
  let frameIndex = 0;
  let destroyed = false;

  /* No `destroyed` guard: `publish` is the only caller and it already returns. */
  const write = (at: number): void => {
    lastWrittenAt = at;
    for (const [name, value] of Object.entries(snapshotToAttributes(snapshot))) {
      options.element.setAttribute(name, value);
    }
  };

  return {
    get snapshot(): SceneSnapshot {
      return snapshot;
    },

    publish(patch: SceneSnapshot): void {
      if (destroyed) return;
      const previous = snapshot;
      snapshot = { ...snapshot, ...patch };

      const discreteChanged = DISCRETE_FIELDS.some((field) => previous[field] !== snapshot[field]);
      const at = options.now();
      if (discreteChanged || at - lastWrittenAt >= throttleMs) write(at);
    },

    recordFrame(entry): void {
      if (destroyed) return;
      const at = entry.t ?? options.now();
      frameTrace.push({ ...entry, frame: frameIndex, t: at });
      frameIndex += 1;
      if (frameTrace.length > frameCapacity) frameTrace.shift();
    },

    recordEvent(name: string, detail?: string): void {
      if (destroyed) return;
      const entry: EventTraceEntry =
        detail === undefined
          ? { name, t: options.now(), frame: frameIndex }
          : { name, t: options.now(), frame: frameIndex, detail };
      eventTrace.push(entry);
      if (eventTrace.length > eventCapacity) eventTrace.shift();
    },

    frames(): readonly FrameTraceEntry[] {
      return [...frameTrace];
    },

    events(): readonly EventTraceEntry[] {
      return [...eventTrace];
    },

    clearTrace(): void {
      frameTrace = [];
      eventTrace = [];
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      frameTrace = [];
      eventTrace = [];
      options.element.remove();
    },
  };
}

/**
 * What `page.evaluate` reaches for. Installed on `window` only when the probe is
 * on, so `typeof window.__tnScene === 'undefined'` is the assertion that a
 * normal load carries no debug surface.
 *
 * Read-only by design: a test may look at the game, never steer it. A handle
 * that could set the player's speed would let a scenario prove locomotion works
 * by making it work.
 */
export interface SceneProbeHandle {
  snapshot(): SceneSnapshot;
  frames(): readonly FrameTraceEntry[];
  events(): readonly EventTraceEntry[];
  clearTrace(): void;
}

export const SCENE_PROBE_GLOBAL = '__tnScene';

export function sceneProbeHandle(probe: SceneProbe): SceneProbeHandle {
  return {
    snapshot: () => probe.snapshot,
    frames: () => probe.frames(),
    events: () => probe.events(),
    clearTrace: () => {
      probe.clearTrace();
    },
  };
}
