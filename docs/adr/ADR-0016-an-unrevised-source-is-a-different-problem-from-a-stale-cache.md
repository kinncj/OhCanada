# ADR-0016: An unrevised source is a different problem from a stale cache, and re-fetching cannot fix it

- Status: Accepted (2026-09-08)

## Context

ADR-0003 built the verification model on one assumption, stated in its own words: a verification status is
granted for a `sourceHash`, "and when the hash changes the status stops matching and the claim falls out of
the build without anyone noticing the edit". The mechanism assumes **our cache drifts behind a maintained
source**. Under that assumption a hash comparison resolves staleness: hash differs → re-verify → quarantine
if the claim moved.

The content verifier fetched the two live canada.ca chapters on 2026-09-08 and compared them with our
extraction:

| Live page | Page's own "Date modified" | Agrees with our cache? |
|---|---|---|
| `…/read-online/how-canadians-govern-themselves.html` | 2017-12-21 | Yes, on every claim any question uses |
| `…/read-online/federal-elections.html` | 2025-08-08 | Yes, on every claim any question uses |

The live page today still reads "Her Majesty is a symbol of Canadian sovereignty", "53 other nations", "Her
Majesty's Loyal Opposition", "308 electoral districts", and captions a photograph "Queen Elizabeth II".
**IRCC has not revised *Discover Canada* for the accession.** The cache and the live page agree, and both are
out of date.

That inverts the model, and each consequence is worse than it first sounds:

- **A drift-based quarantine has no trigger.** `sourceHash` will go on matching indefinitely while the
  content stays wrong. The mechanism does not fail; it succeeds, forever, at the wrong question.
- **Re-fetching cannot fix a stale fact.** There is nothing to fetch.
- **`asOf` exceeding 180 days will fire and produce a re-verification that finds the same unchanged, still
  wrong text.** That is busywork that looks like diligence, which is worse than busywork: it produces a fresh
  `checkedAt` on every question and a record that reads as active maintenance.

The register could not even express the finding. `additionalProperties: false` correctly rejected the
verifier's draft field, which is the schema doing its job — but it meant the one fact that matters most about
this source had nowhere to live.

**This is a specification change, not a retrofit.** `scripts/verify-content.mjs` is still the slice-0 stub;
its header describes the 180-day quarantine as *planned*. So the busywork above has not been built yet and
does not have to be.

One more thing is worth stating before the decision, because it is the actual reason 54 of 57 questions
verified rather than producing a pile of quarantines. **The author routed the answers around the stale
facts** — no option or explanation in the bank names a monarch, a Commonwealth count, a seat count or an
office holder. Nobody told them to. Nothing recorded that they had. Nothing checked that it stayed true.

## Decision

### 1. The register records live checks, as a list

`source.schema.json` gains `liveChecks[]`. Each entry carries `checkedAt`, `checkedBy`, a `finding`, a
`consequence`, and one `pages[]` entry per live URL with `url`, `chapter`, `sourceDateModified`,
`agreesWithCache` and `claimsCompared`.

The concepts are named apart because conflating them is the defect:

- **`knownStaleness`** — *this cached text is wrong.*
- **`liveChecks`** — *we looked upstream, and here is whether the wrongness is ours or theirs.*

Four choices in that shape are load-bearing:

- **A list, not a latest reading.** The pattern across checks is the evidence. `source-unrevised` after one
  look is a guess; after three looks spanning a year it is a finding, and it is the finding that justifies
  moving a question off per-run re-verification. Overwriting destroys exactly the signal the decision rests
  on.
- **`checkedAt` and `sourceDateModified` are separate fields.** One is our clock, one is the page's claim
  about itself, and **the gap between them is the whole finding** — checked 2026-09-08, page says 2017-12-21.
  A single "date" field would have collapsed the observation into one of its two halves.
- **`claimsCompared` is required and non-empty.** "Textually identical" is unfalsifiable without saying
  identical *on what*; two documents differ somewhere. These are the sentences a later checker repeats to
  reproduce the finding. Same anti-vacuum discipline as ADR-0014's floors.
- **`source-withdrawn` and `source-unreachable` are different values.** A 500 or a DNS failure is not a
  retraction. Folding them would let a transient network fault read as the Government of Canada removing a
  document — the same reasoning that made ADR-0009 split `VOIDED` from `DISCHARGED`.

