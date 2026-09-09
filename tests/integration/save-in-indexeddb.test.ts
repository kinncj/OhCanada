/**
 * ADR-0026 end to end: a game played into IndexedDB, an existing `localStorage`
 * save carried across on first boot, and a file that moves a save between
 * devices.
 *
 * Everything below the composition root is real — the real `openProgressStore`,
 * the real codec, the real migrations, the real documents. The only fakes are
 * the two the browser owns: `indexedDB` and `localStorage`.
 *
 * The save used here is deliberately not empty. A round trip over
 * `newProgress()` proves that `{}` survives `JSON.stringify`; it proves nothing
 * about a review record in `relearning` on step 2, a declined quest, a stamp and
 * a finished exam, which are the things a player would actually miss.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { openProgressStore } from '@adapters/persistence/progress-store';
import { PROGRESS_STORAGE_KEY } from '@adapters/persistence/record-progress-repository';
import { createJsonSaveCodec } from '@application/persistence/json-save-codec';
import { SAVE_MIGRATIONS } from '@application/persistence/save-migrations';
import { toProgressSnapshot } from '@application/persistence/progress-document';
import {
  deleteProgress,
  exportProgress,
  importProgress,
  loadProgress,
  saveProgress,
} from '@application/use-cases/save-progress';
import type { SaveProgressDeps } from '@application/use-cases/save-progress';
import { DEFAULT_HOLD_TO_CHOOSE_MS } from '@domain/entities/player';
import {
  withBestScore,
  withCharacter,
  withExamAttempt,
  withQuestState,
  withReview,
  withSettings,
  withStamp,
  withSubjectStarted,
} from '@domain/entities/progress';
import type { Progress } from '@domain/entities/progress';

import { fakeIndexedDb } from '../unit/support/fake-indexed-db';
import {
  DAY,
  HOUR,
  ORIGIN,
  at,
  characterId,
  emptyProgress,
  levelId,
  locale,
  memoryStorage,
  questId,
  questionId,
  subjectId,
  testClock,
} from '../unit/support/fixtures';
import type { MemoryStorage } from '../unit/support/fixtures';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const config = JSON.parse(readFileSync(`${REPO_ROOT}content/game.config.json`, 'utf8')) as {
  readonly save: { readonly maxImportBytes: number };
  readonly defaultLocale: string;
};

const codec = createJsonSaveCodec({
  maxImportBytes: config.save.maxImportBytes,
  migrations: SAVE_MIGRATIONS,
});

/** A game somebody has actually played. Losing this would be losing something. */
const playedGame = (): Progress => {
  let progress = withCharacter(emptyProgress(), {
    characterId: characterId('newcomer'),
    skins: { skin: 'skin-2', coat: 'coat-blue' },
  });
  progress = withSettings(progress, {
    locale: locale('fr'),
    reducedMotion: true,
    highContrast: true,
    dyslexiaFont: true,
    textScale: 1.5,
    singleSwitch: true,
    // The setting this ADR added, at a value a switch user would have chosen.
    holdToChooseMs: 2_000,
  });
  progress = withQuestState(progress, levelId(), {
    questId: questId(),
    status: 'active',
    stepIndex: 2,
    stepProgress: 1,
    updatedAt: at(ORIGIN - HOUR),
  });
  progress = withQuestState(progress, levelId(), {
    questId: questId('ottawa-peace-tower'),
    status: 'declined',
    stepIndex: 0,
    stepProgress: 0,
    updatedAt: at(ORIGIN - 2 * HOUR),
  });
  progress = withStamp(progress, levelId(), at(ORIGIN - DAY));
  progress = withBestScore(progress, levelId(), 18);
  progress = withSubjectStarted(progress, subjectId());
  progress = withReview(progress, {
    questionId: questionId('government-1'),
    dueAt: at(ORIGIN + 2 * DAY),
    stability: 4.25,
    difficulty: 6.5,
    reps: 3,
    lapses: 1,
    lastReviewedAt: at(ORIGIN - HOUR),
    firstReviewedAt: at(ORIGIN - 10 * DAY),
    phase: 'relearning',
    learningSteps: 2,
  });
  return withExamAttempt(progress, {
    startedAt: at(ORIGIN - 3 * DAY),
    finishedAt: at(ORIGIN - 3 * DAY + 20 * 60_000),
    answers: [
      {
        questionId: questionId('government-1'),
        subjectId: subjectId(),
        chosenIndex: 1,
        correctIndex: 1,
      },
      {
        questionId: questionId('government-2'),
        subjectId: subjectId(),
        chosenIndex: null,
        correctIndex: 0,
      },
    ],
    passed: true,
    timed: true,
  });
};

