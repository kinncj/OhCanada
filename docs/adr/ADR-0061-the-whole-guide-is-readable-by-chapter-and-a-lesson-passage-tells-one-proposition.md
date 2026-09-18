# ADR-0061: The whole guide is readable by chapter, and a lesson passage tells one proposition

- Status: Accepted (2026-09-18)
- Settles: where the rest of *Discover Canada* lives in the game; what the unit of readable teaching is and
  what its verification grain is; what "the whole guide" excludes, by name, so nobody later ships a picture
  caption as a lesson; how this stands beside ADR-0057's teaching programme; whether the exam or the
  thirty-question floor move; whether any of it is reachable offline and what it costs the payload.
- **Runs beside ADR-0057. It absorbs nothing in it, replaces nothing in it, and delays nothing in it.** §4,
  which exists because "more learning content" is the sentence both ADRs were written from, and a reader who
  meets them a month apart will otherwise assume one supersedes the other.
- **Amends nothing in ADR-0028 and nothing in ADR-0030.** A subject is still a remit, the floor is still
  thirty, a subject still owns what it grades. A lesson grades nothing at all, which is §5's whole argument.
- **Does not reach Exam mode, Study, or any level's draw.** §5 and §6.
- Slice: L4 (`docs/plan/slices.md`).
- Criteria: the rules below, and §9's gates.
- Numbering. **0061 is the first number above the high-water mark across every ref this repository can see**,
  and it was taken after two checks rather than one: `git log --all --name-only -- docs/adr` **and**
  `git ls-remote --heads origin`, with a `git fetch` before both. `main` holds ADR-0001…ADR-0037,
  ADR-0039…ADR-0049 and ADR-0051…ADR-0059; 0060 is **claimed on a branch that has not landed** —
  `portrait-notice`, a dismissible notice for a device that is not a phone held upright. This document was
  drafted as 0060 and renumbered before it was pushed, which is the entire argument for looking at branches:
  the high-water mark in `git log` cannot see a number claimed on a ref nobody has fetched, and during this
  pass `main` itself moved and one branch was merged and deleted between two consecutive commands. The holes
  at 0038, which nothing ever occupied, and 0050, spent by a dropped draft, stay untaken, for the reason
  ADR-0052 recorded and ADR-0053, ADR-0056 and ADR-0057 restated: a number is retired by having been used,
  and an ADR filed below the ADRs it builds on reads as older than them for ever. The bare numbers in this
  paragraph carry no `ADR-` prefix on purpose — `tests/unit/contracts/documents-name-real-schemas.test.ts`
  resolves every `ADR-NNNN` token to a file in `docs/adr`, and 0060 names no file on this branch. **The
  convention is no longer the control.** On 2026-09-17 two agents on branches that could not see each other
  both took 0057 and both landed, and `main` carried two decisions under one number until one was renumbered
  to 0059; `tests/unit/contracts/an-adr-number-is-used-once.test.ts` now catches that where the branches
  meet, which is the only place it can be caught.

## Context

### What the product owner said

> we need much more learning content tho... it's all on the study guide... we kinda need the whole study
> guide in game...

And, binding this decision from earlier rulings by the same owner:

> literally use the names from the official guide. that's all.... all the study materials should be from the
> official guide.

> landmarks that aren't in the guide can still be a POI in the game just to show extra learning content...
> the goal is to learn and educate people.

> correct, the content is just what's present on the guide... it should not prevent us from using iconic POIs
> to show the content.

Read together, these are one consistent instruction and not three: **the material is the guide's, the staging
is ours, and there should be much more of the material reachable.** ADR-0056 settled the staging. ADR-0057
settled what a level must teach before it asks. Neither of them answers "where does the *rest* of the guide
live", because neither of them had a surface to put it on.

### The reading that has to be refused first, because it is the literal one

**"The whole study guide in game" cannot mean the guide's text in the game.** *Discover Canada* is Crown
copyright. `content/sources/discover-canada.json` records the licence in the register itself — *"Crown
copyright. Paraphrase and cite; do not redistribute. Not committed to this repository."* — and
`committed: false` is why the extraction is git-ignored and why every measurement in this ADR ran where the
bytes are rather than in CI. `CLAUDE.md` says the same thing from the other end: facts are **paraphrased**,
chapter-referenced, and a question that matches the source verbatim fails `make verify-content` (ADR-0003,
check 5).

So "the whole guide" means **every teachable proposition the guide makes, in the game's own plain-language
bilingual words, each one cited to the passage it came from**. It never means the guide's sentences. That is
not a narrowing of the owner's request; it is the only form of the request this project is permitted to ship,
and it is worth stating at the top because the naive reading is a licence breach that would look like
diligence.

### The measurement, re-derived

Measured on this branch's tree at `6d12bbf`, which was `main` when this pass began and differs from today's
`main` (`248d724`) by `README.md` alone — so no claim, no question and no level document moved under any
number below. Measured against
`content/sources/discover-canada-2012-large-print.txt`, whose SHA-256 is
`fd51046981916115cc39b989e9eedd3ab2c5943aeb7e0fe4e237e13a0da7c836` — **equal to `extractedTextSha256` in
`content/sources/discover-canada.json`**, so this is the same extraction every claim in the corpus is granted
against. The method: collapse whitespace, unify curly quotes and dashes, strip the 128 page-number markers the
extractor prints after each page's text, then locate every `source.quote` in the corpus that cites
`discover-canada`, mark the characters it covers, and attribute every word to a page and thence to a chapter
through the register's `page`/`endPage` ranges.

