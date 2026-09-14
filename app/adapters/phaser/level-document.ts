/**
 * The runtime reading of `content/levels/<id>.json`, and the refusal that keeps
 * a level from being loaded at all.
 *
 * ## Why a hand parser and not ajv
 *
 * Same reason as `boot-config.ts`: this runs on the 6 s time-to-play budget and
 * the load path must not pull a JSON Schema validator into a chunk a player
 * waits on. `make validate-content` already checks every level against
 * `content/schemas/level.schema.json` in CI with `additionalProperties: false`;
 * this parser is the runtime guard that turns "the level is wrong" into a
 * `Result` the loader can report instead of a black canvas.
 *
 * ## Why the type is a `Pick` of the port and not an interface of its own
 *
 * `SceneLevel` derives from `LevelDocument` (`@application/ports`), which
 * `tests/unit/contracts/ports-match-schemas.test.ts` pins property-by-property
 * and type-by-type to the schema. Restating the shape here would be a second
 * declaration of the level document that is invisible from the first — the
 * defect ADR-0007 exists to stop. Rename a property in the schema and the
 * contract test fails, then the port is fixed, and then this file stops
 * compiling.
 *
 * The `Pick` is deliberately narrow: `subject`, `order` and `quests` are read by
 * the content and quest layers, not by a scene, and a scene that could reach
 * them would eventually use one. What a scene may read is geometry, art keys and
 * tuning.
 *
 * `territory` is the one that changed, and not into the raw block. What comes
 * out of here is {@link AboutThisPlace} — the territorial claim already
 * adjudicated under ADR-0003, with the statement present only when a verifier
 * granted it. A scene still cannot draw a sentence, because in the refused case
 * there is no sentence in the object to draw.
 *
 * ## The claims (ADR-0003, ADR-0024)
 *
 * Two of a level's fields state facts about Canada: a point of interest's
 * `blurb` and the territorial `statement`. Both carry a `factClaim`, and until
 * this parser adjudicated them both were carried through untouched and drawn —
 * while `verify-content` printed "excluded from the build" about four of them.
 * See `./verified-claim.ts` for the rule and for why the count of what was
 * *examined* travels with the level ({@link SceneLevel.claims}) rather than only
 * the count of what was refused.
 *
 * A refused blurb does not remove the landmark: `pois` is still every placement
 * the level authored, so the art is composed as the level intends and the
 * landmark can still be named. What it removes is the *teaching*, and
 * {@link SceneLevel.teachingPois} — the only list whose `blurb` is non-null — is
 * what the card is built from.
 *
 * **Refusing a claim withholds the claim, not the landmark.** A landmark can have
 * a second job besides teaching: under ADR-0029 it may give a quest, and any
 * landmark may be where a quest sends the player. The level declares that job
 * with `pois[].questId`, and {@link SceneLevel.reachablePois} — landmarks that
 * teach *or* have a quest role — is what the reach events, the auto-stop and the
 * affordance ring are built from. A refused landmark with no quest role is
 * scenery, and the game never offers a tap it cannot honour; a refused landmark
 * that gives the level's quest is still there to be spoken to. Before this split
 * the one list did both jobs, and rejecting Peggy's Point Lighthouse's blurb
 * deleted Peggy's Cove's quest.
 *
 * ## The refusal (TN-LEVEL-02)
 *
 * "A level that cannot fit the texture budget is refused, not crashed into":
 * the manifest's decoded bytes are summed and compared to the level's own
 * declared ceiling *and* to the engine's hard 64 MB ceiling (CLAUDE.md), before
 * any asset is fetched. It is a `Result`, not an exception: a level that is too
 * heavy is an expected authoring failure, and the player gets the error card.
 *
 * Pure: no Phaser, no DOM, no fetch. Everything below is unit tested under
 * `environment: 'node'`.
 */

import type {
  CameraTuning,
  LevelAssetRef,
  LevelCharacter,
  LevelDocument,
  LocalizedText,
  LocomotionTuning,
  ParallaxLayer,
  PointOfInterest,
  Ride,
  RideArt,
  RideBob,
  RideTrack,
  ThemeColours,
  Vec2,
} from '@application/ports';
import type { CharacterId, LevelId, PoiId, SubjectId } from '@domain/ids';
import { appErr, ok, type Result } from '@common/result';

import { DEFAULT_PALETTE } from './boot-config';
import {
  createClaimLedger,
  readFactClaim,
  type AboutThisPlace,
  type ClaimCensus,
  type ClaimLedger,
} from './verified-claim';

/**
 * CLAUDE.md, Budgets: "Decoded texture memory <= 64 MB per level on iPhone."
 * `level.schema.json` caps `textureBudgetBytes` at the same number; this is the
 * engine's own copy of the ceiling, so a level that somehow declares more is
 * still refused at runtime and not only in CI.
 */
export const MAX_DECODED_TEXTURE_BYTES = 67_108_864;

/**
 * What a scene reads out of a level document.
 *
 * Everything except `palette` is the port's own property under the port's own
 * name. `palette` is the level's `theme` merged over the renderer's fallback, so
 * the scene draws without a per-key `??` at every use — the same treatment
 * `BootConfig.palette` gives `game.config.json`'s optional theme.
 */
