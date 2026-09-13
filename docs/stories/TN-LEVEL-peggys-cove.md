# TN-PEGGYS — Level 2, Peggy's Cove: the words this level says for itself

**Intent.** Peggy's Cove tells the player what it is getting ready, names the way they move, and names itself
when it fails and when it is finished — in both languages, with no nation named on a screen that may not name
one, with a territorial statement quoted from a Mi'kmaw body's own words left exactly where it is, and with a
quest offered by the lighthouse rather than by anybody.

**This is not the whole level story.** `TN-LEVELS-2-to-10-spine.md` fixes what this level is; the full story
— the walk across the barrens, the lighthouse's card, the tuning of the quest's reach — is written in the
slice that builds them, in the shape of `TN-LEVEL-ottawa.md`. What is here is the copy the level draws
**today**, because `content/levels/peggys-cove.json` shipped, `content/game.config.json` lists it in `levels`,
in `journey` and in `unlockRules.order`, and three copy gates are failing by name for want of these four
rows.

**Amended 2026-09-13 — this level has a quest, and nobody is drawn to offer it.** ADR-0029 widened
`quest.giver` from a character to an **engageable**: a character the level places, *or a point of interest it
places*. `content/quests/peggys-cove-point-light.json` shipped with `giver: "peggys-point-light"` — the
lighthouse — and `characters` stays `[]`. **The figure prohibition is untouched**: the ADR refused weakening
it and says so in its alternatives. What changed is the schema clause that had been turning that prohibition
into a scope cut. Three sections below are rewritten because of it, and the two that matter most are the
ones that decide **what "About this place" is still for** now that a landmark speaks, and **what the HUD says
when a thing rather than a person wants to talk**.

Read `README.md` in this directory first. The rows this file does not own:

| What | Key | Owned by |
|---|---|---|
| Place name and subject line | `level.peggys-cove.title` — "Peggy's Cove" / « Peggy's Cove » — and `level.peggys-cove.subtitle` | `TN-LEVELS-2-to-10-spine.md` |
| The mode label the HUD draws | `locomotion.walk.label` — "Walking" / « Marche »; this level adds **no row** | `TN-MOVE-locomotion-labels.md` |
| The error card's body and its two buttons | `level.error.body`, `level.error.retry`, `level.error.back` | `TN-WAIT-a-level-opens-or-it-does-not.md` |
| The completion card that draws two of this file's rows | `level.complete.*`, `quest.done.title`, `map.open`, `common.keepPlaying` | `TN-DONE-finishing-a-level.md` |
| What the HUD says when something is in reach | `hud.interact.poi.offer`, `hud.interact.done` | `TN-REACH-what-is-in-reach.md` |
| What the giver says when declined, returned to, or finished | inline on the quest document | `TN-DIALOGUE-what-a-quest-giver-says.md`, under ADR-0029 |
| The landmark name and blurb | inline `localizedText` | `content/levels/peggys-cove.json`, under `TN-NAMES-naming-real-places.md` |
| The territorial statement | inline `localizedText` | `content/levels/peggys-cove.json`, drawn by `about-this-place` (`docs/content-review.md` §10.2) |

## What this level is, and what it is not

This section is first because it is the reason this file exists at all, and because a sentence written without
it would undo the decision the level document and `assets/style/peggys-cove-level.md` §0 were built on.

**This level's place is a fishing village in Nova Scotia. Its subject is a chapter of *Discover Canada*.**
`docs/content-review.md` §1's shipping rule, item 5, blocks *"any level whose **subject** is a nation's
territory or history"*. That is not this level: the subject is **Who We Are**, the bank key is `who-we-are`,
and the place is Peggy's Cove, named as a village. §1's may-ship list, item 5, permits **a territorial fact
line** with a citation, and `TN-LEVELS-02`'s second scenario states the same thing from the gate's side —
*"A citation is not a depiction."*

Three consequences bind every row in this file, and each is asserted rather than trusted:

1. **No copy on this level makes its subject a territory.** Not the title, not the subject line, not the
   waiting sentence, not the error title, not the stamp sentence, not the play label — **and not a line the
   lighthouse speaks** (`TN-PEGGYS-06`).
2. **The territorial statement lives in "About this place" and nowhere else.** `docs/content-review.md` §10.2
   fixes it there: always reachable, never modal, never dismissed to reach gameplay, sourced. A loading screen
   is the splash card §10.2 rules out, a stamp line is a congratulation the player taps past, and **a quest
   dialogue is a third shape that is not the panel** — see below, because that is the new risk and it needed
   deciding rather than assuming.
3. **Nothing in this level depicts anybody.** `assets/style/peggys-cove-level.md` §0 records that
   `neverAdd` on **both** of this level's art subjects carries *"a figure of any kind, at any scale,
   including a silhouette and a crowd"*, so the prohibition is a checked contract clause. The copy-side half
   is this file's: no string on this level describes, addresses or names a person, a people or a nation —
   **including every line the quest puts on screen**.

