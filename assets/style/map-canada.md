# Map of Canada — the level-select country inset

`assets/style/art-bible.md` is the house style. This sheet is the map's contract: where the outline comes
from, what a line on it claims and does not, how it was simplified, where the ten stops are and why, and
what the map is still waiting on. Drawn 2026-09-13.

---

## 0. What it is, and what it is not

A landscape inset, **1080 × 600**, that sits above the list of stops on the level select. **Decoration and
orientation only.** It is never the way to choose a level; the list is the control (`TN-MAP`, `OQ-MAP-2`).

- **No text inside it.** No `<text>`, and no `<title>` either: an inline SVG's `<title>` is an English tooltip
  and accessible name, which is lettering by another route. Place names come from the copy table, in EN and FR.
- **No stop markers and no route line are drawn.** The ten stops are **anchors in a sidecar**, and the page
  draws its own markers, because only the page knows which stop is current, walked or locked. A route line
  baked into the art could not show progress and would read as a travel path, which no one has decided.
- **No regions.** "The Prairies", "the Alberta foothills" and "the North" are proposed in §9 and not drawn.

Files (§11 says where they live and how the screen reaches them):

| file | what | size |
|---|---|---|
| `assets/src/svg/screens/map-canada.svg` | the art | 250 113 B, 69 746 B gzip |
| `assets/src/svg/screens/map-canada.anchors.json` | anchors, inset frame, projection | 2 148 B, 841 B gzip (with its `$schema` line) |

---

## 1. Source and licence

**Natural Earth 5.1.1**, all three layers at 1:10m, downloaded 2026-09-13 from `naciscdn.org/naturalearth/10m/`:

- `ne_10m_admin_1_states_provinces_lakes` (VERSION 5.1.1) — the 13 provinces and territories;
- `ne_10m_admin_0_countries_lakes` (5.1.1) — neighbouring land;
- `ne_10m_lakes` (5.0.0) — lakes.

**Licence: public domain.** The terms page (`https://www.naturalearthdata.com/about/terms-of-use/`, read
2026-09-13) says, verbatim: *"All versions of Natural Earth raster + vector map data found on this website
are in the public domain. You may use the maps in any manner, including modifying the content and design,
electronic dissemination, and offset printing."* and *"No permission is needed to use Natural Earth.
Crediting the authors is unnecessary."* The page's two third-party releases (The Washington Post; the EC
JRC's European river and lake data) grant licences to Natural Earth and restrict nothing downstream; the JRC
data is Europe-only and is not in this frame. `credits.schema.json` has `public-domain` for exactly this, and
the map is credited anyway, because this project credits everything.

**Not used: Government of Canada boundary files.** Checked, not assumed:

- the **Statistics Canada Open Licence** (`statcan.gc.ca/en/reference/licence`) requires the user to
  *"reproduce the Information accurately"* and *"not misrepresent the Information"* — a cartoon that
  deliberately simplifies a boundary is in tension with that clause, and a licence that has to be argued is
  the wrong base for original art shipped CC-BY-4.0;
- the **Open Government Licence – Canada** (`open.canada.ca/en/open-government-licence-canada`) is
  attribution-only and would be compatible, but `credits.schema.json`'s `licence` enum has no value for it,
  so using it is a schema change first.

Natural Earth needed neither.

---

## 2. What a line on this map claims

A drawn boundary is a claim about land. **Drawn:** coastlines, lakes, the international boundary (as a change
of tone, no line), and **provincial and territorial boundaries** — Canada's political divisions, from the
licensed data.

**Not drawn, and never loaded:** any Indigenous nation, treaty or territorial boundary, and any shaded area
implying one. No dataset containing one was downloaded. `docs/content-review.md` §10 states whose land a place
is, in words quoted from the nation's own page, in "About this place"; a map is not where that is said.
**Inuit Nunangat is not drawn either**, for the same reason, and §9 says what that costs "the North".

**All 13 provinces and territories are one colour, on purpose.** A political map's usual alternating colours
would group provinces, and a group of provinces is a region — the claim §9 leaves to content owners. They
separate by a seam in the land's own shade tone (§5).

**One boundary is known to be contested:** the Québec–Labrador line is drawn as Natural Earth has it, the
federal line from the 1927 Privy Council decision, which the Government of Québec has never formally
accepted. It is a provincial boundary and inside the brief. It is recorded here so nobody finds it later.

Features gone **by size, not by claim**: Saint-Pierre and Miquelon, Hans Island and every island under 12 px
(§4). Their absence says nothing about sovereignty.

---

## 3. Projection and frame

