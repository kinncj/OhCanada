# ADR-0053: An unaccepted draw lives for the sitting and is never written down

- Status: Accepted (2026-09-17)
- Acceptance: `docs/stories/TN-FIRSTRUN-choosing-a-character-before-playing.md` (rulings 1 and 2),
  `docs/stories/TN-LOOK-what-the-player-can-choose.md` (`TN-LOOK-03`, `TN-LOOK-05`),
  `docs/content-review.md` §8.1 and §8.3.
- Builds on: ADR-0026 (the save is IndexedDB with `localStorage` as the fallback and the store a save came
  out of), ADR-0040 (the creator draws with the level's puppet through a DOM seam), ADR-0041 (a screen draws
  the art it names), ADR-0005 (layers).
- Slice: F2h (third live-site audit, 2026-09-17), defect 7, left reported rather than decided.
- Numbering. `main` holds ADR-0001…ADR-0049, ADR-0051 and ADR-0052; 0050 is spent by a draft on branch
  `multi-nation-source` that was dropped and never merged; 0038 is a hole nothing ever occupied. **0053 is
  the first number above the high-water mark across every ref this repository can see**, taken rather than
  the free hole at 0038 for the reason ADR-0052 recorded: a number is retired by having been used, and an
  ADR filed below the ADRs it builds on reads as older than them for ever. The two bare numbers in this
  paragraph carry no `ADR-` prefix on purpose — the contract gate resolves every `ADR-NNNN` token to a file
  in `docs/adr`, and it has gone red twice in one day on citations of records nobody can open.

## Context

A first-run player opens the creator on a randomly drawn character, and until 2026-09-17 the draw was remade
every time the screen was built: Back to the title and Play again, Settings' "Change my character" and a
language change each produced a different person, so the character a player was about to edit changed under
them without their asking. `e495ee4` fixed that inside `app/ui/shell.ts`: the draw is made once and kept for
the sitting, and "Surprise me" is the deliberate re-roll.

**What is still true, and is what this ADR is for: a reload before the player finishes the creator gives them
a different character.** The player who was looking at someone, reloads, and finds a stranger. Measured before
the fix, three page loads gave three different characters; measured after it, three page loads still do,
because the fix made the draw stable *within* a sitting and nothing survives a sitting except the save.

The UI owner declined to fix it in `app/ui` and named the bind exactly. The only store that outlives a reload
is the save; `TN-FIRSTRUN` ruling 1 says a player is on their first run **when the save carries no character,
and by nothing else**; so writing the drawn face down would end the first run and skip the creator for a
character nobody chose. That is a decision about what this game keeps, not an implementation detail, and it
had no owner.

Four facts shape the answer.

1. **The draw is not a pre-selection, and must not become one.** `docs/content-review.md` §8.1 forbids a
   pre-selected tone and §8.3 requires the open to be a uniform draw. The rig's `fallback` is reserved for NPC
   documents and save recovery precisely so a house character cannot leak in through a back door
   (`TN-FIRSTRUN` ruling 2, reason 2; `TN-LOOK-03`, `TN-LOOK-05`). Anything this ADR proposes has to leave
   both rules standing.
2. **The save answers one question about the character, and the whole front door reads it.** `character` is
   `PlayerCharacter | null` in `content/schemas/progress.schema.json`, and `progress.character === null` is
   what draws `title-play`. A second character-shaped fact in the save changes what "first run" means, which
   is a product ruling and not the architect's to take alone.
3. **The first-run draw is not made where the comment in `app/ui/shell.ts` implies it is.**
   `app/bootstrap/main.ts` calls `repairSelection(toSelection(progress.character), creatorRandom.next)` at
   boot; `toSelection(null)` answers `undefined`, and `repairSelection` with `undefined` draws **every** slot
   uniformly (`app/bootstrap/character-slots.ts`), raising no repair message. That drawn selection is handed
   to the shell as `creator.initialSelection`, so `openingSelection()` returns it and the shell's own
   `randomSelection` never runs on a shipped page. Two layers implement the same draw; the one that ships is
   the composition root's, seeded from `Date.now()`, and the one that is unit-tested is the screen's, which
   falls back to an unseeded `Math.random` because nothing passes `ShellOptions.random`.
