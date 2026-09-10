/**
 * Focus containment for modal DOM surfaces.
 *
 * `aria-modal="true"` is a promise to assistive technology: *nothing behind this
 * is reachable*. A screen reader honours it, but the browser's own Tab order does
 * not — so a dialog that sets the attribute without containing focus lies to
 * keyboard and switch users, who tab straight into live controls behind a screen
 * they cannot see. This module is the other half of that promise.
 *
 * Two mechanisms, because neither is sufficient alone:
 *
 *  - `inert` on everything outside the dialog removes the background from the
 *    Tab order, from hit-testing and from the accessibility tree. It is the
 *    correct primitive and it survives content added later, which matters: today
 *    nothing focusable sits behind the rotate overlay, and the moment slice 1
 *    adds a HUD button something does.
 *  - An explicit `Tab` handler, because a dialog with *no* focusable descendants
 *    (the rotate overlay: a heading and a paragraph) still loses focus to the
 *    document on the first Tab even with the whole background inert. Wrapping
 *    back to the container is the only way to hold it.
 *
 * DOM only, no adapters, no scenes (ADR-0005). Nothing here is Phaser-aware; the
 * caller decides when a surface becomes modal.
 */

/**
 * What the browser will put in the Tab order. Deliberately conservative: a
 * negative `tabindex` is programmatically focusable but not tabbable, so it is
 * excluded, and `[inert]` subtrees are filtered out at query time below.
 */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'details > summary:first-of-type',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex^="-"])',
].join(',');

/**
 * Live regions stay perceivable while a modal is open.
 *
 * `inert` strips a subtree from the accessibility tree, which would silence the
 * announcer (`app/ui/live-region.ts`) exactly when the player most needs to be
 * told what changed — "game paused", "turn your phone upright". A live region is
 * not interactive, so exempting it costs nothing in containment.
 */
export const PERCEIVABLE_WHILE_MODAL_SELECTOR =
  '[aria-live],[role="status"],[role="alert"],[role="log"]';

/**
 * Where `Tab` goes next inside a trap. Pure, and the only branching logic in
 * this file, so the wrap-around is provable without a browser.
 *
 * @param count Number of tabbable elements inside the trap.
 * @param currentIndex Index of the focused element within that list, or `-1`
 *   when focus is on the container itself or somewhere outside the list.
 * @param backwards `true` for Shift+Tab.
 * @returns The index to focus, or `-1` meaning "focus the container itself"
 *   — the answer for a dialog that holds no tabbable content.
 */
export function nextTrapIndex(
  count: number,
  currentIndex: number,
  backwards: boolean,
): number {
  if (!Number.isFinite(count) || count <= 0) return -1;

  const size = Math.floor(count);
  if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= size) {
    /* Focus is on the container or has drifted: enter at the end going back, the start going forward. */
    return backwards ? size - 1 : 0;
  }

  const step = backwards ? -1 : 1;
  return (currentIndex + step + size) % size;
}

export interface FocusTrapOptions {
  /**
   * Elements matching this are never made inert, even though they sit outside
   * the trap. Defaults to {@link PERCEIVABLE_WHILE_MODAL_SELECTOR}. Pass `''` to
   * inert everything.
   */
  readonly exemptFromInertSelector?: string;
}

export interface FocusTrap {
  readonly active: boolean;
  /**
   * Remember what had focus, make the rest of the document inert, and move
   * focus into the container.
   */
  activate(): void;
  /** Undo all of that and put focus back where it was, if that element still exists. */
  release(): void;
  /**
   * Stop holding the document, **without** giving focus back.
   *
   * For a surface that has another surface over it: a menu opened from a dialog,
   * a confirmation, a settings screen opened from an exam. Two active traps on
   * one page fight over Tab and — worse — the outer one has already marked the
   * inner one `inert`, so every control in it is unclickable and the hit test
   * lands on an ancestor. That was measured, not imagined: the exam's own menu
   * was unusable until this existed.
   *
   * `release()` cannot do this job, because it restores focus, and the whole
   * point is that the surface above has just taken it.
   */
  suspend(): void;
  /** Hold the document again. A no-op unless the trap is active and suspended. */
  resume(): void;
}

