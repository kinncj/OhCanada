# TN-KINGSTON: Kingston, building Canada from 1812 to 1945

**Intent.** A player walks Kingston's lakeshore in portrait with one thumb. They stand at Fort Henry, at
Kingston City Hall, at the Kingston Mills locks and at the Royal Military College, and at each one they hear one
true sentence from *Discover Canada*. Then they are asked about the building of the country, from the War of
1812 to the end of the Second World War. The level teaches before it asks, and it asks only its own subject.

**Status: Proposed, with the product owner's rulings made (K-0.9, 2026-09-25). Kingston does not ship
before ADR-0068 §7's condition holds.** `docs/plan/kingston.md` §1 records that condition as met by stops.
This story fixes what Kingston is, so the work can be planned and every gate knows what to expect. It authors
no question, no line and no blurb. It fixes what each one is **about**, and which guide sentence it rests on.
The words are the content author's to write and the verifier's to grant. The content steps (re-filing 65
questions under `building-canada`, and the verifier's re-grant) are obligations in ADR-0068, and the map steps
are obligations in ADR-0069.

Read `README.md` in this directory first. It fixes the shared markers, the scene probe, the event names and
the single-switch contract these scenarios use. `TN-LEVEL-ottawa.md` is the full level story whose shape this
one follows.

| What | Decided by |
|---|---|
| The subject, `building-canada`, and its 65 questions | ADR-0068 §1–§2 |
| That Québec City keeps `history` (32) and asks nothing else | ADR-0068 §3 |
| Journey slot 5, between Ottawa and Toronto, and unlocking after Ottawa | ADR-0068 §9 |
| The map pin, in the corridor inset with Ottawa and Toronto | ADR-0069 §5 |
| What a landmark may say | ADR-0056 §3 (the strike-the-name test) |
| What the level may ask | ADR-0057 (taught first), ADR-0048 (a stop asks its own question or nothing) |
| What it may depict of people | `docs/content-review.md` §1, §4.4, §9.4; ADR-0068 §10 |
| The subtitles, the stops, the giver, the territory statement, and OQ-KINGSTON-1 to 3 | **This story, "Rulings (K-0.9)"** |

## The subject

**`building-canada`**: the War of 1812 and the defences built after it, the rebellions and responsible
government, the Province of Canada, Confederation and the Dominion, when each province and territory joined,
the Red River and the North-West, the railway, the South African War and the First World War, the vote for
women, the years between the wars, and the Second World War. It holds 65 questions once ADR-0068's re-grant
lands, which is 35 above the floor.

---

## Rulings (K-0.9)

Made by the product owner role on 2026-09-25, on `docs/plan/kingston.md` step K-0.9. Every ruling gives its
reason. Where a ruling changes something this story proposed earlier, it says what changed.

### Ruling 1: the two subtitles, which are also the two exam-row labels

| Key | EN | FR |
|---|---|---|
| `level.quebec-city.subtitle` (**changes**) | Early Canada | Les débuts du Canada |
| `level.kingston.subtitle` (**new**) | Building Canada | La construction du Canada |

**Why these words.**

- **Each subtitle is also the exam's name for the subject** (`app/bootstrap/subjects.ts`). So each one has
  to make sense on its own on a result row, next to nine other rows, to a player at CLB 4.
- **They read as three eras, one after another, with the label that already ships.** The Prairies' subject is
  `modern-canada`, and its subtitle is "Modern Canada" / « Le Canada moderne ». A result screen that says
  "Early Canada", "Building Canada" and "Modern Canada" tells a new reader the order without a date. None of
  the three words overlaps another: *early* is before, *building* is during, *modern* is after.
- **No dates in the label.** The line between the two banks is a remit, not a year (ADR-0068 §1). Page 28's
  abolition arc runs to 1853 and stays in `history`. `building-canada` holds Nunavut in 1999 (`hist-52`) and
  apologies from 1988 and 2006 (`hist-93`, `hist-63`). A label reading "1812 to 1945" would be false on
  those rows.
- **Short words.** "Early" and "building" are among the first thousand English words. The label fits one
  line on the result row at 200% text.
- **French: « La construction du Canada », not « Bâtir le Canada ».** This story proposed « Bâtir » before
  this ruling. « Construire » and « construction » are basic vocabulary, and « bâtir » is less common for a
  French learner at CLB 4. A noun phrase with an article also matches how the other French subtitles are
  written (« L'histoire du Canada », « Le Canada moderne », « Les régions du Canada »).
- **« Les débuts du Canada »** means "Canada's beginnings". It covers the First Peoples and New France
  without claiming that Canada existed as a country then.

**What it costs, as ADR-0068 already records.** A player's saved exam history keeps its `history` rows, and
from now on they are labelled "Early Canada", even where the question is now in `building-canada`. That is a
relabel. There is no migration.

### Ruling 2: the stops, 4 landmarks and the giver

**Four landmarks. Each one is real, and each is drawn from dated photographs.** The table replaces the one this
story proposed earlier. What changed: the City Hall blurb, and the stop where `hist-39` is first taught (see
the notes under the table).

| # | Stop `id` | Landmark (real, present-day) | Card heading EN / FR | What its blurb tells (the guide's sentence, paraphrased) | Its own question (asked when engaged with no task running) |
|---|---|---|---|---|---|
| 0 | giver | The existing `guide` character (Ruling 3) | — | — | — |
| 1 | `fort-henry` | Fort Henry on Point Henry: the limestone walls of the fort, as photographed. **No figures.** | Fort Henry / Fort Henry | Britain paid for costly defences in Canada, including Fort Henry at Kingston. Today these are popular historic sites. (p. 30) | `hist-97` |
| 2 | `kingston-city-hall` | Kingston City Hall, the domed limestone building on the harbour, as photographed. **No statue, and no figure.** | Kingston City Hall / Hôtel de ville de Kingston | In 1840, Upper Canada and Lower Canada were joined into one Province of Canada. (p. 32) | `hist-44` |
| 3 | `kingston-mills` | The Kingston Mills locks on the Rideau Canal: the stone lock chambers and the wooden gates, as photographed. **No figures.** | Kingston Mills locks / Écluses de Kingston Mills | After the War of 1812, the Duke of Wellington chose Bytown (Ottawa) as the end of the Rideau Canal. The canal was part of a set of forts meant to stop another American invasion. (p. 30) | `hist-39`, only if the verifier grants it as asked at Kingston (Ruling 5) |
| 4 | `royal-military-college` | The Royal Military College of Canada on Point Frederick, drawn from photographs. The contract picks the view. **The buildings and the college's own red-white-red flag, flown as the photographs show it (amended 2026-09-26, below). No cadets. No crest or badge beyond what the flag itself carries, simplified.** | Royal Military College of Canada / Collège militaire royal du Canada | Canada's red-white-red flag pattern comes from the flag of the Royal Military College in Kingston, founded in 1876. (p. 79) | None. `sym-05` is graded at Vancouver (ADR-0030 §2), so this stop asks nothing of its own (ADR-0048) |

**Why City Hall now tells the Province of Canada, and not Macdonald.** Before this ruling, City Hall's card
said that Macdonald was a lawyer in Kingston. A card that names a person at a building makes the player think
the person used the building. The guide does not say that, and that implication is why Bellevue House was
refused (ADR-0056 §3). ADR-0068 had already named the Province of Canada (p. 32) as something City Hall can
tell. It also gives the stop a question of its own, `hist-44`. **Macdonald is still taught, exactly as the guide
states him.** The guide says, in its own lines at City Hall, that he was a lawyer in Kingston and became Canada's
first Prime Minister in 1867 (p. 35, `hist-54`). A line spoken by the guide is about the country. A card is about
the building.

**Why the Wellington sentence is also a Fort Henry line.** The pools are topics (TN-KINGSTON-05). `hist-39`
is a War of 1812 question, so it belongs in Fort Henry's pool. That pool is asked **before** the player reaches
Kingston Mills. So a line at Fort Henry tells the Wellington sentence first (ADR-0057). The Kingston Mills card
then tells it again, which is allowed (ADR-0030 §2). Without this, `hist-39` could be graded only in a pool
whose topic it does not share.

**Why four and not five or six.**

- **Budget.** `docs/plan/kingston.md` §2 measures the service-worker headroom at 226 KiB. That is below one
  median level's art, before Kingston adds anything. A fifth prop adds to a blocker that is already open.
- **Width.** Four landmarks at the ~1,600 px pitch give ~7,680 px, which is the median level. Québec City's
  fourth stop was refused on width at 10,848 px. Kingston should not start where that refusal ended.
- **Every other candidate fails a rule:**

| Candidate | Real? | Why it is not a stop |
|---|---|---|
| Macdonald statue, City Park | It was removed in 2021 | A thing that is not there is not drawn. **It is not a stop and it is not drawn anywhere in the level.** Anything more about Macdonald is OQ-KINGSTON-4, which this ruling does not decide. |
| Bellevue House | Yes | Its blurb would imply that Macdonald lived there. The guide does not say so (ADR-0056 §3). Refused before this ruling, and still refused. |
| The building where the Province of Canada's first parliament met (1841) | Yes | **The guide never says that Kingston was a capital or held a parliament.** A stop there would be chosen for a claim the guide does not make. No line, card or step may say that Kingston was the capital. |
| Murney Tower, Shoal Tower and the other Martello towers | Yes | The guide names none of them. A blurb could only retell Fort Henry's p. 30 sentence, so the stop would cost art and width and teach nothing new. |
| Cataraqui Cemetery (Macdonald's grave) | Yes | It is a funerary site (content-review §5.2 lists grave markers). It is not a prop. |
| Kingston Penitentiary | Yes | The guide has no sentence about it. |
| Sir John A. Macdonald Day, the $10 bill | Not places | The guide's p. 35 lines may say them. They are not drawn. |

### Ruling 3 (OQ-KINGSTON-1): the giver is the existing `guide`

**The quest giver is `content/characters/guide.json`, with no new rig and no new character.**

- It has `"indigenous": false`, no `nation` and no cultural markers. It is a present-day person in a beaver
  costume, which content-review §1 lists as able to ship without Tier 3. Its proportions are the canon's.
- It is already the giver on six levels, including Québec City, the other half of this history. A player
  will know it.
- A new character needs its own story, contract, rig art and blind run. It would also add art bytes to a
  budget that is already short (`docs/plan/kingston.md` §2, K-0.1).
- It is **not** `officer`. An officer in uniform at a fort and a military college would make a claim about
  an organisation that this level has no source for, like the re-enactors and cadets refused below.
- It portrays nobody: not Macdonald, Brock, Laura Secord, Tecumseh, Joseph Brant or Louis Riel.
- **It speaks every teaching line, including the lines on Tecumseh and on the Métis of Red River.** It is not
  drawn as Indigenous (content-review §1, item 4), and those lines are faithful paraphrase with nothing added
  (§9.4).

### Ruling 4 (OQ-KINGSTON-3): content-review §1, item 5 does not apply to Kingston as scoped here

**Ruling: Kingston is not "a level whose subject is a nation's territory or history".** ADR-0068 §10's reading
stands, and this story ties the design to it so that the reading stays true:

- The subject is `building-canada`, a remit about the country. Six of its 65 questions concern Indigenous
  peoples (`hist-34`, `hist-52`, `hist-55`–`hist-58`). No stop, card, subtitle or step prompt is about a
  nation.
- No Indigenous person is drawn, and no object belonging to a nation is drawn (below).
- The territory statement names nobody, because the guide names nobody at Kingston (Ruling 6).

**The tripwire.** If a later change makes a stop, card, subtitle, step prompt or the level's title about a
nation's territory or history, item 5 applies. Then the level waits for Tier 3, which does not exist today.
TN-KINGSTON-06 checks this.

**What this ruling is not.** It is a scope reading of which shipping-rule item a design falls under. It grants
no cultural sign-off (content-review §1: "No agent may grant cultural sign-off"). It lowers no bar, and it
moves no `communityReview` status. It was made by the product owner role, and that role is an agent. The
ADR-0068 marker asks the product owner to rule, and this is that ruling. **The project owner may overturn it.**
If they do, Kingston waits for Tier 3. Until then, it blocks nothing.

### Ruling 5 (OQ-KINGSTON-2): if the verifier refuses `hist-39`'s "Kingston." at Kingston

**Kingston Mills keeps the Rideau blurb either way.** If the distractor is refused:

1. The Kingston Mills card still tells the Wellington sentence. **When it is engaged with no task running,
   it asks nothing** (ADR-0048's "or nothing", ADR-0056 §6's "acceptable" case).
2. `hist-39` is taken out of Fort Henry's pool. That pool still holds at least its count without it
   (Ruling 7).
3. `hist-39` goes back to the content author for a new distractor, then to the verifier for a new grant
   (K-1.3). It does not go back to Québec City (ADR-0068 §5). When it is granted, it goes back into the pool
   and becomes Kingston Mills' own question again.

**Why the stop does not tell a different p. 30 sentence instead.** The Wellington caption is the only
sentence in the guide about the Rideau Canal. The other p. 30 sentences are about Fort Henry (`hist-97`, which
is Fort Henry's own), the border (`hist-37`), York (`hist-38`) and Châteauguay (`hist-36`). Put on the locks,
any of them would pass the strike-the-name test, but it would teach nothing about what the player is looking
at. A true sentence about the thing drawn, with no question, is better than a question with no reason to be
there.

### Ruling 6: the territory statement, and why it names no nation

Kingston stands at Katarokwi, on land that Haudenosaunee and Anishinaabe peoples speak of as their
territory. **The level cannot print either name, or "Katarokwi", because the guide does not print them for
Kingston.** Under the product owner's ruling recorded in ADR-0051 and content-review §3.2 (amended
2026-09-17), a level's territory statement takes its names from the guide and from nothing else. I searched the
cached guide text. It names Kingston three times (pp. 30, 35 and 79), and none of those sentences names a
people. "Haudenosaunee", "Anishinaabe" and "Katarokwi" do not appear anywhere in it. "Iroquois" (p. 25) and
"Mohawk" (p. 28) do appear, but not about Kingston. Printing them here would claim something the guide does
not say.

**So:**

- `territory.nations` is `[]` and `nationsAbsentBecause` is `"source-names-none"`, as on Toronto and eight
  other levels.
- **The statement is a territorial fact, not an acknowledgement** (content-review §10.1). It is not in the
  first person, not in the project's voice, and not "we acknowledge". An agent may not write an
  acknowledgement, and OQ-REVIEW-4 still holds it.
- **It cites p. 30**, the Fort Henry sentence. It does not cite p. 35, because a territory panel whose only
  source sentence is about Macdonald would take the place that OQ-KINGSTON-4 keeps for whoever may write
  that context. It does not cite p. 79, because that sentence is about the flag.
- **The intended shape, for the author to write and the verifier to grant:** EN "This level is set in
  Kingston. *Discover Canada* names Fort Henry at Kingston as part of a costly defence system that Britain
  paid for, and says it is a popular historic site today." FR « Ce niveau se déroule à Kingston. *Découvrir
  le Canada* nomme le fort Henry, à Kingston, parmi les défenses coûteuses payées par la Grande-Bretagne, et
  dit que c'est aujourd'hui un lieu historique populaire. »
- `sourcePublisher` is "Immigration, Refugees and Citizenship Canada" / « Immigration, Réfugiés et
  Citoyenneté Canada ».
- **It lives only in `about-this-place`.** It is never a line the guide speaks, never a modal on entry, and
  never a stamp (content-review §10.2).
- **This is the half-step that content-review §10.3 names, and this story says so.** The level names the land's
  nations nowhere. A player who knows Katarokwi will find it missing. Closing that gap needs a source other
  than the guide, and only the project owner can open one (ADR-0051).

### Ruling 7: the quest, what each stop teaches and what it asks

One quest of nine steps, in x order: `talk`, then for each landmark `visit`, then `read` (at most 4 passages
and 120 words at the stop), then `answer`. Four `answer` steps, each with a `count` of 4 or 5 (the author's
call, held by `a-quests-answer-steps-fill-in-one-sitting`). The pools share no ids. **The ids below are the
candidates.** The author may trim a pool but not below its count. Every id that stays must rest on a line or
card told **before** its step (ADR-0057).

| Step | Stop | Topic the prompt names (EN / FR) | Guide pages its lines teach | Candidate pool (`building-canada`) |
|---|---|---|---|---|
| 0 `talk` | giver | — | p. 29: the United States invaded in June 1812 | — |
| 1–2 | `fort-henry` | the War of 1812 / la guerre de 1812 | pp. 29–31: the invasion, Brock at Queenston Heights, Tecumseh and the Shawnee (§9.4), Châteauguay, York burned, Laura Secord, the border, Wellington and the Rideau Canal | `hist-33`, `34`, `35`, `36`, `37`, `38`, `39` (Ruling 5), `40`, `97` |
| 3–4 | `kingston-city-hall` | how Canada became a country / comment le Canada est devenu un pays | pp. 31–35: the 1837–38 rebellions, Durham, responsible government, La Fontaine, Nova Scotia 1847–48, the Province of Canada, the Fathers of Confederation, 1867, two levels of government, Dominion Day, Tilley, Macdonald as the guide states him | `hist-41`, `42`, `43`, `44`, `45`, `46`, `47`, `48`, `49`, `50`, `54`, `94`, `95` |
| 5–6 | `kingston-mills` | how Canada grew / comment le Canada s'est agrandi | pp. 34–37: when each province and territory joined, Cartier, the Métis of Red River and Riel (§9.4), Manitoba, the NWMP and the RCMP, British Columbia and the railway, the last spike, the Head Tax and its apology, Laurier | `hist-51`, `52`, `53`, `55`, `56`, `57`, `58`, `59`, `60`, `61`, `62`, `63`, `64` |
| 7–8 | `royal-military-college` | Canada at war and at home, 1899 to 1945 / le Canada en guerre et au pays, de 1899 à 1945 | pp. 38–44: the South African War, the First World War, internment, the vote for women, remembrance, the Depression, the Second World War | `hist-65` to `hist-93` |

**Not pooled: `hist-32` (the Montreal Stock Exchange, 1832, p. 29).** It fits no stop's topic. It stays in
the bank for Study and the exam. The author may place it at City Hall only if a line there teaches it and the
prompt still describes the pool truthfully.

**The dates in step 8's prompt are allowed.** A prompt describes one pool, and every id in that pool is about
1899 to 1945 except `hist-93`, the 1988 apology for wartime wrongs, which is about that war. A subtitle
describes a whole bank, and dates there would be false (Ruling 1).

**The closing line claims the route ("every question along the way"), not the place.**

---

## What is depicted, for the art agent

Each landmark needs an `assets/refs/references.json` contract (`expectedBlindAnswer`, photographs in
`referenceFiles`, `mustBeRight`, `neverAdd`) and a blind identification run (`make verify-art`) before it
ships. Simplified, reference-accurate cartoon shapes, never invented (CLAUDE.md, Art). The four subjects and
what each draws are in Ruling 2's table. The giver uses the existing `guide` rig (Ruling 3). Locomotion is
`walk`. There is no new mode or rig. The season and the weather are the art sheet's.

**Not depicted, and this is a rule, not a preference:**

- **No Indigenous person, in any scene, in any form**, including silhouettes and crowds (content-review §1,
  item 6). Tier 3 review does not exist. The level still teaches Tecumseh and the Métis of Red River, in
  words, faithfully (§9.4).
- **No Métis sash, and no object belonging to a specific nation** (content-review §1, item 2; §4.4). Nothing
  from content-review §5.2's list, in any form.
- **No Macdonald statue, anywhere.** The statue that stood in City Park was taken down in 2021. The art
  contract confirms the present state of every site from dated photographs. A thing that is not there is not
  drawn.
- **No figures at any landmark.** No soldier re-enactors at Fort Henry, no cadets at the college, no lock
  staff at Kingston Mills. A uniform on a figure is a claim about an organisation that this level has no
  source for.
- **No crest, badge or coat of arms** on the college or on City Hall. The college's flag is the one exception: see the amendment below.

**Amendment to Ruling 2, 2026-09-26, by the project owner** ("do whatever the official guide says"). The guide
connects the Royal Military College to exactly one thing: *"The red-white-red pattern comes from the flag of the
Royal Military College, Kingston, founded in 1876"* (p. 79). That flag is the college's link to the guide and the
subject of this stop's blurb, so it is drawn, flown as dated photographs show it and simplified by the art bible's
rules. Without it, blind runs `2c31c41bb3e4f0ea` and `e71e2696` read the building as a city hall and then as a
parliament, both named FAILs, because a Second Empire civic building says nothing about a college. The flag is a
claim the guide makes, so drawing it adds nothing the source does not say. Cadets, uniforms and any other
insignia stay refused.

## Player-facing copy (ratified by Ruling 1)

| Key | EN | FR |
|---|---|---|
| `level.kingston.title` | Kingston | Kingston |
| `level.kingston.subtitle` | Building Canada | La construction du Canada |
| `level.kingston.loading` | Getting the lakeshore ready. | Préparation du bord du lac. |
| `level.kingston.error.title` | We could not load Kingston. | Nous n'avons pas pu charger Kingston. |
| `level.kingston.play` | Play Kingston | Jouer à Kingston |
| `level.kingston.finishFirst` | Finish Kingston first. | Terminez d'abord Kingston. |
| `stamp.kingston.earned` | You earned the Kingston stamp. | Vous avez obtenu le tampon de Kingston. |
| `level.quebec-city.subtitle` (**changes**) | Early Canada | Les débuts du Canada |

**The loading line changed from the earlier proposal.** "Getting the waterfront ready." is already
Vancouver's line, and two levels must not share a waiting sentence. Kingston is on Lake Ontario. The loading
line names no landmark (`TN-NAMES-01`). A landmark's name appears only on its card and in the quest's own
words about going there. « Kingston » takes « à » and « de » and no article, like Toronto (README, French
style).

## Accessibility and bilingual coverage map

| Need | Where it is held |
|---|---|
| Keyboard-only and single-switch completion | TN-KINGSTON-08, TN-KINGSTON-10 |
| Canvas `aria-hidden`; events in the live region; cards and panel read by a screen reader | TN-KINGSTON-08, TN-KINGSTON-10 |
| Reduced motion on this level | TN-KINGSTON-08, TN-KINGSTON-10 |
| Step prompts in three wrapped lines at 390×844 and 200% text | TN-KINGSTON-05 |
| Colour is never the only signal (map pin, stamp) | TN-KINGSTON-07 |
| EN and FR for every string, card, line, prompt and subtitle | TN-KINGSTON-09, TN-KINGSTON-10, TN-KINGSTON-11 |

---

## TN-KINGSTON-01: Kingston asks its own subject, and it is a whole one

```gherkin
Feature: Kingston's subject is building-canada, split from history under ADR-0068
  Scenario: The level names its subject and the bank clears the floor
    Given the level document "content/levels/kingston.json"
    Then its "subject" is "building-canada"
    And "content/questions/building-canada/" holds at least 30 questions whose verification status is "verified" for the current sourceHash
    And no other level document names "building-canada"

  Scenario: The split left both halves whole
    Given the question banks "history" and "building-canada"
    Then "history" holds at least 30 verified questions
    And no question in "building-canada" rests on a source.quote that shares a proposition with a question in "history"
    And every id that was in "history" before the split is in exactly one of the two banks, under its old id

  Scenario: Kingston asks nothing from another subject
    Given any answer step of Kingston's quest
    Then every id in its questionPool is in "building-canada"
    And no landmark on the level asks a question from "symbols" or "history" when no task is running
```

## TN-KINGSTON-02: Kingston opens after Ottawa, and no player loses a level

```gherkin
Feature: Where Kingston sits in the journey
  Scenario: Kingston is fifth on the map and opens with Ottawa's stamp
    Given "journey" in "content/game.config.json"
    Then "kingston" is at position 5, after "ottawa" and before "toronto"
    And "kingston" follows "ottawa" in "unlockRules.order"
    When a player earns the Ottawa stamp
    Then "level-card-kingston" reports data-state "open"

  Scenario: Before Ottawa's stamp, Kingston is locked and says why in words
    Given a save with stamps for "halifax", "peggys-cove" and "quebec-city" only
    When I open the level select
    Then "level-card-kingston" reports data-state "locked"
    And its card reads "Finish Ottawa first." in English and « Terminez d'abord Ottawa. » in French

  Scenario: A save made before Kingston existed keeps every level it had
    Given a save with stamps for "halifax", "peggys-cove", "quebec-city", "ottawa" and "toronto"
    When the game with Kingston loads that save
    Then "toronto" and every level that save could open before are still open
    And "kingston" is open
    And the player's review history for every question id is unchanged
```

## TN-KINGSTON-03: the landmark cards tell what the guide says, and name only themselves

```gherkin
Feature: Kingston's landmark cards
  Background:
    Given the Kingston level is playable

  Scenario: Fort Henry's card
    When I engage "fort-henry"
    Then "poi-card" opens with the heading "Fort Henry"
    And the blurb says that Britain paid for costly defences in Canada, including Fort Henry at Kingston, and that these are popular historic sites today
    And the blurb states no date, height, first or role that p. 30 of the guide does not state

  Scenario: City Hall's card tells the Province of Canada and puts no person in the building
    When I engage "kingston-city-hall"
    Then "poi-card" opens with the heading "Kingston City Hall"
    And the blurb says that in 1840 Upper Canada and Lower Canada were joined as the Province of Canada
    And the blurb names no person
    And the blurb does not say that Kingston was a capital or that a parliament met there

  Scenario: The Kingston Mills card tells the canal sentence
    When I engage "kingston-mills"
    Then "poi-card" opens with the heading "Kingston Mills locks"
    And the blurb says that the Duke of Wellington chose Bytown (Ottawa) as the end of the Rideau Canal, which was part of a set of forts against another invasion

  Scenario: The college tells the flag sentence and asks nothing of its own
    Given no answer step is running
    When I engage "royal-military-college"
    Then "poi-card" opens with the heading "Royal Military College of Canada"
    And the blurb says that the flag's red-white-red pattern comes from the Royal Military College's flag, and that the college was founded in 1876
    And when I close the card with "poi-card-close" no "question-card" opens

  Scenario: Striking the landmark's name from any blurb leaves the guide's claim unchanged
    Given any point of interest on the Kingston level
    When its own name is struck from its blurb
    Then what is left is entailed by the passage its fact cites

  Scenario: Macdonald is taught as the guide states him, by the guide, and never drawn
    Given the quest lines spoken at "kingston-city-hall"
    Then one line says that Sir John A. Macdonald was a lawyer in Kingston and became Canada's first Prime Minister in 1867
    And no line or card says that Macdonald lived in, worked in, built or visited any building drawn on the level
    And no art key the level names depicts Macdonald or a statue of him
```

## TN-KINGSTON-04: Kingston Mills does not make its own distractor true

```gherkin
Feature: A question is fair where it is asked
  Scenario: The canal question is granted for Kingston before Kingston asks it
    Given "hist-39-wellington-and-bytown" is in any Kingston questionPool
    Then its current verification was granted after it was re-filed into "building-canada"
    And that grant records the verifier's ruling on the option "Kingston." as asked at Kingston

  Scenario: The canal sentence is taught before the canal question is asked
    Given "hist-39-wellington-and-bytown" is in the questionPool of the answer step at "fort-henry"
    Then a line of the visit step at "fort-henry" tells that Wellington chose Bytown (Ottawa) as the end of the Rideau Canal

  Scenario: If the ruling refuses the distractor, the stop keeps its card and asks nothing
    Given the verifier refused "hist-39-wellington-and-bytown" at re-grant
    Then no Kingston questionPool names it
    And the answer step at "fort-henry" still holds at least its count
    And when I engage "kingston-mills" with no task running, the card opens and no "question-card" opens
    And the question returns to the content author, not to Québec City
```

## TN-KINGSTON-05: The quest teaches, then asks

```gherkin
Feature: Kingston's quest
  Background:
    Given the Kingston level is playable

  Scenario: The quest can be finished in one walk
    When I walk the level from spawn to end, engaging each stop once in order
    Then "quest/step-completed" is emitted for each of the nine steps in order
    And all four answer steps complete
    And "quest/completed" and "stamp/earned" are emitted
    And "quest-complete-card" is shown

  Scenario: A wrong answer does not end the quest
    Given the answer step at "fort-henry" is running
    When I choose a wrong option
    Then "question-feedback" says the answer is not right and "question-explanation" shows the guide's sentence
    And the step stays open until its count is met
    And no timer is shown

  Scenario: Every question was taught on this level before it was asked
    Given any id in any Kingston answer step's questionPool
    Then its source.quote shares a proposition with a fact claim that a point of interest or an earlier step on this level tells

  Scenario: The pools are topics, not periods
    Given the four answer steps
    Then no two pools share an id
    And each pool holds at least its step's count
    And each step's prompt names what its questions are about

  Scenario: Each step prompt fits the task strip
    Given the text size is 200% and the viewport is 390 by 844
    Then every Kingston step prompt in "hud-quest-tracker" wraps to at most three lines in English and in French

  Scenario: The stop's reading stays short
    Given the read step at any Kingston landmark
    Then the read steps at that stop name at most four passages and at most 120 words in either language
```

## TN-KINGSTON-06: Kingston depicts no nation, and teaches what the guide says about them

```gherkin
Feature: Content review on the Kingston level
  Scenario: No Indigenous person is drawn
    Given every art key the Kingston level names
    Then none depicts a person, figure, silhouette or crowd identified as Indigenous
    And none depicts a Métis sash, an object of a specific nation, or any item on content-review §5.2's list

  Scenario: The giver is the existing guide
    Given the quest document for Kingston
    Then its "giver" is "guide"
    And "content/characters/guide.json" has "indigenous" false and no "nation"
    And no new character document is added for Kingston

  Scenario: A teaching line about Tecumseh or the Métis is the guide's, faithfully
    Given a Kingston quest line resting on p. 29 (Tecumseh) or pp. 35–36 (the Métis of Red River, Louis Riel)
    Then it paraphrases its cited sentence and adds no context, judgement or correction
    And its speaker is "guide", who is not drawn as Indigenous
    And no living people are written about in the past tense without a date

  Scenario: The level stays outside content-review §1, item 5
    Given the Kingston level document, its quest and its copy rows
    Then the level's subject is "building-canada"
    And no card heading, subtitle or step prompt names a nation or is about a nation's territory or history
```

## TN-KINGSTON-07: The map shows Kingston without covering its neighbours

```gherkin
Feature: Kingston on the level select
  Scenario: Kingston is pinned in the corridor inset
    Given the level select map
    Then the pins for "ottawa", "kingston" and "toronto" are drawn in the same inset and not on the main map
    And any two pins drawn in one frame are at least one pin's width apart
    And the route runs from Québec City on the main map into the inset at Ottawa, then Kingston, then Toronto, and out to Winnipeg

  Scenario: The map is still decoration
    Then the map is aria-hidden and holds nothing focusable
    And "level-card-kingston" shows the numeral 5 and its state in words, not by colour alone
    And its subtitle reads "Building Canada"
```

## TN-KINGSTON-08: Kingston can be played with a keyboard, one switch or a screen reader, and with reduced motion

```gherkin
Feature: Kingston is playable without a touch screen
  Scenario: Keyboard only
    Given no pointer is used
    When I complete the level with the keyboard
    Then every stop could be engaged, every card answered and closed, and "stamp/earned" is emitted

  Scenario: Single switch
    Given single-switch mode is on and auto-move is on
    When I use only short presses and long presses at each card
    Then the level can be finished
    And nothing on the level advances or expires on its own

  Scenario: The live region says what the canvas shows
    When the walker comes within reach of "fort-henry"
    Then "interact-prompt" shows a verb phrase and not the landmark's name
    And the offer is announced in "#tn-live-region"
    And the Phaser canvas is aria-hidden

  Scenario: A screen reader reads a card and its question in order
    Given a screen reader is running
    When I engage "kingston-city-hall" during its answer step
    Then "poi-card" is announced with its heading, then its blurb
    And after "poi-card-close", "question-card" is announced with "question-place" naming Kingston City Hall, then "question-prompt", then the four options

  Scenario: Reduced motion
    Given reduced motion is on
    When the Kingston level is playable
    Then "scene-state" reports data-parallax-easing "off" and data-particles "0"
    And the stamp on "quest-complete-card" appears without squash-and-stretch
```

## TN-KINGSTON-09: Kingston in French, and in the exam

```gherkin
Feature: Kingston in both languages, and in Exam mode
  Scenario: Every Kingston string, blurb and line has both languages
    Given the locale is "fr"
    Then every copy row above, every blurb, every quest line and every step prompt draws French text
    And "Kingston" is not translated

  Scenario: The exam names Kingston's subject by its level
    Given an exam that drew a question from "building-canada"
    When the result screen draws its rows by subject
    Then "subject-row-building-canada" is labelled "Building Canada"
    And the start screen says "Subjects ready" out of 11

  Scenario: The exam in French
    Given the locale is "fr" and an exam that drew questions from "history" and "building-canada"
    When the result screen draws its rows by subject
    Then "subject-row-history" reads « Les débuts du Canada »
    And "subject-row-building-canada" reads « La construction du Canada »
```

## TN-KINGSTON-10: "About this place" in Kingston states a fact and names nobody

```gherkin
Feature: The Kingston territory statement
  Background:
    Given the Kingston level is playable

  Scenario: The panel opens from the menu and states the territorial fact
    When I open "menu" and choose "about-this-place-open"
    Then "about-this-place" opens as a dialog
    And its first line is the territorial fact
    And it cites p. 30 of the guide, the Fort Henry sentence
    And its link reads "Immigration, Refugees and Citizenship Canada"

  Scenario: It names only what its source prints, which is nobody
    Given "territory" in "content/levels/kingston.json"
    Then "nations" is empty and "nationsAbsentBecause" is "source-names-none"
    And the panel draws no list of names and no heading over one
    And the statement does not contain "Katarokwi", "Haudenosaunee", "Anishinaabe", "Iroquois" or "Mohawk"

  Scenario: It is a fact, not an acknowledgement, and it never blocks play
    Then the statement contains no first-person words such as "we" or "our" in English, or « nous » or « notre » in French
    And the panel does not open on its own when the level loads
    And no quest line, stamp or card carries the statement

  Scenario: Keyboard and screen reader
    Given no pointer is used
    When I reach "about-this-place-open" with Tab and press Enter
    Then focus moves into "about-this-place" and a screen reader announces its name and its first line
    When I press Escape or activate "about-this-place-close"
    Then the panel closes and focus returns to "about-this-place-open"

  Scenario: Single switch
    Given single-switch mode is on
    When I short-press until "about-this-place-open" is highlighted and long-press
    Then the panel opens, and short presses reach "about-this-place-close"

  Scenario: The panel in French
    Given the locale is "fr"
    When I open "about-this-place"
    Then the statement is the French text
    And its link reads « Immigration, Réfugiés et Citoyenneté Canada »

  Scenario: The panel with reduced motion
    Given reduced motion is on
    When I open "about-this-place"
    Then it appears without an animated transition
```

## TN-KINGSTON-11: The two history subtitles do not overlap, in either language

```gherkin
Feature: Québec City's and Kingston's subtitles
  Scenario: Québec City narrows, and Kingston's label is new
    Given the copy rows
    Then "level.quebec-city.subtitle" is "Early Canada" and « Les débuts du Canada »
    And "level.kingston.subtitle" is "Building Canada" and « La construction du Canada »
    And no two "level.<id>.subtitle" values are the same, in English or in French

  Scenario: A result row written before the split still has a label
    Given a saved exam answer recorded with subjectId "history" before Kingston existed
    When I open that exam's result
    Then "subject-row-history" reads "Early Canada"
    And no row is unlabelled

  Scenario: The labels fit their rows
    Given the text size is 200% and the viewport is 390 by 844
    Then "subject-row-history" and "subject-row-building-canada" each show their full label in English and in French, with nothing cut off

  Scenario: The level card shows the subtitle as text
    When I open the level select
    Then "level-card-kingston" reads "Kingston" and "Building Canada"
    And "level-card-quebec-city" reads "Early Canada"
```

## Open questions

| Id | Question | Owner | Status |
|---|---|---|---|
| OQ-KINGSTON-1 | Is the quest giver the existing `guide` or a new character? | PO | **Ruled 2026-09-25 (Ruling 3): the existing `guide`.** |
| OQ-KINGSTON-2 | If the verifier refuses `hist-39`'s "Kingston." distractor as asked at Kingston, what does `kingston-mills` do? | PO | **Ruled 2026-09-25 (Ruling 5):** it keeps the Rideau blurb and asks nothing. `hist-39` leaves the pool until it is rewritten and granted again. |
| OQ-KINGSTON-3 | Does content-review §1, item 5 apply to Kingston? | PO | **Ruled 2026-09-25 (Ruling 4): no, as scoped here, with a tripwire.** It is a scope reading and not a cultural sign-off. The project owner may overturn it. If they do, Kingston waits for Tier 3. |
| OQ-KINGSTON-4 | Should an "About this place" panel carry context about Macdonald beyond the guide's framing, written by somebody who may write it (content-review §9.4, §10, `OQ-REVIEW-9`)? No agent writes it. | PO, after merge (K-3.2) | **Open, and not decided by K-0.9.** Blocks nothing. The level ships faithful to the guide without it. Whatever the answer, no Macdonald statue is a stop or is drawn (Ruling 2). |
| OQ-KINGSTON-5 | The territory statement cannot name Katarokwi or the Haudenosaunee and Anishinaabe peoples, because the guide does not name them at Kingston (Ruling 6). Only the project owner can widen the source rule (ADR-0051). Should they? | Project owner | Open. Blocks nothing. The level ships with `nations: []`, which is the half-step content-review §10.3 names. |
