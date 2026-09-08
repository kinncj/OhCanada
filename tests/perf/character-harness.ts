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
  createSpriteCharacterRendererFactory,
  spriteFrameName,
  type SpriteLayerObject,
} from '@adapters/phaser/sprite-character-renderer';
import { createRiveCharacterRendererFactory } from '@adapters/rive';
import { createBrowserRiveRuntime } from '@adapters/rive/rive-runtime';
import type {
  CharacterInput,
  CharacterRendererSpec,
  ICharacterRenderer,
} from '@application/ports';
import type { CharacterId } from '@domain/ids';

/*
 * The rig fixture, by URL rather than by import: it is a binary the bundler has
 * no loader for, and `?url` is how Vite hands one over. It lives in
 * `assets/style/` and NOT in `assets/src/rive/`, which is the mechanical reason
 * `make assets` cannot emit it and nothing can mistake it for a character.
 */
import rigContractUrl from '../../assets/style/rig-contract.riv?url';

/**
 * The nine inputs `assets/style/rig-contract.json` declares, at their declared
 * types. Restated here rather than loaded because the contract file lives under
 * `assets/` (the art agent's boundary) and has no schema yet — when it moves to
 * `content/characters/rig.json` this list is deleted and the document is read.
 * The adapter refuses construction if the `.riv` does not expose all nine, so a
 * drift between this list and the file fails the harness loudly.
 */
const RIG_INPUTS: readonly CharacterInput[] = [
  { name: 'grounded', kind: 'bool' },
  { name: 'moving', kind: 'bool' },
  { name: 'talking', kind: 'bool' },
  { name: 'reducedMotion', kind: 'bool' },
  { name: 'speed', kind: 'number' },
  { name: 'verticalSpeed', kind: 'number' },
  { name: 'jump', kind: 'trigger' },
  { name: 'land', kind: 'trigger' },
  { name: 'interact', kind: 'trigger' },
];

/** The design resolution, from `content/game.config.json`. Portrait, always. */
const DESIGN_WIDTH = 1080;
const DESIGN_HEIGHT = 1920;

/**
 * Character space, from `assets/style/rig-contract.json`: 240 x 470 design
 * pixels, a six-head figure 420 px tall. Both modes draw at this size, because
 * a per-character cost measured at a different size is a measurement of a
 * different character.
 */
const CHARACTER_WIDTH = 240;
const CHARACTER_HEIGHT = 470;

/** Frames per clip in the generated atlas. Four is a short cartoon cycle. */
const FRAMES_PER_CLIP = 4;

/** The clips the harness rig declares, in the order the selector reads them. */
const CLIPS = ['idle', 'moving', 'speed'] as const;

/** How many frames of warm-up and how many are measured per window. */
const WARMUP_FRAMES = 30;
const WINDOW_FRAMES = 60;

export interface CostReport {
  readonly backend: string;
  readonly characters: number;
  readonly renderer: string;
  /** Closed measurement windows, oldest first. */
  readonly windows: readonly FrameCostSummary[];
  /** Layers actually drawn per character, so overdraw can be checked against it. */
  readonly layersPerCharacter: number;
}

const params = new URLSearchParams(window.location.search);
const characterCount = Math.max(0, Number(params.get('n') ?? '0'));
const backend = params.get('backend') ?? 'sprite';

/* -------------------------------------------------------------------------- */
/* the rig the harness draws                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A rig of the shape `assets/style/rig-contract.json` describes, cut to the part
 * that costs anything: how many layers are composited per character.
 *
 * The real contract declares twenty parts. Four layers here is deliberate and is
 * stated in the report rather than hidden — the reader multiplies. Using twenty
 * would measure an atlas nobody has packed, at a part count the art agent has
 * already had to cut once for the texture budget.
 */
const SLOTS = [
  { name: 'skin', options: ['skin-1', 'skin-2'] },
  { name: 'costume', options: ['parka', 'serge'] },
  { name: 'hairShape', options: ['bob', 'curls'] },
] as const;

const EXPRESSIONS = ['neutral', 'thinking'] as const;

