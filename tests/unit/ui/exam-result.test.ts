/**
 * `docs/stories/TN-RESULT-exam-results.md` — passing, not passing, results by
 * subject, and the review.
 *
 * The strongest assertions here are the negative ones: no percentage, no grade,
 * no streak, and no word that calls the player a failure. They are held over the
 * **whole rendered screen** rather than over one element, because the way that
 * rule breaks is a helpful sentence somebody adds beside the score.
 */

import { describe, expect, it, vi } from 'vitest';

import { createExamResult, type ExamResultView } from '@ui/exam-result';

import { buildPage, press, type FakeElement, type FakePage } from './support/fake-dom';

const OPTIONS = ['The monarch', 'The prime minister', 'The governor general', 'The speaker'];

const view = (patch: Partial<ExamResultView> = {}): ExamResultView => ({
  correct: 17,
  total: 20,
  passMark: 15,
  passed: true,
  timed: true,
  timeUp: false,
  unanswered: 0,
  subjects: [
    { id: 'elections', name: 'Federal elections', correct: 3, total: 5 },
    { id: 'government', name: 'How Canadians govern themselves', correct: 14, total: 15 },
  ],
  review: [
    {
      prompt: 'Who is the head of state of Canada?',
      options: OPTIONS,
      chosenIndex: 0,
      correctIndex: 0,
      explanation: 'Canada is a constitutional monarchy.',
    },
    {
      prompt: 'Who is the head of government?',
      options: OPTIONS,
      chosenIndex: 2,
      correctIndex: 1,
      explanation: 'The prime minister leads the government.',
    },
    { prompt: 'What is the capital?', options: OPTIONS, chosenIndex: null, correctIndex: 3 },
  ],
  ...patch,
});

interface Fixture {
  readonly page: FakePage;
  readonly result: ReturnType<typeof createExamResult>;
  readonly announce: ReturnType<typeof vi.fn>;
  readonly handlers: Record<string, ReturnType<typeof vi.fn>>;
  at(testId: string): FakeElement | null;
  textAt(testId: string): string;
  readonly texts: () => string;
}

function open(
  state: ExamResultView = view(),
  overrides: Partial<Parameters<typeof createExamResult>[1]> = {},
): Fixture {
  const page = buildPage();
  const announce = vi.fn();
  const handlers = { onPractise: vi.fn(), onAgain: vi.fn(), onClose: vi.fn() };
  const result = createExamResult(page.host, {
    locale: 'en',
    announce,
    ...handlers,
    ...overrides,
  });
  result.show(state);
  const at = (testId: string): FakeElement | null =>
    page.ui.querySelector(`[data-testid="${testId}"]`);
  return {
    page,
    result,
    announce,
    handlers,
    at,
    textAt: (testId) => at(testId)?.textContent ?? '',
    texts: () => page.ui.textContent,
  };
}

