import { describe, expect, it, vi } from 'vitest';

import { text } from '@ui/copy';
import type { SaveFileLike, SaveImportCheck } from '@ui/save-transfer';
import { createSettingsScreen } from '@ui/settings-screen';
import { createSettingsStore, DEFAULT_SETTINGS, type Settings } from '@ui/settings';

import { HIGHLIGHT_ATTRIBUTE } from '@ui/single-switch';

import {
  buildPage,
  FakeEvent,
  press,
  pressSwitch,
  type FakeElement,
  type FakePage,
} from './support/fake-dom';

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
  readonly onDelete: ReturnType<typeof vi.fn>;
  at(testId: string): FakeElement | null;
  /** Choose a file the way the browser's picker hands one over: through the input's `change`. */
  choose(file: SaveFileLike): Promise<void>;
}

/**
 * @param deletes What the store answers "Delete my progress" with: `true` gone,
 *   `false` refused, `null` a caller that cannot delete at all and therefore
 *   draws no control.
 */
function open(
  answer: () => Promise<SaveImportCheck>,
  initial: Partial<Settings> = {},
  deletes: boolean | null = true,
): Fixture {
  const page = buildPage();
  const store = createSettingsStore({ ...DEFAULT_SETTINGS, ...initial });
  const announce = vi.fn();
  const onClose = vi.fn();
  const onExport = vi.fn();
  const onRestart = vi.fn();
  const onDelete = vi.fn(() => Promise.resolve(deletes === true));
  createSettingsScreen(page.host, {
    store,
    announce,
    onClose,
    saveTransfer: {
      onExport,
      onImport: () => answer(),
      onRestart,
      ...(deletes === null ? {} : { onDelete }),
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
    onDelete,
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
    expect(fixture.at('save-clear')?.textContent).toBe('Supprimer ma progression');

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

/**
 * "Delete my progress" (`TN-SAVE-06`, `TN-SAVE-07`, `TN-SAVE-11`, ADR-0026).
 *
 * A second live-site audit found it missing: every save this game writes lives
 * on the device, and the player had no way to clear one. It is the only control
 * in the game that destroys something, so what this file proves is the order —
 * nothing is cleared before the player says yes, "no" and Escape clear nothing —
 * and the two things a staff review caught the first version getting wrong:
 *
 *  - **the words are the story's.** `save.clear` and `save.clear.confirm` are
 *    ratified in `TN-SAVE-save-and-reload.md`; an earlier pass invented a
 *    `save.delete.*` family and declared it unowned, failing three scenarios
 *    while every gate stayed green;
 *  - **a confirmed delete opens the title screen**, per `TN-SAVE-06`, so there
 *    is no dialog after it and no second control to press.
 *
 * And the honesty of the refusal: the port clears two stores and reports one
 * error for either, so "nothing was changed" is a claim this screen cannot make.
 */
describe('"Delete my progress" in Settings', () => {
  it('is a real button, last in the section, marked as the destructive one', () => {
    const { at } = open(refused('unreadable'));
    const control = at('save-clear');

    expect(control?.tagName).toBe('BUTTON');
    /* The ratified row, not a rewording of it. */
    expect(control?.textContent).toBe(text('en', 'save.clear'));
    expect(control?.textContent).toBe('Delete my progress');
    /* A shape and a word, never a colour alone: `screen-styles.ts` draws this
       attribute as the double-edged slab. */
    expect(control?.getAttribute('data-tn-action')).toBe('destructive');

    const section = at('setting-save');
    const buttons = section?.querySelectorAll('button') ?? [];
    expect(buttons.map((node) => node.getAttribute('data-testid'))).toEqual([
      'save-export',
      'save-import',
      'save-clear',
    ]);
  });

  it('is not drawn when the caller cannot clear', () => {
    /* Absent draws no control, the way an absent save section draws none: a
       button that does nothing is worse than a missing one. */
    expect(open(refused('unreadable'), {}, null).at('save-clear')).toBeNull();
  });

  it('asks the question the story wrote, and "Keep my progress" clears nothing', async () => {
    const fixture = open(refused('unreadable'));
    fixture.at('save-clear')?.click();

    const dialog = fixture.at('save-clear-confirm');
    expect(dialog?.hidden).toBe(false);
    expect(dialog?.getAttribute('role')).toBe('alertdialog');
    expect(
      fixture.page.doc.getElementById(dialog?.getAttribute('aria-labelledby') ?? '')?.textContent,
    ).toBe('This cannot be undone. Delete everything?');
    /* The question carries its own cost, so there is no second sentence to
       describe it with — and a dangling `aria-describedby` would be worse. */
    expect(dialog?.getAttribute('aria-describedby')).toBeNull();
    expect(fixture.at('save-clear-yes')?.textContent).toBe('Delete everything');
    expect(fixture.at('save-clear-keep')?.textContent).toBe('Keep my progress');
    expect(fixture.onDelete).not.toHaveBeenCalled();

    fixture.at('save-clear-keep')?.click();
    await settle();
    expect(dialog?.hidden).toBe(true);
    expect(fixture.onDelete).not.toHaveBeenCalled();
    expect(fixture.onRestart).not.toHaveBeenCalled();
  });

  it('treats Escape in the question as "no", and leaves Settings open', async () => {
    const fixture = open(refused('unreadable'));
    fixture.at('save-clear')?.click();

    const dialog = fixture.at('save-clear-confirm') as FakeElement;
    press(dialog, 'Escape');
    await settle();

    expect(dialog.hidden).toBe(true);
    expect(fixture.onDelete).not.toHaveBeenCalled();
    expect(fixture.onClose).not.toHaveBeenCalled();
    expect(fixture.at('settings-screen')?.hidden).toBe(false);
  });

  it('clears on yes and starts the game again, with no dialog in between', async () => {
    const fixture = open(refused('unreadable'));
    fixture.at('save-clear')?.click();
    fixture.at('save-clear-yes')?.click();
    await settle();

    expect(fixture.onDelete).toHaveBeenCalledTimes(1);
    /* `TN-SAVE-06`: "choosing yes clears storage and opens the title screen as
       it is for a first-time player" — the restart is that opening, and a dialog
       congratulating the player on losing something is not in the story. */
    expect(fixture.onRestart).toHaveBeenCalledTimes(1);
    expect(fixture.at('save-clear-error')?.hidden).not.toBe(false);
  });

  it('says only what it knows when the clear did not finish', async () => {
    const fixture = open(refused('unreadable'), {}, false);
    fixture.at('save-clear')?.click();
    fixture.at('save-clear-yes')?.click();
    await settle();

    /* Not "Nothing was changed": the port clears two stores (ADR-0026) and
       reports one error for either, so a clear that emptied one and was refused
       by the other looks exactly like this from here. */
    const sentence = `${text('en', 'save.clear.failed')} ${text('en', 'save.clear.failed.help')}`;
    expect(sentence).not.toContain(text('en', 'save.import.notSaved.help'));
    expect(fixture.onRestart).not.toHaveBeenCalled();
    expect(fixture.at('save-clear-confirm')?.hidden).toBe(true);
    expect(fixture.at('save-clear-error')?.textContent).toBe(sentence);
    /* Its own element and its own control: the import's sentence is untouched. */
    expect(fixture.at('save-clear')?.getAttribute('aria-describedby')).toBe(
      fixture.at('save-clear-error')?.id,
    );
    expect(fixture.at('save-import-error')?.hidden).toBe(true);
    expect(fixture.at('save-import')?.getAttribute('aria-describedby')).toBeNull();
    expect(fixture.announce).toHaveBeenCalledWith(sentence);
    expect(fixture.page.doc.activeElement).toBe(fixture.at('save-clear'));
  });

  it('takes a stale failure away when the next try starts', async () => {
    /* A sentence from a previous attempt must not survive the attempt that
       worked, still wired as the control's description. */
    let answer = false;
    const page = buildPage();
    const store = createSettingsStore(DEFAULT_SETTINGS);
    const onRestart = vi.fn();
    createSettingsScreen(page.host, {
      store,
      onClose: vi.fn(),
      saveTransfer: {
        onExport: vi.fn(),
        onImport: () => refused('unreadable')(),
        onRestart,
        onDelete: () => Promise.resolve(answer),
      },
      now: () => 0,
    }).show();
    const at = (testId: string): FakeElement | null => page.doc.byTestId(testId);

    at('save-clear')?.click();
    at('save-clear-yes')?.click();
    await settle();
    expect(at('save-clear-error')?.hidden).toBe(false);

    answer = true;
    at('save-clear')?.click();
    at('save-clear-yes')?.click();
    await settle();

    expect(at('save-clear-error')?.hidden).toBe(true);
    expect(at('save-clear')?.getAttribute('aria-describedby')).toBeNull();
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('asks in French in French, and follows a language change with the question open', () => {
    const fixture = open(refused('unreadable'), { locale: 'fr' });
    expect(fixture.at('save-clear')?.textContent).toBe('Supprimer ma progression');
    fixture.at('save-clear')?.click();

    const dialog = fixture.at('save-clear-confirm');
    expect(
      fixture.page.doc.getElementById(dialog?.getAttribute('aria-labelledby') ?? '')?.textContent,
      /* `TN-SAVE-11` asserts this sentence by name. */
    ).toBe('Cette action est définitive. Tout supprimer?');
    expect(fixture.at('save-clear-yes')?.textContent).toBe('Tout supprimer');

    fixture.store.set('locale', 'en');
    expect(
      fixture.page.doc.getElementById(dialog?.getAttribute('aria-labelledby') ?? '')?.textContent,
    ).toBe('This cannot be undone. Delete everything?');
    expect(dialog?.getAttribute('lang')).toBe('en');
  });
});

/**
 * `TN-SAVE-12` — "the one control that destroys something" — which arrived with
 * the 2026-09-17 ratification and had no suite of its own.
 *
 * The scenarios already held above are not repeated: the control's words and
 * shape, Escape, the clear-and-restart, and the stale sentence taken away by
 * the next try. What is added is what only this story asks, and all of it is
 * about the delete that **did not finish** — the one screen in the game where a
 * player needs certainty about what was destroyed and cannot be given it,
 * because `clearBoth` (ADR-0026, `OQ-SAVE-9`) reports one error for two stores:
 *
 *  - the sentence claims neither outcome it cannot see;
 *  - it is drawn once, under the control that produced it;
 *  - the player is left on the control that retries, and no "Try again" button
 *    is invented beside it;
 *  - the game is still playable afterwards.
 */
describe('TN-SAVE-12: a delete that does not finish', () => {
  /** The refused sentence, built the way the screen builds it. */
  const refusal = (locale: 'en' | 'fr'): string =>
    `${text(locale, 'save.clear.failed')} ${text(locale, 'save.clear.failed.help')}`;

  /** Ask, answer "Delete everything", and let the refusal land. */
  async function refuseADelete(locale: 'en' | 'fr' = 'en'): Promise<Fixture> {
    const fixture = open(refused('unreadable'), { locale }, false);
    fixture.at('save-clear')?.click();
    fixture.at('save-clear-yes')?.click();
    await settle();
    return fixture;
  }

  it('deletes nothing until the question is answered', async () => {
    const fixture = open(refused('unreadable'));
    fixture.at('save-clear')?.click();

    expect(fixture.at('save-clear-confirm')?.hidden).toBe(false);
    expect(fixture.onDelete).not.toHaveBeenCalled();

    press(fixture.at('save-clear-confirm') as FakeElement, 'Escape');
    await settle();
    expect(fixture.onDelete).not.toHaveBeenCalled();
    expect(fixture.onRestart).not.toHaveBeenCalled();
  });

  it('says only what is known: neither that nothing changed nor that everything went', async () => {
    const fixture = await refuseADelete();
    const sentence = fixture.at('save-clear-error')?.textContent ?? '';

    expect(sentence).toBe(refusal('en'));
    /* The two claims the screen cannot make. "Nothing was changed" is the
       import's row, and it would be a lie in exactly the case where a stale
       copy comes back on the next boot; the other direction is the refusal
       pretending to be the success. */
    expect(sentence).not.toContain(text('en', 'save.import.notSaved.help'));
    expect(sentence.toLowerCase()).not.toContain('nothing was changed');
    expect(sentence.toLowerCase()).not.toContain('everything was deleted');
    /* "may still be", never "is" and never "is not". */
    expect(sentence).toContain('may still be');
  });

  it('draws the sentence once, and nowhere but under its own control', async () => {
    const fixture = await refuseADelete();
    const sentence = refusal('en');

    const copies = fixture.page.doc
      .querySelectorAll('p')
      .filter((node) => node.textContent === sentence);
    expect(copies.map((node) => node.getAttribute('data-testid'))).toEqual(['save-clear-error']);
    expect(fixture.at('save-clear')?.getAttribute('aria-describedby')).toBe(
      fixture.at('save-clear-error')?.id,
    );
    /* Never the other control's description (`TN-SAVE-09`). */
    expect(fixture.at('save-import')?.getAttribute('aria-describedby')).toBeNull();
    /* And not a second announcer: it is said through the live region only. */
    expect(fixture.at('save-clear-error')?.getAttribute('aria-live')).toBeNull();
  });

  it('leaves the player on the control that retries, and invents no "Try again" beside it', async () => {
    const fixture = await refuseADelete();

    /* `TN-SAVE-07`: "focus is on save-clear … and no control named Try again is
       on the screen". The sentence says to try again *where* it can be done, so
       a second control would be a button the story does not have. */
    expect(fixture.page.doc.activeElement).toBe(fixture.at('save-clear'));
    const labels = fixture.page.doc
      .querySelectorAll('button')
      .map((node) => node.textContent);
    expect(labels).not.toContain(text('en', 'study.error.retry'));
    expect(labels).not.toContain('Try again');

    /* And asking again really does ask again, from that control. */
    fixture.at('save-clear')?.click();
    expect(fixture.at('save-clear-confirm')?.hidden).toBe(false);
  });

  it('leaves the game playable, with nothing counting down', async () => {
    const fixture = await refuseADelete();

    expect(fixture.at('settings-screen')?.hidden).toBe(false);
    expect(fixture.onRestart).not.toHaveBeenCalled();
    fixture.at('settings-close')?.click();
    expect(fixture.onClose).toHaveBeenCalledTimes(1);
  });

  it('says it in French as a portion of the progress, never as a saved game', async () => {
    /*
     * `TN-SAVE-11`, and the row the story **amended** at ratification. In this
     * game's French « partie » is a saved game — « votre partie sauvegardée »,
     * « Votre partie est restaurée » — so « Une partie est peut-être encore sur
     * cet appareil » read as *a saved game may still be here*, which is a
     * different claim from "some of it may still be". Pinned literally on both
     * sides, because the whole defect is one reading of one word.
     */
    const fixture = await refuseADelete('fr');
    const sentence = fixture.at('save-clear-error')?.textContent ?? '';

    expect(sentence).toBe(refusal('fr'));
    expect(sentence).toContain('Une partie de votre progression est peut-être encore');
    expect(sentence, 'the French reads as a saved game left behind').not.toContain(
      'Une partie est peut-être',
    );
    expect(sentence).not.toContain("Rien n'a été modifié");
    expect(fixture.announce).toHaveBeenCalledWith(refusal('fr'));
  });
});

/**
 * `TN-SAVE-08`: "the highlight starts on 'Keep my progress'".
 *
 * The answers are drawn destructive-first, because `TN-SAVE-06` prints them in
 * that order, and `createScreen` opens the switch ring on the first item. Those
 * two correct rules meet on this dialog as: a single-switch player's very first
 * press, if it runs a fraction past the hold threshold, deletes everything they
 * have. `app/ui/confirm.ts` therefore opens the highlight on the safe answer.
 */
describe('TN-SAVE-08: the delete question with one switch', () => {
  interface SwitchFixture {
    readonly page: FakePage;
    readonly clock: { now: number };
    readonly onDelete: ReturnType<typeof vi.fn>;
    at(testId: string): FakeElement | null;
  }

  function openWithASwitch(): SwitchFixture {
    const page = buildPage();
    const clock = { now: 0 };
    const onDelete = vi.fn(() => Promise.resolve(true));
    createSettingsScreen(page.host, {
      store: createSettingsStore({ ...DEFAULT_SETTINGS, singleSwitch: true }),
      onClose: vi.fn(),
      saveTransfer: {
        onExport: vi.fn(),
        onImport: () => refused('unreadable')(),
        onRestart: vi.fn(),
        onDelete,
      },
      now: () => clock.now,
    }).show();

    return { page, clock, onDelete, at: (testId) => page.doc.byTestId(testId) };
  }

  it('opens the highlight on "Keep my progress", not on "Delete everything"', () => {
    const fixture = openWithASwitch();
    fixture.at('save-clear')?.click();

    expect(fixture.at('save-clear-confirm')?.hidden).toBe(false);
    expect(fixture.at('save-clear-keep')?.getAttribute(HIGHLIGHT_ATTRIBUTE)).toBe('true');
    expect(
      fixture.at('save-clear-yes')?.getAttribute(HIGHLIGHT_ATTRIBUTE),
      'the switch opened on the answer that deletes everything',
    ).toBeNull();
  });

  it('takes the safe answer when the first press is a long one, and clears nothing', async () => {
    const fixture = openWithASwitch();
    fixture.at('save-clear')?.click();

    /* One long press, the first gesture the player makes in this dialog. */
    pressSwitch(fixture.page, fixture.clock, 800);
    await settle();

    expect(fixture.onDelete, 'a single long press deleted the save').not.toHaveBeenCalled();
    expect(fixture.at('save-clear-confirm')?.hidden).toBe(true);
  });

  it('still reaches "Delete everything" with a short press first', async () => {
    const fixture = openWithASwitch();
    fixture.at('save-clear')?.click();

    /* The destructive answer is reachable, it is simply not where the ring
       opens: one short press moves off the safe answer, and the ring wraps. */
    pressSwitch(fixture.page, fixture.clock, 100);
    expect(fixture.at('save-clear-yes')?.getAttribute(HIGHLIGHT_ATTRIBUTE)).toBe('true');

    pressSwitch(fixture.page, fixture.clock, 800);
    await settle();
    expect(fixture.onDelete).toHaveBeenCalledTimes(1);
  });
});
