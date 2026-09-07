# ADR-0007: Real assets, fidelity target and mobile presets

- Status: Accepted (2026-09-07)

## Context
Slice 1 shipped with procedural placeholder geometry (capsule humans, box buildings, cone trees). The product owner's bar is realism: proper humans and buildings. Constraints: static hosting, CC0/CC-BY only, automated `make assets`, phones must stay playable.

## Decision
1. **Environment = photoscans.** Poly Haven (CC0) supplies trees (fir, pine, broadleaf), rocks, grass/fern clumps, street props and modular facades as glTF, plus 1k PBR texture sets (grass, forest floor, rock, snow, cobblestone, sandstone, brick, plaster, concrete, roofs, wood, metal). Scans are decimated in the pipeline (meshoptimizer) to ≤ 15k triangles for LOD0 and ~20 % of that for LOD1, textures resized to 1k and compressed to KTX2 (UASTC normals, ETC1S colour/ARM), geometry Draco-compressed. Each GLB carries `LOD0`/`LOD1` nodes; the renderer instances them per chunk.
2. **Humans = rigged, animated base characters.** Quaternius *Universal Base Characters* and *Universal Animation Library* (both CC0, same 65-joint skeleton) provide male/female bodies with hair meshes and 43 clips; we ship Idle/Talk/Walk/Jog/Sprint/Jump/Interact/Sitting. The free pack has no clothing meshes, so **outfits are shaded procedurally** from bone weights (torso/arms → top, pelvis/legs → bottom, feet → shoes) with fabric roughness; skin tone tints the light/dark base textures; accessories are meshes parented to the Head/spine bones. Photorealistic scanned humans with permissive licences and scriptable downloads do not exist; if the owner licenses such characters later, they drop into `assets/src` and the same `SkinnedCharacterView` renders them (glTF skin + clips named as in the manifest).
3. **Architecture = PBR-textured procedural kits + facade models.** Landmarks (Parliament, stations, courthouses…) are built from parametric facades with recessed windows, cornices, copper roofs, dormers, turrets and the Peace Tower, textured with the Poly Haven sets in world space; Poly Haven modular facades and props dress districts.
4. **Terrain = PBR splat** (grass / forest floor / rock by slope / snow / cobblestone plaza) with world-space tiling and normal + ARM maps.
5. **Graceful degradation.** `AssetLibrary` reads `assets/dist/manifest.json`; every builder falls back to the slice-1 procedural geometry when a model or texture is missing, so a checkout without `make assets` still runs and tests stay deterministic.
6. **Presets.** A `minimal` preset (no post-processing, no shadows, pixel ratio ≤ 1.25, ≤ 350 instances, no weather particles) is the default on phones/tablets and in CI's software-GL runner; the boot benchmark can step phones up to `low` only. Desktop defaults to `medium` and benchmarks upward.
7. **Input.** Keyboard/mouse, gamepad (movement, actions, and menu navigation via `GamepadUiNavigator`) and touch (virtual joystick, drag-to-look, on-screen interact) are all supported; UI has coarse-pointer and small-screen styles.

## Consequences
- `assets/dist` grows from ≈2 MB to tens of MB (committed; still far below the 1 GB soft limit; monitored by `make deploy-check`). Districts lazy-load their own models.
- Photoscanned trees are heavier per instance than cones; instance budgets per preset were re-tuned and LOD1 is used beyond 70 m.
- The itch.io free-download handshake (`scripts/lib/itch.mjs`) depends on itch's page markup; if it breaks, cached zips in `node_modules/.cache` or a manual drop into `assets/src` keep the pipeline working.
