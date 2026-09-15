/**
 * Saving to a file and opening one, as the composition root wires it
 * (`TN-SAVE-06`, ADR-0046).
 *
 * The screen and the use cases are tested on their own. What only this seam can
 * get wrong is the order of three things around a replacement: the game's own
 * saves are held *before* the file is written, released only if the write
 * fails, and the game is restarted only when the player asks. Get the first
 * wrong and an answer given a moment earlier writes the old game over the file;
 * get the second wrong and a failed import silently stops the game saving.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createJsonSaveCodec } from '@application/persistence/json-save-codec';
import { SAVE_MIGRATIONS } from '@application/persistence/save-migrations';
import type { ProgressRepository, ProgressSnapshot } from '@application/ports/progress-repository';
import {
  exportSaveFile,
  type SaveFile,
  type TransferProgressDeps,
} from '@application/use-cases/transfer-progress';
import { appErr, ok } from '@common/result';
import type { Result } from '@common/result';
import { withStamp } from '@domain/entities/progress';
import type { SaveFileLike } from '@ui/save-transfer';

import { saveTransferOptions } from '../../../app/bootstrap/save-transfer';
import { DAY, ORIGIN, at, emptyProgress, levelId, locale, testClock } from '../support/fixtures';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const config = JSON.parse(readFileSync(`${REPO_ROOT}content/game.config.json`, 'utf8')) as {
  readonly save: { readonly maxImportBytes: number };
};

const codec = createJsonSaveCodec({
  maxImportBytes: config.save.maxImportBytes,
  migrations: SAVE_MIGRATIONS,
});

interface Recorder {
  readonly events: string[];
  readonly downloads: SaveFile[];
  readonly reports: string[];
  store: ProgressSnapshot | null;
}

const wire = (behaviour: { failSave?: boolean } = {}) => {
  const recorder: Recorder = { events: [], downloads: [], reports: [], store: null };
  const repository: ProgressRepository = {
    load(): Promise<Result<ProgressSnapshot | null>> {
      return Promise.resolve(ok(recorder.store));
    },
    save(snapshot: ProgressSnapshot): Promise<Result<void>> {
      recorder.events.push('write');
      if (behaviour.failSave === true) {
        return Promise.resolve(appErr('io', 'save.storage.writeFailed', 'full', {}));
      }
      recorder.store = snapshot;
      return Promise.resolve(ok());
    },
    clear(): Promise<Result<void>> {
      recorder.store = null;
      return Promise.resolve(ok());
    },
  };
  const deps: TransferProgressDeps = {
    clock: testClock(),
    repository,
    codec,
    defaultLocale: locale('en'),
    maxImportBytes: config.save.maxImportBytes,
  };
  const inMemory = emptyProgress();
  const options = saveTransferOptions({
    deps,
    progress: () => inMemory,
    writes: {
      hold: () => {
        recorder.events.push('hold');
      },
      release: () => {
        recorder.events.push('release');
      },
    },
    download: (file) => {
      recorder.downloads.push(file);
    },
    restart: () => {
      recorder.events.push('restart');
    },
    report: (message) => {
      recorder.reports.push(message);
    },
  });
  return { recorder, deps, options };
};

const fileOf = (contents: string, size = new TextEncoder().encode(contents).length): SaveFileLike => ({
  size,
  text: () => Promise.resolve(contents),
});

const aSaveFile = (deps: TransferProgressDeps): SaveFileLike => {
  const file = exportSaveFile(deps, withStamp(emptyProgress(), levelId(), at(ORIGIN - DAY)));
  if (!file.ok) throw new Error(`the fixture did not export: ${file.error.code}`);
  return fileOf(file.value.contents);
};

describe('saving to a file, wired', () => {
  it('hands the browser the game in memory as a named JSON file, and writes nothing', () => {
    const { recorder, options } = wire();
    options.onExport();

    expect(recorder.downloads).toHaveLength(1);
    expect(recorder.downloads[0]?.name).toBe('truenorth-progress-2024-03-01.json');
    expect(recorder.downloads[0]?.type).toBe('application/json');
    expect(recorder.events).toEqual([]);
  });
});

describe('opening a file, wired', () => {
  it('refuses a file that is not a save, says why for the console, and touches nothing', async () => {
    const { recorder, options } = wire();
    const check = await options.onImport(fileOf('{"milk":2}'));

    expect(check).toEqual({ kind: 'refused', reason: 'unreadable' });
    expect(recorder.events).toEqual([]);
    expect(recorder.reports).toHaveLength(1);
  });

  it('refuses an oversized file as too big', async () => {
    const { options } = wire();
    const check = await options.onImport(fileOf('{}', config.save.maxImportBytes + 1));
    expect(check).toEqual({ kind: 'refused', reason: 'tooBig' });
  });

  it('writes nothing until the player says yes', async () => {
    const { recorder, deps, options } = wire();
    const check = await options.onImport(aSaveFile(deps));

    expect(check.kind).toBe('ready');
    expect(recorder.events).toEqual([]);
    expect(recorder.store).toBeNull();
  });

  it('holds the game’s own saves before the file is written, and keeps holding them after', async () => {
    const { recorder, deps, options } = wire();
    const check = await options.onImport(aSaveFile(deps));
    if (check.kind !== 'ready') throw new Error('the fixture was refused');

    expect(await check.replace()).toBe(true);
    expect(recorder.events).toEqual(['hold', 'write']);
    expect(recorder.store?.levels.find((level) => level.levelId === 'ottawa')?.stampEarnedAt).not.toBeNull();

    /* The restart is the player's "Continue", not the write's. */
    options.onRestart();
    expect(recorder.events).toEqual(['hold', 'write', 'restart']);
  });

  it('lets the game save again when the store refused the file', async () => {
    const { recorder, deps, options } = wire({ failSave: true });
    const check = await options.onImport(aSaveFile(deps));
    if (check.kind !== 'ready') throw new Error('the fixture was refused');

    expect(await check.replace()).toBe(false);
    expect(recorder.events).toEqual(['hold', 'write', 'release']);
    expect(recorder.store).toBeNull();
    expect(recorder.reports).toHaveLength(1);
  });
});
