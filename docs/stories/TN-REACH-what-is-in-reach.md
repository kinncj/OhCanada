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

**Amended again 2026-09-13 — a place can now offer a quest, and "Look at this place" is the wrong promise
for one that does.** ADR-0029 widened `quest.giver` from a character to an **engageable**, so
`content/quests/peggys-cove-point-light.json` is offered by a lighthouse and
`content/quests/the-north-sternwheeler.json` by a vessel. Pressing those two landmarks opens a **dialogue
with a task in it**, not a card — and this file's founding rule is that the prompt says what pressing will
do. One generic row is added, `hud.interact.poi.offer`, and the precedence list gains a case. Nothing about
the three existing rows changes, and **neither of those two levels writes a per-target row**, because their
own stories forbid the landmark's name inside the HUD (`TN-PEGGYS-01`, `TN-NORTH-01`).

**Amended 2026-09-14 — ADR-0039, from the live-site audit.** Four changes:

- **Landmarks are named in their prompt.** Every landmark that opens a card has a per-target row unless its
  name is on `TN-NAMES`'s list or it gives a quest. That is `OQ-REACH-4`'s recommendation carried out.
- **Engaged is not the same as done.** A giver whose quest is unfinished, or a landmark a running quest waits
  for, keeps its own prompt.
- **The hint says "someone or something"**, because the first thing in reach on Halifax is the guide.
- **The prompt is drawn before the hint in the strip, not after it.**

The new rows are **proposed**, listed below and in `COPY_GAPS`, until this file's owner ratifies them.

Read `README.md` in this directory first. `TN-HUD-hud-and-menu.md` owns the strip the prompt is drawn in;
`TN-LEVEL-ottawa.md` owns Ottawa's two per-target rows and the officer; `TN-GUIDE-the-guide.md` owns the
guide's name and its prompt; `TN-NAMES-naming-real-places.md` owns which names may appear where;
`TN-DIALOGUE-what-a-quest-giver-says.md` owns what a giver says once the prompt has been taken;
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
| `hud.interact.poi` | A place is in reach, it has something to show, and nothing more specific is written |
| `hud.interact.poi.offer` | A place is in reach **and it has something to offer** — it is this level's quest giver |
| `hud.interact.npc` | A person is in reach and nothing more specific is written |
| `hud.interact.done` | This one has already been done |
| `hud.interact.hint` | The one-time explanation of the marks themselves |
| `hud.interact.<target id>` | A row for one target, written in the story that owns that target |

The target id is **the id the level document gives it** — `officer`, `parliament-hill`, `cn-tower`, `guide`,
`peggys-point-light`, `yukon-river-sternwheeler` — because that is what `poi/entered` carries and what the
prompt is looked up by. Ottawa's two rows keep their wording and are respelled to that shape (`OQ-REACH-1`).

**A target id never contains a dot, so `hud.interact.poi.offer` cannot be mistaken for one.** That is stated
rather than assumed, because the two key families share a prefix and the lookup is by exact key: the kind
words — `poi`, `poi.offer`, `npc`, `done`, `hint` — are reserved, and a level that gave a target one of those
ids would be shadowing a generic row (`OQ-REACH-7`).

**Where a per-target row lives follows what the target is**, which is `README.md`'s rule about the home of a
string: a landmark belongs to one level, so its row is in that level's story; **a character that stands in
three levels belongs to no one of them**, so `hud.interact.guide` is in `TN-GUIDE-the-guide.md` beside that
character's name. Written per level it would be the same words three times, and three copies of one sentence
is how they stop being one sentence.

**Which row is drawn, in order:**

1. **The target has been done** → `hud.interact.done`, whatever kind it is and whatever row was written.
   The state is the news; the invitation is not, and a player who is told "Talk to the officer" about
   somebody they have already finished with will walk back for nothing. **Done means engaged in this sitting
   with nothing left to do there** (ADR-0039): a giver whose quest is on offer, declined or running, and a
   landmark a running quest's step is waiting for, are not done, however recently they were engaged.
2. **A row exists for this target** → that row.
3. **Otherwise, by kind** → `hud.interact.npc` for a person; `hud.interact.poi.offer` for a place that is
   this level's quest giver; `hud.interact.poi` for any other place.

