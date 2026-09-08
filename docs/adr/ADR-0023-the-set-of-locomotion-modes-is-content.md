# ADR-0023: The set of locomotion modes is content, not a closed enum

- Status: Accepted (2026-09-08)

## Context

`docs/plan/slices.md` gives level 3, Québec City, a **toboggan**. `locomotionMode` in
`content/schemas/level.schema.json` and `LocomotionMode` in `app/application/ports/locomotion.ts` enumerated
exactly eight names, and `toboggan` was not one.

Slice 2's entire purpose is proving that **a level is addable by JSON and assets alone.** As written, it
would have begun by editing a schema and a port. That is the proof failing before it starts.

The decisive fact is not the enum's contents but what a mode *is*. From the header of
`app/adapters/phaser/locomotion.ts`:

> **One locomotion strategy. Eight modes. No mode names in the code.**
> … there is exactly one `step` below, every mode goes through it, and the only thing that varies is a
> `LocomotionTuning` record read out of `content/levels/<id>.json`.

And that is enforced: a gate strips the comments out of that file and fails if a single mode name survives in
the code, "because *differ by data only* is exactly the claim that decays into `if (mode === 'skate')` the
first time a mode needs one more thing."

**So a mode carries no behaviour.** `toboggan` needs no strategy, no scene change, no input handler — it
needs a name, a `LocomotionTuning` in a level document, and a `labelKey` in the locale bundles. All three are
content. The enum was the only thing that was not.

The names had already been pushed *out* of the strategy, which was right, and pushed *into* the schema, which
is only half a move: a schema is not content, it is the shape content must take. They ended up in three
places — `level.schema.json`, `LOCOMOTION_MODES` in `level-document.ts`, and a hard-coded fourth copy inside
`level-is-data-only.test.ts`.

## Decision

**The legal set of locomotion modes lives in `content/game.config.json#/locomotionModes`.**
`level.schema.json#/$defs/locomotionMode` becomes an `id`, and `LocomotionMode` becomes `string`.

The precedent is exact and already in this repository: **`LevelId` is a branded string whose legal set lives
in content and is checked by a gate, not a union of ten literals.** Ten levels are not an enum, and neither
are nine ways of crossing them. Adding `toboggan` is now a one-line edit to a content file — which is what
slice 2 is supposed to demonstrate.

### The build-time guarantee is kept, and that is the whole design

Opening a set usually trades a build failure for a runtime one, and that would not be worth it. It is avoided
because the set moved rather than vanished: a level's `locomotion[].mode` is validated against
`game.config.json#/locomotionModes`, so a typo (`tobogan`) is still a failing build. What changes is *which
file* an author edits to add a mode, not *whether* the wrong name is caught.

### Why the objections dissolve

Both reasons offered for keeping the enum closed turn out not to need it.

- **`TN-LEVELS-02` wants a gate failing any level declaring `canoe` or `dogsled` while `OQ-REVIEW-10` is
  unanswered.** That is a **denylist of two names**, and a denylist needs no closed set — forbidding two
  strings out of an open vocabulary is exactly as expressible as forbidding two out of eight.
- **`level-is-data-only` derives its forbidden vocabulary from the enum.** It does not: it holds its own
  hard-coded copy of the eight names. And the same file already derives level ids **from `content/levels`**,
  "so the next level extends it automatically". Moving the mode derivation to `game.config.json` is the
  identical move, in the same gate, already proven there.

So the count of places holding this list goes from four to one, which is the same result the texture-ceiling
work reached by a different route.

### What must still land for the claim to be true

This ADR's schema change is **necessary and not sufficient**, and saying so is the point of this section.
`level-document.ts` still holds `LOCOMOTION_MODES` as a literal, and `createLocomotionFactory` refuses a mode
outside it. Until that list comes from the config, a level declaring `toboggan` passes `validate-content` and
then fails at load — which is a worse failure than the one being fixed.

