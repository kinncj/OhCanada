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
  weather: 'none',
  playerCostume: 'jacket',
  /* Required by `level.schema.json` and, since ADR-0003's filter moved into the
     parser, required at run time too: the "About this place" panel is always
     reachable (docs/content-review.md §10.2), so a level with no territory block
     is a panel with nothing behind it. Verified here, so the minimal document is
     a level that draws its statement; the fixtures below spoil it on purpose. */
  territory: {
    nations: ['Testville First Nation'],
    statement: {
      en: 'Testville sits on the territory of the Testville First Nation.',
      fr: 'Testville se trouve sur le territoire de la Première Nation de Testville.',
    },
    fact: {
      factual: true,
      /* The url is the panel's source link since ADR-0051: the link points at
         the page the STATEMENT came from, not at the page its names came from. */
      source: { sourceHash: 'a'.repeat(64), url: 'https://example.invalid/testville' },
      verification: {
        status: 'verified',
        model: 'test',
        checkedAt: '2026-09-13T00:00:00Z',
        sourceHash: 'a'.repeat(64),
        evidence: 'Testville is on the territory of the Testville First Nation.',
      },
    },
    /* Who published that page. One citation, one publisher (ADR-0051): the
       `nationSource` block that used to sit here named where the NAMES came
       from, and the panel drew it as though it named where the sentence did. */
    sourcePublisher: 'The Testville Register',
  },
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
  /* Required since ADR-0042, and on the walking line: the ground is flat at 1000. */
  groundDressing: { key: 'strip', topY: 1000 },
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

describe('a level says what falls on it, and nothing is assumed', () => {
  /* Read from the schema rather than restated, so a weather added there is
     parsed here or this fails — the ADR-0023 lesson about mode names. */
  const offered = (
    JSON.parse(readFileSync(`${REPO_ROOT}content/schemas/level.schema.json`, 'utf8')) as {
      readonly properties: { readonly weather: { readonly enum: readonly string[] } };
    }
  ).properties.weather.enum;

  it('the schema offers more than one weather, so there is a decision to carry', () => {
    expect(offered).toEqual(expect.arrayContaining(['snow', 'none']));
  });

  it.each(offered)('carries "%s" through to the scene', (weather) => {
    const result = parsed({ weather });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.weather).toBe(weather);
  });

  it('refuses a document that does not say, rather than defaulting to snow or to none', () => {
    const silent = Object.fromEntries(Object.entries(minimal()).filter(([key]) => key !== 'weather'));
    expect('weather' in silent).toBe(false);
    const result = parseLevelDocument(silent, MODES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid');
      expect(result.error.code).toBe('content.level.weather');
    }
  });

  it.each([
    ['a weather the schema does not offer', 'rain'],
    ['a weather in the wrong case', 'Snow'],
    ['an empty string', ''],
    ['a null', null],
    ['a boolean', true],
  ])('refuses %s', (_label, weather) => {
    const result = parsed({ weather });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('content.level.weather');
  });

  it.each(levelFiles)('%s: declares a weather the schema offers', (file) => {
    const result = parseLevelDocument(readLevel(file), MODES);
    if (!result.ok) throw new Error(result.error.message);
    expect(offered).toContain(result.value.weather);
  });
});

describe('a level says what the player wears, and nothing is assumed', () => {
  /* Read from the schema, as the weather is, so a costume added there is parsed
     here or this fails. */
  const offered = (
    JSON.parse(readFileSync(`${REPO_ROOT}content/schemas/level.schema.json`, 'utf8')) as {
      readonly properties: { readonly playerCostume: { readonly enum: readonly string[] } };
    }
  ).properties.playerCostume.enum;

  it('the schema offers more than one costume, so there is a decision to carry', () => {
    expect(offered).toEqual(expect.arrayContaining(['parka', 'jacket']));
  });

  it.each(offered)('carries "%s" through to the scene', (playerCostume) => {
    const result = parsed({ playerCostume });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.playerCostume).toBe(playerCostume);
  });

  it('refuses a document that does not say, rather than defaulting to the parka', () => {
    const silent = Object.fromEntries(Object.entries(minimal()).filter(([key]) => key !== 'playerCostume'));
    expect('playerCostume' in silent).toBe(false);
    const result = parseLevelDocument(silent, MODES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid');
      expect(result.error.code).toBe('content.level.playerCostume');
    }
  });

  it.each([
    ["another character's costume", 'serge'],
    ['a costume in the wrong case', 'Parka'],
    ['an empty string', ''],
    ['a null', null],
    ['a number', 1],
  ])('refuses %s', (_label, playerCostume) => {
    const result = parsed({ playerCostume });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('content.level.playerCostume');
  });

  it.each(levelFiles)('%s: dresses the player in a costume the schema offers', (file) => {
    const result = parseLevelDocument(readLevel(file), MODES);
    if (!result.ok) throw new Error(result.error.message);
    expect(offered).toContain(result.value.playerCostume);
  });
});

