---
description: Run a full delivery slice end to end (plan, dispatch, verify, review, commit)
argument-hint: <slice-number-or-name>
---
Run slice **$1** of TrueNorth as orchestrator. Do not write feature code yourself.

1. Read `docs/plan/slices.md` and `docs/plan/slice-$1.md`. If the slice file is missing, write it first:
   tasks, owning agent per task, acceptance criteria, status column.
2. If the slice introduces a decision or a new surface, dispatch `po` and `architect` first and wait for them.
3. Fan out independent tasks in parallel (typically `domain` + `art` + `infra`, then `engine` + `ui-a11y`
   once the ports exist). Serialise anything that touches the same file — if two agents need the same file,
   that is a boundary defect: send it to `architect`, do not merge by hand.
4. Each agent works test-first and reports a summary and diff stat, not file contents.
5. Run the gates yourself — never take an agent's word:
   `make lint typecheck test test-e2e test-perf test-a11y validate-content verify-content verify-art`
6. Dispatch `reviewer` on the diff. Send findings back to the owning agent, not into your own edits.
7. On green: commit (imperative subject ≤ 72 chars, no attribution trailers), update `slice-$1.md` status,
   push, confirm the Pages deploy, then update `docs/plan/slices.md`.
8. Compact context. The plan file carries state to the next slice, not this transcript.
