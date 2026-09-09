/**
 * THE PALETTE LINT: every fill and stroke in assets/src/svg is a colour the
 * palette declares, and no source uses a construct the renderer cannot draw.
 *
 * WHY IT EXISTS, AND WHY IT IS BEING WRITTEN ON A DAY IT PASSES
 *
 * `assets/style/art-bible.md` §2 and `CLAUDE.md` both said "the palette lint
 * fails on anything else", and there was no palette lint. `validate-content.mjs`
 * checks the palette's INTERNAL integrity -- every ramp tone and ink resolves to
 * a key of `colours` -- and never opens an SVG; `assets.mjs` rasterises all 80
 * sources and never reads `palette.json`. The rule was real, written down twice,
 * and enforced by hand on every level so far (OQ-ART-11, and OQ-ART-02 was
 * closed for being exactly that).
 *
 * The art agent's hand run over the tree as it stands found 0 off-palette fills
 * and 0 forbidden constructs across 3 648 shapes, and that is the argument FOR
 * writing it now rather than against: a gate added on the day it would fail is a
 * gate someone is under pressure to soften. This one is added while it is green,
 * so the first time it goes red the only thing in question is the art.
 *
 * WHAT IT REFUSES
 *
 *   1. Any `fill` or `stroke` -- attribute or inline `style` -- whose value is
 *      not `none` and not one of `palette.json`'s `colours`. The palette is the
 *      allow-list; adding a colour there, with a ramp, is the way to use one.
 *   2. `<filter>`, `<linearGradient>`, `<radialGradient>`, `<image>`, `<style>`.
 *      The house style is three flat fills per material with no gradients and no
 *      runtime filters, and the Canvas visual tier has no Filters at all
 *      (ADR-0011), so a source using one draws differently on the tier the
 *      budget was measured at. `<style>` moves a fill out of the attribute this
 *      lint reads, which would make rule 1 unenforceable rather than merely
 *      broken.
 *   3. `<text>`. Two independent reasons, and both are load-bearing: the art
 *      bible forbids lettering, and scripts/lib/art-handoff.mjs refuses it
 *      because a name PAINTED INTO an image survives every byte-level leak scan
 *      the blind hand-off performs. That one is checked in two places on
 *      purpose; they fail for different reasons and neither is a duplicate.
 *   4. Any `url(#...)` reference outside `clip-path`. A clip is geometry; a
 *      paint server, mask or filter reference behind a `url()` is a colour this
 *      lint cannot see, which is the same hole as `<style>`.
 *
 * WHAT IT DOES NOT CHECK, DELIBERATELY
 *
 * Whether a colour is the RIGHT one -- whether a wall should be brick or stone,
 * whether a ramp's three tones are used as light/base/shade -- is art's
 * judgement and is not mechanisable. This is an allow-list check and says so.
 *
 * THE FLOORS (ADR-0024)
 *
 * Three separate ways this could report a pass over nothing, so three floors:
 * a palette with no colours, a source tree with no SVGs, and a corpus in which
 * nothing declared a fill or a stroke. `every([])` is `true` and "0 off-palette
 * fills" reads exactly like a clean run, which is the whole shape ADR-0024
 * names. A source that cannot be READ is a failure too, not a skip: a lint that
 * quietly passes over the file it could not open is the same vacuum with an
 * error message.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';

/** Elements no render source may contain, and why each one matters here. */
const FORBIDDEN_ELEMENTS = [
  ['filter', 'the Canvas visual tier has no Filters (ADR-0011), so it would draw differently there'],
  ['linearGradient', 'the house style is three flat fills per material, never a gradient'],
  ['radialGradient', 'the house style is three flat fills per material, never a gradient'],
  ['text', 'no lettering in any level, and a word painted into an image defeats the blind art hand-off'],
  ['image', 'a raster embedded in a source carries colours this lint cannot read'],
  ['style', 'a fill declared in a stylesheet is a fill this lint cannot read'],
];

/** `#abc` -> `#aabbcc`; anything else lowercased and left alone. */
export function normaliseColour(value) {
  const text = String(value).trim().toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(text);
  return short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : text;
}

/** Every `.svg` under `dir`, absolute and sorted, so the report is stable. */
function walkSvg(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkSvg(full));
    else if (entry.isFile() && extname(entry.name).toLowerCase() === '.svg') out.push(full);
  }
  return out;
}

/**
 * @param root       repository root.
 * @param svgDir     defaults to `<root>/assets/src/svg`.
 * @param palettePath defaults to `<root>/assets/style/palette.json`.
 * @returns `{ failures, sourcesChecked, shapesChecked, coloursAllowed, summary }`
 */
