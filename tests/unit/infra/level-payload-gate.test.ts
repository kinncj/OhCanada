/**
 * `budgets.levelPayloadBytes` enforcement: the gate is itself checked.
 *
 * This budget sat in content/game.config.json for the whole of slice 0, required
 * by game.config.schema.json, with no code anywhere reading it. The only other
 * mention was a comment in deploy-check.mjs calling it "a different gate" — a
 * gate that did not exist. It read as enforced because it appeared in the config
 * and the schema. That is worse than the vacuous coverage gate slice 0 removed:
 * that one at least printed a misleading number, and this printed nothing.
 *
 * So every case below drives the real CLI — argv, exit code, stdout, stderr —
 * over a scratch tree, because the exit code is the only part of this script
 * `make assets` consumes. A test that re-implemented the walk would prove the
 * copy agrees with the copy, which is the failure one level up.
 *
 * The four conditions the slice-1 plan names explicitly — a level over budget, a
 * manifest listing a file that does not exist, a file claimed by no level, and
 * an empty manifest — are each proved separately below, and each is proved to
 * fail rather than merely to print something.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../../../scripts/check-level-payload.mjs', import.meta.url));
const WORK = mkdtempSync(join(tmpdir(), 'level-payload-'));

const BUDGET = 8 * 1024 * 1024;

afterAll(() => {
  rmSync(WORK, { recursive: true, force: true });
});

interface Run {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly output: string;
}

interface ManifestFile {
  readonly path: string;
  readonly bytes: number;
  readonly kind?: string;
  readonly scale?: number | null;
  /** The variant group: which files are the same texture at another scale. */
  readonly group?: string;
  readonly levels: readonly string[];
  readonly keys?: readonly string[];
}

interface Manifest {
  readonly version?: unknown;
  readonly outputDirs?: readonly string[];
  /** The device scales the pipeline built for. Without it there is no model. */
  readonly scales?: readonly number[];
  readonly levels?: Record<string, { payloadBytes: number }>;
  readonly files?: readonly ManifestFile[];
}

interface Fixture {
  /** assets/dist-relative path -> byte length of the file written there. */
  readonly disk: Record<string, number>;
  readonly manifest: Manifest | null;
  /** content/levels/<id>.json documents, keyed by id. */
  readonly levelDocs?: Record<string, unknown>;
  readonly budget?: number | null;
}

let caseId = 0;

/**
 * Build a scratch repository root and run the real gate over it.
 *
 * `disk` writes files of an exact size so the recorded bytes in the manifest can
 * be made to agree or disagree on purpose: a gate that trusts the manifest's own
 * numbers is measuring the manifest, not the payload.
 */
function run(fixture: Fixture): Run {
  caseId += 1;
  const root = join(WORK, `case-${caseId}`);
  const dist = join(root, 'assets', 'dist');
  mkdirSync(dist, { recursive: true });
  mkdirSync(join(root, 'content', 'levels'), { recursive: true });

  const budget = fixture.budget === undefined ? BUDGET : fixture.budget;
  writeFileSync(
    join(root, 'content', 'game.config.json'),
    JSON.stringify({
      basePath: '/OhCanada/',
      budgets: budget === null ? {} : { levelPayloadBytes: budget },
    }),
    'utf8',
  );

  for (const [id, doc] of Object.entries(fixture.levelDocs ?? {})) {
    writeFileSync(join(root, 'content', 'levels', `${id}.json`), JSON.stringify(doc), 'utf8');
  }

  for (const [rel, size] of Object.entries(fixture.disk)) {
    const full = join(dist, ...rel.split('/'));
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, Buffer.alloc(size, 0x61));
  }

  if (fixture.manifest !== null) {
    writeFileSync(join(dist, 'manifest.json'), JSON.stringify(fixture.manifest, null, 2), 'utf8');
  }

  const result = spawnSync(process.execPath, [SCRIPT, '--root', root, '--dir', dist], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  return { status: result.status ?? -1, stdout, stderr, output: `${stdout}${stderr}` };
}

/** A manifest describing one level whose single 1x file is `bytes` long. */
const oneLevel = (bytes: number, id = 'ottawa'): Manifest => ({
  version: 2,
  outputDirs: ['atlas', 'img', 'rive'],
  scales: [1, 2],
  levels: { [id]: { payloadBytes: bytes } },
  files: [
    {
      path: `img/${id}-sky@1x.aaaaaaaa.webp`,
      bytes,
      kind: 'image',
      scale: 1,
      group: `img:${id}-sky`,
      levels: [id],
      keys: [`${id}-sky`],
    },
  ],
});

