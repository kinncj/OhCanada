# ADR-0006: Repository name and Pages base path

- Status: Accepted (2026-09-07)

## Context
The build prompt names the product `truenorth-app` and assumes a Pages base of `/truenorth-app/`. The owner had already created and cloned an empty GitHub repository named `kinncj/OhCanada`, and the working directory carries that name.

## Decision
- Deploy to the existing repository `kinncj/OhCanada`; the npm package and product remain `truenorth-app` / TrueNorth.
- `basePath` in `content/game.config.json` is `/OhCanada/`; `infra/pages.config.json` records the repository, and `make deploy-check` asserts that the base path matches the repository name (or `/` when a custom domain is configured).
- Renaming the repository later only requires changing `basePath` and `pages.config.json`.

## Consequences
- Public URL: <https://kinncj.github.io/OhCanada/>.
- Asset sizes: no Git LFS. Compressed assets are committed under `assets/dist` (currently ≈ 2 MB). If the repository approaches 1 GB, serve `assets/dist` from a GitHub Release (new ADR required).
