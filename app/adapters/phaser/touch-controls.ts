/**
 * Touch controls — the finger acts on the world, not on a picture of a gamepad.
 *
 * There is no d-pad here, no thumbstick and no on-canvas button, and there must
 * never be one. The canvas is `aria-hidden` (CLAUDE.md, Accessibility) so
 * anything drawn on it is invisible to a screen reader by construction, and a
 * virtual controller is a 44-pt target that only exists as pixels: it cannot be
 * focused, cannot be labelled and cannot be reached by a switch. Everything this
 * module does is derived from where the finger is relative to *the player*.
 *
 * ## The three rules, and the reason each is written this way
 *
 * **Hold anywhere to walk, and the direction comes from the player.** Not from
 * which half of the screen was touched. TrueNorth is portrait with a scrolling
 * camera, and the player is almost never in the middle of it: Ottawa's camera
 * carries a 140 px lead offset, so a player walking right sits at x ≈ 400 of
 * 1080 and a player walking left sits at x ≈ 680. A screen-half rule therefore
 * inverts under the player's own thumb every time they turn round, and inverts
 * again whenever the camera clamps at a world edge. "Right of the player" does
 * not, ever.
 *
 * **Tap to jump.** A tap is a press that ends quickly and without travel;
 * anything else is a hold.
 *
 * **Tap an NPC or a POI to engage it**, and that beats the jump — so
 * `hitTest` runs first and the jump is what is left when it finds nothing.
 *
 * ## The thresholds, and why they are these numbers
 *
 * `TAP_MAX_MS` and `TAP_MAX_TRAVEL_PX` are one boundary, not two: a press is a
 * *candidate tap* until it crosses either of them, and a *hold* forever after.
 * Mutually exclusive is the whole point. The obvious alternative — start walking
 * on press and also fire a jump if the release came quickly — makes every tap
 * that is not directly above the player nudge the player sideways first, and on
 * a gliding mode (Ottawa's skate has `glide: 0.9`) that nudge slides for half a
 * second after the jump. One boundary means a tap never moves anybody and a hold
 * never jumps.
 *
 * The cost of that choice, stated plainly, is that a walk cannot start until the
 * press is known not to be a tap: up to `TAP_MAX_MS` of latency at the start of
 * a hold. So `TAP_MAX_MS` is set at the low end of what still recognises a
 * deliberate tap rather than at the high end of what feels like a long press.
 * Measured tap durations (finger down to finger up, no drag) cluster between 60
 * and 120 ms; 160 ms sits above essentially all of them and is less than a third
 * of the 500 ms both iOS and Android use for a long press, so it cannot be
 * confused with one. It is also under the ~200 ms at which a direct-manipulation
 * control starts reading as unresponsive, and `JumpAffordance.bufferMs` (120 ms
 * in Ottawa) already forgives a jump resolved a frame or two late.
 *
 * `TAP_MAX_TRAVEL_PX` is 24 *design* pixels. The design resolution is 1080 wide
 * and a phone canvas is 390 CSS px wide, so 24 design px is about 8.7 CSS px —
 * roughly 2 mm of glass. That is comfortably above the jitter a still finger
 * produces on a capacitive screen and well below a movement anyone means. It is
 * also the escape hatch from the latency above: a player who presses and slides
 * even slightly gets their walk with no delay at all.
 *
 * `WALK_DEADZONE_PX` is 60 design px either side of the player, so a 120 px band.
 * Two independent reasons land on the same number. It has to be at least as wide
 * as the player's own body (`ACTOR_WIDTH` is 68 px) because you cannot mean
 * "left of" a thing you are touching; and 120 design px is 44 CSS px on a
 * 390-wide phone, which is the 44 pt minimum touch target CLAUDE.md requires. A
 * band narrower than a fingertip would pick a direction from noise.
 *
 * ## Two things that are easy to get wrong, and are handled here
 *
 * **A stalled hold is still a tap.** A press that lives past `TAP_MAX_MS` inside
 * the dead zone picks no direction, so under a duration-only rule it is a walk
 * that goes nowhere and the tap is swallowed: the player pressed the screen and
 * *nothing happened*, which is indistinguishable from a broken game. So a press
 * that owned the axis and never once produced a direction is a tap when it is
 * released, however long it lasted.
 *
 * **A cancelled pointer must not leave a direction latched.** A notification
 * shade, an incoming call or a system gesture ends a touch with `touchcancel`
 * and no `touchend`. If that is not handled the player walks into the sea while
 * looking at their notifications. `cancel` and `cancelAll` drop a press without
 * ever calling it a tap.
 *
 * This module holds no Phaser and no DOM: it takes points in design-space view
 * pixels and answers with a number and a nullable point. `level-scene.ts` is
 * where real pointer events are read.
 */

/**
 * How long a press may last and still be a tap, in milliseconds.
 * The reasoning is in the header; this is also the worst-case latency before a
 * hold starts walking, which is why it is not larger.
 */
export const TAP_MAX_MS = 160;

