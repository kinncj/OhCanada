import { describe, expect, it } from 'vitest';

import { questsForLevel, readQuest, readQuests } from '../../../app/bootstrap/quests';
import type { LevelId } from '@domain/ids';

/**
 * `content/schemas/quest.schema.json`, and the four documents an author has
 * written against it.
 *
 * Two different jobs, and they are different on purpose:
 *
 *  1. **Every quest this build ships loads.** Read from the glob, not from a
 *     list anybody maintains, so a fifth quest lands with this suite already
 *     covering it. A document that will not load is a level that is quietly
 *     poorer than it should be, and quiet is the failure this project keeps
 *     finding.
 *  2. **A malformed document is refused rather than half-drawn.** The fixtures
 *     below are deliberately broken, one field at a time, and each is asserted
 *     to fail — a check that cannot go red certifies nothing.
 *
 * Nothing here asserts a *word* of a quest's copy. The wording is the content
 * author's and is reviewed against `docs/stories/`; what this file owns is
 * whether the surface can draw it at all.
 */

const A_QUEST = {
  $schema: 'https://truenorth.app/schemas/quest.schema.json',
  id: 'quest.somewhere.a-job',
  levelId: 'somewhere',
  giver: 'officer',
  title: { en: 'A job', fr: 'Une mission' },
  summary: { en: 'Do the thing.', fr: 'Faites la chose.' },
  steps: [
    {
      id: 'talk',
      kind: 'talk',
      targetId: 'officer',
      prompt: { en: 'Talk to the officer', fr: "Parlez à l'agent" },
      dialogue: [
        {
          speaker: 'officer',
          text: { en: 'Hello.', fr: 'Bonjour.' },
          fact: { claimsFact: false },
        },
      ],
    },
    {
      id: 'answer',
      kind: 'answer',
      targetId: 'rights',
      prompt: { en: 'Answer 3 questions ({{done}} of 3)', fr: 'Répondez à 3 questions' },
      subject: 'rights',
      count: 3,
    },
  ],
};

const without = (path: readonly string[]): unknown => {
  const copy = structuredClone(A_QUEST) as Record<string, unknown>;
  let node: Record<string, unknown> = copy;
  for (const key of path.slice(0, -1)) node = node[key] as Record<string, unknown>;
  delete node[path[path.length - 1] as string];
  return copy;
};

describe('the quests this build ships', () => {
  const catalogue = readQuests();

  it('loads every document in content/quests, or names the one that will not', () => {
    /*
     * The glob is the list. An author dropping a fifth quest in gets this
     * assertion for free, and a document that fails the shape the surface reads
     * fails here — naming the file and the field — rather than reaching a player
     * as a level with a character who says nothing.
     */
    expect(catalogue.refused, catalogue.refused.join('\n')).toEqual([]);
  });

  it('is honest about a build with no quests at all', () => {
    /*
     * The state this whole surface was written against: `content/quests/` was
     * empty when it was built. An empty catalogue is a normal build — no offer,
     * no tracker, no empty quest log that looks broken — and it must not be a
     * failure, because it was the shipped state for two rounds.
     */
    const empty = readQuests({});
    expect(empty.quests).toEqual([]);
    expect(empty.refused).toEqual([]);
    expect(questsForLevel(empty, 'ottawa' as LevelId)).toEqual([]);
  });

  it('gives a level only its own quests', () => {
    for (const quest of catalogue.quests) {
      const mine = questsForLevel(catalogue, quest.levelId);
      expect(mine).toContain(quest);
      for (const other of mine) expect(other.levelId).toBe(quest.levelId);
    }
  });

  it('reads the same order on every machine', () => {
    /* A glob's key order is the bundler's. Two runs that disagree about which
       quest a level offers first is a difference nobody would look for. */
    expect(readQuests().quests.map((quest) => quest.id)).toEqual(
      catalogue.quests.map((quest) => quest.id),
    );
  });

  it('ships every quest in both languages', () => {
    /*
     * A quest whose French is missing reaches a French player as English text in
     * a French dialog. `app/ui/copy.ts` makes that a compile error for copy;
     * content cannot be typed that way, so it is checked.
     */
    for (const quest of catalogue.quests) {
      for (const value of [quest.title, quest.summary]) {
        expect(value.en, `${String(quest.id)} has no English`).not.toBe('');
        expect(value.fr, `${String(quest.id)} has no French`).not.toBe('');
      }
      for (const step of quest.steps) {
        expect(step.prompt.en, `${String(quest.id)}/${step.id} has no English prompt`).not.toBe('');
        expect(step.prompt.fr, `${String(quest.id)}/${step.id} has no French prompt`).not.toBe('');
      }
    }
  });

  it('sizes every answer step, so the tracker can count to something', () => {
    for (const quest of catalogue.quests) {
      for (const step of quest.steps) {
        if (step.kind !== 'answer') continue;
        expect(step.subject, `${String(quest.id)}/${step.id} draws from no subject`).toBeDefined();
        expect(step.count ?? 0).toBeGreaterThan(0);
      }
    }
  });
});

