# TN-LOOK — The five slots, and the names of everything in four of them

**Intent.** Every appearance the rig can draw has a name a player can read and a screen reader can say, in
both languages, and no option is reachable only by looking at a picture.

Read `README.md` in this directory first. `TN-CREATOR-character-creator.md` owns the **screen** these names
are drawn on; `TN-SKIN-naming-the-six-skin-tones.md` owns the sixth table, the skin ramps, because that one
slot's naming is a ruling under `docs/content-review.md` §8.1 and has to be re-openable without touching the
other four; `TN-FIRSTRUN-choosing-a-character-before-playing.md` owns when the screen is offered.

## Why this is a file and not four rows in `TN-CREATOR`

The same reason `TN-MOVE` owns a mode label and `TN-GUIDE` owns a character's name: **the table's home
follows what the string belongs to, not which screen draws it** (`README.md`). A slot label belongs to the
slot. Four things draw it — the group heading, the preview's text description, the live-region
label-and-value line, and the same screen re-opened from Settings — and a sixth slot, when
`docs/content-review.md` §8.5 or §8.7 lands one, is a row added beside its slot's other rows rather than a
row inserted into a screen's chrome table.

It is also the file that makes the gap visible. `content/characters/rig.json` declares five
player-selectable slots and nineteen options between them; `app/ui/copy.ts` carries labels for **three**
slots, one of which (`creator.slot.coat`) names a slot the rig does not have, and **no option names at all**.
That is why the creator has never been mounted: mounting it means inventing player-facing content, which
ADR-0010 forbids. This file and `TN-SKIN` are the content.

## What is depicted

Per `README.md`'s *Depiction is acceptance too*, before the scenarios:

- **Depicted:** one person, on one artboard, at the one proportion canon (`assets/style/art-bible.md` §7).
  Skin tone, hair shape, hair colour, a head covering, glasses. `assets/style/player.md` is the costume; the
  costume is **not** a player choice and is not in this file.
- **Not depicted, and not a copy question:** nothing nation-specific. No regalia, no ribbon skirt, no ribbon
  shirt, no beadwork, no braid style tied to a nation, and no `nation` field on the player character at all
  (`docs/content-review.md` §3.4 — a rule, not an open question). The player character's `indigenous` is
  `false` and that is the only honest value, exactly as it is for the guide (`TN-GUIDE`).
- **Not offered, and named so nobody reads the silence as a decision:** a body-mass slot (§8.5) and any
  visible-disability option beyond glasses (§8.8) are `OQ-REVIEW-8`, unanswered. No slot exists, so no row is
  written. A religious-dress option beyond the toque (§8.7) is reference-accuracy work with a citation per
  option, not a naming problem; `OQ-LOOK-4` records what would have to exist first.
