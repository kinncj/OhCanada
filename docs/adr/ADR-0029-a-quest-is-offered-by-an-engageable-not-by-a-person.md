# ADR-0029: A quest is offered by an engageable, not by a person

- Status: Accepted (2026-09-13)

## Context

Two contracts in this repository are each correct and cannot both be satisfied.

**`content/schemas/quest.schema.json` requires `giver`, and `giver` is a `characterId`** — *"The character
who offers the quest."* All eight authored quests are given by `guide` or `officer`, both of which are drawn
figures with a rig, a face and a `content/characters/<id>.json`.

**`assets/style/peggys-cove-level.md` §0 and `assets/style/the-north-level.md` §0 record, on both art
subjects of both levels, a `neverAdd` clause reading *"a figure of any kind, at any scale, including a
silhouette and a crowd"***. `docs/stories/TN-LEVEL-peggys-cove.md` and `TN-LEVEL-the-north.md` carry the
copy-side half: no string on those levels describes, addresses or names a person, a people or a nation. The
North's document gives the reason without hedging — more than half the Northwest Territories' population is
Indigenous and about 85 % of Nunavut's, a fact that level's own bank teaches from *Discover Canada*, so a
figure drawn on a northern river bank is read as somebody, and this project has no reviewer who may say
whether that reading is welcome. `docs/content-review.md` §1 item 5 and §10.3 are the general form.

The prohibition is right and is not what this ADR touches. What this ADR touches is the sentence in the
schema that turns it into a scope cut:

| | `quests` | `characters` | POIs |
|---|---|---|---|
| `content/levels/peggys-cove.json` | `[]` | `[]` | 1 |
| `content/levels/the-north.json` | `[]` | `[]` | 1 |
| the other eight | 1 each | 1 each | 1–2 |

Two of ten levels are a walk to the end with one landmark card, because the only way to hold a quest was to
draw a person, and on those two levels a person may not be drawn. `CLAUDE.md` says slices are engineering
practice and never a scope cut; this is a schema clause performing one.

**The premise under `giver: characterId` was never argued.** It was written when the only two things that
existed were `guide` and `officer`, and it encodes *a quest is offered by somebody* as a type. But a quest is
offered by **something the player engages**, and `CLAUDE.md`'s own traversal rule already names two of those:
*"tap NPC or POI to engage."* `level.schema.json#/$defs/pointOfInterest` already carries `questId` — *"Quest
this POI advances, when it is a quest target"* — so the level format half-anticipated this and the quest
format did not follow.

A plaque, an interpretive panel, a posted notice, a marker, a trail sign: these already exist in the world as
the things that teach a visitor a fact at a spot, they are drawn every day at Peggy's Cove and along the
Yukon, and none of them is a figure of any kind at any scale.

### Two things found while writing this, both of the ADR-0024 family

1. **`quest.schema.json`'s `levelId` description says *"the level document lists the quest id too;
   `validate-content` is where the two are cross-checked."* No such check exists.** `grep quest
   scripts/validate-content.mjs` finds one comment and no code. The schema asserts a gate that was never
   written, which is worse than an admitted gap because the sentence stops anyone from looking.
2. **`tests/unit/contracts/a-quest-line-is-complete-and-sourced.test.ts` records, honestly, that *"a line
   whose speaker the level does not place"* is unchecked and left as an obligation on ADR-0010.** Widening
   what may speak widens that hole, so it cannot be widened and left open in the same change.

## Decision

### 1. `giver` stays required, and what may fill it widens

`giver` remains required. A quest with no offerer is worse than a quest offered by a panel, for three
reasons and any one is sufficient: `app/ui/dialogue.ts` takes `speakerName` as a **required** option so an
unnamed dialog cannot be constructed, and an absent giver leaves nothing to name it with; the four moment
lines (`declinedLine`, `reminderLine`, `afterLine`, `doneLine`) are defined as *what the giver says* and
would have no source; and an empty giver folds to "nothing to offer, nothing to decline, nothing to remind",
which is ADR-0024's identity element sitting exactly on the success value. A missing giver is not an
authoring case, it is a typo.

What changes is the type. `giver` becomes `common.schema.json#/$defs/id` — **unbranded**, naming a thing the
level places, which today is a character or a point of interest.

This is not a new idea in this file. `questStep.targetId` is already unbranded, with the reason written into
the schema: *"what it names depends on `kind` (a character for talk, a POI for visit or collect, a question
pool for answer), and a union of brands is not a shape a schema can state."* The same sentence is true of
`giver`, and it was true when `giver` was written.

### 2. The kind is resolved from the placement, not declared a second time on the quest

