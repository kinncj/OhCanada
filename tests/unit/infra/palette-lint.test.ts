/**
 * The palette lint: the gate is itself checked, and it is checked that it can FAIL.
 *
 * `assets/style/art-bible.md` §2 and `CLAUDE.md` both said "the palette lint
 * fails on anything else" and there was no palette lint (OQ-ART-11).
 * `validate-content.mjs` checked the palette's internal integrity and never
 * opened an SVG; `assets.mjs` rasterised every source and never read
 * `palette.json`. The rule was written down twice and enforced by hand.
 *
 * It was added on a day it PASSES over the real tree — the art agent's hand run
 * found 0 off-palette fills and 0 forbidden constructs over 80 sources — which
 * is precisely why these cases matter more than usual. A gate that has never
 * been red is indistinguishable, from its output, from a gate that cannot go
 * red. So every rule below is asserted by a fixture that breaks it, through the
 * real `make assets` CLI, and the last describe asserts the two things that
 * would make it a decoration: that it runs over the real repository, and that
 * an empty or unreadable corpus cannot reduce to a pass (ADR-0024).
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../../../scripts/assets.mjs', import.meta.url));
const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const WORK = mkdtempSync(join(tmpdir(), 'palette-lint-'));

afterAll(() => {
  rmSync(WORK, { recursive: true, force: true });
});

interface Run {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly output: string;
}

const spawn = (root: string): Run => {
  const result = spawnSync(process.execPath, [SCRIPT, '--root', root], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  return { status: result.status ?? -1, stdout, stderr, output: `${stdout}${stderr}` };
};

/** The colours the fixtures below are allowed to draw with. */
const COLOURS = {
  'snow-light': '#ffffff',
  'sky-base': '#3d8ccb',
  'pine-shade': '#12352a',
} as const;

let caseId = 0;

/**
 * A scratch repository with one level, one source, and a palette.
 *
 * `body` replaces the source's contents, so a case states exactly the SVG it is
 * about. The level document names the key, so a fixture that passes the lint
 * goes all the way through the pipeline and the case can tell "the lint said
 * nothing" from "the lint was never reached".
 */
function build(body: string, options: { readonly palette?: unknown } = {}): Run {
  caseId += 1;
  const root = join(WORK, `case-${caseId}`);
  mkdirSync(join(root, 'assets', 'src', 'svg', 'ottawa'), { recursive: true });
  mkdirSync(join(root, 'assets', 'style'), { recursive: true });
  mkdirSync(join(root, 'content', 'levels'), { recursive: true });

  writeFileSync(
    join(root, 'content', 'game.config.json'),
    JSON.stringify({ basePath: '/OhCanada/', budgets: { levelPayloadBytes: 8 * 1024 * 1024 } }),
    'utf8',
  );
  writeFileSync(
    join(root, 'content', 'levels', 'ottawa.json'),
    JSON.stringify({
      id: 'ottawa',
      layers: [{ key: 'ottawa-skyline' }],
      pois: [],
      assets: [],
      textureBudgetBytes: 64 * 1024 * 1024,
    }),
    'utf8',
  );
  writeFileSync(
    join(root, 'assets', 'style', 'palette.json'),
    JSON.stringify(options.palette ?? { id: 'scratch-palette', colours: COLOURS }),
    'utf8',
  );
  const full = join(root, 'assets', 'src', 'svg', 'ottawa', 'skyline.svg');
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body, 'utf8');
  return spawn(root);
}

/** A source that draws only palette colours and uses no forbidden construct. */
const clean = (extra = ''): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">` +
  `<title>a flat sky</title>` +
  `<rect width="1080" height="1920" fill="${COLOURS['sky-base']}"/>` +
  `<circle cx="540" cy="400" r="180" fill="${COLOURS['snow-light']}" stroke="${COLOURS['pine-shade']}"/>` +
  `${extra}</svg>`;

