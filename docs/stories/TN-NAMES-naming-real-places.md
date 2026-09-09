# TN-NAMES — Naming a real place in player-facing copy

**Intent.** The game can tell a player what they are looking at, using the building's real name, without
ever implying that the business behind that name has anything to do with this game.

This file exists to answer a question that has been asked three times in three places and belongs to none of
them. `OQ-QUEBEC-1` (`assets/style/quebec-city-level.md` §9) says the Château Frontenac is an operating hotel
under a live trade name, that the art draws the building and **no wordmark, sign, awning, flag or emblem**,
that Canada's freedom of panorama covers the building itself — *and that whether the **name** appears in copy
is the product owner's call*. `OQ-SPINE-5` asks the same question for the CN Tower, the Canadian Museum for
Human Rights and Canada Place, and asks for **one written answer covering the class rather than three tickets
covering three buildings**. This is that answer.

**Amended 2026-09-09 — rule 2's list of places grows by one closed set, because three shipped quests
already needed it.** A quest's giver has to be able to say where the player is going, and the tracker has to
be able to repeat it. `TN-DIALOGUE-what-a-quest-giver-says.md` carries the decision, its four reasons and its
cost; this file carries the rule, so that a reader arriving here is not told something narrower than the
project actually does. Both files point at each other, as `README.md` requires.

Read `README.md` in this directory first. `TN-LEVELS-2-to-10-spine.md` owns which landmark each level draws;
`TN-PASSPORT-my-passport.md` reuses this file's rule for what a stamp is named after; each level's own story
owns its point-of-interest copy and is bound by the rules below.

## The decision

**A real place may be named in player-facing text, as a plain factual description of what the player is
looking at or of where they are being sent, and never as anything else.** Concretely:

1. **The name is text.** It is a translated copy string or an authored content string like every other,
   drawn by the DOM, readable by a screen reader. It is never lettering inside a picture — `make verify-art`
   already refuses a `<text>` element in a render source, and this rule is the copy-side half of the same
   decision.
2. **The name appears in the point-of-interest card's body, and in a quest document's own `summary`,
   `dialogue[].text` and `steps[].prompt`, and nowhere else.** Not in a level title, not on a stamp, not on
   the map, not on the title screen, not in a heading, not in a menu item, not in a loading message, not on
   an error card, and not in `interact-prompt`, which is generic by `TN-REACH`'s own rule. **The quest step
   prompt is drawn inside the HUD, and it is the one HUD string allowed to carry such a name** — because a
   task the player accepted is not chrome, and a tracker that will not name the destination is worse for the
   player who most needs it read aloud.
3. **A level is named after its place, not after its landmark.** Level 3 is "Québec City" / « Ville de
   Québec ». The building is what the player finds inside it.
4. **No mark, ever.** No logo, no wordmark, no stylised typeface, no crest, no colour scheme borrowed from a
   brand, no possessive corporate form. The name is set in the game's own body type at the game's own size.
5. **No claim of association.** No sentence says or implies that the place, its owner or its operator made,
   sponsored, approved or is connected to this game. The game already says on its first screen that it is not
   made by the Government of Canada (`title.notOfficial`); the same honesty applies to a hotel.
6. **The name is not an invitation.** No booking link, no address, no opening hours, no price, no "visit
   them". A card — or a line of dialogue — that reads like an advertisement has changed what the name is
   doing there.
7. **The name is factual and sourced.** A sentence naming a real place is a factual claim and is verified
   like a question (`CLAUDE.md`, Facts), with its chapter or source recorded. A dialogue line carries its own
   `fact` claim for exactly this reason.

**What this is not.** It is a product and editorial decision, made where `OQ-QUEBEC-1` asked for one, and it
is not legal advice. It is the *conservative* option in every direction the art already took: describe, do
not display; name where it does a job, in prose; carry no mark. If the project owner wants a stricter line —
no trade names at all — the change is small and mechanical, because rule 2 keeps every such name in two kinds
of place. `OQ-NAMES-1` records what would have to change.

## The class this covers

| Place | Level | Why it is here |
|---|---|---|
| Château Frontenac | 3 | An operating hotel under a live trade name — `OQ-QUEBEC-1` |
| CN Tower | 5 | A trademarked name, on the skyline as a second recognisability anchor |
| Toronto City Hall | 5 | Civic, and named after a city, not a business |
| Canadian Museum for Human Rights | 6 | An institution with its own visual identity |
| Canada Place | 9 | A building whose name is also a brand |
| Pier 21 | 1 | A national historic site, named in its own right |
| A named ranch, a named grain elevator | 7, 8 | `TN-LEVELS` requires a *specific, cited* structure rather than a type |

