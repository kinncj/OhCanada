# ADR-0015: The "no caller" rule extends below the file — prune it, or tripwire it

- Status: Accepted (2026-09-08)

## Context

ADR-0008 says a port exists when something calls it, and
`tests/unit/contracts/ports-are-provisional.test.ts` enforces it **per file**: a port file with no consumer
carries `PROVISIONAL (ADR-0008)`, a port file with a consumer does not. That gate reads import edges, and an
import edge is the finest thing it can see. Slice 1 produced two things it cannot see, and they need
different answers.

**`Clock.nowIso()` has no caller.** `clock.ts` is consumed — `StartQuest`, `AnswerQuestion`,
`ScheduleReview` and `SaveProgress` all hold the port — so the file is correctly unmarked and the gate is
correctly silent. But `SaveProgress` uses `clock.now()` and converts through
`app/application/persistence/iso-instant.ts`. Nothing in `app/**` calls `nowIso()`. Its only implementation
anywhere is `tests/unit/support/fixtures.ts`:

```ts
nowIso: () => new Date(current).toISOString() as IsoInstant,
```

which is a **second, unpinned `EpochMillis` → `IsoInstant` conversion**, competing with the one
`iso-instant.ts` writes out and pins against `Date` and `ajv-formats` (ADR-0014). Two conversions exist and
only one is checked. The port header was updated to instruct implementers to call `toIsoInstant(now())`
instead of writing their own — which is honest, and is also the argument against the method: a member
defined as `f(otherMember())` is not a seam, it is a helper on the wrong object.

ADR-0012 asserted "`Clock` already offers both ends (`now`, `nowIso`), so the conversion has a home and it is
not the domain's". The first half of that sentence stopped being how the code works when `iso-instant.ts`
landed. The conversion does have a home; the home is a pure function in the application layer, not a method
on a port every adapter must implement.