export interface SceneLevel
  extends Omit<
    Pick<
      LevelDocument,
      | 'id'
      /*
       * The subject this level teaches, carried through for the composition
       * root. It was the one field a level needs outside the scene that the
       * scene's copy dropped, so every question a landmark asked was drawn from
       * the whole bank: Toronto's streetcar asked about Magna Carta (ADR-0036).
       * The scene never reads it.
       */
      | 'subject'
      | 'title'
      | 'size'
      | 'spawn'
      | 'weather'
      | 'camera'
      | 'ground'
      | 'layers'
      | 'locomotion'
      | 'pois'
      | 'characters'
      | 'assets'
      | 'textureBudgetBytes'
    >,
    'pois'
  > {
  /**
   * Every landmark the level places, for the paint pass.
   *
   * `blurb` is nullable here and that is the whole mechanism: a landmark whose
   * claim a verifier declined keeps its art, its position and its name, and has
   * nothing to teach. Nothing that draws prose can take one of these without
   * deciding what a null means.
   */
  readonly pois: readonly ScenePoi[];
  /**
   * The landmarks that may be engaged, because they have something verified to
   * say. A subset of {@link pois}, in the same order.
   *
   * This is the list the interact prompt, the auto-stop, the affordance mark and
   * the POI card are built from. `app/bootstrap/engageables.ts` requires a
   * non-null `blurb` on a placement, so handing the whole level to those callers
   * no longer compiles — the filter cannot be forgotten by a caller who never
   * heard of it, which is the property `Shippable<T>` gives the question bank.
   */
  readonly teachingPois: readonly TeachingPoi[];
  /**
   * The landmarks the player can reach: every one that teaches, and every one
   * the level gives a quest role with `questId`, whatever its claim's verdict.
   * A subset of {@link pois}, in the same order, and a superset of
   * {@link teachingPois}.
   *
   * Separate from {@link teachingPois} because "may draw this blurb" and "is
   * somewhere a quest happens" are different facts, and one list answering both
   * is how a rejected blurb took a quest giver with it. `questId` is the level's
   * own declaration of the role — the only one a scene can read without learning
   * what a quest is — and the contract gate requires it on every landmark giver.
   *
   * What this list cannot see is a landmark a quest step targets *without* the
   * level marking it with `questId`. Such a landmark with a refused blurb is out
   * of reach, and so is its step. That is a content rule to state, not a scene
   * to teach quests to.
   */
  readonly reachablePois: readonly ScenePoi[];
  /**
   * What carries the player, per mode (ADR-0031). Always an array: the document
   * may omit `rides`, and a scene should not have to tell "no rides" from "the
   * field was absent", which mean the same thing.
   */
  readonly rides: readonly Ride[];
  /** The "About this place" panel's content, adjudicated. `docs/content-review.md` §10.2. */
  readonly about: AboutThisPlace;
  /** What the ADR-0003 filter looked at on this level, and what it did. */
  readonly claims: ClaimCensus;
  /** The level's `theme` over `DEFAULT_PALETTE`; always complete. */
  readonly palette: ThemeColours;
  /** Sum of `assets[].decodedBytes`. Compared to the two ceilings above. */
  readonly decodedTextureBytes: number;
}

/**
 * A landmark as a scene holds it: the port's own POI, with a blurb that may be
 * absent because the claim in it was not verified.
 *
 * Derived from `PointOfInterest` rather than restated, so every other property
 * stays pinned to `level.schema.json` through
 * `tests/unit/contracts/ports-match-schemas.test.ts`.
 */
export interface ScenePoi extends Omit<PointOfInterest, 'blurb'> {
  /** The verified fact this landmark teaches, or `null` when there is not one. */
  readonly blurb: LocalizedText | null;
}

/** A landmark with something to teach. The only kind the player can engage. */
export interface TeachingPoi extends ScenePoi {
  readonly blurb: LocalizedText;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const invalid = (field: string, message: string): Result<never> =>
  appErr('invalid', `content.level.${field}`, message, { field });

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

function readId(source: Record<string, unknown>, field: string): Result<string> {
  const value = source[field];
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    return invalid(field, `"${field}" must be a kebab-case id.`);
  }
  return ok(value);
}

function readNumber(
  source: Record<string, unknown>,
  field: string,
  bounds: { readonly min?: number; readonly max?: number; readonly exclusiveMin?: number } = {},
): Result<number> {
  const value = source[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return invalid(field, `"${field}" must be a finite number.`);
  }
  if (bounds.exclusiveMin !== undefined && value <= bounds.exclusiveMin) {
    return invalid(field, `"${field}" must be greater than ${String(bounds.exclusiveMin)}.`);
  }
  if (bounds.min !== undefined && value < bounds.min) {
    return invalid(field, `"${field}" must be at least ${String(bounds.min)}.`);
  }
  if (bounds.max !== undefined && value > bounds.max) {
    return invalid(field, `"${field}" must be at most ${String(bounds.max)}.`);
  }
  return ok(value);
}

function readVec2(source: Record<string, unknown>, field: string): Result<Vec2> {
  const value = source[field];
  if (!isRecord(value)) return invalid(field, `"${field}" must be an object with x and y.`);
  const x = readNumber(value, 'x');
  if (!x.ok) return invalid(`${field}.x`, `"${field}.x" must be a finite number.`);
  const y = readNumber(value, 'y');
  if (!y.ok) return invalid(`${field}.y`, `"${field}.y" must be a finite number.`);
  return ok({ x: x.value, y: y.value });
}

function readArray(source: Record<string, unknown>, field: string, minItems: number): Result<readonly unknown[]> {
  const value = source[field];
  if (!Array.isArray(value)) return invalid(field, `"${field}" must be an array.`);
  if (value.length < minItems) {
    return invalid(field, `"${field}" needs at least ${String(minItems)} item(s).`);
  }
  return ok(value);
}

