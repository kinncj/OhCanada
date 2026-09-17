/**
 * One property, for every confirmation in the game: **with one switch, the
 * answer that cannot be undone is never one press from the answer that is
 * safe.**
 *
 * `TN-SAVE-08` fixed the first press — "the highlight starts on 'Keep my
 * progress'" — and the second press was still live. A confirmation draws two
 * answers, the ring wraps, so each answer sits exactly one advance from the
 * other *whichever order they are drawn in*: `TN-SAVE-06`'s destructive-first
 * order is not what made this dangerous, and reversing it would not have made
 * it safe. What made it dangerous is that one stray short press — a bounced
 * contact, the commonest error there is with one contact — silently re-aimed
 * the next hold at "Delete everything".
 *
 * `app/ui/confirm.ts` makes the **question** a stop in the ring, so the scan
 * reads the cost out again between the two answers. These tests are written
 * against `createConfirm` itself rather than against one screen, because the
 * behaviour belongs to the shared dialog: `ConfirmOptions` has no field for it,
 * so no caller can forget it and no caller can ask for it. The delete question
 * in its own screen is `tests/unit/ui/save-transfer.test.ts`.
 *
 * What is deliberately *not* here: any test that waits. Nothing in a
 * confirmation counts down (`TN-ATTEMPT-07`, `tests/unit/ui/no-second-countdown.test.ts`),
 * and the stop is not a second hold threshold to beat — `TN-SET-09` caps what a
 * control may demand of a player's hold, and this adds nothing to it.
 */

import { describe, expect, it, vi } from 'vitest';

import { createConfirm, type Confirm } from '@ui/confirm';
import { text, type UiLocale } from '@ui/copy';
import {
  HIGHLIGHT_ATTRIBUTE,
  SWITCH_LABEL_ATTRIBUTE,
  SWITCH_STOP_ATTRIBUTE,
} from '@ui/single-switch';

import { buildPage, press, pressSwitch, type FakeElement, type FakePage } from './support/fake-dom';

const HOLD_MS = 600;
const SHORT = 100;
const LONG = 800;

interface Fixture {
  readonly page: FakePage;
  readonly clock: { now: number };
  readonly confirm: Confirm;
  readonly onConfirm: ReturnType<typeof vi.fn>;
  readonly onCancel: ReturnType<typeof vi.fn>;
  readonly announce: ReturnType<typeof vi.fn>;
  at(testId: string): FakeElement | null;
  /** The question: the one stop in the ring that is not a control. */
  question(): FakeElement | null;
  highlighted(): FakeElement | null;
}

interface Options {
  readonly locale?: UiLocale;
  /** The exam's "leave" question carries a cost sentence; the delete question does not. */
  readonly withBody?: boolean;
  readonly singleSwitch?: boolean;
}

/** The delete question, or — with `withBody` — the exam's leaving question. */
function openConfirm(options: Options = {}): Fixture {
  const page = buildPage();
  const clock = { now: 0 };
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const announce = vi.fn();
  const withBody = options.withBody === true;

  const confirm = createConfirm(page.host, {
    id: withBody ? 'tn-exam-leave-confirm' : 'tn-save-clear-confirm',
    testId: withBody ? 'exam-leave-confirm' : 'save-clear-confirm',
    locale: options.locale ?? 'en',
    describe: (which) =>
      withBody
        ? { title: text(which, 'exam.leave.confirm'), body: text(which, 'exam.leave.notKept') }
        : { title: text(which, 'save.clear.confirm') },
    confirmKey: withBody ? 'exam.leave' : 'save.clear.yes',
    confirmTestId: withBody ? 'exam-leave-confirmed' : 'save-clear-yes',
    cancelKey: withBody ? 'exam.leave.stay' : 'save.clear.keep',
    cancelTestId: withBody ? 'exam-leave-stay' : 'save-clear-keep',
    announce,
    onConfirm,
    onCancel,
    singleSwitch: options.singleSwitch !== false,
    holdMs: HOLD_MS,
    now: () => clock.now,
  });
  confirm.open();

  return {
    page,
    clock,
    confirm,
    onConfirm,
    onCancel,
    announce,
    at: (testId) => page.doc.byTestId(testId),
    question: () => page.doc.querySelectorAll(`[${SWITCH_STOP_ATTRIBUTE}]`)[0] ?? null,
    highlighted: () => page.doc.querySelectorAll(`[${HIGHLIGHT_ATTRIBUTE}="true"]`)[0] ?? null,
  };
}

