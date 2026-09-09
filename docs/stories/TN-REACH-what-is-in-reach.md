# TN-REACH — What is in reach, and what pressing it will do

**Intent.** When something in a level can be engaged, the game says **what pressing it will do** — not what
it is called — in both languages, for a player who can see the mark and for one who cannot.

This story exists because the prompt has been drawing the wrong kind of string since the learning loop was
wired. `TN-HUD` and `TN-LEVEL-05` both require `interact-prompt` to carry a sentence like "Talk to the
officer"; `app/ui/copy.ts` has no `hud.interact.*` row at all, so `app/bootstrap/main.ts` falls back to **the
landmark's own localised name from the level document** and says so in its own comment: *"a name says what is
there and not what pressing does. Reported rather than invented."* It has been reported for two rounds. It is
now the most visible gap in play, because the learning loop is the thing a level is for.

It also owns the words for the **marks in the world** — the shapes `app/adapters/phaser/interaction-affordance.ts`
draws over anything engageable, in three states — because a shape that a player has to learn by experiment is
a shape that never says anything to somebody who cannot see it.

**Amended 2026-09-09 — a per-target row can belong to a character rather than to a level, and one of the
generic rows is wrong about what is in reach.** Three built levels place the same companion, so its row is
written once in `TN-GUIDE-the-guide.md` rather than three times here or in three level files. And the
companion is a beaver: `hud.interact.npc` reads "Talk to this person" / « Parler à cette personne », which is
what the HUD draws today whenever the guide is in reach on **the level the game opens on**. The generic row
is unchanged and still right for a person; the guide's own row is what fixes the level.

Read `README.md` in this directory first. `TN-HUD-hud-and-menu.md` owns the strip the prompt is drawn in;
`TN-LEVEL-ottawa.md` owns Ottawa's two per-target rows and the officer; `TN-GUIDE-the-guide.md` owns the
guide's name and its prompt; `TN-NAMES-naming-real-places.md` owns which names may appear where;
`TN-COPY-strings-and-counts.md` owns the rules every row here obeys.

## The defect this file exists to make impossible

A player riding through Toronto comes within reach of the level's one point of interest, and the HUD's
button reads **"CN Tower"** — in French, « Tour CN ». Two things are wrong with that, and only one of them is
the one this file was opened for:

1. **It says what is there, not what pressing does.** A button labelled with a noun is a button whose
   behaviour the player has to guess, and a screen-reader user is read a name with no verb at all.
2. **It is a trade name on a screen that may not carry one.** `TN-NAMES-01` puts a name from its list in a
   point-of-interest card's **body** — and, since `TN-DIALOGUE-what-a-quest-giver-says.md`, in a quest's own
   words about going there — and nowhere else, and `TN-NAMES-04` fails the build for "a copy string drawn by
   the passport, the level select, the HUD or a menu" containing such a name. **The prompt is a copy string
   drawn in the HUD, and it has no exception.** The name is not a copy string today — it is content
   interpolated at runtime — which is precisely how it got past a check written against copy tables.

Writing the rows below fixes both at once: the prompt stops being a name, so the HUD's prompt stops being a
place a name can leak into.

## The key shape, and which row wins

**Two kinds of row.** A generic row per kind, written once here, and an optional per-target row written
where the target belongs.

| Key | What it is |
|---|---|
| `hud.interact.poi` | A place is in reach and nothing more specific is written |
| `hud.interact.npc` | A person is in reach and nothing more specific is written |
| `hud.interact.done` | This one has already been done |
| `hud.interact.hint` | The one-time explanation of the marks themselves |
| `hud.interact.<target id>` | A row for one target, written in the story that owns that target |

The target id is **the id the level document gives it** — `officer`, `parliament-hill`, `cn-tower`, `guide` —
because that is what `poi/entered` carries and what the prompt is looked up by. Ottawa's two rows keep their
wording and are respelled to that shape (`OQ-REACH-1`).