function readLocalizedText(
  source: Record<string, unknown>,
  field: string,
): Result<{ readonly en: string; readonly fr: string }> {
  const value = source[field];
  if (!isRecord(value)) return invalid(field, `"${field}" must carry en and fr.`);
  const en = value['en'];
  const fr = value['fr'];
  if (typeof en !== 'string' || en.length === 0 || typeof fr !== 'string' || fr.length === 0) {
    return invalid(field, `"${field}" must carry non-empty en and fr text (ADR-0003).`);
  }
  return ok({ en, fr });
}

/** Every weather `level.schema.json#/properties/weather` offers, in its order. */
const WEATHERS: readonly LevelDocument['weather'][] = ['snow', 'none'];

/**
 * The level's `weather`, required and refused when absent.
 *
 * No default, in either direction. The scene used to snow on every level
 * because no document could say otherwise, so eight summer and autumn levels
 * drew winter; a default of `none` would take the snow off the two winter
 * levels the first time one forgot the field. A level that does not say is an
 * authoring error, and the loader reports it.
 */
function readWeather(source: Record<string, unknown>): Result<LevelDocument['weather']> {
  const value = source['weather'];
  const weather = WEATHERS.find((candidate) => candidate === value);
  if (weather === undefined) {
    return invalid(
      'weather',
      `"weather" must be one of ${WEATHERS.join(', ')}. It has no default: a level says ` +
        'whether snow falls on it, from the season its art sheet states.',
    );
  }
  return ok(weather);
}

/** The level's optional `theme`, merged per key over the renderer's fallback. */
function readPalette(source: Record<string, unknown>): Result<ThemeColours> {
  const theme = source['theme'];
  if (theme === undefined) return ok(DEFAULT_PALETTE);
  if (!isRecord(theme)) return invalid('theme', '"theme" must be an object when present.');

  const merged: Record<string, string> = { ...DEFAULT_PALETTE };
  for (const key of Object.keys(DEFAULT_PALETTE)) {
    const value = theme[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || !HEX_COLOUR.test(value)) {
      return invalid(`theme.${key}`, `"theme.${key}" must be #rrggbb.`);
    }
    merged[key] = value;
  }
  return ok(merged as unknown as ThemeColours);
}

function readCamera(source: Record<string, unknown>): Result<CameraTuning> {
  const camera = source['camera'];
  if (!isRecord(camera)) return invalid('camera', '"camera" must be an object.');

  const followLerp = readNumber(camera, 'followLerp', { exclusiveMin: 0, max: 1 });
  if (!followLerp.ok) return followLerp;
  const deadZone = readVec2(camera, 'deadZone');
  if (!deadZone.ok) return deadZone;
  const offset = readVec2(camera, 'offset');
  if (!offset.ok) return offset;
  const zoom = readNumber(camera, 'zoom', { exclusiveMin: 0 });
  if (!zoom.ok) return zoom;

  return ok({
    followLerp: followLerp.value,
    deadZone: deadZone.value,
    offset: offset.value,
    zoom: zoom.value,
  });
}

/**
 * The ground polyline.
 *
 * Ordered left to right is a schema *description* and not something JSON Schema
 * can express, so it is checked here: `slopeAt` and `groundYAt` in
 * `ground-profile.ts` both assume monotonic x, and an out-of-order point would
 * produce a silently wrong slope rather than a failure.
 */
function readGround(source: Record<string, unknown>): Result<readonly Vec2[]> {
  const raw = readArray(source, 'ground', 2);
  if (!raw.ok) return raw;

  const points: Vec2[] = [];
  for (const [index, item] of raw.value.entries()) {
    if (!isRecord(item)) return invalid(`ground[${String(index)}]`, 'each ground point is an object.');
    const point = readVec2({ point: item }, 'point');
    if (!point.ok) return invalid(`ground[${String(index)}]`, 'each ground point needs finite x and y.');
    const previous = points[points.length - 1];
    if (previous !== undefined && point.value.x <= previous.x) {
      return invalid(
        `ground[${String(index)}]`,
        'the ground polyline must be ordered left to right with strictly increasing x; ' +
          'slope is sampled from consecutive points and an out-of-order point samples backwards.',
      );
    }
    points.push(point.value);
  }
  return ok(points);
}

function readLayers(source: Record<string, unknown>): Result<readonly ParallaxLayer[]> {
  const raw = readArray(source, 'layers', 1);
  if (!raw.ok) return raw;

  const layers: ParallaxLayer[] = [];
  for (const [index, item] of raw.value.entries()) {
    const where = `layers[${String(index)}]`;
    if (!isRecord(item)) return invalid(where, `"${where}" must be an object.`);
    const key = readId(item, 'key');
    if (!key.ok) return invalid(`${where}.key`, `"${where}.key" must be a kebab-case texture key.`);
    const depth = readNumber(item, 'depth');
    if (!depth.ok) return invalid(`${where}.depth`, `"${where}.depth" must be a number.`);
    const scrollFactor = readVec2(item, 'scrollFactor');
    if (!scrollFactor.ok) return invalid(`${where}.scrollFactor`, `"${where}.scrollFactor" needs x and y.`);
    const offset = readVec2(item, 'offset');
    if (!offset.ok) return invalid(`${where}.offset`, `"${where}.offset" needs x and y.`);
    if (typeof item['repeatX'] !== 'boolean') {
      return invalid(`${where}.repeatX`, `"${where}.repeatX" must be a boolean.`);
    }
    layers.push({
      key: key.value,
      depth: depth.value,
      scrollFactor: scrollFactor.value,
      offset: offset.value,
      repeatX: item['repeatX'],
    });
  }
  return ok(layers);
}

