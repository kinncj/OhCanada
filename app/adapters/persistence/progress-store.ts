/**
 * Choosing a store, carrying an existing save into it, and admitting when
 * neither store will have us (ADR-0026).
 *
 * This is the only place that knows there are two backends. Everything above it
 * gets one `ProgressRepository`; everything below it is a `RecordStore`.
 *
 * The order is deliberate and each step exists because of a way a save is lost:
 *
 *  1. **Open IndexedDB.** If it will not open — a private window, a blocked
 *     origin, an evicted database — fall back to `localStorage`. If neither
 *     works, hand back a repository that reports `io` on every call and let the
 *     game run with TN-SAVE-05's warning. Nothing here stops the game.
 *  2. **Look in `localStorage` before believing the player is new.** Every save
 *     written before ADR-0026 is there. An IndexedDB that is empty *because it
 *     is new* looks exactly like a player with no progress, and the difference
 *     is a whole passport.
 *  3. **Copy the bytes, verify the copy, and only then delete the original.**
 *     Not "write and hope": the write is read back and compared byte for byte
 *     before anything is removed. A migration that deletes first and fails
 *     second is worse than no migration at all.
 *  4. **A legacy store that would not answer is not an empty one.** If reading
 *     `localStorage` *threw*, we do not know whether a save is there — so a
 *     subsequent empty IndexedDB must not be reported as "new player". That is
 *     ADR-0024 applied to the one place where guessing costs a save, and it is
 *     what `legacyUnreadable` below is for.
 *
 * The bytes are copied verbatim and are not validated on the way across. That is
 * on purpose: a corrupt legacy value is still the player's, TN-SAVE-04 promises
 * them the choice of downloading it, and a migration that dropped what it could
 * not parse would take that choice away before they were asked. Validation
 * happens on `load`, where it always did.
 */

import type { AppError } from '@common/result';
import { appErr } from '@common/result';
import type { Result } from '@common/result';
import type { ProgressRepository, ProgressSnapshot } from '@application/ports/progress-repository';
import type { SaveCodec } from '@application/ports/save-codec';

import { openIndexedDbRecordStore } from '@adapters/persistence/indexed-db';
import type { IndexedDbFactory } from '@adapters/persistence/indexed-db';
import {
  PROGRESS_STORAGE_KEY,
  createRecordProgressRepository,
} from '@adapters/persistence/record-progress-repository';
import type { RecordStore } from '@adapters/persistence/record-store';
import { createWebStorageRecordStore } from '@adapters/persistence/web-storage-record-store';
import type { WebStorage } from '@adapters/persistence/web-storage';

/** Where this session's progress is being kept. `none` means nowhere. */
export type StorageBackend = 'indexeddb' | 'localstorage' | 'none';

/**
 * What happened to a save found in `localStorage`.
 *
 * Reported rather than logged: the composition root decides what to say, and a
 * migration that quietly did nothing is indistinguishable from one that quietly
 * failed unless it says which.
 */
export type MigrationReport =
  /** IndexedDB is in use and `localStorage` held no save. The ordinary new-player case. */
  | { readonly status: 'not-needed' }
  /** There was nothing to migrate between: one of the two stores is unavailable. */
  | { readonly status: 'not-applicable'; readonly reason: 'no-indexeddb' | 'no-localstorage' }
  /** IndexedDB already holds a save, so the older copy was left exactly where it is. */
  | { readonly status: 'kept'; readonly reason: 'indexeddb-already-has-a-save' }
  /** The save is now in IndexedDB, verified by reading it back. */
  | { readonly status: 'carried'; readonly bytes: number; readonly originalRemoved: boolean }
  /** Nothing was moved and nothing was destroyed. The original is untouched. */
  | { readonly status: 'failed'; readonly error: AppError };

export interface ProgressStore {
  readonly repository: ProgressRepository;
  readonly backend: StorageBackend;
  readonly migration: MigrationReport;
  /** True when nothing will be remembered — TN-SAVE-05's warning, and only then. */
  readonly blocked: boolean;
  /** Release the IndexedDB handle. Safe to call more than once. */
  close(): void;
}

export interface OpenProgressStoreOptions {
  /** `browserIndexedDb()`, or `null` where the browser has none. */
  readonly indexedDb: IndexedDbFactory | null;
  /** `browserLocalStorage()`, or `null`. Read for migration even when unused for storage. */
  readonly localStorage: WebStorage | null;
  readonly codec: SaveCodec;
  readonly key?: string;
  readonly databaseName?: string;
  readonly storeName?: string;
}

/**
 * Copy one record from `legacy` into `next`, verifying before destroying.
 *
 * Returns the report. The only path that removes anything is the one where the
 * copy has already been read back and matched.
 */
