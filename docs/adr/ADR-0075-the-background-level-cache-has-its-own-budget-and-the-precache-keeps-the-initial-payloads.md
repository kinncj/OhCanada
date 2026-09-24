# ADR-0075: The background level cache has its own budget, and the precache keeps the initial payload's

- Status: Accepted (2026-09-24).
- **Amends ADR-0034**, two passages. In "A level never played online (amended 2026-09-15)", *Why the budget
  allows it*: "`deploy-check` now holds **the precache plus every level art file** under that ceiling" becomes
  two ceilings, one per thing downloaded (§1 below). In *Budgets*: "The level caches are bounded by the art the
  build ships, which is inside `budgets.totalPayloadBytes`" gains a tighter bound, `budgets.backgroundCacheBytes`.
  Both passages are annotated in the same commit. Nothing else in ADR-0034 moves. The worker still caches every
  level's art in the background once it controls a page, both scales, Save-Data still turns that off, and a level
  whose art is not cached still says it needs a connection.
- **Does not amend `CLAUDE.md`.** No budget there changes. Initial payload stays ≤ 8 MB, each level ≤ 8 MB,
  total ≤ 100 MB and time-to-play ≤ 6 s. The new key is a bound inside "total ≤ 100 MB", not a relaxation of
  "initial payload ≤ 8 MB" (§3).
- Slice: F3b (ADR-0034's amendment), and L8 (Kingston), where it is step K-0.1 of `docs/plan/kingston.md` on
  branch `kingston-gate`.
- Numbering. `git log --all --name-only -- docs/adr` over every ref this checkout can see, after fetching all
  nine remote heads, puts the high-water mark at 0074. 0073 is taken twice on different branches, and 0074
  reuses the second 0073's title. No ref names a 0075. **0075 is the first number above the mark.**

## Context

ADR-0034's 2026-09-15 amendment made every level playable offline by caching all level art in the background.
It had to say what bounded those bytes. It chose the ceiling the precache already had,
`budgets.initialPayloadBytes` (8 MiB, 8,388,608 B), and made `scripts/deploy-check.mjs` hold **the precache plus
all level art** under it. Its reason was that a first visit that stays downloads both. It also said that when the
art outgrew that ceiling, "this decision is reopened rather than made expensive by accident". This record is that
reopening.

**Measured on `bf54f66`** with `make assets && make build`, reading the two blocks `deploy-check` reads out of
`dist/sw.js`:

| what | files | bytes |
|---|---|---|
| Precache: shell, every code chunk, the question banks, the lessons, the fonts, the map | 46 | 4,946,369 |
| Level art, both scales, shared files counted once | 112 | 3,210,723 |
| … of which the shared character atlas (both scales, drawn by all ten levels) | 4 | 744,148 |
| … of which each level's own art | 108 | 126,114 (Halifax) to 449,674 (the North). Median 231,834 (Québec City), mean 246,658 |
| **Together, held to 8,388,608** | 158 | **8,157,092. Headroom 231,516** |

The headroom figure is 8 B more than `kingston.md`'s 231,508, from a different `index.html`. It does not change
anything below.

Four things follow.

1. **An eleventh level fails the build.** Kingston's own art at the median is 318 B over. With the four
   landmarks and full layer set `TN-LEVEL-kingston` asks for, it will be at or above the median. Its level
   document, quest and locale rows also enter the precache.
2. **The limiting term is not art.** The precache grew from 3,464 kB (2026-09-14) to 3,621 kB (2026-09-15) to
   4,946 kB today. That is +1,325 kB in nine days: the bundled faces (258 kB, ADR-0071) and the lesson
   passages (ADR-0061, ADR-0070). Art grew by about 150 kB over the same period. ADR-0070's ratchet says 468 of
   493 verified questions still have no passage, so the lessons will keep growing. Under one combined number, a
   lesson commit by `content` can fail on a message that tells `art` to make its art smaller.
3. **One number with two owners is a boundary defect.** The precache is code and content. The level art is
   art. Each is gated elsewhere by its own owner's budget (`initialPayloadBytes` for what the page needs,
   `levelPayloadBytes` for each level). Their sum has no owner, so no one can act on it without negotiating
   with the other.
4. **Neither download is in time-to-play.** The worker registers on `load`. The precache installs after the page
   has what it needs, and the background art cache starts only once the worker controls a page. The perf lane
   measures time-to-play and the initial payload with `serviceWorkers: 'block'` (ADR-0034). What the combined
   gate really bounds is **what a first visit that stays costs in data**, not how long it waits. That is a real
   cost for this audience: newcomers, often on prepaid mobile data. It deserves its own ceiling, named for what it
   is, rather than borrowing one that means something else.

