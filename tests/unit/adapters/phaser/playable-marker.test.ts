/**
 * `data-testid="playable"`: present exactly while the level accepts input.
 *
 * Three suites outside this directory wait on this element, and one of them
 * (`tests/perf`) times a budget against the moment it appears. So the lifecycle
 * — up on the first playable frame, down on teardown, and never up during a
 * failed or stalled load — is a contract and not an implementation detail. Both
 * halves are asserted here, because a marker that goes up and never comes down
 * would make every later scenario pass against a level that is not there.
 */

import { describe, expect, it } from 'vitest';

import {
  PLAYABLE_ATTRIBUTES,
  PLAYABLE_TEST_ID,
  createPlayableMarker,
  type MarkerElement,
  type MarkerHost,
} from '@adapters/phaser/playable-marker';

function fakes(): {
  host: MarkerHost & { readonly appended: () => number };
  element: MarkerElement & {
    readonly attributes: Record<string, string>;
    readonly removed: () => number;
  };
} {
  const attributes: Record<string, string> = {};
  let removed = 0;
  let appended = 0;

  return {
    host: {
      append() {
        appended += 1;
      },
      appended: () => appended,
    },
    element: {
      attributes,
      setAttribute(name, value) {
        attributes[name] = value;
      },
      remove() {
        removed += 1;
      },
      removed: () => removed,
    },
  };
}

describe('the marker carries the contract other agents write against', () => {
  it('is named exactly as docs/stories/README.md fixes it', () => {
    expect(PLAYABLE_TEST_ID).toBe('playable');
    expect(PLAYABLE_ATTRIBUTES['data-testid']).toBe('playable');
  });

  it('is invisible to assistive technology', () => {
    /* The canvas is `aria-hidden` by contract and this element must not become a
       second thing a screen reader finds next to the one live region. */
    expect(PLAYABLE_ATTRIBUTES['aria-hidden']).toBe('true');
  });

  it('has a box, so a suite waiting for it fails rather than hanging', () => {
    /* Playwright's default `waitForSelector` waits for *visible*, and a
       zero-size element is never visible. A marker nobody can wait on is a
       marker that turns a red test into a 30 s timeout. */
    const style = PLAYABLE_ATTRIBUTES['style'] ?? '';
    expect(style).toContain('width:100%');
    expect(style).toContain('height:100%');
  });

  it('takes no pointer events, so it cannot swallow a tap meant for the canvas', () => {
    expect(PLAYABLE_ATTRIBUTES['style']).toContain('pointer-events:none');
  });

  it('carries nothing else: no role, no label, nothing focusable', () => {
    expect(Object.keys(PLAYABLE_ATTRIBUTES).sort()).toEqual(
      ['aria-hidden', 'data-testid', 'style'].sort(),
    );
  });
});

describe('the lifecycle', () => {
  it('writes its attributes once, at construction', () => {
    const { host, element } = fakes();
    createPlayableMarker(host, element);
    expect(element.attributes['data-testid']).toBe(PLAYABLE_TEST_ID);
  });

  it('is absent until the level says it is playable', () => {
    const { host, element } = fakes();
    const marker = createPlayableMarker(host, element);
    expect(marker.present).toBe(false);
    expect(host.appended()).toBe(0);
  });

  it('appears on show and disappears on hide', () => {
    const { host, element } = fakes();
    const marker = createPlayableMarker(host, element);

    marker.show();
    expect(marker.present).toBe(true);
    expect(host.appended()).toBe(1);

    marker.hide();
    expect(marker.present).toBe(false);
    expect(element.removed()).toBe(1);
  });

  it('is idempotent both ways, so a reload cannot leave two of them', () => {
    const { host, element } = fakes();
    const marker = createPlayableMarker(host, element);

    marker.show();
    marker.show();
    expect(host.appended()).toBe(1);

    marker.hide();
    marker.hide();
    expect(element.removed()).toBe(1);
  });

  it('can be shown again after a hide, which is what "Try again" needs', () => {
    const { host, element } = fakes();
    const marker = createPlayableMarker(host, element);
    marker.show();
    marker.hide();
    marker.show();
    expect(marker.present).toBe(true);
    expect(host.appended()).toBe(2);
  });
});
