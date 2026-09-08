/**
 * The browser storage this adapter talks to, and the only place it is touched.
 *
 * `WebStorage` is the three methods of the `Storage` interface this adapter
 * uses, declared structurally rather than as `typeof localStorage`: the real
 * `localStorage` satisfies it, and so does a `Map` in a test, which is what
 * keeps the repository's rules testable under `environment: 'node'` without a
 * DOM. Nothing above `app/adapters` names it.
 *
 * Reading `globalThis.localStorage` can *throw* rather than return null — Safari
 * in private mode and any browser with site data blocked do exactly that, and it
 * throws on property access, before any method is called. That is why
 * `browserLocalStorage()` exists and why it is a function: a module-level
 * constant would throw at import time and take the whole game down on the one
 * device configuration TN-SAVE-05 is written for.
 */

/** The part of the DOM `Storage` interface that a save needs. */
export interface WebStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * The browser's `localStorage`, or `null` where it cannot be reached.
 *
 * `null` is not an error: TN-SAVE-05 says the game still reaches the character
 * creator, shows the storage warning, and keeps playing. The caller decides.
 */
export const browserLocalStorage = (): WebStorage | null => {
  try {
    const storage = (globalThis as { localStorage?: WebStorage }).localStorage;
    if (storage === undefined || storage === null) return null;
    // Blocked storage sometimes presents an object whose methods throw, so the
    // probe is a real write and a real delete, not a truthiness check.
    const probe = '__truenorth_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
};
