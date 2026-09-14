import { describe, expect, it } from 'vitest';

import { currentStopIndex, journeyRail, journeyRoute, type JourneyStep } from '@ui/journey';

import { buildPage } from './support/fake-dom';

/**
 * The route the ten places sit on.
 *
 * `docs/stories/TN-MAP-level-select.md` `OQ-MAP-2` asked whether the level
 * select is a map or a list and answered "a vertical list of cards on a painted
 * backdrop that suggests the journey"; this module is the backdrop. It draws
 * **nothing a card does not already say in words** — that is the whole reason it
 * is allowed to be `aria-hidden`, and it is what these tests are mostly about:
 * every attribute below is pinned to the state word and the "Earned" badge the
 * card beside it prints.
 */

const step = (over: Partial<JourneyStep> = {}): JourneyStep => ({
  built: true,
  unlocked: true,
  ...over,
});

/** Built and open, with the stamps named by index. */
const journey = (length: number, stamped: readonly number[]): readonly JourneyStep[] =>
  Array.from({ length }, (_, index) => step({ stamped: stamped.includes(index) }));

describe('the legs between the stops', () => {
  it('ends the line at both ends of the journey, rather than trailing off', () => {
    const route = journeyRoute(journey(3, []));
    expect(route[0]?.stop.before).toBe('none');
    expect(route[2]?.stop.after).toBe('none');
    /* And nowhere else: the eight in the middle are joined. */
    expect(route[1]?.stop.before).not.toBe('none');
    expect(route[1]?.stop.after).not.toBe('none');
  });

  it('draws a leg travelled exactly where the stop above it is stamped', () => {
    const route = journeyRoute(journey(3, [0]));
    expect(route[0]?.stop.after).toBe('travelled');
    expect(route[1]?.stop.before).toBe('travelled');
    expect(route[1]?.stop.after).toBe('ahead');
    expect(route[2]?.stop.before).toBe('ahead');
  });

  it('agrees with itself across a gap, because both halves read one fact', () => {
    /* The leg between stop n and stop n+1 is one line drawn in two boxes. A
       rule that asked the lower stop for its own half would let the two
       disagree, which on screen is a line that stops in mid-air. */
    const route = journeyRoute(journey(5, [1, 3]));
    for (const [index, entry] of route.entries()) {
      if (entry.stop.after === 'none') continue;
      expect(route[index + 1]?.stop.before).toBe(entry.stop.after);
    }
  });

  it('breaks the route where the player skipped a stamp, because that is true', () => {
    const route = journeyRoute(journey(4, [0, 2]));
    expect(route.map((entry) => entry.stop.after)).toEqual([
      'travelled',
      'ahead',
      'travelled',
      'none',
    ]);
  });

  it('marks a stop reached from its own stamp and from nothing else', () => {
    const route = journeyRoute([
      step({ stamped: true }),
      step({ stamped: false }),
      step({ built: false, unlocked: false, stamped: true }),
    ]);
    expect(route.map((entry) => entry.stop.reached)).toEqual([true, false, true]);
  });

  it('keeps every step beside its own stop, in the order it was given', () => {
    /* Never sorted, here or anywhere: the order of the steps is the journey's
       order, which is the unlock order, the reading order and the focus
       order (`TN-MAP-01`). */
    const steps = [step({ built: false }), step(), step({ unlocked: false })];
    expect(journeyRoute(steps).map((entry) => entry.step)).toEqual(steps);
  });

  it('draws nothing for a journey with no steps in it', () => {
    expect(journeyRoute([])).toEqual([]);
  });

  it('draws a journey of one as a stop with no road at either end', () => {
    const [only] = journeyRoute([step()]);
    expect(only?.stop.before).toBe('none');
    expect(only?.stop.after).toBe('none');
  });
});

