# ADR-0026: Progress lives in IndexedDB, and localStorage is the store it came from

- Status: Accepted (2026-09-08)
- Supersedes: the **Storage** row of CLAUDE.md's decision table — "Local only: `localStorage` + JSON
  export/import. No accounts, no server, no analytics." Everything after the first clause still holds
  exactly as written: local only, no accounts, no server, no analytics, export and import as a file. What
  changes is the store.

## Context

`localStorage` was the right first choice and it has three properties that get worse as the game gets bigger.

**It is synchronous, and this is a game.** Every `getItem`/`setItem` blocks the main thread until the browser
has read or written the value — on the same thread that has 16.7 ms to produce a frame at the medium preset
(CLAUDE.md, Budgets). TN-SAVE-03 saves at named moments — a question answered, a quest step completed, a
level left — which are exactly the moments something is animating. The cost is small today because the
document is small; it is a cost that scales with the save and lands on the frame.

**It is a string store with a small quota.** Roughly 5 MB per origin in most browsers, shared with everything
else the origin keeps there, and it is *characters*, not bytes: a save full of accented French is closer to
its limit than its `length` suggests. The save that has to fit is not the one we have now. FSRS keeps a
`ReviewStateDocument` per question — ten subjects, ≥ 30 verified questions each, plus exam attempts — and
that history only grows, because the whole point of spaced repetition is that it remembers. IndexedDB's quota
is a share of free disk, typically hundreds of megabytes or more. This is the reason with the longest
horizon: the review history is the one part of the save with no natural ceiling.

**It has no structure, so every read reparses everything.** One key, one string, `JSON.parse` on the whole
document to answer any question about it. IndexedDB stores records, so a later slice can split the review
history from the settings and stop reading a hundred kilobytes of scheduling state to find out whether
subtitles are on. That is a *future* saving and is deliberately not banked here — see "What this does not
do".

And there is a fourth reason that is not about `localStorage` at all: `ProgressRepository` has always been
asynchronous (`Promise<Result<…>>`), because it was designed for a store that might not be synchronous. The
port does not change. That is the seam doing its job.

## Decision

**Progress and settings are stored in IndexedDB, behind the existing `ProgressRepository` port.
`localStorage` remains as the fallback where IndexedDB is unavailable, and as the store an existing save is
carried out of.**

Four rules, and each exists because of a specific way a save is lost.

### 1. The fallback is a real path, not a comment

IndexedDB is *not* universally available. Firefox in a private window opens the database and fires `error`;
older Safari in a private window **throws synchronously** from `open()`; an origin with site data blocked
throws on the property access itself, before any method is called. `browserIndexedDb()` and
`openIndexedDbRecordStore()` handle all three and answer `null` — one answer, because the caller does the
same thing with all of them: fall back to `localStorage`. TN-SAVE-05's storage warning is raised only when
*neither* store will have us, and even then the game runs.

This is the clause most likely to be written and never executed, so it is tested from the outside:
`progress-store.test.ts` opens the store against a fake whose `open` errors, against one whose `open` throws,
and against a browser with neither store, and asserts a game is still saved and loaded in the first two and
that every call is a `Result` error in the third.

### 2. The migration verifies before it destroys

An existing player's save is in `localStorage` under `truenorth.progress`. On first boot of this build:

1. read the legacy value — **the bytes, not the parsed document**;
2. if IndexedDB already holds a save, keep it and leave the old copy alone;
3. otherwise write the bytes to IndexedDB;
4. **read them back and compare them to what was written**;
5. only if they match, remove the original.

A failure at any step leaves the original exactly where it was and reports `migration.status === 'failed'`.
The bytes are copied verbatim and are *not* validated on the way across, on purpose: a corrupt legacy value
is still the player's, TN-SAVE-04 promises them the choice of downloading it, and a migration that dropped
what it could not parse would take that choice away before anyone was asked. Validation happens on `load`,
where it always did.

### 3. An unreadable store is not an empty one (ADR-0024)

This is the vacuity trap, in the place where it costs the most.

`read` answers `ok(null)` **only** when the key is genuinely absent. A store that would not answer — the
property access threw, the transaction aborted, the read errored — is an `io` error and stays one. The two
are indistinguishable to a caller that treats "no value" as "new player", and that caller offers a fresh
game over the top of a real one.

The rule extends across the two stores: if reading `localStorage` *threw* during migration, we do not know
whether a save is there, so an empty IndexedDB in the same session must not be reported as "no save yet"
either. `openProgressStore` wraps the repository so that an empty read returns
`save.migration.legacyUnreadable` instead of `ok(null)` until something has been written. The proof is a test
that makes the legacy store **throw**, not one that leaves it empty — an empty store proves nothing, because
it reads as a new player by being one.

### 4. Deleting progress deletes it in both stores

"Delete my progress" clears IndexedDB *and* `localStorage`, and attempts the second even when the first
fails. A copy left behind in the store that still works comes back on the next boot, which is the worst
possible shape of this bug.

### And one thing that came with it: `holdToChooseMs`

`TN-SET-09`'s single-switch hold time had **no field in `progress.schema.json`**, so a switch user who set a
two-second hold re-entered it every session — the one accessibility setting the game asked to be typed
again. It is now a saved property.

