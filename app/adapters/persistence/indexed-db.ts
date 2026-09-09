/**
 * The IndexedDB this adapter talks to, and the only place it is touched.
 *
 * Same shape as `web-storage.ts` and for the same reasons. The browser API is
 * declared *structurally* rather than as `typeof indexedDB`, so the real
 * `IDBFactory` satisfies it and so does a plain object in a test — which is what
 * keeps every rule below testable under `environment: 'node'` with no DOM and no
 * fake-indexeddb dependency on the payload. Nothing above `app/adapters` names
 * any of it (ADR-0005).
 *
 * IndexedDB is event-driven and TrueNorth's ports are `Promise<Result<…>>`, so
 * this file is the whole of the translation: request events become promises,
 * every failure becomes a value, and nothing here throws. Three of those
 * failures are real browser behaviour rather than defensive padding:
 *
 *  1. **Reading `globalThis.indexedDB` can throw**, before any method is called,
 *     in a private window or with site data blocked — exactly as `localStorage`
 *     does. That is why `browserIndexedDb()` is a function and why the read sits
 *     inside a `try`.
 *  2. **`open()` can throw synchronously** (older Safari private mode) *and*
 *     fire `onerror` asynchronously (Firefox private mode, `InvalidStateError`).
 *     Both are handled; either one means "no IndexedDB here", which is a
 *     fallback, not an error the player should see (ADR-0026).
 *  3. **A transaction can fail after its request succeeded** — quota, eviction,
 *     a version change from another tab. So a write resolves on the
 *     *transaction's* `complete` event and not on the request's `success`: the
 *     earlier event means "queued", and reporting a queued write as a saved game
 *     is how a save is lost while the UI says it was kept.
 *
 * What is deliberately NOT defended against: an `open()` that neither succeeds
 * nor errors, which would leave the returned promise pending and the boot
 * waiting. Defending it needs a timer, a timer here would be an unported
 * dependency on `setTimeout` inside an adapter that is otherwise a pure
 * translation, and no browser is known to do it. If one is found, the fix is a
 * `Clock`-shaped port passed in, not a bare `setTimeout` (ADR-0026, Consequences).
 */

import { appErr, ok } from '@common/result';
import type { Result } from '@common/result';

import type { RecordStore } from '@adapters/persistence/record-store';

/* ------------------------------------------------------ the browser's shapes */

/** An IndexedDB event handler slot. The event itself is never read. */
type IdbHandler = (() => void) | null;

/** The part of `IDBRequest` this adapter uses. */
export interface IdbRequest<T> {
  readonly result: T;
  readonly error: unknown;
  onsuccess: IdbHandler;
  onerror: IdbHandler;
}

/** The part of `IDBOpenDBRequest` this adapter uses. */
export interface IdbOpenRequest extends IdbRequest<IdbDatabase> {
  onupgradeneeded: IdbHandler;
}

/** The part of `IDBObjectStore` this adapter uses: one record, by key. */
export interface IdbObjectStore {
  get(key: string): IdbRequest<unknown>;
  put(value: unknown, key: string): IdbRequest<unknown>;
  delete(key: string): IdbRequest<unknown>;
}

/** The part of `IDBTransaction` this adapter uses. */
export interface IdbTransaction {
  readonly error: unknown;
  objectStore(name: string): IdbObjectStore;
  oncomplete: IdbHandler;
  onerror: IdbHandler;
  onabort: IdbHandler;
}

/** The part of `IDBDatabase` this adapter uses. */
export interface IdbDatabase {
  readonly objectStoreNames: { contains(name: string): boolean };
  createObjectStore(name: string): IdbObjectStore;
  transaction(store: string, mode: 'readonly' | 'readwrite'): IdbTransaction;
  close(): void;
}

/** The part of `IDBFactory` this adapter uses. */
export interface IndexedDbFactory {
  open(name: string, version: number): IdbOpenRequest;
}

/**
 * The browser's `indexedDB`, or `null` where it cannot be reached.
 *
 * `null` is not an error and never reaches a player: ADR-0026 falls back to
 * `localStorage`, and TN-SAVE-05's warning is shown only when *neither* store
 * will have us.
 */
export const browserIndexedDb = (): IndexedDbFactory | null => {
  try {
    const factory = (globalThis as { indexedDB?: IndexedDbFactory | null }).indexedDB;
    if (factory === undefined || factory === null) return null;
    // Presence only. A real probe would have to open a database, which is the
    // expensive thing this module is about to do once anyway — and `open`
    // reports its own failure, so probing first would only double the cost.
    return typeof factory.open === 'function' ? factory : null;
  } catch {
    return null;
  }
};

/* ---------------------------------------------------------- the record store */

/** The database and store names this game owns. One record lives in it. */
export const SAVE_DATABASE_NAME = 'truenorth';
export const SAVE_STORE_NAME = 'progress';
/** Bumped only when the *object stores* change, never when the save format does. */
export const SAVE_DATABASE_VERSION = 1;

export interface OpenIndexedDbOptions {
  readonly factory: IndexedDbFactory | null;
  readonly databaseName?: string;
  readonly storeName?: string;
  readonly databaseVersion?: number;
}

const ioError = (code: string, message: string, details: Record<string, unknown>, cause?: unknown) =>
  appErr('io', code, message, details, cause);

