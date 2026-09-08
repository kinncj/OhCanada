/**
 * TN-SAVE-01, played rather than asserted.
 *
 * The story's background — a character in the second option of every slot, the
 * language in French, reduced motion on, text at 150 %, the quest accepted, the
 * landmark engaged, one question wrong and one right — is *played* through the
 * real use cases, the real codec and the real `localStorage` adapter. Then the
 * tab closes: a new repository is built over the same storage, and what comes
 * back is checked by asking the game questions a player would ask, not by
 * reading fields off a snapshot. A test that asserts "the field is there" passes
 * on a save that no longer means anything.
 *
 * The only fakes are the two ports that must be fakes: the clock and the browser
 * storage.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createLocalStorageProgressRepository } from '@adapters/persistence/local-storage-progress-repository';
import { PROGRESS_STORAGE_KEY } from '@adapters/persistence/local-storage-progress-repository';
import { createJsonSaveCodec } from '@application/persistence/json-save-codec';
import type { SchedulerTuning } from '@application/ports/content-repository';
import { answerQuestion } from '@application/use-cases/answer-question';
import { scheduleReview } from '@application/use-cases/schedule-review';
import {
  importProgress,
  exportProgress,
  loadProgress,
  saveProgress,
} from '@application/use-cases/save-progress';
import type { SaveProgressDeps } from '@application/use-cases/save-progress';
import { offerQuest, questIsOnOffer, startQuest } from '@application/use-cases/start-quest';
import { createPlayerCharacter } from '@domain/entities/character';
import { currentStep } from '@domain/entities/quest';
import {
  hasStamp,
  questStateFor,
  withCharacter,
  withQuestState,
  withSettings,
} from '@domain/entities/progress';
import type { Progress } from '@domain/entities/progress';
import { progressQuest } from '@domain/entities/quest';

import {
  MINUTE,
  emptyProgress,
  levelId,
  locale,
  makeBank,
  makeCharacter,
  makeQuest,
  memoryStorage,
  questId,
  seededRandomSource,
  testClock,
} from '../unit/support/fixtures';
import type { MemoryStorage, TestClock } from '../unit/support/fixtures';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const config = JSON.parse(readFileSync(`${REPO_ROOT}content/game.config.json`, 'utf8')) as {
  readonly save: { readonly maxImportBytes: number };
  readonly scheduler: SchedulerTuning;
  readonly defaultLocale: string;
};

const codec = createJsonSaveCodec({ maxImportBytes: config.save.maxImportBytes });
const quest = makeQuest();
const character = makeCharacter();
const bank = makeBank(3);

/** A session: the ports a running game holds, over one browser's storage. */
interface Session {
  readonly deps: SaveProgressDeps;
  readonly clock: TestClock;
  readonly storage: MemoryStorage;
}

const openTab = (storage: MemoryStorage = memoryStorage()): Session => {
  const clock = testClock();
  return {
    clock,
    storage,
    deps: {
      clock,
      repository: createLocalStorageProgressRepository({ storage, codec }),
      codec,
      defaultLocale: locale(config.defaultLocale),
    },
  };
};

/** Play TN-SAVE-01's background, saving at every moment TN-SAVE-03 names. */
const playTheBackground = async (session: Session): Promise<Progress> => {
  const { deps, clock } = session;

  // The creator: the second option in every selectable slot.
  const created = createPlayerCharacter(character, { skin: 'skin-2', coat: 'coat-blue' });
  expect(created.ok).toBe(true);
  if (!created.ok) throw new Error('the creator must produce a character');
  let progress = withCharacter(emptyProgress(), created.value);
  expect((await saveProgress(deps, progress)).ok).toBe(true);

  // Settings: French, reduced motion, 150 % text.
  progress = withSettings(progress, {
    locale: locale('fr'),
    reducedMotion: true,
    textScale: 1.5,
  });
  expect((await saveProgress(deps, progress)).ok).toBe(true);

  // The officer offers, the player accepts.
  clock.advance(MINUTE);
  const offered = offerQuest(deps, { quest, progress });
  expect(offered.ok).toBe(true);
  if (!offered.ok) throw new Error('the officer must be able to offer');
  const accepted = startQuest(deps, { quest, progress: offered.value.progress, decision: 'accept' });
  expect(accepted.ok).toBe(true);
  if (!accepted.ok) throw new Error('the quest must be acceptable');
  progress = accepted.value.progress;
  expect((await saveProgress(deps, progress)).ok).toBe(true);

  // Parliament Hill is engaged: step 2 completes.
  clock.advance(2 * MINUTE);
  const state = questStateFor(progress, levelId(), questId());
  expect(state).toBeDefined();
  if (state === undefined) throw new Error('the quest must be tracked');
  const visited = progressQuest(quest, state, { kind: 'visit', targetId: 'parliament-hill' }, clock.now());
  expect(visited.ok).toBe(true);
  if (!visited.ok) throw new Error('the landmark must complete step 2');
  progress = withQuestState(progress, levelId(), visited.value.state);
  expect((await saveProgress(deps, progress)).ok).toBe(true);

  // One question wrong, one right, half a minute apart.
  for (const [index, question] of bank.slice(0, 2).entries()) {
    clock.advance(MINUTE / 2);
    const answered = answerQuestion(deps, {
      question,
      chosenIndex: index === 0 ? 3 : question.correctIndex,
      progress,
      quest,
    });
    expect(answered.ok).toBe(true);
    if (!answered.ok) throw new Error('the answer must be recorded');
    progress = answered.value.progress;
    expect((await saveProgress(deps, progress)).ok).toBe(true);
  }

  return progress;
};

