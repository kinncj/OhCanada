import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Boot ordering: the live region goes up before anything can fail.
 *
 * `app/bootstrap/main.ts` says so in a comment, and a comment is not a test. The
 * live region is the only channel to a screen reader (the canvas is
 * `aria-hidden` by contract), so a boot failure that is announced *before* the
 * region is mounted falls into `announce`'s auto-mount escape hatch and attaches
 * the region to `document.body` instead of `#ui`. That still speaks today, but
 * it puts the one AT channel outside the DOM layer that owns it, and it makes
 * the ordering incidental rather than stated. These tests state it.
 *
 * The suite runs in the `node` environment (no jsdom in the tree), so the six
 * DOM calls the boot path makes are supplied by the fake below. It is
 * deliberately tiny: if `main.ts` starts needing more of the DOM than this, the
 * boot path has grown something that belongs in `app/ui`.
 */

const hoisted = vi.hoisted(() => {
  interface Observation {
    /** id of the element the live region was attached to, `null` if absent. */
    regionHostAtParse: string | null;
    regionHostAtRendererBuild: string | null;
    parseCalls: number;
  }

  const observed: Observation = {
    regionHostAtParse: null,
    regionHostAtRendererBuild: null,
    parseCalls: 0,
  };

  /** Where the live region lives *right now*, read straight off the stub document. */
  const regionHost = (): string | null => {
    const doc = (globalThis as { document?: Document }).document;
    const region = doc?.getElementById('tn-live-region') ?? null;
    if (region === null) return null;
    return region.parentElement?.id ?? '(detached)';
  };

  const parseResult: { current: unknown } = { current: null };

  return { observed, regionHost, parseResult };
});

vi.mock('@adapters/phaser', () => ({
  parseBootConfig: (): unknown => {
    hoisted.observed.parseCalls += 1;
    hoisted.observed.regionHostAtParse = hoisted.regionHost();
    return hoisted.parseResult.current;
  },
  GameRenderer: class {
    readonly ready = Promise.resolve();
    constructor() {
      hoisted.observed.regionHostAtRendererBuild = hoisted.regionHost();
    }
    cssVariables(): Record<string, string> {
      return {};
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

  /** Depth-first, document order — the only lookup `getElementById` needs. */
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

/** The page `index.html` gives the composition root. */
function mountPage(): FakeDocument {
  const doc = new FakeDocument();
  const game = doc.createElement('div');
  game.id = 'game';
  const ui = doc.createElement('div');
  ui.id = 'ui';
  doc.body.append(game, ui);
  return doc;
}

const OK_CONFIG = {
  ok: true,
  value: {
    title: 'TrueNorth',
    version: '0.1.0',
    defaultLocale: 'en',
    palette: { sky: '#8ecae6', ground: '#2a9d8f', horizon: '#219ebc' },
  },
};

const FAILED_CONFIG = {
  ok: false,
  error: { kind: 'invalid', code: 'config.title.missing', message: 'title is required.' },
};

let doc: FakeDocument;
let errors: string[];

/** Import the composition root fresh; `main()` runs at module scope. */
async function boot(parseResult: unknown): Promise<void> {
  hoisted.parseResult.current = parseResult;
  vi.resetModules();
  await import('../../../app/bootstrap/main');
}

beforeEach(() => {
  vi.useFakeTimers();
  errors = [];
  hoisted.observed.regionHostAtParse = null;
  hoisted.observed.regionHostAtRendererBuild = null;
  hoisted.observed.parseCalls = 0;
  doc = mountPage();
  vi.stubGlobal('document', asDocument(doc));
  vi.stubGlobal('window', {
    innerWidth: 390,
    innerHeight: 844,
    addEventListener: (): void => undefined,
  });
  vi.spyOn(console, 'error').mockImplementation((message: unknown) => {
    errors.push(String(message));
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const liveRegions = (): FakeElement[] =>
  [...doc.documentElement.descendants()].filter((el) => el.id === 'tn-live-region');

describe('bootstrap live-region ordering', () => {
  it('mounts the live region into #ui before the config is parsed', async () => {
    await boot(FAILED_CONFIG);

    expect(hoisted.observed.parseCalls, 'parseBootConfig was never reached').toBe(1);
    expect(
      hoisted.observed.regionHostAtParse,
      'the config was parsed before the live region existed, so a parse failure ' +
        'announces through the auto-mount escape hatch',
    ).toBe('ui');
  });

  it('keeps the failure announcement inside #ui, never on document.body', async () => {
    await boot(FAILED_CONFIG);

    const regions = liveRegions();
    expect(regions, 'expected exactly one live region').toHaveLength(1);
    expect(regions[0]?.parentElement?.id).toBe('ui');
  });

  it('speaks the failure through that region', async () => {
    await boot(FAILED_CONFIG);
    vi.runAllTimers();

    expect(liveRegions()[0]?.textContent).toContain('config.title.missing');
    expect(errors.join('\n')).toContain('config.title.missing');
  });

  it('marks the boot failed and shows a visible alert in #ui', async () => {
    await boot(FAILED_CONFIG);

    expect(doc.documentElement.dataset['tnBoot']).toBe('failed');
    const alerts = doc
      .getElementById('ui')
      ?.children.filter((el) => el.getAttribute('role') === 'alert');
    expect(alerts).toHaveLength(1);
  });

  it('mounts the live region before the renderer on the happy path too', async () => {
    await boot(OK_CONFIG);

    expect(hoisted.observed.regionHostAtRendererBuild).toBe('ui');
    expect(liveRegions()).toHaveLength(1);

    // The mocked renderer is ready immediately, so the readiness announcement
    // has to land in the same region the failure branch would have used.
    await Promise.resolve();
    vi.runAllTimers();
    expect(doc.documentElement.dataset['tnBoot']).toBe('ready');
    expect(liveRegions()[0]?.textContent).toContain('TrueNorth ready');
  });

  it('cannot mount the region when the page has no #ui, and fails loudly instead', async () => {
    doc = new FakeDocument();
    vi.stubGlobal('document', asDocument(doc));

    await boot(FAILED_CONFIG);

    // No #ui means no DOM layer at all: nothing to mount into, nothing to parse.
    expect(hoisted.observed.parseCalls).toBe(0);
    expect(doc.documentElement.dataset['tnBoot']).toBe('failed');
    expect(errors.join('\n')).toContain('#game or #ui');
  });
});
