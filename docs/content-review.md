# Content review — how TrueNorth depicts people

This is the process `CLAUDE.md` names in its Content rules row, and the one `CONTRIBUTING.md`,
`docs/architecture.md`, `content/schemas/character.schema.json`, `app/application/ports/content-repository.ts`,
`assets/style/art-bible.md`, `scripts/verify-art.mjs` and `.github/ISSUE_TEMPLATE/cultural-accuracy.yml` all
point at. Until today it did not exist, which made five citations into claims about a document nobody could
read.

CLAUDE.md states the rules:

> Indigenous content follows `docs/content-review.md`: name the nation depicted, no invented patterns, no
> sacred items as props, no caricature. Cartoon proportions are identical for all characters.

This document does not restate them. It says who does what, where the answer is recorded, which gate checks
it, and what happens when the rule cannot be satisfied — because a rule with no failure path is a preference.

**Read §1 first.** It is the answer to "who reviews", and it is the reason large parts of this process end in
"does not ship yet" rather than in a sign-off.

**This document was written by an agent and has not been reviewed by anyone from any nation it governs.** It
is a set of guard rails for work done without a reviewer. It is not a substitute for one, and nothing in it
should be read as permission.

---

## 1. Who reviews

Every other gate in this project has an owner and a mechanism. This one does not, and the honest answer is
worth more than a comfortable one.

### Three tiers, and only two of them exist

| Tier | Who | Can it block? | Can it approve? |
|---|---|---|---|
| **1 — Gates** | `make validate-content`, `make lint` (palette, obligations), `make verify-art` | Yes, mechanically | Only the mechanical part |
| **2 — Agents** | `art-verifier`, `content-verifier`, `reviewer` | Yes | Only presence, citation and measurement — never cultural accuracy |
| **3 — Community** | A person from the nation depicted | **Yes — see §7** | **Yes, and nothing else can** |

**Tier 3 does not exist in this project today.** No reviewer has been engaged, none is named in this
repository, and there is no budget line to pay one. `OQ-REVIEW-2` is that decision, and it belongs to the
project owner.

### The separation-of-duties rule, extended

ADR-0003 already establishes that the agent that writes a claim may never grant its verification status.
This document extends the same rule one step further:

> **No agent may grant cultural sign-off. Ever. For any reason.**

An agent may write `communityReview.status = "not-sought"` and nothing else. `sought`, `granted` and
`refused` are set by a person, name a person or organisation, and carry a date. An agent that fills in
`granted` has fabricated a review, which is the same class of defect as a `verified` question with no
evidence quote (ADR-0003, amended) — and worse, because the person it fabricates consent from is real.

A review process that let an agent sign off on cultural accuracy would be exactly the kind of gate this
project has spent a session removing: one that looks like coverage and measures nothing.

### What the agents *can* check

These are real, they are worth having, and they are all this project has:

- a `nation` value is present wherever it is required (§3);
- that value is specific, not one of the banned vague values (§3.1);
- the value resolves to a cited source that contains the name (§3.2);
- every visible design element has a cited reference, or is absent (§4);
- no item on the presumed-restricted list appears in the asset (§5);
- every character measures to the proportion canon, within tolerance (§6);
- every colour is in the palette allow-list, so no off-canon skin tone exists (§6.3);
- slots are independent: no hair, garment or feature option is coupled to a skin tone (§8.2);
- EN and FR are both present, and endonyms are not translated (§9);
- no living people are written about in the past tense (§9.3);
- the randomiser draws uniformly across skin tones (§8.3).

### What the agents cannot check, and must not claim to

- Whether a design belongs to a family, a clan or a house rather than to a nation at large.
- Whether a cited source was published with the nation's consent, or extracted from it.
- Whether an item is ceremonial, restricted, seasonal, or restricted to certain people.
- Whether a depiction is respectful, welcome, or wanted at all.
- Whether the *absence* of something is itself a harm.
- Whether a nation's name is the one that nation uses for itself today.
- Whether the wording of a land acknowledgement is honest or hollow.

A tier-2 pass means "nothing mechanically wrong was found". It never means "this is right".

### The shipping rule while Tier 3 is empty

**Does not ship until a Tier 3 reviewer has granted review:**

1. Any character document carrying a `nation` value.
2. Any regalia, garment, pattern, tool, vessel or object that belongs to a specific nation, on any
   character or in any scene.
3. Any item on the presumed-restricted list (§5.2), in any form, including background scenery.
4. Any dialogue spoken by a character depicted as Indigenous.
5. Any level whose *subject* is a nation's territory or history — **slice 4, the Mi'kma'ki level, is this
   case in full** (`OQ-REVIEW-3`).
6. Any historical scene depicting Indigenous people, including silhouettes and crowd figures.
7. A land acknowledgement written in the project's own voice (§10).

**May ship without a Tier 3 reviewer, because it depicts no nation and asserts nothing about culture:**

1. The character creator's skin tones, hair, garments and features, under §8 — a range of human appearance
   is not a claim about anyone's identity, provided the rules there hold.
