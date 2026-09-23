# Guide coverage: how much of *Discover Canada* the game carries, and what a player reaches

- Measured 2026-09-23 on `origin/main` at `7441451`, against the extraction
  `fd51046981916115cc39b989e9eedd3ab2c5943aeb7e0fe4e237e13a0da7c836` (the register's
  `extractedTextSha256`). canada.ca refused the fetch, so the PDF came from the Wayback Machine's
  2026-08-03 capture of `discover-large.pdf`. It hashed to the register's `sha256`. `pdftotext -layout`
  **24.02.0** then reproduced the recorded text digest byte for byte, although the register records 26.08.0.
- Re-run with `make guide-coverage` (`scripts/guide-coverage.mjs`). Add `-- --list` for every uncovered
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
Nothing in this section is a measurement: `make guide-coverage` counts only verified carriers, so the
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
| peggys-cove | | | | | Next |
| quebec-city, ottawa, toronto, winnipeg, prairie-rail, alberta-foothills, vancouver, the-north | | | | | Not started |

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