- **No agent grants cultural sign-off on any of this** (`docs/content-review.md` §1). No scenario below
  asserts that a depiction is approved, and none may be added that does.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-LOOK-06` |
| Single switch | `TN-LOOK-07` |
| Screen reader | `TN-LOOK-08` |
| Reduced motion | `TN-LOOK-09` |
| High contrast | `TN-LOOK-09` — the name is what survives when the swatch does not |
| 200 % text | `TN-LOOK-09` |
| Bilingual | `TN-LOOK-10`, and every table below is written in both languages |
| Failure path | `TN-LOOK-04` (a name is missing, duplicated or invented), `TN-LOOK-05` (a saved option is gone) |

---

## The key shape, and the gate that uses it

**A slot row is `creator.slot.<slotName>`, where `<slotName>` is the rig's own slot key, spelled exactly as
the rig spells it.** `hairShape`, not `hair-shape`, not `hair`. **An option row is
`creator.<slotName>.<optionId>`, where `<optionId>` is the rig's own option id, spelled exactly.**

That gives `creator.skin.skin-1`, which stutters, and it stays. A key derived from the id by one rule is a
key a gate can generate and compare against `content/characters/rig.json` with no mapping table in between;
a prettier key is a mapping somebody has to maintain and eventually gets wrong. `TN-LOOK-04` is the gate.

**Two slots both have an option called `none`, and they must never share a row.** `headCovering.none` is
"None" and `feature.none` is "No". One `creator.option.none` would be one row saying two things, which is
`TN-COPY-06`'s rule in its smallest possible form and is exactly how `study.count` drew "1 questions".

## The rows: one per slot

Five rows. Drawn as the group's heading, as the label half of every announcement about that group, and in
the preview's description.

| Key | EN | FR |
|---|---|---|
| `creator.slot.skin` | Skin tone | Teint de peau |
| `creator.slot.hairShape` | Hair | Cheveux |
| `creator.slot.hairColour` | Hair colour | Couleur des cheveux |
| `creator.slot.headCovering` | Head covering | Couvre-chef |
| `creator.slot.feature` | Glasses | Lunettes |

`creator.slot.hair` and `creator.slot.coat` are **deleted**. The first names a slot the rig split in two on
purpose (`assets/style/rig-contract.md`: "Twenty combined options in a single `hair` slot … would have made
'the coily one is only offered in black' a one-line change nobody would notice"). The second names `costume`,
which is `playerSelectable: false` and says *which character an artboard is*, not how a player customised
one — a group heading for a group that cannot exist is a screen describing a state it is not in, in copy.

**« Couvre-chef », not « Chapeau », and "Head covering", not "Hat".** The plainer word is refused on purpose:
`docs/content-review.md` §8.7 names hijab, dastaar, patka, kippah and tichel as this slot's future options,
and none of those is a hat. Naming the slot for the one option it holds today would make the next four
options wrong the day they land, and would make them wrong in the direction §8.7 exists to prevent.

## The rows: one per option, for four slots

Nineteen options exist. Thirteen are here; the other six are `TN-SKIN`'s.

**The naming rule for all of them.** A name says **what is visible** — how much hair there is, what shape it
holds, what colour it is, what is on the head, what is on the face. Never who wears it, never what it is
worth, never a group of people. No option name may contain a judgement word ("neat", "tidy", "messy",
"wild", "smart", "normal", "classic", "exotic", « soigné », « sage », « négligé », « classique »,
« exotique ») or a word naming a people, a place or a nationality. `TN-LOOK-04` holds the deny-list and
fails the build on a hit, in both languages independently.

### `hairShape` — four options

| Key | EN | FR |
|---|---|---|
| `creator.hairShape.crop` | Short | Courts |
| `creator.hairShape.coil` | Tight curls | Boucles serrées |
| `creator.hairShape.bob` | Chin length | Au menton |
| `creator.hairShape.long` | Long | Longs |

Three of these name a length and one names a shape, and that asymmetry is in the art rather than in the
words: `hair-coil-*.svg` is "a rounded coil worn close, full at the crown and full behind", which is a shape
and not a length, and no length word describes it. The alternative — calling all four by length and letting
the coil be "Short" alongside `crop` — would offer two options with one name, which is worse than a mixed
axis.

**"Tight curls" and not "Coily".** "Coily" is the accurate word and it is the word
`docs/content-review.md` §8.4 itself uses, and it is not a grade-6 word for somebody who arrived in Canada
last year. The same choice in French is sharper: « Crépus » is the standard, accurate term and is the word
Black francophone communities use for their own hair, and it has carried pejorative weight for some
speakers. **An agent picked the safer word over the community's own word, and that is a decision worth
distrusting rather than a decision worth defending** — `OQ-LOOK-2` puts both pairs in front of a reviewer
who may actually rule on it.

### `hairColour` — five options

| Key | EN | FR |
|---|---|---|
| `creator.hairColour.black` | Black | Noirs |
| `creator.hairColour.brown` | Brown | Bruns |
| `creator.hairColour.blond` | Blond | Blonds |
| `creator.hairColour.red` | Red | Roux |
| `creator.hairColour.grey` | Grey | Gris |

Colour words are allowed **here** and forbidden in `TN-SKIN`, and the difference is not squeamishness:
`docs/content-review.md` §8.1 bans colour and food words for skin tones because a tone name becomes a name
for a person. "Brown hair" is a fact about hair.

### `headCovering` — two options

| Key | EN | FR |
|---|---|---|
| `creator.headCovering.none` | None | Aucun |
| `creator.headCovering.toque` | Toque | Tuque |

### `feature` — two options

| Key | EN | FR |
|---|---|---|
| `creator.feature.none` | No | Non |
| `creator.feature.glasses` | Yes | Oui |

**This is a group of two radios, exactly like every other slot. It is never a switch.** A slot whose two
options read "No" and "Yes" is one careless afternoon away from becoming a toggle, and a toggle would drag
in `settings.state.on` / `settings.state.off` ("On" / « Activé »), break "each group already has one option
chosen" (`TN-CREATOR-01`), break the option-count arithmetic in `TN-LOOK-02`, and take this slot out of the
uniform randomiser. `TN-LOOK-01` asserts the shape, not just the words.

The yes/no wording is also the shape that stops working first. `docs/content-review.md` §8.8 lists a hearing
aid, a cochlear implant, a prosthetic limb, a birthmark and a cane as options that meet its bar, and none of
them is a "yes" to a question about glasses. `OQ-LOOK-1` records what changes on the day a second kind of
option lands: the slot label stops being "Glasses", the two rows are renamed, and this row's key survives
because it is derived from the option id.

## The row this file owns because it is about an option, not about a screen

| Key | EN | FR |
|---|---|---|
| `creator.optionGone` | One of your choices is not in this version. We picked a new one. You can change it here. | Un de vos choix ne se trouve pas dans cette version. Nous en avons choisi un autre. Vous pouvez le modifier ici. |

Drawn by the creator, owned here, because it is a sentence about **an option that no longer exists** and this
is the file that knows what the options are. `TN-LOOK-05` is its acceptance, and it carries a ruling the
implementer would otherwise have to guess — see there.

## French forms this file needs and English does not

The recurring find, and this table produced five of them.

1. **Hair adjectives agree with « cheveux », which is masculine plural.** Every `hairShape` and
   `hairColour` value is a **plural** adjective in French — « Courts », « Longs », « Noirs », « Bruns »,
   « Blonds » — where the English is one uninflected word. « Court » or « Brun » is wrong French, and no
   reading of the English column reveals it. This is agreement with a **noun in the label**, never with the
   player, so it is not what `docs/content-review.md` §8.6 forbids and it must not be "fixed" into
   « Court(e) ». `TN-LOOK-10` asserts the -s and asserts the absence of a bracketed ending in the same
   scenario, so the two rules cannot be traded against each other.
2. **Red hair is « Roux », never « Rouges ».** The one row where a word-for-word translation produces
   fluent-looking French that no francophone would write.
3. **« Gris » already carries its plural.** Adjectives ending in -s do not take another. A gate that checks
   "every FR hair value ends in -s" would pass this row for the wrong reason and would fail « Boucles
   serrées » and « Au menton » for no reason, so `TN-LOOK-10` asserts the eleven values by equality and does
   not try to be clever.
4. **"Toque" in English, « Tuque » in French, and neither is a typo.** Both spellings are current in Canada;
   Canadian English writes *toque* and Canadian French writes *tuque*, and the rig's option id is `toque`.
   A row whose two languages differ by one letter is the row a reviewer silently "corrects", so it is written
   out here and asserted in both languages, under the same rule `README.md` states for a row whose two
   languages are the *same* word.
5. **English is the language with the gendered form in this table, for once.** "Blonde" is the feminine form
   and would gender a player who has not been asked and, per `OQ-CREATOR-2`, is never asked. The EN value is
   **"Blond"**. French is safe here by construction, because « Blonds » agrees with « cheveux ».

And the Canadian spelling: **"Grey"**, not "gray".

---

## TN-LOOK-01 — Five groups, nineteen options, and nothing that is not in the rig

```gherkin
Feature: The creator offers exactly what the rig declares
  As a player
  I want every choice the game can draw
  So that appearances nobody can reach are not shipped in the payload

  Background:
    Given the element "character-creator" is visible

  Scenario: The groups are the rig's player-selectable slots, in the rig's order
    Then the groups "slot-skin", "slot-hair-shape", "slot-hair-colour", "slot-head-covering"
      and "slot-feature" are visible, in that order
    And no other group is shown
    And no group is shown for the "costume" slot
    And each group has an accessible name that is one of the slot rows in this file

  Scenario: Each group offers exactly the options the rig declares
    Then "slot-skin" offers 6 options
    And "slot-hair-shape" offers 4 options
    And "slot-hair-colour" offers 5 options
    And "slot-head-covering" offers 2 options
    And "slot-feature" offers 2 options
    And every option reports "data-option" equal to an option id in "content/characters/rig.json"
    And every option id in that file's player-selectable slots is offered by exactly one group

  Scenario: Every option is a word before it is a picture
    Then every option shows its name as text
    And no option is identified by a swatch, a colour or a picture alone
    And every option is at least 44 CSS px wide and tall

  Scenario: The glasses group is a group, not a switch
    Then "slot-feature" has role "radiogroup"
    And it offers two options with role "radio"
    And exactly one of them is chosen
    And neither shows "On" or "Off"
    And no control in "character-creator" has role "switch"

  Scenario: The four groups this file names are already answered when the screen opens
    Then each of "slot-hair-shape", "slot-hair-colour", "slot-head-covering" and "slot-feature"
      has exactly one option chosen
    And no option is chosen because it is the rig's "fallback"
    And "start-playing" is enabled before I have touched anything
