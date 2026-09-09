# ADR-0025: The landmark shape budget is a diagnostic, not a gate

- Status: Accepted (2026-09-08)

## Context

`assets/style/art-bible.md` §2 sets a shape-count budget: "A background prop is 3–8 shapes. A character part
is 1–4. **A landmark is under 60 shapes at the hero layer.** If you are past that, you are drawing detail the
player will never see."

Two landmarks now exist and **neither has ever been near it**:

| Landmark | Shapes | Blind identification |
|---|---|---|
| Peace Tower, Ottawa — shipped | **166** | identified cold at **0.92** confidence |
| Château Frontenac, Québec City | **259** | (art's two-size test passed) |

The art agent framed it exactly right: *either the number is wrong or both landmarks are.* **A budget nothing
has ever met is not a budget** — it is a number people learn to walk past, and the habit of walking past one
number is not confined to that number.

## Decision

**The shape count is reported, not enforced.** The binding tests are the two that measure what the budget was
a proxy for:

- **Blind identification.** Can a reader name the building without being told? The Peace Tower cleared it at
  0.92 while three times over the budget, which is the measurement that settles this: the budget said the art
  was wrong and the art was right.
- **The two-size test** (ADR-0013 §4): legible at 1:1, at 25 %, and as a black silhouette at 120 px. This is
  what "detail the player will never see" actually means, and it is already how landmark scale is decided.

### The decisive fact: shape count has no runtime cost in this pipeline

`scripts/assets.mjs` **rasterises every `assets/src/svg/**/*.svg` with sharp, at 1× and 2×**, into atlas
frames. The GPU never sees a path. A 259-shape landmark and a 60-shape landmark are, at runtime, two WebP
frames of identical dimensions: same decoded bytes, same draw call, same fill.

So the budget was not measuring frame cost, texture memory or overdraw — the three things this project
actually gates. It was a proxy for *visual* simplicity, and it has been outperformed by the direct tests of
visual simplicity in both cases where the two disagreed.

What shape count still costs is real and small: SVG rasterise time at build, source file size, and how
tractable the file is to edit. Those are worth reporting and none of them is worth a build failure.

## Alternatives considered

- **Raise the number to something both landmarks meet — 300, say.** The obvious fix, and it invents a limit
  by reading it off the two artefacts that exist. It would be met by construction on the day it was written
  and would tell nobody anything after that. If the number cannot be derived from a cost, it is not a budget
  whatever value it holds.
- **Keep 60 and require an exception per landmark.** Turns every landmark into an exception, which is a rule
  with a 100 % waiver rate — administratively identical to no rule, minus the honesty.
- **Delete the guidance entirely.** Rejected: "built from a small number of large shapes" is real art
  direction and it is the house style. What is being retired is the *number acting as a gate*, not the
  intent. The paragraph should keep saying that detail below 12 px is wasted; it should stop implying a build
  refuses at 61.
- **Gate on rasterise time instead.** Closer to a real cost and still the wrong shape: it would fail slowly on
  a slow machine and pass on a fast one, and `make assets` is not where art quality is decided.

## Consequences

- **`assets/style/art-bible.md` is art's file; the rule's status is decided here.** The paragraph needs
  rewording so the count reads as guidance and the two tests read as binding. That edit is art's to make.
- **Two landmarks stop being in violation of a rule they were always going to break**, which removes a
  standing false claim from the art bible — the same class of defect as a dead schema path or a stale ADR
  reference, in a document no gate reads.
- **A proxy that loses to the thing it proxies for should be retired, not tuned.** The Peace Tower at 166
  shapes and 0.92 blind identification is one data point, and it is the only kind that could settle this: the
  proxy and the property disagreed, and the property is what ships.
- **This is adjacent to ADR-0019 without being an instance of it.** ADR-0019 is a rule whose *scope* does not
  match its *justification*. This is a rule whose *quantity* does not match any cost the system bears — the
  scope was fine, the metric was measuring something the pipeline erases at build time. Worth keeping the two
  distinct: one is fixed by re-scoping, this one only by finding what the number was standing in for.
