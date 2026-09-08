---
description: Scaffold an architecture decision record
argument-hint: <title>
---
Dispatch the `architect` agent to write a new ADR titled "$1".

Number it sequentially after the highest existing file in `docs/adr/`. Structure: Context, Decision,
Alternatives considered (each with why not), Consequences. State the decision in the present tense as a
commitment, not a suggestion. If it supersedes an earlier ADR, mark that one superseded and link both ways.
Then update `CLAUDE.md`'s decisions table if the decision changes anything listed there.
