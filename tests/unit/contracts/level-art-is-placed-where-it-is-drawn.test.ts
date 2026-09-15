/**
 * A level document is a set of claims about art it does not contain, and this
 * is the gate for the two of them that nothing else checks.
 *
 * ### 1. Every key names a source that exists
 *
 * `scripts/assets.mjs` resolves a source file to a level **by its directory
 * name**, and refuses to guess: a file under `assets/src/svg/<id>/` is charged
 * to level `<id>` or it is an ordering error. That is one direction of the rule.
 * The other direction has no gate at all — a level document may name
 * `halifax-layer-40-quaiside` and nothing fails, because `LevelScene` asks the
 * texture manager whether the key resolves and draws a flat band in the level's
 * theme colours when it does not. A misspelled key is therefore not a crash and
 * not a build failure; it is a plainer backdrop that looks deliberate. This
 * closes that, from the documents' side, against the sources on disk.
 *
 * ### 2. What a weak phone is left with
 *
 * `selectLayers` keeps the layers that cover the most screen, clipped at the
 * ground line, and `low` keeps two of them. Which two is a **composition
 * decision** taken in the art, not a consequence of the stack: Toronto's
 * skyline tile was authored 420 rows rather than 400 expressly so that it
 * out-covers the boulevard and survives beside the sky, and Halifax's quayside
 * out-covers the uptown band for the same reason. Both are recorded in
 * `assets/style/*-level.md` §2 and neither is visible in the document — a
 * later trim of thirty rows off a tile, or an `offset.y` moved by fifty in the
 * document, would swap what the weakest device shows and break nothing that
 * anyone would notice.
 *
 * So the expectation is stated here as a table, and the table is checked
 * against the real documents, the real SVG sources and the real preset from
 * `content/game.config.json`. A level that makes no such claim is simply not
 * listed; the check is opt-in per level because "which two layers" is a
 * judgement about a picture and not a property every level has an answer for.
 *
 * The sizes come from the SVG `viewBox`, not from `assets/dist/manifest.json`,
 * because `assets/dist` is git-ignored: a test that reads a build artefact
 * measures whatever the last local build happened to produce, and skips
 * silently on a clean checkout.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import gameConfigJson from '@content/game.config.json';

import { groundDressingProblems } from '@adapters/phaser/ground-dressing';
import { selectLayers, type LayerViewport } from '@adapters/phaser/level-effects';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const LEVELS_DIR = `${REPO_ROOT}content/levels`;
const SVG_DIR = `${REPO_ROOT}assets/src/svg`;

interface Vec2 {
  readonly x: number;
  readonly y: number;
}

interface LayerDoc {
  readonly key: string;
  readonly depth: number;
  readonly scrollFactor: Vec2;
  readonly offset: Vec2;
  readonly repeatX: boolean;
}

interface RideCycleDoc {
  readonly rest: string;
  readonly frames: readonly string[];
  readonly framePx: number;
}

interface RideDoc {
  readonly mode: string;
  readonly art: readonly { readonly key: string; readonly side: string; readonly cycle?: RideCycleDoc }[];
  readonly riderAnchor: Vec2;
  readonly groundLineY: number;
  readonly track?: { readonly artKey: string; readonly topY: number };
}

interface LevelDoc {
  readonly id: string;
  readonly size: Vec2;
  readonly ground: readonly Vec2[];
  readonly layers: readonly LayerDoc[];
  readonly locomotion: readonly { readonly mode: string }[];
  readonly pois: readonly { readonly id: string; readonly artKey: string; readonly position: Vec2 }[];
  readonly rides?: readonly RideDoc[];
  readonly groundDressing: { readonly key: string; readonly topY: number };
}

/** Every texture a ride layer can draw — its still, its rest frame and its gait — each once (ADR-0035). */
const layerKeys = (layer: RideDoc['art'][number]): readonly string[] =>
  layer.cycle === undefined ? [layer.key] : [...new Set([layer.key, layer.cycle.rest, ...layer.cycle.frames])];

const levels: readonly LevelDoc[] = readdirSync(LEVELS_DIR)
  .filter((name) => name.endsWith('.json'))
  .map((name) => JSON.parse(readFileSync(`${LEVELS_DIR}/${name}`, 'utf8')) as LevelDoc)
  .sort((a, b) => a.id.localeCompare(b.id));

