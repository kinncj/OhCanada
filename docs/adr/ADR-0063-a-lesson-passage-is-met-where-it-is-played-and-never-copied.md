# ADR-0063: A lesson passage is met where it is played, and never copied

- Status: Accepted (2026-09-20)
- Settles: how a player meets a lesson passage while playing a level; whether that needs a new quest step
  kind; what identifies a passage from outside its own document; and what ADR-0028 actually forbids here,
  which is not what it is widely read to forbid.
- **Amends ADR-0061 §4**, in one sentence and no further: a passage read *inside a level, on the quest path,
  before the step that asks* is told by that level for ADR-0057's purposes. §5. Nothing else in ADR-0061
  moves — not the Learn surface, not the chapter organisation, not the exclusion of lessons from the floor,
  the exam or the scheduler.
- **Amends nothing in ADR-0028, ADR-0030 or ADR-0003.** §2 shows that the rule everyone expected to bind
  this decision does not reach it, and has not since ADR-0030.
- Slice: L4 (`docs/plan/slices.md`).
- Numbering. `main` at `5c545ca` holds ADR-0001…ADR-0037, ADR-0039…ADR-0049 and ADR-0051…ADR-0062. The
  high-water mark across **every ref this repository can see** is 0062, taken from `git log --all` over
  `docs/adr` **and** `git ls-remote --heads origin`, which reports exactly two remote heads (`main` and
  `archive/v0.1`), so no number is claimed on an unfetched branch. **0063 is the first number above it.**
  The holes at 0038, which nothing ever occupied, and at 0050, spent by a dropped draft, stay untaken, for
  the reason ADR-0052 recorded and ADR-0056, ADR-0057 and ADR-0061 restated: a number is retired by having
  been used, and an ADR filed below the ADRs it builds on reads as older than them for ever. This check was
  made because it has failed before — on 2026-09-17 two agents on branches that could not see each other
  both took 0057 and both landed.

## Context

### What the owner said, and the arithmetic under it

> I need more content and quests…. there's not even 10% of the study guide when playing it

Measured on `5c545ca`, which is `main`:

| | Count |
|---|---|
| Verified questions in the bank | **493** |
| Lesson passages shipped in `content/lessons/` | **302**, in 48 lessons over 10 chapters, **every one `verified`** |
| Questions a full task-accepted playthrough asks | **130** |
| **Lesson passages reachable by playing** | **0 of 302** |

The complaint is arithmetically exact, and the interesting half is the last row.

### The first correction: the passages are not reachable through Study either

The framing this decision was handed says the material is "unreachable except through Study". It is not
reachable through Study. **It is reachable through nothing at all.** `app/ui/` holds no `learn-*` screen;
`app/application/ports/content-repository.ts` declares `LessonDocument` and `LessonPassage` and **no method
that returns one** — deliberately, under ADR-0008, since nothing called them; and the only mention of a
lesson anywhere else in `app/` is the two type re-exports in `ports/index.ts`. Study drills questions
(`loadEveryBank`) and has never read a passage.

So 302 verified, bilingual, granted passages — the product of the largest content programme in this
project's history — are **dead content in the repository**. Not under-surfaced: unreferenced. That is a
sharper problem than the one reported, and it changes what the fix has to be.

### The second correction: ADR-0028 does not bind this, and has not since ADR-0030

This decision was handed ADR-0028 as "the hard one": that a `canadas-history` passage cannot be voiced at a
`regions` level because two subjects may never share a proposition. **That is not what ADR-0028 forbids, and
the question of whether it reaches told claims is already settled — twice, in writing, with a gate.**

- **ADR-0030** is titled *a subject owns what it grades, not what it tells*, and its header says it narrows
  ADR-0028 §4. Its decision sentence: *"A proposition is graded by at most one subject. It may be told by
  anything, anywhere, as long as it is true."* Its §2 rules blurbs, territorial statements and **dialogue
  lines** out of scope by name.
- **ADR-0061 §5** says it again for this exact content type: a lesson passage is a told claim, it enters no
  floor, no exam row and no schedule, and *"`a-proposition-belongs-to-one-subject.test.ts` already selects
  graded items **by shape** (`kind === 'question'`) rather than by directory … so a new directory full of
  told claims cannot silently widen or narrow it."*
