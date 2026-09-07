# ADR-0009: Generated hero assets (text-to-3D) and the asset ledger

- Status: Accepted (2026-09-07)

## Context
ADR-0007 replaced placeholder geometry with CC0 photoscans (Poly Haven) and rigged humans (Quaternius). Those libraries have no Canadian landmarks: there is no CC0 Peace Tower, Château Laurier, CN Tower, Peggy's Cove lighthouse, grain elevator, inukshuk or Canadian fauna. The product requires recognisably Canadian places, so the remaining hero assets have to be authored.

## Decision
1. **Generate them locally with text-to-3D.** `scripts/gen3d/` drives a local diffusion → mesh pipeline on this machine's Radeon (ROCm): image conditioning with SDXL-Turbo, shape synthesis with Hunyuan3D-2mini, falling back to Shap-E or parametric geometry when a stack cannot be built. Prompts, seeds, target height and poly budget are versioned per asset in `assets/prompts/<key>.json`, so any asset can be regenerated deterministically.
2. **Post-process like any other asset.** `scripts/lib/hero.mjs` recentres, orients +Y up, scales to `targetHeightMeters`, removes floaters, decimates to the poly budget, builds `LOD0`/`LOD1`, compresses textures (KTX2, WebP fallback) and geometry (Draco), and emits renderer-manifest entries — the same contract as scanned models.
3. **Ledger, not vibes.** `assets/manifest.json` lists every hero and third-party asset with `source`, `generator`, `license`, `polyBudget` and measured `triangles`. `make validate-content` fails when a model in the renderer manifest is missing from the ledger, lacks a source/licence, or busts its budget — and it already fails when a file in `assets/dist` has no entry in `assets/credits.json`. Generated assets are dedicated CC0-1.0.
4. **Content references keys, not files.** `pois[].landmark` names a manifest key (`peace-tower`) or a procedural builder (`parliament`). `WorldScene` prefers the hero model and falls back to the procedural builder, so districts stay playable while the generated set is being filled in.

## Consequences
- Landmarks are reproducible and auditable: prompt + seed + budget in git, mesh in `assets/src/hero`, compressed output in `assets/dist/models/hero`.
- Generation is slow (minutes per asset) and stays a developer-machine step; CI only consumes the committed results.
- Quality varies by prompt. Anything that reads as generic is a prompt fix, not a code change.
- Indigenous items (inukshuk, totem pole) carry `culturalReview: true` in content and are listed in `docs/content-review.md`; they are respectful markers, never caricature.
