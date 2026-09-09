/**
 * The runtime reading of a level document, and the refusal that comes before any
 * asset is fetched.
 *
 * Two audiences, and both are needed. The fixture suite drives the parser
 * against records that are deliberately wrong, which is the only way to know it
 * *rejects* anything; the corpus suite parses every level actually authored
 * under `content/levels/`, which is the only way to know the parser and the
 * schema still agree. A corpus-only suite over one file proves the parser can
 * read that file; a fixture-only suite proves nothing about what ships.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  MAX_DECODED_TEXTURE_BYTES,
  parseLevelDocument,
  refuseOverBudget,
  type SceneLevel,
} from '@adapters/phaser/level-document';
import { DEFAULT_PALETTE } from '@adapters/phaser/boot-config';

import gameConfigJson from '@content/game.config.json';
/**
 * The locomotion vocabulary, from the config the game actually reads.
 *
 * Not a literal: `level-document.ts` held one, and Québec City declaring
 * `toboggan` passed `make validate-content` and then failed at load. A test
 * restating the list would let that come back one copy at a time (ADR-0023).
 */
const MODES: readonly string[] = (
  gameConfigJson as { locomotionModes: readonly string[] }
).locomotionModes;


const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const LEVELS_DIR = `${REPO_ROOT}content/levels`;

const levelFiles = readdirSync(LEVELS_DIR)
  .filter((name) => name.endsWith('.json'))
  .sort();

const readLevel = (file: string): unknown =>
  JSON.parse(readFileSync(`${LEVELS_DIR}/${file}`, 'utf8'));

/** The smallest document that parses. Every negative fixture is this, spoiled. */
const minimal = (): Record<string, unknown> => ({
  $schema: '../schemas/level.schema.json',
  id: 'testville',
  subject: 'government',
  order: 1,
  title: { en: 'Testville', fr: 'Testville' },
  size: { x: 4000, y: 1920 },
  spawn: { x: 100, y: 1000 },
  camera: {
    followLerp: 0.2,
    deadZone: { x: 40, y: 80 },
    offset: { x: 100, y: -200 },
    zoom: 1,
  },
  ground: [
    { x: 0, y: 1000 },
    { x: 4000, y: 1000 },
  ],
  layers: [
    {
      key: 'band',
      depth: 1,
      scrollFactor: { x: 0.5, y: 0.2 },
      offset: { x: 0, y: 800 },
      repeatX: true,
    },
  ],
  locomotion: [
    {
      mode: 'walk',
      maxSpeed: 400,
      acceleration: 2000,
      deceleration: 1500,
      turnAcceleration: 1800,
      glide: 0.1,
      maxSpeedMultiplierDownhill: 1.1,
      drive: 'held',
      jump: null,
      interaction: null,
      animation: { speedInput: 'speed' },
      labelKey: 'locomotion.walk.label',
    },
  ],
  quests: [],
  pois: [],
  characters: [],
  assets: [],
  textureBudgetBytes: 1024,
});

const parsed = (patch: Record<string, unknown> = {}): ReturnType<typeof parseLevelDocument> =>
  parseLevelDocument({ ...minimal(), ...patch }, MODES);

describe('every authored level parses', () => {
  it('there is at least one, so this suite is not measuring an empty directory', () => {
    expect(levelFiles.length).toBeGreaterThan(0);
  });

  it.each(levelFiles)('%s', (file) => {
    const result = parseLevelDocument(readLevel(file), MODES);
    expect(result.ok, result.ok ? '' : result.error.message).toBe(true);
  });

  it.each(levelFiles)('%s: the file name is the id', (file) => {
    const result = parseLevelDocument(readLevel(file), MODES);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.id).toBe(file.slice(0, -'.json'.length));
  });

  it.each(levelFiles)('%s: the manifest fits the declared texture budget', (file) => {
    const result = parseLevelDocument(readLevel(file), MODES);
    if (!result.ok) throw new Error(result.error.message);
    expect(refuseOverBudget(result.value)).toBeNull();
    expect(result.value.textureBudgetBytes).toBeLessThanOrEqual(MAX_DECODED_TEXTURE_BYTES);
  });

  it.each(levelFiles)('%s: the ground polyline fits inside the declared size', (file) => {
    const result = parseLevelDocument(readLevel(file), MODES);
    if (!result.ok) throw new Error(result.error.message);
    for (const point of result.value.ground) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(result.value.size.x);
      expect(point.y).toBeLessThanOrEqual(result.value.size.y);
    }
  });

  it.each(levelFiles)('%s: the spawn is inside the level', (file) => {
    const result = parseLevelDocument(readLevel(file), MODES);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.spawn.x).toBeGreaterThanOrEqual(0);
    expect(result.value.spawn.x).toBeLessThanOrEqual(result.value.size.x);
  });
});

