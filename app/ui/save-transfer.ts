/**
 * "Your progress" in Settings: save the game to a file, open one, and delete
 * what is on this device (`TN-SAVE-06`, ADR-0046).
 *
 * Four pieces in one file, because they are one errand:
 *
 *  - **the section**: a heading, a reading line, "Save to a file", "Open a file"
 *    and "Delete my progress". All three are real buttons. The file input is
 *    hidden and out of the Tab order, because a native file input draws its own
 *    words in the browser's language, which is English on a French page and
 *    cannot be restyled to 44 px in every engine; the button opens it instead,
 *    and a keyboard, a pointer and one switch all reach the button;
 *  - **the confirmation** before a file replaces the save: `createConfirm`, the
 *    alertdialog the exam already asks with, so Escape means "no" and focus goes
 *    back to "Open a file";
 *  - **the second confirmation**, before progress is deleted. The same dialog,
 *    for the same reason and with the same escape: this is the only control in
 *    the game that destroys something a player cannot get back, so it says what
 *    it costs and what to do first, and its safe answer keeps the game;
 *  - **the dialog after** either: the store now holds something else, and one
 *    control starts the game again from it. It cannot be escaped, for the reason
 *    the level error card cannot: dismissing it would leave the old game on
 *    screen over a store that no longer holds it.
 *
 * A refused file opens no dialog. It draws a sentence under the buttons — what
 * happened, then what to do next — becomes the description of the control that
 * produced it, and is said once through the live region. A delete the store
 * refused is told the same way.
 *
 * What this file never does is read, check, write or erase a save. It hands the
 * chosen file to `onImport` and is told `ready` or `refused`, and it asks
 * `onDelete` and is told whether anything went; the codec, the ports and the use
 * cases behind the composition root decide, and this screen only says so.
 *
 * DOM only (ADR-0005).
 */

import { createConfirm, type Confirm } from './confirm';
import { text, type CopyKey, type UiLocale } from './copy';
import { button, element } from './dom';
import { createScreen, type Screen } from './screen';

/** What reading a chosen file needs. A browser `File` is one. */
export interface SaveFileLike {
  readonly size: number;
  text(): Promise<string>;
}

/** Why a file was refused, in the three ways a player is told about it. */
export type SaveImportRefusal = 'tooBig' | 'unreadable' | 'newer';

export type SaveImportCheck =
  | {
      readonly kind: 'ready';
      /**
       * Replace the save with the file: `true` once it is written, `false` when
       * the store refused and nothing changed. Called only after the player says
       * yes.
       */
      readonly replace: () => Promise<boolean>;
    }
  | { readonly kind: 'refused'; readonly reason: SaveImportRefusal };

export interface SaveTransferOptions {
  /** "Save to a file". The caller writes the save and hands the browser the file. */
  readonly onExport: () => void;
  /** A file was chosen. Must write nothing: the confirmation has not been asked yet. */
  readonly onImport: (file: SaveFileLike) => Promise<SaveImportCheck>;
  /** "Continue", after a replacement or a delete: start the game again from the store. */
  readonly onRestart: () => void;
  /**
   * "Delete my progress": wipe every store this device keeps the save in
   * (ADR-0026), and answer `true` once it is gone, `false` when the store
   * refused and nothing changed.
   *
   * **Absent draws no control**, the way an absent `saveTransfer` draws no
   * section: a caller that cannot delete has nothing to offer, and a button that
   * does nothing is worse than none. Called only after the player has said yes
   * to the confirmation this section asks.
   */
  readonly onDelete?: () => Promise<boolean>;
}

export interface SaveSectionOptions {
  readonly transfer: SaveTransferOptions;
  /** Where the dialogs mount: the element Settings itself is mounted in. */
  readonly host: HTMLElement;
  readonly locale: () => UiLocale;
  /** Read each time a dialog opens, so a hold time changed in Settings applies. */
  readonly singleSwitch: () => { readonly enabled: boolean; readonly holdMs: number };
  /** The one live region. */
  readonly announce?: (message: string) => void;
  /** Settings stops answering Escape and its switch ring while a dialog is over it. */
  readonly cover: (covered: boolean) => void;
  readonly now?: () => number;
}

