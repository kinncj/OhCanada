/**
 * Every quest this build ships can name whoever — or whatever — offers it.
 *
 * `docs/stories/TN-GUIDE-02` — "a character with no name gives no quest".
 *
 * The defect this file exists to make impossible was live in the shipped build:
 * three authored quests declared `"giver": "guide"`, and no `npc.guide.name`
 * copy row existed. `app/ui/dialogue.ts` takes the speaker's name as a
 * **required** option — `TN-QUEST-08` refuses a dialog whose accessible name is
 * "Speaker", "NPC" or nothing — so `app/bootstrap/quest.ts` refused all three
 * offers. Three quarters of the authored quests could not be given, on a build
 * where every suite was green, and one of the three is **Halifax, the level
 * `content/game.config.json` opens on**. Nothing joined a quest's `giver` to the
 * name; only the console went red.
 *
 * ## What changed, and why this file changed with it
 *
 * ADR-0029 widened `giver` to anything the level **places** — a character, or a
 * point of interest — and the obligation it left was that a giver's name must
 * come from where the name actually lives:
 *
 * | Giver | Name |
 * |---|---|
 * | a character | `content/characters/<id>.json#/name` |
 * | a landmark | the level's own `pois[].name` |
 *
 * So the join this file asserts is no longer *quest → copy table*. It is *quest
 * → its level's placements → the document that names them*, which is exactly
 * what `app/bootstrap/engageables.ts` does at run time and exactly what this
 * suite runs. The copy row `npc.<id>.name` was never a design: it was written
 * when `content/characters/` was **empty**, and it holds two documents now.
 *
 * Two halves, failing for two different reasons:
 *
 *  1. **the corpus** — every shipped quest's giver resolves against its own
 *     level document and is named in English *and* in French, through the real
 *     resolver, over the real content;
 *  2. **the refusal** — a giver this build cannot name is refused at run time,
 *     loudly, rather than opened in a dialog a screen reader announces as
 *     nothing.
 *
 * There was a third — **the leftover**: while `npc.guide.name` and
 * `npc.officer.name` still existed in `app/ui/copy.ts`, they had to agree with
 * the documents that replaced them, so a stale row could not sit there telling a
 * maintainer something untrue. Both rows are deleted now and the guard went with
 * them: a check whose subject no longer exists passes for the wrong reason, and
 * scaffolding kept after the thing it held up is standing is a test nobody can
 * read the purpose of.
 *
 * The landmark half of the same rule is
 * `tests/unit/bootstrap/a-landmark-giver-opens-a-dialog.test.ts`; the
 * document-side rule — a giver resolves to exactly one placement that claims the
 * quest back — is `tests/unit/contracts/a-quest-giver-is-placed-on-its-level.test.ts`.
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { createQuestController, type QuestWiring } from '../../../app/bootstrap/quest';
import { readQuests } from '../../../app/bootstrap/quests';
import { readCharacterNames } from '../../../app/bootstrap/characters';
import {
  resolveEngageable,
  type LevelPlacements,
  type EngageableResolution,
} from '../../../app/bootstrap/engageables';
import { createSettingsStore } from '@ui/settings';
import { hasCopyRow, UI_LOCALES, type UiLocale } from '@ui/copy';
import type { QuestDocument } from '@application/ports';
import type { LocalizedText } from '@domain/entities/values';
import { parseLevelDocument } from '@adapters/phaser/level-document';
import gameConfigJson from '@content/game.config.json';

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

/* ------------------------------------------------------------- the documents */

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const MODES: readonly string[] = (gameConfigJson as { locomotionModes: readonly string[] })
  .locomotionModes;

/**
 * A level document, as placements. The two lists apart, which is ADR-0029 §2.
 *
 * Read through `parseLevelDocument` rather than picked out of the JSON by hand,
 * and that is not tidiness. A landmark whose blurb a verifier declined is not an
 * engageable at run time (ADR-0003, `app/adapters/phaser/verified-claim.ts`), so
 * a quest given by one could not be offered — and a test that read `pois`
 * straight out of the file would have said it could. The suite now asks the same
 * question the game asks.
 */
function placementsOf(id: string): LevelPlacements | null {
  const path = `${REPO_ROOT}content/levels/${id}.json`;
  if (!existsSync(path)) return null;
  const parsed = parseLevelDocument(JSON.parse(readFileSync(path, 'utf8')), MODES);
  if (!parsed.ok) throw new Error(`content/levels/${id}.json: ${parsed.error.message}`);
  return { pois: parsed.value.teachingPois, characters: parsed.value.characters };
}

