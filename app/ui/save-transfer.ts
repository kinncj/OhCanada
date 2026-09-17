/**
 * "Your progress" in Settings: save the game to a file, open one, and delete
 * what is on this device (`TN-SAVE-06`, `TN-SAVE-07`, `TN-SAVE-11`, ADR-0046).
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
 *  - **the second confirmation**, before progress is deleted. `TN-SAVE-06` fixes
 *    its words — "This cannot be undone. Delete everything?" — and they carry
 *    the cost inside the question, so the dialog is named by it and needs no
 *    separate description;
 *  - **the dialog after an import**: the game is back, and one control starts it
 *    again from the file. It cannot be escaped, for the reason the level error
 *    card cannot: dismissing it would leave the old game on screen over a store
 *    that no longer holds it.
 *
 * **A confirmed delete has no dialog after it.** `TN-SAVE-06` says what happens:
 * "choosing yes clears storage and opens the title screen as it is for a
 * first-time player". So the screen asks, clears, and restarts — the same
 * restart an import uses, into a store that is now empty, which is what a first
 * run *is*. A dialog in between would be a screen congratulating the player on
 * losing something.
 *
 * A refused file opens no dialog. It draws a sentence under the buttons — what
 * happened, then what to do next — becomes the description of the control that
 * produced it, and is said once through the live region. A delete that did not
 * finish is told the same way, under its own control and in its own element, so
 * neither sentence can be read as being about the other.
 *
 * What this file never does is read, check, write or erase a save. It hands the
 * chosen file to `onImport` and is told `ready` or `refused`, and it asks
 * `onDelete` and is told whether the delete finished; the codec, the ports and
 * the use cases behind the composition root decide, and this screen only says
 * so.
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
  /** "Continue" after an import, and the restart a confirmed delete ends in. */
  readonly onRestart: () => void;
  /**
   * "Delete my progress": clear every store this device keeps the save in
   * (ADR-0026).
   *
   * `true` once the delete **finished**. `false` means it did not, and
   * deliberately not "nothing changed": the port clears two stores and reports
   * one error for either, so a clear that emptied one and was refused by the
   * other arrives here as `false` too. The sentence this screen draws says only
   * that much (`save.clear.failed`).
   *
   * **Absent draws no control**, the way an absent `saveTransfer` draws no
   * section: a caller that cannot delete has nothing to offer, and a button that
   * does nothing is worse than none. Called only after the player has said yes.
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

/** What a sentence under a control reports. */
type Outcome = SaveImportRefusal | 'notSaved' | 'notCleared';

/** What happened, then what to do next. */
const SENTENCES: Readonly<Record<Outcome, readonly [CopyKey, CopyKey]>> = {
  tooBig: ['save.import.tooBig', 'save.import.error.help'],
  unreadable: ['save.import.error', 'save.import.error.help'],
  newer: ['save.newer.title', 'save.import.newer.help'],
  notSaved: ['storage.warning', 'save.import.notSaved.help'],
  /* Never "Nothing was changed": a clear that half-landed is reported the same
     way as one that did nothing, so this says only what is known. */
  notCleared: ['save.clear.failed', 'save.clear.failed.help'],
};

const sentenceFor = (locale: UiLocale, outcome: Outcome): string => {
  const [what, next] = SENTENCES[outcome];
  return `${text(locale, what)} ${text(locale, next)}`;
};

/**
 * A sentence under one control: drawn, described and said once.
 *
 * One per control rather than one shared, because the two failures are about
 * different things and a screen reader coming back to a control must hear why
 * *that* control's last try failed — not why the other one did.
 */
interface Sentence {
  readonly element: HTMLElement;
  show(outcome: Outcome | null): void;
  refresh(locale: UiLocale): void;
}

/** The dialog after an import: what happened, and the way back in. */
interface DoneDialog {
  show(): void;
  setLocale(locale: UiLocale): void;
  destroy(): void;
}

