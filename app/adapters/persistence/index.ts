/**
 * The persistence adapter: IndexedDB behind `ProgressRepository`, with
 * `localStorage` as the fallback and as the store an existing save is carried
 * out of (ADR-0026).
 */

export { openProgressStore } from './progress-store';
export type {
  MigrationReport,
  OpenProgressStoreOptions,
  ProgressStore,
  StorageBackend,
} from './progress-store';

export { browserIndexedDb, openIndexedDbRecordStore } from './indexed-db';
export type { IndexedDbFactory, OpenIndexedDbOptions } from './indexed-db';

export {
  PROGRESS_STORAGE_KEY,
  createRecordProgressRepository,
} from './record-progress-repository';
export type { RecordProgressRepositoryOptions } from './record-progress-repository';
export type { RecordStore } from './record-store';

export { createLocalStorageProgressRepository } from './local-storage-progress-repository';
export type { LocalStorageProgressRepositoryOptions } from './local-storage-progress-repository';
export { createWebStorageRecordStore } from './web-storage-record-store';
export { browserLocalStorage } from './web-storage';
export type { WebStorage } from './web-storage';