describe('the lint passes what it should, and says so in numbers', () => {
  const built = build(clean());

  it('lets a source drawing only palette colours through', () => {
    expect(built.status, built.output).toBe(0);
    expect(built.stdout).toContain('palette: OK');
  });

  it('reports what it counted, so "it printed nothing" is not readable as "it did not run"', () => {
    // Three declarations in the fixture: two fills and one stroke. Asserted as a
    // number because a lint that examined nothing prints the identical verdict.
    expect(built.stdout).toMatch(/palette: OK - 3 fill\/stroke declaration\(s\) in 1 source\(s\)/);
    expect(built.stdout).toContain('3 distinct palette colour(s)');
  });

  it('accepts `none` and a short hex, which are not off-palette', () => {
    // `fill="none"` is the commonest declaration in the real tree (357 of them)
    // and #FFF is the same white as #ffffff. Neither is a colour choice.
    const result = build(
      clean(`<rect x="0" y="0" width="10" height="10" fill="none" stroke="#FFF"/>`),
    );
    expect(result.status, result.output).toBe(0);
    expect(result.stdout).toContain('palette: OK');
  });
});

describe('the lint FAILS, which is the half that cannot be taken on trust', () => {
  it('on a fill that is not in the palette', () => {
    const result = build(
      clean(`<rect x="0" y="0" width="10" height="10" fill="#ff00ff"/>`),
    );
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain('fill="#ff00ff" is not a colour in assets/style/palette.json');
    expect(result.output).toContain('add the colour there, with a ramp');
    // and it did not report a pass in the same breath
    expect(result.stdout).not.toContain('palette: OK');
  });

  it('on a STROKE that is not in the palette, not only a fill', () => {
    const result = build(
      clean(`<rect x="0" y="0" width="10" height="10" fill="none" stroke="#010203"/>`),
    );
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain('stroke="#010203" is not a colour');
  });

  it('on a colour hidden in an inline style attribute', () => {
    // The hole a lint that read only presentation attributes would have: the
    // source looks identical and paints a colour nobody allowed.
    const result = build(
      clean(`<rect x="0" y="0" width="10" height="10" style="fill:#ff00ff;opacity:0.5"/>`),
    );
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain('fill="#ff00ff" is not a colour');
  });

  it('on every forbidden construct, each named with its own reason', () => {
    // Table-driven from the same list the lint carries, so a construct added to
    // one and not the other shows up here rather than in a level six months on.
    const cases: readonly [string, string, string][] = [
      ['filter', `<defs><filter id="b"><feGaussianBlur stdDeviation="2"/></filter></defs>`, 'Canvas visual tier has no Filters'],
      ['linearGradient', `<defs><linearGradient id="g"><stop offset="0"/></linearGradient></defs>`, 'three flat fills per material'],
      ['radialGradient', `<defs><radialGradient id="g"><stop offset="0"/></radialGradient></defs>`, 'three flat fills per material'],
      ['text', `<text x="10" y="10">Ottawa</text>`, 'defeats the blind art hand-off'],
      ['image', `<image href="x.png" width="10" height="10"/>`, 'raster embedded in a source'],
      ['style', `<style>rect { fill: #ff00ff; }</style>`, 'fill declared in a stylesheet'],
    ];
    for (const [element, markup, why] of cases) {
      const result = build(clean(markup));
      expect(result.status, `<${element}> was accepted:\n${result.output}`).toBe(1);
      expect(result.output).toContain(`contains <${element}>`);
      expect(result.output).toContain(why);
    }
  });

  it('on a url() paint reference, while still allowing a clip-path', () => {
    const clipped = build(
      clean(
        `<defs><clipPath id="c"><rect width="10" height="10"/></clipPath></defs>` +
          `<rect width="10" height="10" fill="${COLOURS['snow-light']}" clip-path="url(#c)"/>`,
      ),
    );
    expect(clipped.status, clipped.output).toBe(0);

    // A paint server behind a url() is a colour the lint cannot read, which is
    // the same hole as <style> and is refused for the same reason.
    const painted = build(
      clean(`<rect width="10" height="10" fill="url(#c)"/>`),
    );
    expect(painted.status, painted.output).toBe(1);
    expect(painted.output).toContain('references a paint server, mask or filter by url()');
    expect(painted.output).toContain('Only clip-path may use url(#...)');
  });
});

