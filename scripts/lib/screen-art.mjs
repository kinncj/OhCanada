/**
 * SCREEN ART: art that belongs to a DOM screen rather than to a level.
 *
 * WHY IT NEEDED A HOME
 *
 * `scripts/assets.mjs` answers "which level pays for this file?" from its path,
 * and had two answers: a level id, or `shared/`, which every level pays for. The
 * level-select map of Canada is neither. Under a directory of its own the build
 * refused it, correctly, as a file charged to no budget; under `shared/` the
 * build passed and was wrong twice - Halifax's decoded texture memory would have
 * gone from 29.50 to 39.39 MiB against a 34 MiB budget for a picture no level
 * draws, and art bible §9 forbids a source a level cannot place.
 *
 *   assets/src/svg/screens/<name>.svg              screen art
 *   assets/src/svg/screens/<name>.anchors.json     its sidecar, optional
 *
 * `screens`, because what decides the pipeline's treatment is WHO DRAWS IT: a
 * DOM screen (app/ui/*-screen.ts, level-select.ts) and not Phaser. `map/` would
 * name one picture and the next piece of screen art would need another reserved
 * word; `ui/` is ambiguous with HUD sprites, which ARE drawn by Phaser and
 * belong in `shared/`.
 *
 * WHAT HAPPENS TO IT
 *
 *   - palette-linted: it is under assets/src/svg, and scripts/lib/palette-lint.mjs
 *     walks that whole tree, so it is linted by the same code as level art;
 *   - credit-gated: scripts/validate-content.mjs walks all of assets/;
 *   - NEVER rasterised, never packed, absent from assets/dist/manifest.json and
 *     charged to no level: assets.mjs leaves this directory out of its source
 *     list, so neither budget gate can see it and no level document can name it;
 *   - shipped by the UI build, verbatim: the screen that shows it resolves the
 *     SVG's URL through Vite (content-hashed, emitted when something imports it)
 *     and imports the sidecar as JSON. See the report that landed this for why
 *     not a copy into assets/dist and not an inline SVG.
 *
 * WHY IT IS CHECKED MORE STRICTLY THAN LEVEL ART
 *
 * Level art is rasterised by librsvg and reaches a player as pixels. Screen art
 * reaches a player as the SVG itself, from this site's origin, so three things
 * that are inert in a level source are not inert here:
 *
 *   - `<script>`, `<foreignObject>` and `on*=` handlers run, or render HTML, the
 *     moment the file's URL is opened directly;
 *   - an `href` that is not a `#fragment` fetches something else;
 *   - `<title>` and `<desc>` become an English accessible name and tooltip when
 *     the SVG is inlined, and player-facing words live in the copy tables in EN
 *     and FR (ADR-0010).
 *
 * And a root `viewBox` is required, because a sidecar's coordinates are stated
 * in it and CSS cannot scale an SVG that has none.
 *
 * THE DIRECTORY IS FLAT, AND EVERY FILE IN IT IS ONE OF TWO KINDS
 *
 * A subdirectory is refused because nothing validates its name: `levelId/` is
 * checked against content/levels/ and `shared/` is a constant, and a
 * `screens/<anything>/` would be an owner nobody checks - the exact defect the
 * unknown-directory failure in assets.mjs exists for, one level down. A file that
 * is neither an SVG nor a `<name>.anchors.json` sidecar is refused because
 * everything here ships unrasterised and the palette lint reads SVG only.
 *
 * THE FLOORS (ADR-0024)
 *
 *   - the directory exists and holds no SVG: a failure, not "0 screen sources";
 *   - a sidecar with no drawing beside it: a failure;
 *   - a sidecar's anchors cross-checked against zero places: a failure.
 *
 * An ABSENT directory is legal - a build with no screen art - and assets.mjs
 * says so in words rather than printing a count of zero.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

/** The reserved directory name under assets/src/svg/. */
export const SCREENS_OWNER = 'screens';

/** A sidecar is `<name>.anchors.json` beside `<name>.svg`. */
export const SIDECAR_SUFFIX = '.anchors.json';

