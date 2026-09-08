# ADR-0014: A dependency a layer rule forbids is written out and pinned to the real thing by oracle

- Status: Accepted (2026-09-08)

## Context

ADR-0012 decided one case: FSRS-6 is written out in `app/domain/scheduling/` because `domain-is-pure`
forbids the import, and `ts-fsrs` becomes a test oracle that pins every function by exact equality.

Since then the same shape has been reached for independently, by three different agents, in three different
layers, with no coordination between them:

| Where | What the layer rule forbade | What was written out | What it is pinned to |
|---|---|---|---|
| `app/domain/scheduling/` | `ts-fsrs` (`domain-is-pure`) | FSRS-6 weights, decay, recall curve, state machine | `ts-fsrs` 5.4.2, exact equality, randomised answer sequences |
| `app/application/persistence/iso-instant.ts` | nothing forbade `Date`, but this layer must not hold a clock; and `Date.parse` accepts implementation-defined junk | civil-calendar conversion, and `date-time` acceptance | `Date` as calendar oracle; `ajv-formats` for acceptance |
| `app/application/persistence/progress-schema.ts` | ajv and the `content/` tree (`application-no-frameworks`), plus 8 MB of payload for one document a session | the `progress.schema.json` validator | real ajv over the real schema file, ~700 single-property mutations |
| `scripts/lib/texture-memory.mjs` | nothing forbade sharp — but sharp *wrote* the files and computed the numbers under test | WebP/PNG header reading | sharp, in one test that generates files at known sizes |

Four instances is a pattern, and a pattern that is re-derived per case is a pattern that will eventually be
derived badly. The fourth row is the one that shows this is not really about dependency-cruiser: nothing
stopped that gate importing sharp. What stopped it was that the authority and the thing under test would have
been the same code. The rule generalises past the layer rules that produced it.

It has also now paid for itself in a way that settles the "is the extra test worth it" question. The
`progress-schema.ts` oracle found a live prototype-pollution defect in the save-import path — the path
`SECURITY.md` governs. `shape.properties[key]` returned `Object.prototype` for a `"__proto__"` key coming out
of `JSON.parse`, so the unknown-property branch was skipped and the walk then crashed on it. No hand-written
case list contained `"__proto__"`; the mutation generator produced it because it produces every key. Fixed
with `Object.hasOwn`, with a test.

## Decision

When a layer rule forbids depending on the authority for some numbers or some acceptance criterion — or when
depending on it would make the check circular — the code is **written out in the layer that needs it**, and a
test **pins it to the real authority**. Not a port, not an adapter, not a vendored copy.

Four things are required for this to be the answer rather than an excuse:

1. **The oracle is the real thing, run for real.** The real `ts-fsrs`. The real ajv, configured exactly as
   `scripts/validate-content.mjs` configures it, compiled against the real `content/schemas/*.json` read off
   disk. The real `sharp`, writing real files. A hand-written table of expected values is not an oracle — it
   is the same author writing the same assumption twice.
2. **The inputs are generated, not curated.** Randomised answer sequences; every single-property mutation of
   a valid document; every file dimension in a swept range. A curated list tests what the author thought of,
   and the defects worth finding are the ones nobody thought of. `"__proto__"` is the proof.
3. **There is an anti-vacuum assertion.** A test that compares two validators on inputs they both accept
   proves nothing, and it is the failure mode this pattern degrades into silently — as the corpus drifts, or
   as a generator stops generating. So the test asserts a floor on its own inputs: ≥ 300 mutations exist and
   > 75 % of them are refused by ajv; the manifest declares at least one level; `scripts/coverage-floor.mjs`
   refuses a coverage `include` that has collapsed to nothing. **A gate is not trusted here until it has been
   seen to fail**, and an anti-vacuum floor is how it keeps being able to.
4. **Agreement is asserted in both directions, on every input.** Not "our code accepts everything ajv
   accepts". A validator that accepts strictly more is a security hole; one that accepts strictly less rejects
   valid saves. The assertion is equality of verdicts, and the failure message names the input and both
   verdicts.

