import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { text } from '@ui/copy';
import { createLearnScreen, type LearnState } from '@ui/learn-screen';
import { HIGHLIGHT_ATTRIBUTE } from '@ui/single-switch';

import { buildPage, press, pressSwitch, type FakeElement } from './support/fake-dom';

/**
 * The Learn screen (`docs/stories/TN-LEARN-reading-the-guide-by-chapter.md`).
 *
 * Structure and behaviour only — roles, names, focus, the ring, which handler
 * ran. Whether a title fits at 200 % or a button is 44 px is asserted in
 * Chromium by `tests/a11y/learn.spec.ts`, where it can actually fail.
 */

const CHAPTERS: LearnState = {
  kind: 'chapters',
  chapters: [
    { id: 'rights-and-responsibilities-of-citizenship', title: 'Rights and Responsibilities of Citizenship' },
    { id: 'who-we-are', title: 'Who We Are' },
    { id: 'canadas-history', title: "Canada's History" },
  ],
};

const HISTORY = { id: 'canadas-history', title: "Canada's History" };

const LESSONS: LearnState = {
  kind: 'lessons',
  chapter: HISTORY,
  lessons: [
    { id: 'history-01', title: 'First peoples and the first Europeans' },
    { id: 'history-02', title: 'A British colony' },
  ],
};

function open(overrides: Partial<Parameters<typeof createLearnScreen>[1]> = {}) {
  const page = buildPage();
  const clock = { now: 0 };
  const handlers = {
    onChapter: vi.fn(),
    onLesson: vi.fn(),
    onRetry: vi.fn(),
    onBack: vi.fn(),
    announce: vi.fn(),
  };
  const screen = createLearnScreen(page.host, {
    locale: 'en',
    now: () => clock.now,
    ...handlers,
    ...overrides,
  });
  return {
    page,
    clock,
    screen,
    ...handlers,
    at: (testId: string) => page.doc.byTestId(testId),
    highlighted: (): string | null =>
      page.doc.querySelector(`[${HIGHLIGHT_ATTRIBUTE}="true"]`)?.getAttribute('data-testid') ?? null,
  };
}

