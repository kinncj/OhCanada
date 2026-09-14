# ADR-0011: The visual tier comes from a measured frame cost, never from a capability bit

- Status: Accepted (2026-09-08)
- Amended 2026-09-08: **both of this ADR's unmechanised clauses were violated in implementation and
  shipped.** The `data-tn-device` attribute published the raw `UNMASKED_RENDERER_WEBGL` string to a public
  page, and a frame-time gate used one budget at every tier. Neither was a disagreement with the decision;
  both were the decision not being enforced by anything. See "Two clauses that were prose, and both broke".

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

## Two clauses that were prose, and both broke (amendment, 2026-09-08)

This ADR ends with two judgement calls I ratified, each on the strength of a constraint stated in words. Both
constraints were violated by the implementation, both shipped, and both were found by a person rather than by
a check. That is the finding, and it is about this ADR's drafting rather than about the engineering.

### The raw device string was published

The clause read: the `UNMASKED_RENDERER_WEBGL` string "is read, reduced to one of three words, and discarded
— it is **never** written to the DOM", because publishing it "would add a fingerprinting surface to a site
that collects nothing". `data-tn-tier`, `data-tn-rasterizer` and `data-tn-device` were kept on every load
*on the strength of that clause*.

The deployed page carried:

```
CANVAS.tnDevice = "webgl/software (ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver))"
```

On a real visitor that is their actual GPU model. Engine has fixed it to `kind/rasterizer/formFactor` and
added a test that scans the **whole dataset** for the raw string, so a future attribute cannot reintroduce
it — which is the right shape, because the hazard was never specific to `data-tn-device`.

What this ADR should have done, and now does: **a privacy constraint attached to a feature is part of the
feature's acceptance, not part of its rationale.** The sentence "these attributes carry classifications only,
never the raw device string" was written as a condition and read as a description. A condition that nothing
tests is a description of an intention.

### A frame-time gate used one budget at every tier

This ADR's Consequences say it outright: *"any future frame-time gate must report the tier it measured at, or
the number means nothing. A budget met at `low` and a budget met at `high` are different claims."*
`tests/perf/budgets.spec.ts` used `highCostP50Ms` at **every** tier, while the cadence assertion immediately
beside it selected by tier.

It passed for exactly as long as the level drew nothing, and failed by 5 ms the first time it drew six
layers — so its greenness was measuring an empty scene, not a met budget. **A gate guarding this ADR
contained the precise mistake this ADR names**, in a file whose neighbouring assertion did it correctly.

### What follows

- **Both are the same failure**: a clause in an ADR's prose that no gate reads, in a document whose own
  Context argues that every gate this project trusts is mechanical. Naming it in Consequences is not
  enforcement.
- **The tier-reporting rule is restated as an acceptance criterion**: a performance assertion selects its
  budget by the tier it measured at, and reports that tier in its failure message. A perf test that names one
  budget for all tiers fails review.
- **This is why ADR-0009 exists**, and it is worth noticing that ADR-0009's own gate cannot help here: these
  were not dated obligations that expired, they were claims that were never true. `docs/adr` has no mechanism
  for "this sentence is a requirement" versus "this sentence is background", and both of the above read
  identically to a parser. Recording that as a known gap rather than inventing a marker for it today.

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

## A tier's own cost decides whether it is tried again (amendment, 2026-09-14)

### What broke

On SwiftShader the tracker never settled. It promoted to `medium` after 71 frames and demoted after 41,
forever. That is the Decision's own sequencing, not a device wobbling on a threshold: promotion was judged on
frames drawn at `low` and demotion on frames drawn at `medium`, which draws about four times the pixels on the
perf suite's phone viewport. No threshold measured at one tier predicts the cost of another, so more
hysteresis on the same rule would only slow the cycle down.

### What replaces "promote only after two agreeing ones"

- **Demotion is unchanged:** the first window that is too slow. The thresholds are unchanged too, so the
  device lane's allowances still hold.
- **Promotion needs consecutive good windows:** 2 to begin with, doubled for every earlier demotion out of the
  tier being tried, capped at 2 × 2¹⁰. The count restarts at every tier change, which is the cool-down.
- **A tier that fails twice is closed for the session.** A failure is a demotion within 20 windows of entering
  the tier. A reload measures from scratch, so a closed tier is never a permanent verdict on a device.
- **A tier that held and later stalls is not a failure.** It drops at once and is retried after twice the
  previous wait, and is never closed that way.
- **Building a level resets the measurement**, as a resize or a resume already did. A wrong demotion now
  counts towards closing a tier, so load frames must not be the evidence.

The oscillating host now tries `medium` twice and stays at `low`. A fast machine reaches `high` on its second
window and never meets the new rule.

### The probe may pin a tier, and why that keeps the condition above

`?e2e=1&tier=low|medium|high` pins the visual tier. The ratified condition was that the flag opens *nothing
but observation*. It is restated, not dropped: **the flag opens nothing that outlives the page or reaches past
the visitor's own rendering.** A pin writes no save, changes no content and affects no other visitor, which is
exactly what makes a control surface on a public site harmless.

- `tier` is read only behind the same check that installs the probe. Without `?e2e=1` it is ignored, and so are
  `?e2e=0`, `?e2e=true` and malformed values (unit-tested).
- A pin ignores the device ceiling but **still applies reduced motion**. The motion axis stays out of the
  tracker's reach, pinned or not (e2e-tested at a pinned `high`).
- A pinned tier is published as not measured, with `data-tier-pinned="true"`, so no report can mistake it for
  a device's earned tier.

The reason to accept it: SwiftShader never earns `high`, so without a pin the budgets that apply at `high`
are never measured on a runner. A budget that is never measured at the tier it applies to is the failure the
2026-09-08 amendment records.

### Particles have one writer each

`data-particles` is the snow actually falling, written only by the level scene from the flakes it draws, and
reads `unknown` with no level open. `data-particle-allowance` is the tier's allowance, written only by the
renderer. The perf suite checks the largest emitted count against 400 (phone) or 1500 (large) with the tier
pinned at `high`.