**The oracle dependency is a `devDependency`.** A runtime dependency nothing may import is a claim about the
build that is not true, and it ships weight for nothing (ADR-0012).

**Where the oracle needs a dependency the shipped code may not have, the test lives in
`tests/unit/contracts/`.** `tests/**` is outside `depcruise app common`'s scope, so the oracle is legal
exactly where the import is not — that is the mechanism the whole pattern rests on, and it is why these tests
are contract tests rather than unit tests of the module.

## Alternatives considered

- **Put the forbidden thing behind a port and implement it in an adapter.** Satisfies every rule and is the
  default outcome if nobody decides — ADR-0012 rejected it for FSRS and the reasons generalise. It moves the
  most correctness-critical code outside the ≥ 90 % coverage gate that exists for exactly that code, and it
  invents a seam that hides nothing: there is no technology behind `is this card due` or `is this a valid
  date-time`, only arithmetic and a grammar. A seam is for hiding a technology choice.
- **Vendor the upstream source.** Keeps the numbers without the import, and is a real option. Rejected for
  the same reasons each time: it copies a licence and a code style into a layer whose whole value is being
  reviewable as our code, and it gives **no signal at all** when upstream changes — which is the one property
  the oracle exists to provide.
- **Relax the layer rule with an allowlist for "pure" packages.** Rejected in ADR-0012 on the thing that
  makes it unworkable: dependency-cruiser matches paths, not properties, so an allowlist asserts purity that
  nothing checks and that a minor version can withdraw. Nothing since has changed that. It also would not
  help three of the four rows here — ajv is not pure enough to want in the payload regardless, and the sharp
  case is about circularity, not about layers.
- **Trust the shipped code and test it against hand-written cases.** Rejected on evidence. The mutation
  oracle found `"__proto__"` in a validator that already had a hand-written case list, in the file
  `SECURITY.md` names as the attack surface. A hand-written list is bounded by the author's imagination and
  the defects that matter are outside it.
- **Write the pattern into `docs/architecture.md` instead of an ADR.** Rejected: `architecture.md` describes
  how the system fits together and defers decisions with alternatives to `docs/adr/`. This has alternatives
  and a real, recurring cost — see below. `architecture.md` links here.

## Consequences

- **We own the maths, the grammar and the bugs.** That is the standing cost and it is not small: an FSRS
  revision, an `ajv-formats` change to `date-time`, a new image format in the pipeline are all our work now.
  It is bounded by the oracle, which tells us the day we diverge instead of leaving us to find out from a
  player's review schedule or a rejected save.
- **The upgrade trade is inverted, in our favour.** With an import, bumping the library silently changes
  behaviour and nothing fails. With the oracle, a library upgrade that changes the numbers **fails the
  suite**, and a human decides whether to follow it. Normally vendoring costs you upstream fixes; here it
  converts them from silent to explicit.
- **These tests are slower than unit tests and that is accepted.** Compiling ajv against three schema files
  and running seven hundred documents through two validators, or writing WebP files with sharp, is not
  free. They stay in `make test` rather than moving to a nightly job: a gate that runs on a schedule is a
  gate that reports a defect after it has been merged.
- **The pattern has a boundary and it is worth naming.** It applies where the authority is *deterministic and
  local* — numbers, grammars, file headers. It does not apply to I/O, to a rendering backend, or to anything
  whose behaviour depends on the environment. Rive is behind `ICharacterRenderer` and stays there; there is
  no oracle for "did this draw correctly", which is why that one is a port. Reaching for this pattern where a
  port belongs would be the way it goes wrong.
- **An oracle can rot into a tautology without failing.** If the generator stops generating, or the corpus
  becomes uniformly valid, the test passes on an empty comparison. The anti-vacuum floors are the mitigation
  and they must be maintained as real floors — a floor set at "greater than zero" is decoration.
- ADR-0012 is the first instance and is not superseded; it remains the record of the FSRS decision, including
  why the port-and-adapter answer was rejected there specifically. This ADR states the rule the three
  subsequent cases followed.
