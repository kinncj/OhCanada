import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import rigJson from '@content/characters/rig.json';
import type { RigDocument } from '@application/ports';
import {
  createCharacterCreator,
  type CharacterSelection,
  type CreatorSlot,
} from '@ui/character-creator';
import { COPY_GAPS, type UiLocale } from '@ui/copy';

import { creatorSlots, repairSelection } from '../../../app/bootstrap/character-slots';
import { buildPage, type FakeElement, type FakeText } from './support/fake-dom';

/**
 * The creator as a player meets it, for the two groups that were confusing or
 * missing: **the six skin tones** and **the `presentation` slot.**
 *
 * Built from the real rig, the real copy table and the real palette through
 * `app/bootstrap/character-slots.ts`, and rendered by the real creator — so
 * what is asserted is what is drawn, not what a fixture claims is drawn. The
 * one fixture is a rig whose `presentation` slot has options, because the art
 * for it is landing separately and a test about it cannot wait on that.
 *
 * What this file cannot see is geometry and computed colour; `tests/a11y/`
 * checks both in Chromium. What it does see: which colour each swatch is given,
 * in what order, what each option is called, what position it announces, and
 * which strings on the screen move when a choice does.
 */

const RIG = rigJson as unknown as RigDocument;

interface Palette {
  readonly colours: Readonly<Record<string, string>>;
  readonly ramps: Readonly<Record<string, { readonly base: string } | undefined>>;
}

/** Read off disk, independently of the module that reads it for the game. */
const PALETTE = JSON.parse(
  readFileSync(new URL('../../../assets/style/palette.json', import.meta.url), 'utf8'),
) as Palette;

/** `TN-SKIN`'s table, written out rather than read, so a changed row fails here. */
const TONES: Readonly<Record<UiLocale, readonly string[]>> = {
  en: ['1, light', '2, light', '3, medium', '4, medium', '5, dark', '6, dark'],
  fr: ['1, clair', '2, clair', '3, moyen', '4, moyen', '5, foncé', '6, foncé'],
};
const SKIN_LABEL: Readonly<Record<UiLocale, string>> = { en: 'Skin tone', fr: 'Teint de peau' };
const DIRECTION: Readonly<Record<UiLocale, string>> = {
  en: 'From light to dark',
  fr: 'Du clair au foncé',
};

/** The shipped rig with `presentation` given the three ids the art agent is adding. */
const OFFERED_RIG = ((): RigDocument => {
  const slots = {
    ...(RIG.slots as unknown as Record<string, unknown>),
    presentation: {
      options: ['feminine', 'masculine', 'neutral'],
      fallback: 'neutral',
      playerSelectable: true,
    },
  };
  const artboards = RIG.artboards.map((board) =>
    board.playerSelectableSlots.length === 0
      ? board
      : {
          ...board,
          playerSelectableSlots: [
            ...board.playerSelectableSlots.filter((name) => name !== 'presentation'),
            'presentation',
          ],
        },
  );
  return { ...RIG, slots, artboards } as unknown as RigDocument;
})();

/** The shipped rig with `presentation` reserved and empty, whatever the rig says today. */
const RESERVED_RIG = ((): RigDocument => {
  const slots = {
    ...(RIG.slots as unknown as Record<string, unknown>),
    presentation: { options: [], fallback: null, playerSelectable: false, status: 'reserved' },
  };
  const artboards = RIG.artboards.map((board) => ({
    ...board,
    playerSelectableSlots: board.playerSelectableSlots.filter((name) => name !== 'presentation'),
  }));
  return { ...RIG, slots, artboards } as unknown as RigDocument;
})();

/** CIE L*, from a hex colour: perceptual lightness, with sRGB linearised first. */
function lightness(hex: string): number {
  const channel = (value: number): number => {
    const unit = value / 255;
    return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  };
  const int = Number.parseInt(hex.replace('#', ''), 16);
  const y =
    0.2126 * channel((int >> 16) & 0xff) +
    0.7152 * channel((int >> 8) & 0xff) +
    0.0722 * channel(int & 0xff);
  return y <= 216 / 24389 ? y * (24389 / 27) : Math.cbrt(y) * 116 - 16;
}

/** Strictly lightest first. A helper, so the negative control can run the same check. */
function lightestToDarkest(colours: readonly string[]): boolean {
  const measured = colours.map(lightness);
  return measured.every((value, index) => index === 0 || (measured[index - 1] ?? 0) > value);
}

