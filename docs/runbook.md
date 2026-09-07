# Runbook

## Local
```
make setup            # npm ci + Playwright chromium
make assets           # fetch CC0 sources, generate audio, compress glTF (idempotent)
make validate-content # schemas, cross-refs, volatile freshness, credits
make lint typecheck test
make build            # vite build + sw.js + 404.html
make test-e2e         # Playwright smoke against the build (software GL)
make test-perf        # payload budgets + frame loop
make deploy-check     # Pages preconditions + workflow sync
npm run dev           # http://localhost:5173/OhCanada/  (?debug=1 overlay, ?e2e=1 hooks, ?preset=low|medium|high|ultra, ?webgl=1)
```

## Deploy
Push to `main` → `.github/workflows/deploy-pages.yml` runs `make validate-content assets build deploy-check` and publishes `dist/` to <https://kinncj.github.io/OhCanada/>. Concurrency group `pages`, cancel-in-progress.

## Rollback
1. Open Actions → "Deploy to GitHub Pages".
2. Pick the last green run for the commit you want restored → "Re-run all jobs". Pages serves whatever the latest successful deployment uploaded, so re-running an older run restores that build.
3. Alternatively `git revert <sha>` on `main` and push.

Tested 2026-09-07 (see the workflow history for the re-run).

## Asset regeneration
- Add remote sources to `assets/src/manifest.json` (CC0/CC-BY only, with `source` URL and `author`). `make assets` fetches them once and records them in `assets/credits.json`. `make validate-content` fails if any file in `assets/dist` is not credited.
- glTF sources dropped in `assets/src/**.glb` are compressed to `assets/dist/models/`. `toktx` (KTX-Software) must be on PATH for KTX2; without it textures fall back to WebP and a warning is printed. CI installs KTX-Software.
- To force regeneration, delete the output file and re-run.

## Performance verification (reference configs)
Headless CI uses SwiftShader, so frame-rate numbers there are informational. Before a release, run on:
- 1080p, RTX 3060-class: `?debug=1&preset=high` → ≥ 60 fps in the hub.
- Apple M1 / Intel Iris Xe: `?debug=1&preset=medium` → ≥ 30 fps.
Record results in the release notes. Set `PERF_MIN_FPS=<n>` to make `make test-perf` enforce a floor on a GPU-enabled runner.

## Volatile facts
`make validate-content` fails when a `volatile: true` question is older than 180 days. Re-verify the fact, update `text`/`answer` if needed and bump `asOf`. The list of volatile ids is in `docs/content-review.md`.