**Where a per-target row lives follows what the target is**, which is `README.md`'s rule about the home of a
string: a landmark belongs to one level, so its row is in that level's story; **a character that stands in
three levels belongs to no one of them**, so `hud.interact.guide` is in `TN-GUIDE-the-guide.md` beside that
character's name. Written per level it would be the same words three times, and three copies of one sentence
is how they stop being one sentence.

**Which row is drawn, in order:**

1. **The target has been done** → `hud.interact.done`, whatever kind it is and whatever row was written.
   The state is the news; the invitation is not, and a player who is told "Talk to the officer" about
   somebody they have already finished with will walk back for nothing.
2. **A row exists for this target** → that row.
3. **Otherwise, by kind** → `hud.interact.npc` for a person, `hud.interact.poi` for a place.

**And never anything else.** Not the target's name from the level document, not "Interact", not "Engage",
not an icon alone, not an empty string. A target this build has no row for offers **no prompt** rather than a
guessed one — the same rule `TN-WAIT` applies to a level with no waiting sentence, and the same gate.

## Why the generic rows say "this place" and "this person"

A generic row cannot name the target, so it has to be useful without naming it, and the two candidates are a
verb with a demonstrative ("Look at this place") or a bare verb ("Look"). The demonstrative wins: it is what
a screen reader has to read on its own, out of any visual context, and "Look" alone is read as an
instruction with no object.

**The player is not losing the name.** They can see the landmark; and the name — with a sentence saying what
the building is, and a source — is on the card the prompt opens, which is where `TN-NAMES` decided a name
teaches something. That is the same information a sighted and a screen-reader player get, in the same place,
which is stronger than the name being in a button for one of them and nowhere for the other.

**Where a target can do better, it does.** Ottawa writes "Talk to the officer" and "Look at Parliament Hill",
because that level has a named character and a landmark that is not on `TN-NAMES`'s list. The guide writes
"Talk to the guide", because it is not a person and the generic row says it is. A level whose landmark **is**
on that list may not write such a row, and the generic one is the answer rather than a worse-written specific
one.

## The three marks, and the words that stand in for their shapes

`interaction-affordance.ts` gives every engageable subject one mark in one of three states, and CLAUDE.md
requires that colour is never the only signal. The shapes are the art's; **the words are these**:

| Mark state | Claim | What the player reads when it is in reach |
|---|---|---|
| `idle` | this can be tapped, when you get to it | nothing — it is not in reach, and a prompt for it would be a lie |
| `ready` | tapping it now will work | `hud.interact.npc`, `hud.interact.poi`, or the target's own row |
| `done` | you have already done this one | `hud.interact.done` |

`hud.interact.done` carries the state **and** the way on, in that order, because the state is what the player
did not know and the way on is what they can still do: engaging a finished landmark shows its card again,
which is worth offering to somebody who wants to read the blurb twice.

## The hint is shown once, and it is not a tutorial

`hud.interact.hint` is the only string in this game that explains a control, and it exists because the marks
are the one affordance a player cannot be told about anywhere else — the level select does not mention them,
the menu does not, and the mark itself is a shape.

- It appears **the first time a mark is in reach**, beside the prompt, as `interact-hint`.
- It goes as soon as the player engages anything, and does not come back in that sitting.
- It is **not a dialog, not modal, and blocks nothing**. Nothing has to be dismissed to keep playing, and it
  takes no focus away from the prompt.
- It names **no input**. Not "tap", not "press E", not "hold the switch": a hint that names one input is a
  hint that is wrong for the other three, and this game is playable with a thumb, a keyboard and one switch.
  "Choose it" is the word the single-switch contract already uses (`README.md`), and it is true of every
  input.
- It counts nothing down and expires on nothing.

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `hud.interact.poi` | Look at this place | Regarder ce lieu |
| `hud.interact.npc` | Talk to this person | Parler à cette personne |
| `hud.interact.done` | Done. See this one again | Terminé. Revoir |
| `hud.interact.hint` | A mark shows something to see. Get close to it, then choose it. | Un repère indique quelque chose à voir. Approchez-vous, puis choisissez. |

**The three prompts are labels and carry no full stop**; the hint is two sentences and carries two, because
it is prose and is read as prose. « Terminé. Revoir » is shorter than its English and says the same two
things — the state, then the way on — which is what a translation of meaning is allowed to do
(`README.md`, French style).

