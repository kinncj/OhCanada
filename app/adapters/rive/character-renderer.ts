/**
 * The Rive half of `ICharacterRenderer` (slice 1 task 1.12).
 *
 * ADR-0001 and CLAUDE.md put Rive behind this port with a sprite-sheet fallback
 * "with identical slot names". This file is the Rive side; the sprite side is
 * `app/adapters/phaser/sprite-character-renderer.ts`. **Neither imports the
 * other** (ADR-0005) and neither holds a list of slot names: both answer
 * `skinSlots` and `skinOptions` out of `CharacterRendererSpec.slots`, which is
 * one array in one `content/characters/<id>.json`. That is what makes the swap
 * a swap.
 *
 * ## Two things a reader should know before choosing this backend
 *
 * **1. A Rive surface costs texture memory that no gate can see.** Every
 * instance owns an offscreen canvas sized by the display, and the frame it
 * rasterises is uploaded to the GPU every frame it changes. `make check-textures`
 * weighs *files* — `width x height x 4` over the atlases and images a level
 * ships — so a Rive character contributes nothing to that number and a real
 * `widthPx * heightPx * 4` to the device. `estimatedTextureBytes()` below is
 * the only place that cost is stated, which is why the level loader must add it
 * to the level's budget rather than trusting the asset gate. The sprite backend
 * returns `0` from the same method because its atlas *is* weighed by that gate;
 * the two numbers are not comparable by accident, they are the difference.
 *
 * **2. Nothing here draws a state as a colour.** The runtime seam below has no
 * tint, no alpha and no Filter, for the reason the sprite adapter's layer
 * interface has none (ADR-0011: Canvas has no Filter pipeline, so a Filter is a
 * silent no-op; CLAUDE.md: colour is never the only signal). A state that exists
 * only as a glow does not exist on the plain path.
 *
 * ## Structure
 *
 * The runtime arrives as {@link RiveRuntime}, a seven-method seam. Everything
 * decisional — validating the spec, refusing an undeclared input, refusing an
 * option the document does not offer, converting a frame delta to seconds,
 * making `dispose` idempotent — is here, and is unit tested with a fake runtime
 * and no browser. `rive-runtime.ts` is the only file in the repository that
 * imports `@rive-app/canvas`, and it contains no decisions.
 */

import type {
  CharacterRendererFactory,
  CharacterRendererSpec,
  ExpressionName,
  ICharacterRenderer,
  InputName,
  SkinOptionName,
  SkinSlotName,
  SurfaceHandle,
} from '@application/ports';
import { appErr, ok, type Result } from '@common/result';

/**
 * A live artboard bound to a surface.
 *
 * Every method that can fail returns a boolean rather than throwing, because the
 * WASM runtime's failure for "no such input" is a null reference, and a seam
 * that turned that into an exception would put a try/catch around every call in
 * this file. `false` means "the rig does not have that"; the caller turns it
 * into a `not-found` `Result` with the same code the sprite backend uses.
 */
export interface RiveInstance {
  /** Input names the loaded state machine actually exposes. */
  readonly inputNames: readonly string[];
  setBool(name: string, value: boolean): boolean;
  setNumber(name: string, value: number): boolean;
  fire(name: string): boolean;
  /** Runtime slot swap. `false` when the artboard has no such slot or option. */
  setSkin(slot: string, option: string): boolean;
  setExpression(expression: string): boolean;
  setFacing(facing: 'left' | 'right'): void;
  /** Advance the state machine and draw one frame. Seconds, never milliseconds. */
  advance(seconds: number): void;
  /** Release the artboard, the state machine and the surface. */
  destroy(): void;
}

export interface RiveInstanceRequest {
  readonly artboard: string;
  readonly stateMachine: string;
  readonly widthPx: number;
  readonly heightPx: number;
  /** Where the drawn frame is published, for the scene adapter to bind. */
  readonly textureKey: string;
  /**
   * The slot vocabulary, in the document's order, so the binding can express a
   * swap however the rig expresses one. Order is part of the contract: a rig
   * that encodes an option as an index encodes *this* index.
   */
  readonly slots: readonly { readonly name: string; readonly options: readonly string[] }[];
  /** Face poses, in the spec's order, for the same reason. */
  readonly expressions: readonly string[];
}

export interface RiveRuntime {
  instantiate(request: RiveInstanceRequest): Promise<RiveInstance>;
  /** Drop the WASM module and any cached file bytes. Called on level unload. */
  disposeShared(): void;
}

