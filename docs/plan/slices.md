# Delivery plan

State lives here, not in conversation history. Update the status column when a slice lands.

| # | Slice | Goal | Status |
|---|---|---|---|
| 0 | Foundation | Harness, repo skeleton, Makefile, CI + Pages deploying an empty portrait canvas, ADR-0001..0008 | Done |
| 1 | Vertical proof (see `slice-1.md`) | Level 4 — How Canadians Govern Themselves (Ottawa, skate). Boot → creator → level → officer → quest → 3 scheduled questions → Study mode → save/reload, live on Pages, art and content verified | In progress. Study, the question card and the in-level learning loop are wired and reachable on `dist/` (task 1.23); the officer, the quest and the character creator are not. |
| 2 | Scale proof | Level 3 — Canada's History (Québec City, toboggan), added by JSON + assets only, no engine changes | Not started |
| 3 | Level 1 — Rights and Responsibilities (Halifax, Pier 21, walk) | Level + quest + verified questions | Not started |
| 4 | Level 2 — Who We Are (Mi'kma'ki coast, canoe) | Level + quest + verified questions | Not started |
| 5 | Level 5 — Federal Elections (Toronto, bike) | Level + quest + verified questions | Not started |
| 6 | Level 6 — The Justice System (Winnipeg, walk) | Level + quest + verified questions | Not started |
| 7 | Level 7 — Modern Canada (Prairie rail, train) | Level + quest + verified questions | Not started |
| 8 | Level 8 — Canada's Economy (Alberta ranchland, horse) | Level + quest + verified questions | Not started |
| 9 | Level 9 — Canadian Symbols (Rockies to Vancouver, skateboard) | Level + quest + verified questions | Not started |
| 10 | Level 10 — Canada's Regions (The North, dogsled) | Level + quest + verified questions | Not started |
| C1..C10 | Content slices | ≥ 30 verified questions per subject; run in parallel with level work | Not started |
| F1 | Exam mode | Official format, optional timer, results by subject | **Built** — 2026-09-09. Start screen, twenty-question draw, running exam, optional clock, result with by-subject rows and the full review, leaving and resuming, the passport panel. Open: the ten subjects are still not declared in `game.config.json` (`OQ-EXAM-5`), so `exam.subjectsReady` counts `journey.length` as the map and passport already do |
| F2 | Accessibility pass | Full audit: keyboard, switch, screen reader, scaling, contrast | Not started |
| F3 | PWA and offline | Workbox per level, installable, offline after first load | Not started |
| F4 | Performance pass | Every target device against the budgets | Not started |
| F5 | Docs completion | ADRs, architecture, art bible, content review, runbook, credits, contributing | Not started |

## Rules
- A level must be addable by JSON and assets alone. If a level needs engine changes, the schema is wrong —
  fix the schema first (that is what slice 2 proves).
- Content slices touch only `content/` and can run beside level work.
- Nothing after slice 1 starts until slice 1 is live on Pages with `verify-art` and `verify-content` green.
- A gate is not trusted until it has been seen to fail on a real violation. Slice 0's audit found three that
  measured nothing and two skipped tests that asserted `0 === 0`; assume the next one is in here too.
