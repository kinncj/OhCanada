/**
 * `ProgressRepository` over `localStorage`.
 *
 * Since ADR-0026 this is a *fallback*: IndexedDB is where a save goes, and this
 * is what a browser that will not give us IndexedDB — a private window, a
 * blocked origin — gets instead. It is also what every save written before that
 * ADR is sitting in, which is why the file did not go away and why
 * `progress-store.ts` reads it before deciding a player is new.
 *
 * The rules moved out to `record-progress-repository.ts` and are now shared with
 * the IndexedDB path; `web-storage-record-store.ts` is the two-line difference
 * between the backends. What is left here is the name the composition root and
 * the existing suites already use, kept because renaming it would have made a
 * behaviour change and a rename land in the same commit.
 *
 * The key is unchanged, deliberately: `truenorth.progress` is what an existing
 * player's save is stored under, and a migration that renamed it would orphan
 * the thing it was migrating (OQ-SAVE-5).
 */

import type { ProgressRepository } from '@application/ports/progress-repository';
import type { SaveCodec } from '@application/ports/save-codec';

import { createRecordProgressRepository } from '@adapters/persistence/record-progress-repository';
import { createWebStorageRecordStore } from '@adapters/persistence/web-storage-record-store';
import type { WebStorage } from '@adapters/persistence/web-storage';

export { PROGRESS_STORAGE_KEY } from '@adapters/persistence/record-progress-repository';

export interface LocalStorageProgressRepositoryOptions {
  /** `null` when the browser will not give us storage (private mode, blocked). */
  readonly storage: WebStorage | null;
  readonly codec: SaveCodec;
  readonly key?: string;
}

export const createLocalStorageProgressRepository = (
  options: LocalStorageProgressRepositoryOptions,
): ProgressRepository =>
  createRecordProgressRepository({
    store: createWebStorageRecordStore(options.storage),
    codec: options.codec,
    ...(options.key === undefined ? {} : { key: options.key }),
  });
