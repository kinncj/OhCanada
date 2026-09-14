/**
 * The route the ten places sit on, drawn beside them.
 *
 * ## The problem
 *
 * `TN-MAP` calls this screen a map, `map.title` calls it "Choose a level", and
 * what the player got was ten identical rows in a column: "Level 4 · Ottawa ·
 * How Canadians govern themselves · Open", ten times over. Every fact was
 * there and the *shape* of the thing — one journey, in one order, from the
 * Atlantic — was not. `OQ-MAP-2` already answered the layout half of that
 * question ("a vertical list of cards on a painted backdrop that suggests the
 * journey, with the DOM order and focus order being the journey's order"); this
 * module is the backdrop, minus the painting.
 *
 * ## The one rule that keeps it accessible
 *
 * **Every attribute this module writes is a pure function of two facts each
 * card already states in words**: its state (`map.state.open` / `.locked` /
 * `.notBuilt`, or the passport's `passport.state.earned` / `.notEarned`) and
 * whether its stamp is earned (`passport.state.earned`, drawn on the card since
 * the badge landed). The rail therefore *renders* information; it never *adds*
 * any. That is what lets the whole thing be `aria-hidden` without a screen
 * reader user losing something a sighted player has — the principle
 * `TN-PASSPORT-09` states as "nothing important exists only in the
 * accessibility tree, and nothing only in pixels", read from the pixels end.
 *
 * Concretely: a leg is *travelled* exactly where the card above it says
 * "Earned"; a pin is *reached* exactly where its own card says "Earned"; the
 * *current* stop is the first card that says "Open" and does not say "Earned".
 * A player who ignores the rail entirely reads the same ten facts in the same
 * order. {@link journeyRoute} is that derivation as a pure function, so the
 * drawing and the words cannot disagree, and so it can be tested without a DOM.
 *
 * ## What this module deliberately does not do
 *
 * **It draws no geography.** The order is real — Halifax, Peggy's Cove, Québec
 * City, Ottawa, Toronto, Winnipeg, the Prairies, the Alberta foothills,
 * Vancouver, the North — and it is geographic, but a map of Canada is a
 * reference-accurate drawing under CLAUDE.md's art rule and not a shape to
 * approximate in CSS. The rail says *there is one route and these ten stops are
 * on it, in this order*; it says nothing about which way the route runs.
 * `OQ-MAP-3` forbids the sentence that would claim it, for the reason that
 * level 10 makes the sentence false, and the same reasoning applies to a line
 * that bends west: a route drawn as a shape is a claim about where places are.
 *
 * DOM only (ADR-0005).
 */

import { element } from './dom';

/**
 * One segment of the route, above or below a stop.
 *
 * `none` is the end of the line — above the first stop and below the last —
 * and is a state rather than an absence, so the first and last cards keep the
 * same box as the eight between them and nothing shifts by a pixel.
 */
export type JourneyLeg = 'none' | 'travelled' | 'ahead';

/**
 * What this module needs to know about one place, and nothing else.
 *
 * Structural on purpose: `MapEntry` (`./level-select`) satisfies it, and this
 * module does not import it. The rail is drawn by two screens that already
 * share that type; a third could share the route without sharing the map's
 * vocabulary, and nothing here would change.
 */
export interface JourneyStep {
  /** A level document exists in this build. */
  readonly built: boolean;
  /** `unlockedLevelIds` includes it. */
  readonly unlocked: boolean;
  /** The stamp for this level is in the passport. */
  readonly stamped?: boolean;
}

/** One stop, as the rail draws it. */
export interface JourneyStop {
  /** The leg between the stop before this one and this one. */
  readonly before: JourneyLeg;
  /** The leg between this stop and the one after it. */
  readonly after: JourneyLeg;
  /** This stop's own stamp is earned: the player has been here. */
  readonly reached: boolean;
  /** Where the drawn route ends. At most one stop is this. */
  readonly current: boolean;
}

/**
 * Where the drawn route ends, as an index, or `-1` when it has not begun.
 *
 * Two readings of "where I am" and one answer that serves both:
 *
 *  1. **The next place I can go.** The first stop with a document, opened by
 *     the rules, whose stamp is not earned — which is exactly the first card
 *     reading "Open" without "Earned".
 *  2. **The last place I got to**, for a player who has earned every stamp
 *     that is open to them. Without this clause the marker would vanish at the
 *     moment a player finished something, which is the one moment it is worth
 *     looking at.
 *
 * `-1` when neither exists: a build with nothing open and nothing earned has no
 * "here", and drawing one would be inventing a position. A complete journey
 * lands on clause 2 rather than on a congratulation — `TN-MAP`'s rule for
 * `map.moreComing` is the same instinct, and `TN-RESULT` owns the only screen
 * in this game that reports a result.
 */