**No row here needs gender agreement, and none contains a bracketed ending.** « Cette personne » is
feminine in French whoever it names, which is why the row is written about *the person in reach* and never
about the player.

**`hud.interact.npc` is about a person, and it is not a fallback for every character.** A companion animal
in reach draws its own row, because "Talk to this person" is false about a beaver and a false prompt is
worse than a plain one. The generic row is not reworded to cover both — "Talk to this one" is vaguer for the
case that is common and no clearer for the case that is rare — and `OQ-REACH-6` records the alternative.

**No row here names anything.** No place, no building, no character, no organisation — so no row in this
table can carry a name `TN-NAMES` keeps in a card body, and the prompt stops being a surface a name can
reach.

Rows this file does not own:

| Key | Owned by |
|---|---|
| `hud.interact.officer`, `hud.interact.parliament-hill` | `TN-LEVEL-ottawa.md` |
| `hud.interact.guide` — "Talk to the guide" / « Parler au guide » | `TN-GUIDE-the-guide.md` |
| `hud.label`, `hud.menu` | `TN-HUD-hud-and-menu.md` |
| `poi.<id>.title`, `poi.<id>.body`, and each level's landmark names | that level's story, or the level document under ADR-0010 |
| `common.close` | `TN-SET-settings.md` |

## Accessibility and bilingual coverage map

| Path | Discharged by |
|---|---|
| Keyboard only | `TN-REACH-06` |
| Single switch | `TN-REACH-06` |
| Screen reader | `TN-REACH-07` |
| Reduced motion | `TN-REACH-07` — the mark stops breathing and the words do not change |
| 200 % text | `TN-REACH-07` |
| Bilingual | `TN-REACH-08` |
| Failure path | `TN-REACH-05` (a target with no row, a name in the HUD, a hint that will not go) |

---

## TN-REACH-01 — The prompt says what pressing will do

```gherkin
Feature: Coming into reach of something
  As a player walking past a landmark
  I want the game to tell me what pressing will do
  So that I do not have to guess what a name on a button means

  Background:
    Given the Ottawa level is playable

  Scenario: A person in reach
    When the skater comes within reach of the officer
    Then the event "poi/entered" is emitted for "npc.officer"
    And the element "interact-prompt" is visible and reads "Talk to the officer"
    And it is a verb phrase, not a name on its own
    And it is at least 44 CSS px wide and tall

  Scenario: A place in reach
    When the skater comes within reach of Parliament Hill
    Then the element "interact-prompt" reads "Look at Parliament Hill"
    And it is not "Parliament Hill" on its own

  Scenario: Leaving reach withdraws the offer
    When the skater glides out of reach
    Then the event "poi/left" is emitted
    And the element "interact-prompt" is not present
    And no prompt describes something that cannot be engaged from here

  Scenario: The prompt does what the target does
    Given the officer is in reach
    When I take "interact-prompt"
    Then the event "npc/engaged" is emitted for "npc.officer"
    And it is the same event tapping the officer emits, as TN-LEVEL-05 requires

  Scenario: Only one thing is offered at a time
    Given two engageable things are within reach at once
    Then exactly one prompt is shown
    And it is the one for the nearest of them
    And it changes when the nearer one changes
```

## TN-REACH-02 — A target that has written no row of its own

```gherkin
Feature: The generic rows, and the names they keep out of the HUD
  Background:
    Given the Toronto level is playable
    And this level's story writes no row for its landmark

  Scenario: A place with no row of its own
    When I come within reach of the landmark
    Then the element "interact-prompt" reads "Look at this place"
    And it does not read "CN Tower"
    And no copy string drawn inside "hud" contains a name from TN-NAMES-naming-real-places.md's list

  Scenario: A person with no row of their own
    Given a level whose person has no row of their own is playable
    When I come within reach of them
    Then "interact-prompt" reads "Talk to this person"
    And it does not read that character's name

  Scenario: A companion who is not a person draws its own row
    Given the Halifax level is playable
    When I come within reach of the guide
    Then "interact-prompt" reads "Talk to the guide", the row TN-GUIDE owns
    And it does not read "Talk to this person"
    And the same row is drawn on Québec City and on Toronto

  Scenario: The name is where a name teaches something
    When I engage the landmark
    Then "poi-card" shows "CN Tower" as text, inside a sentence that says what it is
    And the prompt never named it

  Scenario: The prompt is never assembled from the level document
    Then no prompt in any level draws a value from the level document's landmark name
    And a target with no row offers no prompt at all, as TN-REACH-05 describes
```

