import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import rigJson from '@content/characters/rig.json';
import type { RigDocument, RigSlot } from '@application/ports';
import { defaultSettings } from '@domain/entities/player';
import { newProgress, withCharacter } from '@domain/entities/progress';
import type { PlayerCharacter } from '@domain/entities/character';
import type { LocaleCode } from '@domain/ids';
import { toProgressSnapshot } from '@application/persistence/progress-document';
import { validateProgressDocument } from '@application/persistence/progress-schema';
import type { CreatorSlot } from '@ui/character-creator';
import {
  creatorSlots,
  creatorSlotsByLocale,
  missingCreatorRows,
  missingSwatches,
  optionLabelKey,
  optionSwatch,
  playerSlots,
  repairSelection,
  slotHelpKey,
  slotLabelKey,
  slotTestId,
  toPlayerCharacter,
  toSelection,
  type SwatchPalette,
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
 * **Which slots are offered is the rig's `playerSelectable` flag.** It used to
 * be the copy table — a slot with no label row was skipped — which hid `costume`
 * by accident and would have hidden a selectable slot that lost its row without
 * a sound. The tests below prove the flag decides in both directions, and that a
 * selectable slot with a missing row throws rather than disappears (ADR-0024).
 *
 * The shipped rig offers `presentation`, listed last on the player artboard, so
 * every test over the shipped rig pins all six slots exactly. The tests *about*
 * the states `presentation` passed through on the way (reserved, selectable
 * with no options) run over a fixture rig in which that state is fixed, so they
 * keep proving the creator's behaviour for a slot in either state.
 *
 * The one thing it deliberately does not assert is that a name is *right*.
 * `TN-LOOK` and `TN-SKIN` are the wording, an agent wrote them, and
 * `docs/content-review.md` §1 forbids an agent granting sign-off on any of it.
 */

const RIG = rigJson as unknown as RigDocument;

/** `assets/style/palette.json`, read off disk rather than through the module under test. */
const PALETTE = JSON.parse(
  readFileSync(new URL('../../../assets/style/palette.json', import.meta.url), 'utf8'),
) as SwatchPalette;

/** The five slots `TN-LOOK-01` names, in its order. */
const FIVE = ['skin', 'hairShape', 'hairColour', 'headCovering', 'feature'] as const;

/** What the shipped rig offers: the five, and `presentation` listed after them. */
const SIX = [...FIVE, 'presentation'] as const;

const slotOf = (rig: RigDocument, name: string): RigSlot | undefined =>
  (rig.slots as unknown as Readonly<Record<string, RigSlot | undefined>>)[name];

const fiveOf = (slots: readonly CreatorSlot[]): readonly CreatorSlot[] =>
  slots.filter((slot) => (FIVE as readonly string[]).includes(slot.id));

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

/** The player artboard with these slots appended to its list. */
function listing(rig: RigDocument, ...names: readonly string[]): RigDocument {
  const artboards = rig.artboards.map((board) =>
    board.playerSelectableSlots.length === 0
      ? board
      : {
          ...board,
          playerSelectableSlots: [
            ...board.playerSelectableSlots.filter((name) => !names.includes(name)),
            ...names,
          ],
        },
  );
  return { ...rig, artboards } as RigDocument;
}

/** The player artboard with these slots taken off its list. */
function unlisting(rig: RigDocument, ...names: readonly string[]): RigDocument {
  const artboards = rig.artboards.map((board) => ({
    ...board,
    playerSelectableSlots: board.playerSelectableSlots.filter((name) => !names.includes(name)),
  }));
  return { ...rig, artboards } as RigDocument;
}

/* The three states `presentation` can be in, as fixtures. */
const RESERVED = {
  options: [],
  fallback: null,
  playerSelectable: false,
  status: 'reserved',
  blockedBy: 'OQ-ART-08 / OQ-LEVEL-3',
};
/** Marked selectable before its art exists: nothing to choose yet. */
const AWAITING_ART = { options: [], fallback: null, playerSelectable: true };
/** The ids the art agent is adding, exactly. */
const OFFERED = {
  options: ['feminine', 'masculine', 'neutral'],
  fallback: 'neutral',
  playerSelectable: true,
};

describe('the creator is the rig, named', () => {
  it('offers the rig’s player-selectable slots, in the rig’s order', () => {
    const names = playerSlots().map((entry) => entry.name);

    expect(names).toEqual([...SIX]);
    /* Listed, not appended for having been forgotten: the artboard's own list
       is the order, and the shipped list names all six. */
    const player = RIG.artboards.find((board) => board.playerSelectableSlots.length > 0);
    expect(player?.playerSelectableSlots).toEqual([...SIX]);
  });

  it('offers no group for a slot the creator does not own', () => {
    const names = playerSlots().map((entry) => entry.name);

    /* `costume` says WHICH character an artboard is, not how a player
       customised one. A group heading for a group that cannot exist is a
       screen describing a state it is not in. */
    expect(names).not.toContain('costume');
  });

  it('spells every key from the rig, by the one rule', () => {
    expect(slotLabelKey('hairShape')).toBe('creator.slot.hairShape');
    expect(slotHelpKey('skin')).toBe('creator.slot.skin.help');
    expect(optionLabelKey('skin', 'skin-1')).toBe('creator.skin.skin-1');
    /* It stutters, and it stays: a key derived by one rule is a key a gate can
       generate; a prettier key is a mapping somebody maintains. */
    expect(optionLabelKey('headCovering', 'none')).toBe('creator.headCovering.none');
    expect(optionLabelKey('feature', 'none')).toBe('creator.feature.none');
    expect(optionLabelKey('presentation', 'neutral')).toBe('creator.presentation.neutral');
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
    expect(slotTestId('presentation')).toBe('slot-presentation');
  });

  it('names every slot and every option the rig declares, in both languages', () => {
    expect(missingCreatorRows()).toEqual([]);
    expect(() => creatorSlotsByLocale()).not.toThrow();
  });

  it('carries the counts the arithmetic depends on: 6 × 4 × 5 × 2 × 2 × 3 = 1440', () => {
    const counts = creatorSlots('en').map((slot) => slot.options.length);

    expect(counts).toEqual([6, 4, 5, 2, 2, 3]);
    expect(counts.reduce((product, count) => product * count, 1)).toBe(1440);
    /* The five `TN-LOOK` slots are unchanged by the sixth's arrival (§8.2). */
    expect(fiveOf(creatorSlots('en')).map((slot) => slot.options.length)).toEqual([6, 4, 5, 2, 2]);
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
      'Style',
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
       shape rather than trusting the type, because the type is erased. The only
       additions are the reading line and the swatch, and each is allowed only
       where it belongs. */
    for (const slot of creatorSlots('en')) {
      const keys = Object.keys(slot).sort();
      expect(keys).toEqual(
        slot.id === 'skin'
          ? ['help', 'id', 'label', 'options', 'testId']
          : ['id', 'label', 'options', 'testId'],
      );
      for (const option of slot.options) {
        expect(Object.keys(option).sort()).toEqual(
          slot.id === 'skin' ? ['id', 'name', 'swatch'] : ['id', 'name'],
        );
      }
    }
  });
});

describe('which slots are offered is the rig’s flag, and nothing else', () => {
  it('leaves costume out because the rig says it is not the player’s, not because it has no row', () => {
    const costume = slotOf(RIG, 'costume');
    expect(costume?.playerSelectable).toBe(false);
    expect(playerSlots().map((entry) => entry.name)).not.toContain('costume');

    /* Flip only the flag. If the copy table were still deciding, costume would
       stay hidden — it has no row. It is offered, and the build fails loudly
       on the rows nobody wrote. */
    const flipped = rigWith({ costume: { ...costume, playerSelectable: true } });
    expect(playerSlots(flipped).map((entry) => entry.name)).toContain('costume');
    expect(() => creatorSlots('en', flipped)).toThrow(/creator\.slot\.costume/);
  });

  it('does not offer a slot the artboard lists when the rig marks it not selectable', () => {
    const listed = listing(RIG, 'costume');

    expect(playerSlots(listed).map((entry) => entry.name)).not.toContain('costume');
    expect(() => creatorSlots('en', listed)).not.toThrow();
  });

  it('offers a selectable slot the artboard forgot to list, after the listed ones', () => {
    const forgotten = unlisting(rigWith({ presentation: OFFERED }), 'presentation');
    const names = playerSlots(forgotten).map((entry) => entry.name);

    expect(names.slice(0, 5)).toEqual([...FIVE]);
    expect(names).toContain('presentation');
  });

  it('throws, naming every missing row, when a selectable slot has none (the negative control)', () => {
    const grown = rigWith({
      fringe: { options: ['none', 'blunt'], fallback: 'none', playerSelectable: true },
    });

    for (const rig of [listing(grown, 'fringe'), grown]) {
      const missing = missingCreatorRows(rig);
      /* Every one of them, not only the first (`TN-LOOK-04`) — and whether or
         not the artboard lists the slot, because the flag is what offers it. */
      expect(missing).toEqual(['creator.slot.fringe', 'creator.fringe.none', 'creator.fringe.blunt']);

      let message = '';
      try {
        creatorSlots('fr', rig);
      } catch (error) {
        message = String(error);
      }
      expect(message, 'a selectable slot with no rows was silently left out').not.toBe('');
      for (const key of missing) expect(message).toContain(key);
      expect(() => creatorSlotsByLocale(rig)).toThrow(/ADR-0024/);
    }
  });
});

describe('the presentation slot', () => {
  it('offers nothing while it is reserved', () => {
    const rig = unlisting(rigWith({ presentation: RESERVED }), 'presentation');

    expect(playerSlots(rig).map((entry) => entry.name)).toEqual([...FIVE]);
    expect(creatorSlots('en', rig).map((slot) => slot.id)).not.toContain('presentation');
  });

  it('offers nothing — no heading over an empty group — while it is selectable with no options', () => {
    /* The state between the art agent marking the slot selectable and the art
       landing. Nothing to choose, so nothing drawn, and nothing missing. */
    const rig = listing(rigWith({ presentation: AWAITING_ART }), 'presentation');

    expect(playerSlots(rig).map((entry) => entry.name)).toEqual([...FIVE]);
    expect(missingCreatorRows(rig)).toEqual([]);
    expect(creatorSlots('fr', rig).map((slot) => slot.id)).not.toContain('presentation');
  });

  it('offers three named options once the art lands, in both languages', () => {
    const rig = listing(rigWith({ presentation: OFFERED }), 'presentation');
    const { en, fr } = creatorSlotsByLocale(rig);
    const enSlot = en.find((slot) => slot.id === 'presentation');
    const frSlot = fr.find((slot) => slot.id === 'presentation');

    expect(missingCreatorRows(rig)).toEqual([]);
    expect(enSlot?.testId).toBe('slot-presentation');
    expect(enSlot?.label).toBe('Style');
    expect(enSlot?.options).toEqual([
      { id: 'feminine', name: 'Feminine' },
      { id: 'masculine', name: 'Masculine' },
      { id: 'neutral', name: 'Neutral' },
    ]);
    /* The same word in both languages, written out so a reviewer does not
       "correct" it (`docs/stories/README.md`). */
    expect(frSlot?.label).toBe('Style');
    expect(frSlot?.options.map((option) => option.name)).toEqual(['Féminin', 'Masculin', 'Neutre']);
    /* The five it joins are unchanged by its arrival (§8.2). */
    expect(fiveOf(en).map((slot) => slot.options.length)).toEqual([6, 4, 5, 2, 2]);
  });

  it('agrees in French with « style », never with the player', () => {
    const fr = creatorSlots('fr', listing(rigWith({ presentation: OFFERED }), 'presentation'));
    const names = fr.find((slot) => slot.id === 'presentation')?.options.map((option) => option.name);

    /* « Féminin » is the masculine form, because « style » is masculine: the
       word does not change with the option chosen, or with who chose it. */
    expect(names).not.toContain('Féminine');
    expect(names).not.toContain('Masculine');
    for (const name of names ?? []) {
      expect(/\(e\)|·e\b|-e\)/.test(name), `${name} needs agreement`).toBe(false);
    }
  });

  it('names what is visible and never an identity, in either language', () => {
    /* `docs/content-review.md` §8.6: "No option is called 'Boy', 'Girl',
       'Male', 'Female'". Checked word by word, so « Féminin » is not a hit for
       "femme" and "Masculine" is not a hit for "man". */
    const refused = [
      'boy',
      'girl',
      'male',
      'female',
      'man',
      'woman',
      'gender',
      'sex',
      'garçon',
      'fille',
      'homme',
      'femme',
      'genre',
      'sexe',
    ];
    const rig = listing(rigWith({ presentation: OFFERED }), 'presentation');
    for (const [locale, slots] of Object.entries(creatorSlotsByLocale(rig))) {
      const slot = slots.find((entry) => entry.id === 'presentation');
      const words = [slot?.label ?? '', ...(slot?.options ?? []).map((option) => option.name)]
        .flatMap((value) => value.toLowerCase().split(/[^\p{L}]+/u))
        .filter((word) => word !== '');
      expect(words.length, `${locale}: no words were read`).toBeGreaterThan(3);
      for (const word of words) {
        expect(refused.includes(word), `${locale}: "${word}" names an identity`).toBe(false);
      }
    }
  });

  it('draws the three uniformly, like every other slot (§8.3)', () => {
    const rig = listing(rigWith({ presentation: OFFERED }), 'presentation');
    let state = 0x2545_f491;
    const random = (): number => {
      state = (state * 1_664_525 + 1_013_904_223) >>> 0;
      return state / 0x1_0000_0000;
    };
    const counts = new Map<string, number>();
    for (let run = 0; run < 1000; run += 1) {
      const drawn = repairSelection(undefined, random, rig).selection['presentation'] ?? '';
      counts.set(drawn, (counts.get(drawn) ?? 0) + 1);
    }

    for (const option of OFFERED.options) {
      const seen = counts.get(option) ?? 0;
      expect(seen, `${option} never came up`).toBeGreaterThan(0);
      expect(seen, `${option} came up ${String(seen)} times`).toBeLessThan((1000 / 3) * 2);
    }
    expect(counts.has('')).toBe(false);
  });
});

