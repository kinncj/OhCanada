/**
 * The sprite-atlas half of `ICharacterRenderer` (slice 1 task 1.12), as a
 * **cut-out puppet**.
 *
 * CLAUDE.md puts Rive behind this port "with a sprite-sheet fallback with
 * identical slot names". This is that fallback. It is identical **structurally**
 * rather than by convention: both backends read their whole vocabulary — parts,
 * slots, options, inputs, states, expressions — out of `CharacterRendererSpec.rig`,
 * one `content/characters/rig.json` reaching both through the same field of the
 * same spec (ADR-0022). Neither adapter holds a list of names, so neither can
 * hold a different one.
 *
 * ## Why a puppet and not a flipbook
 *
 * This file was a flipbook first — frames named per clip, advanced at a fixed
 * rate — and it could not draw the art that exists. The rig offers
 * 6 skin x 4 hairShape x 5 hairColour x 2 headCovering x 2 feature = **480**
 * player-selectable appearances, 960 across both costumes. A flipbook *bakes* a
 * combination; a puppet *composes* one, so 21 drawings cover all 480 while a
 * flipbook would need a frame per combination per keyframe per state.
 *
 * More than economy: `docs/content-review.md` §8.2 makes slot independence the
 * mechanical anti-caricature check, and ADR-0017 split `hairShape` from
 * `hairColour` precisely so a coupling — "the coily one only in black" — cannot
 * hide inside one combined list. Only a composed puppet can express that at all;
 * a baked sheet would encode whichever couplings the person exporting it chose.
 *
 * ## What a "state" is here, and why it is never a colour
 *
 * ADR-0011: Phaser 4's Canvas renderer has no Filter pipeline, so a Filter is a
 * silent no-op. CLAUDE.md: colour is never the only signal. Both land on the same
 * requirement — every state must be legible as **shape**. That is enforced by the
 * type of the only thing this renderer may touch: {@link SpritePartObject} moves,
 * rotates, mirrors, hides and re-textures a part, and has no tint, no alpha, no
 * `filters` and no `postFX`. A state distinguished only by a glow cannot be
 * written down here, so it cannot be authored and then be missing on the plain
 * path.
 *
 * ## Cost
 *
 * Twenty draws per character from one shared atlas, no offscreen surface and no
 * per-frame upload. `estimatedTextureBytes()` is `0`: the atlas is a file that
 * `make check-textures` already weighs, and charging it per instance would count
 * one page once per character sharing it. Compare `app/adapters/rive`, which
 * returns real bytes because a Rive surface is sized by the display, ships in no
 * file, and is invisible to that gate.
 *
 * ## Pure, except for the objects handed to it
 *
 * No Phaser import. The atlas arrives as a `hasFrame` predicate and the parts
 * arrive from a host, so template resolution, state selection, keyframe
 * interpolation, pivot placement and mirroring are all unit tested with no
 * browser and no GPU.
 */

import type {
  CharacterRendererFactory,
  CharacterRendererSpec,
  ExpressionName,
  ICharacterRenderer,
  InputName,
  RigDocument,
  RigKeyframe,
  RigPart,
  RigSlot,
  SkinOptionName,
  SkinSlotName,
  SurfaceHandle,
} from '@application/ports';
import { appErr, ok, type Result } from '@common/result';

/**
 * The atlas, as one question.
 *
 * Phaser answers it with `has(key) && get(key).has(frame)`; a test answers it
 * with a `Set`. Nothing else about a texture manager is reachable from here,
 * which is why "that option has no art yet" is a `false` rather than a crash.
 */
export interface SpriteFrameSource {
  hasFrame(textureKey: string, frameName: string): boolean;
}

/**
 * One drawn part of a character.
 *
 * Deliberately these seven methods. See the header: the absence of any colour
 * channel is what makes "every state survives without Filters" structural rather
 * than a rule somebody has to remember.
 */