/**
 * The source file a key resolves to, or null.
 *
 * `assets.mjs` keys a source as `<level>-<basename>`, and pins a landmark to 1x
 * by naming the file `<name>@1x.svg` — the scale pin is in the filename and is
 * not part of the key, so both spellings are tried.
 */
const sourceFor = (levelId: string, key: string): string | null => {
  if (!key.startsWith(`${levelId}-`)) return null;
  const base = key.slice(levelId.length + 1);
  for (const candidate of [`${base}.svg`, `${base}@1x.svg`, `${base}@2x.svg`]) {
    const path = `${SVG_DIR}/${levelId}/${candidate}`;
    if (existsSync(path)) return path;
  }
  return null;
};

/** The authored size of a source, read out of its `viewBox`. */
const sizeOfSource = (path: string): { readonly width: number; readonly height: number } => {
  const svg = readFileSync(path, 'utf8');
  const box = /viewBox="\s*([-\d.]+)\s+([-\d.]+)\s+([\d.]+)\s+([\d.]+)\s*"/.exec(svg);
  expect(box, `${path} has no viewBox; the pipeline cannot size it either`).not.toBeNull();
  return { width: Number(box?.[3]), height: Number(box?.[4]) };
};

describe('every key a level document names has a source under its own level directory', () => {
  it('has levels to check', () => {
    expect(levels.length).toBeGreaterThan(0);
  });

  for (const level of levels) {
    it(`${level.id}: every layer key resolves`, () => {
      for (const layer of level.layers) {
        expect(
          sourceFor(level.id, layer.key),
          `${level.id}.json names layer "${layer.key}", and no source under ` +
            `assets/src/svg/${level.id}/ produces that key. LevelScene will draw a flat ` +
            `theme band instead, which looks like a decision rather than a typo.`,
        ).not.toBeNull();
      }
    });

    it(`${level.id}: every POI artKey resolves`, () => {
      for (const poi of level.pois) {
        expect(
          sourceFor(level.id, poi.artKey),
          `${level.id}.json POI "${poi.id}" names art "${poi.artKey}", and no source ` +
            `under assets/src/svg/${level.id}/ produces that key. The landmark would be ` +
            `drawn as the placeholder tower silhouette.`,
        ).not.toBeNull();
      }
    });

    it(`${level.id}: two landmarks are never asked to share one camera frame`, () => {
      const xs = level.pois.map((poi) => poi.position.x).sort((a, b) => a - b);
      for (let index = 1; index < xs.length; index += 1) {
        const gap = (xs[index] ?? 0) - (xs[index - 1] ?? 0);
        expect(
          gap,
          `${level.id}.json puts two POIs ${String(gap)} px apart. A landmark hero is up to ` +
            `900 px wide and the camera sees 1080, so at this spacing one of them is always ` +
            `cropped.`,
        ).toBeGreaterThanOrEqual(gameConfigJson.designWidth);
      }
    });
  }
});

/**
 * ### 2b. The band below the ground is dressed with art that exists, under the ground everywhere (ADR-0042)
 *
 * A strip is a key and a world row, and the schema is satisfied by a key no
 * source produces and by a row above the ground. The first draws the flat band
 * the strip exists to close, and the second draws the strip in the air over the
 * backdrop wherever the ground falls away. Neither stops a level reaching
 * `ready`. The parser refuses the row at load; this refuses both in CI, against
 * the sources on disk.
 */
describe('every level dresses the band below its ground with art that exists (ADR-0042)', () => {
  it('has levels to check', () => {
    expect(levels.length).toBeGreaterThan(0);
  });

  for (const level of levels) {
    it(`${level.id}: the ground dressing is a 1x-pinned source under its own level directory`, () => {
      const { key } = level.groundDressing;
      const path = sourceFor(level.id, key);
      expect(
        path,
        `${level.id}.json names ground dressing "${key}", and no source under assets/src/svg/${level.id}/ ` +
          'produces it. The band below the walking line would be one flat colour on a level that looks finished.',
      ).not.toBeNull();
      expect(
        path?.endsWith('@1x.svg'),
        `${String(path)} is not pinned to 1x. topY is a design row and the strip's height is its art's rows, ` +
          'which agree only at 1x; a 2x copy would also cost four times the texture for a band the HUD half covers.',
      ).toBe(true);
    });

    it(`${level.id}: the ground dressing starts at or below the ground's lowest point and ends on the bottom of the world`, () => {
      const problems = groundDressingProblems(level.groundDressing, level.ground, level.size.y);
      expect(problems, problems.join('\n')).toEqual([]);

      const path = sourceFor(level.id, level.groundDressing.key);
      if (path === null) return;
      const size = sizeOfSource(path);
      /* Exactly, not "at most". Past the bottom is texture nobody can see. Short
         of it, the scene fills the whole world under the strip again, and the
         third of a screen of overdraw the strip was drawn to replace comes back
         (`groundFillFloor`). */
      expect(
        level.groundDressing.topY + size.height,
        `${level.id}'s ground dressing is ${String(size.height)} rows from world row ` +
          `${String(level.groundDressing.topY)}; it must end on the bottom of the world, ${String(level.size.y)}`,
      ).toBe(level.size.y);
    });
  }
});

