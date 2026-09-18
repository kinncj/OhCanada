import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { text } from '@ui/copy';
import {
  createPortraitNotice,
  PORTRAIT_NOTICE_MESSAGE_ID,
  type PortraitNoticeOptions,
} from '@ui/portrait-notice';
import { SWITCH_LABEL_ATTRIBUTE } from '@ui/single-switch';

import { buildPage, type FakeElement } from './support/fake-dom';

/**
 * "This game works best on a phone held upright" on its own (ADR-0060).
 *
 * **When** it is raised is `app/bootstrap/portrait-notice.ts`'s decision and is
 * tested in `tests/unit/bootstrap/portrait-notice.test.ts`. This file is what
 * the element is once it is: a status line that is not a second announcer, one
 * real button, no focus taken, no dialog, no trap, no timer, and never drawn
 * behind one. What cannot be proved here — 44 px targets, 200 % text, contrast,
 * forced colours — is `tests/a11y/portrait-notice.spec.ts`, in a real browser.
 */

const asHost = (node: FakeElement): HTMLElement => node as unknown as HTMLElement;

/** A page whose `<main>` holds one control: the shape of both places it is drawn. */
function mount(overrides: Partial<PortraitNoticeOptions> = {}, focusableMain = false) {
  const page = buildPage();
  const main = page.doc.createElement('main');
  if (focusableMain) main.setAttribute('tabindex', '-1');
  const title = page.doc.createElement('button');
  title.setAttribute('data-testid', 'title-play');
  main.append(title);
  page.ui.append(main);

  const announce = vi.fn();
  const onDismiss = vi.fn();
  const notice = createPortraitNotice(page.document, {
    locale: 'en',
    announce,
    onDismiss,
    ...overrides,
  });
  return {
    page,
    main,
    title,
    notice,
    announce,
    onDismiss,
    at: () => page.doc.byTestId('portrait-notice'),
  };
}

const bothSentences = (locale: 'en' | 'fr'): string =>
  `${text(locale, 'portrait.notice')} ${text(locale, 'portrait.notice.help')}`;