| | Measured here | As given to me | Verdict |
|---|---|---|---|
| Guide length | 18,372 words (129 pages) | 17,623 words | Mine is ~750 higher; a tokenising difference, not a disagreement about the document |
| Claims citing the guide | **602** (498 questions, 59 quest dialogue lines, 45 level claims) | 580 | Same shape, slightly more; measured at a later commit |
| Distinct quotes | **541** | 527 | Agrees |
| Quotes locating verbatim | **529 of 541** | 503 | See below — the 12 are my artifact, not a defect |
| Word coverage | **8,515 of 18,372 = 46.3%** (44.1% of characters) | 7,872 of 17,623 = 44.7% | Agrees |
| Uncited words, all gaps | **9,857** | ~9,750 | Agrees |
| Uncited words in runs > 400 chars | **5,417 in 29 runs** | 5,522 in 31 runs | Agrees |

**The guide is small, and that is the finding that makes this ADR affordable.** 18,372 words is a long
magazine article. Nearly half of it is already paraphrased somewhere in this repository, bilingually, with a
verifier's grant against it.

A corroboration worth recording, because it says the page attribution above is sound rather than plausible:
this method puts *Canada's Economy* at **430 words**. ADR-0028 measured that chapter independently, two
months ago, by hand, at **431**.

**The twelve quotes that do not locate are not a defect, and I checked rather than reporting them.** Every one
of them contains either a hyphen the extractor broke across a line — `one-third`, `three-quarters`,
`hydro-electric`, `cutting-edge`, `self-respect`, `non-partisan` — or a quotation mark, and one
(`gov-08`) has a stray page marker sitting inside the sentence. My crude normalisation keeps punctuation;
`scripts/lib/claims.mjs` `containsRun` tokenises to words first, so it locates all of them. No citation in
this corpus is fabricated, and real coverage is a little above the 46.3% recorded.

### Where the uncited half actually is, and two corrections to what I was given

Uncited words, attributed by page to the register's chapters, with picture captions and the two study
apparatus blocks separated out:

| Chapter | Chapter words | Uncited | Caption-like | Worksheet/invitation | **Teachable remainder** |
|---|---|---|---|---|---|
| Canada's History | 4,722 | 3,112 | 791 | — | **2,321** |
| Canada's Regions | 2,037 | 793 | 76 | — | **717** |
| Canadian Symbols | 1,741 | 821 | 185 | — | **636** |
| Modern Canada | 1,751 | 963 | 225 | 150 | **588** |
| Who We Are | 1,320 | 492 | 157 | — | **335** |
| Federal Elections | 1,646 | 549 | 64 | 202 | **283** |
| How Canadians Govern Themselves | 928 | 282 | 28 | 4 | **250** |
| The Oath of Citizenship | 152 | 139 | — | — | **139** |
| Rights and Responsibilities | 741 | 123 | 16 | — | **107** |
| Canada's Economy | 430 | 122 | 61 | — | **61** |
| The Justice System | 501 | 58 | 46 | 3 | **9** |
| *Front matter, pp. 4–10* | — | 796 | 44 | — | *excluded, §3* |
| *Back matter, pp. 106+* | — | 1,607 | 65 | — | *excluded, §3* |
| **Total** | 18,372 | **9,857** | 1,758 | 359 | **5,446** |

**Correction 1: the largest genuine hole is *Canada's History*, not the North.** I was told the biggest block
was 1,781 words on the North — Inuit population, Inuktitut, territorial material. There is a 1,727-word
uncited run that begins at page ~104, and it is **mostly back matter**: it starts in the North's material and
runs straight through pages 106–129, which are contact lists, addresses and websites. Measured per page, the
North's own pages carry far less — p102 91 words, p103 85, p104 80, p105 102 — while pages 106+ carry 1,607
uncited words that are not teaching at all. The real concentration is *Canada's History*, where **2,321 words,
49% of the chapter, are uncited**.

This matters beyond tidiness. `docs/plan/slices.md` records slice 10 as a scope decision rather than a
solution: a level about Canada's regions set in the North either depicts the peoples of Inuit Nunangat or
removes them from a level about where they live, and this project has no reviewer who may say which. Had the
gap been concentrated there, this whole programme would have been blocked behind a review that cannot be
obtained. It is not. The bulk of the remainder is nineteenth- and twentieth-century history, symbols and
postwar material, none of which is blocked. What North and Aboriginal material the programme does reach still
passes `docs/content-review.md` like everything else.

**Correction 2: I could not reproduce an 845-word uncited block on Aboriginal and treaty rights.** No run in
the 29 matches that description, and *Rights and Responsibilities* has only 107 uncited teachable words in
total. I record this as **not reproduced** rather than refuted: it may have been a differently drawn boundary.
Nothing in this decision rests on it.

**A third finding, which confirms two earlier ADRs rather than correcting anyone.** The two thinnest subjects
are genuinely exhausted: *Canada's Economy* has **61** uncited teachable words left and *The Justice System*
has **9**. ADR-0028 refused to pad the economy chapter and widened the remit instead; `docs/plan/slices.md`
records justice stopping below 40 "by decision, not shortfall". Both hold up under measurement. **There is no
hidden reserve in the short chapters**, and any plan that assumed one is wrong.

### What teaching surface exists today, and why none of it can hold 5,446 words

