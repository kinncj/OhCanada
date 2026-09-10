# ADR-0028: A subject is a remit, not a chapter

- Status: Accepted (2026-09-09)

## Context

`content/questions/economy/` holds 19 questions, 18 of them verified. `CLAUDE.md` requires thirty verified
before level 8 ships. The question was
put as a choice between widening the subject, granting the subject a floor exception, and not shipping
level 8 at all.

It is none of those three, because the premise under all of them is false.

### The chapter is 431 words and the refusal to pad it is correct

*Canada's Economy* is pages 90–92 — the shortest chapter in the guide. An author measured it and wrote 18
propositions rather than inventing more; a verifier re-measured and found one; a third author went looking
for a second source and refused to use one. That refusal is right and is not being revisited here. IRCC's
own sentence, cached in `content/sources/discover-canada.json`, is decisive: *"All the citizenship test
questions are based on information provided in this study guide."* Two concrete traps were found and
rejected — Statistics Canada puts construction in goods-producing where the guide puts it in **service
industries**, and Global Affairs dates free trade to 1987/1989 where the guide says **1988**. A question
sourced outside the guide marks a learner wrong against the document the exam is drawn from.

So the bank cannot grow from a new source. The only question is whether it can grow from the guide.

### It already has, twice, in a level that shipped green

`content/questions/government/` holds 38 verified questions. Eleven of them cite the chapter **Federal
Elections**, which `content/sources/discover-canada.json` maps to level 5, while `government` is level 4's
subject. They are unambiguously governance material: `gov-53-what-cabinet-does`, `gov-54-official-opposition`,
`gov-57-by-laws`, `gov-58-municipal-council`, `gov-63-band-chiefs`. They sit on pages 60–69, inside the
Federal Elections chapter's 60–74.

And they do not merely share a chapter with level 5's bank. They share **pages**:

| Page | `elections` questions | `government` questions |
|---|---|---|
| 60 | 12 | 1 |
| 62 | 9 | 1 |
| 63 | — | 3 |
| 66 | 1 | 3 |
| 67, 69 | — | 3 |

Level 4 shipped on that basis. Every gate is green on it. Nobody wrote it down.

So "widen `economy`'s remit" is not a new precedent that needs justifying against the existing rule. It
**is** the existing rule, applied for a second time, and the thing that was never recorded is that the rule
exists at all.

### What was actually wrong

Two artefacts asserted a one-to-one mapping between chapters and levels, and neither was ever true:

1. `content/schemas/source.schema.json#/$defs/sourceChapter/properties/level` — *"Which of the ten levels
   teaches this chapter, when one does."*
2. `content/sources/discover-canada.json#/chapters[*]/level` — the ten values.

Nothing reads either one. `grep` across `app/`, `scripts/`, `tests/` and `content/` finds no consumer:
the citation gate checks `chapters[].title`, `chapters[].page` and `chapters[].endPage`, and never `level`.
It is a false claim with no caller, which is the cheapest possible kind of defect and the one most likely to
be believed, because a reader reasonably assumes a field in a schema is load-bearing.

This is `ADR-0019` case 5, and it is the un-loud variety that ADR warned about: **a rule drawn round the
chapter measures the chapter, not the property.** The property is *which subject teaches this proposition*.
The chapter does not carry it — pages 60–69 are the proof. Neither does the page — pages 60, 62 and 66 are
the proof. The smallest thing that carries it is the proposition, and the only thing in this repository that
is one-per-proposition is a question document.

### What TN-LEVELS-03 actually forbids

> its question bank has at least thirty verified questions for its subject, and **shares none of them with
> another level's subject**

"Shares none of *them*" — them being questions. A question document has one `subject` string; a level
document names one subject; therefore no two levels can claim one question. The row says nothing about
chapters, and widening a remit does not weaken it. What the row does not currently have is any mechanism
at all: two authors working the same pages could write the same proposition into two subjects, and nothing
would notice. That gap is what this decision makes live, so this decision closes it.

## Decision

**A subject is a teaching remit. A chapter is where the sentences are. The relation is many-to-many, the
unit of exclusive claim is the proposition, and the proposition is identified by `source.quote`.**

Six parts.

### 1. The floor stays at thirty, for every subject, with no exceptions

`SUBJECT_SHIP_THRESHOLD = 30` in `app/application/content/question-bank.ts` is unchanged, and this ADR
grants no exception to it.