### Two silences, kept

Both are recorded in `assets/style/peggys-cove-level.md` §0 and in
`content/sources/kmk-about-consultation.json`, and **copy may not fill either**:

- **The word "Mi'kma'ki" is not used on this level, in either language.** Halifax's document names it on the
  strength of a Crown page; this level cites a Mi'kmaw body, **and that body's own page does not use the word
  in its own text**. Importing it from a third document would put two sources behind one sentence, which is
  `OQ-VANCOUVER-4` repeated on purpose. This is a rule about **this level's strings**, not a claim that the
  word is wrong and not an amendment to `TN-LEVEL-halifax.md`.
- **The word "unceded" is not used**, although it is what nearly every Canadian institution would reach for.
  The cited page says *"never surrendered, ceded, or sold"*, and the level document's statement says that.
  `content/levels/quebec-city.json` and `content/levels/vancouver.json` leave the word out for the same
  reason, and no row in this file restores it.

### The Tier 3 obligation, and what copy may not imply about it

`assets/style/peggys-cove-level.md` §0 carries an ADR-0009 marker dated **2026-12-08**: put this level, its
document and its two art subjects in front of a Tier 3 reviewer from the **Mi'kmaq**, and record the answer.
Five things it names are things no gate and no agent in this repository can check — among them whether
quoting the Assembly of Nova Scotia Mi'kmaw Chiefs in a *game* is wanted at all, and whether a level set here
that depicts **nobody** reads as respect or as erasure, which `docs/content-review.md` §10.3 already calls a
half-step.

**That review has not happened, and no string in this game may suggest it has.** No copy row, no panel line,
no quest line and no credit may say "reviewed", "approved", "endorsed", "in partnership with" or "with the
support of", in either language, and `communityReview.status` is never rendered on any screen.
`TN-PEGGYS-06` asserts each of those absences by name, because a warm word in a credits line is the cheapest
possible way to claim a consent nobody gave.

**The marker is copied into `docs/content-review.md` §13**, because `scripts/check-obligations.mjs` scans
`*.md` under `docs/` only and a marker in `assets/style/` had no clock on it. See `OQ-PEGGYS-4`.

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `level.peggys-cove.loading` | Getting the bare rock ready. | Préparation de la roche nue. |
| `level.peggys-cove.error.title` | We could not load Peggy's Cove. | Nous n'avons pas pu charger Peggy's Cove. |
| `stamp.peggys-cove.earned` | You earned the Peggy's Cove stamp. | Vous avez obtenu le tampon de Peggy's Cove. |
| `level.peggys-cove.play` | Play Peggy's Cove | Jouer à Peggy's Cove |

**`level.peggys-cove.loading` names the bare rock because bare rock is the ground the player walks on.**
`assets/style/peggys-cove-level.md` §1 and §2 describe four parallax layers — the sky, the open Atlantic, the
far side of the cove, and `peggys-cove-layer-40-granite-barrens`, which is jointed rock, grass in the joints,
four erratics and two tide pools, and is the band the walk line sits in. §6.3 puts it plainly: *"Bare rock is
the subject; grass is what grows in the cracks in it."* The sentence describes that ground in common nouns,
exactly as Ottawa's names the canal and Winnipeg's names the riverbank, and it survives an art decision that
moves an erratic or a tide pool. **The quest's own words picked the same noun up** — its `doneLine` reads
"You walked the bare rock…" — which is one level's vocabulary agreeing with itself rather than a row leaking.

**It does not say "shore", and that is a fact about the picture rather than a preference.** The water, the
wharf and the fish stores are on the **cove** layer, *behind* and *below* the player; the barrens the player
crosses stand above them, and the cove shows between the rock crests (§2, "the opaque feet"). A sentence
naming the shore would name ground this level does not put under the player's feet — `TN-WAIT`'s rule 2. The
word is left free, and level 10 takes it.

**The French names the same rock and takes no risk with « Rocheuse ».** « Préparation de la côte rocheuse. »
was the first draft and was dropped: « rocheuse » is one letter from « les Rocheuses », and
`assets/style/alberta-foothills-level.md` §0 deliberately refuses to let this game claim the Rockies from
either art or copy (`TN-ALBERTA-01` asserts the absence of the word). « La roche nue » is plain, is
grade-6 in both halves, is exactly what the tile draws, and collides with nothing. Its adjective agrees with
« roche », a noun — never with the player — which is the same shape `TN-LOOK`'s hair values take and is what
keeps `docs/content-review.md` §8.6 satisfied.

**No noun in it is used by any other level, in either language.** Ten built levels wait in ten different
nouns, and `TN-WAIT-01` checks it rather than trusting it.

**It names no landmark.** Peggy's Point Lighthouse is the level's only place-anchor and the only render
allowed to demand a place name (`assets/style/peggys-cove-level.md` §7). Where its name may and may not
appear is the next section, and the quest moved that line by exactly one surface.