describe('where the drawn route ends', () => {
  it('is the first place I can open and have not finished', () => {
    /* The first card reading "Open" without "Earned" — both words are on the
       card, so the mark states nothing a player cannot already read. */
    expect(
      currentStopIndex([
        step({ stamped: true }),
        step({ unlocked: false }),
        step(),
        step(),
      ]),
    ).toBe(2);
  });

  it('is never a place nobody has built, whatever the unlock rules say', () => {
    /* `TN-MAP-05`: not built beats open. A player who earned enough stamps for
       a level nobody built has still not failed at anything, and the route must
       not end on a place that is not in the game. */
    expect(currentStopIndex([step({ built: false }), step()])).toBe(1);
  });

  it('is never a locked place', () => {
    expect(currentStopIndex([step({ unlocked: false }), step()])).toBe(1);
  });

  it('falls back to the last stamp when everything open is finished', () => {
    /* Otherwise the mark would vanish at the one moment worth looking at it:
       the moment the player finished something. */
    expect(
      currentStopIndex([
        step({ stamped: true }),
        step({ stamped: true }),
        step({ built: false, unlocked: false }),
      ]),
    ).toBe(1);
  });

  it('is nowhere at all when nothing is open and nothing is earned', () => {
    /* A build with no levels: there is no "here", and drawing one would be
       inventing a position. `TN-MAP-06`'s "the map is reachable when the game
       has no levels at all". */
    expect(currentStopIndex([step({ built: false }), step({ built: false })])).toBe(-1);
    expect(currentStopIndex([])).toBe(-1);
  });

  it('marks at most one stop, and marks it in the route', () => {
    const route = journeyRoute(journey(4, [0, 1]));
    expect(route.filter((entry) => entry.stop.current)).toHaveLength(1);
    expect(route[2]?.stop.current).toBe(true);
  });

  it('marks none at all where there is no here to mark', () => {
    const route = journeyRoute([step({ built: false }), step({ built: false })]);
    expect(route.every((entry) => !entry.stop.current)).toBe(true);
  });
});

describe('the rail, as drawn', () => {
  const page = buildPage();
  const stop = journeyRoute(journey(3, [0]))[1]?.stop;
  if (stop === undefined) throw new Error('the route was not built');

  it('is hidden from assistive technology, and holds nothing focusable', () => {
    /* The licence for hiding it is that it carries no fact of its own. A
       focusable descendant inside `aria-hidden` is also an axe violation in its
       own right (`aria-hidden-focus`). */
    const rail = journeyRail(page.document, { marker: 'stop', state: 'open', stop });
    expect(rail.getAttribute('aria-hidden')).toBe('true');
    expect(rail.querySelectorAll('button, a, input, [tabindex]')).toHaveLength(0);
  });

  it('reports the route it was given, so a test can read what a player sees', () => {
    const rail = journeyRail(page.document, { marker: 'stop', state: 'locked', stop });
    expect(rail.getAttribute('data-journey')).toBe('stop');
    expect(rail.getAttribute('data-journey-state')).toBe('locked');
    expect(rail.getAttribute('data-journey-before')).toBe('travelled');
    expect(rail.getAttribute('data-journey-after')).toBe('ahead');
    expect(rail.getAttribute('data-journey-reached')).toBe('false');
    expect(rail.getAttribute('data-journey-current')).toBe('true');
  });

  it('answers to its own attribute rather than to the card’s', () => {
    /* `data-state` belongs to the card beside this one and `TN-MAP-01` asserts
       against it by counting. Two elements answering one selector would double
       every count in the suite. */
    const rail = journeyRail(page.document, { marker: 'stop', state: 'open', stop });
    expect(rail.getAttribute('data-state')).toBeNull();
  });

  it('carries a mark only where it was given one', () => {
    const bare = journeyRail(page.document, { marker: 'stop', state: 'open', stop });
    expect(bare.querySelector('.tn-journey__pin')?.textContent).toBe('');

    const stamped = journeyRail(page.document, {
      marker: 'stamp',
      state: 'earned',
      stop,
      glyph: '✓',
    });
    expect(stamped.querySelector('.tn-journey__pin')?.textContent).toBe('✓');
    expect(stamped.getAttribute('data-journey')).toBe('stamp');
  });

  it('is a leg, a pin and a leg, in that order, at every stop', () => {
    /* Both legs are always drawn, including at the ends of the journey, where
       the stylesheet hides them: a row that dropped an element would be a row
       of a different height, and the first card would not line up with the
       nine under it. */
    const rail = journeyRail(page.document, {
      marker: 'stop',
      state: 'open',
      stop: { before: 'none', after: 'none', reached: false, current: false },
    });
    expect(Array.from(rail.children).map((child) => child.className)).toEqual([
      'tn-journey__leg tn-journey__leg--before',
      'tn-journey__pin',
      'tn-journey__leg tn-journey__leg--after',
    ]);
  });
});
