/**
 * The level select — ten places, three states.
 *
 * `docs/stories/TN-MAP-level-select.md` is the acceptance criteria;
 * `TN-LEVELS-2-to-10-spine.md` owns the ten place names and subject lines and
 * `TN-FLOW-first-run-and-return.md` owns the route in and out.
 *
 * ## The problem this screen is mostly about
 *
 * Nine of the ten levels do not exist. A screen listing ten things where nine
 * cannot be opened has to say *why*, and there are two different whys:
 *
 *  - **locked** — the level exists and has not been earned yet. A goal.
 *  - **not made yet** — the game does not contain it. A statement about the
 *    project, not about the player, and saying "Locked" over it invites them to
 *    look for a key that does not exist.
 *
 * Neither may read as a defect (`TN-MAP-04`: no "error", no "missing", no
 * warning triangle), and they must be told apart by a player at a glance, by a
 * screen reader and by a test. {@link levelCardState} is the rule as a pure
 * function, so the badge, the sentence and whether the card does anything
 * cannot disagree.
 *
 * ## Two sources, two different questions
 *
 * Whether a *document* exists is the level catalogue's answer; whether a level
 * is *unlocked* is `unlockedLevelIds`' answer, from `unlockRules` and the stamps
 * earned. The bug this file is written against is a screen answering one of them
 * with the other, so both arrive as separate fields on {@link MapEntry} and
 * neither is inferred here. `app/ui` may import the id vocabulary from
 * `app/domain` and nothing else (ADR-0005), which is also why the unlock rule is
 * not run here: a rule executed in a DOM screen is a rule the domain's coverage
 * gate never runs.
 *
 * ## Not built beats everything
 *
 * Including "unlocked" (`TN-MAP-05`). A player who has earned enough stamps to
 * open a level that nobody has built has still not failed at anything, and must
 * never be told to earn a stamp they already have.
 *
 * DOM only (ADR-0005).
 */

import type { LevelId } from '@domain/ids';

import { count, text, type CopyKey, type UiLocale } from './copy';
import { button, element, replaceChildren } from './dom';
import { injectScreenStyles } from './screen-styles';

/** The three states, in the words `TN-MAP-01` requires on `data-state`. */
export type LevelCardState = 'open' | 'locked' | 'not-built';

/**
 * One row of the journey.
 *
 * `number` rather than an index: levels 2 and 10 have no id yet
 * (`TN-LEVELS-2-to-10-spine.md`, and `docs/content-review.md` §1 blocks both), so
 * the map number is the only stable handle they have, and their copy rows are
 * keyed on it.
 */
export interface MapEntry {
  /** 1 to 10. The map order, the unlock order and the reading order. */
  readonly number: number;
  /** `content/levels/<id>.json`. Absent while the id is not fixed. */
  readonly id?: LevelId;
  /** A level document exists in this build — the catalogue's answer. */
  readonly built: boolean;
  /** `unlockedLevelIds` includes it — the domain's answer, never re-derived. */
  readonly unlocked: boolean;
  /** The stamp for this level is in the passport. */
  readonly stamped?: boolean;
  /**
   * How many more stamps would open it, when the caller knows. The count is the
   * domain's arithmetic, not this screen's: with it the card counts stamps, and
   * without it the card names the level to finish first (`OQ-MAP-4`).
   */
  readonly stampsNeeded?: number;
}

/**
 * Which state a card is in.
 *
 * The order of these three tests is the rule, written once
 * (`TN-MAP`, "the rule that decides which state a level is in"):
 * not built wins over locked *and* over open.
 */
export function levelCardState(entry: MapEntry): LevelCardState {
  if (!entry.built) return 'not-built';
  return entry.unlocked ? 'open' : 'locked';
}

/** The copy key holding a level's place name, or `null` when it has none. */
function titleKeyOf(entry: MapEntry): CopyKey | null {
  const key = `level.${String(entry.id ?? entry.number)}.title` as CopyKey;
  return hasRow(key) ? key : null;
}

function subtitleKeyOf(entry: MapEntry): CopyKey | null {
  const key = `level.${String(entry.id ?? entry.number)}.subtitle` as CopyKey;
  return hasRow(key) ? key : null;
}

/**
 * Is there a row for this key?
 *
 * The map is the one screen that reaches the table with a key it built from
 * data, so it is the one screen that can ask for a row nobody wrote — level 2
 * has a subject line and, deliberately, no place name. Checked rather than
 * assumed, because the alternative is the word "undefined" on a card, and
 * `TN-MAP-04` forbids a placeholder in that space at all.
 */
function hasRow(key: CopyKey): boolean {
  return text('en', key) !== undefined;
}

