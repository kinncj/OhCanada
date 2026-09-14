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

import { TIER_ORDER } from './visual-tier';
import type { MotionLevel, RenderProfile, VisualTier } from './visual-tier';

/** The query flag, and the only value that turns the probe on. */
export const SCENE_PROBE_PARAM = 'e2e';

/** The tier override's query parameter. Read only behind `SCENE_PROBE_PARAM`. */
export const TIER_OVERRIDE_PARAM = 'tier';
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
  /**
   * The mode the **character rig** was actually built for, read back from the
   * puppet rather than from the level document.
   *
   * The two exist to be compared. `mode` is what the level declares and what the
   * HUD names; this is what the thing on screen is being drawn as, and for eight
   * levels they disagreed — the strip said Skating, Sledding, Biking, and the
   * rig was never told any of it, so every level animated the same cycle. One
   * number could not have shown that, because the defect *is* the gap between
   * two of them.
   */
  readonly characterMode?: string;
  /**
   * The rig state the player is playing right now — `<mode>/walk` for a mode
   * with its own cycle, a bare state for one drawn by the rig's base cycle.
   *
   * What makes "the rig is asked for this level's mode" observable at all. The
   * mode reaches no port method (it is not a bool, a number or a trigger), so
   * without this the only assertion available was "something was called", which
   * is the shape of test this defect lived behind.
   */
  readonly pose?: string;
  /**
   * Modes this level declares that the rig cannot draw. 0 on a healthy level.
   *
   * The honest half of the fallback: a mode whose art has not landed still
   * draws — a level nobody can play is worse than one posed plainly — but it is
   * **counted**, and every gap printed a sentence naming the mode as it was
   * found (`locomotion-pose.ts`). A fallback nothing can observe is how a
   * walking figure ships under a HUD that says Skating.
   */
  readonly modeGaps?: number;
  readonly paused?: boolean;
  readonly playerX?: number;
  readonly playerY?: number;
  /** Unsigned, as the stories compare it to 0 and to `maxSpeed`. */
  readonly speed?: number;
  readonly facing?: 'left' | 'right';
  readonly grounded?: boolean;
  readonly cameraX?: number;
  readonly parallaxEasing?: boolean;
  /**
   * Particles the level is **emitting** — the snow actually falling. Written by
   * the level scene only, so it reads `unknown` until a level exists, and `0`
   * once a level whose document declares `weather: "none"` is open.
   *
   * This is the number the particle budget is about (CLAUDE.md: <= 400 phone,
   * <= 1500 iPad/desktop) and the one the stories mean by "`data-particles` is
   * 0" under reduced motion.
   */
  readonly particles?: number;
  /**
   * Particles the visual tier **allows**: the preset clamped to the device's
   * ceiling and zeroed under reduced motion. Written by the renderer only.
   *
   * Its own field because it used to be written into `particles`, so the element
   * showed whichever writer ran last — it read 0 at a tier allowing 150, and
   * nothing could tell whether the budget held. The allowance is clamped by
   * construction, so it proves nothing about the budget on its own; beside the
   * emitted count it shows how much of it a level spends.
   */
  readonly particleAllowance?: number;
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
  /**
   * Whether the mode the player is moving by has a ride — the vehicle or animal
   * a level draws around the player (ADR-0031) — and whether its art drew.
   *
   * The same pair as `layers` and `layersTextured`, for the same reason and after
   * the same defect: a player reported that the character "walks by itself on a
   * track" on a level whose HUD said Train. A ride whose art never packed would
   * put that figure back, seated in mid-air this time, and reach `ready` exactly
   * like one that drew. `0/0` is a level whose mode needs no ride; `1/1` is a
   * train on the Prairies; `1/0` is the failure, and a test can fail on it.
   */
  readonly rides?: number;
  readonly ridesDrawn?: number;
  /**
   * Points of interest and characters the level places, and how many of them
   * drew real art rather than a placeholder shape.
   *
   * The same distinction `layersTextured` draws, for the two things a player
   * actually looks at. Every character in the game was a rounded rectangle in
   * production — the red serge, the reference-critical uniform that was the
   * reason Ottawa is the first level, was never on screen — and no gate could
   * see it, because a scene that draws a rectangle reaches `ready` exactly like
   * one that draws a Mountie.
   */
  readonly actors?: number;
  readonly actorsDrawn?: number;
  /**
   * How many of those are **inside the camera's view right now**.
   *
   * The counters above answer "was it given a texture"; these answer "is it on
   * the screen". Both were needed because the first pair read full marks on a
   * build showing a gradient, an ice band, snow and one rounded rectangle — the
   * officer and the landmark were drawn correctly, a long way off to the right.
   *
   * They change as the camera moves, which is what lets a test see the same
   * counter say `0` and then `1` in one run rather than trusting a number that
   * is the same whether or not anything worked.
   */
  readonly layersVisible?: number;
  readonly actorsVisible?: number;
  /**
   * Did the **player** compose from the rig, or is a rounded rectangle standing
   * at the spawn?
   *
   * Separate from `actorsDrawn` because the player is not an actor by that
   * counter's definition: `actors` is `pois.length + characters.length` and the
   * player is in neither list. So the one character on screen at the spawn was
   * outside every count that existed, and "the character is still a rectangle"
   * was true for as long as anyone looked while `data-actors-drawn` read full
   * marks. A counter that cannot see the subject of the complaint is not a
   * counter.
   */
  readonly playerDrawn?: boolean;
  /**
   * How many characters — the player included — fell back to a placeholder.
   *
   * The complement of the two `*Drawn` counters, and it exists so that a healthy
   * level has a number that reads **0** rather than a number that has to be
   * compared to another number. Every increment printed a reason to the console
   * as it happened (`character-cast.ts`).
   */
  readonly placeholders?: number;
  /**
   * How many things are marked as tappable right now, and how many of those are
   * in reach.
   *
   * `affordances` is what a player can see is interactive; `affordancesReady` is
   * what a tap would actually engage. They are published as two numbers because
   * they answer two different complaints — "nothing tells me what to click" and
   * "I do not know when I am close enough" — and one number could clear both
   * while answering neither.
   */
  readonly affordances?: number;
  readonly affordancesReady?: number;
  /**
   * What ADR-0003's claim filter did to this level, as three numbers.
   *
   * The same reason `layersTextured` sits beside `layers`. A landmark whose
   * blurb a verifier declined is still painted — the level's picture is composed
   * around it — and is not engageable, so from outside, a level with a refused
   * claim and a level with none look identical: same art, one fewer thing to
   * tap, nothing said about why.
   *
   * `claimsExamined` is the one that matters most and is the least interesting
   * to read. A filter that stopped matching the blocks it reads publishes
   * `examined: 0, refused: 0`; a level in good order publishes `examined: 4,
   * refused: 0`. Those were the same observation before these existed, which is
   * the whole defect (ADR-0024): the old code "filtered nothing" perfectly.
   */
  readonly claimsExamined?: number;
  readonly claimsDrawable?: number;
  readonly claimsRefused?: number;
  /**
   * What ADR-0003's filter did to the words a character says, as five numbers.
   *
   * The claim trio above covers a level's own prose — a landmark blurb, a
   * territorial statement. It says nothing about **dialogue**, which is the
   * other half of the prose this game puts in front of a player and the half
   * that had no filter at all: five lines a verifier had declined were spoken by
   * named characters while `verify-content` counted them as excluded from the
   * build (`app/bootstrap/verified-dialogue.ts`).
   *
   * Build-wide, not per-level: the quest documents are read once at boot and the
   * numbers do not change between levels. Published by the composition root
   * rather than by a scene, because a scene has never heard of a quest and must
   * not start.
   *
   * Two layers, because the refusal and the verdict happen at different ones. A
   * line is refused; the **block** it sits in is silenced, all of it, because the
   * granted lines beside a refused one are its run-up and saying them alone
   * leaves the speaker mid-thought. So `dialogueRefused` and `dialogueSilenced`
   * are different numbers and a scenario that reads only one of them cannot tell
   * "one line went" from "one conversation went".
   *
   * `dialogueExamined` is the one that reads as noise and is the reason the set
   * exists. A filter that stopped matching the blocks it reads publishes
   * `examined: 0, refused: 0`; a build whose lines are all granted publishes
   * `examined: 92, refused: 0`. Those two were the same observation before these
   * attributes existed (ADR-0024).
   */
  readonly dialogueExamined?: number;
  readonly dialogueDrawable?: number;
  readonly dialogueRefused?: number;
  /** Blocks of dialogue read. One block is one thing a speaker says at one moment. */
  readonly dialogueBlocks?: number;
  /** Of those, the ones left unsaid because a line in them was refused. */
  readonly dialogueSilenced?: number;
  /**
   * Of `dialogueExamined`, the quest's moment lines — what a giver says after
   * "Not now", on a return mid-quest, after the quest is complete, and on the
   * completion card. Each is also one block.
   *
   * Its own number because the census once covered steps only: 40 authored,
   * verified lines were read by nothing, so `dialogueExamined` said 92 while the
   * content held 132. A scenario that can read this can tell "the moment lines
   * were examined and granted" from "the moment lines were never read".
   */
  readonly dialogueMoments?: number;
  /**
   * Where the level's sky is in the day, 0 at local midnight and 0.5 at noon.
   *
   * Published so that "the game follows the real world" is observable rather
   * than a screenshot somebody took at the right hour: a test can set the
   * device clock and read this back.
   */
  readonly dayPhase?: number;
  readonly tier?: VisualTier;
  /**
   * True when `?e2e=1&tier=` pinned `tier` instead of the tracker measuring it.
   * A perf verdict taken at a pinned tier says so; one taken at a measured tier
   * says that instead.
   */
  readonly tierPinned?: boolean;
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
 * The visual tier a test asked to pin, or `null`.
 *
 * `?e2e=1&tier=high` pins `high`. Without `?e2e=1` — exactly
 * `isSceneProbeEnabled`, the gate that decides whether the probe exists at all —
 * the parameter is never read, so a player who pastes `?tier=high` gets the
 * tier their device measures and nothing else. Only a tier the presets name
 * pins anything; anything else is ignored rather than guessed at.
 *
 * It is the one input this probe has that changes what is drawn, and ADR-0011
 * ratified the probe on the condition that the flag opens "nothing but
 * observation". The override keeps that true for players, because the flag
 * never reaches them; it does not keep it true for tests, and does not pretend
 * to: a test that pins a tier is measuring a tier it chose, and the probe
 * publishes `data-tier-pinned` so the measurement says so.
 */