export interface SaveSection {
  readonly element: HTMLElement;
  refresh(locale: UiLocale): void;
  destroy(): void;
}

/** What the sentence under the buttons reports: a refusal, or a store that refused. */
type Outcome = SaveImportRefusal | 'notSaved' | 'notDeleted';

/** What happened, then what to do next. */
const SENTENCES: Readonly<Record<Outcome, readonly [CopyKey, CopyKey]>> = {
  tooBig: ['save.import.tooBig', 'save.import.error.help'],
  unreadable: ['save.import.error', 'save.import.error.help'],
  newer: ['save.newer.title', 'save.import.newer.help'],
  notSaved: ['storage.warning', 'save.import.notSaved.help'],
  /* Nothing was deleted, so nothing was lost: the sentence says what happened
     and then that the game is exactly as it was. */
  notDeleted: ['save.delete.failed', 'save.import.notSaved.help'],
};

const sentenceFor = (locale: UiLocale, outcome: Outcome): string => {
  const [what, next] = SENTENCES[outcome];
  return `${text(locale, what)} ${text(locale, next)}`;
};

/** The dialog after the store changed: what happened, and the way back in. */
interface DoneDialog {
  show(): void;
  setLocale(locale: UiLocale): void;
  destroy(): void;
}

/** The ids, test ids and rows one of those dialogs is built from. */
interface DoneSpec {
  readonly id: string;
  readonly testId: string;
  readonly titleKey: CopyKey;
  readonly bodyKey: CopyKey;
  readonly continueTestId: string;
}

