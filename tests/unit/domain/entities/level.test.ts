/**
 * What the domain reads off a level: where the player starts, what can be
 * engaged, and which levels are open.
 */

import { describe, expect, it } from 'vitest';

import {
  journeyLevelIds,
  levelOffersQuest,
  poiById,
  questAtPoi,
  questGivenBy,
  spawnPoint,
  unlockedLevelIds,
  unmappedLevelIds,
  unreachableLevelIds,
} from '@domain/entities/level';
import type { Journey, Level, UnlockRules } from '@domain/entities/level';

import { characterId, levelId, makeLevel, poiId, questId } from '../../support/fixtures';

const level: Level = makeLevel();

describe('reading a level', () => {
  it('answers where the skater starts, which TN-SAVE-02 asks on every reload', () => {
    expect(spawnPoint(level)).toEqual({ x: 240, y: 1500 });
  });

  it('finds a landmark, and the quest it belongs to', () => {
    expect(poiById(level, poiId())?.name.en).toBe('Parliament Hill');
    expect(poiById(level, poiId('rideau-canal'))).toBeUndefined();
    expect(questAtPoi(level, poiId())).toBe(questId());
    expect(questAtPoi(level, poiId('rideau-canal'))).toBeUndefined();
  });

  it('finds the quest a character gives', () => {
    expect(questGivenBy(level, characterId())).toBe(questId());
    expect(questGivenBy(level, characterId('skater'))).toBeUndefined();
  });

  it('knows which quests belong to it', () => {
    expect(levelOffersQuest(level, questId())).toBe(true);
    expect(levelOffersQuest(level, questId('quebec-city-walls'))).toBe(false);
  });
});

describe('unlocking (game.config unlockRules)', () => {
  const rules: UnlockRules = {
    initialLevels: [levelId('ottawa')],
    order: [levelId('ottawa'), levelId('halifax'), levelId('victoria')],
    stampsToUnlockNext: 1,
  };

  it('opens the initial levels and nothing else', () => {
    expect(unlockedLevelIds(rules, [])).toEqual(['ottawa']);
  });

  it('opens the next level when the stamp is earned', () => {
    expect(unlockedLevelIds(rules, [levelId('ottawa')])).toEqual(['ottawa', 'halifax']);
    expect(unlockedLevelIds(rules, [levelId('ottawa'), levelId('halifax')])).toEqual([
      'ottawa',
      'halifax',
      'victoria',
    ]);
  });

  it('does not open a later level before an earlier one', () => {
    // A stamp for a level that is not open yet cannot happen in play; if a save
    // claims it, the order still holds rather than opening the map.
    expect(unlockedLevelIds(rules, [levelId('victoria')])).toEqual(['ottawa']);
  });

  it('charges the full price for each unlock', () => {
    const expensive: UnlockRules = { ...rules, stampsToUnlockNext: 2 };
    expect(unlockedLevelIds(expensive, [levelId('ottawa')])).toEqual(['ottawa']);
  });

  it('refuses to be talked into a free map by a config typo', () => {
    const free: UnlockRules = { ...rules, stampsToUnlockNext: 0 };
    expect(unlockedLevelIds(free, [])).toEqual(['ottawa']);
    expect(unlockedLevelIds(free, [levelId('ottawa')])).toEqual(['ottawa', 'halifax']);
  });
});

describe('a chain that can never be walked (OQ-MAP-2)', () => {
  /*
   * The defect this block is written against shipped: `order` began at
   * `halifax`, `initialLevels` named only `ottawa`, and the walk breaks at the
   * first level it cannot open — so it broke at index 0 and no stamp ever
   * unlocked anything. The map looked fine. Every test passed. Québec City had
   * art, a level document and no route to it.
   */
  const dead: UnlockRules = {
    initialLevels: [levelId('ottawa')],
    order: [levelId('halifax'), levelId('quebec-city'), levelId('ottawa')],
    stampsToUnlockNext: 1,
  };

  it('names every level the chain can never open, however the player plays', () => {
    expect(unreachableLevelIds(dead)).toEqual(['halifax', 'quebec-city']);
  });

  it('is empty for a chain that starts where the player starts', () => {
    const live: UnlockRules = {
      initialLevels: [levelId('ottawa')],
      order: [levelId('ottawa'), levelId('quebec-city')],
      stampsToUnlockNext: 1,
    };
    expect(unreachableLevelIds(live)).toEqual([]);
  });

  it('counts a level that costs more stamps than the chain can ever pay', () => {
    const steep: UnlockRules = {
      initialLevels: [levelId('ottawa')],
      order: [levelId('ottawa'), levelId('quebec-city'), levelId('halifax')],
      stampsToUnlockNext: 2,
    };
    /* Two stamps to open the second level, and only one level can be stamped
       before it. Nothing after `ottawa` is ever reachable. */
    expect(unreachableLevelIds(steep)).toEqual(['quebec-city', 'halifax']);
  });

  it('is empty for a chain nobody has written yet', () => {
    expect(
      unreachableLevelIds({ initialLevels: [], order: [], stampsToUnlockNext: 1 }),
    ).toEqual([]);
  });
});

describe('the chain and the map are the same ten places (TN-MAP-01)', () => {
  const journey: Journey = [
    levelId('halifax'),
    null,
    levelId('quebec-city'),
    levelId('ottawa'),
  ];

  it('names a level the rules can open that no slot on the map shows', () => {
    const rules: UnlockRules = {
      initialLevels: [levelId('ottawa')],
      order: [levelId('ottawa'), levelId('yellowknife')],
      stampsToUnlockNext: 1,
    };
    expect(unmappedLevelIds(rules, journey)).toEqual(['yellowknife']);
  });

  it('checks the levels that are open from the first frame too', () => {
    const rules: UnlockRules = {
      initialLevels: [levelId('atlantis')],
      order: [levelId('ottawa')],
      stampsToUnlockNext: 1,
    };
    expect(unmappedLevelIds(rules, journey)).toEqual(['atlantis']);
  });

  it('is empty when every id the rules name has a place on the map', () => {
    const rules: UnlockRules = {
      initialLevels: [levelId('ottawa')],
      order: [levelId('ottawa'), levelId('quebec-city')],
      stampsToUnlockNext: 1,
    };
    expect(unmappedLevelIds(rules, journey)).toEqual([]);
  });

  it('reads the ids off the map, skipping the slots whose id is not fixed', () => {
    /* Levels 2 and 10 have no id (`TN-LEVELS`, `docs/content-review.md` §1).
       A slot with no id is a place, not a level, and names nothing. */
    expect(journeyLevelIds(journey)).toEqual(['halifax', 'quebec-city', 'ottawa']);
  });
});
