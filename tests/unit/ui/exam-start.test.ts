/**
 * `docs/stories/TN-EXAM-01`, `TN-EXAM-05`, `TN-TIMER-01`, `TN-ATTEMPT-03` and
 * `TN-ATTEMPT-04` — the screen in front of the exam.
 *
 * Structure and behaviour only. A 44 pt target, a label that does not clip at
 * 200 % and a contrast ratio cannot fail against the DOM double here; they are
 * asserted in `tests/a11y/` against real Chromium, where they can.
 */

import { describe, expect, it, vi } from 'vitest';

import { createExamStartScreen, type ExamStartState } from '@ui/exam-start';

import { buildPage, press, type FakeElement, type FakePage } from './support/fake-dom';

const READY: ExamStartState = {
  kind: 'ready',
  questionCount: 20,
  passMark: 15,
  timeLimitMs: 1_800_000,
};

interface Fixture {
  readonly page: FakePage;
  readonly screen: ReturnType<typeof createExamStartScreen>;
  readonly announce: ReturnType<typeof vi.fn>;
  readonly handlers: Record<string, ReturnType<typeof vi.fn>>;
  at(testId: string): FakeElement | null;
  textAt(testId: string): string;
  readonly texts: () => string;
}

function open(
  state: ExamStartState = READY,
  overrides: Partial<Parameters<typeof createExamStartScreen>[1]> = {},
): Fixture {
  const page = buildPage();
  const announce = vi.fn();
  const handlers = {
    onStart: vi.fn(),
    onContinue: vi.fn(),
    onNewExam: vi.fn(),
    onOpenStudy: vi.fn(),
    onRetry: vi.fn(),
    onBack: vi.fn(),
  };
  const screen = createExamStartScreen(page.host, {
    locale: 'en',
    announce,
    ...handlers,
    ...overrides,
  });
  screen.show(state);
  const at = (testId: string): FakeElement | null =>
    page.ui.querySelector(`[data-testid="${testId}"]`);
  return {
    page,
    screen,
    announce,
    handlers,
    at,
    textAt: (testId) => at(testId)?.textContent ?? '',
    texts: () => page.ui.textContent,
  };
}

describe('the exam start screen', () => {
  it('is a named dialog that says what the exam is before it starts', () => {
    const fixture = open();
    const root = fixture.at('exam-start');
    expect(root?.getAttribute('role')).toBe('dialog');
    expect(root?.getAttribute('aria-modal')).toBe('true');
    expect(root?.hidden).toBe(false);

    const texts = fixture.texts();
    expect(texts).toContain('Practice exam');
    expect(texts).toContain('This is a practice exam in the same shape as the real test.');
    expect(texts).toContain('The exam has 20 questions.');
    expect(texts).toContain('You need 15 out of 20 to pass.');
    expect(texts).toContain('You will see how you did at the end.');
    expect(texts).toContain('You can go back and change an answer before you finish.');
    expect(fixture.at('exam-begin')?.textContent).toBe('Start the exam');
  });

  it('takes its two numbers from the configuration, not from a string', () => {
    /* `TN-EXAM-01`: "a build whose exam.questionCount is 10 and whose passMark
       is 8 shows 'The exam has 10 questions.' and 'You need 8 out of 10 to
       pass.'" — which is only true if nobody wrote 20 anywhere. */
    const fixture = open({ ...READY, questionCount: 10, passMark: 8 });
    expect(fixture.texts()).toContain('The exam has 10 questions.');
    expect(fixture.texts()).toContain('You need 8 out of 10 to pass.');
    expect(fixture.texts()).not.toContain('20');
  });

  it('reads the exam length correctly at one, in both languages', () => {
    const fixture = open({ ...READY, questionCount: 1, passMark: 1 });
    expect(fixture.texts()).toContain('The exam has 1 question.');
    expect(fixture.texts()).not.toContain('1 questions');
    fixture.screen.setLocale('fr');
    expect(fixture.texts()).toContain("L'examen compte 1 question.");
    expect(fixture.texts()).not.toContain('1 questions');
  });

  it('starts the exam with the timer as the player left it', () => {
    const fixture = open();
    fixture.at('exam-begin')?.click();
    expect(fixture.handlers['onStart']).toHaveBeenCalledWith(false);
  });
});