| Surface | Unit | How much prose it holds | Who reaches it |
|---|---|---|---|
| Point of interest | exactly **one** `fact`, one blurb | one card of CLB-4 prose | a player who walks to it |
| Quest dialogue | one `factClaim` per line, 4–7 factual lines per quest | a line at a time | a player who accepts the task |
| Question card | a graded proposition, plus an `explanation` | two sentences, after answering | a player being assessed |
| Study | draws five questions from every bank, FSRS | none — it drills, it does not read | a player who opens it |
| Exam | 20 questions, 15 to pass | none | a player being assessed |

**There is no surface in this game on which a player can read.** Every route to the guide's material today is
either gated behind walking to a landmark or wrapped in an assessment. ADR-0057 measured the consequence
exactly: a level teaches six to eleven propositions, the ten levels teach 88 between them, and a player who
plays only levels "meets 75 of the 481 propositions in the game, and then meets the rest for the first time in
an exam". ADR-0057 §5 named that residual and declined to fix it, correctly, because it was ruling on
something else. **This ADR is the fix, and it is why the surface has to be new.**

## Decision

**The guide becomes readable in the game, on a Learn surface beside Study and Exam, organised by the guide's
own chapters. A chapter is a sequence of lessons; a lesson is an ordered sequence of passages; and a passage
carries exactly one proposition, one contiguous quote and one verifier's grant.** The prose is the game's own
bilingual plain language, never the guide's sentences.

Nine parts.

### 1. The surface: a third door, not a wider Study

Learn is a DOM reading surface, reached from the same menu that reaches Study and Exam. It lists the guide's
chapters; a chapter lists its lessons; a lesson is read. That is the whole of the interaction: no score, no
timer, no draw, no scheduler, nothing that must be completed, and nothing that unlocks.

**Why a third door rather than the other three routes**, stated against the options as they were put:

- **More points of interest and dialogue inside the ten levels** cannot hold this material, and ADR-0057
  already rejected the same idea for a tenth of the volume. A `pointOfInterest` carries exactly **one**
  `fact` — the schema says so, and ADR-0057 §1 refused to grow it into a paginated card. Every new stop is an
  art key, a reference entry, a licensed photograph, a blind `make verify-art` identification, and a charge
  against a level's ≤ 8 MB payload and its decoded-texture budget. 5,446 words of remainder against 35
  landmarks is roughly 155 words per landmark on top of what they say now, in portrait, one-thumb, on a card
  the player taps past. It also fails the owner's own test: the material would still only be reachable by
  walking to the thing, so a player who wants to read chapter 3 has to play chapter 3.
- **Extending Study** puts reading inside the one surface whose purpose is retrieval practice. Study's own
  contract, written in `app/ui/study-screen.ts` and `TN-STUDY`, is four rules — no timer, no score that
  follows the player, the player is never told how the questions were chosen, a short drill is stated rather
  than padded — and its state is `ready | empty | error | summary` over a drill the FSRS scheduler chose.
  Reading is not a drill: it has no answer to record, no interval to schedule, and no state the scheduler can
  hold. Bolting a reader onto it would give one screen two purposes and make `StudyState` a union of two
  unrelated machines. **Learn and Study are neighbours, and the useful relation between them is a link**: a
  chapter's end is the right place to offer a drill, and the drill is Study's, unchanged.
- **A second copy of the guide as free prose**, authored as long chapter text, is the option that looks most
  like the owner's sentence and is the one this ADR refuses hardest. §2 is why.

### 2. The unit, and the verification grain: a passage tells one proposition

**This is the load-bearing decision, and it is a decision about verification rather than about layout.**

A **lesson** is a content document: an id, a `chapter` naming one of the register's chapters, an `order`, a
bilingual `title`, and an array of **passages**. A **passage** is a bilingual `text` plus exactly one
`factClaim` — the same `factual` / `source` / `verification` block a blurb and a dialogue line already carry
(`common.schema.json#/$defs/factClaim`). One passage, one proposition, one contiguous `source.quote`, one
chapter, one page, one `asOf`, one `volatile` flag, one grant.

**Why the unit is the passage and not the lesson.** A lesson-sized unit — a chapter section under one
`source` block — would be the obvious shape and it destroys the only thing that makes this corpus
trustworthy. ADR-0003's check is *"quote the supporting passage as evidence; confirm the claim is entailed by
it"*. A single grant stretched over 400 words of prose and one quote is not a check a verifier can perform or
a reader can audit: the verifier would be attesting that a paragraph is "entailed" by a sentence, which has no
truth condition. The corpus's auditability consequence — every shipped claim carries the passage that supports
it — survives exactly as long as claims stay one proposition wide. **The guide gets longer on screen; the
claim does not get wider.**

**Passages require a stable `id`, and this is not decoration.** `scripts/lib/claims.mjs` keys every array step
on the path to a claim *by the item's `id` when the item's schema requires one, and by position otherwise* —
the fix recorded in its own comment, after a POI's grant survived the landmark moving because A4 was keying on
`/pois/2`. A lesson is the longest array of claims this project will have. Without required ids, inserting one
passage at the top of a chapter re-points every pointer beneath it and voids every grant in the lesson, and
two authors working one chapter would void each other's work on every commit. **With required ids, a grant
binds to its passage, an insertion voids nothing, and the two-commit author/verifier dance stays per passage.**
That is a boundary defect fixed in the schema before it exists rather than diagnosed later.

**What this makes cheap, and it is the reason the programme is possible at all.** Authoring a passage is not
research. 541 distinct propositions in this repository already name the sentence they rest on, and the
remainder is located by the measurement above to the page. The author's job is paraphrase, translation and
citation — ADR-0057 §2 said this about teaching claims and it is equally true here.

