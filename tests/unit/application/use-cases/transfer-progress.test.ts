/**
 * TransferProgress against the real codec, the real migrations and a fake
 * store: a save carried out as a file and brought back in (TN-SAVE-06,
 * ADR-0046).
 *
 * The cases that matter most are the refusals, because each is a way to apply
 * half a file or to lose a game: a file over the cap must not even be read, a
 * newer save must be told apart from a broken one, and reading a file must
 * write nothing until the player has said yes.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  CURRENT_SAVE_VERSION,
  createJsonSaveCodec,
} from '@application/persistence/json-save-codec';
import { PROGRESS_SCHEMA_ID } from '@application/persistence/progress-document';
import { SAVE_MIGRATIONS } from '@application/persistence/save-migrations';
import type { ProgressRepository, ProgressSnapshot } from '@application/ports/progress-repository';
import {
  SAVE_FILE_TYPE,
  exportSaveFile,
  readSaveFile,
  refusalFor,
  replaceProgress,
  saveFileName,
  type SaveFileSource,
  type TransferProgressDeps,
} from '@application/use-cases/transfer-progress';
import { appErr, ok } from '@common/result';
import type { Result } from '@common/result';
import { withStamp } from '@domain/entities/progress';

import { DAY, ORIGIN, at, emptyProgress, levelId, locale, testClock } from '../../support/fixtures';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const config = JSON.parse(readFileSync(`${REPO_ROOT}content/game.config.json`, 'utf8')) as {
  readonly save: { readonly maxImportBytes: number };
};
const MAX = config.save.maxImportBytes;

const codec = createJsonSaveCodec({ maxImportBytes: MAX, migrations: SAVE_MIGRATIONS });

interface FakeStore extends ProgressRepository {
  stored: ProgressSnapshot | null;
  writes: number;
}

const fakeStore = (behaviour: { failSave?: boolean } = {}): FakeStore => ({
  stored: null,
  writes: 0,
  load(): Promise<Result<ProgressSnapshot | null>> {
    return Promise.resolve(ok(this.stored));
  },
  save(snapshot: ProgressSnapshot): Promise<Result<void>> {
    if (behaviour.failSave === true) {
      return Promise.resolve(appErr('io', 'save.storage.writeFailed', 'full', {}));
    }
    this.stored = snapshot;
    this.writes += 1;
    return Promise.resolve(ok());
  },
  clear(): Promise<Result<void>> {
    this.stored = null;
    return Promise.resolve(ok());
  },
});

const depsWith = (repository: ProgressRepository): TransferProgressDeps => ({
  clock: testClock(),
  repository,
  codec,
  defaultLocale: locale('en'),
  maxImportBytes: MAX,
});

/** A chosen file, counting how many times anything read it. */
const chosen = (
  contents: string,
  byteLength: number = new TextEncoder().encode(contents).length,
): { readonly file: SaveFileSource; reads(): number } => {
  let reads = 0;
  return {
    file: {
      byteLength,
      readText: (): Promise<string> => {
        reads += 1;
        return Promise.resolve(contents);
      },
    },
    reads: () => reads,
  };
};

const played = () => withStamp(emptyProgress(), levelId(), at(ORIGIN - DAY));

/** The current game as the bytes of a file, or a thrown failure naming why not. */
const exportedBytes = (deps: TransferProgressDeps): string => {
  const file = exportSaveFile(deps, played());
  if (!file.ok) throw new Error(`the fixture did not export: ${file.error.code}`);
  return file.value.contents;
};

describe('naming a save file', () => {
  it('names the file for the product and the day it was made', () => {
    expect(saveFileName(ORIGIN)).toBe('truenorth-progress-2024-03-01.json');
    expect(saveFileName(at(ORIGIN + DAY))).toBe('truenorth-progress-2024-03-02.json');
  });

  it('drops the day rather than the file when the moment cannot be a date', () => {
    expect(saveFileName(at(Number.NaN))).toBe('truenorth-progress.json');
  });
});

describe('saving to a file', () => {
  it('writes the save document, with its version and schema, as JSON', () => {
    const deps = depsWith(fakeStore());
    const file = exportSaveFile(deps, played());
    expect(file.ok).toBe(true);
    if (!file.ok) return;

    expect(file.value.name).toBe('truenorth-progress-2024-03-01.json');
    expect(file.value.type).toBe(SAVE_FILE_TYPE);
    const document = JSON.parse(file.value.contents) as {
      readonly version: number;
      readonly $schema: string;
      readonly levels: readonly { readonly levelId: string; readonly stampEarnedAt: string | null }[];
    };
    expect(document.version).toBe(CURRENT_SAVE_VERSION);
    expect(document.$schema).toBe(PROGRESS_SCHEMA_ID);
    expect(document.levels.find((level) => level.levelId === 'ottawa')?.stampEarnedAt).not.toBeNull();
  });

  it('writes nothing to the store while it does', () => {
    const repository = fakeStore();
    exportSaveFile(depsWith(repository), played());
    expect(repository.writes).toBe(0);
  });
});