/** Whatever a placed landmark teaches. Verified by construction: see {@link PlacedPoi}. */
const BLURB: LocalizedText = localised('A true, short thing.', 'Une chose vraie et courte.');

const localisedName = (name: LocalizedText, locale: UiLocale): string =>
  locale === 'fr' ? name.fr : name.en;

/**
 * The languages a giver's name is missing in, or `[]`.
 *
 * One function, run by the corpus check and by the fixtures that prove it can
 * fail. It asks the **real resolver**, so a rule that passes here is a rule the
 * game obeys, not a second implementation that happens to agree.
 */
function missingNameLocales(
  quest: QuestDocument,
  placements: LevelPlacements | null,
): readonly UiLocale[] {
  const resolution: EngageableResolution = resolveEngageable(placements, String(quest.giver));
  if (!resolution.ok) return [...UI_LOCALES];
  return UI_LOCALES.filter(
    (locale) => localisedName(resolution.engageable.name, locale).trim() === '',
  );
}

/** Why a resolution failed, as one word, for a message that names the cause. */
const why = (resolution: EngageableResolution): string =>
  resolution.ok ? 'resolved' : resolution.why;

describe('every quest this build ships can name whatever offers it', () => {
  const catalogue = readQuests();

  it('reads a corpus that is not empty', () => {
    /* ADR-0024's floor, first rather than last, because everything below it
       would pass over nothing. */
    expect(catalogue.quests.length, 'no quest was read — this suite would pass vacuously')
      .toBeGreaterThan(0);
    expect(catalogue.refused, catalogue.refused.join('\n')).toEqual([]);
  });

  it('names every giver, in English and in French, from the document that places it', () => {
    /*
     * Read from the glob, not from a list anybody maintains, so quest number
     * nine lands with this covering it — including the two landmark quests
     * ADR-0029 unblocked, which need no copy row and will pass here the day they
     * are authored.
     */
    const unnameable = catalogue.quests
      .filter((quest) => missingNameLocales(quest, placementsOf(String(quest.levelId))).length > 0)
      .map((quest) => {
        const placements = placementsOf(String(quest.levelId));
        const resolution = resolveEngageable(placements, String(quest.giver));
        return (
          `${String(quest.id)} is offered by "${String(quest.giver)}" on ` +
          `${String(quest.levelId)}, and this build cannot name it: ${why(resolution)}. ` +
          `A character is named by content/characters/<id>.json#/name and a landmark by ` +
          `the level's own pois[].name.`
        );
      });

    expect(unnameable, unnameable.join('\n')).toEqual([]);
  });

  it('names the guide from its own document, whatever it happens to give', () => {
    /*
     * Not a re-statement of the name — `tests/unit/ui/copy.test.ts` and the
     * character document own the words — but of the join: every quest that
     * declares `guide` is asked, by its own `giver` field, whether this build
     * can name it.
     *
     * The membership is deliberately NOT pinned. It used to be, and it broke the
     * day a sixth quest chose the same giver — which is the case it existed to
     * protect, arriving and failing. The floor is that at least one quest is
     * given by the guide; which ones is the content's business.
     */
    const byGuide = catalogue.quests.filter((quest) => String(quest.giver) === 'guide');
    expect(
      byGuide.length,
      'no quest is given by the guide any more, so this scenario is about nothing',
    ).toBeGreaterThan(0);

    for (const quest of byGuide) {
      expect(
        missingNameLocales(quest, placementsOf(String(quest.levelId))),
        `${String(quest.id)} cannot name the guide`,
      ).toEqual([]);
    }
  });

  it('is proven by a giver nothing has a word for', () => {
    /* A check that cannot go red certifies nothing. `nobody` is placed as a
       character on the level and has no content/characters/nobody.json, so the
       name resolution fails in both languages. */
    const nameless = makeQuest({ giver: characterId('nobody') });
    expect(
      missingNameLocales(nameless, { characters: [{ characterId: 'nobody' }], pois: [] }),
    ).toEqual([...UI_LOCALES]);
    expect(existsSync(`${REPO_ROOT}content/characters/nobody.json`)).toBe(false);
  });

  it('fails a giver named in one language only', () => {
    /*
     * `TN-GUIDE-02`, second scenario: "a row present in one language only fails
     * the same check". Run against a placement whose French is blank, because
     * the shipped documents cannot be in that state —
     * `character.schema.json` requires both — and a rule that has never seen the
     * state it is written for is a rule nobody has tested.
     */
    const quest = makeQuest({ giver: characterId('a-plaque') });
    const halfNamed: LevelPlacements = {
      characters: [],
      pois: [{ id: 'a-plaque', name: { en: 'A plaque', fr: '' }, blurb: BLURB }],
    };
    /* `unnamed` is refused outright rather than half-answered: an English label
       announced to a French screen-reader user is `TN-CREATOR-09`'s defect. */
    expect(missingNameLocales(quest, halfNamed)).toEqual([...UI_LOCALES]);

    const named: LevelPlacements = {
      characters: [],
      pois: [{ id: 'a-plaque', name: localised('A plaque', 'Une plaque'), blurb: BLURB }],
    };
    expect(missingNameLocales(quest, named)).toEqual([]);
  });
});

