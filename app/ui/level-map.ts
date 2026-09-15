/**
 * The map of Canada above the route: where each stop is, where the player is,
 * and the way they came.
 *
 * `docs/stories/TN-MAP-level-select.md` `OQ-MAP-2` answered "a vertical list of
 * cards on a painted backdrop that suggests the journey … If a drawn map is
 * wanted later, it is a decoration behind the same list, never the only way to
 * choose." `./journey.ts` drew the route without the painting. This module is
 * the painting: `assets/src/svg/screens/map-canada.svg`, drawn from Natural
 * Earth, a pin at each stop's anchor from the sidecar beside it, and a line
 * through the stops the player has travelled.
 *
 * ## Decoration and orientation, never the control
 *
 * The whole map is `aria-hidden`, holds nothing focusable and takes no pointer
 * input, so the list a screen reader reads, the order a keyboard walks and the
 * ring a switch user steps through are exactly what they were. That is only
 * honest because **nothing on the map says something the list's words do not**:
 *
 *  - The drawing has no lettering (`assets/style/map-canada.md` §0). Nothing is
 *    written on or under it either: a place name in art cannot be translated,
 *    and `OQ-MAP-3` refuses any sentence about which way the journey runs. The
 *    one thing drawn on a pin is **its stop's number**, the numeral its card
 *    already shows as "Level 4": the same in both languages, and the only way a
 *    sighted player can tell which dot is which card (second live-site audit).
 *  - Each pin is **the rail's pin, in the rail's words**. It carries the same
 *    `data-journey-state`, `data-journey-reached` and `data-journey-current`
 *    tokens the rail beside that card carries, computed once by
 *    `journeyRoute` and `levelCardState` and passed in here, and it is drawn by
 *    the same `.tn-journey__pin` rules: solid for open, dashed for locked,
 *    dotted for not made yet, brass where the card says "Earned", bigger and
 *    ringed where the card says "You are here". No fourth shape, no new colour.
 *  - **The line joins those same words in the list's order.** It runs through
 *    every stop whose card says "Earned" and comes before the card saying "You
 *    are here", and it ends on that card. {@link routeLegs} is the rule. Nothing
 *    ahead of the player is drawn, so the line never claims a trip nobody has
 *    made. The order it follows is the list's own, so it adds no sentence about
 *    direction.
 *  - What the map adds is *where*, which is orientation and exactly what the
 *    brief asked of it. It adds no fact about the player.
 *
 * ## Why a line now, when the first version refused one
 *
 * The first version drew no line because "a straight line reads as a route
 * travelled", and nothing then knew what had been travelled, so any line would
 * have been a claim. The stop the player is at (`whereYouAre`) and the stamps
 * on the cards make it a claim the list already makes, and showing real
 * progress is the reason for drawing it.
 *
 * ## What it deliberately does not draw
 *
 *  - **No leg ahead of the player**, and no leg to a stop that is neither
 *    stamped nor where the player is. A stop that was skipped is joined past:
 *    the player went from the stop before it to the stop after it.
 *  - **No regions.** "The Prairies", "the Alberta foothills" and "the North" are
 *    regions, and which area to light is a claim content owners have not made
 *    (`OQ-MAPART-2`). Point anchors only.
 *
 * ## Halifax and Peggy's Cove
 *
 * Four viewBox units apart on the main map — one dot. The drawing answers with
 * an inset at 13× (§7), and the sidecar gives both stops an anchor there, so a
 * stop the inset anchors is pinned **in the inset** and nowhere else. Two pins
 * on the locator box would be one smudge.
 *
 * The line follows the pins. A leg between two stops the inset anchors is drawn
 * **in the inset**, between their inset anchors; on the main map it would be a
 * line four units long, which is no line at all. A leg between an inset stop and
 * a stop on the main map is drawn on the main map, from the inset stop's
 * main-map anchor. That point lies inside the locator box the drawing puts round
 * the inset's area, so the line comes out of the box that stands for the inset,
 * rather than out of a pin that is not there.
 *
 * ## Motion
 *
 * When the screen opens the line draws itself in, along its own order, and then
 * the "you are here" pin swells and settles three times. The stylesheet owns
 * both: both end within five seconds, neither changes a colour, and reduced
 * motion removes both and leaves the finished drawing. {@link LevelMap.draw}
 * does not redraw a state it already shows, so changing the language does not
 * replay them.
 *
 * DOM only (ADR-0005). Reads the sidecar through its port type and imports the
 * drawing by URL, so Vite content-hashes it and a browser fetches it only when a
 * level select is built (infra's answer to `OQ-MAPART-1`).
 */

