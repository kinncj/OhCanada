import { describe, expect, it } from 'vitest';

import rigJson from '@content/characters/rig.json';
import type { RigDocument } from '@application/ports';
import { defaultSettings } from '@domain/entities/player';
import { newProgress, withCharacter } from '@domain/entities/progress';
import type { PlayerCharacter } from '@domain/entities/character';
import type { LocaleCode } from '@domain/ids';
import { toProgressSnapshot } from '@application/persistence/progress-document';
import { validateProgressDocument } from '@application/persistence/progress-schema';
import {
  creatorSlots,
  creatorSlotsByLocale,
  missingCreatorRows,
  optionLabelKey,
  playerSlots,
  repairSelection,
  slotLabelKey,
  slotTestId,
  toPlayerCharacter,
  toSelection,
} from '../../../app/bootstrap/character-slots';

/**
 * `docs/stories/TN-LOOK-what-the-player-can-choose.md` — `TN-LOOK-01` through
 * `TN-LOOK-05`, and `TN-SKIN-01`'s "no tone is the default".
 *
 * This is `TN-LOOK-04`'s gate: **nobody invents an option name.** The rig is
 * read from the shipped document rather than from a fixture, so a slot the art
 * agent adds, or an option they remove, fails here on the next run rather than
 * shipping a group whose heading is a localiser key.
 *
 * The one thing it deliberately does not assert is that a name is *right*.
 * `TN-LOOK` and `TN-SKIN` are the wording, an agent wrote them, and
 * `docs/content-review.md` §1 forbids an agent granting sign-off on any of it.
 */

const RIG = rigJson as unknown as RigDocument;

/** Would the shipped save validator accept a progress document holding this? */
function characterIsSavable(character: PlayerCharacter): boolean {
  const progress = withCharacter(
    newProgress(defaultSettings('en' as LocaleCode), []),
    character,
  );
  const snapshot = toProgressSnapshot(progress, { version: 1, updatedAt: 0 as never });
  return snapshot.ok && validateProgressDocument(snapshot.value).ok;
}

/** A rig with one slot changed, for the failure paths. Never written to disk. */
function rigWith(slots: Record<string, unknown>): RigDocument {
  return {
    ...RIG,
    slots: { ...(RIG.slots as unknown as Record<string, unknown>), ...slots },
  } as unknown as RigDocument;
}

