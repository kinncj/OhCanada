import { describe, expect, it, vi } from 'vitest';

import {
  applySettings,
  clampHoldToChooseMs,
  clampTextScale,
  createSettingsStore,
  DEFAULT_SETTINGS,
  normaliseSettings,
  prefersReducedMotion,
  resolveMotion,
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  type Settings,
} from '@ui/settings';

import { buildPage } from './support/fake-dom';

/**
 * The settings model, which every other story's precondition goes through
 * ("Given single-switch mode is on", "Given text scaling is 200 %").
 */

describe('the settings defaults', () => {
  it('has subtitles on and everything else off', () => {
    /* CLAUDE.md: "Subtitles on by default". The rest are opt-in, because an
       accessibility feature turned on for somebody who did not ask is a change
       to their game, not a service. */
    expect(DEFAULT_SETTINGS.subtitles).toBe(true);
    expect(DEFAULT_SETTINGS.autoMove).toBe(false);
    expect(DEFAULT_SETTINGS.singleSwitch).toBe(false);
    expect(DEFAULT_SETTINGS.reducedMotion).toBe(false);
    expect(DEFAULT_SETTINGS.highContrast).toBe(false);
    expect(DEFAULT_SETTINGS.dyslexiaFont).toBe(false);
    expect(DEFAULT_SETTINGS.textScale).toBe(100);
    /* OQ-SET-4's recommended hold-to-choose threshold. */
    expect(DEFAULT_SETTINGS.holdToChooseMs).toBe(600);
  });
});

describe('clampTextScale', () => {
  it('refuses an out-of-range saved value rather than applying it', () => {
    /* TN-SET-03: "a saved document declares a text scale of 500 % … clamped to
       200 %, and the game does not fail to start". */
    expect(clampTextScale(500)).toBe(TEXT_SCALE_MAX);
    expect(clampTextScale(-100)).toBe(TEXT_SCALE_MIN);
    expect(clampTextScale(0)).toBe(TEXT_SCALE_MIN);
  });

  it('falls back to the default for anything that is not a number', () => {
    expect(clampTextScale('200')).toBe(TEXT_SCALE_MIN);
    expect(clampTextScale(Number.NaN)).toBe(TEXT_SCALE_MIN);
    expect(clampTextScale(Number.POSITIVE_INFINITY)).toBe(TEXT_SCALE_MIN);
    expect(clampTextScale(undefined)).toBe(TEXT_SCALE_MIN);
  });

  it('snaps to the step, so the slider and the saved value cannot disagree', () => {
    expect(clampTextScale(137)).toBe(125);
    expect(clampTextScale(188)).toBe(200);
    expect(clampTextScale(150)).toBe(150);
  });
});

describe('clampHoldToChooseMs', () => {
  it('keeps the switch threshold usable at both ends', () => {
    expect(clampHoldToChooseMs(50)).toBe(200);
    expect(clampHoldToChooseMs(99_999)).toBe(3_000);
    expect(clampHoldToChooseMs(800)).toBe(800);
    expect(clampHoldToChooseMs('slow')).toBe(600);
  });
});

describe('normaliseSettings', () => {
  it('reads a complete document', () => {
    const settings = normaliseSettings({
      locale: 'fr',
      autoMove: true,
      singleSwitch: true,
      reducedMotion: true,
      highContrast: true,
      dyslexiaFont: true,
      textScale: 200,
      subtitles: false,
      holdToChooseMs: 900,
    });
    expect(settings.locale).toBe('fr');
    expect(settings.textScale).toBe(200);
    expect(settings.subtitles).toBe(false);
    expect(settings.holdToChooseMs).toBe(900);
  });

  it('survives a document from nowhere', () => {
    expect(normaliseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normaliseSettings('nonsense')).toEqual(DEFAULT_SETTINGS);
    expect(normaliseSettings({ locale: 'de', subtitles: 'yes' })).toEqual(DEFAULT_SETTINGS);
  });

  it('drops what it does not know instead of carrying it', () => {
    const settings = normaliseSettings({ cheatMode: true, textScale: 150 });
    expect('cheatMode' in settings).toBe(false);
    expect(settings.textScale).toBe(150);
  });

  it('keeps a field the document does not mention', () => {
    const base: Settings = { ...DEFAULT_SETTINGS, highContrast: true, locale: 'fr' };
    expect(normaliseSettings({ autoMove: true }, base).highContrast).toBe(true);
    expect(normaliseSettings({ autoMove: true }, base).locale).toBe('fr');
  });
});

