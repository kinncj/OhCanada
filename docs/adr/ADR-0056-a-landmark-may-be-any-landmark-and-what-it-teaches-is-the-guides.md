# ADR-0056: A landmark may be any landmark, and what it teaches is the guide's

- Status: Accepted (2026-09-17)
- Settles: what a point of interest may **be**, what it may **be called**, and what it may **teach**. Three
  questions a reader has been resolving from ADR-0051 by analogy, and getting wrong in the safe direction.
- Narrows nothing in ADR-0051 and loosens nothing in ADR-0003 or ADR-0016. A territory statement is
  untouched; see §5, which exists because a reader will otherwise assume this reverses that ADR.
- Slice: L1 / L1a (`docs/plan/slices.md`), whose *L1 gap list* this ADR reclassifies. See §6.
- Numbering. `main` holds ADR-0001…ADR-0049 and ADR-0051…ADR-0055; 0050 is spent by a draft on branch
  `multi-nation-source` that was dropped and never merged, and 0038 is a hole nothing ever occupied. **0056
  is the first number above the high-water mark across every ref this repository can see**, taken rather
  than the free hole at 0038 for the reason ADR-0052 recorded and ADR-0053 restated: a number is retired by
  having been used, and an ADR filed below the ADRs it builds on reads as older than them for ever. The two
  bare numbers in this paragraph carry no `ADR-` prefix on purpose — the contract gate in
  `tests/unit/contracts/documents-name-real-schemas.test.ts` resolves every `ADR-NNNN` token to a file in
  `docs/adr`, and it has gone red on citations of records nobody can open.

## Context

### The ruling

The product owner ruled on what a point of interest may be, in three parts, over one exchange:

> landmarks that aren't in the guide can still be a POI in the game just to show extra learning content…
> the goal is to learn and educate people.

and, when that was read back as *"a POI may teach material the guide does not contain"*:

> correct, the content is just what's present on the guide… it should not prevent us from using iconic POIs
> to show the content.

and, on how closely a landmark and its lesson must match:

> if it matches to have a POI with a content related to that POI, that's great… else, it is still ok.

**The line is not what a POI may teach. It is what a POI may be.** An iconic landmark is the *stage* for
guide content, never a licence for content from elsewhere. That first reading — that this opened a new
class of non-guide-sourced teaching content — was put to the owner and corrected before it reached this
file, and it is recorded here because it is the reading the next person will arrive at on their own.

### The ruling this one lands beside, and why it looks like a reversal

The same owner ruled, a day earlier:

> literally use the names from the official guide. that's all… all the study materials should be from the
> official guide.

That is ADR-0051, and it produced a round of content work: ten territory statements now cite *Discover
Canada* alone, nine name no people, and place names the guide does not print were removed from them.

A reader who has just done that work will read today's ruling as its reversal. It is not. The two rule on
two different objects, and §5 says so in full.

### What is actually on the tree, measured

Measured here against `content/sources/discover-canada-2012-large-print.txt`, 131 717 bytes, whose SHA-256
**equals the `extractedTextSha256` in `content/sources/discover-canada.json`** — so this is the same
extraction every claim in the corpus is granted against, not a different copy of the guide. The register is
`committed: false` (Crown copyright, ADR-0003), so this measurement ran where the bytes are and **cannot run
in CI**; that is the standing condition on every text check in this project, not a gap this ADR introduces.

Ten level documents carry **35 points of interest**. (ADR-0036's consequence says 36 and ADR-0048 says 35;
35 is the number on the tree today, and the stray 36 is noted here rather than corrected in that ADR.)

**Display names — 3 of 35 are printed by the guide, and none of the three is body prose.**

| POI | What the guide prints | Where |
|---|---|---|
| `pump-jack` — "Oil pump jack" | "Oil pump jacks in southern Alberta." | a picture caption, p. 90 |
| `parliament-hill` — "Parliament Hill" | "Parliament Hill, Ottawa." | a picture caption |
| `library-of-parliament` — "The Library of Parliament" | "…found online at the Library of Parliament at www.parl.gc.ca", and again in a list of federal bodies | the further-reading list — **the institution's website, not the room in the Centre Block** |