2. Characters with no cultural markers at all. A character with `skin-5` and a winter coat is a person; the
   game says nothing about who they are, and that is the point.
3. Landmarks, buildings, streets, vehicles and landscape drawn from cited references.
4. The Ottawa level as scoped in `docs/stories/TN-LEVEL-ottawa.md`.
5. **A territorial fact line** — "Ottawa is on the unceded traditional territory of the Algonquin
   Anishinaabe Nation" — because it is a citable fact, verified like any other under ADR-0003. This is not
   the same thing as a land acknowledgement. See §10.
6. Questions paraphrased from *Discover Canada* under ADR-0003, including questions about Indigenous
   peoples. Omitting them would teach a citizenship test with Indigenous peoples removed from it, which is
   its own harm. The limits on those questions are in §9.4.

### If the answer is "we will never have a Tier 3 reviewer"

That is a legitimate answer, and it has one consequence, stated here so nobody has to infer it: the game
ships with **no depiction of any specific nation, anywhere, ever**, and slice 4 is redesigned or dropped.
That is a smaller game. It is not a dishonest one. The failure mode this document exists to prevent is
shipping the depiction anyway with a process page pointing at it.

---

## 2. What this document governs

Any **depiction** — anything the player sees, hears or reads that portrays a people, a person, a culture, a
place or a territory. That includes:

| Where | Examples |
|---|---|
| Art | Characters, garments, props, scenery, patterns, landmarks |
| Character creator | Skin tone, hair, body, gender presentation, visible disability, religious dress |
| Dialogue | Anything an NPC says, and who is drawn saying it |
| POI blurbs | `PointOfInterest.blurb` and `name` |
| Questions | Prompt, options, explanation (bounded by §9.4) |
| Level design | Where a level is set, what it is called, what it teaches |
| Locale strings | Option names, HUD labels, live-region announcements |
| Credits and references | Which photographs are used, and how they are described |

It does not govern factual correctness — ADR-0003 does that — and it does not replace it. A depiction can be
factually correct and still fail here.

---

## 3. Rule 1 — Name the nation depicted

### 3.1 What "specific" means

The value names **one nation**, in the form that nation uses for itself.

**Accepted:** `Mi'kmaq`, `Algonquin Anishinaabe`, `Haudenosaunee (Kanien'kehá:ka)`, `Nunatsiavummiut`,
`Métis Nation of Alberta`.

**Rejected — a build failure, not a warning:** `Indigenous`, `Aboriginal`, `Native`, `First Nations`,
`First Nation`, `Inuit`, `Métis`, `Native American`, `Indian`, `tribal`, `northern`, `traditional`,
`unspecified`, `various`, `generic`, `n/a`, `TBD`, the empty string.

Those are categories, not nations. "A generic Indigenous person" is the failure mode this rule exists to
prevent, and a vague value in the `nation` field is that failure mode wearing the field's name. The gate
holds a literal deny-list of these strings, case-insensitively, and a value that is only a category fails.

Two nations may be named only when the character is explicitly of two nations and that fact is part of the
depiction. Two names as hedging — "somewhere in this region" — is the vague value again, spelled longer.

### 3.2 Where it is recorded, and how it is verified

`CharacterDocument.nation` already exists in `content/schemas/character.schema.json` and points here. It is
currently optional and unconstrained, which is not enough to carry this rule. What it needs is
`OQ-REVIEW-5`, routed to the architect, because schemas are outside this document's boundary:

- `nation` becomes **required whenever the character is depicted as Indigenous**, expressed as a schema
  conditional on a new `indigenous: boolean` — required, never inferred, so the judgement is recorded rather
  than defaulted. This is the same shape as `FactClaim.factual`, and for the same reason.
- a sibling `nationSource` (a URL) is required whenever `nation` is present. The source must be **the
  nation's own published material** — its government, its cultural centre, its language authority — or a
  registry that nation is listed in.
- a sibling `communityReview` block: `{ status, reviewer, organisation, date, scope, note }`, where `status`
  is `not-sought | sought | granted | refused` and, per §1, an agent may write only `not-sought`.

For **art assets**, the record is the subject entry in `assets/refs/references.json`, which already carries
`referenceFiles`, `mustBeRight`, `simplifyAway` and `neverAdd`. A subject depicting a nation adds `nation`,
`nationSource` and `communityReview` with the same meanings. That file is art's, and this document states
the requirement rather than editing it.

For **levels and POIs**, there is no field at all today. A level set on named territory needs one
(`OQ-REVIEW-5`), and until it exists no such level may ship — which is the rule in §1 anyway.

**How it is verified.** The `content-verifier` fetches `nationSource`, confirms the page contains the name
in `nation`, and records the hash exactly as it does for a `FactSource`. That is a check that the name was
copied from somewhere real. It is not a check that the name is right, that the nation would recognise the
spelling, or that this is the nation actually depicted in the picture. Only Tier 3 checks those.

### 3.3 When the depiction is generic

If no specific nation can be named, there are exactly two outcomes, and "ship it anyway with a vague label"
is not among them:

1. **Name a nation and do the work.** Pick one, cite it, draw what that nation actually wears and makes,
   record it, and hold the asset for Tier 3.
2. **Remove every cultural marker.** The character keeps their skin tone, their hair, their coat and their
   place in the scene, and carries no regalia, no pattern, no cultural item, no beadwork, no name, no
   dialogue about identity. They are a person in Canada, and the game asserts nothing further. `nation` is
   absent, `indigenous` is `false`, and the gate is satisfied because no claim was made.

Outcome 2 is not "no Indigenous people in the game". It is the game declining to *assign* identity to a
figure it cannot depict properly — which is what "a generic Indigenous person" does. A player may read
themselves into an unmarked character; that is theirs to do and the game must not do it for them.

### 3.4 The player's own character

The character creator offers **nothing nation-specific**: no regalia, no ribbon skirt, no ribbon shirt, no
beadwork, no braid style tied to a nation, no `nation` field on the player character at all. A player
choosing a nation's regalia from a menu is wearing a costume, and no consent process can be attached to a
drop-down. This is a rule, not an open question.

---

## 4. Rule 2 — No invented patterns

Patterns, regalia and designs belong to specific nations and often to specific families, houses or clans.
An artist working from a search-engine image cannot tell which.

### 4.1 What the artist does instead

The art bible already has the right instinct for landmarks and this rule is its extension:

> **Drop, never substitute.** ... An empty stone face is accurate. A made-up quatrefoil is not.
> — `assets/style/art-bible.md` §6, rule 4

Applied to people:

> **Draw the form. Omit the surface. Never invent the surface.**

- **Form and cut may be drawn** when they are documented and identifying: the silhouette of an amauti's
  hood and pouch, the shape of a parka's hem, the drape of a wrap. These are geometry, cited from a
  reference like any landmark.
- **Surface design is omitted:** beadwork, quillwork, weaving, appliqué, trim patterns, painted crests,
  tattoos, face paint. A plain garment is accurate. An invented one is a fabricated claim about who somebody
  is, drawn in a style the player will read as documentary because everything else in this game is.
- **An invented pattern is worse than no pattern**, and it is worse than an obviously fake pattern, because
  a plausible one gets copied.

### 4.2 The three words that fail review

Any of these in an art note, a commit message or a reference file marks the asset as invented and blocks it:
**"inspired by"**, **"in the style of"**, **"evocative of"**. So does a reference whose provenance is a
stock library, an image search, a generative model, a fan wiki, or another game. A pattern's citation is a
museum catalogue record, a nation's own publication, or a photograph with a licence and a named
photographer — recorded in `assets/credits.json` like everything else (ADR-0004).

### 4.3 Citation is necessary and not sufficient

Finding a documented pattern does not mean it may be reproduced. Many designs are owned — by a family, a
house, a clan — and publication in a museum catalogue is often evidence of their removal rather than of
permission. So:

> A cited pattern is *eligible* for Tier 3 review. It is never cleared by the citation alone.

### 4.4 Worked example: the ceinture fléchée

`.claude/agents/art.md` names "the Voyageur's ceinture fléchée" as a required feature. The arrow weave is
the identifying element of the sash — dropping it leaves a red belt — so §4.1's "omit the surface" answer
takes the recognisability with it. That is the honest tension, and it resolves like this:

- the sash is Métis and French-Canadian heritage with a documented, widely published weave structure, and
  it is not restricted or ceremonial in the sense of §5;
- so it is **eligible**: cite a specific documented sash, in a specific museum or nation record, and draw
  *that* weave's geometry, not an arrow pattern from memory;
- and, because the sash identifies a people, the asset carries `nation` and `communityReview` and therefore
  falls under §1's shipping rule. It waits.

No Voyageur asset is authored for slices 1–3. Recorded here so the next artist does not have to rediscover
the question.

---

## 5. Rule 3 — No sacred items as props

The artist usually will not know. So this rule is not "use judgement". It is a default-deny list, two tests
that need no cultural knowledge, and an escalation route that already exists in this repository.

### 5.1 Two tests an artist can apply without knowing anything

1. **The ceremony test.** *Would this item be worn, carried, burned, sung, played or handled at a ceremony?*
   If yes, or if you cannot tell, treat it as yes.
2. **The signal test.** *Is this item's job in the composition to tell the player that this person is
   Indigenous?* If yes, it is being used as a prop. That is the definition of the failure, and it applies
   even to an item that is not itself restricted.

Test 2 is the one that catches the case an artist thinks is safe: a drum in the background of a market
scene, put there because the scene "needed something".

### 5.2 Presumed restricted — not drawn without Tier 3, in any form

Including background, silhouette, decoration, icon, UI ornament and loading art:

- headdresses and warbonnets;
- eagle feathers, and any feather worn, carried, tied or displayed;
- pipes;
- drums, rattles, and any hand-held instrument;
- masks and transformation masks;
- medicine bundles, pouches and their contents;
- sage, sweetgrass, cedar and tobacco as ceremonial materials, and any depiction of smudging or burning;
- regalia of every kind, including dance regalia, jingle dresses, ribbon skirts and ribbon shirts;
- totem poles, house posts, crest figures and crest designs;
- petroglyphs, pictographs and rock art;
- wampum belts;
- burial sites, grave markers and any funerary object;
- ancestral remains and their representation, at any level of abstraction.

