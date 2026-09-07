# Assets

`make assets` (`node scripts/assets.mjs`) builds everything under `assets/dist/` — the Vite `publicDir` — from
CC0 sources and records every file in `assets/credits.json`. The run is idempotent: outputs that already exist are
skipped, nothing is rewritten with identical bytes, and a second run prints `no changes (no-op)`.

## What the pipeline produces

| Section | Source | Output |
| --- | --- | --- |
| HDRI | `assets/src/manifest.json` → `remote` | `sky/*.hdr`, fetched verbatim |
| Audio | synthesised in `scripts/assets.mjs` | `audio/*.wav` (licence `Generated`) |
| Transcoders | `node_modules/three/examples/jsm/libs` | `basis/` (KTX2) and `draco/` decoders (MIT) |
| Environment models | Poly Haven photoscans (`polyhaven.models`) | `models/env/<id>.glb` with `LOD0` + `LOD1` nodes |
| Tiling textures | Poly Haven texture sets (`polyhaven.textures`) | `textures/<id>/{diff,nor,arm}.ktx2` |
| Characters | Quaternius Universal Base Characters + Universal Animation Library | `models/characters/{male,female}.glb`, `textures/characters/<body>_skin_{light,dark}.ktx2` |
| Contract | derived from the above | `manifest.json` (consumed by the renderer) |

### `assets/dist/manifest.json`

```json
{
  "version": 1,
  "textureFormat": "ktx2",              // "webp" when KTX-Software could not be obtained
  "basisTranscoderPath": "basis/",
  "dracoDecoderPath": "draco/",
  "models":     { "tree-fir": { "path", "lods": ["LOD0","LOD1"], "triangles": {"LOD0","LOD1"}, "height", "radius", "category" } },
  "textures":   { "grass":    { "diff", "nor", "arm", "tileMeters" } },
  "characters": { "male":     { "path", "hair": [...], "animations": [...], "skin": { "light", "dark" } } }
}
```

`height`/`radius` are the LOD0 bounding box in metres (Poly Haven models are metric; anything taller than 100 units is
treated as centimetres and rescaled). All paths are relative to `assets/dist/` and are guaranteed to exist.

## How models are processed (`scripts/lib/models.mjs`)

Poly Haven scans are enormous (`pine_tree_01` is 4.2 M triangles and a 950 MB `.bin`). Per model, in one
`@gltf-transform/core` document:

1. Fetch the 1k glTF (`+ .bin + textures`) through `https://api.polyhaven.com/files/<id>` into the download cache.
2. Trees/saplings/foliage ship several variants side by side: keep the richest variant that fits the budget, else the
   leanest, and move it to the origin. Rock/prop collections keep all their nodes.
3. `flatten` the hierarchy and group everything under a node named `LOD0`.
4. Recompose cut-outs: the 1k JPG glTF loses alpha, so the separate `*_alpha`/`Alpha` map is downloaded and joined into
   the base colour texture; the material becomes `MASK` (cutoff 0.5, double sided).
5. `weld`, then decimate with `meshoptimizer` (`Permissive` so UV seams of photoscans can collapse, `Prune` on masked
   foliage so whole leaf cards are dropped rather than distorted). Budgets: trees/saplings ≤ 15 000, rocks/props/structures
   ≤ 6 000, grass/fern ≤ 3 000 triangles. `LOD1` is a deep copy simplified to ~20 % of LOD0 and shares LOD0's materials.
6. Textures: UASTC KTX2 for normal maps, ETC1S KTX2 for colour/ARM (`ktx create` via gltf-transform's `toktx`), resized
   per category (1024 px colour for nature, 512 px for props, 256–512 px normals). WebP fallback when `ktx` is missing.
7. Draco (`edgebreaker`, 14-bit positions), `prune`, `dedup`, write GLB. Stats are computed from the final bytes.

Result: trees ≤ 2.1 MB, everything else ≤ 1.4 MB.

## How characters are built (`scripts/lib/characters.mjs`)

Both itch.io packs are downloaded once with `scripts/lib/itch.mjs` (free "name your price" flow, no account). For each body
(`Superhero_{Male,Female}_FullBody.gltf`):

- the light skin tone is embedded; light and dark tones are also written as standalone textures so the renderer can swap
  them (`skin.light` / `skin.dark` in the manifest);
- each hairstyle from `Hairstyles/Rigged to Head Bone` is copied in as a skinned mesh bound to the body's 65-joint skin,
  under a node named exactly like the style (`Hair_Long`, …); the body's own `Eyebrows` and `Eyes` nodes are kept;
- the requested clips from `UAL1_Standard.glb` are retargeted by joint name (channels whose joint does not exist are
  dropped — none are on this rig) and `resample`d;
- textures go to KTX2 (1024 px body, 512 px hair/eyes), meshes to Draco; the pipeline asserts skins = 1, joints = 65,
  all hair nodes and all clips present.

## Adding an asset

1. **Poly Haven model**: add `"my-key": { "id": "<polyhaven id>", "category": "tree|sapling|rock|foliage|prop|structure" }`
   to `polyhaven.models` in `assets/src/manifest.json`. The category picks the triangle and texture budgets.
2. **Poly Haven texture set**: add `"my-key": { "id": "<id>", "tileMeters": 3 }` to `polyhaven.textures`
   (`https://api.polyhaven.com/assets?t=textures` lists ids).
3. **Any other file**: add an entry to `remote` with `path`, `url`, `title`, `author`, `license`, `source`.
4. Run `make assets`, then `node scripts/validate-content.mjs` (every file in `assets/dist` must be credited, and vice
   versa — the pipeline maintains `credits.json` for you and drops entries whose file disappeared).

To rebuild something, delete its file(s) from `assets/dist/` and run again; only missing outputs are regenerated.
Downloads live in `$ASSETS_CACHE` (default `<tmpdir>/truenorth-asset-cache`), never inside the repo. KTX-Software 4.4.2
is installed automatically into `node_modules/.cache/ktx-software/` on Linux x86_64 when `ktx` is not on `PATH`.

## Licences

| Source | Licence | Credit |
| --- | --- | --- |
| Poly Haven models, textures, HDRI | CC0-1.0 | authors from `api.polyhaven.com/info/<id>`, `https://polyhaven.com/a/<id>` |
| Quaternius Universal Base Characters / Universal Animation Library | CC0-1.0 | Quaternius, `https://quaternius.itch.io/…` |
| three.js Basis/Draco transcoders | MIT (bundling Apache-2.0 Draco/Basis) | three.js authors |
| Procedural audio | Generated | TrueNorth |

Texture substitutions (no exact Poly Haven match): `roof-copper` → `green_metal_rust` (verdigris look; there is no
"copper" texture), `wood` → `wood_planks_grey`, `metal` → `metal_plate`, `rock` → `rock_face`, `snow` → `snow_02`.
