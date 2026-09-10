# TN-SKIN — Naming the six skin tones

**Intent.** A player of any background finds a tone that is theirs, hears it named in a way that ranks
nobody, and reads the same thing in English and in French.

This file is the ruling on **`OQ-REVIEW-6`** (which answers `OQ-CREATOR-5`), and it is one slot's file
rather than six rows in `TN-LOOK` for one reason: this is the slot most likely to be re-decided, and the
other four must not be held while it is. If this ruling is refused, `TN-SKIN` is what changes and the
creator still ships with `TN-LOOK`'s thirteen names, one group short.

Read `README.md` in this directory first, then `docs/content-review.md` §8.1 — this file's whole subject —
and `TN-LOOK-what-the-player-can-choose.md`, which owns the slot label these option names are announced
under and the key shape they follow.

## Does this need a Tier 3 reviewer?

**No, and that is `docs/content-review.md` §1's own answer, not this file's.** §1's "may ship without a
Tier 3 reviewer" list opens with "the character creator's skin tones, hair, garments and features, under §8
— a range of human appearance is not a claim about anyone's identity, provided the rules there hold." The
rules there are: no colour word, no food word, no ethnicity or nationality in a tone name (§8.1); no
coupling to any other slot (§8.2); a uniform randomiser (§8.3); no pre-selection (§8.1, `OQ-REVIEW-7`); EN
and FR both present (§9.3). Every one of them is a scenario below.

Two things follow, and both are stated rather than left to be inferred:

- **Nothing in this file is a sign-off.** An agent wrote these words. `docs/content-review.md` §1 forbids an
  agent granting cultural sign-off "ever, for any reason", and no scenario below asserts that a name is
  right — only that it is present, that it is not on a deny-list, that it matches a measurement, and that it
  reads the same in both languages. A tier-2 pass means "nothing mechanically wrong was found".
- **§7's asymmetry is live from the first release.** A player who tells this project that these names are
  wrong **fails them**, and the depiction is disabled first and discussed after. No comment on an issue
  passes them. That is uncomfortable and it is the correct default while Tier 3 is empty
  (`OQ-REVIEW-2`, unanswered, `OBLIGATION due=2026-12-08`).

The one thing in this slot's neighbourhood that **would** need Tier 3 is not a name: §8.8 offers vitiligo as
a skin-slot variant, and a skin-slot option that depicts a condition is a depiction decision before it is a
copy row. The rig has six ramps and no such option, so nothing is written for one.

## The ruling

> **Every skin option is named by its ordinal and by a lightness band shared with one other option:
> "1, light" … "6, dark" / « 1, clair » … « 6, foncé ». No tone carries a word no other tone carries.**

This **adopts** `docs/content-review.md` §8.1's recommended direction — an ordinal with a lightness cue —
and amends its exact wording in two places. The reasoning, in the order it decides things:

1. **Something has to be said.** `CLAUDE.md` requires that colour is never the only signal, and
   `content/schemas/character.schema.json` requires a name on every option ("Every option has a name shown
   as text"). An unnamed swatch leaves a screen-reader user with six identical controls and a
   high-contrast user with six of nothing. **Not naming them is not one of the choices**, however
   attractive it looks from a distance.
2. **The name may not be a colour word, a food word or a people.** §8.1 settles that and nothing here
   reopens it. "Tan", "olive", "caramel", "honey", "peach", "nude", "flesh" and every nationality stay out,
   in both languages.
3. **The ordinal is the identity, because the ids are the identity.** `skin-1`…`skin-6` is what
   `palette.json`, the atlas, the rig, the save file and `verify-art` all carry. A name whose number
   disagrees with its id is a bug report nobody can reproduce, and a name with no number leaves a player who
   cannot see the swatch nothing stable to come back to next week.
4. **The cue goes on all six or on none.** This is the first amendment. §8.1 writes a cue on the two ends —
   "Skin tone 1 (lightest)" and "Skin tone 6 (deepest)" — and says nothing about 2 to 5. Four bare numbers
   between two described ends is a set where **the palest and the deepest are the marked cases and the four
   in between are unremarkable**, which is the hierarchy the whole rule exists to prevent, arriving through
   an unfinished table rather than through a bad word. Three band words, each used exactly twice, give every
   option the same weight of description and leave no tone unmarked.
5. **Six ramps have no middle, and that is worth keeping.** Two-two-two means there is no "the medium one" —
   there are two — so no option is the one the others are measured against. A five-step scale would have had
   a centre, and a centre is a default with better manners.
6. **"Dark", not "deep".** This is the second amendment, and it is the one that matters most. "Lightest" and
   "deepest" are not a pair. The pair is light/dark; "deep" is a substitution made to avoid saying "dark",
   and **a euphemism at one end with the plain word at the other says that one end needs softening**, which
   is the same statement the rule was written to refuse. French settles it: « clair » and « foncé » are both
   plain, French offers no euphemism to match "deepest", and a naming scheme whose two languages are doing
   different things fails the bilingual bar outright.
7. **The band word is a measurement, and it is checkable.** Sort the six `skin-N-base` entries in
   `assets/style/palette.json` by lightness: the order must be 1 to 6, and the bands must fall two, two,
   two. `TN-SKIN-02` is that test. A name that quietly stops being true when art re-derives a ramp then
   fails a build instead of surviving in a locale bundle, which is this project's standard everywhere else.
8. **The noun lives on the slot, not on every option.** "Skin tone" is `creator.slot.skin` (`TN-LOOK`), and
   the live region draws label-and-value (`TN-COPY-05`). Repeating the noun in the option would announce
   "Skin tone: Skin tone 3, medium", which is how a well-meant label becomes a stutter a screen-reader user
   hears nineteen times a screen.

**What this ruling does not claim.** It does not claim these are good names. It claims they are checkable,
symmetric, translatable, free of the words §8.1 bans, and better than the recommendation they amend in two
specific ways. `OQ-SKIN-1` records the alternative that was rejected and what would make it right.

## The rows: one per option

Six rows, `creator.skin.<optionId>`, keyed from the rig's option ids exactly as `TN-LOOK` requires.

| Key | EN | FR | Announced as |
|---|---|---|---|
| `creator.skin.skin-1` | 1, light | 1, clair | Skin tone: 1, light / Teint de peau : 1, clair |
| `creator.skin.skin-2` | 2, light | 2, clair | Skin tone: 2, light / Teint de peau : 2, clair |
| `creator.skin.skin-3` | 3, medium | 3, moyen | Skin tone: 3, medium / Teint de peau : 3, moyen |
| `creator.skin.skin-4` | 4, medium | 4, moyen | Skin tone: 4, medium / Teint de peau : 4, moyen |
| `creator.skin.skin-5` | 5, dark | 5, foncé | Skin tone: 5, dark / Teint de peau : 5, foncé |
| `creator.skin.skin-6` | 6, dark | 6, foncé | Skin tone: 6, dark / Teint de peau : 6, foncé |

The slot label is `creator.slot.skin` — "Skin tone" / « Teint de peau » — and it lives in `TN-LOOK`, not
here, because it belongs to the slot rather than to this ruling and it survives this ruling being reversed.

**The French takes no form the English does not, and that is the finding.** « clair », « moyen » and
« foncé » agree with « teint », which is masculine singular, so all three are already in the form they need
and none of them ever agrees with the player. There is no « clair(e) » to write and none may be introduced —
`docs/content-review.md` §8.6, and `TN-SKIN-08` asserts it. This is the one table in the creator where the
two languages have identical grammar, which is worth recording because every other table in `TN-LOOK` does
not.

## The measured bands

Recorded so the test in `TN-SKIN-02` has a value to assert against, and so a reader can see that the words
are a fact rather than a taste. From `assets/style/palette.json`:

| Option | `-base` | Band |
|---|---|---|
| `skin-1` | `#efbe99` | light |
| `skin-2` | `#dfa477` | light |
| `skin-3` | `#c68550` | medium |
| `skin-4` | `#9e6334` | medium |
| `skin-5` | `#7a4923` | dark |
| `skin-6` | `#553018` | dark |

`assets/style/art-bible.md` §8 already states the ordering — "the numbering is lightest to deepest and
carries no meaning beyond ordering". That is true of a ramp id in a palette file no player reads. **It stops
being true the moment the number is spoken to a player**, which is why this file names both ends and not
just the one it started at.

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-SKIN-06` |
| Single switch | `TN-SKIN-06` |
| Screen reader | `TN-SKIN-05` |
| Reduced motion | `TN-SKIN-07` |
| High contrast | `TN-SKIN-05` — the name is the whole signal when the swatch is gone |
| 200 % text | `TN-SKIN-07` |
| Bilingual | `TN-SKIN-08`, and the table above is written in both languages |
| Failure path | `TN-SKIN-04` (a name missing, banned, unmeasured or invented) |

---

## TN-SKIN-01 — Six tones, six names, and none of them chosen for me

```gherkin
Feature: The skin group
  As a player who has just arrived in Canada
  I want to find a tone that is mine
  So that the one screen that asks me to see myself does not offer somebody else

  Background:
    Given the element "character-creator" is visible

  Scenario: All six are offered
    Then "slot-skin" offers 6 options
    And their "data-option" values are "skin-1", "skin-2", "skin-3", "skin-4", "skin-5" and "skin-6",
      in that order
    And each shows its name as text
    And each is at least 44 CSS px wide and tall

  Scenario: The names are the six rows in this file
    Then the options read "1, light", "2, light", "3, medium", "4, medium", "5, dark" and "6, dark"
    And no option's name contains a colour word other than "light" or "dark"
    And no option's name contains a food word
    And no option's name contains a nationality, an ethnicity or a people

  Scenario: No tone is the default
    When the element "character-creator" opens 1000 times with seeded draws
    Then the chosen tone is "skin-3" in about one run in six
    And no tone is chosen in more than twice its expected share
    And every tone is chosen at least once
    And the chosen tone is never described on screen as a default, a standard or a starting point

  Scenario: The rig's fallback is not a pre-selection
    Then nothing on the screen marks "skin-3" differently from the other five
    And the word "default" appears nowhere in "character-creator"

  Scenario: Choosing a tone changes the preview and the description
    When I choose the option whose "data-option" is "skin-5"
    Then that option is marked as chosen
    And "character-preview" reports "data-skin" equal to "skin-5"
    And the preview's description reads "Skin tone: 5, dark"
```

## TN-SKIN-02 — The names are a measurement, not a taste

```gherkin
Feature: A band word that stops being true fails a build
  Scenario: The ramps are in the order the numbers claim
    When the six "skin-N-base" entries in "assets/style/palette.json" are sorted by lightness
    Then their order is "skin-1", "skin-2", "skin-3", "skin-4", "skin-5", "skin-6"
    And the check fails if any adjacent pair is out of order

  Scenario: The bands fall two, two, two
    Then the two lightest ramps carry the band word "light"
    And the next two carry "medium"
    And the two deepest carry "dark"
    And the same holds for the French band words "clair", "moyen" and "foncé"

  Scenario: Every band word is used exactly twice
    Then no band word is used once
    And no band word is used three times
    And no option carries a band word no other option carries

  Scenario: Re-deriving a ramp fails the check rather than surviving it
    Given "skin-2" is re-derived to a lightness deeper than "skin-4"
    When the content check runs
    Then it fails, naming the ramp, its measured lightness and the band word that is now wrong

  Scenario: The check can be made to go red
    Given a fixture in which "skin-6" is named "6, light"
    When the content check runs
    Then it fails
    And a passing run therefore means the palette was read, not that the rule was skipped
```

## TN-SKIN-03 — The tone is coupled to nothing

```gherkin
Feature: No option anywhere is restricted by skin tone
  Background:
    Given the element "character-creator" is visible

  Scenario: Every hair, every covering, every feature, with every tone
    When I choose each of the six tones in turn
    Then the option count of "slot-hair-shape" is 4 each time
    And the option count of "slot-hair-colour" is 5 each time
    And the option count of "slot-head-covering" is 2 each time
    And the option count of "slot-feature" is 2 each time
    And no option in any of those groups becomes disabled, hidden or reordered

  Scenario: The reverse holds too
    When I choose each option of every other group in turn
    Then "slot-skin" offers 6 options each time
    And the same six ids, in the same order

  Scenario: The neck is the tone the head is
    When I choose the option whose "data-option" is "skin-6"
    Then every part of the character drawn from the skin slot uses "skin-6"
    And no part of the character is drawn from a different skin ramp
```

## TN-SKIN-04 — A missing, banned or unmeasured name fails the build (failure path)

```gherkin
Feature: Nobody invents a skin tone name
  Scenario: A ramp with no name fails the check
    Given the skin slot declares "skin-4"
    And no copy table carries "creator.skin.skin-4"
    When the content check runs
    Then the build fails, naming the key
    And it reports all six, not only the first missing one

  Scenario: A name in one language only fails the check
    Given "creator.skin.skin-6" exists in English and not in French
    When the content check runs
    Then the build fails, naming the missing French string

  Scenario: A banned word fails the check, in either language
    Given a skin tone name contains "tan", "olive", "caramel", "chocolate", "honey", "peach",
      "nude", "flesh", "café", "miel" or "chocolat"
    When the content check runs
    Then the build fails, naming the key, the language and the word
    And it checks the English and the French value independently

  Scenario: A people, a place or a nationality in a tone name fails the check
    Given a skin tone name contains a nationality, an ethnicity or a nation's name
    When the content check runs
    Then the build fails, naming the key and pointing at docs/content-review.md 8.1

  Scenario: A row for a ramp that is not in the palette fails the check
    Given a copy table carries "creator.skin.skin-7"
    And "assets/style/palette.json" declares no ramp "skin-7"
    When the content check runs
    Then the build fails, naming the key as having no ramp

  Scenario: A swatch with no name is refused before it reaches a player
    Given an option in "slot-skin" renders with no text
    When the unit suite runs
    Then it fails, naming the option
    And the message says that colour is never the only signal
```

## TN-SKIN-05 — Without the picture (screen reader, high contrast)

```gherkin
Feature: Six tones a player cannot see
  Background:
    Given the element "character-creator" is visible

  Scenario: The group and every option are named
    Then "slot-skin" has role "radiogroup" with the accessible name "Skin tone"
    And each of the six options has role "radio" with a non-empty accessible name
    And no option's accessible name is a hex colour, an id, or empty
    And the group announces the position and the count of each option, so no name has to carry "of 6"

  Scenario: Choosing is announced as label and value
    When I choose the option named "4, medium"
    Then "#tn-live-region" reads "Skin tone: 4, medium"
    And it does not read "Skin tone: Skin tone 4"
    And exactly one element on the page has an "aria-live" attribute

  Scenario: High contrast does not take the tone away as information
    Given "setting-high-contrast" is on
    Then each of the six options still shows its name as text
    And the chosen option is marked with a shape or a tick, not by its swatch
    And the six options are still distinguishable from one another

  Scenario: The description says which tone, in words
    Then "character-preview" has a text description whose first pair is "Skin tone" and this tone's name
    And it changes when I choose another tone
    And it never names a hex colour or a ramp id
```

## TN-SKIN-06 — From the keyboard, and with one switch

```gherkin
Feature: Six tones with no pointer
  Scenario: Arrow keys move through the six
    Given I am using a keyboard only
    And focus is inside "slot-skin"
    When I press "ArrowRight" five times
    Then each of the other five tones was chosen in turn
    When I press "ArrowRight" once more
    Then the highlight wraps to the first tone
    And focus never left "slot-skin"

  Scenario: Focus is visible on the darkest and the lightest swatch alike
    When I move focus onto the option whose "data-option" is "skin-1"
    Then it has a focus indicator that is not colour alone
    When I move focus onto the option whose "data-option" is "skin-6"
    Then it has a focus indicator that is not colour alone
    And neither indicator relies on contrast against the swatch it sits on

  Scenario: Every tone is reachable with the switch
    Given single-switch mode is on
    When I press the switch briefly
    Then the highlight moves to the next item and is announced
    When I use only short and long presses
    Then I can choose any of the six tones
    And nothing on the screen counts down while I decide
```

## TN-SKIN-07 — Reduced motion and 200 % text

```gherkin
Feature: The six tones under the settings
  Scenario: Nothing about a tone animates
    Given reduced motion is on
    When I choose a tone
    Then the preview swaps with no transition
    And no swatch grows, pulses, sparkles or ripples
    And the chosen mark appears with no animation

  Scenario: Six names fit at 200 % on a small phone
    Given text scaling is 200 %
    And the viewport is 390 x 844
    Then the whole of all six names is visible, not cut off
    And no name is truncated with an ellipsis
    And the page does not scroll sideways
    And every option is still at least 44 CSS px wide and tall

  Scenario: The dyslexia-friendly font does not break the group
    Given "setting-dyslexia-font" is on
    And text scaling is 200 %
    Then no tone name overlaps another element
```

## TN-SKIN-08 — The six tones in French

```gherkin
Feature: The skin group in French
  Background:
    Given the language is French

  Scenario: The group and the six names are French
    When the element "character-creator" is visible
    Then "slot-skin" reads "Teint de peau"
    And the options read "1, clair", "2, clair", "3, moyen", "4, moyen", "5, foncé" and "6, foncé"
    And no English word appears in "slot-skin"

  Scenario: The announcement uses the French colon
    When I choose "5, foncé"
    Then "#tn-live-region" reads "Teint de peau : 5, foncé"
    And there is a space before the colon

  Scenario: No tone name agrees with the player
    Then no value in this file's table contains "(e)", "·e", "-e)" or a bracketed ending
    And every band word agrees with "teint" and with nothing else
    And "clair", "moyen" and "foncé" are drawn in their masculine singular form in every reading

  Scenario: The two languages describe the same thing
    Then the English band word and the French band word of each tone name the same end of the same scale
    And neither language uses a word the other softens
    And the English does not read "deepest" while the French reads "foncé"

  Scenario: A missing French name is a build failure
    Given the French bundle has no value for "creator.skin.skin-3"
    When the content check runs
    Then the build fails, naming the missing French string
```

---

## Open questions

- **`OQ-SKIN-1` — the unnamed swatch, and why it stays rejected.** The most attractive alternative is no
  label at all: six swatches, an accessible name of "1" to "6", and nothing that could be argued with.
  *Recommendation:* keep it rejected. It fails `CLAUDE.md`'s "colour is never the only signal" and it fails
  a high-contrast player completely, and the version that passes those — a bare ordinal with no cue —
  removes the one handle a player who cannot see the swatch has for finding a tone like their own. **A blind
  player choosing a character has the same reason to want a tone that is theirs as anybody else**, and "4"
  does not get them there while "4, medium" does. What would make the bare ordinal right is a swatch
  description elsewhere on the screen, which is the same words in a worse place.
- **`OQ-SKIN-2` — is "medium" a default wearing a different hat?** Two options carry it, which is the
  defence, and six ramps have no true centre, which is the reason the defence works. *Recommendation:* keep
  it, and re-open it the day a seventh ramp lands, because seven has a middle and the middle would be the
  only tone with a unique band word. Recorded now so that adding a ramp is known to be a copy change too.
- **`OQ-SKIN-3` — the ordinal runs light to dark, and light is 1.** The numbering is the palette's, the
  atlas's and the save's, and renaming it in the UI alone would make `skin-1` read as "4" in one place and
  "1" in five others. Reversing it in the data is an art and pipeline change with no player benefit — the
  ordering would still be an ordering, just pointing the other way. *Recommendation:* leave the numbers
  alone and carry the load on the band words, which is what makes both ends described rather than one end
  privileged. If a reviewer says the direction itself is the problem, the answer is to drop the ordinal from
  the *name* and keep it in the id, and this file is where that change lands.
- **`OQ-SKIN-4` — `docs/content-review.md` still recommends the wording this file amends.** §8.1 and
  `OQ-REVIEW-6` in §12 both say "Skin tone 1 (lightest)"…"Skin tone 6 (deepest)". That document is the PO's
  and is **not** in `docs/stories/`, so this file cannot edit it. *Recommendation:* its owner records
  `OQ-REVIEW-6` as answered here, with the two amendments named — a cue on all six, and "dark" rather than
  "deep" — and `assets/style/art-bible.md` §8's "the eleven ramps ship unnamed until that question is
  settled" is released for the six this file names. Until both are updated, two documents recommend two
  wordings and a reader has no way to tell which one shipped.
- **`OQ-SKIN-5` — vitiligo, and any other skin-slot variant.** `docs/content-review.md` §8.8 lists it as an
  option that meets its bar. It is a seventh entry in a slot of six ramps and it is a depiction before it is
  a name. *Recommendation:* it is art and review work, not copy work; no row is written until an option
  exists, and if one is drawn its name is the condition's own name in both languages, never a band word and
  never a number in this sequence.
