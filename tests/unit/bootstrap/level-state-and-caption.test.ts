import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * What the page says about itself, and when.
 *
 * `app/ui/build-status.ts` mounts one sentence — *"Foundation build. There is no
 * level to play yet — the first one comes next."* — and it is the honest
 * description of a page with no level and a **lie** over a running one. It was
 * found sitting in a panel over the Ottawa ice, the most legible text on the
 * screen, telling the player there was nothing to play. That is the second time
 * this project has shipped a screen that misdescribes its own state; the first
 * was the boot screen reading as a stalled loading bar, reported twice from two
 * devices.
 *
 * The caption itself is not the defect and it is not changed: `app/ui` owns it
 * and it is right about the page it was written for. What was missing is that
 * nobody *decided* whether to mount it. Mounting is a composition decision, it
 * belongs to `app/bootstrap` (ADR-0005), and this suite is the decision written
 * down: the sentence appears exactly when it is true, and it does not come back
 * when a level fails to load — "there is no level to play yet" is no truer then.
 *
 * It also pins `data-tn-level`, which is the attribute `app/ui` routes on. That
 * contract is why a level error card can be built without the UI agent having to
 * re-derive the page's state from a query string.
 *
 * `node` environment, no jsdom: the fake DOM below supplies the handful of calls
 * the boot path makes, as `live-region-order.test.ts` does. If `main.ts` starts
 * needing more of the DOM than this, it has grown something that belongs in
 * `app/ui`.
 */

const hoisted = vi.hoisted(() => {
  const state: {
    loadCalls: string[];
    loadResult: unknown;
    search: string;
  } = {
    loadCalls: [],
    loadResult: { ok: true, value: undefined },
    search: '',
  };
  return { state };
});

vi.mock('@adapters/phaser', () => ({
  parseBootConfig: (): unknown => ({
    ok: true,
    value: {
      title: 'TrueNorth',
      version: '0.1.0',
      defaultLocale: 'en',
      palette: { sky: '#8ecae6', ground: '#2a9d8f', horizon: '#219ebc' },
    },
  }),
  GameRenderer: class {
    readonly ready = Promise.resolve();
    get palette(): Record<string, string> {
      return { sky: '#8ecae6' };
    }
    cssVariables(): Record<string, string> {
      return {};
    }
    async loadLevel(id: string): Promise<unknown> {
      hoisted.state.loadCalls.push(id);
      return Promise.resolve(hoisted.state.loadResult);
    }
    pause(): void {}
    resume(): void {}
  },
}));

vi.mock('@ui/rotate-overlay', () => ({
  createRotateOverlay: () => ({
    element: null,
    visible: false,
    sync: () => 'portrait',
    setVisible: () => undefined,
    destroy: () => undefined,
  }),
}));

/* ------------------------------------------------------------------ fake DOM */

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly dataset: Record<string, string> = {};
  readonly style = { setProperty: (): void => undefined };
  parentElement: FakeElement | null = null;
  id = '';
  lang = '';
  className = '';
  textContent = '';
  tabIndex = 0;
  hidden = false;

  constructor(
    readonly tagName: string,
    readonly ownerDocument: FakeDocument,
  ) {}

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  appendChild<T extends FakeElement>(child: T): T {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  append(...nodes: FakeElement[]): void {
    for (const node of nodes) this.appendChild(node);
  }

  remove(): void {
    const siblings = this.parentElement?.children;
    if (siblings === undefined) return;
    const index = siblings.indexOf(this);
    if (index >= 0) siblings.splice(index, 1);
    this.parentElement = null;
  }

  *descendants(): Generator<FakeElement> {
    for (const child of this.children) {
      yield child;
      yield* child.descendants();
    }
  }
}

class FakeDocument {
  readonly documentElement = new FakeElement('html', this);
  readonly head = new FakeElement('head', this);
  readonly body = new FakeElement('body', this);
  title = '';

  constructor() {
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
  }

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName, this);
  }

  getElementById(id: string): FakeElement | null {
    for (const element of this.documentElement.descendants()) {
      if (element.id === id) return element;
    }
    return null;
  }

  /** Only `meta[name="theme-color"]` is ever asked for, and the fake page has none. */
  querySelector(): FakeElement | null {
    return null;
  }
}