4. **The sitting's character therefore has two holders, and they can disagree.** `app/bootstrap/main.ts`
   keeps `characterSelection` and updates it only when a character is created or changed; `app/ui/shell.ts`
   keeps `selection` and updates it on every change inside the creator. `titleFigure` reads the first. So on
   a first run: Play, "Surprise me", Back — the title screen draws the face from before the re-roll, while
   the creator holds the one after it. Nothing is saved either way, so nothing is corrupted; a player is
   simply shown two different characters for themself on two adjacent screens.

Fact 3 and fact 4 are the same defect seen twice, and they are the reason this ADR does not stop at "yes or
no to persistence". Two agents were reaching into the same responsibility from two files. That is a boundary
defect, and it is fixed below by saying which layer owns the draw rather than by making the two copies agree.

## Decision

### 1. An unaccepted draw is not state this game keeps

**A character the player has not accepted is never written to any store. Its lifetime is the page. A reload
before "Start playing" or "Done" draws a new character, and that is the answer, not an outstanding defect.**

Three reasons, in the order that decides it.

- **Nothing was promised.** The screen the player is on is the screen that says "Pick how you look." The face
  on it when it opened is the game's opening move, not the player's choice — by definition, because the
  moment they make it theirs is the moment the primary control is pressed, and that moment already has an
  event (`character/created`) and a store. Keeping an opening move across a reload is the game remembering
  something on the player's behalf that the player never said.
- **Every place to keep it either forbids itself or costs more than the defect.** The save cannot hold it
  without changing what a first run is (fact 2). A second store contradicts ADR-0026's single answer to
  "where does state live". A stable seed makes the draw a property of the device rather than of the moment,
  which is how §8.1's pre-selection comes back wearing different clothes. Each is argued in
  "Alternatives considered"; none of them is free, and the defect they are buying against is a *cosmetic
  starting point on a screen whose whole purpose is to change it*.
- **The player who reloads mid-creator has lost nothing they chose.** If they had chosen, the choice is in
  the shell and in the picture and the way to keep it is one control away. If they had not, they are back
  where they were: a complete character on an open screen, one tap from a level. `TN-FIRSTRUN-03` already
  rules that leaving the creator saves nothing and says nothing, and a reload is a harder leave than "Back".

This is recorded **as a decision** rather than left as a known defect, because a defect nobody owns gets
re-found by every audit and re-argued from scratch — which is what happened here.

### 2. Inside a sitting the draw is made once, and this is deliberate

`e495ee4` is right and is hereby the rule rather than an accident:

- the first opening of the creator in a sitting draws uniformly over every option in every slot;
- **every later opening opens on that same character** — Back to the title and Play again, Settings'
  "Change my character", a language change, a text-size or reduced-motion change made over the screen;
- "Surprise me" is the only thing that draws again, because that is the player asking (`TN-LOOK-03`);
- finishing the creator turns the sitting's draw into the save's character, and after that there is no draw
  left to hold.

And the part nothing said, which is the smaller question this ADR was asked to settle: **what happens to the
draw across a language change, a Settings visit, a level and the exam.** The answer is *nothing happens to
it*, and it is a property of where it lives rather than of anything those routes do. `createShell` is called
once per boot in `app/bootstrap/main.ts` and the shell is destroyed only when the page goes; `clearView`
destroys **views** — the title, the creator, the map, the Settings screen and the editor — while the draw is
held by the shell itself. A level, the exam, the passport and Study are mounted into the shell's `<main>` or
over it and never replace it. So:

| What the player does | The draw |
|---|---|
| Changes the language, in Settings or on the title | kept; the creator is re-labelled, not re-drawn |
| Opens Settings, changes any setting, closes it | kept |
| Back out of the creator, then Play again | kept |
| Plays a level, leaves it, comes back to the map | kept |
| Starts, leaves or finishes an exam | kept |
| Taps "Surprise me" | replaced, because they asked |
| Finishes the creator | becomes the saved character; there is no unaccepted draw any more |
| Reloads, or closes the tab and returns | gone; the next sitting draws again (rule 1) |

That table is the landed behaviour. It is recorded here so the next audit reads it as a decision, and so that
anyone who changes one row knows they are changing a decision.

### 3. One draw, one holder, and the holder is the screen

The draw belongs to `app/ui/shell.ts`, which is where the sitting lives and where the character is shown.