```

## TN-LOOK-02 — No option is coupled to any other option

```gherkin
Feature: Slot independence
  As a player
  I want every hair with every tone
  So that the game has not invented a category for me

  Background:
    Given the element "character-creator" is visible

  Scenario: Choosing in one group changes no other group's offer
    When I choose each option of "slot-skin" in turn
    Then the option count of every other group is unchanged each time
    And the set of option ids offered by every other group is unchanged each time
    And no option becomes disabled, hidden or reordered

  Scenario: The same holds from every group, not only from the skin group
    When I choose each option of "slot-hair-shape" in turn
    Then the option count of every other group is unchanged each time
    When I choose each option of "slot-hair-colour" in turn
    Then the option count of every other group is unchanged each time
    When I choose each option of "slot-head-covering" in turn
    Then the option count of every other group is unchanged each time
    When I choose each option of "slot-feature" in turn
    Then the option count of every other group is unchanged each time

  Scenario: Choosing changes exactly one group's answer
    Given I have noted the chosen option of all five groups
    When I choose a different option in one group
    Then that group's chosen option is the one I chose
    And the other four groups' chosen options are unchanged

  Scenario: The arithmetic is the check
    Then the product of the five groups' option counts is 480
    And the number of appearances the creator can reach is 480
    And no combination of options is refused