/**
 * Open the save database.
 *
 * `null` means "this browser will not give us IndexedDB", by absence, by throw
 * or by a failed open — one answer, because the caller does the same thing with
 * all three: fall back to `localStorage` (ADR-0026).
 */
export const openIndexedDbRecordStore = async (
  options: OpenIndexedDbOptions,
): Promise<RecordStore | null> => {
  const { factory } = options;
  if (factory === null) return null;
  const databaseName = options.databaseName ?? SAVE_DATABASE_NAME;
  const storeName = options.storeName ?? SAVE_STORE_NAME;
  const databaseVersion = options.databaseVersion ?? SAVE_DATABASE_VERSION;

  const database = await new Promise<IdbDatabase | null>((resolve) => {
    let request: IdbOpenRequest;
    try {
      request = factory.open(databaseName, databaseVersion);
    } catch {
      // Older Safari in a private window throws here rather than erroring.
      resolve(null);
      return;
    }
    request.onupgradeneeded = (): void => {
      try {
        const upgrading = request.result;
        if (!upgrading.objectStoreNames.contains(storeName)) {
          upgrading.createObjectStore(storeName);
        }
      } catch {
        // The upgrade failed; `onerror` follows and resolves this promise.
      }
    };
    request.onsuccess = (): void => {
      resolve(request.result);
    };
    request.onerror = (): void => {
      resolve(null);
    };
  });

  if (database === null) return null;

  /**
   * One transaction, one record, one `Result`.
   *
   * `body` gets the store, the transaction and the settle function, because a
   * read finishes on its request and a write finishes on its transaction, and
   * pretending those are the same event is the bug described in the header.
   * `settle` ignores every call after the first: a failed transaction fires
   * `error` *and* `abort`, and the first thing to happen is the true story.
   */
  const run = <T>(
    mode: 'readonly' | 'readwrite',
    code: string,
    message: string,
    body: (
      store: IdbObjectStore,
      transaction: IdbTransaction,
      settle: (result: Result<T>) => void,
    ) => void,
  ): Promise<Result<T>> =>
    new Promise<Result<T>>((resolve) => {
      let settled = false;
      const settle = (result: Result<T>): void => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      const fail = (cause: unknown): void => {
        settle(ioError(code, message, { databaseName, storeName }, cause));
      };
      try {
        const transaction = database.transaction(storeName, mode);
        transaction.onerror = (): void => {
          fail(transaction.error);
        };
        transaction.onabort = (): void => {
          fail(transaction.error);
        };
        body(transaction.objectStore(storeName), transaction, settle);
      } catch (cause) {
        // `transaction()` throws when the store is gone or the connection is
        // closing; `objectStore()` throws for a name that is not in it.
        fail(cause);
      }
    });

  return {
    read(key: string): Promise<Result<string | null>> {
      return run<string | null>(
        'readonly',
        'save.storage.readFailed',
        'IndexedDB refused to be read.',
        (store, _transaction, settle) => {
          const request = store.get(key);
          request.onerror = (): void => {
            settle(
              ioError(
                'save.storage.readFailed',
                'IndexedDB refused to be read.',
                { key },
                request.error,
              ),
            );
          };
          request.onsuccess = (): void => {
            const value = request.result;
            if (value === undefined || value === null) {
              /*
               * Genuinely absent: a new player, and the one place in this file
               * where an empty answer is a success. Every failure above stays a
               * failure precisely so that this branch means what it says
               * (ADR-0024).
               */
              settle(ok(null));
              return;
            }
            if (typeof value !== 'string') {
              // Something else wrote to our key. Refused, not discarded.
              settle(
                appErr('invalid', 'save.storage.notAString', 'That record is not a saved game.', {
                  key,
                  type: typeof value,
                }),
              );
              return;
            }
            settle(ok(value));
          };
        },
      );
    },

    write(key: string, value: string): Promise<Result<void>> {
      return run<void>(
        'readwrite',
        'save.storage.writeFailed',
        'IndexedDB refused the write.',
        (store, transaction, settle) => {
          const request = store.put(value, key);
          request.onerror = (): void => {
            settle(
              ioError(
                'save.storage.writeFailed',
                'IndexedDB refused the write.',
                { key, bytes: value.length },
                request.error,
              ),
            );
          };
          // The request succeeding means "queued". Only `complete` means the
          // bytes are durable, and only that is reported as a save.
          transaction.oncomplete = (): void => {
            settle(ok());
          };
        },
      );
    },

    remove(key: string): Promise<Result<void>> {
      return run<void>(
        'readwrite',
        'save.storage.clearFailed',
        'IndexedDB refused to be cleared.',
        (store, transaction, settle) => {
          const request = store.delete(key);
          request.onerror = (): void => {
            settle(
              ioError(
                'save.storage.clearFailed',
                'IndexedDB refused to be cleared.',
                { key },
                request.error,
              ),
            );
          };
          transaction.oncomplete = (): void => {
            settle(ok());
          };
        },
      );
    },

    close(): void {
      try {
        database.close();
      } catch {
        // A close that fails leaves a handle open until the tab goes away.
        // Nothing a player can act on, and nothing worth failing a save over.
      }
    },
  };
};
