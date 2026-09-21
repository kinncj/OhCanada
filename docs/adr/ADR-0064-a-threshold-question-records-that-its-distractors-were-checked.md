# ADR-0064: A threshold question records that its distractors were checked

- Status: Accepted (2026-09-20)
- Settles: what to do about a distractor that is **true**; where the record of a check lives when the block
  that should hold it is closed; whether the check can be decided by arithmetic (it cannot, and §3 measures
  by how much); and whether the rule reaches French.
- **Amends ADR-0003** in one respect and no other: the verifier's block gains a sixth field,
  `distractorsNotEntailed`, which exists only on the shape of claim where this defect can live. ADR-0003's
  five checks, its four statuses and its separation of duties are unchanged. In particular this adds **no
  new check** — check 3 has said "confirm each of the three distractors is not entailed" since the ADR was
  written. What is new is that the check leaves a trace.
- **Amends `docs/architecture.md` §4**, which said the verifier "writes five fields and only five".
- Slice: content quality (`docs/plan/slices.md`).
- Numbering. `main` at `71f6725` holds ADR-0001…ADR-0037, ADR-0039…ADR-0049 and ADR-0051…ADR-0063. The
  high-water mark across **every ref this repository can see** is 0063: `git ls-remote --heads origin`
  reports exactly three remote heads (`main`, `archive/v0.1`, `length-outliers-3`), and `git log --all` over
  `docs/adr` adds nothing above it. No document's prose claims 0064. **0064 is the first number above the
  mark.** The holes at 0038, which nothing ever occupied, and at 0050, spent by a dropped draft, stay
  untaken, per ADR-0052 and restated by ADR-0063. This check was made because it has failed before — on
  2026-09-17 two agents on branches that could not see each other both took 0057 and both landed.

## Context

### The defect

A question is one correct option and three distractors, all drawn from *Discover Canada*. Four questions
shipped with a distractor that is **defensibly true** — a correct answer marked wrong:

| id | the answer | the distractor | why the distractor is also true |
|---|---|---|---|
| `gov-51` | "at least half the seats" | "two thirds of the seats" | two thirds **is** at least half |
| `sym-32` | exempt at "55 or over" | "65 or over" | someone 65 **is** over 55 |
| `gov-39` | "the most votes" | "more than half of the votes" | more than half of a district's votes **is** the most of them |
| `elec-14` | "fewer than half the seats" | "fewer than a third" | fewer than a third **is** fewer than half |

Every one passed authoring and verification. Nothing in `scripts/verify-content.mjs` examined the relation
between two options: B3 counted four options and three distinct non-empty distractors, and stopped there.

Measured on this tree at `71f6725`: `elec-14` was rejected (`ea1864d`), repaired (`f139159`) and re-granted
(`696125a`), so it is correct today. **`gov-51`, `sym-32` and `gov-39` are live on `main` and still carry
the true distractor.** A fifth question, `gov-48`, is often listed with these; it is not one of them. Its
three distractors are exactly the three parties its own quote says do **not** have the right to ask, so each
is false. It is a question the verifier was right to look hard at and right to pass.

### The shape that predicts it, and the shape that does not

The four are not four arithmetic accidents. They share a **logical form in the prompt**:

- A **condition prompt** — *"When is a government called a minority government?"*, *"Which adult applicants
  are exempted?"*, *"Which candidate becomes the MP?"* — asks for a condition. Any value satisfying the
  condition yields a true option, so a **stricter** value is defensible and the distractor is a second right
  answer.
- A **point-count prompt** — *"About how many Canadians volunteered?"* — asks for the guide's value. A
  different value is simply false, and makes a perfectly good distractor.

The direction matters and is easy to get backwards. **Loosening a threshold is safely false; tightening it
is dangerously true.** `gov-40` answers "at least 18" and offers "16 or older" — false, because 16- and
17-year-olds may not vote. `sym-32` tightens 55 to 65 — true, and a defect. `gov-38` tightens 18 to 21 and
survives on a single word: "**Only** Canadian citizens aged 21 or older" asserts a false universal where
"any" would have been true.

### Why arithmetic cannot be the gate, measured

This ADR ships an arithmetic screen and refuses to let it decide anything, and the reason is a measurement
rather than caution. Over the 498 questions in `content/questions/`, the screen flags five options as
stating a bound stricter than the answer's:

