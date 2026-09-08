/**
 * `data-testid="playable"` — the one DOM fact the level scene owns.
 *
 * `docs/stories/README.md` fixes it as "the level is loaded and accepts input",
 * and three suites already wait on it: `tests/perf/budgets.spec.ts` times
 * time-to-play against it, `tests/a11y/screens.spec.ts` measures touch targets
 * after it, and every scenario in `TN-LEVEL-ottawa.md` that begins "Given the
 * Ottawa level is playable" means this element. It is therefore a contract, not
 * a convenience, and it is *present only while the statement is true*: it goes
 * up on the first frame the player can act on and comes down the moment the
 * level is torn down, so a stalled or failed load can never leave a marker
 * behind claiming otherwise.
 *
 * ## Why it is not the canvas, and why it carries nothing
 *
 * The canvas is `aria-hidden` by contract and must not grow a second identity.
 * This is a separate, empty element that is also `aria-hidden`, has no text, no
 * role and nothing focusable inside it — so axe does not see it, a screen reader
 * does not read it, and it does not become a second thing competing with the one
 * live region a screen-reader user has. It does have a box, because Playwright's
 * default `waitForSelector` waits for *visible* and a zero-size element would
 * make every suite that waits on it hang rather than fail; `pointer-events:none`
 * keeps it out of the way of the canvas underneath.
 *
 * What it is emphatically *not* is the HUD. The mode label, the interact prompt,
 * the menu button and the question card are accessible DOM owned by the UI agent
 * (task 1.15). This element says one thing and says it to a test.
 *
 * Structural, so it is unit tested with no DOM: the element and its host arrive
 * as interfaces with three methods between them.
 */

export const PLAYABLE_TEST_ID = 'playable';

/**
 * Every attribute the marker carries, as data.
 *
 * Exported so a test can assert the set rather than the element — the names are
 * the part other agents write scenarios against, and a rename must break a test
 * and not a story.
 */
export const PLAYABLE_ATTRIBUTES: Readonly<Record<string, string>> = {
  'data-testid': PLAYABLE_TEST_ID,
  'aria-hidden': 'true',
  /* A box, so `waitForSelector` sees it; no hit area, so the canvas keeps every
     pointer event; no paint, so it costs nothing in the overdraw budget. */
  style: 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;',
};

/** The slice of an element the marker writes. */
export interface MarkerElement {
  setAttribute(name: string, value: string): void;
  remove(): void;
}

/** The slice of a host the marker attaches to. */
export interface MarkerHost {
  append(element: MarkerElement): void;
}

export interface PlayableMarker {
  /** True while the element is in the document. */
  readonly present: boolean;
  /** The level accepts input. Idempotent. */
  show(): void;
  /** The level no longer accepts input — a teardown, a failed reload. Idempotent. */
  hide(): void;
}

/**
 * Build the marker over an element and its host.
 *
 * The element is created by the caller (`game-renderer.ts`, the one file in this
 * adapter allowed to touch `document`) and attached here, so the lifecycle rule
 * — present exactly while playable — lives in one testable place instead of
 * being spread over whoever happened to call `append`.
 */
export function createPlayableMarker(host: MarkerHost, element: MarkerElement): PlayableMarker {
  for (const [name, value] of Object.entries(PLAYABLE_ATTRIBUTES)) {
    element.setAttribute(name, value);
  }

  let present = false;

  return {
    get present(): boolean {
      return present;
    },
    show(): void {
      if (present) return;
      present = true;
      host.append(element);
    },
    hide(): void {
      if (!present) return;
      present = false;
      element.remove();
    },
  };
}
