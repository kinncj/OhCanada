/**
 * The save-format migrations this build knows, and the first one that is real.
 *
 * `SaveMigration` and `migrateForward` have existed since slice 1 with an empty
 * list behind them, and `save-format-version-is-still-one.test.ts` was the
 * tripwire that said so out loud: a mechanism nothing has ever exercised on real
 * input is not a mechanism anyone should trust. Version 2 is what fires it.
 *
 * **What changed in 2.** `settings.holdToChooseMs` — TN-SET-09's single-switch
 * hold time — became a persisted property. It looks like a trivial addition and
 * it is not: `progress.schema.json` is `additionalProperties: false` with every
 * declared property required, so a version-1 document is *invalid* against the
 * version-2 schema. Widening the schema to make the property optional would have
 * made both documents valid and both readers guess, which is how "a save that
 * half-loads" starts. A version and a migration say the same thing without
 * guessing.
 *
 * **Where these are wired.** The composition root passes this list to
 * `createJsonSaveCodec`; the codec defaults to no migrations. That is deliberate
 * and the tripwire asked for it: the version numbers and the steps between them
 * belong where the build is assembled, not defaulted inside the thing whose job
 * is to apply them. A test that wants to decode a version-1 document has to say
 * so by passing this list, which is exactly the visibility that was wanted.
 *
 * **What a migration may assume: nothing.** It runs *before* the schema check
 * (`json-save-codec.ts` step 4 of 5), on a document that has been parsed and
 * version-gated and nothing more. So every step below inspects what it touches
 * and leaves anything it does not understand exactly as it found it, letting
 * `validateProgressDocument` produce the error message. A migration that threw,
 * or that "repaired" a document it had not understood, would turn a readable
 * failure into a lost save.
 */

import { ok } from '@common/result';
import type { Result } from '@common/result';

import { DEFAULT_HOLD_TO_CHOOSE_MS } from '@domain/entities/player';
import type { SaveMigration } from '@application/persistence/json-save-codec';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * 1 -> 2: a switch user's hold time stops being forgotten between sessions.
 *
 * A version-1 save cannot carry the field, so the value it gets is the one the
 * game ships with. That is a real loss for the player who had set two seconds
 * before this build — it is unrecoverable, the number was never written down —
 * and it is stated here rather than glossed, because "the migration restored
 * their setting" would be false.
 */
export const addHoldToChooseMs: SaveMigration = {
  from: 1,
  to: 2,
  apply: (document: Readonly<Record<string, unknown>>): Result<Record<string, unknown>> => {
    const next = { ...document, version: 2 };
    const settings = document['settings'];
    if (!isPlainObject(settings)) {
      // Not a shape this step understands. Untouched, and the schema check that
      // runs next says what is wrong with it in the language of a JSON pointer.
      return ok(next);
    }
    const existing = settings['holdToChooseMs'];
    return ok({
      ...next,
      settings: {
        ...settings,
        holdToChooseMs:
          typeof existing === 'number' && Number.isFinite(existing)
            ? existing
            : DEFAULT_HOLD_TO_CHOOSE_MS,
      },
    });
  },
};

/**
 * Every step this build can take, oldest first.
 *
 * `migrateForward` looks steps up by their `from`, so order is documentation
 * rather than mechanism — but a list a person can read top to bottom is how the
 * next author sees that 1 -> 2 exists before writing 2 -> 3.
 */
export const SAVE_MIGRATIONS: readonly SaveMigration[] = [addHoldToChooseMs];