**EPSG:3978, NAD83 / Canada Atlas Lambert** — the conic the Atlas of Canada uses, standard parallels 49° and
77°, central meridian 95° W. Canada is fitted to the frame height: **0.1230 px per km** at the standard
parallels, 8.1 km per pixel, landmass box x 150.7–807.2, y 17.0–572.7. The Pacific and Alaska fill the left,
Greenland the top right, the Atlantic the bottom right, where the inset sits.

**The conic turns the country.** Meridians converge, so the east coast leans right and the North sits almost
straight above Vancouver: Whitehorse is drawn at x 193.5, Vancouver at x 194.6. The true bearing is 334°,
26° west of north, and Whitehorse is 11.9° of longitude west of Vancouver (§8).

---

## 4. Simplification

Measured at the size a phone draws it, 390 px wide (0.361 of design).

- **The 12 px rule** (art bible §1), applied to whole landmasses so an island split between two territories
  is kept or dropped as one: **32 of 484** Canadian landmasses survive, and **25 of 462** neighbouring land
  parts. What survives in the Arctic is the archipelago a person recognises: Baffin, Ellesmere, Victoria,
  Banks, Devon, Axel Heiberg, Melville, Southampton and their larger neighbours.
- **Coverage simplification**, 1.6 px, on the 13 provinces together, so a shared boundary is simplified once
  and both sides stay identical. Coasts are then smoothed (Chaikin, 2 passes); **boundaries are never
  smoothed** — the 49th parallel, the 60th and the meridians stay straight.
- **22 lakes** are cut, by one rule for every country: longest side ≥ 12 px **and** area ≥ 40 px², so a long
  thin reservoir (Williston, Diefenbaker) does not become a scratch. Cut: Superior, Michigan, Huron, Georgian
  Bay, North Channel, Erie, Ontario, Great Bear, Great Slave, Winnipeg, Winnipegosis, Manitoba, Athabasca,
  Reindeer, Cedar, Dubawnt, Nipigon, Lake of the Woods, Mistassini, Smallwood Reservoir, Nettilling and, in
  the US, Great Salt Lake.
- **Straits that identify an island stay open** at 4× zoom: the Strait of Belle Isle between Newfoundland and
  Labrador, Northumberland Strait around Prince Edward Island. At 390 px they are about half a CSS pixel.
- **Neighbours** are drawn without internal boundaries: no US states, no Alaska–Yukon label, nothing.
- **The inset** (§7) closes inlets narrower than 3.2 px. That merges the Avon River estuary, 2 px wide there,
  which otherwise drew as a stray light line in the inset's corner (§12).

Result: 8 046 points of Canadian coast and boundary, 5 401 of neighbouring coast.

---

## 5. Tones

| layer | colour | note |
|---|---|---|
| sea and lakes | `water-base` | one water, flat |
| Canada, top | `grass-base` | one fill for all 13 (§2) |
| Canada, lit rim | `grass-light` | 1.8 px, coasts facing the upper-left key light only |
| Canada, side | `grass-shade` | the land drawn 5 px lower, a raised-tile edge |
| province and territory seams | `grass-shade` stroke, 1.6 px, round | see below |
| neighbouring land | `path-base` / `path-light` / `path-shade` | same construction, neutral so Canada leads |
| ambient occlusion | `ao-shadow` at 0.16 and 0.12, offset 6 and 10 px | soft stacked shapes, no filter |
| inset card | `white-base`; loupe `white-base` at 0.30; card shadow `ao-shadow` at 0.28 | |

**The rim is computed against all land, not per country**, so it lights a coast and never a land border.

**Why the seams are a line.** The art bible separates backgrounds by tone, not by line, and this is the one
place that cannot: 13 same-material provinces can only be told apart by line or by colour, and colour groups
them into regions (§2). A boundary is data, not a silhouette outline; it takes the land's own shade tone and
no ink.

The palette lint, run on the source alone: `20 fill/stroke declaration(s) in 1 source(s) against 117 distinct
palette colour(s); no gradient, filter, stylesheet, embedded raster, lettering or url() paint`. `<use>` is new
to this tree — one coastline path serves the side, the occlusion and the clip — and librsvg draws it.

---

## 6. The anchors

**The sidecar is the contract**, `map-canada.anchors.json`: `anchors.<levelId>.{x,y}` in the SVG's own viewBox,
plus the inset frame, its window, the locator box and the two inset anchors, plus the affine from EPSG:3978
metres to the viewBox, so a later point can be placed without re-deriving anything. A sidecar and not id'd
elements, because the page may show the map as an `<img>`, where ids inside the drawing cannot be reached.
Province shapes do carry ISO 3166-2 ids (`CA-AB` …) for an inline use.

