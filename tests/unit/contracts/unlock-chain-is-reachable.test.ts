/**
 * The shipped chain, walked the way a player walks it.
 *
 * ## The defect this file is the absence of
 *
 * `content/game.config.json` shipped with `unlockRules.order` beginning
 * `[halifax, mikmaki, quebec-city, ottawa, …]` — the map's east-to-west
 * numbering — and `initialLevels: ["ottawa"]`, because Halifax is not built.
 * `unlockedLevelIds` stops at the first level it cannot open, so it stopped at
 * `halifax`, at index 0, on every call. **No stamp could ever unlock anything.**
 * Ottawa was playable only because `initialLevels` named it directly, and Québec
 * City — a finished level document with art — was reachable by no sequence of
 * play at all.
 *
 * Every test in the suite passed. `tests/unit/bootstrap/journey.test.ts`
 * asserted the map had a level that was built and unlocked, and it did: Ottawa,
 * from `initialLevels`. Nothing asserted that the *chain* went anywhere, so
 * nothing noticed that it went nowhere.
 *
 * ## What is asserted here, and against what
 *
 * The **shipped** config, not a fixture. A fixture would have been green
 * throughout the defect. Three properties, each of which the dead chain broke or
 * would have broken:
 *
 *  1. every level `order` names can be opened by some sequence of play;
 *  2. every level document in `content/levels/` is reached by that sequence,
 *     starting from `initialLevels` — the walk is done here, stamp by stamp,
 *     through the real `unlockedLevelIds`, rather than by trusting a helper;
 *  3. the two lists agree about which places exist, and a built level's own
 *     `order` field is its position on the map.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import gameConfigDocument from '@content/game.config.json';
/* Relative, not aliased: there is no `@bootstrap` alias and adding one means
   editing three configs that have to agree (tsconfig, vite, vitest). */
import { readGameRules } from '../../../app/bootstrap/game-rules';
import {
  journeyLevelIds,
  unlockedLevelIds,
  unmappedLevelIds,
  unreachableLevelIds,
  type Journey,
  type UnlockRules,
} from '@domain/entities/level';
import type { LevelId } from '@domain/ids';
import { text, type CopyKey, type UiLocale } from '@ui/copy';

const LEVELS_DIR = fileURLToPath(new URL('../../../content/levels', import.meta.url));

/** The level documents this build carries — the catalogue's answer, from disk. */
const built = readdirSync(LEVELS_DIR)
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.slice(0, -'.json'.length))
  .sort();

const parsed = readGameRules(gameConfigDocument);
if (!parsed.ok) throw new Error(`content/game.config.json did not parse: ${parsed.error.message}`);

const rules: UnlockRules = parsed.value.unlockRules;
const journey: Journey = parsed.value.journey;

/**
 * Every level a player can reach, and the order they reach them in.
 *
 * Deliberately *not* `unreachableLevelIds`: that function assumes what it wants
 * to prove — that stamping everything is the furthest anyone can get. This is
 * the player's own loop. Open what is open, stamp all of it, ask again, stop
 * when a round opens nothing new. Whatever this reaches is what a real passport
 * can reach, and it goes through the same `unlockedLevelIds` the game calls.
 */
const walk = (): readonly LevelId[] => {
  const stamped: LevelId[] = [];
  let reached = new Set<LevelId>(unlockedLevelIds(rules, stamped));

  for (;;) {
    stamped.push(...reached);
    const next = new Set<LevelId>(unlockedLevelIds(rules, stamped));
    if (next.size === reached.size) return [...next];
    reached = next;
  }
};

describe('the shipped chain goes somewhere', () => {
  it('opens at least one level before a single stamp is earned', () => {
    /* Where the walk starts. A chain whose first step needs a stamp is a chain
       that never takes a step, whatever else is true of it. */
    expect(unlockedLevelIds(rules, []).length).toBeGreaterThan(0);
  });

  it('begins at a level that is already open, or no stamp ever unlocks anything', () => {
    const first = rules.order[0];
    expect(first, 'unlockRules.order is empty, so no level unlocks another').toBeDefined();
    expect(
      rules.initialLevels,
      `unlockRules.order begins at "${String(first)}", which initialLevels does not open. ` +
        'The walk in unlockedLevelIds stops at the first level it cannot open, so it stops ' +
        'at index 0 and the whole chain is dead. This is exactly the shipped defect.',
    ).toContain(first);
  });

  it('names no level that no sequence of play can open', () => {
    const dead = unreachableLevelIds(rules);
    expect(
      dead,
      `unlockRules.order names levels nothing can open: ${dead.join(', ')}. ` +
        'The chain dies at the first of them.',
    ).toEqual([]);
  });
});

