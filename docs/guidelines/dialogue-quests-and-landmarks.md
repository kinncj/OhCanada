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
| `id`, `levelId`, `giver` | which quest, on which level, from which character |
| `title`, `summary` | shown in the tracker; both languages |
| `steps` | the objectives, in order |
| `declinedLine`, `reminderLine`, `afterLine`, `doneLine` | what the giver says when you refuse, when you come back, after the objective, and at the end |

A step has a `kind` — `talk`, `visit`, `collect` or `answer` — a `targetId`, and a `prompt` telling the
player what to do. An `answer` step names a `subject` and a `count`: **the quest says how many questions,
never which ones.** Choosing which questions to ask belongs to the scheduler, from the player's own review
history. A quest that listed ids would make the scheduler decorative.

Those four giver lines each carry a full dialogue line, including the `fact` block, for the reason above:
"Parliament Hill is that way, keep going" is flavour, and the next sentence somebody writes might not be.

## Two things to know before you write a quest

- **The lines belong to the quest, not to the character.** One guide gives quests on several levels, so a
  single "reminder" line stored against the guide would be one sentence serving three different journeys —
  and reminders name a destination. Write the line into the quest that means it.
- **Only a character the level actually places may speak.** A check for this is specified but not yet
  written, so today a typo in `speaker` will pass validation and produce a line nobody says. Check the
  level document yourself.

## Instructions are not claims, and that is the useful distinction

The dividing line that trips people up is not "is this on a question card". It is:

> Could a player repeat this sentence in the citizenship test?

"Tap the door to go in" — no. "Ottawa is Canada's capital" — yes, and it needs a source and a verifier, in an
NPC's mouth exactly as on a card.

The reasoning is [ADR-0003](../adr/ADR-0003-content-verification.md) ("What is verified") and
[ADR-0010](../adr/ADR-0010-where-player-facing-text-lives.md).