- **The gate agrees.** `tests/unit/contracts/a-proposition-belongs-to-one-subject.test.ts` selects
  `claimsIn()` filtered to `kind === 'question'`, and carries a dedicated assertion — *"compares graded items
  only, and never a told claim"* — whose failure message states that a gate widened to told claims *"would
  refuse every one of them for a harm none of them can cause."*

**So, measured and stated plainly: of the 302 passages, 302 are eligible at every one of the ten levels
under ADR-0028. Zero are excluded by it.** There is no per-level subset to report, because the rule that was
expected to produce one does not apply. A passage read at a level grades nothing, so it cannot make a
proposition count twice, which is the only harm ADR-0028 §4 exists to prevent.

This is worth recording loudly rather than in a footnote, because the workaround the constraint was invented
to justify — re-voicing a passage's proposition as a fresh dialogue line — was being justified by a rule that
does not forbid the alternative.

### The third measurement, and it is the one that actually constrains the design

If ADR-0028 does not bind, what does? Two things, and both were measured rather than assumed. The method is
`sharesProposition` from `app/application/content/proposition.ts` — the containment rule already used by
ADR-0028's gate and ADR-0036 §2.4 — re-implemented over the corpus, so two claims resting on one sentence
count as one proposition.

**(a) The lesson corpus and the question corpus are very nearly disjoint, by construction.**

| | Count |
|---|---|
| Passages sharing a proposition with **any** of the 493 verified questions | **25 of 302** |
| Passages resting on a sentence **no question cites** | **277 of 302** |
| Passages restating something a level **already tells** (a blurb or a quest line) | 14 |

That is not an accident and it is not a defect. ADR-0061's authoring programme was pointed at the guide's
**uncited remainder** — the 5,446 teachable words no claim covered — so the passages rest on the sentences
the question bank had left alone. The lesson corpus is, by design, the half of the guide the questions do
not touch.

**(b) So a passage can rarely make a question "taught".** Per level, passages sharing a proposition with a
question in that level's own subject bank, and of those, how many would newly teach a pooled question the
level does not currently tell:

| Level (subject) | Pooled ids | Pooled ids the level does not tell | Passages matching its bank | **Newly taught** |
|---|---|---|---|---|
| halifax (rights) | 25 | 17 | 1 | 1 |
| peggys-cove (who-we-are) | 12 | 7 | 9 | 2 |
| quebec-city (history) | 17 | 12 | 0 | 0 |
| ottawa (government) | 15 | 8 | 1 | 0 |
| toronto (elections) | 27 | 20 | 4 | 4 |
| winnipeg (justice) | 13 | 4 | 0 | 0 |
| prairie-rail (modern-canada) | 19 | 13 | 0 | 0 |
| alberta-foothills (economy) | 34 | 26 | 1 | 1 |
| vancouver (symbols) | 12 | 4 | 2 | 0 |
| the-north (regions) | 13 | 9 | 7 | 1 |
| **Total** | 187 | **120** | **25 distinct** | **9** |

**Nine.** The entire 302-passage corpus, applied to every level at once, closes **9 of the 120** untaught
pooled questions. **This is the finding that decides the shape of the ADR: a `read` step is a reading
surface, and it is not a fix for ADR-0057's teaching deficit.** Anyone reading this decision as a cheap route
to ADR-0057's covered list should read this table again; that deficit is still closed by authoring dialogue
and blurbs, level by level, exactly as ADR-0057's obligations say.

**(c) What a level could sensibly host, as opposed to what a rule permits.** Since ADR-0028 excludes nothing,
the honest bound on a level's reading material is editorial — relevance to where the player is standing. The
nearest measurable proxy is the level's *empirical remit*: the chapters its own verified bank actually cites,
and the passages sitting in those chapters.

| Level (subject) | Chapters its bank cites | Passages in those chapters |
|---|---|---|
| halifax (rights) | Rights and Responsibilities | **2** |
| toronto (elections) | Federal Elections | 22 |
| winnipeg (justice) | Justice, Elections, Rights, the Oath | 25 |
| peggys-cove (who-we-are) | Who We Are | 27 |
| vancouver (symbols) | Canadian Symbols | 29 |
| ottawa (government) | How Canadians Govern Themselves, Federal Elections | 32 |
| prairie-rail (modern-canada) | Modern Canada | 40 |
| the-north (regions) | Canada's Regions | 65 |
| quebec-city (history) | Canada's History | **104** |
| alberta-foothills (economy) | Economy, History, Regions, Modern Canada, Rights | **213** |

