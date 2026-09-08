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
 * The `Pick` is deliberately narrow: `subject`, `order`, `territory` and
 * `quests` are read by the content and quest layers, not by a scene, and a scene
 * that could reach them would eventually use one. What a scene may read is
 * geometry, art keys and tuning.
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
  LocomotionTuning,
  ParallaxLayer,
  PointOfInterest,
  ThemeColours,
  Vec2,
} from '@application/ports';
import type { CharacterId, LevelId, PoiId } from '@domain/ids';
import { appErr, ok, type Result } from '@common/result';

import { DEFAULT_PALETTE } from './boot-config';

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
  extends Pick<
    LevelDocument,
    | 'id'
    | 'title'
    | 'size'
    | 'spawn'
    | 'camera'
    | 'ground'
    | 'layers'
    | 'locomotion'
    | 'pois'
    | 'characters'
    | 'assets'
    | 'textureBudgetBytes'
  > {
  /** The level's `theme` over `DEFAULT_PALETTE`; always complete. */
  readonly palette: ThemeColours;
  /** Sum of `assets[].decodedBytes`. Compared to the two ceilings above. */
  readonly decodedTextureBytes: number;
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
function readTuning(raw: unknown, where: string): Result<LocomotionTuning> {
  if (!isRecord(raw)) return invalid(where, `"${where}" must be an object.`);

  const mode = raw['mode'];
  if (typeof mode !== 'string' || !LOCOMOTION_MODES.includes(mode as LocomotionTuning['mode'])) {
    return invalid(`${where}.mode`, `"${where}.mode" must be one of ${LOCOMOTION_MODES.join(', ')}.`);
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

/** `level.schema.json#/$defs/locomotionMode`, in schema order. */
export const LOCOMOTION_MODES: readonly LocomotionTuning['mode'][] = [
  'walk',
  'canoe',
  'skate',
  'bike',
  'train',
  'horse',
  'skateboard',
  'dogsled',
];

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
  for (const field of ['airborneInput', 'jumpTrigger', 'landTrigger', 'brakeTrigger'] as const) {
    const value = raw[field];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.length === 0) {
      return invalid(`${where}.${field}`, `"${where}.${field}" must name a rig input when present.`);
    }
    binding[field] = value;
  }
  return ok(binding);
}

function readPois(source: Record<string, unknown>): Result<readonly PointOfInterest[]> {
  const raw = readArray(source, 'pois', 0);
  if (!raw.ok) return raw;

  const pois: PointOfInterest[] = [];
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

    /* `fact` is carried through untouched: whether the blurb states something
       true is ADR-0003's question and the content gates answer it. A scene must
       not be able to render a POI whose claim it silently dropped. */
    const fact = item['fact'];
    if (!isRecord(fact) || typeof fact['factual'] !== 'boolean') {
      return invalid(
        `${where}.fact`,
        `"${where}.fact" must declare "factual"; ADR-0003 governs a landmark blurb exactly as it ` +
          'governs a question, and an absent declaration is an unchecked claim.',
      );
    }

    const poi: { -readonly [K in keyof PointOfInterest]: PointOfInterest[K] } = {
      id: id.value as PoiId,
      name: name.value,
      blurb: blurb.value,
      fact: fact as unknown as PointOfInterest['fact'],
      position: position.value,
      artKey: artKey.value,
      radiusPx: radiusPx.value,
    };
    const questId = item['questId'];
    if (typeof questId === 'string') poi.questId = questId as NonNullable<PointOfInterest['questId']>;
    pois.push(poi);
  }
  return ok(pois);
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
export function parseLevelDocument(raw: unknown): Result<SceneLevel> {
  if (!isRecord(raw)) return invalid('document', 'a level document must be a JSON object.');

  const id = readId(raw, 'id');
  if (!id.ok) return id;
  const title = readLocalizedText(raw, 'title');
  if (!title.ok) return title;
  const size = readVec2(raw, 'size');
  if (!size.ok) return size;
  if (size.value.x <= 0 || size.value.y <= 0) {
    return invalid('size', '"size" must be positive in both axes.');
  }
  const spawn = readVec2(raw, 'spawn');
  if (!spawn.ok) return spawn;
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
    const tuning = readTuning(item, `locomotion[${String(index)}]`);
    if (!tuning.ok) return tuning;
    locomotion.push(tuning.value);
  }

  const pois = readPois(raw);
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
    title: title.value,
    size: size.value,
    spawn: spawn.value,
    camera: camera.value,
    ground: ground.value,
    layers: layers.value,
    locomotion,
    pois: pois.value,
    characters: characters.value,
    assets: assets.value,
    textureBudgetBytes: textureBudgetBytes.value,
    palette: palette.value,
    decodedTextureBytes,
  };

  const refusal = refuseOverBudget(level);
  return refusal ?? ok(level);
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
