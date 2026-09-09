# Reference photographs

Drawing references and `make verify-art` inputs. **Not shipped in the built game** (ADR-0004).

Read `references.json` beside this file for the machine-readable list: for each subject, the reference
files, the features that must be right, what to simplify away, and what must never be added. That file is
what `verify-art` judges a render against. This file explains the licence rules and records what happened to each of the six references that were
once identified and parked: three are now in, three are permanently out.

## Licence rule, and why it is narrower than you expect

ADR-0004 permits third-party assets under **CC0 or CC BY only** — no NC, no ND, and no ShareAlike (the ADR
rejects CC BY-SA for art because viral terms complicate reuse in classroom and settlement-agency materials).

`content/schemas/credits.schema.json` used to narrow this further. Its `licence` enum accepted only
`CC0-1.0`, `CC-BY-4.0`, `CC-BY-SA-4.0`, `MIT`, `Apache-2.0` — no value for public domain or for CC BY 2.0 and
3.0, and it *did* accept `CC-BY-SA-4.0`, which ADR-0004 forbids. Six good references were identified,
licence-checked and deliberately left undownloaded because of that gap (**OQ-ART-06**).

**On 2026-09-08 the architect reconciled the enum with ADR-0004 in both directions:** `public-domain`,
`CC-BY-1.0`, `CC-BY-2.0`, `CC-BY-2.5` and `CC-BY-3.0` added; `CC-BY-SA-4.0` removed. The intersection is now

    ADR-0004 (CC0 or CC BY, no SA)  ∩  credits.schema.json enum
      =  { public-domain, CC0-1.0, CC-BY-1.0, CC-BY-2.0, CC-BY-2.5, CC-BY-3.0, CC-BY-4.0 }

which is the ADR itself, with nothing lost in translation.

**Three of the six parked references are now here. Three are not, and that is now a decision rather than an
accident of a list.** The three that stayed out are ShareAlike — CC BY-SA 3.0 or 4.0 — and ADR-0004 rejects
ShareAlike for art because viral terms complicate reuse in classroom and settlement-agency material. The enum
no longer accepts them either, so the schema and the ADR now say the same thing and neither can be satisfied
by mistake. They are not "pending a schema fix"; the schema is fixed and they are still out.

Licences were established from the Wikimedia Commons API (`prop=imageinfo&iiprop=extmetadata`) before
anything was fetched, not read off a web page afterwards. Canada has freedom of panorama for architecture
(Copyright Act s.32.2(1)(b)), so photographs of Canadian buildings carry only the photographer's copyright.

## The six that were parked: three in, three permanently out

Recorded in full, including the three that landed, so the next artist can see which way each one went and
why. Licences were re-checked against the Wikimedia Commons API on 2026-09-08 before the three were fetched.

