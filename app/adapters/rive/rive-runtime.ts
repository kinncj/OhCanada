/**
 * The only file in TrueNorth that imports `@rive-app/canvas`.
 *
 * It contains no decisions. Everything that judges anything — which inputs a
 * character may set, which options a slot offers, what a failure is called, when
 * an instance is dead — is in `character-renderer.ts` beside it, behind
 * {@link RiveRuntime}, and is unit tested with a fake runtime and no browser.
 * What is here is the translation: a canvas per character, a WASM module shared
 * by all of them, a `.riv` file fetched once per artboard, and six methods.
 *
 * ## Conventions this binding assumes of the rig, and why they are written down
 *
 * `content/schemas/character.schema.json` declares `inputs` and `slots`. It does
 * **not** declare how a slot swap or a face pose is expressed inside the
 * artboard, and Rive offers several ways to do it. Rather than guess silently,
 * this binding fixes one and states it:
 *
 *   - a **skin slot** named `coat` is a `number` state-machine input named
 *     `coat`, set to the option's index in `CharacterDocument.slots[].options`;
 *   - an **expression** is a `number` input named `expression`, set to the
 *     pose's index in the spec's `expressions`;
 *   - **facing** is a `bool` input named `facing-left`.
 *
 * Every one of them returns `false` when the artboard exposes no such input, and
 * `character-renderer.ts` turns that into a `not-found` naming the artboard — so
 * a rig that expresses skins differently fails loudly at the first swap rather
 * than showing the wrong coat. Task 1.11 owns the rig contract; if it lands a
 * different expression of these three, this file changes and nothing else does.
 *
 * ## Cost, stated where it is spent
 *
 * One `HTMLCanvasElement` per character, `widthPx x heightPx`, plus the frame
 * upload the scene adapter does from it. That memory is invisible to
 * `make check-textures`, which weighs files. `estimatedTextureBytes()` in
 * `character-renderer.ts` is the only place it is counted.
 */

import { RuntimeLoader } from '@rive-app/canvas';

import type { RiveInstance, RiveInstanceRequest, RiveRuntime } from './character-renderer';

/*
 * The advanced runtime's types, derived rather than imported.
 *
 * `@rive-app/canvas` ships `rive_advanced.mjs.d.ts` but no `rive_advanced.mjs`
 * — the advanced module is a *different package* (`@rive-app/canvas-advanced`),
 * and the declaration file is there only so the loader's return type resolves.
 * Importing from that subpath typechecks in an editor and fails at build. So
 * every type below is read off the value that actually exists at runtime, which
 * has the additional property of being impossible to get wrong: if the package
 * changes shape, these aliases stop resolving instead of silently describing an
 * API nobody calls.
 */
type RiveCanvas = Awaited<ReturnType<typeof RuntimeLoader.awaitInstance>>;
type RiveFile = Awaited<ReturnType<RiveCanvas['load']>>;
type Artboard = ReturnType<RiveFile['artboardByName']>;
type WrappedRenderer = ReturnType<RiveCanvas['makeRenderer']>;
type StateMachineInstance = InstanceType<RiveCanvas['StateMachineInstance']>;
type SMIInput = ReturnType<StateMachineInstance['input']>;

/** The bool input a rig exposes so the runtime can mirror rather than duplicate art. */
export const FACING_INPUT = 'facing-left';
/** The number input a rig exposes for its face poses. */
export const EXPRESSION_INPUT = 'expression';

/** Where a `.riv` for an artboard is fetched from. Bootstrap owns the URL. */
export type RiveFileLocator = (artboard: string) => string;

export interface BrowserRiveRuntimeOptions {
  readonly locate: RiveFileLocator;
  /** Injected so a test can drive the fetch; defaults to the page's `fetch`. */
  readonly fetch?: typeof globalThis.fetch;
  /**
   * Where a character's frames are drawn.
   *
   * The composition root supplies the canvas, because the canvas is also what
   * the *scene* adapter has to bind a texture key to, and this file may not
   * import Phaser (ADR-0005: adapters never import each other). Given one, the
   * two sides are looking at the same pixels by construction; without it, this
   * binding would own a surface nobody could draw.
   *
   * Defaults to a detached `<canvas>`, which is what a measurement harness and
   * a headless check want: the rig advances and rasterises, and nothing
   * composites the result.
   */
  readonly createSurface?: (request: RiveInstanceRequest) => HTMLCanvasElement;
}

