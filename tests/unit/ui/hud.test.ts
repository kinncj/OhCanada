import { describe, expect, it, vi } from 'vitest';

import { createHud } from '@ui/hud';

import { buildPage, press, pressSwitch, type FakeElement, type FakePage } from './support/fake-dom';

/**
 * `docs/stories/TN-HUD-hud-and-menu.md`.
 *
 * What this file can and cannot prove is the same split as every other suite in
 * this directory: structure and behaviour here, geometry in `tests/a11y`. "The
 * HUD is in the lower third", "every control is 44 CSS px" and "the label is not
 * clipped at 200 %" are asserted against real Chromium, where they can fail; a
 * unit test claiming them against the document double would be a green tick that
 * certifies nothing.
 */

interface Fixture {
  readonly page: FakePage;
  readonly hud: ReturnType<typeof createHud>;
  readonly announce: ReturnType<typeof vi.fn>;
  readonly handlers: Record<string, ReturnType<typeof vi.fn>>;
  readonly clock: { now: number };
  at(testId: string): FakeElement | null;
}

function mount(overrides: Partial<Parameters<typeof createHud>[1]> = {}): Fixture {
  const page = buildPage();
  const announce = vi.fn();
  const clock = { now: 0 };
  const handlers = {
    onPause: vi.fn(),
    onResume: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenStudy: vi.fn(),
    onOpenPassport: vi.fn(),
    onInteract: vi.fn(),
    onExportSave: vi.fn(),
  };

  const hud = createHud(page.host, {
    locale: 'en',
    announce,
    ...handlers,
    now: () => clock.now,
    ...overrides,
  });

  return { page, hud, announce, handlers, clock, at: (testId) => page.doc.byTestId(testId) };
}

describe('the HUD is there while the player plays', () => {
  it('is a named region inside the page one main, with the mode as text', () => {
    /* TN-HUD-07: exactly one main, hud is a region with an accessible name. */
    const { hud, at } = mount();
    hud.setMode('Skating');

    const region = at('hud');
    expect(region?.tagName).toBe('SECTION');
    /* The name comes from `hud.label`, which `TN-HUD` writes down. It names what
       the region is for; the story lists "HUD", "Region" and the empty string as
       defects, and `tests/unit/ui/copy.test.ts` holds that rule over the row. */
    expect(region?.getAttribute('aria-label')).toBe('Game controls');
    expect(region?.closest('main')).toBe(hud.main);
    expect(at('hud-mode-label')?.textContent).toBe('Skating');
  });

  it('builds one main however many HUDs are mounted', () => {
    const page = buildPage();
    const first = createHud(page.host, { locale: 'en' });
    const second = createHud(page.host, { locale: 'en' });

    expect(page.doc.querySelectorAll('main')).toHaveLength(1);
    expect(second.main).toBe(first.main);
  });

  it('adopts the canvas host into main when the composition root hands it over', () => {
    const page = buildPage();
    const hud = createHud(page.host, {
      locale: 'en',
      canvasHost: page.game as unknown as HTMLElement,
    });

    expect(page.game.parentElement).toBe(hud.main);
  });

  it('names the canvas host for the stylesheet while the level runs, and only then (ADR-0072)', () => {
    const page = buildPage();
    const hud = createHud(page.host, {
      locale: 'en',
      canvasHost: page.game as unknown as HTMLElement,
    });

    /* With the dyslexia face on, the sheet sits this host's canvas at the top of
       its space so the taller strip stays under the player's feet. */
    expect(page.game.getAttribute('data-tn-canvas')).toBe('level');
    hud.destroy();
    expect(page.game.getAttribute('data-tn-canvas')).toBeNull();
  });

  it('offers the menu in one tap, with a visible label', () => {
    const { at } = mount();
    const button = at('menu-button');
    expect(button?.tagName).toBe('BUTTON');
    expect(button?.textContent).toBe('Menu');
  });

  it('shows the tracker only when there is a task, and removes it rather than hiding it', () => {
    const { hud, at } = mount();
    expect(at('hud-quest-tracker')).toBeNull();

    hud.setTask('Answer 3 questions (0 of 3)');
    expect(at('hud-quest-tracker')?.textContent).toBe('Task: Answer 3 questions (0 of 3)');

    hud.setTask(null);
    /* Not hidden: absent. A hidden tracker is one stylesheet away from visible. */
    expect(at('hud-quest-tracker')).toBeNull();
  });

  it('announces a change to the tracker once, through the one live region', () => {
    /* TN-HUD-07: neither the tracker nor the mode carries an aria-live of its own. */
    const { hud, at, announce } = mount();
    hud.setTask('Answer 3 questions (0 of 3)');
    hud.setTask('Answer 3 questions (0 of 3)');

    expect(announce).toHaveBeenCalledTimes(1);
    expect(at('hud-quest-tracker')?.getAttribute('aria-live')).toBeNull();
    expect(at('hud-mode-label')?.getAttribute('aria-live')).toBeNull();
  });

  it('draws the task a player arrived with without saying it, and says the next change', () => {
    /* A save with a quest in progress: the line is the state the level opens in,
       not a change (TN-HUD-07), and it is text in the tree from the start. */
    const { hud, at, announce } = mount();
    hud.setTask('Find the Town Clock', { announce: false });

    expect(at('hud-quest-tracker')?.textContent).toBe('Task: Find the Town Clock');
    expect(announce).not.toHaveBeenCalled();

    /* The same line again, as a later refresh sends it, is still not news. */
    hud.setTask('Find the Town Clock');
    expect(announce).not.toHaveBeenCalled();

    hud.setTask('Answer 2 questions about voting (0 of 2)');
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Task: Answer 2 questions about voting (0 of 2)', 'en');
  });

  it('does not repeat the arrival announcement for the mode it arrived in', () => {
    const { hud, announce } = mount();
    hud.setMode('Skating');
    expect(announce).not.toHaveBeenCalled();

    hud.setMode('Walking');
    expect(announce).toHaveBeenCalledWith('Walking', 'en');
  });
});

