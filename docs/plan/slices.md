# Delivery plan

State lives here, not in conversation history. Update the status column when a slice lands.

| # | Slice | Goal | Status |
|---|---|---|---|
| 0 | Foundation | Harness, repo skeleton, Makefile, CI + Pages deploying an empty portrait canvas, ADR-0001..0008 | Done |
| 1 | Vertical proof (see `slice-1.md`) | Level 4 — How Canadians Govern Themselves (Ottawa, skate). Boot → creator → level → officer → quest → questions → Study mode → save/reload | **Done** — 2026-09-13. The officer, the quest and the character creator all landed; the loop runs end to end on Pages |
| 2 | Scale proof | Level 3 — Canada's History (Québec City, toboggan), added by JSON + assets only | **Done** |
| 3 | Level 1 — Rights and Responsibilities (Halifax, walk) | Level + quest + verified questions | **Done** |
| 4 | Level 2 — Who We Are (Peggy's Cove, walk) | Level + quest + verified questions | **Done** — the place is a Nova Scotia fishing village, not a territory, and the locomotion is walk, not canoe. `docs/content-review.md` §1 blocks a level whose *subject* is a nation's territory; the quest is offered by the lighthouse itself under ADR-0029, because this level draws no figure at any scale |
| 5 | Level 5 — Federal Elections (Toronto, bike) | Level + quest + verified questions | **Done** — three points of interest since 2026-09-13: a streetcar teaching which services local governments run (p. 66), the CN Tower, and Nathan Phillips Square teaching where most Canadians live (p. 98), drawn from licence-checked photographs. All three are quest stops since 2026-09-14, so the level asks 8 questions where it asked 5. No licence-clean photograph of a polling station interior exists, so the level's own subject still has no object to stand on |
| 6 | Level 6 — The Justice System (Winnipeg, walk) | Level + quest + verified questions | **Done** |
| 7 | Level 7 — Modern Canada (Prairie rail, train) | Level + quest + verified questions | **Done** |
| 8 | Level 8 — Canada's Economy (Alberta foothills, horse) | Level + quest + verified questions | **Done** — a pump jack joined the ranch gate, barn and cattle on 2026-09-14, teaching that Alberta produces more oil and gas than anywhere else in Canada (p. 101), and the quest now stops at all four, asking 9 questions where it asked 7 |
| 9 | Level 9 — Canadian Symbols (Vancouver, skateboard) | Level + quest + verified questions | **Done** |
| 10 | Level 10 — Canada's Regions (the North, walk) | Level + quest + verified questions | **Done** — set at Whitehorse on the Yukon River. Recorded in `assets/style/the-north-level.md` §11 as a **scope decision rather than a solution**: a level about Canada's regions set in the North either depicts the peoples of Inuit Nunangat or removes them from a level about where they live, and this project has no reviewer who may say which. Locomotion is walk, not dogsled |
| C1..C10 | Content slices | ≥ 30 verified questions per subject | **Done** — 481 verified. economy 49, elections 36, government 38, history 96, justice 39, modern-canada 40, regions 58, rights 37, symbols 42, who-we-are 46. Levels now ask 5–9 questions each rather than 3, so the two thinnest banks were funded: 8 justice and 16 economy questions added 2026-09-13; 24 granted after one round of rewrites, 1 left rejected. **Justice stops below 40 by decision, not shortfall** — `jus-33` is unrecoverable (true on the page, false in the world, and its recoverable form belongs to government) and `jus-37` survives only as its "Supreme Court" half, because the guide's "Court of Queen's Bench" is now King's Bench — every sentence on pages 75–77 is already a question and almost all other justice material belongs to another subject's remit (habeas corpus and jury duty to rights, criminal law as federal to government). Reaching 45 would mean moving propositions between subjects under ADR-0028, not worth it for a handful of questions; 39 clears the floor of 30. Economy can reach 45 with material left (pp. 96–98, 102–103) |
| F1 | Exam mode | Official format, optional timer, results by subject | **Done** — 2026-09-09 |
| F2 | Accessibility pass | Full audit: keyboard, switch, screen reader, scaling, contrast | **Substantially done** — `tests/a11y/` runs axe-core on every DOM screen, including "About this place" and the level-select map, single-switch and 200% text covered. Not signed off as an audit |
| F3 | PWA and offline | Workbox per level, installable, offline after first load | **Not started** — no service worker and no manifest in the tree |
| F4 | Performance pass | Every target device against the budgets | **In progress.** Since 2026-09-13 CI measures what a GPU-less runner can, and blocks on it: overdraw per visited tier and GPU texture memory counted at the WebGL API (calibrated in the same run), plus payload (`tests/perf/README.md`). Frame time and per-character cost are device-only (`make test-perf-device`) and have **no recorded pass**. Particles are measured nowhere until `data-particles` stops having two writers. `high` is never exercised on a runner, and the tier tracker cycles low/medium on SwiftShader (both raised with the app owner) |
| F5 | Docs completion | ADRs, architecture, art bible, content review, runbook, credits, contributing | **In progress** — 30 ADRs, `docs/guidelines/` for outside contributors, art sheets per level. a runbook covering the perf lanes; no contributing guide |

## Rules
- A level must be addable by JSON and assets alone. If a level needs engine changes, the schema is wrong —
  fix the schema first (that is what slice 2 proves).
- Content slices touch only `content/` and can run beside level work.
- Nothing after slice 1 starts until slice 1 is live on Pages with `verify-art` and `verify-content` green.
- A gate is not trusted until it has been seen to fail on a real violation. Slice 0's audit found three that
  measured nothing and two skipped tests that asserted `0 === 0`; assume the next one is in here too.
