# ADR-0030: A subject owns what it grades, not what it tells

- Status: Accepted (2026-09-13)
- Narrows the scope of ADR-0028 §4. Supersedes nothing in it.

## Context

ADR-0028 made the proposition the unit of exclusive claim between subjects, identified it by `source.quote`,
and gated it in `tests/unit/contracts/a-proposition-belongs-to-one-subject.test.ts` over the documents in
`content/questions/`. It did not say whether the rule reaches anything else, because when it was written
little else carried a quote. That has changed. Measured on the tree as this was written, with the ADR-0028
gate's own normalisation:

| What carries a `source.quote` | Count |
|---|---|
| questions | 486 |
| factual claims in level documents — landmark blurbs, territorial statements | 45 |
| factual quest dialogue lines | 56 |

Verifiers now meet ADR-0028's sentence on content it never discussed, and rule case by case. Their rulings
agree with each other, but they rest on the wording — "ADR-0028 governs questions" — and a ruling on
wording is re-argued by the next reader who reads the wording differently. One file already does.

### The cases on record

**Point-of-interest blurbs that state another subject's graded proposition.** A blurb belongs to a level
and is in no bank.

| Blurb | Level (subject) | Shares its quote with |
|---|---|---|
| `streetcar` — p.66, local government usually runs transit, snow and garbage removal | `toronto` (elections) | `gov-59-municipal-responsibilities` (government) — identical proposition |
| `nathan-phillips-square` — p.98, where most Canadians live | `toronto` (elections) | `reg-30-where-most-canadians-live` (regions) |
| `library-of-parliament` — p.80, the Library survived the 1916 fire | `ottawa` (government) | `sym-18-library-only-original-part` (symbols) |
| `container-car` — p.90, commerce is the engine of growth | `prairie-rail` (modern-canada) | `eco-01-engine-of-growth` (economy) |

Verifiers granted all four.

**Explanations that state another subject's answer without grading it.**

| Pair | What happens |
|---|---|
| `jus-40` / `gov-59` | `gov-59`'s explanation says large cities have their own police; its evidence quotes `jus-40`'s sentence |
| `eco-43` / `reg-41` | `eco-43`'s explanation says Saskatchewan was once the "wheat province" |
| `eco-48` / `reg-51` | `eco-48`'s explanation says the Gold Rush brought miners to Yukon |
| `eco-44` / `reg-13` | `eco-44`'s explanation says Regina is the provincial capital |

### Five more, found by measuring rather than by waiting

Across the tree there are **nine** told claims that share a normalised quote with a question in a subject
other than their level's, and **33** that share one with a question in the same subject. Four of the nine
are above. The other five:

| Told claim | Level (subject) | Shares its quote with |
|---|---|---|
| `content/levels/toronto.json` `cn-tower` | `toronto` (elections) | `eco-26-toronto-financial-centre` (economy) |
| `content/levels/vancouver.json` `marina` | `vancouver` (symbols) | `reg-46-pacific-gateway` (regions) |
| `content/levels/peggys-cove.json` `granite-shore` | `peggys-cove` (who-we-are) | `reg-02-three-oceans` (regions) |
| `content/quests/alberta-foothills-ranch-barn.json` `/steps/0/dialogue/1` | `alberta-foothills` (economy) | `reg-44-banff-national-park-province` (regions) |
| `content/quests/quebec-city-chateau-frontenac.json` `/steps/0/dialogue/1` | `quebec-city` (history) | `sym-34-anthem-proclaimed-1980` (symbols) |

Two of those are **dialogue lines**, not blurbs. A ruling written for blurbs alone would leave them for the
next verifier. This ADR rules on the class.

### The code that reads it the other way

