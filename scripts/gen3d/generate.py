"""Local text → 3D hero asset generator (AMD ROCm).

Stages, each cached under $GEN3D_WORK/<key>/ so an interrupted run resumes:
  1. concept.png      SDXL-Turbo text-to-image (512², 4 steps, fixed seed) — the "text" half of text-to-3D
  2. concept_rgba.png rembg matting (u2net, CPU onnxruntime) → object on transparent background
  3. raw.ply          Hunyuan3D-2mini-Turbo image-to-shape (FlashVDM, 5 steps, marching cubes) → dense raw mesh
  4. <key>.glb        scripts/gen3d/postprocess.py → assets/src/hero/<key>.glb (oriented, scaled, decimated, textured)

Keys listed in parametric.BUILDERS skip stages 1-3: their geometry is hand-built (see parametric.py) and only the
unwrap-and-bake half of stage 4 applies, using the mesh's own vertex colours.

Usage:
  source $SCRATCH/gen3d/env.sh
  python scripts/gen3d/generate.py [--keys moose beaver ...] [--stage image|matte|shape|post|all] [--force]
                                   [--octree 320] [--work DIR] [--out assets/src/hero] [--prompts assets/prompts]
"""
from __future__ import annotations

import argparse
import gc
import json
import os
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from parametric import BUILDERS, build as build_parametric  # noqa: E402
from postprocess import postprocess  # noqa: E402

T2I_MODEL = 'stabilityai/sdxl-turbo'
SHAPE_MODEL = 'tencent/Hunyuan3D-2mini'
SHAPE_SUBFOLDER = 'hunyuan3d-dit-v2-mini-turbo'


def log(msg: str) -> None:
    print(f'[gen3d] {msg}', flush=True)


def load_prompts(prompts_dir: Path, keys: list[str] | None) -> list[dict]:
    files = sorted(prompts_dir.glob('*.json'))
    prompts = [json.loads(f.read_text()) for f in files]
    if keys:
        wanted = set(keys)
        prompts = [p for p in prompts if p['key'] in wanted]
        missing = wanted - {p['key'] for p in prompts}
        if missing:
            raise SystemExit(f'no prompt file for: {sorted(missing)}')
    return prompts


def generative(prompts: list[dict]) -> list[dict]:
    """Prompts whose mesh comes from the image-to-3D path (the rest are built by parametric.py)."""
    return [p for p in prompts if p['key'] not in BUILDERS]


def free_gpu() -> None:
    import torch

    gc.collect()
    torch.cuda.empty_cache()


def stable_attention() -> None:
    """ROCm 7.2 / gfx1151: the flash and memory-efficient SDPA kernels are racy here — the same seed gives different
    images run to run and roughly a third come out as pure noise. The math kernel is deterministic (~40 % slower)."""
    import torch

    torch.backends.cuda.enable_flash_sdp(False)
    torch.backends.cuda.enable_mem_efficient_sdp(False)
    torch.backends.cuda.enable_math_sdp(True)


# ---------------------------------------------------------------- stage 1 ----
def stage_image(prompts: list[dict], work: Path, force: bool) -> None:
    todo = [p for p in generative(prompts) if force or not (work / p['key'] / 'concept.png').exists()]
    if not todo:
        return
    import torch
    from diffusers import AutoPipelineForText2Image

    stable_attention()
    t = time.time()
    pipe = AutoPipelineForText2Image.from_pretrained(T2I_MODEL, torch_dtype=torch.float16, variant='fp16').to('cuda')
    pipe.set_progress_bar_config(disable=True)
    log(f'SDXL-Turbo loaded in {time.time() - t:.1f}s')
    for p in todo:
        t = time.time()
        g = torch.Generator('cuda').manual_seed(int(p['seed']))
        img = pipe(prompt=p['prompt'], negative_prompt=p.get('negativePrompt', ''), num_inference_steps=4, guidance_scale=0.0,
                   height=512, width=512, generator=g).images[0]
        (work / p['key']).mkdir(parents=True, exist_ok=True)
        img.save(work / p['key'] / 'concept.png')
        log(f'{p["key"]}: concept image in {time.time() - t:.1f}s')
    del pipe
    free_gpu()