/** How far a press may travel and still be a tap, in design pixels. */
export const TAP_MAX_TRAVEL_PX = 24;

/** Half-width of the band around the player in which no direction is chosen. */
export const WALK_DEADZONE_PX = 60;

/** CLAUDE.md's minimum touch target. Points, converted per device by `minTouchTargetPx`. */
export const MIN_TOUCH_TARGET_PT = 44;

/**
 * The canvas width assumed when the real one cannot be measured, in CSS pixels.
 *
 * The narrowest phone still in common use, so the fallback errs towards the
 * *largest* hit area rather than the smallest — an unmeasurable canvas must not
 * silently shrink a target below the accessible minimum.
 */
export const FALLBACK_CANVAS_CSS_WIDTH = 320;

/** A point in design-space view pixels: (0, 0) is the top-left of the canvas. */
export interface ViewPoint {
  readonly x: number;
  readonly y: number;
}

/** An axis-aligned rectangle in whatever space the caller is working in. */
export interface TargetRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Something a tap can engage. `rect` is the art; the hit area is grown from it. */
export interface TouchTarget {
  readonly id: string;
  readonly npc: boolean;
  readonly rect: TargetRect;
}

/** -1, 0 or 1. Locomotion applies its own dead zone to this (`MOVE_DEADZONE`). */
export type WalkAxis = -1 | 0 | 1;

export interface TouchControls {
  /** A finger went down. */
  press(id: number, at: ViewPoint, timeMs: number): void;
  /** A finger moved. Ignored for a pointer that is not down. */
  drag(id: number, at: ViewPoint, timeMs: number): void;
  /**
   * A finger came up. Returns where to hit-test if the press was a tap, and
   * `null` if it was a hold, a cancelled pointer or a pointer we never saw.
   */
  release(id: number, timeMs: number): ViewPoint | null;
  /** The browser took this pointer away. Never a tap. */
  cancel(id: number): void;
  /** Every pointer at once: a blurred window, a paused game, a scene shutdown. */
  cancelAll(): void;
  /**
   * The walk axis for this frame, given where the player is on screen.
   *
   * Called once per frame, and it is also where a press is promoted from
   * candidate tap to hold by the passage of time — nothing else fires when a
   * finger simply stays still.
   */
  axis(playerViewX: number, timeMs: number): WalkAxis;
  /** How many pointers are down. */
  readonly active: number;
}

interface Press {
  readonly id: number;
  readonly startX: number;
  readonly startY: number;
  readonly startedAt: number;
  x: number;
  y: number;
  /** Travelled past `TAP_MAX_TRAVEL_PX`, so it can never be a tap. */
  travelled: boolean;
  /** Past the tap boundary by time or by travel. */
  hold: boolean;
  /** The latched walk direction. Only the oldest press ever has one. */
  direction: WalkAxis;
  /** Did this press ever actually ask the player to move? */
  drove: boolean;
}

export interface TouchControlsOptions {
  readonly tapMaxMs?: number;
  readonly tapMaxTravelPx?: number;
  readonly deadZonePx?: number;
}

