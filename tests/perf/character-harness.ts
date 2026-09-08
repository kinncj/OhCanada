/**
 * The measurement task 1.12 is actually asking for: **what does one character
 * cost, in engine time, on a real GPU path.**
 *
 * `docs/plan/slice-1.md` records the risk in its own words — *"If ≤ 1.5 ms per
 * character does not hold on an iPhone, the sprite-sheet fallback ships and Rive
 * waits. Decide with a measurement."* So the measurement is the deliverable, and
 * it is built the way `app/adapters/phaser/frame-cost.ts` was built, for the
 * reason ADR-0011 records at length:
 *
 * > A `requestAnimationFrame` delta is vsync-locked. On a 60 Hz display the
 * > interval is pinned near 16.7 ms whether the GPU is idle or saturated, so an
 * > interval-only probe reports the same number for a machine with 90 % headroom
 * > and one with 2 %.
 *
 * A per-character cost read off rAF intervals would therefore be ~0 ms per
 * character right up until the moment it was ~16 ms, which is not a measurement,
 * it is a threshold detector with no useful range. What is sampled here instead
 * is **engine work**: `POST_RENDER now` minus `PRE_STEP now`, the same two Phaser
 * events `frame-cost.ts` uses, through the same `createFrameTimer` and
 * `createFrameCostRecorder` — warm-up discard, median rather than mean, p95 kept
 * beside it. Not a copy of that logic: the same modules, imported.
 *
 * Per-character cost is then a **subtraction**:
 *
 *     perCharacterMs = (costP50 with N characters - costP50 with 0) / N
 *
 * because this harness runs on SwiftShader in CI, where an empty scene already
 * costs a meaningful slice of a frame. Without the baseline the number would be
 * a measurement of the rasteriser, not of the character. ADR-0011's consequence
 * applies unchanged: **the tier the number was measured at travels with it**, and
 * this harness reports the renderer Phaser built alongside every summary.
 *
 * ## What each mode measures
 *
 * `?backend=sprite` — the real `createSpriteCharacterRendererFactory`, drawing
 * real parts from a real atlas through Phaser's texture manager. This is the
 * shipping cost of the fallback.
 *
 * `?backend=rive-floor` — the **real** Rive runtime, through the real adapter and
 * the real `@rive-app/canvas` binding, driving `assets/style/rig-contract.riv`.
 * That file is a valid Rive file: both artboards, both `motion` state machines,
 * all nine declared inputs at their declared types. It carries **no drawable
 * content**, and the art agent kept it that way deliberately — *"an empty
 * artboard advances in near-zero time; measuring it would pass comfortably and
 * mean nothing, and Rive would be adopted on a measurement of an empty file."*
 *
 * So this mode is named for what it is. It measures the runtime's **fixed
 * overhead**: instantiating the artboard and state machine, `advanceAndApply`
 * every frame, the canvas surface, and the per-frame GPU upload of that surface.
 * Every one of those costs is paid whatever the rig contains, and the vector
 * rasterisation of real art is *on top of it*. It is a **floor**, it is reported
 * as a floor, and a number from it may never be quoted as "Rive costs X per
 * character". `rive-floor` under budget does not mean Rive is under budget; only
 * `rive-floor` *over* budget would settle anything, and that would settle it
 * against Rive.
 *
 * ## Why this is a harness and not the game
 *
 * The e2e and perf suites drive the production artefact on purpose (ADR-0006),
 * and this page is not in it. The reason is the one the a11y harness gives:
 * characters are not placed in a level yet — task 1.13 does that when the atlas
 * lands — so measuring them through `dist/` would mean measuring nothing at all.
 * This page imports the same adapter modules the game imports, through the same
 * Vite config and the same aliases, and it goes away when a level draws
 * characters for real.
 */

import Phaser from 'phaser';

import {
  createFrameCostRecorder,
  createFrameTimer,
  type FrameCostSummary,
} from '@adapters/phaser/frame-cost';
import {
  createSpriteCharacterRenderer,
  type SpritePartObject,
} from '@adapters/phaser/sprite-character-renderer';
import { createRiveCharacterRendererFactory } from '@adapters/rive';
import { createBrowserRiveRuntime } from '@adapters/rive/rive-runtime';
import type { CharacterRendererSpec, ICharacterRenderer, RigDocument } from '@application/ports';
import rigJson from '@content/characters/rig.json';

/**
 * The real rig, so the number is about the character that ships.
 *
 * This harness measured a four-layer stand-in while the renderer was a flipbook.
 * The rig is a **twenty-part cut-out puppet** and the shipped figure composes
 * from all twenty, so a four-layer measurement understated draw calls by 5x. It
 * reads `content/characters/rig.json` — tracked content, not build output, so
 * this runs on a clean checkout.
 */
const RIG = rigJson as unknown as RigDocument;
import type { CharacterId } from '@domain/ids';

/*
 * The rig fixture, by URL rather than by import: it is a binary the bundler has
 * no loader for, and `?url` is how Vite hands one over. It lives in
 * `assets/style/` and NOT in `assets/src/rive/`, which is the mechanical reason
 * `make assets` cannot emit it and nothing can mistake it for a character.
 */
