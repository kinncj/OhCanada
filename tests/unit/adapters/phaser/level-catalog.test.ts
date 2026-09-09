/**
 * The catalog, and the failure path TN-LEVEL-02 is written about.
 *
 * The catalog itself is a bundler glob over `content/levels/`, so the assertion
 * that matters is that it *derives* the list rather than carrying one: a level
 * added to that directory has to appear here with no edit to any source file,
 * which is the mechanical half of "a level must be addable by JSON and assets
 * alone".
 *
 * The loader's failures get their own section because they are the difference
 * between an error card a player can act on and a black canvas. `not-found` and
 * `io` are kept apart on purpose — "Try again" is the right button for one and
 * a lie for the other.
 */

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

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


import {
  bundledLevelCatalog,
  firstLevelId,
  hasLevel,
  interpretLevelModule,
  levelIds,
  loadLevel,
} from '@adapters/phaser/level-catalog';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

const onDisk = readdirSync(`${REPO_ROOT}content/levels`)
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.slice(0, -'.json'.length))
  .sort();

describe('the catalog is derived from the directory, never listed', () => {
  it('is exactly what is on disk', () => {
    /* If this fails after a level is added, the glob has stopped matching and
       "adding a level is a JSON file" has quietly become false. */
    expect([...levelIds()]).toEqual(onDisk);
  });

  it('has at least one level, so nothing below is measuring an empty set', () => {
    expect(onDisk.length).toBeGreaterThan(0);
  });

  it('answers hasLevel for what exists and for what does not', () => {
    expect(hasLevel(onDisk[0] ?? '')).toBe(true);
    expect(hasLevel('atlantis')).toBe(false);
  });

  it('offers a first level without pretending to know about unlocking', () => {
    expect(firstLevelId()).toBe(onDisk[0]);
  });

  it('is the same list the injectable catalog reports', () => {
    expect([...bundledLevelCatalog.ids()]).toEqual([...levelIds()]);
  });
});

describe('loading a level', () => {
  it('parses every level the catalog claims to have', async () => {
    for (const id of levelIds()) {
      const result = await loadLevel(id, MODES);
      expect(result.ok, result.ok ? '' : result.error.message).toBe(true);
      if (result.ok) expect(result.value.id).toBe(id);
    }
  });

  it('fails as not-found for an id nobody authored, and names what exists', async () => {
    const result = await loadLevel('atlantis', MODES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('not-found');
      expect(result.error.code).toBe('content.level.missing');
      /* The message has to be actionable: a typo in a URL should tell you what
         the real ids are, not just that yours was wrong. */
      expect(result.error.message).toContain(onDisk[0] ?? '');
    }
  });

  it('is a Result, never a throw — a level that will not load is expected', async () => {
    await expect(loadLevel('atlantis', MODES)).resolves.toMatchObject({ ok: false });
  });
});

describe('interpreting what came back', () => {
  const document = (patch: Record<string, unknown> = {}): Record<string, unknown> => ({
    $schema: '../schemas/level.schema.json',
    id: 'testville',
    title: { en: 'Testville', fr: 'Testville' },
    size: { x: 1000, y: 1920 },
    spawn: { x: 10, y: 900 },
    camera: { followLerp: 0.2, deadZone: { x: 1, y: 1 }, offset: { x: 0, y: 0 }, zoom: 1 },
    ground: [
      { x: 0, y: 900 },
      { x: 1000, y: 900 },
    ],
    layers: [
      { key: 'band', depth: 1, scrollFactor: { x: 1, y: 1 }, offset: { x: 0, y: 0 }, repeatX: true },
    ],
    locomotion: [
      {
        mode: 'walk',
        maxSpeed: 400,
        acceleration: 2000,
        deceleration: 1500,
        turnAcceleration: 1800,
        glide: 0.1,
        maxSpeedMultiplierDownhill: 1,
        drive: 'held',
        jump: null,
        interaction: null,
        animation: { speedInput: 'speed' },
        labelKey: 'locomotion.walk.label',
      },
    ],
    pois: [],
    characters: [],
    assets: [],
    textureBudgetBytes: 1024,
    ...patch,
  });

  it('unwraps a JSON module, which is what the bundler actually returns', () => {
    const result = interpretLevelModule('testville', { default: document() }, MODES);
    expect(result.ok, result.ok ? '' : result.error.message).toBe(true);
  });

  it('accepts a bare object too, so the shape is not different under test', () => {
    expect(interpretLevelModule('testville', document(), MODES).ok).toBe(true);
  });

  it('refuses a document whose id disagrees with its file name', () => {
    const result = interpretLevelModule('testville', document({ id: 'somewhere-else' }), MODES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('content.level.idMismatch');
      expect(result.error.details?.['declared']).toBe('somewhere-else');
    }
  });

  it('passes a parse failure straight through rather than relabelling it', () => {
    const result = interpretLevelModule('testville', document({ layers: [] }), MODES);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toContain('content.level.layers');
  });
});