### 5.3 Never, regardless of tier

No item in §5.2, and no item added to it by review, may ever be: a collectible, a quest objective, a
pick-up, a reward, a stamp, an achievement icon, a physics object, a destructible, a decoration in a menu,
or a hat the player equips. Not after review, not with permission, not "tastefully". The traversal-and-tap
loop in this game turns everything it touches into a prop, and the answer is to keep these things out of it.

### 5.4 Ambiguous by design, and named rather than assumed

These are widely used as generic Canadian symbols and are not generic. Each is `OQ-REVIEW-10`:

- **the inuksuk** — a real Inuit structure, used on flags, road signs and an Olympic logo;
- **the canoe and the kayak** — Indigenous technology, and slice 4's locomotion mode;
- **the dogsled and the qamutiik** — slice 10's locomotion mode;
- **the totem pole** — routinely drawn in Canadian tourist art by people with no connection to the nations
  whose poles they are.

None of these may be drawn as a recognisable cultural object before `OQ-REVIEW-10` is answered. A canoe as a
*vehicle the player rides* is exactly the prop case in §5.1's second test, and slice 4 depends on it.

### 5.5 The escalation route already exists

When an asset is blocked, it goes to `assets/refs/_pending/<subject>/` with a status line and a reason,
exactly as `rcmp-red-serge` does today, and the palette entry it would need stays out of the allow-list so
the lint blocks the SVG as well as the process blocking the artist. That precedent — a blocked asset marked
as blocked rather than quietly dropped — is the pattern this document adopts wholesale.

---

## 6. Rule 4 — No caricature, and identical proportions

This is the checkable one, and it should be checked mechanically rather than argued about.

### 6.1 The canon is already written

`assets/style/art-bible.md` §7 fixes it: **6 heads tall, no exceptions**, with a measurement table (head
width 0.85 heads, shoulder 2.20, hip 1.80, hip-to-sole 2.80, hand 0.55, foot 0.70, eye line at 0.50 of head
height, eye spacing one eye-width). "Costume distinguishes characters. Stature never does."

### 6.2 What `verify-art` measures

Added to the protocol in `.claude/agents/art-verifier.md`, recorded in `docs/art-verification.json`:

| Check | Pass condition |
|---|---|
| Total height in heads | 6.00, ±3 % |
| Every row of the §7 table | within ±3 % of canon, measured from the SVG part bounding boxes |
| Eye line and eye spacing | within ±3 % |
| Nose | present and ≥ 6 px, and ≤ 1.5× the canon nose extent |
| Mouth width | ≤ 0.45 of head width |
| Skin colour | every fill is a `skin-1`…`skin-6` ramp entry from `palette.json` |
| Stroke widths | 6 / 4 / 3 px per the art bible, identical across characters |

±3 %, not the ±10 % landmarks get: a character is authored *to* the canon, not traced from a photograph, so
a 10 % drift is a decision somebody made.

Every character is measured, not only the ones this document's other sections apply to. A caricature
produced by drawing one character shorter, wider or more detailed than the rest is caught by comparison, and
comparison only works if everyone is compared.

### 6.3 The grey-face test

The blind-identification protocol the project already trusts, pointed at this rule:

1. render the character's face with every skin and hair ramp replaced by the same neutral grey;
2. show it to the `art-verifier` with no filename, no label and no context;
3. ask what ethnicity the face reads as.

**Pass: the verifier cannot tell.** If the geometry of a nose, a lip, a brow, an eye or a jaw identifies an
ethnicity with the colour removed, that geometry is doing work it must not do, and the shapes are wrong.

Record the answer verbatim in `docs/art-verification.json`, including a pass, so the record shows the test
ran and what it produced. And note the limit honestly: a model asked "is this a caricature?" will say no.
The grey-face test is phrased to avoid that by asking for an identification rather than a judgement, and it
is still a model's answer. It catches the crude cases. It is not Tier 3.

### 6.4 Failure modes named, so they are searched for

- exaggerated nose, lips, brow ridge, jaw or eye shape on any character;
- one skin tone drawn with different facial geometry from the others;
- a hair shape offered with only some skin tones (§8.2);
- accessories, weathering or extra detail on one character and not others;
- a squint, a scowl or a fixed expression attached to one appearance;
- an accent written into dialogue — no phonetic spelling, no dropped letters, no broken grammar, in either
  language, for any character. This game's audience is people learning English and French.

---

## 7. When a player reports a problem

`.github/ISSUE_TEMPLATE/cultural-accuracy.yml` exists and routes here. What happens next:

1. **The depiction is disabled first, then discussed.** Remove or blank the asset, or pull the string, in
   the next commit. Not after the thread resolves. With no Tier 3 reviewer, the project cannot adjudicate,
   and a project that cannot adjudicate must default to not showing the thing.
