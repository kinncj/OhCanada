# ADR-0051: A territory statement names only what its source names, and cites that source

- Status: Accepted (2026-09-16)
- Supersedes the `territoryStatement` half of an earlier draft, on the branch `multi-nation-source`, which
  was dropped and never merged. That draft decided that a statement cites **one** source; this decides
  **which** source that is for the names, what a statement does when the source names nobody, and what the
  "About this place" panel links to. Its findings are restated here rather than referenced, because a
  decision that rests on a file the reader cannot open is a decision nobody can check — and a number that
  names no file in `docs/adr` is a citation the gate rightly refuses.
- Numbering: this is ADR-0051 by instruction. The dropped draft held 0050, so that number stays spent
  and no branch merging later reuses it.
- Amended 2026-09-17: the product owner ruled on the three things this ADR left open or left uncomfortable —
  the §3.2 conflict, Québec City's statement, and what `sourcePublisher` names. All three are recorded under
  "The product owner's rulings, 2026-09-17" below, the first discharges this ADR's §3.2 obligation, and §3
  gains a measured note about the field's actual shape. No decision in the body above is reversed.

## Context

### The ruling

The product owner ruled, while the several-source design of that dropped draft was being implemented:

> literally use the names from the official guide. that's all… all the study materials should be from the
> official guide.

So every fact **and every name** a level prints comes from *Discover Canada* (IRCC) — not from a Nation's own
website, not from Parks Canada, not from CIRNAC, not from an encyclopedia.

### The conflict the ruling lands on

Three rules that hold today, and cannot all keep holding:

1. `content/schemas/level.schema.json` makes `territory` **required on every level**, and
   `territoryStatement.nations` carries `minItems: 1`. Every level must name at least one nation.
2. `content/schemas/common.schema.json#/$defs/nationName` fails the build, case-insensitively, on category
   words — `Aboriginal`, `First Nations`, `Inuit`, `Métis`, `Indian`, `Native`, `tribal` and the rest
   (`docs/content-review.md` §3.1: a category is not a nation).
