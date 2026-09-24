# Guide coverage: how much of *Discover Canada* the game carries, and what a player reaches

- Measured 2026-09-23 on `origin/main` at `7441451`, against the extraction
  `fd51046981916115cc39b989e9eedd3ab2c5943aeb7e0fe4e237e13a0da7c836` (the register's
  `extractedTextSha256`). canada.ca refused the fetch, so the PDF came from the Wayback Machine's
  2026-08-03 capture of `discover-large.pdf`. It hashed to the register's `sha256`. `pdftotext -layout`
  **24.02.0** then reproduced the recorded text digest byte for byte, although the register records 26.08.0.
- Re-run with `make source-coverage` (`scripts/guide-coverage.mjs`). Add `-- --list` for every uncovered
  sentence, and `-- --units` for every unit with its class and carriers. The script is a measurement and
  not a gate. It needs the git-ignored extraction, so it cannot run in CI (ADR-0061 §9).
- The owner's goal: every testable proposition in the guide can be reached by a player, not just stored in
  the repository. This page says how far the tree is from that, and what order of work closes the gap.

## Headline

| Chapter (register) | pp. | Props | Question | Lesson | Level-told | **Any** | **None** | Told in play |
|---|---|---|---|---|---|---|---|---|
| The Oath of Citizenship | 2–3 | 1 | 1 | 0 | 0 | 1 | 0 | 0 |
| Rights and Responsibilities | 11–15 | 38 | 36 | 3 | 15 | 38 | 0 | 15 |
| Who We Are | 16–22 | 65 | 47 | 26 | 9 | 60 | 5 | 9 |
| Canada's History | 23–44 | 206 | 103 | 101 | 16 | 192 | 14 | 16 |
| Modern Canada | 45–53 | 83 | 42 | 38 | 8 | 78 | 5 | 8 |
| How Canadians Govern Themselves | 54–59 | 43 | 33 | 9 | 13 | 42 | 1 | 13 (15 after #137) |
| Federal Elections | 60–74 | 94 | 63 | 28 | 13 | 87 | 7 | 13 |
| The Justice System | 75–77 | 26 | 25 | 1 | 11 | 26 | 0 | 11 |
| Canadian Symbols | 78–89 | 78 | 51 | 26 | 16 | 74 | 4 | 16 |
| Canada's Economy | 90–92 | 20 | 19 | 2 | 6 | 20 | 0 | 6 |
| Canada's Regions | 93–105 | 124 | 85 | 54 | 25 | 121 | 3 | 25 |
| **Total** | | **778** | **505** | **288** | **132** | **739** | **39** | **132** (134) |

Read the table this way:

- **Stored: 739 of 778 (95.0%).** Nearly every teachable sentence in the guide is now carried by at least
  one verified claim. ADR-0061 measured 46.3% word coverage before the lesson programme. The 302 lesson
  passages authored on 2026-09-18 and 2026-09-19 closed most of the rest. **"Stored" is no longer the
  problem.**
- **Told while playing: 132 of 778 (17.0%).** These are sentences a POI blurb, a territorial statement or a
  quest line puts in front of a player who only plays. After PR #137 (`read-step-at-dows-lake`, 2 passages
  at Ottawa's Dow's Lake) the figure is 134. Play also asks **137 questions** per journey, drawn from pools
  that since `reach-pass2` hold all **493** verified questions. Those questions rest on 505 sentences, but
  one journey puts 137 of them on a card.
- **Readable anywhere: 0 surfaces.** No Learn screen exists (§4). Only Study reaches the questions in full.
  Nothing reaches the passages except the 2 that PR #137 names.

Columns overlap: a sentence carried by a question and a passage counts in both. Stored claims: 900 verified
claims cite the guide (493 questions, 302 passages, 105 level-told). Every quote was located in the
extraction. None located only away from the page it cites.

## 1. Method

**The unit is a sentence of the guide.** The extraction is split into pages at `pdftotext`'s form feeds,
so page N is the Nth segment. This is the register's own convention: the Oath is on page 3. The printed page
number is dropped. Each page is split into blocks at blank lines and bullets. A block that runs off the
foot of a page mid-sentence is joined to its continuation. Each body block is split into sentences at
`.`, `!` or `?` before a capital. The split skips initials (`John A.`), dotted acronyms (`U.S.`, `B.C.`)
and known abbreviations (`St.`, `Dr.`, `p.`). A row of the guide's own tables is one unit each: a
capitals row with dotted leaders, a date row in the holidays table, an entry in the expansion list
(`1871 – British Columbia`), a bullet. Everything else is one unit per block, classed by why it is not
teaching: heading, caption, verse, worksheet, invitation, lead-in, fragment, Oath recitation, known-stale,
outside the register.

**A unit is in scope** if it is a body sentence. It is also in scope if any verified claim rests on it,
whatever its class. A claim resting on a caption proves somebody found a proposition there (ADR-0056).

**The match is `sharesProposition`'s containment rule, located.** `app/application/content/proposition.ts`
counts two claims as one proposition when one normalised quote holds the whole of the other on word
boundaries. ADR-0028 §4, ADR-0036 and ADR-0063 all use this rule. Here the other side is the guide. Each
verified claim's `source.quote` is tokenised by `words()` from `scripts/lib/claims.mjs`, the tokeniser every
content gate uses, with diacritics folded as `normaliseQuote` folds them. The quote is then located as a
contiguous run in the tokenised guide. A sentence is carried when the run and the sentence contain one
another. For a quote that crosses a sentence boundary, the piece inside the sentence must be at least three
words. Four sentences are carried only that way, which is the `Piece` column. Where a quote occurs more
than once, the occurrence on or next to the cited page wins.

**Carriers** are claims citing `discover-canada` whose `verification.status` is `verified` and whose
`verification.sourceHash` and `source.sourceHash` are the current digest:

- **question**: a question document.
- **lesson**: a passage in `content/lessons/**`.
- **level-told**: a POI blurb, a territorial statement or a fact-bearing quest line.
- **read**: the subset of lessons that a quest's `read` step names.

**What the method cannot say.** These limits follow ADR-0019 and are stated so the numbers are not read as
more than they are:

- It cannot tell whether a paraphrase resting on one sentence also teaches its neighbour (ADR-0028 §4).
- It cannot tell whether a sentence holds one proposition or three. Sentence count is therefore a floor
  on proposition count.
- Edge cases of heading or caption classing are judgement calls. `--units` prints every unit so any reader
  can audit them.

The corroboration is ADR-0061's measurement: it located 541 distinct quotes with 12 misses. This run
locates all 900 claims with 0 misses and 0 off-page, because it uses the gates' token rule and not a
string rule.

### Excluded, and why

| Class | Units | Why it is not counted |
|---|---|---|
| Outside the register (front matter pp. 1, 4–10; back matter pp. 106–129) | 248 | ADR-0061 §3. The register's `chapters[]` span no page here, and `questions-cite-a-cached-source` rejects any claim citing one. This covers *How to use this booklet*, the study questions on p. 106 and the contact lists. It also covers **p. 4, "Understanding the Oath"**. What the Oath *means* is teachable, but only after the register gains the page. |
| Oath recitation (pp. 2–3), the French block | 1 | ADR-0061 §3 and `knownStaleness`: the text swears allegiance to Queen Elizabeth the Second. The English block counts in scope because `justice` grades a proposition in it. |
| Headings | 120 | They are not propositions. |
| Picture captions | 57 | ADR-0061 §3: a caption may support a claim but may not be a lesson. Two facts exist *only* in captions, as `0073ff8` recorded: King George V assigning the national colours (p. 34), and Phil Edwards (p. 42). |
| The study worksheet (pp. 70–74) | 25 | ADR-0061 §3: it is a blank form. |
| Verse: *In Flanders Fields*, *O Canada* EN/FR, *God Save the Queen* EN/FR | 7 | ADR-0061 §3: reproducing verse is reproduction. A passage may teach *about* verse, and three already do. |
| The museum invitation (p. 53) | 1 | ADR-0061 §3: it is a call to action. |
| The $10 bill sentence (p. 35) | 1 | `docs/plan/slices.md`, 2026-09-19. The guide is wrong about the note, and the guard is a plan row, not a flag. |
| Lead-ins and fragments ("The most important of these include:", "(See voting procedures)") | 4 | These are signposts, not claims. |

## 2. Why Justice, Economy, Rights and Government have so few lessons

**This is not a rule. It is the scope of the first authoring pass, and that pass aimed at the sentences
nothing else carried.** No ADR says lessons exclude propositions that questions carry. ADR-0061 §3 says
the opposite in terms: *"Excluded because it is already elsewhere: nothing."* Its Consequences gave two
bounds:

- **A floor, "the gap alone": about 200 to 350 passages.** These were for the 5,446 uncited teachable words.
- **A ceiling, "a readable guide": about 740 to 900 passages.** Here Learn restates the propositions
  already cited, because "a chapter with holes exactly where the levels already taught is not a chapter".

The programme that ran was the floor. The commits say so:

- `0073ff8` *Teach the history chapter the guide does not yet reach*: 104 passages, "the largest uncited
  block in the guide at 2,321 words".
- `3c134f0` *Teach the last chapter the guide does not reach* (Govern Themselves): 10 passages; "the
  teachable uncited prose is about 145 words".
- `349f6a5` *Close the guide's last three chapters* (Rights, Economy, Justice): 5 passages. "The brief said
  not to pad and the author did not: Justice has exactly one uncited body sentence in the whole chapter, so
  it gets one passage." The same commit counts a word as cited "when any claim covers it including told
  claims – quest lines and POI blurbs".

ADR-0063 Context (a) confirms it from the other side: 277 of the 302 passages rest on a sentence no
question cites, "by construction". This measurement confirms it once more. The thin chapters are the
chapters the question bank had already exhausted:

| Chapter | Passages | Sentences a question carries | Sentences with no lesson |
|---|---|---|---|
| The Justice System | 1 | 25 of 26 | 25 |
| Canada's Economy | 2 | 19 of 20 | 18 |
| Rights and Responsibilities | 2 | 36 of 38 | 35 |
| How Canadians Govern Themselves | 10 | 33 of 43 | 34 |
| Canada's History | 104 | 103 of 206 | 105 |

So Learn, built today, would open *Justice* on one paragraph about the police, even though the chapter has
25 teachable sentences. A reader of Learn would see holes wherever the question bank is strong. That is
the defect ADR-0061's ceiling was written to prevent, and it is what §5(a) closes. **No ADR amendment is
needed. The ceiling programme is already decided and was never scheduled.**

## 3. Uncovered propositions (39), with a disposition for each

Every in-scope sentence that no verified claim carries is listed below. The quotes are citations, the
same practice as `source.quote` and the table in `docs/plan/slices.md`. A **teach** row needs a lesson
passage and, where the remit allows, a question. An **exclude** row gives its reason.

**Who We Are (5)**

| p. | Sentence | Disposition |
|---|---|---|
| 18 | "Each could learn 'from the other, and … while they cherish their own special loyalties and traditions, they cherish not less that new loyalty and tradition which springs from their union.'" | Teach *about* the quotation (Canadian Club of Halifax, 1937). Never reproduce it. |
| 18 | "The 15th Governor General is shown here in Blood (Kainai First Nation) headdress." | Exclude. It is a caption in body type ("shown here"), and it depicts regalia, so `docs/content-review.md` applies. |
| 21 | "In Vancouver, 13% of the population speak Chinese languages at home; in Toronto, the number is 7%." | Exclude as stated. It is flagged (`13%`), and `wwa-39` already grades the unflagged sentence beside it. |
| 21 | "The great majority of Canadians identify as Christians." | Teach only with the flagged term routed around (`great majority`), and `volatile`. |
| 21 | "The largest religious affiliation is Catholic, followed by various Protestant churches." | Teach. The page is flagged, so the passage is `volatile`. |

**Canada's History (14)**

| p. | Sentence | Disposition |
|---|---|---|
| 26 | "North America was again divided by war." | Teach inside the American Revolution passage. It has no weight alone. |
| 27 | "Democratic institutions developed gradually and peacefully." | Teach. |
| 29 | "The Americans were mistaken." | Fold into the 1812 invasion passage. It is a connective. |
| 31 | "Controversially, Lord Durham also said that the quickest way for the Canadiens to achieve progress was to assimilate into English-speaking Protestant culture." | Teach, and write a question for `history`. |
| 33 | "This phrase embodied the vision of building a powerful, united, wealthy and free country that spanned a continent." | Teach (*A Mari usque ad Mare*). |
| 34 | "1867 – Ontario, Quebec, Nova Scotia, New Brunswick" | Teach, and write a question: the four founding provinces. |
| 34 | "1871 – British Columbia" | Teach, and write a question. |
| 35 | "Sir George-Étienne Cartier was the key architect of Confederation from Quebec." | Teach. `hist-55` grades the next sentence. |
| 35 | "Canada's future was in jeopardy." | Connective. Fold it in. |
| 35 | "How could the Dominion reach from sea to sea if it could not control the interior?" | Exclude. It is a rhetorical question. |
| 37 | "After many years of heroic work, the CPR's 'ribbons of steel' fulfilled a national dream." | Teach. |
| 38 | "On the battlefield, the Canadians proved to be tough, innovative soldiers." | Teach. |
| 38 | "Canada shared in the tragedy and triumph of the Western Front." | Connective. Fold it in. |
| 41 | "Canadians remember the sacrifices of our veterans and brave fallen in all wars up to the present day in which Canadians took part, each year on November 11: Remembrance Day." | Teach, and write a question: what Remembrance Day is *for*. |

**Modern Canada (5)**

| p. | Sentence | Disposition |
|---|---|---|
| 51 | "Canadians have made various discoveries and inventions." | Exclude. It is a lead-in to the list. |
| 51 | "Some of the most famous are listed below." | Exclude. It is a signpost. |
| 53 | "The prosperity and diversity of our country depend on all Canadians working together to face challenges of the future." | Exclude. This is the guide's closing exhortation, the same class as the museum invitation (ADR-0061 §3). |
| 53 | "In seeking to become a citizen, you are joining a country that, with your active participation, will continue to grow and thrive." | Exclude, for the same reason. |
| 53 | "How will you make your contribution to Canada?" | Exclude, for the same reason. |

**How Canadians Govern Themselves (1)**

| p. | Sentence | Disposition |
|---|---|---|
| 54 | "There are federal, provincial, territorial and municipal governments in Canada." | Teach, and write a question for `government`. |

**Federal Elections (7)**

