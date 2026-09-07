# TrueNorth art bible

Status: v1 (2026-09-07). Companion to ADR-0007 (real assets and fidelity). This document is the source of truth for how the world *looks and sounds*; the data that enforces it lives in `content/districts/*.json` (`scene.*`, `pois[]`, `npcs[]`) and `content/characters/npcs.json` (the NPC roster). Loop and one-shot names, hero landmark keys, fauna species and outfit enums below are the exact strings the schemas accept.

## 1. Direction in one paragraph

Photoscanned Canada, seen on a clear day by someone who has just arrived. Real materials (Poly Haven scans), real light (HDRI skies), real proportions (a 1 km district you can actually walk across), and a small cast of specific people in specific places. Nothing in the world is "a building" or "a person": every landmark is a named Canadian place or a recognisable Canadian type, every NPC is an archetype from the Discover Canada chapters, every animal is a species that lives where we put it. Realism is the bar, but restraint is the style: muted natural palette, one hero silhouette per view, quiet soundscapes with rare, meaningful one-shots.

## 2. Palette

Terrain and vegetation carry the palette; buildings are stone, brick, copper and glass; saturated colour is reserved for flags, the red serge, hockey jerseys and canola.

| Token | Hex | Use |
|---|---|---|
| Maple red | `#c8102e` | Flags, jerseys, tuques, festival accents. The only pure red in the world besides the serge. |
| Serge red | `#b3121b` | Mountie tunic, fort guard coat. Slightly deeper than maple red so the two never read as the same object. |
| Snow white | `#f4f1ea` | Flags, snow albedo tint, lab coats, blouses. Never `#ffffff`. |
| Peace Tower copper | `#5f8f7a` (aged) / `#8a5a3b` (new) | Parliament roofs, Château roofs, lookout caps. |
| Ottawa limestone | `#c9bfa8` | Parliament, war memorial, courthouses, Château Frontenac base. |
| Ontario brick | `#8a4a3b` | Polling stations, apartments, factories, market street. |
| Prairie gold | `#c2b168` | Wheat and canola vegetation, grain elevator trim, Prairie terrain highlight. |
| Boreal green | `#4f7f3a` | Conifer canopy, forest terrain base. |
| Lawn green | `#6f9a44` | Parliament Hill and district plazas. |
| Canal blue | `#4f7fa8` | Fresh water; frozen variant desaturates to `#c9d6de`. |
| Atlantic slate | `#3a4f5c` | Ocean, regions Atlantic and West Coast water and rock. |
| Tundra bone | `#e8eef3` | North sub-zone terrain, icebergs, inukshuk highlight. |
| Aurora | `#39c48a` → `#6a4fc2` | Only in the North sub-zone sky at `aurora-drone` POIs. |
| Ink | `#111318` / `#1d2430` | Robes, uniforms, trousers; the darkest values in the world. |

Rules: terrain palettes in `scene.terrain.palette` must be drawn from the four terrain rows above (plus snow for `snow: true`). NPC `bottomColor` values are picked from Ink, Ottawa limestone-adjacent khakis or denim; no NPC wears two saturated colours at once.

## 3. Materials

- **PBR only.** Every surface has albedo, normal and ARM (AO/roughness/metal) from the Poly Haven 1k sets listed in ADR-0007; procedural materials (`MaterialKit`) exist for fallback and must match a scanned set's roughness range (stone 0.7–0.9, copper 0.35–0.5, glass 0.05–0.15, fabric 0.85–1.0).
- **World-space tiling** on architecture so scale reads correctly at 1 km: brick courses ~7 cm, limestone blocks 60–90 cm, cobbles 12–15 cm.
- **Weathering** is directional: north faces greener (copper, lichen), plinths darker, snow districts add a 5–10 cm snow cap on flat tops.
- **Water**: fresh water is `canal-water` (dark, reflective, slow ripple); ocean is only in the regions Atlantic/West Coast sub-zones (whitecaps, gull one-shots); frozen water is a matte ice plane with skate scratches when `weather: snow`.
- **Fabric on characters** is procedural from bone weights (ADR-0007); roughness 0.9, a subtle weave normal, and a cloth sheen only on the Speaker's silk robe.

## 4. Silhouette rules