/**
 * ### 3. A ride is registered to the art it names (ADR-0031)
 *
 * A ride says where, in its own art, the rider's feet rest and which row lies on
 * the ground. Both are pixel coordinates in a file the document does not
 * contain, so a ride can name a key nothing produces, an anchor outside the
 * drawing, or two layers that do not line up, and the schema is satisfied by all
 * three. The scene would still reach `ready`, with a seated passenger in mid-air.
 *
 * And two claims that compare one ride with its level, which JSON Schema cannot
 * state: a ride's mode is one the level moves by, and a mode has one ride.
 */
describe('every ride is registered to the art it names (ADR-0031)', () => {
  const ridden = levels.filter((level) => (level.rides ?? []).length > 0);

  it('has a ride to check, so this block is not a pass over nothing (ADR-0024)', () => {
    expect(ridden.length).toBeGreaterThan(0);
  });

  for (const level of ridden) {
    const rides = level.rides ?? [];
    for (const ride of rides) {
      it(`${level.id}: the "${ride.mode}" ride carries a mode the level moves by, and is its only ride`, () => {
        expect(
          level.locomotion.map((tuning) => tuning.mode),
          `${level.id}.json declares a ride for "${ride.mode}" and no locomotion by it. The ride is ` +
            'charged to the texture budget and can never be drawn.',
        ).toContain(ride.mode);
        expect(rides.filter((other) => other.mode === ride.mode)).toHaveLength(1);
        const sides = ride.art.map((layer) => layer.side);
        expect(new Set(sides).size, `${level.id}.json's "${ride.mode}" ride repeats a side`).toBe(sides.length);
      });

      it(`${level.id}: every layer, frame and the track of the "${ride.mode}" ride is a 1x-pinned source`, () => {
        const keys = [...ride.art.flatMap((layer) => layerKeys(layer)), ...(ride.track ? [ride.track.artKey] : [])];
        for (const key of keys) {
          const path = sourceFor(level.id, key);
          expect(
            path,
            `${level.id}.json names ride art "${key}" and no source under assets/src/svg/${level.id}/ ` +
              'produces it. The rider would be posed for a ride that is not on screen.',
          ).not.toBeNull();
          expect(
            path?.endsWith('@1x.svg'),
            `${String(path)} is not pinned to 1x. riderAnchor and groundLineY are art pixels, and they ` +
              'are design pixels only at 1x: a 2x texture would draw the car twice the size around a ' +
              'rider placed for the 1x one.',
          ).toBe(true);
        }
      });

      it(`${level.id}: the "${ride.mode}" ride's layers and frames share one size, and its anchor and rows lie on it`, () => {
        const sizes = ride.art.flatMap((layer) => layerKeys(layer)).map((key) => {
          const path = sourceFor(level.id, key);
          return path === null ? null : sizeOfSource(path);
        });
        const [first] = sizes;
        expect(first, `${level.id}.json's "${ride.mode}" ride has no layer to measure`).not.toBeNull();
        if (first === null || first === undefined) return;
        for (const size of sizes) expect(size).toEqual(first);

        const { x, y } = ride.riderAnchor;
        expect(x, 'riderAnchor.x is outside the art').toBeGreaterThanOrEqual(0);
        expect(x, 'riderAnchor.x is outside the art').toBeLessThanOrEqual(first.width);
        expect(y, 'riderAnchor.y is outside the art').toBeGreaterThanOrEqual(0);
        expect(y, 'riderAnchor.y is outside the art').toBeLessThanOrEqual(first.height);
        expect(ride.groundLineY, 'groundLineY is below the art').toBeLessThanOrEqual(first.height);
        if (ride.track !== undefined) {
          expect(ride.track.topY, 'the track starts below the art').toBeLessThanOrEqual(first.height);
        }
      });
    }
  }

  it('a mode carried on a ride on one level is carried on a ride everywhere it is declared', () => {
    /* The rig poses a ridden mode for the ride: `train/*` is a passenger sitting
       on a floor. A level declaring that mode with no ride draws the seated pose
       over nothing, which is a figure sitting in mid-air. Derived from the
       documents, so no mode is named here. */
    const carried = new Set(levels.flatMap((level) => (level.rides ?? []).map((ride) => ride.mode)));
    const unridden = levels.flatMap((level) =>
      level.locomotion
        .filter(
          (tuning) =>
            carried.has(tuning.mode) && !(level.rides ?? []).some((ride) => ride.mode === tuning.mode),
        )
        .map((tuning) => `${level.id} moves by "${tuning.mode}" with no ride`),
    );
    expect(unridden, unridden.join('\n')).toEqual([]);
  });
});