The other **32 do not appear at all**: `cn-tower`, `pier-21`, `canada-place`, `nathan-phillips-square`,
`human-rights-museum`, `streetcar`, `yukon-river-sternwheeler`, `peggys-point-light`, `chateau-frontenac`
and 23 more.

**Two corrections to the survey that prompted this ADR**, both found by re-running it rather than citing it:

- **`chateau-frontenac` is not in the guide.** It was reported as the one display name that is. The
  extraction contains "Frontenac" twice and both are **Count Frontenac**, the governor — *"outstanding
  leaders like Jean Talon, Bishop Laval, and Count Frontenac built a French Empire in North America"*. The
  hotel is absent. So the count of guide-printed display names is three, not one, and the three are a
  caption, a caption and a bibliography entry.
- **"Peggy's Cove" *is* in the guide**, once, as a picture caption — *"Peggy's Cove harbour, Nova Scotia"*,
  p. 94. The POI standing there is `peggys-point-light`, "Peggy's Point Lighthouse", which is not.

**Blurb prose — every proper noun in all 35 blurbs is printed by the guide.** Every capitalised phrase in
every English blurb was extracted and searched. Six apparent misses were inspected and all six are artefacts
of the extractor running a phrase across a sentence boundary — `Scotia's` (because "Nova" began the
sentence), `Canada: the Pacific`, `North the Land of the Midnight Sun`, and three forms of
`Second World War Canada's`. There is no real miss.

So the corpus **already draws the line this ruling confirms, and then draws a second one nobody decided**:
names label freely, and prose has been held to the guide absolutely — including the names inside it.

### What that costs the player, concretely

Because a blurb may not use a word the guide does not print, 32 of 35 cards talk about the level's subject
without ever naming the object the player just tapped:

| The player taps | The card says | It never says |
|---|---|---|
| the CN Tower | "Toronto is the largest city in Canada. It is also the country's main centre for banks and finance." | CN Tower |
| Pier 21 | "People often call Canada a land of immigrants…" | Pier 21 |
| Canada Place | "Canada's flag flew for the first time in 1965…" | Canada Place |
| the Canadian Museum for Human Rights | "In Canada the law applies to everyone." | the museum |
| Nathan Phillips Square | "Most people in Canada live in cities and towns near the Great Lakes…" | the square |

The heading over the card is the landmark's name, so the game names the thing in the title bar and then
writes four sentences that avoid saying it. That is the shape of a rule nobody chose: it was inherited from
"names come only from the guide", which was a ruling about **whose territory this is**.

### What no gate says about any of this

`scripts/lib/claims.mjs` applies the quote-contiguity, evidence-floor, verbatim, banned-term, page-range and
180-day checks to a blurb by shape. **Not one of them reads a proper noun.** A blurb that names its own
landmark passes `make validate-content` and `make verify-content` today and always would have. What held the
stricter line was review practice and a reasonable reading of ADR-0051 — which is exactly the class of rule
this project keeps finding: held by belief, checked by nothing, and stricter than anyone intended.

## Decision

**A point of interest may be any landmark, iconic or not, named by the guide or not. What it teaches is the
guide's. Its name is a label on a thing the player is looking at, not a claim about Canada.**

### 1. Existence and name are not gated by the guide

A landmark earns its place in a level by being **recognisable** — by being the thing a player standing in
Toronto or Halifax expects to see — and by giving a lesson somewhere to happen. *Discover Canada*'s silence
about it is not an objection, because the guide is a study guide, not a gazetteer of what exists in Canada.

**Why a label is not a claim**, stated so it is not re-argued:

- A name is **deixis**. It points at the object in front of the player, who can see it. "This is the CN
  Tower" asserts what the thing is called; it does not assert anything about Canada, and it is not on the
  citizenship test in either direction.
- Its truth condition is a different one, and it is already held elsewhere. A landmark's name is true if it
  is what that thing is called and if the art depicts that thing — which is `assets/refs/references.json`,
  the licensed photograph the art was drawn from, and the blind `make verify-art` identification. None of
  that is *Discover Canada*'s to settle.