**The sidecar carries coordinates and no names**, not even of the buildings the anchors are drawn from:
`TN-LEVEL-alberta-foothills` names the Bar U Ranch nowhere a player can reach, and a shipped JSON is reachable.
The basis lives here, in a sheet that never ships.

| level | x | y | the point | coordinate source |
|---|---|---|---|---|
| `halifax` | 737.8 | 472.0 | Halifax Town Clock, 44.64722 N 63.5775 W (Pier 21 is 1.3 km away, 0.16 px) | Wikipedia |
| `peggys-cove` | 735.8 | 475.5 | Peggys Point Lighthouse, 44.49181 N 63.91861 W | Wikipedia |
| `quebec-city` | 658.0 | 476.0 | Château Frontenac, 46.81194 N 71.205 W | Wikipedia |
| `ottawa` | 623.6 | 508.4 | Parliament Hill, 45.42472 N 75.69944 W | Wikipedia |
| `toronto` | 594.9 | 542.3 | CN Tower, 43.64256 N 79.38708 W | Wikipedia |
| `winnipeg` | 419.1 | 475.2 | The Forks, 49.88694 N 97.13056 W | Wikipedia |
| `prairie-rail` | 347.3 | 454.8 | Chamberlain, Saskatchewan, 50.85139 N 105.56806 W — the town of the CC0 elevator reference (`prairie-rail-level.md` §0) | Wikipedia |
| `alberta-foothills` | 273.1 | 443.1 | Bar U Ranch, 50.4197 N 114.233 W (`alberta-foothills-level.md` §0) | Wikidata Q4857972 P625 |
| `vancouver` | 194.6 | 429.0 | Canada Place, 49.28864 N 123.11112 W | Wikipedia |
| `the-north` | 193.5 | 250.4 | SS Klondike, Whitehorse, 60.71333 N 135.0475 W | Wikipedia |

Inset anchors: `halifax` (973.7, 462.3), `peggys-cove` (947.2, 509.4).

**Checked against the drawing, and not moved.** Seven anchors fall inside the drawn land. Three are on the
water's edge in life and fall **0.3–0.4 px outside the drawn coast**: `peggys-cove`, `quebec-city` (the
Château's cliff over the St Lawrence) and `toronto` (the lakeshore). In the inset, `peggys-cove` falls
**2.1 px, about 1.3 km, seaward** of Natural Earth's 1:10M coast, and the lighthouse stands on the shore rock.
All four are the simplified coast being wrong by less than the data's own accuracy. **The anchors are the true
coordinates; the drawing is what is simplified.** A page marker of radius 4 px or more covers every gap.

**Two regional anchors are choices, and they are recorded as choices.** `prairie-rail` and
`alberta-foothills` are regions, and a point needed a place: each is the place its level's hero art was drawn
from. The map asserts nothing about which treaty's lands that point is in — the level documents do, in words
— and moving either point is one line in the build's anchor table.

---

## 7. Halifax and Peggy's Cove

**32 km apart in a straight line** (the drive is longer), at a bearing of 238°. On the main map that is
**4.0 px, 1.5 CSS px on a phone**: the two stops are one dot. That is the fact, and neither anchor moves.

The design answer is an **inset at 13.41× the main scale** (1.650 px per km), in the Atlantic at
(860, 400, 200 × 170), with a locator box around both stops on the main map and a translucent loupe between
them. In the inset the stops are **54.0 px apart, 19.5 CSS px on a phone**. It is the same projection as the
main map, so the inset is the locator box enlarged, not a rotated re-drawing, which is why its coast runs
south-west to north-east exactly as the main map's does: Peggy's Cove at the south-west tip of the peninsula
between St Margarets Bay and Halifax Harbour, and Halifax at the head of the harbour.

**What the inset cannot promise:** Natural Earth is a 1:10M dataset, and 13× is past what it was drawn for. The
inset coast is right in shape and coarse in detail. No harbour narrows, island or shoal was added to make it
look finer (art bible §5, rule 5).

---

## 8. What the map shows that no sentence may say

`TN-MAP` forbids a sentence about which way the journey runs. The map shows it without one.