1. **One hero per view.** From any POI centre, exactly one hero landmark should dominate the skyline. POI spacing (≥ 150 m between hero POIs) enforces this; do not add a second hero within a POI's radius.
2. **Read at 400 m.** Hero assets must be identifiable as a black silhouette at 400 m: Peace Tower (tall, pointed, flag), CN Tower (needle with pod), Château Frontenac (steep copper roof, turrets), Peggy's Cove (white cylinder on rock), grain elevator (tall box, small cupola), Niagara cliff (horizontal ledge), Stampede grandstand (long roofed bleacher), inukshuk (stacked stones with arms), totem pole (vertical, top figure with wings), canoe (long, upturned ends), qamutiik (low sled, cross-slats).
3. **Height tiers.** Props < 3 m, buildings 5–17 m, heroes 20–90 m. Nothing procedural exceeds 17 m except `parliament` (Peace Tower).
4. **Ground line.** Every landmark sits on a flattened 18 m disc (`world-scene.ts` flatSpots) and gets a footprint exclusion from vegetation; never place a POI landmark inside another landmark's footprint (keep ≥ 12 m between landmark centres, ≥ 25 m from the `parliament` centre).
5. **People are small.** Character height 1.6–1.9 m against 9 m lamps and 14 m trees; camera never crops the horizon below the player's shoulders so scale is always visible.

## 5. World scale and layout grammar

- Hub `scene.size` 1300 (1.69 km²); subject districts 1000 (1 km²); regions 1200 (1.44 km²). `size` is the side of a square centred on the origin; everything must sit inside ±(size/2 − 40).
- **Spawn plaza** at the origin: spawn at `[0,0,28..30]` facing −z, the district's main landmark at `[0,0,-20]` (hub: Centre Block at `[0,0,-75]` with the Peace Tower hero at `[0,0,-45]`), `spawnRadius` 22–24 kept clear of vegetation and buildings. The quest-giver NPC stays at `[3,0,12]` (hub: Amélie at `[4,0,14]`) and the tutorial flagpole trigger at `[16,0,12]`; the e2e tests teleport to these.
- **Station** in the +x/+z quadrant at `[200,0,200]` (hub `[380,0,300]`, regions `[220,0,220]`) with the portal trigger on it; hub portals line the platform every 6 m in unlock order.
- **POIs** ring the plaza at 150–500 m in the other quadrants; each POI has 1–3 secondary landmarks (lamps, benches, flags, gates) so it reads as a place, not a marker.
- **Triggers** for pickups live inside a POI radius so the fast-travel beacon doubles as a hint; zone triggers for quests sit 10–30 m from the POI centre.
- **NPCs** are within 40 m of a POI centre, usually 8–15 m from the POI landmark, facing the plaza approach.

## 6. Per-district mood boards

Loops: `wind, canal-water, city-hum, forest, ocean, rain, snowfield, harbour, tundra-wind, campfire, prairie, rink, aurora-drone`. One-shots: `goose-honk, goose-flock, loon-call, beaver-splash, moose-call, bear-grunt, gull, skate-scrape, footstep-snow, footstep-gravel, footstep-wood, train-whistle, church-bell, fiddle-riff, whistle-referee, camera-shutter`. Ocean/harbour loops are permitted only in the regions Atlantic and West Coast POIs (the validator enforces this); the hub canal is `canal-water` with goose one-shots.

### hub — Parliament Hill, Ottawa (1300 m)
- Light: late morning (`timeOfDay` 0.42), partly cloudy HDRI, clear. Long soft shadows from the Peace Tower across the lawn.
- Vegetation: maple, pine, birch, shrub; maples dominate the grove and the canal banks (autumn tint allowed at 10 % of instances).
- Landmarks: Peace Tower / Centre Block (`hub-peace-tower`, hero `peace-tower`; procedural `parliament` behind it until the `centre-block` hero replaces it), Centennial Flame, Rideau Canal and locks (`hub-rideau-canal`), Château Laurier (`hub-chateau-laurier`), National War Memorial (`hub-war-memorial`), ByWard Market street (`hub-byward-market`, procedural `street`: cobbled lane, brick shopfronts, awnings, bilingual street signs "Rue York Street / Rue ByWard Market Square"), VIA Rail station, maple grove, goose meadow, Ottawa River lookout.
- Fauna: Canada geese everywhere (lawn, canal, meadow, river), loons on the river. In winter (`weather: snow`, not shipped in v1) the canal freezes and `skater` fauna replace the geese; Jo the skater is the year-round hint.
- Soundscape: `wind` + church-bell (carillon), goose-honk, camera-shutter. Canal POI `canal-water`; market and station `city-hum`.