| p. | Sentence | Disposition |
|---|---|---|
| 60 | "Members of the House of Commons are also known as members of Parliament or MPs." | Teach, and write a question for `elections`. |
| 63 | "There are three major political parties currently represented in the House of Commons: the Conservative Party, New Democratic Party and Liberal Party." | Exclude. It is stale on its face ("currently", 2011). Record a `knownStaleness` entry before anything cites p. 63 for it. |
| 66 | "Municipal governments usually have a council that passes laws called 'by-laws' that affect only the local community." | Teach, and write a question for `elections`. |
| 69 | "Snow Removal", "Policing", "Firefighting", "Emergency Services" (the municipal column of the who-does-what table) | Teach by extending `elections-05-who-does-what`, which carries the other rows. |

**Canadian Symbols (4)**

| p. | Sentence | Disposition |
|---|---|---|
| 78 | "Important Canadian symbols appear throughout this booklet." | Exclude. It is a signpost. |
| 78 | "Queen Elizabeth II, who has been Queen of Canada since 1952, marked her Golden Jubilee in 2002, and celebrated her Diamond Jubilee (60 years as Sovereign) in 2012." | Exclude. It is flagged, and false since 2022 (`knownStaleness`: the monarch). |
| 86 | "If you know of fellow citizens who you think are worthy of recognition, you are welcome to nominate them." | Teach: anyone may nominate a person for an honour. |
| 86 | "Information on nominations … can be found at www.gg.ca/…" | Exclude. It is a web address, the back-matter class (ADR-0061 §3). |

**Canada's Regions (3)**

| p. | Sentence | Disposition |
|---|---|---|
| 94 | "Today it is Canada's fourth largest metropolitan area." | Exclude. It is flagged (`fourth largest metropolitan area`). |
| 94 | "You should know the capital of your province or territory as well as that of Canada." | Teach as study advice. The capitals themselves are carried. |
| 94 | "Canada has a population of about 34 million people." | Exclude. It is flagged (`34 million`). |

**Net: 24 to teach, 15 to exclude.** The Oath, Rights, Justice and Economy have no uncovered sentence at
all. They are complete in storage and thin only in reading.

## 4. Reachability by playing

| Route | Today (`7441451`) | After PR #137 | Notes |
|---|---|---|---|
| `read` steps | **0** | **1** step, **2 of 302** passages | Dow's Lake, Ottawa, two `govern-03` passages from p. 57 |
| Sentences a read step puts in play | 0 | 2 | Both are in *How Canadians Govern Themselves* |
| Level-told sentences | 132 of 778 | 134 | Blurbs, territorial statements, quest lines |
| Questions pooled by `answer` steps | **493 of 493** | 493 | `reach-pass2` pooled the whole bank |
| Questions asked in one journey | **137** | 137 | This is the sum of `min(count, pool)` over the 32 `answer` steps |
| Pooled questions a level teaches first (ADR-0057 §1, at sentence grain) | **105 of 493** | 105 | ADR-0065 measured 85 at claim grain. The untaught remainder, 388, is the contradiction ADR-0065 §Consequences recorded. |
| Learn surface | **none** | none | Confirmed below |

**Learn does not exist.** `app/ui/` holds no `learn-*` screen. The title screen offers Play, Continue,
Choose level, Study, Exam and Settings (`title-screen.ts`). The in-level menu offers Settings, Study,
Passport, About this place and Leave (`menu.ts`). No locale key in `content/locales/` names a Learn screen. The plumbing
Learn needs *does* exist, because the read step built it:

- `ContentRepository.chapters()` and `lessons(chapter)` in `app/application/ports/content-repository.ts`
- `app/adapters/content/bundled-lesson-library.ts`, one lazy chunk per chapter
- `app/bootstrap/lesson-reading.ts`
- the DOM reader `app/ui/lesson-reader.ts`

What is missing is a chapter list, a lesson screen and a menu entry.

## 5. Programme to "everything in the guide is reachable"

Each proposal is ranked by ADR-0065's reach test: the verified propositions it newly puts in front of a
player, then the cheapest tier that carries them. The **ADR?** column says whether a decision is needed
before the work.

