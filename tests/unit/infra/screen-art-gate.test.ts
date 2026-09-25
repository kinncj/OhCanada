/**
 * The screen-art sidecar gate in `make validate-content`.
 *
 * `assets/src/svg/screens/map-canada.anchors.json` tells the level select where
 * each stop is on the map, and UI code will place a marker there without looking
 * at the drawing. So the sidecar is schema-checked
 * (`content/schemas/map-anchors.schema.json`) and then cross-checked by
 * scripts/lib/screen-art.mjs against what the schema cannot see: the drawing
 * beside it and the places `content/game.config.json#/journey` names. The
 * anchor rule is keyed on the journey, not on content/levels/ (ADR-0069 §6's
 * boundary defect), so an anchor and its level document land in their owners'
 * own commits. And since the 2026-09-25 amendment, the journey slot and its
 * anchor land apart too, in either order: an anchor may precede its slot when a
 * level document or story declares the place, and a slot may await its anchor
 * in a commit but not under `--release`, which `make build` runs.
 *
 * Every case drives the real CLI over a scratch tree built from the REAL map,
 * sidecar, schemas, game config and level documents, with one thing broken. The first case is
 * the unbroken tree, so a mutation that fails is failing for its own reason and
 * not because the fixture never passed.
 */

import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../../../scripts/validate-content.mjs', import.meta.url));
const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const SCREENS = join(REPO, 'assets', 'src', 'svg', 'screens');
const WORK = mkdtempSync(join(tmpdir(), 'screen-art-gate-'));

afterAll(() => {
  rmSync(WORK, { recursive: true, force: true });
});

