import { describe, expect, it, vi } from 'vitest';

import { text } from '@ui/copy';
import { createDialogue } from '@ui/dialogue';
import { createLevelComplete } from '@ui/level-complete';
import { createPoiCard } from '@ui/poi-card';
import { LANDSCAPE_URL } from '@ui/screen-art';
import { createStudyScreen } from '@ui/study-screen';
import { createTitleScreen } from '@ui/title-screen';

import { buildPage, FakeEvent, type FakeElement, type FakePage } from './support/fake-dom';

/**
 * ADR-0041: the landmark card, the dialogue, the completion card, the title
 * screen and the Study home draw a picture.
 *
 * Each picture is decoration beside words that already say what it shows, so
 * what is asserted here is the same four things for every screen:
 *
 *  1. **it is drawn** when the caller hands a picture over, and not otherwise;
 *  2. **it is silent** — an `aria-hidden` frame with an `alt=""` image, outside
 *     the element that names the dialog and the element that describes it;
 *  3. **it holds nothing** a keyboard or a switch can reach;
 *  4. **it goes** when it cannot load, and when the screen is destroyed.
 *
 * And the cards a level opens are sheets over it (`tn-screen--sheet`), so the
 * level stays in view; the title screen and Study home are not.
 */

const PICTURE = '/OhCanada/img/halifax-landmark-town-clock@1x.030021fe.webp';
const PORTRAIT = 'blob:https://kinncj.github.io/portrait-guide';

const at = (page: FakePage, testId: string): FakeElement | null => page.doc.byTestId(testId);

function imageOf(frame: FakeElement | null): FakeElement | null {
  return frame?.querySelector('img') ?? null;
}

/** The frame is silent: hidden from assistive technology, its image saying nothing. */
function expectDecoration(frame: FakeElement | null): void {
  expect(frame, 'the picture is not on the page').not.toBeNull();
  expect(frame?.getAttribute('aria-hidden')).toBe('true');
  expect(imageOf(frame)?.getAttribute('alt')).toBe('');
  expect(frame?.querySelectorAll('button')).toHaveLength(0);
  expect(frame?.querySelectorAll('[tabindex]')).toHaveLength(0);
}

describe('the landmark card draws the landmark', () => {
  const TOWN_CLOCK = {
    title: 'Halifax Town Clock',
    body: ['Halifax elected the first representative assembly in Canada, in 1758.'],
  } as const;

  it('shows the picture it is handed, as decoration', () => {
    const page = buildPage();
    const card = createPoiCard(page.host, { locale: 'en' });
    card.show({ ...TOWN_CLOCK, art: PICTURE });

    const frame = at(page, 'poi-card-art');
    expectDecoration(frame);
    expect(frame?.hidden).toBe(false);
    expect(imageOf(frame)?.getAttribute('src')).toBe(PICTURE);
  });

  it('is still named by its heading and described by its words alone', () => {
    const page = buildPage();
    const card = createPoiCard(page.host, { locale: 'en' });
    card.show({ ...TOWN_CLOCK, art: PICTURE });

    const root = at(page, 'poi-card');
    const described = page.doc.getElementById(root?.getAttribute('aria-describedby') ?? '');
    expect(page.doc.getElementById(root?.getAttribute('aria-labelledby') ?? '')?.textContent).toBe(
      'Halifax Town Clock',
    );
    expect(described?.querySelector('img')).toBeNull();
    expect(root?.textContent).not.toContain('webp');
  });

  it('draws no picture when none is handed over, including after one was', () => {
    const page = buildPage();
    const card = createPoiCard(page.host, { locale: 'en' });
    card.show(TOWN_CLOCK);
    expect(at(page, 'poi-card-art')?.hidden).toBe(true);

    card.show({ ...TOWN_CLOCK, art: PICTURE });
    card.hide();
    card.show(TOWN_CLOCK);
    expect(at(page, 'poi-card-art')?.hidden).toBe(true);
    expect(imageOf(at(page, 'poi-card-art'))?.getAttribute('src')).toBeNull();
  });

  it('takes the picture away when it cannot load, and keeps the words and the way out', () => {
    const page = buildPage();
    const card = createPoiCard(page.host, { locale: 'en' });
    card.show({ ...TOWN_CLOCK, art: PICTURE });
    imageOf(at(page, 'poi-card-art'))?.dispatchEvent(new FakeEvent('error'));

    expect(at(page, 'poi-card-art')?.hidden).toBe(true);
    expect(at(page, 'poi-card')?.textContent).toContain('Halifax Town Clock');
    expect(at(page, 'poi-card-close')?.textContent).toBe('Close');
  });

  it('is a sheet over the level, not a screen that replaces it', () => {
    const page = buildPage();
    createPoiCard(page.host, { locale: 'en' });
    expect(at(page, 'poi-card')?.className.split(' ')).toContain('tn-screen--sheet');
  });

  it('keeps focus on the controls: the picture is never the first stop', () => {
    const page = buildPage();
    const card = createPoiCard(page.host, { locale: 'en' });
    card.show({ ...TOWN_CLOCK, art: PICTURE });
    const focused = page.doc.activeElement;
    expect(focused === null || focused.closest('[data-testid="poi-card-art"]') === null).toBe(true);
  });

  it('removes the picture with the card', () => {
    const page = buildPage();
    const card = createPoiCard(page.host, { locale: 'en' });
    card.show({ ...TOWN_CLOCK, art: PICTURE });
    card.destroy();
    expect(at(page, 'poi-card-art')).toBeNull();
  });
});