export interface SpritePartObject {
  setTexture(key: string, frame: string): unknown;
  /** Fractions of the frame, 0..1. Used to put the rotation origin on the pivot. */
  setOrigin(x: number, y: number): unknown;
  setPosition(x: number, y: number): unknown;
  setAngle(degrees: number): unknown;
  setFlipX(flip: boolean): unknown;
  setDepth(depth: number): unknown;
  setVisible(visible: boolean): unknown;
  destroy(): void;
}

/** Where parts come from. `part` is the rig's own record, so a host may size to it. */
export interface SpritePartHost {
  createPart(part: RigPart): SpritePartObject;
}

export interface SpriteCharacterRendererOptions {
  /** The atlas key every character part in this level is packed into. */
  readonly textureKey: string;
  readonly frames: SpriteFrameSource;
  readonly host: SpritePartHost;
  /** Depth of the backmost part; `z` is added to it. Parts sit above the ground. */
  readonly baseDepth?: number;
}

/** The state played when no selector rule matches. Always last in `selector.rules`. */
export const IDLE_STATE = 'idle';

/**
 * The selector's conditions, by the state each one selects.
 *
 * `RigSelector.rules[].when` is **prose**, and deliberately so: the port says an
 * executable condition in the document "would be a second implementation of the
 * state machine that could disagree with both backends". So the *order* and the
 * *membership* are data — reordering the rig's rules reorders these, and a rule
 * this table has no entry for is refused at construction rather than silently
 * never firing — and the meaning of each named state is code, transcribed from
 * the prose it sits beside.
 *
 * This is the one place the two backends can drift, and it is why the
 * conformance suite drives both through `rig.selector.rules` and compares.
 */
export interface SelectorContext {
  /** Current value of each declared input, by name. */
  readonly value: (name: string) => boolean | number | undefined;
  /** A trigger fired since the last frame whose `once` state has not finished. */
  readonly pending: string | null;
}

const STATE_CONDITIONS: Readonly<Record<string, (context: SelectorContext) => boolean>> = {
  /* "interact fired and its state has not finished" */
  interact: (c) => c.pending === 'interact',
  /* "land fired and its state has not finished and not reducedMotion" */
  land: (c) => c.pending === 'land' && c.value('reducedMotion') !== true,
  /* "not grounded and verticalSpeed > 0" */
  'jump-rise': (c) => c.value('grounded') !== true && Number(c.value('verticalSpeed') ?? 0) > 0,
  /* "not grounded" */
  'jump-fall': (c) => c.value('grounded') !== true,
  /* "talking" */
  talk: (c) => c.value('talking') === true,
  /* "moving and speed >= 0.55" */
  run: (c) => c.value('moving') === true && Number(c.value('speed') ?? 0) >= RUN_THRESHOLD,
  /* "moving" */
  walk: (c) => c.value('moving') === true,
  /* "otherwise" */
  idle: () => true,
};

/** Where `walk` becomes `run`, from the rig's own `speed` input meaning. */
export const RUN_THRESHOLD = 0.55;

/**
 * First match wins, in the rig's order.
 *
 * Returns `null` only when the rig's rules match nothing, which cannot happen
 * with the shipped document (its last rule is unconditional) and is treated as
 * `idle` by the caller rather than as a character that stops animating.
 */
export function selectState(
  rules: readonly { readonly state: string }[],
  context: SelectorContext,
): string | null {
  for (const rule of rules) {
    if (STATE_CONDITIONS[rule.state]?.(context) === true) return rule.state;
  }
  return null;
}

/**
 * Fill a part's `{slot}` and `{expression}` braces.
 *
 * `hair-{hairShape}-{hairColour}` with `curly` and `black` becomes
 * `hair-curly-black`. A brace naming nothing the character chose resolves to
 * `null`, and the part then draws nothing — which is how every "none" option
 * works with no special case in either backend.
 */
export function resolveFrameTemplate(
  template: string,
  chosen: ReadonlyMap<string, string>,
): string | null {
  let missing = false;
  const resolved = template.replace(/\{([a-zA-Z]+)\}/gu, (_match, name: string) => {
    const value = chosen.get(name);
    if (value === undefined || value.length === 0) {
      missing = true;
      return '';
    }
    return value;
  });
  return missing ? null : resolved;
}

