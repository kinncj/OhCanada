import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRotateOverlay } from '@ui/rotate-overlay';

/**
 * The rotate overlay is DOM, and this suite runs under `environment: 'node'`
 * (there is no jsdom in the tree), so it is exercised against the document
 * double at the bottom of this file — the same approach as
 * `tests/unit/ui/focus-trap.test.ts`.
 *
 * The double is deliberately literal: no layout, no selector engine. What is
 * asserted here is behaviour a real browser makes *harder* to see, not easier —
 * which callback fired how many times, whether `hidden` was already off at the
 * moment focus moved, whether a second `show` quietly overwrote the element the
 * player will be returned to. `createFocusTrap` is used for real rather than
 * mocked, because "is `aria-modal` backed by containment" is the single most
 * important claim this element makes and stubbing it would assert nothing.
 *
 * The end-to-end proof — a real Chromium, a real Tab key, axe-core over the
 * rendered dialog — lives in `tests/a11y/screens.spec.ts`. This file proves the
 * state machine underneath it.
 */

describe('createRotateOverlay', () => {
  let page: Page;

  beforeEach(() => {
    page = buildPage();
  });

  describe('the element it builds', () => {
    it('mounts inside the host it was given', () => {
      const overlay = createRotateOverlay(page.uiHost);

      expect(page.node('ui').children).toContain(overlay.element);
      expect(fake(overlay.element).id).toBe('tn-rotate-overlay');
    });

    it('is an alertdialog: it interrupts, and it carries a message to read', () => {
      const element = fake(createRotateOverlay(page.uiHost).element);

      expect(element.getAttribute('role')).toBe('alertdialog');
      expect(element.getAttribute('aria-modal')).toBe('true');
    });

    it('names and describes itself through elements that actually exist', () => {
      const overlay = createRotateOverlay(page.uiHost);
      const element = fake(overlay.element);

      const labelId = element.getAttribute('aria-labelledby');
      const describedId = element.getAttribute('aria-describedby');
      const label = element.find(labelId);
      const described = element.find(describedId);

      /* A dangling `aria-labelledby` is an unnamed dialog, which is worse than none. */
      expect(label).not.toBeNull();
      expect(described).not.toBeNull();
      expect(label?.textContent.trim().length).toBeGreaterThan(0);
      expect(described?.textContent.trim().length).toBeGreaterThan(0);
    });

    it('is programmatically focusable but never a Tab stop of its own', () => {
      expect(fake(createRotateOverlay(page.uiHost).element).tabIndex).toBe(-1);
    });

    it('starts hidden and invisible, so a portrait boot never flashes it', () => {
      const overlay = createRotateOverlay(page.uiHost);

      expect(overlay.visible).toBe(false);
      expect(fake(overlay.element).hidden).toBe(true);
    });

    it('hides the glyph from assistive tech: the instruction is the text, not the picture', () => {
      const element = fake(createRotateOverlay(page.uiHost).element);
      const glyph = element.findByClass('tn-rotate-glyph');

      expect(glyph).not.toBeNull();
      expect(glyph?.getAttribute('aria-hidden')).toBe('true');
      /* And it carries no text, so nothing is lost by hiding it. */
      expect(glyph?.textContent).toBe('');
    });
  });

  describe('locale', () => {
    it('defaults to English and says so in `lang`', () => {
      const element = fake(createRotateOverlay(page.uiHost).element);
      expect(element.getAttribute('lang')).toBe('en');
    });

    it('marks the French copy `lang="fr"`, so a screen reader switches voice', () => {
      const element = fake(createRotateOverlay(page.uiHost, { locale: 'fr' }).element);
      expect(element.getAttribute('lang')).toBe('fr');
    });

    it('actually swaps the words, not just the attribute', () => {
      /* Asserted as a difference rather than a literal: the strings move to
         content/locales in slice 1 and this test should survive that. */
      const en = text(createRotateOverlay(page.uiHost).element);
      const fr = text(createRotateOverlay(page.uiHost, { locale: 'fr' }).element);

      expect(en.title.length).toBeGreaterThan(0);
      expect(en.body.length).toBeGreaterThan(0);
      expect(fr.title).not.toBe(en.title);
      expect(fr.body).not.toBe(en.body);
    });
  });

  describe('its stylesheet', () => {
    it('carries its own CSS instead of relying on index.html', () => {
      createRotateOverlay(page.uiHost);

      const style = page.doc.getElementById('tn-rotate-overlay-style');
      expect(style).not.toBeNull();
      expect(page.node('head').children).toContain(style);
    });

    it('honours prefers-reduced-motion by removing the animation, not the message', () => {
      createRotateOverlay(page.uiHost);
      const css = page.doc.getElementById('tn-rotate-overlay-style')?.textContent ?? '';

      expect(css).toContain('@media (prefers-reduced-motion: reduce)');
      expect(css).toContain('animation: none');
      /* The card itself is never hidden by the media query: motion goes, information stays. */
      expect(css).toContain('#tn-rotate-overlay[hidden] { display: none; }');
    });

    it('injects the stylesheet once, however many overlays are built', () => {
      createRotateOverlay(page.uiHost);
      createRotateOverlay(page.uiHost);
      createRotateOverlay(page.uiHost);

      expect(page.node('head').children).toHaveLength(1);
    });
  });

  describe('setVisible(true)', () => {
    it('unhides the element and reports itself visible', () => {
      const overlay = createRotateOverlay(page.uiHost);

      overlay.setVisible(true);

      expect(overlay.visible).toBe(true);
      expect(fake(overlay.element).hidden).toBe(false);
    });

    it('moves focus into the dialog', () => {
      const overlay = createRotateOverlay(page.uiHost);

      overlay.setVisible(true);

      expect(page.doc.activeElement).toBe(overlay.element);
    });

    it('takes `hidden` off before focusing, because a hidden element cannot hold focus', () => {
      const overlay = createRotateOverlay(page.uiHost);

      overlay.setVisible(true);

      expect(fake(overlay.element).hiddenWhenFocused).toBe(false);
    });

    it('backs `aria-modal` with real containment: the background goes inert', () => {
      const overlay = createRotateOverlay(page.uiHost);

      overlay.setVisible(true);

      expect(page.node('game').inert).toBe(true);
      expect(page.node('hud').inert).toBe(true);
      expect(fake(overlay.element).inert).toBe(false);
    });

    it('leaves the live region perceivable, so the pause can still be announced', () => {
      createRotateOverlay(page.uiHost).setVisible(true);
      expect(page.node('live').inert).toBe(false);
    });

    it('holds Tab inside the dialog even though it has no tabbable content', () => {
      const overlay = createRotateOverlay(page.uiHost);
      overlay.setVisible(true);

      const event = page.doc.pressTab();

      expect(event.defaultPrevented).toBe(true);
      expect(page.doc.activeElement).toBe(overlay.element);
    });

    it('calls onShow exactly once, with focus already inside the dialog', () => {
      const seen: Array<unknown> = [];
      const onShow = vi.fn(() => {
        seen.push(page.doc.activeElement);
      });
      const overlay = createRotateOverlay(page.uiHost, { onShow });

      overlay.setVisible(true);

      expect(onShow).toHaveBeenCalledTimes(1);
      /* The composition root pauses the renderer here; by then the player is
         already inside a dialog they cannot tab out of. */
      expect(seen).toEqual([overlay.element]);
    });

    it('works when no callbacks were supplied at all', () => {
      const overlay = createRotateOverlay(page.uiHost);
      expect(() => {
        overlay.setVisible(true);
        overlay.setVisible(false);
      }).not.toThrow();
    });
  });

  describe('setVisible(true) twice', () => {
    it('does not pause the game a second time', () => {
      const onShow = vi.fn();
      const overlay = createRotateOverlay(page.uiHost, { onShow });

      overlay.setVisible(true);
      overlay.setVisible(true);
      overlay.setVisible(true);

      expect(onShow).toHaveBeenCalledTimes(1);
    });

    it('does not re-activate the trap or steal focus again', () => {
      const overlay = createRotateOverlay(page.uiHost);

      overlay.setVisible(true);
      const focusCalls = fake(overlay.element).focusCalls;
      overlay.setVisible(true);

      expect(fake(overlay.element).focusCalls).toBe(focusCalls);
      expect(page.doc.listenerCount('keydown')).toBe(1);
    });

    it('keeps the focus target the player will be returned to', () => {
      page.node('hud').focus();

      const overlay = createRotateOverlay(page.uiHost);
      overlay.setVisible(true);
      /* The second show must not record the overlay itself as "where focus came
         from" — that would strand the player inside a dismissed dialog. */
      overlay.setVisible(true);
      overlay.setVisible(false);

      expect(page.doc.activeElement).toBe(page.node('hud'));
    });
  });

  describe('setVisible(false)', () => {
    it('hides the element again', () => {
      const overlay = createRotateOverlay(page.uiHost);
      overlay.setVisible(true);

      overlay.setVisible(false);

      expect(overlay.visible).toBe(false);
      expect(fake(overlay.element).hidden).toBe(true);
    });

    it('lifts the inert it applied and stops trapping Tab', () => {
      const overlay = createRotateOverlay(page.uiHost);
      overlay.setVisible(true);

      overlay.setVisible(false);

      expect(page.node('game').inert).toBe(false);
      expect(page.node('hud').inert).toBe(false);
      expect(page.doc.listenerCount('keydown')).toBe(0);
    });

    it('returns focus to whatever had it before the phone was turned', () => {
      page.node('hud').focus();
      const overlay = createRotateOverlay(page.uiHost);

      overlay.setVisible(true);
      overlay.setVisible(false);

      expect(page.doc.activeElement).toBe(page.node('hud'));
    });

    it('calls onHide exactly once', () => {
      const onHide = vi.fn();
      const overlay = createRotateOverlay(page.uiHost, { onHide });

      overlay.setVisible(true);
      overlay.setVisible(false);

      expect(onHide).toHaveBeenCalledTimes(1);
    });

    it('does nothing at all when it is already hidden', () => {
      const onHide = vi.fn();
      const overlay = createRotateOverlay(page.uiHost, { onHide });

      overlay.setVisible(false);
      overlay.setVisible(false);

      expect(onHide).not.toHaveBeenCalled();
      expect(overlay.visible).toBe(false);
      expect(page.doc.listenerCount('keydown')).toBe(0);
    });
  });

  describe('across a run of rotations', () => {
    it('pauses and resumes once per transition, never per event', () => {
      const onShow = vi.fn();
      const onHide = vi.fn();
      const overlay = createRotateOverlay(page.uiHost, { onShow, onHide });

      /* Browsers fire resize and orientationchange in bursts; the same state
         arriving three times is one transition, not three. */
      overlay.setVisible(true);
      overlay.setVisible(true);
      overlay.setVisible(false);
      overlay.setVisible(false);
      overlay.setVisible(true);
      overlay.setVisible(false);

      expect(onShow).toHaveBeenCalledTimes(2);
      expect(onHide).toHaveBeenCalledTimes(2);
    });

    it('never leaves the page inert after the last hide', () => {
      const overlay = createRotateOverlay(page.uiHost);

      for (let cycle = 0; cycle < 3; cycle += 1) {
        overlay.setVisible(true);
        overlay.setVisible(false);
      }

      expect(page.node('game').inert).toBe(false);
      expect(page.node('hud').inert).toBe(false);
      expect(page.doc.listenerCount('keydown')).toBe(0);
    });
  });

  describe('sync', () => {
    /*
     * The returned mode is not decoration: `app/bootstrap/main.ts` writes it to
     * `document.documentElement.dataset.tnMode`, which is what the CSS and the
     * Playwright a11y suite key off. A wrong string here is a wrong
     * `data-tn-mode` on the page.
     */
    it('reports portrait and stays down for the design case', () => {
      const onShow = vi.fn();
      const overlay = createRotateOverlay(page.uiHost, { onShow });

      expect(overlay.sync(1080, 1920)).toBe('portrait');
      expect(overlay.visible).toBe(false);
      expect(onShow).not.toHaveBeenCalled();
    });

    it('reports landscape-phone and covers the screen for a sideways phone', () => {
      const onShow = vi.fn();
      const overlay = createRotateOverlay(page.uiHost, { onShow });

      expect(overlay.sync(844, 390)).toBe('landscape-phone');
      expect(overlay.visible).toBe(true);
      expect(fake(overlay.element).hidden).toBe(false);
      expect(onShow).toHaveBeenCalledTimes(1);
    });

    it('reports wide and stays down for a tablet or a desktop window', () => {
      const overlay = createRotateOverlay(page.uiHost);

      /* iPad mini in landscape: same portrait canvas, centred, side panels. */
      expect(overlay.sync(1133, 744)).toBe('wide');
      expect(overlay.visible).toBe(false);
    });

    it('forwards a custom short-side breakpoint', () => {
      const overlay = createRotateOverlay(page.uiHost, { phoneShortSidePx: 900 });

      expect(overlay.sync(1133, 744)).toBe('landscape-phone');
      expect(overlay.visible).toBe(true);
    });

    it('uses the default breakpoint when none was given', () => {
      const overlay = createRotateOverlay(page.uiHost);
      expect(overlay.sync(1133, 744)).toBe('wide');
    });

    it('treats a degenerate viewport as portrait rather than interrupting play', () => {
      const overlay = createRotateOverlay(page.uiHost);

      expect(overlay.sync(0, 0)).toBe('portrait');
      expect(overlay.sync(Number.NaN, 800)).toBe('portrait');
      expect(overlay.visible).toBe(false);
    });

    it('is idempotent under a burst of identical resize events', () => {
      const onShow = vi.fn();
      const onHide = vi.fn();
      const overlay = createRotateOverlay(page.uiHost, { onShow, onHide });

      overlay.sync(844, 390);
      overlay.sync(844, 390);
      overlay.sync(844, 390);

      expect(onShow).toHaveBeenCalledTimes(1);
      expect(onHide).not.toHaveBeenCalled();
    });

    it('resumes the game when the phone comes back upright', () => {
      const onHide = vi.fn();
      const overlay = createRotateOverlay(page.uiHost, { onHide });

      overlay.sync(844, 390);
      expect(overlay.sync(390, 844)).toBe('portrait');

      expect(overlay.visible).toBe(false);
      expect(onHide).toHaveBeenCalledTimes(1);
      expect(page.node('game').inert).toBe(false);
    });
  });

  describe('destroy', () => {
    it('takes the element out of the page', () => {
      const overlay = createRotateOverlay(page.uiHost);

      overlay.destroy();

      expect(page.node('ui').children).not.toContain(overlay.element);
      expect(overlay.visible).toBe(false);
    });

    it('releases the trap before removing the element, so the page is usable again', () => {
      page.node('hud').focus();
      const overlay = createRotateOverlay(page.uiHost);
      overlay.setVisible(true);

      overlay.destroy();

      /* A removed element cannot un-inert its former siblings; the order matters. */
      expect(page.node('game').inert).toBe(false);
      expect(page.node('hud').inert).toBe(false);
      expect(page.doc.listenerCount('keydown')).toBe(0);
      expect(page.doc.activeElement).toBe(page.node('hud'));
    });

    it('reports itself invisible afterwards', () => {
      const overlay = createRotateOverlay(page.uiHost);
      overlay.setVisible(true);

      overlay.destroy();

      expect(overlay.visible).toBe(false);
    });

    it('does not fire onHide: teardown is not the player returning to portrait', () => {
      const onHide = vi.fn();
      const overlay = createRotateOverlay(page.uiHost, { onHide });
      overlay.setVisible(true);

      overlay.destroy();

      /* The renderer is going away with it; resuming a game that is being torn
         down would be the wrong call. Stated here so the choice is deliberate. */
      expect(onHide).not.toHaveBeenCalled();
    });

    it('is safe on an overlay that was never shown', () => {
      const overlay = createRotateOverlay(page.uiHost);
      expect(() => {
        overlay.destroy();
      }).not.toThrow();
    });
  });
});

