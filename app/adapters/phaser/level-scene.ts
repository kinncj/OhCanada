import Phaser from 'phaser';

import type {
  CharacterRendererSpec,
  ICharacterRenderer,
  LocomotionIntent,
  LocomotionState,
  LocomotionTuning,
  RigArtboard,
  RigDocument,
  ThemeColours,
  Vec2,
} from '@application/ports';

import { blendColors, mixColor, toPhaserColor } from './boot-config';
import { backingScaleOf, fitCameraToDesign } from './design-viewport';
import { groundYAt, levelBounds, slopeAt, type LevelBounds } from './ground-profile';
import type { LoadRequest } from './level-assets';
import {
  PLACEHOLDER_BAND_HEIGHT,
  createLevelEffects,
  selectLayers,
  type LayerViewport,
  type LevelEffects,
} from './level-effects';
import type {
  SceneEventListener,
  SceneEventName,
  SceneMilestoneListener,
  SceneMilestoneName,
} from './level-events';
import {
  artboardFor,
  castGapMessage,
  drivableInputs,
  playerArtboard,
  rigAtlasKey,
  unboundAnimationInputs,
  type CastGap,
} from './character-cast';
import {
  affordanceMarks,
  markPulse,
  type AffordanceMark,
  type AffordanceSubject,
} from './interaction-affordance';
import {
  MAX_PHASE_STEP,
  PHASE_REFRESH_MS,
  dayPhase,
  easePhase,
  tintPalette,
} from './time-of-day';
import {
  createSpriteCharacterRenderer,
  type SpritePartObject,
} from './sprite-character-renderer';
import { cameraView, followCamera, intersectsView, type WorldRect } from './level-camera';
import type { SceneLevel } from './level-document';
import { MAX_STEP_SECONDS, applyBounds, createLocomotion } from './locomotion';
import {
  createTouchControls,
  hitTest,
  minTouchTargetPx,
  type TargetRect,
  type TouchControls,
  type ViewPoint,
} from './touch-controls';
import { applyEffect } from './visual-effects';
import type { PlayableMarker } from './playable-marker';
import type { SceneProbe } from './scene-probe';
import type { RenderProfile } from './visual-tier';

/**
 * LevelScene — one Phaser scene, every level.
 *
 * There is no Ottawa in this file. Everything it draws, every number it moves
 * by and every place it puts something comes out of `content/levels/<id>.json`
 * via `SceneLevel`: the parallax bands, the ground polyline, the camera framing,
 * the points of interest, the character placements and the locomotion tuning.
 * That is task 1.13's acceptance stated as a property of the source — the test
 * of this work is not "Ottawa renders" but "a second level would need no code",
 * and `tests/unit/adapters/phaser/level-is-data-only.test.ts` is the gate that
 * keeps it true by refusing any level id, any Ottawa vocabulary and any mode
 * name in this directory's non-comment source.
 *
 * ## What is placeholder, and where the seam is
 *
 * Art has not produced backgrounds yet (task 1.9), so every `key` and `artKey`
 * this level names has no texture behind it. Rather than draw nothing, the scene
 * checks the texture manager and falls back to a flat shape in the level's own
 * theme colours. When an atlas lands under those keys the branch takes the other
 * side and *nothing else changes*: the layer's depth, scroll factor, offset and
 * repeat all come from the document either way. The placeholder is deliberately
 * plain — bands and silhouettes — so nobody mistakes it for art and so it costs
 * almost nothing to throw away.
 *
 * ## Cost
 *
 * The background gradient is one screen of fill, the placeholder bands are
 * shallow (`PLACEHOLDER_BAND_HEIGHT`) rather than reaching the bottom of the
 * world, and the ground is one polygon. Everything static is drawn once into a
 * Graphics and never touched again; the only per-frame drawing is the snow,
 * which is skipped below the medium tier and under reduced motion. That keeps
 * the whole level near 2x screen area against CLAUDE.md's 4x overdraw budget,
 * with the other half left for characters and the HUD.
 *
 * ## Input, and what this is not
 *
 * The keyboard and pointer reading below is a stand-in for `InputPort`
 * (`app/application/ports/input.ts`), which is still PROVISIONAL and belongs to
 * task 1.15 along with the on-screen hold-to-move controls. It produces a
 * `LocomotionIntent` and nothing else, which is the same shape the real adapter
 * will produce, so replacing it is a constructor argument rather than a rewrite.
 * The HUD, the dialogue, the POI card and the interact prompt are accessible DOM
 * and are not this file's: the canvas is `aria-hidden` and always will be.
 */

/** Horizontal bands used to fake the sky gradient, as in `boot-scene.ts`. */
const GRADIENT_BANDS = 64;

/**
 * Keep a summed intent inside -1 … 1.
 *
 * The keyboard and the finger are added rather than switched between, so a
 * player holding a key and the glass at the same time asks for 2 and gets 1.
 * Adding is deliberate: it is what makes holding left on the keyboard and right
 * with a thumb cancel to a stop, which is the answer a player expects from two
 * opposing inputs and is the same one two opposing keys already give.
 */
const clampAxis = (value: number): number => Math.max(-1, Math.min(1, value));

/** Depth slots. Layers sit between the sky and the ground; actors above both. */
const DEPTH_SKY = 0;
const DEPTH_LAYERS = 100;
const DEPTH_GROUND = 400;
const DEPTH_ACTORS = 500;
/**
 * The tappable marks, above everything they describe and below the weather.
 *
 * Above the actors deliberately: a mark hidden behind the thing it points at is
 * the defect it exists to fix, arriving from the other side.
 */
const DEPTH_AFFORDANCE = 550;
const DEPTH_SNOW = 600;

/**
 * The actor placeholder, in design pixels.
 *
 * Still here, and still the right thing: it is what is drawn when the rig or the
 * atlas is not available, and a level a player can walk beats a blank screen.
 * What changed in task 1.12 is that it is no longer *all* that is ever drawn —
 * see `#paintCharacters`, and `data-actors-drawn` on the scene probe, which is
 * what stops a placeholder shipping unnoticed a second time.
 */
const ACTOR_WIDTH = 68;
const ACTOR_HEIGHT = 150;

/**
 * What the player is called in a diagnostic.
 *
 * Not a character id and deliberately not one: which artboard the player wears
 * is read from the rig (`character-cast.ts`), and a level's or a rig's
 * vocabulary may not appear in this directory at all
 * (`level-is-data-only.test.ts`). This is a word for a log line.
 */
const PLAYER_SUBJECT = 'the player';

/**
 * Below this, a character is standing rather than moving, design px/s.
 *
 * The rig's `moving` input is a boolean and the physics is continuous, so
 * something has to draw the line. One pixel a second is a character being
 * nudged by a rounding error, not one taking a step.
 */
const MOVING_THRESHOLD_PX_S = 1;

/**
 * The rig's own name for "somebody was engaged", fired on the character engaged.
 *
 * The rig's vocabulary, not a level's: `sprite-character-renderer.ts` already
 * transcribes the selector rule that reads it. A rig that declares no such
 * trigger answers `character.input.unknown` and the `Result` is dropped, which
 * is correct — an engagement is still an engagement without an animation for it.
 */
const INTERACT_TRIGGER = 'interact';

/** How many snowflakes a level asks for before the tier has its say. */
const REQUESTED_PARTICLES = 420;

/** How deep the surface sheen runs below the ground line, design pixels. */
const SHEEN_DEPTH = 34;

/** Where the horizon haze sits and how tall it is, as a fraction and design pixels. */
const HAZE_TOP_FRACTION = 0.44;
const HAZE_HEIGHT = 180;

/** Flake radius range, design pixels. */
const FLAKE_MIN_RADIUS = 3;
const FLAKE_MAX_RADIUS = 8;

export interface LevelSceneOptions {
  readonly level: SceneLevel;
  readonly designWidth: number;
  readonly designHeight: number;
  /** The `?e2e=1` probe, or `null` on a normal load. Output only. */
  readonly probe: SceneProbe | null;
  /** Present exactly while the level accepts input. */
  readonly marker: PlayableMarker | null;
  /** The tier the renderer probe measured. `null` until the first window closes. */
  readonly profile: RenderProfile | null;
  /**
   * The textures this level draws from, resolved from `assets/dist/manifest.json`
   * by `level-assets.ts` before the scene was constructed.
   *
   * Empty is legal and is what a build with no art produces: every layer takes
   * the placeholder band. It is **not** silent any more — `create` publishes
   * `layers` and `layersTextured` and the e2e suite fails when they differ,
   * which is the assertion that was missing while the deployed level drew no
   * art at all.
   */
  readonly assets?: readonly LoadRequest[];
  /**
   * The shared character rig, `content/characters/rig.json`, or `null`.
   *
   * The document, already parsed and validated — the adapter never opens it
   * (ADR-0022: an adapter doing content I/O bypasses ajv, the cache and
   * `unload`). `null` means no rig arrived and every character falls back to the
   * placeholder, visibly and countably rather than silently.
   */
  readonly rig?: RigDocument | null;
  /**
   * The appearance the player chose in the character creator, slot -> option.
   *
   * Absent — which is what an unwired build passes — dresses the player in the
   * artboard's own `skins`, then each slot's `fallback`. That is a complete
   * character rather than a naked one, so the creator can be joined to this
   * later without the level being broken until it is. An option the rig does not
   * offer is refused by the renderer with `character.skin.unknown` rather than
   * silently ignored.
   */
  readonly playerSkins?: Readonly<Record<string, string>>;
  /**
   * The device clock, injectable.
   *
   * The level's sky follows the real time of day (`time-of-day.ts`). It is a
   * function rather than a `Date` because a level outlives an instant: the scene
   * re-reads it every few seconds so that a session running past sunset, over
   * midnight, or through a timezone change ends up where the clock is.
   */
  readonly now?: () => Date;
  /** Called once the first playable frame exists. */
  readonly onReady?: (levelId: string) => void;
  /**
   * Every fact the level publishes, as it happens.
   *
   * The composition root turns these into typed bus events, which is how the
   * HUD, the POI card and the live region hear about them without anything in
   * this directory importing `app/ui` (ADR-0005). The probe's trace is *also*
   * fed, unchanged: the trace answers "was it emitted, on which frame", which a
   * bus subscription cannot, and the bus reaches the parts of the game a
   * Playwright assertion is not.
   */
  readonly onEvent?: SceneEventListener;
  /**
   * The moments a level finishes something — see `SCENE_MILESTONE_NAMES`.
   *
   * A second channel rather than two more `SceneEventName`s, because those are
   * type-checked against `app/ui`'s own union in the composition root and the UI
   * has no copy for a finished quest yet. Publishing them here means the engine's
   * half is done and observable — the probe's trace carries them, so their
   * ordering relative to `poi/engaged` is assertable — and the UI's half is one
   * subscription when the words exist.
   */
  readonly onMilestone?: SceneMilestoneListener;
}

