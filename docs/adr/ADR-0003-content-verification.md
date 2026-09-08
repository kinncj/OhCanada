# ADR-0003: Agentic content verification

- Status: Accepted (2026-09-08)
- Amended 2026-09-08: the Decision listed `evidence` among the five fields the verifier writes, but the
  CI clause below did not gate it. That omission is how the verification block in
  `app/application/ports/content-repository.ts` was able to drop the field entirely without any gate
  noticing. The CI clause now names it.
- Amended 2026-09-08 (second), by slice 1 task 1.2, which wrote `question.schema.json` and could not do so
  without answering two things this ADR had left the code to decide on its own:
  - **A fourth status.** This ADR named three — `unverified`, `verified`, `quarantined` — while the port and
    `docs/architecture.md` §4 both carried a fourth, `rejected`. The schema keeps four and this ADR now says
    so rather than being quietly widened by a file it does not mention. See "The four statuses".
  - **Scope.** This ADR governed *questions*. A landmark blurb and a line of NPC dialogue state facts about
    Canada in exactly the same way, and nothing checked them. Verification now follows the claim rather than
    the screen it appears on. See "What is verified".
  The five fields, the five checks and the separation of duties are unchanged.
- Amended 2026-09-08 (third): the `sourceHash` mechanism had only one end. A question carried a chapter
  title and a 64-character string, and nothing said which document either referred to, so nothing could
  check them. `content/schemas/source.schema.json` is the register of cached sources and
  `FactSource.sourceId` names one. Two consequences follow, and the second is new policy rather than
  plumbing: a cited chapter and hash are now checkable, and a source's **known-stale regions bind the
  questions drawn from them**. See "The cached source register".
- Amended 2026-09-08 (fourth): `docs/content-review.md` extends this ADR's separation of duties one step —
  no agent may grant cultural sign-off — and asked the architect for the fields to carry it. They exist
  (`nationName`, `nationSource`, `communityReview`, and `TerritoryStatement` on a level). One of them cannot
  be enforced the way the rest are, and this ADR says so rather than letting a schema imply otherwise. See
  "What a schema cannot enforce about an author".

## Context
The game teaches facts people are tested on for citizenship. A wrong answer in the bank is worse than a
missing one. There is no human review gate in this project, so correctness has to be mechanical and auditable.

## Decision
Two **separate agents with no shared context**:
- `content-author` writes questions, quests and locale strings. It can never write a `verification` block.
- `content-verifier` writes *only* the `verification` block. It cannot edit question text, quests or code.

### What is verified

**Every player-facing sentence that states a fact about Canada**, wherever it appears — not only the ones on
a question card. A wrong fact in a Mountie's dialogue is exactly as wrong as a wrong fact in the bank, and is
read by the same player for the same purpose; the original wording of this ADR covered only questions because
questions were the only content that existed when it was written.

Mechanically, the shape is one block, `common.schema.json#/$defs/factClaim`, carried by any authored text
outside the question bank:

- `factual` — the author's declaration that this text asserts something about Canada. Required, never
  defaulted: a greeting and a claim look identical to a machine, so the judgement is recorded per line
  rather than inferred. Greetings, instructions and flavour are `false`; anything a player could be tested
  on is `true`.
- `source` and `verification` — the same two blocks a question carries, and `null` only when `factual` is
  false. The schema enforces that conditional, so "this line states a fact and nobody checked it" is not a
  representable state.

A question does not carry `factClaim`: a question is a claim by construction, so it carries `source` and
`verification` directly and both are required. In slice 1 the new surfaces are a landmark's `blurb` and a
`dialogueLine`. Locale bundles carry no `factClaim` because, per ADR-0010, they may not state a fact — that
is the one part of this rule no gate expresses, and ADR-0010 says so where it says it.

### The four statuses

`unverified` → no check has run. `verified` → every check below passed for the current `sourceHash`.
`rejected` → the verifier's judgement failed; the text goes back to the **author**. `quarantined` → a status
that was granted and has since been invalidated by source drift or by age; the text goes back to the
**verifier**, unchanged.

