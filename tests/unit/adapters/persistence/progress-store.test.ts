/**
 * Choosing a store and carrying a save into it (ADR-0026).
 *
 * Four things are proved here and each of them is a way a save is lost:
 *
 *  1. **A private window still plays.** IndexedDB refuses; `localStorage` takes
 *     over; the game never sees an exception. When both refuse, every call is an
 *     `io` error and the warning is TN-SAVE-05's, not a crash.
 *  2. **An existing save survives the move.** The bytes are copied, read back,
 *     compared, and only then is the original removed — and the mismatch case
 *     below is what shows the "only then" is real rather than described.
 *  3. **An unreadable legacy store is not an empty one.** The test that matters
 *     makes `localStorage` *throw*, not be empty: an empty IndexedDB after a
 *     failed legacy read must not read as "new player" (ADR-0024).
 *  4. **Deleting progress deletes it everywhere**, or the copy left behind comes
 *     back on the next boot.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { openProgressStore } from '@adapters/persistence/progress-store';
import { PROGRESS_STORAGE_KEY } from '@adapters/persistence/record-progress-repository';
import { createJsonSaveCodec } from '@application/persistence/json-save-codec';
import { toProgressSnapshot } from '@application/persistence/progress-document';
import type { ProgressSnapshot } from '@application/ports/progress-repository';

import { ORIGIN, emptyProgress, memoryStorage } from '../../support/fixtures';
import { fakeIndexedDb } from '../../support/fake-indexed-db';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const config = JSON.parse(readFileSync(`${REPO_ROOT}content/game.config.json`, 'utf8')) as {
  readonly save: { readonly maxImportBytes: number };
};

const codec = createJsonSaveCodec({ maxImportBytes: config.save.maxImportBytes });

const snapshot = (): ProgressSnapshot => {
  const written = toProgressSnapshot(emptyProgress(), { version: codec.version, updatedAt: ORIGIN });
  if (!written.ok) throw new Error('the fixture must be encodable');
  return written.value;
};

/** The bytes an older build would have left in `localStorage`. */
const savedBytes = (): string => {
  const encoded = codec.encode(snapshot());
  if (!encoded.ok) throw new Error('the fixture must be encodable');
  return encoded.value;
};

describe('choosing a store', () => {
  it('uses IndexedDB when the browser has it', async () => {
    const store = await openProgressStore({
      indexedDb: fakeIndexedDb(),
      localStorage: memoryStorage(),
      codec,
    });
    expect(store.backend).toBe('indexeddb');
    expect(store.blocked).toBe(false);
    expect(store.migration).toEqual({ status: 'not-needed' });

    expect((await store.repository.save(snapshot())).ok).toBe(true);
    const loaded = await store.repository.load();
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.value).toEqual(snapshot());
  });

  it('falls back to localStorage in a private window, and still remembers', async () => {
    const storage = memoryStorage();
    const store = await openProgressStore({
      // Firefox's private mode: `open()` fires an error rather than succeeding.
      indexedDb: fakeIndexedDb({ open: 'error' }),
      localStorage: storage,
      codec,
    });
    expect(store.backend).toBe('localstorage');
    expect(store.blocked).toBe(false);
    expect(store.migration).toEqual({ status: 'not-applicable', reason: 'no-indexeddb' });

    expect((await store.repository.save(snapshot())).ok).toBe(true);
    expect([...storage.entries.keys()]).toEqual([PROGRESS_STORAGE_KEY]);
    const loaded = await store.repository.load();
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.value).toEqual(snapshot());
  });

  it('falls back when IndexedDB throws on open, as older Safari does', async () => {
    const store = await openProgressStore({
      indexedDb: fakeIndexedDb({ open: 'throw' }),
      localStorage: memoryStorage(),
      codec,
    });
    expect(store.backend).toBe('localstorage');
  });

  it('reports every call as an error, and none as a crash, when neither store will have us', async () => {
    const store = await openProgressStore({ indexedDb: null, localStorage: null, codec });
    expect(store.backend).toBe('none');
    expect(store.blocked).toBe(true);
    for (const result of [
      await store.repository.load(),
      await store.repository.save(snapshot()),
      await store.repository.clear(),
    ]) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('save.storage.unavailable');
    }
    // Closing a store that was never opened is safe.
    expect(() => {
      store.close();
    }).not.toThrow();
  });

  it('has nothing to migrate when the browser gives IndexedDB and no localStorage', async () => {
    const store = await openProgressStore({
      indexedDb: fakeIndexedDb(),
      localStorage: null,
      codec,
    });
    expect(store.backend).toBe('indexeddb');
    expect(store.migration).toEqual({ status: 'not-applicable', reason: 'no-localstorage' });
  });

  it('releases the IndexedDB handle when closed', async () => {
    const db = fakeIndexedDb();
    const store = await openProgressStore({ indexedDb: db, localStorage: null, codec });
    store.close();
    expect(db.stats.closes).toBe(1);
  });
});

