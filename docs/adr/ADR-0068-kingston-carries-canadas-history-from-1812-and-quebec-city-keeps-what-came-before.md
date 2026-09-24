# ADR-0068: Kingston carries Canada's history from 1812, and Québec City keeps what came before

- Status: Accepted (2026-09-23)
- Settles: the first tier 3 case under ADR-0065. It splits the `history` bank into two subjects and says
  where the line falls, by `source.quote`. It says which level keeps which half, what the split voids and in
  what order the work lands. It gives the exam mix before and after, and what `docs/content-review.md`
  requires of the new level.
- **Amends nothing.** It applies ADR-0028 (a subject is a remit), ADR-0030 (a subject owns what it grades),
  ADR-0056 (what a landmark may teach), ADR-0057 (a level asks what it taught) and ADR-0065 (§1.1, §4, §5).
  It changes neither `SUBJECT_SHIP_THRESHOLD` nor `allocateQuotas`.
- **Decides no content and moves no file.** No question is re-filed here, and none is authored or granted.
  Every content step is an obligation below, and so are the map, config and domain steps. The map's own change
  is ADR-0069.
- **Kingston does not land before ADR-0065 §1's tier 3 condition holds.** See §7. This ADR draws the line
  now so that the tier 2 work at Québec City lands on the right side of it.
- Slice: L6 (`docs/plan/slices.md`). The story is `docs/stories/TN-LEVEL-kingston.md`.
- Numbering. I ran `git fetch` first. `origin/main` at `7441451` holds ADR-0001 to ADR-0037, ADR-0039 to
  ADR-0049 and ADR-0051 to ADR-0066. `git log --all --name-only -- docs/adr` finds 0067 on the local branch
  `read-at-a-visited-stop` (`d7f1b51`), and nothing above it. `git ls-remote --heads origin` lists `main`,
  `archive/v0.1`, `read-step-at-dows-lake` and `task-strip-gate`, and none of them adds a higher number. **0068
  is the first number above the mark.** 0069 is ADR-0069, written with this one. The holes at 0038 and 0050
  stay untaken, for the reason ADR-0052 recorded.

## Context

### The measurement

`content/questions/history/` holds **97 documents, all 97 verified** against the register's current
`extractedTextSha256` (`fd510469…`). None is `volatile`. All cite *Canada's History*, pp. 23–44. By cited page:

| Pages | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40 | 41 | 42 | 43 | 44 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Verified | 6 | 6 | 6 | 6 | 3 | 4 | 5 | 5 | 4 | 3 | 6 | 3 | 3 | 4 | 4 | 3 | 4 | 6 | 2 | 5 | 4 | 5 |

The coverage audit (`docs/plan/guide-coverage.md` on `guide-coverage-audit`, `a3a6984`) proposed three
cuts. This ADR re-measured each one on `7441451`:

| Cut | Halves | Kingston's guide-named links in Kingston's half |
|---|---|---|
| pp. 23–33 / 34–44 | 54 / 43 | Macdonald (p. 35) only. The Fort Henry sentence (p. 30) falls to Québec City. |
| pp. 23–28 / 29–36 / 37–44 | 31 / 33 / 33 | Fort Henry and Macdonald. But it makes a third subject that no city carries (Alternatives). |
| **The remit cut below** | **32 / 65** | **Fort Henry (p. 30), Macdonald (p. 35), and the Province of Canada (p. 32) that City Hall can tell** |

**No history question shares a proposition with another history question.** I checked all 4,656 pairs with
`sharesProposition`'s containment rule. So every partition of the 97 passes
`a-proposition-belongs-to-one-subject.test.ts`. That test says whether a cut is disjoint. It cannot say
whether a cut is good (ADR-0065, "Rules stated here that no gate can express").

### What the guide ties to Kingston

Three sentences in the guide name Kingston. Every one is already a verified claim:

| p. | Sentence | Carried by today |
|---|---|---|
| 30 | "The British paid for a costly Canadian defence system, including … Fort Henry at Kingston—today popular historic sites." | `hist-97` (question); Québec City's `terrace-kiosk` blurb (told) |
| 35 | "He was a lawyer in Kingston, Ontario, a gifted politician and a colourful personality." | `history-05-opening-the-west` (lesson passage). No question. |
| 79 | "The red-white-red pattern comes from the flag of the Royal Military College, Kingston, founded in 1876." | `sym-05` (question, `symbols`); Vancouver's Canada Place blurb (told) |

Two of the three sit in *Canada's History* after the War of 1812. The third is graded by `symbols`, and
ADR-0030 §2 lets any level tell it.

### Québec City already teaches the first half

Québec City's told claims rest on the sentences below. They were measured by the containment rule against
every history question:

| Claim | Rests on |
|---|---|
| `chateau-frontenac` blurb | p. 24, `hist-12` |
| `city-wall` blurb; quest step 0, line 2 | p. 25, `hist-17` |
| quest step 1, line 1 | p. 24, `hist-10` |
| quest step 3, line 1 | p. 26, `hist-19`, `hist-20` |
| quest step 5, line 1 | p. 27, `hist-26` |
| `terrace-kiosk` blurb | p. 30, `hist-97` |
| `afterLine` | p. 33, `hist-48`, `hist-49` |

Six of the eight rest on pp. 24–27. The other two are the two this split moves out from under them. Québec City teaches New France and British rule, and it pools 1812 to 1945
for want of anywhere else to put it. ADR-0065 §1 called those "period" pools the defect. This split removes
them.

## Decision

### 1. Two remits, and the line between them is a subject, not a page

**`history` (Québec City keeps it): the beginnings.** It covers the First Peoples, the European explorers, New
France and the fur trade, the Conquest and British rule, the Quebec Act, the Loyalists, the first elected
assemblies, and the end of slavery in British North America.

**`building-canada` (new; Kingston carries it): building the country.** It covers the War of 1812 and the
defences built after it, the rebellions and responsible government, the Province of Canada, Confederation
and the Dominion, the list of when each province and territory joined (p. 34, which runs to 1999), the Red
River and the North-West, the railway, the South African War and the First World War, the vote for women,
the years between the wars, and the Second World War.

**The line is thematic, not by page or by year, because the guide's arcs cross both.** Page 28's abolition
section runs from 1793 to Mary Ann Shadd Carey's 1853. It is one arc, and it stays with `history`. On page 29,
"trading posts that later became cities" ends the fur-trade story that `hist-14` and `hist-15` begin. The same
page's Montreal Stock Exchange of 1832 opens the nineteenth-century economy. The first goes with the fur trade
and the second with the country being built. ADR-0028's Decision says the proposition is the unit of claim,
not the page. This cut is the first to depend on that.

### 2. The partition, by `source.quote`

A question document is one `source.quote` and one `subject`. So a list of ids is a partition by quote.

**`history`, 32 verified. It stays where it is and nothing about it changes:**
`hist-01` to `hist-31` inclusive, and `hist-96-habitants-and-canadiens`.

**`building-canada`, 65 verified. These are re-filed:**
`hist-32` to `hist-93` inclusive (62), and `hist-94-durham-assimilation`, `hist-95-rebellions-1837-38`,
`hist-97-british-paid-for-defences`.

32 + 65 = 97. The ids cover the whole bank and do not overlap. **Both halves clear the thirty floor on the day
they split** (ADR-0065 §5). `history` clears it by 2, and §6 says why that is safe and what the margin owes.

**Ids do not change.** `hist-40` becomes `content/questions/building-canada/hist-40-laura-secord.json`, with
`"subject": "building-canada"`. `app/adapters/content/question-catalog.ts` reads the subject from the
directory and the id from the filename, and no rule ties an id's prefix to its subject. A player's saved
review state is keyed by `questionId` (`progress-schema.ts`, `reviewState`), so every FSRS card follows its
question to the new subject intact. A renamed id would drop 65 cards from every save. That would be a save
migration bought for a filename.

### 3. Which level keeps which half, and why the smaller half stays