### Where the landmark's name appears, now that it also speaks

Before the quest, the answer was one screen: the point-of-interest card's body, in both languages, with a
source. **ADR-0029 §6 adds a second, and it is required rather than incidental**: the dialog's accessible
name is the giver's name, read from `content/levels/peggys-cove.json#/pois[…]/name`, and `app/bootstrap/quest.ts`
refuses to open a dialog it cannot name. A screen-reader user is given the source of the words before the
words. So:

| Surface | Names it? | Why |
|---|---|---|
| The point-of-interest card's body | **Yes** | `TN-NAMES-01` — where a name teaches something, with its source |
| The quest dialog's accessible name and speaker label | **Yes** | ADR-0029 §6 — a line with no attributable source is a line the live region cannot attribute |
| The waiting sentence, the error title, the stamp sentence, the play label | No | `TN-WAIT`, `TN-DONE`, `TN-PASSPORT-02` — a stamp is named after a place, never after a building |
| `interact-prompt` and anything else inside `hud` | No | `TN-REACH` — the prompt says what pressing does and is never a name |
| The quest's title, summary and step prompts | No | they are drawn in `hud-quest-tracker`, which is inside the HUD |

**That is two surfaces, not one, and the file that said "the only screen" is amended here rather than left
to be contradicted by a test.** Both are principled and neither is a loosening: one is where a name teaches,
the other is where a name attributes. Peggy's Point Lighthouse is on neither `TN-NAMES`'s list of trade names
nor anybody's brand (`OQ-SPINE-5`), which is why a second surface is affordable here and would not be on
level 9.

### The four rows, and the French that is easier than it looks

- **`level.peggys-cove.error.title`.** The title carries no article in either language, so this is one of the
  easy rows — the shape Halifax, Toronto, Winnipeg and Vancouver already have. **It is written out all the
  same**, for the reason `TN-WAIT` gives: you cannot tell which levels a template will break until you write
  them out, and the level at the end of `unlockRules.order` breaks it in both languages.
- **The place name is not translated, and the apostrophe is load-bearing.**
  `content/levels/peggys-cove.json` declares the title as "Peggy's Cove" in `en` **and** in `fr`, which
  `TN-NAMES-03` covers: a string identical in both languages is written twice on purpose, never one value
  reused for both by accident. `assets/style/peggys-cove-level.md` §11 records why the apostrophe is there at
  all — the Canadian Geographical Names Database drops it and writes *Peggys Cove*, and this game keeps it
  because ***Discover Canada* keeps it**, on the page 94 caption this game teaches from. Every string in this
  file uses the same apostrophe character the level document uses, and "Peggys Cove" appears in no
  player-facing string in either language (`TN-PEGGYS-02`).
- **`stamp.peggys-cove.earned`** takes « de », the form Toronto, Winnipeg and Vancouver already take.
  **No fifth French form after « tampon » arrives with this level** — level 10 is where the fifth one arrives
  (« du Nord »). The English is the one worth a second look: *"the Peggy's Cove stamp"* puts a definite
  article in front of a possessive, which is correct English and reads oddly enough that somebody will try to
  "fix" it to "Peggy's Cove stamp" or "the Peggy's stamp". Both are refused by name in `TN-PEGGYS-05`.
- **`level.peggys-cove.play`** takes « à » with no article — the form five other levels take — because the
  place is a settlement and not a region. It is **not** « Jouer dans Peggy's Cove » and **not** « Jouer à la
  Peggy's Cove ».

**« Tampon », never « timbre »** — `TN-PASSPORT-my-passport.md` settled that word.

### `locomotion.walk.label`, and the mode this level does not declare

`content/levels/peggys-cove.json` declares **`walk` and nothing else**, with Halifax's tuning unchanged and
`"labelKey": "locomotion.walk.label"`. `walk` already has a row, so **this level adds nothing at all to
`TN-MOVE`'s table**, which is that table working as designed.

**The spine gave level 2 a canoe, and the level does not declare one.** Both reasons are in
`assets/style/peggys-cove-level.md` §9 and **either is sufficient alone**: `OQ-REVIEW-10` is unanswered and
`docs/content-review.md` §5.4 names the canoe as Indigenous technology used as a generic Canadian symbol —
*"A canoe as a vehicle the player rides is exactly the prop case in §5.1's second test"* — and there is no
canoe rig art, so a level declaring it would animate a walking figure under a HUD label that says otherwise.
`TN-LEVELS-02` makes a document declaring `canoe` a build failure with no override, and `TN-MOVE`'s rule
keeps `canoe` out of the label table while no document declares it. **Nothing in this file writes a label,
a prompt or a sentence about a canoe**, and `TN-PEGGYS-06` asserts the word appears in no string on this
level in either language.

## What this level has now, and what it still does not

`content/levels/peggys-cove.json` declares `"characters": []` and **one quest**,
`content/quests/peggys-cove-point-light.json`, whose giver is the point of interest the level already places.

