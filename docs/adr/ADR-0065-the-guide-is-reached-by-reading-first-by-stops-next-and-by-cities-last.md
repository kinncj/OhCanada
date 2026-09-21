# ADR-0065: The guide is reached by reading first, by stops next, and by cities last

- Status: Accepted (2026-09-21)
- Settles: how TrueNorth grows so that playing it covers the study guide; whether the growth is stops,
  levels or both, and on what test a person can apply to the eleventh case without asking anyone; what a
  new stop costs and who pays it; where the 302 lesson passages reach the player and which surface the next
  slice builds; what the ceiling on the number of levels is and what the map does when it is approached;
  and whether the thirty-verified floor holds on a subject that has been split.
- **Changes CLAUDE.md's Scope row in this commit.** §6. The row said "10 levels, 10 subjects, exam"; the
  owner has authorised growth in substance, and a repository whose CLAUDE.md contradicts its ADRs is the
  failure this project has spent four ADRs avoiding.
- **Amends nothing in ADR-0028, ADR-0030, ADR-0036, ADR-0057, ADR-0061 or ADR-0063.** It uses all six. The
  one thing it adds to ADR-0063 is a number that ADR-0063 explicitly declined to invent and that can now be
  derived: how many passages a stop may hold (§3.3).
- **Decides no content and moves no code.** It is a rule, a ceiling, a price list and six dated obligations.
- Slice: L5 (`docs/plan/slices.md`).
- Numbering. **0065 is the first number above the high-water mark across every ref this repository can
  see**, taken after `git fetch` from `git log --all --name-only -- docs/adr` *and* `git ls-remote --heads
  origin`, because the first alone cannot see a number claimed on an unfetched branch and the second alone
  cannot see one claimed on a local branch. `main` at `4842127` holds ADR-0001…ADR-0037, ADR-0039…ADR-0049
  and ADR-0051…**ADR-0064**, the last being *a threshold question records that its distractors were
  checked*, landed on `main` in `36fc4e4`. `git ls-remote` reports five remote heads — `main`,
  `archive/v0.1`, `reach-the-whole-bank`, `read-step-surface` and `task-fits-the-strip` — and none of the
  three live branches adds an ADR file; two local branches touch ADR-0064 and neither claims a number above
  it. **The check was worth making in both directions**: this document was drafted against a working tree
  at `71f6725`, an ancestor of `main` where ADR-0064 did not yet exist, and the header first said 0064 was
  claimed only on unlanded branches. It is on `main`. The holes at 0038 and 0050 stay untaken, for the
  reason ADR-0052 recorded and ADR-0056, ADR-0057, ADR-0061 and ADR-0063 restated.

## Context

### What the owner asked

> I need more content and quests…. there's not even 10% of the study guide when playing it

> create extra cities with extra POIs if needed for the content, whatever you can come up with…

Two sentences: a measurement and a proposed remedy. The measurement is right. The remedy is the most
expensive of the three available and it buys the least, and this ADR exists to say so with numbers rather
than to grant it or refuse it.

### The complaint, measured — and it is worse than "10%"

All figures below are taken against `origin/main` at `4842127` unless another ref is named.

A proposition's identity in this repository is its `source.quote`, compared by the containment rule in
`app/application/content/proposition.ts` — the rule ADR-0028 §4's gate and ADR-0036 §2.4 already use, so
two claims resting on one sentence count once. Clustering every verified claim in the tree by that rule:

| | Propositions |
|---|---|
| Distinct propositions this repository has verified, in total | **729** |
| …carried by the 493 verified questions | 455 |
| …carried by the 302 verified lesson passages | 292 |
| …**told inside a level** — every POI blurb, every territorial statement, every fact-bearing quest line | **81** |
| **Propositions a full playthrough tells the player** | **105 of 729 — 14.4%** |

"Told" is the number that matters, and it is the number the owner was estimating. A playthrough carries
**94 fact claims** across ten levels — 7 to 11 per level, median 9 — resting on 88 distinct sentences,
which cluster to 105 of the 729 propositions the corpus covers. Against the guide itself the fraction is
lower again: ADR-0061 measured *Discover Canada* at 18,372 words of which the whole corpus cites 46.3%, so
what a playthrough tells is roughly a seventh of a half.

Three other currencies are sometimes quoted for this and none of them is the complaint:

| Currency | Today | What it means |
|---|---|---|
| Verified questions in the bank | 493 | Reachable in Study and in the exam, in full, since before this ADR |
| Questions **pooled** by a quest step | 187 of 493 | What the scheduler may ever draw inside a level |
| Questions **asked** in one playthrough | 130 | What one sitting actually puts on a card |
| **Passages reachable by playing** | **0 of 302** | ADR-0063's measurement, unchanged |

