/**
 * Fixtures for the domain-entity, use-case and persistence suites.
 *
 * Everything here builds a *valid* document — one `make validate-content` would
 * accept — so a test that wants an invalid one has to say which property it
 * broke, in the test, where a reader can see it.
 *
 * The fake `Clock` and `RandomSource` live here rather than in `app/adapters`
 * because they are test doubles for ports, not implementations of them: a use
 * case test that depended on the real adapters would fail when those are
 * refactored, and would be testing the adapters as much as the rule.
 */

import type {
  CharacterId,
  EpochMillis,
  IsoInstant,
  LevelId,
  LocaleCode,
  PoiId,
  QuestId,
  QuestionId,
  SubjectId,
} from '@domain/ids';
import type {
  CharacterDocument,
  LevelDocument,
  QuestDocument,
  QuestionDocument,
} from '@application/ports/content-repository';
import type { Clock } from '@application/ports/clock';
import type { RandomSource, SeededRandomSource } from '@application/ports/random-source';
import type { WebStorage } from '@adapters/persistence/web-storage';
import type { LocalizedText } from '@domain/entities/values';
import { defaultSettings } from '@domain/entities/player';
import type { Settings } from '@domain/entities/player';
import { newProgress } from '@domain/entities/progress';
import type { Progress } from '@domain/entities/progress';

/** The only place a test casts a string into a branded id. */
export const brandId = <T extends string>(value: string): T => value as T;

export const levelId = (value = 'ottawa'): LevelId => brandId<LevelId>(value);
export const questId = (value = 'ottawa-parliament-hill'): QuestId => brandId<QuestId>(value);
export const questionId = (value: string): QuestionId => brandId<QuestionId>(value);
export const subjectId = (value = 'government'): SubjectId => brandId<SubjectId>(value);
export const characterId = (value = 'officer'): CharacterId => brandId<CharacterId>(value);
export const poiId = (value = 'parliament-hill'): PoiId => brandId<PoiId>(value);
export const locale = (value = 'en'): LocaleCode => brandId<LocaleCode>(value);

export const at = (millis: number): EpochMillis => millis as EpochMillis;

/** 2024-03-01T12:00:00.000Z — a round instant nowhere near a DST or leap boundary. */
export const ORIGIN = at(Date.UTC(2024, 2, 1, 12, 0, 0));

export const MINUTE = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

export const text = (en: string, fr = `${en} (fr)`): LocalizedText => ({ en, fr });

const SOURCE_HASH = 'a'.repeat(64);

export const factSource = (): QuestionDocument['source'] => ({
  sourceId: 'discover-canada',
  chapter: 'How Canadians Govern Themselves',
  quote: 'Canada is a federal state, a parliamentary democracy and a constitutional monarchy.',
  url: 'https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/discover-canada.html',
  sourceHash: SOURCE_HASH,
  asOf: '2024-01-05T00:00:00.000Z' as IsoInstant,
  volatile: false,
});

export const factVerification = (): QuestionDocument['verification'] => ({
  status: 'verified',
  model: 'test-oracle',
  checkedAt: '2024-01-06T00:00:00.000Z' as IsoInstant,
  sourceHash: SOURCE_HASH,
  evidence: 'Canada is a federal state, a parliamentary democracy and a constitutional monarchy.',
});

export const makeQuestion = (
  id: string,
  overrides: Partial<QuestionDocument> = {},
): QuestionDocument => ({
  $schema: '../../schemas/question.schema.json',
  id: questionId(id),
  subject: subjectId(),
  prompt: text(`Prompt for ${id}`),
  options: [text('One'), text('Two'), text('Three'), text('Four')],
  correctIndex: 0,
  explanation: text(`Explanation for ${id}`),
  source: factSource(),
  verification: factVerification(),
  ...overrides,
});

/** A bank of `count` verified questions, `q-01` upward. */
export const makeBank = (count: number): readonly QuestionDocument[] =>
  Array.from({ length: count }, (_unused, index) =>
    makeQuestion(`q-${`${index + 1}`.padStart(2, '0')}`),
  );

/** `quest.ottawa.parliament-hill` as TN-QUEST describes it: talk, visit, answer three. */
export const makeQuest = (overrides: Partial<QuestDocument> = {}): QuestDocument => ({
  $schema: '../schemas/quest.schema.json',
  id: questId(),
  levelId: levelId(),
  giver: characterId(),
  title: text('Skate to Parliament Hill'),
  summary: text('Find the Peace Tower and answer three questions.'),
  steps: [
    {
      id: 'talk-officer',
      kind: 'talk',
      targetId: 'officer',
      prompt: text('Talk to the officer'),
    },
    {
      id: 'visit-hill',
      kind: 'visit',
      targetId: 'parliament-hill',
      prompt: text('Find the Peace Tower'),
    },
    {
      id: 'answer-three',
      kind: 'answer',
      targetId: 'government',
      prompt: text('Answer 3 questions'),
      subject: subjectId(),
      count: 3,
    },
  ],
  ...overrides,
});