Every one of them is drawn from a cited reference with a credit, carries no mark, and may be named under the
seven rules above. Nothing on this list may be named on a stamp, on the map or in a level title.

**The last row is not exercised today.** `content/levels/prairie-rail.json` names its landmark "Prairie
grain elevator" — a type, not a trade name — and the art ships blank because every real elevator carries its
company's name painted across the crib and `make verify-art` refuses lettering (`OQ-PRAIRIE-3`). The row
stays because it is still right for level 8's named ranch and for any future named reference; it is recorded
here so nobody reads the table as a claim that level 7 names a business.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only, single switch | `TN-NAMES-02` — the name is in the card's or the quest's text, so it is reached by whatever reaches them |
| Screen reader | `TN-NAMES-02` — a name in a picture cannot be read; a name in text can |
| Reduced motion | `TN-NAMES-02` — the name never arrives as an animation or a flourish |
| 200 % text | `TN-NAMES-02` — a name is a string that has to fit, not a graphic that has to scale |
| Bilingual | `TN-NAMES-03` |
| Failure path | `TN-NAMES-04` — a name that has leaked somewhere it may not be |

---

## TN-NAMES-01 — Where a real name may appear, and where it may not

```gherkin
Feature: A real place is named where naming it does a job
  As a player standing in front of a famous building
  I want the game to tell me what it is
  So that I learn the place and not a riddle

  Scenario: The point-of-interest card names the building
    Given I engage the landmark on level 3
    Then the element "poi-card" shows "Château Frontenac" as text
    And the name is inside a sentence that says what the building is
    And it appears exactly once on the card

  Scenario: The quest's giver may say where I am going
    Given the level 3 quest is offered
    Then the dialogue may contain "Château Frontenac" inside a sentence that says what to do
    And "hud-quest-tracker" may contain it as part of that quest's own step prompt
    And no other string inside "hud" contains it

  Scenario: The level is named after the place
    Then the level's title is "Québec City"
    And no level title in this game is the name of a building, a hotel or a business

  Scenario: The stamp is named after the place
    Given I earn level 3's stamp
    Then its label in the passport is "Québec City"
    And it is not "Château Frontenac"

  Scenario: The name is nowhere else
    Then no name on this file's list appears on "title-screen", "level-select", "passport",
      a menu item, a heading, a loading message, an error card or a stamp sentence
    And it does not appear in "interact-prompt"
    And no copy table row in either language contains one

  Scenario: The name carries no mark
    Then the name is drawn in the game's own body type
    And no logo, wordmark, crest, monogram or stylised lettering is drawn with it
    And no colour is used for it that is not in the game's own palette

  Scenario: Nothing claims a connection
    Then no sentence on the card and no line of dialogue says the place made, sponsors, approves or is
      connected to this game
    And no booking link, address, opening time or price is shown
    And nothing invites the player to visit, book or buy

  Scenario: A sentence naming a real place is verified like any other fact
    Then the card's factual sentences carry a source
    And a dialogue line naming one carries its own "fact" claim
    And the content check fails the build for a factual sentence with none
```

## TN-NAMES-02 — A name is text, so everybody gets it

```gherkin
Feature: The name is a string, not a picture
  Scenario: A screen reader reads the name
    Given the element "poi-card" is visible
    Then the name is in the accessibility tree as text
    And it is not conveyed only by the picture of the building
    And the picture is "aria-hidden", or its alternative text is the same name

  Scenario: The picture contains no lettering at all
    Then the landmark art contains no text element
    And "make verify-art" fails a render source that contains one

  Scenario: The name is reached by whatever reaches the card
    Given I am using a keyboard only
    Then the name is inside "poi-card" and is read when the card opens
    Given single-switch mode is on
    Then reaching the card with short and long presses is enough to reach the name

  Scenario: A screen-reader user who navigates by the tracker is told the destination
    Given a quest whose step prompt names a place on this file's list is accepted
    Then "hud-quest-tracker" is in the accessibility tree as text including that name
    And the same words are what a sighted player reads

  Scenario: The name arrives with the card and not as a flourish
    Given reduced motion is on
    Then the name appears with the card, with no slide, fade, scale or typewriter effect

  Scenario: The name fits at 200 %
    Given text scaling is 200 %
    And the viewport is 390 x 844
    Then the whole name is visible, on one or two lines
    And it is not truncated with an ellipsis
    And the page does not scroll sideways
```

## TN-NAMES-03 — The name in both languages

