# TrueNorth (`truenorth-app`)

A browser-based, open-world 3D game that teaches the content of the Canadian citizenship test (*Discover Canada*) through exploration and quests. Explore a stylized Canada, talk to NPCs, earn Passport Stamps, unlock districts, and pass the Citizenship Ceremony mock exam (20 questions, 15 to pass, 30 minutes).

**Play:** https://kinncj.github.io/OhCanada/

## Stack
TypeScript · Vite · Three.js (WebGPU with WebGL2 fallback, TSL post-processing) · Rapier · three-mesh-bvh · yuka · howler · i18next (EN/FR) · JSON Schema + Ajv · Vitest · Playwright · GitHub Actions → GitHub Pages.

## Develop
```
make setup
make assets
npm run dev      # http://localhost:5173/OhCanada/
make lint typecheck test test-e2e test-perf validate-content build deploy-check
```

## Repository map
- `app/domain`, `app/application` — pure game logic and use cases (≥ 90 % coverage gate)
- `app/adapters` — rendering, physics, AI, input, persistence, content, i18n, audio
- `app/ui` — DOM screens · `app/bootstrap` — composition root
- `content/` — all facts, quests, districts, locales (schema-validated)
- `assets/` — CC0/CC-BY sources, compressed output, `credits.json`
- `infra/` — workflows and Pages config · `tests/` — unit, integration, e2e, perf
- `docs/` — ADRs, architecture (Mermaid), stories (Gherkin), runbook, content review

## Content licence note
Questions are original paraphrases of *Discover Canada*. Assets are CC0/CC-BY and listed in `assets/credits.json`.
