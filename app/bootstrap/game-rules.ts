/**
 * The half of `content/game.config.json` the *game* reads, as opposed to the
 * half the renderer reads.
 *
 * `parseBootConfig` (`app/adapters/phaser`) validates what a canvas needs:
 * design resolution, palette, graphics presets, locomotion vocabulary. It
 * deliberately carries none of `unlockRules`, `save` or `study`, because "which
 * levels are open" is progression and progression is not a renderer's business.
 * So the composition root reads those itself, and this file is that read.
 *
 * It is a *shape* check, not a second schema. `content/schemas/game.config.schema.json`
 * is the authority and `make validate-content` runs it in CI (ADR-0007); what is
 * checked here is only what would make the artefact behave wrongly rather than
 * loudly — a `stampsToUnlockNext` that is a string, an `unlockRules` block that
 * is missing entirely — because a config defect that reaches a player as a blank
 * map is worse than one that reaches a developer as a boot failure.
 *
 * An **empty** `order` is not a defect and does not fail: `TN-MAP-06` requires a
 * build with no levels to draw ten cards and no error, and a game whose config
 * has not named the journey yet is exactly that build. A **missing** `journey`
 * is a different thing and does fail: an empty list is a build with no levels,
 * an absent one is a map with no places to draw, and the second is the blank
 * screen this file exists to turn into a boot failure.
 */

import { appErr, ok, type Result } from '@common/result';
import type { Journey, UnlockRules } from '@domain/entities/level';
import type { LevelId } from '@domain/ids';

export interface GameRules {
  /** `#/unlockRules` — the unlock order, and only that. */
  readonly unlockRules: UnlockRules;
  /**
   * `#/journey` — the ten places the map draws, in map order, `null` where the
   * id is not fixed.
   *
   * Read separately from `unlockRules.order` because they are separate facts:
   * this is the game's shape, that is its progression. They were one key until
   * the chain died of it — see `Journey` in `@domain/entities/level`.
   */
  readonly journey: Journey;
  /** `#/save/maxImportBytes`. Read, never hardcoded (`OQ-SAVE-3`). */
  readonly maxImportBytes: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Every string in the array, branded.
 *
 * The cast is the one ADR-0005 allows: ids travel as plain strings in JSON and
 * become branded exactly once, immediately after the shape has been checked, in
 * a layer that is allowed to name concretes. Nothing downstream casts again.
 */
const levelIds = (value: unknown): readonly LevelId[] | null => {
  if (!Array.isArray(value)) return null;
  if (!value.every((entry) => typeof entry === 'string')) return null;
  return value as unknown as readonly LevelId[];
};

/**
 * The map's slots. `null` is a place whose id is not fixed (levels 2 and 10),
 * not a hole and not a defect — `TN-MAP-04` forbids a placeholder in that space,
 * so the slot travels as an absence all the way to the card.
 */
const journeySlots = (value: unknown): Journey | null => {
  if (!Array.isArray(value)) return null;
  if (!value.every((slot) => slot === null || typeof slot === 'string')) return null;
  return value as unknown as Journey;
};

export function readGameRules(document: unknown): Result<GameRules> {
  if (!isRecord(document)) {
    return appErr('invalid', 'config.notAnObject', 'game.config.json is not an object.', {});
  }

  const rules = document['unlockRules'];
  if (!isRecord(rules)) {
    return appErr(
      'invalid',
      'config.unlockRules.missing',
      'game.config.json has no unlockRules block, so no level can ever be opened.',
      {},
    );
  }

  const order = levelIds(rules['order']);
  const initialLevels = levelIds(rules['initialLevels']);
  const cost = rules['stampsToUnlockNext'];
  if (order === null || initialLevels === null || typeof cost !== 'number') {
    return appErr(
      'invalid',
      'config.unlockRules.malformed',
      'unlockRules needs `order` and `initialLevels` as arrays of level ids and ' +
        '`stampsToUnlockNext` as a number.',
      {},
    );
  }

  const journey = journeySlots(document['journey']);
  if (journey === null) {
    return appErr(
      'invalid',
      'config.journey.malformed',
      'game.config.json needs `journey`: the places the map draws, in map order, ' +
        'each a level id or null where the id is not fixed. Without it the map has ' +
        'no places to number.',
      {},
    );
  }

  const save = document['save'];
  const maxImportBytes = isRecord(save) ? save['maxImportBytes'] : undefined;
  if (typeof maxImportBytes !== 'number') {
    return appErr(
      'invalid',
      'config.save.malformed',
      'save.maxImportBytes is the cap an imported file is refused above; it must be a number.',
      {},
    );
  }

  return ok({
    unlockRules: { initialLevels, order, stampsToUnlockNext: cost },
    journey,
    maxImportBytes,
  });
}