interface Point {
  x: number;
  y: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Inset {
  [property: string]: unknown;
  frame: Rect & { radius: number };
  window: Rect;
  locator: Rect;
  anchors: Record<string, Point>;
  magnification: number;
}

interface Sidecar {
  [property: string]: unknown;
  $schema?: string;
  svg: string;
  viewBox: number[];
  anchors: Record<string, Point>;
  insets?: Inset[];
  projection: Record<string, unknown>;
  provincesAndTerritories?: string[];
}

interface Run {
  readonly status: number;
  readonly stdout: string;
  readonly output: string;
}

const REAL = JSON.parse(readFileSync(join(SCREENS, 'map-canada.anchors.json'), 'utf8')) as Sidecar;
const DRAWING = readFileSync(join(SCREENS, 'map-canada.svg'), 'utf8');
/** The stylesheet the gate reads the pin's size from (ADR-0069 §3.3). */
const STYLESHEET = readFileSync(join(REPO, 'app', 'ui', 'screen-styles.ts'), 'utf8');
const PIN_RULE = '.tn-map .tn-map__stop .tn-journey__pin {';

const LEVEL_IDS = readdirSync(join(REPO, 'content', 'levels'))
  .filter((name) => name.endsWith('.json'))
  .map((name) => (JSON.parse(readFileSync(join(REPO, 'content', 'levels', name), 'utf8')) as { id: string }).id)
  .sort();

interface GameConfig {
  [property: string]: unknown;
  journey: (string | null)[];
}

const CONFIG = JSON.parse(readFileSync(join(REPO, 'content', 'game.config.json'), 'utf8')) as GameConfig;
const PLACES = [...new Set(CONFIG.journey.filter((slot): slot is string => slot !== null))].sort();

const FIRST_LEVEL = PLACES[0] ?? '';
const INSET_STOP = Object.keys(REAL.insets?.[0]?.anchors ?? {}).sort()[0] ?? '';

const credit = (path: string): Record<string, string> => ({
  path,
  kind: 'shipped',
  title: `Screen art fixture ${path}`,
  author: 'TrueNorth contributors',
  licence: 'CC-BY-4.0',
  source: 'https://github.com/kinncj/OhCanada',
});

let caseId = 0;

/**
 * A scratch root holding the real schemas, level documents, palette, map and
 * sidecar - with `mutate` applied to the sidecar - and the gate's verdict on it.
 */
interface RunOptions {
  /** Level ids whose documents the scratch tree leaves out. */
  readonly withoutLevels?: readonly string[];
  /** Applied to a copy of the real game config; `null` leaves the config out. */
  readonly config?: ((config: GameConfig) => void) | null;
  /** Replaces app/ui/screen-styles.ts in the scratch tree; `null` leaves it out. */
  readonly stylesheet?: string | null;
  /** Level ids given a story, docs/stories/TN-LEVEL-<id>.md, in the scratch tree. */
  readonly stories?: readonly string[];
  /** Runs the gate as `make build` does, `--release`. */
  readonly release?: boolean;
}

function run(mutate: (doc: Sidecar) => void, options: RunOptions = {}): Run {
  caseId += 1;
  const root = join(WORK, `case-${caseId}`);
  const screens = join(root, 'assets', 'src', 'svg', 'screens');
  mkdirSync(join(root, 'content'), { recursive: true });
  mkdirSync(join(root, 'assets', 'style'), { recursive: true });
  mkdirSync(screens, { recursive: true });

  cpSync(join(REPO, 'content', 'schemas'), join(root, 'content', 'schemas'), { recursive: true });
  cpSync(join(REPO, 'content', 'levels'), join(root, 'content', 'levels'), { recursive: true });
  for (const id of options.withoutLevels ?? []) {
    rmSync(join(root, 'content', 'levels', `${id}.json`));
  }
  if (options.config !== null) {
    const config = structuredClone(CONFIG);
    options.config?.(config);
    writeFileSync(join(root, 'content', 'game.config.json'), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  }
  cpSync(join(REPO, 'assets', 'style', 'palette.json'), join(root, 'assets', 'style', 'palette.json'));
  if (options.stylesheet !== null) {
    mkdirSync(join(root, 'app', 'ui'), { recursive: true });
    /* validate-content's locale floor reads app/ui/copy.ts whenever app/ui/ exists. */
    cpSync(join(REPO, 'app', 'ui', 'copy.ts'), join(root, 'app', 'ui', 'copy.ts'));
    writeFileSync(join(root, 'app', 'ui', 'screen-styles.ts'), options.stylesheet ?? STYLESHEET, 'utf8');
  }

  if (options.stories !== undefined) {
    mkdirSync(join(root, 'docs', 'stories'), { recursive: true });
    for (const id of options.stories) {
      writeFileSync(join(root, 'docs', 'stories', `TN-LEVEL-${id}.md`), `# ${id}\n`, 'utf8');
    }
  }

  writeFileSync(join(screens, 'map-canada.svg'), DRAWING, 'utf8');
  const doc = structuredClone(REAL);
  mutate(doc);
  writeFileSync(join(screens, 'map-canada.anchors.json'), `${JSON.stringify(doc, null, 2)}\n`, 'utf8');

  writeFileSync(
    join(root, 'assets', 'credits.json'),
    `${JSON.stringify(
      {
        $schema: '../content/schemas/credits.schema.json',
        assets: [credit('src/svg/screens/map-canada.svg'), credit('src/svg/screens/map-canada.anchors.json')],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const args = [SCRIPT, '--root', root, ...(options.release === true ? ['--release'] : [])];
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const stdout = result.stdout ?? '';
  return { status: result.status ?? -1, stdout, output: `${stdout}${result.stderr ?? ''}` };
}

const expectRefused = (result: Run, message: string): void => {
  expect(result.status, result.output).toBe(1);
  expect(result.output).toContain(message);
  expect(result.stdout).not.toContain('validate-content: OK');
};

describe('the screen-art sidecar gate', () => {
  it('has a real map, sidecar and levels to build its cases from', () => {
    expect(LEVEL_IDS.length).toBeGreaterThan(0);
    expect(PLACES.length).toBeGreaterThan(0);
    expect(Object.keys(REAL.anchors).length).toBeGreaterThan(0);
    expect(INSET_STOP).not.toBe('');
  });

  it('passes the committed sidecar, and says what it checked', () => {
    const result = run(() => undefined);
    expect(result.status, result.output).toBe(0);
    expect(result.stdout).toContain('1 screen-art sidecar(s) cross-checked');
    expect(result.stdout).toContain(`against ${PLACES.length} journey place(s)`);
  });

  it('fails under --release when a place the journey names has no anchor', () => {
    expectRefused(
      run(
        (doc) => {
          delete doc.anchors[FIRST_LEVEL];
        },
        { release: true },
      ),
      `no anchor for "${FIRST_LEVEL}", which game.config.json#/journey names`,
    );
  });