**Two steps, not three.** A `talk` on the giver, then an `answer` of 3 drawn from `who-we-are`. There is no
`visit` step, because **the giver is the landmark** and a visit would send the player to the thing they are
already standing at — the same target named twice.

**So there are two ways to finish this level, and the card says which one happened.** Completing the task
draws `quest.done.title` — "Task done!" — and reaching the end draws `level.complete.title` — "Level
finished!" (`TN-DONE-01`). **Both earn the same stamp and both draw the same two rows this file owns**, which
is the point of writing the stamp sentence and the play label per level rather than per path. `TN-PEGGYS-05`
carries both paths rather than the one premise it used to have.

**The quest depicts nobody, and that is a property of the change rather than a hope.** `characters` is still
`[]`; the speaker on all four moment lines and on every step line is `peggys-point-light`; ADR-0029 §4
forbids `expression` on a line whose speaker resolves to a POI, and §7's gate checks it. ADR-0029 §5 fixes
the voice: **second person and impersonal** — "You have reached the light on the bare rock" — never "I have
kept this light for forty years". That rule is held by review rather than by a regex, and the ADR says why:
a first-person check is trivial to evade, false-positives on a quoted passage, and is worse in French. **On
this level it is the figure prohibition arriving through the copy instead of the picture**, which is the one
sentence from ADR-0029 §5 this file most needs to carry.

**The subject bank clears the floor comfortably.** `content/questions/who-we-are/` holds **forty-six authored
questions, all forty-six reported verified**, against `CLAUDE.md`'s thirty, and the quest's answer step draws
three of them. The spine said for two sessions that this bank existed and did not unblock the level, which
was true then and is the right reading now too: what unblocked this level is that its subject is a chapter
and its place is a village, not that its bank is full.

**What it still does not have is a giver the runtime can name.** ADR-0029's own obligation
(due 2026-11-13, owner engine) records it: `app/bootstrap/quest.ts` builds the copy key `npc.<giver>.name`,
there is no `npc.peggys-point-light.name` row, so `canEngage` returns false and the dialog is refused. **This
quest validates, passes every gate and cannot be played today.** That is fail-closed and correct, and it is
written here because a story that describes a quest the player cannot reach should say so in the same breath
(`OQ-PEGGYS-6`). **No copy row fixes it and none should be written to** — inventing `npc.peggys-point-light.name`
would put a landmark's name in the character namespace and in a copy table, when ADR-0029 §6 has it in the
level document already, in both languages, required.

### What "About this place" is for, now that a landmark speaks

**Unchanged — and the reason has to be written down, because this is the most plausible wrong turn the quest
opens.** A plaque at a real lighthouse is exactly the object that would carry a territorial statement, the
level now has something plaque-shaped that speaks, and moving the statement into it would feel like an
improvement. It is refused, for three reasons and any one is sufficient:

1. **§10.2 rules out anything the player taps past to reach gameplay.** A quest dialogue is advanced with
   *Next* and then it is over; the panel is always reachable and never blocking. A statement that lives only
   in dialogue is a statement that exists once, for the players who happened to accept.
2. **A quest can be declined** (`TN-DIALOGUE`). A territorial statement a player can decline to hear is a
   statement conditioned on consenting to a task, which is not what a sourced fact about whose land this is
   can be.
3. **They are two kinds of source and must not share a register.** The panel quotes **Kwilmu'kw
   Maw-klusuaqn's own words** about its own lands, with one `nationSource`; every quest line's `fact` block
   carries `sourceId: "discover-canada"`. Putting a nation's words in the same flow as a chapter paraphrase
   makes them one kind of thing, and they are not.

