# ADR-0003: Agentic content verification

- Status: Accepted (2026-09-08)
- Amended by ADR-0073 (2026-09-24): a squash-merge listed in `scripts/content-squash-merges.json` is
  judged by its pre-squash head's commits, on evidence (the head is present, its `content/` is identical,
  and its own commits pass every rule). Content PRs merge with a merge commit, not a squash. The
  one-commit-one-job rule is unchanged.
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
- Corrected 2026-09-08: the paragraph justifying the staleness register asserted that the cached *Discover
  Canada* was "inconsistently updated — six references to Elizabeth II against one to His Majesty". That is
  false: the text contains no "His Majesty", and the grep behind the figure had matched *King Charles II* in
  a 1670 sentence about the Hudson's Bay Company. The real hazard is sharper and replaces it — the cached
  Oath carries the June 2021 amendment *and* still names Queen Elizabeth the Second, in both languages, so
  the freshness signal a careful reader would use is present and misleading. The paragraph now also states
  the rule the mistake implies: a claim the register makes about a source must be re-derivable from the
  cached bytes.
- Amended 2026-09-08 (fifth), by the first real authoring run of 57 questions: the author's supporting
  passage and the verifier's are two different things and now have two fields, the null form of an unverified
  block is pinned so task 1.17's gate needs no per-field carve-out, and staleness flags gained a *grain*
  because chapter grain marked 57 of 57 questions volatile off two genuinely volatile facts. See "Two quotes,
  one per side of the separation" and "Staleness has a grain".
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

The hazard is not hypothetical, and its real shape is worse than "old". The cached edition is the 2012 large
print. Its Oath of Citizenship, on page 2, **already carries the June 2021 amendment** recognising the
Aboriginal and treaty rights of First Nations, Inuit and Métis peoples — and in the same passage still swears
allegiance to "Her Majesty / Queen Elizabeth the Second". One block of text is simultaneously current and
out of date, in both official languages: the French Oath beside it carries the same amendment and the same
« La reine Elizabeth Deux ».

That is the trap. A verifier who checks whether the page has been revised will find the amendment, conclude
that it has, and be wrong about everything else on it — including the monarch, who is King Charles III. The
signal a careful reader would use to decide the snapshot is fresh is present *and misleading*. A question
authored straight off that page would be confidently, officially wrong about the Oath, in a game teaching
people to take it.

Marking it `volatile` routes it to the live page every run and quarantines it when the source moves or
`asOf` passes 180 days, which is what each flag's `action` asks for in words and what a trusted-to-read note
would not have delivered.

What the gate cannot do, said plainly: it cannot tell that a `knownStaleness` entry *should* exist. It binds
a flag to the questions under it; noticing that a source has gone stale in a region nobody flagged is the
verifier's judgement against the live page, and nothing here substitutes for that.

**A claim the register makes about a source must be re-derivable from the cached bytes.** This paragraph is
the reason the rule is written down. Its first version asserted that the document was *inconsistently*
updated, "six references to Elizabeth II against one to His Majesty", and offered that inconsistency as the
evidence that the source is wrong in a known way. The text contains **no** occurrence of "His Majesty". The
figure came from a grep for `King Charles|His Majesty` whose single hit was *King Charles II*, in a sentence
about the 1670 Hudson's Bay Company charter — a seventeenth-century reference read as a present-day one. On
the Sovereign the document is uniformly pre-accession, which is a different and easier risk than a patchily
revised one, and the ADR was stating a checkable fact about a file that the file did not support.

Two things follow, and neither is "be more careful". First, a `knownStaleness` entry, and any prose here
describing one, states what can be recovered by re-running a stated command over the hash the manifest
records — so a wrong count is a reproducible disagreement rather than a claim nobody can check. Second, this
defect arrived by a route the ADR-0009 obligation gate structurally cannot see: the sentence was false the
moment it was written, not true-then-stale, and no date passing would ever have flagged it. The gate catches
claims that expire; nothing mechanical catches a claim that was never true, which is why the register points
at bytes and a hash instead of at a recollection.

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

### Two quotes, one per side of the separation

The first authoring run found a contradiction this ADR had not noticed. The brief told the author to write
no `verification` block; the schema listed `verification` in `required`; and the only `evidence` field was
*inside* that block. So the instruction both forbade the block and asked for a quote only that block could
hold. The author resolved toward the schema and wrote the block in a null form, which was the right call, but
the shape was wrong and is now fixed.

There are two passages, they belong to different agents, and they are not redundant:

