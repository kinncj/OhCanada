import { describe, expect, it } from 'vitest';
import { createPlayer, distance2D, withinRadius } from '@domain/player';
import { districtId } from '@domain/ids';

describe('player', () => {
  it('creates and measures distance', () => {
    const p = createPlayer(districtId('hub'), [0, 0, 0], 0);
    expect(p.entity).toBe(0);
    expect(distance2D([0, 0, 0], [3, 10, 4])).toBe(5);
    expect(withinRadius([0, 0, 0], [3, 0, 4], 5)).toBe(true);
    expect(withinRadius([0, 0, 0], [3, 0, 4], 4.9)).toBe(false);
  });
});
