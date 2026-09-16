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
  routeLegs,
  SHIPPED_MAP_ANCHORS,
  travelledStops,
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

  it("draws a stop's number on its pin, and a bare pin for a stop given none", () => {
    const { root } = drawn([
      { id: id('alpha'), state: 'open', stop: stop(), number: 3 },
      { id: id('beta'), state: 'locked', stop: stop({ current: true }), number: 10 },
      { id: id('gamma'), state: 'not-built', stop: stop() },
    ]);
    const numerals = root
      .querySelectorAll('.tn-map__stop')
      .map((pin) => pin.querySelector('.tn-journey__pin')?.getAttribute('data-map-number') ?? null);
    expect(numerals).toEqual(['3', '10', null]);
    /* Carried as data and drawn by the sheet, so the map itself still says
       nothing: `TN-MAP` fixes that, and `shell.spec.ts` reads it from a browser. */
    expect((root.textContent ?? '').trim()).toBe('');
    /* Still hidden, still unfocusable: a numeral is not a control or a name. */
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelectorAll('[tabindex]')).toHaveLength(0);
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

/**
 * The line through the stops the player has travelled.
 *
 * The rule, which is the licence for drawing it behind `aria-hidden`: it joins
 * the cards that say "Earned" and come before the card that says "You are here",
 * in the list's order, and it ends on that card. Nothing ahead of the player is
 * drawn. A leg between two inset stops is drawn in the inset; a leg into or out
 * of the inset is drawn on the main map from the inset stop's main-map point,
 * inside the locator box.
 */
describe('the line the player has travelled', () => {
  /** FIXTURE with a second inset stop, so a leg can run inside the inset. */
  const ROUTE_FIXTURE: MapAnchorsDocument = {
    ...FIXTURE,
    anchors: { ...FIXTURE.anchors, delta: { x: 203, y: 99 } },
    inset: {
      frame: { x: 240, y: 55, width: 50, height: 40, radius: 4 },
      window: { x: 242, y: 57, width: 46, height: 36 },
      locator: { x: 195, y: 95, width: 10, height: 10 },
      anchors: { gamma: { x: 250, y: 60 }, delta: { x: 280, y: 90 } },
      magnification: 4,
    },
  };

  const at = (levelId: string, over: Partial<JourneyStop> = {}): MapStopInput => ({
    id: id(levelId),
    state: 'open',
    stop: stop(over),
  });

  const legsOf = (stops: readonly MapStopInput[], anchors = ROUTE_FIXTURE) =>
    routeLegs(placeStops(stops, anchors), anchors);

  it('joins the stamped stops before the player, in order, and ends where the player is', () => {
    const legs = legsOf([
      at('gamma', { reached: true }),
      at('delta', { reached: true }),
      at('alpha', { current: true }),
      at('beta'),
    ]);
    expect(legs.map((leg) => [leg.from, leg.to, leg.frame])).toEqual([
      ['gamma', 'delta', 'inset'],
      ['delta', 'alpha', 'main'],
    ]);
    /* Inside the inset between inset anchors; out of it from the main-map point. */
    expect(legs[0]).toMatchObject({ x1: 250, y1: 60, x2: 280, y2: 90 });
    expect(legs[1]).toMatchObject({ x1: 203, y1: 99, x2: 150, y2: 75 });
  });

  it('draws nothing ahead of the player, not even a stamp earned further on', () => {
    const stops = [at('alpha', { current: true }), at('beta', { reached: true })];
    expect(legsOf(stops)).toEqual([]);
    expect(travelledStops(placeStops(stops, ROUTE_FIXTURE)).map((placed) => placed.id)).toEqual([
      'alpha',
    ]);
  });

  it('joins past a stop the player skipped, because they went from one to the other', () => {
    const legs = legsOf([at('alpha', { reached: true }), at('gamma'), at('beta', { current: true })]);
    expect(legs.map((leg) => [leg.from, leg.to])).toEqual([['alpha', 'beta']]);
  });

  it('draws no line when the only stop travelled is where the player is', () => {
    expect(legsOf([at('alpha', { current: true }), at('beta')])).toEqual([]);
  });

  it('draws no line when nothing says where the player is', () => {
    /* "Up to where they are" has nowhere to end. */
    expect(legsOf([at('alpha', { reached: true }), at('beta', { reached: true })])).toEqual([]);
  });

  it('draws no leg the sidecar cannot place in its frame', () => {
    const anchors: MapAnchorsDocument = {
      ...ROUTE_FIXTURE,
      inset: {
        frame: { x: 240, y: 55, width: 50, height: 40, radius: 4 },
        window: { x: 242, y: 57, width: 46, height: 36 },
        locator: { x: 195, y: 95, width: 10, height: 10 },
        /* In the inset and nowhere on the main map, so a leg out of the inset
           has no point to start from. validate-content refuses this document. */
        anchors: { omega: { x: 260, y: 70 } },
        magnification: 4,
      },
    };
    expect(legsOf([at('omega', { reached: true }), at('alpha', { current: true })], anchors)).toEqual(
      [],
    );
  });

  it('paces the line by length: each leg starts where the one before ends, and the shares make one', () => {
    const legs = legsOf([
      at('gamma', { reached: true }),
      at('delta', { reached: true }),
      at('alpha', { reached: true }),
      at('beta', { current: true }),
    ]);
    expect(legs).toHaveLength(3);
    const total = legs.reduce((sum, leg) => sum + leg.length, 0);
    expect(legs.reduce((sum, leg) => sum + leg.share, 0)).toBeCloseTo(1, 3);
    let before = 0;
    for (const leg of legs) {
      expect(leg.start).toBeCloseTo(before / total, 3);
      expect(leg.share).toBeCloseTo(leg.length / total, 3);
      before += leg.length;
    }
  });

  it("runs Halifax to Peggy's Cove inside the inset, and out of it to Québec City on the main map", () => {
    /* On the main map Halifax and Peggy's Cove are four units apart, and a leg
       between them there would be a line with no length. */
    const anchors = SHIPPED_MAP_ANCHORS;
    if (anchors === null) throw new Error('the shipped sidecar did not read');
    const inset = anchors.inset;
    if (inset === undefined) throw new Error('the shipped sidecar has no inset');

    const legs = legsOf(
      [
        at('halifax', { reached: true }),
        at('peggys-cove', { reached: true }),
        at('quebec-city', { current: true }),
        at('ottawa'),
      ],
      anchors,
    );
    expect(legs.map((leg) => [leg.from, leg.to, leg.frame])).toEqual([
      ['halifax', 'peggys-cove', 'inset'],
      ['peggys-cove', 'quebec-city', 'main'],
    ]);

    const [inInset, outOfInset] = legs;
    expect(inInset).toMatchObject({
      x1: inset.anchors['halifax']?.x,
      y1: inset.anchors['halifax']?.y,
      x2: inset.anchors['peggys-cove']?.x,
      y2: inset.anchors['peggys-cove']?.y,
    });
    for (const leg of legs) expect(leg.length, `${leg.from} to ${leg.to}`).toBeGreaterThan(20);

    /* The leg out of the inset starts inside the box that stands for it. */
    const { locator } = inset;
    expect(outOfInset?.x1).toBeGreaterThanOrEqual(locator.x);
    expect(outOfInset?.x1).toBeLessThanOrEqual(locator.x + locator.width);
    expect(outOfInset?.y1).toBeGreaterThanOrEqual(locator.y);
    expect(outOfInset?.y1).toBeLessThanOrEqual(locator.y + locator.height);
    expect(outOfInset).toMatchObject({
      x2: anchors.anchors['quebec-city']?.x,
      y2: anchors.anchors['quebec-city']?.y,
    });
  });

  it('can join the whole shipped journey, and every leg has a length', () => {
    const anchors = SHIPPED_MAP_ANCHORS;
    if (anchors === null) throw new Error('the shipped sidecar did not read');
    expect(LEVEL_IDS.length).toBeGreaterThan(1);
    const stops = LEVEL_IDS.map((levelId, index) =>
      at(levelId, index === LEVEL_IDS.length - 1 ? { current: true } : { reached: true }),
    );
    const legs = legsOf(stops, anchors);
    expect(legs).toHaveLength(LEVEL_IDS.length - 1);
    for (const leg of legs) expect(leg.length, `${leg.from} to ${leg.to}`).toBeGreaterThan(0);
  });
});

describe('the line, drawn', () => {
  const ROUTE_FIXTURE: MapAnchorsDocument = {
    ...FIXTURE,
    anchors: { ...FIXTURE.anchors, delta: { x: 203, y: 99 } },
    inset: {
      frame: { x: 240, y: 55, width: 50, height: 40, radius: 4 },
      window: { x: 242, y: 57, width: 46, height: 36 },
      locator: { x: 195, y: 95, width: 10, height: 10 },
      anchors: { gamma: { x: 250, y: 60 }, delta: { x: 280, y: 90 } },
      magnification: 4,
    },
  };

  const travelled: readonly MapStopInput[] = [
    { id: id('gamma'), state: 'open', stop: stop({ reached: true }) },
    { id: id('delta'), state: 'open', stop: stop({ reached: true }) },
    { id: id('alpha'), state: 'open', stop: stop({ current: true }) },
    { id: id('beta'), state: 'locked', stop: stop() },
  ];

  const drawn = (stops: readonly MapStopInput[]) => {
    const page = buildPage();
    const map = createLevelMap(page.document, ROUTE_FIXTURE);
    map.draw(stops);
    return { map, root: map.element as unknown as FakeElement };
  };

  it('sits over the drawing and under the pins, in the drawing’s own units', () => {
    const { root } = drawn(travelled);
    expect(root.children.map((child) => child.className)).toEqual([
      'tn-map__art',
      'tn-map__route',
      'tn-map__pins',
    ]);
    const route = root.querySelector('[data-testid="level-select-map-route"]');
    expect(route?.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(route?.getAttribute('viewBox')).toBe('100 50 200 100');
    expect(route?.getAttribute('focusable')).toBe('false');
    expect(route?.getAttribute('data-map-legs')).toBe('2');
  });

  it('is one ink line on one paper casing per leg, carrying what the sheet paces it by', () => {
    const { root } = drawn(travelled);
    const inks = root.querySelectorAll('.tn-map__leg');
    const casings = root.querySelectorAll('.tn-map__casing');
    expect(inks).toHaveLength(2);
    expect(casings).toHaveLength(2);

    const [first, second] = inks;
    expect(first?.getAttribute('data-map-from')).toBe('gamma');
    expect(first?.getAttribute('data-map-to')).toBe('delta');
    expect(first?.getAttribute('data-map-frame')).toBe('inset');
    expect(second?.getAttribute('data-map-frame')).toBe('main');
    expect([first?.getAttribute('x1'), first?.getAttribute('y1')]).toEqual(['250', '60']);
    expect([first?.getAttribute('x2'), first?.getAttribute('y2')]).toEqual(['280', '90']);

    /* hypot(30, 30) = 42.43, rounded up and one unit longer. */
    expect(first?.style.getPropertyValue('--tn-leg-length')).toBe('44');
    expect(first?.style.getPropertyValue('--tn-leg-start')).toBe('0');
    expect(Number(second?.style.getPropertyValue('--tn-leg-start'))).toBeCloseTo(
      Number(first?.style.getPropertyValue('--tn-leg-share')),
      3,
    );
  });

  it('carries no words and nothing focusable, in the line as in the rest of the map', () => {
    const { root } = drawn(travelled);
    expect(root.textContent).toBe('');
    expect(root.querySelectorAll('a, button, input, [tabindex]')).toHaveLength(0);
    expect(root.getAttribute('aria-hidden')).toBe('true');
  });

  it('does not redraw a state it already shows, so the entrance is not replayed', () => {
    const { root, map } = drawn(travelled);
    const leg = root.querySelector('.tn-map__leg');
    const pin = root.querySelector('.tn-map__stop');

    map.draw(travelled.map((entry) => ({ ...entry, stop: { ...entry.stop } })));

    expect(root.querySelector('.tn-map__leg')).toBe(leg);
    expect(root.querySelector('.tn-map__stop')).toBe(pin);
  });

  it('redraws the line when the player moves on', () => {
    const { root, map } = drawn(travelled);
    map.draw([
      { id: id('gamma'), state: 'open', stop: stop({ reached: true }) },
      { id: id('delta'), state: 'open', stop: stop({ reached: true }) },
      { id: id('alpha'), state: 'open', stop: stop({ reached: true }) },
      { id: id('beta'), state: 'open', stop: stop({ current: true }) },
    ]);
    expect(root.querySelectorAll('.tn-map__leg').map((leg) => leg.getAttribute('data-map-to'))).toEqual(
      ['delta', 'alpha', 'beta'],
    );
    expect(root.querySelector('[data-testid="level-select-map-route"]')?.getAttribute('data-map-legs')).toBe(
      '3',
    );
  });

  it('takes the line away when there is no longer anywhere to draw it to', () => {
    const { root, map } = drawn(travelled);
    map.draw([{ id: id('alpha'), state: 'open', stop: stop({ current: true }) }]);
    expect(root.querySelectorAll('.tn-map__leg')).toHaveLength(0);
    expect(root.querySelectorAll('.tn-map__casing')).toHaveLength(0);
  });
});