### rights-responsibilities — Courthouse square (1000 m)
- Light 0.45, clear. Civic limestone and maple.
- Landmarks: courthouse (plaza), town hall with iron gate and hydrant, volunteer fair tent with gathering circle, Charter lookout in the woods, lakeside bench, reserve armoury (`fort` model), maple walk, station.
- Fauna: loon and beaver at the lake, geese on the maple walk.
- Sound: `wind` + church-bell, footstep-gravel, goose-flock; town hall and fair `city-hum`.

### who-we-are — Lakeside gathering place (1000 m)
- Light 0.35 (golden morning), clear. Pine, birch and rock on a lake.
- Landmarks: gathering circle (Indigenous item, reviewed), Friendship Centre, totem pole clearing (hero `totem-pole`), inukshuk hill (hero `inukshuk`), lakeshore lookout, fiddlers' green (Acadian/Métis music), moose marsh, station.
- Fauna: loon 3, beaver 2 at the lake; moose 2 in the marsh.
- Sound: `forest` + loon-call, footstep-gravel, fiddle-riff; circle and green `campfire`.

### history — Fortified old town (1000 m)
- Light 0.3, fog (`fogDensity` 0.012): the only foggy district; palisade and spruce fade into grey.
- Landmarks: fort gate and palisade (plaza), voyageur canoe landing (hero `canoe-voyageur`), fur-trade post and trading circle, Confederation Hall, palisade watchtower, Vimy memorial (flame with two flags), Loyalist homestead with farm gate, railway siding.
- Fauna: beaver and loon at the landing, one black bear patrolling the tree line by the watchtower, geese on the farm.
- Sound: `wind` + footstep-wood, church-bell, loon-call; fur post `campfire`, landing `canal-water`.

### modern-canada — Downtown in the rain (1000 m)
- Light 0.55, rain, wet asphalt reflections; glass towers and a hockey arena.
- Landmarks: arena (plaza) and its east gate, glass towers (three apartment facades plus the POI tower), research campus, waterfront boardwalk, skyline lookout, multicultural park, transit hub.
- Fauna: geese on the waterfront and in the park.
- Sound: `rain` + footstep-gravel, camera-shutter, train-whistle; towers, arena gate and transit `city-hum` (whistle-referee and skate-scrape leak out of the arena).

### government — Civic district (1000 m)
- Light 0.45, clear. Legislature dome, three flags (federal/provincial/municipal) on the plaza.
- Landmarks: legislature (plaza), city hall, Rideau Hall and its gate on wide grounds, lakeside path, provincial park lookout, municipal works yard, ceremonial avenue of lamps and a flagpole, station.
- Fauna: geese on the Rideau Hall grounds, loons on the lake, one moose in the park.
- Sound: `city-hum` + church-bell, footstep-gravel; park `forest`, grounds `wind`.

### elections — Polling day (1000 m)
- Light 0.4, clear. Brick polling station with queue barriers.
- Landmarks: polling station (plaza), returning office, campaign square and office, riding lake, advance polling station (second `pollingstation`), community arena used as a polling place, maple park, station.
- Fauna: geese on the lake and in the park.
- Sound: `city-hum` + footstep-gravel, church-bell; campaign square adds fiddle-riff (a rally), arena whistle-referee.

### justice — Supreme Court plaza (1000 m)
- Light 0.5, clear; concrete and copper, pines and rock.
- Landmarks: Supreme Court (plaza), provincial court behind it, small claims court, police station with hydrant, lakeside path, pine ridge lookout, station.
- Fauna: loons; one black bear on the pine ridge.
- Sound: `city-hum` + footstep-gravel, church-bell; ridge `forest` with bear-grunt.

