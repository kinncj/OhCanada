import { describe, expect, it, vi } from 'vitest';

import type { WebStorage } from '@adapters/persistence';
import { text } from '@ui/copy';
import { createSettingsStore, DEFAULT_SETTINGS } from '@ui/settings';

/* Relative, not aliased: there is no `@bootstrap` alias and adding one means
   editing three configs that have to agree (tsconfig, vite, vitest). */
import {
  PORTRAIT_NOTICE_STORAGE_KEY,
  portraitNoticeIsOwed,
  portraitNoticeWasDismissed,
  rememberPortraitNoticeDismissed,
  watchPortraitFit,
} from '../../../app/bootstrap/portrait-notice';
import { buildPage, type FakeElement } from '../ui/support/fake-dom';

/**
 * When the game says "this works best on a phone held upright" (ADR-0060).
 *
 * Three rules are decided here and nowhere else: **who** is owed the notice,
 * **once** — from the viewport the page loaded at, never re-asked on a resize —
 * and **never again on this device** once it has been put away. The element
 * itself is `tests/unit/ui/portrait-notice.test.ts`.
 */

/** A `localStorage` double, and a lever for the browsers that refuse one. */
function fakeStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  } satisfies WebStorage;
  return { storage, values };
}

/** A store whose methods throw on touch: Safari in private mode, site data blocked. */
const hostileStorage = (): WebStorage => ({
  getItem: () => {
    throw new Error('site data blocked');
  },
  setItem: () => {
    throw new Error('site data blocked');
  },
  removeItem: () => {
    throw new Error('site data blocked');
  },
});

/** The page the notice is drawn into: `#ui` with one `<main>` in it. */
function pageWithMain() {
  const page = buildPage();
  const main = page.doc.createElement('main');
  const play = page.doc.createElement('button');
  play.setAttribute('data-testid', 'title-play');
  main.append(play);
  page.ui.append(main);
  return { page, main, host: () => main as unknown as HTMLElement };
}

const wiringFor = (host: () => HTMLElement, locale: 'en' | 'fr' = 'en') => ({
  store: createSettingsStore({ ...DEFAULT_SETTINGS, locale }),
  announce: vi.fn(),
  host,
});

const DESKTOP = { width: 1440, height: 900 } as const;
const TABLET_PORTRAIT = { width: 768, height: 1024 } as const;
const PHONE_PORTRAIT = { width: 390, height: 844 } as const;
const PHONE_LANDSCAPE = { width: 844, height: 390 } as const;

describe('who is owed the notice', () => {
  it('a desktop, a laptop or a tablet that has not put it away', () => {
    expect(portraitNoticeIsOwed('large', false)).toBe(true);
  });

  it('nobody who has already put it away on this device', () => {
    expect(portraitNoticeIsOwed('large', true)).toBe(false);
  });

  /* The two halves of "a phone is told nothing new". The second is the one that
     matters: a sideways phone is already being asked to turn back, and being
     nudged at the same time is the defect ADR-0060 is written to prevent. */
  it('never a phone held upright', () => {
    expect(portraitNoticeIsOwed('phone-portrait', false)).toBe(false);
  });

  it('never a phone turned sideways, which the rotate overlay already has', () => {
    expect(portraitNoticeIsOwed('phone-landscape', false)).toBe(false);
  });
});

describe('what this device remembers', () => {
  it('reads the flag it wrote', () => {
    const { storage, values } = fakeStorage();
    expect(portraitNoticeWasDismissed(storage)).toBe(false);

    rememberPortraitNoticeDismissed(storage);
    expect(values.get(PORTRAIT_NOTICE_STORAGE_KEY)).toBe('1');
    expect(portraitNoticeWasDismissed(storage)).toBe(true);
  });

  it('keeps the flag out of the save key, so deleting progress does not undo it', () => {
    /*
     * ADR-0060: a dismissal is a property of this device, not of this player's
     * progress. `clearBoth` (ADR-0026) empties the save's key; if this one were
     * the same key, or a field inside that document, a player who deleted their
     * progress would be nagged again — and a save file carried to another device
     * would carry a dismissal that was never made there.
     */
    expect(PORTRAIT_NOTICE_STORAGE_KEY).not.toContain('progress');
    expect(PORTRAIT_NOTICE_STORAGE_KEY).toBe('truenorth.portrait-notice.dismissed');
  });

  it('treats a browser with no storage as "not dismissed" rather than failing', () => {
    expect(portraitNoticeWasDismissed(null)).toBe(false);
    expect(() => {
      rememberPortraitNoticeDismissed(null);
    }).not.toThrow();
  });

  it('survives a store that throws on touch, in both directions', () => {
    const storage = hostileStorage();
    expect(portraitNoticeWasDismissed(storage)).toBe(false);
    expect(() => {
      rememberPortraitNoticeDismissed(storage);
    }).not.toThrow();
  });

  it('reads only its own value as a dismissal', () => {
    const { storage } = fakeStorage({ [PORTRAIT_NOTICE_STORAGE_KEY]: 'nope' });
    expect(portraitNoticeWasDismissed(storage)).toBe(false);
  });
});

