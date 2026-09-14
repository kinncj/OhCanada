import { describe, expect, it, vi } from 'vitest';

import {
  createCharacterCreator,
  type CharacterSelection,
  type CreatorArt,
  type CreatorArtFactory,
  type CreatorArtRequest,
  type CreatorSlot,
} from '@ui/character-creator';

import { buildPage, FakeEvent, press, type FakeElement } from './support/fake-dom';

/**
 * The creator's picture, from the screen's side of the seam (ADR-0040).
 *
 * The screen owns a host element and knows nothing about what draws in it. What
 * it promises, and what these tests hold it to:
 *
 *  - **the words stay the preview.** The picture is `aria-hidden`, inside the
 *    named group, and adds no control, so a screen reader, a keyboard and a
 *    switch meet the screen they met before it existed;
 *  - **every change reaches the picture**, by tap, by arrow key and by Surprise
 *    me, and reduced motion reaches it too;
 *  - **a picture that fails is not an empty box** (`TN-CREATOR-03`), and a
 *    renderer that throws never stops a radio from choosing, announcing or
 *    taking focus;
 *  - **it is released** when the screen closes.
 */

const SLOTS: readonly CreatorSlot[] = [
  {
    id: 'skin',
    testId: 'slot-skin',
    label: 'Skin tone',
    options: [
      { id: 'skin-1', name: '1, light', swatch: '#efbe99' },
      { id: 'skin-6', name: '6, dark', swatch: '#4a2c1d' },
    ],
  },
  {
    id: 'hairShape',
    testId: 'slot-hair-shape',
    label: 'Hair',
    options: [
      { id: 'crop', name: 'Short' },
      { id: 'coil', name: 'Tight curls' },
    ],
  },
];

const FR_SLOTS: readonly CreatorSlot[] = [
  { ...SLOTS[0]!, label: 'Teint de peau' },
  {
    ...SLOTS[1]!,
    label: 'Cheveux',
    options: [
      { id: 'crop', name: 'Courts' },
      { id: 'coil', name: 'Boucles serrées' },
    ],
  },
];

const OPENING: CharacterSelection = { skin: 'skin-1', hairShape: 'crop' };

interface PainterState {
  calls: number;
  readonly draws: CharacterSelection[];
  readonly motions: ('reduced' | 'full')[];
  destroyed: number;
  host: FakeElement | null;
  request: CreatorArtRequest | null;
}

function painter(overrides: Partial<CreatorArt> = {}): {
  readonly state: PainterState;
  readonly factory: CreatorArtFactory;
} {
  const state: PainterState = {
    calls: 0,
    draws: [],
    motions: [],
    destroyed: 0,
    host: null,
    request: null,
  };
  const factory: CreatorArtFactory = (host, request) => {
    state.calls += 1;
    state.host = host as unknown as FakeElement;
    state.request = request;
    return {
      draw: (selection) => {
        state.draws.push(selection);
      },
      setMotion: (motion) => {
        state.motions.push(motion);
      },
      destroy: () => {
        state.destroyed += 1;
      },
      ...overrides,
    };
  };
  return { state, factory };
}

function open(overrides: Partial<Parameters<typeof createCharacterCreator>[1]> = {}) {
  const page = buildPage();
  const announce = vi.fn();
  const creator = createCharacterCreator(page.host, {
    slots: SLOTS,
    locale: 'en',
    initialSelection: OPENING,
    announce,
    onStart: vi.fn(),
    ...overrides,
  });
  creator.show();
  const root = page.doc.byTestId('character-creator');
  if (root === null) throw new Error('the creator did not mount');
  const preview = root.byTestId('character-preview');
  if (preview === null) throw new Error('the creator drew no preview');
  return {
    page,
    creator,
    root,
    preview,
    announce,
    art: (): FakeElement | null => root.byTestId('character-preview-art'),
    byId: (id: string | null): FakeElement | null => page.doc.getElementById(id ?? ''),
  };
}

