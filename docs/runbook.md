# Runbook

Operational procedures for TrueNorth. Everything here is meant to be followed under pressure by someone
who did not write it, so it says what to click, not what to understand.

Scope: one static site on GitHub Pages, no server, no database, no accounts, no analytics. There is no
customer data to lose and no state to migrate. The only thing that can break in production is *which build
is being served*, which is why rollback is the first section.

---

## 1. Rollback: put the previous build back

**Status of this procedure: WRITTEN, NOT YET EXERCISED — PENDING FIRST DEPLOY.**
Slice 0 has not landed on `main`, so `Deploy to GitHub Pages` has never run and no successful run exists to
re-run. Nobody has performed the steps below on this repository. Do not treat it as proven until the
"After the first real deploy" checklist at the end of this section has been ticked off, with the run URL
recorded. ADR-0006 was amended to match: it now claims this procedure is documented, not tested, and
carries the dated obligation to exercise it once two successful deploys exist.

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

### After the first real deploy — tick these off and update this file

- [ ] `Deploy to GitHub Pages` has completed successfully at least twice (so there is a previous run).
- [ ] Re-ran the *older* of the two runs from the Actions tab.
- [ ] Confirmed the site served the older build afterwards (check the hashed script filename in view-source).
- [ ] Re-deployed the newest run to get back to current.
- [ ] Recorded the run URLs and the date here, and changed the status line at the top of this section.

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

- **Source of truth is `infra/github/workflows/`.** `.github/workflows/` is a byte-identical copy;
  `scripts/deploy-check.mjs` fails the build if the two drift. Repair with `make sync-workflows`.
- **`ci.yml`** runs on pull requests only, in two parallel jobs, calling Makefile targets and nothing else.
- **`deploy-pages.yml`** runs on push to `main` and on manual dispatch. It runs the *same* gate set before
  it builds and uploads, so the bytes that ship are the bytes that were verified. This is deliberate; the
  alternative (`workflow_run` gating on CI) is discussed in the header comment of that file.
- Everything a workflow does is a `make` target. If you cannot reproduce a CI failure locally by running
  the same target, that is a bug in the pipeline, not a flake to be re-run.

### Known wrinkle: Dependabot and the workflow copies

Dependabot's `github-actions` ecosystem only sees `.github/workflows/`. An action bump therefore edits the
copy and not the source, and `deploy-check` will fail that PR with a drift error. This is intended — the
fix is to apply the same bump to `infra/github/workflows/` and run `make sync-workflows`.

---

## 4. Budgets and what fails on breach

`scripts/deploy-check.mjs` runs as part of `make build`, before anything is uploaded. It fails on:

| Check | Source of the limit |
|---|---|
| Any built file over 100 MiB | GitHub Pages hard cap (ADR-0006) |
| Initial payload over `budgets.initialPayloadBytes` | CLAUDE.md budgets |
| Fetchable `dist/` over `budgets.totalPayloadBytes` | CLAUDE.md budgets |
| `basePath` not matching the publishing repository | ADR-0006 |
| `.github/workflows` drifted from `infra/github/workflows` | this runbook, §3 |

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

- **The rollback procedure in §1 is untested.** See the status line there.
- ~~**`app/ui/rotate-overlay.ts` is excluded from coverage.**~~ Closed. `tests/unit/ui/rotate-overlay.test.ts`
  covers all 53 executable lines (100% lines, functions and branches) against a document double under
  `environment: 'node'`, and the exclusion line has been deleted from `vitest.config.ts`. The coverage
  `exclude` list now holds only the three browser entry points, which cannot be imported outside a browser
  and are proven by the Playwright suites instead.
- **No Pages deploy has ever run.** Slice 0 lists task 0.10 as done with the note "deploy unverified until
  slice-0 lands on main". That is still true.
- ~~**A stray directory named `git@github.com:kinncj/`**, created by a `git clone <url> <url>` typo.~~
  Closed. Inspected before removal: 18 files, all stock hook samples, no remotes, an unborn `master` with no
  commits and empty `objects/` — nothing recoverable. Deleted, along with the `.gitignore` rule that existed
  only to stop it being committed. If it reappears, delete it rather than re-adding the ignore rule: an
  ignore entry would have documented the typo in the repository permanently.