So the division is sharper than before, not looser: **the panel states the territorial fact; the landmark
teaches the chapter; the loading screen says what is being prepared; the stamp says what was earned.** The
new prohibition that follows is asserted in `TN-PEGGYS-06`: **no quest line on this level states or
paraphrases the territorial statement**, and the panel is reachable whether the quest was never met,
accepted, declined or finished.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-PEGGYS-03`; the escape route and the error buttons are `TN-WAIT-04`; the completion card is `TN-DONE-06`; the dialogue is `TN-QUEST-06` |
| Single switch | `TN-PEGGYS-03`; `TN-WAIT-04`; `TN-DONE-06` |
| Screen reader | `TN-PEGGYS-03`, which carries the dialog's accessible name; `TN-DONE-07` |
| Reduced motion | `TN-PEGGYS-03`; `TN-DONE-07` |
| 200 % text | `TN-PEGGYS-03` |
| Bilingual | `TN-PEGGYS-04`, and `TN-PEGGYS-05` for the two completion rows |
| Failure path | `TN-PEGGYS-02`; the missing-row gate is `TN-WAIT-03` for two of these rows and `TN-DONE-05` for the other two |
| Depiction | `TN-PEGGYS-06`, which is on the same footing as the five above and now covers the quest's lines |

---

## TN-PEGGYS-01 — Opening Peggy's Cove

```gherkin
Feature: Peggy's Cove says what it is getting ready
  Scenario: The waiting screen is about this level
    Given the Peggy's Cove level assets are still downloading
    Then the element "level-loading" is visible
    And it reads "Getting the bare rock ready."
    And it does not read "Getting the harbour ready."
    And it does not read "Getting the gravel shore ready."
    And it is text, not only a spinner

  Scenario: The HUD says how I move here
    Given the Peggy's Cove level is playable
    Then "scene-state" reports "data-level" equal to "peggys-cove"
    And "scene-state" reports "data-mode" equal to "walk"
    And the element "hud-mode-label" reads "Walking"
    And it is not empty
    And it does not read "walk"
    And it does not read "Canoeing" or name any mode the document does not declare

  Scenario: The waiting sentence claims no progress and names no landmark
    Given "level-loading" is visible
    Then its text contains no percentage, no fraction and no step count
    And it contains no "…" and no "..."
    And it does not contain "lighthouse" or "phare"
    And it does not contain "Peggy's Cove", "Peggys Cove" or "Peggy's Point"
    And it does not contain "Nova Scotia" or "Nouvelle-Écosse"

  Scenario: The waiting sentence states no territorial fact
    Given "level-loading" is visible
    Then it does not contain "territory" or "territoire"
    And it does not contain "traditional" or "traditionnel"
    And it does not contain "unceded" or "non cédé"
    And it does not contain "Mi'kmaq", "Mi'kmaw" or "Mi'kma'ki"
    And it does not contain "title" or "titre"
    And the territorial statement is drawn only by "about-this-place"

  Scenario: The panel states the fact, with its source, and is the only place that does
    Given the Peggy's Cove level is playable
    When I open "about-this-place"
    Then it shows the statement the level document carries
    And it shows "Mi'kmaq"
    And it names the body the statement is quoted from
    And no other screen in this level shows that name in either language
    And no line the quest puts on screen shows it
    And the panel is not modal and was not dismissed to reach the level

  Scenario: The landmark is named where a name teaches something
    Given the Peggy's Cove level is playable
    When I engage the landmark
    Then the quest dialogue opens, because this landmark is this level's quest giver
    And "poi-card" shows "Peggy's Point Lighthouse" as text, inside a sentence that says what it is,
      whenever the card is the thing that opens
    And no lettering, wordmark or signage is drawn on the building

  Scenario: Exactly two surfaces name it, and the HUD is not one of them
    Given the Peggy's Cove level is playable
    Then "Peggy's Point Lighthouse" appears in the point-of-interest card's body
    And it appears as the quest dialog's accessible name and speaker label, as ADR-0029 requires
    And it appears on no other screen in this level, in either language
    And no string drawn inside "hud" contains it
    And no waiting sentence, error title, stamp sentence or play label contains it

  Scenario: The HUD says a thing has something to offer, and does not name it
    Given the Peggy's Cove level is playable
    When I come within reach of the landmark
    Then "interact-prompt" reads "See what there is to do here", the row TN-REACH owns
    And it does not read "Look at this place", because pressing opens a task and not a card
    And it does not read "Talk to this person", because nobody is there
    And it names nothing
```

## TN-PEGGYS-02 — Peggy's Cove fails in its own name (failure path)

```gherkin
Feature: The error card names this level
  Scenario: The assets cannot be fetched
    Given requests for the Peggy's Cove assets fail
    When I open the Peggy's Cove level
    Then the event "level/failed" is emitted for "peggys-cove"
    And the element "level-error" is visible
    And it says "We could not load Peggy's Cove." and "Check your connection and try again."
    And it does not name Halifax, Québec City, Ottawa, Toronto, Winnipeg, the Prairies,
      the Alberta foothills, Vancouver or the North
    And a button "Try again" is offered
    And a button "Go back" is offered
    And the element "playable" is never present

  Scenario: The title is the card's accessible name
    Given "level-error" is visible
    Then the accessible name of "level-error" is "We could not load Peggy's Cove."
    And it is not "Error", "Something went wrong" or empty

  Scenario: The apostrophe is the one the level document carries
    Then "We could not load Peggy's Cove." contains the same apostrophe character as
      the "en" title in "content/levels/peggys-cove.json"
    And the French row contains that same character
    And no player-facing string in this game in either language reads "Peggys Cove"
    And a build in which a formatter replaces that character in one language only fails this scenario

  Scenario: The easy case is a written row all the same
    Then "level.peggys-cove.error.title" is a written row in both languages
    And it is not produced by dropping this level's title into a sentence
    And the last level in "unlockRules.order" would break that same template in both languages

  Scenario: A stalled load can be left
    Given the Peggy's Cove level has not become playable
    When the load has not finished after the time-to-play budget in "game.config.json" has passed twice
    Then a "Go back" button is visible and focusable
    And "level-loading" still reads "Getting the bare rock ready."
    And nothing on the screen counts down

  Scenario: A quest whose giver cannot be named is refused, not guessed at
    Given the runtime cannot resolve a display name for this level's quest giver
    When I come within reach of the landmark
    Then no dialogue opens
    And no dialog is drawn with an empty, guessed or id-shaped accessible name
    And nothing on screen blames me or reads as an error
    And this is ADR-0029's obligation, open until the name is read from the level document