/* ------------------------------------------------------------------ *
 * A document double.
 *
 * Only what `createRotateOverlay` and the real `createFocusTrap` beneath it
 * reach for. No layout, no CSS, no selector engine beyond the two selectors
 * those two files actually use.
 * ------------------------------------------------------------------ */

interface FakeKeyEvent {
  readonly key: string;
  readonly shiftKey: boolean;
  defaultPrevented: boolean;
  preventDefault(): void;
}

class FakeElement {
  id = '';
  className = '';
  textContent = '';
  hidden = false;
  inert = false;
  isConnected = false;
  tabIndex = 0;
  focusCalls = 0;
  /** Whether `hidden` was still set at the moment focus was moved here. */
  hiddenWhenFocused: boolean | null = null;

  parentElement: FakeElement | null = null;
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  /** Selector tokens this element answers `matches` for. */
  readonly selectorTokens = new Set<string>();
  /** What `querySelectorAll(FOCUSABLE_SELECTOR)` returns. The overlay holds none. */
  readonly tabStops: FakeElement[] = [];

  constructor(readonly ownerDocument: FakeDocument) {}

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  append(...nodes: FakeElement[]): void {
    for (const node of nodes) {
      node.parentElement?.removeChild(node);
      node.parentElement = this;
      this.children.push(node);
      node.setConnected(this.isConnected);
    }
  }

