/**
 * "Read about this" on the question card — `docs/stories/TN-TEACHBACK-read-about-this.md`,
 * ADR-0070. The card is handed the lesson reader's own view and resolves
 * nothing; these tests hold when the control appears, what it opens, and where
 * focus and the switch highlight go back to.
 */

import { describe, expect, it, vi } from 'vitest';

import type { LessonReaderView } from '@ui/lesson-reader';
import { createQuestionCard, type QuestionView } from '@ui/question-card';
import { HIGHLIGHT_ATTRIBUTE } from '@ui/single-switch';

import { buildPage, press, pressSwitch, type FakeElement } from './support/fake-dom';

const QUESTION: QuestionView = {
  kind: 'new',
  index: 0,
  total: 2,
  prompt: 'Who is the head of state of Canada?',
  options: ['The Sovereign', 'The Prime Minister', 'The Governor General', 'The Speaker'],
  correctIndex: 0,
  explanation: 'Canada is a constitutional monarchy.',
};

const READING_EN: LessonReaderView = {
  title: 'The Crown and the legislatures',
  passages: [{ id: 'g3-head-of-state', text: 'The Sovereign is Canada’s head of state.' }],
};

const READING_FR: LessonReaderView = {
  title: 'La Couronne et les assemblées',
  passages: [{ id: 'g3-head-of-state', text: 'Le souverain est le chef de l’État du Canada.' }],
};

type Options = Parameters<typeof createQuestionCard>[1];

function open(overrides: Partial<Options> = {}) {
  const page = buildPage();
  const clock = { now: 0 };
  const announce = vi.fn();
  const onNext = vi.fn();
  const onDismiss = vi.fn();
  const card = createQuestionCard(page.host, {
    locale: 'en',
    announce,
    onNext,
    onDismiss,
    now: () => clock.now,
    ...overrides,
  });
  card.present(QUESTION);
  const at = (testId: string): FakeElement | null => page.doc.byTestId(testId);
  return {
    page,
    card,
    clock,
    announce,
    onNext,
    onDismiss,
    at,
    readAbout: () => at('question-read-about'),
    reader: () => at('lesson-reader'),
    highlighted: (): FakeElement | null => page.doc.querySelector(`[${HIGHLIGHT_ATTRIBUTE}="true"]`),
  };
}

