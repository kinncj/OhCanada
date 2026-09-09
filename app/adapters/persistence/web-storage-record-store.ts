/**
 * `localStorage` as a `RecordStore`.
 *
 * The wrapper is three methods long and it is not ceremony: it is what lets the
 * repository rules be written once and run over both backends, so "IndexedDB
 * behaves differently from localStorage" can only be true where this file and
 * `indexed-db.ts` differ — which is exactly where the difference belongs.
 *
 * The promises resolve immediately because `localStorage` is synchronous. That
 * is the API's whole problem (it blocks the main thread, ADR-0026) and is not a
 * property worth preserving in the seam: an interface that is async only where
 * one implementation needs it would push every caller back into two code paths.
 */

import { appErr, ok } from '@common/result';
import type { Result } from '@common/result';

import type { RecordStore } from '@adapters/persistence/record-store';
import type { WebStorage } from '@adapters/persistence/web-storage';

/** `null` in, `null` out: a browser that will not give us storage cannot be wrapped. */
export const createWebStorageRecordStore = (storage: WebStorage | null): RecordStore | null => {
  if (storage === null) return null;
  return {
    read(key: string): Promise<Result<string | null>> {
      try {
        // `getItem` answers `null` for an absent key, which is this port's
        // "no save yet" — and the `catch` below is the other case, which stays
        // an error rather than joining it (ADR-0024).
        return Promise.resolve(ok(storage.getItem(key)));
      } catch (cause) {
        return Promise.resolve(
          appErr('io', 'save.storage.readFailed', 'Storage refused to be read.', { key }, cause),
        );
      }
    },

    write(key: string, value: string): Promise<Result<void>> {
      try {
        storage.setItem(key, value);
        // Synchronous: by the time `setItem` returns, the bytes are durable.
        return Promise.resolve(ok());
      } catch (cause) {
        // Quota is the common one. TN-SAVE-05 wants a warning and a game that
        // keeps running, so this is a value and not a throw.
        return Promise.resolve(
          appErr(
            'io',
            'save.storage.writeFailed',
            'Storage refused the write.',
            { key, bytes: value.length },
            cause,
          ),
        );
      }
    },

    remove(key: string): Promise<Result<void>> {
      try {
        storage.removeItem(key);
        return Promise.resolve(ok());
      } catch (cause) {
        return Promise.resolve(
          appErr('io', 'save.storage.clearFailed', 'Storage refused to be cleared.', { key }, cause),
        );
      }
    },

    close(): void {
      // `localStorage` holds no handle to release.
    },
  };
};
