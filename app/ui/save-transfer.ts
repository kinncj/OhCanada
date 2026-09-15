/**
 * "Your progress" in Settings: save the game to a file, and open one
 * (`TN-SAVE-06`, ADR-0046).
 *
 * Three pieces in one file, because they are one errand:
 *
 *  - **the section**: a heading, a reading line, "Save to a file" and "Open a
 *    file". Both are real buttons. The file input is hidden and out of the Tab
 *    order, because a native file input draws its own words in the browser's
 *    language, which is English on a French page and cannot be restyled to 44 px
 *    in every engine; the button opens it instead, and a keyboard, a pointer and
 *    one switch all reach the button;
 *  - **the confirmation** before a file replaces the save: `createConfirm`, the
 *    alertdialog the exam already asks with, so Escape means "no" and focus goes
 *    back to "Open a file";
 *  - **the dialog after**: the game is back, and one control starts it again
 *    from the file. It cannot be escaped, for the reason the level error card
 *    cannot: dismissing it would leave the old game on screen over a store that
 *    no longer holds it.
 *
 * A refused file opens no dialog. It draws a sentence under the buttons — what
 * happened, then what to do next — becomes the description of "Open a file",
 * and is said once through the live region.
 *
 * What this file never does is read, check or write a save. It hands the chosen
 * file to `onImport` and is told `ready` or `refused`; the codec and the use
 * cases behind the composition root decide which, and this screen only says so.
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
  /** "Continue", after a replacement: start the game again from the store. */
  readonly onRestart: () => void;
}

export interface SaveSectionOptions {
  readonly transfer: SaveTransferOptions;
  /** Where the two dialogs mount: the element Settings itself is mounted in. */
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

/** What the sentence under the buttons reports: a refusal, or a write the store refused. */
type Outcome = SaveImportRefusal | 'notSaved';

/** What happened, then what to do next. */
const SENTENCES: Readonly<Record<Outcome, readonly [CopyKey, CopyKey]>> = {
  tooBig: ['save.import.tooBig', 'save.import.error.help'],
  unreadable: ['save.import.error', 'save.import.error.help'],
  newer: ['save.newer.title', 'save.import.newer.help'],
  notSaved: ['storage.warning', 'save.import.notSaved.help'],
};

const sentenceFor = (locale: UiLocale, outcome: Outcome): string => {
  const [what, next] = SENTENCES[outcome];
  return `${text(locale, what)} ${text(locale, next)}`;
};

interface DoneDialog {
  show(): void;
  setLocale(locale: UiLocale): void;
  destroy(): void;
}

export function createSaveSection(doc: Document, options: SaveSectionOptions): SaveSection {
  let busy = false;
  let shown: Outcome | null = null;
  let pending: (() => Promise<boolean>) | null = null;
  let confirm: Confirm | null = null;
  let done: DoneDialog | null = null;

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
    children: [legend, help, exportButton, importButton, input, message],
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
      show(check.reason);
      return;
    }
    pending = check.replace;
    ask();
  }

  /** The sentence under the buttons, or none. Said once when it appears. */
  function show(outcome: Outcome | null): void {
    shown = outcome;
    if (outcome === null) {
      message.hidden = true;
      message.textContent = '';
      importButton.removeAttribute('aria-describedby');
      return;
    }
    const sentence = sentenceFor(options.locale(), outcome);
    message.textContent = sentence;
    message.hidden = false;
    /* The sentence belongs to the control that produced it, so a screen reader
       coming back to "Open a file" hears why the last file did not open. */
    importButton.setAttribute('aria-describedby', message.id);
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
      show('notSaved');
      importButton.focus();
      return;
    }
    done ??= doneDialog();
    done.show();
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
    if (shown !== null) message.textContent = sentenceFor(locale, shown);
    confirm?.setLocale(locale);
    done?.setLocale(locale);
  }

  function destroy(): void {
    confirm?.destroy();
    confirm = null;
    done?.destroy();
    done = null;
  }
}