### 2. `volatile` keeps its meaning; what a volatile item's re-check *costs* moves to the source

`volatile` is **not** given a new state. It means, and only means, *this fact can change without notice*.
That is a property of the fact, it is the author's judgement, and it is correct on every one of these
questions — a Commonwealth count really can change.

What was wrong is that `volatile` was read as also answering a second question — *will the source tell us
when it changes?* — which is a property of the **source**. Those two were fused into one boolean, and the
fusion is what produced work with no possible finding.

So the second question moves to the register, as `knownStaleness[].upstream`: `revises` /
`does-not-revise` / `unknown`. Absent means `unknown`, and **`unknown` is treated exactly as `revises`**,
because continuing to fetch is the safe direction.

The re-check rule becomes:

| Source disposition | What the periodic re-check is | What the 180-day clock does |
|---|---|---|
| No live check, or latest `finding: source-revised`, or `upstream` absent/`unknown`/`revises` | per-question re-verification against the live page — unchanged from ADR-0003 | `source.asOf` over 180 days quarantines **the question** |
| Latest `finding: source-unrevised` **and** every flag over the question's region declares `upstream: does-not-revise` with a `bannedFromAnswers` list the question satisfies | **one live check per chapter, at the source**, appended to `liveChecks[]` | `liveChecks[].checkedAt` over 180 days quarantines **the source**, which fails every question citing it |
| `source-withdrawn` | none — the document is gone | every question citing it quarantines immediately |
| `source-unreachable` | retry; the disposition does not change | no state change. A run of consecutive unreachables is its own signal and needs its own decision |

**The clock does not go away; it moves from the question to the source.** That is the whole trick, and it is
why this is not "stop checking". One fetch per chapter replaces N re-verifications of a page that cannot have
changed, and it still **fails closed**: a `liveChecks` entry that goes stale quarantines everything under it.
If IRCC finally revises *Discover Canada* for the accession — which they eventually must — we find out on the
next check, not never.

### 3. The mitigation that actually works is recorded and enforced

`knownStaleness[].bannedFromAnswers` lists terms that must not appear in any **option or explanation** of a
question citing an affected region. It is **required whenever a flag declares `upstream: "does-not-revise"`**
— enforced by the schema, so declaring "the source will never fix this" and putting nothing in place of the
re-check is a validation failure rather than an omission.

This is the field that makes §2 safe. We are not relying on periodic re-verification to catch a stale fact;
we are relying on **no shipped answer depending on the stale fact at all**, checked on every build.

`tests/unit/contracts/questions-cite-a-cached-source.test.ts` enforces it, extending the predicate that
already binds staleness flags to questions. Matching is whole-word and case-insensitive, over EN and FR.

Two details were settled by a failing fixture rather than by preference, which is why they are recorded:

- **The prompt is not checked; options and explanations are.** A question may legitimately *ask* about a
  stale topic. What may not happen is a player being told a stale value is true.
- **The apostrophe is a word boundary, not a word character.** The first implementation treated it as
  word-like, and the fixtures caught that this misses French elision (`l'Elizabeth`) and — much worse — the
  English possessive (`Elizabeth's reign`). Both failures are in the dangerous direction: a banned term ships
  by standing next to punctuation.

## Alternatives considered

- **Add a `volatile` state meaning "stale, unfixable, do not re-ask".** This is what was proposed and it is
  close to right, but the shape is wrong in two ways. `volatile` is a required boolean on every `factSource`
  written by the **author**, so changing its type edits all 57 questions — files another agent holds — to
  record a fact the author cannot know: whether IRCC maintains a document is not visible from the passage
  they are reading. And "do not re-ask" as a *terminal* state switches off the only mechanism that would ever
  notice the accession being published. The disposition belongs to the source, which is where it is
  observable, and the answer is to make the re-check cheap rather than to stop it.
- **Keep re-verifying and accept the cost.** Rejected, and not on cost. A re-check that structurally cannot
  produce a finding manufactures evidence of diligence: every question gets a fresh `checkedAt` and the bank
  reads as actively maintained against a source nobody has looked at in years. A green gate that cannot go
  red is this project's most-removed artefact.
- **Quarantine everything drawn from an unrevised source.** Safe, and it deletes the game. 54 of 57 verified
  questions come from these chapters, and they are verifiable *because the answers were routed around the
  stale facts* — the structure of Parliament, what a riding is, how a bill becomes law. Quarantining correct
  questions because a neighbouring sentence is out of date is over-marking at the grain ADR-0003 already
  rejected: a flag that fires on everything carries the same information as one that fires on nothing.
