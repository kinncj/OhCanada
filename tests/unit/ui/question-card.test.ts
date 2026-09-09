import { describe, expect, it, vi } from 'vitest';

import { createQuestionCard, type QuestionView } from '@ui/question-card';

import { buildPage, FakeEvent, press, type FakeElement, type FakePage } from './support/fake-dom';

/**
 * `docs/stories/TN-CARD-question-card.md`. Study mode reuses this component
 * exactly, so anything asserted here holds in a drill too.
 *
 * Question wording is content and never comes from the UI; the fixtures below
 * are stand-ins with the shape the content agents produce.
 */

const QUESTION: QuestionView = {
  kind: 'new',
  index: 0,
  total: 3,
  prompt: 'Who is the head of state of Canada?',
  options: ['The monarch', 'The prime minister', 'The governor general', 'The speaker'],
  correctIndex: 0,
  explanation: 'Canada is a constitutional monarchy.',
};

const FRENCH: QuestionView = {
  ...QUESTION,
  prompt: "Qui est le chef d'État du Canada?",
  options: ['Le monarque', 'Le premier ministre', 'Le gouverneur général', 'Le président'],
  explanation: 'Le Canada est une monarchie constitutionnelle.',
};

interface Fixture {
  readonly page: FakePage;
  readonly card: ReturnType<typeof createQuestionCard>;
  readonly root: FakeElement;
  readonly announce: ReturnType<typeof vi.fn>;
  readonly onAnswer: ReturnType<typeof vi.fn>;
  readonly onDismiss: ReturnType<typeof vi.fn>;
  readonly onNext: ReturnType<typeof vi.fn>;
  at(testId: string): FakeElement;
}

function open(
  question: QuestionView = QUESTION,
  overrides: Partial<Parameters<typeof createQuestionCard>[1]> = {},
): Fixture {
  const page = buildPage();
  const announce = vi.fn();
  const onAnswer = vi.fn();
  const onDismiss = vi.fn();
  const onNext = vi.fn();

  const card = createQuestionCard(page.host, {
    locale: 'en',
    announce,
    onAnswer,
    onDismiss,
    onNext,
    ...overrides,
  });
  card.present(question);

  const root = page.doc.byTestId('question-card');
  if (root === null) throw new Error('the card did not mount');

  return {
    page,
    card,
    root,
    announce,
    onAnswer,
    onDismiss,
    onNext,
    at(testId): FakeElement {
      const found = root.byTestId(testId);
      if (found === null) throw new Error(`no element ${testId}`);
      return found;
    },
  };
}

describe('a question arriving', () => {
  it('is a named modal dialog described by the question', () => {
    const { root, page, at } = open();
    expect(root.getAttribute('role')).toBe('dialog');
    expect(root.getAttribute('aria-modal')).toBe('true');

    const name = page.doc.getElementById(root.getAttribute('aria-labelledby') ?? '');
    const description = page.doc.getElementById(root.getAttribute('aria-describedby') ?? '');
    expect(name?.textContent).toBe('Question 1 of 3');
    expect(description?.textContent).toBe(QUESTION.prompt);
    expect(at('question-progress').textContent).toBe('Question 1 of 3');
  });

  it('shows exactly four options, each a button carrying its whole wording', () => {
    const { at } = open();
    for (const [index, wording] of QUESTION.options.entries()) {
      const option = at(`option-${String(index)}`);
      expect(option.tagName).toBe('BUTTON');
      /* No "option 1" prefix hiding the wording (TN-CARD-08). */
      expect(option.textContent).toBe(wording);
    }
  });

  it('says whether the question is new, in words', () => {
    expect(open().at('question-kind').textContent).toBe('New');
    expect(open({ ...QUESTION, kind: 'seen' }).at('question-kind').textContent).toBe(
      'Seen before',
    );
  });

  it('announces the progress when it opens', () => {
    const { announce } = open();
    expect(announce).toHaveBeenCalledWith('Question 1 of 3');
  });

  it('shows nothing that counts down', () => {
    /* TN-CARD-01: "no timer, clock or progress bar that empties is shown", and
       nothing in the module can produce one. */
    const { root } = open();
    expect(root.querySelectorAll('progress').length).toBe(0);
    expect(root.textContent).not.toMatch(/\d+\s*(s|sec|seconds|secondes)\b/);
  });
});

