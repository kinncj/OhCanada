"""Parametric (hand-authored) geometry for assets the image-to-3D path cannot produce cleanly.

SDXL-Turbo will not draw a *freestanding* gothic clock tower: every prompt phrasing attaches a church nave or a
cityscape, and the resulting mesh is a building, not the Peace Tower. Because that silhouette carries the game's
main landmark, it is built here from primitives instead — correct proportions by construction, vertex-coloured with
sandstone / copper / clock-face materials and baked to a texture the same way generated meshes are.

  python scripts/gen3d/parametric.py peace-tower assets/prompts/peace-tower.json assets/src/hero/peace-tower.glb

Each builder returns a trimesh.Trimesh in metres, +Y up, base at y=0, centred in XZ, with per-face colours.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import trimesh

SANDSTONE = [206, 188, 148, 255]
SANDSTONE_DARK = [178, 158, 120, 255]
COPPER = [122, 176, 150, 255]  # oxidised copper green
COPPER_DARK = [96, 148, 124, 255]
CLOCK = [238, 233, 220, 255]
CLOCK_RIM = [92, 82, 66, 255]
GRANITE = [150, 148, 143, 255]


def _box(size, translate, colour) -> trimesh.Trimesh:
    m = trimesh.creation.box(extents=size)
    m.apply_translation(translate)
    m.visual.face_colors = colour
    return m


def _pyramid(base: float, height: float, translate, colour, sides: int = 4) -> trimesh.Trimesh:
    """Regular pyramid/cone with `sides` faces, apex up; `translate` places the centre of its base."""
    ang = np.linspace(0, 2 * np.pi, sides, endpoint=False) + np.pi / sides
    r = base / 2 / np.cos(np.pi / sides)  # circumradius so the flat-to-flat width equals `base`
    ring = np.stack([np.cos(ang) * r, np.zeros(sides), np.sin(ang) * r], axis=1)
    verts = np.vstack([ring, [[0, height, 0]], [[0, 0, 0]]])
    apex, centre = sides, sides + 1
    faces = [[i, (i + 1) % sides, apex] for i in range(sides)] + [[(i + 1) % sides, i, centre] for i in range(sides)]
    m = trimesh.Trimesh(verts, np.array(faces), process=False)
    m.apply_translation(translate)
    m.visual.face_colors = colour
    return m


def _cylinder(radius: float, height: float, translate, colour, sections: int = 24, axis: str = 'y') -> trimesh.Trimesh:
    """Cylinder of `height` along `axis`. trimesh builds cylinders along +Z, so 'x' and 'y' need a quarter turn."""
    m = trimesh.creation.cylinder(radius=radius, height=height, sections=sections)
    if axis == 'y':
        m.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
    elif axis == 'x':
        m.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [0, 1, 0]))
    m.apply_translation(translate)
    m.visual.face_colors = colour
    return m


def peace_tower(height: float = 92.0) -> trimesh.Trimesh:
    """Ottawa's Peace Tower: square sandstone campanile, corner buttresses, clock stage, steep copper spire.

    Proportions follow the real tower (92.2 m to the tip): shaft ≈ 0.62 of the height, clock stage ≈ 0.08,
    belfry/parapet ≈ 0.06, spire ≈ 0.24, plan ≈ 14 m square.
    """
    h = height
    w = h * 0.132          # ~12 m shaft plan at 92 m; buttresses and clocks take the tower to ~15 m overall
    parts: list[trimesh.Trimesh] = []

    # Stepped granite base.
    parts.append(_box([w * 1.42, h * 0.014, w * 1.42], [0, h * 0.007, 0], GRANITE))
    parts.append(_box([w * 1.26, h * 0.020, w * 1.26], [0, h * 0.024, 0], SANDSTONE_DARK))

    # Main shaft, very slightly battered (three stacked drums, each a little narrower).
    shaft_top = h * 0.60
    drums = [(0.034, 0.22, 1.00), (0.22, 0.42, 0.965), (0.42, 0.60, 0.935)]
    for y0, y1, k in drums:
        parts.append(_box([w * k, h * (y1 - y0), w * k], [0, h * (y0 + y1) / 2, 0], SANDSTONE))

    # Corner buttresses running the full height of the shaft, stopping under the clock stage.
    bw = w * 0.20
    off = w * 0.46
    for sx in (-1, 1):
        for sz in (-1, 1):
            parts.append(_box([bw, shaft_top * 0.98, bw], [sx * off, shaft_top * 0.49 + h * 0.034, sz * off], SANDSTONE_DARK))

    # Tall pointed window bands on each face (recessed dark reveals read as gothic openings at game distance).
    for y0, y1 in ((0.10, 0.30), (0.34, 0.54)):
        for axis in (0, 1):
            for s in (-1, 1):
                t = [0, h * (y0 + y1) / 2, 0]
                t[0 if axis == 0 else 2] = s * w * 0.47
                size = [w * 0.34, h * (y1 - y0), w * 0.06] if axis == 0 else [w * 0.06, h * (y1 - y0), w * 0.34]
                parts.append(_box(size, t, [70, 62, 52, 255]))

    # Clock stage: slightly wider band with a clock face on all four sides.
    clock_y = h * 0.655
    parts.append(_box([w * 1.06, h * 0.085, w * 1.06], [0, clock_y, 0], SANDSTONE))
    for axis in (0, 1):
        for s in (-1, 1):
            t = [0.0, clock_y, 0.0]
            t[0 if axis == 0 else 2] = s * w * 0.54
            face_axis = 'x' if axis == 0 else 'z'
            rim = _cylinder(w * 0.33, w * 0.05, [0, 0, 0], CLOCK_RIM, axis=face_axis)
            face = _cylinder(w * 0.29, w * 0.06, [0, 0, 0], CLOCK, axis=face_axis)
            for m, depth in ((rim, 0.0), (face, w * 0.012 * s)):
                tt = list(t)
                tt[0 if axis == 0 else 2] += depth
                m.apply_translation(tt)
                parts.append(m)

    # Belfry with open arches, then the parapet the spire sits on.
    belfry_y = h * 0.723
    parts.append(_box([w * 0.98, h * 0.052, w * 0.98], [0, belfry_y, 0], SANDSTONE))
    for axis in (0, 1):
        for s in (-1, 1):
            t = [0.0, belfry_y, 0.0]
            t[0 if axis == 0 else 2] = s * w * 0.49
            size = [w * 0.52, h * 0.036, w * 0.05] if axis == 0 else [w * 0.05, h * 0.036, w * 0.52]
            parts.append(_box(size, t, [58, 52, 44, 255]))
    parapet_y = h * 0.757
    parts.append(_box([w * 1.10, h * 0.016, w * 1.10], [0, parapet_y, 0], SANDSTONE_DARK))

    # Corner pinnacles flanking the spire.
    for sx in (-1, 1):
        for sz in (-1, 1):
            px, pz = sx * w * 0.50, sz * w * 0.50
            parts.append(_box([w * 0.17, h * 0.045, w * 0.17], [px, parapet_y + h * 0.030, pz], SANDSTONE))
            parts.append(_pyramid(w * 0.19, h * 0.055, [px, parapet_y + h * 0.052, pz], COPPER_DARK, sides=8))

    # Steep copper spire (a short flared skirt, then the tall octagonal cone) and the flagpole.
    spire_base = parapet_y + h * 0.008
    parts.append(_pyramid(w * 1.06, h * 0.045, [0, spire_base, 0], COPPER_DARK, sides=8))
    parts.append(_pyramid(w * 0.94, h * 0.205, [0, spire_base + h * 0.028, 0], COPPER, sides=8))
    parts.append(_cylinder(w * 0.022, h * 0.030, [0, spire_base + h * 0.248, 0], COPPER_DARK, sections=8, axis='y'))

    mesh = trimesh.util.concatenate(parts)
    mesh.merge_vertices()
    lo, hi = mesh.bounds
    mesh.apply_translation([-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2])
    mesh.apply_scale(height / (hi[1] - lo[1]))
    return mesh


BUILDERS = {'peace-tower': peace_tower}


def build(key: str, prompt: dict, out_path: Path) -> dict:
    """Build `key` parametrically and write a vertex-coloured GLB (postprocess.py bakes it to a texture)."""
    mesh = BUILDERS[key](float(prompt['targetHeightMeters']))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    scene = trimesh.Scene()
    scene.add_geometry(mesh, node_name=key, geom_name=key)
    scene.export(out_path, file_type='glb')
    b = mesh.bounds
    return {'faces': int(len(mesh.faces)), 'vertices': int(len(mesh.vertices)), 'bytes': out_path.stat().st_size,
            'size': [round(float(x), 3) for x in (b[1] - b[0])], 'source': 'parametric'}


if __name__ == '__main__':
    key, prompt_file, out = sys.argv[1:4]
    print(build(key, json.loads(Path(prompt_file).read_text()), Path(out)))