describe('the Learn screen', () => {
  it('is a dialog named "Learn", described by its intro, listing the chapters as an ordered list', () => {
    const { screen, at, page } = open();
    screen.show(CHAPTERS);

    const dialog = at('learn') as FakeElement;
    expect(dialog.hidden).toBe(false);
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(page.ui.find(dialog.getAttribute('aria-labelledby'))?.textContent).toBe(
      text('en', 'learn.title'),
    );
    expect(page.ui.find(dialog.getAttribute('aria-describedby'))?.textContent).toBe(
      text('en', 'learn.intro'),
    );

    const list = at('learn-chapters') as FakeElement;
    expect(list.tagName.toLowerCase()).toBe('ol');
    const buttons = list.querySelectorAll('button');
    expect(buttons.map((control) => control.textContent)).toEqual([
      'Rights and Responsibilities of Citizenship',
      'Who We Are',
      "Canada's History",
    ]);
    expect(buttons.map((control) => control.getAttribute('data-testid'))).toEqual([
      'learn-chapter-rights-and-responsibilities-of-citizenship',
      'learn-chapter-who-we-are',
      'learn-chapter-canadas-history',
    ]);
    expect(at('learn-back')?.textContent).toBe(text('en', 'common.back'));
    /* One live region on the page, and this screen is not a second one. */
    expect(dialog.querySelectorAll('[aria-live]')).toEqual([]);
  });

  it('reports the chapter, the lesson, Back and Escape, and chooses none of them itself', () => {
    const { screen, at, onChapter, onLesson, onBack } = open();
    screen.show(CHAPTERS);
    at('learn-chapter-who-we-are')?.click();
    expect(onChapter).toHaveBeenCalledWith('who-we-are');

    screen.setState(LESSONS);
    at('learn-lesson-history-02')?.click();
    expect(onLesson).toHaveBeenCalledWith('history-02');

    at('learn-back')?.click();
    press(at('learn') as FakeElement, 'Escape');
    expect(onBack).toHaveBeenCalledTimes(2);
  });

  it('says it is waiting, in words and with aria-busy, and stops saying so when the lessons arrive', () => {
    const { screen, at, announce } = open();
    screen.show(CHAPTERS);
    screen.setState({ kind: 'loading', chapter: HISTORY });

    expect(at('learn')?.getAttribute('aria-busy')).toBe('true');
    expect(at('learn-title')?.textContent).toBe("Canada's History");
    expect(at('learn-intro')?.textContent).toBe(text('en', 'learn.loading'));
    expect(announce).toHaveBeenCalledWith(`Canada's History. ${text('en', 'learn.loading')}`);

    screen.setState(LESSONS);
    expect(at('learn')?.hasAttribute('aria-busy')).toBe(false);
  });

  it('names the dialog by the chapter, says it once, and puts focus on the first lesson', () => {
    const { screen, at, page, announce } = open();
    screen.show(CHAPTERS);
    screen.setState(LESSONS);

    expect(at('learn-title')?.textContent).toBe("Canada's History");
    expect(at('learn-intro')?.textContent).toBe(text('en', 'learn.lessons.intro'));
    expect(at('learn-lessons')?.tagName.toLowerCase()).toBe('ol');
    expect(page.doc.activeElement?.getAttribute('data-testid')).toBe('learn-lesson-history-01');
    expect(announce).toHaveBeenCalledWith("Canada's History");
  });

  it('puts focus back on the chapter the player came back from', () => {
    const { screen, page } = open();
    screen.show(CHAPTERS);
    screen.setState(LESSONS);
    screen.setState({ ...CHAPTERS, focus: 'canadas-history' });
    expect(page.doc.activeElement?.getAttribute('data-testid')).toBe('learn-chapter-canadas-history');

    screen.focusItem('who-we-are');
    expect(page.doc.activeElement?.getAttribute('data-testid')).toBe('learn-chapter-who-we-are');
  });

  it('offers Try again for a chapter that would not download, and says so once', () => {
    const { screen, at, page, onRetry, announce } = open();
    screen.show(CHAPTERS);
    screen.setState({ kind: 'error', chapter: HISTORY });

    expect(at('learn-error')?.textContent).toBe(text('en', 'learn.error'));
    expect(page.doc.activeElement?.getAttribute('data-testid')).toBe('learn-error');
    expect(announce).toHaveBeenCalledWith(text('en', 'learn.error'));
    at('learn-retry')?.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not offer Try again for a chapter with nothing readable, because it cannot help', () => {
    const { screen, at } = open();
    screen.show(CHAPTERS);
    screen.setState({ kind: 'empty', chapter: HISTORY });

    expect(at('learn-empty')?.textContent).toBe(text('en', 'learn.chapter.empty'));
    expect(at('learn-retry')).toBeNull();
    expect(at('learn-back')).not.toBeNull();
  });

  it('is one scanning ring over the chapters then Back, and a long press opens a chapter', () => {
    const { screen, page, clock, highlighted, onChapter } = open({ singleSwitch: true, holdMs: 600 });
    screen.show(CHAPTERS);
    expect(highlighted()).toBe('learn-chapter-rights-and-responsibilities-of-citizenship');

    pressSwitch(page, clock, 10);
    expect(highlighted()).toBe('learn-chapter-who-we-are');
    pressSwitch(page, clock, 10);
    pressSwitch(page, clock, 10);
    expect(highlighted()).toBe('learn-back');
    pressSwitch(page, clock, 10);
    expect(highlighted()).toBe('learn-chapter-rights-and-responsibilities-of-citizenship');

    pressSwitch(page, clock, 900);
    expect(onChapter).toHaveBeenCalledWith('rights-and-responsibilities-of-citizenship');
  });

  it('moves the highlight to the first lesson when a chapter opens, and stands down when covered', () => {
    const { screen, page, clock, highlighted } = open({ singleSwitch: true });
    screen.show(CHAPTERS);
    screen.setState(LESSONS);
    expect(highlighted()).toBe('learn-lesson-history-01');

    screen.setCovered(true);
    expect(highlighted()).toBeNull();
    pressSwitch(page, clock, 10);
    expect(highlighted()).toBeNull();
    screen.setCovered(false);
    screen.focusItem('history-02');
    expect(highlighted()).toBe('learn-lesson-history-02');
  });

  it('changes language with the titles it is handed', () => {
    const { screen, at } = open();
    screen.show(CHAPTERS);
    screen.setLocale('fr', {
      kind: 'chapters',
      chapters: [{ id: 'canadas-history', title: "L'histoire du Canada" }],
    });
    expect(at('learn')?.getAttribute('lang')).toBe('fr');
    expect(at('learn-title')?.textContent).toBe(text('fr', 'learn.title'));
    expect(at('learn-chapter-canadas-history')?.textContent).toBe("L'histoire du Canada");
    expect(at('learn-back')?.textContent).toBe(text('fr', 'common.back'));
  });

  it('is handed ids and titles only: no content, no grant, no adapter', () => {
    /* ADR-0063 §6, and `a-read-step-reaches-a-reader.test.ts`'s reason: a type
       keeps the promise the day it is written and a gate keeps it afterwards. */
    const source = readFileSync(new URL('../../../app/ui/learn-screen.ts', import.meta.url), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const word of ['verification', 'sourceHash', 'LocalizedText', 'LessonDocument', '@adapters', 'content/']) {
      expect(code.includes(word), `learn-screen.ts mentions ${word}`).toBe(false);
    }
    expect(code.includes('setTimeout')).toBe(false);
  });
});