Two numbers deserve their caveat rather than a quiet appearance in a table. **halifax gets 2** because
*Rights and Responsibilities* has only 107 uncited teachable words and two authored passages — ADR-0061
measured that chapter as nearly exhausted, and this confirms it from the other side. **alberta-foothills gets
213** only because ADR-0028 §2 deliberately widened `economy` across five chapters; that is the widening
working as designed, and it is also the level where "relevant to where you are standing" will do the most
work that no rule can do.

## Decision

**A lesson passage is met where it is played, and it is met by reference. A quest gains a `read` step whose
payload is a list of `{ lesson, passage }` pairs naming passages that already exist, already carry one
proposition and one contiguous quote, and already carry one verifier's grant. No passage is copied into a
level, a quest or a blurb, ever.**

Six parts.

### 1. The vehicle is a step kind, and the argument that it is not was already answered

ADR-0057 rejected a fifth step kind, and it was right to: the candidate was `teach`, and *"`visit` and `talk`
with `dialogue` already are that step"*. A kind that behaves like `visit` and is spoken like `visit` splits
one concept across two names.

But ADR-0057 also wrote the condition under which a fifth kind becomes legitimate, and it is met here:

> If teaching ever needs a behaviour `visit` cannot express — a card with no target, say — that is an
> additive schema change with its own ADR and a measurement behind it.

**`read` is a behaviour `visit` cannot express, for a reason that is about ownership rather than layout.**
Every existing step carries its words *inside the quest document*: `dialogue[]` is an array of
`dialogueLine`, each with its own `fact` block and its own grant, authored by the quest's author and granted
by a verifier against that quest file. A `read` step carries **no words at all**. Its content lives in
another document, under another author, with a grant that was issued before this quest existed. No amount of
`dialogue` on a `visit` step expresses "show the player somebody else's paragraph, and do not restate it".

This is the measurement ADR-0057 asked for, and it is in Context: 302 passages, 0 reachable, and 277 of them
resting on sentences no question anywhere cites.

### 2. The payload is a reference, and this is the load-bearing half

**A `read` step names passages. It never contains them.** The alternative — re-voicing a passage's
proposition as a dialogue line — is the workaround this decision exists to refuse, on four counts, in
increasing order of severity:

1. **It doubles the grant.** ADR-0003 is absolute and per-commit: the author writes, the verifier grants, in
   separate commits. A re-voiced passage is a *new claim about an already-granted proposition*, so it needs
   its own paraphrase, its own French, and its own verifier commit. At ADR-0061's own rate this is two
   commits per passage for material already verified once.
2. **It creates two homes for one proposition.** Edit the lesson, and the quest line silently disagrees.
   Nothing joins them, because ADR-0028 §4 settled that no string identifies a paraphrase — so the drift is
   undetectable by any gate this project can build.
3. **It leaves the defect unfixed.** Re-voicing makes a *copy* reachable. "302 passages reachable" still
   reads 0, which is the number the owner was complaining about.
4. **It is the licence risk in miniature.** The guide is Crown copyright and the game's defence is that each
   claim is a single paraphrase cited to one passage. Multiplying paraphrases of one sentence across
   documents multiplies the surface on which a verbatim collision can appear.

By reference, a passage keeps **one** grant, **one** `asOf`, **one** `volatile` flag. When ADR-0016's clock
quarantines it, it disappears from the level and from Learn in one edit, because there is one object.

### 3. A `read` step has one voice, and it is the passage's

`passages` and `dialogue` may not appear on the same step, and the schema forbids it rather than advising
it. A spoken line beside a read paragraph is two narrators for one proposition, and it re-opens the question
of which one the verifier granted. `targetId` stays required — the player taps something to open the reader,
and on a level that may draw no figure that something is a plaque (ADR-0029).

