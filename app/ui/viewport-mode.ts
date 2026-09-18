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

/**
 * **Who** is playing, as opposed to **how the game is laid out**.
 *
 * {@link ViewportMode} answers a layout question and this answers an audience
 * one, and they are different questions with different answers on the same
 * device: an iPad held upright is `portrait` — it gets the design layout, and
 * nothing about it is wrong — and it is still not a phone. `classifyViewport`
 * cannot say that, because it has no reason to: 768x1024 and 390x844 want
 * exactly the same canvas.
 *
 *  - `phone-portrait` — the device the game is made for. Nothing is said to it.
 *  - `phone-landscape` — a phone turned sideways. The rotate overlay's case, and
 *    **only** the rotate overlay's case.
 *  - `large` — a desktop window, a laptop or a tablet, in either orientation.
 *    A supported platform (CLAUDE.md, Orientation; ADR-0002, ADR-0055): the same
 *    portrait canvas, centred, with the level's own sky and ground in the side
 *    panels. It is told once that a phone suits the game better, and nothing
 *    else happens to it.
 */
export type ViewportAudience = 'phone-portrait' | 'phone-landscape' | 'large';

/**
 * Classify who is playing.
 *
 * **Derived from {@link classifyViewport} rather than measured again**, and that
 * is the whole design of this function. The sideways-phone case and the notice's
 * case have to be mutually exclusive — a player may never be both paused by a
 * modal and nudged by a notice — and the cheap way to get that wrong is two
 * predicates over two sets of numbers that agree today and drift apart the first
 * time one breakpoint moves. Here `phone-landscape` is returned on exactly the
 * branch where `classifyViewport` returned `landscape-phone`, so the two answers
 * cannot disagree without the same line being edited twice.
 *
 * A degenerate viewport is `phone-portrait`, for the same reason it is
 * `portrait` above: the failure mode of guessing wrong is a notice shown to a
 * player it is not about.
 */
export function classifyAudience(
  width: number,
  height: number,
  phoneShortSidePx: number = PHONE_SHORT_SIDE_PX,
): ViewportAudience {
  const mode = classifyViewport(width, height, phoneShortSidePx);
  if (mode === 'landscape-phone') return 'phone-landscape';
  /* `wide` is a viewport wider than it is tall whose short side is over the
     breakpoint: a desktop window or a tablet on its side. */
  if (mode === 'wide') return 'large';

  /*
   * `portrait`, which is two different devices: the phone the game is made for,
   * and a tablet or a tall desktop window held upright. Only the short side can
   * tell them apart, and it is the same breakpoint and the same guard as above
   * — a viewport this function cannot measure is treated as the phone, so
   * nothing is said.
   */
  if (!isUsable(width) || !isUsable(height)) return 'phone-portrait';
  const breakpoint = isUsable(phoneShortSidePx) ? phoneShortSidePx : PHONE_SHORT_SIDE_PX;
  return Math.min(width, height) > breakpoint ? 'large' : 'phone-portrait';
}

/**
 * The portrait notice exists for exactly one audience, and never for the one the
 * rotate overlay exists for.
 *
 * It is **not** the negation of "a phone in portrait": that would include a
 * phone turned sideways, which is already being asked to turn back, and two
 * things saying two different things about the same device is the defect this
 * pair of functions is written to make unrepresentable.
 */
export function shouldShowPortraitNotice(audience: ViewportAudience): boolean {
  return audience === 'large';
}
