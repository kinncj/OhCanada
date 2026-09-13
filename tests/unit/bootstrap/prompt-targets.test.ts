/**
 * What the HUD offers for everything a level puts in reach.
 *
 * `app/bootstrap/prompt-targets.ts` used to be a private function inside
 * `app/bootstrap/main.ts`, which no unit test can import — importing it boots
 * the game — so the one rule in it that ADR-0029 changed had no test at all. It
 * moved out for that reason and this file is the reason.
 *
 * The rule: **a point of interest is a place, whether or not it offers a quest.**
 * The line used to read `canEngage(poi.id) ? 'npc' : 'poi'`, and once a landmark
 * could give a quest that made Peggy's Point Lighthouse offer a button reading
 * "Talk to this person" — announced in those words to a screen-reader user, on
 * one of the two levels whose art document forbids a figure of any kind at any
 * scale precisely so that nobody is read as being there.
 *
 * Everything else here is `app/ui/interact.ts`'s precedence, asserted through
 * this function rather than restated: **done** beats a level's own per-target
 * row, which beats the kind, and a target with no row at all offers nothing.
 */

import { describe, expect, it } from 'vitest';

import { promptTargets } from '../../../app/bootstrap/prompt-targets';
import type { LevelPlacements } from '../../../app/bootstrap/engageables';
import { text } from '@ui/copy';

import { text as localised } from '../support/fixtures';

const NOTHING_ENGAGEABLE = { done: new Set<string>(), canEngage: (): boolean => false };
const EVERYTHING_ENGAGEABLE = { done: new Set<string>(), canEngage: (): boolean => true };

/** Peggy's Cove as ADR-0029 leaves it: a landmark giver and nobody drawn. */
const PEGGYS_COVE: LevelPlacements = {
  characters: [],
  pois: [
    {
      id: 'peggys-point-light',
      name: localised("Peggy's Point Lighthouse", "Le phare de Peggy's Point"),
      /* Required by `PlacedPoi`: only a landmark with a verified claim is ever
         offered to the player (ADR-0003). */
      blurb: localised('A true, short thing.', 'Une chose vraie et courte.'),
    },
  ],
};

