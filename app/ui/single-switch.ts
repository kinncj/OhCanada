/**
 * Single-switch mode: short press moves the highlight, long press chooses.
 *
 * CLAUDE.md says "tap anywhere advances". `docs/stories/README.md` turns that
 * into a contract that survives having exactly one contact and no timer the
 * player can lose to:
 *
 *  - a **short press anywhere** moves the highlight to the next item, wrapping;
 *  - a **long press** (held past {@link SwitchRingOptions.holdMs}) chooses the
 *    highlighted item;
 *  - **nothing scans on its own** and nothing expires.
 *
 * The rejected design is an auto-scanner, where a cursor steps through the items
 * by itself and the player presses to take the one under it. That is the common
 * implementation and it is a countdown: miss the moment and the choice is gone.
 * CLAUDE.md allows no timer outside Exam mode, and `TN-CARD-07`, `TN-CREATOR-05`
 * and `TN-SET-05` each assert that two minutes of doing nothing changes nothing.
 *
 * There is therefore **no `setTimeout` and no `setInterval` in this file**, and
 * a unit test asserts that by source inspection. A press is classified on
 * release, from two timestamps, which is also why the whole decision is the pure
 * function {@link classifyPress}.
 */

/** What a completed press means. */
export type SwitchPress = 'advance' | 'choose';

/**
 * Classify a press from its duration.
 *
 * A press exactly at the threshold chooses: the player who holds "about long
 * enough" meant to choose, and the cost of guessing wrong is one extra press in
 * one direction and a wrong answer in the other.
 */
export function classifyPress(durationMs: number, holdMs: number): SwitchPress {
  if (!Number.isFinite(durationMs) || durationMs < 0) return 'advance';
  return durationMs >= holdMs ? 'choose' : 'advance';
}

/**
 * Where the highlight goes on a short press. Wraps at the end
 * (`TN-CREATOR-05`), and `-1` means "there is nothing to highlight".
 */
export function nextHighlightIndex(count: number, currentIndex: number): number {
  if (!Number.isFinite(count) || count <= 0) return -1;
  const size = Math.floor(count);
  if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= size) return 0;
  return (currentIndex + 1) % size;
}

/** Marks the element the switch would choose. Styled in `screen-styles.ts`. */
export const HIGHLIGHT_ATTRIBUTE = 'data-switch-highlight';

/** Overrides the announced label when an item's text is not what should be read. */
export const SWITCH_LABEL_ATTRIBUTE = 'data-switch-label';

/**
 * The longest hold an item is willing to demand, in milliseconds.
 *
 * This exists for exactly one control and it is the reason the control is
 * usable: "Hold time" changes what a long press *means*, so a player who has
 * chosen "Very long" and can no longer hold for two seconds would be locked out
 * of the only control that could rescue them. `TN-SET-09` states the escape —
 * "the hold-time options accept a hold of the default length or the current
 * threshold, whichever is shorter" — and {@link holdThresholdFor} is that
 * sentence as arithmetic, so the property holds for every threshold rather than
 * for the ones somebody thought to test.
 */
export const SWITCH_MAX_HOLD_ATTRIBUTE = 'data-switch-max-hold-ms';

/**
 * The threshold that actually applies to one item: the ring's, capped by
 * whatever the item declared.
 *
 * Total, and never above the cap. A missing, malformed or non-positive cap is
 * "no cap", which is the safe direction: an item that says nothing keeps the
 * ring's threshold.
 */
export function holdThresholdFor(ringHoldMs: number, itemMaxHoldMs?: number | null): number {
  if (itemMaxHoldMs === undefined || itemMaxHoldMs === null) return ringHoldMs;
  if (!Number.isFinite(itemMaxHoldMs) || itemMaxHoldMs <= 0) return ringHoldMs;
  return Math.min(ringHoldMs, itemMaxHoldMs);
}

export interface SwitchRingOptions {
  /**
   * Hold-to-choose threshold in milliseconds. `TN-SET`/`OQ-SET-4` makes it
   * player-settable, so a function is accepted and read at each press: a ring
   * built when a screen opened must honour a threshold changed after it did.
   */
  readonly holdMs: number | (() => number);
  /** Injected so a test can drive a press without waiting for one. */
  readonly now?: () => number;
  /** Sends the highlighted item's name to the one live region. */
  readonly announce?: (message: string) => void;
  /** Which descendants are in the ring. Defaults to the enabled interactive ones. */
  readonly itemSelector?: string;
}

export interface SwitchRing {
  readonly enabled: boolean;
  /** Index of the highlighted item, or `-1`. */
  readonly index: number;
  readonly items: readonly HTMLElement[];
  enable(): void;
  disable(): void;
  /** Re-read the items — after a re-render, or when a screen changes state. */
  refresh(): void;
  /** Put the highlight on a known item. Used when a screen opens. */
  highlight(index: number): void;
  destroy(): void;
}

const DEFAULT_ITEM_SELECTOR = [
  'button:not([disabled]):not([aria-disabled="true"])',
  '[role="radio"]:not([aria-disabled="true"])',
  '[role="switch"]:not([aria-disabled="true"])',
  'input:not([disabled]):not([type="hidden"])',
  'a[href]',
].join(',');