- `app/bootstrap` **repairs** a saved character — that is `repairSelection`'s real job, `TN-LOOK-05`'s rule,
  and it needs the save, so it belongs to the composition root — and **does not draw a character for a save
  that has none**. A save with no character is handed to the shell as *no selection*, which is already the
  shape `ShellCreatorOptions.initialSelection` has (optional) and already what `openingSelection()` handles.
- `app/bootstrap` passes `ShellOptions.random`, the existing `random.fork('character')` stream. The draw is
  then a pure function of one seed, which is `main.ts`'s own stated reason for having a seeded source at all,
  and it stops being the one draw in the game that runs on unseeded `Math.random`.
- The player's appearance reaches the renderer and the title screen from **the holder**, not from a second
  copy in the composition root: the shell already reports every change it makes.

This also decides what the title screen draws before a character exists: **a figure is painted from the
save's character, and a first run draws the landscape alone.** ADR-0041 already ships that state — "a figure
that could not be painted is no figure: the landscape and the words are the whole screen" — so it costs no
new code path. It removes fact 4's disagreement at the source rather than by synchronising two copies, and it
keeps a face nobody has chosen off the screen that comes *before* the one where choosing happens, which is
the spirit of §8.1 read one screen earlier.

### 4. The decision is held by a test, not only by this file

A "do nothing" decision with nothing pointing at it is indistinguishable from an oversight, and the next
person to meet the stranger will fix it. The rule that must be mechanically true is the narrow one:

> While the creator is open and the player has not accepted a character, nothing writes a character —
> no `character/created`, no `character/changed`, and the store's `character` is still `null`.

That is a statement about the game's writes, so it is checked from the outside, over a real boot: open the
creator, change options, tap "Surprise me", open Settings and come back, and assert the save still says a
first run. A test that merely asserted "a reload redraws" would pin the *symptom* and would go red the day
someone legitimately changes how the draw is seeded; this one pins the *rule*, which is the thing this ADR
decided.

## Alternatives considered

- **Keep the draw in `sessionStorage`, or in a distinct key beside the save.** It works: a reload restores the
  same unaccepted face, and the first-run branch still keys off "the save has a character". It costs a second
  place that holds character-shaped state, and the only way to know which is authoritative is to read both —
  which is the "the store depends on what the player did" state ADR-0026 refused when it rejected lazy
  migration. It also puts an exception in the one-line answer CLAUDE.md gives for storage; ADR-0026 says the
  store is IndexedDB with `localStorage` as the fallback, and "except the creator's draw, which is in a third
  store" is a sentence every future reader has to carry. And the promise it makes is oddly shaped: the face
  survives a reload but not a new tab, so the game would sometimes remember the stranger and sometimes not,
  with no rule the player could learn. `sessionStorage` is refused on the same private-mode grounds ADR-0026
  §1 documents, too: it is not available everywhere either, so the path would need its own fallback to…
  drawing again.