**And never anything else.** Not the target's name from the level document, not "Interact", not "Engage",
not an icon alone, not an empty string. A target this build has no row for offers **no prompt** rather than a
guessed one — the same rule `TN-WAIT` applies to a level with no waiting sentence, and the same gate.

**A character who offers a quest needs no new row**, and that asymmetry is the whole reason the new one
exists. "Talk to the officer" already says what pressing does, because talking is what a person does whether
or not they have a task. "Look at this place" is *wrong* about a place that talks — it promises a card and
opens a conversation — and a prompt that understates what pressing does is the same defect as one that names
the target, arriving from the other side.

## Why the new row is not "Talk to this place"

The obvious wording is refused, and ADR-0029 §5 is why. A landmark giver **is the named source of words on
screen and does not acquire a mouth, a rig or a mood**; its lines are written in the second person and the
impersonal for a reason that is not taste — a screen-reader user hears the dialog's accessible name, "Peggy's
Point Lighthouse", and then the prose, and first-person prose after that name has told that user a person is
standing there. On the two levels where this row is drawn, that is precisely the failure the art documents'
`neverAdd` clause exists to prevent, arriving through the copy instead of the picture. **A prompt reading
"Talk to this place" would do the same job one screen earlier.**

Three other candidates and why each lost:

- **"Read what is written here."** Truest to a plaque and false to the picture: `make verify-art` refuses a
  `<text>` element in a render source, so **no lettering is drawn on either landmark**. A prompt promising
  writing describes a state the screen is not in, which is the defect `README.md` names most often.
- **"Stop here and read."** It is the quest's own first step prompt, drawn in `hud-quest-tracker`. Using it
  in the prompt too would put one sentence in two HUD elements at once, which reads as a stutter and makes
  neither say anything the other did not.
- **"Look at this place", unchanged.** Simplest, and it is the promise that is wrong. It is kept for every
  landmark that really does open a card.

**"See what there is to do here" / « Voir ce qu'il y a à faire ici »** says what pressing does, names
nothing, personifies nothing, claims no lettering, and uses the game's own word for a quest — a **task**
(`quest.done.title`, "Task done!"). It is a demonstrative phrase like the other two generic rows, for the
reason below.

## Why the generic rows say "this place" and "this person"

A generic row cannot name the target, so it has to be useful without naming it, and the two candidates are a
verb with a demonstrative ("Look at this place") or a bare verb ("Look"). The demonstrative wins: it is what
a screen reader has to read on its own, out of any visual context, and "Look" alone is read as an
instruction with no object. `hud.interact.poi.offer` follows the same shape with "here" doing the
demonstrative's work, because "See what there is to do at this place" is longer and says no more.

**The player is not losing the name.** They can see the landmark; and the name — with a sentence saying what
the building is, and a source — is on the card the prompt opens, which is where `TN-NAMES` decided a name
teaches something. **Where the landmark is a quest giver they are not losing it either**: ADR-0029 §6 makes
the giver's name the dialog's accessible name, so the name arrives one press later for everybody, in both
languages, from the level document. That is the same information a sighted and a screen-reader player get, in
the same place, which is stronger than the name being in a button for one of them and nowhere for the other.

**Where a target can do better, it does.** Ottawa writes "Talk to the officer" and "Look at Parliament Hill",
because that level has a named character and a landmark that is not on `TN-NAMES`'s list. The guide writes
"Talk to the guide", because it is not a person and the generic row says it is. A level whose landmark **is**
on that list may not write such a row, and the generic one is the answer rather than a worse-written specific
one — **and so may a level whose own story forbids the name in the HUD**, which is the case on both levels
that draw the new row.

## The three marks, and the words that stand in for their shapes

`interaction-affordance.ts` gives every engageable subject one mark in one of three states, and CLAUDE.md
requires that colour is never the only signal. The shapes are the art's; **the words are these**:

| Mark state | Claim | What the player reads when it is in reach |
|---|---|---|
| `idle` | this can be tapped, when you get to it | nothing — it is not in reach, and a prompt for it would be a lie |
| `ready` | tapping it now will work | `hud.interact.npc`, `hud.interact.poi`, `hud.interact.poi.offer`, or the target's own row |
| `done` | you have already done this one | `hud.interact.done` |

