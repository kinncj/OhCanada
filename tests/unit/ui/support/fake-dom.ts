/**
 * A small DOM, for testing DOM.
 *
 * The unit suite runs under `environment: 'node'` and there is no jsdom in the
 * tree (see `tests/unit/ui/focus-trap.test.ts`, which introduced the pattern
 * with a per-file double). Five screens need more than a per-file double can
 * carry — attributes, events with a capture phase, a selector engine — so the
 * double is shared, and it is deliberately *small and literal*: no layout, no
 * cascade, no reflow.
 *
 * What that means for what may be asserted here, and it is worth being blunt
 * about: this file can prove **structure and behaviour** — the role an element
 * carries, whether a handler ran, where focus went, which attribute changed. It
 * cannot prove **anything geometric**: a 44 px touch target, a label that does
 * not clip at 200 %, a contrast ratio. Those are asserted in `tests/a11y/`
 * against real Chromium, where they can actually fail. A unit test that claimed
 * a target was 44 px against this file would be a green tick that certifies
 * nothing, which is the failure mode this project has spent a session removing.
 *
 * Supported selectors: comma-separated groups of a tag name and/or attribute
 * selectors (`[a]`, `[a="v"]`, `[a^="v"]`) and `:not(...)` of the same. A group
 * containing a combinator matches nothing, which is honest rather than silently
 * wrong — nothing in `app/ui` depends on one.
 */

export interface FakeEventInit {
  readonly bubbles?: boolean;
  readonly key?: string;
  readonly shiftKey?: boolean;
  readonly repeat?: boolean;
}

export class FakeEvent {
  readonly type: string;
  readonly bubbles: boolean;
  readonly key: string;
  readonly shiftKey: boolean;
  readonly repeat: boolean;
  defaultPrevented = false;
  target: FakeElement | null = null;
  private stopped = false;

  constructor(type: string, init: FakeEventInit = {}) {
    this.type = type;
    this.bubbles = init.bubbles ?? true;
    this.key = init.key ?? '';
    this.shiftKey = init.shiftKey ?? false;
    this.repeat = init.repeat ?? false;
  }

  preventDefault(): void {
    this.defaultPrevented = true;
  }

  stopPropagation(): void {
    this.stopped = true;
  }

  get propagationStopped(): boolean {
    return this.stopped;
  }
}

type Listener = (event: FakeEvent) => void;

interface Registration {
  readonly type: string;
  readonly listener: Listener;
  readonly capture: boolean;
}

export class FakeText {
  readonly nodeType = 3;
  parentElement: FakeElement | null = null;
  constructor(public data: string) {}

  get textContent(): string {
    return this.data;
  }
}

export type FakeNode = FakeElement | FakeText;

export class FakeElement {
  readonly nodeType = 1;
  readonly tagName: string;
  readonly attributes = new Map<string, string>();
  readonly childNodes: FakeNode[] = [];
  readonly style = new FakeStyle();
  parentElement: FakeElement | null = null;
  focusCount = 0;
  clickCount = 0;

  private readonly registrations: Registration[] = [];

  constructor(
    readonly ownerDocument: FakeDocument,
    tagName: string,
  ) {
    this.tagName = tagName.toUpperCase();
  }

  /* ---- identity and attributes ---------------------------------------- */

  get id(): string {
    return this.attributes.get('id') ?? '';
  }
  set id(value: string) {
    this.attributes.set('id', value);
  }

  get className(): string {
    return this.attributes.get('class') ?? '';
  }
  set className(value: string) {
    this.attributes.set('class', value);
  }

  get hidden(): boolean {
    return this.attributes.has('hidden');
  }
  set hidden(value: boolean) {
    if (value) this.attributes.set('hidden', '');
    else this.attributes.delete('hidden');
  }

  get inert(): boolean {
    return this.attributes.has('inert');
  }
  set inert(value: boolean) {
    if (value) this.attributes.set('inert', '');
    else this.attributes.delete('inert');
  }

  get tabIndex(): number {
    const raw = this.attributes.get('tabindex');
    if (raw !== undefined) return Number.parseInt(raw, 10);
    return this.tagName === 'BUTTON' || this.tagName === 'A' || this.tagName === 'INPUT' ? 0 : -1;
  }
  set tabIndex(value: number) {
    this.attributes.set('tabindex', String(value));
  }

  get disabled(): boolean {
    return this.attributes.has('disabled');
  }
  set disabled(value: boolean) {
    if (value) this.attributes.set('disabled', '');
    else this.attributes.delete('disabled');
  }

  get type(): string {
    return this.attributes.get('type') ?? '';
  }
  set type(value: string) {
    this.attributes.set('type', value);
  }