interface Tab {
  readonly deps: SaveProgressDeps;
  readonly db: ReturnType<typeof fakeIndexedDb>;
  readonly storage: MemoryStorage;
  readonly backend: string;
  readonly migration: string;
  close(): void;
}

const openTab = async (
  db = fakeIndexedDb(),
  storage: MemoryStorage = memoryStorage(),
): Promise<Tab> => {
  const store = await openProgressStore({ indexedDb: db, localStorage: storage, codec });
  return {
    db,
    storage,
    backend: store.backend,
    migration: store.migration.status,
    close: store.close,
    deps: {
      clock: testClock(),
      repository: store.repository,
      codec,
      defaultLocale: locale(config.defaultLocale),
    },
  };
};

/** The same save as the previous build wrote it: version 1, no hold time. */
const version1Bytes = (progress: Progress): string => {
  const written = toProgressSnapshot(progress, { version: codec.version, updatedAt: ORIGIN });
  if (!written.ok) throw new Error('the fixture must be encodable');
  const { settings, exams, examInProgress: _noSuchField, ...rest } = written.value;
  const { holdToChooseMs: _dropped, ...older } = settings;
  // The inverse of both steps, so this really is a document the version-1 build
  // could have written: no `examInProgress` field at all, and an attempt that is
  // one total rather than twenty outcomes (ADR-0027).
  return JSON.stringify({
    ...rest,
    version: 1,
    settings: older,
    exams: exams.map((attempt) => ({
      startedAt: attempt.startedAt,
      finishedAt: attempt.finishedAt,
      askedQuestionIds: attempt.answers.map((answer) => answer.questionId),
      correctCount: attempt.answers.filter(
        (answer) => answer.chosenIndex === answer.correctIndex,
      ).length,
      passed: attempt.passed,
      timed: attempt.timed,
    })),
  });
};

describe('a game played into IndexedDB comes back', () => {
  it('survives closing the tab, whole', async () => {
    const played = playedGame();
    const first = await openTab();
    expect(first.backend).toBe('indexeddb');
    expect((await saveProgress(first.deps, played)).ok).toBe(true);
    first.close();

    // A new tab against the same browser storage.
    const second = await openTab(first.db, first.storage);
    const loaded = await loadProgress(second.deps);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value).toEqual(played);
    // The setting a switch user would otherwise re-enter every session.
    expect(loaded.value?.settings.holdToChooseMs).toBe(2_000);
  });

  it('leaves localStorage untouched once IndexedDB is doing the work', async () => {
    const tab = await openTab();
    expect((await saveProgress(tab.deps, playedGame())).ok).toBe(true);
    expect([...tab.storage.entries.keys()]).toEqual([]);
    expect([...tab.db.records.keys()]).toEqual([PROGRESS_STORAGE_KEY]);
  });

  it('deletes the game everywhere when the player asks', async () => {
    const tab = await openTab();
    await saveProgress(tab.deps, playedGame());
    expect((await deleteProgress(tab.deps)).ok).toBe(true);
    const loaded = await loadProgress(tab.deps);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.value).toBeNull();
  });
});

