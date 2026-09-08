# Reference photographs

Drawing references and `make verify-art` inputs. **Not shipped in the built game** (ADR-0004).

Read `references.json` beside this file for the machine-readable list: for each subject, the reference
files, the features that must be right, what to simplify away, and what must never be added. That file is
what `verify-art` judges a render against. This file explains the licence rules and records the references
that were identified but **not** downloaded.

## Licence rule, and why it is narrower than you expect

ADR-0004 permits third-party assets under **CC0 or CC BY only** — no NC, no ND, and no ShareAlike (the ADR
rejects CC BY-SA for art because viral terms complicate reuse in classroom and settlement-agency materials).

`content/schemas/credits.schema.json` narrows this further: its `licence` enum accepts only
`CC0-1.0`, `CC-BY-4.0`, `CC-BY-SA-4.0`, `MIT`, `Apache-2.0`. It has **no value for CC BY 2.0, CC BY 3.0, or
public domain**, and it *does* accept `CC-BY-SA-4.0`, which ADR-0004 forbids.

So the set of licences a reference can actually carry today is the intersection:

    ADR-0004 (CC0 or CC BY)  ∩  credits.schema.json enum  =  { CC0-1.0, CC-BY-4.0 }

Every file in this directory is CC0-1.0 or CC-BY-4.0. Nothing else was downloaded. See **OQ-ART-06**.

Licences were established from the Wikimedia Commons API (`prop=imageinfo&iiprop=extmetadata`) before
anything was fetched, not read off a web page afterwards. Canada has freedom of panorama for architecture
(Copyright Act s.32.2(1)(b)), so photographs of Canadian buildings carry only the photographer's copyright.

## Identified, licence established, deliberately NOT downloaded

These are better references than some of what is here. They are recorded in words so the work is not lost
and so the enum gap has a concrete cost attached to it. **Do not add them until OQ-ART-06 is answered.**

| Subject | Commons file | Licence | Why it was wanted | Why it is not here |
|---|---|---|---|---|
| Officer in scarlet review order, full length, standing on Parliament Hill with the Peace Tower directly behind, portrait crop, c. 1950s | `File:A member of the RCMP poses in front of the Parliament Buildings for snapshooting tourists. Ottawa, Ontario, Canada.jpg` (Chris Lund) | Public domain | The exact composition slice 1 needs: officer and landmark in one portrait frame | `credits.schema.json` has no public-domain value. Note the tower flies the **Canadian Red Ensign**, not the Maple Leaf: pre-1965 |
| Mounted member in scarlet, with the modern working uniform beside him for contrast | `File:Mountie@parliamentOttawa.jpg` (Mykola Swarnyk) | CC BY 3.0 | Shows working uniform and ceremonial order side by side | Enum has no `CC-BY-3.0` |
| Peace Tower clock face, daylight, sharp | `File:Peace Tower Clock (1).jpg` (John Talbot) | CC BY 2.0 | The clock in daylight; the one here is a night exposure with a colour cast | Enum has no `CC-BY-2.0` |
| Peace Tower full elevation, sunlit, high resolution | `File:Close up of The Peace Tower 22.jpg` | CC BY-SA 4.0 | Best available detail on the belfry and spire | ADR-0004 forbids ShareAlike, even though the schema enum would accept it |
| Centre Block front elevation, pre-rehabilitation, green copper wing roofs intact | `File:Centre Block, Ottawa, Southeast view 20170422 1.jpg` | CC BY-SA 4.0 | Would settle OQ-ART-05 directly | ADR-0004 forbids ShareAlike |
| Rideau Canal Skateway with Parliament Hill behind, wide | `File:Winterlude Rideau Canal.JPG` | CC BY-SA 3.0 | The level's establishing shot | ADR-0004 forbids ShareAlike |

## Directories

- `ottawa/` — the slice-1 Level 4 subjects: the Peace Tower and Centre Block, Parliament Hill as a skyline,
  and the Rideau Canal Skateway.
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
   **2026-09-08**. That date is recorded here and in `references.json` rather than per asset, because
   `credits.schema.json` is `additionalProperties: false` and has no field for it — part of OQ-ART-06.
