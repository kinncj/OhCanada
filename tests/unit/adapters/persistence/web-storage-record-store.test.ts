/**
 * `localStorage` seen through the `RecordStore` seam.
 *
 * The repository rules are tested once, over the seam
 * (`local-storage-progress-repository.test.ts`, `progress-store.test.ts`). What
 * is left for this file is the wrapper's own three-line promises: that an absent
 * key is a success and a throwing store is not, and that a `null` browser cannot
 * be wrapped into something that looks like storage.
 */

import { describe, expect, it } from 'vitest';

import { createWebStorageRecordStore } from '@adapters/persistence/web-storage-record-store';

import { memoryStorage } from '../../support/fixtures';

const KEY = 'truenorth.progress';

describe('wrapping a browser store', () => {
  it('cannot wrap a browser that has none', () => {
    expect(createWebStorageRecordStore(null)).toBeNull();
  });

  it('reads an absent key as no save, which is not an error (ADR-0024)', async () => {
    const store = createWebStorageRecordStore(memoryStorage());
    const read = await store?.read(KEY);
    expect(read?.ok).toBe(true);
    if (read?.ok === true) expect(read.value).toBeNull();
  });

  it('reads a store that throws as an error, which is a different state', async () => {
    const store = createWebStorageRecordStore(memoryStorage({ read: true }));
    const read = await store?.read(KEY);
    expect(read?.ok).toBe(false);
    if (read?.ok === false) expect(read.error.code).toBe('save.storage.readFailed');
  });

  it('round-trips a record and removes it', async () => {
    const storage = memoryStorage();
    const store = createWebStorageRecordStore(storage);
    expect((await store?.write(KEY, 'value'))?.ok).toBe(true);
    expect(storage.entries.get(KEY)).toBe('value');
    expect((await store?.remove(KEY))?.ok).toBe(true);
    expect(storage.entries.has(KEY)).toBe(false);
  });

  it('has nothing to close, and says so by not throwing', () => {
    // `localStorage` holds no handle. The method exists because the seam has it,
    // and a seam whose implementations disagree about whether close() is safe is
    // a seam the caller has to remember two things about.
    const store = createWebStorageRecordStore(memoryStorage());
    expect(() => store?.close()).not.toThrow();
  });
});