import rigContractUrl from '../../assets/style/rig-contract.riv?url';

/** The design resolution, from `content/game.config.json`. Portrait, always. */
const DESIGN_WIDTH = 1080;
const DESIGN_HEIGHT = 1920;

/**
 * Character space, from `assets/style/rig-contract.json`: 240 x 470 design
 * pixels, a six-head figure 420 px tall. Both modes draw at this size, because
 * a per-character cost measured at a different size is a measurement of a
 * different character.
 */
const CHARACTER_WIDTH = RIG.characterSpace.width;
const CHARACTER_HEIGHT = RIG.characterSpace.height;

/** How many frames of warm-up and how many are measured per window. */
const WARMUP_FRAMES = 30;
const WINDOW_FRAMES = 60;

/**
 * One closed window, plus the one statistic `frame-cost.ts` deliberately does
 * not carry.
 *
 * `FrameCostSummary` reports a **median** because ADR-0011 chose one: a single
 * 400 ms GC pause moves a 30-sample mean by 13 ms and would demote a healthy
 * device a whole tier, and it moves the median by nothing. That is the right
 * choice for a *tier decision* and the wrong one for *this* measurement, for a
 * reason that only shows up at this magnitude: Chromium clamps
 * `performance.now()` to 100 microseconds, so every individual frame cost is a
 * multiple of 0.1 ms and a median is always exactly one of those multiples. Six
 * sprite characters cost less than one tick, and the median can only report "one
 * tick" or "zero".
 *
 * The mean over a 60-frame window has no such floor: the clamping error is
 * roughly uniform and averages down with the window size, so it resolves well
 * below the tick. It is used for the per-character arithmetic, and `costP50`,
 * `costP95` and `worstCostMs` are reported beside it so that a mean pulled up by
 * a GC pause is visible rather than hidden — which is the objection ADR-0011
 * raised, answered by reporting both instead of choosing.
 */
export interface CostWindow extends FrameCostSummary {
  readonly meanCostMs: number;
}

export interface CostReport {
  readonly backend: string;
  readonly characters: number;
  readonly renderer: string;
  /** Closed measurement windows, oldest first. */
  readonly windows: readonly CostWindow[];
  /** Layers actually drawn per character, so overdraw can be checked against it. */
  readonly layersPerCharacter: number;
}

const params = new URLSearchParams(window.location.search);
const characterCount = Math.max(0, Number(params.get('n') ?? '0'));
const backend = params.get('backend') ?? 'sprite';

/* -------------------------------------------------------------------------- */
/* the rig the harness draws                                                  */
/* -------------------------------------------------------------------------- */

/** The officer, composed from the rig exactly as `level-scene.ts` composes it. */
function specFor(index: number): CharacterRendererSpec {
  const artboard = RIG.artboards[index % RIG.artboards.length];
  return {
    characterId: (artboard?.characterId ?? 'officer') as CharacterId,
    artboard: artboard?.artboard ?? 'officer',
    stateMachine: RIG.stateMachine.name,
    rig: RIG,
    skins: {},
    widthPx: CHARACTER_WIDTH,
    heightPx: CHARACTER_HEIGHT,
  };
}

/* -------------------------------------------------------------------------- */
/* the scene                                                                  */
/* -------------------------------------------------------------------------- */

class CostScene extends Phaser.Scene {
  static readonly KEY = 'cost';

  #characters: ICharacterRenderer[] = [];
  #surfaces: Phaser.Textures.CanvasTexture[] = [];

  constructor() {
    super({ key: CostScene.KEY });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0d2135);