A player who opens Study meets every one of the 493. A player who only plays meets 130 questions and 94
told sentences. The owner plays.

### What an eleventh city buys, measured

A level tells 7 to 11 propositions. That is not a budget anyone chose; it is what a level *is* — one `fact`
per `pointOfInterest` (`level.schema.json` gives a POI exactly one), one territorial statement, and four to
seven fact-bearing dialogue lines in its quest.

**So an eleventh city buys about nine propositions: 1.2% of 729.** Twelve cities buy about eighteen. The
remedy the owner proposed, taken to the limit the bank allows (§4 shows that limit is two more cities),
moves told coverage from 14.4% to about 17%.

### What reading the passages buys, measured

`content/lessons/` holds 302 verified, bilingual, granted passages carrying 292 distinct propositions, of
which **14** rest on a sentence a level already tells. The other 278 are new to a player who only plays.

| Scenario | Propositions a playthrough puts in front of the player | Share of 729 |
|---|---|---|
| Today | 105 | 14.4% |
| Today + every passage read on the quest path | **383** | **52.5%** |
| Today + pooled questions counted as well | 214 | 29.4% |
| Today + passages + pooled questions | 484 | 66.4% |

**278 propositions against a city's nine.** And the 278 need no art, no level, no reference entry, no blind
identification run, no texture, and — this is the part that decides the ADR — **no verifier commit at all**,
because every one of the 302 passages is already granted. ADR-0063 §Consequences called this "the first
content programme here whose marginal cost is an editorial judgement rather than a verifier commit", and
that sentence is worth thirty times what a city is worth.

### What is already in flight, so this ADR is not measured against a tree that is about to change

Three branches exist off `main` that bear on this, and none of them is this decision:

- **`reach-the-whole-bank` / `reach-pass2`** widen every `answer` step's `questionPool` until all 493
  verified questions are pooled. Measured on `reach-pass2`: pooled ids 187 → **493**, questions asked in a
  playthrough 130 → **137**, propositions told **105, unchanged**. A pool is not teaching. §Alternatives
  takes this seriously and §Consequences records what it does to ADR-0057.
- **`read-step-surface`** carries the reader card ADR-0063 needs. Passages reachable is still 0 until a
  quest names one.
- **`task-fits-the-strip`** sweeps every step prompt through the HUD task strip at 390×844 and 200% text,
  where the limit is **three wrapped lines**. Every new step this ADR authorises pays that gate.

### The stop ceiling, which is the constraint under everything below

`tests/unit/contracts/a-quests-answer-steps-fill-in-one-sitting.test.ts` walks each level's POIs and
characters once in x order and completes at most one `answer` step per stop. A quest left unfinished fails
the gate and locks every later level. **So a quest may hold no more `answer` steps than its level places
stops**, and every level is already at or one below that ceiling:

| Level (subject) | Stops | `answer` steps | Questions asked | Pooled ids | Width px |
|---|---|---|---|---|---|
| halifax (rights) | 5 | 4 | 14 | 25 | 7200 |
| peggys-cove (who-we-are) | 4 | 3 | 11 | 12 | 7040 |
| quebec-city (history) | 4 | 3 | 13 | 17 | 6048 |
| ottawa (government) | 5 | 3 | 14 | 15 | 9000 |
| toronto (elections) | 4 | 3 | 15 | 27 | 7680 |
| winnipeg (justice) | 4 | 3 | 10 | 13 | 7680 |
| prairie-rail (modern-canada) | 5 | 4 | 15 | 19 | 9600 |
| alberta-foothills (economy) | 5 | 4 | 19 | 34 | 8640 |
| vancouver (symbols) | 4 | 3 | 11 | 12 | 7680 |
| the-north (regions) | 3 | 2 | 8 | 13 | 7680 |
| **Total** | **43** | **32** | **130** | **187** | |

Nine of the ten sit exactly one below their ceiling; only `ottawa` has two spare stops. **There is no
headroom to ask more without new stops**, which is why "add stops" is a real tier and not a euphemism for
doing nothing.

## Decision

### 1. The reach test, and it applies to the eleventh case without asking anyone

**A proposal to grow the game names the verified propositions it would newly put in front of a player, and
takes the cheapest tier that can carry them. A tier is opened only when the tier above it is exhausted.**

> **Tier 1 — point at material that already exists.** No new art, no new grant, no new place. A `read` step
> naming granted passages; a Learn chapter; a pool widened as far as ADR-0057 allows. Exhausted when every
> verified proposition is reachable by some route a player who only plays can take.
>
> **Tier 2 — a stop on a level that already exists.** Authorised when the level's subject still holds
> verified propositions the level does not tell **and** the level has room, room being the three tests in
> §2.4. New art, two commits, a blind identification run, texture.
>
> **Tier 3 — a new level.** Authorised only when a subject **splits**: a bank holds at least sixty verified
> questions, so both halves independently clear the thirty floor, **and** the level carrying it is out of
> room under tier 2. The new level carries the **new** subject.