The reader is DOM, like every other card (ADR-0005), and it inherits the accessibility contract the question
card and the POI card already meet: canvas `aria-hidden`, a live region, 44 pt targets, text scaling to 200%,
the dyslexia-friendly font, high contrast, EN and FR, no timer. **What it does not inherit is the
single-switch route**, and that is stated as owed rather than solved: "tap anywhere advances" is a rule
written for cards, and ADR-0061 §8 already recorded that a chapter is not a card. A `read` step is *shorter*
than a chapter, which makes it the cheaper place to answer that question first — but it is the same question,
and it is owed to the same owner.

### 4. Identity: a passage id alone does not identify a passage

`lesson.schema.json` requires a passage's `id` to be unique **within its lesson**, and says so explicitly,
because `uniqueItems` compares whole items and cannot express it. Measured: all 302 authored passage ids are
distinct corpus-wide today. **That is luck, not a contract**, and a reference resting on it breaks silently
the first time two chapters both name a passage `e1-the-vote`.

So a reference is the pair `{ lesson, passage }`. This is exactly the case
`common.schema.json#/$defs/id` describes — an unbranded id resolved by *"a sibling discriminator on the same
object, or a cross-document gate that names the collections it searched and fails on zero matches and on
two."* `lesson` is the discriminator; the gate is owed below. Neither half is branded: there is no
`LessonId` in `app/domain/ids.ts` and this ADR does not invent one, because `app/domain` is given nothing by
a lesson (ADR-0061 §8) and a brand is earned by a vocabulary the domain reasons about.

### 5. A passage read on the path is told by the level — and nothing else changes

**This is the single sentence of ADR-0061 §4 that this ADR amends, and the scope is deliberately narrow.**

ADR-0061 §4 ruled that no level may join ADR-0057's covered list on the strength of a lesson, because *"a
player who never opened Learn would be asked, inside a level, about something that level never said."* That
reasoning is sound and it is **about Learn** — a separate surface, behind a menu, which a player may never
open. It does not transfer to a passage read at a stop, on the quest path, before the `answer` step: there
the player met the proposition in the level, in the run, in the order the quest directs. The premise of the
objection is absent.

So, precisely: a passage named by a `read` step counts among the level's told propositions for
ADR-0057 §6's gate **if and only if** the `read` step's index is lower than the `answer` step's, in the same
quest — the same ordering clause ADR-0057 §1 already applies to a `visit` step's dialogue. A passage read by
opening Learn still counts for nothing, exactly as ADR-0061 §4 says.

**What does not change, listed so the amendment is not over-read:**

- The thirty-verified-questions-per-subject floor. A passage is still told, still grades nothing, still
  enters no floor (ADR-0028 §1, ADR-0030 §1).
- The exam. Unchanged in draw, score and by-subject rows.
- The FSRS scheduler. A passage is not drawable and enters no review state.
- Learn. ADR-0061's surface is not replaced, delayed or absorbed; §6 says why it is still needed.
- **The size of the prize.** Per Context (b), this clause makes **9** questions taught across all ten levels.
  It is worth having because it is free once the step exists — not because it closes ADR-0057's deficit,
  which it does not.

### 6. This does not replace Learn, and the catalogue is written once

A reasonable reading of all this is "put the passages in the levels and skip the Learn surface". That is
refused, and the argument is the owner's own two sentences. *"It's all on the study guide… we kinda need the
whole study guide in game"* wants a readable guide; *"there's not even 10% of the study guide when playing
it"* wants it met in play. **A level cannot hold a chapter** — ADR-0061 §1 measured that at 155 words per
landmark and rejected it — and **Learn cannot be met by playing**, because it is a third door.

So both surfaces exist, and the boundary is that **they share one catalogue and one filter**. The
shippable-passage filter (only `verified` for the current `sourceHash`) lives in `app/application`, never in
a screen, so the level reader and the Learn reader cannot disagree about what is readable. The catalogue is
one `import.meta.glob` per chapter in `app/adapters/content`, lazily imported, so the ≤ 8 MB initial payload
does not move and a chapter is a chunk fetched on first open.

**This is also what retires ADR-0008's reason for leaving the port capability unwritten.** `chapters()` and
`lessons(chapter)` were deliberately not written because nothing called them. A `read` step is a caller. The
methods are written by the implementer in the change that first calls them — not by this ADR, which writes
the contract only.