```gherkin
Feature: A name that is the same in both languages says so
  Scenario: A name identical in English and French is written identically
    Then the card shows "Château Frontenac" in English and "Château Frontenac" in French
    And the key has a value in both languages, not one value used for both by accident

  Scenario: The sentence around the name is a translation of meaning
    Then the English and French sentences say the same thing about the building
    And neither is a word-for-word rendering of the other
    And both read at roughly a grade-6 level

  Scenario: Accents are not dropped in either language
    Then the name is spelled with its accents in both languages
    And no screen shows "Chateau Frontenac" without the circumflex

  Scenario: A place with two names uses each language's own
    Then a place whose English and French names differ shows each language its own name
    And a nation's own name for itself is identical in both, as docs/content-review.md §9.3 requires

  Scenario: No name needs gender agreement
    Then no sentence naming a place contains "(e)", "·e" or a bracketed ending
```

## TN-NAMES-04 — A name that has leaked (failure path)

```gherkin
Feature: The rule is checkable, not a promise
  Scenario: A trade name in a level title fails the build
    Given a level document's title in either language contains a name on this file's list
    When the content check runs
    Then the build fails, naming the level and the string
    And the message points at this file

  Scenario: A trade name on a stamp, a map card or a menu fails the build
    Given a copy string drawn by the passport, the level select, the HUD or a menu contains such a name
    When the content check runs
    Then the build fails, naming the key

  Scenario: The HUD exception is exactly one field, not the HUD
    Given a quest document's step prompt contains such a name
    Then the check passes, because the tracker draws that quest's own words
    Given any copy table row drawn inside "hud" contains such a name
    Then the check fails
    And "interact-prompt" is checked as a copy row, never as content

  Scenario: The exception is a set of paths, not a document
    Then the only content fields allowed to carry such a name are a quest document's "summary",
      its "dialogue[].text" and its "steps[].prompt"
    And such a name in any other field of any document fails the check

  Scenario: Lettering in the art fails the art check
    Given a render source for a landmark contains a text element
    When "make verify-art" runs
    Then it fails, naming the file

  Scenario: The check is proven by a failing fixture
    Then a fixture exists for each scenario above
    And each is asserted to fail
    And a change that makes any of them pass fails this suite

  Scenario: The list is data, not a habit
    Then the names this check looks for are declared in one place
    And adding a level that names a real place adds its name to that list in the same change
```

---

## Open questions

- **`OQ-NAMES-1` — the project owner may want a stricter line, and this is what it would cost.** If trade
  names may not appear at all, level 3's point-of-interest card describes the building without naming it,
  which is a worse card in plain-language terms — "the big hotel above the river" is evasive, and a newcomer
  who later hears the name has learned nothing transferable. **Since 2026-09-09 the cost is larger than one
  copy pass**: three shipped quest documents name their destination in a summary, a dialogue line and a step
  prompt, so the stricter line is a content pass over `content/quests/` as well. *Recommendation:* ship the
  decision above, and put it in front of the project owner before the first public build, exactly as
  `OQ-TITLE-4` does for the not-official sentence. What must not happen is the name being used more widely
  than rule 2 allows because nobody re-read this file.
- **`OQ-NAMES-2` — does this file cover people as well as places?** No. Depicting or naming a person is
  `docs/content-review.md`'s subject, and it is stricter in ways this file must not appear to soften.
  *Recommendation:* keep this file about places and buildings only, and say so at the top of any level story
  that names a person. **A character's own name is `npc.<id>.name` and is a role**, which
  `TN-GUIDE-the-guide.md` and `TN-LEVEL-ottawa.md` own for the two characters that exist.
- **`OQ-NAMES-3` — where does the checkable list of names live?** `TN-NAMES-04` requires one place that
  declares the names the content check looks for, and nothing in `content/` has one today.
  *Recommendation:* beside the reference credits, since every name on the list already has a cited reference
  in `assets/refs/references.json`. Routed to the architect; `content/` and `assets/` are not this
  directory's to edit.
- **`OQ-NAMES-4` — is level 3's point-of-interest copy written yet?** No — but its **quest** is, and it names
  the building three times (`content/quests/quebec-city-chateau-frontenac.json`). That is allowed under rule
  2 as amended, and it means the first place a player will read this name is a line of dialogue rather than
  the card the rule was written for. *Recommendation:* write the point-of-interest sentence in level 3's own
  story, under this file's rules, verified like any other factual claim, so the card teaches what the
  dialogue only points at.
- **`OQ-NAMES-5` — the amendment moved a line that had been drawn in one place for a reason.** Before
  2026-09-09 this file could say "the name appears in one kind of place", and the gate was correspondingly
  blunt: no such name in any HUD string, full stop. It is now "two kinds of place", and the HUD half has an
  exception that a checker has to know about. That is a real loss of sharpness, taken deliberately because
  the alternative was three shipped quests in an unruled state and a guide who may not say where you are
  going. *Recommendation:* keep the exception mechanical — three JSON paths in one document type — and
  review it the next time a quest document gains a field, because the way this rule fails is by a fourth
  field quietly joining the set.