2. It is triaged as a **correctness bug**, on the same footing as a wrong answer (the template already says
   so; this is the mechanism behind it).
3. The fix goes back through `content-author` → `content-verifier` → this document, at the full bar. A
   community correction never gets a lower bar than a new asset, and never a higher one.
4. The asset does not return until the report's substance is addressed, in writing, in the issue.

### The asymmetry, stated plainly

**A report from a member of the depicted nation can fail a depiction. No comment on a public issue can pass
one.** Identity is not verifiable in a tracker, so approval by issue thread would be approval by anyone
willing to claim standing — and the incentives run one way. Refusal costs the reporter something; approval
costs an impostor nothing.

So Tier 3 is asymmetric while it is empty: negative signal is acted on immediately, positive signal is
recorded and changes nothing. That is uncomfortable and it is the correct default.

---

## 8. The character creator

The first thing a player meets, and the first place they decide whether the game is for them. Nothing here
depicts a nation; all of it depicts people. `docs/stories/TN-CREATOR-character-creator.md` is the
acceptance criteria and `OQ-CREATOR-5` routed the naming question here.

### 8.1 Skin tone

- Six ramps, `skin-1`…`skin-6`, derived by one rule so no tone is a stylistic afterthought
  (`palette.json`, `assets/style/art-bible.md` §8). All six are offered. Six is a floor, not a target.
- **Names are not colour words and not food words.** No "tan", "olive", "caramel", "chocolate", "honey",
  "peach", "nude", "flesh". No ethnicity or nationality in a tone name, ever.
- Recommended naming (`OQ-REVIEW-6`, answering `OQ-CREATOR-5`): **ordinal with a lightness cue** —
  `creator.skin.1` = "Skin tone 1 (lightest)" / « Teint 1 (le plus clair) », through
  "Skin tone 6 (deepest)" / « Teint 6 (le plus foncé) ». It carries the ordering the art bible already
  states, gives a screen-reader user something meaningful, translates without connotation, and names nobody.
  The rejected alternative is unnamed swatches, which fails the "colour is never the only signal" rule.
- **No tone is pre-selected.** The creator randomises on open (§8.3). `CharacterSlot.default` is used for
  NPC documents and save recovery, and is never rendered as a pre-chosen option — see `OQ-REVIEW-7`, which
  is a real conflict between the schema and the art bible, not a nicety.

### 8.2 Slot independence — the mechanical anti-caricature check

> **Every option in every slot is available with every option in every other slot.**

No hair shape restricted to some skin tones. No garment restricted to some hair. No feature that appears
only in one combination. `character.schema.json` has no cross-slot constraint field, which is the right
shape; the check is that none is ever added, and that the creator's UI does not implement a coupling the
data does not express. A test that opens the creator, picks each skin tone in turn, and asserts the option
count of every other slot is unchanged is enough to catch it.

Coupling is how a creator ends up with "the ethnic hair" — a category that exists nowhere except in the
implementation that created it.

### 8.3 The randomiser

"Surprise me" **draws uniformly over every option in every slot**. A randomiser weighted toward the lightest
tone, or toward one presentation, is a statement about who the default player is, made in code where nobody
reads it. Checkable: 1 000 seeded draws, every option appears, no option exceeds twice the expected share.

### 8.4 Hair

- Textures across the full range, including coily and tightly curled shapes, as *shapes* — built to the same
  outline and stroke rules as every other part, never as a texture fill (the art bible forbids pattern fills
  anyway).
- Absence is a statement. A creator with five straight-hair options and one curl has said something.
- Covered heads are a separate slot (§8.7), so a player can wear a head covering with any hair and any tone.

### 8.5 Body shape

The art bible's canon fixes shoulder and hip width, which means every character currently has the same body,
which is its own erasure. The refinement, and it keeps the anti-caricature rule intact:

- **Skeletal proportions are identical and non-negotiable:** total height, head height and width, eye line,
  eye spacing, limb lengths, hand and foot size. These are what "identical cartoon proportions" protects —
  nobody is drawn taller, more heroic or more detailed than anybody else.
- **Body mass may vary** as its own slot — torso and limb width within a stated range — provided it is
  independent of every other slot (§8.2) and of role. If the game ever ships more than one body, no role
  correlates with one: the official, the elder, the child in a story role and the player draw from the same
  set.
- Slice 1 has no body slot and the art budget will not carry one. `OQ-REVIEW-8`: commit to adding it or
  decline it out loud. Silently shipping one body forever is the outcome to avoid.

### 8.6 Gender presentation

- A **skin slot on one artboard with one proportion canon**, which is what `assets/style/art-bible.md`
  OQ-ART-08 already built for. Never a separate artboard, never a separate rig, never different proportions.
- At least three options, including one that reads as neither strictly masculine nor feminine.
- **Options are labelled by what is visible, not by identity claimed.** Hair, coat, build. No option is
  called "Boy", "Girl", "Male", "Female" / « Garçon », « Fille ».