function specFor(index: number): CharacterRendererSpec {
  return {
    characterId: `harness-${String(index)}` as CharacterId,
    artboard: 'harness',
    stateMachine: 'motion',
    inputs: [
      { name: 'moving', kind: 'bool' },
      { name: 'speed', kind: 'number' },
      { name: 'jump', kind: 'trigger' },
    ],
    slots: SLOTS.map((slot) => ({
      name: slot.name,
      labelKey: `creator.slot.${slot.name}`,
      playerSelectable: true,
      options: slot.options.map((id) => ({ id, labelKey: `creator.${slot.name}.${id}` })),
      fallback: slot.options[0],
    })),
    expressions: [...EXPRESSIONS],
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
   * The sprite path: one atlas, four layers per character, drawn through the
   * shipping adapter.
   */
  #buildSprites(): void {
    const atlasKey = 'harness-atlas';
    buildAtlas(this, atlasKey);

    const factory = createSpriteCharacterRendererFactory({
      textureKey: atlasKey,
      frames: {
        hasFrame: (key, frame) => this.textures.get(key).has(frame),
      },
      host: {
        createLayer: (index): SpriteLayerObject => {
          const image = this.add.image(0, 0, atlasKey);
          image.setDisplaySize(CHARACTER_WIDTH, CHARACTER_HEIGHT);
          image.setDepth(index);
          return {
            setTexture: (key, frame) => image.setTexture(key, frame),
            setFlipX: (flip) => image.setFlipX(flip),
            setVisible: (visible) => image.setVisible(visible),
            destroy: () => image.destroy(),
          };
        },
      },
    });

    for (let index = 0; index < characterCount; index += 1) {
      void factory.create(specFor(index)).then((created) => {
        if (!created.ok) throw new Error(created.error.message);
        created.value.setNumber('speed', 0.7);
        this.#characters.push(created.value);
        /* Spread across the portrait canvas so the draws do not all land on the
           same pixels — overlapping quads would be measured once by the
           rasteriser's early-out and would understate the cost. */
        const spread = (index + 0.5) / Math.max(1, characterCount);
        placeLayers(this, index, spread);
      });
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
      const spec: CharacterRendererSpec = {
        ...specFor(index),
        artboard: 'officer',
        stateMachine: 'motion',
        inputs: RIG_INPUTS,
      };
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

/** Position one character's layers. Called once the renderer's layers exist. */
function placeLayers(scene: Phaser.Scene, index: number, spread: number): void {
  const images = scene.children.list.filter(
    (child): child is Phaser.GameObjects.Image => child instanceof Phaser.GameObjects.Image,
  );
  const layersPer = SLOTS.length + 1;
  for (let layer = 0; layer < layersPer; layer += 1) {
    const image = images[index * layersPer + layer];
    if (image === undefined) continue;
    image.setPosition(spread * DESIGN_WIDTH, DESIGN_HEIGHT * 0.6);
  }
}

/**
 * Build the atlas the sprite backend reads, at runtime.
 *
 * Every frame is the same source rectangle: the cost being measured is the
 * per-layer draw and the per-frame `setTexture`, not the texture's contents, and
 * an atlas with 56 distinct pictures in it would measure a texture upload that
 * happens once. What must be real is the *frame table* — the adapter asks the
 * texture manager for each name and gets a hit or a miss for real.
 */
function buildAtlas(scene: Phaser.Scene, key: string): void {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (context !== null) {
    context.fillStyle = '#f4d35e';
    context.fillRect(0, 0, 128, 256);
    context.fillStyle = '#0d2135';
    context.fillRect(16, 16, 96, 96);
  }
  const texture = scene.textures.addCanvas(key, canvas);
  if (texture === null) return;

  const layers: [string, readonly string[]][] = [
    ...SLOTS.map((slot) => [slot.name, slot.options] as [string, readonly string[]]),
    ['expression', EXPRESSIONS],
  ];

  for (const [layer, options] of layers) {
    for (const option of options) {
      for (const clip of CLIPS) {
        for (let index = 0; index < FRAMES_PER_CLIP; index += 1) {
          texture.add(spriteFrameName('harness', layer, option, clip, index), 0, 0, 0, 128, 256);
        }
      }
    }
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
const windows: FrameCostSummary[] = [];

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
  const summary = recorder.record(sample);
  if (summary !== null) windows.push(summary);
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
  layersPerCharacter: backend === 'rive-floor' ? 1 : SLOTS.length + 1,
});