- **`source.quote`** — the passage the *author* read the claim from, copied exactly. It says where the
  wording came from. It is required and non-empty, and it must be a contiguous passage of the cached
  extraction at the recorded hash, which is a check that catches a fabricated citation **before any verifier
  runs**.
- **`verification.evidence`** — the passage the *verifier* found that entails the answer. For a question with
  three distractors that is frequently a different sentence from the one the wording came from, which is why
  collapsing the two would lose information rather than remove duplication.

**The null form is now the only legal shape of an unverified block**: `status: "unverified"` requires
`model: ""`, `checkedAt: null`, `sourceHash: ""` **and** `evidence: ""`. That is what makes the separation
mechanically cheap. `make validate-content` enforces the shape, so task 1.17's git-history gate is a single
sentence with no per-field carve-out — *an author-authored commit may write a `verification` object only in
the null form, and may never change one that exists.* It is the same rule `communityReview` already needs
("an agent may write `not-sought` and nothing else"), so 1.17 writes it once.

This matters more since the permission prompt on `content/questions/**` was removed: separation of duties now
rests on agent roles plus that gate, and a rule with an exception is a rule with a way through it.

### Staleness has a grain

A `knownStaleness` entry declares `grain`, and where the affected claims are localised it lists `pages`. The
gate prefers page grain and falls back to chapter grain, because the first authoring run showed what chapter
grain costs: two genuinely volatile facts in the governance chapters — a Commonwealth member count and the
Official Opposition's formal title — flagged **all 57** authored questions as volatile, when the other 55 are
stable structure (how a bill becomes law, what a riding is, the three parts of Parliament).

That is safe and it is useless. Every one of the 57 would be re-verified every run and quarantined at 180
days, and — the part that matters — **a flag that fires on everything carries the same information as a flag
that fires on nothing.** The verifier can no longer use it to prioritise, which is what it was for.

Two supporting changes make page grain possible. `sourceChapter.endPage` closes a chapter's range: without
it a chapter was only a *start* marker and every page after it belonged to the previous chapter by accident,
which is how 27 questions from pp. 60-69 came to cite `Federal Elections` — mechanically correct and wrong
at a glance. And `source.page` records where the claim was read, checked against that range, and required
whenever the cited source is paginated. A page-grain flag on a question with no page still applies: it cannot
be ruled out, and silently dropping it would be the unsafe direction.

Over-marking is deliberately **not** a fault. A fact can be volatile for a reason the register has not
noticed, and that is precisely the judgement the staleness gate says it cannot make.

## Amendment, 2026-09-08: a closed door is the right answer, and it needs a designed way through

`scripts/verify-content.mjs` shipped in slice 1. Authorship turned out not to be establishable from this
repository's history — every commit carries one identity and no signature — so the gate enforces the
**checkable consequence** instead: within one document, one commit may not both author a claim and grant its
verification. That is a good substitution and it is not the whole rule.

For `communityReview` there is no checkable consequence to fall back on, so rule A3 refuses **every**
transition off `not-sought` outright. Infra flagged the result plainly: **a genuine human sign-off cannot
currently be recorded.** That was raised as a deliberate choice for the architect to rule on. Here is the
ruling, in three parts.

### 1. The refusal is correct and stays

It is not a defect and it is not a temporary hack. Today there is no reviewer, no process, and no artefact
format, so the only actor who could make that transition is an agent — and the cost of guessing wrong is a
fabricated sign-off naming a real person at a real organisation. `docs/content-review.md` §1 does not say
"prefer not to"; it says *never, for any reason*. A gate that can be satisfied by the one actor the rule
forbids is not enforcing the rule.

Note what kind of failure this is. Failing closed here blocks the **correct** action, not the incorrect one,
which is unusual and worth being uncomfortable about. It is still right, because the incorrect action is
irreversible in a way the correct one is not: a delayed genuine sign-off costs time, and a fabricated one
invents the consent of a real person and cannot be taken back once it has shipped.

### 2. Loosening rule A3 is not on the list of answers

Stated as a non-answer, in the manner of the runbook's texture-budget guidance, because it is the thing that
will look reasonable at the moment it is most dangerous — when a real reviewer has really said yes and the
build is red.

The only acceptable route is infra's own option 3: **an identity the committer does not control.** A signed
commit, or a GitHub review approval under CODEOWNERS with branch protection refusing a self-approved change —
an assertion made by something other than the actor making the claim about itself. When that exists, A3 is
replaced by a rule that reads it. Until then A3 stands.

The failure this avoids is not "somebody edits the gate maliciously". It is that **a gate which must be
disabled in order to do the right thing teaches everybody that gates are disabled to do the right thing**,
and the next one disabled will be one that mattered.