export function createBrowserRiveRuntime(options: BrowserRiveRuntimeOptions): RiveRuntime {
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  /* One fetch per artboard, however many characters share it. Cleared by
     `disposeShared` on level unload so the next level does not inherit bytes it
     will never draw. */
  const files = new Map<string, Promise<RiveFile>>();
  let runtime: Promise<RiveCanvas> | null = null;

  const wasm = (): Promise<RiveCanvas> => {
    runtime ??= RuntimeLoader.awaitInstance();
    return runtime;
  };

  const fileFor = (artboard: string): Promise<RiveFile> => {
    const cached = files.get(artboard);
    if (cached !== undefined) return cached;
    const loading = (async (): Promise<RiveFile> => {
      const rive = await wasm();
      const response = await fetchImpl(options.locate(artboard));
      if (!response.ok) {
        throw new Error(`rive: ${options.locate(artboard)} returned ${String(response.status)}`);
      }
      return rive.load(new Uint8Array(await response.arrayBuffer()));
    })();
    files.set(artboard, loading);
    return loading;
  };

  return {
    async instantiate(request: RiveInstanceRequest): Promise<RiveInstance> {
      const rive = await wasm();
      const file = await fileFor(request.artboard);
      const artboard = file.artboardByName(request.artboard);
      const machine = new rive.StateMachineInstance(
        artboard.stateMachineByName(request.stateMachine),
        artboard,
      );

      const canvas = options.createSurface?.(request) ?? document.createElement('canvas');
      canvas.width = request.widthPx;
      canvas.height = request.heightPx;
      const renderer = rive.makeRenderer(canvas);

      const inputs = new Map<string, SMIInput>();
      for (let index = 0; index < machine.inputCount(); index += 1) {
        const input = machine.input(index);
        inputs.set(input.name, input);
      }

      return liveInstance({ rive, artboard, machine, renderer, inputs, canvas, request });
    },

    disposeShared(): void {
      files.clear();
      /* The WASM module itself is deliberately kept: it is one download and one
         compile for the whole session, and dropping it would make the next
         level pay for it again. `files` is what grows per level. */
    },
  };
}

interface LiveParts {
  readonly rive: RiveCanvas;
  readonly artboard: Artboard;
  readonly machine: StateMachineInstance;
  readonly renderer: WrappedRenderer;
  readonly inputs: ReadonlyMap<string, SMIInput>;
  readonly canvas: HTMLCanvasElement;
  readonly request: RiveInstanceRequest;
}

function liveInstance(parts: LiveParts): RiveInstance {
  const { rive, artboard, machine, renderer, inputs, request } = parts;
  const frame = { minX: 0, minY: 0, maxX: request.widthPx, maxY: request.heightPx };
  let destroyed = false;

  const setNumberInput = (name: string, value: number): boolean => {
    const input = inputs.get(name);
    if (input === undefined) return false;
    input.value = value;
    return true;
  };

  const indexIn = (options: readonly string[], option: string): number =>
    options.indexOf(option);

  return {
    inputNames: [...inputs.keys()],

    setBool(name, value): boolean {
      const input = inputs.get(name);
      if (input === undefined) return false;
      input.value = value;
      return true;
    },

    setNumber: setNumberInput,

    fire(name): boolean {
      const input = inputs.get(name);
      if (input === undefined) return false;
      input.fire();
      return true;
    },

    setSkin(slot, option): boolean {
      const declared = request.slots.find((candidate) => candidate.name === slot);
      if (declared === undefined) return false;
      const index = indexIn(declared.options, option);
      if (index < 0) return false;
      return setNumberInput(slot, index);
    },

    setExpression(expression): boolean {
      const index = indexIn(request.expressions, expression);
      if (index < 0) return false;
      return setNumberInput(EXPRESSION_INPUT, index);
    },

    setFacing(facing): void {
      const input = inputs.get(FACING_INPUT);
      if (input === undefined) return;
      input.value = facing === 'left';
    },

    advance(seconds): void {
      if (destroyed) return;
      machine.advanceAndApply(seconds);
      /* `beginFrame` rather than the deprecated `clear`: it also registers the
         renderer for this frame, without which the queued draws are never
         flushed and the surface stays blank. */
      renderer.beginFrame(true);
      renderer.save();
      renderer.align(rive.Fit.contain, rive.Alignment.center, frame, artboard.bounds);
      artboard.draw(renderer);
      renderer.restore();
      renderer.flush();
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      /* Order matters: the state machine holds the artboard, the artboard holds
         the renderer's paints. Deleting the artboard first leaves the machine
         pointing at freed WASM memory, which is a crash rather than a leak. */
      machine.delete();
      artboard.delete();
      renderer.delete();
      /* Not `rive.cleanup()`: the module is shared by every other character. */
      parts.canvas.width = 0;
      parts.canvas.height = 0;
    },
  };
}
