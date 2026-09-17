# TN-NORTH — Level 10, the North: the words this level says for itself

**Intent.** The North tells the player what it is getting ready, names the way they move, and names itself
when it fails and when it is finished — in both languages, with no nation named on a screen that may not name
one, with a territorial statement quoted from Kwanlin Dün First Nation left whole and in one place, with the
article in lower case in every sentence that is not a title, and with a quest offered by the vessel rather
than by anybody.

**This is not the whole level story.** `TN-LEVELS-2-to-10-spine.md` fixes what this level is; the full story
— the walk along the bar, the sternwheeler's card, the tuning of the quest's reach — is written in the slice
that builds them, in the shape of `TN-LEVEL-ottawa.md`. What is here is the copy the level draws **today**,
because `content/levels/the-north.json` shipped, `content/game.config.json` lists it in `levels`, in `journey`
and in `unlockRules.order`, and three copy gates are failing by name for want of these four rows.

**This is the tenth level, and the map is complete: ten built, no empty slots.** That changes one thing
outside this file — the last level in `unlockRules.order` is no longer Vancouver — and `TN-NORTH-05` and
`TN-DONE-04` carry it.

**Amended 2026-09-13 — this level has a quest, and nobody is drawn to offer it.** ADR-0029 widened
`quest.giver` from a character to an **engageable**: a character the level places, *or a point of interest it
places*. `content/quests/the-north-sternwheeler.json` shipped with `giver: "yukon-river-sternwheeler"` — the
vessel — and `characters` stays `[]`. **The figure prohibition is untouched**, and on this level it is the
one with the longest reasoning behind it: the ADR quotes this level's own art document back at itself.
Three sections below are rewritten because of it, including what "About this place" is still for now that a
landmark speaks, and what the HUD says when a thing rather than a person wants to talk.

Read `README.md` in this directory first. The rows this file does not own:

| What | Key | Owned by |
|---|---|---|
| Place name and subject line | `level.the-north.title` — "The North" / « Le Nord » — and `level.the-north.subtitle` | `TN-LEVELS-2-to-10-spine.md` |
| The mode label the HUD draws | `locomotion.walk.label` — "Walking" / « Marche »; this level adds **no row** | `TN-MOVE-locomotion-labels.md` |
| The error card's body and its two buttons | `level.error.body`, `level.error.retry`, `level.error.back` | `TN-WAIT-a-level-opens-or-it-does-not.md` |
| The completion card that draws two of this file's rows | `level.complete.*`, `quest.done.title`, `map.open`, `common.keepPlaying` | `TN-DONE-finishing-a-level.md` |
| What the HUD says when something is in reach | `hud.interact.poi.offer`, `hud.interact.done` | `TN-REACH-what-is-in-reach.md` |
| What the giver says when declined, returned to, or finished | inline on the quest document | `TN-DIALOGUE-what-a-quest-giver-says.md`, under ADR-0029 |
| The landmark name and blurb | inline `localizedText` | `content/levels/the-north.json`, under `TN-NAMES-naming-real-places.md` |
| The territorial statement | inline `localizedText` | `content/levels/the-north.json`, drawn by `about-this-place` (`docs/content-review.md` §10.2) |

## What this level is, and what it is not

**This level's place is a river bank in the Yukon. Its subject is a chapter of *Discover Canada*.**
`docs/content-review.md` §1's shipping rule, item 5, blocks *"any level whose **subject** is a nation's
territory or history"*, and the spine applied it to level 10 in a sentence that was right about the level it
was describing: *"a level whose subject is Canada's regions, set in the North, either depicts the peoples of
Inuit Nunangat or removes them from a level about where they live."* **That level is not this level.** This
one is set at Whitehorse on the Yukon River, its subject is **Canada's Regions**, its bank key is `regions`,
and its hero is a steel-and-timber freight vessel. `assets/style/the-north-level.md` §0 and §11 record that
this is a **scope decision rather than a solution**, and §11 says what it costs.

Three consequences bind every row in this file:

1. **No copy on this level makes its subject a territory.** Not the title, not the subject line, not the
   waiting sentence, not the error title, not the stamp sentence, not the play label — **and not a line the
   vessel speaks** (`TN-NORTH-06`).
2. **The territorial statement lives in "About this place" and nowhere else** (`docs/content-review.md`
   §10.2). A loading screen is the splash card that section rules out; a stamp line is a congratulation the
   player taps past; **a quest dialogue is a third shape that is not the panel**, and that needed deciding
   rather than assuming — see below.
3. **Nothing in this level depicts anybody.** `assets/style/the-north-level.md` §0 records `neverAdd` on
   **both** art subjects carrying *"a figure of any kind, at any scale, including a silhouette and a crowd"*,
   and gives the reason this file has to carry too: more than half the population of the Northwest
   Territories is Indigenous and about 85 % of Nunavut's is — a fact **this level's own bank teaches from
   *Discover Canada*** — so a figure drawn on a northern river bank is read as somebody, and this project has
   no reviewer who may say whether that reading is welcome. The copy-side half is this file's: no string on
   this level describes, addresses or names a person, a people or a nation — **including every line the quest
   puts on screen**.

### Two silences, kept

Both are recorded in `assets/style/the-north-level.md` §7 and in `content/sources/kdfn-about-us.json`, and
**copy may not fill either**:

- **The Ta'an Kwäch'än Council is not named, in either direction.** Its government is in Whitehorse and about
  half its citizens live there, and **neither the cited page nor the Council's own history page says that
  Whitehorse is inside its traditional territory** — that page names Tàa'an Män as the heart of the territory
  and gives its bounds by four place names. A level carries one `nationSource`, and naming a second nation's
  territory from a page that does not state it is the invention the register exists to prevent. **No row in
  this file and no line the quest speaks resolves that silence**, and none of them says "the nation", "the
  only nation" or "whose land this is" either — a sentence explaining the silence would be the same claim
  with an apology attached. This is the same shape as level 8's silence about the Métis Nation of Alberta
  (`TN-ALBERTA`).
- **The word "unceded" is not used**, and here it would also be **wrong**: Whitehorse is inside the Kwanlin
  Dün First Nation Final Agreement, which is a modern treaty. Level 9 omits the word because its cited page
  does not use it; this level omits it for that reason and one more.

### The Tier 3 obligation, and what copy may not imply about it

`assets/style/the-north-level.md` §0 carries an ADR-0009 marker dated **2026-12-08**: put this level, its
document and its two art subjects in front of a Tier 3 reviewer from **Kwanlin Dün First Nation**, and record
the answer. Five of the things it names are things no gate and no agent here can check — among them whether
**Chu Níikwän** and **Kwanlin** may be printed by this project at all and whether their diacritics are right,
whether a level titled *The North* that never leaves the Yukon misrepresents the region it is named for, and
whether the silence about the Ta'an Kwäch'än Council is the correct reading of a rule that says name only what
a source names.

**That review has not happened, and no string in this game may suggest it has.** No copy row, no panel line,
no quest line and no credit may say "reviewed", "approved", "endorsed", "in partnership with" or "with the
support of", in either language, and `communityReview.status` is never rendered on any screen
(`TN-NORTH-06`).

**The marker is copied into `docs/content-review.md` §13**, because `scripts/check-obligations.mjs` scans
`*.md` under `docs/` only. See `OQ-NORTH-5`.

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `level.the-north.loading` | Getting the gravel shore ready. | Préparation de la plage de galets. |
| `level.the-north.error.title` | We could not load the North. | Nous n'avons pas pu charger le Nord. |
| `stamp.the-north.earned` | You earned the North stamp. | Vous avez obtenu le tampon du Nord. |
| `level.the-north.play` | Play the North | Jouer dans le Nord |

**`level.the-north.loading` names the gravel shore because a cobble bar beside the water is the ground the
player walks on.** `assets/style/the-north-level.md` §1 and §2 describe four parallax layers — the sky, a
snow-capped range, a spruce bank, and `the-north-layer-40-river-and-bar`, which is the glacier-fed river in
three tones and then a cobble bar with driftwood, willow and sedge, and which is the band the walk line sits
in. §9 puts it plainly: the mode is `walk` because *"it is how a person crosses a gravel bar, this level is
7 680 px of gravel bar"*. The sentence describes that ground in common nouns and survives an art decision
that moves a willow clump or a piece of driftwood. **The quest's own words picked the same ground up** — its
`doneLine` reads "You walked the gravel bar…" — which is one level's vocabulary agreeing with itself rather
than a row leaking.

**It does not say "river", and that is `TN-WAIT`'s rule and not a stylistic choice.** Winnipeg waits in "the
riverbank" / « la rive », and `TN-WAIT-01` requires that no noun be used by two levels in either language. So
this level names what is underfoot — the stones — and leaves the water to the picture. "Shore" is free
because level 2 deliberately does not use it: Peggy's Cove's player walks the barrens *above* the cove, not
its shoreline (`TN-PEGGYS`).

**The French names the stones rather than the shore, and two nearer words were refused.** « La rive » is
Winnipeg's and « le rivage » is a word away from it. « La grève » is the exact Quebec French noun for a
gravel shore and is refused because its other meaning is a labour strike — this game's readers are newcomers
studying for a citizenship test, which is where they will meet the other meaning first, and a loading screen
is not the place to make them choose. « La plage de galets » is the plain French for the picture, collides
with nothing in either the title table or the waiting table, and needs no gloss. **The quest's French title
takes the same noun** — « Une halte sur la plage de galets » — for the same reason.

**It names no landmark and no territory.** Where the vessel's name may and may not appear is the next
section, and the quest moved that line by exactly one surface.

### Where the landmark's name appears, now that it also speaks

The vessel ships **nameless** — it carries its own name across the bow and the pilot house in every
reference, `make verify-art` refuses a `<text>` element, and `art-bible.md` forbids substituting an invented
mark — so what the level document calls it is a **type**: "Yukon River sternwheeler" / « Vapeur à roue
arrière du Yukon » (`assets/style/the-north-level.md` §6.5). That type is what a second surface now draws:
**ADR-0029 §6 makes the dialog's accessible name the giver's name**, read from the level document, and
`app/bootstrap/quest.ts` refuses to open a dialog it cannot name.

