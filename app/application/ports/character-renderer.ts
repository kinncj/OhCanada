/**
 * ICharacterRenderer — the Rive / sprite-sheet seam from ADR-0001.
 *
 * Characters ship as Rive files driven by a state machine. On a device where the
 * Rive runtime is too expensive (or unavailable), the same character plays from a
 * sprite atlas. Gameplay code must not be able to tell which one it got, so this
 * port is written in the vocabulary both can honour:
 *
 *  - a **named artboard** — a Rive artboard, or an atlas namespace;
 *  - **state-machine inputs** — booleans, numbers and triggers, or the animation
 *    selector a sprite adapter derives from exactly those values;
 *  - **skin slots** — Rive runtime-swappable slots, or frame prefixes in the atlas.
 *    *The slot and option names are identical in both* (CLAUDE.md, Characters);
 *    that identity is what makes the fallback a swap rather than a port;
 *  - **expressions** — a named face pose, resolved by the same name in either;
 *  - **per-frame update** with a delta, and an explicit **dispose**.
 *
 * Deliberately absent: any DOM or Phaser type. The renderer publishes its output
 * under a texture key that the scene adapter binds; bootstrap agrees the key.
 * `estimatedTextureBytes` is here because characters are charged against the 64 MB
 * per-level decoded-texture budget like any other asset.
 *
 * The ADR-0008 marker that stood here is gone: slice 1 task 1.12 landed both
 * implementations — `app/adapters/rive` and `app/adapters/phaser`'s sprite
 * fallback — and the licence that marker carried to change this interface
 * without an ADR was used once, here:
 *
 *   `CharacterRendererSpec` now carries the **rig contract itself** — the
 *   declared inputs, the declared slots and their options — rather than only the
 *   caller's chosen skins. Before, each backend had to be told the vocabulary
 *   some other way, and "the slot names are identical in both" (CLAUDE.md,
 *   Characters) was a convention two files had to keep. Now both backends read
 *   the *same field of the same spec*, which comes from the *same*
 *   `content/characters/<id>.json`, so the names cannot drift: the identity is
 *   structural rather than agreed. That is the difference between a seam and two
 *   parallel implementations.
 */

import type { CharacterId } from '@domain/ids';
import type { Result } from '@common/result';
import type { RigDocument } from './content-repository';

export type ArtboardName = string;
export type StateMachineName = string;

/** Input names are content, not code: they come from the character document. */
export type InputName = string;

/** Slot names are fixed vocabulary so Rive and the atlas agree. */
export type SkinSlotName = string;
export type SkinOptionName = string;

/** Named face pose, e.g. `neutral`, `happy`, `thinking`, `surprised`. */
export type ExpressionName = string;

/**
 * Where the renderer publishes its frames. An opaque key, resolved by the scene
 * adapter against its own texture manager — the application never touches a canvas.
 */
export interface SurfaceHandle {
  readonly textureKey: string;
  readonly widthPx: number;
  readonly heightPx: number;
}

export interface CharacterRendererSpec {
  readonly characterId: CharacterId;
  readonly artboard: ArtboardName;
  readonly stateMachine: StateMachineName;
  /**
   * **The rig — the whole shared vocabulary, and the field that makes the
   * fallback a swap.**
   *
   * `content/characters/rig.json` (ADR-0017, ADR-0022): the parts, their draw
   * order, pivots and frame templates; the state machine's inputs; the selector
   * that orders them; the slots and their options; the animation states and
   * their keyframes; every atlas frame. Both backends answer `skinSlots`,
   * `skinOptions` and every input and expression out of *this* object, so the
   * names are identical because they are the same strings — not because two
   * adapters agreed to keep them so.
   *
   * It arrives here rather than being opened by an adapter, and that is the
   * ruling in ADR-0022: an adapter doing content I/O would bypass ajv
   * validation, the repository cache and `unload` — the last being how the
   * per-level texture budget is honoured at all.
   */
  readonly rig: RigDocument;
  /**
   * This character's choices over the rig's vocabulary: slot name -> option.
   *
   * A slot left out falls back to what the rig's own `artboards[]` entry ships
   * with, and then to the slot's `fallback`. A `fallback` is not a
   * pre-selection — no skin tone is the default (`assets/style/art-bible.md` §8)
   * — it is what an NPC wears and what save recovery uses.
   */
  readonly skins: Readonly<Record<SkinSlotName, SkinOptionName>>;
  /** One of `rig.expressions.names`. Omitted takes `rig.expressions.fallback`. */
  readonly expression?: ExpressionName;
  /** Render resolution; the renderer may clamp it to honour the texture budget. */
  readonly widthPx: number;
  readonly heightPx: number;
}