- **No copy anywhere may require gender agreement in French about the player.** No « prêt(e) », no
  « vous êtes inscrit·e », no bracketed endings. FR strings are written so the sentence works for anybody:
  « Vous pouvez commencer », not « Vous êtes prêt(e) ». This is checkable — the FR bundle is scanned for
  `(e)`, `·e`, `-e)` and the like — and it belongs to the same rule set as the creator, because the creator
  is where the game first speaks to the player about themself.
- `OQ-CREATOR-2` already keeps a free-text name out of slice 1, which removes the other half of the problem.
- The officer's presentation (`OQ-LEVEL-3`, `OQ-ART-08`) is a PO decision, and either answer is a data
  change. It is not decided here; what is decided here is that it cannot change the proportions.

### 8.7 Religious dress

- Offered as a **head-and-garment slot**, independent of skin tone and hair (§8.2). Candidates: hijab,
  dastaar (Sikh turban), patka, kippah, tichel, a visible cross.
- **Reference-accurate, never approximated.** A dastaar has documented tying styles that differ by tradition;
  drawing "a turban shape" is §4's invented-pattern failure in another medium. Each option cites a
  reference, in `assets/refs/references.json`, like a landmark.
- **Never removable as a gameplay action**, never a disguise, never part of a puzzle, never something an NPC
  comments on.
- **Never a costume for otherness.** If religious dress appears only on background NPCs and never as a player
  option, the game has used it to mark strangers. Either it is a player option or it is not in the game.
- Options are **named by the garment's own name** in both languages, untranslated: "Hijab" / « Hijab »,
  "Dastaar" / « Dastaar », "Kippah" / « Kippa ».
- **The game depicts; it does not argue.** Religious dress and the law is live political ground in Canada.
  The game takes no position, and asks a question about it only if *Discover Canada* does, verified under
  ADR-0003 like any other.

### 8.8 Visible disability

The honest constraint first: this game's traversal is skating, walking, canoeing, cycling and dogsledding.
A cosmetic option that the locomotion system cannot animate is a promise the game breaks in the first ten
seconds.

- **The rule:** an option is offered only if it works in **every** locomotion mode in the game without
  special-casing. If it cannot, it is not a cosmetic slot and must not be offered as one.
- Options that meet that bar today: glasses, a hearing aid or cochlear implant, a visible prosthetic limb,
  vitiligo as a skin-slot variant, a birthmark, a cane held in the idle pose.
- A **wheelchair is not a cosmetic option.** It is a locomotion mode, an animation set and a level-design
  constraint. It is either a real design commitment with its own slice, or the game does not offer it — and
  `OQ-REVIEW-8` asks which, because quietly omitting it is a decision made by not making one.
- No option affects speed, reach, difficulty or any number. There are no stats; there must be no exception.
- **No NPC's disability is a plot point, a lesson or a source of pity.** Nobody is inspiring for existing.
- The game's own accessibility (`CLAUDE.md`, Accessibility) is not representation and does not substitute
  for it, and representation does not substitute for the accessibility work either.

---

## 9. Words

### 9.1 Terms, EN and FR

| Use | Do not use |
|---|---|
| Indigenous (capitalised) / Autochtone (capitalised) | Aboriginal, Native, Indian — except when quoting law (§9.2) |
| First Nations / Premières Nations | Indian band (outside legal citation), tribe |
| Inuit (plural), Inuk (singular) / les Inuit, un Inuk | Eskimo, "Inuits" with an s |
| Métis / Métis | Half-breed, mixed-blood |
| the nation's own name, first | a regional or colonial label standing in for it |

Never "our Indigenous peoples", "Canada's Indigenous peoples" or « nos peuples autochtones ». The possessive
is the claim.

### 9.2 Legal and source terms

*Discover Canada*, the Constitution Act, 1982 and the Indian Act use "Aboriginal" and "Indian". When
quoting, citing or asking a question about those texts, the source's term is used and marked as the source's
term. Everywhere else, §9.1 applies. A question that must use "Aboriginal" because the exam does carries its
`FactSource` like any other, and that citation is what makes the usage legible rather than careless.

### 9.3 Endonyms are not translated, and living people are not past tense

- **A nation's own name for itself is identical in the EN and FR strings.** Mi'kmaq is Mi'kmaq in French.
  Anishinaabe is Anishinaabe. Kanien'kehá:ka is Kanien'kehá:ka. Diacritics and orthography are copied
  exactly, from `nationSource`, in both languages. A `LocalizedText` whose `en` and `fr` differ on a nation's
  own name is a defect the content gate can catch.
- **No living people in the past tense.** "The Mi'kmaq lived on the Atlantic coast" makes a people into a
  museum exhibit. "The Mi'kmaq live in Mi'kma'ki" is a sentence about now. Where the sentence really is
  historical, it says when: "In 1605, ...". A verifier can flag past-tense verbs whose subject is a nation
  name, which is a crude check that finds the common case.
- Grade-6 plain language (CLAUDE.md) applies here as everywhere, and is not an excuse for simplifying a
  people into a sentence.

### 9.4 Questions about Indigenous peoples