describe('the timer switch', () => {
  it('is a switch with its state as a word, and starts off', () => {
    /* `TN-TIMER-01`: "it shows its state as On or Off as text … its state is not
       conveyed by position or colour alone". */
    const fixture = open();
    const toggle = fixture.at('exam-timer-toggle');
    expect(toggle?.getAttribute('role')).toBe('switch');
    expect(toggle?.getAttribute('aria-checked')).toBe('false');
    expect(toggle?.textContent).toContain('Use the timer');
    expect(toggle?.textContent).toContain('Off');
    expect(fixture.textAt('exam-timer-state')).toBe('No timer. Take as long as you like.');
  });

  it('says what the choice means, and shows the limit beside it', () => {
    const fixture = open();
    const toggle = fixture.at('exam-timer-toggle');
    const describedBy = toggle?.getAttribute('aria-describedby') ?? '';
    const help = fixture.page.ui.querySelector(`[id="${describedBy}"]`);
    expect(help?.textContent).toBe(
      'The real test has a time limit. With the timer off, you can take as long as you like.',
    );
    expect(fixture.textAt('exam-timer-limit')).toBe('30 minutes');
  });

  it('turns on, says so once, and drops the untimed sentence', () => {
    const fixture = open();
    fixture.at('exam-timer-toggle')?.click();
    expect(fixture.at('exam-timer-toggle')?.getAttribute('aria-checked')).toBe('true');
    expect(fixture.at('exam-timer-toggle')?.textContent).toContain('On');
    expect(fixture.at('exam-timer-state')?.hidden).toBe(true);
    expect(fixture.announce).toHaveBeenCalledWith('Use the timer: On', 'en');
    fixture.at('exam-begin')?.click();
    expect(fixture.handlers['onStart']).toHaveBeenCalledWith(true);
  });

  it('draws no clock, because no exam is running', () => {
    const fixture = open();
    fixture.at('exam-timer-toggle')?.click();
    expect(fixture.at('exam-clock')).toBeNull();
  });

  it('forgets the choice between attempts', () => {
    /* `TN-TIMER-01`: "the choice belongs to the attempt, not to the game …
       nothing has been remembered that I did not ask to be remembered". */
    const fixture = open();
    fixture.at('exam-timer-toggle')?.click();
    fixture.screen.hide();
    fixture.screen.show(READY);
    expect(fixture.at('exam-timer-toggle')?.getAttribute('aria-checked')).toBe('false');
    expect(fixture.screen.timed).toBe(false);
  });

  it('is French, and the limit reads correctly at one', () => {
    const fixture = open({ ...READY, timeLimitMs: 60_000 });
    fixture.screen.setLocale('fr');
    expect(fixture.at('exam-timer-toggle')?.textContent).toContain('Utiliser le chronomètre');
    expect(fixture.at('exam-timer-toggle')?.textContent).toContain('Désactivé');
    expect(fixture.textAt('exam-timer-limit')).toBe('1 minute');
    expect(fixture.textAt('exam-timer-state')).toBe(
      "Aucun chronomètre. Prenez tout le temps qu'il vous faut.",
    );
  });
});

describe('how much of the game the exam can cover', () => {
  it('says how many subjects are ready, and that more are coming', () => {
    const fixture = open({ ...READY, subjects: { ready: 1, total: 10 } });
    expect(fixture.textAt('exam-subjects')).toBe('Subjects ready: 1 of 10');
    expect(fixture.texts()).toContain('More are coming.');
    expect(fixture.texts()).toContain('This exam only asks about the subjects that are ready.');
  });

  it('stops promising more once there is no more', () => {
    const fixture = open({ ...READY, subjects: { ready: 10, total: 10 } });
    expect(fixture.texts()).not.toContain('More are coming.');
  });

  it('draws no line at all when the number cannot be derived', () => {
    /* `OQ-EXAM-5`: nothing in `content/` enumerates the ten subjects, and
       `TN-MAP-04`'s rule holds — a number this screen cannot derive is left out,
       never guessed and never drawn as a placeholder. */
    expect(open().at('exam-subjects')).toBeNull();
  });
});