```

## TN-LOOK-03 — Surprise me draws uniformly

```gherkin
Feature: The randomiser is not a statement about who the player is
  Scenario: One tap changes the whole character
    Given the element "character-creator" is visible
    When I tap "randomise-character"
    Then every group has exactly one option chosen
    And at least one group's chosen option is different from before
    And "start-playing" is still enabled

  Scenario: Every option can come up
    When 1000 seeded draws are made
    Then every option of every group appears at least once
    And no option exceeds twice its expected share
    And the rig's "fallback" option of each slot appears no more often than any other option of that slot

  Scenario: Opening the screen is a draw, not a default
    When the element "character-creator" opens 1000 times with seeded draws
    Then the chosen option of each group is distributed as the scenario above requires
    And no group opens on the same option every time

  Scenario: The result is announced as one thing, not as five
    When I tap "randomise-character"
    Then "#tn-live-region" reads the preview's description once
    And it names all five groups and their chosen options
    And it is not five separate announcements
```

## TN-LOOK-04 — A name that is missing, duplicated or invented fails the build (failure path)

```gherkin
Feature: Nobody invents an option name
  Scenario: A player-selectable slot with no row fails the check
    Given "content/characters/rig.json" marks a slot "playerSelectable"
    And no copy table in "docs/stories" carries "creator.slot.<that slot name>"
    When the content check runs
    Then the build fails, naming the slot and the missing key
    And it reports every such slot, not only the first

  Scenario: An option with no row fails the check
    Given a player-selectable slot declares an option id
    And no copy table carries "creator.<slot name>.<option id>"
    When the content check runs
    Then the build fails, naming the option and the missing key

  Scenario: A row for a slot the rig does not have fails the check
    Given a copy table carries "creator.slot.coat"
    And "content/characters/rig.json" declares no player-selectable slot named "coat"
    When the content check runs
    Then the build fails, naming the key as having no slot
    And the same check fails "creator.slot.hair" while the rig declares "hairShape" and "hairColour"

  Scenario: A row present in one language only fails the check
    Given "creator.hairShape.coil" exists in English and not in French
    When the content check runs
    Then the build fails, naming the missing French string

  Scenario: One row may not serve two slots
    Given a copy table carries "creator.option.none"
    And two player-selectable slots each declare an option "none"
    When the content check runs
    Then the build fails, naming both slots and pointing at this file
    And the fix is two rows, not one shared row

  Scenario: A judgement word or a people's name in an option is refused
    Given an option name contains a word on this file's deny-list
    When the content check runs
    Then the build fails, naming the key, the language and the word
    And it checks the English and the French value independently

  Scenario: The check can be made to go red
    Given the rig gains a sixth player-selectable slot with no copy rows
    When the content check runs
    Then it fails
    And the failure names the slot, so a passing run means the rows were read and not merely absent