They ship, under ADR-0003, without Tier 3, and here is the boundary:

- **May ship:** a question that paraphrases what *Discover Canada* says, with its chapter, `sourceHash`,
  `asOf`, evidence quote and both languages, using §9.1's terms except where §9.2 applies.
- **May not ship without Tier 3:** a question whose prompt, options or explanation states something *beyond*
  the source; any question illustrated with a depiction; any explanation that adds context, correction or
  commentary the source does not contain. Adding context is the right instinct and it is not an agent's to
  add.
- `OQ-REVIEW-9` is the tension underneath this: *Discover Canada* is both the exam this game teaches and a
  Crown document about Indigenous peoples, and its framing of some history is contested. The
  recommendation is faithfulness — a player sitting the test is examined on that document, and a game that
  quietly rewrites it fails them twice — and the place to put anything more is an "About this place" panel
  (§10) written by somebody who may write it, never a silent edit to a question.

---

## 10. Land acknowledgement

Ottawa sits on unceded Algonquin Anishinaabe territory. Slice 1 ships a level there. So this has to be
answered before the level, not after it.

### 10.1 Two different things, kept apart

- **A territorial fact** — "Ottawa is on the unceded traditional territory of the Algonquin Anishinaabe
  Nation." A citable statement, verifiable against a cited source, written by the `content-author` and
  verified by the `content-verifier` under ADR-0003 exactly like any other `FactClaim`. **An agent may write
  this**, because it is a fact with a source, and it is refutable.
- **An acknowledgement** — "We acknowledge that we live and work on...". A statement of relationship,
  responsibility and intent, in the first person, on behalf of the project. **An agent may not write this.**
  A model has no relationship to acknowledge, and a boilerplate acknowledgement is worse than none: it is
  the exact shape of claim this project has spent its history removing — words asserting something that was
  never true.

### 10.2 Recommendation

**The game states the territorial fact. It does not perform an acknowledgement in an agent's words.**

- **Where:** an **"About this place"** panel per level, opened from the pause menu and from the credits
  screen — DOM, ARIA, keyboard, single-switch, EN and FR, like every other screen. First line is the
  territorial fact. Also in the repository `README.md`, where the project speaks in its own voice.
- **Not:** a modal on level entry that the player dismisses to get to the game; a splash card; a collectible;
  an achievement; a line an NPC delivers; a stamp in the passport. Anything the player taps past to reach
  gameplay teaches that this is a thing you tap past.
- **Always available, never blocking.** A player who wants it can always reach it; a player mid-level is not
  interrupted by it.
- **Sourced.** The panel names where the territorial statement comes from, and the source is the nation's own
  material where one exists.
- **The project's own acknowledgement**, if there is to be one, is written by the project owner in their own
  words and signed. It stays absent until then — an empty section is honest; a generated one is not.
- `OQ-REVIEW-4` is the decision. Until it is answered, the "About this place" panel ships with the sourced
  territorial fact and nothing else.

### 10.3 What this obliges

Naming the territory and then depicting nobody from it is a half-step, and this document should say so
rather than let it pass as sufficiency. The panel is the minimum honest thing a project with no Tier 3
reviewer can do. It is not the thing that would be right.

---

## 11. Checklist before a depiction ships

Every box, in order. A "no" stops the asset; it does not lower the bar.

**Tier 1 — mechanical**
- [ ] Every colour is in the `palette.json` allow-list; skin is a `skin-1`…`skin-6` ramp.
- [ ] Every proportion in the art bible §7 table measures within ±3 % (§6.2).
- [ ] Slots are independent; no cross-slot coupling exists in data or in the UI (§8.2).
- [ ] EN and FR text is present for every string; endonyms match across languages (§9.3).
- [ ] Every shipped file is credited in `assets/credits.json` (ADR-0004).

**Tier 2 — agent**
- [ ] Blind identification names the intended subject (`verify-art` protocol).
- [ ] Grey-face test: the verifier cannot name an ethnicity from the geometry (§6.3).
- [ ] If Indigenous: `nation` is present, specific, and not on the deny-list (§3.1).
- [ ] `nationSource` resolves and contains that name (§3.2).
- [ ] Every visible design element traces to a cited reference; nothing is "inspired by" (§4.2).
- [ ] Nothing on the presumed-restricted list appears, in any form (§5.2).
- [ ] No item in §5.2 is a prop, pick-up, reward or physics object (§5.3).
- [ ] No accent, no phonetic spelling, no past tense about living peoples (§6.4, §9.3).
- [ ] Terms match §9.1, or cite the legal source under §9.2.

**Tier 3 — community**
- [ ] `communityReview.status` is `granted`, naming a person or organisation and a date.
- [ ] If it is anything else, and §1's shipping rule says the asset needs Tier 3: **it does not ship.**

---

## 12. Open questions

Questions, with recommendations, in the format `docs/stories/` uses. Nothing in this document depends on an
answer nobody has given.

