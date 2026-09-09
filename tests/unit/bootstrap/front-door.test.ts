import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The front door, and what the page is while a level has it.
 *
 * Slice 1 built a title screen, a level select, a HUD, a menu, a question card,
 * Study, settings, a POI card and two level screens, and wired none of them:
 * `app/bootstrap/main.ts` mounted the live region, the rotate overlay, the
 * renderer and a caption reading *"Foundation build. There is no level to play
 * yet"*. A visitor who typed the address read that sentence and had nothing to
 * press — a page describing itself wrongly, which is the third time this project
 * has shipped that shape. This suite is the wiring written down.
 *
 * It asserts **decisions**, because decisions live in the composition root
 * (ADR-0005) and nowhere else:
 *
 *  - a cold load opens the shell, and only a level gets a HUD;
 *  - `shell.enterLevel` is called **before** `createHud`, so the page never has
 *    two `<main>` landmarks;
 *  - `built` and `unlocked` are computed here, from the level catalogue and the
 *    config's `unlockRules`, and handed to the map as data;
 *  - `onPlayLevel` is a request this file may refuse;
 *  - leaving a level takes the HUD's `<main>` away and puts the canvas back,
 *    rather than leaving a second landmark behind the map;
 *  - `data-tn-level` — the attribute `app/ui` routes on — says loading, ready or
 *    failed, and is absent when no level is open.
 *
 * `node` environment, no jsdom: the fake DOM below supplies the handful of calls
 * the boot path makes. The DOM *screens* are mocked, exactly as the Phaser
 * adapter is, for the same reason: this suite asks what bootstrap decided, not
 * what a `<button>` looks like. `app/ui` has its own suites and its own axe
 * scans. What is deliberately **not** mocked is `@ui/level-events`: it is pure,
 * it is the subscriber the bus exists to feed, and mocking it would leave the
 * wiring unproven.
 */

