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
- **A stale service worker cannot pin anyone to the broken build.** Navigations are network-first
  (ADR-0006), so the next page load fetches the rolled-back shell. Precached level assets are
  content-hashed and therefore never collide with the ones the old build asks for.
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
  `infra/github/workflows/` by `make sync-workflows`, with a drift check in `scripts/deploy-check.mjs`;
  that mirror was removed on 2026-09-08 and `infra/README.md` explains why. Ownership of these files —
  they hold `pages: write` and `id-token: write` — is enforced by `.github/CODEOWNERS`.
- **`ci.yml`** runs on pull requests only, in two parallel jobs, calling Makefile targets and nothing else.
- **`deploy-pages.yml`** runs on push to `main` and on manual dispatch. It runs the *same* gate set before
  it builds and uploads, so the bytes that ship are the bytes that were verified. This is deliberate; the
  alternative (`workflow_run` gating on CI) is discussed in the header comment of that file.
- Everything a workflow does is a `make` target. If you cannot reproduce a CI failure locally by running
  the same target, that is a bug in the pipeline, not a flake to be re-run.

### Deploy fails at "Upload artifact" with a 403

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

**This is the Actions storage quota, not a permissions problem.** The message says "Forbidden" and points
nowhere useful. The repository is currently **private**, so it has a 500 MB Actions artifact allowance; it
was holding 1,088 MB, of which two failed-CI `playwright-report` artifacts from the archived 3D branch were
524 MB and 537 MB. The content upload succeeds and only the finalize call is rejected, which is why it
looks like an auth failure.

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

Two things that would stop it recurring, neither of them mine to do alone:

- **Make the repository public.** Public repositories have no Actions storage charge, and the project is
  meant to be public anyway — the licence is MIT/CC-BY/CC0, and `.github/CODEOWNERS` already assumes pull
  requests from strangers. The private setting is the anomaly here, not the quota.
- **Stop Playwright writing 500 MB reports on failure.** A half-gigabyte report is video and traces. The
  knobs are `video`, `trace` and `screenshot` in `tests/*/playwright.config.ts`, which the test owner
  controls. The workflows keep these artifacts for 3 days, which caps the damage but does not prevent it.

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

## 3b. The tombstone service worker — do not delete `dist/sw.js`

**Status: live since 2026-09-08. Earliest removal date: 2027-09-08.** Not before, and check the evidence
below before removing it even then.

`dist/sw.js` is built from `infra/pages/sw.js` by a small plugin in `vite.config.ts`. It is not a PWA and
not a feature. Nothing registers it, nothing imports it, and slice 0 has no service worker. It exists
solely to be found by update checks from browsers that are still carrying the archived 3D build's worker.

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

`scripts/deploy-check.mjs` runs on every `make build`, before any upload, and fails if `dist/sw.js` is
missing, if it contains a `fetch` handler, if it stops calling `registration.unregister()`, or if anything
in the build starts statically referencing it (which would charge it to the initial-payload budget it is
not part of). All four were confirmed to fail on a real violation, not merely to pass.

### Caveats

- **Cache headers.** GitHub Pages serves `sw.js` with `cache-control: max-age=600`. That does not delay
  the fix: the archived registration used `updateViaCache: 'none'`, so the update check bypasses the HTTP
  cache. It does mean a *change* to the tombstone can take up to 10 minutes to propagate to new visitors.
- **It only deletes its own caches.** `kinncj.github.io` is one origin shared by every project on the
  account, so `caches.keys()` returns other repositories' caches too. The worker filters to
  `truenorth-*` and names containing its own registration scope.

### Before removing it

Removal is safe only once no browser can still hold the old registration. There is no way to measure that
directly — there are no analytics, by design (ADR-0006). Hence the 12 month floor. When the date passes,
delete `infra/pages/sw.js`, the plugin in `vite.config.ts`, and the `sw.js` clauses in
`scripts/deploy-check.mjs` together, and say in the commit message that the tombstone expired.

---

## 4. Budgets and what fails on breach

`scripts/deploy-check.mjs` runs as part of `make build`, before anything is uploaded. It fails on:

| Check | Source of the limit |
|---|---|
| Any built file over 100 MiB | GitHub Pages hard cap (ADR-0006) |
| Initial payload over `budgets.initialPayloadBytes` | CLAUDE.md budgets |
| Fetchable `dist/` over `budgets.totalPayloadBytes` | CLAUDE.md budgets |
| `basePath` not matching the publishing repository | ADR-0006 |
| `dist/sw.js` missing, serving fetches, or in the initial payload | this runbook, §3b |

"Initial payload" is defined precisely in the header of that script: `index.html` plus everything it
statically references plus everything those chunks reach by static ES import, excluding `.map` files and
excluding dynamic `import()`. Source maps ship — they cost a player nothing because a browser fetches them
only with DevTools open, and this is an open-source project where being debuggable in the field is worth
more than the bytes in the repository.

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
- **The repository is private while the project is open source.** MIT/CC-BY/CC0 licences, a CODEOWNERS
  file that assumes pull requests from strangers, and a public Pages site — but the repository itself is
  private, which is what put a 500 MB Actions storage cap in the way of a deploy on 2026-09-08 (§3). Not
  an infra decision to make unilaterally; flagged for the owner.
- **A 500 MB Playwright report is one failing CI run away.** Retention on the failure-only artifacts is
  now 3 days, which caps how long the damage lasts but not the size. The `video`/`trace`/`screenshot`
  settings in `tests/*/playwright.config.ts` are the actual fix and belong to whoever owns `tests/`.
- ~~**A stray directory named `git@github.com:kinncj/`**, created by a `git clone <url> <url>` typo.~~
  Closed. Inspected before removal: 18 files, all stock hook samples, no remotes, an unborn `master` with no
  commits and empty `objects/` — nothing recoverable. Deleted, along with the `.gitignore` rule that existed
  only to stop it being committed. If it reappears, delete it rather than re-adding the ignore rule: an
  ignore entry would have documented the typo in the repository permanently.
