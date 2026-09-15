import { describe, expect, it, vi } from 'vitest';

import { text } from '@ui/copy';
import type { SaveFileLike, SaveImportCheck } from '@ui/save-transfer';
import { createSettingsScreen } from '@ui/settings-screen';
import { createSettingsStore, DEFAULT_SETTINGS, type Settings } from '@ui/settings';

import { buildPage, FakeEvent, press, type FakeElement, type FakePage } from './support/fake-dom';

/**
 * "Your progress" in Settings, and the two dialogs an import opens
 * (`TN-SAVE-06`, ADR-0046), through the real settings screen.
 *
 * What this file proves is the order of things, because each wrong order is a
 * lost game: nothing is replaced before the player says yes, "no" and Escape
 * replace nothing, a refused file opens no dialog, and the game starts again
 * only when the player asks. Geometry — the 44 px targets, nothing clipped at
 * 200 % — is `tests/a11y/save-transfer.spec.ts`, against real Chromium.
 */

/** Let every promise the section is waiting on settle. */
const settle = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const fileOf = (contents: string): SaveFileLike => ({
  size: contents.length,
  text: () => Promise.resolve(contents),
});

const refused =
  (reason: 'tooBig' | 'unreadable' | 'newer') => (): Promise<SaveImportCheck> =>
    Promise.resolve({ kind: 'refused', reason });

const ready =
  (replace: () => Promise<boolean>) => (): Promise<SaveImportCheck> =>
    Promise.resolve({ kind: 'ready', replace });

interface Fixture {
  readonly page: FakePage;
  readonly store: ReturnType<typeof createSettingsStore>;
  readonly announce: ReturnType<typeof vi.fn>;
  readonly onClose: ReturnType<typeof vi.fn>;
  readonly onExport: ReturnType<typeof vi.fn>;
  readonly onRestart: ReturnType<typeof vi.fn>;
  at(testId: string): FakeElement | null;
  /** Choose a file the way the browser's picker hands one over: through the input's `change`. */
  choose(file: SaveFileLike): Promise<void>;
}

function open(answer: () => Promise<SaveImportCheck>, initial: Partial<Settings> = {}): Fixture {
  const page = buildPage();
  const store = createSettingsStore({ ...DEFAULT_SETTINGS, ...initial });
  const announce = vi.fn();
  const onClose = vi.fn();
  const onExport = vi.fn();
  const onRestart = vi.fn();
  createSettingsScreen(page.host, {
    store,
    announce,
    onClose,
    saveTransfer: {
      onExport,
      onImport: () => answer(),
      onRestart,
    },
    now: () => 0,
  }).show();

  const at = (testId: string): FakeElement | null => page.doc.byTestId(testId);
  return {
    page,
    store,
    announce,
    onClose,
    onExport,
    onRestart,
    at,
    async choose(file: SaveFileLike): Promise<void> {
      const input = at('save-import-file');
      if (input === null) throw new Error('the section drew no file input');
      (input as unknown as { files: { item(index: number): SaveFileLike | null } }).files = {
        item: (index: number) => (index === 0 ? file : null),
      };
      input.dispatchEvent(new FakeEvent('change'));
      await settle();
    },
  };
}

