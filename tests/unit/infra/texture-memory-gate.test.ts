/**
 * The decoded-texture budget: the gate is itself checked.
 *
 * This is the budget whose breach is invisible until a device dies. The previous
 * incarnation of this project shipped roughly 190 textures, lost the WebGL
 * context around 538 MB of decoded texture memory, and did it on an iPhone that
 * had reported every capability as available. Transfer payload was never the
 * problem: what a GPU holds is width x height x 4, not what libwebp compressed
 * it to. It was found by a user rather than by us.
 *
 * `textureBudgetBytes` has been *required* by level.schema.json since slice 0
 * and until this gate landed nothing read it against reality — the runtime's own
 * refusal (level-document.ts `refuseOverBudget`) sums the level document's
 * `assets[]`, which is `[]` in ottawa.json, so it sums 0 and cannot fire.
 *
 * Every case below drives the real CLI — argv, exit code, stdout, stderr — over
 * a scratch tree, and every texture in that tree is a REAL WebP written by
 * sharp, because the gate re-reads pixel dimensions out of the file header and a
 * fixture of zero bytes would prove nothing about that. A test that
 * re-implemented the sums would prove the copy agrees with the copy.
 *
 * The five conditions named when this task was set are each proved separately:
 * a level over budget, a level declaring a budget looser than the global cap, a
 * full-screen layer shipping a 2x variant, an empty manifest, and a
 * `decodedBytes` that disagrees with the file's real dimensions.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../../../scripts/check-texture-memory.mjs', import.meta.url));
const WORK = mkdtempSync(join(tmpdir(), 'texture-memory-'));

/** CLAUDE.md, Budgets: decoded texture memory <= 64 MB per level on iPhone. */
const GLOBAL_CAP = 67_108_864;
const MIB = 1024 * 1024;

afterAll(() => {
  rmSync(WORK, { recursive: true, force: true });
});

interface Run {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly output: string;
  /** The scratch repository root, so a case can mutate it and run again. */
  readonly root: string;
  readonly dist: string;
}

/**
 * A file to write and to describe in the manifest.
 *
 * `pixels` writes a real WebP of exactly those dimensions and derives
 * width/height/decodedBytes from them. The `*Override` fields are how a case
 * makes the manifest LIE about a file that exists: that is the only way to prove
 * the gate re-derives the number rather than reading it.
 */
interface FixtureFile {
  readonly path: string;
  readonly kind?: string;
  readonly role?: string;
  readonly group?: string;
  readonly scalePin?: number | null;
  readonly scale?: number | null;
  readonly keys?: readonly string[];
  readonly levels?: readonly string[];
  readonly pixels?: { readonly w: number; readonly h: number };
  readonly widthOverride?: number;
  readonly heightOverride?: number;
  readonly decodedOverride?: number | null;
  /** Drop `decodedBytes` from the entry entirely, as a version-1 manifest does. */
  readonly omitDecoded?: boolean;
  readonly omitGroup?: boolean;
}

interface LevelDoc {
  readonly layers?: readonly string[];
  readonly pois?: readonly string[];
  readonly textureBudgetBytes?: number | string | null;
  readonly omitBudget?: boolean;
  readonly assets?: readonly { key: string; url: string; bytes?: number; decodedBytes?: number }[];
  /** How many characters[] entries to place. Omitted means no `characters` field at all. */
  readonly characters?: number;
}

interface Fixture {
  readonly files: readonly FixtureFile[];
  /** Level id -> its document. A level named here is also named in the manifest. */
  readonly levels: Record<string, LevelDoc>;
  /** Override the manifest wholesale (version, scales, levels arithmetic). */
  readonly manifest?: Record<string, unknown>;
  readonly manifestLevels?: Record<string, unknown>;
  readonly version?: unknown;
  readonly scales?: readonly number[] | null;
  /** Repository-relative path -> rig document contents, written as JSON. */
  readonly rigs?: Record<string, unknown>;
}

/** A rig document carrying only the part the gate reads: the artboard. */
const rigDoc = (width: number, height: number): Record<string, unknown> => ({
  characterSpace: { width, height, heightPx: height - 50 },
});

let caseId = 0;

/** decodedBytes for a texture: RGBA8888, the format Phaser uploads. */
const decoded = (w: number, h: number): number => w * h * 4;

/**
 * Build a scratch repository — real WebP files, level documents, a manifest —
 * and run the real gate over it.
 */
