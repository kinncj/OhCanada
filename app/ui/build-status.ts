/**
 * The line that tells a visitor what they are looking at.
 *
 * Slice 0 ships a foundation: a portrait canvas, a scale contract and a
 * deployment pipeline. There is no level, no character and nothing to press.
 * Two players reported the live site as "stuck at the loading screen" from
 * different devices — the build was healthy, the page reached
 * `data-tn-boot="ready"`, and it still communicated failure, because a title
 * over an empty screen with no explanation is indistinguishable from a load
 * that never finished. Silence is not neutral. This element is the fix: it
 * states the build's real state, in plain language, in both official languages.
 *
 * Why it is DOM and not painted on the canvas: the canvas is `aria-hidden` by
 * contract (CLAUDE.md, Accessibility), so a sentence drawn on it does not exist
 * for a screen-reader user. Before this element the only thing assistive
 * technology could perceive on the whole page was "TrueNorth ready", which says
 * even less than the picture did.
 *
 * It is deliberately not a live region and not interactive: `app/ui/live-region`
 * owns the one announcement channel, and a second polite region is a well-known
 * way to make a screen reader go quiet. `message` is exposed so the composition
 * root can fold the same sentence into the boot announcement without this
 * module reaching for the announcer.
 *
 * DOM only, per ADR-0005: no adapter, no scene, no Phaser.
 */

export type BuildStatusLocale = 'en' | 'fr';

interface Copy {
  readonly lang: string;
  readonly text: string;
}

/**
 * TODO(slice-1): move to content/locales and read through the LocalizerPort,
 * together with the rotate overlay's copy — the two move in one change.
 * Hardcoded here for the same reason as `app/ui/rotate-overlay.ts`: slice 0
 * ships real bilingual copy rather than a placeholder, and inventing
 * `content/locales/*.json` is the content agent's call, not this one's.
 *
 * Plain language, roughly CLB 4 (CLAUDE.md, Accessibility). Short, specific and
 * true: it names the state, says what is missing, and says what comes next, so
 * "nothing is happening" reads as a stage rather than a fault. It must never
 * describe progress — no percentages, no "loading", no "please wait".
 */
const COPY: Readonly<Record<BuildStatusLocale, Copy>> = {
  en: {
    lang: 'en',
    text: 'Foundation build. There is no level to play yet — the first one comes next.',
  },
  fr: {
    lang: 'fr',
    text: "Version de base. Il n'y a pas encore de niveau à jouer — le premier arrive ensuite.",
  },
};

const ELEMENT_ID = 'tn-build-status';
const STYLE_ID = 'tn-build-status-style';

/**
 * Own CSS, like the rotate overlay: `app/ui` owns its presentation, and a
 * `<style>` element keeps that true without a CSS import only the bundler
 * understands.
 *
 * The background is an opaque colour rather than a wash over the canvas. Text on
 * a translucent panel over a gradient has no computable contrast — an automated
 * check reports "incomplete" and a human has to guess — so the panel is solid
 * and the pair is 13:1, well past AA. `pointer-events: none` because it is a
 * caption, not a control: `#ui > *` opts children back into hit-testing, and a
 * caption that eats a tap on the playfield would be a defect in slice 1.
 * Sizes are in `rem` and `clamp`, so 200% text scaling grows it (CLAUDE.md).
 *
 * It is anchored well above the bottom edge for two reasons: ADR-0002 puts
 * everything a player reads in the lower third within thumb reach, and the last
 * rows of the canvas are the ones the desktop side panels have to match colour
 * for colour, so a caption sitting on them would hide the seam rather than the
 * seam being right. Growing text pushes the panel upwards, never down.
 */
const CSS = `
#${ELEMENT_ID} {
  position: absolute;
  left: 50%;
  bottom: max(15%, 3rem);
  transform: translateX(-50%);
  box-sizing: border-box;
  width: max-content;
  max-width: min(30rem, calc(100% - 2rem));
  margin: 0;
  padding: 0.7rem 1.1rem;
  border: 1px solid #24405c;
  border-radius: 0.75rem;
  background: #0a1826;
  color: #dce8f2;
  font-size: clamp(0.9375rem, 3.4vw, 1.0625rem);
  line-height: 1.45;
  text-align: center;
  text-wrap: balance;
  pointer-events: none;
}
`;

export interface BuildStatusOptions {
  /** Which of the two strings to show. Defaults to `en`. */
  readonly locale?: BuildStatusLocale;
}

export interface BuildStatus {
  readonly element: HTMLElement;
  /** The visible sentence, as plain text, for the boot announcement. */
  readonly message: string;
  destroy(): void;
}

export function createBuildStatus(
  host: HTMLElement,
  options: BuildStatusOptions = {},
): BuildStatus {
  const doc = host.ownerDocument;
  injectStyle(doc);

  const copy = COPY[options.locale ?? 'en'];

  const element = doc.createElement('p');
  element.id = ELEMENT_ID;
  element.setAttribute('lang', copy.lang);
  element.textContent = copy.text;

  host.append(element);

  return {
    element,
    message: copy.text,
    destroy(): void {
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
