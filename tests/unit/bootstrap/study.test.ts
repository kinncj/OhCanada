import { describe, expect, it, vi } from 'vitest';

import type { Result } from '@common/result';
import type { ShippableQuestion } from '@application/ports';
import type { StudyDrill, StudySession } from '@application/use-cases/study-session';
import { createSettingsStore, DEFAULT_SETTINGS } from '@ui/settings';
import { text } from '@ui/copy';

/* Relative, not aliased: there is no `@bootstrap` alias and adding one means
   editing three configs that have to agree (tsconfig, vite, vitest). */
import { createStudyController } from '../../../app/bootstrap/study';

import { buildPage } from '../ui/support/fake-dom';

/**
 * Study mode, mounted — `docs/stories/TN-STUDY-study-mode.md`.
 *
 * `app/ui/study-screen.ts`, `app/ui/question-card.ts` and
 * `app/application/use-cases/study-session.ts` were all finished and none of
 * them had a caller, so no player had ever run a drill. This suite is the
 * controller that joins them, and it asserts the four things that are *its*
 * decisions rather than the screens':
 *
 *  1. which of the three opening states a bank produces;
 *  2. that the bank is asked when Study opens, and again on Try again;
 *  3. that every answer reaches the caller's recorder — once;
 *  4. that leaving part-way keeps the answers and says so.
 *
 * The screens themselves are real: they are pure DOM, they have their own
 * suites, and running them here is what proves the wiring rather than a mock's
 * agreement with itself.
 */

const QUESTION = (id: string): ShippableQuestion =>
  ({
    id,
    subject: 'rights',
    prompt: { en: `Prompt ${id}`, fr: `Question ${id}` },
    options: [
      { en: 'A', fr: 'A' },
      { en: 'B', fr: 'B' },
      { en: 'C', fr: 'C' },
      { en: 'D', fr: 'D' },
    ],
    correctIndex: 0,
    explanation: { en: 'Because.', fr: 'Parce que.' },
  }) as unknown as ShippableQuestion;

interface Bank {
  readonly session: StudySession;
  readonly drills: number[];
  availables: number;
}

function bank(options: {
  available?: Result<number>;
  drill?: Result<StudyDrill>;
  size?: number;
}): Bank {
  const drills: number[] = [];
  const state = { availables: 0 };
  const session: StudySession = {
    drillSize: options.size ?? 3,
    available: async () => {
      state.availables += 1;
      return Promise.resolve(options.available ?? { ok: true, value: 12 });
    },
    drill: async (count) => {
      drills.push(count);
      return Promise.resolve(
        options.drill ?? {
          ok: true,
          value: {
            questions: Array.from({ length: count }, (_unused, index) => ({
              question: QUESTION(`q${String(index)}`),
              familiarity: 'new' as const,
            })),
            shortfall: 0,
          },
        },
      );
    },
  };
  return {
    session,
    drills,
    get availables(): number {
      return state.availables;
    },
    set availables(value: number) {
      state.availables = value;
    },
  };
}

function mount(options: Parameters<typeof bank>[0] = {}) {
  const page = buildPage();
  const store = createSettingsStore(DEFAULT_SETTINGS);
  const announce = vi.fn();
  const record = vi.fn();
  const onOpen = vi.fn();
  const onClose = vi.fn();
  const source = bank(options);
  const controller = createStudyController({
    host: page.host,
    session: source.session,
    store,
    announce,
    record,
    onOpen,
    onClose,
  });
  return {
    page,
    store,
    announce,
    record,
    onOpen,
    onClose,
    source,
    controller,
    at: (testId: string) => page.doc.byTestId(testId),
  };
}

const flush = async (): Promise<void> => {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
};

describe('opening Study', () => {
  it('does not touch the bank until it is opened', () => {
    const { source } = mount({});
    expect(source.availables).toBe(0);
  });

  it('brackets the surface underneath, so two switch rings do not both answer', async () => {
    const { controller, onOpen, onClose, at } = mount({});
    controller.open();
    await flush();

    expect(onOpen).toHaveBeenCalledTimes(1);
    at('study-exit')?.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the count when the bank has questions', async () => {
    const { controller, at } = mount({ available: { ok: true, value: 12 }, size: 3 });
    controller.open();
    await flush();

    expect(at('study-screen')?.hidden).toBe(false);
    expect(at('study-count')?.textContent).toBe('3 questions');
    expect(at('study-start')).not.toBeNull();
  });

  it('states a short drill rather than padding it', async () => {
    const { controller, at } = mount({ available: { ok: true, value: 2 }, size: 5 });
    controller.open();
    await flush();

    expect(at('study-count')?.textContent).toBe('You have 2 questions ready. We will ask those.');
  });

  it('shows the empty state, and no count, when the bank has nothing', async () => {
    const { controller, at } = mount({ available: { ok: true, value: 0 } });
    controller.open();
    await flush();

    expect(at('study-empty')).not.toBeNull();
    expect(at('study-count'), '"0 questions" is never on screen').toBeNull();
    expect(at('question-card')?.hidden ?? true).toBe(true);
  });

  it('shows the failure in the player’s words, and the reason on the console', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { controller, at, announce } = mount({
        available: {
          ok: false,
          error: { kind: 'io', code: 'content.questions.io', message: 'the chunk 404ed' },
        } as Result<number>,
      });
      controller.open();
      await flush();

      expect(at('study-error')?.textContent).toBe(text('en', 'study.error'));
      expect(announce).toHaveBeenCalledWith(text('en', 'study.error'), 'en');
      expect(error.mock.calls.flat().join(' ')).toContain('the chunk 404ed');
    } finally {
      error.mockRestore();
    }
  });

  it('asks again on Try again, so a connection that came back produces a drill', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { controller, at, source } = mount({
        available: {
          ok: false,
          error: { kind: 'io', code: 'content.questions.io', message: 'offline' },
        } as Result<number>,
      });
      controller.open();
      await flush();
      expect(source.availables).toBe(1);

      at('study-retry')?.click();
      await flush();
      expect(source.availables).toBe(2);
    } finally {
      error.mockRestore();
    }
  });
});

