# ADR-0057: A level asks only what it taught, and the teaching is the guide's

- Status: Accepted (2026-09-17)
- Settles: what "teaching before asking" means mechanically, where the extra teaching comes from, what it
  does to a subject's remit, what happens to a question the level never teaches, whether the ruling reaches
  Study and the exam, and how much of it a gate can hold.
- **Extends ADR-0048 from the stop to the task.** ADR-0048 already decided this rule for a landmark with no
  task step being played: it asks only what it just told, or nothing. Nothing there is amended or softened.
  What this ADR does is stop the `answer` step being the one place in the game exempt from it.
- **Amends nothing in ADR-0028 and nothing in ADR-0030.** A subject is still a remit, the floor is still
  thirty, and a subject still owns what it grades. §3 answers the question that makes a reader doubt it.
- **Does not reach Exam mode or Study.** §5, which exists because the opposite reading is the easy one.
- Slice: L3 (`docs/plan/slices.md`).
- Criteria: the rules below, and §6's gate, whose scope grows level by level under §7.
- Numbering. `main` holds ADR-0001…ADR-0037, ADR-0039…ADR-0049 and ADR-0051…ADR-0056; the high-water mark
  across every ref this repository can see — `git log --all --name-only -- docs/adr` — is 0056. **0057 is
  the first number above it.** The hole at 0038, which nothing ever occupied, and 0050, spent by a draft on
  branch `multi-nation-source` that was dropped and never merged, both stay untaken, for the reason ADR-0052
  recorded and ADR-0053 and ADR-0056 restated: a number is retired by having been used, and an ADR filed
  below the ADRs it builds on reads as older than them for ever. The bare numbers in this paragraph carry no
  `ADR-` prefix on purpose — the contract gate in `tests/unit/contracts/documents-name-real-schemas.test.ts`
  resolves every `ADR-NNNN` token to a file in `docs/adr`, and it has gone red twice today on citations of
  records nobody can open.

## Context

### What the product owner said

> we need more learning content. I think the questions are nice, the practice exam is nice, but we need more
> learning content… we're asking questions in the quests that users haven't learned… we need more learning
> before questions on those quests.

Three claims, and all three are true on the tree as it stands. The third is the decidable one, and it is
where this ADR starts: **nothing in this project requires that a question a level asks rests on anything
that level taught.**

### The mechanism, stated exactly

A quest's `answer` step names a `count` and a `questionPool` — "the verified questions in the level's subject
that are about what the step's own prompt says" (slice L1). The draw is then over the level's **subject**
(ADR-0036 §2.1), narrowed by that pool. A pooled question is guaranteed to be verified, bilingual, in the
level's subject and on the step's topic. It is guaranteed **nothing at all** about whether the player has met
the proposition it keys.

The preference that looks like it closes this does not. ADR-0036 §2.4 asks a question resting on the
landmark's own sentence **first**, and ADR-0048 makes that question the only one a stop with no task may ask.
Both are about the *order* and the *no-task* case. Inside an `answer` step the pool still supplies everything
else, taught or not.

### What the teaching surface actually is, measured

Measured on the tree at `605948a` on 2026-09-17, over `content/levels/*.json` and `content/quests/*.json`,
counting a *told* proposition as the `source.quote` of any `factClaim` with `factual: true` — a POI's blurb,
a quest's dialogue line, a giver's `afterLine`. Propositions were de-duplicated with the containment rule
`app/application/content/proposition.ts` uses, so two claims resting on one sentence count once.

