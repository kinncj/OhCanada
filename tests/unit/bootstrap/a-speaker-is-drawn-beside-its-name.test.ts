/**
 * ADR-0041: the dialogue draws who is speaking — through the composition root's
 * `portraitOf`, asked about the **resolved** speaker.
 *
 * What would be wrong if this file lied:
 *
 *  - a portrait asked for by id alone, so a landmark and a character that share
 *    a name could be drawn as each other, or a landmark drawn with a face
 *    (ADR-0029: the level that places a thing says what kind of thing it is);
 *  - a portrait drawn when the composition root has none, as an empty frame;
 *  - a dialog whose name or lines changed because a picture arrived.
 *
 * Synthesised, like `a-landmark-giver-opens-a-dialog.test.ts`: a lighthouse that
 * gives a quest, on a level that places no figure.
 */

import { describe, expect, it, vi } from 'vitest';

import { createQuestController, type QuestWiring } from '../../../app/bootstrap/quest';
import type { Engageable, LevelPlacements } from '../../../app/bootstrap/engageables';
import { createSettingsStore } from '@ui/settings';
import type { QuestDocument } from '@application/ports';
import type { LevelId } from '@domain/ids';

import { buildPage, type FakePage } from '../ui/support/fake-dom';
import {
  brandId,
  emptyProgress,
  flavourFact,
  spoken,
  testClock,
  text as localised,
} from '../support/fixtures';

const LIGHT = 'peggys-point-light';
const LIGHT_NAME = localised("Peggy's Point Lighthouse", "Le phare de Peggy's Point");
const BLURB = localised('A true, short thing.', 'Une chose vraie et courte.');
const PICTURE = '/OhCanada/img/peggys-cove-landmark-lighthouse@1x.2427cbc2.webp';

const PLACEMENTS: LevelPlacements = {
  characters: [],
  pois: [{ id: LIGHT, name: LIGHT_NAME, blurb: BLURB }],
};

const QUEST = {
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
            'Vous êtes sur la bordure atlantique de la Nouvelle-Écosse.',
          ),
          fact: flavourFact(),
        },
      ],
    },
    {
      id: 'visit-the-light',
      kind: 'visit',
      targetId: LIGHT,
      prompt: localised('Look at the light', 'Regardez le phare'),
    },
  ],
} as unknown as QuestDocument;

function harness(portraitOf?: (speaker: Engageable) => string | null): {
  readonly page: FakePage;
  readonly controller: ReturnType<typeof createQuestController>;
} {
  const page = buildPage();
  let progress = emptyProgress();
  const wiring: QuestWiring = {
    levelId: brandId<LevelId>('peggys-cove'),
    quests: [spoken(QUEST, String(QUEST.id))],
    placements: () => PLACEMENTS,
    host: page.host,
    store: createSettingsStore(),
    clock: testClock(),
    announce: vi.fn(),
    progress: () => progress,
    commit: (next) => {
      progress = next;
    },
    setTask: vi.fn(),
    onOpen: vi.fn(),
    onClose: vi.fn(),
    onCompleted: vi.fn(),
    restoreFocusTo: () => null,
    ...(portraitOf === undefined ? {} : { portraitOf }),
  };
  return { page, controller: createQuestController(wiring) };
}

describe('the speaker, drawn beside the name', () => {
  it('asks for the portrait of the thing the level placed, as the level placed it', () => {
    const portraitOf = vi.fn((_speaker: Engageable) => PICTURE);
    const { controller, page } = harness(portraitOf);

    expect(controller.engage(LIGHT)).toBe(true);

    expect(portraitOf).toHaveBeenCalledTimes(1);
    const [speaker] = portraitOf.mock.calls[0] ?? [];
    expect(speaker?.id).toBe(LIGHT);
    /* A landmark, never a character: its picture is its own art, not a face. */
    expect(speaker?.kind).toBe('landmark');

    const frame = page.doc.byTestId('dialogue-portrait');
    expect(frame?.hidden).toBe(false);
    expect(frame?.getAttribute('aria-hidden')).toBe('true');
    expect(frame?.querySelector('img')?.getAttribute('src')).toBe(PICTURE);
  });

  it('changes nothing the dialog says: the name and the lines are the same with or without it', () => {
    const drawn = harness(() => PICTURE);
    const plain = harness();
    drawn.controller.engage(LIGHT);
    plain.controller.engage(LIGHT);

    for (const testId of ['dialogue-speaker', 'dialogue-text', 'dialogue-accept', 'dialogue-decline']) {
      expect(drawn.page.doc.byTestId(testId)?.textContent, testId).toBe(
        plain.page.doc.byTestId(testId)?.textContent,
      );
    }
  });

  it('draws the name alone when the composition root has no portrait', () => {
    const { controller, page } = harness(() => null);
    controller.engage(LIGHT);
    expect(page.doc.byTestId('dialogue-portrait')?.hidden).toBe(true);
    expect(page.doc.byTestId('dialogue-speaker')?.textContent).toBe(LIGHT_NAME.en);
  });

  it('draws the name alone when nothing supplies portraits at all', () => {
    const { controller, page } = harness();
    controller.engage(LIGHT);
    expect(page.doc.byTestId('dialogue-portrait')?.hidden).toBe(true);
  });
});