## What this makes impossible

- **Copying a lesson passage's words into a quest, a blurb or a level document.** §2. The step takes
  references, and the schema has no field for text.
- **A `read` step with no passages**, or with passages *and* dialogue. §3, held by the schema's conditional.
- **Referring to a passage by a bare id.** §4; the schema requires the pair.
- **A passage counting toward a subject's floor, an exam row, or the scheduler.** §5.
- **A level joining ADR-0057's covered list on a passage read in Learn**, or on a `read` step that comes
  *after* the `answer` step it would justify. §5.
- **Two catalogues, or a shippable-passage filter in a screen.** §6.
- **Reading ADR-0028 as forbidding a passage at a level whose subject differs from its chapter.** §Context;
  it has not forbidden that since ADR-0030.

## Alternatives considered

- **Re-voice the proposition as a `dialogue` line on an existing `visit` step.** The zero-schema-change
  option, and the one this ADR exists to refuse. It doubles the grant, creates two undetectably divergent
  homes for one proposition, and leaves "302 passages reachable" reading 0. §2. It is also *less* capable
  than it looks: 277 of the 302 passages rest on sentences no question cites, so re-voicing buys almost
  nothing for ADR-0057 either.
- **Do not build it; the passages belong in Learn and a level should link to them.** The strongest
  alternative, and it was put explicitly. Rejected on three grounds. It answers "not 10% of the guide *when
  playing it*" with a menu, and ADR-0061 §1 already ruled Learn is not reachable by playing. A link out of a
  level is a context switch mid-traversal — portrait, one-thumb, mid-quest — and the game would have to
  either pause or lose the player's place. And it leaves the level's own teaching where ADR-0057 found it.
  **What survives from this option is its sequencing instinct, and §6 adopts it:** Learn is not skipped, and
  the catalogue both readers share is written once.
- **Put `passageIds` on a point of interest instead of on a quest step.** Tempting, because a POI is where a
  player already stops (ADR-0032). Rejected as the *first* vehicle for a specific reason: a POI is engaged in
  any order, or never, so a passage attached to one has no position relative to the `answer` step, and §5's
  ordering clause could not be stated. It is the obvious second increment once the reader exists, it is
  additive, and it needs the ordering question answered rather than assumed — so it is deliberately not
  decided here.
- **Give the lesson document a `levelId`, so lessons point at levels.** Rejected on ADR-0028 §5's exact
  reasoning about `chapters[].level`: a level names its content; content does not name its levels. A
  back-pointer is a second place to keep in step, and ADR-0028 removed four of them that were *correct* at
  the time, for the direction of the pointer alone.
- **Give the lesson document a `subject`.** Rejected, and it is already refused in writing by
  `lesson.schema.json`'s `additionalProperties: false`, with ADR-0061 §5's argument: it forces every
  paragraph of the guide into a remit, re-running ADR-0028's many-to-many argument in a second place with a
  weaker answer.
- **A global passage id namespace, so a reference is one string.** Rejected: it is true today by luck and
  the schema does not promise it (§4). Making it true would mean a corpus-wide uniqueness gate over a
  property whose own schema scopes it to a lesson — a rule drawn round the wrong container (ADR-0019).
- **Let a `read` step also ask a question, so reading and assessment are one stop.** Rejected: ADR-0048
  settled what a stop may ask and ADR-0036 §2 settled the draw. A step that reads and asks would need both
  rulings restated, and the quest already alternates teach and ask steps nine times over.

## Consequences

- **Nothing in the game changes today. No adapter, no scene, no screen, no content, no copy** — this commit
  is one ADR, one schema, the port types the schema binds (ADR-0007), and one architecture note.
  `npx depcruise app common --config .dependency-cruiser.cjs` reports no violations before and after, because
  nothing in `app/` moves. `make validate-content` passes over 592 files and every schema still compiles.
- **The schema now permits a step that `app/bootstrap/quests.ts` will refuse**, because `STEP_KINDS` there
  lists four kinds. That is the safe direction — a `read` step authored before the engine learns the kind is
  rejected loudly at load rather than drawn as a blank — and it is the reason the first content obligation
  below is dated *after* the engine one.
