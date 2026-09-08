/**
 * The sprite-atlas half of `ICharacterRenderer` (slice 1 task 1.12).
 *
 * CLAUDE.md puts Rive behind `ICharacterRenderer` "with a sprite-sheet fallback
 * with identical slot names". This is that fallback, and the word *identical*
 * is load-bearing: it is what makes swapping the backend invisible to calling
 * code rather than a second implementation that drifts from the first.
 *
 * It is identical here **structurally**, not by convention. `skinSlots` and
 * `skinOptions` are answered straight out of `CharacterRendererSpec.slots`,
 * which is `content/characters/<id>.json`'s `slots` array. The Rive adapter
 * answers them out of the same field of the same spec. Neither adapter holds a
 * list of names, so neither can hold a different one.
 *
 * ## What a "state" is on this path, and why it is never a colour
 *
 * ADR-0011: Phaser 4's Canvas renderer has no Filter pipeline, so an effect
 * built on a Filter renders nothing and reports nothing. CLAUDE.md says colour
 * is never the only signal. Both rules land on the same requirement for a
 * character: **every state must be distinguishable as shape.**
 *
 * That is enforced by the type of the thing this renderer is allowed to touch.
 * {@link SpriteLayerObject} exposes `setTexture`, `setFlipX` and `setVisible`
 * and nothing else — no `setTint`, no `setAlpha`, no `filters`, no `postFX`. A
 * state that differed only by a glow or a tint cannot be expressed here, so it
 * cannot be authored here and then be missing on the plain path. The narrow
 * interface is the gate; `tests/unit/adapters/phaser/filters-have-a-plain-path.test.ts`
 * scans this directory for the Filter API as the second one.
 *
 * ## Cost
 *
 * One draw per layer per character, from one shared atlas, with no per-frame
 * upload and no offscreen surface. `estimatedTextureBytes()` is therefore `0`:
 * the atlas is owned by Phaser's texture manager and is already weighed by
 * `make check-textures` and by the level's `textureBudgetBytes`. Charging it
 * again per instance would double-count six characters sharing one page. This
 * is the number to compare with the Rive adapter's, which is *not* zero and is
 * *not* visible to that gate — see `app/adapters/rive/character-renderer.ts`.
 *
 * ## Pure, except for the objects handed to it
 *
 * No Phaser import. The atlas arrives as a `hasFrame` predicate and the drawable
 * layers arrive from a host, so every rule below — clip selection, frame
 * counting, skin validation, facing — is unit tested with no browser and no GPU.
 * `character-host.ts` is the twenty lines that bind those two interfaces to a
 * real `Phaser.GameObjects.Image` and a real `TextureManager`.
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
 * The atlas, as one question.
 *
 * `Phaser.Textures.TextureManager` answers it with
 * `has(key) && get(key).has(frame)`. A test answers it with a `Set`. Nothing
 * else about a texture manager is reachable from here, which is why "the art
 * has not landed yet" is a `false` rather than a crash.
 */
export interface SpriteFrameSource {
  hasFrame(textureKey: string, frameName: string): boolean;
}

/**
 * One drawn layer of a character.
 *
 * Deliberately three methods. See the header: the absence of a colour channel is
 * what makes "every state survives without Filters" structural rather than a
 * rule somebody remembers.
 */
export interface SpriteLayerObject {
  setTexture(key: string, frame: string): unknown;
  setFlipX(flip: boolean): unknown;
  setVisible(visible: boolean): unknown;
  destroy(): void;
}

/** Where layers come from. `index` is draw order: 0 is furthest back. */
export interface SpriteLayerHost {
  createLayer(index: number): SpriteLayerObject;
}

export interface SpriteCharacterRendererOptions {
  /** The atlas key every frame of every character in this level is packed into. */
  readonly textureKey: string;
  readonly frames: SpriteFrameSource;
  readonly host: SpriteLayerHost;
  /** Playback rate for every clip. Uniform on purpose — see `DEFAULT_FPS`. */
  readonly fps?: number;
}