### 3. What "the whole guide" means, and what it excludes by name

**"The whole guide" is every teachable proposition in the eleven chapters the register lists, expressed in the
game's own bilingual words and cited.** It is a claim about propositions, not about words, and never about
reproducing pages.

**Excluded, by name, with the reason. This list is the point of this section: nobody may later read "whole" as
"every word" and ship a caption as a lesson.**

| Excluded | Words | Why |
|---|---|---|
| **The guide's own sentences, anywhere** | all of them | Crown copyright, no redistribution; and ADR-0003 check 5 fails verbatim wording. A passage paraphrases and cites. |
| **Front matter, pp. 4–10** | 796 uncited | "How to use this booklet", "About the citizenship test", "After the test", the table of contents. It is instructions about IRCC's process, not facts about Canada, and the game's own exam screens already say how the exam works. |
| **Back matter, pp. 106+** | 1,607 uncited | Contact lists, addresses, websites, further-reading lists. Not teaching; goes stale fastest of anything in the document; ADR-0016's clock would quarantine it perpetually. |
| **The study worksheet** — "HOW MUCH DO YOU KNOW ABOUT YOUR GOVERNMENT? Use these pages to take notes" | 205 | A blank form. The game **is** the exercise; reproducing a note-taking page as a lesson teaches nothing. |
| **The museum invitation** — "Want to learn more about Canada's history? Visit a museum or national historic site!" | 154 | A call to action, not a proposition. Nothing to entail, nothing to grade, and it dates. |
| **Picture captions, as lessons** | ~1,758 uncited | "Picture: (From Top to Bottom) Metis from Alberta. Cree dancer." A caption labels a photograph the game does not have. **Narrow exception, stated so it is not over-read:** nothing here withdraws a caption as a legal *citation*. ADR-0056 measured that two of the three guide-printed landmark names come from captions, and `pump-jack` rests on one. A caption may support a claim; it may not be a lesson. |
| **The Oath of Citizenship as recited text** | 152 (plus the French Oath) | The register's own `knownStaleness` says it: the cached Oath carries the June 2021 amendment **and** still swears allegiance to Queen Elizabeth the Second, in both languages, while the Sovereign is King Charles III. ADR-0003 calls this the trap the whole staleness register exists for. **The game must not print an Oath that is wrong about the monarch.** What the Oath *is*, what swearing it means, and that it recognises the Aboriginal and treaty rights of First Nations, Inuit and Métis peoples are teachable as propositions, volatile, and re-checked every run. The recitation is not. |
| **Verse quoted inside the guide** — "In Flanders Fields", the anthem's lyrics | ~240 | Reproducing verse is reproduction. A passage may teach *about* them — who wrote it, when it is recited — in the game's own words. |

**Excluded because it is already elsewhere: nothing.** A passage may rest on a proposition a level already
tells or a question already grades. §4 and §5 say why that is legal and why it is wanted.

### 4. The relation to ADR-0057: beside it, not instead of it

**ADR-0057 is untouched, unpaused and unabsorbed. Neither programme can do the other's job.** Said as
mechanism rather than as reassurance:

- **Learn cannot satisfy ADR-0057.** That rule binds an `answer` step's `questionPool` to propositions *the
  level itself tells*, and its gate reads `content/levels/*.json` and `content/quests/*.json`. A lesson is on
  neither. If a lesson could discharge a level's teaching deficit, a player who never opened Learn would be
  asked, inside a level, about something that level never said — which is the exact defect ADR-0057 exists to
  end. **No level joins ADR-0057 §6's covered list on the strength of a lesson**, and no ADR-0057 obligation is
  discharged, delayed or re-dated by anything here.
- **ADR-0057 cannot satisfy this.** Its programme is 64 to 126 claims, bounded by what ten quests can say on
  the way past ten levels' landmarks and by each level's subject remit. The remainder is 5,446 words. ADR-0057
  §2 is explicit that a level's teaching is finite and that a strained claim is worse than an honest silence.
- **They do not contend for a file.** ADR-0057's author edits `content/quests/*.json` and
  `content/levels/*.json`. This programme's author edits `content/lessons/**`. That separation is deliberate
  and it is the reason lessons are their own documents rather than a longer `dialogue` array: two content
  programmes running concurrently over one file is a boundary defect, and it would show up as A4 grant
  voiding — every lesson commit unbinding a quest line's grant, and vice versa.
- **Where both want the same proposition, they cite the same sentence.** A lesson passage teaching something a
  quest line also teaches uses the same `source.quote`, so the two are mechanically recognisable as one
  proposition by `sharesProposition` in `app/application/content/proposition.ts`. This costs nothing and buys
  the ability to measure what Learn adds over what the levels already say.
- **Order of work: ADR-0057 first.** It closes a live defect — questions asked about things never taught — and
  carries dated obligations from 2026-12-17. This is additive: nothing is broken today because Learn does not
  exist. A content owner choosing between them chooses ADR-0057.

### 5. ADR-0028 and ADR-0030 hold, and a lesson is organised by chapter for that exact reason

**A lesson passage is a *told* claim.** By ADR-0030 §1 it therefore enters **no ship floor, no exam row and no
schedule**, because those three count graded propositions, and a graded proposition is one a question's prompt
asks and its `correctIndex` keys. A passage has no prompt, no options and no key. It cannot make a proposition
count twice, which is the harm ADR-0028 §4's gate protects against.