const carryOver = async (
  legacy: RecordStore,
  next: RecordStore,
  key: string,
): Promise<{ readonly report: MigrationReport; readonly legacyUnreadable: boolean }> => {
  const found = await legacy.read(key);
  if (!found.ok) {
    // We do not know whether a save is there. That uncertainty is carried
    // forward as `legacyUnreadable` so an empty IndexedDB cannot be reported as
    // "no save yet" (ADR-0024).
    return { report: { status: 'failed', error: found.error }, legacyUnreadable: true };
  }
  if (found.value === null) return { report: { status: 'not-needed' }, legacyUnreadable: false };

  const existing = await next.read(key);
  if (!existing.ok) {
    return { report: { status: 'failed', error: existing.error }, legacyUnreadable: false };
  }
  if (existing.value !== null) {
    /*
     * Both stores hold a save. The IndexedDB one is the newer store and wins;
     * the older copy stays where it is rather than being deleted, because a
     * player who moves back to a build without IndexedDB should still find
     * something, and because deleting the loser of a conflict we did not ask
     * anyone about is not this function's call.
     */
    return {
      report: { status: 'kept', reason: 'indexeddb-already-has-a-save' },
      legacyUnreadable: false,
    };
  }

  const written = await next.write(key, found.value);
  if (!written.ok) {
    return { report: { status: 'failed', error: written.error }, legacyUnreadable: false };
  }

  // Read back before removing. A write that resolved is not the same as a
  // record that is there: the transaction may have completed against a database
  // that is about to be evicted, and the comparison costs one read of a document
  // measured in kilobytes.
  const readBack = await next.read(key);
  if (!readBack.ok) {
    return { report: { status: 'failed', error: readBack.error }, legacyUnreadable: false };
  }
  if (readBack.value !== found.value) {
    return {
      report: {
        status: 'failed',
        error: appErr(
          'io',
          'save.migration.mismatch',
          'The copied save did not read back as it was written.',
          { key, wrote: found.value.length, readBack: readBack.value?.length ?? null },
        ).error,
      },
      legacyUnreadable: false,
    };
  }

  const removed = await legacy.remove(key);
  return {
    report: { status: 'carried', bytes: found.value.length, originalRemoved: removed.ok },
    legacyUnreadable: false,
  };
};

/**
 * Wrap the repository so that "no save yet" cannot be invented out of a legacy
 * store we failed to read.
 *
 * The guard lifts as soon as a write succeeds: from that moment the state of the
 * unreadable store no longer matters, because the player has one here.
 */
const guardEmptyReads = (inner: ProgressRepository, error: AppError): ProgressRepository => {
  let guarded = true;
  return {
    async load(): Promise<Result<ProgressSnapshot | null>> {
      const loaded = await inner.load();
      if (!guarded) return loaded;
      if (loaded.ok && loaded.value === null) {
        return appErr(
          'io',
          'save.migration.legacyUnreadable',
          'An older save may exist in this browser and could not be read, so this is not a new player.',
          { ...error.details, because: error.code },
        );
      }
      return loaded;
    },
    async save(snapshot: ProgressSnapshot): Promise<Result<void>> {
      const written = await inner.save(snapshot);
      if (written.ok) guarded = false;
      return written;
    },
    async clear(): Promise<Result<void>> {
      const cleared = await inner.clear();
      if (cleared.ok) guarded = false;
      return cleared;
    },
  };
};

/**
 * Clear both stores, so "delete my progress" deletes it everywhere it could
 * still be found.
 *
 * Both are attempted whatever the first one answers: stopping at the first
 * failure would leave a copy behind in the store that *did* work, and a save the
 * player asked to destroy coming back on the next boot is the worst possible
 * shape of this bug.
 */
const clearBoth = (inner: ProgressRepository, legacy: RecordStore | null, key: string): ProgressRepository => ({
  load: inner.load.bind(inner),
  save: inner.save.bind(inner),
  async clear(): Promise<Result<void>> {
    const cleared = await inner.clear();
    if (legacy === null) return cleared;
    const legacyCleared = await legacy.remove(key);
    return cleared.ok ? legacyCleared : cleared;
  },
});

/** Open the best store this browser offers, carrying an existing save into it. */
export const openProgressStore = async (
  options: OpenProgressStoreOptions,
): Promise<ProgressStore> => {
  const key = options.key ?? PROGRESS_STORAGE_KEY;
  const legacy = createWebStorageRecordStore(options.localStorage);
  const indexedDb = await openIndexedDbRecordStore({
    factory: options.indexedDb,
    ...(options.databaseName === undefined ? {} : { databaseName: options.databaseName }),
    ...(options.storeName === undefined ? {} : { storeName: options.storeName }),
  });

  if (indexedDb === null) {
    // No IndexedDB. `localStorage` keeps the game remembering; if that is gone
    // too, the repository answers `io` on every call and the game still runs.
    const repository = createRecordProgressRepository({ store: legacy, codec: options.codec, key });
    return {
      repository,
      backend: legacy === null ? 'none' : 'localstorage',
      migration: { status: 'not-applicable', reason: 'no-indexeddb' },
      blocked: legacy === null,
      close: () => undefined,
    };
  }

  const migration =
    legacy === null
      ? {
          report: { status: 'not-applicable', reason: 'no-localstorage' } as MigrationReport,
          legacyUnreadable: false,
        }
      : await carryOver(legacy, indexedDb, key);

  const base = clearBoth(
    createRecordProgressRepository({ store: indexedDb, codec: options.codec, key }),
    legacy,
    key,
  );
  const repository =
    migration.legacyUnreadable && migration.report.status === 'failed'
      ? guardEmptyReads(base, migration.report.error)
      : base;

  return {
    repository,
    backend: 'indexeddb',
    migration: migration.report,
    blocked: false,
    close: () => {
      indexedDb.close();
    },
  };
};