- The schema already says this. `level.schema.json#/$defs/pointOfInterest` gives `name` a plain
  `localizedText` and puts the `factClaim` on **`fact`, which is about the blurb** — "Whether the blurb
  states a fact about Canada". The claim is scoped to the sentence, not to the label, and has been since the
  shape was written. This ADR ratifies that rather than changing it.

### 2. What a POI teaches is guide-sourced, and nothing here loosens that

The blurb's factual content is *Discover Canada* material, on exactly the terms every other study material
in this project is held to. Said as three refusals, because this is the half a well-meaning reader will
erode:

- **ADR-0003 is untouched.** Every factual blurb cites a cached source with a `sourceId`, a chapter, a page
  and a contiguous `source.quote`, and a verifier grants it against that hash. Nothing here lets an
  unsourced sentence ship, and there is no new class of citable source.
- **ADR-0016 is untouched.** A blurb drawn from a flagged region is `volatile` and is re-checked every run;
  180 days still quarantines it.
- **"Iconic" is a reason to place a landmark. It is never a reason to say something.** A landmark the guide
  has never heard of teaches guide material anyway — that is the whole of the ruling.

### 3. The seam: a blurb may name its own landmark, and may claim nothing more

**A blurb may name the landmark it belongs to, in its prose, in both languages, whether or not the guide
prints that name.** This is the one thing on the tree that changes.

**The test, and it is one line.** *Strike the name out. If what is left states exactly what the cited
passage states, the name was a label. If striking it changes what is being claimed, it was a claim, and the
guide must make it.*

| Written | Verdict |
|---|---|
| "This is the CN Tower. Toronto is the largest city in Canada and the country's main financial centre." | **Legal.** Strike "the CN Tower" and the claim is unchanged — it is p. 99's sentence. |
| "Pier 21 is where newcomers landed. Canada is often called a land of immigrants…" | **Legal**, if "where newcomers landed" is the level's own placement of the art and not offered as a fact about Canada — and **illegal** the moment it carries a number, a date or a role. See the next row. |
| "Pier 21 is where one million immigrants first set foot in Canada." | **Illegal.** True, and not in the guide. Striking the name leaves a claim the cited passage does not make. |
| "The CN Tower is the tallest free-standing structure in the Americas." | **Illegal**, for the same reason, however iconic the landmark. |
| "The Canadian Museum for Human Rights opened in 2014." | **Illegal.** A date is a claim. |

**What still may not appear, listed so the permission is not read as general:** a date, a height, a
superlative, a first, a founding, a role in Canadian history, or any other claim about Canada that the guide
does not make — attached to the landmark or to anything else. The permission is to **say what the thing is
called**, and it stops there.

**What the verifier checks on a blurb that names its landmark**, added to the checks it already runs:

1. the name names the thing the level depicts — the art's subject entry in `assets/refs/references.json`;
2. everything else in the blurb is entailed by the cited passage, unchanged from today.

The name itself needs **no evidence from the guide**, and a verifier must not ask for one. Demanding a guide
citation for a label is the defect this ADR exists to remove.

**Re-pointing or re-naming a blurb voids its grant, by design.** Blurb prose is an author field inside the
claim's unit, so gate A4 unbinds the verification when it changes (ADR-0003). The author edits the text and
**leaves the `verification` block exactly as it stands**; the verifier re-grants in a separate commit. That
is the same two-commit dance ADR-0051 set out, and it is not a reason to avoid improving a blurb.

### 4. Study and exam questions stay guide-only — consistently, not as an exception

Every question in the bank and every question in the exam rests on a *Discover Canada* proposition. The
reason is the product's purpose rather than a sourcing preference: the exam mirrors the real test
(`CLAUDE.md`, Purpose), IRCC's own sentence is cached in the register — *"All the citizenship test questions
are based on information provided in this study guide"* — and a question drawn from outside the guide would
mark a learner wrong against the document they are examined on, or teach them something the exam will never
ask. ADR-0028's Context records two concrete traps already caught this way.