describe('the portrait notice', () => {
  describe('what it is, and what it is deliberately not', () => {
    it('draws both sentences and one Close control, in the language the player reads', () => {
      const { notice, main, at } = mount({ locale: 'fr' });
      expect(notice.raise(asHost(main))).toBe(true);

      const root = at();
      expect(root).not.toBeNull();
      expect(root?.getAttribute('lang')).toBe('fr');
      expect(root?.byTestId('portrait-notice-message')?.textContent).toBe(
        text('fr', 'portrait.notice'),
      );
      expect(root?.byTestId('portrait-notice-help')?.textContent).toBe(
        text('fr', 'portrait.notice.help'),
      );
      expect(root?.byTestId('portrait-notice-dismiss')?.textContent).toBe(
        text('fr', 'common.close'),
      );
    });

    /**
     * The claim this whole change rests on. The rotate overlay is an
     * `alertdialog` with `aria-modal` and a focus trap because a sideways phone
     * has no layout; a desktop and a tablet are supported platforms (ADR-0002,
     * ADR-0055) and must not be blocked to be told something.
     */
    it('is not a dialog: no role, no aria-modal, and nothing made inert', () => {
      const { notice, main, page, title, at } = mount();
      notice.raise(asHost(main));

      expect(at()?.getAttribute('role')).toBeNull();
      expect(at()?.getAttribute('aria-modal')).toBeNull();
      expect(at()?.querySelectorAll('[role="dialog"],[role="alertdialog"],[aria-modal]')).toEqual(
        [],
      );
      /* Everything behind it is still reachable, which is the difference. */
      expect(title.inert).toBe(false);
      expect(page.ui.inert).toBe(false);
      expect(page.game.inert).toBe(false);
    });

    it('takes no focus when it appears', () => {
      const { notice, main, page } = mount();
      notice.raise(asHost(main));

      expect(page.doc.activeElement).toBeNull();
    });

    it('carries no timer: nothing here can expire or auto-dismiss', () => {
      /*
       * Asserted from the source, the way `single-switch.test.ts` asserts its
       * own. A notice that goes away by itself is one a slow reader never
       * finishes, and CLAUDE.md allows no timer outside Exam mode — so the gate
       * has to fail when somebody adds one, not when somebody notices.
       */
      const source = readFileSync(
        new URL('../../../app/ui/portrait-notice.ts', import.meta.url),
        'utf8',
      );
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(code).not.toMatch(/setTimeout|setInterval|requestAnimationFrame/);
    });
  });

  describe('what a screen reader and a switch are given', () => {
    it('is a status that is not a second announcer, and is spoken once', () => {
      const { notice, main, announce, at } = mount();
      notice.raise(asHost(main));

      const message = at()?.byTestId('portrait-notice-message');
      expect(message?.getAttribute('role')).toBe('status');
      /* `role="status"` implies a live region; `off` keeps it from being one. */
      expect(message?.getAttribute('aria-live')).toBe('off');
      expect(at()?.getAttribute('aria-live')).toBeNull();

      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(bothSentences('en'), 'en');
    });

    it('is not announced again when it follows the page or changes language', () => {
      const { notice, main, page, announce } = mount();
      notice.raise(asHost(main));

      const level = page.doc.createElement('main');
      page.ui.append(level);
      notice.moveTo(asHost(level));
      notice.setLocale('fr');
      notice.raise(asHost(level));

      expect(announce).toHaveBeenCalledTimes(1);
    });

    it('describes its Close control, so no reader meets a bare "Close"', () => {
      const { notice, main, at } = mount();
      notice.raise(asHost(main));

      const close = at()?.byTestId('portrait-notice-dismiss');
      expect(close?.getAttribute('aria-describedby')).toBe(PORTRAIT_NOTICE_MESSAGE_ID);
      /* The description has to point at something that exists. */
      expect(at()?.byTestId('portrait-notice-message')?.id).toBe(PORTRAIT_NOTICE_MESSAGE_ID);
    });

    /**
     * A switch user gets neither a description nor a glance at the screen:
     * `app/ui/single-switch.ts` announces an item's label and never its
     * `aria-describedby`. Without this the scan says "Close" and the one player
     * who cannot look around has to guess what is being closed.
     */
    it('names what it closes for a switch, from the rows already drawn', () => {
      const { notice, main, at } = mount();
      notice.raise(asHost(main));

      const close = at()?.byTestId('portrait-notice-dismiss');
      const label = close?.getAttribute(SWITCH_LABEL_ATTRIBUTE) ?? '';
      expect(label).toContain(text('en', 'portrait.notice'));
      expect(label).toContain(text('en', 'portrait.notice.help'));
      expect(label).toContain(text('en', 'common.close'));
    });
  });

  describe('putting it away', () => {
    it('removes it, reports it, and does not come back while this page lives', () => {
      const { notice, main, onDismiss, at } = mount();
      notice.raise(asHost(main));

      at()?.byTestId('portrait-notice-dismiss')?.click();

      expect(at()).toBeNull();
      expect(notice.raised).toBe(false);
      expect(notice.dismissed).toBe(true);
      expect(onDismiss).toHaveBeenCalledTimes(1);

      /* Terminal: a later raise draws nothing and says nothing. */
      expect(notice.raise(asHost(main))).toBe(false);
      expect(at()).toBeNull();
    });

    it('does not let focus fall to the body when the control that had it goes', () => {
      const { notice, main, page, title, at } = mount();
      notice.raise(asHost(main));

      const close = at()?.byTestId('portrait-notice-dismiss');
      close?.focus();
      close?.click();

      expect(page.doc.activeElement).not.toBeNull();
      expect(page.doc.activeElement).toBe(title);
    });

    it('leaves focus alone when it was somewhere else', () => {
      const { notice, main, page, title, at } = mount();
      notice.raise(asHost(main));
      title.focus();

      at()?.byTestId('portrait-notice-dismiss')?.click();

      expect(page.doc.activeElement).toBe(title);
    });

    it('puts focus on the focusable <main> a level owns, when there is one', () => {
      const { notice, main, page, at } = mount({}, true);
      notice.raise(asHost(main));

      const close = at()?.byTestId('portrait-notice-dismiss');
      close?.focus();
      close?.click();

      expect(page.doc.activeElement).toBe(main);
    });
  });

  describe('living with the page', () => {
    it('is drawn first in the <main>, so it is inside the landmark and in the ring', () => {
      const { notice, main } = mount();
      notice.raise(asHost(main));

      expect(main.firstElementChild?.getAttribute('data-testid')).toBe('portrait-notice');
    });

    it('is raised once: a second call stacks nothing', () => {
      const { notice, main, page } = mount();
      expect(notice.raise(asHost(main))).toBe(true);
      expect(notice.raise(asHost(main))).toBe(false);

      expect(page.doc.querySelectorAll('[data-testid="portrait-notice"]')).toHaveLength(1);
    });

    it('follows the page into a level and back, without being rebuilt', () => {
      const { notice, main, page, at } = mount();
      notice.raise(asHost(main));
      const first = at();

      const level = page.doc.createElement('main');
      page.ui.append(level);
      notice.moveTo(asHost(level));

      expect(level.firstElementChild).toBe(first);
      expect(page.doc.querySelectorAll('[data-testid="portrait-notice"]')).toHaveLength(1);
    });

    /**
     * A modal makes everything outside it inert when it opens, and an element
     * added afterwards is not covered — which is how the title screen once ended
     * up reachable behind the rotate overlay. This notice is raised on a load
     * where nothing is open, so it guards rather than queues.
     */
    it('is not drawn behind a dialog that says nothing behind it is reachable', () => {
      const { notice, main, at } = mount();
      main.inert = true;

      expect(notice.raise(asHost(main))).toBe(false);
      expect(at()).toBeNull();
    });

    it('is not drawn beside something a trap has made inert', () => {
      const { notice, main, page, at } = mount();
      const dialog = page.doc.createElement('div');
      main.append(dialog);
      /* What a focus trap leaves behind: the siblings of the dialog go inert. */
      (main.children[0] as FakeElement).inert = true;

      expect(notice.raise(asHost(main))).toBe(false);
      expect(at()).toBeNull();
    });
  });

  describe('changing language under it', () => {
    it('redraws every word in place, keeping the same controls', () => {
      const { notice, main, at } = mount();
      notice.raise(asHost(main));
      const closeBefore = at()?.byTestId('portrait-notice-dismiss');

      notice.setLocale('fr');

      expect(at()?.getAttribute('lang')).toBe('fr');
      expect(at()?.byTestId('portrait-notice-message')?.textContent).toBe(
        text('fr', 'portrait.notice'),
      );
      expect(at()?.byTestId('portrait-notice-help')?.textContent).toBe(
        text('fr', 'portrait.notice.help'),
      );
      expect(at()?.byTestId('portrait-notice-dismiss')?.textContent).toBe(
        text('fr', 'common.close'),
      );
      /* The same node: a rebuilt button would take focus and the switch
         highlight with it. */
      expect(at()?.byTestId('portrait-notice-dismiss')).toBe(closeBefore);
    });

    it('re-says what the switch reads, in the new language', () => {
      const { notice, main, at } = mount();
      notice.raise(asHost(main));
      notice.setLocale('fr');

      const label = at()?.byTestId('portrait-notice-dismiss')?.getAttribute(SWITCH_LABEL_ATTRIBUTE);
      expect(label).toContain(text('fr', 'portrait.notice'));
      expect(label).toContain(text('fr', 'common.close'));
    });

    it('is harmless before it is drawn and after it is destroyed', () => {
      const { notice, main, at } = mount();
      expect(() => {
        notice.setLocale('fr');
      }).not.toThrow();

      notice.raise(asHost(main));
      notice.destroy();
      expect(at()).toBeNull();
      expect(notice.raise(asHost(main))).toBe(false);
    });
  });
});
