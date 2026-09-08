/**
 * `ProgressRepository` over `localStorage`.
 *
 * The adapter holds the browser API and the storage key. It holds no rules: the
 * bytes are produced and validated by a `SaveCodec`, injected, so the same
 * defence protects a file the player imported and a value that has been sitting
 * in this browser since an older build.
 *
 * One key, versioned in its *value* and not in its name (OQ-SAVE-5): a migration
 * that renamed the key would orphan the previous one and quietly lose the save
 * it was migrating. TN-SAVE-01 asserts local storage holds exactly one key for
 * this game.
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

import type { WebStorage } from '@adapters/persistence/web-storage';

/** The one key this game owns in `localStorage`. */
export const PROGRESS_STORAGE_KEY = 'truenorth.progress';

export interface LocalStorageProgressRepositoryOptions {
  /** `null` when the browser will not give us storage (private mode, blocked). */
  readonly storage: WebStorage | null;
  readonly codec: SaveCodec;
  readonly key?: string;
}

const unavailable = (): Result<never> =>
  appErr('io', 'save.storage.unavailable', 'This browser is not saving progress.', {});

export const createLocalStorageProgressRepository = (
  options: LocalStorageProgressRepositoryOptions,
): ProgressRepository => {
  const { storage, codec } = options;
  const key = options.key ?? PROGRESS_STORAGE_KEY;

  return {
    load(): Promise<Result<ProgressSnapshot | null>> {
      if (storage === null) return Promise.resolve(unavailable());
      let raw: string | null;
      try {
        raw = storage.getItem(key);
      } catch (cause) {
        return Promise.resolve(
          appErr('io', 'save.storage.readFailed', 'Storage refused to be read.', { key }, cause),
        );
      }
      if (raw === null) return Promise.resolve(ok(null));

      const decoded = codec.decode(raw);
      if (decoded.ok) return Promise.resolve(ok(decoded.value));
      return Promise.resolve({
        ok: false,
        error: {
          ...decoded.error,
          details: {
            ...decoded.error.details,
            key,
            // The bytes as found, so "Download the old file" can offer exactly
            // what was stored. Nothing is written and nothing is deleted.
            raw,
          },
        },
      });
    },

    save(snapshot: ProgressSnapshot): Promise<Result<void>> {
      if (storage === null) return Promise.resolve(unavailable());
      const encoded = codec.encode(snapshot);
      if (!encoded.ok) return Promise.resolve(encoded);
      try {
        storage.setItem(key, encoded.value);
      } catch (cause) {
        // Quota is the common one: TN-SAVE-05 wants `progress/save-failed`, a
        // warning with "Save to a file", and a game that keeps running.
        return Promise.resolve(
          appErr('io', 'save.storage.writeFailed', 'Storage refused the write.', {
            key,
            bytes: encoded.value.length,
          }, cause),
        );
      }
      return Promise.resolve(ok());
    },

    clear(): Promise<Result<void>> {
      if (storage === null) return Promise.resolve(unavailable());
      try {
        storage.removeItem(key);
      } catch (cause) {
        return Promise.resolve(
          appErr('io', 'save.storage.clearFailed', 'Storage refused to be cleared.', { key }, cause),
        );
      }
      return Promise.resolve(ok());
    },
  };
};
