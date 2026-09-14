/**
 * The screen-art sidecar gate in `make validate-content`.
 *
 * `assets/src/svg/screens/map-canada.anchors.json` tells the level select where
 * each stop is on the map, and UI code will place a marker there without looking
 * at the drawing. So the sidecar is schema-checked
 * (`content/schemas/map-anchors.schema.json`) and then cross-checked by
 * scripts/lib/screen-art.mjs against what the schema cannot see: the drawing
 * beside it and the level documents that exist.
 *
 * Every case drives the real CLI over a scratch tree built from the REAL map,
 * sidecar, schemas and level documents, with one thing broken. The first case is
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

interface Sidecar {
  [property: string]: unknown;
  $schema?: string;
  svg: string;
  viewBox: number[];
  anchors: Record<string, Point>;
  inset?: { anchors: Record<string, Point>; locator: Rect; window: Rect };
  provincesAndTerritories?: string[];
}

interface Run {
  readonly status: number;
  readonly stdout: string;
  readonly output: string;
}

const REAL = JSON.parse(readFileSync(join(SCREENS, 'map-canada.anchors.json'), 'utf8')) as Sidecar;
const DRAWING = readFileSync(join(SCREENS, 'map-canada.svg'), 'utf8');

const LEVEL_IDS = readdirSync(join(REPO, 'content', 'levels'))
  .filter((name) => name.endsWith('.json'))
  .map((name) => (JSON.parse(readFileSync(join(REPO, 'content', 'levels', name), 'utf8')) as { id: string }).id)
  .sort();

const FIRST_LEVEL = LEVEL_IDS[0] ?? '';
const INSET_STOP = Object.keys(REAL.inset?.anchors ?? {}).sort()[0] ?? '';

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
function run(mutate: (doc: Sidecar) => void, options: { readonly levels?: boolean } = {}): Run {
  caseId += 1;
  const root = join(WORK, `case-${caseId}`);
  const screens = join(root, 'assets', 'src', 'svg', 'screens');
  mkdirSync(join(root, 'content'), { recursive: true });
  mkdirSync(join(root, 'assets', 'style'), { recursive: true });
  mkdirSync(screens, { recursive: true });

  cpSync(join(REPO, 'content', 'schemas'), join(root, 'content', 'schemas'), { recursive: true });
  const withLevels = options.levels !== false;
  if (withLevels) {
    cpSync(join(REPO, 'content', 'levels'), join(root, 'content', 'levels'), { recursive: true });
  }
  cpSync(join(REPO, 'assets', 'style', 'palette.json'), join(root, 'assets', 'style', 'palette.json'));

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

  // --allow-empty-content only where the case removes the level documents on
  // purpose; that waiver is about content/ being empty and must not hide the
  // sidecar's own floor, which is what that case asserts.
  const args = [SCRIPT, '--root', root, ...(withLevels ? [] : ['--allow-empty-content'])];
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
    expect(Object.keys(REAL.anchors).length).toBeGreaterThan(0);
    expect(INSET_STOP).not.toBe('');
  });

  it('passes the committed sidecar, and says what it checked', () => {
    const result = run(() => undefined);
    expect(result.status, result.output).toBe(0);
    expect(result.stdout).toContain('1 screen-art sidecar(s) cross-checked');
    expect(result.stdout).toContain(`against ${LEVEL_IDS.length} level(s)`);
  });

  it('fails when a level has no anchor', () => {
    expectRefused(
      run((doc) => {
        delete doc.anchors[FIRST_LEVEL];
      }),
      `no anchor for level "${FIRST_LEVEL}"`,
    );
  });

  it('fails on an anchor for a level that does not exist', () => {
    expectRefused(
      run((doc) => {
        doc.anchors['not-a-level'] = { x: 10, y: 10 };
      }),
      'anchors."not-a-level" names no level in content/levels/',
    );
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
      const locator = doc.inset?.locator;
      if (locator !== undefined) doc.anchors[INSET_STOP] = { x: locator.x - 10, y: locator.y };
    });
    expectRefused(result, 'is outside inset.locator');
    expect(result.output).toContain(`anchors."${INSET_STOP}" at (`);
  });

  it('fails when an inset stop is not inside the inset window', () => {
    expectRefused(
      run((doc) => {
        if (doc.inset !== undefined) doc.inset.anchors[INSET_STOP] = { x: 0, y: 0 };
      }),
      `inset.anchors."${INSET_STOP}" at (0, 0) lies outside inset.window`,
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

  it('fails rather than cross-checking anchors against no levels (ADR-0024)', () => {
    expectRefused(
      run(() => undefined, { levels: false }),
      'is vacuously true of no levels',
    );
  });
});
