import { describe, expect, it } from 'vitest';

import { createFocusTrap } from '@ui/focus-trap';

import { buildPage, FakeEvent, press, type FakeElement, type FakePage } from './support/fake-dom';

/**
 * A modal holds focus against whatever takes it, not only against Tab.
 *
 * **The defect (third live-site audit).** Engaging the guide with the **Enter
 * key** opened the dialogue from the game's own frame rather than from a DOM
 * handler, and intermittently left focus outside it. From there Tab reached the
 * Settings button *behind* the modal, Enter opened Settings on top of the open
 * dialogue, and Space flipped the language radio while the dialogue was still up.
 * Opening the same dialogue with a pointer was correct every time: a click leaves
 * focus on the control that was clicked, inside the subtree the trap is about to
 * make inert, so the browser's own fix-up lands inside the dialog.
 *
 * `activate()` moved focus once and never looked again, so anything that moved it
 * afterwards — a canvas taking it back a frame later, an element removed from
 * under it, a `Tab` whose default something else had already prevented — silently
 * broke the promise `aria-modal="true"` makes.
 *
 * What is asserted here is the promise, not a cause: focus that lands outside an
 * active trap comes back, to the control the player was on where there is one.
 * `app/ui` never learns *why* it left, which is deliberate — the engine is
 * another layer and this file may not guess at it.
 *
 * The browser-side proof, with a real Enter key on a real level, is
 * `tests/e2e/keyboard-at-a-stop.spec.ts`.
 */

interface Modal {
  readonly page: FakePage;
  /** The dialog: the trap's container. */
  readonly card: FakeElement;
  readonly accept: FakeElement;
  readonly decline: FakeElement;
  /** The HUD behind it, and the control the audit reached with Tab. */
  readonly behind: FakeElement;
  readonly settings: FakeElement;
}

/** A dialogue over a HUD, as `app/ui/dialogue.ts` and `app/ui/hud.ts` build it. */
function openModal(): Modal {
  const page = buildPage();

  const behind = page.doc.createElement('section');
  behind.setAttribute('data-testid', 'hud');
  const settings = page.doc.createElement('button');
  settings.setAttribute('data-testid', 'hud-settings-button');
  behind.append(settings);

  const card = page.doc.createElement('div');
  card.setAttribute('data-testid', 'dialogue');
  card.tabIndex = -1;
  const accept = page.doc.createElement('button');
  accept.setAttribute('data-testid', 'dialogue-accept');
  const decline = page.doc.createElement('button');
  decline.setAttribute('data-testid', 'dialogue-decline');
  card.append(accept, decline);

  page.ui.append(behind, card);
  return { page, card, accept, decline, behind, settings };
}

/**
 * What a browser does when something outside moves focus: the element takes it,
 * and `focusin` is dispatched from it. The trap listens at the document, at
 * capture, exactly as it does for Tab.
 */
function focusArrivesOn(element: FakeElement): void {
  element.focus();
  element.dispatchEvent(new FakeEvent('focusin'));
}

describe('a modal whose focus is taken by something else', () => {
  it('brings it back, so Tab cannot reach the page behind it', () => {
    const { page, card, settings } = openModal();
    const trap = createFocusTrap(card as unknown as HTMLElement);
    trap.activate();

    /* The audit's symptom, reproduced: focus on the Settings button behind an
       open dialogue. Nothing in this file moved it there. */
    focusArrivesOn(settings);

    expect(page.doc.activeElement, 'focus was left behind the modal').toBe(card);
  });

  it('puts the player back on the control they were on, not at the top', () => {
    const { page, card, decline, settings } = openModal();
    createFocusTrap(card as unknown as HTMLElement).activate();
    focusArrivesOn(decline);

    focusArrivesOn(settings);

    expect(page.doc.activeElement, 'the player lost their place in the dialogue').toBe(decline);
  });

  it('falls back to the dialog when that control has gone', () => {
    const { page, card, decline, settings } = openModal();
    createFocusTrap(card as unknown as HTMLElement).activate();
    focusArrivesOn(decline);
    /* The choice was taken and the row re-rendered under the keyboard. */
    decline.remove();

    focusArrivesOn(settings);

    expect(page.doc.activeElement).toBe(card);
  });

  it('holds focus that fell to nothing at all', () => {
    const { page, card } = openModal();
    createFocusTrap(card as unknown as HTMLElement).activate();

    /* `<body>`: where focus goes when what held it is removed or made inert. */
    focusArrivesOn(page.doc.body);

    expect(page.doc.activeElement).toBe(card);
  });

  it('holds it even when a Tab was answered by somebody else', () => {
    const { page, card, accept, settings } = openModal();
    createFocusTrap(card as unknown as HTMLElement).activate();
    focusArrivesOn(accept);

    /* The engine captured this key and prevented its default before the trap saw
       it, so the trap's own Tab handling stands down and the browser moves focus
       natively. The guard is what keeps the promise in that case. */
    const tab = new FakeEvent('keydown', { key: 'Tab' });
    tab.preventDefault();
    accept.dispatchEvent(tab);
    focusArrivesOn(settings);

    expect(page.doc.activeElement).toBe(accept);
  });

  it('leaves the live region alone as a place to read, never as a place to stand', () => {
    const { page, card } = openModal();
    createFocusTrap(card as unknown as HTMLElement).activate();

    /* It is exempt from `inert` so announcements survive a modal; that exemption
       is about being read, not about holding focus. */
    focusArrivesOn(page.live);

    expect(page.doc.activeElement).toBe(card);
  });

  it('does not fight focus it moved itself', () => {
    const { page, card, accept } = openModal();
    createFocusTrap(card as unknown as HTMLElement).activate();

    focusArrivesOn(accept);

    expect(page.doc.activeElement, 'the guard pulled focus off a control inside the dialog').toBe(
      accept,
    );
  });

  it('still lets Tab move inside the dialog', () => {
    const { page, card, accept, decline } = openModal();
    createFocusTrap(card as unknown as HTMLElement).activate();
    focusArrivesOn(accept);

    press(accept, 'Tab');

    expect(page.doc.activeElement).toBe(decline);
  });
});

describe('a trap standing aside', () => {
  it('lets a surface above it take focus, which is what suspend is for', () => {
    const { page, card, settings } = openModal();
    const trap = createFocusTrap(card as unknown as HTMLElement);
    trap.activate();
    trap.suspend();

    focusArrivesOn(settings);

    /* The exam's review and Settings' confirmation open over their own screen and
       take focus deliberately; a guard that fought them would be the two-traps
       bug `suspend` exists to prevent. */
    expect(page.doc.activeElement).toBe(settings);
  });

  it('takes the page back when it resumes', () => {
    const { page, card, settings } = openModal();
    const trap = createFocusTrap(card as unknown as HTMLElement);
    trap.activate();
    trap.suspend();
    trap.resume();

    focusArrivesOn(settings);

    expect(page.doc.activeElement).toBe(card);
  });

  it('lets focus go once it is released, and listens to nothing afterwards', () => {
    const { page, card, settings } = openModal();
    const trap = createFocusTrap(card as unknown as HTMLElement);
    trap.activate();
    trap.release();

    focusArrivesOn(settings);

    expect(page.doc.activeElement).toBe(settings);
    expect(page.doc.listenerCount('focusin'), 'the guard outlived the modal').toBe(0);
    expect(page.doc.listenerCount('keydown')).toBe(0);
  });
});