| Surface | Names it? | Why |
|---|---|---|
| The point-of-interest card's body | **Yes** | `TN-NAMES-01` — where a name teaches something, with its source |
| The quest dialog's accessible name and speaker label | **Yes** | ADR-0029 §6 — a line with no attributable source is a line the live region cannot attribute |
| The waiting sentence, the error title, the stamp sentence, the play label | No | `TN-WAIT`, `TN-DONE`, `TN-PASSPORT-02` |
| `interact-prompt` and anything else inside `hud` | No | `TN-REACH` — the prompt says what pressing does and is never a name |
| The quest's title, summary and step prompts | No | they are drawn in `hud-quest-tracker`, which is inside the HUD — which is why the step prompt reads "Stop at the vessel" and not "Stop at the sternwheeler" |

**Two surfaces, not one, and the file that said "the only screen" is amended here rather than left to be
contradicted by a test.** The cost is smaller here than anywhere else this rule applies: what the second
surface draws is a **type**, so a screen-reader user is told the words come from a kind of vessel, not from a
named boat and not from a person. **The word "Yukon" is inside that type**, which is the one thing to watch:
it is a place name this level otherwise keeps to the point-of-interest card, and `TN-NORTH-01` asserts it
still reaches no waiting sentence, no error title, no stamp, no play label and nothing inside `hud`.

### The four rows, and the two capitals

**This level breaks the mid-sentence capital in both languages, and it breaks them differently.** Levels 7
and 8 are the precedents; this one is the sharpest, because the French defect and the English defect are not
the same defect.

- **`level.the-north.error.title`.** The title is "The North", with a capital T, because that is how the map
  names it. Dropped into "We could not load {{level}}." it produces *"We could not load The North."* The row
  is written out with a lower-case article. **The French title is « Le Nord », and templated it gives
  « charger Le Nord »** — so the French row is written out too, as « charger **le** Nord ».
- **In French only the article goes down. The noun keeps its capital, and that is a different rule from level
  8's.** « Les contreforts de l'Alberta » becomes « les contreforts de l'Alberta » — article *and* noun in
  lower case, because « contreforts » is a common noun. « Le Nord » becomes « le Nord » — **« Nord » keeps
  its capital N**, because as the name of the region it is a proper noun, and « le nord » in lower case means
  a compass direction. A level called "the north" would be telling the player it is set in a direction.
  `TN-NORTH-04` asserts both halves, and a build that lower-cases the N fails it.
- **`stamp.the-north.earned` is the fifth French form after « tampon », and it is the first contraction of
  its kind in this game.** « de » + « le Nord » contracts to **« du Nord »**. The four forms this table had
  were « d'Halifax », « de la Ville de Québec », « de Toronto » and « des Prairies »; levels 8 and 9 added
  none, and `TN-DONE` recorded that as the finding rather than a disappointment. **Level 10 adds the fifth**,
  which is the last evidence this argument needed: a template that had been corrected four times would still
  have produced « le tampon de le Nord » for the tenth level. The English is the other half of the same row —
  a template gives *"the The North stamp"*, and the written row is "the North stamp".
- **`level.the-north.play` is the fourth play shape: « dans le ».** A region takes « dans » — « dans la Ville
  de Québec », « dans les Prairies », « dans les contreforts de l'Alberta », and now « dans le Nord ».
  It is **not** « Jouer au Nord »: « au Nord » is a direction, and a button reading "play to the north" is a
  compass instruction rather than a level. The English is "Play the North", the third label to take an
  article, after the Prairies and the Alberta foothills.

**« Tampon », never « timbre »** — `TN-PASSPORT-my-passport.md` settled that word.

### `locomotion.walk.label`, and the mode this level does not declare

`content/levels/the-north.json` declares **`walk` and nothing else**, with Halifax's tuning unchanged and
`"labelKey": "locomotion.walk.label"`. `walk` already has a row, so **this level adds nothing to `TN-MOVE`'s
table** — and with ten levels built, `canoe` and `dogsled` are still the two modes in
`content/game.config.json#/locomotionModes` that **no document declares and no table names**. That is
`TN-MOVE-02`'s last scenario still passing on the day the map filled up.

**The spine gave level 10 a dogsled, and the level does not declare one.**
`assets/style/the-north-level.md` §9 gives two reasons and **either is sufficient alone**: `OQ-REVIEW-10` is
unanswered and `docs/content-review.md` §5.4 names the dogsled and the qamutiik as Indigenous technology used
as generic Canadian symbols — §5.1's second test, *is this item's job in the composition to tell the player
that this person is Indigenous?*, is exactly what a dogsled on a level called The North would be doing — and
there is no art, because a dogsled mode needs **a team of animals, which is a whole second rig this game does
not have**. `TN-LEVELS-02` makes a document declaring `dogsled` a build failure with no override. **Nothing
in this file writes a label, a prompt or a sentence about a dogsled**, and `TN-NORTH-06` asserts that word
and five others appear in no string on this level in either language — **the quest's lines included**.

## What this level has now, and what it still does not

`content/levels/the-north.json` declares `"characters": []` and **one quest**,
`content/quests/the-north-sternwheeler.json`, whose giver is the point of interest the level already places.

**Two steps, not three.** A `talk` on the giver, then an `answer` of 3 drawn from `regions`. There is no
`visit` step, because **the giver is the landmark** and a visit would send the player to the thing they are
already standing at.

**So there are two ways to finish this level, and the card says which one happened.** Completing the task
draws `quest.done.title` — "Task done!" — and reaching the end draws `level.complete.title` — "Level
finished!" (`TN-DONE-01`). **Both earn the same stamp and both draw the same two rows this file owns.**
`TN-NORTH-05` carries both paths rather than the one premise it used to have.