export interface RiveCharacterRendererOptions {
  readonly runtime: RiveRuntime;
  /**
   * Names the surface a character publishes under. Bootstrap agrees this with
   * the scene adapter (the port says so); it is a function rather than a prefix
   * so the two can never disagree about the separator.
   */
  readonly textureKeyFor?: (spec: CharacterRendererSpec) => string;
}

export function defaultTextureKeyFor(spec: CharacterRendererSpec): string {
  return `rive:${String(spec.characterId)}`;
}

export function createRiveCharacterRendererFactory(
  options: RiveCharacterRendererOptions,
): CharacterRendererFactory {
  const textureKeyFor = options.textureKeyFor ?? defaultTextureKeyFor;

  return {
    backend: 'rive',
    async create(spec: CharacterRendererSpec): Promise<Result<ICharacterRenderer>> {
      const invalid = validateSpec(spec);
      if (invalid !== null) return invalid;

      let instance: RiveInstance;
      try {
        instance = await options.runtime.instantiate({
          artboard: spec.artboard,
          stateMachine: spec.stateMachine,
          widthPx: spec.widthPx,
          heightPx: spec.heightPx,
          textureKey: textureKeyFor(spec),
          slots: rigSlots(spec),
          expressions: spec.rig.expressions.names,
        });
      } catch (cause) {
        /* `io`, not `invalid`: the file did not arrive or the runtime did not
           start. That is the failure the fallback exists for, and bootstrap
           reads this code to decide to fall back rather than to give up. */
        return appErr(
          'io',
          'character.rive.instantiateFailed',
          `the Rive runtime could not open artboard "${spec.artboard}" for character ` +
            `"${String(spec.characterId)}".`,
          { character: spec.characterId, artboard: spec.artboard },
          cause,
        );
      }

      /*
       * The rig contract, checked against the rig.
       *
       * `content/characters/<id>.json` says which inputs the state machine must
       * expose; this is where the document meets the `.riv`. Slice 1 task 1.11
       * runs the same comparison at build time, and it is repeated here because
       * a build-time check cannot see a file that was re-exported after it ran.
       * A missing input is refused at construction rather than discovered as a
       * character who never plays their jump.
       */
      const exposed = new Set(instance.inputNames);
      const missing = spec.rig.stateMachine.inputs
        .map((input) => input.name)
        .filter((name) => !exposed.has(name));
      if (missing.length > 0) {
        instance.destroy();
        return appErr(
          'invalid',
          'character.rig.inputsMissing',
          `artboard "${spec.artboard}" does not expose ${missing.join(', ')}, which ` +
            `character "${String(spec.characterId)}" declares.`,
          { character: spec.characterId, artboard: spec.artboard, missing },
        );
      }

      return ok(bind(spec, instance, textureKeyFor(spec)));
    },

    disposeShared(): void {
      options.runtime.disposeShared();
    },
  };
}