describe('passing', () => {
  it('says so first, with the count and the pass mark under it', () => {
    const fixture = open();
    expect(fixture.at('exam-result')?.hidden).toBe(false);
    expect(fixture.textAt('exam-result-verdict')).toBe('You passed');
    expect(fixture.textAt('exam-result-score')).toBe('Right answers: 17 out of 20');
    expect(fixture.textAt('exam-result-pass-mark')).toBe('You need 15 out of 20 to pass.');
  });

  it('names the screen with "Your exam" and draws no line above the verdict', () => {
    /*
     * `TN-RESULT-01` and `TN-RESULT-10`, reconciled by `TN-EXAMMENU`'s ruling 3.
     *
     * `exam.result.title` used to be a kicker over the `<h1>`, so a player who
     * did not pass read "Your exam" and *then* "Not this time" — a label sitting
     * above a verdict, which is a pause before bad news. The row is right and
     * the place was wrong: it is the **accessible name** `TN-RESULT-10`'s first
     * scenario has always required and never named, which costs no visible line
     * and is what a screen-reader user hears on arrival, before the live region
     * reads the verdict and the score.
     */
    const fixture = open();
    const root = fixture.at('exam-result');
    expect(root?.getAttribute('aria-label')).toBe('Your exam');
    expect(root?.getAttribute('aria-label')).not.toBe('');
    /* Not both: `aria-labelledby` would win and the name would silently become
       the verdict again. */
    expect(root?.getAttribute('aria-labelledby')).toBeNull();
    /* And nothing draws it. */
    expect(fixture.at('exam-result-title')).toBeNull();
    expect(fixture.texts()).not.toContain('Your exam');
  });

  it('puts the verdict first for the player who did not pass, too', () => {
    /* `TN-RESULT-02` is the case that decides it. */
    const fixture = open(view({ correct: 9, passed: false }));
    expect(fixture.textAt('exam-result-verdict')).toBe('Not this time');
    expect(fixture.texts().indexOf('Not this time')).toBe(0);
    expect(fixture.at('exam-result')?.getAttribute('aria-label')).toBe('Your exam');
  });

  it('names the screen in French, and still puts the verdict first', () => {
    const fixture = open();
    fixture.result.setLocale('fr');
    expect(fixture.at('exam-result')?.getAttribute('aria-label')).toBe('Votre examen');
    expect(fixture.textAt('exam-result-verdict')).toBe('Vous avez réussi');
    expect(fixture.texts()).not.toContain('Votre examen');
  });

  it('is a pass at exactly the pass mark', () => {
    expect(open(view({ correct: 15 })).textAt('exam-result-verdict')).toBe('You passed');
  });

  it('dresses no score up', () => {
    const texts = open().texts();
    expect(texts).not.toContain('%');
    for (const word of ['grade', 'star', 'streak', 'rank', 'badge', 'average', 'best']) {
      expect(texts.toLowerCase()).not.toContain(word);
    }
  });

  it('says which exam it was, without saying one is worth more', () => {
    expect(open().textAt('exam-result-timer')).toBe('You took this exam with the timer.');
    expect(open(view({ timed: false })).textAt('exam-result-timer')).toBe(
      'You took this exam without the timer.',
    );
  });

  it('reads the verdict and the score into the live region, once', () => {
    const fixture = open();
    expect(fixture.announce).toHaveBeenCalledTimes(1);
    expect(fixture.announce).toHaveBeenCalledWith(
      'You passed Right answers: 17 out of 20',
      'en',
    );
  });

  it('takes focus itself, so the first thing read is whether I passed', () => {
    const fixture = open();
    expect(fixture.page.doc.activeElement).toBe(fixture.at('exam-result-verdict'));
  });
});

describe('not passing', () => {
  const notPassed = view({ correct: 11, passed: false });

  it('says what happened, plainly and kindly', () => {
    const fixture = open(notPassed);
    expect(fixture.textAt('exam-result-verdict')).toBe('Not this time');
    expect(fixture.textAt('exam-result-score')).toBe('Right answers: 11 out of 20');
    expect(fixture.textAt('exam-result-pass-mark')).toBe('You need 15 out of 20 to pass.');
  });

  it('never calls the player a failure', () => {
    const texts = open(notPassed).texts().toLowerCase();
    for (const word of ['failed', 'fail', 'mistake']) {
      expect(texts).not.toContain(word);
    }
  });

  it('offers the next thing to do rather than a verdict', () => {
    const fixture = open(notPassed);
    expect(fixture.at('exam-result-practise')?.textContent).toBe(
      'Practise the questions you missed',
    );
    fixture.at('exam-result-practise')?.click();
    expect(fixture.handlers['onPractise']).toHaveBeenCalledOnce();
  });

  it('offers another exam without pushing it', () => {
    const fixture = open(notPassed);
    const again = fixture.at('exam-again');
    expect(again?.textContent).toBe('Try the exam again');
    expect(fixture.page.doc.activeElement).not.toBe(again);
    expect(again?.getAttribute('data-tn-action')).not.toBe('primary');
  });

  it('reads the same way at zero right as at eleven', () => {
    const fixture = open(view({ correct: 0, passed: false }));
    expect(fixture.textAt('exam-result-score')).toBe('Right answers: 0 out of 20');
    expect(fixture.textAt('exam-result-verdict')).toBe('Not this time');
  });

  it('offers no drill when nothing was missed', () => {
    /*
     * A control that opened a drill of nothing would be `TN-STUDY-03`'s defect,
     * so the caller supplies no handler and the control is not drawn — the same
     * rule every other control on this screen follows. Built without the option
     * rather than with `undefined`, because `exactOptionalPropertyTypes` makes
     * those two different things and only one of them is what a caller writes.
     */
    const page = buildPage();
    const result = createExamResult(page.host, { locale: 'en', onClose: () => undefined });
    result.show(view());
    expect(page.ui.querySelector('[data-testid="exam-result-practise"]')).toBeNull();
  });
});