**The quest depicts nobody.** `characters` is still `[]`; the speaker on all four moment lines and on every
step line is `yukon-river-sternwheeler`; ADR-0029 §4 forbids `expression` on a line whose speaker resolves to
a POI, and §7's gate checks it. ADR-0029 §5 fixes the voice: **second person and impersonal** — "You have
reached the vessel on the stones, above the water" — never "I have worked this river", and never the vessel
describing *itself* in the third person, which is what the opening line and the decline did until 2026-09-17:
"This vessel rests on the stones of the bar" told a screen-reader user that the thing they had walked up to
was narrating, which is the first person's failure wearing the third person's grammar. That rule is held by review rather than
by a regex, and the ADR says why. **On this level it is the figure prohibition arriving through the copy
instead of the picture**, which is the sentence from ADR-0029 §5 this file most needs to carry, and the ADR
quotes this level's own art document for it.

**The subject bank clears the floor by the second-widest margin in the game.**
`content/questions/regions/` holds **fifty-eight authored questions, all fifty-eight reported verified**,
against `CLAUDE.md`'s thirty — behind `history`'s ninety-six and ahead of the other eight — and the quest's
answer step draws three of them. It is also a correction to `OQ-SPINE-3`, which recorded `regions` as having
**no bank at all**, and to the spine's own table, which said the same. `ADR-0028` is why the bank looks the
way it does: the industry and resource material in *Canada's Regions* belongs to `economy`, and what is left
to this subject is the five regions, the provinces and territories, their capitals, population distribution,
languages and landforms.

**What it still does not have is a giver the runtime can name.** ADR-0029's own obligation
(due 2026-11-13, owner engine) records it: `app/bootstrap/quest.ts` builds the copy key `npc.<giver>.name`,
there is no `npc.yukon-river-sternwheeler.name` row, so `canEngage` returns false and the dialog is refused.
**This quest validates, passes every gate and cannot be played today**, which is fail-closed and correct and
is written here because a story describing a quest the player cannot reach should say so in the same breath
(`OQ-NORTH-6`). **No copy row fixes it and none should be written to** — inventing
`npc.yukon-river-sternwheeler.name` would put a landmark's type in the character namespace and in a copy
table, when ADR-0029 §6 has it in the level document already, in both languages, required.

### What "About this place" is for, now that a landmark speaks

**Unchanged — and on this level the reason is sharper than on level 2.** A plaque beside a historic vessel is
exactly the object that carries a land acknowledgement at a real site, the level now has something
plaque-shaped that speaks, and moving the territorial statement into it would feel like an improvement. It is
refused, for three reasons and any one is sufficient:

1. **§10.2 rules out anything the player taps past to reach gameplay.** A quest dialogue is advanced with
   *Next* and then it is over; the panel is always reachable and never blocking.
2. **A quest can be declined** (`TN-DIALOGUE`). A territorial statement a player can decline to hear is a
   statement conditioned on consenting to a task.
3. **They are two kinds of source and must not share a register.** The panel quotes **Kwanlin Dün First
   Nation's own words**, with one `nationSource`, and carries three endonyms whose spelling a Tier 3 reviewer
   has not yet seen; every quest line's `fact` block carries `sourceId: "discover-canada"`. Putting a
   nation's words in the same flow as a chapter paraphrase makes them one kind of thing, and they are not.

And the fourth reason, which is this level's alone: **the statement carries a deliberate silence**, and a
dialogue is where somebody would eventually be tempted to explain it. `TN-NORTH-06` asserts that no quest
line names the Ta'an Kwäch'än Council, states the territorial fact, or draws attention to what is absent.

