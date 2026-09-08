/**
 * `content/schemas/palette.schema.json` enforcement: the gate is itself checked.
 *
 * Until 2026-09-08 that schema validated NOTHING, and it took the architect
 * writing an ADR to notice. Two independent and individually correct rules did
 * it: `assets/style/palette.json` is not under `content/`, so the schema walk
 * never reached it, and it is listed in `NON_ASSET_PATHS`, so the credit walk
 * skipped it. A schema and a document, named after each other, with nothing
 * checking one against the other -- ADR-0007's problem inverted, and it reads as
 * enforced precisely because both halves exist.
 *
 * It is not a hypothetical file: around a hundred colours in thirty-odd ramps
 * generated from a published formula, and the art agent's own checker caught six
 * ramps contradicting the rule it had just written, on its first pass. The count
 * is deliberately not written down here as a number - see MINIMUM_RAMPS below
 * for why an exact count is the wrong thing to assert about it.
 *
 * Every case drives the real CLI over a scratch tree with the REAL schemas
 * copied in. A fixture with stubbed schemas would prove the copy agrees with the
 * copy, which is the failure one level up.
 */

import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../../../scripts/validate-content.mjs', import.meta.url));
const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const SCHEMAS = join(REPO, 'content', 'schemas');
const WORK = mkdtempSync(join(tmpdir(), 'palette-gate-'));

afterAll(() => {
  rmSync(WORK, { recursive: true, force: true });
});

interface Run {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly output: string;
}

/** A palette the real schema accepts, small enough to read in one screen. */
const validPalette = (): Record<string, unknown> => ({
  $schema: '../../content/schemas/palette.schema.json',
  id: 'scratch-palette',
  version: '1.0.0',
  owner: 'art',
  licence: 'CC-BY-4.0',
  designResolution: { width: 1080, height: 1920 },
  shading: { tones: 3, rule: 'Three flat fills per material.' },
  outline: { weight: 6 },
  ambientOcclusion: { mode: 'baked' },
  colours: {
    'snow-light': '#ffffff',
    'snow-base': '#e6eff7',
    'snow-shade': '#c8d8e8',
    'sky-light': '#a5d6ee',
    'sky-base': '#3d8ccb',
    'sky-shade': '#1d5f9c',
    'ink-warm': '#1a2036',
  },
  ramps: {
    snow: { light: 'snow-light', base: 'snow-base', shade: 'snow-shade', derived: true },
    sky: { light: 'sky-light', base: 'sky-base', shade: 'sky-shade', derived: false },
  },
  inks: { 'ink-warm': 'Characters whose largest area is a warm hue.' },
  levelTheme: { ottawa: { sky: 'sky-shade', ground: 'snow-base', horizon: 'sky-light' } },
  restrictedMarks: { note: 'None in a scratch tree.' },
});

let caseId = 0;

/**
 * Build a scratch repository and run the real gate over it.
 *
 * `palette` is the document to write, or `null` to write none at all -- the
 * missing-document case has to be reachable, because "it was not there" is the
 * state the palette was actually in for a whole slice.
 */
