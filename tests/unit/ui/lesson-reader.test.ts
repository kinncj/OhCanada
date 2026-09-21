import { describe, expect, it, vi } from 'vitest';

import { createLessonReader, type LessonReaderView } from '@ui/lesson-reader';
import { HIGHLIGHT_ATTRIBUTE, SWITCH_STOP_ATTRIBUTE } from '@ui/single-switch';

import { buildPage, press, pressSwitch, type FakeElement } from './support/fake-dom';

/**
 * The lesson reader (ADR-0063), and `docs/stories/TN-READ-reading-a-passage-at-a-stop.md`.
 *
 * ADR-0063 made a passage reachable and left one question open in writing: the
 * reader "does not inherit the single-switch route", because "tap anywhere
 * advances" is a rule written for cards and prose is not a card. This file holds
 * the answer to that question, and to its screen-reader twin.
 *
 * Two things this file can prove and one it cannot. It proves **structure and
 * behaviour** — which element carries which role, what the switch reaches, what
 * is spoken, where focus goes. It cannot prove anything **geometric**: a 44 pt
 * target, prose that does not clip at 200 %, a contrast ratio. Those are in
 * `tests/a11y/lesson-reader.spec.ts`, against real Chromium, where they can
 * actually fail.
 *
 * The passages below are **fixtures, not content**. A real one is authored in
 * `content/lessons/**` with one proposition, one quote and one verifier's grant,
 * and reaches this screen already resolved and already localised. Nothing
 * invented here has a grant, so nothing here states a fact about Canada.
 */

const LESSON_EN: LessonReaderView = {
  title: 'A fixture lesson about a fixture river',
  passages: [
    { id: 'f1-the-river', text: 'The fixture river runs east and meets the sea at Fixture Town.' },
    { id: 'f2-the-wharf', text: 'Boats carried fixture timber down the river every spring.' },
    { id: 'f3-the-towpath', text: 'People still walk the towpath beside the water today.' },
  ],
};

const LESSON_FR: LessonReaderView = {
  title: 'Une leçon fictive au sujet d’une rivière fictive',
  passages: [
    { id: 'f1-the-river', text: 'La rivière fictive coule vers l’est et rejoint la mer à Fixture Town.' },
    { id: 'f2-the-wharf', text: 'Des bateaux descendaient la rivière chargés de bois fictif chaque printemps.' },
    { id: 'f3-the-towpath', text: 'Les gens marchent encore sur le chemin de halage au bord de l’eau.' },
  ],
};

type Options = Parameters<typeof createLessonReader>[1];

function open(overrides: Partial<Options> = {}) {
  const page = buildPage();
  const clock = { now: 0 };
  const onClose = vi.fn();
  const announce = vi.fn();
  const reader = createLessonReader(page.host, {
    locale: 'en',
    onClose,
    announce,
    now: () => clock.now,
    ...overrides,
  });
  return {
    page,
    reader,
    clock,
    onClose,
    announce,
    at: (testId: string) => page.doc.byTestId(testId),
    passages: (): FakeElement[] =>
      page.doc.querySelectorAll('[data-testid="lesson-reader-passage"]'),
    highlighted: (): FakeElement | null =>
      page.doc.querySelector(`[${HIGHLIGHT_ATTRIBUTE}="true"]`),
  };
}

