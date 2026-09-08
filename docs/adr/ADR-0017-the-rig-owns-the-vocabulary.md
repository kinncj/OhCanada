# ADR-0017: The rig owns the character vocabulary, and slot independence is checked rather than promised

- Status: Accepted (2026-09-08)
- **This ADR is late.** ADR-0009's discipline is that the decision is written before the code, and here
  `content/schemas/rig.schema.json` and `tests/unit/contracts/rig-is-coherent.test.ts` were written first, in
  a session that was cut off before the record was. Both files reference `ADR-0017` and for a while it did
  not exist — a dangling reference, which is the same class of defect as the dead schema path in
  `SECURITY.md` that a gate caught two sessions ago. Recorded rather than smoothed over, and §6 adds the gate
  that would have caught it.

## Context

Task 1.11 needs a rig contract. The art agent shipped one as prose (`assets/style/rig-contract.md`) and as
data (`assets/style/rig-contract.json`): 50 atlas frames, 20 parts, 8 animation states, 9 state-machine
inputs, 7 slots. It then asked for a schema, and made the argument in the terms this project uses:

> a contract test that loads a malformed rig JSON, finds no inputs, and checks none of them would report a
> pass

That is exactly right and it is the whole reason the schema is worth writing. Task 1.11's acceptance is *"a
contract test loads each rig and asserts the declared inputs exist"*. Run against an unvalidated document,
that acceptance is satisfied by a file with **no inputs at all** — the anti-vacuum failure ADR-0014 exists to
close, arriving in a new place. It also removed every `$schema` path from its documents rather than naming a
file that did not exist, and listed the **constraints** rather than the field names, on the ground that the
constraints are the part that matters. Both were the right calls and both are honoured below.

There is a second thing in the request that is larger than a schema, and it took reading
`character.schema.json` beside the rig to see it. **The same facts are declared in two schemas, in two
shapes, under two different key names.** `character.schema.json` already declares `slots[]` with
`name`/`options`/`fallback`/`playerSelectable`, and `inputs[]` with `name`/`kind`. The rig declares `slots{}`
keyed by name, and `stateMachine.inputs[]` with `name`/`type`. `kind` and `type` are the same field. So today
a character document can declare a slot option the rig has no frame for, and nothing notices.

That is a boundary defect and naming it is the point of this ADR, not the schema.

## Decision

### 1. The rig owns the vocabulary; a character selects from it

- **`rig.schema.json` is the authority** on what parts exist, what states exist, what inputs exist, what slots
  exist and what options each slot offers.
- **`character.schema.json` describes one character choosing from that vocabulary** — which artboard, which
  state machine, which slots it exposes, plus the cultural-review fields that are a character's alone.

The two are not merged and the character document is not changed in this ADR. `content/characters/` does not
exist yet, and rewriting a schema whose documents have not been written is how a design gets re-derived under
pressure. What is decided is the **direction**: the vocabulary has one home, and it is the rig.

### 2. `hairShape` and `hairColour` are two slots, and the schema requires both by name

`rigSlots` names its seven slots explicitly with `additionalProperties: false` and all seven `required`. That
is not tidiness. `docs/content-review.md` §8.2 makes **slot independence** the anti-caricature check — every
option in every slot available with every option in every other — and the failure mode is a **merge**: one
`hair` slot of twenty combined options in which *"the coily one only in black"* is invisible.

Two separate slots make that coupling expressible only as a missing frame, and a missing frame is checkable.
The contract test asserts the product directly: every hair shape must resolve to a frame in every hair
colour. Merging the slots is now a schema edit, which is a visible one.

### 3. A reserved slot has zero options and a null fallback

`presentation` exists as a **name** so the Rive file and the atlas agree, and `OQ-ART-08` (the officer's
gender presentation) is open. `status: "reserved"` requires `options: []`, `fallback: null` and a
`blockedBy` naming the open question. Filling the slot means *removing* `status`, which is a deliberate edit
to the contract rather than one more entry in a list.

`blockedBy` is required because a slot reserved for no stated reason is one nobody can ever decide to open.

### 4. What the schema holds and what the test holds

This is ADR-0007's division, applied honestly rather than by wishing:

| In the schema | In `rig-is-coherent.test.ts` |
|---|---|
| shapes, enums, `additionalProperties: false` | `heightPx / headPx === heightHeads` |
| a `number` input carries `min`/`max` | input names unique |
| a `bool` carries a boolean `fallback`, no range | a slot's `fallback` is one of its own `options` |
| **a `trigger` carries no `fallback`** | `parts[].z` is a dense 1…n permutation |
| a `reserved` slot: zero options, null fallback, `blockedBy` | every `{brace}` names a declared slot or `expression` |
| `t` within 0…1, `loop` ∈ `loop\|once\|hold` | `t` ascending, first 0, last 1 |
| pivot is a 2-tuple, a transform is a 3-tuple | selector states are keys of `states` |
| | keyframes animate only declared parts |
| | frame keys start with `atlas.framePrefix` |
| | `expressions.fallback` ∈ `names`; artboard skins/slots exist |

The trigger rule deserves its line. **A trigger is an event; it has no resting value, so a `fallback` on one
is meaningless** — and it is the easy mistake, because the two neighbouring input types both require one.
It was reachable in prose and is unreachable in the schema.

**A rig that satisfies one half and fails the other is a broken rig.** Neither half is the contract alone,
which is why the schema's own `description` says so rather than leaving a reader to find the test.

### 5. The rig document is not read by the application, and the condition that reverses that

`rig.schema.json` is added to `SKIPPED_SCHEMAS` in `ports-match-schemas.test.ts`: no mirroring port types.
Nothing under `app/` opens the rig document. Both renderers read their vocabulary from
`content/characters/<id>.json` through `CharacterRendererSpec` — the Rive backend because the `.riv` file
carries its own animation, the sprite backend because it probes the atlas.

> **Correction, 2026-09-08.** This paragraph originally said "the only character renderer that exists is
> `app/adapters/rive/character-renderer.ts`". The sprite fallback landed in `3c5a6e4`, before this ADR was
> written; the sentence was stale when it was published. The skip's *conclusion* is unaffected — neither
> renderer opens the rig document — but the reasoning given for it was a headcount, and a headcount is the
> kind of justification that expires without anyone noticing. What the skip actually rests on is what the
> renderers **read**, which is what the corrected text says.

Stated so it is not left to be noticed: **if a renderer ever reads this document at runtime to draw from —
its `parts`, `z`-order, `states`, `frames` and `selector` are exactly what a sprite adapter drawing the
shipped 50-part atlas would need — then it is a document the application reads, ADR-0007 applies, and the
skip is deleted.** Engine reports that condition is close: drawing the atlas from the rig rather than
re-deriving it is the natural next step, and it would make this document runtime content. When it does,
deleting the skip is not optional and it takes seventeen `$defs` with it.

That skip forced a second decision. The skip was strictly root-only, because a file-level skip once hid
`common.schema.json`'s `$defs` and those are the shapes every document shares — a real defect, correctly
fixed. But the fix was right about the hazard and wrong about the boundary: what makes a `$def` dangerous to
hide is not that its own file is skipped, it is that **a non-skipped schema reaches it**. So the skip now
cascades to a file's `$defs` only where no live schema `$ref`s them. `common.schema.json`'s defs stay bound —
asserted by a test, because the defect this could reopen has happened before — and `rig.schema.json`'s
seventeen self-contained defs are covered by their root's reason instead of repeating it seventeen times.
The cascade is better than a list in the way that matters: if a runtime schema later `$ref`s into a skipped
file, that def becomes bound **automatically** rather than depending on somebody deleting an entry.

### 6. A dangling ADR reference is a build failure

This ADR was referenced by two files before it existed. `tests/unit/contracts/documents-name-real-schemas.test.ts`
already refused a dead `content/schemas/*.schema.json` path; it now also refuses a reference to an
`ADR-NNNN` with no file in `docs/adr/`, and it reads **`.json` string values as well as Markdown** — see
ADR-0018, which records that widening and the blind spot that prompted it.

### 7. The rig's home is `content/characters/rig.json`

CLAUDE.md puts characters under `content/`. The file is authored under `assets/` because `assets/**` is the
art agent's boundary and `content/**` is not, so the move is a copy with no key changes. Until it moves, the
contract test reads **one** path, `assets/style/rig-contract.json` — deliberately not a two-path fallback: two
live paths for one document is precisely the drift the art bible's own open-question table exists to catch,
and a gate that reads whichever it finds cannot tell you which one is stale.