describe('a right answer', () => {
  it('says so, explains why, and offers a way on', () => {
    const { at, onAnswer, root } = open();
    at('option-0').click();

    expect(onAnswer).toHaveBeenCalledWith(0, true);
    expect(at('question-feedback').textContent).toContain("That's right!");
    expect(at('question-explanation').textContent).toBe(
      'Why: Canada is a constitutional monarchy.',
    );
    expect(at('question-next').textContent).toBe('Next');
    expect(root.byTestId('question-next')?.hidden).toBe(false);
  });

  it('marks the chosen option with a tick and the words "Correct answer"', () => {
    const { at } = open();
    at('option-0').click();
    const chosen = at('option-0');
    expect(chosen.querySelector('[aria-hidden="true"]')?.textContent).toBe('✓');
    expect(chosen.textContent).toContain('Correct answer');
  });

  it('moves focus to the result so it is read', () => {
    const { at, page } = open();
    at('option-1').click();
    expect(page.doc.activeElement).toBe(at('question-feedback'));
  });

  it('calls Finish rather than Next on the last question', () => {
    const { at } = open({ ...QUESTION, index: 2, total: 3 });
    at('option-0').click();
    expect(at('question-next').textContent).toBe('Finish');
  });

  it('hands the "next" decision to the caller', () => {
    const { at, onNext } = open();
    at('option-0').click();
    at('question-next').click();
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});

describe('a wrong answer', () => {
  it('corrects the player kindly and names the right answer', () => {
    const { at, onAnswer } = open();
    at('option-1').click();

    expect(onAnswer).toHaveBeenCalledWith(1, false);
    const feedback = at('question-feedback').textContent;
    expect(feedback).toContain('Not quite.');
    expect(feedback).toContain('The answer is: The monarch');
    expect(feedback).toContain('You will see this question again soon.');
  });

  it('marks both options with a shape and a word', () => {
    const { at } = open();
    at('option-1').click();

    expect(at('option-1').querySelector('[aria-hidden="true"]')?.textContent).toBe('✗');
    expect(at('option-1').textContent).toContain('Your answer');
    expect(at('option-0').querySelector('[aria-hidden="true"]')?.textContent).toBe('✓');
    expect(at('option-0').textContent).toContain('Correct answer');
  });

  it('shows no score, streak, life or penalty', () => {
    const { root } = open();
    root.byTestId('option-1')?.click();
    expect(root.textContent.toLowerCase()).not.toMatch(/score|streak|life|lives|penalty|point/);
  });

  it('never uses the words "wrong", "fail" or "error" about the player', () => {
    const { root } = open();
    root.byTestId('option-1')?.click();
    expect(root.textContent.toLowerCase()).not.toMatch(/\bwrong\b|\bfail\b|\berror\b/);
  });

  it('reads the result and the right answer into the live region', () => {
    const { at, announce } = open();
    at('option-2').click();
    expect(announce).toHaveBeenCalledWith('Not quite. The answer is: The monarch');
  });
});

describe('answering once, and only once', () => {
  it('ignores a second tap on another option', () => {
    const { at, onAnswer } = open();
    at('option-0').click();
    at('option-1').click();
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(at('question-feedback').textContent).toContain("That's right!");
  });

  it('ignores a double tap on the same option', () => {
    const { at, onAnswer } = open();
    at('option-2').click();
    at('option-2').click();
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  it('leaves every option readable after the answer', () => {
    /* `aria-disabled`, not `disabled`: the answer cannot change, but a screen
       reader or switch user must still be able to read the options back. */
    const { at } = open();
    at('option-0').click();
    for (let index = 0; index < 4; index += 1) {
      expect(at(`option-${String(index)}`).getAttribute('aria-disabled')).toBe('true');
      expect(at(`option-${String(index)}`).disabled).toBe(false);
    }
  });
});

describe('leaving the card', () => {
  it('closes on Escape without answering, and says it will come back', () => {
    const { root, card, onDismiss, onAnswer, announce, page } = open();
    press(root, 'Escape');

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onAnswer).not.toHaveBeenCalled();
    expect(card.visible).toBe(false);
    expect(announce).toHaveBeenCalledWith('No problem. We will ask again later.');
    expect(page.doc.byTestId('question-closed-notice')?.textContent).toBe(
      'No problem. We will ask again later.',
    );
  });

  it('closes on the Close button, and tells a HUD that wants to show the message', () => {
    const onNotice = vi.fn();
    const { at, onDismiss } = open(QUESTION, { onNotice });
    at('question-close').click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onNotice).toHaveBeenCalledWith('No problem. We will ask again later.');
  });

  it('cannot be dismissed twice, or by tapping past it', () => {
    const { root, card, onDismiss } = open();
    /* Nothing on the backdrop listens: a tap outside the card does nothing. */
    root.dispatchEvent(new FakeEvent('click'));
    expect(card.visible).toBe(true);

    press(root, 'Escape');
    press(root, 'Escape');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('clears the dismissal message when the next question arrives', () => {
    const { root, card, page } = open();
    press(root, 'Escape');
    card.present({ ...QUESTION, index: 1 });
    expect(page.doc.byTestId('question-closed-notice')?.hidden).toBe(true);
  });

  it('adds no second live region for the message', () => {
    /* One announcer, always: a second polite region is a well-known way to make
       a screen reader go quiet. */
    const { root, page } = open();
    press(root, 'Escape');
    expect(page.doc.querySelectorAll('[aria-live]').length).toBe(1);
  });
});

describe('moving through a set', () => {
  it('replaces the question and clears the previous feedback', () => {
    const { card, at, root } = open();
    at('option-0').click();
    card.present({ ...QUESTION, index: 1, prompt: 'What is the capital of Canada?' });

    expect(at('question-progress').textContent).toBe('Question 2 of 3');
    expect(root.byTestId('question-feedback')?.hidden).toBe(true);
    expect(root.byTestId('question-next')?.hidden).toBe(true);
    expect(card.answered).toBe(false);
  });

  it('announces the new progress', () => {
    const { card, announce } = open();
    card.present({ ...QUESTION, index: 1 });
    expect(announce).toHaveBeenCalledWith('Question 2 of 3');
  });
});

describe('a question with no explanation', () => {
  it('still shows the result and the right answer', () => {
    /* Built without the key rather than with `undefined`: `exactOptionalPropertyTypes`
       makes those two different things, and content that omits a field is the
       real case. */
    const { explanation: _omitted, ...noExplanation } = QUESTION;
    const { at, root } = open(noExplanation);
    at('option-1').click();
    expect(at('question-feedback').textContent).toContain('The answer is: The monarch');
    expect(root.byTestId('question-explanation')).toBeNull();
  });

  it('treats an empty explanation the same way', () => {
    const { root } = open({ ...QUESTION, explanation: '' });
    root.byTestId('option-0')?.click();
    expect(root.byTestId('question-explanation')).toBeNull();
  });
});

describe('French', () => {
  it('draws the card in French, with Canadian typography', () => {
    const { card, at, root } = open(FRENCH, { locale: 'fr' });
    expect(at('question-progress').textContent).toBe('Question 1 sur 3');
    expect(at('question-kind').textContent).toBe('Nouvelle');

    at('option-1').click();
    const feedback = at('question-feedback').textContent;
    expect(feedback).toContain('Pas tout à fait.');
    expect(feedback).toContain('La bonne réponse est : Le monarque');
    expect(feedback).toContain('Vous reverrez cette question bientôt.');
    expect(at('option-1').textContent).toContain('Votre réponse');
    expect(at('option-0').textContent).toContain('Bonne réponse');
    /* No space before "!" or "?" anywhere on the card. */
    expect(/\s[?!]/.test(root.textContent)).toBe(false);
    expect(card.answered).toBe(true);
  });

  it('says "C\'est exact!" for a right answer, with the French Next label', () => {
    const { at } = open(FRENCH, { locale: 'fr' });
    at('option-0').click();
    expect(at('question-feedback').textContent).toContain("C'est exact!");
    expect(at('question-next').textContent).toBe('Suivant');
  });

  it('switches language mid-question without losing the question or the answer', () => {
    const { card, at } = open();
    card.setLocale('fr');

    expect(at('question-progress').textContent).toBe('Question 1 sur 3');
    expect(at('question-prompt').textContent).toBe(QUESTION.prompt);

    at('option-1').click();
    card.setLocale('en');
    expect(at('question-feedback').textContent).toContain('Not quite.');
    expect(at('question-progress').textContent).toBe('Question 1 of 3');
  });
});

describe('the card before any question has arrived', () => {
  it('can change language without a question to redraw', () => {
    const page = buildPage();
    const card = createQuestionCard(page.host, { locale: 'en' });
    expect(() => card.setLocale('fr')).not.toThrow();
    expect(card.visible).toBe(false);
  });

  it('cannot be dismissed when it is not open', () => {
    const page = buildPage();
    const onDismiss = vi.fn();
    createQuestionCard(page.host, { locale: 'en', onDismiss });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('one switch', () => {
  it('moves through the options and answers with a long press', () => {
    const clock = { now: 0 };
    const page = buildPage();
    const announce = vi.fn();
    const onAnswer = vi.fn();
    const card = createQuestionCard(page.host, {
      locale: 'en',
      singleSwitch: true,
      holdMs: 600,
      now: () => clock.now,
      announce,
      onAnswer,
    });
    card.present(QUESTION);

    const tap = (heldMs: number): void => {
      page.doc.dispatchEvent(new FakeEvent('pointerdown'));
      clock.now += heldMs;
      page.doc.dispatchEvent(new FakeEvent('pointerup'));
    };

    /* The highlight starts on the first option and is announced as it moves. */
    tap(50);
    expect(announce).toHaveBeenCalledWith('The prime minister');

    tap(700);
    expect(onAnswer).toHaveBeenCalledWith(1, false);
  });

  it('answers nothing while the player does nothing', () => {
    const clock = { now: 0 };
    const page = buildPage();
    const onAnswer = vi.fn();
    const card = createQuestionCard(page.host, {
      locale: 'en',
      singleSwitch: true,
      holdMs: 600,
      now: () => clock.now,
      onAnswer,
    });
    card.present(QUESTION);

    /* Two minutes pass on the injected clock and nothing is dispatched. */
    clock.now += 120_000;
    expect(onAnswer).not.toHaveBeenCalled();
    expect(card.answered).toBe(false);
  });

  it('can be turned on and off while the card is open', () => {
    const { card, page } = open();
    card.setSingleSwitch(true, 500);
    expect(page.doc.listenerCount('pointerup')).toBe(1);
    card.setSingleSwitch(false);
    expect(page.doc.listenerCount('pointerup')).toBe(0);
  });
});

describe('the card leaving the page', () => {
  it('takes its dismissal message with it', () => {
    const { card, root, page } = open();
    press(root, 'Escape');
    card.destroy();
    expect(page.doc.byTestId('question-closed-notice')).toBeNull();
    expect(page.doc.byTestId('question-card')).toBeNull();
  });

  it('can be hidden without being dismissed', () => {
    const { card, onDismiss } = open();
    card.hide();
    expect(card.visible).toBe(false);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  /**
   * `TN-CARD`: "right and wrong are a word and a shape, never a colour."
   *
   * The fill is the third signal, and this suite proves it is only ever the
   * third: the mark and the words are on the same control, and the attribute the
   * stylesheet keys on carries no meaning of its own.
   */
  describe('an answered option', () => {
    it('marks the right answer and the one taken, and marks nothing else', () => {
      const { card, at } = open();
      at('option-2')?.click();

      expect(at('option-0')?.getAttribute('data-tn-answer')).toBe('correct');
      expect(at('option-2')?.getAttribute('data-tn-answer')).toBe('wrong');
      expect(at('option-1')?.getAttribute('data-tn-answer')).toBeNull();
      expect(at('option-3')?.getAttribute('data-tn-answer')).toBeNull();
      expect(card.answered).toBe(true);
    });

    it('carries the same meaning in words beside every fill', () => {
      const { at } = open();
      at('option-2')?.click();

      /* Deleting every colour rule leaves both of these on screen. */
      expect(at('option-0')?.textContent).toContain('Correct answer');
      expect(at('option-2')?.textContent).toContain('Your answer');
    });

    it('says nothing about right or wrong before the player has answered', () => {
      const { at } = open();
      for (const option of ['option-0', 'option-1', 'option-2', 'option-3']) {
        expect(at(option)?.getAttribute('data-tn-answer')).toBeNull();
      }
    });

    it('clears the marks when the next question arrives', () => {
      const { card, at } = open();
      at('option-2')?.click();
      card.present({ ...QUESTION, index: 1 });

      for (const option of ['option-0', 'option-1', 'option-2', 'option-3']) {
        expect(at(option)?.getAttribute('data-tn-answer')).toBeNull();
      }
    });
  });
});
