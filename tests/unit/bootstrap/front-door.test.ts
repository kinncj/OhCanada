import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import gameConfigDocument from '@content/game.config.json';
/* Relative, not aliased: there is no `@bootstrap` alias and adding one means
   editing three configs that have to agree (tsconfig, vite, vitest). */
import { readGameRules } from '../../../app/bootstrap/game-rules';
import { unlockedLevelIds } from '@domain/entities/level';
import { text } from '@ui/copy';
import type { LevelId } from '@domain/ids';

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

/* ------------------------------------------------ the chain, read not retyped */

/**
 * Which level a cold load lands on is `content/game.config.json`'s answer and
 * not this suite's. It was Ottawa; it is Halifax; it will be somewhere else the
 * week Mi'kma'ki ships. A test that types the name has to be edited every time
 * the game grows and proves nothing more than one that reads it — so the three
 * levels this file needs are *roles*, derived from the shipped unlock rules:
 *
 *  - {@link START_LEVEL} — open before a single stamp is earned, so it is where
 *    the player lands and the only level the map will open on a cold load;
 *  - {@link EARNED_LEVEL} — the first level `order` makes them play for. The
 *    fixture catalogue below has a document for it and the rules keep it shut,
 *    which is the built-and-locked pair that proves `built` and `unlocked` come
 *    from two different sources rather than one;
 *  - {@link UNBUILT_LEVEL} — named by the rules, with no document in the
 *    catalogue. The request `onPlayLevel` has to refuse.
 *
 * Every assertion below interpolates the name, so a failure still says which
 * level it was about.
 */
const parsedRules = readGameRules(gameConfigDocument);
if (!parsedRules.ok) {
  throw new Error(`content/game.config.json did not parse: ${parsedRules.error.message}`);
}
const rules = parsedRules.value.unlockRules;

/** What `unlockRules` opens with an empty passport. */
const openAtBoot = unlockedLevelIds(rules, []);

/** Fail at import with the config change that caused it, rather than at `undefined`. */
const roleOrThrow = (id: LevelId | undefined, why: string): LevelId => {
  if (id === undefined) throw new Error(why);
  return id;
};

const START_LEVEL = roleOrThrow(
  openAtBoot[0],
  'content/game.config.json opens no level with an empty passport, so a cold load ' +
    'has nothing to play and this suite has no level to open.',
);

const EARNED_LEVEL = roleOrThrow(
  rules.order.find((id) => !openAtBoot.includes(id)),
  'every level in unlockRules.order is already in initialLevels, so no level in this ' +
    'build is earned by playing. The map would have no locked card to draw and the ' +
    'unlock chain would be untested by walking it — which is how the dead chain hid.',
);