describe('the dialogue draws who is speaking', () => {
  const GREETING = 'Hello! I am your guide. Welcome to Halifax.';

  it('shows the portrait beside the name, as decoration', () => {
    const page = buildPage();
    const dialogue = createDialogue(page.host, { speakerName: 'The guide', locale: 'en' });
    dialogue.show({ lines: [GREETING], portrait: PORTRAIT });

    const frame = at(page, 'dialogue-portrait');
    expectDecoration(frame);
    expect(frame?.hidden).toBe(false);
    expect(imageOf(frame)?.getAttribute('src')).toBe(PORTRAIT);
    /* Beside the name, in one row, and outside the lines. */
    expect(frame?.parentElement?.contains(at(page, 'dialogue-speaker') as FakeElement)).toBe(true);
    expect(at(page, 'dialogue-text')?.querySelector('img')).toBeNull();
  });

  it('is still named by the speaker, and the lines are still one paragraph each', () => {
    const page = buildPage();
    const dialogue = createDialogue(page.host, { speakerName: 'The guide', locale: 'en' });
    dialogue.show({ lines: [GREETING, 'Come with me.'], portrait: PORTRAIT });

    const root = at(page, 'dialogue');
    expect(page.doc.getElementById(root?.getAttribute('aria-labelledby') ?? '')?.textContent).toBe(
      'The guide',
    );
    expect(at(page, 'dialogue-text')?.children).toHaveLength(2);
  });

  it('draws the name alone for a speaker with no portrait', () => {
    const page = buildPage();
    const dialogue = createDialogue(page.host, { speakerName: 'The guide', locale: 'en' });
    dialogue.show({ lines: [GREETING], portrait: PORTRAIT });
    dialogue.show({ lines: [GREETING] });

    expect(at(page, 'dialogue-portrait')?.hidden).toBe(true);
    expect(at(page, 'dialogue-speaker')?.textContent).toBe('The guide');
  });

  it('is a sheet over the level', () => {
    const page = buildPage();
    createDialogue(page.host, { speakerName: 'The guide', locale: 'en' });
    expect(at(page, 'dialogue')?.className.split(' ')).toEqual(
      expect.arrayContaining(['tn-screen--dialogue', 'tn-screen--sheet']),
    );
  });

  it('removes the portrait with the dialogue', () => {
    const page = buildPage();
    const dialogue = createDialogue(page.host, { speakerName: 'The guide', locale: 'en' });
    dialogue.show({ lines: [GREETING], portrait: PORTRAIT });
    dialogue.destroy();
    expect(at(page, 'dialogue-portrait')).toBeNull();
  });
});