Under the corrected ruling this is no longer an exception that needs squaring. **Blurbs and questions have
the same sourcing rule.** What differs is only what a *name* is allowed to do in each, and a question has no
landmark standing in front of the player to point at.

**How it squares with ADR-0028 and ADR-0030**, since both were raised:

- ADR-0028's "a subject draws from wherever in the guide its material appears" is about *where in the
  guide* a remit may reach. It is untouched: a POI's blurb draws from the guide, and a POI's level draws
  its questions from its subject's remit.
- **May a POI that teaches beyond the guide be the subject of a question?** The question does not arise,
  because no POI teaches beyond the guide. The deeper answer is that **a question is never about a landmark
  at all** — it is about a proposition (ADR-0028 §4, ADR-0030 §1). A landmark can be the *occasion* of a
  question only insofar as a guide sentence carries the proposition, and its name never enters the question.
- **The rule that a landmark's blurb and its question rest on the same proposition is a preference in the
  draw, not a requirement on content, and it stays exactly as it is.** ADR-0036 §2.4 asks a question resting
  on the sentence the landmark just told **first**; ADR-0048 says that with no task step being played, a
  landmark asks that question **or nothing**. Neither obliges content to produce a match. That is the
  mechanism §6 rests on.

### 5. Territory statements are unchanged. ADR-0051 stands

Said plainly because a reader will otherwise ask, and because a quiet erosion here would be the worst
outcome of this ADR: **nothing above touches a level's `territory` block.** Every name in `nations` must
still be a name the source cited in `fact.source` prints for a people; `nations` may still be empty with
`nationsAbsentBecause`; `sourcePublisher` must still equal the register's publisher; the statement must
still be `factual: true`. No agent may cite this ADR to put a place name, a nation name or a treaty back
into a territory statement.

**Why the two rules differ, on the objects rather than on the authority:**

| | A landmark's name | A name in `territory.nations` |
|---|---|---|
| What it is | a label on an object in the frame | an assertion about **whose territory this is** |
| Can the player check it? | yes — it is drawn on the screen in front of them | no |
| Who is affected by getting it wrong | nobody; it is a wrong caption | the people named, or the people left out |
| What the panel does with it | draws it as the card's heading | prints it under a heading saying **Named in this statement** |

Deixis is available to a landmark and unavailable to a territory, because a player cannot see whose land
they are standing on. That asymmetry is the whole of the distinction, and it is why "the CN Tower" is free
and "the Mississaugas of the Credit" is not.

### 6. The L1 gap list is reclassified: most of it was never debt

`docs/plan/slices.md` carries 24 landmarks where no question in the level's subject rests on the sentence
the landmark tells, recorded as work owed to a content author and then a verifier. Under the owner's third
sentence — *"if it matches… that's great… else, it is still ok"* — **relatedness is a preference, not a
requirement**, and most of those rows are not defects. Three cases, and they get three different treatments:

| Case | What it is | What happens to it |
|---|---|---|
| **Best** | the guide says something about the very thing the player is standing in front of, and that is what the POI teaches — `pier-21` and immigration, `chateau-frontenac` and Champlain's 1608 fort, `human-rights-museum` and the law applying to everyone | nothing owed |
| **Acceptable** | the guide says nothing about this landmark, and the POI teaches guide material from its level's subject anyway | **stops being tracked as debt.** Not a defect, not a gap, no pass owed |
| **Never** | a claim the guide does not make, however well the landmark would carry it | refused, as it is today |

**The acceptable half is the larger one.** Of the 24 rows, **12** have no usable proposition in the level's
subject at all: the six marked *None found* (`warming-hut`, `grain-bins`, `combine-harvester`,
`bulk-carrier`, `footbridge`, `autumn-maple`) and the six marked *Skipped*, each of which was skipped
because writing the question would have graded one proposition in two subjects or put a second card on one
memory. Those twelve are the acceptable case and are now recorded as such.

**Saying so is the point of this section.** Left as debt, that list sends the next author hunting for a
match the guide cannot supply — and the way that hunt ends is a guide sentence stretched onto a landmark it
is not about, which is worse than the gap it closes, because it ships a strained claim instead of an honest
silence. ADR-0048 already made the silence safe: a stop with no task asks nothing at all rather than asking
something unrelated, which was the audit defect that produced that ADR.

