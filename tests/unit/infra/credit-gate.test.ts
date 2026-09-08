/**
 * ADR-0004 enforcement: the credit gate is itself checked.
 *
 * This gate spent slice 0 reporting "0 shipped asset(s) credited" while it was
 * pointed at an empty `assets/dist/`. It was green, it measured nothing, and
 * fourteen licensed reference photographs under `assets/refs/` were credited
 * only because a person did it by hand. ADR-0006's credit-scope obligation
 * names that shape of defect directly.
 *
 * So every case below drives the real CLI - argv, exit code, stdout, stderr -
 * over a scratch tree, because the exit code is the only part of this script
 * `make validate-content` consumes. A test that re-implemented the walk would
 * prove the copy agrees with the copy, which is the failure one level up.
 *
 * The schemas are copied into each scratch root rather than stubbed: the gate
 * validates `credits.json` against the real `credits.schema.json` on the way
 * past, and a fixture that could not survive the real schema would be testing a
 * gate nobody runs.
 */

import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../../../scripts/validate-content.mjs', import.meta.url));
const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const SCHEMAS = join(REPO, 'content', 'schemas');
const WORK = mkdtempSync(join(tmpdir(), 'credit-gate-'));

afterAll(() => {
  rmSync(WORK, { recursive: true, force: true });
});

interface Run {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly output: string;
}

interface CreditEntry {
  readonly path: string;
  readonly kind?: string;
  readonly title?: string;
  readonly author?: string;
  readonly licence?: string;
  readonly source?: string;
}

/**
 * A schema-valid credit entry for `path`; individual cases override fields.
 *
 * `kind` is derived from the path rather than left off, because
 * credits.schema.json requires it now that all fourteen real entries carry one -
 * a fixture without it fails validation before the credit rules are reached, and
 * the case stops testing what it says it tests. The cases that need a `kind`
 * disagreeing with the path pass one explicitly: whether `kind` is *present* is
 * the schema's business, whether it is *true* is only ever this gate's.
 */
const credit = (path: string, overrides: Partial<CreditEntry> = {}): CreditEntry => ({
  path,
  kind: /(^|\/)refs\//.test(path) ? 'reference' : 'shipped',
  title: `Reference for ${path}`,
  author: 'A. Photographer',
  licence: 'CC0-1.0',
  source: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
  ...overrides,
});

let caseId = 0;

/**
 * Build a scratch repository root with `files` under `assets/` and the given
 * credit entries, then run the real gate over it.
 *
 * `files` maps an `assets`-relative path to its contents. Directories are
 * created as needed, so `refs/ottawa/x.jpg` makes the tree it needs.
 */
function run(files: Record<string, string>, entries: CreditEntry[] | null): Run {
  caseId += 1;
  const root = join(WORK, `case-${caseId}`);
  mkdirSync(join(root, 'content'), { recursive: true });
  cpSync(SCHEMAS, join(root, 'content', 'schemas'), { recursive: true });
  mkdirSync(join(root, 'assets'), { recursive: true });

  mkdirSync(join(root, 'assets', 'style'), { recursive: true });

  for (const [rel, contents] of Object.entries(files)) {
    const full = join(root, 'assets', rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents, 'utf8');
  }

  if (entries !== null) {
    writeFileSync(
      join(root, 'assets', 'credits.json'),
      `${JSON.stringify({ $schema: '../content/schemas/credits.schema.json', assets: entries }, null, 2)}\n`,
      'utf8',
    );
  }

  // The gate also requires assets/style/palette.json (EXTERNAL_DATA_FILES), and
  // a missing one is a failure rather than a skip - deliberately, since the
  // palette spent slice 1 with a schema that validated nothing. Every case here
  // is about credits, so each scratch tree gets a valid palette and none of them
  // has to think about it.
  writeFileSync(join(root, 'assets', 'style', 'palette.json'), `${JSON.stringify(PALETTE, null, 2)}\n`, 'utf8');

  return gate(['--root', root]);
}

/** The smallest document content/schemas/palette.schema.json accepts. */
const PALETTE = {
  $schema: '../../content/schemas/palette.schema.json',
  id: 'scratch-palette',
  version: '1.0.0',
  owner: 'art',
  licence: 'CC-BY-4.0',
  designResolution: { width: 1080, height: 1920 },
  shading: { tones: 3 },
  outline: { weight: 6 },
  ambientOcclusion: { mode: 'baked' },
  colours: { 'snow-light': '#ffffff', 'snow-base': '#e6eff7', 'snow-shade': '#c8d8e8', 'ink-warm': '#1a2036' },
  ramps: { snow: { light: 'snow-light', base: 'snow-base', shade: 'snow-shade' } },
  inks: { 'ink-warm': 'Warm characters.' },
  restrictedMarks: { note: 'None in a scratch tree.' },
};