`scripts/lib/claims.mjs` `DOCUMENT_SCOPE_FIELDS` binds every enclosed claim — blurb, territorial statement,
dialogue line — to its document's root `subject`, *"because the one-proposition-one-subject check is made
AGAINST the subject"*, and binds a quest's `levelId` *"for the reason `subject` earns it"*. Gate A4 in
`scripts/verify-content.mjs` acts on that, and `tests/unit/infra/verify-content-gate.test.ts` pins it:
re-filing a level under another subject voids every grant in the level.

So the verifiers hold that told claims are outside the rule, and the gate voids their grants as though
they were inside it. Both cannot be right.

### Forces

- **Counting.** The ship floor, the exam's by-subject rows and the scheduler each count propositions, and
  each is wrong if one is counted twice (ADR-0028 §1).
- **Teaching.** TrueNorth is a learning tool (`CLAUDE.md`, Purpose). A landmark that says the true thing
  about itself, and an explanation that tells a learner why the option they chose is wrong, are the product
  working.
- **Truth.** ADR-0003's second amendment: verification follows the claim, not the screen. Every told claim
  is verified as strictly as a question, and nothing here relaxes that.
- **ADR-0019.** A rule drawn round a container measures the container. "In a subject bank" and "on a level"
  are both containers. The property has to be named before the scope can be.

## Decision

**A proposition is graded by at most one subject. It may be told by anything, anywhere, as long as it is
true.** The unit of exclusive claim is the *graded* proposition. ADR-0028 §4's gate is scoped by that
property, and a thing that is only told is outside it.

### 1. What the rule protects, stated as the harm

Three things in this system count graded propositions, and each breaks if one proposition is graded twice:

| What counts | Where | What one proposition graded by two subjects does to it |
|---|---|---|
| The ship floor | `SUBJECT_SHIP_THRESHOLD` in `app/application/content/question-bank.ts` | Thirty drills' worth of a remit (ADR-0028 §1) include a proposition another subject also counts toward its thirty. Two floors pass on one fact. |
| The exam's by-subject rows | `app/application/use-cases/exam-attempt.ts` copies `question.subject` into each item | One piece of knowledge can be asked twice in one twenty-question draw under two names, and scores in two rows. |
| The scheduler | `scheduleReview` draws question ids | Two cards for one memory. The second is recognised from the first, and its interval measures the other card's review. |

All three are made of one thing: a question document, with one `subject`, one keyed answer and one review
record. **That is what "graded" means.** A question grades exactly one proposition — the one its `prompt`
asks and its `correctIndex` keys. Everything else is **told**: its distractors, its `explanation`, its
`verification.evidence`, and every `factClaim` in a level or a quest. None of that enters a floor, an exam
row or a schedule, so none of it can make a proposition count twice.

This is not a new reading. TN-LEVELS-03, the row ADR-0028 was enforcing, says a level's bank *"shares none
of **them** with another level's subject"* — and "them" is questions.

### 2. Told claims are out of scope: blurbs, territorial statements, dialogue lines

A level's `subject` is the remit of its quest's `answer` steps and of the bank the scheduler draws for it.
It is a statement about that draw, not about every sentence drawn on the level. A streetcar is local
government's business whichever level it stands on; the blurb that says so is true of the streetcar, and
its truth is what the verifier checks.

A player who reads `streetcar` in Toronto and later answers `gov-59` correctly is the game working. If that
exposure moves the scheduler at all, it moves it one way: the card is easier than the model believes, so
it comes back sooner. Incidental teaching cannot make a forgotten card look remembered.

**What holds a told claim is unchanged:** verification against its own quote (ADR-0003), and the contiguity,
verbatim, banned-term, page-range and 180-day checks `scripts/lib/claims.mjs` already applies to every
claim by shape, plus `docs/content-review.md`.

**Should anything else stop a level teaching one proposition twice, or teaching one that contradicts a
question?**