| # | Work | Tier | New propositions in front of a player | Cost | ADR? |
|---|---|---|---|---|---|
| 1 | **Build Learn** (c) | 1 | **+272** sentences that passages carry and no level tells. All 302 passages become reachable. | One screen, one menu row, a11y (ADR-0061 §8) | No. ADR-0061 decided it and ADR-0065 §3.4 schedules it after the read step. |
| 2 | **Read steps on the 44 existing stops** (b) | 1 | **Up to +176** passages in play, at 4 passages per stop | Editorial only. No art, no grant. | No. This is §3.3's budget. |
| 3 | **Author the ceiling lessons** (a) | 1 | **+~472** sentences readable in Learn (490 with no passage, less the 18 excluded or folded in §3) | About 472 passages, about 40 lesson documents, 2 commits each | No. ADR-0061 Consequences already covers the ceiling. |
| 4 | **Questions where the remit allows** (d) | 1 | Graded reach for **~220** fact-bearing sentences with no question | Author and verifier commits per question | No, for authoring. **Yes** for any subject split this enables (#6). |
| 5 | **Tier 2 read-stops** where reading capacity binds | 2 | +5 each (1 blurb and 4 passages). About 12 proposed. | Art, a reference entry, a blind run, and about 1,600 px of level each | No |
| 6 | **Tier 3: Kingston**, from a `history` split | 3 | About +30 (5 stops × (1 blurb + 4 passages) + quest lines) | Everything in ADR-0065 §5, plus a second map inset | **Yes**: a split ADR (ADR-0065 §5), and `map-anchors.schema.json` `inset` becomes an array (§4.1) |
| 7 | City 12 | 3 | About +30 | As #6 | **Yes**. Defer it (§5.6). |

**Which proposals beat reading alone?** Per unit of cost, none. Learn (#1) reaches all 302 passages for
no art, and #3 makes Learn the whole guide. Tier 2 and tier 3 win on one axis only: **in-play** reach
beyond what the existing stops can hold. §3.3 caps reading at 4 passages per stop. 44 stops give 176
places for 302 passages, and relevance piles the overflow onto *Canada's History* (below). For the
owner's "when playing it", the tier 2 read-stops at Québec City, Vancouver, the Prairies, Peggy's Cove and
the North, and the Kingston city, are the only ways the remaining ~128 passages can be met in a level. No
tier 2 stop at Halifax, Ottawa, Winnipeg or the Alberta foothills beats reading alone. Those levels have
spare read capacity, so a stop there buys one blurb.

### 5(a) Lessons to author per chapter (Learn complete)

| Chapter | Passages today | In-scope sentences with no passage | Of which a question already carries | To author (after §3 exclusions) | Note |
|---|---|---|---|---|---|
| Oath of Citizenship | 0 | 1 | 1 | 1 | `volatile` (ADR-0061 §3); what the Oath is, never its words |
| Rights and Responsibilities | 2 | 35 | 34 | 35 | |
| Who We Are | 27 | 39 | 34 | 37 | Two are excluded in §3 |
| Canada's History | 104 | 105 | 88 | 100 | One rhetorical question is excluded; four connectives fold into neighbours |
| Modern Canada | 40 | 45 | 40 | 40 | Five are excluded in §3 |
| How Canadians Govern Themselves | 10 | 34 | 32 | 34 | |
| Federal Elections | 22 | 66 | 59 | 65 | p. 63 is stale |
| The Justice System | 1 | 25 | 25 | 25 | The Queen's Bench terms must be routed around |
| Canadian Symbols | 29 | 52 | 47 | 49 | Three are excluded in §3 |
| Canada's Economy | 2 | 18 | 18 | 18 | The NAFTA, G8 and 2008 terms must be routed around |
| Canada's Regions | 65 | 70 | 67 | 68 | **Blocked** until ADR-0028's live check of the chapter |
| **Total** | **302** | **490** | **445** | **~472** | Together, about 775 passages. That is inside ADR-0061's 740–900 ceiling. |

Recommended order: Justice, Economy and Rights first. They are small, complete chapters and the thinnest
in Learn today. Then Govern Themselves, Elections, Symbols, History, Modern and Who We Are. Regions comes
last, after the live check.

### 5(b) Read steps per level, under ADR-0065 §3.3

The budget is at most 4 passages and at most 120 words per stop, counted over every `read` step sharing a
`targetId`. One sheet names one lesson (`lesson-reading.ts` refuses a step that mixes lessons). Passages
are assigned by chapter and by place: *Canada's Regions* lessons go to the level in that region, and
economic history goes to the economy level under ADR-0028 §2.

| Level | Stops | Places (×4) | Passages that belong here | Can place | Overflow | Lessons to draw on |
|---|---|---|---|---|---|---|
| halifax | 5 | 20 | 18 | 18 | 0 | `rights-responsibilities-01/02`, `regions-02/03/04`* |
| peggys-cove | 4 | 16 | 27 | 16 | **11** | `who-01`…`who-06` |
| quebec-city | 4 | 16 | 110 | 16 | **65** after sharing with Winnipeg and Alberta | `history-01/02/04`, `regions-05`* |
| ottawa | 6 | 24 | 15 + 9 shared | 24 | 0 | `govern-01/02/03`, `regions-01`*, `elections-02/05` |
| toronto | 4 | 16 | 18 | 16 | **2** | `elections-01/03/04`, `regions-06`* |
| winnipeg | 4 | 16 | 5 + 11 shared | 16 | 0 | `justice-01`, `regions-07`*, `history-05` (the Red River and the West) |
| prairie-rail | 5 | 20 | 40 | 20 | **20** | `modern-01`…`modern-07` |
| alberta-foothills | 5 | 20 | 2 + 18 shared | 20 | 0 | `economy-01`, `history-03` (a growing economy) |
| vancouver | 4 | 16 | 38 | 16 | **22** | `symbols-01`…`symbols-05`, `regions-08`* |
| the-north | 3 | 12 | 20 | 12 | **8** | `regions-09/10/11`* |
| **Total** | **44** | **176** | **302** | **~174** | **~128** | |

\* Regions material waits for ADR-0028's live check. ADR-0065's first-half content marker excludes
`the-north` and Regions until then.

A read step at a stop that already has a task step needs no new stop. The Dow's Lake precedent in PR #137
adds a read-only stop with no `answer` step. So the stop ceiling (`a-quests-answer-steps-fill-in-one-sitting`)
and the questions asked are unchanged.

### 5(c) Learn

Build it next. ADR-0065 §3.4 names it as the slice after the read step. The chapter reader lists the 11
register chapters. The shippable filter stays in `app/application`, so Learn and the level reader cannot
disagree. The one owed design question is how a single-switch user and a screen-reader user move through a
chapter. ADR-0061's ui-a11y marker, due 2027-01-18, is half answered by `TN-READ`. With Learn, 302 of 302
passages are reachable today. With §5(a), the whole in-scope guide is. **No ADR is needed.**

### 5(d) Questions for sentences no question carries

There are 273 in-scope sentences with no question. About 220 are fact-bearing (a number or a proper
noun). By remit, measured as the subjects whose banks already cite the chapter:

| Chapter | No question | Fact-bearing | Remit that may grade it |
|---|---|---|---|
| Canada's History | 103 | ~90 | `history`, or `economy` for economic history (ADR-0028 §2) |
| Modern Canada | 41 | ~29 | `modern-canada`, or `economy` for pp. 45–46 |
| Canadian Symbols | 27 | ~23 | `symbols` |
| Federal Elections | 31 | ~20 | `elections` (`government` for Parliament's side) |
| Canada's Regions | 39 | ~33 | `regions`, after the live check. **One more verified `regions` question lifts the ceiling to 13.** |
| Who We Are | 18 | ~14 | `who-we-are` |
| How Canadians Govern Themselves | 10 | ~7 | `government` |
| Rights, Justice, Economy | 4 | 2 | Nearly exhausted, as ADR-0061 found |

The rules still bind:

- ADR-0028 §3: where two remits could claim a sentence, the question that exists claims it.
- ADR-0028 §4: one subject per proposition.
- ADR-0057: a new question may join a pool only where its level tells the sentence first. With every
  pool already holding its whole bank, this is the open contradiction below.

**Growing `history` by about 15 to 20 questions comes first**, because it is what makes tier 3 safe
(§5.6).

### 5.5 Tier 2: proposed stops

Each stop is read-only: one blurb plus one `read` step of up to 4 passages, and no `answer` step. The room
check follows ADR-0065 §2.4.

- **Texture.** The figure is spare MiB from `make assets` today. A stop costs 2.03 MB to be safe.
- **Pitch.** No level has a gap of 3,000 px or more between stops, so **every new stop costs about
  1,600 px of level**, roughly 4 s at 420 px/s.
- **Stop ceiling.** It is untouched, because a read-only stop adds no `answer` step.

The landmark column names real places only (CLAUDE.md, Art). Each needs an `assets/refs` entry with
photographs and a blind run.

| Rank | Level | Real landmark | The one proposition its blurb tells (verified question sentence the level does not tell) | Reads | Texture spare → stops it affords | Width after | Blocked by |
|---|---|---|---|---|---|---|---|
| 1 | quebec-city | Wolfe–Montcalm monument, Jardin des Gouverneurs | p. 25, Wolfe and Montcalm both killed leading their troops | `history-01` (4) | 6.61 MiB → 3 | 7,648 | — |
| 2 | quebec-city | Hôtel du Parlement | p. 27, the Constitutional Act of 1791 divided the Province of Quebec | `history-02` (4) | (same) | 9,248 | — |
| 3 | quebec-city | Plains of Abraham (Battlefields Park) | p. 26, the habitants or Canadiens preserved their way of life under British rule | `history-04` (4) | (same) | 10,848 | Width: the longest level would be 10,848 px against the Prairies' 9,600. This is a play judgement (ADR-0065 §Rules). |
| 4 | vancouver | Rogers Arena | p. 81, hockey is the most popular spectator sport and the national winter sport | `symbols-02` (3) | 6.39 MiB → 3 | 9,280 | — |
| 5 | vancouver | HMCS *Discovery*, the naval reserve division on Deadman's Island | p. 86, the Victoria Cross is the highest honour available to Canadians | `symbols-04` (4) | (same) | 10,880 | — |
| 6 | prairie-rail | A snowmobile by a farmyard (generic, allowed by ADR-0056) | p. 51, Bombardier invented the snowmobile | `modern-07` (4) | 5.30 MiB → 2 | 11,200 | Width (the level is already the widest) |
| 7 | prairie-rail | A small-town hospital (generic) | p. 45, the Canada Health Act sets a basic standard of coverage | `modern-01` (3) | (same) | 12,800 | Width |
| 8 | peggys-cove | William E. deGarthe's Fishermen's Monument (granite relief) | p. 20, English-speaking areas were settled by English, Welsh, Scottish and Irish settlers | `who-04` (4) | 8.89 MiB → 4 | 8,640 | — |
| 9 | peggys-cove | St. John's Anglican Church, Peggy's Cove | p. 21, the state has traditionally partnered with faith communities | `who-06` (3) | (same) | 10,240 | p. 21 is flagged, so the blurb is `volatile` |
| 10 | toronto | Ontario Legislative Building, Queen's Park | p. 60, federal elections are held on the third Monday in October every four years | `elections-04` (2) | 5.79 MiB → 2 | 9,280 | — |
| 11 | the-north | A Canadian Rangers patrol, generic figure-free props | p. 104, Nunavut was established in 1999 (or a Rangers sentence) | `regions-11` (4) | 5.68 MiB → 2 | 9,280 | ADR-0028 live check; `docs/content-review.md` (the Rangers are largely Inuit and First Nations, so the review is owed even figure-free) |
| — | halifax, ottawa, winnipeg, alberta-foothills | Halifax Citadel (p. 14, no compulsory service); Rideau Hall (p. 57, the Governor General represents the Sovereign); Manitoba Law Courts (p. 76, provincial, family, traffic and small claims courts); none for Alberta | 1 blurb each | — | 5.70 / 7.91 / 4.40 / 5.99 MiB | +1,600 | These do not beat reading alone, because the levels have spare read places. Author only for ADR-0057 teaching. |

Every proposed blurb sentence was checked against this run. Each is carried by a verified question in the
level's own subject and told by no POI or quest line on that level. So each new stop also moves pooled
questions into ADR-0057's taught set. Québec's three stops place 12 of its 65 overflow passages. The rest
is the argument for tier 3. Whichever passages a stop reads, they must also fit 120 words: four of the
longest `history-01` passages would not.

**Québec City's three, authored 2026-09-24** (author half; blurbs in the null verification form, waiting on
the verifier). Placement is `quebec-city-level.md` §13 Option A: `wolfe-montcalm-monument` at x 6400,
`martello-tower` at 8000, `hotel-du-parlement` at 9600, level width 10,848, no existing stop moved. Each is a
read-only stop, and the quest's three `answer` steps are unchanged.

| Stop | Blurb tells | Reads |
|---|---|---|
| `wolfe-montcalm-monument` | p. 25, both commanders killed (`hist-18`) | `history-01`: `h1-french-empire-leaders`, `h1-english-colonies-grew-larger`, `h1-france-and-britain-fight-for-the-continent` |
| `martello-tower` | p. 26, habitants or Canadiens kept their way of life (`hist-96`) | `history-02`: `h2-renamed-province-of-quebec`, `h2-quebec-act-passed-1774`, `h2-quebec-act-is-a-foundation`, `h2-thirteen-colonies-become-the-united-states` |
| `hotel-du-parlement` | p. 27, the Constitutional Act divided the Province of Quebec (`hist-25`) | `history-02`: `h2-democracy-grew-step-by-step`, `h2-pei-1773-and-nb-1785`, `h2-british-north-america` |

The table above named `history-04` for the Plains and `history-02` for the Parliament Building. That was
written before ADR-0068. Responsible government and Confederation (`history-04`) now fall in
`building-canada`, Kingston's remit, so both stops read from `history-02`, which is in Québec City's half.
`h2-canadiens-kept-their-way-of-life` and `h2-two-canadas-were-different` are left out because the stop's own
blurb quote contains them. That places 10 passages, not 12.

### 5.6 Tier 3: new cities

The ceiling is Σ⌊verified ÷ 30⌋ = **12**. There are 10 levels, so headroom is **2**. Only `history`
(97 verified) contributes more than one. `regions` (59) is one question short of contributing a second.
Every new city carries a territorial statement whose nations come from a cited source (ADR-0051), so
**every city triggers `docs/content-review.md`**. The column below says whether its *remit* adds more.

Verified `history` questions by cited page, which is a partition by `source.quote`, because each question
document is one quote and one page:

| Cut | Pages | Verified questions | Remit |
|---|---|---|---|
| H-A | 23–28 | **31** | First peoples, New France, British rule, Loyalists, first assemblies, abolition |
| H-B | 29–36 | **33** | A growing economy, the War of 1812, rebellions, responsible government, Confederation, the Dominion, the Red River and North-West |
| H-C | 37–44 | **33** | The railway, the First World War, the vote for women, between the wars, the Second World War |
| Two-way alternative | 23–33 / 34–44 | 54 / 43 | Up to Confederation / the Dominion to 1945 |

| City | Subject split | Both halves ≥ 30 today? | Map (pins must be ≥ 45.4 units apart) | Content review beyond the territorial statement | Verdict |
|---|---|---|---|---|---|
| **Kingston, Ontario** | H-B is re-filed from `history` into a new subject. Québec City keeps H-A (two-way: keeps 23–33). | **Yes.** Two-way 54/43. Three-way 31/33/33, but H-A clears by one, so a single quarantine breaks the floor. **Author 15–20 history questions first.** | 18.4 units from Ottawa, so a **second inset** is needed. `map-anchors.schema.json` has `inset` as one object: this is a schema change (ADR-0065 §4.1). | Yes. Tecumseh (p. 29) and the Red River Métis (pp. 35–36) are in H-B. | **Recommended.** The guide names the place: Fort Henry at Kingston (p. 30), Macdonald "a lawyer in Kingston" (p. 35), the Royal Military College (p. 79). The real stops are Fort Henry, Bellevue House, Kingston City Hall and Kingston Mills locks on the Rideau. |
| St. John's, NL | H-C | Yes, 33, if three-way | **Clean**: 111.9 units from Halifax, no inset | Only the territorial statement. Its nations are named from a source nobody has cited yet (ADR-0051), so none are named here. | Weak fit. Only p. 43 (Newfoundlanders in the Second World War) and p. 34 (1949) are local. |
| Craigellachie, B.C. (the Last Spike) | H-C | Yes, 33, if three-way | 38.7 units from Alberta foothills, so an inset is needed | The territorial statement, and the railway's Chinese labourers (p. 37) | A good fit for p. 37 only. The world wars are overseas. |
| Regina, Sask. | H-B's western half | Too small alone | 9.9 units from `prairie-rail`, which collides | Yes: Riel and 1885 | Not recommended. |

The price, which a split ADR has to state:

- **Grants voided by A4.** The two-way split re-files 43 questions. The three-way split re-files 66.
- **The exam mix.** At 11 subjects each gets 1–2 of 20. At 12, the three history subjects get about 5.
- **The review.** Every city needs it.

**Recommendation: one city, Kingston, and not before `history` holds ~110 verified questions and
Québec City has taken its tier 2 stops.** Decide city 12 when a second bank crosses 60 or `history` crosses
120. Today no candidate fits both the map and the remit.

## 6. Decisions this audit asks for

1. **ADR-0057 against the pools.** 388 of 493 pooled questions rest on a sentence their level does not tell
   first. ADR-0057's gate is due 2026-11-17 and does not exist. When it lands it fails on those rows,
   unless an ADR amends ADR-0057 or the pools narrow. Tier 1 reading and §5.5 stops shrink the number,
   but they do not close it.
2. **Kingston needs two decisions.** A split ADR must name both remits, the partition, the grants voided
   and the exam mix. A map ADR must make `inset` an array.
3. **Optional amendments, not blockers:**
   - ADR-0065 §2 could record the read-only stop, which PR #137 introduced, in its price list.
   - ADR-0061 §3 could decide whether the two caption-only facts (King George V's colours, Phil Edwards)
     may be taught from the caption.

## 7. Progress on the lesson programme

Authored 2026-09-23. Every passage below is in the null verification form and waits for the verifier.
Nothing in this section is a measurement: `make source-coverage` counts only verified carriers, so the
Headline table above does not move until the grants land. Re-run it then.

**The owner's rule since 2026-09-23: a player is taught before being asked.** Every verified question gets a
lesson passage that carries the same proposition: its `source.quote` and the passage's contain one another
under `sharesProposition`. Work runs in this order: (1) the §3 teach rows, (2) the questions in each
level's `answer` pools, level by level in `journey` order, (3) the remaining verified questions, then the
ceilings of §5(a).

### 7.1 The §3 teach rows: done

24 passages carry the 25 teach sentences of §3. §3's own tally says 24. Counted row by row it lists 25
(Who We Are 3, History 13, Govern 1, Elections 6, Symbols 1, Regions 1). The difference is the p. 69 row:
it is one row but four sentences.

| Chapter | Passages | Where |
|---|---|---|
| Who We Are | 3 | `who-05` (the Buchan quotation, taught about and not reproduced), `who-06` (Christian majority and Catholic-then-Protestant, both `volatile`, "great majority" routed around) |
| Canada's History | 12 for 13 sentences | `history-02` (the war that sent the Loyalists north, with "North America was again divided by war" folded in; democratic institutions), `history-03` (the 1812 invasion with "The Americans were mistaken" folded in; Durham on assimilation), `history-04` (the sea-to-sea vision; 1867; 1871), `history-05` (Cartier; Canada's future at risk; ribbons of steel), `history-06` (tough, innovative soldiers with the Western Front folded in; Remembrance Day) |
| How Canadians Govern Themselves | 1 | `govern-01` |
| Federal Elections | 6 | `elections-01` (MPs), `elections-04` (by-laws), `elections-05` (snow removal, policing, firefighting, emergency services) |
| Canadian Symbols | 1 | `symbols-04` (anyone may nominate) |
| Canada's Regions | 1 | `regions-01` (know your capitals) |

Two decisions an auditor should see:

- **"Canada's future was in jeopardy" crosses the page 35/36 break**, so no contiguous quote holds all of
  it. `h5-future-at-risk` quotes the page-36 part and the rhetorical question after it: "future was in
  jeopardy. How could the Dominion reach from sea to sea if it could not control the interior?" The
  question is excluded as a unit in §3, and it is not taught as a unit here. It is the reason the future
  was at risk, and it is folded in the way §3 folds a connective.
- **Canada's Regions is marked blocked in §5(a), but the register records a first-hand live check** of the
  chapter (`liveChecks`, 2026-09-10, `source-unrevised`, with four page-grain flags). `regions-01` already
  holds passages on p. 94. The p. 94 study-advice passage names no figure and no monarch.

### 7.2 Answer pools by level

| Level (journey order) | Subject | Pool questions | Already taught by a lesson | Newly taught | Status |
|---|---|---|---|---|---|
| halifax | `rights` | 38 (`rights-02` is in no pool, and shares its passage with `rights-03`) | 1 (`rights-14`) | 37 | **Authored** |
| peggys-cove | `who-we-are` | 48 | 4 (`wwa-03`, `wwa-04` from `who-01`, `wwa-16` from `who-03`, `wwa-25` from `regions-04`) | 43 | **Authored** (§7.9). 1 cannot be taught, because it is a caption |
| quebec-city | `history` | 97 | 2 (`hist-21` from `history-02`, `hist-33` from `history-03`) | 91 | **Authored** (§7.12). 4 cannot be taught, because they are captions |
| ottawa | `government` | 41 | 0 (`gov-18` matched `g2-both-chambers-study-a-bill` by containment, but that passage stops before "(proposals for new laws)", so it got a passage of its own) | 41 | **Authored** (§7.6) |
| toronto | `elections` | 37 | 0 (`elec-18`, `elec-20`, `gov-42` and `gov-47` pass containment through `elections-01` and `-03`, but those passages teach a neighbouring clause, so each got a passage of its own) | 37 | **Authored** (§7.10) |
| winnipeg | `justice` | 40 | 36, from the batch-1 ceiling and `rr4`, `elections-05` | 2 | **Authored** (§7.7). 2 cannot be taught, because they are captions |
| prairie-rail | `modern-canada` | 40 | 0 | 40 | **Authored** (§7.5) |
| alberta-foothills | `economy` | 51 | 20, from the batch-1 ceiling and `rr5` | 31 | **Authored** (§7.8) |
| vancouver | `symbols` | 43 | 0 | 42 | **Authored** (§7.11). 1 cannot be taught, because it is a caption |
| the-north | `regions` | 59 | 0 | 58 | **Authored** (§7.13). 1 cannot be taught, because it is a caption |

### 7.3 Question to passage (halifax)

Every passage is in `content/lessons/rights-and-responsibilities-of-citizenship/`. The lesson prefix
`rr1` is `rights-responsibilities-01-what-the-charter-opens-with`, `rr2` is `-02-ways-people-volunteer`,
`rr3` is `-03-where-our-rights-come-from`, `rr4` is `-04-equality-of-women-and-men`, `rr5` is
`-05-responsibilities-of-citizenship` and `rr6` is `-06-defending-canada`.

| Question | Passage |
|---|---|
| `rights-01-where-rights-come-from` | `rr3-rights-and-responsibilities`, `rr3-history-law-and-values` |
| `rights-02-sources-of-canadian-law` | `rr3-sources-of-canadian-law` |
| `rights-03-civil-code-of-france` | `rr3-sources-of-canadian-law` |
| `rights-04-magna-carta-year` | `rr3-magna-carta` |
| `rights-05-magna-carta-other-name` | `rr3-magna-carta` |
| `rights-06-ordered-liberty-tradition` | `rr3-magna-carta` |
| `rights-07-freedom-of-conscience-and-religion` | `rr3-freedom-of-conscience-and-religion` |
| `rights-08-freedom-of-expression-includes-press` | `rr3-freedom-of-expression` |
| `rights-09-freedom-of-peaceful-assembly` | `rr3-freedom-of-peaceful-assembly` |
| `rights-10-freedom-of-association` | `rr3-freedom-of-association` |
| `rights-11-habeas-corpus-meaning` | `rr3-habeas-corpus` |
| `rights-12-habeas-corpus-origin` | `rr3-habeas-corpus` |
| `rights-13-charter-entrenched-1982` | `rr1-charter-added-in-1982` |
| `rights-14-charter-opening-principles` | `rr1-charter-opening-words` (verified before this pass) |
| `rights-15-what-the-charter-does` | `rr1-freedoms-and-other-rights` |
| `rights-16-mobility-rights` | `rr1-mobility-rights` |
| `rights-17-passport-is-a-mobility-right` | `rr1-mobility-rights` |
| `rights-18-charter-and-treaty-rights` | `rr1-aboriginal-peoples-rights` |
| `rights-19-official-language-rights` | `rr1-official-language-rights` |
| `rights-20-multiculturalism-in-the-charter` | `rr1-multiculturalism` |
| `rights-21-equality-of-women-and-men` | `rr4-equal-under-the-law` |
| `rights-22-rights-come-with-responsibilities` | `rr5-rights-bring-responsibilities` |
| `rights-23-rule-of-law-founding-principle` | `rr5-rule-of-law-is-a-founding-principle` |
| `rights-24-nobody-is-above-the-law` | `rr5-laws-not-whims`, `rr5-no-one-above-the-law` |
| `rights-25-responsibility-for-self-and-family` | `rr5-work-and-family` |
| `rights-26-jury-duty-is-required` | `rr5-jury-duty-is-required` |
| `rights-27-why-juries-matter` | `rr5-juries-make-justice-work` |
| `rights-28-voting-which-elections` | `rr5-responsibility-to-vote` |
| `rights-29-voting-right-and-responsibility` | `rr5-responsibility-to-vote` |
| `rights-30-helping-others-volunteering` | `rr2-volunteers-give-their-time` |
| `rights-31-what-volunteering-gives-back` | `rr2-what-volunteering-gives-you` |
| `rights-32-protecting-heritage-and-environment` | `rr2-protect-heritage-and-environment` |
| `rights-33-heritage-includes-buildings` | `rr2-protect-heritage-and-environment` |
| `rights-34-no-compulsory-military-service` | `rr6-no-compulsory-service` |
| `rights-35-three-parts-of-canadian-forces` | `rr6-the-regular-forces` |
| `rights-36-part-time-reserves` | `rr6-part-time-reserves` |
| `rights-37-cadets` | `rr6-cadets` |
| `rights-38-coast-guard-and-emergency-services` | `rr6-coast-guard-and-emergency-services` |
| `rights-39-protecting-your-community` | `rr6-in-their-footsteps` |

**Read in the level (2026-09-23).** `content/quests/halifax-clock-and-pier.json` now has a `read` step
right after each stop's `visit` step (ADR-0067), before that stop's `answer` step. Each stop has one
sheet, and a sheet can use only one lesson. ADR-0067 §2 shows every passage in the run in one reader,
and `resolveReading` rejects a reader that mixes lessons (`content.lesson.passages.manyLessons`). So
a second `read` step with another lesson at the same stop would be rejected too. The rule is really
one lesson per stop, not just one per step. Words are counted as runs of non-space, as the
`a-stop-reads-at-most-four-passages` gate counts them.

| Stop | Lesson | Passages | Words EN / FR | Pooled questions read here or earlier |
|---|---|---|---|---|
| Town Clock | `rr3` | `rr3-sources-of-canadian-law`, `rr3-magna-carta`, `rr3-freedom-of-conscience-and-religion`, `rr3-habeas-corpus` | 104 / 113 | 03, 04, 05, 06; and early for Pier 21: 07, 11, 12 |
| Market stall | `rr5` | `rr5-rights-bring-responsibilities`, `rr5-work-and-family`, `rr5-jury-duty-is-required`, `rr5-juries-make-justice-work` | 83 / 93 | 22, 25, 26, 27 |
| Pier 21 | `rr1` | `rr1-charter-added-in-1982`, `rr1-freedoms-and-other-rights`, `rr1-mobility-rights`, `rr1-official-language-rights` | 101 / 107 | 13, 15, 16, 17, 19 |
| Harbour tug | `rr6` | `rr6-no-compulsory-service`, `rr6-the-regular-forces`, `rr6-part-time-reserves`, `rr6-cadets` | 82 / 96 | 34, 35, 36, 37 |

Some pooled questions are not read, but the quest's own dialogue says their sentence before the
question is asked: 20 (Pier 21 line), 22 and 30 (guide's opening), 23 and 24 (market-stall line),
28 and 29 (Town Clock line), 38 (tug line). Question 22 is also read at the market stall.

**Not taught in the level. They stay in Learn.** The budget or the one-lesson limit keeps out these
11 pooled questions:

| Question | Pooled at | Passage it needs | Why it is not read |
|---|---|---|---|
| `rights-01-where-rights-come-from` | Pier 21 | `rr3-rights-and-responsibilities`, `rr3-history-law-and-values` | `rr3` has only the Town Clock, and those 4 places go to its own pool (03–06) and to 07, 11 and 12 |
| `rights-08-freedom-of-expression-includes-press` | Pier 21 | `rr3-freedom-of-expression` | Same. If it replaced the conscience passage, the clock would read 123 FR words |
| `rights-09-freedom-of-peaceful-assembly` | Pier 21 | `rr3-freedom-of-peaceful-assembly` | Same, because the clock has no fifth place |
| `rights-10-freedom-of-association` | Pier 21 | `rr3-freedom-of-association` | Same |
| `rights-14-charter-opening-principles` | Pier 21 | `rr1-charter-opening-words` | Pier 21 has 4 places. This passage is 48 EN words, and five other questions win those places |
| `rights-18-charter-and-treaty-rights` | Pier 21 | `rr1-aboriginal-peoples-rights` | Pier 21 has 4 places. Official languages won the last place: it teaches one question, like this one, and suits a gateway for newcomers better |
| `rights-21-equality-of-women-and-men` | Pier 21 | `rr4-equal-under-the-law` | Pier 21 reads `rr1`, and no earlier stop can hold `rr4` |
| `rights-31-what-volunteering-gives-back` | Harbour tug | `rr2-what-volunteering-gives-you` | The tug reads `rr6` (four questions). The market stall reads `rr5` (three untaught questions in its own pool, against two for `rr2`) |
| `rights-32-protecting-heritage-and-environment` | Market stall | `rr2-protect-heritage-and-environment` | Same |
| `rights-33-heritage-includes-buildings` | Market stall | `rr2-protect-heritage-and-environment` | Same |
| `rights-39-protecting-your-community` | Harbour tug | `rr6-in-their-footsteps` | The tug has 4 places. The four passages about military service read as one set. This passage goes with the Coast Guard line that the guide says right after the reader |

Result: 38 pooled questions. 20 are read at or before their stop, 7 more are told only by a dialogue
line, and 11 are left for Learn. To reach the 11, Halifax needs a fifth stop (tier 2, §5.5). No
passage move can do it, because every stop is already full at 4 passages.

### 7.4 Ceilings (§5(a))

A chapter's ceiling is authored when every in-scope body sentence has a passage, in guide order, and the
chapter's lessons are numbered by `order` in guide order. File names keep their old numbers, because a
lesson `id` is its identity and renaming it voids its grants. `order` binds no grant, so it was renumbered.

| Chapter | Ceiling | Passages now | Lessons, in reading order | Not taught, and why |
|---|---|---|---|---|
| Rights and Responsibilities | **Authored** | 39 (37 new) | `-03` where our rights come from, `-01` the Charter, `-04` equality of women and men, `-05` responsibilities, `-02` helping others and our heritage, `-06` defending Canada | The lead-ins "The most important of these include:" and "These include:"; the caption of the 1982 proclamation (ADR-0061 §3). |
| The Justice System | **Authored** | 27 (26 new) | `justice-02` due process, `-03` what laws are for, `-04` the courts, `-01` the police, `-05` legal help | The four captions (Lady Justice, the border inspection, the jury benches and the Ottawa constable, prisons), ADR-0061 §3. The trial court's other names, Queen's Bench and Supreme Court: the first is a banned term on p. 76 and the register sources neither, so `j4-appeal-and-trial-courts` quotes only the appeal-court and trial-court clause. |
| Canada's Economy | **Authored** | 21 (19 new) | `economy-02` a trading nation, `-03` three kinds of industry, `-01` trading with our neighbour | The G8 membership clause (p. 90): G8, G7 and Russia are all banned, and the list cannot be taught without the group's name. NAFTA's name and the 2008 figures (banned); Mexico's 1994 entry is taught as "a wider free trade agreement". The four captions. |
| How Canadians Govern Themselves | Not yet | 11 (1 new) | | About 33 passages remain. |

**What remains, as of this pass:** the ceilings of How Canadians Govern Themselves (~33), Canada's History
(~87), Canada's Regions (~67), Modern Canada (~40), Canadian Symbols (~48), Federal Elections (~59), Who We
Are (~34) and the Oath (1, `volatile`). That is about 369 passages: §5(a)'s ~472, less the 78 ceiling
sentences of Rights, Justice and Economy (82 passages) and the 25 teach sentences authored here. Under the owner's rule these wait until every
level's pools and then every other verified question are taught.

### 7.5 Question to passage (prairie-rail, `modern-canada`)

Authored 2026-09-23, batch 2. The passages were added to the existing `modern-01`…`modern-07` lessons, in
guide order. A grant binds by passage `id`, so an insertion voids no verified passage. The prefix `mN` is
`modern-0N`. One Alberta foothills question, `eco-51`, also cites p. 45, so its passage sits in `modern-01`
and is listed in §7.8.

| Question | Passage |
|---|---|
| `mc-01-gatt-became-the-wto` | `m1-gatt-opened-up-trade` |
| `mc-02-alberta-oil-1947` | `m1-oil-found-in-alberta-1947` |
| `mc-03-1951-food-shelter-clothing` | `m1-1951-food-shelter-and-clothing` |
| `mc-04-canada-health-act` | `m1-canada-health-act` |
| `mc-05-employment-insurance` | `m1-unemployment-insurance-1940` |
| `mc-06-old-age-security-1927` | `m1-old-age-security-1927` |
| `mc-07-pension-plans-1965` | `m1-pension-plans-1965` |
| `mc-08-postwar-trade-partner` | `m1-hard-work-and-trade` |
| `mc-09-nato-military-alliance` | `m2-nato-a-military-alliance`, `m2-norad-with-the-united-states` |
| `mc-10-norad-partner` | `m2-norad-with-the-united-states` |
| `mc-11-korean-war` | `m2-korean-war` |
| `mc-12-un-peacekeeping-missions` | `m2-un-peacekeeping-missions` |
| `mc-13-quiet-revolution` | `m3-the-quiet-revolution` |
| `mc-14-royal-commission-1963` | `m3-royal-commission-led-to-official-languages-act` |
| `mc-15-la-francophonie` | `m3-la-francophonie-1970` |
| `mc-16-sovereignty-referendums` | `m3-first-referendum-1980`, `m3-second-referendum-1995` |
| `mc-17-constitution-1982-and-quebec` | `m3-constitution-amended-1982` |
| `mc-18-japanese-canadians-gained-the-vote` | `m4-asian-canadians-won-the-vote` |
| `mc-19-aboriginal-people-granted-the-vote` | `m4-aboriginal-people-vote-1960` |
| `mc-20-hungarian-refugees-1956` | `m4-hungarian-refugees-1956` |
| `mc-21-vietnamese-refugees-1975` | `m4-vietnamese-refugees-1975` |
| `mc-22-group-of-seven` | `m5-group-of-seven` |
| `mc-23-emily-carr` | `m5-emily-carr` |
| `mc-24-les-automatistes` | `m5-les-automatistes` |
| `mc-25-kenojuak-ashevak` | `m5-kenojuak-ashevak` |
| `mc-26-denys-arcand` | `m6-denys-arcand` |
| `mc-27-james-naismith-basketball` | `m6-naismith-invented-basketball` |
| `mc-28-chantal-petitclerc` | `m6-chantal-petitclerc` |
| `mc-29-wayne-gretzky` | `m6-wayne-gretzky` |
| `mc-30-terry-fox` | `m6-terry-fox-marathon-of-hope` |
| `mc-31-rick-hansen` | `m6-rick-hansen` |
| `mc-32-paul-henderson-1972` | `m6-paul-henderson-1972` |
| `mc-33-canadian-space-agency` | `m7-canadian-space-agency` |
| `mc-34-alexander-graham-bell` | `m7-bell-and-the-telephone` |
| `mc-35-bombardier-snowmobile` | `m7-bombardier-and-the-snowmobile` |
| `mc-36-sandford-fleming-time-zones` | `m7-fleming-and-time-zones` |
| `mc-37-evans-and-woodward-light-bulb` | `m7-evans-and-woodward-light-bulb` |
| `mc-38-fessenden-radio` | `m7-fessenden-and-radio` |
| `mc-39-hopps-pacemaker` | `m7-hopps-and-the-pacemaker` |
| `mc-40-banting-and-best-insulin` | `m7-banting-and-best-insulin` |

Decisions an auditor should see:

- **Split quotes.** `mc-06` and `mc-07` share one sentence, so each got the clause it grades:
  "Old Age Security was devised as early as 1927" and "and the Canada and Quebec Pension Plans in
  1965.". `mc-16`'s quote spans three sentences, and the middle one is `mc-17`'s proposition. So the two
  referendums are taught in two passages, and 1982 in a third. `mc-09`'s quote holds NATO and NORAD,
  and `mc-10` grades NORAD alone, so each clause has its own passage.
- **`mc-28`.** The passage quotes from "Chantal Petitclerc" onward. The words before that in the question's
  quote, "double Olympic gold medallist", describe Donovan Bailey in the guide's sentence, so the passage
  does not give them to Petitclerc.
- **`mc-40`.** The text says "millions of lives" and does not repeat the guide's "16 million".

**Read in the level (2026-09-24).** `content/quests/prairie-rail-grain-elevator.json` now has a `read`
step right after each stop's `visit` step, before that stop's `answer` step, as at Halifax (§7.3). One
lesson per stop. Words are runs of non-space.

| Stop | Lesson | Passages | Words EN / FR | Pooled questions read here or earlier |
|---|---|---|---|---|
| Grain bins | `m2` | `m2-nato-a-military-alliance`, `m2-norad-with-the-united-states`, `m2-korean-war`, `m2-un-peacekeeping-missions` | 78 / 96 | 09, 10, 11, 12 |
| Grain elevator | `m1` | `m1-unemployment-insurance-1940`, `m1-old-age-security-1927`, `m1-pension-plans-1965`, `m1-canada-health-act` | 60 / 72 | 04, 05, 06, 07 |
| Combine harvester | `m1` | `m1-gatt-opened-up-trade`, `m1-oil-found-in-alberta-1947`, `m1-hard-work-and-trade` | 71 / 80 | 01, 02, 08 |
| Container car | `m7` | `m7-bell-and-the-telephone`, `m7-bombardier-and-the-snowmobile`, `m7-evans-and-woodward-light-bulb`, `m7-banting-and-best-insulin` | 81 / 84 | 34, 35, 37, 40 |

Why these: the bins pool 14 questions over `m1`–`m4`, and `m2`, `m3` and `m4` each reach four. `m3` reaches
only three new ones, because `mc-14` is already told by the guide's opening line (its quote contains that
line's), so `m2` was taken. The elevator and the combine pool only `m1` questions, and together they read all
seven. The combine keeps a free place: nothing in `m1` is pooled later. The car pools 19 questions over
`m5`, `m6` and `m7`. `m7` was taken because the car's own line is about Fleming (`mc-36`), and the four
passages left out Fleming, which the line already tells.

Told only by a dialogue line: 03 (bins line), 14 (guide's opening, by containment), 36 (car line).

**Not taught in the level. They stay in Learn.** 22 of 40 pooled questions:

| Questions | Pooled at | Lesson | Why it is not read |
|---|---|---|---|
| `mc-13`, `mc-15`, `mc-16`, `mc-17` | Grain bins | `m3` | The bins read `m2`, and no earlier stop exists |
| `mc-18`, `mc-19`, `mc-20`, `mc-21` | Grain bins | `m4` | Same |
| `mc-22`…`mc-25` | Container car | `m5` | The car reads `m7`, and the combine cannot hold a second lesson |
| `mc-26`…`mc-32` | Container car | `m6` | Same |
| `mc-33`, `mc-38`, `mc-39` | Container car | `m7` | The car has 4 places |

Result: 40 pooled questions. 15 are read at or before their stop, 3 more are told only by a dialogue
line, and 22 are left for Learn. The combine's free place could hold a car passage (`m5`–`m7`), but that
would put a painter or an athlete beside a harvester. It would also leave the count the same, because the car
would then read a different lesson's four.

### 7.6 Question to passage (ottawa, `government`)

`g2` is `govern-02`, and 7 passages were added to it. `g4`, `g5` and `g6` are the new `govern-04-three-key-facts-and-who-does-what`,
`govern-05-parliament-and-the-cabinet` and `govern-06-the-sovereign-and-the-provinces`. Eight pooled questions
cite *Federal Elections* (pp. 62–69). A passage's page must fall inside its lesson's chapter, so those
passages cannot sit in a `govern-*` file. They are in two new lessons, `e6` = `elections-06-confidence-cabinet-and-opposition`
and `e7` = `elections-07-local-government-and-first-nations`. `govern-01`, `govern-03` and `elections-01…05` were not
touched.

| Question | Passage |
|---|---|
| `gov-01-three-features` | `g4-three-key-facts` |
| `gov-03-constitution-act-1867` | `g4-constitution-act-1867` |
| `gov-04-federal-responsibilities` | `g4-national-and-international-matters`, `g4-federal-responsibilities` |
| `gov-05-provincial-responsibilities` | `g4-provincial-responsibilities` |
| `gov-07-provincial-legislative-assembly` | `g4-each-province-elects-an-assembly` |
| `gov-08-territories-not-provinces` | `g4-the-three-territories` |
| `gov-10-who-voters-elect` | `g5-the-people-elect-members` |
| `gov-11-role-of-representatives` | `g5-what-elected-members-do` |
| `gov-12-non-confidence-vote` | `g5-confidence-of-the-house` |
| `gov-13-parts-of-parliament` | `g5-three-parts-of-parliament` |
| `gov-14-provincial-legislature-parts` | `g5-parts-of-a-provincial-legislature` |
| `gov-15-who-selects-cabinet` | `g5-prime-minister-chooses-the-cabinet` |
| `gov-16-house-of-commons-elected` | `g5-house-of-commons-is-elected` |
| `gov-17-senators-appointed` | `g5-senators-are-appointed` |
| `gov-18-what-a-bill-is` | `g2-what-a-bill-is` (and `g2-both-chambers-study-a-bill`, verified before this pass) |
| `gov-19-royal-assent` | `g2-no-law-without-royal-assent` |
| `gov-20-first-reading` | `g2-first-reading` |
| `gov-20-second-reading` | `g2-second-reading` |
| `gov-20-committee-stage` | `g2-committee-stage` |
| `gov-20-senate-stage` | `g2-senate-stage` |
| `gov-21-vote-right-and-responsibility` | `g2-right-and-responsibility-to-take-part` |
| `gov-22-head-of-state` | `g6-head-of-state` |
| `gov-23-sovereign-non-partisan` | `g6-sovereign-is-part-of-parliament` |
| `gov-24-head-of-government` | `g6-head-of-state-and-head-of-government` |
| `gov-25-governor-general-appointed` | `g6-the-governor-general` |
| `gov-27-lieutenant-governor` | `g6-lieutenant-governors` |
| `gov-28-head-of-commonwealth` | `g6-head-of-the-commonwealth` |
| `gov-29-territorial-commissioner` | `g6-territorial-commissioners` |
| `gov-30-three-branches` | `g6-three-branches-of-government` |
| `gov-31-provincial-member-titles` | `g6-names-for-provincial-members` |
| `gov-32-premier-role` | `g6-the-premier` |
| `gov-52-matter-of-confidence` | `e6-a-matter-of-confidence` |
| `gov-53-what-cabinet-does` | `e6-what-the-cabinet-is`, `e6-cabinet-prepares-the-budget` |
| `gov-54-official-opposition` | `e6-the-official-opposition` |
| `gov-55-role-of-opposition` | `e6-what-the-opposition-does` |
| `gov-58-municipal-council` | `e7-who-sits-on-a-council` |
| `gov-59-municipal-responsibilities` | `e7-what-municipalities-look-after` |
| `gov-62-shared-responsibilities` | `e7-shared-responsibilities` |
| `gov-63-band-chiefs` | `e7-band-chiefs-and-councillors` |
| `gov-64-indigenous-organizations` | `e7-aboriginal-organizations` |
| `gov-65-sovereign-guardian-of-freedoms` | `g6-symbol-and-guardian` |

Every passage on p. 57 or p. 63 copies its question's `volatile: true`. The monarch flag's banned terms
("Her Majesty", "53 other nations", "Her Majesty's Loyal Opposition" and the rest) appear only in
`source.quote`, where the gate does not search. The text says "the Sovereign" and "other nations".

**Read in the level (2026-09-24).** `content/quests/ottawa-parliament-hill.json` now has a `read` step
right after the `visit` step at each of the first three stops, before that stop's `answer` step.
`read-at-dows-lake` (`govern-03`, 2 passages, 48 / 59 words) is unchanged.

| Stop | Lesson | Passages | Words EN / FR | Pooled questions read here or earlier |
|---|---|---|---|---|
| Library of Parliament | `g2` | `g2-first-reading`, `g2-second-reading`, `g2-committee-stage`, `g2-senate-stage` | 62 / 68 | the four `gov-20` stages |
| Peace Tower (`parliament-hill`) | `g5` | `g5-confidence-of-the-house`, `g5-prime-minister-chooses-the-cabinet`, `g5-house-of-commons-is-elected`, `g5-senators-are-appointed` | 90 / 95 | 12, 15, 16, 17 |
| Warming hut | `g4` | `g4-constitution-act-1867`, `g4-federal-responsibilities`, `g4-provincial-responsibilities`, `g4-the-three-territories` | 86 / 109 | 03, 04, 05, 08 |

Why these: the Library's line already tells `gov-18` and `gov-19`, so its four places go to the four
stages. The Peace Tower's line already tells `gov-13` and `gov-14`, so `g5`'s four places go to the four
`g5` questions no line tells. `g6` also reaches four, but only if it leaves out a head-of-state passage,
and the Peace Tower's line is about Parliament. At the warming hut, `g4` reaches four questions and `e7`
reaches three new ones, because the hut's line already tells `gov-62`. `gov-04` is mapped to two passages
above. Only `g4-federal-responsibilities` is read, because it holds the list the question's answer comes
from.

Told only by a dialogue line: 18, 19 (Library line), 13, 14 (Peace Tower line), 62 (hut line).

**Not taught in the level. They stay in Learn.** 24 of 41 pooled questions:

| Questions | Pooled at | Lesson | Why it is not read |
|---|---|---|---|
| `gov-01`, `gov-07` | Peace Tower | `g4` | The Peace Tower reads `g5` |
| `gov-10`, `gov-11` | Peace Tower | `g5` | The Peace Tower has 4 places, and they went to the four the line leaves untold |
| `gov-21` | Peace Tower | `g2` | The Library's 4 places went to its own pool |
| `gov-22`…`gov-25`, `gov-27`…`gov-32`, `gov-65` | Peace Tower | `g6` | The Peace Tower reads `g5` |
| `gov-52`…`gov-55` | Peace Tower | `e6` | Same |
| `gov-64` | Peace Tower | `e7` | Same |
| `gov-58`, `gov-59`, `gov-63` | Warming hut | `e7` | The hut reads `g4` (four questions against `e7`'s three) |

Result: 41 pooled questions. 12 are read at or before their stop, 5 more are told only by a dialogue
line, and 24 are left for Learn. 21 of the 24 are pooled at the Peace Tower. That one pool has 27
questions across five lessons and only one reader.

### 7.7 Question to passage (winnipeg, `justice`)

Batch 1's ceiling already teaches 36 of the 40 pooled questions: `jus-01`…`06`, `08`…`31`, `37`…`39` from
`justice-01`…`05`, `jus-34` and `jus-35` from `rr4`, and `jus-33` from `elections-05`'s federal column.
Nothing batch 1 wrote was edited. The two new passages are in new files:

| Question | Passage |
|---|---|
| `jus-36-oath-promise-about-the-laws` | `o1-promise-to-observe-the-laws` in the new chapter directory `the-oath-of-citizenship/oath-01-what-new-citizens-promise`. It is `volatile`, because pp. 2–3 are on row 1. It says what the Oath promises and does not reproduce its words (§5(a)). |
| `jus-40-police-in-major-urban-centres` | `e7-city-police-forces` (p. 66, *Federal Elections*, so it is in `elections-07`) |

**Not taught, and why:**

- `jus-07-lady-justice-blindfold` and `jus-32-role-of-prisons` rest on picture captions, and ADR-0061 §3
  says a caption may not be a lesson. Unless ADR-0061 §3 is amended (§6.3 already asks this for two other
  captions), these two stay untaught.
- `jus-37-what-a-provincial-trial-court-is-called` passes containment through `j4-appeal-and-trial-courts`,
  but it grades the other name, "the Supreme Court", and batch 1 left that out on purpose (§7.4). The
  register sources no province's current name for its trial court. So the proposition the question
  grades is not taught, even though the mechanical check passes.

**Read in the level (2026-09-24).** `content/quests/winnipeg-human-rights-museum.json` now has a `read`
step right after each stop's `visit` step, before that stop's `answer` step. The quest pools 39
questions. `jus-33` is in no pool.

| Stop | Lesson | Passages | Words EN / FR | Pooled questions read here or earlier |
|---|---|---|---|---|
| Footbridge | `justice-03` | `j3-laws-are-written-rules`, `j3-elected-people-make-laws`, `j3-courts-and-police`, `j3-the-law-is-for-everyone` | 57 / 66 | 08, 09; and early for later stops: 12 (museum), 10, 11 (maple) |
| Museum | `justice-02` | `j2-due-process-for-everyone`, `j2-innocent-until-proven-guilty`, `j2-our-legal-heritage`, `j2-what-due-process-means` | 88 / 105 | 01, 02, 03, 04, 05, 06, 12 |
| Maple tree | `justice-01` | `j1-when-to-ask-for-help`, `j1-provincial-and-municipal-police`, `j1-rcmp-enforce-federal-laws`, `j1-rcmp-as-provincial-police` | 97 / 112 | 10, 11, 20, 21, 22, 23, 24, 26, 27 |

Why these: the footbridge line already tells 13 and 14, so `j3`'s places go to 08 and 09 and to
three questions pooled later. `j2` is the whole lesson and covers six museum questions. At the maple,
`j1` reaches seven questions and `j4` (the courts) reaches five, so the maple reads the police.
`j1-more-than-one-kind-of-police` was left out for `j1-when-to-ask-for-help`: the lesson has one
more passage than places. That passage adds `jus-27` and takes out `jus-39`. The provincial, city and
RCMP passages next to it still show that there is more than one kind of police.

Told only by a dialogue line: 13, 14 (footbridge line), 25 (officer's opening; that opening also tells 03, 04 and 26, which are read as well).

**Not taught in the level. They stay in Learn.** 18 of 39 pooled questions:

| Questions | Pooled at | Passage it needs | Why it is not read |
|---|---|---|---|
| `jus-32` | Footbridge | none (caption) | ADR-0061 §3 |
| `jus-34`, `jus-35` | Footbridge | `rr4` | The footbridge reads `justice-03` (five questions against two) |
| `jus-36` | Footbridge | `o1-promise-to-observe-the-laws` | Same |
| `jus-07` | Museum | none (caption) | ADR-0061 §3 |
| `jus-28`, `jus-29` | Museum | `j1-question-the-police`, `j1-raise-your-concerns` | The museum reads `justice-02` (six questions). The afterLine tells 29 only after the quest |
| `jus-30`, `jus-31` | Museum | `justice-05` | Same. The maple line tells both, but it comes after the museum's question |
| `jus-15`…`jus-19`, `jus-37`, `jus-38` | Maple tree | `justice-04` | The maple reads `justice-01` (seven questions against five). `jus-37` is not taught even in Learn (above) |
| `jus-39` | Maple tree | `j1-more-than-one-kind-of-police` | The maple has 4 places (see above) |
| `jus-40` | Maple tree | `e7-city-police-forces` | The maple reads `justice-01` |

Result: 39 pooled questions. 18 are read at or before their stop, 3 more are told only by a dialogue
line, and 18 are left for Learn.

### 7.8 Question to passage (alberta-foothills, `economy`)

Batch 1's ceiling already teaches 20 of the 51 pooled questions: `eco-01`…`19` from `economy-01`…`03`, and
`eco-49` from `rr5`. The other 31 cite *Canada's Regions* (29), *Canada's History* (1) and *Modern
Canada* (1). They are in new files, `r12`…`r15` = `regions-12-what-the-atlantic-provinces-produce`,
`regions-13-what-central-canada-produces`, `regions-14-what-the-prairies-and-british-columbia-produce` and
`regions-15-what-the-north-produces`, and `h8` = `history-08-an-economy-of-farms-and-resources`, except
for `eco-51`, which sits in `modern-01` beside its page.

| Question | Passage |
|---|---|
| `eco-20-atlantic-provinces-industries` | `r12-atlantic-coasts-and-resources` |
| `eco-21-pei-farming` | `r12-prince-edward-island` |
| `eco-22-labrador-hydro-electricity` | `r12-labrador-hydro-electricity` |
| `eco-23-nova-scotia-industries` | `r12-nova-scotia-mining-forestry-farming` |
| `eco-24-saint-john-port-and-manufacturing` | `r12-saint-john` |
| `eco-25-ontario-quebec-manufacturing` | `r13-ontario-and-quebec-manufacturing` |
| `eco-26-toronto-financial-centre` | `r13-toronto-financial-centre` |
| `eco-27-prairies-energy-and-farmland` | `r14-prairies-energy-and-farmland` |
| `eco-28-manitoba-economy` | `r14-manitoba-economy` |
| `eco-29-saskatchewan-uranium-and-potash` | `r14-saskatchewan-uranium-and-potash` |
| `eco-30-alberta-oil-and-gas` | `r14-alberta-oil-and-gas` |
| `eco-31-bc-forestry-products` | `r14-bc-forestry-products` |
| `eco-32-northern-mines` | `r15-northern-mines` |
| `eco-33-northern-oil-and-gas` | `r15-northern-oil-and-gas` |
| `eco-34-newfoundland-offshore-oil-and-gas` | `r12-newfoundland-offshore-oil-and-gas` |
| `eco-35-nova-scotia-shipbuilding-and-shipping` | `r12-nova-scotia-ships-and-fisheries` |
| `eco-36-halifax-deep-water-ice-free-port` | `r12-halifax-port` |
| `eco-37-new-brunswick-principal-industries` | `r12-new-brunswick-industries` |
| `eco-38-quebec-pulp-and-paper` | `r13-quebec-pulp-and-paper` |
| `eco-39-quebec-hydro-electricity` | `r13-quebec-hydro-electricity` |
| `eco-40-quebec-cutting-edge-industries` | `r13-quebec-cutting-edge-industries` |
| `eco-41-ontario-exports-from-services-and-manufacturing` | `r13-ontario-services-and-manufacturing` |
| `eco-42-ontario-farm-products` | `r13-ontario-farms` |
| `eco-43-saskatchewan-grains-and-oilseeds` | `r14-saskatchewan-grains-and-oilseeds` |
| `eco-44-saskatoon-mining-headquarters` | `r14-saskatoon` |
| `eco-45-alberta-oil-sands` | `r14-alberta-oil-sands` |
| `eco-46-alberta-beef-producer` | `r14-alberta-cattle-ranches` |
| `eco-47-port-of-vancouver-largest-and-busiest` | `r14-port-of-vancouver` |
| `eco-48-yukon-mining-today` | `r15-yukon-mining-today` |
| `eco-50-economy-built-on-farming-and-resources` | `h8-farming-and-exporting-resources` |
| `eco-51-strong-economy-1945-to-1970` | `m1-strong-economy-1945-to-1970` |

Decisions an auditor should see:

- **Containment is not teaching.** `eco-32` and `eco-33` already pass containment through `regions-09`'s
  "one-third of Canada's land mass" passage, and `eco-21` overlaps `regions-02`'s red-soil passage
  without either quote containing the other. Neither existing passage teaches the mines, the oil and gas,
  or the smallest province, so each question got a passage of its own.
- **Flagged shares are routed around.** The flagged shares on pp. 98, 100 and 102 stay in `source.quote`
  only, where the gate does not search. The text says "most" for `eco-25`'s three-quarters and "a large share" for
  `eco-31`'s one-half, and leaves out `eco-43`'s 40 %. The quote for `eco-43` is the clause "is the
  country's largest producer of grains and oilseeds.", which the question's quote contains.

**Read in the level (2026-09-24).** `content/quests/alberta-foothills-ranch-barn.json` now has a `read`
step right after each stop's `visit` step, before that stop's `answer` step. Two stops read
*Canada's Regions* lessons (`r13`, `r14`). ADR-0065's tier-1 obligation keeps Regions material out of
levels 1–5 only. It says levels 6–10 are "the same", and whether that includes the exclusion is left for
the reviewer below.

| Stop | Lesson | Passages | Words EN / FR | Pooled questions read here or earlier |
|---|---|---|---|---|
| Ranch gate | `economy-03` | `e3-service-industries`, `e3-most-workers-in-services`, `e3-natural-resources-industries`, `e3-resources-built-the-country` | 83 / 101 | 05, 06, 07, 11, 12 |
| Barn (`ranch-barn`) | `r13` | `r13-ontario-and-quebec-manufacturing`, `r13-quebec-pulp-and-paper`, `r13-quebec-cutting-edge-industries`, `r13-ontario-farms` | 52 / 66 | 25, 38, 40, 42 |
| Oil pump (`pump-jack`) | `r14` | `r14-prairies-energy-and-farmland`, `r14-saskatchewan-uranium-and-potash`, `r14-alberta-oil-and-gas`, `r14-alberta-oil-sands` | 61 / 68 | 27, 29, 30, 45 |
| Herd (`beef-cattle`) | `economy-02` | `e2-always-a-trading-nation`, `e2-trade-keeps-our-standard-of-living`, `e2-free-trade-in-1988`, `e2-mexico-joins-in-1994` | 56 / 67 | 01, 02, 03, 04 |

Why these: at the gate, `e3` reaches five of its pool (`e3-service-industries` holds the three-kinds
heading, so it covers 05 and 07). **One flag on reading order:** the gate reads "The first is service
industries" and then "The third kind is natural resources", because it skips the second kind,
manufacturing. `e3-manufacturing-industries` in place of `e3-resources-built-the-country` would read in order. It
would lose `eco-12` and gain only `eco-08`, which the barn line already tells. The barn's line already tells
08, 09 and (in the guide's opening) 46. So the barn reads four other questions from its pool, and `r13` is
the manufacturing lesson. `r12` and `r14` also reach four each. The pump's pool is mostly `r14`, and `r14`
reaches four. At the herd, `e2` and `e1` each reach four, and `e2` was taken because it is half the length.
The herd line already tells 16.

Told only by a dialogue line: 08, 09 (barn line), 46 (guide's opening), 16 (herd line). The gate line tells 07, which is also read.

**Not taught in the level. They stay in Learn.** 30 of 51 pooled questions:

| Questions | Pooled at | Lesson | Why it is not read |
|---|---|---|---|
| `eco-19` | Gate | `e2` | The gate reads `e3` (five questions) |
| `eco-26` | Gate | `r13` | Same |
| `eco-49` | Gate | `rr5` | Same |
| `eco-50` | Gate | `h8` | Same |
| `eco-51` | Gate | `m1` | Same |
| `eco-20`, `eco-21`, `eco-23`, `eco-24`, `eco-35`, `eco-37` | Barn | `r12` | The barn reads `r13`. `r12` also reaches only four |
| `eco-31`, `eco-43` | Barn | `r14` | Same |
| `eco-22`, `eco-34` | Oil pump | `r12` | The pump reads `r14` |
| `eco-28`, `eco-44` | Oil pump | `r14` | The pump has 4 places |
| `eco-32`, `eco-33`, `eco-48` | Oil pump | `r15` | The pump reads `r14` |
| `eco-39` | Oil pump | `r13` | Same. The barn read `r13`, but its places went to the barn's own pool |
| `eco-10`, `eco-13` | Herd | `e3` | The herd reads `e2`. The gate's `e3` places went to the gate's own pool |
| `eco-14`, `eco-15`, `eco-17`, `eco-18` | Herd | `e1` | The herd reads `e2` |
| `eco-36` | Herd | `r12` | Same |
| `eco-41` | Herd | `r13` | Same |
| `eco-47` | Herd | `r14` | Same |

Result: 51 pooled questions. 17 are read at or before their stop, 4 more are told only by a dialogue
line, and 30 are left for Learn. No choice of lessons does better. A stop that reads another stop's
lesson early trades one of its own questions for one of the later stop's questions, so the total stays
the same. For example, the barn could read `r14` (31, 43, 28, 44) and the pump the other four `r14`
passages. That still reads 8 across the two stops.

**Batch 2 totals:** 117 new passages in the null verification form. By level: prairie-rail 41 for 40
questions, ottawa 43 for 41 questions, winnipeg 2 for 2 questions (the Oath passage and `e7-city-police-forces`),
and alberta-foothills 31 for 31 questions (`m1-strong-economy-1945-to-1970` counted here, not under
prairie-rail). Pools left untaught: `jus-07`, `jus-32` and `jus-37`, explained in §7.7.

### 7.9 Question to passage (peggys-cove, `who-we-are`)

Authored 2026-09-24, batch 3, for the five remaining levels in `journey` order. Every batch-3 passage is in a
new lesson file, so no existing lesson was edited and no file the verifier had open was touched. Each
passage copies its question's `page`, `asOf` and `volatile`, and its `source.quote` is the question's quote
or a stretch of it. The new Who We Are lessons are `w7` = `who-07-a-strong-and-free-country`,
`w8` = `who-08-aboriginal-rights-and-residential-schools`, `w9` = `who-09-the-three-aboriginal-peoples`,
`w10` = `who-10-francophones-acadians-and-quebecers`, `w11` = `who-11-newcomers-and-english-canada` and
`w12` = `who-12-a-diverse-people`.

| Question | Passage |
|---|---|
| `wwa-01-oldest-constitutional-tradition` | `w7-oldest-constitutional-tradition` |
| `wwa-02-only-constitutional-monarchy` | `w7-only-constitutional-monarchy` |
| `wwa-03-peace-order-good-government` | `w1-institutions-and-good-government` (already taught; the prompt asks for the phrase, which that passage teaches) |
| `wwa-04-three-founding-peoples` | `w1-three-founding-peoples` (already taught) |
| `wwa-05-great-dominion` | `w7-the-great-dominion` |
| `wwa-06-migration-from-asia` | `w8-ancestors-came-from-asia` |
| `wwa-07-established-before-europeans` | `w8-here-long-before-european-explorers` |
| `wwa-08-treaty-rights-in-constitution` | `w8-rights-in-the-constitution` |
| `wwa-09-royal-proclamation-1763` | `w8-royal-proclamation-of-1763` |
| `wwa-10-treaties-not-always-respected` | `w8-treaties-not-always-respected` |
| `wwa-11-residential-schools-period` | `w8-residential-schools-1800s-to-1980s` |
| `wwa-12-languages-prohibited` | `w8-languages-and-practices-forbidden` |
| `wwa-13-apology-2008` | `w8-apology-in-2008` |
| `wwa-14-achievements-today` | `w8-achievements-today` |
| `wwa-15-three-distinct-groups` | `w9-three-distinct-groups` |
| `wwa-16-first-nations-on-and-off-reserve` | `w3-on-reserve-and-off-reserve` (already taught) |
| `wwa-17-inuit-means-the-people` | `w9-inuit-means-the-people` |
| `wwa-18-inuit-knowledge-of-the-land` | `w9-inuit-knowledge-of-the-land` |
| `wwa-19-metis-prairie-provinces` | `w9-most-metis-live-on-the-prairies` |
| `wwa-20-michif` | `w9-michif` |
| `wwa-21-shares-of-the-three-groups` | `w9-first-nations-the-largest-group` (`volatile`) |
| `wwa-22-official-languages-services` | `w10-federal-services-in-both-languages` |
| `wwa-23-anglophones-and-francophones` | `w10-anglophones-and-francophones` (`volatile`) |
| `wwa-24-francophones-outside-quebec` | `w10-francophones-outside-quebec` (`volatile`) |
| `wwa-25-new-brunswick-bilingual` | `r4-the-only-bilingual-province` (already taught, same sentence) |
| `wwa-26-acadians-1604` | `w10-acadians-settled-from-1604` |
| `wwa-27-great-upheaval` | `w10-the-great-upheaval` |
| `wwa-28-acadian-deportation-share` | `w10-acadians-deported` |
| `wwa-29-quebecers-8500-settlers` | `w10-quebecers-descend-from-8500-settlers` |
| `wwa-30-quebecois-nation-2006` | `w10-the-quebecois-a-nation` |
| `wwa-31-anglo-quebecers` | `w10-anglo-quebecers` (`volatile`) |
| `wwa-32-newcomers-embrace-rule-of-law` | `w11-newcomers-embrace-the-rule-of-law` |
| `wwa-33-settlers-of-english-speaking-canada` | `w11-who-built-english-speaking-canada` |
| `wwa-34-majority-born-in-canada` | `w12-most-born-in-canada` |
| `wwa-35-why-english-canadians` | `w11-why-english-canadians` |
| `wwa-36-land-of-immigrants` | `w12-newcomers-built-and-defended` |
| `wwa-37-largest-groups-list` | `w12-the-largest-groups` (`volatile`) |
| `wwa-38-immigrants-since-the-1970s` | `w12-immigrants-from-asia-since-the-1970s` (`volatile`) |
| `wwa-39-chinese-languages-at-home` | `w12-chinese-languages-at-home` (`volatile`) |
| `wwa-40-largest-religious-affiliation` | `w12-groups-live-and-work-in-peace` (`volatile`, copied from the question) |
| `wwa-41-state-and-faith-communities` | `w12-state-and-faith-communities-as-partners` |
| `wwa-42-growing-religious-groups` | `w12-no-religion-is-growing` (`volatile`) |
| `wwa-43-equal-treatment-civil-marriage` | `w12-equal-under-the-law-and-civil-marriage` |
| `wwa-44-shared-canadian-identity` | `w12-a-shared-canadian-identity` |
| `wwa-45-black-loyalists-1780s` | **Not taught**: its quote is the p. 22 caption of Marjorie Turner-Bailey (ADR-0061 §3) |
| `wwa-46-strong-and-free-country` | `w7-strong-and-free` |
| `wwa-47-acadian-culture-today` | `w10-acadian-culture-today` |
| `wwa-48-non-official-languages-at-home` | `w12-other-languages-at-home` |

Decisions an auditor should see:

- **Containment is not teaching, again.** `wwa-11`, `wwa-17`, `wwa-19`, `wwa-20`, `wwa-29` and `wwa-41` all
  overlap a batch-1 passage (`w2`, `w3`, `w4`, `w6`), but the older passage teaches the neighbouring clause, not
  the one graded (the period, "the people", the Prairies, Michif, 8,500 settlers, what the partnership does).
  Each got a passage whose quote is the graded stretch.
- **Flagged shares routed around (pp. 17, 18, 19, 21).** `wwa-21` is taught as an order (First Nations, then
  Métis, then Inuit), with no percentage. `wwa-23` is taught as the two definitions, without "18 million
  Anglophones". `wwa-39` says "two of Canada's biggest cities" and does not name Vancouver and Toronto, because
  the city names sit in the next sentence beside the banned 13 %. `wwa-42` teaches the "no religion" clause only,
  because the question's quote begins there.
- **`wwa-37`'s list** is broken into three runs so that no 14-word run of the guide's list survives.

### 7.10 Question to passage (toronto, `elections`)

New lessons: `e8` = `elections-08-electing-your-member-of-parliament` (p. 60), `e9` =
`elections-09-who-may-vote-and-the-voters-list` (p. 61), `e10` =
`elections-10-the-secret-ballot-and-forming-a-government` (p. 62), `e11` = `elections-11-voting-step-by-step`
(pp. 64–66). Every p. 60 passage copies its question's `volatile: true`, and "308" appears in no text.

| Question | Passage |
|---|---|
| `elec-01-what-canadians-vote-for` | `e8-what-canadians-vote-for` |
| `elec-02-re-elect-or-choose-new` | `e8-re-elect-or-choose-new` |
| `elec-03-another-name-for-a-riding` | `e8-ridings-and-constituencies` |
| `elec-04-whom-an-mp-represents` | `e8-whom-an-mp-represents` |
| `elec-05-what-candidates-are-called` | `e8-candidates` |
| `elec-06-many-candidates-in-a-district` | `e8-many-candidates-in-a-district` |
| `elec-07-early-election` | `e8-an-earlier-election` |
| `elec-08-what-voters-choose-on-the-ballot` | `e8-choose-a-candidate-and-a-party` |
| `elec-09-federal-referendum` | `e9-federal-referendums` |
| `elec-10-national-register-of-electors` | `e9-the-national-register-of-electors` |
| `elec-11-which-polling-station` | `e9-your-polling-station` |
| `elec-12-what-secret-ballot-means` | `e10-what-a-secret-ballot-means` |
| `elec-13-counting-the-ballots` | `e10-counting-the-ballots` |
| `elec-14-minority-government` | `e10-minority-government` |
| `elec-15-who-appoints-the-prime-minister` | `e10-the-governor-general-appoints-the-prime-minister` |
| `elec-16-defeated-on-confidence` | `e10-defeated-on-a-major-decision` |
| `elec-17-support-of-most-mps` | `e10-governing-with-the-confidence-of-mps` |
| `elec-18-no-card-received` | `e11-no-card-call-your-local-office` |
| `elec-19-card-confirms-listing` | `e11-the-card-confirms-you-are-listed` |
| `elec-20-behind-the-screen` | `e11-behind-the-screen` |
| `elec-21-where-to-see-results` | `e11-where-to-see-the-results` |
| `gov-35-fixed-election-date` | `e8-fixed-election-date` |
| `gov-37-electoral-district` | `e8-what-an-electoral-district-is` |
| `gov-38-who-may-run` | `e8-who-may-run` |
| `gov-39-who-wins-the-seat` | `e8-most-votes-wins-the-seat` |
| `gov-40-who-may-vote` | `e9-who-may-vote` |
| `gov-41-elections-canada` | `e9-elections-canada-makes-the-lists` |
| `gov-42-voter-information-card` | `e9-the-voter-information-card` |
| `gov-43-added-on-election-day` | `e9-added-to-the-list-on-election-day` |
| `gov-44-what-to-bring` | `e11-what-to-bring` |
| `gov-45-advance-poll` | `e11-advance-polls-and-special-ballots` |
| `gov-46-marking-the-ballot` | `e11-marking-an-x` |
| `gov-47-ballot-box` | `e11-into-the-ballot-box` |
| `gov-48-secret-ballot` | `e10-no-one-can-make-you-tell` |
| `gov-50-who-forms-government` | `e10-who-forms-the-government` |
| `gov-51-majority-government` | `e10-majority-government` |
| `gov-60-other-election-rules` | `e11-other-elections-have-other-rules` |

Decisions an auditor should see:

- **Multi-sentence quotes are split by what each question grades.** `gov-37`, `gov-38`, `gov-39`, `gov-50`
  and `gov-51` quote two or three sentences whose other sentences are `elec-04`, `elec-05`/`06`, `elec-08`,
  `elec-15` and `elec-14`. Each passage quotes the one sentence it teaches, so each stretch is contained in
  both questions' quotes. `gov-44` is taught by its last sentence ("Bring this card…"), the one it grades.
- **Four containment passes that do not teach.** `e1-no-number-call-elections-canada` contains `elec-18`'s
  sentence but teaches the fallback number; `e1-card-gives-a-number-for-special-help` is inside `gov-42`'s quote
  but omits when and where; `e3-fold-your-ballot-and-hand-it-over` and `e3-the-ballot-number-is-torn-off` are
  inside `elec-20`'s and `gov-47`'s quotes but teach neither the screen nor the ballot box. Batch 1's files were
  not edited; the four questions got passages in `e9`/`e11`.

### 7.11 Question to passage (vancouver, `symbols`)

New lessons: `s6` = `symbols-06-the-crown-the-flag-and-the-maple-leaf` (pp. 78–79), `s7` =
`symbols-07-the-coat-of-arms-and-the-parliament-buildings` (p. 80), `s8` = `symbols-08-hockey-lacrosse-and-the-beaver`
(pp. 81–82) and `s9` = `symbols-09-languages-anthems-and-honours` (pp. 82–89).

| Question | Passage |
|---|---|
| `sym-01-what-symbols-do` | `s6-what-symbols-do` |
| `sym-02-crown-and-government` | `s6-the-crown-and-government` |
| `sym-03-monarchy-since-1867` | `s6-monarchy-since-1867` |
| `sym-04-new-flag-1965` | `s6-new-flag-1965` |
| `sym-05-flag-pattern-origin` | `s6-red-white-red-pattern` |
| `sym-06-national-colours-1921` | `s6-national-colours-since-1921` |
| `sym-07-union-jack-royal-flag` | `s6-the-royal-flag` |
| `sym-08-red-ensign-hundred-years` | **Not taught**: its quote is the p. 79 caption of the Red Ensign (ADR-0061 §3). The body sentence on the same page ("served as the Canadian flag for about 100 years") carries the same fact, but a passage quoting it would not contain, nor be contained in, the question's quote. Re-quoting the question onto the body sentence would let it be taught; that is an author-and-verifier change to the question, not a lesson change. |
| `sym-09-maple-leaf-best-known` | `s6-the-maple-leaf-best-known` |
| `sym-10-maple-leaf-french-canadians` | `s6-maple-leaves-since-the-1700s` |
| `sym-11-fleur-de-lys-lily` | `s6-the-fleur-de-lys` |
| `sym-12-quebec-flag-1948` | `s6-quebec-flag-1948` |
| `sym-13-motto-from-sea-to-sea` | `s7-motto-from-sea-to-sea` |
| `sym-14-coat-of-arms-symbols` | `s7-symbols-on-the-arms` |
| `sym-15-where-arms-appear` | `s7-where-the-arms-appear` |
| `sym-16-parliament-completed-1860s` | `s7-parliament-completed-in-the-1860s` |
| `sym-17-centre-block-fire-1916` | `s7-centre-block-fire-1916` |
| `sym-18-library-only-original-part` | `s7-the-library-survived` |
| `sym-19-peace-tower-1927` | `s7-the-peace-tower` |
| `sym-20-books-of-remembrance` | `s7-the-books-of-remembrance` |
| `sym-21-national-winter-sport` | `s8-hockey-the-national-winter-sport` |
| `sym-22-ice-hockey-developed-1800s` | `s8-ice-hockey-developed-in-the-1800s` |
| `sym-23-stanley-cup-donor` | `s8-the-stanley-cup` |
| `sym-24-clarkson-cup` | `s8-the-clarkson-cup` |
| `sym-25-official-summer-sport` | `s8-lacrosse-the-summer-sport` |
| `sym-26-curling-scottish-pioneers` | `s8-curling` |
| `sym-27-soccer-registered-players` | `s8-soccer-most-registered-players` (`volatile`) |
| `sym-28-beaver-hudsons-bay-company` | `s8-beaver-and-the-hudsons-bay-company` |
| `sym-29-beaver-st-jean-baptiste-1834` | `s8-beaver-and-the-st-jean-baptiste-society` |
| `sym-30-beaver-five-cent-coin` | `s8-where-the-beaver-appears` |
| `sym-31-language-for-citizenship` | `s9-language-for-citizenship` |
| `sym-32-language-exemption-at-55` | `s9-language-exemption-at-55` (`volatile`) |
| `sym-33-official-languages-act-objectives` | `s9-official-languages-act-1969` (the three objectives are already `symbols-03`'s passages) |
| `sym-34-anthem-proclaimed-1980` | `s9-anthem-proclaimed-1980` |
| `sym-35-anthem-first-sung` | `s9-anthem-first-sung-in-quebec-city` |
| `sym-36-royal-anthem-purpose` | `s9-the-royal-anthem` |
| `sym-37-order-of-canada-1967` | `s9-order-of-canada-1967` |
| `sym-38-honours-orders-decorations-medals` | `s9-honours-orders-decorations-medals` |
| `sym-39-victoria-cross-highest-honour` | `s9-the-victoria-cross` |
| `sym-40-first-canadian-victoria-cross` | `s9-dunn-first-canadian-victoria-cross` |
| `sym-41-william-hall-victoria-cross` | `s9-william-hall-victoria-cross` |
| `sym-42-canada-day-july-1` | `s9-canada-day` |
| `sym-43-last-canadian-victoria-cross` | `s9-robert-hampton-gray-last-victoria-cross` (`volatile`) |

Decisions an auditor should see:

- **p. 78 and p. 84 flags.** `sym-01`…`03` cite p. 78; the text names Queen Victoria only (the quote's own words)
  and no living or recent Sovereign. The O Canada passages (p. 84) teach 1980 and Québec City and quote
  neither English line. `sym-34` and `sym-35` share a sentence, so each passage quotes only its own sentence.
- **`sym-40` names Dunn.** The question's quote begins at "served in the British Army"; the subject, Alexander
  Roberts Dunn, is the same bullet's first clause. The passage names him as the referent of the quoted
  predicate. A verifier who reads that as a claim outside the quote should say so.
- **`sym-33`** is taught as "three main objectives"; the three are not restated, because they are
  `symbols-03`'s three passages and a restatement would put four propositions in one passage.

### 7.12 Question to passage (quebec-city, `history`)

New lessons, in guide order: `h9` = `history-09-first-peoples-and-first-explorers` (pp. 23–24), `h10` =
`history-10-new-france-and-the-fur-trade` (pp. 24–25), `h11` = `history-11-the-quebec-act-and-the-loyalists`
(pp. 26–27), `h12` = `history-12-ending-slavery-and-early-trade` (pp. 28–29), `h13` =
`history-13-defending-canada-in-1812` (pp. 29–30), `h14` = `history-14-rebellion-and-responsible-government`
(pp. 31–32), `h15` = `history-15-building-the-dominion` (pp. 33–34), `h16` =
`history-16-macdonald-riel-and-the-railway` (pp. 35–37), `h17` = `history-17-the-great-war-and-votes-for-women`
(pp. 38–41) and `h18` = `history-18-the-depression-and-the-second-world-war` (pp. 42–44). ADR-0068's split at
`hist-32` changes none of this, because lessons are filed by chapter. `history-08` was not touched.

| Question | Passage |
|---|---|
| `hist-01-why-called-indians` | `h9-why-called-indians` |
| `hist-02-sioux-followed-the-bison` | `h9-the-sioux-followed-the-bison` |
| `hist-03-huron-wendat-farmers` | `h9-huron-wendat-farmers-and-hunters` |
| `hist-04-west-coast-preserved-fish` | `h9-west-coast-fish-dried-and-smoked` |
| `hist-05-european-diseases` | `h9-european-diseases` |
| `hist-06-first-200-years-of-bonds` | `h9-bonds-that-laid-the-foundations` |
| `hist-07-john-cabot-1497` | `h9-john-cabot-1497` (partly; see below) |
| `hist-08-lanse-aux-meadows` | `h9-lanse-aux-meadows` |
| `hist-09-cartier-three-voyages` | `h9-cartier-three-voyages` |
| `hist-10-kanata-means-village` | `h9-kanata-means-village` |
| `hist-11-first-settlement-1604` | `h10-first-settlement-1604` |
| `hist-12-champlain-quebec-1608` | `h10-champlain-quebec-1608` |
| `hist-13-peace-with-iroquois-1701` | `h10-peace-with-the-iroquois-1701` |
| `hist-14-fur-trade-beaver-pelts` | `h10-beaver-pelts-drove-the-fur-trade` |
| `hist-15-hudsons-bay-company-1670` | `h10-hudsons-bay-company-1670` |
| `hist-16-voyageurs-and-coureurs-des-bois` | `h10-voyageurs-and-coureurs-des-bois` |
| `hist-17-plains-of-abraham-1759` | `h10-plains-of-abraham-1759` |
| `hist-18-wolfe-and-montcalm` | `h10-wolfe-and-montcalm` |
| `hist-19-quebec-act-religious-freedom` | `h11-quebec-act-religious-freedom` |
| `hist-20-quebec-act-two-legal-systems` | `h11-quebec-act-two-legal-systems` |
| `hist-21-loyalists-40000` | `history-02`'s Loyalists passage (already taught; its quote contains the question's) |
| `hist-22-joseph-brant` | `h11-joseph-brant` |
| `hist-23-black-loyalists-3000` | `h11-black-loyalists` |
| `hist-24-first-assembly-halifax-1758` | `h11-first-assembly-halifax-1758` |
| `hist-25-constitutional-act-1791` | `h11-constitutional-act-1791` |
| `hist-26-first-elected-assemblies-1791` | `h11-first-elected-assemblies-1791` |
| `hist-27-upper-canada-abolition-1793` | `h12-upper-canada-moves-toward-abolition` |
| `hist-28-slavery-abolished-1833` | `h12-slavery-abolished-1833` |
| `hist-29-underground-railroad` | `h12-the-underground-railroad` |
| `hist-30-mary-ann-shadd-carey` | **Not taught**: p. 28 caption (ADR-0061 §3) |
| `hist-31-trading-posts-became-cities` | `h12-trading-posts-became-cities` |
| `hist-32-montreal-stock-exchange-1832` | `h12-montreal-stock-exchange-1832` |
| `hist-33-us-invasion-june-1812` | `history-03`'s invasion passage (already taught; its quote contains the question's) |
| `hist-34-tecumseh-and-the-shawnee` | `h13-volunteers-first-nations-and-tecumseh` |
| `hist-35-isaac-brock` | `h13-isaac-brock` |
| `hist-36-chateauguay-1813` | `h13-chateauguay` |
| `hist-37-war-of-1812-outcome` | `h13-the-war-kept-canada-independent` |
| `hist-38-burning-of-york-1813` | `h13-burning-of-york-1813` |
| `hist-39-wellington-and-bytown` | **Not taught**: p. 30 caption (ADR-0061 §3) |
| `hist-40-laura-secord` | **Not taught**: p. 31 caption (ADR-0061 §3) |
| `hist-41-what-responsible-government-means` | `h14-what-responsible-government-means` |
| `hist-42-nova-scotia-responsible-government` | `h14-nova-scotia-first-with-responsible-government` |
| `hist-43-la-fontaine` | `h14-la-fontaine-first-leader` |
| `hist-44-province-of-canada-1840` | `h14-province-of-canada-1840` |
| `hist-45-fathers-of-confederation` | `h15-fathers-of-confederation` |
| `hist-46-four-founding-provinces` | `h15-ontario-and-quebec-created` (the four are also `history-04`'s "1867 –" passage) |
| `hist-47-two-levels-of-government` | `h15-two-levels-of-government` |
| `hist-48-july-1-1867` | `h15-born-on-july-1-1867` |
| `hist-49-dominion-day-canada-day` | `h15-dominion-day` |
| `hist-50-leonard-tilley-dominion` | `h15-tilley-and-the-word-dominion` |
| `hist-51-newfoundland-1949` | `h15-newfoundland-and-labrador-1949` |
| `hist-52-nunavut-1999` | `h15-nunavut-1999` |
| `hist-53-alberta-saskatchewan-1905` | `h15-alberta-and-saskatchewan-1905` |
| `hist-54-first-prime-minister` | `h16-first-prime-minister` |
| `hist-55-cartier-architect-from-quebec` | `h16-cartier-led-quebec-in` |
| `hist-56-red-river-not-consulted` | `h16-red-river-metis-not-consulted` |
| `hist-57-manitoba-created-1870` | `h16-manitoba-created` |
| `hist-58-how-riel-is-seen` | `h16-how-riel-is-seen` |
| `hist-59-nwmp-1873` | `h16-north-west-mounted-police-1873` |
| `hist-60-rcmp-national-police-force` | `h16-the-rcmp-today` (`volatile`) |
| `hist-61-bc-joined-1871` | `h16-british-columbia-and-the-railway-promise` |
| `hist-62-last-spike-1885` | `h16-the-last-spike-1885` |
| `hist-63-head-tax-apology-2006` | `h16-head-tax-and-the-apology` |
| `hist-64-wilfrid-laurier` | `h16-wilfrid-laurier` |
| `hist-65-boer-war-volunteers` | `h17-boer-war-volunteers` |
| `hist-66-600000-served-first-world-war` | `h17-600000-served` |
| `hist-67-vimy-ridge-1917` | `h17-vimy-ridge` |
| `hist-68-internment-1914-1920` | `h17-internment-of-enemy-aliens` |
| `hist-69-armistice-1918` | `h17-armistice-1918` |
| `hist-70-arthur-currie` | `h17-arthur-currie` |
| `hist-71-maple-leaf-1850s` | **Not taught**: p. 39 caption (ADR-0061 §3) |
| `hist-72-who-could-vote-at-confederation` | `h17-who-could-vote-in-1867` |
| `hist-73-emily-stowe` | `h17-emily-stowe` |
| `hist-74-manitoba-women-vote-1916` | `h17-manitoba-first-1916` |
| `hist-75-women-federal-vote-1918` | `h17-federal-vote-for-women-1918` |
| `hist-76-agnes-macphail-1921` | `h17-agnes-macphail` (the p. 40 body sentence, not the p. 39 caption) |
| `hist-77-quebec-women-vote-1940` | `h17-quebec-women-vote-1940` |
| `hist-78-remembrance-day` | `h17-the-poppy-and-the-silence` |
| `hist-79-in-flanders-fields` | `h17-in-flanders-fields` |
| `hist-80-british-commonwealth` | `h18-the-british-commonwealth-of-nations` (`volatile`) |
| `hist-81-great-depression-unemployment` | `h18-unemployment-in-1933` |
| `hist-82-bank-of-canada-1934` | `h18-bank-of-canada-1934` |
| `hist-83-western-farmers-depression` | `h18-western-farmers-hit-hardest` |
| `hist-84-refugees-turned-away-1939` | `h18-refugees-turned-away` |
| `hist-85-second-world-war-began-1939` | `h18-the-war-began-in-1939` |
| `hist-86-million-served-second-world-war` | `h18-a-million-served` |
| `hist-87-juno-beach` | `h18-juno-beach` |
| `hist-88-liberation-of-the-netherlands` | `h18-liberating-the-netherlands` |
| `hist-89-air-training-plan` | `h18-air-training-plan` |
| `hist-90-third-largest-navy` | `h18-third-largest-navy` |
| `hist-91-hong-kong-and-dieppe` | `h18-hong-kong-and-dieppe` |
| `hist-92-japan-surrendered-1945` | `h18-japan-surrendered` |
| `hist-93-apology-1988` | `h18-apology-to-japanese-canadians` |
| `hist-94-durham-assimilation` | `h14-durham-misunderstood-french-canadians` |
| `hist-95-rebellions-1837-38` | `h14-why-the-rebellions-failed` |
| `hist-96-habitants-and-canadiens` | `h11-habitants-or-canadiens` |
| `hist-97-british-paid-for-defences` | `h13-britain-paid-for-the-defences` |

Decisions an auditor should see:

- **Four captions.** `hist-30` (Mary Ann Shadd Carey), `hist-39` (Wellington and Bytown), `hist-40` (Laura
  Secord) and `hist-71` (the maple-leaf cap badge) quote picture captions, so ADR-0061 §3 keeps them out of the
  lessons. Unless §3 is amended (§6.3 already asks this for two captions), they stay untaught.
- **`hist-07` is taught only in part.** The question asks who first drew a map of Canada's East Coast, but its
  quote stops at "the expedition of John Cabot" and leaves out the clause "who was the first to draw a map of
  Canada's East Coast". A passage must quote the question's quote or a stretch of it, so `h9-john-cabot-1497`
  teaches that exploration began in earnest in 1497 with Cabot, and says nothing about the map. Re-quoting the
  question to take in the whole sentence would let a passage teach the map; that is a question change.
- **`hist-46` is taught in two places.** Its quote holds only the split of the Province of Canada into Ontario
  and Quebec; the four founding provinces are `history-04`'s "1867 – Ontario, Quebec, Nova Scotia, New
  Brunswick" passage.
- **Referents named outside the quote.** A few quotes open mid-sentence, and the passage names what the
  quote refers to: the HBC forts (`hist-31`), "the last hundred days" for Currie's command (`hist-70`),
  "Canadians of Japanese origin" for the 1988 apology (`hist-93`), the three delegations behind "These men"
  (`hist-45`), "the King of England" for 1670 (`hist-15`, avoiding the monarch's name). `hist-36`'s passage
  states only the 4,000 invaders at Châteauguay, because de Salaberry and his 460 soldiers are `history-03`'s
  passage and sit on the previous page.

### 7.13 Question to passage (the-north, `regions`)

New lessons: `r16` = `regions-16-the-country-and-its-capitals` (pp. 93–95), `r17` =
`regions-17-the-atlantic-provinces-up-close` (pp. 96–97), `r18` = `regions-18-central-canada-up-close`
(pp. 98–99), `r19` = `regions-19-the-prairies-and-the-west-coast-up-close` (pp. 100–102) and `r20` =
`regions-20-the-northern-territories-up-close` (pp. 103–104). `regions-12`…`15` were not touched.

| Question | Passage |
|---|---|
| `reg-01-second-largest-country` | `r16-second-largest-country` |
| `reg-02-three-oceans` | `r16-three-oceans` |
| `reg-03-five-distinct-regions` | `r16-five-distinct-regions` |
| `reg-04-ten-provinces-three-territories` | `r16-ten-provinces-three-territories` |
| `reg-05-ottawa-chosen-in-1857` | `r16-ottawa-chosen-in-1857` |
| `reg-06-capital-of-newfoundland-and-labrador` | `r16-capital-of-newfoundland-and-labrador` |
| `reg-07-capital-of-prince-edward-island` | `r16-capital-of-prince-edward-island` |
| `reg-08-halifax-is-the-capital-of-nova-scotia` | `r16-capital-of-nova-scotia` |
| `reg-09-capital-of-new-brunswick` | `r16-capital-of-new-brunswick` |
| `reg-10-capital-of-quebec` | `r16-capital-of-quebec` |
| `reg-11-toronto-is-the-capital-of-ontario` | `r16-capital-of-ontario` |
| `reg-12-capital-of-manitoba` | `r16-capital-of-manitoba` |
| `reg-13-regina-is-the-capital-of-saskatchewan` | `r16-capital-of-saskatchewan` |
| `reg-14-capital-of-alberta` | `r16-capital-of-alberta` |
| `reg-15-capital-of-british-columbia` | `r16-capital-of-british-columbia` |
| `reg-16-capital-of-nunavut` | `r16-capital-of-nunavut` |
| `reg-17-yellowknife-is-the-capital-of-the-northwest-territories` | `r16-capital-of-the-northwest-territories` |
| `reg-18-capital-of-yukon` | `r16-capital-of-yukon` |
| `reg-19-most-easterly-point-in-north-america` | `r17-most-easterly-point` |
| `reg-20-province-with-its-own-time-zone` | `r17-its-own-time-zone` |
| `reg-21-birthplace-of-confederation` | `r17-birthplace-of-confederation` |
| `reg-22-confederation-bridge` | `r17-confederation-bridge` |
| `reg-23-atlantic-ocean-climate` | `r17-atlantic-climate` |
| `reg-24-bay-of-fundy-tides` | `r17-bay-of-fundy-tides` |
| `reg-25-halifax-naval-base` | `r17-halifax-naval-base` |
| `reg-26-nova-scotia-celtic-and-gaelic-traditions` | `r17-celtic-and-gaelic-traditions` |
| `reg-27-moncton-acadian-centre` | `r17-moncton-acadian-centre` |
| `reg-28-oldest-colony-of-the-british-empire` | `r17-oldest-colony-of-the-british-empire` |
| `reg-29-anne-of-green-gables-setting` | `r17-anne-of-green-gables-set-in-pei` |
| `reg-30-where-most-canadians-live` | `r18-where-most-canadians-live` |
| `reg-31-southern-ontario-and-quebec-climate` | `r18-central-canada-climate` |
| `reg-32-first-language-in-quebec` | `r18-french-first-language-in-quebec` |
| `reg-33-quebec-culture-abroad` | `r18-quebec-culture-abroad` |
| `reg-34-niagara-vineyards-and-fruit` | `r18-niagara-vineyards-and-fruit` |
| `reg-35-lake-superior-largest-fresh-water-lake` | `r18-lake-superior-the-largest` |
| `reg-36-lake-michigan-in-the-united-states` | `r18-lake-michigan-in-the-united-states` |
| `reg-37-the-three-prairie-provinces` | `r19-the-three-prairie-provinces` |
| `reg-38-portage-and-main` | `r19-portage-and-main` |
| `reg-39-st-boniface-french-quarter` | `r19-st-boniface` |
| `reg-40-manitoba-ukrainian-culture` | `r19-manitoba-ukrainian-culture` |
| `reg-41-breadbasket-and-wheat-province` | `r19-breadbasket-of-the-world` |
| `reg-42-rcmp-training-academy-in-regina` | `r19-rcmp-training-academy` |
| `reg-43-who-alberta-is-named-after` | `r19-named-after-princess-louise` |
| `reg-44-banff-national-park-province` | `r19-banff-national-park` |
| `reg-45-badlands-dinosaur-fossils` | `r19-the-badlands` |
| `reg-46-pacific-gateway` | `r19-pacific-gateway` |
| `reg-47-bc-coast-temperate-climate` | `r19-mild-climate-on-the-bc-coast` |
| `reg-48-navy-pacific-fleet-headquarters` | `r19-victoria-and-the-pacific-fleet` |
| `reg-49-land-of-the-midnight-sun` | `r20-land-of-the-midnight-sun` |
| `reg-50-what-the-tundra-is-like` | `r20-the-tundra` |
| `reg-51-gold-rush-of-the-1890s` | `r20-the-gold-rush` |
| `reg-52-mount-logan` | **Not taught**: its quote is the p. 104 caption of Mount Logan (ADR-0061 §3) |
| `reg-53-diamond-capital-of-north-america` | `r20-diamond-capital-of-north-america` |
| `reg-54-mackenzie-river-system` | `r20-the-mackenzie-river` |
| `reg-55-nunavut-made-from-the-northwest-territories` | `r20-nunavut-made-from-the-northwest-territories` |
| `reg-56-what-nunavut-means` | `r20-what-nunavut-means` |
| `reg-57-iqaluit-formerly-frobisher-bay` | `r20-iqaluit-formerly-frobisher-bay` |
| `reg-58-nunavut-consensus-government` | `r20-government-by-consensus` |
| `reg-59-northern-winters-and-summers` | `r20-northern-winters-and-summers` |

Decisions an auditor should see:

- **The register's flags, followed.** Canada's Regions has a live check (`liveChecks`, 2026-09-10,
  `source-unrevised`), so it is authored like any other chapter. No banned term is in any text, in either
  language: `reg-32` says "most" for "more than three-quarters", `reg-53` omits Yellowknife's population,
  `reg-58`'s quote is the stretch after "19-member", `reg-05` names no monarch (p. 94), and `reg-30`'s French
  says « la majorité » because « la moitié » is banned on p. 98. No passage states a figure that a
  `knownStaleness` entry lists, so every passage copies its question's `volatile: false`. The figures that are
  stated (10 million km², 4,200 km, 24 hours of daylight, five national parks, 1857, 1885, 1999) are geography
  or dates that no flag lists.
- **Containment is not teaching.** `reg-28`, `reg-29`, `reg-32`, `reg-43` and `reg-48` each contain a batch-1
  passage's quote (`regions-02`, `-05`, `-07`, `-08`), but those passages teach the sea heritage, the orphan girl,
  where Quebecers live, Lake Louise and Victoria as a tourist centre. Each question got the stretch it grades.
- **Shared sentences split.** `reg-19`/`reg-20` (easterly point, time zone), `reg-21`/`reg-22` (birthplace,
  bridge), `reg-35`/`reg-36` (Superior, Michigan), `reg-44`/`reg-45` (Banff, Badlands) and `reg-55`…`reg-58`
  (Nunavut's name, origin, capital, consensus) each get one passage per graded stretch.

### 7.14 Batch 3 totals

| Level | Subject | Pool questions | Already taught | Newly taught | Passages added | Not taught (caption) |
|---|---|---|---|---|---|---|
| peggys-cove | `who-we-are` | 48 | 4 | 43 | 43 | 1 (`wwa-45`) |
| toronto | `elections` | 37 | 0 | 37 | 37 | 0 |
| vancouver | `symbols` | 43 | 0 | 42 | 42 | 1 (`sym-08`) |
| quebec-city | `history` | 97 | 2 | 91 | 91 | 4 (`hist-30`, `hist-39`, `hist-40`, `hist-71`) |
| the-north | `regions` | 59 | 0 | 58 | 58 | 1 (`reg-52`) |
| **Total** | | **284** | **6** | **271** | **271** | **7** |

271 new passages in the null verification form, in 29 new lesson files. Together with batches 1 and 2, every
level's answer pools are now taught except for 10 caption questions (`jus-07`, `jus-32`, and the 7 above) and
two partial teaches (`jus-37` in §7.7, `hist-07` in §7.12). Next under the owner's rule: the verified
questions in no pool, then the ceilings of §5(a).
