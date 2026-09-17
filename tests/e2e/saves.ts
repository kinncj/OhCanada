import { readFileSync } from 'node:fs';

import type { Page } from '@playwright/test';

import { PROGRESS_STORAGE_KEY } from '@adapters/persistence/record-progress-repository';
import { createJsonSaveCodec } from '@application/persistence/json-save-codec';
import { toProgressSnapshot } from '@application/persistence/progress-document';
import { SAVE_MIGRATIONS } from '@application/persistence/save-migrations';
import type { PlayerCharacter } from '@domain/entities/character';
import { defaultSettings } from '@domain/entities/player';
import { newProgress, withCharacter, withQuestState, withStamp } from '@domain/entities/progress';
import type { CharacterId, EpochMillis, LevelId, LocaleCode, QuestId } from '@domain/ids';

/**
 * Saves a scenario starts from, written by the game's own functions.
 *
 * Walking a quest to the end takes minutes on SwiftShader and is already
 * `level-quest.spec.ts`'s job. A scenario about what happens *after* a step —
 * the closing line on the card, the level that opens, the end of a level whose
 * task is already done — starts from a save instead: `newProgress`,
 * `withQuestState`, `withStamp`, `toProgressSnapshot` and the JSON save codec,
 * put where ADR-0026 says an existing save is carried from — `localStorage`,
 * before the first boot, into an empty IndexedDB. Nothing about the save's
 * format is typed out here, so a format change moves these with it rather than
 * breaking them silently.
 *
 * Moved out of `quest-moments.spec.ts` when `level-end-to-next.spec.ts` needed
 * the same saves (ADR-0036).
 */

/**
 * The settings a seeded save carries: the shipped defaults, with auto-walk off.
 *
 * Off because these saves exist for scenarios about quests, cards and the end of
 * a level, and every one of them walks the player there by holding a control
 * (`walk.ts`). Since ADR-0058 the shipped default walks by itself, so a seeded
 * save that took the defaults whole would put a second driver into scenarios
 * that are not about driving. `tests/e2e/held-drive.ts` says the same thing for
 * the specs that seed no save of their own, and
 * `tests/e2e/auto-walk-by-default.spec.ts` is where the default itself is proved.
 */
const seededSettings = (locale: 'en' | 'fr' = 'en') => ({
  ...defaultSettings(locale as LocaleCode),
  autoMove: false,
});

/** As much of a quest document as a seeded save needs. */
export interface SeededQuest {
  readonly id: string;
  readonly levelId: string;
  readonly steps: readonly { readonly kind: string; readonly count?: number }[];
}

const codec = createJsonSaveCodec({ maxImportBytes: 10_000_000, migrations: SAVE_MIGRATIONS });

/**
 * The character a seeded save carries: every player-selectable slot at the
 * option the rig itself would fall back to.
 *
 * A seeded save used to carry none, and `ensureCharacter` only opens the
 * creator when the title offers a first run — which a save suppresses. So a
 * scenario that seeded a save and then asked for a character got one only when
 * the title happened to render *before* the save was read out of
 * `localStorage`, and none when the store won. `save-file.spec.ts` asserting
 * "the character made in the creator is not in the file" therefore passed by
 * winning a boot race the wrong way round, and failed on a loaded runner: it
 * failed the deploy of `bc34e01` and passed on the same commit under review.
 *
 * The save carries the character outright instead, so nothing about it depends
 * on which of two asynchronous things finishes first.
 */
interface RigSlotFile {
  readonly playerSelectable?: boolean;
  readonly options: readonly string[];
  readonly fallback: string | null;
}

interface RigFile {
  readonly artboards: readonly {
    readonly characterId?: string;
    readonly playerSelectableSlots?: readonly string[];
  }[];
  readonly slots: Readonly<Record<string, RigSlotFile | undefined>>;
}

/*
 * The rig read as a file, not imported.
 *
 * `app/bootstrap/character-slots.ts` is the module that knows this rule, and
 * importing it from here is what a first attempt did - but it imports
 * `content/characters/rig.json` as a module, and Playwright's Node loader
 * refuses a JSON import with no `with { type: 'json' }`. Every e2e shard died at
 * load, before a test ran. A spec reads content from disk, as `save-file.spec.ts`
 * already does, so the rule is mirrored here rather than imported.
 */
const RIG = JSON.parse(
  readFileSync(new URL('../../content/characters/rig.json', import.meta.url), 'utf8'),
) as RigFile;