  removeChild(node: FakeElement): void {
    const index = this.children.indexOf(node);
    if (index >= 0) this.children.splice(index, 1);
  }

  remove(): void {
    this.parentElement?.removeChild(this);
    this.parentElement = null;
    this.setConnected(false);
  }

  setConnected(connected: boolean): void {
    this.isConnected = connected;
    for (const child of this.children) child.setConnected(connected);
  }

  matches(selector: string): boolean {
    return selector
      .split(',')
      .map((token) => token.trim())
      .some((token) => token !== '' && this.selectorTokens.has(token));
  }

  closest(selector: string): FakeElement | null {
    if (selector !== '[inert]') return null;
    if (this.inert) return this;
    let node = this.parentElement;
    while (node !== null) {
      if (node.inert) return node;
      node = node.parentElement;
    }
    return null;
  }

  querySelectorAll(_selector: string): FakeElement[] {
    return this.tabStops;
  }

  focus(): void {
    this.focusCalls += 1;
    this.hiddenWhenFocused = this.hidden;
    this.ownerDocument.activeElement = this;
  }

  /** Depth-first lookup by id inside this subtree. */
  find(id: string | null): FakeElement | null {
    if (id === null) return null;
    if (this.id === id) return this;
    for (const child of this.children) {
      const hit = child.find(id);
      if (hit !== null) return hit;
    }
    return null;
  }