/** `[dx, dy, rotationDegrees]` at one instant, per part. See {@link partTransformAt}. */
export interface PartTransform {
  readonly dx: number;
  readonly dy: number;
  readonly rotation: number;
}

const REST: PartTransform = { dx: 0, dy: 0, rotation: 0 };

/**
 * The transform of one part at normalised time `t`.
 *
 * ### The tuple order, and how it was settled
 *
 * `RigKeyframe.parts` is a three-number tuple and **two documents disagree about
 * what it means**: `app/application/ports/content-repository.ts` says
 * `[rotationDeg, dx, dy]`, and `assets/style/rig-contract.md` §6 says
 * `[dx, dy, rotationDegrees]`. The data settles it and the prose is right:
 *
 *   - `arm-upper-r` swings 0, ±26, 0, ±26 through `walk` in the **third** slot
 *     while the first two stay 0 — an arm in a walk cycle swings by rotation,
 *     and a ±26 px vertical slide with no rotation is not a walk;
 *   - `run`'s third slot is ±37.7, exactly 1.45x `walk`'s, which is the
 *     "same cycle at 1.45x amplitude" the contract states in prose, and its
 *     duration is 0.69x, also as stated;
 *   - `torso` in `jump-rise` is `[0, -4, 0]`, a torso lifted four pixels.
 *
 * Reported: the port's doc comment is wrong and should be corrected. This
 * implementation follows the data.
 */
export function partTransformAt(
  keys: readonly RigKeyframe[],
  part: string,
  t: number,
): PartTransform {
  if (keys.length === 0) return REST;
  const clamped = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));

  let before = keys[0];
  let after = keys[keys.length - 1];
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (key === undefined) continue;
    if (key.t <= clamped) before = key;
    if (key.t >= clamped) {
      after = key;
      break;
    }
  }
  if (before === undefined || after === undefined) return REST;

  const from = tupleOf(before, part);
  const to = tupleOf(after, part);
  const span = after.t - before.t;
  const mix = span > 0 ? (clamped - before.t) / span : 0;

  return {
    dx: lerp(from[0], to[0], mix),
    dy: lerp(from[1], to[1], mix),
    rotation: lerp(from[2], to[2], mix),
  };
}

function tupleOf(key: RigKeyframe, part: string): readonly [number, number, number] {
  return key.parts[part] ?? [0, 0, 0];
}

function lerp(from: number, to: number, mix: number): number {
  return from + (to - from) * mix;
}

/* -------------------------------------------------------------------------- */

interface PartView {
  readonly part: RigPart;
  readonly object: SpritePartObject;
  readonly frame: string;
  /** The frame window in character space, for the pivot-to-origin conversion. */
  readonly window: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
}

/**
 * Build the sprite-backed factory.
 *
 * `disposeShared()` does nothing, with a reason: this backend holds nothing that
 * is not either per-instance (the part objects, dropped in `dispose`) or owned by
 * Phaser's texture manager (the atlas, dropped by the level-unload path in
 * `docs/architecture.md` §7). A factory that "helpfully" removed the atlas here
 * would delete it out from under the next level sharing it.
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
      /* Nothing shared is owned here — see above. */
    },
  };
}