export function createSaveSection(doc: Document, options: SaveSectionOptions): SaveSection {
  let busy = false;
  let shown: Outcome | null = null;
  /** Which control the sentence under the buttons belongs to while it is drawn. */
  let shownOn: HTMLElement | null = null;
  let pending: (() => Promise<boolean>) | null = null;
  let confirm: Confirm | null = null;
  let done: DoneDialog | null = null;
  let deleteConfirm: Confirm | null = null;
  let deleteDone: DoneDialog | null = null;

  const say = (message: string): void => {
    options.announce?.(message);
  };

  const legend = element(doc, 'span', {
    id: 'tn-settings-save-legend',
    className: 'tn-screen__legend',
  });
  const help = element(doc, 'p', { id: 'tn-settings-save-help', className: 'tn-screen__help' });
  const exportButton = button(doc, {
    testId: 'save-export',
    onClick: () => {
      options.transfer.onExport();
    },
  });
  const importButton = button(doc, {
    testId: 'save-import',
    onClick: () => {
      choose();
    },
  });
  /*
   * Last in the section, and drawn only when the caller can really delete
   * (ADR-0026: IndexedDB and the `localStorage` a save was carried out of).
   *
   * `destructive` is a shape and a word, never a colour: the slab keeps the
   * quiet fill and takes a heavier double edge, and the label says what it
   * deletes. Red belongs to the one control that carries a player *forward*, and
   * a destructive control that looks like the primary one is the control
   * somebody presses out of habit.
   */
  const deleteButton =
    options.transfer.onDelete === undefined
      ? null
      : button(doc, {
          testId: 'save-delete',
          attrs: { 'data-tn-action': 'destructive' },
          onClick: () => {
            askDelete();
          },
        });
  const input = element(doc, 'input', {
    testId: 'save-import-file',
    attrs: { type: 'file', accept: '.json,application/json', tabindex: '-1' },
  });
  input.hidden = true;
  const message = element(doc, 'p', {
    id: 'tn-settings-save-message',
    testId: 'save-import-error',
    className: 'tn-screen__help',
  });
  message.hidden = true;

  const group = element(doc, 'div', {
    className: 'tn-screen__group',
    testId: 'setting-save',
    attrs: {
      role: 'group',
      'aria-labelledby': legend.id,
      'aria-describedby': help.id,
    },
    children: [
      legend,
      help,
      exportButton,
      importButton,
      ...(deleteButton === null ? [] : [deleteButton]),
      input,
      message,
    ],
  });

  input.addEventListener('change', () => {
    void chosen();
  });

  refresh(options.locale());

  return { element: group, refresh, destroy };

  function choose(): void {
    if (busy) return;
    /* Emptied first, so choosing the same file a second time is still a change. */
    input.value = '';
    input.click();
  }

  async function chosen(): Promise<void> {
    const file = input.files?.item(0) ?? null;
    if (file === null || busy) return;
    busy = true;
    show(null);

    let check: SaveImportCheck;
    try {
      check = await options.transfer.onImport(file);
    } catch {
      check = { kind: 'refused', reason: 'unreadable' };
    }
    busy = false;

    if (check.kind === 'refused') {
      show(check.reason, importButton);
      return;
    }
    pending = check.replace;
    ask();
  }

  /** The sentence under the buttons, or none. Said once when it appears. */
  function show(outcome: Outcome | null, control: HTMLElement = importButton): void {
    shown = outcome;
    if (outcome === null) {
      message.hidden = true;
      message.textContent = '';
      shownOn?.removeAttribute('aria-describedby');
      shownOn = null;
      return;
    }
    const sentence = sentenceFor(options.locale(), outcome);
    message.textContent = sentence;
    message.hidden = false;
    /* The sentence belongs to the control that produced it, so a screen reader
       coming back to it hears why the last thing they tried did not happen. */
    shownOn?.removeAttribute('aria-describedby');
    shownOn = control;
    control.setAttribute('aria-describedby', message.id);
    say(sentence);
  }

  function ask(): void {
    const { enabled, holdMs } = options.singleSwitch();
    confirm ??= createConfirm(options.host, {
      id: 'tn-save-import-confirm',
      testId: 'save-import-confirm',
      locale: options.locale(),
      describe: (which) => ({
        title: text(which, 'save.import.confirm'),
        body: text(which, 'save.import.confirm.body'),
      }),
      confirmKey: 'save.import.replace',
      confirmTestId: 'save-import-replace',
      cancelKey: 'save.import.keep',
      cancelTestId: 'save-import-keep',
      announce: (spoken: string) => {
        say(spoken);
      },
      onConfirm: () => {
        void replace();
      },
      onCancel: () => {
        pending = null;
        options.cover(false);
      },
      singleSwitch: enabled,
      holdMs,
      ...(options.now === undefined ? {} : { now: options.now }),
    });
    confirm.setLocale(options.locale());
    confirm.setSingleSwitch(enabled, holdMs);
    options.cover(true);
    confirm.open();
  }

  async function replace(): Promise<void> {
    const commit = pending;
    pending = null;
    let replaced = false;
    if (commit !== null) {
      try {
        replaced = await commit();
      } catch {
        replaced = false;
      }
    }
    if (!replaced) {
      /* Nothing changed, and the player is told so under the control they used. */
      options.cover(false);
      show('notSaved', importButton);
      importButton.focus();
      return;
    }
    done ??= doneDialog({
      id: 'tn-save-import-done',
      testId: 'save-import-done',
      titleKey: 'save.import.done',
      bodyKey: 'save.import.done.help',
      continueTestId: 'save-import-continue',
    });
    done.show();
  }

  /**
   * "Delete your progress on this device?" — asked before anything is deleted,
   * and answered "no" by Escape, by the quiet control, and by any other way of
   * closing the dialog.
   *
   * The question is the dialog's name and the cost is its description, which is
   * what `createConfirm` exists for: a screen reader says what is about to
   * happen rather than the word "dialog".
   */
  function askDelete(): void {
    if (busy || options.transfer.onDelete === undefined) return;
    const { enabled, holdMs } = options.singleSwitch();
    deleteConfirm ??= createConfirm(options.host, {
      id: 'tn-save-delete-confirm',
      testId: 'save-delete-confirm',
      locale: options.locale(),
      describe: (which) => ({
        title: text(which, 'save.delete.confirm'),
        body: text(which, 'save.delete.confirm.body'),
      }),
      confirmKey: 'save.delete.yes',
      confirmTestId: 'save-delete-yes',
      cancelKey: 'save.delete.keep',
      cancelTestId: 'save-delete-keep',
      announce: (spoken: string) => {
        say(spoken);
      },
      onConfirm: () => {
        void erase();
      },
      onCancel: () => {
        options.cover(false);
      },
      singleSwitch: enabled,
      holdMs,
      ...(options.now === undefined ? {} : { now: options.now }),
    });
    deleteConfirm.setLocale(options.locale());
    deleteConfirm.setSingleSwitch(enabled, holdMs);
    options.cover(true);
    deleteConfirm.open();
  }

  async function erase(): Promise<void> {
    const wipe = options.transfer.onDelete;
    if (wipe === undefined) return;
    busy = true;
    let deleted = false;
    try {
      deleted = await wipe();
    } catch {
      /* A store that threw deleted nothing, which is the same answer as a store
         that refused: `deleted` is already false, the player is told, and the
         game is exactly as it was. */
    }
    busy = false;

    if (!deleted) {
      /* The game is exactly as it was, said under the control the player used. */
      options.cover(false);
      show('notDeleted', deleteButton ?? importButton);
      (deleteButton ?? importButton).focus();
      return;
    }
    deleteDone ??= doneDialog({
      id: 'tn-save-delete-done',
      testId: 'save-delete-done',
      titleKey: 'save.delete.done',
      bodyKey: 'save.delete.done.help',
      continueTestId: 'save-delete-continue',
    });
    deleteDone.show();
  }

  function doneDialog(spec: DoneSpec): DoneDialog {
    const { enabled, holdMs } = options.singleSwitch();
    const screen: Screen = createScreen(options.host, {
      id: spec.id,
      testId: spec.testId,
      locale: options.locale(),
      role: 'alertdialog',
      announce: (spoken: string) => {
        say(spoken);
      },
      switch: {
        enabled,
        holdMs,
        ...(options.now === undefined ? {} : { now: options.now }),
      },
    });
    const title = element(doc, 'h2', { id: `${spec.id}-title` });
    const body = element(doc, 'p', {
      id: `${spec.id}-body`,
      className: 'tn-screen__help',
    });
    const restart = button(doc, {
      testId: spec.continueTestId,
      attrs: { 'data-tn-action': 'primary' },
      onClick: () => {
        options.transfer.onRestart();
      },
    });
    screen.card.append(
      title,
      body,
      element(doc, 'div', { className: 'tn-screen__actions', children: [restart] }),
    );
    screen.labelledBy(title);
    screen.describedBy(body);

    const paint = (which: UiLocale): void => {
      screen.setLocale(which);
      title.textContent = text(which, spec.titleKey);
      body.textContent = text(which, spec.bodyKey);
      restart.textContent = text(which, 'save.import.continue');
    };

    return {
      show(): void {
        const which = options.locale();
        paint(which);
        screen.show();
        screen.refreshSwitch();
        say(`${text(which, spec.titleKey)} ${text(which, spec.bodyKey)}`);
      },
      setLocale: paint,
      destroy(): void {
        screen.destroy();
      },
    };
  }

  function refresh(locale: UiLocale): void {
    legend.textContent = text(locale, 'save.section');
    help.textContent = text(locale, 'save.section.help');
    exportButton.textContent = text(locale, 'save.export');
    importButton.textContent = text(locale, 'save.import');
    if (deleteButton !== null) deleteButton.textContent = text(locale, 'save.delete');
    if (shown !== null) message.textContent = sentenceFor(locale, shown);
    confirm?.setLocale(locale);
    done?.setLocale(locale);
    deleteConfirm?.setLocale(locale);
    deleteDone?.setLocale(locale);
  }

  function destroy(): void {
    confirm?.destroy();
    confirm = null;
    done?.destroy();
    done = null;
    deleteConfirm?.destroy();
    deleteConfirm = null;
    deleteDone?.destroy();
    deleteDone = null;
  }
}
