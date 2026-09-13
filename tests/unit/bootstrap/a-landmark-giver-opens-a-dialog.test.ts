/**
 * A quest offered by a landmark opens, and the dialog is called what the
 * landmark is called — ADR-0029, the runtime half.
 *
 * `tests/unit/contracts/a-quest-giver-is-placed-on-its-level.test.ts` holds the
 * **document** half: a giver resolves to exactly one placement, the placement
 * claims the quest back, a landmark speaker carries no `expression`. It passed
 * on the day it was written and it would have gone on passing while the game
 * refused to open the quest, because `app/bootstrap/quest.ts` built the copy key
 * `npc.<giver>.name` and there is no `npc.peggys-point-light.name` row — so
 * `canEngage` answered false and the console said why. Fail-closed, correct, and
 * not enough: the ADR records that gap as an obligation, and this file is the
 * test that the obligation is discharged.
 *
 * Everything here is **synthesised**. The two landmark quests were being
 * authored while this was written and the gate must not be one that passes
 * because its input has not arrived (ADR-0024, and the three times this project
 * has shipped that: a proportions check that measured nothing, a HUD name check
 * reading declarations instead of rendered output, two schemas that never
 * compiled). The fixtures below are a lighthouse that gives a quest, and they
 * exist whether or not `content/quests/` ever holds one.
 *
 * The corpus half — every **shipped** quest's giver resolves and is named in
 * both languages — is `tests/unit/bootstrap/quest-giver-is-named.test.ts`, which
 * reads `content/` and will cover the landmark quests the day they land.
 */

import { describe, expect, it, vi } from 'vitest';

import { createQuestController, type QuestWiring } from '../../../app/bootstrap/quest';
import { readQuest } from '../../../app/bootstrap/quests';
import { resolveEngageable, type LevelPlacements } from '../../../app/bootstrap/engageables';
import { createSettingsStore } from '@ui/settings';
import { hasCopyRow } from '@ui/copy';
import type { QuestDocument } from '@application/ports';
import type { LevelId } from '@domain/ids';

import { buildPage, type FakePage } from '../ui/support/fake-dom';
import { brandId, emptyProgress, testClock, text as localised } from '../support/fixtures';

/* ------------------------------------------------------------- the lighthouse */

const LIGHT = 'peggys-point-light';

/** The name is the level document's own `pois[].name`: required, and bilingual. */
const LIGHT_NAME = {
  en: "Peggy's Point Lighthouse",
  fr: "Le phare de Peggy's Point",
} as const;

/**
 * The level, as the level places things.
 *
 * `characters: []` is the whole point and not an omission:
 * `assets/style/peggys-cove-level.md` §0 forbids "a figure of any kind, at any
 * scale, including a silhouette and a crowd", so there is nobody on this level
 * to hold a quest and there never will be.
 */
/**
 * What a placed landmark teaches.
 *
 * Required by `PlacedPoi` since ADR-0003's filter moved into the level parser: a
 * landmark with no verified claim is not an engageable at all, so it cannot be
 * a quest giver either, and the type says so.
 */
const BLURB = localised('A true, short thing.', 'Une chose vraie et courte.');

const PEGGYS_COVE: LevelPlacements = {
  characters: [],
  pois: [
    { id: 'granite-shore', name: localised('The granite shore', 'La côte de granit'), blurb: BLURB },
    { id: LIGHT, name: { ...LIGHT_NAME }, blurb: BLURB },
  ],
};

/**
 * A quest given by the lighthouse.
 *
 * Written in the second person and the impersonal, which is ADR-0029 §5's
 * authoring rule rather than a schema rule — "You are standing on…", never "I
 * have kept this light for forty years". Nothing mechanical checks it; it is
 * written correctly here because a fixture that broke the rule would be the
 * example everybody copies.
 */
const lighthouseQuest = (overrides: Partial<QuestDocument> = {}): QuestDocument =>
  ({
    $schema: '../schemas/quest.schema.json',
    id: brandId('peggys-cove-point-light'),
    levelId: brandId<LevelId>('peggys-cove'),
    giver: LIGHT,
    title: localised('Read the light', 'Lire le phare'),
    summary: localised('You read the panel at the light.', 'Vous lisez le panneau du phare.'),
    steps: [
      {
        id: 'read-the-panel',
        kind: 'talk',
        targetId: LIGHT,
        prompt: localised('Read the panel', 'Lisez le panneau'),
        dialogue: [
          {
            speaker: LIGHT,
            text: localised(
              'You are standing on the Atlantic edge of Nova Scotia.',
              "Vous êtes sur la bordure atlantique de la Nouvelle-Écosse.",
            ),
            fact: { claimsFact: false },
          },
        ],
      },
      {
        id: 'visit-the-shore',
        kind: 'visit',
        targetId: 'granite-shore',
        prompt: localised('Walk out to the granite', 'Marchez jusqu’au granit'),
      },
    ],
    ...overrides,
  }) as QuestDocument;