The test is a ratio and the ratio is the argument. Tier 1 buys 278 propositions for an editorial pass. Tier
2 buys **one told proposition per stop** — a POI carries exactly one `fact` — plus three to five questions
asked, for two commits, a reference entry, a blind run and 1.28 MB of decoded texture. Tier 3 buys about
nine, for everything in §2 five times over plus everything in §5.

**Applied today**, the test authorises: tier 1 everywhere, immediately; tier 2 wherever a level has room
(§2.4 says every level has some); and tier 3 **once**, because §4's arithmetic says `history` is the only
bank that can split — and the city it produces is the one this project could already see was wrong.
Québec City carries a 97-question history bank on three `answer` steps, so its pools are *periods*
("New France, the fall of Quebec and the years of British rule" — 33 ids) rather than topics, which is what
ADR-0036 exists to prevent. The measurement selects the split at exactly the place the defect is.

### 1.1 Two levels never share a subject, so an eleventh city is a subject decision before it is a place

`level.schema.json` gives a level exactly one `subject`, and `app/bootstrap/landmark-questions.ts` scopes
every in-level question to *the level's* subject — "an `answer` step's own `subject` is the fallback only
when the level has none to say". Pools are disjoint within a quest; **nothing makes them disjoint across
levels**. Two cities on one bank would therefore draw from one reservoir and re-ask each other's questions,
and the player would be told "You have seen this question before" in a city they had never visited.
TN-LEVELS-03 says the same thing from the other end: a level "shares none of them with another level's
subject".

So the mechanism is the split, and **yes, it is exactly the mechanism ADR-0028 and ADR-0030 already
permit**: two subjects may share a chapter and may never share a graded proposition.

**What identifies the split is the `subject` string on each question document, and nothing else.** A
question document carries one `subject`, so the halves are disjoint by construction; and that the halves do
not grade one sentence twice is **already machine-checked** —
`tests/unit/contracts/a-proposition-belongs-to-one-subject.test.ts` compares graded items across subjects by
the containment rule on `source.quote` and fails when two subjects rest on one sentence. A split is
therefore safe on the day it lands with no new gate. What it is not is cheap: see §5.

### 2. What a new stop costs, stated so nobody proposes forty of them casually

A stop is a `pointOfInterest` or a level `character`. Its full price, measured:

#### 2.1 Content — two commits and a refusal risk

`id`, bilingual `name`, bilingual `blurb` at roughly CLB 4, and a `fact` carrying one contiguous
`source.quote` and a `verification` block. Under ADR-0003 the author writes the first and **a separate agent
writes the second, in a separate commit**. `make verify-content` is red between the two by design, and the
verifier may reject, which returns it to the author. So: **two commits minimum, three when a grant is
refused**, for **one told proposition**.

#### 2.2 Art — a drawing, a contract, a blind run, and a digest that goes stale

A stop needs an SVG, and then it needs an entry in `assets/refs/references.json` — 56 today, one per art
subject, **including the generic ones**: `spruce-stand` has a contract exactly as `peace-tower` does. An
entry carries `expectedBlindAnswer`, named `referenceFiles` (real photographs), `mustBeRight` features each
with a `why` and a `detail`, and `neverAdd`. Then it needs a **blind identification run**: an anonymised
hand-off of hashed filenames, scored by `make verify-art` against a keymap the identifier never read. The
keymap records the digest of the SVG bytes; **redraw the art and the verdict goes stale and fails**, because
a green record about a picture nobody can see any more reads exactly like a green record about the picture
on disk.

#### 2.3 Budget — and it is not the thing that stops you

Measured over the 23 prop files in `assets/dist/manifest.json`: a stop's art is a median of **11.3 KB** of
the level's 8 MB payload (0.13%) and **1.28 MB of decoded texture** (max 2.03 MB), pinned at 1x. The ten
levels are **0.55–0.74 MB each, 2.01 MB in total** against a 100 MB budget, and sit at 68–86% of their
declared texture budgets with **5.4 to 12.2 MB spare** — so the declared budgets alone allow four to nine
more stops per level, and the 64 MB ceiling allows about twenty-five. **State this plainly: payload and
texture are not the constraint on stops, and any argument that says they are has not read the manifest.**

#### 2.4 Room — the three tests that *are* the constraint

A level has room for another stop when all three hold:

1. **Texture.** The declared `textureBudgetBytes` has at least one prop's worth spare (1.28 MB median, 2.03
   MB to be safe). `make check-assets` is the arbiter.