**Québec City keeps `history` and its 32.** Its level document, its three landmarks and its first five quest
lines already teach them.

**The larger half is the one re-filed, on purpose.** Re-filing the 32 and leaving `history` with Kingston
would void 33 fewer grants. It would also put the half that clears the floor by 2 through a re-verification.
The verifier re-checks each re-filed question against today's rules, including ADR-0064's
`distractorsNotEntailed`, which none of the 32 recorded when they were granted. Three refusals would drop
Québec City below thirty on a level that has already shipped. Re-filing the 65 exposes a half with 35 to
spare. **Floor safety is worth 33 extra verifier grants.**

**The id `history` is never retired.** Every saved exam answer records a `subjectId`
(`progress-schema.ts`, `examAnswer`), and the result screen looks up its label from the level that carries
that subject (`app/bootstrap/subjects.ts`). An id no level carries would show an unlabelled row in the player's
exam history. Keeping `history` on Québec City means every saved row still resolves.

### 4. The grants it voids, and the order of commits the gates force

`scripts/verify-content.mjs` keeps `subject` bound for a question: "re-filing a question changes the floor,
the exam row and the ADR-0028 comparison it enters". A move reaches the gate as a delete and an add, so the
new path has no earlier grant. So:

- **65 question grants are voided**, one per re-filed document. No other grant is voided. A level's
  `subject` and `order` are not bound (ADR-0030 §5). A quest step's `questionPool` is not part of any claim's
  unit (`verify-content.mjs` and `scripts/lib/claims.mjs` never read it). Blurbs and lines stay granted,
  because telling is free (ADR-0030 §2).
- **Commit 1, content author.** Move the 65 files. Set each `subject`. Write each `verification` block in the
  null form. The author-role rule refuses anything else: "an author-authored commit may write a verification
  object only in the null form". In the **same commit**, re-pool Québec City's three `answer` steps to
  `history` ids only. `an-answer-steps-pool-can-fill-its-count.test.ts` requires every pooled id to sit in
  the level's subject. Today the three pools name all 97, and the bandstand's 48 would be left with no id at
  all. Each pool still needs at least its `count` of 5, so 32 ids over three steps fits. The tree is red after
  this commit, as it is after every author commit (ADR-0003).
- **Commit 2, content verifier.** Grant the 65 against the current `sourceHash`. Touch nothing else. Record
  `distractorsNotEntailed` wherever ADR-0064 requires it. Refuse any that fail, and send them back to the
  author. `hist-39-wellington-and-bytown` is named in §5.
- **Both commits land in the PR that adds Kingston's level document, and not before.** Before that PR,
  `building-canada` would be a bank that no level pools. Its 65 questions would drop out of play (Study and
  the exam would still reach them), and its exam rows would have no label, because no level's subtitle names
  it.

### 5. What moves with the questions, stated so nobody finds it later

- **Québec City's `terrace-kiosk` still tells the Fort Henry sentence.** The question on that sentence,
  `hist-97`, is now in a subject Québec City does not ask. Under ADR-0048 a landmark asks its own question
  or nothing, so the kiosk asks nothing. That is ADR-0056 §6's "acceptable" case, and it is not a defect.
  Kingston tells the same sentence at Fort Henry, where it is the "best" case. Telling it twice is not
  forbidden (ADR-0030 §2).
- **Québec City's `afterLine` tells Confederation (p. 33).** It stays legal. Whether it should now close on
  something from Québec City's own half is the author's editorial call. This ADR does not require it.
- **`hist-39-wellington-and-bytown` offers "Kingston." as a distractor.** The Rideau Canal runs from Ottawa to
  Kingston. At Kingston, a player who has just walked past the canal's locks could fairly answer "Kingston"
  as the canal's end. The guide says the Duke of Wellington chose Bytown, and the question is right about the
  guide. The answer the level just made obvious is still the distractor. The verifier's re-grant of `hist-39`
  must decide whether that distractor stands **when the question is asked at Kingston**. The verifier never
  edits text. If it refuses, the author rewrites the distractor. It does not go back to Québec City.