/** The schema every sidecar must declare; the cross-checks below assume its shape. */
export const SIDECAR_SCHEMA = 'map-anchors.schema.json';

const SCREENS_REL = `assets/src/svg/${SCREENS_OWNER}/`;

/**
 * Constructs that are inert in a rasterised level source and live in a shipped
 * SVG. Matched after comments are removed, since a comment is inert either way.
 */
const DOM_FORBIDDEN = [
  ['script', 'an SVG served from this origin runs its scripts when its URL is opened directly'],
  ['foreignObject', 'it renders HTML inside the drawing, which no gate here reads'],
  [
    'title',
    'inlined, it becomes an English accessible name and tooltip; player-facing words live in the ' +
      'copy tables in EN and FR (ADR-0010)',
  ],
  ['desc', 'inlined, it is read out by a screen reader in English; words live in the copy tables (ADR-0010)'],
];

const stripComments = (text) => text.replace(/<!--[\s\S]*?-->/g, '');

/**
 * The root element's `viewBox` as four numbers, or null when there is none or
 * it is not four finite numbers with a positive width and height.
 */
export function readViewBox(svgText) {
  const root = /<svg\b[^>]*>/i.exec(stripComments(svgText));
  if (root === null) return null;
  const attr = /\bviewBox\s*=\s*"([^"]*)"/.exec(root[0]);
  if (attr === null) return null;
  const numbers = attr[1].trim().split(/[\s,]+/).map(Number);
  if (numbers.length !== 4 || numbers.some((n) => !Number.isFinite(n))) return null;
  if (numbers[2] <= 0 || numbers[3] <= 0) return null;
  return numbers;
}

/** Failures for one screen SVG's text, beyond what the palette lint already refuses. */
function domFailures(rel, text) {
  const failures = [];
  const body = stripComments(text);
  for (const [element, why] of DOM_FORBIDDEN) {
    if (new RegExp(`<${element}[\\s/>]`, 'i').test(body)) {
      failures.push(`${rel}: contains <${element}>. Forbidden in screen art, which ships as SVG rather than pixels: ${why}.`);
    }
  }
  for (const match of body.matchAll(/\s(on[a-z]+)\s*=/gi)) {
    failures.push(
      `${rel}: carries an ${match[1]}= event handler. Screen art ships as SVG from this site's origin, ` +
        'where a handler is script.',
    );
  }
  for (const match of body.matchAll(/\s((?:xlink:)?href)\s*=\s*"([^"]*)"/gi)) {
    if (match[2].startsWith('#')) continue;
    failures.push(
      `${rel}: ${match[1]}="${match[2]}" points outside the drawing. Screen art may reference only its own ` +
        '#fragments; anything else is a fetch nobody credits or lints.',
    );
  }
  if (readViewBox(text) === null) {
    failures.push(
      `${rel}: the root <svg> has no usable viewBox (four numbers, positive width and height). A screen ` +
        'scales the drawing with CSS, and a sidecar states its coordinates in the viewBox.',
    );
  }
  return failures;
}

/**
 * Walk assets/src/svg/screens/ and apply the directory's own rules.
 *
 * @returns `{ exists, svgs, sidecars, failures }` where `svgs` is
 *   `[{ file, rel, bytes, gzipBytes }]` and `sidecars` is `[{ file, rel, svg }]`,
 *   `svg` being the drawing's filename. Never throws for a malformed tree.
 */