| Subject | Commons file | Licence | Status |
|---|---|---|---|
| Officer in scarlet review order, full length, on Parliament Hill with the Peace Tower directly behind, portrait crop, c. 1950s | `File:A member of the RCMP poses in front of the Parliament Buildings for snapshooting tourists. Ottawa, Ontario, Canada.jpg` (Chris Lund, National Film Board / Library and Archives Canada) | Public domain, copyright expired | **IN**, as `officer/officer-and-peace-tower-portrait.jpg`. The exact composition slice 1 needs — officer and landmark in one portrait frame — and it doubles as the Centre Block massing reference, green copper wing roofs intact. Being pre-1965 the mast flies the **Canadian Red Ensign**, not the Maple Leaf; the level draws the National Flag of Canada. It shows an identifiable person: rule 4 below applies without exception. |
| Mounted member in scarlet, with the modern working uniform beside him | `File:Mountie@parliamentOttawa.jpg` (Mykola Swarnyk) | CC BY 3.0 | **IN**, as `officer/red-serge-and-working-uniform.jpg`. Ceremonial and working order side by side; the visual half of `OQ-LEVEL-2`. |
| Peace Tower clock face, daylight, sharp | `File:Peace Tower Clock (1).jpg` (John Talbot) | CC BY 2.0 | **IN**, as `ottawa/peace-tower-clock-daylight.jpg`. The dial in daylight. The one already here is a night exposure with a purple cast, good for layout and useless for colour. |
| Peace Tower full elevation, sunlit, high resolution | `File:Close up of The Peace Tower 22.jpg` | CC BY-SA 4.0 | **OUT, permanently.** ADR-0004 forbids ShareAlike and the enum no longer accepts it. Best available belfry and spire detail, and we do without it. |
| Centre Block front elevation, pre-rehabilitation, green copper wing roofs intact | `File:Centre Block, Ottawa, Southeast view 20170422 1.jpg` | CC BY-SA 4.0 | **OUT, permanently.** Would have settled `OQ-ART-05` directly. The public-domain photograph above covers most of what it was wanted for. |
| Rideau Canal Skateway with Parliament Hill behind, wide | `File:Winterlude Rideau Canal.JPG` | CC BY-SA 3.0 | **OUT, permanently.** The level's establishing shot. `rideau-canal-skateway-portrait.jpg` and `rideau-canal-skateway-ice.jpg` between them carry the composition. |

## Directories

- `ottawa/` — the slice-1 Level 4 subjects: the Peace Tower and Centre Block, Parliament Hill as a skyline,
  and the Rideau Canal Skateway.
- `quebec-city/` — the slice-2 Level 3 subjects: the Château Frontenac (four views), the Dufferin Terrace and
  its toboggan run (two historical photographs and one modern), and the river, the far bank and the ramparts
  in winter. Ten files, licence-checked against the Commons API on **2026-09-08** before any was downloaded:
  seven CC0, one public domain (copyright expired, BAnQ), one CC BY 2.0 (Library and Archives Canada) and one
  CC BY 3.0. Three better photographs — the ice slide in use, the terrace kiosks in winter, the Château after
  freezing rain — are CC BY-SA and were rejected on licence, not on quality, exactly as three were for Ottawa.

  **Two of the ten are colour traps and are labelled as such in `references.json`.**
  `chateau-frontenac-tower-2024.jpg` carries no ICC profile and its white balance is markedly cool: a
  hue-filtered median over its entire façade returns *zero* brick-hued pixels. `chateau-frontenac-dusk.jpg` is
  a dusk exposure with the building floodlit and coloured architectural lighting on the tower. Both are
  geometry references only. Every file in this directory was **converted from its embedded profile to sRGB
  before any colour was sampled off it**, so the colours measured are the colours a browser shows — a step
  that was skipped on the first pass and produced brick that sampled as blue-grey.
- `halifax/` — the Level 1 subjects: the Old Town Clock (three views), Pier 21 (three views) and the
  waterfront boardwalk and harbour (three views). Nine files, licence-checked against the Commons API on
  **2026-09-08** before any was downloaded: two CC0, four public domain, two CC BY 2.0, one CC BY 3.0 and one
  CC BY 4.0.

  **Two of the nine are colour traps and are labelled as such in `references.json`.**
  `town-clock-close-elevation.jpg` is a warm dusk exposure — the grass reads brown — and is a geometry
  reference only; `waterfront-boardwalk.jpg` is heavily processed, dark and high contrast under a storm sky,
  and is a composition reference only. Every file was **converted from its embedded profile to sRGB before
  any colour was sampled off it**, which is how the Town Clock's dial measured as a saturated blue rather
  than as slate.

  **The Town Clock cost real quality to the ShareAlike rule, for the third level running.** The
  high-resolution near-orthographic elevations of it on Commons are CC BY-SA 3.0 and 4.0, and ADR-0004
  forbids ShareAlike for art. One CC BY 4.0 photograph was available and it carried the whole measurement.
  Every photograph of the Citadel is ShareAlike too, which is part of why the level's hill is landform and
  carries no fort.

