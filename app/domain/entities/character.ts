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
 * A save is schema-valid and still names an option id that a later build
 * removed, or misses a slot a later build added. Dropping the player back into
 * the creator would lose TN-SAVE item 1 for a reason the player did nothing to
 * cause, so the unknown parts are refilled and the rest survives. A save naming
 * a different character document is not repairable and comes back unchanged for
 * the caller to refuse.
 *
 * **How a slot is refilled depends on whether a player chose it, and `draw` is
 * why this function takes a third argument.** It used to fill every slot from
 * `slot.fallback`, which is right for a costume slot and is **forbidden for a
 * player-selectable one**: `TN-LOOK-05` requires a removed option to be replaced
 * by a uniform draw over that slot's options and *not* by the fallback, for the
 * same reason the creator has no skip and `assets/style/art-bible.md` §8 says no
 * skin tone is the default. A repair that reached for the fallback would put the
 * default player — the one content review spent real effort removing — back
 * through the one door nobody was watching, on a path the player cannot see and
 * did not ask for.
 *
 * Nothing called this when the divergence was found; the composition root had
 * written its own uniform repair over the rig rather than use it. "Nobody calls
 * the dangerous one" is a fact about today, so the shape is what changed instead:
 * `draw` has no default, so a caller cannot reach a fallback for a selectable
 * slot by forgetting something, and a costume slot still takes its fallback
 * without consuming a number.
 *
 * `draw` returns [0, 1), which is `RandomSource.next` and every seeded source in
 * this codebase. Domain code never calls `Math.random` (ADR-0001).
 */
export const repairSkins = (
  character: Character,
  saved: PlayerCharacter,
  draw: () => number,
): PlayerCharacter => {
  if (saved.characterId !== character.id) return saved;
  const skins: Record<string, string> = {};
  for (const slot of character.slots) {
    const chosen = saved.skins[slot.name];
    if (chosen !== undefined && slotOffers(slot, chosen)) {
      skins[slot.name] = chosen;
      continue;
    }
    if (!slot.playerSelectable) {
      // What `fallback` is for, and the only place it is still read: an NPC's
      // costume, chosen by nobody, where "the default" is the whole idea.
      skins[slot.name] = slot.fallback;
      continue;
    }
    /* A slot with no options offers no choice, so there is no choice to have
       been taken away and nothing to draw from; the fallback is the only value
       in the document. `character.schema.json` floors `options` at one, so this
       is a guard against a hand-built character rather than a content case. */
    const index = Math.min(slot.options.length - 1, Math.floor(draw() * slot.options.length));
    skins[slot.name] = slot.options[index]?.id ?? slot.fallback;
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