- **A boundary defect was found by making this change, and it is load-bearing rather than latent.** The step
  kind vocabulary is stated **three** times: `content/schemas/quest.schema.json`'s `enum`, the union on
  `QuestStepDocument` in `app/application/ports/content-repository.ts`, and — twice over in `app/` —
  `app/domain/entities/quest.ts`'s `QuestStepKind` and `app/bootstrap/quests.ts`'s runtime `STEP_KINDS` list.
  Only the schema-to-port pair is held by a gate; `ports-match-schemas.test.ts` compares those two in both
  directions and nothing compares either to the other two.

  I expected this to be latent, wrote that down, and **was wrong: `make typecheck` failed.** Adding the kind
  to the port alone broke `tests/unit/domain/entities/quest.test.ts`, which passes a `QuestDocument` where a
  domain `Quest` is expected — so the port union must be assignable to the domain's. The error is recorded
  here rather than quietly fixed, because the useful fact is that the duplication *has teeth*: a vocabulary
  nobody gated still fails the build, just late and in a test file that looks unrelated to the change.

  **What I edited, and what I deliberately did not.** `QuestStepKind` is a type-only contract in
  `app/domain`, which is the architect's to define, so it carries `read` and a comment naming all three
  sites. `STEP_KINDS` in `app/bootstrap` is runtime code and the engine owner's; I left it listing four, so
  a `read` step authored today is refused at load rather than drawn as a blank. That is the safe direction
  and it is why the engine obligation is dated before the content one. No exhaustive switch exists on this
  union anywhere — every consumer compares for equality — so widening it changes no behaviour.
- **The reachability number this is measured against is 0, and the first honest target is small.** One level
  with one `read` step of three or four passages moves "passages reachable by playing" from 0 to 3 or 4. The
  corpus-wide ceiling is 302; the per-level editorial bound is the Context (c) table, from 2 at halifax to
  213 at alberta-foothills. **Anyone quoting "302 reachable" as a result of this ADR is quoting a permission,
  not a measurement.**
- **The 9-question teaching gain is real and nearly irrelevant.** §5 is worth having because it costs nothing
  once the step exists. ADR-0057's deficit is untouched and its obligations are neither discharged, delayed
  nor re-dated by anything here.
- **Content authoring under this ADR is cheaper than any other teaching route in the project**, and that is
  the practical case for it: a `read` step is selection, not authorship. No new paraphrase, no new
  translation, no new grant, no art, no reference entry, no texture budget. It is the first content programme
  here whose marginal cost is an editorial judgement rather than a verifier commit.

### Rules stated here that no gate can express

- **Whether a passage belongs where it is read.** A `regions` chapter passage at the Prairies level is legal
  under every rule in this repository (§Context) and may still be a non sequitur. Relevance is the author's,
  as ADR-0056 §6 settled for blurbs, and ADR-0057 §6 for teaching claims.
- **Whether a passage teaches.** ADR-0061 §9 named this and it is unchanged: `verified` means true and
  entailed, never that the paragraph teaches or reads well beside its neighbours.
- **Whether reading happened.** A reader can be dismissed. Nothing here requires reading, and nothing should:
  ADR-0052 §1 forbids a wall, and a comprehension check is a test where the game promised not to test.
- **Whether a passage and a quest line are the same proposition when they rest on different sentences.**
  ADR-0028 §4: no string identifies a paraphrase. A `read` step and a `visit` step on one level can teach one
  thing twice and nothing will say so.
- **How many passages a stop should hold before it is a wall of text.** A judgement for the story and the
  a11y owner, not a number this ADR invents.

## Obligations

