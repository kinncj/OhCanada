import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FOCUSABLE_SELECTOR,
  PERCEIVABLE_WHILE_MODAL_SELECTOR,
  createFocusTrap,
  nextTrapIndex,
} from '@ui/focus-trap';

/**
 * `nextTrapIndex` is pure and proved directly. `createFocusTrap` touches the DOM
 * and the suite runs under `environment: 'node'`, so it is exercised against the
 * small document double at the bottom of this file rather than left unmeasured:
 * the interesting behaviour is bookkeeping (which elements *we* made inert, where
 * focus came from), and bookkeeping is exactly what a real browser makes hard to
 * assert. The end-to-end guarantee — a real Tab key in a real Chromium — is
 * asserted in `tests/a11y/screens.spec.ts`.
 */

describe('nextTrapIndex', () => {
  describe('with no tabbable content, as in the rotate overlay', () => {
    it('returns -1 so the caller focuses the container itself', () => {
      expect(nextTrapIndex(0, -1, false)).toBe(-1);
      expect(nextTrapIndex(0, -1, true)).toBe(-1);
      expect(nextTrapIndex(0, 0, false)).toBe(-1);
    });

    it('refuses a nonsensical count instead of throwing', () => {
      expect(nextTrapIndex(-3, 0, false)).toBe(-1);
      expect(nextTrapIndex(Number.NaN, 0, false)).toBe(-1);
      expect(nextTrapIndex(Number.POSITIVE_INFINITY, 0, false)).toBe(-1);
    });
  });

  describe('with one tabbable element', () => {
    it('keeps focus on it in both directions', () => {
      expect(nextTrapIndex(1, 0, false)).toBe(0);
      expect(nextTrapIndex(1, 0, true)).toBe(0);
    });
  });

  describe('moving forward', () => {
    it('advances through the list', () => {
      expect(nextTrapIndex(3, 0, false)).toBe(1);
      expect(nextTrapIndex(3, 1, false)).toBe(2);
    });

    it('wraps from the last element to the first, which is what stops the leak', () => {
      expect(nextTrapIndex(3, 2, false)).toBe(0);
    });
  });

  describe('moving backward with Shift+Tab', () => {
    it('steps back through the list', () => {
      expect(nextTrapIndex(3, 2, true)).toBe(1);
      expect(nextTrapIndex(3, 1, true)).toBe(0);
    });

    it('wraps from the first element to the last', () => {
      expect(nextTrapIndex(3, 0, true)).toBe(2);
    });
  });

  describe('when focus is on the container or has drifted outside the list', () => {
    it('enters at the first stop going forward', () => {
      expect(nextTrapIndex(4, -1, false)).toBe(0);
      expect(nextTrapIndex(4, 99, false)).toBe(0);
      expect(nextTrapIndex(4, 1.5, false)).toBe(0);
    });

    it('enters at the last stop going backward', () => {
      expect(nextTrapIndex(4, -1, true)).toBe(3);
      expect(nextTrapIndex(4, 99, true)).toBe(3);
      expect(nextTrapIndex(4, Number.NaN, true)).toBe(3);
    });
  });

  it('never returns an index outside the list, for any input in range', () => {
    for (let count = 1; count <= 6; count += 1) {
      for (let index = -2; index <= count + 1; index += 1) {
        for (const backwards of [false, true]) {
          const next = nextTrapIndex(count, index, backwards);
          expect(next).toBeGreaterThanOrEqual(0);
          expect(next).toBeLessThan(count);
        }
      }
    }
  });

  it('returns to where it started after a full cycle in each direction', () => {
    const count = 5;
    for (const backwards of [false, true]) {
      let index = 0;
      for (let step = 0; step < count; step += 1) {
        index = nextTrapIndex(count, index, backwards);
      }
      expect(index).toBe(0);
    }
  });
});

describe('FOCUSABLE_SELECTOR', () => {
  it('excludes elements a browser will not put in the Tab order', () => {
    /* A negative tabindex is programmatically focusable but never tabbable. */
    expect(FOCUSABLE_SELECTOR).toContain('[tabindex]:not([tabindex^="-"])');
    expect(FOCUSABLE_SELECTOR).toContain('button:not([disabled])');
    expect(FOCUSABLE_SELECTOR).toContain('input:not([disabled]):not([type="hidden"])');
  });
});