## Decision

### 1. Two ceilings, one per download, each with one owner

`deploy-check` holds the service worker's two downloads to **two independent budgets** and no longer adds them
together:

| download | budget key | value | owner who pays for a breach |
|---|---|---|---|
| The precache the worker installs (unchanged rule) | `budgets.initialPayloadBytes` | 8,388,608 B (8 MiB), unchanged | whoever grew the code or content chunks |
| **Every level's art, both scales, which the worker caches in the background** (ADR-0034, half 1) | **`budgets.backgroundCacheBytes`** (new) | **5,242,880 B (5 MiB)** | art |

- **What counts toward `backgroundCacheBytes`.** Every path in the worker's injected level-art block
  (`tn:level-art`), sized on disk in `dist/`, **each file once**, however many levels name it. That is what the
  device stores. It is the same set and the same arithmetic `deploy-check` uses today for its `artBytes`. Level
  art is not also in the precache (ADR-0034 keeps art out of the install), so no byte is counted under both keys.
- **The precache rule does not change.** It stays under `initialPayloadBytes`, as ADR-0034's *Budgets* section
  put it before the amendment.
- **The combined check is removed**, together with its message, "Make the art smaller, or stop caching every
  level in the background". A combined breach can no longer happen without one of the two breaching. The worst
  first visit that stays is the sum of the two ceilings, which is stated in §3 and printed by the gate.

### 2. Why 5 MiB

The number is set to hold **twelve levels**, the scope ceiling today (CLAUDE.md, Scope: Σ⌊verified ÷ 30⌋ = 12),
with room left for the shared atlas to grow. It is not set to be the most the gate could tolerate.

| level art in the background | bytes | headroom under 5,242,880 |
|---|---|---|
| Today, ten levels | 3,210,723 | 2,032,157 (8.8 median levels) |
| + Kingston at the heaviest level's size (449,674) | 3,660,397 | 1,582,483 |
| + a twelfth level, also at the heaviest size | 4,110,071 | **1,132,809**, for the shared atlas to grow (new NPCs) and for levels heavier than the North |

K-0.1b's acceptance line ("≥ 500 kB of headroom for an eleventh level") is met with four times the margin. A
thirteenth level is outside the scope ceiling and would need an ADR anyway. At the heaviest size it would still
fit (683,135 B left) but crowd the shared atlas. **That is the point where this number is meant to be reopened,
not an accident.**

Twelve levels at the **median** own-art size would come to 3,674,391 B. At that size the key would allow 18.

### 3. What a player pays, against every budget in CLAUDE.md

| budget | effect of this decision |
|---|---|
| **Initial payload ≤ 8 MB** | None. The initial payload is 2,608.7 kB raw and is measured separately. The precache keeps this ceiling. |
| **Time-to-play ≤ 6 s on 25 Mbps** | None. Both downloads begin after `load` and after the worker takes control. The perf lane still blocks the worker. |
| **Each level ≤ 8 MB** | None. It is still enforced per level by `levelPayloadBytes`. The largest level is 0.89 MiB with the shared atlas. |
| **Total ≤ 100 MB** | Tighter. Level art on a device now has a 5 MiB bound, inside the 100 MiB bound on `dist/`. |
| **First visit that stays** (the data a player pays for) | Today 8,157,092 B, which is 2.6 s at 25 Mbps (3,125,000 B/s) in the background. Worst case allowed: 8,388,608 + 5,242,880 = **13,631,488 B (13 MiB), 4.4 s** in the background. A browser with Save-Data sends `everyLevel: false` and downloads only the precache and the art of the levels it opens (ADR-0034). |

Today's first visit does not grow. What grows is the room the gate leaves: from 231,516 B to 3,442,239 B for the
precache, plus 2,032,157 B for art. The price is a first visit that may reach 13 MiB instead of 8 MiB. The
ADR-0034 amendment already argued why a player gets something for those bytes: every level opens offline, not
only the ones already played.

### 4. Offline play is unchanged

Every level's art is still cached in the background. `checkLevelAvailability` still refuses to open a level
offline whose art is missing. `tests/e2e/offline.spec.ts` needs no change. The worker (`infra/pages/service-worker.js`),
its build (`scripts/lib/pwa.mjs`), the `truenorth:warm` message and the registration script do not change.
**This decision has no service-worker configuration change.** `pwa.mjs`'s `maximumFileSizeToCacheInBytes` keeps
reading `initialPayloadBytes`. It is a per-file cap on the precache and is unrelated to this change.