## TN-REACH-03 — Something already done

```gherkin
Feature: A mark that has already been used
  Background:
    Given the Ottawa level is playable
    And I have already engaged Parliament Hill

  Scenario: The prompt says so, in words
    When I come within reach of it again
    Then the element "interact-prompt" reads "Done. See this one again"
    And it does not read "Look at Parliament Hill"
    And the state is not conveyed by the mark's colour, shape or opacity alone

  Scenario: Done wins over the target's own row and over the kind
    Given a row was written for this target
    Then the prompt is still "Done. See this one again"
    And the same is true for a person, for a companion and for a place

  Scenario: It is still a way in, not a dead control
    When I take it
    Then the card or the dialogue for that target opens again
    And nothing is earned a second time
    And no "quest/step-completed" event is emitted again

  Scenario: Being done is not being finished with the level
    Then every other mark in the level still offers its own prompt
    And the level is not ended by everything being done
```

## TN-REACH-04 — The one-time hint

```gherkin
Feature: Learning that the marks can be used, once
  Background:
    Given the Halifax level is playable
    And I have never engaged anything in this sitting

  Scenario: It appears the first time something is in reach
    When the first mark comes within reach
    Then the element "interact-hint" is visible
    And it reads "A mark shows something to see. Get close to it, then choose it."
    And it is shown beside "interact-prompt", not instead of it

  Scenario: It names no input, so it is true for everybody
    Then the hint contains none of "tap", "click", "press", "swipe", "hold" or a key name
    And the same sentence is shown to a touch, keyboard and single-switch player

  Scenario: It blocks nothing
    Then it is not a dialog and has no "aria-modal" attribute
    And it takes no focus
    And nothing has to be dismissed to keep playing
    And the level is not paused by it

  Scenario: It goes, and stays gone
    When I engage anything
    Then the element "interact-hint" is not present in the accessibility tree
    And it is not shown again in this sitting, in this level or in any other

  Scenario: It never becomes a nag
    When I walk past three marks without engaging any of them
    Then the hint is shown at most once
    And it is announced at most once
    And nothing on it counts down or expires
```

## TN-REACH-05 — A row that is missing, and a name that has leaked (failure path)

```gherkin
Feature: The rule is checkable, not a promise
  Scenario: A target with no row offers no prompt
    Given a level declares a target whose kind cannot be determined
    When it comes into reach
    Then no prompt is shown
    And no prompt reads "Interact", "Engage", "Use" or an empty string
    And no name from the level document is drawn in its place

  Scenario: A missing generic row fails the build
    Given a copy table is missing "hud.interact.poi", "hud.interact.npc",
      "hud.interact.done" or "hud.interact.hint" in either language
    When the content check runs
    Then the build fails, naming the key and the language

  Scenario: A per-target row present in one language only fails the build
    Given "hud.interact.guide" exists in English and not in French
    When the content check runs
    Then the build fails, naming the missing French string

  Scenario: A name from the list drawn in the prompt fails the build
    Given "interact-prompt" draws a string containing a name from TN-NAMES-naming-real-places.md's list
    When the content check runs
    Then the build fails, naming the string
    And the check reads what the prompt draws at runtime, not only what a copy table declares
    And a level document's landmark name reaching the prompt fails it
    And the quest tracker's own step prompt is not checked by this rule, as TN-NAMES-04 describes

  Scenario: A prompt that outlives its target
    Given a prompt is shown and the level is left
    Then the prompt is gone with the level
    And no prompt is ever shown while no level is playable

  Scenario: The checks are proven by failing fixtures
    Then a fixture exists for each check above
    And each is asserted to fail
    And a change that makes any of them pass fails this suite
```

