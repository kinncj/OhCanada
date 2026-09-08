# ADR-0006: Repository layout, hosting and base path

- Status: Accepted (2026-09-08)
- Amended 2026-09-08: this ADR claimed rollback was "documented and tested once". The documented half
  became true when `docs/runbook.md` landed; the tested half was never true and cannot be until a first
  deploy exists. Corrected below, with the untested half recorded as a dated obligation rather than left
  as a silent gap.

## Context
One product, many kinds of artefact: code, content, art, pipeline, infra, tests, docs. Hosting is GitHub
Pages, which is static-only, serves no Git LFS objects, caps files at 100 MB and repositories at about 1 GB.
The GitHub repository is `kinncj/OhCanada` while the product is TrueNorth (`truenorth-app`).

## Decision
- **BusinessRepo**: a single domain-centric repository owns everything. No separate "shared" or "infra" repos.
- Deploy to `kinncj/OhCanada` via GitHub Actions; `base` is `/OhCanada/`, read from `content/game.config.json`
  so a rename or a custom domain is a one-line change.
- Public URL: <https://kinncj.github.io/OhCanada/>.
- Hash routing, content-hashed filenames, Workbox precache per level. Navigations are network-first so a stale
  service worker can never pin a device to an old build.
- No Git LFS. Levels are split and compressed to hold the ≤ 8 MB per-level and ≤ 100 MB total budgets.
- Rollback is re-running the last successful deploy workflow, documented as `docs/runbook.md` §1.
  What is proven today is the premise the procedure rests on: the build is deterministic — two consecutive
  `make build` runs produce a byte-identical `dist/`, recorded as runbook §5 — so re-running an old run
  serves the same bytes it served before. What is not proven is the procedure itself: no deploy has ever
  run, so there is no previous run to re-run and nobody has performed the steps.
- **Obligation, opened 2026-09-08, owner infra:** exercise the rollback once as soon as two successful
  deploys exist — re-run the older, confirm the older build is served, re-deploy the newer. Then tick the
  "After the first real deploy" checklist in runbook §1, record the run URLs and the date there, and
  amend this line to say rollback is tested. Until that is done this ADR claims documented, not tested.

## Alternatives considered
- **Separate content repository** — rejected: content and the schema that validates it must version together.
- **Netlify/Vercel** — rejected: Pages keeps hosting inside the same open-source account with no extra service.

## Consequences
- Asset weight is a repository concern; the pipeline compresses and the budgets are CI gates.
- Rollback is a written procedure with a tested premise and an untested execution. That is worth stating
  plainly in both directions: it is not folklore, and it is not drilled. The obligation above is the only
  thing that closes the gap, and it is cheap — it costs two workflow re-runs after the second deploy.
- If the repository approaches 1 GB, serve `assets/dist` from a Release — that needs its own ADR.