2. **Pitch.** Stops sit 1,500–2,400 px apart today with engagement radii of 220–340 px. Two stops closer
   than the sum of their radii are one stop the player cannot choose between (ADR-0032, ADR-0037). The
   deliberate exception is a character resting beside a POI — Québec City ships 290 px — and that is one
   stop with two faces, not two stops. A new stop therefore costs either ~1,600 px of level, which at the
   walk's 420 px/s is about four seconds of held thumb, or a tightening of the pitch that the level's art
   has to carry.
3. **The sitting.** One more stop is one more `answer` step, three to five more questions, on top of the
   8–19 a level asks and the 130 a journey asks. A level is not an exam and the exam is twenty questions.

#### 2.5 The quest — one more step, and it pays the strip

One more `answer` step with a bilingual prompt that fits **three wrapped lines** of the task strip at
390×844 and 200% text, and a `questionPool` naming at least `count` verified ids in the level's subject
**that the level tells** (ADR-0057).

**Summed: a stop is two content commits, an art commit, a reference entry, a blind run, ~1.3 MB of decoded
texture and a quest step — for one told proposition and three to five questions asked.** Forty stops is
forty blind identification runs and eighty-odd alternating commits, and it buys about forty propositions:
5.5% of 729. That is the sentence to quote when somebody proposes forty.

### 3. Where the 302 passages reach the player

**Both surfaces exist, and the division between them is a division of *completeness*, not of volume.**

#### 3.1 Learn is complete by construction, and it is the only surface that can ever read 302 of 302

ADR-0061's chapter reader holds every shippable passage, organised by the guide's own chapters. Its defining
property is one a gate can assert: **every passage that passes the shippable filter is reachable from
Learn.** No editorial judgement stands between a granted passage and a reader. It is the answer to "the
whole study guide in game" and nothing else in this project is.

#### 3.2 A level's `read` step is selective by construction, and not for want of room

The obvious objection is volume — 302 passages at three or four a stop needs eighty-odd stops. **The volume
argument is wrong, and it is worth correcting because it leads to the wrong design.** Measured over the
corpus, a passage is a median of **17 words** (minimum 6, maximum 48, 5,585 words in total). Four passages
is about 68 words, comfortably under the 155-words-per-landmark figure ADR-0061 §1 rejected; 302 passages
over today's 43 stops is 7 each, about 119 words a stop.

What actually bounds a level's reading is **relevance, which does not distribute**. ADR-0063 Context (c)
measured each level's empirical remit — the chapters its own verified bank cites — and the spread is
`halifax` **2** available passages against `alberta-foothills` **213**. No arrangement of stops fixes that,
because *Rights and Responsibilities* is nearly exhausted and *Canada's History* is not. A level reads what
belongs where the player is standing, and that is an editorial bound under ADR-0056 §6 and ADR-0063, not a
capacity.

#### 3.3 A stop's reading budget — the number ADR-0063 declined to invent

ADR-0063 left "how many passages a stop should hold before it is a wall of text" to the story and a11y
owners. The measurement now exists, so the ceiling can be derived rather than felt:

> **The `read` steps at one stop — every `read` step sharing a `targetId` — together name at most four
> passages and carry at most 120 words in either language.**

120 sits below ADR-0061 §1's rejected 155 and above four median passages (68), so it binds only the long
tail: four 48-word passages would be 192 and is refused. It is counted **per stop and not per step**, or two
steps at one plaque dodge it. **This is a ceiling, not a target.** Whether three reads better than four is
the story owner's, and ui-a11y may lower it against the real card; raising it needs an ADR.

#### 3.4 What the next slice builds, which is the question most wanted settled

**The level `read` step surface first; Learn immediately after, in the next slice, not "later".** The order
is arithmetic:

- The owner's sentence is *"when playing it"*. Learn is a third door behind a menu, and ADR-0061 §1 already
  ruled it is not reachable by playing.
- The level surface is nearly built. The loader accepts `read` and refuses it by shape (`71f6725`);
  `scripts/lib/lesson-passages.mjs` resolves `{ lesson, passage }` and fails differently on zero and two;
  the reader card is on `read-step-surface`. What is missing is content: quests naming passages.
- Pointing the **43 stops that already exist** at passages takes told coverage from **105 of 729 (14.4%) to
  as much as 383 (52.5%)** with no new stop, no new level, no new art and no new grant. Nothing else
  available to this project moves that number by more than a few points.
- Learn then takes reachability to 302 of 302, which the level surface can never do (§3.2), and it is the
  surface a player studying for the test at a kitchen table actually wants.

**Learn is not deferred by this and none of its obligations move.** ADR-0061's ui-a11y obligation
(2027-01-18) and ADR-0063's (2027-01-20) are the same question — how a single-switch and a screen-reader
player move through a document — asked of a long document and a short one. Answering the short one first is
cheaper, and **the two answers must be one design**, which ADR-0063 already says and this ADR does not
weaken.

