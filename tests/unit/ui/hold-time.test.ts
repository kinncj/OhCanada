import { describe, expect, it, vi } from 'vitest';

import { createSettingsScreen } from '@ui/settings-screen';
import {
  createSettingsStore,
  DEFAULT_SETTINGS,
  HOLD_TIME_CHOICES,
  HOLD_TO_CHOOSE_DEFAULT_MS,
  HOLD_TO_CHOOSE_MAX_MS,
  HOLD_TO_CHOOSE_MIN_MS,
  nearestHoldTimeChoice,
  type Settings,
} from '@ui/settings';
import { holdThresholdFor } from '@ui/single-switch';

import { buildPage, press, pressSwitch, type FakeElement } from './support/fake-dom';

/**
 * `docs/stories/TN-SET-09` — hold time: the setting a switch user cannot change
 * any other way, and the one control that must never be locked by its own value.
 *
 * The escape clause is the point of this file. A player who chooses "Very long"
 * and then finds they cannot hold for two seconds would be shut out of the only
 * control that could rescue them. The story states the fix — "the hold-time
 * options accept a hold of the default length or of the current threshold,
 * whichever is shorter" — and it is built as arithmetic rather than promised in
 * a comment, so it holds at thresholds nobody thought to test.
 */

function open(overrides: Partial<Settings> = {}) {
  const page = buildPage();
  const clock = { now: 0 };
  const announce = vi.fn();
  const store = createSettingsStore({ ...DEFAULT_SETTINGS, ...overrides });
  const screen = createSettingsScreen(page.host, {
    store,
    announce,
    onClose: () => undefined,
    now: () => clock.now,
  });
  screen.show();
  return { page, store, screen, announce, clock, at: (id: string) => page.doc.byTestId(id) };
}

/**
 * Walk the switch ring with short presses until `target` is highlighted.
 *
 * Bounded, and it asserts rather than looping for ever: an item that is not in
 * the ring at all is the failure this helper has to be able to report, because
 * an unreachable hold-time option is the exact defect `TN-SET-09` exists to
 * prevent.
 */
function highlightWithSwitch(
  page: ReturnType<typeof buildPage>,
  clock: { now: number },
  target: FakeElement,
): void {
  for (let step = 0; step < 40; step += 1) {
    if (target.getAttribute('data-switch-highlight') === 'true') return;
    pressSwitch(page, clock, 50);
  }
  throw new Error(
    `the switch ring never reached ${target.getAttribute('data-testid') ?? 'the control'}`,
  );
}

describe('the threshold arithmetic', () => {
  it('never returns more than the item cap, at any ring threshold', () => {
    /* The property, not an example of it. */
    for (let ring = 0; ring <= 5_000; ring += 37) {
      for (const cap of [100, 300, 600, 1_200, 2_000]) {
        expect(holdThresholdFor(ring, cap)).toBeLessThanOrEqual(cap);
        expect(holdThresholdFor(ring, cap)).toBeLessThanOrEqual(ring);
      }
    }
  });

  it('leaves an item with no cap on the ring threshold', () => {
    expect(holdThresholdFor(2_000)).toBe(2_000);
    expect(holdThresholdFor(2_000, null)).toBe(2_000);
    expect(holdThresholdFor(2_000, Number.NaN)).toBe(2_000);
    expect(holdThresholdFor(2_000, 0)).toBe(2_000);
    expect(holdThresholdFor(2_000, -5)).toBe(2_000);
  });

  it('takes the shorter of the two, in both directions', () => {
    expect(holdThresholdFor(2_000, 600)).toBe(600);
    expect(holdThresholdFor(300, 600)).toBe(300);
  });
});

