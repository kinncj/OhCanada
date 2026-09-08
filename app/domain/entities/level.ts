/**
 * Level — the places a player can engage, and which levels are open to them.
 *
 * Mirrors the part of `content/schemas/level.schema.json` that *rules* read.
 * Geometry the engine needs (ground polyline, parallax layers, camera tuning,
 * asset manifest) is deliberately absent: none of it is a rule, all of it is
 * checked by the level scene and the payload budget, and a domain type that
 * carried it would invite a rule to depend on rendering. `UnlockRules` mirrors
 * `game.config.schema.json#/$defs/unlockRules`.
 *
 * `spawn` is here because TN-SAVE-02 makes it a rule: the player's position is
 * deliberately not saved, so "where does the skater start" is answered by the
 * level, every time.
 */

import type { CharacterId, LevelId, PoiId, QuestId, SubjectId } from '@domain/ids';

import type { LocalizedText, Vec2 } from '@domain/entities/values';

/** A landmark the player taps to engage. */
export interface PointOfInterest {
  readonly id: PoiId;
  readonly name: LocalizedText;
  readonly position: Vec2;
  /** Engagement radius; at least 44 pt of screen at design scale. */
  readonly radiusPx: number;
  /** The quest this landmark belongs to, when it belongs to one. */
  readonly questId?: QuestId;
}

/** Where a character stands on a level. Placement only; the rig lives in the character document. */
export interface LevelCharacter {
  readonly characterId: CharacterId;
  readonly position: Vec2;
  readonly facing: 'left' | 'right';
  readonly questId?: QuestId;
}

export interface Level {
  readonly id: LevelId;
  /** The subject this level teaches; also the question-bank key. */
  readonly subject: SubjectId;
  readonly order: number;
  readonly title: LocalizedText;
  readonly spawn: Vec2;
  readonly quests: readonly QuestId[];
  readonly pois: readonly PointOfInterest[];
  readonly characters: readonly LevelCharacter[];
}

/** How the next level is earned (`game.config.json#/unlockRules`). */
export interface UnlockRules {
  readonly initialLevels: readonly LevelId[];
  readonly order: readonly LevelId[];
  readonly stampsToUnlockNext: number;
}

export const poiById = (level: Level, poiId: PoiId): PointOfInterest | undefined =>
  level.pois.find((poi) => poi.id === poiId);

/** Where the skater starts, and where they start again after a closed tab (TN-SAVE-02). */
export const spawnPoint = (level: Level): Vec2 => level.spawn;

/** Does this level list that quest? Guards a quest being applied to the wrong level. */
export const levelOffersQuest = (level: Level, questId: QuestId): boolean =>
  level.quests.includes(questId);

/** The quest this character gives on this level, if any. */
export const questGivenBy = (level: Level, characterId: CharacterId): QuestId | undefined =>
  level.characters.find((character) => character.characterId === characterId)?.questId;

/** The quest step this landmark belongs to, if any. */
export const questAtPoi = (level: Level, poiId: PoiId): QuestId | undefined =>
  poiById(level, poiId)?.questId;

/**
 * Which levels are open, given the stamps earned.
 *
 * Until this function existed, `unlockRules` was three numbers in
 * `game.config.json` that nothing read — the same shape of defect as a budget
 * that appears in the config and is enforced by nothing. The rule it states:
 * `initialLevels` are always open, and walking `order`, each locked level opens
 * when `stampsToUnlockNext` stamps have been earned and not yet spent on an
 * earlier unlock. The walk stops at the first level that cannot be opened,
 * because `order` is a progression and level 6 opening before level 5 would make
 * the order decorative.
 *
 * A `stampsToUnlockNext` below 1 would unlock the whole map from a config typo,
 * so it is floored at 1 rather than trusted.
 */
export const unlockedLevelIds = (
  rules: UnlockRules,
  stampedLevelIds: readonly LevelId[],
): readonly LevelId[] => {
  const stamped = new Set(stampedLevelIds);
  const unlocked = new Set(rules.initialLevels);
  const cost = Math.max(1, Math.floor(rules.stampsToUnlockNext));
  let credit = 0;

  for (const levelId of rules.order) {
    if (!unlocked.has(levelId)) {
      if (credit < cost) break;
      credit -= cost;
      unlocked.add(levelId);
    }
    if (stamped.has(levelId)) credit += 1;
  }

  return [...unlocked];
};