describe('an existing player upgrades to this build', () => {
  it('finds their localStorage save moved into IndexedDB, and complete', async () => {
    const played = playedGame();
    const storage = memoryStorage();
    // What the previous build left behind: version 1, in localStorage.
    storage.entries.set(PROGRESS_STORAGE_KEY, version1Bytes(played));

    const tab = await openTab(fakeIndexedDb(), storage);
    expect(tab.migration).toBe('carried');
    expect(tab.storage.entries.has(PROGRESS_STORAGE_KEY)).toBe(false);

    const loaded = await loadProgress(tab.deps);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    // Everything is theirs again except two things version 1 could not carry:
    // the setting, which starts at the game's default, and the exam attempt,
    // which held a total where this build holds twenty outcomes. Both losses are
    // real, both are stated in `save-migrations.ts` rather than glossed, and the
    // second costs no player anything today because nothing has ever written an
    // attempt (ADR-0027).
    expect(loaded.value).toEqual({
      ...played,
      settings: { ...played.settings, holdToChooseMs: DEFAULT_HOLD_TO_CHOOSE_MS },
      exams: [],
    });
    expect(loaded.value?.reviews[0]?.phase).toBe('relearning');
    expect(loaded.value?.reviews[0]?.learningSteps).toBe(2);
  });

  it('keeps playing in a private window, with the older store still holding the save', async () => {
    const played = playedGame();
    const storage = memoryStorage();
    storage.entries.set(PROGRESS_STORAGE_KEY, version1Bytes(played));

    // Firefox's private mode: IndexedDB opens and errors.
    const store = await openProgressStore({
      indexedDb: fakeIndexedDb({ open: 'error' }),
      localStorage: storage,
      codec,
    });
    expect(store.backend).toBe('localstorage');
    const deps: SaveProgressDeps = {
      clock: testClock(),
      repository: store.repository,
      codec,
      defaultLocale: locale(config.defaultLocale),
    };
    const loaded = await loadProgress(deps);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value?.levels[0]?.bestScore).toBe(18);
    // And a save written there is version 2, so the next boot needs no migration.
    expect((await saveProgress(deps, loaded.value as Progress)).ok).toBe(true);
    expect(JSON.parse(storage.entries.get(PROGRESS_STORAGE_KEY) ?? '{}')).toMatchObject({
      version: codec.version,
    });
  });
});

describe('taking the save to another device (TN-SAVE-06)', () => {
  it('round-trips a played game through a file, exactly', async () => {
    const played = playedGame();
    const here = await openTab();
    expect((await saveProgress(here.deps, played)).ok).toBe(true);

    const exported = exportProgress(here.deps, played);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const elsewhere = await openTab();
    const imported = importProgress(elsewhere.deps, exported.value);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.value).toEqual(played);

    // Importing writes nothing until the player confirms (TN-SAVE-06).
    expect(elsewhere.db.records.size).toBe(0);
    expect((await saveProgress(elsewhere.deps, imported.value)).ok).toBe(true);
    const loaded = await loadProgress(elsewhere.deps);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.value).toEqual(played);
  });

  it('round-trips through the file twice without drifting', async () => {
    const tab = await openTab();
    const once = exportProgress(tab.deps, playedGame());
    expect(once.ok).toBe(true);
    if (!once.ok) return;
    const back = importProgress(tab.deps, once.value);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    const twice = exportProgress(tab.deps, back.value);
    expect(twice.ok).toBe(true);
    if (twice.ok) expect(twice.value).toBe(once.value);
  });

  it('refuses a file that is not ours, with something the player can be told', async () => {
    const tab = await openTab();
    const refusals = [
      { file: 'not a file at all', code: 'save.parse.failed' },
      { file: '{"someoneElses":"document"}', code: 'save.version.missing' },
      // A file that parses to an empty object is not a save. It has no version,
      // so it is refused before the schema sees it — and it must never be read
      // as "a player with no progress" (ADR-0024).
      { file: '{}', code: 'save.version.missing' },
      { file: '{"version":99,"settings":{}}', code: 'save.version.newer' },
      { file: `{"version":${codec.version},"levels":"all of them"}`, code: 'save.schema.invalid' },
    ];

    for (const { file, code } of refusals) {
      const imported = importProgress(tab.deps, file);
      expect(imported.ok, file).toBe(false);
      if (imported.ok) continue;
      expect(imported.error.code, file).toBe(code);
      // Something a screen can map to copy, and a sentence with no stack in it.
      expect(imported.error.message).toMatch(/^[A-Z].*\.$/u);
      expect(imported.error.message).not.toContain('Error');
    }
  });

  it('refuses a file bigger than the cap before parsing it', async () => {
    const tab = await openTab();
    const huge = `{${'x'.repeat(config.save.maxImportBytes)}`;
    const imported = importProgress(tab.deps, huge);
    expect(imported.ok).toBe(false);
    if (!imported.ok) expect(imported.error.code).toBe('save.import.tooBig');
  });

  it('leaves the saved game alone when an import is refused', async () => {
    const played = playedGame();
    const tab = await openTab();
    expect((await saveProgress(tab.deps, played)).ok).toBe(true);
    expect(importProgress(tab.deps, '{}').ok).toBe(false);
    const loaded = await loadProgress(tab.deps);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.value).toEqual(played);
  });
});