- ~~**OBLIGATION due=2026-12-08 owner=infra** — land an identity the committer does not control (signed
  commits, or CODEOWNERS plus branch protection on `content/characters/**` and `content/questions/**`), and
  replace rule A3 with one that reads it rather than refusing outright. Until this lands, the project can
  seek community review but cannot record the answer, and that is a real limit on shipping any Indigenous
  content — not merely a gate inconvenience.~~
  **VOIDED 2026-09-20** — closed as unachievable as written, with the reasoning in "Amendment, 2026-09-20"
  below. **No work was done and this does not claim any was:** no identity was landed, no signing key
  exists, rule A3 is unchanged and still refuses every transition. What removed the premise is that the
  premise was never true — every remedy it names attests to a credential, and in a repository with one
  maintainer running both agents every credential resolves to that one person. Measured: all 216 commits
  touching `content/` carry one author email and no signature, and the two signatures anywhere in this
  history belong to GitHub's merge key on commits that touch no content. The CODEOWNERS route additionally
  cannot be satisfied at all — a pull request author may not approve their own pull request, and the sole
  code owner is the author of every pull request — so it can only block everything or be bypassed, and it is
  being bypassed. **The cost, stated rather than inferred:** the project still cannot record a community
  sign-off, and that limit on shipping Indigenous content is now permanent as things stand rather than
  pending. The condition that would reopen it is a second party with their own credentials, which is
  `OQ-REVIEW-2`'s question and is already owned by the product owner; no new obligation is raised here,
  because restating this one in different words is what the ruling refuses.

### 3. The record gains a pointer to evidence

`communityReview` named a claim — reviewer, organisation, date, scope — and pointed at nothing. A later
reader wanting to check it could only re-read the same assertion in the same file.

`record` is added and is required whenever `status` is not `not-sought`: a URL to a published statement, or a
repository path to a committed letter or meeting record. It is `null` on `not-sought`, like every other
field, so an agent writing the only status it may write still cannot smuggle anything into the block.

Two honest limits, because a required field reads as a guarantee and this one is not:

- **No schema and no gate can check that the artefact exists, or that it says what the block claims.** This
  raises the cost and specificity of a lie again — the same argument this ADR already makes about naming a
  person — and does not prevent one.
- **It is designed before it can be used**, which normally this project refuses (ADR-0008). The exception is
  argued rather than assumed: a port written early costs a wrong interface, while *this* record will be
  written for the first time by somebody who has never written one, at the end of a real relationship with a
  real community, under the pressure of wanting to get it right. The shape is what tells them evidence is
  expected. Designing it then, from nothing, is the failure mode "seams deliberately left open" was written
  to prevent.

### 4. `content/schemas/palette.schema.json` validated nothing, and now does

Recorded here because it is the same defect class as this ADR's subject — a check that reads as enforced
because both halves exist, while nothing joins them.

`palette.schema.json` existed and `assets/style/palette.json` existed, and no gate compared them: the schema
walk covers `content/`, and the palette is (correctly) excluded from the credit walk, so it fell between the
two. ADR-0007's problem inverted. `scripts/validate-content.mjs` now validates it in place.

**The palette does not move to `content/style/palette.json`.** `assets/style/art-bible.md`'s `OQ-ART-01`
claimed it had to, because no palette schema existed and "the canonical palette path named in `CLAUDE.md`"
required it. Both halves of that premise were false: the schema exists, and **CLAUDE.md names no palette
path at all**. The file is the colour allow-list every SVG is linted against — an art artefact, read by the
art pipeline, never by the game — so `assets/` is where it belongs, and moving it would have created the
two-live-paths drift its own table exists to catch. `OQ-ART-01` can be closed as answered rather than
discharged; the work it asked for was not the work that was needed.

## Amendment, 2026-09-20: two-party authorship needs two parties, and this repository has one

The 2026-09-08 amendment above left an obligation on infra: *land an identity the committer does not
control (signed commits, or CODEOWNERS plus branch protection)*. This amendment rules on it. **It is closed
as unachievable as written, and this ADR's guarantee is narrowed to exactly what the gate holds.** Nothing
about the per-commit rule changes: `verify-content` gate A still fails any commit that both authors a claim
and grants its verification, and that is not weakened here in any respect.

The reason for ruling rather than re-dating is that the obligation is not blocked on effort. It asks the
repository to establish a fact about the world that is not true. **Two-party authorship requires two
parties, and this project has one.** Every identity mechanism attests to a *credential*; in a
single-operator repository every credential resolves to the same operator, who runs both agents. A
mechanism cannot manufacture a second party, and an obligation that waits for one to appear is a hope with
a date on it — which ADR-0009 says is not an obligation.