- **Contradiction — no new rule, because the right one already exists.** Two claims each entailed by one
  sentence cannot contradict each other unless the sentence does. Claims resting on two different
  sentences contradict only if the guide does, and a guide sentence that has stopped being true belongs in
  ADR-0016's staleness register. What remains is a verifier's entailment error in one of the two, and the
  defence against that is the entailment check both already have to pass. ADR-0028's rule would be the
  wrong instrument in any case: it *permits* a shared quote inside one subject, which is exactly where two
  claims on one topic are most likely to disagree.
- **Repetition on one level — not forbidden, not gated, the author's call.** Measured: two levels tell one
  sentence twice. `alberta-foothills` tells **one proposition** twice — the guide's line at
  `/steps/0/dialogue/2` and the `beef-cattle` blurb. `ottawa` tells **two propositions** from one sentence —
  the officer's "Ottawa is Canada's capital city" and `rideau-locks`' "chose it as Canada's capital in
  1857". A quote-equality gate fires on both and is right about at most one, and the harm is a tap that
  repeats something, not a wrong count or a false fact. Whether Alberta's repeat is a recap or an accident
  is editorial. This ADR does not make it a defect.

### 3. Explanations and evidence are out of scope

An explanation is told. It appears after its own question is answered and enters no count. **In Exam mode it
does not appear until the result screen** — `app/ui/exam-screen.ts` asserts `question-explanation` absent —
so no explanation can change an exam score.

The cases show why a ban would do damage. `eco-44`'s explanation names Regina as the capital **because
Regina is one of `eco-44`'s distractors**. `eco-48`'s explanation mentions the Gold Rush because one of its
distractors is "It stopped when the Gold Rush ended." That is corrective feedback, the most useful thing an
explanation does, and a rule against stating another subject's answer would forbid it first.

`verification.evidence` is the verifier's context window and is routinely wider than the proposition. It is
not compared, and must not be: `reg-51`'s evidence and `eco-48`'s each contain the other's `source.quote`,
so keying on evidence would make every pair of neighbouring sentences a collision.

**The residual effect, stated so that silence here is not read as coverage.** Study draws from every bank
at once (`loadEveryBank` in `app/application/use-cases/study-session.ts`, no `subject`), and the card shows
the explanation after each answer. A drill of five can therefore ask `gov-59` and then `jus-40`, and the
second is answerable from the first's explanation. The scheduler records recognition as recall and gives
one card an interval somewhat too long, which the next lapse corrects. That is real. It is also **not an
effect of the subject boundary**: two questions in one subject produce it identically. The instrument that
would catch it is a draw-order rule over explanation sentences, and that needs an identity for a sentence
inside an explanation, which does not exist and, for the reason ADR-0028 §4 gives about paraphrase, will
not. Unheld, and recorded as unheld.

### 4. The rulings, by name

| Case | Graded proposition(s) | Told by | Ruling |
|---|---|---|---|
| `streetcar` | p.66 municipal responsibilities — `gov-59` (government) | blurb, `toronto` | **Stands.** Graded once, by `government`. |
| `nathan-phillips-square` | p.98 where most Canadians live — `reg-30` (regions) | blurb, `toronto` | **Stands.** |
| `library-of-parliament` | p.80 the Library survived — `sym-18` (symbols) | blurb, `ottawa` | **Stands.** |
| `container-car` | p.90 engine of growth — `eco-01` (economy) | blurb, `prairie-rail` | **Stands.** |
| `jus-40` / `gov-59` | `jus-40` who polices big cities; `gov-59` who removes snow and garbage — two propositions, two quotes | `gov-59`'s explanation and evidence | **Both stand.** Nothing is graded twice. |
| `eco-43` / `reg-41` | `eco-43` largest producer of grains and oilseeds; `reg-41` the two old names | `eco-43`'s explanation | **Both stand.** `reg-41`'s quote is already narrowed to its own clause — ADR-0028 §4's remedy, applied. |
| `eco-48` / `reg-51` | `eco-48` mining remains significant; `reg-51` the Gold Rush brought miners to Yukon | `eco-48`'s explanation and a distractor | **Both stand.** Corrective feedback. |
| `eco-44` / `reg-13` | `eco-44` Saskatoon is mining headquarters; `reg-13` Regina is the capital | `eco-44`'s explanation | **Both stand.** Corrective feedback on a distractor. |
| `cn-tower`, `marina`, `granite-shore`, the Alberta and Québec City dialogue lines in the Context table | one graded proposition each, in `economy`, `regions` or `symbols` | blurb or dialogue line | **Stand**, on this ruling. Nobody needs to ask. |

