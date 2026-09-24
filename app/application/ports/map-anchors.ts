/**
 * The screen-art map's sidecar: where each level's stop is on a drawing.
 *
 * Mirrors `content/schemas/map-anchors.schema.json` exactly (ADR-0007), and
 * `tests/unit/contracts/ports-match-schemas.test.ts` holds the two together. The
 * file it describes is `assets/src/svg/screens/map-canada.anchors.json`, which
 * sits beside `map-canada.svg` in art's tree; `assets/style/map-canada.md` §6 is
 * the basis for every point in it and never ships.
 *
 * **Its reader is the level select** (`app/ui/level-map.ts`), which places a
 * marker at each anchor without looking at the drawing. That is the ADR-0008
 * condition for a port type: something under `app/` reads the document. The
 * sidecar is imported statically by the UI build rather than fetched through
 * `ContentRepository`, because it is a property of one drawing shipped with one
 * screen and not content a level loads (infra's answer to OQ-MAPART-1).
 *
 * **It carries coordinates and no names.** A shipped JSON is reachable by a
 * player, and a place name baked into data the copy table does not own cannot
 * be translated.
 *
 * What the schema cannot say, `make validate-content` cross-checks
 * (`scripts/lib/screen-art.mjs`): `svg` and `viewBox` match the drawing beside
 * the sidecar, there is exactly one anchor per place `game.config.json#/journey`
 * names (ADR-0069 §6), every anchor lies in the viewBox, each inset nests as it
 * claims, a stop is in at most one inset, each locator encloses exactly its own
 * inset's stops, and no frame overlaps another frame or a main-map pin
 * (ADR-0069 §3.1–§3.3). So a reader may trust that every journey place has a
 * point without re-checking it.
 */

/** A point in the drawing's viewBox; origin top-left, y down. */
export interface MapPoint {
  readonly x: number;
  readonly y: number;
}

/** An axis-aligned rectangle in the drawing's viewBox. */
export interface MapRectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The inset card's outer rectangle and its corner radius. */
export interface MapInsetFrame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
}

/**
 * An enlarged view of stops too close to tell apart on the main map.
 *
 * On `map-canada.svg` the first is Halifax and Peggy's Cove, 4 viewBox units
 * apart on the main map and 54 in the inset. `anchors` are in the same viewBox,
 * inside `window`; each names a stop the main map also anchors, and that
 * main-map point lies inside `locator` (ADR-0069 §1).
 */
export interface MapInset {
  readonly frame: MapInsetFrame;
  readonly window: MapRectangle;
  readonly locator: MapRectangle;
  /** Keyed by level id; a stop appears in at most one inset. */
  readonly anchors: Readonly<Record<string, MapPoint>>;
  /** Inset scale over main-map scale. */
  readonly magnification: number;
  /** This inset's own fit from projected metres to viewBox units. */
  readonly affine: MapAffineTransform;
  readonly pxPerKmAtStandardParallels?: number;
}

/** `x = a*E + c`, `y = d*N + f`, from projected metres to viewBox units. */
export interface MapAffineTransform {
  readonly a: number;
  readonly c: number;
  readonly d: number;
  readonly f: number;
}

/** The projection the drawing and every anchor were placed with. */
export interface MapProjection {
  /** `EPSG:<code>`. */
  readonly crs: string;
  readonly name?: string;
  /** The transform in words, for a person reading the file. */
  readonly toViewBox?: string;
  readonly main: MapAffineTransform;
  readonly mainPxPerKmAtStandardParallels?: number;
}

/** `assets/src/svg/screens/<name>.anchors.json`. */
export interface MapAnchorsDocument {
  readonly $schema: string;
  /** The drawing's filename, beside the sidecar. Not a URL: the UI build hashes it. */
  readonly svg: string;
  /** `[minX, minY, width, height]`; every coordinate in the document is in these units. */
  readonly viewBox: readonly [number, number, number, number];
  readonly units?: string;
  /**
   * One point per level, keyed by level id.
   *
   * `string` keys rather than `LevelId`: a record over a branded key has no
   * string index signature to mirror the schema's `additionalProperties`, and
   * validate-content already refuses a key that names no level document.
   */
  readonly anchors: Readonly<Record<string, MapPoint>>;
  /** In drawing order. Absent when no stop needs enlarging; never empty. */
  readonly insets?: readonly MapInset[];
  readonly projection: MapProjection;
  /** ISO 3166-2 codes the drawing carries as element ids, for a screen that inlines it. */
  readonly provincesAndTerritories?: readonly string[];
}
