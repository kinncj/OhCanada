import { describe, expect, it } from 'vitest';

import { text, UI_LOCALES } from '@ui/copy';
import { bareTargetId, interactHint, interactPrompt } from '@ui/interact';

/**
 * `docs/stories/TN-REACH-what-is-in-reach.md`.
 *
 * The defect this module exists to make impossible, in one line: the HUD's
 * button read **"CN Tower"** — the level document's own name for the landmark,
 * interpolated at runtime by the composition root. It said what was *there*
 * rather than what choosing it would do, and it put a trade name on a surface
 * `TN-NAMES-04` fails the build for. It got past that check because the name was
 * never a copy string.
 *
 * So the assertions below are mostly about what the prompt **cannot** be.
 */

/** Everything on `TN-NAMES-01`'s list, in both languages, lowercased. */
const NAMES_ON_THE_LIST = [
  'château frontenac',
  'chateau frontenac',
  'cn tower',
  'tour cn',
  'toronto city hall',
  'hôtel de ville de toronto',
  'canadian museum for human rights',
  'musée canadien pour les droits de la personne',
  'canada place',
  'pier 21',
  'quai 21',
];

describe('what the prompt says', () => {
  it('says what choosing it will do, for a place and for a person', () => {
    /* `archivist` is a role `TN-LEVELS-2-to-10-spine.md` names and no level
       writes a row for, so it is the kind row's case. It used to be `guide`,
       which is now the per-target case below — a person is what the generic row
       is for, and the guide is a beaver. */
    expect(interactPrompt('en', { id: 'cn-tower', kind: 'poi' })).toBe('Look at this place');
    expect(interactPrompt('en', { id: 'archivist', kind: 'npc' })).toBe('Talk to this person');
    expect(interactPrompt('fr', { id: 'cn-tower', kind: 'poi' })).toBe('Regarder ce lieu');
    expect(interactPrompt('fr', { id: 'archivist', kind: 'npc' })).toBe('Parler à cette personne');
  });

  it('is a verb phrase and not a name on its own', () => {
    /* `TN-REACH-01`. A button labelled with a noun is a button whose behaviour
       the player has to guess, and a screen-reader user is read a name with no
       verb at all. */
    for (const locale of UI_LOCALES) {
      for (const kind of ['poi', 'npc'] as const) {
        const prompt = interactPrompt(locale, { id: 'anything', kind }) ?? '';
        expect(prompt.split(' ').length, `${kind} (${locale}) is one word`).toBeGreaterThan(1);
        expect(prompt.endsWith('.'), `${kind} (${locale}) is a sentence`).toBe(false);
      }
    }
  });

  it('never draws a name from TN-NAMES’s list, whatever it is asked about', () => {
    /*
     * The check `TN-REACH-05` asks for, at the level this module can answer it:
     * every string the prompt can produce comes from the copy table, so asking
     * it about the CN Tower cannot produce "CN Tower". The runtime half — what
     * the HUD actually draws in a browser — is `tests/e2e`.
     */
    const asked = ['cn-tower', 'chateau-frontenac', 'pier-21', 'canada-place', 'town-clock'];
    for (const locale of UI_LOCALES) {
      for (const id of asked) {
        for (const kind of ['poi', 'npc'] as const) {
          for (const done of [true, false]) {
            const prompt = (interactPrompt(locale, { id, kind, done }) ?? '').toLowerCase();
            for (const name of NAMES_ON_THE_LIST) {
              expect(prompt.includes(name), `"${prompt}" names ${name}`).toBe(false);
            }
          }
        }
      }
    }
  });

  it('draws a level’s own row where the level wrote one', () => {
    /* Ottawa may write both: its character is named and its landmark is not on
       `TN-NAMES`'s list. */
    expect(interactPrompt('en', { id: 'officer', kind: 'npc' })).toBe('Talk to the officer');
    expect(interactPrompt('fr', { id: 'officer', kind: 'npc' })).toBe("Parler à l'agent");
    expect(interactPrompt('en', { id: 'parliament-hill', kind: 'poi' })).toBe(
      'Look at Parliament Hill',
    );
  });

  it('draws the guide’s own row on all three levels that place it', () => {
    /*
     * `TN-GUIDE-03`. The row is keyed on the id the three level documents give
     * the target — `guide` — so it is one row, resolved the same way on Halifax,
     * Québec City and Toronto; the character's story writes it because writing
     * it in three level stories is how two of them come to disagree.
     *
     * The defect it fixes is what the *generic* row says: "Talk to this person"
     * is what the HUD drew whenever the beaver was in reach, on the level the
     * game opens on.
     */
    expect(interactPrompt('en', { id: 'guide', kind: 'npc' })).toBe('Talk to the guide');
    expect(interactPrompt('fr', { id: 'guide', kind: 'npc' })).toBe('Parler au guide');
    expect(interactPrompt('en', { id: 'npc.guide', kind: 'npc' })).toBe('Talk to the guide');
    for (const locale of UI_LOCALES) {
      expect(interactPrompt(locale, { id: 'guide', kind: 'npc' })).not.toBe(
        text(locale, 'hud.interact.npc'),
      );
      /* A name is not a verb phrase: the prompt is never the speaker's label. */
      expect(interactPrompt(locale, { id: 'guide', kind: 'npc' })).not.toBe(
        text(locale, 'npc.guide.name'),
      );
    }
  });

  it('lets done beat the level’s own row and the kind', () => {
    /*
     * `TN-REACH-03`. The state is the news; the invitation is not, and a player
     * told "Talk to the officer" about somebody they have finished with walks
     * back for nothing.
     */
    expect(interactPrompt('en', { id: 'officer', kind: 'npc', done: true })).toBe(
      'Done. See this one again',
    );
    expect(interactPrompt('en', { id: 'cn-tower', kind: 'poi', done: true })).toBe(
      'Done. See this one again',
    );
    expect(interactPrompt('fr', { id: 'parliament-hill', kind: 'poi', done: true })).toBe(
      'Terminé. Revoir',
    );
    /* Including the row this change added: a finished guide says the state
       first, and "Talk to the guide" is not drawn instead of it
       (`TN-GUIDE-03`). */
    expect(interactPrompt('en', { id: 'guide', kind: 'npc', done: true })).toBe(
      'Done. See this one again',
    );
  });

  it('offers the same row whichever way the event spells the id', () => {
    /* `poi/entered` carries `npc.officer` in one story and `officer` in the
       level document. Both find the row rather than one of them silently
       offering nothing. */
    expect(interactPrompt('en', { id: 'npc.officer', kind: 'npc' })).toBe('Talk to the officer');
    expect(bareTargetId('npc.officer')).toBe('officer');
    expect(bareTargetId('poi.parliament-hill')).toBe('parliament-hill');
    expect(bareTargetId('parliament-hill')).toBe('parliament-hill');
    /* A dot that is not one of the two prefixes is part of the id. */
    expect(bareTargetId('quest.ottawa.parliament-hill')).toBe('quest.ottawa.parliament-hill');
  });
});