| Level (subject) | Verified bank | Told by POIs | Told in dialogue | **Distinct propositions the level teaches** | In-subject questions resting on one of them | Questions the task asks | Ids named by its pools | Pooled ids the level teaches |
|---|---|---|---|---|---|---|---|---|
| halifax (rights) | 38 | 4 | 7 | 11 | 11 | 9 | 25 | 9 |
| peggys-cove (who-we-are) | 48 | 4 | 5 | 9 | **4** | 6 | 12 | 3 |
| quebec-city (history) | 97 | 3 | 6 | 7 | **8** | 9 | 17 | 5 |
| ottawa (government) | 41 | 4 | 5 | 7 | **5** | 7 | 15 | 5 |
| toronto (elections) | 37 | 3 | 6 | 9 | **5** | 8 | 27 | 5 |
| winnipeg (justice) | 39 | 3 | 6 | 9 | 11 | 7 | 13 | 8 |
| prairie-rail (modern-canada) | 40 | 4 | 7 | 11 | **8** | 9 | 19 | 6 |
| alberta-foothills (economy) | 51 | 4 | 7 | 10 | **7** | 9 | 34 | 7 |
| vancouver (symbols) | 43 | 3 | 6 | 9 | 10 | 7 | 12 | 8 |
| the-north (regions) | 59 | 3 | 4 | 6 | 6 | 5 | 13 | 5 |
| **Total** | **481** | 35 | 59 | **88** | **75** | **76** | **187** | **61** |

Three numbers carry the decision:

1. **A level teaches between six and eleven propositions, and asks five to nine questions.** The teaching
   surface is not thin by accident; it is one claim per landmark and a handful of dialogue lines.
2. **126 of the 187 ids the pools name — 67% — rest on a proposition their level never tells.** That is the
   owner's sentence, counted.
3. **A bar alone is not available.** If a level could draw only what it taught, with today's content, **six
   of the ten levels could not finish their own task**: alberta-foothills (7 eligible against 9 asked),
   ottawa (5 against 7), peggys-cove (4 against 6), prairie-rail (8 against 9), quebec-city (8 against 9),
   toronto (5 against 8). the-north would clear by one. A level nobody can finish locks every level after it
   — that is ADR-0054's audit, exactly — and ADR-0052 §1 forbids a dead end as an accessibility rule rather
   than a preference. **So the answer cannot be "ask less"; it has to be "teach more".**

This measurement is a scratch re-implementation of `sharesProposition`, not the module itself, and it is
reported as re-derivable rather than as a gate. §6 makes it a gate, which is the only way a number in a
document stays true.

### The defect that proves nothing in a level requires reading

A separate live defect, being fixed elsewhere and not this ADR's, let a player clear four levels by always
tapping option 1. It is worth recording here for one reason: it demonstrated that **nothing in a level
requires the player to have read anything**. Fixing the tapping defect makes the answer matter. It does not
make the card answerable from what the level taught, and only content can do that.

### What is already settled, and must not be re-litigated here