describe('TN-SAVE-01 — the same game comes back', () => {
  it('restores every promised item, and proves it by playing on', async () => {
    const first = openTab();
    const played = await playTheBackground(first);

    // ---- the tab closes, and a new one opens over the same browser ----------
    const second = openTab(first.storage);
    const loaded = await loadProgress(second.deps);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const resumed = loaded.value;
    expect(resumed).not.toBeNull();
    if (resumed === null) return;

    // 1: the character, slot for slot. The creator does not run again.
    expect(resumed.character).toEqual({
      characterId: character.id,
      skins: { skin: 'skin-2', coat: 'coat-blue', badge: 'badge-none' },
    });

    // 2 and 3: the language and every accessibility setting.
    expect(resumed.settings.locale).toBe('fr');
    expect(resumed.settings.reducedMotion).toBe(true);
    expect(resumed.settings.textScale).toBe(1.5);
    expect(resumed.settings.subtitles).toBe(true);

    // 4: Ottawa is still playable.
    expect(resumed.levels.some((level) => level.levelId === levelId() && level.unlocked)).toBe(true);

    // 5: the quest, mid-step. The tracker shows "Answer 3 questions (2 of 3)".
    const state = questStateFor(resumed, levelId(), questId());
    expect(state).toMatchObject({ status: 'active', stepIndex: 2, stepProgress: 2 });
    if (state === undefined) return;
    expect(currentStep(quest, state)?.id).toBe('answer-three');
    // ...and the officer gives a reminder rather than a second offer.
    expect(questIsOnOffer(resumed, quest)).toBe(false);

    /*
     * TN-SAVE-01: engaging the landmark again asks the *third* question, and
     * neither of the two already answered.
     *
     * "At the moment the tab reopened" is load-bearing and is not in the story.
     * A question answered wrongly is due again in a minute by design
     * (TN-CARD-04 promises "You will see this question again soon"), so a player
     * who comes back an hour later is offered the missed question ahead of the
     * unseen one — which is TN-CARD-02's promise, and the opposite of this
     * scenario's. The two only agree inside the first minute. That conflict is
     * reported, not resolved here: resolving it would mean either persisting
     * which questions a quest step has already asked (which TN-SAVE says is not
     * saved) or ranking unseen questions above missed ones (which TN-CARD-02
     * forbids).
     */
    second.clock.set(first.clock.now());
    const nextUp = scheduleReview(
      { clock: second.clock, random: seededRandomSource(4242) },
      { questions: bank, count: 1, progress: resumed, tuning: config.scheduler },
    );
    expect(nextUp.ok).toBe(true);
    if (!nextUp.ok) return;
    expect(nextUp.value.questions[0]?.questionId).toBe('q-03');
    expect(nextUp.value.questions[0]?.familiarity).toBe('new');

    // 7: once both come round again, the one answered wrongly is offered first.
    second.clock.advance(20 * MINUTE);
    const drawn = scheduleReview(
      { clock: second.clock, random: seededRandomSource(4242) },
      {
        questions: bank.slice(0, 2),
        count: 2,
        progress: resumed,
        tuning: config.scheduler,
        recentlyAsked: [],
      },
    );
    expect(drawn.ok).toBe(true);
    if (!drawn.ok) return;
    expect(drawn.value.questions.map((question) => question.questionId)).toEqual(['q-01', 'q-02']);
    expect(drawn.value.questions[0]?.familiarity).toBe('seen');

    // ...and answering it finishes the quest and earns the stamp, in the
    // reopened tab, from state that only came out of storage.
    const third = bank[2];
    expect(third).toBeDefined();
    if (third === undefined) return;
    const finished = answerQuestion(second.deps, {
      question: third,
      chosenIndex: 0,
      progress: resumed,
      quest,
    });
    expect(finished.ok).toBe(true);
    if (!finished.ok) return;
    expect(finished.value.questCompleted).toBe(true);
    expect(finished.value.stampEarned).toBe(true);

    // 6: and the stamp itself survives the next close.
    expect((await saveProgress(second.deps, finished.value.progress)).ok).toBe(true);
    const later = openTab(first.storage);
    const reloaded = await loadProgress(later.deps);
    expect(reloaded.ok).toBe(true);
    if (!reloaded.ok || reloaded.value === null) return;
    expect(hasStamp(reloaded.value, levelId())).toBe(true);
    expect(questStateFor(reloaded.value, levelId(), questId())?.status).toBe('completed');
    // 8: Study still offers the subject that was started.
    expect(reloaded.value.subjectsStarted).toEqual([bank[0]?.subject]);

    // The quest cannot be completed twice: the officer has nothing left to offer.
    expect(questIsOnOffer(reloaded.value, quest)).toBe(false);
    expect(played.reviews).toHaveLength(2);
  });

  it('remembers a declined quest as declined, not as never offered', async () => {
    const session = openTab();
    const offered = offerQuest(session.deps, { quest, progress: emptyProgress() });
    expect(offered.ok).toBe(true);
    if (!offered.ok) return;
    const declined = startQuest(session.deps, {
      quest,
      progress: offered.value.progress,
      decision: 'decline',
    });
    expect(declined.ok).toBe(true);
    if (!declined.ok) return;
    expect((await saveProgress(session.deps, declined.value.progress)).ok).toBe(true);

    const reopened = openTab(session.storage);
    const loaded = await loadProgress(reopened.deps);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok || loaded.value === null) return;
    expect(questStateFor(loaded.value, levelId(), questId())?.status).toBe('declined');
    // The tracker is not shown, and the officer offers again.
    expect(questIsOnOffer(loaded.value, quest)).toBe(true);
    expect(offerQuest(reopened.deps, { quest, progress: loaded.value }).ok).toBe(true);
  });
});