The four blurb grants stand on a **different ground** from the one they were given on. They stand because
a told claim cannot put a proposition into two counts, not because ADR-0028's text happens to mention
questions.

### 5. What a level claim binds to

**A claim in a level document binds to its own unit and to nothing at the level's root.** `subject` comes
out of `DOCUMENT_SCOPE_FIELDS`.

The test for a scope field is the one written above that list: *"a verifier's check of this claim reads
this field."* No check a verifier makes of a blurb or a territorial statement reads the remit. Passage
found, answer entailed, no distractor entailed, non-verbatim, EN and FR present (`docs/architecture.md` §4)
— not one of them involves `subject`. Re-filing Toronto under `government` would change what its quest
draws. It would not change whether "public transit is usually run by the local government" is true, and a
grant voided by that edit buys a re-verification that checks nothing.

**A question's `subject` stays bound, and nothing about it changes.** Its unit is the document. Re-filing a
question does change a graded claim: the floor and exam row it enters, and which subjects the ADR-0028 gate
compares it with.

**A quest's `levelId` stays bound, on a different reason, and its old reason is withdrawn.** It was bound
"for the reason `subject` earns it", and that reason is gone. A second reason, of the required kind, holds
on the tree: a quest's lines are said somewhere, and some are true only there.

- `content/quests/quebec-city-chateau-frontenac.json` `/steps/0/dialogue/1` — "People sang it **here** for
  the very first time, in 1880."
- the same quest, `/steps/1/dialogue/1` — "The country's name came off **this river**."
- `content/quests/the-north-sternwheeler.json` `/steps/0/dialogue/2` — "Whitehorse, the capital of **this
  territory**".

ADR-0029 §5 makes a landmark giver's lines place-bound by design — "This spot marks…". A verifier checking
"here" reads where the line is spoken, and `levelId` is where. Re-attaching the quest to another level makes
each of those grants a statement about somewhere else, with no word changed. The binding is kept for
**place**, not for remit.

A blurb does not need the same binding. What it refers to is its point of interest, whose `name` is already
inside the unit. The level's own place lives in fields the A4 essay has already answered no for, and a level
does not change place with its landmarks still standing in it. Not reopened here.

### 6. The gate change

This is the brief for the infra agent. It does not touch how claims are **identified** — the id-not-list-
position work is independent of it and can land first or second.

**G1 — `scripts/lib/claims.mjs`.**

- Delete the `subject` entry from `DOCUMENT_SCOPE_FIELDS`.
- Replace `levelId`'s `why` with the place reason. Wording to use: *"the place a quest's lines are said
  at. Lines are written about where they are spoken — 'here', 'this river', 'the capital of this
  territory', and every landmark giver's line by design (ADR-0029 §5) — so re-attaching a quest to another
  level makes each grant a statement about somewhere else, however untouched its words. ADR-0030."*

What the check then compares, for an enclosed claim (a pointer of three or more segments): the author fields
of the claim's unit, plus root `levelId` wherever the document has one.

- **It must still refuse — void the grant —** on any author-field edit inside the unit; on any change to a
  quest's `levelId`, voiding every enclosed grant in that quest; and on any change to a question document's
  `subject`, voiding that question's grant, because for a question the unit is the document.
- **It must no longer refuse** a change to a level document's root `subject`. That edit voids zero grants.

