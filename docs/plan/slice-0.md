# Slice 0 — Foundation

**Goal.** The harness, the skeleton and the pipeline: an empty portrait canvas deployed to GitHub Pages
through the same gates every later slice will use.

| # | Task | Owner | Acceptance | Status |
|---|---|---|---|---|
| 0.1 | `CLAUDE.md`, `.claude/agents/*`, `.claude/commands/*`, `.claude/settings.json`, `.mcp.json` | orchestrator | Files present; CLAUDE.md < 300 lines | Done |
| 0.2 | ADR-0001..0008 | orchestrator + architect | Eight ADRs, each with alternatives and consequences | Done (0007 and 0008 arose from the audit; 0003 and 0006 amended) |
| 0.3 | Repo skeleton per §8 | orchestrator | Directory tree matches the spec **after a fresh clone** | Done (audit: 24 dirs were lost on commit; `.gitkeep` added, `dist/` ignore anchored) |
| 0.4 | Licences: MIT, CC-BY-4.0 assets, CC0 questions | orchestrator | `LICENSE`, `LICENSE-ASSETS` present | Done |
| 0.5 | Makefile with every target wired (stubs allowed) | infra | `make help` lists all targets; each runs | Done |
| 0.6 | Vite + TS strict + Vitest + Playwright configs | infra | `make typecheck test` green, and the coverage gate provably measures something | Done (audit: 90% passed on 0/0; `coverage-floor.mjs` added, 58 → 264 measured lines) |
| 0.7 | dependency-cruiser rules from ADR-0005 | architect | `make lint` green and rules provably fail on a violation | Done (10 rules, each seen to fail; + `docs/architecture.md` and `app/application/ports/*`) |
| 0.8 | Portrait canvas boot: Phaser scale, safe areas, rotate overlay, `aria-hidden` canvas + live region | engine + ui-a11y | Renders 1080×1920 portrait on phone, centred with side panels on desktop; the overlay contains focus | Done (audit: `aria-modal` had no containment; focus trap added, live region now mounts before the parse) |
| 0.9 | `content/game.config.json` + schemas + `validate-content` | infra | `make validate-content` green | Done |
| 0.10 | CI + Pages workflows calling Makefile targets only | infra | Deploy green; site reachable; **deploy runs the gates** | Done (audit: deploy ran no tests and could publish while CI was red) |
| 0.11 | `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` | orchestrator | Present; contributing explains the verification gate | Done |
| 0.12 | Stub scripts: `verify-content`, `verify-art`, `assets` | infra | Each runs, exits 0, prints what it will do; `verify-art` wired into CI | Done |

| 0.13 | Staff review of the whole slice, findings routed to owning agents | reviewer + all | Every gate proven to fail on a real violation before it is trusted | Done (3 High, 9 Medium, 10 Low; all High and Medium closed) |

**Definition of done.** `make lint typecheck test validate-content` green locally and in CI; an empty portrait
canvas live at https://kinncj.github.io/OhCanada/ ; `docs/plan/slices.md` updated; slice 1 file written.

**What the audit changed.** Three gates were green because they measured nothing: the Pages deploy ran no
tests and did not depend on CI, the 8 MB payload budget had no gate at all, and the 90% coverage threshold
was passing on `0/0` over a directory of type-only files. Two skipped tests carried bodies asserting `0 === 0`,
so removing the skip would have produced a green tick meaning nothing. The lesson is written into every later
slice: **a gate is not trusted until it has been seen to fail on a real violation.**

**Open obligation.** Rollback is documented in `docs/runbook.md` §1 and its determinism premise is proven,
but the procedure itself has never been exercised — there has been no deploy to roll back. Owner infra,
opened 2026-09-08, due once two successful deploys exist (ADR-0006, amended).

**Explicitly not in this slice.** Gameplay, art, questions, Rive, audio, scheduler — all slice 1 or later.