### 4. The ceiling

Three candidates. Two are not the ceiling, and saying so is half the value of this section.

**Payload is not the ceiling.** 0.55–0.74 MB a level, 2.01 MB in total, against 100 MB. At today's art
density the budget holds roughly 130 levels. Anyone who says "we cannot afford more cities" on payload
grounds has not measured.

**Texture is not the ceiling.** It is a per-level budget, so it bounds stops (§2.4) and says nothing about
how many levels there are.

**The subject is the ceiling, and it is arithmetic.** A level carries exactly one subject (`level.schema.json`);
two levels never share one (§1.1); every shipping subject carries thirty verified questions, and
`question-bank-floor.test.ts` reads "shipping" off `content/levels/`, so the floor binds the moment a level
names a subject. A split is a partition of **one** bank — a proposition belongs to one subject, so
questions cannot be moved between banks to manufacture one. Therefore:

> **levels ≤ subjects ≤ Σ over banks of ⌊verified ÷ 30⌋**

Measured today:

| Subject | Verified | ⌊v ÷ 30⌋ |
|---|---|---|
| history | 97 | **3** |
| regions | 59 | 1 |
| economy | 51 | 1 |
| who-we-are | 48 | 1 |
| symbols | 43 | 1 |
| government | 41 | 1 |
| modern-canada | 40 | 1 |
| justice | 39 | 1 |
| rights | 38 | 1 |
| elections | 37 | 1 |
| **Ceiling** | **493** | **12** |