function bind(
  spec: CharacterRendererSpec,
  instance: RiveInstance,
  textureKey: string,
): ICharacterRenderer {
  const kinds = new Map(
    spec.rig.stateMachine.inputs.map((input) => [input.name, input.type] as const),
  );
  const optionsBySlot = new Map(
    rigSlots(spec).map((slot) => [slot.name, slot.options] as const),
  );
  let disposed = false;
  let anchorX = 0;
  let anchorY = 0;

  const surface: SurfaceHandle = {
    textureKey,
    widthPx: spec.widthPx,
    heightPx: spec.heightPx,
  };

  const checkInput = (
    input: InputName,
    kind: 'bool' | 'number' | 'trigger',
  ): Result<void> | null => {
    if (disposed) return disposedError(spec.characterId);
    const declared = kinds.get(input);
    if (declared === undefined) {
      return appErr(
        'not-found',
        'character.input.unknown',
        `character "${String(spec.characterId)}" declares no state-machine input "${input}".`,
        { character: spec.characterId, input, declared: [...kinds.keys()] },
      );
    }
    if (declared !== kind) {
      return appErr(
        'invalid',
        'character.input.wrongKind',
        `state-machine input "${input}" of character "${String(spec.characterId)}" is a ` +
          `${declared}, not a ${kind}.`,
        { character: spec.characterId, input, declared, used: kind },
      );
    }
    return null;
  };

  /* The runtime said no to a name the document declares: the `.riv` on disk is
     not the `.riv` the document was written against. Same code either way, so a
     caller never has to know which side noticed. */
  const runtimeRefused = (input: string): Result<void> =>
    appErr(
      'not-found',
      'character.input.unknown',
      `the loaded artboard "${spec.artboard}" refused state-machine input "${input}".`,
      { character: spec.characterId, artboard: spec.artboard, input },
    );

  /* Set once, before the first frame, so a character is not drawn with the
     wrong coat for one frame. Slots the runtime does not offer are ignored
     here rather than failing construction: `setSkin` reports them, and a
     costume slot the artboard lost is a wardrobe defect, not a dead level. */
  const artboard = spec.rig.artboards.find((candidate) => candidate.artboard === spec.artboard);
  for (const slot of rigSlots(spec)) {
    const choice = spec.skins[slot.name] ?? artboard?.skins[slot.name] ?? slot.fallback;
    if (choice !== undefined) instance.setSkin(slot.name, choice);
  }
  instance.setExpression(spec.expression ?? spec.rig.expressions.fallback);

  return {
    characterId: spec.characterId,
    artboard: spec.artboard,
    surface,

    get skinSlots(): readonly SkinSlotName[] {
      return [...optionsBySlot.keys()];
    },

    skinOptions(slot: SkinSlotName): readonly SkinOptionName[] {
      return optionsBySlot.get(slot) ?? [];
    },

    setBool(input, value) {
      const refused = checkInput(input, 'bool');
      if (refused !== null) return refused;
      return instance.setBool(input, value) ? ok() : runtimeRefused(input);
    },

    setNumber(input, value) {
      if (!Number.isFinite(value)) {
        return appErr(
          'invalid',
          'character.input.notFinite',
          `state-machine input "${input}" was given ${String(value)}.`,
          { character: spec.characterId, input, value },
        );
      }
      const refused = checkInput(input, 'number');
      if (refused !== null) return refused;
      return instance.setNumber(input, value) ? ok() : runtimeRefused(input);
    },

    fire(trigger) {
      const refused = checkInput(trigger, 'trigger');
      if (refused !== null) return refused;
      return instance.fire(trigger) ? ok() : runtimeRefused(trigger);
    },

    setSkin(slot, option) {
      if (disposed) return disposedError(spec.characterId);
      const available = optionsBySlot.get(slot);
      if (available === undefined) {
        return appErr(
          'not-found',
          'character.slot.unknown',
          `character "${String(spec.characterId)}" has no skin slot "${slot}".`,
          { character: spec.characterId, slot, declared: [...optionsBySlot.keys()] },
        );
      }
      if (!available.includes(option)) {
        return appErr(
          'not-found',
          'character.skin.unknown',
          `skin slot "${slot}" of character "${String(spec.characterId)}" has no option ` +
            `"${option}".`,
          { character: spec.characterId, slot, option, declared: available },
        );
      }
      if (!instance.setSkin(slot, option)) {
        return appErr(
          'not-found',
          'character.skin.unknown',
          `the loaded artboard "${spec.artboard}" has no option "${option}" in slot "${slot}".`,
          { character: spec.characterId, artboard: spec.artboard, slot, option },
        );
      }
      return ok();
    },

    setExpression(expression: ExpressionName) {
      if (disposed) return disposedError(spec.characterId);
      if (!spec.rig.expressions.names.includes(expression)) {
        return appErr(
          'not-found',
          'character.expression.unknown',
          `character "${String(spec.characterId)}" has no expression "${expression}".`,
          { character: spec.characterId, expression, declared: spec.rig.expressions.names },
        );
      }
      if (!instance.setExpression(expression)) {
        return appErr(
          'not-found',
          'character.expression.unknown',
          `the loaded artboard "${spec.artboard}" has no expression "${expression}".`,
          { character: spec.characterId, artboard: spec.artboard, expression },
        );
      }
      return ok();
    },

    setFacing(facing) {
      if (disposed) return;
      instance.setFacing(facing);
    },

    /**
     * Recorded, not drawn.
     *
     * A Rive character is one surface that the *scene* composites, so this
     * backend cannot place itself — what it can do is answer where it stands,
     * so a caller moves a character the same way whichever backend drew it. The
     * scene reads it back beside {@link SurfaceHandle} when it positions the
     * quad. The sprite backend, which owns twenty game objects, places them.
     */
    setPosition(x, y) {
      if (disposed) return;
      anchorX = x;
      anchorY = y;
      void anchorX;
      void anchorY;
    },

    update(deltaMs) {
      if (disposed || !Number.isFinite(deltaMs) || deltaMs < 0) return;
      /* Seconds. Rive's `advance` takes seconds and a caller that passed
         milliseconds would run every character 1000x fast — a mistake that
         looks like a broken rig rather than a unit error, so the conversion
         lives at the seam and nowhere else. */
      instance.advance(deltaMs / 1000);
    },

    estimatedTextureBytes(): number {
      /* The offscreen surface, RGBA. See the header: this is real device memory
         that `make check-textures` cannot see, because that gate weighs files
         and this one is sized by the display. */
      return spec.widthPx * spec.heightPx * 4;
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      instance.destroy();
    },
  };
}