/**
 * What the map needs to describe one card, without a map on the page.
 *
 * Every field is already an option of {@link LevelSelectOptions}; the type
 * exists so {@link describeEntry} can be called by a screen that is *not* the
 * level select — the completion card, which has to name the level that just
 * opened while the player is still in the level they finished, and the map does
 * not exist at that moment.
 */
export interface MapDescription {
  readonly locale: UiLocale;
  /** The ten entries, in map order. Never sorted, here or anywhere. */
  readonly entries: readonly MapEntry[];
  /** `unlockRules.stampsToUnlockNext`, for a locked card with no other answer. */
  readonly stampsToUnlock: number;
}

/** One card's state, as the word `TN-MAP-01` requires on screen. */
function stateWordFor(locale: UiLocale, state: LevelCardState): string {
  if (state === 'open') return text(locale, 'map.state.open');
  if (state === 'locked') return text(locale, 'map.state.locked');
  return text(locale, 'map.state.notBuilt');
}

/**
 * The sentence under a card.
 *
 * A locked card either names the level to finish first — right when one stamp
 * opens the next level, which is `OQ-MAP-4`'s recommendation — or counts the
 * stamps still needed. The count comes from the caller, because how many
 * stamps are left is the domain's arithmetic; the *choice between the two
 * sentences* is presentation and belongs here.
 */
function helpForEntry(
  map: MapDescription,
  entry: MapEntry,
  state: LevelCardState,
  index: number,
): string {
  const { locale, entries } = map;
  if (state === 'not-built') return text(locale, 'map.notBuilt.help');
  if (state === 'open') return text(locale, 'map.open.help');

  const needed = entry.stampsNeeded;
  if (typeof needed === 'number') return count(locale, 'map.locked.stamps', needed);

  const previous = entries[index - 1];
  const previousTitle = previous === undefined ? null : titleKeyOf(previous);
  if (previousTitle !== null) {
    return text(locale, 'map.locked.after', { level: text(locale, previousTitle) });
  }
  return count(locale, 'map.locked.stamps', map.stampsToUnlock);
}

/**
 * One card, read out: its place, its state and the sentence under it.
 *
 * "Halifax. Open. You can play this now." — **three rows this screen already
 * draws, joined**, and no fourth sentence written anywhere. That is the whole
 * reason it is a pure function rather than a method: `TN-MAP-03` says a level
 * that opens "is announced as open when I reach it", and the moment a player
 * most needs to hear it is the moment the map does not exist — the completion
 * card, over the level they have just finished. A sentence naming the level that
 * just opened is a copy row nobody has written; this is the same fact said in
 * words that have been reviewed, rather than a fourth string invented at the one
 * screen that needed it.
 *
 * `null` when this build has no such card, which is the honest answer for an id
 * that reached here from a save or an address rather than from the journey.
 */
export function describeEntry(map: MapDescription, id: LevelId): string | null {
  const index = map.entries.findIndex((candidate) => candidate.id === id);
  const entry = map.entries[index];
  if (entry === undefined) return null;
  const state = levelCardState(entry);
  const titleKey = titleKeyOf(entry);
  /* A card with no place name — level 2 — is described by its number, which is
     the handle its rows are keyed on and the only name it has. */
  const name =
    titleKey === null
      ? text(map.locale, 'map.number', { n: entry.number })
      : text(map.locale, titleKey);
  return `${name}. ${stateWordFor(map.locale, state)}. ${helpForEntry(map, entry, state, index)}`;
}

/**
 * A level's place name, or `null` when this build has none for it.
 *
 * Exported for the same caller and the same reason as {@link describeEntry}: the
 * completion card's route into the level that just opened is labelled with that
 * level's own name, because `level.<id>.title` is a row that exists in both
 * languages and "Play {{level}}" is a sentence nobody has written. Level 2 has
 * no place name on purpose, so `null` is a state rather than a failure.
 */
export function levelTitle(locale: UiLocale, entry: MapEntry): string | null {
  const key = titleKeyOf(entry);
  return key === null ? null : text(locale, key);
}