describe('carrying an existing save across', () => {
  it('copies the save, verifies the copy, and only then removes the original', async () => {
    const storage = memoryStorage();
    storage.entries.set(PROGRESS_STORAGE_KEY, savedBytes());
    const db = fakeIndexedDb();

    const store = await openProgressStore({ indexedDb: db, localStorage: storage, codec });
    expect(store.migration).toEqual({
      status: 'carried',
      bytes: savedBytes().length,
      originalRemoved: true,
    });
    expect(db.records.get(PROGRESS_STORAGE_KEY)).toBe(savedBytes());
    expect(storage.entries.has(PROGRESS_STORAGE_KEY)).toBe(false);

    const loaded = await store.repository.load();
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.value).toEqual(snapshot());
  });

  it('leaves the original alone when the copy does not read back as it was written', async () => {
    const storage = memoryStorage();
    storage.entries.set(PROGRESS_STORAGE_KEY, savedBytes());

    const store = await openProgressStore({
      indexedDb: fakeIndexedDb({ mangleWrite: true }),
      localStorage: storage,
      codec,
    });
    expect(store.migration.status).toBe('failed');
    if (store.migration.status === 'failed') {
      expect(store.migration.error.code).toBe('save.migration.mismatch');
    }
    // The passport is still where the player left it.
    expect(storage.entries.get(PROGRESS_STORAGE_KEY)).toBe(savedBytes());
  });

  it('leaves the original alone when the copy cannot be written at all', async () => {
    const storage = memoryStorage();
    storage.entries.set(PROGRESS_STORAGE_KEY, savedBytes());

    const store = await openProgressStore({
      indexedDb: fakeIndexedDb({ write: true }),
      localStorage: storage,
      codec,
    });
    expect(store.migration.status).toBe('failed');
    expect(storage.entries.get(PROGRESS_STORAGE_KEY)).toBe(savedBytes());
  });

  it('carries a value it cannot read, because refusing it is the player\'s choice', async () => {
    // TN-SAVE-04: a corrupt save is still the player's, and they are offered the
    // download. A migration that dropped what it could not parse would take that
    // choice away before anyone was asked.
    const storage = memoryStorage();
    storage.entries.set(PROGRESS_STORAGE_KEY, '{not json');
    const db = fakeIndexedDb();

    const store = await openProgressStore({ indexedDb: db, localStorage: storage, codec });
    expect(store.migration.status).toBe('carried');
    expect(db.records.get(PROGRESS_STORAGE_KEY)).toBe('{not json');

    const loaded = await store.repository.load();
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error.details).toMatchObject({ raw: '{not json' });
  });

  it('leaves the original alone when the copy cannot be read back', async () => {
    const storage = memoryStorage();
    storage.entries.set(PROGRESS_STORAGE_KEY, savedBytes());

    const store = await openProgressStore({
      // The first read — "does IndexedDB already hold a save?" — succeeds; the
      // read back that verifies the copy is the one that fails.
      indexedDb: fakeIndexedDb({ readFrom: 2 }),
      localStorage: storage,
      codec,
    });
    expect(store.migration.status).toBe('failed');
    if (store.migration.status === 'failed') {
      expect(store.migration.error.code).toBe('save.storage.readFailed');
    }
    expect(storage.entries.get(PROGRESS_STORAGE_KEY)).toBe(savedBytes());
  });

  it('keeps the newer store when both hold a save, and destroys neither', async () => {
    const storage = memoryStorage();
    storage.entries.set(PROGRESS_STORAGE_KEY, savedBytes());
    const db = fakeIndexedDb({}, [[PROGRESS_STORAGE_KEY, savedBytes()]]);

    const store = await openProgressStore({ indexedDb: db, localStorage: storage, codec });
    expect(store.migration).toEqual({ status: 'kept', reason: 'indexeddb-already-has-a-save' });
    expect(storage.entries.get(PROGRESS_STORAGE_KEY)).toBe(savedBytes());
  });

  it('reports the migration but keeps playing when IndexedDB cannot be read', async () => {
    const storage = memoryStorage();
    storage.entries.set(PROGRESS_STORAGE_KEY, savedBytes());
    const store = await openProgressStore({
      indexedDb: fakeIndexedDb({ read: true }),
      localStorage: storage,
      codec,
    });
    expect(store.migration.status).toBe('failed');
    expect(storage.entries.get(PROGRESS_STORAGE_KEY)).toBe(savedBytes());
  });

  it('says a migration was carried out with the original left behind when the delete fails', async () => {
    const storage = memoryStorage();
    storage.entries.set(PROGRESS_STORAGE_KEY, savedBytes());
    const stubborn = {
      ...storage,
      removeItem(): void {
        throw new Error('storage clear blocked');
      },
    };
    const store = await openProgressStore({
      indexedDb: fakeIndexedDb(),
      localStorage: stubborn,
      codec,
    });
    expect(store.migration).toEqual({
      status: 'carried',
      bytes: savedBytes().length,
      originalRemoved: false,
    });
  });
});