describe('results by subject', () => {
  it('gives one row per subject the exam asked about, named as the map names it', () => {
    const fixture = open();
    expect(fixture.texts()).toContain('How you did, subject by subject');
    expect(fixture.textAt('subject-row-elections')).toBe('Federal elections: 3 out of 5');
    expect(fixture.at('subject-row-history')).toBeNull();
  });

  it('keeps a row\'s numbers when this build cannot name its subject', () => {
    /* `TN-RESULT-07`: "shown with the subject id left out rather than drawn raw",
       and no "TBD", no "???", no empty box. */
    const fixture = open(
      view({ subjects: [{ id: 'modern-canada', name: null, correct: 2, total: 4 }] }),
    );
    const row = fixture.at('subject-row-modern-canada');
    expect(row?.textContent).toBe('Right answers: 2 out of 4');
    expect(row?.textContent).not.toContain('modern-canada');
    for (const placeholder of ['TBD', '???']) {
      expect(fixture.texts()).not.toContain(placeholder);
    }
  });

  it('says how many questions nobody reached, agreeing with the number', () => {
    expect(open(view({ unanswered: 3 })).textAt('exam-result-unanswered')).toBe(
      'You did not answer 3 questions.',
    );
    const one = open(view({ unanswered: 1 }));
    expect(one.textAt('exam-result-unanswered')).toBe('You did not answer 1 question.');
    expect(one.texts()).not.toContain('1 questions');
  });

  it('says nothing about unanswered questions when there were none', () => {
    expect(open().at('exam-result-unanswered')).toBeNull();
  });
});

describe('running out of time', () => {
  it('says so, and is not a failure by itself', () => {
    const fixture = open(view({ timeUp: true, correct: 15, unanswered: 4 }));
    expect(fixture.at('exam-time-up')?.hidden).toBe(false);
    expect(fixture.texts()).toContain('Time is up');
    expect(fixture.texts()).toContain('We marked the questions you answered.');
    expect(fixture.textAt('exam-result-verdict')).toBe('You passed');
    expect(fixture.textAt('exam-result-score')).toBe('Right answers: 15 out of 20');
  });

  it('draws no such notice when the exam was finished on purpose', () => {
    expect(open().at('exam-time-up')?.hidden).toBe(true);
  });
});

