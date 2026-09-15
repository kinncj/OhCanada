import { describe, expect, it, vi } from 'vitest';

import type { LevelId } from '@domain/ids';
import { createExamScreen, type ExamQuestionView } from '@ui/exam-screen';
import { createExamStartScreen } from '@ui/exam-start';
import type { MapEntry } from '@ui/level-select';
import { createMenu } from '@ui/menu';
import { createPassport } from '@ui/passport';
import { injectScreenStyles } from '@ui/screen-styles';
import { createSettingsScreen } from '@ui/settings-screen';
import { createSettingsStore, DEFAULT_SETTINGS } from '@ui/settings';

import { buildPage, type FakeElement } from './support/fake-dom';

/**
 * ADR-0045, the readability pass: what each finding changed in the structure a
 * screen draws. Geometry — the task inside the strip, "Next" on screen, no
 * sideways scroll at 200 % French — is measured in `tests/a11y/readability.spec.ts`.
 */

const css = (): string => injectScreenStyles(buildPage().document).textContent ?? '';

describe('words are never split by the browser', () => {
  it('declares no automatic hyphenation anywhere in the sheet', () => {
    expect(css()).not.toMatch(/hyphens:\s*auto/);
    expect(css()).toContain('hyphens: manual');
  });

  it('still lets a word too wide for its whole line wrap rather than push the page sideways', () => {
    expect(css()).toContain('overflow-wrap: break-word');
    /* The narrow boxes that must shrink below a word keep the stronger rule. */
    expect(css()).toContain('overflow-wrap: anywhere');
  });
});

describe('high contrast draws on as filled and off as an outline', () => {
  it('fills a chosen switch or option with ink, and leaves the others paper', () => {
    const sheet = css();
    const filled = /\[data-tn-contrast="high"\] \.tn-screen \[aria-checked="true"\],\s*\[data-tn-contrast="high"\] \.tn-screen \[aria-pressed="true"\] \{([^}]*)\}/.exec(sheet);
    expect(filled?.[1]).toContain('background: var(--tn-ink)');
    expect(filled?.[1]).toContain('color: var(--tn-paper)');
    const outline = /\[data-tn-contrast="high"\] \.tn-screen \[role="switch"\],\s*\[data-tn-contrast="high"\] \.tn-screen \[role="radio"\] \{([^}]*)\}/.exec(sheet);
    expect(outline?.[1]).toContain('background: var(--tn-paper)');
    expect(outline?.[1]).toContain('border-color: var(--tn-ink)');
  });

  it('puts the dark halo back on a focused chosen option, after the rules that took it away', () => {
    const sheet = css();
    const chosen = sheet.indexOf('[data-tn-contrast="high"] .tn-screen [aria-checked="true"]');
    const halo = sheet.indexOf('.tn-screen [role="radio"]:focus-visible');
    expect(chosen).toBeGreaterThan(-1);
    expect(halo, 'the focus halo is overridden by the chosen fill').toBeGreaterThan(chosen);
  });

  it('draws a switch with a track whose knob is a shape, beside its word', () => {
    const page = buildPage();
    createSettingsScreen(page.host, { store: createSettingsStore(DEFAULT_SETTINGS) }).show();
    for (const control of page.doc.querySelectorAll('[role="switch"]')) {
      /* Label, track, state: the track sits beside the word it draws. */
      const track = control.children[1];
      expect(track?.className).toBe('tn-switch');
      expect(control.children[2]?.className).toBe('tn-screen__state');
      expect(track?.getAttribute('aria-hidden')).toBe('true');
      expect(track?.textContent).toBe('');
      expect(track?.children[0]?.className).toBe('tn-switch__knob');
      /* The word is still there, and is still what is read. */
      expect(control.textContent).toMatch(/On|Off/);
    }
  });
});

describe('the text size row', () => {
  it('draws its name and its value on one line, above the slider', () => {
    const page = buildPage();
    createSettingsScreen(page.host, { store: createSettingsStore(DEFAULT_SETTINGS) }).show();
    const slider = page.doc.byTestId('setting-text-size');
    const row = slider?.parentElement;
    const head = row?.children[0];
    expect(head?.className).toBe('tn-settings__size-head');
    expect(head?.children.map((child) => child.tagName)).toEqual(['LABEL', 'SPAN']);
    expect(head?.children[1]?.getAttribute('data-testid')).toBe('setting-text-size-value');
    expect(row?.children[1]).toBe(slider);
  });
});

describe('menus hug what they offer', () => {
  it('draws the level menu as a sheet over the level, with Close quiet', () => {
    const page = buildPage();
    const menu = createMenu(page.host, { locale: 'en' });
    menu.open();
    expect(menu.element.className.split(' ')).toContain('tn-screen--sheet');
    expect(page.doc.byTestId('menu-close')?.getAttribute('data-tn-action')).toBe('quiet');
    /* The items are directly under the title, in the one actions column. */
    const card = (menu.element as unknown as FakeElement).children[0];
    expect(card?.children.map((child) => child.tagName)).toEqual(['H1', 'DIV']);
  });

  it('draws the exam menu hugging its items, with the night kept behind it', () => {
    const page = buildPage();
    const exam = openExam(page.host);
    exam.show(0);
    page.doc.byTestId('exam-menu-button')?.click();
    const menu = page.doc.byTestId('exam-menu');
    expect(menu?.hidden).toBe(false);
    expect(menu?.className.split(' ')).toContain('tn-screen--hug');
  });
});

