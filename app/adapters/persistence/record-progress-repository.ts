/**
 * `ProgressRepository` over a `RecordStore` — the rules, once, for both backends.
 *
 * The adapter holds the store and the record key. It holds no format knowledge:
 * the bytes are produced and validated by a `SaveCodec`, injected, so the same
 * defence protects a file the player imported, a value that has been sitting in
 * this browser since an older build, and a record read out of IndexedDB.
 *
 * One key, versioned in its *value* and not in its name (OQ-SAVE-5): a migration
 * that renamed the key would orphan the previous one and quietly lose the save
 * it was migrating. That was true of `localStorage` and it is true of an
 * IndexedDB record; ADR-0026 keeps the property while changing the store under
 * it. TN-SAVE-01 asserts the game owns exactly one key.
 *
 * Nothing here throws. Quota, private mode and a corrupt value are all expected
 * outcomes of a browser, and they arrive as `Result` errors:
 *   - `ok(null)`      no save yet — not an error, no warning (TN-SAVE-05);
 *   - `io`            storage refused or is unavailable (TN-SAVE-05);
 *   - `invalid`       the value is not a save, with the raw bytes in `details`
 *                     so the error screen can offer "Download the old file"
 *                     (TN-SAVE-04) — and it is *not* deleted, because that
 *                     choice is the player's.
 */

import { appErr, ok } from '@common/result';
import type { Result } from '@common/result';
import type { ProgressRepository, ProgressSnapshot } from '@application/ports/progress-repository';
import type { SaveCodec } from '@application/ports/save-codec';

import type { RecordStore } from '@adapters/persistence/record-store';

/** The one key this game owns, in whichever store is holding it. */
export const PROGRESS_STORAGE_KEY = 'truenorth.progress';

export interface RecordProgressRepositoryOptions {
  /** `null` when the browser will not give us this store at all. */
  readonly store: RecordStore | null;
  readonly codec: SaveCodec;
  readonly key?: string;
}

const unavailable = (): Result<never> =>
  appErr('io', 'save.storage.unavailable', 'This browser is not saving progress.', {});

export const createRecordProgressRepository = (
  options: RecordProgressRepositoryOptions,
): ProgressRepository => {
  const { store, codec } = options;
  const key = options.key ?? PROGRESS_STORAGE_KEY;

  return {
    async load(): Promise<Result<ProgressSnapshot | null>> {
      if (store === null) return unavailable();
      const raw = await store.read(key);
      /*
       * A read that failed is returned as it came. It is emphatically NOT turned
       * into `ok(null)`: "the store would not answer" and "there is no save" are
       * different states, and conflating them offers the player a new game over
       * the top of one they already have (ADR-0024, ADR-0026).
       */
      if (!raw.ok) return raw;
      if (raw.value === null) return ok(null);

      const decoded = codec.decode(raw.value);
      if (decoded.ok) return ok(decoded.value);
      return {
        ok: false,
        error: {
          ...decoded.error,
          details: {
            ...decoded.error.details,
            key,
            // The bytes as found, so "Download the old file" can offer exactly
            // what was stored. Nothing is written and nothing is deleted.
            raw: raw.value,
          },
        },
      };
    },

    async save(snapshot: ProgressSnapshot): Promise<Result<void>> {
      if (store === null) return unavailable();
      const encoded = codec.encode(snapshot);
      if (!encoded.ok) return encoded;
      return store.write(key, encoded.value);
    },

    async clear(): Promise<Result<void>> {
      if (store === null) return unavailable();
      return store.remove(key);
    },
  };
};