describe('"Read about this" on the question card', () => {
  it('is not offered before the answer is judged, even with a reading in hand', () => {
    const { card, readAbout } = open();
    card.setReading(READING_EN);
    expect(readAbout()?.hidden).toBe(true);
  });

  it('is offered once the answer is judged, in the table’s words', () => {
    const { card, at, readAbout } = open();
    card.setReading(READING_EN);
    at('option-1')?.click();
    expect(readAbout()?.hidden).toBe(false);
    expect(readAbout()?.tagName).toBe('BUTTON');
    expect(readAbout()?.textContent).toBe('Read about this');
  });

  it('appears when the reading arrives after the answer', () => {
    const { card, at, readAbout } = open();
    at('option-0')?.click();
    expect(readAbout()?.hidden).toBe(true);
    card.setReading(READING_EN);
    expect(readAbout()?.hidden).toBe(false);
  });

  it('is not drawn at all when there is nothing to read — not a disabled control', () => {
    const { card, at, readAbout } = open();
    card.setReading(null);
    at('option-0')?.click();
    expect(readAbout()?.hidden).toBe(true);
    expect(readAbout()?.getAttribute('aria-disabled')).toBeNull();
    card.setReading({ title: 'Empty', passages: [] });
    expect(readAbout()?.hidden).toBe(true);
  });

  it('comes after the way on and before Close, so Next is still met first', () => {
    const { card, at, page } = open();
    card.setReading(READING_EN);
    at('option-0')?.click();
    const order = (page.doc.byTestId('question-card') as FakeElement)
      .querySelectorAll('button')
      .map((control) => control.getAttribute('data-testid'))
      .filter((id) => id !== null && !id.startsWith('option-'));
    expect(order).toEqual(['question-next', 'question-read-about', 'question-close']);
  });

  it('opens the reader on the passage, and closing it puts focus back on the control', () => {
    const { card, at, page, readAbout, reader } = open();
    card.setReading(READING_EN);
    at('option-0')?.click();
    readAbout()?.click();

    expect(reader()?.hidden).toBe(false);
    expect(at('lesson-reader-title')?.textContent).toBe(READING_EN.title);
    expect(at('lesson-reader-passage')?.textContent).toBe(READING_EN.passages[0]?.text);

    at('lesson-reader-close')?.click();
    expect(reader()?.hidden).toBe(true);
    expect(at('question-card')?.hidden).toBe(false);
    expect(page.doc.activeElement).toBe(readAbout());
  });

  it('closes the reader on Escape without leaving the card', () => {
    const { card, at, page, readAbout, reader, onDismiss } = open();
    card.setReading(READING_EN);
    at('option-0')?.click();
    readAbout()?.click();

    press(reader() as FakeElement, 'Escape');
    expect(reader()?.hidden).toBe(true);
    expect(onDismiss).not.toHaveBeenCalled();
    expect(at('question-card')?.hidden).toBe(false);
    expect(page.doc.activeElement).toBe(readAbout());
  });

  it('forgets the reading when the next question goes up', () => {
    const { card, at, readAbout } = open();
    card.setReading(READING_EN);
    at('option-0')?.click();
    card.present({ ...QUESTION, index: 1 });
    at('option-0')?.click();
    expect(readAbout()?.hidden).toBe(true);
  });

  it('closes an open reader when the card is hidden or the next question goes up', () => {
    const { card, at, readAbout, reader } = open();
    card.setReading(READING_EN);
    at('option-0')?.click();
    readAbout()?.click();
    card.present({ ...QUESTION, index: 1 });
    expect(reader()?.hidden).toBe(true);

    card.setReading(READING_EN);
    at('option-0')?.click();
    readAbout()?.click();
    card.hide();
    expect(reader()?.hidden).toBe(true);
  });

  it('changes language with the card, and an open reader follows the view it is handed', () => {
    const { card, at, readAbout } = open();
    card.setReading(READING_EN);
    at('option-0')?.click();
    readAbout()?.click();

    card.setLocale('fr');
    card.setReading(READING_FR);
    expect(readAbout()?.textContent).toBe('Lire à ce sujet');
    expect(at('lesson-reader-title')?.textContent).toBe(READING_FR.title);
    expect(at('lesson-reader-passage')?.textContent).toBe(READING_FR.passages[0]?.text);
  });

  it('closes an open reader whose reading is withdrawn', () => {
    const { card, at, page, readAbout, reader } = open();
    card.setReading(READING_EN);
    at('option-0')?.click();
    const control = readAbout();
    control?.click();
    card.setReading(null);
    expect(reader()?.hidden).toBe(true);
    expect(control?.hidden).toBe(true);
    expect(at('question-card')?.hidden).toBe(false);
    /* Not the control that has gone: the way on. */
    expect(page.doc.activeElement).toBe(at('question-next'));
  });

  it('works on one switch, and the highlight comes back to the control after reading', () => {
    const { card, at, page, clock, readAbout, reader } = open({ singleSwitch: true });
    card.setReading(READING_EN);
    at('option-0')?.click();

    /* The ring after an answer: Next, Read about this, Close. */
    /* The highlight is where focus is: `focusAndReveal` moves both together. */
    const focused = (): string | null => page.doc.activeElement?.getAttribute('data-testid') ?? null;
    const seen: (string | null)[] = [];
    for (let step = 0; step < 8; step += 1) {
      if (focused() === 'question-read-about') break;
      pressSwitch(page, clock, 10);
      seen.push(focused());
    }
    expect(focused(), seen.join(' > ')).toBe('question-read-about');
    pressSwitch(page, clock, 900);
    expect(reader()?.hidden).toBe(false);

    /* The reader's ring: the passage, then Close. */
    pressSwitch(page, clock, 10);
    expect(focused()).toBe('lesson-reader-close');
    pressSwitch(page, clock, 900);

    expect(reader()?.hidden).toBe(true);
    expect(readAbout()?.getAttribute(HIGHLIGHT_ATTRIBUTE)).toBe('true');
    expect(page.doc.activeElement).toBe(readAbout());
  });

  it('passes a switch change on to an open reader', () => {
    const { card, at, readAbout, highlighted } = open();
    card.setReading(READING_EN);
    at('option-0')?.click();
    readAbout()?.click();
    card.setSingleSwitch(true, 600);
    expect(highlighted()?.getAttribute('data-tn-passage')).toBe('g3-head-of-state');
  });

  it('is gone with the card', () => {
    const { card, at, page, readAbout } = open();
    card.setReading(READING_EN);
    at('option-0')?.click();
    readAbout()?.click();
    card.destroy();
    expect(page.doc.byTestId('lesson-reader')).toBeNull();
    expect(page.doc.byTestId('question-card')).toBeNull();
  });
});
