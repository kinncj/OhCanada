# Dialogue, quests and landmark blurbs are content too

A wrong fact in a Mountie's dialogue is exactly as wrong as a wrong fact on a question card, and it is read
by the same player for the same purpose. So the same rule reaches it.

Verification here follows **the claim, not the screen it appears on**.

## Every line of dialogue declares whether it states a fact

A line in a quest document looks like this:

```json
{
  "speaker": "officer",
  "text": {
    "en": "Welcome to Parliament Hill.",
    "fr": "Bienvenue sur la Colline du Parlement."
  },
  "fact": { "factual": false, "source": null, "verification": null }
}
```

`fact.factual` is **required on every line** and is never defaulted. A greeting and a claim look identical to
a machine, so the judgement is recorded per line rather than guessed:

- **`false`** — greetings, instructions, encouragement, flavour. `source` and `verification` are both `null`.
- **`true`** — anything a player could be tested on. Then `source` and `verification` must both be present
  and are filled in exactly as a question's are: a chapter, a page, an exact quote, a hash, an `asOf`, a
  volatile flag — and a verification block you leave empty for somebody else to grant.

The schema enforces that conditional, so "this line states a fact and nobody checked it" is not a state you
can write down.

Yes, this means authoring "Nice weather today" costs you a three-field judgement. That is deliberate. An
optional block would be left out exactly where it matters most, and a `factual: false` on a sentence that
really does make a claim is a reviewable lie rather than an invisible gap.

**The practical consequence: a character may not say anything the guide does not support.** If you want an
NPC to say something colourful about their city and you cannot find it in *Discover Canada*, either find it
or cut the sentence. "The Peace Tower was completed in 1927" needs a citation like any question does.

## Landmarks

A point of interest on a level carries a `name`, a `blurb` and the same `fact` block. The blurb is the thing
the landmark teaches, in plain language, so a landmark is content rather than decoration — decoration is a
parallax layer with no words on it.

Blurbs are the easiest place to write an unsupported sentence, because they read like scene-setting. They
are not. If it states something about Canada, it is a claim.

## Quests

A quest document (`content/quests/*.json`) carries:

| Field | What it is |
|---|---|
| `id`, `levelId`, `giver` | which quest, on which level, offered by which **engageable** — see below |
| `title`, `summary` | shown in the tracker; both languages |
| `steps` | the objectives, in order |
| `declinedLine`, `reminderLine`, `afterLine`, `doneLine` | what the giver says when you refuse, when you come back, after the objective, and at the end |

A step has a `kind` — `talk`, `visit`, `collect` or `answer` — a `targetId`, and a `prompt` telling the
player what to do. An `answer` step names a `subject` and a `count`: **the quest says how many questions,
never which ones.** Choosing which questions to ask belongs to the scheduler, from the player's own review
history. A quest that listed ids would make the scheduler decorative.

Those four giver lines each carry a full dialogue line, including the `fact` block, for the reason above:
"Parliament Hill is that way, keep going" is flavour, and the next sentence somebody writes might not be.

## Who offers a quest: a person, or a thing

**A quest is offered by something the player engages, and a drawn person is one kind of such thing, not the
only kind.** `giver` names either:

| Kind | What you write in `giver` | Where it is placed | Has a face? |
|---|---|---|---|
| **a character** | the id of a `content/characters/<id>.json`, e.g. `"guide"` | the level's `characters[]`, as `characterId` | yes — a rig, a portrait, an `expression` |
| **a landmark** | the id of a point of interest, e.g. `"peggys-point-light"` | the level's `pois[]`, as `id` | no |

A landmark giver is a plaque, an interpretive panel, a posted notice, a marker, a trail sign — the things
that already exist at a real place to teach a visitor a fact at the spot. It offers, it reminds, and it
closes, exactly as a character does, using the same four lines.

### Which to use

- **Use a character** when the level already places one and the words want a person's voice: a greeting, an
  invitation, encouragement after a wrong answer.
- **Use a landmark** when the level places no person, or when the words are a sign's words rather than
  somebody's. If you are unsure, look at what the level actually draws: if there is no figure in the art,
  there is no figure to speak.
- **Some levels may not draw a person at all**, and on those the landmark is the only option. Today that is
  **Peggy's Cove** and **the North**, and it is not a temporary gap waiting for an artist: both levels'
  art documents forbid *"a figure of any kind, at any scale, including a silhouette and a crowd"*, and both
  levels' story documents forbid any string that describes, addresses or names a person, a people or a
  nation. `docs/stories/TN-LEVEL-the-north.md` gives the reasoning, and it is worth reading before you write
  a word for either level. **Do not propose adding a small NPC to these two levels.** The answer is a
  landmark giver, and that is what ADR-0029 exists for.

### A landmark speaks in the second person, and never in the first

This is a rule, not a preference, and no validator enforces it — a reviewer does.

```json
{
  "speaker": "peggys-point-light",
  "text": {
    "en": "This light has stood on the bare rock since 1914.",
    "fr": "Ce phare se dresse sur la roche nue depuis 1914."
  },
  "fact": { "factual": true, "source": { "...": "..." }, "verification": { "...": "..." } }
}
```

Write *"This spot marks…"*, *"You are standing on…"*, *"The light here was first lit in…"*. Never *"I have
kept this light for forty years"*, never *"we"*, never a name, never a mood.

The reason is accessibility, not style. A screen-reader user is handed the dialog's accessible name — "Peggy's
Point Lighthouse" — and then your prose. If the prose is in the first person, you have told that user a
person is standing there. On the two levels above, that is precisely the thing the art was drawn to avoid,
arriving through the words instead of the picture.

A landmark line therefore also carries **no `expression`**. A plaque has no face and no mood; `"expression":
"happy"` on one is a request for a rig that does not exist, and the gate below rejects it.

## Two things to know before you write a quest

- **The lines belong to the quest, not to the character.** One guide gives quests on several levels, so a
  single "reminder" line stored against the guide would be one sentence serving three different journeys —
  and reminders name a destination. Write the line into the quest that means it.
- **A giver and a speaker must be something the level actually places, and exactly one thing.** This *is*
  checked now, by `tests/unit/contracts/a-quest-giver-is-placed-on-its-level.test.ts`, which runs in
  `make test`. It fails when:
  - `giver` or a `speaker` matches **nothing** on the level — a typo, and it used to pass validation and
    produce a line nobody says;
  - it matches **two** things — a character and a POI sharing an id — because then nobody can say which one
    is talking;
  - the placement it matches does not carry `questId` pointing back at your quest;
  - a landmark speaker carries an `expression`;
  - the level does not list your quest in its `quests[]`, or lists one that does not exist.

  So: when you add a quest, you edit **two** files. The quest document, and the level document that places
  its giver.

## Instructions are not claims, and that is the useful distinction

The dividing line that trips people up is not "is this on a question card". It is:

> Could a player repeat this sentence in the citizenship test?

"Tap the door to go in" — no. "Ottawa is Canada's capital" — yes, and it needs a source and a verifier, in an
NPC's mouth exactly as on a card.

The reasoning is [ADR-0003](../adr/ADR-0003-content-verification.md) ("What is verified") and
[ADR-0010](../adr/ADR-0010-where-player-facing-text-lives.md). Who may offer a quest, and why a plaque may,
is [ADR-0029](../adr/ADR-0029-a-quest-is-offered-by-an-engageable-not-by-a-person.md).
