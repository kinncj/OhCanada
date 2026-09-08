/**
 * `make assets` (slice 1, task 1.10): the SVG -> WebP pipeline, driven as a CLI.
 *
 * assets/src was empty when this landed - art is drawing the Ottawa layers - so
 * without these cases nothing anywhere would show that the pipeline produces a
 * single byte. Every case builds a scratch source tree and runs the real script,
 * then reads the files it wrote with sharp: the assertions are about pixels and
 * bytes on disk, not about what the script says it did.
 *
 * The last cases matter most. `make assets` ends by running BOTH budget gates
 * over its own output, so "the pipeline built something", "the download budget
 * held" and "the texture-memory budget held" are one exit code. A build that
 * goes over either budget, or a level whose art key nothing produced, has to
 * fail here rather than at the point a player downloads it - or, for the texture
 * budget, at the point a player's phone loses its WebGL context.
 *
 * The layer/prop distinction below is load-bearing and is not decoration: a
 * source whose key appears in a level document's `layers[]` is a full-screen
 * parallax layer and the pipeline emits it at 1x ONLY (owner's decision, slice
 * 1). Fixtures therefore put backgrounds in `layers[]` and props in `pois[]`,
 * the way a real level document does.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../../../scripts/assets.mjs', import.meta.url));
const WORK = mkdtempSync(join(tmpdir(), 'assets-pipeline-'));

const BUDGET = 8 * 1024 * 1024;

afterAll(() => {
  rmSync(WORK, { recursive: true, force: true });
});

interface ManifestFile {
  readonly path: string;
  readonly bytes: number;
  readonly kind: string;
  readonly role: string;
  readonly group: string;
  readonly scale: number | null;
  readonly width?: number;
  readonly height?: number;
  readonly decodedBytes: number;
  readonly levels: readonly string[];
  readonly keys: readonly string[];
}

interface Manifest {
  readonly version: number;
  readonly atlasMaxPx: number;
  readonly scales: readonly number[];
  readonly outputDirs: readonly string[];
  readonly levels: Record<string, { payloadBytes: number; decodedTextureBytes: number }>;
  readonly files: readonly ManifestFile[];
}

interface Built {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly output: string;
  readonly root: string;
  readonly dist: string;
  manifest(): Manifest;
}

/** A flat SVG of exactly `w` x `h` design-resolution units. */
const svg = (w: number, h: number, fill: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
  `<rect width="${w}" height="${h}" fill="${fill}"/>` +
  `<circle cx="${Math.round(w / 2)}" cy="${Math.round(h / 2)}" r="${Math.round(Math.min(w, h) / 4)}" fill="#12352a"/></svg>`;

let caseId = 0;

/**
 * Build a scratch repository - level documents, a config carrying the budget,
 * and `sources` under assets/src - then run the real pipeline over it.
 */
function build(options: {
  readonly sources: Record<string, string>;
  readonly levelDocs: Record<string, unknown>;
  readonly budget?: number;
}): Built {
  caseId += 1;
  const root = join(WORK, `case-${caseId}`);
  const dist = join(root, 'assets', 'dist');
  mkdirSync(dist, { recursive: true });
  mkdirSync(join(root, 'content', 'levels'), { recursive: true });

  writeFileSync(
    join(root, 'content', 'game.config.json'),
    JSON.stringify({ basePath: '/OhCanada/', budgets: { levelPayloadBytes: options.budget ?? BUDGET } }),
    'utf8',
  );
  for (const [id, doc] of Object.entries(options.levelDocs)) {
    writeFileSync(join(root, 'content', 'levels', `${id}.json`), JSON.stringify(doc), 'utf8');
  }
  for (const [rel, contents] of Object.entries(options.sources)) {
    const full = join(root, 'assets', 'src', ...rel.split('/'));
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents, 'utf8');
  }

  const result = spawnSync(process.execPath, [SCRIPT, '--root', root], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  return {
    status: result.status ?? -1,
    stdout,
    stderr,
    output: `${stdout}${stderr}`,
    root,
    dist,
    manifest: () => JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8')) as Manifest,
  };
}

/**
 * A level document naming exactly the art keys it expects to exist.
 *
 * `layers` is the full-screen set: those keys ship at 1x only. `props` become
 * `pois[].artKey` and ship at both scales. Which list a key is in is the whole
 * of the 1x rule, so a fixture that put everything in one would be testing a
 * level shape no level has.
 */
const levelDoc = (
  id: string,
  layers: readonly string[],
  props: readonly string[] = [],
  textureBudgetBytes = 64 * 1024 * 1024,
): unknown => ({
  id,
  layers: layers.map((key) => ({ key })),
  pois: props.map((artKey) => ({ artKey })),
  assets: [],
  textureBudgetBytes,
});

describe('make assets builds WebP from SVG', () => {
  const built = build({
    sources: {
      // Small enough to pack at both scales.
      'svg/ottawa/peace-tower.svg': svg(300, 900, '#e6eff7'),
      'svg/ottawa/bench.svg': svg(180, 120, '#3d8ccb'),
      // A full-screen parallax layer: standalone (never atlased) and 1x only.
      // At 2x it would be 2160 x 3840 = 31.6 MiB of decoded texture on its own.
      'svg/ottawa/skyline.svg': svg(1080, 1920, '#a5d6ee'),
      // A prop that is too big for a 2048 px page at 2x: standalone at BOTH
      // scales, rather than changing kind per scale.
      'svg/ottawa/mural.svg': svg(1500, 900, '#e6eff7'),
      // Charged to every level.
      'svg/shared/hud-frame.svg': svg(200, 120, '#ffffff'),
      'rive/ottawa/officer.riv': 'RIVE-not-really',
    },
    levelDocs: {
      ottawa: levelDoc('ottawa', ['ottawa-skyline'], ['ottawa-peace-tower', 'ottawa-bench', 'hud-frame']),
    },
  });

  it('exits 0 and reports what it produced', () => {
    expect(built.stderr).toBe('');
    expect(built.status).toBe(0);
    expect(built.stdout).toContain('5 SVG + 1 Rive source(s)');
    expect(built.stdout).toContain('1x + 2x');
    expect(built.stdout).toContain('1 full-screen layer file(s) at 1x only');
    expect(built.stdout).toContain('level-payload: OK');
    expect(built.stdout).toContain('texture-memory: OK');
  });

  it('emits every output as WebP, and the atlas data as JSON beside it', () => {
    const manifest = built.manifest();
    expect(manifest.version).toBe(2);
    expect(manifest.scales).toEqual([1, 2]);
    for (const file of manifest.files) {
      if (file.kind === 'atlas' || file.kind === 'image') expect(file.path).toMatch(/\.webp$/);
      if (file.kind === 'atlas-data') expect(file.path).toMatch(/\.json$/);
      if (file.kind === 'rive') expect(file.path).toMatch(/\.riv$/);
      // Content-hashed: eight hex characters before the extension.
      expect(file.path).toMatch(/\.[0-9a-f]{8}\.[a-z]+$/);
    }
    expect(manifest.files.some((f) => f.kind === 'atlas')).toBe(true);
    expect(manifest.files.some((f) => f.kind === 'image')).toBe(true);
    expect(manifest.files.some((f) => f.kind === 'rive')).toBe(true);
  });

  it('holds every atlas page inside 2048 px, measured on the file', async () => {
    const manifest = built.manifest();
    const pages = manifest.files.filter((f) => f.kind === 'atlas');
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages) {
      const meta = await sharp(join(built.dist, ...page.path.split('/'))).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.width).toBeLessThanOrEqual(2048);
      expect(meta.height).toBeLessThanOrEqual(2048);
      expect(meta.width).toBe(page.width);
      expect(meta.height).toBe(page.height);
    }
  });

  it('renders 2x from the vector rather than upscaling the 1x bitmap', async () => {
    const manifest = built.manifest();
    const at = (scale: number): ManifestFile | undefined =>
      manifest.files.find((f) => f.kind === 'image' && f.scale === scale && f.keys.includes('ottawa-mural'));
    const one = at(1);
    const two = at(2);
    expect(one).toBeDefined();
    expect(two).toBeDefined();
    expect(one?.width).toBe(1500);
    expect(one?.height).toBe(900);
    expect(two?.width).toBe(3000);
    expect(two?.height).toBe(1800);
    // Same texture, two scales: one variant group, so a device is charged for
    // one of them and not both.
    expect(one?.group).toBe(two?.group);
    const meta = await sharp(join(built.dist, ...(two as ManifestFile).path.split('/'))).metadata();
    expect(meta.width).toBe(3000);
  });

  it('ships a full-screen parallax layer at 1x only, standalone, and says so', () => {
    // The owner's slice-1 decision, at the point it is made. `layer-10-sky@2x`
    // was 2160x3840 = 31.6 MiB decoded - a whole level's texture budget in one
    // sky the player moves past.
    const manifest = built.manifest();
    const sky = manifest.files.filter((f) => f.keys.includes('ottawa-skyline'));
    expect(sky.map((f) => f.scale)).toEqual([1]);
    expect(sky[0]?.role).toBe('layer');
    expect(sky[0]?.kind).toBe('image');
    expect(sky[0]?.width).toBe(1080);
    expect(sky[0]?.height).toBe(1920);
    expect(sky[0]?.decodedBytes).toBe(1080 * 1920 * 4);
    // And nothing else is a layer: role follows content/levels/, not a filename.
    expect(manifest.files.filter((f) => f.role === 'layer')).toHaveLength(1);
  });

  it('records a decoded footprint per level that the gate can re-derive', () => {
    const manifest = built.manifest();
    expect(manifest.levels.ottawa?.decodedTextureBytes).toBeGreaterThan(0);
    // A 2x device holds the 2x props and the 1x layer together, so the level's
    // footprint is strictly larger than either scale's own bucket.
    const layer = 1080 * 1920 * 4;
    expect(manifest.levels.ottawa?.decodedTextureBytes).toBeGreaterThan(layer);
  });

  it('names every key its level document asks for, and charges shared art to the level', () => {
    const manifest = built.manifest();
    const keys = new Set(manifest.files.flatMap((f) => f.keys));
    for (const key of ['ottawa-peace-tower', 'ottawa-bench', 'ottawa-skyline', 'hud-frame', 'ottawa-officer']) {
      expect(keys).toContain(key);
    }
    const hud = manifest.files.find((f) => f.keys.includes('hud-frame'));
    expect(hud?.levels).toEqual(['ottawa']);
    expect(Object.keys(manifest.levels)).toEqual(['ottawa']);
    expect(manifest.levels.ottawa?.payloadBytes).toBeGreaterThan(0);
  });

  it('keeps a full-screen layer out of the atlas even when it would fit in one', () => {
    // A layer small enough to pack is still a layer. Packing it would put a
    // layer and a prop on one page, and the page would have no single role to
    // apply the 1x rule to - so the rule would stop being evaluable, which is
    // worse than one extra texture unit for a small background.
    const built = build({
      sources: {
        'svg/ottawa/haze.svg': svg(240, 160, '#a5d6ee'),
        'svg/ottawa/bench.svg': svg(180, 120, '#3d8ccb'),
      },
      levelDocs: { ottawa: levelDoc('ottawa', ['ottawa-haze'], ['ottawa-bench']) },
    });
    expect(built.status).toBe(0);
    const manifest = built.manifest();
    const haze = manifest.files.filter((f) => f.keys.includes('ottawa-haze'));
    expect(haze).toHaveLength(1);
    expect(haze[0]?.kind).toBe('image');
    expect(haze[0]?.scale).toBe(1);
    expect(haze[0]?.role).toBe('layer');
    // The prop, meanwhile, is atlased at both scales.
    const bench = manifest.files.filter((f) => f.kind === 'atlas' && f.keys.includes('ottawa-bench'));
    expect(bench.map((f) => f.scale).sort()).toEqual([1, 2]);
    expect(bench.every((f) => f.role === 'sprite')).toBe(true);
  });

  it('points each atlas data file at the hashed texture beside it', () => {
    const manifest = built.manifest();
    for (const data of manifest.files.filter((f) => f.kind === 'atlas-data')) {
      const json = JSON.parse(readFileSync(join(built.dist, ...data.path.split('/')), 'utf8')) as {
        textures: { image: string; frames: { filename: string }[] }[];
      };
      const texture = json.textures[0];
      expect(texture).toBeDefined();
      expect(manifest.files.some((f) => f.path === `atlas/${texture?.image}`)).toBe(true);
      expect(texture?.frames.length).toBeGreaterThan(0);
    }
  });

  it('rebuilds byte-for-byte, so a rebuild is not a deploy', () => {
    const again = spawnSync(process.execPath, [SCRIPT, '--root', built.root], { encoding: 'utf8' });
    expect(again.status).toBe(0);
    expect(JSON.stringify(built.manifest())).toBe(
      JSON.stringify(JSON.parse(readFileSync(join(built.dist, 'manifest.json'), 'utf8')) as Manifest),
    );
  });
});