**Ten levels exist. The bank authorises twelve. Both new levels must carry a subject split out of
`history`, which is the largest chapter in the guide and the one ADR-0061 measured as holding 2,321 uncited
words — 49% of the chapter — so it is also the bank most able to grow.** The ceiling is a live number: one
more verified `regions` question takes it to 13. And the banks are bounded above by the guide, which is
18,372 words and cannot be supplemented from outside it (ADR-0028's two rejected traps).

**A second term, from the exam.** `allocateQuotas` in `app/application/use-cases/exam-session.ts` shares the
exam's twenty questions equally among the subjects that are ready. At ten subjects each contributes two. At
twelve, `history`'s three subjects contribute five of twenty where `history` contributes two today, and
every other subject drops from two to one or two. **At more than twenty subjects a subject cannot receive a
single question in an exam.** A subject the mirror cannot show has subdivided past the instrument, and the
instrument is IRCC's and not ours. So **subjects ≤ 20, absolutely**, and no split lands without its effect
on the exam mix reported alongside it.

#### 4.1 What the map does — and it is already at its limit at ten

Fifteen cities is above the ceiling and cannot happen on this bank, so the honest question is what happens
at eleven and twelve, and the answer is already written in the stylesheet. A map pin is **4.2% of the map's
width** — `app/ui/screen-styles.ts` records why: *"as big as a pin gets before Toronto's and Ottawa's touch,
14.4 CSS px apart at 347 px"*. 4.2% of the 1080-unit viewBox is 45.4 units; Ottawa and Toronto are **44.4
units apart**. **The pins already touch at ten stops.** Halifax and Peggy's Cove, 4.0 units apart, have the
only available answer: a 13.41× inset, with both stops anchored inside it and neither pinned on the main
map.

So an eleventh stop in the Windsor–Québec corridor needs a second inset, and
`content/schemas/map-anchors.schema.json` carries `inset` as **one object, not an array**. **A city in the
populated south is therefore an additive sidecar schema change and a second inset drawn in the art sheet,
before one line of level content exists.** That is a real cost and it belongs in the tier 3 proposal, not in
the surprise afterwards.

**None of this touches the control, and that is why fifteen would be survivable if the bank ever allowed
it.** The map is `aria-hidden`, holds nothing focusable and takes no pointer input; the control is the
vertical list of cards, which scrolls, and the pin's only information is the numeral its card already shows.
At fifteen the map would be a drawing with several insets and a route line, and the game would still be
chosen from a list. The decision to make the map decoration rather than the control is what makes the level
count a content question rather than a screen-geometry question, and it should not be revisited.

### 5. The thirty floor on a split subject: yes, and yes — and it is the reason tier 3 is rare

**The floor holds, and a split subject needs thirty of its own.** The rule's words are "≥ 30 verified
questions per subject before that level ships"; a split subject is a subject and its level is a level.
Nothing needs building: `question-bank-floor.test.ts` derives shipping subjects from `content/levels/`, so
the day a level document names `canadas-first-century` that subject is held to thirty, and the day before it
is not.

This is not a formality, and it is what makes the ceiling 12 rather than 50.

**And a split is more expensive than it looks, in a way that is already machine-enforced.** Re-filing a
question changes its `subject`, and `subject` is a **bound author field** for a question document.
`scripts/verify-content.mjs` states the reason in terms: *"A QUESTION's `subject` is still bound, because for
a question the unit is the document, and re-filing a question changes the floor, the exam row and the
ADR-0028 comparison it enters."* So **gate A4 voids the grant on every question a split re-files**.
Splitting `history` 49/48 means about 48 question documents edited, 48 grants voided, and a verifier commit
re-granting 48 questions before the tree is green again.

**The full price of tier 3, then:** a full art set and parallax layer suite; a territorial statement with
one citation whose names come out of it (ADR-0051) and the Indigenous content review
`docs/content-review.md` requires, which slice 10 records as unobtainable for one region; four or five stops
at §2's price each; a map anchor and possibly a second inset with its schema change; a subject split that
voids and re-grants thirty to forty-eight question grants; and a re-weighted exam. **For about nine
propositions.**

### 6. CLAUDE.md's Scope row changes in this commit

The row read:

> 10 levels, 10 subjects, exam. Slices are engineering practice, never a scope cut.

It now carries the rule and the ceiling, because a number in CLAUDE.md that an ADR has replaced is exactly
the drift ADR-0009 exists to catch and cannot catch, since a scope row has no date on it.

## What this makes impossible

- **Proposing a place before a proposition.** A growth proposal that does not name the verified propositions
  it newly reaches, and the tier it needs, is not a proposal. §1.
- **Two levels naming one subject.** §1.1, and the draw is the reason rather than the taste.
- **A new subject that is not a partition of an existing bank.** §4. A subject invented for a city, or
  assembled by moving questions out of two banks, is refused twice — once by the floor it leaves behind and
  once by `a-proposition-belongs-to-one-subject.test.ts`.
- **A split subject shipping under thirty verified questions.** §5.
- **A stop's reading growing without a bound.** §3.3: four passages and 120 words per stop, counted per
  stop.
- **"We cannot afford more levels" argued on payload or texture.** §4 measures both; neither is the ceiling.
- **A thirteenth level on today's bank**, and a twenty-first ever without an ADR that faces the exam's
  arithmetic. §4.
- **Answering "not 10% of the guide" by widening pools.** §Alternatives. Pooled ids are not told
  propositions, and the measurement says told coverage does not move at all.

## Alternatives considered

- **Grant the request as put: extra cities with extra POIs.** Rejected on the ratio, not on principle. A
  city buys about nine propositions of 729 for a full art set, a territorial statement with a review this
  project cannot always obtain, four or five stops at §2's price, a map inset with a schema change, a
  subject split that voids up to 48 grants, and a re-weighted exam. Reading buys 278 for an editorial pass.
  **What survives from this option is the whole of its premise** — the game *is* thin, the owner is right,
  and tier 3 is not closed. It is put behind a test it can pass, and §4 says the bank authorises two cities
  the moment a level is out of room.
- **Stops only; never add a level.** Rejected. It would leave `history` — 97 verified, the guide's largest
  chapter — permanently asked at one city in period-sized pools, the exact shape ADR-0036 exists to prevent.
  A ceiling exists so growth is bounded, not so it is zero.
- **Let two levels share a subject, so a city needs no split.** Rejected on the draw (§1.1): one reservoir,
  two cities, and the second re-asks the first's questions with no way to tell the player why.
- **Give a level two subjects.** Rejected: `level.schema.json` has one, the stamp, the passport line and the
  draw all key on one, and a second re-runs ADR-0028's many-to-many argument in a third place with a weaker
  answer than ADR-0028 gave it.
- **Raise the per-level texture budgets and pack ten stops onto each existing level.** Rejected as a *first*
  move, and the measurement is why: the budgets are not what would break (5.4–12.2 MB spare inside the
  declared figures, ~25 MB more to the 64 MB ceiling). The pitch and the sitting would break first (§2.4),
  and it still buys one proposition per stop against reading's 278 for no art at all.
- **Widen every `questionPool` until all 493 questions are pooled** — what `reach-the-whole-bank` and
  `reach-pass2` do. **Adopted as tier 1 in part and refused as the answer.** Measured on `reach-pass2`:
  pooled ids 187 → 493, questions asked in a playthrough 130 → 137, **propositions told 105 → 105**. It buys
  reach at the cost of topicality — Québec City's history pool becomes 97 ids across three steps — and it
  moves the complaint's own number not at all. A pool may widen only as far as ADR-0057's taught set allows;
  see §Consequences for what that branch does to that rule today.
- **Target "every verified question asked in one playthrough".** Rejected. At today's 4.06 questions per
  `answer` step it needs about 120 answer steps, hence about 120 stops against today's 43, and it mistakes
  assessment for teaching: Study already reaches all 493 and the exam draws from all of them. A playthrough
  is where material is *met*.
- **Put the passages only in Learn and let a level link to it.** Already rejected by ADR-0063 and not
  reopened: it answers "when playing it" with a menu and a context switch mid-traversal.
- **Put the passages only in levels and skip Learn.** Already rejected by ADR-0063 §6 and reinforced here by
  §3.2: relevance does not distribute, so a level surface can never be complete, and `halifax` would be
  entitled to two passages for ever.

## Consequences

- **Nothing in the game changes today. No schema, no port, no adapter, no scene, no screen, no content, no
  copy** — this commit is one ADR, one architecture note, one slices row and one CLAUDE.md row.
  `npx depcruise app common --config .dependency-cruiser.cjs` reports no violations before and after,
  because nothing in `app/` moves.
- **CLAUDE.md's Scope row is replaced in this commit** (§6), so the tree never holds an ADR and a CLAUDE.md
  that disagree about how many levels there may be.
- **Two levels are authorised by the arithmetic and neither is scheduled by this ADR.** Authorisation is not
  a plan: tier 3 opens when a level is out of room under tier 2, and the obligation below asks the architect
  to rule on whether that has happened rather than assuming it will.
- **A split reweights the exam and the number is known in advance.** Ten subjects give every subject two of
  twenty; twelve give `history`'s three subjects five between them. Whoever writes the split ADR reports the
  mix before and after.
- **The map is at its pin-density limit now**, at ten stops, and the eleventh in the south is a sidecar
  schema change (`inset` is one object) plus a second inset in the art sheet before any content exists.
- **A contradiction found in flight, and it is load-bearing rather than tidy.** `reach-the-whole-bank` /
  `reach-pass2` pool all 493 verified questions. Measured by ADR-0057's own rule — a pooled question's
  `source.quote` must share a proposition with a `factClaim` its level tells — compliance goes **from 67 of
  187 pooled ids taught (36%) to 85 of 493 (17%)**: the untaught pool grows from 120 rows to **408**.
  ADR-0057's gate (`a-level-asks-what-it-taught.test.ts`, infra, due 2026-11-17) **does not exist yet**, so
  nothing stops that landing, and when the gate arrives it fails on 408 rows instead of 120. This ADR does
  not rule on that branch — the pools are content and the gate is infra's — but it records the number,
  because "493 of 493 pooled" and "a level asks only what it taught" cannot both be true of the same tree,
  and the second is a decided rule.
- **The honest first target is small and it is not 302.** One level with one `read` step of four passages
  moves passages-reachable from 0 to 4 and told coverage from 105 to about 109. The programme is what moves
  it to 383. Anyone quoting 52.5% as a result of this ADR is quoting a permission, not a measurement — the
  same sentence ADR-0063 had to write, for the same reason.
- **The reach test will sometimes authorise nothing**, and that is a result. If tier 1 lands and the owner
  is satisfied at 383 of 729, no city is built, and the architect's obligation below requires that outcome
  to be written down rather than left as silence.

### Rules stated here that no gate can express

- **Whether a place is worth visiting.** The reach test scores propositions against commits. It cannot say
  whether a city is a good place to set a level, and it should not be read as trying to.
- **Where a split falls.** Σ⌊v ÷ 30⌋ says how many splits a bank can afford and never where the line goes.
  That the halves are disjoint is checked; that they are two *remits* rather than an arbitrary cut is
  editorial, and ADR-0028 §4's identity only proves disjointness after somebody has drawn the line.
- **Whether a passage belongs where it is read.** ADR-0063 settled this and it is unchanged: a legal passage
  may still be a non sequitur.
- **Whether told is learned.** 383 propositions *shown* is not 383 known. Every number in this document
  measures exposure, and the only instrument in the project that measures knowledge is the exam.
- **Whether a level is too long to walk.** §2.4's pitch test is arithmetic; whether 12,000 px of held thumb
  is tiring is a play judgement, and the a11y owner's auto-move default (ADR-0058) changes the answer.

## Obligations

- **OBLIGATION due=2026-12-21 owner=infra** — gate the stop reading budget (§3.3): over every quest, the
  passages named by all `read` steps sharing a `targetId` number **at most four** and carry **at most 120
  words in either language**, counted from the *resolved* passages in `content/lessons/**` rather than from
  the quest, so a step cannot dodge the count by naming a passage that grew. It extends
  `scripts/lib/lesson-passages.mjs`, whose resolver already answers exactly-one-or-a-named-failure. Not
  vacuous on a tree with no `read` step (ADR-0024): it reports the number of stops it measured and the
  number of passages it resolved as numbers, and asserts the resolver still finds all 302.

- **OBLIGATION due=2026-12-21 owner=infra** — gate the ceiling (§4): no two level documents name one
  `subject`, and the number of subjects a level names is at most Σ over banks of ⌊verified ÷ 30⌋. It prints
  the per-subject terms and the remaining headroom, so the day a bank crosses a multiple of thirty the
  change is reported rather than discovered by someone drafting a city. It ships covering the shipped tree:
  10 levels, 10 subjects, ceiling 12, headroom 2.

- **OBLIGATION due=2027-01-21 owner=ui-a11y** — confirm or lower §3.3's four-passage, 120-word stop budget
  against the reader card at 390×844 and 200% text, in the story that carries the reader, and answer it
  **together** with ADR-0061 §8's and ADR-0063's single-switch and screen-reader question, which are the
  same question asked of a long document and a short one. One design for all three. Raising the budget needs
  an ADR; lowering it in the story does not.

- **OBLIGATION due=2027-02-21 owner=content** — tier 1, first half: author `read` steps on levels 1–5 of
  `journey`, choosing passages by relevance under ADR-0063 and inside §3.3's budget, and report the told
  coverage afterwards against the baseline in Context (105 of 729). Not `the-north` and not *Canada's
  Regions* material, for the reason ADR-0063 gives and ADR-0028's open live check of that chapter.

- **OBLIGATION due=2027-03-21 owner=content** — tier 1, second half: the same on levels 6–10 of `journey`,
  with the Indigenous content review `docs/content-review.md` requires wherever it applies.

- **OBLIGATION due=2027-04-21 owner=architect** — re-measure the reach test's inputs over the tree as it
  then stands and rule on tier 3 in an amendment: propositions told by a playthrough, passages reachable by
  playing, pooled ids and the fraction of them their level teaches, the per-subject ceiling terms, and
  whether any level is out of room under §2.4. If a split is due, the ADR that makes it names both remits,
  the partition by `source.quote`, the grants it voids, and the exam mix before and after. **If reading has
  moved told coverage past half the corpus and no city is needed, record that** — an authorisation that went
  unused is a result and it must be written down rather than left to lapse (ADR-0009). Like ADR-0061's and
  ADR-0063's re-measurements, this cannot run in CI.

## References

- The product owner's two sentences, quoted in Context: more content and quests, not 10% of the study guide
  when playing it; extra cities with extra POIs if needed
- ADR-0028 (§1 the thirty floor; §2 a remit is not a chapter; §4 a proposition is identified by its quote;
  §5 a level names its sources and a source does not name its levels), ADR-0030 (§1 a subject owns what it
  grades, not what it tells; §2 told claims are outside the rule) — together, the mechanism §1.1 uses for a
  split
- ADR-0036 (a level asks its own subject; the landmark's question first — the rule Québec City's period
  pools break), ADR-0048 (a stop asks only what it told), ADR-0057 (a level asks only what it taught; §1's
  ordering clause), ADR-0054 (a promised count is not paced by the day's new-question budget)
- ADR-0061 (the Learn surface; §1's 155-words-per-landmark rejection; the guide at 18,372 words and 46.3%
  cited; the teachable remainder concentrated in *Canada's History*), ADR-0063 (a passage is met where it is
  played and never copied; §3 one voice; §4 the `{ lesson, passage }` pair; Context (c)'s per-level
  editorial bound; the wall-of-text number it declined to invent, now §3.3)
- ADR-0003 (the author/verifier split per commit; gate A4), ADR-0051 (a territorial statement names only
  what its source names), ADR-0013 (decoded texture memory is the binding budget), ADR-0020 (a level names
  its art, the manifest prices it), ADR-0032 and ADR-0037 (a drive stops at each engageable; a stop rests
  beside a character), ADR-0058 (auto-move), ADR-0009 (the obligation format above), ADR-0024 (an empty
  collection must not reduce to a pass)
- `tests/unit/contracts/a-quests-answer-steps-fill-in-one-sitting.test.ts` (the stop ceiling),
  `tests/unit/contracts/question-bank-floor.test.ts` (shipping subjects read off `content/levels/`),
  `tests/unit/contracts/a-proposition-belongs-to-one-subject.test.ts` (what makes a split safe with no new
  gate), `app/application/content/proposition.ts` (the containment rule every measurement here used),
  `app/application/use-cases/exam-session.ts` `allocateQuotas` (the exam's second ceiling term),
  `app/bootstrap/landmark-questions.ts` (the draw that makes a shared subject impossible),
  `scripts/verify-content.mjs` (`subject` is a bound author field for a question — §5's re-granting cost),
  `app/ui/screen-styles.ts` (the pin at 4.2% and the Ottawa–Toronto measurement),
  `content/schemas/map-anchors.schema.json` (`inset` is one object, not an array),
  `assets/refs/references.json` (56 art contracts; a generic prop carries one too),
  `assets/dist/manifest.json` (the per-level payload and per-prop decoded figures)
- `docs/plan/slices.md` — slice L5