/** One placeholder or textured parallax band, plus the document row it came from. */
interface LayerView {
  readonly key: string;
  readonly object: Phaser.GameObjects.GameObject & {
    setScrollFactor(x: number, y: number): unknown;
    setVisible(visible: boolean): unknown;
    setDepth(depth: number): unknown;
    /* Read back rather than remembered: the tier switches layers off through
       `setVisible`, and a second copy of that state is a second thing to keep
       in step. */
    readonly visible: boolean;
  };
  /**
   * A repeating band is drawn **viewport-wide and scrolled by its tile offset**,
   * not world-wide and scrolled by the camera.
   *
   * The difference is the whole cost of a parallax layer. Ottawa is 9000 design
   * pixels long and the camera sees 1080 of them, so a `tileSprite` sized to the
   * world submits a quad eight times wider than anything that can be seen, and —
   * because these textures are not power-of-two — Phaser builds a POT copy of it
   * to make `repeat` wrap. Six of those is megabytes of texture nobody asked for
   * and eight screens of geometry per frame. Pinning the quad to the viewport
   * and advancing `tilePositionX` instead draws exactly one screen per layer and
   * needs no copy.
   *
   * `factorX` is the layer's parallax rate, and it lives here rather than on the
   * game object because the object's `scrollFactor.x` is now always 0 — the quad
   * does not move, its contents do. `null` for a layer that is not tiled.
   */
  readonly tiled: { factorX: number } | null;
}

interface Flake {
  x: number;
  y: number;
  radius: number;
  speed: number;
  drift: number;
}

export class LevelScene extends Phaser.Scene {
  static readonly KEY = 'level';

  readonly #options: LevelSceneOptions;
  readonly #effects: LevelEffects;
  /**
   * Not `readonly`: `setAutoMove` rebuilds it.
   *
   * The accessibility option is `drive: 'auto'` on the tuning and nothing else,
   * so turning it on is one new strategy over the same level data rather than a
   * branch in `#sampleIntent`. The tuning the document authored stays in
   * `#tuning`, which is what reach, jump and the animation binding still read.
   */
  #locomotion: ReturnType<typeof createLocomotion>;
  readonly #tuning: LocomotionTuning;
  readonly #bounds: LevelBounds;
  /** Fingers on the glass, and what they mean. Pure; see `touch-controls.ts`. */
  readonly #touch: TouchControls = createTouchControls();
  #autoMove = false;

