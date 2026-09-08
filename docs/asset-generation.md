# Hero asset generation (local text-to-3D)

TrueNorth's landmarks, fauna and props are generated locally — no generic placeholders and no third-party asset
downloads. This document records the model stack that works on this machine, why the alternatives do not, and how to
run and extend the pipeline.

Everything here writes into `assets/src/hero/*.glb` (generator output, checked in) and `assets/prompts/*.json` (the
recipe for each asset). `scripts/lib/hero.mjs` then compresses those into `assets/dist/models/hero/<key>.glb` as part
of `make assets`; the generator itself is **not** part of a normal build — it needs a GPU and ~15 GB of model weights.

## The stack that works

| Stage | Model / tool | Notes |
| --- | --- | --- |
| Concept image | `stabilityai/sdxl-turbo` (fp16, 4 steps, cfg 0) | ~1.5 s per 512² image on the 8060S |
| Matting | `rembg` u2net (onnxruntime, CPU) | object → alpha; a coverage check rejects empty frames |
| Shape | `tencent/Hunyuan3D-2mini` DiT-v2-mini-turbo + VAE-v2-mini-turbo, FlashVDM, 5 steps | ~45 s per mesh at octree 320 |
| Mesh post | trimesh + pymeshlab + xatlas (`scripts/gen3d/postprocess.py`) | orient, scale, decimate, unwrap, bake |
| Compression | `@gltf-transform` + meshoptimizer + KTX2 (`scripts/lib/hero.mjs`) | LOD0/LOD1, ETC1S base colour, Draco |

Hunyuan3D-2mini generates *shape only*. Its texture-painting stage is not used (see below), so colour comes from
projecting the concept image onto the mesh — front-facing texels sample the image, back-facing texels sample its
mirror, and the two blend across the silhouette. For a single object shot head-on this is convincing from the
front and the sides and acceptable from behind, which is how these assets are seen in game.

### Why not TRELLIS

`microsoft/TRELLIS-text-large` needs `spconv` and `flash-attn`. `spconv` publishes no wheel for CPython 3.14 (newest
tags are cp313) and no ROCm build at all — its CUDA kernels are hand-written and do not compile under HIP. Building
from source would mean porting the sparse-convolution kernels. Rejected within the time box, before downloading
weights.

### Why not Hunyuan3D's texture stage

`hy3dgen.texgen` needs two CUDA extensions, `custom_rasterizer` (`rasterizer_gpu.cu`) and the
`differentiable_renderer` mesh painter. `hipify` handles most of the source, but the pipeline also wants the
multi-view paint UNet (~11 GB more weights) for a stage whose output we would immediately re-bake to a single 1k
texture. The projected-concept bake gives comparable quality at game distance for a fraction of the setup, so the
texture stage is deliberately skipped. Shape generation itself is pure PyTorch and runs unmodified on ROCm.

### ROCm-specific fixes

Three things had to be worked around on gfx1151 / ROCm 7.2; each is a comment at the point where it matters.

1. **The venv must not install its own torch.** The working torch is the system ROCm build in
   `/usr/lib/python3.14/site-packages`. `uv` cannot see system site-packages while resolving, so any package
   declaring a `torch` dependency drags in a CUDA torch that silently shadows it (`torch.cuda.is_available()` goes
   `False`). `setup.sh` installs `diffusers`/`transformers`/`accelerate` with `--no-deps` and asserts afterwards
   that `torch.version.hip` is set.
2. **No torchvision.** The PyPI wheel is built against CUDA torch and fails at import with
   `operator torchvision::nms does not exist`. `hy3dgen` uses torchvision only for `Resize`/`CenterCrop`/`Normalize`,
   so `scripts/gen3d/tv_compat.py` reimplements those three in plain torch and `setup.sh` patches the import.
3. **The flash / mem-efficient SDPA kernels are non-deterministic here.** With the default kernel selection the same
   seed produced a different image on every run and roughly a third of all images came out as pure RGB noise
   (measured as mean neighbouring-pixel delta > 30, vs < 12 for a clean render). Forcing the math kernel
   (`stable_attention()` in `generate.py`) makes generation reproducible and noise-free, at ~40 % lower throughput —
   shape generation goes from ~8 s to ~45 s per asset. This is the single most important setting in the pipeline;
   without it the output is unusable.