export const makeCharacter = (overrides: Partial<CharacterDocument> = {}): CharacterDocument => ({
  $schema: '../schemas/character.schema.json',
  id: characterId('skater'),
  name: text('Skater'),
  artboard: 'skater',
  stateMachine: 'locomotion',
  inputs: [{ name: 'speed', kind: 'number' }],
  slots: [
    {
      name: 'skin',
      labelKey: 'creator.slot.skin',
      playerSelectable: true,
      options: [
        { id: 'skin-1', labelKey: 'creator.skin.one' },
        { id: 'skin-2', labelKey: 'creator.skin.two' },
      ],
      fallback: 'skin-1',
    },
    {
      name: 'coat',
      labelKey: 'creator.slot.coat',
      playerSelectable: true,
      options: [
        { id: 'coat-red', labelKey: 'creator.coat.red' },
        { id: 'coat-blue', labelKey: 'creator.coat.blue' },
      ],
      fallback: 'coat-red',
    },
    {
      name: 'badge',
      labelKey: 'creator.slot.badge',
      playerSelectable: false,
      options: [{ id: 'badge-none', labelKey: 'creator.badge.none' }],
      fallback: 'badge-none',
    },
  ],
  indigenous: false,
  ...overrides,
});

/** The part of a level document the domain reads. Placement, not geometry. */
export const makeLevel = (): Pick<
  LevelDocument,
  'id' | 'subject' | 'order' | 'title' | 'spawn' | 'quests' | 'pois' | 'characters'
> => ({
  id: levelId(),
  subject: subjectId(),
  order: 4,
  title: text('Ottawa'),
  spawn: { x: 240, y: 1500 },
  quests: [questId()],
  pois: [
    {
      id: poiId(),
      name: text('Parliament Hill'),
      blurb: text('The Peace Tower stands at the centre of Centre Block.'),
      fact: { factual: true, source: factSource(), verification: factVerification() },
      position: { x: 3200, y: 1400 },
      artKey: 'parliament-hill',
      radiusPx: 220,
      questId: questId(),
    },
  ],
  characters: [
    {
      characterId: characterId(),
      position: { x: 600, y: 1500 },
      facing: 'right',
      questId: questId(),
    },
  ],
});

export const settings = (overrides: Partial<Settings> = {}): Settings => ({
  ...defaultSettings(locale()),
  ...overrides,
});

export const emptyProgress = (overrides: Partial<Progress> = {}): Progress => ({
  ...newProgress(settings(), [levelId()]),
  ...overrides,
});

/** A `Clock` a test drives by hand. Nothing here reads the wall clock. */
export interface TestClock extends Clock {
  set(millis: EpochMillis): void;
  advance(millis: number): void;
}

export const testClock = (start: EpochMillis = ORIGIN): TestClock => {
  let current = start;
  let monotonic = 0;
  return {
    now: () => current,
    nowIso: () => new Date(current).toISOString() as IsoInstant,
    elapsed: () => monotonic,
    set(millis) {
      current = millis;
    },
    advance(millis) {
      current = at(current + millis);
      monotonic += millis;
    },
  };
};

/** mulberry32: 32 bits of state, reproducible from a seed. */
const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** A `SeededRandomSource` for the use-case tests: the whole port, reproducible. */
export const seededRandomSource = (seed: number): SeededRandomSource => {
  const next = mulberry32(seed);
  const source: SeededRandomSource = {
    seed,
    next,
    int: (minInclusive, maxExclusive) =>
      minInclusive + Math.floor(next() * Math.max(0, maxExclusive - minInclusive)),
    pick: <T>(items: readonly T[]): T | undefined =>
      items.length === 0 ? undefined : items[Math.floor(next() * items.length)],
    shuffle: <T>(items: readonly T[]): readonly T[] => {
      const copy = [...items];
      for (let index = copy.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(next() * (index + 1));
        const held = copy[index] as T;
        copy[index] = copy[swap] as T;
        copy[swap] = held;
      }
      return copy;
    },
    fork: (label: string) =>
      seededRandomSource(
        [...label].reduce((hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16777619), seed >>> 0) >>> 0,
      ),
  };
  return source;
};

/** `RandomSource` narrowed to the one method the scheduler uses. */
export const fixedRandom = (value = 0.5): RandomSource => ({
  next: () => value,
  int: (minInclusive) => minInclusive,
  pick: <T>(items: readonly T[]): T | undefined => items[0],
  shuffle: <T>(items: readonly T[]): readonly T[] => [...items],
});

/** `localStorage` as a `Map`, with the failure modes TN-SAVE-05 names. */
export interface MemoryStorage extends WebStorage {
  readonly entries: Map<string, string>;
}

export const memoryStorage = (
  fail: { read?: boolean; write?: boolean; clear?: boolean } = {},
): MemoryStorage => {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem(key) {
      if (fail.read === true) throw new Error('storage read blocked');
      return entries.get(key) ?? null;
    },
    setItem(key, value) {
      if (fail.write === true) throw new Error('QuotaExceededError');
      entries.set(key, value);
    },
    removeItem(key) {
      if (fail.clear === true) throw new Error('storage clear blocked');
      entries.delete(key);
    },
  };
};
