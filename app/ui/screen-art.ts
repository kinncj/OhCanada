/**
 * Decorative art on a DOM screen: a picture that sits beside the words and
 * never stands in for them (ADR-0041).
 *
 * Four screens draw a picture since the live-site audit found them to be
 * "huge, text-only white screens": the landmark card shows the landmark, the
 * dialogue shows who is speaking, the completion card shows the level's stamp,
 * and the title and Study home show the country the game is about. Every one of
 * them already says, in words, everything the picture shows — the card's
 * heading names the landmark, the dialog is named by its speaker, the stamp
 * sentence names the place — so every picture here is **decoration**:
 *
 *  - the frame is `aria-hidden` and the image inside it has `alt=""`, so a
 *    screen reader hears exactly what it heard before the picture existed;
 *  - it holds no control, so focus order and the single-switch ring are
 *    unchanged;
 *  - **a picture that cannot load is gone, not an empty box** — the frame hides
 *    itself and says `data-state="failed"`, the same rule the creator's picture
 *    follows (ADR-0040, `TN-CREATOR-03`);
 *  - it is still: nothing here animates, so reduced motion has nothing to take
 *    away.
 *
 * The frame publishes `data-state` (`empty`, `loading`, `ready`, `failed`) and
 * `data-src`, so a browser test can read what is drawn without comparing pixels.
 *
 * Where a picture comes from is not this file's business: a screen is handed a
 * URL — the level's own landmark image, a character portrait painted by the
 * composition root, or the screen art under `assets/src/svg/screens/` — and
 * draws it.
 *
 * DOM only (ADR-0005).
 */

import { element } from './dom';

/**
 * The landscape the title screen and the Study home are drawn over:
 * `assets/src/svg/screens/title-landscape.svg`, screen art that ships as the SVG
 * itself (`scripts/lib/screen-art.mjs`) and is charged to no level.
 *
 * Resolved through Vite, as the map's drawing is (`./level-map.ts`): the file is
 * content-hashed and emitted because something imports it, and the service
 * worker precaches it with the shell. One URL for both screens, so the second
 * is a cache hit.
 */
export const LANDSCAPE_URL = new URL(
  '../../assets/src/svg/screens/title-landscape.svg',
  import.meta.url,
).href;

export type ArtState = 'empty' | 'loading' | 'ready' | 'failed';

export interface ArtFrameOptions {
  /** The frame's own class, for the screen's layout. */
  readonly className: string;
  /** `data-testid`, from the table in `docs/stories/README.md`. */
  readonly testId: string;
}

export interface ArtFrame {
  /** The `aria-hidden` frame. Place it; do not put words in it. */
  readonly element: HTMLElement;
  readonly state: ArtState;
  /** Draw this picture, or none. Drawing the picture already shown does nothing. */
  show(src: string | null | undefined): void;
  /** Let go of the image and take the frame off the page. */
  destroy(): void;
}

/**
 * A frame holding one decorative `<img>`.
 *
 * Hidden until it is given a picture. Visible while the picture loads, so a
 * card does not change height when an image already in the cache arrives a
 * frame later, and hidden again if the picture fails.
 */
export function createArtFrame(doc: Document, options: ArtFrameOptions): ArtFrame {
  let state: ArtState = 'empty';

  const image = element(doc, 'img', {
    className: `${options.className}-image`,
    attrs: { alt: '', decoding: 'async', draggable: 'false' },
  });

  const frame = element(doc, 'div', {
    className: options.className,
    testId: options.testId,
    attrs: { 'aria-hidden': 'true', 'data-state': state },
    children: [image],
  });
  frame.hidden = true;

  const settle = (next: ArtState): void => {
    state = next;
    frame.setAttribute('data-state', next);
    frame.hidden = next === 'empty' || next === 'failed';
  };

  /* An event about a picture that is no longer the one asked for is ignored:
     a card shown twice in quick succession must not be hidden by the first
     picture's late failure. */
  const asked = (): string | null => frame.getAttribute('data-src');
  image.addEventListener('load', () => {
    if (asked() !== null) settle('ready');
  });
  image.addEventListener('error', () => {
    if (asked() !== null) settle('failed');
  });

  return {
    element: frame,
    get state(): ArtState {
      return state;
    },

    show(src): void {
      if (src === null || src === undefined || src === '') {
        frame.removeAttribute('data-src');
        /* `removeAttribute`, never `src = ''`: an empty src is a request for
           the page itself in some engines. */
        image.removeAttribute('src');
        settle('empty');
        return;
      }
      if (asked() === src && state !== 'failed') return;
      frame.setAttribute('data-src', src);
      settle('loading');
      image.setAttribute('src', src);
    },

    destroy(): void {
      frame.removeAttribute('data-src');
      image.removeAttribute('src');
      frame.remove();
    },
  };
}