### 1. What this project guarantees about a grant, exactly

State it in full, because everything below is the argument for not claiming more. For each of the 904
grants in the corpus, `verify-content` establishes:

1. **No single commit both authored the claim and granted it.** Within one document, a commit that touches
   an author-owned field may not also write or change a `verification` block — with the one allowance that a
   newly added file may carry the block in its null form.
2. **A grant binds the text it was granted against.** Rule A4 re-binds every grant at `HEAD` by the claim's
   own id, so editing a claim under a standing grant fails rather than inheriting it.
3. **The five CI-clause checks and the re-check table hold**, per claim, for the current `sourceHash`.

And here is the whole of what it does **not** establish, said as plainly as it deserves: **that the grant
was made by a second party.** One agent making two commits in the right order produces a history that is
byte-for-byte identical to two properly separated agents producing the same result. The two-commit shape is
the entire guarantee. It raises the cost of marking your own homework from zero to "you must split it in
two, in that order" — real, and not the rule the Decision states.

So the Decision's "two separate agents with no shared context" is an **operating instruction to whoever runs
the agents**, and it is enforced by how this project is operated, not by anything in the repository. That
distinction is the point of this amendment. It was already true; it was written down in
`scripts/verify-content.mjs` and nowhere a reader of the ADR would find it.

### 2. The identity surface, measured today rather than recalled

The gate's header recorded this measurement at 58 commits and it has drifted, in a direction worth
correcting because the drift looks like progress and is not:

```
git log --format='%an|%ae|%cn|%ce|%G?' | sort -u
dependabot[bot]|49699333+dependabot[bot]@…|Kinn Coelho Juliao|kinncj@gmail.com|N
Kinn Coelho Juliao|kinncj@gmail.com|GitHub|noreply@github.com|E
Kinn Coelho Juliao|kinncj@gmail.com|Kinn Coelho Juliao|kinncj@gmail.com|N
```

570 commits. **Two of them carry a signature** — `bef3cd5` and `f1b2b1d`, both squash-merges made through
the GitHub web UI and signed by GitHub's own key — and one author identity is not the maintainer's, namely
Dependabot's. So the flat claim "one identity and no signature" is now false at the repository level.

It remains exactly true where it matters, and the restriction is the finding: **of the 216 commits that
touch `content/`, all 216 carry `kinncj@gmail.com` as author and `%G?` of `N`.** Not one is signed. Not one
carries any other identity.

That is the ruling's best piece of evidence, not a footnote. The two identities in this repository that the
committer genuinely does not control — GitHub's signing key and Dependabot's account — **exist already**,
and neither has ever authored or granted a content claim, because neither is an actor that writes content.
The mechanism the obligation asks for is present and attests to the wrong things.

### 3. Why each named remedy fails here

- **Signed commits.** The key is generated, held and used by the operator who runs both agents. A signature
  would prove "this operator's key made this commit", which the single author email already tells us. It
  cannot separate the author agent from the verifier agent, because both run as the same OS user with access
  to the same keyring — the condition the header already names as *theatre that would read as cryptographic
  proof*. Worse than useless: it would make the record look stronger while distinguishing nothing.
- **CODEOWNERS plus branch protection.** This one fails on a hard rule of the platform, not on judgement.
  GitHub does not let the author of a pull request approve it. `.github/CODEOWNERS` assigns every path to
  `@kinncj`; `@kinncj` is the sole maintainer and the author of every pull request. So
  `require_code_owner_reviews: true` with one required approval is **unsatisfiable by construction**: the
  only eligible approver is the only possible author. A rule in that state has exactly two behaviours —
  block all work, or be bypassed — and this repository is in the second. Every landing in the session that
  produced this ruling pushed straight to `main`, with the remote reporting *"Bypassed rule violations: At
  least 1 approving review is required"*, which `enforce_admins: false` (runbook §3, a deliberate residue)
  permits. **A control whose only two states are "stops everything" and "is routinely overridden by the one
  person it would bind" establishes nothing about who verified a question.**
- **A distinct GitHub App installation** — the fullest form of the header's option 3. The App is created,
  installed and its credentials held by the same person. GitHub would assert "installation X pushed this",
  and X is provisioned by the operator. It moves the trust root from *an agent's claim about itself* to *the
  operator's claim about itself*. That is one step, and it is not the step the obligation wanted.