export function createSpriteCharacterRenderer(
  spec: CharacterRendererSpec,
  options: SpriteCharacterRendererOptions,
): Result<ICharacterRenderer> {
  const invalid = validateSpec(spec);
  if (invalid !== null) return invalid;

  const rig = spec.rig;
  const space = rig.characterSpace;
  const baseDepth = options.baseDepth ?? 0;
  const kinds = new Map(rig.stateMachine.inputs.map((input) => [input.name, input.type] as const));
  const slots = slotEntries(rig);
  const optionsBySlot = new Map(slots.map(([name, slot]) => [name, slot.options] as const));

  /* The character's choices over the rig's vocabulary: what the caller asked
     for, else what this artboard ships with, else the slot's fallback. A
     `reserved` slot has a null fallback and contributes nothing. */
  const artboard = rig.artboards.find((candidate) => candidate.artboard === spec.artboard);
  const chosen = new Map<string, string>();
  for (const [name, slot] of slots) {
    const choice = spec.skins[name] ?? artboard?.skins[name] ?? slot.fallback;
    if (choice !== null && choice !== undefined) chosen.set(name, choice);
  }
  let expression = spec.expression ?? rig.expressions.fallback;
  chosen.set('expression', expression);

  const values = new Map<string, boolean | number>();
  for (const input of rig.stateMachine.inputs) {
    if (input.fallback !== undefined) values.set(input.name, input.fallback);
  }

  let parts: PartView[] = [];
  let state = IDLE_STATE;
  let stateElapsedMs = 0;
  let pending: string | null = null;
  let facing: 'left' | 'right' = 'right';
  let anchorX = 0;
  let anchorY = 0;
  let disposed = false;

  const surface: SurfaceHandle = {
    textureKey: options.textureKey,
    widthPx: spec.widthPx,
    heightPx: spec.heightPx,
  };

  /** Rebuild the part list. Called at create and whenever a choice changes. */
  const dress = (): void => {
    for (const view of parts) view.object.destroy();
    parts = [];

    for (const part of [...rig.parts].sort((a, b) => a.z - b.z)) {
      const resolved = resolveFrameTemplate(part.frame, chosen);
      if (resolved === null) continue;
      const frame = `${rig.atlas.framePrefix}${resolved}`;
      /* "A part whose resolved template is not in `frames` draws nothing." That
         is how every "none" option works, and it is also what keeps a
         half-packed atlas from throwing on the first frame. */
      const window = rig.frames[frame];
      if (window === undefined) continue;
      if (!options.frames.hasFrame(options.textureKey, frame)) continue;

      const object = options.host.createPart(part);
      object.setTexture(options.textureKey, frame);
      object.setDepth(baseDepth + part.z);
      object.setVisible(true);
      parts.push({ part, object, frame, window });
    }
  };

  /**
   * Place every part for the current state, time, facing and anchor.
   *
   * ### Where a part goes, and the bug this arithmetic replaced
   *
   * Two parts can share one frame — `arm-upper-r` and `arm-upper-l` are both
   * `arm-upper-{costume}` — because "arms are symmetric about x = 120, so one
   * frame serves both and the rig mirrors the far one" (`rig-contract.md` §7).
   * The frame's window is stated in character space for the arm it was drawn
   * for; the other arm is that window **reflected about `centreX`**, with the
   * art flipped.
   *
   * The first version of this put the rotation origin at
   * `(pivot - window.x) / window.w` for every part, which is only right for the
   * arm the frame was authored for. For its mirrored twin the pivot lies outside
   * the window — `(60 - 166) / 41` is **-2.6** — and the limb was drawn two and
   * a half of its own widths away from the body. It looked exactly like what it
   * was: a detached red arm floating beside the officer.
   *
   * So the window is reflected when the part is, and the pivot fraction is
   * measured against the *reflected* window. Checked against the shipped rig:
   * `arm-lower-serge` occupies 166..207, the left arm's pivot 185 sits inside
   * it, and reflected about 120 the window is 33..74 with the right arm's pivot
   * 55 inside that. Both arms land on the body.
   *
   * Facing composes with the same mechanism rather than fighting it: turning the
   * character reflects every pivot about `centreX` and flips each part's mirror
   * flag, so a left-facing officer is the right-facing one reflected, part for
   * part.
   */
  const paint = (): void => {
    const animation = rig.states[state];
    const keys = animation?.keys ?? [];
    const duration = animation?.durationMs ?? 0;
    const t = phaseOf(animation?.loop ?? 'loop', stateElapsedMs, duration);
    const flipComposite = facing === 'left';
    const centre = space.centreX;

    for (const view of parts) {
      const transform = partTransformAt(keys, view.part.name, t);
      const mirrored = view.part.mirrorX !== flipComposite;

      /* The pivot in character space, reflected with the composite. */
      const pivotX = flipComposite ? 2 * centre - view.part.pivot[0] : view.part.pivot[0];
      const pivotY = view.part.pivot[1];
      /* The window the art actually occupies, reflected when the part is. */
      const left = mirrored ? 2 * centre - (view.window.x + view.window.w) : view.window.x;

      view.object.setOrigin(
        view.window.w > 0 ? (pivotX - left) / view.window.w : 0.5,
        view.window.h > 0 ? (pivotY - view.window.y) / view.window.h : 0.5,
      );
      view.object.setPosition(
        anchorX + (pivotX - centre) + (flipComposite ? -transform.dx : transform.dx),
        anchorY + (pivotY + transform.dy - space.soleY),
      );
      view.object.setAngle(flipComposite ? -transform.rotation : transform.rotation);
      view.object.setFlipX(mirrored);
    }
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
        `the rig declares no state-machine input "${input}".`,
        { character: spec.characterId, input, declared: [...kinds.keys()] },
      );
    }
    if (declared !== kind) {
      return appErr(
        'invalid',
        'character.input.wrongKind',
        `state-machine input "${input}" is a ${declared}, not a ${kind}.`,
        { character: spec.characterId, input, declared, used: kind },
      );
    }
    if (value === null) pending = input;
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
          `the rig has no skin slot "${slot}".`,
          { character: spec.characterId, slot, declared: [...optionsBySlot.keys()] },
        );
      }
      if (!available.includes(option)) {
        return appErr(
          'not-found',
          'character.skin.unknown',
          `skin slot "${slot}" has no option "${option}".`,
          { character: spec.characterId, slot, option, declared: available },
        );
      }
      chosen.set(slot, option);
      dress();
      paint();
      return ok();
    },

    setExpression(next: ExpressionName) {
      if (disposed) return disposedError(spec.characterId);
      if (!rig.expressions.names.includes(next)) {
        return appErr(
          'not-found',
          'character.expression.unknown',
          `the rig has no expression "${next}".`,
          { character: spec.characterId, expression: next, declared: rig.expressions.names },
        );
      }
      expression = next;
      chosen.set('expression', expression);
      dress();
      paint();
      return ok();
    },

    setFacing(next) {
      if (disposed || next === facing) return;
      facing = next;
      paint();
    },

    setPosition(x, y) {
      if (disposed) return;
      /* A standing NPC is told where it is every frame and has not moved. Twenty
         parts re-placed for an unchanged anchor is per-frame work that buys
         nothing, and per-frame work is the budget the perf suite no longer
         blocks on (it reports), so it is refused here rather than measured
         later. */
      if (x === anchorX && y === anchorY) return;
      anchorX = x;
      anchorY = y;
      paint();
    },

    update(deltaMs) {
      if (disposed || !Number.isFinite(deltaMs) || deltaMs < 0) return;

      const next =
        selectState(rig.selector.rules, {
          value: (name) => values.get(name),
          pending,
        }) ?? IDLE_STATE;

      if (next !== state) {
        state = next;
        stateElapsedMs = 0;
      } else {
        stateElapsedMs += deltaMs;
      }

      /* A `once` state holds the trigger until it has played out — which is what
         the selector's "and its state has not finished" means — and releases it
         after, so `fire` is a pulse rather than a mode nobody clears. */
      const animation = rig.states[state];
      if (
        pending !== null &&
        (animation === undefined ||
          animation.loop !== 'once' ||
          stateElapsedMs >= animation.durationMs)
      ) {
        pending = null;
      }

      paint();
    },

    estimatedTextureBytes(): number {
      /* Zero, and the reason is in the header: the atlas is a shared file that
         `make check-textures` already weighs. Twenty parts on one page cost one
         page, however many characters compose from it. */
      return 0;
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const view of parts) view.object.destroy();
      parts = [];
      values.clear();
    },
  };

  dress();
  /*
   * An empty puppet is a failure, not a character.
   *
   * Skipping a part whose frame is absent is how every "none" option works and
   * must stay. Skipping *every* part means the atlas was not packed, or was
   * packed for a different rig — and what the caller would get back is a
   * renderer that reports itself built, updates sixty times a second and draws
   * nothing. That is a fallback nobody can observe, which is the defect class
   * this whole file's header is about, so it is refused here and the scene draws
   * a placeholder it can count.
   */
  if (parts.length === 0) {
    return appErr(
      'not-found',
      'character.atlas.noParts',
      `not one of the rig's ${String(rig.parts.length)} parts resolved to a frame in texture ` +
        `"${options.textureKey}", so this character would be built and draw nothing.`,
      { character: spec.characterId, textureKey: options.textureKey, parts: rig.parts.length },
    );
  }
  paint();
  return ok(renderer);
}