### symbols — Winter festival (1000 m)
- Light 0.6, snow, frozen water. Spruce and pine under snow; the only snow district.
- Landmarks: hockey rink (plaza) with rink lamps, beaver pond with lookout, festival pavilion, heritage garden (fleur-de-lys), frozen lake, parade ground of the provinces (flags), spruce woods, station.
- Fauna: `skater` on the rink (8) and the frozen lake (4), beavers idle at the pond lodge, moose in the spruce woods.
- Sound: `snowfield` + footstep-snow, skate-scrape, church-bell; rink `rink` loop, pavilion `campfire` with fiddle-riff.

### economy — Working harbour and Prairie edge (1000 m)
- Light 0.4, clear. Wheat and shrub on the west side, concrete dock on the lake.
- Landmarks: harbour office (plaza) with dock barriers, grain elevator (hero `grain-elevator` beside the procedural silo shed, power line marching west), canola and wheat fields, processing plant, tech incubator, container dock lookout, lumber mill, rail yard.
- Fauna: geese flying over the fields and on the dock.
- Sound: `city-hum` + footstep-gravel, train-whistle, gull; elevator and fields `prairie`, mill `forest`.

### regions — Five sub-zones (1200 m)
- Light 0.5, clear; terrain amplitude 6 so the Rockies lookout and inukshuk hill actually rise. Vegetation pine, wheat, iceberg, tundra-grass distributed by sub-zone.
- Sub-zones (all POI ids carry the zone name so the validator can check ocean/orca/polar-bear placement):
  - **Atlantic** (+x): Peggy's Cove lighthouse (hero), Bay of Fundy shoreline lookout; `ocean` loop, gulls; lighthouse keeper and Atlantic fisher.
  - **Central** (+x, −z): CN Tower (hero, `city-hum`), Château Frontenac (hero, church-bell and fiddle, the habitant), Niagara Falls cliff (hero, `canal-water` at volume 0.8, geese).
  - **Prairie** (−x, −z): grain elevator (hero) with power line, canola fields as `wheat` vegetation, Stampede grandstand (hero); `prairie` loop; grain farmer.
  - **West Coast** (−x): Stanley Park seawall with totem pole (hero) and orcas offshore, Pacific dock, Rockies lookout with moose and black bear; `ocean` at the seawall, `wind` on the lookout; West Coast fisher.
  - **North** (−z): tundra inukshuk (hero) with a polar bear and the `aurora-drone` loop, midnight-sun lookout; Inuit hunter with qamutiik.
- Compass plaza at the origin with the compass circle 120 m north; station at `[220,0,220]`.

## 7. NPC archetypes (content/characters/npcs.json)

Outfit specs use the roster enums (`serge`, `habitant`, `voyageur`, `military` and `stetson`, `tuque-rouge`, `helmet-brodie`, `ceinture` exist only in the roster). District files can only express the render-time enums, so the roster `notes` state the mapping: serge → `uniform` with topColor `#b3121b`; habitant → `casual` + `toque`; voyageur → `workwear` + `toque`; military → `uniform` (`hardhat` stands in for the Brodie helmet, `beret` for the modern reservist).

