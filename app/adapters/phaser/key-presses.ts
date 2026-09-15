/**
 * Key presses that began between two frames. ADR-0043.
 *
 * ## The defect
 *
 * `level-scene.ts` read every key as a level — `Key.isDown`, once a frame — and
 * derived "a press began" by comparing that level with the previous frame's. A
 * key let go and pressed again between two frames reads down on both, so the
 * lift and the new press never happened as far as the level could tell; a key
 * pressed and let go between two frames reads up on both, so the press never
 * happened at all.
 *
 * Both are ordinary keyboard play, not automation artefacts. A frame is 33 ms at
 * the 30 fps Android target and longer on a slow one; a quick tap of Enter, or a
 * let-go-and-press-again of an arrow, fits inside one. A live-site audit met both
 * on Halifax: at the Town Clock a keyboard player pressed right fourteen times
 * and never moved, because each press was the same held key to the stop, and
 * Enter at a stop opened nothing. A finger never hit either: `touch-controls.ts`
 * holds a new press as a tap for its first 160 ms, so the level always sees a
 * frame of nothing between two holds.
 *
 * ## What this does
 *
 * Phaser's `Key` emits `down` once per real key-down — never for the browser's
 * auto-repeat while it is held — from the keyboard event itself, whenever that
 * arrives. The scene records each one here, and takes the set once a frame. The
 * level still decides *what is held* from `isDown`; this only answers *what was
 * pressed since the last frame*, which the level could not see.
 *
 * `forget` is for the moments the scene stops seeing the hands — a pause, a
 * blur — for the reason `AutoStopWatch.forgetInput` gives: a press made into a
 * card that has since closed is not a press into the level. It matters most for
 * `Enter` on a focused prompt: the key-down reaches the level and the prompt in
 * the same event, and the prompt's card pauses the level before the next frame.
 *
 * Pure: no Phaser, no DOM, no clock. Two sets swapped rather than one allocated
 * per frame, so taking the presses costs nothing on a frame nobody pressed.
 */

/** One frame's new presses, by the scene's own key names. */
export interface KeyPresses {
  /**
   * A key went down. `repeat` is the browser's auto-repeat, which is the same
   * press still held and never a new one.
   */
  down(name: string, repeat: boolean): void;
  /**
   * The keys that went down since the last call, and start a new frame.
   *
   * The set returned is valid until the next `take` or `forget`, which reuse it.
   */
  take(): ReadonlySet<string>;
  /** Drop every press not yet taken: the level stopped seeing the keys. */
  forget(): void;
}

export function createKeyPresses(): KeyPresses {
  let pending = new Set<string>();
  let taken = new Set<string>();

  return {
    down(name: string, repeat: boolean): void {
      if (repeat) return;
      pending.add(name);
    },
    take(): ReadonlySet<string> {
      const frame = pending;
      pending = taken;
      pending.clear();
      taken = frame;
      return frame;
    },
    forget(): void {
      pending.clear();
      taken.clear();
    },
  };
}

/** Did any of these keys go down in this frame's presses? */
export function pressedAny(presses: ReadonlySet<string>, names: readonly string[]): boolean {
  for (const name of names) {
    if (presses.has(name)) return true;
  }
  return false;
}

/**
 * Which way this frame's new presses point: -1, 0 or 1.
 *
 * Both ways at once is neither, for the reason `level-scene.ts`'s `clampAxis`
 * gives for two opposing held keys: the answer a player expects from two opposing
 * inputs is no direction.
 */
export function directionPressed(
  presses: ReadonlySet<string>,
  left: readonly string[],
  right: readonly string[],
): -1 | 0 | 1 {
  const towardLeft = pressedAny(presses, left);
  const towardRight = pressedAny(presses, right);
  if (towardLeft === towardRight) return 0;
  return towardRight ? 1 : -1;
}