const UNBUILT_LEVEL = roleOrThrow(
  rules.order.find((id) => id !== START_LEVEL && id !== EARNED_LEVEL),
  'unlockRules.order names fewer than three levels, so there is none left over to ' +
    'play the level this build has no document for.',
);

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
    /** Every option the error card was built or re-localised with. */
    errorTitles: string[];
    /** How many times the waiting screen was shown, and with what. */
    loadingShown: number;
    loadingText: { title: string; message: string }[];
    loadingHidden: number;
    loadingStallAfterMs: number | undefined;
    autoMove: boolean[];
  } = {
    calls: [],
    loadCalls: [],
    loadResult: { ok: true, value: undefined },
    search: '',
    /* Filled in `beforeEach` from the shipped rules: the level a cold load opens
       and the first one it makes the player earn. */
    built: [] as string[],
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
    errorTitles: [],
    loadingShown: 0,
    loadingText: [],
    loadingHidden: 0,
    loadingStallAfterMs: undefined,
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
  /*
   * Both screens record the **strings they were handed**, because that is the
   * decision this suite is about: which level's words the composition root
   * looked up. Neither screen may read a copy row itself — one row for four
   * levels is the defect `TN-WAIT-a-level-opens-or-it-does-not.md` was written
   * against — so what bootstrap passes is the whole of the fix.
   */
  createLevelError: (host: unknown, options: Record<string, unknown>): unknown => {
    hoisted.state.modalHosts['level-error'] = host;
    hoisted.state.errorTitles.push(String(options['title']));
    return {
      element: {},
      visible: false,
      show: () => {
        hoisted.state.errorShown += 1;
      },
      hide: () => undefined,
      setLocale: (_locale: unknown, title: string) => {
        hoisted.state.errorTitles.push(title);
      },
      setSingleSwitch: () => undefined,
      destroy: () => undefined,
    };
  },
  createLevelLoading: (host: unknown, options: Record<string, unknown>): unknown => {
    hoisted.state.modalHosts['level-loading'] = host;
    hoisted.state.loadingStallAfterMs = options['stallAfterMs'] as number | undefined;
    hoisted.state.loadingText.push({
      title: String(options['title']),
      message: String(options['message']),
    });
    return {
      element: {},
      visible: false,
      show: () => {
        hoisted.state.loadingShown += 1;
      },
      hide: () => {
        hoisted.state.loadingHidden += 1;
      },
      offerEscape: () => undefined,
      setLocale: (_locale: unknown, words: { title: string; message: string }) => {
        hoisted.state.loadingText.push(words);
      },
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
  hoisted.state.built = [`${START_LEVEL}`, `${EARNED_LEVEL}`];
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
  hoisted.state.errorTitles = [];
  hoisted.state.loadingShown = 0;
  hoisted.state.loadingText = [];
  hoisted.state.loadingHidden = 0;
  hoisted.state.loadingStallAfterMs = undefined;
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

    /* The level a cold load lands on: a document exists and `initialLevels`
       opens it. */
    expect(
      entryFor(`${START_LEVEL}`),
      `${START_LEVEL} is in unlockRules.initialLevels and the catalogue has it, ` +
        'so its card is the one a cold load can press',
    ).toMatchObject({ built: true, unlocked: true });
    /* The first level the chain charges a stamp for: a document exists and no
       stamp has opened it yet. Built and locked is the pair that proves the two
       sources are read separately — one answer would have made this card agree
       with the level above or with the one below. */
    expect(
      entryFor(`${EARNED_LEVEL}`),
      `${EARNED_LEVEL} is built and unlockRules makes the player earn it, so its ` +
        'card is built and locked. A card that is open here means "unlocked" was ' +
        'answered with the catalogue instead of with the unlock rules',
    ).toMatchObject({ built: true, unlocked: false });
    /* A level the rules name and this build has no document for. */
    expect(
      entryFor(`${UNBUILT_LEVEL}`),
      `unlockRules.order names ${UNBUILT_LEVEL} and the catalogue has no document ` +
        'for it, so its card is neither built nor open',
    ).toMatchObject({ built: false, unlocked: false });
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
    shellOption<(id: string) => void>('onPlayLevel')(`${START_LEVEL}`);
    await flush();

    const enter = hoisted.state.calls.indexOf(`shell.enterLevel:${START_LEVEL}`);
    const hud = hoisted.state.calls.indexOf('createHud');
    expect(
      enter,
      `the shell was never told ${START_LEVEL} had the page`,
    ).toBeGreaterThanOrEqual(0);
    expect(hud, 'no HUD was created').toBeGreaterThanOrEqual(0);
    expect(enter, 'createHud ran before shell.enterLevel: two landmarks on one page').toBeLessThan(
      hud,
    );
  });

  it('puts focus in the level, so it is not left on a control that has gone', async () => {
    await boot('');
    shellOption<(id: string) => void>('onPlayLevel')(`${START_LEVEL}`);
    await flush();

    expect(hoisted.state.calls).toContain('hud.focus');
  });

  it('refuses a request for a level this build cannot open, and stays on the map', async () => {
    await boot('');
    shellOption<(id: string) => void>('onPlayLevel')(`${UNBUILT_LEVEL}`);
    await flush();

    expect(
      hoisted.state.loadCalls,
      `${UNBUILT_LEVEL} is locked and this build has no document for it, and it was opened`,
    ).toEqual([]);
    expect(hoisted.state.calls).not.toContain('createHud');
    expect(consoleText()).toContain(`${UNBUILT_LEVEL}`);
  });

  it('reaches "ready" when the level loads', async () => {
    await boot('');
    shellOption<(id: string) => void>('onPlayLevel')(`${START_LEVEL}`);
    await flush();

    expect(hoisted.state.loadCalls).toEqual([`${START_LEVEL}`]);
    expect(levelState()).toBe('ready');
  });

  it('shows the waiting screen, in this level\u2019s words, and takes it away when the level opens', async () => {
    /*
     * `OQ-WAIT-1`: `createLevelLoading` had **no caller under `app/`**. It was
     * built, scanned by axe and covered by its own suite, and no player had ever
     * seen a waiting sentence — a level opened straight into a canvas or into
     * the error card, which left `TN-LEVEL-01`'s "text, not only a spinner"
     * unmet on the shipped page while passing in the harness.
     *
     * So this asserts the wire, and the words: the sentence is
     * `level.<id>.loading` for the level being opened, not one row four levels
     * shared, and the screen is gone once the level is playable rather than left
     * on the page behind it.
     */
    await boot('');
    shellOption<(id: string) => void>('onPlayLevel')(`${START_LEVEL}`);
    await flush();

    expect(hoisted.state.loadingShown, 'no waiting screen was ever shown').toBe(1);
    expect(hoisted.state.loadingText[0]).toEqual({
      title: text('en', `level.${START_LEVEL}.title` as Parameters<typeof text>[1]),
      message: text('en', `level.${START_LEVEL}.loading` as Parameters<typeof text>[1]),
    });
    expect(hoisted.state.loadingHidden, 'the waiting screen outlived the load').toBe(1);
  });

  it('reads the waiting sentence into the live region, once', async () => {
    /*
     * `TN-WAIT-05` and `TN-HALIFAX-03`: "when a level starts loading,
     * #tn-live-region reads that level's waiting sentence", and it is not
     * repeated while the load continues. The canvas is `aria-hidden`, so a
     * screen swapped in silently is a screen a screen-reader user never learns
     * about — mounting the waiting screen without this would have made it
     * visible to everybody except the players it matters most to.
     */
    await boot('');
    shellOption<(id: string) => void>('onPlayLevel')(`${START_LEVEL}`);
    await flush();
    /* The region clears first and writes on a later task, so a screen reader
       hears a change rather than an insertion (`app/ui/live-region.ts`). */
    await vi.advanceTimersByTimeAsync(1_000);

    expect(doc.getElementById('tn-live-region')?.textContent).toContain(
      text('en', `level.${START_LEVEL}.loading` as Parameters<typeof text>[1]),
    );
  });

  it('times the way out from the config\u2019s time-to-play budget, doubled', async () => {
    /* `TN-LEVEL-02` and `TN-WAIT-04`: the escape appears after twice the budget
       CI measures against, so the two numbers cannot drift apart. */
    await boot('');
    shellOption<(id: string) => void>('onPlayLevel')(`${START_LEVEL}`);
    await flush();

    expect(hoisted.state.loadingStallAfterMs).toBe(parsedRules.value.timeToPlayMs * 2);
  });

  it('hands both level screens the new language\u2019s strings for the same level', async () => {
    /* `TN-WAIT-06` and `TN-HALIFAX-04`: changing language without leaving the
       level. Neither screen can look its row up — the row is keyed on a level id
       neither of them knows — so the composition root re-resolves both. */
    await boot('');
    shellOption<(id: string) => void>('onPlayLevel')(`${START_LEVEL}`);
    await flush();

    const store = shellOption<{ set: (key: string, value: unknown) => void }>('store');
    store.set('locale', 'fr');

    expect(hoisted.state.loadingText.at(-1)).toEqual({
      title: text('fr', `level.${START_LEVEL}.title` as Parameters<typeof text>[1]),
      message: text('fr', `level.${START_LEVEL}.loading` as Parameters<typeof text>[1]),
    });
    expect(hoisted.state.errorTitles.at(-1)).toBe(
      text('fr', `level.${START_LEVEL}.error.title` as Parameters<typeof text>[1]),
    );
  });
});

