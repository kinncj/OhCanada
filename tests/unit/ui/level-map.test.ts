import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { MapAnchorsDocument } from '@application/ports';
import type { LevelId } from '@domain/ids';

import type { JourneyStop } from '@ui/journey';
import {
  createLevelMap,
  MAP_ART_URL,
  mapAnchorsOf,
  placeStops,
  SHIPPED_MAP_ANCHORS,
  type MapStopInput,
} from '@ui/level-map';

import sidecar from '../../../assets/src/svg/screens/map-canada.anchors.json';

import { buildPage, FakeEvent, type FakeElement } from './support/fake-dom';

/**
 * The map of Canada above the level select's route.
 *
 * `docs/stories/TN-MAP-level-select.md` `OQ-MAP-2`: a drawn map "is a decoration
 * behind the same list, never the only way to choose". What is asserted here is
 * what makes hiding it honest — it is wordless, unfocusable and hidden from
 * assistive technology, and **every pin is a redrawing of a token the rail
 * beside that card already carries** — plus where each pin goes, which is the
 * one thing the map adds and the one thing the list cannot check.
 *
 * Geometry (a pin really sitting on its place, a pin not growing with the text)
 * cannot be proved against the fake DOM and is asserted in
 * `tests/a11y/shell.spec.ts`.
 */

const id = (value: string): LevelId => value as LevelId;

const stop = (over: Partial<JourneyStop> = {}): JourneyStop => ({
  before: 'none',
  after: 'none',
  reached: false,
  current: false,
  ...over,
});

/** A small drawing whose arithmetic can be done by eye: 200 x 100, offset (100, 50). */
const FIXTURE: MapAnchorsDocument = {
  $schema: '../../content/schemas/map-anchors.schema.json',
  svg: 'fixture.svg',
  viewBox: [100, 50, 200, 100],
  anchors: {
    alpha: { x: 150, y: 75 },
    beta: { x: 300, y: 150 },
    gamma: { x: 201, y: 101 },
  },
  inset: {
    frame: { x: 240, y: 55, width: 50, height: 40, radius: 4 },
    window: { x: 242, y: 57, width: 46, height: 36 },
    locator: { x: 195, y: 95, width: 10, height: 10 },
    anchors: { gamma: { x: 250, y: 60 } },
    magnification: 4,
  },
  projection: { crs: 'EPSG:3978', main: { a: 1, c: 0, d: -1, f: 0 } },
};

const LEVEL_IDS = readdirSync(fileURLToPath(new URL('../../../content/levels/', import.meta.url)))
  .filter((name) => name.endsWith('.json'))
  .map(
    (name) =>
      (
        JSON.parse(
          readFileSync(new URL(`../../../content/levels/${name}`, import.meta.url), 'utf8'),
        ) as { id: string }
      ).id,
  );

describe('the sidecar, read through its port type', () => {
  it('reads the shipped sidecar, with its viewBox as four numbers', () => {
    expect(SHIPPED_MAP_ANCHORS).not.toBeNull();
    expect(SHIPPED_MAP_ANCHORS?.viewBox).toEqual(sidecar.viewBox);
    expect(SHIPPED_MAP_ANCHORS?.viewBox).toHaveLength(4);
  });

  it('refuses a viewBox that is not four numbers, or has no area', () => {
    expect(mapAnchorsOf({ ...sidecar, viewBox: [0, 0, 1080] })).toBeNull();
    expect(mapAnchorsOf({ ...sidecar, viewBox: [0, 0, 1080, 600, 1] })).toBeNull();
    expect(mapAnchorsOf({ ...sidecar, viewBox: [0, 0, 0, 600] })).toBeNull();
    expect(mapAnchorsOf({ ...sidecar, viewBox: [0, 0, 1080, -1] })).toBeNull();
  });

  it('has a place on the drawing for every level document (ADR-0024: not vacuous)', () => {
    /* A stop the list draws and the map cannot place is a map that quietly
       stops agreeing with the list. `make validate-content` refuses it at
       build time; this is the same promise read the way the screen reads it. */
    expect(LEVEL_IDS.length).toBeGreaterThan(0);
    const anchors = SHIPPED_MAP_ANCHORS;
    if (anchors === null) throw new Error('the shipped sidecar did not read');

    const placed = placeStops(
      LEVEL_IDS.map((levelId) => ({ id: id(levelId), state: 'open', stop: stop() })),
      anchors,
    );
    expect(placed.map((pin) => pin.id)).toEqual(LEVEL_IDS);
    for (const pin of placed) {
      expect(pin.left, pin.id).toBeGreaterThanOrEqual(0);
      expect(pin.left, pin.id).toBeLessThanOrEqual(100);
      expect(pin.top, pin.id).toBeGreaterThanOrEqual(0);
      expect(pin.top, pin.id).toBeLessThanOrEqual(100);
    }
  });
});