describe('PERCEIVABLE_WHILE_MODAL_SELECTOR', () => {
  it('keeps the announcer out of the inert background', () => {
    /* `inert` strips a subtree from the accessibility tree; a silenced live
       region would be a regression in the exact moment it matters most. */
    expect(PERCEIVABLE_WHILE_MODAL_SELECTOR).toContain('[aria-live]');
    expect(PERCEIVABLE_WHILE_MODAL_SELECTOR).toContain('[role="status"]');
    expect(PERCEIVABLE_WHILE_MODAL_SELECTOR).toContain('[role="alert"]');
  });
});

describe('createFocusTrap', () => {
  let scene: Scene;

  beforeEach(() => {
    scene = buildScene();
  });

  describe('activate', () => {
    it('starts inactive and reports itself active once opened', () => {
      const trap = createFocusTrap(scene.overlay);
      expect(trap.active).toBe(false);
      trap.activate();
      expect(trap.active).toBe(true);
    });

    it('moves focus into the container, so nobody is left behind the dialog', () => {
      createFocusTrap(scene.overlay).activate();
      expect(scene.doc.activeElement).toBe(scene.node('overlay'));
      expect(scene.node('overlay').focusCalls).toBe(1);
    });

    it('makes every sibling on the path to <body> inert', () => {
      createFocusTrap(scene.overlay).activate();

      expect(scene.node('game').inert).toBe(true);
      expect(scene.node('hud').inert).toBe(true);
    });

    it('leaves the container, its ancestors and <body> alone', () => {
      createFocusTrap(scene.overlay).activate();

      expect(scene.node('overlay').inert).toBe(false);
      expect(scene.node('ui').inert).toBe(false);
      expect(scene.node('body').inert).toBe(false);
    });

    it('exempts the live region, or the game goes silent exactly when it pauses', () => {
      createFocusTrap(scene.overlay).activate();
      expect(scene.node('live').inert).toBe(false);
    });

    it('honours an empty exemption by inerting the live region too', () => {
      createFocusTrap(scene.overlay, { exemptFromInertSelector: '' }).activate();
      expect(scene.node('live').inert).toBe(true);
    });

    it('skips nodes that cannot be inert, such as a stray <style>', () => {
      expect(() => createFocusTrap(scene.overlay).activate()).not.toThrow();
      expect(scene.node('style').inert).toBeUndefined();
    });

    it('is idempotent: a second activate does not re-record what is already inert', () => {
      const trap = createFocusTrap(scene.overlay);
      trap.activate();
      const focusCalls = scene.node('overlay').focusCalls;
      trap.activate();
      expect(scene.node('overlay').focusCalls).toBe(focusCalls);
    });
  });

  describe('release', () => {
    it('lifts the inert it applied', () => {
      const trap = createFocusTrap(scene.overlay);
      trap.activate();
      trap.release();

      expect(scene.node('game').inert).toBe(false);
      expect(scene.node('hud').inert).toBe(false);
      expect(trap.active).toBe(false);
    });

    it('leaves inert it did not apply, so it cannot un-hide someone else’s subtree', () => {
      scene.node('game').inert = true;

      const trap = createFocusTrap(scene.overlay);
      trap.activate();
      trap.release();

      expect(scene.node('game').inert).toBe(true);
    });

    it('returns focus to whatever had it before the dialog opened', () => {
      scene.node('hud').focus();
      expect(scene.doc.activeElement).toBe(scene.node('hud'));

      const trap = createFocusTrap(scene.overlay);
      trap.activate();
      expect(scene.doc.activeElement).toBe(scene.node('overlay'));

      trap.release();
      expect(scene.doc.activeElement).toBe(scene.node('hud'));
    });

    it('does not chase a control that was removed while the dialog was up', () => {
      scene.node('hud').focus();
      const trap = createFocusTrap(scene.overlay);
      trap.activate();

      scene.node('hud').isConnected = false;
      trap.release();

      expect(scene.doc.activeElement).toBe(scene.node('overlay'));
      expect(scene.node('hud').focusCalls).toBe(1);
    });

    it('copes with nothing having been focused', () => {
      scene.doc.activeElement = null;
      const trap = createFocusTrap(scene.overlay);
      trap.activate();
      expect(() => trap.release()).not.toThrow();
    });

    it('ignores a release on a trap that was never activated', () => {
      const trap = createFocusTrap(scene.overlay);
      trap.release();
      expect(trap.active).toBe(false);
      expect(scene.doc.listenerCount('keydown')).toBe(0);
    });

    it('stops listening for Tab', () => {
      const trap = createFocusTrap(scene.overlay);
      trap.activate();
      expect(scene.doc.listenerCount('keydown')).toBe(1);
      trap.release();
      expect(scene.doc.listenerCount('keydown')).toBe(0);
    });
  });

  describe('the Tab key, with no tabbable content in the dialog', () => {
    it('is swallowed and focus stays on the container', () => {
      createFocusTrap(scene.overlay).activate();

      const event = scene.doc.pressTab();

      expect(event.defaultPrevented).toBe(true);
      expect(scene.doc.activeElement).toBe(scene.node('overlay'));
    });

    it('behaves the same for Shift+Tab', () => {
      createFocusTrap(scene.overlay).activate();
      const event = scene.doc.pressTab({ shift: true });

      expect(event.defaultPrevented).toBe(true);
      expect(scene.doc.activeElement).toBe(scene.node('overlay'));
    });
  });

  describe('the Tab key, with tabbable content in the dialog', () => {
    it('cycles forward and wraps at the end', () => {
      const first = scene.addStop('first');
      const second = scene.addStop('second');
      createFocusTrap(scene.overlay).activate();

      scene.doc.pressTab();
      expect(scene.doc.activeElement).toBe(first);
      scene.doc.pressTab();
      expect(scene.doc.activeElement).toBe(second);
      scene.doc.pressTab();
      expect(scene.doc.activeElement).toBe(first);
    });

    it('cycles backward and wraps at the start', () => {
      const first = scene.addStop('first');
      const second = scene.addStop('second');
      createFocusTrap(scene.overlay).activate();

      scene.doc.pressTab({ shift: true });
      expect(scene.doc.activeElement).toBe(second);
      scene.doc.pressTab({ shift: true });
      expect(scene.doc.activeElement).toBe(first);
      scene.doc.pressTab({ shift: true });
      expect(scene.doc.activeElement).toBe(second);
    });

    it('skips a hidden stop', () => {
      const visible = scene.addStop('visible');
      const buried = scene.addStop('buried');
      buried.hidden = true;

      createFocusTrap(scene.overlay).activate();
      scene.doc.pressTab();
      scene.doc.pressTab();

      expect(scene.doc.activeElement).toBe(visible);
      expect(buried.focusCalls).toBe(0);
    });

    it('skips a stop inside an inert subtree', () => {
      const visible = scene.addStop('visible');
      const inerted = scene.addStop('inerted');
      inerted.inertAncestor = true;

      createFocusTrap(scene.overlay).activate();
      scene.doc.pressTab();
      scene.doc.pressTab();

      expect(scene.doc.activeElement).toBe(visible);
      expect(inerted.focusCalls).toBe(0);
    });

    it('uses checkVisibility when the browser offers it', () => {
      const shown = scene.addStop('shown');
      const clipped = scene.addStop('clipped');
      shown.checkVisibility = (): boolean => true;
      clipped.checkVisibility = vi.fn(() => false);

      createFocusTrap(scene.overlay).activate();
      scene.doc.pressTab();

      expect(scene.doc.activeElement).toBe(shown);
      expect(clipped.checkVisibility).toHaveBeenCalled();
    });
  });

  describe('other keys', () => {
    it('lets a non-Tab key through untouched', () => {
      createFocusTrap(scene.overlay).activate();
      const event = scene.doc.press('Escape');
      expect(event.defaultPrevented).toBe(false);
    });

    it('leaves an already-handled Tab to whoever handled it', () => {
      const stop = scene.addStop('first');
      createFocusTrap(scene.overlay).activate();

      scene.doc.pressTab({ alreadyHandled: true });

      expect(stop.focusCalls).toBe(0);
      expect(scene.doc.activeElement).toBe(scene.node('overlay'));
    });
  });
});