describe('every built level is on the path from the first one', () => {
  const reached = new Set(walk().map((id) => `${id}`));

  it.each(built)('a player who keeps earning stamps reaches %s', (level) => {
    expect(
      reached.has(level),
      `content/levels/${level}.json exists and no amount of play opens it. ` +
        'Add it to unlockRules.order, after a level that is already reachable.',
    ).toBe(true);
  });

  it('reaches them by playing, not by being handed them at boot', () => {
    /* Ottawa is open from the first frame because `initialLevels` says so. If
       every built level were in `initialLevels`, the assertions above would pass
       over a chain that still unlocked nothing — which is how the defect hid. */
    const earned = built.filter((level) => !unlockedLevelIds(rules, []).includes(level as LevelId));
    expect(
      earned,
      'no level in this build is opened by earning a stamp; every one of them is ' +
        'in initialLevels, so the unlock chain is untested by playing it',
    ).not.toEqual([]);
  });
});

describe('the map and the chain agree about which places exist', () => {
  it('gives every level the rules can open a place on the map', () => {
    const homeless = unmappedLevelIds(rules, journey);
    expect(
      homeless,
      `unlockRules can open these levels and journey has no place for them: ${homeless.join(', ')}`,
    ).toEqual([]);
  });

  it('has ten places, because the game has ten levels', () => {
    expect(journey).toHaveLength(10);
  });

  it('names each place once', () => {
    const named = journeyLevelIds(journey).map((id) => `${id}`);
    expect(named).toEqual([...new Set(named)]);
  });

  it('numbers a built level where its own document says it is', () => {
    /*
     * `content/schemas/level.schema.json` calls `order` "position in the world
     * map, 1-10. Unlocking is game.config's job, not this file's" — so the
     * level document and `journey` are two statements of one number, and this
     * is where they are made to agree.
     */
    for (const level of built) {
      const document = JSON.parse(
        readFileSync(`${LEVELS_DIR}/${level}.json`, 'utf8'),
      ) as { readonly order: number };
      expect(journey[document.order - 1], `content/levels/${level}.json says it is number ` +
        `${String(document.order)} on the map`).toBe(level);
    }
  });
});

describe('every place the map names has a name to draw', () => {
  /*
   * The second defect in the same file, and the cheapest to ship unnoticed:
   * `journey` held `mikmaki`, `alberta`, `rockies` and `the-north` while
   * `app/ui/copy.ts` keys those places `level.2.*`, `alberta-foothills`,
   * `vancouver` and `level.10.*`. Four cards drew a number, a state word and no
   * name at all — and no test failed, because a card with no name is a valid
   * card (levels 2 and 10 are supposed to be nameless).
   *
   * The rule that tells the two apart: a slot with **an id** must have a place
   * name in both languages, and a slot with **no id** is a decision
   * (`docs/content-review.md` §1) that keeps its subject line.
   */
  const rowFor = (handle: string, part: 'title' | 'subtitle', locale: UiLocale): string | undefined =>
    text(locale, `level.${handle}.${part}` as CopyKey) as string | undefined;

  it.each(journeyLevelIds(journey).map((id) => `${id}`))(
    '%s has a place name and a subject line, in English and in French',
    (place) => {
      for (const locale of ['en', 'fr'] as const) {
        expect(
          rowFor(place, 'title', locale),
          `app/ui/copy.ts has no level.${place}.title in ${locale}, so map card ` +
            `${String(journeyLevelIds(journey).indexOf(place as LevelId) + 1)} draws no name. ` +
            'Either the id in content/game.config.json disagrees with the id TN-LEVELS ' +
            'fixed, or the copy row was never written.',
        ).toBeDefined();
        expect(rowFor(place, 'subtitle', locale)).toBeDefined();
      }
    },
  );

  it('keeps a subject line for a place whose id is not fixed', () => {
    /* A nameless card is not an empty card. `TN-MAP-04` forbids a placeholder
       for the name; the subject line is keyed on the map number and stays. */
    journey.forEach((slot, index) => {
      if (slot !== null) return;
      const number = String(index + 1);
      expect(
        rowFor(number, 'subtitle', 'en'),
        `map card ${number} has no id and no subject line either, so it draws ` +
          'nothing but a number',
      ).toBeDefined();
      expect(rowFor(number, 'subtitle', 'fr')).toBeDefined();
    });
  });
});
