import type { Page } from '@playwright/test';

import { PROGRESS_STORAGE_KEY } from '@adapters/persistence/record-progress-repository';
import { createJsonSaveCodec } from '@application/persistence/json-save-codec';
import { toProgressSnapshot } from '@application/persistence/progress-document';
import { SAVE_MIGRATIONS } from '@application/persistence/save-migrations';
import { defaultSettings } from '@domain/entities/player';
import { newProgress } from '@domain/entities/progress';
import type { EpochMillis, LocaleCode } from '@domain/ids';

/**
 * A player who has turned "Move by itself" off — which is what a scenario about
 * *holding* a control needs, now that the game walks by itself (ADR-0058).
 *
 * Not a spec file: `testMatch` in `tests/e2e/playwright.config.ts` is
 * `**\/*.spec.ts`, so this is a module the specs share, the same shape as
 * `./saves.ts`, `./walk.ts` and `./start-level.ts`.
 *
 * ## Why this exists
 *
 * Most of this suite opens a level as a player who has changed nothing, and a
 * great deal of it is about a held drive: "the player starts at the spawn and
 * `data-speed` is 0", the coast that must never speed up with nothing held, the
 * walks that stop and press again at each landmark. Those scenarios did not stop
 * being true when the default flipped — they stopped being *about the default*.
 * A precondition that has become false is a precondition a spec has to say out
 * loud, so it says it here, once, in the words of the setting a player would
 * change.
 *
 * ## Why a save, and not a click through Settings
 *
 * Because most of these specs deep-link into a level (`./?e2e=1&level=<id>`) and
 * never see the title screen, so there is no switch on the page to press; and
 * because the settings screen is already walked by the specs whose subject it is
 * (`auto-move-stops.spec.ts`, `touch-controls.spec.ts`), where pressing it is
 * the claim rather than the setup. This writes the same document the game itself
 * writes, in the place ADR-0026 says an existing save is carried from, so the
 * game reads it by its ordinary path and nothing reaches around the player.
 *
 * The save carries **no character**, so it does not turn a first run into a
 * returning player: `TN-FIRSTRUN` ruling 1 makes that decision from
 * `character === null` and from nothing else, and specs that go in through the
 * front door still meet the creator.
 */

const codec = createJsonSaveCodec({ maxImportBytes: 10_000_000, migrations: SAVE_MIGRATIONS });

/**
 * The save such a player leaves: the shipped defaults with one switch off.
 *
 * Built from `defaultSettings` rather than typed out, so it keeps following the
 * game's own defaults for everything this module is not about.
 */
export function heldDriveSave(locale: 'en' | 'fr' = 'en'): string {
  const now = Date.now() as EpochMillis;
  const progress = {
    ...newProgress({ ...defaultSettings(locale as unknown as LocaleCode), autoMove: false }),
  };
  const snapshot = toProgressSnapshot(progress, { version: codec.version, updatedAt: now });
  if (!snapshot.ok) {
    throw new Error(`the held-drive save is not a save: ${snapshot.error.message}`);
  }
  const encoded = codec.encode(snapshot.value);
  if (!encoded.ok) {
    throw new Error(`the held-drive save would not encode: ${encoded.error.message}`);
  }
  return encoded.value;
}

/**
 * Open this page as a player who holds a control to move.
 *
 * Call it before the first `goto` — a `test.beforeEach` is the usual place, so
 * that every navigation in the spec gets it. Writes once per tab, like
 * `saves.ts#seed` and for the same reason: a save written again after the game
 * has carried the first one into IndexedDB would be a second, stale copy.
 *
 * A spec that seeds its own save with `saves.ts` does not need this; those saves
 * carry the same setting.
 */
export async function holdToMove(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      if (window.sessionStorage.getItem('tn-e2e-seeded') !== null) return;
      window.sessionStorage.setItem('tn-e2e-seeded', '1');
      window.localStorage.setItem(key, value);
    },
    { key: PROGRESS_STORAGE_KEY, value: heldDriveSave() },
  );
}
