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
 * ## The same journey as the map, marked differently
 *
 * The map and the passport draw the same ten places in the same order, and both
 * used to draw them as ten identical rows. They share `./journey.ts` now — one
 * rail, one geometry, one rule for which legs are travelled — so a player who
 * has read the map recognises the rhythm here without being taught it twice.
 *
 * **What differs is the mark on the route, and it differs because the two
 * screens answer different questions.** The map marks a *place you can go to*
 * and the passport marks a *stamp pressed into a page*: a rounded square rather
 * than a round stop, carrying the tick. An unearned slot draws the same square,
 * empty, because that is exactly what it is — a space waiting for a stamp. A
 * slot for a level nobody has built draws no square at all (`OQ-PASSPORT-4`),
 * and the route passes through the gap, which is the honest picture of a place
 * that is not in this game.
 *
 * ## The empty passport is a beginning, not an error
 *
 * A new player opens this screen with nothing in it, and that is the first thing
 * most players will see. Ten slots are still drawn, the count still reads out of
 * ten, and `passport-empty` says plainly what earns the first stamp. Nothing on
 * the screen is a warning, a placeholder or a red state (`TN-PASSPORT-03`,
 * `TN-PASSPORT-04`).
 *
 * ## The exam panel
 *
 * `TN-PASSPORT-06` puts the most recent practice exam on this screen, and it is
 * here now that there is one to put. It was deliberately absent while there was
 * not: "Practice exam" over a control that opened nothing would have named a
 * feature the game did not have.
 *
 * Four states and no fifth, because there are only four true things to say: no
 * exam has been finished, one is unfinished, one is finished, or the exam cannot
 * run at all. The unfinished one shows **no score** — an exam nobody finished
 * has no verdict, which is why `finishedAt` and `passed` live on a different
 * type from `examInProgress` (`ADR-0027`) — and the finished one shows the
 * **most recent** result rather than the best: `OQ-RESULT-4` keeps a history, an
 * average and an attempt count off every screen in this game.
 *
 * DOM only (ADR-0005).
 */

import { text, type UiLocale } from './copy';
import { button, element, replaceChildren } from './dom';
import { journeyRail, journeyRoute, type JourneyStop } from './journey';
import { levelTitle, type MapEntry } from './level-select';
import { createStamp, type StampArt } from './screen-art';
import { createScreen, type Screen } from './screen';

/**
 * The practice exam, as this screen shows it (`TN-PASSPORT-06`).
 *
 * `unfinished` carries a count of answers and no score on purpose: it is not a
 * result, and the only thing the passport offers for it is the way back to it.
 */
export type PassportExam =
  | { readonly kind: 'none' }
  | { readonly kind: 'unfinished'; readonly answered: number; readonly total: number }
  | {
      readonly kind: 'result';
      readonly passed: boolean;
      readonly correct: number;
      readonly total: number;
      /** Was the clock running? A result is never read as something it was not. */
      readonly timed: boolean;
    }
  /** Fewer verified questions exist than the exam needs (`TN-EXAM-05`). */
  | { readonly kind: 'not-ready' };

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
  /** One entry per journey place, in map order. This screen never sorts them. */
  readonly entries: readonly MapEntry[];
  /** The one live region (`app/ui/live-region.ts`). */
  readonly announce?: (message: string, lang?: string) => void;
  /** `common.back`: one step back to wherever this was opened from. Escape too. */
  readonly onBack?: () => void;
  /**
   * The exam panel. Absent draws no panel at all — the same rule every control
   * on this screen follows, and the reason there was none before Exam mode.
   */
  readonly exam?: PassportExam;
  /** Opens the exam. Absent draws no control, whatever the panel says. */
  readonly onOpenExam?: () => void;
  /**
   * The picture an earned stamp is pressed in the shape of, for one level
   * (ADR-0045): the same landmark image the completion card presses its stamp
   * with (ADR-0041), resolved by the composition root. `null` or absent draws the
   * slot without a stamp, exactly as it was. Asked only for earned slots, so an
   * unearned level's art is never fetched to draw an empty page.
   */
  readonly stampArt?: (levelId: string) => string | null | undefined;
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
  /** An exam finished, or was left: redraw the panel without rebuilding. */
  setExam(exam: PassportExam | null): void;
  setLocale(locale: UiLocale): void;
  setSingleSwitch(enabled: boolean, holdMs?: number): void;
  destroy(): void;
}