**G2 — `scripts/verify-content.mjs`**, the essay above `claimAuthorFieldsAt`. Add a level's `subject` to
"ASKED AND ANSWERED NO", with the reason: *a level's subject is the remit of its quest and its bank; no check
a verifier makes of a blurb or a territorial statement reads it (ADR-0030).* The summary's bind counts then
name `levelId` alone.

**G3 — `tests/unit/infra/verify-content-gate.test.ts`**, the A4 table.

- The row "the level's subject" leaves the loop, which asserts exit status 1, and becomes a case shaped like
  the `reorderAndRebudget` one: the edit voids `[]` and the run passes. Its comment cites this ADR.
- The `levelId` row keeps `voids: [DIALOGUE]`. Its comment changes from "the only remit label it has" to the
  place reason.
- The counts expectation stops naming `subject`.
- If no row already asserts that editing a **question's** `subject` voids that question's grant and no
  other, add one. That is the half of the binding this ADR keeps, and it should be proved by mutation just
  as the half it removes was.

**G4 — `tests/unit/contracts/a-proposition-belongs-to-one-subject.test.ts`.**

- Select the compared corpus **by shape**, not by directory: `claimsIn()` from `scripts/lib/claims.mjs` over
  every non-schema document under `content/`, keeping `kind === 'question'`, in place of `readdirSync` over
  `content/questions/`. Measured: that selects the same 486 documents today, because no question-shaped
  document exists anywhere else. The existing `> 100` floor stays. The scope is the property, "graded", and
  the directory is only where graded things currently live (ADR-0019).
- Pin the ruling the way the file already pins the within-subject exemption: assert that every item in the
  compared corpus is a question document. The failure message says told claims are outside the rule under
  ADR-0030, and that nine cross-subject told-and-graded pairs exist on the tree a widened gate would refuse.
- Change the fault message's "two levels teaching one sentence" to "two subjects grading one sentence".

**`tests/unit/contracts/a-grant-binds-to-its-claim.test.ts` needs no logic change.** It loops over
`DOCUMENT_SCOPE_FIELDS`, and `levelId` is live on all ten quests. Its header's "edits a level's `subject` and
a quest's `levelId`" is corrected alongside G3.

## What this makes impossible

- **Refusing or granting a told claim on the ground that another subject grades its proposition.** There
  is no such ground. A verifier who finds one is reading ADR-0028 without this ADR.
- **After G1, a level's remit edit voiding a verified blurb** — while a quest moved to another level still
  cannot carry its grants with it.
- **After G4, the proposition gate silently widening to told claims**, or silently narrowing to a directory
  that graded items have moved out of.
- **Unchanged: two questions in two subjects resting on one quote.** ADR-0028 §4 holds for graded items
  exactly as before.

What it does **not** make impossible, said once so it is not mistaken for coverage: another subject's
answer shown in an explanation during a mixed Study drill (§3); one proposition told twice on one level
(§2); two subjects grading one proposition from two different sentences (ADR-0028 §4, held by review).

## Alternatives considered

- **Extend ADR-0028's gate to every claim that carries a quote.** It fires nine times on today's tree, and
  not one of the nine changes a floor, an exam row or a schedule. To pass it, a landmark could not say the
  truest thing about itself if another level's bank reached that sentence first — and under ADR-0028 §3's
  first-claim-wins, a blurb's legality would turn on the order in which questions were written *in a
  different subject*. It would also have to exempt the 33 same-subject pairs, at which point it is checking
  a label rather than a harm.
- **Extend it to explanations.** An explanation's sentences have no identity. The check would be text
  similarity — the prompt-matching design ADR-0028 refused for its false negatives — or a new source field
  on every explanation that authors maintain and nothing else reads. And the first thing it forbids is
  corrective feedback (§3).