describe('the interact prompt', () => {
  it('appears with the offer in words and does what tapping the target does', () => {
    const { hud, at, handlers } = mount();
    hud.setPrompt('Talk to the officer');

    const prompt = at('interact-prompt');
    expect(prompt?.tagName).toBe('BUTTON');
    expect(prompt?.textContent).toBe('Talk to the officer');

    prompt?.click();
    expect(handlers['onInteract']).toHaveBeenCalledTimes(1);
  });

  it('is withdrawn when nothing is in reach', () => {
    const { hud, at } = mount();
    hud.setPrompt('Talk to the officer');
    hud.setPrompt(null);
    expect(at('interact-prompt')).toBeNull();
  });

  it('says nothing itself: the level announcer owns the offer', () => {
    /* Two speakers for one event is how a message gets read twice. */
    const { hud, announce } = mount();
    hud.setPrompt('Talk to the officer');
    expect(announce).not.toHaveBeenCalled();
  });
});

describe('what the player can do comes first (ADR-0039)', () => {
  /** Every test id under the region, in document order. */
  const testIdsIn = (node: FakeElement | null): string[] => {
    if (node === null) return [];
    const own = node.getAttribute('data-testid');
    return [...(own === null ? [] : [own]), ...node.children.flatMap((child) => testIdsIn(child))];
  };

  it('draws the offer, then Settings and Menu, then the words that explain them', () => {
    /*
     * The live-site audit: at 200 % text the hint filled the strip and pushed the
     * prompt below the fold, and Menu was cut off at spawn. The strip is one
     * scroll box capped at a third of the viewport, so what is first is what is
     * seen. Geometry is `tests/a11y`'s to prove; the order is proved here.
     */
    const { hud, at } = mount();
    hud.setMode('Walking');
    hud.setTask('Find the Town Clock');
    hud.setNotice('The questions are not ready right now. Try again later.');
    hud.setHint('A mark shows someone or something you can choose. Get close, then choose.');
    hud.setStorageWarning(true);
    hud.setPrompt('Talk to the guide');

    const order = testIdsIn(at('hud'));
    const index = (testId: string): number => {
      const found = order.indexOf(testId);
      expect(found, `${testId} is not in the strip`).toBeGreaterThanOrEqual(0);
      return found;
    };
    expect(index('interact-prompt')).toBeLessThan(index('hud-settings-button'));
    expect(index('hud-settings-button')).toBeLessThan(index('menu-button'));
    /* With an offer up the task is its bounded indicator (ADR-0066 §2), in the
       task's own slot. */
    for (const words of ['storage-warning', 'hud-notice', 'hud-mode-label', 'hud-task-indicator', 'interact-hint']) {
      expect(index('menu-button'), `${words} is drawn before Menu`).toBeLessThan(index(words));
    }
    /*
     * The task is next, before every paragraph (ADR-0045). At 200 % text in
     * French on Halifax it used to follow the warning, the notice and the mode
     * and ended below the screen. The hint is still last.
     */
    for (const words of ['storage-warning', 'hud-notice', 'hud-mode-label', 'interact-hint']) {
      expect(index('hud-task-indicator'), `${words} is drawn before the task`).toBeLessThan(
        index(words),
      );
    }
    expect(order, 'the sentence and the indicator were both drawn').not.toContain('hud-quest-tracker');
    expect(index('hud-mode-label')).toBeLessThan(index('interact-hint'));
    expect(order.at(-1)).toBe('interact-hint');
  });

  it('keeps the task in its place when it arrives after the paragraphs below it', () => {
    /* The order is the slots', not the order the calls came in. */
    const { hud, at } = mount();
    hud.setHint('A mark shows someone or something you can choose. Get close, then choose.');
    hud.setMode('Walking');
    hud.setNotice('The questions are not ready right now. Try again later.');
    hud.setTask('Find the Town Clock');

    const order = testIdsIn(at('hud'));
    expect(order.indexOf('hud-quest-tracker')).toBeLessThan(order.indexOf('hud-notice'));
    expect(order.indexOf('hud-quest-tracker')).toBeGreaterThan(order.indexOf('menu-button'));

    hud.setTask('Answer 2 questions (1 of 2)');
    expect(at('hud-quest-tracker')?.textContent).toBe('Task: Answer 2 questions (1 of 2)');
    expect(testIdsIn(at('hud')).filter((id) => id === 'hud-quest-tracker')).toHaveLength(1);
  });

  it('brings a new offer back to the top of the strip', () => {
    const { hud, at } = mount();
    const region = at('hud') as unknown as { scrollTop: number };
    region.scrollTop = 120;
    hud.setPrompt('Talk to the guide');
    expect(region.scrollTop, 'the offer arrived out of sight').toBe(0);
  });
});