/**
 * Frames per second for every clip.
 *
 * One number rather than per-clip timing, because per-clip timing is data the
 * rig contract does not carry and inventing a place for it here would put an
 * animation table in engine code — exactly what "a level is addable by JSON and
 * assets alone" forbids. Twelve is the cartoon rate the art bible is drawn at;
 * when the rig contract declares per-clip rates, this constant becomes a lookup
 * and no caller changes.
 */
export const DEFAULT_FPS = 12;

/**
 * The clip played when no input is active. Not a name this file invents out of
 * nothing: it is the one animation every rig must have, and the atlas is
 * authored against the same string.
 */
export const IDLE_CLIP = 'idle';

/**
 * Ceiling on frames probed per clip.
 *
 * The atlas has no manifest this adapter can read, so a clip's length is
 * discovered by asking for frame 0, 1, 2 … until one is missing. Bounded so a
 * pathological atlas cannot turn a cache miss into an unbounded loop, and
 * generous enough for a two-second cycle at `DEFAULT_FPS`.
 */
export const MAX_CLIP_FRAMES = 64;

/**
 * Where one frame lives in the atlas.
 *
 * `<artboard>/<layer>/<option>/<clip>/<index>`, and the same five parts in the
 * same order for every layer, including the face:
 *
 *   `officer/coat/red-serge/idle/0`
 *   `officer/expression/thinking/idle/0`
 *
 * The atlas is packed by `make assets` from `assets/src/`, so this string is the
 * contract between this file and the art pipeline. It is exported because the
 * packer's naming and this reader's naming being the same thing is a fact worth
 * asserting in a test rather than hoping for.
 */
export function spriteFrameName(
  artboard: string,
  layer: string,
  option: string,
  clip: string,
  index: number,
): string {
  return `${artboard}/${layer}/${option}/${clip}/${String(index)}`;
}

/**
 * The animation to play, derived from *exactly* the state-machine input values
 * (`character-renderer.ts`, second bullet).
 *
 * Priority is the rig's own declaration order — `CharacterDocument.inputs` — so
 * which state wins is content, not code. A character that should show its brake
 * before its speed says so by listing `brake` first.
 *
 * The rules, in order:
 *   1. a trigger fired since the last frame plays its clip once, and outranks
 *      everything: a jump has to be visible even though `speed` is also nonzero;
 *   2. otherwise the first declared input that is *active* — a `bool` that is
 *      true, a `number` that is not zero — names the clip;
 *   3. otherwise {@link IDLE_CLIP}.
 *
 * Note what this is not: it is not the Rive state machine's logic re-implemented.
 * The two backends are required to share the input *names*, not the transitions
 * between them; on the Rive side the artboard's own state machine decides, which
 * is the whole reason a state machine is authored. Trying to mirror it here
 * would be the drift this seam exists to prevent, in the other direction.
 */
export function selectClip(
  inputs: readonly { readonly name: string; readonly kind: 'bool' | 'number' | 'trigger' }[],
  values: ReadonlyMap<string, boolean | number>,
  firedTrigger: string | null,
): string {
  if (firedTrigger !== null) return firedTrigger;
  for (const input of inputs) {
    if (input.kind === 'trigger') continue;
    const value = values.get(input.name);
    if (input.kind === 'bool' && value === true) return input.name;
    if (input.kind === 'number' && typeof value === 'number' && value !== 0) return input.name;
  }
  return IDLE_CLIP;
}

/** The layer name the face poses are packed under. */
export const EXPRESSION_LAYER = 'expression';

interface Layer {
  readonly name: string;
  readonly object: SpriteLayerObject;
  option: string;
}

/**
 * Build the sprite-backed factory.
 *
 * `disposeShared()` is a no-op with a reason: this backend holds nothing that is
 * not either per-instance (the layer objects, dropped in `dispose`) or owned by
 * Phaser's texture manager (the atlas, dropped by the level unload path in
 * `docs/architecture.md` §7). A factory that "helpfully" removed the atlas here
 * would delete it out from under the next level that shares it.
 */