/**
 * Build a trap for `container`. Idempotent: `activate` on an active trap and
 * `release` on an inactive one both do nothing.
 */
export function createFocusTrap(
  container: HTMLElement,
  options: FocusTrapOptions = {},
): FocusTrap {
  const doc = container.ownerDocument;
  const exempt = options.exemptFromInertSelector ?? PERCEIVABLE_WHILE_MODAL_SELECTOR;

  let active = false;
  /** Active, but standing aside for a surface above. Focus is somebody else's. */
  let suspended = false;
  let restoreTo: HTMLElement | null = null;
  /* Only what *we* set, so releasing never clears someone else's `inert`. */
  const inerted: HTMLElement[] = [];

  const tabbables = (): HTMLElement[] =>
    Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      isTabbable,
    );

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab' || event.defaultPrevented) return;

    const stops = tabbables();
    const current = activeElementOf(doc);
    const index = current === null ? -1 : stops.indexOf(current);
    const next = nextTrapIndex(stops.length, index, event.shiftKey);

    /*
     * Always prevented, never delegated to the browser. Letting the native Tab
     * run for the "obvious" cases is how traps leak: the last element wraps
     * correctly but the browser has already moved on to its own chrome.
     */
    event.preventDefault();
    (next === -1 ? container : (stops[next] ?? container)).focus({ preventScroll: true });
  };

  const applyInert = (): void => {
    let node: Element = container;
    while (node.parentElement !== null && node !== doc.body) {
      const parent = node.parentElement;
      for (const sibling of Array.from(parent.children)) {
        if (sibling === node) continue;
        const element = asHtmlElement(sibling);
        if (element === null) continue;
        /* Already inert for someone else's reason: leave it, and leave it alone on release. */
        if (element.inert) continue;
        if (exempt !== '' && element.matches(exempt)) continue;
        element.inert = true;
        inerted.push(element);
      }
      node = parent;
    }
  };

  const clearInert = (): void => {
    for (const element of inerted) element.inert = false;
    inerted.length = 0;
  };

  return {
    get active(): boolean {
      return active;
    },

    activate(): void {
      if (active) return;
      active = true;
      suspended = false;

      restoreTo = activeElementOf(doc);
      applyInert();
      doc.addEventListener('keydown', onKeydown, true);
      container.focus({ preventScroll: true });
    },

    suspend(): void {
      if (!active || suspended) return;
      suspended = true;
      doc.removeEventListener('keydown', onKeydown, true);
      clearInert();
    },

    resume(): void {
      if (!active || !suspended) return;
      suspended = false;
      applyInert();
      doc.addEventListener('keydown', onKeydown, true);
    },

    release(): void {
      if (!active) return;
      active = false;
      suspended = false;

      doc.removeEventListener('keydown', onKeydown, true);
      clearInert();

      /*
       * Restore, but only to something still in the document. A dialog dismissed
       * because the screen rotated may outlive whatever opened it; focusing a
       * detached node silently drops focus on `<body>`, which is worse than
       * leaving it where the browser put it.
       */
      const target = restoreTo;
      restoreTo = null;
      if (target !== null && target.isConnected) target.focus({ preventScroll: true });
    },
  };
}

/**
 * `instanceof HTMLElement` is wrong across documents (an iframe, a test harness
 * with its own realm), so the check is structural.
 */
function asHtmlElement(node: Element): HTMLElement | null {
  const candidate = node as HTMLElement;
  return typeof candidate.inert === 'boolean' && typeof candidate.matches === 'function'
    ? candidate
    : null;
}

/** Matching the selector is not enough: a hidden or inert element is not in the Tab order. */
function isTabbable(element: HTMLElement): boolean {
  if (element.closest('[inert]') !== null) return false;
  if (typeof element.checkVisibility === 'function') return element.checkVisibility();
  return !element.hidden;
}

function activeElementOf(doc: Document): HTMLElement | null {
  const current = doc.activeElement as HTMLElement | null;
  if (current === null) return null;
  return typeof current.focus === 'function' ? current : null;
}
