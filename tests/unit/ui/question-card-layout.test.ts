import { describe, expect, it, vi } from 'vitest';

import { createQuestionCard, type QuestionView } from '@ui/question-card';

import { buildPage, type FakeElement, type FakePage } from './support/fake-dom';

/**
 * ADR-0045: where the question is asked, how the card sits on the screen, and
 * the way on after answering.
 *
 * Geometry is `tests/a11y`'s (`readability.spec.ts` measures "Next" on screen);
 * this file holds the structure and the calls that produce it.
 */

const QUESTION: QuestionView = {
  kind: 'new',
  index: 0,
  total: 2,
  prompt: 'In which elections does the responsibility to vote apply?',
  options: ['All of them.', 'Federal elections only.', 'Provincial elections only.', 'None.'],
  correctIndex: 0,
  explanation: 'Having the vote brings a duty to use it.',
};

function open(
  question: QuestionView,
  overrides: Partial<Parameters<typeof createQuestionCard>[1]> = {},
): { page: FakePage; root: FakeElement; card: ReturnType<typeof createQuestionCard> } {
  const page = buildPage();
  const card = createQuestionCard(page.host, { locale: 'en', ...overrides });
  card.present(question);
  const root = page.doc.byTestId('question-card');
  if (root === null) throw new Error('the card did not mount');
  return { page, root, card };
}

describe('where the question is asked', () => {
  it('names the level and the landmark above the question, in the names it is handed', () => {
    const { root } = open({ ...QUESTION, place: ['Halifax', 'Halifax Town Clock'] });
    const place = root.byTestId('question-place');
    expect(place?.hidden).toBe(false);
    const names = place?.children.filter((child) => child.getAttribute('aria-hidden') === null);
    expect(names?.map((name) => name.textContent)).toEqual(['Halifax', 'Halifax Town Clock']);
    /* The dot between them is drawn and never read. */
    const gaps = place?.children.filter((child) => child.getAttribute('aria-hidden') === 'true');
    expect(gaps).toHaveLength(1);
  });

  it('draws no line in Study, where a question belongs to no place', () => {
    const { root } = open(QUESTION);
    expect(root.byTestId('question-place')?.hidden).toBe(true);
    expect(root.byTestId('question-place')?.textContent).toBe('');
  });

  it('draws the level alone when only the level is named, with no stray dot', () => {
    const { root } = open({ ...QUESTION, place: ['Peggy’s Cove', ''] });
    const place = root.byTestId('question-place');
    expect(place?.textContent).toBe('Peggy’s Cove');
    expect(place?.children).toHaveLength(1);
  });

  it('is neither the dialog’s name nor its description, so the counter and the question come first', () => {
    const { root, page } = open({ ...QUESTION, place: ['Halifax', 'Halifax Town Clock'] });
    const name = page.doc.getElementById(root.getAttribute('aria-labelledby') ?? '');
    const description = page.doc.getElementById(root.getAttribute('aria-describedby') ?? '');
    expect(name?.textContent).toBe('Question 1 of 2');
    expect(description?.textContent).toBe(QUESTION.prompt);
  });

  it('follows the next question, and clears when the next one has no place', () => {
    const { root, card } = open({ ...QUESTION, place: ['Toronto', 'Streetcar'] });
    card.present({ ...QUESTION, index: 1, place: ['Toronto', 'CN Tower'] });
    expect(root.byTestId('question-place')?.textContent).toContain('CN Tower');
    card.present({ ...QUESTION, index: 1 });
    expect(root.byTestId('question-place')?.hidden).toBe(true);
  });
});