describe('the ring a confirmation opens with one switch', () => {
  it('opens on the safe answer, as TN-SAVE-08 requires', () => {
    const fixture = openConfirm();

    expect(fixture.at('save-clear-keep')?.getAttribute(HIGHLIGHT_ATTRIBUTE)).toBe('true');
    expect(fixture.at('save-clear-yes')?.getAttribute(HIGHLIGHT_ATTRIBUTE)).toBeNull();
  });

  it('puts the question between the safe answer and the one that cannot be undone', () => {
    const fixture = openConfirm();

    /* One advance from the safe answer: the question, read out again. */
    pressSwitch(fixture.page, fixture.clock, SHORT);
    expect(fixture.highlighted()).toBe(fixture.question());
    expect(fixture.at('save-clear-yes')?.getAttribute(HIGHLIGHT_ATTRIBUTE)).toBeNull();

    /* Two advances: the destructive answer, reachable as it always was. */
    pressSwitch(fixture.page, fixture.clock, SHORT);
    expect(fixture.at('save-clear-yes')?.getAttribute(HIGHLIGHT_ATTRIBUTE)).toBe('true');

    /* Three: back to the safe answer. The ring is three stops and it wraps. */
    pressSwitch(fixture.page, fixture.clock, SHORT);
    expect(fixture.at('save-clear-keep')?.getAttribute(HIGHLIGHT_ATTRIBUTE)).toBe('true');
  });

  it('confirms nothing when a stray press is followed by the hold meant for the safe answer', () => {
    const fixture = openConfirm();

    /* The bounce, then the hold the player did mean to make. */
    pressSwitch(fixture.page, fixture.clock, SHORT);
    pressSwitch(fixture.page, fixture.clock, LONG);

    expect(fixture.onConfirm, 'two presses took the answer that cannot be undone').not.toHaveBeenCalled();
    expect(fixture.onCancel, 'the question answered itself').not.toHaveBeenCalled();
    expect(fixture.confirm.visible, 'the question closed without being answered').toBe(true);
  });

  it('reads the question again when the highlight is held on it', () => {
    const fixture = openConfirm();
    const asked = text('en', 'save.clear.confirm');
    fixture.announce.mockClear();

    pressSwitch(fixture.page, fixture.clock, SHORT);
    pressSwitch(fixture.page, fixture.clock, LONG);

    expect(fixture.announce).toHaveBeenLastCalledWith(asked, 'en');
  });

  it('still takes the destructive answer, two short presses and a hold away', () => {
    const fixture = openConfirm();

    pressSwitch(fixture.page, fixture.clock, SHORT);
    pressSwitch(fixture.page, fixture.clock, SHORT);
    pressSwitch(fixture.page, fixture.clock, LONG);

    expect(fixture.onConfirm).toHaveBeenCalledTimes(1);
    expect(fixture.confirm.visible).toBe(false);
  });

  it('holds for a question that carries its cost as a second sentence', () => {
    /* The exam's leaving question, which has a description where the delete
       question has none. The stop reads the whole of it, exactly as the dialog
       announced it when it opened. */
    const fixture = openConfirm({ withBody: true });
    const whole = `${text('en', 'exam.leave.confirm')} ${text('en', 'exam.leave.notKept')}`;

    expect(fixture.question()?.getAttribute(SWITCH_LABEL_ATTRIBUTE)).toBe(whole);

    pressSwitch(fixture.page, fixture.clock, SHORT);
    expect(fixture.highlighted()).toBe(fixture.question());

    pressSwitch(fixture.page, fixture.clock, LONG);
    expect(fixture.onConfirm).not.toHaveBeenCalled();
    expect(fixture.announce).toHaveBeenLastCalledWith(whole, 'en');
  });
});

describe('the stop survives what re-renders the answers', () => {
  it('survives a language change', () => {
    const fixture = openConfirm();
    fixture.confirm.setLocale('fr');

    /* The words are French, the highlight is back on the safe answer, and the
       question is still the stop between the two. */
    expect(fixture.at('save-clear-keep')?.textContent).toBe(text('fr', 'save.clear.keep'));
    expect(fixture.at('save-clear-keep')?.getAttribute(HIGHLIGHT_ATTRIBUTE)).toBe('true');

    pressSwitch(fixture.page, fixture.clock, SHORT);
    expect(fixture.highlighted()).toBe(fixture.question());

    pressSwitch(fixture.page, fixture.clock, LONG);
    expect(fixture.onConfirm).not.toHaveBeenCalled();
    expect(fixture.announce).toHaveBeenLastCalledWith(text('fr', 'save.clear.confirm'), 'fr');
  });

  it('survives the switch being turned off and on again', () => {
    const fixture = openConfirm();
    fixture.confirm.setSingleSwitch(false);
    fixture.confirm.setSingleSwitch(true, HOLD_MS);

    expect(fixture.at('save-clear-keep')?.getAttribute(HIGHLIGHT_ATTRIBUTE)).toBe('true');

    pressSwitch(fixture.page, fixture.clock, SHORT);
    expect(fixture.highlighted()).toBe(fixture.question());

    pressSwitch(fixture.page, fixture.clock, LONG);
    expect(fixture.onConfirm).not.toHaveBeenCalled();
  });

  it('survives being closed and asked again', () => {
    const fixture = openConfirm();
    fixture.confirm.close();
    fixture.confirm.open();

    expect(fixture.at('save-clear-keep')?.getAttribute(HIGHLIGHT_ATTRIBUTE)).toBe('true');

    pressSwitch(fixture.page, fixture.clock, SHORT);
    expect(fixture.highlighted()).toBe(fixture.question());
  });
});

describe('what the stop does not change', () => {
  it('is not in the Tab order and is not a control', () => {
    const fixture = openConfirm();
    const question = fixture.question();

    /* `app/ui/focus-trap.ts` leaves out a negative `tabindex`, so a keyboard
       player still meets the two answers and nothing else. */
    expect(question?.getAttribute('tabindex')).toBe('-1');
    expect(question?.getAttribute('role')).toBeNull();
    expect(question?.tagName.toLowerCase()).toBe('h2');
  });

  it('leaves Escape meaning no, and deleting nothing', () => {
    const fixture = openConfirm();

    press(fixture.confirm.element as unknown as FakeElement, 'Escape');

    expect(fixture.onCancel).toHaveBeenCalledTimes(1);
    expect(fixture.onConfirm).not.toHaveBeenCalled();
    expect(fixture.confirm.visible).toBe(false);
  });

  it('leaves a pointer answering in one tap, with the switch off', () => {
    const fixture = openConfirm({ singleSwitch: false });

    /* No highlight is drawn at all, and the question does nothing when it is
       tapped: the stop exists for the switch and for nothing else. */
    expect(fixture.highlighted()).toBeNull();
    fixture.question()?.click();
    expect(fixture.announce).toHaveBeenCalledTimes(1);

    fixture.at('save-clear-yes')?.click();
    expect(fixture.onConfirm).toHaveBeenCalledTimes(1);
  });
});
