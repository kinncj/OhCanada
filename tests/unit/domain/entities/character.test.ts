/**
 * The character the creator produced, and what happens to it when the content
 * under it changes (TN-CREATOR, TN-SAVE item 1).
 */

import { describe, expect, it } from 'vitest';

import {
  createPlayerCharacter,
  fallbackSkins,
  repairSkins,
  selectableSlots,
  skinsAreIntact,
  slotOffers,
} from '@domain/entities/character';
import type { Character } from '@domain/entities/character';

import { characterId, makeCharacter } from '../../support/fixtures';

const character: Character = makeCharacter();

describe('slots', () => {
  it('offers the creator only the selectable slots', () => {
    expect(selectableSlots(character).map((slot) => slot.name)).toEqual(['skin', 'coat']);
  });

  it('knows which options a slot has', () => {
    const skin = character.slots[0];
    expect(skin).toBeDefined();
    expect(slotOffers(skin!, 'skin-2')).toBe(true);
    expect(slotOffers(skin!, 'skin-9')).toBe(false);
  });

  it('dresses every slot in its fallback', () => {
    expect(fallbackSkins(character)).toEqual({
      skin: 'skin-1',
      coat: 'coat-red',
      badge: 'badge-none',
    });
  });
});

describe('creating a player character', () => {
  it('keeps the choices and fills the slots the player never sees', () => {
    const created = createPlayerCharacter(character, { skin: 'skin-2', coat: 'coat-blue' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value).toEqual({
      characterId: character.id,
      skins: { skin: 'skin-2', coat: 'coat-blue', badge: 'badge-none' },
    });
  });

  it('refuses a slot the character does not have', () => {
    const created = createPlayerCharacter(character, { skin: 'skin-1', coat: 'coat-red', hat: 'hat-1' });
    expect(created.ok).toBe(false);
    if (!created.ok) expect(created.error.code).toBe('character.slot.unknown');
  });

  it('refuses an option the slot does not offer', () => {
    const created = createPlayerCharacter(character, { skin: 'skin-9', coat: 'coat-red' });
    expect(created.ok).toBe(false);
    if (!created.ok) expect(created.error.code).toBe('character.option.unknown');
  });

  it('refuses a selectable slot nobody chose', () => {
    const created = createPlayerCharacter(character, { skin: 'skin-1' });
    expect(created.ok).toBe(false);
    if (!created.ok) expect(created.error.code).toBe('character.slot.unchosen');
  });
});

describe('a saved character after the content changed', () => {
  const saved = { characterId: character.id, skins: { skin: 'skin-2', coat: 'coat-gone' } };

  it('reports that it no longer fits', () => {
    expect(skinsAreIntact(character, saved)).toBe(false);
    expect(
      skinsAreIntact(character, {
        characterId: character.id,
        skins: { skin: 'skin-1', coat: 'coat-red', badge: 'badge-none' },
      }),
    ).toBe(true);
  });

  it('keeps every choice that still exists, and never fills a chosen slot from the fallback', () => {
    /*
     * `TN-LOOK-05`: a slot whose option is gone is refilled by a uniform draw
     * over that slot's options, and NOT by the rig's fallback. `coat-gone` is
     * the removed option; `coat-red` is the fallback, and `draw` here is pinned
     * at the far end of the list so that a repair reaching for the fallback and
     * a repair drawing correctly cannot produce the same answer.
     */
    expect(repairSkins(character, saved, () => 0.99)).toEqual({
      characterId: character.id,
      // `badge` is not player-selectable: a costume slot, and the fallback is
      // exactly what it is for.
      skins: { skin: 'skin-2', coat: 'coat-blue', badge: 'badge-none' },
    });
  });

  it('draws over the whole slot, so no option is the one a repair lands on', () => {
    /*
     * The distribution, not one draw: a repair that returned `options[0]`
     * whatever it was given would pass the case above if the fallback were
     * second. Every option must be reachable and none may take the lot.
     */
    const drawn = new Map<string, number>();
    for (let index = 0; index < 600; index += 1) {
      const random = (index + 0.5) / 600;
      const repaired = repairSkins(character, saved, () => random);
      const coat = repaired.skins['coat'] ?? '';
      drawn.set(coat, (drawn.get(coat) ?? 0) + 1);
    }
    expect([...drawn.keys()].sort()).toEqual(['coat-blue', 'coat-red']);
    for (const [option, count] of drawn) {
      expect(count, `${option} came up ${String(count)} times in 600`).toBeGreaterThan(200);
    }
  });

  it('refills a slot the save never named, and only from that slot', () => {
    const missing = { characterId: character.id, skins: { skin: 'skin-2' } };
    const repaired = repairSkins(character, missing, () => 0);
    expect(repaired.skins['coat']).toBe('coat-red');
    expect(repaired.skins['skin']).toBe('skin-2');
    expect(repaired.skins['badge']).toBe('badge-none');
  });

  it('fills a slot the save predates from its fallback, not from a draw', () => {
    /*
     * A slot the save never named is newer than the save: no choice was taken
     * away, so nothing is drawn. `draw` is pinned at the far end so that a draw
     * (`coat-blue`) and the fallback (`coat-red`) cannot give the same answer.
     */
    const predates = { characterId: character.id, skins: { skin: 'skin-2' } };
    expect(repairSkins(character, predates, () => 0.99).skins).toEqual({
      skin: 'skin-2',
      coat: 'coat-red',
      badge: 'badge-none',
    });
  });

  it('falls a selectable slot with nothing to draw from back, because there was no choice to lose', () => {
    /*
     * `character.schema.json` floors `options` at one, so this is a hand-built
     * character rather than a content case — and a slot offering nothing took no
     * choice away from anybody, so the one value in the document is the only
     * answer available. Exercised so the branch is not an untested guess.
     */
    const empty: Character = {
      ...character,
      slots: [
        { name: 'skin', labelKey: 'creator.slot.skin', playerSelectable: true, options: [], fallback: 'skin-1' },
      ],
    };
    expect(repairSkins(empty, saved, () => 0).skins).toEqual({ skin: 'skin-1' });
  });

  it('leaves a save for a different character alone, for the caller to refuse', () => {
    const stranger = { characterId: characterId('mountie'), skins: { skin: 'skin-2' } };
    expect(repairSkins(character, stranger, () => 0)).toBe(stranger);
    expect(skinsAreIntact(character, stranger)).toBe(false);
  });

  it('cannot be called without saying where the new option comes from', () => {
    /*
     * The defect this signature closes, held open by the type checker rather
     * than by a comment: `repairSkins` used to fill EVERY slot from
     * `slot.fallback`, which is the default player `assets/style/art-bible.md`
     * §8 removed, reached through a path no player can see. Nothing called it,
     * which is a fact about that day; the third argument is a fact about the
     * function.
     */
    // @ts-expect-error a repair with no draw would have to reach for a fallback
    expect(() => repairSkins(character, saved)).toThrow();
  });
});