export function createPassport(host: HTMLElement, options: PassportOptions): Passport {
  const doc = host.ownerDocument;
  let locale = options.locale;
  let entries = options.entries;
  let exam: PassportExam | null = options.exam ?? null;

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
  const counts = element(doc, 'div', {
    testId: 'passport-counts',
    className: 'tn-screen__help',
  });

  const emptySlot = element(doc, 'div', { className: 'tn-passport__empty-slot' });

  /* `role="list"` explicitly, for the reason the map states: `list-style: none`
     on a flex `<ul>` is the one stylesheet change WebKit takes the role away
     for, and `TN-PASSPORT-09` requires one list item per place. */
  const list = element(doc, 'ul', {
    className: 'tn-screen__options tn-passport',
    testId: 'passport-slots',
    attrs: { role: 'list' },
  });

  /* Below the slots: the stamps are what a passport is, and the exam is a
     different kind of record kept in the same place (`TN-PASSPORT-06`). */
  const examPanel = element(doc, 'div', {
    testId: 'passport-exam',
    className: 'tn-screen__group',
  });

  const actions = element(doc, 'div', { className: 'tn-screen__actions' });

  /* The stamps drawn by the last render, let go of when the slots are redrawn. */
  const stamps: StampArt[] = [];

  screen.card.append(title, intro, counts, emptySlot, list, examPanel, actions);

  render();

  function stampCount(): number {
    return entries.filter((entry) => entry.stamped === true).length;
  }

  function readyCount(): number {
    return entries.filter((entry) => entry.built).length;
  }

  function countsLines(): string[] {
    const total = entries.length;
    const ready = readyCount();
    const parts = [text(locale, 'map.stamps', { earned: stampCount(), total })];
    /* Both only while they are true, exactly as the map draws them: a finished
       game neither reports "Levels ready: N of N" nor promises more of
       something that is finished (ADR-0039). */
    if (ready < total) {
      parts.push(text(locale, 'map.levelsReady', { ready, total }), text(locale, 'map.moreComing'));
    }
    return parts;
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
   *
   * The item holds two things: the length of route it sits on, and the bordered
   * page the stamp is pressed into. The rail is a sibling of that page rather
   * than a child of it, because the route runs *between* the slots and nothing
   * inside a bordered box can reach the box below. The focusable, labelled,
   * `data-state`-carrying element is still the `<li>`, so what a keyboard
   * reaches and what a test reads are unchanged.
   */
  function slot(entry: MapEntry, stop: JourneyStop): HTMLElement {
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

    /*
     * The stamp, pressed beside "Earned" (ADR-0045): the completion card's own
     * stamp, inked, in the shape of the level's landmark. The live-site audit
     * found an earned slot drew only a word on a pill while the card that
     * awarded it drew a red stamp. `aria-hidden`, because "Earned" says it.
     */
    const artSrc =
      state === 'earned' && entry.id !== undefined ? options.stampArt?.(String(entry.id)) : null;
    if (artSrc !== null && artSrc !== undefined && artSrc !== '') {
      const stamp = createStamp(doc, { testId: `passport-stamp-art-${handle}` });
      stamp.element.className = 'tn-stamp tn-passport__stamp';
      stamp.show(artSrc, true);
      stamps.push(stamp);
      parts.push(stamp.element);
    }

    const page = element(doc, 'div', {
      className: 'tn-passport__page',
      children: help === null ? parts : [...parts, help],
    });

    /*
     * The stamp itself: a shape, on the route, beside the word that says the
     * same thing. `TN-PASSPORT-02` — "distinguishable from an unearned slot by
     * a shape and a label, not by colour alone" — and `TN-PASSPORT-09` — a
     * stamp is never announced as "image", "graphic" or an empty string, so the
     * tick rides inside the rail, which is `aria-hidden`, and the text beside it
     * is what is read.
     *
     * A slot for a level nobody has built draws **no** square at all
     * (`OQ-PASSPORT-4`): an empty outline reads as a slot the player could fill,
     * which is true of an unearned slot and false of a level nobody is making.
     * The stylesheet takes the square away on `data-journey-state="not-built"`;
     * the route still runs past it, because the place is still on the journey.
     */
    const rail = journeyRail(doc, {
      marker: 'stamp',
      state,
      stop,
      ...(state === 'earned' ? { glyph: '✓' } : {}),
    });

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
      children: [rail, page],
    });
    item.tabIndex = 0;
    return item;
  }

  function render(): void {
    const focusedHandle = focusedSlotHandle();
    const scroll = typeof screen.card.scrollTop === 'number' ? screen.card.scrollTop : 0;

    title.textContent = text(locale, 'passport.title');
    intro.textContent = text(locale, 'passport.intro');
    /* One line per count, as the map draws it: labels, not sentences. */
    replaceChildren(
      counts,
      countsLines().map((line) => element(doc, 'div', { text: line })),
    );

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

    /* One route, derived from the whole journey: a slot's legs depend on the
       slot before it, so no slot can work its own out. The last render's
       stamps are let go of first. */
    for (const stamp of stamps.splice(0)) stamp.destroy();
    replaceChildren(
      list,
      journeyRoute(entries).map(({ step, stop }) => slot(step, stop)),
    );
    renderExam();

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

  /**
   * The exam panel, or nothing at all.
   *
   * `TN-PASSPORT-06`'s last scenario is the one that shapes this function: where
   * the exam cannot run, the panel says so in `TN-EXAM-05`'s words and "does not
   * offer to start an exam that cannot start". A control that opens a screen
   * whose only content is an apology is worse than no control.
   */
  function renderExam(): void {
    if (exam === null) {
      replaceChildren(examPanel, []);
      examPanel.hidden = true;
      return;
    }
    examPanel.hidden = false;

    const parts: HTMLElement[] = [];
    const openLabel =
      exam.kind === 'unfinished' ? text(locale, 'exam.resume') : text(locale, 'exam.open');

    switch (exam.kind) {
      case 'not-ready':
        parts.push(
          element(doc, 'h2', {
            className: 'tn-screen__legend',
            text: text(locale, 'passport.exam.title'),
          }),
          element(doc, 'p', {
            testId: 'passport-exam-not-ready',
            text: text(locale, 'exam.notReady.title'),
          }),
          element(doc, 'p', {
            className: 'tn-screen__help',
            text: text(locale, 'exam.notReady.body'),
          }),
        );
        break;
      case 'none':
        parts.push(
          element(doc, 'h2', {
            className: 'tn-screen__legend',
            text: text(locale, 'passport.exam.title'),
          }),
          element(doc, 'p', {
            testId: 'passport-exam-none',
            text: text(locale, 'passport.exam.none'),
          }),
        );
        break;
      case 'unfinished':
        /* Not a result: a count of answers, and the way back to them. */
        parts.push(
          element(doc, 'h2', {
            className: 'tn-screen__legend',
            text: text(locale, 'passport.exam.title'),
          }),
          element(doc, 'p', {
            testId: 'passport-exam-unfinished',
            text: text(locale, 'exam.answered', {
              done: exam.answered,
              total: exam.total,
            }),
          }),
        );
        break;
      case 'result':
        parts.push(
          element(doc, 'h2', {
            className: 'tn-screen__legend',
            text: text(locale, 'passport.exam.last'),
          }),
          element(doc, 'p', {
            testId: 'passport-exam-verdict',
            text: text(
              locale,
              exam.passed ? 'exam.result.passed.title' : 'exam.result.notYet.title',
            ),
          }),
          element(doc, 'p', {
            testId: 'passport-exam-score',
            text: text(locale, 'exam.result.score', {
              correct: exam.correct,
              total: exam.total,
            }),
          }),
          element(doc, 'p', {
            className: 'tn-screen__help',
            text: text(
              locale,
              exam.timed ? 'exam.result.withTimer' : 'exam.result.noTimer',
            ),
          }),
        );
        break;
    }

    if (exam.kind !== 'not-ready' && options.onOpenExam !== undefined) {
      parts.push(
        button(doc, {
          testId: 'passport-exam-open',
          text: openLabel,
          onClick: options.onOpenExam,
        }),
      );
    }

    replaceChildren(examPanel, parts);
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

    setExam(next): void {
      exam = next;
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
      for (const stamp of stamps.splice(0)) stamp.destroy();
      screen.destroy();
    },
  };
}