describe('the exam', () => {
  it('puts Previous and Next side by side, and keeps the reading order', () => {
    const page = buildPage();
    openExam(page.host).show(0);
    const previous = page.doc.byTestId('exam-previous');
    const step = previous?.parentElement;
    expect(step?.className).toBe('tn-exam__step');
    expect(step?.children.map((child) => child.getAttribute('data-testid'))).toEqual([
      'exam-previous',
      'exam-next',
    ]);
    const actions = step?.parentElement;
    expect(actions?.children.map((child) => child.getAttribute('data-testid') ?? child.className)).toEqual([
      'tn-exam__step',
      'exam-finish',
      'exam-menu-button',
    ]);
    /* Previous on question 1 is marked as not available, which the sheet draws. */
    expect(previous?.getAttribute('aria-disabled')).toBe('true');
    expect(css()).toContain('.tn-screen__actions button[aria-disabled="true"]');
  });

  it('draws the time limit inside the timer switch, under its label, not beside "No timer"', () => {
    const page = buildPage();
    const start = createExamStartScreen(page.host, { locale: 'en' });
    start.show({ kind: 'ready', questionCount: 20, passMark: 15, timeLimitMs: 30 * 60_000 });
    const toggle = page.doc.byTestId('exam-timer-toggle');
    const limit = page.doc.byTestId('exam-timer-limit');
    expect(limit?.textContent).toBe('30 minutes');
    expect(limit?.closest('[data-testid="exam-timer-toggle"]')).toBe(toggle);
    expect(toggle?.children[1]?.className).toBe('tn-switch');
    /* The untimed sentence is the group's, after the help, and no longer sits under the limit. */
    const group = page.doc.byTestId('exam-timer');
    expect(group?.children.map((child) => child.getAttribute('data-testid') ?? child.tagName)).toEqual([
      'exam-timer-toggle',
      'P',
      'exam-timer-state',
    ]);
  });
});

describe('the passport presses the stamp it earned', () => {
  const id = (value: string): LevelId => value as LevelId;
  const ENTRIES: readonly MapEntry[] = [
    { number: 1, id: id('halifax'), built: true, unlocked: true, stamped: true },
    { number: 2, id: id('peggys-cove'), built: true, unlocked: true },
    { number: 3, id: id('quebec-city'), built: false, unlocked: false },
  ];

  it('draws the completion card’s stamp, inked, on an earned slot', () => {
    const page = buildPage();
    const stampArt = vi.fn((levelId: string) => `/img/${levelId}-landmark.webp`);
    createPassport(page.host, { locale: 'en', entries: ENTRIES, stampArt }).show();

    const stamp = page.doc.byTestId('passport-stamp-art-halifax');
    expect(stamp).not.toBeNull();
    expect(stamp?.className.split(' ')).toEqual(['tn-stamp', 'tn-passport__stamp']);
    expect(stamp?.getAttribute('aria-hidden')).toBe('true');
    expect(stamp?.getAttribute('data-inked')).toBe('true');
    expect(stamp?.getAttribute('data-src')).toBe('/img/halifax-landmark.webp');
    /* Inside the page, so the slot is still the rail and its page. */
    expect(stamp?.closest('.tn-passport__page')).not.toBeNull();
    /* Asked only for the stamp that is earned. */
    expect(stampArt).toHaveBeenCalledTimes(1);
    expect(stampArt).toHaveBeenCalledWith('halifax');
  });

  it('draws no stamp on an unearned slot, and none at all without a picture', () => {
    const page = buildPage();
    createPassport(page.host, { locale: 'en', entries: ENTRIES, stampArt: () => null }).show();
    expect(page.doc.querySelectorAll('.tn-passport__stamp')).toHaveLength(0);

    const bare = buildPage();
    createPassport(bare.host, { locale: 'en', entries: ENTRIES }).show();
    expect(bare.doc.querySelectorAll('.tn-stamp')).toHaveLength(0);
  });

  it('adds nothing to what a slot says or how it is reached', () => {
    const page = buildPage();
    createPassport(page.host, { locale: 'en', entries: ENTRIES, stampArt: () => '/img/x.webp' }).show();
    const slot = page.doc.byTestId('stamp-halifax') as FakeElement;
    expect(slot.getAttribute('aria-label')).toBe('Level 1. Halifax. Earned');
    expect(slot.querySelectorAll('[tabindex]')).toHaveLength(0);
  });

  it('redraws the stamp once it is known, and lets the old one go', () => {
    const page = buildPage();
    let known: string | null = null;
    const passport = createPassport(page.host, {
      locale: 'en',
      entries: ENTRIES,
      stampArt: () => known,
    });
    passport.show();
    expect(page.doc.byTestId('passport-stamp-art-halifax')).toBeNull();
    known = '/img/halifax.webp';
    passport.setEntries(ENTRIES);
    expect(page.doc.documentElement.allByTestId('passport-stamp-art-halifax')).toHaveLength(1);
  });
});

function openExam(host: HTMLElement): ReturnType<typeof createExamScreen> {
  const question = (index: number): ExamQuestionView => ({
    index,
    total: 20,
    prompt: `Question wording ${String(index + 1)}`,
    options: ['A', 'B', 'C', 'D'],
    chosenIndex: null,
  });
  return createExamScreen(host, {
    locale: 'en',
    question,
    answered: () => 0,
    unanswered: () => [],
    timer: () => ({ kind: 'none' }),
    onChoose: () => undefined,
    onFinish: () => undefined,
    onLeave: () => undefined,
  });
}