describe('the parser refuses what the schema would reject', () => {
  it('accepts the minimal document', () => {
    expect(parsed().ok).toBe(true);
  });

  it.each([
    ['not an object', 'nonsense'],
    ['a null', null],
    ['an array', []],
  ])('rejects %s', (_label, value) => {
    expect(parseLevelDocument(value, MODES).ok).toBe(false);
  });

  it.each([
    ['an id that is not kebab-case', { id: 'Ottawa Canal' }],
    ['a title missing French', { title: { en: 'Only English' } }],
    ['a size with no area', { size: { x: 0, y: 1920 } }],
    ['a camera with no follow', { camera: { deadZone: { x: 1, y: 1 }, offset: { x: 0, y: 0 }, zoom: 1 } }],
    ['a zoom of zero', { camera: { ...minimal()['camera'] as object, zoom: 0 } }],
    ['a one-point ground polyline', { ground: [{ x: 0, y: 100 }] }],
    ['no parallax layers', { layers: [] }],
    ['a layer with no repeat declared', { layers: [{ key: 'band', depth: 1, scrollFactor: { x: 1, y: 1 }, offset: { x: 0, y: 0 } }] }],
    ['no locomotion at all', { locomotion: [] }],
    ['a texture budget over the 64 MB ceiling', { textureBudgetBytes: MAX_DECODED_TEXTURE_BYTES + 1 }],
  ])('rejects %s', (_label, patch) => {
    const result = parsed(patch as Record<string, unknown>);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid');
  });

  it('rejects a ground polyline that is not ordered left to right', () => {
    const result = parsed({
      ground: [
        { x: 0, y: 100 },
        { x: 400, y: 100 },
        { x: 200, y: 140 },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('left to right');
  });

  it('rejects a POI whose blurb never says whether it claims a fact', () => {
    const result = parsed({
      pois: [
        {
          id: 'somewhere',
          name: { en: 'Somewhere', fr: 'Quelque part' },
          blurb: { en: 'A thing.', fr: 'Une chose.' },
          position: { x: 100, y: 1000 },
          artKey: 'somewhere',
          radiusPx: 200,
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('ADR-0003');
  });

  it.each([
    ['a mode outside the schema enum', { mode: 'hovercraft' }],
    ['a drive that is neither held nor auto', { drive: 'sometimes' }],
    ['a glide above 1', { glide: 1.4 }],
    ['a downhill multiplier below 1', { maxSpeedMultiplierDownhill: 0.5 }],
    ['a label that is inline text rather than a key', { labelKey: '' }],
    ['an animation binding with no speed input', { animation: {} }],
    ['a jump that is neither an object nor null', { jump: 'yes' }],
    ['an interaction with no reach', { interaction: { requiresStop: false, whileMoving: true, approachSpeed: 0 } }],
  ])('rejects a locomotion tuning with %s', (_label, patch) => {
    const base = (minimal()['locomotion'] as Record<string, unknown>[])[0] ?? {};
    expect(parsed({ locomotion: [{ ...base, ...(patch as object) }] }).ok).toBe(false);
  });

  it('does NOT check the acceleration band — that gate has one owner', () => {
    /* `deceleration < turnAcceleration < acceleration` is a coherence rule over
       authored content and belongs to
       tests/unit/contracts/locomotion-tuning-is-coherent.test.ts. Checking it
       here as well would give one defect two owners and would let a level ship
       that CI never saw. */
    const base = (minimal()['locomotion'] as Record<string, unknown>[])[0] ?? {};
    const incoherent = { ...base, deceleration: 5000, turnAcceleration: 10, acceleration: 20 };
    expect(parsed({ locomotion: [incoherent] }).ok).toBe(true);
  });
});

describe('the palette is merged, not replaced', () => {
  it('falls back to the renderer default when a level declares no theme', () => {
    const result = parsed();
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.palette).toEqual(DEFAULT_PALETTE);
  });

  it('lets a level override one colour without restating the block', () => {
    const result = parsed({ theme: { sky: '#123456' } });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.palette.sky).toBe('#123456');
    expect(result.value.palette.ground).toBe(DEFAULT_PALETTE.ground);
  });

  it('rejects a colour that is not #rrggbb rather than drawing undefined', () => {
    expect(parsed({ theme: { sky: 'skyblue' } }).ok).toBe(false);
  });
});

describe('a level too heavy for the texture budget is refused, not crashed into', () => {
  const heavy = (declared: number, decoded: number): Record<string, unknown> => ({
    textureBudgetBytes: declared,
    assets: [
      { key: 'atlas', kind: 'atlas', url: 'assets/atlas.webp', bytes: 1000, decodedBytes: decoded },
    ],
  });

  it('fails at parse time, before anything could be fetched', () => {
    const result = parsed(heavy(1024, 2048));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('content.level.textureBudget');
  });

  it('accepts a manifest that fits', () => {
    const result = parsed(heavy(4096, 2048));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.decodedTextureBytes).toBe(2048);
  });

  it('refuses a manifest over the engine ceiling even if the level declared more', () => {
    /* The level file cannot declare more than 64 MB — the schema caps it — so
       this is the runtime half of the same rule, reachable only by handing
       `refuseOverBudget` a level the parser did not build. It exists because the
       loader re-runs the check against a manifest that may have grown. */
    const level = {
      id: 'testville',
      textureBudgetBytes: MAX_DECODED_TEXTURE_BYTES * 4,
      decodedTextureBytes: MAX_DECODED_TEXTURE_BYTES + 1,
    } as unknown as SceneLevel;
    const refusal = refuseOverBudget(level);
    expect(refusal).not.toBeNull();
    expect(refusal?.ok).toBe(false);
    if (refusal !== null && !refusal.ok) {
      expect(refusal.error.code).toBe('content.level.textureCeiling');
    }
  });
});

describe('the parse carries through what the scene must not silently drop', () => {
  it('keeps a POI fact block whole, because ADR-0003 governs it', () => {
    const document = parseLevelDocument(readLevel(levelFiles[0] ?? ''), MODES);
    if (!document.ok) throw new Error(document.error.message);
    for (const poi of document.value.pois) {
      expect(typeof poi.fact.factual).toBe('boolean');
      if (poi.fact.factual) {
        expect(poi.fact.source, `${poi.id} claims a fact with no source`).not.toBeNull();
        expect(poi.fact.verification, `${poi.id} claims a fact with no verification`).not.toBeNull();
      }
    }
  });

  it('keeps the asset manifest, so the loader has something to preload', () => {
    const result = parsed({
      assets: [{ key: 'atlas', kind: 'atlas', url: 'assets/a.webp', bytes: 10, decodedBytes: 20 }],
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.assets).toHaveLength(1);
    expect(result.value.assets[0]?.kind).toBe('atlas');
  });

  it('rejects an asset of a kind the schema does not declare', () => {
    expect(
      parsed({ assets: [{ key: 'x', kind: 'shader', url: 'a', bytes: 0, decodedBytes: 0 }] }).ok,
    ).toBe(false);
  });

  it('keeps an optional questId when a level places one, and omits it otherwise', () => {
    const withQuest = parsed({
      characters: [
        { characterId: 'officer', position: { x: 1, y: 2 }, facing: 'left', questId: 'greet' },
      ],
    });
    if (!withQuest.ok) throw new Error(withQuest.error.message);
    expect(withQuest.value.characters[0]?.questId).toBe('greet');

    const without = parsed({
      characters: [{ characterId: 'officer', position: { x: 1, y: 2 }, facing: 'left' }],
    });
    if (!without.ok) throw new Error(without.error.message);
    expect('questId' in (without.value.characters[0] ?? {})).toBe(false);
  });

  it('rejects a character facing anywhere but left or right', () => {
    expect(
      parsed({ characters: [{ characterId: 'officer', position: { x: 1, y: 2 }, facing: 'up' }] }).ok,
    ).toBe(false);
  });
});
