# infra/

Infrastructure that is not the web app: packaging, native shells, deployment glue.

Today this directory holds nothing but this file. `infra/capacitor/` will land here when the optional
native shell is picked up (CLAUDE.md, "Hosting"); it stays isolated and inert until then.

## Why the GitHub Actions workflows are *not* here

They used to be. `infra/github/workflows/` was the declared source of truth and `.github/workflows/` was
a byte-identical generated copy, kept in step by `make sync-workflows` and policed by a drift check in
`scripts/deploy-check.mjs`. That arrangement was removed on 2026-09-08. Do not recreate it.

**What it bought: nothing.** GitHub Actions only ever reads `.github/workflows/`. It does not follow
symlinks for workflow files and it has no include mechanism, so the `infra/` copy was never executed by
anything. It was a duplicate of a file, sitting next to a check whose only job was to notice that the
duplicate had stopped being a duplicate.

**What it cost, within seconds of the first deploy:** Dependabot's `github-actions` ecosystem scans
`.github/workflows/` (and composite-action directories). It edited the copy, could not see the source,
and `deploy-check` failed all five of its pull requests for drift — five red PRs, every one of them a
bump we wanted. Every hand edit needed a `make sync-workflows` afterwards or CI failed the same way. The
duplication also had to be explained in the runbook, in the pull-request template, in both workflow
headers and in the deploy-check header.

**The alternative that would have kept it, and why it lost.** Dependabot *can* be pointed at an arbitrary
directory: `dependabot-core`'s `github_actions` file fetcher scans `.github/workflows` when
`directory: "/"` and otherwise scans the given directory itself for `*.yml`, so
`directories: ["/", "/infra/github/workflows"]` would have found both copies. But keeping them identical
would then depend on Dependabot's multi-directory grouping emitting a single pull request that touches
both — machinery maintained to maintain machinery that does nothing. If the two ever landed in separate
PRs, each one would fail the drift check on its own.

**What replaced it.** `.github/workflows/` is the single source of truth and is edited directly.
Ownership — the actual thing the mirror was reaching for, since those workflows hold `pages: write` and
`id-token: write` — is enforced by `.github/CODEOWNERS`, which requires the repository owner's review on
any pull request touching `/.github/`. That is a real control. Directory placement was not.

Consequences of the removal, all intended:

- `make sync-workflows` is gone.
- `scripts/deploy-check.mjs` no longer reads `.github/`; it checks the artefact and nothing else.
- Dependabot action bumps now apply to the file that runs, so they can simply be merged.