| leg | km | bearing | drawn length |
|---|---|---|---|
| Halifax → Peggy's Cove | 32 | 238° | 4.0 px (inset 54.0) |
| Peggy's Cove → Québec City | 623 | 297° | 77.8 px |
| Québec City → Ottawa | 380 | 248° | 47.3 px |
| Ottawa → Toronto | 354 | 237° | 44.4 px |
| Toronto → Winnipeg | 1 518 | 303° | 188.2 px |
| Winnipeg → the Prairies | 609 | 283° | 74.6 px |
| the Prairies → the Alberta foothills | 615 | 269° | 75.1 px |
| the Alberta foothills → Vancouver | 650 | 262° | 79.8 px |
| Vancouver → the North | 1 478 | 334° | 178.6 px |

6 260 km in all. The longest leg is **47 times** the shortest.

**A caution for copy, because the brief's own phrasing is not quite true.** "The North is not west of
Vancouver" is right about the *journey* — the last leg turns north, not further west — and wrong as
geography: Whitehorse is 11.9° of longitude west of Vancouver, and the leg runs 26° west of north. This
projection happens to draw it nearly straight up. Any sentence, anywhere, should say neither.

---

## 9. Regions — proposed, not drawn

Each option is **a claim about where a region is**, and content owners pick it and cite it. None is in the art.
Options built from provinces already drawn need no new data; the others need a dataset, a licence check and,
in two cases, a licence value the credits schema lacks.

**"The Prairies" (`prairie-rail`)**

- **A — the three Prairie Provinces** (`CA-MB`, `CA-SK`, `CA-AB`). Cite *Discover Canada*, "Canada's Regions",
  "The Prairie Provinces", p. 100: *"Manitoba, Saskatchewan and Alberta are the Prairie Provinces"*.
  Cost: it contains the `winnipeg` and `alberta-foothills` stops, so level 7's highlight lights two other
  levels' ground.
- **B — Saskatchewan** (`CA-SK`). Cite the level's own "plains of southern Saskatchewan". Cost: it lights the
  boreal north of the province, which is not prairie.
- **C — an ecological extent**, e.g. the Prairies Ecozone of the National Ecological Framework for Canada.
  Cost: a new dataset under the Open Government Licence – Canada, a schema change (§1), and an ecological
  rather than a political claim.
- **Must not:** the extent the level's own territorial statement describes — "most of southern Saskatchewan,
  the southeast corner of Alberta and part of western Manitoba" is the Treaty 4 area. It is the easiest extent
  to draw from words already in the repository and exactly the one this map may not.

**"The Alberta foothills" (`alberta-foothills`)**

- **No political unit fits.** Alberta whole (`CA-AB`) over-claims by most of a province.
- **An ecological extent** from the Government of Alberta's *Natural Regions and Subregions of Alberta* is the
  candidate to cite, and it needs care: *from memory, not yet checked against the dataset*, the southern
  ranching foothills where the Bar U stands are classified as Foothills Parkland and Foothills Fescue, not as
  the "Foothills Natural Region", which lies further north. Confirm before choosing. Licence to check: the
  Open Government Licence – Alberta.
- **Must not:** the Treaty 7 extent the level's statement quotes ("the central range of the Rocky
  Mountains", "south and west of Treaties numbers six and four").

**"The North" (`the-north`)**

- **A — the three territories** (`CA-YT`, `CA-NT`, `CA-NU`). Cite *Discover Canada*, "The Northern
  Territories", p. 103: *"The Northwest Territories, Nunavut and Yukon contain one-third of Canada's land
  mass"*. Composable from drawn shapes, and the only option the guide itself defines.
  Cost: it leaves out Nunavik and Nunatsiavut, which are northern and Inuit homelands inside two provinces.
  **Drawing Inuit Nunangat instead would draw an Indigenous territorial boundary, which this map does not
  do.** If that omission matters, it is said in words, not in a shape.
- **B — Yukon** (`CA-YT`). Matches where the level is set; collides with the title, and with the open
  question in `TN-LEVEL-the-north` about a level called *The North* that never leaves the Yukon.

**When one is chosen**, art draws it as one flat overlay per region in this viewBox, so the base map never
changes and the page can show it whether the map is inline or an `<img>`.

---

## 10. Cost, and the two-size test

- **Transfer:** 250 113 B SVG, 69 746 B gzip; sidecar 827 B gzip.
- **Decoded:** at design size 1080 × 600 × 4 B = **2 592 000 B, 2.47 MiB**; at 2× 10 368 000 B, 9.89 MiB. On a
  phone, 390 CSS px wide at device pixel ratio 3, the browser rasterises 1170 × 650 = **3 042 000 B, 2.90 MiB**.
  This is the map screen, not a level, so it is charged to no level's 64 MB — and it must stay that way (§11).