  it('passes the committed sidecar under --release, and says every place is anchored', () => {
    const result = run(() => undefined, { release: true });
    expect(result.status, result.output).toBe(0);
    expect(result.stdout).toContain('every journey place anchored (--release)');
  });

  it('wires --release into make build, so the rule a commit may relax is held on every build', () => {
    const makefile = readFileSync(join(REPO, 'Makefile'), 'utf8');
    const build = /^build:.*\n((?:\t.*\n)+)/m.exec(makefile);
    expect(build?.[1]).toBeDefined();
    const recipe = build?.[1] ?? '';
    expect(recipe).toContain('npm run validate-content -- --release');
    expect(recipe.indexOf('--release')).toBeLessThan(recipe.indexOf('npm run build'));
  });

  it('fails on an anchor for a place the journey does not name', () => {
    expectRefused(
      run((doc) => {
        doc.anchors['not-a-level'] = { x: 10, y: 10 };
      }),
      'anchors."not-a-level" names no place in game.config.json#/journey',
    );
  });

  it('passes an anchor whose place left the journey while its level document declares it, and says so', () => {
    const result = run(() => undefined, {
      config: (config) => {
        config.journey = config.journey.map((slot) => (slot === FIRST_LEVEL ? null : slot));
      },
    });
    expect(result.status, result.output).toBe(0);
    expect(result.stdout).toContain(
      `1 anchor(s) ahead of the journey (${FIRST_LEVEL}, declared by content/levels/${FIRST_LEVEL}.json)`,
    );
  });

  /*
   * ADR-0069 §6's boundary defect, closed. Keyed on content/levels/, the rule
   * refused an anchor with no level document and a level document with no
   * anchor, so the two could only land together, by two owners. Keyed on the
   * journey, art's anchor passes before content's level document exists, and
   * the level document then lands on its own commit without touching the map.
   */
  it('passes an anchor whose level document has not landed yet, so art and content land apart', () => {
    const result = run(() => undefined, { withoutLevels: [FIRST_LEVEL] });
    expect(result.status, result.output).toBe(0);
    expect(result.stdout).toContain(`against ${PLACES.length} journey place(s)`);
  });

  it('takes no anchor for a journey slot with no id', () => {
    const result = run(
      (doc) => {
        delete doc.anchors[FIRST_LEVEL];
      },
      {
        withoutLevels: [FIRST_LEVEL],
        config: (config) => {
          config.journey = config.journey.map((slot) => (slot === FIRST_LEVEL ? null : slot));
        },
      },
    );
    expect(result.status, result.output).toBe(0);
    expect(result.stdout).toContain(`against ${PLACES.length - 1} journey place(s)`);
  });

