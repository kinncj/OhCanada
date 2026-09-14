/**
 * The map of Canada above the route, and where the journey is on it.
 *
 * `docs/stories/TN-MAP-level-select.md` `OQ-MAP-2` answered "a vertical list of
 * cards on a painted backdrop that suggests the journey … If a drawn map is
 * wanted later, it is a decoration behind the same list, never the only way to
 * choose." `./journey.ts` drew the route without the painting. This module is
 * the painting: `assets/src/svg/screens/map-canada.svg`, drawn from Natural
 * Earth, and a pin at each stop's anchor from the sidecar beside it.
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
 *    and `OQ-MAP-3` refuses any sentence about which way the journey runs.
 *  - Each pin is **the rail's pin, in the rail's words**. It carries the same
 *    `data-journey-state`, `data-journey-reached` and `data-journey-current`
 *    tokens the rail beside that card carries, computed once by
 *    `journeyRoute` and `levelCardState` and passed in here, and it is drawn by
 *    the same `.tn-journey__pin` rules: solid for open, dashed for locked,
 *    dotted for not made yet, brass where the card says "Earned", bigger and
 *    ringed where the route has got to. No fourth shape, no new colour.
 *  - What the map adds is *where*, which is orientation and exactly what the
 *    brief asked of it. It adds no fact about the player.
 *
 * ## What it deliberately does not draw
 *
 *  - **No line between the pins.** The rail's legs say "one route, in this
 *    order"; a straight segment across a country says "travelled this way",
 *    which nobody has decided (§0, §12 of the art note).
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
 * DOM only (ADR-0005). Reads the sidecar through its port type and imports the
 * drawing by URL, so Vite content-hashes it and a browser fetches it only when a
 * level select is built (infra's answer to `OQ-MAPART-1`).
 */

import type { MapAnchorsDocument, MapPoint } from '@application/ports';
import type { LevelId } from '@domain/ids';

import sidecar from '../../assets/src/svg/screens/map-canada.anchors.json';

import { element, replaceChildren } from './dom';
import type { JourneyStop } from './journey';

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
}

/** One pin, placed. */
export interface PlacedStop {
  readonly id: LevelId;
  readonly state: string;
  readonly reached: boolean;
  readonly current: boolean;
  /** Pinned at the inset's anchor rather than the main map's. */
  readonly inset: boolean;
  /** Percent of the drawing's width from its left edge, and of its height from its top. */
  readonly left: number;
  readonly top: number;
}

const percent = (value: number): number => Math.round(value * 1000) / 1000;

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
  for (const { id, state, stop } of stops) {
    if (id === undefined) continue;
    const inInset: MapPoint | undefined = anchors.inset?.anchors[id];
    const point = inInset ?? anchors.anchors[id];
    if (point === undefined) continue;
    placed.push({
      id,
      state,
      reached: stop.reached,
      current: stop.current,
      inset: inInset !== undefined,
      left: percent(((point.x - minX) / width) * 100),
      top: percent(((point.y - minY) / height) * 100),
    });
  }
  return placed;
}

export interface LevelMap {
  readonly element: HTMLElement;
  /** Progress changed: move the marks, keep the drawing. */
  readonly draw: (stops: readonly MapStopInput[]) => void;
}

export function createLevelMap(doc: Document, anchors: MapAnchorsDocument): LevelMap {
  const [, , width, height] = anchors.viewBox;

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

  const pins = element(doc, 'div', { className: 'tn-map__pins' });

  const root = element(doc, 'div', {
    className: 'tn-map',
    testId: 'level-select-map',
    attrs: { 'aria-hidden': 'true' },
    children: [art, pins],
  });

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
      children: [element(doc, 'span', { className: 'tn-journey__pin' })],
    });
    /* Custom properties through the CSSOM rather than a style attribute: the
       sheet owns how a pin is placed, this owns only where. */
    node.style.setProperty('--tn-map-x', `${String(placed.left)}%`);
    node.style.setProperty('--tn-map-y', `${String(placed.top)}%`);
    return node;
  }

  return {
    element: root,
    draw(stops): void {
      replaceChildren(pins, placeStops(stops, anchors).map(pin));
    },
  };
}