`hud.interact.done` carries the state **and** the way on, in that order, because the state is what the player
did not know and the way on is what they can still do: engaging a finished landmark shows its card again,
which is worth offering to somebody who wants to read the blurb twice. **It wins over the new row too**: a
landmark whose quest is finished reads "Done. See this one again", not an invitation to a task that is over.

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
- **It says "someone or something you can choose"** (ADR-0039), which is true whatever a mark is over: a
  person, the guide, a place that shows something and a place that opens a task. It used to say "something
  to see", which was false on Halifax, where the first mark in reach is the guide. The hint is about the
  marks, not about what any one of them opens, and rewording it per kind would make a one-time sentence
  depend on which mark happened to be first.

## Player-facing copy

| Key | EN | FR |
|---|---|---|
| `hud.interact.poi` | Look at this place | Regarder ce lieu |
| `hud.interact.poi.offer` | See what there is to do here | Voir ce qu'il y a à faire ici |
| `hud.interact.npc` | Talk to this person | Parler à cette personne |
| `hud.interact.done` | Done. See this one again | Terminé. Revoir |
| `hud.interact.hint` | *proposed, see below* | *proposed, see below* |

**Proposed rows, not yet ratified (ADR-0039).** Written by `app/ui` and declared in `COPY_GAPS`
(`app/ui/copy.ts`) until this file's owner moves them into the table above or replaces them. The hint replaces
"A mark shows something to see. Get close to it, then choose it." / « Un repère indique quelque chose à voir.
Approchez-vous, puis choisissez. », which was untrue whenever the first thing in reach was a person or the
guide.

| Key | EN | FR |
|---|---|---|
| `hud.interact.hint` | A mark shows someone or something you can choose. Get close, then choose. | Un repère montre quelqu'un ou quelque chose à choisir. Approchez-vous, puis choisissez. |

The landmark rows below belong, on ratification, in each level's own story, as `hud.interact.parliament-hill`
belongs in `TN-LEVEL-ottawa.md`. Each is written out from that level document's `pois[].name` with its article,
and none is interpolated. No row exists for `pier-21`, `chateau-frontenac`, `cn-tower`, `canada-place` or
`human-rights-museum`, whose names are on `TN-NAMES`'s list. There is none for `peggys-point-light` or
`yukon-river-sternwheeler` either: they give a quest and draw `hud.interact.poi.offer`.

| Key | EN | FR |
|---|---|---|
| `hud.interact.town-clock` | Look at the Halifax Town Clock | Regarder la Tour de l'horloge d'Halifax |
| `hud.interact.market-stall` | Look at the market stall | Regarder l'étal de marché |
| `hud.interact.harbour-tug` | Look at the harbour tug | Regarder le remorqueur de port |
| `hud.interact.granite-shore` | Look at the granite shore | Regarder la côte de granit |
| `hud.interact.fish-store` | Look at the fish store | Regarder le hangar de pêche |
| `hud.interact.village-house` | Look at the village house | Regarder la maison du village |
| `hud.interact.city-wall` | Look at the city wall | Regarder le mur de la ville |
| `hud.interact.terrace-kiosk` | Look at the bandstand | Regarder le kiosque à musique |
| `hud.interact.rideau-locks` | Look at the canal locks | Regarder les écluses du canal |
| `hud.interact.library-of-parliament` | Look at the Library of Parliament | Regarder la Bibliothèque du Parlement |
| `hud.interact.warming-hut` | Look at the warming hut | Regarder la cabane chauffée |
| `hud.interact.streetcar` | Look at the streetcar | Regarder le tramway |
| `hud.interact.nathan-phillips-square` | Look at Nathan Phillips Square | Regarder la place Nathan-Phillips |
| `hud.interact.footbridge` | Look at the footbridge | Regarder la passerelle |
| `hud.interact.autumn-maple` | Look at the maple tree | Regarder l'érable |
| `hud.interact.grain-bins` | Look at the grain bins | Regarder les silos à grains |
| `hud.interact.grain-elevator` | Look at the grain elevator | Regarder l'élévateur à grain |
| `hud.interact.combine-harvester` | Look at the combine harvester | Regarder la moissonneuse-batteuse |
| `hud.interact.container-car` | Look at the container car | Regarder le wagon porte-conteneurs |
| `hud.interact.ranch-gate` | Look at the ranch gate | Regarder la barrière du ranch |
| `hud.interact.ranch-barn` | Look at the working ranch | Regarder le ranch en activité |
| `hud.interact.pump-jack` | Look at the oil pump jack | Regarder le chevalet de pompage |
| `hud.interact.beef-cattle` | Look at the cattle on the range | Regarder les bovins au pâturage |
| `hud.interact.marina` | Look at the marina | Regarder la marina |
| `hud.interact.bulk-carrier` | Look at the cargo ship | Regarder le navire de charge |
| `hud.interact.spruce-stand` | Look at the spruce trees | Regarder les épinettes |
| `hud.interact.driftwood` | Look at the driftwood | Regarder le bois flotté |

