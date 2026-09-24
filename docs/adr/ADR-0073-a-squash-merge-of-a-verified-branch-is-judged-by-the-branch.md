# ADR-0073: A squash-merge of a verified branch is judged by the branch

- Status: Accepted (2026-09-24). The fix was chosen by the owner's coordinator: no history rewrite on
  `main`, and a gate that recognises a recorded squash-merge by evidence, not by trust.
- **Amends ADR-0003's gate** (`verify-content` gate A, separation of duties). The rule itself does not
  change: within one document, one commit may not both author a claim and grant its verification. What
  changes is which commits the gate reads when `main` holds a squash of a branch that already passed it.
- Numbering. `git log --all --name-only -- docs/adr`, over every ref this checkout can see after fetching
  `main` and `claude/fervent-dijkstra-vxyz3k`, puts the high-water mark at 0072. **0073 is the first number
  above the mark.**

## Context

PR #138 ("Teach the whole guide before asking, and discharge the near-term obligations") was
squash-merged into `main` as `8f25a49272319e3712d548c093641a7580ef6de7`. On its branch, author commits
and verifier commits were separate. Its head, `308a171beb8dd2515ae1cee67a311af3f6d0a273`, passed every CI
gate, `make verify-content` included.

The squash folded 20 content commits into one. That one commit authors claims and grants them, which is
exactly what gate A exists to refuse. Measured on `main` at `8f25a4927` before this change:

```
verify-content: 497 failure(s).
```

Every one of the 497 names `8f25a4927`. The `static` job in `deploy-pages.yml` runs `make verify-content`,
so `main` went red and nothing deployed.

The findings are true of the squash and false of the work. Gate A reads commits. A squash throws away the
only record it reads, the order in which the two jobs were done.

Three ways out were considered:

- **Rewrite `main`** to replace the squash with the branch's commits. Refused. It rewrites a published
  branch that others build on. It also breaks the link between the deploy record and what `main` says was
  deployed.
- **Exempt the commit by listing it.** Refused. A list that turns off the gate for a commit is trust, not
  evidence. Nothing would stop the same list from exempting a commit that really did both jobs.
- **Judge the squash by the branch, on evidence.** Chosen. See the decision.

## Decision

### 1. The record

`scripts/content-squash-merges.json` records a squash-merge. Each entry has exactly five keys, all
required, and no others:

| key | what it is |
|---|---|
| `commit` | the squash commit on `main`, as a full sha |
| `head` | the pre-squash PR head it came from, as a full sha |
| `branch` | the PR's branch, so a failure can say what to fetch |
| `pr` | the PR number |
| `reason` | one line, at most 200 characters |

`verify-content` checks the shape strictly: unknown keys, missing keys, short shas and a repeated commit are
all failures. A malformed record exempts nothing.

### 2. The evidence rule

A listed squash is not judged as one commit. The head's commits are judged in its place, **only if every
check below holds**. If any check fails, the run fails and says which one. The squash is then also judged as
the single commit it is.

1. The squash exists, has exactly one parent, and its subject carries the recorded `(#N)`.
2. The head exists **locally**. The gate never fetches. When the head is missing, the gate names the fetch
   to run: `git fetch origin <branch>`, `git fetch origin <sha>` or `git fetch origin refs/pull/<N>/head`.
3. The head is not already an ancestor of the squash. If it were, its commits would already be in the walk.
4. `git diff --quiet <head> <squash> -- content` holds. The squash landed exactly the content the head
   carried. The head's history is evidence only for the bytes the head carries.
5. `<squash>^1..<head> --no-merges -- content` is not empty. Those commits then go through **every** rule,
   A0 to A4, in the order `git log --reverse` gives them. That is exactly how the gate would have read the PR
   if it had been merged with a merge commit.

`<squash>^1..<head>` is used instead of `merge-base(<squash>^1, <head>)..<head>`. The two give the same set
when the merge base is unique. When it is not, only the first can be sure never to replay a commit the walk
has already judged as an ancestor of the squash's parent.

### 3. A4 stays consistent

