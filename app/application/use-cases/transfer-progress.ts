/**
 * TransferProgress — a save carried out as a file and brought back in
 * (TN-SAVE-06, ADR-0046).
 *
 * `save-progress.ts` already had the two conversions — `exportProgress` turns the
 * game into the save's bytes and `importProgress` turns bytes back into a game —
 * and nothing had ever called either from a screen. This file is what a screen
 * needs around them:
 *
 *  - **a file**, not a string: a name a player can recognise in a downloads
 *    folder, and the media type;
 *  - **a reading of a chosen file** that refuses an oversized one *before* it is
 *    read into memory, and says which of three things a refusal was, because a
 *    player is told differently about each;
 *  - **the replacement**, written at this build's version, so a file from an
 *    older build is migrated once and stored migrated.
 *
 * Every defence a save needs — `JSON.parse` and never `eval`, the version gate,
 * the migrations, the whole schema — stays in the codec, where the same bytes
 * are checked on their way out of the browser's store. Nothing here re-checks
 * a document; it only decides what a refusal is called.
 *
 * **Nothing is applied partially.** `readSaveFile` writes nothing and changes
 * nothing, and `replaceProgress` is one write of one whole document. The game
 * in memory is not touched by either: the composition root restarts the game
 * from the store after a replacement, so there is no moment at which half of
 * the old game and half of the file are on screen (ADR-0046).
 */

import { appErr, ok } from '@common/result';
import type { AppError, Result } from '@common/result';
import type { EpochMillis } from '@domain/ids';
import type { Progress } from '@domain/entities/progress';

import {
  exportProgress,
  importProgress,
  saveProgress,
  type SaveProgressDeps,
} from '@application/use-cases/save-progress';

/** What a save file is served as. The bytes are the save document, JSON. */
export const SAVE_FILE_TYPE = 'application/json';

/** The start of every save file's name. Plain and in neither language. */
export const SAVE_FILE_PREFIX = 'truenorth-progress';

/** A save, as a file a browser can hand to a player. */
export interface SaveFile {
  readonly name: string;
  readonly type: typeof SAVE_FILE_TYPE;
  /** The save document as the codec writes it: `version` and `$schema` included. */
  readonly contents: string;
}

/** A file the player chose, as far as reading it goes. A browser `File` adapts in one line. */
export interface SaveFileSource {
  /** Its size on disk, known before a byte of it is read. */
  readonly byteLength: number;
  readText(): Promise<string>;
}

/**
 * Why a file was refused, in the three ways a player is told about it:
 *
 *  - `tooBig`: over `save.maxImportBytes`, and never read;
 *  - `newer`: a save from a build newer than this one, which only updating reads;
 *  - `unreadable`: everything else — not JSON, JSON that is not a save, a save
 *    too old to migrate, a file the browser could not read. The player's next
 *    step is the same for all of them: choose a different file.
 */
export type SaveFileRefusal = 'tooBig' | 'newer' | 'unreadable';

export type SaveFileReading =
  | { readonly kind: 'ready'; readonly progress: Progress }
  | {
      readonly kind: 'refused';
      readonly reason: SaveFileRefusal;
      /** The codec's own error, for the console. Never shown to a player. */
      readonly error: AppError;
    };

export interface TransferProgressDeps extends SaveProgressDeps {
  /** `content/game.config.json#/save/maxImportBytes`, the same number the codec is built with. */
  readonly maxImportBytes: number;
}

/**
 * `truenorth-progress-2026-09-15.json`: the day the file was made, in UTC, so
 * two copies saved on different days sort and do not overwrite each other. A
 * moment no `Date` can hold drops the day rather than the file.
 */
export const saveFileName = (now: EpochMillis): string => {
  const day = new Date(now);
  const stamp = Number.isNaN(day.getTime()) ? '' : `-${day.toISOString().slice(0, 10)}`;
  return `${SAVE_FILE_PREFIX}${stamp}.json`;
};

/** The current game as a file. Valid against the save schema by construction. */
export const exportSaveFile = (deps: SaveProgressDeps, progress: Progress): Result<SaveFile> => {
  const contents = exportProgress(deps, progress);
  if (!contents.ok) return contents;
  return ok({
    name: saveFileName(deps.clock.now()),
    type: SAVE_FILE_TYPE,
    contents: contents.value,
  });
};

/** Which refusal a codec error is. Any code not named here is `unreadable`. */
export const refusalFor = (error: AppError): SaveFileRefusal => {
  switch (error.code) {
    case 'save.import.tooBig':
      return 'tooBig';
    case 'save.version.newer':
      return 'newer';
    default:
      return 'unreadable';
  }
};

/**
 * Read a file the player chose, and say whether it can replace the save.
 *
 * The size is checked **before** `readText`: a file the codec would refuse
 * unparsed should not be read into memory either, and a phone that is handed a
 * video by mistake should not have to hold it to find that out. The codec checks
 * the size again on the text, which is the check that counts; this one only
 * saves reading what it would refuse.
 *
 * Writes nothing. `TN-SAVE-06` asks the player to confirm before their progress
 * is replaced, so the replacement is `replaceProgress`, called after a yes.
 */
export const readSaveFile = async (
  deps: TransferProgressDeps,
  file: SaveFileSource,
): Promise<SaveFileReading> => {
  if (!Number.isFinite(file.byteLength) || file.byteLength > deps.maxImportBytes) {
    const refused = appErr('invalid', 'save.import.tooBig', 'That file is too big.', {
      bytes: file.byteLength,
      maxImportBytes: deps.maxImportBytes,
    });
    return { kind: 'refused', reason: 'tooBig', error: refused.error };
  }

  let encoded: string;
  try {
    encoded = await file.readText();
  } catch (cause) {
    const refused = appErr('io', 'save.import.readFailed', 'That file could not be read.', {}, cause);
    return { kind: 'refused', reason: 'unreadable', error: refused.error };
  }

  const imported = importProgress(deps, encoded);
  if (imported.ok) return { kind: 'ready', progress: imported.value };
  return { kind: 'refused', reason: refusalFor(imported.error), error: imported.error };
};

/**
 * Replace the saved game with one read from a file: one write of the whole
 * document, stamped with this build's version and this moment.
 *
 * A failed write is a `Result` error and the store holds what it held before; a
 * write either lands whole or does not land. What the caller does after a
 * success — ADR-0046 restarts the game from the store — is not this function's.
 */
export const replaceProgress = async (
  deps: SaveProgressDeps,
  imported: Progress,
): Promise<Result<void>> => {
  const written = await saveProgress(deps, imported);
  if (!written.ok) return written;
  return ok();
};

/**
 * Delete what this device is keeping, at the player's request.
 *
 * Storage is local only and there are two stores under one port — IndexedDB and
 * the `localStorage` a save was carried out of (ADR-0026) — so "delete my
 * progress" is `ProgressRepository.clear()` and **not** a write of an empty
 * save: an empty document in one store would still be a save, and a copy left
 * in the other would come back on the next boot. The port's own adapter clears
 * both, and it is the port's job precisely so that no screen has to know there
 * are two.
 *
 * It writes nothing first and keeps nothing back. What the caller does after —
 * ADR-0046 starts the game again from the store, which is now empty — is not
 * this function's, and neither is asking: `app/ui/save-transfer.ts` has already
 * put the question and the cost in front of the player by the time this runs.
 */
export const deleteProgress = async (deps: SaveProgressDeps): Promise<Result<void>> =>
  deps.repository.clear();