describe('the documents that name a character, which the copy rows used to', () => {
  /*
   * `npc.guide.name` and `npc.officer.name` were the speaker's label until
   * ADR-0029 moved it to `content/characters/<id>.json#/name` — content,
   * bilingual, schema-validated, and in the same document as the rig the
   * character plays. Both rows are deleted, and the guard that held them to the
   * documents while they lingered is deleted with them: it had no subject left.
   *
   * What stays is the reader those documents are loaded by, because that is live
   * code with two rules a reviewer would not guess — what it refuses to call a
   * character, and what it does with a name it can only half read.
   */
  const documents = readCharacterNames();

  it('reads a character document at all, so nothing below passes vacuously', () => {
    /* ADR-0024: an empty map makes every loop under it succeed by not running. */
    expect(documents.size, 'content/characters/ named nobody').toBeGreaterThan(0);
  });

  it('reads the characters in that directory and nothing else in it', () => {
    /*
     * `content/characters/rig.json` lives there and is not a character — it is
     * the shared rig every character plays (ADR-0022). It is told apart by its
     * `$schema`, which every content file declares, rather than by its filename
     * or by "has a name", both of which are guesses that go stale.
     */
    expect(documents.has('rig')).toBe(false);
    expect(documents.has('truenorth-rig')).toBe(false);
    for (const [id, name] of documents) {
      expect(existsSync(`${REPO_ROOT}content/characters/${id}.json`), id).toBe(true);
      expect(name.en.trim()).not.toBe('');
      expect(name.fr.trim()).not.toBe('');
    }
  });

  it('drops a character it could only half name, rather than half naming it', () => {
    /*
     * Proved by documents that break it, because the shipped ones cannot:
     * `character.schema.json` requires both languages. A name in English only
     * would announce an English label to a French screen-reader user, so the
     * document is dropped and the giver is refused — the same fail-closed answer
     * as no document at all.
     */
    const read = readCharacterNames({
      '/a.json': { default: { $schema: '../schemas/character.schema.json', id: 'a', name: { en: 'A', fr: 'A' } } },
      '/half.json': { default: { $schema: '../schemas/character.schema.json', id: 'half', name: { en: 'Half', fr: '   ' } } },
      '/none.json': { default: { $schema: '../schemas/character.schema.json', id: 'none' } },
      '/rig.json': { default: { $schema: '../schemas/rig.schema.json', id: 'rig', name: { en: 'Rig', fr: 'Rig' } } },
    });
    expect([...read.keys()]).toEqual(['a']);
  });

  it('is the only place a giver’s name is written, now that the rows are gone', () => {
    /*
     * The guard that used to stand here compared `npc.<id>.name` against the
     * document while both existed. The rows are deleted, so what is worth
     * asserting is that they stay deleted: a new `npc.<id>.name` row would be a
     * second home for a string that has one, and `TN-LEVEL-peggys-cove.md`
     * refuses to invent one even for the landmark giver that would need it.
     */
    for (const id of [...documents.keys(), 'peggys-point-light', 'yukon-river-sternwheeler']) {
      expect(hasCopyRow(`npc.${id}.name`), `npc.${id}.name is back in app/ui/copy.ts`).toBe(false);
    }
  });
});