export interface LevelSelectOptions {
  readonly locale: UiLocale;
  /** The ten entries, in map order. This screen never sorts them. */
  readonly entries: readonly MapEntry[];
  /** `unlockRules.stampsToUnlockNext`, for a locked card with no other answer. */
  readonly stampsToUnlock: number;
  /** A level the player may open. Never called for a card that cannot be. */
  readonly onChoose: (id: LevelId) => void;
  /** `common.back`: one step up the route, to the title screen (`TN-FLOW-03`). */
  readonly onBack?: () => void;
  /**
   * `passport.open` — the passport's home (`TN-PASSPORT-01`, `OQ-PASSPORT-3`).
   *
   * It belongs on this screen rather than on the title screen because the stamp
   * count is already here: "Stamps: 3 of 10" is a fact a player will want to
   * open, and a control beside it is the shortest honest route. The level's menu
   * offers the same screen for a player who is already inside a level. Absent
   * draws no control, like every other option here — a route that opens nothing
   * is worse than no route.
   */
  readonly onOpenPassport?: () => void;
  /** The one live region: a card that cannot be opened says why (`TN-MAP-03`). */
  readonly announce?: (message: string) => void;
}

export interface LevelSelect {
  readonly element: HTMLElement;
  readonly heading: HTMLElement;
  /** What the live region says on arrival: the screen and how much of it exists. */
  readonly arrivalMessage: string;
  /** Progress changed: redraw the states without rebuilding the screen. */
  readonly setEntries: (entries: readonly MapEntry[]) => void;
  readonly setLocale: (locale: UiLocale) => void;
  /** `TN-FLOW-01`: the map opens with the one open card focused. */
  readonly focus: () => void;
  /** Focus one card — the level the player just left (`TN-FLOW-03`). */
  readonly focusLevel: (id: LevelId) => boolean;
  /**
   * One card, read out: its place, its state and the sentence under it.
   *
   * `TN-MAP-03`: "Earning the stamp opens it, with no reload … and it is
   * announced as open when I reach it." A player arriving on the map straight
   * from finishing a level is *put* on the card that just opened, so the
   * announcement has to name that card rather than the screen. Composed from the
   * rows the card already draws — no sentence is written for it — and `null`
   * when this build has no such card.
   */
  readonly describe: (id: LevelId) => string | null;
  readonly destroy: () => void;
}

