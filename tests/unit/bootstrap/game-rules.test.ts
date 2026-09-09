/**
 * `readGameRules`: the progression half of `content/game.config.json`, and the
 * two lists it carries.
 *
 * The lists are separate on purpose and this suite is where that separation is
 * first visible in code: `journey` is the ten places the map draws, in map
 * order, and `unlockRules.order` is the sequence a player unlocks levels in.
 * A parser that folded one into the other would put the defect back.
 */

import { describe, expect, it } from 'vitest';

/* Relative, not aliased: there is no `@bootstrap` alias and adding one means
   editing three configs that have to agree (tsconfig, vite, vitest). */
import { readGameRules } from '../../../app/bootstrap/game-rules';

const config = (patch: Record<string, unknown> = {}): Record<string, unknown> => ({
  journey: ['halifax', null, 'quebec-city', 'ottawa'],
  unlockRules: { initialLevels: ['ottawa'], order: ['ottawa', 'quebec-city'], stampsToUnlockNext: 1 },
  save: { maxImportBytes: 1024 },
  ...patch,
});

describe('reading the progression half of the config', () => {
  it('reads the two lists separately, and keeps the unnamed places', () => {
    const parsed = readGameRules(config());

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.journey).toEqual(['halifax', null, 'quebec-city', 'ottawa']);
    expect(parsed.value.unlockRules.order).toEqual(['ottawa', 'quebec-city']);
    expect(parsed.value.maxImportBytes).toBe(1024);
  });

  it('accepts a journey nobody has written yet, and draws no conclusion from it', () => {
    /* `TN-MAP-06`: a build with no levels draws ten cards and no error. */
    const parsed = readGameRules(config({ journey: [] }));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.journey).toEqual([]);
  });

  it('refuses a config with no journey, because the map would have no places', () => {
    const { journey: _unused, ...rest } = config();
    const parsed = readGameRules(rest);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error.code).toBe('config.journey.malformed');
  });

  it('refuses a journey whose slots are neither an id nor an empty place', () => {
    const parsed = readGameRules(config({ journey: ['halifax', 3] }));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error.code).toBe('config.journey.malformed');
  });

  it('refuses a document that is not an object at all', () => {
    expect(readGameRules('a string').ok).toBe(false);
    expect(readGameRules(null).ok).toBe(false);
  });

  it('refuses a config with no unlockRules, naming what it costs the player', () => {
    const { unlockRules: _unused, ...rest } = config();
    const parsed = readGameRules(rest);

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error.code).toBe('config.unlockRules.missing');
  });

  it('refuses unlockRules whose lists are not lists of ids', () => {
    const parsed = readGameRules(
      config({ unlockRules: { initialLevels: 'ottawa', order: [], stampsToUnlockNext: 1 } }),
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error.code).toBe('config.unlockRules.malformed');
  });

  it('refuses a save cap that is not a number, rather than inventing one', () => {
    const parsed = readGameRules(config({ save: {} }));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error.code).toBe('config.save.malformed');
  });
});
