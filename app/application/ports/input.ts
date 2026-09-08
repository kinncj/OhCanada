/**
 * InputPort — one intent vocabulary, four devices.
 *
 * Touch, keyboard, gamepad and a single switch all produce the same `GameAction`s,
 * so gameplay never asks which device is attached. Keyboard-only play and
 * single-switch mode are requirements, not options (CLAUDE.md, Accessibility).
 *
 * Keyboard bindings are keyed by `KeyboardEvent.code` — physical position, not the
 * character produced — so a rebind survives an AZERTY or Dvorak layout and so
 * "hold the left key" means the same key on every keyboard.
 *
 * The port is polled once per frame by the application, which turns a snapshot into
 * `LocomotionIntent`. Adapters do not push gameplay events onto the bus.
 *
 * PROVISIONAL (ADR-0008) — nothing imports this port and nothing implements it
 * yet. First call site: slice 1 task 1.15 (the DOM screens and the keyboard and
 * switch paths). Whoever writes the first implementation may change this
 * interface without an ADR, and removes this marker in the same change.
 */

import type { Result } from '@common/result';

export type GameAction =
  | 'move-left'
  | 'move-right'
  | 'jump'
  | 'interact'
  | 'pause'
  | 'confirm'
  | 'cancel'
  /** Single-switch and subtitle advance: one action that always moves forward. */
  | 'advance';

export type InputDevice = 'touch' | 'keyboard' | 'gamepad' | 'switch';

/**
 * `standard` — hold to move, tap to jump/interact.
 * `auto-move` — the player never holds a direction; movement is continuous.
 * `single-switch` — every input collapses to `advance`; movement is automatic and
 *   interaction is offered in sequence (CLAUDE.md: tap anywhere advances).
 */
export type InputProfile = 'standard' | 'auto-move' | 'single-switch';

/** `KeyboardEvent.code` values, in priority order, per action. */
export type KeyBindings = Readonly<Record<GameAction, readonly string[]>>;

/** Gamepad button indices per action, using the Standard Gamepad mapping. */
export type PadBindings = Readonly<Record<GameAction, readonly number[]>>;

/**
 * One frame's reading of the input devices.
 *
 * Named `InputFrame`, not `InputSnapshot`: `*Document`, `*Snapshot` and `*Bundle`
 * are reserved for authored or persisted document shapes, which
 * `tests/unit/contracts/ports-match-schemas.test.ts` walks and requires a schema
 * or a `SPECULATIVE` marker for (ADR-0007). This is a per-frame reading that is
 * never written anywhere, so it must not wear a document's name.
 */
export interface InputFrame {
  /** Actions held this frame. */
  readonly held: ReadonlySet<GameAction>;
  /** Actions that went down since the previous snapshot. */
  readonly pressed: ReadonlySet<GameAction>;
  /** Actions that came up since the previous snapshot. */
  readonly released: ReadonlySet<GameAction>;
  /** -1 … 1 analogue axis; digital devices report -1, 0 or 1. */
  readonly moveAxis: number;
  /** The device that produced the most recent input — drives prompt glyphs. */
  readonly lastDevice: InputDevice;
}

export interface InputPort {
  /** Sample once per frame. The returned frame is immutable and safe to keep. */
  sample(): InputFrame;

  readonly profile: InputProfile;
  setProfile(profile: InputProfile): void;

  getKeyBindings(): KeyBindings;
  /** Fails as `conflict` when one `code` is bound to two actions. */
  setKeyBindings(bindings: KeyBindings): Result<void>;
  getPadBindings(): PadBindings;
  setPadBindings(bindings: PadBindings): Result<void>;

  /**
   * Stop producing input without tearing down listeners — used while a DOM screen
   * has focus, so the canvas does not eat the keyboard from a modal.
   */
  setEnabled(enabled: boolean): void;
  readonly enabled: boolean;

  /** Detach every listener. Called on teardown. */
  dispose(): void;
}