**A lesson has a `chapter` and deliberately no `subject`.** This is the one place where the guide's own
organisation is the right one, and it follows from ADR-0028 rather than contradicting it. A subject is a
teaching remit and a chapter is only where the sentences are; the relation is many-to-many. Giving a lesson a
subject would force an author to decide which remit owns a paragraph the guide simply prints — re-running
ADR-0028's argument in a new place, and putting a second, weaker answer next to the one that already exists.
Organising the reader the way the document is organised also happens to be what the owner asked for: *"it's all
on the study guide"*.

So the invariants survive intact, and it is worth writing out which:

- **Two subjects may share a chapter but never a proposition** — unaffected. Lessons grade nothing, so they
  are not in the compared corpus. `a-proposition-belongs-to-one-subject.test.ts` already selects graded items
  **by shape** (`kind === 'question'`) rather than by directory, after ADR-0030's G4, so a new directory full
  of told claims cannot silently widen or narrow it. That earlier decision is what makes this one cheap.
- **A subject owns what it grades, not what it tells** — this ADR is an unusually large instance of it, and
  nothing more.
- **A level's `subject` is the remit of its quest and its bank** — unchanged; Learn is not on a level.

### 6. The floor and the exam do not move

**The thirty-verified-questions-per-subject floor is unchanged, and no lesson counts toward it.** The floor is
a property of the learner's experience of a *subject*: `study.drillSize` is 5 and the scheduler is FSRS, so
thirty is six distinct drills before the first repeat (ADR-0028 §1). Passages are not drawable, so a subject
"reaching thirty" partly on reading material would hand the scheduler a bank it cannot draw — the floor would
pass and the drill would be short. **Counting told claims toward a graded floor is the one change here that
would actively break something**, and it is refused outright.

**The exam is unchanged.** It mirrors IRCC — 20 questions, 15 to pass, 30 minutes — and draws across every
subject with a bank. ADR-0057 §5 already ruled that Study and the exam are where the *player* asks, and Learn
is the clearest case of that in the game: the player opened a chapter and read it. Nothing about having read a
lesson may change what the exam draws, what it scores, or how its by-subject rows are computed.

**What does change, and it is the benefit:** ADR-0057 §5's named residual — a player who plays only levels
meets a minority of the propositions in the game and meets the rest for the first time in an exam — stops
being unavoidable. It is not fixed by a gate; it is fixed by there being somewhere to read.

### 7. Offline, payload and the budgets

**Reachable offline, and it must not touch the initial payload.**

- **Bundling.** Lessons are bundled the way every other content family already is: one `import.meta.glob` in
  an adapter, resolved by the bundler, exactly as `app/adapters/content/question-catalog.ts` does for
  questions and `app/adapters/phaser/level-catalog.ts` does for levels. **Per chapter, lazily imported** — one
  dynamic import per chapter, never a single module holding all eleven. A reader who opens *Canadian Symbols*
  fetches *Canadian Symbols*.
- **The initial payload is unchanged.** ADR-0034's worker precaches the shell and every code chunk — 30 files,
  3.46 MB against the 8 MiB ceiling `deploy-check` holds. A lazily imported chapter is a chunk fetched on
  first open, not part of the shell, and the worker caches it then, the same way it caches a level's art the
  first time that level is played. **A chapter read once is readable offline for ever after.**
- **The size, estimated honestly.** 498 question documents occupy 2.0 MB on disk, about 4 KB each, and a
  question carries four options, an explanation and two blocks. A passage is smaller. At roughly 1.5–2 KB per
  passage, a complete eleven-chapter corpus of 700–900 passages is **1.1–1.8 MB of JSON on disk**, a few
  hundred kilobytes over the wire per chapter after compression. That fits, and it is not free: the number to
  watch is the *total* ≤ 100 MB budget, which this barely moves, and the *initial* ≤ 8 MB, which it must not
  move at all.
- **No texture memory, no level payload.** Lessons are text. The ≤ 64 MB decoded texture budget per level and
  the ≤ 8 MB per-level payload are untouched — which is the sharpest practical advantage over putting this
  material on landmarks, where every sentence would arrive attached to a drawing.

### 8. The seam: where each piece lives, and why no two agents share a file

Stated as boundaries because that is this document's job. **No code is written by this ADR** (§Consequences).

| Layer | What is added | Rule it obeys |
|---|---|---|
| `content/lessons/<chapter>/*.json` | the lessons, and a new `lesson` schema beside the others in `content/schemas/` (the obligation below writes it; it does not exist yet) | every content file declares `$schema`; unknown properties rejected |
| `app/domain` | **nothing** | a lesson is data, not behaviour; ADR-0008 — a port exists when something calls it |
| `app/application/ports` | a lesson-reading capability on the content port: list chapters, load one chapter's lessons | ports are interfaces only; no DOM, no Phaser |
| `app/application` | chapter/lesson ordering and the shippable-passage filter | imports `domain` and `common` only |
| `app/adapters/content` | the `import.meta.glob` catalogue, per chapter | adapters never import each other |
| `app/ui/learn-*.ts` | the reading screen | DOM only (ADR-0005); never imports an adapter or a scene |
| `app/bootstrap` | wiring | the only place concretes are wired |

**The filter is application's, not the screen's.** Only passages whose `verification.status` is `verified` for
the current `sourceHash` are readable — `rejected` and `quarantined` are excluded from the build like every
other claim. A lesson that loses a passage to quarantine **renders without it**, silently, never a placeholder
and never an error, exactly as ADR-0052 §4(b) requires of a missing copy row. **A lesson with no shippable
passages must fail the build rather than render an empty screen** (ADR-0024).