So the division is sharper than before, not looser: **the panel states the territorial fact; the vessel
teaches the chapter; the loading screen says what is being prepared; the stamp says what was earned.**

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-NORTH-03`; the escape route and the error buttons are `TN-WAIT-04`; the completion card is `TN-DONE-06`; the dialogue is `TN-QUEST-06` |
| Single switch | `TN-NORTH-03`; `TN-WAIT-04`; `TN-DONE-06` |
| Screen reader | `TN-NORTH-03`, which carries the dialog's accessible name and the endonyms in the panel |
| Reduced motion | `TN-NORTH-03`; `TN-DONE-07` |
| 200 % text | `TN-NORTH-03` |
| Bilingual | `TN-NORTH-04`, and `TN-NORTH-05` for the two completion rows |
| Failure path | `TN-NORTH-02`; the missing-row gate is `TN-WAIT-03` for two of these rows and `TN-DONE-05` for the other two |
| Depiction | `TN-NORTH-06`, which is on the same footing as the five above and now covers the quest's lines |

---

## TN-NORTH-01 — Opening the North

```gherkin
Feature: The North says what it is getting ready
  Scenario: The waiting screen is about this level
    Given the North level assets are still downloading
    Then the element "level-loading" is visible
    And it reads "Getting the gravel shore ready."
    And it does not read "Getting the riverbank ready."
    And it does not read "Getting the bare rock ready."
    And it is text, not only a spinner

  Scenario: The HUD says how I move here
    Given the North level is playable
    Then "scene-state" reports "data-level" equal to "the-north"
    And "scene-state" reports "data-mode" equal to "walk"
    And the element "hud-mode-label" reads "Walking"
    And it is not empty
    And it does not read "Dogsledding" or name any mode the document does not declare

  Scenario: The waiting sentence claims no progress and names no place
    Given "level-loading" is visible
    Then its text contains no percentage, no fraction and no step count
    And it contains no "…" and no "..."
    And it does not contain "North", "Nord", "Yukon" or "Whitehorse"
    And it does not contain "sternwheeler", "steamboat" or "vapeur"
    And it does not contain "Nunavut", "Northwest Territories" or "Territoires du Nord-Ouest"

  Scenario: The waiting sentence states no territorial fact
    Given "level-loading" is visible
    Then it does not contain "territory" or "territoire"
    And it does not contain "traditional" or "traditionnel"
    And it does not contain "unceded" or "non cédé"
    And it does not contain "Kwanlin", "Tagish", "Chu Níikwän" or "Ta'an"
    And the territorial statement is drawn only by "about-this-place"

  Scenario: The panel states the fact, with its source, and is the only place that does
    Given the North level is playable
    When I open "about-this-place"
    Then it shows the statement the level document carries
    And it shows "Kwanlin Dün First Nation" and "Tagish Kwan"
    And those names are spelled identically in the English and the French panel, diacritics included
    And no other screen in this level shows either name in either language
    And no line the quest puts on screen shows either name
    And the panel is not modal and was not dismissed to reach the level

  Scenario: The landmark is named as a type, because the vessel ships nameless
    Given the North level is playable
    When I engage the landmark
    Then the quest dialogue opens, because this landmark is this level's quest giver
    And "poi-card" shows "Yukon River sternwheeler" as text, inside a sentence that says what it is,
      whenever the card is the thing that opens
    And no lettering, name board or wordmark is drawn on the vessel
    And no string in this game in either language carries the name of the vessel the art was drawn from

  Scenario: Exactly two surfaces name it, and the HUD is not one of them
    Given the North level is playable
    Then "Yukon River sternwheeler" appears in the point-of-interest card's body
    And it appears as the quest dialog's accessible name and speaker label, as ADR-0029 requires
    And it appears on no other screen in this level, in either language
    And no string drawn inside "hud" contains "sternwheeler" or "Yukon"
    And the quest's step prompt reads "Stop at the vessel", which names a kind of thing and not this one

  Scenario: The HUD says a thing has something to offer, and does not name it
    Given the North level is playable
    When I come within reach of the landmark
    Then "interact-prompt" reads "See what there is to do here", the row TN-REACH owns
    And it does not read "Look at this place", because pressing opens a task and not a card
    And it does not read "Talk to this person", because nobody is there
    And it names nothing
```

## TN-NORTH-02 — The North fails in its own name, with a lower-case article (failure path)

```gherkin
Feature: The error card names this level
  Scenario: The assets cannot be fetched
    Given requests for the North assets fail
    When I open the North level
    Then the event "level/failed" is emitted for "the-north"
    And the element "level-error" is visible
    And it says "We could not load the North." and "Check your connection and try again."
    And it does not say "We could not load The North."
    And it does not say "We could not load the north."
    And it does not say "We could not load the-north."
    And it does not name Halifax, Peggy's Cove, Québec City, Ottawa, Toronto, Winnipeg,
      the Prairies, the Alberta foothills or Vancouver
    And a button "Try again" is offered
    And a button "Go back" is offered
    And the element "playable" is never present

  Scenario: The title is the card's accessible name
    Given "level-error" is visible
    Then the accessible name of "level-error" is "We could not load the North."
    And it is not "Error", "Something went wrong" or empty

  Scenario: Both languages carry a written row, and they break the template differently
    Then the English sentence carries a lower-case article where the level's title carries a capital one
    And the French sentence carries a lower-case "le" where the French title carries "Le"
    And the French sentence still carries a capital "N" on "Nord"
    And a build that draws either title's own capitalisation mid-sentence fails this scenario
    And a build that lower-cases "Nord" fails it too

  Scenario: A stalled load can be left
    Given the North level has not become playable
    When the load has not finished after the time-to-play budget in "game.config.json" has passed twice
    Then a "Go back" button is visible and focusable
    And "level-loading" still reads "Getting the gravel shore ready."
    And nothing on the screen counts down

  Scenario: A quest whose giver cannot be named is refused, not guessed at
    Given the runtime cannot resolve a display name for this level's quest giver
    When I come within reach of the landmark
    Then no dialogue opens
    And no dialog is drawn with an empty, guessed or id-shaped accessible name
    And nothing on screen blames me or reads as an error
    And this is ADR-0029's obligation, open until the name is read from the level document