import type { MapAnchorsDocument, MapPoint } from '@application/ports';
import type { LevelId } from '@domain/ids';

import sidecar from '../../assets/src/svg/screens/map-canada.anchors.json';

import { element, replaceChildren } from './dom';
import type { JourneyStop } from './journey';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The drawing, by URL: hashed and emitted by the UI build, never inlined. */
export const MAP_ART_URL: string = new URL(
  '../../assets/src/svg/screens/map-canada.svg',
  import.meta.url,
).href;

/**
 * The sidecar as its port type, or `null` when it cannot be one.
 *
 * A JSON import types `viewBox` as `number[]`, and the schema says four. The
 * sidecar is schema-checked and cross-checked by `make validate-content`, so
 * `null` is not a state the shipped build reaches; it exists so the tuple is
 * narrowed by a check rather than asserted by a cast, and a map with no frame
 * of reference is not drawn at all rather than drawn with pins in the wrong
 * place.
 */
export function mapAnchorsOf(raw: typeof sidecar): MapAnchorsDocument | null {
  const [minX, minY, width, height] = raw.viewBox;
  if (minX === undefined || minY === undefined || width === undefined || height === undefined) {
    return null;
  }
  if (raw.viewBox.length !== 4 || !(width > 0) || !(height > 0)) return null;
  return { ...raw, viewBox: [minX, minY, width, height] };
}

/** The shipped sidecar, read once. */
export const SHIPPED_MAP_ANCHORS: MapAnchorsDocument | null = mapAnchorsOf(sidecar);

/**
 * One stop, as the level select already knows it.
 *
 * Structural, like `./journey.ts`'s `JourneyStep`, so this module does not
 * import `./level-select` (which imports this one). `state` is the card's own
 * token — `open`, `locked`, `not-built` — passed through rather than re-derived,
 * so the pin on the map, the pin on the rail and the word on the card are one
 * decision made once.
 */
export interface MapStopInput {
  readonly id?: LevelId;
  readonly state: string;
  readonly stop: JourneyStop;
  /** The stop's map number, 1 to 10, drawn on the pin. Absent draws a bare pin. */
  readonly number?: number;
}

/** One pin, placed. */
export interface PlacedStop {
  readonly id: LevelId;
  readonly state: string;
  readonly number?: number;
  readonly reached: boolean;
  readonly current: boolean;
  /** Pinned at the inset's anchor rather than the main map's. */
  readonly inset: boolean;
  /** Percent of the drawing's width from its left edge, and of its height from its top. */
  readonly left: number;
  readonly top: number;
}

const percent = (value: number): number => Math.round(value * 1000) / 1000;
const units = (value: number): number => Math.round(value * 1000) / 1000;
const fraction = (value: number): number => Math.round(value * 10000) / 10000;

/**
 * Where each stop goes, in the order given.
 *
 * A stop with no id — a level whose place is not decided (`TN-MAP-04`) — has
 * nowhere to go and gets no pin; neither does an id the sidecar has no anchor
 * for. That is the honest answer for a place the drawing does not know, and
 * `make validate-content` keeps it from happening to a shipped level.
 *
 * Percentages rather than pixels, so a pin stays on its place at any size the
 * drawing is rendered at, and nothing here needs a layout to compute.
 */
export function placeStops(
  stops: readonly MapStopInput[],
  anchors: MapAnchorsDocument,
): readonly PlacedStop[] {
  const [minX, minY, width, height] = anchors.viewBox;
  const placed: PlacedStop[] = [];
  for (const { id, state, stop, number } of stops) {
    if (id === undefined) continue;
    const inInset: MapPoint | undefined = anchors.inset?.anchors[id];
    const point = inInset ?? anchors.anchors[id];
    if (point === undefined) continue;
    placed.push({
      id,
      state,
      ...(number === undefined ? {} : { number }),
      reached: stop.reached,
      current: stop.current,
      inset: inInset !== undefined,
      left: percent(((point.x - minX) / width) * 100),
      top: percent(((point.y - minY) / height) * 100),
    });
  }
  return placed;
}