export function screenArtTree({ root }) {
  const dir = join(root, 'assets', 'src', 'svg', SCREENS_OWNER);
  const failures = [];
  const svgs = [];
  const sidecars = [];

  if (!existsSync(dir)) return { exists: false, svgs, sidecars, failures };
  if (!statSync(dir).isDirectory()) {
    failures.push(
      `${SCREENS_REL.slice(0, -1)} is a file. "${SCREENS_OWNER}" is the reserved directory for screen art; ` +
        'a file by that name is neither screen art nor a level source.',
    );
    return { exists: true, svgs, sidecars, failures };
  }

  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const fileNames = new Set(entries.filter((e) => e.isFile()).map((e) => e.name));

  for (const entry of entries) {
    const file = join(dir, entry.name);
    const rel = `${SCREENS_REL}${entry.name}`;

    if (entry.isDirectory()) {
      failures.push(
        `${rel}/ is a subdirectory of the screen-art home, and screen art is flat. A level directory's name ` +
          `is checked against content/levels/ and "shared" is a constant; nothing checks a name under ` +
          `"${SCREENS_OWNER}/", so it would be an owner nobody validates. Move its files up into ${SCREENS_REL}.`,
      );
      continue;
    }
    if (!entry.isFile()) {
      failures.push(`${rel} is not a regular file (a link?). Screen art ships verbatim, so it must be the file itself.`);
      continue;
    }

    if (entry.name.endsWith(SIDECAR_SUFFIX)) {
      const svg = `${entry.name.slice(0, -SIDECAR_SUFFIX.length)}.svg`;
      if (!fileNames.has(svg)) {
        failures.push(
          `${rel} is a sidecar with no drawing: ${SCREENS_REL}${svg} does not exist. A sidecar states ` +
            'coordinates in the viewBox of the SVG it is named after, and without it they describe nothing.',
        );
        continue;
      }
      sidecars.push({ file, rel, svg });
      continue;
    }

    if (entry.name.toLowerCase().endsWith('.svg')) {
      let buffer;
      try {
        buffer = readFileSync(file);
      } catch (error) {
        failures.push(`${rel} could not be read (${error.message}); it was not checked.`);
        continue;
      }
      failures.push(...domFailures(rel, buffer.toString('utf8')));
      svgs.push({ file, rel, bytes: buffer.length, gzipBytes: gzipSync(buffer).length });
      continue;
    }

    failures.push(
      `${rel} is neither an SVG nor a "<name>${SIDECAR_SUFFIX}" sidecar. Everything in ${SCREENS_REL} ships ` +
        'to players through the UI build without being rasterised, and the palette lint reads SVG only, ' +
        'so any other file type would ship unchecked.',
    );
  }

  if (svgs.length === 0) {
    failures.push(
      `${SCREENS_REL} exists and holds no SVG. ANTI-VACUUM FLOOR (ADR-0024): a screen-art directory with ` +
        'nothing in it is not screen art that passed. Add the drawing, or remove the directory.',
    );
  }

  return { exists: true, svgs, sidecars, failures };
}

/** One line for the build log. Absence is said in words, never as a count of zero. */
export function describeScreenArt(tree) {
  if (!tree.exists) return `none - ${SCREENS_REL} does not exist, so no screen art ships`;
  const bytes = tree.svgs.reduce((sum, s) => sum + s.bytes, 0);
  const gzip = tree.svgs.reduce((sum, s) => sum + s.gzipBytes, 0);
  return (
    `${tree.svgs.length} SVG source(s) and ${tree.sidecars.length} sidecar(s) in ${SCREENS_REL} ` +
    `(${bytes} B raw, ${gzip} B gzip): palette-linted with the rest, not rasterised, not in the manifest, ` +
    'charged to no level; the UI build ships them'
  );
}

const inRect = (p, r) => p.x >= r.x && p.y >= r.y && p.x <= r.x + r.width && p.y <= r.y + r.height;
const rectInRect = (a, b) =>
  a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height;
/** Interiors intersect; frames that share an edge do not overlap. */
const rectsOverlap = (a, b) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
/**
 * How far `p` is outside `r` along the axis it is furthest out on; 0 inside.
 * A point is within `r` grown by `d` on every side exactly when this is <= d.
 */
const pointRectGap = (p, r) =>
  Math.max(0, r.x - p.x, p.x - (r.x + r.width), r.y - p.y, p.y - (r.y + r.height));
/** The same measure between two rectangles: 0 when they touch or overlap. */
const rectGap = (a, b) =>
  Math.max(0, b.x - (a.x + a.width), a.x - (b.x + b.width), b.y - (a.y + a.height), a.y - (b.y + b.height));
