"""Raw generated mesh → game-ready source GLB (assets/src/hero/<key>.glb).

Steps: keep the large connected components → canonical orientation (+Y up, front toward +Z, chosen by silhouette
IoU against the concept image's alpha mask) → scale to targetHeightMeters with the base at y=0 → quadric decimation
to the prompt's polyBudget (pymeshlab) → xatlas UV unwrap → base colour texture baked per texel by projecting the
concept image (front-facing texels from the image, back-facing texels from its mirror; the two are blended across the
silhouette) → GLB with one metallic-roughness PBR material.

Usable standalone:  python postprocess.py <raw mesh> <concept_rgba.png> <prompt.json> <out.glb>
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import trimesh
import xatlas
from PIL import Image
from scipy import ndimage

TEX_SIZE = {'hero': 1024, 'fauna': 1024, 'prop': 512}
# 24 proper rotations of the axis-aligned frame, as (permutation, signs) → matrix.
_ROTATIONS = []
for perm in ([0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]):
    for sx in (1, -1):
        for sy in (1, -1):
            for sz in (1, -1):
                m = np.zeros((3, 3))
                for row, (col, s) in enumerate(zip(perm, (sx, sy, sz))):
                    m[row, col] = s
                if np.linalg.det(m) > 0:
                    _ROTATIONS.append(m)
assert len(_ROTATIONS) == 24


def log(msg: str) -> None:
    print(f'[postprocess] {msg}', flush=True)


# ---------------------------------------------------------------- cleanup ----
def keep_main_components(mesh: trimesh.Trimesh, min_ratio: float = 0.02) -> trimesh.Trimesh:
    """Drop floaters: keep every connected component with at least `min_ratio` of the largest component's faces."""
    parts = mesh.split(only_watertight=False)
    if len(parts) <= 1:
        return mesh
    parts = sorted(parts, key=lambda p: len(p.faces), reverse=True)
    biggest = len(parts[0].faces)
    keep = [p for p in parts if len(p.faces) >= biggest * min_ratio]
    log(f'components: {len(parts)} → keeping {len(keep)} (largest {biggest} faces)')
    return trimesh.util.concatenate(keep) if len(keep) > 1 else keep[0]


def decimate(mesh: trimesh.Trimesh, target_faces: int) -> trimesh.Trimesh:
    """Quadric edge collapse to `target_faces` with pymeshlab (keeps the silhouette better than clustering)."""
    if len(mesh.faces) <= target_faces:
        return mesh
    import pymeshlab

    ms = pymeshlab.MeshSet()
    ms.add_mesh(pymeshlab.Mesh(vertex_matrix=np.asarray(mesh.vertices, dtype=np.float64), face_matrix=np.asarray(mesh.faces, dtype=np.int32)))
    ms.meshing_remove_duplicate_vertices()
    ms.meshing_decimation_quadric_edge_collapse(targetfacenum=int(target_faces), preservenormal=True, preservetopology=False, planarquadric=True, qualitythr=0.4)
    ms.meshing_remove_unreferenced_vertices()
    m = ms.current_mesh()
    out = trimesh.Trimesh(m.vertex_matrix(), m.face_matrix(), process=False)
    log(f'decimate: {len(mesh.faces)} → {len(out.faces)} faces (target {target_faces})')
    return out


# ------------------------------------------------------------ orientation ----
def _silhouette(xy: np.ndarray, faces: np.ndarray, res: int) -> np.ndarray:
    """Binary raster of the mesh projected to `xy` (already normalised to the unit square, y up)."""
    img = np.zeros((res, res), np.uint8)
    pts = np.stack([xy[:, 0] * (res - 1), (1 - xy[:, 1]) * (res - 1)], axis=1).astype(np.int32)
    cv2.fillPoly(img, [pts[f] for f in faces], 1)
    return img.astype(bool)


def _normalise_xy(v: np.ndarray) -> np.ndarray:
    lo, hi = v.min(axis=0), v.max(axis=0)
    return (v - lo) / np.maximum(hi - lo, 1e-9)


def best_orientation(mesh: trimesh.Trimesh, mask: np.ndarray, res: int = 128) -> tuple[np.ndarray, float]:
    """Rotation matrix (applied as v @ R.T) that makes the mesh's +Z-facing silhouette match the concept mask best."""
    ys, xs = np.nonzero(mask)
    crop = mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    target = cv2.resize(crop.astype(np.uint8), (res, res), interpolation=cv2.INTER_AREA).astype(bool)
    # Sample faces for speed on dense raw meshes.
    faces = mesh.faces if len(mesh.faces) <= 60000 else mesh.faces[np.random.default_rng(0).choice(len(mesh.faces), 60000, replace=False)]
    best, best_iou = np.eye(3), -1.0
    for r in _ROTATIONS:
        v = mesh.vertices @ r.T
        sil = _silhouette(_normalise_xy(v[:, :2]), faces, res)
        iou = np.logical_and(sil, target).sum() / max(1, np.logical_or(sil, target).sum())
        if iou > best_iou:
            best, best_iou = r, iou
    return best, float(best_iou)