async function run(fixture: Fixture): Promise<Run> {
  caseId += 1;
  const root = join(WORK, `case-${caseId}`);
  const dist = join(root, 'assets', 'dist');
  mkdirSync(dist, { recursive: true });
  mkdirSync(join(root, 'content', 'levels'), { recursive: true });
  writeFileSync(
    join(root, 'content', 'game.config.json'),
    JSON.stringify({ basePath: '/OhCanada/', budgets: { levelPayloadBytes: 8 * MIB } }),
    'utf8',
  );

  for (const [id, doc] of Object.entries(fixture.levels)) {
    const document: Record<string, unknown> = {
      id,
      layers: (doc.layers ?? []).map((key) => ({ key })),
      pois: (doc.pois ?? []).map((artKey) => ({ artKey })),
      assets: doc.assets ?? [],
    };
    if (doc.omitBudget !== true) document.textureBudgetBytes = doc.textureBudgetBytes ?? 8 * MIB;
    if (doc.characters !== undefined) {
      document.characters = Array.from({ length: doc.characters }, (_, i) => ({
        characterId: `npc-${i}`,
        position: { x: 100 * i, y: 0 },
        facing: 'left',
      }));
    }
    writeFileSync(join(root, 'content', 'levels', `${id}.json`), JSON.stringify(document), 'utf8');
  }

  for (const [rel, contents] of Object.entries(fixture.rigs ?? {})) {
    const full = join(root, ...rel.split('/'));
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, JSON.stringify(contents), 'utf8');
  }

  const entries: Record<string, unknown>[] = [];
  for (const file of fixture.files) {
    const full = join(dist, ...file.path.split('/'));
    mkdirSync(dirname(full), { recursive: true });

    const entry: Record<string, unknown> = {
      path: file.path,
      bytes: 0,
      kind: file.kind ?? 'image',
      role: file.role ?? 'sprite',
      scale: file.scale === undefined ? 1 : file.scale,
      levels: file.levels ?? Object.keys(fixture.levels),
      keys: file.keys ?? [],
    };
    if (file.scalePin !== undefined) entry.scalePin = file.scalePin;
    if (file.omitGroup !== true) entry.group = file.group ?? `img:${file.path}`;

    if (file.pixels !== undefined) {
      // A real image, not a placeholder: the gate parses the file's own header,
      // so a fixture full of 0x61 would fail for the wrong reason.
      await sharp({
        create: { width: file.pixels.w, height: file.pixels.h, channels: 4, background: '#3d8ccb' },
      })
        .webp({ lossless: true })
        .toFile(full);
      entry.width = file.widthOverride ?? file.pixels.w;
      entry.height = file.heightOverride ?? file.pixels.h;
      if (file.omitDecoded !== true) {
        entry.decodedBytes =
          file.decodedOverride === undefined ? decoded(file.pixels.w, file.pixels.h) : file.decodedOverride;
      }
    } else {
      writeFileSync(full, '{}', 'utf8');
      if (file.omitDecoded !== true) entry.decodedBytes = file.decodedOverride ?? 0;
    }
    entries.push(entry);
  }

  const manifestLevels: Record<string, unknown> = {};
  for (const id of Object.keys(fixture.levels)) {
    const own = entries.filter((e) => (e.levels as string[]).includes(id));
    // The manifest's own arithmetic, computed the way the pipeline computes it,
    // so that a case which does not care about it does not trip over it.
    const groups = new Map<string, Record<string, unknown>[]>();
    let independent = 0;
    for (const e of own) {
      if (e.scale === null) {
        independent += (e.decodedBytes as number | undefined) ?? 0;
        continue;
      }
      const key = (e.group as string | undefined) ?? (e.path as string);
      if (!groups.has(key)) groups.set(key, []);
      (groups.get(key) as Record<string, unknown>[]).push(e);
    }
    const scales = fixture.scales === undefined ? [1, 2] : (fixture.scales ?? []);
    const totals = scales.map((scale) => {
      let total = independent;
      for (const [, variants] of groups) {
        const exact = variants.find((v) => v.scale === scale);
        const below = variants.filter((v) => (v.scale as number) < scale).sort((a, b) => (b.scale as number) - (a.scale as number))[0];
        const above = variants.filter((v) => (v.scale as number) > scale).sort((a, b) => (a.scale as number) - (b.scale as number))[0];
        const chosen = exact ?? below ?? above;
        total += ((chosen?.decodedBytes as number | undefined) ?? 0);
      }
      return total;
    });
    manifestLevels[id] = { payloadBytes: 0, decodedTextureBytes: Math.max(0, ...totals) };
  }

  const manifest = {
    version: fixture.version === undefined ? 2 : fixture.version,
    outputDirs: ['atlas', 'img', 'rive'],
    ...(fixture.scales === null ? {} : { scales: fixture.scales ?? [1, 2] }),
    levels: fixture.manifestLevels ?? manifestLevels,
    files: entries,
    ...(fixture.manifest ?? {}),
  };
  writeFileSync(join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  const result = spawnSync(process.execPath, [SCRIPT, '--root', root, '--dir', dist], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  return { status: result.status ?? -1, stdout, stderr, output: `${stdout}${stderr}`, root, dist };
}

/** One level, one 1x layer and one 2x-and-1x prop: the shape of a real level. */
const wholesome = (budget = 8 * MIB): Fixture => ({
  levels: { ottawa: { layers: ['ottawa-sky'], pois: ['ottawa-parliament'], textureBudgetBytes: budget } },
  files: [
    {
      path: 'img/ottawa-sky@1x.aaaaaaaa.webp',
      role: 'layer',
      group: 'img:ottawa-sky',
      scale: 1,
      keys: ['ottawa-sky'],
      pixels: { w: 540, h: 960 },
    },
    {
      path: 'img/ottawa-parliament@1x.bbbbbbbb.webp',
      group: 'img:ottawa-parliament',
      scale: 1,
      keys: ['ottawa-parliament'],
      pixels: { w: 200, h: 300 },
    },
    {
      path: 'img/ottawa-parliament@2x.cccccccc.webp',
      group: 'img:ottawa-parliament',
      scale: 2,
      keys: ['ottawa-parliament'],
      pixels: { w: 400, h: 600 },
    },
  ],
});

describe('the decoded-texture gate fails', () => {
  it('on a level over its textureBudgetBytes, and says it is VRAM and not download', async () => {
    // 1024x1024 is 4 MiB decoded and about 5 kB on the wire. That gap is the
    // entire reason this gate exists next to the payload one.
    const result = await run({
      levels: { ottawa: { layers: ['ottawa-sky'], textureBudgetBytes: 1 * MIB } },
      files: [
        {
          path: 'img/ottawa-sky@1x.aaaaaaaa.webp',
          role: 'layer',
          group: 'img:ottawa-sky',
          scale: 1,
          keys: ['ottawa-sky'],
          pixels: { w: 1024, h: 1024 },
        },
      ],
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('level "ottawa" holds 4.00 MiB (4194304 B) of decoded texture memory');
    expect(result.output).toContain('the budget is 1.00 MiB (1048576 B, from content/levels/ottawa.json)');
    expect(result.output).toContain('3145728 B over');
    expect(result.output).toContain('img/ottawa-sky@1x.aaaaaaaa.webp 1024x1024 4.00 MiB');
    expect(result.output).toContain('This is VRAM, not download');
    expect(result.stdout).not.toContain('texture-memory: OK');
  });

  it('on a level that declares itself LOOSER than the 64 MiB global cap', async () => {
    // A level may declare itself stricter than CLAUDE.md; it may not declare
    // itself looser. level.schema.json also caps the field, but this gate must
    // not depend on validate-content having run first: two gates, one rule.
    const result = await run({
      levels: { ottawa: { layers: ['ottawa-sky'], textureBudgetBytes: GLOBAL_CAP + 1 } },
      files: [
        {
          path: 'img/ottawa-sky@1x.aaaaaaaa.webp',
          role: 'layer',
          group: 'img:ottawa-sky',
          scale: 1,
          keys: ['ottawa-sky'],
          pixels: { w: 64, h: 64 },
        },
      ],
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('declares textureBudgetBytes 67108865');
    expect(result.output).toContain('over the 67108864 B (64.00 MiB) per-level ceiling in CLAUDE.md');
    expect(result.output).toContain('it may not declare itself looser');
  });

  it('on a full-screen parallax layer that ships a 2x variant', async () => {
    // The decision this gate enforces. `layer-10-sky@2x` was 2160x3840 = 31.6
    // MiB decoded on its own - a whole budget in one sky the player moves past.
    const result = await run({
      levels: { ottawa: { layers: ['ottawa-sky'], textureBudgetBytes: 64 * MIB } },
      files: [
        {
          path: 'img/ottawa-sky@1x.aaaaaaaa.webp',
          role: 'layer',
          group: 'img:ottawa-sky',
          scale: 1,
          keys: ['ottawa-sky'],
          pixels: { w: 540, h: 960 },
        },
        {
          path: 'img/ottawa-sky@2x.bbbbbbbb.webp',
          role: 'layer',
          group: 'img:ottawa-sky',
          scale: 2,
          keys: ['ottawa-sky'],
          pixels: { w: 1080, h: 1920 },
        },
      ],
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain(
      'img/ottawa-sky@2x.bbbbbbbb.webp is a full-screen parallax layer shipped at 2x (1080x1920 px = 7.91 MiB decoded)',
    );
    expect(result.output).toContain('Full-screen layers ship at 1x only');
    expect(result.output).toContain('At 1x this texture costs 1.98 MiB');
    expect(result.output).toContain('ends in a lost WebGL context');
  });

  it('when the manifest calls a declared layer a sprite, so the 1x rule has nothing to bite on', async () => {
    // Full-screen is defined by content/levels/, not by a label in the manifest.
    // Without this, the rule is dodged by editing one string.
    const result = await run({
      levels: { ottawa: { layers: ['ottawa-sky'], textureBudgetBytes: 64 * MIB } },
      files: [
        {
          path: 'img/ottawa-sky@2x.bbbbbbbb.webp',
          role: 'sprite',
          group: 'img:ottawa-sky',
          scale: 2,
          keys: ['ottawa-sky'],
          pixels: { w: 1080, h: 1920 },
        },
      ],
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('content/levels/ draws as a full-screen parallax layer');
    expect(result.output).toContain('the manifest records role "sprite"');
    expect(result.output).toContain('a mislabelled layer is a layer with no rule');
  });

  it('when a file ships above the scalePin its source asked for', async () => {
    // OQ-LEVEL-ART-1's rule, checked. A pin can only ever remove a variant, so a
    // manifest that forgot one costs memory rather than hiding it -- but a pin
    // that is RECORDED and then contradicted reads as a saving that never
    // happened, and that is a pipeline bug worth failing on.
    const result = await run({
      levels: { ottawa: { pois: ['ottawa-landmark'], textureBudgetBytes: 64 * MIB } },
      files: [
        {
          path: 'img/ottawa-landmark@2x.aaaaaaaa.webp',
          group: 'img:ottawa-landmark',
          scale: 2,
          scalePin: 1,
          keys: ['ottawa-landmark'],
          pixels: { w: 1024, h: 1024 },
        },
      ],
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('records scalePin 1 but ships at 2x');
    expect(result.output).toContain('The source asked to be capped and was not');
  });

  it('when an atlas page carries a scalePin, which cannot describe one frame', async () => {
    const result = await run({
      levels: { ottawa: { pois: ['ottawa-bench'], textureBudgetBytes: 64 * MIB } },
      files: [
        {
          path: 'atlas/ottawa@1x.aaaaaaaa.webp',
          kind: 'atlas',
          group: 'atlas:ottawa:0',
          scale: 1,
          scalePin: 1,
          keys: ['ottawa-bench'],
          pixels: { w: 256, h: 256 },
        },
      ],
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('is an atlas page carrying a scalePin');
  });

  it('when a file claims role "layer" for a key no level document draws as one', async () => {
    const result = await run({
      levels: { ottawa: { pois: ['ottawa-parliament'], textureBudgetBytes: 8 * MIB } },
      files: [
        {
          path: 'img/ottawa-parliament@1x.aaaaaaaa.webp',
          role: 'layer',
          group: 'img:ottawa-parliament',
          scale: 1,
          keys: ['ottawa-parliament'],
          pixels: { w: 200, h: 300 },
        },
      ],
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('records role "layer" but none of its keys ("ottawa-parliament")');
    expect(result.output).toContain('Full-screen is defined by content/levels/, not by the manifest');
  });

  it('on a manifest that maps files to zero levels, rather than passing by vacuum', async () => {
    const result = await run({ levels: {}, files: [], manifestLevels: {} });
    expect(result.status).toBe(1);
    expect(result.output).toContain('maps files to 0 level(s)');
    expect(result.output).toContain('Do not read this as "every level fits in texture memory"');
    expect(result.stdout).not.toContain('texture-memory: OK');
  });

  it('when decodedBytes disagrees with the pixels in the file on disk', async () => {
    // The number is re-derived from the file's own header by this gate's own
    // reader, not asked of the library that wrote it. Without this, a level goes
    // under budget by editing a number.
    const result = await run({
      levels: { ottawa: { layers: ['ottawa-sky'], textureBudgetBytes: 1 * MIB } },
      files: [
        {
          path: 'img/ottawa-sky@1x.aaaaaaaa.webp',
          role: 'layer',
          group: 'img:ottawa-sky',
          scale: 1,
          keys: ['ottawa-sky'],
          pixels: { w: 1024, h: 1024 },
          decodedOverride: 1024,
        },
      ],
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('records 1024 decodedBytes for assets/dist/img/ottawa-sky@1x.aaaaaaaa.webp');
    expect(result.output).toContain('1024x1024 px at 4 B/px is 4194304 B (4.00 MiB)');
    expect(result.output).toContain('a number a level goes under budget by editing');
  });

  it('when the recorded pixel dimensions disagree with the file on disk', async () => {
    const result = await run({
      levels: { ottawa: { layers: ['ottawa-sky'], textureBudgetBytes: 8 * MIB } },
      files: [
        {
          path: 'img/ottawa-sky@1x.aaaaaaaa.webp',
          role: 'layer',
          group: 'img:ottawa-sky',
          scale: 1,
          keys: ['ottawa-sky'],
          pixels: { w: 512, h: 512 },
          widthOverride: 64,
          heightOverride: 64,
          decodedOverride: 64 * 64 * 4,
        },
      ],
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('records 64x64 px for assets/dist/img/ottawa-sky@1x.aaaaaaaa.webp');
    expect(result.output).toContain("which is 512x512 px in the file's own header (webp/lossless)");
  });

  it('when a file carries no decodedBytes at all, rather than summing to nothing', async () => {
    // The second half of the anti-vacuum floor. A manifest that omits the field
    // sums to 0 and fits every budget ever written.
    const result = await run({
      levels: { ottawa: { layers: ['ottawa-sky'], textureBudgetBytes: 8 * MIB } },
      files: [
        {
          path: 'img/ottawa-sky@1x.aaaaaaaa.webp',
          role: 'layer',
          group: 'img:ottawa-sky',
          scale: 1,
          keys: ['ottawa-sky'],
          pixels: { w: 512, h: 512 },
          omitDecoded: true,
        },
      ],
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('records undefined for "decodedBytes"');
    expect(result.output).toContain('a missing number sums to nothing and passes every texture budget there is');
  });

  it('on a version-1 manifest, which is exactly the manifest that has no decodedBytes', async () => {
    const result = await run({ ...wholesome(), version: 1 });
    expect(result.status).toBe(1);
    expect(result.output).toContain('declares version 1; this gate understands version 2 only');
  });

  it('when a level holds no texture at all', async () => {
    // A level with no art fits every budget. It is not "under budget".
    const result = await run({
      levels: { ottawa: { textureBudgetBytes: 8 * MIB } },
      files: [
        { path: 'atlas/ottawa@1x.aaaaaaaa.json', kind: 'atlas-data', group: 'atlas-data:ottawa:0', scale: 1, keys: [] },
      ],
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('level "ottawa" resolves to 0 B of decoded texture memory across 1 file(s)');
    expect(result.output).toContain('Do not read this as "under budget"');
  });

  it('when a level document declares no textureBudgetBytes', async () => {
    const result = await run({
      levels: { ottawa: { layers: ['ottawa-sky'], omitBudget: true } },
      files: [
        {
          path: 'img/ottawa-sky@1x.aaaaaaaa.webp',
          role: 'layer',
          group: 'img:ottawa-sky',
          scale: 1,
          keys: ['ottawa-sky'],
          pixels: { w: 64, h: 64 },
        },
      ],
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('declares textureBudgetBytes undefined; it must be a positive integer');
    expect(result.output).toContain('a missing budget read as "unlimited" is the vacuum with extra steps');
  });

  it("when the manifest's own decoded arithmetic does not hold", async () => {
    const result = await run({
      ...wholesome(),
      manifestLevels: { ottawa: { payloadBytes: 0, decodedTextureBytes: 1 } },
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('records decodedTextureBytes 1');
    expect(result.output).toContain("The manifest's own arithmetic does not hold");
  });

  it("when a level document's assets[] understates a texture the loader will refuse on", async () => {
    // level-document.ts refuseOverBudget sums the DOCUMENT. If the document and
    // the manifest disagree, the runtime check is a check on fiction.
    const result = await run({
      levels: {
        ottawa: {
          layers: ['ottawa-sky'],
          textureBudgetBytes: 8 * MIB,
          assets: [
            {
              key: 'ottawa-sky',
              url: '/OhCanada/img/ottawa-sky@1x.aaaaaaaa.webp',
              bytes: 10,
              decodedBytes: 4096,
            },
          ],
        },
      },
      files: [
        {
          path: 'img/ottawa-sky@1x.aaaaaaaa.webp',
          role: 'layer',
          group: 'img:ottawa-sky',
          scale: 1,
          keys: ['ottawa-sky'],
          pixels: { w: 512, h: 512 },
        },
      ],
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('assets[0] declares 4096 decoded bytes');
    expect(result.output).toContain('which is 1048576 B on disk');
    expect(result.output).toContain('a runtime check that cannot fire');
  });

  it('when a file carries no variant group, so nobody can say what a device loads', async () => {
    const result = await run({
      levels: { ottawa: { layers: ['ottawa-sky'], textureBudgetBytes: 8 * MIB } },
      files: [
        {
          path: 'img/ottawa-sky@1x.aaaaaaaa.webp',
          role: 'layer',
          scale: 1,
          keys: ['ottawa-sky'],
          pixels: { w: 64, h: 64 },
          omitGroup: true,
        },
      ],
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('has no "group"');
  });

  it('when two files claim the same group at the same scale', async () => {
    const result = await run({
      levels: { ottawa: { layers: ['ottawa-sky'], textureBudgetBytes: 8 * MIB } },
      files: [
        {
          path: 'img/ottawa-sky@1x.aaaaaaaa.webp',
          role: 'layer',
          group: 'img:ottawa-sky',
          scale: 1,
          keys: ['ottawa-sky'],
          pixels: { w: 64, h: 64 },
        },
        {
          path: 'img/ottawa-sky@1x.bbbbbbbb.webp',
          role: 'layer',
          group: 'img:ottawa-sky',
          scale: 1,
          keys: ['ottawa-sky'],
          pixels: { w: 64, h: 64 },
        },
      ],
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('has two files at 1x');
  });

  it('when the manifest is missing outright', async () => {
    const result = await run(wholesome());
    expect(result.status).toBe(0);
    // ...and now the same tree without it.
    rmSync(join(result.dist, 'manifest.json'));
    const again = spawnSync(process.execPath, [SCRIPT, '--root', result.root, '--dir', result.dist], {
      encoding: 'utf8',
    });
    expect(again.status).toBe(1);
    expect(`${again.stdout}${again.stderr}`).toContain('assets/dist/manifest.json is missing');
  });
});

describe('the decoded-texture gate passes', () => {
  it('and prints the real number against both budgets, not "OK"', async () => {
    const result = await run(wholesome());
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    // 540x960 layer = 1.98 MiB, 400x600 prop at 2x = 0.92 MiB.
    expect(result.stdout).toContain('ottawa 2.89 MiB of 8.00 MiB');
    expect(result.stdout).toContain('budget from content/levels/ottawa.json');
    expect(result.stdout).toContain('1x device 2.21 MiB / 2x device 2.89 MiB');
    expect(result.stdout).toContain('1 full-screen layer file(s), all at 1x; 0 source-pinned to 1x');
    expect(result.stdout).toContain('3 file(s) measured from their own headers at 4 B/px');
    // The concentration, on a GREEN run: 1.98 MiB of an 8 MiB budget. The gate
    // that only spoke when the total was breached let one asset become 37% of a
    // level unremarked (OQ-LEVEL-ART-1).
    expect(result.stdout).toContain('heaviest img/ottawa-sky@1x.aaaaaaaa.webp 540x960 1.98 MiB = 25% of budget');
  });

  it('and holds a level to the 64 MiB cap when its own budget is looser than its art', async () => {
    // The budget printed is the LOWER of the two, and it says which one it is.
    const result = await run({
      levels: { ottawa: { layers: ['ottawa-sky'], textureBudgetBytes: GLOBAL_CAP } },
      files: [
        {
          path: 'img/ottawa-sky@1x.aaaaaaaa.webp',
          role: 'layer',
          group: 'img:ottawa-sky',
          scale: 1,
          keys: ['ottawa-sky'],
          pixels: { w: 1024, h: 1024 },
        },
      ],
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('ottawa 4.00 MiB of 64.00 MiB');
    expect(result.stdout).toContain('budget from CLAUDE.md');
  });

  it('and counts what a 2x device really holds: 2x props AND 1x layers together', async () => {
    // The case that tells this model apart from bucketing by scale. Under the
    // old "worst single scale" rule the 2x bucket would hold only the prop and
    // the 24 MiB of layers would vanish from the number - which is most of a
    // real level, and exactly the sum that has to be right.
    const result = await run({
      levels: { ottawa: { layers: ['ottawa-sky'], pois: ['ottawa-parliament'], textureBudgetBytes: 64 * MIB } },
      files: [
        {
          path: 'img/ottawa-sky@1x.aaaaaaaa.webp',
          role: 'layer',
          group: 'img:ottawa-sky',
          scale: 1,
          keys: ['ottawa-sky'],
          pixels: { w: 2048, h: 1024 }, // 8 MiB
        },
        {
          path: 'img/ottawa-parliament@1x.bbbbbbbb.webp',
          group: 'img:ottawa-parliament',
          scale: 1,
          keys: ['ottawa-parliament'],
          pixels: { w: 512, h: 512 }, // 1 MiB
        },
        {
          path: 'img/ottawa-parliament@2x.cccccccc.webp',
          group: 'img:ottawa-parliament',
          scale: 2,
          keys: ['ottawa-parliament'],
          pixels: { w: 1024, h: 1024 }, // 4 MiB
        },
      ],
    });
    expect(result.status).toBe(0);
    // 1x device: 8 + 1 = 9 MiB. 2x device: 8 (the only sky there is) + 4 = 12 MiB.
    expect(result.stdout).toContain('1x device 9.00 MiB / 2x device 12.00 MiB');
    expect(result.stdout).toContain('ottawa 12.00 MiB of 64.00 MiB');
  });

  it('and charges shared art to every level that holds it', async () => {
    // 5 MiB of shared art plus 1 MiB of its own puts ottawa over a 5 MiB budget
    // while vancouver, with the same shared art, stays under a 6 MiB one.
    const result = await run({
      levels: {
        ottawa: { pois: ['ottawa-bench'], textureBudgetBytes: 5 * MIB },
        vancouver: { textureBudgetBytes: 6 * MIB },
      },
      files: [
        {
          path: 'img/hud@1x.aaaaaaaa.webp',
          group: 'img:hud',
          scale: 1,
          keys: ['hud'],
          levels: ['ottawa', 'vancouver'],
          pixels: { w: 1024, h: 1280 }, // 5 MiB
        },
        {
          path: 'img/ottawa-bench@1x.bbbbbbbb.webp',
          group: 'img:ottawa-bench',
          scale: 1,
          keys: ['ottawa-bench'],
          levels: ['ottawa'],
          pixels: { w: 512, h: 512 }, // 1 MiB
        },
      ],
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('level "ottawa" holds 6.00 MiB');
    expect(result.output).toContain('1048576 B over');
    expect(result.output).not.toContain('level "vancouver" holds');
  });

  it('and honours a scalePin that was honoured, counting only the 1x variant', async () => {
    const result = await run({
      levels: { ottawa: { pois: ['ottawa-landmark'], textureBudgetBytes: 64 * MIB } },
      files: [
        {
          path: 'img/ottawa-landmark@1x.aaaaaaaa.webp',
          group: 'img:ottawa-landmark',
          scale: 1,
          scalePin: 1,
          keys: ['ottawa-landmark'],
          pixels: { w: 1024, h: 1024 },
        },
      ],
    });
    expect(result.status).toBe(0);
    // 4 MiB at both device scales: with no 2x variant to resolve to, a 2x device
    // holds the 1x art, which is the entire point of the pin.
    expect(result.stdout).toContain('1x device 4.00 MiB / 2x device 4.00 MiB');
    expect(result.stdout).toContain('0 full-screen layer file(s), all at 1x; 1 source-pinned to 1x');
  });

  it('says out loud that it cannot see character surfaces, EVEN WITH NO RIVE FILES', async () => {
    // The sharpest instance of "this number is a floor", and a correction to
    // what I first wrote: the caveat used to print only when the manifest held a
    // `.riv`. assets/src/rive/ is empty and the surfaces exist anyway -
    // ICharacterRenderer allocates them at runtime - so the sentence vanished in
    // exactly the case where the number is most misleading. Both fixtures below
    // are the no-Rive case, on purpose.
    const result = await run({
      levels: { ottawa: { pois: ['ottawa-bench'], textureBudgetBytes: 8 * MIB } },
      files: [
        {
          path: 'img/ottawa-bench@1x.aaaaaaaa.webp',
          group: 'img:ottawa-bench',
          scale: 1,
          keys: ['ottawa-bench'],
          pixels: { w: 256, h: 256 },
        },
      ],
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('EXCLUDES character render surfaces');
    expect(result.stdout).toContain('this total is a floor, not what the GPU will hold');
    // And no manifest entry is what makes it necessary, so it must not be
    // conditional on one.
    expect(result.stdout).not.toContain('Rive file(s)');
  });

  it('and does not charge the GPU for atlas JSON or Rive files', async () => {
    const result = await run({
      levels: { ottawa: { pois: ['ottawa-bench'], textureBudgetBytes: 8 * MIB } },
      files: [
        {
          path: 'atlas/ottawa@1x.aaaaaaaa.webp',
          kind: 'atlas',
          group: 'atlas:ottawa:0',
          scale: 1,
          keys: ['ottawa-bench'],
          pixels: { w: 256, h: 256 },
        },
        { path: 'atlas/ottawa@1x.bbbbbbbb.json', kind: 'atlas-data', group: 'atlas-data:ottawa:0', scale: 1, keys: [] },
        { path: 'rive/ottawa-officer.cccccccc.riv', kind: 'rive', group: 'rive:ottawa-officer', scale: null, keys: ['ottawa-officer'] },
      ],
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('ottawa 0.25 MiB of 8.00 MiB');
  });
});

/**
 * ADR-0013's two infra obligations (due 2026-11-08): character surfaces are
 * CHARGED against each level's budget per device scale, on a line of their own,
 * and the baseline-model figure is reported beside the charged one without
 * changing what the gate refuses.
 *
 * The surface is the rig's ARTBOARD (`characterSpace.width x height`), not the
 * crown-to-sole `heightPx`, which is why every fixture rig below carries a
 * `heightPx` that differs from `height`: charging the wrong term would change
 * every number asserted here.
 */
describe('character surfaces are charged from the rig, on their own line', () => {
  const CONTENT_RIG = 'content/characters/rig.json';
  const ART_RIG = 'assets/style/rig-contract.json';

  /** wholesome() with `characters` placed, and a budget to choose. */
  const withCharacters = (characters: number, budget: number, rigs: Record<string, unknown> | undefined): Fixture => {
    const base = wholesome(budget);
    return {
      ...base,
      levels: { ottawa: { ...base.levels.ottawa, characters } },
      ...(rigs === undefined ? {} : { rigs }),
    };
  };

  it('prints files, surfaces, the charged sum and the baseline model as separate labelled lines', async () => {
    // Two characters x 240x470 artboard x 4 B: 902400 B at 1x, x4 = 3609600 B
    // at 2x. Files are 2.89 MiB at 2x (see wholesome), so the charge is 6.34.
    const result = await run(withCharacters(2, 8 * MIB, { [CONTENT_RIG]: rigDoc(240, 470) }));
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    const lines = result.stdout.split('\n');
    const files = lines.find((l) => l.includes('ottawa 2.89 MiB of 8.00 MiB')) ?? '';
    const surfaces = lines.find((l) => l.includes('SURFACES')) ?? '';
    const charged = lines.find((l) => l.includes('CHARGED')) ?? '';
    // The file total is still the file total: nothing derived was folded in.
    expect(files).toContain('FILES, measured from 3 file(s) on disk [1x device 2.21 MiB / 2x device 2.89 MiB]');
    expect(files).not.toContain('SURFACES');
    expect(surfaces).toContain('SURFACES 3.44 MiB: 2 character(s) x 240x470 artboard (content/characters/rig.json)');
    expect(surfaces).toContain('DERIVED from declarations, not measured [1x device 0.86 MiB / 2x device 3.44 MiB]');
    expect(charged).toContain('CHARGED 6.34 MiB of 8.00 MiB (79%, 1745408 B spare)');
    expect(charged).toContain('[1x device 3.07 MiB / 2x device 6.34 MiB]');
    expect(result.stdout).toContain('BASELINE MODEL');
    expect(result.stdout).toContain('REPORTED ONLY');
  });

  it('FAILS when a level declares characters and no rig document can be resolved, rather than charging zero', async () => {
    const result = await run(withCharacters(2, 8 * MIB, undefined));
    expect(result.status).toBe(1);
    expect(result.output).toContain(
      'level "ottawa" declares 2 character(s) in content/levels/ottawa.json, and no rig document can be resolved: ' +
        'none of content/characters/rig.json, assets/style/rig-contract.json exists.',
    );
    expect(result.output).toContain('without the rig the gate would charge them zero');
    expect(result.stdout).not.toContain('texture-memory: OK');
  });

  it('does not ask for a rig when no level declares a character', async () => {
    const result = await run(withCharacters(0, 8 * MIB, undefined));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('SURFACES 0 B: ottawa declares no characters');
    expect(result.stdout).toContain('CHARGED 2.89 MiB of 8.00 MiB');
  });

  it('fails when the files fit on their own and the characters do not fit on top of them', async () => {
    // 2.89 MiB of files is under 4 MiB; 6.34 MiB charged is not. Before this
    // obligation the gate passed this level.
    const result = await run(withCharacters(2, 4 * MIB, { [CONTENT_RIG]: rigDoc(240, 470) }));
    expect(result.status).toBe(1);
    expect(result.output).toContain(
      'level "ottawa" is charged 6.34 MiB (6643200 B) at the worst device scale: 2.89 MiB of texture files ' +
        'plus 3.44 MiB of character surfaces (2 character(s)',
    );
    expect(result.output).toContain('2448896 B over');
    expect(result.output).toContain('Per device scale: 1x 3.07 MiB, 2x 6.34 MiB');
    expect(result.output).not.toContain('level "ottawa" holds');
  });

  it("resolves the rig from art's location when content/ does not hold one", async () => {
    const result = await run(withCharacters(1, 8 * MIB, { [ART_RIG]: rigDoc(240, 470) }));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('SURFACES 1.72 MiB: 1 character(s) x 240x470 artboard (assets/style/rig-contract.json)');
  });

  it('reads both rig locations when both exist, and refuses when they disagree on the artboard', async () => {
    const agree = await run(
      withCharacters(1, 8 * MIB, { [CONTENT_RIG]: rigDoc(240, 470), [ART_RIG]: rigDoc(240, 470) }),
    );
    expect(agree.status).toBe(0);
    expect(agree.stdout).toContain('(content/characters/rig.json = assets/style/rig-contract.json)');

    const disagree = await run(
      withCharacters(1, 8 * MIB, { [CONTENT_RIG]: rigDoc(240, 470), [ART_RIG]: rigDoc(240, 420) }),
    );
    expect(disagree.status).toBe(1);
    expect(disagree.output).toContain(
      'content/characters/rig.json declares a 240x470 artboard and assets/style/rig-contract.json declares 240x420',
    );
  });

  it('refuses a rig whose artboard is not a positive size, rather than charging zero', async () => {
    const result = await run(withCharacters(1, 8 * MIB, { [CONTENT_RIG]: { characterSpace: { width: 240 } } }));
    expect(result.status).toBe(1);
    expect(result.output).toContain('no rig document can be resolved: content/characters/rig.json declares characterSpace');
  });
});

describe('the baseline model is reported beside the charge, and refuses nothing', () => {
  /** 5 MiB of shared art held by both levels, and 1 MiB of ottawa's own. */
  const sharedFixture = (ottawaBudget: number): Fixture => ({
    levels: {
      ottawa: { pois: ['ottawa-bench'], textureBudgetBytes: ottawaBudget },
      vancouver: { textureBudgetBytes: 8 * MIB },
    },
    files: [
      {
        path: 'img/hud@1x.aaaaaaaa.webp',
        group: 'img:hud',
        scale: 1,
        keys: ['hud'],
        levels: ['ottawa', 'vancouver'],
        pixels: { w: 1024, h: 1280 }, // 5 MiB
      },
      {
        path: 'img/ottawa-bench@1x.bbbbbbbb.webp',
        group: 'img:ottawa-bench',
        scale: 1,
        keys: ['ottawa-bench'],
        levels: ['ottawa'],
        pixels: { w: 512, h: 512 }, // 1 MiB
      },
    ],
  });

  it('labels the baseline-model figure and keeps the charged one beside it', async () => {
    const result = await run(sharedFixture(8 * MIB));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('CHARGED 6.00 MiB of 8.00 MiB');
    expect(result.stdout).toContain(
      'BASELINE MODEL 1.00 MiB of 8.00 MiB (13%) = own files + surfaces, with 1 shared file(s) (5.00 MiB) resident once',
    );
    expect(result.stdout).toContain("REPORTED ONLY, not enforced until ADR-0013's engine obligation lands");
    expect(result.stdout).toContain('BASELINE MODEL 0.00 MiB of 8.00 MiB (0%)');
  });

  it('still refuses on the charged figure when the baseline model would fit', async () => {
    // Baseline model: 1 MiB of 5. Charged: 6 MiB of 5. The gate refuses, as
    // ADR-0013 requires until unload-before-fetch is real and measured.
    const result = await run(sharedFixture(5 * MIB));
    expect(result.status).toBe(1);
    expect(result.output).toContain('level "ottawa" holds 6.00 MiB');
    expect(result.output).toContain('1048576 B over');
  });
});

describe('the gate reads pixel dimensions out of the file, independently of sharp', () => {
  const MODULE = new URL('../../../scripts/lib/texture-memory.mjs', import.meta.url).href;

  /**
   * Ask the shipped module, in its own process, what size it thinks a file is.
   *
   * Spawned rather than imported for the same reason every case above spawns the
   * CLI: the module is a build script, not application code, and what matters is
   * what it answers when Node runs it - not what a bundler makes of it here.
   */
  const probe = (file: string): { ok: boolean; width?: number; height?: number; format?: string } => {
    const code =
      `import { imageSize } from ${JSON.stringify(MODULE)};` +
      `process.stdout.write(JSON.stringify(imageSize(${JSON.stringify(file)})));`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
    expect(result.stderr).toBe('');
    return JSON.parse(result.stdout ?? '{}') as { ok: boolean; width?: number; height?: number; format?: string };
  };

  it.each([
    { w: 1, h: 1 },
    { w: 307, h: 911 },
    { w: 2048, h: 1080 },
    { w: 4096, h: 17 },
  ])('agrees with sharp on a $w x $h lossless WebP', async ({ w, h }) => {
    // The gate deliberately does NOT ask sharp: sharp wrote these files and
    // computed the decodedBytes being checked, so asking it would prove only
    // that a library agrees with itself. This case is where the two are compared
    // on purpose, which is the only place that comparison means anything.
    const file = join(WORK, `probe-${w}x${h}.webp`);
    await sharp({ create: { width: w, height: h, channels: 4, background: '#3d8ccb' } })
      .webp({ lossless: true })
      .toFile(file);
    const mine = probe(file);
    const theirs = await sharp(file).metadata();
    expect(mine.ok).toBe(true);
    expect(mine.width).toBe(theirs.width);
    expect(mine.height).toBe(theirs.height);
  });

  it('measures a lossy WebP and a PNG too, not only what this pipeline emits', async () => {
    // dist/ is not only this pipeline's output. A gate that silently returned 0
    // for a format it did not recognise would be a budget with a hole in it.
    const lossy = join(WORK, 'probe-lossy.webp');
    const png = join(WORK, 'probe.png');
    await sharp({ create: { width: 641, height: 129, channels: 3, background: '#123456' } })
      .webp({ quality: 70 })
      .toFile(lossy);
    await sharp({ create: { width: 641, height: 129, channels: 4, background: '#123456' } }).png().toFile(png);
    for (const file of [lossy, png]) {
      const mine = probe(file);
      expect(mine.ok).toBe(true);
      expect(mine.width).toBe(641);
      expect(mine.height).toBe(129);
    }
  });

  it('refuses a file it cannot measure rather than guessing zero', () => {
    const file = join(WORK, 'not-an-image.webp');
    writeFileSync(file, Buffer.alloc(64, 0x61));
    expect(probe(file).ok).toBe(false);
  });
});
