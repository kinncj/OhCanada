# ADR-0006: Repository layout, hosting and base path

- Status: Accepted (2026-09-08)
- Amended 2026-09-08: this ADR claimed rollback was "documented and tested once". The documented half
  became true when `docs/runbook.md` landed; the tested half was never true and cannot be until a first
  deploy exists. Corrected below, with the untested half recorded as a dated obligation rather than left
  as a silent gap.
- Amended 2026-09-08 (second): the obligation above is **discharged**. Rollback has been exercised on the
  live site in both directions, with the evidence recorded below and in runbook §1. The obligation is kept
  in place, struck through, rather than deleted: the record that it existed and was closed is the useful
  part. The claim moves from "documented, not tested" to "documented and exercised once" — not to
  "battle-tested", which one drill does not buy.
- Amended 2026-09-08 (third): repository visibility is raised as an explicit, still-**undecided** item.
  It belongs in this ADR and it is not an agent's decision to make; the pending-decision section it added is
  now the "Repository visibility" section below. Nothing in this ADR asserted, at that point, that the
  repository was public or that it was private.
- Amended 2026-09-08 (fourth): visibility decided — **private, indefinitely**, by the repository owner.
- Amended 2026-09-08 (fifth): **that decision was reversed the same day. The repository goes public.**
  The owner's call, both times. The fourth amendment is kept above rather than rewritten, and the private
  reasoning is kept in "Alternatives considered", because the reversal is load-bearing: the private setting
  is what produced the `403` artifact-quota deploy failure earlier that day, and it is the reason the quota
  cleanup and the artefact-ceiling work happened at all. Delete the first answer and that morning's work
  looks like unmotivated housekeeping. A same-day reversal is precisely the kind of thing a decision record
  exists to preserve. Consequences that were premised on private are corrected below, not silently dropped,
  and the obligation the private decision opened is marked **voided** rather than deleted.

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
- Rollback is re-running the last successful deploy workflow, documented as `docs/runbook.md` §1, and
  **exercised end to end on the live site on 2026-09-08**. Both directions were driven and both were
  confirmed by observable state rather than by a green tick:
  - re-ran the older run `bf18599` (pre-tombstone) —
    [34245903706](https://github.com/kinncj/OhCanada/actions/runs/34245903706) — after which `/OhCanada/sw.js`
    returned **404**, which only the older build does, while `index.html` stayed **200** throughout;
  - re-ran the newest run `5daeeef` (tombstone) to return to current —
    [34247227799](https://github.com/kinncj/OhCanada/actions/runs/34247227799) — after which `sw.js` was
    **200** again.

  The premise the procedure rests on remains separately proven: the build is deterministic — two consecutive
  `make build` runs produce a byte-identical `dist/`, recorded as runbook §5 — so re-running an old run serves
  the same bytes it served before. That determinism is also why the drill had to wait. The three deploys
  before the tombstone service worker produced an identical `dist/`, so re-running an older one would have
  changed nothing a test could see; ticking the checklist off that would have been precisely the false claim
  of a tested procedure that the first amendment above exists to prevent. Infra waited for the first deploy
  pair whose output genuinely differed. That was the right call and is the reason this line can be believed.
- ~~**OBLIGATION due=2026-09-30 owner=infra** — exercise the rollback once as soon as two successful
  deploys exist: re-run the older, confirm the older build is served, re-deploy the newer. Then tick the
  "After the first real deploy" checklist in runbook §1, record the run URLs and the date there, and
  amend this line to say rollback is tested. Until that is done this ADR claims documented, not tested.~~
  **DISCHARGED 2026-09-08** — checklist ticked in runbook §1, run URLs and date recorded there, this ADR
  amended. Closed by the owner it was assigned to. (Retro-fitted to the ADR-0009 marker format; the text
  and the outcome are unchanged.)
- **Repository visibility: public.** Decided 2026-09-08 by the repository owner — not infra's call and not
  the architect's. `kinncj/OhCanada` is open source by licence (ADR-0004) **and** by distribution: the
  source, the history and the review record are readable by anyone, matching the public Pages site and the
  full sourcemaps already shipped beside it. Contributions arrive as fork pull requests, gated by
  `.github/CODEOWNERS` review and the `pull_request` gate set. The decision was taken as private first and
  reversed to public the same day; how it was reached, and the preconditions publication makes due, are
  recorded below.

## Repository visibility: how the decision was reached

Raised 2026-09-08 by infra, after a deploy failed with `Failed to FinalizeArtifact: (403) Forbidden` — not a
permissions fault but the Actions **storage quota**: the repository was private, the Free-plan private
allowance is 500 MB, and 1,088 MB was held, mostly two Playwright reports of 524 MB and 537 MB left by the
archived 3D branch. Deleting those cleared the deploy. Public repositories are not charged for Actions
storage at all, so the failure mode was a consequence of the visibility setting, not of the artefacts alone.
That is what put visibility on the table: an operational cliff that existed only because of a setting nobody
had decided on purpose.

**The decision was taken twice.** The owner first settled on private, and the ADR was amended to record it,
with the storage cap written up as a permanent constraint and a dated obligation on infra to build a standing
artefact control behind it. Later the same day the owner reversed to public. Both answers are kept. The first
one is why the quota cleanup happened and why an artefact ceiling was being specified as a necessity; the
reversal is why that necessity no longer exists and why the same work continues as hygiene instead. A record
showing only the final answer would leave that morning unexplained and would lose the fact that the
constraint driving it was self-inflicted by an undecided default.

Going public is reversible as a setting and irreversible in effect — clones, forks and archives of whatever
was published persist. That asymmetry is why the choice was escalated to the owner rather than taken by any
agent, and it is why the preconditions below are ordered the way they are.

**Why here and not a new ADR.** Visibility is a property of the same repository this ADR already decides the
layout, host and size strategy for, and its main consequence — an Actions storage cap — sits directly beside
the existing ≤ 1 GB repository and 100 MB file constraints and the "no Git LFS" bullet they produced.
Splitting it into its own ADR would put interacting size limits in two files. It is named here.

### What made public the consistent answer

These were established while the decision was open, and each of them points the same way.

- The **Pages site is public** at <https://kinncj.github.io/OhCanada/> and always was, whatever the
  repository setting.
- The **application source was already published in full** — see the sourcemap consequence below. Under a
  private repository that was an incongruity; under this decision it is simply consistent, and it removes
  the only argument that existed for changing the `sourcemap` setting.
- The **licences already granted the fork right** (ADR-0004: MIT / CC BY 4.0 / CC0). A licence grants rights
  to whoever receives the work; a private repository meant almost nobody received it. Open source by licence
  and closed by repository access is a coherent state, but it was never chosen — it was the default. This is
  the deliberate answer.
- **`.github/CODEOWNERS` already assumes pull requests from strangers** in its own comment. That assumption
  stops being aspirational.
- The **workflow triggers already suit a fork model** — see the fork-safety consequence below. Nothing in
  the pipeline has to change for outside contributions to be gated safely.

### Preconditions

Three were named while the decision was open. One was blocking and is closed; two survive the flip as dated
obligations in the ADR-0009 marker format, because they are now consequences of an accepted decision rather
than advice to someone who has not agreed to it.

1. ~~**History audit for credential-shaped commits — blocking; must complete before the switch is flipped.**
   A later deletion does not unpublish anything already pushed, so the order is *rotate first, publish
   second*, never *publish, notice, delete*.~~

   **DISCHARGED 2026-09-08** — run by the repository owner **before the switch was flipped**, which is the
   only order that counts. What it covered, recorded here because a claim of this kind must show its
   working: **41 commits across all refs**, not merely `main`; no credential-shaped filenames; no token,
   key or private-key patterns in any blob; no workflow secrets beyond the automatic `GITHUB_TOKEN`; and a
   single author email, the owner's own.

   An independent read taken while this ADR was written agrees: no `.env`, `.pem`, `.key`, `.p12`,
   `.keystore` or `.jks` file ever added on any branch, and no `ghp_` / `github_pat_` / `gho_` / `ghs_`
   token, `xox`-prefixed Slack token, or `BEGIN PRIVATE KEY` block anywhere in history. Its one AWS-shaped
   hit, `AKIAAACjAAAApAAAAKUA`, is a substring of the base64-embedded Draco WASM decoder from the archived
   3D branch — not a key. That read is corroboration, not the audit; the owner's scan closed this. Two
   independent passes finding the same nothing is the strongest form this claim takes.

   It cannot be reopened, and it does not generalise. It is closed for the history as it stood on
   2026-09-08 and says nothing about any future commit — which is why the standing warning in the
   consequences below, *never place a secret in this tree*, is a permanent rule and not a checklist item.

2. **`assets/credits.json` provenance per ADR-0004 — met by vacuum today, not by review.** Publication is
   the moment ADR-0004's licensing claims are made to the public, so no third-party asset may ship without
   attribution once anyone can read the tree. `make validate-content` already fails on any file in
   `assets/dist/` lacking a credit, and today it passes trivially: `assets/dist/` is empty and
   `credits.json` declares `"assets": []`. Nothing is uncredited because nothing has shipped. The force of
   this precondition arrives with the first shipped asset, and the gate — not this line — is what will keep
   it true.

   - **OBLIGATION due=2026-09-15 owner=art** — before the first asset lands in `assets/dist/`, confirm every
     asset carries the provenance ADR-0004 requires, and confirm the credit gate's scope matches where
     assets actually live: it checks `assets/dist/`, so an asset committed elsewhere under `assets/` is
     credited by nobody. Raise the scope with infra if the gate is looking in the wrong place. A vacuously
     passing gate is exactly the shape of check this project has been bitten by before.

3. **`CONTRIBUTING.md` must read as instructions to a stranger.** It was written when no stranger could
   reach it. The audience it addresses now exists, and prose that assumes the reader already knows the
   project is the difference between a fork right that is real and one that is granted only on paper.

   - **OBLIGATION due=2026-09-22 owner=infra** — rewrite `CONTRIBUTING.md` for a reader who has never seen
     this repository: how to run the gate set, what `make lint typecheck test validate-content` must show
     before a pull request, the commit-message rule, and what a `.github/CODEOWNERS` review means for them.
     Cover the issue templates in the same pass. Routing note: assigned to the owner of the gate set the
     document describes; the orchestrator should reassign if contributor-facing prose belongs elsewhere, but
     it needs one owner, not a committee.

## Alternatives considered
- **Separate content repository** — rejected: content and the schema that validates it must version together.
- **Netlify/Vercel** — rejected: Pages keeps hosting inside the same open-source account with no extra service.
- **A separate ADR for repository visibility** — rejected: see "Why here and not a new ADR" above.
- **Keeping the repository private** — genuinely considered, decided, and then reversed the same day. The
  reasoning is kept because it was not bad reasoning; it was outweighed. Two arguments carried it. First, the
  direction of the change: privacy is recoverable and publication is not. Publishing exposes the **full
  history**, not the current tree, and clones and archives of it persist after any reversal. Second, the
  preconditions publication makes due immediately — auditing the whole history for anything credential-shaped
  ever committed, confirming `assets/credits.json` provenance because publication is the moment those
  licensing claims are made to the public, and rewriting `CONTRIBUTING.md` for an audience of strangers.

  What outweighed them: the code was already published in full via sourcemaps, so privacy was protecting the
  history and the review record, not the source; the licences already promised a fork right that a private
  repository made unexercisable; and the private setting carried a live operational cost — a 500 MB Actions
  storage cap that had already blocked a deploy that day, and that would have needed a permanent standing
  control to manage. The preconditions turned out to be cheap on inspection rather than in principle: two of
  the three are already satisfied or trivially checkable, leaving the history audit as the only real work.

## Consequences
- Asset weight is a repository concern; the pipeline compresses and the budgets are CI gates.
- Rollback is a written procedure whose premise is proven and whose execution has been performed once, in
  both directions, against observable state. Stated plainly in both directions: it is not folklore, and it
  is not battle-tested either. One drill, by the person who wrote the pipeline, on a repository with one
  contributor and a `dist/` that rebuilds in minutes, proves the procedure is executable and that the
  pipeline supports it. It does not prove it holds for an unfamiliar operator, a larger artefact, or a
  pipeline that is itself partly broken. Runbook §1 says to re-drill when the pipeline changes shape rather
  than on a calendar; that is the right trigger, and it is the thing that keeps this claim true.
- **The artifact-quota failure mode is removed by this decision.** Public repositories carry no Actions
  artifact storage charge, so the `403 Forbidden` that blocked a deploy on 2026-09-08 cannot recur, and the
  500 MB allowance stops being a constraint on this project at all. Standard-runner minutes are likewise
  unmetered. Infra continues to bound artefact sizes and retention as **hygiene, not necessity**: a 500 MB
  Playwright report is still a bad artefact — slow to upload, useless to read, a sign that `video`, `trace`
  and `screenshot` are set too generously — it is simply no longer a deploy-stopping one. The distinction
  matters for prioritisation: this is now cleanup that can be scheduled, not a gate that must exist.
- ~~**OBLIGATION due=2026-10-08 owner=infra** — land a standing control behind the 500 MB storage cap: a
  pipeline-enforced artefact size ceiling and an explicit retention on every artifact upload.~~
  **VOIDED 2026-09-08** — the constraint this obligation existed to manage was removed by the visibility
  reversal in the same day's amendment, before any work was scheduled against it. Kept struck through rather
  than deleted so that the artefact-ceiling work already done reads as motivated rather than arbitrary.
  Voided is not discharged: nothing was delivered, and nothing needed to be.
- **The ≤ 1 GB repository cap and the 100 MB file cap are unaffected.** Those are Git and Pages limits, not
  billing limits, and visibility does not move them. The "no Git LFS" bullet and the per-level budgets stand
  unchanged, and so does the Release-hosting escape hatch at the end of this ADR.
- **Fork pull requests are safe by construction, and that property is what makes public contribution
  viable.** Read against the current files: `.github/workflows/ci.yml` is `on: pull_request` only, with
  top-level `permissions: contents: read`; `.github/workflows/deploy-pages.yml` is `on: push: branches:
  [main]` plus `workflow_dispatch`, with `pages: write` and `id-token: write`. A fork pull request therefore
  triggers only the read-only gate set and can never reach the job holding `pages: write`, and it runs with
  a read-only token and no secrets. Nothing in the deploy path depends on a secret being available to a
  fork, so nothing in the pipeline has to change for outside contributions.

  The dangerous trigger is absent, and that was checked rather than assumed: the only occurrence of the
  string `pull_request_target` anywhere in `.github/` is a **comment** on `deploy-pages.yml:42` explaining
  what `checkout` v7 blocks under it. It is not a trigger. That matters because `pull_request_target` is the
  one event that runs fork-authored refs with the base repository's write-scoped token, and adding it to fix
  a permissions symptom is the standard way this property gets lost later.

  This was verified by the repository owner before the switch was flipped, and independently by the
  architect against the same files; infra is reviewing it as a third read. Two things follow. The property
  is not one person's assertion — and it now has strangers on the other side of it, so it belongs in the
  runbook as a named invariant rather than only in an ADR paragraph.
- **OBLIGATION due=2026-09-22 owner=infra** — record the fork-safety property above in `docs/runbook.md` §3
  as a named invariant, including the `pull_request_target` prohibition and why it matters, so that a future
  change to either workflow's `on:` or `permissions:` block is visibly changing something load-bearing.
  Three independent reads agreeing is what this claim rests on today; a runbook invariant is what will keep
  it true after all three readers have moved on.
- **The source is already published, and now consistently so.** `vite.config.ts` sets `build.sourcemap: true`
  for every chunk, and the emitted maps carry `sourcesContent` with original paths. Verified against the
  current `dist/`: `dist/assets/index-*.js.map` lists sources such as `../../app/adapters/phaser/boot-scene.ts`
  and ships their full text. Anyone with the public Pages URL has the TypeScript, with original file names.
  The build comment justifies those maps with "this is an open-source project"; that is now true of the
  repository as well, and no change to the `sourcemap` setting is called for. The standing warning survives
  the decision and is stronger under it: **never place a secret in this tree.** It is published twice over —
  once as the repository and once as the sourcemaps — and neither publication can be taken back.
- **The licences in ADR-0004 become exercisable by the people they were written for.** `.github/CODEOWNERS`
  already describes this contribution model in its own comment — "This repository is open source; assume
  pull requests from strangers" — which was aspirational when written and is now a description of reality.
  It still wants a read by infra, for the opposite reason to the one that would have applied under a private
  repository: not because the comment is false, but because it is now true. The rule underneath it is what
  stands between a stranger's pull request and the workflow file holding `pages: write`. A comment that was
  decoration is now load-bearing and should be read as a control rather than as prose. `CONTRIBUTING.md` is
  the part that genuinely needs rewriting, per precondition 3 above.
- **The full history is public, not just the current tree.** That is the irreversible part of this decision.
  Precondition 1 was what stood between it and a published secret, and it was discharged *before* the flip
  rather than after, across all 41 commits on every ref rather than at the tip. From here the protection is
  prospective only: nothing published can be un-published, so the rule is **never place a secret in this
  tree**, and the response to a credential-shaped commit is a rotation, never a revert.
- If the repository approaches 1 GB, serve `assets/dist` from a Release — that needs its own ADR.