- **Rule told claims out of scope and leave `subject` bound as a harmless over-bind.** That is today's
  state, and it is not harmless. It voids every verified claim in a level on an edit no verifier's check
  reads, which is the exact ground on which the A4 essay already refused `order` and `textureBudgetBytes`.
  Worse, its `why` asserts the scope this ADR denies, and a reader believes a field before they find the
  ADR. ADR-0028 made the same point about `chapters[].level`: the claim is made where the field is.
- **Drop `levelId` too, since its stated reason fell.** The reason fell; the binding did not. Place is a
  reason of the required kind, and the three lines in §5 are true only where they are said.
- **Gate one quote told twice on one level.** Measured: two cases, and the gate is right about at most one
  of them. The harm is editorial, and a gate that is wrong half the time on its first run trains people to
  ignore it.
- **Gate a blurb that contains a distractor of a question resting on its quote**, as a contradiction
  tripwire. Distractors are short institutional phrases — "The province or territory." — that true prose
  contains constantly.
- **Make Study avoid drawing a question after one whose explanation states its answer.** That is the right
  instrument for §3's residual, and it cannot be built without an identity for explanation sentences. Not
  attempted.

## Consequences

- **Every overlap on record is legal and named.** The four blurb grants stand on a better ground than the
  one they were given on; the four explanation pairs stand; the five found by measurement are decided before
  anyone asks.
- **A level's `subject` means one thing:** the remit of its quest's answer steps and the bank drawn for it.
  `content/schemas/level.schema.json` currently describes it as *"The Discover Canada subject this level
  teaches"*, which invites exactly the reading this ADR refuses. Obligation below.
- **`DOCUMENT_SCOPE_FIELDS` goes from two entries to one.** A one-entry named list is still a named list, and
  the floor in `a-grant-binds-to-its-claim.test.ts` still guards it against going dead.
- **Until G1 lands, gate A4 disagrees with this ADR.** Re-filing a level's `subject` in that window voids
  grants it should not. Nobody is re-filing a level, so the window costs nothing, but it is the one place
  the code is known to be wrong.
- **Three rules here have no gate, and are held by review:** an explanation that surfaces another question's
  answer in a mixed drill is tolerated (§3); repetition within a level is the author's call (§2);
  contradiction between a told and a graded claim is held by entailment review (§2). The first is a known
  effect on the scheduler, recorded as such.

## Obligations

- **OBLIGATION due=2026-10-13 owner=infra** — G1, G2 and G3: `subject` out of `DOCUMENT_SCOPE_FIELDS`,
  `levelId`'s reason restated as place, the A4 essay's "asked and answered no" list extended, and
  `tests/unit/infra/verify-content-gate.test.ts` proving by mutation that a level `subject` edit voids
  nothing while a question `subject` edit and a quest `levelId` edit still void their grants.
- **OBLIGATION due=2026-10-13 owner=infra** — G4: `a-proposition-belongs-to-one-subject.test.ts` selects
  graded items by shape rather than by directory, and pins that no told claim is among them.
- **OBLIGATION due=2026-10-13 owner=content** — reword the `subject` description in
  `content/schemas/level.schema.json` to: *"The teaching remit of this level's quest, and the question bank
  the scheduler draws from for it. Not a claim about what the level's landmark blurbs or dialogue teach
  (ADR-0030)."*

## References

- ADR-0003 and its second amendment: verification follows the claim, not the screen
- ADR-0016: the staleness register, where a guide sentence that stopped being true is handled
- ADR-0019: a rule drawn round a container measures the container
- ADR-0028: a subject is a remit, not a chapter — §1 (the floor), §3 (first claim wins), §4 (the gate)
- ADR-0029 §5: a landmark's lines are written in the second person and the impersonal
- `scripts/lib/claims.mjs` `DOCUMENT_SCOPE_FIELDS`; `scripts/verify-content.mjs`, the essay above
  `claimAuthorFieldsAt`
- `app/ui/exam-screen.ts`, `app/application/use-cases/exam-attempt.ts`,
  `app/application/use-cases/study-session.ts`
