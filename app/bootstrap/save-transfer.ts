/**
 * Saving the game to a file and opening one, wired (`TN-SAVE-06`, ADR-0046).
 *
 * `app/ui/save-transfer.ts` draws the controls and asks the questions; the use
 * cases in `app/application/use-cases/transfer-progress.ts` make and read the
 * file; this joins the two and owns the three things only the composition root
 * can:
 *
 *  - **the game in memory**, read through `progress` when a file is made;
 *  - **the writes**: from the moment a file starts replacing the save, the
 *    game's own saves are held, so nothing — an answer, a setting, a tab being
 *    hidden — can write the old game back over the file. They are released only
 *    if the replacement fails; after a success the old game is never written
 *    again, because the next thing that happens is `restart`;
 *  - **the restart**: the game is started again from the store rather than
 *    patched in place. Every screen that read the old save — the title, the map,
 *    the passport, the creator, Settings itself — is rebuilt from the new one by
 *    the same boot that builds it on any visit, so no half of the old game
 *    survives on screen (ADR-0046).
 */

import type { Progress } from '@domain/entities/progress';
import {
  deleteProgress,
  exportSaveFile,
  readSaveFile,
  replaceProgress,
  type SaveFile,
  type TransferProgressDeps,
} from '@application/use-cases/transfer-progress';
import type { SaveImportCheck, SaveTransferOptions } from '@ui/save-transfer';

/** The game's own saves, held while a file replaces them. */
export interface SaveWrites {
  hold(): void;
  release(): void;
}

export interface SaveTransferWiring {
  readonly deps: TransferProgressDeps;
  /** The game in memory, read when a file is made. */
  readonly progress: () => Progress;
  readonly writes: SaveWrites;
  /** Hand a file to the browser. */
  readonly download: (file: SaveFile) => void;
  /** Start the game again from the store. */
  readonly restart: () => void;
  /** Where a failure is told. The console by default; never the player. */
  readonly report?: (message: string) => void;
}

export function saveTransferOptions(wiring: SaveTransferWiring): SaveTransferOptions {
  const report =
    wiring.report ??
    ((message: string): void => {
      console.error(message);
    });

  return {
    onExport: () => {
      const file = exportSaveFile(wiring.deps, wiring.progress());
      if (!file.ok) {
        report(`[bootstrap] the save could not be made into a file. ${file.error.code}`);
        return;
      }
      wiring.download(file.value);
    },

    onImport: async (file): Promise<SaveImportCheck> => {
      const reading = await readSaveFile(wiring.deps, {
        byteLength: file.size,
        readText: () => file.text(),
      });
      if (reading.kind === 'refused') {
        report(`[bootstrap] a save file was refused (${reading.reason}). ${reading.error.code}`);
        return { kind: 'refused', reason: reading.reason };
      }
      const imported = reading.progress;
      return {
        kind: 'ready',
        replace: async () => {
          wiring.writes.hold();
          const written = await replaceProgress(wiring.deps, imported);
          if (written.ok) return true;
          wiring.writes.release();
          report(`[bootstrap] a save file did not replace the save. ${written.error.code}`);
          return false;
        },
      };
    },

    /*
     * "Delete my progress" (ADR-0026, and CLAUDE.md's local-only storage): the
     * player's own way to clear what this device kept, which the game offered
     * nowhere until now.
     *
     * The writes are held **before** anything is cleared and are never released
     * on success, exactly as a replacement holds them: the game in memory is the
     * one the player has just deleted, and a single write after this — an
     * answer, a setting, the tab being hidden — would put it straight back into
     * the store they cleared. `restart` is what happens next, and it starts the
     * game again from a store that is now empty.
     *
     * Nothing here asks. The question, its cost and its two answers are
     * `app/ui/save-transfer.ts`'s, and this runs only after a yes.
     */
    /*
     * **`false` means "it did not finish", not "nothing changed".** The port
     * clears both stores ADR-0026 uses and reports a single error for either, so
     * a clear that emptied IndexedDB and was refused by `localStorage` arrives
     * here identical to one that did nothing at all. This cannot tell them
     * apart, so it does not try, and the sentence the screen draws
     * (`save.clear.failed`) claims only what is known. Telling them apart needs
     * a partial outcome on `ProgressRepository.clear`, which is a port change
     * and another owner's call; it is reported rather than invented here.
     *
     * The writes stay held on the failure path as well as the success path when
     * the clear may have half-landed — releasing them would let the game write
     * its in-memory save straight back over a store it may have just emptied.
     */
    onDelete: async (): Promise<boolean> => {
      wiring.writes.hold();
      const cleared = await deleteProgress(wiring.deps);
      if (cleared.ok) return true;
      report(`[bootstrap] the progress was not fully deleted. ${cleared.error.code}`);
      return false;
    },

    onRestart: () => {
      wiring.restart();
    },
  };
}

/**
 * Give the browser a save file to keep.
 *
 * A `Blob` and an object URL rather than a `data:` URI, because a save can be
 * larger than some browsers allow in a URL; the link is in the document for the
 * click, which one engine requires, and the URL is revoked as soon as the click
 * has been dispatched. The File System Access API's save picker is not used: it
 * is in one engine, it is a second modal surface drawn in the operating
 * system's language, and no browser suite can drive it (ADR-0046).
 */
export function downloadSaveFile(doc: Document, file: SaveFile): void {
  const url = URL.createObjectURL(new Blob([file.contents], { type: file.type }));
  const link = doc.createElement('a');
  link.href = url;
  link.download = file.name;
  link.hidden = true;
  doc.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