export function createSpriteCharacterRendererFactory(
  options: SpriteCharacterRendererOptions,
): CharacterRendererFactory {
  return {
    backend: 'sprite',
    create(spec: CharacterRendererSpec): Promise<Result<ICharacterRenderer>> {
      return Promise.resolve(createSpriteCharacterRenderer(spec, options));
    },
    disposeShared(): void {
      /* Nothing shared is owned here — see the doc comment above. */
    },
  };
}

export function createSpriteCharacterRenderer(
  spec: CharacterRendererSpec,
  options: SpriteCharacterRendererOptions,
): Result<ICharacterRenderer> {
  const invalid = validateSpec(spec);
  if (invalid !== null) return invalid;

  const fps = options.fps ?? DEFAULT_FPS;
  const kinds = new Map(spec.inputs.map((input) => [input.name, input.kind] as const));
  const values = new Map<string, boolean | number>();
  const optionsBySlot = new Map(
    spec.slots.map((slot) => [slot.name, slot.options.map((option) => option.id)] as const),
  );

  /* Layers, in the document's slot order, with the face on top when the rig has
     one. Draw order is data for the same reason clip priority is. */
  const layers: Layer[] = spec.slots.map((slot, index) => ({
    name: slot.name,
    object: options.host.createLayer(index),
    option: spec.skins[slot.name] ?? slot.fallback,
  }));

  const face = spec.expression ?? spec.expressions[0] ?? null;
  if (face !== null) {
    layers.push({
      name: EXPRESSION_LAYER,
      object: options.host.createLayer(layers.length),
      option: face,
    });
  }

  /* `${layer} ${option} ${clip}` -> frame count. The atlas never
     changes under a running level, so a miss is asked once. NUL as the joiner
     because a slot or option name can contain anything the schema's id pattern
     allows, and a colliding cache key here would show the wrong clip. */
  const clipLengths = new Map<string, number>();

  let elapsedMs = 0;
  let firedTrigger: string | null = null;
  let facing: 'left' | 'right' = 'right';
  let disposed = false;

  const surface: SurfaceHandle = {
    textureKey: options.textureKey,
    widthPx: spec.widthPx,
    heightPx: spec.heightPx,
  };

  const clipLength = (layer: string, option: string, clip: string): number => {
    const key = `${layer} ${option} ${clip}`;
    const cached = clipLengths.get(key);
    if (cached !== undefined) return cached;
    let count = 0;
    while (count < MAX_CLIP_FRAMES) {
      const name = spriteFrameName(spec.artboard, layer, option, clip, count);
      if (!options.frames.hasFrame(options.textureKey, name)) break;
      count += 1;
    }
    clipLengths.set(key, count);
    return count;
  };

  /**
   * Draw one layer.
   *
   * A clip the atlas does not carry falls back to {@link IDLE_CLIP}, and a layer
   * with no idle either is hidden. That is what keeps a half-authored atlas — the
   * state art is in while the rig contract is in flight — from throwing on the
   * first frame: the character loses a layer, visibly, instead of the level
   * failing to run.
   */
  const paint = (layer: Layer, clip: string, frame: number): void => {
    let chosen = clip;
    let length = clipLength(layer.name, layer.option, chosen);
    if (length === 0 && chosen !== IDLE_CLIP) {
      chosen = IDLE_CLIP;
      length = clipLength(layer.name, layer.option, chosen);
    }
    if (length === 0) {
      layer.object.setVisible(false);
      return;
    }
    layer.object.setVisible(true);
    layer.object.setTexture(
      options.textureKey,
      spriteFrameName(spec.artboard, layer.name, layer.option, chosen, frame % length),
    );
  };

  const repaint = (): void => {
    const clip = selectClip(spec.inputs, values, firedTrigger);
    const frame = Math.floor((elapsedMs * fps) / 1000);
    for (const layer of layers) paint(layer, clip, frame);
  };

  const setInput = (
    input: InputName,
    kind: 'bool' | 'number' | 'trigger',
    value: boolean | number | null,
  ): Result<void> => {
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
    if (value === null) firedTrigger = input;
    else values.set(input, value);
    return ok();
  };

  const renderer: ICharacterRenderer = {
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
      return setInput(input, 'bool', value);
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
      return setInput(input, 'number', value);
    },
    fire(trigger) {
      return setInput(trigger, 'trigger', null);
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
      const layer = layers.find((candidate) => candidate.name === slot);
      if (layer !== undefined) layer.option = option;
      repaint();
      return ok();
    },

    setExpression(next: ExpressionName) {
      if (disposed) return disposedError(spec.characterId);
      if (!spec.expressions.includes(next)) {
        return appErr(
          'not-found',
          'character.expression.unknown',
          `character "${String(spec.characterId)}" has no expression "${next}".`,
          { character: spec.characterId, expression: next, declared: spec.expressions },
        );
      }
      const layer = layers.find((candidate) => candidate.name === EXPRESSION_LAYER);
      if (layer !== undefined) layer.option = next;
      repaint();
      return ok();
    },

    setFacing(next) {
      if (disposed || next === facing) return;
      facing = next;
      /* Mirrored, never duplicated art (the port says so): half the atlas. */
      for (const layer of layers) layer.object.setFlipX(next === 'left');
    },

    update(deltaMs) {
      if (disposed || !Number.isFinite(deltaMs) || deltaMs < 0) return;
      elapsedMs += deltaMs;
      repaint();
      /* A trigger plays for the frame it was fired on and then releases, which
         is what makes `fire` a pulse rather than a state nobody clears. */
      firedTrigger = null;
    },

    estimatedTextureBytes(): number {
      /* Zero, and the reason is in the header: the atlas is shared and already
         weighed. Six characters on one page cost one page. */
      return 0;
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const layer of layers) layer.object.destroy();
      layers.length = 0;
      clipLengths.clear();
      values.clear();
    },
  };

  /* First paint before the caller's first `update`, so a character that is
     placed and never stepped is still drawn rather than being an empty slot. */
  repaint();
  return ok(renderer);
}