# ----------------------------------------------------------------- baking ----
def _extended_image(rgba: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """RGB image whose background pixels take the colour of the nearest foreground pixel (no white bleed at the rim)."""
    alpha = rgba[..., 3] > 127
    rgb = rgba[..., :3].astype(np.float32)
    if alpha.all():
        return rgb, alpha
    _, (iy, ix) = ndimage.distance_transform_edt(~alpha, return_indices=True)
    return rgb[iy, ix], alpha


def _sample_bilinear(img: np.ndarray, px: np.ndarray, py: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    px = np.clip(px, 0, w - 1.001)
    py = np.clip(py, 0, h - 1.001)
    x0, y0 = np.floor(px).astype(int), np.floor(py).astype(int)
    fx, fy = (px - x0)[:, None], (py - y0)[:, None]
    c00, c10, c01, c11 = img[y0, x0], img[y0, x0 + 1], img[y0 + 1, x0], img[y0 + 1, x0 + 1]
    return (c00 * (1 - fx) * (1 - fy) + c10 * fx * (1 - fy) + c01 * (1 - fx) * fy + c11 * fx * fy)


def bake_projected_texture(mesh: trimesh.Trimesh, uv: np.ndarray, rgba: np.ndarray, size: int) -> Image.Image:
    """Per-texel projective texturing from the front concept image (mesh is canonical: +Y up, front toward +Z)."""
    rgb, alpha = _extended_image(rgba)
    ys, xs = np.nonzero(alpha)
    bx0, bx1, by0, by1 = xs.min(), xs.max(), ys.min(), ys.max()
    v = np.asarray(mesh.vertices, dtype=np.float64)
    lo, hi = v.min(axis=0), v.max(axis=0)
    mirrored = rgb[:, ::-1]
    mbx0, mbx1 = rgb.shape[1] - 1 - bx1, rgb.shape[1] - 1 - bx0
    vn = np.asarray(mesh.vertex_normals, dtype=np.float64)
    faces = np.asarray(mesh.faces)

    tex = np.zeros((size, size, 3), np.float32)
    written = np.zeros((size, size), bool)
    uvp = np.stack([uv[:, 0] * (size - 1), (1 - uv[:, 1]) * (size - 1)], axis=1)
    for tri in faces:
        p = uvp[tri]
        x0, y0 = np.floor(p.min(axis=0)).astype(int)
        x1, y1 = np.ceil(p.max(axis=0)).astype(int)
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, size - 1), min(y1, size - 1)
        if x1 < x0 or y1 < y0:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        gx, gy = gx.ravel().astype(np.float64) + 0.5, gy.ravel().astype(np.float64) + 0.5
        (ax, ay), (bx, by), (cx, cy) = p + 0.5
        det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(det) < 1e-12:
            continue
        w0 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / det
        w1 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / det
        w2 = 1 - w0 - w1
        eps = -0.02  # slight overdraw so triangle edges have no gaps
        inside = (w0 >= eps) & (w1 >= eps) & (w2 >= eps)
        if not inside.any():
            continue
        w = np.stack([w0, w1, w2], axis=1)[inside]
        pos = w @ v[tri]
        nrm = w @ vn[tri]
        # Orthographic front projection fitted to the concept's bounding box.
        fx = (pos[:, 0] - lo[0]) / max(hi[0] - lo[0], 1e-9)
        fy = (pos[:, 1] - lo[1]) / max(hi[1] - lo[1], 1e-9)
        py = by1 - fy * (by1 - by0)
        front = _sample_bilinear(rgb, bx0 + fx * (bx1 - bx0), py)
        back = _sample_bilinear(mirrored, mbx0 + (1 - fx) * (mbx1 - mbx0), py)
        t = np.clip(nrm[:, 2:3] * 2.5 + 0.5, 0, 1)  # nz>0.2 → front image, nz<-0.2 → mirror, blend between
        col = front * t + back * (1 - t)
        ix, iy = gx[inside].astype(int), gy[inside].astype(int)
        tex[iy, ix] = col
        written[iy, ix] = True
    # Pad unwritten texels with the nearest written colour so bilinear filtering never picks up black seams.
    if not written.all():
        _, (iy, ix) = ndimage.distance_transform_edt(~written, return_indices=True)
        tex = tex[iy, ix]
    return Image.fromarray(np.clip(tex, 0, 255).astype(np.uint8))


def bake_vertex_colours(mesh: trimesh.Trimesh, uv: np.ndarray, colours: np.ndarray, size: int) -> Image.Image:
    """Bake per-vertex colours into a texture (parametric meshes carry colours, not a concept image to project)."""
    tex = np.zeros((size, size, 3), np.float32)
    written = np.zeros((size, size), bool)
    uvp = np.stack([uv[:, 0] * (size - 1), (1 - uv[:, 1]) * (size - 1)], axis=1)
    for tri in np.asarray(mesh.faces):
        p = uvp[tri]
        x0, y0 = np.floor(p.min(axis=0)).astype(int)
        x1, y1 = np.ceil(p.max(axis=0)).astype(int)
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, size - 1), min(y1, size - 1)
        if x1 < x0 or y1 < y0:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        gx, gy = gx.ravel().astype(np.float64) + 0.5, gy.ravel().astype(np.float64) + 0.5
        (ax, ay), (bx, by), (cx, cy) = p + 0.5
        det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(det) < 1e-12:
            continue
        w0 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / det
        w1 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / det
        w2 = 1 - w0 - w1
        inside = (w0 >= -0.02) & (w1 >= -0.02) & (w2 >= -0.02)
        if not inside.any():
            continue
        w = np.stack([w0, w1, w2], axis=1)[inside]
        ix, iy = gx[inside].astype(int), gy[inside].astype(int)
        tex[iy, ix] = w @ colours[tri]
        written[iy, ix] = True
    if not written.all():
        _, (iy, ix) = ndimage.distance_transform_edt(~written, return_indices=True)
        tex = tex[iy, ix]
    return Image.fromarray(np.clip(tex, 0, 255).astype(np.uint8))