export function createLevelSelect(
  host: HTMLElement,
  options: LevelSelectOptions,
): LevelSelect {
  const doc = host.ownerDocument;
  injectScreenStyles(doc);

  let locale = options.locale;
  let entries = options.entries;

  const root = element(doc, 'div', {
    id: 'tn-level-select',
    className: 'tn-screen__card',
    testId: 'level-select',
  });

  const heading = element(doc, 'h1', { id: 'tn-level-select-heading' });
  heading.tabIndex = -1;

  /* How much of the game exists, as text rather than as an absence the player
     has to notice (`TN-MAP-01`). */
  const counts = element(doc, 'p', {
    testId: 'level-select-counts',
    className: 'tn-screen__help',
  });

  const list = element(doc, 'ul', {
    className: 'tn-screen__options tn-levels',
    testId: 'level-select-list',
  });

  const actions = element(doc, 'div', { className: 'tn-screen__actions' });

  root.append(heading, counts, list, actions);
  host.append(root);

  render();

  function readyCount(): number {
    return entries.filter((entry) => entry.built).length;
  }

  function stampCount(): number {
    return entries.filter((entry) => entry.stamped === true).length;
  }

  function countsLine(): string {
    const total = entries.length;
    const ready = readyCount();
    const parts = [
      text(locale, 'map.levelsReady', { ready, total }),
      text(locale, 'map.stamps', { earned: stampCount(), total }),
    ];
    /* Only while it is true. A game with every level built says nothing here,
       rather than promising more of something that is finished. */
    if (ready < total) parts.push(text(locale, 'map.moreComing'));
    return parts.join(' ');
  }

  function render(): void {
    heading.textContent = text(locale, 'map.title');
    counts.textContent = countsLine();
    replaceChildren(list, entries.map(card));
    const controls: HTMLElement[] = [];
    if (options.onOpenPassport !== undefined) {
      controls.push(
        button(doc, {
          testId: 'passport-open',
          text: text(locale, 'passport.open'),
          onClick: options.onOpenPassport,
        }),
      );
    }
    if (options.onBack !== undefined) {
      controls.push(
        button(doc, {
          testId: 'level-select-back',
          text: text(locale, 'common.back'),
          attrs: { 'data-tn-action': 'quiet' },
          onClick: options.onBack,
        }),
      );
    }
    replaceChildren(actions, controls);
  }

  function handleOf(entry: MapEntry): string {
    return String(entry.id ?? entry.number);
  }

  function card(entry: MapEntry, index: number): HTMLElement {
    const state = levelCardState(entry);
    const handle = handleOf(entry);
    const testId = `level-card-${handle}`;
    const titleKey = titleKeyOf(entry);
    const subtitleKey = subtitleKeyOf(entry);

    const parts: HTMLElement[] = [
      element(doc, 'span', {
        className: 'tn-levels__number',
        text: text(locale, 'map.number', { n: entry.number }),
      }),
    ];

    /* No place name and no placeholder: `TN-MAP-04` forbids "TBD", "???" and an
       empty box in this space, and level 2 has a subject line and no place. */
    if (titleKey !== null) {
      parts.push(
        element(doc, 'span', { className: 'tn-levels__name', text: text(locale, titleKey) }),
      );
    }
    if (subtitleKey !== null) {
      parts.push(
        element(doc, 'span', {
          className: 'tn-levels__subject',
          text: text(locale, subtitleKey),
        }),
      );
    }

    /*
     * The stamp, said as a word.
     *
     * `MapEntry.stamped` has been on this type since the map was written and
     * has only ever been counted, never drawn — so a player who finished a level
     * came back to a card that looked exactly like one they had never opened.
     * `passport.state.earned` is the word the passport uses for the same fact,
     * reused rather than reworded (`TN-PASSPORT`), and it sits *beside* the
     * state word rather than replacing it: "Open" says whether the level can be
     * played and "Earned" says whether its stamp has been won, and a card is
     * routinely both.
     */
    if (entry.stamped === true) {
      parts.push(
        element(doc, 'span', {
          className: 'tn-levels__badge',
          testId: `${testId}-stamp`,
          text: text(locale, 'passport.state.earned'),
        }),
      );
    }

    /* One state word per card, always, as text. `TN-MAP-01`: no card's state is
       carried by colour, by an icon or by opacity alone. */
    parts.push(
      element(doc, 'span', { className: 'tn-screen__state', text: stateWord(state) }),
    );

    const control = button(doc, {
      testId,
      attrs: {
        'data-state': state,
        'data-level-handle': handle,
        'data-stamped': entry.stamped === true ? 'true' : 'false',
      },
      children: parts,
    });

    const help = element(doc, 'p', {
      id: `tn-level-card-${handle}-help`,
      className: 'tn-screen__help',
      testId: `${testId}-help`,
      text: helpFor(entry, state, index),
    });
    /* The reason is a description, read after the name (`TN-MAP-09`), not a
       tooltip and not part of the name. */
    control.setAttribute('aria-describedby', help.id);

    const id = entry.id;
    if (state === 'open' && id !== undefined) {
      control.addEventListener('click', () => {
        options.onChoose(id);
      });
    } else {
      /*
       * `aria-disabled`, not `disabled`: `TN-MAP-07` requires every card to stay
       * in the tab order whatever its state, and requires Enter on one to
       * announce its reason instead of doing nothing. A card removed from the
       * order is a hole in the journey where a place should be.
       */
      control.setAttribute('aria-disabled', 'true');
      control.addEventListener('click', () => {
        options.announce?.(help.textContent ?? '');
      });
    }

    return element(doc, 'li', { className: 'tn-levels__item', children: [control, help] });
  }

  /* Both delegate to the pure functions above, which are also what the
     completion card calls. One rule, one place: a card that reads one way on the
     map and another way on the card that sent the player there would be two
     answers to one question. */
  function description(): MapDescription {
    return { locale, entries, stampsToUnlock: options.stampsToUnlock };
  }

  function stateWord(state: LevelCardState): string {
    return stateWordFor(locale, state);
  }

  function helpFor(entry: MapEntry, state: LevelCardState, index: number): string {
    return helpForEntry(description(), entry, state, index);
  }

  return {
    element: root,
    heading,
    get arrivalMessage(): string {
      /*
       * `TN-MAP-09`: "the screen's name and how many levels are ready, once".
       * Two rows that exist, joined — not a third sentence this module would
       * have had to write.
       */
      const total = entries.length;
      return `${text(locale, 'map.title')}. ${text(locale, 'map.levelsReady', {
        ready: readyCount(),
        total,
      })}`;
    },
    setEntries(next): void {
      entries = next;
      render();
    },
    setLocale(next): void {
      locale = next;
      render();
    },
    focus(): void {
      /* The one open card, so choosing it is the next thing a tap, a key press
         or a long press does (`TN-FLOW-01`). The heading only when there is no
         open card at all, which is the state a build with no levels is in. */
      const open = root.querySelector<HTMLElement>('[data-state="open"]');
      (open ?? heading).focus();
    },
    focusLevel(id): boolean {
      const target = root.querySelector<HTMLElement>(`[data-level-handle="${String(id)}"]`);
      if (target === null) return false;
      target.focus();
      return true;
    },
    describe(id): string | null {
      return describeEntry(description(), id);
    },
    destroy(): void {
      root.remove();
    },
  };
}
