import { describe, expect, it, vi } from 'vitest';

import { createSettingsStore, DEFAULT_SETTINGS } from '@ui/settings';

/* Relative, not aliased: there is no `@bootstrap` alias and adding one means
   editing three configs that have to agree (tsconfig, vite, vitest). */
import {
  initialUpdateState,
  nextUpdateState,
  updateStateAfter,
  watchForUpdates,
  workerContainerOf,
  type UpdateEvent,
} from '../../../app/bootstrap/update-notice';
import { buildPage, type FakeElement } from '../ui/support/fake-dom';

/**
 * When the page says "A new version is ready" (ADR-0034, "Update flow").
 *
 * The first block is the trigger as a pure function — "controlled at load" and
 * the events since — which is where every rule the ADR and the slice state is
 * decided: never on a first visit, once on a page a newer worker took over, and
 * never over an open question card or the exam. The second block is the wire
 * from `navigator.serviceWorker` to the screen, against a container double and
 * the shared DOM double, with the real notice drawn.
 */

const changed = (controlled = true): UpdateEvent => ({ kind: 'controller-changed', controlled });
const opened = (blocker: string): UpdateEvent => ({ kind: 'blocker-opened', blocker });
const closed = (blocker: string): UpdateEvent => ({ kind: 'blocker-closed', blocker });
const dismissed: UpdateEvent = { kind: 'dismissed' };

describe('when the page offers a reload', () => {
  it('never on a first visit: the worker arriving is not an update', () => {
    expect(updateStateAfter(false, [changed()]).phase).toBe('idle');
  });

  it('never on a first visit, not even when a later build takes over the same page', () => {
    expect(updateStateAfter(false, [changed(), changed(), changed()]).phase).toBe('idle');
  });

  it('once a newer worker takes over a page that was controlled when it loaded', () => {
    expect(updateStateAfter(true, [changed()]).phase).toBe('shown');
    expect(updateStateAfter(true, [changed(), changed()]).phase).toBe('shown');
  });

  it('not when the page is left with no controller', () => {
    expect(updateStateAfter(true, [changed(false)]).phase).toBe('idle');
  });

  it('waits for an open question card, and is owed the moment it closes', () => {
    const deferred = updateStateAfter(true, [opened('poi'), changed()]);
    expect(deferred.phase).toBe('deferred');
    expect(nextUpdateState(deferred, closed('poi')).phase).toBe('shown');
  });

  it('waits for the exam', () => {
    const deferred = updateStateAfter(true, [opened('exam'), changed()]);
    expect(deferred.phase).toBe('deferred');
    expect(nextUpdateState(deferred, closed('exam')).phase).toBe('shown');
  });

  it('waits for everything open, not for the first thing to close', () => {
    const one = updateStateAfter(true, [opened('study'), opened('exam'), changed(), closed('exam')]);
    expect(one.phase).toBe('deferred');
    expect(one.blockers).toEqual(['study']);
    expect(nextUpdateState(one, closed('study')).phase).toBe('shown');
  });

  it('counts a blocker held twice as one, as the pause control does', () => {
    expect(
      updateStateAfter(true, [opened('poi'), opened('poi'), changed(), closed('poi')]).phase,
    ).toBe('shown');
  });

  it('does not take the notice away when a card opens over it', () => {
    const covered = updateStateAfter(true, [changed(), opened('exam')]);
    expect(covered.phase).toBe('shown');
    expect(nextUpdateState(covered, closed('exam')).phase).toBe('shown');
  });

  it('owes nothing for a card that opened and closed before any update', () => {
    expect(updateStateAfter(true, [opened('poi'), closed('poi')])).toEqual(initialUpdateState(true));
  });

  it('stays put away once dismissed, whatever arrives next', () => {
    expect(
      updateStateAfter(true, [changed(), dismissed, changed(), opened('poi'), closed('poi'), changed()])
        .phase,
    ).toBe('dismissed');
  });

  it('cannot be dismissed before it is on screen', () => {
    expect(updateStateAfter(true, [dismissed]).phase).toBe('idle');
    expect(updateStateAfter(true, [opened('exam'), changed(), dismissed]).phase).toBe('deferred');
  });

  it('hands back the same state for an event that changes nothing, and never mutates its input', () => {
    const start = Object.freeze({
      ...initialUpdateState(true),
      blockers: Object.freeze(['poi']),
    });
    expect(nextUpdateState(start, closed('exam'))).toBe(start);
    expect(nextUpdateState(start, opened('poi'))).toBe(start);
    expect(nextUpdateState(start, dismissed)).toBe(start);

    const next = nextUpdateState(start, changed());
    expect(next.phase).toBe('deferred');
    expect(start.phase).toBe('idle');
    expect(start.blockers).toEqual(['poi']);
  });
});

