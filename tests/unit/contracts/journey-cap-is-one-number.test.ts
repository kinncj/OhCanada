/**
 * ADR-0068 §9: the journey holds at most eleven places, and a level's `order`
 * is its slot in that journey, so the two caps are one number written twice.
 *
 * `content/schemas/game.config.schema.json#/properties/journey/maxItems` caps
 * the map's slots, and `content/schemas/level.schema.json#/properties/order`
 * caps the number a level document may claim. A JSON Schema cannot import the
 * other's value, so each names the other in its description, and this file is
 * what makes that cross-reference a checked fact. Raising one without the other
 * would let a level claim a slot the journey cannot hold, or leave a slot no
 * level can claim.
 *
 * Neither may be open-ended (ADR-0068's infra obligation): a twelfth place is a
 * decision under ADR-0065 §4's ceiling, not an edit, so a missing cap fails here.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const read = (name: string): Record<string, unknown> =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../../../content/schemas/${name}`, import.meta.url)), 'utf8'),
  ) as Record<string, unknown>;

interface Properties {
  readonly properties: Record<string, Record<string, unknown>>;
}

const journey = (read('game.config.schema.json') as unknown as Properties).properties.journey ?? {};
const order = (read('level.schema.json') as unknown as Properties).properties.order ?? {};

describe('the journey cap is one number', () => {
  it('caps the journey, and the cap is eleven (ADR-0068 §9)', () => {
    expect(journey.maxItems, 'journey must not be open-ended').toBe(11);
  });

  it("caps a level's order at the same number, from 1", () => {
    expect(order.minimum).toBe(1);
    expect(order.maximum, 'order must not be open-ended').toBe(journey.maxItems);
  });

  it('states no stale range in either description', () => {
    for (const described of [journey.description, order.description]) {
      expect(typeof described).toBe('string');
      expect(described).not.toMatch(/\b1\s*[-–]\s*10\b|\bten places\b/i);
    }
  });
});