describe('where a pin goes', () => {
  it('goes at its anchor, as a share of the drawing rather than a pixel', () => {
    const [alpha, beta] = placeStops(
      [
        { id: id('alpha'), state: 'open', stop: stop() },
        { id: id('beta'), state: 'open', stop: stop() },
      ],
      FIXTURE,
    );
    expect(alpha).toMatchObject({ id: 'alpha', left: 25, top: 25, inset: false });
    expect(beta).toMatchObject({ id: 'beta', left: 100, top: 100, inset: false });
  });

  it('goes in the inset when the inset enlarges that stop, and only there', () => {
    const placed = placeStops([{ id: id('gamma'), state: 'open', stop: stop() }], FIXTURE);
    expect(placed).toHaveLength(1);
    expect(placed[0]).toMatchObject({ id: 'gamma', left: 75, top: 10, inset: true });
  });

  it("pins Halifax and Peggy's Cove apart, which the main map cannot", () => {
    /* Four viewBox units apart on the main map: one dot. Fifty-four in the
       inset (`assets/style/map-canada.md` section 7). */
    const anchors = SHIPPED_MAP_ANCHORS;
    if (anchors === null) throw new Error('the shipped sidecar did not read');
    const [, , width, height] = anchors.viewBox;

    const [halifax, peggysCove] = placeStops(
      [
        { id: id('halifax'), state: 'open', stop: stop() },
        { id: id('peggys-cove'), state: 'locked', stop: stop() },
      ],
      anchors,
    );
    expect(halifax?.inset).toBe(true);
    expect(peggysCove?.inset).toBe(true);

    const apart = Math.hypot(
      (((halifax?.left ?? 0) - (peggysCove?.left ?? 0)) / 100) * width,
      (((halifax?.top ?? 0) - (peggysCove?.top ?? 0)) / 100) * height,
    );
    expect(apart).toBeGreaterThan(50);
  });

  it("passes the card's state and the route's marks through, untouched", () => {
    const [pin] = placeStops(
      [{ id: id('alpha'), state: 'locked', stop: stop({ reached: true, current: true }) }],
      FIXTURE,
    );
    expect(pin).toMatchObject({ state: 'locked', reached: true, current: true });
  });

  it('gives no pin to a stop with no id, or to an id the drawing does not know', () => {
    /* `TN-MAP-04`: a level whose place is not decided has nowhere to go, and a
       pin at (0, 0) would be a place invented for it. */
    const stops: MapStopInput[] = [
      { state: 'not-built', stop: stop() },
      { id: id('nowhere'), state: 'open', stop: stop({ current: true }) },
    ];
    expect(placeStops(stops, FIXTURE)).toEqual([]);
  });

  it('keeps the order it was given', () => {
    const placed = placeStops(
      [
        { id: id('beta'), state: 'open', stop: stop() },
        { id: id('alpha'), state: 'open', stop: stop() },
      ],
      FIXTURE,
    );
    expect(placed.map((pin) => pin.id)).toEqual(['beta', 'alpha']);
  });
});

