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
 * PROVISIONAL (ADR-0008) — nothing imports this port and nothing implements it
 * yet. First call sites: slice 1 task 1.11 (the Rive rig contract) and 1.12 (both
 * renderers). Whoever writes the first implementation may change this interface
 * without an ADR, and removes this marker in the same change.
 */

import type { CharacterId } from '@domain/ids';
import type { Result } from '@common/result';

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
  /** Initial skin choice per slot. Missing slots use the artboard default. */
  readonly skins: Readonly<Record<SkinSlotName, SkinOptionName>>;
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
   * Advance one frame. `deltaMs` is the frame delta, already scaled by the game's
   * time scale, so pausing the game pauses the character. Under reduced motion the
   * caller may pass a clamped delta; the renderer does not read settings itself.
   */
  update(deltaMs: number): void;

  /** Decoded bytes this instance holds, counted against the per-level budget. */
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