- **OBLIGATION due=2026-11-08 owner=content** — copy `assets/style/rig-contract.json` to
  `content/characters/rig.json` with `"$schema": "./../schemas/rig.schema.json"` added and no other key
  change, delete the original, and update `RIG_FILE` in `tests/unit/contracts/rig-is-coherent.test.ts`. Until
  then the rig is validated where it sits and `make validate-content` does not see it, because that gate
  walks `content/`.

## Alternatives considered

- **Merge the rig into `character.schema.json`.** One document, no overlap. Rejected: the rig is *shared* —
  one skeleton, 20 parts, 8 states, 50 frames, identical for every character — and inlining it per character
  would copy several thousand numbers per file and make "cartoon proportions are identical for all
  characters" a convention rather than a fact. That sentence is an anti-caricature rule
  (`docs/content-review.md`), and a rule held by copy-paste is not held.
- **Leave the overlap and let both schemas declare slots.** The status quo, and it is what happens if nobody
  decides. Rejected: it is a boundary defect with a live consequence — a character can name an option the rig
  has no frame for, and the failure is a part that silently draws nothing, which is indistinguishable from a
  deliberate "none".
- **Rewrite `character.schema.json` now to reference the rig.** The right end state and the wrong time.
  `content/characters/` has no documents, so the shape would be designed against nothing, and the character
  document's own fields (`indigenous`, `nation`, `nationSource`, `communityReview`) are under active review.
  The direction is decided here; the edit waits for a document to edit against.
- **Free-form slot names in the rig, validated only by the contract test.** More flexible, and it gives up
  the one thing worth having. `hairShape`/`hairColour` separate is the anti-caricature mechanism, and a rule
  that lives only in a test is a rule an author meets after writing the wrong thing. In a schema it is a rule
  they cannot write.
- **Put every constraint in the contract test and make the schema a formality.** Rejected: `make
  validate-content` is what a content author runs, and a shape error should be reported there, in the tool
  built for it, not in a unit-test run.
- **Put every constraint in the schema.** Not possible. JSON Schema cannot compare a value with a sibling, so
  the head-proportion identity, the dense z-order and the brace check have no expression in it. Pretending
  otherwise is how a schema gets trusted for something it never checked.
- **Generate the schema from the rig document.** Rejected for ADR-0013's reason: a generated schema is an
  artefact of the thing it validates, so it agrees with it by construction and measures nothing.
- **Give the rig port types now, in case a sprite adapter needs them.** Rejected on ADR-0008: a port is not
  written before a named task will call it, and this would be seventeen interfaces mirroring several thousand
  numbers for a consumer that does not exist. §5 records the condition that reverses it.

## Consequences

- **The rig is now a build failure surface.** Editing art means keeping `parts`, `states`, `frames` and
  `slots` coherent with each other, and the test names which one broke. That cost is the point: every one of
  those constraints was previously prose that an author could satisfy approximately.
- **Slot independence is mechanical.** `docs/content-review.md` §8.2 called it the anti-caricature check and
  nothing checked it. A hair shape that ships in only some colours now fails a build.
- **Both halves were seen to fail before being trusted.** Eighteen mutations against the schema through real
  ajv — a `trigger` given a `fallback`, a `number` stripped of its range, a reserved slot given an option or
  a fallback or no `blockedBy`, `hairColour` merged away, an eighth slot invented, a live slot emptied, an
  invented loop mode, `t` out of range, a 2-number transform, a 3-number pivot, an unknown root property —
  every one rejected, and a *properly opened* reserved slot accepted, which is the branch that proves the
  mechanism is a gate on quiet filling and not a lock. Nine mutations against the document — the head
  proportion, a z gap, an unknown brace, a deleted hair frame, a selector naming a missing state, a
  non-ascending `t`, a keyframe naming a missing part, a frame key without the prefix, a duplicated input
  name — each failed exactly one test.
- **`SKIPPED_DEFS` shrank by seven entries** and gained a test that reports a redundant one. A redundant
  exemption is not harmless: it reads as a decision protecting something, so a reader trusts it, and it goes
  on reading that way on the day the cascade stops covering the def and the entry becomes the only thing
  hiding a real binding.
- **`make validate-content` does not yet see the rig**, because that gate walks `content/` and the file is
  under `assets/`. Until the obligation in §7 is discharged, the rig is checked by `make test` alone. That is
  a real gap and it is why the obligation has a date.
- **Nothing here checks the art.** That every expression differs in the *shape* of brow, pupil and mouth so
  it survives greyscale and the plain Canvas tier (ADR-0011) is art review's, and no gate substitutes for it.
