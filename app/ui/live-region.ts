/**
 * The ARIA live region — the only channel between the game and a screen reader.
 *
 * The Phaser canvas is `aria-hidden="true"` by contract (CLAUDE.md,
 * Accessibility), so nothing drawn on it is perceivable to assistive technology.
 * Every game event that matters therefore has to be spoken here: "stamp earned",
 * "question 3 of 20", "you reached the lighthouse". Slice 0 proves the wire with
 * one message.
 *
 * DOM only. `app/ui` never imports an adapter or a scene (ADR-0005), which is
 * why this file knows nothing about Phaser and takes its messages as strings.
 */

const REGION_ID = 'tn-live-region';

/**
 * Screen readers announce a *change* to a live region, and they routinely miss a
 * change made in the same task as the region's insertion. Clearing first and
 * writing on a later task makes both the first announcement and a repeat of an
 * identical message reliable.
 */
const ANNOUNCE_DELAY_MS = 100;

/**
 * How long a message is left in the region before the next one replaces it.
 *
 * `TN-LEVEL-08`, "the announcements do not flood": when the skater passes three
 * things in reach in quick succession, "no announcement is cut off before it is
 * read" and "announcements are delivered in order". The old behaviour — a
 * second call replacing the first — fails both, and it fails them silently,
 * because the message that was dropped is the one nobody hears.
 *
 * This is not a player timer: nothing expires, nothing is chosen, and no
 * scenario passes or fails on how fast the player acts (CLAUDE.md: no timers
 * outside Exam mode). It paces the *game's* speech, and the queue drains whether
 * or not the player does anything.
 */
const MESSAGE_DWELL_MS = 900;

/** The standard visually-hidden recipe: present to AT, zero visual footprint. */
const HIDDEN_STYLE = [
  'position:absolute',
  'width:1px',
  'height:1px',
  'margin:-1px',
  'padding:0',
  'border:0',
  'overflow:hidden',
  'clip:rect(0 0 0 0)',
  'clip-path:inset(50%)',
  'white-space:nowrap',
  /* Contrast is undefined for clipped text; declare it anyway so axe never has to guess. */
  'color:#ffffff',
].join(';');

interface QueuedMessage {
  readonly message: string;
  /** BCP-47, for the announcing element — `TN-LEVEL-11` requires `lang="fr"`. */
  readonly lang?: string;
}

let region: HTMLElement | null = null;
let pending: ReturnType<typeof setTimeout> | undefined;
let queue: QueuedMessage[] = [];
let draining = false;

/**
 * Create the region and attach it to `host`. Called once by `app/bootstrap`.
 * Calling it again returns the existing region rather than making a second one —
 * two polite live regions is a well-known way to make a screen reader silent.
 */
export function mountLiveRegion(host: HTMLElement): HTMLElement {
  const existing = host.ownerDocument.getElementById(REGION_ID);
  if (existing !== null) {
    region = existing;
    return existing;
  }

  const element = host.ownerDocument.createElement('div');
  element.id = REGION_ID;
  /* `role="status"` implies polite; both are stated so the contract survives a refactor. */
  element.setAttribute('role', 'status');
  element.setAttribute('aria-live', 'polite');
  element.setAttribute('aria-atomic', 'true');
  element.setAttribute('style', HIDDEN_STYLE);

  host.appendChild(element);
  region = element;
  return element;
}

/**
 * Announce a message to assistive technology.
 *
 * TODO(slice-1): messages arrive already localised from the i18n adapter; this
 * helper must never build copy itself.
 *
 * Messages queue and are delivered in order. Slice 0 had one speaker and a
 * second call replaced the first; a level has several — arriving, coming into
 * reach of the officer, coming into reach of the landmark — and replacing is how
 * the middle one of three is never heard.
 *
 * Repeating the message currently queued or on screen is dropped rather than
 * queued twice: `TN-HUD-07` requires the storage warning not to be read again
 * every time the player answers a question, and a component that re-renders is
 * not a new event.
 *
 * @param lang BCP-47 tag for the message. `TN-LEVEL-11` requires the announcing
 *   element to carry `lang="fr"` when it is speaking French, so a screen reader
 *   does not read « Vous êtes sur le canal Rideau » with English phonemes.
 */
export function announce(message: string, lang?: string): void {
  const target = region ?? autoMount();
  if (target === null) return;
  if (message === '') return;

  const last = queue.at(-1);
  if (last !== undefined && last.message === message) return;
  if (queue.length === 0 && draining && target.textContent === message) return;

  queue.push(lang === undefined ? { message } : { message, lang });
  if (!draining) drain(target);
}

/**
 * Empty the queue, one message at a time.
 *
 * Clear, wait, write, wait, next. The first wait is what makes a repeat of an
 * identical message audible at all; the second is what stops the next message
 * cutting this one off.
 */
function drain(target: HTMLElement): void {
  const next = queue.shift();
  if (next === undefined) {
    draining = false;
    return;
  }

  draining = true;
  target.textContent = '';
  pending = setTimeout(() => {
    target.textContent = next.message;
    if (next.lang !== undefined) target.setAttribute('lang', next.lang);
    pending = setTimeout(() => {
      pending = undefined;
      drain(target);
    }, MESSAGE_DWELL_MS);
  }, ANNOUNCE_DELAY_MS);
}

/**
 * Drop anything not yet spoken. For a screen leaving the page: the announcements
 * it queued describe something the player can no longer reach.
 */
export function clearAnnouncements(): void {
  queue = [];
  if (pending !== undefined) clearTimeout(pending);
  pending = undefined;
  draining = false;
}

/** Escape hatch for a caller that announces before bootstrap mounted the layer. */
function autoMount(): HTMLElement | null {
  if (typeof document === 'undefined' || document.body === null) return null;
  return mountLiveRegion(document.body);
}