export function createTouchControls(options: TouchControlsOptions = {}): TouchControls {
  const tapMaxMs = options.tapMaxMs ?? TAP_MAX_MS;
  const tapMaxTravelPx = options.tapMaxTravelPx ?? TAP_MAX_TRAVEL_PX;
  const deadZonePx = options.deadZonePx ?? WALK_DEADZONE_PX;

  /**
   * Down pointers, oldest first.
   *
   * An array rather than a map because the order *is* the rule: the oldest
   * press owns the walk axis and every other finger is along for the ride. That
   * is what makes "two fingers cannot ask for two directions" true by
   * construction rather than by a conflict-resolution pass that has to be got
   * right for every ordering. A second finger is still free to tap, which is how
   * a player walking with one thumb jumps with the other.
   */
  const presses: Press[] = [];

  const indexOf = (id: number): number => presses.findIndex((press) => press.id === id);

  const isHold = (press: Press, timeMs: number): boolean =>
    press.hold || press.travelled || timeMs - press.startedAt >= tapMaxMs;

  const drop = (id: number): Press | undefined => {
    const index = indexOf(id);
    return index < 0 ? undefined : presses.splice(index, 1)[0];
  };

  return {
    get active(): number {
      return presses.length;
    },

    press(id: number, at: ViewPoint, timeMs: number): void {
      /* A second `press` for a live id would leave two entries with the same id
         and `release` would drop the wrong one. Browsers do not do this; a
         replayed trace does. */
      drop(id);
      presses.push({
        id,
        startX: at.x,
        startY: at.y,
        startedAt: timeMs,
        x: at.x,
        y: at.y,
        travelled: false,
        hold: false,
        direction: 0,
        drove: false,
      });
    },

    drag(id: number, at: ViewPoint, _timeMs: number): void {
      const press = presses[indexOf(id)];
      if (press === undefined) return;
      press.x = at.x;
      press.y = at.y;
      const dx = at.x - press.startX;
      const dy = at.y - press.startY;
      if (dx * dx + dy * dy > tapMaxTravelPx * tapMaxTravelPx) {
        press.travelled = true;
        press.hold = true;
      }
    },

    release(id: number, timeMs: number): ViewPoint | null {
      /* `find` rather than an index, so "we never saw this pointer" is the only
         way to get `undefined` here. Looking it up twice would need a second,
         unreachable guard after the splice — a line no test can ever cover, and
         therefore a line nobody could tell had stopped being unreachable. */
      const press = presses.find((candidate) => candidate.id === id);
      if (press === undefined) return null;
      /* Read before the splice: "was this the axis owner" is a fact about the
         moment of release, and the answer changes the instant it is removed. */
      const owned = presses[0] === press;
      presses.splice(presses.indexOf(press), 1);

      const stalled = owned && !press.drove && !press.travelled;
      if (isHold(press, timeMs) && !stalled) return null;
      return { x: press.x, y: press.y };
    },

    cancel(id: number): void {
      drop(id);
    },

    cancelAll(): void {
      presses.length = 0;
    },

    axis(playerViewX: number, timeMs: number): WalkAxis {
      const press = presses[0];
      if (press === undefined) return 0;

      if (timeMs - press.startedAt >= tapMaxMs) press.hold = true;
      if (!press.hold) return 0;
      if (!Number.isFinite(playerViewX)) return press.direction;

      const delta = press.x - playerViewX;
      /*
       * A Schmitt trigger, not a fresh comparison.
       *
       * Without the latch, a player walking right passes under a stationary
       * finger, the sign flips, and they stall and judder on the spot under a
       * thumb that never moved — which would make "hold anywhere to walk" false
       * exactly when the hold is working. Once a direction is chosen it survives
       * until the finger is *clearly* on the other side, a full dead zone past
       * the player, which is a movement the player has to mean.
       */
      if (press.direction === 1) press.direction = delta < -deadZonePx ? -1 : 1;
      else if (press.direction === -1) press.direction = delta > deadZonePx ? 1 : -1;
      else press.direction = delta > deadZonePx ? 1 : delta < -deadZonePx ? -1 : 0;

      if (press.direction !== 0) press.drove = true;
      return press.direction;
    },
  };
}

/* ------------------------------------------------------------- hit testing -- */

/**
 * 44 pt in design pixels, for the canvas the player is actually touching.
 *
 * Not a constant, because the design resolution is fixed at 1080x1920 and the
 * canvas is not: `Scale.FIT` puts 1080 design pixels across 390 CSS pixels on a
 * phone and across roughly 500 on a centred desktop portrait canvas, so the same
 * 44 pt is 122 design pixels in one case and 95 in the other. Hard-coding either
 * number makes the target too small on one of them, and "too small" is a defect
 * rather than a preference (CLAUDE.md, Accessibility).
 */
export function minTouchTargetPx(designWidth: number, canvasCssWidth: number): number {
  if (!Number.isFinite(designWidth) || designWidth <= 0) return 0;
  const css =
    Number.isFinite(canvasCssWidth) && canvasCssWidth > 0
      ? canvasCssWidth
      : FALLBACK_CANVAS_CSS_WIDTH;
  return (MIN_TOUCH_TARGET_PT * designWidth) / css;
}

/**
 * The art's rectangle, grown about its centre until it is at least `minSize` on
 * both axes.
 *
 * Grow the hit area, never the art. An NPC drawn 40 px wide is drawn 40 px wide;
 * what changes is how much of the glass around them counts as them.
 */
export function grownRect(rect: TargetRect, minSize: number): TargetRect {
  const size = Number.isFinite(minSize) && minSize > 0 ? minSize : 0;
  const width = Math.max(rect.width, size);
  const height = Math.max(rect.height, size);
  return {
    x: rect.x + rect.width / 2 - width / 2,
    y: rect.y + rect.height / 2 - height / 2,
    width,
    height,
  };
}

/**
 * Which target a tap landed on, or `null` for empty world.
 *
 * The caller filters the list to what is actually engageable first — reach is
 * the level's `InteractionAffordance`, not this function's business — so a tap
 * on something too far away finds nothing here and falls through to a jump,
 * which is the same thing that tapping the ground next to it does.
 *
 * Overlapping targets are resolved by which centre the tap is nearest, so the
 * grown hit area of a small NPC standing in front of a large landmark does not
 * make the landmark unreachable.
 */
export function hitTest<T extends TouchTarget>(
  targets: readonly T[],
  point: ViewPoint,
  minSize: number,
): T | null {
  let best: { target: T; distance: number } | null = null;
  for (const target of targets) {
    const rect = grownRect(target.rect, minSize);
    if (point.x < rect.x || point.x > rect.x + rect.width) continue;
    if (point.y < rect.y || point.y > rect.y + rect.height) continue;
    const dx = point.x - (rect.x + rect.width / 2);
    const dy = point.y - (rect.y + rect.height / 2);
    const distance = dx * dx + dy * dy;
    if (best === null || distance < best.distance) best = { target, distance };
  }
  return best === null ? null : best.target;
}
