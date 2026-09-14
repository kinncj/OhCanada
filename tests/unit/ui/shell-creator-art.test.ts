import { describe, expect, it, vi } from 'vitest';

import type { LevelId } from '@domain/ids';

import type { CreatorArtFactory, CreatorArtRequest, CreatorSlot } from '@ui/character-creator';
import type { UiLocale } from '@ui/copy';
import type { MapEntry } from '@ui/level-select';
import { createSettingsStore, DEFAULT_SETTINGS } from '@ui/settings';
import { createShell } from '@ui/shell';

import { buildPage, type FakePage } from './support/fake-dom';

/**
 * The shell carries the creator's picture to both of the creator's errands, and
 * keeps its motion honest (ADR-0040, `TN-CREATOR-07`).
 *
 * Two things here were wrong or missing before the picture existed and matter
 * now that it moves:
 *
 *  - the shell told the creator its motion from the **setting** alone, so a
 *    phone that asks for less motion got `data-animated="true"`. It now resolves
 *    the setting and the device's preference together, as `applySettings` does;
 *  - reduced motion turned on from Settings, over the creator, reached nothing
 *    until the screen was rebuilt. It now stills the picture at once.
 */

const SLOT: CreatorSlot = {
  id: 'coat',
  testId: 'slot-coat',
  label: 'Coat',
  options: [
    { id: 'parka', name: 'Parka' },
    { id: 'anorak', name: 'Anorak' },
  ],
};

const SLOTS: Readonly<Record<UiLocale, readonly CreatorSlot[]>> = {
  en: [SLOT],
  fr: [{ ...SLOT, label: 'Manteau' }],
};

const ENTRIES: readonly MapEntry[] = [
  { number: 4, id: 'ottawa' as LevelId, built: true, unlocked: true },
];

function recorder() {
  const requests: CreatorArtRequest[] = [];
  const motions: ('reduced' | 'full')[] = [];
  const released = { count: 0 };
  const factory: CreatorArtFactory = (_host, request) => {
    requests.push(request);
    return {
      draw: () => undefined,
      setMotion: (motion) => {
        motions.push(motion);
      },
      destroy: () => {
        released.count += 1;
      },
    };
  };
  return { factory, requests, motions, released };
}

function mount(
  creator: { readonly required: boolean; readonly art?: CreatorArtFactory },
  prepare: (page: FakePage) => void = () => undefined,
) {
  const page = buildPage();
  prepare(page);
  const store = createSettingsStore(DEFAULT_SETTINGS);
  const shell = createShell(page.host, {
    store,
    entries: ENTRIES,
    stampsToUnlock: 1,
    onPlayLevel: vi.fn(),
    onCreateCharacter: vi.fn(),
    onChangeCharacter: vi.fn(),
    creator: {
      slots: SLOTS,
      required: creator.required,
      initialSelection: { coat: 'parka' },
      ...(creator.art === undefined ? {} : { art: creator.art }),
    },
  });
  shell.start();
  return { page, store, shell, at: (testId: string) => page.doc.byTestId(testId) };
}

describe("the shell and the creator's picture", () => {
  it('hands the first-run creator the picture, and lets it go when the player moves on', () => {
    const art = recorder();
    const { at } = mount({ required: true, art: art.factory });

    at('title-play')?.click();
    expect(art.requests).toHaveLength(1);
    expect(art.requests[0]?.motion).toBe('full');
    expect(at('character-preview-art')).not.toBeNull();

    at('start-playing')?.click();
    expect(art.released.count).toBe(1);
    expect(at('character-preview-art')).toBeNull();
  });

  it('hands the creator re-opened from Settings the same picture, and releases it on Done', () => {
    const art = recorder();
    const { at } = mount({ required: false, art: art.factory });

    at('title-settings')?.click();
    at('setting-character')?.click();
    expect(art.requests).toHaveLength(1);
    expect(at('character-preview-art')).not.toBeNull();

    at('creator-done')?.click();
    expect(art.released.count).toBe(1);
  });

  it('stills the picture as soon as reduced motion is turned on over the creator', () => {
    const art = recorder();
    const { at, store } = mount({ required: true, art: art.factory });
    at('title-play')?.click();

    store.set('reducedMotion', true);
    expect(art.motions).toEqual(['reduced']);
    expect(at('character-preview')?.getAttribute('data-animated')).toBe('false');
  });

  it('opens the picture still on a device that asks for less motion, whatever the setting says', () => {
    const art = recorder();
    const { at } = mount({ required: true, art: art.factory }, (page) => {
      (page.doc as unknown as { defaultView: unknown }).defaultView = {
        matchMedia: (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }),
      };
    });

    at('title-play')?.click();
    expect(art.requests[0]?.motion).toBe('reduced');
    expect(at('character-preview')?.getAttribute('data-animated')).toBe('false');
  });

  it('draws the words alone when the composition root gives no picture', () => {
    const { at } = mount({ required: true });
    at('title-play')?.click();

    expect(at('character-creator')).not.toBeNull();
    expect(at('character-preview-art')).toBeNull();
  });
});