  /*
   * ADR-0069 §6's boundary defect, the second half (plan K-0.7). Keyed on the
   * journey alone, the defect moved into the config: a new journey id
   * (content's) and its anchor (art's) each failed without the other, so they
   * still had to share a commit. Kingston has since landed with both, so each
   * case rebuilds one of the two halves it landed in by taking the other away:
   * art first is the tree without Kingston's journey slot and level document,
   * content first is the tree without its anchors. Each failed on the pre-fix
   * gate.
   */
  describe('a journey place and its anchor land apart, in either order', () => {
    const PLACE = 'kingston';
    const corridor = (doc: Sidecar): Inset => {
      const inset = doc.insets?.find((candidate) => Object.hasOwn(candidate.anchors, 'ottawa'));
      if (inset === undefined) throw new Error('the committed sidecar has no inset anchoring ottawa');
      return inset;
    };
    const unanchorIt = (doc: Sidecar): void => {
      delete doc.anchors[PLACE];
      delete corridor(doc).anchors[PLACE];
    };
    const unslotIt = (config: GameConfig): void => {
      config.journey = config.journey.filter((slot) => slot !== PLACE);
    };

    it('has the place landed with a slot, a level document and both anchors', () => {
      expect(PLACES).toContain(PLACE);
      expect(LEVEL_IDS).toContain(PLACE);
      expect(Object.keys(REAL.anchors)).toContain(PLACE);
    });

    it('art first: passes an anchor ahead of its journey slot when a story declares the place, and reports it', () => {
      const result = run(() => undefined, { stories: [PLACE], config: unslotIt, withoutLevels: [PLACE] });
      expect(result.status, result.output).toBe(0);
      expect(result.stdout).toContain(
        `1 anchor(s) ahead of the journey (${PLACE}, declared by docs/stories/TN-LEVEL-${PLACE}.md)`,
      );
      expect(result.stdout).toContain(`against ${PLACES.length - 1} journey place(s)`);
    });

    it('art first, and still under --release: an anchor ahead of its slot is never drawn', () => {
      const result = run(() => undefined, {
        stories: [PLACE],
        config: unslotIt,
        withoutLevels: [PLACE],
        release: true,
      });
      expect(result.status, result.output).toBe(0);
      expect(result.stdout).toContain('every journey place anchored (--release)');
    });

    it('refuses an anchor ahead of the journey that no story or level document declares: a typo', () => {
      expectRefused(
        run((doc) => {
          doc.anchors['kingstn'] = doc.anchors[PLACE] ?? { x: 0, y: 0 };
        }, { stories: [PLACE] }),
        'anchors."kingstn" names no place in game.config.json#/journey',
      );
    });

    it('content first: passes a journey slot awaiting its anchor, and says make build refuses it', () => {
      const result = run(unanchorIt);
      expect(result.status, result.output).toBe(0);
      expect(result.stdout).toContain(`1 journey place(s) AWAITING an anchor (${PLACE})`);
      expect(result.stdout).toContain('refused by make build');
      expect(result.stdout).toContain(`against ${PLACES.length} journey place(s)`);
    });

    it('content first: the same tree fails under --release, so it cannot be built or deployed', () => {
      expectRefused(
        run(unanchorIt, { release: true }),
        `no anchor for "${PLACE}", which game.config.json#/journey names`,
      );
    });

    it('both landed, in either order: passes under --release with nothing ahead and nothing awaiting', () => {
      const result = run(() => undefined, { release: true });
      expect(result.status, result.output).toBe(0);
      expect(result.stdout).toContain('every journey place anchored (--release)');
      expect(result.stdout).not.toContain('ahead of the journey');
      expect(result.stdout).toContain(`against ${PLACES.length} journey place(s)`);
    });
  });

  it('fails on an anchor outside the viewBox', () => {
    expectRefused(
      run((doc) => {
        doc.anchors[FIRST_LEVEL] = { x: 100_000, y: 10 };
      }),
      `anchors."${FIRST_LEVEL}" at (100000, 10) lies outside the viewBox`,
    );
  });

  it('fails when the sidecar names a drawing other than the one beside it', () => {
    expectRefused(
      run((doc) => {
        doc.svg = 'map-quebec.svg';
      }),
      '"svg" is "map-quebec.svg", but the sidecar sits beside map-canada.svg',
    );
  });

  it("fails when its viewBox is not the drawing's", () => {
    expectRefused(
      run((doc) => {
        doc.viewBox = [0, 0, 1080, 601];
      }),
      '"viewBox" is [0, 0, 1080, 601], but map-canada.svg declares viewBox',
    );
  });