const round = (n) => Math.round(n * 10) / 10;
/**
 * Pin separation passes at exactly one diameter (§3.4 says "at least"). The
 * distance and the diameter are both computed in floating point from numbers
 * stated to 0.1 units, so a pair placed at exactly the diameter can come out a
 * few ulps short; this absorbs that and nothing a drawing could show.
 */
const SEPARATION_SLACK = 1e-9;
const fmtPoint = (p) => `(${p.x}, ${p.y})`;
const fmtRect = (r) => `(${r.x}, ${r.y}, ${r.width} x ${r.height})`;

/** The stylesheet that sizes a map pin, and the rule in it that does. */
export const PIN_STYLESHEET = 'app/ui/screen-styles.ts';
const PIN_RULE = '.tn-map .tn-map__stop .tn-journey__pin';

/**
 * A map pin's diameter as a fraction of the drawing's width, read from the rule
 * that draws it, or a sentence saying why it could not be read.
 *
 * The pin is sized in `cqi` of the map, whose inline size is the drawing's, so
 * `inline-size: Ncqi` is N % of the viewBox width. The last `cqi` inline-size in
 * the rule wins, as it does in the browser (the `rem` one before it is the
 * fallback for an engine without container units).
 *
 * THIS RULE IS THE FRACTION'S ONE HOME (ADR-0069 §3.4, settled in §6 commit 3).
 * The number is read by two runtimes: the browser, which draws the pin from
 * this stylesheet, and this Node script, which measures frames and pairs of
 * pins against it. A shared constant module would need `screen-styles.ts` to
 * interpolate it into its CSS text, which moves the one home into a second file
 * and leaves the stylesheet without the number a reader of it expects to see.
 * Reading the declaration the browser itself applies keeps one literal, in the
 * place it takes effect, and a pin resized there resizes every check here
 * (tests/unit/infra/screen-art-gate.test.ts shows a wider pin turning a passing
 * sidecar red). The fraction is never restated in this file or its tests.
 * When the rule or its `cqi` inline-size cannot be found, the gate fails; it
 * never falls back to a number of its own.
 */