function run(palette: Record<string, unknown> | null): Run {
  caseId += 1;
  const root = join(WORK, `case-${caseId}`);
  mkdirSync(join(root, 'content'), { recursive: true });
  cpSync(SCHEMAS, join(root, 'content', 'schemas'), { recursive: true });
  mkdirSync(join(root, 'assets', 'style'), { recursive: true });
  mkdirSync(join(root, 'assets', 'refs', 'ottawa'), { recursive: true });

  // One credited asset, so the credit gate's own anti-vacuum floor is satisfied
  // and the only failures a case can produce are the palette's.
  writeFileSync(join(root, 'assets', 'refs', 'ottawa', 'peace-tower.jpg'), 'not-really-a-jpeg', 'utf8');
  writeFileSync(
    join(root, 'assets', 'credits.json'),
    `${JSON.stringify(
      {
        $schema: '../content/schemas/credits.schema.json',
        assets: [
          {
            path: 'refs/ottawa/peace-tower.jpg',
            kind: 'reference',
            title: 'Peace Tower',
            author: 'A. Photographer',
            licence: 'CC0-1.0',
            source: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
          },
        ],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  if (palette !== null) {
    writeFileSync(join(root, 'assets', 'style', 'palette.json'), `${JSON.stringify(palette, null, 2)}\n`, 'utf8');
  }

  const result = spawnSync(process.execPath, [SCRIPT, '--root', root, '--allow-empty-content'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  return { status: result.status ?? -1, stdout, stderr, output: `${stdout}${stderr}` };
}

describe('the palette gate fails', () => {
  it('on a ramp tone naming a colour that does not exist', () => {
    // The check the schema cannot make: it pins the tone to the `id` type, and
    // "snow-basee" is a perfectly good id. Only this gate can say it is not in
    // the table three lines up.
    const palette = validPalette();
    palette.ramps = { ...(palette.ramps as Record<string, unknown>), snow: { light: 'snow-light', base: 'snow-basee', shade: 'snow-shade' } };
    const result = run(palette);
    expect(result.status).toBe(1);
    expect(result.output).toContain('ramps.snow.base is "snow-basee", which is not a key of "colours"');
    expect(result.output).toContain('renders as a missing fill and no other gate would see it');
    expect(result.stdout).not.toContain('validate-content: OK');
  });

  it('on an ink that is not in the allow-list', () => {
    const palette = validPalette();
    palette.inks = { 'ink-teal': 'A colour nobody defined.' };
    const result = run(palette);
    expect(result.status).toBe(1);
    expect(result.output).toContain('inks."ink-teal" is not a key of "colours"');
  });

  it('on a level theme naming a colour that does not exist', () => {
    const palette = validPalette();
    palette.levelTheme = { ottawa: { sky: 'sky-shade', ground: 'snow-gone', horizon: 'sky-light' } };
    const result = run(palette);
    expect(result.status).toBe(1);
    expect(result.output).toContain('levelTheme.ottawa.ground is "snow-gone", which is not a key of "colours"');
  });

  it('on a ramp with only two tones, which is the schema doing its job', () => {
    const palette = validPalette();
    (palette.ramps as Record<string, unknown>).snow = { light: 'snow-light', base: 'snow-base' };
    const result = run(palette);
    expect(result.status).toBe(1);
    expect(result.output).toContain('assets/style/palette.json');
    expect(result.output).toContain("must have required property 'shade'");
  });

  it('on a colour that is not a #RRGGBB hex', () => {
    const palette = validPalette();
    (palette.colours as Record<string, string>)['snow-base'] = 'eggshell';
    const result = run(palette);
    expect(result.status).toBe(1);
    expect(result.output).toContain('must match pattern');
  });

  it('on an unknown top-level property, because the schema closes the shape', () => {
    const palette = validPalette();
    palette.gradients = { note: 'the house style has none' };
    const result = run(palette);
    expect(result.status).toBe(1);
    expect(result.output).toContain('must NOT have additional properties ("gradients")');
  });

  it('on a palette with no colours, rather than passing by having nothing to check', () => {
    // Every referential check below is satisfied by an empty table. An empty
    // palette is what a broken generator writes, so it fails by name.
    const palette = validPalette();
    palette.colours = {};
    palette.ramps = {};
    palette.inks = {};
    delete palette.levelTheme;
    const result = run(palette);
    expect(result.status).toBe(1);
    expect(result.output).toContain('declares no colours');
    expect(result.output).toContain('declares no ramps');
  });

  it('when the palette is missing outright, rather than skipping it', () => {
    // THE ORIGINAL DEFECT, in its purest form: no document, no complaint. For a
    // whole slice this gate would have said "OK" over exactly this tree.
    const result = run(null);
    expect(result.status).toBe(1);
    expect(result.output).toContain('assets/style/palette.json: is missing');
    expect(result.output).toContain('a document that is not there is not a document that passed');
    expect(result.stdout).not.toContain('validate-content: OK');
  });

  it('when the palette declares no $schema', () => {
    const palette = validPalette();
    delete palette.$schema;
    const result = run(palette);
    expect(result.status).toBe(1);
    expect(result.output).toContain('assets/style/palette.json: missing "$schema"');
  });

  it('when the palette points $schema at the wrong schema', () => {
    // It would otherwise validate cleanly against a schema that shares none of
    // its shape, because credits.schema.json says nothing about colours.
    const palette = validPalette();
    palette.$schema = '../../content/schemas/credits.schema.json';
    const result = run(palette);
    expect(result.status).toBe(1);
    expect(result.output).toContain('assets/style/palette.json');
  });
});

describe('the palette gate passes', () => {
  it('and reports the real counts, not "OK"', () => {
    const result = run(validPalette());
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('palette 7 colour(s) in 2 ramp(s), every tone and ink resolved');
  });

  /**
   * FLOORS, not equalities. This case asserted `97 colour(s) in 31 ramp(s)`
   * exactly, and Quebec City's colours took the palette to 100 in 32 and turned
   * it red. An equality over a number designed to grow fails on every
   * legitimate palette change and passes on none of the defects this file
   * exists for: it is a tripwire pointed at the art agent doing its job.
   *
   * What is asserted instead, in three layers, none of which goes stale:
   *
   *   1. THE GATE REPORTS WHAT IT READ. The counts on the summary line must
   *      equal the counts derivable from the document the test just loaded.
   *      That is the defect this whole file was written for - a schema and a
   *      document named after each other with nothing checking one against the
   *      other - and it is caught by comparing a claim against another claim
   *      rather than against a constant (ADR-0024).
   *   2. THE DOCUMENT'S OWN INVARIANT. `shading.tones` is 3 and the rule beside
   *      it says "exactly three flat fills per material, no fourth tone", so
   *      every ramp must resolve at least that many colours. A ramp that lost
   *      its `shade` is a real defect and no aggregate count would show it.
   *   3. A TRUNCATION FLOOR. A bare `> 0` would be decoration by ADR-0014's
   *      standard - it passes a palette cut to one ramp, which is exactly the
   *      failure a floor is for. 24 is chosen: Ottawa alone needed 31 ramps, so
   *      the floor tolerates removing 8 in one change while catching a palette
   *      truncated to a handful by a bad generator run or a bad merge. It only
   *      ever needs revisiting downward, which is the property the equality
   *      lacked.
   */
  const MINIMUM_RAMPS = 24;

  it('over the palette this repository actually ships', () => {
    // The scratch cases prove the rules; this proves they hold for the document
    // the schema was written for, which is the whole reason a schema was wanted.
    //
    // The real palette is copied into a scratch tree rather than the gate being
    // run over the repository itself. Running it in place would couple this case
    // to every other agent's work in progress: an uncredited SVG under
    // assets/src/ fails the same CLI, and this test would then be red for a
    // reason that has nothing to do with the palette. What is asserted is the
    // palette's own line.
    const palette = JSON.parse(readFileSync(join(REPO, 'assets', 'style', 'palette.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    const result = run(palette);
    expect(result.status).toBe(0);

    const reported = /palette (\d+) colour\(s\) in (\d+) ramp\(s\), every tone and ink resolved/.exec(
      result.stdout,
    );
    expect(reported, `no palette line in: ${result.stdout}`).not.toBeNull();

    const colours = palette.colours as Record<string, string>;
    const ramps = palette.ramps as Record<string, Record<string, unknown>>;
    const tones = (palette.shading as { tones: number }).tones;

    // 1. the gate counted the document, not something else
    expect(Number(reported?.[1])).toBe(Object.keys(colours).length);
    expect(Number(reported?.[2])).toBe(Object.keys(ramps).length);

    // 2. the document's own three-tone rule, per ramp
    for (const [name, ramp] of Object.entries(ramps)) {
      const resolved = Object.values(ramp).filter(
        (value) => typeof value === 'string' && value in colours,
      );
      expect(resolved.length, `ramp "${name}" resolves ${String(resolved.length)} colour(s)`).toBeGreaterThanOrEqual(
        tones,
      );
    }

    // 3. the truncation floor
    expect(Object.keys(ramps).length).toBeGreaterThanOrEqual(MINIMUM_RAMPS);
    expect(Object.keys(colours).length).toBeGreaterThanOrEqual(MINIMUM_RAMPS * tones);
  });

  it('and the shipped tree reports nothing against the palette, whatever else is in flight', () => {
    // Deliberately asserts only the absence of palette failures, not the exit
    // code: `make validate-content` also holds art's credit register and
    // content's schemas, and those are other people's files.
    const result = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const paletteFailures = `${result.stdout}${result.stderr}`
      .split('\n')
      .filter((line) => line.includes('assets/style/palette.json'));
    expect(paletteFailures).toEqual([]);
  });
});
