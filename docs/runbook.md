# Runbook

Operational procedures for TrueNorth. Everything here is meant to be followed under pressure by someone
who did not write it, so it says what to click, not what to understand.

Scope: one static site on GitHub Pages, no server, no database, no accounts, no analytics. There is no
customer data to lose and no state to migrate. The only thing that can break in production is *which build
is being served*, which is why rollback is the first section.

---

## 1. Rollback: put the previous build back

**Status of this procedure: EXERCISED END TO END ON 2026-09-08. It works.**

Drilled on the live site, not simulated. The tombstone service worker (§3b) made the drill observable for
the first time: it is the first change where two consecutive deploys produce a genuinely different
`dist/`, so "which build is live" can be read straight off an HTTP status code.

| Step | Run | Result |
|---|---|---|
| Re-ran the *older* run (`bf18599`, pre-tombstone) | [34245903706](https://github.com/kinncj/OhCanada/actions/runs/34245903706) | success — `/OhCanada/sw.js` returned **404**, i.e. the older build was being served, and `index.html` stayed **200** throughout |
| Re-ran the *newest* run (`5daeeef`, tombstone) to return to current | [34247227799](https://github.com/kinncj/OhCanada/actions/runs/34247227799) | success — `/OhCanada/sw.js` back to **200** `application/javascript` |

The site stayed up for the whole drill; a rollback swaps which build is served, it never takes the site
down. Total time per direction was under four minutes, almost all of it the gate set.

Note on why this could not honestly be drilled earlier: the three deploys before the tombstone produced a
byte-identical `dist/` (none of them touched `app/` or `content/`), so re-running an older one would have
demonstrated nothing observable. Ticking this checklist off that would have been a false claim of a tested
procedure — the precise defect ADR-0006 was amended to stop making.

### When to use it

The site at <https://kinncj.github.io/OhCanada/> is broken — blank page, wrong base path, a level that will
not load, a regression that got through the gates — and the fix is not obvious in minutes. Do not debug
forward on a broken production site. Put the last good build back, then debug.

### The procedure

1. Open **Actions → Deploy to GitHub Pages** in `kinncj/OhCanada`.
2. Find the most recent run with a green tick **that predates the breakage**. Confirm it is the one you
   want: the run title is the commit subject, and the run page shows the commit SHA.
3. Open that run and press **Re-run all jobs**. Not "Re-run failed jobs" — you want the whole job,
   including the gate steps and the artefact upload.
4. The re-run checks out the same commit, re-runs the full gate set, rebuilds `dist/`, uploads it and
   deploys it. Watch the `Deploy` step for the `page_url` output.
5. Hard-reload the site (`Ctrl`/`Cmd` + `Shift` + `R`) and confirm the old build is live.

That is the whole of it. There is no separate rollback artefact, no `gh-pages` branch to reset and no CDN
purge: Pages serves whatever the most recent *successful* deployment uploaded, so a successful re-run of an
old run is a rollback.

### Why it is safe to re-run an old run

- **The build is deterministic.** Filenames are content-hashed, so the same commit produces the same
  bytes. Verified locally by building twice and comparing hashes; see §5.
- **Nothing is cancelled underneath it.** The `pages` concurrency group uses `cancel-in-progress: false`,
  so a queued deploy waits for the running one instead of killing it mid-upload.
- **A service worker cannot pin anyone to the broken build.** Since slice F3 the site ships one (ADR-0034),
  and every navigation still goes to the network first, so the next page load fetches the rolled-back shell.
  The rolled-back build's `sw.js` differs from the broken one's - its precache names different files - so
  every device's next update check installs it; it takes over at once and prunes the level art the broken
  build cached. Rolling back past F3 serves the tombstone instead (§3b), which removes the worker entirely.
  Precached code is content-hashed and never collides with the files the other build asks for.
- **If the worker itself is what broke, a rollback is not the fastest lever.** Turn the worker off with
  `featureFlags.serviceWorker` and ship that (§3c). It keeps the rest of the build and removes the worker
  from every device on its next visit.
- **A rollback across F3 is not yet drilled.** The §1 drill predates the worker. See §6 for the re-drill
  this change makes due.
- **The re-run is gated.** `deploy-pages.yml` runs `lint typecheck test validate-content verify-content
  verify-art`, then builds, then runs the e2e/perf/a11y suites, and only then uploads. A rollback to a
  commit that no longer passes its own gates will fail loudly rather than deploying something worse. Note
  the consequence: if the breakage is *caused* by something time-dependent (a `volatile` content item that
  has aged past 180 days, an upstream source that changed), the old run may now fail its gates. In that
  case see §2.

### If re-running the old run fails

1. Read which step failed. If it is `verify-content`, the source material moved and the old commit is no
   longer verifiable — that is a content problem, not a deploy problem; go to §2.
2. If you need the site fixed *now* and the gates are the obstacle, the honest move is forward, not
   sideways: open a PR that reverts the offending commit on `main` (`git revert`), let CI pass, merge. The
   push to `main` deploys it.
3. Do not disable a gate to get a deploy out. A gate that can be switched off during an incident is a gate
   that is off.

### Drill checklist — completed 2026-09-08

- [x] `Deploy to GitHub Pages` has completed successfully at least twice (so there is a previous run).
- [x] Re-ran the *older* of the two runs from the Actions tab.
- [x] Confirmed the site served the older build afterwards — `/OhCanada/sw.js` returned 404, which only
      the pre-tombstone build does.
- [x] Re-deployed the newest run to get back to current — `sw.js` back to 200.
- [x] Recorded the run URLs and the date here, and changed the status line at the top of this section.

Re-drill when the deploy pipeline changes shape (a new upload action major, a change to the artefact, a
move off Pages), not on a calendar. The thing being tested is the pipeline, not the procedure text.

---

## 2. Content emergency: a shipped question is wrong

Questions are CC0 data validated and verified by `make validate-content verify-content`. If a *wrong* one
is live:

1. Open a **Question correction** issue so the correction is tracked in public (`.github/ISSUE_TEMPLATE/`).
2. Quarantine beats correction under time pressure. Removing or quarantining the item is a content change
   that ships through the normal PR → merge → deploy path; it does not need a rollback.
3. The author and the verifier are different agents by rule (CLAUDE.md, ADR-0003). Do not shortcut that
   during an incident — a hurried self-verified fix is how the wrong answer got there.

---

## 3. Deploy pipeline: what runs, and where it is defined

- **`.github/workflows/` is the only copy.** Edit it directly. It used to be generated from
  `infra/github/workflows/` by a `sync-workflows` Makefile target, with a drift check in
  `scripts/deploy-check.mjs`; the mirror, the target and the check were all removed on 2026-09-08 and
  `infra/README.md` explains why. `make sync-workflows` no longer exists — if you find it named anywhere
  as a live step, that text is out of date. Ownership of these files —
  they hold `pages: write` and `id-token: write` — is enforced by `.github/CODEOWNERS`.
- **`ci.yml`** runs on pull requests only, in two parallel jobs, calling Makefile targets and nothing else.
- **`deploy-pages.yml`** runs on push to `main` and on manual dispatch. It runs the *same* gate set before
  it builds and uploads, so the bytes that ship are the bytes that were verified. This is deliberate; the
  alternative (`workflow_run` gating on CI) is discussed in the header comment of that file.
- Everything a workflow does is a `make` target. If you cannot reproduce a CI failure locally by running
  the same target, that is a bug in the pipeline, not a flake to be re-run.
- **Before editing either workflow's `on:` or `permissions:` block, read the invariant below** ("a fork
  pull request cannot reach the deploy job"). Those two blocks are the whole of what keeps outside
  contribution safe.

### Deploy fails at "Upload artifact" with a 403 — private repositories only

Seen for real on 2026-09-08, run
[34247227799](https://github.com/kinncj/OhCanada/actions/runs/34247227799). Every gate passed, the artefact
uploaded to blob storage, then:

```
Uploaded bytes 2189627
Finished uploading artifact content to blob storage!
Finalizing artifact upload
##[error]Failed to FinalizeArtifact: Received non-retryable error:
         Failed request: (403) Forbidden: Error from intermediary with HTTP status code 403 "Forbidden"
```

**A 403 on `FinalizeArtifact` is the Actions storage quota, not a permissions problem.** The message says
"Forbidden", points nowhere useful, and sends people to read `permissions:` blocks for an hour. The tell is
that the *content* upload succeeds and only the finalize call is rejected: the runner had every permission
it needed to write the bytes, and was refused only when it asked for the artifact to be kept.

**Does this apply to this repository? No — not since 2026-09-08.** TrueNorth is public (ADR-0006) and
public repositories carry no Actions artifact storage charge at all, so this failure cannot recur here.
The section stays because it *can* happen in any **private fork or clone** of this repository, which gets
the private tier's 500 MB allowance, and because the symptom is misleading enough to be worth writing down
permanently.

What it looked like when it happened here, while the repository was still private: the allowance was
500 MB, storage was holding 1,088 MB, and two failed-CI `playwright-report` artifacts left over from the
archived 3D branch were **524 MB and 537 MB** on their own.

Diagnose and fix:

```
gh api --paginate repos/kinncj/OhCanada/actions/artifacts \
  --jq '.artifacts[] | [(.id|tostring), (.size_in_bytes/1048576|floor|tostring)+"MB", .name, .created_at] | @tsv' \
  | sort -k2 -n -r | head
gh api -X DELETE repos/kinncj/OhCanada/actions/artifacts/<id>
```

Then **re-run the failed job**; nothing needs rebuilding by hand. Deleting the two large artifacts brought
storage to 26 MB and the re-run deployed cleanly.

**No rollback is needed for this failure.** The job dies before the `Deploy` step, so Pages carries on
serving the last successful deployment. Check that before doing anything dramatic — the site is almost
certainly fine.

Both of the things that would have stopped it recurring are now done:

- **The repository is public** as of 2026-09-08 (ADR-0006), which removes the quota entirely rather than
  managing it. That is why there is no artefact size gate in `make`: a limit with no consequence behind it
  is machinery that exists to look rigorous.
- **Playwright no longer writes reports that size**, for the separate and still-good reason below.

#### Bounding the cost of a failing Playwright run — landed 2026-09-08

Hygiene, not survival. Since the repository went public the storage quota is gone, so nothing *breaks* when
a report is large. What remains is the reason that outlives the quota: a half-gigabyte report is miserable
to download, slow to open and no more informative than a small one, and the people downloading it now
include outside contributors. There is deliberately **no enforced size ceiling** anywhere in `make` or the
workflows — a gate that fails a build for crossing a line with nothing behind it is theatre.

All three configs (`tests/e2e`, `tests/perf`, `tests/a11y`) shared one `use` block. What changed, and what
each change costs:

| Setting | Was | Now | What it trades away |
|---|---|---|---|
| `maxFailures` | unset | `5` on CI, uncapped locally | **The failure list becomes a sample, not a census.** "5 failed" no longer means "only 5 are broken", and one test is reported as `did not run`. Accepted because the case it bounds is the systemic one — the app not booting — where the sixth failure repeats the first. |
| `trace` | `retain-on-failure` | `on-first-retry` on CI, `retain-on-failure` locally | **On CI you get no trace from the first attempt**, only from its retry (`retries: 1` guarantees there is one). A failure that does not reproduce on retry leaves a screenshot and an error context but no trace. Locally nothing is lost. |
| `video` | `retain-on-failure` | `off` on CI, `retain-on-failure` locally | **No video on CI at all.** Least costly of the three: a trace already carries a screencast timeline and DOM snapshots, so video was mostly duplicate evidence. `retain-on-failure` also *records* every test and discards on success, so green runs paid for it too. |
| `screenshot` | `only-on-failure` | unchanged | Nothing. Screenshots are tens of kilobytes. |
| CI upload | `playwright-report/` **and** `test-results/` | `playwright-report/` only | **The raw output directory is no longer downloadable.** The HTML reporter copies every attachment it references into `playwright-report/data/` — traces included — so the report is self-contained: open `index.html`, click the failing test, the trace viewer loads from inside it. The pair was close to two copies of the same evidence. |
| Retention | 3 days | 14 days | Nothing; storage is free now. 3 days was a quota measure. 14 days is "how long before someone actually reads it", which is a review cycle. |

Local behaviour is deliberately untouched. Disk is free on a laptop and the person who can act on a failure
immediately should not have evidence withheld from them.

##### Measured, not asserted

Reproduced the incident locally: `make build`, then broke the built shell so the **whole suite fails
together** — the systemic case, not one flaky test — and ran `tests/e2e` twice under `CI=1` against the
identical broken build, once with the old settings and once with the committed ones.

| | Old settings | New settings |
|---|---|---|
| Result | 6 failed, 1 passed, all ran | 5 failed, 1 passed, **1 did not run** (`maxFailures` fired) |
| Wall clock | 2.2 min | 1.8 min |
| `playwright-report/` | 2,827,789 B | 2,062,113 B |
| `test-results/` | 1,136,652 B (also uploaded) | 324,142 B (no longer uploaded) |
| **Total uploaded** | **3,964,441 B (3.78 MiB)** | **2,062,113 B (1.97 MiB)** |
| Evidence net of the fixed 1.30 MiB trace-viewer boilerplate | 2.48 MiB | 0.66 MiB |
| `.webm` files written | 24 | 0 |

A second run of the same experiment against a build whose *entry chunk* 404s — so Phaser still loads and
the traces carry real network bodies, which is the shape that produces big reports — gave per-failure
evidence of **395,631 B** under the old settings against **62,731 B** under the new: **6.3x**. That ratio,
not the absolute numbers from a 1.4 MB app, is what would have applied to the 524 MB artifacts, which came
from a build shipping ~15 MB of models and textures.

The fixed 1.30 MiB of trace-viewer boilerplate is present in every HTML report regardless of settings and
is the floor; it is not worth attacking.

### INVARIANT — a fork pull request cannot reach the deploy job

This is a *rule*, not a description of how the workflows happen to be arranged today. It is what makes
public contribution safe, and every clause below is load-bearing. Changing any of them is changing a
security property, not a workflow detail. Recorded per ADR-0006.

1. **`deploy-pages.yml` — the job holding `pages: write` and `id-token: write` — may be triggered only by
   `push` to `main` and by `workflow_dispatch`.** Neither is available to someone without write access to
   this repository. No trigger may be added to it that an outside contributor can cause.
2. **`ci.yml` — the workflow a pull request runs — declares `permissions: contents: read` at the top level
   and no job overrides it.** It requests nothing writable, references no secret, and has nothing to
   escalate to. It never gets `pages:` or `id-token:`.
3. **No workflow in this repository may use `pull_request_target`.** This is the clause that will be
   removed by someone who does not know why it is here, so: `pull_request_target` runs the *base*
   repository's workflow with a **write-scoped token and access to secrets**, while checking out a ref the
   pull request author controls. It exists to let fork PRs use secrets, and it is the single most common way
   a public repository is compromised through Actions. It is typically added by someone debugging a
   "resource not accessible by integration" error — that is, by someone treating a permissions symptom. If
   you are reaching for it, the answer is that fork PRs here do not need secrets and never will.
   The only occurrence of the string in this repository is a comment in `deploy-pages.yml` explaining what
   `checkout` v7 blocks under it. Grep before you trust: `grep -rn pull_request_target .github/`.
4. **`workflow_run` is likewise prohibited** for the deploy path, for the same reason plus a second one:
   it runs in the base context with the base token, and it fails open in the confusing direction. The
   header comment of `deploy-pages.yml` records why the deploy job runs its own gates instead.
5. **No `${{ github.event.* }}` interpolation inside a `run:` block.** Pull-request titles, branch names
   and body text are attacker-controlled strings, and interpolating them into a shell is script injection.
   Today the only interpolations anywhere are `steps.deployment.outputs.page_url` and
   `github.workflow`/`github.ref` in a concurrency group.
6. **No self-hosted runners.** A fork pull request executes arbitrary code from the pull request — `make
   setup` runs `npm ci`, which runs lifecycle scripts from the PR's own `package.json`. That is normal and
   acceptable *because* the runner is ephemeral, GitHub-hosted, holds a read-only token and sees no
   secrets. On a self-hosted runner none of that is true.

Repository-level settings that back the invariant, current as of 2026-09-08 and worth re-checking if
anything odd happens:

```
gh api repos/kinncj/OhCanada/actions/permissions/workflow
  -> {"default_workflow_permissions":"read","can_approve_pull_request_reviews":false}
gh api repos/kinncj/OhCanada/actions/permissions/fork-pr-contributor-approval
  -> {"approval_policy":"first_time_contributors"}
gh api repos/kinncj/OhCanada/environments/github-pages
  -> protection_rules: [branch_policy]; deployment branch policy allows "main" only
gh api repos/kinncj/OhCanada/pages
  -> {"build_type":"workflow", ...}
gh api repos/kinncj/OhCanada/branches/main/protection
  -> required_status_checks.strict: true
     required_status_checks.contexts: ["Lint, types, unit tests, content",
                                       "Build, e2e, perf, a11y"]
     required_pull_request_reviews: 1 approval, require_code_owner_reviews: true,
                                    dismiss_stale_reviews: true
     required_conversation_resolution: true
     allow_force_pushes: false, allow_deletions: false
     enforce_admins: false
```

The `github-pages` environment's branch policy is a genuine second line: even if a deploy job were somehow
triggered on another ref, the environment refuses the deployment. The `first_time_contributors` approval
policy means a new contributor's first pull request does not run until a maintainer presses Approve.

**`main` is protected, as of 2026-09-08.** Both `ci.yml` jobs are *required* status checks, `strict: true`
so a stale branch must be brought up to date before it merges, one approving review is required and
`require_code_owner_reviews: true` means `.github/CODEOWNERS` now genuinely **requires** the owner's review
rather than merely requesting it. `dismiss_stale_reviews: true`, so pushing a new commit after an approval
re-opens the review. `required_conversation_resolution: true`. Force pushes and deletions are refused for
everyone, admins included. This is classic branch protection, not a ruleset — `gh api .../rulesets` still
returns `[]`, which matters only if someone later migrates and expects to find the rules there.

**The chosen residue: `enforce_admins: false`.** This was decided deliberately, not left at a default. The
protection binds contributors; it does not bind the maintainer, who can still push straight to `main` and
deploy without a review or a green check. Stated plainly because it is the honest shape of the control: a
stranger's pull request cannot reach a `pages: write` workflow file without the owner approving it, and the
*owner's own* commits still rest on the owner's discipline. That is a smaller gap than before — it no longer
covers anyone else — but it is a gap, and it is the one that would let an unreviewed privileged change land.

**A required context that nothing reports leaves every pull request pending forever.** This is the failure
mode of this setting, and it is silent: GitHub waits for a check with that exact name and no timeout ever
fires. The two required contexts are the `name:` values of the two jobs in `ci.yml`, character for
character:

| Required context | Comes from |
|---|---|
| `Lint, types, unit tests, content` | `ci.yml` job `static`, `name:` |
| `Build, e2e, perf, a11y` | `ci.yml` job `browser`, `name:` |

Verified two ways. Statically, by comparing the two strings byte for byte (`gh api
.../branches/main/protection --jq '.required_status_checks.contexts[]'` against `grep '^    name:'
.github/workflows/ci.yml`) — identical. And observed on a live pull request (#6, the open Dependabot
bump), which reports check runs named exactly `Lint, types, unit tests, content` and `Build, e2e, perf,
a11y`, sits at `reviewDecision: REVIEW_REQUIRED`, and shows `mergeStateStatus: BEHIND` — that last one
being `strict: true` doing its job. So the matching is confirmed by behaviour, not only by string
equality. **Those job names are load-bearing.** Renaming a job, splitting one in two, or adding a third gate job without updating
the required contexts wedges every open pull request with no error message anywhere. If pull requests start
hanging on "Expected — Waiting for status to be reported", this is why: compare the two lists above before
looking at anything else.

### Dependabot

- **Action bumps** arrive as one grouped pull request. They edit `.github/workflows/` directly, which is
  the file that runs, so a green pull request can just be merged. Before 2026-09-08 they could not: the
  workflows were generated copies and every action bump failed the drift check. That is fixed at the
  root, not worked around.
- **`typescript` is pinned below 7** in `.github/dependabot.yml`. Not a preference — every
  typescript-eslint release still declares `peer typescript ">=4.8.4 <6.1.0"`, so TypeScript 7 cannot be
  installed here, and Dependabot's retry-with-`--force` path failed the entire npm ecosystem run when it
  tried. Remove the `ignore` entry when typescript-eslint's peer range admits 7.
- **Labels referenced in `dependabot.yml` must exist in the repository.** Dependabot does not create
  them; it comments on the pull request and skips labelling. `dependencies` and `ci` were created on
  2026-09-08 after it did exactly that.

---

## 3b. The tombstone service worker — do not delete `infra/pages/sw.js`

**Status: live since 2026-09-08. Since slice F3 it is also the offline worker's kill switch (§3c), so it no
longer has a removal date.** The 2027-09-08 floor further down was set for its first job alone.

`infra/pages/sw.js` is what `dist/sw.js` is whenever `featureFlags.serviceWorker` is off; `scripts/lib/pwa.mjs`
emits it (it used to be a small plugin in `vite.config.ts`). It is not a PWA and not a feature, and nothing
registers it. It exists to be found by the update checks of browsers holding a worker it should remove: first the
archived 3D build's, and now, if it is ever needed, the F3 worker's.

### Why it cannot simply be deleted

The archived build (`archive/v0.1`) ran `vite build && node scripts/build-sw.mjs`, generating a real
Workbox worker. It shipped: deploy run
[34222875457](https://github.com/kinncj/OhCanada/actions/runs/34222875457) logged
`sw.js: precaching 97 files, 14.71 MB`, and `./sw.js` appears in that run's uploaded artifact listing. It
registered at `/OhCanada/sw.js` with the whole site as its scope.

Slice 0 emits no worker, so that URL began returning 404. **A 404 does not remove a service worker.** Per
the Service Worker specification, when an update check fails to fetch the script the existing registration
is *retained*. Slice 0 also ships no eviction code, so an affected browser has nothing that can clear it.

It is not fatal, and it is worth being precise about why, because the symptom is confusing:

- The old worker is **NetworkFirst for navigations** with a 4 second timeout, and `index.html` was
  deliberately never precached. On a healthy connection the live site loads normally. This is why the site
  tests clean in a fresh browser while a real user reports a stuck loader.
- Past 4 seconds it falls back to its cached shell, which references hashed bundles that no longer exist.
  The user gets the old 3D loading screen stuck at 0%. Slow connection, broken page; fast connection, fine.
- It also holds roughly 15 MB of dead cache indefinitely and adds a worker hop to every navigation.

Serving a real script at that URL is the only thing that can reach those devices. The tombstone replaces
the old worker, deletes its caches, unregisters itself and reloads the open pages — one visit, no user
action. It has **no `fetch` handler** and must never gain one.

### What protects it

`scripts/deploy-check.mjs` runs on every `make build`, before any upload. While `featureFlags.serviceWorker`
is off it fails if `dist/sw.js` is missing, if it contains a `fetch` handler, if it stops calling
`registration.unregister()`, or if anything in the build still registers a worker. In either mode it fails if
anything in the build statically references `sw.js` (which would charge it to the initial-payload budget it is
not part of). The missing-file, fetch-handler, unregister and static-reference clauses were confirmed to fail on
a real violation in slice 0. The "still registers" clause came with F3 and was confirmed the same way on
2026-09-14 — and its first version missed the very registration F3 writes, which is why it now matches that
script word for word as well as any `register(...sw.js)` call.

### Caveats

- **Cache headers.** GitHub Pages serves `sw.js` with `cache-control: max-age=600`. That does not delay
  the fix: the archived registration used `updateViaCache: 'none'`, so the update check bypasses the HTTP
  cache. It does mean a *change* to the tombstone can take up to 10 minutes to propagate to new visitors.
- **It only deletes its own caches.** `kinncj.github.io` is one origin shared by every project on the
  account, so `caches.keys()` returns other repositories' caches too. The worker filters to
  `truenorth-*` and names containing its own registration scope.

### Before removing it

Not while the F3 worker exists: this file is its kill switch (§3c). The 12-month floor, 2027-09-08, still
describes the archived worker — there is no way to measure when no browser holds that registration any more,
because there are no analytics, by design (ADR-0006) — but it no longer ends this file's life. If the F3 worker is
ever retired for good, ship with the flag off for twelve months first, for the same reason, and only then delete
`infra/pages/sw.js`, its branch in `scripts/lib/pwa.mjs` and the tombstone clauses in `scripts/deploy-check.mjs`
together.

---

## 3c. The offline service worker (slice F3) — and how to turn it off

**Status: built 2026-09-14; not yet deployed when this was written.** ADR-0034 is the decision; this is what an
operator needs.

`dist/sw.js` is a Workbox worker built from `infra/pages/service-worker.js` by `scripts/lib/pwa.mjs`. It precaches
the shell and every code chunk (30 files, 3.46 MB), caches each level's art the first time that level is played,
answers every navigation from the network first, takes over as soon as a new build installs, and never touches
IndexedDB or `localStorage`. `dist/index.html` registers it; `dist/manifest.webmanifest` and `dist/icons/` make the
game installable.

### Turning it off (the kill switch)

Use this when the worker itself is the problem — the site loads for a first-time visitor but misbehaves for
returning ones, the precache install fails, or cached art is wrong. It is faster than a rollback because it keeps
the current build:

1. In `content/game.config.json`, set `featureFlags.serviceWorker` to `false`. One line, through a normal pull
   request, so the gates run.
2. Merge. The deploy ships `dist/sw.js` as the tombstone (§3b) and `dist/index.html` with no registration;
   `deploy-check` refuses a build in which anything still registers a worker.
3. Each device holding the worker fetches the tombstone on its next navigation — the registration bypasses the
   HTTP cache — which deletes the `truenorth-*` caches and the precache, unregisters, and reloads the page onto the
   network. Saves are not touched.
4. Confirm: `curl -s https://kinncj.github.io/OhCanada/sw.js | head -3` shows `TOMBSTONE SERVICE WORKER`.

Turning it back on is the same line set to `true`.

Exercised locally on 2026-09-14, not on the live site: a build with the flag off produced the tombstone at
`dist/sw.js`, no registration in `dist/index.html`, and a green `deploy-check` ("service worker OFF: tombstone
sw.js present and inert, nothing registers it"). The same day, eleven deliberate violations of the worker's and
the manifest's checks were injected into a built `dist/` one at a time, and each failed `deploy-check` with a
message naming it.

### What CI does with it

`tests/e2e`, `tests/perf` and `tests/a11y` run with `serviceWorkers: 'block'`, so no spec but two ever sees a
worker, and the perf lane keeps measuring a first load on a cold cache. `tests/e2e/offline.spec.ts` allows it,
plays the start level online, goes offline, and opens the level and the title again. If that spec is red and
nothing else is, the worker, the precache or the level art cache regressed.

`tests/e2e/update-notice.spec.ts` allows it too. It stands in for a second deploy by appending a comment to
`dist/sw.js` between two visits — `vite preview` reads the file on every request — and writes the original back
after the test. The browser jobs check `dist/`'s digest before any test runs and the deploy downloads the artefact
again, so the rewrite reaches nothing that ships. If that spec is red and `offline.spec.ts` is not, the update
notice or its trigger (`app/bootstrap/update-notice.ts`) regressed, not the worker. A local `make build` after a
run that was killed mid-test rebuilds `dist/`, which is the fix for a `sw.js` left rewritten.

---

## 4. Budgets and what fails on breach

`scripts/deploy-check.mjs` runs as part of `make build`, before anything is uploaded. It fails on:

| Check | Source of the limit |
|---|---|
| Any built file over 100 MiB | GitHub Pages hard cap (ADR-0006) |
| Initial payload over `budgets.initialPayloadBytes` | CLAUDE.md budgets |
| Fetchable `dist/` over `budgets.totalPayloadBytes` | CLAUDE.md budgets |
| `basePath` not matching the publishing repository | ADR-0006 |
| `dist/sw.js` missing, or statically referenced by the page | this runbook, §3b |
| `featureFlags.serviceWorker` off: `dist/sw.js` serves fetches, does not unregister, or something still registers a worker | ADR-0034, this runbook §3b |
| `featureFlags.serviceWorker` on: the worker's precache misses a chunk, reaches outside `dist/`, lacks a revision on an un-hashed file, or exceeds `budgets.initialPayloadBytes`; its level art disagrees with `dist/manifest.json`; or `dist/index.html` does not register it | ADR-0034, this runbook §3c |
| `dist/manifest.webmanifest` missing, unlinked, off the base path, not portrait, or without a real 192 and 512 PNG and a maskable icon | ADR-0034 (Chromium's install criteria) |
| A level over `budgets.levelPayloadBytes` | CLAUDE.md budgets, via `scripts/lib/level-payload.mjs` |
| A level over its `textureBudgetBytes`, or over the 64 MiB decoded-texture ceiling | CLAUDE.md budgets, via `scripts/lib/texture-memory.mjs` |
| A full-screen parallax layer shipping a 2x variant | owner's decision, slice 1; same gate |

"Initial payload" is defined precisely in the header of that script: `index.html` plus everything it
statically references plus everything those chunks reach by static ES import, excluding `.map` files and
excluding dynamic `import()`. Source maps ship — they cost a player nothing because a browser fetches them
only with DevTools open, and this is an open-source project where being debuggable in the field is worth
more than the bytes in the repository. That justification was thin while the repository was private and is
sound now that it is not: `vite.config.ts` emits maps with `sourcesContent`, so the TypeScript has always
been readable at the Pages URL, and since 2026-09-08 it is readable in the repository too. Publishing it
twice is consistent rather than incongruous, and `sourcemap: true` stays. The 10.9 MiB of `.map` counts
against the 1 GB repository cap and the 100 MB per-file cap, both of which are checked above and neither of
which is close. The rule that follows from it is unchanged and absolute: **never place a secret in this
tree** — it is published as the repository and again as the sourcemaps, and neither can be taken back.

The last three also run inside `make assets`, over `assets/dist/` rather than `dist/`, in the same process
and under the same exit code — so there is no way to build assets and skip them. `make check-assets` and
`make check-textures` run them alone.

### The performance job — what it asserts, and what it does not

Blocking since 2026-09-13, in both `ci.yml` and `deploy-pages.yml`. Before that it timed frames on a GitHub runner,
which has no GPU, and failed on every run behind `continue-on-error` without once describing the build. The
full history and the protocol are in `tests/perf/README.md`; what an operator needs is below.

`make test-perf` asserts budgets a GPU-less runner measures **exactly**, because they count the work the build hands
the GPU rather than how fast it is done:

| Budget | Measured by | Source of the limit |
|---|---|---|
| Overdraw <= 4x screen area per frame, at every tier the runner visited | `tests/perf/gl-census.ts`: every triangle clipped to the viewport, summed, attributed per frame to the tier in effect | CLAUDE.md budgets |
| Texture bytes the GPU holds <= the level budget (48 MiB Ottawa, 64 MiB ceiling) | the same census, reconciled to the byte against the manifest | CLAUDE.md, level document |
| Initial payload a browser transfers <= 8 MiB | Playwright request sizes | `content/game.config.json` |
| Time to playable on the runner <= 6 s | wall clock — a tripwire, **not** the phone budget | `content/game.config.json` |

`tests/perf/calibration.spec.ts` runs in the same job and proves the census against WebGL scenes with known answers
first. If calibration fails, believe nothing else in that run.

Every budget ends in one of three outcomes, printed as separate sections, separate annotation titles and separate
rows on the job summary page:

- **HELD** — green.
- **BREACHED** — red. The build spends more than its budget. Read the detail: it carries the tier, the renderer and
  the numbers that make the figure attributable. Fix the build, not the number; a budget changes only by ADR.
- **NOT MEASURED** — red, and **not** a statement about the build. The instrument could not take the measurement,
  and the line says why (an undecodable draw, a stale vertex read, a tier with too few attributable frames).
  Everything this lane asserts is measurable on a runner, so this means the census or the page broke. Do not
  re-run until it goes green; find the reason in the line.

Printed on every run, green or red, under **NOT CHECKED HERE**: frame time, per-character cost, particles and
time-to-play on a phone. **A green perf job says nothing about frame time, and nothing about particles** — the scene
probe's `data-particles` has two writers (allowance and emission), so nothing can measure that budget until it is
split. Those are checked by `make test-perf-device` on hardware
with a GPU, recorded with `make record-perf-device DEVICE="..."` in `tests/perf/device-record.json`, and the job
prints the newest pass (or `NONE RECORDED`). A laptop pass is not an iPhone 13 pass; `tests/perf/README.md` says how
a phone pass is taken by hand.

The perf job is in the `gate` / `browser` loop. **Never give it — or any job in that loop — a job-level
`continue-on-error`:** measured on run 34427461281, that flag makes `needs.<job>.result` read `success` whatever
happened, so the gate would pass over a red job. A job that must not block leaves the loop instead, and says so.

### When the deploy fails on decoded texture memory

This is the one that reads as a surprise, because the download budget will be nowhere near troubled when it
fires. They are different quantities over the same files: a WebP is small on the wire and is
`width x height x 4` once the GPU holds it. A 2160x3840 sky is 31.6 MiB decoded and about 33 kB
transferred — a factor of a thousand. **This is the constraint that killed this project's predecessor:**
roughly 190 textures, WebGL context lost around 538 MB, on an iPhone that had reported every capability as
available, and found by a user rather than by us.

So do not respond to it by turning compression up; compression does not exist on the GPU. The three real
answers, in order of preference:

1. **Author the source smaller.** The failure names the heaviest textures with their pixel dimensions. A
   parallax layer that repeats (`repeatX` in the level document) does not need to be as wide as the level.
2. **Split it into tiles that repeat.** Art-bible 6: a layer tiles at the seam anyway.
3. **Drop the layer.** Cheaper than a lost context.

Lowering the number is not on that list. `textureBudgetBytes` may be made *stricter* than the 64 MiB
ceiling in a level document at any time; it may not be made looser, and the gate refuses a level document
that tries. Raising the ceiling itself means an ADR plus the same number in CLAUDE.md,
`content/schemas/level.schema.json`, `scripts/lib/texture-memory.mjs` and
`app/adapters/phaser/level-document.ts`, which is deliberately tedious.

The number the gate prints on a green run is the real one, per device scale — read it rather than trusting
the pass. As of 2026-09-08, Ottawa holds 38.23 MiB of 48.00 MiB declared (64 MiB global), 23.41 MiB on a 1x
device and 38.23 MiB on a 2x device.

If a budget is genuinely too small for what the game needs, the fix is an ADR that changes the number in
`content/game.config.json`, not a change to the check.

---

## 5. Verifying build determinism

The rollback story rests on "re-running an old run rebuilds the same site". Check it like this:

```
make build && sha256sum dist/index.html dist/assets/* | sort > /tmp/build-a
make build && sha256sum dist/index.html dist/assets/* | sort > /tmp/build-b
diff /tmp/build-a /tmp/build-b && echo "deterministic"
```

If that ever differs, something in the build is reading the clock, the environment or the network, and
rollback stops being predictable. Find it before you need it.

---

## 6. Known gaps

Recorded here rather than left implicit. None of these are "fine"; they are simply not yet done.

- ~~**The rollback procedure in §1 is untested.**~~ Closed 2026-09-08. Drilled end to end on the live
  site: re-ran the older run and confirmed by HTTP status that the older build was served, then re-deployed
  the newest. Run URLs and the reasoning are in §1. This closes the dated obligation ADR-0006 opened with
  infra as owner; that ADR's line claiming rollback is "documented, not tested" is now out of date and
  should be amended by the architect.
- ~~**`app/ui/rotate-overlay.ts` is excluded from coverage.**~~ Closed. `tests/unit/ui/rotate-overlay.test.ts`
  covers all 53 executable lines (100% lines, functions and branches) against a document double under
  `environment: 'node'`, and the exclusion line has been deleted from `vitest.config.ts`. The coverage
  `exclude` list now holds only the three browser entry points, which cannot be imported outside a browser
  and are proven by the Playwright suites instead.
- ~~**No Pages deploy has ever run.**~~ Closed 2026-09-08. The site is live at
  <https://kinncj.github.io/OhCanada/> and the pipeline has deployed repeatedly, including two re-runs of
  older commits during the §1 drill.
- ~~**The repository is private while the project is open source.**~~ Closed 2026-09-08 by the owner, and
  recorded in ADR-0006. The repository is public; the 500 MB Actions storage cap that blocked a deploy that
  morning no longer applies, and the §3 write-up of that failure has been reframed as a private-fork
  concern rather than a description of this repository.
- ~~**A 500 MB Playwright report is one failing CI run away.**~~ Closed 2026-09-08, as hygiene rather than
  necessity — the quota that made it urgent is gone. `maxFailures: 5` on CI, `trace: 'on-first-retry'`,
  `video: 'off'`, one uploaded artifact instead of two, 14-day retention. Measured against a deliberately
  broken build: 3.78 MiB uploaded before, 1.97 MiB after, and 6.3x less evidence per failure on a build
  large enough to make traces heavy. Numbers, and what each setting trades away, are in §3. **No size
  ceiling was added**, deliberately: nothing breaks when one is crossed, and a gate with no consequence is
  worse than no gate.
- ~~**OBLIGATION due=2026-09-22 owner=infra** — record the fork-safety property in `docs/runbook.md` §3 as
  a named invariant, including the `pull_request_target` prohibition and why it matters (ADR-0006).~~
  **DISCHARGED 2026-09-08** — §3 carries it as "INVARIANT — a fork pull request cannot reach the deploy
  job": six numbered rules, the reasoning behind the `pull_request_target` and `workflow_run` prohibitions,
  the backing repository settings with the `gh api` calls that read them, and the one accepted weakness.
  Written as rules rather than as a description of the present arrangement, which was the point.
- ~~**`main` has no branch protection and no ruleset.**~~ Closed 2026-09-08 by the owner. Both `ci.yml`
  jobs are required status checks with `strict: true`, one approving review is required, and
  `require_code_owner_reviews: true` makes `.github/CODEOWNERS` binding on pull requests instead of
  advisory. Force pushes and branch deletion are refused for everyone. **Closed with classic branch
  protection, not a ruleset** — the bullet asked for a ruleset, `gh api .../rulesets` still returns `[]`,
  and that difference is a choice of API rather than unfinished work. Settings and the exact required
  contexts are in §3.
  What is left of this gap is one deliberate residue, `enforce_admins: false`: the protection binds
  contributors, not the maintainer, so a direct push to `main` still bypasses both the checks and the
  review. That was the owner's explicit choice among three options and is recorded rather than reopened.
- ~~**A stray directory named `git@github.com:kinncj/`**, created by a `git clone <url> <url>` typo.~~
  Closed. Inspected before removal: 18 files, all stock hook samples, no remotes, an unborn `master` with no
  commits and empty `objects/` — nothing recoverable. Deleted, along with the `.gitignore` rule that existed
  only to stop it being committed. If it reappears, delete it rather than re-adding the ignore rule: an
  ignore entry would have documented the typo in the repository permanently.
- **OBLIGATION due=2026-10-14 owner=infra** — re-drill §1 across the F3 service worker (ADR-0034) once two
  deploys that carry it exist: in a browser that has installed the newer build's worker, re-run the older run,
  confirm on the next load that the older build is served and that `truenorth-level-*` holds only the older
  build's art, then re-deploy the newer and confirm the reverse. §1's drill predates the worker, and "re-drill
  when the deploy pipeline changes shape" is this change. Record the run URLs here. Exercise the §3c kill switch
  on the live site only if the owner agrees: it reloads every open page.
