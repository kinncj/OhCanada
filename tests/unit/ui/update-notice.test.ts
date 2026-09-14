import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { text } from '@ui/copy';
import {
  createUpdateNotice,
  UPDATE_NOTICE_MESSAGE_ID,
  type UpdateNoticeOptions,
} from '@ui/update-notice';

import { buildPage, FakeEvent, type FakeElement } from './support/fake-dom';

/**
 * "A new version is ready" on its own (ADR-0034, "Update flow").
 *
 * When it is raised is `app/bootstrap/update-notice.ts`'s decision and is tested
 * in `tests/unit/bootstrap/update-notice.test.ts`. This file is what the element
 * is once it is: a status line that is not a second announcer, two real buttons,
 * no focus taken, no timer, and never drawn under a dialog. What cannot be proved
 * here — 44 px targets, 200 % text, contrast, forced colours — is
 * `tests/a11y/update-notice.spec.ts`, in a real browser.
 */

const asHost = (node: FakeElement): HTMLElement => node as unknown as HTMLElement;

/**
 * A page whose `<main>` holds one control, which is the shape of both places the
 * notice is drawn: the front door's `<main>` (not focusable) and a level's (made
 * focusable by `Hud.focus`, which `focusableMain` stands for).
 */
function mount(overrides: Partial<UpdateNoticeOptions> = {}, focusableMain = false) {
  const page = buildPage();
  const main = page.doc.createElement('main');
  if (focusableMain) main.setAttribute('tabindex', '-1');
  const title = page.doc.createElement('button');
  title.setAttribute('data-testid', 'title-play');
  main.append(title);
  page.ui.append(main);

  const announce = vi.fn();
  const onReload = vi.fn();
  const onDismiss = vi.fn();
  const notice = createUpdateNotice(page.document, {
    locale: 'en',
    announce,
    onReload,
    onDismiss,
    ...overrides,
  });
  return {
    page,
    main,
    title,
    notice,
    announce,
    onReload,
    onDismiss,
    at: () => page.doc.byTestId('update-notice'),
  };
}