/**
 * The spec checks both backends make, in the same order and with the same codes.
 *
 * Duplicated in `app/adapters/rive/character-renderer.ts` rather than shared,
 * because adapters never import each other (ADR-0005) and neither a port nor
 * `common/` is the right home for one backend's validation. The duplication is
 * pinned by `tests/unit/adapters/character-renderer-swap.test.ts`, which runs
 * the same table of malformed specs through both factories and requires the same
 * error code out of each — so a drift fails a test rather than surprising a
 * player on a device that fell back.
 */
function validateSpec(spec: CharacterRendererSpec): Result<never> | null {
  if (spec.slots.length === 0) {
    return appErr(
      'invalid',
      'character.rig.noSlots',
      `character "${String(spec.characterId)}" declares no skin slots; the rig contract ` +
        `requires at least one.`,
      { character: spec.characterId },
    );
  }
  for (const slot of spec.slots) {
    const ids = slot.options.map((option) => option.id);
    if (!ids.includes(slot.fallback)) {
      return appErr(
        'invalid',
        'character.rig.fallbackMissing',
        `skin slot "${slot.name}" of character "${String(spec.characterId)}" falls back to ` +
          `"${slot.fallback}", which is not one of its options.`,
        { character: spec.characterId, slot: slot.name, fallback: slot.fallback, options: ids },
      );
    }
  }
  for (const [slot, option] of Object.entries(spec.skins)) {
    const declared = spec.slots.find((candidate) => candidate.name === slot);
    if (declared === undefined) {
      return appErr(
        'not-found',
        'character.slot.unknown',
        `character "${String(spec.characterId)}" has no skin slot "${slot}".`,
        { character: spec.characterId, slot },
      );
    }
    if (!declared.options.some((candidate) => candidate.id === option)) {
      return appErr(
        'not-found',
        'character.skin.unknown',
        `skin slot "${slot}" of character "${String(spec.characterId)}" has no option ` +
          `"${option}".`,
        { character: spec.characterId, slot, option },
      );
    }
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

function disposedError(character: unknown): Result<never> {
  return appErr(
    'conflict',
    'character.disposed',
    `character "${String(character)}" has been disposed; the instance is dead.`,
    { character },
  );
}