```

## TN-PEGGYS-03 — Everybody gets these strings

```gherkin
Feature: The level's own words reach every player
  Scenario: A screen-reader user is told what is being prepared and how they move
    When the Peggy's Cove level starts loading
    Then "#tn-live-region" reads "Getting the bare rock ready."
    And it is not repeated while the load continues
    When the level becomes playable
    Then "hud-mode-label" is in the accessibility tree as text reading "Walking"
    And the canvas is "aria-hidden"

  Scenario: A screen-reader user is told what is speaking before they are told what it says
    Given the Peggy's Cove level is playable
    When the quest dialogue opens
    Then the dialog's accessible name is "Peggy's Point Lighthouse", from the level document
    And it is never empty, and the dialog is refused rather than opened unnamed
    And "dialogue-speaker" carries the same string
    And no portrait, face or expression is drawn beside it
    And nothing in the dialogue is written in the first person

  Scenario: A screen-reader user can reach the territorial statement without leaving the level
    Given the Peggy's Cove level is playable
    Then "about-this-place-open" is reachable from the pause menu and from the credits
    And it is reachable whether I have never met the quest, accepted it, declined it or finished it
    And opening it does not pause, block or end the level
    And its content is text in the accessibility tree, not an image
    And nothing about it is announced unasked while I am playing

  Scenario: A keyboard player and a switch user reach both ways out
    Given "level-error" is visible for Peggy's Cove
    And I am using a keyboard only
    Then "Try again" and "Go back" are reachable with "Tab" and activate with "Enter"
    Given single-switch mode is on
    Then both are reached with short presses and chosen with a long press
    And nothing expires while I decide
    And the highlight never lands on "hud-mode-label"

  Scenario: The whole level is completable without a second hand, by either route
    Given the Peggy's Cove level is playable
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
    Then "level-loading" reads "Getting the bare rock ready."
    And nothing on it spins, pulses, slides or flashes

  Scenario: They fit at 200 %
    Given text scaling is 200 %
    And the viewport is 390 x 844
    Then the whole of "Getting the bare rock ready." is visible while loading
    And in French the whole of "Préparation de la roche nue." is visible
    And both sentences on "level-error" are readable, by scrolling if needed
    And the whole of "Vous avez obtenu le tampon de Peggy's Cove." is visible on the completion card
    And every control is still at least 44 CSS px wide and tall
    And the page does not scroll sideways
```

## TN-PEGGYS-04 — Peggy's Cove in French

```gherkin
Feature: The level in French
  Background:
    Given the language is French

  Scenario: Waiting is French, and says no more than the English does
    Given the level assets are still downloading
    Then "level-loading" reads "Préparation de la roche nue."
    And it does not read "Préparation de la côte rocheuse."
    And it does not contain "Rocheuses"
    And it contains no percentage, no step count and no ellipsis
    And it contains no nation's name and no territorial claim
    And "#tn-live-region" reads it once, with "lang" equal to "fr"

  Scenario: The HUD and the card headings are French
    Given the Peggy's Cove level is playable
    Then "hud-mode-label" reads "Marche"
    And the level title reads "Peggy's Cove" with the subtitle "Qui nous sommes"
    And "interact-prompt" reads "Voir ce qu'il y a à faire ici" when the landmark is in reach

  Scenario: The failure is French, and the place name is not translated and takes no article
    Given requests for the Peggy's Cove assets fail
    Then "level-error" says "Nous n'avons pas pu charger Peggy's Cove."
    And it does not say "Nous n'avons pas pu charger le Peggy's Cove."
    And it does not say "Nous n'avons pas pu charger l'anse de Peggy."
    And it does not say "Nous n'avons pas pu charger Peggys Cove."
    And it also says "Vérifiez votre connexion et réessayez."
    And the buttons read "Réessayer" and "Retour"

  Scenario: The title is the same string in both languages and is declared twice
    Then "level.peggys-cove.title" has a value in "en" and a value in "fr"
    And neither language falls back to the other's value
    And a missing French value fails the content check even though the screen would read correctly

  Scenario: The landmark's French name translates the common noun and keeps the place name
    Given the Peggy's Cove level is playable
    When the quest dialogue opens
    Then its accessible name is "Le phare de Peggy's Point"
    And the English dialog's name is "Peggy's Point Lighthouse"
    And "Peggy's Point" is identical in both
    And the point-of-interest card draws the same pair
    And no waiting, error, stamp or prompt string in either language contains either name

  Scenario: The quest speaks French, impersonally
    Given the Peggy's Cove level is playable
    When the quest dialogue opens
    Then every line is the French text the quest document carries
    And no line uses "je", "j'ai", "nous" or "on" about the speaker
    And no line names a person, a people or a nation

  Scenario: Both languages or neither
    Then every key in this file's table has a value in "en" and in "fr"
    And no string in either language contains "(e)", "·e" or a bracketed ending
    And no string is drawn onto the canvas as part of an image