**The opportunity half stays, and keeps an owner.** Where a granted question now rests on a sentence the
landmark could genuinely tell, and the blurb is still pointed at a different sentence, re-pointing the blurb
is a real improvement: it is what makes the stop ask about what it just told. Ten questions were granted on
2026-09-15 (`bb214b3`) and **no blurb has been re-pointed yet**. That is the obligation below.

## What this makes impossible

- **Refusing a landmark because the guide does not mention it.** There is no such ground. A landmark is
  refused for art licensing, for depiction review (`docs/content-review.md`), or for teaching something the
  guide does not say — never for being absent from a study guide.
- **Refusing a blurb for naming the landmark it belongs to.**
- **Reading "a POI may be iconic" as "a POI may teach from another source."** §2 is the answer, and the
  owner's own correction is quoted in Context so the reading has to argue with them, not with an agent.
- **Citing this ADR to put a name back into a territory statement.** §5.
- **Tracking the acceptable half of the gap list as content debt.** §6.

## Alternatives considered

- **Let a POI teach from a non-guide source, with a new sourcing policy saying what qualifies.** This was
  drafted and is rejected, and it is recorded because it was the first reading of the ruling and it is
  wrong. The owner's correction is explicit — *"the content is just what's present on the guide"*. It would
  also have been expensive in a way that is easy to miss: a second citable class means a second register
  discipline, a verifier judgement about publisher quality that no gate can make, and a player who cannot
  tell which sentences are the exam's and which are ours — in a product whose one job is to teach the exam.
  Nothing asked for it.
- **Keep the strict line: a blurb may print only words the guide prints.** This is the status quo and it is
  what 32 of 35 cards do today. Rejected: it is a rule nobody decided, inherited by analogy from a ruling
  about territory; it forces the card to avoid the noun in its own heading; and it is enforced by belief,
  since no gate reads a proper noun. A rule that costs the player clarity and buys no correctness is not a
  conservative choice, it is an unexamined one.
- **Permit the name only where the guide prints it.** Rejected on the measurement: that is three landmarks
  out of 35, and two of the three are picture captions. The rule would grant the permission almost nowhere
  and would make "is this word in a caption on p. 90" the test of whether a card may say what the player is
  looking at.
- **Permit a blurb to state uncontested facts about its landmark — an opening date, a height — since they
  are checkable.** Rejected, and this is the closest call in the ADR. Checkable is not the bar; **sourced
  and gradeable** is. Such a fact needs a source register, a hash and a staleness clock (ADR-0016) to be
  worth anything, at which point it is the rejected alternative above wearing a smaller hat. It is also the
  exact material a learner would mistake for exam content, sitting on the same card as exam content.
- **Delete the L1 gap list.** Rejected: the opportunity half is real work with a real benefit, and deleting
  the list would take the twelve acceptable rows' *reasoning* with it — each Skipped row records why a
  question there would have graded one proposition twice, which is the analysis that stops it being redone.
- **Gate the deixis test.** Not available; see below.

## Consequences

- **Thirty-two landmarks become nameable in their own prose, and none is obliged to be.** No blurb changes
  in this commit — this ADR writes no content. An author may now do it; the four cards in Context's table
  are where a player notices.
- **Every re-pointed or re-named blurb costs a verifier re-grant**, by A4, and `make verify-content` is red
  between the author's commit and the verifier's. That is the gate working, and the commits stay separate.
- **The plan's owed-content line gets shorter by twelve rows**, and the twelve that remain are an
  improvement rather than a defect. `docs/plan/slices.md` is updated in this commit to say so.
- **Nothing in the game changes today.** No schema, no port, no code, no content. The draw rules that decide
  what a stop asks (ADR-0036 §2.4, ADR-0048) are untouched, so a stop with no matching question still asks
  nothing — which §6 now records as a legitimate end state rather than a symptom.