```

## TN-LOOK-05 — An option in my save is not in this build (failure path)

```gherkin
Feature: A saved appearance that this build cannot draw
  As a player coming back after an update
  I want to keep playing
  So that a removed option is the game's problem and not mine

  Background:
    Given my saved character names an option id that no player-selectable slot declares

  Scenario: The game never blocks, and never quietly picks the middle of a ramp
    When I open the game and reach a level
    Then the level is playable
    And the slot whose option is gone was filled by a uniform draw over that slot's options
    And it was not filled with the rig's "fallback" for that slot
    And no error screen is shown

  Scenario: The repair is told to me the next time I can act on it
    When I open the character creator
    Then the element "creator-option-gone" is visible
    And it says "One of your choices is not in this version. We picked a new one. You can change it here."
    And it is announced once in "#tn-live-region"
    And it does not cover any control and does not have to be dismissed to reach "start-playing"

  Scenario: Telling me does not cost me the rest of the character
    Then the four groups whose options still exist show the options I chose
    And only the group whose option is gone was changed

  Scenario: The repair is saved, so I am told once and not every time
    When I leave the creator and open it again
    Then "creator-option-gone" is not shown
    And the group holds the option the repair drew, or the one I chose instead

  Scenario: The message is French in French
    Given the language is French
    Then it reads "Un de vos choix ne se trouve pas dans cette version. Nous en avons choisi un autre. Vous pouvez le modifier ici."
```

## TN-LOOK-06 — Every group and every option from the keyboard

```gherkin
Feature: Keyboard-only choosing
  Background:
    Given I am using a keyboard only
    And the element "character-creator" is visible

  Scenario: Tab moves between groups, arrows move inside one
    When I press "Tab" until focus is inside "slot-hair-colour"
    Then focus is on that group's chosen option
    When I press "ArrowRight"
    Then the next option is chosen and has focus
    When I press "ArrowRight" until the last option is passed
    Then the highlight wraps to the first option of the same group
    And focus never leaves "slot-hair-colour" while I press arrow keys

  Scenario: Every option in every group can be chosen without a pointer
    When I use only "Tab" and the arrow keys
    Then I can choose any option of any of the five groups
    And I never have to use a pointer to reach one

  Scenario: Focus is visible on every option
    When I press "Tab" and the arrow keys through every group
    Then each focused option has a focus indicator that is not colour alone
    And the indicator is visible on the darkest and the lightest swatch alike
```

## TN-LOOK-07 — Every group and every option with one switch

```gherkin
Feature: Single-switch choosing
  Background:
    Given single-switch mode is on
    And the element "character-creator" is visible

  Scenario: The ring reaches every option and wraps once
    When I press the switch briefly until the highlight returns to where it started
    Then the highlight has visited every option of all five groups
    And it has visited "randomise-character", "start-playing" and "creator-settings"
    And nothing was chosen by the highlight passing over it

  Scenario: The primary control is reachable without choosing anything
    When I press the switch briefly until the highlight is on "start-playing"
    And I hold the switch past the hold-to-choose threshold
    Then the character I never touched is the character that is saved
    And nothing on the screen counted down while I did it

  Scenario: Long press chooses the highlighted option and says so
    Given the highlight is on the second option of "slot-head-covering"
    When I hold the switch past the hold-to-choose threshold
    Then that option is chosen
    And "#tn-live-region" reads "Head covering: Toque"

  Scenario: Nineteen options do not become a timer
    When I do nothing for one minute
    Then the highlight has not moved
    And nothing has been chosen
    And nothing on screen counts down