describe('the review', () => {
  it('lists every question in the order it was asked', () => {
    const fixture = open();
    fixture.at('exam-result-review')?.click();
    expect(fixture.at('exam-review')?.hidden).toBe(false);
    expect(fixture.page.ui.querySelectorAll('[data-testid^="exam-review-item-"]')).toHaveLength(
      3,
    );
    expect(fixture.textAt('exam-review-item-0')).toContain('Who is the head of state of Canada?');
  });

  it('marks a right answer as both mine and the right one', () => {
    const fixture = open();
    fixture.at('exam-result-review')?.click();
    const item = fixture.textAt('exam-review-item-0');
    expect(item).toContain('Your answer');
    expect(item).toContain('Correct answer');
  });

  it('shows the right option, the explanation and the promise for one I got wrong', () => {
    const fixture = open();
    fixture.at('exam-result-review')?.click();
    const item = fixture.textAt('exam-review-item-1');
    expect(item).toContain('Your answer');
    expect(item).toContain('Correct answer');
    expect(item).toContain('Why: The prime minister leads the government.');
    expect(item).toContain('You will see this question again soon.');
  });

  it('says a question was not answered, and calls it nothing else', () => {
    const fixture = open();
    fixture.at('exam-result-review')?.click();
    const item = fixture.textAt('exam-review-item-2');
    expect(item).toContain('You did not answer this one.');
    expect(item).toContain('Correct answer');
    expect(item).not.toContain('Your answer');
    expect(item).not.toContain('You will see this question again soon.');
  });

  it('says so when a question has left the build, and keeps the score above it', () => {
    const fixture = open(
      view({
        review: [{ prompt: null, options: [], chosenIndex: null, correctIndex: 0 }],
      }),
    );
    fixture.at('exam-result-review')?.click();
    expect(fixture.textAt('exam-review-item-0')).toContain(
      'This question could not be shown.',
    );
    expect(fixture.textAt('exam-result-score')).toBe('Right answers: 17 out of 20');
  });

  it('offers exactly one control, so a switch user is never trapped in a list of twenty', () => {
    /* `TN-RESULT-09`: "the highlight reaches a control that leaves the review,
       without visiting every item first". The items are list items, not
       buttons, so the ring holds one thing. */
    const fixture = open();
    fixture.at('exam-result-review')?.click();
    const review = fixture.at('exam-review');
    expect(review?.querySelectorAll('button')).toHaveLength(1);
    expect(fixture.at('exam-review-back')?.textContent).toBe('Back');
  });

  it('returns to the result on Escape, in the state it was left in', () => {
    const fixture = open();
    fixture.at('exam-result-review')?.click();
    press(fixture.at('exam-review') as FakeElement, 'Escape');
    expect(fixture.at('exam-review')?.hidden).toBe(true);
    expect(fixture.at('exam-result')?.hidden).toBe(false);
    expect(fixture.textAt('exam-result-score')).toBe('Right answers: 17 out of 20');
  });
});

describe('leaving, and trying again', () => {
  it('can always be closed', () => {
    const fixture = open();
    fixture.at('exam-result-close')?.click();
    expect(fixture.handlers['onClose']).toHaveBeenCalledOnce();
  });

  it('goes back to the start screen rather than straight into another exam', () => {
    const fixture = open();
    fixture.at('exam-again')?.click();
    expect(fixture.handlers['onAgain']).toHaveBeenCalledOnce();
  });
});

describe('in French', () => {
  it('draws the verdict, the score and the rows in French, with a space before the colon', () => {
    const fixture = open();
    fixture.result.setLocale('fr');
    expect(fixture.textAt('exam-result-verdict')).toBe('Vous avez réussi');
    expect(fixture.textAt('exam-result-score')).toBe('Bonnes réponses : 17 sur 20');
    expect(fixture.textAt('exam-result-pass-mark')).toBe('Il faut 15 sur 20 pour réussir.');
    expect(fixture.texts()).toContain('Vos résultats par sujet');
    expect(fixture.textAt('subject-row-elections')).toBe('Federal elections : 3 sur 5');
  });

  it('keeps the numbers when the language changes', () => {
    const fixture = open(view({ correct: 11, passed: false }));
    fixture.result.setLocale('fr');
    expect(fixture.textAt('exam-result-verdict')).toBe('Pas cette fois');
    expect(fixture.textAt('exam-result-score')).toBe('Bonnes réponses : 11 sur 20');
    expect(fixture.at('exam-result-practise')?.textContent).toBe('Réviser les questions manquées');
  });

  it('agrees with its number in the unanswered line', () => {
    const one = open(view({ unanswered: 1 }));
    one.result.setLocale('fr');
    expect(one.textAt('exam-result-unanswered')).toBe(
      "Vous n'avez pas répondu à 1 question.",
    );
    expect(one.texts()).not.toContain('1 questions');
  });

  it('draws the review in French', () => {
    const fixture = open();
    fixture.result.setLocale('fr');
    fixture.at('exam-result-review')?.click();
    expect(fixture.textAt('exam-review-item-2')).toContain(
      "Vous n'avez pas répondu à celle-ci.",
    );
    expect(fixture.textAt('exam-review-item-1')).toContain('Vous reverrez cette question bientôt.');
    expect(fixture.textAt('exam-review-item-0')).toContain('Votre réponse');
    expect(fixture.textAt('exam-review-item-0')).toContain('Bonne réponse');
  });
});
