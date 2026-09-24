# ADR-0034: The worker serves the network first and caches a level whole

- Status: Accepted (2026-09-14)

## Context

Slice F3 in `docs/plan/slices.md` promises "Workbox per level, installable, offline after first load". ADR-0006 had
already fixed the two constraints that matter most: filenames are content-hashed, and navigations are network-first
"so a stale service worker can never pin a device to an old build". It did not say how, and this project has paid
for getting that wrong once.

The archived 3D build shipped a Workbox worker at `/OhCanada/sw.js`. Its navigations were network-first with a
4-second timeout, falling back to a cached shell that pointed at bundles a later deploy had deleted, so a slow
connection got a loader stuck at 0 %. Deleting the worker did not remove it — a 404 leaves a registration in place —
and `infra/pages/sw.js`, a tombstone that deletes its caches and unregisters itself, has been served at that URL
since 2026-09-08 to clear those devices (`docs/runbook.md` §3b).

Four facts about the current build decide the rest.

1. **Code is small and art is per level.** Every chunk under `dist/assets/` — Phaser, the app, all ten level
   documents, the question bank for all ten subjects — plus the shell and the icons is 3.46 MB over 30 files. Level
   art is 92 files in `atlas/` and `img/`, 2.03 MiB in all: 0.38–0.56 MiB per level for one device scale, 0.56–0.74
   MiB with both, and `dist/manifest.json` says which level draws each file.
2. **`manifest.json` is not content-hashed**, and it names every art file by its hash. A stale copy is a stale build.
3. **The browser suites observe the network.** `tests/e2e/level-landmarks.spec.ts` fails a level load with
   `page.route`, which never sees a request a worker answers, and `tests/perf/budgets.spec.ts` weighs the responses of
   a first load against the initial payload budget.
4. **The update notice is `app/ui`'s, and infra does not edit `app/`.** Everything else in the slice — the worker,
   the web app manifest, the icons, the registration, the gates and the tests — can land without it.

## Decision

### Where the worker comes from

`scripts/lib/pwa.mjs` is a build-only Vite plugin. At the end of `vite build` it bundles
`infra/pages/service-worker.js` (Workbox 7.4.1 modules, one classic script, unminified so it can be read), computes
the precache with `workbox-build`'s `getManifest` over `dist/`, reads the level art out of `dist/manifest.json`, and
writes both into `dist/sw.js` between marked comments. It also writes `dist/manifest.webmanifest` and three icons,
and adds the manifest link, the iOS home-screen icon and an inline registration script to `dist/index.html`.
`scripts/deploy-check.mjs` reads the two blocks back out of the built worker and checks them against `dist/` on
every `make build`, so nothing in the worker's configuration is taken on trust.

`featureFlags.serviceWorker` in `content/game.config.json` chooses what `<base>sw.js` is. On: the worker. Off: the
tombstone, and no registration. **The flag is the kill switch.** Every browser holding the worker fetches that one URL
on its next update check, and the tombstone's clean-up rule — delete caches named `truenorth-*` or containing the
registration scope, unregister, reload — covers every cache this worker creates. So the way out of a bad worker is a
one-line content change through the normal pipeline, running a file that has already cleared one worker in
production.

### What each request gets

| Request | What answers it | Why |
|---|---|---|
| A navigation inside the scope | The network. Only when it **throws** — offline, not a 404 — the precached `index.html`. No timeout. | Registered ahead of the precache, so the precache can never answer `/OhCanada/` while the network is there. No timeout because a timeout is exactly how the archived worker served a stale shell. A slow load is better than a stale one. |
| `manifest.json` | The same rule, falling back to the precached copy. | It names every art file by hash; a stale copy is a stale build. |
| `index.html`, `manifest.json`, `manifest.webmanifest`, `icons/*`, and **every** file under `assets/` | The precache, cache first. | A content-hashed name is precached with no revision and cannot change; the three un-hashed files carry a revision, so a changed one is refetched when the worker updates. Precaching every chunk, not only the initial payload, is what makes a subject nobody has opened yet — or the exam, which draws from all ten — work offline. |
| Level art named in `dist/manifest.json` | Cache first in `truenorth-level-<id>`, or `truenorth-level-shared` for art more than one level draws. The first file a level fetches caches the rest of that level in the background, both scales. | "Workbox per level". Both scales because the scale follows the device pixel ratio, which can change between the day a level is played and the day it is played offline. |
| Anything else, and **anything cross-origin** | Nothing. No route matches, so the browser fetches it exactly as if there were no worker. | Nothing cross-origin is ever cached. The shipped game fetches nothing cross-origin today; the Rive runtime, which would fetch its WASM from a CDN, is not wired into `app/bootstrap`. |