What the floor is for, stated so the next request to bend it has something to argue against: `study.drillSize`
is 5 and the scheduler is FSRS (ADR-0012). A subject the player can exhaust stops being spaced repetition and
becomes a memorised sequence — the learner recognises the card rather than recalling the fact, and the
scheduler's intervals are measuring the wrong thing. Thirty is six distinct drills before the first repeat.
Nineteen is under four, and a twenty-question exam (`exam.questionCount`) drawing across ten subjects would
be sampling two of every nineteen from this one. The floor is a property of *the learner's experience of the
subject*, which is exactly why it must not be scaled to *the chapter's word count*. "Thirty unless the source
is short" is not a rule, it is the absence of one, and it would arrive back here the moment someone measures
*The Justice System* (504 words, 31 questions, one over).

The number lives in one constant in `app/application` so that it cannot become a table of per-subject
exceptions. That was deliberate and it stays.

### 2. `economy`'s remit is stated, and it is not "chapter 90–92"

**`economy` teaches what the guide says about how Canadians earn a living, what Canada makes and sells, and
who Canada trades with — wherever in *Discover Canada* that material appears.**

Three regions of the guide carry it:

| Where | What is `economy`'s |
|---|---|
| *Canada's Economy*, pp. 90–92 | all of it; already claimed, 19 questions, 18 verified |
| *Modern Canada*, pp. 45–46 | the postwar economic material: oil in Alberta 1947, employment insurance, the Canada Health Act, CPP/QPP. **Not** GATT becoming the WTO — `mc-01-gatt-became-the-wto` already claims it; see §3 |
| *Canada's Regions*, pp. 93–129 | the resource and industry material only: what each province and territory produces, fishes, mines, grows, manufactures and ships |

**`modern-canada` keeps** the arc of the country since 1945 as events, politics and institutions — and keeps
every question it has already written, including `mc-01-gatt-became-the-wto`.

**`regions` keeps** everything else in pp. 93–129: the five regions, the provinces and territories and their
capitals, where people live, the languages spoken where, the landscape, and the peoples of each region.

### 3. Where two remits could both carry a proposition, the question that exists claims it

This is the boundary rule, and it is decidable by an author alone, with no adjudication: **look. If a
question already rests on that sentence for that proposition, it is claimed; write around it.**

`mc-01-gatt-became-the-wto` exists in `modern-canada`. It stays there. `economy` does not re-ask it, in any
wording. That is what "shares none of them" means, and it costs `economy` exactly one of the propositions
the author listed on pp. 45–46.

The rule is first-claim-wins rather than best-fit-wins on purpose. Best-fit invites re-homing verified
questions every time a remit is written down more precisely, and re-homing a verified question changes its
id, its file, its level's bank size and nothing a learner can perceive. Churn with no learner benefit is not
a tidiness improvement.

### 4. The claim is enforced at the grain of the proposition, by the quote

`tests/unit/contracts/a-proposition-belongs-to-one-subject.test.ts` fails when **two questions in different
subjects rest on the same `source.quote` of the same source.**

`source.quote` is the sentence the author lifted from the guide, it is required by
`content/schemas/question.schema.json`, and all 390 questions in the tree carry one. It is the closest thing
in this repository to a proposition's identity, and it is written by the author as a side effect of doing the
job properly rather than as an extra field to maintain.

Measured on the tree as it stands: 14 duplicate quotes **within** a subject and **zero across** subjects.
Both numbers are the right ones. One sentence routinely carries several propositions — page 90's NAFTA
sentence carries 1988, 1994 and a 2008 magnitude — so sharing a quote inside a subject is normal authoring.
Sharing one across subjects is two levels teaching one sentence, which is the thing TN-LEVELS-03 forbids.

It passes on level 4 and level 5 as shipped, which is the evidence that it measures the boundary and not the
chapter: the eleven cross-chapter `government` questions share pages with `elections` and share no quote
with it.

**What this gate does not catch, stated so its silence is not read as coverage (ADR-0019 test 3):** two
authors paraphrasing one proposition from two different sentences. There is no string in this repository
that identifies a paraphrase, and there will not be one. That check belongs to the `content-verifier`, who
reads the chapter, and it is recorded here as a rule enforced by review rather than by CI. The gate is a
tripwire on the failure that is machine-visible — copy-paste, and two authors lifting the same sentence,
which is the realistic failure when two subjects are pointed at one chapter for the first time.

The gate can also fire **wrongly**, when one sentence genuinely carries two propositions that belong to two
subjects. That is a visible failure with a named remedy in its message: narrow one quote to the clause its
question actually rests on. A loud false positive with an instruction is the correct trade against a silent
false negative.