- **`docs/content-review.md` §2 keeps governing a POI's `name` and `blurb` as depictions**, and that is
  unaffected: a landmark on a nation's territory, or one carrying cultural meaning, still goes through that
  document whatever this ADR says about the guide. This decision is about *Discover Canada*'s coverage, and
  it grants no depiction anything.
- **ADR-0036's "36 landmarks" and ADR-0048's "35" disagree, and 35 is right.** Not corrected in either file;
  recorded here so the next person counting does not think they have found something.

### Rules stated here that no gate can express

Named so the silence is not mistaken for coverage (ADR-0019's third test):

- **The deixis test is a judgement, not a check.** No gate can tell a label from a claim: "Pier 21 is where
  newcomers landed" and "Pier 21 opened in 1928" are the same shape to a machine, and both contain a proper
  noun the guide does not print. It is the verifier's call under §3, and the entailment check it already
  runs is the instrument. Writing a proper-noun allow-list would fail exactly backwards — it would refuse
  the legal case, which is the name, and pass the illegal one, which is the date.
- **Nothing checks that a landmark's name is what that thing is actually called.** The art reference and the
  blind `make verify-art` identification are the nearest thing, and they check the *drawing*, not the label.
- **"Related to the landmark" is not measurable.** §6 makes it a preference precisely because there is no
  string in this repository that says a sentence is about a building.
- **The measurement in Context cannot run in CI**, because the extraction is `committed: false` like every
  register here. It is re-derivable by anyone holding the bytes at the recorded hash, which is the standard
  ADR-0003 sets, and the hash equality is stated above so a re-run is a reproducible disagreement rather
  than a matter of trust.

## Obligations

- **OBLIGATION due=2026-11-17 owner=content** — re-point the blurbs on the opportunity half of the L1 gap
  list to the sentences the questions granted on 2026-09-15 (`bb214b3`) rest on, so each of those stops asks
  about what it just told. Author edits the blurb and **leaves the existing `verification` block untouched**;
  a verifier re-grants in a separate commit (ADR-0003, gate A4). `spruce-stand` needs nothing — the
  sternwheeler's quote already contains its sentence. If the date arrives with the work undone, re-date it
  with what was tried (ADR-0009) rather than letting it lapse silently; nothing is broken while it is open,
  which is exactly why it would otherwise be forgotten.

- **OBLIGATION due=2026-12-17 owner=content** — decide, blurb by blurb, whether each card names the landmark
  it belongs to, under §3's test, starting with the four measured in Context (`cn-tower`, `pier-21`,
  `canada-place`, `human-rights-museum`) where the card names the landmark in its heading and then avoids
  the word for four sentences. **Naming is permitted, not required**, so "reviewed and left as it is" is a
  complete discharge — but it must be a decision somebody made, in writing, and not the rule nobody chose
  that this ADR was written to end.

## References

- The product owner's ruling, quoted in Context: what a POI may be, the correction about what it may teach,
  and relatedness as a preference
- ADR-0003 (the citation, the author/verifier split, gate A4 binding a grant to its claim's unit),
  ADR-0016 (staleness, `volatile`, the 180-day clock), ADR-0051 (a territory statement names only what its
  source names — untouched, §5)
- ADR-0028 §4 (the proposition is the unit of exclusive claim), ADR-0030 §1–§2 (a subject owns what it
  grades, not what it tells; told claims are outside the rule)
- ADR-0036 §2.4 (a question resting on the landmark's own sentence is asked first), ADR-0048 (a stop with no
  task asks only what it told, **or nothing**) — the two rules that make §6's acceptable case safe
- ADR-0029 (a POI may itself be a quest giver), ADR-0019 (a rule drawn round a container measures the
  container), ADR-0052 and ADR-0053 (the numbering precedent used above)
- `content/schemas/level.schema.json#/$defs/pointOfInterest` — `name` is a `localizedText`, `fact` is the
  claim, and the claim is about the blurb
- `content/sources/discover-canada.json` (the register; the document and its extraction are
  `committed: false`), `docs/content-review.md` §2 (a POI's `name` and `blurb` are depictions), §9.4
- `docs/plan/slices.md`, *L1 gap list* — reclassified by §6
