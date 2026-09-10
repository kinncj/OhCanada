/**
 * `docs/stories/TN-EXAM-03`, `TN-EXAM-04`, `TN-EXAM-06`, `TN-EXAM-08`,
 * `TN-TIMER-02`, `TN-TIMER-03`, `TN-TIMER-04` and `TN-ATTEMPT-05` — the running
 * exam.
 *
 * The clock here is a stub with the same shape as `app/ui/exam-clock.ts`: this
 * suite is about what the screen *draws* and what it *tells* the clock, and the
 * clock's own arithmetic has its own file. What is proved here that cannot be
 * proved there is that a menu, a confirmation and a hidden tab all pause it, and
 * that closing one of three does not start it again.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { CHOSEN_GLYPH, UNCHOSEN_GLYPH } from '@ui/dom';

import type { ExamClock, ExamClockPhase } from '@ui/exam-clock';
import {
  createExamScreen,
  type ExamQuestionView,
  type ExamTimerView,
} from '@ui/exam-screen';

import { buildPage, press, type FakeElement, type FakePage } from './support/fake-dom';

const OPTIONS = ['The monarch', 'The prime minister', 'The governor general', 'The speaker'];

/** A stub with the clock's shape and none of its arithmetic. */
function stubClock(): ExamClock & { readonly calls: () => readonly string[] } {
  const calls: string[] = [];
  let phase: ExamClockPhase = 'paused';
  return {
    calls: () => [...calls],
    get phase(): ExamClockPhase {
      return phase;
    },
    remainingMs: 20 * 60_000,
    get on(): boolean {
      return phase === 'running' || phase === 'paused';
    },
    start(): void {
      calls.push('start');
      phase = 'paused';
    },
    pause(): void {
      calls.push('pause');
      phase = 'paused';
    },
    resume(): void {
      calls.push('resume');
      phase = 'running';
    },
    stop(): void {
      calls.push('stop');
      phase = 'off';
    },
    destroy(): void {
      calls.push('destroy');
    },
  };
}

interface Fixture {
  readonly page: FakePage;
  readonly screen: ReturnType<typeof createExamScreen>;
  readonly announce: ReturnType<typeof vi.fn>;
  readonly handlers: Record<string, ReturnType<typeof vi.fn>>;
  readonly chosen: (number | null)[];
  readonly setTimer: (view: ExamTimerView) => void;
  readonly hide: (hidden: boolean) => void;
  at(testId: string): FakeElement | null;
  textAt(testId: string): string;
  readonly texts: () => string;
}

function open(
  total = 3,
  overrides: Partial<Parameters<typeof createExamScreen>[1]> = {},
): Fixture {
  const page = buildPage();
  const announce = vi.fn();
  const chosen: (number | null)[] = Array.from({ length: total }, () => null);
  let timer: ExamTimerView = { kind: 'none' };
  let hidden = false;
  const listeners: (() => void)[] = [];

  const handlers = {
    onFinish: vi.fn(),
    onLeave: vi.fn(),
    onOpenSettings: vi.fn(),
    onStopTimer: vi.fn(),
    onMove: vi.fn(),
  };

  const question = (index: number): ExamQuestionView | null =>
    index < 0 || index >= total
      ? null
      : {
          index,
          total,
          prompt: `Question ${String(index + 1)} wording`,
          options: OPTIONS,
          chosenIndex: chosen[index] ?? null,
        };

  const screen = createExamScreen(page.host, {
    locale: 'en',
    announce,
    question,
    answered: () => chosen.filter((value) => value !== null).length,
    unanswered: () => chosen.flatMap((value, index) => (value === null ? [index] : [])),
    timer: () => timer,
    onChoose: (index, chosenIndex) => {
      chosen[index] = chosenIndex;
    },
    visibility: {
      hidden: () => hidden,
      subscribe: (listener) => {
        listeners.push(listener);
        return () => undefined;
      },
    },
    ...handlers,
    ...overrides,
  });
  screen.show(0);

  const at = (testId: string): FakeElement | null =>
    page.ui.querySelector(`[data-testid="${testId}"]`);

  return {
    page,
    screen,
    announce,
    handlers,
    chosen,
    setTimer: (view) => {
      timer = view;
      screen.refresh();
    },
    hide: (next) => {
      hidden = next;
      for (const listener of [...listeners]) listener();
    },
    at,
    textAt: (testId) => at(testId)?.textContent ?? '',
    texts: () => page.ui.textContent,
  };
}