The tempting shape is a tagged reference — `"giver": { "kind": "landmark", "id": "peggys-point-light" }` —
and it is refused below. The kind of a giver is **already declared**, in the one document that owns
placement: a level lists `characters[]` and `pois[]` separately, and the runtime already knows which list a
tapped target came from before it ever asks whether that target is a giver (`isGiver(targetId)` in
`app/bootstrap/quest.ts` is called by a scene that has the two lists apart).

So the resolution rule, and it is the whole of the loudness answer:

> **Exactly one placement on the quest's level has an id equal to `giver`, and that placement declares
> `questId` equal to the quest.**

Zero matches is a dangling giver and fails. Two matches — a character and a POI sharing an id — is an
ambiguous giver and fails. This is deliberately *not* a `filter`, a `some` or a `find`: those reduce an empty
collection to `[]`, `false` or `undefined`, and ADR-0024 §1 is about exactly that. "Exactly one" has no
success-shaped identity element; it fails in both directions and names which.

### 3. `dialogueLine.speaker` widens identically, and stays required

Same change, same reason: `common#/$defs/id`, still required. A line with no source at all remains illegal —
the existing gate asserting that stays green untouched — because a screen reader is given the dialog's
accessible name before it is given a word of prose, and a line with no source is a line the live region
cannot attribute.

**A panel therefore speaks, in the only sense the model needs: it is the named source of words on screen.**
It does not acquire a mouth, a rig or a mood.

### 4. A landmark speaker carries no `expression`, and that rule lives in the gate

`expression` is *already* optional, which is why the parent question — "either `expression` becomes optional
or …" — has a smaller answer than it looks. The lie was never going to arrive through `expression`. It was
going to arrive through `speaker: CharacterId` naming a lighthouse, after which `ICharacterRenderer` is
asked for a rig that does not exist and the dialogue UI looks for a portrait of a rock.

`expression` stays optional and becomes **forbidden when the speaker resolves to a POI**. That rule cannot
go in `quest.schema.json`: the quest document does not know what its speaker is, and a schema that asked it
to say would be the tagged reference refused in §2. Per ADR-0024 §2 — *find the smallest thing that knows,
and put the floor there* — the smallest thing that knows whether a speaker has a face is the level's
placement, so the rule goes in the gate that reads the quest and the level together. It is the same gate as
§2, evaluated on the same pass.

### 5. What the player hears is authored, not validated

**A landmark's lines are written in the second person and the impersonal.** "This spot marks…", "You are
standing on…", "The light here was first lit in…". Not "I have kept this light for forty years."

This is an **authoring rule in `docs/guidelines/dialogue-quests-and-landmarks.md`, not a schema rule**, and
the reason is stated so nobody re-opens it hoping for a pattern:

- A regex for first person is either trivial to evade or false-positives on the one thing these lines are
  most likely to contain — a quoted passage, which `fact.source.quote` requires be copied exactly, and
  *Discover Canada* quotes people.
- French makes it worse, not better: `je`, `j'`, `nous`, `on`, and every elision of them.
- The judgement is the same family as "plain language, roughly CLB 4", which `CLAUDE.md` already holds by
  review on every question and every blurb. Inventing a mechanical check for the voice of a plaque while the
  reading level of a question card is held by a reader would be a gate placed where it is easy rather than
  where it matters.

It is **not** a matter of taste, and the guideline says why: a screen-reader user hears the dialog's
accessible name — "Peggy's Point Lighthouse" — and then the prose. First-person prose after that name has
told that user a person is standing there. On these two levels specifically, that is the failure the art
document's `neverAdd` clause exists to prevent, arriving through the copy instead of the picture.

### 6. Accessibility: what is announced as the source

The dialog's accessible name is the giver's name, and it is never empty:

| Giver | Name comes from | Portrait |
|---|---|---|
| a character | `content/characters/<id>.json#/name` — today `app/bootstrap/quest.ts` reads the `npc.<id>.name` copy row instead, written when `content/characters/` was empty, which it no longer is | yes |
| a landmark | `content/levels/<level>.json#/pois[…]/name` — required, bilingual, already the string the POI card draws | no |

Nothing new is announced and no new copy row is needed. The landmark case is in fact **better founded than
the character case**: its name is content, in both languages, in the document that places it, whereas a
character giver's name currently depends on a copy row in `app/ui/copy.ts` that exists only because
character documents did not. Recorded here because it inverts the intuition that the new case is the shakier
one.

`app/bootstrap/quest.ts` already refuses to open a dialog it cannot name, and logs. That refusal is correct
and stays; it is the runtime half of §2's fail-closed.

### 7. The gate

`tests/unit/contracts/a-quest-giver-is-placed-on-its-level.test.ts` reads `content/quests/` and
`content/levels/` and asserts, per quest:

1. `levelId` names a level that exists, and that level lists the quest in `quests[]` — closing the check the
   schema claimed `validate-content` performed and it did not;
2. `giver` matches **exactly one** placement on that level, counting `characters[].characterId` and
   `pois[].id` together;
3. that placement declares `questId` equal to the quest;
4. every `speaker`, on all four moment lines and every `steps[].dialogue[]` line, matches exactly one
   placement on the same level;
5. a speaker that resolves to a POI carries no `expression`;
6. a speaker that resolves to a character has a `content/characters/<id>.json`;
7. a floor: the corpus is non-empty and the number of speaker resolutions performed is non-zero, so a gate
   that checked nothing cannot report a pass (ADR-0024);

and proves each rule by constructing a document that breaks it and asserting the failure, rather than by
trusting that the check would fire.

This also closes ADR-0010's open obligation for character speakers, which is the rule the existing quest-line
gate documented as unheld.

## Alternatives considered

- **A tagged reference: `"giver": { "kind": "character" | "landmark", "id": … }`.** The strongest
  alternative and the first draft of this ADR. It makes the kind local to the quest, which would let
  `quest.schema.json` forbid `expression` on a landmark line by itself, and it makes the lookup namespace
  explicit. Refused on three counts. **It declares a second time what the level already declares**, and two
  declarations of one fact can disagree — a quest saying `kind: "character"` about an id the level placed as
  a POI is a new contradiction the current shape cannot express. **It does not remove the need for the
  cross-document gate**, since a tag still does not prove the id resolves, so it buys one schema-local
  conditional at the price of a permanent second source of truth. And **it is a breaking notation change**:
  all eight quests, `app/bootstrap/quests.ts`'s parser, `app/bootstrap/quest.ts`'s name resolution and four
  test fixtures move in one commit, to buy a rule that §4 places correctly anyway. The one thing it is
  genuinely better at — a dangling giver names the namespace it failed in — is bought instead by "exactly
  one", which reports zero and two differently.
- **`anyOf: [characterId, poiId]`, a bare string with a union type.** Half of the tag's cost for none of its
  benefit: at the JSON level the two alternatives are byte-identical string schemas, so ajv accepts anything
  either accepts, and the union exists only in TypeScript where nothing constructs a `PoiId` giver anyway.
  A distinction a validator cannot see is documentation wearing a schema's clothes.
- **`anyOf: [characterId, landmarkGiverObject]` — a character stays a bare string, a landmark becomes an
  object.** Backwards compatible, no migration, and it is the decision this ADR is reversing, written in
  notation: it says a person is the unmarked default kind of giver and everything else is a special case.
  That is the sentence that cost two levels their quests.
- **Make `giver` optional, so a level with no giver can still have a quest.** Refused in §1. It also answers
  a question nobody asked: Peggy's Cove does not lack an offerer, it has a lighthouse.
- **Delete `giver` and let `pois[].questId` / `characters[].questId` be the single declaration.** Genuinely
  tempting — it is the "one declaration" argument pointed the other way — and refused because the quest can
  then no longer name its own dialog without loading the level, and because *nothing constrains how many
  placements claim a quest*: zero placements claiming it and two placements claiming it are both legal
  documents that reduce to "no giver" and "whichever we found first". That is ADR-0024 with the field
  removed instead of widened.
- **A separate shape for a panel's lines — `panelLine` beside `dialogueLine`.** The parent's second option,
  and the most expensive wrong answer. It duplicates `localizedText`, `factClaim` and the four moment fields;
  it needs a second parser, a second gate and a second surface; and it asserts that a plaque's sentence is a
  different *kind of content* from an NPC's, which ADR-0003's second amendment explicitly denies —
  verification follows **the claim, not the screen it appears on**. A wrong fact on a plaque is exactly as
  wrong as a wrong fact in a Mountie's mouth. Two shapes is two places for the `fact` block to be forgotten,
  and it would be forgotten in the newer one.
- **Make `speaker` optional, defaulting to the quest's giver.** True of all sixty-two shipped lines and
  therefore tempting as a simplification. Refused: it makes absence mean something, which is the shape
  ADR-0024 is about, and it deletes the only field a live region can attribute a line to. The existing
  assertion *"fails a line with no speaker"* is correct and stays green.
- **`expression` becomes optional and the UI draws no portrait when it is absent.** The parent's third
  option. `expression` is already optional, so this is a no-op that leaves `speaker: CharacterId` naming a
  lighthouse untouched; and "no expression therefore no portrait" is a silent inference from a missing field
  — a `guide` line with no expression would stop drawing a portrait it should draw.
