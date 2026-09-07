import { err, ok, type Result } from '@common/result';
import type { PersistenceError, ProgressRepository, SaveCodec } from '@application/ports';
import type { Progress } from '@domain/progress';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SAVE_KEY = 'truenorth.save.v1';

export class LocalStorageProgressRepository implements ProgressRepository {
  constructor(
    private readonly codec: SaveCodec,
    private readonly store: KeyValueStore = globalThis.localStorage,
    private readonly key: string = SAVE_KEY,
  ) {}

  async load(): Promise<Result<Progress | null, PersistenceError>> {
    let raw: string | null;
    try {
      raw = this.store.getItem(this.key);
    } catch (e) {
      return err({ code: 'io', message: `localStorage unavailable: ${(e as Error).message}` });
    }
    if (raw === null) return ok(null);
    const decoded = this.codec.decode(raw);
    if (!decoded.ok) return decoded;
    return ok(decoded.value);
  }

  async save(progress: Progress): Promise<Result<void, PersistenceError>> {
    try {
      this.store.setItem(this.key, this.codec.encode(progress));
      return ok(undefined);
    } catch (e) {
      return err({ code: 'io', message: `Could not save: ${(e as Error).message}` });
    }
  }

  async clear(): Promise<Result<void, PersistenceError>> {
    try {
      this.store.removeItem(this.key);
      return ok(undefined);
    } catch (e) {
      return err({ code: 'io', message: (e as Error).message });
    }
  }
}
