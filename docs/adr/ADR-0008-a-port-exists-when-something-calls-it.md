# ADR-0008: A port exists when something calls it

- Status: Accepted (2026-09-08)
- Amended 2026-09-08: two things this ADR left implicit and that both bit within one slice. The marker has an
  **exact form** — `PROVISIONAL (ADR-0008)` — because the gate was matching the bare word and so failed on a
  file whose author had correctly removed the marker and written a sentence saying so. And "the marker comes
  off in the same change that adds the first consumer" assumed the implementer can edit the port, which is
  usually false: `app/application/ports/**` is the architect's. See "The form of the marker" and "Who removes
  it".
- Amended 2026-09-08 (second): the gate reads import edges, so the finest thing it can see is a file.
  `Clock.nowIso()` was a *member* with no caller inside a file that is correctly consumed and correctly
  unmarked, and the gate was silent about it — correctly, by its own definition. **ADR-0015 extends this
  rule below the file** (prune what has no caller; tripwire what cannot be pruned) and records why no
  member-level checker is being built. This ADR's gate is unchanged.

## Context
`app/application/ports/` is 1,297 lines across eleven files. Three exported types are consumed by anything:
`GameConfigDocument`, `FeatureFlags` and `ThemeColours`, all read by `app/adapters/phaser/boot-config.ts`.
The other nine files — `audio.ts`, `character-renderer.ts`, `clock.ts`, `input.ts`, `localizer.ts`,
`locomotion.ts`, `progress-repository.ts`, `random-source.ts`, `save-codec.ts` — have no consumer, no
implementation, and nothing marking them as untried.

Slice 0 says in writing: "Explicitly not in this slice. Gameplay, art, questions, Rive, audio, scheduler."
`audio.ts` nonetheless declares a four-bus model with ducking curves, crossfades and an autoplay-unlock
handshake. `locomotion.ts` declares an eight-mode strategy contract, a tuning record of eleven fields, and
six event kinds. Both were designed before a single implementation existed, so both are probably wrong in
detail — and both sit in `app/application/ports`, a directory whose whole purpose is to say "this is the
contract". A reader cannot tell the two apart: `GameConfigDocument`, which an adapter compiles against and a
contract test pins to a schema, and `AudioPort`, which nothing has ever satisfied, are the same kind of
declaration in the same directory.

ADR-0007 has a rule for half of this — "a port type with no schema behind it is marked `SPECULATIVE`" — but
that rule is about *content documents* and their validator. It says nothing about a behavioural seam like
`Clock` or `AudioPort`, which will never have a schema and whose problem is different: not "nothing validates
this shape" but "nothing has ever implemented this interface". Only `content-repository.ts` carried any
marker at all, and `locomotion.ts:13` made the situation worse by asserting "the content schema mirrors it"
about a `level.schema.json` that does not exist.

## Decision
- **A port file with no consumer under `app/` carries `PROVISIONAL` in its header comment**, naming the
  slice task that will give it one. `PROVISIONAL` means: no implementation exists, this shape has never been
  compiled against a real caller, and the first implementer may change it without an ADR. It is a design
  sketch that happens to be type-checked, not a contract.
- **The marker comes off when the first consumer lands.** A port that is consumed and still marked, or
  unconsumed and unmarked, fails `make test` — see the enforcement bullet below.

### The form of the marker

The marker is the literal string **`PROVISIONAL (ADR-0008)`**, not the bare word. The gate matches that form.

This is not pedantry, it is a defect that already happened. The check was a substring search for
`PROVISIONAL`, and the first time an implementer retired a marker properly they wrote the sentence a careful
person writes — "the ADR-0008 PROVISIONAL marker is gone because the first call site landed with that task" —
which contains the word. The gate reported the file as still marked. A check that fires on prose *about* the
marker punishes explaining yourself, and the lesson a contributor takes from it is to stop explaining
themselves, which is the opposite of what this ADR wants. Requiring the form lets a port say what happened to
its own marker.

Writing the bare word and expecting it to count fails in the safe direction: the port then reports as
unconsumed *and* unmarked, and that message names the form to use.

### Who removes it

The first implementer is usually not allowed to. `app/application/ports/**` belongs to the architect, so a
port's marker outlives its first consumer by however long it takes to route the edit — and in the meantime
`make test` is red for everyone on a defect nobody in the failing change can fix.