`rejected` and `quarantined` are both excluded from the build and differ only in who owns the next move, but
that difference is the whole reason for the fourth value: collapsing them would mean a question the verifier
judged wrong and a question canada.ca edited under us are reported the same way, and the wrong agent is
woken. The distinction was in the port and in the architecture diagram before it was in this ADR; that was
the defect, not the fourth status.

### The check

For each claim the verifier fetches the cited *Discover Canada* section from canada.ca (cached and hashed
under `content/sources/`) and must:
1. quote the supporting passage as `evidence`;
2. confirm the answer is entailed by it;
3. confirm each of the three distractors is not entailed;
4. confirm the French is a faithful translation;
5. confirm the wording is not verbatim (n-gram check).

All five pass → `status: "verified"` with `model`, `checkedAt`, `sourceHash`, `evidence`. A failed judgement →
`status: "rejected"`, back to the author. A previously granted status invalidated later → `status:
"quarantined"`, back to the verifier. Both are excluded from the build. `volatile` items are re-verified
every run and quarantined when the source hash changes or `asOf` exceeds 180 days.

For a claim that is not a question — a blurb, a dialogue line — checks 2 and 3 read as "the sentence is
entailed by the passage" and "the sentence claims nothing the passage does not"; there are no distractors.

CI fails if any shipped claim lacks `verified` for the current `sourceHash`, if a question has fewer than
three distractors, is missing EN or FR text, matches the source verbatim, or carries `status: "verified"`
with an empty `evidence`. The last of those is what keeps the auditability consequence below honest: a
status with no quoted passage is an assertion, and this ADR does not accept assertions.

Two of those clauses stopped depending on `verify-content` in slice 1. "Missing EN or FR text" is now
structural: ADR-0010 puts both languages in the document and `localizedText` requires both, so
`make validate-content` fails on the file. "Verified with an empty evidence" is a conditional in
`common.schema.json#/$defs/factVerification`: if `status` is `verified`, then `evidence`, `model`,
`checkedAt` and `sourceHash` must all be present and non-empty — so it fails on the file too, before `verify-content` is reached. The CI
clause is unchanged; it simply now has two gates behind it instead of one that had not been written yet.

### The cached source register

`content/sources/<id>.json` records, for one document the bank is written against: its URL, edition,
retrieval date, the SHA-256 of the file, a **separate** SHA-256 of the extracted text, its chapter list, and
whether the file is committed. `FactSource.sourceId` names one, and
`tests/unit/contracts/questions-cite-a-cached-source.test.ts` checks four things JSON Schema cannot, because
each of them reads a second file: the manifest exists, the cited chapter is one the manifest lists, the
question's `sourceHash` equals the hash of what the verifier actually read, and the staleness rule below.

Two of those fields deserve their reason written down. The **two hashes** are separate because a
re-extraction with a different tool changes the text a claim was checked against without touching the
document, and that is a difference the bank must be able to see; the question's `sourceHash` is the hash of
the *extraction* when there is one, because that is what was read. **`committed: false`** exists because the
first real source is Crown copyright: *Discover Canada* may be paraphrased and cited and may not be
redistributed, so the file is git-ignored and the manifest is the whole of the record. ADR-0004's asset
licence test does not apply to it — it is a document the project reads, never an asset it ships — and
spelling that out in a field is how the distinction stays visible.

**A source's known-stale regions bind the questions drawn from them.** The manifest's `knownStaleness[]`
lists what a snapshot is already known to get wrong, with the chapters each flag touches, and a question
citing a flagged chapter **must** be marked `volatile`. That is a gate, not a note, and it is the difference
between recording a hazard and acting on one.

The hazard is not hypothetical. The cached edition is the 2012 large print, and its Oath of Citizenship
still names Her Majesty Queen Elizabeth the Second; the monarch is King Charles III, and the Oath was
amended in June 2021 to recognise the Aboriginal and treaty rights of First Nations, Inuit and Métis
peoples. The document is also *inconsistently* updated — six references to Elizabeth II against one to His
Majesty — which is worse than uniformly old, because it reads as current in places. A question authored
straight off that page would be confidently, officially wrong about the Oath, in a game teaching people to
take it. Marking it `volatile` routes it to the live page every run and quarantines it when the source moves
or `asOf` passes 180 days, which is what each flag's `action` asks for in words and what a trusted-to-read
note would not have delivered.