| Archetype | District | Body/age | Style | Top / bottom | Hat | Props | Notes |
|---|---|---|---|---|---|---|---|
| mountie | hub | F adult | serge | `#b3121b` / `#1d2430` | stetson | – | Red serge, yellow stripe, Sam Browne. No RCMP crest, badge or name anywhere. |
| elections-officer | elections | F adult | formal | `#f4f1ea` / `#23262e` | none | ballot-box, lanyard | Unbranded lanyard card. |
| speaker-of-the-house | hub | M elder | robe | `#111318` / `#111318` | none | – | Black silk robe, white tabs. |
| voyageur | history | M adult | voyageur | `#c9a86a` / `#4a3421` | toque | canoe-voyageur, paddle | Capot, red sash, beard. |
| metis-fiddler | who-we-are | M adult | casual | `#3b5b8a` / `#2f2a25` | ceinture | fiddle | Contemporary; arrow sash; cultural review. |
| inuit-hunter | regions (North) | M adult | parka | `#e8e1d2` / `#3a3128` | hood | qamutiik | Modern parka, kamiit; cultural review. |
| loyalist-settler | history | F adult | casual | `#8a9a7b` / `#5a4632` | none | basket | Homespun 1780s dress. |
| wwi-soldier-vimy | history | M young | military | `#4b4a33` / `#4b4a33` | helmet-brodie | rifle-slung | 1917 service dress, no badges. |
| hockey-player | symbols | F young | jersey | `#c8102e` / `#1d2430` | none | hockey-stick | Maple-leaf jersey, no league logos. |
| fundy-lighthouse-keeper | regions (Atlantic) | F elder | raincoat | `#f2c230` / `#2c3542` | captain | lantern | Yellow oilskin. |
| prairie-grain-farmer | regions (Prairie) | M adult | workwear | `#a63a2a` / `#3b4a6b` | cap | wheat-sheaf | Plaid, denim, unbranded seed cap. |
| west-coast-fisher | regions (West Coast) | M adult | raincoat | `#2f6f4e` / `#24313f` | hood | fishing-net | Green rain shell, bib overalls. |
| quebec-habitant | regions (Central) | M adult | habitant | `#e9e3d3` / `#4a3a2a` | tuque-rouge | – | Wool capot, ceinture fléchée. |
| parliamentary-guide, canal-skater | hub | – | formal, jersey | – | – | – | Amélie, Jo. |
| citizenship-judge, volunteer-coordinator, reservist | rights-responsibilities | – | robe, casual, military | – | – | – | Okafor, Raman, Hill. |
| indigenous-elder, inuit-carver, acadian-fiddler | who-we-are | – | casual, parka, casual | – | – | – | Cardinal, Nuka, Jean-Luc (first two: cultural review). |
| fur-trade-historian, fort-guard, metis-storyteller | history | – | workwear, military, casual | – | – | – | Marie, Baptiste, Adèle (storyteller: cultural review). |
| city-planner, research-scientist | modern-canada | – | raincoat, formal | – | – | – | Patel, Osei; Luc uses hockey-player. |
| house-clerk, city-councillor | government | – | formal, casual | – | – | – | Dubois, Karim; Speaker Nguyen uses speaker-of-the-house. |
| candidate | elections | – | formal | `#6b2f7a` | – | campaign-sign | Fictional party colours only. |
| police-constable, legal-aid-lawyer | justice | – | uniform, formal | – | police | – | Tremblay, Bello; Justice Marchand uses citizenship-judge. |
| flag-steward, veteran | symbols | – | parka, formal | – | toque, beret | folded-flag, poppy | Émile, Walter; Coach Bouchard uses hockey-player. |
| harbourmaster, startup-founder | economy | – | uniform, casual | – | captain | radio, laptop | Singh, Mensah; Anneke uses prairie-grain-farmer. |
| arctic-ranger, atlantic-fisher, geographer | regions | – | parka, raincoat, casual | – | hood, captain, cap | map, lobster-trap, backpack | Aputik (cultural review), MacLeod, Leblanc. |

Character rules: six skin tones from `catalog.json` used evenly across a district; no two NPCs at the same POI share hair + outfit + hat; every NPC's idle line teaches one paraphrased Discover Canada fact in EN and FR; names are plausible for the region and era and never those of living public figures.

## 8. Fauna

| Species | Behaviour | Zones (POI ids) |
|---|---|---|
| canada-goose | graze, swim, fly | Hub lawn, canal, meadow, river; lakes and parks in every subject district; economy fields; Niagara. The signature animal: 4–14 per POI, honk and flock one-shots. |
| loon | swim | Fresh water only: hub river, who-we-are, rights, government, justice, history lakes. Never on ocean. |
| beaver | swim, idle | Lakes and the symbols pond (idle at the lodge when frozen). |
| moose | graze | who-we-are marsh, government park, symbols spruce woods, regions Rockies. |
| black-bear | patrol | Tree lines only: history palisade, justice pine ridge, regions Rockies. Never inside a POI radius smaller than 45 m. |
| skater | skate | Frozen water and rinks when `weather: snow`: symbols rink and lake; hub canal in a future winter variant. |
| orca | swim | `regions-west-coast-stanley-park` only (validator-enforced). |
| polar-bear | patrol | `regions-north-inukshuk` only (validator-enforced). |

Counts stay ≤ 14 per POI so the `minimal` preset (≤ 350 instances) still has budget for vegetation; fauna use the shared character shader path (ADR-0007) with two LODs.

## 9. Indigenous cultural items