  findByClass(className: string): FakeElement | null {
    if (this.className === className) return this;
    for (const child of this.children) {
      const hit = child.findByClass(className);
      if (hit !== null) return hit;
    }
    return null;
  }
}

class FakeDocument {
  activeElement: FakeElement | null = null;
  readonly head: FakeElement;
  readonly body: FakeElement;
  private readonly listeners = new Map<string, Array<(event: FakeKeyEvent) => void>>();

  constructor() {
    this.head = new FakeElement(this);
    this.head.id = 'head';
    this.head.isConnected = true;
    this.body = new FakeElement(this);
    this.body.id = 'body';
    this.body.isConnected = true;
  }

  createElement(tag: string): FakeElement {
    const element = new FakeElement(this);
    element.selectorTokens.add(tag);
    return element;
  }

  getElementById(id: string): FakeElement | null {
    return this.head.find(id) ?? this.body.find(id);
  }

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

  pressTab({ shift = false } = {}): FakeKeyEvent {
    const event: FakeKeyEvent = {
      key: 'Tab',
      shiftKey: shift,
      defaultPrevented: false,
      preventDefault(): void {
        this.defaultPrevented = true;
      },
    };
    for (const handler of this.listeners.get('keydown') ?? []) handler(event);
    return event;
  }
}

