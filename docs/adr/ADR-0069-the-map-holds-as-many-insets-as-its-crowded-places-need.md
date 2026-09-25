# ADR-0069: The map holds as many insets as its crowded places need

- Status: Accepted (2026-09-23)
- Settles: the shape change ADR-0065 §4.1 said a southern eleventh city needs. `map-anchors.schema.json`
  carries `inset` as one object. It becomes an array, and this ADR decides its name, what each entry owns,
  what `make validate-content` must now check across entries, how the route line crosses them, and who lands
  which part.
- **Amends nothing in an ADR.** It changes a contract that `content/schemas/map-anchors.schema.json` and
  `app/application/ports/map-anchors.ts` hold together (ADR-0007, ADR-0008). §2 gives the port text.
- **Adopts the audit's figures after re-measuring them.** Stops are placed with the sidecar's own EPSG:3978
  affine (Lambert conformal conic, standard parallels 49° and 77°, origin 49° N 95° W, GRS80). The fit
  reproduces the shipped Ottawa anchor (623.6, 508.4) to 0.1 units. Kingston (44.23° N, 76.49° W) lands at
  **(621.0, 526.6)**.
- Slice: L6 (`docs/plan/slices.md`). This ADR is the map half of ADR-0068.
- Amended 2026-09-25: §6's boundary defect, resolved at the config. See "Amendment, 2026-09-25" at the end.
- Numbering. See ADR-0068's header. 0069 is the second of the two numbers reserved for this pair, and nothing
  on any ref this repository can see claims it.

## Context

### The pin is the constraint, and it is already broken

`app/ui/screen-styles.ts` sizes a map pin at **4.2% of the drawing's width**: "as big as a pin gets before
Toronto's and Ottawa's touch". Over the 1080-unit viewBox that is **45.4 units**. Two pins drawn in one
frame whose centres are closer than that overlap.

| Pair, main map | Distance (viewBox units) |
|---|---|
| Halifax – Peggy's Cove | 4.0 (the Atlantic inset at 13.41× puts them 54.0 apart) |
| **Ottawa – Toronto** | **44.4, touching today** |
| Ottawa – Québec City | 47.3 |
| **Kingston – Ottawa** | **18.3** |
| **Kingston – Toronto** | **30.4** |
| Kingston – Québec City | 62.7 |

Kingston cannot be pinned on the main map. It overlaps Ottawa by more than half a pin, and Toronto by a third
of one. The Ottawa–Toronto pair already touches at ten stops. **Nothing checks pin separation today.** The
touching pair shipped because the 4.2% was chosen by eye to sit just short of it, and the anchors were rounded
afterwards.

### Why the Halifax answer generalises

`app/ui/level-map.ts` pins a stop the inset anchors **in the inset and nowhere else**. A leg between two inset
stops is drawn in the inset. A leg between an inset stop and a main-map stop is drawn on the main map, from
the inset stop's main-map point inside the locator. That is exactly the treatment the Windsor–Québec corridor
needs. The only obstacle is that `inset` is one object. The projection block also carries one `inset` affine
and one `insetPxPerKmAtStandardParallels`, because the drawing has only one inset.

### What the sidecar's readers are

- **`app/ui/level-map.ts`** places pins and legs. It reads `anchors`, `inset.anchors` and `viewBox`.
- **`scripts/lib/screen-art.mjs`**, from `make validate-content`, cross-checks nesting and the one-anchor-per-level
  rule.
- **`assets/style/map-canada.md` §6–§7** gives the basis for every point. It never ships.

`projection` has no reader under `app/`. It is there so art can place a later point without re-deriving the
fit, and that is exactly what Kingston needed.

## Decision

### 1. `inset` becomes `insets`, an array, and each entry owns its own scale

**Its name changes as well as its type.** The sidecar's `additionalProperties: false` then refuses a document
that still carries `inset`, naming the property, which is ADR-0028 §5's tripwire used again. If the name were
kept, an old object in the new slot would fail as "must be array". A renamed property fails as "`inset` is not
allowed". Only the second tells the reader what happened.

