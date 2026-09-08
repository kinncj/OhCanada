# ADR-0003: Agentic content verification

- Status: Accepted (2026-09-08)
- Amended 2026-09-08: the Decision listed `evidence` among the five fields the verifier writes, but the
  CI clause below did not gate it. That omission is how `QuestionVerification` in
  `app/application/ports/content-repository.ts` was able to drop the field entirely without any gate
  noticing. The CI clause now names it.

## Context
The game teaches facts people are tested on for citizenship. A wrong answer in the bank is worse than a
missing one. There is no human review gate in this project, so correctness has to be mechanical and auditable.

## Decision
Two **separate agents with no shared context**:
- `content-author` writes questions, quests and locale strings. It can never write a `verification` block.
- `content-verifier` writes *only* the `verification` block. It cannot edit question text, quests or code.

For each question the verifier fetches the cited *Discover Canada* section from canada.ca (cached and hashed
under `content/sources/`) and must:
1. quote the supporting passage as `evidence`;
2. confirm the answer is entailed by it;
3. confirm each of the three distractors is not entailed;
4. confirm the French is a faithful translation;
5. confirm the wording is not verbatim (n-gram check).

All five pass → `status: "verified"` with `model`, `checkedAt`, `sourceHash`, `evidence`. Any failure →
`status: "quarantined"`, excluded from the build. `volatile` items are re-verified every run and quarantined
when the source hash changes or `asOf` exceeds 180 days.

CI fails if any shipped question lacks `verified` for the current `sourceHash`, has fewer than three
distractors, is missing EN or FR text, matches the source verbatim, or carries `status: "verified"` with
an empty `evidence`. The last of those is what keeps the auditability consequence below honest: a status
with no quoted passage is an assertion, and this ADR does not accept assertions.

## Alternatives considered
- **One agent authoring and verifying** — rejected: a model that wrote an answer is the worst judge of it.
- **Human review gate** — rejected for this project: no reviewer exists, and a gate nobody staffs is a lie.
- **Trust the model, spot-check** — rejected: silent errors are the failure mode that matters here.

## Consequences
- Adding a question is cheap; shipping an unverified one is impossible.
- Community corrections arrive as issues and pass through the same verifier, so the bar does not drop for them.
- The bank is auditable: every shipped question carries the passage that supports it.