```

## TN-PEGGYS-05 — Finishing Peggy's Cove, by either route

```gherkin
Feature: This level's two sentences on the completion card
  Scenario: Finishing this level says so in this level's words
    Given the Peggy's Cove level is playable
    When I reach the end of it
    Then the event "stamp/earned" is emitted for "peggys-cove"
    And the element "quest-complete-stamp" reads "You earned the Peggy's Cove stamp."
    And it does not read "You earned the Peggy's stamp."
    And it does not read "You earned Peggy's Cove stamp."
    And it does not name any other level
    And it does not contain "lighthouse" or "Peggy's Point"
    And it does not contain "territory", "unceded" or the name of a nation

  Scenario: There are two ways to finish, and the heading says which happened
    Given the Peggy's Cove level is playable
    When I finish its task
    Then "quest-complete-card" shows "Task done!", as TN-QUEST-04 requires
    Given I instead reach the end of the level having accepted no task
    Then "quest-complete-card" shows "Level finished!", as TN-DONE-01 requires
    And in both cases the stamp sentence and the play label are the rows in this file
    And in both cases exactly one stamp is earned

  Scenario: The stamp is the same whichever route I took
    Given I finished the task
    Then the passport shows one Peggy's Cove stamp
    Given another player reached the end without accepting the task
    Then their passport shows the same one stamp, with the same sentence
    And no screen says one route was worth more than the other

  Scenario: The French stamp sentence takes "de", with no elision and no article
    Given the language is French
    When I finish the Peggy's Cove level
    Then "quest-complete-stamp" reads "Vous avez obtenu le tampon de Peggy's Cove."
    And it does not read "Vous avez obtenu le tampon d'Peggy's Cove."
    And it does not read "Vous avez obtenu le tampon du Peggy's Cove."
    And it does not contain "timbre"

  Scenario: The control that opens this level takes "à"
    Given finishing Halifax opened Peggy's Cove
    Then "quest-complete-next" reads "Play Peggy's Cove"
    And in French it reads "Jouer à Peggy's Cove"
    And it does not read "Jouer dans Peggy's Cove"
    And it is not "Peggy's Cove" on its own

  Scenario: Both rows exist in both languages, or the build fails
    Then "stamp.peggys-cove.earned" and "level.peggys-cove.play" each have a value in "en" and in "fr"
    And a missing row fails the content check, as TN-DONE-05 describes
    And neither is assembled from a template with this level's title dropped into it
    And this level adds no fifth French form after "tampon"

  Scenario: A player who walked past everything is not told they learned something
    Given I reached the end of Peggy's Cove having answered no question
    Then "quest-complete-stamp" still reads "You earned the Peggy's Cove stamp."
    And the line about my answers is the one in TN-DONE-02
    And no sentence on the card names the lighthouse
    And nothing tells me I missed the task
```

## TN-PEGGYS-06 — What this level never says (depiction path)

```gherkin
Feature: The place is a place, the subject is a chapter, and no string says otherwise
  Scenario: No copy row makes this level's subject a territory
    Then "level.peggys-cove.title" reads "Peggy's Cove" in both languages
    And "level.peggys-cove.subtitle" reads "Who we are" and "Qui nous sommes"
    And neither contains "Mi'kma'ki", "Mi'kmaq", "territory" or "territoire"
    And no waiting sentence, error title, stamp sentence or play label in either language contains them
    And the level document's "subject" is "who-we-are"

  Scenario: The word this level does not use
    Then no string drawn by this level in either language contains "Mi'kma'ki"
    And this is a rule about this level's strings and not about TN-LEVEL-halifax.md's
    And no string in this level contains "unceded" or "non cédé"
    And the statement in "about-this-place" is the level document's own text, quoted, not paraphrased

  Scenario: The quest teaches the chapter and never the territory
    Then no line the quest puts on screen states or paraphrases the territorial statement
    And no quest line contains "territory", "territoire", "unceded" or "non cédé"
    And no quest line names a nation
    And every quest line that states a fact carries a source, and that source is Discover Canada
    And the territorial statement's own source is the level document's, and is drawn only by the panel

  Scenario: The thing that speaks does not become somebody
    Then every line on this level is attributed to "peggys-point-light"
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

  Scenario: Copy names nothing the art contract forbids
    Then no string in this level in either language contains "canoe", "canot" or "kayak"
    And none names a person, a people or a figure drawn in this level, because none is drawn
    And the "neverAdd" list on both of this level's art subjects is the other half of this scenario

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