describe('the ?level= deep link still works, and now leads back to the map', () => {
  it('goes straight into the level, without the title screen', async () => {
    /*
     * Deep-linked to the level the map keeps **shut**, which is the claim
     * `OQ-FLOW-3` makes: the parameter bypasses the map, so it answers for a
     * level `onPlayLevel` would refuse. Using the level a cold load already
     * opens would have proved only that a link to the front door works.
     */
    await boot(`?level=${EARNED_LEVEL}`);

    expect(hoisted.state.calls).not.toContain('shell.start');
    expect(hoisted.state.calls).toContain(`shell.enterLevel:${EARNED_LEVEL}`);
    expect(
      hoisted.state.loadCalls,
      `?level=${EARNED_LEVEL} is a deep link into a level the map has not opened yet, ` +
        'and it is meant to open anyway',
    ).toEqual([`${EARNED_LEVEL}`]);
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
    await boot(`?level=${START_LEVEL}`);

    expect(levelState()).toBe('failed');
    expect(hoisted.state.errorShown, 'no error card was shown').toBe(1);
    /* The waiting screen went before the card arrived: two dialogs over one
       level is a state no story describes (`TN-WAIT-02`, "level-loading is
       gone"). */
    expect(hoisted.state.loadingHidden).toBeGreaterThanOrEqual(1);
    /*
     * The id is on the console and NOT in the announcement. A level id is
     * developer vocabulary and this file may not author player-facing copy
     * (ADR-0010), so the failure goes on the bus and `app/ui` says what a player
     * hears — `level.<id>.error.title`, from the copy table, in their language.
     */
    expect(consoleText()).toContain(`${START_LEVEL}`);
    expect(
      hoisted.state.errorTitles[0],
      'the error card was built with a title that is not this level\u2019s',
    ).toBe(text('en', `level.${START_LEVEL}.error.title` as Parameters<typeof text>[1]));
  });

  it('takes a deep link to a level this build has no words for to the map', async () => {
    /*
     * `TN-FLOW-05`: "a deep link to a level that does not exist … no Try again is
     * offered for something that cannot succeed … the player is taken to, or
     * offered, the level select … nothing on the screen blames the player".
     *
     * This route used to open the level anyway and show the error card, whose
     * title was one row called `level.error.title` reading "We could not load
     * Ottawa." — so a mistyped address was answered by naming a place chosen by
     * which level had a story first. There is no title to draw for a level no
     * document declares, and inventing one would be `app/bootstrap` authoring
     * copy (ADR-0010). So the player is taken to a screen they can act on, and
     * the id goes where developer vocabulary goes.
     */
    await boot('?level=atlantis');

    expect(hoisted.state.loadCalls, 'a level with no document was opened').toEqual([]);
    expect(hoisted.state.calls).not.toContain('createHud');
    expect(hoisted.state.errorShown, 'a Try again was offered for something that cannot succeed').toBe(
      0,
    );
    expect(levelState(), 'the page claims a level is open').toBeUndefined();
    expect(consoleText()).toContain('atlantis');
  });
});

describe('the page has one <main>, and every modal is inside it (TN-HUD-07)', () => {
  it('hands the canvas host to the HUD, so <main> holds what the page is for', async () => {
    await boot(`?level=${START_LEVEL}`);

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
    await boot(`?level=${START_LEVEL}`);
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
      'level-loading',
      'poi-card',
      'settings',
    ]);
  });
});

describe('leaving a level', () => {
  it('takes the HUD’s landmark away and puts the canvas back where it was', async () => {
    await boot(`?level=${START_LEVEL}`);
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
    await boot(`?level=${START_LEVEL}`);
    hudOption<() => void>('onLeaveLevel')();
    await flush();

    expect(hoisted.state.calls).toContain('shell.leaveLevel');
    expect(levelState(), 'the page still claims a level is open').toBeUndefined();
  });

  it('re-reads the map, so a stamp earned in the level opens the next card', async () => {
    await boot(`?level=${START_LEVEL}`);
    hoisted.state.entries = null;
    hudOption<() => void>('onLeaveLevel')();
    await flush();

    expect(entries(), 'the map was not redrawn on the way out').toHaveLength(10);
  });
});