/* ------------------------------------------------------------------ *
 * A document double.
 *
 * Only what `createFocusTrap` actually reaches for. It is deliberately
 * literal — no selector engine, no layout — because the assertions above are
 * about which elements the trap touched, not about CSS.
 * ------------------------------------------------------------------ */

interface FakeKeyEvent {
  readonly key: string;
  readonly shiftKey: boolean;
  defaultPrevented: boolean;
  preventDefault(): void;
}

class FakeElement {
  id = '';
  hidden = false;
  inert: boolean | undefined = false;
  isConnected = true;
  inertAncestor = false;
  focusCalls = 0;
  checkVisibility: (() => boolean) | undefined;

  parentElement: FakeElement | null = null;
  readonly children: FakeElement[] = [];
  /** What `querySelectorAll(FOCUSABLE_SELECTOR)` returns for this element. */
  readonly tabStops: FakeElement[] = [];
  /** Selector tokens this element answers `matches` for. */
  readonly selectorTokens = new Set<string>();

  constructor(readonly ownerDocument: FakeDocument) {}

  append(child: FakeElement): void {
    child.parentElement = this;
    this.children.push(child);
  }

  matches(selector: string): boolean {
    return selector
      .split(',')
      .map((token) => token.trim())
      .some((token) => token !== '' && this.selectorTokens.has(token));
  }