```

## TN-LOOK-08 — Every choice is a sentence, not a picture (screen reader)

```gherkin
Feature: The creator without sight of the preview
  Background:
    Given the element "character-creator" is visible

  Scenario: Groups and options are named
    Then each of the five groups has role "radiogroup" and an accessible name
    And each group's accessible name is that slot's row from this file
    And every option has role "radio" and an accessible name that is a word or a phrase
    And no option's accessible name is empty, a hex colour, a number alone, or "Option"

  Scenario: Choosing is announced as label and value
    When I choose the option named "Tight curls" in "slot-hair-shape"
    Then "#tn-live-region" reads "Hair: Tight curls"
    When I choose the option named "None" in "slot-head-covering"
    Then "#tn-live-region" reads "Head covering: None"
    And each announcement is that slot's row and that option's row, joined, and never an id
    And exactly one element on the page has an "aria-live" attribute

  Scenario: The preview is described in words
    Then "character-preview" has an accessible name
    And it has a text description naming all five groups and their chosen options,
      in the same label-and-value form the announcements use
    And that description changes when any group's chosen option changes
    And it is the same five names this file and TN-SKIN write, never a colour or an id

  Scenario: The description is the only thing a player without the picture needs
    Given the character art fails to load
    Then every option still shows its name as text
    And "character-preview" still carries its description
    And nothing on the screen is an empty box with no explanation

  Scenario: The canvas is not read
    Then any canvas on the page is "aria-hidden"
    And no option's name is drawn only inside a canvas
```

## TN-LOOK-09 — Reduced motion, high contrast and 200 % text

```gherkin
Feature: The names survive every setting that removes the picture
  Scenario: Reduced motion
    Given reduced motion is on
    When the element "character-creator" is visible
    Then "character-preview" reports "data-animated" equal to "false"
    And choosing an option swaps the preview with no transition
    And no swatch pulses, grows or sparkles when it is chosen
    And the chosen option is marked with a shape or a tick, not colour alone

  Scenario: High contrast
    Given "setting-high-contrast" is on
    Then every option still shows its name as text
    And the chosen option is still distinguishable without relying on the swatch
    And no group becomes a row of identical controls

  Scenario: 200 % text on a small phone
    Given text scaling is 200 %
    And the viewport is 390 x 844
    Then the full name of every option in all five groups is visible, not cut off
    And no name is truncated with an ellipsis
    And the page does not scroll sideways
    And every option is still at least 44 CSS px wide and tall
    And "start-playing" is reachable, by scrolling down if needed

  Scenario: The longest names are the ones measured
    Given text scaling is 200 %
    And the language is French
    Then the whole of "Boucles serrées" and "Couleur des cheveux" is visible
    And no option name overlaps its group's heading
```

## TN-LOOK-10 — Every name in French

```gherkin
Feature: The four tables in French
  Background:
    Given the language is French
    And the element "character-creator" is visible

  Scenario: The groups read in French
    Then the groups read "Teint de peau", "Cheveux", "Couleur des cheveux", "Couvre-chef" and "Lunettes"
    And no English word appears in "character-creator"
    And the screen carries "lang" equal to "fr"

  Scenario: Hair shapes agree with "cheveux"
    Then "slot-hair-shape" offers "Courts", "Boucles serrées", "Au menton" and "Longs"
    And it does not offer "Court" or "Long"

  Scenario: Hair colours agree with "cheveux", and red hair is not red
    Then "slot-hair-colour" offers "Noirs", "Bruns", "Blonds", "Roux" and "Gris"
    And it does not offer "Rouges"
    And it does not offer "Noir", "Brun" or "Blond"

  Scenario: The toque is spelled the French way, and the English way in English
    Then "slot-head-covering" offers "Aucun" and "Tuque"
    Given the language is English
    Then "slot-head-covering" offers "None" and "Toque"
    And both values exist in both bundles, and neither language falls back to the other

  Scenario: The glasses group answers a question
    Then "slot-feature" offers "Non" and "Oui"
    And neither reads "Activé" or "Désactivé"

  Scenario: Announcements are French, with the French colon
    When I choose "Boucles serrées"
    Then "#tn-live-region" reads "Cheveux : Boucles serrées"
    And there is a space before the colon

  Scenario: No string in these tables asks the player's gender
    Then no value in any table in this file contains "(e)", "·e", "-e)" or a bracketed ending
    And no value agrees with the player rather than with a noun in the label
    And the English value for a fair-haired character is "Blond" and never "Blonde"

  Scenario: A missing French value is a build failure, not a silent English word
    Given the French bundle has no value for "creator.headCovering.toque"
    When the content check runs
    Then the build fails, naming the missing French string