/**
 * The stops the line runs through, in journey order.
 *
 * Every stop up to where the player is whose stamp is earned, then the stop the
 * player is at. Empty when no placed stop is "here": a line "up to where they
 * are" has nowhere to end, and drawing one would be inventing a position.
 */
export function travelledStops(placed: readonly PlacedStop[]): readonly PlacedStop[] {
  const here = placed.findIndex((stop) => stop.current);
  if (here === -1) return [];
  return placed.slice(0, here + 1).filter((stop) => stop.reached || stop.current);
}

/** Which part of the drawing a leg is drawn on. */
export type MapFrame = 'main' | 'inset';

/** One straight length of the travelled line, in the drawing's viewBox units. */
export interface RouteLeg {
  readonly from: LevelId;
  readonly to: LevelId;
  readonly frame: MapFrame;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly length: number;
  /** Where along the whole line this leg begins, as a share of it, 0 to 1. */
  readonly start: number;
  /** How much of the whole line this leg is, 0 to 1. The shares add up to 1. */
  readonly share: number;
}

/**
 * The travelled line, leg by leg, in journey order.
 *
 * A leg between two inset stops is drawn in the inset between their inset
 * anchors. Any other leg is drawn on the main map between main-map anchors,
 * which for an inset stop is a point inside the locator box. A leg that would
 * have no length, or whose ends the sidecar cannot place in its frame, is not
 * drawn.
 *
 * `start` and `share` are what the stylesheet paces the draw-in by, so the line
 * grows at one speed along its whole length instead of spending as long on a
 * short leg as on a long one.
 */
export function routeLegs(
  placed: readonly PlacedStop[],
  anchors: MapAnchorsDocument,
): readonly RouteLeg[] {
  const measured: Omit<RouteLeg, 'start' | 'share'>[] = [];
  let previous: PlacedStop | undefined;
  for (const stop of travelledStops(placed)) {
    if (previous !== undefined) {
      const frame: MapFrame = previous.inset && stop.inset ? 'inset' : 'main';
      const table = frame === 'inset' ? anchors.inset?.anchors : anchors.anchors;
      const from = table?.[previous.id];
      const to = table?.[stop.id];
      if (from !== undefined && to !== undefined) {
        const length = Math.hypot(to.x - from.x, to.y - from.y);
        if (length > 0) {
          measured.push({
            from: previous.id,
            to: stop.id,
            frame,
            x1: units(from.x),
            y1: units(from.y),
            x2: units(to.x),
            y2: units(to.y),
            length: units(length),
          });
        }
      }
    }
    previous = stop;
  }

  const total = measured.reduce((sum, leg) => sum + leg.length, 0);
  let before = 0;
  return measured.map((leg) => {
    const start = before / total;
    before += leg.length;
    return { ...leg, start: fraction(start), share: fraction(leg.length / total) };
  });
}

export interface LevelMap {
  readonly element: HTMLElement;
  /** Progress changed: move the marks and the line, keep the drawing. */
  readonly draw: (stops: readonly MapStopInput[]) => void;
}

