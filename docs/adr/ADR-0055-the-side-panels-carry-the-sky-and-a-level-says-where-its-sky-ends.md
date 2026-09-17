# ADR-0055: The side panels carry the sky, and a level says where its sky ends

- Status: Accepted (2026-09-17)
- Slice: A7 (desktop side panels, fourth live-site audit, 2026-09-17). Decided by the engine owner while
  implementing the promise below, stated plainly at the time, and recorded here.
- Builds on: ADR-0002 (portrait only, `Scale.FIT` at 1080 × 1920, desktop centres the canvas and the side
  panels extend the level's sky and ground), ADR-0044 (the band above a letterboxed canvas is the canvas's
  own first row, and it dims with the level), ADR-0042 (the band below the ground is dressed by a strip over
  the fill), ADR-0041 (a card dims the level with a filter on `#game`). Leaves all four standing.
- Numbering. `main` and every other ref this repository can see hold ADR-0001…ADR-0049 and ADR-0051…ADR-0054;
  0050 is spent by a draft on branch `multi-nation-source` that was dropped and never merged, and 0038 is a
  hole nothing ever occupied. **0055 is the first number above the high-water mark across every ref**, taken
  rather than either free hole for the reason ADR-0052 recorded and ADR-0053 followed: a number is retired by
  having been used, and an ADR filed below the records it builds on reads as older than them for ever. The
  bare numbers in this paragraph carry no `ADR-` prefix on purpose — `documents-name-real-schemas.test.ts`
  resolves every `ADR-NNNN` token to a file in `docs/adr`, and it has gone red twice in one day on citations
  of records nobody can open.

## Context

CLAUDE.md's Orientation row and ADR-0002 both promise the same sentence: *desktop centres the portrait canvas;
side panels extend the level's sky/ground*. Neither says **how much of the level** the panels extend, and
until this slice nothing had to answer, because the panels were two stops — the canvas's first row at the top
and the tinted theme ground at the bottom — with a straight line between them.

The fourth live-site audit found what that line costs. It is worth being precise about the cause, because the
audit guessed wrong and the guess is the obvious one:

- **It is not the time-of-day tint.** `--tn-sky` is the tinted theme sky and `--tn-sky-top` is measured off
  the canvas, and both were right. ADR-0044 works: at 1440 × 900 the panel matched the canvas *exactly* on
  row 0, on every level.
- **It is that two stops cannot describe a sky.** The ramp ran from that exact first row straight to the
  ground, through Halifax's citadel band, its uptown roofs and the quayside without touching any of them. The
  per-channel step between the panel and the canvas beside it was 0 at the top row and grew to **25 on
  Halifax and 33 on the North** by mid-screen: a seam down both edges of the playfield, in every desktop
  session.

So the question ADR-0002 left open had to be answered to fix the seam at all, and answering it is a decision
with real alternatives, a measured cost and a loser. The engine owner took it while implementing, said so,
and asked for it to be recorded rather than left in a commit message.

## Decision

### 1. The panels carry the sky, and stop at the top of the level's second layer in depth order

Three zones, stated positively, because the useful form of this rule is what each part of the panel *is*
rather than what it is not:

| Down the panel | What it carries | How |
|---|---|---|
| The canvas's first row to the level's **sky floor** | **The level's sky, row by row** | `canvasSkyProfile` samples what the canvas draws and reports it as CSS gradient stops |
| The sky floor to the ground crest (**the mid-ground**) | **A straight ramp**, sky floor colour to the tinted theme ground | unchanged; see rule 3 |
| The ground crest downward | **A flat land band** | unchanged (`levelLandBand`, ADR-0042's constants); already measures a step of 0 |

And one thing no zone carries: **no panel ever draws the level's art.** Not a parallax layer, not a landmark,
not a character. The panels are CSS on `#game::before` — zero draw calls, zero overdraw, no texture — and the
scene never learns that they exist. That is not an implementation note; it is half of the scope rule, and it
is what rules out the alternative in §"Extending the real parallax layers" below.

**The sky floor is the top of the level's second layer in depth order.** The backmost layer *is* the sky: it
is an opaque image starting at world row 0 on all ten levels. The next layer up in depth order is therefore,
by construction, the first thing drawn in front of the sky — Halifax's citadel at 620, the North's range at
620, Ottawa's skyline at 780 — and its top edge is the first row that can have a silhouette across it.

That is why the boundary is a layer edge rather than a pixel or a fraction. The property that decides whether
a row can be carried into a panel is **whether one colour describes it**, and one colour describes a row
exactly when nothing is drawn across it. "The first row something is drawn across" is not approximated by a
constant; it is stated, exactly, by the level's own depth order and offsets. A pixel row would be a number in
engine code that every level's art must then obey. A fraction of the design height is the same number wearing
a disguise, and it is already wrong: Ottawa's skyline sits 160 design pixels below Halifax's citadel.

### 2. A level names its own sky floor, and the engine derives nothing

`LevelScene` reads the boundary from the level document: sort `layers` by `depth`, drop the backmost, take
the smallest `offset.y` of the rest, and clamp it to `[0, ground crest]`. No art is inspected, no threshold
is chosen, nothing is cached across levels.

Why the level and not the engine:

- **CLAUDE.md's shape for this game is that a level is JSON and assets.** Slices 2 through 10 each added a
  level with no engine change. A boundary the engine derived would make the eleventh level's panels an engine
  question, and an art owner who moves a skyline 80 px down would have no way to correct the panels except by
  editing an adapter.
- **The level already had to state this correctly to render at all.** Depth order and `offset.y` are what put
  the citadel behind the uptown roofs and in front of the sky. This rule spends a fact that is already
  load-bearing and already reviewed, instead of introducing a second, parallel description of the same art
  that can drift from the first.
- **The alternative derivations are heuristics.** Scanning each layer texture for its first row with
  horizontal variance needs a variance threshold, is wrong on a sky image that carries its own soft gradient,
  and costs a texture walk per level load — to compute a number the document already contains.

**What a level that gets it wrong looks like.** Three shapes, because only one of them is loud:

1. **A second layer starting at row 0.** The sky floor is 0, `canvasSkyProfile` returns no stops,
   `skyStopList` writes a single space, and the page falls back to the two-stop ramp that shipped before.
   The failure mode is the old seam, not a broken gradient — the fail-safe direction, chosen deliberately,
   because one unparseable token invalidates a whole CSS gradient and a slightly wrong panel beats no panel.
2. **A second layer starting below the level's own ground crest.** Clamped to the crest, so the profile runs
   the whole sky *and* the mid-ground and the panels become the smear this decision exists to refuse. Loud,
   ugly, visible in one screenshot, and correctable in the level document by whoever moved the art.
3. **A decorative band given the second depth** — a cloud strip, a haze layer, anything that is really sky
   dressing sitting in front of the sky image. The sky floor lands too high, the panels go flat early, and
   the ramp does more of the work than it should. This is the case worth naming, because **it is silent**:
   nothing fails, no gate reddens, and the panels are merely less right than they could be. See "Rules
   stated here that no gate expresses".

### 3. The mid-ground's mismatch is accepted, not owed

Stated as a decision a reader can disagree with, with the number that makes it disagreeable.

**The mid-ground did not improve, and by the audit's own column metric it got slightly worse:** on Halifax it
moved from worst 146 / mean 107 to **worst 167 / mean 120**. The honest description of that zone before and
after is *a ramp, unchanged in kind*. It got worse for a reason that is correct everywhere else: the ramp now
leaves the sky floor on the sky's own colour instead of beginning its descent at the canvas top, which is
exactly what makes the sky zone measure 0.

It is accepted, and no obligation is opened against it, for three reasons in the order that decides it:

- **It is unmatchable by construction, not by effort.** A CSS gradient stop is one colour at one position, so
  one colour per row is the panel's entire vocabulary. A row with a skyline across it is several colours side
  by side. No choice of stops, tolerance or sample count describes it. There is no better profile to write —
  only a different medium, which is drawing the art, which is refused below on a number.
- **The better-looking version was built, measured and looked at.** Profiling the full height is not a
  thought experiment that lost an argument; it exists, it was rendered at 1440 × 900, and the panels became a
  horizontal smear of the level — plainly worse than the ramp they replaced, while a seam metric computed
  over those rows would have *improved*. That gap between the metric and the picture is the single most
  important thing this ADR records, and it is why the decision cites a render and not only a table.
- **A dated obligation would be dishonest here.** ADR-0009's format exists for work that can be discharged.
  Nothing short of overturning this decision would discharge a mid-ground obligation, so writing one would
  put a commitment in the corpus that no owner could ever close except by re-deciding.

**Who should disagree, and how.** Someone who judges that a monotone ramp through the mid-ground reads worse
than a blurred smear of the level, or who would pay the overdraw to draw the layers outside the playfield,
is disagreeing with this rule and not with a tuning constant. The response is a new ADR overturning this one,
not a lower `tolerance` — the tolerance changes how many stops describe the sky, and changes nothing about
the mid-ground at all.

### 4. Three measurement rules the profile depends on

These are in the Decision and not in a code comment because each is a place where the obvious implementation
is **plausible and wrong**, each was found by measuring rather than by reasoning, and each constrains anyone
who re-implements the profile later. Change any one of them and the panels are wrong again, in a way that
measuring Halifax's sky alone would not catch.

1. **What shows through a gap is a 64-band ramp, not one colour.** `#paintSky` fills the backdrop sky → ground
   in 64 horizontal bands *behind* the layers. ADR-0044 only ever needed row 0, where that ramp's first band
   is `mixColor(sky, ground, 0)` — the tinted sky exactly — so treating the backdrop as a single colour was
   right for one row and wrong for every row after it. Every row no layer covered took the wrong colour, and
   on a build with no level art, where every band is a short placeholder and most rows fall through, the
   panel drew flat `palette.sky` beside a canvas running a 64-step ramp. The rule: the backdrop is *read*
   with the same band arithmetic the scene *draws* with — same band count, same index, same mix — so the
   reader and the painter cannot disagree.
2. **A row is summarised by its median, never its mean.** The mean is right for a row that is one colour,
   which is all ADR-0044 ever read: spread 0 across 1080 columns on all ten skies' first rows. It is wrong
   for a row with something *on* it. A Halifax sky row crossing three clouds averages to a pale blue that is
   neither the sky nor the cloud, and a panel painted from a stack of such averages reads as a smear of the
   level rather than as its sky. The median is the colour most of the row actually is; a pixel less than half
   opaque is not counted as drawn, so antialiased cloud edges cannot vote. On a uniform row the two agree
   exactly, so ADR-0044's rows are untouched by this change.
3. **A 5-tap running median down the profile, because a median row is not enough.** The North's cirrus bands
   cover more than half the width of three rows, so they *won* their rows' medians and the panels grew three
   pale streaks the canvas beside them did not have. A running median down the sampled rows outvotes a spike
   and leaves a real edge exact: at a genuine horizon the samples read sky, sky, sky, hill, hill, hill and
   every median is unchanged, while at a cloud one or two samples disagree with everything around them. Five
   taps, measured and not chosen: three rejected two of the North's three bands and left the thickest, which
   spans two adjacent samples. The first and last samples are never replaced — the first is ADR-0044's row 0,
   which the band above a letterboxed canvas takes, and the last is where the ramp leaves.

One report carries all of it. `LevelScene` reports the profile through `onSkyBand`, and the band above a
letterboxed canvas takes the **first stop of that same report**, so ADR-0044's band and the desktop panels
read the same first row and cannot drift apart.

### 5. The residual 17 is a property of the measurement, and it is acceptable

After the fix, the sky zone measures **Halifax worst 0, mean 0.0** and **the North worst 17, mean 1.1**.

The 17 is one sampled row where the **canvas column** the measurement reads happens to fall on the soft edge
of a cirrus band. The panel at that row is the level's sky exactly — which is what rule 4.2 promises and what
the row's median across the full canvas width confirms. So the residual is the single-column sampler
disagreeing with the panel about what that row *is*, not the panel disagreeing with the canvas.

It is accepted, and it is named here rather than quietly absorbed, because the browser gate that guards this
work sits at **≤ 20** — a window whose both ends are measured, 17 after and 25 before. That threshold cannot
pass the defect it was written for and cannot redden on the known residual. What would *not* be acceptable,
and what this paragraph exists to forbid: a residual whose cause nobody has identified, or a threshold picked
as "the number we got, plus slack". If the North's sky art is redrawn, or the measurement moves to a row
median, that number is re-derived from the new measurement — not raised to fit.

## Alternatives considered

- **Profile the whole canvas, sky to ground.** Built, measured, rendered and rejected — see rule 3. One colour
  per row cannot describe a row with a skyline across it, and the panels became a horizontal smear of the
  level, worse than the ramp they replaced. It is the alternative that would have *improved* the mid-ground
  numbers while making the picture worse, which is why it is refused on the render.
- **Extend the real parallax layers into the panels.** The version that would actually be right, and it is
  rejected on a number rather than on taste. At 1440 × 900 the panels are **1.846× the canvas area**, so
  drawing the sky layers across them costs roughly **2.8× the sky's fragment cost** — for scenery nobody
  plays in, against CLAUDE.md's ceiling of 4× screen area per frame. It also needs a canvas wider than
  1080 × 1920, which ADR-0002 fixes and which ADR-0044 already refused to grow for its own band. And it
  quietly reverses what portrait-first *is*: the panels would become playfield that the camera, the ground
  polyline and every screen-locked 1080 × 1920 draw in the scene do not know about.
- **A fixed pixel row, or a fixed fraction of the design height, as the sky floor.** Rejected: a constant in
  engine code that every level's art must then obey, correctable only by an engine change. Ottawa and Halifax
  already disagree by 160 design pixels, so the constant is wrong on its second use.
- **Derive the sky floor by scanning the layer textures for the first row with horizontal variance.** Rejected:
  a threshold heuristic that a soft gradient in a sky image defeats, a texture walk per level load, and no way
  for the person who moved the art to correct the answer except by editing an adapter. The level document
  already states it exactly (rule 2).
- **Mirror or blur the canvas edge outward into the panels.** Rejected twice over. It is still drawing the
  level's art outside the playfield, so it takes the overdraw objection above; and it makes the panel a
  function of where the camera is, so the panels would slide while the player walks — motion outside the
  playfield, over which reduced motion has no say, because a CSS background is not something the scene
  animates.
- **Leave the seam and keep the two-stop ramp.** Rejected: 25 on Halifax and 33 on the North, down both edges
  of the playfield, in every desktop session, against a promise CLAUDE.md and ADR-0002 both already make.

## Consequences

- **CLAUDE.md's Orientation row and ADR-0002 keep their words**, and this ADR is what those words mean. No
  decision table row changes: the panels do extend the level's sky and ground, and now there is a record
  saying where the sky ends and what the ground is.
- **A level moves its own boundary.** An art owner who lowers a skyline moves the panels with it, in the
  document, with no engine change and no ADR.
- **The number of stops is a property of the art, not of the engine.** A flat sky is two stops; an even ramp
  is two; a level with a hill line and a skyline keeps a stop either side of each edge. Up to 33 rows are
  sampled at a tolerance of 3 per channel — 3 because ADR-0044 measured that a 5-to-7 step at a letterbox edge
  is visible on a large flat area.
- **Cost:** one one-row texture read per sampled row per layer, once per level, cached. The answer is
  recomputed only when the camera's row changes and compared as a written-out string, so an unchanged answer
  costs one string compare rather than a dozen custom-property writes and a style recalculation.
- **The tier, the render scale, reduced motion and high contrast change nothing here**, for ADR-0044's reason
  carried down the whole sky: they change *how* a row is drawn, never what colour it is, and a layer switched
  off is an input the profile already takes.
- **The mid-ground is worse by 21 points of worst-case column step on Halifax and that is the priced cost of
  this decision** (rule 3). Anyone re-measuring it should expect that number and not treat it as a regression
  to chase.
- **Two of ten levels are measured.** Halifax and the North were chosen as the two worst before the fix.
  Ottawa — the one level whose sky floor differs from the others — is unmeasured, which is the obligation
  below.
- **One CSS placement is load-bearing and is not cosmetic:** `--tn-canvas-top`, `--tn-canvas-height` and
  `--tn-canvas-bottom` are declared on `:root` rather than on `body`, because a custom property's own `var()`s
  are substituted on the element that *declares* it, and `app/bootstrap` writes the stop list on `:root`. Left
  on `body`, the whole letterbox gradient is invalid and the page paints no panel at all. Anyone tidying those
  declarations back onto `body` will get a blank letterbox with nothing failing in TypeScript.

### Rules stated here that no gate expresses

Named so nobody mistakes a green build for compliance, in ADR-0009's sense.

- **Nothing checks that a level's second layer in depth order is really the top of its mid-ground.** A
  decorative band given that depth silently raises the sky floor; the panels stay valid, stay seam-free at the
  top, and are simply less right further down. The obligation below adds the checkable half of this — a sky
  floor strictly inside the level's own sky, and a non-empty profile — but "this layer is the mid-ground and
  not a cloud strip" is a judgement about art that only a reader makes.
- **Nothing checks that the panels *look* like the level.** The seam metric is a per-channel step between two
  columns. The full-height version scored well on it and was refused on a screenshot; the same trap is open to
  the next change.

- **OBLIGATION due=2026-11-17 owner=engine** — measure the panels on all ten levels at 1440 × 900 with the
  existing `scripts/scratch/desktop-panel-shots.mjs`, Ottawa first because its sky floor is the one that
  differs (780 against 620), and record worst and mean per zone in `docs/plan/slices.md` under A7. Anything in
  the sky zone above the browser gate's ≤ 20 is a defect on this decision and is raised as one; anything
  between the North's 17 and 20 gets the same treatment §5 gives the 17 — identified by cause, or the gate is
  wrong. Two levels are enough evidence for the rule and are not enough coverage for ten shipped panels.
- **OBLIGATION due=2026-12-17 owner=engine** — gate the half of rule 2 that is mechanical: over every document
  in `content/levels/`, assert that the sky floor derived from the level (the smallest `offset.y` among the
  layers behind the backmost, in depth order) is strictly greater than 0 and strictly less than the level's
  ground crest, and that the profile it produces has at least two stops. That catches failure shapes 1 and 2
  in rule 2 at the moment a level document is edited, rather than on a desktop screenshot weeks later. It
  cannot catch shape 3, which is recorded above as a rule no gate expresses.