### 5. `chapters[].level` is removed

Removed from `content/schemas/source.schema.json#/$defs/sourceChapter` and from all ten entries in
`content/sources/discover-canada.json`. It has no caller, and per ADR-0015 a thing with no caller and no
reason to wait is pruned rather than tripwired.

`additionalProperties: false` on `sourceChapter` is the tripwire that replaces it: reintroducing `level` now
fails `make validate-content` with the property named. Nothing needs writing to achieve that; it is already
there — and it fired immediately, naming four more manifests that carried the field:
`cirnac-treaty-7.json` (8), `parks-canada-the-forks-nhs.json` (6), `twnation-our-story.json` (9),
`usask-indigenous-sk-treaty-4.json` (7).

Those four are worth separating out, because there the value was *true*. Each is a single-chapter territorial
source cited by exactly one level's "About this place" panel, so "which level uses this" had a real answer.
They are removed anyway, for a different reason: **a level names its sources; a source does not name its
levels.** The level document is the thing that has to be edited when a panel's sourcing changes, and a
back-pointer in the source manifest is a second place to keep in step with no reader to justify it.

All four values were **accurate** when checked against `content/levels/`, and that is the argument rather than
against it. They were removed for the direction of the pointer, not for being wrong; had one of them been
wrong, nothing would have said so, because the levels that cite these four sources cite them from their own
documents and never consult this field. A back-pointer that is correct today and unread is a back-pointer
that will be wrong later and still unread.

### 6. The 2008 trade figures are flagged with banned terms, not noted

Page 90 reads:

> Mexico became a partner in 1994 in the broader North American Free Trade Agreement (NAFTA), with over 444
> million people and over $1 trillion in merchandise trade in 2008.

A 2008 magnitude printed as a present-tense fact, in the same sentence as a treaty that no longer exists.

"Nothing cites it and nothing should" is true of today's bank and is not a control. §2 sends an author onto
page 90's neighbours hunting for propositions, and a magnitude in a sentence is the most tempting thing on a
short page. A prose note is advice to someone who has already read the manifest; `bannedFromAnswers` is
checked in options and explanations, in both languages, by a gate that already runs on every question.

It is recorded as a third `knownStaleness` entry on page 90 rather than folded into the NAFTA entry, because
it is a different stale claim with a different reason — the NAFTA entry is about a treaty that was replaced,
this is about a number that was never meant to be read as current — and ADR-0016's register is one entry per
claim, which is why G8 and NAFTA are already separate on the same page.

Both the stale figures **and** any updated ones are banned, for the reason G7 is banned beside G8: a 2026
trade figure is right about the world and wrong about the document the exam is drawn from. `upstream` is
`does-not-revise`, matching the two flags beside it and the live check of 2026-09-09 that found the page
unrevised — so under ADR-0016 §2 row 2 this adds **no** new `volatile` demand to the five existing page-90
questions, and none of them contain any banned term.

## Alternatives considered

**Record a floor exception for `economy` by ADR.** Rejected on three grounds. It answers a question nobody
should have needed to ask — the material exists inside the guide, and an exception would have shipped a
19-question subject while pp. 45–46 and pp. 93–129 sat unclaimed. It requires editing
`SUBJECT_SHIP_THRESHOLD` or wrapping it in a per-subject table, turning one number with one home into a
negotiable list, and the second entry always costs less to add than the first. And the justification —
"the chapter is short" — is a fact about the source, while the floor is a promise about the learner; a
learner drilling `economy` does not know or care that its chapter is 431 words.

**Level 8 does not ship.** This would have been the right answer if the guide genuinely contained only 19
economic propositions. It contains more than 19; they are on pages that no shipped subject claims. Refusing
to ship over a shortage that is an artefact of an unwritten chapter-to-level mapping would be refusing for a
reason that does not exist. (Recorded because we have refused things all session for less, and the test of
that habit is whether it also stops.)

**Partition the guide by page range, one range per subject, and gate it.** This was the first design and it
is wrong, which is worth recording because it is the obvious one. It fails on the existing tree: page 60
carries 12 `elections` propositions and 1 `government` proposition, page 66 carries 1 and 3. A page-range
partition would have to either split those pages, which is arbitrary, or fail level 4, which shipped
correctly. The page is a container, it does not carry the property, and reaching for it would be ADR-0019
case 6 in the ADR that names case 5.