describe('the completion card presses the level’s stamp', () => {
  const STAMP = text('en', 'stamp.halifax.earned');

  it('draws an inked stamp beside the heading when the level is finished', () => {
    const page = buildPage();
    const card = createLevelComplete(page.host, { locale: 'en' });
    card.show({ reason: 'quest', stampMessage: STAMP, stampArt: PICTURE });

    const stamp = at(page, 'quest-complete-stamp-art');
    expect(stamp?.getAttribute('aria-hidden')).toBe('true');
    expect(stamp?.hidden).toBe(false);
    expect(stamp?.getAttribute('data-inked')).toBe('true');
    expect(stamp?.parentElement?.contains(page.doc.getElementById('tn-level-complete-title') as FakeElement)).toBe(true);

    stamp?.querySelector('img')?.dispatchEvent(new FakeEvent('load'));
    expect(stamp?.getAttribute('data-state')).toBe('ready');
  });

  it('draws the stamp as an outline on the card that says what is left', () => {
    const page = buildPage();
    const card = createLevelComplete(page.host, { locale: 'en' });
    card.show({ reason: 'unfinished', leftMessages: ['Finish the task.'], stampArt: PICTURE });

    const stamp = at(page, 'quest-complete-stamp-art');
    expect(stamp?.hidden).toBe(false);
    expect(stamp?.getAttribute('data-inked')).toBe('false');
  });

  it('draws no stamp when there is no picture to press it in', () => {
    const page = buildPage();
    const card = createLevelComplete(page.host, { locale: 'en' });
    card.show({ reason: 'level', stampMessage: STAMP });
    expect(at(page, 'quest-complete-stamp-art')?.hidden).toBe(true);
  });

  it('adds nothing to what is read or announced', () => {
    const page = buildPage();
    const announce = vi.fn();
    const card = createLevelComplete(page.host, { locale: 'en', announce });
    card.show({ reason: 'quest', stampMessage: STAMP, stampArt: PICTURE });

    const body = page.doc.getElementById('tn-level-complete-body');
    expect(body?.querySelector('.tn-stamp')).toBeNull();
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(`${text('en', 'quest.done.title')} ${STAMP}`, 'en');
  });

  it('keeps the stamp when the language changes with the card open', () => {
    const page = buildPage();
    const card = createLevelComplete(page.host, { locale: 'en' });
    card.show((locale) => ({
      reason: 'quest',
      stampMessage: text(locale, 'stamp.halifax.earned'),
      stampArt: PICTURE,
    }));
    card.setLocale('fr');
    expect(at(page, 'quest-complete-stamp-art')?.hidden).toBe(false);
    expect(at(page, 'quest-complete-stamp')?.textContent).toBe(text('fr', 'stamp.halifax.earned'));
  });

  it('is a sheet over the level, and removes the stamp when destroyed', () => {
    const page = buildPage();
    const card = createLevelComplete(page.host, { locale: 'en' });
    expect(at(page, 'quest-complete-card')?.className.split(' ')).toContain('tn-screen--sheet');
    card.show({ reason: 'quest', stampArt: PICTURE });
    card.destroy();
    expect(at(page, 'quest-complete-stamp-art')).toBeNull();
  });
});

