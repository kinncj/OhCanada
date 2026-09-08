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
 * Since task 1.12 it also pins the **event-bus wiring**: the scene's events reach
 * `app/ui` through the typed bus rather than through a test harness, and the two
 * composition decisions that make the page's landmarks correct — `#game` handed
 * to the HUD as `canvasHost`, and every modal opened over a level mounted into
 * `hud.main` rather than beside it — are asserted here because they are
 * decisions, and decisions live in the composition root.
 *
 * `node` environment, no jsdom: the fake DOM below supplies the handful of calls
 * the boot path makes, as `live-region-order.test.ts` does. The DOM *screens*
 * are mocked, exactly as the Phaser adapter is, for the same reason: this suite
 * asks what bootstrap decided, not what a `<button>` looks like. `app/ui` has its
 * own suites and its own axe scans, and re-testing them through a hand-rolled
 * DOM would test the hand-rolled DOM. What is deliberately **not** mocked is
 * `@ui/level-events`: it is pure, it is the subscriber the bus exists to feed,
 * and mocking it would leave the wiring unproven.
 */

const hoisted = vi.hoisted(() => {
  const state: {
    loadCalls: string[];
    loadResult: unknown;
    search: string;
    /** The options `createHud` was called with, and the host it was given. */
    hudOptions: Record<string, unknown> | null;
    hudHost: unknown;
    /** Which host each modal was mounted into. */
    modalHosts: Record<string, unknown>;
    /** The open level document the renderer reports. */
    level: unknown;
    paused: number;
    resumed: number;
    poiShown: unknown[];
    errorShown: number;
  } = {
    loadCalls: [],
    loadResult: { ok: true, value: undefined },
    search: '',
    hudOptions: null,
    hudHost: null,
    modalHosts: {},
    level: null,
    paused: 0,
    resumed: 0,
    poiShown: [],
    errorShown: 0,
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
    get level(): unknown {
      return hoisted.state.level;
    }
    pause(): void {
      hoisted.state.paused += 1;
    }
    resume(): void {
      hoisted.state.resumed += 1;
    }
  },
}));

/*
 * The DOM screens, mocked at the seam bootstrap actually uses.
 *
 * Each records the host it was mounted into, which is the whole of what this
 * suite has to say about them: `hud.main` for anything opened over a level, and
 * `#game` handed to the HUD so the canvas ends up inside the one `<main>`.
 */
vi.mock('@ui/hud', () => ({
  createHud: (host: unknown, options: Record<string, unknown>): unknown => {
    hoisted.state.hudHost = host;
    hoisted.state.hudOptions = options;
    const main = { id: 'tn-main' };
    return {
      element: {},
      main,
      menu: {},
      prompt: null,
      setMode: () => undefined,
      setTask: () => undefined,
      setPrompt: () => undefined,
      setStorageWarning: () => undefined,
      openMenu: () => undefined,
      closeMenu: () => undefined,
      setLocale: () => undefined,
      setSingleSwitch: () => undefined,
      destroy: () => undefined,
    };
  },
}));

vi.mock('@ui/poi-card', () => ({
  createPoiCard: (host: unknown): unknown => {
    hoisted.state.modalHosts['poi-card'] = host;
    return {
      element: {},
      visible: false,
      show: (content: unknown) => hoisted.state.poiShown.push(content),
      hide: () => undefined,
      setLocale: () => undefined,
      setSingleSwitch: () => undefined,
      destroy: () => undefined,
    };
  },
}));

vi.mock('@ui/level-screens', () => ({
  createLevelError: (host: unknown): unknown => {
    hoisted.state.modalHosts['level-error'] = host;
    return {
      element: {},
      visible: false,
      show: () => {
        hoisted.state.errorShown += 1;
      },
      hide: () => undefined,
      setLocale: () => undefined,
      destroy: () => undefined,
    };
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
  hoisted.state.hudOptions = null;
  hoisted.state.hudHost = null;
  hoisted.state.modalHosts = {};
  hoisted.state.level = null;
  hoisted.state.paused = 0;
  hoisted.state.resumed = 0;
  hoisted.state.poiShown = [];
  hoisted.state.errorShown = 0;
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
    /*
     * The id is on the console and NOT in the announcement, and that is the
     * change task 1.12 made deliberately. It used to be announced, because
     * bootstrap called `announce` with a sentence it had written itself. A level
     * id is developer vocabulary and this file may not author player-facing copy
     * (ADR-0010), so the failure now goes on the bus and `app/ui` says what a
     * player hears — `level.error.title`, from the copy table, in their language.
     */
    expect(vi.mocked(console.error).mock.calls.flat().join(' ')).toContain('atlantis');
    expect(announcement()).toContain('could not load');
  });
});

describe('the page has one <main>, and every modal is inside it (TN-HUD-07)', () => {
  it('hands the canvas host to the HUD, so <main> holds what the page is for', async () => {
    await boot('?level=ottawa');

    expect(
      hoisted.state.hudOptions?.['canvasHost'],
      'the HUD was mounted without the canvas host, so <main> is a wrapper invented ' +
        'to satisfy a scanner rather than the content of the page',
    ).toBe(doc.getElementById('game'));
    expect(hoisted.state.hudHost, 'the HUD belongs in the #ui layer').toBe(
      doc.getElementById('ui'),
    );
  });

  it('mounts every modal opened over a level into hud.main, never beside it', async () => {
    await boot('?level=ottawa');

    /* A `dialog` is not a landmark. A modal mounted beside `<main>` puts its
       content outside every landmark, and axe's `region` rule is right to
       complain — the fix is the page, not the rule. */
    for (const [what, host] of Object.entries(hoisted.state.modalHosts)) {
      expect(host, `${what} was mounted outside <main>`).toEqual({ id: 'tn-main' });
    }
    expect(Object.keys(hoisted.state.modalHosts).sort()).toEqual(['level-error', 'poi-card']);
  });

  it('mounts no HUD and no modal on the foundation shell', async () => {
    await boot('');

    expect(hoisted.state.hudOptions, 'a page with no level was given a level HUD').toBeNull();
    expect(hoisted.state.modalHosts).toEqual({});
  });
});