### 5. The contract lands with this record. The gate lands with infra

`tests/unit/contracts/ports-match-schemas.test.ts` binds `content/schemas/game.config.schema.json#/$defs/budgets`
to `PerformanceBudgets` in `app/application/ports/content-repository.ts`. `make validate-content` rejects a
config key the schema does not declare. So the port, the schema and the config value must land in one commit,
and three owners' files would have been in it. **That is a boundary defect, and this record fixes it by landing
the contract itself, in this commit:**

- `app/application/ports/content-repository.ts`: `PerformanceBudgets` gains
  `readonly backgroundCacheBytes: number;` (architect, ports).
- `content/schemas/game.config.schema.json`: `budgets.properties.backgroundCacheBytes`, an integer ≥ 1, in
  `required`. It is a contract file, and ADR-0007 makes it the authority the port mirrors.
- `content/game.config.json`: `"backgroundCacheBytes": 5242880`. The number is this ADR's decision, not authored
  content. Changing it later requires a new ADR, as for every budget.

No code in `app/` reads the key. `app/bootstrap/game-rules.ts` reads only `timeToPlayMs`. So no screen, scene or
test in `app/` changes. Infra's commit then touches only `scripts/`, `tests/unit/infra/` and `docs/runbook.md`,
all of them infra's. Until that commit lands, the key exists and the old combined check is still the only
check. That is stricter than this decision, not looser, so there is no window in which a breach passes.

## Obligations

Written in ADR-0009's format.

- **OBLIGATION due=2026-10-08 owner=infra** — implement §1 in `scripts/deploy-check.mjs` and prove the gate
  fails on a real breach (K-0.1b). Exactly:
  1. **Move the service worker's byte arithmetic into a pure module**, `scripts/lib/worker-budget.mjs`, exporting
     `checkWorkerBudgets({ distDir, precacheUrls, levelArt, budgets })`. It returns
     `{ precacheBytes, artBytes, failures }`. It sizes each precache URL and each level-art path from disk
     under `distDir`, each file once. `deploy-check.mjs` calls it where the precache sum (lines 507–570 on
     `bf54f66`) and the combined check (lines 631–657) are today, and pushes its `failures` through `fail`. This
     is the same pattern as `checkTextureMemory`: the test drives the same function the build does.
  2. **Precache clause (unchanged rule, same key):** precache bytes > `budgets.initialPayloadBytes` fails with
     the existing message ("dist/sw.js precaches … the ceiling is budgets.initialPayloadBytes …").
  3. **Background clause (new):** level-art bytes > `budgets.backgroundCacheBytes` fails with
     `dist/sw.js caches every level's art in the background, <n> file(s) over <l> level(s), <kB>; the budget is
     budgets.backgroundCacheBytes, <MiB> (<B> B). Make the heaviest level's art smaller, or change the budget in
     an ADR (ADR-0075).` It must name the three heaviest levels by their own art bytes, and the shared files'
     total, so the message says who pays.
  4. **A missing, non-integer or non-positive `budgets.backgroundCacheBytes` fails** with
     `content/game.config.json has no positive numeric "budgets.backgroundCacheBytes"; the background level
     cache cannot be checked.` It does not skip, which is what the combined clause does today when
     `initialPayloadBytes` is missing. With `featureFlags.serviceWorker` off, the key is still required, and the
     clause reports `not checked (tombstone)` instead of measuring.
  5. **Delete the combined clause** and its message.
  6. **The summary line** becomes `service worker ON: precache <n> file(s), <kB> against <MiB>; then <n> level
     art file(s) over <l> level(s), <kB> against <MiB>, in the background; a first visit that stays downloads
     <kB> of at most <kB>`, so the build log shows both sets of headroom and the §3 worst case.
  7. **Test, `tests/unit/infra/worker-budget-gate.test.ts`**, over real files of exact sizes written into a
     scratch `dist/` (as `level-payload-gate.test.ts` does), through `checkWorkerBudgets`:
     - art exactly `backgroundCacheBytes` → no failure. **Art one byte over → one failure naming
       `budgets.backgroundCacheBytes`, not naming `initialPayloadBytes`.**
     - precache one byte over `initialPayloadBytes`, with art small → one failure naming `initialPayloadBytes`, not
       `backgroundCacheBytes`. The two clauses are independent.
     - **The retired rule stays retired:** precache and art each under their own key but together over
       `initialPayloadBytes` → no failure.
     - a shared file named by two levels is counted once. A tree sized so that counting it twice would breach
       must pass.
     - the file sizes on disk are what count. A manifest or `sw.js` that claims smaller sizes must not satisfy the
       gate.
     - the key absent, `0`, or `"5242880"` → the "no positive numeric" failure.
     - **Wiring:** `deploy-check.mjs` imports `checkWorkerBudgets` from `./lib/worker-budget.mjs`, and no longer
       contains the retired message. This is asserted on the source, so that a gate the build stopped calling
       fails a test.
  8. **`docs/runbook.md`**, the gate table row for `featureFlags.serviceWorker` on (line 502 on `bf54f66`),
     names both keys and this ADR.
  9. **Acceptance:** `make build` green on `main`, printing the new summary with 2,032,157 B ±10 kB of
     background headroom. `make test` green with the test above. Record the two measured figures in
     `docs/plan/slices.md` row F3b.