describe('how the card sits on the screen', () => {
  it('hugs its content with the night behind it by default, which is Study', () => {
    const { root } = open(QUESTION);
    const classes = root.className.split(' ');
    expect(classes).toContain('tn-question');
    expect(classes).toContain('tn-screen--hug');
    expect(classes).not.toContain('tn-screen--sheet');
  });

  it('is a sheet over the level when a level asks it', () => {
    const { root } = open(QUESTION, { overLevel: true });
    const classes = root.className.split(' ');
    expect(classes).toContain('tn-screen--sheet');
    expect(classes).not.toContain('tn-screen--hug');
    /* Still the modal it was: role, name and the trap are the screen's. */
    expect(root.getAttribute('role')).toBe('dialog');
    expect(root.getAttribute('aria-modal')).toBe('true');
  });

  it('starts every question at its top', () => {
    const { root, card } = open(QUESTION);
    (root as unknown as { scrollTop: number }).scrollTop = 400;
    card.present({ ...QUESTION, index: 1 });
    expect((root as unknown as { scrollTop: number }).scrollTop).toBe(0);
  });

  it('puts the counter and the tag in one row the stylesheet can wrap', () => {
    const { root } = open(QUESTION);
    const head = root.querySelector('.tn-question__head');
    expect(head?.children.map((child) => child.getAttribute('data-testid'))).toEqual([
      'question-progress',
      'question-kind',
    ]);
  });
});

describe('the way on, after answering', () => {
  /** Lay the card out: the actions end at `actionsBottom`, the result starts at `resultTop`. */
  function layOut(
    root: FakeElement,
    geometry: { readonly viewport: number; readonly resultTop: number; readonly actionsBottom: number },
  ): { actions: ReturnType<typeof vi.fn>; result: ReturnType<typeof vi.fn> } {
    const actions = root.querySelector('.tn-screen__actions');
    const feedback = root.byTestId('question-feedback');
    if (actions === null || feedback === null) throw new Error('no actions or result');
    const actionsScroll = vi.fn();
    const resultScroll = vi.fn();
    Object.assign(actions, {
      scrollIntoView: actionsScroll,
      getBoundingClientRect: () => ({ bottom: geometry.actionsBottom }),
    });
    Object.assign(feedback, {
      scrollIntoView: resultScroll,
      getBoundingClientRect: () => ({ top: geometry.resultTop }),
    });
    Object.assign(root, { getBoundingClientRect: () => ({ height: geometry.viewport }) });
    return { actions: actionsScroll, result: resultScroll };
  }

  it('scrolls the way on into view with the result, and keeps focus on the result', () => {
    const { root, page } = open(QUESTION);
    const scrolled = layOut(root, { viewport: 844, resultTop: 600, actionsBottom: 1100 });
    root.byTestId('option-1')?.click();

    expect(scrolled.actions).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'smooth',
    });
    expect(scrolled.result).not.toHaveBeenCalled();
    expect(page.doc.activeElement).toBe(root.byTestId('question-feedback'));
    expect(root.byTestId('question-next')?.hidden).toBe(false);
  });

  it('jumps rather than glides under reduced motion', () => {
    const { root, page } = open(QUESTION);
    page.doc.documentElement.setAttribute('data-tn-motion', 'reduced');
    const scrolled = layOut(root, { viewport: 844, resultTop: 600, actionsBottom: 1100 });
    root.byTestId('option-0')?.click();
    expect(scrolled.actions).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'auto',
    });
  });

  it('shows the start of the result when the result and the way on are taller than the screen', () => {
    const { root } = open(QUESTION);
    const scrolled = layOut(root, { viewport: 844, resultTop: 200, actionsBottom: 1400 });
    root.byTestId('option-1')?.click();
    expect(scrolled.result).toHaveBeenCalledWith({
      block: 'start',
      inline: 'nearest',
      behavior: 'smooth',
    });
    expect(scrolled.actions).not.toHaveBeenCalled();
  });

  it('scrolls nothing on a second tap, because nothing changed', () => {
    const { root } = open(QUESTION);
    const scrolled = layOut(root, { viewport: 844, resultTop: 600, actionsBottom: 1100 });
    root.byTestId('option-1')?.click();
    root.byTestId('option-2')?.click();
    expect(scrolled.actions).toHaveBeenCalledTimes(1);
  });
});