  #state: LocomotionState;
  #camera: Vec2 = { x: 0, y: 0 };
  #profile: RenderProfile | null;
  #layers: LayerView[] = [];
  #player: Phaser.GameObjects.Graphics | null = null;
  #sheen: Phaser.GameObjects.Graphics | null = null;
  #haze: Phaser.GameObjects.Graphics | null = null;
  #snowGraphics: Phaser.GameObjects.Graphics | null = null;
  #flakes: Flake[] = [];
  #snowQuantity = 0;
  #inReach = new Set<string>();
  /**
   * Everything engageable, with the rectangle it was actually drawn at.
   *
   * `position` is what reach is measured from and `rect` is what a finger has to
   * land on. They are different questions and were one field: reach is a
   * horizontal distance from the player, a hit area is a box on the glass that
   * `touch-controls.ts` grows to 44 pt before testing it.
   */
  #reachTargets: readonly {
    readonly id: string;
    readonly position: Vec2;
    readonly npc: boolean;
    readonly rect: TargetRect;
  }[] = [];
  /** Where each engageable thing was drawn, filled in by the paint passes. */
  readonly #drawnRects = new Map<string, TargetRect>();
  #jumpQueued = false;
  #interactQueued = false;
  /**
   * The level's palette under the current sky, and where the sky currently is.
   *
   * `#palette` is `level.palette` after `tintPalette`, and **every paint pass
   * reads it rather than the document**, so the tint is one substitution instead
   * of a branch in each of them. `#phase` moves toward the device clock in
   * bounded steps (`easePhase`), which is what makes midnight and a timezone
   * change a drift rather than a cut.
   */
  #phase: number;
  #palette: ThemeColours;
  /**
   * Everything whose colour comes from the palette, as the closure that draws it.
   *
   * Registered by each paint pass and re-run only when the tinted palette
   * actually changes an 8-bit channel — which most refreshes do not. The
   * alternative, a `#repaintSky` per surface, is the same code with five places
   * to forget one of them; the placeholder bands and the landmark silhouette
   * were exactly the two somebody would forget, and they are the two that would
   * then sit in daylight colours against an evening sky.
   */
  readonly #repaintables: (() => void)[] = [];
  /** The rig inputs this rig actually declares and this scene can compute. */
  #driven: { readonly bools: readonly string[]; readonly numbers: readonly string[] } = {
    bools: [],
    numbers: [],
  };
  /** The player, composed from the rig. `null` means the placeholder is on screen. */
  #playerCharacter: ICharacterRenderer | null = null;
  /** Placed characters by id, so an engagement can reach the one it engaged. */
  readonly #placed = new Map<string, ICharacterRenderer>();
  /** The tappable marks, by subject id, and the state each was last drawn in. */
  readonly #marks = new Map<
    string,
    { readonly object: Phaser.GameObjects.Graphics; mark: AffordanceMark }
  >();
  /** Subjects the domain has reported finished. Fed by {@link markCompleted}. */
  readonly #completed = new Set<string>();
  /** Milliseconds the level has been running, for the ready mark's pulse. */
  #elapsedMs = 0;
  /**
   * Characters that fell back to a placeholder shape, including the player.
   *
   * Counted separately from `#actorsDrawn` because the player is not in
   * `data-actors` — `level.pois.length + level.characters.length` does not
   * include them — so a player-shaped hole was invisible to every existing
   * counter. This one cannot be: it is published as `data-placeholders` and a
   * healthy level reads 0.
   */
  #placeholders = 0;
  /** Set once the level's stamp has been reported. See {@link markLevelComplete}. */
  #levelComplete = false;
  /** The five-second clock that lets the sky follow the device's time of day. */
  #skyClock: Phaser.Time.TimerEvent | null = null;
  /** The rig's atlas key, resolved once. `undefined` is "not asked yet". */
  #atlasKey: string | null | undefined = undefined;
  /** The target a tap landed on, waiting for the next `#sampleIntent`. */
  #tapTarget: string | null = null;
  /** That same target, handed to the frame that is running. */
  #pendingEngage: string | null = null;
  #ready = false;

  constructor(options: LevelSceneOptions) {
    super(LevelScene.KEY);
    this.#options = options;
    this.#profile = options.profile;

    /* The first entry is the mode the player spawns in — `level.schema.json`
       says so, and it is the only ordering rule a scene needs to know. */
    const tuning = options.level.locomotion[0];
    if (tuning === undefined) {
      throw new TypeError(
        `level "${options.level.id}" declares no locomotion tuning. The schema requires at ` +
          'least one and the parser enforces it, so reaching here means the document was not parsed.',
      );
    }
    this.#tuning = tuning;
    this.#locomotion = createLocomotion(tuning);
    this.#bounds = levelBounds(options.level.ground, options.level.size);
    this.#state = this.#locomotion.spawn(
      options.level.spawn.x,
      groundYAt(options.level.ground, options.level.spawn.x),
      'right',
    );
    this.#effects = createLevelEffects({
      layers: options.level.layers,
      requestedParticles: REQUESTED_PARTICLES,
    });

    /* Read once here so the first frame is already at the right time of day; a
       level that faded in from noon would be a worse answer than no feature. */
    this.#phase = dayPhase(this.#clock());
    this.#palette = tintPalette(options.level.palette, { phase: this.#phase });
  }

  /** The device clock, or the injected one. Never called on a frame. */
  #clock(): Date {
    return this.#options.now?.() ?? new Date();
  }

  /** What each effect would do on this device. Read by a test and by the debug overlay. */
  effectPlan(): readonly { readonly id: string; readonly path: string }[] {
    const profile = this.#profile;
    return profile === null ? [] : this.#effects.registry.plan(profile);
  }

  /**
   * Ask Phaser for every texture the level resolved.
   *
   * Phaser runs `preload` and holds `create` until the queue drains, so by the
   * time a layer asks `textures.exists(key)` the answer is the truth about this
   * build rather than "nobody has tried yet" — which is what it used to be, for
   * every layer, in production.
   */
  preload(): void {
    for (const request of this.#options.assets ?? []) {
      if (request.kind === 'image') this.load.image(request.key, request.url);
      else this.load.atlas(request.key, request.textureUrl, request.dataUrl);
    }
  }

  create(): void {
    const { level, designWidth } = this.#options;

    /*
     * What the rig lets this scene say, worked out once.
     *
     * And what the level document says that the rig has never heard of: the
     * `locomotion[].animation` binding names rig inputs and **nothing joins the
     * two documents**, so a level can drive a state that does not exist and the
     * only symptom is a character that never enters it. Reported here, once per
     * level, rather than sixty times a second from inside a setter.
     */
    this.#driven = drivableInputs(this.#options.rig);
    const unbound = unboundAnimationInputs(
      this.#options.rig,
      level.locomotion.flatMap((tuning) =>
        [
          tuning.animation.speedInput,
          tuning.animation.airborneInput,
          tuning.animation.jumpTrigger,
          tuning.animation.landTrigger,
          tuning.animation.brakeTrigger,
        ].filter((name): name is string => name !== undefined),
      ),
    );
    if (unbound.length > 0) {
      console.error(
        `[level] this level's locomotion animation binding names ${unbound.join(', ')}, which ` +
          `content/characters/rig.json does not declare as state-machine inputs. Those states ` +
          `can never be entered. The rig owns the vocabulary (ADR-0017) and no gate joins a ` +
          `level's binding to it; the scene drives only what the rig declares.`,
      );
    }

    this.#paintSky();
    this.#buildLayers();
    this.#paintGround();
    this.#paintOverlays();
    this.#paintPois();
    this.#paintCharacters();
    this.#paintPlayer();
    this.#buildSnow();
    this.#buildTargets();

    const camera = this.cameras.main;
    /*
     * Zoom from the top-left, not from the middle.
     *
     * Phaser anchors zoom on the camera's origin, which defaults to the centre.
     * Every screen-locked thing this scene draws — the sky gradient, the
     * parallax bands, the two overlays, the snow — is positioned in *design*
     * coordinates from (0, 0), so a centre-anchored zoom of 0.75 would render
     * them inset by 12.5% of the canvas on the left and overflowing it on the
     * right. At origin (0, 0) a design rect from (0,0) to (1080,1920) lands
     * exactly on a canvas of 1080z x 1920z, whatever z is.
     *
     * This was latent before and cost nothing only because Ottawa's zoom is 1.
     * `renderScale` is what makes z leave 1 on a real device, so it is fixed
     * here rather than discovered as a band of background colour down one edge.
     */
    fitCameraToDesign(camera, this.scale.gameSize.width, designWidth, level.camera.zoom);
    /*
     * **No `camera.setBounds`.** The scroll is already clamped to the world by
     * `scrollBounds` inside `followCamera`, in design units, and Phaser's own
     * bounds clamp is a second implementation of the same rule in canvas units.
     * Two clamps did not merely duplicate: Phaser's is computed against the
     * camera *origin*, and this camera's origin is (0, 0) so that a render scale
     * can shrink the drawing buffer without moving anything (see
     * `design-viewport.ts`). With bounds set, that clamp pushed `scrollY` to
     * 266.7 on a level whose world is exactly one viewport tall and whose scroll
     * should be 0 — the whole level sat 266 design pixels off, silently, because
     * both numbers looked plausible.
     *
     * So there is one clamp, it is ours, it is unit tested in
     * `level-camera.test.ts`, and it works in the units the level document is
     * written in.
     */
    this.#camera = followCamera(this.#followInput(0));
    camera.setScroll(this.#camera.x, this.#camera.y);

    this.#buildAffordances();
    this.#bindInput();
    this.applyProfile(this.#profile);
    this.#startSkyClock();

    this.#ready = true;
    this.#options.marker?.show();
    this.#options.probe?.publish({
      level: level.id,
      mode: this.#tuning.mode,
      paused: false,
      playerX: this.#state.x,
      playerY: this.#state.y,
      speed: 0,
      facing: this.#state.facing,
      grounded: true,
      cameraX: this.#camera.x,
      layers: level.layers.length,
      layersTextured: this.#texturedLayers,
      actors: level.pois.length + level.characters.length,
      actorsDrawn: this.#actorsDrawn,
      playerDrawn: this.#playerCharacter !== null,
      placeholders: this.#placeholders,
      dayPhase: this.#phase,
      ...this.#affordanceCounts(),
      ...this.#visibleArt(),
    });
    this.#emit('level/ready', level.id);
    this.#options.onReady?.(level.id);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#options.marker?.hide();
      this.#ready = false;
      /* Fingers do not survive a level change, and neither does the listener
         that would keep answering for the game after this scene is gone. */
      this.#touch.cancelAll();
      this.game.events.off(Phaser.Core.Events.BLUR, this.#releaseEveryPointer);
      this.events.off(Phaser.Scenes.Events.PAUSE, this.#releaseEveryPointer);
      this.events.off(Phaser.Scenes.Events.SLEEP, this.#releaseEveryPointer);
      /* Every character releases its parts before the level goes; the atlas is
         the texture manager's and is dropped by the unload path, not here. */
      for (const character of this.#characters) character.dispose();
      this.#characters = [];
      this.#playerCharacter?.dispose();
      this.#playerCharacter = null;
      this.#placed.clear();
      this.#skyClock?.remove();
      this.#skyClock = null;
    });
  }

  /**
   * Re-apply the visual tier.
   *
   * Called at create and again whenever `render-tier-probe.ts` closes a
   * measurement window and changes its mind. Everything the tier controls is
   * re-derived here rather than remembered, so a promotion and a demotion are
   * the same code path and neither can leave a layer half-configured.
   */
  applyProfile(profile: RenderProfile | null): void {
    this.#profile = profile;
    if (profile === null) return;

    /* The renderer may have resized the drawing buffer for this tier just
       before calling us, so the camera's zoom is re-derived rather than
       remembered — same reason everything else here is. */
    fitCameraToDesign(
      this.cameras.main,
      this.scale.gameSize.width,
      this.#options.designWidth,
      this.#options.level.camera.zoom,
    );

    const kept = new Set(
      selectLayers(this.#options.level.layers, profile.parallaxLayers, this.#layerViewport()).map(
        (layer) => layer.key,
      ),
    );
    for (const layer of this.#layers) {
      const visible = kept.has(layer.key);
      layer.object.setVisible(visible);
      /* Pinned to the world first, then the drift effect may override it. A
         skipped effect therefore means "no independent movement", which is what
         reduced motion asks for — not a missing backdrop. */
      this.#setLayerRate(layer, 1, 1);
      if (!visible) continue;
      applyEffect(
        this.#effects.parallaxDrift,
        /*
         * The effect is handed a *target*, not the game object, so a tiled band
         * can take the same instruction — "scroll at this rate" — and honour it
         * by moving its tile offset instead of its quad. `level-effects.ts` is
         * unchanged and still knows nothing about how a layer is drawn, which is
         * what lets its policy stay unit tested with no Phaser.
         */
        {
          layerKey: layer.key,
          setScrollFactor: (x: number, y: number) => this.#setLayerRate(layer, x, y),
        },
        profile,
      );
    }
    this.#scrollLayers();

    this.#snowQuantity = 0;
    const emitter = {
      setQuantity: (quantity: number): void => {
        this.#snowQuantity = quantity;
      },
      start: (): void => undefined,
    };
    applyEffect(this.#effects.snowfall, emitter, profile);
    this.#seedFlakes(this.#snowQuantity);
    this.#snowGraphics?.setVisible(this.#snowQuantity > 0);

    /* The two `still` overlays. A skipped effect never touches the alpha, so the
       object is hidden first and only made visible by the effect having run —
       "the tier decided" rather than "nobody set it". */
    for (const [effect, object] of [
      [this.#effects.surfaceSheen, this.#sheen],
      [this.#effects.horizonHaze, this.#haze],
    ] as const) {
      if (object === null) continue;
      object.setVisible(false);
      const target = {
        setAlpha: (alpha: number): void => {
          object.setAlpha(alpha);
          object.setVisible(true);
        },
      };
      applyEffect(effect, target, profile);
    }

    /*
     * Placed characters are driven once, at create, so a tier change after that
     * would leave their `reducedMotion` input stale — a rig state chosen under a
     * motion setting the player has since turned off. Re-driven here rather than
     * every frame: this runs when the tier changes and at nothing else.
     */
    for (const character of this.#placed.values()) {
      this.#driveCharacter(character, {
        grounded: true,
        moving: false,
        speed: 0,
        verticalSpeed: 0,
      });
    }

    this.#options.probe?.publish({
      particles: this.#snowQuantity,
      parallaxEasing: profile.parallaxEasing,
      tier: profile.tier,
      motion: profile.motion,
    });
  }

  override update(_time: number, delta: number): void {
    if (!this.#ready) return;

    const dt = Math.min(MAX_STEP_SECONDS, Math.max(0, delta / 1000));
    const intent = this.#sampleIntent();

    const step = this.#locomotion.step(this.#state, intent, dt);
    this.#state = applyBounds(step.state, this.#bounds, this.#tuning, dt);

    for (const event of step.events) this.#publishLocomotionEvent(event.kind);
    this.#updateReach();

    this.#camera = followCamera(this.#followInput(dt));
    this.cameras.main.setScroll(this.#camera.x, this.#camera.y);

    this.#elapsedMs += delta;
    this.#player?.setPosition(this.#state.x, this.#state.y);
    this.#updatePlayerCharacter(step.animationSpeed, delta);
    this.#updatePlacedCharacters(delta);
    this.#updateAffordances();
    this.#scrollLayers();
    this.#updateSnow(dt);

    const probe = this.#options.probe;
    if (probe !== null) {
      probe.recordFrame({
        dtSeconds: dt,
        x: this.#state.x,
        y: this.#state.y,
        velocityX: this.#state.velocityX,
        speed: Math.abs(this.#state.velocityX),
        grounded: this.#state.grounded,
        facing: this.#state.facing,
        intentMove: intent.move,
        cameraX: this.#camera.x,
      });
      probe.publish({
        playerX: this.#state.x,
        playerY: this.#state.y,
        speed: Math.abs(this.#state.velocityX),
        facing: this.#state.facing,
        grounded: this.#state.grounded,
        cameraX: this.#camera.x,
        ...this.#affordanceCounts(),
        ...this.#visibleArt(),
      });
    }
  }

  /* ---------------------------------------------------------------- input --- */

  /**
   * Keyboard and pointer, bound once.
   *
   * The keyboard half is untouched by the touch work and must stay that way:
   * keyboard-only play is a requirement, not a fallback (CLAUDE.md,
   * Accessibility), so every branch below adds to what a key already does and
   * none of them replaces it. The two are summed in `#sampleIntent`, which means
   * a player using both at once gets the sum rather than a mode switch.
   *
   * The pointer half handles *every* pointer, not only touch ones. A mouse click
   * on a desktop is a press that ends quickly and without travel, which is a tap,
   * which is a jump — exactly what the single `POINTER_DOWN` handler that used to
   * live here did. Nothing on the desktop got worse.
   *
   * `POINTER_UP_OUTSIDE` is bound alongside `POINTER_UP` because a finger that
   * slides off the canvas before lifting reports only the outside one, and a
   * release nobody hears is a walk that never stops.
   *
   * Times come from `this.time.now`, the scene's own clock, not from
   * `performance.now()`. It advances once per frame, so a press and a release
   * inside one frame are zero milliseconds apart and a press is measured from
   * the frame that saw it — the same clock the level is simulated in, and the
   * one every assertion about this feature is phrased in. The cost is that a
   * tap's measured duration is rounded up by at most one frame: 17 ms at the
   * frame budget, 33 ms on the 30 fps Android target, against a 160 ms window.
   * A tap has to be half again as long as any real one before that rounding
   * could change the answer.
   */
  #bindInput(): void {
    const keyboard = this.input.keyboard;
    keyboard?.addCapture(['LEFT', 'RIGHT', 'UP', 'DOWN', 'SPACE']);

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.#touch.press(pointer.id, this.#viewPointOf(pointer), this.time.now);
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      /* A desktop mouse emits this continuously with nothing pressed, and the
         answer for every one of those is "no pointer is down, there is nothing
         to drag". Checked here rather than inside the gesture module so the
         common case costs a field read instead of a call and an allocation —
         per-frame pointer work is measured by `tests/perf/budgets.spec.ts`. */
      if (this.#touch.active === 0) return;
      this.#touch.drag(pointer.id, this.#viewPointOf(pointer), this.time.now);
    });

    const up = (pointer: Phaser.Input.Pointer): void => {
      /*
       * A pointer the browser took away is not a release.
       *
       * `touchcancel` — a notification shade, an incoming call, a system edge
       * gesture — reaches Phaser as a `POINTER_UP` with `wasCanceled` set, and
       * treating it as an ordinary release would fire a jump for an interaction
       * the player never finished. Dropping it also un-latches the walk, which is
       * the bug this arm exists for: without it the player keeps walking while
       * they read a notification, and there is no finger left to stop them.
       */
      if (pointer.wasCanceled) {
        this.#touch.cancel(pointer.id);
        return;
      }
      const tap = this.#touch.release(pointer.id, this.time.now);
      if (tap === null) return;
      this.#resolveTap(tap);
    };
    this.input.on(Phaser.Input.Events.POINTER_UP, up);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, up);

    /* A backgrounded tab, a phone call answered, an app switch. The pointers
       that were down are gone and no `touchend` is coming for them. */
    this.game.events.on(Phaser.Core.Events.BLUR, this.#releaseEveryPointer);
    this.events.on(Phaser.Scenes.Events.PAUSE, this.#releaseEveryPointer);
    this.events.on(Phaser.Scenes.Events.SLEEP, this.#releaseEveryPointer);
  }

  /** Bound once so `off` can find it again; see `#bindInput` and SHUTDOWN. */
  readonly #releaseEveryPointer = (): void => {
    this.#touch.cancelAll();
  };

  /**
   * What a tap meant: engage the thing under it, or jump.
   *
   * Hit-testing runs first and unconditionally, because "tap an NPC or a POI to
   * engage it" has to beat "tap to jump" when the finger lands on one — a player
   * who taps the officer and watches their skater hop has been told the game
   * ignored them.
   *
   * Only targets the level's own `InteractionAffordance` says are engageable are
   * offered to the hit test, which is why a tap on something across the canal
   * jumps: at that distance it is not an NPC, it is scenery, and tapping scenery
   * is tapping the world.
   *
   * The engagement is *queued*, not performed. It is fed back in as
   * `LocomotionIntent.interactPressed` on the next frame so it goes through the
   * strategy exactly as the interact key does — which is what makes a mode with
   * `interaction: null` (a canoe mid-river) refuse a tap without this file
   * knowing that such modes exist.
   */
  #resolveTap(tap: ViewPoint): void {
    const target = hitTest(this.#engageableTargets(), this.#viewToWorld(tap), this.#minTouchWorldPx());
    if (target === null) {
      this.#jumpQueued = true;
      return;
    }
    this.#tapTarget = target.id;
  }

  /** Targets within the mode's reach right now, with the hit area they were drawn at. */
  #engageableTargets(): readonly { readonly id: string; readonly npc: boolean; readonly rect: TargetRect }[] {
    const reach = this.#reachPx();
    return this.#reachTargets.filter(
      (target) => Math.abs(target.position.x - this.#state.x) <= reach,
    );
  }

  #sampleIntent(): LocomotionIntent {
    const keyboard = this.input.keyboard;
    /* `enableCapture: false`: the page keeps its own key handling, so a DOM
       screen above the canvas is never starved of a keystroke. */
    const down = (key: string): boolean => keyboard?.addKey(key, false).isDown ?? false;

    /*
     * Two bindings per action, arrows and the WASD block, so the level is
     * playable with either hand. These are Phaser key names and therefore
     * `keyCode`-based; `InputPort` binds by `KeyboardEvent.code` — physical
     * position — and replacing this reader with it is what would make
     * TN-LEVEL-06's AZERTY scenario true rather than nearly true.
     *
     * The touch work did **not** do that, deliberately. `InputPort` describes a
     * device: a set of held/pressed `GameAction`s and a `moveAxis`. Neither half
     * of the design here can be decided from that. "Which side of the player is
     * the finger" needs the player's position on screen, and "what did this tap
     * mean" needs a hit test against the world — both are gameplay facts the
     * port has no way to carry, and pushing either into an input adapter would
     * put the camera and the level's targets behind a port that exists to know
     * about neither. So the port is still `PROVISIONAL` and unconsumed, and what
     * crosses the boundary from `touch-controls.ts` is intent, not events.
     */
    const left = down('LEFT') || down('A');
    const right = down('RIGHT') || down('D');
    const jumpHeld = down('SPACE') || down('UP') || down('W');
    const interact = down('E') || down('ENTER');

    const jumpPressed = this.#jumpQueued || (jumpHeld && !this.#lastJumpHeld);
    this.#lastJumpHeld = jumpHeld;
    this.#jumpQueued = false;

    /*
     * The tap's target, handed to this frame and to no other.
     *
     * Assigned every frame rather than cleared conditionally, so a tap the
     * strategy declines — out of reach by the time the frame ran, or a mode that
     * cannot engage at all — cannot sit in the field and fire later.
     */
    this.#pendingEngage = this.#tapTarget;
    this.#tapTarget = null;

    const interactPressed =
      this.#interactQueued || this.#pendingEngage !== null || (interact && !this.#lastInteract);
    this.#lastInteract = interact;
    this.#interactQueued = false;

    /*
     * Keyboard and finger, summed.
     *
     * `#touch.axis` is asked once a frame and takes the player's position on
     * screen, because the direction is "which side of the player is the finger",
     * never "which half of the screen was touched" — the camera carries a lead
     * offset and clamps at the world's edges, so the player's screen position
     * moves and a screen-half rule would invert under a stationary thumb.
     */
    const touch = this.#touch.axis(this.#playerViewX(), this.time.now);
    const move = clampAxis((left ? -1 : 0) + (right ? 1 : 0) + touch);

    return {
      move,
      jumpPressed,
      jumpHeld,
      interactPressed,
      slope: slopeAt(this.#options.level.ground, this.#state.x),
      groundY: groundYAt(this.#options.level.ground, this.#state.x),
    };
  }

  /* ------------------------------------------------ pointer <-> the world --- */

  /**
   * A Phaser pointer in design-space view pixels.
   *
   * `pointer.x` is in *canvas* pixels, and the canvas is `designWidth * scale`
   * wide because the visual tier shrinks the drawing buffer (`design-viewport.ts`).
   * Every threshold in `touch-controls.ts` is in design pixels, so the division
   * has to happen here or a demoted tier would silently halve the dead zone.
   */
  #viewPointOf(pointer: { readonly x: number; readonly y: number }): ViewPoint {
    const scale = this.#backingScale();
    return { x: pointer.x / scale, y: pointer.y / scale };
  }

  /** Where the player is on the glass, in design pixels from the canvas's left edge. */
  #playerViewX(): number {
    return (this.#state.x - this.#camera.x) * this.#options.level.camera.zoom;
  }

  #viewToWorld(point: ViewPoint): ViewPoint {
    const zoom = this.#options.level.camera.zoom;
    return { x: this.#camera.x + point.x / zoom, y: this.#camera.y + point.y / zoom };
  }

  /**
   * CLAUDE.md's 44 pt minimum, in world units.
   *
   * Measured from the canvas the player is touching rather than assumed: the
   * same 44 pt is about 122 design pixels on a 390 px phone and about 95 on a
   * centred desktop portrait canvas. An NPC drawn smaller than this is still
   * drawn smaller than this — what grows is the glass that counts as them.
   */
  #minTouchWorldPx(): number {
    const css = this.scale.displaySize.width;
    return minTouchTargetPx(this.#options.designWidth, css) / this.#options.level.camera.zoom;
  }

  /**
   * Auto-move, the accessibility option (CLAUDE.md, Traversal).
   *
   * Implemented by handing the strategy `drive: 'auto'` rather than by
   * synthesising a direction in this file. `locomotion.ts` already turns that
   * into "keep going the way you are facing" for every mode, so the option costs
   * one field on a tuning object and no scene code at all — and a player with
   * auto-move on still steers and brakes with a held finger or a held key,
   * because a non-zero intent always wins over the drive.
   *
   * NOT WIRED TO THE SETTINGS SCREEN YET. `app/ui/settings-screen.ts` offers the
   * toggle and `app/bootstrap` owns the wire between it and this method; both
   * were being edited by another agent when this landed, so the requirement is
   * reported rather than half-applied.
   */
  setAutoMove(enabled: boolean): void {
    if (this.#autoMove === enabled) return;
    this.#autoMove = enabled;
    this.#locomotion = createLocomotion(
      enabled ? { ...this.#tuning, drive: 'auto' } : this.#tuning,
    );
  }

  get autoMove(): boolean {
    return this.#autoMove;
  }

  #lastJumpHeld = false;
  #lastInteract = false;
  /** How many parallax layers drew from a texture. See `SceneSnapshot.layers`. */
  #texturedLayers = 0;
  /** Characters and points of interest that drew real art, not a placeholder. */
  #actorsDrawn = 0;
  #characters: ICharacterRenderer[] = [];
  /**
   * Where each thing that drew real art actually is, in world space.
   *
   * Kept so the probe can answer "is it on the screen" rather than only "was it
   * given a texture" — the distinction a `2/2` on an empty screen did not make.
   * A screen-locked parallax band has no world x, so it is recorded as spanning
   * the level: it is horizontally in view by construction.
   */
  #artBounds: { readonly kind: 'layer' | 'actor'; readonly rect: WorldRect }[] = [];

  /**
   * Canvas pixels per design pixel, read from the scale manager rather than
   * passed in.
   *
   * `GameRenderer` resizes the drawing buffer when the tier changes, and the
   * scale manager is then the one true statement of how big it is. A copy
   * handed to the scene could disagree with the canvas for a frame, and a
   * camera zoom that disagrees with the canvas is a mis-framed level.
   */
  #backingScale(): number {
    return backingScaleOf(this.scale.gameSize.width, this.#options.designWidth);
  }

  /* --------------------------------------------------------------- camera --- */

  #followInput(dtSeconds: number): Parameters<typeof followCamera>[0] {
    const { level, designWidth, designHeight } = this.#options;
    /*
     * Both the viewport and the zoom carry the backing scale, so their quotient
     * — the world the camera can see, which is the only thing `followCamera`
     * uses them for — is unchanged. Framing is therefore identical at every
     * render scale, which is the property `tests/e2e/level-ottawa.spec.ts`'s
     * "between 25 and 70 percent of the canvas width" scenario asserts.
     */
    const scale = this.#backingScale();
    return {
      camera: this.#camera,
      target: { x: this.#state.x, y: this.#state.y },
      velocityX: this.#state.velocityX,
      facing: this.#state.facing,
      tuning: { ...level.camera, zoom: level.camera.zoom * scale },
      viewport: { width: designWidth * scale, height: designHeight * scale },
      world: level.size,
      dtSeconds,
      reducedMotion: this.#profile?.motion === 'reduced',
    };
  }

  /**
   * What the layers have to cover, and where the ground cuts them off.
   *
   * `horizonY` is the highest point of the ground polyline: everything below it
   * is painted over by the ground polygon, so a band down there covers nothing
   * however tall it is. That is what stops the tier keeping Ottawa's canal wall
   * over its sky.
   */
  #layerViewport(): LayerViewport {
    const { level, designWidth, designHeight } = this.#options;
    const horizonY = level.ground.reduce(
      (highest, point) => Math.min(highest, point.y),
      designHeight,
    );
    return {
      width: designWidth,
      height: designHeight,
      horizonY,
      sizeOf: (key) => {
        if (!this.textures.exists(key)) return null;
        const source = this.textures.get(key).getSourceImage();
        return { width: source.width, height: source.height };
      },
    };
  }

  /**
   * How much of the level's art the camera can actually see, right now.
   *
   * `layersTextured` and `actorsDrawn` count what was *given a texture*, and
   * both read full marks on a build whose screen held a gradient, an ice band,
   * snow and one rounded rectangle — the officer and the landmark were drawn
   * faithfully, 1 760 and 4 760 design pixels off to the right. A count whose
   * passing value does not require the outcome is not a check.
   *
   * These two are geometry: a subject whose world bounds do not meet the
   * camera's view is not on the screen. They move as the camera moves, so a test
   * can watch the same counter read `0` with the officer off screen and `1` with
   * the officer in front of the player — which is the built-in falsification the
   * counters they sit beside never had.
   *
   * Honest about its own limit: this proves *occupies screen area*, not *lit a
   * pixel*. A transparent texture would still count. Pixel statistics were tried
   * for the stronger claim and are recorded as not working on this scene in
   * `tests/e2e/level-art.spec.ts`.
   */
  #visibleArt(): { layersVisible: number; actorsVisible: number } {
    const { level, designWidth, designHeight } = this.#options;
    const scale = this.#backingScale();
    const view = cameraView(
      this.#camera,
      { width: designWidth * scale, height: designHeight * scale },
      { ...level.camera, zoom: level.camera.zoom * scale },
    );

    let layersVisible = 0;
    let actorsVisible = 0;
    for (const art of this.#artBounds) {
      if (!intersectsView(art.rect, view)) continue;
      if (art.kind === 'layer') layersVisible += 1;
      else actorsVisible += 1;
    }
    /* A layer the tier switched off is drawn nowhere, whatever its bounds say. */
    const hidden = this.#layers.filter((layer) => !layer.object.visible).length;
    return { layersVisible: Math.max(0, layersVisible - hidden), actorsVisible };
  }

  /* --------------------------------------------------------------- events --- */

  #emit(name: SceneEventName, detail?: string): void {
    if (detail === undefined) this.#options.probe?.recordEvent(name);
    else this.#options.probe?.recordEvent(name, detail);
    /* Spread rather than a conditional call for the same reason the probe above
       has two branches: `exactOptionalPropertyTypes` makes an explicit
       `undefined` a different thing from an omitted argument, and a listener
       that receives `detail: undefined` cannot tell "no subject" from "a subject
       nobody set". */
    if (detail === undefined) this.#options.onEvent?.(name);
    else this.#options.onEvent?.(name, detail);
  }

  /**
   * Locomotion facts, under the names `docs/stories/README.md` fixes.
   *
   * A landing has no name in that list and so is not invented here: the frame
   * trace already carries `grounded` every frame, which is how TN-LEVEL-03's
   * "on landing the horizontal speed is at least 90 percent of the take-off
   * speed" is answered.
   */
  #publishLocomotionEvent(kind: string): void {
    if (kind === 'started-moving') this.#emit('player/moved');
    else if (kind === 'stopped') this.#emit('player/stopped');
    else if (kind === 'took-off') this.#emit('player/jumped');
    else if (kind === 'braked') this.#emit('player/braked');
    else if (kind === 'interaction-requested') this.#engageNearest();
  }

  /**
   * Everything engageable, as one list, so reach is one rule and not two.
   *
   * Built once at create rather than per frame. It was per frame, and it
   * allocated three arrays every time `update` ran — a level's POIs and
   * characters do not move, and sixty allocations a second of a list that never
   * changes is exactly the kind of cost that only shows up on the device that
   * cannot afford it.
   */
  #buildTargets(): void {
    const { level } = this.#options;
    /*
     * The hit area is the rectangle the paint pass actually drew, not a box
     * guessed from the position. A landmark that fell back to its silhouette is
     * 180 x 620; the same landmark with its art is whatever the texture is; a
     * character composed from the rig is `characterSpace`. Reading the drawn
     * rectangle means a tap lands on what the player can see rather than on
     * where the level document says the thing is.
     */
    const fallback = (position: Vec2): TargetRect => ({
      x: position.x - ACTOR_WIDTH / 2,
      y: position.y - ACTOR_HEIGHT,
      width: ACTOR_WIDTH,
      height: ACTOR_HEIGHT,
    });
    const rectFor = (id: string, position: Vec2): TargetRect =>
      this.#drawnRects.get(id) ?? fallback(position);

    this.#reachTargets = [
      ...level.pois.map((poi) => ({
        id: poi.id as string,
        position: poi.position,
        npc: false,
        rect: rectFor(poi.id as string, poi.position),
      })),
      ...level.characters.map((character) => ({
        id: character.characterId as string,
        position: character.position,
        npc: true,
        rect: rectFor(character.characterId as string, character.position),
      })),
    ];
  }

  #reachPx(): number {
    return this.#tuning.interaction?.reachPx ?? 0;
  }

  #updateReach(): void {
    const reach = this.#reachPx();
    let changed = false;
    for (const target of this.#reachTargets) {
      const near = Math.abs(target.position.x - this.#state.x) <= reach;
      const was = this.#inReach.has(target.id);
      if (near && !was) {
        this.#inReach.add(target.id);
        changed = true;
        this.#emit('poi/entered', target.id);
      } else if (!near && was) {
        this.#inReach.delete(target.id);
        changed = true;
        this.#emit('poi/left', target.id);
      }
    }
    /* The marks are recomputed on a change of reach and on nothing else, which
       is what keeps "what can I tap" free per frame. */
    if (changed) this.#refreshAffordances();
  }

  /**
   * Engage the thing the player asked for, or the nearest thing if they did not
   * name one.
   *
   * A finger names one — it landed on it — and a key does not, so the tapped
   * target wins when there is one. Both still go through the same reach check,
   * so a tap cannot engage something the interact key could not: the strategy
   * has already had its say about `whileMoving` and `requiresStop` by the time
   * this runs, and this is the last gate rather than a second rulebook.
   */
  #engageNearest(): void {
    const reach = this.#reachPx();
    const asked = this.#pendingEngage;
    this.#pendingEngage = null;

    let best: { id: string; npc: boolean; distance: number } | null = null;
    for (const target of this.#reachTargets) {
      const distance = Math.abs(target.position.x - this.#state.x);
      if (distance > reach) continue;
      if (target.id === asked) {
        best = { id: target.id, npc: target.npc, distance };
        break;
      }
      if (best === null || distance < best.distance) {
        best = { id: target.id, npc: target.npc, distance };
      }
    }
    if (best === null) return;
    /* The rig has a `once` interact state; firing it is what makes an engagement
       visible in the world rather than only in the DOM above it. A rig that
       declares no such trigger simply has nothing fired at it. */
    const engaged = this.#placed.get(best.id) ?? this.#playerCharacter;
    if (engaged !== null && engaged !== undefined) engaged.fire(INTERACT_TRIGGER);
    this.#emit(best.npc ? 'npc/engaged' : 'poi/engaged', best.id);
  }

  /* --------------------------------------------------------------- drawing -- */

  /**
   * Register a drawing that depends on the palette, and run it now.
   *
   * Everything painted from `#palette` goes through here so that the time of day
   * can move without any pass having to know that it can. The closure is called
   * again only when a tinted channel actually changed, which is a handful of
   * times an hour and never on a frame.
   */
  #repaint(draw: () => void): void {
    this.#repaintables.push(draw);
    draw();
  }

  #paintSky(): void {
    const { designWidth, designHeight } = this.#options;
    const graphics = this.add.graphics().setScrollFactor(0, 0).setDepth(DEPTH_SKY);
    const bandHeight = designHeight / GRADIENT_BANDS;

    this.#repaint(() => {
      graphics.clear();
      for (let band = 0; band < GRADIENT_BANDS; band += 1) {
        const position = band / (GRADIENT_BANDS - 1);
        graphics.fillStyle(mixColor(this.#palette.sky, this.#palette.ground, position), 1);
        graphics.fillRect(0, Math.floor(band * bandHeight), designWidth, Math.ceil(bandHeight) + 1);
      }
    });
  }

  /**
   * Draw a band between two ordered profiles as quads, one per segment.
   *
   * Not `fillPath`. Phaser triangulates a filled path on the CPU every frame it
   * is drawn, and a level's ground is a static polyline that would be
   * re-triangulated sixty times a second for no benefit. Two triangles per
   * segment is the same picture with no tessellation, and on a software
   * rasteriser — the tier this engine exists to keep playable — it is the
   * difference between hitting the frame budget and missing it.
   */
  #fillUnder(
    graphics: Phaser.GameObjects.Graphics,
    profile: readonly Vec2[],
    bottom: (point: Vec2) => number,
  ): void {
    for (let index = 1; index < profile.length; index += 1) {
      const a = profile[index - 1];
      const b = profile[index];
      if (a === undefined || b === undefined) continue;
      graphics.fillTriangle(a.x, a.y, b.x, b.y, a.x, bottom(a));
      graphics.fillTriangle(b.x, b.y, b.x, bottom(b), a.x, bottom(a));
    }
  }

  /**
   * One object per authored layer, textured when the art exists and a flat band
   * when it does not.
   *
   * Both branches read the same five properties out of the document, which is
   * the seam: dropping an atlas in under these keys changes what is drawn and
   * changes nothing about where, how fast or in what order.
   */
  #buildLayers(): void {
    const { level, designWidth } = this.#options;
    const ordered = [...level.layers].sort((a, b) => a.depth - b.depth);
    this.#texturedLayers = 0;

    ordered.forEach((layer, index) => {
      const depth = DEPTH_LAYERS + index;
      if (this.textures.exists(layer.key)) {
        this.#texturedLayers += 1;
        const source = this.textures.get(layer.key).getSourceImage();
        const height = source.height;
        /*
         * Exactly one screen wide — never `level.size.x`, and no longer a screen
         * plus a tile of slack.
         *
         * The slack was over-caution: `tilePositionX` wraps the texture inside
         * the quad, so a quad the width of the viewport shows an unbroken band
         * at every scroll offset and the seam has nowhere to appear. Carrying
         * the extra tile made Ottawa's sky quad 2160 wide and its skyline 2880,
         * for a camera that sees 1080 — vertices, clipping and texture memory
         * for pixels no one can look at.
         */
        const width = layer.repeatX ? designWidth : source.width;
        const sprite = this.add
          .tileSprite(layer.offset.x, layer.offset.y, width, height, layer.key)
          .setOrigin(0, 0)
          .setDepth(depth);
        this.#layers.push({
          key: layer.key,
          object: sprite,
          tiled: layer.repeatX ? { factorX: 1 } : null,
        });
        this.#artBounds.push({
          kind: 'layer',
          rect: {
            x: layer.repeatX ? 0 : layer.offset.x,
            y: layer.offset.y,
            width: layer.repeatX ? level.size.x : source.width,
            height,
          },
        });
        return;
      }

      const band = this.add.graphics().setDepth(depth);
      const shade = ordered.length <= 1 ? 0.5 : index / (ordered.length - 1);
      this.#repaint(() => {
        band.clear();
        /* Far bands sit close to the sky, near ones close to the ground: the
           same aerial perspective an atlas would paint, expressed in two theme
           colours so the placeholder cannot clash with the level it stands in
           for — including the level after dusk, which is why it is repainted
           with everything else rather than fixed at the colour of noon. */
        band.fillStyle(
          blendColors(
            toPhaserColor(this.#palette.sky),
            toPhaserColor(this.#palette.ground),
            0.25 + shade * 0.7,
          ),
          1,
        );
        band.fillRect(0, layer.offset.y, level.size.x, PLACEHOLDER_BAND_HEIGHT);
      });
      this.#layers.push({ key: layer.key, object: band, tiled: null });
    });
  }

  /**
   * Apply a parallax rate to one layer.
   *
   * A tiled band keeps its quad still — `scrollFactor.x` of 0 — and remembers
   * the rate for {@link #scrollLayers}. Everything else takes the rate the way
   * it always did. Vertical is unchanged in both: portrait levels move very
   * little vertically and a screen-tall band has no equivalent trick.
   */
  #setLayerRate(layer: LayerView, x: number, y: number): void {
    if (layer.tiled === null) {
      layer.object.setScrollFactor(x, y);
      return;
    }
    layer.tiled.factorX = x;
    layer.object.setScrollFactor(0, y);
  }

  /**
   * Move the contents of every tiled band, once per frame.
   *
   * `tilePositionX = cameraX * rate` is exactly what `scrollFactor.x = rate`
   * did to the quad, applied to the texture instead — so the picture is the
   * same and the cost is one screen rather than the whole level.
   */
  #scrollLayers(): void {
    for (const layer of this.#layers) {
      if (layer.tiled === null) continue;
      (layer.object as Phaser.GameObjects.TileSprite).tilePositionX =
        this.#camera.x * layer.tiled.factorX;
    }
  }

  /**
   * The ground, as the polyline says it is.
   *
   * One filled polygon from the polyline down to the bottom of the world, plus a
   * lit crest along the top in `palette.horizon`. The crest is what makes the
   * ice read as a surface rather than as the top of a block of colour, and it
   * follows the polyline, so it cannot be mistaken for a rule across the screen
   * (see `boot-scene.ts` for why that matters).
   */
  #paintGround(): void {
    const { level } = this.#options;
    const ground = this.add.graphics().setDepth(DEPTH_GROUND);

    this.#repaint(() => {
      ground.clear();
      ground.fillStyle(blendColors(toPhaserColor(this.#palette.ground), 0x000000, 0.06), 1);
      this.#fillUnder(ground, level.ground, () => level.size.y);

      ground.lineStyle(6, toPhaserColor(this.#palette.horizon), 0.9);
      ground.beginPath();
      level.ground.forEach((point, index) => {
        if (index === 0) ground.moveTo(point.x, point.y);
        else ground.lineTo(point.x, point.y);
      });
      ground.strokePath();
    });
  }

  /**
   * The two tier-gated overlays: a pale sheen along the ground and a band of
   * light over the backdrop.
   *
   * Drawn once and left alone; only their alpha and visibility are touched, by
   * the effects, from `applyProfile`. Both are shallow bands rather than screen
   * fills, so the pair costs well under a third of a screen against CLAUDE.md's
   * 4x overdraw budget.
   */
  #paintOverlays(): void {
    const { level, designWidth, designHeight } = this.#options;

    const sheen = this.add.graphics().setDepth(DEPTH_GROUND + 1);
    this.#repaint(() => {
      sheen.clear();
      sheen.fillStyle(toPhaserColor(this.#palette.horizon), 1);
      this.#fillUnder(sheen, level.ground, (point) => point.y + SHEEN_DEPTH);
    });
    this.#sheen = sheen;

    const haze = this.add.graphics().setScrollFactor(0, 0).setDepth(DEPTH_LAYERS - 1);
    this.#repaint(() => {
      haze.clear();
      haze.fillStyle(toPhaserColor(this.#palette.horizon), 1);
      haze.fillRect(0, designHeight * HAZE_TOP_FRACTION, designWidth, HAZE_HEIGHT);
    });
    this.#haze = haze;
  }

  #paintPois(): void {
    const { level } = this.#options;
    for (const poi of level.pois) {
      const y = groundYAt(level.ground, poi.position.x);
      if (this.textures.exists(poi.artKey)) {
        const image = this.add
          .image(poi.position.x, y, poi.artKey)
          .setOrigin(0.5, 1)
          .setDepth(DEPTH_ACTORS - 1);
        this.#actorsDrawn += 1;
        const rect = {
          x: poi.position.x - image.width / 2,
          y: y - image.height,
          width: image.width,
          height: image.height,
        };
        this.#drawnRects.set(poi.id as string, rect);
        this.#artBounds.push({ kind: 'actor', rect });
        continue;
      }
      /* A tower silhouette: tall enough to be framed by TN-LEVEL-04's "fully
         inside the canvas" check, plain enough that nobody files it as art. */
      const mark = this.add.graphics().setDepth(DEPTH_ACTORS - 1);
      this.#repaint(() => {
        mark.clear();
        mark.fillStyle(blendColors(toPhaserColor(this.#palette.horizon), 0x000000, 0.35), 1);
        mark.fillRect(poi.position.x - 90, y - 620, 180, 620);
        mark.fillTriangle(
          poi.position.x - 110,
          y - 620,
          poi.position.x + 110,
          y - 620,
          poi.position.x,
          y - 780,
        );
      });
      /* The placeholder is tappable too. A level whose art has not been packed
         is still a level somebody has to be able to play with a finger. */
      this.#drawnRects.set(poi.id as string, {
        x: poi.position.x - 110,
        y: y - 780,
        width: 220,
        height: 780,
      });
    }
  }

  /**
   * The level's characters, composed from the rig.
   *
   * This drew a rounded rectangle for every character in the game, in
   * production, which meant the red serge — the reference-critical uniform that
   * was the stated reason Ottawa is the first level — was never on screen. The
   * renderer had been written and measured and nothing constructed it.
   *
   * The placeholder is kept for the case it was always for: no rig, or an atlas
   * that has not been packed. What is new is that the two are told apart —
   * `#actorsDrawn` counts the ones that composed from real art, the probe
   * publishes it, and **every fallback prints why** — so "drew the officer" and
   * "drew a rectangle" stop being the same observation.
   */
  #paintCharacters(): void {
    const { level } = this.#options;
    for (const character of level.characters) {
      const id = String(character.characterId);
      const y = groundYAt(level.ground, character.position.x);
      const renderer = this.#composeCharacter(
        id,
        artboardFor(this.#options.rig, id),
        {},
        DEPTH_ACTORS,
      );

      if (renderer !== null) {
        renderer.setFacing(character.facing);
        renderer.setPosition(character.position.x, y);
        /* An NPC stands still and talks when engaged; the rig's own inputs say
           so, and the scene sets them by name rather than choosing a state. */
        this.#driveCharacter(renderer, { grounded: true, moving: false, speed: 0, verticalSpeed: 0 });
        renderer.update(0);
        this.#characters.push(renderer);
        this.#placed.set(id, renderer);
        this.#actorsDrawn += 1;
        const rect = this.#characterRect(character.position.x, y);
        if (rect !== null) {
          this.#drawnRects.set(id, rect);
          this.#artBounds.push({ kind: 'actor', rect });
        }
        continue;
      }

      const actor = this.add.graphics().setDepth(DEPTH_ACTORS);
      actor.fillStyle(blendColors(toPhaserColor(level.palette.ink), 0xffffff, 0.15), 1);
      actor.fillRoundedRect(
        character.position.x - ACTOR_WIDTH / 2,
        y - ACTOR_HEIGHT,
        ACTOR_WIDTH,
        ACTOR_HEIGHT,
        18,
      );
      this.#drawnRects.set(id, {
        x: character.position.x - ACTOR_WIDTH / 2,
        y: y - ACTOR_HEIGHT,
        width: ACTOR_WIDTH,
        height: ACTOR_HEIGHT,
      });
    }
  }

  /**
   * The player, composed from the rig — which is the whole of the "the character
   * is still a rectangle" defect.
   *
   * Every diagnosis of that bug had looked at `#paintCharacters`, because that
   * is where the rig work went. The player was never in it: they are not in
   * `level.characters`, so they were not in `data-actors` either, and the
   * counter added specifically to stop a placeholder shipping unnoticed **could
   * not see the one character on screen at the spawn**. It was not a lookup
   * failing quietly; nothing had ever asked.
   *
   * Which artboard is the player's is a fact about the rig rather than a name in
   * this file — see `character-cast.ts` — so a second playable character is a
   * rig edit and not an engine one.
   */
  #paintPlayer(): void {
    const { level } = this.#options;
    const artboard = playerArtboard(this.#options.rig);
    const renderer = this.#composeCharacter(
      PLAYER_SUBJECT,
      artboard,
      this.#options.playerSkins ?? {},
      DEPTH_ACTORS + 1,
    );

    if (renderer !== null) {
      this.#playerCharacter = renderer;
      renderer.setFacing(this.#state.facing);
      renderer.setPosition(this.#state.x, this.#state.y);
      this.#driveCharacter(renderer, {
        grounded: this.#state.grounded,
        moving: false,
        speed: 0,
        verticalSpeed: 0,
      });
      renderer.update(0);
      return;
    }

    const player = this.add.graphics().setDepth(DEPTH_ACTORS + 1);
    player.fillStyle(toPhaserColor(level.palette.ink), 1);
    player.fillRoundedRect(-ACTOR_WIDTH / 2, -ACTOR_HEIGHT, ACTOR_WIDTH, ACTOR_HEIGHT, 18);
    player.setPosition(this.#state.x, this.#state.y);
    this.#player = player;
  }

  /**
   * One character renderer, or `null` **and a line saying why**.
   *
   * Constructed here, synchronously, because the sprite backend draws *into this
   * scene* and cannot exist before one does, and because `create` is called from
   * `create()` where there is no frame to await in.
   *
   * That is why `createSpriteCharacterRenderer` is called rather than the port's
   * `CharacterRendererFactory.create`: the port is async because a Rive file has
   * to load, and awaiting a promise that is already settled would still cost a
   * microtask and leave the first frame with no character on it. The factory
   * remains the seam bootstrap will pick a backend through — when Rive has an
   * artboard with anything drawn in it, the load moves into `loadLevel` beside
   * the level document and this call site takes the result. **Reported, so it is
   * not discovered:** until then the scene names one backend, which is a
   * deviation from ADR-0005's "bootstrap is the only place concretes are wired"
   * that the measurement (sprite ships, Rive undecided) makes moot rather than
   * resolves.
   *
   * Every `null` below used to be silent. A fallback nobody can observe becomes
   * permanent — that is how a level shipped with no art in it and how every
   * character in the game shipped as a rectangle — so each one now names the
   * subject and the missing thing on the console, in every build.
   */
  #composeCharacter(
    subject: string,
    artboard: RigArtboard | null,
    skins: Readonly<Record<string, string>>,
    depth: number,
  ): ICharacterRenderer | null {
    const rig = this.#options.rig ?? null;
    if (rig === null) return this.#reportCastGap(subject, 'no-rig');
    if (artboard === null) return this.#reportCastGap(subject, 'no-artboard');

    const atlas = this.#rigAtlas(rig);
    if (atlas === null) return this.#reportCastGap(subject, 'no-atlas');

    const spec: CharacterRendererSpec = {
      characterId: artboard.characterId,
      artboard: artboard.artboard,
      stateMachine: artboard.stateMachine,
      rig,
      skins,
      widthPx: rig.characterSpace.width,
      heightPx: rig.characterSpace.height,
    };

    const built = createSpriteCharacterRenderer(spec, {
      textureKey: atlas,
      frames: {
        hasFrame: (key, frame) => this.textures.exists(key) && this.textures.get(key).has(frame),
      },
      host: {
        /* `__DEFAULT` is Phaser's built-in blank texture: the renderer sets the
           real frame on the next line of its own constructor, and an image needs
           *a* texture to exist at all. */
        createPart: (): SpritePartObject => this.add.image(0, 0, '__DEFAULT'),
      },
      baseDepth: depth,
    });
    if (built.ok) return built.value;
    /* The half-packed atlas gets the sentence written for it; anything else —
       an appearance naming an option the rig dropped, a rig with no parts — is
       reported as itself rather than dressed up as a missing atlas. */
    if (built.error.code === 'character.atlas.noParts') {
      return this.#reportCastGap(subject, 'no-parts');
    }
    console.error(
      `[level] "${subject}" is drawn as a placeholder: ${built.error.code}: ${built.error.message}`,
    );
    this.#placeholders += 1;
    return null;
  }

  /**
   * Which loaded texture the rig was packed into, worked out once per level.
   *
   * The lookup is every loaded key against every frame the rig declares, and the
   * answer is the same for every character in the level — so asking it per
   * character was a few thousand texture-manager calls at load for one fact.
   */
  #rigAtlas(rig: RigDocument): string | null {
    if (this.#atlasKey === undefined) {
      this.#atlasKey = rigAtlasKey(rig, this.textures.getTextureKeys(), (key, frame) =>
        this.textures.exists(key) ? this.textures.get(key).has(frame) : false,
      );
    }
    return this.#atlasKey;
  }

  /** Print the gap and answer `null`, so a call site is one line and never silent. */
  #reportCastGap(subject: string, gap: CastGap): null {
    console.error(`[level] ${castGapMessage(subject, gap)}`);
    this.#placeholders += 1;
    return null;
  }

  /** Where a rig-composed character stands, in world space. */
  #characterRect(x: number, groundY: number): TargetRect | null {
    const space = this.#options.rig?.characterSpace;
    if (space === undefined) return null;
    return {
      x: x - space.centreX,
      y: groundY - space.soleY,
      width: space.width,
      height: space.height,
    };
  }

  /**
   * Set the rig inputs this scene can compute, and only the ones the rig
   * declares.
   *
   * Filtered rather than attempted: `setBool`/`setNumber` answer an undeclared
   * input with a `Result` error, and a per-frame caller cannot usefully read
   * one — it would either be dropped (silent, again) or logged sixty times a
   * second. `character-cast.ts` intersects what the scene can compute with what
   * the rig declares, once, at create.
   */
  #driveCharacter(
    renderer: ICharacterRenderer,
    signals: {
      readonly grounded: boolean;
      readonly moving: boolean;
      readonly speed: number;
      readonly verticalSpeed: number;
      readonly talking?: boolean;
    },
  ): void {
    const reduced = this.#profile?.motion === 'reduced';
    for (const name of this.#driven.bools) {
      const value =
        name === 'grounded'
          ? signals.grounded
          : name === 'moving'
            ? signals.moving
            : name === 'talking'
              ? (signals.talking ?? false)
              : reduced;
      renderer.setBool(name, value);
    }
    for (const name of this.#driven.numbers) {
      renderer.setNumber(name, name === 'speed' ? signals.speed : signals.verticalSpeed);
    }
  }

  /* --------------------------------------------------- per-frame character --- */

  /**
   * The player's pose, from the same step the physics just produced.
   *
   * `animationSpeed` is the strategy's own normalised 0..1 — the number
   * `LocomotionAnimationBinding.speedInput` exists to carry — so walking and
   * skating drive the rig identically and differ only in the tuning that
   * produced the number. `verticalSpeed` is negated because screen y grows
   * downwards and the rig's `jump-rise` rule reads "verticalSpeed > 0".
   *
   * Order matters: inputs, then anchor, then `update`. `setPosition` repaints
   * only when the anchor actually moved and `update` repaints once, so a
   * standing character costs one paint per frame and a moving one costs two.
   */
  #updatePlayerCharacter(animationSpeed: number, deltaMs: number): void {
    const player = this.#playerCharacter;
    if (player === null) return;
    this.#driveCharacter(player, {
      grounded: this.#state.grounded,
      moving: Math.abs(this.#state.velocityX) > MOVING_THRESHOLD_PX_S,
      speed: animationSpeed,
      verticalSpeed: -this.#state.velocityY,
    });
    player.setFacing(this.#state.facing);
    player.setPosition(this.#state.x, this.#state.y);
    player.update(deltaMs);
  }

  /**
   * Placed characters, skipped while they are off screen.
   *
   * A puppet's `update` interpolates and re-places twenty parts. Doing that for
   * a character 4 000 design pixels away buys nothing a player can see, and this
   * is the frame budget the perf suite now only *reports* on — so the saving is
   * taken here rather than assumed to be affordable. A character that comes back
   * into view is repainted on the frame it does, because `update` re-derives the
   * pose from elapsed time rather than accumulating it.
   */
  #updatePlacedCharacters(deltaMs: number): void {
    if (this.#characters.length === 0) return;
    const view = this.#cameraRect();
    for (const [id, character] of this.#placed) {
      const rect = this.#drawnRects.get(id);
      if (rect !== undefined && !intersectsView(rect, view)) continue;
      character.update(deltaMs);
    }
  }

  /** The camera's world rectangle right now. */
  #cameraRect(): WorldRect {
    const { level, designWidth, designHeight } = this.#options;
    const scale = this.#backingScale();
    return cameraView(
      this.#camera,
      { width: designWidth * scale, height: designHeight * scale },
      { ...level.camera, zoom: level.camera.zoom * scale },
    );
  }

  /* ------------------------------------------------------------ affordance --- */

  /**
   * Put a mark over everything a finger can engage.
   *
   * The user's report was "we don't know what to click", and it was exactly
   * right: the tap rules worked, the reach rules worked, and nothing on screen
   * said that a person or a landmark was any more touchable than the sky. What
   * is drawn here is the missing half of a control that already existed.
   *
   * The **non-visual equivalent** is already in place and is not duplicated
   * here: the canvas is `aria-hidden`, `poi/entered` and `poi/left` are emitted
   * as reach changes, and `app/ui` speaks them through the live region. What is
   * still missing is the *wording* for a prompt — `hud.interact.*` does not
   * exist — and inventing player-facing copy in an adapter is not this
   * directory's to do (ADR-0010). The keys needed are named in the task report.
   */
  #buildAffordances(): void {
    /*
     * One repaintable for the whole set, not one per mark.
     *
     * A closure per mark would capture an object the next refresh may have
     * destroyed, and `#repaintables` would grow every time the set changed —
     * a leak whose symptom is a draw call on a dead Graphics at dusk. One
     * closure over the live map has neither problem.
     */
    this.#repaint(() => {
      for (const entry of this.#marks.values()) this.#drawMark(entry.object, entry.mark);
    });
    this.#refreshAffordances();
  }

  /** Everything engageable, as the affordance module wants it. */
  #affordanceSubjects(): readonly AffordanceSubject[] {
    return this.#reachTargets.map((target) => ({
      id: target.id,
      npc: target.npc,
      position: target.position,
      rect: target.rect,
    }));
  }

  /**
   * Recompute every mark's state and redraw the ones that changed.
   *
   * Called when reach changes and when the domain reports something finished —
   * not every frame. The only per-frame work an affordance costs is
   * {@link #updateAffordances}, which is a scale and a visibility flag.
   */
  #refreshAffordances(): void {
    const marks = affordanceMarks(this.#affordanceSubjects(), {
      playerX: this.#state.x,
      reachPx: this.#reachPx(),
      minTouchPx: this.#minTouchWorldPx(),
      completed: this.#completed,
    });

    const live = new Set(marks.map((mark) => mark.id));
    for (const [id, entry] of this.#marks) {
      if (!live.has(id)) {
        entry.object.destroy();
        this.#marks.delete(id);
      }
    }

    for (const mark of marks) {
      const existing = this.#marks.get(mark.id);
      if (existing === undefined) {
        const object = this.add.graphics().setDepth(DEPTH_AFFORDANCE);
        object.setPosition(mark.x, mark.y);
        const entry = { object, mark };
        this.#marks.set(mark.id, entry);
        this.#drawMark(object, mark);
        continue;
      }
      if (existing.mark.state === mark.state && existing.mark.size === mark.size) {
        existing.mark = mark;
        existing.object.setPosition(mark.x, mark.y);
        continue;
      }
      existing.mark = mark;
      existing.object.setPosition(mark.x, mark.y);
      this.#drawMark(existing.object, mark);
    }
  }

  /**
   * One mark, as three shapes that differ in **shape**.
   *
   * `idle` is an empty ring, `ready` adds a filled centre and a chevron pointing
   * down at the subject, `done` replaces the centre with a stamp. CLAUDE.md:
   * colour is never the only signal, and a player who cannot separate the two
   * ring colours can still separate a ring from a ring with an arrow under it.
   *
   * A dark halo is stroked under every one of them so the mark reads against a
   * bright sky and a dark landmark alike, which is the same problem the high
   * contrast requirement names.
   */
  #drawMark(object: Phaser.GameObjects.Graphics, mark: AffordanceMark): void {
    const radius = mark.size * 0.34;
    const bright = blendColors(toPhaserColor(this.#palette.horizon), 0xffffff, 0.3);
    const muted = toPhaserColor(this.#palette.inkMuted);
    const halo = toPhaserColor(this.#palette.ink);

    object.clear();
    object.lineStyle(10, halo, 0.3);
    object.strokeCircle(0, 0, radius);

    if (mark.state === 'idle') {
      object.lineStyle(5, bright, 0.7);
      object.strokeCircle(0, 0, radius);
      object.setScale(1);
      return;
    }
    if (mark.state === 'done') {
      object.lineStyle(5, muted, 0.9);
      object.strokeCircle(0, 0, radius);
      object.fillStyle(muted, 0.95);
      object.fillRect(-radius * 0.42, -radius * 0.42, radius * 0.84, radius * 0.84);
      object.setScale(1);
      return;
    }

    object.lineStyle(7, bright, 1);
    object.strokeCircle(0, 0, radius);
    object.fillStyle(bright, 1);
    object.fillCircle(0, 0, radius * 0.34);
    /* The chevron points at the thing, so a mark over a crowd is unambiguous. */
    object.fillTriangle(-radius * 0.5, radius * 0.78, radius * 0.5, radius * 0.78, 0, radius * 1.4);
  }

  /**
   * The only per-frame cost an affordance has: a scale and a visibility flag.
   *
   * The pulse is `markPulse`, which returns exactly 1 under reduced motion — so
   * reduced motion is a branch that does nothing rather than a slower animation
   * (CLAUDE.md). Marks outside the camera are hidden rather than scaled, which
   * also keeps them out of the overdraw budget.
   */
  #updateAffordances(): void {
    if (this.#marks.size === 0) return;
    const view = this.#cameraRect();
    const reduced = this.#profile?.motion === 'reduced';
    const pulse = markPulse(this.#elapsedMs, reduced);

    for (const entry of this.#marks.values()) {
      const half = entry.mark.size / 2;
      const visible = intersectsView(
        { x: entry.mark.x - half, y: entry.mark.y - half, width: entry.mark.size, height: entry.mark.size },
        view,
      );
      entry.object.setVisible(visible);
      if (!visible) continue;
      if (entry.mark.state === 'ready') entry.object.setScale(pulse);
    }
  }

  /** How many things are advertised as tappable, and how many are in reach. */
  #affordanceCounts(): { affordances: number; affordancesReady: number } {
    let ready = 0;
    for (const entry of this.#marks.values()) {
      if (entry.mark.state === 'ready') ready += 1;
    }
    return { affordances: this.#marks.size, affordancesReady: ready };
  }

  /* ------------------------------------------------------------ milestones --- */

  /**
   * The domain finished a quest. Make the world show it.
   *
   * Inbound, because nothing in an adapter knows what a quest is: the scene is
   * told, and what it owns is the world's half — the subject stops asking to be
   * tapped — and the ordering, which the probe's event trace records so
   * `poi/engaged` before `quest/completed` is a fact a test can hold.
   *
   * An id nothing in this level matches is **still published**. The fact
   * happened; dropping it would be the silent-fallback defect again, so it is
   * logged and passed on rather than swallowed.
   */
  markCompleted(subjectId: string): void {
    if (this.#completed.has(subjectId)) return;
    const known = this.#reachTargets.some((target) => target.id === subjectId);
    if (!known) {
      console.error(
        `[level] a quest completed for "${subjectId}", which this level places no point of ` +
          `interest or character for. The milestone is still published; nothing in the world ` +
          `changes, because there is nothing to change.`,
      );
    }
    this.#completed.add(subjectId);
    this.#refreshAffordances();
    this.#emitMilestone('quest/completed', subjectId);
  }

  /**
   * The level's stamp was earned.
   *
   * Every remaining subject settles to `done`: the stamp is the level's, so
   * after it there is nothing left in this level asking to be done, and a ring
   * still pulsing at the player would be the game asking for something it has
   * already given them credit for. The screen that announces the stamp and the
   * level it opened is `app/ui`'s.
   *
   * Idempotent, because a stamp can only be earned once and a repeated call is a
   * bootstrap wiring mistake rather than a second event.
   */
  markLevelComplete(): void {
    if (this.#levelComplete) return;
    this.#levelComplete = true;
    for (const target of this.#reachTargets) this.#completed.add(target.id);
    this.#refreshAffordances();
    this.#emitMilestone('level/completed', this.#options.level.id);
  }

  #emitMilestone(name: SceneMilestoneName, detail: string): void {
    this.#options.probe?.recordEvent(name, detail);
    this.#options.onMilestone?.(name, detail);
  }

  /* -------------------------------------------------------- time of day --- */

  /**
   * Re-read the device clock every few seconds and let the sky follow it.
   *
   * A timer rather than per-frame work: the phase moves by 6e-5 of a day in five
   * seconds, most refreshes produce the same 8-bit colours, and a refresh that
   * changes nothing costs five blends and a string compare. Nothing here touches
   * a texture, so the decoded-texture budget is unaffected, and nothing here adds
   * a draw, so the tier is measuring the same frame it measured before.
   */
  #startSkyClock(): void {
    this.#skyClock = this.time.addEvent({
      delay: PHASE_REFRESH_MS,
      loop: true,
      callback: this.#tickSky,
    });
  }

  readonly #tickSky = (): void => {
    const target = dayPhase(this.#clock());
    const next = easePhase(this.#phase, target, MAX_PHASE_STEP);
    if (next === this.#phase) return;
    this.#phase = next;

    const palette = tintPalette(this.#options.level.palette, { phase: next });
    if (
      palette.sky === this.#palette.sky &&
      palette.ground === this.#palette.ground &&
      palette.horizon === this.#palette.horizon
    ) {
      /* The phase moved and no channel did. Nothing to redraw, which is the
         common case: this is why the tint costs nothing to keep running. */
      this.#options.probe?.publish({ dayPhase: next });
      return;
    }

    this.#palette = palette;
    for (const draw of this.#repaintables) draw();
    this.#options.probe?.publish({ dayPhase: next });
  };

  /* ----------------------------------------------------------------- snow --- */

  #buildSnow(): void {
    this.#snowGraphics = this.add.graphics().setScrollFactor(0, 0).setDepth(DEPTH_SNOW);
  }

  /**
   * Deterministic seeding, and only as many flakes as the tier allows.
   *
   * Seeded from the index rather than `Math.random` so a screenshot of the same
   * level at the same tier is the same picture, which is what makes task 1.18's
   * device screenshots comparable at all.
   */
  #seedFlakes(quantity: number): void {
    const { designWidth, designHeight } = this.#options;
    this.#flakes = Array.from({ length: quantity }, (_unused, index) => {
      const a = ((index * 9301 + 49297) % 233280) / 233280;
      const b = ((index * 4523 + 12345) % 65521) / 65521;
      return {
        x: a * designWidth,
        y: b * designHeight,
        radius: FLAKE_MIN_RADIUS + a * (FLAKE_MAX_RADIUS - FLAKE_MIN_RADIUS),
        speed: 60 + b * 120,
        drift: (a - 0.5) * 40,
      };
    });
  }

  #updateSnow(dtSeconds: number): void {
    const graphics = this.#snowGraphics;
    if (graphics === null || this.#flakes.length === 0) return;

    const { designWidth, designHeight } = this.#options;
    graphics.clear();
    graphics.fillStyle(0xffffff, 0.75);
    for (const flake of this.#flakes) {
      flake.y += flake.speed * dtSeconds;
      flake.x += flake.drift * dtSeconds;
      if (flake.y > designHeight) flake.y -= designHeight;
      if (flake.x < 0) flake.x += designWidth;
      if (flake.x > designWidth) flake.x -= designWidth;
      graphics.fillCircle(flake.x, flake.y, flake.radius);
    }
  }
}