On `activate` the worker deletes every cache this project owns that the build does not name, and every entry in a
level cache that is not one of the build's files. The level caches therefore never hold more than the art the
current build ships, rather than accumulating one copy per deploy. It never touches IndexedDB or `localStorage`, where
saves live (ADR-0026).

### Update flow

- **A new worker takes over as soon as it has installed** (`skipWaiting`, `clientsClaim`). Waiting for every tab to
  close is how a player gets stuck on old code: an installed app with one window never closes all of them, and
  without the app's notice nothing would ever tell the waiting worker to proceed.
- **The update check always reaches Pages.** The registration uses `updateViaCache: 'none'`, so the 10-minute HTTP
  cache Pages puts on `sw.js` does not delay it. A browser checks on navigation, so an installed app finds a new
  build the next time it is opened; a session left open for days does not, and nothing here polls, because a timer
  in the page is not worth that edge.
- **What the takeover can break is what a deploy already breaks.** A page left open on the old build that then
  lazy-loads a chunk the new deploy deleted gets a 404, exactly as it would with no worker. Hash routing and
  network-first navigations mean a reload always recovers.
- **The notice that asks for that reload is `app/ui`'s, and was not in the first change.** It landed the same day;
  the obligation below records what it added. Its contract with the worker
  needs no message and no port: a page that was **already controlled when it loaded** and then receives
  `controllerchange` on `navigator.serviceWorker` is running older code than the worker now in charge. The first
  visit's `controllerchange` — a page that was not controlled — is not an update and must not show it. The notice is
  a small DOM element with `role="status"`, the text "A new version is ready" and a Reload button that calls
  `location.reload()`; keyboard reachable, announced politely, never modal, never on a timer, no animation under
  reduced motion, and its two rows declared in `COPY_GAPS` in `app/ui/copy.ts` until a story ratifies them.
  Registration may move into `app/bootstrap` in the same change; if it does, `scripts/lib/pwa.mjs` stops writing the
  inline script and `scripts/deploy-check.mjs`'s registration clause moves with it.
- ~~**OBLIGATION due=2026-10-14 owner=ui-a11y** — build the update notice described in this section, with its EN and FR
  rows through `COPY_GAPS`, an axe scan in `tests/a11y/`, and a spec in `tests/e2e/` that runs with
  `serviceWorkers: 'allow'`, stands in for a second deploy by changing what the worker URL serves, and asserts the
  notice appears once on a page that was already controlled and never on a first visit.~~
  **DISCHARGED 2026-09-14** — `app/ui/update-notice.ts` draws the notice and `app/bootstrap/update-notice.ts` decides
  when, as a pure function of "controlled at load" and the events since. **Registration stays in the artefact**, as
  "Registration lives in the artefact" below argues: `scripts/lib/pwa.mjs` still writes it, `deploy-check` still
  holds it against the flag, and the bootstrap only listens, and only while `featureFlags.serviceWorker` is on. What
  the build added to the contract above: the notice waits while a question card, the exam or a quest dialogue is
  open (the front door's Study and exam, a level's `poi`, `study` and `quest` pause reasons), and appears under no
  other dialog either, waiting for the focus change that closes it; it is drawn first in the page's one `<main>` and
  moved with it between the front door and a level, so it is in the Tab order and in the front door's switch ring
  and never takes focus; its sentence is `role="status"` with `aria-live="off"`, so the one live region speaks it
  once; the second control is `common.close`; `html[data-tn-update]` carries the phase. Rows `update.ready` and
  `update.reload` are in `COPY_GAPS`. Tests: `tests/unit/bootstrap/update-notice.test.ts`,
  `tests/unit/ui/update-notice.test.ts`, `tests/a11y/update-notice.spec.ts` (title and level, EN, FR, high contrast,
  200 % text, forced colours, keyboard, one switch) and `tests/e2e/update-notice.spec.ts`, which appends a comment
  to `dist/sw.js` between two visits and restores it after the test. Written, not run locally; CI runs them.

### The first visit

The worker registers on `load`, so a first visit can open a level before it has control, and that level's art
passes the worker by. The registration script closes the gap: when control arrives on a page that had none, it sends
the worker the page's resource URLs (`truenorth:warm`), and every level among them is cached whole. What remains
uncovered is a visitor who leaves before the worker has installed; they have nothing offline, which is what "offline
after first load" means.

### A level never played online (amended 2026-09-15)