describe('resolveMotion', () => {
  it('gives stillness when either the setting or the browser asks for it', () => {
    const off: Settings = { ...DEFAULT_SETTINGS, reducedMotion: false };
    const on: Settings = { ...DEFAULT_SETTINGS, reducedMotion: true };

    expect(resolveMotion(off, false)).toBe('full');
    expect(resolveMotion(off, true)).toBe('reduced');
    /* TN-CREATOR-07: "the in-game setting has the same effect as the browser
       setting" — including when the browser reports no preference at all. */
    expect(resolveMotion(on, false)).toBe('reduced');
    expect(resolveMotion(on, true)).toBe('reduced');
  });

  it('cannot be talked out of stillness by anything else, because there is nothing else', () => {
    /*
     * The engine keeps `motion` structurally separate from the visual tier so a
     * fast machine cannot silently upgrade someone who asked for stillness. The
     * same guarantee here is the arity of this function: two inputs, both of
     * them a request for stillness. A third — a tier, a frame time, a device
     * class — is the mistake, and this assertion fails the moment one is added.
     */
    expect(resolveMotion.length).toBe(2);
  });
});

describe('prefersReducedMotion', () => {
  it('asks the media query, and copes with a view that has none', () => {
    const asking = { matchMedia: (query: string) => ({ matches: query.includes('reduce') }) };
    expect(prefersReducedMotion(asking)).toBe(true);
    expect(prefersReducedMotion({})).toBe(false);
  });
});

describe('applySettings', () => {
  it('writes the whole state onto the document, so one change restyles every screen', () => {
    const page = buildPage();
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      locale: 'fr',
      highContrast: true,
      dyslexiaFont: true,
      singleSwitch: true,
      subtitles: false,
      autoMove: true,
      textScale: 200,
    };

    const applied = applySettings(page.document, settings, false);

    const root = page.doc.documentElement;
    expect(root.getAttribute('lang')).toBe('fr');
    expect(root.getAttribute('data-tn-contrast')).toBe('high');
    expect(root.getAttribute('data-tn-font')).toBe('dyslexia');
    expect(root.getAttribute('data-tn-switch')).toBe('on');
    expect(root.getAttribute('data-tn-subtitles')).toBe('off');
    expect(root.getAttribute('data-tn-auto-move')).toBe('on');
    expect(root.getAttribute('data-tn-text-scale')).toBe('200');
    expect(applied.textScale).toBe(200);
  });

  it('scales text as a root font-size, which is what carries the 44 px target with it', () => {
    /* The touch targets are `min-block-size: 2.75rem`, so a root percentage
       grows the control as well as the words in it. A pixel literal would
       shrink the target relative to its text exactly when the player asked for
       bigger text. */
    const page = buildPage();
    applySettings(page.document, { ...DEFAULT_SETTINGS, textScale: 200 }, false);
    expect(page.doc.documentElement.style.getPropertyValue('font-size')).toBe('200%');
    expect(page.doc.documentElement.style.getPropertyValue('--tn-text-scale')).toBe('2');
  });

  it('writes reduced motion from the browser preference alone', () => {
    const page = buildPage();
    const applied = applySettings(page.document, DEFAULT_SETTINGS, true);
    expect(applied.motion).toBe('reduced');
    expect(page.doc.documentElement.getAttribute('data-tn-motion')).toBe('reduced');
  });
});

describe('the settings store', () => {
  it('notifies once per real change, naming what changed', () => {
    const store = createSettingsStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.set('highContrast', true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[1]).toBe('highContrast');
    expect(store.current.highContrast).toBe(true);
  });

  it('says nothing when a set changes nothing', () => {
    const store = createSettingsStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.set('subtitles', true);
    expect(listener).not.toHaveBeenCalled();
  });

  it('refuses a value the model would not accept, and does not pretend it took it', () => {
    const store = createSettingsStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.set('textScale', 500);
    expect(store.current.textScale).toBe(200);

    /* A second attempt at the same out-of-range value is now a no-op, because
       the clamped value is already in place. */
    store.set('textScale', 500);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('toggles a switch', () => {
    const store = createSettingsStore();
    expect(store.toggle('singleSwitch').singleSwitch).toBe(true);
    expect(store.toggle('singleSwitch').singleSwitch).toBe(false);
  });

  it('lets a listener leave', () => {
    const store = createSettingsStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.set('autoMove', true);
    expect(listener).not.toHaveBeenCalled();
  });

  it('normalises whatever it was started with', () => {
    const store = createSettingsStore({ ...DEFAULT_SETTINGS, textScale: 999 });
    expect(store.current.textScale).toBe(200);
  });

  it('survives a listener that unsubscribes while being notified', () => {
    const store = createSettingsStore();
    const seen: string[] = [];
    const stop = store.subscribe(() => {
      seen.push('first');
      stop();
    });
    store.subscribe(() => seen.push('second'));

    store.set('autoMove', true);
    expect(seen).toEqual(['first', 'second']);
  });
});
