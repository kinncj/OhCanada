# ADR-0011: The visual tier comes from a measured frame cost, never from a capability bit

- Status: Accepted (2026-09-08)

## Context

`docs/plan/slice-1.md` records this risk in its own words: "The renderer is assumed, not decided."
`Phaser.AUTO` picks WebGL whenever a context can be created, and a context being *creatable* is not the same
as it being *usable*. Linux on llvmpipe, Chrome started with `--use-angle=swiftshader`, a virtual machine, a
remote desktop session and a browser with hardware acceleration switched off all return a complete,
conformant WebGL context and then rasterise every pixel on the CPU. Nothing in the WebGL API says so.

This is the failure that killed this project's 3D predecessor, repeating in 2D: **a device advertising a
capability it cannot deliver, found by a player rather than by us.** There, an iPhone advertised WebGPU and
the renderer went black. Here the symptom would be quieter and worse — single-digit frames on a level that
looks fine in CI.

There is a second, independent hazard on the same axis. Phaser 4 keeps a Canvas renderer, and Canvas has no
Filter pipeline, so any effect built on Filters *silently does nothing* there. An effect that disappears
without an error is indistinguishable from an effect nobody wrote.

Task 1.19 was scheduled to answer both before task 1.13 builds a level that leans on either. This ADR records
the decision the engine agent reached, because a design that survives contact with a measurement deserves to
be written down before the next slice has to re-derive it.

## Decision

- **Keep `Phaser.AUTO`.** Renderer selection is Phaser's; nothing in this project overrides it.
- **What degrades is the visual tier, not the renderer.** The tier is `low` / `medium` / `high`, and it *is*
  `content/game.config.json`'s `graphicsPresets` — parallax layer count, particle count, render scale, pixel
  ratio, post-processing. Re-tuning the tiers is a content edit, not a code change, and the presets already
  carry CLAUDE.md's budgets (400 particles at medium, the phone ceiling; 1500 at high).
- **The tier is chosen from a measured frame cost.** `POST_RENDER now` minus `PRE_STEP now` — the wall-clock
  time the engine spent stepping and drawing — sampled per frame, with the frame *interval* recorded
  separately as a second, independent signal.
- **`UNMASKED_RENDERER_WEBGL` sets where measurement starts and how high it may climb, and decides nothing
  on its own.** A device that names itself a software rasteriser begins low and is capped; a device that
  refuses to name itself gets the cautious start and must earn its tier from measured frames. `'unknown'` is
  never treated as `'hardware'`.
- **Every visual effect declares a `plain` path; `filtered` is optional.** An effect with no plain path is a
  build failure, not a surprise on Canvas. This is the rule that keeps "Canvas has no Filters" from being
  discovered by a player.
- **Reduced motion is a separate axis and is never overridden by a good measurement.** A fast machine whose
  player asked for stillness still gets six crisp parallax layers; they simply do not move independently.
  The tier tracker has no access to the motion preference at all, which is the structural reason a
  measurement cannot silently undo an accessibility choice.
- Sequencing: a warm-up discard for the first frames (shader compilation, first uploads, first GC), a
  **median** rather than a mean for the tier decision with p95 kept as a separate looser guard, a rolling
  re-evaluation window rather than a single verdict, and asymmetric hysteresis — demote on one bad window,
  promote only after two agreeing ones.

## Alternatives considered

- **Force WebGL and fail loudly when it is unavailable.** Rejected: it converts a degraded experience into no
  experience, and it does not address the case that actually matters here, which is WebGL being *present and
  unusable*. The device this is meant to protect would pass the check and then run at four frames a second.
- **Force Canvas when the device names itself software.** Rejected, and it is the same mistake pointed the
  other way — degrading the *renderer* on a *string*. SwiftShader is usually faster than Phaser's Canvas
  path, so this would slow down the exact devices it was trying to help, and it would lose Filters
  permanently on hardware that could have had them once the string turned out to be stale or wrong.
