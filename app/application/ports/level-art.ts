/**
 * LevelArtCache and Connectivity — can a level be drawn with no network?
 *
 * A level's art is fetched when the level opens, and the service worker keeps
 * it (ADR-0034). Online, a file that was never kept is simply fetched. Offline
 * it cannot be, and a level opened then draws flat bands where its scenery
 * should be: the second live-site audit opened Halifax offline for the first
 * time and got grey and blue stripes, a console full of `net::ERR_FAILED`, and
 * nothing that told the player why. These two seams let the application ask,
 * before a level starts, whether that is about to happen.
 *
 * Consumed by `app/application/use-cases/level-availability.ts`. Implemented by
 * `GameRenderer.missingLevelArt`, the adapter that already knows which files a
 * level draws on this device, and by the browser's own `navigator.onLine`; both
 * are wired in `app/bootstrap/main.ts`.
 */

import type { Result } from '@common/result';

export interface LevelArtCache {
  /**
   * The URLs of the files this level would draw on this device that the
   * browser's cache cannot answer for. Empty when every one of them is there.
   *
   * An error, never an empty list, when the question cannot be answered at all:
   * no Cache Storage, or an asset manifest that will not read. "Could not tell"
   * and "nothing is missing" are different answers, and reading the first as the
   * second opens exactly the level this seam exists to stop (ADR-0024).
   */
  missingLevelArt(levelId: string): Promise<Result<readonly string[]>>;
}

export interface Connectivity {
  /**
   * `false` only when the browser is sure there is no network. A browser that
   * reports `true` may still be behind a portal with no internet; that level
   * fetches and fails the way it always has, and this seam does not pretend to
   * know better.
   */
  isOnline(): boolean;
}