describe('the floors, so an empty corpus cannot reduce to a pass (ADR-0024)', () => {
  it('fails a palette that declares no colours rather than passing every fill', () => {
    const result = build(clean(), { palette: { id: 'empty', colours: {} } });
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain('declares no colours');
    expect(result.output).toContain('ANTI-VACUUM FLOOR');
  });

  it('fails an unreadable palette rather than reporting nothing was off-palette', () => {
    const root = join(WORK, 'unreadable');
    mkdirSync(join(root, 'assets', 'src', 'svg', 'ottawa'), { recursive: true });
    mkdirSync(join(root, 'assets', 'style'), { recursive: true });
    mkdirSync(join(root, 'content', 'levels'), { recursive: true });
    writeFileSync(join(root, 'assets', 'style', 'palette.json'), '{ this is not json', 'utf8');
    writeFileSync(join(root, 'assets', 'src', 'svg', 'ottawa', 'skyline.svg'), clean(), 'utf8');
    const result = spawn(root);
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain('could not be read as JSON');
    expect(result.output).toContain('so nothing below was checked');
  });

  it('fails a source tree with no SVG in it at all', () => {
    const root = join(WORK, 'no-sources');
    mkdirSync(join(root, 'assets', 'style'), { recursive: true });
    mkdirSync(join(root, 'content', 'levels'), { recursive: true });
    writeFileSync(
      join(root, 'assets', 'style', 'palette.json'),
      JSON.stringify({ id: 'scratch-palette', colours: COLOURS }),
      'utf8',
    );
    const result = spawn(root);
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain('no SVG sources under assets/src/svg');
    expect(result.output).toContain('ANTI-VACUUM FLOOR');
  });

  it('fails a corpus in which nothing declares a fill or a stroke', () => {
    // The third way to score nothing: real files, real shapes, no paint. It is
    // reachable — an SVG of <defs> and <title> is a legal SVG — and "0
    // off-palette fills" over it is word-for-word a clean run.
    const result = build(
      `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10">` +
        `<title>nothing is painted here</title><defs/></svg>`,
    );
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain('not one declares a fill or a stroke');
    expect(result.output).toContain('ANTI-VACUUM FLOOR');
  });
});

describe('over the repository as it stands', () => {
  it('runs over every source in assets/src/svg, including art with no level document yet', () => {
    // THE PROPERTY THAT KEEPS THIS FROM BEING A DECORATION. `make assets`
    // resolves each source to an owning level and drops the ones it cannot
    // place; a lint over THAT list would silently skip every level whose art
    // landed before its document — which is the state this tree is in whenever
    // a level arrives, and was the state Halifax and Toronto were in when this
    // lint was written. So the count is compared against the SVGs on disk.
    //
    // Read from the tree rather than written down: art adds sources and an
    // assertion pinned to today's count fails on every legitimate addition
    // (ADR-0019).
    const countSvg = (dir: string): number =>
      readdirSync(dir, { withFileTypes: true }).reduce(
        (n, entry) =>
          entry.isDirectory()
            ? n + countSvg(join(dir, entry.name))
            : n + (entry.name.toLowerCase().endsWith('.svg') ? 1 : 0),
        0,
      );
    const onDisk = countSvg(join(REPO, 'assets', 'src', 'svg'));
    expect(onDisk, 'no SVG sources in the repository; this case has nothing to check').toBeGreaterThan(0);

    const result = spawn(REPO);
    // NOT an assertion about the exit code: `make assets` legitimately fails
    // today on art staged ahead of its level document, and that is a different
    // gate. What is asserted is that the palette verdict was reached and covers
    // every source on disk.
    expect(result.stdout).toContain('palette: OK');
    expect(result.stdout).toContain(`in ${onDisk} source(s)`);
  });
});