## Alternatives considered

- **(b) Cache in the background only the next open level, and cache the rest when each is played.** It would
  move about 2.1 MB off the first visit: precache 4,946,369 + shared 744,148 + Halifax 126,114 + Peggy's Cove
  246,148 = 6,062,779 B. Rejected, for three reasons.
  - **It narrows offline play**, which ADR-0034's amendment made true after a live audit found it false. A
    player who earns a stamp offline and walks on finds the level after next is not cached. The honest card
    shows, but the level does not open.
  - **It needs the save in the worker.** Which levels are "open" lives in IndexedDB (ADR-0026). The worker never
    reads it (ADR-0034), and the registration script is written by the build, not by `app/`. So `app/bootstrap`
    would have to message the worker with the unlocked set, a seam ADR-0034 kept closed on purpose.
  - **It defers the bytes; it does not bound them.** A player who has opened every level ends up holding all the
    art, exactly as today. The gate would still need a number for that worst case, which is §1's number. (b)
    needs (a) anyway.
- **(c) An art diet that pays for Kingston out of the ten.** It would have to find Kingston's art plus its
  precache growth now, and the same again for a twelfth level. It would also have to keep finding the
  precache's growth as long as the combined rule stood. At +1,325 kB in nine days, that is faster than any diet.
  It would push the cost of lesson commits onto art that is reviewed as reference-accurate (CLAUDE.md, Art), and
  it keeps Context point 3's two-owner number. Rejected as the budgeting rule. Art weight still matters, and
  `levelPayloadBytes`, texture budgets and now `backgroundCacheBytes` each still press on it.
- **Raise `initialPayloadBytes`.** That is a CLAUDE.md budget, and the perf lane measures time-to-play against
  it. Moving the time-to-play ceiling to make room for a download that is not in time-to-play would weaken the
  wrong gate. Rejected.
- **A combined key**, e.g. `firstVisitBytes` = precache + art ≤ 13 MiB. It is the same worst case as §1, but it
  keeps the two-owner number, and the gate still could not say whose bytes broke it. Rejected in favour of two
  keys with one owner each.
- **No ceiling on the background cache**, bounded only by `totalPayloadBytes` (100 MiB), which is what ADR-0034
  said before its amendment. Rejected. A first visit could then silently cost a newcomer's phone tens of
  megabytes of prepaid data, and nothing would notice.

## Consequences

- `make build` passes with an eleventh level. The precache has 3,442,239 B of headroom and the background art
  2,032,157 B, where both together had 231,516 B.
- A lesson or question commit can no longer fail on the art. A level's art commit can no longer fail on the
  lessons. Each gate names one key and one owner.
- The worst first visit a green build allows grows from 8 MiB to 13 MiB. Today's is unchanged at 8.16 MB. Save-Data
  users are unaffected.
- At the heaviest level's size, a twelfth level leaves 1.1 MB for the shared atlas to grow. When that runs out,
  the gate fails and names the heaviest levels. The next decision is an art diet or a new ADR, taken with the
  numbers in front of it.
- The precache is now the faster-growing term. It has 3.4 MB of headroom and no second gate behind it, and
  ADR-0070's teach-back backlog points at it. It is not this decision's to solve, but it will be the next budget
  record.

## References

- ADR-0034 (the worker; its 2026-09-15 amendment), ADR-0009 (obligations), ADR-0007 (schemas are the
  contract), ADR-0026 (saves in IndexedDB), ADR-0068 (Kingston), ADR-0070 (teach-back), ADR-0071 (bundled
  faces).
- `scripts/deploy-check.mjs`, `scripts/lib/pwa.mjs`, `content/game.config.json#/budgets`,
  `app/application/ports/content-repository.ts` (`PerformanceBudgets`).
- `docs/plan/kingston.md` §2 and K-0.1 / K-0.1b, on branch `kingston-gate`.