/**
 * ### 4. A ride's frames move its legs and never its seat (ADR-0035)
 *
 * A ride has ONE `riderAnchor`, and the rider is drawn at it in every frame. So a
 * frame that redraws the saddle a few pixels up or back lifts the rider out of it
 * mid-stride, and nothing at run time can see that: the sizes match, the anchor
 * is inside the art, and the scene reaches `ready`. The picture is a rider who
 * floats and sinks four times a stride.
 *
 * The seat is therefore declared in the art, once per file, as
 * `<g id="seat" data-rider-anchor="x y">`: everything the rider is seen sitting
 * on or standing in, drawn after every leg. Every file a cycled layer can draw —
 * its still, its rest frame and every frame of its gait — carries that group
 * byte for byte, and names the level document's own anchor. And the frames of a
 * gait are different pictures, because a cycle of one drawing moves nothing.
 */
const SEAT = /<g id="seat" data-rider-anchor="([\d.]+) ([\d.]+)">([\s\S]*?)<\/g>/gu;

/** Everything wrong with one cycled layer's seat across its files, as sentences, or `[]`. */
function seatFaults(files: Readonly<Record<string, string>>, anchor: Vec2): string[] {
  const faults: string[] = [];
  const seats = new Map<string, string>();
  for (const [name, svg] of Object.entries(files)) {
    const found = [...svg.matchAll(SEAT)];
    if (found.length !== 1) {
      faults.push(`${name} has ${String(found.length)} <g id="seat" data-rider-anchor="x y"> groups; it needs exactly one`);
      continue;
    }
    const [match] = found;
    const x = Number(match?.[1]);
    const y = Number(match?.[2]);
    if (x !== anchor.x || y !== anchor.y) {
      faults.push(
        `${name} seats its rider at (${String(x)}, ${String(y)}) and the level document at ` +
          `(${String(anchor.x)}, ${String(anchor.y)}); one of them moved`,
      );
    }
    const body = match?.[3] ?? '';
    if (!/<(path|rect|ellipse|circle)\b/u.test(body)) faults.push(`${name}'s seat group draws nothing`);
    seats.set(name, body);
  }
  const distinct = new Set(seats.values());
  if (distinct.size > 1) {
    faults.push(
      `the seat is drawn ${String(distinct.size)} different ways across ${[...seats.keys()].join(', ')}; ` +
        'the rider sits at one anchor, so a saddle that moves between frames leaves them in the air',
    );
  }
  return faults;
}

