import { describe, expect, it, vi } from 'vitest';

import { focusAndReveal, motionIsReduced, revealInView, scrollBehaviourFor } from '@ui/focus-scroll';
import { createFocusTrap } from '@ui/focus-trap';
import { createSwitchRing } from '@ui/single-switch';

import { buildPage, press, pressSwitch, type FakeElement, type FakePage } from './support/fake-dom';

/**
 * Where focus goes, the page goes.
 *
 * **The defect.** Every modal screen's Tab is `app/ui/focus-trap.ts`, and it
 * moved focus with `focus({ preventScroll: true })` and nothing else. On a long
 * screen — the character creator at 390 × 844, where every stop after the first
 * sits 1 106 to 2 530 px down an 844 px viewport — a keyboard player tabbed to a
 * control that was never brought on screen. The arrow keys inside a radio group
 * did scroll, because the screens that own a group call `focus()` plainly, so
 * one player on one screen had two behaviours.
 *
 * What is asserted here is the pairing and the rule: focus moves without the
 * browser's centring jump, and then the element is scrolled **as little as
 * possible** (`block: 'nearest'`), instantly for a player who asked for less
 * movement. The same pairing carries the switch highlight, which a switch user
 * has no other way to bring into view.
 *
 * Geometry — that the control really is inside the viewport afterwards — is
 * `tests/a11y/tab-scrolls-into-view.spec.ts`, in a real Chromium. This file
 * proves what is called, with what, and that a document with no layout is left
 * alone rather than made to throw.
 */

interface Screen {
  readonly page: FakePage;
  readonly card: FakeElement;
  readonly buttons: readonly FakeElement[];
  /** Each button's `scrollIntoView`, as a spy. */
  readonly scrolls: readonly ReturnType<typeof vi.fn>[];
}

/** A card of buttons, each able to say whether it was scrolled into view. */
function screenOf(count: number): Screen {
  const page = buildPage();
  const card = page.doc.createElement('div');
  page.ui.append(card);

  const buttons: FakeElement[] = [];
  const scrolls: ReturnType<typeof vi.fn>[] = [];
  for (let index = 0; index < count; index += 1) {
    const button = page.doc.createElement('button');
    button.setAttribute('data-testid', `control-${String(index)}`);
    card.append(button);
    buttons.push(button);
    scrolls.push(watchScroll(button));
  }
  return { page, card, buttons, scrolls };
}

/** Give a double the one method a browser has and it does not. */
function watchScroll(element: FakeElement): ReturnType<typeof vi.fn> {
  const spy = vi.fn();
  (element as unknown as { scrollIntoView: unknown }).scrollIntoView = spy;
  return spy;
}

const asHtml = (element: FakeElement): HTMLElement => element as unknown as HTMLElement;

const MINIMAL_SCROLL = { block: 'nearest', inline: 'nearest', behavior: 'smooth' };

describe('Tab inside a trap', () => {
  it('scrolls the control it lands on into view, moving as little as possible', () => {
    const { page, card, buttons, scrolls } = screenOf(3);
    const trap = createFocusTrap(asHtml(card));
    trap.activate();
    buttons[0]?.focus();

    press(buttons[0] as FakeElement, 'Tab');

    expect(page.doc.activeElement).toBe(buttons[1]);
    expect(scrolls[1]).toHaveBeenCalledWith(MINIMAL_SCROLL);
  });

  it('scrolls on the wrap-around too, which is the stop furthest from the eye', () => {
    const { page, card, buttons, scrolls } = screenOf(3);
    createFocusTrap(asHtml(card)).activate();
    buttons[2]?.focus();

    press(buttons[2] as FakeElement, 'Tab');

    expect(page.doc.activeElement).toBe(buttons[0]);
    expect(scrolls[0]).toHaveBeenCalledWith(MINIMAL_SCROLL);
  });

  it('scrolls where Shift+Tab lands, by the same rule', () => {
    const { card, buttons, scrolls } = screenOf(3);
    createFocusTrap(asHtml(card)).activate();
    buttons[1]?.focus();

    press(buttons[1] as FakeElement, 'Tab', { shiftKey: true });

    expect(scrolls[0]).toHaveBeenCalledWith(MINIMAL_SCROLL);
  });

  it('is instant for a player who asked for less movement, and still moves', () => {
    const { page, card, buttons, scrolls } = screenOf(2);
    page.doc.documentElement.setAttribute('data-tn-motion', 'reduced');
    createFocusTrap(asHtml(card)).activate();
    buttons[0]?.focus();

    press(buttons[0] as FakeElement, 'Tab');

    /* Reduced motion removes the animation, never the information (CLAUDE.md). */
    expect(scrolls[1]).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'auto',
    });
  });

  it('does not throw where there is nothing to scroll', () => {
    const { card, buttons } = screenOf(2);
    /* A document double, an element detached between focus and scroll, an engine
       without the method: none of them is a reason to lose the Tab. */
    delete (buttons[1] as unknown as { scrollIntoView?: unknown }).scrollIntoView;
    createFocusTrap(asHtml(card)).activate();
    buttons[0]?.focus();

    expect(() => press(buttons[0] as FakeElement, 'Tab')).not.toThrow();
  });
});