## TN-REACH-06 — In reach, from the keyboard and with one switch

```gherkin
Feature: Reaching and engaging without a thumb
  Scenario: The prompt is reachable and operable with a keyboard
    Given I am using a keyboard only
    And something is in reach
    Then "interact-prompt" is reachable with "Tab" and activates with "Enter"
    And the key bound to "interact" does the same thing without moving focus
    And the focus indicator is visible and is not colour alone

  Scenario: The prompt's words are what a keyboard player is given
    Given I am using a keyboard only
    Then the prompt reads the same string a touch player reads
    And no keyboard-only wording exists for it

  Scenario: The prompt is in the switch ring
    Given single-switch mode is on
    And something is in reach
    When I press the switch briefly until the highlight reaches the prompt
    Then the highlighted control is announced in "#tn-live-region"
    When I hold the switch past the hold-to-choose threshold
    Then that target is engaged

  Scenario: The hint is never in the ring
    Given single-switch mode is on
    And "interact-hint" is visible
    When I press the switch briefly through the whole ring
    Then the hint is never highlighted as if it were a control
    And every real control is still reachable

  Scenario: Nothing expires while the player decides
    Given single-switch mode is on
    And something is in reach
    When I do nothing for two minutes
    Then the prompt is unchanged
    And the highlight has not moved
    And nothing has been engaged for me
```

## TN-REACH-07 — With a screen reader, with motion off, and at 200 %

```gherkin
Feature: The prompt reaches everybody
  Scenario: Coming into reach is announced, with a verb
    When something comes into reach
    Then "#tn-live-region" reads the same string the prompt draws
    And the announcement says what pressing will do
    And it is announced once per arrival, not repeatedly while I stand there

  Scenario: The announcement names a target only where a row names it
    Given a row was written for this target
    Then the announcement contains that target's name or role
    Given no row was written for it
    Then the announcement is the generic prompt and names nothing
    And no name from TN-NAMES-naming-real-places.md's list is ever announced by the prompt

  Scenario: The mark is not the only signal
    Then everything the mark's state says is also said by the prompt's words
    And a player who cannot see the mark can still tell an unused target from a done one

  Scenario: Reduced motion
    Given reduced motion is on
    And something is in reach
    Then the mark does not pulse, breathe, flash or bounce
    And the prompt's words are unchanged
    And the hint appears with no slide, fade or scale

  Scenario: The hint is announced once and is not a live region of its own
    When "interact-hint" appears
    Then "#tn-live-region" reads it once
    And "interact-hint" has no "aria-live" attribute of its own
    And exactly one element on the page has an "aria-live" attribute

  Scenario: 200 % text on a small phone
    Given text scaling is 200 %
    And the viewport is 390 x 844
    Then the whole of the prompt's label is visible, not cut off
    And the whole of the hint is visible, by scrolling inside "hud" if needed
    And neither covers "menu-button"
    And the skater is still drawn inside the upper two thirds of the canvas
    And the page does not scroll sideways
```

## TN-REACH-08 — In reach, in French

```gherkin
Feature: The prompt in French
  Background:
    Given the language is French

  Scenario: The generic prompts are French
    Given a place with no row of its own is in reach
    Then "interact-prompt" reads "Regarder ce lieu"
    Given a person with no row of their own is in reach
    Then it reads "Parler à cette personne"

  Scenario: A target's own row is French too
    Given the Ottawa level is playable
    When the officer comes into reach
    Then "interact-prompt" reads "Parler à l'agent"
    When Parliament Hill comes into reach
    Then it reads "Regarder la Colline du Parlement"
    Given the Halifax level is playable
    When the guide comes into reach
    Then it reads "Parler au guide"

  Scenario: The done prompt is French
    Given I have already engaged the landmark
    When it comes into reach again
    Then "interact-prompt" reads "Terminé. Revoir"
    And it says the same two things the English says

  Scenario: The hint is French and names no input
    When "interact-hint" appears
    Then it reads "Un repère indique quelque chose à voir. Approchez-vous, puis choisissez."
    And it contains no key name and no word for one kind of input
    And the announcing element carries "lang" equal to "fr"

  Scenario: No French string here needs gender agreement
    Then no string in this file's table contains "(e)", "·e" or a bracketed ending
    And none of them is about the player

  Scenario: Changing the language redraws the prompt without leaving the level
    Given the Ottawa level is playable in English and the officer is in reach
    When I change the language to French from the menu
    Then "interact-prompt" reads "Parler à l'agent"
    And "data-player-x" is unchanged
    And the level is not reloaded

  Scenario: Both languages or neither
    Then every key in this file's table has a value in "en" and in "fr"
    And no prompt is drawn onto the canvas as part of an image
```