describe('a level dresses the band below its ground, and the strip never hangs in the air (ADR-0042)', () => {
  /** Flat, then falling away to the right, as Ottawa's canal does. */
  const falling = [
    { x: 0, y: 1000 },
    { x: 2000, y: 1000 },
    { x: 2400, y: 1200 },
    { x: 4000, y: 1230 },
  ];

  it('carries the strip through to the scene', () => {
    const result = parsed({ groundDressing: { key: 'testville-ground-strip', topY: 1000 } });
    expect(result.ok, result.ok ? '' : result.error.message).toBe(true);
    if (result.ok) expect(result.value.groundDressing).toEqual({ key: 'testville-ground-strip', topY: 1000 });
  });

  it('refuses a level that does not say, because the default is the flat band', () => {
    const silent = Object.fromEntries(Object.entries(minimal()).filter(([key]) => key !== 'groundDressing'));
    expect('groundDressing' in silent).toBe(false);
    const result = parseLevelDocument(silent, MODES);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('content.level.groundDressing');
  });

  it('refuses a strip that starts above the lowest point of a ground that falls away', () => {
    const result = parsed({ ground: falling, groundDressing: { key: 'strip', topY: 1000 } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('content.level.groundDressing.topY');
      expect(result.error.message).toContain('y 1230 at x 4000');
    }
  });

  it('accepts the same strip moved down to that lowest point', () => {
    expect(parsed({ ground: falling, groundDressing: { key: 'strip', topY: 1230 } }).ok).toBe(true);
  });

  it.each([
    ['no key', { topY: 1000 }, 'content.level.groundDressing.key'],
    ['a key that is not kebab-case', { key: 'Strip_1', topY: 1000 }, 'content.level.groundDressing.key'],
    ['no topY', { key: 'strip' }, 'content.level.groundDressing.topY'],
    ['a negative topY', { key: 'strip', topY: -1 }, 'content.level.groundDressing.topY'],
    ['a topY at the bottom of the world', { key: 'strip', topY: 1920 }, 'content.level.groundDressing.topY'],
    ['a string', 'strip', 'content.level.groundDressing'],
    ['null', null, 'content.level.groundDressing'],
  ])('refuses %s', (_label, groundDressing, code) => {
    const result = parsed({ groundDressing });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(code);
  });

  it.each(levelFiles)('%s: dresses its ground band with a strip that starts at or below its lowest ground point', (file) => {
    const result = parseLevelDocument(readLevel(file), MODES);
    expect(result.ok, result.ok ? '' : result.error.message).toBe(true);
    if (!result.ok) return;
    const lowest = Math.max(...result.value.ground.map((point) => point.y));
    expect(result.value.groundDressing.topY).toBeGreaterThanOrEqual(lowest);
  });
});

describe('a ride is read strictly, because the schema cannot compare it with its level (ADR-0031)', () => {
  /* The minimal document moves by `walk`, so that is the mode a well-formed ride
     here carries. The parser does not care which mode a ride is for, only that
     the level moves by it. */
  const ride = (patch: Record<string, unknown> = {}): Record<string, unknown> => ({
    mode: 'walk',
    art: [{ key: 'car-front', side: 'front' }],
    riderAnchor: { x: 520, y: 416 },
    groundLineY: 280,
    turnsWithRider: false,
    footprint: { x: 360, width: 320 },
    ...patch,
  });

  it('reads a level with no rides as an empty list, not as undefined', () => {
    const result = parsed();
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.rides).toEqual([]);
  });

  it('keeps a ride whole, its bob and its track included', () => {
    const result = parsed({
      rides: [
        ride({
          art: [
            { key: 'car-behind', side: 'behind' },
            { key: 'car-front', side: 'front' },
          ],
          bob: { amplitudePx: 2, periodPx: 180 },
          track: { artKey: 'car-track', topY: 532 },
        }),
      ],
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.rides).toEqual([
      {
        mode: 'walk',
        art: [
          { key: 'car-behind', side: 'behind' },
          { key: 'car-front', side: 'front' },
        ],
        riderAnchor: { x: 520, y: 416 },
        groundLineY: 280,
        turnsWithRider: false,
        footprint: { x: 360, width: 320 },
        bob: { amplitudePx: 2, periodPx: 180 },
        track: { artKey: 'car-track', topY: 532 },
      },
    ]);
  });

  it('omits bob and track when the level does not declare them', () => {
    const result = parsed({ rides: [ride()] });
    if (!result.ok) throw new Error(result.error.message);
    const [only] = result.value.rides;
    expect('bob' in (only ?? {})).toBe(false);
    expect('track' in (only ?? {})).toBe(false);
  });

  /* ADR-0043: a ride with a front backs up, held and capped at its own number. */
  it('reads a backing speed on a ride that does not turn, and omits one never declared', () => {
    const declared = parsed({ rides: [ride({ backingMaxSpeed: 240 })] });
    if (!declared.ok) throw new Error(declared.error.message);
    expect(declared.value.rides[0]?.backingMaxSpeed).toBe(240);

    const absent = parsed({ rides: [ride()] });
    if (!absent.ok) throw new Error(absent.error.message);
    expect('backingMaxSpeed' in (absent.value.rides[0] ?? {})).toBe(false);
  });

  it('refuses a backing speed on a ride that turns, or one that is not a positive number', () => {
    for (const patch of [
      { turnsWithRider: true, backingMaxSpeed: 240 },
      { backingMaxSpeed: 0 },
      { backingMaxSpeed: -40 },
      { backingMaxSpeed: '240' },
    ]) {
      expect(parsed({ rides: [ride(patch)] }).ok, JSON.stringify(patch)).toBe(false);
    }
  });

  /* ADR-0035: a layer may declare frames, advanced by distance. */
  const cycle = (patch: Record<string, unknown> = {}): Record<string, unknown> => ({
    rest: 'horse-stand',
    frames: ['horse-walk-1', 'horse-walk-2', 'horse-walk-3', 'horse-walk-4'],
    framePx: 60,
    ...patch,
  });
  const cycled = (patch: Record<string, unknown> = {}): Record<string, unknown> =>
    ride({ art: [{ key: 'horse-walk-1', side: 'behind', cycle: cycle(patch) }] });

  it('keeps a layer`s cycle whole', () => {
    const result = parsed({ rides: [cycled()] });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.rides[0]?.art).toEqual([
      {
        key: 'horse-walk-1',
        side: 'behind',
        cycle: {
          rest: 'horse-stand',
          frames: ['horse-walk-1', 'horse-walk-2', 'horse-walk-3', 'horse-walk-4'],
          framePx: 60,
        },
      },
    ]);
  });

  it('omits the cycle from a layer that does not declare one', () => {
    const result = parsed({ rides: [ride()] });
    if (!result.ok) throw new Error(result.error.message);
    const [layer] = result.value.rides[0]?.art ?? [];
    expect('cycle' in (layer ?? {})).toBe(false);
  });

  it.each([
    ['a cycle that is not an object', { rides: [ride({ art: [{ key: 'horse-walk-1', side: 'behind', cycle: [] }] })] }],
    ['a cycle of one frame, which is a still', { rides: [cycled({ frames: ['horse-walk-1'] })] }],
    ['a cycle with no frames', { rides: [cycled({ frames: undefined })] }],
    ['a frame that is not a texture key', { rides: [cycled({ frames: ['horse-walk-1', 'Horse Walk 2'] })] }],
    ['a cycle with no rest frame', { rides: [cycled({ rest: undefined })] }],
    ['a cycle that travels no distance per frame', { rides: [cycled({ framePx: 0 })] }],
    ['a cycle with no distance per frame', { rides: [cycled({ framePx: undefined })] }],
  ])('rejects %s', (_label, patch) => {
    const result = parsed(patch as Record<string, unknown>);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid');
  });

  it.each([
    ['rides that are not a list', { rides: { mode: 'walk' } }],
    ['a ride for a mode the level never moves by', { rides: [ride({ mode: 'skate' })] }],
    ['two rides for one mode', { rides: [ride(), ride()] }],
    ['a ride with no art', { rides: [ride({ art: [] })] }],
    ['a layer on a side that is neither behind nor front', { rides: [ride({ art: [{ key: 'car-front', side: 'above' }] })] }],
    [
      'two layers on one side',
      { rides: [ride({ art: [{ key: 'a', side: 'front' }, { key: 'b', side: 'front' }] })] },
    ],
    ['a layer key that is not a texture key', { rides: [ride({ art: [{ key: 'Car Front', side: 'front' }] })] }],
    ['an anchor measured outside the art', { rides: [ride({ riderAnchor: { x: -1, y: 10 } })] }],
    ['a ground row above the art', { rides: [ride({ groundLineY: -1 })] }],
    ['a ride that does not say whether it turns', { rides: [ride({ turnsWithRider: undefined })] }],
    /* ADR-0037: the stop keeps a character clear of this span, so a ride that
       does not say where it is gives the stop nothing to keep clear of. */
    ['a ride with no footprint', { rides: [ride({ footprint: undefined })] }],
    ['a footprint with no width', { rides: [ride({ footprint: { x: 360, width: 0 } })] }],
    ['a footprint measured outside the art', { rides: [ride({ footprint: { x: -1, width: 40 } })] }],
    ['a bob with no period', { rides: [ride({ bob: { amplitudePx: 2, periodPx: 0 } })] }],
    ['a track with no top row', { rides: [ride({ track: { artKey: 'car-track' } })] }],
  ])('rejects %s', (_label, patch) => {
    const result = parsed(patch as Record<string, unknown>);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid');
  });
});

