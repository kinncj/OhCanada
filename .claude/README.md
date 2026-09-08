# The agent harness

This directory is the delivery harness, not application code. `CLAUDE.md` at the repo root is the
working agreement; every agent loads it. `agents/` holds the scoped roles, `commands/` the slash
commands, `settings.json` the permission rules.

## Roles and why they are separated

Most separations here are ergonomic — an agent with a narrow brief writes better code. Two are not,
and must not be relaxed without an ADR:

- **`content-author` cannot write a `verification` block.** An author that can mark its own work
  verified is not a verifier, and `verification.status = "verified"` is the claim the whole content
  pipeline rests on.
- **`content-verifier` cannot edit question text.** A verifier that can rewrite the question until it
  matches the source is not checking anything.
- **`art-verifier` must identify a render before it sees the filename or label.** Blind identification
  is the entire test; a verifier told "this is the Peace Tower" will agree.

`reviewer` has read-only tools by design. Review findings go back to the owning agent, never to the
reviewer's own edits and never to the orchestrator's.

## What the permission rules actually do

`ask` covers the things that are hard to undo or that carry authority: pushing, touching questions,
and editing the agreement or the permission rules themselves. An agent that can rewrite `CLAUDE.md`
or `settings.json` has no constraints at all, only the appearance of them.

`deny` covers file reads that genuinely cannot be reached another way — secrets and private keys.

**It does not, and cannot, restrict network egress.** An earlier version of this file carried
`Bash(curl:* -X POST*)` and two siblings. They were decorative: `curl --request POST`, `curl -d`,
`wget --post-data` and `node -e 'fetch(...)'` all sail straight past them. They were removed rather
than extended, because a rule that reads as a control and is not one is worse than no rule — it
invites people to rely on it. A deny list cannot enumerate exfiltration; if egress must be
restricted, that is a sandbox or a network policy, not a glob.

The same honesty applies to `Bash(make:*)` and `Bash(npm run:*)`: both are allowed while `Makefile`
and `package.json` are freely editable, so they are effectively unrestricted. They are here because
they make the common path fast, not because they contain anything.

## Pinned versions

`.mcp.json` pins `@playwright/mcp` exactly, like every dependency in `package.json`. `@latest` would
install and execute whatever was published the moment a session started — the least reproducible and
highest-trust line in the tree.