- **`OQ-PEGGYS-1` — this level places no character, and after ADR-0029 that is a smaller gap than it was.**
  The quest is given by the landmark, so nothing is waiting on a person and nothing is blocked. If a
  character is ever placed here, it is the first figure this level has ever had and
  `docs/content-review.md` §1 is engaged the moment it carries a marker — read
  `assets/style/peggys-cove-level.md` §0 before writing a word of one. *Recommendation:* leave it as it is.
  If one is ever wanted, choose an **epicene** French role noun so `OQ-LEVEL-8`'s agreement question never
  arises here. **The interact prompt is already settled and is not waiting on that**: the landmark draws
  `TN-REACH`'s new generic row rather than a per-target row, because a per-target row would name it in the
  HUD and this file forbids that.
- **`OQ-PEGGYS-2` — the level's facts are unverified, and the quest added five more.**
  `content/levels/peggys-cove.json` carries `verification.status: "unverified"` on the point of interest's
  fact, on the territorial statement **and** on the `nationSource`, and
  `content/quests/peggys-cove-point-light.json` carries three `factual: true` lines in the same state. Nothing
  in this file's four rows states a fact, so none of them is blocked; the card, the panel and now the
  dialogue are. **The good half is worth recording**: `assets/style/peggys-cove-level.md` §8 shows this is the
  first level whose `fact.source` and `nationSource` are **one body speaking for itself about its own lands**,
  which is what `OQ-WINNIPEG-3` and `OQ-VANCOUVER-4` both asked for and neither could get. And ADR-0003's
  second amendment is why the quest's lines go to the same verifier as everything else: **verification
  follows the claim, not the screen it appears on** — a wrong fact on a plaque is exactly as wrong as a wrong
  fact in a Mountie's mouth. Routed to the content verifier.
- **`OQ-PEGGYS-3` — the statement is `volatile` for half a sentence, and the panel can lose it without
  warning.** `content/sources/kmk-about-consultation.json` records why: *never surrendered, ceded or sold* is
  about the absence of a historical cession and does not expire, while *a Title claim to all lands in Nova
  Scotia* describes a position inside a running negotiation. `CLAUDE.md` re-verifies volatile items every run
  and quarantines them. *Recommendation:* the panel behaves as `OQ-VANCOUVER-3` recommends — it says plainly
  that the source is being checked and keeps its citation — and **nothing in this file changes either way**,
  which is the point of keeping the statement out of these four rows and out of the quest.
  `TN-PEGGYS-06`'s last scenario is that behaviour written as acceptance.
- **`OQ-PEGGYS-4` — the Tier 3 obligation was decoration until 2026-09-13, and the fix should be the wider
  one.** `assets/style/peggys-cove-level.md` §0 and `assets/style/the-north-level.md` §0 both carry ADR-0009
  markers dated 2026-12-08 that `scripts/check-obligations.mjs` never read, because it scans `*.md` under
  `docs/` only. Both are copied into `docs/content-review.md` §13, which puts a clock on them today.
  *Recommendation:* **also widen the scanner** to `assets/style/`, and treat the copies as the stop-gap they
  are. Routed to the engine agent; `scripts/` is not this directory's to edit. See `OQ-NORTH-5`.
- **`OQ-PEGGYS-5` — "the bare rock" describes ground the player crosses for seventeen seconds and nothing
  else.** The level is 7040 px at the walk's 420 px/s, the polyline is flat the whole way, and the roll of the
  barrens is drawn in the tile above the walk line rather than in the ground
  (`assets/style/peggys-cove-level.md` §3). *Recommendation:* accept it, on the same licence `OQ-WAIT-3` took
  for "the harbour" and `OQ-ALBERTA-5` for "the pasture": describe the ground, do not name it. **The quest
  reuses the noun** in its `doneLine` — "You walked the bare rock" — which is a level's vocabulary agreeing
  with itself and is the cheapest evidence that the row was the right one.
- **`OQ-PEGGYS-6` — this level's quest cannot be played, and the gate that would catch that does not exist.**
  ADR-0029's obligation (due 2026-11-13, owner engine) records the cause: `app/bootstrap/quest.ts` resolves a
  giver's display name from the `npc.<id>.name` copy row, there is no such row for a landmark, and the dialog
  is refused for want of an accessible name. So this level ships a quest that **validates, passes every gate
  and opens for nobody**. `TN-PEGGYS-02`'s last scenario asserts the refusal is silent and blameless, which is
  the right behaviour for the state; what no scenario in this directory asserts is that the state ends.
  *Recommendation:* when the name resolution lands, the same change should make a quest whose giver cannot be
  named a **build** failure rather than a runtime refusal — a quest nobody can open is a content defect, and
  `TN-WAIT-03`'s shape is the precedent. Routed to the engine agent with ADR-0029's obligation.