/* ------------------------------------------------------------------ the wire */

/** `navigator.serviceWorker`, as far as the watch can see it. */
class FakeWorkerContainer {
  controller: object | null;
  private readonly listeners: (() => void)[] = [];

  constructor(controlled: boolean) {
    this.controller = controlled ? {} : null;
  }

  addEventListener(type: string, listener: () => void): void {
    if (type === 'controllerchange') this.listeners.push(listener);
  }

  /** A newer worker claims the page: the browser sets `controller`, then fires. */
  takeOver(): void {
    this.controller = {};
    for (const listener of [...this.listeners]) listener();
  }

  get listening(): number {
    return this.listeners.length;
  }
}

function setup(options: { readonly controlled: boolean; readonly enabled?: boolean }) {
  const page = buildPage();
  const front = page.doc.createElement('main');
  page.ui.append(front);
  let host: FakeElement = front;

  /* `<html>`, for `data-tn-update`. The DOM double has no `dataset`, and nothing
     else of the root element is read. */
  const root = { dataset: {} as Record<string, string> };
  const container = new FakeWorkerContainer(options.controlled);
  const store = createSettingsStore({ ...DEFAULT_SETTINGS, locale: 'en' });
  const announce = vi.fn();
  const reload = vi.fn();
  const watch = watchForUpdates({
    enabled: options.enabled ?? true,
    container,
    root: root as unknown as HTMLElement,
  });

  return {
    page,
    front,
    root,
    container,
    store,
    announce,
    reload,
    watch,
    attach: (): void => {
      watch.attach({ store, announce, reload, host: () => host as unknown as HTMLElement });
    },
    moveHost: (next: FakeElement): void => {
      host = next;
    },
    notice: () => page.doc.byTestId('update-notice'),
  };
}