  get value(): string {
    return this.attributes.get('value') ?? '';
  }
  set value(next: string) {
    this.attributes.set('value', next);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  /* ---- tree ------------------------------------------------------------ */

  get children(): FakeElement[] {
    return this.childNodes.filter(isElement);
  }

  get firstChild(): FakeNode | null {
    return this.childNodes[0] ?? null;
  }

  get isConnected(): boolean {
    return this.ancestors().includes(this.ownerDocument.documentElement);
  }

  /** This element and every ancestor, innermost first. */
  ancestors(): FakeElement[] {
    const path: FakeElement[] = [];
    let node = this as FakeElement | null;
    while (node !== null) {
      path.push(node);
      node = node.parentElement;
    }
    return path;
  }

  append(...nodes: readonly (FakeNode | string)[]): void {
    for (const node of nodes) {
      const child = typeof node === 'string' ? new FakeText(node) : node;
      child.parentElement?.removeChild(child);
      child.parentElement = this;
      this.childNodes.push(child);
    }
  }

  appendChild<T extends FakeNode>(node: T): T {
    this.append(node);
    return node;
  }

  removeChild(node: FakeNode): void {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) this.childNodes.splice(index, 1);
    node.parentElement = null;
  }

  remove(): void {
    this.parentElement?.removeChild(this);
  }

  contains(node: FakeElement): boolean {
    return node.ancestors().includes(this);
  }

  get textContent(): string {
    return this.childNodes
      .map((node) => (isElement(node) ? node.textContent : node.data))
      .join('');
  }

  set textContent(value: string) {
    this.childNodes.length = 0;
    if (value !== '') this.append(new FakeText(value));
  }

  /* ---- queries --------------------------------------------------------- */

  matches(selector: string): boolean {
    return selector
      .split(',')
      .map((group) => group.trim())
      .some((group) => group !== '' && matchesCompound(this, group));
  }