/**
 * One locomotion tuning.
 *
 * The band `deceleration < turnAcceleration < acceleration` is *not* checked
 * here. It is a coherence rule over authored content and it has an owner:
 * `tests/unit/contracts/locomotion-tuning-is-coherent.test.ts` reads every level
 * in the repository and fails the build on it. Re-checking it at runtime would
 * give one defect two owners and would let a level ship that CI never saw.
 */
function readTuning(
  raw: unknown,
  where: string,
  modes: readonly string[],
): Result<LocomotionTuning> {
  if (!isRecord(raw)) return invalid(where, `"${where}" must be an object.`);

  const mode = raw['mode'];
  if (typeof mode !== 'string' || !modes.includes(mode)) {
    return invalid(`${where}.mode`, `"${where}.mode" must be one of ${modes.join(', ')}.`);
  }
  const drive = raw['drive'];
  if (drive !== 'held' && drive !== 'auto') {
    return invalid(`${where}.drive`, `"${where}.drive" must be "held" or "auto".`);
  }
  const labelKey = raw['labelKey'];
  if (typeof labelKey !== 'string' || labelKey.length === 0) {
    return invalid(`${where}.labelKey`, `"${where}.labelKey" must be a localiser key (ADR-0010).`);
  }

  const numbers: Record<string, number> = {};
  const spec = [
    ['maxSpeed', { exclusiveMin: 0 }],
    ['acceleration', { exclusiveMin: 0 }],
    ['deceleration', { min: 0 }],
    ['turnAcceleration', { exclusiveMin: 0 }],
    ['glide', { min: 0, max: 1 }],
    ['maxSpeedMultiplierDownhill', { min: 1 }],
  ] as const;
  for (const [field, bounds] of spec) {
    const value = readNumber(raw, field, bounds);
    if (!value.ok) return invalid(`${where}.${field}`, value.error.message);
    numbers[field] = value.value;
  }

  const jump = readJump(raw['jump'], `${where}.jump`);
  if (!jump.ok) return jump;
  const interaction = readInteraction(raw['interaction'], `${where}.interaction`);
  if (!interaction.ok) return interaction;
  const animation = readAnimation(raw['animation'], `${where}.animation`);
  if (!animation.ok) return animation;

  return ok({
    mode: mode as LocomotionTuning['mode'],
    maxSpeed: numbers['maxSpeed'] ?? 0,
    acceleration: numbers['acceleration'] ?? 0,
    deceleration: numbers['deceleration'] ?? 0,
    turnAcceleration: numbers['turnAcceleration'] ?? 0,
    glide: numbers['glide'] ?? 0,
    maxSpeedMultiplierDownhill: numbers['maxSpeedMultiplierDownhill'] ?? 1,
    drive,
    jump: jump.value,
    interaction: interaction.value,
    animation: animation.value,
    labelKey,
  });
}

function readJump(raw: unknown, where: string): Result<LocomotionTuning['jump']> {
  if (raw === null) return ok(null);
  if (!isRecord(raw)) {
    return invalid(where, `"${where}" must be an object or null — null is how a mode says it cannot jump.`);
  }
  const impulse = readNumber(raw, 'impulse', { exclusiveMin: 0 });
  if (!impulse.ok) return invalid(`${where}.impulse`, impulse.error.message);
  const maxHoldMs = readNumber(raw, 'maxHoldMs', { min: 0 });
  if (!maxHoldMs.ok) return invalid(`${where}.maxHoldMs`, maxHoldMs.error.message);
  const airControl = readNumber(raw, 'airControl', { min: 0, max: 1 });
  if (!airControl.ok) return invalid(`${where}.airControl`, airControl.error.message);
  const coyoteMs = readNumber(raw, 'coyoteMs', { min: 0 });
  if (!coyoteMs.ok) return invalid(`${where}.coyoteMs`, coyoteMs.error.message);
  const bufferMs = readNumber(raw, 'bufferMs', { min: 0 });
  if (!bufferMs.ok) return invalid(`${where}.bufferMs`, bufferMs.error.message);
  const maxJumps = readNumber(raw, 'maxJumps', { min: 1 });
  if (!maxJumps.ok) return invalid(`${where}.maxJumps`, maxJumps.error.message);

  return ok({
    impulse: impulse.value,
    maxHoldMs: maxHoldMs.value,
    airControl: airControl.value,
    coyoteMs: coyoteMs.value,
    bufferMs: bufferMs.value,
    maxJumps: Math.floor(maxJumps.value),
  });
}

function readInteraction(raw: unknown, where: string): Result<LocomotionTuning['interaction']> {
  if (raw === null) return ok(null);
  if (!isRecord(raw)) {
    return invalid(where, `"${where}" must be an object or null — null is how a mode says it cannot engage.`);
  }
  const reachPx = readNumber(raw, 'reachPx', { exclusiveMin: 0 });
  if (!reachPx.ok) return invalid(`${where}.reachPx`, reachPx.error.message);
  const approachSpeed = readNumber(raw, 'approachSpeed', { min: 0 });
  if (!approachSpeed.ok) return invalid(`${where}.approachSpeed`, approachSpeed.error.message);
  if (typeof raw['requiresStop'] !== 'boolean' || typeof raw['whileMoving'] !== 'boolean') {
    return invalid(where, `"${where}" needs boolean requiresStop and whileMoving.`);
  }
  return ok({
    reachPx: reachPx.value,
    requiresStop: raw['requiresStop'],
    whileMoving: raw['whileMoving'],
    approachSpeed: approachSpeed.value,
  });
}