describe('closing a screen', () => {
  it('brings the control that opened it back into view, not only back into focus', () => {
    const page = buildPage();
    const opener = page.doc.createElement('button');
    page.ui.append(opener);
    const scrolled = watchScroll(opener);
    const card = page.doc.createElement('div');
    page.ui.append(card);
    opener.focus();

    const trap = createFocusTrap(asHtml(card));
    trap.activate();
    trap.release();

    expect(page.doc.activeElement).toBe(opener);
    expect(scrolled).toHaveBeenCalledWith(MINIMAL_SCROLL);
  });
});

describe('the single-switch highlight', () => {
  it('is scrolled into view as it moves, because a switch user cannot scroll', () => {
    const { page, card, scrolls } = screenOf(3);
    const clock = { now: 0 };
    const ring = createSwitchRing(asHtml(card), { holdMs: () => 600, now: () => clock.now });
    ring.enable();

    /* A short press advances the highlight; 100 ms is well under the threshold. */
    pressSwitch(page, clock, 100);

    expect(ring.index).toBe(0);
    expect(scrolls[0]).toHaveBeenCalledWith(MINIMAL_SCROLL);

    pressSwitch(page, clock, 100);
    expect(scrolls[1]).toHaveBeenCalledWith(MINIMAL_SCROLL);
  });
});

describe('the motion axis these screens read', () => {
  it('is reduced when the setting says so', () => {
    const page = buildPage();
    expect(motionIsReduced(page.document)).toBe(false);
    page.doc.documentElement.setAttribute('data-tn-motion', 'reduced');
    expect(motionIsReduced(page.document)).toBe(true);
    expect(scrollBehaviourFor(page.document)).toBe('auto');
  });

  it('is reduced when the device says so, whatever the setting says', () => {
    const page = buildPage();
    const doc = page.doc as unknown as { defaultView: unknown };
    doc.defaultView = { matchMedia: () => ({ matches: true }) };

    expect(motionIsReduced(page.document)).toBe(true);
  });

  it('reads as full motion where nothing can be asked', () => {
    expect(motionIsReduced(null)).toBe(false);
    expect(motionIsReduced(undefined)).toBe(false);
    const page = buildPage();
    (page.doc as unknown as { defaultView: unknown }).defaultView = {
      matchMedia: () => {
        throw new Error('this engine has no media queries');
      },
    };
    expect(motionIsReduced(page.document)).toBe(false);
  });
});

describe('the helpers themselves', () => {
  it('leave an absent element alone rather than throwing', () => {
    expect(() => {
      focusAndReveal(null);
      focusAndReveal(undefined);
      revealInView(null);
    }).not.toThrow();
  });

  it('focus without the browser’s own scroll, so the page moves once and by one rule', () => {
    const page = buildPage();
    const button = page.doc.createElement('button');
    page.ui.append(button);
    const scrolled = watchScroll(button);
    const options: unknown[] = [];
    (button as unknown as { focus: (init?: unknown) => void }).focus = (init) => {
      options.push(init);
      page.doc.activeElement = button;
    };

    focusAndReveal(asHtml(button));

    expect(options).toEqual([{ preventScroll: true }]);
    expect(scrolled).toHaveBeenCalledWith(MINIMAL_SCROLL);
  });
});