describe('the four named values', () => {
  it('is Short 0.3, Medium 0.6, Long 1.2, Very long 2.0, with Medium the default', () => {
    expect(HOLD_TIME_CHOICES.map((choice) => choice.ms)).toEqual([300, 600, 1_200, 2_000]);
    expect(DEFAULT_SETTINGS.holdToChooseMs).toBe(HOLD_TO_CHOOSE_DEFAULT_MS);
    expect(HOLD_TO_CHOOSE_DEFAULT_MS).toBe(600);
  });

  it('keeps every named value inside the clamp a hand-edited save still meets', () => {
    for (const choice of HOLD_TIME_CHOICES) {
      expect(choice.ms).toBeGreaterThanOrEqual(HOLD_TO_CHOOSE_MIN_MS);
      expect(choice.ms).toBeLessThanOrEqual(HOLD_TO_CHOOSE_MAX_MS);
    }
  });

  it('lights the nearest option for a value written by something else', () => {
    expect(nearestHoldTimeChoice(590).ms).toBe(600);
    expect(nearestHoldTimeChoice(3_000).ms).toBe(2_000);
    expect(nearestHoldTimeChoice(0).ms).toBe(300);
  });

  it('is drawn as a labelled radio group, four options, each saying how long it is', () => {
    const { at } = open();
    const group = at('setting-hold-time');
    expect(group?.getAttribute('role')).toBe('radiogroup');
    expect(group?.querySelectorAll('[role="radio"]')).toHaveLength(4);

    expect(at('setting-hold-time-short')?.textContent).toBe('Short0.3 seconds');
    expect(at('setting-hold-time-medium')?.textContent).toBe('Medium0.6 seconds');
    expect(at('setting-hold-time-long')?.textContent).toBe('Long1.2 seconds');
    expect(at('setting-hold-time-very-long')?.textContent).toBe('Very long2 seconds');
  });

  it('is present whether one-button mode is on or off', () => {
    /* TN-SET-01 and OQ-SET-5: a control that appears and disappears is harder to
       find than one that is always there. */
    expect(open({ singleSwitch: false }).at('setting-hold-time')).not.toBeNull();
    expect(open({ singleSwitch: true }).at('setting-hold-time')).not.toBeNull();
  });

  it('changes what a long press means, at once', () => {
    const { at, store } = open();
    at('setting-hold-time-long')?.click();

    expect(store.current.holdToChooseMs).toBe(1_200);
    expect(at('setting-hold-time-long')?.getAttribute('aria-checked')).toBe('true');
    expect(at('setting-hold-time-medium')?.getAttribute('aria-checked')).toBe('false');
  });

  it('moves with the arrow keys and announces the change', () => {
    const { at, store, announce } = open();
    at('setting-hold-time-medium')?.focus();
    press(at('setting-hold-time') as FakeElement, 'ArrowRight');

    expect(store.current.holdToChooseMs).toBe(1_200);
    expect(announce).toHaveBeenCalledWith('Hold time: Long 1.2 seconds');
  });

  it('reads in French, with a comma and the singular French takes below two', () => {
    const { at, store } = open({ locale: 'fr' });
    expect(at('setting-hold-time')?.textContent).toContain('Durée du maintien');
    expect(at('setting-hold-time-short')?.textContent).toBe('Courte0,3 seconde');
    expect(at('setting-hold-time-very-long')?.textContent).toBe('Très longue2 secondes');
    expect(store.current.locale).toBe('fr');
  });
});

describe('the control that sets the threshold can never be locked by it', () => {
  it('accepts a hold of the default length when the threshold is Very long', () => {
    /*
     * The scenario, exactly: single-switch on, "Very long" chosen, the highlight
     * on "Short", a hold of 0.6 seconds — and "Short" is chosen.
     */
    const { page, at, store, clock } = open({ singleSwitch: true, holdToChooseMs: 2_000 });

    const short = at('setting-hold-time-short') as FakeElement;

    /* Walk the ring to "Short" with short presses, then hold for the default. */
    highlightWithSwitch(page, clock, short);
    pressSwitch(page, clock, HOLD_TO_CHOOSE_DEFAULT_MS);
    expect(store.current.holdToChooseMs).toBe(300);
  });

  it('does not lower the threshold for anything else on the screen', () => {
    /*
     * The escape is narrow on purpose. If every control accepted a short hold,
     * "Very long" would mean nothing and the setting would be a lie.
     */
    const { page, at, store, clock } = open({ singleSwitch: true, holdToChooseMs: 2_000 });

    const contrast = at('setting-high-contrast') as FakeElement;
    highlightWithSwitch(page, clock, contrast);

    pressSwitch(page, clock, HOLD_TO_CHOOSE_DEFAULT_MS);
    expect(store.current.highContrast).toBe(false);

    /* The 0.6 s press was read as a short press, so it advanced the highlight —
       which is the behaviour under test. Walk back and hold for the threshold
       the player actually chose. */
    highlightWithSwitch(page, clock, contrast);
    pressSwitch(page, clock, 2_000);
    expect(store.current.highContrast).toBe(true);
  });

  it('declares the cap in the DOM, so the ring needs no knowledge of this screen', () => {
    const { at } = open();
    for (const choice of HOLD_TIME_CHOICES) {
      expect(at(choice.testId)?.getAttribute('data-switch-max-hold-ms')).toBe(
        String(HOLD_TO_CHOOSE_DEFAULT_MS),
      );
    }
  });

  it('still lets a short press be a short press at Very long', () => {
    const { page, at, store, clock } = open({ singleSwitch: true, holdToChooseMs: 2_000 });
    pressSwitch(page, clock, 50);
    pressSwitch(page, clock, 50);
    expect(store.current.holdToChooseMs).toBe(2_000);
    expect(at('setting-hold-time-very-long')?.getAttribute('aria-checked')).toBe('true');
  });
});