describe('running a drill', () => {
  const start = async () => {
    const fixture = mount({ size: 3 });
    fixture.controller.open();
    await flush();
    fixture.at('study-start')?.click();
    await flush();
    return fixture;
  };

  it('asks the configured number of questions, and hides the Study screen', async () => {
    const { at, source } = await start();

    expect(source.drills).toEqual([3]);
    expect(at('study-screen')?.hidden).toBe(true);
    expect(at('question-card')?.hidden).toBe(false);
    expect(at('question-progress')?.textContent).toBe('Question 1 of 3');
  });

  it('records every answer through the caller, once each', async () => {
    const { at, record } = await start();

    at('option-0')?.click();
    at('option-0')?.click();
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0]?.[0]).toMatchObject({ id: 'q0' });
    expect(record.mock.calls[0]?.[1]).toBe(0);
  });

  it('counts to a summary, naming what comes back by its wording', async () => {
    const { at } = await start();

    /* Right, wrong, right. */
    at('option-0')?.click();
    at('question-next')?.click();
    at('option-1')?.click();
    at('question-next')?.click();
    at('option-0')?.click();
    at('question-next')?.click();
    await flush();

    expect(at('study-summary-score')?.textContent).toBe('You got 2 out of 3 right.');
    const returning = at('study-summary-returning');
    expect(returning?.textContent).toContain('Prompt q1');
    /* `TN-STUDY-04`: no percentage, grade, streak or star rating. */
    expect(at('study-summary')?.textContent).not.toContain('%');
  });

  it('offers another drill from the summary', async () => {
    const { at, source } = await start();
    for (let index = 0; index < 3; index += 1) {
      at('option-0')?.click();
      at('question-next')?.click();
    }
    await flush();

    at('study-again')?.click();
    await flush();
    expect(source.drills).toEqual([3, 3]);
  });

  it('keeps the answers when the player leaves part-way, and says so', async () => {
    const { at, record } = await start();
    at('option-0')?.click();
    at('question-close')?.click();
    await flush();

    expect(record).toHaveBeenCalledTimes(1);
    expect(at('study-left-notice')?.textContent).toBe(text('en', 'study.leaveKept'));
    /* Back on the Study screen, not out of the game: `TN-STUDY-06`, "Escape
       leaves the drill, not the game." */
    expect(at('study-screen')?.hidden).toBe(false);
  });

  it('draws a drill from the empty state too, when the player asks for one', async () => {
    const { controller, at, source } = mount({ available: { ok: true, value: 0 }, size: 4 });
    controller.open();
    await flush();

    at('study-practise-new')?.click();
    await flush();
    expect(source.drills).toEqual([4]);
  });

  it('shows the empty state rather than a card with no question in it', async () => {
    const { controller, at } = mount({
      drill: { ok: true, value: { questions: [], shortfall: 3 } },
    });
    controller.open();
    await flush();
    at('study-start')?.click();
    await flush();

    expect(at('study-empty')).not.toBeNull();
    expect(at('question-card')?.hidden ?? true, 'a drill with nothing in it opened a card').toBe(true);
  });

  it('shows the failure, not a blank drill, when the draw fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { controller, at } = mount({
        drill: {
          ok: false,
          error: { kind: 'io', code: 'content.questions.io', message: 'gone' },
        } as Result<StudyDrill>,
      });
      controller.open();
      await flush();
      at('study-start')?.click();
      await flush();

      expect(at('study-error')?.textContent).toBe(text('en', 'study.error'));
      expect(at('question-card')?.hidden ?? true, 'a drill with nothing in it opened a card').toBe(true);
    } finally {
      error.mockRestore();
    }
  });
});

describe('Study in French', () => {
  it('follows the language the player chose, mid-session', async () => {
    const { controller, store, at } = mount({ size: 3 });
    controller.open();
    await flush();

    store.set('locale', 'fr');
    expect(at('study-screen')?.textContent).toContain('Révision');
    expect(at('study-start')?.textContent).toBe('Commencer');

    at('study-start')?.click();
    await flush();
    expect(at('question-progress')?.textContent).toBe('Question 1 sur 3');
    expect(at('question-prompt')?.textContent).toBe('Question q0');
  });
});

describe('Study never becomes a score that follows the player', () => {
  it('records no stamp and completes no quest, because no quest is ever supplied', async () => {
    const { controller, at, record } = mount({ size: 1 });
    controller.open();
    await flush();
    at('study-start')?.click();
    await flush();
    at('option-0')?.click();

    /* The controller hands the caller a question and an index and nothing else.
       `answerQuestion` earns a stamp only for an answer that completes a quest's
       `answer` step, and there is no third argument here to carry one. */
    expect(record.mock.calls[0]).toHaveLength(2);
  });

  it('leaves nothing on the page once it is destroyed', async () => {
    const { controller, at } = mount({});
    controller.open();
    await flush();
    controller.destroy();

    expect(at('study-screen')).toBeNull();
    expect(controller.isOpen).toBe(false);
  });
});
