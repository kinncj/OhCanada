import { describe, expect, it, vi } from 'vitest';

import { createQuestController } from '../../../app/bootstrap/quest';
import { readQuests } from '../../../app/bootstrap/quests';
import { createSettingsStore } from '@ui/settings';
import { hasCopyRow, text, UI_LOCALES, type UiLocale } from '@ui/copy';
import type { QuestDocument } from '@application/ports';

import { buildPage, type FakePage } from '../ui/support/fake-dom';
import {
  brandId,
  characterId,
  emptyProgress,
  levelId,
  makeQuest,
  testClock,
  text as localised,
} from '../support/fixtures';
import type { CharacterId, LevelId } from '@domain/ids';

/**
 * `docs/stories/TN-GUIDE-02` — "a character with no name gives no quest".
 *
 * The defect this file exists to make impossible was live in the shipped build:
 * `content/quests/halifax-clock-and-pier.json`,
 * `content/quests/quebec-city-chateau-frontenac.json` and
 * `content/quests/toronto-cn-tower.json` all declare `"giver": "guide"`, and no
 * `npc.guide.name` row existed. `app/ui/dialogue.ts` takes the speaker's name as
 * a **required** option — `TN-QUEST-08` refuses a dialog whose accessible name
 * is "Speaker", "NPC" or nothing — so `app/bootstrap/quest.ts` refused all three
 * offers. Three quarters of the authored quests could not be given, on a build
 * where every suite was green, and one of the three is **Halifax, the level
 * `content/game.config.json` opens on**.
 *
 * Nothing joined a quest's `giver` to the copy table, so the only thing that
 * went red was the console. This is that join, in two halves that fail for
 * different reasons:
 *
 *  1. **the build check** — every shipped quest's giver has a name row in
 *     English *and* in French, proven against a fixture giver that has neither,
 *     so the rule cannot pass vacuously;
 *  2. **the refusal** — a giver this build cannot name is refused at runtime,
 *     loudly, rather than opened in a dialog a screen reader announces as
 *     nothing. That path stays covered now that no shipped quest takes it.
 *
 * No wording is asserted here beyond the two rows `TN-GUIDE` writes down:
 * `tests/unit/ui/copy.test.ts` owns the table.
 */

/** `npc.<giver>.name`, the key `app/bootstrap/quest.ts` looks a speaker up by. */
const nameKeyFor = (quest: QuestDocument): string => `npc.${String(quest.giver)}.name`;

/**
 * What a giver's name looks like in one language: the string, or `null` when
 * this build has no row at all.
 *
 * A parameter rather than a direct call so the rule below can be run against a
 * table that is missing a French row — which the real one cannot be, because
 * `app/ui/copy.ts` types `FR` against `keyof typeof EN` and a missing French
 * string is a compile error. A rule that can only be run against a table that
 * cannot break is a rule nobody has tested.
 */
type NameLookup = (locale: UiLocale, key: string) => string | null;

const FROM_THE_COPY_TABLE: NameLookup = (locale, key) =>
  hasCopyRow(key) ? text(locale, key as Parameters<typeof text>[1]) : null;

/**
 * The languages a giver's name is missing in, or `[]` when the build can name
 * them. One function, used by the check and by the two fixtures that prove it.
 */
function missingNameLocales(
  quest: QuestDocument,
  lookup: NameLookup = FROM_THE_COPY_TABLE,
): readonly UiLocale[] {
  const key = nameKeyFor(quest);
  return UI_LOCALES.filter((locale) => (lookup(locale, key) ?? '').trim() === '');
}

describe('every quest this build ships can name the character who gives it', () => {
  const catalogue = readQuests();

  it('has a name row for every giver, in English and in French', () => {
    /*
     * Read from the glob, not from a list anybody maintains, so a fifth quest
     * lands with this covering it. The message names the quest, the giver and
     * the key, which is what `TN-GUIDE-02` asks the failure to say.
     */
    expect(catalogue.quests.length, 'no quest was read — this rule must not pass vacuously')
      .toBeGreaterThan(0);

    const unnameable = catalogue.quests
      .filter((quest) => missingNameLocales(quest).length > 0)
      .map(
        (quest) =>
          `${String(quest.id)} is given by "${String(quest.giver)}" and app/ui/copy.ts has ` +
          `no ${nameKeyFor(quest)} in ${missingNameLocales(quest).join(' and ')}`,
      );

    expect(unnameable, unnameable.join('\n')).toEqual([]);
  });

  it('names the guide, which is what three of the four quests waited on', () => {
    /*
     * Not a re-statement of the row — `tests/unit/ui/copy.test.ts` owns the
     * words — but of the join: the three documents that declare `guide` are
     * asked, by their own `giver` field, whether this build can name them.
     */
    const byGuide = catalogue.quests.filter((quest) => String(quest.giver) === 'guide');
    expect(
      byGuide.map((quest) => String(quest.id)).sort(),
      'no quest is given by the guide any more, so this scenario is about nothing',
    ).toEqual([
      'halifax-clock-and-pier',
      'quebec-city-chateau-frontenac',
      'toronto-cn-tower',
    ]);
    for (const quest of byGuide) expect(missingNameLocales(quest)).toEqual([]);
  });

  it('is proven by a giver nothing has a word for', () => {
    /* A check that cannot go red certifies nothing. The fixture is refused in
       both languages, and a build that gave it a row would fail this line. */
    const nameless = makeQuest({ giver: characterId('nobody') });
    expect(missingNameLocales(nameless)).toEqual([...UI_LOCALES]);
    expect(hasCopyRow(nameKeyFor(nameless))).toBe(false);
  });

  it('fails a giver named in one language only', () => {
    /*
     * `TN-GUIDE-02`, second scenario: "a row present in one language only fails
     * the same check". Run against a table that has the English and not the
     * French, because the real table cannot be in that state — and a rule that
     * has never seen the state it is written for is a rule nobody has tested.
     */
    const englishOnly: NameLookup = (locale, key) =>
      locale === 'en' ? FROM_THE_COPY_TABLE('en', key) : '';

    expect(missingNameLocales(questGivenBy(characterId('guide')), englishOnly)).toEqual(['fr']);
    /* And the same giver passes against the table this build actually ships. */
    expect(missingNameLocales(questGivenBy(characterId('guide')))).toEqual([]);
  });
});