function readAnimation(raw: unknown, where: string): Result<LocomotionTuning['animation']> {
  if (!isRecord(raw)) return invalid(where, `"${where}" must be an object.`);
  const speedInput = raw['speedInput'];
  if (typeof speedInput !== 'string' || speedInput.length === 0) {
    return invalid(`${where}.speedInput`, `"${where}.speedInput" must name a rig input.`);
  }
  const binding: { -readonly [K in keyof LocomotionTuning['animation']]: string } = { speedInput };
  for (const field of ['jumpTrigger', 'landTrigger'] as const) {
    const value = raw[field];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.length === 0) {
      return invalid(`${where}.${field}`, `"${where}.${field}" must name a rig input when present.`);
    }
    binding[field] = value;
  }
  return ok(binding);
}

/**
 * The level's rides (ADR-0031), refused where the schema cannot see.
 *
 * `level.schema.json` validates each ride on its own. It cannot compare a ride's
 * `mode` with the level's `locomotion[]`, and it cannot say that two rides do not
 * carry one mode or that a ride has one layer per side, because each of those is
 * an item compared with a sibling. A ride for a mode the level never moves by is
 * art that is charged and never drawn; two rides for one mode would leave the
 * scene choosing between them. Both are authoring errors, so both are a
 * `Result` the loader reports rather than a picture somebody has to notice.
 */
function readRides(
  source: Record<string, unknown>,
  locomotion: readonly LocomotionTuning[],
): Result<readonly Ride[]> {
  const raw = source['rides'];
  if (raw === undefined) return ok([]);
  if (!Array.isArray(raw)) return invalid('rides', '"rides" must be an array when present.');

  const declared = locomotion.map((tuning) => tuning.mode as string);
  const carried = new Set<string>();
  const rides: Ride[] = [];
  for (const [index, item] of raw.entries()) {
    const where = `rides[${String(index)}]`;
    if (!isRecord(item)) return invalid(where, `"${where}" must be an object.`);

    const mode = item['mode'];
    if (typeof mode !== 'string' || !declared.includes(mode)) {
      return invalid(
        `${where}.mode`,
        `"${where}.mode" must be one of this level's locomotion modes (${declared.join(', ')}). ` +
          'A ride for a mode the level never moves by is never drawn.',
      );
    }
    if (carried.has(mode)) {
      return invalid(`${where}.mode`, `two rides carry "${mode}"; a mode has at most one ride.`);
    }
    carried.add(mode);

    const rawArt = readArray(item, 'art', 1);
    if (!rawArt.ok) return invalid(`${where}.art`, `"${where}.art" needs at least one layer.`);
    const art: RideArt[] = [];
    for (const [layerIndex, layer] of rawArt.value.entries()) {
      const at = `${where}.art[${String(layerIndex)}]`;
      if (!isRecord(layer)) return invalid(at, `"${at}" must be an object.`);
      const key = readId(layer, 'key');
      if (!key.ok) return invalid(`${at}.key`, `"${at}.key" must be a kebab-case texture key.`);
      const side = layer['side'];
      if (side !== 'behind' && side !== 'front') {
        return invalid(`${at}.side`, `"${at}.side" must be "behind" or "front".`);
      }
      if (art.some((existing) => existing.side === side)) {
        return invalid(`${at}.side`, `"${where}" has two "${side}" layers; a ride has one per side.`);
      }
      art.push({ key: key.value, side });
    }

    const riderAnchor = readVec2(item, 'riderAnchor');
    if (!riderAnchor.ok) return invalid(`${where}.riderAnchor`, `"${where}.riderAnchor" needs x and y.`);
    if (riderAnchor.value.x < 0 || riderAnchor.value.y < 0) {
      return invalid(
        `${where}.riderAnchor`,
        `"${where}.riderAnchor" is measured from the art's top-left corner and cannot be negative.`,
      );
    }
    const groundLineY = readNumber(item, 'groundLineY', { min: 0 });
    if (!groundLineY.ok) return invalid(`${where}.groundLineY`, groundLineY.error.message);
    const turnsWithRider = item['turnsWithRider'];
    if (typeof turnsWithRider !== 'boolean') {
      return invalid(`${where}.turnsWithRider`, `"${where}.turnsWithRider" must be a boolean.`);
    }

    const ride: { -readonly [K in keyof Ride]: Ride[K] } = {
      mode,
      art,
      riderAnchor: riderAnchor.value,
      groundLineY: groundLineY.value,
      turnsWithRider,
    };

    const bob = item['bob'];
    if (bob !== undefined) {
      if (!isRecord(bob)) return invalid(`${where}.bob`, `"${where}.bob" must be an object when present.`);
      const amplitudePx = readNumber(bob, 'amplitudePx', { min: 0 });
      if (!amplitudePx.ok) return invalid(`${where}.bob.amplitudePx`, amplitudePx.error.message);
      const periodPx = readNumber(bob, 'periodPx', { exclusiveMin: 0 });
      if (!periodPx.ok) return invalid(`${where}.bob.periodPx`, periodPx.error.message);
      const parsed: RideBob = { amplitudePx: amplitudePx.value, periodPx: periodPx.value };
      ride.bob = parsed;
    }

    const track = item['track'];
    if (track !== undefined) {
      if (!isRecord(track)) {
        return invalid(`${where}.track`, `"${where}.track" must be an object when present.`);
      }
      const artKey = readId(track, 'artKey');
      if (!artKey.ok) {
        return invalid(`${where}.track.artKey`, `"${where}.track.artKey" must be a kebab-case texture key.`);
      }
      const topY = readNumber(track, 'topY');
      if (!topY.ok) return invalid(`${where}.track.topY`, topY.error.message);
      const parsed: RideTrack = { artKey: artKey.value, topY: topY.value };
      ride.track = parsed;
    }

    rides.push(ride);
  }
  return ok(rides);
}