describe('the title screen draws the country and the player', () => {
  const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

  function open(figure?: () => Promise<string | null>) {
    const page = buildPage();
    const screen = createTitleScreen(page.host, {
      locale: 'en',
      routes: { kind: 'first-run', onPlay: () => undefined },
      ...(figure === undefined ? {} : { figure }),
    });
    return { page, screen };
  }

  it('draws the landscape between the words and the ways in, as decoration', () => {
    const { page } = open();
    const art = at(page, 'title-art');
    expect(art?.getAttribute('aria-hidden')).toBe('true');
    expectDecoration(at(page, 'title-landscape'));
    expect(imageOf(at(page, 'title-landscape'))?.getAttribute('src')).toBe(LANDSCAPE_URL);

    const order = at(page, 'title-screen')?.children.map((child) => child.className) ?? [];
    expect(order.indexOf('tn-title__art')).toBeGreaterThan(order.indexOf('tn-title__hero'));
    expect(order.indexOf('tn-title__art')).toBeLessThan(order.indexOf('tn-screen__actions'));
  });

  it('adds no control, no heading and no words', () => {
    const { page } = open();
    const art = at(page, 'title-art');
    expect(art?.querySelectorAll('button')).toHaveLength(0);
    expect(art?.textContent).toBe('');
    expect(at(page, 'title-screen')?.querySelectorAll('h1')).toHaveLength(1);
  });

  it('draws the player it is handed once the picture is painted', async () => {
    const figure = vi.fn(() => Promise.resolve(PORTRAIT));
    const { page } = open(figure);
    expect(figure).toHaveBeenCalledTimes(1);
    expect(at(page, 'title-figure')?.hidden).toBe(true);

    await flush();
    expectDecoration(at(page, 'title-figure'));
    expect(at(page, 'title-figure')?.hidden).toBe(false);
    expect(imageOf(at(page, 'title-figure'))?.getAttribute('src')).toBe(PORTRAIT);
  });

  it('draws the landscape alone when the player cannot be painted', async () => {
    const { page } = open(() => Promise.resolve(null));
    await flush();
    expect(at(page, 'title-figure')?.hidden).toBe(true);

    const failing = open(() => Promise.reject(new Error('no atlas')));
    await flush();
    expect(at(failing.page, 'title-figure')?.hidden).toBe(true);
    expect(at(failing.page, 'title-play')?.textContent).toBe('Play');
  });

  it('does nothing with a picture that arrives after the screen is gone', async () => {
    let arrive: (src: string) => void = () => undefined;
    const { page, screen } = open(
      () =>
        new Promise<string>((resolve) => {
          arrive = resolve;
        }),
    );
    screen.destroy();
    arrive(PORTRAIT);
    await flush();
    expect(at(page, 'title-figure')).toBeNull();
  });

  it('keeps Play first in reading order and in focus', () => {
    const { page, screen } = open(() => Promise.resolve(PORTRAIT));
    screen.focus();
    expect(page.doc.activeElement?.getAttribute('data-testid')).toBe('title-play');
  });
});

describe('the Study home draws the country', () => {
  it('heads the sheet with the landscape, as decoration, in every state', () => {
    const page = buildPage();
    const study = createStudyScreen(page.host, { locale: 'en' });
    study.show({ kind: 'ready', available: 12, drillSize: 5 });

    expectDecoration(at(page, 'study-art'));
    expect(imageOf(at(page, 'study-art'))?.getAttribute('src')).toBe(LANDSCAPE_URL);
    const root = at(page, 'study-screen');
    expect(page.doc.getElementById(root?.getAttribute('aria-labelledby') ?? '')?.textContent).toBe(
      text('en', 'study.title'),
    );

    study.setState({ kind: 'empty' });
    expect(at(page, 'study-art')?.hidden).toBe(false);
  });

  it('is not a sheet: Study is a screen of its own', () => {
    const page = buildPage();
    createStudyScreen(page.host, { locale: 'en' });
    expect(at(page, 'study-screen')?.className.split(' ')).not.toContain('tn-screen--sheet');
  });

  it('removes the landscape with the screen', () => {
    const page = buildPage();
    const study = createStudyScreen(page.host, { locale: 'en' });
    study.destroy();
    expect(at(page, 'study-art')).toBeNull();
  });
});