- **Weaken the figure prohibition for a single small NPC, a lighthouse keeper, a distant silhouette.** Out of
  scope by instruction and refused on its merits anyway: `assets/style/peggys-cove-level.md` §0 states that
  the reason is not that an unmarked figure would be wrong, it is that *the cheapest way to be sure no figure
  is read as a depiction of anybody is for there to be no figure*. A schema clause is not a reason to spend
  that certainty.

## Consequences

- **Peggy's Cove and the North can hold a quest without drawing anybody.** The giver is the landmark the
  level already places. Neither art document, neither level story's copy rule and no clause of
  `docs/content-review.md` is touched or weakened by this ADR.
- **`giver` and `speaker` lose their brand.** `QuestDocument.giver`, `DialogueLine.speaker` and
  `Quest.giver` become `string`, matching `targetId`, which already made this trade for this reason. The cost
  is real and is stated: the type system will no longer catch a `PoiId` passed where a giver is expected,
  because that is now legal, and it will no longer catch a `QuestionId` either, because a brand cannot be
  half-removed. The gate in §7 is what replaces it, and it checks something the brand never could — that the
  id resolves to a thing on the level.
- **A fact can now be taught by a thing rather than by a person, and `fact` reaches it unchanged.** A plaque
  that says "The Northwest Territories, Nunavut and Yukon are Canada's three northern territories" carries
  the same `factClaim`, goes to the same verifier, and is quarantined by the same hash drift. Nothing about
  ADR-0003 moves.
- **Two levels stop being the levels with no quest, and one defect they were propping up gets smaller.**
  `OQ-DONE-1` — the completion-card heading written for a level with a quest — was reported against five
  levels. This does not fix it; it removes two of its instances' *cause*.
- **The eight existing quests are unchanged, byte for byte.** The widening is type-only on the schema side,
  so nothing migrates and no meaning moves. That was a design constraint, not a happy result: a notation
  change here would have been a nine-file commit crossing `content/`, `app/bootstrap/` and `tests/`, and a
  boundary change that forces three layers to move together is a boundary change worth re-deriving.
- **`app/bootstrap/quest.ts` cannot yet name a landmark giver, and refuses rather than guessing.** It builds
  the copy key `npc.<giver>.name`; for `peggys-point-light` there is no such row, so `canEngage` returns
  false and the console says why. That is fail-closed and it is also *not enough*: the first authored
  landmark quest will not open until the name resolution reads the level's POI. Held as an obligation below,
  not as a sentence in a paragraph.
- **The gate is the expensive half and it is deliberately narrow.** It is a contract test, not a change to
  `scripts/validate-content.mjs`, for the reason ADR-0024 §4 gives: this is a claim checked against another
  claim — two documents that must agree — and it needs no corpus walk to be meaningful. It reports the
  number of resolutions it performed so it cannot pass over nothing.
- **The voice rule is unmechanised and this ADR says so rather than implying it.** It joins ADR-0019,
  ADR-0011's clause problem and ADR-0024's own review-held remainder. The set is small and growing, and
  ADR-0024 already flags that a project whose gates are its memory should watch it grow.

## Obligations

- **OBLIGATION due=2026-11-13 owner=engine** — in `app/bootstrap/quest.ts`, resolve a giver's display name
  from the level document when the giver is a point of interest (`pois[].name`) and from
  `content/characters/<id>.json#/name` when it is a character, instead of from the `npc.<id>.name` copy row.
  Until this lands, a quest given by a landmark validates, passes every gate and **cannot be played**: the
  dialog is refused for want of an accessible name. The copy-row path was written when `content/characters/`
  held no documents; it holds two.
- **OBLIGATION due=2026-11-13 owner=content** — `docs/stories/TN-DIALOGUE-what-a-quest-giver-says.md` is
  written throughout as *what a character says*. Add the landmark case, or record that the story's existing
  scenarios are read as applying to both. A story that names only one kind of giver is the sentence this ADR
  removed from the schema, surviving in the document that specifies the screen.

## References

- `CLAUDE.md`, Traversal (*"tap NPC or POI to engage"*) and Scope (*"slices are engineering practice, never
  a scope cut"*)
- ADR-0003, and its second amendment: verification follows the claim, not the screen
- ADR-0007: the schema is the port contract; a property is a two-file change, schema then port
- ADR-0010: where player-facing text lives, and the unheld speaker-resolution obligation this closes
- ADR-0024: an empty collection must not reduce to a pass, §1 (identity element) and §2 (where a floor goes)
- `docs/content-review.md` §1, §10.2, §10.3
- `assets/style/peggys-cove-level.md` §0, `assets/style/the-north-level.md` §0 — unchanged by this ADR
- `docs/stories/TN-LEVEL-peggys-cove.md`, `docs/stories/TN-LEVEL-the-north.md` — unchanged by this ADR