/** Every landmark the level places, the ones that may teach, and the ones in reach. */
interface ReadPois {
  readonly pois: readonly ScenePoi[];
  readonly teaching: readonly TeachingPoi[];
  readonly reachable: readonly ScenePoi[];
}

function readPois(source: Record<string, unknown>, ledger: ClaimLedger): Result<ReadPois> {
  const raw = readArray(source, 'pois', 0);
  if (!raw.ok) return raw;

  const pois: ScenePoi[] = [];
  const teaching: TeachingPoi[] = [];
  const reachable: ScenePoi[] = [];
  for (const [index, item] of raw.value.entries()) {
    const where = `pois[${String(index)}]`;
    if (!isRecord(item)) return invalid(where, `"${where}" must be an object.`);
    const id = readId(item, 'id');
    if (!id.ok) return invalid(`${where}.id`, `"${where}.id" must be a kebab-case id.`);
    const name = readLocalizedText(item, 'name');
    if (!name.ok) return invalid(`${where}.name`, name.error.message);
    const blurb = readLocalizedText(item, 'blurb');
    if (!blurb.ok) return invalid(`${where}.blurb`, blurb.error.message);
    const position = readVec2(item, 'position');
    if (!position.ok) return invalid(`${where}.position`, position.error.message);
    const artKey = readId(item, 'artKey');
    if (!artKey.ok) return invalid(`${where}.artKey`, `"${where}.artKey" must be a kebab-case texture key.`);
    const radiusPx = readNumber(item, 'radiusPx', { exclusiveMin: 0 });
    if (!radiusPx.ok) return invalid(`${where}.radiusPx`, radiusPx.error.message);

    /*
     * The claim, read strictly and then adjudicated.
     *
     * This block used to be carried through untouched, on the reasoning that
     * "whether the blurb states something true is ADR-0003's question and the
     * content gates answer it". The gates answer it in CI; nothing answered it
     * at run time, and `ottawa /pois/3` — "The Rideau Canal was built as a
     * military waterway", where the cited page says it was *once* one — was
     * rejected by a verifier and drawn to a player on the same day.
     *
     * `fact` is still carried, because a claim must travel with the prose it is
     * about. What is new is that the prose does not travel unless the claim
     * passed.
     */
    const claim = readFactClaim(item['fact'], `${where}.fact`);
    if (!claim.ok) return claim;
    const refusal = ledger.admit(`/pois/${String(index)}`, claim.value);

    const poi: { -readonly [K in keyof ScenePoi]: ScenePoi[K] } = {
      id: id.value as PoiId,
      name: name.value,
      blurb: refusal === null ? blurb.value : null,
      fact: item['fact'] as unknown as PointOfInterest['fact'],
      position: position.value,
      artKey: artKey.value,
      radiusPx: radiusPx.value,
    };
    const questId = item['questId'];
    if (typeof questId === 'string') poi.questId = questId as NonNullable<PointOfInterest['questId']>;
    pois.push(poi);
    if (refusal === null) teaching.push({ ...poi, blurb: blurb.value });
    /* In reach when it teaches, or when the level gives it a quest role. The
       verdict decides whether the card draws, never whether the quest can be
       reached. */
    if (refusal === null || poi.questId !== undefined) reachable.push(poi);
  }
  return ok({ pois, teaching, reachable });
}

/**
 * The territorial statement, adjudicated into what the panel may draw.
 *
 * Required, as `level.schema.json` requires it. A level with no `territory` at
 * all would present as a panel with nothing in it, which is exactly the silence
 * `docs/content-review.md` §10.2 forbids — so it is refused here rather than
 * discovered by a player who opened the panel.
 *
 * What comes back in the refused case carries no `nations` and no publisher: see
 * {@link AboutThisPlace} for why a list of nations is the same attribution as
 * the sentence.
 */