export function createSaveSection(doc: Document, options: SaveSectionOptions): SaveSection {
  let busy = false;
  let pending: (() => Promise<boolean>) | null = null;
  let confirm: Confirm | null = null;
  let done: DoneDialog | null = null;
  let clearConfirm: Confirm | null = null;

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
   * Last in the section, and drawn only when the caller can really clear
   * (ADR-0026: IndexedDB and the `localStorage` a save was carried out of).
   *
   * `destructive` is a shape and a word, never a colour: the slab keeps the
   * quiet fill and takes a heavier double edge, and the label says what it
   * deletes. Red belongs to the one control that carries a player *forward*, and
   * a destructive control that looks like the primary one is the control
   * somebody presses out of habit.
   */
  const clearButton =
    options.transfer.onDelete === undefined
      ? null
      : button(doc, {
          testId: 'save-clear',
          attrs: { 'data-tn-action': 'destructive' },
          onClick: () => {
            askToClear();
          },
        });
  const input = element(doc, 'input', {
    testId: 'save-import-file',
    attrs: { type: 'file', accept: '.json,application/json', tabindex: '-1' },
  });
  input.hidden = true;

  const importSentence = sentenceUnder('tn-settings-save-message', 'save-import-error', importButton);
  const clearSentence =
    clearButton === null
      ? null
      : sentenceUnder('tn-settings-clear-message', 'save-clear-error', clearButton);

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
      input,
      importSentence.element,
      ...(clearButton === null ? [] : [clearButton]),
      ...(clearSentence === null ? [] : [clearSentence.element]),
    ],
  });

  input.addEventListener('change', () => {
    void chosen();
  });

  refresh(options.locale());

  return { element: group, refresh, destroy };

  /** One control's sentence: hidden until there is something to say. */
  function sentenceUnder(id: string, testId: string, control: HTMLElement): Sentence {
    let shown: Outcome | null = null;
    const line = element(doc, 'p', { id, testId, className: 'tn-screen__help' });
    line.hidden = true;

    return {
      element: line,
      show(outcome): void {
        shown = outcome;
        if (outcome === null) {
          line.hidden = true;
          line.textContent = '';
          control.removeAttribute('aria-describedby');
          return;
        }
        const sentence = sentenceFor(options.locale(), outcome);
        line.textContent = sentence;
        line.hidden = false;
        control.setAttribute('aria-describedby', id);
        say(sentence);
      },
      refresh(locale): void {
        if (shown !== null) line.textContent = sentenceFor(locale, shown);
      },
    };
  }

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
    importSentence.show(null);

    let check: SaveImportCheck;
    try {
      check = await options.transfer.onImport(file);
    } catch {
      check = { kind: 'refused', reason: 'unreadable' };
    }
    busy = false;

    if (check.kind === 'refused') {
      importSentence.show(check.reason);
      return;
    }
    pending = check.replace;
    ask();
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
      importSentence.show('notSaved');
      importButton.focus();
      return;
    }
    done ??= doneDialog();
    done.show();
  }

  /**
   * "This cannot be undone. Delete everything?" — asked before anything is
   * cleared, and answered "no" by Escape, by the quiet control, and by any other
   * way of closing the dialog (`TN-SAVE-06`).
   *
   * The question is the dialog's accessible name and carries its own cost, which
   * is why it takes no separate description: `TN-SAVE` wrote one sentence, and a
   * second one invented here would be this screen speaking over the story.
   */
  function askToClear(): void {
    if (busy || options.transfer.onDelete === undefined) return;
    const { enabled, holdMs } = options.singleSwitch();
    clearConfirm ??= createConfirm(options.host, {
      id: 'tn-save-clear-confirm',
      testId: 'save-clear-confirm',
      locale: options.locale(),
      describe: (which) => ({ title: text(which, 'save.clear.confirm') }),
      confirmKey: 'save.clear.yes',
      confirmTestId: 'save-clear-yes',
      cancelKey: 'save.clear.keep',
      cancelTestId: 'save-clear-keep',
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
    clearConfirm.setLocale(options.locale());
    clearConfirm.setSingleSwitch(enabled, holdMs);
    options.cover(true);
    clearConfirm.open();
  }

  /**
   * Clear, then start the game again.
   *
   * `TN-SAVE-06`: "choosing yes clears storage and opens the title screen as it
   * is for a first-time player". The restart is the import's restart, into a
   * store that is now empty — which is what a first run is — so there is no
   * dialog in between.
   */
  async function erase(): Promise<void> {
    const wipe = options.transfer.onDelete;
    if (wipe === undefined) return;
    /* A sentence from a previous try goes before this one starts, so a retry
       that works cannot leave "we could not" under the control that just did. */
    clearSentence?.show(null);
    busy = true;
    let cleared = false;
    try {
      cleared = await wipe();
    } catch {
      /* A store that threw did not finish: `cleared` is already false. */
    }
    busy = false;

    if (!cleared) {
      options.cover(false);
      clearSentence?.show('notCleared');
      clearButton?.focus();
      return;
    }
    /* Settings is about to be rebuilt by the restart; give the page back first
       so nothing is left covered if the caller restarts in place. */
    options.cover(false);
    options.transfer.onRestart();
  }

  function doneDialog(): DoneDialog {
    const { enabled, holdMs } = options.singleSwitch();
    const screen: Screen = createScreen(options.host, {
      id: 'tn-save-import-done',
      testId: 'save-import-done',
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
    const title = element(doc, 'h2', { id: 'tn-save-import-done-title' });
    const body = element(doc, 'p', {
      id: 'tn-save-import-done-body',
      className: 'tn-screen__help',
    });
    const restart = button(doc, {
      testId: 'save-import-continue',
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
      title.textContent = text(which, 'save.import.done');
      body.textContent = text(which, 'save.import.done.help');
      restart.textContent = text(which, 'save.import.continue');
    };

    return {
      show(): void {
        const which = options.locale();
        paint(which);
        screen.show();
        screen.refreshSwitch();
        say(`${text(which, 'save.import.done')} ${text(which, 'save.import.done.help')}`);
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
    if (clearButton !== null) clearButton.textContent = text(locale, 'save.clear');
    importSentence.refresh(locale);
    clearSentence?.refresh(locale);
    confirm?.setLocale(locale);
    done?.setLocale(locale);
    clearConfirm?.setLocale(locale);
  }

  function destroy(): void {
    confirm?.destroy();
    confirm = null;
    done?.destroy();
    done = null;
    clearConfirm?.destroy();
    clearConfirm = null;
  }
}