describe('an unreadable legacy store is not an empty one (ADR-0024)', () => {
  it('refuses to report "no save yet" when localStorage would not answer', async () => {
    const store = await openProgressStore({
      indexedDb: fakeIndexedDb(),
      // Not an *empty* storage — one that throws. An empty one would prove
      // nothing: it reads as a new player because it is one.
      localStorage: memoryStorage({ read: true }),
      codec,
    });
    expect(store.migration.status).toBe('failed');

    const loaded = await store.repository.load();
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) {
      expect(loaded.error.kind).toBe('io');
      expect(loaded.error.code).toBe('save.migration.legacyUnreadable');
    }
  });

  it('reads an empty pair of stores as a new player, which is a different state', async () => {
    const store = await openProgressStore({
      indexedDb: fakeIndexedDb(),
      localStorage: memoryStorage(),
      codec,
    });
    const loaded = await store.repository.load();
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.value).toBeNull();
  });

  it('hands back the IndexedDB save rather than the warning, when there is one', async () => {
    // The guard only invents nothing; it never hides something. A save in the
    // newer store answers the question the unreadable one could not.
    const store = await openProgressStore({
      indexedDb: fakeIndexedDb({}, [[PROGRESS_STORAGE_KEY, savedBytes()]]),
      localStorage: memoryStorage({ read: true }),
      codec,
    });
    const loaded = await store.repository.load();
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.value).toEqual(snapshot());
  });

  it('stops guarding once a game has been saved here', async () => {
    const store = await openProgressStore({
      indexedDb: fakeIndexedDb(),
      localStorage: memoryStorage({ read: true }),
      codec,
    });
    expect((await store.repository.save(snapshot())).ok).toBe(true);
    const loaded = await store.repository.load();
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.value).toEqual(snapshot());

    // And an empty read after that is a new player again, not the old warning.
    expect((await store.repository.clear()).ok).toBe(true);
    const afterClear = await store.repository.load();
    expect(afterClear.ok).toBe(true);
    if (afterClear.ok) expect(afterClear.value).toBeNull();
  });

  it('keeps guarding while nothing has been written', async () => {
    const store = await openProgressStore({
      indexedDb: fakeIndexedDb(),
      localStorage: memoryStorage({ read: true }),
      codec,
    });
    expect((await store.repository.load()).ok).toBe(false);
    expect((await store.repository.load()).ok).toBe(false);
  });
});

describe('deleting progress deletes it everywhere', () => {
  it('clears both stores, so nothing comes back on the next boot', async () => {
    const storage = memoryStorage();
    const db = fakeIndexedDb({}, [[PROGRESS_STORAGE_KEY, savedBytes()]]);
    // A save in both: IndexedDB won the migration and the older copy stayed.
    storage.entries.set(PROGRESS_STORAGE_KEY, savedBytes());

    const store = await openProgressStore({ indexedDb: db, localStorage: storage, codec });
    expect((await store.repository.clear()).ok).toBe(true);
    expect(db.records.has(PROGRESS_STORAGE_KEY)).toBe(false);
    expect(storage.entries.has(PROGRESS_STORAGE_KEY)).toBe(false);
  });

  it('reports the first failure and still attempts the second store', async () => {
    const storage = memoryStorage();
    storage.entries.set(PROGRESS_STORAGE_KEY, savedBytes());
    const db = fakeIndexedDb({ remove: true }, [[PROGRESS_STORAGE_KEY, savedBytes()]]);

    const store = await openProgressStore({ indexedDb: db, localStorage: storage, codec });
    const cleared = await store.repository.clear();
    expect(cleared.ok).toBe(false);
    // The store that *could* be cleared was, rather than being skipped because
    // the first one failed.
    expect(storage.entries.has(PROGRESS_STORAGE_KEY)).toBe(false);
  });
});