- **Seed the draw from a per-install id.** The cheapest to reason about, and it was close. It is refused on
  the rule it breaks rather than on cost: a per-install seed makes the drawn character **a property of the
  device**, identical on every first run until storage is cleared. That is a house character — this device's
  default player — arrived at by arithmetic instead of by a constant, and §8.1's "no tone is pre-selected"
  is about the outcome, not the mechanism. It is worst exactly where this game most wants to be right: a
  shared or classroom device shows the same face to every newcomer who opens it. It is not free either: the
  id has to be stored to be stable, and `progress.schema.json` is `additionalProperties: false` with every
  property required, so a new field is a save-format version bump and a migration (ADR-0026, §"And one thing
  that came with it") — paid for a face nobody accepted.
- **Make the first-run branch key off something else, so the save can hold an unaccepted character.** A
  `characterAccepted` flag, or a nullable `acceptedAt`. This is the honest version of "persist it", and it is
  refused on three counts. It overturns `TN-FIRSTRUN` ruling 1, which is the product owner's ruling and not
  the architect's to take; it makes two document shapes carry a character with two different meanings, which
  ADR-0026 refused for `holdToChooseMs` on the grounds that it pushes the guessing into every reader; and an
  exported save (ADR-0046) would then carry a face the player never accepted into a file they can send
  someone, where "accepted" has to survive an import as well. A save format version, a migration, a port
  change and a story amendment, to keep a stranger on the screen after a reload.
- **Draw in the composition root and keep it there (today's shape).** Rejected by rule 3. It is the reason the
  screen's own draw is dead code on a shipped page, the reason the shipped draw is unseeded from the shell's
  point of view, and the reason the title screen can show a character the creator no longer holds.
- **Re-open the creator automatically after a reload, on a saved-but-unaccepted character.** A fourth option
  that appeared while writing the third: persist the draw, and re-enter the creator because the character is
  unaccepted. It is the same save change with an extra rule, and it hands the player the screen they had
  without the thing they wanted — the face is the same, but they are *back in the creator* rather than where
  they were. Refused with its parent.

## Consequences

- **A player who reloads mid-creator meets a new character, and the game says nothing about it.** That is the
  priced cost of this decision. It is the same silence `TN-FIRSTRUN-03` already chose for Back ("nothing on
  the screen says I lost anything"), and `OQ-FIRSTRUN-1`'s reasoning applies unchanged: a screen that
  acknowledges the loss is a screen that marks the player down for a reload.
- **Two acceptance scenarios now describe a game that no longer exists, and both still pass.** `TN-FIRSTRUN-03`'s
  "Coming back in is a new draw, not the one I walked away from" is contradicted by its own title only — its
  four assertions (a complete character, nothing claiming to have restored anything) hold under rule 2.
  `TN-LOOK-03`'s "Opening the screen is a draw, not a default … no group opens on the same option every time"
  is true of the first opening in a sitting and false of the second. Both need the word *sitting*; both are
  the story owner's to write, which is the obligation below. This is worth naming loudly: the two files that
  are supposed to catch a regression in the draw currently assert a rule the game deliberately broke, and a
  green suite is not evidence either way until they are reworded.
- **Nothing in `ADR-0026` changes, and CLAUDE.md's storage row stays a single sentence.** No second store, no
  exception, no new save field, no format version. That is the main thing this decision buys.
- **A player with no storage at all is unaffected and consistent.** `TN-FIRSTRUN-05` already rules that every
  load is a first run when nothing can be saved, and that the character lasts the sitting. Rule 1 gives the
  same behaviour to a player whose storage works: the difference between the two players begins when a
  character is accepted, which is exactly where the storage warning says it does.
- **Rule 3 is a `app/bootstrap` change and an `app/ui` change that must land together**, and it is the fix for
  the boundary defect rather than for the audit's symptom: after it, exactly one module can produce a
  character nobody has chosen, and exactly one module holds it. Until it lands, the composition root keeps
  drawing at boot and the title screen keeps its stale-figure case; both are recorded here so the next reader
  meets them as known work rather than as a discovery.
- **The picture the creator draws (ADR-0040) is unaffected.** It draws whatever selection it is given; which
  selection that is has never been its question.

- **OBLIGATION due=2026-11-17 owner=engine** — land rule 3. In `app/bootstrap/main.ts`: stop drawing a
  character for a save that has none (`repairSelection` keeps repairing a saved one), pass
  `random.fork('character')` to `createShell` as `ShellOptions.random`, take the appearance the renderer and
  the title figure are given from the shell's reports rather than from a second `characterSelection`, and
  draw no title figure until the save has a character. `app/ui/shell.ts` needs no new behaviour for this —
  `openingSelection()` already draws when it is given no selection — which is the test that the boundary is
  now in the right place. If it turns out `app/ui` must change too, say so here before changing it: that
  would mean the seam is still wrong.
- **OBLIGATION due=2026-10-17 owner=ui-a11y** — build §4's gate: an end-to-end check over a real boot that
  the store still reports a first run while the creator is open and unfinished, through option changes,
  "Surprise me", a Settings visit and a language change, with no `character/created` or `character/changed`
  emitted. It is the only thing standing between this decision and a future change that quietly persists the
  draw because the stranger looked like a bug.
- **OBLIGATION due=2026-12-17 owner=po** — reword the two scenarios named in the consequences so the
  acceptance files say what the game does: `TN-FIRSTRUN-03`'s "Coming back in is a new draw" becomes the
  same character within a sitting and a new draw in a new sitting, and `TN-LOOK-03`'s "Opening the screen is
  a draw, not a default" says the *first* opening in a sitting. Either amend them to rule 2 or overturn rule
  2 here; what may not stand is a story and a game that disagree while both are called green.
