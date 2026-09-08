# ADR-0012: The scheduling maths is written out in the domain and pinned to `ts-fsrs` by oracle

- Status: Accepted (2026-09-08)

## Context

Slice 1 task 1.4 asked for a `QuestionScheduler` built on `ts-fsrs` 5.4.2, which `package.json` already
declares. It cannot be built that way, and the domain agent established that by probing rather than
assuming:

```
error domain-is-pure: app/domain/__probe/probe.ts → node_modules/ts-fsrs/dist/index.cjs
error domain-is-pure: app/domain/__probe/probe.ts → app/application/ports/clock.ts
```

`domain-is-pure` is `from: '^app/domain'`, `to: { pathNot: '^(app/domain|common)' }`. An npm package resolves
under `node_modules/`, which is outside both, so **every** package fails it — the rule is not about
frameworks, it is about reach. `application-no-frameworks` says the same thing one layer up. The library is
therefore reachable only from an adapter.

So the repository was in an incoherent state: a plan asking for a library, a config forbidding it in both
places it would be used, and a runtime dependency no permitted code could import. That had to be resolved
deliberately rather than by whichever agent hit it first.

The third option is worth naming because it is the one that would have happened by default. Putting FSRS
behind a port and implementing it in an adapter satisfies every rule and is the wrong answer: it moves the
most correctness-critical and most testable code in the game — spaced repetition, which decides what every
player is asked and when — **outside the ≥ 90 % coverage gate that exists for exactly this kind of code**,
and it invents a port whose only implementation is arithmetic. A seam is for hiding a technology choice. There
is no technology here, only numbers.

## Decision

- **FSRS-6 is written out as pure functions in `app/domain/scheduling/`.** No import, no port, no adapter.
- **`ts-fsrs` 5.4.2 is a test oracle**, not a runtime dependency. `tests/unit/domain/` pins every function in
  the model against the library by **exact equality** — weights, decay, the recall curve, the interval
  modifier, all four grades, and the full state machine over randomised answer sequences. `tests/**` is
  outside `depcruise app common`'s scope, so the oracle is legal precisely where the import is not.
- **`ts-fsrs` moves to `devDependencies`.** A runtime dependency nothing may import is a claim about the
  build that is not true, and it ships weight for nothing.
- **`no-scheduler-library-in-app` is added to `.dependency-cruiser.cjs`**, forbidding `ts-fsrs` anywhere
  under `app/`. `domain-is-pure` and `application-no-frameworks` already close the two layers that would want
  it; this closes the remaining door — an adapter importing it — which is the outcome this ADR rejected. The
  decision is enforced rather than remembered.
- **The domain holds `EpochMillis`; the document holds `IsoInstant`; `SaveCodec` converts.** The domain does
  arithmetic — "is this due", "how many whole days since", "same UTC day" — and epoch milliseconds are the
  type for arithmetic. A save file is exported, pasted between devices and read by a person, and needs a
  value that is sortable, unambiguous about its timezone and legible. `Clock` already offers both ends
  (`now`, `nowIso`), so the conversion has a home and it is not the domain's.

## Alternatives considered

- **Amend `domain-is-pure` with an allowlist for "pure computational packages".** The obvious fix, and
  rejected on the thing that makes it unworkable rather than on taste: dependency-cruiser matches **paths**,
  not properties. An allowlist would name `ts-fsrs`, so it would assert a property — no I/O, no DOM, no
  clock, no global state — that nothing checks and that a minor version can withdraw. `ts-fsrs` is pure
  today; a 5.5 that defaults a parameter to `Date.now()` would pass the allowlist silently and put a wall
  clock inside the layer whose whole definition is that it has none. That is an exemption that looks like a
  property check and measures a name, which is the shape of gate this project has spent a session removing.
  It also asks a future reader to apply a definition of "pure" the config cannot state, and the reader who
  gets it wrong is the one adding the second entry.
- **Put FSRS behind a port, implemented in an adapter.** Satisfies every rule, and is the default outcome if
  nobody decides. Rejected: it moves scheduling arithmetic outside the ≥ 90 % coverage gate and creates a
  seam that hides nothing — see Context. It would also make `Locomotion`'s precedent incoherent, since that
  is explicitly a port whose *implementations live in the domain* for the same reason.
- **Vendor `ts-fsrs`'s source into `app/domain/`.** Keeps the numbers without the import and is a real
  option. Rejected: it copies a licence and a code style into the domain, it is not reviewable as our code,
  and it gives no signal at all when upstream changes — which is the property the oracle exists to provide.
- **Relax the rule to allow `node_modules` type-only imports.** Would not help: the model needs the
  functions, not the types.

## Consequences

- **We own FSRS-6's maths, including its bugs**, and if the algorithm advances we do the work. That is the
  real cost of this decision and it is not small. It is bounded by the oracle, which tells us the day we
  diverge rather than leaving us to find out from a player's review schedule.
- **The upgrade trade is inverted, in our favour.** With an import, bumping `ts-fsrs` silently changes every
  player's schedule and nothing fails. With the oracle, a library upgrade that changes the numbers **fails
  the suite**, and a human decides whether to follow it. Normally vendoring costs you upstream fixes; here it
  converts them from silent to explicit, which for a spaced-repetition schedule is the direction that
  matters.
- The model is inside the coverage gate, and was mutation-tested on the way in: dropping a rounding step,
  skipping the Hard branch, and altering a relearning step each fail two to three tests. A gate is not
  trusted here until it has been seen to fail.
- `domain-is-pure` stays **absolute**, which is the point. Its value is that a reader never has to decide
  whether their case qualifies; the moment it has one exemption it has a judgement call, and the second
  exemption is argued against the first rather than against the rule.
- `ReviewStateDocument` gains `firstReviewedAt` and `learningSteps`, and renames `state` to `phase`. Each
  came from a failing test rather than a preference: without `learningSteps` a question two steps into
  relearning silently restarts its sequence after a reload; without `firstReviewedAt` the only marker of a
  new question is `reps === 1`, which stops being true on the second answer and let 26 of 30 questions
  through a `dailyNewLimit` of 10 in one measured day. `phase` is because "card state" is on TN-CARD-02's
  banned-vocabulary list, and a field the UI can read is a field the UI can leak.
- Slice 1 task 1.4's acceptance is unchanged — 50 draws from a 30-question pool never repeating inside the
  exclusion window, seeded — but its means are now this ADR's, and `Clock` and `RandomSource` are first
  called in task **1.5**, not 1.4. The scheduler is domain code and cannot import a port; it takes `now` and
  a draw as arguments, and the use case above it supplies them. Both port headers said 1.4 and were wrong.
