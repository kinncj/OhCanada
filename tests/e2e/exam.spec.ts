import { expect, test, type Page } from '@playwright/test';

/**
 * A practice exam, sat end to end on the shipped build.
 *
 * Against `vite preview` at the real base path, like the rest of `tests/e2e`:
 * what is proved here is the page a visitor opens — twenty questions drawn from
 * the real bundled bank, answered through the real save, scored by the real pass
 * mark — not a harness.
 *
 * The two runs that matter are both here, because they are the two a player
 * actually has:
 *
 *  1. **Sit it.** Twenty questions, change one, finish, read the result and the
 *     review.
 *  2. **Abandon it and come back.** Answer a few, leave, reload the page, and
 *     find the same exam with the same answers at the first question with none.
 *     Save format version 3 is what makes the second possible at all, and it is
 *     the run that used to be impossible to write.
 *
 * `?e2e=1` installs the event trace (`app/bootstrap/exam-events.ts`). A normal
 * load installs nothing, which is asserted here too — a debug surface in front
 * of a player is the defect the scene probe's own contract exists to prevent.
 */

interface ExamEvent {
  readonly name: string;
  readonly detail?: string;
}

declare global {
  interface Window {
    __tnExam?: { events(): readonly ExamEvent[]; clear(): void };
  }
}

/** Cold load to the title screen, with the event trace on. */
async function frontDoor(page: Page, query = '?e2e=1'): Promise<void> {
  await page.goto(`./${query}`);
  await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');
  await expect(page.locator('[data-testid="title-screen"]')).toBeVisible();
}

const eventNames = (page: Page): Promise<readonly string[]> =>
  page.evaluate(() => (window.__tnExam?.events() ?? []).map((entry) => entry.name));

/** Wait until the trace holds this event, so an assertion never races a save. */
async function waitForEvent(page: Page, name: string): Promise<void> {
  await expect
    .poll(async () => (await eventNames(page)).includes(name), {
      message: `the event "${name}" was never emitted`,
      timeout: 10_000,
    })
    .toBe(true);
}

/**
 * The glyphs a running exam may never draw (`TN-EXAMMENU-06`). Spelt out rather
 * than imported, because they are what this suite refuses and must not be able
 * to follow a change to `app/ui`.
 */
const VERDICT_GLYPHS = ['\u2713', '\u2717', '\u2714', '\u2718', '\u274C', '\u2705'];

const progressText = (page: Page): Promise<string> =>
  page.locator('[data-testid="question-progress"]').innerText();

/** How many questions this exam asks, read from the card rather than assumed. */
async function examLength(page: Page): Promise<number> {
  const text = await progressText(page);
  return Number(/of (\d+)/.exec(text)?.[1] ?? '0');
}

/** Answer the question on screen and move on, without asserting which is right. */
async function answerAndAdvance(page: Page, option: number, last: boolean): Promise<void> {
  await page.locator(`[data-testid="option-${String(option)}"]`).click();
  /* `TN-EXAM-03`: answering moves the focus to Next and moves the exam nowhere. */
  await expect(page.locator(last ? '[data-testid="exam-finish"]' : '[data-testid="exam-next"]'))
    .toBeFocused();
  if (!last) await page.locator('[data-testid="exam-next"]').click();
}