  closest(selector: string): FakeElement | null {
    return this.ancestors().find((node) => node.matches(selector)) ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const found: FakeElement[] = [];
    const walk = (node: FakeElement): void => {
      for (const child of node.children) {
        if (child.matches(selector)) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  /** Depth-first by id, for tests that want to reach into a screen. */
  find(id: string | null): FakeElement | null {
    if (id === null || id === '') return null;
    if (this.id === id) return this;
    for (const child of this.children) {
      const hit = child.find(id);
      if (hit !== null) return hit;
    }
    return null;
  }

  /** Depth-first by `data-testid` — the vocabulary `docs/stories/README.md` fixes. */
  byTestId(testId: string): FakeElement | null {
    return this.querySelector(`[data-testid="${testId}"]`);
  }

  allByTestId(testId: string): FakeElement[] {
    return this.querySelectorAll(`[data-testid="${testId}"]`);
  }

  /* ---- interaction ------------------------------------------------------ */

  checkVisibility(): boolean {
    return !this.ancestors().some((node) => node.hidden);
  }

  focus(): void {
    this.focusCount += 1;
    this.ownerDocument.activeElement = this;
  }

  blur(): void {
    if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = null;
  }

  click(): void {
    this.clickCount += 1;
    this.dispatchEvent(new FakeEvent('click'));
  }

  addEventListener(type: string, listener: Listener, capture: boolean | undefined = false): void {
    this.registrations.push({ type, listener, capture: capture === true });
  }

  removeEventListener(
    type: string,
    listener: Listener,
    capture: boolean | undefined = false,
  ): void {
    const index = this.registrations.findIndex(
      (entry) =>
        entry.type === type && entry.listener === listener && entry.capture === (capture === true),
    );
    if (index >= 0) this.registrations.splice(index, 1);
  }

  listenerCount(type: string): number {
    return this.registrations.filter((entry) => entry.type === type).length;
  }

  runListeners(event: FakeEvent, capture: boolean): void {
    for (const entry of [...this.registrations]) {
      if (entry.type !== event.type || entry.capture !== capture) continue;
      entry.listener(event);
      if (event.propagationStopped) return;
    }
  }

  /** Real capture-then-bubble dispatch: the focus trap and the switch ring both
      listen at the document in the capture phase, and a double that skipped that
      would let a handler pass that never runs in a browser. */
  dispatchEvent(event: FakeEvent): boolean {
    event.target = this;
    const path = this.ancestors();

    const doc = this.ownerDocument;
    /* Capture runs outermost-first, and the document is outside every element. */
    doc.runDocumentListeners(event, true);
    if (event.propagationStopped) return !event.defaultPrevented;
    for (const element of [...path].reverse()) {
      if (element === this) break;
      element.runListeners(event, true);
      if (event.propagationStopped) return !event.defaultPrevented;
    }

    this.runListeners(event, true);
    this.runListeners(event, false);
    if (event.propagationStopped || !event.bubbles) return !event.defaultPrevented;

    for (const element of path.slice(1)) {
      element.runListeners(event, false);
      if (event.propagationStopped) return !event.defaultPrevented;
    }
    doc.runDocumentListeners(event, false);
    return !event.defaultPrevented;
  }
}

class FakeStyle {
  readonly properties = new Map<string, string>();
  setProperty(name: string, value: string): void {
    this.properties.set(name, value);
  }
  getPropertyValue(name: string): string {
    return this.properties.get(name) ?? '';
  }
}

export class FakeDocument {
  activeElement: FakeElement | null = null;
  readonly documentElement: FakeElement;
  readonly head: FakeElement;
  readonly body: FakeElement;
  private readonly registrations: Registration[] = [];

  constructor() {
    this.documentElement = new FakeElement(this, 'html');
    this.head = new FakeElement(this, 'head');
    this.body = new FakeElement(this, 'body');
    this.documentElement.append(this.head, this.body);
  }

  createElement(tag: string): FakeElement {
    return new FakeElement(this, tag);
  }

  getElementById(id: string): FakeElement | null {
    return this.documentElement.find(id);
  }

  querySelector(selector: string): FakeElement | null {
    return this.documentElement.querySelector(selector);
  }

  querySelectorAll(selector: string): FakeElement[] {
    return this.documentElement.querySelectorAll(selector);
  }

  byTestId(testId: string): FakeElement | null {
    return this.documentElement.byTestId(testId);
  }

  addEventListener(type: string, listener: Listener, capture: boolean | undefined = false): void {
    this.registrations.push({ type, listener, capture: capture === true });
  }

  removeEventListener(
    type: string,
    listener: Listener,
    capture: boolean | undefined = false,
  ): void {
    const index = this.registrations.findIndex(
      (entry) =>
        entry.type === type && entry.listener === listener && entry.capture === (capture === true),
    );
    if (index >= 0) this.registrations.splice(index, 1);
  }

  listenerCount(type: string): number {
    return this.registrations.filter((entry) => entry.type === type).length;
  }

  runDocumentListeners(event: FakeEvent, capture: boolean): void {
    for (const entry of [...this.registrations]) {
      if (entry.type !== event.type || entry.capture !== capture) continue;
      entry.listener(event);
      if (event.propagationStopped) return;
    }
  }

  /** Dispatch straight at the document, for "tap anywhere". */
  dispatchEvent(event: FakeEvent): boolean {
    this.runDocumentListeners(event, true);
    this.runDocumentListeners(event, false);
    return !event.defaultPrevented;
  }
}

function isElement(node: FakeNode): node is FakeElement {
  return node.nodeType === 1;
}

/** `[name]`, `[name="value"]`, `[name^="value"]`. */
function matchesAttribute(element: FakeElement, token: string): boolean {
  const body = token.slice(1, -1);
  const prefix = body.match(/^([\w-]+)\^=["']?([^"'\]]*)["']?$/);
  if (prefix !== null) {
    const value = element.getAttribute(prefix[1] ?? '');
    return value !== null && value.startsWith(prefix[2] ?? '');
  }
  const exact = body.match(/^([\w-]+)=["']?([^"'\]]*)["']?$/);
  if (exact !== null) {
    return element.getAttribute(exact[1] ?? '') === (exact[2] ?? '');
  }
  return element.hasAttribute(body);
}

function matchesCompound(element: FakeElement, selector: string): boolean {
  /* No combinator support, and no pretence of it. */
  if (/[\s>+~]/.test(selector)) return false;

  const tokens = selector.match(/:not\([^)]*\)|\[[^\]]*\]|\.[\w-]+|#[\w-]+|[\w-]+|\*/g);
  if (tokens === null) return false;

  return tokens.every((token) => {
    if (token.startsWith(':not(')) {
      return !matchesCompound(element, token.slice(5, -1));
    }
    if (token.startsWith('[')) return matchesAttribute(element, token);
    if (token.startsWith('.')) return element.className.split(/\s+/).includes(token.slice(1));
    if (token.startsWith('#')) return element.id === token.slice(1);
    if (token === '*') return true;
    if (token.startsWith(':')) return false;
    return element.tagName === token.toUpperCase();
  });
}

/* ---- the boundary casts ------------------------------------------------ */

export interface FakePage {
  readonly doc: FakeDocument;
  /** `#ui` from index.html: where every DOM screen mounts. */
  readonly ui: FakeElement;
  /** `#game`: the canvas host, which must go inert behind a modal. */
  readonly game: FakeElement;
  /** The one live region, which must not. */
  readonly live: FakeElement;
  /** Typed for the modules under test. */
  readonly host: HTMLElement;
  readonly document: Document;
}

/** The real slice-0 tree from `index.html`, so `inert` has something to act on. */
export function buildPage(): FakePage {
  const doc = new FakeDocument();

  const game = doc.createElement('div');
  game.id = 'game';

  const ui = doc.createElement('div');
  ui.id = 'ui';

  const live = doc.createElement('div');
  live.id = 'tn-live-region';
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');

  doc.body.append(game, ui);
  ui.append(live);

  return {
    doc,
    ui,
    game,
    live,
    host: ui as unknown as HTMLElement,
    document: doc as unknown as Document,
  };
}

/** Press and release a switch contact, `heldMs` apart on the injected clock. */
export function pressSwitch(page: FakePage, clock: { now: number }, heldMs: number): void {
  page.doc.dispatchEvent(new FakeEvent('pointerdown'));
  clock.now += heldMs;
  page.doc.dispatchEvent(new FakeEvent('pointerup'));
}

/** Send a key at an element, so it runs the capture listeners a browser would. */
export function press(target: FakeElement, key: string, init: FakeEventInit = {}): FakeEvent {
  const event = new FakeEvent('keydown', { ...init, key });
  target.dispatchEvent(event);
  return event;
}