describe('the wire from a load-time viewport to the words', () => {
  const at = (page: ReturnType<typeof pageWithMain>['page']): FakeElement | null =>
    page.doc.byTestId('portrait-notice');

  it('draws it for a desktop window, once, in the language the save was read in', () => {
    const { page, host } = pageWithMain();
    const watch = watchPortraitFit({ ...DESKTOP, storage: fakeStorage().storage });
    expect(watch.audience).toBe('large');
    expect(watch.owed).toBe(true);

    const wiring = wiringFor(host, 'fr');
    watch.attach(wiring);

    expect(at(page)).not.toBeNull();
    expect(at(page)?.getAttribute('lang')).toBe('fr');
    expect(wiring.announce).toHaveBeenCalledTimes(1);
  });

  it('draws it for a tablet held upright, which the layout rule calls portrait', () => {
    const { page, host } = pageWithMain();
    const watch = watchPortraitFit({ ...TABLET_PORTRAIT, storage: fakeStorage().storage });

    expect(watch.audience).toBe('large');
    watch.attach(wiringFor(host));
    expect(at(page)).not.toBeNull();
  });

  it('draws nothing at all on a phone held upright', () => {
    const { page, host } = pageWithMain();
    const watch = watchPortraitFit({ ...PHONE_PORTRAIT, storage: fakeStorage().storage });

    expect(watch.audience).toBe('phone-portrait');
    expect(watch.owed).toBe(false);
    const wiring = wiringFor(host);
    watch.attach(wiring);

    expect(at(page)).toBeNull();
    expect(wiring.announce).not.toHaveBeenCalled();
  });

  it('draws nothing on a phone turned sideways, which belongs to the rotate overlay', () => {
    const { page, host } = pageWithMain();
    const watch = watchPortraitFit({ ...PHONE_LANDSCAPE, storage: fakeStorage().storage });

    expect(watch.audience).toBe('phone-landscape');
    expect(watch.owed).toBe(false);
    watch.attach(wiringFor(host));
    expect(at(page)).toBeNull();
  });

  it('draws nothing on a device that has already put it away', () => {
    const { page, host } = pageWithMain();
    const watch = watchPortraitFit({
      ...DESKTOP,
      storage: fakeStorage({ [PORTRAIT_NOTICE_STORAGE_KEY]: '1' }).storage,
    });

    expect(watch.owed).toBe(false);
    watch.attach(wiringFor(host));
    expect(at(page)).toBeNull();
  });

  it('writes the dismissal down, so the next load says nothing', () => {
    const { page, host } = pageWithMain();
    const { storage, values } = fakeStorage();
    const watch = watchPortraitFit({ ...DESKTOP, storage });
    watch.attach(wiringFor(host));

    at(page)?.byTestId('portrait-notice-dismiss')?.click();

    expect(at(page)).toBeNull();
    expect(watch.owed).toBe(false);
    expect(values.get(PORTRAIT_NOTICE_STORAGE_KEY)).toBe('1');
    /* The next page's watch, over the same device's storage. */
    expect(watchPortraitFit({ ...DESKTOP, storage }).owed).toBe(false);
  });

  it('still lets the player dismiss it where the browser will not remember', () => {
    const { page, host } = pageWithMain();
    const watch = watchPortraitFit({ ...DESKTOP, storage: hostileStorage() });
    watch.attach(wiringFor(host));

    expect(at(page)).not.toBeNull();
    expect(() => at(page)?.byTestId('portrait-notice-dismiss')?.click()).not.toThrow();
    expect(at(page)).toBeNull();
  });

  it('follows the page when a level takes it, and back', () => {
    const { page, main, host } = pageWithMain();
    const watch = watchPortraitFit({ ...DESKTOP, storage: fakeStorage().storage });

    const level = page.doc.createElement('main');
    page.ui.append(level);
    let inLevel = false;
    watch.attach({
      ...wiringFor(host),
      host: () => (inLevel ? level : main) as unknown as HTMLElement,
    });

    inLevel = true;
    watch.rehome();
    expect(level.firstElementChild?.getAttribute('data-testid')).toBe('portrait-notice');
    expect(page.doc.querySelectorAll('[data-testid="portrait-notice"]')).toHaveLength(1);
  });

  it('changes language with the player, in place', () => {
    const { page, host } = pageWithMain();
    const watch = watchPortraitFit({ ...DESKTOP, storage: fakeStorage().storage });
    const wiring = wiringFor(host, 'en');
    watch.attach(wiring);

    wiring.store.set('locale', 'fr');

    expect(at(page)?.byTestId('portrait-notice-message')?.textContent).toBe(
      text('fr', 'portrait.notice'),
    );
    /* Changing the words says nothing: the sentence is `aria-live="off"`. */
    expect(wiring.announce).toHaveBeenCalledTimes(1);
  });

  it('attaches once: a second wiring does not draw a second notice', () => {
    const { page, host } = pageWithMain();
    const watch = watchPortraitFit({ ...DESKTOP, storage: fakeStorage().storage });
    watch.attach(wiringFor(host));
    watch.attach(wiringFor(host));

    expect(page.doc.querySelectorAll('[data-testid="portrait-notice"]')).toHaveLength(1);
  });

  it('is decided by the viewport the page loaded at, and nothing re-asks it', () => {
    /*
     * The guard on ADR-0060 §4. `main.ts` re-classifies on every resize for the
     * rotate overlay's sake; this watch exposes no way to do the same, so a
     * desktop player who drags a window cannot be interrupted and a tablet
     * player cannot be told twice. If a `sync`-shaped method ever appears here,
     * this assertion is what fails.
     */
    const watch = watchPortraitFit({ ...PHONE_PORTRAIT, storage: fakeStorage().storage });
    expect(Object.keys(watch).sort()).toEqual(['attach', 'audience', 'owed', 'rehome']);
  });
});