const asDocument = (doc: FakeDocument): Document => doc as unknown as Document;

function mountPage(): FakeDocument {
  const doc = new FakeDocument();
  const game = doc.createElement('div');
  game.id = 'game';
  const ui = doc.createElement('div');
  ui.id = 'ui';
  doc.body.append(game, ui);
  return doc;
}

let doc: FakeDocument;

/** Import the composition root fresh with a given query string; `main()` runs at module scope. */
async function boot(search: string): Promise<void> {
  hoisted.state.search = search;
  vi.stubGlobal('window', {
    innerWidth: 390,
    innerHeight: 844,
    location: { search },
    addEventListener: (): void => undefined,
  });
  vi.resetModules();
  await import('../../../app/bootstrap/main');
  /* Two microtask hops: `renderer.ready.then(...).then(...)`. */
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  vi.runAllTimers();
}

beforeEach(() => {
  vi.useFakeTimers();
  hoisted.state.loadCalls = [];
  hoisted.state.loadResult = { ok: true, value: undefined };
  doc = mountPage();
  vi.stubGlobal('document', asDocument(doc));
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const caption = (): FakeElement | null => doc.getElementById('tn-build-status');
const announcement = (): string => doc.getElementById('tn-live-region')?.textContent ?? '';
const levelState = (): string | undefined => doc.documentElement.dataset['tnLevel'];

describe('the foundation caption is mounted only where it is true', () => {
  it('is on the page when no level was asked for', async () => {
    await boot('');

    expect(caption(), 'the foundation build lost the one sentence that explains it').not.toBeNull();
    expect(caption()?.textContent).toContain('Foundation build');
    expect(levelState(), 'no level was asked for, so there is no level state').toBeUndefined();
  });

  it('is not on the page when a level is opening', async () => {
    await boot('?level=ottawa');

    expect(
      caption(),
      '"There is no level to play yet" is on screen over a level that is playing',
    ).toBeNull();
    expect(hoisted.state.loadCalls).toEqual(['ottawa']);
  });

  it('does not come back when the level fails to load', async () => {
    hoisted.state.loadResult = {
      ok: false,
      error: { kind: 'io', code: 'content.level.fetchFailed', message: 'no.' },
    };
    await boot('?level=ottawa');

    /* The page needs an error card with "Try again" and "Go back"
       (TN-LEVEL-02), not a sentence saying no level exists — one does, it did
       not arrive. The card is `app/ui`'s and hangs off `data-tn-level`. */
    expect(caption()).toBeNull();
    expect(levelState()).toBe('failed');
  });

  it('treats an empty ?level= as no level at all', async () => {
    await boot('?level=');

    expect(caption()).not.toBeNull();
    expect(hoisted.state.loadCalls).toEqual([]);
  });
});

describe('the announcement says what the screen says', () => {
  it('carries the foundation sentence when the caption is on screen', async () => {
    await boot('');

    expect(announcement()).toContain('TrueNorth ready');
    expect(announcement()).toContain('Foundation build');
  });

  it('does not tell a screen-reader user there is nothing to play while a level runs', async () => {
    await boot('?level=ottawa');

    expect(announcement()).toContain('TrueNorth ready');
    expect(
      announcement(),
      'the one channel a screen-reader user has said the game has no levels, over a live level',
    ).not.toContain('Foundation build');
  });
});

describe('data-tn-level is the state app/ui routes on', () => {
  it('is absent for the shell, so a missing value cannot read as a healthy level', async () => {
    await boot('');
    expect(levelState()).toBeUndefined();
  });

  it('reaches "ready" when a level opens', async () => {
    await boot('?level=ottawa');
    expect(levelState()).toBe('ready');
  });

  it('is "failed" when it does not, with the reason on the console for a developer', async () => {
    hoisted.state.loadResult = {
      ok: false,
      error: { kind: 'not-found', code: 'content.level.missing', message: 'no such level.' },
    };
    await boot('?level=atlantis');

    expect(levelState()).toBe('failed');
    expect(announcement()).toContain('atlantis');
  });
});
