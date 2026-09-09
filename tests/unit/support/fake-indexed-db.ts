/**
 * IndexedDB as a `Map`, with the failure modes ADR-0026 names.
 *
 * The same idea as `memoryStorage()` in `fixtures.ts`, one API further out: the
 * adapter declares the browser's shapes structurally, so a plain object
 * satisfies them and every rule in `indexed-db.ts` can be exercised under
 * `environment: 'node'` with no DOM and no `fake-indexeddb` dependency.
 *
 * It is event-driven on purpose, and the event *order* matters. A promise-shaped
 * fake would be easier to write and would prove nothing about the part of the
 * adapter most likely to be wrong: a request that succeeds inside a transaction
 * that then aborts, which is how a write is reported as saved and is not. So a
 * request's `success` fires before its transaction's `complete`, exactly as a
 * browser does, and a fake that got that backwards would let the adapter resolve
 * a write on the wrong event and still pass.
 *
 * Handlers are assigned by the caller *after* the request object is returned, so
 * the first delivery of every chain is scheduled in a microtask.
 */

import type {
  IdbDatabase,
  IdbObjectStore,
  IdbOpenRequest,
  IdbRequest,
  IdbTransaction,
  IndexedDbFactory,
} from '@adapters/persistence/indexed-db';

/** Which step should fail, and how. Everything unset behaves. */
export interface FakeIndexedDbFailures {
  /** `throw`: older Safari in a private window. `error`: Firefox in one. */
  readonly open?: 'throw' | 'error';
  /** The upgrade cannot create the object store, so the open fails. */
  readonly createStore?: boolean;
  /** `db.transaction()` throws — a closing connection, a store that is gone. */
  readonly transaction?: boolean;
  readonly read?: boolean;
  /**
   * Fail reads from the nth onward, counting from 1. The migration reads twice —
   * once to see whether a save is already here, once to verify the copy — and
   * this is what tells those two apart.
   */
  readonly readFrom?: number;
  readonly write?: boolean;
  readonly remove?: boolean;
  /**
   * The request succeeds and the transaction fails anyway: quota measured at
   * commit, eviction, a version change in another tab. This is the case a fake
   * that resolved on request success would silently pass.
   */
  readonly commit?: 'error' | 'abort';
  /**
   * The write is accepted and stores something else. Nothing does this on
   * purpose; a half-written record after an eviction or a disk error looks like
   * it, and it is the only way to reach the migration's verify-before-delete
   * branch through the public API instead of by testing a private function.
   */
  readonly mangleWrite?: boolean;
}

export interface FakeIndexedDb extends IndexedDbFactory {
  /** The store's records, so a test can seed one or read what was written. */
  readonly records: Map<string, unknown>;
  readonly stats: { opens: number; closes: number };
}

const deliver = (handler: (() => void) | null): void => {
  if (handler !== null) handler();
};

export const fakeIndexedDb = (
  failures: FakeIndexedDbFailures = {},
  seed: Iterable<readonly [string, unknown]> = [],
): FakeIndexedDb => {
  const records = new Map<string, unknown>(seed);
  const storeNames = new Set<string>();
  const stats = { opens: 0, closes: 0 };
  let upgradeFailed = false;
  let reads = 0;

  const noopStore: IdbObjectStore = {
    get: () => ({ result: undefined, error: null, onsuccess: null, onerror: null }),
    put: () => ({ result: undefined, error: null, onsuccess: null, onerror: null }),
    delete: () => ({ result: undefined, error: null, onsuccess: null, onerror: null }),
  };

  const objectStore = (transaction: IdbTransaction, pending: { count: number }): IdbObjectStore => {
    const complete = (): void => {
      pending.count -= 1;
      if (pending.count > 0) return;
      if (failures.commit === 'error') deliver(transaction.onerror);
      else if (failures.commit === 'abort') deliver(transaction.onabort);
      else deliver(transaction.oncomplete);
    };

    const track = (
      shouldFail: boolean,
      produce: (target: { result: unknown; error: unknown }) => void,
    ): IdbRequest<unknown> => {
      pending.count += 1;
      const target = {
        result: undefined as unknown,
        error: null as unknown,
        onsuccess: null,
        onerror: null,
      };
      queueMicrotask(() => {
        if (shouldFail) {
          pending.count -= 1;
          target.error = new Error('the store refused the operation');
          // A failed request aborts its transaction in a real browser, so both
          // events are sent; the adapter settles on the first it sees.
          deliver(target.onerror);
          deliver(transaction.onabort);
          return;
        }
        produce(target);
        deliver(target.onsuccess);
        // After the request's own event, as a browser commits it.
        queueMicrotask(complete);
      });
      return target as IdbRequest<unknown>;
    };

    return {
      get: (key) => {
        reads += 1;
        const refuse =
          failures.read === true ||
          (failures.readFrom !== undefined && reads >= failures.readFrom);
        return track(refuse, (target) => {
          target.result = records.get(key);
        });
      },
      put: (value, key) =>
        track(failures.write === true, () => {
          records.set(key, failures.mangleWrite === true ? `${String(value)} (damaged)` : value);
        }),
      delete: (key) =>
        track(failures.remove === true, () => {
          records.delete(key);
        }),
    };
  };

  const database: IdbDatabase = {
    objectStoreNames: { contains: (name) => storeNames.has(name) },
    createObjectStore(name) {
      if (failures.createStore === true) {
        upgradeFailed = true;
        throw new Error('the upgrade was refused');
      }
      storeNames.add(name);
      return noopStore;
    },
    transaction(name, _mode) {
      if (failures.transaction === true) throw new Error('the connection is closing');
      if (!storeNames.has(name)) throw new Error(`no object store named ${name}`);
      const pending = { count: 0 };
      const transaction: IdbTransaction = {
        error: null,
        objectStore: () => objectStore(transaction, pending),
        oncomplete: null,
        onerror: null,
        onabort: null,
      };
      return transaction;
    },
    close() {
      stats.closes += 1;
    },
  };

  return {
    records,
    stats,
    open(_name, _version): IdbOpenRequest {
      stats.opens += 1;
      if (failures.open === 'throw') throw new Error('IndexedDB is not available here');
      const target: IdbOpenRequest = {
        result: database,
        error: null,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      };
      queueMicrotask(() => {
        if (failures.open === 'error') {
          deliver(target.onerror);
          return;
        }
        if (storeNames.size === 0) deliver(target.onupgradeneeded);
        // An upgrade that could not create its store aborts the open, which is
        // what a browser reports and what the fallback path depends on.
        if (upgradeFailed) deliver(target.onerror);
        else deliver(target.onsuccess);
      });
      return target;
    },
  };
};
