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
  readonly scalePin: number | null;
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

  it('ships a source pinned "@1x" at 1x only, standalone, with the key unchanged', () => {
    // OQ-LEVEL-ART-1. `ottawa-landmark-parliament-hill` is a POI's artKey, not a
    // layer, so nothing could ask for 1x and it shipped at 2x for 17.14 MiB --
    // 37% of the level -- against art's own written plan. The pin is how a
    // source says so, and the suffix must not reach the key: content/levels/
    // still says "ottawa-landmark", and renaming art to pin it must not rename
    // what the level document refers to.
    const built = build({
      sources: {
        'svg/ottawa/landmark@1x.svg': svg(1080, 1040, '#e6eff7'),
        'svg/ottawa/bench.svg': svg(180, 120, '#3d8ccb'),
      },
      levelDocs: { ottawa: levelDoc('ottawa', [], ['ottawa-landmark', 'ottawa-bench']) },
    });
    expect(built.status).toBe(0);
    const manifest = built.manifest();
    const landmark = manifest.files.filter((f) => f.keys.includes('ottawa-landmark'));
    expect(landmark).toHaveLength(1);
    expect(landmark[0]?.scale).toBe(1);
    expect(landmark[0]?.scalePin).toBe(1);
    expect(landmark[0]?.kind).toBe('image');
    // Not a layer: the pin is the author's, the layer rule is the owner's, and
    // the manifest must not confuse the two.
    expect(landmark[0]?.role).toBe('sprite');
    expect(landmark[0]?.width).toBe(1080);
    expect(landmark[0]?.height).toBe(1040);
    expect(landmark[0]?.path).not.toContain('@1x@');
    // The unpinned prop still gets both scales.
    expect(manifest.files.filter((f) => f.keys.includes('ottawa-bench') && f.kind === 'atlas')).toHaveLength(2);
    expect(built.stdout).toContain('1 source-pinned file(s)');
  });

  it('saves the memory the pin exists for, and says so in the texture line', () => {
    // Same art, pinned and not, so the saving is measured rather than asserted:
    // 2160x2080 at 2x is 17.14 MiB and 1080x1040 at 1x is 4.28 MiB.
    const sources = { 'svg/ottawa/landmark.svg': svg(1080, 1040, '#e6eff7') };
    const docs = { ottawa: levelDoc('ottawa', [], ['ottawa-landmark']) };
    const unpinned = build({ sources, levelDocs: docs });
    const pinned = build({
      sources: { 'svg/ottawa/landmark@1x.svg': svg(1080, 1040, '#e6eff7') },
      levelDocs: docs,
    });
    expect(unpinned.status).toBe(0);
    expect(pinned.status).toBe(0);
    const before = unpinned.manifest().levels.ottawa?.decodedTextureBytes ?? 0;
    const after = pinned.manifest().levels.ottawa?.decodedTextureBytes ?? 0;
    expect(before).toBe(2160 * 2080 * 4);
    expect(after).toBe(1080 * 1040 * 4);
    expect(before - after).toBe(13_478_400);
    expect(pinned.stdout).toContain('1 source-pinned to 1x');
  });

  it('names the heaviest texture and its share of budget on a GREEN run', () => {
    // The gate that only speaks when the total is breached let one asset become
    // 37% of a level unremarked. No threshold is invented; the concentration is
    // simply stated, in a line that appears in every CI log.
    const built = build({
      // 1100 px is 2200 at 2x, past what a 2048 px page can hold, so it is a
      // standalone image and its path is predictable.
      sources: {
        'svg/ottawa/mural.svg': svg(1100, 1100, '#3d8ccb'),
        'svg/ottawa/bench.svg': svg(180, 120, '#3d8ccb'),
      },
      levelDocs: { ottawa: levelDoc('ottawa', [], ['ottawa-mural', 'ottawa-bench'], 64 * 1024 * 1024) },
    });
    expect(built.status).toBe(0);
    expect(built.stdout).toContain('heaviest img/ottawa-mural@2x');
    expect(built.stdout).toContain('2200x2200 18.46 MiB = 29% of budget');
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

/* ======================================================================
 * A failed build must not destroy the last good one
 * ====================================================================== */

/**
 * `make assets` used to wipe `assets/dist/` and then build into it, and to wipe
 * it again on any failure. The wipe's reason was sound - `emit` writes as it
 * goes, so an error found halfway through left most of an atlas set and no
 * manifest, and `publicDir: 'assets/dist'` let the next `make build` copy that
 * half-built tree into `dist/` and ship it unweighed.
 *
 * THE BUG WAS THE ORDERING. Art landed nine Quebec City sources before
 * `content/levels/quebec-city.json` existed. The level-ownership rule refused
 * them, correctly - and by then the wipe had already run. `assets/dist/` held
 * only `.gitkeep`: no manifest, no atlas, no layer images, no playable build,
 * and six e2e tests down, over a condition that should have failed the build and
 * left the previous output alone.
 *
 * These cases are the pair of properties, which are achievable together: nothing
 * is destroyed until a complete, budget-checked set exists somewhere else.
 */
describe('a failed build leaves the last good output where it was', () => {
  /** Re-run the pipeline over a tree that has already been built once. */
  const rerun = (root: string, sources: Record<string, string> = {}): { status: number; output: string } => {
    for (const [rel, contents] of Object.entries(sources)) {
      const full = join(root, 'assets', 'src', ...rel.split('/'));
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, contents, 'utf8');
    }
    const result = spawnSync(process.execPath, [SCRIPT, '--root', root], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: result.status ?? -1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
  };

  const contentsOf = (dist: string): readonly string[] => readdirSync(dist).sort();

  it('an INPUT error touches assets/dist not at all', () => {
    // THE CASE THAT TOOK THE TREE DOWN, in its general form: a source under a
    // directory that is not a level id. It is found before a single byte is
    // written, which is exactly why the old ordering was so expensive.
    const built = build({
      sources: { 'svg/ottawa/skyline.svg': svg(1080, 1920, '#a5d6ee') },
      levelDocs: { ottawa: levelDoc('ottawa', ['ottawa-skyline']) },
    });
    expect(built.status, built.output).toBe(0);
    const before = contentsOf(built.dist);
    expect(before).toContain('manifest.json');
    expect(before).toContain('img');
    const manifestBefore = readFileSync(join(built.dist, 'manifest.json'), 'utf8');

    const second = rerun(built.root, {
      'svg/quebec-city/landmark-chateau-frontenac@1x.svg': svg(400, 700, '#c8d8e8'),
    });
    expect(second.status).toBe(1);
    expect(second.output).toContain('which is neither "shared" nor a level id');

    expect(contentsOf(built.dist)).toEqual(before);
    expect(readFileSync(join(built.dist, 'manifest.json'), 'utf8')).toBe(manifestBefore);
  });

  it('a BUDGET rejection also leaves it, because nothing was promoted', () => {
    // The other failure path, and the one that runs after a complete set has
    // been built. It is discarded from the staging tree rather than swapped in.
    const built = build({
      sources: { 'svg/ottawa/skyline.svg': svg(1080, 1920, '#a5d6ee') },
      levelDocs: { ottawa: levelDoc('ottawa', ['ottawa-skyline']) },
    });
    expect(built.status, built.output).toBe(0);
    const manifestBefore = readFileSync(join(built.dist, 'manifest.json'), 'utf8');

    writeFileSync(
      join(built.root, 'content', 'game.config.json'),
      JSON.stringify({ basePath: '/OhCanada/', budgets: { levelPayloadBytes: 4096 } }),
      'utf8',
    );
    const second = rerun(built.root);
    expect(second.status).toBe(1);
    expect(second.output).toContain('assets: build rejected.');
    expect(readFileSync(join(built.dist, 'manifest.json'), 'utf8')).toBe(manifestBefore);
  });

  it('a SUCCESSFUL build still replaces it, rather than merging into it', () => {
    // The negative case that keeps the fix honest. Staging must not turn into
    // "leave whatever was there": a key that no longer has a source has to
    // disappear, or the payload gate starts weighing files nothing claims.
    const built = build({
      sources: {
        'svg/ottawa/skyline.svg': svg(1080, 1920, '#a5d6ee'),
        'svg/ottawa/canalwall.svg': svg(600, 400, '#3d8ccb'),
      },
      levelDocs: { ottawa: levelDoc('ottawa', ['ottawa-skyline', 'ottawa-canalwall']) },
    });
    expect(built.status, built.output).toBe(0);
    const first = built.manifest();
    expect(first.files.length).toBeGreaterThan(1);

    rmSync(join(built.root, 'assets', 'src', 'svg', 'ottawa', 'canalwall.svg'));
    writeFileSync(
      join(built.root, 'content', 'levels', 'ottawa.json'),
      JSON.stringify(levelDoc('ottawa', ['ottawa-skyline'])),
      'utf8',
    );
    const second = rerun(built.root);
    expect(second.status, second.output).toBe(0);

    const after = built.manifest();
    expect(after.files.map((f) => f.path).join(' ')).not.toContain('canalwall');
    // and the dropped file is gone from disk, not merely unlisted
    const onDisk = readdirSync(join(built.dist, 'img'));
    expect(onDisk.join(' ')).not.toContain('canalwall');
  });

  it('leaves no staging directory behind, on any path', () => {
    // Staging lives outside the repository on purpose: a directory inside
    // assets/dist would be invisible to the payload gate, whose stray-file scan
    // reads FILES at that root and not directories, and `publicDir` would copy
    // it into a shipped build. This asserts the repository side of that.
    const built = build({
      sources: { 'svg/ottawa/skyline.svg': svg(1080, 1920, '#a5d6ee') },
      levelDocs: { ottawa: levelDoc('ottawa', ['ottawa-skyline']) },
    });
    expect(built.status, built.output).toBe(0);
    rerun(built.root, { 'svg/nowhere/stray.svg': svg(10, 10, '#000000') });

    for (const dir of [built.dist, join(built.root, 'assets'), built.root]) {
      expect(readdirSync(dir).filter((n) => n.startsWith('.dist') || n.includes('staging'))).toEqual([]);
    }
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

  it('when a source asks to be pinned UP, which a filename does not get to do', () => {
    // "@2x" can only mean one of two things: "give me what I already get", or
    // "ignore the owner's decision that full-screen layers ship at 1x". The
    // second is not the author's call, so the suffix is refused rather than
    // quietly ignored.
    const built = build({
      sources: { 'svg/ottawa/sky@2x.svg': svg(180, 120, '#a5d6ee') },
      levelDocs: { ottawa: levelDoc('ottawa', ['ottawa-sky']) },
    });
    expect(built.status).toBe(1);
    expect(built.output).toContain('asks for "@2x". A source may only pin itself DOWN, to "@1x"');
    expect(built.output).toContain("would be asking to overrule the owner's decision");
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