**`SaveMigration` is a mechanism with no steps.** `json-save-codec.ts` exports the interface, `decode` runs
`migrateForward`, and the list is empty because version 1 is the first version. The loop is exercised only by
a migration a test supplies. This one cannot be pruned: `SaveCodec.decode` promises to accept "this version
and every older one", and the promise needs a mechanism before there is an older one — writing it beside
version 2, under the pressure of an actual format change, is exactly how a save-import path gets a defect.
Its header is already honest ("There are none yet … there is deliberately no placeholder pretending
otherwise"). What is missing is that nothing prevents a reader — or a future agent — from taking the presence
of the mechanism as evidence that migration works.

Both are the same gap: a claim that is true at file granularity and false one level down.

## Decision

**The rule is the same below the file. The remedy depends on whether the thing can be removed.**

### Prune what has no caller and no reason to wait

**`Clock.nowIso()` is removed.** `Clock` is `now(): EpochMillis` and `elapsed(): number`. Code that needs an
`IsoInstant` calls `toIsoInstant(clock.now())`, which is the single conversion, and it is pinned.

This also removes the second conversion from the test fixture, which is the concrete win: there is now
exactly one implementation of that conversion in the repository and it has an oracle.

### Tripwire what cannot be pruned

Where a mechanism must exist before its first real use, it carries a **tripwire test**: an assertion that
fails at the moment the mechanism becomes load-bearing, whose failure message is the instruction.

`tests/unit/contracts/save-format-version-is-still-one.test.ts` asserts
`CURRENT_SAVE_VERSION === MIN_SUPPORTED_SAVE_VERSION === 1`. Today it is a statement of fact. The day
somebody writes version 2, it fails and says what must land with it: a real `SaveMigration` from 1 to 2, a
test that migrates a genuine version-1 document produced by this build's `encode`, and an amendment here. It
cannot be satisfied by deleting the assertion without deleting the instruction with it, which is visible in
review.

A tripwire is not a `PROVISIONAL` marker and does not use that word. `PROVISIONAL` says "nothing has
implemented this yet"; a tripwire says "this is implemented, untried, and here is what must happen the first
time it is tried". The remedies differ, so the vocabulary differs — the same reasoning ADR-0008 used to keep
`PROVISIONAL` and `SPECULATIVE` apart.

### Say plainly what is not mechanised

There is **no member-level equivalent of `ports-are-provisional.test.ts`**, and this ADR does not order one
built. Reasons, in order of weight:

- A member-level check that matched textually on `.nowIso(` would be wrong in both directions: it cannot
  distinguish `renderer.load()` from `repository.load()`, so it produces false negatives on every common verb
  — and a gate with false negatives on the common case is worse than no gate, because its silence reads as
  coverage.
- Doing it correctly needs a full TypeScript program with a type checker resolving every property access back
  to its declaration. That is buildable, and it is a large machine whose whole output today would be
  "`AudioPort` has 30 unused members" — which is true, already stated by that file's `PROVISIONAL` marker,
  and not news.
- The population it would judge is currently seven consumed port files. At that size, review found this case
  and review is proportionate.

This is recorded as a rule enforced by review, not by CI, so nobody later mistakes the absence of a failure
for the absence of dead members. If the ports directory grows past what a reviewer reads in one sitting, or
if a second dead member appears, that trade changes and the checker gets built.

## Alternatives considered

- **Keep `nowIso()` and rely on the header comment telling implementers to call `toIsoInstant(now())`.** The
  status quo, and it is what the domain agent proposed. Rejected on what the comment concedes: if the correct
  implementation of a member is a fixed expression over another member, the member is not a decision an
  implementer makes, so it is not part of the contract. Keeping it costs every future `Clock` implementation
  a line that can be written wrong — and the one existing implementation *did* write it differently, with
  `Date.prototype.toISOString`, which is the divergence the comment was added to prevent and did not.
- **Move the conversion onto `Clock` and delete `toIsoInstant`.** The mirror image, and it fails harder.
  `iso-instant.ts` exists mostly for the *parse* direction, which validates every timestamp in an imported
  save and must mirror `ajv-formats` exactly (`Date.parse` accepts implementation-defined junk). That
  direction has nothing to do with a clock. Splitting a two-way conversion across a port and a module is
  worse than either whole.
- **Give `Clock` a default implementation of `nowIso()`.** Rejected: `Clock` is an `interface`, and turning it
  into a class or a helper factory to host one derived member is a structural change to the seam in service
  of a member with no caller.
- **Delete `SaveMigration` and write migration when version 2 arrives.** Consistent with pruning `nowIso()`,
  and rejected on the asymmetry that makes the two cases different. `nowIso()` has a caller-side substitute
  available today; migration does not — `decode` already promises it, in a port, in the path `SECURITY.md`
  governs. Deleting it would make the port's documented behaviour false in the interval, and would put the
  first migration's design on the critical path of the first format change.
- **Mark `SaveMigration` `PROVISIONAL (ADR-0008)`.** Rejected: the marker means "nothing has ever implemented
  or called this", and `migrateForward` is called on every `decode`. Reusing the marker for "implemented but
  untried" makes it mean "unfinished, somehow", which is exactly what ADR-0008 refused when it declined to
  fold `SPECULATIVE` and `PROVISIONAL` together.
- **Write an `OBLIGATION` (ADR-0009) for the first migration instead of a tripwire.** Rejected: ADR-0009
  requires a real date and forbids "when X exists". Nothing is owed until a format change is wanted, and
  there is no honest date to pick — a date invented to satisfy the format would be re-dated on every run,
  which ADR-0009 itself names as the way obligations are defeated. A tripwire fires on the event rather than
  on the calendar, which is what this actually is.
- **Build the member-level checker now.** Rejected on the trade above, explicitly and reluctantly. If a second
  dead member appears, this decision is reopened.

## Consequences

- **`Clock` is two methods.** Every adapter implementing it writes less, and there is one conversion in the
  repository rather than two. `tests/unit/support/fixtures.ts` loses its `nowIso` line — a mechanical
  consequence of the shape change, not a design change, in the same sense ADR-0008 established for marker
  removal.
- **ADR-0012's sentence "`Clock` already offers both ends (`now`, `nowIso`)" is superseded by this ADR.** The
  decision it was supporting — domain holds `EpochMillis`, the document holds `IsoInstant`, `SaveCodec`
  converts — is unchanged and correct. Only the claim about where the conversion is reachable from changes.
- **A tripwire is a test that exists to fail once.** It will read as strange to whoever hits it, which is why
  its message must be an instruction rather than an assertion. That is a maintenance obligation on the test's
  wording, not on the test.
- ~~**Migration remains untested against a real version change, and now says so in a place that fires.** The
  mechanism is unit-tested with a caller-supplied migration, which proves the loop, the ordering and the
  missing-step failure — and proves nothing about whether a real version-1 document survives a real step.~~
  **Superseded 2026-09-08 — the tripwire fired. See the amendment below.**
- **Dead members in port files are found by review only.** Stated above; repeated here because a consequence
  section is where a reader looks for what is not covered.

## Amendment (2026-09-08): the tripwire fired, and what it taught

Save format version 2 landed with ADR-0026: `settings.holdToChooseMs` became a persisted property, which
under `additionalProperties: false` with every property required is a format change rather than an addition.
`tests/unit/contracts/save-format-version-is-still-one.test.ts` failed, its message was read as the
instruction it was written to be, and it has been deleted. Its three demands landed as
`app/application/persistence/save-migrations.ts`,
`tests/unit/contracts/a-version-1-save-survives-the-first-migration.test.ts`, and this amendment.

Three things the first real migration taught, none of which the tripwire could have known:

1. **The hard part is not the loop; it is the fixture.** The test demanded "a genuine version-1 document
   produced by this build's own `encode`" — and once version 2 exists, this build *cannot* encode version 1.
   The honest fixture is a version-2 document with the **exact inverse of the migration** applied, written
   out in the test where a reader sees it, rather than a hand-written blob that drifts from what the previous
   build actually stored. A future tripwire of this kind should ask for "derived from this build's encode by
   a visible inverse", which is the strongest thing available after the fact.
2. **A migration runs on unvalidated input, and that is where migrations go wrong.** `decode` migrates at
   step 4 and validates at step 5, so a step is handed a document that has been parsed and version-gated and
   nothing more. The rule that fell out of writing one: **return what you do not understand untouched.** A
   step that "repairs" a shape it has not recognised turns a save the player could still download into one
   nobody can read, and the schema check that runs next would have produced a better message.
3. **The migration's honest failure is a real loss, and it must be written down.** A version-1 save cannot
   carry a hold time, so a switch user who had chosen two seconds gets the default. That is unrecoverable —
   the number was never stored — and the temptation is to describe the step as "restoring" the setting. It is
   recorded as a loss in `save-migrations.ts` instead.

The tripwire's own design held up: it fired on the event rather than the calendar, it fired exactly once, and
its message was the whole instruction. The one thing worth copying is that it named the *tests* that had to
land, not just the code.
