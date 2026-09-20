import { describe, expect, it, vi } from 'vitest';

import {
  createCharacterCreator,
  optionsOf,
  randomSelection,
  type CreatorSlot,
} from '@ui/character-creator';
import { CHOSEN_GLYPH, UNCHOSEN_GLYPH } from '@ui/dom';
import { HIGHLIGHT_ATTRIBUTE } from '@ui/single-switch';

import { buildPage, FakeEvent, press, type FakeElement, type FakePage } from './support/fake-dom';

/**
 * `docs/stories/TN-CREATOR-character-creator.md`, and `docs/content-review.md`
 * §8, which constrains what may be on this screen. Two of §8's rules are the
 * reason several of these tests exist at all:
 *
 *  - §8.2 slot independence is "the mechanically checkable half of no
 *    caricature". It is checked here by picking every option in one slot in turn
 *    and asserting nothing about any other slot moved.
 *  - §8.3 the randomiser draws uniformly. A weighted default player is a
 *    statement made in code where nobody reads it, so it is read here: 1 000
 *    seeded draws, every option seen, none above twice its expected share.
 */

/** Unnamed ramps, as §8.1 requires until `OQ-REVIEW-6` settles the naming. */
const SLOTS: readonly CreatorSlot[] = [
  {
    id: 'skin',
    testId: 'slot-skin',
    label: 'Skin tone',
    options: [1, 2, 3, 4, 5, 6].map((n) => ({ id: `skin-${String(n)}`, name: `Skin tone ${String(n)}` })),
  },
  {
    id: 'hair',
    testId: 'slot-hair',
    label: 'Hair',
    options: [
      { id: 'coily', name: 'Coily' },
      { id: 'curly', name: 'Curly' },
      { id: 'straight', name: 'Straight' },
      { id: 'braids', name: 'Braids' },
    ],
  },
  {
    id: 'coat',
    testId: 'slot-coat',
    label: 'Coat',
    options: [
      { id: 'parka', name: 'Parka' },
      { id: 'anorak', name: 'Anorak' },
      { id: 'peacoat', name: 'Pea coat' },
    ],
  },
];

const FR_SLOTS: readonly CreatorSlot[] = [
  { ...SLOTS[0]!, label: 'Teint de peau' },
  {
    ...SLOTS[1]!,
    label: 'Cheveux',
    options: [
      { id: 'coily', name: 'Crépus' },
      { id: 'curly', name: 'Bouclés' },
      { id: 'straight', name: 'Raides' },
      { id: 'braids', name: 'Tresses' },
    ],
  },
  { ...SLOTS[2]!, label: 'Manteau' },
];