    if (backend === 'rive-floor') this.#buildRiveFloor();
    else this.#buildSprites();
  }

  /**
   * The sprite path: one atlas, twenty parts per character, composed and
   * animated through the shipping adapter and the shipping rig.
   */
  #buildSprites(): void {
    const atlasKey = 'harness-atlas';
    buildAtlas(this, atlasKey);

    for (let index = 0; index < characterCount; index += 1) {
      const built = createSpriteCharacterRenderer(specFor(index), {
        textureKey: atlasKey,
        frames: { hasFrame: (key, frame) => this.textures.get(key).has(frame) },
        host: {
          createPart: (): SpritePartObject => this.add.image(0, 0, atlasKey),
        },
        baseDepth: index * RIG.parts.length,
      });
      if (!built.ok) throw new Error(`${built.error.code}: ${built.error.message}`);

      /* Walking, and spread across the portrait canvas so the draws do not all
         land on the same pixels — overlapping quads would be measured once by
         the rasteriser's early-out and would understate the cost. */
      built.value.setBool('grounded', true);
      built.value.setBool('moving', true);
      built.value.setNumber('speed', 0.7);
      built.value.setPosition(
        ((index + 0.5) / Math.max(1, characterCount)) * DESIGN_WIDTH,
        DESIGN_HEIGHT * 0.7,
      );
      this.#characters.push(built.value);
    }
  }

  /**
   * The Rive floor: the real runtime, the real binding, the real adapter, and a
   * rig with no drawable content. See the header for what this number is and is
   * not allowed to be quoted as.
   *
   * `createSurface` is the seam that makes the upload real: the runtime draws
   * into a canvas *this scene* registered with Phaser's texture manager, so
   * `refresh()` below is the same per-frame upload a level would pay.
   */
  #buildRiveFloor(): void {
    const factory = createRiveCharacterRendererFactory({
      runtime: createBrowserRiveRuntime({
        locate: () => rigContractUrl,
        createSurface: (request) => {
          const canvas = document.createElement('canvas');
          canvas.width = request.widthPx;
          canvas.height = request.heightPx;
          const texture = this.textures.addCanvas(request.textureKey, canvas);
          if (texture !== null) this.#surfaces.push(texture);
          return canvas;
        },
      }),
    });

    for (let index = 0; index < characterCount; index += 1) {
      const spec: CharacterRendererSpec = { ...specFor(index), artboard: 'officer' };
      void factory.create(spec).then((created) => {
        if (!created.ok) throw new Error(`${created.error.code}: ${created.error.message}`);
        created.value.setBool('moving', true);
        created.value.setNumber('speed', 0.7);
        this.#characters.push(created.value);

        const image = this.add.image(
          ((index + 0.5) / Math.max(1, characterCount)) * DESIGN_WIDTH,
          DESIGN_HEIGHT * 0.6,
          created.value.surface.textureKey,
        );
        image.setDisplaySize(CHARACTER_WIDTH, CHARACTER_HEIGHT);
      });
    }
  }

  override update(_time: number, delta: number): void {
    /* The renderer advances and rasterises; on the Rive path that is
       `advanceAndApply` plus the artboard draw into the canvas below. */
    for (const character of this.#characters) character.update(delta);

    /* The per-frame GPU upload of each Rive surface. Half the floor, and the
       half no texture-memory gate can see, because it is sized by the display
       rather than by a file. */
    for (const surface of this.#surfaces) surface.refresh();
  }
}

/**
 * Build the atlas the sprite backend reads, at runtime.
 *
 * Every frame is registered under the name the **rig** declares and at the size
 * the rig declares, so the adapter's frame table, its pivot-to-origin
 * arithmetic and the area each part covers are all real. What is not real is the
 * picture inside them: the cost being measured is the per-part draw and the
 * per-frame transform, and fifty distinct images would measure an upload that
 * happens once.
 */
function buildAtlas(scene: Phaser.Scene, key: string): void {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (context !== null) {
    context.fillStyle = '#f4d35e';
    context.fillRect(0, 0, 256, 256);
    context.fillStyle = '#0d2135';
    context.fillRect(16, 16, 96, 96);
  }
  const texture = scene.textures.addCanvas(key, canvas);
  if (texture === null) return;

  for (const [name, window] of Object.entries(RIG.frames)) {
    texture.add(name, 0, 0, 0, Math.max(1, window.w), Math.max(1, window.h));
  }
}

/* -------------------------------------------------------------------------- */
/* the probe                                                                  */
/* -------------------------------------------------------------------------- */

const timer = createFrameTimer();
const recorder = createFrameCostRecorder({
  warmupFrames: WARMUP_FRAMES,
  windowFrames: WINDOW_FRAMES,
});
const windows: CostWindow[] = [];
/** Raw per-frame costs of the window being filled, for the mean above. */
let pendingCosts: number[] = [];

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  banner: false,
  backgroundColor: '#0d2135',
  pixelArt: false,
  antialias: true,
  audio: { noAudio: true },
  dom: { createContainer: false },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    expandParent: false,
    autoRound: true,
  },
  render: { powerPreference: 'high-performance' },
  scene: [new CostScene()],
});

game.events.on(Phaser.Core.Events.PRE_STEP, () => {
  timer.begin(performance.now());
});
game.events.on(Phaser.Core.Events.POST_RENDER, () => {
  const sample = timer.end(performance.now());
  if (sample === null) return;
  /* Read before `record`, which is what consumes a warm-up frame. */
  const measured = recorder.warmupRemaining === 0;
  const summary = recorder.record(sample);
  if (measured) pendingCosts.push(sample.costMs);
  if (summary === null) return;
  const total = pendingCosts.reduce((sum, cost) => sum + cost, 0);
  windows.push({
    ...summary,
    meanCostMs: pendingCosts.length === 0 ? 0 : total / pendingCosts.length,
  });
  pendingCosts = [];
});

function rendererName(): string {
  const type = (game.renderer as { type?: number } | null | undefined)?.type;
  if (type === Phaser.WEBGL) return 'webgl';
  if (type === Phaser.CANVAS) return 'canvas';
  return 'unknown';
}

/**
 * What `page.evaluate` reads. A harness, so a control surface is fine here in a
 * way it explicitly is not in the game (ADR-0011: the `?e2e=1` probe opens
 * nothing but observation). This page is never in `dist/`.
 */
(window as unknown as Record<string, unknown>)['__tnCharacterCost'] = (): CostReport => ({
  backend,
  characters: characterCount,
  renderer: rendererName(),
  windows: [...windows],
  layersPerCharacter: backend === 'rive-floor' ? 1 : RIG.parts.length,
});