describe('a question in an exam', () => {
  it('is a named region inside the exam screen, with the wording as its description', () => {
    const fixture = open();
    expect(fixture.at('exam-screen')?.getAttribute('role')).toBe('dialog');
    const card = fixture.at('question-card');
    expect(card).not.toBeNull();
    const name = fixture.page.ui.querySelector(
      `[id="${card?.getAttribute('aria-labelledby') ?? ''}"]`,
    );
    expect(name?.textContent).toBe('Question 1 of 3');
    const described = fixture.page.ui.querySelector(
      `[id="${card?.getAttribute('aria-describedby') ?? ''}"]`,
    );
    expect(described?.textContent).toBe('Question 1 wording');
  });

  it("shows four options and none of the level card's teaching", () => {
    const fixture = open();
    expect(fixture.page.ui.querySelectorAll('[data-testid^="option-"]')).toHaveLength(4);
    /* `TN-EXAM-03`: the exam card shows no kind tag, no feedback and no
       explanation, and nothing on it says whether the answer was right. */
    expect(fixture.at('question-kind')).toBeNull();
    expect(fixture.at('question-feedback')).toBeNull();
    expect(fixture.at('question-explanation')).toBeNull();
  });

  it('counts answers given, not questions seen', () => {
    const fixture = open();
    expect(fixture.textAt('exam-progress')).toBe('Answers given: 0 of 3');
    fixture.at('option-1')?.click();
    expect(fixture.textAt('exam-progress')).toBe('Answers given: 1 of 3');
    fixture.at('exam-next')?.click();
    expect(fixture.textAt('exam-progress')).toBe('Answers given: 1 of 3');
  });
});

describe('answering', () => {
  it('records the answer, marks it with a word and a shape, and says nothing about being right', () => {
    const fixture = open();
    fixture.at('option-2')?.click();
    expect(fixture.chosen[0]).toBe(2);
    const chosenOption = fixture.at('option-2');
    expect(chosenOption?.getAttribute('aria-pressed')).toBe('true');
    expect(chosenOption?.textContent).toContain('Your answer');
    expect(chosenOption?.textContent).toContain(CHOSEN_GLYPH);
    expect(fixture.announce).toHaveBeenCalledWith(
      'Your answer: The governor general',
      'en',
    );
    for (const word of ['right', 'wrong', 'correct']) {
      expect(fixture.texts().toLowerCase()).not.toContain(word.toLowerCase());
    }
  });

  it('moves the focus to Next and moves the exam nowhere', () => {
    const fixture = open();
    fixture.at('option-2')?.click();
    expect(fixture.page.doc.activeElement).toBe(fixture.at('exam-next'));
    expect(fixture.textAt('question-progress')).toBe('Question 1 of 3');
  });

  it('moves the focus to Finish on the last question, never onto a disabled control', () => {
    const fixture = open();
    fixture.screen.goTo(2);
    fixture.at('option-0')?.click();
    expect(fixture.page.doc.activeElement).toBe(fixture.at('exam-finish'));
  });

  it('lets an answer be changed, and keeps exactly one', () => {
    const fixture = open();
    fixture.at('option-2')?.click();
    fixture.at('option-0')?.click();
    expect(fixture.chosen[0]).toBe(0);
    expect(fixture.at('option-0')?.getAttribute('aria-pressed')).toBe('true');
    expect(fixture.at('option-2')?.getAttribute('aria-pressed')).toBe('false');
    expect(
      fixture.page.ui
        .querySelectorAll('[data-testid^="option-"]')
        .filter((option) => option.getAttribute('aria-pressed') === 'true'),
    ).toHaveLength(1);
  });
});