export function createLevelMap(doc: Document, anchors: MapAnchorsDocument): LevelMap {
  const [minX, minY, width, height] = anchors.viewBox;

  /*
   * `alt=""` and not a description: this is decoration, and a description would
   * be a sentence the copy table does not hold. `draggable="false"` and the
   * sheet's `pointer-events: none` together keep a long press on the drawing
   * from opening an image menu or starting a drag, which on a phone is what a
   * held switch contact over a picture does.
   */
  const art = element(doc, 'img', {
    className: 'tn-map__art',
    attrs: {
      src: MAP_ART_URL,
      alt: '',
      width: String(width),
      height: String(height),
      decoding: 'async',
      draggable: 'false',
    },
  });

  /*
   * The line, in the drawing's own coordinates. An `<svg>` over the drawing and
   * under the pins, the same box as both, so a leg's ends are the sidecar's
   * numbers with no arithmetic between them and the pins it joins.
   * `preserveAspectRatio="none"` is safe because the box already has the
   * drawing's proportions: the `<img>` reserves them with its width and height.
   *
   * No `<title>`, no `<text>`, no role: it inherits the map's `aria-hidden`, and
   * `focusable="false"` keeps the one old engine that tabs into an `<svg>` from
   * doing it.
   */
  const route = doc.createElementNS(SVG_NS, 'svg');
  route.setAttribute('class', 'tn-map__route');
  route.setAttribute('data-testid', 'level-select-map-route');
  route.setAttribute('viewBox', `${String(minX)} ${String(minY)} ${String(width)} ${String(height)}`);
  route.setAttribute('preserveAspectRatio', 'none');
  route.setAttribute('focusable', 'false');
  route.setAttribute('data-map-legs', '0');

  /* Every casing under every line, so where two legs meet the paper edge of
     one never cuts across the ink of the other. */
  const casings = doc.createElementNS(SVG_NS, 'g');
  casings.setAttribute('class', 'tn-map__casings');
  const lines = doc.createElementNS(SVG_NS, 'g');
  lines.setAttribute('class', 'tn-map__legs');
  route.append(casings, lines);

  const pins = element(doc, 'div', { className: 'tn-map__pins' });

  const root = element(doc, 'div', {
    className: 'tn-map',
    testId: 'level-select-map',
    attrs: { 'aria-hidden': 'true' },
  });
  root.append(art, route, pins);

  /* A map that failed to load is an empty frame with pins floating in it, which
     is noise. Take the whole thing away: the list beside it says everything. */
  art.addEventListener('error', () => {
    root.hidden = true;
  });

  function pin(placed: PlacedStop): HTMLElement {
    const node = element(doc, 'span', {
      className: 'tn-map__stop',
      attrs: {
        'data-map-handle': placed.id,
        'data-map-inset': String(placed.inset),
        'data-journey-state': placed.state,
        'data-journey-reached': String(placed.reached),
        'data-journey-current': String(placed.current),
      },
      /* The numeral its card shows, and nothing else: the map stays wordless. */
      children: [
        element(doc, 'span', {
          className: 'tn-journey__pin',
          ...(placed.number === undefined ? {} : { text: String(placed.number) }),
        }),
      ],
    });
    /* Custom properties through the CSSOM rather than a style attribute: the
       sheet owns how a pin is placed, this owns only where. */
    node.style.setProperty('--tn-map-x', `${String(placed.left)}%`);
    node.style.setProperty('--tn-map-y', `${String(placed.top)}%`);
    return node;
  }

  function line(leg: RouteLeg, className: string): SVGLineElement {
    const node = doc.createElementNS(SVG_NS, 'line');
    node.setAttribute('class', className);
    node.setAttribute('x1', String(leg.x1));
    node.setAttribute('y1', String(leg.y1));
    node.setAttribute('x2', String(leg.x2));
    node.setAttribute('y2', String(leg.y2));
    node.setAttribute('data-map-from', leg.from);
    node.setAttribute('data-map-to', leg.to);
    node.setAttribute('data-map-frame', leg.frame);
    /* The pacing, as data the sheet reads. The dash is one unit longer than the
       leg and rounded up, so no sliver of the next dash shows at the far end
       while the leg is still hidden. */
    node.style.setProperty('--tn-leg-length', String(Math.ceil(leg.length) + 1));
    node.style.setProperty('--tn-leg-start', String(leg.start));
    node.style.setProperty('--tn-leg-share', String(leg.share));
    return node;
  }

  function refill(node: Element, children: readonly Element[]): void {
    while (node.firstChild !== null) node.removeChild(node.firstChild);
    node.append(...children);
  }

  /* What is on the map now, so the same state is not drawn twice. Drawing it
     again would replace every pin and leg and replay the entrance for nothing. */
  let shown: string | null = null;

  return {
    element: root,
    draw(stops): void {
      const placed = placeStops(stops, anchors);
      const legs = routeLegs(placed, anchors);
      const state = JSON.stringify([placed, legs]);
      if (state === shown) return;
      shown = state;

      replaceChildren(pins, placed.map(pin));
      refill(
        casings,
        legs.map((leg) => line(leg, 'tn-map__casing')),
      );
      refill(
        lines,
        legs.map((leg) => line(leg, 'tn-map__leg')),
      );
      route.setAttribute('data-map-legs', String(legs.length));
    },
  };
}