```

## TN-NORTH-03 — Everybody gets these strings

```gherkin
Feature: The level's own words reach every player
  Scenario: A screen-reader user is told what is being prepared and how they move
    When the North level starts loading
    Then "#tn-live-region" reads "Getting the gravel shore ready."
    And it is not repeated while the load continues
    When the level becomes playable
    Then "hud-mode-label" is in the accessibility tree as text reading "Walking"
    And the canvas is "aria-hidden"

  Scenario: A screen-reader user is told what is speaking before they are told what it says
    Given the North level is playable
    When the quest dialogue opens
    Then the dialog's accessible name is "Yukon River sternwheeler", from the level document
    And it is never empty, and the dialog is refused rather than opened unnamed
    And "dialogue-speaker" carries the same string
    And no portrait, face or expression is drawn beside it
    And nothing in the dialogue is written in the first person

  Scenario: A screen-reader user can reach the territorial statement without leaving the level
    Given the North level is playable
    Then "about-this-place-open" is reachable from the pause menu and from the credits
    And it is reachable whether I have never met the quest, accepted it, declined it or finished it
    And opening it does not pause, block or end the level
    And its content is text in the accessibility tree, not an image
    And the endonyms in it are read as words, not spelled out letter by letter

  Scenario: A keyboard player and a switch user reach both ways out
    Given "level-error" is visible for the North
    And I am using a keyboard only
    Then "Try again" and "Go back" are reachable with "Tab" and activate with "Enter"
    Given single-switch mode is on
    Then both are reached with short presses and chosen with a long press
    And nothing expires while I decide
    And the highlight never lands on "hud-mode-label"

  Scenario: The whole level is completable without a second hand, by either route
    Given the North level is playable
    Then I can reach the end of it with a keyboard alone
    And I can reach the end of it with short and long presses alone
    And I can accept, read and finish its task with a keyboard alone
    And I can do the same with short and long presses alone
    And no step of it needs a pinch, a swipe, a drag or a double tap
    And nothing on screen counts down
    And no scenario in this level passes or fails on how fast I act

  Scenario: With motion off, the words are still the signal
    Given reduced motion is on
    And the level assets are still downloading
    Then "level-loading" reads "Getting the gravel shore ready."
    And nothing on it spins, pulses, slides or flashes
    And no aurora, shimmer or moving light is drawn anywhere in this level

  Scenario: They fit at 200 %
    Given text scaling is 200 %
    And the viewport is 390 x 844
    Then the whole of "Getting the gravel shore ready." is visible while loading
    And in French the whole of "Préparation de la plage de galets." is visible
    And both sentences on "level-error" are readable, by scrolling if needed
    And the whole of "Vous avez obtenu le tampon du Nord." is visible on the completion card
    And the whole of "Vapeur à roue arrière du Yukon" is visible as the dialog's name
    And every control is still at least 44 CSS px wide and tall
    And the page does not scroll sideways
```

## TN-NORTH-04 — The North in French

```gherkin
Feature: The level in French
  Background:
    Given the language is French

  Scenario: Waiting is French, and does not borrow another level's noun
    Given the level assets are still downloading
    Then "level-loading" reads "Préparation de la plage de galets."
    And it does not read "Préparation de la rive."
    And it does not read "Préparation de la grève."
    And it does not contain "Nord"
    And it contains no percentage, no step count and no ellipsis
    And it contains no nation's name and no territorial claim
    And "#tn-live-region" reads it once, with "lang" equal to "fr"

  Scenario: The HUD and the card headings are French
    Given the North level is playable
    Then "hud-mode-label" reads "Marche"
    And the level title reads "Le Nord" with the subtitle "Les régions du Canada"
    And "interact-prompt" reads "Voir ce qu'il y a à faire ici" when the landmark is in reach

  Scenario: The failure is French, with the article in lower case and the noun still capitalised
    Given requests for the North assets fail
    Then "level-error" says "Nous n'avons pas pu charger le Nord."
    And it does not say "Nous n'avons pas pu charger Le Nord."
    And it does not say "Nous n'avons pas pu charger le nord."
    And it does not say "Nous n'avons pas pu charger Nord."
    And it also says "Vérifiez votre connexion et réessayez."
    And the buttons read "Réessayer" and "Retour"

  Scenario: The title keeps its own capitals where it is a title
    Then "level.the-north.title" reads "Le Nord" on the map and on the level card
    And the same two words read "le Nord" inside every sentence in this file
    And no screen shows "Le Nord" mid-sentence
    And no screen shows "le nord" at all

  Scenario: The landmark's French name is the one the level document carries
    Given the North level is playable
    When the quest dialogue opens
    Then its accessible name is "Vapeur à roue arrière du Yukon"
    And the point-of-interest card draws the same string
    And no waiting, error, stamp or prompt string in either language contains it

  Scenario: The quest speaks French, impersonally
    Given the North level is playable
    When the quest dialogue opens
    Then every line is the French text the quest document carries
    And no line uses "je", "j'ai", "nous" or "on" about the speaker
    And no line names a person, a people or a nation

  Scenario: Both languages or neither
    Then every key in this file's table has a value in "en" and in "fr"
    And no string in either language contains "(e)", "·e" or a bracketed ending
    And no string is drawn onto the canvas as part of an image