**The four prompts are labels and carry no full stop**; the hint is two sentences and carries two, because
it is prose and is read as prose. « Terminé. Revoir » is shorter than its English and says the same two
things — the state, then the way on — which is what a translation of meaning is allowed to do
(`README.md`, French style).

**No row here needs gender agreement, and none contains a bracketed ending.** « Cette personne » is
feminine in French whoever it names, which is why the row is written about *the person in reach* and never
about the player. « Voir ce qu'il y a à faire ici » has no adjective and no participle to agree with
anything, which is one of the reasons it beat the alternatives.

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

  Scenario: Being held at something keeps its offer (ADR-0037)
    Given the level is holding me at something that came into reach
    When the brake carries me past the edge of its reach
    Then no "poi/left" is emitted for it
    And "interact-prompt" still offers it, and taking it engages it
    And the offer is withdrawn when the hold lets me go

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

  Scenario: A place that offers this level's quest
    Given the Peggy's Cove level is playable
    And this level's quest giver is the point of interest it places
    When I come within reach of it
    Then "interact-prompt" reads "See what there is to do here"
    And it does not read "Look at this place"
    And it does not read "Talk to this place"
    And it does not read "Talk to this person"
    And it names nothing
    And the same row is drawn on the North, for the same reason

  Scenario: The row follows what pressing opens, not what the target is made of
    Given a place that offers a quest is in reach
    When I take the prompt
    Then a dialogue opens, as TN-QUEST-01 describes
    Given a place that offers no quest is in reach
    When I take the prompt
    Then its card opens
    And the two prompts differ, because the two outcomes differ

  Scenario: A character who offers a quest draws no new row
    Given the Ottawa level is playable
    And the officer offers this level's quest
    When I come within reach of them
    Then "interact-prompt" reads "Talk to the officer"
    And it does not read "See what there is to do here"
    And a person's prompt already says what pressing does, whether or not they have a task

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

  Scenario: Done wins over a place that offered a task
    Given the Peggy's Cove level is playable
    And I have finished the task its landmark offered
    When I come within reach of it again
    Then "interact-prompt" reads "Done. See this one again"
    And it does not read "See what there is to do here"
    And nothing invites me to a task that is over

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
    And it reads "A mark shows someone or something you can choose. Get close, then choose."
    And it is shown after "interact-prompt" in the strip, not instead of it and not above it (ADR-0039)

  Scenario: One hint covers every kind of mark
    Given a level whose first mark in reach is a place that offers a task
    Then the same hint is shown, word for word
    And it is not reworded for the kind of thing the mark is over
    And nothing about it says what that particular mark will open

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
    Given a copy table is missing "hud.interact.poi", "hud.interact.poi.offer", "hud.interact.npc",
      "hud.interact.done" or "hud.interact.hint" in either language
    When the content check runs
    Then the build fails, naming the key and the language

  Scenario: A level whose quest giver is a place needs the offer row
    Given a level document places a point of interest that is its quest's giver
    And no "hud.interact.poi.offer" row exists in both languages
    When the content check runs
    Then the build fails, naming the level and the key
    And the prompt is never drawn as "Look at this place" in its place

  Scenario: A per-target row present in one language only fails the build
    Given "hud.interact.guide" exists in English and not in French
    When the content check runs
    Then the build fails, naming the missing French string

  Scenario: A target id that shadows a generic row is refused
    Given a level document gives a target the id "poi", "npc", "done" or "hint"
    When the content check runs
    Then the build fails, naming the id and this file
    And the message says the kind words are reserved

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

  Scenario: A place that offers a task announces the task, and the dialog announces the source
    Given a place that offers a quest is in reach
    Then "#tn-live-region" reads "See what there is to do here"
    And it names nothing
    When I take the prompt
    Then the dialog's accessible name is the giver's name from the level document, as ADR-0029 requires
    And the name is read before any of the words it is the source of
    And a screen-reader user learns what is speaking one press after a sighted player can see it

  Scenario: The mark is not the only signal
    Then everything the mark's state says is also said by the prompt's words
    And a player who cannot see the mark can still tell an unused target from a done one
    And a player who cannot see the mark can still tell a place that shows from a place that offers

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
    And the whole of "See what there is to do here" is visible, which is the longest of the four
    And in French the whole of "Voir ce qu'il y a à faire ici" is visible
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
    Given a place that offers this level's quest is in reach
    Then it reads "Voir ce qu'il y a à faire ici"
    And it does not read "Parler à ce lieu"

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
    Then it reads "Un repère montre quelqu'un ou quelque chose à choisir. Approchez-vous, puis choisissez."
    And it contains no key name and no word for one kind of input
    And the announcing element carries "lang" equal to "fr"

  Scenario: No French string here needs gender agreement
    Then no string in this file's table contains "(e)", "·e" or a bracketed ending
    And none of them is about the player
    And "Voir ce qu'il y a à faire ici" carries no adjective and no participle to agree with anything

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