describe('the creator is the rig, named', () => {
  it('offers the rig’s player-selectable slots, in the rig’s order', () => {
    expect(playerSlots().map((entry) => entry.name)).toEqual([
      'skin',
      'hairShape',
      'hairColour',
      'headCovering',
      'feature',
    ]);
  });

  it('offers no group for a slot the creator does not own', () => {
    const names = playerSlots().map((entry) => entry.name);

    /* `costume` says WHICH character an artboard is, not how a player
       customised one, and `presentation` is reserved with no options. A group
       heading for a group that cannot exist is a screen describing a state it
       is not in. */
    expect(names).not.toContain('costume');
    expect(names).not.toContain('presentation');
  });

  it('spells every key from the rig, by the one rule', () => {
    expect(slotLabelKey('hairShape')).toBe('creator.slot.hairShape');
    expect(optionLabelKey('skin', 'skin-1')).toBe('creator.skin.skin-1');
    /* It stutters, and it stays: a key derived by one rule is a key a gate can
       generate; a prettier key is a mapping somebody maintains. */
    expect(optionLabelKey('headCovering', 'none')).toBe('creator.headCovering.none');
    expect(optionLabelKey('feature', 'none')).toBe('creator.feature.none');
  });

  it('gives the two "none" options two rows, never one shared row', () => {
    const slots = creatorSlots('en');
    const covering = slots.find((slot) => slot.id === 'headCovering');
    const feature = slots.find((slot) => slot.id === 'feature');

    expect(covering?.options.find((option) => option.id === 'none')?.name).toBe('None');
    expect(feature?.options.find((option) => option.id === 'none')?.name).toBe('No');
  });

  it('names the group the way the story spells it', () => {
    expect(slotTestId('skin')).toBe('slot-skin');
    expect(slotTestId('hairShape')).toBe('slot-hair-shape');
    expect(slotTestId('headCovering')).toBe('slot-head-covering');
  });

  it('names every slot and every option the rig declares, in both languages', () => {
    expect(missingCreatorRows()).toEqual([]);
  });

  it('fails when the rig gains a slot nobody has named (the negative control)', () => {
    const grown = rigWith({
      fringe: { options: ['none', 'blunt'], fallback: 'none', playerSelectable: true },
    });
    const artboards = grown.artboards.map((board) =>
      board.playerSelectableSlots.length === 0
        ? board
        : { ...board, playerSelectableSlots: [...board.playerSelectableSlots, 'fringe'] },
    );
    const withArtboard = { ...grown, artboards } as RigDocument;

    const missing = missingCreatorRows(withArtboard);
    expect(missing).toContain('creator.slot.fringe');
    expect(missing).toContain('creator.fringe.blunt');
    /* Every one of them, not only the first (`TN-LOOK-04`). */
    expect(missing.length).toBe(3);
    /* And the unnamed slot is not drawn, so no player ever reads a key. */
    expect(creatorSlots('en', withArtboard).map((slot) => slot.id)).not.toContain('fringe');
  });

  it('carries the counts the arithmetic depends on: 6 × 4 × 5 × 2 × 2 = 480', () => {
    const slots = creatorSlots('en');
    const counts = slots.map((slot) => slot.options.length);

    expect(counts).toEqual([6, 4, 5, 2, 2]);
    expect(counts.reduce((product, count) => product * count, 1)).toBe(480);
  });

  it('draws the six tones in the rig’s order, with no ramp renamed', () => {
    const skin = creatorSlots('en').find((slot) => slot.id === 'skin');

    expect(skin?.options.map((option) => option.id)).toEqual([
      'skin-1',
      'skin-2',
      'skin-3',
      'skin-4',
      'skin-5',
      'skin-6',
    ]);
    expect(skin?.options.map((option) => option.name)).toEqual([
      '1, light',
      '2, light',
      '3, medium',
      '4, medium',
      '5, dark',
      '6, dark',
    ]);
  });

  it('reads the French names, with the agreements English does not have', () => {
    const fr = creatorSlotsByLocale().fr;
    const name = (slot: string, option: string): string | undefined =>
      fr.find((entry) => entry.id === slot)?.options.find((o) => o.id === option)?.name;

    expect(fr.map((slot) => slot.label)).toEqual([
      'Teint de peau',
      'Cheveux',
      'Couleur des cheveux',
      'Couvre-chef',
      'Lunettes',
    ]);
    /* Plural, because they agree with « cheveux » — never with the player. */
    expect(name('hairShape', 'crop')).toBe('Courts');
    expect(name('hairShape', 'long')).toBe('Longs');
    /* The one row a word-for-word translation gets fluently wrong. */
    expect(name('hairColour', 'red')).toBe('Roux');
    expect(name('hairColour', 'red')).not.toBe('Rouges');
    /* « Gris » already carries its plural; no second -s. */
    expect(name('hairColour', 'grey')).toBe('Gris');
    /* Two spellings, one letter apart, and neither is a typo. */
    expect(name('headCovering', 'toque')).toBe('Tuque');
    expect(creatorSlotsByLocale().en
      .find((slot) => slot.id === 'headCovering')
      ?.options.find((option) => option.id === 'toque')?.name).toBe('Toque');
  });

  it('keeps the two languages the same shape, id for id', () => {
    const { en, fr } = creatorSlotsByLocale();
    expect(en.map((slot) => slot.id)).toEqual(fr.map((slot) => slot.id));
    for (const [index, slot] of en.entries()) {
      expect(slot.options.map((option) => option.id)).toEqual(
        fr[index]?.options.map((option) => option.id),
      );
      /* A French name that fell back to the English word would be a screen
         quietly speaking the wrong language (`TN-LOOK-10`). Only the two rows
         that are genuinely the same word in both may match. */
      for (const [position, option] of slot.options.entries()) {
        const other = fr[index]?.options[position]?.name ?? '';
        if (option.name === other) {
          expect(['1, light', '2, light'].includes(option.name)).toBe(false);
        }
      }
    }
  });

  it('hands app/ui no fallback at all, because a fallback is not an option here', () => {
    /* `CreatorSlot` has no field for one, which is the mechanical half of "the
       creator never renders the fallback as a pre-selection". This asserts the
       shape rather than trusting the type, because the type is erased. */
    for (const slot of creatorSlots('en')) {
      expect(Object.keys(slot).sort()).toEqual(['id', 'label', 'options', 'testId']);
      for (const option of slot.options) {
        expect(Object.keys(option).sort()).toEqual(['id', 'name']);
      }
    }
  });
});

