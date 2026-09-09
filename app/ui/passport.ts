/**
 * The passport — ten slots, the stamps earned so far, and how much is left.
 *
 * `docs/stories/TN-PASSPORT-my-passport.md` is the acceptance criteria. It is
 * the reward surface of the whole game: the map says what a player *can do*, and
 * this screen says what they *did*.
 *
 * ## Three states, and the one place the map's precedence does not apply
 *
 * `TN-MAP` decides what state a level is in, and this screen reuses that rule
 * rather than inventing a second vocabulary — same words, same keys
 * (`map.state.notBuilt`, `map.notBuilt.help`), because a player who has read
 * "Not made yet" on the map must not meet a second phrase for the same fact one
 * screen later. {@link stampState} is the whole rule, in order:
 *
 *  1. **Earned wins.** A stamp is never taken away because a build no longer
 *     contains the level it came from (`TN-PASSPORT-05`). This is the one clause
 *     that differs from the map, and it differs on purpose.
 *  2. Otherwise **no document** means "not made yet".
 *  3. Otherwise **not earned yet**.
 *
 * **There is no "locked" state here.** A level that exists and is locked shows
 * "Not earned yet", which is true, and the map is where locks are explained. A
 * fourth word would be a fourth thing to translate and a fourth thing to get
 * wrong.
 *
 * ## What is reused rather than reworded
 *
 * `passport.state.earned` is already a row and is already drawn by the map's
 * cards; `map.stamps` is the same count on both screens, deliberately, because a
 * second key would let the two disagree. This screen writes **no** sentence
 * about a fact another screen already states — the pattern `describeEntry` set
 * for "this level is open".
 *
 * ## The empty passport is a beginning, not an error
 *
 * A new player opens this screen with nothing in it, and that is the first thing
 * most players will see. Ten slots are still drawn, the count still reads out of
 * ten, and `passport-empty` says plainly what earns the first stamp. Nothing on
 * the screen is a warning, a placeholder or a red state (`TN-PASSPORT-03`,
 * `TN-PASSPORT-04`).
 *
 * ## No exam panel, yet
 *
 * `TN-PASSPORT-06` puts the most recent practice exam on this screen. This build
 * has no exam: no start screen, no attempt, no result. Drawing "Practice exam"
 * with no control that opens one would name a feature the game does not have,
 * which is the defect this project keeps finding from the other end. The rows
 * are written in the story and are transcribed when Exam mode lands; the panel
 * is reported, not faked.
 *
 * DOM only (ADR-0005).
 */

import { text, type UiLocale } from './copy';
import { button, element, mark, replaceChildren } from './dom';
import { levelTitle, type MapEntry } from './level-select';
import { createScreen, type Screen } from './screen';

/** The three states, in the words `TN-PASSPORT-01` requires on `data-state`. */
export type StampState = 'earned' | 'not-earned' | 'not-built';

/**
 * Which state one slot is in.
 *
 * The order of these tests **is** the rule. `entry.stamped` is asked first, so a
 * stamp for a level this build no longer carries still reads "Earned" and is
 * still counted, while the same level on the map still reads "Not made yet" —
 * the two screens are answering two different questions and neither is wrong.
 */
export function stampState(entry: MapEntry): StampState {
  if (entry.stamped === true) return 'earned';
  return entry.built ? 'not-earned' : 'not-built';
}

/** The state word, as text. No slot's state is carried by styling alone. */
function stateWordFor(locale: UiLocale, state: StampState): string {
  if (state === 'earned') return text(locale, 'passport.state.earned');
  if (state === 'not-earned') return text(locale, 'passport.state.notEarned');
  return text(locale, 'map.state.notBuilt');
}

export interface PassportOptions {
  readonly locale: UiLocale;
  /** The ten entries, in map order. This screen never sorts them. */
  readonly entries: readonly MapEntry[];
  /** The one live region (`app/ui/live-region.ts`). */
  readonly announce?: (message: string, lang?: string) => void;
  /** `common.back`: one step back to wherever this was opened from. Escape too. */
  readonly onBack?: () => void;
  readonly singleSwitch?: boolean;
  readonly holdMs?: number;
  readonly now?: () => number;
}

export interface Passport {
  readonly element: HTMLElement;
  readonly visible: boolean;
  /** What the live region says on arrival: the screen's name and the count. */
  readonly arrivalMessage: string;
  show(): void;
  hide(): void;
  /** A stamp was earned: redraw the slots without rebuilding the screen. */
  setEntries(entries: readonly MapEntry[]): void;
  setLocale(locale: UiLocale): void;
  setSingleSwitch(enabled: boolean, holdMs?: number): void;
  destroy(): void;
}