Applies to `totem-pole`, `inukshuk`, `qamutiik`, gathering circles, the Métis sash, and any NPC of First Nations, Inuit or Métis identity. Full list with ids: `docs/content-review.md`, section "Indigenous cultural items in the world".

- Mark the POI or archetype `culturalReview: true`; the validator refuses any such id that is not listed in the review doc.
- Use current terminology (First Nations, Inuit, Métis, Indigenous). Historical terms appear only when quoting the Constitution in questions, never in world text.
- Items are living culture: contemporary clothing unless the district is explicitly historical, no regalia, headdresses, drums, masks or pipes as props, no face paint, no "chief" or "brave" naming.
- Hero assets are original designs. Totem poles are not copies of specific poles and are not attributed to a nation unless commissioned from an artist of that nation; inukshuk use the single inunnguaq form; the qamutiik is a plain wooden sled with lashed cross-slats.
- Placement respects context: totem poles in a forest clearing or on the seawall, inukshuk on open ground, never as plaza furniture or gate ornaments.
- Dialogue paraphrases Discover Canada and, where the guide's framing is contested (origins, residential schools), stays with the guide's wording pending review.

## 10. The "no generic assets" rule

Nothing ships as "building_01", "tree", "man" or "ambience.ogg". Every visible or audible thing is tied to a named place, person or species, and the content data is where that is enforced:

1. **Landmarks are named.** `scene.landmarks[]` entries with a `label` are places; unlabeled entries are only the small props (`lamp`, `bench`, `flagpole`, `hydrant`, `power-pole`, `utility-box`, `barrier`). Any building-scale landmark without a label is a review failure.
2. **POIs carry the heroes.** `pois[].landmark` must be one of the fourteen hero keys (`peace-tower, centre-block, chateau-laurier, war-memorial, cn-tower, chateau-frontenac, peggys-cove-lighthouse, grain-elevator, inukshuk, totem-pole, niagara-falls-cliff, stampede-grandstand, canoe-voyageur, qamutiik`) or a listed procedural type; `validate-content` rejects anything else. Hero models are loaded from `assets/dist/manifest.json` by exactly that key; until an asset exists the engine falls back to the procedural type or a placeholder house, which is why every hero POI also has 1–3 secondary landmarks so the place still reads. `street` (ByWard Market) is a procedural type still to build: cobbled lane, brick shopfronts, awnings and bilingual signs.
3. **POIs carry the sound.** Every POI has an `ambience` with a loop from the fixed list and 1–4 one-shots that belong there (goose on water, church-bell near stone, train-whistle at stations, fiddle at gatherings, whistle-referee at arenas). The district-wide `scene.ambience.soundscape` is what you hear between POIs; the validator forbids ocean loops outside the Atlantic and West Coast.
4. **POIs carry the wildlife.** Fauna live in `pois[].fauna` with species, count and behaviour; zone rules for orca and polar bear are validated by POI id.
5. **People are archetypes.** Every district NPC maps to an archetype in `content/characters/npcs.json` with a full outfit spec (colours, hat, props, notes) so the character pipeline never invents a look; new NPCs must add or reuse an archetype before they are placed.
6. **Density is declared.** `scene.poiDensity` (0.3–0.7) and `scene.spawnRadius` (18–30) document intent per district; a district with `pois[]` must be ≥ 1 km² (`size` ≥ 1000, hub ≥ 1300).
7. **Review is data.** `culturalReview: true` is the only way to ship an Indigenous item, and it requires an entry in `docs/content-review.md`.

## 11. Open items

- Water rectangles (`scene.water`) were not rescaled with the terrain; the Atlantic and West Coast sub-zones have no ocean plane yet and the hub canal is still 22 × 220 m. Extending water is a rendering/physics change and is tracked separately.
- The procedural `parliament` and the `peace-tower` hero overlap conceptually; when the `centre-block` hero lands, the engine should skip the procedural block when a hero POI sits within 40 m of a `parliament` landmark.
- `stetson`, `helmet-brodie`, `tuque-rouge` and `ceinture` meshes do not exist yet; districts use `cap`, `hardhat`, `toque` and a scarf until they do.
- The regions district has 11 POIs (one over the 6–10 guideline) because each of the five sub-zones needs its required heroes plus the plaza.
