import { describe, expect, it } from 'vitest';
import { computeUnlockedDistricts, isExamUnlocked } from '@domain/district';
import { CONFIG } from '../../fixtures/content';

describe('unlock rules', () => {
  const rules = CONFIG.unlockRules;
  it('starts with initial districts only', () => {
    expect(computeUnlockedDistricts(rules, { stampsByDistrict: {}, explicitlyUnlocked: [] })).toEqual(['hub']);
  });
  it('unlocks sequentially by stamps', () => {
    expect(computeUnlockedDistricts(rules, { stampsByDistrict: { hub: 1 }, explicitlyUnlocked: [] })).toEqual(['hub', 'rights-responsibilities']);
    expect(computeUnlockedDistricts(rules, { stampsByDistrict: { hub: 1, 'rights-responsibilities': 1 }, explicitlyUnlocked: [] })).toHaveLength(3);
    // stamps in a locked district do not skip ahead
    expect(computeUnlockedDistricts(rules, { stampsByDistrict: { 'rights-responsibilities': 3 }, explicitlyUnlocked: [] })).toEqual(['hub']);
  });
  it('honours explicit unlocks', () => {
    expect(computeUnlockedDistricts(rules, { stampsByDistrict: {}, explicitlyUnlocked: ['who-we-are' as never] })).toContain('who-we-are');
  });
  it('exam unlock threshold', () => {
    expect(isExamUnlocked(rules, 1)).toBe(false);
    expect(isExamUnlocked(rules, 2)).toBe(true);
  });
});