export interface StampArt {
  readonly element: HTMLElement;
  readonly state: ArtState;
  /**
   * The stamp for a level: `src` is the level's landmark picture, whose shape
   * becomes the stamp's silhouette. `inked` is whether the stamp was earned;
   * an un-inked stamp is drawn as an outline waiting to be pressed.
   */
  show(src: string | null | undefined, inked: boolean): void;
  destroy(): void;
}

/**
 * A passport stamp: a ring, and inside it the silhouette of the level's
 * landmark in stamp ink.
 *
 * The silhouette is the landmark's own picture used as a CSS mask, filled with
 * one flat colour. So the shape is the level art's — reference-accurate because
 * it is the same drawing — and nothing is drawn per level. The picture is
 * probed with a detached `<img>` first, so a mask is only applied to a picture
 * that loaded, and a stamp whose picture failed takes itself away.
 */
export function createStamp(doc: Document, options: { readonly testId: string }): StampArt {
  let state: ArtState = 'empty';

  const mark = element(doc, 'span', { className: 'tn-stamp__mark' });
  /* The probe: a hidden image of the same picture, so the mask is applied only
     once the picture has loaded. A hidden image still loads, and it is the same
     URL, so it is one request. */
  const probe = element(doc, 'img', { className: 'tn-stamp__probe', attrs: { alt: '' } });
  probe.hidden = true;
  const ring = element(doc, 'span', { className: 'tn-stamp__ring', children: [mark] });
  const stamp = element(doc, 'div', {
    className: 'tn-stamp',
    testId: options.testId,
    attrs: { 'aria-hidden': 'true', 'data-state': state, 'data-inked': 'false' },
    children: [ring, probe],
  });
  stamp.hidden = true;

  const settle = (next: ArtState): void => {
    state = next;
    stamp.setAttribute('data-state', next);
    stamp.hidden = next === 'empty' || next === 'failed';
  };

  const asked = (): string | null => stamp.getAttribute('data-src');

  probe.addEventListener('load', () => {
    const src = asked();
    if (src === null) return;
    const value = `url("${cssUrl(src)}")`;
    mark.style.setProperty('-webkit-mask-image', value);
    mark.style.setProperty('mask-image', value);
    settle('ready');
  });
  probe.addEventListener('error', () => {
    if (asked() !== null) settle('failed');
  });

  return {
    element: stamp,
    get state(): ArtState {
      return state;
    },

    show(src, inked): void {
      stamp.setAttribute('data-inked', inked ? 'true' : 'false');
      if (src === null || src === undefined || src === '') {
        stamp.removeAttribute('data-src');
        probe.removeAttribute('src');
        settle('empty');
        return;
      }
      if (asked() === src && state !== 'failed') {
        stamp.hidden = false;
        return;
      }
      stamp.setAttribute('data-src', src);
      mark.style.setProperty('-webkit-mask-image', 'none');
      mark.style.setProperty('mask-image', 'none');
      settle('loading');
      probe.setAttribute('src', src);
    },

    destroy(): void {
      stamp.removeAttribute('data-src');
      probe.removeAttribute('src');
      stamp.remove();
    },
  };
}

/** A URL made safe inside `url("...")`: the three characters that would end it. */
export function cssUrl(src: string): string {
  return src.replace(/["\\\n\r]/g, (character) => encodeURIComponent(character));
}
