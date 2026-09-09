# When the guide is out of date

**If you read one page in this directory, read this one.**

*Discover Canada* is the document the citizenship exam is drawn from. It is also, in specific places, no
longer true. Those two facts together are the hardest problem in this project, and most rejected questions
are rejected because of it.

## Two real examples

**The G8.** Page 90 of the cached guide lists Russia among the G8 industrialised countries. Russia was
suspended in March 2014 and the group has met as the G7 ever since. We confirmed against the live
canada.ca page on 2026-09-09: eleven years on, it still names Russia.

**O Canada.** Page 84 prints "True patriot love in all thy sons command". Bill C-210 received royal assent
on 7 February 2018 and replaced that line with "in all of us command". The live page, modified four months
before we checked it, still prints the old line.

Now imagine a question built on either one. A learner who follows the news knows there are seven, and knows
the anthem changed. Our game tells them they are wrong. We have taken somebody studying for a citizenship
test and taught them a falsehood, using the authority of the official guide to do it.

That is the failure mode this whole section exists to prevent.

## The register

Everything we know about how a source is wrong is written down in `content/sources/<id>.json` — for the
guide, `content/sources/discover-canada.json`. **Read its `knownStaleness` list before you write anything.**
It is plain JSON and it is written to be read by people.

Each entry names a topic, states the problem, lists the chapters and pages it touches, and — the part that
does the work — lists `bannedFromAnswers`: terms that may not appear in any option or explanation of a
question drawn from that region. The G8 entry bans this:

```json
"bannedFromAnswers": ["G8", "G7", "Russia", "Russie"]
```

Note that **G7 is banned beside G8**. An option naming the G7 is right about the world and wrong about the
document the exam is drawn from, so no answer may rest on the group's name in either direction. The anthem
entry does the same thing: both "thy sons" and "all of us command" are banned. When the source and reality
disagree, we do not pick a side in an answer. We ask about something else.

The check is mechanical, case-insensitive, whole-word, and it runs over English and French. It looks at
**options and explanations, not prompts** — a question may legitimately *ask* about a stale topic; what may
not happen is a player being told a stale value is true.

## What to do instead: ask about the character of a fact, not its magnitude

This is the technique, and it is worth learning properly, because it converts most unusable questions into
good ones.

| Do not ask | Ask instead |
|---|---|
| How many nations are in the Commonwealth? | What is the Commonwealth, and what does Canada's membership in it mean? |
| How many seats are in the House of Commons? | What does a member of Parliament represent? |
| Who is the Sovereign? | What is the Sovereign's role in Canada's system of government? |
| Which countries are in the G8? | What kind of economy does Canada have? |
| What are the words of the anthem's fourth line? | When was *O Canada* proclaimed the national anthem? |

The rule of thumb: **an ordinal outlives a cardinal, and a role outlives its holder.** "The first Prime
Minister of Canada" is permanent. "The current Prime Minister" is a maintenance burden with an expiry date.
"The three parts of Parliament" is structure. "The number of seats" is a census of a moment.

The two facts flanking the anthem lyric on page 84 — proclaimed in 1980, first sung in Québec City in 1880
— cannot move, and they are what the shipped questions grade. That is the pattern to copy.

## The `volatile` flag, and what it does and does not mean

`source.volatile` means one thing: **this fact can change without notice.** It is your judgement about the
fact. It says nothing about whether anyone will tell us when it changes.

That second question — will the source be corrected? — belongs to the source, not to your question, and it
lives in the register as `upstream`. This matters because of something we discovered the hard way and wrote
up in [ADR-0016](../adr/ADR-0016-an-unrevised-source-is-a-different-problem-from-a-stale-cache.md): for a
document nobody is revising, re-fetching the page cannot fix a stale fact. There is nothing to fetch. A
re-check that structurally cannot produce a finding is worse than no re-check, because it produces a fresh
date on every question and a bank that reads as actively maintained.

So the mitigation that actually works is not the clock. It is that **no shipped answer depends on the stale
fact at all**, checked on every build. That is `bannedFromAnswers`, and it is why the table above is the
core skill rather than a style preference.

Mark `volatile: true` when the fact can move. Over-marking is not a fault and never has been. Under-marking
is how a wrong answer ships.

## What the checks cannot do for you

Stated plainly so their silence is not mistaken for approval:

- **Nothing can tell that a staleness flag is missing.** The gate binds a recorded flag to the questions
  under it. Noticing that some *other* part of the guide has quietly gone out of date is human judgement,
  and it is one of the most valuable things a contributor can bring. If you spot one, open an issue — that
  is a finding, not a nuisance.
- **A banned-term list cannot be checked for completeness.** A stale fact nobody thought to ban is unbanned.
- **`asOf` and a matching hash prove that the text has not moved.** They prove nothing about whether it was
  ever right.

## If you think a flag should exist

Open an issue with: the page, the sentence in the guide, what is actually true now, and a link that shows
it. You do not need to write the register entry. Say what you found; the shape is ours to fill in.

A term list that over-fires and fails a build is a nuisance we fix in the register. A term list that
under-fires ships a wrong fact to somebody studying for a citizenship test. We would much rather have the
first problem, so err towards telling us.