- **Tier from `UNMASKED_RENDERER_WEBGL` alone.** Rejected: this is precisely the capability bit the slice-1
  risk names. It cannot see thermal throttling, a shared GPU under load, a browser with acceleration turned
  off after the string was set, or a tab that has been backgrounded — and it fails *closed* on every browser
  that hides the extension (Firefox's `privacy.resistFingerprinting`, Safari's Lockdown Mode, several
  extensions), which is a growing share.
- **Tier from a `requestAnimationFrame` delta FPS counter.** Rejected because it *cannot work*, and this is
  the finding that shaped the whole design. On a 60 Hz display the interval is pinned near 16.7 ms whether
  the GPU is idle or saturated, so an interval-only probe reports the same number for a phone with 90 %
  headroom and one with 2 %, and places both in the same tier. Engine cost has no such ceiling: on llvmpipe
  the raster work lands inside the render call and the cost climbs while the interval stays capped, right up
  until frames start being missed. So cost decides the tier and interval proves a cadence is being held at
  all — a machine whose interval sits at 50 ms is dropping frames however cheap each one looks.
- **Decide once at boot.** Rejected: the first frames are the most expensive and the least representative,
  and devices throttle. A boot-time verdict places healthy devices in the lowest tier and never lets a
  thermally throttled one out of the highest.

## Consequences

- **Slice 1's effects must be authored twice, and the plain version is what the art is reviewed against.**
  That is a real cost on task 1.13 and it is the point of this ADR, not a side effect: an effect whose plain
  path was never looked at is an effect that has not been designed for the tier most CI machines and a
  meaningful share of players will actually get.
- `graphicsPresets` and `budgets.frameTimeMs` in `content/game.config.json` are now **runtime load-bearing on
  the boot path**. They were configuration a human read; they are now numbers a decision is made from, which
  raises the cost of editing them carelessly.
- **CI measures on SwiftShader**, so it will sit at `low` or `medium`. Therefore **any future frame-time gate
  must report the tier it measured at, or the number means nothing.** A budget met at `low` and a budget met
  at `high` are different claims, and a gate that reports one number for both is a gate that measures
  nothing — which this project has removed before.
- **WebGL context loss mid-session is explicitly out of scope.** A context can be lost after a good
  measurement, and nothing here handles that. It needs its own decision and its own recovery path; naming it
  as out of scope is how it stays visible rather than becoming an unrecorded assumption.
- The tier is a *classification*, and nothing derived from it is more specific than the classification. See
  the two judgement calls below.

## Two judgement calls, ratified rather than left to be discovered

Both were raised by the implementer for the architect to overrule. Neither is overruled, and the reasoning is
recorded because "it was already like that" is not a decision.

- **The scene probe is gated at runtime on `?e2e=1`, not stripped by the bundler.** The trade is one
  `URLSearchParams` read on a normal load, against the alternative of a probe that exists only in a build
  nobody deploys. `tests/e2e` runs against the production artefact deliberately (ADR-0006), so a probe
  compiled out of that artefact could only ever be proven to work somewhere else — and a test hook that is
  absent from the thing under test is not a test hook. Correct call. The condition on it is that the flag
  must open *nothing but observation*: a probe that can change state would be a control surface on a public
  site, and the test asserting the probe does not exist without the flag is what keeps that honest.
- **`data-tn-tier`, `data-tn-rasterizer` and `data-tn-device` are exposed on every load.** Kept. A player
  reporting "it's slow" with the tier already in the DOM turns an unreproducible complaint into a triaged
  one, and this project has already lost a phase to a device-specific failure nobody could reproduce. The
  constraint that makes it safe, and which must hold in every future change: **these attributes carry
  classifications only, never the raw device string.** `rasterizer` is `software` / `hardware` / `unknown`;
  `renderer` is which renderer Phaser built; `formFactor` is `phone` / `large`. The
  `UNMASKED_RENDERER_WEBGL` string is read, reduced to one of three words, and discarded — it is never
  written to the DOM. Publishing the raw string would add a fingerprinting surface to a site that collects
  nothing (CLAUDE.md, Storage), which is a different decision and would need a different ADR.
