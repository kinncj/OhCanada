/**
 * Which of the three presentations the current viewport gets (ADR-0002).
 *
 * TrueNorth is portrait-only. There is no landscape layout to fall back to, so
 * the whole responsive story is this one enumeration:
 *
 *  - `portrait`         — the design case. The 1080x1920 canvas fits the window.
 *  - `landscape-phone`  — a phone turned sideways. Pause and ask for portrait.
 *  - `wide`             — desktop or tablet. The *same* portrait canvas, centred,
 *                         with the sky/ground colours extended into side panels.
 *
 * Pure by design: no `window`, no `matchMedia`, no DOM. The caller passes the
 * numbers it measured, which is what makes the rule unit-testable and what keeps
 * this file inside the "app/ui is DOM only" boundary without dragging the DOM
 * into a test (ADR-0005).
 */

export type ViewportMode = 'portrait' | 'landscape-phone' | 'wide';

/**
 * Short-side threshold, in CSS pixels, below which a landscape viewport is a
 * phone rather than a tablet.
 *
 * 600 is the classic "compact" breakpoint and it separates the two devices we
 * actually care about: an iPhone 15 Pro Max in landscape is 430 CSS px tall, an
 * iPad mini in landscape is 744. A tablet therefore lands in `wide` and keeps
 * playing, exactly as ADR-0002 requires.
 */
export const PHONE_SHORT_SIDE_PX = 600;

const isUsable = (value: number): boolean => Number.isFinite(value) && value > 0;

/**
 * Classify a viewport.
 *
 * @param width  Viewport width in CSS pixels.
 * @param height Viewport height in CSS pixels.
 * @param phoneShortSidePx Short-side breakpoint; defaults to {@link PHONE_SHORT_SIDE_PX}.
 *   A non-finite or non-positive value is ignored and the default is used.
 *
 * Square counts as portrait: it is the orientation the game is designed for, so
 * it is the answer that never interrupts play. Degenerate input (0, NaN, a
 * negative number from a browser mid-rotation) is also portrait, because the
 * failure mode of guessing wrong here is a rotate overlay covering a game the
 * player can see perfectly well.
 */
export function classifyViewport(
  width: number,
  height: number,
  phoneShortSidePx: number = PHONE_SHORT_SIDE_PX,
): ViewportMode {
  if (!isUsable(width) || !isUsable(height)) return 'portrait';
  if (height >= width) return 'portrait';

  const breakpoint = isUsable(phoneShortSidePx) ? phoneShortSidePx : PHONE_SHORT_SIDE_PX;
  const shortSide = Math.min(width, height);

  return shortSide <= breakpoint ? 'landscape-phone' : 'wide';
}

/** The rotate overlay exists for exactly one mode. Keeps the caller from re-deriving it. */
export function shouldShowRotateOverlay(mode: ViewportMode): boolean {
  return mode === 'landscape-phone';
}