describe('the skin swatches', () => {
  it('draws every tone from the palette ramp of the same id, in both languages', () => {
    const { en, fr } = creatorSlotsByLocale();
    for (const slots of [en, fr]) {
      const skin = slots.find((slot) => slot.id === 'skin');
      expect(skin?.options.length).toBe(6);
      for (const option of skin?.options ?? []) {
        const base = PALETTE.ramps[option.id]?.base ?? '';
        expect(option.swatch, `${option.id} has no swatch`).toBeDefined();
        expect(option.swatch).toBe(PALETTE.colours[base]);
        expect(optionSwatch(option.id)).toBe(option.swatch);
      }
    }
  });

  it('draws no swatch on any other slot', () => {
    const others = creatorSlots('en').filter((slot) => slot.id !== 'skin');
    expect(others.length).toBeGreaterThan(3);
    for (const slot of others) {
      for (const option of slot.options) {
        expect(option.swatch, `${slot.id}.${option.id}`).toBeUndefined();
      }
    }
  });

  it('throws, naming the tone, when the palette loses a ramp (the negative control)', () => {
    const { 'skin-4': _gone, ...ramps } = PALETTE.ramps;
    const broken: SwatchPalette = { colours: PALETTE.colours, ramps };

    expect(missingSwatches(RIG, PALETTE)).toEqual([]);
    expect(missingSwatches(RIG, broken)).toEqual(['skin.skin-4']);
    expect(() => creatorSlots('en', RIG, broken)).toThrow(/skin\.skin-4/);
  });

  it('carries the reading line on the skin group only, in both languages', () => {
    const { en, fr } = creatorSlotsByLocale();

    expect(en.find((slot) => slot.id === 'skin')?.help).toBe('From light to dark');
    expect(fr.find((slot) => slot.id === 'skin')?.help).toBe('Du clair au foncé');
    for (const slot of [...en, ...fr].filter((entry) => entry.id !== 'skin')) {
      expect(slot.help, slot.id).toBeUndefined();
    }
  });
});