/**
 * ADR-0051: a statement cites one source, names only what that source names, and
 * the panel cites *that* source.
 *
 * Three of the four cases below are about a state that had no spelling before:
 * a statement that names nobody. The guide this game teaches names no people for
 * most of the places these levels are set in, so "names nobody" stopped being an
 * authoring failure and became a finding about a document — and a finding has to
 * be told apart from an omission, which is what `nationsAbsentBecause` is for.
 */
describe('a territory statement names only what its source names (ADR-0051)', () => {
  const territory = (patch: Record<string, unknown> = {}): Record<string, unknown> => ({
    ...(minimal()['territory'] as Record<string, unknown>),
    ...patch,
  });

  const withTerritory = (patch: Record<string, unknown> = {}): ReturnType<typeof parsed> =>
    parsed({ territory: territory(patch) });

  it('draws the statement, its names, and the publisher of the page it came from', () => {
    /* The link's text is `sourcePublisher` and its target is the citation's own
       url. Before this ADR both came from `nationSource` — where the NAMES came
       from — so on seven of the ten shipped levels the panel attributed the
       sentence to a page it was never quoted from, and on five of those to a
       body that never published it. */
    const result = withTerritory();
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.about).toMatchObject({
      kind: 'statement',
      nations: ['Testville First Nation'],
      publisher: 'The Testville Register',
      sourceUrl: 'https://example.invalid/testville',
    });
  });

  it('names nobody where the cited source names nobody, and still cites the source', () => {
    const result = withTerritory({ nations: [], nationsAbsentBecause: 'source-names-none' });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.about.kind).toBe('statement');
    if (result.value.about.kind !== 'statement') return;

    expect(result.value.about.nations).toEqual([]);
    /* The sentence and its citation still draw. An empty list is a finding about
       a source, not a reason to withhold a claim a verifier granted — and the
       panel draws no heading over an empty list already
       (tests/unit/ui/about-this-place.test.ts). */
    expect(result.value.about.statement.en.length).toBeGreaterThan(0);
    expect(result.value.about.publisher).toBe('The Testville Register');
    expect(result.value.about.sourceUrl).toBe('https://example.invalid/testville');
  });

  it('refuses a statement that declares itself no claim at all', () => {
    /* `adjudicateClaim` treats a `factual: false` block as drawable, correctly,
       because a greeting needs no verifier. Spent on a territorial statement
       that exemption would put an unsourced, unchecked sentence about whose land
       this is in front of a player with every gate green. */
    const result = withTerritory({ fact: { factual: false, source: null, verification: null } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('factual');
  });

  it('refuses a statement whose citation has no page for the panel to link', () => {
    const base = minimal()['territory'] as Record<string, unknown>;
    const fact = { ...(base['fact'] as Record<string, unknown>) };
    fact['source'] = { sourceHash: 'a'.repeat(64) };
    const result = withTerritory({ fact });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('source.url');
  });

  it.each([
    ['an empty list with no reason recorded', { nations: [] }],
    ['a reason recorded beside names', { nationsAbsentBecause: 'source-names-none' }],
    [
      'a reason this build does not know',
      { nations: [], nationsAbsentBecause: 'nobody-went-looking' },
    ],
    ['a name that is not a name', { nations: [42] }],
    ['no publisher for the page it cites', { sourcePublisher: undefined }],
    ['a publisher that is only spaces', { sourcePublisher: '   ' }],
  ])('refuses %s', (_label, patch) => {
    const result = withTerritory(patch as Record<string, unknown>);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid');
  });
});
