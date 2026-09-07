import { describe, expect, it } from 'vitest';
import { defaultCharacter, validateCharacter } from '@domain/character';
import { CATALOG } from '../../fixtures/content';

describe('character', () => {
  it('default character is valid', () => {
    const c = defaultCharacter(CATALOG);
    expect(validateCharacter(c, CATALOG)).toEqual([]);
    expect(c.appearance.accessory).toBe('none');
  });
  it('reports every invalid field', () => {
    const c = defaultCharacter(CATALOG, '');
    const bad = { ...c, appearance: { ...c.appearance, hair: 'mohawk', outfit: 'tuxedo' } };
    const errors = validateCharacter(bad, CATALOG);
    expect(errors.map((e) => e.field).sort()).toEqual(['hair', 'name', 'outfit']);
    expect(validateCharacter({ ...c, name: 'x'.repeat(25) }, CATALOG)[0]?.field).toBe('name');
  });
  it('default falls back when catalog has no none accessory', () => {
    const c = defaultCharacter({ ...CATALOG, accessories: [{ id: 'toque', label: { en: 'T', fr: 'T' } }] });
    expect(c.appearance.accessory).toBe('toque');
    const empty = defaultCharacter({ ...CATALOG, bodies: [] });
    expect(empty.appearance.body).toBe('');
  });
});