describe('the one-time hint', () => {
  it('names no input, so it is true for a thumb, a keyboard and one switch', () => {
    /* `TN-REACH-04`, and the property the task asked to keep: a hint that names
       one input is wrong for the other three. */
    const banned = [
      'tap',
      'click',
      'press',
      'swipe',
      'hold',
      'button',
      'key',
      'touchez',
      'cliquez',
      'appuyez',
      'maintenez',
      'bouton',
      'touche',
    ];
    for (const locale of UI_LOCALES) {
      const hint = interactHint(locale).toLowerCase();
      expect(hint).not.toBe('');
      for (const word of banned) {
        expect(hint.includes(word), `the hint (${locale}) says "${word}"`).toBe(false);
      }
    }
  });

  it('is the row, in both languages', () => {
    expect(interactHint('en')).toBe(text('en', 'hud.interact.hint'));
    expect(interactHint('fr')).toBe(text('fr', 'hud.interact.hint'));
  });
});

describe('a target this build has no row for', () => {
  it('offers nothing rather than something invented', () => {
    /*
     * `TN-REACH-05`: "no prompt reads 'Interact', 'Engage', 'Use' or an empty
     * string", and no name from the level document is drawn in its place. The
     * only way to be sure of that is for the answer to be `null`, which is what
     * makes the HUD draw no control at all.
     */
    expect(interactPrompt('en', { id: 'anything', kind: 'nothing' as 'poi' })).toBeNull();
  });
});