### 6. The floor, the margin, and why 32 is enough but not comfortable

The rule is thirty (ADR-0028 §1) and `history` holds 32. What could lower it:

- **Quarantine.** Only a `volatile` claim is quarantined on its own, and none of the 32 is volatile. A new
  `sourceHash` quarantines every bank at once, and the floor is the least of the problems that day.
- **Re-verification.** The 32 are not re-filed, so §4 does not re-open them (§3).
- **A later retroactive rule.** ADR-0064 showed that a new check can apply to existing grants. A future one
  could refuse three.

So 32 is enough today. **The audit's §3 and §5(d) list pre-1812 sentences that no question carries yet.**
Authoring from them is the margin, and it is an obligation. It is not a precondition, because the floor is
thirty.

`building-canada` holds 65. ⌊65 ÷ 30⌋ = 2, so the bank could split again for city 12, which the audit defers.
ADR-0065 §4's ceiling is unchanged at **12**, because ⌊32 ÷ 30⌋ + ⌊65 ÷ 30⌋ = 3 = ⌊97 ÷ 30⌋. After Kingston:
**11 levels, 11 subjects, ceiling 12, headroom 1.**

### 7. When Kingston may land: ADR-0065 §1's condition, not waived

ADR-0065 §1 opens tier 3 only when a bank of at least sixty can split, **and the level carrying it is out of
room under tier 2**. The first condition holds (97). The second does not hold today. The audit measures
6.61 MiB of spare texture at Québec City, enough for **three** more stops. It ranks three: the Wolfe–Montcalm
monument (p. 25), the Hôtel du Parlement (p. 27) and the Plains of Abraham (p. 26). All three tell sentences
in `history`'s half as drawn here. So Québec City's tier 2 work and this split do not conflict.

**Kingston's level document lands after Québec City's tier 2 stops land.** The only alternative is a recorded
refusal of them, on the audit's own flag that the level would reach 10,848 px, which is a play judgement under
ADR-0065 §2.4. A refusal ends the tier 2 work, and tier 3 then opens. Even with three more stops, Québec City has
28 read places for about 110 passages that belong there (audit §5(b)). The room test will not stay passed for
long. It is still ADR-0065's test, and this ADR does not waive it.

### 8. The exam mix, before and after

`allocateQuotas` shares twenty questions equally among ready subjects. It deals a remainder one question each
in shuffled order. Every capacity here is at least 2, so no subject fills up early.

| | Before (10 subjects) | After (11 subjects) |
|---|---|---|
| Each subject | exactly 2 | 1 for sure, then 9 extra dealt at random: **2 with p = 9/11, 1 with p = 2/11**; mean 1.82 |
| `history` + `building-canada` together | 2 of 20 (10%) | **4 with p = 72/110 (65.5%), 3 with p = 36/110 (32.7%), 2 with p = 2/110 (1.8%)**; mean 3.64 (18.2%) |
| History's share of the verified bank | 97 / 493 = 19.7% | the same |
| Any other subject | 2, always | 1 in about 18% of exams |
| By-subject rows on the result screen | up to 10 | up to 11 |
| "Subjects ready: n of N" (`subjectsTotal` = `journey.length`) | of 10 | of 11 |

History goes from half its bank share to nearly all of it. Every other subject sometimes drops to one
question. The pass mark (15 of 20) and the thirty-minute option do not move. Past twenty subjects a subject
could not get one question (ADR-0065 §4). Eleven is far from that limit.

### 9. Where Kingston sits: the journey, the unlock chain, and a save that must not lose a level

By longitude, east to west, Kingston (76.5° W) falls between Ottawa (75.7° W) and Toronto (79.4° W). **It takes
`journey` slot 5**, and Toronto to the North renumber 6 to 11. `level.schema.json` describes `order` as
"1-10", and `game.config.schema.json` caps `journey` at `maxItems: 10`. Both change (obligations). Neither is
a bound field.

