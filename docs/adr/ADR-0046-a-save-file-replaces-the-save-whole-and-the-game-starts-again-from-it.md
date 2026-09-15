# ADR-0046: A save file replaces the save whole, and the game starts again from it

- Status: Accepted (2026-09-15)
- Builds on: ADR-0026 (progress lives in IndexedDB; export and import as a file), ADR-0024 (an empty
  collection must not reduce to a pass), ADR-0005 (layers)

## Context

CLAUDE.md's Storage row says "JSON export/import", and ADR-0026 says a save file is the same bytes the
browser's store holds. `TN-SAVE-06` specifies the feature: "Save to a file" and "Open a file" in Settings, a
confirmation before a file replaces progress, "We could not read that file." for a file that is not a save,
"That file is too big." for one over the cap, and "Your game is back." after.

The second live-site audit found none of it on screen (`ck10-settings-bottom`): Settings ended at Text size
and Close. The pieces underneath had existed since slice 1 and nothing had ever called them from Settings:

- `exportProgress` and `importProgress` in `app/application/use-cases/save-progress.ts`;
- the JSON codec, which caps the size before parsing, never evaluates, gates the version, migrates and
  validates the whole schema;
- a download written in `app/bootstrap/main.ts` for the storage warning's "Save to a file".

Two things were undecided, and each decides whether a player can lose a game.

1. **How an import is applied.** The game in memory is read by far more than the save: the settings
   store, the title's Play / Continue, the map's unlocked levels, the passport, the creator's initial
   selection, the renderer's player appearance, the Study session, an open level. Patching each one in
   place is a list someone must keep complete forever, and a missed entry is a screen showing half of the
   old game over the new save, with the next `persist()` writing that half back over the file.
2. **What happens between the yes and the write.** `persist()` writes the whole game in memory. Any write
   that lands after the file's write puts the old game back.

## Decision

### The flow

1. **Read**, write nothing. `readSaveFile` refuses a file over `save.maxImportBytes` **before reading it**,
   then hands the text to the codec. A refusal is one of three things a player is told differently about:
   `tooBig`, `newer` (a save from a newer build, which only updating reads) and `unreadable` (everything
   else: not JSON, not a save, too old, unreadable by the browser). The next step for all of `unreadable`
   is the same, so the message is too.
2. **Ask.** `createConfirm`, the exam's alertdialog: "Replace your progress with this file?", described by
   "Your progress and settings on this device will be replaced by the ones in the file.", answered by
   "Replace" or "Keep my progress". Escape is "Keep my progress". Always asked, including over a first run:
   the settings on a fresh device are the player's too, and one rule is easier to trust than two.
3. **Hold the game's own writes, then write the file.** `replaceProgress` is one `ProgressRepository.save` of
   the whole document, at this build's version and this moment, so an older file is migrated once and stored
   migrated. From the moment the write starts, `persist()` in `main.ts` does nothing. If the store refuses the
   write, the hold is released, nothing has changed, and the player reads "This browser is not saving your
   progress. Nothing was changed." under the control they used.
4. **Start again from the store.** After a successful write, a dialog says "Your game is back." and "The game
   will start again with the progress from your file.", with one control, "Continue", which reloads the page.
   The boot that builds every screen on any visit builds them from the file. The dialog cannot be escaped: the
   only other place to go is the old game, over a store that no longer holds it. The writes stay held until the
   page goes.

**Nothing is applied partially** because there is no step at which part of the file is applied: the read
changes nothing, the write is one document, and the game on screen is either the old one (before Continue) or
entirely the file's (after it).

### Where each piece lives

| Piece | Layer | File |
|---|---|---|
| File name, reading a chosen file, what a refusal is called, the replacement | application | `app/application/use-cases/transfer-progress.ts` |
| The section, the confirmation, the dialog after, the refusal sentence | ui (DOM only) | `app/ui/save-transfer.ts`, drawn by `app/ui/settings-screen.ts` when `saveTransfer` is passed |
| The game in memory, the write hold, the download, the reload | bootstrap | `app/bootstrap/save-transfer.ts`, wired in `main.ts` for both Settings routes |