- `insets`: optional, `type: array`, `minItems: 1`, items `#/$defs/mapInset`. Absent means no inset. An empty
  array is refused, because an empty collection must not stand in for "none" (ADR-0024).
- `mapInset` keeps `frame`, `window`, `locator`, `anchors` and `magnification` unchanged, and gains:
  - `affine`: **required**, `#/$defs/mapAffine`. It replaces `projection.inset`. Each inset is its own fit,
    and one shared field cannot describe two.
  - `pxPerKmAtStandardParallels`: optional, number > 0. It replaces
    `projection.insetPxPerKmAtStandardParallels`.
- `mapProjection` loses `inset` and `insetPxPerKmAtStandardParallels`, and keeps `crs`, `name`, `toViewBox`,
  `main` and `mainPxPerKmAtStandardParallels`.

### 2. The port, verbatim

`app/application/ports/map-anchors.ts` mirrors it exactly. The port is the architect's. It lands **in the same
commit** as the schema, because `tests/unit/contracts/ports-match-schemas.test.ts` binds the two together, and a
commit that changed only one of them would be red.

```ts
/** An enlarged view of stops too close to tell apart on the main map. */
export interface MapInset {
  readonly frame: MapInsetFrame;
  readonly window: MapRectangle;
  readonly locator: MapRectangle;
  /** Keyed by level id; a stop appears in at most one inset. */
  readonly anchors: Readonly<Record<string, MapPoint>>;
  /** Inset scale over main-map scale. */
  readonly magnification: number;
  /** This inset's own fit from projected metres to viewBox units. */
  readonly affine: MapAffineTransform;
  readonly pxPerKmAtStandardParallels?: number;
}

export interface MapProjection {
  readonly crs: string;
  readonly name?: string;
  readonly toViewBox?: string;
  readonly main: MapAffineTransform;
  readonly mainPxPerKmAtStandardParallels?: number;
}

export interface MapAnchorsDocument {
  // $schema, svg, viewBox, units, anchors, provincesAndTerritories: unchanged
  /** In drawing order. Absent when no stop needs enlarging; never empty. */
  readonly insets?: readonly MapInset[];
  readonly projection: MapProjection;
}
```

### 3. What `make validate-content` checks across insets

Every check it makes of one inset today it makes of each inset. It adds these:

1. **A stop is in at most one inset.** If a stop were enlarged twice, it would have two pins and be at two
   ends of a route leg.
2. **A locator encloses exactly the main-map points of the stops its inset anchors.** Today's rule is "each
   inset stop's main point lies in the locator". This adds the converse: no other stop's main point lies
   there. A box pointing at a stop the inset does not show is a false pointer.
3. **Frames do not overlap one another**, and **no main-map pin lies within a frame's rectangle grown by one
   pin radius.** A frame drawn over a pin hides it.
4. **Pin separation, for every frame.** Any two pins drawn in the same frame are at least one pin diameter
   apart. On the main map that means the stops in no inset. In each inset it means its own anchors. The
   diameter is the fraction `screen-styles.ts` sizes the pin by, times the viewBox width. **The fraction has
   one home. The gate reads it and never restates 4.2.** Where that home lives is infra's choice (see "Rules
   stated here that no gate can express"). The check would have failed on Ottawa–Toronto at 44.4 < 45.4 on
   the shipped tree. That failure is the evidence that it measures the thing. It lands **after** §5's
   corridor inset, or in the same commit, so the first tree it runs on is green.

Each check reports the numbers it measured. A pass over zero insets must say so and must not count as green
by vacuity (ADR-0024).

### 4. The route line: "same inset", not "both in an inset"

`level-map.ts` decides the frame of a leg with `previous.inset && stop.inset`. With two insets, a leg between
Peggy's Cove (Atlantic) and Ottawa (corridor) would pass that test and be drawn inside one inset, between
points that are not both in it. **The rule becomes: a leg is drawn in an inset only when both its stops are
anchored in the same inset. Every other leg is drawn on the main map, between main-map points.** Today's
journey never puts two insets back to back. The rule is fixed anyway, because the test that would catch it
is one fixture.

### 5. The corridor inset, whose first job is today's touching pair