What the gate cannot do, said plainly: it cannot tell that a `knownStaleness` entry *should* exist. It binds
a flag to the questions under it; noticing that a source has gone stale in a region nobody flagged is the
verifier's judgement against the live page, and nothing here substitutes for that.

### What a schema cannot enforce about an author

`docs/content-review.md` §1 states the rule this ADR's separation of duties implies one step further: **no
agent may grant cultural sign-off, ever, for any reason.** An agent may write
`communityReview.status = "not-sought"` and nothing else.

A schema cannot express that, and `common.schema.json#/$defs/communityReview` must not be read as expressing
it. A schema constrains a *value*, not its *author*, and any schema that permits `granted` at all permits an
agent to write it. What the schema does instead is two things worth having and short of the rule:

- **`not-sought` is forced to carry no names.** `reviewer`, `organisation`, `date` and `scope` must all be
  null when nothing has been sought, so a review cannot be half-claimed and an agent writing the one status
  it may write cannot smuggle a person into the record.
- **Every other status must name a person, an organisation, a date and a scope.** A fabricated sign-off is
  then a specific, checkable falsehood about a real named person and organisation, rather than a flag flip.
  That is a change in the *shape* of the lie, which is worth something, and it is not the rule.

The rule itself needs a gate that reads **git history**: `verify-content` must fail when a commit authored
by an agent moves `communityReview.status` away from `not-sought`. Authorship is the thing being constrained,
so authorship is what the gate has to read. That is slice 1 task 1.17's, and until it lands this block is
held by review — which is recorded here rather than left for someone to infer from a schema that looks
stricter than it is. An agent that fills in `granted` has fabricated a review: the same class of defect as a
`verified` question with no evidence quote, and worse, because the person whose consent it invents is real.

Two smaller decisions from the same document, recorded because they are schema-visible:

- **`nation` is validated against a deny-list, not left free.** `Indigenous`, `First Nations`, `Inuit`,
  `Métis`, `tribal`, `traditional`, `generic`, `n/a`, `TBD` and the rest are build failures, matched
  case-insensitively. Those are categories, not nations, and a vague value in a field named `nation` is
  precisely the "generic Indigenous person" failure the rule exists to prevent, wearing the field's name. A
  paired `indigenous: boolean` is required and never inferred, on the same principle as `FactClaim.factual`:
  the judgement is recorded rather than defaulted, and `false` — a character carrying no cultural marker at
  all, about whom the game asserts nothing — is a real answer.
- **A level states a territorial *fact*, and no agent writes an acknowledgement.**
  `TerritoryStatement` carries the nations, the sentence in both languages, and a `FactClaim` checked like
  any other. There is deliberately no field for an acknowledgement: a model has no relationship to
  acknowledge, and a generated one would be words asserting something that was never true — this project's
  oldest failure mode, dressed as respect.

## Alternatives considered
- **One agent authoring and verifying** — rejected: a model that wrote an answer is the worst judge of it.
- **Human review gate** — rejected for this project: no reviewer exists, and a gate nobody staffs is a lie.
- **Trust the model, spot-check** — rejected: silent errors are the failure mode that matters here.

## Consequences
- Adding a question is cheap; shipping an unverified one is impossible.
- Community corrections arrive as issues and pass through the same verifier, so the bar does not drop for them.
- The bank is auditable: every shipped question carries the passage that supports it, and so does every
  landmark blurb and every line of dialogue that claims anything.
- Authoring a dialogue line now costs a three-field judgement even when the answer is "this is a greeting".
  That is deliberate: an optional block would be omitted exactly where it matters, and a `factual: false` on
  a sentence that does state a fact is a reviewable lie rather than an invisible gap.