A4 binds each grant to its claim's authored fields as they were when the grant was written. At HEAD, A4
checks that those fields have not moved since. It is a state machine over the walk. Substituting the head's
commits for the squash is correct for that state machine with one addition:

- After the replay, every document that the head's commits or the squash touched is **recorded again at
  the squash, and no grant is rebound**. Each grant stays bound to the branch commit that wrote it. A4 then
  compares the grant with the claim as `main` actually holds it.

The addition matters because `--no-merges` hides what a merge commit on the branch did. PR #138's head is
itself a merge of `origin/main`, and its branch holds many merges. Without the re-record, a claim reworded
inside a merge would still be compared with the text it was granted on, and A4 would pass it. The fixture
"keeps A4 across a merge commit on the branch that the replay cannot see" proves the step matters: it fails
when the step is removed.

### 4. The convention

**Content PRs merge with a merge commit, not a squash.** A merge commit keeps the branch's commits
reachable from `main`, and gate A already reads them there. The convention is written in `CONTRIBUTING.md`,
in `docs/runbook.md` §2 and in the Content checklist of `.github/PULL_REQUEST_TEMPLATE.md`.

**The record is for incidents only.** It is never a routine path. An entry means the convention was
missed once and the evidence above was checked instead. A PR that adds an entry says in its description
which merge went wrong and why rewriting was refused.

### 5. CI can see the head

Both `static` jobs (`ci.yml`, `deploy-pages.yml`) check out with `fetch-depth: 0`. With that setting,
`actions/checkout` fetches all history for every branch and tag, so a recorded head is present while its
branch exists. A merged PR's branch may be deleted, and checkout does not fetch `refs/pull/*`. So
`make verify-content` now depends on `make squash-heads` (`scripts/fetch-squash-heads.mjs`). For each
recorded head that is missing, it tries `git fetch origin <sha>`, then `refs/pull/<N>/head`, then the
branch. A head that is already present costs nothing and needs no network. On 2026-09-24,
`git ls-remote origin` showed `308a171` as the tip of both `refs/heads/claude/fervent-dijkstra-vxyz3k` and
`refs/pull/138/head`.

## Consequences

- `main`'s real history passes again: `verify-content: recorded squash (ADR-0073) — 8f25a4927 (PR #138)
  judged by 20 commit(s) of its head 308a171be; content/ identical`, then `verify-content: OK.`
- The gate still fails each of these, and each has a fixture in
  `tests/unit/infra/verify-content-gate.test.ts`:
  - an unrecorded squash of a properly separated branch (the incident);
  - an unlisted commit that does both jobs, next to a valid record;
  - a recorded squash whose content differs from its head;
  - a recorded squash whose head's own commits do both jobs;
  - a recorded head that is not in the clone;
  - a malformed record, and a record whose PR number the squash subject does not carry;
  - a grant from the branch whose claim is edited later on `main` (A4 across the replay);
  - a grant whose claim is reworded inside a merge commit on the branch (A4 across a merge).
- What the gate proves is unchanged in strength. ADR-0003's 2026-09-20 amendment still holds: the gate
  shows that no single commit did both jobs, not that two parties were involved. The record does not
  weaken that. It moves the question from the squash to the commits the squash came from, and it makes
  sure they carry the same bytes.
- The record trusts one thing: that the listed head is the PR that was squashed. The subject's `(#N)` and
  the identical `content/` tree are what bind the two. A wrong head with identical content and cleanly
  separated commits would pass. But it would then be a separated history of those exact bytes, which is the
  property the gate asks for.

## References

- ADR-0003: the separation of duties, and its 2026-09-20 amendment on what the gate can establish.
- ADR-0009: obligations. This record opens none.
- `scripts/verify-content.mjs`: the header section "A RECORDED SQUASH-MERGE IS JUDGED BY THE BRANCH IT
  CAME FROM", and `expandSquash` in the history gate.
- `scripts/content-squash-merges.json`, `scripts/fetch-squash-heads.mjs`, and the `squash-heads` target
  in the `Makefile`.
