/**
 * Rotate-to-portrait overlay.
 *
 * TrueNorth has no landscape layout and never will (ADR-0002). When a phone is
 * turned sideways the game pauses and this covers the screen until the player
 * turns it back. A tablet or a desktop window in landscape is *not* this case:
 * it keeps the same portrait canvas, centred, with side panels — so the trigger
 * is `classifyViewport`, not `window.orientation`.
 *
 * DOM only, per ADR-0005: it cannot import the Phaser adapter, so pausing is a
 * callback the composition root supplies.
 *
 * It is a real modal, not a decorative one: `aria-modal` is backed by
 * `app/ui/focus-trap`, so the background is `inert` and Tab cannot leave the
 * dialog while it is up.
 */

import { createFocusTrap, type FocusTrap } from './focus-trap';
import { type ViewportMode, classifyViewport, shouldShowRotateOverlay } from './viewport-mode';

export type OverlayLocale = 'en' | 'fr';

interface Copy {
  readonly lang: string;
  readonly title: string;
  readonly body: string;
}

/**
 * TODO(slice-1): move to content/locales and read through the LocalizerPort.
 * Hardcoded here so slice 0 ships real bilingual copy rather than a placeholder;
 * inventing `content/locales/*.json` is the content agent's call, not this one's.
 * Plain language, roughly CLB 4 (CLAUDE.md).
 */
const COPY: Readonly<Record<OverlayLocale, Copy>> = {
  en: {
    lang: 'en',
    title: 'Turn your phone upright',
    body: 'TrueNorth is played in portrait. Turn your phone back upright to keep playing.',
  },
  fr: {
    lang: 'fr',
    title: 'Remettez votre téléphone à la verticale',
    body: 'TrueNorth se joue en mode portrait. Remettez votre téléphone à la verticale pour continuer.',
  },
};

const STYLE_ID = 'tn-rotate-overlay-style';

/**
 * The overlay carries its own CSS instead of relying on `index.html`.
 * `app/ui` owns its presentation, and a `<style>` element keeps that true
 * without adding a CSS import that only the bundler understands.
 */
const CSS = `
#tn-rotate-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding:
    max(24px, env(safe-area-inset-top, 0px))
    max(24px, env(safe-area-inset-right, 0px))
    max(24px, env(safe-area-inset-bottom, 0px))
    max(24px, env(safe-area-inset-left, 0px));
  background: #060d16;
  color: #ffffff;
  pointer-events: auto;
  text-align: center;
}
#tn-rotate-overlay[hidden] { display: none; }
#tn-rotate-overlay:focus { outline: none; }
#tn-rotate-overlay .tn-rotate-card {
  max-width: 34rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
#tn-rotate-overlay .tn-rotate-glyph {
  width: 3rem;
  height: 4.5rem;
  border: 3px solid #ffffff;
  border-radius: 0.6rem;
  transform: rotate(90deg);
  animation: tn-rotate-hint 2.4s ease-in-out infinite;
}
#tn-rotate-overlay h1 {
  margin: 0;
  font-size: clamp(1.25rem, 4vw, 1.75rem);
  line-height: 1.2;
}
#tn-rotate-overlay p {
  margin: 0;
  font-size: clamp(1rem, 3vw, 1.125rem);
  line-height: 1.5;
  color: #dbe7f1;
}
@keyframes tn-rotate-hint {
  0%, 40% { transform: rotate(90deg); }
  70%, 100% { transform: rotate(0deg); }
}
@media (prefers-reduced-motion: reduce) {
  #tn-rotate-overlay .tn-rotate-glyph { animation: none; transform: rotate(0deg); }
}
`;

export interface RotateOverlayOptions {
  /** Which of the two hardcoded strings to show. Defaults to `en`. */
  readonly locale?: OverlayLocale;
  /** Called when the overlay becomes visible. The composition root pauses the game here. */
  readonly onShow?: () => void;
  /** Called when it is dismissed by returning to portrait. */
  readonly onHide?: () => void;
  /** Short-side breakpoint forwarded to `classifyViewport`. */
  readonly phoneShortSidePx?: number;
}

export interface RotateOverlay {
  readonly element: HTMLElement;
  readonly visible: boolean;
  /** Re-evaluate against a measured viewport and return the mode it decided. */
  sync(width: number, height: number): ViewportMode;
  /** Show or hide directly. `sync` is the normal entry point. */
  setVisible(visible: boolean): void;
  destroy(): void;
}

export function createRotateOverlay(
  host: HTMLElement,
  options: RotateOverlayOptions = {},
): RotateOverlay {
  const doc = host.ownerDocument;
  injectStyle(doc);

  const copy = COPY[options.locale ?? 'en'];

  const element = doc.createElement('div');
  element.id = 'tn-rotate-overlay';
  /* `alertdialog`: it interrupts, it is modal, and it carries a message to read. */
  element.setAttribute('role', 'alertdialog');
  /*
   * Backed by the focus trap below. `aria-modal` without containment is a lie to
   * assistive technology, so the two are set in the same place on purpose: if the
   * trap is ever removed, this attribute goes with it.
   */
  element.setAttribute('aria-modal', 'true');
  element.setAttribute('aria-labelledby', 'tn-rotate-title');
  element.setAttribute('aria-describedby', 'tn-rotate-body');
  element.setAttribute('lang', copy.lang);
  element.tabIndex = -1;
  element.hidden = true;

  const card = doc.createElement('div');
  card.className = 'tn-rotate-card';

  const glyph = doc.createElement('div');
  glyph.className = 'tn-rotate-glyph';
  /* Decorative: the instruction is the text, never the picture (colour/shape is never the only signal). */
  glyph.setAttribute('aria-hidden', 'true');

  const title = doc.createElement('h1');
  title.id = 'tn-rotate-title';
  title.textContent = copy.title;

  const body = doc.createElement('p');
  body.id = 'tn-rotate-body';
  body.textContent = copy.body;

  card.append(glyph, title, body);
  element.append(card);
  host.append(element);

  let visible = false;
  const trap: FocusTrap = createFocusTrap(element);

  const setVisible = (next: boolean): void => {
    if (next === visible) return;
    visible = next;
    /* `hidden` comes off before the trap activates: focus cannot land on a hidden element. */
    element.hidden = !next;
    if (next) {
      /*
       * Move focus into the dialog and hold it there. The trap also inerts
       * everything behind the overlay, so a keyboard or switch user cannot reach
       * controls for a game that is paused and covered.
       */
      trap.activate();
      options.onShow?.();
    } else {
      /* Releases `inert` and returns focus to whatever had it before the rotation. */
      trap.release();
      options.onHide?.();
    }
  };

  return {
    element,
    get visible(): boolean {
      return visible;
    },
    sync(width: number, height: number): ViewportMode {
      const mode =
        options.phoneShortSidePx === undefined
          ? classifyViewport(width, height)
          : classifyViewport(width, height, options.phoneShortSidePx);
      setVisible(shouldShowRotateOverlay(mode));
      return mode;
    },
    setVisible,
    destroy(): void {
      /* Release first: a removed element cannot un-inert its former siblings. */
      trap.release();
      visible = false;
      element.remove();
    },
  };
}

function injectStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID) !== null) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.append(style);
}