export function tierOverrideFrom(search: string | null | undefined): VisualTier | null {
  if (!isSceneProbeEnabled(search)) return null;
  const requested = new URLSearchParams(search ?? '').get(TIER_OVERRIDE_PARAM);
  return TIER_ORDER.find((tier) => tier === requested) ?? null;
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
  'characterMode',
  'pose',
  'modeGaps',
  'paused',
  'facing',
  'grounded',
  'parallaxEasing',
  'particles',
  'particleAllowance',
  'layers',
  'layersTextured',
  'rides',
  'ridesDrawn',
  'actors',
  'actorsDrawn',
  'layersVisible',
  'actorsVisible',
  'playerDrawn',
  'placeholders',
  'affordances',
  'affordancesReady',
  'claimsExamined',
  'claimsDrawable',
  'claimsRefused',
  'dialogueExamined',
  'dialogueDrawable',
  'dialogueRefused',
  'dialogueBlocks',
  'dialogueSilenced',
  'dialogueMoments',
  'tier',
  'tierPinned',
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
    /* What the level declares, and what the character is actually drawn as.
       Two attributes because the defect they exist for is the two disagreeing,
       and a scenario that can only read one of them cannot see it. */
    'data-character-mode': text(snapshot.characterMode),
    'data-pose': text(snapshot.pose),
    'data-mode-gaps': num(snapshot.modeGaps),
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
    /* Emitted, and allowed: two writers, so two attributes. */
    'data-particles': num(snapshot.particles),
    'data-particle-allowance': num(snapshot.particleAllowance),
    'data-layers': num(snapshot.layers),
    'data-layers-textured': num(snapshot.layersTextured),
    /* A ride and its art, in the same shape as the layer pair above: equal on a
       healthy level, and 0/0 on a level whose mode needs none (ADR-0031). */
    'data-rides': num(snapshot.rides),
    'data-rides-drawn': num(snapshot.ridesDrawn),
    'data-actors': num(snapshot.actors),
    'data-actors-drawn': num(snapshot.actorsDrawn),
    'data-layers-visible': num(snapshot.layersVisible),
    'data-actors-visible': num(snapshot.actorsVisible),
    'data-player-drawn': bool(snapshot.playerDrawn),
    'data-placeholders': num(snapshot.placeholders),
    'data-affordances': num(snapshot.affordances),
    'data-affordances-ready': num(snapshot.affordancesReady),
    'data-claims-examined': num(snapshot.claimsExamined),
    'data-claims-drawable': num(snapshot.claimsDrawable),
    'data-claims-refused': num(snapshot.claimsRefused),
    /* The same distinction for the words a character says out loud. A line is
       refused; the block it sits in is silenced whole, so these are two numbers
       and not one. */
    'data-dialogue-examined': num(snapshot.dialogueExamined),
    'data-dialogue-drawable': num(snapshot.dialogueDrawable),
    'data-dialogue-refused': num(snapshot.dialogueRefused),
    'data-dialogue-blocks': num(snapshot.dialogueBlocks),
    'data-dialogue-silenced': num(snapshot.dialogueSilenced),
    'data-dialogue-moments': num(snapshot.dialogueMoments),
    'data-day-phase': num(snapshot.dayPhase),
    'data-tier': text(snapshot.tier),
    'data-tier-pinned': bool(snapshot.tierPinned),
    'data-motion': text(snapshot.motion),
    'data-renderer': text(snapshot.renderer),
  };
}

/**
 * The fields of a `RenderProfile` the probe reports. One mechanism, not two.
 *
 * The particle number goes out as the **allowance**, never as `particles`: that
 * field is the level scene's emitted count, and writing both into one field is
 * the defect that made the particle budget unmeasurable.
 */
export function profileToSnapshot(profile: RenderProfile): SceneSnapshot {
  return {
    parallaxEasing: profile.parallaxEasing,
    particleAllowance: profile.particles,
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