/**
 * Build a ring over the interactive descendants of `container`.
 *
 * Listeners go on the *document*, at capture, because "tap anywhere" means
 * anywhere — including the part of the screen that is not a control. The same
 * handlers `preventDefault()` so a tap on a button does not both advance the
 * highlight and activate the button, which is how a switch user ends up
 * answering a question by trying to read it.
 */
export function createSwitchRing(
  container: HTMLElement,
  options: SwitchRingOptions,
): SwitchRing {
  const doc = container.ownerDocument;
  const now = options.now ?? (() => Date.now());
  const selector = options.itemSelector ?? DEFAULT_ITEM_SELECTOR;
  const holdMs = (): number =>
    typeof options.holdMs === 'function' ? options.holdMs() : options.holdMs;

  let enabled = false;
  let index = -1;
  let items: HTMLElement[] = [];
  let pressStartedAt: number | null = null;

  const readItems = (): HTMLElement[] =>
    Array.from(container.querySelectorAll<HTMLElement>(selector)).filter((element) => {
      if (element.closest('[hidden]') !== null) return false;
      return typeof element.checkVisibility === 'function' ? element.checkVisibility() : true;
    });

  const labelOf = (element: HTMLElement): string => {
    const explicit = element.getAttribute(SWITCH_LABEL_ATTRIBUTE);
    if (explicit !== null && explicit.trim() !== '') return explicit.trim();
    const label = element.getAttribute('aria-label');
    if (label !== null && label.trim() !== '') return label.trim();
    return (element.textContent ?? '').trim();
  };

  const paint = (announceIt: boolean): void => {
    for (const [position, element] of items.entries()) {
      if (position === index) element.setAttribute(HIGHLIGHT_ATTRIBUTE, 'true');
      else element.removeAttribute(HIGHLIGHT_ATTRIBUTE);
    }
    const current = index === -1 ? undefined : items[index];
    if (current === undefined) return;
    current.focus({ preventScroll: true });
    if (announceIt) options.announce?.(labelOf(current));
  };

  const advance = (): void => {
    items = readItems();
    index = nextHighlightIndex(items.length, index);
    paint(true);
  };

  const choose = (): void => {
    const current = index === -1 ? undefined : items[index];
    /* No item highlighted yet: a long press is treated as a first advance rather
       than as nothing, so a player who holds too long on their first press is
       not left wondering whether the switch works. */
    if (current === undefined) {
      advance();
      return;
    }
    current.click();
  };

  const begin = (): void => {
    pressStartedAt = now();
  };

  /**
   * What this press has to beat, for the item currently highlighted. Read at
   * release, so a ring built before the threshold changed still honours it, and
   * so an item's own cap is consulted rather than assumed.
   */
  const thresholdNow = (): number => {
    const current = index === -1 ? undefined : items[index];
    const declared = current?.getAttribute(SWITCH_MAX_HOLD_ATTRIBUTE) ?? null;
    return holdThresholdFor(holdMs(), declared === null ? null : Number(declared));
  };

  const end = (): void => {
    if (pressStartedAt === null) return;
    const duration = now() - pressStartedAt;
    pressStartedAt = null;
    if (classifyPress(duration, thresholdNow()) === 'choose') choose();
    else advance();
  };

  const onPointerDown = (event: Event): void => {
    if (!enabled) return;
    event.preventDefault();
    begin();
  };

  const onPointerUp = (event: Event): void => {
    if (!enabled) return;
    event.preventDefault();
    end();
  };

  /** A switch reaching the browser as a key: Space or Enter, the usual mapping. */
  const isSwitchKey = (event: KeyboardEvent): boolean =>
    event.key === ' ' || event.key === 'Enter' || event.key === 'Spacebar';

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!enabled || !isSwitchKey(event)) return;
    /* Key repeat is the keyboard's own scanner. Ignore it: one contact, one press. */
    if (event.repeat) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    begin();
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    if (!enabled || !isSwitchKey(event)) return;
    event.preventDefault();
    end();
  };

  const listen = (on: boolean): void => {
    const method = on ? 'addEventListener' : 'removeEventListener';
    doc[method]('pointerdown', onPointerDown, true);
    doc[method]('pointerup', onPointerUp, true);
    doc[method]('pointercancel', onPointerUp, true);
    doc[method]('keydown', onKeyDown as EventListener, true);
    doc[method]('keyup', onKeyUp as EventListener, true);
  };

  return {
    get enabled(): boolean {
      return enabled;
    },
    get index(): number {
      return index;
    },
    get items(): readonly HTMLElement[] {
      return items;
    },
    enable(): void {
      if (enabled) return;
      enabled = true;
      items = readItems();
      listen(true);
    },
    disable(): void {
      if (!enabled) return;
      enabled = false;
      pressStartedAt = null;
      listen(false);
      for (const element of items) element.removeAttribute(HIGHLIGHT_ATTRIBUTE);
      index = -1;
    },
    refresh(): void {
      const previous = index === -1 ? null : (items[index] ?? null);
      items = readItems();
      const moved = previous === null ? -1 : items.indexOf(previous);
      index = moved;
      paint(false);
    },
    highlight(next: number): void {
      items = readItems();
      index = next >= 0 && next < items.length ? next : -1;
      paint(false);
    },
    destroy(): void {
      listen(false);
      enabled = false;
      items = [];
      index = -1;
    },
  };
}