- **OBLIGATION due=2026-10-08 owner=engine** — read the mode vocabulary from
  `GameConfigDocument.locomotionModes` in `app/adapters/phaser/level-document.ts` and
  `app/adapters/phaser/locomotion.ts`, delete the hard-coded `LOCOMOTION_MODES` literal and the fourth copy
  in `tests/unit/adapters/phaser/level-is-data-only.test.ts`, and add a contract test asserting every level's
  `locomotion[].mode` appears in the config. **Slice 2 cannot honestly claim "no engine changes" until this
  lands**, because until then adding a mode still requires editing an adapter.

## Alternatives considered

- **Give level 3 one of the eight modes — walk.** Cheapest, and backwards: it changes the game to fit the
  schema. Québec City's Old Town being steep and walkable is a fine argument for walking *if a designer makes
  it*; it is not an argument a JSON Schema gets to make. Rejected on that alone, and it would not have
  survived level 5 anyway.
- **Add `toboggan` to the enum now, as a recorded one-off.** Honest and cheap, and it concedes the point: an
  enum that needs an exception before the slice designed to test it is an enum that will need another. It
  also leaves the four copies in place.
- **Open the field with nothing checking it.** Rejected: a typo becomes a load-time `unsupported` instead of
  a failing build, which is the trade this project does not make. The registry is what makes opening safe.
- **A separate `content/locomotion.json` registry with default tunings per mode.** The richer version, and it
  is probably right eventually — a shared "what is a toboggan" that levels override. Rejected *now* as
  designing a document with no consumer (ADR-0008): every level already tunes its own modes, so a default
  tuning would be written against nothing. `game.config.json` already exists, is already loaded at boot, and
  the legal set is a game-wide fact, so it needs no new document.
- **Keep the union type in TypeScript and validate only in content.** Rejected: the union would immediately
  disagree with the config, which is the four-copies problem with extra steps.

## The second decision: `progress.schema.json` records the level last played

`lastPlayedLevelId` is added to `progress.schema.json`, `ProgressSnapshot` and the domain's `Progress`
(`OQ-FLOW-4` / `OQ-SAVE-7`). Nothing failed closed without it — "Choose a level" still reaches every unlocked
level — so it is a convenience the save carries, not a dependency.

Three things worth recording rather than leaving to be inferred:

- **The level, not the screen.** `TN-SAVE`'s survives table takes "the level last played", and "which screen
  the player was on" is explicitly in the *does not* survive table. Restoring a player into a modal, a
  summary or a question card they have no context for is worse than putting them back on the map, so the
  field is a `LevelId` and cannot become a route.
- **Required, not optional.** `null` means "no level entered yet"; absent would mean "this build did not
  record one", and those are different states. Same reasoning as `liveCheckPage.sourceDateModified`
  (ADR-0016).
- **It is not validated against the config's `levels` on import.** A save whose last level this build no
  longer ships should offer a Continue that fails gracefully, not fail to import — a stale pointer is not a
  corrupt save.

## Consequences

- **Slice 2 can be what it claims**, once the obligation above lands. That is the whole value here.
- **`LocomotionMode` stops being a useful autocomplete.** A real loss: `string` tells an author nothing, where
  the union offered eight names. The compensation is that the authoritative list is now one grep away in a
  file authors already edit, rather than in a port they may not open.
- **The eight names are unchanged and `content/game.config.json` now carries them.** Nothing about the
  shipped game moves; this is a change of custody.
- **The PO's map precedence rule is unaffected but worth noting here** — *no document exists → "Not made
  yet", and that wins over the unlock rules.* It is the same instinct as this ADR: the content decides what
  exists, and the configuration decides what is permitted. A level that is unlocked but unbuilt must never
  tell a player to earn a stamp they already hold.
- **Adding a mode still costs a locale key.** `LocomotionTuning.labelKey` is required and ADR-0010 keeps
  player-facing text in locale bundles, so `toboggan` needs EN and FR strings. That is content too, and
  `validate-content` already enforces EN/FR parity, so it fails in the right place.
