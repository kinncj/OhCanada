import { describe, expect, it, vi } from 'vitest';

import { createHud } from '@ui/hud';
import { createPoiCard } from '@ui/poi-card';

import { buildPage, press, type FakeElement } from './support/fake-dom';

/**
 * `docs/stories/TN-LEVEL-05` and `TN-LEVEL-11`: the landmark card.
 *
 * The card writes no copy. Its heading and body are content that travels with
 * the level (ADR-0010), and `poi.parliamentHill.body` states a fact about Canada,
 * so it is verified like a question (`OQ-LEVEL-4`). The fixtures below are the
 * story's wording only so the assertions read as the scenario does.
 */

const PARLIAMENT = {
  title: 'Parliament Hill',
  body: [
    'The Parliament buildings are in Ottawa. The tall clock tower is called the Peace Tower.',
  ],
} as const;

const PARLEMENT = {
  title: 'La Colline du Parlement',
  body: [
    "Les édifices du Parlement sont à Ottawa. La haute tour de l'horloge s'appelle la tour de la Paix.",
  ],
} as const;

function open(overrides: Partial<Parameters<typeof createPoiCard>[1]> = {}) {
  const page = buildPage();
  const onClose = vi.fn();
  const card = createPoiCard(page.host, { locale: 'en', onClose, ...overrides });
  return { page, card, onClose, at: (testId: string) => page.doc.byTestId(testId) };
}

describe('the landmark card', () => {
  it('shows the heading and the sentence, and offers Close', () => {
    const { card, at } = open();
    card.show(PARLIAMENT);

    const root = at('poi-card');
    expect(root?.hidden).toBe(false);
    expect(root?.textContent).toContain('Parliament Hill');
    expect(root?.textContent).toContain(
      'The Parliament buildings are in Ottawa. The tall clock tower is called the Peace Tower.',
    );
    expect(at('poi-card-close')?.textContent).toBe('Close');
  });

  it('is a modal dialog named by its heading', () => {
    const { card, at, page } = open();
    card.show(PARLIAMENT);

    const root = at('poi-card');
    expect(root?.getAttribute('role')).toBe('dialog');
    expect(root?.getAttribute('aria-modal')).toBe('true');
    expect(
      page.doc.getElementById(root?.getAttribute('aria-labelledby') ?? '')?.textContent,
    ).toBe('Parliament Hill');
    expect(
      page.doc.getElementById(root?.getAttribute('aria-describedby') ?? '')?.textContent,
    ).toContain('Peace Tower');
  });

  it('stops the level reaching the keyboard while it is open', () => {
    /* TN-LEVEL-05: "the game does not move while a card is open". The trap
       inerts everything outside the card, the play surface included. */
    const { card, page } = open();
    card.show(PARLIAMENT);
    expect(page.game.inert).toBe(true);

    card.hide();
    expect(page.game.inert).toBe(false);
  });

  it('closes on Close and on Escape, and tells the caller both times', () => {
    const { card, at, onClose } = open();

    card.show(PARLIAMENT);
    at('poi-card-close')?.click();
    expect(at('poi-card')?.hidden).toBe(true);

    card.show(PARLIAMENT);
    press(at('poi-card') as FakeElement, 'Escape');
    expect(at('poi-card')?.hidden).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('gives focus back to the interact prompt, even when the canvas opened it', () => {
    /*
     * TN-LEVEL-05: "focus returns to interact-prompt". The trap restores focus to
     * whatever had it, which is the body when the player tapped the landmark on
     * the `aria-hidden` canvas — so the destination is named rather than
     * inherited.
     */
    const page = buildPage();
    const hud = createHud(page.host, { locale: 'en' });
    hud.setPrompt('Look at Parliament Hill');

    const card = createPoiCard(page.host, {
      locale: 'en',
      restoreFocusTo: () => hud.prompt,
    });

    card.show(PARLIAMENT);
    card.hide();

    expect(page.doc.activeElement).toBe(hud.prompt);
  });

  it('takes a switch threshold change under a live card', () => {
    /* A player who changes "Hold time" while a card is open must not have to
       close it for the new threshold to apply. */
    const { card } = open({ singleSwitch: true, holdMs: 600 });
    card.show(PARLIAMENT);
    card.setSingleSwitch(true, 2_000);
    expect(card.visible).toBe(true);
  });

  it('is removed by destroy, leaving the page as it found it', () => {
    const { card, at, page } = open();
    card.show(PARLIAMENT);
    card.destroy();

    expect(at('poi-card')).toBeNull();
    expect(page.game.inert).toBe(false);
  });

  it('is French end to end', () => {
    const { card, at } = open({ locale: 'fr' });
    card.setLocale('fr');
    card.show(PARLEMENT);

    expect(at('poi-card')?.textContent).toContain('La Colline du Parlement');
    expect(at('poi-card')?.textContent).toContain("s'appelle la tour de la Paix.");
    expect(at('poi-card-close')?.textContent).toBe('Fermer');
  });
});