That is a **format change**, not a small addition: `progress.schema.json` is `additionalProperties: false`
with every declared property required, so a version-1 document is invalid against the version-2 schema.
Making the property optional instead would have made both documents valid and left every reader guessing
which it had, which is how a half-loaded save starts. So the save format is version 2, the first real
`SaveMigration` (1 → 2) fires the tripwire that
`tests/unit/contracts/save-format-version-is-still-one.test.ts` existed to fire, and the three things that
test demanded have landed: the migration wired in from the composition root, a test that decodes a genuine
version-1 document and asserts every review, quest and stamp survives, and the amendment to ADR-0015. The
hold time a version-1 player had chosen is genuinely lost — it was never written down — and
`save-migrations.ts` says so rather than claiming to restore it.

## What this costs, said plainly

- **Everything that reads progress is asynchronous.** The port already was, so no signature changed, but the
  boot now waits on a real round trip to the browser's storage thread instead of one microtask. It is spent
  once, before the first frame, and it buys the opposite saving: every save *after* it stops blocking the
  main thread.
- **IndexedDB can be evicted.** Under storage pressure a browser may discard a best-effort origin's data;
  `localStorage` is evicted under the same pressure but is cleared less eagerly in some engines. We do not
  yet ask for persistent storage — see the obligation below.
- **It is unavailable or throws in some private-browsing modes.** Hence rule 1, and hence the fallback being
  tested rather than assumed.
- **There is more machinery.** An event-driven API translated into promises, a fake IndexedDB in the test
  support, a `RecordStore` seam, and a composition step that did not exist. Against that: the repository
  rules are now written **once** and shared by both backends, so "IndexedDB behaves differently from
  localStorage" can only be true in the two small files where the backends actually differ.
- **A second save format version exists**, so the migration list is now load-bearing and every future format
  change has to keep it working. That is a cost the first migration always pays and the second one never
  does.
- **A hang in `open()` is not defended against.** A browser whose `open` neither succeeds nor errors would
  leave the boot waiting. Defending it needs a timer; a bare `setTimeout` inside an adapter that is otherwise
  a pure translation would be an unported dependency, and no browser is known to do this. If one is found,
  the fix is a `Clock`-shaped port passed in, not a bare timer.

## What this does not do

- **It does not split the save into records.** One record, one key, the same JSON string the codec already
  produced. The quota and the main thread are the reasons for this change; "IndexedDB can index things" is a
  capability we are not using yet, and building a schema of object stores to hold one document would be
  paying today for a query nobody has written. The seam that makes it possible later is `RecordStore`.
- **It does not change the export/import format.** A save file is the same bytes it was, and a file exported
  by the previous build still imports — through the migration.
- **It does not touch the UI.** Which screen offers the download, and what a player is told when an import is
  refused, is `app/ui`'s; every failure here carries a distinct, greppable `code` for a screen to map to
  copy (ADR-0010).

## Alternatives considered

- **Stay on `localStorage` and compress the save.** Buys one constant factor against a review history that
  grows without bound, costs a compression dependency on the initial payload, and makes the stored value
  unreadable to a person — which `progress.schema.json`'s `$schema` property exists to prevent.
- **Move to the Origin Private File System / `navigator.storage`.** More capable, less supported, and it
  answers a question we do not have: this save is a document, not a file tree.
- **Write to both stores on every save.** Tempting as belt and braces, and it keeps the small quota as the
  binding constraint while doubling the main-thread cost of every write — the precise thing this ADR is
  removing. The dual write happens **once**, during migration, where it buys the verification.
- **Make `holdToChooseMs` optional instead of bumping the format version.** Rejected in §"And one thing that
  came with it": it makes two document shapes valid at once and pushes the guessing into every reader.
- **Migrate lazily, on first save, rather than at boot.** Would leave the save in `localStorage` for a player
  who reads but never writes, and "the store the save is in depends on what the player did" is a state nobody
  can reason about at three in the morning.

## Consequences

- `app/adapters/persistence` is now six small modules instead of two: the two browser APIs, one `RecordStore`
  seam, the shared repository, and the composition that chooses. `createLocalStorageProgressRepository` keeps
  its name and its behaviour and is now a delegation, so nothing above it moved.
- **CLAUDE.md's decision table is out of date until its owner amends it.** This ADR supersedes the Storage
  row; agents do not edit CLAUDE.md. The row should read: *"Local only: IndexedDB, with `localStorage` as the
  fallback, plus JSON export/import. No accounts, no server, no analytics (ADR-0026)."*
- `docs/architecture.md` and any runbook step that says "the save is one `localStorage` key" now needs
  "IndexedDB, or one `localStorage` key where IndexedDB is unavailable". The key name did not change.
- The e2e and a11y suites run in a real browser with a real IndexedDB. TN-SAVE-05's private-window path is
  covered here by fakes, and a browser-level check of the fallback would be worth having where a real private
  context can be opened.
- **A save can now be evicted rather than only refused.** Nothing in the game reacts to eviction beyond
  reading it as "no save"; that is correct today and would not be if the game ever claimed the save was
  permanent.

- **OBLIGATION due=2026-12-08 owner=persistence** — decide whether TrueNorth asks for persistent storage.
  `navigator.storage.persist()` moves an origin from best-effort to persistent and materially changes whether
  a passport survives disk pressure, but in some browsers it prompts, and a prompt on the first screen is an
  accessibility and tone decision, not a storage one. Either wire it (behind a port, at a moment the player
  is not mid-task) or record here why the game accepts best-effort storage. Do not leave it decided by
  omission, which is what it is decided by today.