```

## TN-NORTH-05 — Finishing the North, by either route, and the end of the journey

```gherkin
Feature: This level's two sentences on the completion card
  Scenario: Finishing this level says so in this level's words
    Given the North level is playable
    When I reach the end of it
    Then the event "stamp/earned" is emitted for "the-north"
    And the element "quest-complete-stamp" reads "You earned the North stamp."
    And it does not read "You earned the The North stamp."
    And it does not name any other level
    And it does not contain "sternwheeler", "Yukon" or "Whitehorse"
    And it does not contain "territory", "unceded" or the name of a nation

  Scenario: There are two ways to finish, and the heading says which happened
    Given the North level is playable
    When I finish its task
    Then "quest-complete-card" shows "Task done!", as TN-QUEST-04 requires
    Given I instead reach the end of the level having accepted no task
    Then "quest-complete-card" shows "Level finished!", as TN-DONE-01 requires
    And in both cases the stamp sentence and the play label are the rows in this file
    And in both cases exactly one stamp is earned

  Scenario: The giver's own last line names no landmark either
    Given the language is English
    When I finish this level's task
    Then the line the giver speaks on the card does not contain "sternwheeler", "Yukon" or "Whitehorse"
    And it does not contain "territory", "unceded" or the name of a nation
    And the same is true of Peggy's Cove's, which names no lighthouse
    And this is TN-DONE's rule about what a completion card may carry, applied to a line quest content owns

  Scenario: The French stamp sentence is the fifth form after "tampon"
    Given the language is French
    When I finish the North level
    Then "quest-complete-stamp" reads "Vous avez obtenu le tampon du Nord."
    And it does not read "Vous avez obtenu le tampon de le Nord."
    And it does not read "Vous avez obtenu le tampon de Nord."
    And it does not read "Vous avez obtenu le tampon du nord."
    And it does not contain "timbre"
    And "du" is a form no other level's stamp sentence uses

  Scenario: The control that opens this level takes "dans le"
    Given finishing Vancouver opened the North
    Then "quest-complete-next" reads "Play the North"
    And in French it reads "Jouer dans le Nord"
    And it does not read "Jouer au Nord"
    And it does not read "Jouer à le Nord"
    And it is not "Le Nord" on its own

  Scenario: Both rows exist in both languages, or the build fails
    Then "stamp.the-north.earned" and "level.the-north.play" each have a value in "en" and in "fr"
    And a missing row fails the content check, as TN-DONE-05 describes
    And neither is assembled from a template with this level's title dropped into it
    And the five French forms "d'Halifax", "de la Ville de Québec", "de Toronto", "des Prairies"
      and "du Nord" are each a written row

  Scenario: This is the last level, and the card says nothing is coming
    Given I finished the North
    And no level after it exists in "unlockRules.order"
    Then no "quest-complete-next" control is present, as TN-DONE-05 requires
    And "quest-complete-map" is the primary action
    And nothing on the card says a level is coming, locked or unavailable
    And nothing on the card congratulates me for finishing the game

  Scenario: The passport is full for the first time
    Given I have finished all ten levels
    Then the passport shows ten stamps as "Earned"
    And it shows "Stamps: 10 of 10"
    And no screen tells me there is nothing left to do
    And no screen still says "More are coming.", as TN-PASSPORT-01 requires

  Scenario: A player who walked past everything is not told they learned something
    Given I reached the end of the North having answered no question
    Then "quest-complete-stamp" still reads "You earned the North stamp."
    And the line about my answers is the one in TN-DONE-02
    And no sentence on the card names the vessel
    And nothing tells me I missed the task
```

## TN-NORTH-06 — What this level never says (depiction path)

```gherkin
Feature: The place is a place, the subject is a chapter, and no string says otherwise
  Scenario: No copy row makes this level's subject a territory
    Then "level.the-north.title" reads "The North" and "Le Nord"
    And "level.the-north.subtitle" reads "Canada's regions" and "Les régions du Canada"
    And neither contains "territory", "territoire" or the name of any nation
    And no waiting sentence, error title, stamp sentence or play label in either language contains them
    And the level document's "subject" is "regions"

  Scenario: The quest teaches the chapter and never the territory
    Then no line the quest puts on screen states or paraphrases the territorial statement
    And no quest line contains "territory", "territoire", "unceded" or "non cédé"
    And no quest line names a nation
    And every quest line that states a fact carries a source, and that source is Discover Canada
    And the territorial statement's own source is the level document's, and is drawn only by the panel

  Scenario: Teaching a fact about three territories is not claiming to draw them
    Given a quest line says that Canada's northern territories hold one third of the country's land
    Then that is a sourced fact from the chapter this level teaches
    And it is not a claim about what this level depicts
    And no string in this file claims the level shows Nunavut or the Northwest Territories
    And no string claims the level shows the whole North
    And "assets/style/the-north-level.md" §11 is the record that two regions were left out on purpose

  Scenario: Copy names nothing the art contract forbids
    Then no string in this level in either language contains "inuksuk" or "inuksuit"
    And none contains "qamutiik", "dogsled" or "traîneau à chiens"
    And none contains "kayak", "canoe" or "canot"
    And none contains "igloo" or "amauti"
    And that is true of the quest's lines, its title, its summary and its step prompts
    And the "neverAdd" list on both of this level's art subjects is the other half of this scenario

  Scenario: The silence about a second nation is not resolved by copy
    Then no string in this level in either language contains "Ta'an Kwäch'än"
    And no string says that one nation is the only nation whose territory this is
    And no string explains, apologises for or draws attention to the absence
    And no quest line does any of those things either
    And "content/sources/kdfn-about-us.json" is where the silence and what would close it are recorded

  Scenario: The thing that speaks does not become somebody
    Then every line on this level is attributed to "yukon-river-sternwheeler"
    And no line whose speaker is a point of interest carries an "expression"
    And no portrait, face, mouth or figure is drawn for the speaker
    And no line is written in the first person, in either language
    And "characters" on this level document is empty

  Scenario: No string claims a review that has not happened
    Then no string in this level in either language contains "reviewed", "approved" or "endorsed"
    And none contains "in partnership with", "with the support of", "approuvé", "en partenariat"
      or "avec le soutien"
    And no screen renders a "communityReview" status
    And a credit line naming a nation as a collaborator fails this scenario

  Scenario: The panel is the only territorial surface, and it degrades honestly
    Given the level document's territorial statement is quarantined because its source changed
    Then "about-this-place" says plainly that the source is being checked
    And it keeps its citation
    And it is not replaced by a paraphrase written by anything
    And no other screen in this level changes, because none of them carried the statement
    And no quest line changes, because none of them carried it either
