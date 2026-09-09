import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import gameConfigDocument from '@content/game.config.json';
/* Relative, not aliased: there is no `@bootstrap` alias and adding one means
   editing three configs that have to agree (tsconfig, vite, vitest). */
import { readGameRules } from '../../../app/bootstrap/game-rules';
import { isPlayable, journeyEntries, JOURNEY_LENGTH } from '../../../app/bootstrap/journey';
import type { Journey, UnlockRules } from '@domain/entities/level';
import type { LevelId } from '@domain/ids';

/**
 * The ten rows the map draws, and the one question this file exists to answer:
 * does the shipped `content/game.config.json` plus the shipped
 * `content/levels/` actually produce a level a player can open?
 *
 * It did not, once. `unlockRules` carried `initialLevels: []` and `order: []`
 * while `content/levels/ottawa.json` existed, so `unlockedLevelIds` returned
 * nothing, **every level was locked including the only one that was built**, and
 * the map would have been a wall (`OQ-MAP-1`). The last describe block below is
 * that failure written as a test against the real files, so a config edit that
 * closes the door again fails here rather than on somebody's phone.
 *
 * It then failed a second way, which is why the rows are numbered from
 * `journey` and no longer from `unlockRules.order`: the two lists were one, the
 * one list began at a level nobody had built, and the walk that stops at the
 * first unopenable level stopped at index 0. Nothing here caught it, because
 * every assertion below was about *the map*, and the map was fine — the
 * *chain* was dead. `tests/unit/contracts/unlock-chain-is-reachable.test.ts` is
 * the assertion that was missing.
 */

const id = (value: string): LevelId => value as unknown as LevelId;

const rules = (patch: Partial<UnlockRules> = {}): UnlockRules => ({
  initialLevels: [id('ottawa')],
  order: [id('halifax'), id('quebec-city'), id('ottawa')],
  stampsToUnlockNext: 1,
  ...patch,
});

/** The map's places. A separate list from the chain above, on purpose. */
const journey = (): Journey => [id('halifax'), id('quebec-city'), id('ottawa')];

const LEVELS_DIR = fileURLToPath(new URL('../../../content/levels', import.meta.url));

/** The level ids on disk — the same answer `hasLevel` derives from its glob. */
const onDisk = readdirSync(LEVELS_DIR)
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.slice(0, -'.json'.length))
  .sort();