- **Re-source the bank onto a maintained page.** The genuinely right long-term answer for the affected
  claims, and out of scope here: *Discover Canada* is the document the IRCC exam is drawn from, so a question
  sourced elsewhere is testing something the exam does not ask. Recorded as the standing option if a chapter
  ever becomes unusable.
- **Record the finding in `knownStaleness[].problem` prose.** Rejected: it is already prose, nothing can
  branch on it, and the whole difficulty is that the two situations look identical from inside the register.
  A `finding` enum is what a gate reads.
- **A single `liveCheck` object rather than a list.** Smaller, and it destroys the multi-check pattern that
  is the actual evidence. See §1.
- **Describe the banned facts in prose and trust the author.** Rejected on evidence: the author *did* route
  around them correctly and unprompted, and nothing recorded it — so the next author has no way to know the
  constraint exists, and nothing would notice its being broken. This is the ADR-0008 lesson at content grain:
  the defect being fixed is invisible correctness, not incorrectness.
- **Infer the banned terms from the flag's `problem` text.** Rejected: it would guess a denylist out of prose
  and get it silently wrong in both directions. The register names the terms.

## Consequences

- **`verify-content` has not been written, and this ADR changes what it must do before it is.** Its stub
  header — "re-verify volatile items every run and quarantine anything whose source moved or whose `asOf` is
  over 180 days" — is now the rule for one of the four rows in §2's table, not for all of them. The table is
  the specification.

  - **OBLIGATION due=2026-11-08 owner=content** — populate `liveChecks[]` on
    `content/sources/discover-canada.json` with the 2026-09-08 check that produced this ADR (both chapter
    URLs, their `Date modified` values, the claims compared, `finding: "source-unrevised"`), and set
    `upstream: "does-not-revise"` with a `bannedFromAnswers` list on the flags it covers. Until that lands,
    this ADR describes a finding the register does not record and the answer gate has no terms to search
    for — the schema is armed and nothing has armed it.
- **A term list that over-fires is a build failure, and that is the accepted direction.** The fix is to
  refine the entry in the register, not to argue with the gate. A list that under-fires ships a wrong fact to
  somebody studying for a citizenship test.
- **`bannedFromAnswers` cannot be checked for completeness.** A stale fact nobody thought to ban is unbanned.
  This is the same limit ADR-0003 already states about `knownStaleness` itself — the gate binds a flag to the
  questions under it and cannot tell that a flag *should* exist — and it now applies one level down, to the
  terms inside a flag.
- **`liveChecks` records a claim, not a fact.** Nothing can verify that a live check happened, or that
  `agreesWithCache: true` was honest. The gate checks form, chapter binding and freshness. ADR-0009 said the
  same about `DISCHARGED` and the answer is the same: the value is that a claim was made, dated and attributed
  by a named checker.
- **`sourceDateModified` is the page's claim about itself and can be wrong.** A page can be edited without
  the stamp moving, and a stamp can move on a navigation-only change. It is the cheapest available evidence
  that a document is unmaintained, not proof — which is why the decision rests on `claimsCompared` and not on
  the date.
- **This is now the third time a live check has changed a design assumption in this repository.** ADR-0003's
  own text was corrected after a `knownStaleness` entry made a claim about the file that the file did not
  support. The lesson repeated here: a register that points at bytes, hashes and quoted claims is checkable,
  and one that points at a recollection is not.

## A note on the two-quote design, ratified

The same verification pass reports that **51 of 57 `evidence` spans differ from their `source.quote`**,
usually because the verifier quoted the sentence that *rules out a distractor* rather than the one the
wording came from. Six coincide and are flagged as coinciding rather than padded to look independent.

That is ADR-0003's two-quote separation working exactly as it was argued for when the "just move the field"
simplification was rejected: `source.quote` says where the wording came from, `verification.evidence` says
what entails the answer, and for a question with three distractors those are frequently different sentences.
An 89% divergence rate is the measurement that would have been unavailable had the fields been collapsed, and
the six coincidences being *reported* rather than disguised is the behaviour the separation of duties is for.

No change follows. It is recorded because a design decision that survives contact with a measurement should
not have to be re-argued from first principles in the next slice.