- **`OQ-REVIEW-2` — who is the Tier 3 reviewer, and is there money for one?** This is the decision only the
  project owner can make, and it is the load-bearing one. *Recommendation:* engage a **paid** reviewer —
  a nation's own communications or culture office, a cultural centre, a First Nations/Inuit/Métis
  organisation, or a named consultant — before any work in §1's blocked list begins. Paid, not asked as a
  favour: unpaid cultural review of an open-source project is an ask that this project would not make of a
  developer. If the answer is that there will be no reviewer, say so and take the consequence in §1's last
  subsection: no nation is depicted, anywhere, and slice 4 is redesigned. Both answers are shippable. Only
  the unanswered version is not.
- **`OQ-REVIEW-3` — does slice 4 (Mi'kma'ki) start before `OQ-REVIEW-2` is answered?** *Recommendation:* no.
  The level's subject *is* the depiction, so there is no thin version of it, and its canoe locomotion runs
  straight into `OQ-REVIEW-10`. Re-order `docs/plan/slices.md` so a level with no blocked dependency runs in
  that position, rather than starting slice 4 and discovering this mid-flight. Routed to the coordinator;
  `docs/plan/` is not this document's to edit.
- **`OQ-REVIEW-4` — the land acknowledgement: does the game make one, and who writes it?**
  *Recommendation:* §10.2 — the game states a sourced territorial fact in an "About this place" panel,
  written and verified by agents under ADR-0003; a first-person acknowledgement is written by the project
  owner in their own words or stays absent. An agent-written acknowledgement is not one of the options.
- **`OQ-REVIEW-5` — the schema fields this process needs do not exist.** `CharacterDocument.nation` is
  optional and unconstrained; there is no `indigenous`, no `nationSource`, no `communityReview`, and no
  territory field on a level or a POI. As it stands, §3 is enforced by nothing.
  *Recommendation:* the architect adds them in task 1.2 as described in §3.2, with `indigenous` required
  (recording the judgement rather than defaulting it, like `FactClaim.factual`) and `nation` conditionally
  required on it. Until then, §1's shipping rule holds anyway, so nothing ships unchecked — but the rule is
  held by prose, and this project does not trust prose.
- **`OQ-REVIEW-6` — skin tone option names (answers `OQ-CREATOR-5`).** *Recommendation:* "Skin tone 1
  (lightest)"…"Skin tone 6 (deepest)" / « Teint 1 (le plus clair) »…« Teint 6 (le plus foncé) », per §8.1.
- **`OQ-REVIEW-7` — `CharacterSlot.default` forces a default skin tone, and the art bible says no tone is
  the default.** A real conflict between `content/schemas/character.schema.json` and
  `assets/style/art-bible.md` §8. *Recommendation:* the creator randomises all slots on open and never
  renders `default` as pre-chosen; `default` remains in the schema for NPC documents and save recovery.
  Needs the architect and `ui-a11y` to agree, and `TN-CREATOR-01` says "each group already has one option
  chosen", which stays true under randomisation.
- **`OQ-REVIEW-8` — body shape and wheelchair: commit or decline, out loud.** *Recommendation:* reserve the
  body-mass slot in the rig contract now so the canon does not have to be reopened later (§8.5), ship one
  body in slice 1, and decide before F2 whether a wheelchair becomes a real locomotion mode. Write the
  answer down either way. Not deciding is how a game ends up with one body forever and no record of anybody
  having chosen that.
- **`OQ-REVIEW-9` — *Discover Canada*'s framing of Indigenous history is contested, and it is the exam.**
  *Recommendation:* §9.4 — faithful paraphrase in questions, no agent-added context, and anything more goes
  in the "About this place" panel written by somebody who may write it.
- **`OQ-REVIEW-10` — the inuksuk, the canoe, the kayak, the qamutiik, the totem pole.** Generic Canadian
  symbols that belong to specific peoples, and three of them are planned locomotion modes (slices 4, 10).
  *Recommendation:* treat each as a Tier 3 subject in its own right and answer them together with
  `OQ-REVIEW-2`, before the slices that need them are scheduled — not while they are being built.
- **`OQ-REVIEW-11` — who owns this document?** It is currently the PO's, written by an agent, governing art
  and content authored by other agents. *Recommendation:* the PO holds the text; changes to §1, §5.2 and §10
  need the project owner, because they are the parts an agent has no standing to relax.

---

## 13. Obligation

Written in the ADR-0009 marker format, checked by `scripts/check-obligations.mjs` on every `make lint`, so
that the question in `OQ-REVIEW-2` cannot be quietly outlived. The blast radius is the deploy, deliberately:
this is the one commitment in this project whose lapse should be loud.

- **OBLIGATION due=2026-12-08 owner=po** — put `OQ-REVIEW-2` to the project owner and record the answer in
  §1 of this document: either a named Tier 3 reviewer and how they are engaged and paid, or a written
  decision that no nation will be depicted and that slice 4 is redesigned. If the question is still open on
  that date, re-date it with a note saying what was tried — re-dating with a reason is legitimate
  (ADR-0009); letting the date pass in silence is what this marker exists to prevent. Until it is answered,
  §1's shipping rule stands and nothing in its blocked list may be authored.