- **At 25 % of design** (270 × 150): Canada, the provincial seams, Hudson Bay, the Great Lakes and the inset
  card all read.
- **As a pure black silhouette 120 px tall:** unmistakably Canada — the archipelago, Hudson and James Bays,
  the Great Lakes notch, Newfoundland.

---

## 11. Where it lives, and how the screen reaches it

**`assets/src/svg/screens/`**, the home for art a DOM screen owns rather than a level (OQ-MAPART-1, answered by
infra 2026-09-13; the rules are in `scripts/lib/screen-art.mjs`). `scripts/assets.mjs` leaves the directory out
of what it rasterises, so the map is:

- **palette-linted** with every other source, and **credited** in `assets/credits.json`;
- **never rasterised, never in `assets/dist/manifest.json`, charged to no level.** Halifax stays at 29.50 MiB of
  34.00. Under `shared/` it would have gone to 39.39 MiB, 5.39 MiB over, which is why the directory exists;
- refused if it carries `<script>`, `<foreignObject>`, an event handler, an `href` that is not a `#fragment`,
  `<title>` or `<desc>`, or has no root `viewBox`, because it reaches a player as SVG rather than as pixels;
- in a **flat** directory: a subdirectory, a file that is neither an SVG nor a `<name>.anchors.json` sidecar, a
  sidecar with no drawing beside it and an empty `screens/` each fail the build. A directory under
  `assets/src/svg/` that is not a level id, `shared/` or `screens/` still fails it too.

**The sidecar has a schema** (OQ-MAPART-3): it declares `content/schemas/map-anchors.schema.json`, and
`make validate-content` checks what a schema cannot: `svg` and `viewBox` match this drawing, there is one anchor
per level document and no other, every anchor lies inside the viewBox, the inset nests as it claims with both
inset stops inside the locator, and every `CA-` code is an id in the drawing.

**How the screen reaches it** (wired into the level select by `app/ui/level-map.ts`): the SVG by URL through the UI build,
`new URL('…/map-canada.svg', import.meta.url)`, into a decorative `<img alt="">`, so Vite content-hashes it and a
browser fetches it only when the level select is shown, not as part of the initial payload. The sidecar by static
JSON import, about 2 kB in the level select's chunk. Not a copy into `assets/dist/`, because that manifest means
"a level pays for this" and the screen would need a runtime lookup to learn a hashed name. Not inline, because
that is 250 kB of JavaScript string, and ids such as `sea` and `inset` would be loose in the page's id namespace.

---

## 12. Drawn, then removed

- **A lit rim along the land borders** — the Yukon–Alaska line, the BC–panhandle line and the 49th parallel.
  Each country's rim was computed against its own land, so a border was lit as if it were a coast: a drawing
  that said land meets sea where it does not. Now computed against all land.
- **A light line in the inset's top-left corner.** Not a claim — the Avon River estuary at 2 px, under the size
  rule — but it read as one. Merged into its banks (§4).
- **In scratch previews only, never in the art:** a red marker per stop and a dashed line joining them in
  order, used to judge the legs. Not shipped: markers carry state the page owns, and straight segments read as
  a route travelled.
- **Never drawn:** any region, any treaty or nation boundary, any alternating province colours, any lettering.

---

## 13. Open questions

| id | question | owner | blocks |
|---|---|---|---|
| ~~**OQ-MAPART-1**~~ | Which owner in `scripts/assets.mjs` takes art for a DOM screen (§11), and how does the UI reach it? **Answered 2026-09-13 by infra:** `assets/src/svg/screens/`; the SVG by a Vite URL into an `<img>`, the sidecar by JSON import (§11). | infra | nothing; the map is wired into the level select (`app/ui/level-map.ts`) |
| **OQ-MAPART-2** | Which extent does each of the three regions highlight, and what is cited (§9)? | content owners | any region highlight |
| ~~**OQ-MAPART-3**~~ | Does the sidecar get a schema in `content/schemas/`? It is data the UI reads, and `content/` is not art's. **Answered 2026-09-13 by infra:** yes, `content/schemas/map-anchors.schema.json`, with cross-checks in `make validate-content` (§11). The sidecar stays beside the drawing, in art's tree. | infra | nothing |
| **OQ-MAPART-4** | Is the federal Québec–Labrador line acceptable on a French-language screen without comment (§2)? | PO, FR reviewer | nothing today |
| **OQ-MAPART-5** | Is a 1:10M coast at 13× acceptable for the inset, or does it want a larger-scale public-domain or CC-BY coastline (§7)? | PO | nothing; the inset is right in shape |
