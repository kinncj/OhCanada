/**
 * Moving focus so the player can *see* where it went.
 *
 * ## The defect this exists for
 *
 * `app/ui/focus-trap.ts` owns Tab inside every modal screen, and it moved focus
 * with `focus({ preventScroll: true })`. That flag is there for a good reason —
 * the browser's own "scroll focus into view" jumps the element to the middle of
 * the scroller, which on a sheet that is already showing the control reads as
 * the screen lurching — but nothing put the scroll back. So on a long screen a
 * keyboard player tabbed to a control below the fold and the page did not move:
 * the focus ring was real, the control was reachable, and neither was on screen.
 * Measured on the character creator at 390 × 844, where every stop after the
 * first sits between 1 106 px and 2 530 px down an 844 px viewport.
 *
 * The arrow keys never had the fault, because the screens that own a radio
 * group call `focus()` without the flag. Two different behaviours for the same
 * player on the same screen is the other half of the bug.
 *
 * ## What is done instead
 *
 * Focus without scrolling, then scroll **as little as possible**:
 * `block: 'nearest'` moves a control that is off screen just far enough to be
 * on it, and does nothing at all when it is already visible. One call, one
 * rule, for every screen — a screen that wants more than this (the question
 * card bringing a result and its way on into view together) still says so
 * itself.
 *
 * ## Reduced motion
 *
 * "Reduced motion removes animation, not information" (CLAUDE.md): the control
 * is still brought into view, it simply arrives instead of gliding.
 * {@link motionIsReduced} reads the axis the way every other screen does —
 * `data-tn-motion` from `applySettings`, or the device's own
 * `prefers-reduced-motion` — so the in-game setting and the operating system
 * each suffice, and neither can be overridden by the other.
 *
 * DOM only (ADR-0005): no adapters, no scenes, no engine.
 */

/**
 * Less movement, from the setting (`applySettings` writes `data-tn-motion`) or
 * from the device.
 *
 * Defensive about every step, because this runs under the unit suite's document
 * doubles as well as in a browser: a document with no `documentElement`, no
 * `defaultView` or no `matchMedia` reads as "full motion", which is the same
 * answer a browser gives when nobody has asked for stillness.
 */
export function motionIsReduced(doc: Document | null | undefined): boolean {
  const root = doc?.documentElement as HTMLElement | null | undefined;
  if (typeof root?.getAttribute === 'function' && root.getAttribute('data-tn-motion') === 'reduced') {
    return true;
  }
  const view = doc?.defaultView as (Window & typeof globalThis) | null | undefined;
  const query = view?.matchMedia as Window['matchMedia'] | undefined;
  try {
    return query?.call(view, '(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    /* A double whose `matchMedia` throws is not a player asking for stillness. */
    return false;
  }
}

/** How a scroll should move, for the motion the player asked for. */
export function scrollBehaviourFor(doc: Document | null | undefined): ScrollBehavior {
  return motionIsReduced(doc) ? 'auto' : 'smooth';
}

/**
 * Bring an element into view, moving as little as possible.
 *
 * A no-op where there is nothing to scroll: a document double with no layout,
 * or an element a caller detached between the focus and this call.
 */
export function revealInView(element: HTMLElement | null | undefined): void {
  if (element === null || element === undefined) return;
  const scroller = element as Partial<Pick<HTMLElement, 'scrollIntoView'>>;
  if (typeof scroller.scrollIntoView !== 'function') return;
  scroller.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
    behavior: scrollBehaviourFor(element.ownerDocument),
  });
}

/**
 * Move focus to an element **and** make sure it can be seen.
 *
 * The pair is one call on purpose: the flag and the scroll belong together, and
 * every place that separated them is a place where focus went somewhere nobody
 * could see. Safe on an element with no `focus`, for the document doubles.
 */
export function focusAndReveal(element: HTMLElement | null | undefined): void {
  if (element === null || element === undefined) return;
  if (typeof element.focus === 'function') element.focus({ preventScroll: true });
  revealInView(element);
}