/** The text a screen reader takes from an element's content: `aria-hidden` subtrees are skipped. */
function spokenText(node: FakeElement): string {
  return node.childNodes
    .map((child) => {
      if (child.nodeType === 3) return (child as FakeText).data;
      const element = child as FakeElement;
      return element.getAttribute('aria-hidden') === 'true' ? '' : spokenText(element);
    })
    .join('');
}

function mount(
  slots: readonly CreatorSlot[],
  locale: UiLocale,
  initialSelection?: CharacterSelection,
): {
  readonly root: FakeElement;
  readonly announce: ReturnType<typeof vi.fn>;
  readonly byId: (id: string | null) => FakeElement | null;
} {
  const page = buildPage();
  const announce = vi.fn();
  createCharacterCreator(page.host, {
    slots,
    locale,
    random: () => 0,
    announce,
    ...(initialSelection === undefined ? {} : { initialSelection }),
  }).show();
  const root = page.doc.byTestId('character-creator');
  if (root === null) throw new Error('the creator did not mount');
  return { root, announce, byId: (id) => (id === null ? null : page.doc.getElementById(id)) };
}

const swatchOf = (option: FakeElement): FakeElement | undefined =>
  option.children.find((child) => child.className.split(' ').includes('tn-creator__swatch'));

describe('the six skin tones, as a player sees and hears them', () => {
  for (const locale of ['en', 'fr'] as const) {
    it(`draws a palette swatch for every tone, lightest to darkest (${locale})`, () => {
      const { root } = mount(creatorSlots(locale), locale);
      const options = root.byTestId('slot-skin')?.querySelectorAll('[role="radio"]') ?? [];

      /* A floor, so "every swatch is in order" cannot pass over no swatches. */
      expect(options.length).toBe(6);
      expect(options.map((option) => option.getAttribute('data-option'))).toEqual([
        'skin-1',
        'skin-2',
        'skin-3',
        'skin-4',
        'skin-5',
        'skin-6',
      ]);

      const colours = options.map((option) => {
        const id = option.getAttribute('data-option') ?? '';
        const swatch = swatchOf(option);
        expect(swatch, `${id} draws no swatch`).toBeDefined();
        expect(swatch?.getAttribute('aria-hidden')).toBe('true');
        const colour = swatch?.style.getPropertyValue('--tn-swatch') ?? '';
        /* The art's own ramp, not a colour chosen for the screen. */
        expect(colour, id).toBe(PALETTE.colours[PALETTE.ramps[id]?.base ?? ''] ?? '(no ramp)');
        return colour;
      });

      expect(lightestToDarkest(colours), colours.join(' ')).toBe(true);
      /* The negative control: the same check, on the same colours, reversed. */
      expect(lightestToDarkest([...colours].reverse())).toBe(false);
    });

    it(`names every tone by its row and states its place in the six (${locale})`, () => {
      const { root, byId } = mount(creatorSlots(locale), locale);
      const group = root.byTestId('slot-skin');
      const options = group?.querySelectorAll('[role="radio"]') ?? [];

      expect(group?.getAttribute('role')).toBe('radiogroup');
      expect(byId(group?.getAttribute('aria-labelledby') ?? null)?.textContent).toBe(
        SKIN_LABEL[locale],
      );
      /* Which way the numbers run, once, for the group: visible, and the
         group's description, so both readers get the same sentence. */
      expect(byId(group?.getAttribute('aria-describedby') ?? null)?.textContent).toBe(
        DIRECTION[locale],
      );

      expect(options.map((option) => spokenText(option))).toEqual(TONES[locale]);
      for (const [index, option] of options.entries()) {
        const name = spokenText(option);
        expect(option.getAttribute('aria-posinset')).toBe(String(index + 1));
        expect(option.getAttribute('aria-setsize')).toBe('6');
        /* `TN-SKIN-05`: never a hex, never an id, never the noun again. */
        expect(name).not.toMatch(/#[0-9a-f]{3,6}/i);
        expect(name).not.toMatch(/skin-\d/);
        expect(name).not.toContain(SKIN_LABEL[locale]);
        /* `TN-SKIN-04`: "a swatch with no name is refused". */
        expect(name.trim(), 'a swatch with no name: colour is never the only signal').not.toBe('');
      }
      /* Ruling 6: "dark", never "deep", at either end or in the group's line. */
      expect(group?.textContent.toLowerCase()).not.toMatch(/deep|profond/);
    });

    it(`announces a tone as label and value (${locale})`, () => {
      const { root, announce } = mount(creatorSlots(locale), locale);
      root.byTestId('slot-skin-skin-5')?.click();

      expect(announce).toHaveBeenCalledWith(
        locale === 'fr' ? 'Teint de peau : 5, foncé' : 'Skin tone: 5, dark',
      );
    });
  }
});

describe('the presentation slot, on the screen', () => {
  it('draws no group and no heading while the rig offers no options', () => {
    for (const locale of ['en', 'fr'] as const) {
      const { root } = mount(creatorSlots(locale, RESERVED_RIG), locale);

      expect(root.byTestId('slot-presentation')).toBeNull();
      expect(root.querySelectorAll('[role="radiogroup"]').length).toBe(5);
      expect(root.textContent).not.toContain('Style');
    }
  });

  it('draws three named radios once the rig offers them, in both languages', () => {
    const names: Readonly<Record<UiLocale, readonly string[]>> = {
      en: ['Feminine', 'Masculine', 'Neutral'],
      fr: ['Féminin', 'Masculin', 'Neutre'],
    };
    for (const locale of ['en', 'fr'] as const) {
      const { root, byId } = mount(creatorSlots(locale, OFFERED_RIG), locale);
      const group = root.byTestId('slot-presentation');
      const options = group?.querySelectorAll('[role="radio"]') ?? [];

      expect(group?.getAttribute('role')).toBe('radiogroup');
      expect(byId(group?.getAttribute('aria-labelledby') ?? null)?.textContent).toBe('Style');
      expect(options.map((option) => spokenText(option))).toEqual(names[locale]);
      expect(options.filter((option) => option.getAttribute('aria-checked') === 'true').length).toBe(
        1,
      );
      expect(options.every((option) => swatchOf(option) === undefined)).toBe(true);
    }
  });

  it('changes no French string anywhere else on the screen, whichever is chosen', () => {
    /*
     * `docs/content-review.md` §8.6: no copy about the player may require gender
     * agreement. The strongest form of that here is that choosing `feminine`
     * moves no string at all except the choice itself — so every text node on
     * the screen is collected, outside the presentation group, with the
     * preview's "Style : …" pair taken out, and compared across all three.
     */
    const slots = creatorSlots('fr', OFFERED_RIG);
    const base = repairSelection(undefined, () => 0, OFFERED_RIG).selection;

    const everythingElse = (selection: CharacterSelection): string => {
      const { root, byId } = mount(slots, 'fr', selection);
      const description = byId('tn-creator-preview-text');
      const texts: string[] = [];
      const walk = (node: FakeElement): void => {
        if (node.getAttribute('data-testid') === 'slot-presentation') return;
        for (const child of node.childNodes) {
          if (child.nodeType === 3) {
            const data = (child as FakeText).data;
            texts.push(node === description ? data.replace(/(\. )?Style : [^.]+/, '') : data);
          } else {
            walk(child as FakeElement);
          }
        }
      };
      walk(root);
      return texts.join('|');
    };

    const feminine = everythingElse({ ...base, presentation: 'feminine' });
    /* Not vacuous: the screen was read, in French. */
    expect(feminine).toContain('Créez votre personnage');
    expect(feminine).toContain('Teint de peau : ');
    expect(everythingElse({ ...base, presentation: 'masculine' })).toBe(feminine);
    expect(everythingElse({ ...base, presentation: 'neutral' })).toBe(feminine);

    /* The negative control: the same collection does see a choice change, so
       an equal result above means nothing moved rather than nothing was read. */
    expect(everythingElse({ ...base, presentation: 'feminine', hairColour: 'red' })).not.toBe(
      feminine,
    );
  });

  it('announces the choice as label and value, with the French colon', () => {
    const base = repairSelection(undefined, () => 0, OFFERED_RIG).selection;
    const { root, announce } = mount(creatorSlots('fr', OFFERED_RIG), 'fr', {
      ...base,
      presentation: 'neutral',
    });

    root.byTestId('slot-presentation-feminine')?.click();
    expect(announce).toHaveBeenCalledWith('Style : Féminin');
  });

  it('declares its rows as written by app/ui, because no story table carries them', () => {
    for (const key of [
      'creator.slot.skin.help',
      'creator.slot.presentation',
      'creator.presentation.feminine',
      'creator.presentation.masculine',
      'creator.presentation.neutral',
    ] as const) {
      expect(COPY_GAPS, key).toContain(key);
    }
  });
});