/** Normalised time within a state, honouring `loop`, `once` and `hold`. */
export function phaseOf(loop: 'loop' | 'once' | 'hold', elapsedMs: number, durationMs: number): number {
  if (!(durationMs > 0) || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  const phase = elapsedMs / durationMs;
  if (loop === 'loop') return phase % 1;
  /* `once` and `hold` both stop on the last key; what differs is whether the
     selector is allowed to move on, which `update` decides, not this. */
  return Math.min(1, phase);
}

/** The rig's slots as pairs, minus the reserved ones, in declaration order. */
function slotEntries(rig: RigDocument): readonly (readonly [string, RigSlot])[] {
  return Object.entries(rig.slots).filter(([, slot]) => slot.status !== 'reserved');
}

/**
 * The spec checks both backends make, in the same order and with the same codes.
 *
 * Duplicated in `app/adapters/rive/character-renderer.ts` rather than shared:
 * adapters never import each other (ADR-0005), a port carries interfaces only,
 * and `common/` is not one backend's validation table. The duplication is pinned
 * by `tests/unit/adapters/character-renderer-swap.test.ts`, which puts the same
 * malformed specs through both factories and requires the same code from each.
 */
export function validateSpec(spec: CharacterRendererSpec): Result<never> | null {
  const rig = spec.rig;

  if (rig.parts.length === 0) {
    return appErr(
      'invalid',
      'character.rig.noParts',
      'the rig declares no parts, so a character would draw nothing.',
      { character: spec.characterId },
    );
  }

  /* A rule naming a state nobody has transcribed would never fire, and the
     character would silently stay in whatever state came before it. */
  const unknownRules = rig.selector.rules
    .map((rule) => rule.state)
    .filter((state) => STATE_CONDITIONS[state] === undefined);
  if (unknownRules.length > 0) {
    return appErr(
      'unsupported',
      'character.rig.unknownState',
      `the rig's selector names ${unknownRules.join(', ')}, which this backend has no ` +
        `condition for. The rules' order and membership are data; what each named state ` +
        `means is code, and a state with no condition would never be selected.`,
      { character: spec.characterId, states: unknownRules },
    );
  }

  for (const [name, slot] of slotEntries(rig)) {
    if (slot.fallback !== null && !slot.options.includes(slot.fallback)) {
      return appErr(
        'invalid',
        'character.rig.fallbackMissing',
        `skin slot "${name}" falls back to "${String(slot.fallback)}", which is not one of ` +
          `its options.`,
        { character: spec.characterId, slot: name, fallback: slot.fallback, options: slot.options },
      );
    }
  }

  const declared = new Map(slotEntries(rig));
  for (const [slot, option] of Object.entries(spec.skins)) {
    const found = declared.get(slot);
    if (found === undefined) {
      return appErr('not-found', 'character.slot.unknown', `the rig has no skin slot "${slot}".`, {
        character: spec.characterId,
        slot,
      });
    }
    if (!found.options.includes(option)) {
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

function disposedError(character: unknown): Result<never> {
  return appErr(
    'conflict',
    'character.disposed',
    `character "${String(character)}" has been disposed; the instance is dead.`,
    { character },
  );
}