  it('fails on a region id the drawing does not carry', () => {
    expectRefused(
      run((doc) => {
        doc.provincesAndTerritories = [...(doc.provincesAndTerritories ?? []), 'CA-ZZ'];
      }),
      'has no element with id="CA-ZZ"',
    );
  });

  it('fails when an inset stop is not inside the locator box on the main map', () => {
    const result = run((doc) => {
      const locator = doc.insets?.[0]?.locator;
      if (locator !== undefined) doc.anchors[INSET_STOP] = { x: locator.x - 10, y: locator.y };
    });
    expectRefused(result, 'is outside insets[0].locator');
    expect(result.output).toContain(`anchors."${INSET_STOP}" at (`);
  });

  it('fails when an inset stop is not inside the inset window', () => {
    expectRefused(
      run((doc) => {
        const inset = doc.insets?.[0];
        if (inset !== undefined) inset.anchors[INSET_STOP] = { x: 0, y: 0 };
      }),
      `insets[0].anchors."${INSET_STOP}" at (0, 0) lies outside insets[0].window`,
    );
  });

  it('fails on an unknown property, through the schema', () => {
    expectRefused(
      run((doc) => {
        doc.labels = {};
      }),
      'must NOT have additional properties ("labels")',
    );
  });

  it('fails on a sidecar that declares no schema', () => {
    expectRefused(
      run((doc) => {
        delete doc.$schema;
      }),
      'missing "$schema"',
    );
  });

  it('fails on a sidecar that declares a schema the cross-checks were not written for', () => {
    expectRefused(
      run((doc) => {
        doc.$schema = '../../../../content/schemas/common.schema.json';
      }),
      'a "*.anchors.json" sidecar must declare content/schemas/map-anchors.schema.json',
    );
  });

  it('fails rather than cross-checking anchors against a journey that names no place (ADR-0024)', () => {
    expectRefused(
      run(() => undefined, {
        config: (config) => {
          config.journey = config.journey.map(() => null);
        },
      }),
      'is vacuously true of no places',
    );
  });

  it('fails rather than passing anchors it had no journey to check against', () => {
    expectRefused(run(() => undefined, { config: null }), 'that journey could not be read');
  });
});

/*
 * ADR-0069: the map holds as many insets as its crowded places need. `inset`
 * became `insets`, an array, each entry owning its own affine, and the gate
 * checks across entries (§3.1-§3.3). Each case below breaks one rule on the
 * real sidecar; the committed sidecar passing is the first case above.
 */
