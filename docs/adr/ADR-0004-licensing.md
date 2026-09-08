# ADR-0004: Licensing and third-party assets

- Status: Accepted (2026-09-08)

## Context
The project is open source and teaches public information. Anyone should be able to fork it, translate it,
or ship it locally without asking permission — including the art and the question bank.

## Decision
- **Code**: MIT (`LICENSE`).
- **Original art**: CC BY 4.0 (`LICENSE-ASSETS`), attributed to "TrueNorth contributors".
- **Question data**: CC0. Facts are paraphrased from *Discover Canada*; the project is not affiliated with or
  endorsed by the Government of Canada, and says so.
- **Third-party assets**: CC0 or CC BY only. No NC, no ND, nothing that restricts redistribution. Every asset
  is listed in `assets/credits.json` with author, licence and source URL; `make validate-content` fails on any
  file in `assets/dist/` without a credit.
- **Dependencies**: no dependency whose licence restricts open-source redistribution. This explicitly excludes
  the Spine runtimes, which is why characters use Rive (Apache-2.0).
- Reference photographs in `assets/refs/` are drawing references and verification inputs; they are not
  redistributed in the built game.

## Alternatives considered
- **CC BY-SA for art** — rejected: viral terms complicate reuse in classroom and settlement-agency materials.
- **Spine for characters** — better tooling, incompatible licence. Rejected.

## Consequences
- Every asset needs provenance before it can ship; the credits file is a build gate, not a courtesy.
- Contributors must own or properly license what they submit, stated in `CONTRIBUTING.md`.