**Gate on normalised prompt text instead of `source.quote`.** Weaker in exactly the direction that matters.
Two authors writing the same proposition will phrase the prompt differently more often than not — the whole
skill of the job is varied phrasing — so prompt matching has false negatives on the common case, and a gate
with false negatives on the common case is worse than none because its silence reads as coverage
(ADR-0015). The quote is the source's words, not the author's, so two authors on one sentence produce the
same string. Prompt equality is checked too, as a cheap copy-paste catch, but it is not the mechanism.

**Absorb `regions` into `economy` and give level 10 a different subject.** Unnecessary and it costs the map
its tenth chapter. `economy` takes the industry and resource material out of a 37-page chapter, which is a
minority of it; §2 lists what remains and it is the substance of the chapter, not a remainder. See the
obligation below for what happens if that estimate is wrong.

**Keep `chapters[].level` and document it as advisory.** A field whose description says "which level teaches
this chapter" cannot be made advisory by prose elsewhere, because the reader who is misled by it is the one
who did not read the prose. ADR-0018's finding applies: the claim is made where the field is.

## Consequences

**Level 8 ships when `economy` reaches thirty, and the work is authoring, not architecture.**
`content/questions/economy/` holds 19 documents of which **18 are shippable** —
`eco-19-industrialized-country` is `unverified` and is the verifier's, not an author's. So the work is one
verification plus **eleven new questions**, from *Modern Canada* pp. 45–46 and *Canada's Regions* pp. 93–129,
cited to those chapters with a `page` inside 45–53 and 93–129 respectively.
`tests/unit/contracts/questions-cite-a-cached-source.test.ts` accepts those citations today — it checks the
chapter title against the manifest and the page against that chapter's range, and has never checked the
chapter against the subject.

`question-bank-floor.test.ts` stays **red** on `alberta-foothills` until that lands. That is the gate working:
this ADR unblocks the authoring, it does not pretend the bank is finished, and nothing here was written to
turn a failing gate green.

**Level 10 keeps `regions` as its subject and loses the industry material.** What is left to it is the five
regions, ten provinces and three territories with their capitals, population distribution, languages,
landscape and the peoples of each region, across 37 pages — the longest chapter in the guide by a factor of
twelve over *Canada's Economy*. The estimate that this clears thirty is an estimate; nobody has counted
propositions in pp. 93–129 and this ADR does not pretend otherwise.

- **OBLIGATION due=2026-11-09 owner=content** — before authoring level 10's bank, count the verified
  propositions available to `regions` in pp. 93–129 with the industry and resource material removed. If the
  count is under thirty, reopen this ADR rather than bending the floor or narrowing `economy`'s take after
  the fact. Level 10 is blocked on `docs/content-review.md` Indigenous content review and cannot ship before
  this date on any path, so the count costs nothing to do first.

**A live check on *Canada's Regions* is now a precondition, not a nicety.** The chapter has no `liveChecks`
entry and no `knownStaleness` flag, and it is where a 2012 guide keeps its most perishable facts —
populations, resource rankings, "Canada's newest territory". `economy` drawing any of its remaining eleven
questions from an unaudited 37-page chapter imports unflagged staleness into a shipping level. *Modern
Canada* pp. 45–53 carry no flag and can be authored first, so this does not block the work — it blocks one
half of it.

- **OBLIGATION due=2026-10-09 owner=content-verifier** — live-check *Canada's Regions* against canada.ca and
  record the finding in `content/sources/discover-canada.json#/liveChecks`, with page-grain `knownStaleness`
  entries for every point-in-time fact found, before any `economy` question cites that chapter.

**The `government`/`elections` overlap is now recorded rather than tacit.** Eleven questions on pages 60–69
stay where they are. They are re-described by this ADR, not moved: `government`'s remit includes how the
levels of government divide responsibility, and the guide happens to print that inside the elections
chapter.

**`docs/stories/TN-LEVELS-2-to-10-spine.md`'s `OQ-SPINE-3` answer is now partly stale** — it says `economy`,
`symbols` and `regions` "have no bank at all", and `symbols` has 42 verified questions and `economy` has 19.
Not corrected here; that file belongs to the stories directory and the correction is a sentence, not a
decision.

**A question is no longer locatable by chapter alone.** Anyone asking "which level teaches page 47?" must
now read the questions, because the answer is per-proposition. That is a real loss of a convenient lookup,
and it is the honest state of affairs rather than a new one: the lookup has been wrong since level 4
shipped, and it was convenient precisely because it was wrong.
