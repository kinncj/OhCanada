# scripts/gen3d — local text-to-3D hero assets

Generates `assets/src/hero/*.glb` (landmarks, fauna, props) from the recipes in `assets/prompts/*.json`, entirely on
the local GPU. See [docs/asset-generation.md](../../docs/asset-generation.md) for the model stack, the ROCm
workarounds and the prompting notes; this file is just the map.

| File | What it is |
| --- | --- |
| `setup.sh` | Builds the venv against the system ROCm torch, clones + patches Hunyuan3D-2, downloads weights |
| `tv_compat.py` | torch-only replacement for the three `torchvision.transforms` hy3dgen needs |
| `generate.py` | The driver: concept image → matte → shape → post, each stage cached per key |
| `postprocess.py` | Raw mesh → game-ready GLB: orient, scale, decimate, unwrap, bake texture |
| `parametric.py` | Hand-built geometry for keys the image path cannot produce (`peace-tower`) |
| `preview.py` | Software-rasterised contact sheet (front/¾/side/back) for reviewing output |

```bash
SCRATCH=/path/to/scratch scripts/gen3d/setup.sh && source $SCRATCH/gen3d/env.sh
python scripts/gen3d/generate.py --keys moose
python scripts/gen3d/preview.py assets/src/hero/moose.glb --out /tmp/moose.png
```

Nothing here runs during a normal build. `make assets` consumes the committed GLBs through `scripts/lib/hero.mjs`.
