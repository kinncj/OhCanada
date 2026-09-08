/** The persistence adapter: `localStorage` behind `ProgressRepository`. */

export { createLocalStorageProgressRepository, PROGRESS_STORAGE_KEY } from './local-storage-progress-repository';
export type { LocalStorageProgressRepositoryOptions } from './local-storage-progress-repository';
export { browserLocalStorage } from './web-storage';
export type { WebStorage } from './web-storage';
