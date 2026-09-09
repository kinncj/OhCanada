import Phaser from 'phaser';

import type {
  CharacterRendererSpec,
  ICharacterRenderer,
  LocomotionIntent,
  LocomotionState,
  LocomotionTuning,
  RigDocument,
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
import type { SceneEventListener, SceneEventName } from './level-events';
import {
  createSpriteCharacterRenderer,
  type SpritePartObject,
} from './sprite-character-renderer';
import { cameraView, followCamera, intersectsView, type WorldRect } from './level-camera';
import type { SceneLevel } from './level-document';
import { MAX_STEP_SECONDS, applyBounds, createLocomotion } from './locomotion';
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

/** Depth slots. Layers sit between the sky and the ground; actors above both. */
const DEPTH_SKY = 0;
const DEPTH_LAYERS = 100;
const DEPTH_GROUND = 400;
const DEPTH_ACTORS = 500;
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
  readonly #locomotion: ReturnType<typeof createLocomotion>;
  readonly #tuning: LocomotionTuning;
  readonly #bounds: LevelBounds;

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
  #reachTargets: readonly { readonly id: string; readonly position: Vec2; readonly npc: boolean }[] =
    [];
  #jumpQueued = false;
  #interactQueued = false;
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

    this.#bindInput();
    this.applyProfile(this.#profile);

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
      ...this.#visibleArt(),
    });
    this.#emit('level/ready', level.id);
    this.#options.onReady?.(level.id);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#options.marker?.hide();
      this.#ready = false;
      /* Every character releases its parts before the level goes; the atlas is
         the texture manager's and is dropped by the unload path, not here. */
      for (const character of this.#characters) character.dispose();
      this.#characters = [];
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

    this.#player?.setPosition(this.#state.x, this.#state.y);
    for (const character of this.#characters) character.update(delta);
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
        ...this.#visibleArt(),
      });
    }
  }

  /* ---------------------------------------------------------------- input --- */

  #bindInput(): void {
    const keyboard = this.input.keyboard;
    keyboard?.addCapture(['LEFT', 'RIGHT', 'UP', 'DOWN', 'SPACE']);

    /* A tap on the play area is a jump — one-thumb traversal, and the story is
       explicit that a tap away from an NPC or a POI hops rather than doing
       nothing. Queued rather than acted on, so input is read once per frame and
       a fast double tap cannot inject two steps into one frame. */
    this.input.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.#jumpQueued = true;
    });
  }

  #sampleIntent(): LocomotionIntent {
    const keyboard = this.input.keyboard;
    /* `enableCapture: false`: the page keeps its own key handling, so a DOM
       screen above the canvas is never starved of a keystroke. */
    const down = (key: string): boolean => keyboard?.addKey(key, false).isDown ?? false;

    /* Two bindings per action, arrows and the WASD block, so the level is
       playable with either hand. These are Phaser key names and therefore
       `keyCode`-based; `InputPort` binds by `KeyboardEvent.code` — physical
       position — and replacing this reader with it (task 1.15) is what makes
       TN-LEVEL-06's AZERTY scenario true rather than nearly true. */
    const left = down('LEFT') || down('A');
    const right = down('RIGHT') || down('D');
    const jumpHeld = down('SPACE') || down('UP') || down('W');
    const interact = down('E') || down('ENTER');

    const jumpPressed = this.#jumpQueued || (jumpHeld && !this.#lastJumpHeld);
    this.#lastJumpHeld = jumpHeld;
    this.#jumpQueued = false;

    const interactPressed = this.#interactQueued || (interact && !this.#lastInteract);
    this.#lastInteract = interact;
    this.#interactQueued = false;

    const move = (left ? -1 : 0) + (right ? 1 : 0);
    return {
      move,
      jumpPressed,
      jumpHeld,
      interactPressed,
      slope: slopeAt(this.#options.level.ground, this.#state.x),
      groundY: groundYAt(this.#options.level.ground, this.#state.x),
    };
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
    this.#reachTargets = [
      ...level.pois.map((poi) => ({ id: poi.id as string, position: poi.position, npc: false })),
      ...level.characters.map((character) => ({
        id: character.characterId as string,
        position: character.position,
        npc: true,
      })),
    ];
  }

  #reachPx(): number {
    return this.#tuning.interaction?.reachPx ?? 0;
  }

  #updateReach(): void {
    const reach = this.#reachPx();
    for (const target of this.#reachTargets) {
      const near = Math.abs(target.position.x - this.#state.x) <= reach;
      const was = this.#inReach.has(target.id);
      if (near && !was) {
        this.#inReach.add(target.id);
        this.#emit('poi/entered', target.id);
      } else if (!near && was) {
        this.#inReach.delete(target.id);
        this.#emit('poi/left', target.id);
      }
    }
  }

  #engageNearest(): void {
    const reach = this.#reachPx();
    let best: { id: string; npc: boolean; distance: number } | null = null;
    for (const target of this.#reachTargets) {
      const distance = Math.abs(target.position.x - this.#state.x);
      if (distance > reach) continue;
      if (best === null || distance < best.distance) {
        best = { id: target.id, npc: target.npc, distance };
      }
    }
    if (best === null) return;
    this.#emit(best.npc ? 'npc/engaged' : 'poi/engaged', best.id);
  }

  /* --------------------------------------------------------------- drawing -- */

  #paintSky(): void {
    const { level, designWidth, designHeight } = this.#options;
    const graphics = this.add.graphics().setScrollFactor(0, 0).setDepth(DEPTH_SKY);
    const bandHeight = designHeight / GRADIENT_BANDS;

    for (let band = 0; band < GRADIENT_BANDS; band += 1) {
      const position = band / (GRADIENT_BANDS - 1);
      graphics.fillStyle(mixColor(level.palette.sky, level.palette.ground, position), 1);
      graphics.fillRect(0, Math.floor(band * bandHeight), designWidth, Math.ceil(bandHeight) + 1);
    }
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
      /* Far bands sit close to the sky, near ones close to the ground: the same
         aerial perspective an atlas would paint, expressed in two theme colours
         so the placeholder cannot clash with the level it stands in for. */
      const colour = blendColors(
        toPhaserColor(level.palette.sky),
        toPhaserColor(level.palette.ground),
        0.25 + shade * 0.7,
      );
      band.fillStyle(colour, 1);
      band.fillRect(0, layer.offset.y, level.size.x, PLACEHOLDER_BAND_HEIGHT);
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
    const surface = blendColors(toPhaserColor(level.palette.ground), 0x000000, 0.06);

    ground.fillStyle(surface, 1);
    this.#fillUnder(ground, level.ground, () => level.size.y);

    ground.lineStyle(6, toPhaserColor(level.palette.horizon), 0.9);
    ground.beginPath();
    level.ground.forEach((point, index) => {
      if (index === 0) ground.moveTo(point.x, point.y);
      else ground.lineTo(point.x, point.y);
    });
    ground.strokePath();
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
    sheen.fillStyle(toPhaserColor(level.palette.horizon), 1);
    this.#fillUnder(sheen, level.ground, (point) => point.y + SHEEN_DEPTH);
    this.#sheen = sheen;

    const haze = this.add.graphics().setScrollFactor(0, 0).setDepth(DEPTH_LAYERS - 1);
    haze.fillStyle(toPhaserColor(level.palette.horizon), 1);
    haze.fillRect(0, designHeight * HAZE_TOP_FRACTION, designWidth, HAZE_HEIGHT);
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
        this.#artBounds.push({
          kind: 'actor',
          rect: {
            x: poi.position.x - image.width / 2,
            y: y - image.height,
            width: image.width,
            height: image.height,
          },
        });
        continue;
      }
      /* A tower silhouette: tall enough to be framed by TN-LEVEL-04's "fully
         inside the canvas" check, plain enough that nobody files it as art. */
      const mark = this.add.graphics().setDepth(DEPTH_ACTORS - 1);
      mark.fillStyle(blendColors(toPhaserColor(level.palette.horizon), 0x000000, 0.35), 1);
      mark.fillRect(poi.position.x - 90, y - 620, 180, 620);
      mark.fillTriangle(poi.position.x - 110, y - 620, poi.position.x + 110, y - 620, poi.position.x, y - 780);
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
   * `#actorsDrawn` counts the ones that composed from real art and the probe
   * publishes it, so "drew the officer" and "drew a rectangle" stop being the
   * same observation.
   */
  #paintCharacters(): void {
    const { level } = this.#options;
    for (const character of level.characters) {
      const y = groundYAt(level.ground, character.position.x);
      const renderer = this.#createCharacter(String(character.characterId), DEPTH_ACTORS);

      if (renderer !== null) {
        renderer.setFacing(character.facing);
        renderer.setPosition(character.position.x, y);
        /* An NPC stands still and talks when engaged; the rig's own inputs say
           so, and the scene sets them by name rather than choosing a state. */
        renderer.setBool('grounded', true);
        renderer.update(0);
        this.#characters.push(renderer);
        this.#actorsDrawn += 1;
        const space = this.#options.rig?.characterSpace;
        if (space !== undefined) {
          this.#artBounds.push({
            kind: 'actor',
            rect: {
              x: character.position.x - space.centreX,
              y: y - space.soleY,
              width: space.width,
              height: space.height,
            },
          });
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
    }
  }

  /**
   * One character renderer, or `null` when there is nothing to compose from.
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
   */
  #createCharacter(id: string, depth: number): ICharacterRenderer | null {
    const rig = this.#options.rig ?? null;
    if (rig === null) return null;

    const artboard = rig.artboards.find((candidate) => String(candidate.characterId) === id);
    if (artboard === undefined) return null;

    /*
     * No atlas carrying this rig's frames means no parts, and a character with
     * no parts is not a character — it is an empty renderer that would still
     * report itself constructed and on screen. That is the hole this whole line
     * of work is closing, so it is refused here and the placeholder is drawn
     * instead, visibly and countably.
     */
    const atlas = this.#characterAtlasKey(rig);
    if (atlas === '') return null;

    const spec: CharacterRendererSpec = {
      characterId: artboard.characterId,
      artboard: artboard.artboard,
      stateMachine: artboard.stateMachine,
      rig,
      skins: {},
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
    console.error(`[level] ${built.error.code}: ${built.error.message}`);
    return null;
  }

  /**
   * Which atlas the rig's frames were packed into.
   *
   * Derived from a frame the rig declares rather than named here: the packer
   * decides the atlas key and this file may not know a level's or a rig's
   * vocabulary. The first atlas that carries the rig's first frame is the one.
   */
  #characterAtlasKey(rig: RigDocument): string {
    const first = Object.keys(rig.frames)[0];
    if (first === undefined) return '';
    for (const key of this.textures.getTextureKeys()) {
      if (this.textures.get(key).has(first)) return key;
    }
    return '';
  }

  #paintPlayer(): void {
    const { level } = this.#options;
    const player = this.add.graphics().setDepth(DEPTH_ACTORS + 1);
    player.fillStyle(toPhaserColor(level.palette.ink), 1);
    player.fillRoundedRect(-ACTOR_WIDTH / 2, -ACTOR_HEIGHT, ACTOR_WIDTH, ACTOR_HEIGHT, 18);
    player.setPosition(this.#state.x, this.#state.y);
    this.#player = player;
  }

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