| flagged | verdict |
|---|---|
| `gov-51` options[2] | **real defect** |
| `sym-32` options[1] | **real defect** |
| `gov-38` options[3] | not a defect — the word "Only" makes it a false universal |
| `hist-65` options[1] | not a defect — point-count prompt; "Over 70,000" is false |
| `hist-65` options[2] | not a defect — point-count prompt; "Over 600,000" is false |

Two of five. And `hist-65` is the case that settles the design: arithmetically it is the **identical shape**
to `sym-32` — an option whose lower bound exceeds the answer's — and the verdict is opposite, because the
prompt asks for a count rather than a condition. No regex reads that difference.

Worse, the arithmetic **misses `gov-39` entirely**: "the most votes" carries no parsable quantity, so there
is nothing to compare. A gate built on the arithmetic would have been wrong three times in five and blind to
one of the four defects it was built for. A check that is wrong more often than it is right trains people to
wave it through, which is worse than no check.

### What the corpus looks like through the trigger

Two patterns, and the rule is their **conjunction**: the `source.quote` states a threshold, **and** two or
more options are stated in comparable terms. Measured over 498 questions:

| trigger | fires | catches of the four |
|---|---|---|
| quote states a threshold, alone | 68 | 4 of 4 |
| two or more comparable options, alone | 13 | 4 of 4 |
| **both** | **12** | **4 of 4** |

The twelve are `elec-14`, `gov-38`, `gov-39`, `gov-40`, `gov-50`, `gov-51`, `hist-65`, `hist-66`, `hist-89`,
`sym-32`, `wwa-34`, `wwa-36`. Three are live defects, one is repaired, one is `gov-38`'s near miss and seven
are clean. `gov-48` does not fire, correctly. The 486 questions the trigger does not reach include every
coordinate fact and every guide-verbatim option, which an earlier sweep surfaced as 236 candidates and zero
defects — noise this trigger does not generate.

## Decision

### 1. The verifier records the check; the gate never renders the verdict

Where a question's `source.quote` states a threshold and two or more of its options are stated in comparable
terms, the verifier records `verification.distractorsNotEntailed: true` — the statement that ADR-0003's
check 3 was made **against that threshold**, in both languages.

This is an **obligation, not a verdict**. The machine decides only *where a person must look*; the judgement
stays with the agent that can make it. That is the opposite of a gate that claims the arithmetic proves
something, and it is chosen because §3 shows the arithmetic would be wrong three times in five.

### 2. The record lives inside `verification`, and that is the only place it can live

`distractorsNotEntailed` is a sixth property of `common.schema.json#/$defs/factVerification`. Three
mechanical facts make that the only correct home, and each was checked against the code rather than assumed:

1. **It voids no grant.** Gate A4 binds a grant to `authorFieldsOf(unit)`, and `authorFieldsOf` replaces
   every recognised verification block with the constant `GOVERNED_BLOCK` before hashing. A field added
   *inside* the block is therefore invisible to the binding. A sibling field at the top of the document —
   an `optionCheck` block, say — would be **author-owned**, would enter the hash, and would **void all 904
   grants in the corpus** on the commit that introduced it.
2. **Only the verifier can write it.** ADR-0003's git gate lets an author-authored commit write a
   verification object only in the null form and never change one that exists. Putting the record anywhere
   else would hand the author the power to satisfy an obligation addressed to the verifier.
3. **The recogniser does not break.** `isVerification()` matches on a **required subset**, and
   `assertRecogniserIsLive()` builds its probe from the schema's *current* required list — both written that
   way after ADR-0003's `record` amendment silently disabled rule A3. An **optional** sixth property leaves
   `VERIFICATION_KEYS` untouched and every assertion passing. The field is deliberately **not** added to
   `VERIFICATION_KEYS`: doing so would narrow the recogniser and skip legitimate blocks written without it.

**Cost of the schema change, stated plainly.** Four files move together — the schema, the port interface
`FactVerification`, `docs/architecture.md` §4, and this ADR. `app/adapters/content/question-document.ts`
does **not** move: it reads five named keys and ignores the rest. That is also why the port field must stay
**optional** — a required one would stop the adapter compiling and would drag a file outside the architect's
boundary into this change.

### 3. `true` or absent, never `false`

The field is `const: true`. A check that **failed** is `status: "rejected"`, which already exists and already
routes the question back to the author. A check nobody made is **silence**. A `false` would be a third state
duplicating one of those two, and a field with a falsy legal value invites being written once and left.

It is **forbidden outright on an unverified block**, in the schema's existing null-form conditional. This
closes a real hole: `verify-content`'s `isNullForm()` tests the five fields by equality and would have
accepted a null form carrying a sixth key, letting an author pre-satisfy the verifier's obligation.
`make validate-content` catches it instead, on the file, before `verify-content` is reached.