describe('the map, drawn', () => {
  const drawn = (stops: readonly MapStopInput[] = []) => {
    const page = buildPage();
    const map = createLevelMap(page.document, FIXTURE);
    map.draw(stops);
    return { page, map, root: map.element as unknown as FakeElement };
  };

  const three: readonly MapStopInput[] = [
    { id: id('alpha'), state: 'locked', stop: stop() },
    { id: id('beta'), state: 'open', stop: stop({ current: true }) },
    { id: id('gamma'), state: 'not-built', stop: stop({ reached: true }) },
  ];

  it('is decoration: hidden from assistive technology, wordless and unfocusable', () => {
    const { root } = drawn(three);

    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.getAttribute('data-testid')).toBe('level-select-map');
    /* No caption, no legend, no place name, no direction (`OQ-MAP-3`). */
    expect(root.textContent).toBe('');
    expect(root.querySelectorAll('button, a, input, select, textarea, [tabindex]')).toHaveLength(0);

    const art = root.querySelectorAll('img');
    expect(art).toHaveLength(1);
    expect(art[0]?.getAttribute('alt')).toBe('');
    expect(art[0]?.getAttribute('draggable')).toBe('false');
  });

  it('shows the drawing by URL, at the size the sidecar says it is', () => {
    const { root } = drawn();
    const art = root.querySelector('img');
    expect(art?.getAttribute('src')).toBe(MAP_ART_URL);
    expect(MAP_ART_URL.endsWith('/map-canada.svg')).toBe(true);
    /* Width and height reserve the drawing's shape before it loads, so the
       list below does not jump when it arrives. */
    expect(art?.getAttribute('width')).toBe('200');
    expect(art?.getAttribute('height')).toBe('100');
  });

  it("draws one pin per placed stop, in the rail's own words", () => {
    const { root } = drawn(three);
    const pins = root.querySelectorAll('.tn-map__stop');
    expect(pins).toHaveLength(3);

    const [alpha, beta, gamma] = pins;
    expect(alpha?.getAttribute('data-map-handle')).toBe('alpha');
    expect(alpha?.getAttribute('data-journey-state')).toBe('locked');
    expect(alpha?.getAttribute('data-journey-current')).toBe('false');
    expect(beta?.getAttribute('data-journey-state')).toBe('open');
    expect(beta?.getAttribute('data-journey-current')).toBe('true');
    expect(gamma?.getAttribute('data-journey-state')).toBe('not-built');
    expect(gamma?.getAttribute('data-journey-reached')).toBe('true');
    expect(gamma?.getAttribute('data-map-inset')).toBe('true');

    /* The rail's pin, not a new mark: the stylesheet draws both with one rule. */
    for (const pin of pins) expect(pin.querySelectorAll('.tn-journey__pin')).toHaveLength(1);

    expect(alpha?.style.getPropertyValue('--tn-map-x')).toBe('25%');
    expect(alpha?.style.getPropertyValue('--tn-map-y')).toBe('25%');
    expect(gamma?.style.getPropertyValue('--tn-map-x')).toBe('75%');
    expect(gamma?.style.getPropertyValue('--tn-map-y')).toBe('10%');
  });

  it('moves the marks without drawing the drawing again', () => {
    const { root, map } = drawn(three);
    const art = root.querySelector('img');

    map.draw([{ id: id('alpha'), state: 'open', stop: stop({ current: true }) }]);

    expect(root.querySelectorAll('.tn-map__stop')).toHaveLength(1);
    expect(root.querySelector('[data-journey-current="true"]')?.getAttribute('data-map-handle')).toBe(
      'alpha',
    );
    expect(root.querySelector('img')).toBe(art);
  });

  it('takes itself away when the drawing cannot be loaded', () => {
    /* An empty frame with pins floating in it says nothing, and the list beside
       it already says everything. */
    const { root } = drawn(three);
    expect(root.hidden).toBe(false);
    root.querySelector('img')?.dispatchEvent(new FakeEvent('error', { bubbles: false }));
    expect(root.hidden).toBe(true);
  });
});