export function readPinFraction(root) {
  const where = `${PIN_STYLESHEET} rule "${PIN_RULE}"`;
  let text;
  try {
    text = readFileSync(join(root, PIN_STYLESHEET), 'utf8');
  } catch (error) {
    return (
      `the map pin's size could not be read from ${PIN_STYLESHEET} (${error.message}), so no frame can ` +
      'be checked against a main-map pin (ADR-0069 §3.3) and no two pins against each other (§3.4).'
    );
  }
  const at = text.indexOf(`${PIN_RULE} {`);
  const close = at === -1 ? -1 : text.indexOf('}', at);
  const body = close === -1 ? '' : text.slice(at, close);
  const sizes = [...body.matchAll(/(?:^|[\s;{])inline-size:\s*([0-9]*\.?[0-9]+)cqi\s*;/g)].map((m) => Number(m[1]));
  const last = sizes.at(-1);
  if (last === undefined || !(last > 0)) {
    return (
      `no "inline-size: <n>cqi" in the ${where}, so the pin's size is unknown and no frame can be ` +
      'checked against a main-map pin (ADR-0069 §3.3) and no two pins against each other (§3.4).'
    );
  }
  return last / 100;
}

/**
 * The claims in a sidecar that its schema cannot state, checked against the two
 * things they are about: the drawing beside it and the places the map shows.
 *
 * UI code will place a marker at these coordinates without looking at the map,
 * so every one is checked here rather than trusted there:
 *
 *   1. `svg` names the drawing the sidecar sits beside;
 *   2. `viewBox` is that drawing's own viewBox;
 *   3. there is exactly one anchor per place `game.config.json#/journey` names,
 *      both directions. A `null` slot names no place and takes no anchor.
 *   4. every anchor lies inside the viewBox;
 *   5. each inset's frame lies inside the viewBox, its window inside its frame,
 *      its anchors inside its window and name stops the main map anchors, and
 *      each of those main-map anchors lies inside its locator box;
 *   6. across insets (ADR-0069 §3.1-§3.3): a stop is in at most one inset; a
 *      locator encloses no main-map point of a stop its inset does not anchor;
 *      no two frames overlap; and no main-map pin (a stop in no inset) lies
 *      within a frame's rectangle grown by one pin radius. The pin's size is
 *      read from the stylesheet that draws it (`readPinFraction`), never
 *      restated here;
 *   7. pin separation (ADR-0069 §3.4), for every frame: any two pins drawn in
 *      the same frame are at least one pin diameter apart. The main map's pins
 *      are the stops in no inset; an inset's pins are its own anchors. The
 *      diameter is the same stylesheet fraction times the viewBox width;
 *   8. every region id listed is an `id` in the drawing.
 *
 * The result's `insets` carries what the cross-inset checks measured, and its
 * `separation` the closest pair in every frame, so the summary line can say it, and can say in words when there was no inset to
 * measure rather than count a pass over none (ADR-0024).
 *
 * `sidecars` are `{ rel, file, svg, doc }` whose `doc` has ALREADY passed
 * content/schemas/map-anchors.schema.json; a sidecar that failed its schema is
 * reported there and not again here.
 *
 * `places` are the non-null ids of `game.config.json#/journey`, or `null` when
 * the config could not be read. The rule is keyed on the journey and NOT on the
 * documents in content/levels/ (ADR-0069, the boundary defect in §6). The map
 * pins what the journey names (`app/ui/level-map.ts` places the level select's
 * stops, which are journey slots), so the journey is what the anchors must
 * agree with. Keyed on content/levels/, a level document (content's) and its
 * anchor (art's) could only land in one commit by two owners. Keyed on the
 * journey, art anchors a place once the journey names it, and content lands the
 * level document on its own commit.
 */
export function checkScreenSidecars({ root, sidecars, places }) {
  const failures = [];
  let anchors = 0;
  let regions = 0;
  let insetCount = 0;
  let enlarged = 0;
  let locators = 0;
  let framePairs = 0;
  let mainPins = 0;
  let minFrameGap = Infinity;
  let minClearance = Infinity;
  let pinRadius = null;
  let pinDiameter = null;
  /** One entry per frame drawn: `{ frame, pins, closest }`, `closest` null when it holds under two pins. */
  const separation = [];
  /** The pin fraction, read once when an inset needs it; a string says why it could not be. */
  let pin;
  const measured = () => ({
    insets: insetCount,
    enlarged,
    locators,
    framePairs,
    minFrameGap: Number.isFinite(minFrameGap) ? round(minFrameGap) : null,
    mainPins,
    minClearance: Number.isFinite(minClearance) ? round(minClearance) : null,
    pinRadius: pinRadius === null ? null : round(pinRadius),
  });
  const measuredSeparation = () => ({
    pinDiameter: pinDiameter === null ? null : round(pinDiameter),
    frames: separation,
  });
  const result = (checked) => ({
    failures,
    anchors,
    regions,
    checked,
    insets: measured(),
    separation: measuredSeparation(),
  });

  if (sidecars.length === 0) return result(0);

  if (places === null) {
    failures.push(
      `${sidecars.map((s) => s.rel).join(', ')}: anchors are checked against the places ` +
        'content/game.config.json#/journey names, and that journey could not be read.',
    );
    return result(0);
  }
  if (places.length === 0) {
    failures.push(
      `${sidecars.map((s) => s.rel).join(', ')}: anchors were to be checked against the places ` +
        'content/game.config.json#/journey names and it names none. ANTI-VACUUM FLOOR (ADR-0024): ' +
        '"every anchor names a place" is vacuously true of no places.',
    );
    return result(0);
  }

  for (const { rel, svg, doc } of sidecars) {
    if (doc.svg !== svg) {
      failures.push(
        `${rel}: "svg" is "${doc.svg}", but the sidecar sits beside ${svg}. A sidecar describes the drawing ` +
          'it is named after.',
      );
    }

    let svgText = null;
    try {
      svgText = readFileSync(join(root, SCREENS_REL, svg), 'utf8');
    } catch (error) {
      failures.push(`${rel}: its drawing ${SCREENS_REL}${svg} could not be read (${error.message}).`);
    }
    const drawn = svgText === null ? null : readViewBox(svgText);
    if (svgText !== null && drawn === null) {
      failures.push(`${rel}: ${SCREENS_REL}${svg} has no usable viewBox, so no coordinate here can be checked.`);
    }
    if (drawn !== null && drawn.some((n, i) => n !== doc.viewBox[i])) {
      failures.push(
        `${rel}: "viewBox" is [${doc.viewBox.join(', ')}], but ${svg} declares viewBox "${drawn.join(' ')}". ` +
          'Every coordinate in the sidecar is stated in the viewBox, so a different one moves every marker.',
      );
    }

    const box = { x: doc.viewBox[0], y: doc.viewBox[1], width: doc.viewBox[2], height: doc.viewBox[3] };
    const named = Object.keys(doc.anchors).sort();
    for (const id of places) {
      if (!named.includes(id)) {
        failures.push(
          `${rel}: no anchor for "${id}", which game.config.json#/journey names. The screen would have a stop ` +
            'it cannot place on the map.',
        );
      }
    }
    for (const id of named) {
      if (!places.includes(id)) {
        failures.push(
          `${rel}: anchors."${id}" names no place in game.config.json#/journey (${places.join(', ')}).`,
        );
      }
      const point = doc.anchors[id];
      anchors += 1;
      if (!inRect(point, box)) {
        failures.push(`${rel}: anchors."${id}" at ${fmtPoint(point)} lies outside the viewBox ${fmtRect(box)}.`);
      }
    }

    const insets = Array.isArray(doc.insets) ? doc.insets : [];
    const home = new Map();
    insets.forEach((inset, index) => {
      const at = `insets[${index}]`;
      insetCount += 1;
      if (!rectInRect(inset.frame, box)) {
        failures.push(`${rel}: ${at}.frame ${fmtRect(inset.frame)} is not inside the viewBox ${fmtRect(box)}.`);
      }
      if (!rectInRect(inset.window, inset.frame)) {
        failures.push(`${rel}: ${at}.window ${fmtRect(inset.window)} is not inside ${at}.frame ${fmtRect(inset.frame)}.`);
      }
      if (!rectInRect(inset.locator, box)) {
        failures.push(`${rel}: ${at}.locator ${fmtRect(inset.locator)} is not inside the viewBox ${fmtRect(box)}.`);
      }
      for (const [id, point] of Object.entries(inset.anchors)) {
        anchors += 1;
        if (!inRect(point, inset.window)) {
          failures.push(
            `${rel}: ${at}.anchors."${id}" at ${fmtPoint(point)} lies outside ${at}.window ${fmtRect(inset.window)}.`,
          );
        }
        /* ADR-0069 §3.1: enlarged twice, a stop would have two pins and be at
           two ends of a route leg. */
        if (home.has(id)) {
          failures.push(
            `${rel}: ${at}.anchors."${id}" is also anchored in insets[${home.get(id)}]. A stop is in at most ` +
              'one inset (ADR-0069 §3.1); in two it would have two pins and two ends to every leg.',
          );
        } else {
          home.set(id, index);
          enlarged += 1;
        }
        const main = doc.anchors[id];
        if (main === undefined) {
          failures.push(`${rel}: ${at}.anchors."${id}" has no main-map anchor; an inset enlarges a stop the map already has.`);
        } else if (!inRect(main, inset.locator)) {
          failures.push(
            `${rel}: anchors."${id}" at ${fmtPoint(main)} is outside ${at}.locator ${fmtRect(inset.locator)}, ` +
              'so the inset shows a stop its locator box does not point at.',
          );
        }
      }
      /* ADR-0069 §3.2, the converse: the locator points at no stop its inset
         does not show. */
      for (const [id, main] of Object.entries(doc.anchors)) {
        if (Object.hasOwn(inset.anchors, id)) continue;
        if (inRect(main, inset.locator)) {
          failures.push(
            `${rel}: anchors."${id}" at ${fmtPoint(main)} lies inside ${at}.locator ${fmtRect(inset.locator)}, ` +
              `and ${at} does not anchor it. A locator encloses exactly the stops its inset shows ` +
              '(ADR-0069 §3.2); a box round a stop the inset leaves out is a false pointer.',
          );
        }
      }
      locators += 1;
    });

    /* ADR-0069 §3.3: frames apart from one another, and clear of main-map pins
       by one pin radius. */
    for (let i = 0; i < insets.length; i += 1) {
      for (let j = i + 1; j < insets.length; j += 1) {
        const a = insets[i].frame;
        const b = insets[j].frame;
        framePairs += 1;
        minFrameGap = Math.min(minFrameGap, rectGap(a, b));
        if (rectsOverlap(a, b)) {
          failures.push(
            `${rel}: insets[${i}].frame ${fmtRect(a)} and insets[${j}].frame ${fmtRect(b)} overlap. Frames ` +
              'do not overlap one another (ADR-0069 §3.3); one would hide the other.',
          );
        }
      }
    }
    /* The pin is read for every sidecar with anchors, inset or none: §3.4
       measures the main map's pins whether or not any frame is drawn. */
    if (pin === undefined) pin = readPinFraction(root);
    if (typeof pin === 'string') {
      failures.push(`${rel}: ${pin}`);
    } else {
      const diameter = pin * box.width;
      const radius = diameter / 2;
      pinDiameter = diameter;
      if (insets.length > 0) {
        pinRadius = radius;
        for (const [id, point] of Object.entries(doc.anchors)) {
          if (home.has(id)) continue;
          mainPins += 1;
          insets.forEach((inset, index) => {
            const clearance = pointRectGap(point, inset.frame);
            minClearance = Math.min(minClearance, clearance);
            if (clearance <= radius) {
              failures.push(
                `${rel}: the main-map pin for "${id}" at ${fmtPoint(point)} is ${round(clearance)} unit(s) from ` +
                  `insets[${index}].frame ${fmtRect(inset.frame)}, within one pin radius (${round(radius)}). ` +
                  'A frame drawn over a pin hides it (ADR-0069 §3.3).',
              );
            }
          });
        }
      }

      /* ADR-0069 §3.4: any two pins drawn in one frame are at least one pin
         diameter apart. */
      const frames = [
        {
          frame: 'the main map',
          pins: Object.entries(doc.anchors).filter(([id]) => !home.has(id)),
          name: (id) => `anchors."${id}"`,
        },
        ...insets.map((inset, index) => ({
          frame: `insets[${index}]`,
          pins: Object.entries(inset.anchors),
          name: (id) => `insets[${index}].anchors."${id}"`,
        })),
      ];
      for (const { frame, pins, name } of frames) {
        let closest = null;
        for (let i = 0; i < pins.length; i += 1) {
          for (let j = i + 1; j < pins.length; j += 1) {
            const [a, p] = pins[i];
            const [b, q] = pins[j];
            const distance = Math.hypot(q.x - p.x, q.y - p.y);
            if (closest === null || distance < closest.distance) closest = { a, b, distance };
            if (distance < diameter - SEPARATION_SLACK) {
              failures.push(
                `${rel}: ${name(a)} at ${fmtPoint(p)} and ${name(b)} at ${fmtPoint(q)} are ${round(distance)} ` +
                  `unit(s) apart on ${frame}, closer than one pin diameter (${round(diameter)}), so their pins ` +
                  'overlap. Any two pins drawn in the same frame are at least one pin diameter apart ' +
                  '(ADR-0069 §3.4). Enlarge them in an inset rather than nudge an anchor, which is a claim ' +
                  'about where a place is.',
              );
            }
          }
        }
        separation.push({
          frame,
          pins: pins.length,
          closest: closest === null ? null : { a: closest.a, b: closest.b, distance: round(closest.distance) },
        });
      }
    }

    if (svgText !== null && Array.isArray(doc.provincesAndTerritories)) {
      const body = stripComments(svgText);
      for (const code of doc.provincesAndTerritories) {
        regions += 1;
        if (!body.includes(`id="${code}"`)) {
          failures.push(`${rel}: provincesAndTerritories lists "${code}", and ${svg} has no element with id="${code}".`);
        }
      }
    }
  }

  return result(sidecars.length);
}