describe('the per-level payload gate fails', () => {
  it('on a level over budgets.levelPayloadBytes', () => {
    const over = BUDGET + 1024;
    const result = run({ disk: { 'img/ottawa-sky@1x.aaaaaaaa.webp': over }, manifest: oneLevel(over) });
    expect(result.status).toBe(1);
    expect(result.output).toContain('level "ottawa" ships 8.00 MiB');
    expect(result.output).toContain(`${over} B`);
    expect(result.output).toContain('the budget is 8.00 MiB');
    expect(result.output).toContain('img/ottawa-sky@1x.aaaaaaaa.webp');
    expect(result.stdout).not.toContain('level-payload: OK');
  });

  it('on a manifest listing a file that does not exist', () => {
    const result = run({
      disk: { 'img/ottawa-sky@1x.aaaaaaaa.webp': 100 },
      manifest: {
        version: 2,
        outputDirs: ['atlas', 'img', 'rive'],
        scales: [1, 2],
        levels: { ottawa: { payloadBytes: 100 } },
        files: [
          { path: 'img/ottawa-sky@1x.aaaaaaaa.webp', bytes: 100, scale: 1, group: 'img:ottawa-sky', levels: ['ottawa'], keys: ['ottawa-sky'] },
          { path: 'img/ottawa-gone@1x.bbbbbbbb.webp', bytes: 4096, scale: 1, group: 'img:ottawa-gone', levels: ['ottawa'], keys: ['ottawa-gone'] },
        ],
      },
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('assets/dist/img/ottawa-gone@1x.bbbbbbbb.webp, which does not exist on disk');
  });

  it('on a file in assets/dist claimed by no level', () => {
    // The other direction. A manifest that simply omits a file would otherwise
    // ship weight no budget ever sees - containment is not enough, the
    // invariant is set equality, the same discipline the credit gate uses.
    const result = run({
      disk: {
        'img/ottawa-sky@1x.aaaaaaaa.webp': 100,
        'img/ottawa-orphan@1x.cccccccc.webp': 5_000_000,
      },
      manifest: oneLevel(100),
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('assets/dist/img/ottawa-orphan@1x.cccccccc.webp is on disk but no level claims it');
  });

  it('on a manifest that maps files to zero levels, rather than passing by vacuum', () => {
    // Exactly the state that let the credit gate pass for a whole slice: found
    // nothing, reported success. "Nothing to measure" is the failure here.
    const result = run({
      disk: {},
      manifest: { version: 2, outputDirs: ['atlas', 'img', 'rive'], scales: [1, 2], levels: {}, files: [] },
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('maps files to 0 level(s)');
    expect(result.output).toContain('Do not read this as "every level is under budget"');
    expect(result.stdout).not.toContain('level-payload: OK');
  });

  it('on a stray file at the root of assets/dist', () => {
    const result = run({
      disk: { 'img/ottawa-sky@1x.aaaaaaaa.webp': 100, 'left-behind.webp': 2048 },
      manifest: oneLevel(100),
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('assets/dist/left-behind.webp is on disk but no level claims it');
  });

  it('when the recorded byte count disagrees with the file on disk', () => {
    // Without this, a level goes under budget by editing a number.
    const result = run({
      disk: { 'img/ottawa-sky@1x.aaaaaaaa.webp': 9_000_000 },
      manifest: oneLevel(1024),
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('records 1024 bytes for assets/dist/img/ottawa-sky@1x.aaaaaaaa.webp, which is 9000000 B on disk');
  });

  it("when the manifest's own arithmetic does not hold", () => {
    const result = run({
      disk: { 'img/ottawa-sky@1x.aaaaaaaa.webp': 4096 },
      manifest: {
        version: 2,
        outputDirs: ['atlas', 'img', 'rive'],
        scales: [1, 2],
        levels: { ottawa: { payloadBytes: 1 } },
        files: [
          { path: 'img/ottawa-sky@1x.aaaaaaaa.webp', bytes: 4096, scale: 1, group: 'img:ottawa-sky', levels: ['ottawa'], keys: ['ottawa-sky'] },
        ],
      },
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain("records payloadBytes 1");
    expect(result.output).toContain("add up to 4096 B");
  });

  it('when the manifest is missing outright', () => {
    const result = run({ disk: { 'img/ottawa-sky@1x.aaaaaaaa.webp': 100 }, manifest: null });
    expect(result.status).toBe(1);
    expect(result.output).toContain('assets/dist/manifest.json is missing');
  });

  it('when the config carries no positive budgets.levelPayloadBytes', () => {
    // A gate that reads a missing budget as "unlimited" is the vacuum with
    // extra steps. game.config.schema.json requires the field, so reaching
    // this state means the config was edited past its schema.
    const result = run({
      disk: { 'img/ottawa-sky@1x.aaaaaaaa.webp': 100 },
      manifest: oneLevel(100),
      budget: null,
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('no positive numeric "budgets.levelPayloadBytes"');
  });

  it('when a level document ships no art at all', () => {
    // This is what stops "zero levels" being satisfiable by deleting sources:
    // a level whose art never got built fails by name.
    const result = run({
      disk: { 'img/ottawa-sky@1x.aaaaaaaa.webp': 100 },
      manifest: oneLevel(100),
      levelDocs: {
        ottawa: { id: 'ottawa', layers: [{ key: 'ottawa-sky' }], pois: [], assets: [] },
        vancouver: { id: 'vancouver', layers: [{ key: 'vancouver-sky' }], pois: [], assets: [] },
      },
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('content/levels/vancouver.json declares level "vancouver"');
    expect(result.output).toContain('the level ships no art at all');
  });

  it('when a level document names an art key nothing produces', () => {
    const result = run({
      disk: { 'img/ottawa-sky@1x.aaaaaaaa.webp': 100 },
      manifest: oneLevel(100),
      levelDocs: {
        ottawa: {
          id: 'ottawa',
          layers: [{ key: 'ottawa-sky' }, { key: 'ottawa-peace-tower' }],
          pois: [{ artKey: 'ottawa-canal' }],
          assets: [],
        },
      },
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('layers[].key "ottawa-peace-tower" is not provided by any file charged to level "ottawa"');
    expect(result.output).toContain('pois[].artKey "ottawa-canal" is not provided');
  });

  it("when a level document's declared assets[] disagree with what shipped", () => {
    const result = run({
      disk: { 'img/ottawa-sky@1x.aaaaaaaa.webp': 100 },
      manifest: oneLevel(100),
      levelDocs: {
        ottawa: {
          id: 'ottawa',
          layers: [{ key: 'ottawa-sky' }],
          pois: [],
          assets: [
            { key: 'ottawa-sky', url: '/OhCanada/img/ottawa-sky@1x.aaaaaaaa.webp', bytes: 999 },
            { key: 'ottawa-ghost', url: 'img/ottawa-ghost@1x.dddddddd.webp', bytes: 10 },
          ],
        },
      },
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('declares 999 B for "/OhCanada/img/ottawa-sky@1x.aaaaaaaa.webp", which is 100 B on disk');
    expect(result.output).toContain('which the manifest does not list');
  });
});

describe('the per-level payload gate passes', () => {
  it('and reports the real numbers per level, not "OK"', () => {
    const result = run({
      disk: {
        'atlas/ottawa@1x.aaaaaaaa.webp': 400_000,
        'atlas/ottawa@2x.bbbbbbbb.webp': 1_500_000,
        'img/shared-hud@1x.cccccccc.webp': 100_000,
        'img/shared-hud@2x.dddddddd.webp': 300_000,
        'rive/ottawa-officer.eeeeeeee.riv': 50_000,
      },
      manifest: {
        version: 2,
        outputDirs: ['atlas', 'img', 'rive'],
        scales: [1, 2],
        // 1x = 500_000, 2x = 1_800_000, scale-independent = 50_000.
        levels: { ottawa: { payloadBytes: 1_850_000 } },
        files: [
          { path: 'atlas/ottawa@1x.aaaaaaaa.webp', bytes: 400_000, scale: 1, group: 'atlas:ottawa:0', levels: ['ottawa'], keys: ['ottawa-sky'] },
          { path: 'atlas/ottawa@2x.bbbbbbbb.webp', bytes: 1_500_000, scale: 2, group: 'atlas:ottawa:0', levels: ['ottawa'], keys: ['ottawa-sky'] },
          { path: 'img/shared-hud@1x.cccccccc.webp', bytes: 100_000, scale: 1, group: 'img:hud', levels: ['ottawa'], keys: ['hud'] },
          { path: 'img/shared-hud@2x.dddddddd.webp', bytes: 300_000, scale: 2, group: 'img:hud', levels: ['ottawa'], keys: ['hud'] },
          { path: 'rive/ottawa-officer.eeeeeeee.riv', bytes: 50_000, scale: null, group: 'rive:ottawa-officer', levels: ['ottawa'], keys: ['ottawa-officer'] },
        ],
      },
      levelDocs: { ottawa: { id: 'ottawa', layers: [{ key: 'ottawa-sky' }, { key: 'hud' }], pois: [], assets: [] } },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('1 level(s) against 8.00 MiB each');
    expect(result.stdout).toContain(
      'ottawa 1.76 MiB over 5 file(s) [1x device 0.52 MiB / 2x device 1.76 MiB, incl. 0.05 MiB scale-independent]',
    );
    expect(result.stdout).toContain('5 file(s) in assets/dist, all claimed');
    expect(result.stderr).toBe('');
  });

  it('without charging a device for both 1x and 2x, which it never downloads together', () => {
    // 5 MiB at each scale is 10 MiB summed and 5 MiB actually fetched. Summing
    // would make an 8 MiB budget silently mean 4, so the rule is one variant per
    // group, and this case is the one that tells the two apart.
    const perScale = 5 * 1024 * 1024;
    const result = run({
      disk: {
        'img/ottawa-sky@1x.aaaaaaaa.webp': perScale,
        'img/ottawa-sky@2x.bbbbbbbb.webp': perScale,
      },
      manifest: {
        version: 2,
        outputDirs: ['atlas', 'img', 'rive'],
        scales: [1, 2],
        levels: { ottawa: { payloadBytes: perScale } },
        files: [
          { path: 'img/ottawa-sky@1x.aaaaaaaa.webp', bytes: perScale, scale: 1, group: 'img:ottawa-sky', levels: ['ottawa'], keys: ['ottawa-sky'] },
          { path: 'img/ottawa-sky@2x.bbbbbbbb.webp', bytes: perScale, scale: 2, group: 'img:ottawa-sky', levels: ['ottawa'], keys: ['ottawa-sky'] },
        ],
      },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('ottawa 5.00 MiB');
  });

  it('and counts a 1x-only layer alongside 2x props, which no per-scale bucket does', () => {
    // Full-screen parallax layers ship at 1x only (owner's decision, slice 1),
    // so a 2x device downloads the 2x props AND the 1x layer - there is no 2x
    // layer to download. The old rule, "the worst single scale", put 6 MiB of
    // layer in the 1x bucket and 2 MiB of prop in the 2x bucket and called the
    // level 6 MiB. It is 8 MiB, and this 8 MiB budget is exactly held.
    const layer = 6 * 1024 * 1024;
    const prop1x = 1024 * 1024;
    const prop2x = 2 * 1024 * 1024;
    const result = run({
      disk: {
        'img/ottawa-sky@1x.aaaaaaaa.webp': layer,
        'img/ottawa-bench@1x.bbbbbbbb.webp': prop1x,
        'img/ottawa-bench@2x.cccccccc.webp': prop2x,
      },
      manifest: {
        version: 2,
        outputDirs: ['atlas', 'img', 'rive'],
        scales: [1, 2],
        levels: { ottawa: { payloadBytes: layer + prop2x } },
        files: [
          { path: 'img/ottawa-sky@1x.aaaaaaaa.webp', bytes: layer, scale: 1, group: 'img:ottawa-sky', levels: ['ottawa'], keys: ['ottawa-sky'] },
          { path: 'img/ottawa-bench@1x.bbbbbbbb.webp', bytes: prop1x, scale: 1, group: 'img:ottawa-bench', levels: ['ottawa'], keys: ['ottawa-bench'] },
          { path: 'img/ottawa-bench@2x.cccccccc.webp', bytes: prop2x, scale: 2, group: 'img:ottawa-bench', levels: ['ottawa'], keys: ['ottawa-bench'] },
        ],
      },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('ottawa 8.00 MiB over 3 file(s) [1x device 7.00 MiB / 2x device 8.00 MiB]');
  });

  it('and charges a shared file to every level that downloads it', () => {
    // 6 MiB shared plus 3 MiB of its own puts ottawa over 8 MiB while vancouver
    // stays under. A shared asset that were charged once, to nobody in
    // particular, would hide exactly this.
    const shared = 6 * 1024 * 1024;
    const own = 3 * 1024 * 1024;
    const result = run({
      disk: {
        'img/hud@1x.aaaaaaaa.webp': shared,
        'img/ottawa-sky@1x.bbbbbbbb.webp': own,
      },
      manifest: {
        version: 2,
        outputDirs: ['atlas', 'img', 'rive'],
        scales: [1, 2],
        levels: { ottawa: { payloadBytes: shared + own }, vancouver: { payloadBytes: shared } },
        files: [
          { path: 'img/hud@1x.aaaaaaaa.webp', bytes: shared, scale: 1, group: 'img:hud', levels: ['ottawa', 'vancouver'], keys: ['hud'] },
          { path: 'img/ottawa-sky@1x.bbbbbbbb.webp', bytes: own, scale: 1, group: 'img:ottawa-sky', levels: ['ottawa'], keys: ['ottawa-sky'] },
        ],
      },
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('level "ottawa" ships 9.00 MiB');
    expect(result.output).toContain('1048576 B over');
    expect(result.output).not.toContain('level "vancouver" ships');
  });
});