3. **The guide names no people for most of the places these ten levels are set in.** Established by a
   research pass over `content/sources/discover-canada-2012-large-print.txt` with printed page numbers:

   - Named somewhere in the guide: Huron-Wendat (23, "of the Great Lakes region"), Iroquois (23, 25),
     Cree (17, 23), Dene (23, 104), Sioux (23), Algonquin, Montagnais and Huron (25, Champlain's allies),
     Mohawk (26), Shawnee (29), Haida (17), Blood — Kainai First Nation (18).
   - **Absent from the guide entirely:** Saulteaux, Assiniboine, Blackfoot, Salish, Musqueam, Squamish,
     Tsleil-Waututh, Dakota, Mi'kmaq, Ojibwa, Anishinaabe, Qu'Appelle — and the word "unceded". **No
     numbered treaty is named.**
   - Per level: **Ottawa** — nothing about the city's Indigenous history. **Québec City** — Champlain
     "allied the colony with the Algonquin, Montagnais, and Huron" (25); the Huron-Wendat are placed in the
     Great Lakes region (23). **Winnipeg** — "the 12,000 Métis of the Red River were not consulted" at Fort
     Garry (35). **prairie-rail (Fort Qu'Appelle)** — nothing; only "The Cree and Dene of the Northwest were
     hunter-gatherers" (23). **Vancouver** — nothing but the port (102).

So "names come only from the guide" and "every level names a nation" cannot both hold. One of them has to
give, and this ADR says which.

### Four things measured on this tree, because three of them are defects nobody has recorded

**(1) The panel cites the wrong page.** `docs/content-review.md` §10.2 asks the panel to name "where the
territorial **statement** comes from". `app/adapters/phaser/level-document.ts` takes the panel's publisher and
URL from `territory.nationSource`, which is where the **names** came from. On Ottawa those are two different
bodies: the sentence is quoted from a CIRNAC news release on canada.ca (`territory.fact.source.url`), and the
panel links `anishinabemowin.ca` under the words "Algonquin Anishinabeg Nation Tribal Council". The panel
attributes a sentence to a page that did not publish it wherever the two differ, and they differ widely.
Counted over the ten shipped documents: **seven link a different page from the one the sentence is quoted
from** (all but `halifax`, `peggys-cove` and `the-north`, whose two citations are the same URL), and on
**five of those seven the publisher is a different body** — `alberta-foothills` (CIRNAC vs Treaty 7 First
Nations Chiefs' Association), `ottawa` (CIRNAC vs Algonquin Anishinabeg Nation Tribal Council),
`prairie-rail` (University of Saskatchewan vs File Hills Qu'Appelle Tribal Council), `vancouver`
(Tsleil-Waututh Nation vs MST Development Corporation) and `winnipeg` (Parks Canada vs Treaty One Nation).
On the other two, `quebec-city` and `toronto`, it is the same body on another page.

**(2) Nothing checks that a printed name appears in any cited source.** `scripts/verify-content.mjs` never
reads `nations` and never reads `nationSource`; the only occurrences of either word in that file are
comments. `scripts/lib/claims.mjs` finds a claim by the shape of a `factClaim` — `{ factual, source,
verification }` — and a name is not a claim, so no check in gate B or gate C reaches one. `make
validate-content` checks the block's shape and the deny-list on each name, and cannot open a page. §11's
checklist box — "`nationSource` resolves and contains that name" — is held by review and by nothing else.
that dropped draft measured this first; it is still true on `main`.

**(3) The deny-list is anchored, and nobody has said so out loud.** `nationName`'s pattern is
`^\s*(?:…)\s*$`: it matches a value that **is** a category word, not one that contains one. `Red River
Métis` passes today and is in `content/levels/winnipeg.json`; a bare `Métis` fails. That distinction is the
answer to half the conflict and it was invisible.

**(4) A territorial statement can declare itself non-factual and still be drawn.**
`adjudicateClaim` returns `{ drawable: true }` for `factual: false` — correctly, for a greeting — and
`readTerritory` runs the territorial claim through the same ledger. A `territory.fact.factual` of `false`
would put an unsourced, unverified sentence about whose land this is in front of a player with every gate
green. All ten levels declare `true` today; nothing requires it.

## Decision

**A territory statement cites one source, names only what that source names, and the panel cites that
source. `nations` may be empty, and an empty list is a recorded judgement rather than an omission.**

### 1. One source, and the names come out of it

`territoryStatement` loses `nationSource`. A statement carries exactly one citation, `fact.source`, and the
rule on names is:

> **Every name in `nations` must be a name the source cited in `fact.source` prints for a people.**

`nationSource` stays in `common.schema.json` and stays on `CharacterDocument`, where a character's nation is
still sourced to that nation's own material under §3.2. It leaves the level document because under the
ruling there is no second page to cite: the names and the fact come from the same document, and two
citations of one document are two things to keep in step and one hash to get wrong (that dropped draft's rejected
`nationSources` array, by another route).

What this makes **unrepresentable**, which is the point: a statement whose names come from one page and
whose sentence comes from another. That was not only representable before, it was the shipped state on seven
of the ten levels.

### 2. `nations` may be empty, and the emptiness is recorded

`minItems: 1` goes. In its place, a sibling that records the judgement rather than defaulting it — the shape
`FactClaim.factual` and `CharacterDocument.indigenous` already use, and for the same reason:

```jsonc
"nations": [],
"nationsAbsentBecause": "source-names-none"
```

`nationsAbsentBecause` is **required if and only if `nations` is empty**, and forbidden otherwise, as a
schema conditional. An empty list on its own would be an author who had not got round to it, an author who
could not find a name, and an author recording that the guide names nobody — three different states with one
spelling. ADR-0024 in one field: an empty collection must not reduce to a pass.

The enum has one value today. A second reason is a schema change and an ADR, which is the intended cost:
"the cited source names none" is a finding about a document, and any other reason for printing no name is a
different decision that somebody should have to argue.

### 3. The panel cites the statement's source

`territoryStatement` gains a required `sourcePublisher`: **who published the source cited in
`fact.source`**. The panel draws it as the link's text and `fact.source.url` as the link's href, so "Where
this comes from" names where the sentence came from — §10.2's words, which the code did not implement.

`sourcePublisher` is a copy of the `publisher` field of the register named by `fact.source.sourceId`, and it
is a **checked** copy: `tests/unit/contracts/a-territory-names-what-its-source-prints.test.ts` fails if the
two disagree. The runtime cannot read a source register — there is no port for one, deliberately
(`ports-match-schemas` skips `source.schema.json` because "the game reads questions, never the sources behind
them") — so the string is carried in the document and pinned to the register by a gate, rather than being
either absent or unverifiable.

**Amended 2026-09-17: `sourcePublisher` is localised text, and the paragraph above is read with "the string"
as "each half".** The field carries a `LocalizedText`, both halves copied from the register, and the pin
compares them **per language**. Re-measured on the tree that carries it, in the order a reader would check:
`content/schemas/level.schema.json#/$defs/territoryStatement/properties/sourcePublisher` says "in both
languages" and "LOCALISED, and the pin compares PER LANGUAGE"; `content/schemas/source.schema.json`'s own
`publisher` — the field this one is a copy of — is localised for the same reason;
`app/application/ports/content-repository.ts` declares `readonly sourcePublisher: LocalizedText`; all ten
level documents carry `{"en": "Immigration, Refugees and Citizenship Canada", "fr": "Immigration, Réfugiés
et Citoyenneté Canada"}`, as does `content/sources/discover-canada.json`; and
`tests/unit/contracts/a-territory-names-what-its-source-prints.test.ts` compares per language. It landed in
`8522b66`, and `1bc2ffd` re-granted all ten statements that gate A4 unbound when the field's shape changed —
A4 working exactly as this ADR's Consequences describe.

**Why per language and not one comparison: a gate comparing one string would have gone on passing while the
French panel printed an English name.** That is the whole reason the single string was invisible for as long
as it was, and it is recorded here so that the next field copied out of a register is localised at the point
it is copied. The names themselves are **not** translated in `app/ui`: a table there would print a name held
by neither the register nor the level document, and would sooner or later be asked to translate a First
Nation's own body, which `docs/content-review.md` §9.3 forbids. A publisher with no French name of its own
carries the same value in both halves.

**The limit this ADR recorded earlier on 2026-09-17 — "one un-localised string drawn to English and French
readers alike", so a French player read the department's English name — is discharged, not merely
restated.** The French panel now draws « Immigration, Réfugiés et Citoyenneté Canada ». The earlier
measurement was true when it was taken, on the tree before `8522b66` merged, and it is left described here
rather than deleted because a limit that ends by being fixed should say so: this is what the honest form of
that record looks like when the fix lands, and it is the reason the limit was written down rather than
waved at.

### 4. A territorial statement states a fact

`territory.fact.factual` must be `true`. Enforced in `parseLevelDocument`, which refuses the level, and in
the contract test above over every shipped level. **Not** in the schema, and the reason is measured rather
than aesthetic: the only way to state it there is a constraint wrapped around the `$ref` to `factClaim`, and
`tests/unit/contracts/ports-match-schemas.test.ts`'s value checker resolves a property's type through
`$ref`, `anyOf`, arrays and enums — an `allOf` around a `$ref` is outside the set it understands, and a
schema edit that breaks the gate proving the schema is the contract is a poor trade for a rule two other
gates can hold. Recorded here so the next reader does not "fix" it by adding the conditional.

### 5. The deny-list is not relaxed, and the sentence may still quote the source's term

- **A `nations` entry** is a name for a people. The deny-list stands, case-insensitively, exactly as it is.
- **The statement's sentence** may use the source's own term where the source uses it, marked as the
  source's — which `docs/content-review.md` §9.2 already permits for *Discover Canada*, the Constitution Act
  and the Indian Act. So Winnipeg's sentence may say what page 35 says about "the Métis of the Red River"
  whether or not `nations` carries an entry.
- The two are not in tension because they are different objects: a sentence is prose a reader can weigh, and
  `nations` is a list the panel prints as names under a heading saying they are names.

This answers the "allow a guide-printed category word" option without weakening anything: the deny-list never
blocked `Métis of the Red River` (Context §4 above), and a bare `Métis` stays a build failure. Whether the
phrase the guide prints is a name for a people or a category with a place attached is the author's proposal
and the verifier's judgement, and neither of them is a regex.

### What the "About this place" panel shows, in each case

| Case | What the player sees |
|---|---|
| Verified, names present | The statement; **Named in this statement** and the list; **Where this comes from** and the publisher link, which says out loud that it leaves the game. |
| Verified, `nations: []` | The statement; **no** heading and **no** list; the same source link. |
| Refused (any of ADR-0003's three conditions) | The two sentences the panel already draws. No nation, no publisher, no link, no developer message. |

**`app/ui` does not change and no copy row is added.** The panel already draws no heading over an empty list
(`app/ui/about-this-place.ts`, `statementRows`), with a unit test for it that was written as a defence
against a state "the game should never reach". That state is now a legitimate one, so the comment changes and
the code does not. `COPY_GAPS` stays at 72 rows.

**The panel does not explain the silence.** A sentence such as "the guide names no people for this place"
would be `app/ui` making a claim about a source, in the project's own voice, on every level that carries an
empty list — which is the thing §10.1 forbids an agent to write and what `about.unavailable.*` is carefully
worded to avoid. What the guide does say about the place is the statement's job, and the statement is
content, written by an author and granted by a verifier.

## Alternatives considered

- **`territory` becomes optional; a level the guide says nothing about draws no panel.** Rejected. Every
  place in Canada is on someone's territory, and a level with no `territory` has not decided — it has just
  not said, which is the sentence already in the schema. Worse, it makes the panel disappear exactly where
  the game has least to say, so a player cannot tell "this project found nothing" from "this project did not
  look". An empty `nations` with a recorded reason says the first out loud; an absent block says nothing at
  all, and says it silently.
- **Keep `nations` required, and let a level name a people from a source that is not the guide.** This is
  the status quo, and it is what the ruling rejects. Recorded as an alternative because it is the one a
  reader will reach for when a level ends up naming nobody: the cost of the ruling is visible (§10.3's
  half-step gets shorter) and it is the product owner's to pay, not an agent's to quietly avoid.
- **Relax `nationName` so a guide-printed category word is a legal entry in `nations`.** Rejected, and it
  turns out not to be needed. §3.1's deny-list exists to stop "a generic Indigenous person" being recorded as
  an identity, and a list headed "Named in this statement" carrying the single word "Métis" or "Inuit" is
  exactly that. Measured: the pattern is anchored, so the longer phrases the guide actually prints are
  already legal, and §9.2 already lets the *sentence* carry the source's term. Relaxing the list would buy
  nothing and spend a rule.
- **Keep `nationSource` and let a statement carry either citation (`oneOf`).** Rejected for the reason
  that dropped draft gives against its own `nationSources` array: a second way to write a citation is a shape every
  reader must branch on, every consumer must handle and no gate exercises, and the first document to use the
  rare branch is authored by somebody reading a shape nobody has filled in. It would also keep defect (1)
  alive on the branch that keeps `nationSource`.
- **Put the publisher at the level document's root, to avoid voiding the five granted statements.** Rejected,
  and named because it is the tempting one. A4 binds a grant to the claim's **unit** — the `/territory` node
  — so a field placed outside that unit can be changed under a verified statement without voiding anything.
  That is not a way of avoiding a re-verification; it is an under-binding, which is the defect A4 exists to
  prevent, chosen deliberately to keep a build green. ADR-0003's amendment says it plainly: a gate that must
  be worked around in order to do the right thing teaches that gates are worked around.
- **Let the panel drop its source link when no nation is named.** Rejected: it makes the best-sourced case —
  a sentence straight out of the guide — the only one that cites nothing, which is backwards, and it breaks
  §10.2's "Sourced".
- **Write the name gate so it can run in CI.** Not available. The extraction is Crown copyright and
  `committed: false`, and every register in this repository is too, so no cached text exists in CI for any
  source. The gate is written to run where the bytes are and to **count and print** where they are not — the
  arrangement every other text check in `verify-content` already has, stated rather than implied.

## Consequences

- **Five granted territorial statements come unbound, and `make verify-content` fails until a verifier
  re-grants them.** Replacing `nationSource` with `sourcePublisher` edits `/territory`, and A4 binds a grant
  to that whole node. The five with `verification.status: "verified"` are `alberta-foothills`, `halifax`,
  `peggys-cove`, `the-north` and `toronto`; the other five are already `rejected` and A4 says nothing about a
  status it never granted. This is A4 working, not a regression, and it is priced: all ten statements are
  about to be rewritten to the guide, which voids all ten anyway. The order is author, then verifier, then
  green — and the obligation below stops the red state outliving the session.
- **The panel will name the Crown on several levels.** With the link following the sentence, Ottawa says
  *Crown-Indigenous Relations and Northern Affairs Canada*, the Prairies say *University of Saskatchewan* and
  Winnipeg says *Parks Canada* — today, before any rewrite. After the rewrite every level says *Immigration,
  Refugees and Citizenship Canada*, because that is who publishes the guide. §10.2 asks for "the nation's own
  material where one exists"; under the ruling one no longer does. This is a thing a product owner should see
  on a screen before it ships rather than after.
- **A level may now show a territorial panel that names nobody.** §10.3 already calls naming the territory
  and depicting nobody from it "a half-step … not the thing that would be right". A panel that names no
  people at all is a shorter step still. It is honest — it says what the study guide the game teaches says,
  and no more — and it is a real loss against what five of these levels say today, including the two Nova
  Scotia levels, whose Mi'kmaq naming the guide does not support. The decision is the product owner's, it is
  recorded here, and no agent may soften it by reaching for a non-guide source.
- **§3.2 and the ruling disagree, and only the product owner can settle it.** §3.2 requires a nation source
  to be "the nation's own published material … or a registry that nation is listed in". *Discover Canada* is
  the Crown's study guide and is neither, and this project has already moved a name source **away** from the
  Crown once for exactly that reason (`content/sources/kmk-about-consultation.json` records Halifax's Mi'kmaq
  name source moving off `cirnac-peace-and-friendship-treaties`). No agent may quietly reconcile that. The
  obligation below is that dropped draft's, restated because that dropped draft is not in this tree and an obligation nobody's
  gate reads is not one.
- **The Tier 3 obligations in `docs/content-review.md` §13 are untouched.** They are about depiction and
  review, not about which document a name came from, and nothing here discharges any of them. **Still true,
  and overtaken on 2026-09-17 by something else:** two of the three were closed as `VOIDED` under a separate
  product-owner ruling, recorded in "The product owner's rulings" below, because the guide-only rewrite
  removed the quoted material they were written about. It was not this decision that closed them, which is
  what this bullet says and remains exactly right; it was the decision about what to do once this one had
  emptied them.
- **The name gate is unchecked in CI and says so on every run.** `verify-content` prints how many names it
  searched for, how many it checked against a cached extraction, and how many it could not check. A run where
  nothing was searched says so in those words, so the line can never be read as a pass.
- **A rejected statement is unaffected.** The refusal branch carried no nation, publisher or URL before this
  ADR and carries none after; the two fields that moved are only ever read on the branch a verifier granted.

### What the author must do next, per level

The author rewrites the ten statements; this ADR does not. What each level can say is set out below. The
first five are established by the research pass against the cached extraction. **The last five could not be
checked here** — the extraction is git-ignored and absent from this worktree and from CI, so only the
verifier, who holds the bytes, can settle them; the entries say what is known and what must be looked up.

| Level | What the guide supports | What the author writes |
|---|---|---|
| `ottawa` | Nothing about the city's Indigenous history. The capital and the Rideau Canal are there. | `nations: []` + `nationsAbsentBecause`. A statement about the place from the guide. The current sentence ("unceded, unsurrendered territory of the Anishinabe Algonquin Nation") cites a CIRNAC release and the guide prints neither the nation nor the word "unceded": it must go. |
| `quebec-city` | Champlain "allied the colony with the Algonquin, Montagnais, and Huron" (25). The Huron-Wendat are placed in the **Great Lakes region** (23), not here. | Either `nations: ["Algonquin", "Montagnais", "Huron"]` with a sentence about what page 25 says, or `nations: []`. The guide does not put the Huron-Wendat at Québec City, so the present Nionwentsïo/Wendake sentence cannot be re-sourced to it. |
| `winnipeg` | "the 12,000 Métis of the Red River were not consulted" at Fort Garry (35). | `nations: ["Métis of the Red River"]` if the verifier accepts that as the name the guide prints for a people — the deny-list does not block it — otherwise `nations: []` with the sentence carrying the guide's own term under §9.2. The present seven-name list comes from Parks Canada and goes. |
| `prairie-rail` | Nothing about Fort Qu'Appelle. "The Cree and Dene of the Northwest were hunter-gatherers" (23) is about the Northwest, not this place. No numbered treaty is named, so Treaty 4 goes. | `nations: []` + `nationsAbsentBecause`, unless the verifier finds the guide placing a named people here. |
| `vancouver` | Nothing but the port (102). Musqueam, Squamish and Tsleil-Waututh are absent from the guide. | `nations: []` + `nationsAbsentBecause`. |
| `halifax` | **Not checked here.** "Mi'kmaq" is on the research pass's absent list, so the present statement's names are very unlikely to survive. | Look up Nova Scotia in the guide; expect `nations: []`. Whatever the answer, the Kwilmu'kw Maw-klusuaqn quotation is not from the guide and cannot stay. |
| `peggys-cove` | **Not checked here.** Same as Halifax. | Same as Halifax. `docs/content-review.md` §13's Peggy's Cove obligation stands whatever this level ends up saying. |
| `toronto` | **Not checked here.** The Mississaugas of the Credit are not in the research pass's list of peoples the guide names, and no numbered treaty is named, so the Toronto Purchase citation goes. | Look up Toronto; expect `nations: []`. |
| `alberta-foothills` | **Not checked here.** The guide prints "Blood (Kainai First Nation)" at page 18 — whether it places them in these foothills is the lookup. Treaty 7 is not named in the guide and goes, with its seven-name list. | Either one name the guide both prints and places here, or `nations: []`. |
| `the-north` | **Not checked here.** The guide prints Dene at 23 and 104; Kwanlin Dün, the Tagish Kwan and Chu Níikwän are not in the guide. | Look up the regions chapter; either a name the guide places in the North, or `nations: []`. The present Kwanlin Dün quotation goes, and §13's North obligation stands. |

Two rules the author is held to whatever the answer: the statement's `sourcePublisher` must equal the
publisher of the register it cites (a gate), and the author edits the statement's text and fields and
**leaves any existing `verification` block exactly as it stands**. A4 unbinds the grant by itself when the
unit changes, and the verifier re-grants it in a separate commit. The null form is written only for a claim
that has never been verified: rewriting an existing block to the null form *is* changing one that exists,
which ADR-0003 forbids and gate A1/A2 refuses. So the author's commit and the verifier's commit stay
separate commits — which is what the rest of this ADR's Consequences already assume, where the five granted
statements "come unbound … until a verifier re-grants them".

- ~~**OBLIGATION due=2026-12-16 owner=po** — settle `docs/content-review.md` §3.2 against this ruling in
  writing: either amend §3.2 so a territorial statement's names may come from the study guide the game
  teaches, or restate that they must come from the nation's own material and take the consequence for the ten
  statements. Until it is settled, §3.2 says one thing and the content says another, and the first person to
  notice will be a reviewer reading both. Restated from that dropped draft, which is on a branch the obligation gate
  does not read.~~
  **DISCHARGED 2026-09-17** — the product owner took the first branch, and §3.2 is amended in writing rather
  than in a decision recorded elsewhere. `docs/content-review.md` §3.2 now carries "Amended 2026-09-17 — a
  territorial statement may take its names from the study guide", which states what is permitted (a name the
  cited guide prints for a people, in `territory.nations`), why (the game teaches one exam and a territorial
  statement is a claim about that exam's own document), and six things the section still protects — §3.1
  everywhere else, characters and art subjects, one document rather than a class of them, the unrelaxed
  deny-list, provenance as distinct from accuracy and consent, and what a reader of the panel must not
  conclude from the list's heading. The two documents no longer say different things, and the ruling's cost
  stays visible in both. Recorded in full below under "The product owner's rulings, 2026-09-17".

- **OBLIGATION due=2026-10-16 owner=content** — rewrite the ten territory statements to *Discover Canada*
  under the shape this ADR sets out, and have a verifier re-grant them. Until that lands, five territorial
  grants are unbound and `make verify-content` fails on them by design (A4). If the date arrives with the
  work undone, re-date it with what was tried (ADR-0009) rather than letting a red gate become the normal
  state — a failing gate that everybody has learned to ignore is worse than no gate.

## The product owner's rulings, 2026-09-17

Three questions this ADR left open, or left open and uncomfortable, went to the product owner and came back
answered. They are recorded together because they are one decision seen from three sides: the game teaches a
specific exam, and its territorial statements say what that exam's own document says — including where a
reader of this repository's other rules would have written something else.

### 1. §3.2 is amended for the guide

**Ruled:** amend `docs/content-review.md` §3.2 so a territorial statement may take the names it prints from
the study guide the game teaches. The amendment is written in that document, at §3.2, and the obligation
above is discharged against it. It is deliberately narrow — this field, in these statements, for this
reason — and §3.1's rule that a nation is named as it names itself is untouched everywhere else, including
on every character and every art subject. The amendment says so in six numbered protections rather than
leaving a reader to infer the boundary, because the sentence that will be remembered from it is "the guide
wins", and that is not what was decided.

### 2. Québec City's statement ships as it is

**Ruled: keep it.** `content/levels/quebec-city.json` prints the guide's words — Champlain "allied the
colony with the Algonquin, the Montagnais and the Huron", whom the guide calls historic enemies of the
Iroquois — and `nations` carries `Algonquin`, `Montagnais`, `Huron`.

**What was put to the product owner before they chose, restated here in full because a decision a reader
cannot check is not one.** All four of these were stated explicitly, and none of them is in dispute:

- **These three are the only nations the game names anywhere.** The other nine levels name nobody
  (`nations: []` with `nationsAbsentBecause: "source-names-none"`), so this one list is the whole of the
  game's naming of Indigenous peoples in its territorial statements.
- **They are introduced by whose side they took in a French colonial alliance.** The only thing the player
  learns about them at the panel is that Champlain allied his colony with them — the guide's frame, on the
  guide's page 25, which is the sentence the statement cites.
- **The Iroquois appear only as enemies, and have no entry of their own.** They are named in the sentence as
  the historic enemies of the three allied peoples, and they are not in `nations`, so the panel lists them
  nowhere and says nothing else about them.
- **`Montagnais` and `Huron` are exonyms.** Those nations say **Innu** and **Wendat**. §3.1 asks for the
  form a nation uses for itself, and this list does not carry it.

**The decision, unsoftened:** the statement ships as it is. The product owner saw the four points above and
chose the guide's words anyway, on the guide-only ruling — this game teaches *Discover Canada* and the panel
quotes it. No agent may reopen this by reaching for a better name, and no agent may soften it by adding a
sentence to the panel explaining the guide, which §10.1 and ADR-0056 both forbid for the same reason: the
project does not narrate a source in its own voice on a screen that exists to quote it.

**What this ruling does not do.** It does not grant cultural review — §1's Tier 3 does not exist and none of
these three nations has been asked anything. It does not make an exonym acceptable anywhere else in the
project. And it does not close `docs/content-review.md` §13's obligations, which are about depiction and
review and are untouched by it.

### 3. `sourcePublisher` names the department as it is today

**Ruled:** the field names **Immigration, Refugees and Citizenship Canada**, the department as it is now, in
both languages — which is what shipped on all ten levels.

**The recorded reason.** `sourcePublisher` is a **link label**, not a citation line: the panel draws it as
the text of a link whose `href` is `fact.source.url`, which points at IRCC's own site. Naming the 2012
department instead would send a reader who clicks looking for a body that no longer bears that name. And
neither language was ever a quotation of the document — the cached guide and the live page both print the
former name, in English and French alike, so there is no language in which the shipped value reproduces what
the PDF says.

**The wart, stated rather than tidied away.** A reader who follows the link and opens the PDF sees a
different department name from the one they clicked. That is true today, it was true before this ruling, and
it is not being fixed. It is the cost of labelling a link by where it goes rather than by what the document
called itself in 2012, and the product owner chose it with that cost named.

**One honesty note about the reason, in this ADR's own terms — and it has since been settled.** ADR-0003
requires that a claim this repository makes about a source be re-derivable from the cached bytes. When this
ruling was recorded, the claim that the guide prints the former name in both languages was **not**
re-derivable in the worktree that recorded it: `content/sources/discover-canada.json` is `committed: false`,
the extraction is git-ignored, and the check needs the bytes. It has since been re-derived by somebody
holding them: the verifier's re-grant, `1bc2ffd`, reports the cached bytes naming the former department in
both languages — *Citizenship and Immigration Canada* at page 4, with the live French page still printing
*Citoyenneté et Immigration Canada* — and records that the French half was checked against the department's
own French page. So the reason now stands on a reading of the source rather than on the ruling alone, which
is the footing this ADR asks every claim about a document to stand on.

**The wart survives that check unchanged**, and is worth restating because a re-derivation can read as a
resolution: the guide still calls itself by a name the panel does not print, in both languages now rather
than in one. Nothing about the localisation fixes that, and nothing was meant to.

### 4. A statement's opening locative comes from the guide too

**Ruled:** the guide-only rule reaches the **opening locative** — the words a statement uses to place the
level before it starts quoting the guide's material. A statement may not set its scene in geography the
guide does not print, any more than it may name a people or a place the guide does not print.

**What the ruling names.** `alberta-foothills` opens "This level is set in the Alberta foothills, where the
plains meet the Rocky Mountains", and the finding put with the ruling is that the guide contains no
"foothills" and no "plains" outside the Plains of Abraham. The same reading catches `vancouver`'s "This
level is set on the Vancouver waterfront". **An author is fixing the wording separately; what is recorded
here is the rule, not the replacement sentence** — this ADR does not write statements, as its own per-level
table says.

**This reopens claims a verifier granted, and that is the part a reader is owed.** Both statements read
`verified` today, re-granted on 2026-09-17 in `1bc2ffd` after the publisher split unbound them. Editing the
opening sentence edits the `/territory` node, so gate A4 unbinds the grant again and a verifier re-grants in
a separate commit — the author-then-verifier order this ADR already sets out. Said plainly rather than left
to be inferred: **a `verified` claim is being reopened by a product-owner ruling about wording, not by a
defect the verifier missed.** The grant was clean against the rule as it stood; the rule moved. Searched for
a level-specific reservation recorded with either grant — the two grant commits and `docs/` carry none
naming this locative — so the record shows a straightforward grant rather than a reserved one, and this
ruling is what overturns it.

**What cannot be re-derived here, in the same terms as the publisher note above.** The claim that the guide
prints no "foothills" and no "plains" outside the Plains of Abraham needs the cached bytes, which are
`committed: false` and absent from this worktree — `discover-canada-2012-large-print.txt` is not on disk
here. It is recorded as the finding put with the ruling, and whoever holds the extraction settles it with
`containsRun` from `scripts/lib/claims.mjs`, the matcher the gates use and the one that does not fail on the
extraction's hard wrapping. A line-based `grep` cannot answer it.

### 5. The two Tier 3 review obligations in §13 are closed as overtaken

**Ruled: close them.** `docs/content-review.md` §13's obligations to put Peggy's Cove in front of a Tier 3
reviewer from Kwilmu'kw Maw-klusuaqn and The North in front of one from Kwanlin Dün First Nation are closed
in that document, at their own markers. §13's third obligation — `OQ-REVIEW-2`, whether there is a Tier 3
reviewer at all — is untouched and stands.

**The reasoning as it was put to the product owner.** Both obligations were written when those two levels
**quoted those nations' own material**: Peggy's Cove carried Kwilmu'kw Maw-klusuaqn's words and The North
carried Kwanlin Dün First Nation's acknowledgement of the Tagish Kwan, along with *Chu Níikwän* and
*Kwanlin*. The guide-only rewrite removed all of it. Both levels now name nobody — `nations: []` with
`nationsAbsentBecause: "source-names-none"` — so the material each obligation was written about is gone, and
items (1) and (2) of each are questions about words no longer in the documents.

**What a reviewer would have been asked about instead is the silence**, and there is one new instance of it
created the same day: a landmark card now reads "This is Peggy's Point Lighthouse", printing the settler
name on a coast whose Mi'kmaw name the game never gives. Items (3), (4) and (5) of each obligation — the
unfilled silence, a level that depicts nobody, and meaning in the art an outsider cannot see — are not
answered by anything, and the product owner closed the obligations knowing that.

**The consequence, named plainly because this is the kind of decision that otherwise looks like an
expiry.** The decision to name that coast only in the settler's name now stands **without anyone from that
nation having seen it**, and closing these markers removes the mechanism by which that would have been
raised. That is the cost of the ruling, it was visible when the ruling was made, and no agent may soften it
or re-argue it here.

**Two limits this closure does not reach**, stated in the same breath because closing a review obligation
reads as review having happened: §3.1's naming rule stands, and the §3.2 amendment's protection 5 stands —
**a guide-sourced name is not a reviewed name, and nothing in these rulings makes any content culturally
reviewed.** No `communityReview` status moves, none may move (§1, and ADR-0003's rule A3), and §1's shipping
rule is unchanged.

**Why those two markers read `VOIDED` rather than `DISCHARGED`.** Each asked that a level be put in front of
a named reviewer and that the answer be recorded. That work was never done: no reviewer was engaged, none is
named, and no answer exists. What ended was the **premise** — the quoted material the obligations were
written about. ADR-0009 splits the two keywords for exactly this case and says that recording a withdrawn
obligation as discharged "claims a delivery that never happened", so `VOIDED` is the honest keyword and the
closure sentence says what removed the premise. The gate treats the two identically, so nothing is bought by
the wrong one.

## References

- `docs/content-review.md` §3.1 (the deny-list), §3.2 (where a name comes from), §9.2 (quoting a source's own
  terms), §9.3 (endonyms are not translated), §10.1–10.3 (the fact, the panel, the half-step), §11 (the
  checklist box no gate keeps), §13 (the Tier 3 obligations — untouched by the naming decision, and two of
  the three later closed as overtaken on 2026-09-17; see the rulings section)
- ADR-0003 (the two ends of a citation, the author/verifier split, A1/A2), ADR-0007 (the schema is the
  contract), ADR-0008 (a seam exists when something calls it), ADR-0015 (prune it or tripwire it),
  ADR-0016 (staleness, banned terms and the clocks a guide citation brings), ADR-0024 (an empty collection
  must not reduce to a pass), ADR-0030 (a told claim is outside the one-proposition rule)
- The dropped draft, on branch `multi-nation-source` — one source per statement, the missing gate, and the
  `nationName` consequence this ADR answers
- `content/sources/discover-canada.json` (the register; the document itself is `committed: false`),
  `content/sources/kmk-about-consultation.json` (the name source that moved off a Crown page)
- `docs/stories/TN-LEVEL-winnipeg.md` `OQ-WINNIPEG-3`, `docs/stories/TN-LEVEL-vancouver.md` `OQ-VANCOUVER-4`