describe('make assets refuses to finish', () => {
  it('when a level goes over budgets.levelPayloadBytes', () => {
    // The gate runs over the pipeline's own output, in the same process and
    // under the same exit code, so there is no way to build assets and skip it.
    const built = build({
      sources: { 'svg/ottawa/skyline.svg': svg(1080, 1920, '#a5d6ee') },
      levelDocs: { ottawa: levelDoc('ottawa', ['ottawa-skyline']) },
      budget: 4096,
    });
    expect(built.status).toBe(1);
    expect(built.output).toContain('level "ottawa" ships');
    expect(built.output).toContain('the budget is 0.00 MiB (4096 B)');
    expect(built.output).toContain('assets: build rejected.');
  });

  it('when a level goes over its textureBudgetBytes, which no download budget would catch', () => {
    // 1200x1200 at 2x is 2400x2400 = 22 MiB of decoded texture and about 30 kB
    // on the wire. The payload budget is 8 MiB and is nowhere near troubled;
    // this is the gap that lost the predecessor's WebGL context.
    const built = build({
      sources: { 'svg/ottawa/mural.svg': svg(1200, 1200, '#3d8ccb') },
      levelDocs: { ottawa: levelDoc('ottawa', [], ['ottawa-mural'], 4 * 1024 * 1024) },
    });
    expect(built.status).toBe(1);
    expect(built.output).toContain('level "ottawa" holds 21.97 MiB');
    expect(built.output).toContain('the budget is 4.00 MiB (4194304 B, from content/levels/ottawa.json)');
    expect(built.output).toContain('This is VRAM, not download');
    // The other gate is reported as having passed, so silence is never readable
    // as "it did not run".
    expect(built.output).toContain('level-payload: passed');
    expect(built.output).toContain('assets: build rejected.');
    // And nothing is left where publicDir would pick it up.
    expect(readdirSync(built.dist)).toEqual([]);
  });

  it('when a level document names an art key no source produces', () => {
    const built = build({
      sources: { 'svg/ottawa/bench.svg': svg(180, 120, '#3d8ccb') },
      levelDocs: { ottawa: levelDoc('ottawa', ['ottawa-bench', 'ottawa-peace-tower']) },
    });
    expect(built.status).toBe(1);
    expect(built.output).toContain('"ottawa-peace-tower" is not provided by any file charged to level "ottawa"');
  });

  it('when there are no sources at all, rather than writing an empty manifest and passing', () => {
    const built = build({ sources: {}, levelDocs: { ottawa: levelDoc('ottawa', ['ottawa-skyline']) } });
    expect(built.status).toBe(1);
    expect(built.output).toContain('maps files to 0 level(s)');
    expect(built.stdout).not.toContain('level-payload: OK');
  });

  it('when a source sits in a directory that is neither a level id nor shared', () => {
    // Guessing here is the defect this task exists to close: a file whose level
    // nobody can name is a file charged to no budget.
    const built = build({
      sources: { 'svg/montreal/skyline.svg': svg(180, 120, '#3d8ccb') },
      levelDocs: { ottawa: levelDoc('ottawa', ['ottawa-skyline']) },
    });
    expect(built.status).toBe(1);
    expect(built.output).toContain('sits under "montreal/", which is neither "shared" nor a level id');
    expect(built.output).toContain('charged to no payload budget');
  });

  it('when a source at the top of the tree carries no level prefix', () => {
    const built = build({
      sources: { 'svg/skyline.svg': svg(180, 120, '#3d8ccb') },
      levelDocs: { ottawa: levelDoc('ottawa', ['ottawa-skyline']) },
    });
    expect(built.status).toBe(1);
    expect(built.output).toContain('is at the top of its source tree');
  });

  it('when two sources produce the same texture key', () => {
    const built = build({
      sources: {
        'svg/ottawa/skyline.svg': svg(180, 120, '#3d8ccb'),
        'svg/ottawa-skyline.svg': svg(200, 140, '#e6eff7'),
      },
      levelDocs: { ottawa: levelDoc('ottawa', ['ottawa-skyline']) },
    });
    expect(built.status).toBe(1);
    expect(built.output).toContain('both produce the texture key "ottawa-skyline"');
  });

  it('and leaves nothing behind when it does, so a half-built tree cannot ship', () => {
    // vite.config.ts sets `publicDir: 'assets/dist'`. A failed build that left
    // most of an atlas set and no manifest behind would be copied into dist/ by
    // the next `make build` and shipped, with no manifest for the payload gate
    // to weigh it against.
    const built = build({
      sources: {
        'svg/ottawa/bench.svg': svg(180, 120, '#3d8ccb'),
        'svg/ottawa/mural.svg': svg(2100, 1000, '#3d8ccb'),
      },
      levelDocs: { ottawa: levelDoc('ottawa', [], ['ottawa-bench', 'ottawa-mural']) },
    });
    expect(built.status).toBe(1);
    expect(readdirSync(built.dist)).toEqual([]);
  });

  it('when a source is too large to ship as a texture at 2x', () => {
    // 2100 px at 2x is 4200, past the 4096 px a 2021 mid-range Android can be
    // relied on to accept. Failing beats shipping a texture that silently does
    // not upload on the devices the budgets in CLAUDE.md are written for.
    const built = build({
      sources: { 'svg/ottawa/mural.svg': svg(2100, 1000, '#3d8ccb') },
      levelDocs: { ottawa: levelDoc('ottawa', [], ['ottawa-mural']) },
    });
    expect(built.status).toBe(1);
    expect(built.output).toContain('over the 4096 px texture cap');
  });
});
