/**
 * SaveProgress — writing the game down, reading it back, and carrying it away.
 *
 * Five operations, one boundary: the domain's `Progress` on this side, the
 * `ProgressSnapshot` document on the other, and `progress-document.ts` the only
 * crossing (ADR-0012). The repository decides *where* bytes go and the codec
 * decides *what* they are; neither is named here beyond its port, which is what
 * lets the same use case save to `localStorage`, to a file, and to whatever
 * slice 4 needs.
 *
 * Stories: TN-SAVE-01 (everything promised comes back), TN-SAVE-03 (a save
 * happens at named moments and never blocks the game), TN-SAVE-04 (a broken,
 * foreign or newer save is refused without destroying it), TN-SAVE-05 (blocked
 * storage is a warning, not a stop), TN-SAVE-06 (export and import).
 */

import { andThen, map, ok } from '@common/result';
import type { Result } from '@common/result';
import type { LocaleCode } from '@domain/ids';
import type { ProgressRepository, ProgressSnapshot } from '@application/ports/progress-repository';
import type { SaveCodec } from '@application/ports/save-codec';
import type { Clock } from '@application/ports/clock';

import type { Progress } from '@domain/entities/progress';

import {
  fromProgressSnapshot,
  toProgressSnapshot,
} from '@application/persistence/progress-document';

export interface SaveProgressDeps {
  readonly clock: Clock;
  readonly repository: ProgressRepository;
  readonly codec: SaveCodec;
  /**
   * `game.config.json#/defaultLocale`. Used only when a save names a locale this
   * build does not have; the rest of that save is still good (`clampSettings`).
   */
  readonly defaultLocale: LocaleCode;
}

/** Turn the game into the document, stamped with this moment and this version. */
export const snapshotOf = (deps: SaveProgressDeps, progress: Progress): Result<ProgressSnapshot> =>
  toProgressSnapshot(progress, {
    version: deps.codec.version,
    updatedAt: deps.clock.now(),
  });

/**
 * Write the current game.
 *
 * Returns the document it wrote, so a caller can hand the same bytes to an
 * export without building them twice. A storage failure — quota, private mode —
 * arrives as a `Result` error and the game keeps running (TN-SAVE-05).
 */
export const saveProgress = async (
  deps: SaveProgressDeps,
  progress: Progress,
): Promise<Result<ProgressSnapshot>> => {
  const snapshot = snapshotOf(deps, progress);
  if (!snapshot.ok) return snapshot;
  const written = await deps.repository.save(snapshot.value);
  return map(written, () => snapshot.value);
};

/**
 * Read the saved game.
 *
 * `ok(null)` is "no save yet", which TN-SAVE-05 insists is not an error and
 * shows no warning. A save that cannot be read comes back as an error with the
 * repository's details intact, and the stored bytes are left alone: TN-SAVE-04
 * gives the player the choice between downloading the old file and starting
 * again, and neither happens behind their back.
 */
export const loadProgress = async (deps: SaveProgressDeps): Promise<Result<Progress | null>> => {
  const loaded = await deps.repository.load();
  if (!loaded.ok) return loaded;
  if (loaded.value === null) return ok(null);
  return fromProgressSnapshot(loaded.value, deps.defaultLocale);
};

/** The bytes a player downloads. Valid against the save schema by construction. */
export const exportProgress = (deps: SaveProgressDeps, progress: Progress): Result<string> =>
  andThen(snapshotOf(deps, progress), (snapshot) => deps.codec.encode(snapshot));

/**
 * Read a file the player chose.
 *
 * Everything defensive about this lives in the codec — the size cap applied
 * before parsing, `JSON.parse` and never `eval`, the version gate, the whole
 * schema — because the same defence is needed for `localStorage`, and a check
 * written twice is a check that will be right once. This function is the
 * conversion that follows a decode that already succeeded.
 *
 * It does not write anything. TN-SAVE-06 asks the player to confirm before their
 * progress is replaced, so committing the import is a separate, deliberate save.
 */
export const importProgress = (deps: SaveProgressDeps, encoded: string): Result<Progress> =>
  andThen(deps.codec.decode(encoded), (snapshot) =>
    fromProgressSnapshot(snapshot, deps.defaultLocale),
  );

/** Delete local progress. Irreversible, and the confirmation is the UI's (TN-SAVE-06). */
export const deleteProgress = async (deps: SaveProgressDeps): Promise<Result<void>> =>
  deps.repository.clear();