function seededCharacter(): PlayerCharacter {
  const artboard = RIG.artboards.find((board) => (board.playerSelectableSlots?.length ?? 0) > 0);
  const listed = artboard?.playerSelectableSlots ?? [];
  const names = [
    ...listed.filter((name) => RIG.slots[name] !== undefined),
    ...Object.keys(RIG.slots).filter((name) => !listed.includes(name)),
  ];
  const skins: Record<string, string> = {};
  for (const name of names) {
    const slot = RIG.slots[name];
    if (slot === undefined || slot.playerSelectable !== true || slot.options.length === 0) continue;
    skins[name] =
      slot.fallback !== null && slot.options.includes(slot.fallback)
        ? slot.fallback
        : (slot.options[0] ?? '');
  }
  return { characterId: (artboard?.characterId ?? 'player') as CharacterId, skins };
}

/** A save in which this level's quest is complete and its stamp earned, as the game writes one. */
export function finishedSave(quest: SeededQuest): string {
  const now = Date.now() as EpochMillis;
  const level = quest.levelId as LevelId;
  let progress = newProgress(seededSettings(), [level]);
  progress = withCharacter(progress, seededCharacter());
  progress = withQuestState(progress, level, {
    questId: quest.id as QuestId,
    status: 'completed',
    stepIndex: quest.steps.length - 1,
    stepProgress: 0,
    updatedAt: now,
  });
  progress = withStamp(progress, level, now);
  return encodeSave(progress, now);
}

/**
 * A save one answer short of finishing this level's quest: accepted, on its last
 * step, with that step's count all but met — and **no stamp**, because the
 * answer that finishes the quest is what earns it. That is the route whose card
 * reads "Task done!", which is the only card a quest's closing line is drawn on.
 */
export function oneAnswerFromDoneSave(quest: SeededQuest): string {
  const lastIndex = quest.steps.length - 1;
  const last = quest.steps[lastIndex];
  if (last?.kind !== 'answer') {
    throw new Error(
      `${quest.id} does not end on an answer step, so no single answer can finish it. ` +
        'Point this scenario at a quest that does.',
    );
  }
  const now = Date.now() as EpochMillis;
  const level = quest.levelId as LevelId;
  const progress = withQuestState(newProgress(seededSettings(), [level]), level, {
    questId: quest.id as QuestId,
    status: 'active',
    stepIndex: lastIndex,
    stepProgress: Math.max(1, last.count ?? 1) - 1,
    updatedAt: now,
  });
  return encodeSave(progress, now);
}

/** Where a saved quest in progress stands, and how the save was set up. */
export interface SavedTask {
  /** The step the player is on: `1` is the step after the offer. */
  readonly stepIndex: number;
  /** Answers already counted on that step. */
  readonly stepProgress?: number;
  readonly locale?: 'en' | 'fr';
  /** 1 to 2, the way the save keeps text size (100 % to 200 %). */
  readonly textScale?: number;
}

/**
 * A save with this level's quest accepted and in progress, as a player leaves
 * one when they close the tab mid-task: no stamp, the quest on `stepIndex`, and
 * the language and text size they chose. What a reload, Continue or the map
 * opens the level with (`TN-FLOW-02`, `TN-SAVE-01`).
 */
export function activeQuestSave(quest: SeededQuest, saved: SavedTask): string {
  if (quest.steps[saved.stepIndex] === undefined) {
    throw new Error(`${quest.id} has no step ${String(saved.stepIndex)} to save a player on.`);
  }
  const now = Date.now() as EpochMillis;
  const level = quest.levelId as LevelId;
  const settings = {
    ...seededSettings(saved.locale ?? 'en'),
    textScale: saved.textScale ?? 1,
  };
  const progress = withQuestState(newProgress(settings, [level]), level, {
    questId: quest.id as QuestId,
    status: 'active',
    stepIndex: saved.stepIndex,
    stepProgress: saved.stepProgress ?? 0,
    updatedAt: now,
  });
  return encodeSave(progress, now);
}

/** The save as the game writes one: snapshot, then the JSON codec. */
function encodeSave(progress: ReturnType<typeof newProgress>, now: EpochMillis): string {
  const snapshot = toProgressSnapshot(progress, { version: codec.version, updatedAt: now });
  if (!snapshot.ok) throw new Error(`the seeded save is not a save: ${snapshot.error.message}`);
  const encoded = codec.encode(snapshot.value);
  if (!encoded.ok) throw new Error(`the seeded save would not encode: ${encoded.error.message}`);
  return encoded.value;
}

/**
 * Put a save where an older build would have left one, before the game boots.
 *
 * Once per tab: an init script runs on every navigation, and a save written
 * again after the game has carried the first one into IndexedDB would be a
 * second, stale copy the store keeps rather than reads.
 */
export async function seed(page: Page, bytes: string): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      if (window.sessionStorage.getItem('tn-e2e-seeded') !== null) return;
      window.sessionStorage.setItem('tn-e2e-seeded', '1');
      window.localStorage.setItem(key, value);
    },
    { key: PROGRESS_STORAGE_KEY, value: bytes },
  );
}