**Accessibility is a new surface and a real cost, not a free rider.** This is the first long-form reading
screen in a game whose other screens are cards. What it owes: a heading structure a screen reader can
navigate, reading order that matches visual order, the canvas `aria-hidden` as everywhere else, 44 pt targets,
text scaling to 200% without reflow damage, the dyslexia-friendly font toggle, high contrast, no timer, and
axe-core in CI like every other DOM screen. **The single-switch case is the one that needs designing rather
than inheriting**: "tap anywhere advances" is a rule written for cards, and a chapter is not a card. A switch
user needs a way through a long document that is not one tap per line. That is named here as owed, not solved
here, because it is a design question for the story and the a11y owner.

### 9. What a gate can hold, and what it cannot

**It can hold the shape.** Specified enough to build:

1. Every lesson validates against `lesson.schema.json`; `chapter` is one the register lists; every passage's
   `source.page` falls inside that chapter's `page`/`endPage` range (the check
   `questions-cite-a-cached-source.test.ts` already performs for questions).
2. Every passage carries a non-empty `id`, unique within its lesson, so A4 binds per passage (§2).
3. Every passage is a `factClaim` with `factual: true`, EN and FR present (structural — `localizedText`
   requires both), and the contiguity, verbatim, banned-term and 180-day checks `scripts/lib/claims.mjs`
   applies to every claim by shape.
4. No chapter is empty, and no lesson has zero passages (ADR-0024).
5. `(chapter, order)` is unique, so a chapter's lessons have one reading order.

**What it cannot hold, written so its silence is not read as coverage (ADR-0019's third test).**

- **Whether the guide is *covered*.** "The whole guide" is the request, and **no gate can say a proposition is
  missing**, because nothing in this repository enumerates the guide's propositions — the document is the only
  enumeration, and it is `committed: false`, so the coverage measurement in Context **cannot run in CI**. It
  is re-derivable by anyone holding the bytes at the recorded hash, which is the standard ADR-0003 sets and
  the same standing condition ADR-0056 recorded for its own measurement. Completeness is therefore held by a
  repeated local measurement and an obligation, not by a green build.
- **Whether a passage teaches.** ADR-0057 §6 named this residual for teaching claims and it is identical here:
  a true, dull, unteaching sentence passes every check. It belongs to the author's brief. A
  `verification.status = "verified"` on a passage means the claim is true and entailed by the cited passage,
  and **not** that the passage teaches, and not that it reads well in sequence with its neighbours.
- **Whether a lesson reads as a lesson.** Sequence, transition and coherence across passages are editorial.
  A machine sees an array.
- **Paraphrase, in both directions.** ADR-0028 §4 settled that no string identifies a paraphrase, so two
  passages restating one proposition from two different sentences read as two propositions, and one sentence
  carrying two propositions reads as one.
- **CLB 4.** Reviewed, never measured.

## What this makes impossible

- **Shipping *Discover Canada*'s own sentences as the game's teaching text**, under any reading of "the whole
  guide". §Context, §3.
- **A caption, a worksheet, a further-reading list, a contact address or the Oath's recitation becoming a
  lesson.** §3, by name.
- **A grant that covers more than one proposition**, or a lesson-sized `source` block. §2.
- **A passage's grant being voided by an insertion elsewhere in its lesson.** §2, required ids.
- **A lesson discharging a level's teaching deficit**, or a level joining ADR-0057's covered list on one. §4.
- **A told passage counting toward a subject's floor of thirty, an exam row, or the scheduler.** §5, §6.
- **Learn entering the initial payload**, or a single module holding every chapter. §7.
- **An empty chapter or an empty lesson rendering as a pass.** §8, §9.

## Alternatives considered

- **More points of interest and dialogue inside the ten levels.** Rejected as the home for this material,
  though it remains the right home for ADR-0057's programme. Every stop is art, a reference entry, a licensed
  photograph, a blind identification run and texture budget; a POI carries exactly one `fact`; and ADR-0057
  §1 already refused to grow a blurb into a paginated teaching card. Decisively, it leaves the material
  reachable only by walking to it, so "the whole guide in game" would mean "play all ten levels to read all
  eleven chapters".
- **Extending Study.** Rejected: Study is retrieval practice with an FSRS draw and a four-rule contract, and
  reading has no answer, no interval and no state it can hold. It would give one screen two machines. Kept as
  the neighbour Learn links to.
- **A new readable surface holding free-form chapter prose, authored as long text with a citation per
  chapter.** Rejected, and this is the closest call, because it is the most literal reading of the owner's
  sentence. One grant over 400 words has no truth condition a verifier can check; it would end the property
  that every shipped claim carries the passage supporting it; and the first stale sentence would quarantine a
  whole chapter instead of one passage. §2. The surface is adopted; the unit is not.
- **Put the remainder into the question banks instead — author 200–350 new questions.** Rejected: it answers
  "we need much more learning content" with more assessment, which is the opposite of what was asked twice.
  It would also grade propositions nobody teaches, forcing them into some subject's remit and colliding with
  ADR-0028's exclusivity rule for no learner benefit. Some of the remainder will make good questions later;
  that is not this decision.
- **Make the Learn surface a rendering of the existing 541 claims, with no new authoring.** Attractive because
  it is nearly free, and rejected: blurbs and dialogue lines are written for the place they are spoken — "here",
  "this river", "the capital of this territory" (ADR-0030 §5) — and a question's explanation is written to
  correct a distractor. Assembled into a chapter they would read as a list of fragments about landmarks. The
  reuse that is real is the *research*, not the prose (§2).
- **Organise Learn by the game's ten subjects rather than the guide's eleven chapters.** Rejected: it forces
  every paragraph of the guide into a remit, re-running ADR-0028's many-to-many argument in a second place,
  and the owner's own words point at the guide's organisation.
- **Gate coverage of the guide in CI.** Not available: the extraction is `committed: false` under Crown
  copyright. Held by a re-derivable measurement and an obligation instead. §9.
- **Ship the whole corpus in the initial bundle for simplicity.** Rejected against the ≤ 8 MB initial payload
  and the 6-second time-to-play; a chapter nobody opens should not be downloaded before the title screen.
- **Defer all of this until ADR-0057's programme finishes.** Rejected as a *decision*, accepted as a *work
  order*: §4 says ADR-0057 goes first, but writing this ADR now is what stops the ADR-0057 authoring pass from
  quietly inventing a second teaching unit in quest dialogue when it runs out of room. An ADR is written
  before the content exists, which is the only time it can shape it.

## Consequences

- **The largest content programme in this project's history, and it is paced by the verifier.** Two bounds,
  both derived from the measurement rather than guessed:
  - **Floor — the gap alone: about 200 to 350 new passages.** 5,446 teachable uncited words, against a mean
    cited quote length of 15.7 words (8,515 covered words over 541 distinct quotes). The remainder is less
    proposition-dense than the cited half — it holds verse, honours rolls and event lists — so the low end is
    likelier than the high.
  - **Ceiling — a readable guide: about 740 to 900 passages.** A chapter with holes exactly where the levels
    already taught is not a chapter, so Learn restates the 541 propositions already cited in its own
    reading prose, plus the remainder. Each restatement is a new authored paraphrase and a **new grant**: the
    existing grant belongs to a question's explanation or a landmark's blurb, not to the passage.
- **Every passage is bilingual, and what that doubles is authoring and review, not grants.** EN and FR are
  structural — `localizedText` requires both and `make validate-content` fails the file without them — so the
  words double, the plain-language review doubles, and ADR-0003's check 4 (the French is a faithful
  translation) runs per passage. **The grant does not double**: one `verification` block covers the claim in
  both languages. A programme of 840 passages is therefore roughly 840 grants and something like 1,700
  language-units of authored prose.