export interface ICharacterRenderer {
  readonly characterId: CharacterId;
  readonly artboard: ArtboardName;
  readonly surface: SurfaceHandle;

  /** Slots and options this instance actually offers, for validation and for tooling. */
  readonly skinSlots: readonly SkinSlotName[];
  skinOptions(slot: SkinSlotName): readonly SkinOptionName[];

  /** State-machine inputs. Unknown names fail as `not-found`, they never no-op silently. */
  setBool(input: InputName, value: boolean): Result<void>;
  setNumber(input: InputName, value: number): Result<void>;
  fire(trigger: InputName): Result<void>;

  setSkin(slot: SkinSlotName, option: SkinOptionName): Result<void>;
  setExpression(expression: ExpressionName): Result<void>;

  /** Horizontal facing; both backends mirror rather than duplicate art. */
  setFacing(facing: 'left' | 'right'): void;

  /**
   * Where the character stands, in design pixels: the point on the ground
   * between its feet, which is `characterSpace`'s `centreX` / `soleY`.
   *
   * On the port rather than left to the scene because a caller must be able to
   * move a character without knowing which backend drew it. The sprite backend
   * places its twenty parts relative to this; the Rive backend records it, and
   * the scene reads it back when it positions the surface named by
   * {@link SurfaceHandle}. One anchor, one meaning, both backends.
   */
  setPosition(x: number, y: number): void;

  /**
   * Advance one frame. `deltaMs` is the frame delta, already scaled by the game's
   * time scale, so pausing the game pauses the character. Under reduced motion the
   * caller may pass a clamped delta; the renderer does not read settings itself.
   */
  update(deltaMs: number): void;

  /**
   * Decoded bytes this instance holds, counted against the per-level budget.
   *
   * **The two backends' numbers are not comparable, and a caller that adds them
   * together is wrong.** The sprite backend returns `0` because its frames live
   * in an atlas that `make check-textures` already weighs — charging it again
   * per instance would count one page once per character sharing it. The Rive
   * backend returns a real `width x height x 4`, because its surface is sized by
   * the *display*, ships in no file, and is invisible to that gate:
   * `scripts/assets.mjs` records `decodedBytes: 0` for a `.riv` and is right to.
   *
   * So this method answers one question — *what does this instance hold that
   * nothing else has already counted?* — and the level loader adds it to what the
   * asset gate measured. Reading it as "how much memory does a character cost"
   * gives the sprite path a free ride and makes the two look like a fair
   * comparison, which is the specific lie this comment exists to prevent.
   */
  estimatedTextureBytes(): number;

  /** Release GPU and runtime resources. Idempotent; the instance is dead afterwards. */
  dispose(): void;
}

/**
 * Creating a renderer is async (a Rive file must load) and fallible, so it is a
 * separate port. Bootstrap picks the implementation; a level never asks for "Rive".
 */
export interface CharacterRendererFactory {
  readonly backend: 'rive' | 'sprite';
  create(spec: CharacterRendererSpec): Promise<Result<ICharacterRenderer>>;
  /** Drop shared, character-independent runtime assets. Called on level unload. */
  disposeShared(): void;
}