- **OBLIGATION due=2026-12-20 owner=infra** — build the cross-document gate over `questStep.passages[]`:
  every `{ lesson, passage }` pair resolves to **exactly one** passage in `content/lessons/**`, failing
  differently on zero matches (dangling — a renamed passage, which `lesson.schema.json` says is a new
  identity) and on two (ambiguous — the case a bare id would have hidden, §4). It also fails a `read` step
  whose resolved passages are not all `verified` for their current `sourceHash`, since a quarantined passage
  must leave the level the way it leaves Learn. It ships covering the shipped corpus so it is not vacuous on
  its first run (ADR-0024), which on a tree with no `read` step means asserting the resolver finds the 302
  passages it searches.
  **DISCHARGED 2026-09-20** — `scripts/lib/lesson-passages.mjs`, with hand-written types in
  `lesson-passages.d.mts` so the one implementation stays one implementation, driven by
  `tests/unit/contracts/a-read-step-names-a-passage-that-exists.test.ts`. `resolvePassage` answers
  **exactly one or a named failure** and never `undefined`: zero matches is `dangling` and two or more is
  `ambiguous`, each carrying the count and naming the collection searched. Both routes to an ambiguity are
  covered, because both are real and neither is visible to a schema — two lesson documents sharing an `id`,
  and two passages sharing an `id` inside one lesson (`uniqueItems` compares whole items). `passageVerdict`
  adds the readable-passage rule: a `quarantined`/`rejected` grant, a grant made for a `sourceHash` the
  passage no longer cites, `verified` with no evidence, and `factual: false` each refuse separately.
  **Not vacuous:** the sweep resolves all **302** passages across **48** lessons and **10** chapters by
  their own pair and holds every one to the readable rule; the quest walk reports **0** references today,
  asserted as a number rather than assumed.

- **OBLIGATION due=2026-12-20 owner=engine** — make `read` a kind the loader accepts or explicitly refuses
  with a named reason, and end the duplicated step-kind vocabulary: `app/domain/entities/quest.ts`'s
  `QuestStepKind` and `app/bootstrap/quests.ts`'s `STEP_KINDS` both restate the union the schema and the port
  already agree on. One of the three is the source; the other two derive from it. Until this lands the schema
  permits a step the engine rejects, which is safe and is why this is dated before the content marker.
  **DISCHARGED 2026-09-20** — `app/bootstrap/quests.ts` accepts `read`, and the vocabulary is now stated
  four times with **every link gated**. The schema is the source. `STEP_KINDS` is `Object.keys` of a
  `Record` keyed by the port's own union, so a kind the port declares and the loader does not handle is a
  **compile error** rather than a message listing four kinds out of five, and the sentence a developer reads
  is built from the same list the reader checks against. `app/domain`'s `QuestStepKind` cannot derive from
  the port — `domain-is-pure` forbids the import — so it is **pinned** instead:
  `entities-mirror-ports.test.ts` asserts the two unions are assignable in both directions, which for string
  literals is equality. `a-step-kind-is-written-once.test.ts` holds the runtime list to the schema's `enum`
  at run time, which is the one link no type can hold. A `read` step is refused at load for *shape* — no
  `passages`, an empty `passages`, a malformed pair, or `dialogue` carried beside it (ADR-0063 §3) — and the
  cross-document resolution is the infra gate above, deliberately: resolving a reference in the composition
  root would mean eagerly globbing 48 lesson documents into the initial payload, against §6's per-chapter
  lazy catalogue and the ≤ 8 MB budget.