describe('the one-time hint, and the notice', () => {
  it('is a paragraph beside the prompt, never a control and never instead of it', () => {
    /*
     * `TN-REACH-04`: the hint blocks nothing. It is not a dialog, takes no
     * focus, is in no tab order and is in no switch ring — which is a property
     * of what it *is*, a `<p>`, rather than a rule applied to it. And it sits
     * beside the offer rather than replacing it.
     */
    const { hud, at } = mount();
    hud.setPrompt('Look at this place');
    hud.setHint('A mark shows something to see. Get close to it, then choose it.');

    const hint = at('interact-hint');
    expect(hint?.tagName).toBe('P');
    expect(hint?.getAttribute('aria-modal')).toBeNull();
    expect(hint?.tabIndex).toBe(-1);
    expect(at('interact-prompt'), 'the offer was replaced by the explanation').not.toBeNull();
  });

  it('is removed rather than hidden when it has done its job', () => {
    /* A hidden element is one stylesheet away from being visible and one screen
       reader away from being read. `TN-REACH-04` requires it to be absent from
       the accessibility tree. */
    const { hud, at } = mount();
    hud.setHint('A mark shows something to see.');
    hud.setHint(null);
    expect(at('interact-hint')).toBeNull();
  });

  it('says nothing itself: the caller announces it once, or not at all', () => {
    const { hud, announce } = mount();
    hud.setHint('A mark shows something to see.');
    expect(announce).not.toHaveBeenCalled();
  });

  it('draws a notice for something the game cannot do, without blocking anything', () => {
    /*
     * `TN-QUEST-05`: "the questions are not ready right now". A live-region
     * message with nothing on screen is audible to one player and invisible to
     * every other, so it is drawn as well as announced — and it is a paragraph,
     * because the story requires the skater to be able to move away.
     */
    const { hud, at } = mount();
    hud.setNotice('The questions are not ready right now. Try again later.');
    const notice = at('hud-notice');
    expect(notice?.tagName).toBe('P');
    expect(notice?.textContent).toBe('The questions are not ready right now. Try again later.');
    expect(notice?.getAttribute('aria-modal')).toBeNull();

    hud.setNotice(null);
    expect(at('hud-notice')).toBeNull();
  });

  it('keeps neither in the switch ring, because neither is a control', () => {
    const { hud, page, clock } = mount({ singleSwitch: true, holdMs: 500 });
    hud.setPrompt('Look at this place');
    hud.setHint('A mark shows something to see.');
    hud.setNotice('The questions are not ready right now.');
    hud.openMenu();

    /* The ring walks the menu's controls; nothing in the strip is one of them,
       and the two paragraphs above cannot be highlighted as if they were. */
    pressSwitch(page, clock, 100);
    expect(page.doc.byTestId('interact-hint')?.getAttribute('data-switch-highlight')).toBeNull();
    expect(page.doc.byTestId('hud-notice')?.getAttribute('data-switch-highlight')).toBeNull();
  });
});

/**
 * ADR-0066 §2: the strip shows one job at a time. At 200 % text on a 390 px
 * phone an offer and a task sentence together did not fit a third of the
 * screen on every level, so while an offer is up the task is a word and a
 * count, and the sentence lives in the menu. Line geometry is `tests/a11y`'s;
 * what is drawn, what is said and what is announced is proved here.
 */