**Inserting a level into `unlockRules.order` re-locks levels a save has stamped.** `unlockedLevelIds` in
`app/domain/entities/level.ts` walks `order`, spending one stamp of credit per locked level, and stops at the
first it cannot open. Take a save that has stamped Halifax to Toronto. Kingston, inserted after Ottawa, takes
Ottawa's credit. The walk then stops at Toronto, and **a level the player has already finished is locked
again.** Appending Kingston to the end of `order` avoids that, but it would number the map 5 and unlock 11th.
So the domain fixes the rule. **The invariant: for every set of stamps, the levels a save can open after a
level is added to `order` include every level it could open before.** No save loses access. The engine owns
the implementation, and it lands before Kingston's level document.

### 10. What `docs/content-review.md` requires of the split and of Kingston

**The split itself re-files text without changing a word of it.** A question paraphrasing the guide about
Indigenous peoples may ship under §9.4, as it does today. The re-grant is the §9.4 check again.

| Half | Questions touching Indigenous peoples | Consequence |
|---|---|---|
| `history` (Québec City) | `hist-01` to `hist-06`, `hist-10`, `hist-13`, `hist-16`, `hist-22` | None. Unchanged, on a level that already ships them. |
| `building-canada` (Kingston) | `hist-34` (Tecumseh, the Shawnee), `hist-52` (Nunavut, 1999), `hist-55` (entry of the Northwest Territories), `hist-56`, `hist-57`, `hist-58` (the Métis of Red River, Louis Riel) | They ship under §9.4, as now. **Kingston must teach them before it pools them** (ADR-0057), and a teaching line is held to §9.4 word for word (§2): faithful paraphrase and no context added by an agent. |

**What Kingston may not do without a Tier 3 reviewer, and Tier 3 does not exist (§1):**

- **Draw any Indigenous person, in any scene** (§1, item 6). That includes Tecumseh, Joseph Brant, Louis Riel
  or any Métis figure, and silhouettes and crowds. No stop draws them.
- **Give a teaching line to a character drawn as Indigenous** (§1, item 4). The quest giver is a generic
  present-day character with no cultural markers.
- **Draw a Métis sash, or any object belonging to a specific nation** (§1, item 2; §4.4 is the sash's own
  worked example).

**The territory statement follows ADR-0051.** It names only nations that the source it cites prints, or
it gives `nations: []` with `nationsAbsentBecause`. This ADR names no nation, because no source has been
cited. A territorial fact line may ship without Tier 3 (§1, "may ship", item 5). Every city needs this review,
and Kingston is no exception (audit §5.6).

**Is Kingston "a level whose subject is a nation's territory or history" (§1, item 5)?** This ADR reads it as no.
The subject is the building of Canada, and six of its 65 questions concern Indigenous peoples. The reading is
an agent's, made at Tier 2, and so it is recorded as an open question for the product owner rather than as a
settled fact.

**Sir John A. Macdonald is taught as the guide states him, and no more.** He was the first Prime Minister
(p. 35, `hist-54`) and a Father of Confederation, and he was "a lawyer in Kingston". His record towards
Indigenous peoples is contested, and that is `OQ-REVIEW-9`'s tension exactly. Faithfulness binds the
questions. Anything more belongs in an "About this place" panel written by somebody who may write it (§9.4,
§10), and never by an agent. The statue that stood in Kingston's City Park was taken down in 2021. The art
contract confirms the site's present state from dated photographs, and **a statue that is no longer there is
not drawn** (CLAUDE.md, Art: reference-accurate, never invented).

## Alternatives considered

- **The page cut at 33/34 (54/43).** It has the widest margin: both halves clear by 13 or more, and it re-files
  only 43. I rejected it on fit. It gives Québec City the War of 1812 and Fort Henry, and gives Kingston
  Macdonald, the railway and the world wars. The one sentence the guide writes about a Kingston landmark would
  then be graded at Québec City. Kingston's Fort Henry stop would tell a proposition that its own level may not
  ask, and City Hall would have no Province of Canada to tell. A city chosen because the guide names it should
  not lose the sentence that names it.
