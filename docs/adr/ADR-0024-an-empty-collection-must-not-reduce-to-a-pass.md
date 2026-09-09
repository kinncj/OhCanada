# ADR-0024: An empty collection must not reduce to a pass

- Status: Accepted (2026-09-08)

## Context

Three defects in two days, in three layers, with the same shape — and the coordinator spotted that they were
one thing rather than three:

| Collection | Consumer | Empty reduces to | Reads as |
|---|---|---|---|
| `content/levels/ottawa.json` `assets: []` | `refuseOverBudget` **sums** it | `0` bytes | "under budget" |
| `content/game.config.json` `levels: []` | `unlockedLevelIds` **filters** it | `[]` | "correctly locked" — every level, including Ottawa |
| `progress.schema.json` requiring an undeclared property | `validate-content` **iterates** documents | vacuous truth | "all valid" — there are no progress documents |

Applying the framing to look for a fourth found one immediately, which is the strongest evidence it is real:

| `content/locales/en`, `content/locales/fr` — both **empty directories** | `validate-content` **counts** parity checks | `0` | `"0 locale bundle(s) in EN/FR parity"`, printed as a pass on every run |

CLAUDE.md requires "EN and FR from the first commit" and ADR-0010 puts UI vocabulary in
`content/locales/<locale>/<bundle>.json`. Every player-facing string is presently in `app/ui/copy.ts`, whose
header says so honestly — `TODO(slice-1): move to content/locales`. The defect is not the TODO, which is
well-reasoned and visible. **The defect is that the parity gate reports success about zero files**, so the
project's hardest content guarantee currently guarantees nothing and says "OK" while doing it.

