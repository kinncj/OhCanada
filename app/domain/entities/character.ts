/**
 * Character — a rig with named slots, and the choices a player made in them.
 *
 * Mirrors `content/schemas/character.schema.json` and, for `PlayerCharacter`,
 * `progress.schema.json#/$defs/playerCharacter`. The type below is the part of
 * those documents the *rules* read: names and value types are the schema's, so a
 * `CharacterDocument` from the content port satisfies `Character` structurally
 * and no mapping layer exists to drift. Presentation-only fields (`artboard`,
 * `stateMachine`, `inputs`) belong to `ICharacterRenderer`, not to a rule, and
 * are deliberately absent — a rule that could read them is a rule that could
 * depend on the renderer.
 *
 * Every function is pure and returns a new value.
 */

import { appErr, ok } from '@common/result';
import type { Result } from '@common/result';
import type { CharacterId } from '@domain/ids';

import type { LocalizedText } from '@domain/entities/values';

/** One choice inside a slot. Every option has a label key: colour is never the only signal. */
export interface CharacterSkinOption {
  readonly id: string;
  readonly labelKey: string;
}

/** One runtime-swappable slot: skin tone, hair, coat. */
export interface CharacterSlot {
  readonly name: string;
  readonly labelKey: string;
  /** What the creator offers. An NPC's costume slots are not selectable. */
  readonly playerSelectable: boolean;
  readonly options: readonly CharacterSkinOption[];
  /**
   * Option used when nothing has been chosen, and when a saved choice no longer
   * exists. **Not a pre-selection** (`assets/style/art-bible.md` §8).
   */
  readonly fallback: string;
}

export interface Character {
  readonly id: CharacterId;
  readonly name: LocalizedText;
  readonly slots: readonly CharacterSlot[];
  /** Recorded, never inferred (`docs/content-review.md` §3.3). */
  readonly indigenous: boolean;
  /** One nation, as that nation names itself. Present iff `indigenous`. */
  readonly nation?: string;
}

/**
 * What the creator produced: the chosen option in every slot.
 *
 * TN-SAVE item 1 — "the character: the chosen option in every slot" — is this
 * object, and nothing else. There is no player-entered name anywhere in it, so
 * a save carries no free text a player could be identified by (TN-SAVE-03).
 */
export interface PlayerCharacter {
  readonly characterId: CharacterId;
  readonly skins: Readonly<Record<string, string>>;
}

const slotByName = (character: Character): ReadonlyMap<string, CharacterSlot> =>
  new Map(character.slots.map((slot) => [slot.name, slot]));

/** The slots the character creator shows. */
export const selectableSlots = (character: Character): readonly CharacterSlot[] =>
  character.slots.filter((slot) => slot.playerSelectable);

/** Does this slot offer this option? */
export const slotOffers = (slot: CharacterSlot, optionId: string): boolean =>
  slot.options.some((option) => option.id === optionId);

/** Every slot at its fallback: an NPC's costume, and the starting point for recovery. */
export const fallbackSkins = (character: Character): Readonly<Record<string, string>> =>
  Object.fromEntries(character.slots.map((slot) => [slot.name, slot.fallback]));

/**
 * Build the player's character from the creator's choices.
 *
 * Every selectable slot must be chosen and every choice must be an option that
 * slot offers; non-selectable slots take their fallback. A choice naming a slot
 * the character does not have is a bug in the caller, not a value to ignore, so
 * it fails rather than being dropped — the recovery path below is the one that
 * forgives.
 */
export const createPlayerCharacter = (
  character: Character,
  choices: Readonly<Record<string, string>>,
): Result<PlayerCharacter> => {
  const slots = slotByName(character);
  for (const [name, optionId] of Object.entries(choices)) {
    const slot = slots.get(name);
    if (slot === undefined) {
      return appErr('invalid', 'character.slot.unknown', 'That character has no such slot.', {
        characterId: character.id,
        slot: name,
      });
    }
    if (!slotOffers(slot, optionId)) {
      return appErr('invalid', 'character.option.unknown', 'That slot has no such option.', {
        characterId: character.id,
        slot: name,
        option: optionId,
      });
    }
  }

  const skins: Record<string, string> = {};
  for (const slot of character.slots) {
    const chosen = choices[slot.name];
    if (chosen === undefined) {
      if (slot.playerSelectable) {
        return appErr('invalid', 'character.slot.unchosen', 'Every slot needs a choice.', {
          characterId: character.id,
          slot: slot.name,
        });
      }
      skins[slot.name] = slot.fallback;
      continue;
    }
    skins[slot.name] = chosen;
  }
  return ok({ characterId: character.id, skins });
};

/**
 * Make a saved character wearable again after the content changed.
 *
 * This is what `CharacterSlot.fallback` is for: a save is schema-valid and still
 * names an option id that a later build removed, or misses a slot a later build
 * added. Dropping the player back into the creator would lose TN-SAVE item 1 for
 * a reason the player did nothing to cause, so the unknown parts fall back and
 * the rest survives. A save naming a different character document is not
 * repairable and comes back unchanged for the caller to refuse.
 */
export const repairSkins = (character: Character, saved: PlayerCharacter): PlayerCharacter => {
  if (saved.characterId !== character.id) return saved;
  const skins: Record<string, string> = {};
  for (const slot of character.slots) {
    const chosen = saved.skins[slot.name];
    skins[slot.name] = chosen !== undefined && slotOffers(slot, chosen) ? chosen : slot.fallback;
  }
  return { characterId: character.id, skins };
};

/** Does this saved character still name a slot and option of every slot it has? */
export const skinsAreIntact = (character: Character, saved: PlayerCharacter): boolean =>
  saved.characterId === character.id &&
  character.slots.every((slot) => {
    const chosen = saved.skins[slot.name];
    return chosen !== undefined && slotOffers(slot, chosen);
  });