test.describe('the practice exam, on the shipped build', () => {
  test('is offered from the title screen and says what it is before it starts', async ({
    page,
  }) => {
    await frontDoor(page);

    const open = page.locator('[data-testid="title-exam"]');
    await expect(
      open,
      'the shell hides an absent option rather than drawing a dead control, so a ' +
        'missing exam button is a game with no exam in it',
    ).toBeVisible();
    await expect(open).toHaveText('Practice exam');
    await open.click();

    const start = page.locator('[data-testid="exam-start"]');
    await expect(start).toBeVisible();
    await expect(start).toHaveAttribute('role', 'dialog');
    await expect(start).toHaveAccessibleName(/\S/);

    /* The numbers come from `content/game.config.json`, so the assertion is on
       the shape of the sentence and on the pair agreeing with each other. */
    await expect(start.locator('[data-testid="exam-rules-length"]')).toHaveText(
      /^The exam has \d+ questions\.$/,
    );
    await expect(start.locator('[data-testid="exam-rules-pass"]')).toHaveText(
      /^You need \d+ out of \d+ to pass\.$/,
    );
    await expect(start).toContainText('You will see how you did at the end.');
    await expect(start).toContainText('You can go back and change an answer before you finish.');
    await expect(page.locator('[data-testid="exam-begin"]')).toBeVisible();

    /*
     * `TN-EXAM-01`: an exam is not a level. No `playable`, and no quest tracker.
     *
     * `scene-state` is deliberately not asserted here. The story lists it, but
     * the element belongs to the renderer's `?e2e=1` probe and is created at
     * boot rather than per level — so on a build opened with the trace on it is
     * present on the title screen too, and an exam is not what put it there.
     * Reported with the task; it is the engine's element to scope, and a test
     * that asserted otherwise would be asserting a defect into the exam's name.
     */
    await expect(page.locator('[data-testid="playable"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="hud-quest-tracker"]')).toHaveCount(0);
  });

  test('starts untimed by default, and says what that means', async ({ page }) => {
    /* `TN-TIMER-01`: the timer starts off, and "off" is untimed practice rather
       than a hidden clock — so the screen says so in words. */
    await frontDoor(page);
    await page.locator('[data-testid="title-exam"]').click();

    const toggle = page.locator('[data-testid="exam-timer-toggle"]');
    await expect(toggle).toHaveAttribute('role', 'switch');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(toggle).toContainText('Off');
    await expect(page.locator('[data-testid="exam-timer-state"]')).toHaveText(
      'No timer. Take as long as you like.',
    );
    await expect(page.locator('[data-testid="exam-timer-limit"]')).toHaveText(/^\d+ minutes$/);

    await page.locator('[data-testid="exam-begin"]').click();
    await expect(page.locator('[data-testid="exam-screen"]')).toBeVisible();
    /* `TN-TIMER-02`: no clock is drawn, and the exam says so instead. */
    await expect(page.locator('[data-testid="exam-clock"]')).toBeHidden();
    await expect(page.locator('[data-testid="exam-untimed"]')).toHaveText(
      'No timer. Take as long as you like.',
    );
  });

  test('runs a clock in whole minutes when the player asks for one', async ({ page }) => {
    await frontDoor(page);
    await page.locator('[data-testid="title-exam"]').click();
    await page.locator('[data-testid="exam-timer-toggle"]').click();
    await expect(page.locator('[data-testid="exam-timer-toggle"]')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.locator('[data-testid="exam-begin"]').click();

    const clock = page.locator('[data-testid="exam-clock"]');
    await expect(clock).toBeVisible();
    /* Whole minutes, never seconds (`TN-TIMER-02`). */
    await expect(clock).toHaveText(/^\d+ minutes left$/);
    await expect(clock).not.toHaveText(/second/);

    /* `TN-TIMER-03`: opening a screen over the exam pauses it, and says so. */
    await page.locator('[data-testid="exam-menu-button"]').click();
    await expect(page.locator('[data-testid="exam-menu"]')).toBeVisible();
    await expect(clock).toContainText('Timer paused');
    await expect(clock).toContainText('minutes left');

    /* `TN-TIMER-04`: it can be turned off mid-exam, one way, and the exam is
       otherwise untouched — the same question, the same answers, no result. */
    await page.locator('[data-testid="exam-timer-stop"]').click();
    await expect(clock).toBeHidden();
    await expect(page.locator('[data-testid="exam-untimed"]')).toHaveText(
      'The timer is off. You can take as long as you like.',
    );
    await expect(page.locator('[data-testid="question-progress"]')).toHaveText(
      /^Question 1 of \d+$/,
    );
    await expect(page.locator('[data-testid="exam-result"]')).toHaveCount(0);

    await page.locator('[data-testid="exam-menu-button"]').click();
    await expect(page.locator('[data-testid="exam-timer-stop"]')).toHaveCount(0);
    await page.locator('[data-testid="exam-menu-close"]').click();

    /* And the result records what the exam really was. */
    await page.locator('[data-testid="exam-finish"]').click();
    await page.locator('[data-testid="exam-finish-anyway"]').click();
    await expect(page.locator('[data-testid="exam-result-timer"]')).toHaveText(
      'You took this exam without the timer.',
    );
  });

  test('draws twenty, is answered, changed and finished, and gives a result by subject', async ({
    page,
  }) => {
    test.slow();
    await frontDoor(page);
    await page.locator('[data-testid="title-exam"]').click();
    await page.locator('[data-testid="exam-begin"]').click();
    await waitForEvent(page, 'exam/started');

    const exam = page.locator('[data-testid="exam-screen"]');
    await expect(exam).toBeVisible();
    const total = await examLength(page);
    expect(total, 'an exam of nothing is not an exam').toBeGreaterThan(1);

    /* Every question is a real one from the bank: four options, in both
       languages, with a prompt. */
    await expect(page.locator('[data-testid="option-0"]')).toBeVisible();
    await expect(page.locator('[data-testid^="option-"]')).toHaveCount(4);
    await expect(page.locator('[data-testid="question-prompt"]')).not.toBeEmpty();
    /* `TN-EXAM-03`: none of the level card's teaching. */
    await expect(page.locator('[data-testid="question-kind"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="question-feedback"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="question-explanation"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="exam-progress"]')).toHaveText(
      `Answers given: 0 of ${String(total)}`,
    );

    const seen: string[] = [];
    for (let asked = 0; asked < total; asked += 1) {
      await expect(page.locator('[data-testid="question-progress"]')).toHaveText(
        `Question ${String(asked + 1)} of ${String(total)}`,
      );
      seen.push(await page.locator('[data-testid="question-prompt"]').innerText());
      await answerAndAdvance(page, asked % 4, asked === total - 1);
    }

    /* No question is asked twice (`TN-EXAM-02`). */
    expect(new Set(seen).size, 'a question was asked twice').toBe(total);
    await expect(page.locator('[data-testid="exam-progress"]')).toHaveText(
      `Answers given: ${String(total)} of ${String(total)}`,
    );

    /* `TN-EXAM-03`: an answer can be changed until the exam is finished. */
    await page.locator('[data-testid="exam-previous"]').click();
    await expect(page.locator('[data-testid="question-progress"]')).toHaveText(
      `Question ${String(total - 1)} of ${String(total)}`,
    );
    const before = page.locator('[data-testid^="option-"][aria-pressed="true"]');
    await expect(before).toHaveCount(1);
    await page.locator('[data-testid="option-3"]').click();
    await expect(page.locator('[data-testid="option-3"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(
      page.locator('[data-testid^="option-"][aria-pressed="true"]'),
      'exactly one option is marked as chosen',
    ).toHaveCount(1);

    /* Everything is answered, so finishing asks nothing (`TN-EXAM-04`). */
    await page.locator('[data-testid="exam-finish"]').click();
    await expect(page.locator('[data-testid="exam-unanswered"]')).toBeHidden();

    const result = page.locator('[data-testid="exam-result"]');
    await expect(result).toBeVisible();
    await waitForEvent(page, 'exam/finished');
    await expect(page.locator('[data-testid="exam-result-verdict"]')).toHaveText(
      /^(You passed|Not this time)$/,
    );
    await expect(page.locator('[data-testid="exam-result-score"]')).toHaveText(
      new RegExp(`^Right answers: \\d+ out of ${String(total)}$`),
    );
    await expect(page.locator('[data-testid="exam-result-pass-mark"]')).toHaveText(
      /^You need \d+ out of \d+ to pass\.$/,
    );
    await expect(page.locator('[data-testid="exam-result-timer"]')).toHaveText(
      'You took this exam without the timer.',
    );
    /* Nothing was left unanswered, so nothing says so. */
    await expect(page.locator('[data-testid="exam-result-unanswered"]')).toHaveCount(0);

    /* Results by subject: the whole point of F1's "results by subject". */
    const rows = page.locator('[data-testid^="subject-row-"]');
    const rowCount = await rows.count();
    expect(rowCount, 'an exam that drew from no subject at all').toBeGreaterThan(0);
    let rowTotal = 0;
    let rowCorrect = 0;
    for (let index = 0; index < rowCount; index += 1) {
      const text = await rows.nth(index).innerText();
      const numbers = /(\d+) out of (\d+)/.exec(text);
      expect(numbers, `a by-subject row with no numbers: ${text}`).not.toBeNull();
      rowCorrect += Number(numbers?.[1] ?? '0');
      rowTotal += Number(numbers?.[2] ?? '0');
    }
    expect(rowTotal, 'the by-subject rows do not add up to the exam').toBe(total);
    const score = await page.locator('[data-testid="exam-result-score"]').innerText();
    expect(rowCorrect).toBe(Number(/: (\d+) out of/.exec(score)?.[1] ?? '-1'));

    /* The review is where the learning is (`TN-RESULT-04`). */
    await page.locator('[data-testid="exam-result-review"]').click();
    const review = page.locator('[data-testid="exam-review"]');
    await expect(review).toBeVisible();
    await expect(page.locator('[data-testid^="exam-review-item-"]')).toHaveCount(total);
    await expect(review).toContainText('Correct answer');
    await expect(review).toContainText('Your answer');
    await page.locator('[data-testid="exam-review-back"]').click();
    await expect(review).toBeHidden();
    await expect(page.locator('[data-testid="exam-result-score"]')).toBeVisible();

    /* `TN-RESULT-06`: another exam starts from the start screen, not from here. */
    await page.locator('[data-testid="exam-again"]').click();
    await expect(page.locator('[data-testid="exam-start"]')).toBeVisible();
    await expect(page.locator('[data-testid="exam-timer-toggle"]')).toHaveAttribute(
      'aria-checked',
      'false',
    );

    /* And the result is kept: the passport shows the most recent one. */
    await page.locator('[data-testid="exam-back"]').click();
    await expect(page.locator('[data-testid="title-screen"]')).toBeVisible();
    await page.locator('[data-testid="title-choose-level"]').click();
    await page.locator('[data-testid="passport-open"]').click();
    await expect(page.locator('[data-testid="passport-exam"]')).toContainText(
      'Your last practice exam',
    );
    await expect(page.locator('[data-testid="passport-exam-score"]')).toHaveText(
      new RegExp(`^Right answers: \\d+ out of ${String(total)}$`),
    );
    /* `TN-RESULT-05`: an exam earns no stamp. */
    await expect(page.locator('[data-testid="passport-counts"]')).toContainText('Stamps: 0 of');
  });

  test('marks a chosen answer as recorded, from its own menu, never as right', async ({
    page,
  }) => {
    /*
     * `TN-EXAMMENU-06` and `TN-EXAMMENU-01`, on the shipped build.
     *
     * Two defects, one screen. The exam drew a **tick** beside "Your answer" —
     * `TN-CARD-04`'s pairing, on a screen where the player has already been
     * marked — after printing `exam.noFeedback` ("You will see how you did at
     * the end.") on the start screen four taps earlier. And it drew `hud.menu`
     * and `hud.menu.title`, which `TN-HUD-02` says belong to a level and are not
     * used by Exam mode.
     */
    await frontDoor(page);
    await page.locator('[data-testid="title-exam"]').click();
    await expect(page.locator('[data-testid="exam-start"]')).toContainText(
      'You will see how you did at the end.',
    );
    await page.locator('[data-testid="exam-begin"]').click();
    await waitForEvent(page, 'exam/started');

    const exam = page.locator('[data-testid="exam-screen"]');
    await expect(exam).toBeVisible();

    /* Before an answer: four empty indicators and no "Your answer". */
    await expect(page.locator('[data-tn-chosen="false"]')).toHaveCount(4);
    await expect(page.locator('[data-tn-chosen="true"]')).toHaveCount(0);
    await expect(exam).not.toContainText('Your answer');

    await page.locator('[data-testid="option-1"]').click();
    await expect(page.locator('[data-testid="option-1"]')).toContainText('Your answer');
    await expect(page.locator('[data-tn-chosen="true"]')).toHaveCount(1);
    await expect(page.locator('[data-tn-chosen="false"]')).toHaveCount(3);

    /* One shape with two fills, and no verdict glyph anywhere on the screen. */
    const drawn = await exam.innerText();
    for (const glyph of VERDICT_GLYPHS) {
      expect(drawn.includes(glyph), `a running exam drew "${glyph}"`).toBe(false);
    }
    /* And nothing on any question says whether the answer was right. */
    for (const word of ['Correct answer', 'Not quite', 'Well done']) {
      expect(drawn, `a running exam said "${word}"`).not.toContain(word);
    }

    /* The exam's own menu, with the exam's own two rows. */
    await expect(page.locator('[data-testid="exam-menu-button"]')).toHaveText('Menu');
    await page.locator('[data-testid="exam-menu-button"]').click();
    const menu = page.locator('[data-testid="exam-menu"]');
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAccessibleName('Exam menu');
    /* `TN-EXAMMENU-02`: the level's menu can never open over an exam. */
    await expect(page.locator('[data-testid="menu"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="menu-button"]')).toHaveCount(0);
    await expect(menu).not.toContainText('Leave the level');
    await page.locator('[data-testid="exam-menu-close"]').click();
    await expect(menu).toBeHidden();

    /* The answer survived the menu, still marked and still unmarked-on. */
    await expect(page.locator('[data-testid="option-1"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('[data-tn-chosen="true"]')).toHaveCount(1);

    /* And the result names itself without drawing a line above the verdict
       (`TN-RESULT-01`, `TN-RESULT-10`, `TN-EXAMMENU`'s ruling 3). */
    await page.locator('[data-testid="exam-finish"]').click();
    await page.locator('[data-testid="exam-finish-anyway"]').click();
    const result = page.locator('[data-testid="exam-result"]');
    await expect(result).toBeVisible();
    await expect(result).toHaveAccessibleName('Your exam');
    const shown = await result.innerText();
    expect(shown, '"Your exam" is drawn above the verdict').not.toContain('Your exam');
    expect(
      shown.startsWith('You passed') || shown.startsWith('Not this time'),
      `the verdict is not the first line: ${shown.slice(0, 40)}`,
    ).toBe(true);
  });

  test('asks before finishing with questions unanswered, and counts them as unanswered', async ({
    page,
  }) => {
    await frontDoor(page);
    await page.locator('[data-testid="title-exam"]').click();
    await page.locator('[data-testid="exam-begin"]').click();
    const total = await examLength(page);

    await page.locator('[data-testid="option-0"]').click();
    await page.locator('[data-testid="exam-finish"]').click();

    const confirm = page.locator('[data-testid="exam-unanswered"]');
    await expect(confirm).toBeVisible();
    await expect(confirm).toHaveAttribute('role', 'alertdialog');
    await expect(confirm).toContainText(
      `You have not answered ${String(total - 1)} questions.`,
    );

    /* Going back to the ones I skipped. */
    await page.locator('[data-testid="exam-go-unanswered"]').click();
    await expect(confirm).toBeHidden();
    await expect(page.locator('[data-testid="question-progress"]')).toHaveText(
      `Question 2 of ${String(total)}`,
    );

    /* Finishing anyway. */
    await page.locator('[data-testid="exam-finish"]').click();
    await page.locator('[data-testid="exam-finish-anyway"]').click();
    await expect(page.locator('[data-testid="exam-result"]')).toBeVisible();
    await expect(page.locator('[data-testid="exam-result-unanswered"]')).toHaveText(
      `You did not answer ${String(total - 1)} questions.`,
    );
    /* Unanswered is not wrong: the score is out of the whole exam. */
    await expect(page.locator('[data-testid="exam-result-score"]')).toHaveText(
      new RegExp(`^Right answers: [01] out of ${String(total)}$`),
    );
    await page.locator('[data-testid="exam-result-review"]').click();
    await expect(page.locator('[data-testid="exam-review"]')).toContainText(
      'You did not answer this one.',
    );
  });

  test('is abandoned, survives the tab closing, and is finished later', async ({ page }) => {
    test.slow();
    await frontDoor(page);
    await page.locator('[data-testid="title-exam"]').click();
    await page.locator('[data-testid="exam-begin"]').click();
    await waitForEvent(page, 'exam/started');
    const total = await examLength(page);

    /* Answer questions 1 and 2, skip 3, answer 4. */
    const wording: string[] = [];
    for (let index = 0; index < 4; index += 1) {
      wording.push(await page.locator('[data-testid="question-prompt"]').innerText());
      if (index !== 2) await page.locator(`[data-testid="option-${String(index)}"]`).click();
      await page.locator('[data-testid="exam-next"]').click();
    }
    await expect(page.locator('[data-testid="exam-progress"]')).toHaveText(
      `Answers given: 3 of ${String(total)}`,
    );
    await waitForEvent(page, 'progress/saved');

    /* Leaving asks nothing, because nothing is lost (`TN-ATTEMPT-01`). */
    await page.locator('[data-testid="exam-menu-button"]').click();
    await expect(page.locator('[data-testid="exam-menu-promise"]')).toHaveText(
      'Your exam is saved. You can finish it later.',
    );
    await page.locator('[data-testid="exam-leave"]').click();
    await expect(page.locator('[data-testid="exam-leave-confirm"]')).toBeHidden();
    await waitForEvent(page, 'exam/left');
    await expect(page.locator('[data-testid="title-screen"]')).toBeVisible();
    await expect(page.locator('[data-testid="exam-screen"]')).toBeHidden();
    /* Leaving is not finishing. */
    expect(await eventNames(page)).not.toContain('exam/finished');

    /* The way in says there is something to finish (`TN-ATTEMPT-03`). */
    await expect(page.locator('[data-testid="title-exam"]')).toHaveText('Finish your exam');

    /* The tab closes. This is the run save format version 3 made possible. */
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-tn-boot', 'ready');
    await waitForEvent(page, 'progress/loaded');
    /* The exam does not open by itself (`TN-ATTEMPT-02`). */
    await expect(page.locator('[data-testid="title-screen"]')).toBeVisible();
    await expect(page.locator('[data-testid="exam-screen"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="title-exam"]')).toHaveText('Finish your exam');

    await page.locator('[data-testid="title-exam"]').click();
    const resume = page.locator('[data-testid="exam-resume"]');
    await expect(resume).toBeVisible();
    await expect(resume).toContainText('You have an exam to finish');
    await expect(page.locator('[data-testid="exam-resume-progress"]')).toHaveText(
      `Answers given: 3 of ${String(total)}`,
    );
    await expect(page.locator('[data-testid="exam-begin"]')).toHaveCount(0);

    await page.locator('[data-testid="exam-continue"]').click();
    await waitForEvent(page, 'exam/resumed');

    /* It opens at the first question with no answer, which is the one skipped. */
    await expect(page.locator('[data-testid="question-progress"]')).toHaveText(
      `Question 3 of ${String(total)}`,
    );
    await expect(page.locator('[data-testid="question-prompt"]')).toHaveText(wording[2] ?? '');
    await expect(page.locator('[data-testid="exam-progress"]')).toHaveText(
      `Answers given: 3 of ${String(total)}`,
    );

    /* The same twenty, in the same order, with the same answers. */
    await page.locator('[data-testid="exam-previous"]').click();
    await page.locator('[data-testid="exam-previous"]').click();
    await expect(page.locator('[data-testid="question-prompt"]')).toHaveText(wording[0] ?? '');
    await expect(page.locator('[data-testid="option-0"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    /* And it can be finished. */
    await page.locator('[data-testid="exam-finish"]').click();
    await page.locator('[data-testid="exam-finish-anyway"]').click();
    await expect(page.locator('[data-testid="exam-result"]')).toBeVisible();
    await waitForEvent(page, 'exam/finished');
    /* One unfinished exam becomes no unfinished exam. */
    await page.locator('[data-testid="exam-result-close"]').click();
    await expect(page.locator('[data-testid="title-exam"]')).toHaveText('Practice exam');
  });

  test('asks before a new exam replaces an unfinished one', async ({ page }) => {
    /* `TN-ATTEMPT-04`: the one destructive confirmation in this game. */
    await frontDoor(page);
    await page.locator('[data-testid="title-exam"]').click();
    await page.locator('[data-testid="exam-begin"]').click();
    await page.locator('[data-testid="option-0"]').click();
    await waitForEvent(page, 'progress/saved');
    await page.locator('[data-testid="exam-menu-button"]').click();
    await page.locator('[data-testid="exam-leave"]').click();
    await expect(page.locator('[data-testid="title-screen"]')).toBeVisible();

    await page.locator('[data-testid="title-exam"]').click();
    await page.locator('[data-testid="exam-new"]').click();

    const confirm = page.locator('[data-testid="exam-new-confirm"]');
    await expect(confirm).toBeVisible();
    await expect(confirm).toHaveAttribute('role', 'alertdialog');
    await expect(confirm).toContainText('Your unfinished exam will be gone. Start a new one?');

    /* Saying no changes nothing. */
    await page.locator('[data-testid="exam-new-keep"]').click();
    await expect(confirm).toBeHidden();
    await expect(page.locator('[data-testid="exam-resume-progress"]')).toHaveText(
      /Answers given: 1 of \d+/,
    );

    /* Saying yes discards it and offers the timer choice again. */
    await page.locator('[data-testid="exam-new"]').click();
    await page.locator('[data-testid="exam-new-confirmed"]').click();
    await waitForEvent(page, 'exam/discarded');
    await expect(page.locator('[data-testid="exam-resume"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="exam-begin"]')).toBeVisible();
    await expect(page.locator('[data-testid="exam-timer-toggle"]')).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  test('carries no debug surface on a normal load', async ({ page }) => {
    await frontDoor(page, '');
    expect(await page.evaluate(() => typeof window.__tnExam)).toBe('undefined');
  });
});