# ---------------------------------------------------------------- stage 2 ----
def stage_matte(prompts: list[dict], work: Path, force: bool) -> None:
    todo = [p for p in generative(prompts) if force or not (work / p['key'] / 'concept_rgba.png').exists()]
    if not todo:
        return
    from PIL import Image
    from rembg import new_session, remove

    session = new_session('u2net')
    import numpy as np

    for p in todo:
        img = Image.open(work / p['key'] / 'concept.png').convert('RGB')
        out = remove(img, session=session, alpha_matting=False, post_process_mask=True)
        coverage = (np.asarray(out)[..., 3] > 127).mean()
        if coverage < 0.02:
            log(f'{p["key"]}: matte covers {coverage:.1%} of the frame — concept is empty or noise, re-seed it')
            continue
        out.save(work / p['key'] / 'concept_rgba.png')
        log(f'{p["key"]}: matted ({coverage:.0%} coverage)')


# ---------------------------------------------------------------- stage 3 ----
def stage_shape(prompts: list[dict], work: Path, force: bool, octree: int) -> None:
    todo = [p for p in generative(prompts) if force or not (work / p['key'] / 'raw.ply').exists()]
    if not todo:
        return
    import torch
    from PIL import Image
    from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline

    stable_attention()
    t = time.time()
    pipe = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(SHAPE_MODEL, subfolder=SHAPE_SUBFOLDER, device='cuda', dtype=torch.float16)
    pipe.enable_flashvdm(mc_algo='mc')  # dmc needs the CUDA-only `diso`; mc is skimage marching cubes on the CPU
    log(f'Hunyuan3D-2mini-Turbo loaded in {time.time() - t:.1f}s')
    for p in todo:
        t = time.time()
        rgba = work / p['key'] / 'concept_rgba.png'
        if not rgba.exists():
            log(f'{p["key"]}: no matte, skipped')
            continue
        try:
            img = Image.open(rgba).convert('RGBA')
            g = torch.Generator('cuda').manual_seed(int(p['seed']))
            mesh = pipe(image=img, num_inference_steps=5, guidance_scale=5.0, generator=g, octree_resolution=octree, num_chunks=20000,
                        mc_level=0.0, enable_pbar=False, output_type='trimesh')[0]
            mesh.export(work / p['key'] / 'raw.ply')
            log(f'{p["key"]}: shape {len(mesh.faces)} faces in {time.time() - t:.1f}s')
        except Exception as err:  # keep the batch going; the report lists what failed
            log(f'{p["key"]}: shape FAILED: {err!r}')
    del pipe
    free_gpu()


# ---------------------------------------------------------------- stage 4 ----
def stage_post(prompts: list[dict], work: Path, out_dir: Path, force: bool) -> dict:
    stats = {}
    for p in prompts:
        key = p['key']
        out = out_dir / f'{key}.glb'
        parametric = key in BUILDERS
        raw = work / key / ('parametric.glb' if parametric else 'raw.ply')
        try:
            if parametric:
                raw.parent.mkdir(parents=True, exist_ok=True)
                build_parametric(key, p, raw)
            elif not raw.exists():
                log(f'{key}: no raw mesh, skipped')
                continue
            elif out.exists() and not force and out.stat().st_mtime >= raw.stat().st_mtime:
                continue
            stats[key] = postprocess(raw, None if parametric else work / key / 'concept_rgba.png', p, out)
        except Exception as err:
            log(f'{key}: postprocess FAILED: {err!r}')
            stats[key] = {'error': repr(err)}
    return stats


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--keys', nargs='*')
    ap.add_argument('--stage', default='all', choices=['image', 'matte', 'shape', 'post', 'all'])
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--octree', type=int, default=320, help='Hunyuan3D octree resolution (256 fast … 384 finest)')
    ap.add_argument('--work', type=Path, default=Path(os.environ.get('GEN3D_WORK', os.environ.get('SCR', '/tmp')) + '/work'))
    ap.add_argument('--out', type=Path, default=REPO / 'assets' / 'src' / 'hero')
    ap.add_argument('--prompts', type=Path, default=REPO / 'assets' / 'prompts')
    a = ap.parse_args()
    prompts = load_prompts(a.prompts, a.keys)
    a.work.mkdir(parents=True, exist_ok=True)
    log(f'{len(prompts)} assets, stage={a.stage}, work={a.work}')
    if a.stage in ('image', 'all'):
        stage_image(prompts, a.work, a.force)
    if a.stage in ('matte', 'all'):
        stage_matte(prompts, a.work, a.force)
    if a.stage in ('shape', 'all'):
        stage_shape(prompts, a.work, a.force, a.octree)
    if a.stage in ('post', 'all'):
        stats = stage_post(prompts, a.work, a.out, a.force)
        (a.work / 'stats.json').write_text(json.dumps(stats, indent=2))


if __name__ == '__main__':
    main()