- **Three ways (31/33/33).** I rejected it for now. It makes three subjects for two cities. The third would
  be pooled by no level, so its 33 questions leave play. At 12 subjects each gets 1 or 2 of 20, for a subject
  no player can walk into. The 29–36 half clears only by 3, and 23–28 only by 1. Decide it with city 12, when
  a bank crosses its next multiple of thirty (audit §5.6).
- **Re-file the 32, and let Kingston keep the id `history`.** This voids 33 fewer grants. I rejected it in §3:
  it runs the thin half through re-verification on a level that has already shipped.
- **Rename the moved ids (`bld-01` …).** Rejected in §2. It drops 65 FSRS cards from every save, and it voids
  nothing the move has not already voided.
- **Let Kingston share `history` with Québec City.** Rejected by ADR-0065 §1.1. With one bank behind two
  cities, the second city re-asks the first city's questions.
- **Tier 2 only, no city.** This stays the fallback if §7's condition never opens. Québec City's three ranked
  stops place 12 of about 65 overflow passages, and nothing else places the rest in play. Kingston's
  guide-named landmarks would still be told, but only at Québec City and Vancouver.
- **Waive ADR-0065 §1's room test on the owner's authorisation.** I rejected it. The owner authorised cities
  "where the guide needs them", and ADR-0065 is how this project measures need. The tier 2 stops are
  compatible with the split and cost the split nothing (§7).

## Consequences

- **Nothing in the tree changes in this commit** except this ADR, ADR-0069, the story, a slices row and a
  paragraph of `docs/architecture.md`. `npx depcruise app common --config .dependency-cruiser.cjs` is
  unchanged, because nothing in `app/` moves.
- **Kingston's landing PR is large, and the size is honest.** It holds the author re-file, the verifier
  re-grant, the level document, the quest, art and contracts for four landmarks with blind runs, the
  territory statement, the map anchors (ADR-0069) and the config slot. ADR-0065 §5 priced it this way.
- **Two history levels become topical.** Québec City's pools drop from 97 ids over three steps to 32. That
  ends the "period" pools ADR-0065 §1 named as the defect. Kingston asks 1812 to 1945 on its own streets.
- **A boundary defect this surfaces, recorded rather than fixed here.** `make validate-content` requires
  exactly one map anchor per level document. So Kingston's level document (content) and its anchor in
  `map-canada.anchors.json` (art) must land in **one commit by two owners**. ADR-0069 makes the obligation to
  fix it.
- **ADR-0065's "levels 1–5 of `journey`"** (its tier 1 obligation due 2027-02-21) means Halifax to Toronto as
  `journey` stood on 2026-09-21. After §9, Toronto is slot 6. The obligation keeps its original meaning.
- **Saved exam history is relabelled, not migrated.** An answer recorded as `history` before the split shows
  under Québec City's narrowed subtitle, even for a question now in `building-canada`. Rewriting a player's
  past attempts to fix a label is a save migration for a cosmetic gain, and it is refused.

### Rules stated here that no gate can express

- **That the two remits are remits.** The partition is checked for disjointness. Whether "building the
  country" is a teachable whole is editorial (ADR-0065).
- **The `hist-39` distractor in context** (§5). A distractor's fairness depends on where the question is
  asked, and no gate reads place.
- **The §10 reading of content-review §1, item 5.** It is an agent's reading, and it waits for a person.

## Obligations