describe('the insets (ADR-0069)', () => {
  const first = (doc: Sidecar): Inset => {
    const inset = doc.insets?.[0];
    if (inset === undefined) throw new Error('the committed sidecar has no inset');
    return inset;
  };

  /** A second inset over empty sea: Winnipeg, enlarged, 30 units above the Atlantic frame. */
  const winnipegInset = (doc: Sidecar, frameY = 200): Inset => {
    const shift = frameY - first(doc).frame.y;
    const main = doc.anchors['winnipeg'] ?? { x: 0, y: 0 };
    return {
      ...structuredClone(first(doc)),
      frame: { ...first(doc).frame, y: first(doc).frame.y + shift },
      window: { ...first(doc).window, y: first(doc).window.y + shift },
      locator: { x: main.x - 5, y: main.y - 5, width: 10, height: 10 },
      anchors: { winnipeg: { x: first(doc).window.x + 20, y: first(doc).window.y + shift + 20 } },
      magnification: 3,
    };
  };

  it('has an Atlantic inset in the committed sidecar to build its cases from', () => {
    // The Atlantic inset first, then the Ottawa–Toronto corridor (ADR-0069 §6 commit 2),
    // which holds Kingston since it landed.
    expect(REAL.insets?.length).toBe(2);
    expect(Object.keys(REAL.insets?.[0]?.anchors ?? {}).sort()).toEqual(['halifax', 'peggys-cove']);
    expect(Object.keys(REAL.insets?.[1]?.anchors ?? {}).sort()).toEqual(['kingston', 'ottawa', 'toronto']);
    expect(REAL.anchors['winnipeg']).toBeDefined();
    expect(REAL.anchors['quebec-city']).toBeDefined();
    expect(STYLESHEET).toContain(PIN_RULE);
  });

  it('says what it measured across the committed insets', () => {
    const result = run(() => undefined);
    expect(result.status, result.output).toBe(0);
    expect(result.stdout).toContain('2 inset(s): 5 enlarged stop(s) each in one inset');
    expect(result.stdout).toContain("2 locator(s) enclosing only their own inset's stops");
    expect(result.stdout).toMatch(/1 frame pair\(s\) at least [\d.]+ unit\(s\) apart/);
    expect(result.stdout).toMatch(/\d+ main-map pin\(s\) at least [\d.]+ unit\(s\) from every frame against a pin radius of [\d.]+/);
  });

  it('refuses the old single-object `inset` by its name', () => {
    expectRefused(
      run((doc) => {
        doc.inset = doc.insets?.[0];
        delete doc.insets;
      }),
      'must NOT have additional properties ("inset")',
    );
  });

  it('refuses an empty array: an empty collection does not stand in for none (ADR-0024)', () => {
    expectRefused(
      run((doc) => {
        doc.insets = [];
      }),
      'must NOT have fewer than 1 items',
    );
  });

  it('refuses an inset with no affine of its own', () => {
    expectRefused(
      run((doc) => {
        delete first(doc).affine;
      }),
      "must have required property 'affine'",
    );
  });

  it("refuses the inset's affine left in the projection block", () => {
    expectRefused(
      run((doc) => {
        doc.projection['inset'] = first(doc).affine;
      }),
      'must NOT have additional properties ("inset")',
    );
  });

  it('passes a sidecar with no inset, and says there was nothing to measure', () => {
    /* With no inset every stop is a main-map pin, so the crowded ones are
       moved to open ground first; §3.4 would refuse them where they are. */
    const result = run((doc) => {
      delete doc.insets;
      doc.anchors['peggys-cove'] = { x: 760, y: 530 };
      doc.anchors['toronto'] = { x: 580, y: 570 };
      doc.anchors['kingston'] = { x: 680, y: 600 };
    });
    expect(result.status, result.output).toBe(0);
    expect(result.stdout).toContain('no inset in any sidecar, so the cross-inset checks (ADR-0069 §3.1-3.3) had nothing to measure');
    expect(result.stdout).toMatch(/the main map 11 pin\(s\) at least [\d.]+ unit\(s\) apart/);
  });

  it('passes three insets that keep apart, and says how far apart', () => {
    const result = run((doc) => {
      doc.insets = [...(doc.insets ?? []), winnipegInset(doc, 0)];
    });
    expect(result.status, result.output).toBe(0);
    expect(result.stdout).toContain('3 inset(s): 6 enlarged stop(s) each in one inset');
    expect(result.stdout).toContain('3 frame pair(s) at least 10 unit(s) apart');
    expect(result.stdout).toContain('insets[2] 1 pin(s), no pair to keep apart');
  });

  it('fails when a stop is enlarged in two insets (§3.1)', () => {
    expectRefused(
      run((doc) => {
        const second = winnipegInset(doc);
        second.locator = { ...first(doc).locator };
        second.anchors = { [INSET_STOP]: { x: second.window.x + 60, y: second.window.y + 60 } };
        doc.insets = [first(doc), second];
      }),
      `insets[1].anchors."${INSET_STOP}" is also anchored in insets[0]`,
    );
  });

  it("fails when a locator encloses a stop its inset does not show (§3.2)", () => {
    const result = run((doc) => {
      const main = doc.anchors['quebec-city'] ?? { x: 0, y: 0 };
      const locator = first(doc).locator;
      const right = locator.x + locator.width;
      first(doc).locator = { ...locator, x: main.x - 1, width: right - (main.x - 1) };
    });
    expectRefused(result, 'anchors."quebec-city" at (658, 476) lies inside insets[0].locator');
    expect(result.output).toContain('false pointer');
  });

  it('fails when two frames overlap (§3.3)', () => {
    expectRefused(
      run((doc) => {
        doc.insets = [first(doc), winnipegInset(doc, first(doc).frame.y - 100)];
      }),
      'insets[0].frame (860, 400, 200 x 170) and insets[1].frame (860, 300, 200 x 170) overlap',
    );
  });

  it('fails when a main-map pin is within one pin radius of a frame (§3.3)', () => {
    const result = run((doc) => {
      doc.anchors['quebec-city'] = { x: first(doc).frame.x - 10, y: first(doc).frame.y + 50 };
    });
    expectRefused(result, 'the main-map pin for "quebec-city" at (850, 450) is 10 unit(s) from insets[0].frame');
    expect(result.output).toContain('within one pin radius');
  });

  it('measures the pin from the stylesheet that draws it, not from a number of its own', () => {
    /* 23 units clear of the frame passes at the shipped pin; the same sidecar
       fails once the stylesheet draws the pin twice as wide. */
    const nearFrame = (doc: Sidecar): void => {
      doc.anchors['quebec-city'] = { x: first(doc).frame.x - 23, y: first(doc).frame.y + 50 };
    };
    const shipped = run(nearFrame);
    expect(shipped.status, shipped.output).toBe(0);

    const rule = STYLESHEET.indexOf(PIN_RULE);
    const close = STYLESHEET.indexOf('}', rule);
    const widened =
      STYLESHEET.slice(0, rule) +
      STYLESHEET.slice(rule, close).replace(/(^|[\s;{])inline-size:\s*([0-9.]+)cqi/g, (_m, lead: string, n: string) => `${lead}inline-size: ${String(Number(n) * 2)}cqi`) +
      STYLESHEET.slice(close);
    expect(widened).not.toBe(STYLESHEET);
    expectRefused(run(nearFrame, { stylesheet: widened }), 'the main-map pin for "quebec-city" at (837, 450) is 23 unit(s)');
  });

  it('fails rather than skipping the frame check when the pin size cannot be read', () => {
    expectRefused(run(() => undefined, { stylesheet: null }), "the map pin's size could not be read from app/ui/screen-styles.ts");
    const unsized = STYLESHEET.replace(PIN_RULE, '.tn-map .tn-map__stop .tn-journey__pin--renamed {');
    expectRefused(run(() => undefined, { stylesheet: unsized }), 'no "inline-size: <n>cqi" in the app/ui/screen-styles.ts rule');
  });
});

/**
 * ADR-0069 §3.4: any two pins drawn in the same frame are at least one pin
 * diameter apart, the diameter being the stylesheet's fraction times the
 * viewBox width. The fraction is asked of the gate's own reader, never restated.
 */
describe('pin separation (ADR-0069 §3.4)', () => {
  const pinFraction = async (): Promise<number> => {
    const module = (await import(new URL('../../../scripts/lib/screen-art.mjs', import.meta.url).href)) as {
      readPinFraction: (root: string) => number | string;
    };
    const fraction = module.readPinFraction(REPO);
    if (typeof fraction === 'string') throw new Error(fraction);
    return fraction;
  };
  const width = REAL.viewBox[2] ?? 0;
  const quebec = REAL.anchors['quebec-city'] ?? { x: 0, y: 0 };

  it('reports the closest pair in every frame of the shipped tree', () => {
    const result = run(() => undefined);
    expect(result.status, result.output).toBe(0);
    expect(result.stdout).toMatch(/pin separation \(ADR-0069 §3\.4\) against a pin diameter of [\d.]+: the main map 6 pin\(s\) at least [\d.]+ unit\(s\) apart/);
    expect(result.stdout).toMatch(/insets\[0\] 2 pin\(s\) at least [\d.]+ unit\(s\) apart \(halifax - peggys-cove\)/);
    expect(result.stdout).toMatch(/insets\[1\] 3 pin\(s\) at least [\d.]+ unit\(s\) apart \(ottawa - kingston\)/);
  });

  it('fails when two main-map pins are closer than one pin diameter, naming both stops', async () => {
    const diameter = (await pinFraction()) * width;
    const result = run((doc) => {
      doc.anchors['winnipeg'] = { x: quebec.x - (diameter - 1), y: quebec.y };
    });
    expectRefused(result, 'anchors."quebec-city" at (658, 476) and anchors."winnipeg" at');
    expect(result.output).toMatch(/are [\d.]+ unit\(s\) apart on the main map, closer than one pin diameter/);
  });

  it('fails when two pins in one inset are closer than one pin diameter, naming both stops', async () => {
    const diameter = (await pinFraction()) * width;
    const result = run((doc) => {
      const inset = doc.insets?.[1];
      const ottawa = inset?.anchors['ottawa'];
      if (inset === undefined || ottawa === undefined) throw new Error('the committed sidecar has no corridor inset');
      inset.anchors['toronto'] = { x: ottawa.x - (diameter - 1), y: ottawa.y };
    });
    expectRefused(result, 'insets[1].anchors."ottawa" at (903, 214.2) and insets[1].anchors."toronto" at');
    expect(result.output).toContain('apart on insets[1], closer than one pin diameter');
  });

  it('fails on the pre-inset anchors, where Ottawa and Toronto touched at 44.4', () => {
    const result = run((doc) => {
      doc.insets = doc.insets?.slice(0, 1) ?? [];
    });
    expectRefused(
      result,
      'anchors."ottawa" at (623.6, 508.4) and anchors."toronto" at (594.9, 542.3) are 44.4 unit(s) apart on the main map',
    );
  });

  it('passes two pins exactly one pin diameter apart, and fails them a tenth of a unit closer', async () => {
    const diameter = (await pinFraction()) * width;
    const at = run((doc) => {
      doc.anchors['winnipeg'] = { x: quebec.x - diameter, y: quebec.y };
    });
    expect(at.status, at.output).toBe(0);
    expect(at.stdout).toContain(`the main map 6 pin(s) at least ${diameter.toFixed(1)} unit(s) apart (quebec-city - winnipeg)`);

    const under = run((doc) => {
      doc.anchors['winnipeg'] = { x: quebec.x - (diameter - 0.1), y: quebec.y };
    });
    expectRefused(under, 'anchors."quebec-city" at (658, 476) and anchors."winnipeg" at');
  });

  it('measures the diameter from the stylesheet: a wider pin fails a pair the shipped pin passes', async () => {
    const diameter = (await pinFraction()) * width;
    const apart = (doc: Sidecar): void => {
      doc.anchors['winnipeg'] = { x: quebec.x - (diameter + 5), y: quebec.y };
    };
    const shipped = run(apart);
    expect(shipped.status, shipped.output).toBe(0);

    const rule = STYLESHEET.indexOf(PIN_RULE);
    const close = STYLESHEET.indexOf('}', rule);
    const widened =
      STYLESHEET.slice(0, rule) +
      STYLESHEET.slice(rule, close).replace(/(^|[\s;{])inline-size:\s*([0-9.]+)cqi/g, (_m, lead: string, n: string) => `${lead}inline-size: ${String(Number(n) * 1.5)}cqi`) +
      STYLESHEET.slice(close);
    expectRefused(run(apart, { stylesheet: widened }), 'anchors."quebec-city" at (658, 476) and anchors."winnipeg" at');
  });

  it('fails rather than skipping when there is no inset and the pin size cannot be read', () => {
    expectRefused(
      run(
        (doc) => {
          delete doc.insets;
        },
        { stylesheet: null },
      ),
      'no two pins against each other (§3.4)',
    );
  });
});