/** A tiny reproducible stream, so a "surprise" is replayable in a failure. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

interface Fixture {
  readonly page: FakePage;
  readonly creator: ReturnType<typeof createCharacterCreator>;
  readonly root: FakeElement;
  readonly announce: ReturnType<typeof vi.fn>;
  readonly onStart: ReturnType<typeof vi.fn>;
  option(slotTestId: string, optionId: string): FakeElement;
  group(slotTestId: string): FakeElement;
}

function open(
  overrides: Partial<Parameters<typeof createCharacterCreator>[1]> = {},
): Fixture {
  const page = buildPage();
  const announce = vi.fn();
  const onStart = vi.fn();
  const creator = createCharacterCreator(page.host, {
    slots: SLOTS,
    locale: 'en',
    random: seeded(7),
    announce,
    onStart,
    ...overrides,
  });
  creator.show();

  const root = page.doc.byTestId('character-creator');
  if (root === null) throw new Error('the creator did not mount');

  return {
    page,
    creator,
    root,
    announce,
    onStart,
    group(slotTestId): FakeElement {
      const found = root.byTestId(slotTestId);
      if (found === null) throw new Error(`no group ${slotTestId}`);
      return found;
    },
    option(slotTestId, optionId): FakeElement {
      const found = root.byTestId(`${slotTestId}-${optionId}`);
      if (found === null) throw new Error(`no option ${slotTestId}-${optionId}`);
      return found;
    },
  };
}

describe('the character creator', () => {
  it('is the first screen, named, with all three groups and a way to start', () => {
    const { root } = open();
    expect(root.textContent).toContain('Make your character');
    expect(root.byTestId('character-preview')).not.toBeNull();
    expect(root.byTestId('slot-skin')).not.toBeNull();
    expect(root.byTestId('slot-hair')).not.toBeNull();
    expect(root.byTestId('slot-coat')).not.toBeNull();
    expect(root.byTestId('start-playing')).not.toBeNull();
    expect(root.byTestId('randomise-character')).not.toBeNull();
  });

  it('has exactly one option chosen in every group when it opens', () => {
    const { root } = open();
    for (const slot of SLOTS) {
      const chosen = root
        .byTestId(slot.testId)
        ?.querySelectorAll('[aria-checked="true"]');
      expect(chosen?.length, slot.id).toBe(1);
    }
  });

  it('randomises on open rather than pre-selecting a default', () => {
    /*
     * docs/content-review.md §8.1: "No tone is pre-selected. The creator
     * randomises on open." `CharacterSlot.default` serves NPC documents and save
     * recovery (`OQ-REVIEW-7`), and `CreatorSlot` carries no such field, so a
     * caller cannot pass one in by accident.
     */
    const first = open({ random: seeded(1) }).creator.selection;
    const second = open({ random: seeded(2) }).creator.selection;
    expect(first).not.toEqual(second);

    /* And a save can still put a character back exactly as it was. */
    const restored = open({ initialSelection: { skin: 'skin-6', hair: 'braids', coat: 'anorak' } });
    expect(restored.creator.selection).toEqual({
      skin: 'skin-6',
      hair: 'braids',
      coat: 'anorak',
    });
  });

  it('offers every option of every slot whatever is chosen elsewhere', () => {
    /*
     * docs/content-review.md §8.2, the anti-caricature check: "Every option in
     * every slot is available with every option in every other slot." Pick each
     * skin tone in turn; every other slot's option count must be unchanged.
     */
    const { root, option } = open();
    const count = (testId: string): number =>
      root.byTestId(testId)?.querySelectorAll('[data-option-id]').length ?? -1;

    const before = { hair: count('slot-hair'), coat: count('slot-coat') };
    expect(before.hair).toBe(4);
    expect(before.coat).toBe(3);

    for (const skin of SLOTS[0]!.options) {
      option('slot-skin', skin.id).click();
      expect(count('slot-hair'), `hair after ${skin.id}`).toBe(before.hair);
      expect(count('slot-coat'), `coat after ${skin.id}`).toBe(before.coat);
    }
  });

  it('cannot express a coupling between slots, because the API takes no selection', () => {
    /* The structural half of §8.2: `optionsOf` takes a slot and nothing else, so
       "which hair goes with which skin" has nowhere to be written. */
    expect(optionsOf.length).toBe(1);
    expect(optionsOf(SLOTS[1]!)).toEqual(SLOTS[1]!.options);
  });

  it('changes only the group that was tapped', () => {
    const { creator, option } = open();
    const before = creator.selection;
    option('slot-hair', 'braids').click();

    expect(creator.selection['hair']).toBe('braids');
    expect(creator.selection['skin']).toBe(before['skin']);
    expect(creator.selection['coat']).toBe(before['coat']);
  });

  it('marks the chosen option with a filled circle and a name, never with a colour alone', () => {
    const { option, root } = open();
    const braids = option('slot-hair', 'braids');
    braids.click();

    expect(braids.getAttribute('aria-checked')).toBe('true');
    expect(braids.getAttribute('data-chosen')).toBe('true');
    expect(braids.getAttribute('role')).toBe('radio');
    expect(braids.textContent).toContain('Braids');
    /* The mark is hidden from assistive tech: the word beside it is what should
       be read, and the shape is what a colour-blind player sees. */
    const glyph = braids.querySelector('[aria-hidden="true"]');
    expect(glyph?.textContent).toBe(CHOSEN_GLYPH);

    /* And every option that is not chosen draws the other shape. A tick drawn on
       all of them — the old screen — left the fill as the only difference. */
    const others = (root.byTestId('slot-hair')?.querySelectorAll('[role="radio"]') ?? []).filter(
      (other) => other !== braids,
    );
    expect(others.length).toBe(3);
    for (const other of others) {
      expect(other.querySelector('[data-tn-chosen]')?.textContent).toBe(UNCHOSEN_GLYPH);
      expect(other.getAttribute('data-chosen')).toBe('false');
    }
  });

  it('carries the hooks the story names, and its place in the group', () => {
    /* `docs/stories/README.md`: "Every option inside a group reports data-slot,
       data-option and data-chosen". `aria-posinset` and `aria-setsize` make the
       position part of what is spoken (`TN-SKIN-05`). */
    const { root } = open({ initialSelection: { skin: 'skin-1', hair: 'curly', coat: 'parka' } });
    const options = root.byTestId('slot-hair')?.querySelectorAll('[role="radio"]') ?? [];

    expect(options.map((option) => option.getAttribute('data-option'))).toEqual([
      'coily',
      'curly',
      'straight',
      'braids',
    ]);
    for (const [index, option] of options.entries()) {
      expect(option.getAttribute('data-slot')).toBe('hair');
      expect(option.getAttribute('aria-posinset')).toBe(String(index + 1));
      expect(option.getAttribute('aria-setsize')).toBe('4');
      expect(option.getAttribute('data-chosen')).toBe(String(index === 1));
    }
  });

  it('draws a swatch only where the caller gives one, hidden, beside a name that is still text', () => {
    const { root, page } = open({
      slots: [
        {
          id: 'skin',
          testId: 'slot-skin',
          label: 'Skin tone',
          help: 'From light to dark',
          options: [
            { id: 'skin-1', name: '1, light', swatch: '#efbe99' },
            { id: 'skin-2', name: '2, light', swatch: '#dfa477' },
          ],
        },
        SLOTS[1]!,
      ],
    });
    const skin = root.byTestId('slot-skin');
    const first = root.byTestId('slot-skin-skin-1');
    const swatch = first?.children.find((child) => child.className === 'tn-creator__swatch');

    expect(swatch?.getAttribute('aria-hidden')).toBe('true');
    expect(swatch?.style.getPropertyValue('--tn-swatch')).toBe('#efbe99');
    expect(first?.textContent).toContain('1, light');
    /* The reading line is visible and is the group's description. */
    const help = page.doc.getElementById(skin?.getAttribute('aria-describedby') ?? '');
    expect(help?.textContent).toBe('From light to dark');
    expect(help?.parentElement).toBe(skin);

    /* A group whose options carry no colour draws none, and no reading line. */
    const hair = root.byTestId('slot-hair');
    expect(hair?.getAttribute('aria-describedby')).toBe(null);
    for (const option of hair?.querySelectorAll('[role="radio"]') ?? []) {
      expect(option.children.some((child) => child.className === 'tn-creator__swatch')).toBe(false);
    }
  });

  it('makes one control the primary action, and Back and Settings quiet', () => {
    const { root } = open({ onBack: vi.fn(), onOpenSettings: vi.fn() });

    expect(root.byTestId('start-playing')?.getAttribute('data-tn-action')).toBe('primary');
    expect(root.byTestId('creator-back')?.getAttribute('data-tn-action')).toBe('quiet');
    expect(root.byTestId('creator-settings')?.getAttribute('data-tn-action')).toBe('quiet');
    expect(root.querySelectorAll('[data-tn-action="primary"]').length).toBe(1);
  });

  it('announces the choice in words', () => {
    const { option, announce } = open();
    option('slot-hair', 'curly').click();
    expect(announce).toHaveBeenCalledWith('Hair: Curly');
  });

  it('describes the preview in text, and updates it', () => {
    const { root, option, page } = open();
    const preview = root.byTestId('character-preview');
    const describedBy = preview?.getAttribute('aria-describedby') ?? '';
    const description = page.doc.getElementById(describedBy);

    /* `TN-CREATOR-06`: the preview is *named* "Your character" and *described*
       by the label-and-value pairs. Both are visible text inside it: nothing
       draws art into this screen, and a `role="img"` box with nothing in it was
       `TN-CREATOR-03`'s "empty box with no explanation". */
    expect(preview?.getAttribute('role')).toBe('group');
    const heading = page.doc.getElementById(preview?.getAttribute('aria-labelledby') ?? '');
    expect(heading?.tagName).toBe('H2');
    expect(heading?.textContent).toBe('Your character');
    expect(heading?.parentElement).toBe(preview);
    expect(description?.parentElement).toBe(preview);
    expect(description?.textContent).toContain('Skin tone');

    option('slot-hair', 'curly').click();
    expect(description?.textContent).toContain('Hair: Curly');
    expect(preview?.getAttribute('data-hair')).toBe('curly');
  });

  it('keeps the option names as text when the art never loads', () => {
    /* TN-CREATOR-03: "each option is still shown with its name as text … the
       screen does not show an empty box with no explanation". The names are text
       nodes, so there is no art path in which they disappear. */
    const { root } = open();
    expect(root.byTestId('slot-skin')?.textContent).toContain('Skin tone 1');
    expect(root.byTestId('start-playing')?.disabled).toBe(false);
  });

  it('picks a whole character at once, and says what it picked', () => {
    const { root, creator, announce } = open();
    const before = { ...creator.selection };
    root.byTestId('randomise-character')?.click();

    expect(Object.keys(creator.selection).sort()).toEqual(['coat', 'hair', 'skin']);
    expect(creator.selection).not.toEqual(before);
    expect(announce).toHaveBeenCalled();
  });

  it('hands the whole character over when play starts', () => {
    const { root, creator, onStart } = open();
    root.byTestId('start-playing')?.click();
    expect(onStart).toHaveBeenCalledWith(creator.selection);
  });

  it('offers a way into Settings, because the creator is the first screen', () => {
    /* OQ-SET-1: a player who needs one-button mode or 200 % text needs it here,
       or TN-CREATOR-05 and TN-CREATOR-08 describe a state they cannot reach. */
    const onOpenSettings = vi.fn();
    const { root } = open({ onOpenSettings });
    const control = root.byTestId('creator-settings');
    expect(control?.textContent).toBe('Settings');
    control?.click();
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('draws no Settings control when there is nowhere for it to go', () => {
    /* The creator re-opened from Settings passes no handler. It used to draw a
       "Settings" button anyway, which did nothing when pressed. */
    const { root } = open({ primary: 'done' });
    expect(root.byTestId('creator-settings')).toBe(null);
    expect(root.byTestId('creator-done')).not.toBe(null);
  });

  describe('the keyboard', () => {
    it('moves within a group with the arrow keys, choosing as it goes', () => {
      const { group, creator, page } = open({
        initialSelection: { skin: 'skin-1', hair: 'coily', coat: 'parka' },
      });

      press(group('slot-hair'), 'ArrowRight');
      expect(creator.selection['hair']).toBe('curly');
      expect(page.doc.activeElement?.getAttribute('data-option-id')).toBe('curly');

      press(group('slot-hair'), 'ArrowLeft');
      expect(creator.selection['hair']).toBe('coily');
      press(group('slot-hair'), 'ArrowLeft');
      expect(creator.selection['hair']).toBe('braids');
    });

    it('moves from the option that has focus, not from the one that is chosen', () => {
      /*
       * The ARIA radio group pattern. Roving tabindex puts the Tab stop on the
       * chosen option, so the two are usually the same node — they come apart
       * where a switch highlight, a pointer that has not let go, or Shift+Tab
       * back into a group leaves focus on an unchosen option, and there
       * ArrowRight used to move to the option after whichever was *checked*.
       */
      const { option, creator, page } = open({
        initialSelection: { skin: 'skin-1', hair: 'curly', coat: 'parka' },
      });

      /* Focus the last option; the chosen one is the second. */
      const braids = option('slot-hair', 'braids');
      braids.focus();
      press(braids, 'ArrowRight');
      /* Wraps from the focused end to the first option, not to "straight". */
      expect(creator.selection['hair']).toBe('coily');
      expect(page.doc.activeElement?.getAttribute('data-option-id')).toBe('coily');

      const straight = option('slot-hair', 'straight');
      straight.focus();
      press(straight, 'ArrowLeft');
      expect(creator.selection['hair']).toBe('curly');
      expect(page.doc.activeElement?.getAttribute('data-option-id')).toBe('curly');
    });

    it('takes focus onto the chosen option when an arrow lands on it', () => {
      /* Choosing is a no-op here — the option is already chosen — and focus
         must still move, or the arrow does nothing a player can see. */
      const { option, creator, page } = open({
        initialSelection: { skin: 'skin-1', hair: 'curly', coat: 'parka' },
      });
      const coily = option('slot-hair', 'coily');
      coily.focus();

      press(coily, 'ArrowRight');
      expect(creator.selection['hair']).toBe('curly');
      expect(page.doc.activeElement?.getAttribute('data-option-id')).toBe('curly');
    });

    it('leaves one Tab stop per group, so Tab moves between groups', () => {
      const { group } = open({ initialSelection: { skin: 'skin-1', hair: 'coily', coat: 'parka' } });
      const stops = group('slot-hair')
        .querySelectorAll('[data-option-id]')
        .filter((option) => option.tabIndex === 0);
      expect(stops.length).toBe(1);
      expect(stops[0]?.getAttribute('data-option-id')).toBe('coily');
    });

    it('keeps a group with nothing chosen reachable, on its first option', () => {
      /* A save that predates a slot has no key for it until it is repaired. */
      const { group } = open({ initialSelection: { skin: 'skin-1', coat: 'parka' } });
      const stops = group('slot-hair')
        .querySelectorAll('[data-option-id]')
        .filter((option) => option.tabIndex === 0);
      expect(stops.map((option) => option.getAttribute('data-option-id'))).toEqual(['coily']);
      expect(
        group('slot-hair').querySelectorAll('[aria-checked="true"]'),
        'the fallback stop is a stop, not a choice',
      ).toHaveLength(0);
    });

    it('stops Tab once per group, on the chosen option, both ways round and wrapping', () => {
      const { root, page } = open({
        initialSelection: { skin: 'skin-4', hair: 'straight', coat: 'anorak' },
      });
      const walk = (shiftKey: boolean): string[] => {
        const seen: string[] = [];
        for (let index = 0; index < 6; index += 1) {
          press(root, 'Tab', { shiftKey });
          seen.push(page.doc.activeElement?.getAttribute('data-testid') ?? 'none');
        }
        return seen;
      };

      expect(walk(false)).toEqual([
        'slot-skin-skin-4',
        'slot-hair-straight',
        'slot-coat-anorak',
        'randomise-character',
        'start-playing',
        'slot-skin-skin-4',
      ]);
      expect(walk(true)).toEqual([
        'start-playing',
        'randomise-character',
        'slot-coat-anorak',
        'slot-hair-straight',
        'slot-skin-skin-4',
        'start-playing',
      ]);
    });

    it('moves Tab out of a group from an option that is focused but not chosen', () => {
      /* Where a switch highlight, or a pointer that has not let go yet, leaves focus. */
      const { option, page, root } = open({
        initialSelection: { skin: 'skin-1', hair: 'coily', coat: 'parka' },
      });
      option('slot-hair', 'braids').focus();

      press(root, 'Tab');
      expect(page.doc.activeElement?.getAttribute('data-testid')).toBe('slot-coat-parka');

      option('slot-hair', 'braids').focus();
      press(root, 'Tab', { shiftKey: true });
      expect(page.doc.activeElement?.getAttribute('data-testid')).toBe('slot-skin-skin-1');
    });

    it('wraps the arrow keys at both ends of a group, and never changes another group', () => {
      const { group, creator, page } = open({
        initialSelection: { skin: 'skin-6', hair: 'coily', coat: 'parka' },
      });

      press(group('slot-skin'), 'ArrowRight');
      expect(creator.selection['skin']).toBe('skin-1');
      press(group('slot-skin'), 'ArrowUp');
      expect(creator.selection['skin']).toBe('skin-6');
      press(group('slot-skin'), 'ArrowDown');
      expect(creator.selection).toEqual({ skin: 'skin-1', hair: 'coily', coat: 'parka' });
      expect(page.doc.activeElement?.getAttribute('data-testid')).toBe('slot-skin-skin-1');
    });

    it('ignores keys that are not arrows', () => {
      const { group, creator } = open();
      const before = { ...creator.selection };
      const event = new FakeEvent('keydown', { key: 'a' });
      group('slot-hair').dispatchEvent(event);
      expect(creator.selection).toEqual(before);
    });
  });

  describe('one switch', () => {
    it('reaches and takes an option with short and long presses alone', () => {
      const clock = { now: 0 };
      const page = buildPage();
      const creator = createCharacterCreator(page.host, {
        slots: SLOTS,
        locale: 'en',
        random: seeded(3),
        singleSwitch: true,
        holdMs: 600,
        now: () => clock.now,
      });
      creator.show();

      const root = page.doc.byTestId('character-creator');
      /* Nothing has moved on its own, and nothing will. */
      expect(root?.querySelectorAll(`[${HIGHLIGHT_ATTRIBUTE}="true"]`).length).toBe(1);

      let guard = 0;
      while (
        page.doc.activeElement?.getAttribute('data-testid') !== 'start-playing' &&
        guard < 60
      ) {
        page.doc.dispatchEvent(new FakeEvent('pointerdown'));
        clock.now += 40;
        page.doc.dispatchEvent(new FakeEvent('pointerup'));
        guard += 1;
      }
      expect(guard, 'start-playing was never reachable with short presses').toBeLessThan(60);
    });

    it('can be switched on after the screen is already open', () => {
      const { creator, page } = open();
      creator.setSingleSwitch(true, 600);
      expect(page.doc.listenerCount('pointerup')).toBe(1);
      creator.setSingleSwitch(false);
      expect(page.doc.listenerCount('pointerup')).toBe(0);
    });
  });

  describe('reduced motion', () => {
    it('does not animate the preview', () => {
      const { root } = open({ motion: 'reduced' });
      expect(root.byTestId('character-preview')?.getAttribute('data-animated')).toBe('false');
    });

    it('animates it otherwise, and can be told to stop later', () => {
      const { root, creator } = open({ motion: 'full' });
      expect(root.byTestId('character-preview')?.getAttribute('data-animated')).toBe('true');
      creator.setMotion('reduced');
      expect(root.byTestId('character-preview')?.getAttribute('data-animated')).toBe('false');
    });

    it('loses no information when the motion goes', () => {
      const { root, option } = open({ motion: 'reduced' });
      option('slot-coat', 'anorak').click();
      const chosen = root.byTestId('slot-coat-anorak');
      expect(chosen?.textContent).toContain('Anorak');
      expect(chosen?.querySelector('[aria-hidden="true"]')?.textContent).toBe(CHOSEN_GLYPH);
    });
  });

  describe('French', () => {
    it('draws every string in French without losing the character', () => {
      const { creator, root, option } = open();
      option('slot-hair', 'curly').click();
      const before = { ...creator.selection };

      creator.setLocale('fr', FR_SLOTS);

      expect(root.getAttribute('lang')).toBe('fr');
      expect(root.textContent).toContain('Créez votre personnage');
      expect(root.textContent).toContain('Teint de peau');
      expect(root.textContent).toContain('Cheveux');
      expect(root.textContent).toContain('Manteau');
      expect(root.textContent).toContain('Au hasard');
      expect(root.textContent).toContain('Commencer à jouer');
      expect(creator.selection).toEqual(before);
      expect(root.byTestId('slot-hair-curly')?.getAttribute('aria-checked')).toBe('true');
    });

    it('announces a choice with French spacing around the colon', () => {
      const { creator, announce, root } = open();
      creator.setLocale('fr', FR_SLOTS);
      root.byTestId('slot-hair-curly')?.click();
      expect(announce).toHaveBeenCalledWith('Cheveux : Bouclés');
    });
  });

  describe('when the character cannot be saved', () => {
    it('says so in words, offers both ways out and announces it', () => {
      const onRetry = vi.fn();
      const onContinue = vi.fn();
      const { creator, root, announce } = open();

      creator.showSaveFailure({ onRetry, onContinue });

      const notice = root.byTestId('creator-save-error');
      expect(notice?.hidden).toBe(false);
      expect(notice?.textContent).toContain(
        'We could not save your character. You can keep playing, but your choices may be lost.',
      );
      expect(root.byTestId('creator-retry')?.textContent).toBe('Try again');
      expect(root.byTestId('creator-continue')?.textContent).toBe('Keep playing');
      expect(announce).toHaveBeenCalledWith(
        'We could not save your character. You can keep playing, but your choices may be lost.',
      );

      root.byTestId('creator-retry')?.click();
      expect(onRetry).toHaveBeenCalledTimes(1);
      root.byTestId('creator-continue')?.click();
      expect(onContinue).toHaveBeenCalledTimes(1);
    });

    it('puts focus on the way out, not behind the message', () => {
      const { creator, page, root } = open();
      creator.showSaveFailure({});
      expect(page.doc.activeElement).toBe(root.byTestId('creator-retry'));
    });

    it('clears the message when the save succeeds', () => {
      const { creator, root } = open();
      creator.showSaveFailure({});
      creator.hideSaveFailure();
      expect(root.byTestId('creator-save-error')?.hidden).toBe(true);
      expect(root.byTestId('creator-retry')).toBeNull();
    });

    it('says it in French', () => {
      const { creator, root } = open();
      creator.setLocale('fr', FR_SLOTS);
      creator.showSaveFailure({});
      expect(root.byTestId('creator-save-error')?.textContent).toContain(
        "Nous n'avons pas pu enregistrer votre personnage. Vous pouvez continuer à jouer, mais vos choix pourraient être perdus.",
      );
      expect(root.byTestId('creator-retry')?.textContent).toBe('Réessayer');
      expect(root.byTestId('creator-continue')?.textContent).toBe('Continuer quand même');
    });
  });

  describe('the two errands, and the two names of one control', () => {
    it('is on the first run by default: "Start playing", and no "Done"', () => {
      const { root } = open();

      expect(root.byTestId('start-playing')?.textContent).toBe('Start playing');
      expect(root.byTestId('creator-done')).toBe(null);
    });

    it('reads "Done" when Settings opened it, and offers no "Start playing"', () => {
      /* `TN-FIRSTRUN-04`: the primary control is named for where it goes, and
         exactly one of the two is present in any state of this screen — so a
         player is never asked to guess which button keeps their changes. */
      const onStart = vi.fn();
      const { root } = open({ primary: 'done', onStart });

      expect(root.byTestId('creator-done')?.textContent).toBe('Done');
      expect(root.byTestId('start-playing')).toBe(null);

      root.byTestId('creator-done')?.click();
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('reads "Terminé" in French, and keeps reading it after a language change', () => {
      const { creator, root } = open({ primary: 'done', locale: 'fr', slots: FR_SLOTS });
      expect(root.byTestId('creator-done')?.textContent).toBe('Terminé');

      creator.setLocale('en', SLOTS);
      expect(root.byTestId('creator-done')?.textContent).toBe('Done');
      expect(root.byTestId('start-playing')).toBe(null);
    });
  });

  describe('the way out', () => {
    it('offers Back, which goes one step up the route and saves nothing', () => {
      const onBack = vi.fn();
      const { root, onStart } = open({ onBack });

      expect(root.byTestId('creator-back')?.textContent).toBe('Back');
      root.byTestId('creator-back')?.click();

      expect(onBack).toHaveBeenCalledTimes(1);
      expect(onStart).not.toHaveBeenCalled();
    });

    it('routes Escape to Back, so Escape never means quit', () => {
      const onBack = vi.fn();
      const { root } = open({ onBack });

      root.dispatchEvent(new FakeEvent('keydown', { key: 'Escape' }));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('offers no skip, and no control that leaves without a character', () => {
      /* `TN-FIRSTRUN-02`: "the only ways out are start-playing, creator-back and
         creator-settings". A skip would have to land somewhere, and the only
         appearance available without a draw is the rig's fallback. */
      const { root } = open({ onBack: vi.fn() });
      /* Controls, not prose: `creator.intro` says "You can change this later in
         Settings", which is the promise `TN-FIRSTRUN` ruling 3 makes true
         rather than a way past this screen. */
      const controls = root.querySelectorAll('button').map((node) => node.textContent.toLowerCase());

      for (const refused of ['skip', 'later', 'no thanks', 'maybe later']) {
        expect(
          controls.some((label) => label.includes(refused)),
          `a control reads "${refused}"`,
        ).toBe(false);
      }
      expect(controls.filter((label) => label !== '').length).toBeGreaterThan(3);
      expect(root.byTestId('start-playing')?.disabled).toBe(false);
    });

    it('draws no Back at all when the caller has nowhere to send the player', () => {
      const { root } = open();
      expect(root.byTestId('creator-back')).toBe(null);
    });
  });

  describe('an option in my save that is not in this build', () => {
    it('says so, once, without covering anything or asking to be dismissed', () => {
      const { root, announce } = open({ optionRepaired: true });
      const notice = root.byTestId('creator-option-gone');

      expect(notice?.hidden).toBe(false);
      expect(notice?.textContent).toBe(
        'One of your choices is not in this version. We picked a new one. You can change it here.',
      );
      expect(announce).toHaveBeenCalledWith(
        'One of your choices is not in this version. We picked a new one. You can change it here.',
      );
      expect(announce).toHaveBeenCalledTimes(1);
      /* It does not have to be dismissed to reach the way on. */
      expect(root.byTestId('start-playing')?.disabled).toBe(false);
    });

    it('says nothing when nothing was repaired', () => {
      const { root, announce } = open();

      expect(root.byTestId('creator-option-gone')?.hidden).toBe(true);
      expect(announce).not.toHaveBeenCalled();
    });

    it('says it in French', () => {
      const { root } = open({ locale: 'fr', slots: FR_SLOTS, optionRepaired: true });
      expect(root.byTestId('creator-option-gone')?.textContent).toBe(
        'Un de vos choix ne se trouve pas dans cette version. Nous en avons choisi un autre. Vous pouvez le modifier ici.',
      );
    });
  });

  it('publishes the preview hooks in the kebab case the story names', () => {
    /* `data-${slot.id}` published `data-hairshape`, because an HTML attribute
       name is lower-cased by the parser: a hook every reader would have had to
       misspell in the same way to find. */
    const { creator, root } = open({
      slots: [
        {
          id: 'hairShape',
          testId: 'slot-hair-shape',
          label: 'Hair',
          options: [
            { id: 'crop', name: 'Short' },
            { id: 'coil', name: 'Tight curls' },
          ],
        },
      ],
    });
    const preview = root.byTestId('character-preview');

    expect(preview?.getAttribute('data-hair-shape')).toBe(creator.selection['hairShape']);
    expect(preview?.getAttribute('data-hairshape')).toBe(null);
  });

  it('closes and cleans up', () => {
    const { creator, page } = open();
    creator.hide();
    expect(creator.visible).toBe(false);
    creator.destroy();
    expect(page.doc.byTestId('character-creator')).toBeNull();
  });
});

describe('randomSelection', () => {
  it('draws uniformly over every option in every slot', () => {
    /*
     * docs/content-review.md §8.3, checkable as that document specifies: 1 000
     * seeded draws, every option appears, no option exceeds twice the expected
     * share. A randomiser weighted toward one tone is a statement about who the
     * default player is, made in code where nobody reads it.
     */
    const random = seeded(2026);
    const counts = new Map<string, number>();
    const draws = 1_000;

    for (let index = 0; index < draws; index += 1) {
      const selection = randomSelection(SLOTS, random);
      for (const [slotId, optionId] of Object.entries(selection)) {
        const key = `${slotId}:${optionId}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    for (const slot of SLOTS) {
      const expected = draws / slot.options.length;
      for (const option of slot.options) {
        const seen = counts.get(`${slot.id}:${option.id}`) ?? 0;
        expect(seen, `${slot.id}/${option.id} never came up`).toBeGreaterThan(0);
        expect(seen, `${slot.id}/${option.id} came up ${String(seen)} times`).toBeLessThan(
          expected * 2,
        );
      }
    }
  });

  it('stays inside the option list even for a source that returns 1', () => {
    const selection = randomSelection(SLOTS, () => 1);
    expect(selection['hair']).toBe('braids');
  });

  it('skips a slot with no options rather than throwing', () => {
    const empty: CreatorSlot = { id: 'hat', testId: 'slot-hat', label: 'Hat', options: [] };
    expect(randomSelection([empty], () => 0)).toEqual({});
  });
});