function readTerritory(
  source: Record<string, unknown>,
  ledger: ClaimLedger,
): Result<AboutThisPlace> {
  const territory = source['territory'];
  if (!isRecord(territory)) {
    return invalid(
      'territory',
      '"territory" must be an object. docs/content-review.md §10.2 fixes the "About this place" ' +
        'panel as always reachable, and a panel with no source of content is a panel that ' +
        'silently says nothing.',
    );
  }

  const rawNations = readArray(territory, 'nations', 1);
  if (!rawNations.ok) return invalid('territory.nations', rawNations.error.message);
  const nations: string[] = [];
  for (const [index, nation] of rawNations.value.entries()) {
    if (typeof nation !== 'string' || nation.trim().length === 0) {
      return invalid(
        `territory.nations[${String(index)}]`,
        'each nation is named, as that nation names itself (docs/content-review.md §3.1).',
      );
    }
    nations.push(nation);
  }

  const statement = readLocalizedText(territory, 'statement');
  if (!statement.ok) return invalid('territory.statement', statement.error.message);

  const nationSource = territory['nationSource'];
  if (
    !isRecord(nationSource) ||
    typeof nationSource['publisher'] !== 'string' ||
    typeof nationSource['url'] !== 'string'
  ) {
    return invalid(
      'territory.nationSource',
      '"territory.nationSource" must name a publisher and a url: §10.2 requires the panel to ' +
        'name where the statement comes from, and a panel that cannot cite it may not draw it.',
    );
  }

  const claim = readFactClaim(territory['fact'], 'territory.fact');
  if (!claim.ok) return claim;
  const refusal = ledger.admit('/territory', claim.value);
  if (refusal !== null) {
    return ok({
      kind: 'unavailable',
      status: refusal.status,
      why: refusal.why,
      message: refusal.message,
    });
  }

  return ok({
    kind: 'statement',
    nations,
    statement: statement.value,
    publisher: nationSource['publisher'],
    sourceUrl: nationSource['url'],
  });
}

function readCharacters(source: Record<string, unknown>): Result<readonly LevelCharacter[]> {
  const raw = readArray(source, 'characters', 0);
  if (!raw.ok) return raw;

  const characters: LevelCharacter[] = [];
  for (const [index, item] of raw.value.entries()) {
    const where = `characters[${String(index)}]`;
    if (!isRecord(item)) return invalid(where, `"${where}" must be an object.`);
    const characterId = readId(item, 'characterId');
    if (!characterId.ok) return invalid(`${where}.characterId`, `"${where}.characterId" must be an id.`);
    const position = readVec2(item, 'position');
    if (!position.ok) return invalid(`${where}.position`, position.error.message);
    const facing = item['facing'];
    if (facing !== 'left' && facing !== 'right') {
      return invalid(`${where}.facing`, `"${where}.facing" must be "left" or "right".`);
    }
    const character: { -readonly [K in keyof LevelCharacter]: LevelCharacter[K] } = {
      characterId: characterId.value as CharacterId,
      position: position.value,
      facing,
    };
    const questId = item['questId'];
    if (typeof questId === 'string') character.questId = questId as NonNullable<LevelCharacter['questId']>;
    characters.push(character);
  }
  return ok(characters);
}

const ASSET_KINDS: readonly LevelAssetRef['kind'][] = [
  'atlas',
  'rive',
  'audio',
  'font',
  'tilemap',
  'json',
];

function readAssets(source: Record<string, unknown>): Result<readonly LevelAssetRef[]> {
  const raw = readArray(source, 'assets', 0);
  if (!raw.ok) return raw;

  const assets: LevelAssetRef[] = [];
  for (const [index, item] of raw.value.entries()) {
    const where = `assets[${String(index)}]`;
    if (!isRecord(item)) return invalid(where, `"${where}" must be an object.`);
    const key = readId(item, 'key');
    if (!key.ok) return invalid(`${where}.key`, `"${where}.key" must be a kebab-case key.`);
    const kind = item['kind'];
    if (typeof kind !== 'string' || !ASSET_KINDS.includes(kind as LevelAssetRef['kind'])) {
      return invalid(`${where}.kind`, `"${where}.kind" must be one of ${ASSET_KINDS.join(', ')}.`);
    }
    const url = item['url'];
    if (typeof url !== 'string' || url.length === 0) {
      return invalid(`${where}.url`, `"${where}.url" must be a non-empty path.`);
    }
    const bytes = readNumber(item, 'bytes', { min: 0 });
    if (!bytes.ok) return invalid(`${where}.bytes`, bytes.error.message);
    const decodedBytes = readNumber(item, 'decodedBytes', { min: 0 });
    if (!decodedBytes.ok) return invalid(`${where}.decodedBytes`, decodedBytes.error.message);

    assets.push({
      key: key.value,
      kind: kind as LevelAssetRef['kind'],
      url,
      bytes: bytes.value,
      decodedBytes: decodedBytes.value,
    });
  }
  return ok(assets);
}

/**
 * Parse a level document into what a scene needs, or say why not.
 *
 * Order matters only in one place and it is the point of TN-LEVEL-02's last
 * scenario: the texture-budget refusal is the *last* check, and it happens here
 * — before the loader has been handed anything it could fetch.
 */