describe('a document that will not load', () => {
  it('reads a well-formed one', () => {
    const read = readQuest(A_QUEST, 'fixture');
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.value.steps).toHaveLength(2);
      expect(read.value.steps[1]?.count).toBe(3);
    }
  });

  it('reads it through a bundler namespace as well as bare', () => {
    const catalogue = readQuests({ 'a.json': { default: A_QUEST } });
    expect(catalogue.refused).toEqual([]);
    expect(catalogue.quests).toHaveLength(1);
  });

  it.each([
    ['no id', without(['id'])],
    ['no level', without(['levelId'])],
    ['no giver', without(['giver'])],
    ['no title', without(['title'])],
    ['no summary', without(['summary'])],
    ['no steps', without(['steps'])],
    ['not an object', 'a quest'],
    ['no steps at all', { ...A_QUEST, steps: [] }],
  ])('refuses a quest with %s', (_what, document) => {
    expect(readQuest(document, 'fixture').ok).toBe(false);
  });

  it('refuses a quest whose French is missing', () => {
    const half = structuredClone(A_QUEST) as { title: { fr?: string } };
    delete half.title.fr;
    expect(readQuest(half, 'fixture').ok).toBe(false);
  });

  it('refuses an answer step that says how many of nothing', () => {
    const unsized = structuredClone(A_QUEST) as { steps: { count?: number }[] };
    delete unsized.steps[1]?.count;
    expect(readQuest(unsized, 'fixture').ok).toBe(false);
  });

  it('refuses a talk step with nothing for the giver to say', () => {
    /*
     * The step that opens the offer. A quest whose `talk` step carries no
     * dialogue cannot be offered at all, and would present to a player as a
     * character who does not react — so it is refused here, where a developer
     * sees it, rather than in the level.
     */
    expect(readQuest(without(['steps', '0', 'dialogue']), 'fixture').ok).toBe(false);
  });

  it('carries the lines through, in both languages', () => {
    /* The whole of the quest's voice: `app/ui/copy.ts` has no `officer.*` row
       and must not grow one, so a line that does not survive the read is a line
       nobody ever hears. */
    const read = readQuest(A_QUEST, 'fixture');
    expect(read.ok).toBe(true);
    if (read.ok) {
      const lines = read.value.steps[0]?.dialogue ?? [];
      expect(lines).toHaveLength(1);
      expect(lines[0]?.text.en).toBe('Hello.');
      expect(lines[0]?.text.fr).toBe('Bonjour.');
      expect(lines[0]?.fact).toBeDefined();
    }
  });

  it('ships an opening line for every quest in the build', () => {
    for (const quest of readQuests().quests) {
      const first = quest.steps[0];
      expect(first?.kind, `${String(quest.id)} does not open with its giver talking`).toBe('talk');
      expect(
        first?.dialogue?.length ?? 0,
        `${String(quest.id)} opens a dialogue with nothing in it`,
      ).toBeGreaterThan(0);
    }
  });

  it('refuses a step of a kind nothing can play', () => {
    const wrong = structuredClone(A_QUEST) as { steps: { kind: string }[] };
    const step = wrong.steps[0];
    if (step !== undefined) step.kind = 'dance';
    expect(readQuest(wrong, 'fixture').ok).toBe(false);
  });

  it('names the field, so a developer knows what to fix', () => {
    const read = readQuest(without(['steps', '0', 'prompt']), 'content/quests/a.json');
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error.message).toContain('steps[0].prompt');
  });

  it('keeps the quests that do load when one does not', () => {
    /* One malformed document must not take the other three away, and must not
       stop the level it belongs to from being played. */
    const catalogue = readQuests({ 'a.json': A_QUEST, 'b.json': { id: 'broken' } });
    expect(catalogue.quests).toHaveLength(1);
    expect(catalogue.refused).toHaveLength(1);
  });
});