## TN-REACH-09 — The player comes to rest at each thing they can choose (ADR-0032)

Added 2026-09-14. A held drive used to come to rest wherever the thumb lifted — on the skate, up to two thousand
pixels past the officer — and auto-move stopped at nothing the domain called finished. One rule now covers every
drive. The rule is `app/adapters/phaser/auto-stop.ts`'s; the arithmetic is proved in
`tests/unit/adapters/phaser/auto-stop.test.ts` and the wiring in `tests/e2e/held-move-stops.spec.ts` and
`tests/e2e/auto-move-stops.spec.ts`.

```gherkin
Feature: Every drive stops at each thing a player can choose
  Background:
    Given a level is playable
    And the mode the player moves in can engage something

  Scenario: Holding to move stops at the first thing, and holding on does not overrule it
    When I hold the key bound to "move-right", or hold a finger to the right of the player, and do not let go
    Then I come to rest within the mode's "reachPx" of the first landmark or character ahead
    And "data-speed" stays 0 for as long as I keep holding
    And every frame's intent is still the direction I am holding
    And "interact-prompt" is visible

  Scenario: The stop is announced once, by the offer
    When I come to rest at a landmark
    Then "#tn-live-region" has already read the prompt's words for it, once
    And nothing further is announced because I stopped

  Scenario: Letting go and pressing again carries me on
    Given I am at rest at a landmark with "move-right" held
    When I let go and hold "move-right" again
    Then I move on past it
    And the next landmark or character stops me in the same way

  Scenario: Steering back always lets me go
    Given I am at rest at a landmark
    When I hold "move-left", with or without letting go of "move-right" first
    Then I move left on the first frame the level sees it

  Scenario: Engaging lets me go, whichever way I engaged
    Given I am at rest at a landmark
    When I engage it by the key bound to "interact", by tapping it, or by "interact-prompt"
    And I close what it opened
    Then nothing holds me there
    And pressing "move-right" once carries me on

  Scenario: Nothing stops me twice in one visit
    Given a landmark let me go
    When I walk on, or turn and walk back past it
    Then it does not stop me again until I next open the level

  Scenario: Finished things stop me once per visit too
    Given I finished a landmark on an earlier visit
    When I reach it on this visit
    Then I come to rest there once
    And "interact-prompt" reads "Done. See this one again"

  Scenario: A glide I let go of outside reach is mine
    When I let go before a landmark is in reach
    Then I glide as the mode glides and nothing brakes me for it
    And I glide past it, and past anything else I glide through

  Scenario: Letting go in reach stops me there (ADR-0037)
    Given something I have not been let go from this visit is within the mode's "reachPx"
    When I let go of the direction I was holding, while I am still moving
    Then I come to rest at it, or beside it if it is a character
    And "interact-prompt" still offers it once I am at rest
    And a press, the other direction, or engaging lets me go, as above

  Scenario: Auto-move and the train stop at the same places, and never start on their own
    Given "Move by itself" is on, or the level's mode drives itself
    Then the drive comes to rest at each landmark and character on the same line as a held drive
    And a press of either direction, or engaging, lets it go
    And nothing moves again while I do nothing

  Scenario: One switch can engage and go on
    Given single-switch mode is on
    And the drive has brought me to rest at a landmark
    When I move the highlight to "interact-prompt" and hold the switch past the threshold
    Then the landmark is engaged
    And closing what it opened lets an automatic drive carry me on
    And nothing on screen counts down

  Scenario: Reduced motion changes nothing about where I stop
    Given "Less movement" is on
    Then I come to rest at the same place, on the same brake
```