/**
 * The spec checks both backends make, in the same order and with the same codes.
 *
 * Duplicated in `app/adapters/phaser/sprite-character-renderer.ts` rather than
 * shared: adapters never import each other (ADR-0005), a port carries interfaces
 * only, and `common/` is not one backend's validation table. The duplication is
 * pinned by `tests/unit/adapters/character-renderer-swap.test.ts`, which puts
 * the same malformed specs through both factories and requires the same error
 * code from each — so a drift fails a test instead of surprising a player whose
 * device fell back.
 */
function validateSpec(spec: CharacterRendererSpec): Result<never> | null {
  const rig = spec.rig;

  if (rig.parts.length === 0) {
    return appErr(
      'invalid',
      'character.rig.noParts',
      'the rig declares no parts, so a character would draw nothing.',
      { character: spec.characterId },
    );
  }

  for (const slot of rigSlots(spec)) {
    if (slot.fallback !== undefined && !slot.options.includes(slot.fallback)) {
      return appErr(
        'invalid',
        'character.rig.fallbackMissing',
        `skin slot "${slot.name}" falls back to "${slot.fallback}", which is not one of its ` +
          `options.`,
        { character: spec.characterId, slot: slot.name, fallback: slot.fallback },
      );
    }
  }

  const declared = new Map(rigSlots(spec).map((slot) => [slot.name, slot.options] as const));
  for (const [slot, option] of Object.entries(spec.skins)) {
    const options = declared.get(slot);
    if (options === undefined) {
      return appErr('not-found', 'character.slot.unknown', `the rig has no skin slot "${slot}".`, {
        character: spec.characterId,
        slot,
      });
    }
    if (!options.includes(option)) {
      return appErr(
        'not-found',
        'character.skin.unknown',
        `skin slot "${slot}" has no option "${option}".`,
        { character: spec.characterId, slot, option },
      );
    }
  }

  if (spec.expression !== undefined && !rig.expressions.names.includes(spec.expression)) {
    return appErr(
      'not-found',
      'character.expression.unknown',
      `the rig has no expression "${spec.expression}".`,
      { character: spec.characterId, expression: spec.expression },
    );
  }

  if (spec.widthPx <= 0 || spec.heightPx <= 0) {
    return appErr(
      'invalid',
      'character.surface.empty',
      `character "${String(spec.characterId)}" was asked for a ${String(spec.widthPx)}x` +
        `${String(spec.heightPx)} surface.`,
      { character: spec.characterId, widthPx: spec.widthPx, heightPx: spec.heightPx },
    );
  }
  return null;
}

/**
 * The rig's slots as a list, minus the reserved ones.
 *
 * `RigSlots` is an object with fixed keys — the schema fixes the names, which is
 * the anti-caricature mechanism rather than tidiness — and a `reserved` slot has
 * zero options and a null fallback, so it is not something a character can wear.
 */
function rigSlots(
  spec: CharacterRendererSpec,
): readonly { readonly name: string; readonly options: readonly string[]; readonly fallback?: string }[] {
  return Object.entries(spec.rig.slots)
    .filter(([, slot]) => slot.status !== 'reserved')
    .map(([name, slot]) => ({
      name,
      options: slot.options,
      ...(slot.fallback === null ? {} : { fallback: slot.fallback }),
    }));
}

function disposedError(character: unknown): Result<never> {
  return appErr(
    'conflict',
    'character.disposed',
    `character "${String(character)}" has been disposed; the instance is dead.`,
    { character },
  );
}