const lastDraw = (state: PainterState): CharacterSelection | undefined => state.draws.at(-1);

describe("the creator's picture (ADR-0040)", () => {
  it('draws no picture and no empty box when nothing is given to draw with', () => {
    const { preview, art } = open();

    expect(art()).toBeNull();
    expect(preview.getAttribute('data-art')).toBeNull();
    expect(preview.children.map((child) => child.tagName)).toEqual(['H2', 'P']);
  });

  it('hands the renderer an aria-hidden host inside the named preview, with what is on screen', () => {
    const { state, factory } = painter();
    const { creator, preview, art, byId } = open({ art: factory, motion: 'reduced' });
    const host = art();

    expect(state.calls).toBe(1);
    expect(host).not.toBeNull();
    expect(state.host).toBe(host);
    expect(host?.parentElement).toBe(preview);
    expect(host?.getAttribute('aria-hidden')).toBe('true');
    expect(host?.getAttribute('data-state')).toBe('loading');
    expect(preview.getAttribute('data-art')).toBe('loading');
    expect(state.request?.selection).toEqual(creator.selection);
    expect(state.request?.motion).toBe('reduced');

    /* The words are still the preview: a named group, described by a sentence
       that is text inside it. */
    expect(preview.getAttribute('role')).toBe('group');
    expect(byId(preview.getAttribute('aria-labelledby'))?.parentElement).toBe(preview);
    const description = byId(preview.getAttribute('aria-describedby'));
    expect(description?.parentElement).toBe(preview);
    expect(description?.textContent).toBe('Skin tone: 1, light. Hair: Short');
    /* The screen puts nothing in the host itself; what draws there is the renderer's. */
    expect(host?.children.length).toBe(0);
  });

  it('gives the picture every change the words get: a tap, an arrow key and Surprise me', () => {
    const { state, factory } = painter();
    const { creator, root } = open({ art: factory });

    root.byTestId('slot-hair-shape-coil')?.click();
    expect(lastDraw(state)).toEqual({ skin: 'skin-1', hairShape: 'coil' });

    const skin = root.byTestId('slot-skin');
    if (skin === null) throw new Error('no skin group');
    press(skin, 'ArrowRight');
    expect(lastDraw(state)).toEqual({ skin: 'skin-6', hairShape: 'coil' });

    root.byTestId('randomise-character')?.click();
    expect(lastDraw(state)).toEqual(creator.selection);

    /* One picture for the life of the screen: changes dress it, never rebuild it. */
    expect(state.calls).toBe(1);
  });

  it('publishes what the picture reports, on its host and on the panel', () => {
    const { state, factory } = painter();
    const { preview, art } = open({ art: factory });

    state.request?.onStatus({
      state: 'ready',
      frames: ['character-head-skin-1', 'character-hair-crop-brown'],
    });

    expect(art()?.getAttribute('data-state')).toBe('ready');
    expect(art()?.getAttribute('data-frames')).toBe('character-head-skin-1 character-hair-crop-brown');
    expect(preview.getAttribute('data-art')).toBe('ready');
    expect(art()?.hidden).toBe(false);
  });

  it('steps a picture that failed aside, and leaves the words and the way on (TN-CREATOR-03)', () => {
    const { state, factory } = painter();
    const { root, preview, art, byId } = open({ art: factory });

    state.request?.onStatus({ state: 'failed', frames: [] });

    expect(art()?.hidden).toBe(true);
    expect(art()?.getAttribute('data-frames')).toBe('');
    expect(preview.getAttribute('data-art')).toBe('failed');
    expect(root.byTestId('start-playing')?.disabled).toBe(false);

    root.byTestId('slot-hair-shape-coil')?.click();
    expect(byId(preview.getAttribute('aria-describedby'))?.textContent).toContain('Hair: Tight curls');
  });

  it('keeps choosing, announcing and moving focus when the renderer throws', () => {
    const { state, factory } = painter({
      draw: () => {
        throw new Error('the renderer broke');
      },
    });
    const { creator, root, page, preview, art, announce } = open({ art: factory });
    const coil = root.byTestId('slot-hair-shape-coil');

    expect(() => coil?.click()).not.toThrow();
    expect(creator.selection['hairShape']).toBe('coil');
    expect(announce).toHaveBeenCalledWith('Hair: Tight curls');
    expect(page.doc.activeElement).toBe(coil);
    expect(art()?.hidden).toBe(true);
    expect(preview.getAttribute('data-art')).toBe('failed');
    expect(state.destroyed).toBe(1);

    /* A dropped picture is not asked again. */
    expect(() => root.byTestId('slot-hair-shape-crop')?.click()).not.toThrow();
    expect(creator.selection['hairShape']).toBe('crop');
  });

  it('opens with the words alone when the renderer cannot even be built', () => {
    const { root, preview, art } = open({
      art: () => {
        throw new Error('no canvas');
      },
    });

    expect(art()?.hidden).toBe(true);
    expect(preview.getAttribute('data-art')).toBe('failed');
    expect(root.byTestId('start-playing')).not.toBeNull();
  });

  it('stills the picture when motion is reduced, and lets it move again when it is not', () => {
    const { state, factory } = painter();
    const { creator, preview } = open({ art: factory, motion: 'full' });
    expect(state.request?.motion).toBe('full');

    creator.setMotion('reduced');
    expect(state.motions).toEqual(['reduced']);
    expect(preview.getAttribute('data-animated')).toBe('false');

    creator.setMotion('full');
    expect(state.motions).toEqual(['reduced', 'full']);
  });

  it('adds nothing a keyboard or a switch can land on', () => {
    const controls = (root: FakeElement): readonly (string | null)[] =>
      root
        .querySelectorAll('button, [role="radio"], [tabindex]')
        .map((node) => node.getAttribute('data-testid'));

    const plain = open();
    const drawn = open({ art: painter().factory });
    expect(controls(drawn.root)).toEqual(controls(plain.root));
    expect(drawn.art()?.querySelectorAll('button, [tabindex], [role]').length).toBe(0);

    /* The same number of short presses reaches the way on, with or without it. */
    const pressesToStart = (withArt: boolean): number => {
      const clock = { now: 0 };
      const page = buildPage();
      createCharacterCreator(page.host, {
        slots: SLOTS,
        locale: 'en',
        initialSelection: OPENING,
        singleSwitch: true,
        holdMs: 600,
        now: () => clock.now,
        ...(withArt ? { art: painter().factory } : {}),
      }).show();
      let presses = 0;
      while (page.doc.activeElement?.getAttribute('data-testid') !== 'start-playing' && presses < 60) {
        page.doc.dispatchEvent(new FakeEvent('pointerdown'));
        clock.now += 40;
        page.doc.dispatchEvent(new FakeEvent('pointerup'));
        presses += 1;
      }
      return presses;
    };
    const without = pressesToStart(false);
    expect(without).toBeLessThan(60);
    expect(pressesToStart(true)).toBe(without);
  });

  it('lets the picture go when the screen closes, and ignores anything it says afterwards', () => {
    const { state, factory } = painter();
    const { creator } = open({ art: factory });
    const host = state.host;

    creator.destroy();
    expect(state.destroyed).toBe(1);

    expect(() => state.request?.onStatus({ state: 'ready', frames: ['late'] })).not.toThrow();
    expect(host?.getAttribute('data-state')).toBe('loading');
  });

  it('keeps the same picture, dressed the same, across a change of language', () => {
    const { state, factory } = painter();
    const { creator, root, art } = open({ art: factory });
    root.byTestId('slot-hair-shape-coil')?.click();
    const host = art();

    creator.setLocale('fr', FR_SLOTS);

    expect(state.calls).toBe(1);
    expect(art()).toBe(host);
    expect(lastDraw(state)).toEqual({ skin: 'skin-1', hairShape: 'coil' });
    expect(root.textContent).toContain('Boucles serrées');
  });
});