describe('the watch the composition root starts', () => {
  it('reads navigator.serviceWorker off a window, and nothing that is not one', () => {
    const container = new FakeWorkerContainer(false);
    expect(workerContainerOf({ navigator: { serviceWorker: container } })).toBe(container);
    expect(workerContainerOf(undefined)).toBeNull();
    expect(workerContainerOf(null)).toBeNull();
    /* The window double the bootstrap suites boot `main.ts` against: no navigator. */
    expect(workerContainerOf({ innerWidth: 390, innerHeight: 844 })).toBeNull();
    expect(workerContainerOf({ navigator: {} })).toBeNull();
    expect(workerContainerOf({ navigator: { serviceWorker: { controller: null } } })).toBeNull();
  });

  it('listens to nothing with no container, and hands the pause back untouched', () => {
    const root = { dataset: {} as Record<string, string> };
    const watch = watchForUpdates({
      enabled: true,
      container: null,
      root: root as unknown as HTMLElement,
    });
    const pause = { hold: vi.fn(), release: vi.fn() };

    expect(watch.deferDuring(pause, ['poi'])).toBe(pause);
    watch.block('exam');
    watch.unblock('exam');
    watch.rehome();

    expect(watch.state.phase).toBe('idle');
    expect(root.dataset).toEqual({});
  });

  it('does not listen at all with featureFlags.serviceWorker off', () => {
    const { container, watch, attach, notice, root } = setup({ controlled: true, enabled: false });
    attach();
    expect(container.listening).toBe(0);
    container.takeOver();
    expect(watch.state.phase).toBe('idle');
    expect(notice()).toBeNull();
    expect(root.dataset).toEqual({});
  });

  it('hears a first visit, says so on the page, and shows nothing', () => {
    const { container, attach, notice, root, announce } = setup({ controlled: false });
    attach();
    expect(container.listening).toBe(1);

    container.takeOver();
    expect(root.dataset['tnUpdate']).toBe('idle');
    expect(notice()).toBeNull();

    /* The page is controlled now; it is still the page a first visit loaded. */
    container.takeOver();
    expect(root.dataset['tnUpdate']).toBe('idle');
    expect(notice()).toBeNull();
    expect(announce).not.toHaveBeenCalled();
  });

  it("shows the notice once, first in the page's <main>, when a newer worker takes over", () => {
    const { container, attach, notice, root, announce, front } = setup({ controlled: true });
    attach();
    expect(notice()).toBeNull();
    expect(root.dataset).toEqual({});

    container.takeOver();
    expect(root.dataset['tnUpdate']).toBe('shown');
    expect(front.children[0]).toBe(notice());
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('A new version is ready', 'en');

    container.takeOver();
    expect(front.querySelectorAll('[data-testid="update-notice"]')).toHaveLength(1);
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('draws it when the screens arrive, if the update got there first', () => {
    const { container, attach, notice, root } = setup({ controlled: true });
    container.takeOver();
    expect(root.dataset['tnUpdate']).toBe('shown');
    expect(notice()).toBeNull();

    attach();
    expect(notice()).not.toBeNull();
  });

  it("waits for a landmark's question in a level, through the pause the level already takes", () => {
    const { container, attach, notice, root, watch } = setup({ controlled: true });
    attach();
    const calls: string[] = [];
    const pause = watch.deferDuring<'poi' | 'menu'>(
      {
        hold: (reason) => {
          calls.push(`hold ${reason}`);
        },
        release: (reason) => {
          calls.push(`release ${reason}`);
        },
      },
      ['poi'],
    );

    pause.hold('poi');
    container.takeOver();
    expect(root.dataset['tnUpdate']).toBe('deferred');
    expect(notice()).toBeNull();

    /* A reason the notice does not wait for passes straight through. */
    pause.hold('menu');
    pause.release('menu');
    expect(notice()).toBeNull();

    pause.release('poi');
    expect(root.dataset['tnUpdate']).toBe('shown');
    expect(notice()).not.toBeNull();
    /* And the level's own pause heard every call, in order. */
    expect(calls).toEqual(['hold poi', 'hold menu', 'release menu', 'release poi']);
  });

  it('waits for the exam on the front door', () => {
    const { container, attach, notice, watch } = setup({ controlled: true });
    attach();
    watch.block('exam');
    container.takeOver();
    expect(notice()).toBeNull();

    watch.unblock('exam');
    expect(notice()).not.toBeNull();
  });

  it('follows the page from the front door into a level and back, silently', () => {
    const { container, attach, notice, watch, page, front, moveHost, announce } = setup({
      controlled: true,
    });
    attach();
    container.takeOver();

    const level = page.doc.createElement('main');
    page.ui.append(level);
    moveHost(level);
    watch.rehome();
    expect(notice()?.parentElement).toBe(level);

    moveHost(front);
    watch.rehome();
    expect(notice()?.parentElement).toBe(front);
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('turns French with the settings, and says nothing more', () => {
    const { container, attach, notice, store, announce, page } = setup({ controlled: true });
    attach();
    container.takeOver();

    store.set('locale', 'fr');

    expect(page.doc.byTestId('update-notice-message')?.textContent).toBe(
      'Une nouvelle version est prête',
    );
    expect(notice()?.getAttribute('lang')).toBe('fr');
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('opens in the language the player has when it first appears', () => {
    const { container, attach, store, announce, page } = setup({ controlled: true });
    store.set('locale', 'fr');
    attach();
    container.takeOver();

    expect(page.doc.byTestId('update-notice-reload')?.textContent).toBe('Recharger');
    expect(announce).toHaveBeenCalledWith('Une nouvelle version est prête', 'fr');
  });

  it("reloads through the composition root's hand, and stays put away once dismissed", () => {
    const { container, attach, notice, root, reload, page } = setup({ controlled: true });
    attach();
    container.takeOver();

    page.doc.byTestId('update-notice-reload')?.click();
    expect(reload).toHaveBeenCalledTimes(1);

    page.doc.byTestId('update-notice-dismiss')?.click();
    expect(notice()).toBeNull();
    expect(root.dataset['tnUpdate']).toBe('dismissed');

    container.takeOver();
    expect(notice()).toBeNull();
  });
});
