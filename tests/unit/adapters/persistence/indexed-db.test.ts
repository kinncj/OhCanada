/**
 * The IndexedDB record store: promises out of events, values out of failures,
 * and the two distinctions ADR-0026 turns on.
 *
 *  - **A store that would not answer is not an empty store.** The read that
 *    throws is the test, not the read that finds nothing; both would satisfy a
 *    suite that only checked "no save" (ADR-0024).
 *  - **A queued write is not a saved game.** The commit cases below let the
 *    request succeed — the record is genuinely in the fake's map — and then fail
 *    the transaction. An adapter that resolved on `success` would report a save
 *    the browser is about to throw away, and every one of those cases would pass.
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
  SAVE_STORE_NAME,
  browserIndexedDb,
  openIndexedDbRecordStore,
} from '@adapters/persistence/indexed-db';
import type { IndexedDbFactory, RecordStore } from '@adapters/persistence';

import { fakeIndexedDb } from '../../support/fake-indexed-db';
import type { FakeIndexedDbFailures } from '../../support/fake-indexed-db';

const KEY = 'truenorth.progress';

const openStore = async (
  failures: FakeIndexedDbFailures = {},
  seed: Iterable<readonly [string, unknown]> = [],
): Promise<{ readonly store: RecordStore; readonly db: ReturnType<typeof fakeIndexedDb> }> => {
  const db = fakeIndexedDb(failures, seed);
  const store = await openIndexedDbRecordStore({ factory: db });
  if (store === null) throw new Error('this fake was supposed to open');
  return { store, db };
};

describe('opening', () => {
  it('creates the object store the first time and reuses it after', async () => {
    const db = fakeIndexedDb();
    const first = await openIndexedDbRecordStore({ factory: db });
    expect(first).not.toBeNull();
    const second = await openIndexedDbRecordStore({ factory: db });
    expect(second).not.toBeNull();
    expect(db.stats.opens).toBe(2);
  });

  it('answers null rather than throwing when there is no IndexedDB at all', async () => {
    expect(await openIndexedDbRecordStore({ factory: null })).toBeNull();
  });

  it('answers null when open() throws, as older Safari does in a private window', async () => {
    expect(await openIndexedDbRecordStore({ factory: fakeIndexedDb({ open: 'throw' }) })).toBeNull();
  });

  it('answers null when open() errors, as Firefox does in a private window', async () => {
    expect(await openIndexedDbRecordStore({ factory: fakeIndexedDb({ open: 'error' }) })).toBeNull();
  });

  it('answers null when the upgrade cannot create the store', async () => {
    expect(
      await openIndexedDbRecordStore({ factory: fakeIndexedDb({ createStore: true }) }),
    ).toBeNull();
  });

  it('honours the names the composition root chose', async () => {
    const db = fakeIndexedDb();
    const store = await openIndexedDbRecordStore({
      factory: db,
      databaseName: 'tn-test',
      storeName: 'saves',
      databaseVersion: 3,
    });
    expect(store).not.toBeNull();
    await store?.write(KEY, 'value');
    expect(db.records.get(KEY)).toBe('value');
  });
});

describe('reading and writing', () => {
  it('gives back exactly what it stored', async () => {
    const { store } = await openStore();
    expect((await store.write(KEY, '{"version":2}')).ok).toBe(true);
    const read = await store.read(KEY);
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.value).toBe('{"version":2}');
  });

  it('reads a key that is not there as no save, which is not an error', async () => {
    const { store } = await openStore();
    const read = await store.read(KEY);
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.value).toBeNull();
  });

  it('removes the record it was asked to remove', async () => {
    const { store, db } = await openStore();
    await store.write(KEY, 'value');
    await store.write('someone-elses-key', 'not ours');
    expect((await store.remove(KEY)).ok).toBe(true);
    expect([...db.records.keys()]).toEqual(['someone-elses-key']);
  });

  it('releases the handle when closed', async () => {
    const { store, db } = await openStore();
    store.close();
    expect(db.stats.closes).toBe(1);
  });
});

describe('a store that will not answer (ADR-0024)', () => {
  it('reports a failed read as an error and never as "no save"', async () => {
    const { store } = await openStore({ read: true });
    const read = await store.read(KEY);
    expect(read.ok).toBe(false);
    if (!read.ok) {
      expect(read.error.kind).toBe('io');
      expect(read.error.code).toBe('save.storage.readFailed');
    }
  });

  it('reports a failed write', async () => {
    const { store } = await openStore({ write: true });
    const written = await store.write(KEY, 'value');
    expect(written.ok).toBe(false);
    if (!written.ok) expect(written.error.code).toBe('save.storage.writeFailed');
  });

  it('reports a failed remove', async () => {
    const { store } = await openStore({ remove: true });
    const removed = await store.remove(KEY);
    expect(removed.ok).toBe(false);
    if (!removed.ok) expect(removed.error.code).toBe('save.storage.clearFailed');
  });

  it('turns a transaction that throws into a result rather than an exception', async () => {
    const { store } = await openStore({ transaction: true });
    const read = await store.read(KEY);
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error.details).toMatchObject({ storeName: SAVE_STORE_NAME });
  });

  it('refuses a record that is not a string instead of discarding it', async () => {
    const { store } = await openStore({}, [[KEY, { version: 2 }]]);
    const read = await store.read(KEY);
    expect(read.ok).toBe(false);
    if (!read.ok) {
      expect(read.error.kind).toBe('invalid');
      expect(read.error.code).toBe('save.storage.notAString');
    }
  });
});

describe('a write is not saved until the transaction commits', () => {
  it('fails when the transaction aborts after the request succeeded', async () => {
    const { store, db } = await openStore({ commit: 'abort' });
    const written = await store.write(KEY, 'value');
    // The record really is in the store's map: the request succeeded. Reporting
    // that as a saved game is the bug this case exists for.
    expect(db.records.get(KEY)).toBe('value');
    expect(written.ok).toBe(false);
    if (!written.ok) expect(written.error.kind).toBe('io');
  });

  it('fails when the transaction errors after the request succeeded', async () => {
    const { store } = await openStore({ commit: 'error' });
    expect((await store.write(KEY, 'value')).ok).toBe(false);
  });

  it('fails a remove whose transaction never commits', async () => {
    const { store } = await openStore({ commit: 'abort' });
    expect((await store.remove(KEY)).ok).toBe(false);
  });

  it('still answers a read, which does not wait for a commit', async () => {
    const { store } = await openStore({ commit: 'abort' }, [[KEY, 'value']]);
    const read = await store.read(KEY);
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.value).toBe('value');
  });
});

describe('finding the browser IndexedDB', () => {
  const global = globalThis as { indexedDB?: unknown };
  const original = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');

  afterEach(() => {
    if (original === undefined) delete global.indexedDB;
    else Object.defineProperty(globalThis, 'indexedDB', original);
  });

  it('finds it when the browser gives it', () => {
    const db = fakeIndexedDb();
    global.indexedDB = db;
    expect(browserIndexedDb()).toBe(db as IndexedDbFactory);
  });

  it('answers null where there is none', () => {
    delete global.indexedDB;
    expect(browserIndexedDb()).toBeNull();
  });

  it('answers null when reading the property throws, without taking the game with it', () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      get() {
        throw new Error('SecurityError: storage is blocked');
      },
    });
    expect(browserIndexedDb()).toBeNull();
  });

  it('answers null when the object is there but is not an IDBFactory', () => {
    global.indexedDB = { notOpen: true };
    expect(browserIndexedDb()).toBeNull();
  });
});