describe('reading a file the player chose', () => {
  it('reads a file this game saved back into the same game, and writes nothing yet', async () => {
    const repository = fakeStore();
    const deps = depsWith(repository);
    const { file } = chosen(exportedBytes(deps));

    const reading = await readSaveFile(deps, file);
    expect(reading.kind).toBe('ready');
    if (reading.kind === 'ready') expect(reading.progress).toEqual(played());
    /* TN-SAVE-06: the player confirms before anything is replaced. */
    expect(repository.writes).toBe(0);
  });

  it('refuses a file over the cap without reading a byte of it', async () => {
    const deps = depsWith(fakeStore());
    const { file, reads } = chosen('{}', MAX + 1);

    const reading = await readSaveFile(deps, file);
    expect(reading.kind).toBe('refused');
    if (reading.kind === 'refused') {
      expect(reading.reason).toBe('tooBig');
      expect(reading.error.code).toBe('save.import.tooBig');
    }
    expect(reads()).toBe(0);
  });

  it('refuses a file whose size cannot be known, the same way', async () => {
    const deps = depsWith(fakeStore());
    const { file, reads } = chosen('{}', Number.NaN);

    const reading = await readSaveFile(deps, file);
    expect(reading.kind === 'refused' ? reading.reason : reading.kind).toBe('tooBig');
    expect(reads()).toBe(0);
  });

  it('calls a file that is not JSON unreadable', async () => {
    const reading = await readSaveFile(depsWith(fakeStore()), chosen('my shopping list').file);
    expect(reading.kind).toBe('refused');
    if (reading.kind === 'refused') {
      expect(reading.reason).toBe('unreadable');
      expect(reading.error.code).toBe('save.parse.failed');
    }
  });

  it('calls JSON that is not a save unreadable', async () => {
    const reading = await readSaveFile(depsWith(fakeStore()), chosen('{"milk":2}').file);
    expect(reading.kind === 'refused' ? reading.reason : reading.kind).toBe('unreadable');
  });

  it('calls a save that does not validate unreadable, and writes nothing', async () => {
    const repository = fakeStore();
    const reading = await readSaveFile(
      depsWith(repository),
      chosen('{"version":1,"levels":"all of them"}').file,
    );
    expect(reading.kind === 'refused' ? reading.reason : reading.kind).toBe('unreadable');
    expect(repository.writes).toBe(0);
  });

  it('tells a save from a newer build apart from a broken one', async () => {
    const deps = depsWith(fakeStore());
    const document = JSON.parse(exportedBytes(deps)) as Record<string, unknown>;
    const newer = JSON.stringify({ ...document, version: CURRENT_SAVE_VERSION + 1 });

    const reading = await readSaveFile(deps, chosen(newer).file);
    expect(reading.kind).toBe('refused');
    if (reading.kind === 'refused') {
      expect(reading.reason).toBe('newer');
      expect(reading.error.code).toBe('save.version.newer');
    }
  });

  it('calls a file the browser could not read unreadable', async () => {
    const file: SaveFileSource = {
      byteLength: 10,
      readText: () => Promise.reject(new Error('the file was moved')),
    };
    const reading = await readSaveFile(depsWith(fakeStore()), file);
    expect(reading.kind).toBe('refused');
    if (reading.kind === 'refused') {
      expect(reading.reason).toBe('unreadable');
      expect(reading.error.code).toBe('save.import.readFailed');
    }
  });

  it('brings a file from the previous save version forward through the migrations', async () => {
    const deps = depsWith(fakeStore());
    const document = JSON.parse(exportedBytes(deps)) as Record<string, unknown>;
    const older = JSON.stringify({ ...document, version: CURRENT_SAVE_VERSION - 1 });

    const reading = await readSaveFile(deps, chosen(older).file);
    expect(reading.kind).toBe('ready');
  });
});

describe('what a refusal is called', () => {
  it('names the two refusals a player is told apart, and calls everything else unreadable', () => {
    const error = (code: string) => appErr('invalid', code, 'x', {}).error;
    expect(refusalFor(error('save.import.tooBig'))).toBe('tooBig');
    expect(refusalFor(error('save.version.newer'))).toBe('newer');
    expect(refusalFor(error('save.version.tooOld'))).toBe('unreadable');
    expect(refusalFor(error('save.migration.missing'))).toBe('unreadable');
    expect(refusalFor(error('save.schema.invalid'))).toBe('unreadable');
  });
});

describe('replacing the save with a file', () => {
  it('writes the whole game once, at this build’s version', async () => {
    const repository = fakeStore();
    const deps = depsWith(repository);
    const document = JSON.parse(exportedBytes(deps)) as Record<string, unknown>;
    const reading = await readSaveFile(
      deps,
      chosen(JSON.stringify({ ...document, version: CURRENT_SAVE_VERSION - 1 })).file,
    );
    if (reading.kind !== 'ready') throw new Error('the fixture did not read');

    const replaced = await replaceProgress(deps, reading.progress);
    expect(replaced.ok).toBe(true);
    expect(repository.writes).toBe(1);
    /* Migrated once, and stored migrated. */
    expect(repository.stored?.version).toBe(CURRENT_SAVE_VERSION);
    expect(repository.stored?.levels.find((level) => level.levelId === 'ottawa')?.stampEarnedAt).not.toBeNull();
  });

  it('reports a write the store refused, and the store keeps nothing of the file', async () => {
    const repository = fakeStore({ failSave: true });
    const replaced = await replaceProgress(depsWith(repository), played());
    expect(replaced.ok).toBe(false);
    if (!replaced.ok) expect(replaced.error.code).toBe('save.storage.writeFailed');
    expect(repository.stored).toBeNull();
  });
});
