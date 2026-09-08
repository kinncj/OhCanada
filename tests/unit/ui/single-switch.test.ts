import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import {
  classifyPress,
  createSwitchRing,
  HIGHLIGHT_ATTRIBUTE,
  nextHighlightIndex,
  SWITCH_LABEL_ATTRIBUTE,
} from '@ui/single-switch';

import { buildPage, FakeEvent, type FakeElement, type FakePage } from './support/fake-dom';

/**
 * Single-switch mode. The contract is `docs/stories/README.md`: a short press
 * anywhere moves the highlight and wraps, a long press chooses, nothing scans on
 * its own and nothing expires.
 *
 * The scenario that matters most is the one that asserts *absence*
 * (`TN-CREATOR-05`, `TN-CARD-07`, `TN-STUDY-07`): "I do nothing for two minutes
 * … the highlight has not moved". An auto-scanner would fail it, and an
 * auto-scanner is what almost every single-switch implementation is.
 */

/** The module with its comments stripped: the prose says the word, the code must not. */
const SOURCE = readFileSync(new URL('../../../app/ui/single-switch.ts', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

describe('classifyPress', () => {
  it('is a short press below the threshold and a choice at or above it', () => {
    expect(classifyPress(0, 600)).toBe('advance');
    expect(classifyPress(599, 600)).toBe('advance');
    expect(classifyPress(600, 600)).toBe('choose');
    expect(classifyPress(5_000, 600)).toBe('choose');
  });

  it('treats a nonsense duration as the harmless answer', () => {
    /* Advancing the highlight is undoable in one press; choosing is not. */
    expect(classifyPress(Number.NaN, 600)).toBe('advance');
    expect(classifyPress(-1, 600)).toBe('advance');
  });
});

describe('nextHighlightIndex', () => {
  it('moves forward and wraps at the end', () => {
    expect(nextHighlightIndex(3, 0)).toBe(1);
    expect(nextHighlightIndex(3, 2)).toBe(0);
  });

  it('enters at the first item from nowhere', () => {
    expect(nextHighlightIndex(3, -1)).toBe(0);
    expect(nextHighlightIndex(3, 99)).toBe(0);
  });

  it('has nothing to highlight in an empty ring', () => {
    expect(nextHighlightIndex(0, -1)).toBe(-1);
    expect(nextHighlightIndex(Number.NaN, 0)).toBe(-1);
  });
});

describe('the switch ring', () => {
  it('does not scan on its own — there is no timer in the module at all', () => {
    /*
     * The rejected design is an auto-scanner: a cursor that steps by itself
     * while the player waits for the right moment to press. That is a countdown,
     * CLAUDE.md allows no timer outside Exam mode, and three stories assert that
     * two minutes of inaction changes nothing. Proving that by waiting is a slow
     * test that passes for the wrong reason; proving it by the absence of any
     * scheduling primitive is exact.
     */
    expect(SOURCE).not.toMatch(/setTimeout|setInterval|requestAnimationFrame|requestIdleCallback/);
  });

  it('advances on a short press anywhere, not only on a control', () => {
    const { ring, buttons, page, clock } = ringFixture();
    ring.enable();

    tap(page, clock, 100);
    expect(buttons[0]?.getAttribute(HIGHLIGHT_ATTRIBUTE)).toBe('true');
    expect(page.doc.activeElement).toBe(buttons[0]);

    tap(page, clock, 100);
    expect(buttons[1]?.getAttribute(HIGHLIGHT_ATTRIBUTE)).toBe('true');
    expect(buttons[0]?.getAttribute(HIGHLIGHT_ATTRIBUTE)).toBeNull();
  });

  it('wraps back to the first item', () => {
    const { ring, buttons, page, clock } = ringFixture();
    ring.enable();
    for (let index = 0; index < 4; index += 1) tap(page, clock, 50);
    expect(buttons[0]?.getAttribute(HIGHLIGHT_ATTRIBUTE)).toBe('true');
    expect(ring.index).toBe(0);
  });

  it('announces the highlighted item by name', () => {
    const announce = vi.fn();
    const { ring, page, clock } = ringFixture({ announce });
    ring.enable();

    tap(page, clock, 50);
    expect(announce).toHaveBeenCalledWith('Yes');
    tap(page, clock, 50);
    expect(announce).toHaveBeenCalledWith('No');
  });

  it('prefers an explicit switch label over the visible text', () => {
    const announce = vi.fn();
    const { ring, buttons, page, clock } = ringFixture({ announce });
    buttons[0]?.setAttribute(SWITCH_LABEL_ATTRIBUTE, 'Yes, let us go');
    ring.enable();
    tap(page, clock, 50);
    expect(announce).toHaveBeenCalledWith('Yes, let us go');
  });

  it('reads an aria-label when the control has no text of its own', () => {
    const announce = vi.fn();
    const { ring, buttons, page, clock } = ringFixture({ announce });
    const first = buttons[0];
    if (first !== undefined) {
      first.textContent = '';
      first.setAttribute('aria-label', 'Close');
    }
    ring.enable();
    tap(page, clock, 50);
    expect(announce).toHaveBeenCalledWith('Close');
  });

  it('loses the highlight when the item it was on leaves the page', () => {
    /* The screen shell puts it back on the first item; the ring itself reports
       honestly that the item it was pointing at is gone. */
    const { ring, buttons, page, clock } = ringFixture();
    ring.enable();
    tap(page, clock, 50);
    buttons[0]?.remove();
    ring.refresh();
    expect(ring.index).toBe(-1);
  });

  it('chooses the highlighted item on a long press', () => {
    const { ring, buttons, page, clock, clicks } = ringFixture();
    ring.enable();
    tap(page, clock, 50);
    tap(page, clock, 700);
    expect(clicks).toEqual(['Yes']);
    expect(buttons[0]?.clickCount).toBe(1);
  });

  it('treats a first press that is long as an advance, not as nothing', () => {
    /* A player who holds too long on their very first press should see the
       highlight appear, not wonder whether the switch is connected. */
    const { ring, page, clock, clicks } = ringFixture();
    ring.enable();
    tap(page, clock, 900);
    expect(ring.index).toBe(0);
    expect(clicks).toEqual([]);
  });

  it('never activates a control by a plain tap while the mode is on', () => {
    /*
     * Without this, a switch user who taps a button both advances the highlight
     * and presses the button under their finger — answering a question by trying
     * to read it.
     */
    const { ring, buttons, page, clock, clicks } = ringFixture();
    ring.enable();
    const down = new FakeEvent('pointerdown');
    page.doc.dispatchEvent(down);
    clock.now += 50;
    page.doc.dispatchEvent(new FakeEvent('pointerup'));
    expect(down.defaultPrevented).toBe(true);
    expect(clicks).toEqual([]);
    expect(buttons[1]?.clickCount).toBe(0);
  });

  it('works from a key, and ignores key repeat', () => {
    const { ring, page, clock, clicks } = ringFixture();
    ring.enable();

    key(page, 'keydown', ' ');
    clock.now += 50;
    key(page, 'keyup', ' ');
    expect(ring.index).toBe(0);

    /* Held keys repeat. A repeat is the keyboard's own scanner and must not
       advance the highlight; one contact is one press. */
    key(page, 'keydown', 'Enter');
    key(page, 'keydown', 'Enter', { repeat: true });
    key(page, 'keydown', 'Enter', { repeat: true });
    clock.now += 800;
    key(page, 'keyup', 'Enter');
    expect(clicks).toEqual(['Yes']);
  });

  it('ignores a key that is not the switch', () => {
    const { ring, page } = ringFixture();
    ring.enable();
    const event = new FakeEvent('keydown', { key: 'Tab' });
    page.doc.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(ring.index).toBe(-1);
  });

  it('does nothing at all while it is disabled', () => {
    const { ring, page, clock } = ringFixture();
    tap(page, clock, 50);
    expect(ring.index).toBe(-1);
    expect(page.doc.listenerCount('pointerdown')).toBe(0);

    ring.enable();
    expect(page.doc.listenerCount('pointerdown')).toBe(1);
    ring.disable();
    expect(page.doc.listenerCount('pointerdown')).toBe(0);
  });

  it('clears the highlight when the mode is turned off', () => {
    const { ring, buttons, page, clock } = ringFixture();
    ring.enable();
    tap(page, clock, 50);
    ring.disable();
    expect(buttons[0]?.getAttribute(HIGHLIGHT_ATTRIBUTE)).toBeNull();
    expect(ring.index).toBe(-1);
  });

  it('reads the threshold at each press, so a change in Settings takes effect at once', () => {
    let holdMs = 600;
    const { ring, page, clock, clicks } = ringFixture({ holdMs: () => holdMs });
    ring.enable();
    tap(page, clock, 50);

    tap(page, clock, 300);
    expect(clicks).toEqual([]);

    holdMs = 250;
    tap(page, clock, 300);
    expect(clicks.length).toBe(1);
  });

  it('keeps the highlight on the same item across a re-render', () => {
    const { ring, buttons, page, clock } = ringFixture();
    ring.enable();
    tap(page, clock, 50);
    tap(page, clock, 50);
    expect(ring.index).toBe(1);

    ring.refresh();
    expect(ring.index).toBe(1);
    expect(buttons[1]?.getAttribute(HIGHLIGHT_ATTRIBUTE)).toBe('true');
  });

  it('skips a hidden control', () => {
    const { ring, buttons, page, clock } = ringFixture();
    const second = buttons[1];
    if (second !== undefined) second.hidden = true;
    ring.enable();
    tap(page, clock, 50);
    tap(page, clock, 50);
    /* Two items visible of three, so the second tap lands on the third button. */
    expect(buttons[2]?.getAttribute(HIGHLIGHT_ATTRIBUTE)).toBe('true');
  });

  it('skips a control that cannot be answered any more', () => {
    const { ring, buttons, page, clock } = ringFixture();
    buttons[0]?.setAttribute('aria-disabled', 'true');
    ring.enable();
    tap(page, clock, 50);
    expect(buttons[1]?.getAttribute(HIGHLIGHT_ATTRIBUTE)).toBe('true');
  });

  it('can be pointed at an item directly, without announcing it', () => {
    const announce = vi.fn();
    const { ring, buttons } = ringFixture({ announce });
    ring.enable();
    ring.highlight(1);
    expect(buttons[1]?.getAttribute(HIGHLIGHT_ATTRIBUTE)).toBe('true');
    expect(announce).not.toHaveBeenCalled();

    ring.highlight(99);
    expect(ring.index).toBe(-1);
  });

  it('lets go of the document when it is destroyed', () => {
    const { ring, page } = ringFixture();
    ring.enable();
    ring.destroy();
    expect(page.doc.listenerCount('pointerdown')).toBe(0);
    expect(page.doc.listenerCount('keyup')).toBe(0);
    expect(ring.enabled).toBe(false);
  });

  it('is idempotent', () => {
    const { ring, page } = ringFixture();
    ring.enable();
    ring.enable();
    expect(page.doc.listenerCount('pointerup')).toBe(1);
    ring.disable();
    ring.disable();
    expect(page.doc.listenerCount('pointerup')).toBe(0);
  });

  it('ignores a release with no press behind it', () => {
    const { ring, page } = ringFixture();
    ring.enable();
    page.doc.dispatchEvent(new FakeEvent('pointerup'));
    expect(ring.index).toBe(-1);
  });
});

interface RingFixture {
  readonly page: FakePage;
  readonly ring: ReturnType<typeof createSwitchRing>;
  readonly buttons: FakeElement[];
  readonly clock: { now: number };
  readonly clicks: string[];
}

function ringFixture(
  options: { announce?: (message: string) => void; holdMs?: number | (() => number) } = {},
): RingFixture {
  const page = buildPage();
  const clock = { now: 0 };
  const clicks: string[] = [];

  const container = page.doc.createElement('div');
  page.ui.append(container);

  const buttons = ['Yes', 'No', 'Later'].map((label) => {
    const control = page.doc.createElement('button');
    control.textContent = label;
    control.addEventListener('click', () => clicks.push(label));
    container.append(control);
    return control;
  });

  const ring = createSwitchRing(container as unknown as HTMLElement, {
    holdMs: options.holdMs ?? 600,
    now: () => clock.now,
    ...(options.announce === undefined ? {} : { announce: options.announce }),
  });

  return { page, ring, buttons, clock, clicks };
}

function tap(page: FakePage, clock: { now: number }, heldMs: number): void {
  page.doc.dispatchEvent(new FakeEvent('pointerdown'));
  clock.now += heldMs;
  page.doc.dispatchEvent(new FakeEvent('pointerup'));
}

function key(
  page: FakePage,
  type: 'keydown' | 'keyup',
  value: string,
  init: { repeat?: boolean } = {},
): void {
  page.doc.dispatchEvent(new FakeEvent(type, { key: value, ...init }));
}
