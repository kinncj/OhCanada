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
 * **The handler has to walk the Tab order the browser would, or it is worse than
 * none.** Because it always prevents the native Tab, whatever it skips nobody
 * reaches, and whatever it adds everybody has to pass. It used to stop on every
 * element the selector below matched, and `button:not([disabled])` matches a
 * button whose `tabindex` is `-1`. Every radio group in the game is a row of
 * such buttons with a roving `tabindex`, so a keyboard player pressed Tab
 * twenty-two times to cross the creator's six groups rather than six. Two rules
 * now hold here, and {@link nextTabStop} is both of them as arithmetic:
 *
 *  - a negative `tabindex` takes an element out of the Tab order, whatever its
 *    tag;
 *  - **a radio group is one stop**: its checked radio, or its first when none is
 *    checked (the ARIA radio group pattern). Tab from any radio in a group
 *    leaves the group, including from one a switch highlight or a script
 *    focused.
 *
 * The arrow keys inside a group belong to the group's own screen, which also
 * keeps the roving `tabindex` that makes the checked radio the stop.
 * `app/ui/single-switch.ts` builds its ring from its own selector and never
 * reads `tabindex`, so one switch still reaches every option.
 *
 * **Where Tab lands is scrolled into view**, by `./focus-scroll.ts`. Focus still
 * moves with `preventScroll`, because the browser's own behaviour is to centre
 * the element and that reads as the sheet lurching; the scroll that follows is
 * `block: 'nearest'`, which moves nothing when the control is already on screen
 * and is instant for a player who asked for less movement.
 *
 * ## The third mechanism: focus that arrives from outside
 *
 * The two above both assume the *player* moved focus, through this file. A third
 * live-site audit found a case where nobody did.
 *
 * Engaging a character with the **Enter key** opens the dialogue from the game's
 * own frame rather than from a DOM handler, and intermittently left focus outside
 * it: Tab then reached the Settings button behind the modal, Enter opened
 * Settings on top of the open dialogue, and Space flipped a radio underneath it.
 * Opening the same dialogue with a pointer was correct every time, because a
 * click leaves focus on the control that was clicked — inside the subtree this
 * trap is about to inert — and the browser's own fix-up then lands inside the
 * dialog.
 *
 * Whatever moved focus (a canvas taking it back a frame later, an element removed
 * from under it, a `Tab` whose default something else had already prevented),
 * `activate()` had no way to find out: it moves focus once, at open, and never
 * looks again. So a modal's containment now **re-asserts itself**: while the trap
 * is active and not suspended, focus landing outside the container is moved back
 * to the last control inside it that had focus, or to the container. That is the
 * whole of the promise `aria-modal="true"` makes, held against anything that
 * breaks it rather than against the one cause somebody thought of.
 *
 * Deliberately *not* a repair of whatever stole the focus — `app/ui` cannot see
 * the engine and must not guess at it. `suspend()` still stands the guard down
 * with the rest of the trap, so a surface that opens another one over itself is
 * unaffected, which is the case the exam's review and Settings' confirmation are.
 *
 * DOM only, no adapters, no scenes (ADR-0005). Nothing here is Phaser-aware; the
 * caller decides when a surface becomes modal.
 */

import { focusAndReveal } from './focus-scroll';

/**
 * What can take focus inside a trap. Deliberately conservative, and **not on
 * its own the Tab order**: `[tabindex]` entries with a negative value are
 * excluded here, but a button, input or link with `tabindex="-1"` still matches
 * its tag's entry. The trap reads `tabindex` and radio groups at key time
 * ({@link nextTabStop}), and filters out hidden and `[inert]` subtrees.
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

/**
 * An ARIA radio that holds a roving `tabindex`. It may be `div`, which
 * {@link FOCUSABLE_SELECTOR} leaves out while its `tabindex` is `-1`, and focus
 * can still be on it. Queried alongside, so Tab from it knows where it is.
 */
const ROVING_RADIO_SELECTOR = '[role="radio"][tabindex]';

/** One focusable element, as far as Tab needs to know it. */
export interface TabCandidate {
  /** No negative `tabindex`: the browser would stop here if it were not in a radio group. */
  readonly tabbable: boolean;
  /**
   * The radio group this element is a radio in, or `null`. Any value, compared
   * by identity: the `radiogroup` element for an ARIA radio, the name for a
   * native one.
   */
  readonly group: unknown;
  /** A radio that is checked. */
  readonly checked: boolean;
}

/**
 * The indices, in document order, that Tab stops on: every tabbable candidate
 * outside a radio group, and exactly one per group. A group's stop is its
 * checked radio, or its first radio when none is checked, **whatever their
 * `tabindex`**. A group whose screen forgot to rove its `tabindex` still costs
 * one Tab, and a group with nothing checked is never skipped.
 */
