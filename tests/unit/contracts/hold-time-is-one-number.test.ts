/**
 * The switch hold time is written down three times, and they must agree.
 *
 * `TN-SET-09`'s hold time now exists in three places by necessity:
 *
 *   - `content/schemas/progress.schema.json` — the authority on the save (ADR-0007);
 *   - `app/domain/entities/player.ts` — the clamp a loaded save is held to;
 *   - `app/ui/settings.ts` — the DOM store the settings screen edits.
 *
 * The duplication is structural rather than sloppy: `outer-layers-use-domain-vocabulary-only`
 * forbids a DOM screen from importing anything but `@domain/ids`, so the screen
 * cannot read the domain's constants and the domain must not read the screen's.
 * A comment saying "keep these in step" is exactly the kind of claim this
 * repository keeps finding to be false, so the claim is checked instead —
 * against another claim, which is what ADR-0024 recommends where no corpus can
 * be iterated.
 *
 * The failure this closes is quiet and specific: a UI whose maximum is 3 s over a
 * schema whose maximum is 2 s produces a settings screen that offers a value the
 * save refuses, and the player's choice is silently reverted on the next reload —
 * for the one user group least able to work around it.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_HOLD_TO_CHOOSE_MS,
  MAX_HOLD_TO_CHOOSE_MS,
  MIN_HOLD_TO_CHOOSE_MS,
} from '@domain/entities/player';
import {
  HOLD_TIME_CHOICES,
  HOLD_TO_CHOOSE_DEFAULT_MS,
  HOLD_TO_CHOOSE_MAX_MS,
  HOLD_TO_CHOOSE_MIN_MS,
} from '@ui/settings';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const schema = JSON.parse(
  readFileSync(`${REPO_ROOT}content/schemas/progress.schema.json`, 'utf8'),
) as {
  readonly $defs: {
    readonly settings: {
      readonly properties: Record<string, { readonly type?: string; readonly minimum?: number; readonly maximum?: number }>;
      readonly required: readonly string[];
    };
  };
};

const holdToChooseMs = schema.$defs.settings.properties['holdToChooseMs'];

describe('the schema, the domain and the settings screen agree', () => {
  it('is a saved property at all, which it was not before save version 2', () => {
    expect(holdToChooseMs).toBeDefined();
    expect(schema.$defs.settings.required).toContain('holdToChooseMs');
  });

  it('has the same bounds in the schema as in the domain clamp', () => {
    expect(holdToChooseMs?.minimum).toBe(MIN_HOLD_TO_CHOOSE_MS);
    expect(holdToChooseMs?.maximum).toBe(MAX_HOLD_TO_CHOOSE_MS);
    // An integer in the schema is why the domain rounds as well as clamps.
    expect(holdToChooseMs?.type).toBe('integer');
  });

  it('has the same bounds and default in the settings screen as in the domain', () => {
    expect(HOLD_TO_CHOOSE_MIN_MS).toBe(MIN_HOLD_TO_CHOOSE_MS);
    expect(HOLD_TO_CHOOSE_MAX_MS).toBe(MAX_HOLD_TO_CHOOSE_MS);
    expect(HOLD_TO_CHOOSE_DEFAULT_MS).toBe(DEFAULT_HOLD_TO_CHOOSE_MS);
  });

  it('offers no named choice the save would refuse', () => {
    expect(HOLD_TIME_CHOICES.length).toBeGreaterThan(0);
    for (const choice of HOLD_TIME_CHOICES) {
      expect(Number.isInteger(choice.ms)).toBe(true);
      expect(choice.ms).toBeGreaterThanOrEqual(MIN_HOLD_TO_CHOOSE_MS);
      expect(choice.ms).toBeLessThanOrEqual(MAX_HOLD_TO_CHOOSE_MS);
    }
  });
});
