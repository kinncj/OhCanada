# Who writes what: the author and the verifier

You will meet this rule whether or not you read about it first, so here it is first.

**The person who writes a question may never be the person who marks it verified.** That is not a comment on
your work, and it is not a probation period for new contributors. It applies to everyone, including the
maintainer, including the agents that write most of this repository, and there is no route around it.

## Why

A question marked verified by the person who wrote it carries no information at all.

The author already believed the answer was right — that is why they wrote it. Their "verified" restates the
belief that produced the error, so it cannot catch the error. The only thing worth anything is a second
reader going to the source, finding the passage, and quoting it. Anyone can then open the file and check
that quote against the guide themselves, years later, without trusting either of us.

That is what `verification.evidence` is for. A status with no quoted passage is an assertion, and this
project does not accept assertions.

The full reasoning, including the four statuses and the five checks, is
[ADR-0003](../adr/ADR-0003-content-verification.md). Where that document and this page disagree, it wins.

## What that means for your pull request

**Write the `source` block. Leave the `verification` block in the empty form.** Exactly this, with no
fields removed and none added:

```json
  "verification": {
    "status": "unverified",
    "model": "",
    "checkedAt": null,
    "sourceHash": "",
    "evidence": ""
  }
```

The schema refuses every other empty shape — a missing field, a `null` where an empty string belongs, a
`status` of `unverified` with a date filled in. That precision is not fussiness: it is what lets the
history check below be one sentence instead of a table of exceptions.

Do not edit anyone else's `verification` block either, including to fix a typo in it. If one is wrong, say so
in the pull request description.

## The check reads git history, and this is where people get stuck

`node scripts/verify-content.mjs` inspects the commits that touched `content/`, and enforces:

> **Within one document, one commit may not do both jobs.**

A commit that changes any author-owned field of a question — the prompt, an option, the explanation, the
source block, the ids — may not, in that same commit and that same file, also write or change the
verification block. A newly added file may introduce the block in the empty form above, because the schema
requires the block to exist and that is the only shape an author may write.

Two consequences that look like bugs and are not:

- **Moving a question between subject folders needs two commits.** The gate diffs without rename detection,
  so a move reads as a delete plus an add — and an add that carries an already-granted block is a grant
  inside a commit that also authors the file. Move the file with the verification block reset to the empty
  form, then restore the grants in the following commit. That is the sanctioned remedy, and it is recorded
  in the history of this repository being used exactly that way.
- **Editing a verified question un-verifies it.** Correctly. The status was granted for a specific wording
  against a specific text; change the wording and the grant no longer describes what is there. Reset it to
  the empty form in your commit and let it be re-granted.

### What the check honestly cannot see

Said plainly, because a gate that overstates itself is worse than no gate:

This repository cannot establish *who* authored a commit. Every commit carries one identity and no
signature, and the project forbids attribution trailers, so nothing in git separates an author's commit from
a verifier's. The gate therefore enforces the checkable consequence — one commit, one job — rather than the
rule as worded. One person making two commits in the right order is indistinguishable from two people. The
cost of doing the wrong thing goes from zero to "you must split it into two commits", which is real and is
not the same as impossible. `scripts/verify-content.mjs` says so in its own output on every run.

## The four statuses, and what each one asks of you

| Status | What happened | What you do |
|---|---|---|
| `unverified` | you wrote it; nobody has checked it | nothing — wait |
| `verified` | a verifier found the passage, checked the answer, each distractor, the French and the wording | nothing; it ships |
| `rejected` | the verifier judged it wrong | fix it, or argue for it in the pull request |
| `quarantined` | it was verified, and the source moved or the check aged past 180 days | nothing — this one goes back to a verifier, not to you |

Both `rejected` and `quarantined` drop out of the build. Neither is a black mark. A rejection with a clear
reason is the system working; the alternative is a wrong answer in front of a learner.

**One honest gap.** The file format has nowhere to record *why* a question was rejected — a rejected block
carries the status and the evidence and no reason. Today the reason lives in the commit message or the pull
request conversation. If your question comes back rejected and you cannot tell why from either, ask; that is
a gap in our tooling, not a failure of yours to read carefully.

## The one thing no gate can enforce

There is a second, stricter version of this rule for cultural review: **no agent may grant cultural sign-off,
ever, for any reason.** A schema constrains a value, not who wrote it, so that rule is held by people rather
than by a check — and the gate currently refuses *every* transition, which means a genuine human sign-off
cannot be recorded yet. That is a known, deliberate closed door with work scheduled against it. See
[`indigenous-content.md`](indigenous-content.md).
