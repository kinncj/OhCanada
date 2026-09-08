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

  it('keeps every choice that still exists and falls the rest back', () => {
    expect(repairSkins(character, saved)).toEqual({
      characterId: character.id,
      skins: { skin: 'skin-2', coat: 'coat-red', badge: 'badge-none' },
    });
  });

  it('leaves a save for a different character alone, for the caller to refuse', () => {
    const stranger = { characterId: characterId('mountie'), skins: { skin: 'skin-2' } };
    expect(repairSkins(character, stranger)).toBe(stranger);
    expect(skinsAreIntact(character, stranger)).toBe(false);
  });
});