describe('the lesson reader', () => {
  it('draws the lesson title and every passage, in the order the step named them', () => {
    const { reader, at, passages } = open();
    reader.show(LESSON_EN);

    expect(at('lesson-reader')?.hidden).toBe(false);
    expect(at('lesson-reader-title')?.textContent).toBe(LESSON_EN.title);
    expect(passages().map((node) => node.textContent)).toEqual(
      LESSON_EN.passages.map((passage) => passage.text),
    );
    expect(at('lesson-reader-close')?.textContent).toBe('Close');
  });

  it('writes no words of its own but the way out', () => {
    /*
     * Everything on this surface is content except `common.close`. The reader
     * invents no heading, no counter, no "you have read this" and no "next" —
     * ADR-0063 records that whether reading happened is not checkable, and a
     * control that claims to know is a control that lies.
     */
    const { reader, at } = open();
    reader.show(LESSON_EN);

    const drawn = at('lesson-reader')?.textContent ?? '';
    const contentWords = [LESSON_EN.title, ...LESSON_EN.passages.map((p) => p.text)].join('');
    expect(drawn.replace(/\s+/g, '')).toBe(`${contentWords}Close`.replace(/\s+/g, ''));
  });

  it('is a modal dialog named by the lesson and described by the prose', () => {
    const { reader, at, page } = open();
    reader.show(LESSON_EN);

    const root = at('lesson-reader');
    expect(root?.getAttribute('role')).toBe('dialog');
    expect(root?.getAttribute('aria-modal')).toBe('true');
    expect(root?.getAttribute('lang')).toBe('en');

    /* What a screen reader reads on arrival: the title, then every passage. */
    expect(
      page.doc.getElementById(root?.getAttribute('aria-labelledby') ?? '')?.textContent,
    ).toBe(LESSON_EN.title);
    const described = page.doc.getElementById(root?.getAttribute('aria-describedby') ?? '');
    expect(described?.getAttribute('data-testid')).toBe('lesson-reader-body');
    for (const passage of LESSON_EN.passages) {
      expect(described?.textContent).toContain(passage.text);
    }
  });

  it('puts nothing between the reading cursor and the words', () => {
    /*
     * The body carries no widget role and no tabindex. The tempting version of
     * this screen wraps the prose in a focusable `group` — or worse, a `region`
     * landmark inside a dialog — to give a keyboard player a way to "re-read
     * it". That is a Tab stop that does nothing, on the way to the only control
     * there is, and a screen reader already walks prose with its own cursor.
     */
    const { reader, at } = open();
    reader.show(LESSON_EN);

    const body = at('lesson-reader-body');
    expect(body?.getAttribute('role')).toBeNull();
    expect(body?.getAttribute('tabindex')).toBeNull();
  });

  it('opens nothing when there is nothing to read', () => {
    /*
     * ADR-0024: an empty collection must not reduce to a pass. A sheet with a
     * heading and no words is a screen the player dismisses having been told
     * nothing, with every gate green. `app/bootstrap/quests.ts` refuses an empty
     * `passages[]` at load; this is the second line.
     */
    const { reader, at, announce } = open();
    reader.show({ title: 'A lesson with nothing in it', passages: [] });

    expect(reader.visible).toBe(false);
    expect(at('lesson-reader')?.hidden).toBe(true);
    expect(at('lesson-reader-title')?.textContent).toBe('');
    expect(announce).not.toHaveBeenCalled();
  });

  it('announces nothing when it opens, because the dialog reads itself', () => {
    const { reader, announce } = open();
    reader.show(LESSON_EN);
    expect(announce).not.toHaveBeenCalled();
  });

  it('stops the level reaching the keyboard while it is open', () => {
    const { reader, page } = open();
    reader.show(LESSON_EN);
    expect(page.game.inert).toBe(true);

    reader.hide();
    expect(page.game.inert).toBe(false);
  });

  it('closes on Close and on Escape, and tells the caller both times', () => {
    const { reader, at, onClose } = open();

    reader.show(LESSON_EN);
    at('lesson-reader-close')?.click();
    expect(at('lesson-reader')?.hidden).toBe(true);

    reader.show(LESSON_EN);
    press(at('lesson-reader') as FakeElement, 'Escape');
    expect(at('lesson-reader')?.hidden).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('puts focus back on what opened it, even when that was the canvas', () => {
    /*
     * A reader opened by tapping a plaque was opened by something `aria-hidden`
     * that takes no focus, so the trap alone would restore to the body. Naming
     * the destination is what makes "focus returns to where the player was" true
     * both ways.
     */
    const page = buildPage();
    const prompt = page.doc.createElement('button');
    prompt.setAttribute('data-testid', 'interact-prompt');
    page.ui.append(prompt);

    const reader = createLessonReader(page.host, {
      locale: 'en',
      restoreFocusTo: () => prompt as unknown as HTMLElement,
    });
    reader.show(LESSON_EN);
    reader.hide();

    expect(page.doc.activeElement).toBe(prompt);
  });

  it('keeps every passage a switch stop and out of the Tab order', () => {
    const { reader, passages } = open();
    reader.show(LESSON_EN);

    for (const passage of passages()) {
      expect(passage.getAttribute(SWITCH_STOP_ATTRIBUTE)).toBe('true');
      /* `focus-trap.ts` excludes a negative tabindex, so a keyboard player tabs
         from the dialog straight to Close rather than through every paragraph. */
      expect(passage.getAttribute('tabindex')).toBe('-1');
      /* A stop is not a control and must not pretend to be one. */
      expect(passage.getAttribute('role')).toBeNull();
      expect(passage.tagName).toBe('P');
    }
  });

  it('names each paragraph for a report, and never draws or speaks the name', () => {
    const { reader, passages, announce, page, clock } = open({ singleSwitch: true });
    reader.show(LESSON_EN);

    expect(passages().map((node) => node.getAttribute('data-tn-passage'))).toEqual(
      LESSON_EN.passages.map((passage) => passage.id),
    );
    expect(page.doc.byTestId('lesson-reader')?.textContent).not.toContain('f1-the-river');

    pressSwitch(page, clock, 10);
    for (const call of announce.mock.calls) {
      expect(String(call[0])).not.toContain('f1-the-river');
    }
  });

  it('walks the prose on one switch: a short press moves the highlight and reads that passage', () => {
    /*
     * The answer ADR-0063 §3 asked for. A ring built only from controls would
     * highlight Close and nothing else, over prose the player never heard; a
     * switch player cannot scroll, so a paragraph below the fold would be one
     * they could never reach. Each passage is therefore a stop, and one short
     * press moves the highlight, scrolls that paragraph into view and speaks it.
     *
     * The highlight opens on the first passage in silence, because the dialog
     * has just read every passage as its own description — announcing the first
     * one again would be the double-speak this screen refuses. It comes round to
     * it on the lap, which is asserted below: every passage is spoken within one
     * turn of the ring.
     */
    const { reader, page, clock, announce, highlighted } = open({ singleSwitch: true });
    reader.show(LESSON_EN);

    expect(highlighted()?.getAttribute('data-tn-passage')).toBe('f1-the-river');
    expect(announce).not.toHaveBeenCalled();

    const lap: string[] = [];
    /* Three passages and Close: four items, so four presses is one lap. */
    for (let step = 0; step < 4; step += 1) {
      pressSwitch(page, clock, 10);
      lap.push(
        highlighted()?.getAttribute('data-tn-passage') ??
          highlighted()?.getAttribute('data-testid') ??
          '',
      );
    }

    expect(lap).toEqual(['f2-the-wharf', 'f3-the-towpath', 'lesson-reader-close', 'f1-the-river']);
    /* Every passage spoken within one lap, in the language in force. */
    expect(announce.mock.calls.map((call) => call[0])).toEqual([
      LESSON_EN.passages[1]?.text,
      LESSON_EN.passages[2]?.text,
      'Close',
      LESSON_EN.passages[0]?.text,
    ]);
    for (const call of announce.mock.calls) expect(call[1]).toBe('en');
  });

  it('reads a passage again on a long press, and closes nothing', () => {
    /*
     * `confirm.ts`'s stop, asked of prose: the one thing a switch player could
     * not do was ask for a paragraph again. A stop that could act would be no
     * stop, so this must not be a way out and must not move the highlight.
     */
    const { reader, page, clock, announce, highlighted, onClose } = open({ singleSwitch: true });
    reader.show(LESSON_EN);

    pressSwitch(page, clock, 900);

    expect(reader.visible).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(highlighted()?.getAttribute('data-tn-passage')).toBe('f1-the-river');
    expect(announce).toHaveBeenCalledWith(LESSON_EN.passages[0]?.text, 'en');
  });

  it('closes on a long press when the highlight is on the way out', () => {
    const { reader, page, clock, onClose } = open({ singleSwitch: true });
    reader.show(LESSON_EN);

    /* Three short presses put the highlight on Close; the fourth press is held. */
    pressSwitch(page, clock, 10);
    pressSwitch(page, clock, 10);
    pressSwitch(page, clock, 10);
    pressSwitch(page, clock, 900);

    expect(reader.visible).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does nothing when prose is clicked and the switch is off', () => {
    /* The click handler exists for one contact. A mouse player clicking a
       paragraph on a screen with no switch mode must not make the game speak. */
    const { reader, passages, announce } = open();
    reader.show(LESSON_EN);

    passages()[0]?.click();
    expect(announce).not.toHaveBeenCalled();
  });

  it('changes language with the passages, never the heading alone', () => {
    /*
     * `setLocale` takes the view back, and the parameter is required. A screen
     * that kept the prose it was handed would put a French heading over English
     * paragraphs the first time a player changed language mid-read, and an
     * optional parameter is how that ships.
     */
    const { reader, at, passages } = open();
    reader.show(LESSON_EN);
    reader.setLocale('fr', LESSON_FR);

    expect(at('lesson-reader')?.getAttribute('lang')).toBe('fr');
    expect(at('lesson-reader-title')?.textContent).toBe(LESSON_FR.title);
    expect(at('lesson-reader-close')?.textContent).toBe('Fermer');
    expect(passages().map((node) => node.textContent)).toEqual(
      LESSON_FR.passages.map((passage) => passage.text),
    );
    expect(at('lesson-reader')?.textContent).not.toContain('The fixture river runs east');
  });

  it('speaks French prose as French after a language change', () => {
    const { reader, page, clock, announce } = open({ singleSwitch: true });
    reader.show(LESSON_EN);
    reader.setLocale('fr', LESSON_FR);
    announce.mockClear();

    pressSwitch(page, clock, 10);

    expect(announce.mock.calls[0]?.[1], 'French prose read with English phonemes').toBe('fr');
    expect(LESSON_FR.passages.map((passage) => passage.text)).toContain(
      announce.mock.calls[0]?.[0],
    );
  });
});