- **Relatedness between a landmark and its lesson is a preference** (ADR-0056 §6, on the owner's own words).
  This ADR does not reopen the twelve L1 gap rows that stopped being debt. §1 is careful about why: the rule
  below binds *what a question may key*, not *which landmark stands next to it*.
- **Content is the guide's** (ADR-0056 §2 and §4, and the owner's correction quoted there: "the content is
  just what's present on the guide"). More teaching is more guide material surfaced. §2.
- **A stop with no task asks only what it told, or nothing** (ADR-0048). That rule is this rule, already
  decided for half the game.

## Decision

**A level may ask only what it has taught.** Every question a level can put on screen — inside an `answer`
step or at a stop — must rest on a proposition that same level tells the player, in its own player-facing
words, before it asks. The teaching is *Discover Canada*'s material, surfaced rather than invented. Where a
level's teaching does not cover a question, **the level gains the teaching**; barring the question from that
level's draw is the fallback, not the goal.

Seven parts.

### 1. The mechanism: the pool is bound to the level's told propositions

**The rule binds content, at the `questionPool`.** An `answer` step's pool may name only questions whose
`source.quote` shares a proposition — by `sharesProposition`, the containment rule already used by
`a-proposition-belongs-to-one-subject` and by ADR-0036 §2.4 — with a `factClaim` the level itself tells: a
POI blurb on that level, or a dialogue line of that level's quest.

Three consequences of choosing the pool as the seam, rather than the draw or the scheduler:

- **No code changes and no schema changes.** `landmarkDraw`, `scheduleReview` and `StudySession.drill` are
  untouched. A pool that names only taught ids makes every draw from it taught, because the pool is the
  narrowing the draw already applies.
- **It is checkable against the content alone**, which is what makes §6 possible.
- **It keeps the existing teaching carrier.** Nine of the ten quests already alternate `talk`/`visit` and
  `answer`, and a `visit` step's `dialogue` is spoken on arriving at the target, after that landmark's card
  and before the question (`quest.schema.json#/$defs/questStep/dialogue`). *The teach step already exists.*
  What is missing is volume, and the binding between what the step taught and what the next step asks.

**Ordering inside a quest is part of the rule.** The claim a pooled question rests on must be told by a step
**before** the `answer` step that asks it, or by a POI the player must engage to reach that step — not by a
later step, and not by the giver's `afterLine`, which is spoken when the quest is over.

**Why the other four candidates are worse.**

- **Bar the untaught question and change nothing else.** Rejected as a *sole* measure on the measurement
  above: six of ten levels become unfinishable, which locks every level after them. It is also the wrong
  direction — the owner asked for more learning, and this delivers less asking. It survives only as §4's
  fallback, and only for a question the level has no honest way to teach.
- **Grow the blurb into a long teaching card.** Rejected as the primary route, on three counts. A
  `pointOfInterest` carries exactly **one** `fact`, so a card teaching three propositions needs a schema
  change to an array of claims, plus a verifier's grant per claim and a UI that paginates a card which is
  today one screen of CLB-4 prose read on a phone. It also concentrates the teaching in the place where
  reading is least likely — a card the player taps past — and it fights the accessibility rule that a
  question card is read once (ADR-0036 §3). A blurb may grow by a sentence; it is not the instrument for
  tripling a level's teaching.
- **Add more teaching stops.** Rejected as the primary route: every stop is art. A POI needs an art key, a
  reference entry, a blind identification run (`make verify-art`), and it spends the level's 64 MB decoded
  texture budget and its ≤ 8 MB payload. Doubling the teaching this way is an art programme, and it makes the
  cheapest content — a sourced sentence — wait on the most expensive.
- **Teach on a first pass and ask on a second.** Rejected, and this is the closest call. It doubles the
  traversal of every level for the same material, in portrait, one-thumb, with an auto-move option, and it
  breaks the learning moment ADR-0048 identified and paid for: *read a true sentence standing in front of the
  thing, then be asked about that sentence.* Splitting the two by a level's length puts the question where
  the player cannot see what it is about. It also collides with ADR-0032 (every drive stops at each thing it
  can engage) and would make the second pass a corridor of cards.

**What this rule is not.** It does not require a question to be about the landmark it is asked at. ADR-0056
§6 settled that relatedness is a preference, and nothing here disturbs it: a question asked at the combine
harvester must rest on something the *level* taught, which may have been taught three stops earlier by the
guide in the train. The unit is the level, not the stop.

### 2. Where the teaching comes from, and the ceiling that puts on a level

**The guide, and nothing else.** Every new teaching claim is a `factClaim` like every other: a cached
`sourceId`, a chapter, a page, a contiguous `source.quote`, an `asOf`, the `volatile` flag where ADR-0016's
register says so, and a verifier's grant against the `sourceHash` in a separate commit (ADR-0003). There is
no second class of citable source, and "we need more learning content" is not a licence to write one — the
owner has ruled that twice, and ADR-0056 §2 and §4 record it.

**What that implies, said plainly: a level's teaching is finite, and the limit is real.** A subject's remit
is however much of *Discover Canada* carries its material (ADR-0028 §2), and that is a fixed number of
sentences. `economy`'s own chapter is 431 words. A level cannot teach its way past the guide, and when a
level's task wants more propositions than its subject's remit holds, the task shrinks — it does not reach
outside the guide, and it does not stretch one sentence over two lessons. ADR-0056 §6's warning applies to
teaching exactly as it applies to blurbs: **a strained claim is worse than an honest silence.**

**The propositions are already identified, which is what makes this affordable.** Every verified question in
the bank names the sentence it rests on in `source.quote` — 481 of them, 476 distinct. Teaching a
proposition is not new research: it is saying, in the level's own plain-language bilingual words, what the
sentence a question already keys says, and citing the same passage. The author's work is paraphrase,
translation and citation, not extraction. It is still real work, and §7 counts it honestly.

### 3. What this does to a subject's remit: nothing

**A subject's remit is unchanged. A level's *draw* is narrowed.** These are two different objects and the
easiest error in reading this ADR is to merge them.

- ADR-0028 §1's floor of **thirty verified questions per subject** stands, for the reason it gives:
  `study.drillSize` is 5 and the scheduler is FSRS, so a subject the player can exhaust stops being spaced
  repetition. Thirty is a property of the learner's experience of the *subject*, and a level teaching ten
  propositions does not make thirty the wrong number.
- ADR-0028 §2's "a subject draws from wherever in the guide its material appears" stands untouched. A remit
  is about *where in the guide*; this rule is about *what a level may ask*.
- ADR-0030's "a subject owns what it grades, not what it tells" stands, and this ADR leans on it: the new
  teaching claims are **told**, so they enter no floor, no exam row and no schedule, and a level may tell a
  proposition another subject grades without claiming it (ADR-0030 §2). Level documents already do.

So the relation is `a level asks ≤ a level teaches ≤ its subject's remit`, with the last inequality usually
strict and expected to stay strict. **A subject grades more than any one level teaches, and the surplus is
not waste: it lives in Study and in the exam**, which is where the other 400 questions are already met. A
level is a *sample* of its remit with the teaching attached, not the whole of it.

One thing this does narrow, and it is worth saying: **a level's task can no longer be enlarged just because
its subject's bank is large.** Québec City's `history` bank is 97 questions; the level teaches 7. Its task
asks 9 today and may ask as many as it teaches, once it teaches them — not 97.

### 4. A question the level never teaches: the level gains the teaching

**The level gains the teaching. That is the ruling, and it is the more expensive of the two options.**

The fallback exists and is narrow: **a question whose proposition the level cannot honestly teach leaves that
level's pool and stays in the bank.** Nothing is deleted, nothing is re-homed, no id changes. It is asked in
Study and in the exam like every other question, and its subject keeps it for the floor. "Cannot honestly
teach" means one of two things, both judgements a verifier can check: the proposition belongs to a region of
the guide this level has no occasion to visit, or teaching it here would mean stretching a sentence onto a
place it is not about.

**Why this way round, in the owner's own terms.** Barring is free and teaches nobody; it would answer "we
need more learning content" by deleting questions. Teaching costs authoring and is the thing that was asked
for. The measurement decides it as well: barring alone breaks six levels (§Context), so it cannot stand on
its own even if it were wanted.

**What the authoring costs, per proposition**, so nobody reads "the level gains the teaching" as a small pass:

- one player-facing sentence or two, in **EN and FR**, at roughly CLB 4, non-verbatim, written into a
  dialogue line of an existing `visit`/`talk` step or into a POI blurb;
- a full `source` block — `sourceId`, `chapter`, `page`, `url`, `sourceHash`, `asOf`, `volatile`, and a
  contiguous `quote` — the same block a question carries;
- a **separate verifier commit** granting it against that hash, with the passage quoted as `evidence`;
- and, where the claim lands in a blurb that already has a grant, gate A4 unbinds that grant, so the level is
  red between the author's commit and the verifier's (ADR-0003, ADR-0056's consequence). That is the gate
  working, and it is two commits every time.

§7 multiplies this by the deficit.

### 5. Exam mode and Study are not the same case, and this ruling does not reach them

**Stated as a decision, not an omission.**

- **The exam tests the whole bank by design.** `CLAUDE.md` puts it as mirroring IRCC — 20 questions, 15 to
  pass, 30 minutes — and `exam-session.ts` spreads the draw across every subject with a bank. Requiring the
  exam to ask only what some level taught would either shrink the exam to the 75 questions the ten levels
  currently cover, or make the exam a re-run of the levels. Both destroy the one thing the exam is for:
  telling the player whether they would pass a test drawn from the whole guide. A learner who is asked only
  what the game taught learns the game, not the guide.
- **Study is the player asking, not the game asking.** `study-session.ts` calls `loadEveryBank` with no
  scope: a drill is five questions from everything, chosen by the scheduler from the player's own review
  state. The player opened Study. Withholding a question there because no level taught it would hide the
  material from the one screen whose purpose is to practise it, and it would break FSRS, whose intervals are
  a property of the whole bank.
- **The principle that separates them, in one line:** *this rule binds the places where the game chooses to
  ask; Study and the exam are the places where the player does.* A level puts a card in front of somebody who
  came to walk through Halifax. That is why it owes them the sentence first.
- **The residual, named:** a player who only plays levels meets 75 of the 481 propositions in the game, and
  then meets the rest for the first time in an exam. That is not a defect introduced here — it is today's
  behaviour, and this ADR makes it visible by counting it. It is the strongest argument for growing the
  teaching until a level covers much more of its subject, and the weakest possible argument for letting a
  level ask what it never said.

### 6. What a gate can hold, and what it cannot

**It can hold the mechanical half, and the half it holds is the one that has failed.**

A contract test, `tests/unit/contracts/a-level-asks-what-it-taught.test.ts`, specified fully enough to be
built without further design decisions:

1. **Corpus.** Every level in `content/levels/*.json` and every quest in `content/quests/*.json`, read off
   the disk by a route the bundle does not take, as `a-quests-answer-steps-fill-in-one-sitting.test.ts`
   already does.
2. **A level's told propositions** are the `source.quote` of every `factClaim` with `factual: true` reachable
   in that level document and in the quests whose `levelId` is that level — POI blurbs, step dialogue,
   `declinedLine`, `reminderLine`, `afterLine` — excluding `afterLine`, which is spoken after the quest ends.
   `verification.status` must be `verified`: an ungranted claim teaches nothing that has been checked.
3. **The assertion.** For every level in the **covered list** (§7), every id in every `answer` step's
   `questionPool` rests on one of that level's told propositions, by `sharesProposition` from
   `app/application/content/proposition.ts` — the same module, imported, not a copy.
4. **Order.** For a pooled id told only by a quest dialogue line, the telling step's index is lower than the
   `answer` step's.
5. **Failure output** names level, quest, step id, question id and the quote, for **every** offender, not the
   first.
6. **The covered list may never shrink**, and an empty list must fail rather than pass vacuously (ADR-0024).
   Every level in `journey` is either in the covered list or in a deficit table the test prints with its
   count, so a level outside the rule is *reported on every run* instead of being silent.

**What it cannot catch. Written so its silence is not read as coverage (ADR-0019's third test).**

- **A blurb that states a fact and teaches nothing.** "Trade and commerce is the engine of economic growth"
  as a caption on a shipping container satisfies every clause above and may leave a reader with nothing. The
  gate compares *quotes*, and a quote is an identity, not a lesson. Whether a sentence teaches is a judgement,
  and the reader who holds it is the **author** — it belongs to the author's brief, not to a sixth
  verification check. Saying this plainly matters for the same reason ADR-0052 §4 said it: after this ADR, a
  `verification.status = "verified"` on a teaching claim means what it always meant — the claim is true and
  entailed by the cited passage — and **not** that the sentence teaches.
- **Paraphrase, in both directions.** ADR-0028 §4 settled that no string identifies a paraphrase. A level
  that teaches a proposition from a *different* sentence than the question quotes reads as untaught and
  fails loudly, with the named remedy of quoting the sentence the question rests on. One sentence carrying
  two propositions reads as taught when only one was told, and passes wrongly. The first is a loud false
  positive with an instruction; the second is a silent false negative, and it is the verifier's to catch.
- **Whether the player read it.** A `visit` step's dialogue can be dismissed. Nothing here, and nothing that
  should exist, requires reading — ADR-0052 §1 forbids a wall, and a comprehension check is a test in the
  place the game promised not to test.
- **Order outside a task.** A stop is already held by ADR-0048. A player wandering a level out of order can
  meet a card before its lesson if the lesson is on a quest step they have not taken; the rule's order clause
  covers the task, which is the path the game directs.

### 7. How it lands without making any level unfinishable

**Level by level, in `journey` order, and the gate's covered list is the record of where it has got to.** A
level joins the list in the commit that makes it true, and never leaves.

This is not caution for its own sake. Turning the rule on everywhere today would empty six pools below their
steps' counts, and a step that cannot fill is the defect ADR-0054 exists to prevent — the one that locked
Québec City and everything after it for every new player. The existing gates
(`an-answer-steps-pool-can-fill-its-count`, `a-quests-answer-steps-fill-in-one-sitting`) stay green
throughout, and they are what stops an author narrowing a pool below its count in the name of this ADR. **If
a pool cannot be both taught and full, the teaching is what grows.**

**The scale, honestly.** Two bounds, both measured, and neither is a tidy-up:

- **Floor: about 64 new teaching claims.** Holding each level to teaching at least twice what its task asks —
  headroom the scheduler's exclusion window and a replay need — the deficits are alberta-foothills 8,
  halifax 7, ottawa 7, peggys-cove 3, prairie-rail 7, quebec-city 11, the-north 4, toronto 7, vancouver 5,
  winnipeg 5. Every one must be a proposition **in that level's subject**, and every pool must then be
  re-authored to the taught set.
- **Ceiling: about 126 new teaching claims**, if every pool keeps the ids it names today, because that is how
  many pooled ids rest on nothing their level tells.

At roughly 12 per level, in two languages, each with a citation and each needing a verifier's grant in its
own commit, **this is a teaching pass over all ten levels — a content programme, not a pass over a few
files.** Anyone reading this ADR as a small fix should read the table in Context again.

## What this makes impossible

- **An `answer` step pooling a question the level never tells**, on any level in the covered list.
- **Answering "the player was asked something they never learned" by deleting the question**, except under
  §4's narrow fallback, with a reason a verifier can check.
- **Teaching from outside *Discover Canada* to close a deficit.** §2, and the owner's correction in
  ADR-0056.
- **Enlarging a task because its subject's bank is large.** §3.
- **Reading this as a requirement that a question be about the landmark it is asked at.** §1; ADR-0056 §6
  stands.
- **Narrowing a pool below its step's count to satisfy this rule.** §7, held by two existing gates.
- **Applying it to Study or the exam.** §5.

## Alternatives considered

- **Bar untaught questions and stop there.** Rejected: six of ten levels unfinishable today (§Context), it
  answers a request for more teaching with less asking, and it locks the journey. Kept only as §4's fallback.
- **A long teaching card at each landmark.** Rejected: one `fact` per POI means a schema change, a grant per
  claim and a paginated card, and it puts the teaching where the player taps fastest. §1.
- **More teaching stops.** Rejected as the primary route: every stop is art, a reference entry, a blind
  identification run and texture budget. §1.
- **A teach pass then an ask pass over the level.** Rejected: doubles every level's traversal, separates the
  question from the thing it is about, and discards the learning moment ADR-0048 bought. §1.
- **A new `teach` step kind in `quest.schema.json`.** Rejected: `visit` and `talk` with `dialogue` already
  are that step, and nine quests already use them that way. A fourth kind that behaves like `visit` and is
  spoken like `visit` would split one concept across two names, and every gate and renderer would have to
  learn both. If teaching ever needs a behaviour `visit` cannot express — a card with no target, say — that
  is an additive schema change with its own ADR and a measurement behind it.
- **Bind the rule to the draw or the scheduler instead of the pool.** Rejected: it hides a content rule in
  code, makes it uncheckable against `content/` alone, and would have `scheduleReview` silently drop ids —
  producing a short draw, which is the shape of the ADR-0054 blocker.
- **Require the player to have *read* the teaching before the question unlocks.** Rejected: unreadable
  through the accessibility rules, a wall with no way past (ADR-0052 §1), and unmeasurable — a dismissed
  dialog and a read one are the same event.
- **Make the level's `subject` narrower so that the remit equals what the level teaches.** Rejected: it
  breaks the thirty floor (ADR-0028 §1), re-homes verified questions for no learner-visible gain (§3), and
  would take the exam's by-subject rows with it (ADR-0030 §1).
- **Teach from Wikipedia, a museum page or a government page where the guide is thin.** Rejected; the owner
  has ruled twice and ADR-0028's Context has the two traps this catches — construction counted in the wrong
  sector, free trade dated to the wrong year — where a learner would be marked wrong against the document
  the exam is drawn from.

## Consequences

- **Every level's quest gains dialogue, and the ten levels together gain roughly 64 to 126 new cited,
  bilingual, verified teaching claims.** This is the largest content programme since the question banks
  themselves, and it is paced by the verifier, not the author.
- **`make verify-content` will be red often and briefly**, between each author commit and its verifier
  commit, because a new claim in a granted blurb unbinds that grant (A4). Expected, and not a reason to batch
  the two into one commit — the separation of duties is the point.
- **Levels become longer to play in dialogue, not in distance.** Nothing moves; the guide says more on the
  way.
- **The L1 gap list is untouched by this ADR.** Its twelve acceptable rows stay closed (ADR-0056 §6) and its
  twelve opportunity rows keep their obligation. A landmark that asks nothing outside a task remains a
  legitimate end state.
- **Six levels' pools will be re-authored**, and `an-answer-steps-pool-can-fill-its-count` plus
  `a-quests-answer-steps-fill-in-one-sitting` are the two gates that keep that honest.
- **Nothing in the game changes today.** No code, no schema, no port, no content in this commit. This ADR is
  written before the content exists, which is the only time it can shape it.
- **A player who plays only levels still meets a minority of the bank**, and this ADR counts that (§5) rather
  than fixing it. Fixing it is the teaching programme continuing past the floor in §7.

### Rules stated here that no gate can express

- **Whether a sentence teaches.** §6. The author holds it; a verifier who grants a true, dull, unteaching
  sentence has made no error under ADR-0003.
- **Whether a proposition is one the level can *honestly* teach**, or a sentence stretched onto a place it is
  not about (§2, §4). ADR-0056 §6's warning, and the same judgement.
- **Whether teaching came before asking for a player moving freely**, outside the quest's step order (§6).
- **Whether the teaching is at the reading level it claims.** CLB 4 is reviewed, not measured.
- **Whether twice the asked count is the right headroom.** §7's floor is a judgement about spaced repetition
  and replay, taken from ADR-0028 §1's reasoning about drill size. It is the number to revisit first if
  replays start repeating.

## Obligations

- **OBLIGATION due=2026-11-17 owner=infra** — build §6's gate,
  `tests/unit/contracts/a-level-asks-what-it-taught.test.ts`, to the six clauses above, importing
  `sharesProposition` from `app/application/content/proposition.ts` rather than copying it. It ships with a
  covered list holding **at least** `halifax`, so it is not vacuous on its first run (ADR-0024), prints the
  deficit for every uncovered level in `journey`, and fails when the covered list is empty or has shrunk.
  Until it lands, the numbers in this ADR are a scratch measurement and nothing holds the rule.

- **OBLIGATION due=2026-12-17 owner=content** — close the teaching deficit on the first five levels of
  `journey` — `halifax`, `peggys-cove`, `quebec-city`, `ottawa`, `toronto` — by authoring guide-sourced
  teaching claims into their quests' `visit` and `talk` dialogue, re-authoring each `answer` step's pool to
  the taught set, and adding each level to §6's covered list in the commit that makes it pass. Deficits
  measured 2026-09-17: halifax 7, peggys-cove 3, quebec-city 11, ottawa 7, toronto 7 against §7's floor. The
  author never sets a `verification` status, and never narrows a pool below its `count`.

- **OBLIGATION due=2027-01-17 owner=content** — the same for the last five levels of `journey` — `winnipeg`,
  `prairie-rail`, `alberta-foothills`, `vancouver`, `the-north`. Deficits measured 2026-09-17: winnipeg 5,
  prairie-rail 7, alberta-foothills 8, vancouver 5, the-north 4. When the last level joins the covered list,
  say so here and discharge this marker with the commit that did it.

- **OBLIGATION due=2027-01-17 owner=content-verifier** — grant or refuse every teaching claim authored under
  the two markers above, in commits separate from the author's, against the `sourceHash` each claim cites,
  quoting the passage as `evidence`. Refuse any claim whose sentence is not in the cited chapter at that
  hash, and any whose link to the level is a stretch (§2). A level may not join §6's covered list on
  ungranted teaching.

- **OBLIGATION due=2027-02-17 owner=architect** — re-measure the table in Context over the tree as it then
  stands and record, in an amendment to this ADR, what a level teaches against what it asks. If the covered
  list is not all ten levels, re-date the content markers with what was tried rather than letting them lapse
  (ADR-0009), and say whether §7's floor of twice the asked count survived contact with the authoring.

## References

- The product owner's words, quoted in Context: more learning content; questions in the quests users have
  not learned; more learning before questions
- ADR-0048 (a stop with no task asks only what it told — this rule, already decided for the no-task case),
  ADR-0036 §2 (a level asks its own subject; the landmark's own question first), ADR-0054 (a step must fill
  in one sitting; the pool that could not), ADR-0052 §1 (no pass mark, no dead end)
- ADR-0028 §1, §2 and §4 (the thirty floor, a remit is not a chapter, the proposition is identified by its
  quote), ADR-0030 §1 and §2 (a subject owns what it grades; told claims are outside the rule)
- ADR-0056 §2, §4 and §6 (what a POI teaches is the guide's; Study and exam questions are guide-only;
  relatedness is a preference and most of the L1 gap list is not debt), ADR-0003 (citation, the
  author/verifier split, gate A4), ADR-0016 (staleness, `volatile`, 180 days)
- ADR-0019 (name what a rule does not measure), ADR-0024 (an empty collection must not reduce to a pass),
  ADR-0009 (the obligation format above), ADR-0012 (FSRS, and why a drill needs headroom)
- `content/schemas/quest.schema.json#/$defs/questStep` — `questionPool`, `count`, `dialogue`;
  `content/schemas/level.schema.json#/$defs/pointOfInterest` — one `blurb`, one `fact`
- `app/application/content/proposition.ts` (`sharesProposition`), `app/bootstrap/landmark-questions.ts`
  (the draw rule), `app/application/use-cases/study-session.ts` (`loadEveryBank`, no scope),
  `app/application/use-cases/exam-session.ts` (quotas across every subject)
- `docs/plan/slices.md` — slice L3, and the *L1 gap list* this ADR leaves closed