/* ----------------------------------------------- the refusal, at the seam --- */

interface Harness {
  readonly page: FakePage;
  readonly controller: ReturnType<typeof createQuestController>;
  readonly opened: () => number;
}

function harnessFor(quests: readonly QuestDocument[], level = 'halifax'): Harness {
  const page = buildPage();
  let opens = 0;
  let progress = emptyProgress();

  const controller = createQuestController({
    levelId: brandId<LevelId>(level),
    quests,
    host: page.host,
    store: createSettingsStore(),
    clock: testClock(),
    announce: vi.fn(),
    progress: () => progress,
    commit: (next) => {
      progress = next;
    },
    setTask: vi.fn(),
    onOpen: () => {
      opens += 1;
    },
    onClose: vi.fn(),
    onCompleted: vi.fn(),
    restoreFocusTo: () => null,
  });

  return { page, controller, opened: () => opens };
}

/** A quest whose giver has a name row, and one whose giver has none. */
const questGivenBy = (giver: CharacterId): QuestDocument =>
  makeQuest({
    id: brandId('a-quest'),
    levelId: levelId('halifax'),
    giver,
    steps: [
      {
        id: 'talk',
        kind: 'talk',
        targetId: String(giver),
        prompt: localised('Talk to them', 'Parlez-leur'),
        dialogue: [
          {
            speaker: String(giver),
            text: localised('Hello.', 'Bonjour.'),
            fact: { claimsFact: false },
          },
        ],
      },
      ...makeQuest().steps.slice(1),
    ] as QuestDocument['steps'],
  });

describe('a giver this build cannot name', () => {
  it('is not offered a prompt, because the prompt would open nothing', () => {
    /* `canEngage` is what the composition root asks **before** it draws a
       prompt, and a control that opens nothing is the dead button this project
       keeps finding. */
    const { controller } = harnessFor([questGivenBy(characterId('nobody'))]);
    expect(controller.isGiver('nobody'), 'the fixture is not a giver at all').toBe(true);
    expect(controller.canEngage('nobody')).toBe(false);
  });

  it('opens no dialog, and says so where a developer will see it', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { controller, page, opened } = harnessFor([questGivenBy(characterId('nobody'))]);

      expect(controller.engage('nobody'), 'an unnamed dialog was opened').toBe(false);
      expect(page.doc.byTestId('dialogue'), 'a dialog with no accessible name mounted').toBe(null);
      expect(opened(), 'the level was taken for a dialogue that never opened').toBe(0);

      const said = error.mock.calls.flat().join(' ');
      expect(said).toContain('npc.<id>.name');
      expect(said).toContain('nobody');
    } finally {
      error.mockRestore();
    }
  });
});

describe('the guide, now that it has a name', () => {
  it('opens a dialog named after it, and offers the quest', () => {
    const { controller, page } = harnessFor([questGivenBy(characterId('guide'))]);

    expect(controller.canEngage('guide')).toBe(true);
    expect(controller.engage('guide'), 'the guide still says nothing').toBe(true);

    const dialog = page.doc.byTestId('dialogue');
    expect(dialog, 'the guide opened no dialogue').not.toBe(null);
    /* `TN-QUEST-08`: the dialog's accessible name is the speaker's, and the
       same string is drawn, so it is seen as well as heard. */
    const speaker = page.doc.byTestId('dialogue-speaker');
    expect(speaker?.textContent).toBe(text('en', 'npc.guide.name'));
    expect(
      page.doc.getElementById(dialog?.getAttribute('aria-labelledby') ?? '')?.textContent,
    ).toBe(text('en', 'npc.guide.name'));
    expect(page.doc.byTestId('dialogue-accept'), 'the offer had no way to say yes').not.toBe(null);
    expect(page.doc.byTestId('dialogue-decline'), 'the offer had no way to say no').not.toBe(null);
  });

  it('says it in French when the game is in French', () => {
    const { controller, page } = harnessFor([questGivenBy(characterId('guide'))]);
    controller.setLocale('fr');
    controller.engage('guide');

    expect(page.doc.byTestId('dialogue-speaker')?.textContent).toBe(text('fr', 'npc.guide.name'));
  });
});