describe('TN-SAVE-03 — nothing is written that was not promised', () => {
  it('stores one key holding one document, with a version and a schema', async () => {
    const session = openTab();
    await playTheBackground(session);
    expect([...session.storage.entries.keys()]).toEqual([PROGRESS_STORAGE_KEY]);

    const stored = JSON.parse(session.storage.entries.get(PROGRESS_STORAGE_KEY) ?? '{}') as Record<
      string,
      unknown
    >;
    expect(stored.version).toBe(codec.version);
    expect(stored.$schema).toContain('progress.schema.json');
  });

  it('holds no position, no camera, no open screen and no drill in progress', async () => {
    const session = openTab();
    await playTheBackground(session);
    const raw = session.storage.entries.get(PROGRESS_STORAGE_KEY) ?? '';

    const keysIn = (value: unknown): readonly string[] => {
      if (Array.isArray(value)) return value.flatMap(keysIn);
      if (typeof value === 'object' && value !== null) {
        return Object.entries(value).flatMap(([key, entry]) => [key, ...keysIn(entry)]);
      }
      return [];
    };
    const keys = new Set(keysIn(JSON.parse(raw)));
    for (const forbidden of [
      'x',
      'y',
      'position',
      'velocity',
      'speed',
      'camera',
      'screen',
      'dialogue',
      'drill',
      'name',
    ]) {
      expect([...keys], `the save carries "${forbidden}"`).not.toContain(forbidden);
    }
  });
});

describe('TN-SAVE-04 and TN-SAVE-06 — a broken save, and one carried by hand', () => {
  it('refuses a broken value and leaves it in storage for the player to download', async () => {
    const session = openTab();
    await playTheBackground(session);
    session.storage.entries.set(PROGRESS_STORAGE_KEY, '{not json');

    const reopened = openTab(session.storage);
    const loaded = await loadProgress(reopened.deps);
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error.details).toMatchObject({ raw: '{not json' });
    expect(session.storage.entries.get(PROGRESS_STORAGE_KEY)).toBe('{not json');
  });

  it('carries the same game to a fresh browser through an exported file', async () => {
    const here = openTab();
    const played = await playTheBackground(here);
    const exported = exportProgress(here.deps, played);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const elsewhere = openTab();
    expect((await loadProgress(elsewhere.deps)).ok).toBe(true);
    const imported = importProgress(elsewhere.deps, exported.value);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.value).toEqual(played);

    // Importing does not write: TN-SAVE-06 asks the player to confirm first.
    expect(elsewhere.storage.entries.size).toBe(0);
    expect((await saveProgress(elsewhere.deps, imported.value)).ok).toBe(true);
    const loaded = await loadProgress(elsewhere.deps);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.value).toEqual(played);
  });
});