---

## Open questions

- **`OQ-REACH-1` — Ottawa's two rows are respelled, and nothing else about them changes.**
  `hud.interact.poi.parliamentHill` becomes `hud.interact.parliament-hill`, so that every per-target row is
  `hud.interact.<the id the level document gives the target>` — which is what `poi/entered` carries and what
  the lookup is actually keyed on. Two shapes in one key family (`hud.interact.officer` with no kind, the
  landmark with one) is a lookup rule nobody can hold in their head. The wording — "Look at Parliament Hill"
  / « Regarder la Colline du Parlement » — is unchanged, no scenario in `TN-LEVEL-ottawa.md` asserts a key,
  and `app/ui/copy.ts` carries neither row today, so this costs nothing to do now and would cost a migration
  later.
- **`OQ-REACH-2` — should `hud.interact.done` be two rows, one per kind?** "Done. See this one again" is
  kind-neutral, which is what makes one row possible, and a person-shaped version would read a little better
  ("Done. Talk again"). *Recommendation:* one row. The news is the state, not the kind; two rows are two
  things to translate and a second place for the two to drift apart; and this state is rare enough that the
  extra warmth buys less than the consistency costs. Revisit if a level ever has a character the player is
  expected to return to — **the guide is now that character on three levels**, so this is closer than it was.
- **`OQ-REACH-3` — the hint's once-ness does not survive a closed tab.** These scenarios say the hint is
  shown once per sitting and goes for good once the player engages anything, which is testable today. A
  player who opens the game every day would meet it every day. *Recommendation:* remember it in the save when
  the save next gains a field — one boolean beside the settings, not a new document — and until then keep the
  per-sitting rule, which is the honest description of what the game does. `content/schemas/progress.schema.json`
  is not this directory's to edit; routed with `OQ-SAVE-1`.
- **`OQ-REACH-4` — a blind player is not told which landmark is in reach where no row was written.**
  `TN-LEVEL-08` requires the announcement to name Parliament Hill, and Ottawa's own row does; a level with no
  row announces "Look at this place" and the name arrives when the card opens. *Recommendation:* accept it,
  and prefer per-target rows in every level story where the name is not on `TN-NAMES`'s list — that is the
  cheap fix and it is copy, not code. Where the name **is** on that list, the generic row is not a shortfall
  but the rule: the name belongs on the card, for everybody, with its source.
- **`OQ-REACH-5` — is "mark" the right word, in either language?** The player sees a shape over a landmark
  and the hint calls it « un repère ». Neither word is in `Discover Canada` and neither is a term a newcomer
  arrives with. *Recommendation:* keep both, put them in front of the first plain-language reviewer with the
  rest of the level copy, and change them in one place if a better pair comes back — the word appears in
  exactly one row, on purpose.
- **`OQ-REACH-6` — `hud.interact.npc` says "person", and one character in this game is not one.** The row is
  kept and the guide writes its own, which costs one row and keeps the generic sentence plain for the case
  it actually describes. The alternatives are a vaguer generic ("Talk to this one" / « Parler à celui-ci »,
  which needs gender in French and is worse for everybody), or a second generic row per kind of character,
  which is a taxonomy invented for one beaver. *Recommendation:* keep it as it is, and treat any future
  non-human character the same way — a row of its own in its own story. If a third such character appears,
  revisit, because at that point the generic row is wrong more often than it is right.