**The second inset holds Ottawa, Kingston and Toronto, and none of them is pinned on the main map.** The
minimum magnification is 45.4 ÷ 18.3 ≈ **2.5×**, set by Kingston–Ottawa. At about **3×**, the corridor
(28.7 × 33.7 main units from Toronto to Ottawa) plus one pin radius on each side fits a window of Halifax's
size (190 × 160). The three pins would be 55, 91 and 133 units apart. Where the frame sits is the art sheet's
call, within §3's rules. The candidate areas with no pins under them are Hudson Bay and the United States
south of the Prairies.

**It can land before Kingston does, with Ottawa and Toronto only.** That fixes the pair that touches today,
and it lets §3.4 land green. Kingston's two anchors (main and inset) then join in Kingston's landing commit.

**Québec City stays on the main map.** Its nearest main-map pin once Ottawa moves into the inset is far more
than 45.4 away. The locator must not enclose it (§3.2), and at 62.7 from Kingston and 47.3 from Ottawa it does
not.

### 6. Who lands what, in order

| # | Owner | Files | Why this is one commit |
|---|---|---|---|
| 1 | infra | `map-anchors.schema.json`; `app/application/ports/map-anchors.ts` (text from §2); `scripts/lib/screen-art.mjs` (§3.1–3.3); the reader's lookup in `app/ui/level-map.ts` (`insets` instead of `inset`, and §4's same-inset rule); `map-canada.anchors.json` rewritten mechanically as `insets: [<today's inset + its affine>]` | The schema, the port that mirrors it, the one document it validates and the one reader of that document cannot be green apart. Nothing an artist or a designer would judge changes. |
| 2 | art | `map-canada.svg`, `map-canada.anchors.json`, `assets/style/map-canada.md` §6–§7 | The corridor inset drawn and anchored with Ottawa and Toronto (§5) |
| 3 | infra | `scripts/lib/screen-art.mjs` (§3.4) | Pin separation, on a tree where it now passes |
| 4 | content and art, together | the Kingston level document, and Kingston's two anchors | The boundary defect below |

**The boundary defect, named.** `screen-art.mjs` requires "exactly one anchor per level document in
`content/levels/`". So a level document cannot land without its anchor, and an anchor cannot land without its
level. Two owners must share commit 4, and that is the defect. This ADR does not fix it. The fix is a choice
between keying the rule on `game.config.json#/journey` and moving the anchor's authorship, and that choice is
infra's. It is an obligation below. Until it lands, commit 4 is authored by content, with the anchor
coordinates art publishes in `assets/style/map-canada.md` §6, and art reviews the diff.

## Alternatives considered

- **Keep the name `inset` and allow an object or an array (`oneOf`).** Rejected. The shape would then depend on
  the count, and every reader would branch. The port would need a union type, and nothing forces anybody to
  migrate. This project has refused "two shapes for one thing" before (ADR-0007).
- **Keep `inset` and add `inset2`.** Rejected. That is a numbered field and it does not generalise. The third
  crowded region, if the ceiling ever allows one, would add `inset3`.
- **Keep one inset and grow it to cover Halifax to Toronto.** Rejected. Halifax needs 13.41× and the corridor
  needs about 3×. Halifax to Toronto is about 1,300 km. At 13× that is about 2,100 units, which is nearly twice the drawing's
  width.
- **Shrink the pin.** Rejected. Kingston–Ottawa at 18.3 would need a pin of 1.7% of the width, about 6 CSS px
  on a 347 px map. That is below anything a player can see, and the pin's numeral would be unreadable. The pin
  is not a touch target, since the map is `aria-hidden` and takes no input (ADR-0065 §4.1). But it is the only
  thing the drawing is for.
- **Leave Kingston off the map.** Rejected. `validate-content` requires an anchor per level. A card with no pin
  is a stop the map says does not exist, and the numbered route would skip a number.
- **Nudge the anchors apart.** Rejected. An anchor is a projected coordinate with its basis in the art sheet,
  and "moved 30 units so it fits" is a claim about where Kingston is. The map says nothing it cannot show (the
  art sheet, §8).

## Consequences

