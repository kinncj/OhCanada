# ADR-0058: The game walks by itself until the player turns it off

- Status: Accepted (2026-09-17)
- Acceptance: `docs/stories/TN-SET-settings.md` (`TN-SET-01`, `TN-SET-02`), `docs/stories/TN-REACH-what-is-in-reach.md`
  (`TN-REACH-09`), `tests/e2e/auto-walk-by-default.spec.ts`, `tests/e2e/auto-move-stops.spec.ts`.
- Builds on: ADR-0032 (every drive stops at each thing it can engage, once per visit), ADR-0037 (letting go in
  reach stops there, and a stop rests beside a character), ADR-0043 (a stop waits for an answer), ADR-0002
  (one-thumb input, "an auto-move option covers players who prefer point-to-travel"), ADR-0026 (where a save
  lives).
- Does **not** amend: the Traversal row of `CLAUDE.md`. Auto-move is still "an option" and still one switch in
  Settings; this says which way that switch points for somebody who has never opened it.
- Numbering. `main` holds up to ADR-0056. **0057 is spent twice on unmerged branches** — `answer-shuffle` has
  `ADR-0057-a-questions-options-are-shuffled-where-they-are-drawn.md` and `teach-before-asking` has
  `ADR-0057-a-level-asks-only-what-it-taught-and-the-teaching-is-the-guides.md`, two different subjects on one
  number. 0058 is the first number above the high-water mark across every ref this repository can see, which
  is ADR-0053's rule.

## Context

The product owner asked for TrueNorth to **auto-walk by default**, with a Settings toggle to turn it off.