- `toronto/` — the Level 5 subjects: the CN Tower (three views), the skyline under overcast, the waterfront
  cycling trail and a separated bike lane. Six files, licence-checked on **2026-09-08** before download:
  four CC0 and two CC BY 2.0/3.0.

  `bike-lane-street.jpg` is CC BY 2.0 from the Government of Ontario and its licence page **specifies the
  wording of the credit**: "Copyright Queen's Printer for Ontario, photo source: Ontario Growth Secretariat,
  Ministry of Municipal Affairs and Housing". That wording is carried in the `author` field of its entry in
  `assets/credits.json`, because `credits.schema.json` is `additionalProperties: false` and has no other
  field it could go in. Rule 5 below has the same shape of problem and the same answer.

- `beaver/` — the guide: the beaver companion who appears at points of interest. Six files, licence-checked
  against the Commons API on **2026-09-08** before any was downloaded: three public domain, one CC0, one
  CC BY 2.0 and one CC BY 2.5. The design sheet is `assets/style/guide.md`.

  **Two of the six are colour traps and are labelled as such in `references.json`.**
  `beaver-upright-winter-gnawing.jpg` is a dusk exposure of a wet animal — its fur medians at L 18, S 6 —
  and is the **pose** reference only, which is what it is here for: a beaver sitting up on its hind legs in
  snow with a stick in its forepaws is the stance the cartoon is a simplification of.
  `beaver-head-and-forepaws.jpg` is backlit through grass with a cool cast and is a **geometry** reference
  for the ear, the muzzle and the forepaw. The pelt colour was measured across three references and
  corrected for the fact that every one of them shows wet fur; the working is in `guide.md` §4.

  **Every photograph of this animal is of a wild animal and none of them shows a person**, so rule 4 below
  has nothing to bite on here — which is worth saying, because it is the first subject in this directory for
  which that is true and a reader should not conclude the rule was forgotten.

- `officer/` — the slice-1 NPC: the scarlet review-order uniform, the wide-brimmed felt hat and Sam Browne
  belt hardware. The design sheet is `assets/style/officer.md`, which also records the marks that must
  **never** be drawn and why. The uniform silhouette is drawn; the insignia are not.

## Rules

1. **Never trace.** A reference is looked at, measured and simplified. It is never posterised, filtered,
   auto-traced or dropped into the art as a layer. The output is original work under CC BY 4.0.
2. **Never invent.** If a feature is not in the reference and not in `mustBeRight`, it does not go in.
   Adding a spire is worse than omitting a window.
3. **Credit everything.** Every file here appears in `assets/credits.json` with author, licence and source
   URL, `path` relative to `assets/` (so `refs/ottawa/peace-tower-elevation.jpg`), and `kind: "reference"`.
   `make validate-content` enforces this: it walks all of `assets/` and asserts set equality in both
   directions, so a file with no entry fails and an entry with no file fails too. It is a **denylist** — an
   unrecognised file type defaults to "must be credited", so the first `.riv`, `.woff2` or `.ogg` cannot slip
   through uncredited. Adding a reference without crediting it now turns the build red rather than passing
   quietly (OQ-ART-02, closed 2026-09-08).
4. **Do not depict a real, identifiable person.** Characters are fictional. A reference photograph of a
   person is a reference for clothing, posture and proportion, never a portrait to reproduce.
5. **Record the date you checked a licence.** Commons licences can be corrected and files can be deleted,
   so a credit without a date is a claim with no shelf life. Every licence in this set was checked on
   **2026-09-08**, and the three added after the enum widened were checked again the same day. That date
   is recorded here and in `references.json` rather than per asset, because `credits.schema.json` is
   `additionalProperties: false` and still has no field for it. That is the part of **OQ-ART-06** that is
   still open; the licence-value gap is closed.