The insight that unifies them: **infra has already written this floor five times** — the credit gate ("found
0 asset files, do not read this as *the payload is small*"), the texture gate, the payload gate, the
obligation gate, `verify-content` — and I have written it three more times in `tests/unit/contracts/`. Every
one is the same idea applied to a *gate's corpus*. **Configuration is a gate's input too.** We built floors
where we happened to be looking.

## Decision

**A collection whose emptiness a consumer folds into a verdict carries a floor, and the floor lives where the
meaning of "empty" is known.**

Two refinements to that, and they are the whole of this ADR's contribution over the observation.

### 1. The property is the identity element, not the collection

The coordinator's first phrasing — "collections consumed by a reducer" — is a container, and it would be this
ADR committing ADR-0019's error while describing it. Not every reduction is dangerous. The precise property
is:

> **The reduction's identity element — what it returns for the empty collection — coincides with the success
> value.**

- `sum([]) === 0`, and zero bytes is under any budget. **Dangerous.**
- `every([]) === true`, vacuously. **Dangerous.**
- `filter([]) === []`, and an empty list of problems is a clean bill. **Dangerous.**
- `max([])` throws or is `-Infinity`. **Safe** — it cannot be mistaken for a result.
- `any([])` is `false`, which is safe when `false` means *fail* and dangerous when `any` means *any
  violation*. **Depends on the semantics, not on the operator.**

That last line is why the rule cannot be stated over collections, or over reducers, or over any container: it
depends on what the caller *means* by the value. Two identical `some()` calls differ in danger by what the
predicate is looking for.

### 2. The floor goes where the meaning of empty is known — usually the consumer, not always

"At the consumer" is right most of the time and is not a rule, because sometimes the consumer cannot know and
sometimes it does not need to:

- **`source.schema.json`'s `chapters` carries `minItems: 1`.** Correct in the schema: a cited source always
  has at least one chapter, so emptiness is illegal for every consumer and declaring it once covers them all.
- **`assets[]` must *not* carry `minItems: 1`.** A level with no art is legal — a menu or a text level. Only
  `refuseOverBudget` knows that an empty list means *unbudgeted* rather than *nothing to budget*, so that is
  where the floor belongs.
- **`locomotionModes` carries `minItems: 1`** (ADR-0023): a game with no way to move is not a game.

The test is ADR-0019's, applied to a floor instead of a rule: **find the smallest thing that knows what empty
means, and put the floor there.** A floor in the schema when only the consumer knows is over-broad; a floor
in one consumer when the schema knows is a floor the second consumer will not have.

### 3. One mechanical form, and it is narrow

Most of this is review, and §"What no gate can express" says so. But there is one shape that is checkable and
that would have caught the fourth instance:

> **A gate that reports a count fails when the count is zero, unless zero is explicitly declared legal in
> that gate, with a reason.**

`validate-content` prints five counts in its success line. "0 locale bundle(s) in EN/FR parity" should have
been a failure — or an explicit `0 expected until slice 1 task N`. That rule is per-gate, is one condition
per printed number, and is exactly the anti-vacuum floor already written eight times, applied to the gate's
own summary rather than to its corpus.

- ~~**OBLIGATION due=2026-10-08 owner=infra** — in `scripts/validate-content.mjs`, fail on
  `localeBundlesChecked === 0` rather than reporting it, or declare zero legal in the script with the task
  that ends it. Then audit the other four counts in that success line for the same property. The EN/FR parity
  guarantee currently passes over zero files, which is the loudest instance and the one already in the output
  of every run.~~
  **DISCHARGED 2026-09-08** — infra took the second branch and audited the rest. The summary line no longer
  prints a count for locale bundles; it prints the claim instead: *"NO locale bundles exist yet, so EN/FR
  parity is held by `app/ui/copy.ts` and `make typecheck`, not here (ADR-0010, ADR-0024)"*. Floors were added
  to the content-document walk, the asset walk and the palette ramps.

  It also caught something sharper than the obligation asked for, and it is the better half of the fix: a
  floor on the *combined* length of a list that always contains `assets/credits.json` and
  `assets/style/palette.json` **can never reach zero, so it is a floor that cannot fire** — decoration in the
  exact sense ADR-0014 warns about, spotted in the act of adding it rather than a year later. That is the
  discipline this ADR was written to spread, applied better than the ADR stated it.

## Alternatives considered

- **Find empty arrays with a lint rule.** The obvious mechanisation and it is the container error: it would
  flag `bannedFromAnswers: []`, `playerSelectableSlots: []` and a reserved slot's `options: []` — all of
  which are *correct* and two of which this repository deliberately requires to be empty. Emptiness is not
  the defect; emptiness meaning *success* is.
- **Require `minItems: 1` on every array in every schema.** Same error, stated in JSON Schema. It would
  forbid the legitimately-empty cases above, and it would not have caught three of the four instances, since
  `levels`, `assets` and the locale directories are all legally empty *as data* — they are only dangerous as
  *input to a fold*.
- **Treat this as an instance of ADR-0019 and amend it.** Tempting, and wrong, and worth stating so the two
  do not blur. ADR-0019 is about a rule whose **scope** does not match its **justification**, so members are
  silently uncovered. This is about a **value** that is indistinguishable from success, so a verdict is
  silently wrong. Same consequence — a quiet false pass — by different mechanisms, and merging them would
  produce a rule too vague to apply to either.
- **Rely on the existing anti-vacuum convention.** It is a good convention, it is written eight times, and it
  did not generalise on its own: every instance of it guards a *gate's corpus*, and all four defects above
  are configuration or content. Naming the class is what carries it across.

## Consequences

- **Four instances are known and three are fixed.** `assets[]` has an obligation on engine (ADR-0020),
  `levels`/`order` were fixed in `content/game.config.json`, the `progress.schema.json` near-miss was caught
  by `ports-match-schemas` and corrected. The locale-parity count is open above.
- **A gate's success line is now something to read adversarially.** `validate-content` prints "79/79 content
  files", "0 locale bundles", "79 asset files credited", "97 colours in 31 ramps". Four of those five numbers
  are load-bearing evidence and one is a vacuum, and they are printed in the same sentence in the same tone.
- **This ADR is mostly unmechanised and that is stated rather than implied**, like ADR-0019 and ADR-0011's
  clause problem. The three of them now form a small set of rules held by review, which is itself worth
  watching: a project whose gates are its memory accumulating rules that gates cannot hold is a project
  slowly returning to attention as its enforcement.
- **The near-miss is the sharpest illustration and is recorded as such.** `progress.schema.json` briefly
  required a property it did not declare — which with `additionalProperties: false` invalidates every
  progress document — and `make validate-content` reported OK, because no progress documents exist. **A
  schema with no documents is validated by nothing.** The gate that caught it was the port-contract test,
  which does not iterate documents at all; it compares two declarations. That is the general escape from a
  vacuum where one is available: **check a claim against another claim, not only against a corpus that may be
  empty.**