- **Nothing changes in this commit.** The schema, port, sidecar and reader change in §6's commit 1.
  `npx depcruise app common --config .dependency-cruiser.cjs` is unaffected: the port stays in
  `app/application/ports`, imports nothing, and is read only by `app/ui/level-map.ts`, as it is today.
- **The map gets less crowded before it gets another city.** Ottawa and Toronto stop touching when the corridor
  inset lands, with or without Kingston.
- **The drawing gains a second card.** It adds some kilobytes of SVG, well inside the 100 MB budget
  (ADR-0065 §4). It changes nothing for accessibility, because the map is decoration and the card list is the
  control.
- **Twelve levels need no further schema change.** The array holds as many insets as the ceiling allows.
  Whether a twelfth city fits a frame is §3's arithmetic, not a new ADR.

### Rules stated here that no gate can express

- **Where the pin fraction lives.** §3.4 needs one number read by both the stylesheet and a Node script. If
  infra cannot give it one home that both can read, the separation check is refused rather than written with a
  second literal 4.2. It is then recorded here as the one rule of this ADR that is enforced by review only.
- **Whether a frame hides something that matters.** §3.3 keeps frames off pins. Whether a frame over Hudson Bay
  hides geography a player needs is the art sheet's judgement.

## Obligations

- ~~**OBLIGATION due=2026-11-23 owner=infra** — §6 commit 1. Rename `inset` to `insets` as specified in §1.
  Move the inset affine into each entry. Change the port to §2's text in the same commit. Rewrite the shipped
  sidecar mechanically. Add §3.1–§3.3 to `scripts/lib/screen-art.mjs`, with a failing fixture for each.
  Change `level-map.ts`'s lookup and apply §4's same-inset leg rule, with a two-inset fixture in
  `tests/unit/ui/level-map.test.ts` that fails on today's `previous.inset && stop.inset`.~~
  **DISCHARGED 2026-09-24** — branch `map-insets-array`, in the commit that strikes this marker. The schema,
  the port (§2's text, and the stale "one anchor per level document" header sentence replaced), the sidecar
  (one entry, today's Atlantic inset with its affine and scale moved in from `projection`) and the reader
  land together. `level-map.ts` pins a stop in whichever inset anchors it and records which
  (`PlacedStop.insetIndex`); a leg is drawn in an inset only when both ends share one. The two-inset fixture
  in `tests/unit/ui/level-map.test.ts` fails on `previous.inset && stop.inset` (1 of 32) and passes on the
  new rule. `tests/unit/infra/screen-art-gate.test.ts` refuses, each on the real sidecar with one thing
  broken: the old `inset` by name, an empty `insets`, an inset with no `affine`, `projection.inset`, a stop
  in two insets (§3.1), a locator round Québec City (§3.2), overlapping frames and a main-map pin 10 units
  from a frame (§3.3). The gate says what it measured ("1 inset(s): 2 enlarged stop(s) …, 8 main-map pin(s)
  at least 202 unit(s) from every frame against a pin radius of 22.7"), and says in words when there is no
  inset to measure. **The pin radius §3.3 needs is read, not restated.** The gate reads the last `cqi`
  `inline-size` of `app/ui/screen-styles.ts`'s `.tn-map .tn-map__stop .tn-journey__pin` rule and fails when
  it cannot, and a test shows a wider pin in that rule turning a passing sidecar red. That is the one home
  as it stands today; commit 3 (§3.4) still decides whether it stays there.

- ~~**OBLIGATION due=2026-12-23 owner=art** — §6 commit 2. Draw the corridor inset at a magnification of at least
  2.5×, holding Ottawa and Toronto (§5). Record its basis, affine and scale in `assets/style/map-canada.md`
  §6–§7. Publish Kingston's main and inset coordinates there for commit 4. Neither Ottawa nor Toronto keeps a
  main-map pin.~~
  **DISCHARGED 2026-09-25** — branch `corridor-inset`, in the commit that strikes this marker. `insets[1]` at
  exactly 3× (0.3690 px/km): frame (760, 180, 200 × 170) in the Labrador Sea, 50 units above the Atlantic
  card; window (765, 185, 190 × 160); locator (577.6, 498.7, 63.3 × 53.3). Its affine is the main affine
  times 3 plus the window's offset, derived and not fitted, and the drawing is the main map's own land under
  the same `matrix(3 0 0 3 −967.8 −1311.1)`. Ottawa (903.0, 214.2) and Toronto (817.0, 315.8) are pinned in
  the inset only, **133.1 apart** (was 44.4 on the main map). Kingston's coordinates are published in the art
  sheet §6 and not anchored: main (621.0, 526.6), inset (895.2, 268.8), 55.1 from Ottawa and 91.2 from
  Toronto. `validate-content` reports 2 insets, 4 enlarged stops, 2 locators enclosing only their own stops,
  frames 50 apart and 6 main-map pins at least 126 units from every frame. Hudson Bay was refused as the
  frame's place (it would hide all of it); the Labrador Sea hides open sea only, and the loupe washes eastern
  Québec under Québec City's pin, which the page draws above it (art sheet §7.1).

- ~~**OBLIGATION due=2027-01-06 owner=infra** — §6 commit 3. Add pin separation (§3.4), reading the pin fraction
  from its one home. It must be seen to fail on the pre-inset anchors (Ottawa–Toronto 44.4) and pass after
  commit 2. If no single home is possible, record that here and in `docs/architecture.md` as review-only. Do
  not write a second literal.~~
  **DISCHARGED 2026-09-25** — branch `pin-separation`, in the commit that strikes this marker.
  `scripts/lib/screen-art.mjs` checks every frame: the main map's pins (the stops in no inset) and each
  inset's own anchors, pair by pair, and refuses a pair closer than one pin diameter, naming both stops,
  their points, the frame, the distance and the diameter. Exactly one diameter passes ("at least"). **The
  fraction's one home is the `.tn-map .tn-map__stop .tn-journey__pin` rule of `app/ui/screen-styles.ts`**,
  the last `cqi` `inline-size` in it, which is the declaration the browser applies. The gate reads it for
  every sidecar, inset or none, and fails rather than skips when it cannot. A shared constant module was
  refused because the stylesheet would then interpolate it, and the number would live in a second file.
  Nothing in `scripts/` or `tests/` writes 4.2. So this rule is gated, not review-only, and
  `docs/architecture.md` needs no entry. Measured on the shipped tree against a diameter of 45.4, as
  `make validate-content` now reports it: main map, 6 pins, closest 74.6 (Winnipeg–Prairie Rail);
  `insets[0]`, 54.0 (Halifax–Peggy's Cove); `insets[1]`, 133.1 (Ottawa–Toronto).
  `tests/unit/infra/screen-art-gate.test.ts` fails the pre-inset anchors (the corridor inset removed:
  Ottawa–Toronto "44.4 unit(s) apart on the main map"). It also fails two main-map pins and two inset pins
  one unit inside the diameter, fails a pair that the shipped pin passes once the stylesheet draws the pin
  wider, and at the boundary passes a pair exactly one diameter apart and fails it 0.1 closer. Each new case
  fails on at least one of seven deliberately broken implementations. One thing stays with review: the rule
  also states the pin's `block-size`, which the gate does not read. A pin whose two sizes differed would not
  be round, and §3.4 measures a round pin.

- ~~**OBLIGATION due=2026-12-23 owner=infra** — fix the boundary defect in §6. A level document and its map
  anchor must be landable by their own owners in their own commits. Key `screen-art.mjs`'s one-anchor rule on
  `game.config.json#/journey` rather than on `content/levels/`, or record in an amendment here why the
  coupling stays and who authors the shared commit.~~
  **DISCHARGED 2026-09-24** — keyed on the journey, in the commit that strikes this marker.
  `checkScreenSidecars` takes `places`, the non-null ids of `game.config.json#/journey`, and requires exactly
  one anchor per place, both directions. A `null` slot takes none. `validate-content.mjs` no longer reads
  `content/levels/` for this rule. It now says "12 anchor(s) against 10 journey place(s)". Two floors replace
  the old one. A journey that names no place fails as vacuous (ADR-0024), and a config it cannot read fails
  rather than passing. `tests/unit/infra/screen-art-gate.test.ts` adds a case that removes a level document
  and keeps its journey slot and anchor. It passes now. On the pre-fix script it fails with `anchors."…"
  names no level in content/levels/`, which is the defect. What a reader could trust before still holds,
  one step further removed. `unlock-chain-is-reachable.test.ts` requires every level document to sit at its
  own `order` in `journey`, so every level document still has an anchor. **What stays coupled.** An anchor
  now lands with the journey slot that names its place, not with the level document. For Kingston, that is
  ADR-0068 §9's insertion at slot 5, which also renumbers the later level documents' `order` under that unit
  test. The Kingston level document itself lands alone, in content's commit, after the slot and the anchor.
  The stale sentence "exactly one anchor per level document" in `app/application/ports/map-anchors.ts`'s
  header is outside infra's files, and it is left for §6 commit 1, which rewrites that port.

## Amendment, 2026-09-25: the boundary defect, resolved at the config

The discharge above keyed the anchor rule on `game.config.json#/journey`, and it moved the defect rather than
ending it. The rule still failed both ways: a journey id with no anchor, and an anchor naming no journey place.
So Kingston's journey slot (content's) and its anchor (art's) still had to land in one commit, by two owners
(`docs/plan/kingston.md` K-0.7). This amendment is what discharges §6's obligation in substance.

**Decision.** The rule has two strengths: one for a commit, one for a release.

1. **An anchor may land before its journey slot.** An anchor whose id the journey does not name passes when a
   level document (`content/levels/*.json`, by `id`) or a level story (`docs/stories/TN-LEVEL-<id>.md`)
   declares the place. `make validate-content` reports it: "1 anchor(s) ahead of the journey (kingston,
   declared by docs/stories/TN-LEVEL-kingston.md)". An id that nothing declares still fails. That was the
   reverse check's real job: catching a mistyped anchor. Art's own sheet (`assets/style/map-canada.md`) does
   not count as a declaration. The anchor's owner writes it, so a typo there would agree with the same typo
   in the anchor. An anchor ahead of its slot is harmless in a release, because the map pins journey slots
   and never reads it. `--release` allows it too.
2. **A journey slot may land before its anchor, in a commit only.** `make validate-content` reports such a
   place as awaiting its anchor ("1 journey place(s) AWAITING an anchor (kingston): allowed in a commit,
   refused by make build"). It does not fail.
3. **The release keeps the old rule, whole.** `make build` now runs `validate-content --release` in place of
   its old `validate-content` prerequisite. Under `--release`, a journey place with no anchor fails. CI runs
   `make assets build` on every pull request and the deploy runs `make build`. So a tree whose map has a stop
   it cannot place never merges green and never deploys. The gate is on the final state, not on each commit.

**What this buys.** Content's journey slot and art's anchor are separate commits, in either order. Art first:
every gate is green at every commit, and the art commit can even merge and deploy alone. Content first: every
commit passes `make validate-content`, and the pull request goes green once art's commit is in it. For
Kingston this means K-2.2 carries no art file, and the §6 fallback (content lands art's published coordinates)
is no longer needed.

**Alternatives considered.** (a) A `pending` list in the config or the sidecar, naming places allowed to be
unanchored. Rejected: a marker that someone has to remove is a third commit, and a forgotten marker is a
release gap. The same rule would have to refuse it at release anyway. (b) Deploy-only enforcement, in
`deploy-pages.yml`. Rejected: a content-first pull request would merge green and turn `main`'s deploy red.
Putting the check in `make build` catches it on the pull request, because CI builds every one. (c) Keeping art's
sheet as a declaration. Rejected above.

**Tests.** `tests/unit/infra/screen-art-gate.test.ts`, "a journey place and its anchor land apart, in either
order", uses Kingston as it stands: a story, art's published coordinates, no slot and no level document. The
art-first, content-first and both-landed cases, and the `--release` pass on the committed tree, fail on the
pre-amendment gate. The typo refusal and the content-first `--release` refusal pass on both, and they are the
guarantees this amendment keeps. A further case asserts that `make build`'s recipe runs `--release` before it
builds.