describe('a ride layer that cycles keeps its rider`s seat in every frame (ADR-0035)', () => {
  const cycled = levels.flatMap((level) =>
    (level.rides ?? []).flatMap((ride) =>
      ride.art.filter((layer) => layer.cycle !== undefined).map((layer) => ({ level, ride, layer })),
    ),
  );

  it('has a cycled layer to check, so this block is not a pass over nothing (ADR-0024)', () => {
    expect(cycled.length).toBeGreaterThan(0);
  });

  const read = (levelId: string, key: string): string => {
    const path = sourceFor(levelId, key);
    expect(path, `${levelId}: no source under assets/src/svg/${levelId}/ produces "${key}"`).not.toBeNull();
    return path === null ? '' : readFileSync(path, 'utf8');
  };

  for (const { level, ride, layer } of cycled) {
    it(`${level.id}: every frame of the "${ride.mode}" ride's "${layer.key}" layer draws one seat, at the document's anchor`, () => {
      const files = Object.fromEntries(layerKeys(layer).map((key) => [key, read(level.id, key)]));
      const faults = seatFaults(files, ride.riderAnchor);
      expect(faults, faults.join('\n')).toEqual([]);
    });

    it(`${level.id}: the "${ride.mode}" ride's "${layer.key}" gait is ${String(layer.cycle?.frames.length)} different pictures`, () => {
      const frames = [...new Set(layer.cycle?.frames ?? [])];
      expect(frames.length, 'a cycle of one texture is a still').toBeGreaterThan(1);
      const drawings = new Set(frames.map((key) => read(level.id, key)));
      expect(drawings.size, `two frames of "${layer.key}" are the same file under two names`).toBe(frames.length);
    });
  }

  it('fails a frame whose seat moved, whose anchor moved, or that has no seat (the negative control)', () => {
    const [first] = cycled;
    expect(first, 'no cycled layer to build the control from').toBeDefined();
    if (first === undefined) return;
    const keys = layerKeys(first.layer);
    const files = Object.fromEntries(keys.map((key) => [key, read(first.level.id, key)]));
    expect(seatFaults(files, first.ride.riderAnchor)).toEqual([]);

    const [one, two] = keys;
    expect(two, 'the control needs a layer with at least two files').toBeDefined();
    if (one === undefined || two === undefined) return;

    const raised = { ...files, [two]: (files[two] ?? '').replace(/(<g id="seat"[^>]*>[\s\S]*?\bd="M [\d.]+ )([\d.]+)/u, (_all, head: string, y: string) => `${head}${String(Number(y) - 4)}`) };
    expect(raised[two]).not.toBe(files[two]);
    expect(seatFaults(raised, first.ride.riderAnchor).join('\n')).toContain('different ways');

    const moved = { ...files, [one]: (files[one] ?? '').replace(/data-rider-anchor="[\d.]+ [\d.]+"/u, 'data-rider-anchor="0 0"') };
    expect(seatFaults(moved, first.ride.riderAnchor).join('\n')).toContain('one of them moved');

    const bare = { ...files, [one]: (files[one] ?? '').replace(/<g id="seat"/u, '<g id="saddle"') };
    expect(seatFaults(bare, first.ride.riderAnchor).join('\n')).toContain('needs exactly one');
  });
});

/**
 * What each level's art sheet says the weakest device is left holding.
 *
 * Opt-in: a level absent from this table asserts nothing. Ottawa and Québec City
 * are absent because both were composed against `selectLayers`'s previous rule —
 * "keep the highest depths" — and their sheets' `low` columns record that rule's
 * answer rather than the current one. Pinning today's output for them would be a
 * change-detector, not a contract.
 */
const LOW_TIER: Readonly<Record<string, readonly string[]>> = {
  halifax: ['halifax-layer-10-sky', 'halifax-layer-40-quayside'],
  toronto: ['toronto-layer-10-sky', 'toronto-layer-20-skyline'],
};

describe('the low tier keeps the layers the art was composed to keep', () => {
  const lowPreset = gameConfigJson.graphicsPresets.low;

  it('found the low preset to measure against', () => {
    expect(lowPreset, 'content/game.config.json has no graphics preset "low"').toBeDefined();
  });

  for (const [levelId, expected] of Object.entries(LOW_TIER)) {
    it(`${levelId}: keeps ${expected.join(' + ')}`, () => {
      const level = levels.find((candidate) => candidate.id === levelId);
      expect(level, `content/levels/${levelId}.json does not exist`).toBeDefined();
      if (level === undefined || lowPreset === undefined) return;

      const sizes = new Map<string, { readonly width: number; readonly height: number }>();
      for (const layer of level.layers) {
        const path = sourceFor(level.id, layer.key);
        if (path !== null) sizes.set(layer.key, sizeOfSource(path));
      }

      const viewport: LayerViewport = {
        width: gameConfigJson.designWidth,
        height: gameConfigJson.designHeight,
        /* The HIGHEST point of the polyline, which is the smallest y. */
        horizonY: Math.min(...level.ground.map((point) => point.y)),
        sizeOf: (key) => sizes.get(key) ?? null,
      };

      const kept = selectLayers(level.layers, lowPreset.parallaxLayers, viewport).map(
        (layer) => layer.key,
      );
      expect(
        kept,
        `${levelId} at the low tier keeps [${kept.join(', ')}]. assets/style/${levelId}-level.md ` +
          `§2 composed the level so that [${expected.join(', ')}] survive; a tile's height or a ` +
          `layer's offset.y has moved and changed what a weak phone shows.`,
      ).toEqual([...expected]);
    });
  }
});