/* ------------------------------------------------------------------ the seam */

interface Harness {
  readonly page: FakePage;
  readonly controller: ReturnType<typeof createQuestController>;
  readonly opened: () => number;
}

function harnessFor(
  quests: readonly QuestDocument[],
  placements: LevelPlacements | null = PEGGYS_COVE,
  level = 'peggys-cove',
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

/** What a screen reader is handed: the dialog's accessible name, resolved. */
function accessibleName(page: FakePage): string | null {
  const dialog = page.doc.byTestId('dialogue');
  if (dialog === null) return null;
  const labelledBy = dialog.getAttribute('aria-labelledby') ?? '';
  return page.doc.getElementById(labelledBy)?.textContent ?? null;
}

describe('a landmark offers a quest, and it opens', () => {
  it('can be engaged, so the HUD is allowed to offer a prompt for it', () => {
    const { controller } = harnessFor([lighthouseQuest()]);

    expect(controller.isGiver(LIGHT)).toBe(true);
    /*
     * The line the obligation was about. Before the name resolved from
     * `pois[].name` this was false, the quest validated, passed every gate and
     * could not be played.
     */
    expect(controller.canEngage(LIGHT), 'a landmark giver is still unengageable').toBe(true);
  });

  it('is engaged through the prefixed spelling the scene sends, too', () => {
    /* `poi/engaged` carries `poi.<id>`; the level document writes `<id>`. Both
       have to find the same lighthouse or the canvas tap opens nothing. */
    const { controller } = harnessFor([lighthouseQuest()]);
    expect(controller.canEngage(`poi.${LIGHT}`)).toBe(true);
    expect(controller.engage(`poi.${LIGHT}`)).toBe(true);
  });

  it('opens a dialog named after the landmark, never empty and never the id', () => {
    const { controller, page, opened } = harnessFor([lighthouseQuest()]);

    expect(controller.engage(LIGHT), 'the lighthouse said nothing').toBe(true);
    expect(opened(), 'the level was not held while a dialog was open').toBe(1);

    /* Drawn, and announced: `TN-QUEST-08` asks for both, and the same string. */
    expect(page.doc.byTestId('dialogue-speaker')?.textContent).toBe(LIGHT_NAME.en);
    expect(accessibleName(page)).toBe(LIGHT_NAME.en);

    const name = accessibleName(page) ?? '';
    expect(name.trim(), 'a dialog announced as nothing is a defect').not.toBe('');
    expect(name, 'the raw id, read out one hyphen at a time').not.toBe(LIGHT);
    expect(name).not.toMatch(/^[a-z0-9]+(-[a-z0-9]+)+$/);
  });

  it('says it in French when the game is in French', () => {
    const { controller, page } = harnessFor([lighthouseQuest()]);
    controller.setLocale('fr');
    controller.engage(LIGHT);

    expect(page.doc.byTestId('dialogue-speaker')?.textContent).toBe(LIGHT_NAME.fr);
    expect(accessibleName(page)).toBe(LIGHT_NAME.fr);
  });

  it('offers the quest, with both ways to answer', () => {
    const { controller, page } = harnessFor([lighthouseQuest()]);
    controller.engage(LIGHT);

    expect(page.doc.byTestId('dialogue-accept'), 'no way to say yes').not.toBe(null);
    expect(page.doc.byTestId('dialogue-decline'), 'no way to say no').not.toBe(null);
    expect(page.doc.byTestId('dialogue-text')?.textContent ?? '').toContain('Atlantic edge');
  });

  it('needs no copy row to be named, which is the point of reading the level', () => {
    /*
     * A floor against the old path quietly coming back. If somebody adds
     * `npc.peggys-point-light.name` the test above would pass for the wrong
     * reason, so the absence of the row is asserted next to the pass that must
     * not depend on it.
     */
    expect(hasCopyRow(`npc.${LIGHT}.name`)).toBe(false);
  });
});

describe('a landmark has no face, and nothing on this path asks it for one', () => {
  it('parses a landmark line with no expression key at all', () => {
    /*
     * Not `expression === undefined`: the **key is absent**, so nothing
     * downstream can read a pose off a plaque even by accident. That is the
     * shape ADR-0029 §4 protects — `ICharacterRenderer.setExpression` being
     * handed a value resolved from a line a lighthouse spoke, at the one moment
     * a player taps.
     *
     * `app/bootstrap/quest.ts` and `app/ui/dialogue.ts` read no pose today, and
     * this is what keeps that true when one of them grows a portrait: an
     * `expression` on a landmark line does not exist to be read.
     */
    const parsed = readQuest(
      {
        id: 'a-quest',
        levelId: 'peggys-cove',
        giver: LIGHT,
        title: { en: 'A quest', fr: 'Une quête' },
        summary: { en: 'A summary.', fr: 'Un résumé.' },
        steps: [
          {
            id: 'talk',
            kind: 'talk',
            targetId: LIGHT,
            prompt: { en: 'Read it', fr: 'Lisez-le' },
            dialogue: [
              {
                speaker: LIGHT,
                text: { en: 'This spot marks the edge.', fr: 'Ce lieu marque la bordure.' },
                fact: { claimsFact: false },
              },
            ],
          },
        ],
      },
      'fixture',
    );

    expect(parsed.ok, parsed.ok ? '' : parsed.error.message).toBe(true);
    if (!parsed.ok) return;
    const line = parsed.value.steps[0]?.dialogue?.[0];
    expect(line).toBeDefined();
    expect(Object.hasOwn(line as object, 'expression')).toBe(false);
  });

  it('still carries an expression a character line declares', () => {
    /* The other direction, so the assertion above is about the landmark rather
       than about a parser that drops the field for everybody. */
    const parsed = readQuest(
      {
        id: 'a-quest',
        levelId: 'ottawa',
        giver: 'officer',
        title: { en: 'A quest', fr: 'Une quête' },
        summary: { en: 'A summary.', fr: 'Un résumé.' },
        steps: [
          {
            id: 'talk',
            kind: 'talk',
            targetId: 'officer',
            prompt: { en: 'Talk', fr: 'Parlez' },
            dialogue: [
              {
                speaker: 'officer',
                text: { en: 'Welcome.', fr: 'Bienvenue.' },
                fact: { claimsFact: false },
                expression: 'happy',
              },
            ],
          },
        ],
      },
      'fixture',
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.steps[0]?.dialogue?.[0]?.expression).toBe('happy');
  });

  it('reports which kind a giver is, so a pose is never looked up for a place', () => {
    const landmark = resolveEngageable(PEGGYS_COVE, LIGHT);
    expect(landmark.ok && landmark.engageable.kind).toBe('landmark');

    const character = resolveEngageable(
      { characters: [{ characterId: 'guide' }], pois: [] },
      'guide',
    );
    expect(character.ok && character.engageable.kind).toBe('character');
  });
});

describe('and a giver the level does not place opens nothing', () => {
  const consoleSaid = (run: () => void): string => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      run();
      return error.mock.calls.flat().join(' ');
    } finally {
      error.mockRestore();
    }
  };

  it('refuses a dangling giver, and names the level it is missing from', () => {
    const quest = lighthouseQuest({ giver: 'a-plaque-nobody-placed' });
    const { controller, page, opened } = harnessFor([quest]);

    expect(controller.canEngage('a-plaque-nobody-placed')).toBe(false);
    const said = consoleSaid(() => {
      expect(controller.engage('a-plaque-nobody-placed')).toBe(false);
    });

    expect(page.doc.byTestId('dialogue'), 'an unnamed dialog mounted').toBe(null);
    expect(opened(), 'the level was taken for a dialogue that never opened').toBe(0);
    expect(said).toContain('a-plaque-nobody-placed');
    expect(said).toContain('peggys-cove');
    /* The message names the document to fix. It used to send a maintainer to a
       copy table for a fact that lives in a level document. */
    expect(said).toContain('pois[].id');
    expect(said).not.toContain('npc.<id>.name');
  });

  it('refuses an ambiguous giver rather than picking the one it saw first', () => {
    /* A character and a point of interest sharing an id. ADR-0029 §2: zero and
       two are different failures and neither is a success. */
    const collision: LevelPlacements = {
      characters: [{ characterId: 'guide' }],
      pois: [{ id: 'guide', name: localised('A sign', 'Un panneau'), blurb: BLURB }],
    };
    const { controller } = harnessFor([lighthouseQuest({ giver: 'guide' })], collision);

    expect(controller.canEngage('guide')).toBe(false);
    const said = consoleSaid(() => {
      expect(controller.engage('guide')).toBe(false);
    });
    expect(said).toContain('2 things called "guide"');
  });

  it('refuses everything until the level has actually loaded', () => {
    /* The controller is built before `loadLevel` resolves. Nothing is placed
       yet, so nothing is engageable yet — and that is a state, not a fault. */
    const { controller } = harnessFor([lighthouseQuest()], null);
    expect(controller.isGiver(LIGHT), 'the quest is still this level’s').toBe(true);
    expect(controller.canEngage(LIGHT)).toBe(false);
  });

  it('refuses a landmark the level placed without a name in both languages', () => {
    const half: LevelPlacements = {
      characters: [],
      /* A document `make validate-content` would reject; the runtime refuses it
         too, because a dialog named "" is the defect and CI is not the only
         place this can be true. */
      pois: [{ id: LIGHT, name: { en: "Peggy's Point Lighthouse", fr: '  ' }, blurb: BLURB }],
    };
    const { controller } = harnessFor([lighthouseQuest()], half);
    expect(controller.canEngage(LIGHT)).toBe(false);
  });
});