export function lintPalette({ root, svgDir = null, palettePath = null } = {}) {
  const failures = [];
  const paletteFile = palettePath ?? join(root, 'assets', 'style', 'palette.json');
  const sourceDir = svgDir ?? join(root, 'assets', 'src', 'svg');
  const rel = (absolute) => relative(root, absolute).split(sep).join('/');

  let allowed;
  try {
    const palette = JSON.parse(readFileSync(paletteFile, 'utf8'));
    const colours = palette?.colours;
    const values =
      colours && typeof colours === 'object' && !Array.isArray(colours) ? Object.values(colours) : [];
    allowed = new Set(values.map(normaliseColour));
  } catch (error) {
    // Not a skip. An unreadable allow-list means every colour is unchecked, and
    // "nothing was off-palette" would be true of a run that checked nothing.
    failures.push(
      `${rel(paletteFile)} could not be read as JSON (${error.message}); the allow-list every ` +
        `fill is checked against is missing, so nothing below was checked.`,
    );
    return { failures, sourcesChecked: 0, shapesChecked: 0, coloursAllowed: 0, summary: 'not run' };
  }

  if (allowed.size === 0) {
    failures.push(
      `${rel(paletteFile)} declares no colours. ANTI-VACUUM FLOOR (ADR-0024): an empty allow-list ` +
        `makes every fill off-palette or none of them, depending on which way the check is written, ` +
        `and neither answer is about the art.`,
    );
    return { failures, sourcesChecked: 0, shapesChecked: 0, coloursAllowed: 0, summary: 'not run' };
  }

  const files = walkSvg(sourceDir);
  if (files.length === 0) {
    failures.push(
      `no SVG sources under ${rel(sourceDir)}. ANTI-VACUUM FLOOR (ADR-0024): "0 off-palette fills" ` +
        `over an empty tree is character-for-character the output of a clean run.`,
    );
    return { failures, sourcesChecked: 0, shapesChecked: 0, coloursAllowed: allowed.size, summary: 'not run' };
  }

  let shapesChecked = 0;
  let sourcesChecked = 0;

  for (const file of files) {
    let svg;
    try {
      svg = readFileSync(file, 'utf8');
    } catch (error) {
      failures.push(`${rel(file)} could not be read (${error.message}); it was not linted.`);
      continue;
    }
    sourcesChecked += 1;

    for (const [element, why] of FORBIDDEN_ELEMENTS) {
      // `[\s/>]` so `<style` does not match `<stylesheetish` and `<text` does
      // not match `<textPath` -- which is forbidden too, but under its own name
      // rather than by accident.
      if (new RegExp(`<${element}[\\s/>]`, 'i').test(svg)) {
        failures.push(`${rel(file)}: contains <${element}>. Forbidden in a render source: ${why}.`);
      }
    }

    // `url(#...)` is legitimate for a clip and for nothing else here. Matched on
    // the attribute it sits in rather than on the reference, so a `fill="url(#g)"`
    // is named as what it is: a colour this lint cannot see.
    for (const match of svg.matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*url\(#[^)"]*\)[^"]*)"/g)) {
      if (match[1].toLowerCase() === 'clip-path') continue;
      failures.push(
        `${rel(file)}: ${match[1]}="${match[2]}" references a paint server, mask or filter by url(). ` +
          `Only clip-path may use url(#...): everything else hides a colour from this lint.`,
      );
    }

    /**
     * Fills and strokes, from the presentation attribute and from an inline
     * `style`. Both forms, because a source that moved one fill into a `style`
     * attribute would otherwise be unlinted while looking identical.
     */
    const declarations = [
      ...[...svg.matchAll(/\b(fill|stroke)\s*=\s*"([^"]*)"/g)].map((m) => [m[1], m[2]]),
      ...[...svg.matchAll(/\bstyle\s*=\s*"([^"]*)"/g)].flatMap((m) =>
        [...m[1].matchAll(/(?:^|;)\s*(fill|stroke)\s*:\s*([^;]+)/g)].map((d) => [d[1], d[2]]),
      ),
    ];

    for (const [property, raw] of declarations) {
      shapesChecked += 1;
      const value = normaliseColour(raw);
      if (value === 'none') continue;
      if (allowed.has(value)) continue;
      failures.push(
        `${rel(file)}: ${property}="${String(raw).trim()}" is not a colour in ` +
          `${rel(paletteFile)}. The palette is the allow-list: add the colour there, with a ramp, ` +
          `before a source uses it.`,
      );
    }
  }

  if (shapesChecked === 0) {
    failures.push(
      `${sourcesChecked} SVG source(s) under ${rel(sourceDir)} and not one declares a fill or a ` +
        `stroke. ANTI-VACUUM FLOOR (ADR-0024): a corpus that paints nothing is not a corpus that ` +
        `paints only palette colours.`,
    );
  }

  return {
    failures,
    sourcesChecked,
    shapesChecked,
    coloursAllowed: allowed.size,
    summary:
      `${shapesChecked} fill/stroke declaration(s) in ${sourcesChecked} source(s) against ` +
      `${allowed.size} distinct palette colour(s); no gradient, filter, stylesheet, embedded raster, ` +
      `lettering or url() paint`,
  };
}