def unwrap(mesh: trimesh.Trimesh) -> tuple[trimesh.Trimesh, np.ndarray, np.ndarray | None]:
    """xatlas UV unwrap; returns the re-indexed mesh, per-vertex UVs and the remapped vertex colours (if any)."""
    colours = None
    vis = mesh.visual
    if hasattr(vis, 'vertex_colors') and vis.vertex_colors is not None and len(vis.vertex_colors) == len(mesh.vertices):
        colours = np.asarray(vis.vertex_colors, dtype=np.float64)[:, :3]
    vmap, indices, uvs = xatlas.parametrize(np.asarray(mesh.vertices, np.float32), np.asarray(mesh.faces, np.uint32))
    out = trimesh.Trimesh(mesh.vertices[vmap], indices.astype(np.int64), process=False)
    return out, uvs.astype(np.float64), None if colours is None else colours[vmap]


# ------------------------------------------------------------------ driver ----
def postprocess(raw_path: Path, concept_path: Path | None, prompt: dict, out_path: Path) -> dict:
    """`concept_path` None (or a mesh that carries vertex colours) bakes the mesh's own colours instead of projecting."""
    t0 = time.time()
    mesh = trimesh.load(raw_path, force='mesh', process=False)
    log(f'{prompt["key"]}: raw {len(mesh.faces)} faces')
    parametric = concept_path is None
    if not parametric:
        mesh = keep_main_components(mesh)
    rgba = None if parametric else np.asarray(Image.open(concept_path).convert('RGBA'))

    iou = float('nan')
    if not parametric:
        rot, iou = best_orientation(mesh, rgba[..., 3] > 127)
        mesh.vertices = mesh.vertices @ rot.T
        log(f'orientation IoU {iou:.3f}')

    budget = int(prompt.get('polyBudget') or 25000)
    if not parametric:  # parametric meshes are already at their minimal face count and decimation would ruin them
        mesh = decimate(mesh, budget)
        mesh.merge_vertices()
        mesh.update_faces(mesh.nondegenerate_faces())
        mesh.fix_normals()

    # Scale to metres, base on the ground, centred in XZ.
    lo, hi = mesh.bounds
    height = float(prompt['targetHeightMeters'])
    s = height / max(hi[1] - lo[1], 1e-9)
    mesh.vertices = (mesh.vertices - [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2]) * s

    mesh, uv, vertex_colours = unwrap(mesh)
    size = TEX_SIZE.get(prompt.get('category', 'hero'), 1024)
    if parametric:
        if vertex_colours is None:
            raise ValueError(f'{prompt["key"]}: parametric mesh carries no vertex colours to bake')
        tex = bake_vertex_colours(mesh, uv, vertex_colours, size)
    else:
        tex = bake_projected_texture(mesh, uv, rgba, size)
    material = trimesh.visual.material.PBRMaterial(baseColorTexture=tex, metallicFactor=0.0, roughnessFactor=0.85, name=f'{prompt["key"]}_mat')
    mesh.visual = trimesh.visual.TextureVisuals(uv=uv, material=material)
    mesh.metadata['name'] = prompt['key']
    out_path.parent.mkdir(parents=True, exist_ok=True)
    scene = trimesh.Scene()
    scene.add_geometry(mesh, node_name=prompt['key'], geom_name=prompt['key'])
    scene.export(out_path, file_type='glb')
    b = mesh.bounds
    stats = {'faces': int(len(mesh.faces)), 'vertices': int(len(mesh.vertices)), 'iou': None if np.isnan(iou) else round(iou, 3), 'bytes': out_path.stat().st_size,
             'size': [round(float(x), 3) for x in (b[1] - b[0])], 'seconds': round(time.time() - t0, 1)}
    log(f'{prompt["key"]}: {stats}')
    return stats


if __name__ == '__main__':
    raw, concept, prompt_file, out = sys.argv[1:5]
    postprocess(Path(raw), None if concept in ('-', 'none') else Path(concept), json.loads(Path(prompt_file).read_text()), Path(out))