The header's option 3 says it "is the only option on this list that is not ultimately a claim an agent makes
about itself". **That sentence is true in general and false under this repository's conditions**, and it is
the sentence that made the obligation read as dischargeable. It is corrected in place.

### 4. What `scripts/content-roles.json` was designed to do, and why it stays absent

Read from the code rather than inferred. `ROLE_IDENTITIES_FILE` defaults to `scripts/content-roles.json`,
overridable with `--roles`. The file is a flat JSON object mapping a **lower-cased git author email** to the
string `"author"` or `"verifier"`; any other value yields no role. When a commit's `%ae` resolves to a role,
gate A applies ADR-0003's rule *as worded* instead of the one-commit-one-job substitute: an author-role
commit may write a `verification` object only in the null form and may never change one that exists, and a
verifier-role commit may not touch author-owned fields at all. That is strictly stronger, and it catches the
one case the substitute cannot — a single actor making two well-formed commits.

Its precondition is that the two roles commit under **different** emails, which is a property of each
agent's process environment (`GIT_AUTHOR_EMAIL`) and lives outside this repository entirely.

**The file cannot be populated today, and the reason is arithmetic.** The map is keyed by email and the
content history holds exactly one:

- map `kinncj@gmail.com` to `author` and every grant in history becomes an author-role commit that moved a
  verification block out of the null form — 904 failures, permanently red;
- map it to `verifier` and every authoring commit becomes a verifier-role commit touching author-owned
  fields — also permanently red;
- map the placeholder addresses the header suggests, which no commit carries, and `roleOf` returns `null`
  for all 216 commits. Enforcement is then **identical to the file's absence**.

That third option is a trap and is named here so nobody lands it as progress. With a non-empty map the
summary stops printing *"commit AUTHORSHIP is not established here"* and starts printing *"role identities
loaded"*. Both sentences would be accurate — the second goes on to say how many commits carried a role, and
the number would be zero — but the headline reads as the strong rule being in force while nothing whatever
is enforced. **A file that changes the wording of a warning without changing a single outcome is a net loss,
and this ADR refuses it.**

So the file stays absent, the wiring stays, and the honest note stays. If the day comes when two roles
really do commit under two addresses, the map is one file and the gate needs no change — that is the wiring
earning its keep. It would still be self-attested, and the summary would still say so.

### 5. The ruling on the obligation

Closed with `VOIDED`, and the keyword is chosen under ADR-0009's instruction to choose honestly.
`DISCHARGED` would assert the work was done: **no work was done, no identity was landed, and nothing here
claims otherwise.** What removed the premise is not a reversed decision or a dropped feature but a
demonstration — §3 above — that the premise was never true: no identity mechanism available to a
single-operator repository can establish that two parties did the work, because there is one party. The
precedent for closing this way is the Peggy's Cove Tier 3 marker in `docs/content-review.md` §13, voided on
the same grounds and with the same refusal to claim delivery.

ADR-0009 warns that `VOIDED` is the easiest way to escape an obligation and that a closure naming no cause
should fail review. Answering that head-on: the cause is named and it is checkable by anyone in two
commands — `git log --format='%ae|%G?' -- content/ | sort -u` returns one row, and GitHub's own
documentation says a pull request author may not approve it. The cost of the escape is stated in §6 rather
than left to be discovered.

### 6. Rule A3 stands, and what that costs

`communityReview` keeps failing closed. No commit may move the status off `not-sought`, and since the
identity that was supposed to replace that refusal is not coming, **the refusal is now the settled state
rather than a placeholder.** Stated at full volume, because the 2026-09-08 amendment promised a way through
and this amendment withdraws it: *this repository cannot record a community sign-off, and that is a real
limit on shipping any Indigenous content, permanently as things stand.*

No new dated obligation replaces the voided one — restating it in different words is precisely what this
ruling refuses. What would reopen the question is a change in the world, not a mechanism: **a second party
with their own credentials.** That precondition already exists, is already owned and is already dated
elsewhere — `OQ-REVIEW-2` in `docs/content-review.md` §1 and §13, owner `po`, which asks whether a Tier 3
reviewer will be engaged at all. Until somebody other than the operator can act, there is nobody for an
identity mechanism to identify, and A3 has nothing to read.

One correction of aim while withdrawing the promise. A git identity was always a poor proxy for the thing
A3 needs to know, which is *did a person from the nation depicted actually say yes*. The artefact that
answers that is the one this ADR already designed: `record`, pointing at a published statement or a
committed letter. Whoever eventually replaces A3 should build the rule around **the artefact and the person**
and not around the commit, because the commit was never where the answer lived.

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