describe('when the exam cannot run', () => {
  it('says so without an error, a number or an offer it cannot keep', () => {
    const fixture = open({ kind: 'not-ready' });
    expect(fixture.at('exam-not-ready')).not.toBeNull();
    expect(fixture.texts()).toContain('The exam is not ready yet');
    expect(fixture.texts()).toContain(
      'We are still writing the questions. You can practise in Study instead.',
    );
    expect(fixture.at('exam-begin')).toBeNull();
    expect(fixture.at('exam-study')?.textContent).toBe('Study');
    for (const word of ['error', 'failed', 'missing']) {
      expect(fixture.texts().toLowerCase()).not.toContain(word);
    }
    expect(fixture.texts()).not.toMatch(/\d/u);
  });

  it('offers a retry the bank could actually satisfy', () => {
    const fixture = open({ kind: 'error', message: 'We could not load the questions.' });
    expect(fixture.textAt('exam-error')).toBe('We could not load the questions.');
    fixture.at('exam-retry')?.click();
    expect(fixture.handlers['onRetry']).toHaveBeenCalledOnce();
  });

  it('can always be left', () => {
    const fixture = open({ kind: 'not-ready' });
    fixture.at('exam-back')?.click();
    expect(fixture.handlers['onBack']).toHaveBeenCalledOnce();
  });

  it('leaves on Escape too, without finishing anything', () => {
    const fixture = open();
    press(fixture.at('exam-start') as FakeElement, 'Escape');
    expect(fixture.handlers['onBack']).toHaveBeenCalledOnce();
  });
});

describe('an exam waiting to be finished', () => {
  const resuming: ExamStartState = {
    kind: 'resume',
    answered: 12,
    total: 20,
    remainingMs: 14 * 60_000,
  };

  it('shows the exam I have, not a new one', () => {
    const fixture = open(resuming);
    expect(fixture.at('exam-resume')).not.toBeNull();
    expect(fixture.texts()).toContain('You have an exam to finish');
    expect(fixture.textAt('exam-resume-progress')).toBe('Answers given: 12 of 20');
    expect(fixture.at('exam-continue')?.textContent).toBe('Carry on');
    expect(fixture.at('exam-new')?.textContent).toBe('Start a new exam');
    /* `TN-ATTEMPT-03`: "'Start the exam' is not offered". */
    expect(fixture.at('exam-begin')).toBeNull();
    expect(fixture.at('exam-timer-toggle')).toBeNull();
  });

  it('says how much time is left, and runs no clock while I read it', () => {
    const fixture = open(resuming);
    expect(fixture.textAt('exam-resume-time')).toBe('14 minutes left');
    expect(fixture.at('exam-clock')).toBeNull();
  });

  it('says nothing about time for an untimed attempt', () => {
    expect(open({ ...resuming, remainingMs: null }).at('exam-resume-time')).toBeNull();
  });

  it('announces the screen and how many answers I have given', () => {
    const fixture = open(resuming);
    expect(fixture.announce).toHaveBeenCalledWith(
      'You have an exam to finish Answers given: 12 of 20',
      'en',
    );
  });

  it('is French, with a space before the colon', () => {
    const fixture = open(resuming);
    fixture.screen.setLocale('fr');
    expect(fixture.texts()).toContain('Vous avez un examen à terminer');
    expect(fixture.textAt('exam-resume-progress')).toBe('Réponses données : 12 sur 20');
    expect(fixture.at('exam-continue')?.textContent).toBe('Reprendre');
    expect(fixture.at('exam-new')?.textContent).toBe('Commencer un nouvel examen');
  });

  it('asks the caller before anything is discarded', () => {
    const fixture = open(resuming);
    fixture.at('exam-new')?.click();
    /* The confirmation is the caller's — this screen only reports the request,
       so nothing here can discard an attempt by itself. */
    expect(fixture.handlers['onNewExam']).toHaveBeenCalledOnce();
    expect(fixture.at('exam-resume')).not.toBeNull();
  });
});

describe('an exam this build can no longer open', () => {
  it('says so plainly, and offers a new one', () => {
    const fixture = open({ kind: 'gone' });
    expect(fixture.texts()).toContain('We could not open your exam');
    expect(fixture.texts()).toContain(
      'Some of its questions are not in this version. You can start a new exam.',
    );
    expect(fixture.at('exam-new')).not.toBeNull();
    expect(fixture.at('exam-continue')).toBeNull();
    for (const word of ['error', 'failed']) {
      expect(fixture.texts().toLowerCase()).not.toContain(word);
    }
  });
});