export function createPassport(host: HTMLElement, options: PassportOptions): Passport {
  const doc = host.ownerDocument;
  let locale = options.locale;
  let entries = options.entries;

  const screen: Screen = createScreen(host, {
    id: 'tn-passport',
    testId: 'passport',
    locale,
    ...(options.onBack === undefined ? {} : { onEscape: options.onBack }),
    ...(options.announce === undefined ? {} : { announce: options.announce }),
    switch: {
      enabled: options.singleSwitch === true,
      holdMs: options.holdMs ?? 600,
      ...(options.now === undefined ? {} : { now: options.now }),
    },
  });

  const title = element(doc, 'h1', { id: 'tn-passport-title' });
  title.tabIndex = -1;
  screen.labelledBy(title);

  /* What earns a stamp, said once, at the top. The dialog's description, so it
     is read on arrival with the name rather than needing to be hunted for. */
  const intro = element(doc, 'p', {
    id: 'tn-passport-intro',
    testId: 'passport-intro',
    className: 'tn-screen__help',
  });
  screen.describedBy(intro);

  /* How much of the journey exists and how much of it is earned — the map's own
     three rows, joined, because they are the same facts and a second set would
     be a second set to keep true. */
  const counts = element(doc, 'p', {
    testId: 'passport-counts',
    className: 'tn-screen__help',
  });

  const emptySlot = element(doc, 'div', { className: 'tn-passport__empty-slot' });

  const list = element(doc, 'ul', {
    className: 'tn-screen__options tn-passport',
    testId: 'passport-slots',
  });

  const actions = element(doc, 'div', { className: 'tn-screen__actions' });

  screen.card.append(title, intro, counts, emptySlot, list, actions);

  render();

  function stampCount(): number {
    return entries.filter((entry) => entry.stamped === true).length;
  }

  function readyCount(): number {
    return entries.filter((entry) => entry.built).length;
  }

  function countsLine(): string {
    const total = entries.length;
    const ready = readyCount();
    const parts = [
      text(locale, 'map.stamps', { earned: stampCount(), total }),
      text(locale, 'map.levelsReady', { ready, total }),
    ];
    /* Only while it is true, exactly as the map draws it: a finished game does
       not promise more of something that is finished. */
    if (ready < total) parts.push(text(locale, 'map.moreComing'));
    return parts.join(' ');
  }

  function handleOf(entry: MapEntry): string {
    return String(entry.id ?? entry.number);
  }

  /**
   * One slot.
   *
   * A list item rather than a button: `TN-PASSPORT-07` requires a slot to be
   * **readable, not activatable** — "activating a slot does nothing and
   * announces nothing false", and "no slot claims to open a level". It is still
   * in the Tab order, because a keyboard user has to be able to read all ten,
   * and it carries an `aria-label` because a `listitem` takes no name from its
   * contents. Every word in that label is also on the screen: nothing important
   * exists only in the accessibility tree, and nothing only in pixels.
   */
  function slot(entry: MapEntry): HTMLElement {
    const state = stampState(entry);
    const handle = handleOf(entry);
    /* `levelTitle` is the map's own answer, reused: `null` for a place whose id
       is not settled, which `TN-MAP-04` requires to draw no placeholder. */
    const name = levelTitle(locale, entry);
    const number = text(locale, 'map.number', { n: entry.number });
    const stateWord = stateWordFor(locale, state);

    const parts: HTMLElement[] = [
      element(doc, 'span', { className: 'tn-passport__number', text: number }),
    ];

    /*
     * The stamp itself: a shape, beside the word that says the same thing.
     * `TN-PASSPORT-02` — "distinguishable from an unearned slot by a shape and a
     * label, not by colour alone" — and `TN-PASSPORT-09` — a stamp is never
     * announced as "image", "graphic" or an empty string, so the mark is hidden
     * from assistive technology and the text beside it is what is read.
     *
     * A slot for a level nobody has built draws **no** mark at all
     * (`OQ-PASSPORT-4`): an empty outline reads as a slot the player could fill.
     */
    if (state === 'earned') parts.push(mark(doc, '✓'));

    /* No place name and no placeholder in its space: level 2 has a subject line
       and, deliberately, no place (`TN-MAP-04`, `TN-PASSPORT-04`). */
    if (name !== null) {
      parts.push(element(doc, 'span', { className: 'tn-passport__name', text: name }));
    }

    parts.push(element(doc, 'span', { className: 'tn-screen__state', text: stateWord }));

    /* The one sentence a slot carries, and only where it is true: a level that
       is not in this game says so, in the map's words. An unearned slot needs no
       sentence — "Not earned yet" is the whole of what there is to say, and the
       map is where a lock is explained. */
    const help =
      state === 'not-built'
        ? element(doc, 'p', {
            className: 'tn-screen__help',
            testId: `passport-slot-${handle}-help`,
            text: text(locale, 'map.notBuilt.help'),
          })
        : null;

    const item = element(doc, 'li', {
      /* `stamp-<levelId>` is the marker `docs/stories/README.md` fixes for a
         slot; a place whose id is not settled yet is keyed on its number, which
         is the only handle it has. */
      testId: entry.id === undefined ? `passport-slot-${handle}` : `stamp-${handle}`,
      className: 'tn-passport__slot',
      attrs: {
        'data-state': state,
        'data-level-handle': handle,
        'aria-label': [number, name, stateWord, help?.textContent]
          .filter((part): part is string => part !== null && part !== undefined && part !== '')
          .join('. '),
      },
      children: help === null ? parts : [...parts, help],
    });
    item.tabIndex = 0;
    return item;
  }

  function render(): void {
    const focusedHandle = focusedSlotHandle();
    const scroll = typeof screen.card.scrollTop === 'number' ? screen.card.scrollTop : 0;

    title.textContent = text(locale, 'passport.title');
    intro.textContent = text(locale, 'passport.intro');
    counts.textContent = countsLine();

    /*
     * The empty state, and it is a beginning rather than an error: the ten slots
     * are still drawn under it, the count still reads out of ten, and nothing
     * says anything went wrong (`TN-PASSPORT-03`).
     */
    replaceChildren(
      emptySlot,
      stampCount() > 0
        ? []
        : [
            element(doc, 'div', {
              testId: 'passport-empty',
              className: 'tn-screen__row',
              children: [
                element(doc, 'h2', { text: text(locale, 'passport.empty.title') }),
                element(doc, 'p', { text: text(locale, 'passport.empty.body') }),
              ],
            }),
          ],
    );

    replaceChildren(list, entries.map(slot));

    replaceChildren(
      actions,
      options.onBack === undefined
        ? []
        : [
            button(doc, {
              testId: 'passport-back',
              text: text(locale, 'common.back'),
              attrs: { 'data-tn-action': 'quiet' },
              onClick: options.onBack,
            }),
          ],
    );

    /* A language change redraws every slot, and `TN-PASSPORT-11` requires the
       player to keep their place through it: the slot they were reading and how
       far down they had scrolled. */
    if (typeof screen.card.scrollTop === 'number') screen.card.scrollTop = scroll;
    if (focusedHandle !== null) focusSlot(focusedHandle);
  }

  function focusedSlotHandle(): string | null {
    const active = doc.activeElement as HTMLElement | null;
    if (active === null) return null;
    const handle = active.getAttribute?.('data-level-handle') ?? null;
    return handle !== null && active.tagName === 'LI' ? handle : null;
  }

  function focusSlot(handle: string): void {
    list
      .querySelector<HTMLElement>(`[data-level-handle="${handle}"]`)
      ?.focus({ preventScroll: true });
  }

  return {
    element: screen.element,
    get visible(): boolean {
      return screen.visible;
    },

    get arrivalMessage(): string {
      /* `TN-PASSPORT-09`: "reads the screen's name and the stamp count, once".
         Two rows that exist, joined — not a third sentence this module would
         have had to write. */
      return `${text(locale, 'passport.title')}. ${text(locale, 'map.stamps', {
        earned: stampCount(),
        total: entries.length,
      })}`;
    },

    show(): void {
      if (screen.visible) return;
      screen.show();
      /* The trap has put focus on the dialog itself; the heading is a better
         first stop — it is what the screen is, and Tab from it reaches the first
         slot rather than re-entering from the top. */
      title.focus({ preventScroll: true });
      screen.refreshSwitch();
      options.announce?.(this.arrivalMessage, locale);
    },

    hide(): void {
      screen.hide();
    },

    setEntries(next): void {
      entries = next;
      render();
      screen.refreshSwitch();
    },

    setLocale(next): void {
      locale = next;
      screen.setLocale(next);
      render();
      screen.refreshSwitch();
    },

    setSingleSwitch(enabled, holdMs): void {
      screen.setSwitchEnabled(enabled, holdMs);
    },

    destroy(): void {
      screen.destroy();
    },
  };
}