/**
 * `spawnSync`, not `execFileSync`: failures go to stderr and the summary goes to
 * stdout, and `execFileSync` returns stdout only, so an assertion on a message
 * this gate writes to stderr would silently compare against an empty string.
 * Both streams are needed on both outcomes - including the assertion that a
 * passing run now writes *nothing* to stderr.
 */
function gate(args: readonly string[]): Run {
  const result = spawnSync(process.execPath, [SCRIPT, ...args, '--allow-empty-content'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  return { status: result.status ?? -1, stdout, stderr, output: `${stdout}${stderr}` };
}

const JPEG = 'not-really-a-jpeg';

describe('the credit gate fails', () => {
  it('on an asset file with no credit entry', () => {
    // The whole point of the rebase: this file is under assets/, not
    // assets/dist/, and the old gate could not see it.
    const result = run(
      { 'refs/ottawa/peace-tower.jpg': JPEG, 'refs/ottawa/uncredited.jpg': JPEG },
      [credit('refs/ottawa/peace-tower.jpg', { kind: 'reference' })],
    );
    expect(result.status).toBe(1);
    expect(result.output).toContain(
      'assets/refs/ottawa/uncredited.jpg is committed but not credited',
    );
  });

  it('on a credit entry pointing at a file that does not exist', () => {
    // The other direction. An entry nobody can resolve is how a credits file
    // rots into a set of claims about files that are gone.
    const result = run({ 'refs/ottawa/peace-tower.jpg': JPEG }, [
      credit('refs/ottawa/peace-tower.jpg'),
      credit('refs/ottawa/deleted-last-week.jpg'),
    ]);
    expect(result.status).toBe(1);
    expect(result.output).toContain(
      'credits assets/refs/ottawa/deleted-last-week.jpg, which does not exist',
    );
  });

  it('on an empty assets/ tree, rather than reporting success by vacuum', () => {
    // Exactly the state that let this gate pass for a whole slice.
    const result = run({}, []);
    expect(result.status).toBe(1);
    expect(result.output).toContain('found 0 asset file(s) under assets/');
    expect(result.stdout).not.toContain('validate-content: OK');
  });

  it('on an assets/ tree holding only exempt files', () => {
    // The subtler vacuum: the directory is not empty, but everything in it is
    // excluded, so the check still measures nothing.
    const result = run(
      { '.gitkeep': '', 'refs/README.md': '# refs\n', 'style/palette.json': '{}\n' },
      [],
    );
    expect(result.status).toBe(1);
    expect(result.output).toContain('found 0 asset file(s) under assets/');
  });

  it('on a credit entry for a file the gate does not count as an asset', () => {
    const result = run({ 'refs/ottawa/peace-tower.jpg': JPEG, 'refs/README.md': '# refs\n' }, [
      credit('refs/ottawa/peace-tower.jpg'),
      credit('refs/README.md'),
    ]);
    expect(result.status).toBe(1);
    expect(result.output).toContain('which this gate does not count as an asset');
  });

  it('on two entries crediting the same file', () => {
    const result = run({ 'refs/ottawa/peace-tower.jpg': JPEG }, [
      credit('refs/ottawa/peace-tower.jpg'),
      credit('refs/ottawa/peace-tower.jpg', { author: 'Someone Else' }),
    ]);
    expect(result.status).toBe(1);
    expect(result.output).toContain('duplicates an earlier entry');
  });

  it('on a credits path written to the old assets/dist-relative convention', () => {
    // This exact tree exited 0 until 2026-09-08: the transitional branch resolved
    // "../" against assets/dist and printed a warning, so the real repository
    // could stay green while credits.json was rewritten. All fourteen entries are
    // assets-relative now, which left a branch that looked like it handled a case
    // and handled nothing - a gate carrying a path no input reaches is the vacuum
    // problem in miniature. Rejecting it has to name the canonical form too, or it
    // is a failure the author cannot act on.
    const result = run({ 'refs/ottawa/peace-tower.jpg': JPEG }, [
      credit('../refs/ottawa/peace-tower.jpg'),
    ]);
    expect(result.status).toBe(1);
    expect(result.output).toContain('starts with "../"');
    expect(result.output).toContain('write "refs/ottawa/peace-tower.jpg"');
    // And the entry no longer stands in for the file it claimed to credit.
    expect(result.output).toContain(
      'assets/refs/ottawa/peace-tower.jpg is committed but not credited',
    );
    expect(result.stdout).not.toContain('validate-content: OK');
  });

  it('on a path that escapes assets/ entirely', () => {
    const result = run({ 'refs/ottawa/peace-tower.jpg': JPEG }, [
      credit('refs/ottawa/peace-tower.jpg'),
      credit('../../etc/passwd'),
    ]);
    expect(result.status).toBe(1);
    expect(result.output).toContain('resolves outside assets/');
  });

  it('on a kind that disagrees with where the file lives', () => {
    // credits.schema.json requires `kind` and constrains it to the enum; it
    // cannot know that `shipped` is a lie for a file under refs/. Only this gate
    // sees the path and the claim together, so only this gate can catch it.
    const result = run({ 'refs/ottawa/peace-tower.jpg': JPEG }, [
      credit('refs/ottawa/peace-tower.jpg', { kind: 'shipped' }),
    ]);
    expect(result.status).toBe(1);
    expect(result.output).toContain('expected kind="reference"');
  });

  it('on a credits.json that is missing outright', () => {
    const result = run({ 'refs/ottawa/peace-tower.jpg': JPEG }, null);
    expect(result.status).toBe(1);
    expect(result.output).toContain('assets/credits.json');
  });

  it('on an unrecognised asset type, because the exclusion list is a denylist', () => {
    // The reason this is not an allowlist of known media extensions: the first
    // .riv, .woff2 or .ogg to land would be silently uncredited and the gate
    // would stay green. Unknown means "must be credited".
    const result = run({ 'src/rive/officer.riv': 'RIVE', 'refs/ottawa/x.jpg': JPEG }, [
      credit('refs/ottawa/x.jpg'),
    ]);
    expect(result.status).toBe(1);
    expect(result.output).toContain('assets/src/rive/officer.riv is committed but not credited');
  });
});

describe('the credit gate passes', () => {
  it('when every asset is credited and every credit resolves', () => {
    const result = run(
      {
        'refs/ottawa/peace-tower.jpg': JPEG,
        'src/svg/officer.svg': '<svg/>',
        // Exempt: documentation, placeholders and the named metadata files.
        'refs/README.md': '# refs\n',
        'refs/references.json': '{}\n',
        'style/palette.json': '{}\n',
        'style/art-bible.md': '# art\n',
        'prompts/.gitkeep': '',
      },
      [
        credit('refs/ottawa/peace-tower.jpg', { kind: 'reference' }),
        credit('src/svg/officer.svg', { kind: 'shipped', licence: 'CC-BY-4.0' }),
      ],
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('2 asset file(s) under assets/ credited (1 shipped, 1 reference)');
    // Nothing at all on stderr: the transitional warning that used to fire on
    // every run is gone, and a clean run has nothing left to say there.
    expect(result.stderr).toBe('');
  });

  it('without demanding a credit for generated output under assets/dist/', () => {
    // dist/ is derived from assets/src by `make assets` and its filenames are
    // content-hashed. Crediting derivatives would rewrite credits.json on every
    // build, which is how a register rots. Provenance lives with the source.
    const result = run(
      {
        'src/svg/officer.svg': '<svg/>',
        'dist/atlas/officer.a1b2c3.png': 'PNG',
        'dist/atlas/officer.a1b2c3.json': '{}\n',
      },
      [credit('src/svg/officer.svg', { kind: 'shipped' })],
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('1 asset file(s) under assets/ credited');
  });
});

describe('the credit gate, on this repository as it stands', () => {
  it('sees the assets that are actually committed, whether or not they are all credited yet', () => {
    // The regression this whole change exists for: the same command reported
    // "0 shipped asset(s) credited" against a tree holding fourteen licensed
    // reference photographs. The property asserted is that the gate is NOT in
    // that state - it walked assets/ and found files. The exact count is
    // deliberately not pinned, because art adds references.
    //
    // What is deliberately NOT asserted is that the tree is fully credited.
    // `make validate-content` owns that, fails on it by name, and runs in CI; a
    // second copy here only means an uncredited SVG that art landed five minutes
    // ago turns `make test` red for a reason that has nothing to do with the
    // gate's own behaviour. Both outcomes are checked instead, and neither can
    // be satisfied by a walk that found nothing.
    const result = gate([]);
    if (result.status === 0) {
      const match = /(\d+) asset file\(s\) under assets\/ credited/.exec(result.stdout);
      expect(match).not.toBeNull();
      expect(Number(match?.[1])).toBeGreaterThan(0);
      return;
    }
    // Red: every failure must name a specific file under assets/, which is only
    // possible if the walk saw the tree. The vacuum has its own message and it
    // must not be the reason.
    expect(result.output).not.toContain('found 0 asset file(s) under assets/');
    const named = result.output.split('\n').filter((line) => /assets\/\S+\.\w+/.test(line));
    expect(named.length).toBeGreaterThan(0);
  });
});