`app/ui` never sees a save: it hands the chosen `File` to `onImport` and is told `ready` (with a `replace`) or
`refused` (with a reason).

### The controls

- A **section in Settings**, last before Close, added rather than woven into the switches: a `role="group"`
  named "Your progress", described by "Keep a copy in a file, or bring your progress from another device."
- **"Save to a file"** and **"Open a file"**, the `TN-SAVE` rows. The storage warning already said "Save to a
  file", so one action has one name everywhere.
- The **file input is hidden** and out of the Tab order; the button opens it. A native file input draws "Choose
  file / No file chosen" in the browser's language — English on a French page — and cannot be sized to 44 px
  in every engine. Keyboard, pointer and one switch all reach the button.
- A **refusal opens no dialog**. It is a sentence under the buttons, the accessible description of "Open a file"
  while it is there, and said once through the live region.

### The file

`truenorth-progress-YYYY-MM-DD.json` (the UTC day), `application/json`, the codec's bytes: `version` and
`$schema` are in every file because they are in every save. It is handed to the browser as a `Blob` through a
download link.

## Alternatives considered

- **Apply the import in memory, without a reload.** Rejected for the reason in Context: a list of every reader of
  `Progress`, kept complete by hand, with a lost game as the cost of a missed entry. A reload costs one navigation
  that the service worker answers from the precache offline.
- **Reload immediately after the write, and announce "Your game is back." on the next boot.** Needs a marker to
  survive the reload — a query string or `sessionStorage` — which the boot must read and strip, and the player
  would hear the sentence on a screen that no longer shows what happened. The dialog says it on the screen where
  it happened, and waits for the player.
- **The File System Access API's save picker.** One engine has it, it is a second modal surface drawn in the
  operating system's language, and no browser suite can drive it; the download works in every engine this game
  targets.
- **Ask only when there is progress to lose.** Saves one tap on a first run and adds a rule about what counts as
  progress. A device's settings — 200 % text, one-button mode — are exactly what a player setting up a second
  device has just chosen, and the file replaces them.
- **Refuse a newer save with the generic message.** `TN-SAVE-04` already tells a player a stored save is from a
  newer version; a file is the same fact, and "choose a different file" would be the wrong advice.

## Consequences

- Settings, from the title and from a level, ends with "Your progress" whenever the composition root passes
  `saveTransfer`; the a11y harness passes it with `?save=1`, so every existing Settings scan, Tab lap and switch
  ring is unchanged unless it asks.
- `persist()` can be held. Only `app/bootstrap/save-transfer.ts` holds it.
- **Copy.** Five rows are transcribed from `TN-SAVE`'s table (`save.import`, `save.import.error`,
  `save.import.tooBig`, `save.import.done`, `save.newer.title`). Eleven are written by `app/ui` and listed in
  `COPY_GAPS` until `TN-SAVE`'s owner ratifies or replaces them: `save.section`, `save.section.help`,
  `save.import.confirm`, `save.import.confirm.body`, `save.import.replace`, `save.import.keep`,
  `save.import.error.help`, `save.import.newer.help`, `save.import.notSaved.help`, `save.import.done.help`,
  `save.import.continue`.
- **Tests.** `tests/unit/application/use-cases/transfer-progress.test.ts` (naming, export, every refusal,
  migration, the replacement and its failure), `tests/unit/bootstrap/save-transfer.test.ts` (the hold comes
  before the write and is released only on failure; nothing is written before the yes),
  `tests/unit/ui/save-transfer.test.ts` (the order of the dialogs, Escape, French),
  `tests/a11y/save-transfer.spec.ts` (EN and FR at 100 % and 200 %: the section, the confirmation, a refusal and
  the dialog after, with keyboard and one switch) and `tests/e2e/save-file.spec.ts` (a real download, a
  forgotten browser, a real file chooser, and a second file that must equal the first; refused files that leave
  the game as it was). Written, not run locally; CI runs them.
- **Not done:** "Delete my progress" (`TN-SAVE-06`'s last scenario) is still not in Settings, and a file chosen
  while storage is blocked is refused rather than played for the session.
