/**
 * Whether a level may open, given the network and what the browser has kept of
 * its art (ADR-0034, amended 2026-09-15).
 *
 * The defect: a level opened offline whose art was never cached started anyway
 * and drew its placeholder bands — no landmark, no ground strip, nothing the
 * level is about — with no word to the player. A level with none of its scenery
 * is not a worse version of the level, it is a different screen that looks
 * broken, so this answers before the level starts.
 *
 * Three rules, each for a reason:
 *
 *  1. **Online, the cache is not asked.** A file that was never kept is fetched,
 *     as it always was, so the online path does exactly what it did before this
 *     existed and costs no lookups.
 *  2. **Offline, every file the level would draw must be there.** One missing
 *     file is a missing layer, and the player cannot tell which layer the level
 *     was supposed to have.
 *  3. **Offline and unable to tell is "needs a connection", not "open".** The
 *     only ways to be unable to tell are a browser with no Cache Storage (so no
 *     worker kept anything) or an asset manifest that will not read (so nothing
 *     can be drawn from a texture anyway). Reading "could not tell" as "nothing
 *     missing" is the vacuous pass ADR-0024 forbids, and here it would open the
 *     grey level this file exists to stop.
 */

import type { Connectivity, LevelArtCache } from '@application/ports/level-art';

export interface LevelAvailabilityDeps {
  readonly connectivity: Connectivity;
  readonly art: LevelArtCache;
}

export type LevelAvailability =
  | { readonly kind: 'open' }
  | {
      readonly kind: 'needsConnection';
      /** The files the cache could not answer for. Empty when `known` is false. */
      readonly missing: readonly string[];
      /** `false` when the cache could not be asked at all (rule 3). */
      readonly known: boolean;
    };

const OPEN: LevelAvailability = { kind: 'open' };

/** Decide, before a level starts, whether it can be drawn. */
export const checkLevelAvailability = async (
  deps: LevelAvailabilityDeps,
  levelId: string,
): Promise<LevelAvailability> => {
  if (deps.connectivity.isOnline()) return OPEN;

  let missing: Awaited<ReturnType<LevelArtCache['missingLevelArt']>>;
  try {
    missing = await deps.art.missingLevelArt(levelId);
  } catch {
    /* The port promises a `Result` and never a throw. A throw is still an answer
       of "could not tell", and rule 3 says what that means. */
    return { kind: 'needsConnection', missing: [], known: false };
  }

  if (!missing.ok) return { kind: 'needsConnection', missing: [], known: false };
  if (missing.value.length === 0) return OPEN;
  return { kind: 'needsConnection', missing: missing.value, known: true };
};