export function tabStopIndices(candidates: readonly TabCandidate[]): number[] {
  const stops: number[] = [];
  const groups = new Set<unknown>();
  for (const [index, candidate] of candidates.entries()) {
    if (candidate.group === null) {
      if (candidate.tabbable) stops.push(index);
      continue;
    }
    if (groups.has(candidate.group)) continue;
    groups.add(candidate.group);
    const checked = candidates.findIndex(
      (other) => other.group === candidate.group && other.checked,
    );
    stops.push(checked === -1 ? index : checked);
  }
  return stops.sort((a, b) => a - b);
}

/**
 * Where Tab goes next inside a trap, over the whole list of focusable elements
 * rather than a list of stops, because focus may be on an element that is not a
 * stop: an unchecked radio a switch highlight moved to, or a control whose
 * `tabindex` a screen just set to `-1`.
 *
 * @param candidates Every focusable element in the trap, in document order.
 * @param currentIndex Index of the focused element in `candidates`, or `-1`
 *   when focus is on the container or outside it.
 * @param backwards `true` for Shift+Tab.
 * @returns The index to focus, or `-1` meaning "focus the container itself",
 *   the answer for a dialog with no stop in it.
 */
export function nextTabStop(
  candidates: readonly TabCandidate[],
  currentIndex: number,
  backwards: boolean,
): number {
  const stops = tabStopIndices(candidates);
  if (stops.length === 0) return -1;

  const size = candidates.length;
  const current =
    Number.isInteger(currentIndex) && currentIndex >= 0 && currentIndex < size
      ? candidates[currentIndex]
      : undefined;
  if (current === undefined) {
    /* Focus is on the container or has drifted: enter at the end going back, the start going forward. */
    return stops[nextTrapIndex(stops.length, -1, backwards)] ?? -1;
  }

  /*
   * Walk from where focus is, in the direction pressed, to the first stop that
   * is not in the focused radio's own group. From a plain stop this is exactly
   * `nextTrapIndex` over the stops, wrap-around included.
   */
  const isStop = new Set(stops);
  const step = backwards ? -1 : 1;
  for (let offset = 1; offset <= size; offset += 1) {
    const index = (((currentIndex + step * offset) % size) + size) % size;
    const candidate = candidates[index];
    if (candidate === undefined) continue;
    if (current.group !== null && candidate.group === current.group) continue;
    if (isStop.has(index)) return index;
  }
  /* The focused radio's own group is the only stop there is: Tab stays on it. */
  return stops[0] ?? -1;
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
  /**
   * The last element *inside* the trap that held focus.
   *
   * Where focus goes back to when something outside takes it: a player who had
   * tabbed to "Not now" and had focus stolen by the game's own frame is put back
   * on "Not now", not at the top of the dialog. `null` until something inside is
   * focused, which is the state an open dialog with no controls stays in.
   */
  let lastInside: HTMLElement | null = null;
  /* Only what *we* set, so releasing never clears someone else's `inert`. */
  const inerted: HTMLElement[] = [];

  const focusables = (): HTMLElement[] =>
    Array.from(
      container.querySelectorAll<HTMLElement>(`${FOCUSABLE_SELECTOR},${ROVING_RADIO_SELECTOR}`),
    ).filter(isReachable);

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab' || event.defaultPrevented) return;

    const elements = focusables();
    const current = activeElementOf(doc);
    const index = current === null ? -1 : elements.indexOf(current);
    const next = nextTabStop(elements.map(candidateOf), index, event.shiftKey);

    /*
     * Always prevented, never delegated to the browser. Letting the native Tab
     * run for the "obvious" cases is how traps leak: the last element wraps
     * correctly but the browser has already moved on to its own chrome.
     */
    event.preventDefault();
    /*
     * Focused without the browser's centring jump, and then scrolled just far
     * enough to be seen (`./focus-scroll.ts`). `preventScroll` alone was the
     * defect: Tab reached a control below the fold and the page never moved, so
     * the focus ring was real and off screen.
     */
    focusAndReveal(next === -1 ? container : (elements[next] ?? container));
  };

  /**
   * Focus arrived somewhere. If it is inside, remember where; if it is outside,
   * bring it back.
   *
   * Registered at capture on the document, so it sees focus land wherever it
   * lands — including on `<body>`, which is where focus falls when the element
   * holding it is removed or made inert by somebody else.
   *
   * The live region is exempt from `inert` so that announcements survive a modal
   * (see {@link PERCEIVABLE_WHILE_MODAL_SELECTOR}); that exemption is about being
   * *read*, never about holding focus, so it is pulled back like anything else.
   */
  const onFocusIn = (event: Event): void => {
    if (!active || suspended) return;
    const landed = event.target as Element | null;
    const target = landed === null ? null : asHtmlElement(landed);
    if (target !== null && isInside(container, target)) {
      lastInside = target;
      return;
    }
    /*
     * Back to where the player was, or to the dialog itself. `isReachable` is
     * asked again because the control they were on may be exactly what went
     * away — a re-rendered row, a choice that has just been taken.
     */
    const home =
      lastInside !== null && lastInside.isConnected && isReachable(lastInside)
        ? lastInside
        : container;
    focusAndReveal(home);
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
      lastInside = null;
      applyInert();
      doc.addEventListener('keydown', onKeydown, true);
      /* The containment guard, for focus this file did not move. See the note at
         the top: it is what makes `aria-modal` true a frame after the open. */
      doc.addEventListener('focusin', onFocusIn, true);
      container.focus({ preventScroll: true });
    },

    suspend(): void {
      if (!active || suspended) return;
      suspended = true;
      doc.removeEventListener('keydown', onKeydown, true);
      /* The surface above owns focus now, so the guard would be fighting it. */
      doc.removeEventListener('focusin', onFocusIn, true);
      clearInert();
    },

    resume(): void {
      if (!active || !suspended) return;
      suspended = false;
      applyInert();
      doc.addEventListener('keydown', onKeydown, true);
      doc.addEventListener('focusin', onFocusIn, true);
    },

    release(): void {
      if (!active) return;
      active = false;
      suspended = false;
      lastInside = null;

      doc.removeEventListener('keydown', onKeydown, true);
      doc.removeEventListener('focusin', onFocusIn, true);
      clearInert();

      /*
       * Restore, but only to something still in the document. A dialog dismissed
       * because the screen rotated may outlive whatever opened it; focusing a
       * detached node silently drops focus on `<body>`, which is worse than
       * leaving it where the browser put it.
       */
      const target = restoreTo;
      restoreTo = null;
      /* Brought back into view as well as into focus: the control that opened a
         screen may be far down the page the screen was covering. */
      if (target !== null && target.isConnected) focusAndReveal(target);
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

/**
 * Is `node` the container or inside it?
 *
 * Walks `parentElement` rather than calling `Node.contains`, because this file is
 * exercised against more than one document double and only the tree is common to
 * all of them. A detached node answers `false`, which is the right answer: focus
 * on something that is no longer in the page is focus that has left.
 */
function isInside(container: HTMLElement, node: HTMLElement): boolean {
  let walk: HTMLElement | null = node;
  while (walk !== null) {
    if (walk === container) return true;
    walk = walk.parentElement;
  }
  return false;
}

/** Matching the selector is not enough: a hidden or inert element cannot take focus. */
function isReachable(element: HTMLElement): boolean {
  if (element.closest('[inert]') !== null) return false;
  if (typeof element.checkVisibility === 'function') return element.checkVisibility();
  return !element.hidden;
}

/**
 * What Tab needs to know about one element. Structural and defensive, like
 * {@link asHtmlElement}: an element with no `getAttribute` reads as a plain,
 * tabbable control.
 */
function candidateOf(element: HTMLElement): TabCandidate {
  const tabindex = attributeOf(element, 'tabindex');
  const parsed = tabindex === null ? Number.NaN : Number.parseInt(tabindex, 10);
  /* An unparseable `tabindex` is ignored by the browser, so it is here too. */
  const tabbable = !(parsed < 0);

  if (attributeOf(element, 'role') === 'radio') {
    const group =
      typeof element.closest === 'function' ? element.closest('[role="radiogroup"]') : null;
    return { tabbable, group, checked: attributeOf(element, 'aria-checked') === 'true' };
  }

  const input = element as Partial<HTMLInputElement>;
  if (
    typeof element.tagName === 'string' &&
    element.tagName.toUpperCase() === 'INPUT' &&
    input.type === 'radio' &&
    typeof input.name === 'string' &&
    input.name !== ''
  ) {
    return { tabbable, group: `radio:${input.name}`, checked: input.checked === true };
  }

  return { tabbable, group: null, checked: false };
}

function attributeOf(element: HTMLElement, name: string): string | null {
  return typeof element.getAttribute === 'function' ? element.getAttribute(name) : null;
}

function activeElementOf(doc: Document): HTMLElement | null {
  const current = doc.activeElement as HTMLElement | null;
  if (current === null) return null;
  return typeof current.focus === 'function' ? current : null;
}