/* ----------------------------------------------- the refusal, at the seam --- */

interface Harness {
  readonly page: FakePage;
  readonly controller: ReturnType<typeof createQuestController>;
  readonly opened: () => number;
}

function harnessFor(
  quests: readonly QuestDocument[],
  placements: LevelPlacements | null,
  level = 'halifax',
): Harness {
  const page = buildPage();
  let opens = 0;
  let progress = emptyProgress();

  const wiring: QuestWiring = {
    levelId: brandId<LevelId>(level),
    quests,
    placements: () => placements,
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
  };

  return { page, controller: createQuestController(wiring), opened: () => opens };
}

/** A quest given by one character, placed as a character on the level. */
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

/** That character, standing on the level. */
const placedAs = (giver: string): LevelPlacements => ({
  characters: [{ characterId: giver }],
  pois: [],
});

describe('a giver this build cannot name', () => {
  it('is not offered a prompt, because the prompt would open nothing', () => {
    /* `canEngage` is what the composition root asks **before** it draws a
       prompt, and a control that opens nothing is the dead button this project
       keeps finding. */
    const { controller } = harnessFor([questGivenBy(characterId('nobody'))], placedAs('nobody'));
    expect(controller.isGiver('nobody'), 'the fixture is not a giver at all').toBe(true);
    expect(controller.canEngage('nobody')).toBe(false);
  });

  it('opens no dialog, and says which document is missing', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { controller, page, opened } = harnessFor(
        [questGivenBy(characterId('nobody'))],
        placedAs('nobody'),
      );

      expect(controller.engage('nobody'), 'an unnamed dialog was opened').toBe(false);
      expect(page.doc.byTestId('dialogue'), 'a dialog with no accessible name mounted').toBe(null);
      expect(opened(), 'the level was taken for a dialogue that never opened').toBe(0);

      const said = error.mock.calls.flat().join(' ');
      expect(said).toContain('nobody');
      /* The sentence names the file to write, which is the half the old message
         got wrong: it sent a maintainer to a copy table. */
      expect(said).toContain('content/characters/nobody.json');
      expect(said).not.toContain('npc.<id>.name');
    } finally {
      error.mockRestore();
    }
  });
});

describe('the guide, named by its own document', () => {
  const GUIDE_NAME = readCharacterNames().get('guide');

  it('has a document to be named by', () => {
    expect(GUIDE_NAME, 'content/characters/guide.json names nobody').toBeDefined();
  });

  it('opens a dialog named after it, and offers the quest', () => {
    const { controller, page } = harnessFor([questGivenBy(characterId('guide'))], placedAs('guide'));

    expect(controller.canEngage('guide')).toBe(true);
    expect(controller.engage('guide'), 'the guide still says nothing').toBe(true);

    const dialog = page.doc.byTestId('dialogue');
    expect(dialog, 'the guide opened no dialogue').not.toBe(null);
    /* `TN-QUEST-08`: the dialog's accessible name is the speaker's, and the
       same string is drawn, so it is seen as well as heard. */
    const speaker = page.doc.byTestId('dialogue-speaker');
    expect(speaker?.textContent).toBe(GUIDE_NAME?.en);
    expect(
      page.doc.getElementById(dialog?.getAttribute('aria-labelledby') ?? '')?.textContent,
    ).toBe(GUIDE_NAME?.en);
    expect(page.doc.byTestId('dialogue-accept'), 'the offer had no way to say yes').not.toBe(null);
    expect(page.doc.byTestId('dialogue-decline'), 'the offer had no way to say no').not.toBe(null);
  });

  it('says it in French when the game is in French', () => {
    const { controller, page } = harnessFor([questGivenBy(characterId('guide'))], placedAs('guide'));
    controller.setLocale('fr');
    controller.engage('guide');

    expect(page.doc.byTestId('dialogue-speaker')?.textContent).toBe(GUIDE_NAME?.fr);
  });

  it('is refused when the level does not place it, however well named it is', () => {
    /*
     * The name existing is not the question ADR-0029 asks. A giver is something
     * the level **places**, and a quest whose giver stands on another level
     * opens nothing — which is the runtime half of the contract gate's
     * "dangling".
     */
    const { controller } = harnessFor([questGivenBy(characterId('guide'))], {
      characters: [],
      pois: [],
    });
    expect(controller.canEngage('guide')).toBe(false);
  });
});