`diso` (differentiable dual marching cubes) is also CUDA-only, so the VAE uses `mc_algo='mc'` — scikit-image
marching cubes on the CPU. It costs a few seconds per mesh and is otherwise equivalent.

## Prompting notes

- **CLIP truncates at 77 tokens.** Long framing suffixes get cut, so the subject and its distinctive features go
  first in every prompt and the studio-framing boilerplate goes last.
- **SDXL-Turbo will not zoom out** when a subject has a canonical photographic framing. Asking for a "miniature
  souvenir desk model … standing on a plain white surface" reliably produces the whole object with margins, and it
  is what makes `cn-tower` and `totem-pole` work (a direct prompt gives a cityscape and a close-up of one carved
  face respectively).
- Animals need "dry, no water, no reflection" or the matte keeps a puddle, which the shape model then extrudes into
  a slab under the animal.
- **A straight-on view produces a flat relief.** This is the failure that costs the most rework: given a head-on
  elevation, Hunyuan3D has no parallax to work from and returns a billboard. The first `loon` came out 0.005 m deep
  and the first `chateau-laurier` was a 0.97 m facade card. Asking for "a three quarter angle showing two sides at
  once" fixes both. Check the printed `size` of every new asset — a depth far below the other two dimensions means a
  relief, not a model.
- Souvenir framing has a cost: it often adds a base plate, and a wide one becomes part of the mesh (the first
  `cn-tower` was 95 m across at 120 m tall because of its display disc). "no base plate, no stand, no platform"
  removes it.

## Parametric fallback

`scripts/gen3d/parametric.py` hand-builds geometry for assets the image path cannot produce. Keys listed in its
`BUILDERS` map skip the image, matte and shape stages — `generate.py` builds them directly and runs only the
unwrap-and-bake half of post-processing, using the mesh's own vertex colours — so one `generate.py` run still covers
every key.

Currently the map holds just `peace-tower`: every phrasing of a freestanding gothic clock tower attaches a church
nave or a city skyline, because that is what the training data holds. Since the Peace Tower is the hub landmark, it is built from primitives with
correct proportions (92 m tall, ~15 m plan, clock stage at 0.65 h, spire 0.24 h) and vertex colours baked to a
texture through the same unwrap-and-bake path. Add a builder to `BUILDERS` to cover another key.

## Running it

```bash
SCRATCH=/path/to/scratch scripts/gen3d/setup.sh        # venv + Hunyuan3D checkout + ~15 GB weights
source $SCRATCH/gen3d/env.sh

python scripts/gen3d/generate.py                        # all keys, all stages
python scripts/gen3d/generate.py --keys moose loon --stage image --force
python scripts/gen3d/preview.py assets/src/hero/*.glb --out /tmp/sheet.png
```

Weights and per-asset working files live in `$GEN3D_DISK_CACHE` (default `~/.cache/truenorth-gen3d`), never in the
repo and never in the scratchpad — the scratchpad is a RAM-backed tmpfs that is cleared between sessions, and 15 GB
of weights there will take the machine down. Re-running `setup.sh` after a wipe is a ~2 minute no-op.

Each stage caches its output per key (`concept.png`, `concept_rgba.png`, `raw.ply`), so an interrupted run resumes
and a failure in one asset never stops the batch — failures are logged per key and reported at the end.

## Adding an asset

1. Write `assets/prompts/<key>.json`:
   `{ key, category: 'hero'|'fauna'|'prop', prompt, negativePrompt, seed, model, targetHeightMeters, polyBudget, notes }`.
2. `python scripts/gen3d/generate.py --keys <key>` and check `preview.py`'s contact sheet.
3. Unhappy with the result? Sweep seeds (the concept image is the cheap part at 1.5 s) before touching the prompt.
4. The key must not collide with a Poly Haven model key — both land in the same renderer manifest.

`notes` carries `culturalReview: true` for assets depicting Indigenous cultural material (`totem-pole`), which the
credits entry propagates so review is not skipped before release.