describe('the update notice', () => {
  it('draws the two rows ADR-0034 names, in both languages', () => {
    expect(text('en', 'update.ready')).toBe('A new version is ready');
    expect(text('fr', 'update.ready')).toBe('Une nouvelle version est prête');
    expect(text('en', 'update.reload')).toBe('Reload');
    expect(text('fr', 'update.reload')).toBe('Recharger');
  });

  it('is nothing at all until it is raised', () => {
    const { notice, at, announce, page } = mount();
    expect(notice.raised).toBe(false);
    expect(notice.element).toBeNull();
    expect(at()).toBeNull();
    expect(announce).not.toHaveBeenCalled();
    /* The shared sheet is on the page, so the first raise has its 44 pt controls. */
    expect(page.doc.getElementById('tn-screen-style')).not.toBeNull();
  });

  it('is a status line and two real buttons, and not a dialog', () => {
    const { notice, main, page } = mount();
    notice.raise(asHost(main));

    const root = page.doc.byTestId('update-notice');
    const message = page.doc.byTestId('update-notice-message');
    const reload = page.doc.byTestId('update-notice-reload');
    const dismiss = page.doc.byTestId('update-notice-dismiss');

    expect(notice.element).toBe(root);
    expect(message?.getAttribute('role')).toBe('status');
    expect(message?.id).toBe(UPDATE_NOTICE_MESSAGE_ID);
    expect(message?.textContent).toBe('A new version is ready');
    /* No role on the wrapper: a focus trap never makes `[role="status"]` inert,
       and these two buttons must go inert behind every dialog. */
    expect(root?.getAttribute('role')).toBeNull();
    expect(root?.getAttribute('aria-modal')).toBeNull();
    expect(root?.getAttribute('lang')).toBe('en');
    expect(root?.querySelectorAll('[role="dialog"]')).toHaveLength(0);

    for (const control of [reload, dismiss]) {
      expect(control?.tagName).toBe('BUTTON');
      expect(control?.type).toBe('button');
      expect(control?.getAttribute('aria-describedby')).toBe(UPDATE_NOTICE_MESSAGE_ID);
    }
    expect(reload?.textContent).toBe('Reload');
    expect(dismiss?.textContent).toBe(text('en', 'common.close'));
  });

  it('speaks once, through the one live region, and is not a second one', () => {
    const { notice, main, page, announce } = mount();
    const elsewhere = page.doc.createElement('main');
    page.ui.append(elsewhere);

    notice.raise(asHost(main));
    notice.raise(asHost(main));
    notice.moveTo(asHost(elsewhere));
    notice.setLocale('fr');

    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('A new version is ready', 'en');
    expect(page.doc.byTestId('update-notice-message')?.getAttribute('aria-live')).toBe('off');
    expect(page.doc.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
    expect(page.doc.querySelectorAll('[data-testid="update-notice"]')).toHaveLength(1);
  });

  it('comes first in the <main> it is drawn into', () => {
    const { notice, main, title } = mount();
    notice.raise(asHost(main));
    expect(main.children[0]?.getAttribute('data-testid')).toBe('update-notice');
    expect(main.children[1]).toBe(title);
  });

  it('takes no focus when it appears', () => {
    const { notice, main, title, page } = mount();
    title.focus();
    notice.raise(asHost(main));
    expect(page.doc.activeElement).toBe(title);
    expect(page.doc.byTestId('update-notice-reload')?.focusCount).toBe(0);
    expect(page.doc.byTestId('update-notice-dismiss')?.focusCount).toBe(0);
  });

  it('asks the composition root to reload, and stays until the page does', () => {
    const { notice, main, onReload, at } = mount();
    notice.raise(asHost(main));
    at()?.querySelector('[data-testid="update-notice-reload"]')?.click();
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(at()).not.toBeNull();
  });

  it('can be put away, and neither comes back nor speaks again', () => {
    const { notice, main, onDismiss, announce, at } = mount();
    notice.raise(asHost(main));
    at()?.querySelector('[data-testid="update-notice-dismiss"]')?.click();

    expect(at()).toBeNull();
    expect(notice.raised).toBe(false);
    expect(notice.dismissed).toBe(true);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    notice.raise(asHost(main));
    notice.moveTo(asHost(main));
    expect(at()).toBeNull();
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it("hands focus to a level's <main> when the control that had it goes", () => {
    const { notice, main, page } = mount({}, true);
    notice.raise(asHost(main));
    const dismiss = page.doc.byTestId('update-notice-dismiss');
    dismiss?.focus();
    dismiss?.click();
    expect(page.doc.activeElement).toBe(main);
  });

  it('hands focus to the next control on the front door, whose <main> is not focusable', () => {
    const { notice, main, title, page } = mount();
    notice.raise(asHost(main));
    const dismiss = page.doc.byTestId('update-notice-dismiss');
    dismiss?.focus();
    dismiss?.click();
    expect(page.doc.activeElement).toBe(title);
  });

  it('leaves focus alone when it was somewhere else', () => {
    const { notice, main, title, page } = mount();
    notice.raise(asHost(main));
    title.focus();
    page.doc.byTestId('update-notice-dismiss')?.click();
    expect(page.doc.activeElement).toBe(title);
    expect(title.focusCount).toBe(1);
  });

  it('draws and speaks French for a French player', () => {
    const { notice, main, page, announce } = mount({ locale: 'fr' });
    notice.raise(asHost(main));
    expect(page.doc.byTestId('update-notice-message')?.textContent).toBe(
      'Une nouvelle version est prête',
    );
    expect(page.doc.byTestId('update-notice-reload')?.textContent).toBe('Recharger');
    expect(page.doc.byTestId('update-notice-dismiss')?.textContent).toBe('Fermer');
    expect(page.doc.byTestId('update-notice')?.getAttribute('lang')).toBe('fr');
    expect(announce).toHaveBeenCalledWith('Une nouvelle version est prête', 'fr');
  });

  it('changes language in place, keeping focus, and says nothing', () => {
    const { notice, main, page, announce } = mount();
    notice.raise(asHost(main));
    const before = page.doc.byTestId('update-notice');
    const reload = page.doc.byTestId('update-notice-reload');
    reload?.focus();

    notice.setLocale('fr');

    expect(page.doc.byTestId('update-notice')).toBe(before);
    expect(page.doc.byTestId('update-notice-reload')).toBe(reload);
    expect(reload?.textContent).toBe('Recharger');
    expect(before?.getAttribute('lang')).toBe('fr');
    expect(page.doc.activeElement).toBe(reload);
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('changes language quietly while it is down, and speaks the new one when raised', () => {
    const { notice, main, page, announce } = mount();
    notice.setLocale('fr');
    notice.raise(asHost(main));
    expect(page.doc.byTestId('update-notice-message')?.textContent).toBe(
      'Une nouvelle version est prête',
    );
    expect(announce).toHaveBeenCalledWith('Une nouvelle version est prête', 'fr');
  });

  it('does not appear under a dialog, and appears when the dialog gives focus back', () => {
    const { notice, main, title, page, announce, at } = mount();
    /* What a focus trap leaves while it is open: everything beside the dialog, inert. */
    const dialog = page.doc.createElement('div');
    main.append(dialog);
    title.inert = true;

    notice.raise(asHost(main));
    expect(at()).toBeNull();
    expect(notice.waiting).toBe(true);
    expect(announce).not.toHaveBeenCalled();
    expect(page.doc.listenerCount('focusin')).toBe(1);

    /* Focus moving inside the dialog is not the dialog letting go. */
    page.doc.dispatchEvent(new FakeEvent('focusin'));
    expect(at()).toBeNull();

    dialog.remove();
    title.inert = false;
    title.focus();
    page.doc.dispatchEvent(new FakeEvent('focusin'));

    expect(at()).not.toBeNull();
    expect(main.children[0]).toBe(at());
    expect(notice.waiting).toBe(false);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(page.doc.listenerCount('focusin')).toBe(0);
    expect(page.doc.activeElement).toBe(title);
  });

  it('waits inside a <main> that a dialog beside it has made inert', () => {
    const { notice, main, page, at } = mount();
    main.inert = true;
    notice.raise(asHost(main));
    expect(at()).toBeNull();

    main.inert = false;
    page.doc.dispatchEvent(new FakeEvent('focusin'));
    expect(at()).not.toBeNull();
  });

  it('follows the page to another <main>, first in it, without speaking', () => {
    const { notice, main, page, announce, at } = mount();
    const level = page.doc.createElement('main');
    level.append(page.doc.createElement('section'));
    page.ui.append(level);

    notice.raise(asHost(main));
    notice.moveTo(asHost(level));

    expect(at()?.parentElement).toBe(level);
    expect(level.children[0]).toBe(at());
    expect(main.querySelectorAll('[data-testid="update-notice"]')).toHaveLength(0);
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('checks its new home again when the page moves while it waits', () => {
    const { notice, main, title, page, at } = mount();
    title.inert = true;
    notice.raise(asHost(main));
    expect(notice.waiting).toBe(true);

    const level = page.doc.createElement('main');
    page.ui.append(level);
    notice.moveTo(asHost(level));

    expect(at()?.parentElement).toBe(level);
    expect(notice.waiting).toBe(false);
    expect(page.doc.listenerCount('focusin')).toBe(0);
  });

  it('is gone after destroy, and stops listening', () => {
    const { notice, main, title, page, at } = mount();
    title.inert = true;
    notice.raise(asHost(main));
    notice.destroy();
    expect(page.doc.listenerCount('focusin')).toBe(0);
    title.inert = false;
    page.doc.dispatchEvent(new FakeEvent('focusin'));
    expect(at()).toBeNull();

    const again = mount();
    again.notice.raise(asHost(again.main));
    again.notice.destroy();
    expect(again.at()).toBeNull();
    again.notice.raise(asHost(again.main));
    expect(again.at()).toBeNull();
  });

  it('never goes away on its own: nothing in it schedules anything', () => {
    /* CLAUDE.md: no timers outside Exam mode. `no-second-countdown.test.ts` holds
       the whole of app/ to that; this names the one file it matters most for. */
    const source = readFileSync(new URL('../../../app/ui/update-notice.ts', import.meta.url), 'utf8');
    expect(
      /\b(?:setTimeout|setInterval|requestAnimationFrame|requestIdleCallback)\(/u.test(source),
    ).toBe(false);
  });
});