- **`make verify-content` will be red often and briefly, by design.** The author writes passages with
  `verification` in the null form; the verifier grants them in a **separate commit**, because within one
  document one commit may not both author a claim and grant its verification (ADR-0003's amendment). At
  10–20 passages per lesson document, a complete corpus is roughly 50–80 lesson documents and therefore
  **100–160 commits**, alternating author and verifier, with the build red between each pair. That is the
  separation of duties working, and it is not a reason to batch the two into one commit.
- **Staleness costs scale with the corpus, and one chapter is blocked.** Every passage carries `asOf` and a
  `volatile` flag; flagged regions are re-verified every run and quarantined at 180 days (ADR-0016). A
  700-passage corpus is a standing re-check obligation an 800-question corpus does not yet have at this size.
  **Canada's Regions cannot be authored first**: ADR-0028 already carries an open obligation on
  `content-verifier` to live-check that chapter and record page-grain staleness entries before content cites
  it, and it is where a 2012 guide keeps its most perishable facts.
- **Nothing in the game changes today.** No code, no schema, no port, no content, no copy in this commit —
  only this ADR and the plan. `npx depcruise app common --config .dependency-cruiser.cjs` reports no
  violations before and after, because nothing in `app/` moves.
- **A new a11y surface is owed a design**, and the single-switch route through a long document is the part
  that is genuinely new (§8).
- **The measurement in Context must be re-run to know whether the programme is finished**, because no gate can
  say so (§9). That is an obligation below, not a hope.

### Rules stated here that no gate can express

- **Whether the guide is covered.** §9. The extraction is `committed: false`; completeness is a re-derivable
  local measurement.
- **Whether a passage teaches, and whether a lesson reads as one.** §9. The author holds both; a verifier who
  grants a true, dull passage has made no error under ADR-0003.
- **Whether a paraphrase in a lesson and a paraphrase in a quest line are the same proposition**, when they
  rest on different sentences. ADR-0028 §4.
- **Whether the prose is at CLB 4.** Reviewed, not measured.
- **Whether a passage excluded under §3 was excluded for the right reason.** "This is a caption", "this is a
  call to action" and "this is process rather than fact" are judgements. The list in §3 names the classes; the
  edge cases belong to the author and the verifier.

## Obligations

- ~~**OBLIGATION due=2026-11-18 owner=architect** — write the `lesson` schema into `content/schemas/` and the port
  addition in §8 before any lesson is authored, to §2's unit: a lesson with `chapter`, `order`, bilingual
  `title` and a non-empty array of passages; a passage with a **required unique `id`**, bilingual `text` and
  exactly one `factClaim`; `additionalProperties: false` throughout. The schema is what makes A4 bind per
  passage, so it precedes the content rather than following it.~~
  **DISCHARGED 2026-09-18** — `content/schemas/lesson.schema.json` is written to §2's unit, with
  `additionalProperties: false` on the root and on the passage, `minItems: 1` on `passages`, and no `subject`
  — which `additionalProperties: false` is what actually keeps out, the same mechanism as the absent `level`
  on `sourceChapter`. `tests/unit/contracts/a-lesson-passage-is-known-by-its-id.test.ts` proves the claim this
  schema is written to make: over a fixture lesson, `claimKeys` keys each passage's grant `[id=…]`, a passage
  inserted ahead of another leaves that other's key unchanged, and a copy of the schema with `id` removed from
  `required` — the counterfactual — collapses the same lesson to positional keys and reports drift. It also
  runs the content gate's own ajv over a passage with no `id` (rejected), a lesson with none (rejected) and a
  lesson carrying `subject` (rejected).
  **Three things resolved differently from the wording above, each for a stated reason.** (1) The passage's
  block is `fact`, not `factClaim`: `factClaim` is the *`$def`* this obligation names, and `fact` is what the
  other three surfaces call that block, so a fourth name would read as a fourth thing. (2) **`factual: true`
  is not expressible here** and the schema says so rather than implying it — stating it needs a subschema
  naming `factual` beneath a property, which ADR-0007's rule against inline object shapes refuses, and
  duplicating `factClaim` to carry the constant would put lesson claims outside the recogniser that scopes
  every check they get. It is added to what the §9 gate owes, below. (3) **The port addition is the two
  document types and not the two methods.** ADR-0007 forced `LessonDocument` and `LessonPassage` into
  `app/application/ports/content-repository.ts` the moment the schema existed, and they are pinned to it
  property by property; `chapters()` and `lessons(chapter)` were **not** written, because ADR-0008 says a port
  exists when something calls it and nothing does — in a consumed file they would be dead members, which is
  ADR-0015's prune case rather than a marker case. The seam, and what its first implementer adds, is recorded
  in `docs/architecture.md` §6. No lesson content was authored: this is the contract only (ADR-0003).

- **OBLIGATION due=2026-12-18 owner=infra** — build §9's gates over `content/lessons/**`: chapter names
  resolved against the register, page ranges inside the cited chapter's span, unique passage ids, unique
  `(chapter, order)`, and no empty lesson or empty chapter (ADR-0024). It ships covering at least one
  authored chapter so it is not vacuous on its first run.

- **OBLIGATION due=2027-01-18 owner=content** — author the first chapter as a proving run, **not** *Canada's
  Regions* (blocked by ADR-0028's live-check obligation) and **not** the North material. *Canada's History* is
  the recommendation: it holds 2,321 of the 5,446 teachable uncited words and is where the programme's
  assumptions will break first if they are going to. Report what a chapter actually cost in passages, words
  and hours against §Consequences' estimate, so the remaining ten chapters are planned against a measurement
  rather than against this ADR's arithmetic.

- **OBLIGATION due=2027-01-18 owner=content-verifier** — grant or refuse every passage authored under the
  marker above, in commits separate from the author's, against the `sourceHash` each cites, quoting the
  passage as `evidence`. Refuse any passage whose sentence is not in the cited chapter at that hash, any that
  is verbatim, and any drawn from a class §3 excludes.

- **OBLIGATION due=2027-01-18 owner=ui-a11y** — decide how a single-switch player and a screen-reader player
  move through a chapter, and record it in the story that carries the Learn surface. "Tap anywhere advances"
  is a rule for cards; a chapter is not a card (§8).

- **OBLIGATION due=2027-03-18 owner=architect** — re-run Context's measurement over the tree as it then
  stands and record, in an amendment to this ADR, the word coverage and the teachable remainder by chapter.
  If coverage has not moved, say what was tried rather than letting the markers lapse (ADR-0009). This is the
  only instrument that can tell anyone whether "the whole guide" has been reached, and it cannot run in CI.

## References

- The product owner's words, quoted in Context: much more learning content; it is all on the study guide; the
  whole study guide in game — and the two earlier rulings that bind the sourcing
- ADR-0003 (the citation, the author/verifier split, the five checks, gate A4 binding a grant to its claim's
  unit, and the Oath's staleness trap), ADR-0016 (`volatile`, the 180-day clock, banned terms)
- ADR-0028 §1, §2 and §4 (the thirty floor and what it is for; a remit is not a chapter; the proposition is
  identified by its quote; the live-check obligation on *Canada's Regions*), ADR-0030 §1, §2 and §5 (a subject
  owns what it grades; told claims are outside the rule; a quest's lines are bound to the place they are said)
- ADR-0057 (a level asks only what it taught — the programme this one runs beside, §4), ADR-0056 §2 and §3
  (what a POI teaches is the guide's; a caption as a citation), ADR-0048 (a stop asks only what it told),
  ADR-0052 §4 (a missing row draws nothing; what a verified status does and does not mean)
- ADR-0005 (layers; `app/ui` is DOM only), ADR-0008 (a port exists when something calls it), ADR-0010 (a
  locale bundle may not carry a claim about Canada — which is why lesson prose is content, not copy),
  ADR-0019 (name what a rule does not measure), ADR-0024 (an empty collection must not reduce to a pass),
  ADR-0034 (the worker caches a level whole; the precache budget), ADR-0009 (the obligation format above)
- `content/sources/discover-canada.json` (the register, its chapter ranges, `committed: false`, the licence),
  `scripts/lib/claims.mjs` (`containsRun`, `DOCUMENT_SCOPE_FIELDS`, and the id-not-position keying §2 relies
  on), `app/application/content/proposition.ts` (`sharesProposition`)
- `app/adapters/content/question-catalog.ts` and `app/adapters/phaser/level-catalog.ts` (the
  `import.meta.glob` pattern §7 follows), `app/ui/study-screen.ts` (Study's four rules and its state machine),
  `app/application/use-cases/study-session.ts` (`loadEveryBank`), `app/application/use-cases/exam-session.ts`
- `docs/plan/slices.md` — slice L4, and slice 10's recorded scope decision about the North