export function currentStopIndex(steps: readonly JourneyStep[]): number {
  const next = steps.findIndex(
    (step) => step.built && step.unlocked && step.stamped !== true,
  );
  if (next !== -1) return next;
  return steps.map((step) => step.stamped === true).lastIndexOf(true);
}

/** One step of the journey and the length of route it sits on. */
export interface JourneyStopOf<T> {
  readonly step: T;
  readonly stop: JourneyStop;
}

/**
 * The whole route, one stop per step, in the order given.
 *
 * **Never sorted**, here or anywhere: the order of `steps` is the journey's
 * order, which is the unlock order, the reading order and the focus order
 * (`TN-MAP-01`).
 *
 * A leg between stop *n* and stop *n+1* is travelled when stop *n*'s stamp is
 * earned, and the two halves of one leg are computed from that same fact, so
 * they cannot disagree across the gap. A player who earned stamp 1 and stamp 3
 * and not stamp 2 sees the route broken in the middle, which is true.
 *
 * Each stop is returned **paired with the step it belongs to**, rather than as
 * a parallel array the caller has to index into. Two lists walked by the same
 * subscript is how a card ends up drawn with its neighbour's route, and under
 * `noUncheckedIndexedAccess` it is also a branch for a missing element that no
 * test can ever reach.
 */
export function journeyRoute<T extends JourneyStep>(
  steps: readonly T[],
): readonly JourneyStopOf<T>[] {
  const last = steps.length - 1;
  const current = currentStopIndex(steps);
  const earned = steps.map((step) => step.stamped === true);
  const leg = (index: number): JourneyLeg => (earned[index] === true ? 'travelled' : 'ahead');

  return steps.map((step, index) => ({
    step,
    stop: {
      before: index === 0 ? 'none' : leg(index - 1),
      after: index === last ? 'none' : leg(index),
      reached: earned[index] === true,
      current: index === current,
    },
  }));
}

/**
 * What sits on the route at this stop.
 *
 * The two screens draw the same route and mark it differently, because they
 * answer different questions: the map says *where you can go* and marks a
 * place, the passport says *what you did* and marks a stamp pressed into a
 * page. One geometry, two marks — a player who has read the map recognises the
 * rhythm on the passport without being told the same thing twice.
 */
export type JourneyMarker = 'stop' | 'stamp';

export interface JourneyRailOptions {
  readonly marker: JourneyMarker;
  /**
   * The drawing screen's own state word, as a token: `open`, `locked`,
   * `not-built` for the map; `earned`, `not-earned`, `not-built` for the
   * passport. Passed through rather than re-derived, so the shape on the rail
   * and the word on the card are the same decision made once.
   */
  readonly state: string;
  readonly stop: JourneyStop;
  /**
   * A mark inside the pin — the passport's tick. Inside the rail, and so inside
   * `aria-hidden`, because the word beside it is what should be read and
   * `TN-PASSPORT-09` refuses a stamp announced as "image" or as an empty
   * string.
   */
  readonly glyph?: string;
}

/**
 * One stop's length of route: the leg above it, its pin, the leg below it.
 *
 * `aria-hidden` on the whole thing, and it holds nothing focusable, so it adds
 * no stop to the Tab order, nothing to a card's accessible name and nothing for
 * the switch ring to land on.
 */
export function journeyRail(doc: Document, options: JourneyRailOptions): HTMLElement {
  const { stop } = options;
  return element(doc, 'div', {
    className: 'tn-journey',
    attrs: {
      'aria-hidden': 'true',
      'data-journey': options.marker,
      /* Not `data-state`: the card beside this one carries that attribute and
         `TN-MAP-01` asserts against it by counting. Two elements answering to
         one selector would double every count in the suite. */
      'data-journey-state': options.state,
      'data-journey-before': stop.before,
      'data-journey-after': stop.after,
      'data-journey-reached': String(stop.reached),
      'data-journey-current': String(stop.current),
    },
    children: [
      element(doc, 'span', { className: 'tn-journey__leg tn-journey__leg--before' }),
      element(doc, 'span', {
        className: 'tn-journey__pin',
        ...(options.glyph === undefined ? {} : { text: options.glyph }),
      }),
      element(doc, 'span', { className: 'tn-journey__leg tn-journey__leg--after' }),
    ],
  });
}
