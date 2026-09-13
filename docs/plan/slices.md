# Delivery plan

State lives here, not in conversation history. Update the status column when a slice lands.

| # | Slice | Goal | Status |
|---|---|---|---|
| 0 | Foundation | Harness, repo skeleton, Makefile, CI + Pages deploying an empty portrait canvas, ADR-0001..0008 | Done |
| 1 | Vertical proof (see `slice-1.md`) | Level 4 — How Canadians Govern Themselves (Ottawa, skate). Boot → creator → level → officer → quest → questions → Study mode → save/reload | **Done** — 2026-09-13. The officer, the quest and the character creator all landed; the loop runs end to end on Pages |
| 2 | Scale proof | Level 3 — Canada's History (Québec City, toboggan), added by JSON + assets only | **Done** |
| 3 | Level 1 — Rights and Responsibilities (Halifax, walk) | Level + quest + verified questions | **Done** |
| 4 | Level 2 — Who We Are (Peggy's Cove, walk) | Level + quest + verified questions | **Done** — the place is a Nova Scotia fishing village, not a territory, and the locomotion is walk, not canoe. `docs/content-review.md` §1 blocks a level whose *subject* is a nation's territory; the quest is offered by the lighthouse itself under ADR-0029, because this level draws no figure at any scale |
| 5 | Level 5 — Federal Elections (Toronto, bike) | Level + quest + verified questions | **Done**, and the thinnest level in the game: one point of interest against three or four elsewhere, so it asks 5 questions where others ask 7 to 9. Blocked on licence-clean references — a polling place, a streetcar, and Nathan Phillips Square or the island ferry |
| 6 | Level 6 — The Justice System (Winnipeg, walk) | Level + quest + verified questions | **Done** |
| 7 | Level 7 — Modern Canada (Prairie rail, train) | Level + quest + verified questions | **Done** |
| 8 | Level 8 — Canada's Economy (Alberta foothills, horse) | Level + quest + verified questions | **Done** |
| 9 | Level 9 — Canadian Symbols (Vancouver, skateboard) | Level + quest + verified questions | **Done** |
| 10 | Level 10 — Canada's Regions (the North, walk) | Level + quest + verified questions | **Done** — set at Whitehorse on the Yukon River. Recorded in `assets/style/the-north-level.md` §11 as a **scope decision rather than a solution**: a level about Canada's regions set in the North either depicts the peoples of Inuit Nunangat or removes them from a level about where they live, and this project has no reviewer who may say which. Locomotion is walk, not dogsled |
| C1..C10 | Content slices | ≥ 30 verified questions per subject | **Done** — 458 verified. economy 33, elections 36, government 38, history 96, justice 32, modern-canada 40, regions 58, rights 37, symbols 42, who-we-are 46. Levels now ask 5–9 questions each rather than 3, so justice and economy are being funded toward 45 |
| F1 | Exam mode | Official format, optional timer, results by subject | **Done** — 2026-09-09 |
| F2 | Accessibility pass | Full audit: keyboard, switch, screen reader, scaling, contrast | **Substantially done** — 299 assertions in `tests/a11y/`, axe-core on every DOM screen including "About this place", single-switch and 200% text covered. Not signed off as an audit |
| F3 | PWA and offline | Workbox per level, installable, offline after first load | **Not started** — no service worker and no manifest in the tree |
| F4 | Performance pass | Every target device against the budgets | **In progress, and CI has never measured it.** The perf job reports "the page is not animating, so nothing was measured" on a GPU-less runner and is deliberately non-blocking |
| F5 | Docs completion | ADRs, architecture, art bible, content review, runbook, credits, contributing | **In progress** — 29 ADRs, `docs/guidelines/` for outside contributors, art sheets per level. No runbook, no contributing guide |

## Rules
- A level must be addable by JSON and assets alone. If a level needs engine changes, the schema is wrong —
  fix the schema first (that is what slice 2 proves).
- Content slices touch only `content/` and can run beside level work.
- Nothing after slice 1 starts until slice 1 is live on Pages with `verify-art` and `verify-content` green.
- A gate is not trusted until it has been seen to fail on a real violation. Slice 0's audit found three that
  measured nothing and two skipped tests that asserted `0 === 0`; assume the next one is in here too.
