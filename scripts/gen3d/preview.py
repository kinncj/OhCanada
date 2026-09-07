"""Contact-sheet preview of generated GLBs (front / three-quarter / side / back), software rasterised.

  python scripts/gen3d/preview.py assets/src/hero/moose.glb [more.glb ...] --out /path/sheet.png
Textured, lambert-shaded, z-buffered — enough to judge silhouette, orientation and texture projection without a browser.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import trimesh
from PIL import Image, ImageDraw

VIEWS = [('front', 0.0), ('3/4', 45.0), ('side', 90.0), ('back', 180.0)]


def _rot_y(deg: float) -> np.ndarray:
    a = np.radians(deg)
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def _load(path: Path) -> tuple[trimesh.Trimesh, np.ndarray | None, np.ndarray | None]:
    scene = trimesh.load(path, force='scene')
    meshes = [g for g in scene.dump(concatenate=False) if isinstance(g, trimesh.Trimesh)]
    mesh = meshes[0] if len(meshes) == 1 else trimesh.util.concatenate(meshes)
    tex, uv = None, None
    vis = mesh.visual
    if isinstance(vis, trimesh.visual.TextureVisuals) and vis.uv is not None and getattr(vis.material, 'baseColorTexture', None) is not None:
        tex = np.asarray(vis.material.baseColorTexture.convert('RGB')).astype(np.float32) / 255
        uv = np.asarray(vis.uv, dtype=np.float64)
    return mesh, tex, uv


def render(mesh: trimesh.Trimesh, tex: np.ndarray | None, uv: np.ndarray | None, yaw: float, res: int) -> np.ndarray:
    v = np.asarray(mesh.vertices, np.float64) @ _rot_y(yaw).T
    n = np.asarray(mesh.vertex_normals, np.float64) @ _rot_y(yaw).T
    lo, hi = mesh.bounds
    extent = float(max(hi - lo)) * 1.15
    centre = (lo + hi) / 2
    centre = centre @ _rot_y(yaw).T
    # Orthographic: x right, y up, camera looking down -z (so +z faces the camera).
    px = (v[:, 0] - centre[0]) / extent * (res - 1) + res / 2
    py = (centre[1] - v[:, 1]) / extent * (res - 1) + res / 2
    pz = v[:, 2]
    img = np.full((res, res, 3), 1.0, np.float32)
    zbuf = np.full((res, res), -np.inf)
    light = np.array([0.4, 0.8, 0.6])
    light /= np.linalg.norm(light)
    faces = np.asarray(mesh.faces)
    for tri in faces:
        xs, ys, zs = px[tri], py[tri], pz[tri]
        x0, x1 = int(max(np.floor(xs.min()), 0)), int(min(np.ceil(xs.max()), res - 1))
        y0, y1 = int(max(np.floor(ys.min()), 0)), int(min(np.ceil(ys.max()), res - 1))
        if x1 < x0 or y1 < y0:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        gx, gy = gx.ravel() + 0.5, gy.ravel() + 0.5
        (ax, ay), (bx, by), (cx, cy) = zip(xs, ys)
        det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(det) < 1e-9:
            continue
        w0 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / det
        w1 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / det
        w2 = 1 - w0 - w1
        inside = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        if not inside.any():
            continue
        w = np.stack([w0, w1, w2], axis=1)[inside]
        z = w @ zs
        ix, iy = gx[inside].astype(int), gy[inside].astype(int)
        closer = z > zbuf[iy, ix]
        if not closer.any():
            continue
        w, z, ix, iy = w[closer], z[closer], ix[closer], iy[closer]
        nn = w @ n[tri]
        nn /= np.maximum(np.linalg.norm(nn, axis=1, keepdims=True), 1e-9)
        shade = 0.35 + 0.65 * np.clip(nn @ light, 0, 1)
        if tex is not None:
            t = w @ uv[tri]
            tx = np.clip((t[:, 0] * (tex.shape[1] - 1)).astype(int), 0, tex.shape[1] - 1)
            ty = np.clip(((1 - t[:, 1]) * (tex.shape[0] - 1)).astype(int), 0, tex.shape[0] - 1)
            col = tex[ty, tx]
        else:
            col = np.full((len(w), 3), 0.7)
        img[iy, ix] = col * shade[:, None]
        zbuf[iy, ix] = z
    return (np.clip(img, 0, 1) * 255).astype(np.uint8)


def sheet(paths: list[Path], out: Path, res: int = 320) -> None:
    rows = []
    for path in paths:
        mesh, tex, uv = _load(path)
        tiles = [Image.fromarray(render(mesh, tex, uv, yaw, res)) for _, yaw in VIEWS]
        row = Image.new('RGB', (res * len(tiles), res + 22), 'white')
        for i, t in enumerate(tiles):
            row.paste(t, (i * res, 22))
        d = ImageDraw.Draw(row)
        b = mesh.bounds
        d.text((4, 4), f'{path.stem}: {len(mesh.faces)} tris, {b[1][0]-b[0][0]:.2f} x {b[1][1]-b[0][1]:.2f} x {b[1][2]-b[0][2]:.2f} m, {path.stat().st_size/1e6:.2f} MB   [{" | ".join(n for n, _ in VIEWS)}]', fill='black')
        rows.append(row)
    w = max(r.width for r in rows)
    canvas = Image.new('RGB', (w, sum(r.height for r in rows)), 'white')
    y = 0
    for r in rows:
        canvas.paste(r, (0, y))
        y += r.height
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out)
    print(f'wrote {out}')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('glbs', nargs='+', type=Path)
    ap.add_argument('--out', type=Path, required=True)
    ap.add_argument('--res', type=int, default=320)
    a = ap.parse_args()
    sheet(a.glbs, a.out, a.res)