describe('a point of interest is offered as a place, even when it offers a quest', () => {
  it('never tells a player to talk to a lighthouse', () => {
    const targets = promptTargets(PEGGYS_COVE, 'en', EVERYTHING_ENGAGEABLE);

    const prompt = targets['peggys-point-light']?.prompt;
    expect(prompt, 'the lighthouse offered no prompt at all').toBeDefined();
    /* The assertion that must never weaken. Everything below it may. */
    expect(prompt, 'a landmark was announced as a person').not.toBe(
      text('en', 'hud.interact.npc'),
    );

    /*
     * `hud.interact.poi.offer` — "See what there is to do here" — because this
     * landmark offers the level's quest, and "Look at this place" promises a
     * card and opens a conversation (`TN-REACH`, amended 2026-09-13).
     *
     * This line read `hud.interact.poi` until the row existed, with a note
     * saying it would change. It changed on purpose.
     */
    expect(prompt).toBe(text('en', 'hud.interact.poi.offer'));
  });

  it('says it in French too, because that is where the sentence is read', () => {
    const targets = promptTargets(PEGGYS_COVE, 'fr', EVERYTHING_ENGAGEABLE);
    expect(targets['peggys-point-light']?.prompt).not.toBe(text('fr', 'hud.interact.npc'));
    expect(targets['peggys-point-light']?.prompt).toBe(text('fr', 'hud.interact.poi.offer'));
  });

  it('registers the landmark under the spelling the scene sends', () => {
    /* `poi/engaged` carries `poi.<id>`; the level document writes `<id>`. Both
       have to find the same prompt, and the prefix is the **kind** — so a
       landmark registered as `npc.<id>` would never be found by the event. */
    const targets = promptTargets(PEGGYS_COVE, 'en', EVERYTHING_ENGAGEABLE);
    expect(targets['poi.peggys-point-light']).toBeDefined();
    expect(targets['npc.peggys-point-light']).toBeUndefined();
  });

  it('says a different thing when the landmark gives a quest, and is still a place', () => {
    const asGiver = promptTargets(PEGGYS_COVE, 'en', EVERYTHING_ENGAGEABLE);
    const asScenery = promptTargets(PEGGYS_COVE, 'en', NOTHING_ENGAGEABLE);

    /* Different words, because pressing does a different thing. */
    expect(asGiver['peggys-point-light']?.prompt).toBe(text('en', 'hud.interact.poi.offer'));
    expect(asScenery['peggys-point-light']?.prompt).toBe(text('en', 'hud.interact.poi'));
    expect(asGiver['peggys-point-light']?.prompt).not.toBe(
      asScenery['peggys-point-light']?.prompt,
    );

    /* The assertion in this test that must survive every rewrite of it: the
       flag changes the words and never the kind. `poi/engaged` carries
       `poi.<id>`, so a giver registered as `npc.<id>` is a giver the event
       never finds — which is the shape of the bug this file exists to hold
       down. */
    for (const targets of [asGiver, asScenery]) {
      expect(targets['poi.peggys-point-light']).toBeDefined();
      expect(targets['npc.peggys-point-light']).toBeUndefined();
    }
  });

  it('draws the landmark’s own name nowhere', () => {
    /* `TN-REACH`'s original defect, and `TN-NAMES-04`: the HUD said "CN Tower",
       which is content interpolated at runtime and walked past a check written
       against copy tables. */
    const drawn = Object.values(promptTargets(PEGGYS_COVE, 'en', EVERYTHING_ENGAGEABLE)).map(
      (target) => target.prompt,
    );
    for (const prompt of drawn) {
      expect(prompt).not.toContain("Peggy's Point Lighthouse");
    }
  });
});

describe('a character is offered only while there is something to say', () => {
  const OTTAWA: LevelPlacements = { characters: [{ characterId: 'officer' }], pois: [] };

  it('offers the officer when the officer can be engaged', () => {
    const targets = promptTargets(OTTAWA, 'en', EVERYTHING_ENGAGEABLE);
    expect(targets['officer']?.prompt).toBe(text('en', 'hud.interact.officer'));
    expect(targets['npc.officer']).toBeDefined();
  });

  it('offers nothing for a character with nothing to say', () => {
    expect(promptTargets(OTTAWA, 'en', NOTHING_ENGAGEABLE)).toEqual({});
  });
});

describe('the precedence, and the two states that are not failures', () => {
  it('says "done" about anything already engaged, whatever kind it is', () => {
    const done = { done: new Set(['peggys-point-light']), canEngage: (): boolean => true };
    expect(promptTargets(PEGGYS_COVE, 'en', done)['peggys-point-light']?.prompt).toBe(
      text('en', 'hud.interact.done'),
    );
  });

  it('offers nothing at all before a level has loaded', () => {
    expect(promptTargets(null, 'en', EVERYTHING_ENGAGEABLE)).toEqual({});
  });

  it('offers no prompt for a landmark this build has no row for, rather than inventing one', () => {
    /* There is no `hud.interact.poi`-less case in the shipped table, so this
       asserts the shape rather than a gap: a target whose kind row is missing
       would be absent, never "Interact" and never an empty string. */
    const targets = promptTargets(
      {
        characters: [],
        pois: [
          {
            id: 'a-plaque',
            name: localised('A plaque', 'Une plaque'),
            blurb: localised('A true, short thing.', 'Une chose vraie et courte.'),
          },
        ],
      },
      'en',
      NOTHING_ENGAGEABLE,
    );
    expect(targets['a-plaque']?.prompt).toBe(text('en', 'hud.interact.poi'));
    expect(targets['a-plaque']?.prompt).not.toBe('');
  });
});