## TN-REACH-10 — Let go when the prompt appears, then take it (ADR-0037)

Added 2026-09-14. A live-site audit let go the moment each prompt appeared and tapped it: on Toronto the tap meant
for the guide opened the streetcar, on Québec City the slide overshot the Château Frontenac, on Ottawa the skater
glided past the locks and the officer. The rule is `app/adapters/phaser/auto-stop.ts`'s; the arithmetic is proved in
`tests/unit/adapters/phaser/auto-stop.test.ts` and the shipped build in `tests/e2e/release-in-reach.spec.ts`.

```gherkin
Feature: One thumb can take a prompt
  Scenario Outline: The prompt is still there when the thumb arrives
    Given the <level> level is playable
    When I hold to move and let go the moment "interact-prompt" appears
    Then I come to rest within the mode's "reachPx" of what it offers
    And "interact-prompt" still reads the same words
    When I take "interact-prompt"
    Then what opens is the thing it offered, and nothing else is engaged

    Examples:
      | level       |
      | Toronto     |
      | Québec City |
      | Ottawa      |

  Scenario: The same for a key and a finger
    Then lifting a held finger and releasing a held key stop me in the same place

  Scenario: Skating still coasts
    Given the Ottawa level is playable
    When I skate and let go with nothing in reach
    Then the skater coasts past the next landmark without being braked
```

## TN-REACH-11 — I come to rest beside a character, not inside them (ADR-0037)

Added 2026-09-14. Holding right from the front door stopped the player inside the Halifax guide; the bike rode
through the Toronto guide, the toboggan sat under the Québec City guide, and on the Prairies the guide stood inside
the train's glass dome. The rest points are `app/adapters/phaser/stand-off.ts`'s and every shipped level is held by
`tests/unit/contracts/a-stop-rests-beside-a-character.test.ts`.

```gherkin
Feature: Stopping at a person leaves room for both of us
  Scenario: A drive stops beside a character
    Given a level places a character
    When any drive comes to rest at them
    Then my figure, my equipment and anything I ride do not overlap their body
    And I am still within the mode's "reachPx" of them
    And "interact-prompt" offers them

  Scenario: A character is never inside the ride
    Given the level's mode carries me on a ride — a car with glass, or a saddled horse
    When the ride comes to rest at a character
    Then the character does not stand inside the ride's footprint, its glass or the seat I sit in
    And they read as standing beyond the ride

  Scenario: Landmarks are unchanged
    When a drive comes to rest at a landmark
    Then I come to rest level with it, as before

  Scenario: Nobody was moved to make room
    Then every character and landmark stands where its level document places it
```

## TN-REACH-12 — A stop waits for an answer, from any hand, and says how to go on (ADR-0043)

Added 2026-09-15 after a second live-site audit (390×844). On the Prairies a player who pressed right while the
train braked for the guide rode past him, and the level ended with its task never started; steering back ran the
train backwards at cruise speed to the start of the world. On Halifax a keyboard-only player let go and pressed right
fourteen times at the Town Clock and never moved, and `Enter` at a stop opened nothing, while a finger went on at once.
The rules are `app/adapters/phaser/auto-stop.ts`, `backing.ts` and `key-presses.ts`; the arithmetic is proved in
`tests/unit/adapters/phaser/auto-stop.test.ts`, `backing.test.ts` and `key-presses.test.ts`, and the shipped build in
`tests/e2e/train-stops-at-the-guide.spec.ts` and `tests/e2e/keyboard-at-a-stop.spec.ts`.