### 4. The trigger reads English; the obligation covers both languages

`source.quote` is a plain string, not a `localizedText`: the cached extraction is the English document and
there is no French quote to match against. So the trigger is English-driven **by construction**, not by
choice.

Measured, so that the choice is not a guess: of the twelve, **eight** fire on the French options as well,
**four** fire on English only — all four are the harmless point-counts — and **zero** fire on French that
English misses. An English-aimed trigger loses nothing on today's corpus.

The **obligation** it raises is explicitly bilingual: recording `distractorsNotEntailed` asserts that each
distractor was checked against the threshold in **EN and FR**. All four known defects carry identically in
both languages, and a translation can introduce the relation on its own — "au moins la moitié" against "les
deux tiers" needs no English to be wrong. §"Rules stated here that no gate can express" records what remains
unreachable.

### 5. It reports today and blocks later, and the staging is on the record

`verify-content` rule **B10** fires on the twelve and writes a `note`, not a `fail`. The build stays green:
`verify-content` exits 0 today, in a clean checkout and on a verifier's machine alike.

This is staged rather than blocking on day one for one reason: **none of the twelve can carry the record
yet.** The field did not exist when they were granted, only the verifier may write it, and an author working
in `content/questions/` may not be handed a red build for a gate's own newness. Failing all twelve today
would teach exactly the habit this ADR exists to prevent. The obligations below carry the flip, with dates
and owners, so "reporting" cannot quietly become permanent.

B10 reads only authored JSON — `source.quote` and `options` — so it is **unaffected by the git-ignored
extraction being absent**, which is the CI case. Verified: the rule prints the same twelve in a clean
worktree with no `content/sources/*.txt` present.

## What this makes impossible

- A threshold question whose distractors nobody checked **and nobody noticed**. It is named on every run.
- An author satisfying the verifier's obligation, in any of three independent ways (§2).
- A silent narrowing of the recogniser of the kind the `record` amendment caused (§2.3).
- A `false` record that looks like a check and is not one (§3).
- The gate claiming the arithmetic proved something: the report says "REPORTING ONLY" in its own text, and
  prints the count it **could not** parse beside the count it could.

## Alternatives considered

**A blocking arithmetic gate — a strict numeric-interval subset check.** Rejected on measurement. It is
wrong three times in five on this corpus (§3), and it misses `gov-39`, one of the four defects it would have
been built for, because "the most votes" carries no quantity. Shipping it would have put a check in CI that
a reasonable person learns to dismiss.

**The wider trigger alone — "the source quote states a threshold".** 68 questions, all four defects, ~6%
precision. Rejected: an obligation attached to 68 questions, 65 of which are clean, is an obligation people
batch-approve. The conjunction reaches 12 with the same recall.

**A `notes` free-text field on `verification`.** Rejected. A free-text field is unfalsifiable — it records
that somebody typed something, not that a check happened — and it invites the verifier to relitigate the
question text, which ADR-0003 forbids. A verifier who needs to say more already has `rejected` and a commit
message.

**A sibling block outside `verification` (`optionCheck`, or a field on the question).** Rejected on the
mechanics in §2: it is author-writable, and it voids all 904 grants the moment it appears, because
`authorFieldsOf` hashes everything that is not a recognised governed block.

**Making the field required on every claim.** Rejected. Most claims can never carry it — a landmark blurb
has no distractor — and requiring it would void every grant in the corpus and break the adapter's
`FactVerification` construction.

**No gate at all: "the only reliable detector is a careful reader".** Seriously considered, because it is
half true — the detector *is* a careful reader, and §3 is the evidence. It is rejected because the question
is not whether a machine can judge entailment (it cannot) but whether a machine can **schedule the
judgement**, and it can: 12 questions out of 498, with 100% recall on the known class. The reader stays;
this ADR only guarantees the reader is sent to the right twelve files, and leaves a record when they have
been.

## Consequences

- The verifier has one more thing to write, on 12 of 498 questions (2.4%), and nothing to write on the other
  486.
- `verify-content` prints one more line on every run, including when the count is zero, with the size of
  what was searched — ADR-0024's rule, because a trigger that matched nothing and a trigger that went dead
  produce identical silence.
- Three live defects are now named by a gate rather than by a person's memory: `gov-51`, `sym-32`, `gov-39`.
  **This ADR does not repair them** — the text is the author's and the status is the verifier's, and the
  architect may write neither.