describe('a saved appearance this build cannot draw', () => {
  const always = (value: number) => (): number => value;

  it('redraws the gone slot uniformly, and never reaches for the fallback', () => {
    /* `skin-3`, `crop`, `brown`, `toque`, `none` is the fallback combination.
       A repair that produced it every time would be the default player coming
       back through the door `TN-FIRSTRUN` ruling 2 closed. */
    const saved = {
      skin: 'skin-9',
      hairShape: 'coil',
      hairColour: 'red',
      headCovering: 'none',
      feature: 'glasses',
    };
    /* A source pinned to the first option: if the repair read the fallback it
       would answer `skin-3`, and it answers `skin-1`. */
    const first = repairSelection(saved, always(0));

    expect(first.repaired).toBe(true);
    expect(first.selection['skin']).toBe('skin-1');
    expect(first.selection['skin']).not.toBe('skin-3');
    /* Only the slot whose option is gone was changed (`TN-LOOK-05`). */
    expect(first.selection['hairShape']).toBe('coil');
    expect(first.selection['hairColour']).toBe('red');
    expect(first.selection['headCovering']).toBe('none');
    expect(first.selection['feature']).toBe('glasses');
  });

  it('treats a slot the save never named as the same case', () => {
    const repaired = repairSelection({ skin: 'skin-2' }, always(0.99));

    expect(repaired.repaired).toBe(true);
    expect(repaired.selection['skin']).toBe('skin-2');
    expect(repaired.selection['hairShape']).toBe('long');
    expect(Object.keys(repaired.selection).length).toBe(5);
  });

  it('ignores a slot from a newer build rather than repairing anything', () => {
    const saved = {
      skin: 'skin-2',
      hairShape: 'bob',
      hairColour: 'grey',
      headCovering: 'toque',
      feature: 'none',
      /* `OQ-FIRSTRUN-5`: an unknown slot draws no part, which is the mechanism
         every "none" option already uses. */
      freckles: 'many',
    };
    const repaired = repairSelection(saved, always(0));

    expect(repaired.repaired).toBe(false);
    expect(repaired.selection['freckles']).toBeUndefined();
    expect(repaired.selection['skin']).toBe('skin-2');
  });

  it('calls a save with no character a first run, and raises no message', () => {
    const opened = repairSelection(undefined, always(0));

    /* Every slot answered, and nothing to tell the player about: a first run is
       a draw, not a repair. */
    expect(Object.keys(opened.selection).length).toBe(5);
    expect(opened.repaired).toBe(false);
  });

  it('draws uniformly over a thousand opens, and never favours the fallback', () => {
    let state = 0x9e37_79b9;
    const random = (): number => {
      state = (state * 1_664_525 + 1_013_904_223) >>> 0;
      return state / 0x1_0000_0000;
    };
    const counts = new Map<string, number>();
    for (let run = 0; run < 1000; run += 1) {
      const drawn = repairSelection(undefined, random).selection;
      for (const [slot, option] of Object.entries(drawn)) {
        const key = `${slot}:${option}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    for (const slot of creatorSlots('en')) {
      const expected = 1000 / slot.options.length;
      for (const option of slot.options) {
        const seen = counts.get(`${slot.id}:${option.id}`) ?? 0;
        expect(seen, `${slot.id}:${option.id} never came up`).toBeGreaterThan(0);
        expect(seen, `${slot.id}:${option.id} came up ${String(seen)} times`).toBeLessThan(
          expected * 2,
        );
      }
    }
    /* And the fallback combination is no more likely than any other: `skin-3`
       is one tone in six, not the tone the screen opens on (`TN-SKIN-01`). */
    const three = counts.get('skin:skin-3') ?? 0;
    expect(three).toBeGreaterThan(1000 / 6 / 2);
    expect(three).toBeLessThan((1000 / 6) * 2);
  });
});

describe('the round trip through the save', () => {
  const SELECTION = {
    skin: 'skin-5',
    hairShape: 'coil',
    hairColour: 'black',
    headCovering: 'none',
    feature: 'glasses',
  };

  it('writes the choices under the rig’s own player id, and reads them back', () => {
    const character = toPlayerCharacter(SELECTION);

    expect(String(character.characterId)).toBe('player');
    expect(toSelection(character)).toEqual(SELECTION);
  });

  it('keys them the way the save schema will accept, which is not the rig’s spelling', () => {
    /*
     * The defect this pins, so it cannot be "tidied" away by somebody who reads
     * the kebab keys as a mistake: `progress.schema.json` constrains
     * `character.skins`' property names with `common.schema.json#/$defs/id`,
     * which is kebab-case, and `progress-schema.ts` enforces it **on encode**.
     * A character keyed `hairShape` therefore fails every save write, silently,
     * and the player stays a first-run player for ever.
     *
     * `character.schema.json` already fixed the same contradiction on its own
     * side. When `progress.schema.json` does too, this test is what says which
     * lines to delete — and a migration maps these keys forward.
     */
    const character = toPlayerCharacter(SELECTION);

    expect(Object.keys(character.skins).sort()).toEqual([
      'feature',
      'hair-colour',
      'hair-shape',
      'head-covering',
      'skin',
    ]);
    for (const key of Object.keys(character.skins)) {
      expect(key, `${key} is not an id the save schema accepts`).toMatch(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      );
    }
  });

  it('reads a camelCase save as slots this build does not know, and redraws them', () => {
    /* A save from a build that stored what the rig spells — which is what the
       schema will accept once it is fixed — costs the player nothing: the
       unknown keys are ignored and the slots are redrawn uniformly. */
    const fromFuture = toSelection({
      characterId: 'player' as never,
      skins: { skin: 'skin-5', hairShape: 'coil' },
    });
    const repaired = repairSelection(fromFuture, () => 0);

    expect(repaired.selection['skin']).toBe('skin-5');
    expect(Object.keys(repaired.selection).length).toBe(5);
    expect(repaired.repaired).toBe(true);
  });

  it('carries no free text a player could be identified by', () => {
    const character = toPlayerCharacter({ skin: 'skin-1' });
    expect(Object.keys(character).sort()).toEqual(['characterId', 'skins']);
  });

  it('survives the save validator that refuses what the rig spells', () => {
    /* The negative control for the encoding above, run against the validator
       that actually refuses the write rather than against a re-statement of its
       rule. Without this the two tests above could both pass while the save
       still failed. */
    const accepted = toPlayerCharacter(SELECTION);
    const refused = { characterId: accepted.characterId, skins: { ...SELECTION } };

    expect(characterIsSavable(accepted)).toBe(true);
    expect(characterIsSavable(refused)).toBe(false);
  });

  it('reads no character as no character, which is what decides the first run', () => {
    expect(toSelection(null)).toBeUndefined();
  });
});