  closest(selector: string): FakeElement | null {
    if (selector !== '[inert]') return null;
    if (this.inertAncestor || this.inert === true) return this;
    let node = this.parentElement;
    while (node !== null) {
      if (node.inert === true) return node;
      node = node.parentElement;
    }
    return null;
  }

  querySelectorAll(_selector: string): FakeElement[] {
    return this.tabStops;
  }

  focus(): void {
    this.focusCalls += 1;
    this.ownerDocument.activeElement = this;
  }
}

class FakeDocument {
  activeElement: FakeElement | null = null;
  body!: FakeElement;
  private readonly listeners = new Map<string, Array<(event: FakeKeyEvent) => void>>();

  addEventListener(type: string, handler: (event: FakeKeyEvent) => void): void {
    const bucket = this.listeners.get(type) ?? [];
    bucket.push(handler);
    this.listeners.set(type, bucket);
  }

  removeEventListener(type: string, handler: (event: FakeKeyEvent) => void): void {
    const bucket = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      bucket.filter((entry) => entry !== handler),
    );
  }

  listenerCount(type: string): number {
    return (this.listeners.get(type) ?? []).length;
  }

  press(
    key: string,
    { shift = false, alreadyHandled = false } = {},
  ): FakeKeyEvent {
    const event: FakeKeyEvent = {
      key,
      shiftKey: shift,
      defaultPrevented: alreadyHandled,
      preventDefault(): void {
        this.defaultPrevented = true;
      },
    };
    for (const handler of this.listeners.get('keydown') ?? []) handler(event);
    return event;
  }

  pressTab(options?: { shift?: boolean; alreadyHandled?: boolean }): FakeKeyEvent {
    return this.press('Tab', options);
  }
}

interface Scene {
  readonly doc: FakeDocument;
  /** The trap's container, typed as the DOM expects it. */
  readonly overlay: HTMLElement;
  node(name: 'body' | 'game' | 'ui' | 'live' | 'hud' | 'overlay' | 'style'): FakeElement;
  /** Add a tabbable descendant to the overlay. */
  addStop(id: string): FakeElement;
}

/**
 * The real slice-0 tree, plus the HUD button slice 1 will add:
 *
 *   body
 *     ├─ game            (canvas host — must go inert)
 *     ├─ style           (cannot be inert; must be skipped, not crashed on)
 *     └─ ui
 *          ├─ live       (aria-live — must stay perceivable)
 *          ├─ hud        (focusable control — must go inert)
 *          └─ overlay    (the dialog)
 */
function buildScene(): Scene {
  const doc = new FakeDocument();

  const make = (id: string): FakeElement => {
    const element = new FakeElement(doc);
    element.id = id;
    return element;
  };

  const body = make('body');
  doc.body = body;

  const game = make('game');
  const style = make('style');
  /* A node with no `inert` property at all, like a foreign or non-HTML element. */
  style.inert = undefined;

  const ui = make('ui');
  const live = make('tn-live-region');
  live.selectorTokens.add('[aria-live]').add('[role="status"]');
  const hud = make('tn-hud');
  const overlay = make('tn-rotate-overlay');

  body.append(game);
  body.append(style);
  body.append(ui);
  ui.append(live);
  ui.append(hud);
  ui.append(overlay);

  const byName: Record<string, FakeElement> = {
    body,
    game,
    ui,
    live,
    hud,
    overlay,
    style,
  };

  return {
    doc,
    overlay: overlay as unknown as HTMLElement,
    node: (name) => byName[name] as FakeElement,
    addStop(id: string): FakeElement {
      const stop = make(id);
      overlay.append(stop);
      overlay.tabStops.push(stop);
      return stop;
    },
  };
}