Auto-move has existed since slice 1 and shipped off. The switch is `settings.autoMove`, the wire from it to the
scene is `renderer.setAutoMove` (ADR-0008's missing caller, joined in `app/bootstrap/main.ts`), and the default
lived in two tables that must agree: `defaultSettings` in `app/domain/entities/player.ts`, which is what a new
save is written with, and `DEFAULT_SETTINGS` in `app/ui/settings.ts`, which is what a screen shows before a save
has been read. Both said `autoMove: false`.

**Nothing had ever ruled that it should be false.** The decision table says "Auto-move option"; ADR-0002 says "an
auto-move option covers players who prefer point-to-travel"; `TN-SET-02` is written as "When I turn on 'Move by
itself'", which describes the control rather than its resting state. `TN-SET-01` and `TN-SET-09` *do* state
defaults where they have been ruled — "Subtitles are on until the player turns them off", "Medium is the
default" — and there is no such line for auto-move anywhere in `docs/`. The only written rationale was a comment
in `tests/unit/ui/settings.test.ts`: *an accessibility feature turned on for somebody who did not ask is a change
to their game, not a service.*

That principle is right, and it is the thing this ADR has to answer, because it argues the other way.

Three facts decide it.

1. **Holding is the game's only sustained physical demand.** Every other control is discrete: a tap to jump, a
   tap to engage, a tap on a card. Holding a contact for the length of a level is the one thing that asks for
   endurance rather than an action, and it is the one thing a player cannot do less of. The option that removes
   it was reachable only by a player who could already play well enough to find Settings — and on a first run,
   Settings is behind the title screen, which is behind nothing, but the *level* is where the demand appears.
2. **The stop rule already makes it safe.** Before ADR-0032, auto-move was genuinely a different game: it
   carried the player past every landmark and every character, so turning it on cost them the level's content.
   Since ADR-0032 an automatic drive comes to rest at each thing it can engage, once per visit, and never
   starts again on its own. Walking is then the only thing the option does. It chooses nothing, skips nothing,
   and reaches the same places on the same line as a held drive — `TN-SET-02` already says so in as many words:
   "Auto-move is not a difficulty change … the same points of interest are reachable and the skate tuning
   values are unchanged."
3. **It is a default, not a mode.** One switch, in the first group on the Settings screen, labelled in both
   languages, and the choice is saved. Nothing about turning it off is harder than it was.

So the principle survives with its scope stated properly: an accessibility feature is not turned on for
somebody who did not ask **when doing so changes what their game contains**. This one changes only whether
their thumb has to stay down.

## Decision

### 1. `autoMove` ships `true`

In both default tables, which continue to be written twice for the reason they always were — a DOM screen may
not import the domain's settings (`outer-layers-use-domain-vocabulary-only`) — and which continue to be held
together by the fact that the composition root builds the store from the *save*.

Nothing else changes. Not the tuning, not the stop line, not the copy, not the switch, not the wire.

### 2. What a save does, and does not, inherit

**An existing save keeps the value it holds.** `content/schemas/progress.schema.json` declares `settings` with
`additionalProperties: false` and *every* property required, `autoMove` among them, and it has done so since
version 1. So there is no save on any device that omits it: every save written by any shipped build carries an
explicit `true` or `false`, `validateProgressDocument` refuses one that does not, and `clampSettings` — the only
thing that touches settings on the way in from a file — carries booleans through untouched.

Therefore:

- **a player who deliberately turned auto-move off finds it off.** This is the case that had to be got right,
  and it is structural rather than careful: nothing anywhere folds `defaultSettings` over a loaded save;
- **a save that never stored one cannot exist**, so "does it get the new default?" has no case to answer. A
  hand-edited file missing the property is refused loudly by the schema check, naming the JSON pointer, which
  is the behaviour ADR-0026 and `TN-SAVE-04` already specify;
- **no migration step is added, and none is needed.** The save format stays at version 4. A migration would be
  the wrong instrument twice over: there is no document to convert, and a step that wrote `autoMove: true` into
  existing saves would be exactly the thing this section forbids — reaching into a choice a player already made.

New saves — a first run, or a save cleared — get `true`, because that is what `defaultSettings` now returns.

### 3. What this does not buy, stated rather than implied

**A player who touches nothing at all still cannot finish a level, and must not be able to.** Measured on the
shipped build: a fresh profile walks out of Halifax's spawn and comes to rest beside the guide with every
frame's intent at zero, and then stays there — 0 px in the next eight simulated seconds. That is ADR-0032 §2
working ("No timer, no automatic restart"), ratified by `TN-REACH-09` ("nothing moves again while I do nothing")
and by `TN-SET-02` ("nothing starts moving again on its own"), and it is not weakened here.

So this default removes the **sustained** demand and leaves the **discrete** one: a tap, a key, or a switch
press per thing the player comes to rest at. That is the same count of actions a held-drive player spends at
those stops, and one of the three ways out of a stop is engaging — so a player who takes up each offer is
carried on by the act of taking it, and never presses a direction at all.

Anything that made the drive restart itself would be a timer outside Exam mode, which `CLAUDE.md` forbids, and
would take back the "nothing moves while I do nothing" that the stop rule exists to give.

### 4. What the browser suites now have to say out loud

Most of the e2e suite opens a level as a player who has changed nothing, and much of it is *about* a held
drive: "the player starts at the spawn … `data-speed` is 0", the glide and coast scenarios, the stop-and-press-
again walks. Those scenarios did not become wrong, but their precondition stopped being the default, so they
now state it: `tests/e2e/held-drive.ts` seeds a settings-only save with `autoMove: false`, and each such spec
takes it in a `beforeEach`. The saves in `tests/e2e/saves.ts` carry the same setting for the same reason.

This is the honest shape. A scenario about holding a control has to be run by a player who holds a control, and
a suite in which *every* spec silently assumed the old default would otherwise have hidden the change behind
two dozen unrelated failures.

## Alternatives considered

- **Leave it off and make the option easier to find** — a prompt on the first level, or a line on the title
  screen. Rejected: an offer a player has to read and answer is a worse first minute than a game that simply
  does not require their thumb, and it puts a decision in front of somebody before they know what either
  answer means. It also adds player-facing copy in two languages to avoid changing one boolean.
- **On by default only when the OS reports a motor-assistive setting.** Rejected: the web platform exposes no
  such signal. `prefers-reduced-motion` is about animation, not endurance, and reading it this way would turn
  one request into a different one — the mistake `resolveMotion` is written to make impossible.
- **A third state — on until the player first holds a direction, then off.** Rejected: it is a mode that
  changes itself based on what the player did, so the switch in Settings would stop describing the game, and a
  player who leant on a key once would silently lose the setting. `TN-SET-05`'s "no setting can put the game
  into a state the switch alone cannot leave" is easier to hold when the setting means one thing.
- **Flip `DEFAULT_SETTINGS` only, leaving the domain's `defaultSettings` off.** Rejected outright: the screen
  would show "On" for the instant before the save is read and then flip under the player, and the value written
  into a new save would be the one nobody saw.

## Consequences

- A first-run player walks the level without holding anything, stops at each landmark and character, and
  chooses everything they engage. Proved end to end in `tests/e2e/auto-walk-by-default.spec.ts` against the
  built artefact, through the real title screen, creator and map.
- **`tests/e2e/auto-move-stops.spec.ts` and `tests/e2e/touch-controls.spec.ts` now read the switch instead of
  setting it.** Both used to assert `aria-checked="false"` and click it on; both now assert the shipped default
  is on. That is a stronger claim than the one they made, and it is the claim this ADR is accountable for.
- **`tests/a11y/readability.spec.ts` uses "Easier-to-read font" as its *off* exemplar.** It used auto-move, and
  an on-by-default switch cannot demonstrate what an off switch looks like. The high-contrast and forced-colours
  scans still prove both states, which is what `TN-SET-07`'s "state is distinguishable without colour" needs.
- The settings screen needs **no new copy**: `settings.autoMove` ("Move by itself" / « Déplacement
  automatique »), its help row ("You do not need to hold the screen." / « Vous n'avez pas besoin de garder le
  doigt sur l'écran. ») and `settings.state.on` / `.off` ("On"/"Off", « Activé »/« Désactivé ») are all
  ratified in `TN-SET-settings.md`'s table. No `COPY_GAPS` row is added, because no string is invented.
- Keyboard and switch players are unaffected in what they can do and better off in what they must do: a held
  key or a steer still wins over the drive on the frame the level sees it (a non-zero intent always beats
  `drive: 'auto'` in `locomotion.ts`), letting go hands the player back to the drive rather than stranding
  them, and the switch ring still reaches the interact prompt, whose engagement releases the stop.
- `TN-SET-02`'s scenarios are still all true, and one of them is now reachable without touching Settings first.
  `TN-LEVEL-07`'s "the skater moves along the canal without any input" remains unimplemented *for single-switch
  mode as such* — it is true now because auto-move is on, not because single-switch drives the player.