interface Page {
  readonly doc: FakeDocument;
  /** `#ui`, typed as the overlay expects it. */
  readonly uiHost: HTMLElement;
  node(name: 'head' | 'body' | 'game' | 'ui' | 'live' | 'hud'): FakeElement;
}

/**
 * The real slice-0 tree, plus the HUD control slice 1 adds:
 *
 *   head                 (where the injected <style> lands)
 *   body
 *     ├─ game            (canvas host — must go inert behind the overlay)
 *     └─ ui
 *          ├─ live       (aria-live — must stay perceivable)
 *          ├─ hud        (focusable control — must go inert, and get focus back)
 *          └─ overlay    (built by the module under test)
 */
function buildPage(): Page {
  const doc = new FakeDocument();

  const make = (id: string): FakeElement => {
    const element = new FakeElement(doc);
    element.id = id;
    return element;
  };

  const game = make('game');
  const ui = make('ui');
  const live = make('tn-live-region');
  live.selectorTokens.add('[aria-live]').add('[role="status"]');
  const hud = make('tn-hud');

  doc.body.append(game, ui);
  ui.append(live, hud);

  const byName: Record<string, FakeElement> = {
    head: doc.head,
    body: doc.body,
    game,
    ui,
    live,
    hud,
  };

  return {
    doc,
    uiHost: ui as unknown as HTMLElement,
    node: (name) => byName[name] as FakeElement,
  };
}

/** Re-view an element the module handed back as `HTMLElement` as the double it really is. */
function fake(element: HTMLElement): FakeElement {
  return element as unknown as FakeElement;
}

/** The two strings a screen reader will read out of the dialog. */
function text(element: HTMLElement): { title: string; body: string } {
  const root = fake(element);
  return {
    title: root.find('tn-rotate-title')?.textContent ?? '',
    body: root.find('tn-rotate-body')?.textContent ?? '',
  };
}