```

---

## Open questions

- **`OQ-NORTH-1` — this level places no character, and after ADR-0029 that is a smaller gap than it was.**
  The quest is given by the landmark, so nothing is waiting on a person. If a character is ever placed here
  it is the first figure this level has ever drawn, and `docs/content-review.md` §1 is engaged the moment it
  carries a marker — read `assets/style/the-north-level.md` §0 and §11 first. *Recommendation:* leave it as
  it is, and if one is ever wanted, choose an **epicene** French role noun. **The interact prompt is settled
  and is not waiting on that**: the landmark draws `TN-REACH`'s new generic row rather than a per-target row,
  because a per-target row would put "sternwheeler" or "Yukon" in the HUD and this file forbids that.
- **`OQ-NORTH-2` — the level's facts are unverified, and the quest added five more.**
  `content/levels/the-north.json` carries `verification.status: "unverified"` on the point of interest's
  fact, on the territorial statement **and** on the `nationSource`, and
  `content/quests/the-north-sternwheeler.json` carries three `factual: true` lines in the same state.
  `TN-LEVELS-03` requires every factual sentence a level puts on screen to be verified like a question, and
  ADR-0003's second amendment is why the quest's lines are no different: **verification follows the claim,
  not the screen it appears on.** Nothing in this file's four rows states a fact, so none of them is blocked;
  the card, the panel and the dialogue are. **One thing a verifier may not do is recorded here so it is not
  discovered mid-review**: the territorial statement rests on **three passages of one page** and a
  `FactSource` carries one quote, so two of the three are registered in `content/sources/kdfn-about-us.json`
  rather than quoted — and a verifier may neither collapse them into one quote nor resolve the Ta'an Kwäch'än
  silence. **ADR-0028 carries a second, separate obligation on this chapter** — a live check of *Canada's
  Regions* against canada.ca — which is not this file's. Routed to the content verifier.
- **`OQ-NORTH-3` — the level is called The North and is entirely the Yukon, and the copy carries that
  honestly rather than fixing it.** `assets/style/the-north-level.md` §11 states the terms: the identifying
  built things of Inuit Nunangat **are** Inuit and are covered by `docs/content-review.md` §5.2 and
  `OQ-REVIEW-10`, so one region was drawn and named for all three. **The title is the spine's and this file
  does not reopen it.** **The quest sharpened this rather than softening it**: its lines teach facts about all
  three territories from the chapter, which `TN-NORTH-06` separates from any claim about what is drawn — a
  level may teach what it does not depict, and saying so is what stops the two being confused.
  *Recommendation:* if a future slice gives Nunavut and the Northwest Territories their own levels, this
  level keeps its title and gains a place name in its point of interest; nothing in these four rows changes.
- **`OQ-NORTH-4` — "the gravel shore" is the tenth waiting sentence and the checking is still by hand.**
  `OQ-WAIT-4` asked for a mechanical comparison of every waiting sentence against every level title in both
  languages, and named "The North" / « Le Nord » as the one most likely to collide. **It did not collide**,
  because the sentence names the stones rather than the direction — but that was established by reading ten
  titles and ten sentences. *Recommendation:* build the check now that all ten exist. Routed with
  `OQ-WAIT-2`.
- **`OQ-NORTH-5` — two Tier 3 obligations were written where nothing reads them, and copying them is a
  stop-gap.** `assets/style/peggys-cove-level.md` §0 and `assets/style/the-north-level.md` §0 both carry
  ADR-0009 markers dated 2026-12-08; `scripts/check-obligations.mjs` scans `*.md` under `docs/` only, so
  neither had a clock. Both are copied into `docs/content-review.md` §13.
  *Recommendation:* **widen the scanner to `assets/style/` as well**, and keep the copies. Routed to the
  engine agent; `scripts/` is not this directory's to edit. Same question as `OQ-PEGGYS-4`.
- **`OQ-NORTH-6` — this level's quest cannot be played, and the gate that would catch that does not exist.**
  ADR-0029's obligation (due 2026-11-13, owner engine) records the cause: `app/bootstrap/quest.ts` resolves a
  giver's display name from the `npc.<id>.name` copy row, there is no such row for a landmark, and the dialog
  is refused for want of an accessible name. So this level ships a quest that **validates, passes every gate
  and opens for nobody**. `TN-NORTH-02`'s last scenario asserts the refusal is silent and blameless, which is
  the right behaviour for the state; what no scenario in this directory asserts is that the state ends.
  *Recommendation:* when the name resolution lands, the same change should make a quest whose giver cannot be
  named a **build** failure rather than a runtime refusal — a quest nobody can open is a content defect, and
  `TN-WAIT-03`'s shape is the precedent. Routed to the engine agent with ADR-0029's obligation. Same question
  as `OQ-PEGGYS-6`; two levels asking it is one question.
