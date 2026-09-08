/**
 * SaveProgress against a real codec and a fake repository: what is written, what
 * comes back, and what happens when storage will not play (TN-SAVE-03/04/05/06).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  deleteProgress,
  exportProgress,
  importProgress,
  loadProgress,
  saveProgress,
  snapshotOf,
} from '@application/use-cases/save-progress';
import type { SaveProgressDeps } from '@application/use-cases/save-progress';
import { createJsonSaveCodec } from '@application/persistence/json-save-codec';
import type { ProgressRepository, ProgressSnapshot } from '@application/ports/progress-repository';
import { appErr, ok } from '@common/result';
import type { Result } from '@common/result';
import { withStamp } from '@domain/entities/progress';

import { DAY, ORIGIN, at, emptyProgress, levelId, locale, testClock } from '../../support/fixtures';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const config = JSON.parse(readFileSync(`${REPO_ROOT}content/game.config.json`, 'utf8')) as {
  readonly save: { readonly maxImportBytes: number };
};

const codec = createJsonSaveCodec({ maxImportBytes: config.save.maxImportBytes });

interface FakeRepository extends ProgressRepository {
  stored: ProgressSnapshot | null;
  cleared: boolean;
}

const fakeRepository = (
  behaviour: { failLoad?: boolean; failSave?: boolean; failClear?: boolean } = {},
): FakeRepository => ({
  stored: null,
  cleared: false,
  load(): Promise<Result<ProgressSnapshot | null>> {
    if (behaviour.failLoad === true) {
      return Promise.resolve(appErr('invalid', 'save.schema.invalid', 'broken', { raw: '{not json' }));
    }
    return Promise.resolve(ok(this.stored));
  },
  save(snapshot: ProgressSnapshot): Promise<Result<void>> {
    if (behaviour.failSave === true) {
      return Promise.resolve(appErr('io', 'save.storage.writeFailed', 'full', {}));
    }
    this.stored = snapshot;
    return Promise.resolve(ok());
  },
  clear(): Promise<Result<void>> {
    if (behaviour.failClear === true) {
      return Promise.resolve(appErr('io', 'save.storage.clearFailed', 'blocked', {}));
    }
    this.cleared = true;
    this.stored = null;
    return Promise.resolve(ok());
  },
});

const depsWith = (repository: ProgressRepository): SaveProgressDeps => ({
  clock: testClock(),
  repository,
  codec,
  defaultLocale: locale('en'),
});

describe('writing', () => {
  it('stamps the document with the clock and the codec version', async () => {
    const repository = fakeRepository();
    const deps = depsWith(repository);
    const saved = await saveProgress(deps, emptyProgress());
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.version).toBe(codec.version);
    expect(saved.value.updatedAt).toBe(new Date(ORIGIN).toISOString());
    expect(repository.stored).toEqual(saved.value);
  });

  it('reports a storage failure instead of throwing, so the game keeps running', async () => {
    const saved = await saveProgress(depsWith(fakeRepository({ failSave: true })), emptyProgress());
    expect(saved.ok).toBe(false);
    if (!saved.ok) expect(saved.error.kind).toBe('io');
  });

  it('refuses to write a game it could not express as a document', async () => {
    const broken = withStamp(emptyProgress(), levelId(), at(Number.NaN));
    const saved = await saveProgress(depsWith(fakeRepository()), broken);
    expect(saved.ok).toBe(false);
    if (!saved.ok) expect(saved.error.kind).toBe('invalid');
    expect(snapshotOf(depsWith(fakeRepository()), broken).ok).toBe(false);
  });
});

describe('reading', () => {
  it('gives back the game that was written', async () => {
    const repository = fakeRepository();
    const deps = depsWith(repository);
    const progress = withStamp(emptyProgress(), levelId(), ORIGIN);
    expect((await saveProgress(deps, progress)).ok).toBe(true);

    const loaded = await loadProgress(deps);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.value).toEqual(progress);
  });

  it('reads no save at all as no save, not as an error (TN-SAVE-05)', async () => {
    const loaded = await loadProgress(depsWith(fakeRepository()));
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.value).toBeNull();
  });

  it('passes a broken save up with its details intact (TN-SAVE-04)', async () => {
    const loaded = await loadProgress(depsWith(fakeRepository({ failLoad: true })));
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error.details).toMatchObject({ raw: '{not json' });
  });

  it('refuses a document whose timestamps cannot be read', async () => {
    const repository = fakeRepository();
    const deps = depsWith(repository);
    expect((await saveProgress(deps, emptyProgress())).ok).toBe(true);
    const stored = repository.stored;
    expect(stored).not.toBeNull();
    if (stored === null) return;
    repository.stored = { ...stored, updatedAt: stored.updatedAt, levels: [
      { levelId: levelId(), unlocked: true, quests: [], bestScore: 0, stampEarnedAt: 'yesterday' as never },
    ] };
    const loaded = await loadProgress(deps);
    expect(loaded.ok).toBe(false);
  });
});

describe('taking the save away (TN-SAVE-06)', () => {
  it('exports bytes that import back to the same game', () => {
    const deps = depsWith(fakeRepository());
    const progress = withStamp(emptyProgress(), levelId(), at(ORIGIN - DAY));
    const exported = exportProgress(deps, progress);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const imported = importProgress(deps, exported.value);
    expect(imported.ok).toBe(true);
    if (imported.ok) expect(imported.value).toEqual(progress);
  });

  it('refuses a file that is not a save, and writes nothing while doing it', () => {
    const repository = fakeRepository();
    const deps = depsWith(repository);
    const imported = importProgress(deps, '{"version":1,"levels":"all of them"}');
    expect(imported.ok).toBe(false);
    expect(repository.stored).toBeNull();
  });

  it('refuses a file over the cap', () => {
    const deps = depsWith(fakeRepository());
    const imported = importProgress(deps, `{${'x'.repeat(config.save.maxImportBytes)}`);
    expect(imported.ok).toBe(false);
    if (!imported.ok) expect(imported.error.code).toBe('save.import.tooBig');
  });

  it('deletes progress when asked, and reports a refusal', async () => {
    const repository = fakeRepository();
    expect((await deleteProgress(depsWith(repository))).ok).toBe(true);
    expect(repository.cleared).toBe(true);

    const blocked = await deleteProgress(depsWith(fakeRepository({ failClear: true })));
    expect(blocked.ok).toBe(false);
  });
});
