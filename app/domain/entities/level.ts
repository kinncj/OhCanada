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
 *
 * Two lists of level ids live at the bottom of this file and they are not the
 * same list: {@link Journey} is the ten places the map draws, and
 * {@link UnlockRules}`.order` is the sequence a player unlocks them in. See
 * {@link Journey} for what happened when they were one list.
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

/**
 * How the next level is earned (`game.config.json#/unlockRules`).
 *
 * `order` is the *unlock* sequence, not the map's numbering — the levels this
 * build can chain, in the sequence a player walks them, beginning at a level
 * `initialLevels` already opens. The map's ten places are {@link Journey}.
 */
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
 * Which levels are open, given the stamps earned and the levels the save has
 * already opened.
 *
 * Until this function existed, `unlockRules` was three numbers in
 * `game.config.json` that nothing read — the same shape of defect as a budget
 * that appears in the config and is enforced by nothing. The rule it states:
 * `initialLevels` are always open, and walking `order`, each other level costs
 * `stampsToUnlockNext` stamps of credit, earned by stamping the levels before
 * it and not yet spent on an earlier one. The walk stops at the first level it
 * can neither pay for nor finds already open, because `order` is a progression
 * and level 6 opening before level 5 would make the order decorative.
 *
 * ## Monotone under insertion (ADR-0068 §9)
 *
 * Adding a level to `order` must never lock a level a save could already open.
 * Stamps and order alone cannot promise that: if every insertion kept what the
 * shorter order opened, then by chaining insertions an order would have to open
 * everything any of its subsequences opens — and `[initial, X]` opens `X` for
 * one stamp, for every `X`, so one stamp would open the whole map. The rule
 * needs memory, and the save already has it: `LevelProgress.unlocked`. So:
 *
 *  - the answer is the walk ∪ `stampedLevelIds` ∪ `previouslyUnlocked`, so
 *    nothing a save holds is ever taken back, and a stamp — proof the level was
 *    played — always keeps its own level open;
 *  - the walk does not stop at a level that is already open (stamped or
 *    previously unlocked) and cannot be paid for: it passes it without spending,
 *    and that level's stamp still earns credit. A level that *can* be paid for
 *    is paid for whether or not it was already open — which is what keeps the
 *    walk's accounting identical to the pre-memory walk for every save played in
 *    order, and what makes the answer a fixed point when it is persisted and
 *    fed back (a remembered level passed free would leave a stamp unspent, and
 *    one stamp would open one more level on every reload).
 *
 * A `stampsToUnlockNext` below 1 would unlock the whole map from a config typo,
 * so it is floored at 1 rather than trusted.
 */
export const unlockedLevelIds = (
  rules: UnlockRules,
  stampedLevelIds: readonly LevelId[],
  previouslyUnlocked: readonly LevelId[] = [],
): readonly LevelId[] => {
  const initial = new Set(rules.initialLevels);
  const stamped = new Set(stampedLevelIds);
  const alreadyOpen = new Set([...stampedLevelIds, ...previouslyUnlocked]);
  const unlocked = new Set(rules.initialLevels);
  const cost = Math.max(1, Math.floor(rules.stampsToUnlockNext));
  let credit = 0;

  for (const levelId of rules.order) {
    if (!initial.has(levelId)) {
      if (credit >= cost) credit -= cost;
      else if (!alreadyOpen.has(levelId)) break;
      unlocked.add(levelId);
    }
    if (stamped.has(levelId)) credit += 1;
  }

  return [...new Set([...unlocked, ...stampedLevelIds, ...previouslyUnlocked])];
};

/**
 * The map's places, in map order, `null` where the id is not fixed.
 *
 * The second of the two lists this file keeps apart, and the reason it is a
 * separate type rather than another `LevelId[]`:
 *
 *  - **the journey** is the game's shape — ten places, east to west, numbered
 *    on the map (`TN-MAP-01`, `TN-LEVELS`). It changes when the *game* changes,
 *    and `content/schemas/level.schema.json` already calls a level's slot
 *    "position in the world map, 1-10";
 *  - **`UnlockRules.order`** is the progression — the levels this build can
 *    actually chain, in the sequence a player walks them. It changes when a
 *    level is *built*.
 *
 * They were one list until the chain died of it: `order` began at `halifax` to
 * keep the map's numbering, `initialLevels` named only `ottawa` because Halifax
 * is not built, and {@link unlockedLevelIds} stops at the first level it cannot
 * open — so it stopped at index 0 and no stamp ever unlocked anything. One list
 * cannot be both a fixed catalogue of ten slots and a sequence that starts where
 * the player starts.
 *
 * `null` is a place with no id, not a missing id: `TN-LEVELS` declines to fix
 * ids for levels 2 and 10 while `docs/content-review.md` §1 blocks them, and
 * `TN-MAP-04` forbids a placeholder standing in for the name. The slot's number
 * is its handle until a person — not an agent — names it.
 */
export type Journey = readonly (LevelId | null)[];

/** The ids the map shows, in map order. A slot with no id names nothing. */
export const journeyLevelIds = (journey: Journey): readonly LevelId[] =>
  journey.filter((slot): slot is LevelId => slot !== null);

/**
 * Which levels in `order` no sequence of play can ever open.
 *
 * The check that would have caught the dead chain. It plays the chain as far
 * as it goes: stamp every level that is open, remember it as opened, walk
 * again, until a walk opens nothing new. Stamping more never opens less, so
 * that fixed point is the furthest any player can get — and anything `order`
 * names that is still shut there is shut forever. A config that returns
 * anything here has levels in it that nobody can reach.
 *
 * It plays rather than stamping all of `order` at once, as it did before the
 * walk had memory: {@link unlockedLevelIds} keeps a stamped level open, so a
 * passport holding every stamp opens every level whether or not the chain can
 * reach it, and the check would have become vacuous.
 *
 * Returned in `order`'s own order, so the first entry is where the chain dies.
 */
export const unreachableLevelIds = (rules: UnlockRules): readonly LevelId[] => {
  let open = unlockedLevelIds(rules, []);
  for (;;) {
    const next = unlockedLevelIds(rules, open, open);
    if (next.length === open.length) break;
    open = next;
  }
  const furthest = new Set(open);
  return rules.order.filter((levelId) => !furthest.has(levelId));
};

/**
 * Which levels the rules can open that the map has no place for.
 *
 * The mirror of the assertion `tests/unit/bootstrap/journey.test.ts` already
 * makes about level *documents*: a level the rules unlock and the map cannot
 * draw is a level the player is never offered, and the two lists have to agree
 * about which places exist even though they answer different questions.
 */
export const unmappedLevelIds = (rules: UnlockRules, journey: Journey): readonly LevelId[] => {
  const places = new Set(journeyLevelIds(journey));
  const named = [...new Set([...rules.initialLevels, ...rules.order])];
  return named.filter((levelId) => !places.has(levelId));
};
