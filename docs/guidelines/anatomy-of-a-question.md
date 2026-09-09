# Anatomy of a question

This is a real file from the repository, `content/questions/elections/gov-40-who-may-vote.json`, with every
field explained. Nothing here is invented for the example. Open the file yourself and read along.

```json
{
  "$schema": "../../schemas/question.schema.json",
  "id": "gov-40-who-may-vote",
  "subject": "elections",
  "prompt": {
    "en": "Who may vote in a federal election?",
    "fr": "Qui peut voter à une élection fédérale?"
  },
  "options": [
    { "en": "Any permanent resident aged 18 or older.", "fr": "Tout résident permanent âgé de 18 ans ou plus." },
    { "en": "Anyone who has lived in Canada for five years.", "fr": "Toute personne qui vit au Canada depuis cinq ans." },
    { "en": "A Canadian citizen who is at least 18 on voting day and is on the voters' list.", "fr": "Un citoyen canadien âgé d'au moins 18 ans le jour du scrutin et inscrit sur la liste électorale." },
    { "en": "Any Canadian citizen aged 16 or older.", "fr": "Tout citoyen canadien âgé de 16 ans ou plus." }
  ],
  "correctIndex": 2,
  "explanation": {
    "en": "All three conditions must be met, and citizenship is the one people miss. Permanent residents live in Canada and pay taxes here, but they cannot vote federally until they become citizens.",
    "fr": "Les trois conditions doivent être remplies, et c'est la citoyenneté qu'on oublie le plus souvent. Les résidents permanents vivent au Canada et y paient des impôts, mais ils ne peuvent pas voter au fédéral avant d'obtenir la citoyenneté."
  },
  "source": {
    "sourceId": "discover-canada",
    "chapter": "Federal Elections",
    "page": 61,
    "url": "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/discover-canada.html",
    "sourceHash": "fd51046981916115cc39b989e9eedd3ab2c5943aeb7e0fe4e237e13a0da7c836",
    "asOf": "2026-09-08T00:00:00Z",
    "volatile": false,
    "quote": "You are eligible to vote in a federal election or cast a ballot in a federal referendum if you are: • a Canadian citizen; and • at least 18 years old on voting day; and • on the voters' list."
  },
  "verification": {
    "status": "verified",
    "model": "claude-opus-5[1m]",
    "checkedAt": "2026-09-08T19:41:25Z",
    "sourceHash": "fd51046981916115cc39b989e9eedd3ab2c5943aeb7e0fe4e237e13a0da7c836",
    "evidence": "One of the privileges of Canadian citizenship is the right to vote. You are eligible to vote in a federal election or cast a ballot in a federal referendum if you are: a Canadian citizen; and at least 18 years old on voting day; and on the voters' list."
  }
}
```

## The identity fields

**`$schema`** — the rules this file is checked against, as a relative path. Every content file declares one.
Without it the file is not validated at all, so `make validate-content` refuses a file that omits it.

**`id`** — lower-case, hyphenated, unique, stable. Note that this id begins `gov-` while the file sits under
`elections/`: the question was written when the two subjects were one bank, and ids do not get rewritten
when a file moves, because other records point at them. Match the folder in a new id; do not "fix" an old one.

**`subject`** — the bank this belongs to, and it must match the folder. A level teaches one subject and draws
its questions from that folder. A subject needs at least 30 verified questions before the level that teaches
it can ship, which is why "one more good question" is always worth sending.

## The part the player sees

**`prompt`, `options`, `explanation`** — each is an object with `en` and `fr`, both required and both
non-empty. There is no translation file and no key table: a question carries its own words, in both
languages, in one file. That is a deliberate decision
([ADR-0010](../adr/ADR-0010-where-player-facing-text-lives.md)) with two reasons — the verifier reads one
document instead of joining three, and a question withdrawn from the build takes its text out with it.

**`options`** is exactly four, and it is a fixed list rather than a bounded one: the schema will refuse
three and refuse five. **`correctIndex`** is `2` here, which means the third option. Counting starts at 0.
Do not shuffle the options to hide the answer; the game shuffles them at play time from a seed.