export function parseLevelDocument(
  raw: unknown,
  /**
   * The locomotion modes a level may name, from `content/game.config.json`.
   *
   * **Required, with no default**, and that is the whole point (ADR-0023). This
   * parser held its own list of eight mode names, so Québec City declaring
   * `toboggan` passed `make validate-content` — the schema knew the mode — and
   * then failed at load with `"locomotion[0].mode" must be one of walk, canoe,
   * skate, …`. A content-only level had broken on an engine literal, which is
   * exactly what "a level is addable by JSON and assets alone" forbids.
   *
   * A default parameter would have kept that copy alive for any caller that
   * forgot, which is every caller eventually. Passing it is now the only option.
   */
  modes: readonly string[],
): Result<SceneLevel> {
  if (!isRecord(raw)) return invalid('document', 'a level document must be a JSON object.');

  const id = readId(raw, 'id');
  if (!id.ok) return id;
  const subject = readId(raw, 'subject');
  if (!subject.ok) return subject;
  const title = readLocalizedText(raw, 'title');
  if (!title.ok) return title;
  const size = readVec2(raw, 'size');
  if (!size.ok) return size;
  if (size.value.x <= 0 || size.value.y <= 0) {
    return invalid('size', '"size" must be positive in both axes.');
  }
  const spawn = readVec2(raw, 'spawn');
  if (!spawn.ok) return spawn;
  const weather = readWeather(raw);
  if (!weather.ok) return weather;
  const palette = readPalette(raw);
  if (!palette.ok) return palette;
  const camera = readCamera(raw);
  if (!camera.ok) return camera;
  const ground = readGround(raw);
  if (!ground.ok) return ground;
  const layers = readLayers(raw);
  if (!layers.ok) return layers;

  const rawLocomotion = readArray(raw, 'locomotion', 1);
  if (!rawLocomotion.ok) return rawLocomotion;
  const locomotion: LocomotionTuning[] = [];
  for (const [index, item] of rawLocomotion.value.entries()) {
    const tuning = readTuning(item, `locomotion[${String(index)}]`, modes);
    if (!tuning.ok) return tuning;
    locomotion.push(tuning.value);
  }
  const rides = readRides(raw, locomotion);
  if (!rides.ok) return rides;

  const ledger = createClaimLedger();
  const about = readTerritory(raw, ledger);
  if (!about.ok) return about;
  const pois = readPois(raw, ledger);
  if (!pois.ok) return pois;
  const characters = readCharacters(raw);
  if (!characters.ok) return characters;
  const assets = readAssets(raw);
  if (!assets.ok) return assets;
  const textureBudgetBytes = readNumber(raw, 'textureBudgetBytes', {
    exclusiveMin: 0,
    max: MAX_DECODED_TEXTURE_BYTES,
  });
  if (!textureBudgetBytes.ok) return textureBudgetBytes;

  const decodedTextureBytes = assets.value.reduce((total, asset) => total + asset.decodedBytes, 0);

  const level: SceneLevel = {
    id: id.value as LevelId,
    subject: subject.value as SubjectId,
    title: title.value,
    size: size.value,
    spawn: spawn.value,
    weather: weather.value,
    camera: camera.value,
    ground: ground.value,
    layers: layers.value,
    locomotion,
    pois: pois.value.pois,
    teachingPois: pois.value.teaching,
    reachablePois: pois.value.reachable,
    rides: rides.value,
    about: about.value,
    claims: ledger.census,
    characters: characters.value,
    assets: assets.value,
    textureBudgetBytes: textureBudgetBytes.value,
    palette: palette.value,
    decodedTextureBytes,
  };

  return refuseSilentLevel(level) ?? refuseOverBudget(level) ?? ok(level);
}

/**
 * "A level whose claims are all filtered out must not reduce to a pass"
 * (ADR-0024).
 *
 * The two numbers are both in the message for the same reason
 * `admitSubjectBank` puts `offered` and `admitted` in its own: *no landmarks*
 * and *no landmark that may speak* need different fixes and look identical from
 * the outside. A level that authored no `pois` is a legal level and is not this
 * check's business; a level that authored four and had all four declined is a
 * walk with scenery, and shipping it as a level would mean the ADR-0003 filter
 * had quietly emptied a subject of everything it teaches.
 *
 * Deliberately **not** extended to the territorial statement: a refused
 * statement is drawn as a refusal by the panel (`AboutThisPlace`), which is
 * `docs/content-review.md` §10.2's "always reachable" holding even when the
 * sentence cannot be shown. Refusing the level for it would take the panel away
 * along with everything else.
 */
export function refuseSilentLevel(level: SceneLevel): Result<never> | null {
  if (level.pois.length === 0 || level.teachingPois.length > 0) return null;
  return appErr(
    'invalid',
    'content.level.noVerifiedClaim',
    `level "${level.id}" places ${String(level.pois.length)} landmark(s) and none of them may ` +
      `speak: every blurb is unverified, rejected, quarantined, cites a source hash its ` +
      'verification was not granted for, or quotes no evidence (ADR-0003). A level that teaches ' +
      'nothing is refused rather than opened, because an empty level and a fully filtered one ' +
      'are the same picture (ADR-0024).',
    {
      level: level.id,
      placed: level.pois.length,
      teaching: level.teachingPois.length,
      refused: level.claims.refused.map((claim) => claim.pointer),
    },
  );
}

/**
 * "A level that cannot fit the texture budget is refused, not crashed into."
 *
 * Returns the failure, or `null` when the level fits. Split out so the loader
 * can re-run it against a manifest that grew after parse time, and so a test can
 * ask the question without building a whole document.
 */
export function refuseOverBudget(level: SceneLevel): Result<never> | null {
  if (level.decodedTextureBytes > level.textureBudgetBytes) {
    return appErr(
      'invalid',
      'content.level.textureBudget',
      `level "${level.id}" declares ${String(level.textureBudgetBytes)} decoded texture bytes but ` +
        `its manifest sums to ${String(level.decodedTextureBytes)}. Refused before any asset was ` +
        'fetched (TN-LEVEL-02).',
      { level: level.id, declared: level.textureBudgetBytes, manifest: level.decodedTextureBytes },
    );
  }
  if (level.decodedTextureBytes > MAX_DECODED_TEXTURE_BYTES) {
    return appErr(
      'invalid',
      'content.level.textureCeiling',
      `level "${level.id}" needs ${String(level.decodedTextureBytes)} decoded texture bytes, over ` +
        `the ${String(MAX_DECODED_TEXTURE_BYTES)} byte per-level ceiling (CLAUDE.md, Budgets).`,
      { level: level.id, manifest: level.decodedTextureBytes },
    );
  }
  return null;
}