describe('the ten entries', () => {
  it('is ten rows even when the config names fewer places', () => {
    const entries = journeyEntries({ rules: rules(), journey: journey(), stamped: [], isBuilt: () => false });

    expect(entries).toHaveLength(JOURNEY_LENGTH);
    expect(entries.map((entry) => entry.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('leaves a place the config has not named without an id, and never a placeholder', () => {
    const entries = journeyEntries({ rules: rules(), journey: journey(), stamped: [], isBuilt: () => true });

    /* `TN-LEVELS` declines to fix ids for the blocked levels, and `TN-MAP-04`
       forbids "TBD" standing in for one. A row with no id is a numbered card. */
    expect(entries[9]).toEqual({ number: 10, built: false, unlocked: false, stamped: false });
  });

  it('draws a place whose id is not fixed as a numbered card with no id', () => {
    /* `null` is a decision, not a gap: `TN-LEVELS` leaves levels 2 and 10
       unnamed while `docs/content-review.md` §1 blocks them, and the slot keeps
       its position so Québec City is still number 3. */
    const withBlank: Journey = [id('halifax'), null, id('quebec-city'), id('ottawa')];
    const entries = journeyEntries({
      rules: rules(),
      journey: withBlank,
      stamped: [],
      isBuilt: () => true,
    });

    expect(entries[1]).toEqual({ number: 2, built: false, unlocked: false, stamped: false });
    expect(entries[2]).toMatchObject({ number: 3, id: 'quebec-city' });
    expect(entries[3]).toMatchObject({ number: 4, id: 'ottawa' });
  });

  it('never truncates a config that names more than ten', () => {
    const long: Journey = Array.from({ length: 12 }, (_unused, index) =>
      id(`level-${String(index)}`),
    );
    expect(
      journeyEntries({ rules: rules(), journey: long, stamped: [], isBuilt: () => false }),
    ).toHaveLength(12);
  });

  it('answers built from the catalogue and unlocked from the domain, separately', () => {
    const entries = journeyEntries({
      rules: rules(),
      journey: journey(),
      stamped: [],
      isBuilt: (candidate) => candidate === 'quebec-city' || candidate === 'ottawa',
    });

    expect(entries[0]).toMatchObject({ id: 'halifax', built: false, unlocked: false });
    expect(entries[1]).toMatchObject({ id: 'quebec-city', built: true, unlocked: false });
    expect(entries[2]).toMatchObject({ id: 'ottawa', built: true, unlocked: true });
  });

  it('marks the stamps that are in the passport', () => {
    const entries = journeyEntries({
      rules: rules(),
      journey: journey(),
      stamped: [id('ottawa')],
      isBuilt: () => true,
    });

    expect(entries[2]?.stamped).toBe(true);
    expect(entries[0]?.stamped).toBe(false);
  });

  it('opens the next place once a stamp has been earned', () => {
    const chain = rules({
      initialLevels: [id('halifax')],
      order: [id('halifax'), id('quebec-city'), id('ottawa')],
    });
    const entries = journeyEntries({
      rules: chain,
      journey: journey(),
      stamped: [id('halifax')],
      isBuilt: () => true,
    });

    expect(entries[1]).toMatchObject({ id: 'quebec-city', unlocked: true });
    expect(entries[2]).toMatchObject({ id: 'ottawa', unlocked: false });
  });
});

describe('what the composition root is allowed to open', () => {
  const entries = journeyEntries({
    rules: rules(),
    journey: journey(),
    stamped: [],
    isBuilt: (candidate) => candidate !== 'halifax',
  });

  it('opens a level that is built and unlocked', () => {
    expect(isPlayable(entries, id('ottawa'))).toBe(true);
  });

  it('refuses one that is built and not yet earned', () => {
    expect(isPlayable(entries, id('quebec-city'))).toBe(false);
  });

  it('refuses one nobody has built, whatever the unlock rules say', () => {
    const generous = journeyEntries({
      rules: rules({ initialLevels: [id('halifax'), id('ottawa')] }),
      journey: journey(),
      stamped: [],
      isBuilt: (candidate) => candidate !== 'halifax',
    });
    expect(generous[0]).toMatchObject({ unlocked: true, built: false });
    expect(isPlayable(generous, id('halifax'))).toBe(false);
  });

  it('refuses a level the map has no row for at all', () => {
    expect(isPlayable(entries, id('atlantis'))).toBe(false);
  });
});

describe('the shipped config opens a door (OQ-MAP-1)', () => {
  const parsed = readGameRules(gameConfigDocument);

  it('is readable at all', () => {
    expect(parsed.ok, parsed.ok ? '' : parsed.error.message).toBe(true);
  });

  it('leaves at least one level both built and unlocked, or nobody can play', () => {
    if (!parsed.ok) throw new Error('the config did not parse');
    const entries = journeyEntries({
      rules: parsed.value.unlockRules,
      journey: parsed.value.journey,
      stamped: [],
      isBuilt: (candidate) => onDisk.includes(`${candidate}`),
    });

    const open = entries.filter((entry) => entry.built && entry.unlocked);
    expect(
      open.map((entry) => entry.id),
      'every level in the shipped config is locked or unbuilt, so a cold load has ' +
        'a map with nothing on it that can be pressed — the wall OQ-MAP-1 describes',
    ).not.toEqual([]);
  });

  it('shows every level document this build carries somewhere on the map', () => {
    if (!parsed.ok) throw new Error('the config did not parse');
    const entries = journeyEntries({
      rules: parsed.value.unlockRules,
      journey: parsed.value.journey,
      stamped: [],
      isBuilt: (candidate) => onDisk.includes(`${candidate}`),
    });

    /*
     * A level document that no map row names is a level nothing can reach: the
     * catalogue would load it from a `?level=` link and the map would never
     * offer it. `content/levels/` is the source of truth for what exists and
     * `journey` is the source of truth for the places, so the second has to
     * contain the first.
     */
    const named = new Set(entries.map((entry) => `${entry.id ?? ''}`));
    const unreachable = onDisk.filter((level) => !named.has(level));
    expect(
      unreachable,
      `these level documents exist and no map row names them: ${unreachable.join(', ')}. ` +
        'Add the id to `journey` in content/game.config.json, at its map position.',
    ).toEqual([]);
  });
});