describe('the offer and the task take turns (ADR-0066)', () => {
  const clock = 'Find the Town Clock';
  const position = { number: 3, of: 9 };
  const highlighted = (page: FakePage): string | null =>
    page.doc.querySelector('[data-switch-highlight="true"]')?.getAttribute('data-testid') ?? null;

  it('draws the task in full while nothing is in reach', () => {
    const { hud, at } = mount();
    hud.setTask(clock, { position });
    expect(at('hud-quest-tracker')?.textContent).toBe('Task: Find the Town Clock');
    expect(at('hud-task-indicator')).toBeNull();
  });

  it('collapses the task to "Task 3/9" while an offer is up, and gives it back after', () => {
    const { hud, at } = mount();
    hud.setTask(clock, { position });
    hud.setPrompt('Look at the clock');

    expect(at('hud-quest-tracker'), 'the sentence was drawn beside the offer').toBeNull();
    const indicator = at('hud-task-indicator');
    expect(indicator?.tagName).toBe('P');
    expect(at('hud-task-indicator-text')?.textContent).toBe('Task 3/9');

    hud.setPrompt(null);
    expect(at('hud-task-indicator')).toBeNull();
    expect(at('hud-quest-tracker')?.textContent).toBe('Task: Find the Town Clock');
  });

  it('names the indicator with the same thing expanded, never the hidden sentence', () => {
    /*
     * The visible words are hidden from assistive technology and a visually
     * hidden twin says them for speech. What must not happen is the full task
     * sentence reaching a screen reader while a sighted player sees a count:
     * two different strips for two different players (ADR-0066 §2, TN-REACH).
     */
    const { hud, at } = mount();
    hud.setTask(clock, { position });
    hud.setPrompt('Look at the clock');

    const indicator = at('hud-task-indicator');
    expect(indicator?.getAttribute('aria-label'), 'a name on a paragraph').toBeNull();
    expect(at('hud-task-indicator-text')?.getAttribute('aria-hidden')).toBe('true');
    const name = at('hud-task-indicator-name');
    expect(name?.getAttribute('aria-hidden')).toBeNull();
    expect(name?.className).toBe('tn-hud__spoken');
    expect(name?.textContent).toBe('Task 3 of 9');
    expect(indicator?.textContent ?? '').not.toContain(clock);
    expect(indicator?.getAttribute('aria-live')).toBeNull();
  });

  it('is French, with the colon rule and « sur » for speech', () => {
    const { hud, at } = mount({ locale: 'fr' });
    hud.setTask("Trouvez la tour de l'horloge", { position });
    hud.setPrompt("Regarder l'horloge");
    expect(at('hud-task-indicator-text')?.textContent).toBe('Mission 3/9');
    expect(at('hud-task-indicator-name')?.textContent).toBe('Mission 3 sur 9');

    const english = mount();
    english.hud.setTask(clock, { position });
    english.hud.setPrompt('Look at the clock');
    english.hud.setLocale('fr');
    expect(english.at('hud-task-indicator-text')?.textContent).toBe('Mission 3/9');
  });

  it('draws the word alone when no position was given, still one bounded line', () => {
    const { hud, at } = mount();
    hud.setTask(clock);
    hud.setPrompt('Look at the clock');
    expect(at('hud-task-indicator-text')?.textContent).toBe('Task');
    expect(at('hud-task-indicator-name')?.textContent).toBe('Task');
  });

  it('keeps "Behind you" with the full row and never beside the indicator', () => {
    const { hud, at, announce } = mount();
    hud.setTask(clock, { position });
    hud.setTaskCue('behind');
    expect(at('hud-task-cue')?.textContent).toBe('Behind you');

    announce.mockClear();
    hud.setPrompt('Look at the clock');
    expect(at('hud-task-cue'), 'the cue was drawn beside the indicator').toBeNull();

    hud.setPrompt(null);
    const slot = (at('hud-quest-tracker')?.parentElement?.children ?? []).map((child) =>
      child.getAttribute('data-testid'),
    );
    expect(slot).toEqual(['hud-quest-tracker', 'hud-task-cue']);
    /* Said once when it became true, and not again for the offer coming and
       going: the task did not change. */
    expect(announce).not.toHaveBeenCalled();
  });

  it('still announces a new task in full, whatever is in reach', () => {
    const { hud, announce } = mount();
    hud.setPrompt('Look at the clock');
    hud.setTask('Answer 3 questions (0 of 3)', { position: { number: 3, of: 9 } });
    expect(announce).toHaveBeenCalledWith('Task: Answer 3 questions (0 of 3)', 'en');

    announce.mockClear();
    /* The same line, moved by nothing but its count, is redrawn and not said. */
    hud.setTask('Answer 3 questions (0 of 3)', { position: { number: 4, of: 9 } });
    expect(announce).not.toHaveBeenCalled();
  });

  it('draws the task in full in the menu, whatever is in reach', () => {
    const { hud, at } = mount();
    expect(at('menu-task')?.hidden, 'a task line with no task').toBe(true);

    hud.setTask(clock, { position });
    hud.setPrompt('Look at the clock');
    hud.openMenu();
    expect(at('menu-task')?.hidden).toBe(false);
    expect(at('menu-task')?.textContent).toBe('Your task: Find the Town Clock');
    expect(at('menu-task')?.tagName).toBe('P');

    hud.setLocale('fr');
    expect(at('menu-task')?.textContent).toBe('Votre mission : Find the Town Clock');

    hud.setTask(null);
    expect(at('menu-task')?.hidden).toBe(true);
    expect(at('menu-task')?.textContent).toBe('');
  });

  it('keeps the indicator and the menu line out of the switch ring', () => {
    const { hud, page, clock: time } = mount({ singleSwitch: true, holdMs: 600 });
    hud.setTask(clock, { position });
    hud.setPrompt('Look at the clock');
    const seen = new Set<string | null>();
    for (let press = 0; press < 6; press += 1) {
      seen.add(highlighted(page));
      pressSwitch(page, time, 100);
    }
    expect([...seen].sort()).toEqual(['hud-settings-button', 'interact-prompt', 'menu-button'].sort());
  });
});