```

---

## Open questions

- **`OQ-LOOK-1` — the `feature` slot is named for its only option.** "Glasses" / « Lunettes » with "No" and
  "Yes" is plain and it is the shape that stops working first: `docs/content-review.md` §8.8 names a hearing
  aid, a cochlear implant, a prosthetic limb, a birthmark and a cane as options that meet its bar, and none
  of those is a yes to a question about glasses. *Recommendation:* ship the yes/no wording, because inventing
  a generic label now produces either jargon ("Feature") or something worse ("Extras", which is not a word
  anybody should read next to a prosthetic limb). On the day a second kind of option lands, the slot label is
  rewritten, `creator.feature.none` becomes "None" / « Aucune », and `creator.feature.glasses` becomes
  "Glasses" / « Lunettes ». The keys survive that change because they are derived from the option ids, which
  is the whole argument for deriving them.
- **`OQ-LOOK-2` — "Tight curls" or "Coily"; « Boucles serrées » or « Crépus »?** This file chose the plainer
  pair on a CLB 4 argument and recorded that the accurate pair may simply be better. *Recommendation:* put
  both pairs to a francophone reviewer **and** to somebody whose hair the option draws, on the first review
  pass, and treat a preference for « Crépus » as a correction rather than as a suggestion. An agent choosing
  the word it is least likely to be criticised for is not the same as the right word being chosen, and this
  file should not pretend otherwise.
- **`OQ-LOOK-3` — is "Hair" the right label for the shape slot?** The two hair slots read "Hair" and "Hair
  colour", so the first is carrying the shape by implication. « Coiffure » was the alternative and was
  refused because "hair style" invites a fashion register into a screen that must not have one.
  *Recommendation:* keep it. Revisit only if a player test shows somebody looking for colour in the first
  group.
- **`OQ-LOOK-4` — the head-covering slot has two options and §8.7 asks for six.** A hijab, a dastaar, a
  patka, a kippah or a tichel is not a naming problem: each needs a cited reference in
  `assets/refs/references.json`, drawn to a documented tying style, and §8.7 forbids approximating one.
  *Recommendation:* no copy row is written until the art exists, and this file states the rule so the gap is
  legible: **if religious dress appears only on background NPCs and never as a player option, the game has
  used it to mark strangers** (§8.7). Today it appears nowhere, which is the only other honest state.
  Routed to art and to the plan owner; `assets/` is not this directory's to edit.
- **`OQ-LOOK-5` — do `character/created` and `character/changed` match what the use cases emit?** This file
  and `TN-FIRSTRUN` need to tell "the player exists now" from "the player looks different now", because the
  first is what unlocks the route and the second must not re-run it. Covered by `OQ-EVENT-1`: if the use
  cases pick other names, these stories are updated, not the tests quietly.
- **`OQ-LOOK-6` — where do these rows live once `content/locales/*` exists?** They are UI vocabulary reused
  by every character document (ADR-0010), and `character.schema.json` already models them as `labelKey` on
  the slot and on the option rather than as inline text. *Recommendation:* flat dotted keys in the locale
  bundle, exactly as written here, and `TN-LOOK-04`'s gate reads the bundle and the rig and compares them.
  Until the bundles land the rows live in `app/ui/copy.ts`, which is not this directory's to edit and is
  reported to the UI agent instead.
