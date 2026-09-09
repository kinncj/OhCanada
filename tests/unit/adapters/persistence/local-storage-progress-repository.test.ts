/**
 * The persistence adapter: one key, no exceptions, and a broken value that
 * survives being read (TN-SAVE-01, TN-SAVE-04, TN-SAVE-05).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  PROGRESS_STORAGE_KEY,
  createLocalStorageProgressRepository,
} from '@adapters/persistence/local-storage-progress-repository';
import { browserLocalStorage } from '@adapters/persistence/web-storage';
import { createJsonSaveCodec } from '@application/persistence/json-save-codec';
import { toProgressSnapshot } from '@application/persistence/progress-document';
import type { ProgressSnapshot } from '@application/ports/progress-repository';

import { ORIGIN, emptyProgress, memoryStorage } from '../../support/fixtures';

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

describe('reading and writing', () => {
  it('keeps one key, versioned in its value and not in its name', async () => {
    const storage = memoryStorage();
    const repository = createLocalStorageProgressRepository({ storage, codec });
    expect((await repository.save(snapshot())).ok).toBe(true);

    expect([...storage.entries.keys()]).toEqual([PROGRESS_STORAGE_KEY]);
    const stored = storage.entries.get(PROGRESS_STORAGE_KEY) ?? '';
    expect(JSON.parse(stored)).toMatchObject({ version: codec.version });
  });

  it('gives back exactly what it stored', async () => {
    const repository = createLocalStorageProgressRepository({ storage: memoryStorage(), codec });
    await repository.save(snapshot());
    const loaded = await repository.load();
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.value).toEqual(snapshot());
  });

  it('reads an empty browser as no save, which is not an error (TN-SAVE-05)', async () => {
    const repository = createLocalStorageProgressRepository({ storage: memoryStorage(), codec });
    const loaded = await repository.load();
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.value).toBeNull();
  });

  it('clears the key when asked, and only that key', async () => {
    const storage = memoryStorage();
    storage.entries.set('someone-elses-key', 'not ours');
    const repository = createLocalStorageProgressRepository({ storage, codec });
    await repository.save(snapshot());
    expect((await repository.clear()).ok).toBe(true);
    expect([...storage.entries.keys()]).toEqual(['someone-elses-key']);
  });

  it('honours a key the composition root chose', async () => {
    const storage = memoryStorage();
    const repository = createLocalStorageProgressRepository({ storage, codec, key: 'tn.test' });
    await repository.save(snapshot());
    expect([...storage.entries.keys()]).toEqual(['tn.test']);
  });
});

describe('a value that is not a save (TN-SAVE-04)', () => {
  it('reports it, hands back the raw bytes, and leaves them in storage', async () => {
    const storage = memoryStorage();
    storage.entries.set(PROGRESS_STORAGE_KEY, '{not json');
    const repository = createLocalStorageProgressRepository({ storage, codec });

    const loaded = await repository.load();
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) {
      expect(loaded.error.kind).toBe('invalid');
      expect(loaded.error.details).toMatchObject({ raw: '{not json', key: PROGRESS_STORAGE_KEY });
    }
    // The player has not chosen yet, so nothing was deleted.
    expect(storage.entries.get(PROGRESS_STORAGE_KEY)).toBe('{not json');
  });

  it('reports a document that is JSON but not a save', async () => {
    const storage = memoryStorage();
    // This build's own version, so the refusal is about the *shape* rather than
    // about a missing migration — that path has its own test.
    storage.entries.set(PROGRESS_STORAGE_KEY, `{"version":${codec.version},"levels":[]}`);
    const repository = createLocalStorageProgressRepository({ storage, codec });
    const loaded = await repository.load();
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error.code).toBe('save.schema.invalid');
  });
});

describe('a browser that will not store anything (TN-SAVE-05)', () => {
  it('answers every call with an error rather than throwing', async () => {
    const repository = createLocalStorageProgressRepository({ storage: null, codec });
    for (const result of [
      await repository.load(),
      await repository.save(snapshot()),
      await repository.clear(),
    ]) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('save.storage.unavailable');
    }
  });

  it('turns a throwing read, write and clear into results', async () => {
    const failing = {
      read: createLocalStorageProgressRepository({ storage: memoryStorage({ read: true }), codec }),
      write: createLocalStorageProgressRepository({ storage: memoryStorage({ write: true }), codec }),
      clear: createLocalStorageProgressRepository({ storage: memoryStorage({ clear: true }), codec }),
    };

    const read = await failing.read.load();
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error.code).toBe('save.storage.readFailed');

    const written = await failing.write.save(snapshot());
    expect(written.ok).toBe(false);
    if (!written.ok) expect(written.error.code).toBe('save.storage.writeFailed');

    const cleared = await failing.clear.clear();
    expect(cleared.ok).toBe(false);
    if (!cleared.ok) expect(cleared.error.code).toBe('save.storage.clearFailed');
  });

  it('refuses to write a snapshot the codec will not encode', async () => {
    const repository = createLocalStorageProgressRepository({ storage: memoryStorage(), codec });
    const written = await repository.save({ ...snapshot(), version: 0 });
    expect(written.ok).toBe(false);
    if (!written.ok) expect(written.error.kind).toBe('invalid');
  });
});

describe('finding the browser storage', () => {
  const global = globalThis as { localStorage?: unknown };
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

  afterEach(() => {
    if (original === undefined) delete global.localStorage;
    else Object.defineProperty(globalThis, 'localStorage', original);
  });

  it('finds it when the browser gives it', () => {
    global.localStorage = memoryStorage();
    expect(browserLocalStorage()).not.toBeNull();
  });

  it('answers null where there is none', () => {
    delete global.localStorage;
    expect(browserLocalStorage()).toBeNull();
  });

  it('answers null when reading the property throws, without taking the game with it', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError: storage is blocked');
      },
    });
    expect(browserLocalStorage()).toBeNull();
  });

  it('answers null when the object is there but its methods throw', () => {
    global.localStorage = memoryStorage({ write: true });
    expect(browserLocalStorage()).toBeNull();
  });

  it('leaves no probe key behind', () => {
    const storage = memoryStorage();
    global.localStorage = storage;
    expect(browserLocalStorage()).toBe(storage);
    expect([...storage.entries.keys()]).toEqual([]);
  });
});