/**
 * "Behind you", after the task. A second live-site audit walked past the Town
 * Clock and the tracker still read "Find the Town Clock" with no hint that the
 * clock was behind. The composition root decides when; the HUD draws the words.
 */
describe('the cue after the task', () => {
  const slotOrder = (at: Fixture['at']): (string | null)[] =>
    (at('hud-quest-tracker')?.parentElement?.children ?? []).map((child) =>
      child.getAttribute('data-testid'),
    );

  it('says the stop is behind, after the task line, and leaves the task words alone', () => {
    const { hud, at, announce } = mount();
    hud.setTask('Find the Town Clock');
    announce.mockClear();

    hud.setTaskCue('behind');
    expect(at('hud-task-cue')?.textContent).toBe('Behind you');
    expect(at('hud-quest-tracker')?.textContent).toBe('Task: Find the Town Clock');
    expect(slotOrder(at)).toEqual(['hud-quest-tracker', 'hud-task-cue']);

    /* Said once, with the task, when it starts to be true. */
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Behind you: Find the Town Clock', 'en');
    hud.setTaskCue('behind');
    expect(announce).toHaveBeenCalledTimes(1);

    hud.setTaskCue(null);
    expect(at('hud-task-cue')).toBeNull();
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('is a paragraph with no live region and no place in the switch ring or the Tab order', () => {
    const { hud, at } = mount();
    hud.setTask('Find the Town Clock');
    hud.setTaskCue('behind');
    const cue = at('hud-task-cue');
    expect(cue?.tagName).toBe('P');
    expect(cue?.getAttribute('aria-live')).toBeNull();
    expect(cue?.getAttribute('role')).toBeNull();
    expect(cue?.tabIndex).toBe(-1);
  });

  it('is drawn only while there is a task, and stays in the task slot above the paragraphs', () => {
    const { hud, at, announce } = mount();
    hud.setTaskCue('behind');
    expect(at('hud-task-cue'), 'a cue with no task says nothing about anything').toBeNull();
    expect(announce).not.toHaveBeenCalled();

    hud.setMode('Walking');
    hud.setNotice('The questions are not ready right now. Try again later.');
    hud.setTask('Find the Town Clock');
    expect(slotOrder(at)).toEqual(['hud-quest-tracker', 'hud-task-cue']);

    hud.setTask(null);
    expect(at('hud-quest-tracker')).toBeNull();
    expect(at('hud-task-cue')).toBeNull();
  });

  it('is French, and follows a change of language in place', () => {
    const french = mount({ locale: 'fr' });
    french.hud.setTask("Trouvez la tour de l'horloge");
    french.announce.mockClear();
    french.hud.setTaskCue('behind');
    expect(french.at('hud-task-cue')?.textContent).toBe('Derrière vous');
    expect(french.announce).toHaveBeenCalledWith("Derrière vous : Trouvez la tour de l'horloge", 'fr');

    const { hud, at } = mount();
    hud.setTask('Find the Town Clock');
    hud.setTaskCue('behind');
    hud.setLocale('fr');
    expect(at('hud-task-cue')?.textContent).toBe('Derrière vous');
    expect(slotOrder(at)).toEqual(['hud-quest-tracker', 'hud-task-cue']);
  });
});

describe('the storage warning', () => {
  it('is absent from the tree when nothing is wrong', () => {
    /* TN-HUD-03: "not merely hidden behind a style rule that something else can
       override" — the exact defect axe found in this directory before. */
    const { at } = mount();
    expect(at('storage-warning')).toBeNull();
  });

  it('is inside the HUD, with both sentences, when storage cannot be written', () => {
    const { hud, at } = mount();
    hud.setStorageWarning(true);

    const warning = at('storage-warning');
    expect(warning?.closest('[data-testid="hud"]')).not.toBeNull();
    expect(warning?.textContent).toContain('This browser is not saving your progress.');
    expect(warning?.textContent).toContain(
      'You can keep playing, but everything will be gone when you close the tab.',
    );
  });

  it('is not a second announcer, and is spoken once', () => {
    const { hud, at, announce } = mount();
    hud.setStorageWarning(true);
    hud.setStorageWarning(true);

    expect(at('storage-warning')?.getAttribute('aria-live')).toBeNull();
    expect(at('storage-warning')?.getAttribute('role')).toBeNull();
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('offers the way out TN-SAVE promises, and nothing to dismiss', () => {
    const { hud, at, handlers } = mount();
    hud.setStorageWarning(true);

    at('save-export')?.click();
    expect(handlers['onExportSave']).toHaveBeenCalledTimes(1);
    /* It is never the thing that has to be dismissed to carry on. */
    expect(at('storage-warning')?.querySelectorAll('[data-testid="storage-warning-close"]')).toEqual(
      [],
    );
  });

  it('leaves the tracker and the menu button operable', () => {
    const { hud, at } = mount();
    hud.setTask('Find the Peace Tower');
    hud.setStorageWarning(true);

    expect(at('hud-quest-tracker')).not.toBeNull();
    expect(at('menu-button')?.closest('[inert]')).toBeNull();
  });

  it('goes away again when storage starts working', () => {
    const { hud, at } = mount();
    hud.setStorageWarning(true);
    hud.setStorageWarning(false);
    expect(at('storage-warning')).toBeNull();
  });
});

describe('the menu', () => {
  it('opens paused, as a named modal dialog', () => {
    const { hud, at, handlers } = mount();
    at('menu-button')?.click();

    const menu = at('menu');
    expect(menu?.hidden).toBe(false);
    expect(menu?.getAttribute('role')).toBe('dialog');
    expect(menu?.getAttribute('aria-modal')).toBe('true');
    expect(hud.main.ownerDocument.getElementById(menu?.getAttribute('aria-labelledby') ?? '')
      ?.textContent).toBe('Menu');
    expect(handlers['onPause']).toHaveBeenCalledTimes(1);
  });

  it('offers Settings, Study and the passport, each with a visible label', () => {
    const { at } = mount();
    at('menu-button')?.click();

    expect(at('menu-settings')?.textContent).toBe('Settings');
    expect(at('menu-study')?.textContent).toBe('Study');
    expect(at('menu-passport')?.textContent).toBe('See my passport');
    expect(at('menu-close')?.textContent).toBe('Close');
  });

  it('offers the way out of the level when there is one, and only then', () => {
    /*
     * `TN-HUD-02`, amended 2026-09-08, and `TN-FLOW-03`. Before this item a
     * player who reached a level from the level select had no way back except
     * the browser's back button, which this game must not depend on. The second
     * half matters as much: a menu with nothing to leave does not offer it.
     */
    const onLeaveLevel = vi.fn();
    const { at } = mount({ onLeaveLevel });
    at('menu-button')?.click();
    expect(at('menu-leave')?.textContent).toBe('Leave the level');

    at('menu-leave')?.click();
    expect(onLeaveLevel).toHaveBeenCalledTimes(1);
    /* One screen at a time: the menu is gone before the route is taken. */
    expect(at('menu')?.hidden).toBe(true);

    const without = mount();
    without.at('menu-button')?.click();
    expect(without.at('menu-leave')).toBeNull();
  });

  it('makes the HUD inert while it is open, so the menu cannot be opened over itself', () => {
    /* TN-HUD-04, and the same mechanism that stops a modal being reached over a
       question card: the trap inerts everything outside the dialog. */
    const { hud, at } = mount();
    at('menu-button')?.click();

    expect(hud.main.inert).toBe(true);
    expect(at('menu-button')?.closest('[inert]')).toBe(hud.main);
  });

  it('closes back to the game and gives focus to the menu button', () => {
    const { at, handlers, page } = mount();
    const button = at('menu-button');
    button?.focus();
    button?.click();

    at('menu-close')?.click();

    expect(at('menu')?.hidden).toBe(true);
    expect(handlers['onResume']).toHaveBeenCalledTimes(1);
    expect(page.doc.activeElement).toBe(button);
  });

  it('closes on Escape, and gives focus back', () => {
    const { at, page, handlers } = mount();
    const button = at('menu-button');
    button?.focus();
    button?.click();

    press(at('menu') as FakeElement, 'Escape');

    expect(at('menu')?.hidden).toBe(true);
    expect(page.doc.activeElement).toBe(button);
    expect(handlers['onResume']).toHaveBeenCalledTimes(1);
  });

  it('leaves exactly one dialog on the page when an item is chosen', () => {
    /* TN-HUD-04: "one screen at a time". The menu goes before the screen it
       asked for arrives, which is also what leaves menu-button as the return
       point for the screen that opens next. */
    const { at, handlers, page } = mount();
    const button = at('menu-button');
    button?.focus();
    button?.click();
    at('menu-settings')?.click();

    expect(at('menu')?.hidden).toBe(true);
    expect(handlers['onOpenSettings']).toHaveBeenCalledTimes(1);
    expect(page.doc.activeElement).toBe(button);
  });

  it('does not resume the game when a screen was opened from it', () => {
    /* TN-HUD-04: "the game does not resume behind an open screen". */
    const { at, handlers } = mount();
    at('menu-button')?.click();
    at('menu-study')?.click();

    expect(handlers['onOpenStudy']).toHaveBeenCalledTimes(1);
    expect(handlers['onResume']).not.toHaveBeenCalled();
  });

  it('is reachable and choosable with one switch, and nothing scans by itself', () => {
    /* TN-HUD-06. */
    const { page, hud, at, clock } = mount({ singleSwitch: true, holdMs: 600 });
    at('menu-button')?.click();
    hud.setSingleSwitch(true, 600);

    const first = at('menu-settings');
    expect(first?.getAttribute('data-switch-highlight')).toBe('true');

    pressSwitch(page, clock, 100);
    expect(at('menu-study')?.getAttribute('data-switch-highlight')).toBe('true');

    /* Two minutes pass on the injected clock and nothing has moved. */
    clock.now += 120_000;
    expect(at('menu-study')?.getAttribute('data-switch-highlight')).toBe('true');

    pressSwitch(page, clock, 700);
    expect(at('menu')?.hidden).toBe(true);
  });
});

describe('the HUD in French', () => {
  it('redraws every label it owns without rebuilding the level', () => {
    /* TN-HUD-09. */
    const { hud, at } = mount({ locale: 'fr' });
    hud.setMode('Patinage');
    hud.setTask('Répondez à 3 questions (0 sur 3)');
    hud.setStorageWarning(true);

    expect(at('menu-button')?.textContent).toBe('Menu');
    /* TN-HUD-09, "The region's name is French". */
    expect(at('hud')?.getAttribute('aria-label')).toBe('Commandes du jeu');
    expect(at('hud-mode-label')?.textContent).toBe('Patinage');
    /* Canadian French puts a space before a colon. */
    expect(at('hud-quest-tracker')?.textContent).toBe('Mission : Répondez à 3 questions (0 sur 3)');
    expect(at('storage-warning')?.textContent).toContain(
      "Ce navigateur n'enregistre pas votre progression.",
    );
  });

  it('switches language in place, warning and menu included', () => {
    const { hud, at } = mount();
    hud.setTask('Answer 3 questions (0 of 3)');
    hud.setStorageWarning(true);

    hud.setLocale('fr');
    at('menu-button')?.click();

    /* TN-HUD-09's last scenario: the language changes from the menu and the
       region's name changes with it, without the level being rebuilt. A name
       supplied by the caller could not do this. */
    expect(at('hud')?.getAttribute('aria-label')).toBe('Commandes du jeu');
    expect(at('hud-quest-tracker')?.textContent).toContain('Mission :');
    expect(at('storage-warning')?.textContent).toContain('Ce navigateur');
    expect(at('menu-settings')?.textContent).toBe('Réglages');
    expect(at('menu-passport')?.textContent).toBe('Voir mon passeport');
  });

  /**
   * `TN-SET-01` wants Settings "from the game", and it was reachable only
   * behind the menu — which was reported as unreachable, because a player who
   * does not know a menu contains it has to open the menu to find out. Both
   * routes exist now and both open the same screen.
   */
  describe('settings, on the strip', () => {
    it('draws a Settings control beside Menu, with a visible label', () => {
      const { at } = mount({ onOpenSettings: () => undefined });
      const control = at('hud-settings-button');
      expect(control?.hidden).toBe(false);
      expect(control?.textContent).toBe('Settings');
    });

    it('opens settings without going through the menu', () => {
      const onOpenSettings = vi.fn();
      const { at } = mount({ onOpenSettings });
      at('hud-settings-button')?.click();
      expect(onOpenSettings).toHaveBeenCalledTimes(1);
    });

    it('draws no control when nothing is wired, rather than a dead one', () => {
      /* Built directly rather than through `mount`, which wires every handler:
         the state under test is the one where the caller wired none. */
      const page = buildPage();
      createHud(page.host, { locale: 'en' });
      expect(page.doc.byTestId('hud-settings-button')?.hidden).toBe(true);
    });

    it('becomes French with the rest of the strip, without a reload', () => {
      const { hud, at } = mount({ onOpenSettings: () => undefined });
      hud.setLocale('fr');
      expect(at('hud-settings-button')?.textContent).toBe('Réglages');
    });
  });
});

/**
 * One switch, **in the level**, with no sheet open — the half of `TN-HUD-06`
 * that was never built.
 *
 * A live-site audit in single-switch mode reached Halifax, waited for "Talk to
 * the guide", and tapped the sky fourteen times: no `data-switch-highlight`
 * existed anywhere on the page, focus sat on `main`, and long presses chose
 * nothing. Scanning worked in Settings and inside every sheet, because those
 * surfaces own rings; between two sheets there was no ring at all, so the player
 * walked past every landmark unable to engage one.
 */
describe('one switch, while the level is running', () => {
  /** The one control the switch would choose, by its marker. */
  const highlighted = (page: FakePage): string | null =>
    page.doc.querySelector('[data-switch-highlight="true"]')?.getAttribute('data-testid') ?? null;

  it('opens the highlight on a control, walks the strip, wraps, and scans nothing by itself', () => {
    const { page, clock, announce } = mount({ singleSwitch: true, holdMs: 600 });

    /* A level entered with the setting already on has a highlight before the
       player presses anything (`TN-FLOW-07`). */
    expect(highlighted(page)).toBe('hud-settings-button');

    pressSwitch(page, clock, 100);
    expect(highlighted(page)).toBe('menu-button');
    /* And the player is told where the highlight is, through the one live
       region — the strip is silent for everything else it draws. */
    expect(announce).toHaveBeenCalledWith('Menu', 'en');

    /* A ring of two wraps. */
    pressSwitch(page, clock, 100);
    expect(highlighted(page)).toBe('hud-settings-button');

    /* Two minutes pass on the injected clock and nothing has moved: no scanner,
       no countdown, nothing chosen for the player. */
    clock.now += 120_000;
    expect(highlighted(page)).toBe('hud-settings-button');
  });

  it('puts the offer in the ring and engages it with a long press', () => {
    const { hud, page, clock, handlers } = mount({ singleSwitch: true, holdMs: 600 });
    hud.setPrompt('Talk to the guide');

    /*
     * The offer joins the ring where it is drawn — first, ADR-0039 — and the
     * highlight does **not** jump to it. A control that moves under a player's
     * thumb because the world changed is how a hold aimed at one thing takes
     * another (the reason a confirmation's question is a stop, `app/ui/confirm.ts`).
     */
    expect(highlighted(page)).toBe('hud-settings-button');

    pressSwitch(page, clock, 100);
    expect(highlighted(page)).toBe('menu-button');
    pressSwitch(page, clock, 100);
    expect(highlighted(page)).toBe('interact-prompt');

    pressSwitch(page, clock, 700);
    expect(handlers['onInteract']).toHaveBeenCalledTimes(1);
  });

  it('stands down while a screen is over the level and takes the contact back after it', () => {
    const { hud, page, clock } = mount({ singleSwitch: true, holdMs: 600 });

    hud.setCovered(true);
    expect(highlighted(page)).toBeNull();
    pressSwitch(page, clock, 100);
    expect(highlighted(page), 'the strip scanned under an open screen').toBeNull();

    hud.setCovered(false);
    expect(highlighted(page)).toBe('hud-settings-button');
  });

  it('refuses to scan a strip a dialog has made inert, whatever the caller said', () => {
    /*
     * What `app/ui/focus-trap.ts` does to everything behind an open dialog. The
     * guard decides the direction a mistake fails in: a caller that forgets to
     * bracket its screen leaves the player with no highlight — recoverable by
     * closing that screen — never with two rings answering one contact.
     */
    const { hud, page } = mount({ singleSwitch: true, holdMs: 600 });
    hud.main.inert = true;
    hud.setSingleSwitch(true, 600);

    expect(highlighted(page)).toBeNull();
  });

  it('hands the contact to the menu and takes it back when the menu closes', () => {
    const { hud, at, page, clock } = mount({ singleSwitch: true, holdMs: 600 });
    hud.openMenu();

    /* One ring at a time: the menu's, while the menu is there (`TN-HUD-06`). */
    expect(page.doc.querySelectorAll('[data-switch-highlight="true"]')).toHaveLength(1);
    expect(at('menu-settings')?.getAttribute('data-switch-highlight')).toBe('true');
    pressSwitch(page, clock, 100);
    expect(at('menu-study')?.getAttribute('data-switch-highlight')).toBe('true');
    expect(at('menu-button')?.getAttribute('data-switch-highlight')).toBeNull();

    at('menu-close')?.click();
    expect(highlighted(page)).toBe('hud-settings-button');
  });

  it('keeps the paragraphs out of the ring and the warning way out in it', () => {
    const { hud, page, clock } = mount({ singleSwitch: true, holdMs: 600 });
    hud.setTask('Find the Town Clock');
    hud.setTaskCue('behind');
    hud.setNotice('The questions are not ready right now.');
    hud.setHint('A mark shows something to see.');
    hud.setPrompt('Look at this place');
    /* `TN-HUD-06`: the warning is never highlighted as if it were a control, and
       every real control — including its "Save a copy" — stays reachable. */
    hud.setStorageWarning(true);

    const seen = new Set<string | null>();
    for (let press = 0; press < 10; press += 1) {
      seen.add(highlighted(page));
      pressSwitch(page, clock, 100);
    }

    expect([...seen].sort()).toEqual(
      ['hud-settings-button', 'interact-prompt', 'menu-button', 'save-export'].sort(),
    );
  });
});