describe('moving through the exam', () => {
  it('keeps the answer when I come back', () => {
    const fixture = open();
    fixture.at('option-1')?.click();
    fixture.at('exam-next')?.click();
    expect(fixture.textAt('question-progress')).toBe('Question 2 of 3');
    fixture.at('exam-previous')?.click();
    expect(fixture.textAt('question-progress')).toBe('Question 1 of 3');
    expect(fixture.at('option-1')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('marks the ends of the exam as ends', () => {
    const fixture = open();
    expect(fixture.at('exam-previous')?.getAttribute('aria-disabled')).toBe('true');
    expect(fixture.at('exam-next')?.getAttribute('aria-disabled')).toBe('false');
    fixture.screen.goTo(2);
    expect(fixture.at('exam-next')?.getAttribute('aria-disabled')).toBe('true');
    expect(fixture.at('exam-finish')).not.toBeNull();
  });

  it('lets a question be skipped, and says so when I come back to it', () => {
    const fixture = open();
    fixture.at('exam-next')?.click();
    expect(fixture.chosen[0]).toBeNull();
    fixture.at('exam-previous')?.click();
    expect(fixture.announce).toHaveBeenCalledWith('Question 1 of 3 Not answered yet', 'en');
  });

  it('announces the question and whether it has been answered', () => {
    const fixture = open();
    fixture.at('option-0')?.click();
    fixture.at('exam-next')?.click();
    expect(fixture.announce).toHaveBeenCalledWith('Question 2 of 3 Not answered yet', 'en');
    fixture.at('exam-previous')?.click();
    expect(fixture.announce).toHaveBeenCalledWith(
      'Question 1 of 3 Your answer: The monarch',
      'en',
    );
  });
});

describe('finishing', () => {
  it('finishes at once when everything is answered', () => {
    const fixture = open(1);
    fixture.at('option-0')?.click();
    fixture.at('exam-finish')?.click();
    expect(fixture.handlers['onFinish']).toHaveBeenCalledOnce();
    expect(fixture.at('exam-unanswered')?.hidden).not.toBe(false);
  });

  it('asks first when questions are unanswered, and agrees with its number', () => {
    const fixture = open(3);
    fixture.at('option-0')?.click();
    fixture.at('exam-finish')?.click();
    const dialog = fixture.at('exam-unanswered');
    expect(dialog?.hidden).toBe(false);
    expect(dialog?.getAttribute('role')).toBe('alertdialog');
    expect(dialog?.textContent).toContain('You have not answered 2 questions.');
    expect(fixture.handlers['onFinish']).not.toHaveBeenCalled();
  });

  it('reads correctly at one', () => {
    const fixture = open(2);
    fixture.at('option-0')?.click();
    fixture.at('exam-finish')?.click();
    expect(fixture.at('exam-unanswered')?.textContent).toContain(
      'You have not answered 1 question.',
    );
    expect(fixture.at('exam-unanswered')?.textContent).not.toContain('1 questions');
  });

  it('goes to the first question I skipped', () => {
    const fixture = open(3);
    fixture.screen.goTo(2);
    fixture.at('option-0')?.click();
    fixture.at('exam-finish')?.click();
    fixture.at('exam-go-unanswered')?.click();
    expect(fixture.textAt('question-progress')).toBe('Question 1 of 3');
    expect(fixture.handlers['onFinish']).not.toHaveBeenCalled();
  });

  it('finishes anyway when asked to', () => {
    const fixture = open(3);
    fixture.at('exam-finish')?.click();
    fixture.at('exam-finish-anyway')?.click();
    expect(fixture.handlers['onFinish']).toHaveBeenCalledOnce();
  });

  it('returns to the questions on Escape', () => {
    const fixture = open(3);
    fixture.at('exam-finish')?.click();
    press(fixture.at('exam-unanswered') as FakeElement, 'Escape');
    expect(fixture.handlers['onFinish']).not.toHaveBeenCalled();
  });
});

describe('the exam clock, as this screen draws it', () => {
  it('is text, in whole minutes, and is not a bar', () => {
    const fixture = open();
    fixture.setTimer({ kind: 'running', remainingMs: 30 * 60_000, paused: false });
    expect(fixture.textAt('exam-clock-time')).toBe('30 minutes left');
    expect(fixture.at('exam-clock')?.hidden).toBe(false);
    expect(fixture.at('exam-clock')?.getAttribute('role')).toBeNull();
    expect(fixture.at('exam-clock')?.getAttribute('aria-live')).toBeNull();
  });

  it('is not present at all in an untimed exam, which says so instead', () => {
    /* `TN-TIMER-02` and `TN-TIMER-06`. */
    const fixture = open();
    expect(fixture.at('exam-clock')?.hidden).toBe(true);
    expect(fixture.textAt('exam-untimed')).toBe('No timer. Take as long as you like.');
  });

  it('shows the pause as a word, with the time left still under it', () => {
    const fixture = open();
    fixture.setTimer({ kind: 'running', remainingMs: 20 * 60_000, paused: true });
    expect(fixture.textAt('exam-clock-paused')).toBe('Timer paused');
    expect(fixture.textAt('exam-clock-time')).toBe('20 minutes left');
  });

  it('says the timer is off, not that there never was one, after it is stopped', () => {
    const fixture = open();
    fixture.setTimer({ kind: 'stopped' });
    expect(fixture.textAt('exam-untimed')).toBe(
      'The timer is off. You can take as long as you like.',
    );
    expect(fixture.at('exam-clock')?.hidden).toBe(true);
  });

  it('takes no focus and is in no tab order', () => {
    const fixture = open();
    fixture.setTimer({ kind: 'running', remainingMs: 60_000, paused: false });
    expect(fixture.at('exam-clock')?.getAttribute('tabindex')).toBeNull();
  });
});

describe('pausing the clock whenever the player is not answering', () => {
  const timed = (): Partial<Parameters<typeof createExamScreen>[1]> => ({});

  it('pauses for the menu and carries on when it closes', () => {
    const clock = stubClock();
    const fixture = open(3, { ...timed(), clock });
    fixture.at('exam-menu-button')?.click();
    expect(clock.calls()).toContain('pause');
    fixture.at('exam-menu-close')?.click();
    expect(clock.calls().at(-1)).toBe('resume');
  });

  it('pauses for a confirmation', () => {
    const clock = stubClock();
    const fixture = open(3, { clock });
    fixture.at('exam-finish')?.click();
    expect(clock.calls()).toContain('pause');
  });

  it('pauses for a hidden tab and carries on when it comes back', () => {
    const clock = stubClock();
    const fixture = open(3, { clock });
    fixture.hide(true);
    expect(clock.calls()).toContain('pause');
    fixture.hide(false);
    expect(clock.calls().at(-1)).toBe('resume');
  });

  it('does not start the clock while a second screen is still over the exam', () => {
    /*
     * The reason the pause is a set of reasons rather than a boolean: Settings
     * opens from the exam's menu, so the menu closing must not start the clock
     * under the settings screen (`TN-TIMER-03`).
     */
    const clock = stubClock();
    const fixture = open(3, { clock });
    fixture.screen.pause('settings');
    fixture.at('exam-menu-button')?.click();
    fixture.at('exam-menu-close')?.click();
    expect(clock.calls()).not.toContain('resume');
    fixture.screen.resume('settings');
    expect(clock.calls().at(-1)).toBe('resume');
  });
});

describe("the exam's menu", () => {
  it('offers Settings, the timer, leaving and a way back', () => {
    const clock = stubClock();
    const fixture = open(3, { clock });
    fixture.setTimer({ kind: 'running', remainingMs: 60_000, paused: false });
    fixture.at('exam-menu-button')?.click();
    expect(fixture.at('exam-menu')?.hidden).toBe(false);
    expect(fixture.at('exam-menu-settings')?.textContent).toBe('Settings');
    expect(fixture.at('exam-timer-stop')?.textContent).toBe('Turn the timer off');
    expect(fixture.at('exam-leave')?.textContent).toBe('Leave the exam');
    expect(fixture.at('exam-menu-close')).not.toBeNull();
  });

  it('offers no way to turn a timer on', () => {
    const fixture = open();
    fixture.at('exam-menu-button')?.click();
    expect(fixture.at('exam-timer-stop')).toBeNull();
    expect(fixture.texts()).not.toContain('Use the timer');
  });

  it('turns the timer off once, and offers nothing to turn it back on', () => {
    /* `TN-TIMER-04` and `TN-SET-05`: the escape hatch. */
    const clock = stubClock();
    let view: ExamTimerView = { kind: 'running', remainingMs: 12 * 60_000, paused: false };
    const fixture = open(3, {
      clock,
      timer: () => view,
      onStopTimer: () => {
        view = { kind: 'stopped' };
      },
    });
    fixture.at('exam-menu-button')?.click();
    fixture.at('exam-timer-stop')?.click();
    expect(fixture.at('exam-clock')?.hidden).toBe(true);
    expect(fixture.announce).toHaveBeenCalledWith(
      'The timer is off. You can take as long as you like.',
      'en',
    );
    fixture.at('exam-menu-button')?.click();
    expect(fixture.at('exam-timer-stop')).toBeNull();
    expect(fixture.handlers['onFinish']).not.toHaveBeenCalled();
  });

  it('promises the exam is saved, and says the opposite when it is not', () => {
    const fixture = open();
    fixture.at('exam-menu-button')?.click();
    expect(fixture.textAt('exam-menu-promise')).toBe(
      'Your exam is saved. You can finish it later.',
    );
    fixture.screen.setStorageBlocked(true);
    expect(fixture.textAt('exam-menu-promise')).toBe(
      'This browser is not saving your progress, so leaving will end this exam.',
    );
  });

  it('leaves without asking when there is nothing to lose', () => {
    const fixture = open();
    fixture.at('exam-menu-button')?.click();
    fixture.at('exam-leave')?.click();
    expect(fixture.handlers['onLeave']).toHaveBeenCalledOnce();
    expect(fixture.at('exam-leave-confirm')?.hidden).not.toBe(false);
  });

  it('asks first when leaving really would end the exam', () => {
    const fixture = open(3, { storageBlocked: true });
    fixture.at('exam-menu-button')?.click();
    fixture.at('exam-leave')?.click();
    const dialog = fixture.at('exam-leave-confirm');
    expect(dialog?.hidden).toBe(false);
    expect(dialog?.textContent).toContain('Leave and lose this exam?');
    expect(fixture.handlers['onLeave']).not.toHaveBeenCalled();
    fixture.at('exam-leave-stay')?.click();
    expect(fixture.handlers['onLeave']).not.toHaveBeenCalled();
    expect(fixture.page.doc.activeElement).toBe(fixture.at('question-progress'));
  });

  it('is reached by Escape, which throws nothing away', () => {
    const fixture = open();
    fixture.at('option-0')?.click();
    press(fixture.at('exam-screen') as FakeElement, 'Escape');
    expect(fixture.at('exam-menu')?.hidden).toBe(false);
    expect(fixture.chosen[0]).toBe(0);
    expect(fixture.handlers['onFinish']).not.toHaveBeenCalled();
  });
});

/**
 * `docs/stories/TN-EXAMMENU-the-exam-menu-and-the-chosen-answer.md` — the two
 * defects that file rules on, each with the gate that stops it coming back.
 *
 * This block is written as a gate rather than as a single assertion because both
 * defects were invisible to the suite that shipped them: the exam drew the HUD's
 * two keys and a test that could not tell the menus apart passed, and the exam
 * drew a tick beside a chosen answer and the test asserting "a word and a shape"
 * asserted the shape it happened to find.
 */
describe('TN-EXAMMENU-06 — the chosen option says recorded, never right', () => {
  const TICK = '\u2713';
  const CROSS = '\u2717';
  const VERDICT_GLYPHS = [TICK, CROSS, '\u2714', '\u2718', '\u274C', '\u2705'];

  /** Every character a running exam draws, in every state it can be in. */
  const everythingDrawn = (fixture: Fixture): string => {
    const seen: string[] = [];
    /* Unanswered, answered, answer changed, moved away and back, menu open,
       timed and untimed — the states a tick could hide in. */
    seen.push(fixture.texts());
    fixture.at('option-2')?.click();
    seen.push(fixture.texts());
    fixture.at('option-0')?.click();
    seen.push(fixture.texts());
    fixture.at('exam-next')?.click();
    seen.push(fixture.texts());
    fixture.at('exam-previous')?.click();
    seen.push(fixture.texts());
    fixture.setTimer({ kind: 'running', remainingMs: 60_000, paused: false });
    seen.push(fixture.texts());
    fixture.at('exam-menu-button')?.click();
    seen.push(fixture.texts());
    fixture.at('exam-menu-close')?.click();
    seen.push(fixture.texts());
    return seen.join('\n');
  };

  it('marks the chosen option with a neutral filled indicator, never a tick', () => {
    const fixture = open();
    fixture.at('option-2')?.click();
    const chosenOption = fixture.at('option-2');
    expect(chosenOption?.textContent).toContain('Your answer');
    expect(chosenOption?.textContent).toContain(CHOSEN_GLYPH);
    expect(chosenOption?.textContent).not.toContain(TICK);
    expect(chosenOption?.textContent).not.toContain(CROSS);
  });

  it('differs from an unchosen option by fill and not by symbol', () => {
    /* `OQ-EXAMMENU-5`'s recommendation, taken: the radio pattern. Two fills of
       one shape, so no symbol in a running exam carries a verdict. */
    const fixture = open();
    fixture.at('option-2')?.click();
    const marks = fixture.page.ui.querySelectorAll('[data-tn-chosen]');
    expect(marks).toHaveLength(4);
    const filled = marks.filter((node) => node.getAttribute('data-tn-chosen') === 'true');
    expect(filled).toHaveLength(1);
    expect(filled[0]?.textContent).toBe(CHOSEN_GLYPH);
    for (const node of marks) {
      if (node.getAttribute('data-tn-chosen') === 'true') continue;
      expect(node.textContent).toBe(UNCHOSEN_GLYPH);
    }
    /* One shape, two fills: both are circles, and neither is a symbol the other
       is not. */
    expect(CHOSEN_GLYPH).not.toBe(UNCHOSEN_GLYPH);
    /* The mark is the shape; the word is what a screen reader is given. */
    for (const node of marks) expect(node.getAttribute('aria-hidden')).toBe('true');
  });

  it('nothing about the mark differs between a right answer and a wrong one', () => {
    /* The screen is never told which option is right, so it cannot draw a
       difference — asserted rather than assumed, because the way a verdict gets
       onto this screen is a caller learning how to tell it. */
    const first = open();
    first.at('option-0')?.click();
    const second = open();
    second.at('option-3')?.click();
    const without = (text: string | undefined, wording: string): string =>
      (text ?? '').replace(wording, '');
    expect(without(first.at('option-0')?.textContent, OPTIONS[0] ?? '')).toBe(
      without(second.at('option-3')?.textContent, OPTIONS[3] ?? ''),
    );
    expect(first.at('option-0')?.getAttribute('aria-pressed')).toBe(
      second.at('option-3')?.getAttribute('aria-pressed'),
    );
  });

  it('draws no tick and no cross anywhere in a running exam, in either language', () => {
    for (const locale of ['en', 'fr'] as const) {
      const fixture = open();
      if (locale === 'fr') fixture.screen.setLocale('fr');
      const drawn = everythingDrawn(fixture);
      for (const glyph of VERDICT_GLYPHS) {
        expect(
          drawn.includes(glyph),
          `a running exam drew "${glyph}" (${locale}): TN-EXAMMENU-06`,
        ).toBe(false);
      }
    }
  });

  it('fails a build whose source reaches for a tick or a cross at all', () => {
    /*
     * The half a rendered state cannot prove: a tick behind a branch this suite
     * does not walk is still a tick a player can meet. `exam.noFeedback` printed
     * the promise on the start screen, so the exam screen may not hold the glyph
     * at all — and the story asks for a build that draws one to fail, not for a
     * scenario that happens to catch one.
     */
    const source = readFileSync(new URL('../../../app/ui/exam-screen.ts', import.meta.url), 'utf8');
    for (const glyph of VERDICT_GLYPHS) {
      expect(
        source.includes(glyph),
        `app/ui/exam-screen.ts contains "${glyph}": TN-EXAMMENU-06`,
      ).toBe(false);
    }
  });

  it('keeps the complementary word for a question with no answer', () => {
    /* `exam.notAnsweredYet`, and no option marked. The pair a player meets
       inside an exam is "Your answer" / "Not answered yet". */
    const fixture = open();
    expect(fixture.texts()).not.toContain('Your answer');
    const marks = fixture.page.ui.querySelectorAll('[data-tn-chosen="true"]');
    expect(marks).toHaveLength(0);
  });

  it('marks the chosen option in French without a verdict in it', () => {
    const fixture = open();
    fixture.screen.setLocale('fr');
    fixture.at('option-2')?.click();
    const chosenOption = fixture.at('option-2');
    expect(chosenOption?.textContent).toContain('Votre réponse');
    expect(chosenOption?.textContent).not.toContain('Votre choix');
    expect(chosenOption?.textContent).toContain(CHOSEN_GLYPH);
  });
});

describe("TN-EXAMMENU-01 — the exam's menu is the exam's", () => {
  it('draws its own two rows, and never the HUD\'s', () => {
    const fixture = open();
    expect(fixture.at('exam-menu-button')?.textContent).toBe('Menu');
    fixture.at('exam-menu-button')?.click();
    const menu = fixture.at('exam-menu');
    expect(menu?.hidden).toBe(false);
    const name = fixture.page.ui.querySelector(
      `[id="${menu?.getAttribute('aria-labelledby') ?? ''}"]`,
    );
    /* The control matches `hud.menu` word for word; the **dialog's name** is
       where the two menus have to differ, because it is what a screen reader
       announces on entry. */
    expect(name?.textContent).toBe('Exam menu');
    expect(name?.textContent).not.toBe('Menu');
  });

  it('is named in French, and offers no way out of a level', () => {
    const fixture = open();
    fixture.screen.setLocale('fr');
    expect(fixture.at('exam-menu-button')?.textContent).toBe('Menu');
    fixture.at('exam-menu-button')?.click();
    const menu = fixture.at('exam-menu');
    const name = fixture.page.ui.querySelector(
      `[id="${menu?.getAttribute('aria-labelledby') ?? ''}"]`,
    );
    expect(name?.textContent).toBe("Menu de l'examen");
    expect(fixture.texts()).not.toContain('Quitter le niveau');
  });

  it("never draws the level menu's testids, and never reads the HUD's keys", () => {
    /*
     * `TN-EXAMMENU-02`: the two menus cannot be confused. The testids are
     * deliberately not `menu-button` and `menu` — a test that could not tell
     * them apart is the test that passed while the exam drew the level's.
     */
    const fixture = open();
    fixture.at('exam-menu-button')?.click();
    expect(fixture.at('menu-button')).toBeNull();
    expect(fixture.at('menu')).toBeNull();
    expect(fixture.texts()).not.toContain('Leave the level');

    const source = readFileSync(new URL('../../../app/ui/exam-screen.ts', import.meta.url), 'utf8');
    for (const key of ["'hud.menu'", "'hud.menu.title'"]) {
      expect(
        source.includes(key),
        `app/ui/exam-screen.ts reads ${key}, which is TN-HUD's: TN-EXAMMENU-02`,
      ).toBe(false);
    }
  });
});

describe('a question this build has lost', () => {
  it('is shown as unanswered, with one sentence and no error card', () => {
    /* `TN-EXAM-05`: "the exam does not end … the failure is not shown as an
       error card over the exam". */
    const fixture = open(2, {
      question: (index) =>
        index === 0
          ? { index, total: 2, prompt: '', options: [], chosenIndex: null, unavailable: true }
          : { index, total: 2, prompt: 'Fine', options: OPTIONS, chosenIndex: null },
    });
    expect(fixture.textAt('question-prompt')).toBe('This question could not be shown.');
    expect(fixture.page.ui.querySelectorAll('[data-testid^="option-"]')).toHaveLength(0);
    expect(fixture.at('exam-screen')?.hidden).toBe(false);
  });
});

describe('in French', () => {
  it('draws the controls and the counts in French', () => {
    const fixture = open();
    fixture.screen.setLocale('fr');
    expect(fixture.textAt('question-progress')).toBe('Question 1 sur 3');
    expect(fixture.at('exam-previous')?.textContent).toBe('Précédent');
    expect(fixture.at('exam-next')?.textContent).toBe('Suivant');
    expect(fixture.at('exam-finish')?.textContent).toBe("Terminer l'examen");
    expect(fixture.textAt('exam-progress')).toBe('Réponses données : 0 sur 3');
  });

  it('keeps the exam and the answers through a language change', () => {
    const fixture = open();
    fixture.at('option-1')?.click();
    fixture.screen.setLocale('fr');
    expect(fixture.chosen[0]).toBe(1);
    expect(fixture.at('option-1')?.getAttribute('aria-pressed')).toBe('true');
    expect(fixture.at('option-1')?.textContent).toContain('Votre réponse');
  });

  it('draws the clock and its pause in French', () => {
    const fixture = open();
    fixture.screen.setLocale('fr');
    fixture.setTimer({ kind: 'running', remainingMs: 30 * 60_000, paused: true });
    expect(fixture.textAt('exam-clock-time')).toBe('Il reste 30 minutes');
    expect(fixture.textAt('exam-clock-paused')).toBe('Chronomètre en pause');
  });
});