describe('"Your progress" in Settings', () => {
  it('is a named group of two buttons, last before Close, with the file input out of reach', () => {
    const { at, page } = open(refused('unreadable'));
    const section = at('setting-save');

    expect(section?.getAttribute('role')).toBe('group');
    expect(
      page.doc.getElementById(section?.getAttribute('aria-labelledby') ?? '')?.textContent,
    ).toBe('Your progress');
    expect(
      page.doc.getElementById(section?.getAttribute('aria-describedby') ?? '')?.textContent,
    ).toBe(text('en', 'save.section.help'));
    expect(at('save-export')?.tagName).toBe('BUTTON');
    expect(at('save-export')?.textContent).toBe('Save to a file');
    expect(at('save-import')?.tagName).toBe('BUTTON');
    expect(at('save-import')?.textContent).toBe('Open a file');

    /* The native input draws its own words in the browser's language; the button is the control. */
    const input = at('save-import-file');
    expect(input?.getAttribute('type')).toBe('file');
    expect(input?.hidden).toBe(true);
    expect(input?.getAttribute('tabindex')).toBe('-1');

    const card = section?.parentElement;
    expect(card?.children.at(-1)?.byTestId('settings-close')).not.toBeNull();
    expect(card?.children.at(-2)).toBe(section);
  });

  it('is not drawn when the caller offers no save', () => {
    const page = buildPage();
    createSettingsScreen(page.host, { store: createSettingsStore() }).show();
    expect(page.doc.byTestId('setting-save')).toBeNull();
  });

  it('saves to a file from one button, and opens the picker from the other', () => {
    const { at, onExport } = open(refused('unreadable'));
    at('save-export')?.click();
    expect(onExport).toHaveBeenCalledTimes(1);

    at('save-import')?.click();
    expect(at('save-import-file')?.clickCount).toBe(1);
  });

  it.each([
    ['unreadable', 'save.import.error', 'save.import.error.help'],
    ['tooBig', 'save.import.tooBig', 'save.import.error.help'],
    ['newer', 'save.newer.title', 'save.import.newer.help'],
  ] as const)(
    'refuses a %s file with a sentence under the controls, said once, and no dialog',
    async (reason, what, next) => {
      const fixture = open(refused(reason));
      await fixture.choose(fileOf('whatever'));

      const sentence = `${text('en', what)} ${text('en', next)}`;
      const message = fixture.at('save-import-error');
      expect(message?.hidden).toBe(false);
      expect(message?.textContent).toBe(sentence);
      expect(fixture.at('save-import')?.getAttribute('aria-describedby')).toBe(message?.id);
      expect(fixture.announce).toHaveBeenCalledTimes(1);
      expect(fixture.announce).toHaveBeenCalledWith(sentence);
      expect(fixture.at('save-import-confirm')).toBeNull();
    },
  );

  it('asks before a file replaces anything, and "Keep my progress" replaces nothing', async () => {
    const replace = vi.fn(() => Promise.resolve(true));
    const fixture = open(ready(replace));
    await fixture.choose(fileOf('{}'));

    const dialog = fixture.at('save-import-confirm');
    expect(dialog?.hidden).toBe(false);
    expect(dialog?.getAttribute('role')).toBe('alertdialog');
    expect(
      fixture.page.doc.getElementById(dialog?.getAttribute('aria-labelledby') ?? '')?.textContent,
    ).toBe(text('en', 'save.import.confirm'));
    expect(
      fixture.page.doc.getElementById(dialog?.getAttribute('aria-describedby') ?? '')?.textContent,
    ).toBe(text('en', 'save.import.confirm.body'));
    expect(fixture.at('save-import-replace')?.textContent).toBe('Replace');
    expect(fixture.at('save-import-keep')?.textContent).toBe('Keep my progress');
    expect(replace).not.toHaveBeenCalled();

    fixture.at('save-import-keep')?.click();
    await settle();
    expect(dialog?.hidden).toBe(true);
    expect(replace).not.toHaveBeenCalled();
    expect(fixture.at('save-import-done')).toBeNull();
  });

  it('treats Escape in the confirmation as "no", and leaves Settings open', async () => {
    const replace = vi.fn(() => Promise.resolve(true));
    const fixture = open(ready(replace));
    await fixture.choose(fileOf('{}'));

    const dialog = fixture.at('save-import-confirm') as FakeElement;
    press(dialog, 'Escape');
    await settle();

    expect(dialog.hidden).toBe(true);
    expect(replace).not.toHaveBeenCalled();
    expect(fixture.onClose).not.toHaveBeenCalled();
    expect(fixture.at('settings-screen')?.hidden).toBe(false);
  });

  it('replaces on "Replace", says the game is back, and starts it again only when asked', async () => {
    const replace = vi.fn(() => Promise.resolve(true));
    const fixture = open(ready(replace));
    await fixture.choose(fileOf('{}'));
    fixture.at('save-import-replace')?.click();
    await settle();

    expect(replace).toHaveBeenCalledTimes(1);
    const done = fixture.at('save-import-done') as FakeElement;
    expect(done.hidden).toBe(false);
    expect(done.getAttribute('role')).toBe('alertdialog');
    expect(
      fixture.page.doc.getElementById(done.getAttribute('aria-labelledby') ?? '')?.textContent,
    ).toBe('Your game is back.');
    expect(fixture.onRestart).not.toHaveBeenCalled();

    press(done, 'Escape');
    expect(done.hidden, 'the dialog after a replacement was escaped into the old game').toBe(false);

    fixture.at('save-import-continue')?.click();
    expect(fixture.onRestart).toHaveBeenCalledTimes(1);
  });

  it('says so under the controls when the store refused the file, and leaves nothing open', async () => {
    const fixture = open(ready(() => Promise.resolve(false)));
    await fixture.choose(fileOf('{}'));
    fixture.at('save-import-replace')?.click();
    await settle();

    expect(fixture.at('save-import-done')).toBeNull();
    expect(fixture.at('save-import-confirm')?.hidden).toBe(true);
    expect(fixture.at('save-import-error')?.textContent).toBe(
      `${text('en', 'storage.warning')} ${text('en', 'save.import.notSaved.help')}`,
    );
    expect(fixture.page.doc.activeElement).toBe(fixture.at('save-import'));
  });

  it('is French in French, and follows a language change with the confirmation open', async () => {
    const fixture = open(ready(() => Promise.resolve(true)), { locale: 'fr' });
    expect(fixture.at('save-export')?.textContent).toBe('Enregistrer dans un fichier');
    expect(fixture.at('save-import')?.textContent).toBe('Ouvrir un fichier');

    fixture.store.set('locale', 'en');
    expect(fixture.at('save-import')?.textContent).toBe('Open a file');

    await fixture.choose(fileOf('{}'));
    fixture.store.set('locale', 'fr');
    const dialog = fixture.at('save-import-confirm');
    expect(
      fixture.page.doc.getElementById(dialog?.getAttribute('aria-labelledby') ?? '')?.textContent,
    ).toBe(text('fr', 'save.import.confirm'));
    expect(dialog?.getAttribute('lang')).toBe('fr');
  });
});
