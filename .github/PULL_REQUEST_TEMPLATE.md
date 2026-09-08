## What and why

<!-- One or two sentences. Link the slice in docs/plan/ if there is one. -->

## Gates

Run locally before asking for review — CI runs the same Makefile targets and nothing else:

```
make lint typecheck test validate-content verify-content verify-art
make assets build test-e2e test-perf test-a11y
```

`verify-content` and `verify-art` are **stubs**. They print "not yet implemented (slice 1)" and exit 0,
so they are green on every pull request and green means nothing: no question has been checked against
*Discover Canada*, no image against a reference. They stay in the command line above because tasks 1.16
and 1.17 make them real. Until then, do not cite a passing `verify-content` as verification of anything —
verification status is set by a separate verifier agent, never by the author (see `CONTRIBUTING.md`).

- [ ] `make lint typecheck test validate-content` is green locally — these four actually check something
- [ ] New behaviour has a test that fails without the change
- [ ] Coverage still measures something real (`scripts/coverage-floor.mjs` passes)

## Checklist by area

Tick only what applies; delete the rest.

**Architecture** (`app/**`)
- [ ] Layer rules hold: `domain` imports nothing outside `domain`/`common`; `application` is ports only;
      adapters never import each other; `ui` is DOM only; concretes are wired only in `bootstrap`
- [ ] A decision changed? Then there is a new ADR in `docs/adr/`, not an edit to the CLAUDE.md table

**Accessibility**
- [ ] Screens are DOM with ARIA roles; the canvas stays `aria-hidden`
- [ ] Keyboard-operable, touch targets ≥ 44 pt, colour is not the only signal
- [ ] `make test-a11y` green

**Content** (`content/**`)
- [ ] Every file declares `$schema` and `make validate-content` passes
- [ ] EN and FR both present
- [ ] If this adds or edits questions: I am not also the verifier, and I have not set
      `verification.status` myself

**Assets** (`assets/**`)
- [ ] Licensed CC0 or CC BY, listed in `assets/credits.json` with author, licence and source
- [ ] Within the payload budgets — `make build` runs `scripts/deploy-check.mjs`, which enforces them

**Infrastructure** (`infra/**`, `.github/**`, `Makefile`, `scripts/**`)
- [ ] Workflow changes are made in `.github/workflows/` — the only copy; there is no mirror to sync
- [ ] Any new gate has been seen to FAIL on a real violation, not just pass — say how in the description

## Rollback

<!-- If this changes the deploy: does docs/runbook.md still describe the truth? -->
