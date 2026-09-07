/**
 * Engine-facing ports. Interfaces only — no three/rapier/DOM types leak in.
 * Implemented under app/adapters/*, wired in app/bootstrap.
 */
import type { LocalizedText, Locale } from '@domain/ids';
import type { Soundscape, Vec3 } from '@domain/district';

export interface LocalizerPort {
  readonly locale: Locale;
  t(key: string, params?: Record<string, string | number>): string;
  pick(text: LocalizedText): string;
  setLocale(locale: Locale): Promise<void>;
  onChange(handler: (locale: Locale) => void): () => void;
}

export interface InputState {
  /** -1..1 strafe (x) and forward (y). */
  readonly move: { readonly x: number; readonly y: number };
  /** Look delta this frame in radians. */
  readonly look: { readonly dx: number; readonly dy: number };
  readonly sprint: boolean;
  readonly jump: boolean;
}

export type InputAction = 'forward' | 'back' | 'left' | 'right' | 'sprint' | 'jump' | 'interact' | 'journal' | 'pause';

export interface InputPort {
  poll(): InputState;
  /** True once per press. */
  consume(action: InputAction): boolean;
  setBindings(bindings: Readonly<Record<string, string>>): void;
  /** Suspend gameplay input while UI is open. */
  setEnabled(enabled: boolean): void;
  readonly pointerLocked: boolean;
  requestPointerLock(): void;
  releasePointerLock(): void;
  /** Human-readable label for the key bound to an action (for HUD prompts). */
  keyLabel(action: InputAction): string;
}

export type ColliderHandle = number;

export interface PhysicsWorldPort {
  init(): Promise<void>;
  addHeightfield(center: Vec3, size: number, heights: Float32Array, rows: number, cols: number, maxHeight: number): ColliderHandle;
  addBox(center: Vec3, halfExtents: Vec3, rotationY?: number): ColliderHandle;
  addCylinder(center: Vec3, halfHeight: number, radius: number): ColliderHandle;
  removeCollider(handle: ColliderHandle): void;
  createCharacter(position: Vec3, radius: number, halfHeight: number): ColliderHandle;
  /** Move a character by a desired displacement; returns the new position and grounded flag. */
  moveCharacter(handle: ColliderHandle, desired: Vec3): { position: Vec3; grounded: boolean };
  setCharacterPosition(handle: ColliderHandle, position: Vec3): void;
  step(dt: number): void;
  clearStatic(): void;
}

export interface AudioPort {
  /** Crossfade to a zone's loop and start its scheduled one-shots (see docs/audio.md). */
  setSoundscape(zone: Soundscape): void;
  /** Loop only, no one-shots — equivalent to setSoundscape({ loop: id, oneshots: [], volume: 0.45 }). */
  playAmbience(id: string): void;
  stopAmbience(): void;
  playSfx(id: 'click' | 'correct' | 'wrong' | 'stamp' | 'step'): void;
  setMasterVolume(v: number): void;
  duck(enabled: boolean): void;
}

export interface RenderStats {
  readonly fps: number;
  readonly frameMs: number;
  readonly drawCalls: number;
  readonly triangles: number;
  readonly memoryMb: number;
}