- ~~**OBLIGATION due=2026-10-23 owner=engine** — make the unlock walk monotone under insertion (§9). For every
  set of stamps, adding a level to `unlockRules.order` never shrinks the set of levels a save can open.
  `unlockedLevelIds` gets a unit test with a fixture that inserts a level after a stamped one. The test must
  fail on today's walk and pass on the new one. This lands before any level is inserted into `order`.~~
  **DISCHARGED 2026-09-24** — the commit that strikes this marker lands it, before any level is inserted into
  `order`. `unlockedLevelIds(rules, stamped, previouslyUnlocked)` in `app/domain/entities/level.ts` returns
  the walk ∪ the stamped levels ∪ the levels the save already opened, and the walk no longer stops at a level
  that is already open (stamped or remembered) and cannot be paid for: it passes it without spending, and
  that level's stamp still earns credit. `tests/unit/domain/entities/level.test.ts` holds the fixture this
  marker asks for, on `content/game.config.json`'s real order with `kingston` inserted before `ottawa`: stamps
  on Halifax, Peggy's Cove and Québec City open Ottawa, and on the old walk (kept in the test as
  `legacyWalk`) the credit goes to Kingston and Ottawa locks; with Ottawa stamped too, the old walk locks
  Ottawa *and* Toronto. Both are asserted to fail on `legacyWalk` and pass on the new walk. A seeded property
  loop (400 trials, over 400 chained insertions) plays random saves over random orders, costs and insertion
  points, persisting the open set after every stamp and feeding it back, and asserts before ⊆ after at every
  insertion. It also asserts `legacyWalk` breaks the same property, so the loop is known to bite.
  **Two findings shaped the rule, and one reading of this marker is corrected by them.**
  (1) **Stamps and order alone cannot satisfy it, so the rule remembers.** "For every set of stamps" cannot be
  met by any rule that sees only stamps and `order`. Chained insertions reach any order from any of its
  subsequences, so monotonicity would force the set a rule opens for an order to contain what it opens for
  every subsequence. `[initial, X]` must open `X` for one stamp on `initial`, or no stamp ever opens
  anything, and it is a subsequence of every order holding both. So one stamp would open the whole map. That
  rule was rejected. The promise is kept for a save that remembers what it opened, and the save already
  can: `LevelProgress.unlocked` (`app/domain/entities/progress.ts`, codec field 4 under ADR-0026) was written
  by `withLevelUnlocked` and read by nobody. It is now the memory, **with no schema, codec or migration
  change**. `withRulesUnlocked(progress, rules)` marks open every level the rules open.
  `app/bootstrap/main.ts` calls it on every write and once at boot, and draws the map from
  `savedUnlockedLevelIds(progress)` as well as the stamps. `tests/unit/bootstrap/front-door.test.ts` proves
  the wiring against a real save in `localStorage`. A stamp-only save from an older build has the level its
  stamp opened written on first boot. A remembered level stays open with no stamp to pay for it. A save with
  nothing new is not rewritten. Both of the first two fail without the `main.ts` change.
  (2) **A remembered level is still paid for when the walk can pay.** Passing every remembered level for free
  was considered and rejected. It leaves a stamp unspent on every reload, so the fed-back set grows by one
  level each boot, and one stamp opens the map in about ten reloads. Charging a level the walk can afford,
  whether or not it is remembered, keeps the accounting identical to the old walk for every save played in
  order. The property loop asserts that equality, and that the persisted set is a fixed point. A save opens
  a level early only when an insertion hands it one: Kingston, above, opens without a stamp being spent on
  it. **What it cannot keep.** A save never loaded by a build carrying this commit has only its stamps and
  the rows a quest created. If it first loads a build that already has Kingston, a level it had opened and
  not played (Ottawa, above) moves to Kingston, although a *stamped* level never locks. That is why this
  marker lands before Kingston's config slot, and why that slot should not ship in the same release.
  `unreachableLevelIds` now plays the chain to its fixed point. It no longer stamps every level at once,
  because a stamp now keeps its own level open, and that check would have gone vacuous.

- **OBLIGATION due=2026-11-23 owner=content** — take Québec City's tier 2 stops (§7), which are the audit's
  ranks 1 to 3, each telling a `history`-half sentence. The alternative is to record their refusal as a play
  judgement on width, in `docs/plan/slices.md`. Either way, the entry names ADR-0065 §1's room test as met or
  as ended. Kingston's level document does not land before it.

- **OBLIGATION due=2027-01-23 owner=content** — the author half of the split (§4), in Kingston's landing PR.
  One commit moves the 65 documents listed in §2 to `content/questions/building-canada/` with ids unchanged,
  sets `subject`, writes each `verification` in the null form, and re-pools Québec City's three `answer`
  steps to `history` ids only, with at least `count` each. The ids are the ones in §2 and no others. A
  question that belongs on the other side comes back here as an amendment. It is not moved quietly.