describe('a saved appearance this build cannot draw', () => {
  const always = (value: number) => (): number => value;
  const OFFERED_COUNT = playerSlots().length;

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
    /* The save predates `presentation`: filled, silently, from the fallback. */
    expect(first.selection['presentation']).toBe('neutral');
  });

  it('keeps a save written before presentation existed whole, and tells the player nothing', () => {
    /*
     * Every returning player's save looks like this: the five slots, all still
     * offered, and no `presentation`. Nothing they chose is gone, so "one of
     * your choices is not in this version" would be untrue, and it would be
     * shown to all of them. The new slot takes the rig's fallback, which is
     * what the rig keeps `fallback` for. The draw is pinned away from it
     * (`always(0)` would draw `feminine`), so a draw cannot pass for the
     * fallback here.
     */
    const beforePresentation = {
      skin: 'skin-4',
      hairShape: 'long',
      hairColour: 'black',
      headCovering: 'toque',
      feature: 'none',
    };
    const kept = repairSelection(beforePresentation, always(0));

    expect(kept.repaired).toBe(false);
    expect(kept.selection).toEqual({ ...beforePresentation, presentation: 'neutral' });
    expect(slotOf(RIG, 'presentation')?.fallback).toBe('neutral');
    expect(slotOf(RIG, 'presentation')?.options[0]).not.toBe('neutral');
  });

  it('fills a slot the save never named from the fallback, and does not call it a repair', () => {
    const filled = repairSelection({ skin: 'skin-2' }, always(0.99));

    expect(filled.repaired).toBe(false);
    expect(filled.selection['skin']).toBe('skin-2');
    /* `always(0.99)` would draw the last option, `long`; the fallback is `crop`. */
    expect(filled.selection['hairShape']).toBe('crop');
    expect(filled.selection['presentation']).toBe('neutral');
    expect(Object.keys(filled.selection).length).toBe(OFFERED_COUNT);
  });

  it('draws for an unnamed slot only when the rig gives it no usable fallback, still silently', () => {
    const noFallback = rigWith({ presentation: { ...OFFERED, fallback: null } });
    const filled = repairSelection({ skin: 'skin-2' }, always(0), noFallback);

    expect(filled.repaired).toBe(false);
    expect(filled.selection['presentation']).toBe('feminine');
  });

  it('ignores a slot from a newer build rather than repairing anything', () => {
    const saved = {
      skin: 'skin-2',
      hairShape: 'bob',
      hairColour: 'grey',
      headCovering: 'toque',
      feature: 'none',
      presentation: 'masculine',
      /* `OQ-FIRSTRUN-5`: an unknown slot draws no part, which is the mechanism
         every "none" option already uses. */
      freckles: 'many',
    };
    const repaired = repairSelection(saved, always(0));

    expect(repaired.repaired).toBe(false);
    expect(repaired.selection['freckles']).toBeUndefined();
    expect(repaired.selection['skin']).toBe('skin-2');
    expect(repaired.selection['presentation']).toBe('masculine');
  });

  it('calls a save with no character a first run, and raises no message', () => {
    const opened = repairSelection(undefined, always(0));

    /* Every slot answered, and nothing to tell the player about: a first run is
       a draw, not a repair. */
    expect(Object.keys(opened.selection).length).toBe(OFFERED_COUNT);
    expect(OFFERED_COUNT).toBeGreaterThanOrEqual(5);
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
  const SELECTION: Readonly<Record<string, string>> = {
    skin: 'skin-5',
    hairShape: 'coil',
    hairColour: 'black',
    headCovering: 'none',
    feature: 'glasses',
    presentation: 'neutral',
  };

  it('writes the choices under the rig’s own player id, and reads them back', () => {
    const character = toPlayerCharacter(SELECTION);

    expect(String(character.characterId)).toBe('player');
    expect(toSelection(character)).toEqual(SELECTION);
  });

  it('keys them the way the rig spells its slots, with nothing converted on the way', () => {
    /*
     * The workaround that used to live here, and what replaced it.
     * `progress.schema.json` constrained `character.skins`' property names with
     * `common.schema.json#/$defs/id`, which is kebab-case, while the rig names
     * its slots `hairShape`, `hairColour`, `headCovering`; `progress-schema.ts`
     * enforces the pattern **on encode**, so a character keyed the rig's way
     * failed every save write and the player stayed a first-run player for ever.
     * This module kebab-cased the key on the way in and camel-cased it on the
     * way out until the schema was fixed. Both conversions are gone, so what is
     * asserted now is that the save carries the rig's own keys, unaltered.
     */
    const character = toPlayerCharacter(SELECTION);

    for (const name of FIVE) expect(Object.keys(character.skins)).toContain(name);
    expect(character.skins).toEqual(SELECTION);
    // Every key the rig declares as player-selectable is in there, spelled as
    // the rig spells it — not as a rule this test restates.
    expect(Object.keys(character.skins).sort()).toEqual(
      playerSlots()
        .map((entry) => entry.name)
        .sort(),
    );
  });

  it('copies the selection instead of aliasing the object the creator holds', () => {
    const selection: Record<string, string> = { ...SELECTION };
    const character = toPlayerCharacter(selection);
    selection['skin'] = 'skin-1';
    expect(character.skins['skin']).toBe('skin-5');
    expect(toSelection(character)).not.toBe(character.skins);
  });

  it('reads a kebab-keyed save as slots this build does not know, and fills the rest', () => {
    /* What is left of a save the workaround wrote and the 3 -> 4 migration did
       not reach — an imported file at version 4, say, hand-edited. It costs the
       player nothing here either: the unknown keys are ignored like any slot
       from another build, and the slots the save does not name are filled from
       the rig's fallback, as for any save older than a slot. No option the save
       names is gone, so there is nothing to tell. */
    const fromTheWorkaround = toSelection({
      characterId: 'player' as never,
      skins: { skin: 'skin-5', 'hair-shape': 'coil' },
    });
    const repaired = repairSelection(fromTheWorkaround, () => 0);

    expect(repaired.selection['skin']).toBe('skin-5');
    expect(repaired.selection['hair-shape']).toBeUndefined();
    expect(repaired.selection['hairShape']).toBe(slotOf(RIG, 'hairShape')?.fallback);
    expect(Object.keys(repaired.selection).length).toBe(playerSlots().length);
    expect(repaired.repaired).toBe(false);
  });

  it('carries no free text a player could be identified by', () => {
    const character = toPlayerCharacter({ skin: 'skin-1' });
    expect(Object.keys(character).sort()).toEqual(['characterId', 'skins']);
  });

  it('survives the save validator, which is the check the conversion existed to pass', () => {
    /*
     * Run against the validator that actually refuses the write rather than
     * against a re-statement of its rule — without this, the tests above could
     * pass while every save still failed, which is precisely what happened.
     * The negative control has changed sides: what the schema refuses now is the
     * kebab form the workaround used to produce.
     */
    const accepted = toPlayerCharacter(SELECTION);
    const refused = {
      characterId: accepted.characterId,
      skins: { skin: 'skin-5', 'hair-shape': 'coil' },
    };

    expect(characterIsSavable(accepted)).toBe(true);
    expect(characterIsSavable(refused)).toBe(false);
  });

  it('refuses a character that chose nothing, which is not the same as no character', () => {
    /*
     * ADR-0024, proved by removing the data rather than by asserting over a
     * fixture: take the character this build really writes and empty it. `{}`
     * comes back from every repair fully dressed, so it would read as a player
     * who chose nothing and be silently replaced by somebody. "No character
     * yet" is already writable, and it is `null`.
     */
    const chose = toPlayerCharacter(SELECTION);
    const choseNothing = { characterId: chose.characterId, skins: {} };

    expect(characterIsSavable(chose)).toBe(true);
    expect(characterIsSavable(choseNothing)).toBe(false);
    // And the state it must not be confused with is still accepted.
    const noCharacter = toProgressSnapshot(newProgress(defaultSettings('en' as LocaleCode), []), {
      version: 1,
      updatedAt: 0 as never,
    });
    expect(noCharacter.ok && noCharacter.value.character).toBeNull();
    expect(noCharacter.ok && validateProgressDocument(noCharacter.value).ok).toBe(true);
  });

  it('reads no character as no character, which is what decides the first run', () => {
    expect(toSelection(null)).toBeUndefined();
  });
});