- **OBLIGATION due=2027-01-20 owner=ui-a11y** — decide how a single-switch player and a screen-reader player
  move through a `read` step, and record it in the story that carries the reader. It is the same question
  ADR-0061 §8 owes for a chapter, asked of a shorter document, and answering it here first is cheaper;
  whichever is answered first, the two answers must be one design.
  **DISCHARGED 2026-09-21** — `app/ui/lesson-reader.ts`, with
  `docs/stories/TN-READ-reading-a-passage-at-a-stop.md` as the story that carries it, and one design for both
  players rather than two.
  **One switch: each passage is a stop in the ring.** A short press moves the highlight to the next passage,
  scrolls it into view — the only way a switch player scrolls anything — and reads it aloud, so reading the
  document is the same gesture as moving through it. A long press on a passage reads it again and does
  nothing else (`confirm.ts`'s stop, asked of prose); only `Close` closes. It uses the **one** scanning
  implementation, `createSwitchRing`, given to the surface by `app/ui/screen.ts`; no second scanning concept
  was introduced. The rejected shape is the ring built from controls alone, which would highlight `Close` over
  prose the player could neither hear nor scroll to.
  **Screen reader: the prose is the dialog's own description.** Named by the lesson's title, described by the
  whole body, so a reader that reads a dialog on arrival reads the title and then every passage in the order
  the step named them; nothing is announced separately, because a live-region message as well would say it
  twice. A second Tab stop over the prose was written and removed: it is a stop that does nothing on the way
  to the only control there is, and a reading cursor already walks paragraphs. The switch scan speaks each
  passage with its `lang`, so French prose is not read with English phonemes.
  **The judgement §"Rules stated here that no gate can express" delegates is made:** a stop holds **three or
  four** passages, and a passage taller than the phone does not go on one. Measured: 302 passages, mean 109
  characters (EN), longest 270 (EN) / 314 (FR); a 314-character French passage at 200 % text is about 1 290 px
  against an 844 px viewport. `TN-READ`'s `OQ-READ-2` records the one rough edge this could not fix from a
  screen — the shared `focusAndReveal` shows such a paragraph's tail on the scan's wrap, and changing that is
  a change to every screen in the game.
  **What this does NOT discharge, and it is the reason the reader is still unreachable.** §6 assigns
  `chapters()` / `lessons(chapter)` and the per-chapter lazy catalogue to "the implementer in the change that
  first calls them", and **that change has not been made**: there is no port method, no lesson catalogue in
  `app/adapters/content`, and nothing in `app/bootstrap` resolves a `{ lesson, passage }` pair. The screen is
  written against prose precisely so that route can be built without touching it — but until it is built,
  **passages reachable by playing is 0**, and this obligation's closure is not a claim otherwise.

- **OBLIGATION due=2027-02-20 owner=content** — author the first `read` step on **one** level as a proving
  run, choosing passages by relevance to where the player is standing, and report what it cost and how it
  read at phone width against the per-level bound in Context (c). Not `the-north` and not `canadas-regions`
  material: ADR-0028's live-check of *Canada's Regions* is still open, and slice 10's Indigenous content
  review is unobtainable. `toronto` is the recommendation — 22 passages available, and the highest newly
  taught count (4) of any level.

- **OBLIGATION due=2027-03-20 owner=architect** — re-measure Context's four tables over the tree as it then
  stands and record the result in an amendment: passages reachable by playing, passages sharing a proposition
  with a question, the per-level newly-taught count, and the per-level editorial bound. If reachability is
  still 0, say what was tried rather than letting the markers lapse (ADR-0009). This is the only instrument
  that answers the owner's original complaint, and like ADR-0061's it cannot run in CI.

## References

- The product owner's words, quoted in Context: more content and quests; not 10% of the study guide when
  playing it
- ADR-0061 (the Learn surface, the passage as the unit of verification, the required passage id, and §4 —
  the one sentence this ADR amends), ADR-0057 (a level asks only what it taught; §1's rejection of a fifth
  step kind and the condition it named for a legitimate one), ADR-0048 (a stop asks only what it told),
  ADR-0036 §2 (a level asks its own subject; the landmark's question first)
- ADR-0028 §1, §2, §4 and §5 (the thirty floor; a remit is not a chapter; the proposition is identified by
  its quote; a level names its sources and a source does not name its levels), ADR-0030 §1 and §2 (a subject
  owns what it grades; told claims are outside the rule — the ruling that makes §Context's answer "302 of
  302")
- ADR-0003 (citation, the author/verifier split per commit, gate A4), ADR-0016 (`volatile`, the 180-day
  clock), ADR-0004 (Crown copyright; paraphrase and cite, do not redistribute)
- ADR-0005 (layers; `app/ui` is DOM only), ADR-0007 (the content schema is the port contract; a `$def` binds
  to the type its `title` names), ADR-0008 (a port exists when something calls it — retired here for the
  lesson capability), ADR-0019 (a rule drawn round a container measures the container), ADR-0024 (an empty
  collection must not reduce to a pass), ADR-0029 (a quest is offered by an engageable), ADR-0009 (the
  obligation format above)
- `content/schemas/lesson.schema.json` (passage ids unique *within a lesson*; a rename is a new identity),
  `content/schemas/quest.schema.json#/$defs/lessonPassageRef` (the reference this ADR adds),
  `app/application/content/proposition.ts` (`sharesProposition`, the containment rule every measurement here
  used), `tests/unit/contracts/a-proposition-belongs-to-one-subject.test.ts` (the gate that selects graded
  items by shape and refuses to compare a told claim)
- `docs/plan/slices.md` — slice L4
