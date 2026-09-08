# ADR-0004: Licensing and third-party assets

- Status: Accepted (2026-09-08)
- Amended 2026-09-08: "CC0 or CC BY only" was read literally by `credits.schema.json` and came out wrong in
  both directions at once — the enum accepted `CC-BY-SA-4.0`, which this ADR forbids, and had no value for
  public domain, CC BY 2.0 or CC BY 3.0, which it permits. A schema admitting a forbidden licence is worse
  than no check, because it will be read as permission. The rule is now stated by its *test* rather than by
  a list, the enum matches it, and the two-line note about which licences a *code-shaped* asset may carry —
  already true of the enum, never written down here — is written down. Also states where style assets live,
  which nothing did.

## Context
The project is open source and teaches public information. Anyone should be able to fork it, translate it,
or ship it locally without asking permission — including the art and the question bank.

## Decision
- **Code**: MIT (`LICENSE`).
- **Original art**: CC BY 4.0 (`LICENSE-ASSETS`), attributed to "TrueNorth contributors".
- **Question data**: CC0. Facts are paraphrased from *Discover Canada*; the project is not affiliated with or
  endorsed by the Government of Canada, and says so.
- **Third-party assets**: any licence that permits redistribution and modification **with no copyleft,
  non-commercial or no-derivatives condition**. That test, not a list, is the rule; the list below is what it
  currently admits and is what `credits.schema.json` enumerates.
  - Permitted: public domain, `CC0-1.0`, and `CC-BY` at any version (1.0, 2.0, 2.5, 3.0, 4.0).
  - Also permitted, for assets that are code-shaped rather than picture-shaped — fonts, runtimes, shader
    snippets: `MIT` and `Apache-2.0`. These were always in the enum and never in this ADR; the omission is
    what let the enum drift unnoticed in the other direction too.
  - Forbidden: NC and ND of every version, and **ShareAlike of every version**, including `CC-BY-SA-4.0`,
    which the enum wrongly accepted. Share-alike is excluded for the same reason the alternative below gives
    for not using it on our own art: viral terms complicate reuse in classroom and settlement-agency
    materials, and a forked repository should not inherit an obligation it did not choose.
  - `public-domain` is not an SPDX identifier, because SPDX has none for a work whose term has expired or
    that was never eligible for copyright. It is spelled that way deliberately and the `source` URL must
    evidence the status.
  - Every asset is listed in `assets/credits.json` with author, licence and source URL;
    `make validate-content` fails on any file in `assets/dist/` without a credit.
- **Style assets live under `assets/`, not under `content/`.** `assets/style/palette.json`,
  `assets/style/art-bible.md` and `assets/refs/references.json` are inputs to `make assets` and
  `make verify-art`; nothing under `app/` reads them at runtime. The line is what the artefact is *for*:
  `content/` is what the game loads, `assets/` is what the pipeline reads — which is already why
  `assets/credits.json` sits where it does while `content/schemas/credits.schema.json` describes it. The
  palette follows the same split: `content/schemas/palette.schema.json` is its authority, the file stays
  where it is, and `content/style/` is not a home waiting to be filled. `CLAUDE.md` says nothing to the
  contrary — it names a palette only as an art property — so no agreement needs amending for this.
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
- The enum defect had a measurable cost, recorded here so the next narrow enum is written more carefully.
  Six references were identified for slice 1, their licences established from the Wikimedia Commons API
  before anything was fetched, and then deliberately not downloaded because no value in the enum could
  express them (`assets/refs/README.md` lists them by name). Three are now expressible and can be fetched:
  a public-domain photograph of an officer in front of the Peace Tower in one portrait frame — the exact
  composition slice 1 needs — a CC BY 3.0 comparison of ceremonial and working uniform, and a CC BY 2.0
  daylight clock face. Three stay excluded, all ShareAlike, and that exclusion is now a decision this ADR
  makes rather than an accident of a list: the schema no longer offers a value the ADR forbids.
- A reference photograph is credited in `assets/credits.json` with a `../refs/...` path, which escapes the
  directory the credit gate walks. That is one file doing two jobs — a register of what ships and a register
  of what was looked at — and it is why nothing checks the fourteen reference credits today.
  `credits.schema.json` gains an optional `kind` (`shipped` / `reference`) so the two are at least
  distinguishable in the data; making it required, and pointing the gate at both, is the open obligation in
  ADR-0006's preconditions.
