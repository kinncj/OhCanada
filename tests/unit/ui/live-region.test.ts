import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { announce, clearAnnouncements, mountLiveRegion } from '@ui/live-region';

import { buildPage, type FakePage } from './support/fake-dom';

/**
 * The one channel between the game and a screen reader.
 *
 * `TN-LEVEL-08`: "when the skater passes three things in reach in quick
 * succession, no announcement is cut off before it is read, and announcements
 * are delivered in order". The slice-0 implementation replaced a pending message
 * with the next one, which fails both — silently, because the message that was
 * dropped is the one nobody hears. This suite is the queue.
 *
 * The timers here pace the *game's* speech. Nothing about them is a player
 * timer: nothing expires, nothing is chosen, and the queue drains whether or not
 * the player does anything.
 */

let page: FakePage;

const spoken = (): string => page.live.textContent;

beforeEach(() => {
  vi.useFakeTimers();
  page = buildPage();
  /* The double's live region is already in the tree from `buildPage`. */
  mountLiveRegion(page.host);
  clearAnnouncements();
});

afterEach(() => {
  clearAnnouncements();
  vi.useRealTimers();
});

describe('announcing', () => {
  it('says one message', () => {
    announce('You are on the Rideau Canal in Ottawa. Skating.');
    vi.runAllTimers();
    expect(spoken()).toBe('You are on the Rideau Canal in Ottawa. Skating.');
  });

  it('delivers three in order, and cuts none of them off', () => {
    announce('one');
    announce('two');
    announce('three');

    const heard: string[] = [];
    for (let tick = 0; tick < 40; tick += 1) {
      vi.advanceTimersByTime(100);
      const current = spoken();
      if (current !== '' && heard.at(-1) !== current) heard.push(current);
    }

    expect(heard).toEqual(['one', 'two', 'three']);
  });

  it('drops a repeat rather than queueing the same words twice', () => {
    /* A component that re-renders is not a new event: TN-HUD-07 requires the
       storage warning not to be read again every time a question is answered. */
    announce('This browser is not saving your progress.');
    announce('This browser is not saving your progress.');
    vi.runAllTimers();

    /* One message left in the region, and nothing waiting behind it. */
    expect(spoken()).toBe('This browser is not saving your progress.');
    announce('This browser is not saving your progress.');
    vi.runAllTimers();
    expect(spoken()).toBe('This browser is not saving your progress.');
  });

  it('marks the announcing element with the language it is speaking', () => {
    /* TN-LEVEL-11: the announcing element carries lang="fr", so a screen reader
       does not read French with English phonemes. */
    announce('Vous êtes sur le canal Rideau à Ottawa. Patinage.', 'fr');
    vi.runAllTimers();
    expect(page.live.getAttribute('lang')).toBe('fr');
  });

  it('ignores an empty message', () => {
    announce('');
    vi.runAllTimers();
    expect(spoken()).toBe('');
  });

  it('drops what has not been said when the screen it described is gone', () => {
    announce('one');
    announce('two');
    clearAnnouncements();
    vi.runAllTimers();
    expect(spoken()).not.toBe('two');
  });

  it('keeps exactly one live region however many times it is mounted', () => {
    mountLiveRegion(page.host);
    mountLiveRegion(page.host);
    expect(page.doc.querySelectorAll('[aria-live]')).toHaveLength(1);
  });
});