```gherkin
Feature: A stop is an answer the player gives once they have stopped
  Scenario: A press that lands while the brake is on is not an answer
    Given a drive is being brought to rest at something
    When I press the way I was going before I am at rest
    Then I still come to rest at it, on the side the stand-off chooses
    And "interact-prompt" offers it
    When I let go and press again once I am at rest
    Then I move on past it

  Scenario: The Prairies train stops at the guide however I press
    Given the Prairies level is playable
    When I hold "move-right" from the start, or press it as the train brakes
    Then the train comes to rest past the guide, within its reach, clear of its glass
    And "interact-prompt" reads "Talk to the guide"

  Scenario: A key is a press however short
    Given I am at rest at a stop with "move-right" held
    When I let go of "move-right" and press it again, however quickly
    Then I move on, exactly as lifting and holding a finger does
    When something is in reach and I press the key bound to "interact", however briefly
    Then it is engaged

  Scenario: The strip says why I stopped and how to go on
    When a drive brings me to rest with something on offer that I have not engaged in this sitting
    Then "interact-hint" reads "Stopped here. Choose it, or move again to go on."
    And "#tn-live-region" says it once for that thing in this sitting, and not again while I stand there
    And it names no input
    When I move on, or engage it
    Then it goes

  Scenario: A ride with a front backs up only while I press back
    Given the level's ride does not turn with its rider
    When I press "move-left"
    Then it backs up no faster than the level's "backingMaxSpeed"
    When I let go
    Then it comes to rest within a few pixels and waits
    And nothing moves while I do nothing
    When I press "move-right", or engage what is in reach
    Then the drive carries it forward again

  Scenario: The ride stays on the glass
    When I back a ride with a front up as far as it goes
    Then its tail stops at the world's edge
    And the rider is between a quarter and three quarters of the way across the screen
```

Proposed row, pending ratification (`COPY_GAPS`): `hud.stop.hint` — "Stopped here. Choose it, or move again to go on." /
« Arrêt ici. Faites votre choix, ou avancez de nouveau pour continuer. »

## Open questions

- **`OQ-REACH-1` — Ottawa's two rows are respelled, and nothing else about them changes.**
  `hud.interact.poi.parliamentHill` becomes `hud.interact.parliament-hill`, so that every per-target row is
  `hud.interact.<the id the level document gives the target>` — which is what `poi/entered` carries and what
  the lookup is actually keyed on. Two shapes in one key family (`hud.interact.officer` with no kind, the
  landmark with one) is a lookup rule nobody can hold in their head. The wording — "Look at Parliament Hill"
  / « Regarder la Colline du Parlement » — is unchanged, no scenario in `TN-LEVEL-ottawa.md` asserts a key,
  and `app/ui/copy.ts` carries neither row today, so this costs nothing to do now and would cost a migration
  later. **`hud.interact.poi.offer` is the one key that keeps a dotted kind**, and it is a *kind* rather than
  a target, which is the distinction the respelling was for.
- **`OQ-REACH-2` — should `hud.interact.done` be two rows, one per kind?** "Done. See this one again" is
  kind-neutral, which is what makes one row possible, and a person-shaped version would read a little better
  ("Done. Talk again"). *Recommendation:* one row. The news is the state, not the kind; two rows are two
  things to translate and a second place for the two to drift apart. Revisit if a level ever has a character
  the player is expected to return to — **the guide is now that character on three levels**, and **two
  landmarks now open a dialogue rather than a card**, so the kind-neutral wording is carrying more cases than
  it was written for. It still reads correctly for all of them, which is the test.
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
  cheap fix and it is copy, not code. **Levels 2 and 10 are the case where it is not available**: their names
  are not on that list, but their own stories forbid the name inside the HUD, so the generic row is the rule
  rather than a shortfall — and ADR-0029 gives those two the best version of this anyway, because the name
  arrives as the dialog's accessible name one press later.
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
  non-human character the same way — a row of its own in its own story.
- **`OQ-REACH-7` — the kind words are reserved and nothing enforces it yet.** `hud.interact.<target id>` and
  `hud.interact.<kind>` share a prefix, so a level that gave a target the id `poi`, `npc`, `done` or `hint`
  would shadow a generic row, silently, and draw the right words for the wrong reason. `TN-REACH-05` asserts
  the build fails on it; no gate does today. *Recommendation:* the same check that compares declared targets
  against written rows can compare ids against the reserved list in one pass, and it costs a set membership
  test. The risk is small and the failure is invisible, which is the combination this directory keeps
  deciding is worth a line. Routed with `TN-REACH-05`'s fixtures.
