import { describe, expect, it } from 'vitest';
import { SeededRandom, hashString, shuffle } from '@common/rng';

describe('SeededRandom', () => {
  it('is deterministic and in [0,1)', () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);
    for (let i = 0; i < 100; i++) {
      const v = a.next();
      expect(v).toBe(b.next());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(new SeededRandom(1).int(10)).toBeLessThan(10);
  });
  it('shuffle keeps elements', () => {
    const out = shuffle([1, 2, 3, 4, 5], new SeededRandom(7));
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it('hashString stable', () => {
    expect(hashString('hub')).toBe(hashString('hub'));
    expect(hashString('hub')).not.toBe(hashString('hab'));
  });
});
