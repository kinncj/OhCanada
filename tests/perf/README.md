# tests/perf — what a performance check can honestly claim, and where

Two lanes, because a GitHub runner has no GPU.

| | CI lane | Device lane |
|---|---|---|
| Target | `make test-perf` | `make test-perf-device`, then `make record-perf-device DEVICE="..."` |
| Where | every pull request and every deploy, **blocking** | by hand, on hardware with a GPU; **in no workflow** |
| Files | `*.spec.ts`, `playwright.config.ts` | `*.device.ts`, `playwright.device.config.ts` |
| Measures | the work the build hands the GPU, and what a browser downloads | how long the engine takes per frame |
| On a software rasteriser | measures normally — the counts do not depend on it | settles **NOT MEASURED** and says so |

## Why the frame-time gate left CI

It was "fixed" three times and none of the fixes measured anything:

1. It asserted mean rAF interval <= 16.7 ms on the runner. That measured the container (ADR-0019), and failed four
   deploys.
2. It subtracted an empty page's interval from the level's. Same build: **1.02 ms** added on a laptop, **45.83 ms**
   on CI. Subtracting the host did not remove fill rate, and on SwiftShader fill rate is the whole measurement.
3. It detected a software rasteriser and reported instead of asserting — honest, and it made the job
   non-blocking. From then on the job failed every run anyway ("only 19 playing frames in 2000 ms — the page is not
   animating, so nothing was measured"; then "the tier moved from medium to low"), behind `continue-on-error`, and
   was skipped over. Run 34790518221 was green on every blocking gate with perf red, as usual.

And the subtraction was wrong on real hardware too, which nobody could see while it only ever ran on SwiftShader.
The first time it ran on a GPU (AMD Radeon 8060S, tier `high`) it read idle 16.67 ms, playing 16.67 ms, **the level
adds 0.00 ms** — held. A rAF interval is vsync-locked, so on any device that keeps up it says 16.67 whether the
engine spends 0.1 ms or 16. It was a threshold detector, not a cost.

## What the CI lane asserts

SwiftShader changes how fast work is done, not what work is asked for. `gl-census.ts` wraps the WebGL context from
outside the page and counts, per frame:

- **covered area** — every triangle clipped to the viewport and scissor, summed. Over the screen's area this is
  overdraw, which CLAUDE.md budgets at 4x;
- **texture bytes the GPU holds**, per texture, face and mip level, so a re-upload replaces and a delete gives back.
  The total is reconciled against the manifest the build gate priced. For Ottawa at 2x the GPU held 41,034,164 B
  against 41,025,900 B priced; the 8,264 B difference is exactly Phaser's own two 1x1, one 4x4 and two 32x32
  textures. Anything a level uploads that no file prices — a Rive surface, a canvas texture — shows up here and in
  no build gate.

Plus, from outside the canvas: initial payload transferred <= 8 MiB, and time to playable on the runner <= 6 s,
which is a **tripwire** for a boot that regressed badly and is not the phone budget.

**Particles are no longer claimed.** This lane used to hold the scene probe's `data-particles` to 400, and that
attribute has two writers: `game-renderer.ts:733` publishes the tier's *allowance* and `level-scene.ts:864` the snow
the level *emits*, and the page shows whichever wrote last. It read 0 at a tier allowing 150. The allowance is
clamped to 400 on a phone by construction, so checking it proves nothing, and emission cannot be told apart. The
budget is listed under NOT CHECKED HERE until the probe publishes emission on its own attribute.

### Why these numbers can be believed

Because the first version of the census was wrong, plausibly. Phaser binds vertex arrays through
`OES_vertex_array_object` on a WebGL1 context; the prototype wrapped only WebGL2's `bindVertexArray`, decoded every
draw from the buffer bound at start-up, and reported 1.89x and then 5.70x overdraw for the same frame. Both
confident; both wrong; one a false breach. The real figure was 2.66x.

So `calibration.spec.ts` runs first, in the same job, on the same runner: WebGL1 scenes with known answers (3.75
screens across VAO switches, clipping, indexed triangles and strips — exact to 1e-9), a scene over budget, a stale
vertex read, an undecodable draw, texture replace and delete to the byte, and an upload the census must refuse to
size. It caught a second census defect on its first run: an upload GL rejected was counted at 4 B/px because an
unsized `RGBA` internal format was read as a size.

### Three outcomes, and a fourth section

Every budget test ends in `settle()` (`verdict.ts`), and `perf-reporter.ts` prints:

- **HELD** — passes;
- **BREACHED** — fails; the build spends more than its budget;
- **NOT MEASURED** — fails, and is not a statement about the build: the instrument could not take the measurement,
  and the line says why. In this lane that means the instrument broke, because everything here is measurable on a
  runner. A test that dies before a verdict is reported here, never dropped, and a run with zero verdicts fails;
- **NOT CHECKED HERE** — not an outcome. Frame time, per-character cost, particles and time-to-play on a phone,
  with where they are checked (for particles: nowhere yet, and it says so) and the newest device pass. Printed on every run, so a green job cannot be read as "frame time is
  fine".

The same four go to `test-results/perf-verdicts.json` (uploaded on every run), to GitHub annotations whose titles
differ per outcome, and to the job summary page.

### The limit every tier-dependent number shares

Overdraw (parallax layers) and texture scale depend on the visual tier, and the tier is chosen from measured frame
cost — so **the host picks it**. And on SwiftShader it does not pick once. Measured 2026-09-13, at normal speed and
at 4x CPU throttle alike, the tracker ran a fixed cycle: `low` for 71 frames, `medium` for 41, indefinitely (17
changes in 30 s). A demotion takes one measurement window and a promotion two, and a software rasteriser's cost
straddles the `medium` threshold. Some runs hold `medium` instead; the next run may cycle.

So nothing here waits for the tier to settle — a first version did, and reported NOT MEASURED ("the visual tier did
not hold for 80 frames within 60000 ms") on every run. Each census frame is **attributed** to the tier in effect when
it began, from a log of the probe's `data-tier` changes, two frames are dropped at each edge of a run, and every tier
the host visited is judged; the worst decides. Texture memory is the peak over the whole observation, which covers
every tier visited. What no runner visits — `high`, with six layers — is printed as **NOT EXERCISED** in the verdict.

The first version also read overdraw 2.21x, 4 draws and 470 triangles — the provisional `low` a level shows for its
first second — while the tier the page then held drew 5 draws and 7,739 triangles at 2.66x. A sample taken right
after "playable" measures the guess.

**Requests to the app owner**, each of which would let this lane claim more:

1. A probe-gated tier override (`?e2e=1&tier=high`, inert without `?e2e=1`), so every tier's overdraw and texture
   memory is measured on every run, `high` included. Not worked around here: faking the clock to force a tier
   would change the physics and measure a fiction.
2. Split `data-particles` into allowed and emitted, so the particle budget can be measured at all.
3. Look at the tier cycle above. A host that flaps `low`/`medium` every two seconds redraws a different number of
   parallax layers and snowflakes every two seconds, which a player sees. That is an ADR-0011 question, not a test
   artefact.

## The device lane

`frame-time.device.ts` measures **engine cost per frame**: an init script wraps `requestAnimationFrame`, times every
callback, and sums the callbacks that share a frame timestamp. Phaser's whole step runs inside its rAF callback, so
this is the outside view of `frame-cost.ts`'s PRE_STEP-to-POST_RENDER. Its p50 is compared with the allowance
`visual-tier.ts` gives the settled tier. It does not see GPU time — Chromium submits GL asynchronously — so the
cadence (intervals over 1.5x the median) is reported beside it, not asserted.

`character-cost.device.ts` is task 1.12's per-character budget. It **passed** on CI, which is why it moved: a
subtraction of engine time on SwiftShader contains the rasteriser.

Both refuse a software rasteriser with a NOT MEASURED that names the renderer.

### Protocol for a device pass

1. Check out the commit to be measured, `make setup build`, and close anything else using the GPU.
2. `make test-perf-device`. Headed by default, because some platforms fall back to software rendering headless;
   `TN_PERF_DEVICE_HEADLESS=1` only where you have confirmed the renderer line names a GPU.
3. Read the output. A NOT MEASURED that names SwiftShader, llvmpipe or similar means this machine cannot take the
   measurement. Nothing to record.
4. `make record-perf-device DEVICE="<machine>, <GPU>, <browser and version>"`. It appends a pass to
   `tests/perf/device-record.json`, newest first, with the date, commit, whether the tree was dirty, the renderer
   and every verdict — and refuses a run with no verdicts, CI-lane output, or a software-rasteriser refusal.
5. Commit the record. Never edit a pass after the fact; add a new one.

### A laptop pass is not an iPhone 13 pass

Playwright drives desktop Chromium. CLAUDE.md's device targets — 60 fps on iPhone 13 and later and iPad, 30 fps on a
2021 mid-range Android — need the real devices, and nothing in this repository drives them. Until something does, a
phone pass is taken by hand: open the deployed site with `?e2e=1&level=ottawa`, let the tier hold for ten seconds,
record `data-tier` from the scene probe and the frame timings from Safari Web Inspector's Timelines or Chrome remote
debugging's Performance panel, and add a pass to `device-record.json` with `"method": "manual"` in the same shape. A
manual pass is a named person's judgement, recorded where a reviewer will pass it (ADR-0019).

As of 2026-09-13 there are **no recorded passes**, so every CI run prints `NONE RECORDED`. The one device
measurement taken while this lane was built — engine cost p50 6.60 ms against 8.35 ms at `high` on an AMD Radeon
8060S, 0 of 180 vsync intervals missed — is not recorded as a pass, because it was taken on a dirty tree mid-change.
It does say something worth knowing: that GPU already spends 79% of the `high` allowance on CPU work per frame.
