# Add a question

This is the whole path, in order. Budget an hour for your first one; the second takes ten minutes.

If you would rather not touch files at all, **write the question in an issue** and someone will land it for
you. That is a normal way to contribute here, not a lesser one.

## 1. Find the fact in *Discover Canada*, and note where it is

Everything in the game comes from the official IRCC study guide, *Discover Canada*
([canada.ca](https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/discover-canada.html)).
Not from general knowledge, not from Wikipedia, not from a news story — the exam is drawn from that
document, so a question sourced elsewhere is testing something the exam does not ask.

Write down four things before you write the question:

- the **chapter heading**, exactly as it appears in the guide (for example, `Federal Elections`);
- the **page** the claim is on;
- the **passage** you read it from, copied exactly, punctuation and all;
- whether this fact **can change without notice** — a count, a date, an office holder, a name.

That last one matters more than it looks. Read
[`when-the-guide-is-out-of-date.md`](when-the-guide-is-out-of-date.md) before you go further, because the
best question in the world is unusable if its answer is a number that has since moved.

## 2. Check nobody has asked it already

    grep -ril "electoral district" content/questions/

Near-duplicates are not forbidden, but two questions that grade the same sentence crowd out a fact nobody
has covered yet.

## 3. Write the question

One file, `content/questions/<subject>/<your-id>.json`. Copy the nearest existing question and edit it —
that is faster than starting from the schema, and [`anatomy-of-a-question.md`](anatomy-of-a-question.md)
walks through a real one field by field.

The subject folders that exist are the directories under `content/questions/`. The id is lower-case with
hyphens, unique, and describes the question rather than numbering it: `gov-40-who-may-vote`, not `q40`.

What the build will hold you to:

- **Exactly four options.** One correct, three wrong. `correctIndex` says which, counting from 0.
- **Every wrong option must be genuinely wrong** — not "also supported by the guide but less good". The
  verifier checks each of the three separately, and a defensible second answer is a rejection.
- **English and French for the prompt, all four options and the explanation.** Both, in the same file.
  See [`both-languages.md`](both-languages.md).
- **Your own words.** A shared run of 14 or more consecutive words with the guide fails the build. Institutional
  names are fine — "the House of Commons" has no paraphrase — but a lifted sentence is not.
- **Plain language**, roughly grade 6. Our players are learning English or French while learning this
  material. Short sentences, common words, no idioms, no jokes that depend on knowing Canada already.
- **An explanation that teaches**, not one that repeats the answer. Say why it is right, and where possible
  why the tempting wrong answer is tempting.
- **Nothing the source does not say.** Not a correction, not extra context, however well meant. See
  [`indigenous-content.md`](indigenous-content.md) for the case where this rule bites hardest, and for a
  real example of one sentence holding a question up.

## 4. Leave the verification block empty

This is the rule people trip over, so it gets its own step.

You write the `source` block. You do **not** write the `verification` block. Copy it in exactly like this,
character for character:

```json
  "verification": {
    "status": "unverified",
    "model": "",
    "checkedAt": null,
    "sourceHash": "",
    "evidence": ""
  }
```

That is the only shape an author may write, and it is enforced twice: the schema refuses any other empty
form, and a separate check reads git history and fails when one commit both writes a question and grants its
verification. Sending an unverified question is not an unfinished contribution — it is the finished one.
[`who-writes-what.md`](who-writes-what.md) explains why, and it is worth two minutes.

You will need one value that looks like it belongs to the verifier: `source.sourceHash`. It is not. It is
the hash of the source *you* read, and you can copy it from any other question citing the same source, or
from `extractedTextSha256` in `content/sources/discover-canada.json`.

## 5. Run the checks

    make validate-content
    node scripts/verify-content.mjs

[`running-the-checks.md`](running-the-checks.md) explains what each one covers, what a red run is telling
you, and which failures are not yours to fix.

## 6. Open the pull request

- One commit, imperative subject, 72 characters or fewer: `Add four questions on how a bill becomes law`.
- No attribution trailers of any kind.
- In the body, say which chapter and pages you worked from, and anything you were unsure about. "I could
  not tell whether option C is also defensible" is useful information, not a weakness.
- Do not touch a `verification` block in the same pull request — not yours, and not anyone else's.

Then a verifier goes to the source independently, finds the passage that entails your answer, checks that
none of your three distractors is also supported, checks the French, checks you did not copy, and either
grants the question or sends it back with what was wrong.

## The short checklist

- [ ] The fact is in *Discover Canada*, and I have the chapter, the page and the exact passage.
- [ ] The answer does not depend on a number, a date, a name or a count that could have changed.
- [ ] Four options, one right, three clearly wrong.
- [ ] EN and FR for every player-facing string, and the French is French rather than translated English.
- [ ] Nothing copied; the wording is mine.
- [ ] Nothing asserted that the source does not say.
- [ ] `verification` is the empty block above, untouched.
- [ ] `make validate-content` and `node scripts/verify-content.mjs` both pass.
