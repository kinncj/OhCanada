# Kingston — the gate, re-measured, and the delivery plan (slice L8)

**Goal.** Land Kingston (`building-canada`, journey slot 5) as ADR-0068 and ADR-0069 decided it, in an order
every gate can follow. The story is `docs/stories/TN-LEVEL-kingston.md`. (ADR-0068's header says "Slice: L6".
The Kingston row in `docs/plan/slices.md` is **L8**. L6 is the coverage audit that proposed it.)

**Measured 2026-09-24 on `bf54f66`** (`origin/main`, with Québec City's three tier 2 stops merged), branch
`kingston-gate`. Commands: `make assets` (texture and payload), `make build` (the deploy-check line),
`npx depcruise app common --config .dependency-cruiser.cjs` (no violations, 198 modules). Read places and
stops are counted from `content/levels/*.json`, `content/quests/*.json` and `content/lessons/canadas-history/`.

## 1. ADR-0068 §7: is Québec City out of room under tier 2?

**Verdict: yes. ADR-0065 §1's room test is met, by stops, and tier 3 is open for Kingston.** The three ranked
stops landed. The audit ranked no fourth stop at Québec City. A fourth stop fails two of §2.4's three tests,
and read places are nowhere near enough for the passages. Texture is not the reason, and this entry does not
claim it is (ADR-0065 §2.3).

| Test | Audit (`7441451`) | Now (`bf54f66`) | Reading |
|---|---|---|---|
| **Texture**, charged vs declared `textureBudgetBytes` (40.00 MiB) | 6.61 MiB spare | **38.30 MiB charged, 1,784,112 B = 1.70 MiB spare (96%)** | Below one prop "to be safe" (2.03 MB). It would hold one prop the size of `hotel-du-parlement` (1,497,600 B). The audit's 6.61 predates charging the 1.72 MiB character surface, so the gate measured 4.89 before the three. The three stops cost 3,347,200 B (3.19 MiB). |
| Texture vs the **64 MiB** per-level cap | — | **25.70 MiB** below the cap | The declared budget may be raised up to the cap (ADR-0013; the schema refuses more). So texture could be bought. It is not the binding test. The art sheet's 0.55 MiB of packed, unreferenced markers and snow particle can also be reclaimed. |
| **Pitch and width** (§2.4.2) | 6,048 → 10,848 flagged as a play judgement | **10,848 px**, the longest level: +1,248 over Ottawa and the Prairies (9,600), +3,168 over the median (7,680). 25.8 s of held thumb at 420 px/s | A fourth stop makes **12,448 px** (29.6 s), 30% longer than any other level. **Recorded here as the play judgement, and refused.** |
| **The sitting** (§2.4.3) | 13 questions | 3 `answer` steps × 5 = **15 questions**, 13 quest steps, 6 stops (the guide at 1,250 beside the Château at 1,540 is one stop) | The answer ceiling (6) is not binding. A read-only stop adds no question. Not the reason. |
| **Read places** (§3.3: 4 per stop) | 16 places for ~110 passages | **24 places, 22 used**, for **208** verified `canadas-history` passages. No other level reads a history lesson now. The audit assumed Winnipeg would take `history-05` and Alberta `history-03`, and neither does | **184 passages cannot be met at Québec City in play.** Placing them would take 46 more stops. Even after the split, Québec City's own half (lessons 01, 02, 09, 10, 11, 12) holds **60 passages for 24 places**. |
| **Candidates left** | 3 ranked for Québec City | 3 of 3 taken | The guide's next Québec City landmark sentence is the Citadelle, and it is `hist-97`, p. 30. That is on `building-canada`'s side of ADR-0068 §2's line. A fourth stop teaching Québec City's own subject would have to be a landmark the guide does not name (ADR-0056 §6, "acceptable" only). |

ADR-0068 §7 foresaw this: "The room test will not stay passed for long." It has now failed on width and on
reading, and those are the tests §2.4 calls the constraint. **Kingston's level document may land**, once
the steps below are done.

**The content obligation this answers.** ADR-0068's `owner=content` marker is due 2026-11-23: take the three
stops, and "the entry names ADR-0065 §1's room test as met or as ended". The stops were taken by content,
and this is the entry. The marker is content's to strike, citing this section (step K-0.2).

## 2. What a new level does to the budgets

| Budget | Now | Kingston's effect | Status |
|---|---|---|---|
| Per-level payload ≤ 8 MiB | 0.58–0.89 MiB (Québec City 0.67) | About 0.95–1.2 MiB (744,148 B of shared atlas plus 126–450 kB of its own art, which is the range of the ten levels) | Ample |
| Initial payload (`deploy-check`, static graph + fonts) | **2,608.7 kB raw** / 867.9 kB gzip of 8.0 MiB; fonts 258.4 of 300 kB | A lazy level chunk is not initial | Ample |
| **Service worker: precache + every level's art, cached in the background** (`deploy-check`, ADR-0034 amended 2026-09-15, held to `budgets.initialPayloadBytes`) | **8,157.1 kB of 8,388.6 kB**: precache 4,946.4 kB + level art 3,210.7 kB. **Headroom 231,508 B (226 KiB)** | Kingston's own art: the ten levels range from 126,114 B (Halifax) to 449,674 B (the North), median 231,834 B. **The median alone is 326 B over.** Four landmarks and a full layer set put Kingston at or above the median, and its level, quest and locale bytes enter the precache too | **Blocker.** `make build` fails on Kingston as specified. See K-0.1 |
| Decoded texture ≤ 64 MiB per level | 27.1–41.8 MiB charged | Declare 36–40 MiB, as Toronto and Vancouver do (31–32 MiB charged at 4 stops, 7,680 px). Pin props to 1×, as Québec City's are | Fine |
| Total ≤ 100 MB | 23.6 MiB in `dist/` | +~1 MiB | Fine |
| Ceiling Σ⌊verified ÷ 30⌋ | 10 levels, ceiling 12 | 11 levels, 11 subjects, ceiling 12, headroom 1 (ADR-0068 §6) | Fine |

## 3. Delivery plan

Rules this order obeys:

- **ADR-0068 §4.** The author re-file commit, then a separate verifier commit. Both land in the PR that adds
  the level document, and not before it.
- **ADR-0069 §6.** Commit 1 (`insets[]`) is on `map-insets-array` with another owner. Nothing here touches it.
  Commits 2 and 3 follow it.
- **ADR-0074 §4.** Every stop stands before the end line.
- **ADR-0067 and ADR-0065 §3.3.** One engagement finishes `visit → read` at a stop, and a stop reads at most 4
  passages and 120 words.
- **ADR-0057 and ADR-0070.** Teach before asking, and the teach-back ratchet.
- **ADR-0003.** Author and verifier are different agents.
- **`docs/content-review.md`**, and **budgets**.

### Phase 0: groundwork. Separate PRs, each green on its own, none of them Kingston's

| # | Step | Owner | Files | Acceptance |
|---|---|---|---|---|
| K-0.1 | **ADR: what the background level cache is held to.** It is not waived. Choose one: (a) give background level art its own budget key; (b) background-cache only the next open journey level, and cache the rest on play (ADR-0034's "a level whole"); (c) an art diet that pays for Kingston out of the ten. `deploy-check` already names (b) and (c) | architect | `docs/adr/ADR-00NN-….md` (next free number after `git fetch` and `git ls-remote`); `docs/architecture.md` | Written before K-0.1b |
| K-0.1b | Implement K-0.1 | infra | `scripts/deploy-check.mjs`, the Workbox/`sw` config under `infra/` or the build, `content/game.config.json#/budgets` if (a), and tests under `tests/unit/infra/` | `make build` green with ≥ 500 kB of headroom for an eleventh level, or the ADR's own number |
| K-0.2 | Strike ADR-0068's 2026-11-23 content marker, citing §1 above | content-author | `docs/adr/ADR-0068-….md` (the marker only) | `make check-obligations` green |
| K-0.3 | **Count sweep.** Every screen and test that fixes "ten" reads it from `journey` or `unlockRules`. This removes a hidden two-owner commit: without it, K-2.2's config change breaks tests that content does not own | ui-a11y (screens and their tests); engine (bootstrap and its tests) | `app/ui/level-select.ts`, `passport.ts`, `exam-start.ts`, `exam-result.ts`; `tests/unit/ui/{passport,level-select,exam-start,hud}.test.ts`, `tests/a11y/{shell,readability,slice1-screens}.spec.ts`, `tests/e2e/{passport-and-quest,level-quest}.spec.ts`; `tests/unit/bootstrap/front-door.test.ts`, `tests/unit/contracts/unlock-chain-is-reachable.test.ts` | Green on ten, and green on a fixture journey of eleven. `JOURNEY_LENGTH` stays a floor |
| K-0.4 | Pin ADR-0068 §8's eleven-subject exam mix: 2 with p = 9/11 and 1 with p = 2/11 per subject, history's pair at 3.64 on average | domain | `tests/unit/application/use-cases/exam-session.test.ts` (no source change: `allocateQuotas` does not change) | Seeded test over 11 ready subjects |
| K-0.5 | ADR-0069 §6 **commit 2**: the corridor inset with Ottawa and Toronto, after `map-insets-array` merges. Publish Kingston's anchor coordinates in the art sheet. Do not add the anchor yet | art | `assets/src/svg/screens/map-canada.svg`, `assets/src/svg/screens/map-canada.anchors.json`, `assets/style/map-canada.md` §6–§7 | `make validate-content`; Ottawa and Toronto no longer touch. **Done 2026-09-25, branch `corridor-inset`:** `insets[1]` at 3×, Ottawa–Toronto 133.1 apart in the inset; Kingston published in `assets/style/map-canada.md` §6 as main (621.0, 526.6), inset (895.2, 268.8) |
| K-0.6 | ADR-0069 §6 **commit 3**: pin separation | infra | `scripts/lib/screen-art.mjs` (§3.4) | Passes on the K-0.5 tree. **Done 2026-09-25, branch `pin-separation`:** closest pairs against a 45.4 diameter are main map 74.6, `insets[0]` 54.0 and `insets[1]` 133.1. The pre-inset anchors fail at Ottawa–Toronto 44.4. The fraction's one home stays the pin rule in `app/ui/screen-styles.ts` (ADR-0069, the discharged marker). **For K-2.2:** Kingston's published inset point is 55.1 from Ottawa and 91.2 from Toronto, so it passes |
| K-0.7 | **Boundary defect, still open after `map-insets`.** The anchor rule is now keyed on `journey`, and it fails both ways: a journey id with no anchor, and an anchor naming no journey place (`screen-art.mjs`, "names no place in game.config.json#/journey"). So Kingston's journey id (content) and its anchor (art) still have to land in one commit. The defect moved from the level document to the config. Fix: let an anchor precede its place, with the reverse check kept for ids that no story, level or anchor sheet declares. Or keep ADR-0069 §6's fallback: content lands both with art's published coordinates, and art reviews | infra (the fix) or content (the fallback) | `scripts/lib/screen-art.mjs`, `tests/unit/infra/…` | With the fix, K-2.2 carries no art file |
| K-0.8 | Data-driven blind hand-off. Québec City's stops needed `'wolfe-montcalm': singleSource()` added to `scripts/lib/art-handoff.mjs`, which is an infra file edited for an art subject. Read the composition from `assets/refs/references.json` instead | infra | `scripts/lib/art-handoff.mjs`, `tests/unit/infra/art-handoff-gate.test.ts` | A new subject needs no script edit |
| K-0.9 | Product owner rulings: the subtitles, OQ-KINGSTON-1 (the giver), OQ-KINGSTON-2 (`hist-39` at Kingston Mills), OQ-KINGSTON-3 (content-review §1 item 5), and the stops, territory statement and pools | po | `docs/stories/TN-LEVEL-kingston.md` | **Done 2026-09-25:** "Rulings (K-0.9)" in the story. The subtitles are "Early Canada" / « Les débuts du Canada » and "Building Canada" / « La construction du Canada » (the French changed from « Bâtir le Canada »). The giver is the existing `guide`. Item 5 does not apply as scoped, with a tripwire, and the project owner may overturn it. If `hist-39` is refused, Kingston Mills keeps its blurb and asks nothing. There are four landmarks. City Hall's card now tells the Province of Canada (`hist-44`) instead of Macdonald, whom the guide's lines tell. The Wellington line is taught at Fort Henry. The territory statement has `nations: []` and cites p. 30. The loading line is "Getting the lakeshore ready." (Vancouver already had "waterfront"). New scenarios TN-KINGSTON-10 and -11. The carry into other stories is K-0.9b |
| K-0.9b | Carry K-0.9 into the stories that repeat it: narrow `level.quebec-city.subtitle` in `TN-LEVELS-2-to-10-spine.md` (and in the "L'histoire du Canada" line of `TN-LEVEL-quebec-city.md`), and carry "of 11" into the exam, result, map and passport stories, effective when Kingston lands. Then the ADR-0068 `owner=po` marker (due 2026-12-23) can be struck by whoever may edit ADRs | po (stories); the ADR's owner (the marker) | `docs/stories/TN-LEVELS-2-to-10-spine.md`, `TN-LEVEL-quebec-city.md`, `TN-EXAM-starting-and-answering.md`, `TN-RESULT-exam-results.md`, `TN-MAP-level-select.md`, `TN-PASSPORT-my-passport.md`; `docs/adr/ADR-0068-….md` (the marker only) | Before K-2.2b. `make check-obligations` green |
| K-0.10 | Optional tier 1 margin work at Québec City: move `terrace-kiosk`'s read from `history-15` (Confederation, Kingston's half after the split) to `history-12` (pp. 28–29, Québec City's half), and author ≥ 4 pre-1812 questions so `history` holds ≥ 36 (ADR-0068 §6). Author and verifier commits are separate | content-author, then content-verifier | `content/quests/quebec-city-chateau-frontenac.json`; `content/questions/history/*.json` | Not a precondition. It does not move the 65 |

### Phase 1: the Kingston landing PR. One PR, commits in this order. The tree is green at the head, and red between the author and verifier commits by design (ADR-0003)

Deploy precondition: a Pages deploy containing `c78688d` (the monotone unlock walk, PR #142) has gone out
**before** this PR merges. ADR-0068's discharged engine marker says Kingston's config slot must not ship in
the same release.

| # | Commit | Owner | Files | Acceptance |
|---|---|---|---|---|
| K-1.1 | **Author re-file.** Move exactly the 65 files of ADR-0068 §2 (`hist-32`…`hist-93`, `hist-94`, `hist-95`, `hist-97`) with `git mv` and ids unchanged. Set `"subject": "building-canada"`. Write `verification` in the null form. In the same commit, re-pool Québec City's three `answer` steps to `history` ids only, each holding at least its count of 5 (32 ids over three steps) | content-author | `content/questions/building-canada/hist-*.json` (65), `content/questions/history/` (65 removed), `content/quests/quebec-city-chateau-frontenac.json` | `an-answer-steps-pool-can-fill-its-count` and `a-proposition-belongs-to-one-subject` green. `verify-content` red (expected) |
| K-1.2 | **Verifier re-grant.** Write the verification blocks of the 65 and touch nothing else. Record `distractorsNotEntailed` where ADR-0064 requires it. Rule on `hist-39`'s "Kingston." distractor as asked at Kingston. Report the count granted | content-verifier | the same 65 files, `verification` only | ≥ 30 granted, or stop and reopen ADR-0068. `verify-content` green for the split |
| K-1.3 | Rewrite any refused question, then re-grant it (a pair of commits per round) | content-author, then content-verifier | the refused files | As K-1.2 |
| K-2.1 | **Art: Kingston level.** The layers, ground and ground dressing (ADR-0042). Props for `fort-henry`, `kingston-city-hall`, `kingston-mills` and `royal-military-college`, each pinned to 1×. The giver uses the existing `guide` rig (OQ-KINGSTON-1, ruled in K-0.9). Contracts, reference photographs, credits, and the art sheet with its placement table. Rules: no figures at any landmark, no Indigenous figure in any scene, no Métis sash, no Macdonald statue (removed in 2021; confirm from dated photographs), no crest | art | `assets/src/svg/kingston/*.svg`, `assets/refs/kingston/*`, `assets/refs/references.json` (4 landmarks + any generic props), `assets/credits.json`, `assets/style/kingston-level.md` | Palette lint OK. Unclaimed until K-2.2, so red until then. **Done 2026-09-25, branch `kingston-art`:** four layers, a paving strip and the four stops, all props pinned to 1×; five subjects in `references.json`, each carrying its own `handoff` builder (K-0.8), so no script edit; fourteen references (one CC0, three public domain, ten CC BY). Measured in a scratch root with a minimal level document: Kingston's own art **84,762 B** (the lightest level; median 230,288), all level art 3,299,487 B of the 5,242,880 B background cache; payload 0.54 of 8 MiB; texture 30.53 of 36 MiB charged. The numbers K-2.2 needs are in `assets/style/kingston-level.md` §3. Not drawn, for want of a licence-clean present-day photograph: Kingston Mills' railway bridge and blockhouse |
| K-2.2 | **Level document, quest, journey.** `content/levels/kingston.json`: subject `building-canada`, order 5, walk. Stops at a ~1,600 px pitch, e.g. giver ~1,250 and landmarks ~1,540 / 3,140 / 4,740 / 6,340. `size.x` so that every POI's x + max(radiusPx, reachPx) < size.x − 540, with ≥ 7,680 expected (ADR-0074 §4). Ground polyline to the end. Declare 36–40 MiB of `textureBudgetBytes`. Blurbs, facts and the ADR-0051 territory statement, all in the null verification form. The quest, per story (Rulings 2, 6 and 7): `talk`, then for each landmark `visit → read (≤ 4 passages, ≤ 120 words) → answer` (ADR-0067 chain). 4 `answer` steps, pools of `building-canada` ids the level taught before the step (ADR-0057). Reads come from lessons 03–07 and 13–18 (147 passages; 16 places). **Config:** `kingston` at journey slot 5 and after `ottawa` in `unlockRules.order`, with `order` renumbered 6–11 in `toronto` … `the-north`. The map anchor goes here only on the K-0.7 fallback | content-author | `content/levels/kingston.json`, `content/quests/kingston-*.json`, `content/game.config.json`, `content/levels/{toronto,winnipeg,prairie-rail,alberta-foothills,vancouver,the-north}.json` (`order` only), `tests/unit/contracts/teach-back-baseline.json` (only ever lowered), and `map-canada.anchors.json` on the fallback | `validate-content`, `a-quests-answer-steps-fill-in-one-sitting`, `a-stop-reads-at-most-four-passages`, `every-stop-stands-before-the-end`, `unlock-chain-is-reachable`, `journey-cap-is-one-number`, `task-fits-the-strip` (3 lines at 390×844, 200%), the teach-back ratchet, and `make assets` within budget |
| K-2.2b | **Copy rows, EN and FR.** Add `level.kingston.{title,subtitle,loading,error.title,play,finishFirst}` and `stamp.kingston.earned`, and change Québec City's subtitle, all as the story's copy table (ratified in K-0.9). Player-facing copy is in `app/ui/copy.ts` (ADR-0010), not in `content/locales/`, so the content author cannot land it. That makes it this PR's second owner, in its own commit | ui-a11y | `app/ui/copy.ts` | EN/FR parity. The subtitle is the exam's subject label (`app/bootstrap/subjects.ts`) |
| K-2.3 | **Verifier: Kingston's claims.** The POI facts, the territory fact, and the quest's fact-bearing lines. Held to content-review §9.4 for `hist-34`, `hist-52`, `hist-55`–`hist-58` (faithful paraphrase, no added context) | content-verifier | `verification` blocks in `content/levels/kingston.json` and `content/quests/kingston-*.json` | `make verify-content` green |
| K-2.4 | **Blind identification.** Run the anonymised hand-off, identify, score, and record the result. Done by an agent that saw none of K-2.1 | art-verifier | `docs/art-verification.json` via `make art-handoff-blind` / `make verify-art` | Every Kingston subject PASS, with no offset drift |
| K-2.5 | Redraw anything K-2.4 failed, then run K-2.4 again (a redraw makes the verdict stale) | art, then art-verifier | as K-2.1 / K-2.4 | As K-2.4 |
| K-2.6 | The engine and a11y proof: the level loads from JSON alone (no scene code), a Kingston e2e walk to the stamp and into Toronto (ADR-0074), axe on the Kingston card, map, passport "of 11", the exam's "Subjects ready n of 11" and an 11-row result | engine (e2e and perf); ui-a11y (a11y) | `tests/e2e/kingston-*.spec.ts`, `tests/a11y/*.spec.ts` | `make test-e2e test-a11y test-perf` in CI. Frame time at the medium preset ≤ 16.7 ms |
| K-2.7 | Plan state: the L8 row and this file | architect | `docs/plan/slices.md`, `docs/plan/kingston.md` | — |

### Phase 2: after merge

| # | Step | Owner | Files |
|---|---|---|---|
| K-3.1 | ADR-0068's amendment marker (due 2027-02-23): the split as merged, the count granted in each half, Québec City's pool sizes, headroom 1, and "§7 met by stops (this file §1)" | architect | `docs/adr/ADR-0068-….md` |
| K-3.2 | The territory statement's `about-this-place` checks and the Macdonald panel question (OQ-KINGSTON-4) stay with the product owner. No agent writes that panel. OQ-KINGSTON-5 (whether the source rule may widen so that the statement can name Katarokwi's nations) is the project owner's | po; project owner | `docs/stories/TN-LEVEL-kingston.md` |

## 4. Rules here that no gate can express

- **The width refusal in §1** is a play judgement (ADR-0065 §Rules), made by the architect on measured
  numbers. It is recorded here and not in a test.
- **The K-0.3 sweep's completeness.** A literal `10` meaning something else cannot be told apart by a grep.
  The fixture-of-eleven test is the check.
- **That Kingston's four landmarks fit 226 KiB** is only a gate once K-0.1b lands. Until then `make build`
  catches it, late, in the landing PR. That is why K-0.1 comes first.
