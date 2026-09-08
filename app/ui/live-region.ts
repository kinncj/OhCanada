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

let region: HTMLElement | null = null;
let pending: ReturnType<typeof setTimeout> | undefined;

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
 * A second call before the first has been written replaces it. That is right for
 * slice 0 — one boot message — and wrong for gameplay; the a11y agent replaces
 * this with a queue when there is more than one speaker.
 */
export function announce(message: string): void {
  const target = region ?? autoMount();
  if (target === null) return;

  target.textContent = '';
  if (pending !== undefined) clearTimeout(pending);
  pending = setTimeout(() => {
    target.textContent = message;
    pending = undefined;
  }, ANNOUNCE_DELAY_MS);
}

/** Escape hatch for a caller that announces before bootstrap mounted the layer. */
function autoMount(): HTMLElement | null {
  if (typeof document === 'undefined' || document.body === null) return null;
  return mountLiveRegion(document.body);
}
