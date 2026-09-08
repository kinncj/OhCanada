/**
 * What the domain reads off a level: where the player starts, what can be
 * engaged, and which levels are open.
 */

import { describe, expect, it } from 'vitest';

import {
  levelOffersQuest,
  poiById,
  questAtPoi,
  questGivenBy,
  spawnPoint,
  unlockedLevelIds,
} from '@domain/entities/level';
import type { Level, UnlockRules } from '@domain/entities/level';

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