**The defect.** The second live-site audit let the worker take control on the title, went offline and opened
Halifax for the first time (`ck30-offline-title`, `ck31-offline-level`). The worker answered the navigation
and the code; the level started, and because none of its art had been cached it drew flat sky and ground
bands with no landmark, the console filled with `net::ERR_FAILED` and "the ground dressing
halifax-ground-boardwalk-edge has no texture", and nothing told the player the level needed a connection.
"Offline after first load" was true of levels already played and silently false of the rest.

**The decision: both halves.**

1. **Every level's art is cached in the background once the worker controls a page.** The `truenorth:warm`
   message gains an `everyLevel` field. The registration script sends it on the first control (with the
   page's resource URLs, as before) and again on the `load` of every page the worker already controls, and it
   sends `false` when `navigator.connection.saveData` is true. The worker caches the page's own levels first,
   then every level in `LEVEL_ART`, one level and one file at a time, into the same per-level caches and
   under the same prune. A shared file (the character atlas) is still cached with the first level that
   names it.
2. **A level whose art is not all cached does not open offline.** Before `loadLevel`, the level session asks
   `checkLevelAvailability` (`app/application/use-cases/level-availability.ts`). Online it opens without asking
   anything. Offline it asks the new `LevelArtCache` port, which `GameRenderer.missingLevelArt` implements by
   looking up, in Cache Storage, exactly the files the scene would queue at this device's scale. Anything
   missing — or no way to tell — shows the level's error card in its `needsConnection` form instead: the
   level's own error title, "This place needs an internet connection the first time you open it. Connect,
   then try again.", and the same "Try again" and "Go back". `data-tn-level` is `failed`. The level is not
   started with missing art.

Half 1 is what makes offline play true; half 2 is what makes the remaining gaps honest — a Save-Data browser,
a visit that left before the background cache finished, a cache the browser evicted, or a browser with no
Cache Storage.

**Why the budget allows it.** Measured on this build: all level art, both scales, is 108 files and 2.92 MiB
(1x 2.44 MiB, 2x 0.48 MiB, because full-screen layers ship at 1x only); the precache is 31 files and
3 621.2 kB. Together about 6.4 MiB, against the 8 MiB `budgets.initialPayloadBytes` the precache alone was
held to. `deploy-check` now holds **the precache plus every level art file** under that ceiling, because a
first visit that stays downloads both; a build whose art outgrows it fails, and this decision is reopened
rather than made expensive by accident. It also fails a worker that does not carry the `everyLevel` literal
the page sends.

*(ADR-0075, 2026-09-24: reopened as this paragraph said it would be. At 8,157,092 B against 8,388,608 an
eleventh level failed the build. The precache stays under `budgets.initialPayloadBytes`, and every level's art
is now held separately under `budgets.backgroundCacheBytes`, 5 MiB. The combined check is retired.)*

**What the other kinds of art are.** Ground dressing strips (ADR-0042) and ride frames (ADR-0035) are
`image` entries in `dist/manifest.json` owned by their level, so they are level art under every rule above;
`deploy-check` already fails a manifest file the worker would never cache. Screen art (ADR-0041) —
`title-landscape.svg` and the map — is a content-hashed file under `assets/`, so it is in the precache, and
the landmark pictures and portraits the DOM screens draw are the level's own art files.

**Alternatives considered for this amendment.** Only the message (half 2 alone): an honest failure where
play was possible, for every level a player had not happened to open online. Only the background cache
(half 1 alone): the grey level stays for a Save-Data browser or an evicted cache. Adding the art to the
install precache: the same bytes, but the install then fails whole on one failed file and competes with the
first paint, where the background cache retries a level the next time a page loads. The rejection of
"Precache every level's art" under Alternatives stands for the install precache; the plan's "per level" is
kept as the unit of caching and pruning.

**Tests.** `tests/unit/application/use-cases/level-availability.test.ts` (online never asks; offline opens
only with nothing missing; "cannot tell" and a throw are "needs a connection"),
`tests/unit/adapters/phaser/level-assets.test.ts` (`artUrlsOf`: an atlas is two files),
`tests/unit/ui/level-screens.test.ts` (the `needsConnection` card, its own ids, French), and
`tests/e2e/offline.spec.ts`: a level never played online opens offline drawn from its textures once every
level's art is cached, and with its level cache removed the same level shows the card, stays `failed`, and
asks again on "Try again". Written, not run locally; CI runs them.

### Registration lives in the artefact

The inline script is written by the build, not by `app/bootstrap`. That is partly who may edit what (fact 4), but
it is also the right place for the half that must track the kill switch: with the flag off, the build must stop
registering in the same artefact that starts serving the tombstone, and `deploy-check` fails a tombstone build in
which anything — `index.html` or any chunk — still calls `serviceWorker.register`.

The update notice did not move it (2026-09-14). The slice allowed registration to move into `app/bootstrap` with
the notice, and this section is the reason it did not: `app/bootstrap/update-notice.ts` adds a `controllerchange`
listener and registers nothing, so the artefact is still the one place that says whether a worker is installed.

### The browser suites run without it, except one spec

`tests/e2e`, `tests/perf` and `tests/a11y` set `serviceWorkers: 'block'`: Playwright replaces
`navigator.serviceWorker.register` with a stub that resolves to nothing, which the registration script tolerates.
Every existing spec therefore sees the page it saw before the worker existed, and the perf lane keeps measuring a
first load on a cold cache — which is what the initial payload and time-to-playable budgets are about.
`tests/e2e/offline.spec.ts` opts back in with `serviceWorkers: 'allow'`: it loads the title, plays into the start
level, waits until every file `dist/manifest.json` names for that level is in Cache Storage, goes offline, proves it
is offline, reloads the level and opens the title.

### Budgets

The worker's install is not the initial payload: it starts after `load`, and most of what it stores is the bytes the
page just fetched. It gets the same ceiling anyway — `deploy-check` fails if the precache exceeds
`budgets.initialPayloadBytes` — so it cannot become a second, uncounted first-visit download. The level caches are
bounded by the art the build ships, which is inside `budgets.totalPayloadBytes`. *(ADR-0075, 2026-09-24: and, since
the background cache of every level, inside `budgets.backgroundCacheBytes`, 5 MiB.)*

## Alternatives considered

- **`vite-plugin-pwa`** (1.3.0, MIT, supports Vite 8). Its `injectManifest` mode does the bundling this plugin does,
  and its `generateSW` mode would write the worker from options. Rejected because the two things this ADR needs
  beyond a precache — caching the rest of a level when its first file loads, and pruning level caches to the current
  build — are code in either mode, and because `deploy-check` must read the worker's configuration back with the same
  constants the producer writes it with. Owning ~300 lines keeps that coupling in one repository file instead of in
  another project's output format. `workbox-build` was already a pinned dependency; the three runtime packages the
  worker imports are now declared beside it at the same version.
- **`generateSW` from `workbox-build` alone.** Declarative, and it can express network-first navigations with a
  precache fallback. It cannot express "cache the rest of this level", and its expiration plugin bounds a cache by
  entry count rather than by which build a file belongs to.
- **Network first with a timeout**, falling back to a cached shell. Rejected on the evidence: it is the archived
  worker's failure, verbatim.
- **Prompt to update, and wait until then.** Rejected for now: until the app's notice exists, a waiting worker on a
  single-window installed app waits indefinitely, which is the player stuck on old code this slice must prevent. If
  the notice lands and a waiting phase is wanted, it is a change to this ADR.
- **Precache every level's art.** 2.03 MiB today, for levels a first visit has not played, charged to every first
  visit and growing with every level's art. The plan says per level.
- **Measure perf with the worker registered.** A second navigation would be answered from Cache Storage, making the
  lane faster than any real first visit, and the precache's own fetches would race the payload sum.

## Consequences

- `dist/` gains `sw.js` (84 kB, readable), `manifest.webmanifest`, and three icons (19 kB) rendered from
  `assets/src/icons/truenorth-app-icon.svg`, which is original, credited in `assets/credits.json` and palette-linted
  at build. `dist/index.html` grows by 0.9 kB; the initial payload goes from 2086.4 kB to 2087.3 kB raw.
- A first visit downloads the chunks it did not need yet — about 1.3 MB of question bank and level documents — in
  the background after `load`. The precache is 3464 kB against the 8 MiB ceiling.
- A level's art is cached the first time it is played, both scales — 0.56–0.74 MiB a level today — and pruned to the
  current build on every update.
- `featureFlags.serviceWorker` is no longer a flag nothing reads: the build reads it, and since the update notice
  `app/bootstrap` reads it too, only to decide whether to listen for a newer worker. With the flag off the worker
  being replaced is the tombstone, which reloads the page itself, so no notice is offered over it.
- Rollback by re-running an older deploy still works, because navigations are network-first. A pre-F3 commit ships the
  tombstone and removes the worker; an older F3 commit ships its own worker, which takes over at once and prunes the
  newer build's art. `docs/runbook.md` §6 carries the re-drill this change makes due.
- Not claimed: installability on iOS, which has no install criteria to meet — Safari's "Add to Home Screen" uses the
  180 px icon and the manifest's name and colours, and nothing more is asked of it. Not claimed either: that a game
  opened before the worker installs, and never opened again online, works offline.