- **OBLIGATION due=2027-01-23 owner=content-verifier** — the verifier half (§4). Grant the 65 in a commit that
  touches nothing else, record `distractorsNotEntailed` where ADR-0064 applies, and rule on `hist-39`'s
  "Kingston." distractor as asked at Kingston (§5). Report the count granted. If fewer than 30 are granted,
  `building-canada` does not ship, and this ADR is reopened.

- **OBLIGATION due=2027-01-23 owner=content** — Kingston's territory statement under ADR-0051. Nations are
  named only from the source it cites, or `nationsAbsentBecause` is given, and it passes the `about-this-place`
  panel's tests. Its teaching lines on `hist-34`, `hist-56`, `hist-57` and `hist-58` are faithful paraphrase
  with no added context (content-review §9.4, §2).

- **OBLIGATION due=2027-01-23 owner=content** — widen `history`'s margin (§6). Author questions from the
  pre-1812 sentences that audit §3 and §5(d) list for `history`, so the bank holds at least 36 verified. Author
  and verifier stay separate under ADR-0003. This is not a precondition for Kingston. If the guide cannot
  supply them, record that here in an amendment.

- **OBLIGATION due=2026-12-23 owner=infra** — raise `game.config.schema.json#/properties/journey/maxItems` to
  11 and correct `level.schema.json`'s `order` description, which says "1-10". Neither may become open-ended.
  The ADR-0065 §4 ceiling gate (due 2026-12-21) reports 11 levels, 11 subjects, ceiling 12, headroom 1 on the
  tree after Kingston lands.

- **OBLIGATION due=2026-12-23 owner=po** — amend `docs/stories/TN-LEVELS-2-to-10-spine.md`, narrowing
  `level.quebec-city.subtitle` to the §1 remit, since it is also the exam's subject label. Carry "of 11" into
  every exam and passport story that fixes the count at ten. Also rule on §10's open reading of content-review
  §1, item 5.

- **OBLIGATION due=2027-02-23 owner=architect** — amend this ADR with what landed: the split as merged, the
  counts granted in each half, Québec City's pool sizes, the headroom, and whether §7 was met by stops or by a
  recorded refusal. If Kingston did not land, record why. An authorisation left unused is a result (ADR-0065).

## References

- ADR-0028 (§1 the thirty floor; §3 first claim wins; §4 the proposition is identified by its quote),
  ADR-0030 (§1 graded against told; §5 a question's `subject` is bound and a level's is not), ADR-0056 (§3
  the strike-the-name test; §6 best and acceptable cases), ADR-0057 (a level asks what it taught), ADR-0065
  (§1 tiers; §1.1 two levels never share a subject; §4 the ceiling and the exam term; §5 the price of a split),
  ADR-0003 (author and verifier), ADR-0048 (a stop asks its own question or nothing), ADR-0051 (territory
  names), ADR-0064 (`distractorsNotEntailed`), ADR-0009 (the obligation format), ADR-0069 (the map)
- `docs/plan/guide-coverage.md` at `a3a6984` (§3, §5(b), §5(d), §5.5, §5.6)
- `docs/content-review.md` §1, §2, §4.4, §9.4, §10
- `app/application/use-cases/exam-session.ts` (`allocateQuotas`), `app/application/content/proposition.ts`
  (`sharesProposition`), `app/adapters/content/question-catalog.ts` (the address is the id),
  `app/application/persistence/progress-schema.ts` (`reviewState`, `examAnswer`), `app/bootstrap/subjects.ts`
  (subject label = level subtitle), `app/domain/entities/level.ts` (`unlockedLevelIds`),
  `scripts/verify-content.mjs` (A4; the author-role null-form rule; a rename is a delete and an add)
- `tests/unit/contracts/a-proposition-belongs-to-one-subject.test.ts`,
  `tests/unit/contracts/an-answer-steps-pool-can-fill-its-count.test.ts`,
  `tests/unit/contracts/question-bank-floor.test.ts`