Look at what the three wrong options do. Each is a *plausible misunderstanding* — permanent residence
mistaken for citizenship, a residency period mistaken for eligibility, the voting age mistaken for 16. None
of them is a fact from a different part of the guide, and none is defensible as a second right answer. That
is the standard: wrong, and wrong for a reason a learner will recognise afterwards.

The **`explanation`** does not restate the option. It names the mistake ("citizenship is the one people
miss") and gives the learner something to hold on to. It also stops short of anything the guide does not
say.

## The source block — the author's half

Written by whoever writes the question. It answers: where did you read this?

**`sourceId`** — which cached document, by the `id` of a file in `content/sources/`. A chapter title and a
hash on their own point at nothing; this is what lets a gate go and read that document's record of what is
known to be wrong in it.

**`chapter`** — must match one of the chapter titles the source register lists, exactly. A typo fails the
build with the list of valid titles.

**`page`** — where the claim is. Checked against the chapter's page range, and it is what allows a "this
page is out of date" flag to apply to three questions instead of all forty in the chapter.

**`url`** — the public page a reader can go and check for themselves.

**`sourceHash`** — the SHA-256 of the exact text that was read. If the source changes under us, this stops
matching and every question granted against it falls out of the build rather than being left quietly wrong.
Copy it from a neighbouring question or from the source register; you are not expected to compute it.

**`asOf`** — when the source was fetched. It starts a 180-day clock on facts that can move.

**`volatile`** — *can this fact change without notice?* It is a judgement about the **fact**, not about the
source and not about how confident you are. A count of member states is volatile; how a bill becomes law is
not. Marking something volatile that turns out to be stable is not a fault. The reverse can ship a wrong
answer, so when in doubt, mark it.

**`quote`** — the passage you read the claim from, copied exactly, bullets and all. It must appear
word-for-word in the cached source, which is a check that catches an invented citation *before any human or
agent verifies anything*. Copy and paste it; do not retype it from memory.

## The verification block — the other half

**Written only by a verifier, and never by the person who wrote the question.** If you are adding a
question, this block is the empty form shown in [`add-a-question.md`](add-a-question.md) and nothing else.

**`status`** is one of four:

| Status | Meaning | Whose move is next |
|---|---|---|
| `unverified` | nobody has checked it | the verifier's |
| `verified` | every check passed, for this exact `sourceHash` | nobody's; it ships |
| `rejected` | the verifier judged it wrong | the author's |
| `quarantined` | it was verified, and something invalidated that later — the source moved, or the check aged out | the verifier's |

`rejected` and `quarantined` are both excluded from the build. They are separate values because they wake
different people.

**`model`, `checkedAt`, `sourceHash`** — who granted it, when, and against which bytes. A `sourceHash` here
that differs from the one in `source` means the status was granted against a different text, and the
question stops shipping.

**`evidence`** — the passage the verifier found that entails the answer.

## The two quotes, which are not the same quote

This is the single most-misunderstood field pair in the repository, so compare them in the file above.

- `source.quote` starts at "You are eligible to vote..." — it is where the **wording** came from.
- `verification.evidence` starts a sentence earlier, at "One of the privileges of Canadian citizenship is
  the right to vote." — it is what **entails the answer**, and specifically what rules out the permanent
  resident distractor.

They are different sentences because they answer different questions. Copying one into the other collapses
the check into a restatement of the thing being checked: the verifier would be confirming that the author's
quote says what the author said it says, which nobody ever doubted. Across the current bank the two differ
in the large majority of questions, and where they genuinely coincide that is recorded as coinciding rather
than padded to look independent.

## A second example: the volatile flag

`content/questions/elections/elec-03-another-name-for-a-riding.json` asks which word also means an electoral
district. The answer — "a riding" — cannot go out of date. It is nonetheless marked `"volatile": true`,
because it is drawn from a page carrying facts that *can* move, and over-marking is explicitly not a fault.
It costs a re-check. Under-marking costs a learner the exam.