That is a genuine boundary defect and it is named rather than smoothed over. **The resolution is that marker
removal is not a design change and does not need the architect's judgement** — the gate has already decided
it, by finding a consumer. An implementer landing a first call site deletes the marker line in the same
change; the ownership rule protects the *shape* of a port, and a marker is not part of the shape. If a port's
shape needs changing too, that is a different edit and it does route through the architect.
- **A port is not written before a named task in the current or next slice will call it.** A seam with no task
  is a design note; it belongs in `docs/architecture.md`, which is where the target architecture is allowed to
  describe things that do not exist. This is the rule that stops the directory growing another nine files.
- `PROVISIONAL` (this ADR) and `SPECULATIVE` (ADR-0007) are different claims and can coexist in one file.
  `SPECULATIVE` is about a *type* and answers "does a validator back this shape?". `PROVISIONAL` is about a
  *file* and answers "has anything ever implemented or called this?". `content-repository.ts` is consumed, so
  it is not `PROVISIONAL`, and most of its types are `SPECULATIVE`. `locomotion.ts` is both.
- A test is not a consumer. A port imported only by `tests/**` is still `PROVISIONAL`: a test written against
  an interface that no production code uses tests the interface against itself.

## Alternatives considered
- **Delete every port with no consumer.** The cleanest-sounding answer, and it is what the reviewer offered
  as the other half of the choice. Rejected as the general rule because eight of the nine are named by a
  slice-1 task that starts within days (`Clock` and `RandomSource` for 1.4, `ProgressRepository` and
  `SaveCodec` for 1.6, `ICharacterRenderer` for 1.11/1.12, `Locomotion` for 1.14, `LocalizerPort` and
  `InputPort` for 1.15), and `docs/architecture.md` §5 documents all nine as the seams of the target design.
  Deleting them would delete the design and then re-derive it under slice-1 time pressure, which is exactly
  the failure mode "Seams deliberately left open" was written to prevent. The defect being fixed here is
  false authority, not existence, and a marker plus a gate removes the authority precisely.
- **Delete `audio.ts` specifically** — the one file with no consumer *and* no slice-1 task. Genuinely
  tempting, and it is the most speculative file in the directory. Rejected, narrowly: `docs/architecture.md`
  already depends on it in two places (the port table and the level-unload sequence, where
  `AudioPort.unload(levelId)` is a step in how the 64 MB texture budget is honoured), so deleting the file
  trades a marker-shaped inconsistency for a document-shaped one and costs an architecture amendment now plus
  a re-derivation in slice 2. The marker states the same fact — untried, will change — for one line. If audio
  has still not been implemented when slice 2 closes, delete it then; the marker names no task, so it is the
  visibly weakest entry in the directory.
- **Reuse `SPECULATIVE` for both conditions.** Rejected: one word for two different failures makes the marker
  mean "unfinished, somehow", which tells a reader nothing about what would make it finished. `AudioPort` will
  never have a schema; `QuestionDocument` will never have an implementation. The remedies are different.
- **Rely on review, as ADR-0007 does for `SPECULATIVE`.** Rejected: that is the status quo, and it is what
  produced nine unmarked files inside one slice. A staff reviewer found it; nothing in CI did.
- **Move the unimplemented ports to a `docs/` sketch directory.** Rejected: the value of a port written early
  is that the compiler checks it against the first implementation on day one. Prose cannot fail a build.

## Consequences
- Nine files gain a `PROVISIONAL` header naming the task that will retire the marker. The count is a
  reportable number: it should fall to zero across slice 1 for eight of them, and `audio.ts` is the one that
  will still be marked at the end of it.
- Enforced by `tests/unit/contracts/ports-are-provisional.test.ts`, which is in `make test` and therefore a
  required check. Its three failure directions were each demonstrated on a real mutation before it was
  trusted: a consumed port that re-adds the marker, an unconsumed port whose marker is downgraded to the bare
  word, and an unconsumed port whose marker is deleted — all three reported, with the corrected
  `locomotion.ts` prose about its own retired marker staying green. It reads every `import` in `app/**` outside the ports directory, resolves the imported
  names back through `app/application/ports/index.ts` to the file that declares them, and asserts marker
  present if and only if consumer absent. Both directions fail: a new port added without a caller and without
  a marker fails, and a marker left behind after the first caller lands fails too. Nothing is listed, so a
  port written in a later slice is covered without editing the test.
- Writing a port "to get ahead" now costs a marker and a task reference. That friction is the point.
- The reverse risk is real and accepted: a port marked `PROVISIONAL` invites less review than one that is not,
  and a bad seam can survive to its first implementation. The mitigation is that the first implementer is
  explicitly allowed to change it, which is the opposite of what an unmarked port implies today.
- `docs/architecture.md` §5 gains the marker state per port, so the port table and the files agree.
