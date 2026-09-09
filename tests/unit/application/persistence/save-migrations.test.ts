/**
 * The first real save migration, 1 -> 2.
 *
 * A migration runs on a document that has been parsed and version-gated and
 * nothing else — the schema check comes after it — so half of what is asserted
 * here is about input the step does not recognise. A migration that threw, or
 * that "repaired" something it had not understood, would turn a save the player
 * could still download into one nobody can read.
 */

import { describe, expect, it } from 'vitest';

import { SAVE_MIGRATIONS, addHoldToChooseMs } from '@application/persistence/save-migrations';
import { DEFAULT_HOLD_TO_CHOOSE_MS } from '@domain/entities/player';

const apply = (document: Record<string, unknown>): Record<string, unknown> => {
  const migrated = addHoldToChooseMs.apply(document);
  expect(migrated.ok).toBe(true);
  if (!migrated.ok) throw new Error('this step never fails');
  return migrated.value;
};

describe('1 -> 2: the switch hold time becomes a saved setting', () => {
  it('is the step this build ships, and the only one', () => {
    expect(SAVE_MIGRATIONS).toEqual([addHoldToChooseMs]);
    expect(addHoldToChooseMs.from).toBe(1);
    expect(addHoldToChooseMs.to).toBe(2);
  });

  it('gives a version-1 save the hold time the game ships with', () => {
    const migrated = apply({ version: 1, settings: { autoMove: true, singleSwitch: true } });
    expect(migrated['version']).toBe(2);
    expect(migrated['settings']).toEqual({
      autoMove: true,
      singleSwitch: true,
      holdToChooseMs: DEFAULT_HOLD_TO_CHOOSE_MS,
    });
  });

  it('does not mutate the document it was given', () => {
    const before = { version: 1, settings: { autoMove: false } };
    apply(before);
    expect(before).toEqual({ version: 1, settings: { autoMove: false } });
  });

  it('keeps a hold time that is somehow already there', () => {
    const migrated = apply({ version: 1, settings: { holdToChooseMs: 1_200 } });
    expect(migrated['settings']).toEqual({ holdToChooseMs: 1_200 });
  });

  it('replaces a hold time that is not a usable number', () => {
    for (const broken of ['1200', null, Number.NaN, {}]) {
      const migrated = apply({ version: 1, settings: { holdToChooseMs: broken } });
      expect(migrated['settings']).toEqual({ holdToChooseMs: DEFAULT_HOLD_TO_CHOOSE_MS });
    }
  });

  it('leaves settings it does not recognise exactly as they were', () => {
    // Not repaired, not dropped: the schema check that runs next says what is
    // wrong with it, in the language of a JSON pointer.
    for (const settings of [undefined, null, 'off', [], 7]) {
      const migrated = apply({ version: 1, settings });
      expect(migrated['version']).toBe(2);
      expect(migrated['settings']).toBe(settings);
    }
  });

  it('carries every other property through untouched', () => {
    const migrated = apply({
      version: 1,
      settings: {},
      levels: [{ levelId: 'ottawa' }],
      reviews: [{ questionId: 'q-1' }],
    });
    expect(migrated['levels']).toEqual([{ levelId: 'ottawa' }]);
    expect(migrated['reviews']).toEqual([{ questionId: 'q-1' }]);
  });
});