- The corpus grows a field that most of it will never carry. That asymmetry is deliberate and is the reason
  the field is optional rather than required.
- A future amendment that adds a seventh field pays the cost §2 describes, and no more: the recogniser and
  the grant binding are already proof against schema growth.

### Rules stated here that no gate can express

1. **Whether a prompt asks for a condition or for a count.** This is the distinction the whole defect class
   turns on, and it is a judgement about meaning. `hist-65` and `sym-32` are arithmetically identical and
   have opposite verdicts (§3).
2. **Whether a distractor is entailed by the answer.** `gov-39` is the proof that this is not arithmetic:
   "more than half the votes" entails "the most votes" with no number in common.
3. **A defect present only in the French.** The trigger cannot aim at French, because `source.quote` has no
   French side. Zero such cases exist today (§4); nothing mechanical would find the first one. The
   obligation is worded to cover both languages so that the judgement, at least, is asked for.
4. **Whether a single qualifying word rescues a distractor.** `gov-38`'s "Only" does. No gate reads that.

## Obligations

- **OBLIGATION due=2026-11-20 owner=content-verifier** — for each of the twelve questions `verify-content`
  names on every run, either record `verification.distractorsNotEntailed: true` after checking each
  distractor against the threshold in **both languages**, or set `status: "rejected"` and return it to the
  author. Three are known defects and are expected to be rejected rather than recorded: `gov-51`
  ("two thirds" is at least half), `sym-32` ("65 or over" is over 55) and `gov-39` ("more than half of the
  votes" is the most votes). `gov-38` is a near miss that turns on the word "Only" and should be recorded,
  not rejected, if that reading holds. Do not edit any question's text: that is the author's, per ADR-0003.
  **DISCHARGED 2026-09-20** — `make verify-content` prints "ADR-0064 threshold questions — 12 question(s)
  whose source states a threshold and whose options are comparable; 12 recorded distractorsNotEntailed, 0 did
  NOT". Each of the twelve carries `verification.distractorsNotEntailed: true`; none was returned to the
  author. This closes the content-verifier's half only — the infra marker below (rule B10 from `note()` to
  `fail()`) and the architect's re-measurement are untouched and still open.

  **The three this marker expected to be rejected were recorded instead**, which is the verifier's judgement
  and not an oversight, and is written down so it can be re-opened on the record. `gov-51`, `sym-32` and
  `gov-39` are all `status: "verified"` with the flag set, as is `gov-38`, the near miss this marker predicted
  would hold. The five questions carrying `status: "rejected"` in `content/questions/` today are a different
  five, rejected for unrelated reasons. The marker asked for a record **or** a rejection on each of the twelve
  and has one on each; a reader arriving expecting three rejections will not find them. Separately and as
  reporting only, `verify-content` still names two options in `hist-65-boer-war-volunteers.json` that state a
  bound stricter than the answer's and are true whenever it is.

- **OBLIGATION due=2026-12-20 owner=infra** — once no question `verify-content` names is missing its record,
  change rule B10 in `scripts/verify-content.mjs` from `note()` to `fail()` and delete the staging paragraph
  in §5 of this ADR. If the twelve are not yet resolved on that date, re-date this with a note saying what is
  outstanding — re-dating with a reason is legitimate (ADR-0009); letting the date pass in silence is what
  the marker exists to prevent. A reporting gate that is still reporting a year later is a gate nobody
  believes.

- **OBLIGATION due=2027-03-20 owner=architect** — re-measure §"What the corpus looks like through the
  trigger" and §3 over the tree as it then stands, and record the numbers here. The trigger's precision is a
  property of today's 498 questions, and the recall figure — four of four — is measured on the defects that
  were **already found**, which makes it a fit to known cases and not an estimate of what it will catch
  next. If the corpus has grown and the trigger still fires on roughly 2% of it, that is evidence; if it
  fires on 20%, the conjunction has stopped discriminating and this ADR needs replacing.

## References

- ADR-0003 — content verification, the five fields, the four statuses, check 3.
- ADR-0007 — a schema conditional names only properties the object declares.
- ADR-0009 — the obligation markers above.
- ADR-0019 — a rule drawn round a container measures the container; B10 is scoped by claim **shape**.
- ADR-0024 — an empty collection must not reduce to a pass; why the report prints when it is zero.
- `scripts/verify-content.mjs` — rule B10, `THRESHOLD_QUOTE`, `COMPARABLE_OPTION`, `quantityOf`.
- `content/schemas/common.schema.json#/$defs/factVerification` — the field and its null-form prohibition.