const hoisted = vi.hoisted(() => {
  const state: {
    /** Every composition step, in the order it happened. Order is the assertion. */
    calls: string[];
    loadCalls: string[];
    loadResult: unknown;
    search: string;
    /** Which level ids this build has a document for. */
    built: string[];
    hudOptions: Record<string, unknown> | null;
    hudHost: unknown;
    hudDestroyed: number;
    mainRemoved: number;
    modalHosts: Record<string, unknown>;
    shellOptions: Record<string, unknown> | null;
    shellHost: unknown;
    storageWarning: boolean;
    entries: unknown;
    level: unknown;
    paused: number;
    resumed: number;
    poiShown: unknown[];
    errorShown: number;
    autoMove: boolean[];
  } = {
    calls: [],
    loadCalls: [],
    loadResult: { ok: true, value: undefined },
    search: '',
    built: ['ottawa', 'quebec-city'],
    hudOptions: null,
    hudHost: null,
    hudDestroyed: 0,
    mainRemoved: 0,
    modalHosts: {},
    shellOptions: null,
    shellHost: null,
    storageWarning: false,
    entries: null,
    level: null,
    paused: 0,
    resumed: 0,
    poiShown: [],
    errorShown: 0,
    autoMove: [],
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
  /*
   * The level catalogue, which derives its answer from `content/levels/*.json`
   * through a bundler glob. Stubbed as a set, because the question this suite
   * asks is whether bootstrap *consults* it — the alternative being a list of
   * built levels written into a screen, which is the bug `TN-MAP` is about.
   */
  hasLevel: (id: string): boolean => hoisted.state.built.includes(id),
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
    setAutoMove(enabled: boolean): void {
      hoisted.state.autoMove.push(enabled);
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
 * The shell. Recorded rather than drawn: what this suite has to say about it is
 * the host it was mounted into, the data it was handed, and *when* each of its
 * three routing calls happened relative to the HUD.
 */
vi.mock('@ui/shell', () => ({
  createShell: (host: unknown, options: Record<string, unknown>): unknown => {
    hoisted.state.calls.push('createShell');
    hoisted.state.shellHost = host;
    hoisted.state.shellOptions = options;
    hoisted.state.entries = options['entries'];
    return {
      element: {},
      main: {},
      view: null,
      start: (): void => {
        hoisted.state.calls.push('shell.start');
      },
      show: (): void => undefined,
      enterLevel: (id: string): void => {
        hoisted.state.calls.push(`shell.enterLevel:${id}`);
      },
      leaveLevel: (): void => {
        hoisted.state.calls.push('shell.leaveLevel');
      },
      setEntries: (next: unknown): void => {
        hoisted.state.entries = next;
      },
      setResumeLevelId: (): void => undefined,
      setCharacterRequired: (): void => undefined,
      setStorageWarning: (raised: boolean): void => {
        hoisted.state.storageWarning = raised;
      },
      setModalOpen: (): void => undefined,
      destroy: (): void => undefined,
    };
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
    hoisted.state.calls.push('createHud');
    hoisted.state.hudHost = host;
    hoisted.state.hudOptions = options;
    const main = {
      id: 'tn-main',
      remove: (): void => {
        hoisted.state.mainRemoved += 1;
      },
    };
    return {
      element: {},
      main,
      menu: {},
      prompt: null,
      focus: (): void => {
        hoisted.state.calls.push('hud.focus');
      },
      setMode: () => undefined,
      setTask: () => undefined,
      setPrompt: () => undefined,
      setStorageWarning: () => undefined,
      openMenu: () => undefined,
      closeMenu: () => undefined,
      setLocale: () => undefined,
      setSingleSwitch: () => undefined,
      destroy: (): void => {
        hoisted.state.hudDestroyed += 1;
      },
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
      setSingleSwitch: () => undefined,
      destroy: () => undefined,
    };
  },
}));

vi.mock('@ui/settings-screen', () => ({
  createSettingsScreen: (host: unknown): unknown => {
    hoisted.state.modalHosts['settings'] = host;
    return {
      element: {},
      visible: false,
      show: () => undefined,
      hide: () => undefined,
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

  get nextElementSibling(): FakeElement | null {
    const siblings = this.parentElement?.children;
    if (siblings === undefined) return null;
    return siblings[siblings.indexOf(this) + 1] ?? null;
  }

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

  /** `before === null` appends, which is the DOM's own rule. */
  insertBefore<T extends FakeElement>(node: T, before: FakeElement | null): T {
    node.remove();
    node.parentElement = this;
    const at = before === null ? -1 : this.children.indexOf(before);
    if (at === -1) this.children.push(node);
    else this.children.splice(at, 0, node);
    return node;
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

/** Let the boot path's promise chain settle: the save read, then the level load. */
async function flush(): Promise<void> {
  for (let tick = 0; tick < 20; tick += 1) await Promise.resolve();
}

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
  await flush();
  vi.runAllTimers();
}

beforeEach(() => {
  vi.useFakeTimers();
  hoisted.state.calls = [];
  hoisted.state.loadCalls = [];
  hoisted.state.loadResult = { ok: true, value: undefined };
  hoisted.state.built = ['ottawa', 'quebec-city'];
  hoisted.state.hudOptions = null;
  hoisted.state.hudHost = null;
  hoisted.state.hudDestroyed = 0;
  hoisted.state.mainRemoved = 0;
  hoisted.state.modalHosts = {};
  hoisted.state.shellOptions = null;
  hoisted.state.shellHost = null;
  hoisted.state.storageWarning = false;
  hoisted.state.entries = null;
  hoisted.state.level = null;
  hoisted.state.paused = 0;
  hoisted.state.resumed = 0;
  hoisted.state.poiShown = [];
  hoisted.state.errorShown = 0;
  hoisted.state.autoMove = [];
  doc = mountPage();
  vi.stubGlobal('document', asDocument(doc));
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const levelState = (): string | undefined => doc.documentElement.dataset['tnLevel'];
const consoleText = (): string => vi.mocked(console.error).mock.calls.flat().join(' ');

interface MapEntryLike {
  readonly number: number;
  readonly id?: string;
  readonly built: boolean;
  readonly unlocked: boolean;
}

const entries = (): readonly MapEntryLike[] => hoisted.state.entries as readonly MapEntryLike[];
const entryFor = (id: string): MapEntryLike | undefined =>
  entries().find((entry) => entry.id === id);

const shellOption = <T>(name: string): T => (hoisted.state.shellOptions?.[name] as T);
const hudOption = <T>(name: string): T => (hoisted.state.hudOptions?.[name] as T);

describe('a cold load opens the front door', () => {
  it('mounts the shell into #ui and starts it on the title screen', async () => {
    await boot('');

    expect(hoisted.state.shellHost, 'the shell belongs in the #ui layer').toBe(
      doc.getElementById('ui'),
    );
    expect(hoisted.state.calls).toContain('shell.start');
    expect(levelState(), 'no level was asked for, so there is no level state').toBeUndefined();
  });

  it('mounts no HUD and no modal until a level has the page', async () => {
    await boot('');

    expect(hoisted.state.hudOptions, 'a page with no level was given a level HUD').toBeNull();
    expect(hoisted.state.modalHosts).toEqual({});
  });

  it('draws no "there is no level to play yet" caption over a build that has two', async () => {
    await boot('');

    /* `app/ui/build-status.ts` is slice 0's sentence and it was true of a page
       with nothing to press. It is not mounted any more, and it must not come
       back: the title screen is what tells a visitor what this build is. */
    expect(doc.getElementById('tn-build-status')).toBeNull();
  });
});

describe('the map is handed data, and the data is computed here', () => {
  it('gives the shell ten entries, in the config order', async () => {
    await boot('');

    expect(entries()).toHaveLength(10);
    expect(entries().map((entry) => entry.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('asks the catalogue what is built and the domain what is unlocked', async () => {
    await boot('');

    /* Ottawa: a document exists and `unlockRules.initialLevels` opens it. */
    expect(entryFor('ottawa')).toMatchObject({ built: true, unlocked: true });
    /* Québec City: a document exists and no stamp has opened it yet. Built and
       locked is the pair that proves the two sources are read separately —
       one answer would have made this card agree with Ottawa or with Halifax. */
    expect(entryFor('quebec-city')).toMatchObject({ built: true, unlocked: false });
    /* Halifax: `unlockRules.order` names it and no document exists. */
    expect(entryFor('halifax')).toMatchObject({ built: false, unlocked: false });
  });

  it('follows the catalogue rather than a list written into the code', async () => {
    hoisted.state.built = [];
    await boot('');

    expect(entries()).toHaveLength(10);
    expect(entries().every((entry) => !entry.built)).toBe(true);
  });

  it('carries the config’s stamp cost, so a locked card can say what opens it', async () => {
    await boot('');
    expect(shellOption<number>('stampsToUnlock')).toBeGreaterThanOrEqual(1);
  });

  it('raises the storage warning when this browser is not saving', async () => {
    /* `node` has no `localStorage`, which is the same state as a browser in
       private mode: `TN-SAVE-05` wants a warning and a game that still plays. */
    await boot('');
    expect(hoisted.state.storageWarning).toBe(true);
  });
});

describe('the settings a level has to obey', () => {
  it('tells the renderer about auto-move at boot, from the save', async () => {
    await boot('');

    /*
     * The wire ADR-0008 is about. `app/ui/settings-screen.ts` has offered this
     * toggle and `GameRenderer.setAutoMove` has existed with **no caller**:
     * a port with an implementation nobody composes looks consumed to a gate
     * that reads import edges, and is dead to a player who needs it.
     */
    expect(hoisted.state.autoMove, 'nothing ever told the renderer about auto-move').not.toEqual(
      [],
    );
  });

  it('follows the toggle while the game is running', async () => {
    await boot('');
    hoisted.state.autoMove = [];

    const store = shellOption<{ set: (key: string, value: unknown) => void }>('store');
    store.set('autoMove', true);

    expect(hoisted.state.autoMove, 'turning auto-move on did not reach the scene').toEqual([true]);
  });
});

describe('opening a level', () => {
  it('detaches the shell before the HUD exists, so the page never has two <main>', async () => {
    await boot('');
    shellOption<(id: string) => void>('onPlayLevel')('ottawa');
    await flush();

    const enter = hoisted.state.calls.indexOf('shell.enterLevel:ottawa');
    const hud = hoisted.state.calls.indexOf('createHud');
    expect(enter, 'the shell was never told a level had the page').toBeGreaterThanOrEqual(0);
    expect(hud, 'no HUD was created').toBeGreaterThanOrEqual(0);
    expect(enter, 'createHud ran before shell.enterLevel: two landmarks on one page').toBeLessThan(
      hud,
    );
  });

  it('puts focus in the level, so it is not left on a control that has gone', async () => {
    await boot('');
    shellOption<(id: string) => void>('onPlayLevel')('ottawa');
    await flush();

    expect(hoisted.state.calls).toContain('hud.focus');
  });

  it('refuses a request for a level this build cannot open, and stays on the map', async () => {
    await boot('');
    shellOption<(id: string) => void>('onPlayLevel')('halifax');
    await flush();

    expect(hoisted.state.loadCalls, 'a locked, unbuilt level was opened').toEqual([]);
    expect(hoisted.state.calls).not.toContain('createHud');
    expect(consoleText()).toContain('halifax');
  });

  it('reaches "ready" when the level loads', async () => {
    await boot('');
    shellOption<(id: string) => void>('onPlayLevel')('ottawa');
    await flush();

    expect(hoisted.state.loadCalls).toEqual(['ottawa']);
    expect(levelState()).toBe('ready');
  });
});

describe('the ?level= deep link still works, and now leads back to the map', () => {
  it('goes straight into the level, without the title screen', async () => {
    await boot('?level=ottawa');

    expect(hoisted.state.calls).not.toContain('shell.start');
    expect(hoisted.state.calls).toContain('shell.enterLevel:ottawa');
    expect(hoisted.state.loadCalls).toEqual(['ottawa']);
    expect(levelState()).toBe('ready');
  });

  it('treats an empty ?level= as no level at all', async () => {
    await boot('?level=');

    expect(hoisted.state.loadCalls).toEqual([]);
    expect(hoisted.state.calls).toContain('shell.start');
  });

  it('is "failed" when the level does not arrive, with the reason on the console', async () => {
    hoisted.state.loadResult = {
      ok: false,
      error: { kind: 'not-found', code: 'content.level.missing', message: 'no such level.' },
    };
    await boot('?level=atlantis');

    expect(levelState()).toBe('failed');
    expect(hoisted.state.errorShown, 'no error card was shown').toBe(1);
    /*
     * The id is on the console and NOT in the announcement. A level id is
     * developer vocabulary and this file may not author player-facing copy
     * (ADR-0010), so the failure goes on the bus and `app/ui` says what a player
     * hears — `level.error.title`, from the copy table, in their language.
     */
    expect(consoleText()).toContain('atlantis');
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
    /* The settings screen is opened from the level's menu, so it is built on
       demand rather than at boot; opening it is what puts it on the page. */
    hudOption<() => void>('onOpenSettings')();

    /* A `dialog` is not a landmark. A modal mounted beside `<main>` puts its
       content outside every landmark, and axe's `region` rule is right to
       complain — the fix is the page, not the rule. */
    for (const [what, host] of Object.entries(hoisted.state.modalHosts)) {
      expect((host as { id?: string }).id, `${what} was mounted outside <main>`).toBe('tn-main');
    }
    expect(Object.keys(hoisted.state.modalHosts).sort()).toEqual([
      'level-error',
      'poi-card',
      'settings',
    ]);
  });
});

describe('leaving a level', () => {
  it('takes the HUD’s landmark away and puts the canvas back where it was', async () => {
    await boot('?level=ottawa');
    hudOption<() => void>('onLeaveLevel')();
    await flush();

    expect(hoisted.state.hudDestroyed, 'the HUD outlived the level').toBe(1);
    expect(
      hoisted.state.mainRemoved,
      'the HUD’s <main> was left on the page behind the map, which is a second landmark',
    ).toBe(1);
    /* Back under `body`, before `#ui`, exactly where `index.html` put it — not
       appended, which would change its paint order against the DOM layer. */
    expect(doc.body.children.map((child) => child.id)).toEqual(['game', 'ui']);
  });

  it('hands the page back to the shell and clears the level state', async () => {
    await boot('?level=ottawa');
    hudOption<() => void>('onLeaveLevel')();
    await flush();

    expect(hoisted.state.calls).toContain('shell.leaveLevel');
    expect(levelState(), 'the page still claims a level is open').toBeUndefined();
  });

  it('re-reads the map, so a stamp earned in the level opens the next card', async () => {
    await boot('?level=ottawa');
    hoisted.state.entries = null;
    hudOption<() => void>('onLeaveLevel')();
    await flush();

    expect(entries(), 'the map was not redrawn on the way out').toHaveLength(10);
  });
});
